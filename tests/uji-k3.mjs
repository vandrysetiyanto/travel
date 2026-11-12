#!/usr/bin/env node
/**
 * Uji K3: ganti password bawaan membuka akses, dan gerbang tidak bisa dilewati.
 * Mengembalikan kondisi awal setelah uji.
 */
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';
const SANDI_BARU = 'RahasiaBaru2026!';

const db = new Database(DB);
let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

// pastikan kondisi awal: wajib ganti
db.prepare("UPDATE users SET must_change_password = 1 WHERE email = 'owner@travel.com'").run();

console.log('\n[1] Sebelum ganti password');
let r = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (r.headers.get('set-cookie') || '').split(';')[0];
let j = await r.json();
cek('flag must_change_password = true', j.must_change_password === true);

r = await fetch(`${BASE}/api/admin/inventory`, { headers: { Cookie: cookie } });
cek('API lain ditahan 403', r.status === 403, `HTTP ${r.status}`);

console.log('\n[2] Ganti password lewat API');
r = await fetch(`${BASE}/api/admin/staff/me`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ password: SANDI_BARU }),
});
j = await r.json().catch(() => ({}));
cek('ganti password berhasil', r.ok && j.success, `HTTP ${r.status} ${JSON.stringify(j).slice(0, 90)}`);

console.log('\n[3] Setelah ganti password');
r = await fetch(`${BASE}/api/admin/inventory`, { headers: { Cookie: cookie } });
const boleh = r.status !== 403;
cek('API lain terbuka kembali (bukan 403)', boleh, `HTTP ${r.status}`);

r = await fetch(`${BASE}/api/admin/staff/me`, { headers: { Cookie: cookie } });
j = await r.json();
cek('flag must_change_password sudah false', j.user?.must_change_password === false);

console.log('\n[4] Login dengan password lama harus GAGAL');
r = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
cek('password lama ditolak 401', r.status === 401, `HTTP ${r.status}`);

console.log('\n[5] Login dengan password baru berhasil');
r = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: SANDI_BARU }),
});
cek('password baru diterima', r.ok, `HTTP ${r.status}`);

// ── kembalikan kondisi awal ──
db.prepare("UPDATE users SET password = ?, must_change_password = 1 WHERE email = 'owner@travel.com'")
  .run(bcrypt.hashSync('owner123', 10));
db.prepare("UPDATE users SET must_change_password = 1 WHERE email = 'admin@travel.com'").run();
db.close();

console.log('\n[6] Kondisi awal dikembalikan');
const db2 = new Database(DB, { readonly: true });
const u = db2.prepare("SELECT must_change_password, password FROM users WHERE email='owner@travel.com'").get();
cek('owner kembali ke password semula', bcrypt.compareSync('owner123', u.password));
cek('penanda wajib ganti dipulihkan (=1)', Number(u.must_change_password) === 1);
db2.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG K3 LULUS');
