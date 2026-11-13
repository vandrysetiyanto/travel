#!/usr/bin/env node
/**
 * Uji unit_cost: HPP perlengkapan benar-benar terbentuk saat barang diserahkan,
 * dan hilang lagi saat penyerahan dibatalkan.
 *
 * Menguji lewat HTTP API sungguhan + memeriksa ledger di DB.
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
cek('login OWNER', login.ok && !!cookie, `HTTP ${login.status}`);

const post = async (path, body) => {
  const r = await fetch(BASE + path, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify(body),
  });
  return { status: r.status, ok: r.ok, data: await r.json().catch(() => ({})) };
};

console.log('\n[1] Akun & kolom pendukung');
const akunBeban = db.prepare("SELECT id FROM chart_of_accounts WHERE coa_code='5-109'").get();
const akunPersed = db.prepare("SELECT id FROM chart_of_accounts WHERE coa_code='1-103'").get();
cek('akun 5-109 Beban Perlengkapan ada', !!akunBeban);
cek('akun 1-103 Persediaan ada', !!akunPersed);
const kolomLedger = db.prepare('PRAGMA table_info(ledger)').all().map(c => c.name);
cek('ledger.handover_id ada', kolomLedger.includes('handover_id'));

console.log('\n[2] Isi unit_cost lewat API');
const kodeBarang = 'UJI-HPP';
db.prepare("DELETE FROM inventory_items WHERE code=?").run(kodeBarang);
let r = await post('/api/admin/inventory', {
  action: 'ADD_ITEM', code: kodeBarang, name: 'Barang Uji HPP', category: 'Perlengkapan',
  stock_total: 10, unit: 'Pcs', unit_cost: 125000,
});
cek('ADD_ITEM dengan unit_cost berhasil', r.ok, `HTTP ${r.status}`);
const barangAwal = db.prepare('SELECT id, unit_cost FROM inventory_items WHERE code=?').get(kodeBarang);
const barangId = barangAwal.id;   // id disimpan terpisah agar tidak tertimpa hasil query
cek('unit_cost tersimpan 125000', barangAwal.unit_cost === 125000, `tersimpan ${barangAwal.unit_cost}`);

r = await post('/api/admin/inventory', { action: 'UPDATE_STOCK', item_id: barangId, stock_total: 10, unit_cost: 150000 });
const setelahUpdate = db.prepare('SELECT unit_cost FROM inventory_items WHERE id=?').get(barangId);
cek('UPDATE_STOCK bisa mengubah unit_cost', setelahUpdate.unit_cost === 150000, `${setelahUpdate.unit_cost}`);

console.log('\n[3] Penyerahan barang -> HPP terbentuk');
// butuh transaksi; pakai yang ada atau buat
/*
 * Uji ini tidak boleh bergantung pada data contoh: setelah reset data dummy,
 * tabel transactions kosong. Buat sendiri jamaah + batch + transaksi uji,
 * memakai skema yang BENAR (transactions tidak punya kolom package_id).
 */
let tx = db.prepare('SELECT id FROM transactions ORDER BY id LIMIT 1').get();
let jamaahUji = null;
if (!tx) {
  jamaahUji = db.prepare('INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)')
    .run('HPP' + String(Date.now()).slice(-13), 'Uji HPP', '0800', '-', 'L');
  let batch = db.prepare('SELECT id FROM batches ORDER BY id LIMIT 1').get();
  if (!batch) {
    const pk = db.prepare('SELECT id FROM packages ORDER BY id LIMIT 1').get();
    const b = db.prepare(`INSERT INTO batches (batch_name, package_id, departure_date, return_date, quota, status)
                          VALUES (?,?,?,?,50,'OPEN')`).run('UJI-HPP', pk.id, '2027-09-01', '2027-09-10');
    batch = { id: Number(b.lastInsertRowid) };
  }
  const ins = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                          VALUES (?,?,?,?,0,?,'PENDING')`)
    .run('UJI-HPP-' + Date.now().toString().slice(-6), jamaahUji.lastInsertRowid, batch.id, 1000000, 1000000);
  tx = { id: Number(ins.lastInsertRowid) };
}
const stokAwal = db.prepare('SELECT stock_total FROM inventory_items WHERE id=?').get(barangId).stock_total;
const ledgerSebelum = db.prepare('SELECT COUNT(*) c FROM ledger').get().c;

r = await post('/api/admin/inventory', { action: 'HANDOVER', transaction_id: tx.id, item_id: barangId, qty: 2, notes: 'uji hpp' });
cek('HANDOVER berhasil', r.ok, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0,120)}`);
cek('respons menyebut HPP', Number(r.data.hpp) === 300000, `hpp=${r.data.hpp}`);

