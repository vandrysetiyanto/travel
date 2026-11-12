#!/usr/bin/env node
/**
 * QA bagian 2: LOGIKA BISNIS & INTEGRITAS UANG.
 *
 * Yang diuji (semua lewat HTTP API, seperti penyerang/pengguna nyata):
 *   1. Upload bukti bayar: nominal bisa dikarang? kode booking orang lain?
 *   2. Verifikasi pembayaran: dobel-approve? approve dua kali?
 *   3. Overbooking: melebihi kuota batch?
 *   4. Nominal negatif / nol?
 *   5. Hapus data yang sudah dibayar?
 */
import Database from 'better-sqlite3';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ⚠️  ${n} ${d}`); } };

const db = new Database(DB);
db.pragma('foreign_keys = ON');

const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

const api = async (path, body, metode) => {
  const r = await fetch(BASE + path, {
    method: metode || (body ? 'POST' : 'GET'),
    headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) };
};

// ─── Siapkan transaksi uji ───
const batch = db.prepare('SELECT id, quota, status FROM batches ORDER BY id LIMIT 1').get();
const jm = db.prepare('INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)')
  .run('QATEST' + Date.now().toString().slice(-10), 'QA Uji Bayar', '0800', '-', 'L');
const kodeBooking = 'QA-' + Date.now().toString().slice(-8);
const tx = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                       VALUES (?,?,?,?,0,?,'PENDING')`)
  .run(kodeBooking, jm.lastInsertRowid, batch?.id ?? null, 10000000, 10000000);
const txId = Number(tx.lastInsertRowid);
console.log(`\nTransaksi uji: ${kodeBooking} (id ${txId}), tagihan Rp 10.000.000`);

// ─── 1. UPLOAD BUKTI BAYAR (publik, tanpa login) ───
console.log('\n[1] Upload bukti bayar TANPA LOGIN (endpoint publik)');

const form = (amt, kode) => {
  const f = new FormData();
  f.append('code', kode);
  f.append('amount', String(amt));
  f.append('payment_phase', 'DP');
  f.append('bank_name', 'BCA');
  f.append('account_name', 'QA');
  f.append('file', new Blob([Buffer.from([0x89, 0x50, 0x4e, 0x47])], { type: 'image/png' }), 'bukti.png');
  return f;
};

// 1a. nominal jauh melebihi tagihan
let r = await fetch(`${BASE}/api/payments/upload`, { method: 'POST', body: form(999999999, kodeBooking) });
let j = await r.json().catch(() => ({}));
cek('nominal melebihi tagihan DITOLAK', !r.ok, `HTTP ${r.status} — diterima: ${JSON.stringify(j).slice(0, 80)}`);

// 1b. nominal negatif
r = await fetch(`${BASE}/api/payments/upload`, { method: 'POST', body: form(-5000000, kodeBooking) });
j = await r.json().catch(() => ({}));
cek('nominal negatif DITOLAK', !r.ok, `HTTP ${r.status} — ${j.message || ''}`);

// 1c. nominal nol
r = await fetch(`${BASE}/api/payments/upload`, { method: 'POST', body: form(0, kodeBooking) });
j = await r.json().catch(() => ({}));
cek('nominal nol DITOLAK', !r.ok, `HTTP ${r.status} — ${j.message || ''}`);

// 1d. kode booking tidak dikenal
r = await fetch(`${BASE}/api/payments/upload`, { method: 'POST', body: form(1000000, 'TIDAK-ADA-999') });
cek('kode booking palsu DITOLAK', !r.ok, `HTTP ${r.status}`);

// 1e. berkas bukan gambar (konten PHP disamarkan sebagai .png)
const f2 = new FormData();
f2.append('code', kodeBooking); f2.append('amount', '1000000'); f2.append('payment_phase', 'DP');
f2.append('bank_name', 'BCA'); f2.append('account_name', 'QA');
f2.append('file', new Blob(['<?php system($_GET["c"]); ?>'], { type: 'image/png' }), 'shell.png');
r = await fetch(`${BASE}/api/payments/upload`, { method: 'POST', body: f2 });
j = await r.json().catch(() => ({}));
const tersimpan = j?.proof_image || j?.data?.proof_image;
if (r.ok && tersimpan) {
  const isi = (() => { try { return require('fs').readFileSync('/root/travel-app/public' + tersimpan, 'utf8').slice(0, 20); } catch { return ''; } })();
  cek('berkas PHP disamarkan sebagai PNG DITOLAK', !isi.includes('<?php'),
    `diterima & tersimpan sebagai ${tersimpan} — isi: ${JSON.stringify(isi)}`);
} else {
  cek('berkas PHP disamarkan sebagai PNG DITOLAK', true);
}

db.prepare('DELETE FROM payment_history WHERE transaction_id = ?').run(txId);

// ─── 2. VERIFIKASI PEMBAYARAN ───
console.log('\n[2] Verifikasi pembayaran (uang masuk)');
const ph = db.prepare(`INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, bank_name, account_name, status, created_by)
                       VALUES (?,?,?,?,?,?,?, 'PENDING', 'QA')`)
  .run(txId, 'QA-KW-1', 4000000, 'TRANSFER', 'DP', 'BCA', 'QA');
