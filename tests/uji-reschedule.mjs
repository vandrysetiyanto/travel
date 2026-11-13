#!/usr/bin/env node
/** Uji Fase A: RESCHEDULE_BATCH — ubah jadwal kloter + dampak + audit. */
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

// siapkan kloter uji + 2 jamaah
const pk = db.prepare('SELECT id FROM packages ORDER BY id LIMIT 1').get();
const b = db.prepare(`INSERT INTO batches (batch_name, package_id, departure_date, return_date, quota, status)
                      VALUES (?,?,?,?,50,'OPEN')`).run('UJI-RESCHED', pk.id, '2027-03-01', '2027-03-10');
const batchId = Number(b.lastInsertRowid);
const j1 = db.prepare('INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)')
  .run('RS' + String(Date.now()).slice(-13) + '1', 'Jamaah Satu', '0811', '-', 'L');
const j2 = db.prepare('INSERT INTO master_jamaah (nik, full_name, phone, address, gender) VALUES (?,?,?,?,?)')
  .run('RS' + String(Date.now()).slice(-13) + '2', 'Jamaah Dua', '0822', '-', 'P');
const t1 = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                       VALUES (?,?,?,?,0,?,'PENDING')`).run('RS-A-' + Date.now().toString().slice(-5), j1.lastInsertRowid, batchId, 25000000, 25000000);
const t2 = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                       VALUES (?,?,?,?,0,?,'PENDING')`).run('RS-B-' + Date.now().toString().slice(-5), j2.lastInsertRowid, batchId, 25000000, 25000000);
const t3 = db.prepare(`INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status)
                       VALUES (?,?,?,?,0,?, 'CANCELLED')`).run('RS-C-' + Date.now().toString().slice(-5), j1.lastInsertRowid, batchId, 25000000, 25000000);

console.log('\n[1] Validasi');
let r = await api('/api/admin/packages', { action: 'RESCHEDULE_BATCH', batch_id: batchId, departure_date: '2027-03-05', return_date: '2027-03-01' });
cek('pulang sebelum berangkat DITOLAK', r.status === 400, `HTTP ${r.status}`);
r = await api('/api/admin/packages', { action: 'RESCHEDULE_BATCH', batch_id: batchId, departure_date: '5 Maret', return_date: '2027-03-15' });
cek('format tanggal salah DITOLAK', r.status === 400, `HTTP ${r.status}`);
r = await api('/api/admin/packages', { action: 'RESCHEDULE_BATCH', batch_id: 999999, departure_date: '2027-03-05', return_date: '2027-03-15' });
cek('kloter tidak ada -> 404', r.status === 404, `HTTP ${r.status}`);

console.log('\n[2] Reschedule berhasil');
r = await api('/api/admin/packages', {
  action: 'RESCHEDULE_BATCH', batch_id: batchId,
  departure_date: '2027-03-07', return_date: '2027-03-18',
  catatan: 'Maskapai memajukan jadwal',
});
cek('reschedule 200', r.status === 200 && r.data.success, `HTTP ${r.status} ${JSON.stringify(r.data).slice(0, 110)}`);

const bSetelah = db.prepare('SELECT departure_date, return_date FROM batches WHERE id=?').get(batchId);
cek('tanggal tersimpan', bSetelah.departure_date === '2027-03-07' && bSetelah.return_date === '2027-03-18',
  JSON.stringify(bSetelah));

console.log('\n[3] Dampak & jamaah terdampak');
cek('jumlah terdampak = 2 (yang CANCELLED tidak dihitung)', Number(r.data.jumlah_terdampak) === 2, String(r.data.jumlah_terdampak));
const nama = (r.data.jamaah_terdampak || []).map((x) => x.full_name).sort().join(',');
cek('daftar jamaah dikembalikan', nama === 'Jamaah Dua,Jamaah Satu', nama);
cek('nomor HP ikut (untuk dihubungi)', (r.data.jamaah_terdampak || []).every((x) => !!x.phone));
cek('durasi lama 9 hari', Number(r.data.durasi?.lama_hari) === 9, String(r.data.durasi?.lama_hari));
cek('durasi baru 11 hari', Number(r.data.durasi?.baru_hari) === 11, String(r.data.durasi?.baru_hari));
cek('selisih +2 hari', Number(r.data.durasi?.selisih_hari) === 2, String(r.data.durasi?.selisih_hari));

console.log('\n[4] Audit tercatat');
const aud = db.prepare("SELECT * FROM audit_log WHERE module='batch_reschedule' AND record_id=? ORDER BY id DESC LIMIT 1").get(String(batchId));
cek('audit mencatat reschedule', !!aud && aud.action === 'UPDATE', JSON.stringify(aud)?.slice(0, 90));
cek('audit menyimpan tanggal sebelum', String(aud?.before_json || '').includes('2027-03-01'), aud?.before_json);
cek('audit menyimpan tanggal sesudah', String(aud?.after_json || '').includes('2027-03-07'), aud?.after_json);

console.log('\n[5] Uang tidak tersentuh');
const led = db.prepare('SELECT COUNT(*) c FROM ledger WHERE transaction_id IN (?,?,?)').get(Number(t1.lastInsertRowid), Number(t2.lastInsertRowid), Number(t3.lastInsertRowid)).c;
cek('tidak ada jurnal dibuat oleh reschedule', led === 0, String(led));

// bersihkan
db.prepare('DELETE FROM transactions WHERE batch_id=?').run(batchId);
db.prepare('DELETE FROM master_jamaah WHERE id IN (?,?)').run(j1.lastInsertRowid, j2.lastInsertRowid);
db.prepare('DELETE FROM batches WHERE id=?').run(batchId);
db.prepare("DELETE FROM audit_log WHERE module='batch_reschedule' AND record_id=?").run(String(batchId));
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG RESCHEDULE LULUS');
