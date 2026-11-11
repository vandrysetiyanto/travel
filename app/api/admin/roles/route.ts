import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requirePermission, catatAudit } from '@/lib/permissions';
import { katalogUntukRole, simpanMenuRole, menuTambahanRole } from '@/lib/role-menus';

initDB();

/**
 * Master Role — 1 user = 1 role, tetapi isi role bisa diatur:
 *   - MENU : menu apa yang tampil untuk role ini (bisa menambah menu di luar
 *            izin dasarnya, mis. FINANCE dikasih menu Kasir)
 *   - IZIN : tindakan apa yang boleh dilakukan (modul.aksi)
 *
 * Menu dan izin dipisah supaya pengecualian tampilan tidak otomatis menjadi
 * pemberian hak. Contoh: memberi menu "Beban Operasional" ke FINANCE tidak
 * memberi izin `expense.manage` bila tidak dicentang.
 *
 * Pengaman:
 *   - menu sensitif (settings/staf/roles/audit) tidak bisa dibuka lewat pengecualian
 *   - OWNER wajib memegang seluruh izin
 *   - staff.manage tidak bisa dicabut dari role sendiri (anti terkunci)
 *   - setiap perubahan dicatat ke audit_log
 */
export async function GET(req: Request) {
  const auth = await requirePermission(req, 'staff.manage');
  if (!auth.ok) return auth.response;

  try {
    const roles = db.prepare('SELECT id, code, name, is_system FROM roles ORDER BY is_system DESC, name ASC').all() as any[];
    const perms = db.prepare('SELECT id, code, module, label FROM permissions ORDER BY module, code').all() as any[];
    const peta = db.prepare(`SELECT r.code AS role, p.code AS permission
                             FROM role_permissions rp
                             JOIN roles r ON r.id = rp.role_id
                             JOIN permissions p ON p.id = rp.permission_id`).all() as any[];

    const matriks: Record<string, string[]> = {};
    for (const r of roles) matriks[r.code] = [];
    for (const row of peta) (matriks[row.role] ||= []).push(row.permission);

    const menuTambahan: Record<string, string[]> = {};
    for (const r of roles) menuTambahan[r.code] = menuTambahanRole(r.code);

    const jumlahUser = db.prepare('SELECT role, COUNT(*) c FROM users GROUP BY role').all() as any[];
    const userPerRole: Record<string, number> = {};
    for (const u of jumlahUser) userPerRole[u.role] = u.c;

    // katalog menu dengan penanda sensitif
    const contoh = roles[0]?.code || 'OWNER';
    const katalog = katalogUntukRole(contoh).katalog;
    const sensitif = ['settings', 'staf', 'roles', 'audit'];

    return NextResponse.json({
      success: true, roles, permissions: perms, matriks, userPerRole,
      menuTambahan, katalog, sensitif,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermission(req, 'staff.manage');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const action = String(body.action || '').toUpperCase();
    const kodeRole = String(body.role || '').trim().toUpperCase();
    const role = db.prepare('SELECT id, code, name FROM roles WHERE code = ?').get(kodeRole) as any;
    if (!role) return NextResponse.json({ success: false, message: 'Role tidak ditemukan' }, { status: 404 });

    /* ── Simpan centang IZIN ───────────────────────────────────────── */
    if (action === 'SET_PERMISSIONS') {
      const diminta: string[] = Array.isArray(body.permissions) ? body.permissions.map((p: unknown) => String(p)) : [];
      const semuaIzin = db.prepare('SELECT id, code FROM permissions').all() as { id: number; code: string }[];
      const izinSah = new Set(semuaIzin.map((p) => p.code));
      const asing = diminta.filter((p: string) => !izinSah.has(p));
      if (asing.length) {
        return NextResponse.json({ success: false, message: `Izin tidak dikenal: ${asing.join(', ')}` }, { status: 400 });
      }

      const sebelum = (db.prepare(`SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`).all(role.id) as { code: string }[]).map((r) => r.code);

      if (role.code === 'OWNER' && diminta.length !== semuaIzin.length) {
        return NextResponse.json({ success: false, message: 'Role OWNER wajib memegang seluruh izin — tidak ada yang boleh dicabut.' }, { status: 400 });
      }
      const roleSaya = String(auth.user?.role || '').toUpperCase();
      if (role.code === roleSaya && !diminta.includes('staff.manage')) {
        return NextResponse.json({ success: false, message: 'Anda tidak bisa mencabut izin "staff.manage" dari role Anda sendiri — akan terkunci dari halaman ini.' }, { status: 400 });
      }

      const idPeta = new Map(semuaIzin.map((p) => [p.code, p.id]));
      db.transaction(() => {
        db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(role.id);
        const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
        for (const kode of diminta) {
          const pid = idPeta.get(kode);
          if (pid) ins.run(role.id, pid);
        }
      })();

      catatAudit({
        user: auth.user, action: 'UPDATE', module: 'role_permission', recordId: role.code,
        before: { permissions: sebelum.sort() }, after: { permissions: diminta.slice().sort() },
      });

      return NextResponse.json({
        success: true,
        message: `Izin role ${role.code} diperbarui (${sebelum.length} → ${diminta.length}).`,
        permissions: diminta.sort(),
      });
    }

    /* ── Simpan centang MENU (pengecualian tampilan) ───────────────── */
    if (action === 'SET_MENUS') {
      const diminta: string[] = Array.isArray(body.menus) ? body.menus.map((m: unknown) => String(m)) : [];
      const sebelum = menuTambahanRole(role.code);
      const hasil = simpanMenuRole(role.id, diminta);

      catatAudit({
        user: auth.user, action: 'UPDATE', module: 'role_menu', recordId: role.code,
        before: { menus: sebelum.sort() }, after: { menus: diminta.slice().sort() },
        notes: hasil.ditolak.length ? `ditolak: ${hasil.ditolak.join(', ')}` : undefined,
      });

      return NextResponse.json({
        success: true,
        message: `Menu role ${role.code} diperbarui (${hasil.disimpan} menu tambahan).` +
          (hasil.ditolak.length ? ` ${hasil.ditolak.length} menu sensitif/tidak dikenal ditolak.` : ''),
        menus: diminta.filter((m) => !hasil.ditolak.includes(m)),
        ditolak: hasil.ditolak,
      });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