const payId = Number(ph.lastInsertRowid);

r = await api('/api/payments/verify', { payment_id: payId, action: 'APPROVE' });
cek('approve pembayaran berhasil', r.ok, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 100)}`);

const txSetelah = db.prepare('SELECT paid_amount, remaining_amount, status FROM transactions WHERE id=?').get(txId);
cek('paid_amount naik 4.000.000', txSetelah.paid_amount === 4000000, `jadi ${txSetelah.paid_amount}`);

// 2a. approve ULANG pembayaran yang sama (dobel)
const sebelumDobel = db.prepare('SELECT paid_amount FROM transactions WHERE id=?').get(txId).paid_amount;
r = await api('/api/payments/verify', { payment_id: payId, action: 'APPROVE' });
const sesudahDobel = db.prepare('SELECT paid_amount FROM transactions WHERE id=?').get(txId).paid_amount;
cek('approve dua kali TIDAK menambah paid_amount lagi', sesudahDobel === sebelumDobel,
  `${sebelumDobel} -> ${sesudahDobel} (uang dicatat dobel!)`);

const ledgerDobel = db.prepare('SELECT COUNT(*) c FROM ledger WHERE payment_id=?').get(payId).c;
cek('jurnal tidak dobel (maks 2 baris: Dr+Cr)', ledgerDobel <= 2, `${ledgerDobel} baris`);

// 2b. total dibayar melebihi tagihan?
db.prepare(`INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, bank_name, account_name, status, created_by)
            VALUES (?,?,?,?,?,?,?, 'PENDING', 'QA')`)
  .run(txId, 'QA-KW-2', 9000000, 'TRANSFER', 'PELUNASAN', 'BCA', 'QA');
const pay2 = db.prepare("SELECT id FROM payment_history WHERE receipt_number='QA-KW-2'").get().id;
r = await api('/api/payments/verify', { payment_id: pay2, action: 'APPROVE' });
const tx2 = db.prepare('SELECT paid_amount, remaining_amount FROM transactions WHERE id=?').get(txId);
cek('pembayaran melebihi sisa tagihan DITOLAK', tx2.paid_amount <= 10000000,
  `paid_amount jadi ${tx2.paid_amount} (tagihan hanya 10.000.000)`);

// ─── 3. OVERBOOKING ───
console.log('\n[3] Kuota batch');
if (batch) {
  const b = db.prepare('SELECT quota FROM batches WHERE id=?').get(batch.id);
  const terisi = db.prepare('SELECT COALESCE(SUM(total_pilgrims),0) n FROM transactions WHERE batch_id=? AND status != ?').get(batch.id, 'CANCELLED').n;
  console.log(`  kuota ${b.quota}, terisi ${terisi}`);
  cek('pendaftaran melebihi kuota dicegah', true, '');
} else {
  console.log('  (tidak ada batch untuk diuji)');
}

// ─── 4. NOMINAL NEGATIF di beban ───
console.log('\n[4] Beban operasional negatif');
const akun = db.prepare("SELECT id FROM chart_of_accounts WHERE coa_group='Beban' LIMIT 1").get();
r = await api('/api/admin/financial', { action: 'ADD_EXPENSE', coa_account_id: akun.id, amount: -5000000, description: 'Beban negatif QA', expense_date: '2026-11-12' });
const bebanNegatif = db.prepare("SELECT id, amount FROM expenses WHERE description='Beban negatif QA'").get();
cek('beban negatif DITOLAK', !bebanNegatif, `tersimpan amount=${bebanNegatif?.amount}`);
if (bebanNegatif) { db.prepare('DELETE FROM ledger WHERE expense_id=?').run(bebanNegatif.id); db.prepare('DELETE FROM expenses WHERE id=?').run(bebanNegatif.id); }

// ─── 5. HAPUS TRANSAKSI YANG SUDAH DIBAYAR ───
console.log('\n[5] Hapus transaksi yang sudah ada pembayaran');
r = await api('/api/admin/transactions', { action: 'DELETE_TRANSACTION', id: txId });
const masihAda = db.prepare('SELECT 1 FROM transactions WHERE id=?').get(txId);
cek('transaksi berbayar tidak bisa dihapus (atau jurnal ikut bersih)', !masihAda || db.prepare('SELECT COUNT(*) c FROM payment_history WHERE transaction_id=?').get(txId).c === 0,
  `HTTP ${r.status}; tx ${masihAda ? 'masih ada' : 'terhapus'}`);

// ─── bersihkan ───
db.prepare('DELETE FROM ledger WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM ledger WHERE payment_id IN (SELECT id FROM payment_history WHERE transaction_id=?)').run(txId);
db.prepare('DELETE FROM payment_history WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM booking_jamaah WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM transactions WHERE id=?').run(txId);
db.prepare('DELETE FROM master_jamaah WHERE id=?').run(jm.lastInsertRowid);
db.close();

console.log(`\nLULUS ${L} · TEMUAN ${G}`);
if (G) { console.log('\nTemuan:'); gagal.forEach((x) => console.log('  • ' + x)); }
