#!/usr/bin/env node
/**
 * Uji gerbang "default tolak": role tak dikenal / tanpa izin tidak boleh
 * mendapat akses apa pun (sebelumnya jatuh ke izin VIEWER).
 *
 * Dijalankan pada salinan database; logika SQL identik dengan permissionsOf().
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';

const SRC = process.argv[2];
const TMP = '/tmp/rbac-default-deny.db';
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(SRC + s)) fs.copyFileSync(SRC + s, TMP + s);
const db = new Database(TMP); db.pragma('foreign_keys = ON');

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

// meniru permissionsOf versi BARU (tanpa fallback)
const izin = (role) => {
  const kode = String(role || '').trim().toUpperCase();
  if (!kode) return [];
  return db.prepare(`SELECT p.code FROM role_permissions rp
                     JOIN permissions p ON p.id = rp.permission_id
                     JOIN roles r ON r.id = rp.role_id
                     WHERE r.code = ?`).all(kode).map(x => x.code);
};

console.log('\n[1] Role tidak dikenal -> kosong');
cek("role 'TIDAKADA' -> 0 izin", izin('TIDAKADA').length === 0, `dapat ${izin('TIDAKADA').length}`);
cek("role '' -> 0 izin", izin('').length === 0);
cek("role null -> 0 izin", izin(null).length === 0);
cek('role sisipan SQL -> 0 izin', izin("VIEWER' OR '1'='1").length === 0);

console.log('\n[2] Role dikenal tetap utuh');
for (const [r, min] of [['OWNER', 30], ['ADMIN', 29], ['FINANCE', 12], ['OPERASIONAL', 15], ['MARKETING', 8], ['VIEWER', 7]]) {
  cek(`${r} >= ${min} izin`, izin(r).length >= min, `dapat ${izin(r).length}`);
}

console.log('\n[3] Role BARU tanpa centang -> tidak punya akses');
const r = db.prepare("INSERT INTO roles (code, name, is_system) VALUES ('GUDANG','Petugas Gudang',0)").run();
cek('role kustom GUDANG dibuat', Number(r.lastInsertRowid) > 0);
cek('GUDANG belum punya izin', izin('GUDANG').length === 0, `dapat ${izin('GUDANG').length}`);
cek('GUDANG TIDAK otomatis dapat izin VIEWER', !izin('GUDANG').includes('jamaah.read'));

console.log('\n[4] Setelah dicentang, izin mengikuti centang');
const rid = db.prepare("SELECT id FROM roles WHERE code='GUDANG'").get().id;
const pid = db.prepare("SELECT id FROM permissions WHERE code='inventory.read'").get().id;
db.prepare('INSERT INTO role_permissions (role_id, permission_id) VALUES (?, ?)').run(rid, pid);
cek('GUDANG dapat inventory.read', izin('GUDANG').includes('inventory.read'));
cek('GUDANG tetap tidak dapat jamaah.read', !izin('GUDANG').includes('jamaah.read'));

console.log('\n[5] Role dihapus -> user-nya tidak mendapat warisan akses');
db.prepare("DELETE FROM roles WHERE code='GUDANG'").run();
cek('setelah role dihapus, izin kosong', izin('GUDANG').length === 0, `dapat ${izin('GUDANG').length}`);

console.log(`\nLULUS ${L} · GAGAL ${G}`);
db.close();
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(TMP + s)) fs.unlinkSync(TMP + s);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG DEFAULT-DENY LULUS');
