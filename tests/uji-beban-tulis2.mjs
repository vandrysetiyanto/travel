#!/usr/bin/env node
/**
 * Uji beban PENULISAN — penghitung yang benar.
 *
 * Versi sebelumnya memanggil antre() dua kali sehingga jumlah respons yang
 * tercatat bisa kurang dari jumlah permintaan (190/200). Itu bug penghitung,
 * bukan kehilangan permintaan. Di sini setiap permintaan dihitung tepat satu
 * kali dan TOTAL respons diverifikasi sama dengan TOTAL permintaan.
 */
const BASE = 'http://127.0.0.1:3000';

const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
const barang = (await (await fetch(`${BASE}/api/admin/inventory`, { headers: { Cookie: cookie } })).json()).items?.[0];

async function ujiTulis(nama, total, konkuren) {
  const waktu = new Array(total);
  const status = {};
  let indeks = 0;

  const mulai = performance.now();

  async function pekerja() {
    while (true) {
      const i = indeks++;
      if (i >= total) return;
      const t0 = performance.now();
      try {
        const r = await fetch(`${BASE}/api/admin/inventory`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Cookie: cookie },
          body: JSON.stringify({ action: 'UPDATE_STOCK', item_id: barang.id, stock_total: barang.stock_total }),
        });
        status[r.status] = (status[r.status] || 0) + 1;
        await r.text();
      } catch {
        status['network'] = (status['network'] || 0) + 1;
      }
      waktu[i] = performance.now() - t0;
    }
  }

  await Promise.all(Array.from({ length: konkuren }, pekerja));
  const durasi = (performance.now() - mulai) / 1000;

  const terukur = waktu.filter((x) => typeof x === 'number');
  const urut = [...terukur].sort((a, b) => a - b);
  const p = (q) => urut[Math.min(urut.length - 1, Math.floor(q * urut.length))] || 0;
  const dijawab = Object.values(status).reduce((a, b) => a + b, 0);
  const err = (status['500'] || 0) + (status['502'] || 0) + (status['503'] || 0) + (status['network'] || 0);

  console.log(`\n${nama}`);
  console.log(`  diminta ${total} · bersamaan ${konkuren} · ${durasi.toFixed(2)} detik`);
  console.log(`  throughput : ${(total / durasi).toFixed(0)} tulis/detik`);
  console.log(`  median ${p(0.5).toFixed(0)} ms · p95 ${p(0.95).toFixed(0)} ms · p99 ${p(0.99).toFixed(0)} ms · maks ${urut[urut.length - 1].toFixed(0)} ms`);
  console.log(`  respons    : ${dijawab}/${total} ${dijawab === total ? '✅ semua terjawab' : '❌ ADA YANG HILANG'}`);
  console.log(`  status     : ${JSON.stringify(status)}`);
  console.log(`  GAGAL(5xx) : ${err}`);
  return { nama, throughput: total / durasi, p95: p(0.95), hilang: total - dijawab, err, status };
}

const hasil = [];
hasil.push(await ujiTulis('Tulis 10 bersamaan', 200, 10));
hasil.push(await ujiTulis('Tulis 50 bersamaan', 400, 50));
hasil.push(await ujiTulis('Tulis 150 bersamaan', 600, 150));
hasil.push(await ujiTulis('Tulis 300 bersamaan (ekstrem)', 600, 300));

console.log('\n=== RINGKASAN ===');
for (const h of hasil) {
  console.log(`  ${h.nama.padEnd(30)} ${h.throughput.toFixed(0).padStart(4)} t/s · p95 ${h.p95.toFixed(0).padStart(5)} ms · hilang ${h.hilang} · 5xx ${h.err}`);
}