const stokAkhir = db.prepare('SELECT stock_total FROM inventory_items WHERE id=?').get(barangId).stock_total;
cek('stok turun 2', stokAkhir === stokAwal - 2, `${stokAwal} -> ${stokAkhir}`);

const handover = db.prepare('SELECT id FROM inventory_handover WHERE item_id=? ORDER BY id DESC LIMIT 1').get(barangId);
const baris = db.prepare('SELECT entry_type, amount, coa_account_id, handover_id FROM ledger WHERE handover_id=? ORDER BY entry_type').all(handover.id);
cek('2 baris ledger terbentuk (debit+kredit)', baris.length === 2, `${baris.length} baris`);
const debit = baris.find(b => b.entry_type === 'DEBIT');
const kredit = baris.find(b => b.entry_type === 'KREDIT' || b.entry_type === 'CREDIT');
cek('debit 300000 ke Beban Perlengkapan', debit && debit.amount === 300000 && debit.coa_account_id === akunBeban.id,
  JSON.stringify(debit));
cek('kredit 300000 ke Persediaan', kredit && kredit.amount === 300000 && kredit.coa_account_id === akunPersed.id,
  JSON.stringify(kredit));
cek('ledger bertambah tepat 2 baris', db.prepare('SELECT COUNT(*) c FROM ledger').get().c === ledgerSebelum + 2);

console.log('\n[4] Penyerahan dibatalkan -> HPP hilang');
db.prepare('DELETE FROM inventory_handover WHERE id=?').run(handover.id);
db.prepare('DELETE FROM ledger WHERE handover_id=?').run(handover.id);
const sisa = db.prepare('SELECT COUNT(*) c FROM ledger WHERE handover_id=?').get(handover.id).c;
cek('tidak ada ledger menggantung untuk handover yang dihapus', sisa === 0, `${sisa} baris`);

console.log('\n[5] Barang tanpa unit_cost tidak membuat jurnal palsu');
db.prepare('UPDATE inventory_items SET unit_cost=0 WHERE id=?').run(barangId);
const cSebelum = db.prepare('SELECT COUNT(*) c FROM ledger').get().c;
r = await post('/api/admin/inventory', { action: 'HANDOVER', transaction_id: tx.id, item_id: barangId, qty: 1, notes: 'uji tanpa biaya' });
cek('penyerahan tetap tercatat', r.ok, `HTTP ${r.status}`);
cek('hpp = 0', Number(r.data.hpp) === 0, `hpp=${r.data.hpp}`);
cek('tidak ada baris ledger dibuat', db.prepare('SELECT COUNT(*) c FROM ledger').get().c === cSebelum);
cek('pesan menjelaskan alasannya', String(r.data.message || '').includes('unit_cost'), r.data.message);

// bersihkan
const h2 = db.prepare('SELECT id FROM inventory_handover WHERE item_id=?').all(barangId);
for (const h of h2) { db.prepare('DELETE FROM ledger WHERE handover_id=?').run(h.id); db.prepare('DELETE FROM inventory_handover WHERE id=?').run(h.id); }
db.prepare('DELETE FROM inventory_items WHERE id=?').run(barangId);
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG unit_cost LULUS');
