/**
 * Katalog menu = SATU sumber kebenaran untuk:
 *   - daftar menu yang bisa dicentang pada Master Role
 *   - render sidebar dashboard
 *   - pengecekan akses tab aktif
 *
 * Dulu peta menu hidup di dalam dashboard/page.tsx (20 item, ikon JSX), sehingga
 * server tidak tahu menu apa saja yang ada dan role tidak bisa disetting per menu.
 * Sekarang katalog ini murni data (tanpa JSX) supaya bisa dipakai di server
 * (API roles) maupun di klien (dashboard).
 *
 * Aturan:
 *   - `code`       = id tab di dashboard (harus sama dengan nilai `Tab`)
 *   - `permission` = izin yang WAJIB dimiliki agar menu tampil
 *   - `alwaysOn`   = selalu tampil untuk semua yang login (Dashboard Overview)
 *   - `group`      = pengelompokan sidebar
 */
export type MenuItem = {
  code: string;
  label: string;
  perm: string | null;
  icon: string;
  group: string;
  urutan: number;
  alwaysOn?: boolean;
};

export const MENU_GROUPS: { name: string; urutan: number }[] = [
  { name: 'Utama', urutan: 0 },
  { name: 'Master Data', urutan: 1 },
  { name: 'Transaksi & Akuntansi', urutan: 2 },
  { name: 'Operasional & Jamaah', urutan: 3 },
  { name: 'Laporan & Keuangan', urutan: 4 },
  { name: 'Pengaturan & Akses', urutan: 5 },
];

export const MENU_KATALOG: MenuItem[] = [
  { code: 'dashboard', label: 'Dashboard Overview', perm: null, icon: 'LayoutDashboard', group: 'Utama', urutan: 1, alwaysOn: true },

  { code: 'jamaah', label: 'Data Jamaah', perm: 'jamaah.read', icon: 'Users', group: 'Master Data', urutan: 10 },
  { code: 'paket', label: 'Paket Perjalanan', perm: 'paket.read', icon: 'Package', group: 'Master Data', urutan: 11 },
  { code: 'batches', label: 'Jadwal & Batch', perm: 'paket.read', icon: 'Plane', group: 'Master Data', urutan: 12 },
  { code: 'inventory', label: 'Inventaris & Stok', perm: 'inventory.read', icon: 'Boxes', group: 'Master Data', urutan: 13 },
  { code: 'master-coa', label: 'Master Akun COA', perm: 'coa.manage', icon: 'Calculator', group: 'Master Data', urutan: 14 },

  { code: 'transaksi', label: 'Transaksi & Booking', perm: 'booking.read', icon: 'ShoppingBag', group: 'Transaksi & Akuntansi', urutan: 20 },
  { code: 'pembayaran', label: 'Verifikasi Pembayaran', perm: 'payment.read', icon: 'Receipt', group: 'Transaksi & Akuntansi', urutan: 21 },
  { code: 'general-journal', label: 'Jurnal Umum (Memorial)', perm: 'journal.read', icon: 'BookOpen', group: 'Transaksi & Akuntansi', urutan: 22 },
  { code: 'expenses', label: 'Beban Operasional', perm: 'expense.manage', icon: 'CreditCard', group: 'Transaksi & Akuntansi', urutan: 23 },

  { code: 'manifest', label: 'Manifest Keberangkatan', perm: 'report.operational', icon: 'Plane', group: 'Operasional & Jamaah', urutan: 30 },
  { code: 'registrations', label: 'Registrasi Online', perm: 'booking.read', icon: 'ClipboardList', group: 'Operasional & Jamaah', urutan: 31 },
  { code: 'checklist', label: 'Checklist Kelengkapan', perm: 'checklist.read', icon: 'CheckSquare', group: 'Operasional & Jamaah', urutan: 32 },

  { code: 'laporan', label: 'Laporan Keuangan', perm: 'report.finance', icon: 'TrendingUp', group: 'Laporan & Keuangan', urutan: 40 },
  { code: 'laba-rugi', label: 'Laporan Laba Rugi', perm: 'report.finance', icon: 'FileText', group: 'Laporan & Keuangan', urutan: 41 },
  { code: 'neraca', label: 'Laporan Neraca', perm: 'report.finance', icon: 'Calculator', group: 'Laporan & Keuangan', urutan: 42 },
  { code: 'arus-kas', label: 'Laporan Arus Kas', perm: 'report.finance', icon: 'Wallet', group: 'Laporan & Keuangan', urutan: 43 },
  { code: 'ledger', label: 'Jurnal Buku Besar', perm: 'journal.read', icon: 'FileSpreadsheet', group: 'Laporan & Keuangan', urutan: 44 },
  { code: 'stock-ledger', label: 'Mutasi Stok Gudang', perm: 'inventory.read', icon: 'Boxes', group: 'Laporan & Keuangan', urutan: 45 },

  { code: 'settings', label: 'Profil Tour & Travel', perm: 'settings.manage', icon: 'Building2', group: 'Pengaturan & Akses', urutan: 50 },
  { code: 'staf', label: 'Kelola Staf', perm: 'staff.manage', icon: 'ShieldCheck', group: 'Pengaturan & Akses', urutan: 51 },
  { code: 'roles', label: 'Izin per Role', perm: 'staff.manage', icon: 'KeyRound', group: 'Pengaturan & Akses', urutan: 52 },
  { code: 'audit', label: 'Log Aktivitas', perm: 'audit.read', icon: 'History', group: 'Pengaturan & Akses', urutan: 53 },
];

/** Semua kode menu yang sah (untuk validasi input). */
export const KODE_MENU = MENU_KATALOG.map((m) => m.code);

/**
 * Menu yang tampil untuk sebuah role.
 *
 * `tambahan` adalah pengecualian yang diberikan pemilik: menu yang boleh dibuka
 * walau izin dasarnya tidak dimiliki (mis. role FINANCE diberi menu Kasir).
 * Menu yang butuh izin lebih dari sekadar "melihat" (mis. `settings.manage`,
 * `staff.manage`, `audit.read`) TIDAK boleh dibuka lewat tambahan — kalau boleh,
 * pengecualian menu berubah menjadi pemberian izin penuh dan pengaman hilang.
 */
export const MENU_SENSITIF = new Set(['settings', 'staf', 'roles', 'audit']);

export function menuUntukRole(izin: string[], tambahan: string[] = []): string[] {
  const setIzin = new Set(izin);
  const setTambahan = new Set(tambahan);
  return MENU_KATALOG
    .filter((m) => {
      if (m.alwaysOn) return true;
      if (m.perm && setIzin.has(m.perm)) return true;
      if (setTambahan.has(m.code)) return !MENU_SENSITIF.has(m.code);
      return false;
    })
    .map((m) => m.code);
}

/** Apakah kode menu valid? */
export function menuValid(code: string): boolean {
  return KODE_MENU.includes(code);
}
