#!/usr/bin/env node
/**
 * Test OCR travel-app — untuk evaluasi manual maupun otomatis.
 *
 * Pakai:
 *   1) Uji semua fixture + bandingkan dengan nilai harapan:
 *        node tests/ocr/run-ocr-test.mjs
 *   2) Uji SATU gambar sendiri (mis. foto KTP Anda), tampilkan semua field + teks mentah:
 *        node tests/ocr/run-ocr-test.mjs --image /path/foto.jpg --doc-type KTP
 *      (--doc-type opsional: KTP | KK | PASPOR; kalau dikosongkan, jenis dideteksi otomatis)
 *
 * Opsi lain:
 *   --base http://localhost:3000   alamat aplikasi
 *   --raw                          selalu tampilkan teks mentah hasil OCR
 *   --json                         keluarkan hasil sebagai JSON (untuk diolah lagi)
 *   --only <kata>                  hanya jalankan kasus yang labelnya memuat <kata>
 *
 * Keluaran: tabel per field (harap / dapat / status) + ringkasan. Exit code 1 bila ada
 * ketidakcocokan, supaya bisa dipakai di script/CI.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const FIXTURES = path.join(HERE, 'fixtures');
const EXPECTED = path.join(HERE, 'expected.json');

function parseArgs(argv) {
  const a = { base: process.env.OCR_BASE || 'http://localhost:3000', raw: false, json: false, image: null, docType: '', only: null };
  for (let i = 0; i < argv.length; i++) {
    const k = argv[i];
    if (k === '--base') a.base = argv[++i];
    else if (k === '--image') a.image = argv[++i];
    else if (k === '--doc-type') a.docType = String(argv[++i] || '').toUpperCase();
    else if (k === '--only') a.only = argv[++i];
    else if (k === '--raw') a.raw = true;
    else if (k === '--json') a.json = true;
    else if (k === '-h' || k === '--help') { printHelp(); process.exit(0); }
    else { console.error(`Argumen tidak dikenal: ${k}`); printHelp(); process.exit(2); }
  }
  return a;
}

function printHelp() {
  console.log(`Test OCR travel-app

  node tests/ocr/run-ocr-test.mjs                       uji semua fixture + bandingkan harapan
  node tests/ocr/run-ocr-test.mjs --only KK             hanya kasus yang memuat "KK"
  node tests/ocr/run-ocr-test.mjs --image foto.jpg --doc-type KTP
                                                        uji satu gambar sendiri (tanpa pembanding)

  --base <url>   default http://localhost:3000
  --raw          tampilkan teks mentah OCR
  --json         keluaran JSON`);
}

async function ocr(base, filePath, docType) {
  const buf = fs.readFileSync(filePath);
  const fd = new FormData();
  fd.append('image', new Blob([buf], { type: 'image/png' }), path.basename(filePath));
  if (docType) fd.append('docType', docType);
  const t0 = Date.now();
  const res = await fetch(`${base}/api/ocr`, { method: 'POST', body: fd });
  const ms = Date.now() - t0;
  let body;
  try { body = await res.json(); } catch { body = { success: false, message: 'respons bukan JSON' }; }
  return { status: res.status, ms, body };
}

const FIELDS = [
  'nik', 'noKK', 'fullName', 'birthPlace', 'birthDate', 'gender',
  'address', 'passportNumber', 'passportExpiry', 'docType', 'detectedDocType',
];

/** Bandingkan satu field dengan harapan. `*_contains` = pencocokan sebagian. */
function compare(expect, data) {
  const rows = [];
  for (const [key, want] of Object.entries(expect)) {
    if (key.endsWith('_contains')) {
      const field = key.replace('_contains', '');
      const got = String(data[field] ?? '');
      // Nilai boleh berupa daftar: semua potongan harus muncul (mis. dua kata alamat).
      const wants = Array.isArray(want) ? want : [want];
      for (const w of wants) {
        rows.push({ field, want: `memuat "${w}"`, got, ok: got.toUpperCase().includes(String(w).toUpperCase()) });
      }
    } else {
      const got = String(data[key] ?? '');
      rows.push({ field: key, want: String(want), got, ok: got === String(want) });
    }
  }
  return rows;
}

