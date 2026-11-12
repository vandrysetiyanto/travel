/**
 * Verifikasi sesi admin. Dipakai oleh route API (Node runtime).
 *
 * PENTING: role TIDAK dipercaya dari isi token.
 *
 * Token ditandatangani saat login dan berumur 12 jam. Kalau role diambil dari
 * token, maka user yang dicabut/diubah role-nya tetap memakai hak lamanya
 * sampai token kedaluwarsa — termasuk jika role-nya sudah dihapus. Karena itu
 * setiap permintaan memuat ulang role terkini dari database (lewat users.role_id
 * bila ada, dengan cadangan kode di users.role).
 */
import { NextResponse } from 'next/server';
import * as jose from 'jose';

export const SESSION_COOKIE = 'travel_session';
export const SESSION_MAX_AGE = 60 * 60 * 12; // 12 jam

const SECRET = new TextEncoder().encode(
  process.env.AUTH_SECRET || 'al-barakah-travel-dev-secret-change-me-please-32b'
);

export interface SessionUser {
  uid: number;
  email: string;
  name: string;
  role: string;
  roleId?: number | null;
}

/** Baca cookie sesi dari header Cookie (tanpa dependensi next/headers, aman di route). */
export function readSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(';')) {
    const idx = part.indexOf('=');
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === SESSION_COOKIE) {
      return decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return null;
}

export async function verifySessionToken(token: string): Promise<SessionUser | null> {
  try {
    const { payload } = await jose.jwtVerify(token, SECRET);
    if (!payload || typeof payload.uid !== 'number') return null;
    return {
      uid: payload.uid as number,
      email: String(payload.email || ''),
      name: String(payload.name || ''),
      role: String(payload.role || ''),
      roleId: typeof payload.roleId === 'number' ? payload.roleId : null,
    };
  } catch {
    return null;
  }
}

/**
 * Ambil role terkini dari database.
 *
 * `users.role_id` adalah sumber utama (FK ke roles.id); `users.role` hanya
 * cadangan untuk baris lama. Bila role tidak ditemukan, kembalikan kode apa
 * adanya — permissionsOf() akan memperlakukannya sebagai 0 izin (default deny).
 */
function roleTerkini(uid: number): { role: string; roleId: number | null } | null {
  // Impor dinamis: auth dipakai di banyak route yang sudah memuat db, dan
  // impor statis di sini akan memperpanjang rantai modul saat inisialisasi.
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const db = require('@/lib/db').default;
  const row = db
    .prepare(
      `SELECT u.role AS role_lama, r.code AS role_kode, u.role_id AS role_id
         FROM users u
         LEFT JOIN roles r ON r.id = u.role_id
        WHERE u.id = ?`,
    )
    .get(uid) as { role_lama: string; role_kode: string | null; role_id: number | null } | undefined;

  if (!row) return null;
  return {
    role: String(row.role_kode || row.role_lama || '').toUpperCase(),
    roleId: row.role_id ?? null,
  };
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return await new jose.SignJWT({
    uid: user.uid,
    email: user.email,
    name: user.name,
    role: user.role,
    roleId: user.roleId ?? null,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(SECRET);
}

/** Opsi cookie sesi. Tanpa `secure` supaya tetap jalan di http (dev/lokal);
 *  set COOKIE_SECURE=true kalau sudah di belakang HTTPS. */
/*
 * Opsi cookie sesi.
 *
 * S3: `secure` DULU hanya aktif bila COOKIE_SECURE=true, dan variabel itu tidak
 * pernah diset — sehingga cookie sesi dikirim juga lewat koneksi non-TLS dan
 * bisa disadap. Sekarang `secure` menyala otomatis di produksi, dan hanya
 * dimatikan bila memang ingin mengembangkan lewat http lokal
 * (COOKIE_SECURE=false).
 */
const produksi = process.env.NODE_ENV === 'production';
const paksa = process.env.COOKIE_SECURE;

export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE,
  secure: paksa === 'false' ? false : paksa === 'true' ? true : produksi,
};

type AuthOk = { ok: true; user: SessionUser | null };

/**
 * Route yang tetap boleh diakses meski pengguna WAJIB ganti password bawaan.
 *
 * Tanpa pengecualian ini, pengguna terkunci: tidak bisa membuka halaman ganti
 * password. Semua route admin lain ditahan sampai password diganti, karena
 * password bawaan tertulis di dokumentasi dan sama untuk setiap instalasi.
 */
const BOLEH_SAAT_WAJIB_GANTI = new Set([
  '/api/admin/login',
  '/api/admin/logout',
  '/api/admin/staff/me',
]);
type AuthFail = { ok: false; response: NextResponse };
export type AuthResult = AuthOk | AuthFail;

/** Gerbang wajib-login untuk route API admin. */
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const token = readSessionCookie(req.headers.get('cookie'));
  if (!token) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Belum login.' }, { status: 401 }) };
  }
  const sesi = await verifySessionToken(token);
  if (!sesi) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Sesi tidak valid atau kedaluwarsa.' }, { status: 401 }) };
  }

  // Role diambil ulang dari database: perubahan/pencabutan role berlaku seketika,
  // tidak menunggu token kedaluwarsa.
  const terkini = roleTerkini(sesi.uid);
  if (!terkini) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Akun tidak ditemukan.' }, { status: 401 }) };
  }

  /*
   * Gerbang "wajib ganti password" di sisi SERVER, bukan hanya UI.
   *
   * Penanda disimpan di DB (users.must_change_password) sehingga tidak bisa
   * dilewati dengan menghapus JavaScript di browser atau memanggil API langsung.
   */
  let jalur = '';
  try {
    jalur = new URL(req.url).pathname;
  } catch {
    jalur = '';
  }
  const wajibGanti = roleWajibGantiSandi(sesi.uid);
  if (wajibGanti && jalur && !BOLEH_SAAT_WAJIB_GANTI.has(jalur)) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          success: false,
          must_change_password: true,
          message: 'Password Anda masih password bawaan. Ganti password terlebih dahulu sebelum memakai aplikasi.',
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true, user: { ...sesi, role: terkini.role, roleId: terkini.roleId } };
}

/** Apakah pengguna masih memakai password bawaan? */
function roleWajibGantiSandi(uid: number): boolean {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const db = require('@/lib/db').default;
  const row = db.prepare('SELECT COALESCE(must_change_password, 0) AS w FROM users WHERE id = ?').get(uid) as
    | { w: number }
    | undefined;
  return Number(row?.w) === 1;
}

/** Gerbang khusus OWNER (Kelola Staf, hapus user, dll). */
export async function requireOwner(req: Request): Promise<AuthResult> {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth;
  if (auth.user?.role !== 'OWNER') {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Hanya Owner yang boleh melakukan aksi ini.' }, { status: 403 }) };
  }
  return auth;
}
