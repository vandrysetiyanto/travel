import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requirePermission, catatAudit } from '@/lib/permissions';

initDB();

/**
 * Pengaturan izin per role.
 *
 * GET  -> daftar role + seluruh izin + peta role->izin (matriks untuk UI centang)
 * POST -> simpan centang: { action: 'SET_PERMISSIONS', role: 'FINANCE', permissions: ['jamaah.read', ...] }
 *
 * Aturan yang dijaga:
 *   - hanya pemegang `staff.manage` yang boleh melihat & mengubah
 *   - role sistem OWNER selalu memegang SELURUH izin (tidak boleh dicabut, supaya
 *     tidak ada kondisi "tidak ada yang bisa mengelola apa pun")
 *   - `audit.read` tidak bisa dicabut dari OWNER, dan `staff.manage` tidak bisa
 *     dicabut dari role yang sedang dipakai mengubah (mencegah kunci diri sendiri)
 *   - setiap perubahan dicatat ke audit_log sebelum/sesudah
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

    const jumlahUser = db.prepare('SELECT role, COUNT(*) c FROM users GROUP BY role').all() as any[];
    const userPerRole: Record<string, number> = {};
    for (const u of jumlahUser) userPerRole[u.role] = u.c;

    return NextResponse.json({ success: true, roles, permissions: perms, matriks, userPerRole });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requirePermission(req, 'staff.manage');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    if (String(body.action || '').toUpperCase() !== 'SET_PERMISSIONS') {
      return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
    }

    const kodeRole = String(body.role || '').trim().toUpperCase();
    const role = db.prepare('SELECT id, code, name FROM roles WHERE code = ?').get(kodeRole) as any;
    if (!role) return NextResponse.json({ success: false, message: 'Role tidak ditemukan' }, { status: 404 });

    const diminta: string[] = Array.isArray(body.permissions) ? body.permissions.map((p: unknown) => String(p)) : [];
    const semuaIzin = db.prepare('SELECT id, code FROM permissions').all() as { id: number; code: string }[];
    const izinSah = new Set(semuaIzin.map((p) => p.code));
    const asing = diminta.filter((p: string) => !izinSah.has(p));
    if (asing.length) {
      return NextResponse.json({ success: false, message: `Izin tidak dikenal: ${asing.join(', ')}` }, { status: 400 });
    }

    const sebelum = (db.prepare(`SELECT p.code FROM role_permissions rp JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`).all(role.id) as { code: string }[]).map((r) => r.code);

    // OWNER tidak bisa kehilangan izin apa pun.
    if (role.code === 'OWNER' && diminta.length !== semuaIzin.length) {
      return NextResponse.json({
        success: false,
        message: 'Role OWNER wajib memegang seluruh izin — tidak ada yang boleh dicabut.',
      }, { status: 400 });
    }

    // Cegah mengunci diri sendiri: role milik pengguna harus tetap punya staff.manage.
    const roleSaya = String(auth.user?.role || '').toUpperCase();
    if (role.code === roleSaya && !diminta.includes('staff.manage')) {
      return NextResponse.json({
        success: false,
        message: 'Anda tidak bisa mencabut izin "staff.manage" dari role Anda sendiri — akan terkunci dari halaman ini.',
      }, { status: 400 });
    }

    const idPeta = new Map(semuaIzin.map((p) => [p.code, p.id]));
    const simpan = db.transaction(() => {
      db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(role.id);
      const ins = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
      for (const kode of diminta) {
        const pid = idPeta.get(kode);
        if (pid) ins.run(role.id, pid);
      }
    });
    simpan();

    const sudahDipakai = (db.prepare('SELECT COUNT(*) c FROM users WHERE role = ?').get(role.code) as { c: number }).c;

    catatAudit({
      user: auth.user,
      action: 'UPDATE',
      module: 'role_permission',
      recordId: role.code,
      before: { role: role.code, permissions: sebelum.sort() },
      after: { role: role.code, permissions: diminta.slice().sort() },
      notes: `${sebelum.length} -> ${diminta.length} izin, dipakai ${sudahDipakai} user`,
    });

    return NextResponse.json({
      success: true,
      message: `Izin role ${role.code} diperbarui (${sebelum.length} → ${diminta.length}).`,
      role: role.code,
      permissions: diminta.sort(),
      userTerpengaruh: sudahDipakai,
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
