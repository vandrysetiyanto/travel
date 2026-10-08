import { NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';

// ─────────────────────────────────────────────────────────────────────────────
// OCR dokumen kependudukan Indonesia: KTP, KK, dan Paspor (MRZ).
//
// TIDAK dipagar sesi: dipakai formulir pendaftaran PUBLIK (/register ->
// RegisterForm -> PilgrimCard -> OCRUploader). Endpoint ini hanya membaca gambar
// yang diunggah lalu mengembalikan hasil parse; tidak menyentuh DB sama sekali.
//
// Catatan penting:
//  - `ind.traineddata` & `eng.traineddata` tersedia di root proyek; langPath
//    diarahkan ke situ supaya OCR OFFLINE (tidak mengunduh dari CDN jsDelivr).
//  - Worker dibuat SEKALI lalu dipakai ulang antar-request.
//  - PRA-PROSES WAJIB untuk foto asli: foto KTP dari HP sering hanya ~700 px
//    lebar dan tesseract MENJATUHKAN baris teks pada resolusi itu (terbukti:
//    baris "Nama" dan "Alamat" hilang total, sehingga field jadi kosong/salah).
//    Upscale ke sisi panjang >= 1600 px + grayscale + normalise memulihkannya.
//  - Aturan tata letak: LABEL dan NILAI sering di baris OCR terpisah, satu baris
//    bisa memuat DUA kolom (mis. "Jenis Kelamin : PEREMPUAN Gol. Darah : B"),
//    dan label bisa salah baca ("Tgl" -> "Tgi", "Kel/Desa" -> "KellDesa").
//    Jadi pencarian nilai: boleh turun baris, kandidat tak layak DILEWATI, dan
//    label dicocokkan dengan varian yang toleran.
// ─────────────────────────────────────────────────────────────────────────────

type DocType = 'KTP' | 'KK' | 'PASPOR';

/** Jenis potongan alamat (urutan tampil: jalan, RT/RW, kelurahan, kecamatan). */
type AddrKind = 'main' | 'rtrw' | 'kel' | 'kec';

type AddrPart = { kind: AddrKind; value: string; conf: number };

/**
 * Pasangan kata yang di KTP selalu ditulis terpisah, tetapi pada foto beresolusi rendah
 * sering terbaca menyatu ("TANAH RENDAH" -> "TANAHRENDAH", "AIR PUTIH" -> "AIRPUTIH").
 * Sengaja berupa daftar PASANGAN, bukan daftar kata umum: pendekatan kata umum ikut
 * memecah nama tempat yang sah dan sudah benar ("SUKAJADI", "TEGALSARI").
 */
const GLUED_PAIRS: [string, string][] = [
  ['TANAH', 'RENDAH'], ['TANAH', 'ABANG'], ['TANAH', 'TINGGI'], ['TANAH', 'MERAH'], ['TANAH', 'PUTIH'],
  ['AIR', 'PUTIH'], ['AIR', 'HITAM'], ['AIR', 'JERNIH'], ['AIR', 'MATA'], ['AIR', 'BESAR'], ['AIR', 'KECIL'],
  ['KALI', 'BESAR'], ['KALI', 'KECIL'], ['KALI', 'ABANG'], ['KALI', 'MALANG'],
  ['PASAR', 'MINGGU'], ['PASAR', 'BARU'], ['PASAR', 'KEMIS'], ['PASAR', 'REBO'], ['PASAR', 'JUMAT'],
  ['KEBON', 'JERUK'], ['KEBON', 'KELAPA'], ['KEBON', 'SIRIH'], ['KEBUN', 'JERUK'],
  ['JALAN', 'RAYA'], ['PERUM', 'NASIONAL'], ['TAMBAK', 'REJO'], ['TAMBAK', 'OSOWILANGUN'],
  ['BUKIT', 'DURI'], ['SUNGAI', 'BAMBU'], ['SUNGAI', 'BESAR'], ['GROGOL', 'SELATAN'],
];

/** Pecah "TANAHRENDAH" -> "TANAH RENDAH" hanya bila cocok pasangan yang dikenal. */
function repairGluedWords(s: string): string {
  return collapse(
    (s || '')
      .split(' ')
      .map((tok) => {
        const clean = tok.replace(/[^A-Za-z]/g, '');
        if (clean.length < 8) return tok;
        const up = clean.toUpperCase();
        for (const [a, b] of GLUED_PAIRS) {
          if (up === a + b) return `${clean.slice(0, a.length)} ${clean.slice(a.length)}`;
        }
        return tok;
      })
      .join(' ')
  );
}

/** Satu baris hasil OCR beserta confidence-nya. */
type OcrLine = { text: string; conf: number };

type ParsedDoc = {
  nik: string;
  noKK: string;
  fullName: string;
  birthPlace: string;
  birthDate: string;
  gender: string;
  address: string;
  /** Potongan alamat berjenis; tiap potongan dipilih dari varian dengan confidence baris tertinggi. */
  addressParts: AddrPart[];
  passportNumber: string;
  passportExpiry: string;
};

type TesseractWorker = Awaited<ReturnType<typeof createWorker>>;

let workerPromise: Promise<TesseractWorker> | null = null;

function getWorker(): Promise<TesseractWorker> {
  if (!workerPromise) {
    workerPromise = createWorker('ind+eng', undefined, {
      langPath: process.cwd(),
      cachePath: process.cwd(),
      logger: () => {},
    } as any).catch((err: any) => {
      workerPromise = null; // biar request berikutnya boleh coba lagi
      throw err;
    });
  }
  return workerPromise;
}

// ── pra-proses gambar ───────────────────────────────────────────────────────

const MIN_LONG_EDGE = 2100;
const MAX_LONG_EDGE = 2600;

/**
 * Siapkan gambar untuk OCR: perbaiki orientasi EXIF, skala sisi panjang ke
 * ~1600–2600 px, jadikan grayscale, rentangkan kontras, dan pertajam sedikit.
 * Bila gagal (format aneh), kembalikan buffer asli — OCR masih boleh dicoba.
 */
async function preprocessImage(buf: Buffer, minLongEdge = MIN_LONG_EDGE, maxScale = 3.0): Promise<Buffer> {
  try {
    const img = sharp(buf, { failOn: 'none' }).rotate(); // rotate() = ikuti EXIF
    const meta = await img.metadata();
    const w = meta.width || 0;
    const h = meta.height || 0;
    const longEdge = Math.max(w, h);
    if (!w || !h || !longEdge) return buf;

    let p = img;
    let scale = 1;
    if (longEdge < minLongEdge) scale = Math.min(maxScale, minLongEdge / longEdge);
    else if (longEdge > MAX_LONG_EDGE) scale = MAX_LONG_EDGE / longEdge;

    if (Math.abs(scale - 1) > 0.01) {
      p = p.resize({
        width: Math.round(w * scale),
        height: Math.round(h * scale),
        kernel: 'lanczos3',
      });
    }

    return await p.grayscale().normalise().sharpen({ sigma: 0.8 }).png().toBuffer();
  } catch {
    return buf;
  }
}

// ── util teks ───────────────────────────────────────────────────────────────

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');
const collapse = (s: string) => (s || '').replace(/\s+/g, ' ').trim();

/** Karakter hiasan/keamanan kartu yang ikut terbaca OCR (—, –, ·, ▬, ░, dsb.). */
const DECOR = /[\u2010-\u2015\u00b7\u2022\u2027\u2500-\u257f\u25a0-\u25ff]/g;

/** Buang hiasan + rapikan spasi: "——— TAMBAK REJO" -> "TAMBAK REJO". */
const deDecor = (s: string) => collapse((s || '').replace(DECOR, ' '));

const linesOf = (text: string) =>
  text
    .split('\n')
    .map((l) => deDecor(l))
    .filter(Boolean);

/** Kata alamat yang menandakan ekor itu MASIH bagian alamat — jangan dipotong. */
const ADDR_WORD = /^(KEL|KEC|KELURAHAN|KECAMATAN|RT|RW|JL|JALAN|BLOK|NO|DESA|DUSUN|KAMPUNG|GANG|PERUM|GG)$/i;

/** Buang ekor sampah hasil OCR (mis. "JL. PASTI CEPAT A7/66 . El" -> buang ".", "El"). */
function stripTrailingJunk(s: string): string {
  const t = deDecor(s).split(' ').filter(Boolean);
  while (t.length && (t[t.length - 1].length < 3 || !/[A-Za-z0-9]/.test(t[t.length - 1]))) t.pop();
  let out = t.join(' ');
  // Bila ada nomor (mis. "A7/66"), buang paling banyak 2 kata sampah yang menyusul —
  // TAPI jangan buang bila kata itu masih bagian alamat (KEL/KEC/RT/RW/...).
  if (/\d/.test(out)) {
    const parts = out.split(' ');
    let lastNum = -1;
    parts.forEach((p, i) => {
      if (/[A-Za-z0-9]/.test(p) && /\d/.test(p)) lastNum = i;
    });
    const tail = parts.slice(lastNum + 1);
    if (lastNum >= 0 && tail.length > 0 && tail.length <= 2 && !tail.some((w) => ADDR_WORD.test(w))) {
      out = parts.slice(0, lastNum + 1).join(' ');
    }
  }
  return out;
}

/** Kata-kata label/kolom yang tidak boleh dianggap bagian dari nama. */
const LABEL_WORDS =
  /\b(NIK|Nama|Alamat|Jenis|Kelamin|Tempat|Tgl|Tgi|Lahir|Gol|Darah|Agama|Status|Perkawinan|Kewarganegaraan|Pekerjaan|Berlaku|Hingga|KARTU|KELUARGA|Kepala|Anggota|LAKI|PEREMPUAN|PRIA|WANITA|ISLAM|KRISTEN|HINDU|BUDHA|KAWIN|BELUM|SEUMUR|HIDUP|No|FOTO|Tanda|Tangan|RT|RW)\b/gi;

function cleanName(raw: string): string {
  return collapse(
    collapse(deDecor(raw).replace(LABEL_WORDS, ' ')).replace(/[^A-Za-z .,'-]/g, ' ')
  );
}

/** Layak dianggap nama orang: ada huruf, minimal 2 kata atau >=4 huruf, bukan label. */
function looksLikeName(s: string): boolean {
  const t = collapse(s);
  if (!t || t.length < 4) return false;
  const words = t.split(' ').filter((w) => /^[A-Za-z][A-Za-z.'’-]*$/.test(w));
  if (!words.length) return false;
  if (words.length >= 2) return true;
  return words[0].length >= 5;
}

/**
 * Ambil nilai sebuah label.
 * - Boleh mengambil dari baris berikutnya (label & nilai sering terpisah).
 * - Kandidat yang tidak layak DILEWATI, pencarian lanjut (penting karena satu
 *   baris bisa memuat dua kolom: "Nama Agama" pada kartu, "… Gol. Darah : B" pada KTP asli).
 */
function valueAfterLabel(
  lines: string[],
  labelRe: RegExp,
  opts: {
    maxNext?: number;
    reject?: RegExp;
    scrub?: (s: string) => string;
    accept?: (s: string) => boolean;
    minLen?: number;
  } = {}
): string {
  const maxNext = opts.maxNext ?? 3;
  const scrub = opts.scrub ?? ((s: string) => collapse(s));
  const minLen = opts.minLen ?? 1;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(labelRe);
    if (!m) continue;

    const cands: string[] = [];
    const rest = collapse(lines[i].slice((m.index || 0) + m[0].length).replace(/^[\s:;=.\-|]+/, ''));
    if (rest) cands.push(rest);
    for (let j = i + 1; j <= Math.min(i + maxNext, lines.length - 1); j++) {
      const c = collapse(lines[j]);
      if (c) cands.push(c);
    }

    for (const c of cands) {
      if (opts.reject && opts.reject.test(c)) continue;
      const s = scrub(c);
      if (s.length < minLen) continue;
      if (opts.accept && !opts.accept(s)) continue;
      return s;
    }
  }
  return '';
}

/**
 * Sub-label yang MASIH bagian dari alamat, tetapi pendahuluan labelnya dibuang
 * saat dirangkai ("KEL. CILANDAK TIMUR" -> "CILANDAK TIMUR", "KelDesa TANAH RENDAH" -> "TANAH RENDAH").
 */
const ADDR_SUBLABEL = /^(KEL\s*[\/|]?\s*DESA|KELL?DESA|KELURAHAN|KEL\.|KECAMATAN|KEC\.)\s*:?\s*/i;

/** Awal field NON-alamat: di sinilah blok alamat berhenti (titik dua bisa hilang karena noise). */
const FIELD_BREAK =
  /^(AGAMA|STATUS|PEKERJAAN|KEWARGANEGARAAN|BERLAKU|NIK|NAMA|TEMPAT|TG[LI]|JENIS|GOL|FOTO|TANDA|KARTU|ANGGOTA|NO\b|KEPALA)/i;

/** Potong nilai pada label berikutnya ("CILANDAK TIMUR KEC. PASAR MINGGU" -> "CILANDAK TIMUR"). */
function cutAtNextLabel(s: string): string {
  const m = collapse(s).match(
    /^(.*?)\s+(RT\s*[\/|]?\s*RW|RTRW|KEL\s*[\/|]?\s*DESA|KECAMATAN|KEC\.|AGAMA|STATUS|PEKERJAAN|KEWARGANEGARAAN|BERLAKU|NIK|NAMA|TEMPAT|TG[LI]|JENIS|GOL)\b/i
  );
  return m ? collapse(m[1]) : collapse(s);
}

/** Sisa baris label + baris lanjutan sampai ketemu header/label berikutnya. */
function pickAddress(lines: string[], labelRe: RegExp, stopRe: RegExp, maxNext = 5): string {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(labelRe);
    if (!m) continue;

    const parts: string[] = [];
    const rest = collapse(lines[i].slice((m.index || 0) + m[0].length).replace(/^[\s:;=.\-|]+/, ''));
    if (rest && !stopRe.test(rest) && !FIELD_BREAK.test(rest)) parts.push(rest);

    for (let j = i + 1; j <= Math.min(i + maxNext, lines.length - 1); j++) {
      const cand = collapse(lines[j]);
      if (!cand) continue;
      // Akhir blok alamat: field non-alamat, RT/RW (punya pencarian sendiri), atau
      // baris berlabel titik dua yang bukan sub-label alamat.
      if (stopRe.test(cand) || FIELD_BREAK.test(cand) || RTRW_AT_START.test(cand)) break;
      if (/^[A-Za-z][A-Za-z\/\.\s]{0,22}:/.test(cand)) break;
      // Baris lanjutan alamat: buang label sub-alamat ("KEL." / "KelDesa" / "Kecamatan")
      const val = collapse(cand.replace(ADDR_SUBLABEL, ''));
      if (!val) continue;
      if (!parts.join(' ').toUpperCase().includes(val.toUpperCase())) parts.push(val);
    }
    if (parts.length) return collapse(parts.join(' '));
  }
  return '';
}

/** Label RT/RW; OCR sering membaca "RT/RW" menjadi "BERW" atau "RTRW". */
const RTRW_LABEL = /R\s*T\s*[\/|]?\s*R\s*W|RTIRW|BERW|BTRW|RTRW/i;

/**
 * Sama seperti RTRW_LABEL tetapi harus di AWAL baris. Dipakai untuk memutuskan akhir blok
 * alamat: baris "TAMBAKREJO RT/RW 000/000" MASIH bagian alamat (jalan + RT/RW satu baris),
 * sedangkan baris "RT/RW : 000/000" adalah label tersendiri sehingga mengakhiri blok.
 */
const RTRW_AT_START = /^\s*(?:R\s*T\s*[\/|]?\s*R\s*W|RTIRW|BERW|BTRW|RTRW)\b/i;

const ADDR_STOP =
  /^(NIK|NAMA|AGAMA|STATUS|PEKERJAAN|KEWARGANEGARAAN|BERLAKU|SEUMUR|GOL|JENIS|TEMPAT|TGL|TGI|KEPALA|FOTO|TANDA|NO\b|KARTU|ANGGOTA|DIKELUARKAN)/i;

/**
 * Tambahkan hanya bila kata/frasa itu belum ada di alamat yang sudah tersusun
 * (mis. nilai Kecamatan sudah termuat di baris kelurahan -> jangan diulang).
 */
function addUnlessPresent(parts: string[], candidate: string): string[] {
  const joined = collapse(parts.join(' ')).toUpperCase();
  const core = candidate.replace(/^(KEL|KEC)\.\s*/i, '').toUpperCase();
  if (core && joined.includes(core)) return [];
  return [candidate];
}

/**
 * Alamat KTP asli tersusun dari beberapa baris berlabel:
 *   Alamat : JL. PASTI CEPAT A7/66
 *   RT/RW  : 007/008
 *   Kel/Desa : PEGADUNGAN
 *   Kecamatan : KALIDERES
 * Semuanya dirangkai menjadi satu alamat. Label dicocokkan toleran karena OCR
 * sering membaca "Kel/Desa" menjadi "KellDesa".
 */
function addressPartsOf(lines: string[], confOf: (v: string) => number = () => 0): AddrPart[] {
  const parts: AddrPart[] = [];
  const main = repairGluedWords(stripTrailingJunk(pickAddress(lines, /ALAMAT/i, ADDR_STOP)));
  if (main) parts.push({ kind: 'main', value: main, conf: confOf(main) });

  const rtrw = valueAfterLabel(lines, RTRW_LABEL, {
    reject: ADDR_STOP,
    maxNext: 1,
    scrub: stripTrailingJunk,
  });
  if (rtrw && /\d/.test(rtrw)) {
    let v = collapse(rtrw).replace(/^[^0-9]*/, '');
    const d6 = v.match(/^(\d{3})\s*[\/|]?\s*(\d{3})$/);
    if (d6) v = `${d6[1]}/${d6[2]}`;
    parts.push({ kind: 'rtrw', value: 'RT/RW ' + v, conf: confOf(rtrw) });
  }

  const kel = valueAfterLabel(lines, /KEL\s*[\/|]?\s*DESA|KELL?DESA|KELURAHAN|KEL\.?\s*DESA/i, {
    reject: ADDR_STOP,
    maxNext: 1,
    scrub: (s) => stripTrailingJunk(cutAtNextLabel(s)),
  });
  if (kel && looksLikeName(kel)) {
    parts.push({ kind: 'kel', value: 'KEL. ' + repairGluedWords(kel), conf: confOf(kel) });
  }

  const kec = valueAfterLabel(lines, /KECAMATAN|KEC\.\s/i, {
    reject: ADDR_STOP,
    maxNext: 1,
    scrub: (s) => stripTrailingJunk(cutAtNextLabel(s)),
  });
  if (kec && looksLikeName(kec)) {
    parts.push({ kind: 'kec', value: 'KEC. ' + repairGluedWords(kec), conf: confOf(kec) });
  }

  return parts;
}

/** Alamat gabungan, tetapi tiap potongan boleh diambil dari hasil OCR berbeda. */
function joinAddress(parts: Array<AddrPart | string>): string {
  const out: string[] = [];
  for (const p of parts) {
    const s = collapse(typeof p === 'string' ? p : p.value);
    if (!s) continue;
    const core = s.replace(/^(KEL|KEC)\.\s*/i, '').toUpperCase();
    if (core && out.join(' ').toUpperCase().includes(core)) continue; // jangan ulang
    out.push(s);
  }
  return collapse(out.join(' '));
}

/** dd-mm-yyyy (atau dd/mm/yyyy, dd.mm.yyyy) -> yyyy-mm-dd. '' kalau tidak valid. */
function parseDMY(raw: string): string {
  const m = (raw || '').match(/(\d{1,2})\s*[-/.\s]\s*(\d{1,2})\s*[-/.\s]\s*(\d{2,4})/);
  if (!m) return '';
  let d = parseInt(m[1], 10);
  let mo = parseInt(m[2], 10);
  let y = parseInt(m[3], 10);
  if (y < 100) y += y > 30 ? 1900 : 2000;
  if (mo > 12 && d <= 12) {
    const t = d;
    d = mo;
    mo = t;
  }
  if (d < 1 || d > 31 || mo < 1 || mo > 12 || y < 1900 || y > 2100) return '';
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

/** 'L' / 'P' / ''. Cek PEREMPUAN lebih dulu (header bisa memuat "LAKI-LAKI"). */
function detectGender(text: string): string {
  const t = (text || '').toUpperCase();
  if (/PEREMPUAN|WANITA/.test(t)) return 'P';
  if (/LAKI\s*-?\s*LAKI|PRIA/.test(t)) return 'L';
  return '';
}

/**
 * Cari 16 digit (NIK / No. KK), toleran format cetak berspasi ("3204 1234 5678 0001").
 * JANGAN ambil grup capture dari pola awalan-provinsi (grup itu cuma prefix "32").
 */
function findId16(text: string, labelRes: RegExp[], preferNikPattern: boolean): string {
  for (const lr of labelRes) {
    const re = new RegExp(lr.source + '[^0-9]{0,24}(\\d[\\d\\s.\\-]{14,24}\\d)', 'i');
    const m = text.match(re);
    if (m) {
      const dig = onlyDigits(m[1]);
      if (dig.length >= 16) return dig.slice(0, 16);
    }
  }
  const joined = text.replace(/[ \t]/g, '');
  if (preferNikPattern) {
    const nik = joined.match(/(?:1[1-9]|21|[37][1-6]|5[1-3]|6[1-5]|[89][12])\d{14}/);
    if (nik) return nik[0];
  }
  const any16 = joined.match(/\d{16}/);
  return any16 ? any16[0] : '';
}

const emptyDoc = (): ParsedDoc => ({
  nik: '',
  noKK: '',
  fullName: '',
  birthPlace: '',
  birthDate: '',
  gender: '',
  address: '',
  addressParts: [],
  passportNumber: '',
  passportExpiry: '',
});

// ── parser per jenis dokumen ────────────────────────────────────────────────

const NAME_REJECT =
  /^(NIK|ALAMAT|JENIS|TEMPAT|TGL|TGI|GOL|AGAMA|ISLAM|KRISTEN|HINDU|BUDHA|STATUS|PERKAWINAN|PEKERJAAN|KEWARGANEGARAAN|BERLAKU|SEUMUR|FOTO|TANDA|KARTU|ANGGOTA)/i;
const NAME_SCRUB_REJECT = /^(KARTU|KELUARGA|KEPALA|NAMA KEPALA)/i;

/** Baris label pada KTP tidak boleh mengandung "Kepala Keluarga" (itu KK). */
const KTP_NAME_LABEL = /NAMA(?!\s*KEPALA\s*KELUARGA)/i;

/** Label Tempat/Tgl Lahir; OCR sering membaca "Tgl" menjadi "Tgi". */
const TTL_LABEL = /(TEMPAT\s*[\/|]?\s*TG[LI]\.?\s*LAHIR|TEMPAT\s*[\/|]\s*|TG[LI]\.?\s*LAHIR)/i;

function parseKTP(text: string, ocrLines: OcrLine[] = []): ParsedDoc {
  const d = emptyDoc();
  const lines = linesOf(text);

  /** Confidence baris asal sebuah nilai (untuk memilih bacaan terbaik antar-skala). */
  const confOf = (value: string): number => {
    if (!ocrLines.length || !value) return 0;
    const toks = (s: string) =>
      collapse(s)
        .toUpperCase()
        .replace(/[^A-Z0-9 ]/g, ' ')
        .split(/\s+/)
        .filter((w) => w.length >= 3);
    const vt = new Set(toks(value));
    if (!vt.size) return 0;
    const need = Math.min(2, vt.size);
    let best = 0;
    for (const l of ocrLines) {
      const hit = toks(l.text).filter((w) => vt.has(w)).length;
      if (hit >= need && l.conf > best) best = l.conf;
    }
    return best;
  };

  d.nik = findId16(text, [/NIK/i], true);

  d.fullName = valueAfterLabel(lines, KTP_NAME_LABEL, {
    scrub: cleanName,
    reject: NAME_REJECT,
    accept: (s) => looksLikeName(s) && !NAME_SCRUB_REJECT.test(s),
    maxNext: 3,
  });

  // Tempat/Tgl Lahir: label sering di baris sendiri, nilai di baris berikutnya.
  const ttl = valueAfterLabel(lines, TTL_LABEL, {
    reject: /^(JENIS|KELAMIN|GOL|ALAMAT|AGAMA|STATUS|NIK|ISLAM|RT|RW)/i,
  });
  d.birthDate = parseDMY(ttl);
  if (ttl) d.birthPlace = cleanName(ttl.split(/\d/)[0].replace(/[,:;]/g, ' '));

  d.gender = detectGender(text);
  d.addressParts = addressPartsOf(lines, confOf);
  d.address = joinAddress(d.addressParts);

  return d;
}

function parseKK(text: string): ParsedDoc {
  const d = emptyDoc();
  const lines = linesOf(text);

  d.noKK = findId16(text, [/NO\.?\s*KK/i, /NOMOR\s*KK/i, /KARTU\s*KELUARGA/i], false);

  const joined = text.replace(/[ \t]/g, '');
  const all16 = Array.from(new Set(joined.match(/\d{16}/g) || []));
  if (!d.noKK && all16.length) d.noKK = all16[0];

  // NIK kepala keluarga = 16 digit pertama yang BUKAN nomor KK.
  d.nik = all16.find((x) => x !== d.noKK) || '';

  d.fullName = valueAfterLabel(lines, /NAMA\s*KEPALA\s*KELUARGA|KEPALA\s*KELUARGA/i, {
    scrub: cleanName,
    reject: NAME_REJECT,
    accept: (s) => looksLikeName(s),
    maxNext: 3,
  });

  d.address = pickAddress(
    lines,
    /ALAMAT/i,
    /^(NO\b|NAMA\b|NIK\b|JENIS|STATUS|AGAMA|KEPALA|KARTU|ANGGOTA|DIKELUARKAN)/i
  );

  // Jenis kelamin: dari baris tabel yang memuat NIK kepala keluarga bila ada.
  const row = d.nik ? lines.find((l) => l.replace(/[ \t]/g, '').includes(d.nik)) : '';
  d.gender = detectGender(row || '') || detectGender(text);

  // TIDAK mengambil tanggal apa pun dari badan KK: tanggal di KK (mis. tanggal
  // dikeluarkan) bukan tanggal lahir jemaah -> lebih baik kosong daripada salah.
  const ttl = valueAfterLabel(lines, TTL_LABEL);
  if (ttl) {
    d.birthDate = parseDMY(ttl);
    d.birthPlace = cleanName(ttl.split(/\d/)[0].replace(/[,:;]/g, ' '));
  }

  return d;
}

/** Baris MRZ: banyak karakter, tanpa spasi, hampir semua A-Z/0-9/< (toleran "PS" hasil OCR). */
const MRZ_LINE = /^[A-Z0-9<]{30,}$/;
/** Baris dokumen MRZ (baris-1 paspor); "P<" sering terbaca "PS"/"PK". */
const MRZ_DOC_LINE = /^P[A-Z<][A-Z]{3}[A-Z<]{5,}$/;

function parsePassport(text: string): ParsedDoc {
  const d = emptyDoc();

  // MRZ baris-2: [0..9) nomor paspor | [9) checksum | [10..13) nationality |
  // [13..19) DOB | [19) checksum | [20) sex | [21..27) expiry
  // PENTING: jangan mengandalkan urutan baris atau `<` yang mulus — OCR sering
  // membaca "P<" menjadi "PS"/"PK", jadi baris-2 dikenali dari POLA TANGGAL.
  const compact = text.split('\n').map((l) => l.replace(/\s/g, '').toUpperCase());
  const mrzLines = compact.filter((l) => MRZ_LINE.test(l));
  const line2 =
    mrzLines.find((l) => /\d{6}\d[MF<]\d{6}/.test(l)) || mrzLines[1] || '';
  const line1 =
    mrzLines.find((l) => l !== line2 && MRZ_DOC_LINE.test(l)) ||
    mrzLines.find((l) => l !== line2) ||
    '';

  const y2 = (s: string) => (parseInt(s.slice(0, 2), 10) > 30 ? '19' : '20');

  if (line1) {
    const namePart = line1.slice(5).split('<<');
    const surname = (namePart[0] || '').replace(/</g, ' ').trim();
    const given = (namePart[1] || '').replace(/</g, ' ').trim();
    d.fullName = cleanName([given, surname].filter(Boolean).join(' '));
  }

  if (line2) {
    const pass = line2.match(/^([A-Z0-9<]{9})/);
    if (pass) d.passportNumber = pass[1].replace(/</g, '').trim();

    // Checksum WAJIB dilewati (\d), kalau tidak DOB tergeser 1 digit.
    const gm = line2.match(/(\d{6})\d([MF<])(\d{6})/);
    if (gm) {
      d.gender = gm[2] === 'F' ? 'P' : 'L';
      const dob = gm[1];
      d.birthDate = `${y2(dob)}${dob.slice(0, 2)}-${dob.slice(2, 4)}-${dob.slice(4, 6)}`;
      const exp = gm[3];
      d.passportExpiry = `${y2(exp)}${exp.slice(0, 2)}-${exp.slice(2, 4)}-${exp.slice(4, 6)}`;
    }
  }

  if (!d.passportNumber) {
    const m = text.match(/(?:PASSPORT\s*NO\.?|NO\.?\s*PASPOR)[^A-Z0-9]*([A-Z]{1,2}\d{6,9})/i);
    if (m) d.passportNumber = m[1].toUpperCase();
  }
  if (!d.fullName) {
    d.fullName = valueAfterLabel(linesOf(text), /(NAMA|NAME)/i, {
      scrub: cleanName,
      accept: looksLikeName,
    });
  }
  if (!d.birthDate) {
    const ttl = valueAfterLabel(linesOf(text), /(TANGGAL\s*LAHIR|DATE\s*OF\s*BIRTH|LAHIR)/i);
    d.birthDate = parseDMY(ttl);
  }
  if (!d.gender) d.gender = detectGender(text);

  return d;
}

// ── deteksi jenis dokumen (bila pemanggil TIDAK mengirim docType) ────────────

function normalizeDocType(raw: unknown): DocType | '' {
  const s = String(raw || '').trim().toUpperCase();
  if (s === 'KTP' || s === 'KK') return s as DocType;
  if (s === 'PASPOR' || s === 'PASSPORT') return 'PASPOR';
  return '';
}

function detectDocType(text: string): DocType | '' {
  const compact = text.split('\n').map((l) => l.replace(/\s/g, '').toUpperCase());
  if (compact.some((l) => /^P<[A-Z0-9<]{8,}$/.test(l))) return 'PASPOR';
  const t = text.toUpperCase();
  if (
    /KARTU\s*KELUARGA/.test(t) ||
    /NO\.?\s*KK\b/.test(t) ||
    /KEPALA\s*KELUARGA/.test(t) ||
    /ANGGOTA\s*KELUARGA/.test(t)
  ) {
    return 'KK';
  }
  if (/\bNIK\b/.test(t) || /KTP|E-KTP/.test(t) || /\bPROVINSI\b/.test(t)) return 'KTP';
  return '';
}

const SCORE_FIELDS: (keyof ParsedDoc)[] = [
  'nik',
  'noKK',
  'fullName',
  'birthPlace',
  'birthDate',
  'gender',
  'address',
  'passportNumber',
  'passportExpiry',
];

const scoreOf = (p: ParsedDoc) =>
  SCORE_FIELDS.reduce((n, k) => n + (String(p[k] || '').trim() ? 1 : 0), 0);

// ── handler ─────────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    const requested = normalizeDocType(formData.get('docType'));

    if (!file) {
      return NextResponse.json({ success: false, message: 'File gambar tidak ditemukan' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    const ocr = async (input: Buffer): Promise<{ text: string; confidence: number; lines: OcrLine[] }> => {
      const run = async () => {
        const worker = await getWorker();
        const ret = await worker.recognize(input, {}, { text: true, blocks: true } as any);
        const data: any = ret.data;
        const lines: OcrLine[] = [];
        for (const bl of data.blocks || []) {
          for (const p of bl.paragraphs || []) {
            for (const l of p.lines || []) {
              const t = (l.text || '').trim();
              if (t) lines.push({ text: t, conf: Number(l.confidence) || 0 });
            }
          }
        }
        return {
          text: data.text || '',
          confidence: Number(data.confidence) || 0,
          lines,
        };
      };
      try {
        return await run();
      } catch (err) {
        workerPromise = null; // worker mungkin mati -> worker baru, coba sekali lagi
        return await run();
      }
    };

    // OCR multi-varian. Dua alasan:
    //  (a) pra-proses menolong foto resolusi kecil, tetapi bisa merusak dokumen lain
    //      (zona MRZ paspor: "P<" jadi "PS"), jadi gambar SUMBER tetap diuji;
    //  (b) pada foto kecil, tesseract TIDAK konsisten antar-baris: skala ~1600 px
    //      kadang membaca "TANAH RENDAH"/"RT/RW 007/008" yang hilang di skala lain,
    //      dan sebaliknya. Jadi beberapa skala diuji lalu hasilnya DIGABUNG per-field.
    const variants: Buffer[] = [buffer];
    for (const [minLong, maxScale] of [[1600, 2.4], [1850, 2.7], [2100, 3.0]] as [number, number][]) {
      const v = await preprocessImage(buffer, minLong, maxScale);
      if (v.length === buffer.length) continue; // tidak berubah
      if (variants.some((x) => x.length === v.length && x.equals(v))) continue; // sama
      variants.push(v);
    }

    type Cand = {
      rawText: string;
      detected: DocType | '';
      doc: ParsedDoc;
      type: DocType;
      score: number;
      confidence: number;
    };
    const candidates: Cand[] = [];
    for (const v of variants) {
      const { text: txt, confidence, lines: vlines } = await ocr(v);
      if (!txt.trim()) continue;
      const detected = detectDocType(txt);
      const order: DocType[] = [];
      for (const t of [requested, detected, 'KTP', 'KK', 'PASPOR'] as (DocType | '')[]) {
        if (t && !order.includes(t)) order.push(t);
      }
      let best = emptyDoc();
      let bestType: DocType = order[0] || 'KTP';
      let bestScore = -1;
      for (const t of order) {
        const parsed =
          t === 'KK' ? parseKK(txt) : t === 'PASPOR' ? parsePassport(txt) : parseKTP(txt, vlines);
        const s = scoreOf(parsed);
        if (s > bestScore) {
          best = parsed;
          bestScore = s;
          bestType = t;
        }
      }
      candidates.push({ rawText: txt, detected, doc: best, type: bestType, score: bestScore, confidence });
    }

    if (!candidates.length) {
      return NextResponse.json({ success: false, message: 'Teks tidak terbaca dari gambar.' }, { status: 422 });
    }

    // Urutan: jumlah field terbanyak, lalu confidence OCR tertinggi.
    // Confidence dipakai karena pada foto resolusi kecil tesseract kadang membaca
    // satu baris benar dan baris lain salah, dan confidence biasanya mengikuti mana
    // yang benar (mis. "Kecamatan : AIR PUTIH" conf 82 vs "AIRPUTIH" conf 50).
    candidates.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
    const base = candidates[0];
    const best: ParsedDoc = { ...base.doc };
    // Gabung per-field: isi field yang MASIH KOSONG dari varian lain (nilai terisi tidak diganti).
    for (const f of SCORE_FIELDS) {
      if (f === 'address') continue; // alamat digabung per-potongan di bawah
      if (String(best[f] || '').trim()) continue;
      for (const c of candidates) {
        if (String(c.doc[f] || '').trim()) {
          (best as any)[f] = c.doc[f];
          break;
        }
      }
    }

    // ALAMAT: tiap potongan (jalan / RT-RW / kelurahan / kecamatan) dipilih dari varian
    // dengan confidence baris TERTINGGI. Ini memakai fakta bahwa tesseract kadang membaca
    // satu baris benar di skala tertentu dan baris lain benar di skala lain — dan confidence
    // baris biasanya menandai mana yang benar (lihat catatan di atas fungsi ini).
    const ORDER: AddrKind[] = ['main', 'rtrw', 'kel', 'kec'];
    const chosen = new Map<AddrKind, AddrPart>();
    // RT/RW: bentuk sah "000/000" (atau "004 RW 002") lebih dipercaya daripada confidence,
    // karena "0001000" hasil salah baca bisa ber-confidence hampir sama.
    const rtrwRank = (v: string) => (/^RT\/RW\s*\d{3}\s*[\/|]\s*\d{3}$/i.test(v) ? 1000 : 0);
    for (const c of candidates) {
      for (const p of c.doc.addressParts || []) {
        const cur = chosen.get(p.kind);
        if (!cur) {
          chosen.set(p.kind, p);
          continue;
        }
        const rank = (x: AddrPart) => (x.kind === 'rtrw' ? rtrwRank(x.value) : 0) + x.conf;
        if (rank(p) > rank(cur)) chosen.set(p.kind, p);
      }
    }
    if (chosen.size) {
      best.addressParts = ORDER.map((k) => chosen.get(k)).filter(Boolean) as AddrPart[];
      best.address = joinAddress(best.addressParts);
    }
    const bestType = base.type;
    const rawText = base.rawText;
    const detected = candidates.find((c) => c.detected === bestType)?.detected || base.detected;

    best.fullName = collapse(best.fullName);
    best.address = collapse(best.address);
    best.birthPlace = collapse(best.birthPlace);
    if (!best.gender) best.gender = 'L';

    return NextResponse.json({
      success: true,
      data: {
        ...best,
        docType: bestType,
        detectedDocType: detected,
        rawText,
      },
    });
  } catch (error: any) {
    console.error('OCR Processing Error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memproses OCR: ' + error.message },
      { status: 500 }
    );
  }
}
