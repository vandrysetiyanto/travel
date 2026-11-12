/**
 * Laporan keuangan dari BUKU BESAR (ledger) — satu sumber kebenaran.
 *
 * Sebelumnya `app/api/admin/financial/route.ts` menghitung laba rugi hanya dari
 * tabel `expenses`, dan neraca memakai angka hardcode:
 *   persediaan_gudang = 5_000_000  (padahal nilai riil persediaan 94.550.000)
 *   modal_disetor     = 50_000_000 (angka tetap, bukan dari pembukuan)
 *
 * Akibatnya HPP persediaan, pendapatan, dan kas sebenarnya tidak pernah muncul
 * di laporan. Modul ini mengambil semuanya dari `ledger`, sehingga apa pun yang
 * dijurnal (pembayaran, beban, jurnal umum, HPP perlengkapan) otomatis tercermin.
 *
 * Konvensi tanda (normal balance):
 *   Aset, Beban            -> saldo normal DEBIT   (debit - kredit)
 *   Liabilitas, Ekuitas,
 *   Pendapatan             -> saldo normal KREDIT  (kredit - debit)
 */

import type Database from 'better-sqlite3';

export type Rentang = { dari?: string | null; sampai?: string | null };

export type SaldoAkun = {
  id: number;
  kode: string;
  nama: string;
  grup: string;
  tipe: string;
  debit: number;
  kredit: number;
  saldo: number;
};

/** Kelompok akun yang saldo normalnya di sisi kredit. */
const NORMAL_KREDIT = new Set(['Liabilitas', 'Ekuitas', 'Pendapatan']);

function klausaTanggal(alias: string, r: Rentang): { sql: string; params: any[] } {
  const bagian: string[] = [];
  const params: any[] = [];
  if (r.dari) { bagian.push(`DATE(${alias}.entry_date) >= DATE(?)`); params.push(r.dari); }
  if (r.sampai) { bagian.push(`DATE(${alias}.entry_date) <= DATE(?)`); params.push(r.sampai); }
  return { sql: bagian.length ? ' AND ' + bagian.join(' AND ') : '', params };
}

/**
 * Saldo seluruh akun pada rentang tertentu.
 *
 * Memakai LEFT JOIN dari chart_of_accounts supaya akun yang belum punya mutasi
 * tetap muncul dengan saldo 0 — bukan hilang dari laporan.
 */
export function saldoSemuaAkun(db: Database.Database, r: Rentang = {}): SaldoAkun[] {
  const { sql, params } = klausaTanggal('l', r);
  const baris = db
    .prepare(`
      SELECT a.id, a.coa_code AS kode, a.coa_name AS nama, a.coa_group AS grup, a.coa_type AS tipe,
             COALESCE(SUM(CASE WHEN l.entry_type = 'DEBIT'  THEN l.amount ELSE 0 END), 0) AS debit,
             COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END), 0) AS kredit
        FROM chart_of_accounts a
        LEFT JOIN ledger l ON l.coa_account_id = a.id${sql}
       WHERE a.is_active = 1
       GROUP BY a.id, a.coa_code, a.coa_name, a.coa_group, a.coa_type
       ORDER BY a.coa_code
    `)
    .all(...params) as any[];

  return baris.map((b) => {
    const kreditNormal = NORMAL_KREDIT.has(String(b.grup || ''));
    const saldo = kreditNormal ? Number(b.kredit) - Number(b.debit) : Number(b.debit) - Number(b.kredit);
    return {
      id: Number(b.id),
      kode: String(b.kode || ''),
      nama: String(b.nama || ''),
      grup: String(b.grup || ''),
      tipe: String(b.tipe || ''),
      debit: Number(b.debit) || 0,
      kredit: Number(b.kredit) || 0,
      saldo,
    };
  });
}

/** Ambil saldo satu akun berdasarkan kodenya (mis. '1-101'). */
function saldoKode(akun: SaldoAkun[], kode: string): number {
  return akun.filter((a) => a.kode === kode).reduce((t, a) => t + a.saldo, 0);
}

// ───────────────────────────── LABA RUGI ─────────────────────────────

export function labaRugi(db: Database.Database, r: Rentang = {}) {
  const akun = saldoSemuaAkun(db, r);

  const pendapatan = akun
    .filter((a) => a.grup === 'Pendapatan')
    .map((a) => ({ coa_code: a.kode, coa_name: a.nama, total: a.saldo }))
    .filter((x) => x.total !== 0);

  const beban = akun
    .filter((a) => a.grup === 'Beban')
    .map((a) => ({ coa_code: a.kode, coa_name: a.nama, total: a.saldo }))
    .filter((x) => x.total !== 0);

  const total_pendapatan = pendapatan.reduce((t, x) => t + x.total, 0);
  const total_beban = beban.reduce((t, x) => t + x.total, 0);

  return {
    total_pendapatan,
    total_beban,
    laba_bersih: total_pendapatan - total_beban,
    pendapatan,
    beban,
  };
}

