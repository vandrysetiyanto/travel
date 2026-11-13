/**
 * Status & transisi booking — SATU sumber kebenaran.
 *
 * Sebelumnya status ditulis sebagai literal teks di 45 tempat ('PENDING', 'DP',
 * 'PAID', 'CANCELLED') tanpa aturan transisi. Kode MEMERIKSA 'CANCELLED' di
 * empat tempat (register, upload bukti, hapus paket/batch), tetapi TIDAK ADA
 * satu pun jalur yang menulisnya — sehingga jamaah yang batal tidak punya cara
 * resmi, dan staf cenderung MENGHAPUS baris transaksi. Akibatnya jurnal uang
 * tetap ada sementara transaksinya hilang: neraca jadi tidak seimbang dan
 * riwayat pembayaran lenyap.
 *
 * Modul ini menetapkan:
 *   - daftar status yang sah
 *   - transisi yang diizinkan (termasuk pembatalan & pemulihan)
 *   - label manusia untuk UI
 */

export type StatusBooking = 'PENDING' | 'DP' | 'PAID' | 'CANCELLED';

export const STATUS_BOOKING: StatusBooking[] = ['PENDING', 'DP', 'PAID', 'CANCELLED'];

export const LABEL_STATUS: Record<StatusBooking, { teks: string; warna: string; keterangan: string }> = {
  PENDING: {
    teks: 'Belum Bayar',
    warna: 'bg-slate-100 text-slate-700',
    keterangan: 'Booking dibuat, belum ada pembayaran yang disetujui.',
  },
  DP: {
    teks: 'Uang Muka',
    warna: 'bg-amber-50 text-amber-700',
    keterangan: 'Sudah ada pembayaran, tetapi belum lunas.',
  },
  PAID: {
    teks: 'Lunas',
    warna: 'bg-emerald-50 text-emerald-700',
    keterangan: 'Total pembayaran sudah menutup harga paket.',
  },
  CANCELLED: {
    teks: 'Dibatalkan',
    warna: 'bg-rose-50 text-rose-700',
    keterangan: 'Booking dibatalkan; jurnal uang sudah dibalik (tidak dihapus).',
  },
};

/**
 * Transisi status yang diizinkan.
 *
 * Pembatalan hanya boleh dari PENDING/DP/PAID. Pemulihan (CANCELLED -> PENDING)
 * disediakan untuk koreksi salah-batal, tetapi TIDAK memulihkan jurnal secara
 * otomatis — jurnalnya harus dibuat ulang oleh admin (tercatat di audit).
 */
const TRANSISI: Record<StatusBooking, StatusBooking[]> = {
  PENDING: ['DP', 'PAID', 'CANCELLED'],
  DP: ['PENDING', 'PAID', 'CANCELLED'],
  PAID: ['DP', 'CANCELLED'],
  CANCELLED: ['PENDING'],
};

export function statusSah(nilai: unknown): StatusBooking | null {
  const s = String(nilai || '').trim().toUpperCase();
  return (STATUS_BOOKING as string[]).includes(s) ? (s as StatusBooking) : null;
}

export function bolehTransisi(dari: StatusBooking, ke: StatusBooking): boolean {
  if (dari === ke) return false;
  return TRANSISI[dari]?.includes(ke) ?? false;
}

/** Status yang dihitung dari nominal (bukan dari input pengguna). */
export function statusDariNominal(total: number, dibayar: number): StatusBooking {
  const t = Number(total) || 0;
  const d = Number(dibayar) || 0;
  if (t > 0 && d >= t) return 'PAID';
  if (d > 0) return 'DP';
  return 'PENDING';
}

/** Apakah status ini masih boleh menerima pembayaran baru? */
export function bolehTerimaPembayaran(s: StatusBooking): boolean {
  return s !== 'CANCELLED';
}

/** Apakah status ini dihitung sebagai pemakaian kuota batch? */
export function memakaiKuota(s: StatusBooking): boolean {
  return s !== 'CANCELLED';
}
