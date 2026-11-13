#!/usr/bin/env node
/**
 * Audit integritas DATABASE travel-app (read-only).
 * Fokus: hal-hal yang membuat data produksi rusak/tidak bisa dipercaya.
 */
import Database from 'better-sqlite3';

const DB = '/root/travel-app/data/travel.db';
const db = new Database(DB, { readonly: true });

const hasil = [];
const catat = (tingkat, judul, detail) => { hasil.push({ tingkat, judul, detail }); };

console.log('=== 1. TABEL & RELASI ===');
const tabel = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name").all().map(r => r.name);
console.log(`  total tabel: ${tabel.length}`);

let tanpaPk = [], tanpaFk = [];
for (const t of tabel) {
  const info = db.prepare(`PRAGMA table_info(${t})`).all();
  const pk = info.filter(c => c.pk > 0);
  if (!pk.length) tanpaPk.push(t);
  const fk = db.prepare(`PRAGMA foreign_key_list(${t})`).all();
  if (!fk.length) tanpaFk.push(t);
}
console.log(`  tanpa PRIMARY KEY: ${tanpaPk.length ? tanpaPk.join(', ') : 'tidak ada'}`);
console.log(`  tanpa FOREIGN KEY: ${tanpaFk.length ? tanpaFk.length + ' tabel -> ' + tanpaFk.join(', ') : 'tidak ada'}`);
if (tanpaPk.length) catat('tinggi', 'Tabel tanpa PRIMARY KEY', tanpaPk.join(', '));

console.log('\n=== 2. INTEGRITAS & FOREIGN KEY ===');
console.log('  integrity_check :', db.pragma('integrity_check', { simple: true }));
const fkErr = db.pragma('foreign_key_check');
console.log('  foreign_key_check:', fkErr.length ? JSON.stringify(fkErr).slice(0, 300) : 'bersih (0)');
if (fkErr.length) catat('kritis', 'Pelanggaran foreign key', `${fkErr.length} baris`);

console.log('\n=== 3. KOLOM TANPA NOT NULL / DEFAULT BERISIKO ===');
for (const t of ['transactions', 'payment_history', 'ledger', 'master_jamaah', 'inventory_items']) {
  const info = db.prepare(`PRAGMA table_info(${t})`).all();
  const nullable = info.filter(c => !c.notnull && c.dflt_value === null && c.pk === 0).map(c => c.name);
  if (nullable.length) console.log(`  ${t}: ${nullable.join(', ')}`);
}

console.log('\n=== 4. DATA YATIM (orphan) ===');
const cekOrphan = (label, sql) => {
  const n = db.prepare(sql).get().c;
  console.log(`  ${label.padEnd(46)} ${n}`);
  if (n > 0) catat('tinggi', `Data yatim: ${label}`, `${n} baris`);
  return n;
};
cekOrphan('transactions tanpa jamaah', 'SELECT COUNT(*) c FROM transactions t LEFT JOIN master_jamaah j ON j.id=t.jamaah_id WHERE j.id IS NULL');
cekOrphan('transactions tanpa batch', 'SELECT COUNT(*) c FROM transactions t LEFT JOIN batches b ON b.id=t.batch_id WHERE b.id IS NULL');
cekOrphan('payment_history tanpa transaksi', 'SELECT COUNT(*) c FROM payment_history p LEFT JOIN transactions t ON t.id=p.transaction_id WHERE t.id IS NULL');
cekOrphan('ledger tanpa akun COA', 'SELECT COUNT(*) c FROM ledger l LEFT JOIN chart_of_accounts a ON a.id=l.coa_account_id WHERE a.id IS NULL');
cekOrphan('ledger tanpa sumber (semua kolom null)', 'SELECT COUNT(*) c FROM ledger WHERE transaction_id IS NULL AND expense_id IS NULL AND journal_id IS NULL AND payment_id IS NULL AND handover_id IS NULL');
cekOrphan('booking_jamaah tanpa transaksi', 'SELECT COUNT(*) c FROM booking_jamaah bj LEFT JOIN transactions t ON t.id=bj.transaction_id WHERE t.id IS NULL');
cekOrphan('jamaah_checklist tanpa master', 'SELECT COUNT(*) c FROM jamaah_checklist jc LEFT JOIN checklist_master cm ON cm.id=jc.checklist_master_id WHERE cm.id IS NULL');
cekOrphan('inventory_handover tanpa item', 'SELECT COUNT(*) c FROM inventory_handover h LEFT JOIN inventory_items i ON i.id=h.item_id WHERE i.id IS NULL');