function printFields(data, indent = '    ') {
  for (const f of FIELDS) {
    if (f === 'docType' || f === 'detectedDocType') continue;
    const v = data[f];
    if (v === undefined) continue;
    console.log(`${indent}${f.padEnd(15)}: ${JSON.stringify(v)}`);
  }
  console.log(`${indent}${'docType'.padEnd(15)}: dipakai=${JSON.stringify(data.docType)} terdeteksi=${JSON.stringify(data.detectedDocType)}`);
}

(async () => {
  const args = parseArgs(process.argv.slice(2));
  const results = [];

  // ── Mode 1: satu gambar sendiri ──────────────────────────────────────────
  if (args.image) {
    const p = path.resolve(args.image);
    if (!fs.existsSync(p)) { console.error(`File tidak ada: ${p}`); process.exit(2); }
    const { status, ms, body } = await ocr(args.base, p, args.docType);
    console.log(`\n=== ${path.basename(p)}  docType dikirim: ${args.docType || '(tidak dikirim)'}`);
    console.log(`HTTP ${status}  ${ms} ms  success=${body.success}`);
    if (!body.success) { console.log(`GAGAL: ${body.message}`); process.exit(1); }
    console.log('\n--- field hasil OCR ---');
    printFields(body.data);
    if (args.raw) {
      console.log('\n--- teks mentah OCR ---');
      console.log((body.data.rawText || '').split('\n').map((l) => `    ${l}`).join('\n'));
    } else {
      console.log('\n(tambahkan --raw untuk melihat teks mentah hasil OCR)');
    }
    console.log('\nSilakan periksa sendiri: apakah tiap field sudah sesuai dokumen?');
    process.exit(0);
  }

  // ── Mode 2: semua fixture + pembanding ───────────────────────────────────
  const spec = JSON.parse(fs.readFileSync(EXPECTED, 'utf8'));
  const cases = spec.cases.filter((c) => !args.only || c.label.toLowerCase().includes(args.only.toLowerCase()));
  if (!cases.length) { console.error('Tidak ada kasus yang cocok dengan --only'); process.exit(2); }

  console.log(`\nTest OCR travel-app — ${cases.length} kasus | target ${args.base}\n${'='.repeat(78)}`);

  let totalChecks = 0;
  let failedChecks = 0;

  for (const c of cases) {
    const file = path.join(FIXTURES, c.file);
    if (!fs.existsSync(file)) {
      console.log(`\n--- ${c.label}\n    LEWAT: fixture tidak ada (${file})`);
      results.push({ label: c.label, skipped: true });
      failedChecks++;
      totalChecks++;
      continue;
    }
    const { status, ms, body } = await ocr(args.base, file, c.docType || '');
    console.log(`\n--- ${c.label}`);
    console.log(`    ${c.file}  docType=${c.docType || '(tidak dikirim)'}  HTTP ${status}  ${ms} ms`);

    if (!body.success) {
      console.log(`    GAGAL: ${body.message}`);
      results.push({ label: c.label, ok: false, error: body.message });
      failedChecks++;
      totalChecks++;
      continue;
    }

    printFields(body.data);
    const rows = compare(c.expect, body.data);
    console.log('');
    for (const r of rows) {
      totalChecks++;
      if (!r.ok) failedChecks++;
      const status_s = r.ok ? 'OK   ' : 'SALAH';
      console.log(`      ${status_s} ${r.field.padEnd(15)} harap=${JSON.stringify(r.want)} dapat=${JSON.stringify(r.got)}`);
    }
    const bad = rows.filter((r) => !r.ok).length;
    console.log(`      -> ${rows.length - bad}/${rows.length} field sesuai`);
    if (bad && args.raw) {
      console.log('\n    --- teks mentah OCR ---');
      console.log((body.data.rawText || '').split('\n').map((l) => `      ${l}`).join('\n'));
    }
    results.push({ label: c.label, ok: bad === 0, fields: rows.length, wrong: bad });
  }

  console.log(`\n${'='.repeat(78)}`);
  console.log(`RINGKASAN: ${totalChecks - failedChecks}/${totalChecks} pemeriksaan sesuai` +
    (failedChecks ? `  |  ${failedChecks} TIDAK sesuai` : '  |  semua benar'));
  if (args.json) console.log(JSON.stringify({ totalChecks, failedChecks, results }, null, 2));
  process.exit(failedChecks ? 1 : 0);
})().catch((e) => { console.error('ERROR:', e.message); process.exit(2); });
