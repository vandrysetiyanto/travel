'use client';

import { fmt, fmtRp, hariIniWib } from '@/components/dashboard/format';

import { MasterJamaah, MasterPaket, MasterBatches, MasterInventaris } from '@/components/dashboard/master';
import { LaporanTab, LedgerTab, StockLedgerTab, GeneralJournalTab } from '@/components/dashboard/keuangan';
import { ChecklistTab, ManifestTab, RegistrationsTab } from '@/components/dashboard/operasional';
import { RiwayatJamaahTab } from '@/components/dashboard/riwayat-jamaah';

import { EmptyState, StatusBadge, DocBadge, FInput, ToastContainer } from '@/components/dashboard/ui-dasar';


/* ===================== EMPTY STATE HELPER ===================== */

/* ===================== TOAST NOTIFICATION ===================== */

import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckSquare, FileText, Calculator, Wallet, LayoutDashboard, Users, Package, Boxes, ShoppingBag, Receipt, TrendingUp, Plane, ClipboardList, Building2, ShieldCheck, LogOut, Menu, X, CheckCircle2, Clock, AlertCircle, RefreshCw, BookOpen, CreditCard, FileSpreadsheet, KeyRound, History } from 'lucide-react';




type Tab = 'dashboard' | 'riwayat-jamaah' | 'jamaah' | 'paket' | 'batches' | 'inventory' | 'master-coa' | 'transaksi' | 'manifest' | 'checklist' | 'laporan' | 'pembayaran' | 'laba-rugi' | 'neraca' | 'arus-kas' | 'ledger' | 'stock-ledger' | 'general-journal' | 'expenses' | 'registrations' | 'staf' | 'roles' | 'audit' | 'settings';
type MasterSub = 'jamaah' | 'paket' | 'inventaris';

