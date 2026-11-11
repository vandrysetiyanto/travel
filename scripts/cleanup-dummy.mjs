#!/usr/bin/env node
/**
 * Pembersihan data dummy (persetujuan pemilik: "hapus saja untuk data dummy,
 * nanti kita lakukan reset").
 *
 * Yang dihapus HANYA data uji yang jelas ditandai sebagai test/dummy:
 *   - expenses berdeskripsi 'test' / 'Test ...' beserta baris ledger-nya
 *   - general_journals ber-reference 'JRN-TEST' beserta baris ledger-nya
 *   - ledger yatim (tanpa tautan apa pun) yang tersisa
 * Data transaksi/jamaah nyata TIDAK disentuh.
 *
 * Sebelum menghapus, ledger yang masih bisa ditautkan (nominal + tanggal +
 * kode booking pada deskripsi) ditautkan lebih dulu supaya tidak ikut terhapus.
 */
import Database from 'better-sqlite3';

const db = new Database(process.argv[2] || '/root/travel-app/data/travel.db');
db.pragma('foreign_keys = ON');
const r = { taut: 0, expense: 0, ledgerDariExpense: 0, jurnal: 0, ledgerYatim: 0 };

console.log('\n[A] Tautkan ledger lama ke pembayaran bila deskripsinya memuat kode booking');
const pays = db.prepare("SELECT * FROM payment_history WHERE status = 'APPROVED'").all();
for (const p of pays) {
  const tx = db.prepare('SELECT booking_code FROM transactions WHERE id = ?').get(p.transaction_id);
  if (!tx?.booking_code) continue;
  const kand = db.prepare(`SELECT id FROM ledger WHERE payment_id IS NULL AND entry_type = 'DEBIT'
                           AND amount = ? AND description LIKE '%' || ? || '%'`)
    .all(p.amount, tx.booking_code);
  if (kand.length === 1) {
    db.prepare('UPDATE ledger SET payment_id = ?, transaction_id = COALESCE(transaction_id, ?) WHERE id = ?')
      .run(p.id, p.transaction_id, kand[0].id);
    r.taut++;
    console.log(`    ledger #${kand[0].id} -> payment #${p.id} (${tx.booking_code}, Rp ${p.amount.toLocaleString('id-ID')})`);
  }
}

console.log('\n[B] Hapus expenses dummy (deskripsi test)');
const dummyExp = db.prepare(`SELECT id FROM expenses
  WHERE lower(description) LIKE 'test%' OR lower(description) = 'test'`).all();
for (const e of dummyExp) {
  const l = db.prepare('DELETE FROM ledger WHERE expense_id = ?').run(e.id).changes;
  db.prepare('DELETE FROM expenses WHERE id = ?').run(e.id);
  r.expense++; r.ledgerDariExpense += l;
  console.log(`    expense #${e.id} dihapus (ledger terkait: ${l})`);
}

console.log('\n[C] Hapus jurnal dummy (reference JRN-TEST)');
const dummyJ = db.prepare("SELECT id FROM general_journals WHERE reference_no LIKE 'JRN-TEST%'").all();
for (const j of dummyJ) {
  db.prepare('DELETE FROM ledger WHERE journal_id = ?').run(j.id);
  db.prepare('DELETE FROM general_journals WHERE id = ?').run(j.id);
  r.jurnal++;
  console.log(`    jurnal #${j.id} dihapus`);
}

console.log('\n[D] Hapus sisa ledger yatim');
const yatim = db.prepare(`SELECT id, amount, description FROM ledger
  WHERE transaction_id IS NULL AND expense_id IS NULL AND journal_id IS NULL AND payment_id IS NULL`).all();
for (const l of yatim) {
  db.prepare('DELETE FROM ledger WHERE id = ?').run(l.id);
  r.ledgerYatim++;
  console.log(`    ledger #${l.id} Rp ${Number(l.amount).toLocaleString('id-ID')} "${l.description}" dihapus`);
}

const sisa = db.prepare('SELECT COUNT(*) c FROM ledger').get().c;
const sisaYatim = db.prepare(`SELECT COUNT(*) c FROM ledger
  WHERE transaction_id IS NULL AND expense_id IS NULL AND journal_id IS NULL AND payment_id IS NULL`).get().c;
console.log(`\nSELESAI: taut ${r.taut}, expense ${r.expense}, jurnal ${r.jurnal}, ledger yatim ${r.ledgerYatim}`);
console.log(`ledger tersisa ${sisa}, di antaranya tanpa tautan ${sisaYatim}`);
db.close();
