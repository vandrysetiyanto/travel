import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';

initDB();

export async function GET(request: Request) {
  const auth = await requireAdmin(request);
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
      const { jamaah_id, batch_id, initial_payment, payment_type, notes } = body;

      const batch = db.prepare(`
        SELECT b.*, p.price FROM batches b JOIN packages p ON b.package_id = p.id WHERE b.id = ?
      `).get(batch_id) as any;

      if (!batch) {
        return NextResponse.json({ success: false, message: 'Batch tidak ditemukan' }, { status: 400 });
      }

      const totalAmount = batch.price;
      const initialPaid = Number(initial_payment) || 0;
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

      if (initialPaid > 0) {
        const receiptNo = 'KW-' + Math.floor(100000 + Math.random() * 900000);
        db.prepare(`
          INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, notes)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(txId, receiptNo, initialPaid, payment_type || 'CASH', initialPaid >= totalAmount ? 'PELUNASAN' : 'DP', 'Pembayaran Awal');
      }

      return NextResponse.json({ success: true, message: 'Booking pendaftaran berhasil dibuat', booking_code: bookingCode, transaction_id: txId });
    }

    // Action 2: Add Installment Payment / Pelunasan
    if (action === 'ADD_PAYMENT') {
      const { transaction_id, amount, payment_type, bank_name, notes } = body;
      const tx = db.prepare('SELECT * FROM transactions WHERE id = ?').get(transaction_id) as any;
      if (!tx) {
        return NextResponse.json({ success: false, message: 'Transaksi tidak ditemukan' }, { status: 404 });
      }

      const payAmount = Number(amount);
      if (payAmount <= 0) {
        return NextResponse.json({ success: false, message: 'Nominal pembayaran harus lebih dari 0' }, { status: 400 });
      }

      const newPaid = tx.paid_amount + payAmount;
      const newRemaining = Math.max(0, tx.total_amount - newPaid);
      let newStatus = tx.status;
      if (newPaid >= tx.total_amount) {
        newStatus = 'PAID';
      } else if (newPaid > 0) {
        newStatus = 'DP';
      }

      db.prepare(`
        INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, bank_name, notes)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(transaction_id, receiptNo, payAmount, payment_type || 'TRANSFER', phase, bank_name || '', notes || '');

      return NextResponse.json({ success: true, message: 'Pembayaran berhasil dicatat', receipt_number: receiptNo });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
