'use client';

import { useState, useEffect, useCallback } from 'react';
import { FileText, ShieldCheck, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { ToastContainer } from './ui-dasar';

export function TrackingDokumenTab() {
  const [documents, setDocuments] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [ringkasan, setRingkasan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [filterBatch, setFilterBatch] = useState('ALL');
  const [editItem, setEditItem] = useState<any>(null);
  const [passportStatus, setPassportStatus] = useState('DI_KANTOR');
  const [visaStatus, setVisaStatus] = useState('BELUM');
  const [docNotes, setDocNotes] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/documents?status=${filterStatus}&batch_id=${filterBatch}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setDocuments(d.documents || []);
          setBatches(d.batches || []);
          setRingkasan(d.ringkasan || null);
        }
        setLoading(false);
      });
  }, [filterStatus, filterBatch]);

  useEffect(() => { loadData(); }, [loadData]);

  const openEdit = (d: any) => {
    setEditItem(d);
    setPassportStatus(d.passport_physical_status || 'DI_KANTOR');
    setVisaStatus(d.visa_physical_status || 'BELUM');
    setDocNotes(d.document_notes || '');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editItem) return;

    const res = await fetch('/api/admin/documents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPDATE_DOC_STATUS',
        jamaah_id: editItem.id,
        passport_physical_status: passportStatus,
        visa_physical_status: visaStatus,
        document_notes: docNotes,
      }),
    });
    const d = await res.json();
    if (d.success) {
      setToast({ msg: d.message, type: 'success' });
      setEditItem(null);
      loadData();
    } else {
      setToast({ msg: d.message || 'Gagal memperbarui status dokumen', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-xs gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Tracking Status Fisik Dokumen (Paspor & Visa)</h2>
          <p className="text-sm text-slate-500 mt-1">Lacak posisi fisik paspor jamaah (Di Kantor, Vendor, Kedutaan, atau Selesai).</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <select value={filterBatch} onChange={e => setFilterBatch(e.target.value)} className="p-2 rounded-xl border border-slate-200 bg-white text-xs font-bold">
            <option value="ALL">Semua Kloter</option>
            {batches.map((b: any) => (
              <option key={b.id} value={b.id}>{b.batch_name}</option>
            ))}
          </select>
          {['ALL', 'DI_KANTOR', 'VENDOR', 'KEDUTAAN', 'SELESAI'].map(st => (
            <button key={st} onClick={() => setFilterStatus(st)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${filterStatus === st ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {st === 'ALL' ? 'Semua Posisi' : st.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      {ringkasan && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-amber-200 shadow-xs">
            <p className="text-xs font-bold text-amber-600 uppercase">Di Kantor Travel</p>
            <p className="text-2xl font-black text-amber-700 mt-1 font-mono">{ringkasan.di_kantor}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs">
            <p className="text-xs font-bold text-indigo-600 uppercase">Dikirim ke Vendor</p>
            <p className="text-2xl font-black text-indigo-700 mt-1 font-mono">{ringkasan.vendor}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-purple-200 shadow-xs">
            <p className="text-xs font-bold text-purple-600 uppercase">Di Kedutaan / Konsulat</p>
            <p className="text-2xl font-black text-purple-700 mt-1 font-mono">{ringkasan.kedutaan}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
            <p className="text-xs font-bold text-emerald-600 uppercase">Selesai / Di Pegangan</p>
            <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">{ringkasan.selesai}</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center py-12 text-slate-400">Memuat data dokumen...</p>
      ) : documents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          Tidak ada data dokumen jamaah dengan filter ini.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
              <tr>
                <th className="p-3">Nama Jamaah</th>
                <th className="p-3">No. Paspor</th>
                <th className="p-3">Kloter / Paket</th>
                <th className="p-3 text-center">Posisi Fisik Paspor</th>
                <th className="p-3 text-center">Status Visa</th>
                <th className="p-3">Catatan / Kurir</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {documents.map((d: any) => (
                <tr key={d.id} className="hover:bg-slate-50/50">
                  <td className="p-3">
                    <span className="font-bold text-slate-900 block">{d.full_name}</span>
                    <span className="font-mono text-[10px] text-slate-400">{d.nik}</span>
                  </td>
                  <td className="p-3 font-mono text-slate-600">{d.passport_number || <span className="text-rose-500">Belum ada</span>}</td>
                  <td className="p-3 text-slate-600">
                    <span className="font-bold block">{d.batch_name || '-'}</span>
                    <span className="text-[10px] text-slate-400">{d.package_name || '-'}</span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      d.passport_physical_status === 'SELESAI' ? 'bg-emerald-50 text-emerald-700' :
                      d.passport_physical_status === 'KEDUTAAN' ? 'bg-purple-50 text-purple-700' :
                      d.passport_physical_status === 'VENDOR' ? 'bg-indigo-50 text-indigo-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {d.passport_physical_status || 'DI_KANTOR'}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${d.visa_physical_status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                      {d.visa_physical_status || 'BELUM'}
                    </span>
                  </td>
                  <td className="p-3 text-slate-600 max-w-xs truncate">{d.document_notes || '-'}</td>
                  <td className="p-3 text-right">
                    <button onClick={() => openEdit(d)} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200">
                      Ubah Posisi
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Edit Posisi Dokumen */}
      {editItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl space-y-4">
            <h3 className="text-lg font-bold text-slate-900">Ubah Posisi Dokumen</h3>
            <p className="text-xs text-slate-500">Jamaah: <b>{editItem.full_name}</b> | Paspor: <span className="font-mono">{editItem.passport_number || '-'}</span></p>
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Posisi Fisik Paspor</label>
                <select value={passportStatus} onChange={e => setPassportStatus(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-indigo-600">
                  <option value="DI_KANTOR">Di Kantor Travel</option>
                  <option value="VENDOR">Dikirim ke Vendor Pengurusan</option>
                  <option value="KEDUTAAN">Di Kedutaan / Konsulat Saudi</option>
                  <option value="SELESAI">Selesai / Dipegang Tour Leader</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Status Fisik Visa</label>
                <select value={visaStatus} onChange={e => setVisaStatus(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 bg-white">
                  <option value="BELUM">Belum Proses</option>
                  <option value="PROSES">Sedang Diproses</option>
                  <option value="APPROVED">Approved / Issued</option>
                  <option value="REJECTED">Rejected</option>
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Dokumen / Kurir</label>
                <textarea value={docNotes} onChange={e => setDocNotes(e.target.value)} rows={3} placeholder="Cth. Dikirim via JNE nomor resi JNE-..." className="w-full p-2.5 rounded-xl border border-slate-200" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setEditItem(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold">Batal</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-sm hover:bg-emerald-700">Simpan Perubahan</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <ToastContainer toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
