#!/usr/bin/env node
/**
 * Isi unit_cost dengan harga wajar (data dummy untuk pengujian HPP).
 *
 * Dilakukan lewat API aplikasi (bukan UPDATE langsung ke DB) supaya melewati
 * jalur validasi yang sama dengan yang dipakai staf.
 */
const BASE = 'http://127.0.0.1:3000';

// Harga wajar pasar Indonesia (per satuan yang tercatat di tabel).
const HARGA = [
  { code: 'KPR-01', nama: 'Koper Kabin & Bagasi 24"', unit: 'Pcs',  harga: 450000 },
  { code: 'IHR-01', nama: 'Kain Ihram Pria',           unit: 'Pcs',  harga: 185000 },
  { code: 'MKN-01', nama: 'Mukena Atasan & Bawahan',   unit: 'Set',  harga: 165000 },
  { code: 'BTK-01', nama: 'Batik Seragam Jamaah',      unit: 'Meter', harga: 48000 },
  { code: 'TAS-01', nama: 'Tas Paspor & Selempang',    unit: 'Pcs',  harga: 65000 },
  { code: 'BUK-01', nama: 'Buku Panduan Doa & Zikir',  unit: 'Pcs',  harga: 35000 },
  { code: 'KPR-10', nama: 'Tes (sisa data uji)',       unit: 'Pcs',  harga: 50000 },
];

const login = await fetch(`${BASE}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: 'owner@travel.com', password: 'owner123' }),
});
const cookie = (login.headers.get('set-cookie') || '').split(';')[0];
if (!login.ok) { console.error('Login gagal'); process.exit(1); }

const daftar = await (await fetch(`${BASE}/api/admin/inventory`, { headers: { Cookie: cookie } })).json();
const peta = new Map((daftar.items || []).map((i) => [i.code, i]));

console.log('\nMengisi harga satuan lewat API:\n');
let berhasil = 0, gagal = 0;
for (const h of HARGA) {
  const item = peta.get(h.code);
  if (!item) { console.log(`  ⚠️  ${h.code} tidak ditemukan, dilewati`); gagal++; continue; }

  const r = await fetch(`${BASE}/api/admin/inventory`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', Cookie: cookie },
    body: JSON.stringify({ action: 'UPDATE_STOCK', item_id: item.id, stock_total: item.stock_total, unit_cost: h.harga }),
  });
  const d = await r.json().catch(() => ({}));
  if (r.ok && d.success) {
    console.log(`  ✅ ${h.code.padEnd(8)} ${h.nama.padEnd(30)} Rp ${h.harga.toLocaleString('id-ID').padStart(9)} / ${h.unit}`);
    berhasil++;
  } else {
    console.log(`  ❌ ${h.code.padEnd(8)} gagal: HTTP ${r.status} ${d.message || ''}`);
    gagal++;
  }
}

console.log(`\nBerhasil ${berhasil} · Gagal ${gagal}`);

// Verifikasi ulang dari API
const cek = await (await fetch(`${BASE}/api/admin/inventory`, { headers: { Cookie: cookie } })).json();
console.log('\nVerifikasi dari API (yang dilihat staf):');
for (const it of (cek.items || []).sort((a, b) => a.code.localeCompare(b.code))) {
  const nilai = Number(it.unit_cost) * Number(it.stock_total);
  console.log(`  ${it.code.padEnd(8)} ${String(it.unit_cost).padStart(7)} × ${String(it.stock_total).padStart(4)} ${String(it.unit).padEnd(6)} = Rp ${nilai.toLocaleString('id-ID').padStart(12)}`);
}
const kosong = (cek.items || []).filter((i) => Number(i.unit_cost) <= 0);
console.log(`\nBarang tanpa harga: ${kosong.length}`);
if (gagal) process.exit(1);
