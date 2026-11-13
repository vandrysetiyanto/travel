/**
 * Laporan laba-rugi PER KLOTER (cost center).
 *
 * Sebelumnya mustahil: `ledger`/`expenses`/`general_journals` tidak punya
 * `batch_id`, sehingga pendapatan dan beban tidak bisa diatribusikan ke
 * keberangkatan tertentu. Akibatnya margin per kloter hanya bisa ditebak.
 *
 * Sekarang setiap baris buku besar boleh membawa `batch_id`:
 *   - jurnal dari pembayaran jamaah  -> otomatis dari transaksinya
 *   - beban operasional              -> dipilih admin saat mencatat
 *   - jurnal umum                    -> dipilih admin
 *   - HPP perlengkapan               -> otomatis dari transaksinya
 *
 * Fungsi ini menghitung, per kloter: pendapatan (kredit akun grup Pendapatan),
 * beban (debit akun grup Beban), laba kotor, jumlah jamaah, dan margin.
 *
 * Baris TANPA kloter (batch_id NULL) dilaporkan terpisah sebagai
 * "belum teralokasi" — bukan disembunyikan, karena itu beban nyata yang
 * belum dibebankan ke keberangkatan mana pun.
 */
import type Database from 'better-sqlite3';

export type LabaRugiKloter = {
  batch_id: number | null;
  batch_name: string;
  package_name: string | null;
  departure_date: string | null;
  return_date: string | null;
  status_batch: string | null;
  jumlah_jamaah: number;
  pendapatan: number;
  beban: number;
  laba_kotor: number;
  margin_persen: number;
};

type BarisAkun = { batch_id: number | null; grup: string; debit: number; kredit: number };

export function labaRugiPerKloter(db: Database.Database): {
  per_kloter: LabaRugiKloter[];
  belum_teralokasi: { pendapatan: number; beban: number; laba_kotor: number };
  total: { pendapatan: number; beban: number; laba_kotor: number };
} {
  /*
   * Satu query: agregasi mutasi per (batch_id, grup akun).
   * COALESCE dipakai supaya kloter tanpa mutasi tetap muncul lewat LEFT JOIN.
   */
  const baris = db
    .prepare(`
      SELECT l.batch_id AS batch_id,
             a.coa_group AS grup,
             COALESCE(SUM(CASE WHEN l.entry_type = 'DEBIT'  THEN l.amount ELSE 0 END), 0) AS debit,
             COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END), 0) AS kredit
        FROM ledger l
        JOIN chart_of_accounts a ON a.id = l.coa_account_id
       WHERE a.coa_group IN ('Pendapatan', 'Beban')
       GROUP BY l.batch_id, a.coa_group
    `)
    .all() as BarisAkun[];

  // Ringkas per kloter
  const peta = new Map<number | null, { pendapatan: number; beban: number }>();
  for (const b of baris) {
    const kunci = b.batch_id ?? null;
    const cur = peta.get(kunci) || { pendapatan: 0, beban: 0 };
    if (b.grup === 'Pendapatan') cur.pendapatan += Number(b.kredit) - Number(b.debit);
    if (b.grup === 'Beban') cur.beban += Number(b.debit) - Number(b.kredit);
    peta.set(kunci, cur);
  }

  // Informasi kloter + jumlah jamaah
  const kloter = db
    .prepare(`
      SELECT b.id, b.batch_name, b.departure_date, b.return_date, b.status,
             p.name AS package_name,
             (SELECT COALESCE(SUM(t.total_pilgrims), 0)
                FROM transactions t
               WHERE t.batch_id = b.id AND t.status <> 'CANCELLED') AS jumlah_jamaah
        FROM batches b
        LEFT JOIN packages p ON p.id = b.package_id
       ORDER BY b.departure_date DESC
    `)
    .all() as any[];

  const per_kloter: LabaRugiKloter[] = kloter.map((k) => {
    const n = peta.get(Number(k.id)) || { pendapatan: 0, beban: 0 };
    const laba = n.pendapatan - n.beban;
    return {
      batch_id: Number(k.id),
      batch_name: k.batch_name,
      package_name: k.package_name,
      departure_date: k.departure_date,
      return_date: k.return_date,
      status_batch: k.status,
      jumlah_jamaah: Number(k.jumlah_jamaah) || 0,
      pendapatan: n.pendapatan,
      beban: n.beban,
      laba_kotor: laba,
      // Margin dihitung dari pendapatan; bila pendapatan 0 -> 0 (hindari bagi nol).
      margin_persen: n.pendapatan > 0 ? Math.round((laba / n.pendapatan) * 1000) / 10 : 0,
    };
  });

  const tampa = peta.get(null) || { pendapatan: 0, beban: 0 };
  const totalPendapatan = per_kloter.reduce((t, k) => t + k.pendapatan, 0) + tampa.pendapatan;
  const totalBeban = per_kloter.reduce((t, k) => t + k.beban, 0) + tampa.beban;

  return {
    per_kloter,
    belum_teralokasi: {
      pendapatan: tampa.pendapatan,
      beban: tampa.beban,
      laba_kotor: tampa.pendapatan - tampa.beban,
    },
    total: {
      pendapatan: totalPendapatan,
      beban: totalBeban,
      laba_kotor: totalPendapatan - totalBeban,
    },
  };
}
