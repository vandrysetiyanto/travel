import { exec } from 'child_process';
import util from 'util';
import path from 'path';
import fs from 'fs';

const execPromise = util.promisify(exec);
import { NextResponse } from 'next/server';
import { createWorker } from 'tesseract.js';
import sharp from 'sharp';
import { batasiLaju, ipPemanggil } from '@/lib/laju';

type DocType = 'KTP' | 'KK' | 'PASPOR';
type AddrKind = 'main' | 'rtrw' | 'kel' | 'kec';
type AddrPart = { kind: AddrKind; value: string; conf: number };

const GLUED_PAIRS: [string, string][] = [
  ['TANAH', 'RENDAH'], ['TANAH', 'ABANG'], ['TANAH', 'TINGGI'], ['TANAH', 'MERAH'], ['TANAH', 'PUTIH'],
  ['AIR', 'PUTIH'], ['AIR', 'HITAM'], ['AIR', 'JERNIH'], ['AIR', 'MATA'], ['AIR', 'BESAR'], ['AIR', 'KECIL'],
  ['KALI', 'BESAR'], ['KALI', 'KECIL'], ['KALI', 'ABANG'], ['KALI', 'MALANG'],
  ['PASAR', 'MINGGU'], ['PASAR', 'BARU'], ['PASAR', 'KEMIS'], ['PASAR', 'REBO'], ['PASAR', 'JUMAT'],
  ['KEBON', 'JERUK'], ['KEBON', 'KELAPA'], ['KEBON', 'SIRIH'], ['KEBUN', 'JERUK'],
  ['JALAN', 'RAYA'], ['PERUM', 'NASIONAL'], ['TAMBAK', 'REJO'], ['TAMBAK', 'OSOWILANGUN'],
  ['BUKIT', 'DURI'], ['SUNGAI', 'BAMBU'], ['SUNGAI', 'BESAR'], ['GROGOL', 'SELATAN'],
];

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

type OcrLine = { text: string; conf: number };

type ParsedDoc = {
  nik: string;
  noKK: string;
  fullName: string;
  birthPlace: string;
  birthDate: string;
  gender: string;
  address: string;
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
      workerPromise = null;
      throw err;
    });
  }
  return workerPromise;
}

const MIN_LONG_EDGE = 2100;
const MAX_LONG_EDGE = 2600;

