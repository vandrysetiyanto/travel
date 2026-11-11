/**
 * Menu efektif per role (dengan pengecualian).
 *
 * Izin (`role_permissions`) menentukan APA YANG BOLEH DILAKUKAN.
 * Menu (`role_menus`) menentukan APA YANG TAMPIL.
 *
 * Pemisahan ini perlu karena pemilik ingin fleksibilitas tampilan, mis.
 * "role FINANCE tapi dikasih menu Kasir", tanpa harus mengubah izin dasarnya.
 *
 * Pengaman: menu yang menyangkut pengaturan/akses (settings, staf, roles, audit)
 * TIDAK bisa dibuka lewat pengecualian menu — kalau boleh, pengecualian tampilan
 * akan berubah menjadi pemberian hak penuh dan seluruh RBAC kehilangan arti.
 */
import db from '@/lib/db';
import { MENU_KATALOG, MENU_SENSITIF, menuUntukRole, menuValid } from '@/lib/menu-katalog';

export function menuTambahanRole(roleCode: string): string[] {
  const rows = db
    .prepare(`SELECT rm.menu_code FROM role_menus rm
              JOIN roles r ON r.id = rm.role_id
              WHERE r.code = ?`)
    .all(String(roleCode || '').trim().toUpperCase()) as { menu_code: string }[];
  return rows.map((r) => r.menu_code);
}

/** Daftar kode menu yang tampil untuk role (izin + pengecualian). */
export function menuEfektif(roleCode: string, izin: string[]): string[] {
  return menuUntukRole(izin, menuTambahanRole(roleCode));
}

/** Simpan pengecualian menu sebuah role (menggantikan daftar lama). */
export function simpanMenuRole(roleId: number, kodeMenu: string[]): { disimpan: number; ditolak: string[] } {
  const ditolak: string[] = [];
  const bersih: string[] = [];
  for (const kode of kodeMenu) {
    if (!menuValid(kode)) { ditolak.push(kode); continue; }
    if (MENU_SENSITIF.has(kode)) { ditolak.push(kode); continue; }
    bersih.push(kode);
  }

  const simpan = db.transaction(() => {
    db.prepare('DELETE FROM role_menus WHERE role_id = ?').run(roleId);
    const ins = db.prepare('INSERT OR IGNORE INTO role_menus (role_id, menu_code) VALUES (?, ?)');
    for (const kode of bersih) ins.run(roleId, kode);
  });
  simpan();

  return { disimpan: bersih.length, ditolak };
}

/** Katalog menu lengkap + pengecualian, untuk halaman Master Role. */
export function katalogUntukRole(roleCode: string) {
  const tambahan = menuTambahanRole(roleCode);
  return {
    katalog: MENU_KATALOG,
    tambahan,
  };
}
