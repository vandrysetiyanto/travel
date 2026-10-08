import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

initDB();

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const nik = searchParams.get('nik');

    if (nik) {
      const jamaah = db.prepare('SELECT * FROM master_jamaah WHERE nik = ?').get(nik);
      return NextResponse.json({ success: true, jamaah });
    }

    let query = 'SELECT * FROM master_jamaah';
    const params: string[] = [];

    if (search) {
      query += ' WHERE nik LIKE ? OR full_name LIKE ? OR phone LIKE ?';
      const term = `%${search}%`;
      params.push(term, term, term);
    }

    query += ' ORDER BY created_at DESC';
    const jamaahList = db.prepare(query).all(...params);
    return NextResponse.json({ success: true, jamaah: jamaahList });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const {
      nik, no_kk, full_name, gender, birth_place, birth_date,
      phone, email, address, passport_number, passport_expiry,
      passport_status, marriage_doc_status, visa_status, notes
    } = body;

    if (!nik || !full_name) {
      return NextResponse.json({ success: false, message: 'NIK dan Nama Lengkap wajib diisi' }, { status: 400 });
    }

    const exist = db.prepare('SELECT id FROM master_jamaah WHERE nik = ?').get(nik) as any;
    if (exist) {
      db.prepare(`
        UPDATE master_jamaah SET
          no_kk = COALESCE(?, no_kk), full_name = COALESCE(?, full_name),
          gender = COALESCE(?, gender), birth_place = COALESCE(?, birth_place),
          birth_date = COALESCE(?, birth_date), phone = COALESCE(?, phone),
          email = COALESCE(?, email), address = COALESCE(?, address),
          passport_number = COALESCE(?, passport_number), passport_expiry = COALESCE(?, passport_expiry),
          passport_status = COALESCE(?, passport_status), marriage_doc_status = COALESCE(?, marriage_doc_status),
          visa_status = COALESCE(?, visa_status), notes = COALESCE(?, notes)
        WHERE nik = ?
      `).run(
        no_kk, full_name, gender, birth_place, birth_date,
        phone, email, address, passport_number, passport_expiry,
        passport_status, marriage_doc_status, visa_status, notes, nik
      );
      return NextResponse.json({ success: true, message: 'Data Jamaah berhasil diperbarui', jamaah_id: exist.id });
    } else {
      const res = db.prepare(`
        INSERT INTO master_jamaah (
          nik, no_kk, full_name, gender, birth_place, birth_date,
          phone, email, address, passport_number, passport_expiry,
          passport_status, marriage_doc_status, visa_status, notes
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        nik, no_kk || '', full_name, gender || 'L', birth_place || '', birth_date || '',
        phone || '', email || '', address || '', passport_number || '', passport_expiry || '',
        passport_status || 'BELUM', marriage_doc_status || 'BELUM', visa_status || 'BELUM', notes || ''
      );
      return NextResponse.json({ success: true, message: 'Jamaah baru berhasil ditambahkan', jamaah_id: Number(res.lastInsertRowid) });
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
