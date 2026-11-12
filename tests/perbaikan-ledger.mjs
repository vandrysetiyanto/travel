#!/usr/bin/env node
/**
 * Perbaikan buku besar: lengkapi jurnal pembayaran yang hilang.
 *
 * Temuan: 5 pembayaran berstatus APPROVED (total Rp 55.500.000) tetapi hanya 1
 * yang punya baris ledger — dan baris itu pun hanya sisi DEBIT tanpa KREDIT.
 * Akibatnya neraca tidak seimbang (aset 18,5 jt vs ekuitas 0).
 *
 * Skrip ini melengkapi dengan jurnal standar penerimaan pembayaran:
 *     Dr  Kas & Bank (1-101)
 *         Cr  Pendapatan Paket Umroh (4-101)
 *
 * Idempoten: hanya menulis bila pasangan untuk pembayaran tersebut belum ada,
 * jadi aman dijalankan berulang. Memakai --dry-run untuk melihat rencana saja.
 */
import Database from 'better-sqlite3';
import path from 'node:path';

const DRY = process.argv.includes('--dry-run');
const DB = process.argv.find((a) => a.endsWith('.db')) || path.join('/root/travel-app', 'data/travel.db');

const db = new Database(DB);
db.pragma('foreign_keys = ON');

const akun = (kode) => db.prepare('SELECT id FROM chart_of_accounts WHERE coa_code = ?').get(kode)?.id ?? null;
const KAS = akun('1-101');
const PENDAPATAN = akun('4-101');

if (!KAS || !PENDAPATAN) {
  console.error('Akun 1-101 / 4-101 tidak ditemukan — batal.');
  process.exit(1);
}

console.log(`\nDatabase: ${DB}${DRY ? '  (DRY RUN — tidak menulis)' : ''}\n`);

// 1) Pembayaran APPROVED yang belum punya pasangan jurnal lengkap
/*
 * Memakai SUBQUERY, bukan SUM() di atas LEFT JOIN.
 * SUM(CASE ...) pada LEFT JOIN tetap mengembalikan 0 (bukan NULL) walau tidak
 * ada baris pasangan, sehingga COALESCE(...,0) tidak pernah bekerja dan semua
 * pembayaran terlihat "sudah lengkap" — itulah sebabnya perbaikan ini sempat
 * melaporkan "tidak ada yang perlu diperbaiki" padahal 4 pembayaran kosong.
 */
const pembayaran = db.prepare(`
  SELECT p.id, p.transaction_id, p.amount, p.receipt_number, p.created_at,
         (SELECT COALESCE(SUM(l.amount),0) FROM ledger l
           WHERE l.payment_id = p.id AND l.entry_type = 'DEBIT')  AS debit,
         (SELECT COALESCE(SUM(l.amount),0) FROM ledger l
           WHERE l.payment_id = p.id AND l.entry_type = 'CREDIT') AS kredit
    FROM payment_history p
   WHERE p.status = 'APPROVED'
   ORDER BY p.id
`).all();

const tulis = db.prepare(`
  INSERT INTO ledger (entry_date, coa_account_id, entry_type, amount, description, reference,
                      transaction_id, expense_id, journal_id, payment_id)
  VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, ?)
`);

let ditulis = 0;
const rencana = [];

const proses = db.transaction(() => {
  for (const p of pembayaran) {
    const nominal = Number(p.amount) || 0;
    const tgl = String(p.created_at || '').slice(0, 10) || new Date().toISOString().slice(0, 10);
    const ref = p.receipt_number || `PAY-${p.id}`;
    const ket = `Pembayaran jamaah (perbaikan jurnal) — ${ref}`;

    const perluDebit = Number(p.debit) < nominal;
    const perluKredit = Number(p.kredit) < nominal;

    if (!perluDebit && !perluKredit) continue;

    if (perluDebit) {
      const kurang = nominal - Number(p.debit);
      rencana.push(`  + DEBIT  ${kurang.toLocaleString('id-ID').padStart(12)}  ${ref}  (pembayaran #${p.id})`);
      if (!DRY) {
        tulis.run(tgl, KAS, 'DEBIT', kurang, ket, ref, p.transaction_id, p.id);
      }
      ditulis++;
    }
    if (perluKredit) {
      const kurang = nominal - Number(p.kredit);
      rencana.push(`  + CREDIT ${kurang.toLocaleString('id-ID').padStart(12)}  ${ref}  (pembayaran #${p.id})`);
      if (!DRY) {
        tulis.run(tgl, PENDAPATAN, 'CREDIT', kurang, ket, ref, p.transaction_id, p.id);
      }
      ditulis++;
    }
  }
});

/* Loop selalu dijalankan agar DRY RUN tetap menyusun rencana; penulisan sudah dijaga if (!DRY). */
proses();

console.log('Rencana/kegiatan:');
if (!rencana.length) console.log('  (tidak ada yang perlu diperbaiki)');
else rencana.forEach((r) => console.log(r));

// 2) Ringkasan akhir
const totalDebit = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE entry_type='DEBIT'").get().s;
const totalKredit = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE entry_type='CREDIT'").get().s;
const yatim = db.prepare(`SELECT COUNT(*) c FROM ledger
  WHERE transaction_id IS NULL AND expense_id IS NULL AND journal_id IS NULL
    AND payment_id IS NULL AND handover_id IS NULL`).get().c;

console.log(`\n${DRY ? 'Akan ditulis' : 'Ditulis'}: ${ditulis} baris ledger`);
console.log(`Total DEBIT  : Rp ${Number(totalDebit).toLocaleString('id-ID')}`);
console.log(`Total KREDIT : Rp ${Number(totalKredit).toLocaleString('id-ID')}`);
console.log(`Selisih      : Rp ${(Number(totalDebit) - Number(totalKredit)).toLocaleString('id-ID')}`);
console.log(`Baris tanpa sumber (yatim): ${yatim}`);
console.log(Number(totalDebit) === Number(totalKredit) ? '\n✅ BUKU BESAR SEIMBANG' : '\n⚠️  masih belum seimbang');

db.close();
