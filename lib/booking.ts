// Turunan data dari skema baru (transactions + payment_history) supaya bentuk
// respons tetap sama dengan yang diharapkan komponen UI (TrackForm dkk).
import db from './db';
import { statusDariNominal } from '@/lib/status-booking';

/** Jumlah jemaah dalam satu booking: ambil dari kolom total_pilgrims,
 *  fallback hitung dari jemaah yang terhubung lewat group_code. */
export function pilgrimCountOf(tx: { id: number; total_pilgrims?: number; booking_code?: string }): number {
  if (tx.total_pilgrims && tx.total_pilgrims > 0) return tx.total_pilgrims;
  // Fallback: hitung dari tabel penghubung id, bukan dari group_code (teks).
  if (tx.id) {
    const r = db.prepare('SELECT COUNT(*) as c FROM booking_jamaah WHERE transaction_id = ?').get(tx.id) as any;
    if (r && r.c > 0) return r.c;
  }
  return 1;
}

/** Daftar jemaah satu booking: leader + anggota, lewat tabel booking_jamaah (id). */
export function pilgrimsOf(tx: { id: number; jamaah_id: number; booking_code?: string }): any[] {
  const rows = db
    .prepare(`
      SELECT j.*, bj.peran, bj.urutan
      FROM booking_jamaah bj
      JOIN master_jamaah j ON j.id = bj.jamaah_id
      WHERE bj.transaction_id = ?
      ORDER BY bj.urutan ASC, bj.id ASC
    `)
    .all(tx.id) as any[];

  if (rows.length) return rows;

  // Data lama (sebelum tabel penghubung ada): leader saja.
  const leader = db.prepare('SELECT * FROM master_jamaah WHERE id = ?').get(tx.jamaah_id) as any;
  return leader ? [leader] : [];
}

/** payment_history -> bentuk yang dipakai TrackForm (payment_number + status verifikasi). */
export function mapPayment(p: any) {
  return {
    ...p,
    payment_number: p.receipt_number,
    status: p.status === 'REJECTED' ? 'REJECTED' : (p.status === 'PENDING' || p.status === 'WAITING_APPROVAL') ? 'PENDING' : 'APPROVED',
  };
}

/** Hitung ulang paid/remaining/status transaksi dari SEMUA pembayaran APPROVED.
 *  Dipakai setelah upload bukti (pending) maupun setelah verifikasi admin. */
export function recalcTransaction(transactionId: number) {
  const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transactionId) as any;
  if (!tx) return null;

  const sum = db
    .prepare(`SELECT COALESCE(SUM(amount),0) as c FROM payment_history WHERE transaction_id = ? AND status = 'APPROVED'`)
    .get(transactionId) as any;
  const paid = Number(sum.c) || 0;
  const tagihan = Number(tx.total_amount) || 0;

  /*
   * Sisa tagihan TIDAK dipaksa 0 saat kelebihan bayar.
   *
   * Dulu: `Math.max(0, tagihan - paid)` membuat kelebihan bayar hilang tanpa
   * jejak (uang masuk 13 juta atas tagihan 10 juta -> sisa 0, 3 juta tak
   * tercatat). Sekarang nilai negatif dibiarkan agar kelebihan bayar TERLIHAT
   * dan bisa ditindaklanjuti (refund / dialihkan ke booking lain / koreksi).
   * Jalur API sudah menolak lebih bayar; ini jaring pengaman untuk data lama
   * dan pemanggil lain.
   */
  const remaining = tagihan - paid;
  // Status dihitung dari nominal lewat satu sumber (lib/status-booking).
  const status = statusDariNominal(tagihan, paid);

  db.prepare('UPDATE transactions SET paid_amount = ?, remaining_amount = ?, status = ? WHERE id = ?').run(
    paid,
    remaining,
    status,
    transactionId
  );

  return { paid, remaining, status, lebihBayar: Math.max(0, paid - tagihan) };
}

/** Rekening transfer yang ditampilkan di halaman track (satu sumber kebenaran). */
export const BANK_ACCOUNTS = [
  { bank: 'Bank BCA', number: '123-456-7890', holder: 'a.n PT Al-Barakah Travel' },
  { bank: 'Bank Mandiri', number: '130-00-1234567', holder: 'a.n PT Al-Barakah Travel' },
  { bank: 'Bank BSI', number: '720-123-4567', holder: 'a.n PT Al-Barakah Travel' },
];


/**
 * Otomatis membatalkan (expire) transaksi PENDING yang belum membayar DP
 * setelah melewati batas waktu (default 48 jam), sehingga kuota kursi
 * kembali terbuka untuk jamaah lain.
 */
export function expirePendingBookings(hoursLimit = 48): number {
  try {
    const res = db.prepare(`
      UPDATE transactions
         SET status = 'CANCELLED',
             notes = CASE 
               WHEN notes IS NULL OR notes = '' THEN '[Auto-Expired: DP melewati batas waktu 48 jam]'
               ELSE notes || ' [Auto-Expired: DP melewati batas waktu 48 jam]'
             END
       WHERE status = 'PENDING'
         AND paid_amount = 0
         AND datetime(created_at, '+' || ? || ' hours') < datetime('now')
    `).run(hoursLimit);
    return res.changes;
  } catch (err) {
    console.error('Error expirePendingBookings:', err);
    return 0;
  }
}
