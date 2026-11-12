/**
 * Sinkronisasi RBAC ke database (idempoten, aman dijalankan setiap boot).
 *
 * Yang dilakukan:
 *   1. Membuat tabel roles / permissions / role_permissions / audit_log
 *   2. Mengisi daftar izin & role bawaan
 *   3. Memeriksa users.role yang tidak dikenal — HANYA dilaporkan, TIDAK diubah
 *   4. Mencatat profil lama (jika ada) ke audit_log sekali
 *
 * Tidak pernah menghapus izin dari role yang sudah ada secara manual — hanya
 * menambah yang belum ada, supaya penyesuaian manual tidak hilang saat restart.
 *
 * PENTING: role yang tidak dikenal TIDAK lagi ditimpa menjadi VIEWER.
 * Menimpa diam-diam bertentangan dengan default-deny di permissionsOf():
 * salah ketik nama role justru memberi 7 izin baca (jamaah/booking/pembayaran)
 * tanpa pernah muncul sebagai masalah. Sekarang role seperti itu dibiarkan
 * (0 izin) dan ditampilkan di Master Role untuk diperbaiki secara eksplisit
 * lewat /api/admin/roles/orphan.
 */
import type Database from 'better-sqlite3';
import { PERMISSIONS, ROLE_BAWAAN, SEMUA_IZIN } from '@/lib/permissions';

/**
 * Menerima koneksi sebagai parameter, BUKAN mengimpor '@/lib/db'.
 *
 * Sebelumnya modul ini mengimpor lib/db sementara lib/db memanggilnya dari
 * dalam initDB() -> circular import. Di build produksi Next itu berakibat
 * "Cannot access 'c' before initialization", sehingga sinkronRBAC() dan seluruh
 * migrasi sesudahnya gagal diam-diam (tertelan try/catch di db.ts).
 */
export function sinkronRBAC(db: Database.Database): { izin: number; role: number; dinormalkan: number; menggantung: number } {
  db.exec(`
    CREATE TABLE IF NOT EXISTS roles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      is_system INTEGER NOT NULL DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS permissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT NOT NULL UNIQUE,
      module TEXT NOT NULL,
      label TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS role_permissions (
      role_id INTEGER NOT NULL,
      permission_id INTEGER NOT NULL,
      PRIMARY KEY (role_id, permission_id),
      FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE,
      FOREIGN KEY (permission_id) REFERENCES permissions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS audit_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      user_email TEXT,
      action TEXT NOT NULL,
      module TEXT NOT NULL,
      record_id TEXT,
      before_json TEXT,
      after_json TEXT,
      notes TEXT,
      ip TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_log(created_at DESC);
    CREATE INDEX IF NOT EXISTS idx_audit_module ON audit_log(module, record_id);
  `);

  const insIzin = db.prepare('INSERT OR IGNORE INTO permissions (code, module, label) VALUES (?, ?, ?)');
  const updIzin = db.prepare('UPDATE permissions SET module = ?, label = ? WHERE code = ?');
  let jmlIzin = 0;
  for (const p of PERMISSIONS) {
    insIzin.run(p.code, p.module, p.label);
    updIzin.run(p.module, p.label, p.code);
    jmlIzin++;
  }

  const insRole = db.prepare('INSERT OR IGNORE INTO roles (code, name, is_system) VALUES (?, ?, 1)');
  const updRole = db.prepare('UPDATE roles SET name = ? WHERE code = ? AND is_system = 1');
  for (const r of ROLE_BAWAAN) {
    insRole.run(r.code, r.name);
    updRole.run(r.name, r.code);
  }

  // Peta izin: hanya MENAMBAH yang belum ada.
  const idRole = (code: string) =>
    (db.prepare('SELECT id FROM roles WHERE code = ?').get(code) as { id: number } | undefined)?.id;
  const idIzin = (code: string) =>
    (db.prepare('SELECT id FROM permissions WHERE code = ?').get(code) as { id: number } | undefined)?.id;
  const insPeta = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');

  const tambah = db.transaction(() => {
    for (const r of ROLE_BAWAAN) {
      const rid = idRole(r.code);
      if (!rid) continue;
      for (const kode of r.izin) {
        const pid = idIzin(kode);
        if (pid) insPeta.run(rid, pid);
      }
    }
  });
  tambah();

  /*
   * Role di users yang tidak dikenal: JANGAN ditimpa.
   *
   * Hanya penulisan ULANG yang aman yang dilakukan, yaitu merapikan spasi/besar
   * kecil bila role-nya memang terdaftar (mis. 'owner' -> 'OWNER'). Role asing
   * dibiarkan apa adanya sehingga izinnya kosong (default deny) dan muncul di
   * Master Role sebagai "role menggantung" untuk diperbaiki oleh pemilik.
   */
  const dikenal = new Set(
    (db.prepare('SELECT code FROM roles').all() as { code: string }[]).map((r) => r.code),
  );
  const users = db.prepare('SELECT id, email, role FROM users').all() as { id: number; email: string; role: string }[];
  const setRole = db.prepare('UPDATE users SET role = ? WHERE id = ?');
  let dinormalkan = 0;
  let menggantung = 0;
  const norma = db.transaction(() => {
    for (const u of users) {
      const kode = String(u.role || '').trim().toUpperCase();
      if (!dikenal.has(kode)) {
        menggantung++;      // dilaporkan saja — TIDAK diubah menjadi VIEWER
        continue;
      }
      if (kode !== u.role) {
        setRole.run(kode, u.id);   // hanya merapikan format, bukan mengganti role
        dinormalkan++;
      }
    }
  });
  norma();

  if (menggantung > 0) {
    console.warn(
      `[sinkronRBAC] ${menggantung} pengguna memakai role yang tidak terdaftar. ` +
      'Role dibiarkan (0 izin) — perbaiki lewat Master Role.',
    );
  }

  // Pastikan OWNER selalu memegang seluruh izin yang terdaftar (izin baru ikut masuk).
  const ridOwner = idRole('OWNER');
  if (ridOwner) {
    const cek = db.prepare('SELECT COUNT(*) c FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?').get(ridOwner) as { c: number };
    if (cek.c < SEMUA_IZIN.length) {
      const isi = db.transaction(() => {
        for (const kode of SEMUA_IZIN) {
          const pid = idIzin(kode);
          if (pid) insPeta.run(ridOwner, pid);
        }
      });
      isi();
    }
  }

  return { izin: jmlIzin, role: ROLE_BAWAAN.length, dinormalkan, menggantung };
}
