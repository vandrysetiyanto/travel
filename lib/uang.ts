/**
 * Validasi nominal uang — satu pintu untuk semua jalur.
 *
 * Sebelumnya setiap route memakai `Number(amount)` tanpa batas, sehingga
 * nominal NEGATIF diterima di beban operasional dan jurnal umum. Beban negatif
 * = pendapatan palsu: laba bisa digelembungkan dari UI, dan laporan keuangan
 * tidak lagi bisa dipertanggungjawabkan.
 *
 * Aturan di sini:
 *   - wajib angka berhingga (bukan NaN/Infinity/string sampah)
 *   - harus bilangan bulat rupiah (dibulatkan, bukan dipotong diam-diam)
 *   - harus >= 1 (nol dan negatif ditolak)
 *   - dibatasi nilai maksimum yang wajar untuk mencegah salah input / overflow
 */

export const NOMINAL_MAKS = 1_000_000_000_000; // Rp 1 triliun

export type HasilNominal =
  | { ok: true; nilai: number }
  | { ok: false; pesan: string };

/** Parse & validasi nominal uang. */
export function validasiNominal(
  masukan: unknown,
  label = 'Nominal',
  opsi: { min?: number; maks?: number } = {},
): HasilNominal {
  const min = opsi.min ?? 1;
  const maks = opsi.maks ?? NOMINAL_MAKS;

  if (masukan === null || masukan === undefined || masukan === '') {
    return { ok: false, pesan: `${label} wajib diisi.` };
  }

  // Tolak string yang bukan angka murni (mis. "1e5", "12abc", " ").
  const bersih = typeof masukan === 'string' ? masukan.trim().replace(/\./g, '').replace(/,/g, '.') : masukan;
  const n = typeof bersih === 'number' ? bersih : Number(bersih);

  if (!Number.isFinite(n)) {
    return { ok: false, pesan: `${label} harus berupa angka yang valid.` };
  }
  if (n < 0) {
    return { ok: false, pesan: `${label} tidak boleh negatif.` };
  }
  if (n < min) {
    return { ok: false, pesan: `${label} harus lebih besar dari ${min - 1}.` };
  }
  if (n > maks) {
    return { ok: false, pesan: `${label} melebihi batas wajar (maks Rp ${maks.toLocaleString('id-ID')}).` };
  }

  return { ok: true, nilai: Math.round(n) };
}

/** Validasi dua sisi jurnal umum: nominal sama besar & akun berbeda. */
export function validasiJurnal(
  debitCoa: unknown,
  creditCoa: unknown,
  nominal: unknown,
): { ok: true; nilai: number; debit: number; kredit: number } | { ok: false; pesan: string } {
  const debit = Number(debitCoa);
  const kredit = Number(creditCoa);

  if (!Number.isFinite(debit) || debit <= 0) return { ok: false, pesan: 'Akun DEBIT wajib dipilih.' };
  if (!Number.isFinite(kredit) || kredit <= 0) return { ok: false, pesan: 'Akun KREDIT wajib dipilih.' };
  if (debit === kredit) return { ok: false, pesan: 'Akun DEBIT dan KREDIT tidak boleh sama — jurnal akan tidak bermakna.' };

  const v = validasiNominal(nominal, 'Nominal jurnal');
  if (!v.ok) return v;

  return { ok: true, nilai: v.nilai, debit, kredit };
}
