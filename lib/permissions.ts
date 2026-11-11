/**
 * Otorisasi berbasis izin (RBAC) — travel-app.
 *
 * Sebelumnya seluruh sistem hanya mengenal `role === 'OWNER'`. Akibatnya staf
 * biasa punya akses penuh, dan menambah role lain (kasir, operasional, marketing)
 * mustahil tanpa menulis `if` baru di setiap route.
 *
 * Model di sini:
 *   users.role  -> kode role (OWNER, FINANCE, OPERASIONAL, MARKETING, VIEWER, ADMIN)
 *   roles       -> definisi role + apakah boleh menimpa role kustom
 *   permissions -> daftar izin (modul.aksi)
 *   role_permissions -> peta role -> izin
 *
 * Penegakan bertingkat:
 *   1. middleware  : tamu tidak boleh masuk (tetap seperti sebelumnya)
 *   2. route API   : requirePermission(req, 'jamaah.delete')
 *   3. UI          : menu & tombol dari permissions[] (GET /api/admin/auth/me)
 *
 * Izin hanya membatasi; ia tidak pernah memberi akses tambahan di luar yang
 * tercatat. Role yang tidak dikenal diperlakukan sebagai VIEWER (paling sedikit),
 * bukan ADMIN.
 */
import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin, type AuthResult } from '@/lib/auth';

export type PermissionCode = string;

/** Daftar izin resmi: satu baris = satu tindakan yang bisa dibatasi. */
export const PERMISSIONS: { code: string; module: string; label: string }[] = [
  { code: 'jamaah.read', module: 'jamaah', label: 'Lihat data jamaah' },
  { code: 'jamaah.create', module: 'jamaah', label: 'Tambah jamaah' },
  { code: 'jamaah.update', module: 'jamaah', label: 'Ubah data jamaah' },
  { code: 'jamaah.delete', module: 'jamaah', label: 'Hapus jamaah' },

  { code: 'paket.read', module: 'paket', label: 'Lihat paket & batch' },
  { code: 'paket.create', module: 'paket', label: 'Tambah paket/batch' },
  { code: 'paket.update', module: 'paket', label: 'Ubah paket/batch' },
  { code: 'paket.delete', module: 'paket', label: 'Hapus paket/batch' },

  { code: 'booking.read', module: 'booking', label: 'Lihat transaksi & booking' },
  { code: 'booking.create', module: 'booking', label: 'Buat booking' },
  { code: 'booking.update', module: 'booking', label: 'Ubah booking / tambah pembayaran' },
  { code: 'booking.delete', module: 'booking', label: 'Batalkan booking' },

  { code: 'payment.read', module: 'payment', label: 'Lihat pembayaran' },
  { code: 'payment.verify', module: 'payment', label: 'Setujui / tolak pembayaran' },

  { code: 'inventory.read', module: 'inventory', label: 'Lihat inventaris & stok' },
  { code: 'inventory.create', module: 'inventory', label: 'Tambah item inventaris' },
  { code: 'inventory.update', module: 'inventory', label: 'Ubah stok / serah terima' },
  { code: 'inventory.delete', module: 'inventory', label: 'Hapus item inventaris' },

  { code: 'checklist.read', module: 'checklist', label: 'Lihat checklist kelengkapan' },
  { code: 'checklist.update', module: 'checklist', label: 'Ubah status checklist' },

  { code: 'coa.manage', module: 'coa', label: 'Kelola bagan akun' },
  { code: 'journal.read', module: 'journal', label: 'Lihat jurnal & buku besar' },
  { code: 'journal.create', module: 'journal', label: 'Catat jurnal umum' },
  { code: 'journal.delete', module: 'journal', label: 'Hapus jurnal umum' },
  { code: 'expense.manage', module: 'expense', label: 'Catat & hapus beban' },

  { code: 'report.finance', module: 'report', label: 'Lihat laporan keuangan & nominal' },
  { code: 'report.operational', module: 'report', label: 'Lihat laporan operasional/manifest' },

  { code: 'settings.manage', module: 'settings', label: 'Ubah profil perusahaan & rekening' },
  { code: 'staff.manage', module: 'staff', label: 'Kelola akun staf' },
  { code: 'audit.read', module: 'audit', label: 'Lihat jejak audit' },
];

export const SEMUA_IZIN = PERMISSIONS.map((p) => p.code);

/**
 * Role bawaan. `isSystem = 1` berarti tidak boleh dihapus/diubah dari UI.
 * ADMIN sengaja tetap ada agar akun lama (admin@travel.com) tidak kehilangan akses
 * mendadak setelah migrasi; ia setara owner kecuali audit.
 */
