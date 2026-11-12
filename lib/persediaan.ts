/**
 * HPP perlengkapan jamaah (persediaan).
 *
 * `inventory_items.unit_cost` sebelumnya hanya kolom mati: selalu 0 dan tidak
 * dibaca kode mana pun. Akibatnya nilai perlengkapan yang diserahkan ke jamaah
 * (seragam, koper, ihram, mukena, tas, buku) tidak pernah masuk laporan
 * keuangan — padahal itu biaya nyata yang mengurangi laba per paket.
 *
 * Di sini biaya dicatat saat barang DISERAHKAN (bukan saat dibeli), dengan
 * jurnal sederhana:
 *
 *     Dr  Beban Perlengkapan Jamaah      5-109
 *         Cr  Persediaan / Inventory     1-103
 *
 * Nilainya qty x unit_cost yang berlaku saat penyerahan. Baris `ledger`
 * ditautkan ke `inventory_handover` lewat kolom `handover_id` supaya bisa
 * ditelusuri dan ikut terhapus bila penyerahan dibatalkan.
 */
import type Database from 'better-sqlite3';

export const COA_PERSEDIAAN = '1-103';
export const COA_BEBAN_PERLENGKAPAN = '5-109';

function akunId(db: Database.Database, kode: string): number | null {
  const r = db.prepare('SELECT id FROM chart_of_accounts WHERE coa_code = ? LIMIT 1').get(kode) as
    | { id: number }
    | undefined;
  return r?.id ?? null;
}

/** Tanggal hari ini dalam format YYYY-MM-DD (waktu lokal server). */
function hariIni(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/**
 * Catat HPP untuk satu penyerahan barang.
 *
 * Mengembalikan nilai biaya yang dicatat (0 bila unit_cost belum diisi atau
 * akun belum tersedia). Tidak pernah melempar error: kegagalan akuntansi
 * dilaporkan lewat nilai balik agar penyerahan barang tetap tercatat.
 */
export function catatHppPenyerahan(
  db: Database.Database,
  handoverId: number,
  itemId: number,
  qty: number,
  keterangan: string,
  transactionId?: number | null,
): { nilai: number; alasan?: string } {
  const item = db.prepare('SELECT name, unit_cost FROM inventory_items WHERE id = ?').get(itemId) as
    | { name: string; unit_cost: number }
    | undefined;
  if (!item) return { nilai: 0, alasan: 'barang tidak ditemukan' };

  const biaya = Math.round(Number(item.unit_cost) || 0) * Math.max(1, Math.trunc(Number(qty) || 1));
  if (biaya <= 0) {
    return { nilai: 0, alasan: 'unit_cost barang masih 0 — isi harga satuan agar HPP tercatat' };
  }

  const akunPersediaan = akunId(db, COA_PERSEDIAAN);
  const akunBeban = akunId(db, COA_BEBAN_PERLENGKAPAN);
  if (!akunPersediaan || !akunBeban) {
    return { nilai: 0, alasan: `akun ${COA_PERSEDIAAN}/${COA_BEBAN_PERLENGKAPAN} belum ada di COA` };
  }

  const tgl = hariIni();
  const ref = handoverId ? `HANDOVER-${handoverId}` : null;
  const ket = `${keterangan} — ${item.name}`;

  const ins = db.prepare(`
    INSERT INTO ledger (entry_date, coa_account_id, entry_type, amount, description, reference,
                        transaction_id, expense_id, journal_id, payment_id, handover_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, NULL, NULL, NULL, ?)
  `);

  ins.run(tgl, akunBeban, 'DEBIT', biaya, ket, ref, transactionId ?? null, handoverId);
  ins.run(tgl, akunPersediaan, 'CREDIT', biaya, ket, ref, transactionId ?? null, handoverId);

  return { nilai: biaya };
}

/**
 * Batalkan HPP sebuah penyerahan (dipakai saat penyerahan dibatalkan).
 * Menghapus baris ledger yang tertaut ke handover tersebut.
 */
export function hapusHppPenyerahan(db: Database.Database, handoverId: number): number {
  const info = db.prepare('DELETE FROM ledger WHERE handover_id = ?').run(handoverId);
  return info.changes;
}
