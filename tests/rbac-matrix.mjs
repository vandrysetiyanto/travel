#!/usr/bin/env node
/**
 * Uji matriks izin RBAC pada salinan DB (tanpa login/password).
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';

const SRC = process.argv[2];
const TMP = '/tmp/rbac-matrix.db';
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(SRC + s)) fs.copyFileSync(SRC + s, TMP + s);
const db = new Database(TMP, { readonly: true });

const izin = (role) => new Set(
  db.prepare(`SELECT p.code FROM role_permissions rp
              JOIN permissions p ON p.id = rp.permission_id
              JOIN roles r ON r.id = rp.role_id
              WHERE r.code = ?`).all(role).map(r => r.code)
);

let lulus = 0, gagal = 0; const jejak = [];
const cek = (n, s, d = '') => { if (s) { lulus++; } else { gagal++; jejak.push(`${n} ${d}`); console.log(`  ❌ ${n} ${d}`); } };

const MATRIKS = [
  ['jamaah.read',                1,1,1,1,1,1],
  ['jamaah.create',              1,1,0,1,1,0],
  ['jamaah.update',              1,1,0,1,0,0],
  ['jamaah.delete',              1,1,0,0,0,0],
  ['paket.read',                 1,1,1,1,1,1],
  ['paket.create',               1,1,0,1,1,0],
  ['paket.update',               1,1,0,1,1,0],
  ['paket.delete',               1,1,0,0,0,0],
  ['booking.read',               1,1,1,1,1,1],
  ['booking.create',             1,1,0,1,1,0],
  ['booking.update',             1,1,0,1,0,0],
  ['booking.delete',             1,1,0,0,0,0],
  ['payment.read',               1,1,1,1,0,1],
  ['payment.verify',             1,1,1,0,0,0],
  ['inventory.read',             1,1,1,1,0,1],
  ['inventory.create',           1,1,0,0,0,0],
  ['inventory.update',           1,1,0,1,0,0],
  ['inventory.delete',           1,1,0,0,0,0],
  ['checklist.read',             1,1,0,1,0,1],
  ['checklist.update',           1,1,0,1,0,0],
  ['coa.manage',                 1,1,1,0,0,0],
  ['journal.read',               1,1,1,0,0,0],
  ['journal.create',             1,1,1,0,0,0],
  ['journal.delete',             1,1,0,0,0,0],
  ['expense.manage',             1,1,1,0,0,0],
  ['report.finance',             1,1,1,0,0,0],
  ['report.operational',         1,1,1,1,1,1],
  ['settings.manage',            1,1,0,0,0,0],
  ['staff.manage',               1,1,0,0,0,0],
  ['audit.read',                 1,0,0,0,0,0],
];

const ROLES = ['OWNER', 'ADMIN', 'FINANCE', 'OPERASIONAL', 'MARKETING', 'VIEWER'];
const peta = Object.fromEntries(ROLES.map(r => [r, izin(r)]));

console.log('\nMemeriksa matriks izin (' + MATRIKS.length + ' izin x ' + ROLES.length + ' role = ' + MATRIKS.length * ROLES.length + ' sel)\n');
for (const [kode, ...harapan] of MATRIKS) {
  ROLES.forEach((role, i) => {
    const dapat = peta[role].has(kode) ? 1 : 0;
    cek(`${role}.${kode}`, dapat === harapan[i], `harap ${harapan[i] ? 'boleh' : 'tolak'}, dapat ${dapat ? 'boleh' : 'tolak'}`);
  });
}

cek('role tak dikenal -> izin <= VIEWER (default aman)', peta['VIEWER'].size <= 7, `viewer=${peta['VIEWER'].size}`);

console.log(`\n${'-'.repeat(56)}`);
console.log(`LULUS ${lulus} / GAGAL ${gagal} dari ${MATRIKS.length * ROLES.length} sel`);
db.close();
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(TMP + s)) fs.unlinkSync(TMP + s);
if (gagal > 0) { console.log('Gagal:\n  ' + jejak.slice(0, 12).join('\n  ')); process.exit(1); }
console.log('MATRIKS IZIN SESUAI RENCANA');