console.log('\n=== 5. KONSISTENSI ANGKA UANG ===');
const tx = db.prepare('SELECT id, booking_code, total_amount, paid_amount, remaining_amount FROM transactions').all();
let driftTotal = 0, driftSisa = 0;
for (const t of tx) {
  const sum = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM payment_history WHERE transaction_id=? AND status='APPROVED'").get(t.id).s;
  if (Number(sum) !== Number(t.paid_amount)) driftTotal++;
  if (Number(t.total_amount) - Number(t.paid_amount) !== Number(t.remaining_amount)) driftSisa++;
}
console.log(`  transaksi diperiksa                        ${tx.length}`);
console.log(`  paid_amount != SUM(payment APPROVED)       ${driftTotal}`);
console.log(`  total-paid != remaining (rumus tidak jalan) ${driftSisa}`);
if (driftTotal) catat('kritis', 'paid_amount tidak sama dengan jumlah pembayaran', `${driftTotal} transaksi`);
if (driftSisa) catat('tinggi', 'remaining_amount tidak konsisten', `${driftSisa} transaksi`);

const lebih = db.prepare('SELECT COUNT(*) c FROM transactions WHERE paid_amount > total_amount').get().c;
console.log(`  paid_amount > total_amount (lebih bayar)   ${lebih}`);
if (lebih) catat('kritis', 'Lebih bayar tersimpan', `${lebih} transaksi`);

console.log('\n=== 6. NERACA SEIMBANG? ===');
const g = db.prepare("SELECT COALESCE(SUM(CASE WHEN entry_type='DEBIT' THEN amount ELSE 0 END),0) d, COALESCE(SUM(CASE WHEN entry_type='CREDIT' THEN amount ELSE 0 END),0) k FROM ledger").get();
console.log(`  total DEBIT  : ${Number(g.d).toLocaleString('id-ID')}`);
console.log(`  total KREDIT : ${Number(g.k).toLocaleString('id-ID')}`);
console.log(`  selisih      : ${(g.d - g.k).toLocaleString('id-ID')}`);
if (g.d !== g.k) catat('kritis', 'Buku besar tidak seimbang', `selisih ${g.d - g.k}`);

console.log('\n=== 7. INDEKS UNTUK QUERY LAPORAN ===');
const idxPerlu = [
  ['ledger', 'entry_date'], ['ledger', 'coa_account_id'], ['payment_history', 'status'],
  ['transactions', 'batch_id'], ['transactions', 'jamaah_id'], ['transactions', 'status'],
  ['booking_jamaah', 'jamaah_id'], ['jamaah_checklist', 'jamaah_id'], ['audit_log', 'created_at'],
];
for (const [t, k] of idxPerlu) {
  const idx = db.prepare(`PRAGMA index_list(${t})`).all();
  let ada = false;
  for (const i of idx) {
    const kol = db.prepare(`PRAGMA index_info(${i.name})`).all().map(c => c.name);
    if (kol[0] === k) { ada = true; break; }
  }
  if (!ada) { console.log(`  ❌ ${t}.${k}`); catat('sedang', `Tidak ada indeks ${t}.${k}`, 'query laporan bisa lambat saat data besar'); }
  else console.log(`  ✅ ${t}.${k}`);
}

console.log('\n=== 8. UKURAN & PERTUMBUHAN ===');
const fs = await import('node:fs');
for (const f of ['data/travel.db', 'data/travel.db-wal']) {
  try { console.log(`  ${f}: ${(fs.statSync('/root/travel-app/' + f).size / 1024).toFixed(0)} KB`); } catch {}
}
const jml = {};
for (const t of ['master_jamaah', 'transactions', 'payment_history', 'ledger', 'audit_log']) {
  try { jml[t] = db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c; } catch {}
}
console.log('  baris:', JSON.stringify(jml));

console.log('\n=== 9. KOLOM TEKS YANG SEHARUSNYA RELASI ===');
for (const [t, k] of [['transactions', 'jamaah_id'], ['payment_history', 'transaction_id'], ['booking_jamaah', 'jamaah_id']]) {
  const info = db.prepare(`PRAGMA table_info(${t})`).all().find(c => c.name === k);
  if (info) console.log(`  ${t}.${k}: ${info.type}`);
}

db.close();

console.log('\n=== TEMUAN ===');
if (!hasil.length) console.log('  (tidak ada)');
for (const h of hasil) console.log(`  [${h.tingkat}] ${h.judul} — ${h.detail}`);
