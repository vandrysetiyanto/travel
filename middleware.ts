import { NextRequest, NextResponse } from 'next/server';
import * as jose from 'jose';

// Middleware jalan di Edge runtime: TIDAK boleh menyentuh better-sqlite3.
// Jadi di sini hanya verifikasi tanda tangan JWT (jose), tanpa query DB.
const SESSION_COOKIE = 'travel_session';
// WAJIB sama dengan lib/auth.ts. .env.local menyimpan AUTH_SECRET asli; konstanta di
// bawah hanya fallback dev (kalau terpakai di produksi, tanda tangan token bisa dipalsukan).
const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'al-barakah-travel-dev-secret-change-me-please-32b'
);

async function hasValidSession(req: NextRequest): Promise<boolean> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return false;
  try {
    const { payload } = await jose.jwtVerify(token, SECRET);
    return typeof payload.uid === 'number';
  } catch {
    return false;
  }
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const valid = await hasValidSession(req);

  // Sudah login tapi membuka halaman login -> langsung ke dashboard.
  if (valid && pathname === '/admin/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/dashboard';
    url.search = '';
    return NextResponse.redirect(url);
  }

  // Halaman & endpoint login WAJIB tetap terbuka tanpa sesi. Tanpa pengecualian ini
  // middleware memblokir /admin/login dan me-redirect ke dirinya sendiri (loop tak berujung).
  if (pathname === '/admin/login' || pathname === '/api/admin/login') return NextResponse.next();

  if (!valid) {
    // API -> balas JSON 401, jangan redirect (fetch() akan error kalau di-redirect ke HTML).
    if (pathname.startsWith('/api/')) {
      return NextResponse.json({ success: false, message: 'Belum login atau sesi kedaluwarsa.' }, { status: 401 });
    }
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

// Semua halaman admin + semua API admin WAJIB sesi, kecuali endpoint login.
export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
