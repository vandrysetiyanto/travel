/**
 * Modul Komisi Agen (Fix & Akumulasi bertingkat, Jurnal Akuntansi, Snapshot Repeat Policy).
 */
import Database from 'better-sqlite3';
import { tulisLedger } from './ledger.js';

export function hitungKomisi(db: Database.Database, agentId: number): { nominal: number; tierApplied: string; jamaahIndex: number } {
  const agen = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as any;
  if (!agen) throw new Error('Agen tidak ditemukan');

  if (agen.commission_mode === 'FIX') {
    return {
      nominal: Number(agen.fix_amount) || 0,
      tierApplied: 'FIX',
      jamaahIndex: 1,
    };
  }

  const countRes = db.prepare(`
    SELECT COUNT(*) as cnt
      FROM commissions
     WHERE agent_id = ?
       AND status IN ('ELIGIBLE', 'PAID')
  `).get(agentId) as any;

  const currentCount = Number(countRes?.cnt || 0);
  const jamaahIndex = currentCount + 1;

  const tier = db.prepare(`
    SELECT * FROM agent_tiers
     WHERE agent_id = ?
       AND min_count <= ?
       AND (max_count IS NULL OR max_count >= ?)
     ORDER BY min_count DESC
     LIMIT 1
  `).get(agentId, jamaahIndex, jamaahIndex) as any;

  if (tier) {
    return {
      nominal: Number(tier.amount) || 0,
      tierApplied: tier.max_count ? `${tier.min_count}-${tier.max_count} Jamaah` : `${tier.min_count}+ Jamaah`,
      jamaahIndex,
    };
  }

  return {
    nominal: Number(agen.fix_amount) || 0,
    tierApplied: 'DEFAULT',
    jamaahIndex,
  };
}

export function buatKomisiPending(db: Database.Database, transactionId: number, agentId: number, jamaahId: number) {
  const tx = db.prepare('SELECT status FROM transactions WHERE id = ?').get(transactionId) as any;
  if (!tx) return;

  const existing = db.prepare('SELECT id FROM commissions WHERE transaction_id = ?').get(transactionId);
  if (existing) return;

  const agen = db.prepare('SELECT * FROM agents WHERE id = ?').get(agentId) as any;
  if (!agen) return;

  const repeatCount = db.prepare(`
    SELECT COUNT(*) as cnt
      FROM commissions c
      JOIN transactions t ON c.transaction_id = t.id
     WHERE c.agent_id = ? AND t.jamaah_id = ?
  `).get(agentId, jamaahId) as any;

  const isRepeat = Number(repeatCount?.cnt || 0) > 0;
  const repeatPolicy = agen.repeat_policy || 'ALWAYS';

  let nominal = 0;
  let tierApplied = 'PENDING';
  let jamaahIndex = 0;

  if (!isRepeat || repeatPolicy === 'ALWAYS') {
    const calc = hitungKomisi(db, agentId);
    nominal = calc.nominal;
    tierApplied = calc.tierApplied;
    jamaahIndex = calc.jamaahIndex;
  } else {
    tierApplied = 'REPEAT_SKIPPED';
  }

  db.prepare(`
    INSERT INTO commissions (
      transaction_id, agent_id, jamaah_id, calculation_type,
      jamaah_index, tier_applied, nominal, status, repeat_policy
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 'PENDING', ?)
  `).run(
    transactionId, agentId, jamaahId, agen.commission_mode || 'FIX',
    jamaahIndex, tierApplied, isRepeat && repeatPolicy === 'FIRST_ONLY' ? 0 : nominal,
    repeatPolicy
  );
}

export function prosesKomisiLunas(db: Database.Database, transactionId: number) {
  const comm = db.prepare('SELECT * FROM commissions WHERE transaction_id = ? AND status = \'PENDING\'').get(transactionId) as any;
  if (!comm) return;

  if (comm.tier_applied === 'REPEAT_SKIPPED' || comm.nominal <= 0) {
    db.prepare('UPDATE commissions SET status = \'CANCELLED\', notes = \'Repeat order skipped by policy\' WHERE id = ?').run(comm.id);
    return;
  }

  const agen = db.prepare('SELECT * FROM agents WHERE id = ?').get(comm.agent_id) as any;
  let finalNominal = comm.nominal;
  let finalTier = comm.tier_applied;
  let finalIndex = comm.jamaah_index;

  if (agen.commission_mode === 'AKUMULASI') {
    const calc = hitungKomisi(db, comm.agent_id);
    finalNominal = calc.nominal;
    finalTier = calc.tierApplied;
    finalIndex = calc.jamaahIndex;
  }

  const tx = db.prepare('SELECT batch_id FROM transactions WHERE id = ?').get(transactionId) as any;
  const batchId = tx?.batch_id || null;

  const batch = batchId ? db.prepare('SELECT departure_date FROM batches WHERE id = ?').get(batchId) as any : null;
  const eligibleDate = batch?.departure_date || new Date().toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  const coaBeban = db.prepare('SELECT id FROM chart_of_accounts WHERE coa_code = \'5-110\'').get() as any;
  const coaUtang = db.prepare('SELECT id FROM chart_of_accounts WHERE coa_code = \'2-102\'').get() as any;

  if (!coaBeban || !coaUtang) {
    throw new Error('Akun COA Beban Komisi (5-110) atau Utang Komisi (2-102) belum tersedia');
  }

  const simpanEligible = db.transaction(() => {
    const ledgerId = tulisLedger(
      { transactionId, commissionId: comm.id, batchId },
      {
        coaAccountId: coaBeban.id,
        entryType: 'DEBIT',
        amount: finalNominal,
        description: `Beban Komisi Agen untuk Booking #${transactionId} (${finalTier})`,
        entryDate: todayStr,
      }
    );

    tulisLedger(
      { transactionId, commissionId: comm.id, batchId },
      {
        coaAccountId: coaUtang.id,
        entryType: 'CREDIT',
        amount: finalNominal,
        description: `Utang Komisi Agen untuk Booking #${transactionId} (${finalTier})`,
        entryDate: todayStr,
      }
    );

    db.prepare(`
      UPDATE commissions
         SET status = 'ELIGIBLE',
             nominal = ?,
             tier_applied = ?,
             jamaah_index = ?,
             eligible_date = ?,
             ledger_id = ?
       WHERE id = ?
    `).run(finalNominal, finalTier, finalIndex, eligibleDate, ledgerId, comm.id);
  });

  simpanEligible();
}
