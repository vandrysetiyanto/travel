#!/usr/bin/env node
/**
 * Checkpoint WAL travel-app.
 *
 * WAL pernah mencapai 5,2 MB padahal database hanya 476 KB karena koneksi
 * aplikasi selalu hidup — SQLite menunda checkpoint sampai tidak ada pembaca.
 * Skrip ini dijalankan berkala (cron) untuk memangkas file -wal.
 *
 * TRUNCATE = salin semua isi WAL ke database lalu kosongkan filenya.
 * Pasif (aman): bila ada pembaca aktif, SQLite menunda dan melaporkan status
 * bukan-0; skrip tidak memaksa dan tidak mengganggu aplikasi.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';

const DB = '/root/travel-app/data/travel.db';
const WAL = DB + '-wal';

function ukuran(f) {
  try { return fs.statSync(f).size; } catch { return 0; }
}

const sebelum = ukuran(WAL);
const db = new Database(DB);
db.pragma('busy_timeout = 5000');

// PASSIVE dulu (tidak memblokir), lalu TRUNCATE bila memungkinkan.
let hasil;
try {
  hasil = db.pragma('wal_checkpoint(PASSIVE)');
  if (ukuran(WAL) > 1024 * 1024) {
    hasil = db.pragma('wal_checkpoint(TRUNCATE)');
  }
} catch (e) {
  console.error('checkpoint gagal:', e.message);
}
const integ = db.pragma('integrity_check', { simple: true });
db.close();

const sesudah = ukuran(WAL);
const stempel = new Date().toISOString().replace('T', ' ').slice(0, 19);
console.log(
  `[${stempel}] wal ${(sebelum / 1024).toFixed(0)}KB -> ${(sesudah / 1024).toFixed(0)}KB | integrity=${integ} | hasil=${JSON.stringify(hasil)}`,
);
if (integ !== 'ok') process.exit(1);
