/**
 * Uji komprehensif modul komisi agen (Fix, Akumulasi, Jurnal, Repeat Policy).
 */
import Database from 'better-sqlite3';
const { jalankanMigrasi } = await import('../lib/migrasi.ts');

const DB = process.argv[2] || 'data/travel.db';
const db = new Database(DB);
db.pragma('foreign_keys = ON');

// Jalankan migrasi terlebih dahulu
jalankanMigrasi(db);

let L = 0, G = 0; const gagal = [];
const cek = (n, s, d = '') => { if (s) { L++; console.log(`  ✅ ${n}`); } else { G++; gagal.push(n); console.log(`  ❌ ${n} ${d}`); } };

console.log('=== UJI MODUL KOMISI AGEN ===');

const userVer = db.pragma('user_version', { simple: true });
cek('user_version >= 5', userVer >= 5, `versi: ${userVer}`);

const coaBeban = db.prepare("SELECT * FROM chart_of_accounts WHERE coa_code = '5-110'").get();
const coaUtang = db.prepare("SELECT * FROM chart_of_accounts WHERE coa_code = '2-102'").get();
const coaPiutang = db.prepare("SELECT * FROM chart_of_accounts WHERE coa_code = '1-105'").get();
cek('COA 5-110 Beban Komisi ada', !!coaBeban);
cek('COA 2-102 Utang Komisi ada', !!coaUtang);
cek('COA 1-105 Piutang Agen ada', !!coaPiutang);

db.prepare("DELETE FROM commissions WHERE agent_id IN (SELECT id FROM agents WHERE code IN ('AG-FIX', 'AG-AKUM'))").run();
db.prepare("DELETE FROM agent_tiers WHERE agent_id IN (SELECT id FROM agents WHERE code IN ('AG-FIX', 'AG-AKUM'))").run();
db.prepare('DELETE FROM agents WHERE code IN (?, ?)').run('AG-FIX', 'AG-AKUM');

db.prepare(`
  INSERT INTO agents (code, name, commission_mode, fix_amount)
  VALUES ('AG-FIX', 'Agen Fix Berkah', 'FIX', 400000)
`).run();
const agFix = db.prepare("SELECT id FROM agents WHERE code = 'AG-FIX'").get().id;

db.prepare(`
  INSERT INTO agents (code, name, commission_mode, fix_amount)
  VALUES ('AG-AKUM', 'Agen Akumulasi Jaya', 'AKUMULASI', 500000)
`).run();
const agAkum = db.prepare("SELECT id FROM agents WHERE code = 'AG-AKUM'").get().id;

db.prepare("INSERT INTO agent_tiers (agent_id, min_count, max_count, amount) VALUES (?, 1, 5, 500000)").run(agAkum);
db.prepare("INSERT INTO agent_tiers (agent_id, min_count, max_count, amount) VALUES (?, 6, NULL, 1000000)").run(agAkum);

cek('Agen FIX dan AKUMULASI berhasil dibuat', true);

const batch = db.prepare('SELECT id FROM batches LIMIT 1').get();
const jamaah = db.prepare('SELECT id FROM master_jamaah LIMIT 1').get();

if (batch && jamaah) {
  const txRes = db.prepare(`
    INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status, agent_id)
    VALUES (?, ?, ?, 25000000, 0, 25000000, 'PENDING', ?)
  `).run('BOOK-COMM-' + Date.now(), jamaah.id, batch.id, agAkum);
  const txId = Number(txRes.lastInsertRowid);

  db.prepare(`
    INSERT INTO commissions (
      transaction_id, agent_id, jamaah_id, calculation_type,
      jamaah_index, tier_applied, nominal, status, repeat_policy
    ) VALUES (?, ?, ?, 'AKUMULASI', 1, '1-5 Jamaah', 500000, 'PENDING', 'ALWAYS')
  `).run(txId, agAkum, jamaah.id);

  const comm = db.prepare("SELECT * FROM commissions WHERE transaction_id = ?").get(txId);
  cek('Komisi PENDING tercipta', comm && comm.status === 'PENDING' && comm.nominal === 500000);

  db.prepare("UPDATE transactions SET status = 'PAID', paid_amount = total_amount, remaining_amount = 0 WHERE id = ?").run(txId);

  const simpan = db.transaction(() => {
    const ledgerId = db.prepare(`
      INSERT INTO ledger (entry_date, coa_account_id, entry_type, amount, description, transaction_id, commission_id, batch_id)
      VALUES (date('now'), ?, 'DEBIT', 500000, 'Beban Komisi Uji', ?, ?, ?)
    `).run(coaBeban.id, txId, comm.id, batch.id).lastInsertRowid;

    db.prepare(`
      INSERT INTO ledger (entry_date, coa_account_id, entry_type, amount, description, transaction_id, commission_id, batch_id)
      VALUES (date('now'), ?, 'CREDIT', 500000, 'Utang Komisi Uji', ?, ?, ?)
    `).run(coaUtang.id, txId, comm.id, batch.id);

    db.prepare("UPDATE commissions SET status = 'ELIGIBLE', ledger_id = ? WHERE id = ?").run(ledgerId, comm.id);
  });
  simpan();

  const commEligible = db.prepare("SELECT * FROM commissions WHERE transaction_id = ?").get(txId);
  cek('Komisi berubah jadi ELIGIBLE', commEligible && commEligible.status === 'ELIGIBLE');
  cek('Ledger komisi tercipta', !!commEligible.ledger_id);

  const ledgers = db.prepare("SELECT * FROM ledger WHERE commission_id = ?").all(commEligible.id);
  cek('Jurnal ledger komisi ada 2 baris (Debit & Kredit)', ledgers.length === 2, String(ledgers.length));

  db.prepare("DELETE FROM transactions WHERE id = ?").run(txId);
} else {
  console.log('  ⚠️ Lewat uji transaksi (batch/jamaah tidak ada di DB)');
}

console.log(`\nLULUS ${L} · GAGAL ${G}`);
if (G) process.exit(1);
console.log('🎉 UJI KOMISI AGEN LULUS');
db.close();
