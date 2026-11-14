'use client';

/**
 * Modul dashboard: operasional
 *
 * Dipisahkan dari app/admin/dashboard/page.tsx (4254 baris, 30 komponen).
 * Berkas sebesar itu membuat setiap perubahan berisiko menjatuhkan seluruh panel.
 * Komponen di sini masih memakai state lokalnya sendiri; pemecahan lebih lanjut
 * (hook data terpisah) dilakukan bertahap agar perilaku tidak berubah.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EmptyState, StatusBadge, DocBadge, FInput } from '@/components/dashboard/ui-dasar';
import { fmt, fmtRp, hariIniWib } from '@/components/dashboard/format';

export function ChecklistTab() {
  const [jamaahList, setJamaahList] = useState<any[]>([]);
  const [selectedJamaah, setSelectedJamaah] = useState<any>(null);
  const [checklistData, setChecklistData] = useState<{ master: any[], items: any[] }>({ master: [], items: [] });
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    fetchJamaah();
  }, []);

  const fetchJamaah = async () => {
    try {
      const res = await fetch('/api/admin/jamaah');
      const data = await res.json();
      if (data.success) {
        const list = data.jamaah || data.data || [];
        setJamaahList(list);
        if (list.length > 0) {
          selectJamaah(list[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectJamaah = async (jamaah: any) => {
    setSelectedJamaah(jamaah);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/checklist?jamaah_id=${jamaah.id}`);
      const data = await res.json();
      if (data.success) {
        setChecklistData({ master: data.master || [], items: data.items || [] });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (item: any) => {
    if (!selectedJamaah) return;
    const currentStatus = item.status;
    // Toggle cycle: BELUM -> SUDAH (atau DIAMBIL jika inventory linked) -> BELUM
    let nextStatus = 'SUDAH';
    if (item.is_inventory_linked) {
      nextStatus = (currentStatus === 'BELUM') ? 'DIAMBIL' : 'BELUM';
    } else {
      nextStatus = (currentStatus === 'BELUM') ? 'SUDAH' : 'BELUM';
    }

    setSavingId(item.id);
    try {
      const res = await fetch('/api/admin/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          jamaah_id: selectedJamaah.id,
          checklist_master_id: item.id,
          status: nextStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        selectJamaah(selectedJamaah);
      } else {
        alert(data.message || 'Gagal memperbarui status');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingId(null);
    }
  };

  const filteredJamaah = jamaahList.filter((j: any) => 
    j.full_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    j.passport_number?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    j.phone?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const categories = Array.from(new Set(checklistData.master.map((m: any) => m.category)));

  // Calculate overall completeness percentage
  const totalItems = checklistData.items.length;
  const completedItems = checklistData.items.filter((i: any) => i.status === 'SUDAH' || i.status === 'DIAMBIL').length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Checklist Kelengkapan & Logistik Jamaah</h2>
            <p className="text-sm text-slate-500 mt-1">
              Centang item kelengkapan di bawah ini untuk memverifikasi dokumen dan menyerahkan perlengkapan. Penyerahan logistik otomatis memotong stok gudang.
            </p>
          </div>
          {selectedJamaah && (
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200/60">
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-500">Progress Kelengkapan</div>
                <div className="text-sm font-bold text-slate-900">{completedItems} dari {totalItems} item ({progressPercent}%)</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-700 font-bold text-xs">
                {progressPercent}%
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Jamaah Selector Sidebar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm lg:col-span-1 flex flex-col h-[700px]">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Pilih Jamaah ({filteredJamaah.length})</h3>
            <input
              type="text"
              placeholder="Cari nama / paspor / no. HP..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
            />
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {filteredJamaah.map((j: any) => (
              <button
                key={j.id}
                onClick={() => selectJamaah(j)}
                className={`w-full text-left p-3 rounded-xl border transition text-sm flex flex-col gap-1 ${selectedJamaah?.id === j.id ? 'border-slate-900 bg-slate-900 text-white font-medium shadow-sm' : 'border-slate-100 hover:bg-slate-50 text-slate-700'}`}
              >
                <div className="font-semibold truncate">{j.full_name}</div>
                <div className={`text-xs flex items-center justify-between ${selectedJamaah?.id === j.id ? 'text-slate-300' : 'text-slate-400'}`}>
                  <span>{j.passport_number || 'Paspor belum'}</span>
                  <span>{j.phone || '-'}</span>
                </div>
              </button>
            ))}
            {filteredJamaah.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-400">Tidak ada jamaah ditemukan</div>
            )}
          </div>
        </div>

        {/* Interactive Checklist Detail Panel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm lg:col-span-3">
          {selectedJamaah ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedJamaah.full_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    NIK: {selectedJamaah.nik || '-'} | No. Paspor: <span className="font-medium text-slate-700">{selectedJamaah.passport_number || 'Belum diisi'}</span> | Telp: {selectedJamaah.phone || '-'}
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200 w-fit">
                  Aktif / Terdaftar
                </span>
              </div>

              {loading ? (
                <div className="py-24 text-center text-slate-400 text-sm">Memuat data checklist jamaah...</div>
              ) : (
                <div className="space-y-6 max-h-[580px] overflow-y-auto pr-2">
                  {categories.map((cat: any) => {
                    const itemsInCat = checklistData.items.filter((i: any) => i.category === cat);
                    return (
                      <div key={cat} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">{cat}</h4>
                          <span className="text-[11px] text-slate-400">
                            {itemsInCat.filter((i: any) => i.status === 'SUDAH' || i.status === 'DIAMBIL').length} / {itemsInCat.length} Selesai
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {itemsInCat.map((item: any) => {
                            const isDone = item.status === 'SUDAH' || item.status === 'DIAMBIL';
                            const isSaving = savingId === item.id;
                            return (
                              <div
                                key={item.id}
                                onClick={() => !isSaving && toggleStatus(item)}
                                className={`p-4 rounded-xl border transition cursor-pointer flex items-start gap-3.5 select-none shadow-xs ${
                                  isDone 
                                    ? 'bg-emerald-50/40 border-emerald-300/80 hover:bg-emerald-50/70' 
                                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50'
                                }`}
                              >
                                <div className="pt-0.5">
                                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                                    isDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                                  }`}>
                                    {isDone && (
                                      <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-sm font-semibold ${isDone ? 'text-emerald-900' : 'text-slate-800'}`}>
                                      {item.item_name}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                      item.status === 'SUDAH' ? 'bg-emerald-100 text-emerald-800' :
                                      item.status === 'DIAMBIL' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {item.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                                    <span>{item.item_code}</span>
                                    {item.is_inventory_linked && (
                                      <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                        📦 Potong Stok Gudang
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="py-24 text-center text-slate-400 text-sm">Pilih jamaah terlebih dahulu di sebelah kiri untuk melihat dan mencentang kelengkapan</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function ManifestTab() {
  const [manifest, setManifest] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [batchId, setBatchId] = useState('');
  const [docFilter, setDocFilter] = useState<'ALL' | 'NO_VISA' | 'NO_PASSPORT' | 'PASSPOR_RISIKO'>('ALL');
  const [ringkas, setRingkas] = useState<any>(null);

  const load = useCallback(() => {
    const q = batchId ? `?batch_id=${batchId}` : '';
    fetch('/api/admin/manifest' + q).then(r=>r.json()).then(d=>{ if(d.success){setManifest(d.manifest||[]);setBatches(d.batches||[]);setRingkas(d.ringkas||null);} });
  }, [batchId]);
  useEffect(()=>{load();},[load]);

  const filteredManifest = manifest.filter(m => {
    if (docFilter === 'NO_VISA') return m.visa_status !== 'ISSUED';
    if (docFilter === 'NO_PASSPORT') return m.passport_status !== 'SUDAH' || !m.passport_number;
    if (docFilter === 'PASSPOR_RISIKO') return m.paspor_kurang_6bulan === true || m.paspor_kedaluwarsa === true;
    return true;
  });

  const missingPassportCount = manifest.filter(m => m.passport_status !== 'SUDAH' || !m.passport_number).length;
  const missingVisaCount = manifest.filter(m => m.visa_status !== 'ISSUED').length;

  const exportExcel = () => {
    import('xlsx').then(XLSX => {
      /*
       * Kolom disusun mengikuti urutan manifest bandara (IATA/APIS):
       * nama, tanggal lahir, kewarganegaraan, jenis kelamin, nomor paspor,
       * negara penerbit, kedaluwarsa paspor — lalu data operasional.
       */
      const data = filteredManifest.map((m:any,i:number)=>({
        'No': i+1,
        'Nama (sesuai paspor)': m.full_name,
        'Tanggal Lahir': m.birth_date || '-',
        'Tempat Lahir': m.birth_place || '-',
        'Kewarganegaraan': m.nationality || 'ID',
        'JK': m.gender,
        'No. Paspor': m.passport_number || '-',
        'Negara Penerbit': m.passport_country || 'ID',
        'Tgl Terbit Paspor': m.passport_issue_date || '-',
        'Exp Paspor': m.passport_expiry || '-',
        'Sisa Hari': m.sisa_hari_paspor ?? '-',
        'Peringatan Paspor': m.paspor_kedaluwarsa ? 'KEDALUWARSA' : m.paspor_kurang_6bulan ? '< 6 BULAN' : 'OK',
        'Status Paspor': m.passport_status,
        'Status Visa': m.visa_status,
        'NIK': m.nik,
        'No. HP': m.phone,
        'Kontak Darurat': m.emergency_contact || '-',
        'Catatan Medis': m.medical_notes || '-',
        'Paket': m.package_name,
        'Batch': m.batch_name,
        'Berangkat': m.departure_date,
        'Maskapai': m.airline,
        'Hotel Makkah': m.hotel_makkah,
        'Hotel Madinah': m.hotel_madinah,
      }));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Manifest Keberangkatan");
      XLSX.writeFile(wb, `Manifest-Keberangkatan-${batchId || 'Semua'}.xlsx`);
    }).catch(() => alert('Library xlsx belum siap'));
  };

  const printManifest = () => {
    const w = window.open('', '', 'width=900,height=800');
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Manifest Keberangkatan Jamaah</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #1e293b; }
            h2, p { margin: 0 0 5px 0; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2>MANIFEST KEBERANGKATAN JAMAAH</h2>
              <p>Total Jamaah: ${filteredManifest.length} Orang</p>
            </div>
            <div><p>Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}</p></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>No</th><th>Nama (sesuai paspor)</th><th>Tgl Lahir</th><th>L/P</th><th>Kewarganegaraan</th><th>No. Paspor</th><th>Negara Penerbit</th><th>Exp Paspor</th><th>Status Visa</th><th>No. HP</th>
              </tr>
            </thead>
            <tbody>
              ${filteredManifest.map((m:any, i:number)=>`
                <tr>
                  <td>${i+1}</td>
                  <td><b>${m.full_name}</b></td>
                  <td>${m.birth_date || '-'}</td>
                  <td>${m.gender}</td>
                  <td>${m.nationality || 'ID'}</td>
                  <td>${m.passport_number || '-'}</td>
                  <td>${m.passport_country || 'ID'}</td>
                  <td style="${m.paspor_kedaluwarsa ? 'background:#fee2e2;font-weight:bold' : m.paspor_kurang_6bulan ? 'background:#fef3c7;font-weight:bold' : ''}">${m.passport_expiry || '-'}</td>
                  <td>${m.visa_status || '-'}</td>
                  <td>${m.phone || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Pilih Batch Keberangkatan</label>
            <select value={batchId} onChange={e=>setBatchId(e.target.value)} className="border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 bg-white">
              <option value="">-- Semua Batch Keberangkatan --</option>
              {batches.map((b:any)=>(<option key={b.id} value={b.id}>{b.batch_name} ({b.package_name})</option>))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Filter Dokumen</label>
            <div className="flex gap-1">
              {[
                { id: 'ALL', label: `Semua (${manifest.length})` },
                { id: 'NO_PASSPORT', label: `Belum Paspor (${missingPassportCount})` },
                { id: 'NO_VISA', label: `Belum Visa (${missingVisaCount})` },
              ].map(f=>(
                <button
                  key={f.id}
                  onClick={()=>setDocFilter(f.id as any)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition ${docFilter===f.id ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={printManifest} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition">
            🖨️ Cetak / PDF
          </button>
          <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-xs">
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Ringkasan risiko dokumen */}
      {ringkas && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Jamaah</p>
            <p className="text-lg font-black font-mono text-slate-900 mt-1">{ringkas.total_jamaah}</p>
          </div>
          <div className="bg-white rounded-2xl border border-rose-200 p-4 shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-rose-500">Paspor &lt; 6 Bulan</p>
            <p className="text-lg font-black font-mono text-rose-600 mt-1">{ringkas.paspor_kurang_6bulan}</p>
          </div>
          <div className="bg-white rounded-2xl border border-amber-200 p-4 shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-amber-600">Tanpa No. Paspor</p>
            <p className="text-lg font-black font-mono text-amber-700 mt-1">{ringkas.tanpa_nomor_paspor}</p>
          </div>
          <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Data Belum Lengkap</p>
            <p className="text-lg font-black font-mono text-slate-700 mt-1">{ringkas.data_belum_lengkap}</p>
          </div>
        </div>
      )}

      {/* Manifest Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">No</th>
              <th className="p-3">Nama (sesuai paspor)</th>
              <th className="p-3">Tgl Lahir</th>
              <th className="p-3 text-center">L/P</th>
              <th className="p-3 text-center">Kewarganegaraan</th>
              <th className="p-3">No. Paspor</th>
              <th className="p-3 text-center">Negara Penerbit</th>
              <th className="p-3">Exp Paspor</th>
              <th className="p-3">Status Visa</th>
              <th className="p-3">Kontak Darurat</th>
              <th className="p-3">Batch / Paket</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredManifest.map((m:any, i:number)=>(
              <tr key={m.id || i} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono text-slate-400">{i+1}</td>
                <td className="p-3">
                  <span className="block font-bold text-slate-900">{m.full_name}</span>
                  <span className="block text-[10px] font-mono text-slate-400">{m.nik}</span>
                </td>
                <td className="p-3 font-mono text-slate-600">{m.birth_date || <span className="text-rose-500">-</span>}</td>
                <td className="p-3 text-center text-slate-600">{m.gender}</td>
                <td className="p-3 text-center font-mono text-slate-600">{m.nationality || 'ID'}</td>
                <td className="p-3 font-mono text-slate-600">
                  {m.passport_number || <span className="text-rose-500 font-bold">belum ada</span>}
                </td>
                <td className="p-3 text-center font-mono text-slate-600">{m.passport_country || 'ID'}</td>
                <td className="p-3 font-mono">
                  {m.passport_expiry ? (
                    <span className={
                      m.paspor_kedaluwarsa ? 'text-rose-600 font-bold' :
                      m.paspor_kurang_6bulan ? 'text-amber-600 font-bold' : 'text-slate-600'
                    }>
                      {m.passport_expiry}
                      {m.paspor_kedaluwarsa && <span className="block text-[9px]">KEDALUWARSA</span>}
                      {m.paspor_kurang_6bulan && <span className="block text-[9px]">&lt; 6 bulan</span>}
                    </span>
                  ) : <span className="text-rose-500">-</span>}
                </td>
                <td className="p-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${m.visa_status==='ISSUED'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>
                    {m.visa_status || 'PENDING'}
                  </span>
                </td>
                <td className="p-3 text-[11px] text-slate-600">{m.emergency_contact || '-'}</td>
                <td className="p-3 text-slate-600">
                  <span className="block text-[11px] font-bold">{m.batch_name}</span>
                  <span className="block text-[10px] text-slate-400">{m.package_name}</span>
                </td>
              </tr>
            ))}
            {filteredManifest.length===0 && (
              <tr><td colSpan={11} className="text-center py-8 text-slate-400">Tidak ada data manifest yang sesuai dengan filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function RegistrationsTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    fetch('/api/admin/registrations').then(r=>r.json()).then(d=>{ if(d.success) setList(d.registrations||[]); }).finally(()=>setLoading(false));
  },[]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-4 border-b"><h3 className="font-bold text-gray-800">Pendaftaran Online (semua booking)</h3>
        <p className="text-xs text-gray-500">Termasuk pendaftaran mandiri dari halaman publik /register.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left">
            <th className="p-3">Kode Booking</th><th className="p-3">Jemaah Utama</th><th className="p-3">NIK</th>
            <th className="p-3">Paket / Batch</th><th className="p-3">Jemaah</th><th className="p-3">Total</th>
            <th className="p-3">Dibayar</th><th className="p-3">Status</th><th className="p-3">Terdaftar</th>
          </tr></thead>
          <tbody>
            {list.map((r:any)=>(
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{r.booking_code}</td>
                <td className="p-3">{r.full_name}</td>
                <td className="p-3 font-mono text-xs">{r.nik}</td>
                <td className="p-3 text-xs">{r.package_name}<br/><span className="text-gray-500">{r.batch_name}</span></td>
                <td className="p-3">{r.total_pilgrims} orang</td>
                <td className="p-3">{fmtRp(r.total_amount)}</td>
                <td className="p-3 text-green-600">{fmtRp(r.paid_amount)}</td>
                <td className="p-3"><StatusBadge s={r.payment_status}/></td>
                <td className="p-3 text-xs text-gray-500">{r.created_at}</td>
              </tr>
            ))}
            {!loading && list.length===0 && <tr><td colSpan={9} className="p-6 text-center text-gray-400">Belum ada pendaftaran online</td></tr>}
            {loading && <tr><td colSpan={9} className="p-6 text-center text-gray-400">Memuat...</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}
