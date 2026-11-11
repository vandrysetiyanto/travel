import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { pilgrimCountOf } from '@/lib/booking';

initDB();

/** Daftar booking (skema baru: `transactions` + anggota lewat group_code). */
export async function GET(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const batchId = searchParams.get('batch_id');
    const status = searchParams.get('status');

    let query = `
      SELECT t.*, j.nik, j.full_name, j.phone,
             b.batch_name, b.departure_date, p.name as package_name, p.price as package_price
      FROM transactions t
      JOIN master_jamaah j ON t.jamaah_id = j.id
      JOIN batches b ON t.batch_id = b.id
      JOIN packages p ON b.package_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (batchId) {
      query += ` AND t.batch_id = ?`;
      params.push(batchId);
    }
    if (status && status !== 'ALL') {
      query += ` AND t.status = ?`;
      params.push(status);
    }
    query += ` ORDER BY t.created_at DESC`;

    const rows = db.prepare(query).all(...params) as any[];

    const registrations = rows.map((r) => ({
      ...r,
      registration_type: 'ONLINE',
      applicant_name: r.full_name,
      applicant_phone: r.phone,
      payment_status: r.status,
      total_pilgrims: pilgrimCountOf(r),
    }));

    return NextResponse.json({ success: true, registrations });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
