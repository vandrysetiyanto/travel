import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db, { initDB } from '@/lib/db';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';

initDB();

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email dan password wajib diisi.' }, { status: 400 });
    }

    // Pesan error disamakan untuk email tidak ada / password salah (jangan bocorkan mana yang salah).
    const WRONG = NextResponse.json({ success: false, message: 'Email atau password salah.' }, { status: 401 });

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(String(email).trim().toLowerCase()) as any;
    if (!user || !user.password) return WRONG;

    const stored = String(user.password);
    const isHash = stored.startsWith('$2a$') || stored.startsWith('$2b$') || stored.startsWith('$2y$');

    let valid = false;
    if (isHash) {
      valid = await bcrypt.compare(String(password), stored);
    } else {
      // Akun lama yang masih plaintext: cocokkan sekali, lalu langsung di-hash (migrasi diam-diam).
      valid = stored === String(password);
      if (valid) {
        const hash = await bcrypt.hash(String(password), 10);
        db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hash, user.id);
      }
    }

    if (!valid) return WRONG;

    const token = await createSessionToken({
      uid: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    });

    const res = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