/* ===================== DASHBOARD TAB ===================== */
function DashboardTab({ isOwner }: { isOwner: boolean }) {
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(d => {
      if (d.success) { setStats(d.stats); setRecent(d.recentTransactions || []); }
    });
  }, []);
  if (!stats) return <p className="text-center py-12 text-gray-500">Memuat data...</p>;
  const primaryCards = [
    ...(isOwner ? [
      { label: 'Total Omset', value: fmtRp(stats.totalRevenue), hint: 'Pendapatan bruto paket', color: 'text-slate-900' },
      { label: 'Total Piutang', value: fmtRp(stats.totalReceivables), hint: 'Sisa tagihan berjalan', color: 'text-amber-600' },
    ] : []),
    { label: 'Total Jamaah', value: fmt(stats.totalJamaah) + ' Orang', hint: 'Jamaah terdaftar', color: 'text-slate-900' },
    { label: 'Total Transaksi', value: fmt(stats.totalTransactions) + ' Trx', hint: 'Akumulasi booking', color: 'text-slate-900' },
  ];

  const statusCards = [
    { label: 'Lunas', value: fmt(stats.paidCount), badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Sudah DP', value: fmt(stats.dpCount), badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Pending Tagihan', value: fmt(stats.pendingCount), badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  ];

  return (
    <div className="space-y-6">
      {/* Linear Style Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryCards.map((c, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{c.label}</span>
            <div className="my-2">
              <p className={`text-2xl font-black tracking-tight ${c.color}`}>{c.value}</p>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">{c.hint}</p>
          </div>
        ))}
      </div>

      {/* Secondary Status Breakdown Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {statusCards.map((c, i) => (
          <div key={i} className="bg-white border border-slate-200/70 rounded-xl px-4 py-3 flex items-center justify-between shadow-2xs">
            <span className="text-xs font-semibold text-slate-600">{c.label}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${c.badge}`}>{c.value}</span>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-bold text-gray-800 mb-4">Transaksi Terbaru</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left">
              <th className="p-3">Kode</th><th className="p-3">Jamaah</th><th className="p-3">Paket</th>
              <th className="p-3">Total</th><th className="p-3">Dibayar</th><th className="p-3">Status</th><th className="p-3">Tanggal</th>
            </tr></thead>
            <tbody>
              {recent.map((t: any) => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{t.booking_code}</td>
                  <td className="p-3">{t.full_name}</td>
                  <td className="p-3 text-xs">{t.package_name}</td>
                  <td className="p-3">{fmtRp(t.total_amount)}</td>
                  <td className="p-3">{fmtRp(t.paid_amount)}</td>
                  <td className="p-3"><StatusBadge s={t.status} /></td>
                  <td className="p-3 text-xs">{t.created_at}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={7}><EmptyState icon="" title="Belum Ada Transaksi" description="Belum ada riwayat transaksi atau booking umroh yang tercatat di sistem." /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}



/* Field input generik untuk form master. WAJIB di level modul (BUKAN di dalam
   komponen): kalau dideklarasikan di dalam, React menganggapnya tipe komponen
   baru tiap render -> <input> di-unmount & di-mount ulang tiap ketikan ->
   fokus hilang dan kursor melompat. */

/* ===================== MASTER TAB ===================== */
function MasterTab({ sub, setSub }: { sub: MasterSub; setSub: (s: MasterSub) => void }) {
  const tabs: { id: MasterSub; label: string }[] = [
    { id: 'jamaah', label: ' Master Jamaah' },
    { id: 'paket', label: ' Master Paket' },
    { id: 'inventaris', label: ' Master Inventory' },
  ];
  return (
    <div>
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={'px-4 py-2 rounded-lg text-sm font-medium transition ' + (sub === t.id ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'jamaah' && <MasterJamaah />}
      {sub === 'paket' && <MasterPaket />}
      {sub === 'inventaris' && <MasterInventaris />}
    </div>
  );
}

/* --- Master Jamaah --- */

/* --- Master Paket --- */
/* --- Master Paket --- */

/* --- Master Batches --- */

/* --- Master Inventaris --- */

/* ===================== TRANSAKSI TAB ===================== */
function TransaksiTab() {
  const [txList, setTxList] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [jamaahList, setJamaahList] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [showBooking, setShowBooking] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  // Pembatalan booking: alasan wajib diisi agar bisa dipertanggungjawabkan.
  const [showBatal, setShowBatal] = useState(false);
  const [alasanBatal, setAlasanBatal] = useState('');
  const [prosesBatal, setProsesBatal] = useState(false);
  const [bookForm, setBookForm] = useState<any>({});
  const [jamaahSearch, setJamaahSearch] = useState('');
  const [payForm, setPayForm] = useState<any>({});
  const [showPayForm, setShowPayForm] = useState(false);
  const [invItems, setInvItems] = useState<any[]>([]);
  const [bookItems, setBookItems] = useState<{item_id:string; qty:number}[]>([]);

  const loadTx = useCallback(() => {
    const q = filter !== 'ALL' ? `?status=${filter}` : '';
    fetch('/api/admin/transactions' + q).then(r=>r.json()).then(d=>{ if(d.success) setTxList(d.transactions||[]); });
  }, [filter]);
  useEffect(()=>{loadTx();},[loadTx]);
  useEffect(()=>{
    fetch('/api/admin/packages').then(r=>r.json()).then(d=>{ if(d.success) setBatches(d.batches||[]); });
    fetch('/api/admin/inventory').then(r=>r.json()).then(d=>{ if(d.success) setInvItems(d.items||[]); });
  },[]);

  const searchJamaah = () => {
    if(!jamaahSearch) return;
    fetch('/api/admin/jamaah?search='+encodeURIComponent(jamaahSearch)).then(r=>r.json()).then(d=>{ if(d.success) setJamaahList(d.jamaah||[]); });
  };

  const createBooking = async () => {
    if(!bookForm.jamaah_id||!bookForm.batch_id) return (window as any).__showAdminToast ? (window as any).__showAdminToast('Pilih Jamaah dan Batch terlebih dahulu', 'error') : alert('Pilih Jamaah dan Batch');
    const res = await fetch('/api/admin/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'CREATE_BOOKING',...bookForm})});
    const d = await res.json();
    if(d.success){
      const items = bookItems.filter(it=>it.item_id && Number(it.qty)>0);
      for(const it of items){
        const hr = await fetch('/api/admin/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'HANDOVER',transaction_id:d.transaction_id,item_id:it.item_id,qty:it.qty})});
        const hd = await hr.json();
        if(!hd.success) alert('Gagal menyerahkan salah satu item: ' + hd.message);
      }
      setShowBooking(false);setBookForm({});setBookItems([]);loadTx();
    }
    (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error') : alert(d.message);
  };

  const loadDetail = async (id: number) => {
    const res = await fetch('/api/admin/transactions?id='+id);
    const d = await res.json(); if(d.success) setDetail(d.transaction);
  };

  const addPayment = async () => {
    if(!payForm.amount) return (window as any).__showAdminToast ? (window as any).__showAdminToast('Nominal pembayaran wajib diisi', 'error') : alert('Nominal wajib diisi');
    const res = await fetch('/api/admin/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ADD_PAYMENT',transaction_id:detail.id,...payForm})});
    const d = await res.json(); (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error') : alert(d.message); if(d.success){setShowPayForm(false);setPayForm({});loadDetail(detail.id);loadTx();}
  };

  const printReceipt = async (pay: any) => {
    let company: any = { company_name: 'Al-Barakah Tour & Travel', ppiu_number: 'Izin Kemenag No. 123/PPIU/2024', address: 'Jakarta Selatan', phone: '0812-3456-7890', director_name: 'H. Fachrul Kurniawan' };
    try {
      const res = await fetch('/api/admin/settings');
      const d = await res.json();
      if (d.success && d.profile?.company_name) company = d.profile;
    } catch {}

    const w = window.open('','','width=700,height=750');
    if(!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Kwitansi Pembayaran - ${pay.receipt_number}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #1e293b; line-height: 1.4; }
            .header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; }
            .watermark { position: fixed; top: 35%; left: 15%; font-size: 80px; font-weight: 900; color: rgba(5, 150, 105, 0.04); transform: rotate(-30deg); text-transform: uppercase; z-index: -1; pointer-events: none; }
            .stamp-box { position: relative; display: inline-block; }
            .stamp-badge { border: 2px solid #059669; border-radius: 8px; color: #059669; font-size: 10px; font-weight: 900; padding: 4px 8px; text-transform: uppercase; display: inline-block; margin-top: 15px; transform: rotate(-5deg); background: rgba(236, 253, 245, 0.8); }
            .brand h2 { margin: 0; color: #059669; font-size: 20px; text-transform: uppercase; }
            .brand p { margin: 2px 0; font-size: 11px; color: #64748b; }
            .title-box { text-align: right; }
            .title-box h3 { margin: 0; font-size: 16px; color: #0f172a; text-transform: uppercase; }
            .title-box p { margin: 2px 0; font-size: 11px; font-family: monospace; font-weight: bold; }
            .receipt-grid { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
            .receipt-grid td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
            .receipt-grid td.label { width: 28%; color: #64748b; font-weight: 600; }
            .receipt-grid td.val { font-weight: 700; color: #0f172a; }
            .amount-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px; margin: 15px 0; display: flex; justify-content: space-between; align-items: center; }
            .amount-box span { font-size: 13px; font-weight: bold; color: #065f46; }
            .amount-box b { font-size: 20px; font-weight: 900; color: #059669; }
            .footer-sign { margin-top: 35px; display: flex; justify-content: space-between; font-size: 11px; }
            .footer-sign div { text-align: center; width: 180px; }
            .sign-line { margin-top: 50px; border-bottom: 1px solid #334155; font-weight: bold; padding-bottom: 2px; }
            .note { font-size: 10px; color: #94a3b8; margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <h2>${company.company_name}</h2>
              <p>${company.legal_name ? company.legal_name + ' | ' : ''}${company.ppiu_number}</p>
              <p>${company.address} | Telp: ${company.phone}</p>
            </div>
            <div class="title-box">
              <h3>Tanda Terima Pembayaran</h3>
              <p>${pay.receipt_number}</p>
            </div>
          </div>

          <table class="receipt-grid">
            <tr><td class="label">Telah Terima Dari</td><td class="val">: ${detail.full_name} (NIK: ${detail.nik})</td></tr>
            <tr><td class="label">Untuk Pembayaran</td><td class="val">: ${pay.payment_phase} (${detail.package_name} - ${detail.batch_name})</td></tr>
            <tr><td class="label">Kode Booking</td><td class="val">: ${detail.booking_code}</td></tr>
            <tr><td class="label">Metode Pembayaran</td><td class="val">: ${pay.payment_type} ${pay.bank_name ? '(' + pay.bank_name + ')' : ''}</td></tr>
            <tr><td class="label">Tanggal Transaksi</td><td class="val">: ${pay.created_at}</td></tr>
          </table>

          <div class="amount-box">
            <span>JUMLAH PEMBAYARAN:</span>
            <b>${fmtRp(pay.amount)}</b>
          </div>

          <table class="receipt-grid" style="font-size: 11px;">
            <tr><td class="label">Total Biaya Paket</td><td class="val">: ${fmtRp(detail.total_amount)}</td></tr>
            <tr><td class="label">Total Sudah Masuk</td><td class="val">: ${fmtRp(detail.paid_amount)}</td></tr>
            <tr><td class="label">Sisa Tagihan (Piutang)</td><td class="val" style="color: #e11d48;">: ${fmtRp(detail.remaining_amount)}</td></tr>
          </table>

          <div class="footer-sign">
            <div>
              <p>Penyetor / Jamaah</p>
              <div class="sign-line">${detail.full_name}</div>
            </div>
            <div>
              <p>${company.city || 'Kota'}, ${new Date().toLocaleDateString('id-ID')}</p>
              <p>Penerima / Petugas Kasir</p>
              <div class="sign-line">${company.director_name || 'Admin'}</div>
            </div>
          </div>

          <p class="note">Kwitansi ini adalah bukti pembayaran yang sah dan dicetak otomatis melalui sistem ${company.company_name}.</p>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };


  const batalkanBooking = async () => {
    if (!detail) return;
    if (alasanBatal.trim().length < 5) {
      alert('Alasan pembatalan wajib diisi (minimal 5 karakter).');
      return;
    }
    if (!confirm(`Batalkan booking ${detail.booking_code}?\n\nRiwayat tetap tersimpan dan jurnal uang akan dibalik (bukan dihapus).`)) return;

    setProsesBatal(true);
    try {
      const res = await fetch('/api/admin/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'CANCEL_BOOKING', transaction_id: detail.id, alasan: alasanBatal.trim() }),
      });
      const d = await res.json();
      if (d.success) {
        setShowBatal(false);
        setAlasanBatal('');
        setDetail(null);
        loadTx();
        (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, 'success') : alert(d.message);
      } else {
        (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, 'error') : alert(d.message);
      }
    } catch {
      alert('Gagal menghubungi server.');
    } finally {
      setProsesBatal(false);
    }
  };

  if (detail) return (
    <div className="space-y-4">
      <button onClick={()=>setDetail(null)} className="text-blue-600 hover:underline text-sm">&larr; Kembali ke Daftar Transaksi</button>
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div><h3 className="font-bold text-xl text-gray-800">{detail.booking_code}</h3><p className="text-sm text-gray-500">{detail.full_name} ({detail.nik})</p></div>
          <div className="flex items-center gap-2">
            <StatusBadge s={detail.status}/>
            {detail.status !== 'CANCELLED' && (
              <button onClick={() => { setAlasanBatal(''); setShowBatal(true); }}
                className="px-3 py-1.5 text-xs font-bold text-rose-600 border border-rose-200 rounded-xl hover:bg-rose-50">
                Batalkan Booking
              </button>
            )}
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Paket:</span><p className="font-medium">{detail.package_name}</p></div>
          <div><span className="text-gray-500">Batch:</span><p className="font-medium">{detail.batch_name}</p></div>
          <div><span className="text-gray-500">Total:</span><p className="font-bold">{fmtRp(detail.total_amount)}</p></div>
          <div><span className="text-gray-500">Dibayar:</span><p className="font-bold text-green-600">{fmtRp(detail.paid_amount)}</p></div>
          <div><span className="text-gray-500">Sisa:</span><p className="font-bold text-red-600">{fmtRp(detail.remaining_amount)}</p></div>
          <div><span className="text-gray-500">HP:</span><p>{detail.phone}</p></div>
          <div><span className="text-gray-500">Paspor:</span><p>{detail.passport_number || '-'}</p></div>
          <div><span className="text-gray-500">Visa:</span><DocBadge s={detail.visa_status}/></div>
        </div>
      </div>
      {showBatal && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-4"
             onClick={() => setShowBatal(false)}>
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-black text-slate-900">Batalkan Booking {detail.booking_code}</h4>
            <p className="text-[11px] text-slate-500 mt-1">
              Riwayat <b>tidak dihapus</b>. Jurnal uang dibalik (Dr Pendapatan / Cr Kas), pembayaran yang
              menunggu ditolak, dan perlengkapan yang sudah diserahkan dikembalikan ke stok.
            </p>
            <div className="mt-3">
              <label className="text-[11px] font-bold text-slate-600">Alasan pembatalan *</label>
              <textarea value={alasanBatal} onChange={(e) => setAlasanBatal(e.target.value)} rows={3}
                placeholder="mis. Jamaah membatalkan karena sakit"
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-xl" />
            </div>
            <div className="flex justify-end gap-2 mt-4">
              <button onClick={() => setShowBatal(false)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-100">Batal</button>
              <button onClick={batalkanBooking} disabled={prosesBatal}
                className="px-4 py-2 text-xs font-bold bg-rose-600 text-white rounded-xl hover:bg-rose-700 disabled:opacity-40">
                {prosesBatal ? 'Memproses…' : 'Ya, Batalkan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Payment Timeline */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800">Riwayat Pembayaran</h3>
          {detail.status !== 'PAID' && <button onClick={()=>{setPayForm({});setShowPayForm(true);}} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">+ Tambah Pembayaran</button>}
        </div>
        {showPayForm && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Nominal</label><input type="number" inputMode="numeric" pattern="[0-9]*" value={payForm.amount||''} onChange={e=>setPayForm({...payForm,amount:e.target.value})} placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Metode</label><select value={payForm.payment_type||'CASH'} onChange={e=>setPayForm({...payForm,payment_type:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option>CASH</option><option>TRANSFER</option></select></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Bank</label><input value={payForm.bank_name||''} onChange={e=>setPayForm({...payForm,bank_name:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label><input value={payForm.notes||''} onChange={e=>setPayForm({...payForm,notes:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
            </div>
            <div className="mt-3 flex gap-2"><button onClick={addPayment} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">Simpan</button><button onClick={()=>setShowPayForm(false)} className="bg-gray-300 px-4 py-2 rounded-lg text-sm">Batal</button></div>
          </div>
        )}
        <div className="space-y-3">
          {(detail.payments||[]).map((pay:any,i:number)=>(
            <div key={i} className="flex items-center gap-4 border-l-4 border-emerald-500 pl-4 py-2">
              <div className="flex-1">
                <p className="font-medium text-sm">{pay.payment_phase} - {fmtRp(pay.amount)}</p>
                <p className="text-xs text-gray-500">{pay.receipt_number} | {pay.payment_type} {pay.bank_name?'('+pay.bank_name+')':''} | {pay.created_at}</p>
              </div>
              <button onClick={()=>printReceipt(pay)} className="text-blue-600 hover:underline text-xs">Cetak Kwitansi</button>
            </div>
          ))}
          {(!detail.payments||detail.payments.length===0) && <p className="text-gray-400 text-sm">Belum ada pembayaran</p>}
        </div>
      </div>
      {/* Handover log */}
      {detail.handovers && detail.handovers.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-gray-800 mb-3">Serah Terima Barang</h3>
          {detail.handovers.map((h:any,i:number)=>(<div key={i} className="flex justify-between border-b py-2 text-sm"><span>{h.item_name} ({h.item_code})</span><span>{h.qty} {h.unit}</span><span className="text-gray-500">{h.handed_over_at}</span></div>))}
        </div>
      )}
    </div>
  );


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex gap-1">
          {['ALL','PENDING','DP','PAID','CANCELLED'].map(s=>(<button key={s} onClick={()=>setFilter(s)} className={'px-3 py-1 rounded-full text-xs font-bold transition '+(filter===s?'bg-slate-900 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{s==='ALL'?'Semua':s}</button>))}
        </div>
        <button onClick={()=>{setShowBooking(true);setBookForm({});setBookItems([]);setJamaahList([]);}} className="ml-auto bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ Booking Baru</button>
      </div>

      {showBooking && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Form Booking Pendaftaran Baru</h3>
              <button onClick={()=>setShowBooking(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Cari Jamaah (NIK / Nama) *</label>
                <div className="flex gap-2">
                  <input value={jamaahSearch} onChange={e=>setJamaahSearch(e.target.value)} className="flex-1 border rounded-xl px-3 py-2 text-xs" placeholder="Ketik NIK atau Nama..."/>
                  <button onClick={searchJamaah} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold">Cari</button>
                </div>
                {jamaahList.length>0 && (
                  <div className="mt-2 border rounded-xl max-h-40 overflow-y-auto bg-white shadow-md">
                    {jamaahList.map((j:any)=>(<button key={j.id} onClick={()=>{setBookForm({...bookForm,jamaah_id:j.id});setJamaahList([]);setJamaahSearch(j.full_name+' ('+j.nik+')');}} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs border-b border-slate-100">{j.full_name} - {j.nik} - {j.phone}</button>))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Batch Keberangkatan *</label>
                  <select value={bookForm.batch_id||''} onChange={e=>setBookForm({...bookForm,batch_id:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                    <option value="">-- Pilih Batch --</option>
                    {batches.map((b:any)=>(<option key={b.id} value={b.id}>{b.batch_name} - {b.package_name} ({fmtRp(b.price)}) — Kuota: {b.filled_quota||0}/{b.quota||45}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Pembayaran Awal (DP)</label>
                  <input type="number" inputMode="numeric" pattern="[0-9]*" value={bookForm.initial_payment||''} onChange={e=>setBookForm({...bookForm,initial_payment:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs font-mono" placeholder="0"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Metode Bayar</label>
                  <select value={bookForm.payment_type||'CASH'} onChange={e=>setBookForm({...bookForm,payment_type:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                    <option>CASH</option><option>TRANSFER</option>
                  </select>
                </div>
              </div>

              {/* Live Price & Remaining Balance Calculator */}
              {(() => {
                const selectedBatch = batches.find((b: any) => String(b.id) === String(bookForm.batch_id));
                const totalPrice = selectedBatch ? selectedBatch.price : 0;
                const payAmount = Number(bookForm.initial_payment) || 0;
                const remaining = Math.max(0, totalPrice - payAmount);
                if (!selectedBatch) return null;
                return (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Harga Paket</p>
                      <p className="text-sm font-bold text-slate-900">{fmtRp(totalPrice)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Dibayar Sekarang</p>
                      <p className="text-sm font-bold text-emerald-600">{fmtRp(payAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Sisa Tagihan</p>
                      <p className={"text-sm font-black " + (remaining === 0 ? "text-emerald-700" : "text-rose-600")}>
                        {fmtRp(remaining)} {remaining === 0 ? " LUNAS" : ""}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Perlengkapan Logistik (Opsional)</label>
                  <button onClick={()=>setBookItems([...bookItems,{item_id:'',qty:1}])} className="text-xs text-indigo-600 font-bold hover:underline">+ Tambah Item</button>
                </div>
                <div className="space-y-2">
                  {bookItems.map((it,idx)=>(
                    <div key={idx} className="flex gap-2 items-center">
                      <select value={it.item_id} onChange={e=>{const next=[...bookItems];next[idx]={...next[idx],item_id:e.target.value};setBookItems(next);}} className="flex-1 border rounded-xl px-3 py-1.5 text-xs">
                        <option value="">-- Pilih Barang Inventaris --</option>
                        {invItems.map((i:any)=>(<option key={i.id} value={i.id}>{i.name} (Stok: {i.stock_total})</option>))}
                      </select>
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min={1} value={it.qty} onChange={e=>{const next=[...bookItems];next[idx]={...next[idx],qty:Number(e.target.value)};setBookItems(next);}} className="w-20 border rounded-xl px-3 py-1.5 text-xs text-center font-mono" placeholder="Qty"/>
                      <button onClick={()=>setBookItems(bookItems.filter((_,i)=>i!==idx))} className="text-rose-600 text-xs font-bold px-2">Hapus</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={()=>setShowBooking(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={createBooking} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Proses Booking</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">Kode</th>
              <th className="p-3">Jamaah</th>
              <th className="p-3">Paket</th>
              <th className="p-3">Batch / Jadwal</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Dibayar</th>
              <th className="p-3 text-right">Sisa</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {txList.map((t:any)=>(
              <tr key={t.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono text-slate-500 font-bold">{t.booking_code}</td>
                <td className="p-3 font-bold text-slate-900">{t.full_name}</td>
                <td className="p-3 text-slate-600">{t.package_name}</td>
                <td className="p-3 text-slate-600">
                  <span className="block text-[11px] font-bold text-slate-800">{t.batch_name || '-'}</span>
                  <span className="block text-[10px] text-slate-400 font-mono">{t.departure_date || ''}</span>
                </td>
                <td className="p-3 text-right font-mono font-bold text-slate-900">{fmtRp(t.total_amount)}</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-600">{fmtRp(t.paid_amount)}</td>
                <td className="p-3 text-right font-mono font-bold text-rose-600">{fmtRp(t.remaining_amount)}</td>
                <td className="p-3"><StatusBadge s={t.status}/></td>
                <td className="p-3 text-right">
                  <button onClick={()=>loadDetail(t.id)} className="text-indigo-600 hover:underline font-bold">Detail</button>
                </td>
              </tr>
            ))}
            {txList.length===0 && <tr><td colSpan={9} className="text-center py-8 text-slate-400">Belum ada transaksi pendaftaran.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== INVENTORY TAB ===================== */
function InventoryTab() {
  const [items, setItems] = useState<any[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [txList, setTxList] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    fetch('/api/admin/inventory').then(r=>r.json()).then(d=>{ if(d.success){setItems(d.items||[]);setHandovers(d.handovers||[]);} });
    fetch('/api/admin/transactions').then(r=>r.json()).then(d=>{ if(d.success) setTxList(d.transactions||[]); });
  };
  useEffect(()=>{load();},[]);

  const doHandover = async () => {
    if(!form.transaction_id||!form.item_id) return alert('Transaksi dan Barang wajib dipilih');
    const res = await fetch('/api/admin/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'HANDOVER',...form})});
    const d = await res.json(); (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error') : alert(d.message); if(d.success){setShowForm(false);setForm({});load();}
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={()=>{setForm({qty:1});setShowForm(true);}} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">+ Serah Terima Barang</button></div>
      {showForm && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-gray-800 mb-4">Form Serah Terima</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Transaksi / Jamaah</label>
            <select value={form.transaction_id||''} onChange={e=>setForm({...form,transaction_id:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih --</option>
              {txList.map((t:any)=>(<option key={t.id} value={t.id}>{t.booking_code} - {t.full_name}</option>))}
            </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Barang</label>
            <select value={form.item_id||''} onChange={e=>setForm({...form,item_id:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih --</option>
              {items.map((it:any)=>(<option key={it.id} value={it.id}>{it.name} (Stok: {it.stock_total})</option>))}
            </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Qty</label><input type="number" inputMode="numeric" pattern="[0-9]*" value={form.qty||1} onChange={e=>setForm({...form,qty:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"/></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label><input value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
          </div>
          <div className="mt-4 flex gap-2"><button onClick={doHandover} className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm">Serahkan</button><button onClick={()=>setShowForm(false)} className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm">Batal</button></div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <h3 className="font-bold text-gray-800 p-4 pb-0">Log Serah Terima</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left">
            <th className="p-3">Booking</th><th className="p-3">Jamaah</th><th className="p-3">Barang</th><th className="p-3">Qty</th><th className="p-3">Tanggal</th>
          </tr></thead>
          <tbody>
            {handovers.map((h:any,i:number)=>(<tr key={i} className="border-b hover:bg-gray-50">
              <td className="p-3 font-mono text-xs">{h.booking_code}</td><td className="p-3">{h.jamaah_name}</td>
              <td className="p-3">{h.item_name} ({h.item_code})</td><td className="p-3">{h.qty} {h.unit}</td>
              <td className="p-3 text-xs">{h.handed_over_at}</td>
            </tr>))}
            {handovers.length===0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">Belum ada serah terima</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}


/* ===================== MANIFEST TAB ===================== */

/* ===================== KELOLA STAF TAB (OWNER only) ===================== */
function KelolaStaf() {
  const [list, setList] = useState<any[]>([]);
  const [mode, setMode] = useState<'idle'|'add'|'edit'>('idle');
  const [form, setForm] = useState<any>({});

  const load = () => { fetch('/api/admin/users').then(r=>r.json()).then(d=>{ if(d.success) setList(d.users||[]); }); };
  useEffect(()=>{load();},[]);

  const save = async () => {
    const email = String(form.email || '').trim().toLowerCase();
    if (!form.name) return alert('Nama wajib diisi');
    if (!email) return alert('Email wajib diisi (dipakai untuk login)');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return alert('Format email tidak valid');
    if (mode === 'add' && !form.password) return alert('Password wajib diisi untuk staf baru');
    const action = mode === 'edit' ? 'UPDATE_USER' : 'CREATE_USER';
    const res = await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form, email, action})});
    const d = await res.json(); 
    if(d.success){
      alert('Berhasil menyimpan staf');
      setMode('idle');
      setForm({});
      load();
    } else {
      alert(d.message || 'Gagal menyimpan');
    }
  };

  const remove = async (id: number) => {
    if(!confirm('Hapus staf ini?')) return;
    const res = await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'DELETE_USER', id})});
    const d = await res.json(); 
    if(d.success) load(); 
    else alert(d.message);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900">Kelola Staf & Admin</h3>
          <p className="text-xs text-slate-500">Manajemen akun staf internal tour & travel.</p>
        </div>
        <button onClick={()=>{setForm({});setMode('add');}} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ Tambah Staf</button>
      </div>

      {mode !== 'idle' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">{mode==='edit'?'Edit Data Staf':'Tambah Staf Baru'}</h3>
              <button onClick={()=>setMode('idle')} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nama Lengkap *</label>
                <input type="text" value={form.name||''} onChange={e=>setForm({...form, name:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" placeholder="Nama lengkap..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email (untuk login) *</label>
                <input type="email" value={form.email||''} onChange={e=>setForm({...form, email:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" placeholder="nama@travel.com" autoComplete="off" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Password {mode==='edit' && '(Kosongkan jika tidak diubah)'}</label>
                <input type="password" value={form.password||''} onChange={e=>setForm({...form, password:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" placeholder="Password..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Role / Hak Akses *</label>
                <select value={form.role||'ADMIN'} onChange={e=>setForm({...form, role:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="ADMIN">ADMIN</option>
                  <option value="OWNER">OWNER</option>
                </select>
                <p className="text-[10px] text-slate-500 mt-1">Pemisahan izin per modul menyusul pada tahap RBAC.</p>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={()=>setMode('idle')} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={save} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Simpan Staf</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">Nama</th>
              <th className="p-3">Email</th>
              <th className="p-3">Role</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(u=>(
              <tr key={u.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-bold text-slate-900">{u.name}</td>
                <td className="p-3 font-mono text-slate-600">{u.email}</td>
                <td className="p-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${u.role==='OWNER'?'bg-indigo-50 text-indigo-700':'bg-slate-100 text-slate-700'}`}>{u.role}</span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={()=>{setForm(u);setMode('edit');}} className="text-indigo-600 hover:underline font-bold">Edit</button>
                  <button onClick={()=>remove(u.id)} className="text-rose-600 hover:underline font-bold">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== MASTER ROLE (MENU + IZIN) ===================== */
function KelolaIzinRole() {
  const [roles, setRoles] = useState<any[]>([]);
  const [perms, setPerms] = useState<any[]>([]);
  const [matriks, setMatriks] = useState<Record<string, string[]>>({});
  const [menuTambahan, setMenuTambahan] = useState<Record<string, string[]>>({});
  const [katalog, setKatalog] = useState<any[]>([]);
  const [sensitif, setSensitif] = useState<string[]>([]);
  const [userPerRole, setUserPerRole] = useState<Record<string, number>>({});
  const [aktif, setAktif] = useState<string>('');
  const [draft, setDraft] = useState<string[]>([]);
  const [draftMenu, setDraftMenu] = useState<string[]>([]);
  const [tab, setTab] = useState<'menu' | 'izin'>('menu');
  const [loading, setLoading] = useState(false);
  const [simpan, setSimpan] = useState<'idle'|'saving'>('idle');
  const [orphan, setOrphan] = useState<any[]>([]);
  const [modal, setModal] = useState<null | 'tambah' | 'ubah'>(null);
  const [kodeBaru, setKodeBaru] = useState('');
  const [namaBaru, setNamaBaru] = useState('');
  const [namaEdit, setNamaEdit] = useState('');

  const load = () => {
    setLoading(true);
    fetch('/api/admin/roles').then(r => r.json()).then(d => {
      if (d.success) {
        setRoles(d.roles || []);
        setPerms(d.permissions || []);
        setMatriks(d.matriks || {});
        setMenuTambahan(d.menuTambahan || {});
        setKatalog(d.katalog || []);
        setSensitif(d.sensitif || []);
        setUserPerRole(d.userPerRole || {});
        const r0 = (d.roles || [])[0];
        if (r0 && !aktif) {
          setAktif(r0.code);
          setDraft(d.matriks?.[r0.code] || []);
          setDraftMenu(d.menuTambahan?.[r0.code] || []);
        }
      }
      setLoading(false);
    }).catch(() => setLoading(false));
    muatOrphan();
  };
  useEffect(() => { load(); }, []);

  const pilihRole = (code: string) => {
    setAktif(code);
    setDraft(matriks[code] || []);
    setDraftMenu(menuTambahan[code] || []);
  };

  const toggle = (code: string) => {
    setDraft(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]);
  };
  const toggleMenu = (code: string) => {
    setDraftMenu(prev => prev.includes(code) ? prev.filter(x => x !== code) : [...prev, code]);
  };
  const toggleModul = (modul: string, nyala: boolean) => {
    const kodeModul = perms.filter(p => p.module === modul).map(p => p.code);
    setDraft(prev => nyala
      ? Array.from(new Set([...prev, ...kodeModul]))
      : prev.filter(x => !kodeModul.includes(x)));
  };

  const simpanIzin = async () => {
    setSimpan('saving');
    const res = await fetch('/api/admin/roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SET_PERMISSIONS', role: aktif, permissions: draft }),
    });
    const d = await res.json();
    setSimpan('idle');
    if (d.success) {
      setMatriks(prev => ({ ...prev, [aktif]: d.permissions || draft }));
      (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, 'success') : alert(d.message);
    } else {
      (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, 'error') : alert(d.message);
    }
  };

  const simpanMenu = async () => {
    setSimpan('saving');
    const res = await fetch('/api/admin/roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SET_MENUS', role: aktif, menus: draftMenu }),
    });
    const d = await res.json();
    setSimpan('idle');
    if (d.success) {
      setMenuTambahan(prev => ({ ...prev, [aktif]: d.menus || draftMenu }));
      (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, 'success') : alert(d.message);
    } else {
      (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, 'error') : alert(d.message);
    }
  };

  const muatOrphan = () => {
    fetch('/api/admin/roles/orphan').then(r => r.json())
      .then(d => { if (d.success) setOrphan(d.users || []); }).catch(() => {});
  };
  useEffect(() => { muatOrphan(); }, []);

  const toast = (msg: string, jenis: 'success' | 'error' = 'success') => {
    (window as any).__showAdminToast
      ? (window as any).__showAdminToast(msg, jenis)
      : alert(msg);
  };

  const tambahRole = async () => {
    setSimpan('saving');
    const res = await fetch('/api/admin/roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CREATE_ROLE', code: kodeBaru, name: namaBaru }),
    });
    const d = await res.json();
    setSimpan('idle');
    if (d.success) {
      setModal(null); setKodeBaru(''); setNamaBaru('');
      load(); toast(d.message);
    } else toast(d.message, 'error');
  };

  const ubahRole = async () => {
    setSimpan('saving');
    const res = await fetch('/api/admin/roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'UPDATE_ROLE', code: aktif, name: namaEdit }),
    });
    const d = await res.json();
    setSimpan('idle');
    if (d.success) { setModal(null); load(); toast(d.message); }
    else toast(d.message, 'error');
  };

  const hapusRole = async (code: string) => {
    if (!confirm(`Hapus role ${code}? Tindakan ini tidak bisa dibatalkan.`)) return;
    setSimpan('saving');
    const res = await fetch('/api/admin/roles', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_ROLE', code }),
    });
    const d = await res.json();
    setSimpan('idle');
    if (d.success) { setAktif(''); load(); muatOrphan(); toast(d.message); }
    else toast(d.message, 'error');
  };

  const perbaikiOrphan = async (userId: number, role: string) => {
    const res = await fetch('/api/admin/roles/orphan', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, role }),
    });
    const d = await res.json();
    if (d.success) { load(); muatOrphan(); toast(d.message); }
    else toast(d.message, 'error');
  };

  const roleAktif = roles.find(r => r.code === aktif);
  const modulUnik = Array.from(new Set(perms.map(p => p.module)));
  const izinRole = matriks[aktif] || [];
  const berubahIzin = JSON.stringify(izinRole.slice().sort()) !== JSON.stringify(draft.slice().sort());
  const berubahMenu = JSON.stringify((menuTambahan[aktif] || []).slice().sort()) !== JSON.stringify(draftMenu.slice().sort());
  const kunciOwner = aktif === 'OWNER';
  const grupMenu = Array.from(new Set(katalog.map((m: any) => m.group)));

  /** otomatis = menu muncul karena izin dasarnya sudah dimiliki role ini */
  const otomatis = (m: any) => !!(m.perm && izinRole.includes(m.perm));

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
        <h3 className="text-base font-black text-slate-900">Master Role</h3>
        <p className="text-xs text-slate-500 mt-1">
          Satu pengguna memegang satu role. Untuk setiap role, tentukan <b>menu apa yang tampil</b> dan
          <b> tindakan apa yang boleh dilakukan</b>. Menu bisa ditambah di luar izin dasar
          (mis. role Keuangan tetap diberi menu Kasir), tetapi menu pengaturan/akses tidak bisa dibuka lewat pengecualian.
        </p>
        <div className="flex flex-wrap items-center gap-2 mt-4">
          <button onClick={() => setModal('tambah')}
            className="px-3.5 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800">
            + Tambah Role
          </button>
          {roleAktif && !roleAktif.is_system && (
            <>
              <button onClick={() => { setNamaEdit(roleAktif.name); setModal('ubah'); }}
                className="px-3.5 py-2 text-xs font-bold text-slate-700 rounded-xl border border-slate-200 hover:bg-slate-50">
                Ubah Nama
              </button>
              <button onClick={() => hapusRole(roleAktif.code)}
                className="px-3.5 py-2 text-xs font-bold text-red-600 rounded-xl border border-red-200 hover:bg-red-50">
                Hapus Role
              </button>
            </>
          )}
          {roleAktif && !!roleAktif.is_system && (
            <span className="text-[11px] text-slate-400">Role sistem — tidak bisa diubah namanya atau dihapus</span>
          )}
        </div>
      </div>

      {orphan.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-sm font-black text-amber-900">
            {orphan.length} pengguna memakai role yang tidak terdaftar
          </p>
          <p className="text-xs text-amber-800 mt-1">
            Mereka <b>tidak punya izin apa pun</b> (default tolak) sampai role-nya diperbaiki.
          </p>
          <div className="mt-3 space-y-1.5">
            {orphan.map((u: any) => (
              <div key={u.id} className="flex flex-wrap items-center justify-between gap-2 bg-white/70 rounded-xl px-3 py-2">
                <span className="text-xs text-slate-700">
                  {u.name} <span className="text-slate-400">· {u.email}</span>{' '}
                  <span className="font-mono text-[10px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded">{u.role}</span>
                </span>
                <span className="flex items-center gap-1.5">
                  <select defaultValue="" onChange={(e) => e.target.value && perbaikiOrphan(u.id, e.target.value)}
                    className="text-[11px] border border-slate-200 rounded-lg px-2 py-1 bg-white">
                    <option value="">Pilih role…</option>
                    {roles.map((r: any) => <option key={r.code} value={r.code}>{r.code}</option>)}
                  </select>
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {modal && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white rounded-2xl w-full max-w-md p-5 shadow-xl" onClick={(e) => e.stopPropagation()}>
            <h4 className="text-sm font-black text-slate-900">
              {modal === 'tambah' ? 'Tambah Role Baru' : `Ubah Nama Role ${aktif}`}
            </h4>
            <p className="text-[11px] text-slate-500 mt-1">
              {modal === 'tambah'
                ? 'Role baru mulai tanpa izin. Centang izinnya setelah role dibuat.'
                : 'Kode role tidak berubah — hanya label yang ditampilkan.'}
            </p>

            {modal === 'tambah' && (
              <div className="mt-3">
                <label className="text-[11px] font-bold text-slate-600">Kode Role</label>
                <input value={kodeBaru} onChange={(e) => setKodeBaru(e.target.value.toUpperCase())}
                  placeholder="mis. GUDANG"
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-xl font-mono" />
              </div>
            )}
            <div className="mt-3">
              <label className="text-[11px] font-bold text-slate-600">Nama Tampilan</label>
              <input value={modal === 'tambah' ? namaBaru : namaEdit}
                onChange={(e) => modal === 'tambah' ? setNamaBaru(e.target.value) : setNamaEdit(e.target.value)}
                placeholder="mis. Petugas Gudang"
                className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-xl" />
            </div>

            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setModal(null)}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-100">Batal</button>
              <button onClick={modal === 'tambah' ? tambahRole : ubahRole} disabled={simpan === 'saving'}
                className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-40">
                {simpan === 'saving' ? 'Menyimpan…' : 'Simpan'}
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-slate-400 text-sm">Memuat…</div>
      ) : (
        <div className="grid lg:grid-cols-[260px_1fr] gap-4">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-2 shadow-xs h-fit">
            {roles.map(r => {
              const jmlIzin = (matriks[r.code] || []).length;
              const jmlMenu = (menuTambahan[r.code] || []).length;
              const pilih = aktif === r.code;
              return (
                <button key={r.code} onClick={() => pilihRole(r.code)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl mb-1 transition ${pilih ? 'bg-slate-900 text-white' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-xs font-bold ${pilih ? 'text-white' : 'text-slate-900'}`}>{r.code}</span>
                    <span className={`text-[10px] font-mono ${pilih ? 'text-slate-300' : 'text-slate-500'}`}>{jmlIzin}/{perms.length}</span>
                  </div>
                  <div className={`text-[10px] truncate ${pilih ? 'text-slate-300' : 'text-slate-500'}`}>
                    {r.name} · {userPerRole[r.code] || 0} user{jmlMenu ? ` · +${jmlMenu} menu` : ''}
                  </div>
                </button>
              );
            })}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 p-4 border-b border-slate-100">
              <div>
                <p className="text-sm font-black text-slate-900">{aktif || '-'}</p>
                <p className="text-[11px] text-slate-500">
                  {roleAktif?.name || ''} · {userPerRole[aktif] || 0} pengguna · {izinRole.length}/{perms.length} izin · {draftMenu.length} menu tambahan
                </p>
              </div>
              <div className="flex items-center gap-2">
                {((tab === 'izin' && berubahIzin) || (tab === 'menu' && berubahMenu)) && (
                  <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded-lg">Belum disimpan</span>
                )}
                <button onClick={() => { setDraft(izinRole); setDraftMenu(menuTambahan[aktif] || []); }}
                  className="px-3 py-2 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-100">Reset</button>
                <button
                  onClick={tab === 'izin' ? simpanIzin : simpanMenu}
                  disabled={(tab === 'izin' ? (!berubahIzin || kunciOwner) : !berubahMenu) || simpan === 'saving'}
                  className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-40">
                  {simpan === 'saving' ? 'Menyimpan…' : (tab === 'izin' ? 'Simpan Izin' : 'Simpan Menu')}
                </button>
              </div>
            </div>

            <div className="flex gap-1 px-4 pt-3">
              {(['menu', 'izin'] as const).map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${tab === t ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {t === 'menu' ? 'Menu yang Tampil' : 'Izin / Tindakan'}
                </button>
              ))}
            </div>

            {kunciOwner && tab === 'izin' && (
              <div className="px-4 py-2.5 mt-3 bg-slate-50 border-y border-slate-100 text-[11px] text-slate-600">
                Role OWNER selalu memegang seluruh izin — pengaman agar selalu ada yang bisa mengelola sistem.
              </div>
            )}

            {tab === 'menu' ? (
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {grupMenu.map(g => {
                  const baris = katalog.filter((m: any) => m.group === g);
                  return (
                    <div key={g} className="border border-slate-100 rounded-xl">
                      <div className="px-3 py-2 bg-slate-50/70 rounded-t-xl">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">{g}</span>
                      </div>
                      <div className="p-3 space-y-1">
                        {baris.map((m: any) => {
                          const auto = otomatis(m);
                          const khusus = draftMenu.includes(m.code);
                          const sensitifMenu = sensitif.includes(m.code);
                          const aktifkan = auto || khusus;
                          return (
                            <label key={m.code} className={`flex items-start gap-2 py-1 ${sensitifMenu ? 'opacity-60' : 'cursor-pointer'}`}>
                              <input type="checkbox" checked={aktifkan}
                                disabled={auto || sensitifMenu}
                                onChange={() => toggleMenu(m.code)}
                                className="mt-0.5 w-3.5 h-3.5 accent-slate-900" />
                              <span className="min-w-0 flex-1">
                                <span className="block text-xs text-slate-800">{m.label}</span>
                                <span className="block text-[10px] font-mono text-slate-400">
                                  {m.code}
                                  {auto && m.perm ? ` · otomatis dari izin ${m.perm}` : ''}
                                  {!auto && khusus ? ' · ditambahkan manual' : ''}
                                  {sensitifMenu ? ' · hanya lewat izin' : ''}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
                {modulUnik.map(modul => {
                  const baris = perms.filter(p => p.module === modul);
                  const semuaNyala = baris.every(p => draft.includes(p.code));
                  return (
                    <div key={modul} className="border border-slate-100 rounded-xl">
                      <label className="flex items-center justify-between gap-3 px-3 py-2 bg-slate-50/70 rounded-t-xl cursor-pointer">
                        <span className="text-[11px] font-black uppercase tracking-wider text-slate-600">{modul}</span>
                        <span className="flex items-center gap-2 text-[10px] text-slate-500">
                          {baris.filter(p => draft.includes(p.code)).length}/{baris.length}
                          <input type="checkbox" checked={semuaNyala} disabled={kunciOwner}
                            onChange={e => toggleModul(modul, e.target.checked)}
                            className="w-3.5 h-3.5 accent-slate-900" />
                        </span>
                      </label>
                      <div className="grid sm:grid-cols-2 gap-x-4 gap-y-1 p-3">
                        {baris.map(p => (
                          <label key={p.code} className="flex items-start gap-2 py-1 cursor-pointer group">
                            <input type="checkbox" checked={draft.includes(p.code)} disabled={kunciOwner}
                              onChange={() => toggle(p.code)}
                              className="mt-0.5 w-3.5 h-3.5 accent-slate-900" />
                            <span className="min-w-0">
                              <span className="block text-xs text-slate-800 group-hover:text-slate-950">{p.label}</span>
                              <span className="block text-[10px] font-mono text-slate-400">{p.code}</span>
                            </span>
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/* ===================== LOG AKTIVITAS ===================== */
function LogAktivitas() {
  const [rows, setRows] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [modul, setModul] = useState<string[]>([]);
  const [aksi, setAksi] = useState<string[]>([]);
  const [fModul, setFModul] = useState('ALL');
  const [fAksi, setFAksi] = useState('ALL');
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(false);

  const load = () => {
    setLoading(true);
    const p = new URLSearchParams({ module: fModul, action: fAksi, limit: '200' });
    if (q) p.set('q', q);
    fetch('/api/admin/audit?' + p.toString()).then(r => r.json()).then(d => {
      if (d.success) { setRows(d.rows || []); setTotal(d.total || 0); setModul(d.modul || []); setAksi(d.aksi || []); }
      setLoading(false);
    }).catch(() => setLoading(false));
  };
  useEffect(() => { load(); }, [fModul, fAksi]);

  const badge = (a: string) => a === 'DELETE' ? 'bg-rose-50 text-rose-700 border-rose-200'
    : a === 'CREATE' ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
    : a === 'UPDATE' ? 'bg-amber-50 text-amber-700 border-amber-200'
    : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Modul</label>
          <select value={fModul} onChange={e => setFModul(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <option value="ALL">Semua</option>
            {modul.map(m => <option key={m} value={m}>{m}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Aksi</label>
          <select value={fAksi} onChange={e => setFAksi(e.target.value)} className="border border-slate-200 rounded-xl px-3 py-2 text-xs">
            <option value="ALL">Semua</option>
            {aksi.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[180px]">
          <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1">Cari</label>
          <input value={q} onChange={e => setQ(e.target.value)} onKeyDown={e => e.key === 'Enter' && load()}
            placeholder="email, id record, catatan…" className="w-full border border-slate-200 rounded-xl px-3 py-2 text-xs" />
        </div>
        <button onClick={load} className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800">Cari</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
          <p className="text-sm font-black text-slate-900">Log Aktivitas</p>
          <p className="text-[11px] text-slate-500">{total} catatan</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
                <th className="p-3 whitespace-nowrap">Waktu</th>
                <th className="p-3">Aksi</th>
                <th className="p-3">Modul</th>
                <th className="p-3">Record</th>
                <th className="p-3">Pelaku</th>
                <th className="p-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map(r => (
                <tr key={r.id} className="hover:bg-slate-50 transition align-top">
                  <td className="p-3 font-mono text-slate-500 whitespace-nowrap">{r.created_at}</td>
                  <td className="p-3">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-black border ${badge(r.action)}`}>{r.action}</span>
                  </td>
                  <td className="p-3 font-bold text-slate-800">{r.module}</td>
                  <td className="p-3 font-mono text-slate-600">{r.record_id || '—'}</td>
                  <td className="p-3 text-slate-600">{r.user_email || '—'}</td>
                  <td className="p-3 text-slate-500 max-w-[320px] truncate" title={r.notes || ''}>{r.notes || '—'}</td>
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr><td colSpan={6} className="text-center py-10 text-slate-400">Belum ada aktivitas tercatat.</td></tr>
              )}
              {loading && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Memuat…</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function PembayaranTab() {
  const [kode, setKode] = useState('');
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentPending, setRecentPending] = useState<any[]>([]);
  
  // Centered Modal State for Verification
  const [selectedPayment, setSelectedPayment] = useState<any>(null);
  const [rejectNotes, setRejectNotes] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const loadPending = async () => {
    try {
      const r = await fetch('/api/admin/transactions');
      const d = await r.json();
      if (d.success) {
        const pendingList = (d.transactions || []).filter((t: any) => t.status === 'DP' || t.status === 'PENDING').slice(0, 15);
        setRecentPending(pendingList);
      }
    } catch {}
  };

  useEffect(() => { loadPending(); }, []);

  const load = async (booking: string) => {
    if (!booking) return;
    setLoading(true); setMsg('');
    try {
      const r = await fetch('/api/payments?booking_code=' + encodeURIComponent(booking));
      const d = await r.json();
      if (d.success) setData(d);
      else { setData(null); setMsg(d.message || 'Booking tidak ditemukan'); }
    } catch (e: any) { setMsg(e.message); }
    setLoading(false);
  };

  const handleVerifyAction = async (action: 'APPROVE' | 'REJECT') => {
    if (!selectedPayment) return;
    setActionLoading(true);
    try {
      const r = await fetch('/api/payments/verify', {
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          payment_id: selectedPayment.id, 
          action, 
          notes: action === 'REJECT' ? rejectNotes : 'Pembayaran disetujui & diverifikasi' 
        }),
      });
      const d = await r.json();
      if (d.success) {
        (window as any).__showAdminToast?.(d.message, 'success');
        setSelectedPayment(null);
        setRejectNotes('');
        if (kode) load(kode);
        loadPending();
      } else {
        alert(d.message || 'Gagal memproses verifikasi');
      }
    } catch (e: any) {
      alert(e.message || 'Terjadi kesalahan jaringan');
    }
    setActionLoading(false);
  };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Search Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-900"></span> Verifikasi Pembayaran & Transfer Jamaah
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Periksa bukti transfer dan lakukan verifikasi pembayaran dengan standar Apple/Linear minimalist.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={kode}
            onChange={e => setKode(e.target.value.toUpperCase())}
            placeholder="Masukkan Kode Booking (Cth: UMR-2610-4821)"
            className="flex-1 border border-slate-300 rounded-xl px-4 py-2.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
            onKeyDown={e => e.key === 'Enter' && load(kode)}
          />
          <button
            onClick={() => load(kode)}
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-xs disabled:opacity-50 transition shadow-xs"
          >
            {loading ? 'Mencari...' : 'Cari Booking'}
          </button>
        </div>
        {msg && <p className="text-xs mt-2 font-bold text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">{msg}</p>}
      </div>

      {/* Booking Details Card */}
      {data && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-wrap justify-between items-start gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md font-mono">Booking Code</span>
              <h2 className="text-lg font-black text-slate-900 mt-1">{data.booking.booking_code}</h2>
              <p className="text-xs font-bold text-slate-700 mt-0.5">{data.booking.full_name} <span className="font-normal text-slate-500">(NIK: {data.booking.nik})</span></p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">Status Pembayaran</span>
              <p className="text-sm font-black text-slate-900 mt-1"><StatusBadge s={data.booking.status}/></p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/60">
            <div><span className="text-slate-500 font-medium">Paket Perjalanan:</span><p className="font-bold text-slate-900 mt-0.5">{data.booking.package_name}</p></div>
            <div><span className="text-slate-500 font-medium">Total Biaya:</span><p className="font-bold font-mono text-slate-900 mt-0.5">{fmtRp(data.booking.total_amount)}</p></div>
            <div><span className="text-slate-500 font-medium">Sisa Tagihan:</span><p className="font-bold font-mono text-rose-600 mt-0.5">{fmtRp(data.booking.remaining_amount)}</p></div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Riwayat & Bukti Pembayaran</h4>
            <div className="space-y-3">
              {(data.payments || []).map((pay: any) => (
                <div key={pay.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-4 shadow-xs hover:border-slate-300 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{pay.receipt_number}</span>
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-black ${(pay.status === 'VERIFIED' || pay.status === 'APPROVED') ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : pay.status === 'REJECTED' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'}`}>
                        {pay.status === 'APPROVED' ? 'APPROVED' : pay.status}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">{pay.payment_phase} — <span className="font-mono text-emerald-600">{fmtRp(pay.amount)}</span></p>
                    <p className="text-[11px] text-slate-500">Metode: {pay.payment_type} {pay.bank_name ? '(' + pay.bank_name + ')' : ''} | Tanggal: {pay.created_at}</p>
                    {pay.proof_url && (
                      <a href={pay.proof_url} target="_blank" rel="noreferrer" className="inline-block mt-1 text-xs font-bold text-indigo-600 hover:underline">
                        📄 Lihat Bukti Transfer / Kwitansi &rarr;
                      </a>
                    )}
                  </div>

                  {pay.status === 'PENDING' && (
                    <button 
                      onClick={() => setSelectedPayment(pay)} 
                      className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5"
                    >
                      <span>Verifikasi Pembayaran</span>
                    </button>
                  )}
                </div>
              ))}
              {(!data.payments || data.payments.length === 0) && (
                <p className="text-xs text-slate-400 py-6 text-center">Belum ada riwayat pembayaran untuk booking ini.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Pending Verification Quick List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Antrean Pembayaran Pending / Belum Lunas</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
                <th className="p-3">Kode Booking</th>
                <th className="p-3">Jamaah</th>
                <th className="p-3">Paket</th>
                <th className="p-3 text-right">Sisa Tagihan</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentPending.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono text-slate-500 font-bold">{t.booking_code}</td>
                  <td className="p-3 font-bold text-slate-900">{t.full_name}</td>
                  <td className="p-3 text-slate-600">{t.package_name}</td>
                  <td className="p-3 text-right font-mono font-bold text-rose-600">{fmtRp(t.remaining_amount)}</td>
                  <td className="p-3"><StatusBadge s={t.status}/></td>
                  <td className="p-3 text-right">
                    <button onClick={() => { setKode(t.booking_code); load(t.booking_code); }} className="text-indigo-600 hover:underline font-bold">Pilih & Periksa</button>
                  </td>
                </tr>
              ))}
              {recentPending.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Tidak ada antrean pembayaran pending.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Centered Modal Pop-up for Payment Verification */}
      {selectedPayment && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900">Verifikasi Pembayaran Jamaah</h3>
                <p className="text-xs text-slate-500 font-mono mt-0.5">Kwitansi: {selectedPayment.receipt_number}</p>
              </div>
              <button onClick={() => setSelectedPayment(null)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
            </div>

            <div className="space-y-4 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200/60">
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500 font-medium">Nominal Pembayaran:</span>
                <span className="font-mono font-black text-emerald-600 text-sm">{fmtRp(selectedPayment.amount)}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500 font-medium">Tahapan / Jenis:</span>
                <span className="font-bold text-slate-800">{selectedPayment.payment_phase}</span>
              </div>
              <div className="flex justify-between py-1 border-b border-slate-200/50">
                <span className="text-slate-500 font-medium">Metode Transfer:</span>
                <span className="font-bold text-slate-800">{selectedPayment.payment_type} {selectedPayment.bank_name ? '(' + selectedPayment.bank_name + ')' : ''}</span>
              </div>
              <div className="flex justify-between py-1">
                <span className="text-slate-500 font-medium">Tanggal Upload:</span>
                <span className="font-mono text-slate-800">{selectedPayment.created_at}</span>
              </div>
              {selectedPayment.proof_url && (
                <div className="pt-2 border-t border-slate-200/50 text-center">
                  <a href={selectedPayment.proof_url} target="_blank" rel="noreferrer" className="inline-block bg-white border border-slate-300 text-indigo-600 hover:bg-slate-100 font-bold px-4 py-2 rounded-xl text-xs transition shadow-xs">
                    🔍 Buka & Perbesar Bukti Transfer di Tab Baru
                  </a>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Catatan Penolakan (Opsional / Wajib jika Ditolak)</label>
              <input
                type="text"
                value={rejectNotes}
                onChange={e => setRejectNotes(e.target.value)}
                placeholder="Cth: Bukti transfer tidak valid / nominal tidak sesuai"
                className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
              />
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-3">
              <button
                onClick={() => handleVerifyAction('REJECT')}
                disabled={actionLoading}
                className="px-5 py-2.5 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold text-xs transition disabled:opacity-50"
              >
                {actionLoading ? 'Memproses...' : 'Tolak Pembayaran'}
              </button>
              <button
                onClick={() => handleVerifyAction('APPROVE')}
                disabled={actionLoading}
                className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition shadow-xs disabled:opacity-50 flex items-center gap-1.5"
              >
                {actionLoading ? 'Memproses...' : '✓ Setujui Pembayaran'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


/* ===================== PENGATURAN PROFIL TRAVEL ===================== */
function PengaturanTab() {
  const [profile, setProfile] = useState<any>({});
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBank, setNewBank] = useState({ bank_name: '', account_number: '', account_holder: '' });

  const loadData = useCallback(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setProfile(d.profile || {});
          setBankAccounts(d.bankAccounts || []);
        }
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_PROFILE', profile }),
      });
      const d = await res.json();
      if ((window as any).__showAdminToast) {
        (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error');
      }
      if (d.success) loadData();
    } catch {
      if ((window as any).__showAdminToast) (window as any).__showAdminToast('Gagal menyimpan profil', 'error');
    }
    setLoading(false);
  };

  const addBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBank.bank_name || !newBank.account_number || !newBank.account_holder) {
      if ((window as any).__showAdminToast) (window as any).__showAdminToast('Lengkapi data bank', 'error');
      return;
    }
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ADD_BANK', bank: newBank }),
    });
    const d = await res.json();
    if ((window as any).__showAdminToast) (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error');
    if (d.success) {
      setNewBank({ bank_name: '', account_number: '', account_holder: '' });
      setShowAddBankModal(false);
      loadData();
    }
  };

  const deleteBank = async (id: number) => {
    if (!confirm('Hapus rekening ini?')) return;
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_BANK', id }),
    });
    const d = await res.json();
    if ((window as any).__showAdminToast) (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error');
    if (d.success) loadData();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Profile Form */}
      <form onSubmit={saveProfile} className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-900"></span> Identitas Resmi & Kop Cetak Dokumen
            </h3>
            <p className="text-xs text-slate-500">Informasi ini otomatis tampil pada header Kwitansi, Manifest, Label Koper, dan Laporan.</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition disabled:opacity-50"
          >
            {loading ? '...' : 'Simpan'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nama Brand Travel *</label>
            <input
              value={profile.company_name || ''}
              onChange={e => setProfile({ ...profile, company_name: e.target.value })}
              placeholder="Contoh: Al-Barakah Tour & Travel"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nama Legalitas PT / CV</label>
            <input
              value={profile.legal_name || ''}
              onChange={e => setProfile({ ...profile, legal_name: e.target.value })}
              placeholder="Contoh: PT. Al-Barakah Mandiri Utama"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">No. Izin PPIU / Kemenag *</label>
            <input
              value={profile.ppiu_number || ''}
              onChange={e => setProfile({ ...profile, ppiu_number: e.target.value })}
              placeholder="Contoh: Izin Kemenag No. 123/PPIU/2024"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nama Direktur / Pimpinan *</label>
            <input
              value={profile.director_name || ''}
              onChange={e => setProfile({ ...profile, director_name: e.target.value })}
              placeholder="Contoh: H. Ahmad Fauzi"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nomor Telepon / WhatsApp</label>
            <input
              value={profile.phone || ''}
              onChange={e => setProfile({ ...profile, phone: e.target.value })}
              placeholder="Contoh: 081234567890"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email Resmi</label>
            <input
              type="email"
              value={profile.email || ''}
              onChange={e => setProfile({ ...profile, email: e.target.value })}
              placeholder="info@travelumroh.com"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Alamat Kantor Pusat</label>
            <textarea
              rows={2}
              value={profile.address || ''}
              onChange={e => setProfile({ ...profile, address: e.target.value })}
              placeholder="Jalan Raya Umroh No. 45, Jakarta Selatan"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>
        </div>
      </form>

      {/* Bank Accounts Section */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Rekening Bank Pembayaran Jamaah
            </h3>
            <p className="text-xs text-slate-500">Daftar rekening tujuan transfer yang akan tampil pada halaman pembayaran & kwitansi.</p>
          </div>
          <button
            onClick={() => setShowAddBankModal(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5"
          >
            <span>+ Tambah Rekening</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bankAccounts.map((b: any) => (
            <div key={b.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-xs">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-800">{b.bank_name}</span>
                  <button onClick={() => deleteBank(b.id)} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg text-xs font-bold transition">
                    Hapus
                  </button>
                </div>
                <p className="font-mono text-base font-black text-slate-900 mt-3">{b.account_number}</p>
                <p className="text-xs font-bold text-slate-600 mt-0.5">a.n. {b.account_holder}</p>
              </div>
            </div>
          ))}
          {bankAccounts.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400 text-xs">Belum ada rekening bank terdaftar.</div>
          )}
        </div>
      </div>

      {/* Add Bank Centered Modal Pop-up */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900">Tambah Rekening Bank Baru</h3>
              <button onClick={() => setShowAddBankModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
            </div>
            <form onSubmit={addBankAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Bank (Cth: BCA / Mandiri / BSI)</label>
                <input
                  type="text"
                  value={newBank.bank_name}
                  onChange={e => setNewBank({ ...newBank, bank_name: e.target.value })}
                  placeholder="BCA / Mandiri / BSI"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor Rekening</label>
                <input
                  type="text"
                  value={newBank.account_number}
                  onChange={e => setNewBank({ ...newBank, account_number: e.target.value })}
                  placeholder="1234567890"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Atas Nama (Pemilik Rekening)</label>
                <input
                  type="text"
                  value={newBank.account_holder}
                  onChange={e => setNewBank({ ...newBank, account_holder: e.target.value })}
                  placeholder="PT. Travel Umroh"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  required
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 rounded-xl transition shadow-xs"
                >
                  Simpan Rekening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


/* ===================== JURNAL BUKU BESAR ===================== */

/* ===================== MUTASI STOK GUDANG ===================== */

/* ===================== JURNAL UMUM TAB ===================== */

/* ===================== BEBAN OPERASIONAL TAB ===================== */
function ExpensesTab() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [coaList, setCoaList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ expense_date: hariIniWib(), coa_account_id: '', amount: '', description: '' });

  const loadData = () => {
    fetch('/api/admin/financial?period=ALL').then(r => r.json()).then(d => {
      if (d.success) {
        setExpenses(d.expensesList || []);
        setCoaList(d.coaList || []);
      }
    });
  };

  useEffect(() => { loadData(); }, []);

  const saveExpense = () => {
    if (!form.coa_account_id || !form.amount) {
      alert('Akun Beban dan Jumlah wajib diisi!');
      return;
    }
    fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CREATE_EXPENSE', ...form })
    }).then(r => r.json()).then(d => {
      if (d.success) {
        alert('Beban operasional berhasil dicatat!');
        setShowModal(false);
        setForm({ expense_date: hariIniWib(), coa_account_id: '', amount: '', description: '' });
        loadData();
      } else {
        alert(d.message || 'Gagal mencatat beban');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900">Beban Operasional (Expenses)</h3>
          <p className="text-xs text-slate-500">Pencatatan pengeluaran dan biaya operasional travel.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ Catat Beban Baru</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">Tanggal</th>
              <th className="p-3">Akun Beban</th>
              <th className="p-3 text-right">Jumlah (Rp)</th>
              <th className="p-3">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map((e:any)=>(
              <tr key={e.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono text-slate-500">{e.expense_date}</td>
                <td className="p-3 font-bold text-slate-900">{e.coa_code} - {e.coa_name}</td>
                <td className="p-3 text-right font-mono font-bold text-rose-600">{fmtRp(e.amount)}</td>
                <td className="p-3 text-slate-600">{e.description}</td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">Belum ada data beban operasional.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Catat Beban Operasional Baru</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tanggal *</label>
                <input type="date" value={form.expense_date} onChange={e=>setForm({...form, expense_date:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Pilih Akun Beban (COA) *</label>
                <select value={form.coa_account_id} onChange={e=>setForm({...form, coa_account_id:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="">-- Pilih Akun Beban --</option>
                  {coaList.map((c:any)=>(<option key={c.id} value={c.id}>[{c.coa_code}] {c.coa_name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Jumlah (Rp) *</label>
                <input type="number" inputMode="numeric" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs font-mono" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Keterangan / Keperluan</label>
                <input value={form.description} onChange={e=>setForm({...form, description:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" placeholder="Contoh: Pembayaran listrik kantor..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={saveExpense} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Simpan Beban</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function AdminDashboard() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((curr) => (curr?.msg === msg ? null : curr));
    }, 4000);
  };

  useEffect(() => {
    // Expose toast helper for child components
    (window as any).__showAdminToast = showToast;
  }, []);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_active_tab');
      if (saved) return saved as Tab;
    }
    return 'dashboard';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_active_tab', activeTab);
    }
  }, [activeTab]);
  const [sideOpen, setSideOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Master Data': true,
    'Transaksi & Keuangan': true,
    'Operasional & Jamaah': true,
  });
  const [user, setUser] = useState<any>(null);
  const [perms, setPerms] = useState<string[]>([]);
  // Daftar menu yang boleh tampil, diputuskan server (izin + pengecualian per role).
  const [menuAktif, setMenuAktif] = useState<string[]>([]);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('admin_user');
    if (raw) setUser(JSON.parse(raw));
  }, []);

  // Dipakai layar "wajib ganti password": akses ditahan sampai password diganti.
  const [wajibGanti, setWajibGanti] = useState(false);
  const [sandi1, setSandi1] = useState('');
  const [sandi2, setSandi2] = useState('');
  const [pesanSandi, setPesanSandi] = useState('');
  const [simpanSandi, setSimpanSandi] = useState(false);

  useEffect(() => {
    if (!user) return;
    fetch('/api/admin/staff/me')
      .then(async (r) => {
        if (r.status === 401) {
          localStorage.removeItem('admin_user');
          window.location.href = '/admin/login';
          return;
        }
        // Sumber kebenaran akses = permissions[] dari server, bukan nama role.
        const d = await r.json().catch(() => null);
        if (d?.success) {
          setPerms(Array.isArray(d.permissions) ? d.permissions : []);
          setMenuAktif(Array.isArray(d.menu) ? d.menu : []);
          if (d.user?.must_change_password) setWajibGanti(true);
          if (d.user) setUser((u: any) => ({ ...u, ...d.user }));
        }
      })
      .catch(() => {});
  }, [user?.id]);

  const gantiSandiBawaan = async () => {
    setPesanSandi('');
    if (sandi1.length < 8) { setPesanSandi('Password minimal 8 karakter.'); return; }
    if (sandi1 !== sandi2) { setPesanSandi('Konfirmasi password tidak sama.'); return; }
    setSimpanSandi(true);
    try {
      const r = await fetch('/api/admin/staff/me', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: sandi1 }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.success) {
        setWajibGanti(false);
        setSandi1(''); setSandi2(''); setPesanSandi('');
        // Muat ulang agar izin & menu aktif.
        window.location.reload();
      } else {
        setPesanSandi(d.message || 'Gagal menyimpan password.');
      }
    } catch {
      setPesanSandi('Gagal menghubungi server.');
    } finally {
      setSimpanSandi(false);
    }
  };

  const isOwner = user?.role === 'OWNER';
  /** Cek izin; selama daftar belum termuat, tombol disembunyikan (aman secara default). */
  const has = (code: string) => perms.includes(code);

      const menuGroups: { groupName: string; items: { id: Tab; icon: React.ReactNode; label: string; perm?: string }[] }[] = [
    {
      groupName: 'Master Data',
      items: [
        { id: 'jamaah', perm: 'jamaah.read', icon: <Users className="w-4 h-4" />, label: 'Data Jamaah' },
        { id: 'riwayat-jamaah', perm: 'jamaah.read', icon: <History className="w-4 h-4" />, label: 'Riwayat Jamaah' },
        { id: 'paket', perm: 'paket.read', icon: <Package className="w-4 h-4" />, label: 'Paket Perjalanan' },
        { id: 'batches', perm: 'paket.read', icon: <Plane className="w-4 h-4" />, label: 'Jadwal & Batch' },
        { id: 'inventory', perm: 'inventory.read', icon: <Boxes className="w-4 h-4" />, label: 'Inventaris & Stok' },
        { id: 'master-coa' as Tab, perm: 'coa.manage', icon: <Calculator className="w-4 h-4" />, label: 'Master Akun COA' },
      ],
    },
    {
      groupName: 'Transaksi & Akuntansi',
      items: [
        { id: 'transaksi', perm: 'booking.read', icon: <ShoppingBag className="w-4 h-4" />, label: 'Transaksi & Booking' },
        { id: 'pembayaran', perm: 'payment.read', icon: <Receipt className="w-4 h-4" />, label: 'Verifikasi Pembayaran' },
        { id: 'general-journal' as Tab, perm: 'journal.read', icon: <BookOpen className="w-4 h-4" />, label: 'Jurnal Umum (Memorial)' },
        { id: 'expenses' as Tab, perm: 'expense.manage', icon: <CreditCard className="w-4 h-4" />, label: 'Beban Operasional' },
      ],
    },
    {
      groupName: 'Operasional & Jamaah',
      items: [
        { id: 'manifest', perm: 'report.operational', icon: <Plane className="w-4 h-4" />, label: 'Manifest Keberangkatan' },
        { id: 'registrations', perm: 'booking.read', icon: <ClipboardList className="w-4 h-4" />, label: 'Registrasi Online' },
        { id: 'checklist' as Tab, perm: 'checklist.read', icon: <CheckSquare className="w-4 h-4" />, label: 'Checklist Kelengkapan' },
      ],
    },
    {
      groupName: 'Laporan & Keuangan',
      items: [
        { id: 'laporan', perm: 'report.finance', icon: <TrendingUp className="w-4 h-4" />, label: 'Laporan Keuangan' },
        { id: 'laba-rugi', perm: 'report.finance', icon: <FileText className="w-4 h-4" />, label: 'Laporan Laba Rugi' },
        { id: 'neraca', perm: 'report.finance', icon: <Calculator className="w-4 h-4" />, label: 'Laporan Neraca' },
        { id: 'arus-kas', perm: 'report.finance', icon: <Wallet className="w-4 h-4" />, label: 'Laporan Arus Kas' },
        { id: 'ledger' as Tab, perm: 'journal.read', icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Jurnal Buku Besar' },
        { id: 'stock-ledger' as Tab, perm: 'inventory.read', icon: <Boxes className="w-4 h-4" />, label: 'Mutasi Stok Gudang' },
      ],
    },
    ...(isOwner
      ? [
          {
            groupName: 'Pengaturan & Akses',
            items: [
              { id: 'settings' as Tab, perm: 'settings.manage', icon: <Building2 className="w-4 h-4" />, label: 'Profil Tour & Travel' },
              { id: 'staf' as Tab, perm: 'staff.manage', icon: <ShieldCheck className="w-4 h-4" />, label: 'Kelola Staf' },
              { id: 'roles' as Tab, perm: 'staff.manage', icon: <KeyRound className="w-4 h-4" />, label: 'Master Role' },
              { id: 'audit' as Tab, perm: 'audit.read', icon: <History className="w-4 h-4" />, label: 'Log Aktivitas' },
            ],
          },
        ]
      : []),
  ];
  /*
   * Menu ditentukan SERVER (izin + pengecualian menu per role), bukan dihitung
   * ulang di klien. Dengan begitu role bisa diberi menu di luar izin dasarnya
   * (mis. FINANCE diberi menu Kasir) tanpa memberi izin tambahan.
   * Selama daftar belum termuat: hanya Dashboard yang tampil (aman).
   */
  const menuTerlihat = menuGroups
    .map(g => ({ ...g, items: g.items.filter((it: any) => it.alwaysOn || menuAktif.includes(String(it.id))) }))
    .filter(g => g.items.length > 0);

  const allItems = [
    { id: 'dashboard' as Tab, alwaysOn: true, icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard Overview' },
    ...menuTerlihat.flatMap(g => g.items),
  ];

  const currentTabInfo = allItems.find(m => m.id === activeTab) || allItems[0];

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const handleSelectTab = (tab: Tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div
 className="flex h-screen bg-slate-100 overflow-hidden">
      {/* ── WAJIB GANTI PASSWORD BAWAAN ──
          Ditampilkan menutupi seluruh dashboard selama users.must_change_password = 1.
          Server juga menolak semua API admin lain (403), jadi layar ini bukan satu-satunya
          pertahanan — hanya petunjuk yang jelas bagi pengguna. */}
      {wajibGanti && (
        <div className="fixed inset-0 z-[60] bg-slate-900/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">Ganti Password Bawaan</h3>
            <p className="text-xs text-slate-500 mt-1">
              Akun Anda masih memakai password bawaan yang tertulis di dokumentasi. Selama belum diganti,
              seluruh menu ditahan karena siapa pun yang tahu password bawaan bisa masuk.
            </p>
            <div className="mt-4 space-y-3">
              <div>
                <label className="text-[11px] font-bold text-slate-600">Password Baru</label>
                <input type="password" value={sandi1} onChange={(e) => setSandi1(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-xl" />
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-600">Ulangi Password Baru</label>
                <input type="password" value={sandi2} onChange={(e) => setSandi2(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && gantiSandiBawaan()}
                  className="w-full mt-1 px-3 py-2 text-sm border border-slate-200 rounded-xl" />
              </div>
              {pesanSandi && <p className="text-[11px] text-rose-600 font-bold">{pesanSandi}</p>}
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => { localStorage.removeItem('admin_user'); window.location.href = '/admin/login'; }}
                className="px-3.5 py-2 text-xs font-bold text-slate-600 rounded-xl hover:bg-slate-100">
                Keluar
              </button>
              <button onClick={gantiSandiBawaan} disabled={simpanSandi}
                className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800 disabled:opacity-40">
                {simpanSandi ? 'Menyimpan…' : 'Simpan & Lanjut'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation (Linear Ultra-Clean Style) */}
      <aside
        className={`bg-white text-slate-700 border-r border-slate-200/80 transition-all duration-200 flex flex-col z-50 
        fixed md:static inset-y-0 left-0 
        ${mobileMenuOpen ? 'translate-x-0 w-64 shadow-xl' : '-translate-x-full md:translate-x-0'} 
        ${sideOpen ? 'md:w-60' : 'md:w-16'}`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
              
            </div>
            {(sideOpen || mobileMenuOpen) && (
              <div className="truncate">
                <h1 className="font-extrabold text-sm tracking-tight text-slate-900">Al-Barakah</h1>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Management</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSideOpen(!sideOpen)}
            className="hidden md:flex text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <Menu className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menu Items List */}
        <nav className="flex-1 py-3 px-2.5 space-y-3 overflow-y-auto">
          {/* Main Dashboard Button */}
          <button
            onClick={() => handleSelectTab('dashboard')}
            title="Dashboard"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition text-xs font-semibold ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-400'}`} />
            {(sideOpen || mobileMenuOpen) && <span className="truncate">Dashboard Overview</span>}
          </button>

          {/* Submenu Groups */}
          {menuGroups.map(group => {
            const isGroupOpen = openGroups[group.groupName] ?? true;
            const hasActiveChild = group.items.some(it => it.id === activeTab);

            return (
              <div key={group.groupName} className="space-y-0.5">
                {(sideOpen || mobileMenuOpen) && (
                  <button
                    onClick={() => toggleGroup(group.groupName)}
                    className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 hover:text-slate-600 transition"
                  >
                    <span className={hasActiveChild ? 'text-slate-900 font-black' : ''}>{group.groupName}</span>
                    <span className="text-[10px]">{isGroupOpen ? '▾' : '▸'}</span>
                  </button>
                )}

                {/* Sub-items */}
                {(!sideOpen && !mobileMenuOpen ? true : isGroupOpen) && (
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectTab(item.id)}
                          title={item.label}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition text-xs font-medium ${
                            isActive
                              ? 'bg-slate-900 text-white font-bold shadow-xs'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <span className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}>{item.icon}</span>
                          {(sideOpen || mobileMenuOpen) && <span className="truncate">{item.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout Footer */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={async () => {
              try {
                await fetch('/api/admin/logout', { method: 'POST' });
              } catch {}
              localStorage.removeItem('admin_user');
              window.location.href = '/admin/login';
            }}
            title="Keluar (Logout)"
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition text-xs font-semibold"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(sideOpen || mobileMenuOpen) && <span>Keluar Sistem</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex justify-between items-center sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition focus:outline-none"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <span>{currentTabInfo.icon}</span>
              <span className="truncate">{currentTabInfo.label}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2.5 text-right">
            <span className="hidden sm:inline-block text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
              {user?.role || 'STAFF'}
            </span>
            <span className="text-xs font-bold text-slate-700 truncate max-w-[140px] sm:max-w-none">
              {user?.name || 'Admin'}
            </span>
          </div>
        </header>

        {/* Scrollable View Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && <DashboardTab isOwner={has('report.finance')} />}
          {activeTab === 'jamaah' && <MasterJamaah />}
          {activeTab === 'riwayat-jamaah' && <RiwayatJamaahTab />}
        {activeTab === 'checklist' && <ChecklistTab />}
          {activeTab === 'paket' && <MasterPaket />}
          {activeTab === 'batches' && <MasterBatches />}
          {activeTab === 'inventory' && <MasterInventaris />}
          {activeTab === 'transaksi' && <TransaksiTab />}
          {activeTab === 'manifest' && <ManifestTab />}
          {activeTab === 'staf' && has('staff.manage') && <KelolaStaf />}
          {activeTab === 'roles' && has('staff.manage') && <KelolaIzinRole />}
          {activeTab === 'audit' && has('audit.read') && <LogAktivitas />}
          {activeTab === 'settings' && has('settings.manage') && <PengaturanTab />}
          {activeTab === 'pembayaran' && <PembayaranTab />}
          {activeTab === 'registrations' && <RegistrationsTab />}
          {activeTab === 'laporan' && <LaporanTab isOwner={has('report.finance')} />}
          {activeTab === 'master-coa' && <MasterCOATab />}
          {activeTab === 'laba-rugi' && <LabaRugiTab isOwner={has('report.finance')} />}
          {activeTab === 'neraca' && <NeracaTab />}
          {activeTab === 'arus-kas' && <ArusKasTab />}
            {activeTab === 'ledger' && <LedgerTab />}
            {activeTab === 'stock-ledger' && <StockLedgerTab />}
          {activeTab === 'general-journal' && <GeneralJournalTab />}
          {activeTab === 'expenses' && <ExpensesTab />}
        </div>
      </main>
      <ToastContainer toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}



/* ===================== MASTER COA TAB ===================== */
function MasterCOATab() {
  const [coaList, setCoaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('Beban Operasional');
  const [group, setGroup] = useState('Beban');
  const [msg, setMsg] = useState('');

  const loadCOA = () => {
    setLoading(true);
    fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'GET_COA' })
    }).then(r => r.json()).then(d => {
      if (d.success) setCoaList(d.coa || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadCOA(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SAVE_COA', id: editId, coa_code: code, coa_name: name, coa_type: type, coa_group: group })
    });
    const json = await res.json();
    if (json.success) {
      setMsg(json.message);
      setShowModal(false);
      setEditId(null);
      setCode(''); setName('');
      loadCOA();
    } else {
      setMsg('Gagal: ' + json.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus akun COA ini?')) return;
    await fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_COA', id })
    });
    loadCOA();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white rounded-xl shadow p-4">
        <div>
          <h2 className="text-base font-black text-slate-900">Master Chart of Accounts (COA)</h2>
          <p className="text-xs text-slate-500">Kelola daftar akun standar akuntansi untuk pencatatan keuangan travel.</p>
        </div>
        <button
          onClick={() => { setEditId(null); setCode(''); setName(''); setShowModal(true); }}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
        >
          + Tambah Akun COA
        </button>
      </div>

      {msg && <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl text-xs font-semibold">{msg}</div>}

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Kode Akun</th>
              <th className="text-left px-4 py-3 font-bold">Nama Akun</th>
              <th className="text-left px-4 py-3 font-bold">Tipe</th>
              <th className="text-left px-4 py-3 font-bold">Kelompok</th>
              <th className="text-right px-4 py-3 font-bold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {coaList.map((item: any) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.coa_code}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{item.coa_name}</td>
                <td className="px-4 py-3 text-slate-600">{item.coa_type}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{item.coa_group}</span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => { setEditId(item.id); setCode(item.coa_code); setName(item.coa_name); setType(item.coa_type); setGroup(item.coa_group); setShowModal(true); }}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Edit
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="text-rose-600 hover:underline font-semibold">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">{editId ? 'Edit Akun COA' : 'Tambah Akun COA Baru'}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Akun (Contoh: 5-108)</label>
                <input type="text" value={code} onChange={e => setCode(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs font-mono" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Akun</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Akun</label>
                <input type="text" value={type} onChange={e => setType(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kelompok Utama</label>
                <select value={group} onChange={e => setGroup(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="Aset">Aset</option>
                  <option value="Liabilitas">Liabilitas</option>
                  <option value="Ekuitas">Ekuitas</option>
                  <option value="Pendapatan">Pendapatan</option>
                  <option value="Beban">Beban</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


/* ===================== LAPORAN LABA RUGI & BEBAN ===================== */
function LabaRugiTab({ isOwner }: { isOwner: boolean }) {
  const [data, setData] = useState<any>(null);
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [coaList, setCoaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('ALL');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  // Form input expense modal
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [coaId, setCoaId] = useState('');
  const [expDate, setExpDate] = useState(hariIniWib());
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [method, setMethod] = useState('TRANSFER');
  const [ref, setRef] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    let q = `?period=${period}`;
    if (period === 'DAILY' && date) q += `&date=${date}`;
    if (period === 'MONTHLY' && month) q += `&month=${month}`;
    if (period === 'YEARLY' && year) q += `&year=${year}`;
    setLoading(true);
    fetch('/api/admin/financial' + q).then(r => r.json()).then(d => {
      if (d.success) setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));

    fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'GET_EXPENSES' })
    }).then(r => r.json()).then(d => {
      if (d.success) {
        setExpensesList(d.expenses || []);
        setCoaList(d.coa || []);
      }
    });
  }, [period, date, month, year]);

  useEffect(() => { load(); }, [load]);

  const addExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!coaId || !amount || !desc) {
      alert('Lengkapi akun, nominal, dan keterangan beban.');
      return;
    }
    const res = await fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ADD_EXPENSE', coa_account_id: coaId, date: expDate, amount: parseFloat(amount), description: desc, payment_method: method, reference_no: ref })
    });
    const d = await res.json();
    (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error') : alert(d.message);
    if (d.success) {
      setAmount(''); setDesc(''); setRef(''); setShowAddExpense(false);
      load();
    }
  };

  const lr = data?.laba_rugi || { total_pendapatan: 0, total_beban: 0, laba_bersih: 0 };

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Top Header & Period Filter */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h3 className="text-base font-black text-slate-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-slate-900"></span> Laporan Laba Rugi & Beban Operasional
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">Analisis pendapatan jamaah, pengeluaran operasional, dan laba bersih komprehensif.</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex bg-slate-100 p-1 rounded-xl">
            {['ALL', 'DAILY', 'MONTHLY', 'YEARLY'].map(p => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${period === p ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'}`}
              >
                {p === 'ALL' ? 'Semua' : p === 'DAILY' ? 'Harian' : p === 'MONTHLY' ? 'Bulanan' : 'Tahunan'}
              </button>
            ))}
          </div>
          {isOwner && (
            <button
              onClick={() => setShowAddExpense(true)}
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5"
            >
              <span>+ Catat Beban</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Pendapatan</span>
          <p className="text-xl font-black font-mono text-slate-900 mt-1">{fmtRp(lr.total_pendapatan)}</p>
          <span className="text-[10px] text-emerald-600 font-bold mt-2 block">✓ Terverifikasi dari Pembayaran Jamaah</span>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Beban Operasional</span>
          <p className="text-xl font-black font-mono text-rose-600 mt-1">{fmtRp(lr.total_beban)}</p>
          <span className="text-[10px] text-slate-500 font-bold mt-2 block">Pengeluaran & Biaya Tour</span>
        </div>
        <div className="bg-slate-900 text-white rounded-2xl border border-slate-900 p-5 shadow-xs">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400">Laba Bersih Usaha</span>
          <p className={`text-xl font-black font-mono mt-1 ${lr.laba_bersih >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{fmtRp(lr.laba_bersih)}</p>
          <span className="text-[10px] text-slate-400 font-bold mt-2 block">Net Profit Perusahaan</span>
        </div>
      </div>

      {/* Breakdown Details */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider border-b pb-3">Rincian Pendapatan</h4>
          <div className="space-y-3 text-xs">
            {(lr.rincian_pendapatan && lr.rincian_pendapatan.length > 0 ? lr.rincian_pendapatan : []).map((r: any) => (
              <div key={r.coa_code} className="flex justify-between items-center py-2 border-b border-slate-100">
                <span className="text-slate-600 font-medium">{r.coa_name} <span className="font-mono text-[10px] text-slate-400">{r.coa_code}</span></span>
                <span className="font-mono font-bold text-slate-900">{fmtRp(r.total)}</span>
              </div>
            ))}
            {(!lr.rincian_pendapatan || lr.rincian_pendapatan.length === 0) && (
              <p className="text-xs text-slate-400 text-center py-4">Belum ada pendapatan terjurnal.</p>
            )}
            <div className="flex justify-between items-center py-2 font-black text-slate-900">
              <span>Total Pendapatan</span>
              <span className="font-mono">{fmtRp(lr.total_pendapatan)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
          <div className="flex justify-between items-center border-b pb-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Rincian Beban / Pengeluaran</h4>
            <span className="text-xs font-mono font-bold text-rose-600">{fmtRp(lr.total_beban)}</span>
          </div>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {/*
              * Rincian beban diambil dari BUKU BESAR (semua akun grup Beban),
              * bukan hanya tabel `expenses`. Dengan begitu beban dari jurnal umum
              * dan HPP perlengkapan jamaah (5-109) ikut terlihat.
              */}
            {(lr.rincian_beban || []).map((b: any) => (
              <div key={b.coa_code} className="bg-slate-50 border border-slate-200/60 rounded-xl p-3 flex justify-between items-center text-xs">
                <div>
                  <p className="font-bold text-slate-900">{b.coa_name}</p>
                  <p className="text-[10px] text-slate-500 font-mono">{b.coa_code}</p>
                </div>
                <span className="font-mono font-bold text-rose-600">{fmtRp(b.total)}</span>
              </div>
            ))}
            {(!lr.rincian_beban || lr.rincian_beban.length === 0) && (
              <p className="text-xs text-slate-400 text-center py-4">Belum ada beban terjurnal.</p>
            )}
            {expensesList.length > 0 && (
              <p className="text-[10px] text-slate-400 text-center pt-1">
                {expensesList.length} catatan beban terperinci tersedia di menu Beban Operasional.
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Add Expense Modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900">Catat Beban Operasional Baru</h3>
              <button onClick={() => setShowAddExpense(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
            </div>
            <form onSubmit={addExpense} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Akun Beban (COA)</label>
                <select
                  value={coaId}
                  onChange={e => setCoaId(e.target.value)}
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 bg-white focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  required
                >
                  <option value="">-- Pilih Akun Beban --</option>
                  {coaList.map((c: any) => (
                    <option key={c.id} value={c.id}>{c.coa_code} - {c.coa_name}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tanggal</label>
                  <input
                    type="date"
                    value={expDate}
                    onChange={e => setExpDate(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nominal (Rp)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={e => setAmount(e.target.value)}
                    placeholder="1500000"
                    className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs font-mono font-bold text-slate-900"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Keterangan Pengeluaran</label>
                <input
                  type="text"
                  value={desc}
                  onChange={e => setDesc(e.target.value)}
                  placeholder="Cth: Konsumsi rapat manasik jamaah"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Metode Bayar</label>
                  <select
                    value={method}
                    onChange={e => setMethod(e.target.value)}
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs bg-white"
                  >
                    <option value="TRANSFER">Transfer Bank</option>
                    <option value="CASH">Kas Tunai</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. Referensi (Opsional)</label>
                  <input
                    type="text"
                    value={ref}
                    onChange={e => setRef(e.target.value)}
                    placeholder="TRX-9981"
                    className="w-full border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono"
                  />
                </div>
              </div>

              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddExpense(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 rounded-xl transition shadow-xs"
                >
                  Simpan Beban
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function NeracaTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/financial?period=ALL').then(r => r.json()).then(d => {
      if (d.success) setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (!data) return <div className="text-center text-slate-400 py-12">Memuat...</div>;

  const n = data.neraca;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ASET */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> ASET</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Kas & Bank</span><span className="font-bold">{fmtRp(n.aset.kas_bank)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Piutang Jamaah</span><span className="font-bold">{fmtRp(n.aset.piutang_jamaah)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Persediaan</span><span className="font-bold">{fmtRp(n.aset.persediaan)}</span></div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900"><span>Total Aset</span><span>{fmtRp(n.aset.total_aset)}</span></div>
          </div>
        </div>
        {/* LIABILITAS */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> LIABILITAS</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Utang Vendor</span><span className="font-bold">{fmtRp(n.liabilitas.utang_vendor)}</span></div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900"><span>Total Liabilitas</span><span>{fmtRp(n.liabilitas.total_liabilitas)}</span></div>
          </div>
        </div>
        {/* EKUITAS */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> EKUITAS</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Modal Pemilik</span><span className="font-bold">{fmtRp(n.ekuitas.modal_pemilik)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Laba Ditahan</span><span className="font-bold">{fmtRp(n.ekuitas.laba_ditahan)}</span></div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900"><span>Total Ekuitas</span><span>{fmtRp(n.ekuitas.total_ekuitas)}</span></div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
        <p className={`text-xs text-center font-bold ${n.seimbang ? 'text-emerald-600' : 'text-rose-600'}`}>
          Aset = Liabilitas + Ekuitas → {fmtRp(n.aset.total_aset)} = {fmtRp(n.liabilitas.total_liabilitas)} + {fmtRp(n.ekuitas.total_ekuitas)}
          {n.seimbang ? ' ✓ seimbang' : ` ⚠ selisih ${fmtRp(n.selisih)}`}
        </p>
      </div>
    </div>
  );
}

/* ===================== ARUS KAS ===================== */
function ArusKasTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/financial?period=ALL').then(r => r.json()).then(d => {
      if (d.success) setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (!data) return <div className="text-center text-slate-400 py-12">Memuat...</div>;

  const ak = data.arus_kas;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> Saldo Kas</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Kas Awal</span><span>{fmtRp(ak.kas_awal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Kas Akhir</span><span className="font-bold">{fmtRp(ak.kas_akhir)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Perubahan</span><span className={ak.perubahan_kas >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{fmtRp(ak.perubahan_kas)}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> Arus Kas Per Aktivitas</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Operasi</span><span className="font-bold text-emerald-700">{fmtRp(ak.arus_operasi)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Investasi</span><span className="font-bold text-blue-700">{fmtRp(ak.arus_investasi)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Pendanaan</span><span className="font-bold text-amber-700">{fmtRp(ak.arus_pendanaan)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}


