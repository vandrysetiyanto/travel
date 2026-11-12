/**
 * Tanggal & waktu dalam zona Asia/Jakarta (WIB).
 *
 * MASALAH YANG DIPERBAIKI:
 * Kode memakai `new Date().toISOString().slice(0, 10)` untuk mendapatkan
 * "tanggal hari ini". Itu waktu UTC, bukan WIB (UTC+7). Akibatnya setiap
 * transaksi antara pukul 00:00–06:59 WIB tercatat pada TANGGAL KEMARIN:
 *
 *   13 Nov 2026 00:30 WIB  ->  toISOString() = 2026-11-12
 *
 * Dampaknya nyata untuk pembukuan: beban & pembayaran masuk ke periode yang
 * salah, rekonsiliasi bulanan meleset, dan laporan harian bisa kosong padahal
 * ada transaksi.
 *
 * Semua tempat yang butuh "hari ini" / tanggal lokal WAJIB memakai modul ini,
 * jangan `toISOString().slice(0,10)`.
 */

const ZONA = 'Asia/Jakarta';

/** Tanggal hari ini di WIB, format YYYY-MM-DD. */
export function tanggalWib(d: Date = new Date()): string {
  // en-CA menghasilkan format YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(d);
}

/** Jam sekarang di WIB, format HH:MM:SS. */
export function jamWib(d: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: ZONA,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(d);
}

/**
 * Stempel waktu WIB lengkap: YYYY-MM-DD HH:MM:SS.
 * Dipakai bila perlu menyimpan waktu yang bisa dibaca manusia (bukan UTC).
 */
export function stempelWib(d: Date = new Date()): string {
  return `${tanggalWib(d)} ${jamWib(d)}`;
}

/**
 * Normalisasi nilai tanggal apa pun menjadi YYYY-MM-DD (WIB).
 *
 * Menerima:
 *   - "2026-11-13"            -> apa adanya (sudah tanggal murni)
 *   - "2026-11-13 10:20:30"   -> dipotong tanggalnya
 *   - "2026-11-12T17:30:00Z"  -> dikonversi ke WIB (bisa jadi 2026-11-13 00:30)
 *
 * Ini penting untuk data lama: `created_at` di SQLite memakai CURRENT_TIMESTAMP
 * yang bernilai UTC, sehingga harus dikonversi ke WIB sebelum dipakai sebagai
 * tanggal pembukuan.
 */
export function keTanggalWib(nilai: unknown): string | null {
  if (!nilai) return null;
  const s = String(nilai).trim();

  // Sudah tanggal murni
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  /*
   * Tanggal + jam TANPA penanda zona.
   *
   * Nilai seperti ini berasal dari dua sumber berbeda dan tidak bisa dibedakan
   * dari bentuknya:
   *   - `CURRENT_TIMESTAMP` SQLite  -> UTC
   *   - input pengguna / UI         -> WIB
   *
   * Karena hampir semua kolom waktu di aplikasi ini diisi CURRENT_TIMESTAMP
   * (UTC), nilai tanpa zona DIPERLAKUKAN SEBAGAI UTC lalu dikonversi ke WIB.
   * Tanpa ini, transaksi pukul 00:00–06:59 WIB tetap tercatat di tanggal
   * kemarin — persis bug yang sedang diperbaiki.
   */
  const tanpaZona = s.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(:\d{2})?)(\.\d+)?$/);
  if (tanpaZona) {
    const sebagaiUtc = new Date(`${tanpaZona[1]}T${tanpaZona[2]}Z`);
    if (!Number.isNaN(sebagaiUtc.getTime())) return tanggalWib(sebagaiUtc);
    return tanpaZona[1];
  }

  // Ada penanda zona (Z / +07:00) -> konversi ke WIB
  const d = new Date(s);
  if (!Number.isNaN(d.getTime())) return tanggalWib(d);

  return null;
}

/** Apakah string tanggal valid dalam format YYYY-MM-DD? */
export function tanggalValid(nilai: unknown): boolean {
  const s = String(nilai || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const d = new Date(`${s}T00:00:00+07:00`);
  return !Number.isNaN(d.getTime()) && tanggalWib(d) === s;
}
