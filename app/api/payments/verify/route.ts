import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { recalcTransaction } from '@/lib/booking';
import { tulisLedger, akunKasDefault, akunPendapatanDefault } from '@/lib/ledger';

/**
 * Verifikasi pembayaran oleh admin. Endpoint ini WAJIB login (satu-satunya jalur
 * yang menaikkan paid_amount, jadi tidak boleh terbuka).
 */
export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const paymentId = Number(body.payment_id ?? body.paymentId);
    const action = String(body.action || '').toUpperCase();
    const notes = body.notes ? String(body.notes) : '';
    const verifiedBy = auth.user?.name || auth.user?.email || 'Admin';

    if (!paymentId || !['APPROVE', 'REJECT'].includes(action)) {
      return NextResponse.json({ success: false, message: 'Parameter tidak valid' }, { status: 400 });
    }

    const payment = db.prepare('SELECT * FROM payment_history WHERE id = ?').get(paymentId) as any;
    if (!payment) {
      return NextResponse.json({ success: false, message: 'Data pembayaran tidak ditemukan' }, { status: 404 });
    }
    if (payment.status === 'APPROVED' && action === 'APPROVE') {
      return NextResponse.json({ success: false, message: 'Pembayaran ini sudah disetujui sebelumnya.' }, { status: 400 });
    }

    /*
     * Tolak pembayaran yang membuat total melebihi tagihan.
     *
     * Sebelumnya `recalcTransaction()` memakai Math.max(0, ...) untuk sisa
     * tagihan, sehingga kelebihan bayar HILANG TANPA JEJAK: tagihan 10 juta,
     * dibayar 13 juta -> paid_amount 13 juta, remaining 0, selisih 3 juta tidak
     * tercatat di mana pun dan laporan tidak bisa dipertanggungjawabkan.
     * Lebih bayar harus diselesaikan (refund/dialihkan) lewat keputusan sadar,
     * bukan lolos diam-diam.
     */
    if (action === 'APPROVE') {
      const tx = db.prepare('SELECT id, total_amount, COALESCE(paid_amount,0) AS paid FROM transactions WHERE id = ?')
        .get(payment.transaction_id) as { id: number; total_amount: number; paid: number } | undefined;
      if (tx) {
        const sudahDibayar = Number(tx.paid) || 0;
        const tagihan = Number(tx.total_amount) || 0;
        const nominal = Number(payment.amount) || 0;
        if (nominal <= 0) {
          return NextResponse.json({ success: false, message: 'Nominal pembayaran tidak valid (harus lebih dari 0).' }, { status: 400 });
        }
        if (sudahDibayar + nominal > tagihan) {
          const lebih = sudahDibayar + nominal - tagihan;
          return NextResponse.json({
            success: false,
            message: `Pembayaran ditolak: total akan melebihi tagihan sebesar Rp ${lebih.toLocaleString('id-ID')}. ` +
              `Tagihan Rp ${tagihan.toLocaleString('id-ID')}, sudah dibayar Rp ${sudahDibayar.toLocaleString('id-ID')}, ` +
              `nominal ini Rp ${nominal.toLocaleString('id-ID')}. Kurangi nominalnya atau proses kelebihan sebagai refund.`,
          }, { status: 400 });
        }
      }
    }

    const now = new Date().toISOString();

    const hasil = db.transaction(() => {
      if (action === 'APPROVE') {
        db.prepare(`UPDATE payment_history SET status = 'APPROVED', verified_by = ?, notes = ? WHERE id = ?`)
          .run(verifiedBy, notes || 'Pembayaran disetujui & diverifikasi', paymentId);

        /*
         * Jurnal pembayaran dibuat DI SINI (titik persetujuan), bukan saat upload.
         * sebelumnya hanya jalur admin/transactions yang menulis ledger, sehingga
         * pembayaran lewat verifikasi tidak pernah masuk buku besar (selisih kas).
         * Idempoten: kalau ledger untuk payment ini sudah ada, jangan dobel.
         */
        const sudahAda = db
          .prepare('SELECT id FROM ledger WHERE payment_id = ? LIMIT 1')
          .get(paymentId) as { id: number } | undefined;
        if (!sudahAda) {
          const akunKas = akunKasDefault();
          const akunPendapatan = akunPendapatanDefault();
          if (!akunKas || !akunPendapatan) throw new Error('Akun kas/pendapatan default tidak ditemukan di COA');

          const tanggal = String(payment.created_at || now).slice(0, 10);
          const ket = `Pembayaran ${payment.receipt_number} (${payment.payment_phase || 'DP'})`;

          const ledgerId = tulisLedger(
            { transactionId: payment.transaction_id, paymentId },
            { coaAccountId: akunKas, entryType: 'DEBIT', amount: Number(payment.amount), description: `Kas masuk - ${ket}`, entryDate: tanggal, reference: payment.receipt_number },
          );
          tulisLedger(
            { transactionId: payment.transaction_id, paymentId },
            { coaAccountId: akunPendapatan, entryType: 'CREDIT', amount: Number(payment.amount), description: `Pendapatan paket - ${ket}`, entryDate: tanggal, reference: payment.receipt_number },
          );
          db.prepare('UPDATE payment_history SET ledger_id = ? WHERE id = ?').run(ledgerId, paymentId);
        }
      } else {
        db.prepare(`UPDATE payment_history SET status = 'REJECTED', verified_by = ?, notes = ? WHERE id = ?`)
          .run(verifiedBy, notes || 'Pembayaran ditolak', paymentId);

        /*
         * Bila sebelumnya sudah pernah disetujui lalu ditolak, jurnalnya harus
         * ikut dibatalkan — kalau tidak, kas tetap tercatat padahal uangnya
         * tidak sah. Baris ledger dihapus karena jurnal ini murni turunan
         * payment (bukan jurnal manual) dan tautannya sudah by id.
         */
        db.prepare('DELETE FROM ledger WHERE payment_id = ?').run(paymentId);
      }

      // Hitung ulang dari SEMUA pembayaran APPROVED (bukan dari angka lama).
      return recalcTransaction(payment.transaction_id);
    })();

    return NextResponse.json({
      success: true,
      message: action === 'APPROVE' ? 'Pembayaran berhasil disetujui!' : 'Pembayaran berhasil ditolak.',
      transaction: hasil,
    });
  } catch (error: any) {
    console.error('Verify Payment Error:', error);
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
