#!/usr/bin/env node
/**
 * Uji R2: manifest bandara.
 * Membuktikan: field paspor BENAR-BENAR tersimpan lewat API (bug lama: hilang),
 * dan manifest menandai paspor < 6 bulan / kedaluwarsa.
 */
import Database from 'better-sqlite3';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

const db = new Database(DB);
db.pragma('foreign_keys = ON');

const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
const api = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

console.log('\n[1] Skema migrasi 4');
cek('user_version >= 4', db.pragma('user_version', { simple: true }) >= 4, String(db.pragma('user_version', { simple: true })));
for (const f of ['nationality', 'passport_country', 'passport_issue_date', 'passport_expiry_date', 'emergency_contact', 'medical_notes']) {
  cek(`${f} ada`, db.prepare('PRAGMA table_info(master_jamaah)').all().some((c) => c.name === f));
}

// ── siapkan jamaah + batch + transaksi ──
const batch = db.prepare('SELECT id FROM batches ORDER BY id LIMIT 1').get();
const nikA = 'MFT' + String(Date.now()).slice(-13) + '1';
const nikB = 'MFT' + String(Date.now()).slice(-13) + '2';

console.log('\n[2] Simpan field paspor lewat API (bug lama: data hilang)');
let r = await api('/api/admin/jamaah', {
  action: 'CREATE_JAMAAH',
  nik: nikA, full_name: 'Manifest Paspor Aman', gender: 'LAKI-LAKI', phone: '0812000001',
  birth_place: 'Bojonegoro', birth_date: '1990-02-20',
  passport_number: 'X1234567', passport_expiry_date: '2030-06-15', passport_issue_date: '2025-06-16',
  nationality: 'ID', passport_country: 'ID',
  emergency_contact: 'Istri (0812-9999-0001)', medical_notes: 'Hipertensi ringan',
});
cek('jamaah dibuat', r.status === 200 || r.status === 201, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 90)}`);

const jA = db.prepare('SELECT * FROM master_jamaah WHERE nik=?').get(nikA);
cek('passport_number tersimpan', jA?.passport_number === 'X1234567', String(jA?.passport_number));
cek('passport_expiry_date tersimpan', jA?.passport_expiry_date === '2030-06-15', String(jA?.passport_expiry_date));
cek('passport_expiry (kolom manifest) ikut terisi', jA?.passport_expiry === '2030-06-15', String(jA?.passport_expiry));
cek('passport_issue_date tersimpan', jA?.passport_issue_date === '2025-06-16', String(jA?.passport_issue_date));
cek('nationality tersimpan', jA?.nationality === 'ID', String(jA?.nationality));
cek('passport_country tersimpan', jA?.passport_country === 'ID', String(jA?.passport_country));
cek('emergency_contact tersimpan', String(jA?.emergency_contact || '').includes('Istri'), String(jA?.emergency_contact));
cek('medical_notes tersimpan', String(jA?.medical_notes || '').includes('Hipertensi'), String(jA?.medical_notes));
cek('gender dinormalkan LAKI-LAKI -> L', jA?.gender === 'L', String(jA?.gender));

// jamaah kedua: paspor akan kedaluwarsa < 6 bulan dari keberangkatan
r = await api('/api/admin/jamaah', {
  action: 'CREATE_JAMAAH',
  nik: nikB, full_name: 'Manifest Paspor Risiko', gender: 'P', phone: '0812000002',
  birth_place: 'Surabaya', birth_date: '1985-11-03',
  passport_number: 'Y7654321', passport_expiry_date: '2026-12-01',
  nationality: 'ID', passport_country: 'ID', emergency_contact: 'Suami (0812-9999-0002)',
});
const jB = db.prepare('SELECT * FROM master_jamaah WHERE nik=?').get(nikB);
cek('jamaah kedua dibuat', !!jB);

// transaksi ke batch (batch punya departure_date 2026-10-15)
const txA = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                        VALUES (?,?,?,?,0,?,'PENDING')`).run('MFT-A-' + Date.now().toString().slice(-5), jA.id, batch.id, 25000000, 25000000);
const txB = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                        VALUES (?,?,?,?,0,?,'PENDING')`).run('MFT-B-' + Date.now().toString().slice(-5), jB.id, batch.id, 25000000, 25000000);
db.prepare("INSERT INTO booking_jamaah (transaction_id, jamaah_id, peran, urutan) VALUES (?,?, 'LEADER', 1)").run(Number(txA.lastInsertRowid), jA.id);
db.prepare("INSERT INTO booking_jamaah (transaction_id, jamaah_id, peran, urutan) VALUES (?,?, 'LEADER', 1)").run(Number(txB.lastInsertRowid), jB.id);

console.log('\n[3] Manifest memuat kolom bandara');
r = await api('/api/admin/manifest');
cek('manifest 200', r.status === 200 && r.data.success, `HTTP ${r.status}`);
const barisA = (r.data.manifest || []).find((m) => m.full_name === 'Manifest Paspor Aman');
const barisB = (r.data.manifest || []).find((m) => m.full_name === 'Manifest Paspor Risiko');
cek('baris jamaah A ada', !!barisA);
cek('baris jamaah B ada', !!barisB);
cek('nationality terkirim', barisA?.nationality === 'ID', String(barisA?.nationality));
cek('passport_country terkirim', barisA?.passport_country === 'ID', String(barisA?.passport_country));
cek('passport_issue_date terkirim', barisA?.passport_issue_date === '2025-06-16', String(barisA?.passport_issue_date));
cek('kontak darurat terkirim', String(barisA?.emergency_contact || '').includes('Istri'));

console.log('\n[4] Peringatan paspor < 6 bulan');
console.log(`      A: exp ${barisA?.passport_expiry} berangkat ${barisA?.departure_date} -> sisa ${barisA?.sisa_hari_paspor} hari, risiko=${barisA?.paspor_kurang_6bulan}`);
console.log(`      B: exp ${barisB?.passport_expiry} berangkat ${barisB?.departure_date} -> sisa ${barisB?.sisa_hari_paspor} hari, risiko=${barisB?.paspor_kurang_6bulan}`);
cek('paspor A (2030) TIDAK ditandai risiko', barisA?.paspor_kurang_6bulan === false, String(barisA?.paspor_kurang_6bulan));
cek('paspor B (2026-12) DITANDAI risiko <6 bulan', barisB?.paspor_kurang_6bulan === true, String(barisB?.paspor_kurang_6bulan));
cek('ringkasan menghitung risiko', Number(r.data.ringkas?.paspor_kurang_6bulan) >= 1, JSON.stringify(r.data.ringkas));

console.log('\n[5] Penanda kelengkapan data');
cek('baris A tidak kekurangan data', Array.isArray(barisA?.kurang) && barisA.kurang.length === 0, JSON.stringify(barisA?.kurang));

// bersihkan
for (const txId of [Number(txA.lastInsertRowid), Number(txB.lastInsertRowid)]) {
  db.prepare('DELETE FROM booking_jamaah WHERE transaction_id=?').run(txId);
  db.prepare('DELETE FROM transactions WHERE id=?').run(txId);
}
db.prepare('DELETE FROM master_jamaah WHERE nik IN (?,?)').run(nikA, nikB);
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG MANIFEST BANDARA LULUS');
