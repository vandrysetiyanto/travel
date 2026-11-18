import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const batchId = searchParams.get('batch_id');

    const batches = db.prepare(`
      SELECT b.*, p.name as package_name, p.hotel_makkah, p.hotel_madinah
        FROM batches b
        JOIN packages p ON b.package_id = p.id
       ORDER BY b.departure_date ASC
    `).all();

    if (!batchId) {
      return NextResponse.json({ success: true, batches });
    }

    // Ambil jamaah di batch ini
    const pilgrims = db.prepare(`
      SELECT DISTINCT j.id, j.full_name, j.gender, j.phone, j.passport_number
        FROM master_jamaah j
        JOIN booking_jamaah bj ON j.id = bj.jamaah_id
        JOIN transactions t ON bj.transaction_id = t.id
       WHERE t.batch_id = ? AND t.status <> 'CANCELLED'
       ORDER BY j.full_name ASC
    `).all(batchId);

    // Ambil rooming list yang sudah diatur
    const rooms = db.prepare(`
      SELECT r.*, j.full_name as jamaah_name, j.gender
        FROM rooming_list r
        JOIN master_jamaah j ON r.jamaah_id = j.id
       WHERE r.batch_id = ?
    `).all(batchId);

    return NextResponse.json({ success: true, batches, pilgrims, rooms });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, batch_id, hotel_location, room_type, room_number, jamaah_id } = body;

    if (action === 'ASSIGN_ROOM') {
      if (!batch_id || !hotel_location || !room_number || !jamaah_id) {
        return NextResponse.json({ success: false, message: 'Data alokasi kamar tidak lengkap' }, { status: 400 });
      }

      // Hapus alokasi lama untuk jamaah ini di hotel location tersebut jika ada
      db.prepare('DELETE FROM rooming_list WHERE batch_id = ? AND hotel_location = ? AND jamaah_id = ?').run(batch_id, hotel_location, jamaah_id);

      // Masukkan ke kamar baru
      db.prepare(`
        INSERT INTO rooming_list (batch_id, hotel_location, room_type, room_number, jamaah_id)
        VALUES (?, ?, ?, ?, ?)
      `).run(batch_id, hotel_location, room_type || 'QUAD', room_number.trim(), jamaah_id);

      return NextResponse.json({ success: true, message: 'Jamaah berhasil dialokasikan ke kamar' });
    }

    if (action === 'REMOVE_ROOM') {
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, message: 'ID rooming diperlukan' }, { status: 400 });
      db.prepare('DELETE FROM rooming_list WHERE id = ?').run(id);
      return NextResponse.json({ success: true, message: 'Alokasi kamar dihapus' });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
