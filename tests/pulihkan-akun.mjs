#!/usr/bin/env node
/**
 * Memulihkan akun bawaan ke kondisi awal sesuai instruksi pengguna
 * ("password belum perlu diganti"), sekaligus menandai WAJIB GANTI karena
 * sandinya masih sandi bawaan yang tertulis di dokumentasi.
 *
 * Dipakai setelah uji otomatis yang menyentuh kata sandi.
 *
 * Pemakaian:
 *   node tests/pulihkan-akun.mjs            # owner@ / admin@ ke sandi bawaan
 *   node tests/pulihkan-akun.mjs --buka-gate # sekaligus matikan penanda wajib ganti
 */
import Database from 'better-sqlite3';
import bcrypt from 'bcryptjs';

const BUKA_GATE = process.argv.includes('--buka-gate');
const db = new Database('/root/travel-app/data/travel.db');

const akun = [
  { email: 'owner@travel.com', sandi: 'owner123', nama: 'Owner / Direktur Travel', role: 'OWNER' },
  { email: 'admin@travel.com', sandi: 'admin123', nama: 'Staff Admin Operasional', role: 'ADMIN' },
];

console.log(`\nMemulihkan akun bawaan${BUKA_GATE ? ' (gate DIBUKA)' : ' (gate aktif)'}:\n`);

for (const a of akun) {
  const ada = db.prepare('SELECT id FROM users WHERE email = ?').get(a.email);
  const hash = bcrypt.hashSync(a.sandi, 10);

  if (!ada) {
    db.prepare(
      'INSERT INTO users (name, email, password, role, must_change_password) VALUES (?, ?, ?, ?, ?)',
    ).run(a.nama, a.email, hash, a.role, BUKA_GATE ? 0 : 1);
    console.log(`  + dibuat  ${a.email.padEnd(22)} role=${a.role}`);
  } else {
    db.prepare('UPDATE users SET password = ?, must_change_password = ? WHERE email = ?')
      .run(hash, BUKA_GATE ? 0 : 1, a.email);
    console.log(`  ~ dipulihkan ${a.email.padEnd(22)} role=${a.role}`);
  }

  const cek = db.prepare('SELECT password, must_change_password FROM users WHERE email = ?').get(a.email);
  console.log(`      sandi cocok: ${bcrypt.compareSync(a.sandi, cek.password)} | wajib ganti: ${cek.must_change_password}`);
}

db.close();
console.log('\nSelesai.');
