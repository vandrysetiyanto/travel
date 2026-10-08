import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { SESSION_COOKIE, sessionCookieOptions, createSessionToken } from '@/lib/auth';

initDB();

/** Profil staf yang sedang login (juga dipakai dashboard untuk memastikan akun masih ada). */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const user = db
      .prepare('SELECT id, name, email, role, created_at FROM users WHERE id = ?')
      .get(auth.user?.uid) as any;

    if (!user) {
      const res = NextResponse.json({ success: false, message: 'Akun tidak ditemukan.' }, { status: 401 });
      res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, path: '/', maxAge: 0 });
      return res;
    }

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

/** Ubah nama/email/password akun SENDIRI (semua staf boleh; tidak bisa mengubah role). */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const uid = Number(auth.user?.uid);

    const current = db.prepare('SELECT * FROM users WHERE id = ?').get(uid) as any;
    if (!current) {
      return NextResponse.json({ success: false, message: 'Akun tidak ditemukan.' }, { status: 404 });
    }

    const name = body.name ? String(body.name).trim() : current.name;
    const email = body.email ? String(body.email).trim().toLowerCase() : current.email;

    if (!name || !email) {
      return NextResponse.json({ success: false, message: 'Nama dan email wajib diisi.' }, { status: 400 });
    }

    const taken = db.prepare('SELECT id FROM users WHERE email = ? AND id <> ?').get(email, uid);
    if (taken) {
      return NextResponse.json({ success: false, message: 'Email sudah dipakai akun lain.' }, { status: 400 });
    }

    let passwordHash = current.password;
    if (body.password) {
      if (String(body.password).length < 8) {
        return NextResponse.json({ success: false, message: 'Password minimal 8 karakter.' }, { status: 400 });
      }
      passwordHash = await bcrypt.hash(String(body.password), 10);
    }

    db.prepare('UPDATE users SET name = ?, email = ?, password = ? WHERE id = ?').run(name, email, passwordHash, uid);

    // Email berubah -> perbarui cookie sesi supaya data di UI tidak basi.
    const token = await createSessionToken({ uid, email, name, role: current.role });
    const res = NextResponse.json({
      success: true,
      message: 'Profil berhasil diperbarui. Gunakan email baru untuk login berikutnya.',
      user: { id: uid, name, email, role: current.role },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
