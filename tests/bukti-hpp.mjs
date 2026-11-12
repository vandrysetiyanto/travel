#!/usr/bin/env node
/**
 * Bukti HPP: serahkan beberapa perlengkapan ke jamaah demo, lalu periksa
 * jurnal yang benar-benar terbentuk di ledger.
 */
import Database from 'better-sqlite3';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';

const db = new Database(DB);
db.pragma('foreign_keys = ON');

// ── data demo ──
const nik = 'DEMO' + Date.now().toString().slice(-9);
const jm = db.prepare('INSERT INTO master_jamaah (nik,full_name,phone,address,gender) VALUES (?,?,?,?,?)')
  .run(nik, 'Demo HPP', '0800000000', '-', 'L');
const jamaahId = Number(jm.lastInsertRowid);

let batch = db.prepare('SELECT id, departure_date, return_date FROM batches ORDER BY id LIMIT 1').get();
if (!batch) {
  const pk = db.prepare("SELECT id FROM packages ORDER BY id LIMIT 1").get()
    || db.prepare("INSERT INTO packages (name, price, duration_days) VALUES ('Paket Demo', 25000000, 9)").run();
  const pid = pk.id || Number(pk.lastInsertRowid);
  const b = db.prepare("INSERT INTO batches (batch_name, package_id, departure_date, return_date, quota, status) VALUES ('Batch Demo',?,?,?,20,'OPEN')")
    .run(pid, '2027-01-10', '2027-01-19');
  batch = { id: Number(b.lastInsertRowid), departure_date: '2027-01-10', return_date: '2027-01-19' };
}

const tx = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                       VALUES (?,?,?,?,0,?,'PENDING')`)
  .run('DEMO-HPP-' + Date.now().toString().slice(-6), jamaahId, batch.id, 25000000, 25000000);
const txId = Number(tx.lastInsertRowid);
console.log(`\nData demo: jamaah #${jamaahId}, transaksi #${txId}`);

// ── login & serahkan barang ──
const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

const serah = [
  { code: 'BTK-01', qty: 2, label: 'Batik Seragam 2 meter' },
  { code: 'KPR-01', qty: 1, label: 'Koper 1 buah' },
  { code: 'IHR-01', qty: 1, label: 'Kain Ihram 1 buah' },
  { code: 'MKN-01', qty: 1, label: 'Mukena 1 set' },
  { code: 'TAS-01', qty: 1, label: 'Tas Paspor 1 buah' },
  { code: 'BUK-01', qty: 1, label: 'Buku Panduan 1 buah' },
];

console.log('\nPenyerahan perlengkapan:');
let totalHpp = 0;
for (const s of serah) {
  const item = db.prepare('SELECT id, name, unit_cost FROM inventory_items WHERE code=?').get(s.code);
  const stokAwal = db.prepare('SELECT stock_total FROM inventory_items WHERE id=?').get(item.id).stock_total;
  const r = await fetch(`${BASE}/api/admin/inventory`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'HANDOVER', transaction_id: txId, item_id: item.id, qty: s.qty, notes: s.label }),
  });
  const d = await r.json();
  const stokAkhir = db.prepare('SELECT stock_total FROM inventory_items WHERE id=?').get(item.id).stock_total;
  const harap = item.unit_cost * s.qty;
  const ok = Number(d.hpp) === harap && stokAkhir === stokAwal - s.qty;
  console.log(`  ${ok ? '✅' : '❌'} ${s.label.padEnd(24)} Rp ${Number(d.hpp).toLocaleString('id-ID').padStart(9)}  stok ${stokAwal}->${stokAkhir}`);
  totalHpp += Number(d.hpp) || 0;
}

// ── periksa jurnal ──
console.log('\nJurnal HPP yang terbentuk:');
const baris = db.prepare(`
  SELECT l.entry_type, l.amount, a.coa_code, a.coa_name, l.handover_id
  FROM ledger l JOIN chart_of_accounts a ON a.id = l.coa_account_id
  WHERE l.handover_id IS NOT NULL ORDER BY l.id`).all();
for (const b of baris) {
  console.log(`  ${b.entry_type.padEnd(6)} ${b.coa_code} ${b.coa_name.padEnd(30)} Rp ${b.amount.toLocaleString('id-ID').padStart(9)}  (handover #${b.handover_id})`);
}
const debit = baris.filter((b) => b.entry_type === 'DEBIT').reduce((a, b) => a + b.amount, 0);
const kredit = baris.filter((b) => b.entry_type === 'CREDIT').reduce((a, b) => a + b.amount, 0);

console.log(`\nTotal HPP diserahkan : Rp ${totalHpp.toLocaleString('id-ID')}`);
console.log(`Sisi DEBIT           : Rp ${debit.toLocaleString('id-ID')}`);
console.log(`Sisi KREDIT          : Rp ${kredit.toLocaleString('id-ID')}`);
console.log(`Seimbang             : ${debit === kredit && debit === totalHpp ? 'YA ✅' : 'TIDAK ❌'}`);

// bersihkan data demo (ledger HPP ikut lewat handover_id)
const ho = db.prepare('SELECT id FROM inventory_handover WHERE transaction_id=?').all(txId);
for (const h of ho) {
  db.prepare('UPDATE inventory_items SET stock_total = stock_total + (SELECT qty FROM inventory_handover WHERE id=?) WHERE id = (SELECT item_id FROM inventory_handover WHERE id=?)').run(h.id, h.id);
  db.prepare('DELETE FROM ledger WHERE handover_id=?').run(h.id);
  db.prepare('DELETE FROM inventory_handover WHERE id=?').run(h.id);
}
db.prepare('DELETE FROM booking_jamaah WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM transactions WHERE id=?').run(txId);
db.prepare('DELETE FROM master_jamaah WHERE id=?').run(jamaahId);
db.close();

console.log('\nData demo dibersihkan; stok dikembalikan.');
if (!(debit === kredit && debit === totalHpp)) process.exit(1);
console.log('🎉 HPP TERBUKTI TERBENTUK DAN SEIMBANG');
