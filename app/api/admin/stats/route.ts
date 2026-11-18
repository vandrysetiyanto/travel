import { NextResponse } from 'next/server';
import { galatServer } from '@/lib/galat';
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
      .prepare("SELECT COUNT(*) as c FROM payment_history WHERE status IN ('PENDING','WAITING_APPROVAL')")
      .get() as any;

    const readyCommissions = db
      .prepare("SELECT COALESCE(SUM(nominal),0) as s FROM commissions WHERE status = 'ELIGIBLE'")
      .get() as any;

    const passportRisks = db
      .prepare("SELECT COUNT(*) as c FROM master_jamaah WHERE passport_expiry IS NULL OR passport_expiry = ''")
      .get() as any;

    const nextBatch = db.prepare(`
      SELECT b.*, p.name as package_name, p.airline
        FROM batches b
        JOIN packages p ON b.package_id = p.id
       WHERE b.departure_date >= date('now')
       ORDER BY b.departure_date ASC
       LIMIT 1
    `).get() as any;

    const rawMonthly = db.prepare(`
      SELECT strftime('%Y-%m', created_at) as m, COALESCE(SUM(paid_amount),0) as total
        FROM transactions
       WHERE status != 'CANCELLED'
       GROUP BY m
       ORDER BY m DESC
       LIMIT 6
    `).all() as any[];
    const monthlyRevenue = rawMonthly.reverse().map((r: any) => {
      const parts = r.m.split('-');
      const year = parts[0];
      const monthNum = Number(parts[1]) - 1;
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      return { label: `${months[monthNum] || r.m} ${year}`, amount: r.total };
    });

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
        readyCommissions: readyCommissions.s,
        passportRisks: passportRisks.c,
        nextBatch: nextBatch || null,
      },
      recentTransactions,
    }, { headers: { 'Cache-Control': 'no-store, max-age=0' } });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/stats' });
  }
}
