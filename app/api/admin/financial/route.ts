import { NextResponse } from 'next/server';
import { galatServer } from '@/lib/galat';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { requirePermission, catatAudit } from '@/lib/permissions';
import { tulisLedger, akunKasDefault } from '@/lib/ledger';
import { labaRugi, neraca, arusKas } from '@/lib/laporan';
import { labaRugiPerKloter } from '@/lib/laporan-kloter';
import { validasiNominal, validasiJurnal } from '@/lib/uang';
import { tanggalWib, tanggalValid, keTanggalWib } from '@/lib/waktu';

initDB();

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'journal.read');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'ALL';
    const date = searchParams.get('date');
    const month = searchParams.get('month');
    const year = searchParams.get('year');

    /*
     * Rentang tanggal untuk laporan.
     *
     * Semua laporan (laba rugi, neraca, arus kas) diambil dari BUKU BESAR
     * (tabel `ledger`), bukan dari tabel `expenses` dan bukan dari angka
     * hardcode. Dengan begitu apa pun yang dijurnal — pembayaran jamaah, beban
     * operasional, jurnal umum, dan HPP perlengkapan — otomatis tercermin dan
     * angkanya bisa dipertanggungjawabkan.
     */
    let dari: string | null = null;
    let sampai: string | null = null;

    if (period === 'DAILY' && date) {
      dari = date; sampai = date;
    } else if (period === 'MONTHLY' && month) {
      dari = `${month}-01`;
      const [y, m] = month.split('-').map(Number);
      sampai = new Date(y, m, 0).toISOString().slice(0, 10); // hari terakhir bulan
    } else if (period === 'YEARLY' && year) {
      dari = `${year}-01-01`; sampai = `${year}-12-31`;
    }

    const rentang = { dari, sampai };

    const lr = labaRugi(db, rentang);
    const nc = neraca(db, rentang);
    const ak = arusKas(db, rentang);

    // Konteks tagihan (bukan bagian pembukuan): dipakai kartu ringkasan.
    const tagihan = db
      .prepare(`SELECT COALESCE(SUM(paid_amount),0) AS dibayar, COALESCE(SUM(remaining_amount),0) AS sisa FROM transactions`)
      .get() as { dibayar: number; sisa: number };

    return NextResponse.json({
      success: true,
      period,
      rentang,
      sumber: 'ledger',
      summary: {
        total_revenue: lr.total_pendapatan,
        total_paid: Number(tagihan.dibayar) || 0,
        total_outstanding: Number(tagihan.sisa) || 0,
        total_expenses: lr.total_beban,
        gross_profit: lr.laba_bersih,
      },
      laba_rugi: {
        // Nama yang dipakai UI.
        total_pendapatan: lr.total_pendapatan,
        total_beban: lr.total_beban,
        laba_bersih: lr.laba_bersih,
        // Alias lama supaya pemanggil lain tidak rusak.
        total_revenue: lr.total_pendapatan,
        total_expenses: lr.total_beban,
        gross_profit: lr.laba_bersih,
        expenses_by_group: lr.beban.map((b: any) => ({
          coa_code: b.coa_code, coa_name: b.coa_name, total_expense: b.total,
        })),
        rincian_pendapatan: lr.pendapatan,
        rincian_beban: lr.beban,
      },
      neraca: nc,
      arus_kas: ak,
      // Laba-rugi per kloter (cost center) — kini mungkin karena ledger punya batch_id.
      per_kloter: labaRugiPerKloter(db),
    });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/financial' });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'GET_COA') {
      { const cek = await requirePermission(request, 'journal.read'); if (!cek.ok) return cek.response; }
      const coa = db.prepare('SELECT * FROM chart_of_accounts ORDER BY coa_code ASC').all();
      return NextResponse.json({ success: true, coa });
    }

    if (action === 'SAVE_COA') {
      { const cek = await requirePermission(request, 'coa.manage'); if (!cek.ok) return cek.response; }
      const { id, coa_code, coa_name, coa_type, coa_group } = body;
      if (!coa_code || !coa_name) {
        return NextResponse.json({ success: false, message: 'Kode dan Nama Akun wajib diisi' }, { status: 400 });
      }
      if (id) {
        db.prepare(`
          UPDATE chart_of_accounts SET coa_code = ?, coa_name = ?, coa_type = ?, coa_group = ?
          WHERE id = ?
        `).run(coa_code, coa_name, coa_type, coa_group, id);
        return NextResponse.json({ success: true, message: 'Akun COA berhasil diperbarui' });
      } else {
        db.prepare(`
          INSERT OR IGNORE INTO chart_of_accounts (coa_code, coa_name, coa_type, coa_group)
          VALUES (?, ?, ?, ?)
        `).run(coa_code, coa_name, coa_type, coa_group);
        return NextResponse.json({ success: true, message: 'Akun COA berhasil ditambahkan' });
      }
    }

    if (action === 'DELETE_COA') {
      { const cek = await requirePermission(request, 'coa.manage'); if (!cek.ok) return cek.response; }
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, message: 'ID akun wajib dikirim' }, { status: 400 });

      const akun = db.prepare('SELECT id, coa_code, coa_name FROM chart_of_accounts WHERE id = ?').get(id) as any;
      if (!akun) return NextResponse.json({ success: false, message: 'Akun tidak ditemukan' }, { status: 404 });

      /*
       * Akun yang sudah dipakai transaksi tidak boleh dihapus: kalau dihapus, semua
       * laporan (laba rugi, neraca, buku besar) kehilangan rujukannya dan angkanya
       * jadi salah tanpa jejak. Nonaktifkan (is_active = 0) adalah pilihan yang benar.
       */
      const pakai = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM expenses WHERE coa_account_id = ?) AS expenses,
          (SELECT COUNT(*) FROM ledger WHERE coa_account_id = ?) AS ledger,
          (SELECT COUNT(*) FROM general_journals WHERE debit_coa_id = ? OR credit_coa_id = ?) AS journals
      `).get(id, id, id, id) as any;
      const total = Number(pakai.expenses) + Number(pakai.ledger) + Number(pakai.journals);
      if (total > 0) {
        return NextResponse.json({
          success: false,
          message: `Akun ${akun.coa_code} — ${akun.coa_name} sudah dipakai (${pakai.expenses} beban, ${pakai.ledger} baris buku besar, ${pakai.journals} jurnal). Nonaktifkan akun ini, jangan dihapus.`,
        }, { status: 409 });
      }

      db.prepare('DELETE FROM chart_of_accounts WHERE id = ?').run(id);
      catatAudit({ user: auth.user, action: 'DELETE', module: 'coa', recordId: id });
      return NextResponse.json({ success: true, message: 'Akun COA dihapus' });
    }

    if (action === 'GET_EXPENSES') {
      { const cek = await requirePermission(request, 'journal.read'); if (!cek.ok) return cek.response; }
      const expenses = db.prepare(`
        SELECT e.*, e.expense_date AS date, e.expense_date AS tanggal, coa.coa_code, coa.coa_name
        FROM expenses e
        LEFT JOIN chart_of_accounts coa ON e.coa_account_id = coa.id
        ORDER BY e.expense_date DESC, e.id DESC
      `).all();
      return NextResponse.json({ success: true, expenses });
    }

    if (action === 'ADD_EXPENSE') {
      { const cek = await requirePermission(request, 'expense.manage'); if (!cek.ok) return cek.response; }
      const { coa_account_id, amount, description, expense_date, batch_id } = body;
      if (!coa_account_id) {
        return NextResponse.json({ success: false, message: 'Akun beban wajib dipilih' }, { status: 400 });
      }

      /*
       * Nominal divalidasi lewat satu pintu (lib/uang.ts): wajib angka wajar,
       * bulat, >= 1. Sebelumnya cukup `if (!amount)` sehingga -5.000.000 lolos
       * dan tersimpan sebagai beban negatif — pendapatan palsu yang
       * menggelembungkan laba.
       */
      const cekNominal = validasiNominal(amount, 'Nominal beban');
      if (!cekNominal.ok) {
        return NextResponse.json({ success: false, message: cekNominal.pesan }, { status: 400 });
      }

      const akunBeban = db.prepare('SELECT id, coa_group FROM chart_of_accounts WHERE id = ?').get(coa_account_id) as
        | { id: number; coa_group: string }
        | undefined;
      if (!akunBeban) {
        return NextResponse.json({ success: false, message: 'Akun beban tidak ditemukan' }, { status: 404 });
      }
      if (String(akunBeban.coa_group) !== 'Beban') {
        return NextResponse.json({
          success: false,
          message: `Akun ${coa_account_id} bukan akun Beban (grup: ${akunBeban.coa_group}). Pilih akun dari grup Beban.`,
        }, { status: 400 });
      }

      /*
       * Tanggal default memakai WIB, bukan UTC. Dulu
       * `new Date().toISOString().slice(0,10)` membuat beban pukul 00:00–06:59
       * WIB tercatat pada tanggal kemarin.
       */
      const tgl = expense_date ? String(expense_date).slice(0, 10) : tanggalWib();
      if (!tanggalValid(tgl)) {
        return NextResponse.json({ success: false, message: 'Format tanggal beban tidak valid (YYYY-MM-DD).' }, { status: 400 });
      }

      /*
       * Beban dan baris buku besarnya ditulis dalam satu transaksi, dan baris
       * ledger WAJIB menunjuk expense_id. Sebelumnya id tidak diisi sehingga
       * menghapus beban tidak pernah menghapus jurnalnya (ledger yatim).
       */
      const info = db.transaction(() => {
        /*
         * batch_id = cost center (kloter). Opsional, tetapi bila diisi maka beban
         * ini bisa dihitung dalam HPP keberangkatan tertentu.
         */
        const batchId = Number(batch_id) > 0 ? Number(batch_id) : null;
        const res = db.prepare(`
          INSERT INTO expenses (coa_account_id, amount, description, expense_date, created_by, batch_id)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(coa_account_id, cekNominal.nilai, description || '', tgl, auth.user?.email || 'Admin', batchId);
        const expenseId = Number(res.lastInsertRowid);

        /*
         * Jurnal beban WAJIB dua sisi: Dr akun beban / Cr Kas & Bank.
         *
         * Sebelumnya hanya sisi KREDIT yang ditulis, sehingga:
         *   - saldo beban jadi NEGATIF (beban normalnya di sisi debit)
         *   - kas tidak pernah berkurang di neraca
         *   - total debit dan kredit di buku besar tidak seimbang
         */
        tulisLedger(
          { expenseId, batchId },
          {
            coaAccountId: Number(coa_account_id),
            entryType: 'DEBIT',
            amount: cekNominal.nilai,
            description: description || 'Beban Operasional',
            entryDate: tgl,
          },
        );

        const kas = akunKasDefault();
        tulisLedger(
          { expenseId, batchId },
          {
            coaAccountId: kas ?? Number(coa_account_id),
            entryType: 'CREDIT',
            amount: cekNominal.nilai,
            description: `Pembayaran ${description || 'Beban Operasional'}`,
            entryDate: tgl,
          },
        );

        return expenseId;
      })();

      catatAudit({ user: auth.user, action: 'CREATE', module: 'expense', recordId: info, after: { coa_account_id, amount, description, tgl } });
      return NextResponse.json({ success: true, message: 'Beban operasional berhasil dicatat', expense_id: info });
    }

    if (action === 'DELETE_EXPENSE') {
      { const cek = await requirePermission(request, 'expense.manage'); if (!cek.ok) return cek.response; }
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, message: 'ID beban wajib dikirim' }, { status: 400 });

      const beban = db.prepare('SELECT * FROM expenses WHERE id = ?').get(id) as any;
      if (!beban) return NextResponse.json({ success: false, message: 'Catatan beban tidak ditemukan' }, { status: 404 });

      /*
       * Beban dan baris buku besarnya harus hilang bersama — kalau hanya barisnya
       * yang dihapus, ledger menyimpan kredit tanpa dokumen sumber dan neraca
       * tidak lagi bisa dipertanggungjawabkan.
       */
      const hapus = db.transaction(() => {
        db.prepare('DELETE FROM ledger WHERE expense_id = ?').run(id);
        db.prepare('DELETE FROM expenses WHERE id = ?').run(id);
      });
      hapus();

      catatAudit({ user: auth.user, action: 'DELETE', module: 'expense', recordId: id });
      return NextResponse.json({ success: true, message: 'Catatan beban & baris buku besarnya dihapus' });
    }

    if (action === 'GET_JOURNALS') {
      { const cek = await requirePermission(request, 'journal.read'); if (!cek.ok) return cek.response; }
      const journals = db.prepare(`
        SELECT j.*, 
               d.coa_code as debit_code, d.coa_name as debit_name,
               c.coa_code as credit_code, c.coa_name as credit_name
        FROM general_journals j
        LEFT JOIN chart_of_accounts d ON j.debit_coa_id = d.id
        LEFT JOIN chart_of_accounts c ON j.credit_coa_id = c.id
        ORDER BY j.journal_date DESC, j.id DESC
      `).all();
      return NextResponse.json({ success: true, journals });
    }

    if (action === 'ADD_JOURNAL') {
      { const cek = await requirePermission(request, 'journal.create'); if (!cek.ok) return cek.response; }
      const { journal_date, reference_no, description, debit_coa_id, credit_coa_id, amount, batch_id } = body;
      if (!journal_date) {
        return NextResponse.json({ success: false, message: 'Tanggal jurnal wajib diisi' }, { status: 400 });
      }

      /*
       * Validasi jurnal dua sisi lewat satu pintu: akun debit & kredit wajib
       * berbeda dan keduanya ada di COA, nominal wajib wajar (>= 1).
       * Sebelumnya nominal negatif bisa tersimpan sebagai jurnal umum,
       * sehingga sisi debit/kredit terbalik tanpa jejak kesalahan.
       */
      const cekJurnal = validasiJurnal(debit_coa_id, credit_coa_id, amount);
      if (!cekJurnal.ok) {
        return NextResponse.json({ success: false, message: cekJurnal.pesan }, { status: 400 });
      }
      const akunAda = db
        .prepare('SELECT COUNT(*) c FROM chart_of_accounts WHERE id IN (?, ?)')
        .get(cekJurnal.debit, cekJurnal.kredit) as { c: number };
      if (Number(akunAda.c) !== 2) {
        return NextResponse.json({ success: false, message: 'Akun debit/kredit tidak ditemukan di COA' }, { status: 404 });
      }

      const refNo = reference_no || 'JRN-' + Math.floor(1000 + Math.random() * 9000);

      /*
       * Jurnal + dua baris ledger ditulis atomik, dan setiap baris ledger
       * menyimpan journal_id. Inilah yang membuat DELETE_JOURNAL tidak perlu
       * lagi menebak lewat tanggal+nominal+keterangan.
       */
      const hasil = db.transaction(() => {
        const res = db.prepare(`
          INSERT INTO general_journals (journal_date, reference_no, description, debit_coa_id, credit_coa_id, amount, batch_id)
          VALUES (?, ?, ?, ?, ?, ?, ?)
        `).run(journal_date, refNo, description || 'Jurnal Umum', debit_coa_id, credit_coa_id, cekJurnal.nilai,
               Number(batch_id) > 0 ? Number(batch_id) : null);
        const journalId = Number(res.lastInsertRowid);

        const batchJurnal = Number(batch_id) > 0 ? Number(batch_id) : null;
        tulisLedger(
          { journalId, batchId: batchJurnal },
          { coaAccountId: cekJurnal.debit, entryType: 'DEBIT', amount: cekJurnal.nilai, description: description || 'Jurnal Umum', entryDate: journal_date, reference: refNo },
        );
        tulisLedger(
          { journalId, batchId: batchJurnal },
          { coaAccountId: cekJurnal.kredit, entryType: 'CREDIT', amount: cekJurnal.nilai, description: description || 'Jurnal Umum', entryDate: journal_date, reference: refNo },
        );

        return journalId;
      })();

      catatAudit({ user: auth.user, action: 'CREATE', module: 'journal', recordId: hasil, after: { journal_date, refNo, debit_coa_id, credit_coa_id, amount } });
      return NextResponse.json({ success: true, message: 'Jurnal umum berhasil dicatat & disinkronkan ke buku besar', id: hasil });
    }

    if (action === 'DELETE_JOURNAL') {
      { const cek = await requirePermission(request, 'journal.delete'); if (!cek.ok) return cek.response; }
      const { id } = body;
      if (!id) return NextResponse.json({ success: false, message: 'ID jurnal wajib dikirim' }, { status: 400 });

      const jurnal = db.prepare('SELECT * FROM general_journals WHERE id = ?').get(id) as any;
      if (!jurnal) return NextResponse.json({ success: false, message: 'Jurnal tidak ditemukan' }, { status: 404 });

      /*
       * Sejak baris ledger menyimpan journal_id, penghapusan memakai id —
       * bukan lagi menebak lewat tanggal+nominal+keterangan (yang bisa
       * menghapus baris milik jurnal lain). Sisa baris lama yang belum
       * bertaut journal_id dibersihkan lewat sidik keterangan sebagai
       * jaring pengaman untuk data historis saja.
       */
      const ket = jurnal.description || 'Jurnal Umum';
      const hapus = db.transaction(() => {
        db.prepare('DELETE FROM ledger WHERE journal_id = ?').run(id);
        db.prepare(`
          DELETE FROM ledger
          WHERE journal_id IS NULL AND entry_date = ? AND amount = ?
            AND description IN (?, ?, ?)
        `).run(jurnal.journal_date, jurnal.amount, ket, `${ket} (Debit)`, `${ket} (Kredit)`);
        db.prepare('DELETE FROM general_journals WHERE id = ?').run(id);
      });
      hapus();

      catatAudit({ user: auth.user, action: 'DELETE', module: 'journal', recordId: Number(id), before: jurnal });
      return NextResponse.json({ success: true, message: 'Jurnal umum & pasangan buku besarnya dihapus' });
    }

    if (action === 'GET_LEDGER') {
      { const cek = await requirePermission(request, 'journal.read'); if (!cek.ok) return cek.response; }
      const ledger = db.prepare(`
        SELECT l.*, coa.coa_code, coa.coa_name
        FROM ledger l
        LEFT JOIN chart_of_accounts coa ON l.coa_account_id = coa.id
        ORDER BY l.entry_date DESC, l.id DESC
        LIMIT 100
      `).all();
      return NextResponse.json({ success: true, ledger });
    }

    return NextResponse.json({ success: false, message: 'Aksi finansial tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/financial' });
  }
}
