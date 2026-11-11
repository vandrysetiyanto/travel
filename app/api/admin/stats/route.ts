import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';

initDB();

// WAJIB: tanpa ini Next mem-prerender route ini saat build dan membekukan
// respons "semua nol" ke disk, sehingga kartu dashboard tidak pernah berubah.
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'report.finance');
  if (!auth.ok) return auth.response;

  try {
    const totalJamaah = db.prepare('SELECT COUNT(*) as c FROM master_jamaah').get() as any;
    const totalTransactions = db.prepare('SELECT COUNT(*) as c FROM transactions').get() as any;
    const paidCount = db.prepare("SELECT COUNT(*) as c FROM transactions WHERE status = 'PAID'").get() as any;
    const dpCount = db.prepare("SELECT COUNT(*) as c FROM transactions WHERE status = 'DP'").get() as any;
    const pendingCount = db.prepare("SELECT COUNT(*) as c FROM transactions WHERE status = 'PENDING'").get() as any;
    const totalRevenue = db.prepare('SELECT COALESCE(SUM(paid_amount),0) as c FROM transactions').get() as any;
    const totalReceivables = db.prepare('SELECT COALESCE(SUM(remaining_amount),0) as c FROM transactions').get() as any;

    const pendingVerification = db
      .prepare("SELECT COUNT(*) as c FROM payment_history WHERE status = 'WAITING_APPROVAL'")
      .get() as any;

    const recentTransactions = db.prepare(`
      SELECT t.*, j.full_name, j.nik, b.batch_name, p.name as package_name
      FROM transactions t
      JOIN master_jamaah j ON t.jamaah_id = j.id
      JOIN batches b ON t.batch_id = b.id
      JOIN packages p ON b.package_id = p.id
      ORDER BY t.created_at DESC LIMIT 10
    `).all();

    // Defense in depth: DB sudah dinamis, header ini menjamin angka statistik
    // tidak pernah disajikan dari cache (dulu endpoint ini ikut di-prerender statis).
    return NextResponse.json({
      success: true,
      stats: {
        totalJamaah: totalJamaah.c,
        totalTransactions: totalTransactions.c,
        paidCount: paidCount.c,
        dpCount: dpCount.c,
        pendingCount: pendingCount.c,
        totalRevenue: totalRevenue.c,
        totalReceivables: totalReceivables.c,
        pendingVerification: pendingVerification.c,
      },
      recentTransactions,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
