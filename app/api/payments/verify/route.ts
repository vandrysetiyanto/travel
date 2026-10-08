import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { recalcTransaction } from '@/lib/booking';

/**
 * Verifikasi pembayaran oleh admin. Endpoint ini WAJIB login (satu-satunya jalur
 * yang menaikkan paid_amount, jadi tidak boleh terbuka).
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const paymentId = Number(body.payment_id ?? body.paymentId);
    const action = String(body.action || '').toUpperCase();
    const notes = body.notes ? String(body.notes) : '';
    const verifiedBy = auth.user?.name || auth.user?.email || 'Admin';

    if (!paymentId || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Parameter tidak valid' }, { status: 400 });
    }

    const payment = db.prepare('SELECT * FROM payment_history WHERE id = ?').get(paymentId) as any;
    if (!payment) {
      return NextResponse.json({ success: false, message: 'Data pembayaran tidak ditemukan' }, { status: 404 });
    }
    if (payment.status === 'APPROVED' && action === 'APPROVE') {
      return NextResponse.json({ success: false, message: 'Pembayaran ini sudah disetujui sebelumnya.' }, { status: 400 });
    }

    const now = new Date().toISOString();

    if (action === 'APPROVE') {
      db.prepare(
        `UPDATE payment_history SET status = 'APPROVED', created_by = ?, notes = ? WHERE id = ?`
      ).run(verifiedBy, notes || 'Pembayaran disetujui & diverifikasi', paymentId);
    } else {
      db.prepare(
        `UPDATE payment_history SET status = 'REJECTED', created_by = ?, notes = ? WHERE id = ?`
      ).run(verifiedBy, notes || 'Pembayaran ditolak', paymentId);
    }

    // Hitung ulang dari SEMUA pembayaran APPROVED (bukan dari angka lama di baris transaksi).
    const result = recalcTransaction(payment.transaction_id);

    return NextResponse.json({
      success: true,
      message: action === 'APPROVE' ? 'Pembayaran berhasil disetujui!' : 'Pembayaran berhasil ditolak.',
      transaction: result,
    });
  } catch (error: any) {
    console.error('Verify Payment Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
