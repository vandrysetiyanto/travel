import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

initDB();

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'ALL'; // ALL, DAILY, MONTHLY, YEARLY
    const date = searchParams.get('date'); // YYYY-MM-DD
    const month = searchParams.get('month'); // YYYY-MM
    const year = searchParams.get('year'); // YYYY
    const batch_id = searchParams.get('batch_id');

    let query = `
      SELECT t.id as transaction_id, t.booking_code, t.created_at as transaction_date,
             t.total_amount, t.paid_amount, t.remaining_amount, t.status as payment_status,
             j.nik, j.full_name, j.phone, j.passport_number,
             b.batch_name, b.departure_date,
             p.name as package_name, p.category
      FROM transactions t
      JOIN master_jamaah j ON t.jamaah_id = j.id
      JOIN batches b ON t.batch_id = b.id
      JOIN packages p ON b.package_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (period === 'DAILY' && date) {
      query += " AND DATE(t.created_at) = DATE(?)";
      params.push(date);
    } else if (period === 'MONTHLY' && month) {
      query += " AND strftime('%Y-%m', t.created_at) = ?";
      params.push(month);
    } else if (period === 'YEARLY' && year) {
      query += " AND strftime('%Y', t.created_at) = ?";
      params.push(year);
    }

    if (batch_id) {
      query += " AND t.batch_id = ?";
      params.push(batch_id);
    }

    query += ' ORDER BY t.created_at DESC';
    const rows = db.prepare(query).all(...params) as any[];

    const summary = rows.reduce(
      (acc, r) => {
        acc.total_transactions += 1;
        acc.total_revenue += r.paid_amount;
        acc.total_receivables += r.remaining_amount;
        if (r.payment_status === 'PAID') acc.paid_count += 1;
        else if (r.payment_status === 'DP') acc.dp_count += 1;
        else acc.pending_count += 1;
        return acc;
      },
      { total_transactions: 0, total_revenue: 0, total_receivables: 0, paid_count: 0, dp_count: 0, pending_count: 0 }
    );

    const batches = db.prepare(`
      SELECT b.*, p.name as package_name FROM batches b JOIN packages p ON b.package_id = p.id ORDER BY b.departure_date DESC
    `).all();

    return NextResponse.json({ success: true, reports: rows, summary, batches });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
