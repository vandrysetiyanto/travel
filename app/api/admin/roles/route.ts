import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requirePermission, catatAudit, permissionsOf } from '@/lib/permissions';
import { menuTambahanRole } from '@/lib/role-menus';

initDB();

/**
 * Master Role — CRUD role + pengaturan menu/izin.
 *
 * Keputusan pemilik: 1 user = 1 role, tetapi isi role dapat diatur (menu bisa
 * ditambah di luar izin dasar). Role kustom boleh dibuat, dengan pengaman:
 *
 *   1. Kode role sistem (is_system=1) tidak boleh dipakai/diubah/dihapus
 *   2. Izin role baru tidak boleh melebihi izin pembuatnya (anti escalation)
 *   3. Role yang masih dipakai user tidak bisa dihapus (409) — tidak ada
 *      "user menggantung", meniru remove_roles() milik Frappe
 *   4. Nama/kode tidak boleh menyerupai role sistem (mis. "Admin2", "OWNER ")
 *   5. Setiap perubahan dicatat ke audit_log
 */
const KODE_SISTEM = () => new Set(
  (db.prepare('SELECT code FROM roles WHERE is_system = 1').all() as { code: string }[]).map((r) => r.code),
);

function normalisasiKode(v: unknown): string {
  return String(v || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 32);
}

/** Deteksi kode yang menyerupai role sistem: ADMIN2, ADMIN_X, OWNER1, VIEWERX. */
function menyerupaiSistem(kode: string, sistem: Set<string>): string | null {
  for (const s of Array.from(sistem)) {
    if (kode === s) return s;
    if (kode.startsWith(s) && kode.length > s.length) return s;
  }
  return null;
}