export const ROLE_BAWAAN: { code: string; name: string; izin: string[] }[] = [
  { code: 'OWNER', name: 'Owner / Direktur', izin: SEMUA_IZIN },
  {
    code: 'ADMIN',
    name: 'Administrator (akses penuh)',
    izin: SEMUA_IZIN.filter((c) => c !== 'audit.read'),
  },
  {
    code: 'FINANCE',
    name: 'Keuangan',
    izin: [
      'jamaah.read', 'paket.read', 'booking.read', 'payment.read', 'payment.verify',
      'coa.manage', 'journal.read', 'journal.create', 'expense.manage',
      'report.finance', 'report.operational', 'inventory.read',
    ],
  },
  {
    code: 'OPERASIONAL',
    name: 'Operasional / Reservasi',
    izin: [
      'jamaah.read', 'jamaah.create', 'jamaah.update',
      'paket.read', 'paket.create', 'paket.update',
      'booking.read', 'booking.create', 'booking.update',
      'payment.read', 'inventory.read', 'inventory.update',
      'checklist.read', 'checklist.update', 'report.operational',
    ],
  },
  {
    code: 'MARKETING',
    name: 'Marketing',
    izin: [
      'jamaah.read', 'jamaah.create',
      'paket.read', 'paket.create', 'paket.update',
      'booking.read', 'booking.create',
      'report.operational',
    ],
  },
  {
    code: 'VIEWER',
    name: 'Pengamat (hanya lihat)',
    izin: [
      'jamaah.read', 'paket.read', 'booking.read', 'payment.read',
      'inventory.read', 'checklist.read', 'report.operational',
    ],
  },
];

/** Apakah kode role dikenal? Role tak dikenal diperlakukan sebagai VIEWER. */
export function roleDikenal(role: string): boolean {
  const r = db.prepare('SELECT 1 FROM roles WHERE code = ?').get(String(role || '').toUpperCase());
  return !!r;
}

/** Daftar izin efektif sebuah role. */
export function permissionsOf(role: string): string[] {
  const kode = String(role || '').trim().toUpperCase();

  /*
   * Role yang tidak terdaftar / tanpa izin = TIDAK PUNYA IZIN (kosong).
   *
   * Sebelumnya fungsi ini jatuh ke izin VIEWER, sehingga salah konfigurasi
   * (role baru belum dicentang, salah ketik kode role, atau role yang baru
   * dihapus) justru memberi akses baca — termasuk data jamaah, booking, dan
   * pembayaran — tanpa pernah muncul sebagai error. Akses harus diperoleh
   * karena sengaja diberikan, bukan karena kebetulan tidak dikenal.
   */
  if (!kode) return [];

  const rows = db
    .prepare(`SELECT p.code FROM role_permissions rp
              JOIN permissions p ON p.id = rp.permission_id
              JOIN roles r ON r.id = rp.role_id
              WHERE r.code = ?`)
    .all(kode) as { code: string }[];
  return rows.map((r) => r.code);
}

/** Cek cepat untuk dipakai di dalam route yang sudah punya sesi. */
export function boleh(role: string, code: PermissionCode): boolean {
  return permissionsOf(role).includes(code);
}

/**
 * Gerbang route: wajib login DAN wajib punya izin `code`.
 * Mengembalikan AuthResult supaya pemakaiannya sama dengan requireAdmin.
 */
export async function requirePermission(req: Request, code: PermissionCode): Promise<AuthResult> {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth;
  const role = String(auth.user?.role || '');
  if (!boleh(role, code)) {
    return {
      ok: false,
      response: NextResponse.json(
        { success: false, message: `Akses ditolak: tindakan ini membutuhkan izin "${code}".` },
        { status: 403 },
      ),
    };
  }
  return auth;
}

/* ── Jejak audit ─────────────────────────────────────────────────────── */

/**
 * Catat perubahan data. Tidak pernah melempar: kegagalan audit tidak boleh
 * membatalkan transaksi bisnis yang sudah sah.
 */
export function catatAudit(input: {
  user?: { uid?: number; email?: string } | null;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'VERIFY' | 'REJECT';
  module: string;
  recordId?: number | string | null;
  before?: unknown;
  after?: unknown;
  notes?: string;
  ip?: string | null;
}): void {
  try {
    db.prepare(`
      INSERT INTO audit_log (user_id, user_email, action, module, record_id, before_json, after_json, notes, ip)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      input.user?.uid ?? null,
      input.user?.email ?? null,
      input.action,
      input.module,
      input.recordId != null ? String(input.recordId) : null,
      input.before !== undefined ? JSON.stringify(input.before) : null,
      input.after !== undefined ? JSON.stringify(input.after) : null,
      input.notes ?? null,
      input.ip ?? null,
    );
  } catch {
    /* sengaja diabaikan */
  }
}
