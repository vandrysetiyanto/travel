#!/usr/bin/env node
/**
 * Uji Fase A: cost center per kloter.
 * Membuktikan ledger/expenses benar-benar membawa batch_id dan laporan per
 * kloter menghitung angka yang benar serta tetap seimbang dengan total.
 */
import Database from 'better-sqlite3';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };
const rp = (x) => 'Rp ' + Number(x).toLocaleString('id-ID');

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

console.log('\n[1] Skema');
cek('user_version >= 2', db.pragma('user_version', { simple: true }) >= 2, String(db.pragma('user_version', { simple: true })));
for (const t of ['ledger', 'expenses', 'general_journals']) {
  cek(`${t}.batch_id ada`, db.prepare(`PRAGMA table_info(${t})`).all().some((c) => c.name === 'batch_id'));
}

// ── siapkan data uji: 1 kloter, 1 jamaah, 1 pembayaran, 1 beban ──
const batch = db.prepare('SELECT id, batch_name FROM batches ORDER BY id LIMIT 1').get();
if (!batch) { console.log('  (tidak ada batch — uji dilewati)'); db.close(); process.exit(0); }

const jm = db.prepare('INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)')
  .run('KLOTER' + String(Date.now()).slice(-11), 'Uji Kloter', '0800', '-', 'L');
const tx = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                       VALUES (?,?,?,?,?,?,'DP')`)
  .run('KLOTER-' + Date.now().toString().slice(-6), jm.lastInsertRowid, batch.id, 30000000, 10000000, 20000000);
const txId = Number(tx.lastInsertRowid);

console.log('\n[2] Pembayaran otomatis membawa batch_id');
const pay = db.prepare(`INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, status, created_by)
                        VALUES (?,?,?,?,?,'PENDING','uji')`).run(txId, 'KL-KW-1', 10000000, 'TRANSFER', 'DP');
let r = await api('/api/payments/verify', { payment_id: Number(pay.lastInsertRowid), action: 'APPROVE' });
cek('pembayaran disetujui', r.status === 200, `HTTP ${r.status}`);

const led = db.prepare('SELECT batch_id, entry_type, amount FROM ledger WHERE transaction_id=?').all(txId);
cek('jurnal pembayaran punya batch_id', led.length > 0 && led.every((x) => Number(x.batch_id) === Number(batch.id)),
  JSON.stringify(led.map((x) => x.batch_id)));

console.log('\n[3] Beban dengan kloter & tanpa kloter');
const akun = db.prepare("SELECT id FROM chart_of_accounts WHERE coa_group='Beban' LIMIT 1").get();
r = await api('/api/admin/financial', {
  action: 'ADD_EXPENSE', coa_account_id: akun.id, amount: 4000000,
  description: 'Hotel Madinah UJI-KLOTER', expense_date: '2026-11-13', batch_id: batch.id,
});
cek('beban ber-kloter dicatat', r.status === 200, `HTTP ${r.status}`);
const expKloter = db.prepare("SELECT id, batch_id FROM expenses WHERE description='Hotel Madinah UJI-KLOTER'").get();
cek('expenses.batch_id terisi', Number(expKloter?.batch_id) === Number(batch.id), String(expKloter?.batch_id));
const ledExp = db.prepare('SELECT batch_id FROM ledger WHERE expense_id=?').all(expKloter.id);
cek('jurnal beban membawa batch_id', ledExp.length === 2 && ledExp.every((x) => Number(x.batch_id) === Number(batch.id)),
  JSON.stringify(ledExp.map((x) => x.batch_id)));

r = await api('/api/admin/financial', {
  action: 'ADD_EXPENSE', coa_account_id: akun.id, amount: 500000,
  description: 'Beban Kantor UJI-TANPA-KLOTER', expense_date: '2026-11-13',
});
cek('beban tanpa kloter tetap boleh', r.status === 200, `HTTP ${r.status}`);

console.log('\n[4] Laporan per kloter');
const fin = (await api('/api/admin/financial?period=ALL')).data;
cek('respons memuat per_kloter', !!fin.per_kloter && Array.isArray(fin.per_kloter.per_kloter));

const k = fin.per_kloter.per_kloter.find((x) => Number(x.batch_id) === Number(batch.id));
cek('kloter uji muncul di laporan', !!k, k ? '' : 'tidak ditemukan');
if (k) {
  console.log(`      pendapatan ${rp(k.pendapatan)} | beban ${rp(k.beban)} | laba ${rp(k.laba_kotor)} | margin ${k.margin_persen}% | jamaah ${k.jumlah_jamaah}`);
  cek('pendapatan kloter = 10.000.000', Number(k.pendapatan) === 10000000, rp(k.pendapatan));
  cek('beban kloter = 4.000.000', Number(k.beban) === 4000000, rp(k.beban));
  cek('laba kotor = 6.000.000', Number(k.laba_kotor) === 6000000, rp(k.laba_kotor));
  cek('margin = 60%', Number(k.margin_persen) === 60, String(k.margin_persen));
  cek('jumlah jamaah terhitung', Number(k.jumlah_jamaah) >= 1, String(k.jumlah_jamaah));
}

cek('beban tanpa kloter masuk "belum_teralokasi"',
  Number(fin.per_kloter.belum_teralokasi.beban) >= 500000, rp(fin.per_kloter.belum_teralokasi.beban));

console.log('\n[5] Konsistensi dengan total laporan');
const selisihPendapatan = Math.abs(Number(fin.per_kloter.total.pendapatan) - Number(fin.laba_rugi.total_pendapatan));
const selisihBeban = Math.abs(Number(fin.per_kloter.total.beban) - Number(fin.laba_rugi.total_beban));
cek('total pendapatan per-kloter == laba rugi', selisihPendapatan < 1, `${rp(fin.per_kloter.total.pendapatan)} vs ${rp(fin.laba_rugi.total_pendapatan)}`);
cek('total beban per-kloter == laba rugi', selisihBeban < 1, `${rp(fin.per_kloter.total.beban)} vs ${rp(fin.laba_rugi.total_beban)}`);

const g = db.prepare("SELECT COALESCE(SUM(CASE WHEN entry_type='DEBIT' THEN amount ELSE 0 END),0) d, COALESCE(SUM(CASE WHEN entry_type='CREDIT' THEN amount ELSE 0 END),0) k FROM ledger").get();
cek('buku besar tetap seimbang', Number(g.d) === Number(g.k), `${rp(g.d)} vs ${rp(g.k)}`);

// ── bersihkan ──
db.prepare('DELETE FROM ledger WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM ledger WHERE expense_id IN (SELECT id FROM expenses WHERE description LIKE ?)').run('%UJI-KLOTER%');
db.prepare('DELETE FROM ledger WHERE expense_id IN (SELECT id FROM expenses WHERE description LIKE ?)').run('%UJI-TANPA-KLOTER%');
db.prepare('DELETE FROM expenses WHERE description LIKE ?').run('%UJI-KLOTER%');
db.prepare('DELETE FROM expenses WHERE description LIKE ?').run('%UJI-TANPA-KLOTER%');
db.prepare('DELETE FROM payment_history WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM booking_jamaah WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM transactions WHERE id=?').run(txId);
db.prepare('DELETE FROM master_jamaah WHERE id=?').run(jm.lastInsertRowid);
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG COST-CENTER LULUS');
