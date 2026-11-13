import { NextResponse } from 'next/server';
import { galatServer } from '@/lib/galat';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { requirePermission, catatAudit } from '@/lib/permissions';
import { tulisLedger, akunKasDefault, akunPendapatanDefault } from '@/lib/ledger';
import { hapusHppPenyerahan } from '@/lib/persediaan';
import { tanggalWib } from '@/lib/waktu';
import { cekBentrokJadwal, pesanBentrok, tautkanJamaah } from '@/lib/booking-jamaah';
import { statusSah, bolehTransisi, LABEL_STATUS } from '@/lib/status-booking';

initDB();

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'booking.read');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const batch_id = searchParams.get('batch_id');
    const id = searchParams.get('id');

    if (id) {
      const tx = db.prepare(`
        SELECT t.*, j.nik, j.full_name, j.phone, j.passport_number, j.visa_status, j.passport_status,
               b.batch_name, b.departure_date, p.name as package_name, p.price as package_price
        FROM transactions t
        JOIN master_jamaah j ON t.jamaah_id = j.id
        JOIN batches b ON t.batch_id = b.id
        JOIN packages p ON b.package_id = p.id
        WHERE t.id = ?
      `).get(id) as any;

      if (tx) {
        const payments = db.prepare('SELECT * FROM payment_history WHERE transaction_id = ? ORDER BY created_at ASC').all(id);
        const handovers = db.prepare(`
          SELECT h.*, i.name as item_name, i.code as item_code, i.unit 
          FROM inventory_handover h 
          JOIN inventory_items i ON h.item_id = i.id 
          WHERE h.transaction_id = ?
        `).all(id);
        return NextResponse.json({ success: true, transaction: { ...tx, payments, handovers } });
      }
      return NextResponse.json({ success: false, message: 'Transaksi tidak ditemukan' }, { status: 404 });
    }

    let query = `
      SELECT t.*, j.nik, j.full_name, j.phone, j.passport_number,
             b.batch_name, b.departure_date, p.name as package_name
      FROM transactions t
      JOIN master_jamaah j ON t.jamaah_id = j.id
      JOIN batches b ON t.batch_id = b.id
      JOIN packages p ON b.package_id = p.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (status && status !== 'ALL') {
      query += ' AND t.status = ?';
      params.push(status);
    }
    if (batch_id) {
      query += ' AND t.batch_id = ?';
      params.push(batch_id);
    }

    query += ' ORDER BY t.created_at DESC';
    const transactions = db.prepare(query).all(...params);

    return NextResponse.json({ success: true, transactions });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/transactions' });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    // Action 1: Create New Booking
    if (action === 'CREATE_BOOKING') {
      { const cek = await requirePermission(request, 'booking.create'); if (!cek.ok) return cek.response; }
      const { jamaah_id, batch_id, initial_payment, payment_type, notes } = body;

      const batch = db.prepare(`
        SELECT b.*, p.price FROM batches b JOIN packages p ON b.package_id = p.id WHERE b.id = ?
      `).get(batch_id) as any;

      if (!batch) {
        return NextResponse.json({ success: false, message: 'Batch tidak ditemukan' }, { status: 400 });
      }

      /*
       * Aturan bisnis pemilik: jamaah BOLEH umroh berulang, tetapi jadwalnya
       * TIDAK BOLEH BERIRISAN (harus selesai dulu baru boleh mendaftar lagi).
       *
       * Pemeriksaan ini hanya ada di /api/register (pendaftaran publik), sehingga
       * admin bisa mendaftarkan jamaah yang sedang berangkat lewat dashboard —
       * aturannya jadi tidak berlaku untuk jalur yang paling sering dipakai staf.
       */
      const bentrok = cekBentrokJadwal(db, [Number(jamaah_id)], {
        departure_date: batch.departure_date,
        return_date: batch.return_date,
        id: Number(batch_id),
      });
      if (bentrok.length) {
        return NextResponse.json({
          success: false,
          message: pesanBentrok(bentrok),
          bentrok,
        }, { status: 409 });
      }

      const totalAmount = batch.price;
      const initialPaid = Number(initial_payment) || 0;

      /*
       * Pembayaran awal juga divalidasi: negatif/melebihi tagihan tidak boleh
       * membuat paid_amount melewati total_amount.
       */
      if (initialPaid < 0) {
        return NextResponse.json({ success: false, message: 'Pembayaran awal tidak boleh negatif.' }, { status: 400 });
      }
      if (initialPaid > totalAmount) {
        return NextResponse.json({
          success: false,
          message: `Pembayaran awal (Rp ${initialPaid.toLocaleString('id-ID')}) melebihi harga paket (Rp ${Number(totalAmount).toLocaleString('id-ID')}).`,
        }, { status: 400 });
      }
      const remaining = Math.max(0, totalAmount - initialPaid);
      let status = 'PENDING';
      if (initialPaid >= totalAmount) {
        status = 'PAID';
      } else if (initialPaid > 0) {
        status = 'DP';
      }

      const bookingCode = 'TRX-' + Date.now().toString(36).toUpperCase();

      const insTx = db.prepare(`
        INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(bookingCode, jamaah_id, batch_id, totalAmount, initialPaid, remaining, status, notes || '');

      const txId = Number(insTx.lastInsertRowid);

      /*
       * WAJIB: tautkan booking ke jamaah lewat tabel relasi `booking_jamaah`.
       *
       * Sebelumnya CREATE_BOOKING hanya menulis `transactions.jamaah_id` tanpa
       * membuat baris di `booking_jamaah`. Akibatnya:
       *   - `cekBentrokJadwal()` (yang membaca `booking_jamaah`) tidak pernah
       *     menemukan bentrok -> aturan "tidak boleh beririsan" tidak berlaku
       *     untuk booking yang dibuat admin
       *   - laporan per paket & manifest kehilangan relasi ber-id
       * Dilekatkan dalam transaksi DB yang sama dengan pembuatan booking.
       */
      tautkanJamaah(db, txId, Number(jamaah_id), 'LEADER', 1);

      if (initialPaid > 0) {
        const receiptNo = 'KW-' + Math.floor(100000 + Math.random() * 900000);
        db.prepare(`
          INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(txId, receiptNo, initialPaid, payment_type || 'CASH', initialPaid >= totalAmount ? 'PELUNASAN' : 'DP', 'Pembayaran Awal');
      }

      catatAudit({
        user: auth.user, action: 'CREATE', module: 'transaction', recordId: txId,
        after: { booking_code: bookingCode, jamaah_id, batch_id, total_amount: totalAmount, paid_amount: initialPaid, status },
      });

      return NextResponse.json({ success: true, message: 'Booking pendaftaran berhasil dibuat', booking_code: bookingCode, transaction_id: txId });
    }

    // Action 2: Add Installment Payment / Pelunasan
    if (action === 'ADD_PAYMENT') {
      { const cek = await requirePermission(request, 'booking.update'); if (!cek.ok) return cek.response; }
      const { transaction_id, amount, payment_type, bank_name, notes } = body;
      const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transaction_id) as any;
      if (!tx) {
        return NextResponse.json({ success: false, message: 'Transaksi tidak ditemukan' }, { status: 404 });
      }

      /*
       * Booking yang sudah DIBATALKAN tidak boleh menerima pembayaran baru.
       * Tanpa gerbang ini, kas bisa bertambah untuk booking yang jurnalnya sudah
       * dibalik — neraca tetap seimbang tetapi uangnya tidak punya dasar.
       */
      const statusTx = String(tx.status || '').toUpperCase();
      if (statusTx === 'CANCELLED') {
        return NextResponse.json({
          success: false,
          message: `Booking ${tx.booking_code} sudah dibatalkan. Pulihkan statusnya lebih dulu bila ingin menerima pembayaran.`,
        }, { status: 409 });
      }

      const payAmount = Number(amount);
      if (payAmount <= 0) {
        return NextResponse.json({ success: false, message: 'Nominal pembayaran harus lebih dari 0' }, { status: 400 });
      }

      /*
       * Tolak pembayaran yang melebihi sisa tagihan. Tanpa ini `paid_amount`
       * bisa melampaui `total_amount` dan kelebihannya hilang karena sisa
       * tagihan dipaksa 0 (Math.max). Uang masuk harus selalu punya tujuan jelas.
       */
      const sudahDibayar = Number(tx.paid_amount) || 0;
      const tagihan = Number(tx.total_amount) || 0;
      if (sudahDibayar + payAmount > tagihan) {
        const lebih = sudahDibayar + payAmount - tagihan;
        return NextResponse.json({
          success: false,
          message: `Nominal melebihi sisa tagihan sebesar Rp ${lebih.toLocaleString('id-ID')}. ` +
            `Tagihan Rp ${tagihan.toLocaleString('id-ID')}, sudah dibayar Rp ${sudahDibayar.toLocaleString('id-ID')}.`,
        }, { status: 400 });
      }

      const newPaid = tx.paid_amount + payAmount;
      const newRemaining = Math.max(0, tx.total_amount - newPaid);
      let newStatus = tx.status;
      if (newPaid >= tx.total_amount) {
        newStatus = 'PAID';
      } else if (newPaid > 0) {
        newStatus = 'DP';
      }

      const receiptNo = 'KW-' + Math.floor(100000 + Math.random() * 900000);
      const phase = newPaid >= tx.total_amount ? 'PELUNASAN' : 'CICILAN';

      /*
       * Semua tulisan dibungkus satu transaksi: saldo transaksi, riwayat
       * pembayaran, dan buku besar harus lahir/hilang bersama. Tanpa ini,
       * kegagalan di tengah jalan meninggalkan pembayaran tanpa jurnal.
       */
      const simpan = db.transaction(() => {
        db.prepare('UPDATE transactions SET paid_amount = ?, remaining_amount = ?, status = ? WHERE id = ?')
          .run(newPaid, newRemaining, newStatus, transaction_id);

        const infoPay = db.prepare(`
          INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, bank_name, notes, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'APPROVED', ?)
        `).run(transaction_id, receiptNo, payAmount, payment_type || 'TRANSFER', phase, bank_name || '', notes || '', auth.user?.email || 'Admin');
        const paymentId = Number(infoPay.lastInsertRowid);

        // Buku besar: kas bertambah (DEBIT), pendapatan diakui (CREDIT).
        // Keduanya WAJIB menunjuk id sumbernya agar bisa ditelusuri.
        const akunKas = akunKasDefault();
        const akunPendapatan = akunPendapatanDefault();
        if (!akunKas || !akunPendapatan) throw new Error('Akun kas/pendapatan default tidak ditemukan di COA');

        const ledgerId = tulisLedger(
          { transactionId: transaction_id, paymentId },
          {
            coaAccountId: akunKas,
            entryType: 'DEBIT',
            amount: payAmount,
            description: `Pembayaran jamaah - ${receiptNo}`,
            entryDate: tanggalWib(),
            reference: receiptNo,
          },
        );
        tulisLedger(
          { transactionId: transaction_id, paymentId },
          {
            coaAccountId: akunPendapatan,
            entryType: 'CREDIT',
            amount: payAmount,
            description: `Pendapatan paket - ${receiptNo}`,
            entryDate: tanggalWib(),
            reference: receiptNo,
          },
        );
        db.prepare('UPDATE payment_history SET ledger_id = ? WHERE id = ?').run(ledgerId, paymentId);

        return { paymentId, ledgerId };
      });

      simpan();

      catatAudit({
        user: auth.user, action: 'CREATE', module: 'payment', recordId: receiptNo,
        after: { transaction_id, amount: payAmount, receipt_number: receiptNo, status: 'APPROVED' },
      });

      return NextResponse.json({ success: true, message: 'Pembayaran berhasil dicatat', receipt_number: receiptNo });
    }


    /*
     * ── PEMBATALAN BOOKING ────────────────────────────────────────────────
     *
     * Sebelumnya aksi ini TIDAK ADA, padahal izin `booking.delete` sudah
     * berlabel "Batalkan booking" dan kode di 4 tempat memeriksa status
     * 'CANCELLED'. Akibatnya staf menghapus baris transaksi secara manual, dan
     * itu MERUSAK pembukuan: jurnal kas/pendapatan tetap ada sementara
     * transaksinya hilang -> neraca tidak seimbang, riwayat pembayaran lenyap.
     *
     * Pembatalan di sini TIDAK menghapus apa pun:
     *   1. status transaksi -> CANCELLED (riwayat utuh)
     *   2. pembayaran PENDING milik booking itu -> REJECTED
     *   3. jurnal uang DIBALIK (bukan dihapus) supaya jejak audit tetap ada
     *   4. handover perlengkapan dibatalkan + stok dikembalikan + HPP dibalik
     *   5. semuanya tercatat di audit_log
     */
    if (action === 'CANCEL_BOOKING') {
      { const cek = await requirePermission(request, 'booking.delete'); if (!cek.ok) return cek.response; }

      const txId = Number(body.transaction_id ?? body.id);
      const alasan = String(body.alasan || body.reason || '').trim();

      if (!txId) {
        return NextResponse.json({ success: false, message: 'ID transaksi wajib dikirim.' }, { status: 400 });
      }
      if (alasan.length < 5) {
        return NextResponse.json({
          success: false,
          message: 'Alasan pembatalan wajib diisi (minimal 5 karakter) agar bisa dipertanggungjawabkan.',
        }, { status: 400 });
      }

      const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(txId) as any;
      if (!tx) {
        return NextResponse.json({ success: false, message: 'Transaksi tidak ditemukan.' }, { status: 404 });
      }

      const statusAsal = statusSah(tx.status);
      if (!statusAsal) {
        return NextResponse.json({
          success: false,
          message: `Status transaksi "${tx.status}" tidak dikenal. Perbaiki statusnya lebih dulu.`,
        }, { status: 409 });
      }
      if (statusAsal === 'CANCELLED') {
        return NextResponse.json({ success: false, message: 'Booking ini sudah dibatalkan.' }, { status: 409 });
      }
      if (!bolehTransisi(statusAsal, 'CANCELLED')) {
        return NextResponse.json({
          success: false,
          message: `Tidak boleh membatalkan booking berstatus ${LABEL_STATUS[statusAsal].teks}.`,
        }, { status: 409 });
      }

      const hasil = db.transaction(() => {
        const tgl = tanggalWib();

        // 1) Status transaksi
        db.prepare('UPDATE transactions SET status = ?, notes = COALESCE(notes, ?) WHERE id = ?')
          .run('CANCELLED', `Dibatalkan: ${alasan}`, txId);

        // 2) Pembayaran yang masih menunggu -> ditolak
        const pending = db.prepare(
          "UPDATE payment_history SET status = 'REJECTED', notes = COALESCE(notes,'') || ' (batal: ' || ? || ')' WHERE transaction_id = ? AND status IN ('PENDING','WAITING_APPROVAL')",
        ).run(alasan, txId);

        // 3) BALIK jurnal uang (bukan hapus) untuk setiap pembayaran APPROVED
        const dibayar = db.prepare(
          "SELECT COALESCE(SUM(amount),0) s FROM payment_history WHERE transaction_id = ? AND status = 'APPROVED'",
        ).get(txId) as { s: number };

        const nominalDibalik = Number(dibayar.s) || 0;

        let jurnalBalik = 0;
        if (nominalDibalik > 0) {
          const akunKas = akunKasDefault();
          const akunPendapatan = akunPendapatanDefault();
          if (!akunKas || !akunPendapatan) throw new Error('Akun kas/pendapatan default tidak ditemukan di COA');

          const ket = `Pembatalan booking ${tx.booking_code} — ${alasan}`;
          // Kebalikan dari jurnal penerimaan: Dr Pendapatan / Cr Kas
          tulisLedger(
            { transactionId: txId },
            { coaAccountId: akunPendapatan, entryType: 'DEBIT', amount: nominalDibalik, description: ket, entryDate: tgl, reference: `BATAL-${tx.booking_code}` },
          );
          tulisLedger(
            { transactionId: txId },
            { coaAccountId: akunKas, entryType: 'CREDIT', amount: nominalDibalik, description: ket, entryDate: tgl, reference: `BATAL-${tx.booking_code}` },
          );
          jurnalBalik = 2;
        }

        /*
         * 4) Perlengkapan yang sudah diserahkan: stok dikembalikan dan HPP
         *    dibalik agar beban tidak menggantung pada booking yang batal.
         */
        const handovers = db.prepare('SELECT id, item_id, qty FROM inventory_handover WHERE transaction_id = ?').all(txId) as any[];
        let stokKembali = 0;
        for (const h of handovers) {
          db.prepare('UPDATE inventory_items SET stock_total = stock_total + ? WHERE id = ?').run(Number(h.qty) || 0, h.item_id);
          hapusHppPenyerahan(db, h.id);
          db.prepare('DELETE FROM inventory_handover WHERE id = ?').run(h.id);
          stokKembali += Number(h.qty) || 0;
        }

        // Checklist ditandai belum supaya tidak dianggap selesai
        db.prepare("UPDATE jamaah_checklist SET status = 'BELUM', notes = COALESCE(notes,'') || ' (batal)' WHERE jamaah_id = (SELECT jamaah_id FROM transactions WHERE id = ?)")
          .run(txId);

        catatAudit({
          user: auth.user,
          action: 'DELETE',
          module: 'transaction',
          recordId: txId,
          before: { status: tx.status, paid_amount: Number(tx.paid_amount) || 0 },
          after: { status: 'CANCELLED', dibalik: nominalDibalik, pembayaran_ditolak: pending.changes, stok_kembali: stokKembali },
          notes: `Pembatalan: ${alasan}`,
        });

        return {
          dibayar: nominalDibalik,
          jurnalBalik,
          pembayaranDitolak: pending.changes,
          stokKembali,
        };
      })();

      return NextResponse.json({
        success: true,
        message:
          `Booking ${tx.booking_code} dibatalkan. ` +
          `Jurnal dibalik Rp ${hasil.dibayar.toLocaleString('id-ID')}, ` +
          `${hasil.pembayaranDitolak} pembayaran menunggu ditolak, ` +
          `${hasil.stokKembali} item dikembalikan ke stok. Riwayat tetap utuh.`,
        ...hasil,
      });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/transactions' });
  }
}
