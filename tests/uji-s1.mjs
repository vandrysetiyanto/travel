#!/usr/bin/env node
/**
 * Uji S1: perubahan uang & stok WAJIB meninggalkan jejak audit.
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
let idAudit = [];
const audit = (modul, aksi) => {
  const row = db.prepare(
    aksi
      ? 'SELECT * FROM audit_log WHERE module = ? AND action = ? ORDER BY id DESC LIMIT 1'
      : 'SELECT * FROM audit_log WHERE module = ? ORDER BY id DESC LIMIT 1',
  ).get(...(aksi ? [modul, aksi] : [modul]));
  if (row?.id) idAudit.push(row.id);
  return row;
};

const awal = db.prepare('SELECT COUNT(*) c FROM audit_log').get().c;

console.log('\n[1] Inventaris (stok & harga)');
let r = await api('/api/admin/inventory', { action: 'ADD_ITEM', code: 'AUD-' + Date.now().toString().slice(-6), name: 'Barang Audit', stock_total: 5, unit_cost: 10000 });
let aCreate = audit('inventory', 'CREATE');
cek('ADD_ITEM tercatat', r.status === 200 && aCreate && aCreate.action === 'CREATE', `HTTP ${r.status} action=${aCreate?.action}`);

const brg = db.prepare("SELECT id, stock_total, unit_cost FROM inventory_items WHERE name='Barang Audit' ORDER BY id DESC LIMIT 1").get();
r = await api('/api/admin/inventory', { action: 'UPDATE_STOCK', item_id: brg.id, stock_total: 8, unit_cost: 12500 });
let a = audit('inventory', 'UPDATE');
cek('UPDATE_STOCK tercatat UPDATE', a && a.action === 'UPDATE', JSON.stringify(a)?.slice(0, 80));
cek('audit menyimpan nilai sebelum & sesudah', !!a?.before_json && !!a?.after_json, `${a?.before_json} -> ${a?.after_json}`);
cek('jejak CREATE dari langkah sebelumnya tetap ada', !!aCreate);

console.log('\n[2] Beban operasional');
const akun = db.prepare("SELECT id FROM chart_of_accounts WHERE coa_group='Beban' LIMIT 1").get();
r = await api('/api/admin/financial', { action: 'ADD_EXPENSE', coa_account_id: akun.id, amount: 50000, description: 'Beban Audit S1', expense_date: '2026-11-12' });
a = audit('expense');
cek('beban tercatat', a && a.action === 'CREATE', JSON.stringify(a)?.slice(0, 80));

console.log('\n[3] Verifikasi pembayaran (jalur uang paling sensitif)');
const jm = db.prepare('INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)')
  .run('AUD' + String(Date.now()).slice(-13), 'Audit S1', '0800', '-', 'L');
const batch = db.prepare('SELECT id FROM batches ORDER BY id LIMIT 1').get();
const tx = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                       VALUES (?,?,?,?,0,?,'PENDING')`)
  .run('AUD-' + Date.now().toString().slice(-6), jm.lastInsertRowid, batch?.id ?? null, 1000000, 1000000);
const txId = Number(tx.lastInsertRowid);
const ph = db.prepare(`INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, status, created_by)
                       VALUES (?,?,?,?,?,'PENDING','uji')`)
  .run(txId, 'AUD-KW-1', 400000, 'TRANSFER', 'DP');

r = await api('/api/payments/verify', { payment_id: Number(ph.lastInsertRowid), action: 'APPROVE' });
a = audit('payment');
cek('approve pembayaran tercatat VERIFY', r.status === 200 && a && a.action === 'VERIFY', `HTTP ${r.status} body=${JSON.stringify(r.data).slice(0,90)} audit=${JSON.stringify(a)?.slice(0,80)}`);
cek('audit mencatat nominal', a && String(a.after_json || '').includes('400000'), a?.after_json);

console.log('\n[4] Reject pembayaran juga tercatat');
const ph2 = db.prepare(`INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, status, created_by)
                        VALUES (?,?,?,?,?,'PENDING','uji')`)
  .run(txId, 'AUD-KW-2', 100000, 'TRANSFER', 'CICILAN');
r = await api('/api/payments/verify', { payment_id: Number(ph2.lastInsertRowid), action: 'REJECT', notes: 'bukti tidak jelas' });
a = audit('payment');
cek('reject tercatat REJECT', r.status === 200 && a && a.action === 'REJECT', `HTTP ${r.status} ${JSON.stringify(a)?.slice(0, 80)}`);

console.log('\n[5] Checklist (stok barang jamaah)');
const cm = db.prepare("SELECT id FROM checklist_master WHERE is_inventory_linked=1 LIMIT 1").get();
r = await api('/api/admin/checklist', { action: 'UPDATE_STATUS', jamaah_id: jm.lastInsertRowid, checklist_master_id: cm.id, status: 'SUDAH', notes: 'uji audit' });
a = audit('checklist');
cek('centang checklist tercatat', a && a.action === 'UPDATE', `HTTP ${r.status} ${JSON.stringify(a)?.slice(0, 80)}`);

console.log('\n[6] Ringkasan');
const akhir = db.prepare('SELECT COUNT(*) c FROM audit_log').get().c;
cek('audit_log bertambah', akhir > awal, `${awal} -> ${akhir}`);
const yatim = db.prepare(`SELECT COUNT(*) c FROM audit_log WHERE user_email IS NULL OR user_email = ''`).get().c;
cek('setiap jejak menyebut pelakunya', yatim === 0, `${yatim} baris tanpa pelaku`);

// bersihkan
db.prepare('DELETE FROM ledger WHERE expense_id IN (SELECT id FROM expenses WHERE description=?)').run('Beban Audit S1');
db.prepare('DELETE FROM expenses WHERE description=?').run('Beban Audit S1');
db.prepare('DELETE FROM ledger WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM ledger WHERE payment_id IN (SELECT id FROM payment_history WHERE transaction_id=?)').run(txId);
db.prepare('DELETE FROM payment_history WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM jamaah_checklist WHERE jamaah_id=?').run(jm.lastInsertRowid);
db.prepare('DELETE FROM inventory_handover WHERE jamaah_id=?').run(jm.lastInsertRowid);
db.prepare('DELETE FROM booking_jamaah WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM transactions WHERE id=?').run(txId);
db.prepare('DELETE FROM master_jamaah WHERE id=?').run(jm.lastInsertRowid);
db.prepare("DELETE FROM inventory_items WHERE name='Barang Audit'").run();
/* Bersihkan hanya baris audit yang dibuat uji ini (dicatat lewat id).
   JANGAN memakai created_at: kolom itu CURRENT_TIMESTAMP (UTC) sedangkan
   perbandingan datetime('now') juga UTC, tetapi rentangnya mudah meleset —
   inilah yang sempat menghapus baris audit yang baru saja dibuat. */
if (idAudit.length) {
  const tanda = idAudit.map(() => '?').join(',');
  db.prepare(`DELETE FROM audit_log WHERE id IN (${tanda})`).run(...idAudit);
}
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG S1 LULUS');
