import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { requirePermission, catatAudit } from '@/lib/permissions';

initDB();

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'jamaah.read');
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

    /*
     * Paginasi OPSIONAL.
     *
     * Tanpa parameter, perilaku tetap seperti sebelumnya (seluruh baris) supaya
     * UI yang sudah ada tidak rusak. Bila `limit` dikirim, server membatasi
     * jumlah baris dan menyertakan `total` agar klien bisa membuat navigasi.
     * Ini mencegah payload membengkak saat data jamaah bertambah ribuan.
     */
    const limitParam = searchParams.get('limit');
    const offsetParam = searchParams.get('offset');
    const limit = limitParam ? Math.min(Math.max(Number(limitParam) || 0, 1), 500) : null;
    const offset = offsetParam ? Math.max(Number(offsetParam) || 0, 0) : 0;

    let total: number | null = null;
    if (limit !== null) {
      const hitung = query.replace('SELECT * FROM master_jamaah', 'SELECT COUNT(*) c FROM master_jamaah');
      total = Number((db.prepare(hitung).get(...params) as { c: number }).c) || 0;
      query += ' LIMIT ? OFFSET ?';
    }

    const jamaahList = limit !== null
      ? db.prepare(query).all(...params, limit, offset)
      : db.prepare(query).all(...params);

    return NextResponse.json({
      success: true,
      jamaah: jamaahList,
      ...(limit !== null ? { total, limit, offset, ada_lagi: offset + jamaahList.length < (total || 0) } : {}),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();

    /*
     * Hapus jamaah. UI (dashboard) sudah lama mengirim action ini, tetapi route-nya
     * belum pernah menanganinya — tombol hapus jadi gagal diam-diam.
     * Aturan: jamaah yang sudah punya booking TIDAK dihapus (jejak keuangan harus utuh);
     * checklist-nya ikut dibersihkan karena hanya milik jamaah tersebut.
     */
    if (String(body.action || '').toUpperCase() === 'DELETE_JAMAAH') {
      { const cek = await requirePermission(request, 'jamaah.delete'); if (!cek.ok) return cek.response; }
      const id = Number(body.id);
      if (!id) {
        return NextResponse.json({ success: false, message: 'ID jamaah wajib dikirim' }, { status: 400 });
      }

      const target = db.prepare('SELECT id, full_name FROM master_jamaah WHERE id = ?').get(id) as any;
      if (!target) {
        return NextResponse.json({ success: false, message: 'Jamaah tidak ditemukan' }, { status: 404 });
      }

      const booking = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE jamaah_id = ?').get(id) as any;
      if (booking.c > 0) {
        return NextResponse.json({
          success: false,
          message: `Jamaah "${target.full_name}" sudah punya ${booking.c} booking. Riwayat keuangan tidak boleh dihapus — batalkan booking dulu.`,
        }, { status: 409 });
      }

      const hapus = db.transaction(() => {
        db.prepare('DELETE FROM jamaah_checklist WHERE jamaah_id = ?').run(id);
        db.prepare('DELETE FROM master_jamaah WHERE id = ?').run(id);
      });
      hapus();

      catatAudit({ user: auth.user, action: 'DELETE', module: 'jamaah', recordId: target.id });
      return NextResponse.json({ success: true, message: `Jamaah "${target.full_name}" berhasil dihapus` });
    }

    { const cek = await requirePermission(request, 'jamaah.create'); if (!cek.ok) return cek.response; }

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
