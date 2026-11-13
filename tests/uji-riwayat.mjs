#!/usr/bin/env node
/**
 * Uji R6: Riwayat Jamaah per Paket & Batch.
 * Membuktikan aggregasi per JAMAAT (bukan per transaksi) benar: jumlah
 * keberangkatan, penanda berulang, status terkini, dan filter.
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
const api = async (path) => {
  const r = await fetch(BASE + path, { headers: { Cookie: cookie } });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

// ── siapkan: 3 paket? (pakai yang ada) + 3 kloter + 2 jamaah ──
const paket1 = db.prepare('SELECT id, name FROM packages ORDER BY id LIMIT 1').get();
const paket2 = db.prepare('SELECT id, name FROM packages ORDER BY id LIMIT 1 OFFSET 1').get() || paket1;

const buatBatch = (nama, paket, mulai, selesai) =>
  Number(db.prepare(`INSERT INTO batches (batch_name, package_id, departure_date, return_date, quota, status)
                     VALUES (?,?,?,?,50,'OPEN')`).run(nama, paket, mulai, selesai).lastInsertRowid);

const b1 = buatBatch('R6-2024-LALU', paket1.id, '2024-03-01', '2024-03-10');
const b2 = buatBatch('R6-2025-LALU', paket2.id, '2025-06-01', '2025-06-10');
const b3 = buatBatch('R6-2027-AKTIF', paket1.id, '2027-05-01', '2027-05-10');

const buatJamaah = (nik, nama, hp) =>
  Number(db.prepare('INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)')
    .run(nik, nama, hp, '-', 'L').lastInsertRowid);

const jBerulang = buatJamaah('R6' + String(Date.now()).slice(-13) + '1', 'Zulkifli Berulang', '08110001');
const jSekali = buatJamaah('R6' + String(Date.now()).slice(-13) + '2', 'Aisyah Sekali', '08110002');
const jBelum = buatJamaah('R6' + String(Date.now()).slice(-13) + '3', 'Hamid Belum Pernah', '08110003');

const buatTx = (kode, jid, bid, total, paid, status) =>
  db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
              VALUES (?,?,?,?,?,?,?)`).run(kode, jid, bid, total, paid, total - paid, status);

const s = Date.now().toString().slice(-5);
buatTx('R6-A-' + s, jBerulang, b1, 25000000, 25000000, 'PAID');
buatTx('R6-B-' + s, jBerulang, b2, 38000000, 38000000, 'PAID');
buatTx('R6-C-' + s, jBerulang, b3, 25000000, 10000000, 'DP');
buatTx('R6-D-' + s, jSekali, b1, 25000000, 25000000, 'CANCELLED');
buatTx('R6-E-' + s, jSekali, b3, 25000000, 5000000, 'DP');

console.log('\n[1] Endpoint merespons');
let r = await api('/api/admin/jamaah/riwayat');
cek('HTTP 200', r.status === 200 && r.data.success === true, `HTTP ${r.status}`);
cek('ada ringkasan', !!r.data.ringkas, JSON.stringify(r.data.ringkas));

const cari = async (nama) => (r.data.jamaah || []).find((x) => x.full_name === nama);

console.log('\n[2] Jamaah berulang (3 keberangkatan)');
const zul = await cari('Zulkifli Berulang');
cek('ditemukan', !!zul);
cek('jumlah keberangkatan = 3', Number(zul?.jumlah_keberangkatan) === 3, String(zul?.jumlah_keberangkatan));
cek('ditandai berulang', zul?.berulang === true);
cek('riwayat berisi 3 entri', Array.isArray(zul?.riwayat) && zul.riwayat.length === 3, String(zul?.riwayat?.length));
cek('urut waktu menaik', JSON.stringify(zul?.riwayat?.map((x) => x.departure_date)) === JSON.stringify(['2024-03-01', '2025-06-01', '2027-05-01']),
  JSON.stringify(zul?.riwayat?.map((x) => x.departure_date)));
cek('paket berbeda terhitung (2)', Number(zul?.jumlah_paket_berbeda) === 2, String(zul?.jumlah_paket_berbeda));
cek('status terkini AKTIF (ada kloter 2027)', zul?.status_terkini === 'AKTIF', zul?.status_terkini);

console.log('\n[3] Jamaah dengan 1 batal + 1 aktif');
const ais = await cari('Aisyah Sekali');
cek('ditemukan', !!ais);
cek('keberangkatan aktif = 1 (yang batal tidak dihitung)', Number(ais?.jumlah_keberangkatan) === 1, String(ais?.jumlah_keberangkatan));
cek('jumlah batal = 1', Number(ais?.jumlah_batal) === 1, String(ais?.jumlah_batal));
cek('riwayat tetap memuat 2 entri (termasuk batal)', Number(ais?.riwayat?.length) === 2, String(ais?.riwayat?.length));
cek('tidak ditandai berulang', ais?.berulang === false);

console.log('\n[4] Jamaah belum pernah berangkat');
const ham = await cari('Hamid Belum Pernah');
cek('ditemukan', !!ham);
cek('status BELUM_PERNAH', ham?.status_terkini === 'BELUM_PERNAH', ham?.status_terkini);
cek('keberangkatan 0', Number(ham?.jumlah_keberangkatan) === 0, String(ham?.jumlah_keberangkatan));
cek('riwayat kosong', Array.isArray(ham?.riwayat) && ham.riwayat.length === 0);

console.log('\n[5] Filter');
r = await api('/api/admin/jamaah/riwayat?berulang=1');
cek('filter berulang=1 hanya mengembalikan yang berulang', (r.data.jamaah || []).every((x) => x.berulang === true));
cek('yang berulang ditemukan', (r.data.jamaah || []).some((x) => x.full_name === 'Zulkifli Berulang'));

r = await api('/api/admin/jamaah/riwayat?search=Zulkifli');
cek('pencarian nama bekerja', (r.data.jamaah || []).length === 1 && r.data.jamaah[0].full_name === 'Zulkifli Berulang',
  JSON.stringify((r.data.jamaah || []).map((x) => x.full_name)));

r = await api(`/api/admin/jamaah/riwayat?batch_id=${b3}`);
cek('filter per batch bekerja', (r.data.jamaah || []).length === 2, JSON.stringify((r.data.jamaah || []).map((x) => x.full_name)));

r = await api('/api/admin/jamaah/riwayat?search=TidakAdaOrangIni');
cek('pencarian tanpa hasil -> array kosong', Array.isArray(r.data.jamaah) && r.data.jamaah.length === 0);

console.log('\n[6] Tanpa sesi harus ditolak');
const anon = await fetch(`${BASE}/api/admin/jamaah/riwayat`);
cek('anonim -> 401', anon.status === 401, `HTTP ${anon.status}`);

// ── bersihkan ──
const txs = db.prepare('SELECT id, jamaah_id FROM transactions WHERE booking_code LIKE ?').all('R6-%');
for (const t of txs) {
  db.prepare('DELETE FROM ledger WHERE transaction_id=?').run(t.id);
  db.prepare('DELETE FROM payment_history WHERE transaction_id=?').run(t.id);
  db.prepare('DELETE FROM booking_jamaah WHERE transaction_id=?').run(t.id);
  db.prepare('DELETE FROM transactions WHERE id=?').run(t.id);
}
db.prepare('DELETE FROM master_jamaah WHERE id IN (?,?,?)').run(jBerulang, jSekali, jBelum);
db.prepare('DELETE FROM batches WHERE id IN (?,?,?)').run(b1, b2, b3);
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG RIWAYAT JAMAAT LULUS');
