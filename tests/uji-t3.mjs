#!/usr/bin/env node
/**
 * Uji T3: aturan "boleh berulang, tidak boleh beririsan" berlaku juga untuk
 * CREATE_BOOKING yang dibuat admin lewat dashboard.
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
const book = async (jamaah_id, batch_id, extra = {}) => {
  const r = await fetch(`${BASE}/api/admin/transactions`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'CREATE_BOOKING', jamaah_id, batch_id, ...extra }),
  });
  return { status: r.status, data: await r.json().catch(() => ({})) };
};

// siapkan paket + 2 batch (beririsan & terpisah) + jamaah
let paket = db.prepare('SELECT id FROM packages ORDER BY id LIMIT 1').get();
if (!paket) {
  db.prepare("INSERT INTO packages (name, price, duration_days) VALUES ('Paket T3', 20000000, 9)").run();
  paket = db.prepare('SELECT id FROM packages ORDER BY id DESC LIMIT 1').get();
}
const stempel = Date.now().toString().slice(-6);
const b1 = db.prepare(`INSERT INTO batches (batch_name, package_id, departure_date, return_date, quota, status)
                       VALUES (?,?,?,?,50,'OPEN')`).run('T3-A-' + stempel, paket.id, '2027-03-01', '2027-03-10');
const b2 = db.prepare(`INSERT INTO batches (batch_name, package_id, departure_date, return_date, quota, status)
                       VALUES (?,?,?,?,50,'OPEN')`).run('T3-B-' + stempel, paket.id, '2027-03-05', '2027-03-15'); // beririsan
const b3 = db.prepare(`INSERT INTO batches (batch_name, package_id, departure_date, return_date, quota, status)
                       VALUES (?,?,?,?,50,'OPEN')`).run('T3-C-' + stempel, paket.id, '2027-06-01', '2027-06-10'); // terpisah
const id1 = Number(b1.lastInsertRowid), id2 = Number(b2.lastInsertRowid), id3 = Number(b3.lastInsertRowid);

const jm = db.prepare('INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)')
  .run('T3' + String(Date.now()).slice(-13), 'Jamaah T3', '0800', '-', 'L');
const jamaahId = Number(jm.lastInsertRowid);

console.log('\n[1] Booking pertama (2027-03-01 s/d 03-10)');
let r = await book(jamaahId, id1);
cek('booking pertama DITERIMA', r.status === 200 && r.data.success, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 90)}`);

console.log('\n[2] Booking kedua BERIRISAN (2027-03-05 s/d 03-15) — harus DITOLAK');
r = await book(jamaahId, id2);
cek('booking beririsan DITOLAK 409', r.status === 409, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 120)}`);
const jml = db.prepare('SELECT COUNT(*) c FROM transactions WHERE jamaah_id=?').get(jamaahId).c;
cek('tidak ada transaksi tambahan yang tersimpan', jml === 1, `${jml} transaksi`);

console.log('\n[3] Booking ketiga TERPISAH (2027-06-01 s/d 06-10) — harus DITERIMA');
r = await book(jamaahId, id3);
cek('booking ulang di jadwal berbeda DITERIMA', r.status === 200 && r.data.success, `HTTP ${r.status}`);
const jml2 = db.prepare('SELECT COUNT(*) c FROM transactions WHERE jamaah_id=?').get(jamaahId).c;
cek('jamaah kini punya 2 booking', jml2 === 2, `${jml2}`);

console.log('\n[4] Pembayaran awal divalidasi');
const jm2 = db.prepare('INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)')
  .run('T3B' + String(Date.now()).slice(-12), 'Jamaah T3B', '0800', '-', 'L');
r = await book(Number(jm2.lastInsertRowid), id3, { initial_payment: -1000000 });
cek('pembayaran awal negatif DITOLAK', r.status === 400, `HTTP ${r.status}`);
r = await book(Number(jm2.lastInsertRowid), id3, { initial_payment: 999999999 });
cek('pembayaran awal melebihi harga DITOLAK', r.status === 400, `HTTP ${r.status}`);

// bersihkan
const semuaTx = db.prepare('SELECT id FROM transactions WHERE jamaah_id IN (?,?)').all(jamaahId, jm2.lastInsertRowid);
for (const t of semuaTx) {
  db.prepare('DELETE FROM ledger WHERE transaction_id=?').run(t.id);
  db.prepare('DELETE FROM payment_history WHERE transaction_id=?').run(t.id);
  db.prepare('DELETE FROM booking_jamaah WHERE transaction_id=?').run(t.id);
  db.prepare('DELETE FROM transactions WHERE id=?').run(t.id);
}
db.prepare('DELETE FROM master_jamaah WHERE id IN (?,?)').run(jamaahId, jm2.lastInsertRowid);
db.prepare('DELETE FROM batches WHERE id IN (?,?,?)').run(id1, id2, id3);
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG T3 LULUS');
