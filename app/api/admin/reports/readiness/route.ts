import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const batches = db.prepare(`
      SELECT b.*, p.package_name, p.airline
        FROM batches b
        JOIN packages p ON b.package_id = p.id
       ORDER BY b.departure_date ASC
    `).all() as any[];

    const readiness = batches.map(batch => {
      // Ambil transaksi di batch ini
      const transactions = db.prepare(`
        SELECT t.id, t.status, t.total_amount, t.paid_amount, j.id as jamaah_id, j.full_name, j.passport_status, j.visa_status
          FROM transactions t
          JOIN booking_jamaah bj ON t.id = bj.transaction_id
          JOIN master_jamaah j ON bj.jamaah_id = j.id
         WHERE t.batch_id = ? AND t.status <> 'CANCELLED'
      `).all(batch.id) as any[];

      const totalJamaah = transactions.length;
      const lunasCount = transactions.filter(t => t.status === 'PAID').length;
      const pasporAmanCount = transactions.filter(t => t.passport_status === 'SUDAH').length;
      const visaIssuedCount = transactions.filter(t => t.visa_status === 'ISSUED').length;

      // Hitung checklist wajib yang sudah selesai (mandatory items)
      let totalChecklistMandatory = 0;
      let totalChecklistSelesai = 0;

      const mandatoryItems = db.prepare('SELECT id FROM checklist_master WHERE is_mandatory = 1').all() as any[];
      const mandatoryIds = new Set(mandatoryItems.map(m => m.id));

      for (const t of transactions) {
        totalChecklistMandatory += mandatoryIds.size;
        const checks = db.prepare('SELECT checklist_id, status FROM jamaah_checklist WHERE jamaah_id = ?').all(t.jamaah_id) as any[];
        for (const c of checks) {
          if (mandatoryIds.has(c.checklist_id) && c.status === 'SELESAI') {
            totalChecklistSelesai++;
          }
        }
      }

      // Persentase Kesiapan (bobot: Pembayaran 30%, Paspor 30%, Visa 20%, Checklist Mandatori 20%)
      const scoreFinansial = totalJamaah > 0 ? (lunasCount / totalJamaah) * 30 : 0;
      const scorePaspor = totalJamaah > 0 ? (pasporAmanCount / totalJamaah) * 30 : 0;
      const scoreVisa = totalJamaah > 0 ? (visaIssuedCount / totalJamaah) * 20 : 0;
      const scoreChecklist = totalChecklistMandatory > 0 ? (totalChecklistSelesai / totalChecklistMandatory) * 20 : 0;

      const totalScore = Math.round(scoreFinansial + scorePaspor + scoreVisa + scoreChecklist);

      return {
        ...batch,
        total_jamaah: totalJamaah,
        sisa_kuota: Math.max(0, batch.quota - totalJamaah),
        lunas_count: lunasCount,
        paspor_count: pasporAmanCount,
        visa_count: visaIssuedCount,
        checklist_score: totalChecklistMandatory > 0 ? Math.round((totalChecklistSelesai / totalChecklistMandatory) * 100) : 0,
        readiness_score: totalScore,
      };
    });

    return NextResponse.json({ success: true, readiness });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
