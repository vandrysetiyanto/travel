import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batch_id');

    const batches = db.prepare('SELECT id, batch_name FROM batches ORDER BY departure_date ASC').all();

    if (!batchId) {
      return NextResponse.json({ success: true, batches });
    }

    const pilgrims = db.prepare(`
      SELECT j.id, j.full_name, j.nik, j.phone, j.attendance_status, j.luggage_tag_code,
             t.booking_code, b.batch_name
        FROM master_jamaah j
        JOIN booking_jamaah bj ON j.id = bj.jamaah_id
        JOIN transactions t ON bj.transaction_id = t.id
        LEFT JOIN batches b ON t.batch_id = b.id
       WHERE t.batch_id = ? AND t.status <> 'CANCELLED'
       ORDER BY j.full_name ASC
    `).all(batchId);

    const ringkasan = {
      total: pilgrims.length,
      belum_hadir: pilgrims.filter((p: any) => p.attendance_status === 'BELUM_HADIR' || !p.attendance_status).length,
      hadir_bandara: pilgrims.filter((p: any) => p.attendance_status === 'HADIR_BANDARA').length,
      boarding: pilgrims.filter((p: any) => p.attendance_status === 'BOARDING').length,
    };

    return NextResponse.json({ success: true, batches, pilgrims, ringkasan });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, jamaah_id, attendance_status, luggage_tag_code } = body;

    if (action === 'UPDATE_ATTENDANCE') {
      if (!jamaah_id) return NextResponse.json({ success: false, message: 'ID Jamaah diperlukan' }, { status: 400 });

      // Auto-generate luggage tag if empty and status is checking in
      let tagCode = luggage_tag_code;
      if (!tagCode && attendance_status === 'HADIR_BANDARA') {
        tagCode = 'TAG-' + Math.floor(100000 + Math.random() * 900000);
      }

      db.prepare(`
        UPDATE master_jamaah
           SET attendance_status = COALESCE(?, attendance_status),
               luggage_tag_code = COALESCE(?, luggage_tag_code)
         WHERE id = ?
      `).run(attendance_status || null, tagCode || null, jamaah_id);

      return NextResponse.json({ success: true, message: 'Presensi jamaah diperbarui' });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
