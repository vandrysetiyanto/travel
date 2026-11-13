'use client';

/**
 * Modul dashboard: keuangan
 *
 * Dipisahkan dari app/admin/dashboard/page.tsx (4254 baris, 30 komponen).
 * Berkas sebesar itu membuat setiap perubahan berisiko menjatuhkan seluruh panel.
 * Komponen di sini masih memakai state lokalnya sendiri; pemecahan lebih lanjut
 * (hook data terpisah) dilakukan bertahap agar perilaku tidak berubah.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EmptyState, StatusBadge, DocBadge, FInput } from '@/components/dashboard/ui-dasar';
import { fmt, fmtRp, hariIniWib } from '@/components/dashboard/format';

export function LaporanTab({ isOwner }: { isOwner: boolean }) {
  const [reports, setReports] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [period, setPeriod] = useState('ALL');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [batchId, setBatchId] = useState('');

  const load = useCallback(() => {
    let q = `?period=${period}`;
    if (period==='DAILY' && date) q += `&date=${date}`;
    if (period==='MONTHLY' && month) q += `&month=${month}`;
    if (period==='YEARLY' && year) q += `&year=${year}`;
    if (batchId) q += `&batch_id=${batchId}`;
    fetch('/api/admin/reports' + q).then(r=>r.json()).then(d=>{
      if(d.success){setReports(d.reports||[]);setSummary(d.summary);setBatches(d.batches||[]);}
    });
  }, [period, date, month, year, batchId]);
  useEffect(()=>{load();},[load]);

  const exportExcel = () => {
    import('xlsx').then(XLSX => {
      const data = reports.map((r:any,i:number)=>({'No':i+1,'Kode':r.booking_code,'Jamaah':r.full_name,'NIK':r.nik,'Paket':r.package_name,'Total':r.total_amount,'Dibayar':r.paid_amount,'Sisa':r.remaining_amount,'Status':r.payment_status,'Tanggal':r.transaction_date}));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
      XLSX.writeFile(wb, 'laporan-keuangan.xlsx');
    });
  };

  const printReport = () => {
    const w = window.open('','','width=1100,height=700'); if(!w) return;
    const rows = reports.map((r:any,i:number)=>`<tr><td>${i+1}</td><td>${r.booking_code}</td><td>${r.full_name}</td><td>${r.package_name}</td><td style="text-align:right">${fmtRp(r.total_amount)}</td><td style="text-align:right">${fmtRp(r.paid_amount)}</td><td style="text-align:right">${fmtRp(r.remaining_amount)}</td><td>${r.payment_status}</td></tr>`).join('');
    w.document.write(`<html><head><title>Laporan</title><style>body{font-family:Arial;font-size:11px;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #333;padding:4px 6px}th{background:#059669;color:#fff}</style></head><body>
      <h2 style="text-align:center">LAPORAN KEUANGAN AL-BARAKAH TOUR</h2>
      <p>Periode: ${period} | Transaksi: ${summary?.total_transactions||0} | Omset: ${fmtRp(summary?.total_revenue||0)} | Piutang: ${fmtRp(summary?.total_receivables||0)}</p>
      <table><thead><tr><th>No</th><th>Kode</th><th>Jamaah</th><th>Paket</th><th>Total</th><th>Dibayar</th><th>Sisa</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close(); w.print();
  };


  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Periode</label>
          <select value={period} onChange={e=>setPeriod(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="ALL">Semua</option><option value="DAILY">Harian</option><option value="MONTHLY">Bulanan</option><option value="YEARLY">Tahunan</option>
          </select></div>
          {period==='DAILY' && <div><label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/></div>}
          {period==='MONTHLY' && <div><label className="block text-xs font-medium text-gray-600 mb-1">Bulan</label><input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/></div>}
          {period==='YEARLY' && <div><label className="block text-xs font-medium text-gray-600 mb-1">Tahun</label><input type="number" inputMode="numeric" pattern="[0-9]*" value={year} onChange={e=>setYear(e.target.value)} placeholder="2026" className="border rounded-lg px-3 py-2 text-sm w-24 focus:ring-2 focus:ring-emerald-500 focus:outline-none"/></div>}
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Batch</label>
          <select value={batchId} onChange={e=>setBatchId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Semua</option>{batches.map((b:any)=>(<option key={b.id} value={b.id}>{b.batch_name}</option>))}</select></div>
          <button onClick={printReport} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"> Cetak</button>
          <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"> Excel</button>
        </div>
      </div>
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Transaksi</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{summary.total_transactions} Trx</p>
          </div>
          {isOwner && (
            <div className="bg-emerald-50/70 rounded-2xl shadow-xs border border-emerald-200 p-4">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Total Omset</p>
              <p className="text-2xl font-extrabold text-emerald-800 mt-1">{fmtRp(summary.total_revenue)}</p>
            </div>
          )}
          {isOwner && (
            <div className="bg-rose-50/70 rounded-2xl shadow-xs border border-rose-200 p-4">
              <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">Total Piutang</p>
              <p className="text-2xl font-extrabold text-rose-800 mt-1">{fmtRp(summary.total_receivables)}</p>
            </div>
          )}
          <div className="bg-emerald-50/70 rounded-2xl shadow-xs border border-emerald-200 p-4">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Lunas (PAID)</p>
            <p className="text-2xl font-extrabold text-emerald-800 mt-1">{summary.paid_count}</p>
          </div>
          <div className="bg-amber-50/70 rounded-2xl shadow-xs border border-amber-200 p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">DP / Pending</p>
            <p className="text-2xl font-extrabold text-amber-800 mt-1">{summary.dp_count + summary.pending_count}</p>
          </div>
        </div>
      )}

      {/* Visualisasi Grafik Tren Omset & Transaksi (Data Visualization Skill) */}
      {reports.length > 0 && isOwner && (() => {
        // Group reports by transaction month or date
        const monthlyGroups: Record<string, { revenue: number; count: number }> = {};
        reports.forEach((r: any) => {
          const key = (r.transaction_date || '').substring(0, 7) || 'Umum';
          if (!monthlyGroups[key]) monthlyGroups[key] = { revenue: 0, count: 0 };
          monthlyGroups[key].revenue += Number(r.paid_amount) || 0;
          monthlyGroups[key].count += 1;
        });

        const sortedKeys = Object.keys(monthlyGroups).sort();
        const maxRev = Math.max(...sortedKeys.map(k => monthlyGroups[k].revenue), 1);

        return (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <span></span> Grafik Tren Pendapatan Terkumpul
                </h4>
                <p className="text-xs text-slate-500">Visualisasi uang masuk berdasarkan periode laporan yang dipilih.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {sortedKeys.map(key => {
                const item = monthlyGroups[key];
                const pct = Math.round((item.revenue / maxRev) * 100);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 font-mono">{key} ({item.count} Transaksi)</span>
                      <span className="text-emerald-700 font-bold">{fmtRp(item.revenue)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left">
            <th className="p-3">Kode</th><th className="p-3">Jamaah</th><th className="p-3">Paket</th>
            {isOwner && <th className="p-3">Total</th>}
            {isOwner && <th className="p-3">Dibayar</th>}
            {isOwner && <th className="p-3">Sisa</th>}
            <th className="p-3">Status</th><th className="p-3">Tanggal</th>
          </tr></thead>
          <tbody>
            {reports.map((r:any)=>(<tr key={r.transaction_id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-mono text-xs">{r.booking_code}</td><td className="p-3">{r.full_name}</td>
              <td className="p-3 text-xs">{r.package_name}</td>
              {isOwner && <td className="p-3">{fmtRp(r.total_amount)}</td>}
              {isOwner && <td className="p-3 text-green-600">{fmtRp(r.paid_amount)}</td>}
              {isOwner && <td className="p-3 text-red-600">{fmtRp(r.remaining_amount)}</td>}
              <td className="p-3"><StatusBadge s={r.payment_status}/></td><td className="p-3 text-xs">{r.transaction_date}</td>
            </tr>))}
            {reports.length===0 && <tr><td colSpan={8} className="p-6 text-center text-gray-400">Tidak ada data</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}

export function LedgerTab() {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'GET_LEDGER' })
    }).then(r => r.json()).then(d => {
      if (d.success) setLedger(d.ledger || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
      <h3 className="text-base font-black text-slate-900">Jurnal Buku Besar (General Ledger)</h3>
      {loading ? <p className="text-center text-slate-400 py-8">Memuat...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
                <th className="p-3">Tanggal</th>
                <th className="p-3">Kode Akun</th>
                <th className="p-3">Nama Akun</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-right">Debit (Rp)</th>
                <th className="p-3 text-right">Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((l:any)=>(
                <tr key={l.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono text-slate-500">{l.entry_date}</td>
                  <td className="p-3 font-mono font-bold text-slate-700">{l.coa_code}</td>
                  <td className="p-3 font-bold text-slate-900">{l.coa_name}</td>
                  <td className="p-3 text-slate-600">{l.description}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-600">
                    {l.entry_type === 'DEBIT' ? fmtRp(l.amount) : '-'}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-rose-600">
                    {l.entry_type === 'CREDIT' ? fmtRp(l.amount) : '-'}
                  </td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Belum ada entri buku besar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function StockLedgerTab() {
  const [handovers, setHandovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/inventory/ledger').then(r => r.json()).then(d => {
      if (d.success) setHandovers(d.handovers || d.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
      <h3 className="text-base font-black text-slate-900">Mutasi Stok Gudang & Penyerahan Perlengkapan</h3>
      {loading ? <p className="text-center text-slate-400 py-8">Memuat...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
                <th className="p-3">Tanggal</th>
                <th className="p-3">Nama Jamaah</th>
                <th className="p-3">Nama Barang</th>
                <th className="p-3 text-center">Jumlah Keluar</th>
                <th className="p-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {handovers.map((h:any)=>(
                <tr key={h.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono text-slate-500">{h.handover_date || h.created_at}</td>
                  <td className="p-3 font-bold text-slate-900">{h.full_name || h.jamaah_name}</td>
                  <td className="p-3 font-bold text-slate-700">{h.item_name || h.name}</td>
                  <td className="p-3 text-center font-mono font-bold text-rose-600">-{h.quantity || h.qty}</td>
                  <td className="p-3 text-slate-600">{h.notes || '-'}</td>
                </tr>
              ))}
              {handovers.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Belum ada mutasi stok gudang.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

export function GeneralJournalTab() {
  const [journals, setJournals] = useState<any[]>([]);
  const [coaList, setCoaList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ journal_date: hariIniWib(), debit_coa_id: '', credit_coa_id: '', amount: '', description: '' });

  const loadData = () => {
    fetch('/api/admin/financial?period=ALL').then(r => r.json()).then(d => {
      if (d.success) {
        setJournals(d.generalJournals || []);
        setCoaList(d.coaList || []);
      }
    });
  };

  useEffect(() => { loadData(); }, []);

  const saveJournal = () => {
    if (!form.debit_coa_id || !form.credit_coa_id || !form.amount) {
      alert('Semua field wajib diisi!');
      return;
    }
    fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CREATE_GENERAL_JOURNAL', ...form })
    }).then(r => r.json()).then(d => {
      if (d.success) {
        alert('Jurnal umum berhasil disimpan!');
        setShowModal(false);
        setForm({ journal_date: hariIniWib(), debit_coa_id: '', credit_coa_id: '', amount: '', description: '' });
        loadData();
      } else {
        alert(d.message || 'Gagal menyimpan jurnal');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900">Jurnal Umum (Memorial)</h3>
          <p className="text-xs text-slate-500">Pencatatan transaksi akuntansi berpasangan (Double-Entry).</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ Buat Jurnal Baru</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">Tanggal</th>
              <th className="p-3">Debit (Akun)</th>
              <th className="p-3">Kredit (Akun)</th>
              <th className="p-3 text-right">Jumlah (Rp)</th>
              <th className="p-3">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {journals.map((j:any)=>(
              <tr key={j.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono text-slate-500">{j.journal_date}</td>
                <td className="p-3 font-bold text-slate-900">{j.debit_code} - {j.debit_name}</td>
                <td className="p-3 font-bold text-slate-900">{j.credit_code} - {j.credit_name}</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-600">{fmtRp(j.amount)}</td>
                <td className="p-3 text-slate-600">{j.description}</td>
              </tr>
            ))}
            {journals.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">Belum ada jurnal umum.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Form Jurnal Umum (Memorial)</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tanggal *</label>
                <input type="date" value={form.journal_date} onChange={e=>setForm({...form, journal_date:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Akun Debit *</label>
                <select value={form.debit_coa_id} onChange={e=>setForm({...form, debit_coa_id:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="">-- Pilih Akun Debit --</option>
                  {coaList.map((c:any)=>(<option key={c.id} value={c.id}>[{c.coa_code}] {c.coa_name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Akun Kredit *</label>
                <select value={form.credit_coa_id} onChange={e=>setForm({...form, credit_coa_id:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="">-- Pilih Akun Kredit --</option>
                  {coaList.map((c:any)=>(<option key={c.id} value={c.id}>[{c.coa_code}] {c.coa_name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Jumlah (Rp) *</label>
                <input type="number" inputMode="numeric" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs font-mono" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Keterangan / Deskripsi</label>
                <input value={form.description} onChange={e=>setForm({...form, description:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" placeholder="Keterangan transaksi..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={saveJournal} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Simpan Jurnal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
