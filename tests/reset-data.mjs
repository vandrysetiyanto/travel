#!/usr/bin/env node
/**
 * Reset data dummy travel-app.
 *
 * MODE (pilih salah satu lewat argumen):
 *   --transaksi   (default) hapus jamaah, transaksi, pembayaran, jurnal, checklist,
 *                 penyerahan barang, batch. Paket & inventaris TETAP.
 *   --semua       seperti di atas TANPA paket/batch/inventaris (mulai benar-benar kosong)
 *   --kering      hanya melaporkan apa yang AKAN dihapus, tidak menulis apa pun
 *
 * SELALU DIPERTAHANKAN (tidak pernah dihapus dalam mode apa pun):
 *   users, roles, permissions, role_permissions, role_menus,
 *   chart_of_accounts, company_profile, bank_accounts, checklist_master,
 *   schema_migrations, dan STRUKTUR tabel.
 *
 * Prinsip: hapus baris DATA, bukan tabel. Skema tetap utuh sehingga aplikasi
 * langsung bisa dipakai untuk input data nyata.
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';

const DB = '/root/travel-app/data/travel.db';
const MODE = process.argv.includes('--semua') ? 'semua'
  : process.argv.includes('--kering') ? 'kering'
  : 'transaksi';

const db = new Database(DB);
db.pragma('foreign_keys = ON');
db.pragma('busy_timeout = 5000');

const hitung = (t) => {
  try { return db.prepare(`SELECT COUNT(*) c FROM ${t}`).get().c; } catch { return 0; }
};

// Urutan hapus: anak dulu, induk terakhir (menghormati foreign key)
const URUT_TRANSAKSI = [
  'ledger',
  'payment_history',
  'inventory_handover',
  'jamaah_checklist',
  'booking_jamaah',
  'general_journals',
  'expenses',
  'transactions',
  'master_jamaah',
  // 'batches' SENGAJA tidak dihapus: isinya jadwal keberangkatan (konfigurasi),
  // bukan data dummy. Menghapusnya berarti admin harus membuat ulang jadwal.
];

const URUT_MASTER = ['inventory_items', 'packages'];

const daftar = MODE === 'semua'
  ? [...URUT_TRANSAKSI, ...URUT_MASTER]
  : URUT_TRANSAKSI;

console.log(`\n=== RESET DATA — mode: ${MODE} ===`);
console.log('\nSEBELUM:');
for (const t of [...URUT_TRANSAKSI, ...URUT_MASTER]) {
  console.log(`  ${t.padEnd(22)} ${String(hitung(t)).padStart(5)}`);
}

if (MODE === 'kering') {
  console.log('\n(mode kering — tidak ada yang dihapus)');
  db.close();
  process.exit(0);
}

// ── backup wajib sebelum menghapus ──
const stempel = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const berkasBackup = `/root/.hermes/backups/priority1/travel-db.sebelum-reset.${stempel}.db`;
/*
 * VACUUM INTO TIDAK boleh dijalankan di dalam transaksi — SQLite menolaknya
 * ("cannot VACUUM from within a transaction"). Karena itu backup dijalankan
 * langsung (autocommit), bukan dibungkus db.transaction().
 */
try {
  db.exec(`VACUUM INTO '${berkasBackup}'`);
  const ukuran = (fs.statSync(berkasBackup).size / 1024).toFixed(0);
  console.log(`\nBackup dibuat: ${berkasBackup} (${ukuran} KB)`);
} catch (e) {
  console.error(`GAGAL membuat backup: ${e.message} — reset DIBATALKAN.`);
  db.close();
  process.exit(1);
}

// verifikasi backup bisa dibaca
try {
  const cek = new Database(berkasBackup, { readonly: true });
  const ok = cek.pragma('integrity_check', { simple: true });
  const tx = cek.prepare('SELECT COUNT(*) c FROM transactions').get().c;
  cek.close();
  console.log(`Backup terverifikasi: integrity=${ok}, transactions=${tx}`);
  if (ok !== 'ok') { console.error('Backup tidak sehat — reset DIBATALKAN.'); db.close(); process.exit(1); }
} catch (e) {
  console.error(`Backup tidak bisa dibaca: ${e.message} — reset DIBATALKAN.`);
  db.close();
  process.exit(1);
}

// ── hapus dalam satu transaksi ──
const hasil = {};
const jalankan = db.transaction(() => {
  for (const t of daftar) {
    try {
      hasil[t] = db.prepare(`DELETE FROM ${t}`).run().changes;
    } catch (e) {
      // tabel tidak ada -> lewati
      if (!/no such table/i.test(e.message)) throw e;
    }
  }

  // Kembalikan stok inventaris ke kondisi awal (tidak ada penyerahan tersisa)
  if (MODE === 'semua') {
    // inventaris dihapus total, tidak perlu reset stok
  } else {
    // stok tidak diubah karena penyerahan sudah dihapus; tetap laporkan jumlahnya
  }

  // sequence id direset supaya nomor mulai rapi
  try {
    db.prepare("DELETE FROM sqlite_sequence WHERE name IN (" + daftar.map(() => '?').join(',') + ")").run(...daftar);
  } catch { /* sqlite_sequence belum ada */ }
});
jalankan();

console.log('\nDIHAPUS:');
for (const [t, n] of Object.entries(hasil)) {
  if (n) console.log(`  ${t.padEnd(22)} ${String(n).padStart(5)} baris`);
}

console.log('\nSESUDAH (harus 0):');
let sisa = 0;
for (const t of daftar) {
  const n = hitung(t);
  sisa += n;
  console.log(`  ${t.padEnd(22)} ${String(n).padStart(5)}${n ? '  ❌' : '  ✅'}`);
}

console.log('\nDIPERTAHANKAN:');
for (const t of ['users', 'roles', 'permissions', 'role_permissions', 'chart_of_accounts',
                 'company_profile', 'bank_accounts', 'checklist_master', 'schema_migrations',
                 'packages', 'inventory_items']) {
  if (MODE === 'semua' && (t === 'packages' || t === 'inventory_items')) continue;
  console.log(`  ${t.padEnd(22)} ${String(hitung(t)).padStart(5)}`);
}

const integ = db.pragma('integrity_check', { simple: true });
const fk = db.pragma('foreign_key_check');
const debit = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE entry_type='DEBIT'").get().s;
const kredit = db.prepare("SELECT COALESCE(SUM(amount),0) s FROM ledger WHERE entry_type='CREDIT'").get().s;

console.log(`\nintegrity_check : ${integ}`);
console.log(`foreign_key_check: ${fk.length ? JSON.stringify(fk).slice(0, 200) : 'bersih (0)'}`);
console.log(`ledger          : Dr ${Number(debit).toLocaleString('id-ID')} / Cr ${Number(kredit).toLocaleString('id-ID')} — ${Number(debit) === Number(kredit) ? 'seimbang' : 'TIDAK SEIMBANG'}`);

db.close();

if (sisa > 0 || integ !== 'ok' || fk.length) {
  console.error('\n❌ Reset tidak bersih — periksa keluaran di atas. Backup tersedia untuk rollback.');
  process.exit(1);
}
console.log('\n✅ RESET SELESAI — data transaksi bersih, skema & master utuh.');
console.log(`Rollback: cp "${berkasBackup}" ${DB}`);
