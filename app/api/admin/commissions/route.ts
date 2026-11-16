import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { tulisLedger } from '@/lib/ledger';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const agentId = searchParams.get('agent_id');

    let query = `
      SELECT c.*,
             a.name as agent_name, a.code as agent_code, a.commission_mode,
             j.full_name as jamaah_name, j.nik as jamaah_nik,
             t.booking_code, t.total_amount, t.paid_amount,
             b.batch_name
        FROM commissions c
        JOIN agents a ON c.agent_id = a.id
        JOIN master_jamaah j ON c.jamaah_id = j.id
        JOIN transactions t ON c.transaction_id = t.id
        LEFT JOIN batches b ON t.batch_id = b.id
       WHERE 1=1
    `;
    const params: any[] = [];
    if (status && status !== 'ALL') {
      query += ' AND c.status = ?';
      params.push(status);
    }
    if (agentId) {
      query += ' AND c.agent_id = ?';
      params.push(agentId);
    }

    query += ' ORDER BY c.created_at DESC';
    const commissions = db.prepare(query).all(...params);

    const ringkasan = {
      total_pending: (db.prepare("SELECT COALESCE(SUM(nominal), 0) as s FROM commissions WHERE status = 'PENDING'").get() as any).s,
      total_eligible: (db.prepare("SELECT COALESCE(SUM(nominal), 0) as s FROM commissions WHERE status = 'ELIGIBLE'").get() as any).s,
      total_paid: (db.prepare("SELECT COALESCE(SUM(nominal), 0) as s FROM commissions WHERE status = 'PAID'").get() as any).s,
    };

    return NextResponse.json({ success: true, commissions, ringkasan });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, commission_id, amount, method, reference_no, notes } = body;

    if (action === 'PAY_COMMISSION') {
      if (!commission_id || !amount || Number(amount) <= 0) {
        return NextResponse.json({ success: false, message: 'ID komisi dan nominal pembayaran wajib diisi' }, { status: 400 });
      }

      const comm = db.prepare('SELECT * FROM commissions WHERE id = ?').get(commission_id) as any;
      if (!comm) return NextResponse.json({ success: false, message: 'Komisi tidak ditemukan' }, { status: 404 });
      if (comm.status !== 'ELIGIBLE' && comm.status !== 'PAID') {
        return NextResponse.json({ success: false, message: 'Komisi belum layak dibayar (status harus ELIGIBLE)' }, { status: 400 });
      }

      const paidRes = db.prepare('SELECT COALESCE(SUM(amount), 0) as total FROM commission_payments WHERE commission_id = ?').get(commission_id) as any;
      const alreadyPaid = Number(paidRes?.total || 0);
      const remaining = comm.nominal - alreadyPaid;

      const payAmount = Number(amount);
      if (payAmount > remaining) {
        return NextResponse.json({ success: false, message: `Nominal pembayaran (Rp ${payAmount.toLocaleString('id-ID')}) melebihi sisa komisi (Rp ${remaining.toLocaleString('id-ID')})` }, { status: 400 });
      }

      const coaUtang = db.prepare("SELECT id FROM chart_of_accounts WHERE coa_code = '2-102'").get() as any;
      const coaKas = db.prepare("SELECT id FROM chart_of_accounts WHERE coa_code = '1-101'").get() as any;
      if (!coaUtang || !coaKas) {
        return NextResponse.json({ success: false, message: 'Akun COA Utang Komisi (2-102) atau Kas (1-101) tidak ditemukan' }, { status: 500 });
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const tx = db.prepare('SELECT batch_id FROM transactions WHERE id = ?').get(comm.transaction_id) as any;
      const batchId = tx?.batch_id || null;

      const simpanBayar = db.transaction(() => {
        db.prepare(`
          INSERT INTO commission_payments (commission_id, amount, method, reference_no, paid_by)
          VALUES (?, ?, ?, ?, ?)
        `).run(commission_id, payAmount, method || 'TRANSFER', reference_no || '', auth.user?.email || 'Admin');

        tulisLedger(
          { transactionId: comm.transaction_id, commissionId: comm.id, batchId },
          {
            coaAccountId: coaUtang.id,
            entryType: 'DEBIT',
            amount: payAmount,
            description: `Pembayaran Komisi Agen #${comm.agent_id} untuk Booking #${comm.transaction_id}`,
            entryDate: todayStr,
            reference: reference_no || '',
          }
        );

        tulisLedger(
          { transactionId: comm.transaction_id, commissionId: comm.id, batchId },
          {
            coaAccountId: coaKas.id,
            entryType: 'CREDIT',
            amount: payAmount,
            description: `Pengeluaran Kas Pembayaran Komisi Agen #${comm.agent_id}`,
            entryDate: todayStr,
            reference: reference_no || '',
          }
        );

        const newTotalPaid = alreadyPaid + payAmount;
        if (newTotalPaid >= comm.nominal) {
          db.prepare("UPDATE commissions SET status = 'PAID', paid_date = ? WHERE id = ?").run(todayStr, commission_id);
        }
      });

      simpanBayar();

      return NextResponse.json({ success: true, message: 'Pembayaran komisi berhasil dicatat dan dijurnal' });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
