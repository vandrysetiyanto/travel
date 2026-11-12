#!/usr/bin/env node
/**
 * Uji laporan bersumber LEDGER: laba rugi, neraca seimbang, arus kas,
 * dan pengaruh beban + HPP perlengkapan terhadap laporan.
 *
 * Semua lewat HTTP API sungguhan; data uji dibersihkan di akhir.
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
  return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) };
};
const laporan = async () => (await api('/api/admin/financial?period=ALL')).data;

console.log('\n[1] Sumber laporan = ledger');
let d = await laporan();
cek('respons menyatakan sumber ledger', d.sumber === 'ledger', String(d.sumber));
cek('nama field laba rugi cocok dengan UI', typeof d.laba_rugi.total_pendapatan === 'number' && typeof d.laba_rugi.total_beban === 'number' && typeof d.laba_rugi.laba_bersih === 'number');
cek('arus kas punya field yang dibaca UI', ['kas_awal','kas_akhir','perubahan_kas','arus_operasi','arus_investasi','arus_pendanaan'].every(k => k in d.arus_kas), JSON.stringify(Object.keys(d.arus_kas||{})));

console.log('\n[2] Neraca seimbang sebelum uji');
cek('aset = liabilitas + ekuitas', d.neraca.seimbang === true, `selisih ${rp(d.neraca.selisih)}`);

const asetAwal = d.neraca.aset.total_aset;
const bebanAwal = d.laba_rugi.total_beban;
const labaAwal = d.laba_rugi.laba_bersih;

console.log('\n[3] Catat beban -> laba turun, kas turun, tetap seimbang');
const akunBeban = db.prepare("SELECT id, coa_code FROM chart_of_accounts WHERE coa_group='Beban' AND coa_code='5-106'").get();
const r1 = await api('/api/admin/financial', {
  action: 'ADD_EXPENSE', coa_account_id: akunBeban.id, amount: 2500000,
  description: 'Uji laporan ledger', expense_date: '2026-11-12',
});
cek('beban tercatat', r1.ok && r1.data.success, `HTTP ${r1.status} ${JSON.stringify(r1.data).slice(0, 100)}`);

d = await laporan();
cek('beban bertambah 2.500.000', d.laba_rugi.total_beban === bebanAwal + 2500000, `${rp(bebanAwal)} -> ${rp(d.laba_rugi.total_beban)}`);
cek('laba bersih turun 2.500.000', d.laba_rugi.laba_bersih === labaAwal - 2500000, `${rp(labaAwal)} -> ${rp(d.laba_rugi.laba_bersih)}`);
cek('aset turun 2.500.000 (kas berkurang)', d.neraca.aset.total_aset === asetAwal - 2500000, `${rp(asetAwal)} -> ${rp(d.neraca.aset.total_aset)}`);
cek('neraca tetap seimbang', d.neraca.seimbang === true, `selisih ${rp(d.neraca.selisih)}`);

// pastikan jurnal beban DUA sisi
const expBeban = db.prepare("SELECT id FROM expenses WHERE description='Uji laporan ledger'").get();
const jurnal = db.prepare('SELECT entry_type, amount, coa_account_id FROM ledger WHERE expense_id=?').all(expBeban.id);
cek('jurnal beban 2 baris (Dr + Cr)', jurnal.length === 2, `${jurnal.length} baris`);
const dr = jurnal.find(x => x.entry_type === 'DEBIT');
cek('sisi DEBIT ada di akun beban', dr && dr.coa_account_id === akunBeban.id, JSON.stringify(dr));

console.log('\n[4] HPP perlengkapan ikut muncul di beban');
const barang = db.prepare("SELECT id, code, unit_cost FROM inventory_items WHERE unit_cost > 0 LIMIT 1").get();
const j1 = db.prepare("INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)")
  .run('UJILAP' + Date.now().toString().slice(-8), 'Uji Laporan', '0800', '-', 'L');
const batch = db.prepare('SELECT id FROM batches ORDER BY id LIMIT 1').get();
const tx = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                       VALUES (?,?,?,?,0,?,'PENDING')`)
  .run('UJILAP-' + Date.now().toString().slice(-6), j1.lastInsertRowid, batch?.id ?? null, 1000000, 1000000);
const txId = Number(tx.lastInsertRowid);
const bebanSebelumHpp = (await laporan()).laba_rugi.total_beban;

const r2 = await api('/api/admin/inventory', { action: 'HANDOVER', transaction_id: txId, item_id: barang.id, qty: 2, notes: 'uji laporan' });
cek('penyerahan berhasil', r2.ok, `HTTP ${r2.status}`);
d = await laporan();
const naik = d.laba_rugi.total_beban - bebanSebelumHpp;
cek('HPP masuk ke total beban', naik === barang.unit_cost * 2, `naik ${rp(naik)}, harap ${rp(barang.unit_cost * 2)}`);
const akunHpp = d.laba_rugi.rincian_beban.find(b => b.coa_code === '5-109');
cek('akun 5-109 Beban Perlengkapan muncul', !!akunHpp && akunHpp.total > 0, JSON.stringify(akunHpp));
cek('neraca tetap seimbang setelah HPP', d.neraca.seimbang === true, `selisih ${rp(d.neraca.selisih)}`);

console.log('\n[5] Filter periode memakai tanggal ledger');
const harian = (await api('/api/admin/financial?period=DAILY&date=2026-11-12')).data;
cek('filter harian mengembalikan beban hari itu', harian.laba_rugi.total_beban > 0, rp(harian.laba_rugi.total_beban));
const kosong = (await api('/api/admin/financial?period=DAILY&date=2020-01-01')).data;
cek('tanggal tanpa transaksi -> 0', kosong.laba_rugi.total_beban === 0, rp(kosong.laba_rugi.total_beban));

// ── bersihkan ──
const ho = db.prepare('SELECT id FROM inventory_handover WHERE transaction_id=?').all(txId);
for (const h of ho) {
  db.prepare('UPDATE inventory_items SET stock_total = stock_total + (SELECT qty FROM inventory_handover WHERE id=?) WHERE id=(SELECT item_id FROM inventory_handover WHERE id=?)').run(h.id, h.id);
  db.prepare('DELETE FROM ledger WHERE handover_id=?').run(h.id);
  db.prepare('DELETE FROM inventory_handover WHERE id=?').run(h.id);
}
db.prepare('DELETE FROM ledger WHERE expense_id=?').run(expBeban.id);
db.prepare('DELETE FROM expenses WHERE id=?').run(expBeban.id);
db.prepare('DELETE FROM booking_jamaah WHERE transaction_id=?').run(txId);
db.prepare('DELETE FROM transactions WHERE id=?').run(txId);
db.prepare('DELETE FROM master_jamaah WHERE id=?').run(j1.lastInsertRowid);

const akhir = db.prepare("SELECT COALESCE(SUM(CASE WHEN entry_type='DEBIT' THEN amount ELSE 0 END),0) d, COALESCE(SUM(CASE WHEN entry_type='CREDIT' THEN amount ELSE 0 END),0) k FROM ledger").get();
db.close();

console.log('\n[6] Setelah data uji dibersihkan');
cek('buku besar kembali seimbang', Number(akhir.d) === Number(akhir.k), `${rp(akhir.d)} vs ${rp(akhir.k)}`);

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG LAPORAN-LEDGER LULUS');
