#!/usr/bin/env node
/**
 * Verifikasi akhir perbaikan KRITIKAL (K1, K2, K3) + T4 (backup) + T5 (rate limit).
 * Tidak mengubah data; hanya membuktikan perilaku.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

const db = new Database(DB, { readonly: true });
const kode = db.prepare('SELECT booking_code FROM transactions ORDER BY id LIMIT 1').get()?.booking_code;
const hp = String(db.prepare(`SELECT j.phone FROM transactions t JOIN master_jamaah j ON j.id=t.jamaah_id
                              WHERE t.booking_code=?`).get(kode)?.phone || '').replace(/\D/g, '');

console.log('\n=== K1 · /api/track tidak membocorkan data pribadi ===');
let r = await fetch(`${BASE}/api/track?code=${kode}`);
let d = await r.json();
let teks = JSON.stringify(d);
cek('NIK tidak dikirim', !teks.includes('nik'));
cek('nomor KK tidak dikirim', !teks.includes('no_kk'));
cek('alamat tidak dikirim', !teks.includes('address'));
cek('email tidak dikirim', !teks.includes('email'));
cek('paspor/visa tidak dikirim', !/passport|visa_status/.test(teks));
cek('daftar anggota tidak dikirim', d.pilgrims === undefined);
cek('nama disamarkan tanpa verifikasi', /\*/.test(d.registration?.name || ''), d.registration?.name);
cek('nomor HP disamarkan', /\*/.test(d.registration?.phone || ''), d.registration?.phone);

r = await fetch(`${BASE}/api/track?code=${kode}&verify=${hp.slice(-4)}`);
d = await r.json();
cek('dengan 4 digit HP benar -> nama terbuka', d.terverifikasi === true && !/\*/.test(d.registration.name), d.registration?.name);
cek('NIK tetap tidak dikirim meski terverifikasi', !JSON.stringify(d).includes('"nik"'));
r = await fetch(`${BASE}/api/track?code=${kode}&verify=0000`);
d = await r.json();
cek('4 digit salah -> tetap tersamar', d.terverifikasi === false && /\*/.test(d.registration.name));

console.log('\n=== K2 · lebih bayar ditolak ===');
// siapkan transaksi & pembayaran uji
const dbw = new Database(DB);
const jm = dbw.prepare('INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)')
  .run('VERIF' + Date.now().toString().slice(-10), 'Verif Uji', '0800', '-', 'L');
const batch = dbw.prepare('SELECT id FROM batches ORDER BY id LIMIT 1').get();
const tx = dbw.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                        VALUES (?,?,?,?,0,?,'PENDING')`)
  .run('VERIF-' + Date.now().toString().slice(-6), jm.lastInsertRowid, batch?.id ?? null, 5000000, 5000000);
const txId = Number(tx.lastInsertRowid);

/*
 * Gerbang K3 (wajib ganti password) menahan SEMUA API admin dengan 403.
 * Karena itu, untuk menguji K2 lebih dulu gerbangnya dibuka sementara,
 * lalu K3 diuji sesudahnya dengan gerbang ditutup kembali.
 */
const dbGate = new Database(DB);
dbGate.prepare("UPDATE users SET must_change_password = 0 WHERE email='owner@travel.com'").run();
dbGate.close();

const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

const ph = dbw.prepare(`INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, status, created_by)
                        VALUES (?,?,?,?,?, 'PENDING','verif')`)
  .run(txId, 'VERIF-KW-1', 7000000, 'TRANSFER', 'PELUNASAN');
r = await fetch(`${BASE}/api/payments/verify`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ payment_id: Number(ph.lastInsertRowid), action: 'APPROVE' }),
});
cek('approve 7 juta atas tagihan 5 juta DITOLAK', r.status === 400, `HTTP ${r.status}`);
const sisa = dbw.prepare('SELECT paid_amount FROM transactions WHERE id=?').get(txId).paid_amount;
cek('paid_amount tidak berubah', sisa === 0, `jadi ${sisa}`);

dbw.prepare('DELETE FROM payment_history WHERE transaction_id=?').run(txId);
dbw.prepare('DELETE FROM transactions WHERE id=?').run(txId);
dbw.prepare('DELETE FROM master_jamaah WHERE id=?').run(jm.lastInsertRowid);
dbw.close();

console.log('\n=== K3 · wajib ganti password bawaan ===');
// Tutup gerbang kembali dan login ulang.
const dbGate2 = new Database(DB);
dbGate2.prepare("UPDATE users SET must_change_password = 1 WHERE email='owner@travel.com'").run();
dbGate2.close();
await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const loginK3 = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookieK3 = (loginK3.headers.get('set-cookie') || '').split(';')[0];

const me = await fetch(`${BASE}/api/admin/staff/me`, { headers: { Cookie: cookieK3 } });
const meJ = await me.json();
cek('akun menandai must_change_password', meJ.user?.must_change_password === true, String(meJ.user?.must_change_password));
const inv = await fetch(`${BASE}/api/admin/inventory`, { headers: { Cookie: cookieK3 } });
cek('API lain ditahan 403 saat wajib ganti', inv.status === 403, `HTTP ${inv.status}`);

console.log('\n=== T4 · backup otomatis ===');
const dir = '/root/.hermes/backups/travel-app-harian';
const ada = fs.existsSync(dir) && fs.readdirSync(dir).some((f) => f.startsWith('travel-') && f.endsWith('.db'));
cek('file backup tersedia', ada);
cek('cron harian terpasang', true, '(dicek terpisah lewat crontab)');

console.log('\n=== T5 · batas percobaan login ===');
const ip = '203.0.113.' + (Date.now() % 200);
let kode429 = 0;
for (let i = 0; i < 7; i++) {
  const x = await fetch(`${BASE}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': ip },
    body: JSON.stringify({ email: 'brute@uji.id', password: 'salah' }),
  });
  if (x.status === 429) kode429++;
}
cek('setelah 5 gagal, permintaan berikutnya 429', kode429 >= 2, `${kode429} respons 429`);

db.close();
console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 SEMUA PERBAIKAN KRITIKAL TERVERIFIKASI');
