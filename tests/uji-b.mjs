#!/usr/bin/env node
/**
 * Uji B: Master Role CRUD + seluruh pengaman.
 * Menguji lewat HTTP API sungguhan dengan sesi login OWNER.
 */
import Database from 'better-sqlite3';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
const call = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) };
};

const db = new Database(DB);
const KODE = 'GUDANG_UJI';

console.log('\n[0] Bersihkan sisa uji');
db.prepare("DELETE FROM role_permissions WHERE role_id IN (SELECT id FROM roles WHERE code=?)").run(KODE);
db.prepare("DELETE FROM role_menus WHERE role_id IN (SELECT id FROM roles WHERE code=?)").run(KODE);
db.prepare("DELETE FROM roles WHERE code=?").run(KODE);

console.log('\n[1] Buat role baru');
let r = await call('/api/admin/roles', { action: 'CREATE_ROLE', code: KODE, name: 'Petugas Gudang' });
cek('CREATE_ROLE berhasil (201)', r.status === 201 && r.data.success, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0,100)}`);
const roleBaru = db.prepare('SELECT id, code, name, is_system FROM roles WHERE code=?').get(KODE);
cek('role tersimpan dengan is_system = 0', !!roleBaru && roleBaru.is_system === 0);

r = await call('/api/admin/roles', { action: 'CREATE_ROLE', code: 'GUDANG_UJI', name: 'Duplikat' });
cek('role duplikat ditolak 409', r.status === 409, `HTTP ${r.status}`);

console.log('\n[2] Pengaman nama menyerupai role sistem');
for (const kode of ['ADMIN2', 'OWNER_X', 'VIEWER1']) {
  r = await call('/api/admin/roles', { action: 'CREATE_ROLE', code: kode, name: 'Tiru' });
  cek(`"${kode}" ditolak (menyerupai sistem)`, r.status === 400, `HTTP ${r.status}`);
  db.prepare('DELETE FROM roles WHERE code=?').run(kode);
}

console.log('\n[3] Anti escalation izin');
// OWNER punya semua izin -> boleh. Coba role dengan izin yang tidak ada:
// 'izin.tidak.ada' bukan izin milik OWNER -> tertangkap anti-escalation (403).
r = await call('/api/admin/roles', { action: 'CREATE_ROLE', code: 'UJI_IZIN', name: 'Uji', permissions: ['izin.tidak.ada'] });
cek('izin tak dikenal ditolak (403 anti-escalation)', r.status === 403, `HTTP ${r.status}`);
cek('role tidak terbuat', !db.prepare('SELECT 1 FROM roles WHERE code=?').get('UJI_IZIN'));
db.prepare('DELETE FROM roles WHERE code=?').run('UJI_IZIN');

console.log('\n[4] Set izin role baru');
r = await call('/api/admin/roles', { action: 'SET_PERMISSIONS', role: KODE, permissions: ['inventory.read', 'checklist.read'] });
cek('SET_PERMISSIONS berhasil', r.ok && r.data.success, `HTTP ${r.status}`);
const izin = db.prepare(`SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id
  JOIN roles r ON r.id=rp.role_id WHERE r.code=?`).all(KODE).map(x => x.code).sort();
cek('izin tersimpan tepat 2', izin.length === 2 && izin.includes('inventory.read'), izin.join(','));

console.log('\n[5] Hapus role yang MASIH DIPAKAI harus 409');
// buat user uji ber-role role baru
const hash = db.prepare("SELECT password FROM users WHERE email='owner@travel.com'").get().password;
db.prepare("INSERT INTO users (name,email,password,role) VALUES (?,?,?,?)").run('Uji Gudang', 'uji-gudang@travel.com', hash, KODE);
r = await call('/api/admin/roles', { action: 'DELETE_ROLE', code: KODE });
cek('DELETE_ROLE ditolak 409 saat masih dipakai', r.status === 409, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0,80)}`);
cek('role masih ada di database', !!db.prepare('SELECT 1 FROM roles WHERE code=?').get(KODE));

console.log('\n[6] Pindahkan user, lalu hapus harus berhasil');
db.prepare("UPDATE users SET role='VIEWER' WHERE email='uji-gudang@travel.com'").run();
r = await call('/api/admin/roles', { action: 'DELETE_ROLE', code: KODE });
cek('DELETE_ROLE berhasil setelah user dipindah', r.ok && r.data.success, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0,80)}`);
cek('role benar-benar hilang', !db.prepare('SELECT 1 FROM roles WHERE code=?').get(KODE));
const sisaPeta = db.prepare("SELECT COUNT(*) c FROM role_permissions WHERE role_id=?").get(roleBaru.id).c;
cek('peta izin role ikut terhapus (tidak ada sisa)', sisaPeta === 0, `${sisaPeta} sisa`);

console.log('\n[7] Role sistem tidak bisa disentuh');
for (const aksi of ['DELETE_ROLE']) {
  r = await call('/api/admin/roles', { action: aksi, code: 'OWNER' });
  cek(`${aksi} OWNER ditolak 400`, r.status === 400, `HTTP ${r.status}`);
}
r = await call('/api/admin/roles', { action: 'UPDATE_ROLE', code: 'ADMIN', name: 'Admin Baru' });
cek('UPDATE_ROLE ADMIN ditolak 400', r.status === 400, `HTTP ${r.status}`);
const namaAdmin = db.prepare("SELECT name FROM roles WHERE code='ADMIN'").get().name;
cek('nama ADMIN tidak berubah', namaAdmin !== 'Admin Baru', `sekarang '${namaAdmin}'`);

console.log('\n[8] OWNER tidak bisa kehilangan izin');
r = await call('/api/admin/roles', { action: 'SET_PERMISSIONS', role: 'OWNER', permissions: ['jamaah.read'] });
cek('mencabut izin OWNER ditolak 400', r.status === 400, `HTTP ${r.status}`);

console.log('\n[9] Audit tercatat');
const audit = db.prepare("SELECT action, module, record_id FROM audit_log WHERE module='role' ORDER BY id DESC LIMIT 5").all();
cek('ada catatan audit CREATE role', audit.some(a => a.action === 'CREATE' && a.record_id === KODE), JSON.stringify(audit));

// bersihkan
db.prepare("DELETE FROM users WHERE email='uji-gudang@travel.com'").run();
db.prepare("DELETE FROM audit_log WHERE module='role' AND record_id IN ('GUDANG_UJI','UJI_IZIN')").run();
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG B LULUS');
