#!/usr/bin/env node
/**
 * Uji #1: pembatalan booking.
 * Memastikan: status -> CANCELLED, jurnal DIBALIK (bukan dihapus), neraca tetap
 * seimbang, pembayaran pending ditolak, stok perlengkapan kembali, audit tercatat.
 */
import Database from 'better-sqlite3';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

const db = new Database(DB);
db.pragma('foreign_keys = ON');

const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
const api = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

// ── siapkan booking uji dengan pembayaran + perlengkapan ──
const batch = db.prepare('SELECT id FROM batches ORDER BY id LIMIT 1').get();
const jm = db.prepare('INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)')
  .run('BATAL' + String(Date.now()).slice(-11), 'Jamaah Batal', '0800', '-', 'L');
const tx = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                       VALUES (?,?,?,?,?,?, 'DP')`)
  .run('BATAL-' + Date.now().toString().slice(-6), jm.lastInsertRowid, batch.id, 20000000, 5000000, 15000000);
const txId = Number(tx.lastInsertRowid);
db.prepare("INSERT INTO booking_jamaah (transaction_id, jamaah_id, peran, urutan) VALUES (?,?, 'LEADER', 1)").run(txId, jm.lastInsertRowid);

// pembayaran APPROVED (dengan jurnal) + satu PENDING
const pay = db.prepare(`INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, status, created_by)
                        VALUES (?,?,?,?,?,'APPROVED','uji')`).run(txId, 'BATAL-KW-1', 5000000, 'TRANSFER', 'DP');
const payId = Number(pay.lastInsertRowid);
db.prepare("INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, status, created_by) VALUES (?,?,?,?,?,'PENDING','uji')")
  .run(txId, 'BATAL-KW-2', 1000000, 'TRANSFER', 'CICILAN');

const akunKas = db.prepare("SELECT id FROM chart_of_accounts WHERE coa_code='1-101'").get().id;
const akunPend = db.prepare("SELECT id FROM chart_of_accounts WHERE coa_code='4-101'").get().id;
const insLed = db.prepare(`INSERT INTO ledger (entry_date, coa_account_id, entry_type, amount, description, transaction_id, payment_id)
                           VALUES ('2026-11-13', ?, ?, ?, 'uji batal', ?, ?)`);
insLed.run(akunKas, 'DEBIT', 5000000, txId, payId);
insLed.run(akunPend, 'CREDIT', 5000000, txId, payId);

// perlengkapan diserahkan
const brg = db.prepare("SELECT id, stock_total FROM inventory_items WHERE unit_cost > 0 LIMIT 1").get();
const stokAwal = brg.stock_total;
db.prepare('UPDATE inventory_items SET stock_total = stock_total - 2 WHERE id = ?').run(brg.id);
const ho = db.prepare("INSERT INTO inventory_handover (transaction_id, item_id, qty, jamaah_id) VALUES (?,?,?,?)")
  .run(txId, brg.id, 2, jm.lastInsertRowid);

const debitAwal = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE entry_type='DEBIT'").get().s;
const kreditAwal = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE entry_type='CREDIT'").get().s;
const ledgerAwal = db.prepare('SELECT COUNT(*) c FROM ledger').get().c;

console.log('\n[1] Validasi input');
let r = await api('/api/admin/transactions', { action: 'CANCEL_BOOKING', transaction_id: txId });
cek('tanpa alasan DITOLAK', r.status === 400, `HTTP ${r.status}`);
r = await api('/api/admin/transactions', { action: 'CANCEL_BOOKING', transaction_id: txId, alasan: 'abc' });
cek('alasan terlalu pendek DITOLAK', r.status === 400, `HTTP ${r.status}`);

console.log('\n[2] Pembatalan berhasil');
r = await api('/api/admin/transactions', { action: 'CANCEL_BOOKING', transaction_id: txId, alasan: 'Jamaah sakit, tidak bisa berangkat' });
cek('pembatalan 200', r.status === 200 && r.data.success, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 110)}`);

