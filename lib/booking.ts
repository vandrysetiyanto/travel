// Turunan data dari skema baru (transactions + payment_history) supaya bentuk
// respons tetap sama dengan yang diharapkan komponen UI (TrackForm dkk).
import db from './db';

/** Jumlah jemaah dalam satu booking: ambil dari kolom total_pilgrims,
 *  fallback hitung dari jemaah yang terhubung lewat group_code. */
export function pilgrimCountOf(tx: { id: number; total_pilgrims?: number; booking_code?: string }): number {
  if (tx.total_pilgrims && tx.total_pilgrims > 0) return tx.total_pilgrims;
  if (tx.booking_code) {
    const r = db
      .prepare(`SELECT COUNT(*) as c FROM master_jamaah WHERE group_code = ? AND group_code IS NOT NULL`)
      .get(tx.booking_code) as any;
    if (r && r.c > 0) return r.c;
  }
  return 1;
}

/** Daftar jemaah satu booking: leader (transactions.jamaah_id) + anggota group_code. */
export function pilgrimsOf(tx: { id: number; jamaah_id: number; booking_code?: string }): any[] {
  const leader = db.prepare('SELECT * FROM master_jamaah WHERE id = ?').get(tx.jamaah_id) as any;
  let members: any[] = [];
  if (tx.booking_code) {
    members = db
      .prepare('SELECT * FROM master_jamaah WHERE group_code = ? AND group_code IS NOT NULL ORDER BY id ASC')
      .all(tx.booking_code) as any[];
  }
  const merged: any[] = [];
  const seen = new Set<number>();
  for (const p of [leader, ...members]) {
    if (p && !seen.has(p.id)) {
      seen.add(p.id);
      merged.push(p);
    }
  }
  return merged;
}

/** payment_history -> bentuk yang dipakai TrackForm (payment_number + status verifikasi). */
export function mapPayment(p: any) {
  return {
    ...p,
    payment_number: p.receipt_number,
    status: p.status === 'REJECTED' ? 'REJECTED' : p.status === 'WAITING_APPROVAL' ? 'WAITING_APPROVAL' : 'APPROVED',
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
  const remaining = Math.max(0, tx.total_amount - paid);
  const status = remaining === 0 ? 'PAID' : paid > 0 ? 'DP' : 'PENDING';

  db.prepare('UPDATE transactions SET paid_amount = ?, remaining_amount = ?, status = ? WHERE id = ?').run(
    paid,
    remaining,
    status,
    transactionId
  );

  return { paid, remaining, status };
}

/** Rekening transfer yang ditampilkan di halaman track (satu sumber kebenaran). */
export const BANK_ACCOUNTS = [
  { bank: 'Bank BCA', number: '123-456-7890', holder: 'a.n PT Al-Barakah Travel' },
  { bank: 'Bank Mandiri', number: '130-00-1234567', holder: 'a.n PT Al-Barakah Travel' },
  { bank: 'Bank BSI', number: '720-123-4567', holder: 'a.n PT Al-Barakah Travel' },
];
