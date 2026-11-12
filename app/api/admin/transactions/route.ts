import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { requirePermission, catatAudit } from '@/lib/permissions';
import { tulisLedger, akunKasDefault, akunPendapatanDefault } from '@/lib/ledger';
import { tanggalWib } from '@/lib/waktu';
import { cekBentrokJadwal, pesanBentrok, tautkanJamaah } from '@/lib/booking-jamaah';

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
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
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

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