const t2 = db.prepare('SELECT status, paid_amount FROM transactions WHERE id=?').get(txId);
cek('status -> CANCELLED', t2.status === 'CANCELLED', t2.status);
cek('baris transaksi MASIH ADA (tidak dihapus)', !!t2);
cek('paid_amount tidak diubah diam-diam', Number(t2.paid_amount) === 5000000, String(t2.paid_amount));

console.log('\n[3] Jurnal DIBALIK, bukan dihapus');
const ledgerSesudah = db.prepare('SELECT COUNT(*) c FROM ledger').get().c;
cek('jurnal bertambah 2 baris (bukan hilang)', ledgerSesudah === ledgerAwal + 2, `${ledgerAwal} -> ${ledgerSesudah}`);
const balik = db.prepare("SELECT entry_type, amount FROM ledger WHERE reference LIKE 'BATAL-%' ORDER BY entry_type").all();
cek('ada pasangan jurnal balik', balik.length === 2, JSON.stringify(balik));
const dr = balik.find(b => b.entry_type === 'DEBIT');
const cr = balik.find(b => b.entry_type === 'CREDIT');
cek('Dr Pendapatan 5.000.000', dr && Number(dr.amount) === 5000000, JSON.stringify(dr));
cek('Cr Kas 5.000.000', cr && Number(cr.amount) === 5000000, JSON.stringify(cr));

console.log('\n[4] Neraca tetap seimbang');
const d2 = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE entry_type='DEBIT'").get().s;
const k2 = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE entry_type='CREDIT'").get().s;
cek('DEBIT == KREDIT setelah pembatalan', Number(d2) === Number(k2), `${d2} vs ${k2}`);

console.log('\n[5] Pembayaran & perlengkapan');
const st = db.prepare('SELECT receipt_number, status FROM payment_history WHERE transaction_id=? ORDER BY id').all(txId);
const ygPending = st.find(x => x.receipt_number === 'BATAL-KW-2');
const ygApproved = st.find(x => x.receipt_number === 'BATAL-KW-1');
cek('pembayaran PENDING -> REJECTED', ygPending?.status === 'REJECTED', ygPending?.status);
cek('pembayaran APPROVED tetap tercatat sebagai riwayat', ygApproved?.status === 'APPROVED', ygApproved?.status);

const stokSekarang = db.prepare('SELECT stock_total FROM inventory_items WHERE id=?').get(brg.id).stock_total;
cek('stok perlengkapan kembali (+2)', stokSekarang === stokAwal, `${stokAwal} -> ${stokSekarang}`);
const hoSisa = db.prepare('SELECT COUNT(*) c FROM inventory_handover WHERE transaction_id=?').get(txId).c;
cek('baris penyerahan dibatalkan', hoSisa === 0, `${hoSisa}`);

console.log('\n[6] Pembatalan ganda ditolak + audit');
r = await api('/api/admin/transactions', { action: 'CANCEL_BOOKING', transaction_id: txId, alasan: 'coba lagi batal' });
cek('pembatalan kedua ditolak 409', r.status === 409, `HTTP ${r.status}`);
const aud = db.prepare("SELECT * FROM audit_log WHERE module='transaction' AND record_id=? ORDER BY id DESC LIMIT 1").get(String(txId));
cek('audit mencatat pembatalan', !!aud && aud.action === 'DELETE', JSON.stringify(aud)?.slice(0, 90));
cek('audit memuat alasan', String(aud?.notes || '').includes('sakit'), aud?.notes);

console.log('\n[7] Booking batal tidak menerima pembayaran baru');
r = await api('/api/admin/transactions', { action: 'ADD_PAYMENT', transaction_id: txId, amount: 1000000 });
cek('ADD_PAYMENT ditolak untuk booking CANCELLED', r.status !== 200, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 80)}`);

// bersihkan
db.prepare('DELETE FROM ledger WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM payment_history WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM booking_jamaah WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM transactions WHERE id=?').run(txId);
db.prepare('DELETE FROM master_jamaah WHERE id=?').run(jm.lastInsertRowid);
db.prepare('DELETE FROM audit_log WHERE module=? AND record_id=?').run('transaction', String(txId));
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG PEMBATALAN LULUS');
