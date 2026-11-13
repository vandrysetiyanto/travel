/**
 * Standar respons error API.
 *
 * MASALAH YANG DIPERBAIKI:
 * 30 endpoint mengembalikan `message: error.message` apa adanya. Hari ini belum
 * membocorkan SQL, tetapi polanya berbahaya: satu perubahan tipe data atau
 * kolom baru bisa membuat pengguna melihat teks seperti
 *   "SqliteError: no such column: x" — membocorkan struktur database dan
 * membingungkan jamaah yang tidak paham istilah teknis.
 *
 * ATURAN:
 *   - pengguna menerima pesan yang aman & bisa ditindaklanjuti
 *   - detail teknis masuk ke LOG server (PM2) beserta kode referensi
 *   - kode referensi (kode) ditampilkan ke pengguna agar laporan bisa dicocokkan
 *     dengan log, tanpa membuka isi error
 */

import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

export type KonteksError = {
  /** Nama modul/aksi untuk log, mis. 'transactions:ADD_PAYMENT' */
  bagian: string;
  /** Pesan ramah pengguna; default generik */
  pesan?: string;
  /** Status HTTP; default 500 */
  status?: number;
  /** Data tambahan untuk log (JANGAN isi dengan rahasia) */
  info?: Record<string, unknown>;
};

export function galatServer(error: unknown, konteks: KonteksError) {
  const kode = randomUUID().slice(0, 8);
  const pesanAsli = error instanceof Error ? error.message : String(error);

  // Detail hanya ke log server, tidak ke pengguna.
  console.error(
    `[api-error ${kode}] ${konteks.bagian}: ${pesanAsli}`,
    konteks.info ? JSON.stringify(konteks.info) : '',
  );

  return NextResponse.json(
    {
      success: false,
      message: konteks.pesan || 'Terjadi kesalahan pada server. Silakan coba lagi.',
      kode,
    },
    { status: konteks.status || 500 },
  );
}

/**
 * Pesan galat yang aman untuk kesalahan yang memang disebabkan pengguna
 * (mis. input tidak valid). Tetap tanpa detail internal.
 */
export function galatPengguna(pesan: string, status = 400, kode?: string) {
  return NextResponse.json({ success: false, message: pesan, ...(kode ? { kode } : {}) }, { status });
}
