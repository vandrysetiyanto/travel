import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

initDB();

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const packages = db.prepare('SELECT * FROM packages ORDER BY created_at DESC').all();
    const batches = db.prepare(`
      SELECT b.*, p.name as package_name, p.category, p.price as default_price, p.hotel_makkah, p.hotel_madinah, p.airline
      FROM batches b
      JOIN packages p ON b.package_id = p.id
      ORDER BY b.departure_date ASC
    `).all();

    return NextResponse.json({ success: true, packages, batches });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { action } = body;

    // 1. Tambah Paket Baru
    if (action === 'CREATE_PACKAGE' || !action) {
      const { name, category, description, duration_days, price, hotel_makkah, hotel_madinah, airline, departure_city, departure_date, return_date, quota } = body;

      if (!name || !price) {
        return NextResponse.json({ success: false, message: 'Nama paket dan harga wajib diisi' }, { status: 400 });
      }

      const insertPkg = db.prepare(`
        INSERT INTO packages (name, category, description, duration_days, price, hotel_makkah, hotel_madinah, airline, departure_city)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const pkgResult = insertPkg.run(
        name,
        category || 'Umroh Reguler',
        description || '',
        Number(duration_days) || 9,
        Number(price),
        hotel_makkah || '',
        hotel_madinah || '',
        airline || '',
        departure_city || 'Jakarta (CGK)'
      );

      // Jika ada input batch awal
      if (departure_date && return_date) {
        const insertBatch = db.prepare(`
          INSERT INTO batches (package_id, batch_name, departure_date, return_date, quota, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertBatch.run(
          pkgResult.lastInsertRowid,
          `Batch 1 - ${name}`,
          departure_date,
          return_date,
          Number(quota) || 45,
          'OPEN'
        );
      }

      return NextResponse.json({ success: true, message: 'Paket berhasil ditambahkan!' });
    }

    // 2. Update Paket
    if (action === 'UPDATE_PACKAGE') {
      const { id, name, category, description, duration_days, price, hotel_makkah, hotel_madinah, airline, departure_city, is_active } = body;
      db.prepare(`
        UPDATE packages SET
          name = ?, category = ?, description = ?, duration_days = ?,
          price = ?, hotel_makkah = ?, hotel_madinah = ?, airline = ?,
          departure_city = ?, is_active = ?
        WHERE id = ?
      `).run(
        name, category, description, Number(duration_days),
        Number(price), hotel_makkah, hotel_madinah, airline,
        departure_city, is_active ?? 1, id
      );
      return NextResponse.json({ success: true, message: 'Data paket berhasil diperbarui!' });
    }

    // 3. Tambah Batch Baru
    if (action === 'CREATE_BATCH') {
      const { package_id, batch_name, departure_date, return_date, quota, status } = body;
      if (!package_id || !batch_name || !departure_date || !return_date) {
        return NextResponse.json({ success: false, message: 'Paket, nama batch, dan tanggal wajib diisi' }, { status: 400 });
      }
      db.prepare(`
        INSERT INTO batches (package_id, batch_name, departure_date, return_date, quota, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(package_id, batch_name, departure_date, return_date, Number(quota) || 45, status || 'OPEN');
      return NextResponse.json({ success: true, message: 'Batch keberangkatan berhasil ditambahkan!' });
    }

    // 4. Update Batch
    if (action === 'UPDATE_BATCH') {
      const { id, package_id, batch_name, departure_date, return_date, quota, status } = body;
      db.prepare(`
        UPDATE batches SET
          package_id = ?, batch_name = ?, departure_date = ?, return_date = ?, quota = ?, status = ?
        WHERE id = ?
      `).run(package_id, batch_name, departure_date, return_date, Number(quota), status, id);
      return NextResponse.json({ success: true, message: 'Batch keberangkatan berhasil diperbarui!' });
    }

    // 5. Delete Batch
    if (action === 'DELETE_BATCH') {
      const { id } = body;
      db.prepare('DELETE FROM batches WHERE id = ?').run(id);
      return NextResponse.json({ success: true, message: 'Batch berhasil dihapus' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
