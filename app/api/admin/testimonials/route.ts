import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const testimonials = db.prepare('SELECT * FROM testimonials ORDER BY id DESC').all();
    return NextResponse.json({ success: true, testimonials });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, id } = body;

    if (action === 'APPROVE') {
      db.prepare("UPDATE testimonials SET status = 'APPROVED' WHERE id = ?").run(id);
      return NextResponse.json({ success: true, message: 'Testimoni disetujui & dipublikasikan' });
    }

    if (action === 'DELETE') {
      db.prepare('DELETE FROM testimonials WHERE id = ?').run(id);
      return NextResponse.json({ success: true, message: 'Testimoni dihapus' });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
