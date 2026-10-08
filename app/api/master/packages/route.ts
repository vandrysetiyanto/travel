import { NextResponse } from 'next/server';
import db from '@/lib/db';

// WAJIB: cegah prerender statis (kalau dibekukan, paket/batch baru tidak muncul
// di dropdown form pendaftaran sampai build ulang).
export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const packages = db.prepare('SELECT * FROM packages WHERE is_active = 1 ORDER BY price ASC').all();
    const batches = db.prepare(`
      SELECT b.*, p.name as package_name, p.category, p.price, p.airline, p.duration_days
      FROM batches b
      JOIN packages p ON b.package_id = p.id
      WHERE b.status = 'OPEN'
      ORDER BY b.departure_date ASC
    `).all();

    // Defense in depth: DB sudah dinamis, tapi header ini menjamin tidak ada cache
    // perantara/CDN yang menyajikan daftar paket basi.
    return NextResponse.json(
      { success: true, packages, batches },
      { headers: { 'Cache-Control': 'no-store, max-age=0' } }
    );
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
