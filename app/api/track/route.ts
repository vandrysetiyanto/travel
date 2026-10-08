import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { pilgrimCountOf, pilgrimsOf, mapPayment } from '@/lib/booking';

// Skema baru: satu booking = satu baris `transactions` (+ anggota lewat group_code),
// dibaca lewat `master_jamaah` dan `payment_history`.
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');

    if (!code) {
      return NextResponse.json({ success: false, message: 'Kode booking wajib diisi.' }, { status: 400 });
    }

    const tx = db
      .prepare(
        `SELECT t.*, j.nik, j.no_kk, j.full_name, j.gender, j.birth_place, j.birth_date, j.phone,
                j.email, j.address, j.passport_number, j.passport_expiry, j.passport_status, j.visa_status,
                b.batch_name, b.departure_date, b.return_date,
                p.name as package_name, p.category, p.price as unit_price, p.airline, p.duration_days,
                p.hotel_makkah, p.hotel_madinah
         FROM transactions t
         JOIN master_jamaah j ON t.jamaah_id = j.id
         JOIN batches b ON t.batch_id = b.id
         JOIN packages p ON b.package_id = p.id
         WHERE t.booking_code = ?`
      )
      .get(code) as any;

    if (!tx) {
      return NextResponse.json({ success: false, message: 'Kode booking tidak ditemukan.' }, { status: 404 });
    }

    const payments = db
      .prepare('SELECT * FROM payment_history WHERE transaction_id = ? ORDER BY created_at DESC')
      .all(tx.id) as any[];

    const registration = {
      ...tx,
      applicant_name: tx.full_name,
      applicant_phone: tx.phone,
      applicant_email: tx.email || '',
      registration_type: 'ONLINE',
      total_pilgrims: pilgrimCountOf(tx),
      payment_status: tx.status,
    };

    return NextResponse.json({
      success: true,
      registration,
      pilgrims: pilgrimsOf(tx),
      payments: payments.map(mapPayment),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
