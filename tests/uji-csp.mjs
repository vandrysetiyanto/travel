#!/usr/bin/env node
/**
 * Uji CSP: pastikan header terpasang DAN aplikasi masih berfungsi.
 *
 * CSP yang salah adalah cara termudah mematikan seluruh UI tanpa terlihat di
 * server. Uji ini memeriksa:
 *   1. header Content-Security-Policy ada & berisi direktif penting
 *   2. semua halaman masih 200
 *   3. browser sungguhan memuat halaman tanpa pelanggaran CSP
 *      (dijalankan terpisah lewat browser_exec; di sini hanya HTML)
 */
const BASE = 'http://127.0.0.1:3000';

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

console.log('\n[1] Header CSP terpasang');
const r = await fetch(`${BASE}/admin/login`);
const csp = r.headers.get('content-security-policy') || '';
cek('header ada', !!csp);
for (const d of ["default-src 'self'", "object-src 'none'", "frame-ancestors 'self'", "base-uri 'self'", "form-action 'self'"]) {
  cek(`direktif ${d}`, csp.includes(d));
}

console.log('\n[2] Header keamanan lain tetap ada');
for (const h of ['x-frame-options', 'x-content-type-options', 'referrer-policy', 'permissions-policy', 'strict-transport-security']) {
  cek(h, !!r.headers.get(h));
}

console.log('\n[3] Semua halaman masih melayani');
for (const p of ['/', '/packages', '/track', '/register', '/admin/login']) {
  const x = await fetch(BASE + p);
  const html = await x.text();
  cek(`${p} -> 200 & ada <html>`, x.status === 200 && html.includes('</html>'), `HTTP ${x.status} len=${html.length}`);
}

console.log('\n[4] API tetap berperilaku benar');
const api = await fetch(`${BASE}/api/admin/staff/me`);
cek('API tanpa sesi -> 401 (bukan diblokir CSP)', api.status === 401, `HTTP ${api.status}`);
const trk = await fetch(`${BASE}/api/track?code=TRX-MUXN0DRG`);
const trkJ = await trk.json().catch(() => ({}));
cek('API track publik tetap jalan', trk.ok && trkJ.success === true, `HTTP ${trk.status}`);

console.log('\n[5] Tidak ada kebocoran data pribadi di track');
cek('NIK tidak ada', !JSON.stringify(trkJ).includes('"nik"'));

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) { console.log('Gagal: ' + gagal.join(' | ')); process.exit(1); }
console.log('🎉 GERBANG CSP LULUS');
