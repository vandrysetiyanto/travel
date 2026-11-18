import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { booking_code, pilgrim_name, city, package_name, rating, comment } = body;

    if (!pilgrim_name || !comment) {
      return NextResponse.json({ success: false, message: 'Nama dan komentar wajib diisi' }, { status: 400 });
    }

    db.prepare(`
      INSERT INTO testimonials (booking_code, pilgrim_name, city, package_name, rating, comment, status)
      VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
    `).run(booking_code || null, pilgrim_name, city || 'Indonesia', package_name || 'Paket Umroh', Number(rating) || 5, comment);

    return NextResponse.json({ success: true, message: 'Testimoni berhasil dikirim dan menunggu moderasi' });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const approvedOnly = searchParams.get('approved') === 'true';

    if (approvedOnly) {
      const testimonials = db.prepare(`
        SELECT id, pilgrim_name, city, package_name, rating, comment, created_at
          FROM testimonials
         WHERE status = 'APPROVED'
         ORDER BY id DESC
      `).all();
      return NextResponse.json({ success: true, testimonials });
    }

    // Admin view
    const auth = await requireAdmin(request);
    if (!auth.ok) return auth.response;

    const testimonials = db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all();
    return NextResponse.json({ success: true, testimonials });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
