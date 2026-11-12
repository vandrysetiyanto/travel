#!/usr/bin/env node
/**
 * QA bagian 3: RACE CONDITION pada kuota batch.
 *
 * Pola "cek dulu, tulis kemudian" (check-then-act) tanpa transaksi akan lolos
 * bila banyak pendaftaran datang bersamaan: semua membaca kuota yang sama,
 * semua merasa masih muat, lalu semuanya tersimpan -> overbooking.
 *
 * Uji ini menembakkan banyak pendaftaran SERENTAK ke batch berkuota ketat.
 */
import Database from 'better-sqlite3';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';

const db = new Database(DB);
db.pragma('foreign_keys = ON');

// Siapkan batch khusus dengan kuota 2
let paket = db.prepare('SELECT id FROM packages ORDER BY id LIMIT 1').get();
if (!paket) {
  db.prepare("INSERT INTO packages (name, price, duration_days) VALUES ('Paket Race', 10000000, 9)").run();
  paket = db.prepare('SELECT id FROM packages ORDER BY id DESC LIMIT 1').get();
}
const namaBatch = 'RACE-' + Date.now().toString().slice(-6);
const b = db.prepare(`INSERT INTO batches (batch_name, package_id, departure_date, return_date, quota, status)
                      VALUES (?,?,?,?,2,'OPEN')`).run(namaBatch, paket.id, '2027-06-01', '2027-06-10');
const batchId = Number(b.lastInsertRowid);
console.log(`\nBatch uji: ${namaBatch} (id ${batchId}) — KUOTA HANYA 2 ORANG`);

// 10 pendaftaran serentak, masing-masing 1 jamaah
function form(i) {
  return JSON.stringify({
    batch_id: batchId,
    applicant_name: `Race ${i}`,
    applicant_phone: '0812000000' + i,
    applicant_email: `race${i}@uji.local`,
    pilgrims: [{ full_name: `Race Jamaah ${i}`, nik: String('9999' + Date.now().toString().slice(-8) + String(i).padStart(4, '0')).slice(0, 16), gender: 'L' }],
  });
}

const dikirim = 10;
console.log(`Mengirim ${dikirim} pendaftaran SERENTAK (kuota hanya 2)...\n`);

const hasil = await Promise.all(
  Array.from({ length: dikirim }, (_, i) =>
    fetch(`${BASE}/api/register`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: form(i) })
      .then(async (r) => ({ i, status: r.status, body: await r.json().catch(() => ({})) }))
      .catch((e) => ({ i, status: 0, body: { message: e.message } })),
  ),
);

const sukses = hasil.filter((h) => h.status === 200 && h.body.success);
const ditolak = hasil.filter((h) => !(h.status === 200 && h.body.success));

console.log('Hasil per permintaan:');
for (const h of hasil.sort((a, b) => a.i - b.i)) {
  console.log(`  #${String(h.i).padStart(2)}  HTTP ${String(h.status).padEnd(3)}  ${h.body.success ? '✅ DITERIMA' : '⛔ ditolak — ' + (h.body.message || '').slice(0, 60)}`);
}

// Hitung yang benar-benar tersimpan
const tersimpan = db.prepare(`SELECT COALESCE(SUM(total_pilgrims),0) n, COUNT(*) c FROM transactions
                              WHERE batch_id=? AND status != 'CANCELLED'`).get(batchId);

console.log(`\nKuota batch        : 2`);
console.log(`Diterima (respons) : ${sukses.length}`);
console.log(`Jamaah tersimpan   : ${tersimpan.n} dalam ${tersimpan.c} transaksi`);

const overbooking = tersimpan.n > 2;
console.log(`\n${overbooking ? '🔴 OVERBOOKING TERJADI' : '✅ kuota terjaga'}`);

// bersihkan
const txs = db.prepare('SELECT id, jamaah_id FROM transactions WHERE batch_id=?').all(batchId);
for (const t of txs) {
  db.prepare('DELETE FROM ledger WHERE transaction_id=?').run(t.id);
  db.prepare('DELETE FROM payment_history WHERE transaction_id=?').run(t.id);
  db.prepare('DELETE FROM booking_jamaah WHERE transaction_id=?').run(t.id);
  db.prepare('DELETE FROM transactions WHERE id=?').run(t.id);
  db.prepare('DELETE FROM master_jamaah WHERE id=?').run(t.jamaah_id);
}
db.prepare('DELETE FROM batches WHERE id=?').run(batchId);
db.close();
console.log('\nData uji dibersihkan.');
