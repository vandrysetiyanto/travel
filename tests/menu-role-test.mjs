#!/usr/bin/env node
/**
 * Uji: 1 user = 1 role, tetapi MENU per role bisa ditambah di luar izin dasar.
 * (Kasus nyata: role FINANCE diberi menu Kasir.)
 *
 * Dijalankan pada salinan database; logika identik dengan lib/menu-katalog.ts
 * + lib/role-menus.ts (tanpa impor TS).
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';

const SRC = process.argv[2];
const TMP = '/tmp/menu-role.db';
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(SRC + s)) fs.copyFileSync(SRC + s, TMP + s);
const db = new Database(TMP); db.pragma('foreign_keys = ON');

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

// katalog (subset yang diuji) — sama dengan lib/menu-katalog.ts
const MENU = [
  { code: 'dashboard', perm: null, alwaysOn: true, group: 'Utama' },
  { code: 'jamaah', perm: 'jamaah.read', group: 'Master Data' },
  { code: 'transaksi', perm: 'booking.read', group: 'Transaksi' },
  { code: 'pembayaran', perm: 'payment.read', group: 'Transaksi' },
  { code: 'expenses', perm: 'expense.manage', group: 'Transaksi' },
  { code: 'laporan', perm: 'report.finance', group: 'Laporan' },
  { code: 'settings', perm: 'settings.manage', group: 'Pengaturan' },
  { code: 'staf', perm: 'staff.manage', group: 'Pengaturan' },
  { code: 'roles', perm: 'staff.manage', group: 'Pengaturan' },
  { code: 'audit', perm: 'audit.read', group: 'Pengaturan' },
];
const SENSITIF = new Set(['settings', 'staf', 'roles', 'audit']);

const izinRole = (code) => db.prepare(`SELECT p.code FROM role_permissions rp
  JOIN permissions p ON p.id = rp.permission_id JOIN roles r ON r.id = rp.role_id
  WHERE r.code = ?`).all(code).map(x => x.code);
const tambahan = (code) => db.prepare(`SELECT rm.menu_code FROM role_menus rm
  JOIN roles r ON r.id = rm.role_id WHERE r.code = ?`).all(code).map(x => x.menu_code);
const menuEfektif = (code) => {
  const iz = new Set(izinRole(code));
  const tb = new Set(tambahan(code));
  return MENU.filter(m => m.alwaysOn || (m.perm && iz.has(m.perm)) || (tb.has(m.code) && !SENSITIF.has(m.code))).map(m => m.code);
};

console.log('\n[1] Tabel role_menus ada');
cek('role_menus dibuat oleh migrasi', !!db.prepare("SELECT 1 FROM sqlite_master WHERE name='role_menus'").get());

console.log('\n[2] VIEWER tanpa pengecualian');
const m0 = menuEfektif('VIEWER');
cek('VIEWER melihat data jamaah', m0.includes('jamaah'));
cek('VIEWER TIDAK melihat menu beban/Kasir', !m0.includes('expenses'), m0.join(','));
cek('VIEWER TIDAK melihat laporan keuangan', !m0.includes('laporan'));
cek('VIEWER selalu punya Dashboard', m0.includes('dashboard'));

console.log('\n[3] Beri VIEWER menu Kasir (pengecualian menu, kasus pemilik)');
const rid = db.prepare("SELECT id FROM roles WHERE code='VIEWER'").get().id;
const izinSebelum = izinRole('VIEWER').length;
db.prepare("INSERT INTO role_menus (role_id, menu_code) VALUES (?, 'expenses')").run(rid);
const m1 = menuEfektif('VIEWER');
cek('menu expenses KINI tampil untuk VIEWER', m1.includes('expenses'), m1.join(','));
cek('IZIN expense.manage TIDAK ikut diberikan', !izinRole('VIEWER').includes('expense.manage'));
cek('jumlah izin VIEWER tidak bertambah', izinRole('VIEWER').length === izinSebelum, `${izinSebelum} -> ${izinRole('VIEWER').length}`);
cek('role lain tidak terpengaruh (FINANCE tetap punya laporan)', menuEfektif('FINANCE').includes('laporan'));

console.log('\n[4] Menu sensitif TIDAK bisa dibuka lewat pengecualian');
db.prepare("INSERT OR IGNORE INTO role_menus (role_id, menu_code) VALUES (?, 'settings')").run(rid);
db.prepare("INSERT OR IGNORE INTO role_menus (role_id, menu_code) VALUES (?, 'audit')").run(rid);
const m2 = menuEfektif('VIEWER');
cek('settings tidak tampil walau dimasukkan manual', !m2.includes('settings'), m2.join(','));
cek('audit tidak tampil walau dimasukkan manual', !m2.includes('audit'));

console.log('\n[5] Mencabut pengecualian mengembalikan menu');
db.prepare("DELETE FROM role_menus WHERE role_id = ?").run(rid);
cek('menu expenses hilang lagi', !menuEfektif('VIEWER').includes('expenses'));

console.log('\n[6] 1 user = 1 role, izin ikut role-nya');
const u = db.prepare("SELECT email, role FROM users WHERE email='owner@travel.com'").get();
cek('user hanya punya satu kolom role', !!u && typeof u.role === 'string');
cek('AWAS: tabel user_roles TIDAK dibuat (sesuai keputusan 1 user = 1 role)',
  !db.prepare("SELECT 1 FROM sqlite_master WHERE name='user_roles'").get());

console.log(`\nLULUS ${L} · GAGAL ${G}`);
db.close();
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(TMP + s)) fs.unlinkSync(TMP + s);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG MENU-PER-ROLE LULUS');
