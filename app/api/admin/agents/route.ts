import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const agents = db.prepare(`
      SELECT a.*,
             (SELECT COUNT(*) FROM commissions c WHERE c.agent_id = a.id) as total_referrals,
             (SELECT COALESCE(SUM(nominal), 0) FROM commissions c WHERE c.agent_id = a.id AND c.status = 'PAID') as total_paid_commission,
             (SELECT COALESCE(SUM(nominal), 0) FROM commissions c WHERE c.agent_id = a.id AND c.status = 'ELIGIBLE') as total_eligible_commission
        FROM agents a
       ORDER BY a.name ASC
    `).all();

    const result = agents.map((ag: any) => {
      const tiers = db.prepare('SELECT * FROM agent_tiers WHERE agent_id = ? ORDER BY min_count ASC').all(ag.id);
      return { ...ag, tiers };
    });

    return NextResponse.json({ success: true, agents: result });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action, id, code, name, type, phone, email, bank_name, bank_account_no, bank_holder_name, commission_mode, fix_amount, repeat_policy, tiers, notes } = body;

    if (action === 'CREATE_AGENT') {
      if (!code || !name) return NextResponse.json({ success: false, message: 'Kode dan Nama agen wajib diisi' }, { status: 400 });

      const ins = db.prepare(`
        INSERT INTO agents (code, name, type, phone, email, bank_name, bank_account_no, bank_holder_name, commission_mode, fix_amount, repeat_policy, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        code.trim().toUpperCase(), name.trim(), type || 'PERORANGAN',
        phone || '', email || '', bank_name || '', bank_account_no || '', bank_holder_name || '',
        commission_mode || 'FIX', Number(fix_amount) || 0, repeat_policy || 'ALWAYS', notes || ''
      );

      const agentId = Number(ins.lastInsertRowid);

      if (commission_mode === 'AKUMULASI' && Array.isArray(tiers)) {
        const insTier = db.prepare('INSERT INTO agent_tiers (agent_id, min_count, max_count, amount) VALUES (?, ?, ?, ?)');
        for (const t of tiers) {
          insTier.run(agentId, Number(t.min_count) || 1, t.max_count ? Number(t.max_count) : null, Number(t.amount) || 0);
        }
      }

      return NextResponse.json({ success: true, message: 'Agen berhasil didaftarkan', agentId });
    }

    if (action === 'UPDATE_AGENT') {
      if (!id) return NextResponse.json({ success: false, message: 'ID agen diperlukan' }, { status: 400 });

      db.prepare(`
        UPDATE agents
           SET name = COALESCE(?, name),
               type = COALESCE(?, type),
               phone = COALESCE(?, phone),
               email = COALESCE(?, email),
               bank_name = COALESCE(?, bank_name),
               bank_account_no = COALESCE(?, bank_account_no),
               bank_holder_name = COALESCE(?, bank_holder_name),
               commission_mode = COALESCE(?, commission_mode),
               fix_amount = COALESCE(?, fix_amount),
               repeat_policy = COALESCE(?, repeat_policy),
               notes = COALESCE(?, notes)
         WHERE id = ?
      `).run(
        name, type, phone, email, bank_name, bank_account_no, bank_holder_name,
        commission_mode, fix_amount !== undefined ? Number(fix_amount) : null,
        repeat_policy, notes, id
      );

      if (commission_mode === 'AKUMULASI' && Array.isArray(tiers)) {
        db.prepare('DELETE FROM agent_tiers WHERE agent_id = ?').run(id);
        const insTier = db.prepare('INSERT INTO agent_tiers (agent_id, min_count, max_count, amount) VALUES (?, ?, ?, ?)');
        for (const t of tiers) {
          insTier.run(id, Number(t.min_count) || 1, t.max_count ? Number(t.max_count) : null, Number(t.amount) || 0);
        }
      }

      return NextResponse.json({ success: true, message: 'Data agen diperbarui' });
    }

    if (action === 'DELETE_AGENT') {
      if (!id) return NextResponse.json({ success: false, message: 'ID agen diperlukan' }, { status: 400 });
      db.prepare('DELETE FROM agents WHERE id = ?').run(id);
      return NextResponse.json({ success: true, message: 'Agen dihapus' });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak dikenal' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
