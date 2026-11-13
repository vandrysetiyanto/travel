#!/usr/bin/env node
/** Uji Fase A: itinerary paket (migrasi 3). */
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

console.log('\n[1] Skema');
cek('user_version >= 3', db.pragma('user_version', { simple: true }) >= 3, String(db.pragma('user_version', { simple: true })));
cek('tabel package_itinerary ada', !!db.prepare("SELECT 1 FROM sqlite_master WHERE name='package_itinerary'").get());

const paket = db.prepare('SELECT id, name FROM packages ORDER BY id LIMIT 1').get();
if (!paket) { console.log('  (tidak ada paket)'); db.close(); process.exit(0); }

console.log('\n[2] Simpan itinerary');
let r = await api('/api/admin/packages', {
  action: 'SAVE_ITINERARY', package_id: paket.id,
  itinerary: [
    { hari: 1, judul: 'Keberangkatan Jakarta', kegiatan: 'Berkumpul di bandara', kota: 'Jakarta', hotel: '-', makan: 'Makan malam di pesawat' },
    { hari: 2, judul: 'Tiba di Madinah', kegiatan: 'City tour + shalat di Nabawi', kota: 'Madinah', hotel: 'Taiba Suites', makan: '3x' },
    { hari: 5, judul: 'Ke Makkah', kegiatan: 'Umrah pertama', kota: 'Makkah', hotel: 'Pullman Zamzam', makan: '3x' },
  ],
});
cek('itinerary tersimpan', r.status === 200 && Number(r.data.jumlah_hari) === 3, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 90)}`);

const baris = db.prepare('SELECT * FROM package_itinerary WHERE package_id=? ORDER BY hari').all(paket.id);
cek('3 baris di database', baris.length === 3, String(baris.length));
cek('urutan hari benar', baris.map((b) => b.hari).join(',') === '1,2,5', baris.map((b) => b.hari).join(','));

console.log('\n[3] GET menyertakan itinerary');
r = await api('/api/admin/packages');
const p = (r.data.packages || []).find((x) => Number(x.id) === Number(paket.id));
cek('paket membawa itinerary', Array.isArray(p?.itinerary) && p.itinerary.length === 3, String(p?.itinerary?.length));

console.log('\n[4] Validasi');
r = await api('/api/admin/packages', { action: 'SAVE_ITINERARY', package_id: paket.id, itinerary: [{ hari: 0, judul: 'x' }] });
cek('hari 0 ditolak', r.status === 400, `HTTP ${r.status}`);
r = await api('/api/admin/packages', { action: 'SAVE_ITINERARY', package_id: paket.id, itinerary: [{ hari: 1, judul: 'a' }, { hari: 1, judul: 'b' }] });
cek('hari duplikat ditolak', r.status === 400, `HTTP ${r.status}`);
r = await api('/api/admin/packages', { action: 'SAVE_ITINERARY', package_id: paket.id, itinerary: [{ hari: 2, judul: '   ' }] });
cek('judul kosong ditolak', r.status === 400, `HTTP ${r.status}`);
r = await api('/api/admin/packages', { action: 'SAVE_ITINERARY', package_id: 999999, itinerary: [{ hari: 1, judul: 'x' }] });
cek('paket tidak ada -> 404', r.status === 404, `HTTP ${r.status}`);

console.log('\n[5] Simpan ulang menggantikan (bukan menumpuk)');
r = await api('/api/admin/packages', { action: 'SAVE_ITINERARY', package_id: paket.id, itinerary: [{ hari: 1, judul: 'Hanya satu hari' }] });
const setelah = db.prepare('SELECT COUNT(*) c FROM package_itinerary WHERE package_id=?').get(paket.id).c;
cek('jumlah baris jadi 1 (diganti)', setelah === 1, String(setelah));

console.log('\n[6] Hapus');
r = await api('/api/admin/packages', { action: 'DELETE_ITINERARY', package_id: paket.id });
cek('itinerary terhapus', r.status === 200 && db.prepare('SELECT COUNT(*) c FROM package_itinerary WHERE package_id=?').get(paket.id).c === 0);

db.prepare('DELETE FROM audit_log WHERE module=?').run('itinerary');
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG ITINERARY LULUS');
