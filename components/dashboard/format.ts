'use client';

/**
 * Helper format bersama untuk modul dashboard.
 *
 * `fmt` dan `fmtRp` sebelumnya didefinisikan di dalam page.tsx. Saat komponen
 * dipindahkan ke modul terpisah, helper ini ikut dibutuhkan — jadi diangkat ke
 * sini agar tidak diduplikasi di setiap modul (duplikasi akan membuat format
 * angka berbeda-beda antar halaman).
 */

export const fmt = (n: number | string | null | undefined): string => {
  const nilai = Number(n);
  if (!Number.isFinite(nilai)) return '0';
  return new Intl.NumberFormat('id-ID').format(nilai);
};

export const fmtRp = (n: number | string | null | undefined): string => 'Rp ' + fmt(n);

/** Tanggal hari ini menurut WIB (bukan UTC). */
export const hariIniWib = (): string =>
  new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
