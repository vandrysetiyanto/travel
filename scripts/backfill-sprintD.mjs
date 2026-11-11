#!/usr/bin/env node
/**
 * Backfill idempoten: tautkan data lama ke id, tanpa menghapus apa pun.
 *
 * Aturan pencocokan dibuat KETAT (tanggal + nominal + akun), karena data lama
 * tidak menyimpan tautan sehingga pencocokan longgar berisiko salah tempel.
 * Bila tidak ada kandidat yang unik, baris dibiarkan (akan dibersihkan pada
 * reset data sesuai keputusan pemilik).
 *
 *  1. booking_jamaah dari group_code (kode booking) untuk data lama
 *  2. ledger.journal_id  : cocokkan tanggal + nominal + akun debit/kredit
 *  3. ledger.payment_id  : cocokkan nominal + tanggal + kode kuitansi
 *  4. status 'WAITING_APPROVAL' -> 'PENDING'
 */
import Database from 'better-sqlite3';

const db = new Database(process.argv[2] || '/root/travel-app/data/travel.db');
db.pragma('foreign_keys = ON');

const r = { bj: 0, journal: 0, payment: 0, status: 0 };

console.log('\n[1] booking_jamaah dari group_code');
const txs = db.prepare('SELECT id, booking_code, jamaah_id FROM transactions').all();
const insBJ = db.prepare(`INSERT INTO booking_jamaah (transaction_id, jamaah_id, peran, urutan) VALUES (?,?,?,?)
                          ON CONFLICT(transaction_id, jamaah_id) DO NOTHING`);
for (const t of txs) {
  const anggota = db.prepare(`SELECT id FROM master_jamaah WHERE group_code = ? AND group_code IS NOT NULL ORDER BY id ASC`).all(t.booking_code);
  const ids = new Set([t.jamaah_id, ...anggota.map((a) => a.id)]);
  let urut = 1;
  for (const jid of ids) {
    if (!jid) continue;
    const ada = db.prepare('SELECT 1 FROM booking_jamaah WHERE transaction_id=? AND jamaah_id=?').get(t.id, jid);
    insBJ.run(t.id, jid, jid === t.jamaah_id ? 'LEADER' : 'ANGGOTA', urut++);
    if (!ada) r.bj++;
  }
}
console.log(`    +${r.bj} tautan`);

console.log('\n[2] ledger.journal_id (tanggal + nominal + akun)');
const setJ = db.prepare('UPDATE ledger SET journal_id = ? WHERE id = ?');
for (const j of db.prepare('SELECT * FROM general_journals').all()) {
  const d = db.prepare(`SELECT id FROM ledger WHERE journal_id IS NULL AND entry_date = ? AND amount = ?
                        AND entry_type = 'DEBIT' AND coa_account_id = ?`).all(j.journal_date, j.amount, j.debit_coa_id);
  const k = db.prepare(`SELECT id FROM ledger WHERE journal_id IS NULL AND entry_date = ? AND amount = ?
                        AND entry_type = 'CREDIT' AND coa_account_id = ?`).all(j.journal_date, j.amount, j.credit_coa_id);
  if (d.length === 1 && k.length === 1) {
    db.transaction(() => { setJ.run(j.id, d[0].id); setJ.run(j.id, k[0].id); })();
    r.journal += 2;
    console.log(`    jurnal #${j.id} (${j.reference_no}) -> ledger ${d[0].id}, ${k[0].id}`);
  } else {
    console.log(`    jurnal #${j.id} (${j.reference_no}) DILEWATI (kandidat debit=${d.length}, kredit=${k.length})`);
  }
}

console.log('\n[3] ledger.payment_id (nominal + tanggal + kuitansi)');
const setP = db.prepare('UPDATE ledger SET payment_id = ?, transaction_id = COALESCE(transaction_id, ?) WHERE id = ?');
for (const p of db.prepare("SELECT * FROM payment_history WHERE status = 'APPROVED'").all()) {
  const tgl = String(p.created_at || '').slice(0, 10);
  const kand = db.prepare(`SELECT id FROM ledger WHERE payment_id IS NULL AND entry_type = 'DEBIT'
                           AND amount = ? AND entry_date = ? AND description LIKE '%' || ? || '%'`)
    .all(p.amount, tgl, p.receipt_number);
  if (kand.length === 1) {
    db.transaction(() => setP.run(p.id, p.transaction_id, kand[0].id))();
    r.payment++;
  }
}
console.log(`    +${r.payment} baris bertaut payment_id`);

console.log('\n[4] status lama WAITING_APPROVAL -> PENDING');
r.status = db.prepare("UPDATE payment_history SET status='PENDING' WHERE status='WAITING_APPROVAL'").run().changes;
console.log(`    ${r.status} baris`);

const total = db.prepare('SELECT COUNT(*) c FROM ledger').get().c;
const yatim = db.prepare(`SELECT COUNT(*) c FROM ledger WHERE transaction_id IS NULL AND expense_id IS NULL
                          AND journal_id IS NULL AND payment_id IS NULL`).get().c;
console.log(`\nledger total ${total}, tanpa tautan ${yatim}`);
console.log(`SELESAI: bj +${r.bj}, journal +${r.journal}, payment +${r.payment}, status ${r.status}`);
db.close();
