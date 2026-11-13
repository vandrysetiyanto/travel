#!/usr/bin/env node
/**
 * Uji #4: migration framework.
 * Memastikan versi skema terlacak, hanya migrasi tertunda yang jalan, dan
 * migrasi yang gagal tidak menaikkan versi.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';

const ASLI = '/root/travel-app/data/travel.db';
const UJI = '/tmp/uji-migrasi.db';
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(ASLI + s)) fs.copyFileSync(ASLI + s, UJI + s);

const { jalankanMigrasi, versiSkema, MIGRATIONS } = await import('/root/travel-app/lib/migrasi.ts');

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

const db = new Database(UJI);
db.pragma('foreign_keys = ON');

console.log('\n[1] Database asli sebelum migrasi');
console.log(`  user_version: ${versiSkema(db)}`);

console.log('\n[2] Jalankan migrasi (idempoten dari kondisi apa pun)');
/*
 * Uji ini tidak boleh mengasumsikan database SALINAN masih versi 0: database
 * produksi sudah lama naik ke versi 1 oleh boot aplikasi. Yang diuji adalah
 * sifat idempotennya — setelah dijalankan, versi harus >= 1 dan tidak ada
 * migrasi yang diulang pada pemanggilan kedua.
 */
const h1 = jalankanMigrasi(db);
cek('versi >= 1 setelah migrasi', h1.ke >= 1, JSON.stringify(h1));
const sudahAda = db.prepare('SELECT COUNT(*) c FROM schema_migrations WHERE nomor=1').get().c;
cek('migrasi 1 tercatat (dijalankan atau sudah ada)', sudahAda === 1, `catatan=${sudahAda}, dijalankan=${h1.dijalankan.join(',')}`);

console.log('\n[3] Tabel schema_migrations terbentuk');
const baris = db.prepare('SELECT nomor, nama FROM schema_migrations ORDER BY nomor').all();
cek('ada catatan migrasi', baris.length === 1, JSON.stringify(baris));
cek('nama migrasi tersimpan', baris[0]?.nama === 'baseline-skema-awal');

console.log('\n[4] Jalankan ulang -> tidak mengulang migrasi');
const h2 = jalankanMigrasi(db);
cek('tidak ada migrasi dijalankan lagi', h2.dijalankan.length === 0, h2.dijalankan.join(','));
cek('versi tetap 1', h2.ke === 1, String(h2.ke));
cek('catatan tidak dobel', db.prepare('SELECT COUNT(*) c FROM schema_migrations').get().c === 1);

console.log('\n[5] Struktur tabel tetap utuh setelah migrasi');
/*
 * Yang diuji adalah SKEMA, bukan jumlah baris: setelah reset data dummy,
 * jumlah baris transaksi/ledger memang 0 — bukan tanda kerusakan.
 */
const kolomTx = db.prepare('PRAGMA table_info(transactions)').all().map(c => c.name);
const kolomLedger = db.prepare('PRAGMA table_info(ledger)').all().map(c => c.name);
cek('tabel transactions masih punya kolom inti',
  ['id','booking_code','jamaah_id','total_amount','status'].every(k => kolomTx.includes(k)), kolomTx.join(','));
cek('tabel ledger masih punya kolom inti',
  ['id','coa_account_id','entry_type','amount','entry_date'].every(k => kolomLedger.includes(k)), kolomLedger.join(','));
cek('integrity ok', db.pragma('integrity_check', { simple: true }) === 'ok');

console.log('\n[6] Migrasi GAGAL tidak menaikkan versi');
// tambahkan migrasi sementara yang sengaja error
MIGRATIONS.push({ nomor: 99, nama: 'uji-sengaja-gagal', jalankan: () => { throw new Error('gagal disengaja'); } });
let melempar = false;
try { jalankanMigrasi(db); } catch { melempar = true; }
cek('error migrasi diteruskan', melempar);
cek('versi TIDAK naik ke 99', versiSkema(db) === 1, String(versiSkema(db)));
cek('migrasi gagal tidak tercatat', db.prepare('SELECT COUNT(*) c FROM schema_migrations WHERE nomor=99').get().c === 0);

db.close();
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(UJI + s)) fs.unlinkSync(UJI + s);

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG MIGRASI LULUS');
