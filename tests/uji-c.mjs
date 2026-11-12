#!/usr/bin/env node
/**
 * Uji C: mapping checklist -> inventory benar, dan stok terpotong dari barang
 * yang TEPAT saat barang diserahkan ke jamaah.
 *
 * Menguji lewat HTTP API sungguhan (bukan meniru SQL), memakai sesi login.
 */
import Database from 'better-sqlite3';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

const db = new Database(DB);
db.pragma('foreign_keys = ON');

console.log('\n[1] Mapping checklist -> barang');
const petaHarapan = {
  LOG_SERAGAM: 'BTK-01',
  LOG_KOPER: 'KPR-01',
  LOG_BUKU: 'BUK-01',
  LOG_IHRAM: 'IHR-01',
  LOG_MUKENA: 'MKN-01',
  LOG_TAS: 'TAS-01',
};
for (const [kodeCm, kodeBarang] of Object.entries(petaHarapan)) {
  const r = db.prepare(`
    SELECT ii.code FROM checklist_master cm
    JOIN inventory_items ii ON ii.id = cm.inventory_item_id
    WHERE cm.item_code = ?`).get(kodeCm);
  cek(`${kodeCm} -> ${kodeBarang}`, r && r.code === kodeBarang, `dapat ${r ? r.code : 'NULL'}`);
}

console.log('\n[2] Login untuk uji stok');
const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
cek('login OWNER berhasil', login.ok && !!cookie, `HTTP ${login.status}`);

console.log('\n[3] Serahkan Seragam ke jamaah -> stok Batik harus turun, Koper TIDAK');
const nik = 'UJI' + Date.now().toString().slice(-10);
const insJ = db.prepare(`INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)`)
  .run(nik, 'Jamaah Uji C', '0800000000', 'Alamat Uji', 'L');
const jamaahId = Number(insJ.lastInsertRowid);

const cmSeragam = db.prepare("SELECT id, inventory_item_id FROM checklist_master WHERE item_code='LOG_SERAGAM'").get();
const stokSebelum = (id) => db.prepare('SELECT stock_total FROM inventory_items WHERE id = ?').get(id).stock_total;
const idKoper = db.prepare("SELECT id FROM inventory_items WHERE code='KPR-01'").get().id;
const stokBatikAwal = stokSebelum(cmSeragam.inventory_item_id);
const stokKoperAwal = stokSebelum(idKoper);

const r1 = await fetch(`${BASE}/api/admin/checklist`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ action: 'UPDATE_STATUS', jamaah_id: jamaahId, checklist_master_id: cmSeragam.id, status: 'SUDAH', notes: 'uji C' }),
});
const j1 = await r1.json().catch(() => ({}));
cek('centang checklist berhasil (bukan 500)', r1.ok, `HTTP ${r1.status} ${JSON.stringify(j1).slice(0, 120)}`);

const stokBatikAkhir = stokSebelum(cmSeragam.inventory_item_id);
const stokKoperAkhir = stokSebelum(idKoper);

cek('stok Batik berkurang 1', stokBatikAkhir === stokBatikAwal - 1, `${stokBatikAwal} -> ${stokBatikAkhir}`);
cek('stok Koper TIDAK berubah (bug lama memotong Koper)', stokKoperAkhir === stokKoperAwal, `${stokKoperAwal} -> ${stokKoperAkhir}`);

console.log('\n[4] Batalkan centang -> stok kembali');
const r2 = await fetch(`${BASE}/api/admin/checklist`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ action: 'UPDATE_STATUS', jamaah_id: jamaahId, checklist_master_id: cmSeragam.id, status: 'BELUM', notes: '' }),
});
cek('batal centang berhasil', r2.ok, `HTTP ${r2.status}`);
const stokBalik = stokSebelum(cmSeragam.inventory_item_id);
cek('stok Batik kembali seperti semula', stokBalik === stokBatikAwal, `${stokBatikAwal} -> ${stokBalik}`);

db.prepare('DELETE FROM jamaah_checklist WHERE jamaah_id = ?').run(jamaahId);
db.prepare('DELETE FROM inventory_handover WHERE jamaah_id = ?').run(jamaahId);
db.prepare('DELETE FROM master_jamaah WHERE id = ?').run(jamaahId);
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG C LULUS');