async function preprocessImage(buf: Buffer, minLongEdge = MIN_LONG_EDGE, maxScale = 3.0): Promise<Buffer> {
  try {
    const img = sharp(buf, { failOn: 'none' }).rotate();
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

const onlyDigits = (s: string) => (s || '').replace(/\D/g, '');
const collapse = (s: string) => (s || '').replace(/\s+/g, ' ').trim();
const DECOR = /[\u2010-\u2015\u00b7\u2022\u2027\u2500-\u257f\u25a0-\u25ff]/g;
const deDecor = (s: string) => collapse((s || '').replace(DECOR, ' '));

const linesOf = (text: string) =>
  text
    .split('\n')
    .map((l) => deDecor(l))
    .filter(Boolean);

const ADDR_WORD = /^(KEL|KEC|KELURAHAN|KECAMATAN|RT|RW|JL|JALAN|BLOK|NO|DESA|DUSUN|KAMPUNG|GANG|PERUM|GG)$/i;

function stripTrailingJunk(s: string): string {
  const t = deDecor(s).split(' ').filter(Boolean);
  while (t.length && (t[t.length - 1].length < 3 || !/[A-Za-z0-9]/.test(t[t.length - 1]))) t.pop();
  let out = t.join(' ');
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

const LABEL_WORDS =
  /\b(NIK|Nama|Alamat|Jenis|Kelamin|Tempat|Tgl|Tgi|Lahir|Gol|Darah|Agama|Status|Perkawinan|Kewarganegaraan|Pekerjaan|Berlaku|Hingga|KARTU|KELUARGA|Kepala|Anggota|LAKI|PEREMPUAN|PRIA|WANITA|ISLAM|KRISTEN|HINDU|BUDHA|KAWIN|BELUM|SEUMUR|HIDUP|No|FOTO|Tanda|Tangan|RT|RW)\b/gi;

function cleanName(raw: string): string {
  return collapse(
    collapse(deDecor(raw).replace(LABEL_WORDS, ' ')).replace(/[^A-Za-z .,'-]/g, ' ')
  );
}

function looksLikeName(s: string): boolean {
  const t = collapse(s);
  if (!t || t.length < 4) return false;
  const words = t.split(' ').filter((w) => /^[A-Za-z][A-Za-z.'’-]*$/.test(w));
  if (!words.length) return false;
  if (words.length >= 2) return true;
  return words[0].length >= 5;
}

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

const ADDR_SUBLABEL = /^(KEL\s*[\/|]?\s*DESA|KELL?DESA|KELURAHAN|KEL\.|KECAMATAN|KEC\.)\s*:?\s*/i;
const FIELD_BREAK =
  /^(AGAMA|STATUS|PEKERJAAN|KEWARGANEGARAAN|BERLAKU|NIK|NAMA|TEMPAT|TG[LI]|JENIS|GOL|FOTO|TANDA|KARTU|ANGGOTA|NO\b|KEPALA)/i;

function cutAtNextLabel(s: string): string {
  // CATATAN: jangan pakai \b di akhir alternasi "KEC\." / "KEL\." — \b tidak pernah cocok
  // setelah titik, sehingga label ber-titik tidak terpotong dan nilainya terduplikasi.
  const m = collapse(s).match(
    /^(.*?)\s+(RT\s*[\/|]?\s*RW|RTRW|KEL\s*[\/|]?\s*DESA|KEL\.|KECAMATAN|KEC\.|AGAMA|STATUS|PEKERJAAN|KEWARGANEGARAAN|BERLAKU|NIK|NAMA|TEMPAT|TG[LI]|JENIS|GOL)(?![A-Za-z])/i
  );
  return m ? collapse(m[1]) : collapse(s);
}

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
      if (stopRe.test(cand) || FIELD_BREAK.test(cand) || RTRW_AT_START.test(cand)) break;
      if (/^[A-Za-z][A-Za-z\/\.\s]{0,22}:/.test(cand)) break;
      const val = collapse(cand.replace(ADDR_SUBLABEL, ''));
      if (!val) continue;
      if (!parts.join(' ').toUpperCase().includes(val.toUpperCase())) parts.push(val);
    }
    if (parts.length) return collapse(parts.join(' '));
  }
  return '';
}

const RTRW_LABEL = /R\s*T\s*[\/|]?\s*R\s*W|RTIRW|BERW|BTRW|RTRW/i;
const RTRW_AT_START = /^\s*(?:R\s*T\s*[\/|]?\s*R\s*W|RTIRW|BERW|BTRW|RTRW)\b/i;

function extractRTRW(s: string): string {
  const digits = s.replace(/\D/g, '');
  if (digits.length === 6) return `RT/RW ${digits.slice(0, 3)}/${digits.slice(3, 6)}`;

  let m = s.match(/(?:RT\s*[\/|]?\s*RW|BERW|BTRW|RTRW)\s*:?\s*(\d{1,3})\s*[\/|;,\- ]\s*(\d{1,3})/i);
  if (!m) m = s.match(/\b(\d{1,3})\s*[\/|]\s*(\d{1,3})\b/);
  if (m) {
    const r = m[1].padStart(3, '0');
    const w = m[2].padStart(3, '0');
    return `RT/RW ${r}/${w}`;
  }
  return '';
}

function findId16(
  text: string,
  preferredLabelRes: RegExp[] = [],
  rejectKK = false
): string {
  const lines = linesOf(text);
  for (const lRes of preferredLabelRes) {
    for (let i = 0; i < lines.length; i++) {
      if (!lRes.test(lines[i])) continue;
      for (let j = i; j <= Math.min(i + 2, lines.length - 1); j++) {
        const dig = onlyDigits(lines[j]);
        if (dig.length >= 15 && dig.length <= 17) return dig.slice(0, 16);
      }
    }
  }

  const all16 = (text.match(/\b\d{16}\b/g) || []);
  if (all16.length === 1) return all16[0];

  const candLines = lines.filter((l) => {
    if (rejectKK && /KARTU\s*KELUARGA|NO\.?\s*KK/i.test(l)) return false;
    return /\d/.test(l);
  });
  for (const l of candLines) {
    const dig = onlyDigits(l);
    if (dig.length >= 15 && dig.length <= 17) return dig.slice(0, 16);
  }
  return all16[0] || '';
}

function parseKTP(text: string, vlines?: OcrLine[]): ParsedDoc {
  const lines = linesOf(text);
  const doc: ParsedDoc = {
    nik: '',
    noKK: '',
    fullName: '',
    birthPlace: '',
    birthDate: '',
    gender: 'L',
    address: '',
    addressParts: [],
    passportNumber: '',
    passportExpiry: '',
  };

  const getConf = (re: RegExp) => {
    if (!vlines) return 60;
    const hit = vlines.find((l) => re.test(deDecor(l.text)));
    return hit ? Math.round(hit.conf) : 60;
  };

  doc.nik = findId16(text, [/NIK/i, /NOMOR/i], true);

  doc.fullName = valueAfterLabel(lines, /^NAMA\b/i, {
    maxNext: 3,
    reject: /PROVINSI|KABUPATEN|KOTA|NIK|GOL|DARAH|AGAMA|STATUS/i,
    scrub: cleanName,
    accept: looksLikeName,
  });

  const ttlRaw = valueAfterLabel(lines, /TEMPAT\s*[\/|]?\s*TG[LI]\s*LAHIR/i, {
    maxNext: 2,
    reject: /NIK|NAMA|JENIS|GOL|AGAMA|STATUS|PEKERJAAN|KEWARGANEGARAAN/i,
  });

  if (ttlRaw) {
    const parts = ttlRaw.split(/,|\b(?=\d)/);
    if (parts.length >= 2) {
      let bp = parts[0].replace(/STATUS|PERKAWINAN|AGAMA|GOL|DARAH|JENIS|KELAMIN/gi, '').replace(/[^A-Za-z\s]/g, '');
      doc.birthPlace = collapse(bp).toUpperCase();
      const dStr = parts.slice(1).join(' ');
      const m = dStr.match(/(\d{1,2})[\s\-.\/]+([0-1]?\d|JAN|FEB|MAR|APR|MEI|JUN|JUL|AGU|SEP|OKT|NOV|DES)[\s\-.\/]+(\d{4})/i);
      if (m) {
        let [_, d, mon, y] = m;
        d = d.padStart(2, '0');
        const months: Record<string, string> = {
          JAN: '01', FEB: '02', MAR: '03', APR: '04', MEI: '05', JUN: '06',
          JUL: '07', AGU: '08', SEP: '09', OKT: '10', NOV: '11', DES: '12'
        };
        mon = months[mon.toUpperCase()] || mon.padStart(2, '0');
        doc.birthDate = `${y}-${mon}-${d}`;
      }
    } else {
      const m = ttlRaw.match(/(\d{1,2})[\s\-.\/]+([0-1]?\d|JAN|FEB|MAR|APR|MEI|JUN|JUL|AGU|SEP|OKT|NOV|DES)[\s\-.\/]+(\d{4})/i);
      if (m) {
        let [_, d, mon, y] = m;
        d = d.padStart(2, '0');
        const months: Record<string, string> = {
          JAN: '01', FEB: '02', MAR: '03', APR: '04', MEI: '05', JUN: '06',
          JUL: '07', AGU: '08', SEP: '09', OKT: '10', NOV: '11', DES: '12'
        };
        mon = months[mon.toUpperCase()] || mon.padStart(2, '0');
        doc.birthDate = `${y}-${mon}-${d}`;
        doc.birthPlace = collapse(ttlRaw.slice(0, m.index).replace(/[^A-Za-z\s]/g, ''));
      } else {
        doc.birthPlace = collapse(ttlRaw.replace(/[^A-Za-z\s]/g, ''));
      }
    }
  }

  if (/PEREMPUAN|WANITA|FEMALE/i.test(text)) {
    doc.gender = 'P';
  } else if (/LAKI/i.test(text)) {
    doc.gender = 'L';
  }

  let mainAddr = stripTrailingJunk(pickAddress(lines, /^ALAMAT\b/i, RTRW_LABEL, 3));
  if (!mainAddr) {
    // Fallback: KTP tanpa label "ALAMAT" (foto terpotong / label tak terbaca).
    // Ambil bagian sebelum RT/RW pada baris mana pun, mis. "TAMBAKREJO RT/RW 000/000".
    for (const l of lines) {
      if (!RTRW_LABEL.test(l)) continue;
      const before = stripTrailingJunk(collapse(l.split(RTRW_LABEL)[0].replace(ADDR_SUBLABEL, '')));
      if (before.length < 3) continue;
      if (/^(ALAMAT|NIK|NAMA|KEL|KEC|RT|RW|TEMPAT|TGL|JENIS|GOL|AGAMA|STATUS|PEKERJAAN|KEWARGANEGARAAN)\b/i.test(before)) continue;
      if (!/[A-Za-z]{3,}/.test(before)) continue;
      mainAddr = before;
      break;
    }
  }
  // Fallback jalan: sebagian foto (rapat/miring) menaruh baris jalan SEBELUM label "Alamat",
  // sehingga pickAddress melewatkannya. Kalau alamat utama belum punya penanda jalan, cari di mana pun.
  const STREET_RE = /^(JL\.?|JALAN|GG\.?|GANG|BLOK|PERUM|DUSUN|KAMPUNG|KP\.?|DESA|PERUMAHAN)\b/i;
  if (!mainAddr || !STREET_RE.test(collapse(mainAddr))) {
    for (const l of lines) {
      const c = collapse(l).replace(ADDR_SUBLABEL, '');
      if (!STREET_RE.test(c)) continue;
      const before = stripTrailingJunk(collapse(c.split(RTRW_LABEL)[0]));
      if (before.length < 3 || before.length > 90) continue;
      if (!/[A-Za-z]{3,}/.test(before)) continue;
      mainAddr = before;
      break;
    }
  }

  let rtrwStr = '';
  for (const l of lines) {
    if (RTRW_LABEL.test(l)) {
      rtrwStr = extractRTRW(l);
      if (rtrwStr) break;
    }
  }

  const kelStr = valueAfterLabel(lines, /KEL\s*[\/|]?\s*DESA|KELURAHAN|KEL\./i, {
    maxNext: 2,
    scrub: (s) => stripTrailingJunk(cutAtNextLabel(s.replace(ADDR_SUBLABEL, ''))),
  });

  const kecStr = valueAfterLabel(lines, /KECAMATAN|KEC\./i, {
    maxNext: 2,
    scrub: (s) => stripTrailingJunk(cutAtNextLabel(s.replace(ADDR_SUBLABEL, ''))),
  });

  // Buang pengulangan: nilai kel/kec yang sudah terserap ke alamat utama.
  const stripDup = (main: string, value: string): string => {
    const v = collapse(value);
    if (!main || !v) return main;
    const M = main.toUpperCase();
    for (const needle of [`KEL. ${v}`, `KEL ${v}`, `KEC. ${v}`, `KEC ${v}`]) {
      const i = M.indexOf(needle.toUpperCase());
      if (i > 0) return collapse(main.slice(0, i));
    }
    const j = M.indexOf(v.toUpperCase());
    if (j > 0) return collapse(main.slice(0, j));
    return main;
  };
  let mainClean = mainAddr;
  if (kecStr) mainClean = stripDup(mainClean, kecStr);
  if (kelStr) mainClean = stripDup(mainClean, kelStr);
  mainAddr = mainClean;

  const parts: AddrPart[] = [];
  if (mainAddr) parts.push({ kind: 'main', value: repairGluedWords(mainAddr), conf: getConf(/^ALAMAT\b/i) });
  if (rtrwStr) parts.push({ kind: 'rtrw', value: rtrwStr, conf: getConf(RTRW_LABEL) });
  if (kelStr) parts.push({ kind: 'kel', value: repairGluedWords(kelStr), conf: getConf(/KEL\s*[\/|]?\s*DESA|KELURAHAN/i) });
  if (kecStr) parts.push({ kind: 'kec', value: repairGluedWords(kecStr), conf: getConf(/KECAMATAN|KEC\./i) });

  doc.addressParts = parts;
  doc.address = joinAddress(parts);

  return doc;
}

function parseKK(text: string): ParsedDoc {
  const lines = linesOf(text);
  const doc: ParsedDoc = {
    nik: '',
    noKK: '',
    fullName: '',
    birthPlace: '',
    birthDate: '',
    gender: 'L',
    address: '',
    addressParts: [],
    passportNumber: '',
    passportExpiry: '',
  };

  const all16 = text.match(/\b\d{16}\b/g) || [];
  const kkLine = lines.find((l) => /KARTU\s*KELUARGA|NO\.?\s*KK/i.test(l));
  if (kkLine) {
    const dig = onlyDigits(kkLine);
    if (dig.length === 16) doc.noKK = dig;
  }
  if (!doc.noKK && all16.length) doc.noKK = all16[0] || '';
  if (all16.length > 1) doc.nik = all16.find((x) => x !== doc.noKK) || '';

  doc.fullName = valueAfterLabel(lines, /KEPALA\s*KELUARGA|NAMA\s*LENGKAP/i, {
    maxNext: 2,
    scrub: cleanName,
    accept: looksLikeName,
  });

  const mainAddr = stripTrailingJunk(pickAddress(lines, /^ALAMAT\b/i, RTRW_LABEL, 3));
  if (mainAddr) {
    doc.addressParts = [{ kind: 'main', value: repairGluedWords(mainAddr), conf: 80 }];
    doc.address = mainAddr;
  }

  return doc;
}

function parsePassport(text: string): ParsedDoc {
  const doc: ParsedDoc = {
    nik: '',
    noKK: '',
    fullName: '',
    birthPlace: '',
    birthDate: '',
    gender: 'L',
    address: '',
    addressParts: [],
    passportNumber: '',
    passportExpiry: '',
  };

  const mrzLines = linesOf(text).filter((l) => /P<[A-Z0-9<]{30,}/i.test(l) || /^[A-Z0-9<]{40,50}$/.test(l));
  if (mrzLines.length >= 2) {
    const line1 = mrzLines[0].replace(/\s+/g, '');
    const line2 = mrzLines[1].replace(/\s+/g, '');

    const namePart = line1.slice(5).split('<<')[0].replace(/</g, ' ');
    if (namePart) doc.fullName = collapse(namePart);

    doc.passportNumber = line2.slice(0, 9).replace(/</g, '');
    doc.gender = line2.slice(20, 21) === 'F' ? 'P' : 'L';

    const dob = line2.slice(13, 19);
    if (/^\d{6}$/.test(dob)) {
      const yr = parseInt(dob.slice(0, 2), 10);
      const fullYr = yr > 40 ? 1900 + yr : 2000 + yr;
      doc.birthDate = `${fullYr}-${dob.slice(2, 4)}-${dob.slice(4, 6)}`;
    }

    const exp = line2.slice(21, 27);
    if (/^\d{6}$/.test(exp)) {
      doc.passportExpiry = `20${exp.slice(0, 2)}-${exp.slice(2, 4)}-${exp.slice(4, 6)}`;
    }
  }
  return doc;
}

function joinAddress(parts: AddrPart[]): string {
  return parts.map((p) => p.value).join(' ').trim();
}

function scoreOf(doc: ParsedDoc): number {
  let s = 0;
  if (doc.nik) s += 3;
  if (doc.noKK) s += 3;
  if (doc.fullName) s += 3;
  if (doc.birthPlace) s += 2;
  if (doc.birthDate) s += 2;
  if (doc.address) s += 3;
  if (doc.passportNumber) s += 4;
  return s;
}

function emptyDoc(): ParsedDoc {
  return {
    nik: '',
    noKK: '',
    fullName: '',
    birthPlace: '',
    birthDate: '',
    gender: 'L',
    address: '',
    addressParts: [],
    passportNumber: '',
    passportExpiry: '',
  };
}

function detectDocType(text: string): DocType {
  if (/P<[A-Z0-9<]{30,}/i.test(text) || /PASSPORT|PASPOR/i.test(text)) return 'PASPOR';
  if (/KARTU\s*KELUARGA/i.test(text)) return 'KK';
  return 'KTP';
}

const SCORE_FIELDS: (keyof ParsedDoc)[] = [
  'nik',
  'noKK',
  'fullName',
  'birthPlace',
  'birthDate',
  'gender',
  'passportNumber',
  'passportExpiry',
];

export async function POST(req: Request) {
  try {
    /*
     * S5: batas laju untuk endpoint publik yang memanggil layanan LLM berbayar.
     *
     * Tanpa ini siapa pun bisa memanggil OCR berulang-ulang hanya dengan curl —
     * memicu biaya provider dan menghabiskan CPU server (sharp + tesseract).
     * Batas: 10 permintaan / menit per IP. Klien yang sah (1 pendaftaran)
     * jauh di bawah angka ini.
     */
    const cekLaju = batasiLaju(`ocr:${ipPemanggil(req)}`, 10, 60_000);
    if (!cekLaju.boleh) {
      return NextResponse.json(
        {
          success: false,
          message: `Terlalu banyak permintaan OCR. Coba lagi dalam ${cekLaju.sisaDetik} detik.`,
          retry_after: cekLaju.sisaDetik,
        },
        { status: 429, headers: { 'Retry-After': String(cekLaju.sisaDetik) } },
      );
    }

    const formData = await req.formData();
    const file = formData.get('image') as File | null;
    const requested = (formData.get('docType') as string)?.toUpperCase() || '';

    if (!file) {
      return NextResponse.json({ success: false, message: 'File gambar wajib diunggah.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // ── STEP 1: 9router (model `free`) via /root/projects/ocr-service/ocr9router.py ──
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });
    
    const tempFilePath = path.join(tempDir, `ocr_${Date.now()}_${Math.random().toString(36).substring(7)}.png`);
    fs.writeFileSync(tempFilePath, buffer);

    let pythonResult: any = null;
    try {
      const pythonScript = '/root/projects/ocr-service/ocr9router.py';
      const { stdout } = await execPromise(`python3 ${pythonScript} "${tempFilePath}" --json --engine 9router --models gemini/gemini-3.5-flash-lite,gemini/gemini-3.1-flash-lite-preview,free --timeout 20 --retries 1`, { timeout: 60000 });
      if (stdout) {
        pythonResult = JSON.parse(stdout);
      }
    } catch (pyErr) {
      console.warn('9router OCR error or timeout:', pyErr);
    } finally {
      if (fs.existsSync(tempFilePath)) fs.unlinkSync(tempFilePath);
    }

    if (pythonResult && pythonResult.success && pythonResult.text) {
      const rawText = pythonResult.text;
      const detected = detectDocType(rawText);

      // Jenis dokumen yang teksnya benar-benar mengandung penanda-nya. Kalau pemakai memilih
      // PASPOR tetapi teksnya jelas KK, PASPOR dibuang dari pencalonan (dulu hasilnya kosong).
      const evidenceOf = (t: DocType): boolean => {
        if (t === 'KK') return /KARTU\s*KELUARGA|NO\.?\s*KK|KEPALA\s*KELUARGA/i.test(rawText);
        if (t === 'PASPOR') return /P<[A-Z0-9<]{30,}/i.test(rawText) || /PASSPORT|PASPOR/i.test(rawText);
        return true; // KTP sebagai jenis dasar
      };

      // Urutan pencalonan: jenis terdeteksi -> jenis yang diminta -> sisanya.
      const order: DocType[] = [];
      for (const t of [detected, requested, 'KTP', 'KK', 'PASPOR'] as (DocType | '')[]) {
        if (t && !order.includes(t)) order.push(t);
      }
      const candid = order.filter(evidenceOf);
      const types = candid.length ? candid : order;

      let best = emptyDoc();
      let bestType: DocType = types[0];
      let bestScore = -1;
      for (const t of types) {
        const parsed = t === 'KK' ? parseKK(rawText) : t === 'PASPOR' ? parsePassport(rawText) : parseKTP(rawText);
        const sc = scoreOf(parsed);
        if (sc > bestScore) {
          best = parsed;
          bestScore = sc;
          bestType = t;
        }
      }

      // Isi field yang masih kosong dari parser lain (mis. noKK untuk jenis KK).
      const altDocs: Record<string, ParsedDoc> = {};
      for (const t of types) {
        altDocs[t] = t === bestType ? best : (t === 'KK' ? parseKK(rawText) : t === 'PASPOR' ? parsePassport(rawText) : parseKTP(rawText));
      }
      for (const f of SCORE_FIELDS) {
        if (f === 'address' || f === 'gender') continue;
        if (String((best as any)[f] || '').trim()) continue;
        for (const t of types) {
          const v = (altDocs[t] as any)[f];
          if (String(v || '').trim()) {
            (best as any)[f] = v;
            break;
          }
        }
      }
      if (!best.address) {
        for (const t of types) {
          if (String(altDocs[t].address || '').trim()) {
            best.address = altDocs[t].address;
            best.addressParts = altDocs[t].addressParts;
            break;
          }
        }
      }

      const docTypeToUse = bestType;
      const parsed = best;

      parsed.fullName = collapse(parsed.fullName);
      parsed.address = collapse(parsed.address);
      parsed.birthPlace = collapse(parsed.birthPlace);
      if (!parsed.gender) parsed.gender = 'L';

      const normalizedData = {
        ...parsed,
        no_kk: parsed.noKK,
        full_name: parsed.fullName,
        birth_place: parsed.birthPlace,
        birth_date: parsed.birthDate,
        passport_number: parsed.passportNumber,
        passport_expiry_date: parsed.passportExpiry,
        passport_expiry: parsed.passportExpiry,
        docType: docTypeToUse,
        detectedDocType: detected,
        parserScore: bestScore,
        rawText,
        engineUsed: pythonResult.engine || '9router',
        modelUsed: pythonResult.model || '',
      };

      return NextResponse.json({
        success: true,
        data: normalizedData,
      });
    }

    // ── STEP 2: Fallback ke Tesseract JS Engine (Lokal Node) ──
    const vNormal = await preprocessImage(buffer, MIN_LONG_EDGE, 3.0);
    const vLarge = await preprocessImage(buffer, 2500, 4.0);
    const variants = [vNormal, vLarge, buffer];

    const worker = await getWorker();
    const ocr = async (buf: Buffer) => {
      const res = await worker.recognize(buf);
      const lines: OcrLine[] = (((res.data as any).lines || [])).map((l: any) => ({
        text: l.text,
        conf: l.confidence,
      }));
      return { text: res.data.text, confidence: res.data.confidence, lines };
    };

    type Cand = {
      rawText: string;
      detected: DocType;
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
        const parsed = t === 'KK' ? parseKK(txt) : t === 'PASPOR' ? parsePassport(txt) : parseKTP(txt, vlines);
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

    candidates.sort((a, b) => b.score - a.score || b.confidence - a.confidence);
    const base = candidates[0];
    const best: ParsedDoc = { ...base.doc };

    for (const f of SCORE_FIELDS) {
      if (f === 'address') continue;
      if (String(best[f] || '').trim()) continue;
      for (const c of candidates) {
        if (String(c.doc[f] || '').trim()) {
          (best as any)[f] = c.doc[f];
          break;
        }
      }
    }

    const ORDER: AddrKind[] = ['main', 'rtrw', 'kel', 'kec'];
    const chosen = new Map<AddrKind, AddrPart>();
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

    const normalizedData = {
      ...best,
      no_kk: best.noKK,
      full_name: best.fullName,
      birth_place: best.birthPlace,
      birth_date: best.birthDate,
      passport_number: best.passportNumber,
      passport_expiry_date: best.passportExpiry,
      passport_expiry: best.passportExpiry,
      docType: bestType,
      detectedDocType: detected,
      rawText,
    };

    return NextResponse.json({
      success: true,
      data: normalizedData,
    });
  } catch (error: any) {
    console.error('OCR Processing Error:', error);
    return NextResponse.json(
      { success: false, message: 'Gagal memproses OCR: ' + error.message },
      { status: 500 }
    );
  }
}
