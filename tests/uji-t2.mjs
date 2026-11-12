#!/usr/bin/env node
/**
 * Uji T2: tanggal WIB (bukan UTC).
 * Membuktikan helper benar untuk kasus yang dulu salah (00:00–06:59 WIB)
 * dan bahwa jalur API memakai tanggal WIB.
 */
import Database from 'better-sqlite3';

const BASE = 'http://127.0.0.1:3000';
const DB = '/root/travel-app/data/travel.db';

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

// impor helper asli
const { tanggalWib, keTanggalWib, tanggalValid, stempelWib } = await import('/root/travel-app/lib/waktu.ts');

console.log('\n[1] Kasus yang dulu salah: 00:30 WIB');
const dini = new Date('2026-11-13T00:30:00+07:00');
cek('tanggalWib -> 2026-11-13', tanggalWib(dini) === '2026-11-13', tanggalWib(dini));
cek('toISOString -> 2026-11-12 (bukti bug lama)', dini.toISOString().slice(0, 10) === '2026-11-12');

console.log('\n[2] Batas-batas hari');
const batas = [
  ['2026-11-12T23:59:59+07:00', '2026-11-12', 'sebelum tengah malam'],
  ['2026-11-13T00:00:00+07:00', '2026-11-13', 'tepat tengah malam'],
  ['2026-11-13T06:59:59+07:00', '2026-11-13', 'akhir zona rawan (06:59)'],
  ['2026-11-13T07:00:00+07:00', '2026-11-13', 'setelah 07:00'],
  ['2026-11-13T12:00:00+07:00', '2026-11-13', 'siang'],
];
for (const [iso, harap, label] of batas) {
  cek(`${label} (${iso.slice(11, 19)} WIB)`, tanggalWib(new Date(iso)) === harap, tanggalWib(new Date(iso)));
}

console.log('\n[3] Normalisasi created_at UTC (data lama SQLite)');
cek('"2026-11-12 17:30:00" (UTC) -> 2026-11-13 WIB', keTanggalWib('2026-11-12 17:30:00') === '2026-11-13', keTanggalWib('2026-11-12 17:30:00'));
cek('"2026-11-12T17:30:00Z" -> 2026-11-13 WIB', keTanggalWib('2026-11-12T17:30:00Z') === '2026-11-13', keTanggalWib('2026-11-12T17:30:00Z'));
cek('"2026-11-13" tetap 2026-11-13', keTanggalWib('2026-11-13') === '2026-11-13');
// Tanpa penanda zona diperlakukan sebagai UTC (karena CURRENT_TIMESTAMP SQLite = UTC).
cek('"2026-11-12 10:20:00" (UTC) -> 2026-11-12 WIB', keTanggalWib('2026-11-12 10:20:00') === '2026-11-12', keTanggalWib('2026-11-12 10:20:00'));

console.log('\n[4] Validasi tanggal');
cek('"2026-11-13" valid', tanggalValid('2026-11-13'));
cek('"2026-02-30" tidak valid', !tanggalValid('2026-02-30'));
cek('"13-11-2026" tidak valid', !tanggalValid('13-11-2026'));
cek('"abc" tidak valid', !tanggalValid('abc'));

console.log('\n[5] Tanpa nilai -> null, bukan crash');
cek('null -> null', keTanggalWib(null) === null);
cek('"" -> null', keTanggalWib('') === null);

console.log('\n[6] API memakai tanggal WIB');
const db = new Database(DB);
const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
const akun = db.prepare("SELECT id FROM chart_of_accounts WHERE coa_group='Beban' LIMIT 1").get();

// kirim tanpa expense_date -> harus memakai tanggal WIB hari ini
let r = await fetch(`${BASE}/api/admin/financial`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ action: 'ADD_EXPENSE', coa_account_id: akun.id, amount: 1000, description: 'UJI-T2-TANGGAL' }),
});
cek('beban tanpa tanggal diterima', r.ok, `HTTP ${r.status}`);
const exp = db.prepare("SELECT id, expense_date FROM expenses WHERE description='UJI-T2-TANGGAL'").get();
cek('tanggal tersimpan = WIB hari ini', exp?.expense_date === tanggalWib(), `tersimpan ${exp?.expense_date}, harap ${tanggalWib()}`);

const led = db.prepare('SELECT entry_date FROM ledger WHERE expense_id=?').all(exp.id);
cek('ledger memakai tanggal WIB yang sama', led.every((x) => x.entry_date === tanggalWib()),
  JSON.stringify(led.map((x) => x.entry_date)));

// tanggal tidak valid ditolak
r = await fetch(`${BASE}/api/admin/financial`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify({ action: 'ADD_EXPENSE', coa_account_id: akun.id, amount: 1000, description: 'UJI-T2-SALAH', expense_date: '2026-02-30' }),
});
cek('tanggal mustahil (2026-02-30) ditolak 400', r.status === 400, `HTTP ${r.status}`);

// bersihkan
db.prepare('DELETE FROM ledger WHERE expense_id=?').run(exp.id);
db.prepare('DELETE FROM expenses WHERE id=?').run(exp.id);
db.close();

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG T2 LULUS');
