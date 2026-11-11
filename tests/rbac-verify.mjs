#!/usr/bin/env node
/**
 * Uji logika RBAC pada SALINAN database (data produksi tidak disentuh).
 */
import Database from 'better-sqlite3';
import fs from 'node:fs';

const SRC = process.argv[2];
const TMP = '/tmp/rbac-verify.db';
if (!SRC) { console.error('pakai: node rbac-verify.mjs <path-db>'); process.exit(2); }
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(SRC + s)) fs.copyFileSync(SRC + s, TMP + s);

const db = new Database(TMP);
db.pragma('foreign_keys = ON');

let lulus = 0, gagal = 0; const jejak = [];
const cek = (n, s, d = '') => { if (s) { lulus++; console.log(`  ✅ ${n}`); } else { gagal++; jejak.push(n); console.log(`  ❌ ${n} ${d}`); } };

console.log('\n[1] Struktur');
for (const t of ['roles', 'permissions', 'role_permissions', 'audit_log']) {
  cek(`tabel ${t} ada`, !!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(t));
}
cek('audit_log punya indeks created_at', !!db.prepare("SELECT name FROM sqlite_master WHERE type='index' AND name='idx_audit_created'").get());

console.log('\n[2] Isi sinkronisasi');
const nRole = db.prepare('SELECT COUNT(*) c FROM roles').get().c;
const nIzin = db.prepare('SELECT COUNT(*) c FROM permissions').get().c;
const nPeta = db.prepare('SELECT COUNT(*) c FROM role_permissions').get().c;
cek('roles terisi (>=6 role bawaan)', nRole >= 6, `roles=${nRole}`);
cek('permissions terisi (>=30 izin)', nIzin >= 30, `izin=${nIzin}`);
cek('role_permissions terisi', nPeta > 0, `peta=${nPeta}`);

const roleCodes = db.prepare('SELECT code FROM roles').all().map(r => r.code);
for (const r of ['OWNER', 'ADMIN', 'FINANCE', 'OPERASIONAL', 'MARKETING', 'VIEWER']) {
  cek(`role ${r} ada`, roleCodes.includes(r), roleCodes.join(','));
}

console.log('\n[3] Pemetaan izin');
const izinRole = (code) => db.prepare(`SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id JOIN roles r ON r.id=rp.role_id WHERE r.code=?`).all(code).map(x => x.code);
const izinOwner = izinRole('OWNER');
cek('OWNER memegang seluruh izin', izinOwner.length === nIzin, `${izinOwner.length}/${nIzin}`);
const izinViewer = izinRole('VIEWER');
cek('VIEWER jauh lebih sedikit dari OWNER', izinViewer.length < izinOwner.length, `${izinViewer.length} vs ${izinOwner.length}`);
cek('VIEWER tidak bisa menghapus jamaah', !izinViewer.includes('jamaah.delete'));
cek('VIEWER tidak bisa kelola staf', !izinViewer.includes('staff.manage'));
cek('VIEWER tidak bisa lihat laporan keuangan', !izinViewer.includes('report.finance'));
const izinOpr = izinRole('OPERASIONAL');
cek('OPERASIONAL boleh buat booking', izinOpr.includes('booking.create'));
cek('OPERASIONAL TIDAK boleh kelola COA', !izinOpr.includes('coa.manage'));
cek('OPERASIONAL TIDAK boleh lihat laporan keuangan', !izinOpr.includes('report.finance'));
const izinFin = izinRole('FINANCE');
cek('FINANCE boleh verifikasi pembayaran', izinFin.includes('payment.verify'));
cek('FINANCE TIDAK boleh hapus jurnal', !izinFin.includes('journal.delete'));
cek('FINANCE TIDAK boleh kelola staf', !izinFin.includes('staff.manage'));

console.log('\n[4] Konsistensi');
const yatim = db.prepare('SELECT COUNT(*) c FROM role_permissions rp LEFT JOIN permissions p ON p.id=rp.permission_id WHERE p.id IS NULL').get().c;
cek('tidak ada role_permissions menunjuk izin hilang', yatim === 0, `yatim=${yatim}`);
const modul = db.prepare('SELECT DISTINCT module FROM permissions').all().map(m => m.module);
cek('izin mencakup modul inti', ['jamaah','paket','booking','payment','inventory','journal','report','staff'].every(m => modul.includes(m)), modul.join(','));

console.log('\n[5] Role user dinormalkan');
const users = db.prepare('SELECT email, role FROM users').all();
const dikenal = new Set(roleCodes);
const menyimpang = users.filter(u => !dikenal.has(String(u.role || '').toUpperCase()));
cek('semua role user dikenal sistem', menyimpang.length === 0, JSON.stringify(menyimpang));
cek('akun owner@travel.com ber-role OWNER', users.find(u => u.email === 'owner@travel.com')?.role === 'OWNER');
cek('akun admin@travel.com ber-role ADMIN', users.find(u => u.email === 'admin@travel.com')?.role === 'ADMIN');

console.log(`\n${'─'.repeat(56)}`);
console.log(`LULUS ${lulus} · GAGAL ${gagal} · role=${nRole} izin=${nIzin} peta=${nPeta}`);
db.close();
for (const s of ['', '-wal', '-shm']) if (fs.existsSync(TMP + s)) fs.unlinkSync(TMP + s);
if (gagal > 0) { console.log('Gagal: ' + jejak.join(' | ')); process.exit(1); }
console.log('🎉 VERIFIKASI RBAC LULUS');
