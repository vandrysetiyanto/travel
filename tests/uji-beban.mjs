#!/usr/bin/env node
/**
 * Uji beban ringan: berapa kemampuan sebenarnya travel-app?
 *
 * Mengukur pada proses yang SAMA dengan produksi (PM2, fork_mode 1 instance).
 * Yang diuji: halaman statis (SSR) dan API yang menyentuh database (SQLite).
 */
const BASE = 'http://127.0.0.1:3000';

const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

async function uji(nama, path, total, konkuren, pakaiSesi = false) {
  const waktu = [];
  let gagal = 0, non200 = 0;
  let berjalan = 0, selesai = 0;

  const mulai = performance.now();

  await new Promise((resolve) => {
    const antre = () => {
      if (selesai >= total) return resolve();
      if (berjalan >= konkuren) return;
      berjalan++;
      selesai++;
      const t0 = performance.now();
      const opts = pakaiSesi ? { headers: { Cookie: cookie } } : {};
      fetch(BASE + path, opts)
        .then((r) => { if (!r.ok) non200++; return r.text(); })
        .catch(() => { gagal++; })
        .finally(() => {
          waktu.push(performance.now() - t0);
          berjalan--;
          antre();
        });
      antre();
    };
    for (let i = 0; i < konkuren; i++) antre();
  });

  const durasi = (performance.now() - mulai) / 1000;
  waktu.sort((a, b) => a - b);
  const p = (q) => waktu[Math.min(waktu.length - 1, Math.floor(q * waktu.length))] || 0;

  console.log(`\n${nama}`);
  console.log(`  ${path}`);
  console.log(`  ${total} permintaan · ${konkuren} bersamaan · ${durasi.toFixed(2)} detik`);
  console.log(`  throughput : ${(total / durasi).toFixed(0)} req/detik`);
  console.log(`  median     : ${p(0.5).toFixed(0)} ms`);
  console.log(`  p95        : ${p(0.95).toFixed(0)} ms`);
  console.log(`  p99        : ${p(0.99).toFixed(0)} ms`);
  console.log(`  maks       : ${waktu[waktu.length - 1].toFixed(0)} ms`);
  console.log(`  gagal/error: ${gagal} · non-200: ${non200}`);
  return { nama, throughput: total / durasi, p95: p(0.95), gagal: gagal + non200 };
}

const hasil = [];
hasil.push(await uji('Halaman login (SSR ringan)', '/admin/login', 400, 40));
hasil.push(await uji('API inventaris (baca SQLite)', '/api/admin/inventory', 400, 40, true));
hasil.push(await uji('API staf/me (izin + menu dari DB)', '/api/admin/staff/me', 400, 40, true));
hasil.push(await uji('Beban tinggi: 200 bersamaan', '/api/admin/inventory', 600, 200, true));

console.log('\n=== RINGKASAN ===');
for (const h of hasil) {
  console.log(`  ${h.nama.padEnd(38)} ${h.throughput.toFixed(0).padStart(5)} rps · p95 ${h.p95.toFixed(0).padStart(5)} ms · error ${h.gagal}`);
}
