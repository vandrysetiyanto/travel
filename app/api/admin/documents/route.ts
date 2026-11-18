import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const batchId = searchParams.get('batch_id');

    let query = `
      SELECT j.id, j.full_name, j.nik, j.phone, j.passport_number, j.passport_expiry,
             j.passport_status, j.visa_status, j.passport_physical_status,
             j.visa_physical_status, j.document_notes,
             t.booking_code, b.batch_name, p.name as package_name
        FROM master_jamaah j
        LEFT JOIN booking_jamaah bj ON j.id = bj.jamaah_id
        LEFT JOIN transactions t ON bj.transaction_id = t.id
        LEFT JOIN batches b ON t.batch_id = b.id
        LEFT JOIN packages p ON b.package_id = p.id
       WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'ALL') {
      query += ' AND j.passport_physical_status = ?';
      params.push(status);
    }
    if (batchId && batchId !== 'ALL') {
      query += ' AND t.batch_id = ?';
      params.push(batchId);
    }

    query += ' ORDER BY j.full_name ASC';
    const documents = db.prepare(query).all(...params);
    const batches = db.prepare('SELECT id, batch_name FROM batches ORDER BY departure_date ASC').all();

    const ringkasan = {
      di_kantor: (db.prepare("SELECT COUNT(*) as c FROM master_jamaah WHERE passport_physical_status = 'DI_KANTOR'").get() as any).c,
      vendor: (db.prepare("SELECT COUNT(*) as c FROM master_jamaah WHERE passport_physical_status = 'VENDOR'").get() as any).c,
      kedutaan: (db.prepare("SELECT COUNT(*) as c FROM master_jamaah WHERE passport_physical_status = 'KEDUTAAN'").get() as any).c,
      selesai: (db.prepare("SELECT COUNT(*) as c FROM master_jamaah WHERE passport_physical_status = 'SELESAI'").get() as any).c,
    };

    return NextResponse.json({ success: true, documents, batches, ringkasan });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, jamaah_id, passport_physical_status, visa_physical_status, document_notes } = body;

    if (action === 'UPDATE_DOC_STATUS') {
      if (!jamaah_id) return NextResponse.json({ success: false, message: 'ID Jamaah diperlukan' }, { status: 400 });

      db.prepare(`
        UPDATE master_jamaah
           SET passport_physical_status = COALESCE(?, passport_physical_status),
               visa_physical_status = COALESCE(?, visa_physical_status),
               document_notes = COALESCE(?, document_notes)
         WHERE id = ?
      `).run(passport_physical_status || null, visa_physical_status || null, document_notes || null, jamaah_id);

      return NextResponse.json({ success: true, message: 'Status fisik dokumen berhasil diperbarui' });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
