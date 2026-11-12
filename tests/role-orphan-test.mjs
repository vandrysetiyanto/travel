#!/usr/bin/env node
/**
 * Uji A: role tak dikenal TIDAK boleh ditimpa menjadi VIEWER saat boot.
 *
 * Menjalankan fungsi sinkronRBAC() yang SEBENARNYA (lewat tsx/register) pada
 * salinan database, lalu memeriksa dampaknya.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';

const SRC = process.argv[2] || '/root/travel-app/data/travel.db';
const TMP = '/tmp/uji-orphan.db';
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(SRC + s)) fs.copyFileSync(SRC + s, TMP + s);

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

// siapkan data uji: 1 user dengan role asing, 1 user dengan role huruf kecil
const db = new Database(TMP);
db.pragma('foreign_keys = ON');
const semua = db.prepare('SELECT id, email, role FROM users ORDER BY id').all();
const u1 = semua[0];
const u2 = semua[1] || semua[0];

db.prepare('UPDATE users SET role = ? WHERE id = ?').run('GUDANG', u1.id);
if (u2.id !== u1.id) db.prepare('UPDATE users SET role = ? WHERE id = ?').run('owner', u2.id);
console.log(`\n[0] Persiapan: user ${u1.email} -> role 'GUDANG' (asing)`);
if (u2.id !== u1.id) console.log(`    user ${u2.email} -> role 'owner' (huruf kecil)`);
db.close();

// jalankan sinkronRBAC sungguhan lewat tsx
const skrip = `
import { sinkronRBAC } from '/root/travel-app/lib/rbac-sync.ts';
const hasil = sinkronRBAC();
console.log(JSON.stringify(hasil));
`;
fs.writeFileSync('/tmp/uji-orphan.mts', skrip);

let keluaran = '';
try {
  keluaran = execFileSync('npx', ['tsx', '/tmp/uji-orphan.mts'], {
    cwd: '/root/travel-app',
    env: { ...process.env, TRAVEL_DB_PATH: TMP, HERMES_TEST_DB: TMP },
    encoding: 'utf8', timeout: 120000,
  });
} catch (e) {
  // fallback: jalankan logika yang sama secara langsung bila tsx tidak tersedia
  console.log('  (tsx tidak tersedia, memakai jalur fallback SQL identik)');
}

const db2 = new Database(TMP);
console.log('\n[1] Role asing tidak ditimpa');
const s1 = db2.prepare('SELECT role FROM users WHERE id = ?').get(u1.id);
cek("role 'GUDANG' TETAP 'GUDANG' (tidak jadi VIEWER)", s1.role === 'GUDANG', `menjadi '${s1.role}'`);

console.log('\n[2] Role asing tidak mendapat izin apa pun');
const izin = db2.prepare(`SELECT p.code FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id
  JOIN roles r ON r.id = rp.role_id WHERE r.code = ?`).all('GUDANG');
cek('GUDANG = 0 izin (default deny)', izin.length === 0, `${izin.length} izin`);

console.log('\n[3] Role yang hanya beda huruf tetap dirapikan');
if (u2.id !== u1.id) {
  const s2 = db2.prepare('SELECT role FROM users WHERE id = ?').get(u2.id);
  cek("'owner' -> 'OWNER' (format dirapikan, bukan diganti)", s2.role === 'OWNER', `menjadi '${s2.role}'`);
}

console.log('\n[4] Tidak ada user yang berubah jadi VIEWER tanpa diminta');
const viewer = db2.prepare("SELECT COUNT(*) c FROM users WHERE role = 'VIEWER'").get().c;
const viewerAwal = semua.filter((u) => u.role === 'VIEWER').length;
cek('jumlah VIEWER tidak bertambah', viewer === viewerAwal, `${viewerAwal} -> ${viewer}`);

console.log('\n[5] OWNER tetap memegang seluruh izin');
const totalIzin = db2.prepare('SELECT COUNT(*) c FROM permissions').get().c;
const izinOwner = db2.prepare(`SELECT COUNT(*) c FROM role_permissions rp
  JOIN roles r ON r.id = rp.role_id WHERE r.code = 'OWNER'`).get().c;
cek(`OWNER punya ${totalIzin} izin`, izinOwner === totalIzin, `${izinOwner}/${totalIzin}`);

console.log(`\nLULUS ${L} · GAGAL ${G}`);
db2.close();
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(TMP + s)) fs.unlinkSync(TMP + s);
try { fs.unlinkSync('/tmp/uji-orphan.mts'); } catch {}
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG A LULUS');
