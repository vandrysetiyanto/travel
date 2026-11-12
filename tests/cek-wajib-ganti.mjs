const BASE = 'http://127.0.0.1:3000';

const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
const j = await login.json();
console.log('\nLogin owner:');
console.log('  must_change_password:', j.must_change_password);
console.log('  pesan:', j.message || '-');

const me = await fetch(`${BASE}/api/admin/staff/me`, { headers: { Cookie: cookie } });
const meJ = await me.json();
console.log('  staff/me must_change_password:', meJ.user?.must_change_password);

// Coba akses menu lain sementara masih wajib ganti
const inv = await fetch(`${BASE}/api/admin/inventory`, { headers: { Cookie: cookie } });
console.log('\nAkses /api/admin/inventory saat wajib ganti password:');
console.log(`  HTTP ${inv.status} ${inv.status === 403 ? '✅ DITAHAN' : '⚠️ LOLOS'}`);
const body = await inv.json().catch(() => ({}));
console.log('  pesan:', body.message || '-');
