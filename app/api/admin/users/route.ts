import { NextResponse } from 'next/server';
import { galatServer } from '@/lib/galat';
import bcrypt from 'bcryptjs';
import db, { initDB } from '@/lib/db';
import { requirePermission, catatAudit } from '@/lib/permissions';

initDB();

/**
 * Daftar role yang sah. Sebelumnya role apa pun selain 'OWNER' dipaksa menjadi
 * 'ADMIN', sehingga pilihan "STAFF" di UI diam-diam berubah jadi admin penuh.
 * Sekarang role divalidasi ke tabel `roles` (sumber kebenaran RBAC).
 */
function roleSah(v: unknown): string | null {
  const r = String(v || '').trim().toUpperCase();
  const row = db.prepare('SELECT code FROM roles WHERE code = ?').get(r) as { code: string } | undefined;
  return row ? row.code : null;
}

/** id role dari kodenya — dipakai mengisi users.role_id (sumber FK). */
function idRole(kode: string | null | undefined): number | null {
  if (!kode) return null;
  const row = db.prepare('SELECT id FROM roles WHERE code = ?').get(String(kode).toUpperCase()) as
    | { id: number }
    | undefined;
  return row ? row.id : null;
}

/** Daftar staf — hanya pemegang staff.manage. */
export async function GET(req: Request) {
  const auth = await requirePermission(req, 'staff.manage');
  if (!auth.ok) return auth.response;

  try {
    const users = db.prepare('SELECT id, name, email, role, role_id, created_at FROM users ORDER BY created_at DESC').all();
    const roles = db.prepare('SELECT code, name, is_system FROM roles ORDER BY is_system DESC, name ASC').all();
    return NextResponse.json({ success: true, users, roles });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/users' });
  }
}

/** Kelola staf — hanya pemegang staff.manage. Password SELALU disimpan sebagai hash bcrypt. */
export async function POST(req: Request) {
  const auth = await requirePermission(req, 'staff.manage');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'CREATE_USER') {
      const { name, email, password, role } = body;
      if (!name || !email || !password) {
        return NextResponse.json({ success: false, message: 'Nama, email, dan password wajib diisi' }, { status: 400 });
      }
      if (String(password).length < 8) {
        return NextResponse.json({ success: false, message: 'Password minimal 8 karakter' }, { status: 400 });
      }
      const cleanEmail = String(email).trim().toLowerCase();
      const exist = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
      if (exist) {
        return NextResponse.json({ success: false, message: 'Email sudah terdaftar' }, { status: 400 });
      }
      const roleFinal = roleSah(role) ?? 'VIEWER';

      /*
       * ID user baru dipakai sebagai recordId audit (bukan email di kolom notes).
       * `lastInsertRowid` adalah id baris yang baru dibuat — inilah identitas yang
       * benar untuk menghubungkan jejak audit ke objeknya.
       */
      const info = db.prepare('INSERT INTO users (name, email, password, role, role_id) VALUES (?, ?, ?, ?, ?)').run(
        name,
        cleanEmail,
        bcrypt.hashSync(String(password), 10),
        roleFinal,
        idRole(roleFinal),
      );
      const baruId = Number(info.lastInsertRowid);

      catatAudit({
        user: auth.user,
        action: 'CREATE',
        module: 'user',
        recordId: baruId,
        after: { id: baruId, name, email: cleanEmail, role: roleFinal },
      });

      return NextResponse.json({ success: true, message: 'User berhasil dibuat', id: baruId });
    }

    if (action === 'UPDATE_USER') {
      const { id, name, email, password, role } = body;
      if (!id) return NextResponse.json({ success: false, message: 'ID user wajib dikirim' }, { status: 400 });
      if (!name || !email) return NextResponse.json({ success: false, message: 'Nama dan email wajib diisi' }, { status: 400 });

      const cleanEmail = String(email).trim().toLowerCase();
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
      if (!target) return NextResponse.json({ success: false, message: 'User tidak ditemukan' }, { status: 404 });

      const roleBaru = roleSah(role) ?? target.role;

      if (target.role === 'OWNER' && roleBaru !== 'OWNER') {
        const owners = db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'OWNER'`).get() as any;
        if (owners.c <= 1) {
          return NextResponse.json({ success: false, message: 'Tidak dapat menurunkan role satu-satunya akun Owner' }, { status: 400 });
        }
      }

      const bentrok = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(cleanEmail, id) as any;
      if (bentrok) {
        return NextResponse.json({ success: false, message: 'Email sudah dipakai user lain' }, { status: 400 });
      }

      if (password) {
        if (String(password).length < 8) {
          return NextResponse.json({ success: false, message: 'Password minimal 8 karakter' }, { status: 400 });
        }
        db.prepare('UPDATE users SET name = ?, email = ?, password = ?, role = ?, role_id = ? WHERE id = ?').run(
          name, cleanEmail, bcrypt.hashSync(String(password), 10), roleBaru, idRole(roleBaru), id,
        );
      } else {
        db.prepare('UPDATE users SET name = ?, email = ?, role = ?, role_id = ? WHERE id = ?')
          .run(name, cleanEmail, roleBaru, idRole(roleBaru), id);
      }

      catatAudit({
        user: auth.user,
        action: 'UPDATE',
        module: 'user',
        recordId: Number(id),
        before: { id: target.id, name: target.name, email: target.email, role: target.role },
        after: { id: Number(id), name, email: cleanEmail, role: roleBaru, password_diubah: !!password },
      });

      return NextResponse.json({ success: true, message: 'User berhasil diperbarui' });
    }

    if (action === 'DELETE_USER') {
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, message: 'ID user wajib dikirim' }, { status: 400 });

      const count = db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'OWNER'`).get() as any;
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
      if (!target) return NextResponse.json({ success: false, message: 'User tidak ditemukan' }, { status: 404 });
      if (target.role === 'OWNER' && count.c <= 1) {
        return NextResponse.json({ success: false, message: 'Tidak dapat menghapus satu-satunya akun Owner' }, { status: 400 });
      }
      if (Number(id) === auth.user?.uid) {
        return NextResponse.json({ success: false, message: 'Tidak dapat menghapus akun Anda sendiri' }, { status: 400 });
      }

      db.prepare('DELETE FROM users WHERE id = ?').run(id);

      catatAudit({
        user: auth.user,
        action: 'DELETE',
        module: 'user',
        recordId: Number(id),
        before: { id: target.id, name: target.name, email: target.email, role: target.role },
      });

      return NextResponse.json({ success: true, message: 'User berhasil dihapus' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/users' });
  }
}
