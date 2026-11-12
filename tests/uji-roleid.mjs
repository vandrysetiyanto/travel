#!/usr/bin/env node
/**
 * Uji D: users.role_id sebagai FK sumber, dengan users.role sebagai cermin.
 *
 * Fokus: konsistensi dua arah, pencabutan role berlaku seketika (tidak menunggu
 * token kedaluwarsa), dan tidak ada user yang tertinggal menunjuk role terhapus.
 */
import Database from 'better-sqlite3';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

const db = new Database(DB);
db.pragma('foreign_keys = ON');

console.log('\n[1] Skema');
const kolom = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
cek('kolom role_id ada', kolom.includes('role_id'));
const fk = db.prepare('PRAGMA foreign_key_list(users)').all();
cek('FK role_id -> roles(id)', fk.some(f => f.from === 'role_id' && f.table === 'roles'), JSON.stringify(fk));
const trg = db.prepare("SELECT name FROM sqlite_master WHERE type='trigger' AND tbl_name='users'").all().map(t => t.name);
cek('trigger sinkron dua arah ada', trg.length >= 3, trg.join(','));
cek('kolom role (cermin) masih ada', kolom.includes('role'));

console.log('\n[2] Semua user punya role_id yang sah');
const yatim = db.prepare(`SELECT u.id, u.email, u.role FROM users u
  LEFT JOIN roles r ON r.id = u.role_id WHERE u.role_id IS NULL OR r.id IS NULL`).all();
cek('tidak ada role_id kosong/dangling', yatim.length === 0, JSON.stringify(yatim));
const beda = db.prepare(`SELECT u.id, u.role, r.code FROM users u
  JOIN roles r ON r.id = u.role_id WHERE u.role != r.code`).all();
cek('kolom role selalu sama dengan kode role_id', beda.length === 0, JSON.stringify(beda));

console.log('\n[3] Menulis role via TEKS tetap mengisi role_id (trigger)');
const ujiEmail = 'uji-roleid@travel.com';
db.prepare("DELETE FROM users WHERE email = ?").run(ujiEmail);
const hash = db.prepare("SELECT password FROM users WHERE email='owner@travel.com'").get().password;
db.prepare("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)")
  .run('Uji RoleId', ujiEmail, hash, 'VIEWER');
let u = db.prepare('SELECT id, role, role_id FROM users WHERE email=?').get(ujiEmail);
const uid = u.id;   // simpan terpisah: `u` akan ditimpa hasil query berikutnya
const idViewer = db.prepare("SELECT id FROM roles WHERE code='VIEWER'").get().id;
cek('INSERT dengan role teks -> role_id terisi otomatis', u.role_id === idViewer, `role_id=${u.role_id}, harap ${idViewer}`);

db.prepare("UPDATE users SET role='FINANCE' WHERE id=?").run(uid);
u = db.prepare('SELECT role, role_id FROM users WHERE id=?').get(uid);
const idFinance = db.prepare("SELECT id FROM roles WHERE code='FINANCE'").get().id;
cek('UPDATE role teks -> role_id ikut berubah', u.role_id === idFinance, `role_id=${u.role_id}`);

console.log('\n[4] Menulis role_id mengubah kode role (trigger arah balik)');
db.prepare('UPDATE users SET role_id=? WHERE id=?').run(idViewer, uid);
u = db.prepare('SELECT role, role_id FROM users WHERE id=?').get(uid);
cek('UPDATE role_id -> kode role ikut berubah', u.role === 'VIEWER', `role='${u.role}'`);

console.log('\n[5] Pencabutan role berlaku SEKETIKA (tanpa menunggu token)');
db.prepare("UPDATE users SET role='ADMIN', role_id=? WHERE id=?").run(db.prepare("SELECT id FROM roles WHERE code='ADMIN'").get().id, uid);
// password uji disamakan dengan owner agar bisa login
const loginUji = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ujiEmail, password: 'owner123' }),
});
const ckUji = (loginUji.headers.get('set-cookie') || '').split(';')[0];
cek('login user uji sebagai ADMIN', loginUji.ok, `HTTP ${loginUji.status}`);

let me = await (await fetch(`${BASE}/api/admin/staff/me`, { headers: { Cookie: ckUji } })).json();
cek('saat ADMIN, punya izin jamaah.delete', (me.permissions || []).includes('jamaah.delete'), `izin=${(me.permissions||[]).length}`);

// cabut role sambil token masih hidup
db.prepare("UPDATE users SET role='VIEWER', role_id=? WHERE id=?").run(idViewer, uid);
me = await (await fetch(`${BASE}/api/admin/staff/me`, { headers: { Cookie: ckUji } })).json();
cek('TANPA login ulang, role sudah jadi VIEWER', me.user?.role === 'VIEWER', `role=${me.user?.role}`);
cek('izin jamaah.delete langsung hilang', !(me.permissions || []).includes('jamaah.delete'), `izin=${(me.permissions||[]).length}`);

console.log('\n[6] Role dihapus -> tidak ada user menunjuk role hantu');
// buat role kustom, pasang ke user uji, lalu hapus lewat API (harus 409 saat dipakai)
const ck = (await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
}).then(r => r.headers.get('set-cookie') || '')).split(';')[0];

await fetch(`${BASE}/api/admin/roles`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ck },
  body: JSON.stringify({ action: 'CREATE_ROLE', code: 'UJI_FK', name: 'Uji FK' }),
});
const idUjiFk = db.prepare("SELECT id FROM roles WHERE code='UJI_FK'").get();
db.prepare('UPDATE users SET role_id=?, role=? WHERE id=?').run(idUjiFk.id, 'UJI_FK', uid);

let r = await fetch(`${BASE}/api/admin/roles`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ck },
  body: JSON.stringify({ action: 'DELETE_ROLE', code: 'UJI_FK' }),
});
cek('hapus role yang dipakai ditolak 409', r.status === 409, `HTTP ${r.status}`);

db.prepare("UPDATE users SET role='VIEWER', role_id=? WHERE id=?").run(idViewer, uid);
r = await fetch(`${BASE}/api/admin/roles`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: ck },
  body: JSON.stringify({ action: 'DELETE_ROLE', code: 'UJI_FK' }),
});
cek('hapus role setelah user dipindah berhasil', r.ok, `HTTP ${r.status}`);
const sisa = db.prepare('SELECT COUNT(*) c FROM users WHERE role_id=?').get(idUjiFk.id).c;
cek('tidak ada user tersisa menunjuk role terhapus', sisa === 0, `${sisa} user`);

// bersihkan
db.prepare('DELETE FROM users WHERE email=?').run(ujiEmail);
db.prepare("DELETE FROM roles WHERE code='UJI_FK'").run();
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG role_id LULUS');
