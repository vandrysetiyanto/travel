import { NextResponse } from 'next/server';
import { galatServer } from '@/lib/galat';
import db, { initDB } from '@/lib/db';
import { generateBookingCode } from '@/lib/utils';

initDB();

/**
 * Pendaftaran online (tanpa login). Skema baru:
 *  - SEMUA jemaah ditulis ke `master_jamaah`, ditautkan lewat `group_code` = kode booking.
 *  - Satu booking tetap SATU baris `transactions` (jamaah_id = jemaah pertama,
 *    total_pilgrims = jumlah jemaah, total_amount = harga paket x jumlah jemaah).
 * Pendaftaran lama (tabel `registrations`/`pilgrims`) sudah tidak ada di skema ini.
 */
export async function POST(req: Request) {
  try {
    const data = await req.json();
    const { batch_id, applicant_name, applicant_phone, applicant_email, registration_type, pilgrims, notes } = data;

    if (!batch_id || !applicant_name || !applicant_phone || !Array.isArray(pilgrims) || pilgrims.length === 0) {
      return NextResponse.json({ success: false, message: 'Data pendaftaran belum lengkap.' }, { status: 400 });
    }

    for (let i = 0; i < pilgrims.length; i++) {
      const p = pilgrims[i] || {};
      if (!p.full_name || !p.nik) {
        return NextResponse.json(
          { success: false, message: `Nama Lengkap dan NIK jemaah #${i + 1} wajib diisi.` },
          { status: 400 }
        );
      }
      if (String(p.nik).replace(/\D/g, '').length !== 16) {
        return NextResponse.json(
          { success: false, message: `NIK jemaah #${i + 1} harus 16 digit angka.` },
          { status: 400 }
        );
      }
    }

    const batch = db
      .prepare(
        `SELECT b.*, p.price, p.name as package_name FROM batches b JOIN packages p ON b.package_id = p.id WHERE b.id = ?`
      )
      .get(batch_id) as any;

    if (!batch) {
      return NextResponse.json({ success: false, message: 'Batch keberangkatan tidak ditemukan.' }, { status: 404 });
    }
    if (batch.status && batch.status !== 'OPEN') {
      return NextResponse.json({ success: false, message: 'Batch ini sudah tidak dibuka untuk pendaftaran.' }, { status: 400 });
    }

    const totalPilgrims = pilgrims.length;

    /*
     * Cek bentrok jadwal SEBELUM menulis apa pun.
     * Aturan bisnis: satu jamaah boleh umroh berkali-kali, tetapi tidak boleh
     * beririsan waktunya — ia harus menyelesaikan perjalanan sebelumnya dulu.
     * Identitas jamaah dipetakan lewat NIK, lalu dicocokkan ke booking_jamaah.
     */
    const nikDaftar = pilgrims.map((p: any) => String(p.nik).replace(/\D/g, ''));
    const jamaahLama = db
      .prepare(`SELECT id, nik FROM master_jamaah WHERE nik IN (${nikDaftar.map(() => '?').join(',')})`)
      .all(...nikDaftar) as { id: number; nik: string }[];
    if (jamaahLama.length) {
      const { cekBentrokJadwal, pesanBentrok } = await import('@/lib/booking-jamaah');
      const bentrok = cekBentrokJadwal(db, jamaahLama.map((j) => j.id), {
        departure_date: batch.departure_date,
        return_date: batch.return_date,
        id: batch.id,
      });
      if (bentrok.length) {
        return NextResponse.json(
          {
            success: false,
            code: 'JADWAL_BENTROK',
            message: pesanBentrok(bentrok),
            bentrok,
          },
          { status: 409 },
        );
      }
    }

    // Cek sisa kuota batch
    if (batch.quota && batch.quota > 0) {
      const filled = db
        .prepare(`SELECT COALESCE(SUM(total_pilgrims),0) as c FROM transactions WHERE batch_id = ? AND status != 'CANCELLED'`)
        .get(batch_id) as any;
      if (Number(filled.c) + totalPilgrims > batch.quota) {
        return NextResponse.json(
          { success: false, message: `Kuota batch tersisa ${Math.max(0, batch.quota - Number(filled.c))} orang.` },
          { status: 400 }
        );
      }
    }

    const bookingCode = generateBookingCode();
    const totalAmount = Number(batch.price) * totalPilgrims;

    const run = db.transaction(() => {
      const ids: number[] = [];
      for (const p of pilgrims) {
        const nik = String(p.nik).replace(/\D/g, '');
        const existing = db.prepare('SELECT id FROM master_jamaah WHERE nik = ?').get(nik) as any;
        if (existing) {
          db.prepare(
            `UPDATE master_jamaah SET full_name = ?, no_kk = ?, gender = ?, birth_place = ?, birth_date = ?, phone = ?,
              address = ?, passport_number = ?, group_code = ? WHERE id = ?`
          ).run(
            p.full_name,
            p.no_kk || '',
            p.gender || 'L',
            p.birth_place || '',
            p.birth_date || '',
            p.phone || applicant_phone,
            p.address || '',
            p.passport_number || '',
            bookingCode,
            existing.id
          );
          ids.push(existing.id);
        } else {
          const ins = db
            .prepare(
              `INSERT INTO master_jamaah (nik, no_kk, full_name, gender, birth_place, birth_date, phone, email, address,
                passport_number, group_code) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
            )
            .run(
              nik,
              p.no_kk || '',
              p.full_name,
              p.gender || 'L',
              p.birth_place || '',
              p.birth_date || '',
              p.phone || applicant_phone,
              applicant_email || '',
              p.address || '',
              p.passport_number || '',
              bookingCode
            );
          ids.push(Number(ins.lastInsertRowid));
        }
      }

      const insTx = db
        .prepare(
          `INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount,
            status, notes, total_pilgrims) VALUES (?, ?, ?, ?, 0, ?, 'PENDING', ?, ?)`
        )
        .run(bookingCode, ids[0], batch_id, totalAmount, totalAmount, notes || '', totalPilgrims);

      const txIdBaru = Number(insTx.lastInsertRowid);

      /*
       * Tautkan SEMUA jamaah ke booking ini lewat id (bukan group_code).
       * group_code tetap diisi untuk kompatibilitas tampilan lama, tetapi
       * sumber kebenaran relasi sekarang tabel booking_jamaah.
       */
      const insBJ = db.prepare(
        `INSERT INTO booking_jamaah (transaction_id, jamaah_id, peran, urutan) VALUES (?, ?, ?, ?)
         ON CONFLICT(transaction_id, jamaah_id) DO UPDATE SET peran = excluded.peran, urutan = excluded.urutan`,
      );
      ids.forEach((jid, idx) => {
        insBJ.run(txIdBaru, jid, idx === 0 ? 'LEADER' : 'ANGGOTA', idx + 1);
      });

      return txIdBaru;
    });

    const txId = run();

    return NextResponse.json({
      success: true,
      booking_code: bookingCode,
      registration_id: txId,
      total_amount: totalAmount,
      total_pilgrims: totalPilgrims,
      message: 'Pendaftaran berhasil dibuat!',
    });
  } catch (error: any) {
    console.error('Registration Error:', error);
    return galatServer(error, { bagian: 'register' });
  }
}
