import { NextResponse } from 'next/server';
import { SESSION_COOKIE } from '@/lib/auth';

export async function POST() {
  const res = NextResponse.json({ success: true, message: 'Logout berhasil.' });
  res.cookies.set(SESSION_COOKIE, '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0 });
  return res;
}
