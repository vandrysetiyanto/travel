import { NextResponse } from 'next/server';
import { galatServer } from '@/lib/galat';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';

initDB();

/** Manifest keberangkatan: satu baris per JEMAAH (leader + anggota group_code),
 *  bukan per booking, supaya daftar manifest benar-benar berisi semua jemaah. */
export async function GET(request: Request) {
  const auth = await requirePermission(request, 'report.operational');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const batch_id = searchParams.get('batch_id');

    let query = `
      SELECT DISTINCT t.id as transaction_id, t.booking_code, t.status as payment_status,
             t.paid_amount, t.remaining_amount, t.total_pilgrims,
             j.id as jamaah_id, j.nik, j.no_kk, j.full_name, j.gender, j.birth_place, j.birth_date,
             j.phone, j.address, j.passport_number, j.passport_expiry, j.passport_status,
             j.marriage_doc_status, j.visa_status, j.group_code,
             b.id as batch_id, b.batch_name, b.departure_date, b.return_date,
             p.name as package_name, p.category, p.hotel_makkah, p.hotel_madinah, p.airline
      FROM transactions t
      JOIN batches b ON b.id = t.batch_id
      JOIN packages p ON p.id = b.package_id
      JOIN booking_jamaah bj ON bj.transaction_id = t.id
      JOIN master_jamaah j ON j.id = bj.jamaah_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (batch_id) {
      query += ' AND t.batch_id = ?';
      params.push(batch_id);
    }

    query += ' ORDER BY b.departure_date ASC, j.full_name ASC';
    const manifest = db.prepare(query).all(...params);

    const batches = db.prepare(`
      SELECT b.*, p.name as package_name
      FROM batches b
      JOIN packages p ON b.package_id = p.id
      ORDER BY b.departure_date DESC
    `).all();

    return NextResponse.json({ success: true, manifest, batches });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/manifest' });
  }
}
