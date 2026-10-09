import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { mapPayment } from '@/lib/booking';

/** Daftar pembayaran satu booking (admin, setelah login). */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const booking_code = searchParams.get('booking_code');
    if (!booking_code) {
      return NextResponse.json({ success: false, message: 'booking_code wajib diisi' }, { status: 400 });
    }

    const tx = db
      .prepare(
        `SELECT t.*, j.nik, j.full_name, j.phone, j.email,
                b.batch_name, p.name as package_name, p.price as unit_price
         FROM transactions t
         JOIN master_jamaah j ON t.jamaah_id = j.id
         JOIN batches b ON t.batch_id = b.id
         JOIN packages p ON b.package_id = p.id
         WHERE t.booking_code = ?`
      )
      .get(booking_code) as any;

    if (!tx) {
      return NextResponse.json({ success: false, message: 'Booking tidak ditemukan' }, { status: 404 });
    }

    const rows = db
      .prepare('SELECT * FROM payment_history WHERE transaction_id = ? ORDER BY created_at ASC')
      .all(tx.id) as any[];

    return NextResponse.json({
      success: true,
      booking_code,
      booking: tx,
      payments: rows.map(mapPayment),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
