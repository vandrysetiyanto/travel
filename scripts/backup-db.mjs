#!/usr/bin/env node
/**
 * Skrip Backup Otomatis Database Travel App via Node.js (better-sqlite3)
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const BACKUP_DIR = '/root/.hermes/backups/daily';
const DB_PATH = '/root/travel-app/data/travel.db';
const ts = new Date().toISOString().replace(/[-:T]/g, '').slice(0, 14);
const outFile = path.join(BACKUP_DIR, `travel-${ts}.db`);

if (!fs.existsSync(DB_PATH)) {
  console.error(`ERROR: Database ${DB_PATH} tidak ditemukan!`);
  process.exit(1);
}

try {
  const db = new Database(DB_PATH, { readonly: true });
  const check = db.pragma('integrity_check', { simple: true });
  db.close();

  if (check !== 'ok') {
    console.error(`ERROR: Gagal backup, integrity_check menghasilkan: ${check}`);
    process.exit(1);
  }

  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.copyFileSync(DB_PATH, outFile);
  console.log(`[${ts}] Backup sukses: ${outFile}`);

  // Hapus backup lama, sisakan 30 terakhir
  const files = fs.readdirSync(BACKUP_DIR)
    .filter(f => f.startsWith('travel-') && f.endsWith('.db'))
    .map(f => ({ name: f, time: fs.statSync(path.join(BACKUP_DIR, f)).mtime.getTime() }))
    .sort((a, b) => b.time - a.time);

  if (files.length > 30) {
    for (const old of files.slice(30)) {
      fs.unlinkSync(path.join(BACKUP_DIR, old.name));
      console.log(`Menghapus backup lama: ${old.name}`);
    }
  }
} catch (err) {
  console.error('ERROR saat backup:', err.message);
  process.exit(1);
}
