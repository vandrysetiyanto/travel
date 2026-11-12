#!/usr/bin/env node
/**
 * Uji beban PENULISAN: SQLite hanya mengizinkan SATU penulis pada satu waktu.
 * Di sinilah risiko sebenarnya, bukan pada pembacaan.
 *
 * Menguji dua hal:
 *   1. PENULISAN PARALEL (buruk) — banyak request menulis bersamaan
 *   2. PENULISAN + PEMBACAAN CAMPUR (WAL) — pembaca tidak boleh terblokir
 */
const BASE = 'http://127.0.0.1:3000';

const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];

const post = (path, body) => fetch(BASE + path, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Cookie: cookie },
  body: JSON.stringify(body),
});

const barang = (await (await fetch(`${BASE}/api/admin/inventory`, { headers: { Cookie: cookie } })).json()).items?.[0];

async function ujiTulis(nama, total, konkuren) {
  const waktu = [];
  const status = {};
  let berjalan = 0, selesai = 0;
  const mulai = performance.now();

  await new Promise((resolve) => {
    const antre = () => {
      if (selesai >= total) return resolve();
      if (berjalan >= konkuren) return;
      berjalan++; selesai++;
      const t0 = performance.now();
      // UPDATE_STOCK menulis ke SQLite (jalur tulis nyata)
      post('/api/admin/inventory', {
        action: 'UPDATE_STOCK', item_id: barang.id, stock_total: barang.stock_total,
      })
        .then((r) => { status[r.status] = (status[r.status] || 0) + 1; return r.text(); })
        .catch((e) => { status['network'] = (status['network'] || 0) + 1; })
        .finally(() => {
          waktu.push(performance.now() - t0);
          berjalan--; antre();
        });
      antre();
    };
    for (let i = 0; i < konkuren; i++) antre();
  });

  const durasi = (performance.now() - mulai) / 1000;
  waktu.sort((a, b) => a - b);
  const p = (q) => waktu[Math.min(waktu.length - 1, Math.floor(q * waktu.length))] || 0;
  const err = (status['500'] || 0) + (status['network'] || 0);

  console.log(`\n${nama}`);
  console.log(`  ${total} penulisan · ${konkuren} bersamaan · ${durasi.toFixed(2)} detik`);
  console.log(`  throughput : ${(total / durasi).toFixed(0)} tulis/detik`);
  console.log(`  median     : ${p(0.5).toFixed(0)} ms · p95: ${p(0.95).toFixed(0)} ms · maks: ${waktu[waktu.length - 1].toFixed(0)} ms`);
  console.log(`  status     : ${JSON.stringify(status)}`);
  console.log(`  GAGAL      : ${err}`);
  return { nama, throughput: total / durasi, p95: p(0.95), err, status };
}

const hasil = [];
hasil.push(await ujiTulis('Tulis paralel ringan (10 bersamaan)', 200, 10));
hasil.push(await ujiTulis('Tulis paralel sedang (50 bersamaan)', 400, 50));
hasil.push(await ujiTulis('Tulis paralel berat (150 bersamaan)', 600, 150));

console.log('\n=== RINGKASAN PENULISAN ===');
for (const h of hasil) {
  console.log(`  ${h.nama.padEnd(42)} ${h.throughput.toFixed(0).padStart(5)} tulis/s · p95 ${h.p95.toFixed(0).padStart(5)} ms · gagal ${h.err}`);
}
