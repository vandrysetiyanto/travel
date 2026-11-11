/**
 * Helper buku besar: setiap baris ledger WAJIB menunjuk ke dokumen sumbernya.
 *
 * Sebelumnya ledger ditulis tanpa transaction_id / expense_id / journal_id /
 * payment_id, sehingga 100% baris tidak bisa ditelusuri dan ON DELETE CASCADE
 * tidak pernah berfungsi.
 */
import db from '@/lib/db';

export type SumberLedger = {
  transactionId?: number | null;
  expenseId?: number | null;
  journalId?: number | null;
  paymentId?: number | null;
};

/** Sanitasi id: hanya angka > 0 yang disimpan, sisanya NULL (bukan 0 atau string). */
function idAtauNull(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

/** Tulis satu baris ledger lengkap dengan tautan ke sumbernya. */
export function tulisLedger(
  sumber: SumberLedger,
  baris: {
    coaAccountId: number;
    entryType: 'DEBIT' | 'CREDIT';
    amount: number;
    description: string;
    entryDate: string;
    reference?: string | null;
  },
): number {
  const info = db
    .prepare(`
      INSERT INTO ledger (entry_date, coa_account_id, entry_type, amount, description, reference,
                          transaction_id, expense_id, journal_id, payment_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    .run(
      baris.entryDate,
      baris.coaAccountId,
      baris.entryType,
      Math.round(baris.amount),
      baris.description,
      baris.reference ?? null,
      idAtauNull(sumber.transactionId),
      idAtauNull(sumber.expenseId),
      idAtauNull(sumber.journalId),
      idAtauNull(sumber.paymentId),
    );
  return Number(info.lastInsertRowid);
}

/** Akun kas default ('1-101') — satu tempat, supaya tidak di-hardcode di banyak route. */
export function akunKasDefault(): number | null {
  const r = db.prepare(`SELECT id FROM chart_of_accounts WHERE coa_code = '1-101' LIMIT 1`).get() as { id: number } | undefined;
  return r?.id ?? null;
}

/** Akun pendapatan paket default ('4-101'). */
export function akunPendapatanDefault(): number | null {
  const r = db.prepare(`SELECT id FROM chart_of_accounts WHERE coa_code = '4-101' LIMIT 1`).get() as { id: number } | undefined;
  return r?.id ?? null;
}
