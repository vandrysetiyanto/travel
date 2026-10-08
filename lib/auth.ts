// Verifikasi sesi admin. Dipakai oleh route API (Node runtime).
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
    };
  } catch {
    return null;
  }
}

export async function createSessionToken(user: SessionUser): Promise<string> {
  return await new jose.SignJWT({ uid: user.uid, email: user.email, name: user.name, role: user.role })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(SECRET);
}

/** Opsi cookie sesi. Tanpa `secure` supaya tetap jalan di http (dev/lokal);
 *  set COOKIE_SECURE=true kalau sudah di belakang HTTPS. */
export const sessionCookieOptions = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE,
  secure: process.env.COOKIE_SECURE === 'true',
};

type AuthOk = { ok: true; user: SessionUser | null };
type AuthFail = { ok: false; response: NextResponse };
export type AuthResult = AuthOk | AuthFail;

/** Gerbang wajib-login untuk route API admin. */
export async function requireAdmin(req: Request): Promise<AuthResult> {
  const token = readSessionCookie(req.headers.get('cookie'));
  if (!token) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Belum login.' }, { status: 401 }) };
  }
  const user = await verifySessionToken(token);
  if (!user) {
    return { ok: false, response: NextResponse.json({ success: false, message: 'Sesi tidak valid atau kedaluwarsa.' }, { status: 401 }) };
  }
  return { ok: true, user };
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
