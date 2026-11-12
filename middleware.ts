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

/**
 * Header keamanan dasar.
 *
 * Sebelumnya aplikasi tidak mengirim satu pun header pengaman, sehingga halaman
 * admin bisa dibingkai di iframe situs lain (clickjacking: tombol palsu di atas
 * tombol asli) dan browser bebas menebak tipe berkas.
 *
 * CSP sengaja TIDAK dipasang ketat di sini: aplikasi memakai inline style/script
 * dari Next sehingga CSP yang salah akan mematikan UI. Yang dipasang hanya
 * header yang aman tanpa risiko merusak tampilan.
 */
function pasangHeaderKeamanan(res: NextResponse): NextResponse {
  res.headers.set('X-Frame-Options', 'SAMEORIGIN');            // cegah clickjacking
  res.headers.set('X-Content-Type-Options', 'nosniff');        // jangan tebak MIME
  res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.headers.set('X-DNS-Prefetch-Control', 'off');
  res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

  /*
   * Content-Security-Policy (S2 lanjutan).
   *
   * 'unsafe-inline' pada script/style DIPERLUKAN karena Next menyisipkan skrip
   * hidrasi inline; menghapusnya akan mematikan seluruh UI (sudah diperiksa:
   * 12 tag <script> inline di halaman login, tanpa CDN eksternal). Yang tetap
   * ditegakkan secara nyata: tidak ada objek/iframe asing, form hanya boleh
   * dikirim ke origin sendiri, dan base-uri dibatasi — ini yang menutup
   * penyalahgunaan paling umum (penyisipan skrip lewat iframe/plugin,
   * pengalihan form ke domain penyerang).
   */
  res.headers.set(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self'",
      "form-action 'self'",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
    ].join('; '),
  );
  // HSTS hanya masuk akal di HTTPS; browser mengabaikannya pada http.
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  return res;
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const valid = await hasValidSession(req);

  // Sudah login tapi membuka halaman login -> langsung ke dashboard.
  if (valid && pathname === '/admin/login') {
    const url = req.nextUrl.clone();
    url.pathname = '/admin/dashboard';
    url.search = '';
    return pasangHeaderKeamanan(NextResponse.redirect(url));
  }

  // Halaman & endpoint login WAJIB tetap terbuka tanpa sesi. Tanpa pengecualian ini
  // middleware memblokir /admin/login dan me-redirect ke dirinya sendiri (loop tak berujung).
  if (pathname === '/admin/login' || pathname === '/api/admin/login') {
    return pasangHeaderKeamanan(NextResponse.next());
  }

  if (!valid) {
    // API -> balas JSON 401, jangan redirect (fetch() akan error kalau di-redirect ke HTML).
    if (pathname.startsWith('/api/')) {
      return pasangHeaderKeamanan(
        NextResponse.json({ success: false, message: 'Belum login atau sesi kedaluwarsa.' }, { status: 401 }),
      );
    }
    const url = req.nextUrl.clone();
    url.pathname = '/admin/login';
    url.searchParams.set('next', pathname);
    return pasangHeaderKeamanan(NextResponse.redirect(url));
  }

  return pasangHeaderKeamanan(NextResponse.next());
}

export const config = {
  matcher: ['/admin/:path*', '/api/admin/:path*'],
};
