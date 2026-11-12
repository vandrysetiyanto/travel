#!/usr/bin/env node
/**
 * QA KEAMANAN: apakah aplikasi memakai AUTH_SECRET asli, atau jatuh ke
 * secret dev yang tertulis di dalam source code?
 *
 * Kalau secret dev dipakai, siapa pun yang bisa membaca kode (atau menebak
 * nilai bawaan yang umum) bisa MEMBUAT token sendiri dan masuk sebagai OWNER.
 *
 * Uji ini TIDAK merusak apa pun: hanya membuat token dengan secret dev lalu
 * menanyakan identitas ke server.
 */
import { createRequire } from 'node:module';
const require = createRequire('/root/travel-app/');
const jose = require('jose');

const BASE = 'http://127.0.0.1:3000';
const DEV_SECRET = 'al-barakah-travel-dev-secret-change-me-please-32b';

const encoder = new TextEncoder();

async function coba(secret, label) {
  const token = await new jose.SignJWT({ uid: 2, email: 'owner@travel.com', name: 'Palsu', role: 'OWNER' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(encoder.encode(secret));

  const r = await fetch(`${BASE}/api/admin/staff/me`, { headers: { Cookie: `travel_session=${token}` } });
  const body = await r.json().catch(() => ({}));
  console.log(`\n${label}`);
  console.log(`  HTTP ${r.status}`);
  if (r.ok) {
    console.log(`  ⚠️  DITERIMA — role: ${body.user?.role}, izin: ${(body.permissions || []).length}`);
  } else {
    console.log(`  ✅ ditolak: ${body.message || '-'}`);
  }
  return r.ok;
}

console.log('Menguji penerimaan token yang ditandatangani dengan secret berbeda:\n');

const devDipakai = await coba(DEV_SECRET, '1. Secret DEV (tertulis di source code)');
const acakDipakai = await coba('secret-yang-jelas-salah-' + Date.now(), '2. Secret acak (kontrol negatif)');

console.log('\n=== KESIMPULAN ===');
if (devDipakai) {
  console.log('  🔴 KRITIS: aplikasi menerima token bertanda tangan secret dev.');
  console.log('     Artinya siapa pun bisa memalsukan sesi OWNER tanpa password.');
} else {
  console.log('  ✅ Aplikasi memakai AUTH_SECRET asli (token dev ditolak).');
}
if (acakDipakai) {
  console.log('  🔴 KRITIS: token dengan secret acak pun diterima — verifikasi tanda tangan tidak jalan!');
}
