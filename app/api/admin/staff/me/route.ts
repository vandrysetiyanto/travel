import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db, { initDB } from '@/lib/db';
import { requireAdmin, SESSION_COOKIE, sessionCookieOptions, createSessionToken } from '@/lib/auth';
import { permissionsOf, roleDikenal } from '@/lib/permissions';
import { menuEfektif } from '@/lib/role-menus';

initDB();

/**
 * Identitas pengguna + IZIN + MENU yang boleh tampil.
 *
 * Dashboard merender sidebar dari daftar yang diputuskan server di sini.
 * Sebelumnya peta menu hidup di komponen (20 item, ikon JSX) sehingga server
 * tidak tahu menu apa yang ada dan role tidak bisa disetting per menu.
 *
 * Izin = apa yang boleh DILAKUKAN (dipakai requirePermission di tiap route).
 * Menu = apa yang TAMPIL (izin + pengecualian menu per role, mis. FINANCE
 *        yang diberi menu Kasir). Menu tidak pernah menambah izin.
 */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  const data = payloadMe(Number(auth.user?.uid));
  if (!data.success) {
    const res = NextResponse.json(data, { status: 401 });
    res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
    return res;
  }
  return NextResponse.json(data);
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const uid = Number(auth.user?.uid);
    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(uid) as any;
    if (!current) return NextResponse.json({ success: false, message: 'Akun tidak ditemukan.' }, { status: 404 });

    const name = body.name ? String(body.name).trim() : current.name;
    const email = body.email ? String(body.email).trim().toLowerCase() : current.email;
    if (!name || !email) {
      return NextResponse.json({ success: false, message: 'Nama dan email wajib diisi.' }, { status: 400 });
    }

    const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(email, uid);
    if (taken) return NextResponse.json({ success: false, message: 'Email sudah dipakai akun lain.' }, { status: 400 });

    let passwordHash = current.password;
    if (body.password) {
      if (String(body.password).length < 8) {
        return NextResponse.json({ success: false, message: 'Password minimal 8 karakter.' }, { status: 400 });
      }
      passwordHash = await bcrypt.hash(String(body.password), 10);
    }

    db.prepare('UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?').run(name, email, passwordHash, uid);

    const token = await createSessionToken({ uid, email, name, role: current.role });
    const data = payloadMe(uid);
    const res = NextResponse.json({
      ...data,
      message: 'Profil berhasil diperbarui. Gunakan email baru untuk login berikutnya.',
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

/** Susun respons standar: user, role, izin, dan menu yang boleh tampil. */
function payloadMe(uid: number) {
  const user = db
    .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
    .get(uid) as any;

  if (!user) return { success: false as const, message: 'Akun tidak ditemukan.' };

  const role = String(user.role || '').toUpperCase();
  const izin = permissionsOf(role);
  const menu = menuEfektif(role, izin);

  return {
    success: true as const,
    user,
    roleDikenal: roleDikenal(role),
    permissions: izin,
    menu,
  };
}
