import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { generateReceiptNumber } from '@/lib/utils';
import { recalcTransaction } from '@/lib/booking';

/** Unggah bukti transfer oleh jemaah (tanpa login, hanya butuh kode booking). */
export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const booking_code = String(formData.get('booking_code') || '').trim();
    const amount = Number(formData.get('amount'));
    const payment_phase = String(formData.get('payment_phase') || 'DP');
    const bank_name = String(formData.get('bank_name') || '');
    const account_name = String(formData.get('account_name') || '');
    const file = formData.get('proof_image') as File | null;

    if (!booking_code) {
      return NextResponse.json({ success: false, message: 'Kode booking wajib diisi.' }, { status: 400 });
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Nominal transfer tidak valid.' }, { status: 400 });
    }

    const tx = db.prepare('SELECT * FROM transactions WHERE booking_code = ?').get(booking_code) as any;
    if (!tx) {
      return NextResponse.json({ success: false, message: 'Nomor pendaftaran / invoice tidak valid.' }, { status: 404 });
    }
    if (tx.status === 'CANCELLED') {
      return NextResponse.json({ success: false, message: 'Booking ini sudah dibatalkan.' }, { status: 400 });
    }

    // Simpan bukti SEBELUM menulis DB, supaya tidak ada baris pembayaran tanpa gambar.
    let proofPath = '';
    if (file && file.size > 0) {
      const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
      const ext = (file.name.split('.').pop() || '').toLowerCase();
      if (!allowed.includes(file.type) && !['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'].includes(ext)) {
        return NextResponse.json({ success: false, message: 'Format bukti harus JPG, PNG, WEBP, GIF, atau PDF.' }, { status: 400 });
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ success: false, message: 'Ukuran bukti maksimal 5 MB.' }, { status: 400 });
      }

      const { default: fs } = await import('fs');
      const { default: path } = await import('path');
      const uploadDir = path.join(process.cwd(), 'public', 'uploads');
      if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

      const safeExt = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'pdf'].includes(ext) ? `.${ext}` : '.jpg';
      const proofFileName = `proof_${Date.now()}_${Math.floor(Math.random() * 1000)}${safeExt}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      fs.writeFileSync(path.join(uploadDir, proofFileName), buffer);
      proofPath = `/uploads/${proofFileName}`;
    }

    const receiptNumber = generateReceiptNumber();

    // Wajib menunggu verifikasi admin sebelum ikut menambah paid_amount.
    db.prepare(
      `INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, bank_name,
        account_name, proof_image, status, notes, created_by) VALUES (?, ?, ?, 'TRANSFER', ?, ?, ?, ?, 'WAITING_APPROVAL', ?, 'Jemaah (online)')`
    ).run(
      tx.id,
      receiptNumber,
      amount,
      payment_phase,
      bank_name,
      account_name,
      proofPath,
      `Bukti transfer diunggah oleh jemaah (${payment_phase})`
    );

    recalcTransaction(tx.id);

    return NextResponse.json({
      success: true,
      message: 'Bukti pembayaran berhasil diunggah! Mohon menunggu verifikasi dari Admin.',
      payment_number: receiptNumber,
    });
  } catch (error: any) {
    console.error('Upload Proof Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