export async function GET(req: Request) {
  const auth = await requirePermission(req, 'staff.manage');
  if (!auth.ok) return auth.response;

  try {
    const roles = db.prepare('SELECT id, code, name, is_system, created_at FROM roles ORDER BY is_system DESC, name ASC').all() as any[];
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

    const katalog = (await import('@/lib/menu-katalog')).MENU_KATALOG;
    const sensitif = Array.from((await import('@/lib/menu-katalog')).MENU_SENSITIF);

    return NextResponse.json({
      success: true, roles, permissions: perms, matriks, userPerRole,
      menuTambahan, katalog, sensitif,
      izinSaya: permissionsOf(String(auth.user?.role || '')),
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
    const sistem = KODE_SISTEM();

    /* ── Buat role baru ────────────────────────────────────────────── */
    if (action === 'CREATE_ROLE') {
      const kode = normalisasiKode(body.code);
      const nama = String(body.name || '').trim();

      if (!kode || kode.length < 3) {
        return NextResponse.json({ success: false, message: 'Kode role minimal 3 karakter (huruf/angka/underscore).' }, { status: 400 });
      }
      if (!nama) {
        return NextResponse.json({ success: false, message: 'Nama role wajib diisi.' }, { status: 400 });
      }
      const mirip = menyerupaiSistem(kode, sistem);
      if (mirip) {
        return NextResponse.json({
          success: false,
          message: `Kode "${kode}" menyerupai role sistem "${mirip}". Pakai nama lain agar tidak tertukar.`,
        }, { status: 400 });
      }
      const sudahAda = db.prepare('SELECT id FROM roles WHERE code = ?').get(kode);
      if (sudahAda) {
        return NextResponse.json({ success: false, message: `Role ${kode} sudah ada.` }, { status: 409 });
      }

      const izinDiminta: string[] = Array.isArray(body.permissions) ? body.permissions.map(String) : [];
      const izinSaya = new Set(permissionsOf(String(auth.user?.role || '')));
      const lebih = izinDiminta.filter((p) => !izinSaya.has(p));
      if (lebih.length) {
        return NextResponse.json({
          success: false,
          message: `Tidak boleh memberi izin yang Anda sendiri tidak punya: ${lebih.join(', ')}`,
        }, { status: 403 });
      }

      const semuaIzin = db.prepare('SELECT id, code FROM permissions').all() as { id: number; code: string }[];
      const idPeta = new Map(semuaIzin.map((p) => [p.code, p.id]));
      const asing = izinDiminta.filter((p) => !idPeta.has(p));
      if (asing.length) {
        return NextResponse.json({ success: false, message: `Izin tidak dikenal: ${asing.join(', ')}` }, { status: 400 });
      }

      const hasil = db.transaction(() => {
        const ins = db.prepare('INSERT INTO roles (code, name, is_system) VALUES (?, ?, 0)').run(kode, nama);
        const rid = Number(ins.lastInsertRowid);
        const taut = db.prepare('INSERT OR IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)');
        for (const p of izinDiminta) {
          const pid = idPeta.get(p);
          if (pid) taut.run(rid, pid);
        }
        return rid;
      })();

      catatAudit({
        user: auth.user, action: 'CREATE', module: 'role', recordId: kode,
        after: { code: kode, name: nama, permissions: izinDiminta.slice().sort() },
      });

      return NextResponse.json({
        success: true,
        message: `Role ${kode} dibuat dengan ${izinDiminta.length} izin.`,
        id: hasil, code: kode,
      }, { status: 201 });
    }

    /* ── Ubah nama role kustom ─────────────────────────────────────── */
    if (action === 'UPDATE_ROLE') {
      const kode = normalisasiKode(body.code);
      const role = db.prepare('SELECT id, code, name, is_system FROM roles WHERE code = ?').get(kode) as any;
      if (!role) return NextResponse.json({ success: false, message: 'Role tidak ditemukan.' }, { status: 404 });
      if (role.is_system) {
        return NextResponse.json({ success: false, message: 'Role sistem tidak bisa diubah namanya.' }, { status: 400 });
      }
      const nama = String(body.name || '').trim();
      if (!nama) return NextResponse.json({ success: false, message: 'Nama role wajib diisi.' }, { status: 400 });

      db.prepare('UPDATE roles SET name = ? WHERE id = ?').run(nama, role.id);
      catatAudit({
        user: auth.user, action: 'UPDATE', module: 'role', recordId: kode,
        before: { name: role.name }, after: { name: nama },
      });
      return NextResponse.json({ success: true, message: `Nama role ${kode} diperbarui.` });
    }

    /* ── Hapus role kustom ─────────────────────────────────────────── */
    if (action === 'DELETE_ROLE') {
      const kode = normalisasiKode(body.code);
      const role = db.prepare('SELECT id, code, name, is_system FROM roles WHERE code = ?').get(kode) as any;
      if (!role) return NextResponse.json({ success: false, message: 'Role tidak ditemukan.' }, { status: 404 });
      if (role.is_system) {
        return NextResponse.json({ success: false, message: 'Role sistem tidak bisa dihapus.' }, { status: 400 });
      }

      // Pengaman: role yang masih dipakai TIDAK boleh dihapus -> tidak ada user menggantung.
      const dipakai = db.prepare('SELECT COUNT(*) c FROM users WHERE role = ?').get(kode) as { c: number };
      if (dipakai.c > 0) {
        return NextResponse.json({
          success: false,
          message: `Role ${kode} masih dipakai ${dipakai.c} pengguna. Pindahkan mereka ke role lain lebih dulu.`,
        }, { status: 409 });
      }

      const izinSebelum = (db.prepare(`SELECT p.code FROM role_permissions rp
        JOIN permissions p ON p.id = rp.permission_id WHERE rp.role_id = ?`).all(role.id) as { code: string }[]).map((r) => r.code);

      db.transaction(() => {
        db.prepare('DELETE FROM role_permissions WHERE role_id = ?').run(role.id);
        db.prepare('DELETE FROM role_menus WHERE role_id = ?').run(role.id);
        db.prepare('DELETE FROM roles WHERE id = ?').run(role.id);
      })();

      catatAudit({
        user: auth.user, action: 'DELETE', module: 'role', recordId: kode,
        before: { code: kode, name: role.name, permissions: izinSebelum.sort() },
      });
      return NextResponse.json({ success: true, message: `Role ${kode} dihapus.` });
    }

    /* ── Sisanya butuh kode role yang sudah ada ────────────────────── */
    const kodeRole = normalisasiKode(body.role);
    const role = db.prepare('SELECT id, code, name, is_system FROM roles WHERE code = ?').get(kodeRole) as any;
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

      // Anti escalation: tidak boleh memberi izin yang pembuatnya sendiri tidak punya.
      const izinSaya = new Set(permissionsOf(roleSaya));
      const lebih = diminta.filter((p) => !izinSaya.has(p));
      if (lebih.length) {
        return NextResponse.json({
          success: false,
          message: `Tidak boleh memberi izin yang Anda sendiri tidak punya: ${lebih.join(', ')}`,
        }, { status: 403 });
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
      const { simpanMenuRole } = await import('@/lib/role-menus');
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