// ───────────────────────────── NERACA ─────────────────────────────

export function neraca(db: Database.Database, r: Rentang = {}) {
  const akun = saldoSemuaAkun(db, r);

  const asetRinci = akun.filter((a) => a.grup === 'Aset' && a.saldo !== 0);
  const liabRinci = akun.filter((a) => a.grup === 'Liabilitas' && a.saldo !== 0);
  const ekuitasRinci = akun.filter((a) => a.grup === 'Ekuitas' && a.saldo !== 0);

  const total_aset = asetRinci.reduce((t, a) => t + a.saldo, 0);
  const total_liabilitas = liabRinci.reduce((t, a) => t + a.saldo, 0);
  const ekuitasBuku = ekuitasRinci.reduce((t, a) => t + a.saldo, 0);

  // Laba periode berjalan belum ditutup ke Laba Ditahan -> masuk ekuitas.
  const lr = labaRugi(db, r);
  const total_ekuitas = ekuitasBuku + lr.laba_bersih;

  return {
    aset: {
      // Nama field ini dipertahankan agar UI lama tetap jalan.
      kas_bank: saldoKode(akun, '1-101'),
      piutang_jamaah: saldoKode(akun, '1-102'),
      persediaan: saldoKode(akun, '1-103'),
      total_aset,
      rincian: asetRinci.map((a) => ({ coa_code: a.kode, coa_name: a.nama, saldo: a.saldo })),
    },
    liabilitas: {
      utang_vendor: saldoKode(akun, '2-101'),
      total_liabilitas,
      rincian: liabRinci.map((a) => ({ coa_code: a.kode, coa_name: a.nama, saldo: a.saldo })),
    },
    ekuitas: {
      modal_pemilik: saldoKode(akun, '3-101'),
      laba_ditahan: saldoKode(akun, '3-102') + lr.laba_bersih,
      laba_periode_berjalan: lr.laba_bersih,
      total_ekuitas,
      rincian: ekuitasRinci.map((a) => ({ coa_code: a.kode, coa_name: a.nama, saldo: a.saldo })),
    },
    // Neraca harus seimbang; selisih ditampilkan apa adanya, bukan disembunyikan.
    seimbang: Math.abs(total_aset - (total_liabilitas + total_ekuitas)) < 1,
    selisih: total_aset - (total_liabilitas + total_ekuitas),
  };
}

// ───────────────────────────── ARUS KAS ─────────────────────────────

/**
 * Arus kas memakai pendekatan langsung dari mutasi akun kas/bank.
 * Akun dianggap kas bila kodenya berawalan '1-101' atau tipenya 'Aset Lancar'
 * dengan nama mengandung kas/bank.
 */
export function arusKas(db: Database.Database, r: Rentang = {}) {
  const akunKas = saldoSemuaAkun(db, { sampai: null })
    .filter((a) => a.kode.startsWith('1-101') || /kas|bank/i.test(a.nama));

  const idKas = akunKas.map((a) => a.id);

  // Mutasi kas dalam periode
  const { sql, params } = klausaTanggal('l', r);
  let mutasi = { masuk: 0, keluar: 0 };
  if (idKas.length) {
    const tanda = idKas.map(() => '?').join(',');
    const row = db
      .prepare(`
        SELECT COALESCE(SUM(CASE WHEN l.entry_type = 'DEBIT'  THEN l.amount ELSE 0 END), 0) AS masuk,
               COALESCE(SUM(CASE WHEN l.entry_type = 'CREDIT' THEN l.amount ELSE 0 END), 0) AS keluar
          FROM ledger l
         WHERE l.coa_account_id IN (${tanda})${sql}
      `)
      .get(...idKas, ...params) as any;
    mutasi = { masuk: Number(row?.masuk) || 0, keluar: Number(row?.keluar) || 0 };
  }

  // Saldo kas sebelum periode = saldo sampai sehari sebelum `dari`
  let kasAwal: number;
  if (r.dari) {
    const sebelum = new Date(new Date(r.dari).getTime() - 86400000).toISOString().slice(0, 10);
    kasAwal = saldoSemuaAkun(db, { sampai: sebelum })
      .filter((a) => idKas.includes(a.id))
      .reduce((t, a) => t + a.saldo, 0);
  } else {
    kasAwal = 0;
  }

  const perubahan = mutasi.masuk - mutasi.keluar;

  return {
    kas_awal: kasAwal,
    kas_akhir: kasAwal + perubahan,
    perubahan_kas: perubahan,
    arus_operasi: perubahan,
    arus_investasi: 0,
    arus_pendanaan: 0,
    rincian_mutasi: { kas_masuk: mutasi.masuk, kas_keluar: mutasi.keluar },
  };
}
