import { NextResponse } from 'next/server';
import { galatServer } from '@/lib/galat';
import bcrypt from 'bcryptjs';
import db, { initDB } from '@/lib/db';
import { createSessionToken, sessionCookieOptions, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth';
import { cekKunci, catatGagal, hapusKunci, ipPemanggil } from '@/lib/login-guard';

initDB();

export async function POST(req: Request) {
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email dan password wajib diisi.' }, { status: 400 });
    }

    /*
     * Batas percobaan login (anti brute force).
     *
     * Tanpa ini, password 8 karakter bisa ditebak ribuan kali tanpa hambatan —
     * apalagi akun bawaan memakai password yang tertulis di dokumentasi.
     * Dikunci per kombinasi IP+email (5x) dan per IP (20x) selama 15 menit.
     */
    const ip = ipPemanggil(req);
    const kunci = cekKunci(ip, String(email));
    if (kunci.terkunci) {
      return NextResponse.json(
        { success: false, message: kunci.pesan, retry_after: kunci.sisaDetik },
        { status: 429, headers: { 'Retry-After': String(kunci.sisaDetik) } },
      );
    }

    // Pesan error disamakan untuk email tidak ada / password salah (jangan bocorkan mana yang salah).
    const WRONG = NextResponse.json({ success: false, message: 'Email atau password salah.' }, { status: 401 });

    const user = db
      .prepare(
        `SELECT u.*, r.code AS role_kode, COALESCE(u.must_change_password, 0) AS wajib_ganti
           FROM users u
           LEFT JOIN roles r ON r.id = u.role_id
          WHERE u.email = ?`,
      )
      .get(String(email).trim().toLowerCase()) as any;
    if (!user || !user.password) {
      catatGagal(ip, String(email));
      return WRONG;
    }

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

    if (!valid) {
      catatGagal(ip, String(email));
      return WRONG;
    }

    // Berhasil -> hitungan dihapus.
    hapusKunci(ip, String(email));

    // Role diambil dari role_id (FK) bila ada; kolom teks hanya cadangan.
    const roleFinal = String(user.role_kode || user.role || '').toUpperCase();

    const token = await createSessionToken({
      uid: user.id,
      email: user.email,
      name: user.name,
      role: roleFinal,
      roleId: user.role_id ?? null,
    });

    const wajibGanti = Number(user.wajib_ganti) === 1;

    const res = NextResponse.json({
      success: true,
      // Sesi tetap diberikan supaya pengguna bisa membuka halaman ganti password,
      // tetapi `must_change_password` memaksa UI menahan akses ke menu lain.
      must_change_password: wajibGanti,
      message: wajibGanti
        ? 'Password Anda masih password bawaan. Ganti sekarang sebelum memakai aplikasi.'
        : undefined,
      user: { id: user.id, name: user.name, email: user.email, role: roleFinal, roleId: user.role_id ?? null },
    });
    res.cookies.set(SESSION_COOKIE, token, sessionCookieOptions);
    return res;
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/login' });
  }
}
