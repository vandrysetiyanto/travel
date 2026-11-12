import { NextResponse } from 'next/server';
import db from '@/lib/db';

/**
 * Cek status booking untuk jamaah — endpoint PUBLIK (tanpa login).
 *
 * PRINSIP: publik hanya boleh tahu "booking ini ada dan statusnya apa",
 * BUKAN siapa orangnya.
 *
 * Sebelumnya endpoint ini mengembalikan seluruh baris `master_jamaah` — NIK,
 * nomor KK, alamat lengkap, email, HP, nomor paspor, status visa, bahkan daftar
 * seluruh anggota keluarga — hanya bermodal kode booking yang mudah ditebak
 * (mis. `TRX-MUXN0DRG`). Itu kebocoran data pribadi (UU PDP) yang bisa dipanen
 * massal: cukup mengulang kode, semua jamaah bisa didaftar.
 *
 * Sekarang:
 *   - NIK, KK, alamat, email, paspor, visa: TIDAK PERNAH dikirim
 *   - nama & nomor HP disamarkan, dibuka hanya bila pemanggil memverifikasi
 *     4 digit terakhir nomor HP yang dipakai saat mendaftar
 *   - daftar anggota jamaah tidak dikirim
 *   - nomor kwitansi disamarkan bila belum terverifikasi
 *
 * Parameter: ?code=<kode booking>&verify=<4 digit terakhir HP>
 */

/** Samarkan nama: "MIRA SETIAWAN" -> "M*** S*******" */
function samarkanNama(nama: string): string {
  return String(nama || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((k) => (k.length <= 1 ? k : k[0] + '*'.repeat(Math.min(k.length - 1, 8))))
    .join(' ');
}

/** Samarkan nomor HP: 0812349484619 -> 0812*****619 */
function samarkanHp(hp: string): string {
  const d = String(hp || '').replace(/\D/g, '');
  if (d.length < 7) return d ? '*'.repeat(d.length) : '';
  return d.slice(0, 4) + '*'.repeat(Math.max(0, d.length - 7)) + d.slice(-3);
}

/** Samarkan nomor kwitansi: KW-492794 -> KW-****94 */
function samarkanKwitansi(no: string): string {
  const s = String(no || '');
  if (s.length <= 4) return '****';
  return s.slice(0, 3) + '*'.repeat(Math.max(0, s.length - 5)) + s.slice(-2);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const code = String(searchParams.get('code') || '').trim();
    const verifikasi = String(searchParams.get('verify') || '').replace(/\D/g, '');

    if (!code) {
      return NextResponse.json({ success: false, message: 'Kode booking wajib diisi.' }, { status: 400 });
    }
    // Tolak bentuk aneh lebih awal (mencegah penyalahgunaan sebagai alat enumerasi bebas).
    if (code.length < 4 || code.length > 40 || !/^[A-Za-z0-9-]+$/.test(code)) {
      return NextResponse.json({ success: false, message: 'Format kode booking tidak valid.' }, { status: 400 });
    }

    const tx = db
      .prepare(
        `SELECT t.id, t.booking_code, t.total_amount, t.paid_amount, t.remaining_amount, t.status,
                t.total_pilgrims, t.created_at,
                j.full_name, j.phone,
                b.batch_name, b.departure_date, b.return_date,
                p.name AS package_name, p.category, p.duration_days,
                p.airline, p.hotel_makkah, p.hotel_madinah, p.price AS unit_price
           FROM transactions t
           JOIN master_jamaah j ON t.jamaah_id = j.id
           JOIN batches b ON t.batch_id = b.id
           JOIN packages p ON b.package_id = p.id
          WHERE t.booking_code = ?`,
      )
      .get(code) as any;

    if (!tx) {
      return NextResponse.json({ success: false, message: 'Kode booking tidak ditemukan.' }, { status: 404 });
    }

    const hp = String(tx.phone || '').replace(/\D/g, '');
    const terverifikasi = verifikasi.length === 4 && hp.length >= 4 && hp.endsWith(verifikasi);

    const payments = db
      .prepare(
        `SELECT receipt_number, amount, status, payment_phase, created_at
           FROM payment_history WHERE transaction_id = ? ORDER BY created_at DESC`,
      )
      .all(tx.id) as any[];

    const totalTagihan = Number(tx.total_amount) || 0;
    const dibayar = payments
      .filter((p) => String(p.status).toUpperCase() === 'APPROVED')
      .reduce((t, p) => t + (Number(p.amount) || 0), 0);

    return NextResponse.json({
      success: true,
      terverifikasi,

      /*
       * Bentuk respons dipertahankan agar halaman /track yang sudah ada tetap
       * berjalan, tetapi isinya sudah dibersihkan: `name` & `phone` disamarkan
       * dan rincian identitas tidak disertakan sama sekali.
       */
      registration: {
        booking_code: tx.booking_code,
        created_at: tx.created_at,
        payment_status: tx.status,
        total_pilgrims: Number(tx.total_pilgrims) || 1,

        // Disamarkan kecuali sudah memverifikasi 4 digit terakhir HP.
        name: terverifikasi ? tx.full_name : samarkanNama(tx.full_name),
        applicant_name: terverifikasi ? tx.full_name : samarkanNama(tx.full_name),
        phone: terverifikasi ? hp : samarkanHp(hp),

        package_name: tx.package_name,
        category: tx.category,
        batch_name: tx.batch_name,
        departure_date: tx.departure_date,
        return_date: tx.return_date,
        duration_days: tx.duration_days,
        airline: tx.airline,
        hotel_makkah: tx.hotel_makkah,
        hotel_madinah: tx.hotel_madinah,

        total_amount: totalTagihan,
        paid_amount: dibayar,
        remaining_amount: Math.max(0, totalTagihan - dibayar),
      },

      payments: payments.map((p) => {
        const status = String(p.status || '').toUpperCase();
        return {
          // Nomor kwitansi hanya dibuka setelah verifikasi pemilik.
          payment_number: terverifikasi ? p.receipt_number : samarkanKwitansi(p.receipt_number),
          amount: Number(p.amount) || 0,
          status: status === 'REJECTED' ? 'REJECTED' : status === 'PENDING' || status === 'WAITING_APPROVAL' ? 'PENDING' : 'APPROVED',
          payment_phase: p.payment_phase,
          created_at: p.created_at,
        };
      }),

      // Daftar anggota (nama + NIK) sengaja TIDAK dikirim ke publik.
      catatan: terverifikasi
        ? null
        : 'Nama dan nomor HP disamarkan. Masukkan 4 digit terakhir nomor HP yang dipakai saat mendaftar untuk membuka rincian.',
    });
  } catch {
    // Jangan bocorkan detail internal (nama tabel/kolom) ke pemanggil publik.
    return NextResponse.json({ success: false, message: 'Terjadi kesalahan saat memuat data.' }, { status: 500 });
  }
}
