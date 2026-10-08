import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

initDB();

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const movements = db.prepare(`
      SELECT ih.*, ii.name as item_name, ii.unit, t.booking_code, j.full_name as jamaah_name
      FROM inventory_handover ih
      LEFT JOIN inventory_items ii ON ih.item_id = ii.id
      LEFT JOIN transactions t ON ih.transaction_id = t.id
      LEFT JOIN master_jamaah j ON t.jamaah_id = j.id
      ORDER BY ih.handed_over_at DESC
    `).all();

    return NextResponse.json({ success: true, movements });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
