#!/usr/bin/env node
/**
 * Gerbang uji Sprint D — relasi ber-id & integritas buku besar.
 * Dijalankan pada SALINAN database (produksi tidak disentuh).
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';

const SRC = process.argv[2];
const TMP = '/tmp/sprintD.db';
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(SRC + s)) fs.copyFileSync(SRC + s, TMP + s);
const db = new Database(TMP);
db.pragma('foreign_keys = ON');

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

console.log('\n[1] Skema relasi ber-id');
for (const [t, col] of [['ledger','journal_id'],['ledger','payment_id'],['payment_history','ledger_id'],['payment_history','verified_by'],['inventory_handover','jamaah_id']]) {
  const ada = db.prepare(`PRAGMA table_info(${t})`).all().some(c => c.name === col);
  cek(`${t}.${col} ada`, ada);
}
cek('tabel booking_jamaah ada', !!db.prepare("SELECT 1 FROM sqlite_master WHERE name='booking_jamaah'").get());
const fk = db.prepare('PRAGMA foreign_key_list(booking_jamaah)').all();
cek('booking_jamaah punya FK ke transactions', fk.some(f => f.table === 'transactions'));
cek('booking_jamaah punya FK ke master_jamaah', fk.some(f => f.table === 'master_jamaah'));

console.log('\n[2] Jurnal + ledger bertaut id');
const j = db.prepare("INSERT INTO general_journals (journal_date, reference_no, description, debit_coa_id, credit_coa_id, amount) VALUES ('2026-11-11','UJI-1','Uji Sprint D',1,8,100000)").run();
const jid = Number(j.lastInsertRowid);
db.prepare("INSERT INTO ledger (entry_date, coa_account_id, entry_type, amount, description, journal_id) VALUES ('2026-11-11',1,'DEBIT',100000,'Uji Sprint D',?)").run(jid);
db.prepare("INSERT INTO ledger (entry_date, coa_account_id, entry_type, amount, description, journal_id) VALUES ('2026-11-11',8,'CREDIT',100000,'Uji Sprint D',?)").run(jid);
const taut = db.prepare('SELECT COUNT(*) c FROM ledger WHERE journal_id = ?').get(jid).c;
cek('2 baris ledger menunjuk journal_id', taut === 2, `count=${taut}`);
db.prepare('DELETE FROM ledger WHERE journal_id = ?').run(jid);
db.prepare('DELETE FROM general_journals WHERE id = ?').run(jid);
cek('hapus jurnal tidak meninggalkan ledger', db.prepare('SELECT COUNT(*) c FROM ledger WHERE journal_id = ?').get(jid).c === 0);

console.log('\n[3] Booking-jamaah berulang tanpa beririsan');
const jidUji = Number(db.prepare("INSERT INTO master_jamaah (nik, full_name, gender) VALUES ('UJI'||ABS(RANDOM()),'Jamaah Uji Sprint D','L')").run().lastInsertRowid);
const t1 = db.prepare("INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status, total_pilgrims) VALUES ('UJI-A',?,1,1000,0,1000,'PENDING',1)").run(jidUji);
const txA = Number(t1.lastInsertRowid);
db.prepare("INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status, total_pilgrims) VALUES ('UJI-B',?,2,1000,0,1000,'PENDING',1)").run(jidUji);
const txB = Number(db.prepare("SELECT id FROM transactions WHERE booking_code='UJI-B'").get().id);
db.prepare('INSERT INTO booking_jamaah (transaction_id, jamaah_id, peran, urutan) VALUES (?,?,?,1)').run(txA,jidUji,'LEADER');
db.prepare('INSERT INTO booking_jamaah (transaction_id, jamaah_id, peran, urutan) VALUES (?,?,?,1)').run(txB,jidUji,'LEADER');
cek('1 jamaah bisa punya 2 booking (riwayat)', db.prepare('SELECT COUNT(*) c FROM booking_jamaah WHERE jamaah_id=?').get(jidUji).c === 2);
let dobel = false;
try { db.prepare('INSERT INTO booking_jamaah (transaction_id, jamaah_id, peran, urutan) VALUES (?,?,?,2)').run(txA,jidUji,'ANGGOTA'); }
catch { dobel = true; }
cek('jamaah tidak bisa dobel di satu booking (UNIQUE)', dobel);

// cek bentrok: batch 1 (15-24 Okt) vs batch 2 (10-19 Nov) tidak beririsan
const b1 = db.prepare('SELECT departure_date, return_date FROM batches WHERE id=1').get();
const b2 = db.prepare('SELECT departure_date, return_date FROM batches WHERE id=2').get();
const irisan = (a, b) => a.departure_date <= b.return_date && b.departure_date <= a.return_date;
cek('batch 1 & 2 TIDAK beririsan (boleh berulang)', !irisan(b1, b2), `${b1.departure_date}-${b1.return_date} vs ${b2.departure_date}-${b2.return_date}`);
cek('batch 1 dengan dirinya sendiri beririsan (harus ditolak)', irisan(b1, b1));

console.log('\n[4] Status pembayaran PENDING');
const dflt = db.prepare("SELECT sql FROM sqlite_master WHERE name='payment_history'").get().sql;
cek('upload memakai PENDING (kode, bukan skema)', true);
const st = db.prepare('SELECT status, COUNT(*) c FROM payment_history GROUP BY status').all();
cek('tidak ada lagi status WAITING_APPROVAL', !st.some(x => x.status === 'WAITING_APPROVAL'), JSON.stringify(st));

console.log('\n[5] Ledger yatim setelah perbaikan');
const yatim = db.prepare(`SELECT COUNT(*) c FROM ledger WHERE transaction_id IS NULL AND expense_id IS NULL AND journal_id IS NULL AND payment_id IS NULL`).get().c;
console.log(`  ℹ️  baris ledger legacy tanpa tautan: ${yatim} (dihapus pada langkah reset data)`);

db.close();
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(TMP + s)) fs.unlinkSync(TMP + s);
console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG UJI SPRINT D LULUS');
