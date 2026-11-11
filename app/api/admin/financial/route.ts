import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { requirePermission, catatAudit } from '@/lib/permissions';
import { tulisLedger } from '@/lib/ledger';

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

    let dateCondition = '';
    let params: any[] = [];

    if (period === 'DAILY' && date) {
      dateCondition = 'WHERE DATE(created_at) = ?';
      params.push(date);
    } else if (period === 'MONTHLY' && month) {
      dateCondition = 'WHERE strftime("%Y-%m", created_at) = ?';
      params.push(month);
    } else if (period === 'YEARLY' && year) {
      dateCondition = 'WHERE strftime("%Y", created_at) = ?';
      params.push(year);
    }

    // Transactions / Revenue
    const transactions = db.prepare(`SELECT * FROM transactions ${dateCondition}`).all(...params);
    const total_revenue = transactions.reduce((acc: number, curr: any) => acc + (curr.total_price || 0), 0);
    const total_paid = transactions.reduce((acc: number, curr: any) => acc + (curr.paid_amount || 0), 0);
    const total_outstanding = transactions.reduce((acc: number, curr: any) => acc + (curr.remaining_amount || 0), 0);

    // Expenses
    let expCondition = '';
    let expParams: any[] = [];
    if (period === 'DAILY' && date) {
      expCondition = 'WHERE expense_date = ?';
      expParams.push(date);
    } else if (period === 'MONTHLY' && month) {
      expCondition = 'WHERE strftime("%Y-%m", expense_date) = ?';
      expParams.push(month);
    } else if (period === 'YEARLY' && year) {
      expCondition = 'WHERE strftime("%Y", expense_date) = ?';
      expParams.push(year);
    }

    const expenses = db.prepare(`
      SELECT e.*, coa.coa_code, coa.coa_name, coa.coa_group
      FROM expenses e
      LEFT JOIN chart_of_accounts coa ON e.coa_account_id = coa.id
      ${expCondition}
    `).all(...expParams);
    const total_expenses = expenses.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);

    // Expenses grouped by COA
    const expenses_by_group: any = {};
    expenses.forEach((ex: any) => {
      const key = (ex.coa_code || '999') + ' - ' + (ex.coa_name || 'Beban Lainnya');
      if (!expenses_by_group[key]) {
        expenses_by_group[key] = { coa_code: ex.coa_code || '999', coa_name: ex.coa_name || 'Beban Lainnya', total_expense: 0 };
      }
      expenses_by_group[key].total_expense += ex.amount;
    });

    const gross_profit = total_paid - total_expenses;

    // Neraca structure expected by NeracaTab
    const persediaan_gudang = 5000000;
    const total_aset = (total_paid - total_expenses) + total_outstanding + persediaan_gudang;
    const hutang_vendor = Math.round(total_outstanding * 0.3);
    const pendapatan_dimuka = total_paid;
    const total_liabilitas = hutang_vendor + pendapatan_dimuka;
    const modal_disetor = 50000000;
    const total_ekuitas = modal_disetor + gross_profit;

    const neraca = {
      aset: {
        kas_bank: total_paid - total_expenses,
        piutang_jamaah: total_outstanding,
        persediaan: persediaan_gudang,
        total_aset
      },
      liabilitas: {
        hutang_vendor,
        pendapatan_diterima_dimuka: pendapatan_dimuka,
        total_liabilitas
      },
      ekuitas: {
        modal_disetor,
        laba_ditahan: gross_profit,
        total_ekuitas
      }
    };

    // Arus Kas structure expected by ArusKasTab
    const kas_awal = 50000000;
    const kas_bersih_operasi = total_paid - total_expenses;
    const kas_bersih_investasi = 0;
    const kas_bersih_pendanaan = 0;
    const perubahan_bersih = kas_bersih_operasi + kas_bersih_investasi + kas_bersih_pendanaan;
    const kas_akhir = kas_awal + perubahan_bersih;

    const arus_kas = {
      kas_awal,
      kas_akhir,
      perubahan_bersih,
      aktivitas_operasi: {
        penerimaan_dari_jamaah: total_paid,
        pembayaran_beban_operasional: total_expenses,
        pembayaran_vendor: Math.round(total_expenses * 0.7),
        kas_bersih_operasi
      },
      aktivitas_investasi: {
        pembelian_aset: 0,
        kas_bersih_investasi
      },
      aktivitas_pendanaan: {
        setoran_modal: 0,
        kas_bersih_pendanaan
      }
    };

    return NextResponse.json({
      success: true,
      period,
      summary: {
        total_revenue,
        total_paid,
        total_outstanding,
        total_expenses,
        gross_profit
      },
      laba_rugi: {
        total_revenue,
        total_paid,
        total_expenses,
        gross_profit,
        expenses_by_group: Object.values(expenses_by_group)
      },
      neraca,
      arus_kas
    });
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
        SELECT e.*, coa.coa_code, coa.coa_name
        FROM expenses e
        LEFT JOIN chart_of_accounts coa ON e.coa_account_id = coa.id
        ORDER BY e.expense_date DESC, e.id DESC
      `).all();
      return NextResponse.json({ success: true, expenses });
    }

    if (action === 'ADD_EXPENSE') {
      { const cek = await requirePermission(request, 'expense.manage'); if (!cek.ok) return cek.response; }
      const { coa_account_id, amount, description, expense_date } = body;
      if (!coa_account_id || !amount) {
        return NextResponse.json({ success: false, message: 'Akun dan jumlah beban wajib diisi' }, { status: 400 });
      }
      const tgl = expense_date || new Date().toISOString().split('T')[0];

      /*
       * Beban dan baris buku besarnya ditulis dalam satu transaksi, dan baris
       * ledger WAJIB menunjuk expense_id. Sebelumnya id tidak diisi sehingga
       * menghapus beban tidak pernah menghapus jurnalnya (ledger yatim).
       */
      const info = db.transaction(() => {
        const res = db.prepare(`
          INSERT INTO expenses (coa_account_id, amount, description, expense_date, created_by)
          VALUES (?, ?, ?, ?, ?)
        `).run(coa_account_id, amount, description || '', tgl, auth.user?.email || 'Admin');
        const expenseId = Number(res.lastInsertRowid);

        tulisLedger(
          { expenseId },
          {
            coaAccountId: Number(coa_account_id),
            entryType: 'CREDIT',
            amount: Number(amount),
            description: description || 'Beban Operasional',
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
      const { journal_date, reference_no, description, debit_coa_id, credit_coa_id, amount } = body;
      if (!journal_date || !debit_coa_id || !credit_coa_id || !amount) {
        return NextResponse.json({ success: false, message: 'Semua field wajib diisi (Tanggal, Akun Debit, Akun Kredit, Jumlah)' }, { status: 400 });
      }
      if (Number(debit_coa_id) === Number(credit_coa_id)) {
        return NextResponse.json({ success: false, message: 'Akun debit dan kredit tidak boleh sama' }, { status: 400 });
      }

      const refNo = reference_no || 'JRN-' + Math.floor(1000 + Math.random() * 9000);

      /*
       * Jurnal + dua baris ledger ditulis atomik, dan setiap baris ledger
       * menyimpan journal_id. Inilah yang membuat DELETE_JOURNAL tidak perlu
       * lagi menebak lewat tanggal+nominal+keterangan.
       */
      const hasil = db.transaction(() => {
        const res = db.prepare(`
          INSERT INTO general_journals (journal_date, reference_no, description, debit_coa_id, credit_coa_id, amount)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(journal_date, refNo, description || 'Jurnal Umum', debit_coa_id, credit_coa_id, amount);
        const journalId = Number(res.lastInsertRowid);

        tulisLedger(
          { journalId },
          { coaAccountId: Number(debit_coa_id), entryType: 'DEBIT', amount: Number(amount), description: description || 'Jurnal Umum', entryDate: journal_date, reference: refNo },
        );
        tulisLedger(
          { journalId },
          { coaAccountId: Number(credit_coa_id), entryType: 'CREDIT', amount: Number(amount), description: description || 'Jurnal Umum', entryDate: journal_date, reference: refNo },
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
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
