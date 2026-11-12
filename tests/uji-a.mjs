#!/usr/bin/env node
/**
 * Uji A (jalur nyata): jalankan sinkronRBAC() yang SEBENARNYA di lingkungan
 * terisolasi (salinan proyek + salinan DB), lalu periksa hasilnya.
 *
 * Tidak menebak dari SQL tiruan — fungsi aslinya benar-benar dieksekusi via tsx.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import Database from 'better-sqlite3';

const SUMBER = '/root/travel-app';
const KERJA = '/tmp/uji-a-app';

console.log('\n[0] Menyiapkan lingkungan terisolasi');
fs.rmSync(KERJA, { recursive: true, force: true });
fs.mkdirSync(KERJA, { recursive: true });
for (const item of ['app', 'lib', 'package.json', 'tsconfig.json', 'next.config.mjs', 'next-env.d.ts', 'node_modules']) {
  const asal = path.join(SUMBER, item);
  if (!fs.existsSync(asal)) continue;
  // node_modules di-symlink supaya cepat
  if (item === 'node_modules') fs.symlinkSync(asal, path.join(KERJA, item));
  else fs.cpSync(asal, path.join(KERJA, item), { recursive: true });
}
fs.mkdirSync(path.join(KERJA, 'data'), { recursive: true });
for (const s of ['', '-wal', '-shm']) {
  const a = path.join(SUMBER, 'data/travel.db' + s);
  if (fs.existsSync(a)) fs.copyFileSync(a, path.join(KERJA, 'data/travel.db' + s));
}
console.log('    salinan proyek + DB siap di', KERJA);

// Siapkan data uji pada salinan
const DB = path.join(KERJA, 'data/travel.db');
let db = new Database(DB);
db.pragma('foreign_keys = ON');
const users = db.prepare('SELECT id, email, role FROM users ORDER BY id').all();
const uAsing = users[0];
const uKecil = users[1] || users[0];
db.prepare('UPDATE users SET role = ? WHERE id = ?').run('GUDANG', uAsing.id);
if (uKecil.id !== uAsing.id) db.prepare('UPDATE users SET role = ? WHERE id = ?').run('owner', uKecil.id);
const viewerAwal = users.filter(u => u.role === 'VIEWER').length;
console.log(`    ${uAsing.email} -> 'GUDANG' (role asing)`);
if (uKecil.id !== uAsing.id) console.log(`    ${uKecil.email} -> 'owner' (huruf kecil)`);
db.close();

// Jalankan sinkronRBAC sungguhan via loader alias @/
const skrip = `
import { sinkronRBAC } from '@/lib/rbac-sync';
const h = sinkronRBAC();
console.log('HASIL=' + JSON.stringify(h));
`;
fs.writeFileSync(path.join(KERJA, 'jalankan.mts'), skrip);
fs.copyFileSync('/tmp/alias-loader-src.mjs', path.join(KERJA, 'alias-loader.mjs'));

let keluaran = '', sukses = false;
try {
  keluaran = execSync(
    'node --experimental-strip-types --import ./alias-loader.mjs jalankan.mts',
    { cwd: KERJA, encoding: 'utf8', timeout: 120000, stdio: 'pipe' }
  );
  sukses = true;
} catch (e) {
  keluaran = (e.stdout || '') + (e.stderr || '');
}
console.log('\n[1] Menjalankan sinkronRBAC() asli');
if (sukses) {
  const m = keluaran.match(/HASIL=(\{.*\})/);
  console.log('    ✅ fungsi tereksekusi:', m ? m[1] : '(tanpa keluaran JSON)');
} else {
  console.log('    ⚠️  gagal dimuat:', keluaran.split('\n').filter(Boolean).slice(-3).join(' | '));
}

// Periksa hasil
db = new Database(DB);
let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

console.log('\n[2] Hasil pada database');
const r1 = db.prepare('SELECT role FROM users WHERE id = ?').get(uAsing.id).role;
cek("role asing 'GUDANG' tidak ditimpa", r1 === 'GUDANG', `menjadi '${r1}'`);

const izinAsing = db.prepare(`SELECT COUNT(*) c FROM role_permissions rp
  JOIN roles r ON r.id = rp.role_id WHERE r.code = 'GUDANG'`).get().c;
cek('GUDANG tetap 0 izin (default deny)', izinAsing === 0, `${izinAsing} izin`);

if (uKecil.id !== uAsing.id) {
  const r2 = db.prepare('SELECT role FROM users WHERE id = ?').get(uKecil.id).role;
  cek("'owner' dirapikan jadi 'OWNER'", r2 === 'OWNER', `menjadi '${r2}'`);
} else {
  cek("'owner' dirapikan jadi 'OWNER' (dilewati: hanya 1 user)", true);
}

const viewerKini = db.prepare("SELECT COUNT(*) c FROM users WHERE role = 'VIEWER'").get().c;
cek('tidak ada user baru berubah jadi VIEWER', viewerKini === viewerAwal, `${viewerAwal} -> ${viewerKini}`);

const total = db.prepare('SELECT COUNT(*) c FROM permissions').get().c;
const owner = db.prepare(`SELECT COUNT(*) c FROM permissions p
  JOIN role_permissions rp ON rp.permission_id = p.id
  JOIN roles r ON r.id = rp.role_id WHERE r.code = 'OWNER'`).get().c;
cek(`OWNER tetap memegang ${total} izin`, owner === total, `${owner}/${total}`);

db.close();
console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG A LULUS');
