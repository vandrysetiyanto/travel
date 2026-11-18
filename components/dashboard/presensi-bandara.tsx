'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plane, CheckCircle2, QrCode, Users, Luggage } from 'lucide-react';
import { ToastContainer } from './ui-dasar';

export function PresensiBandaraTab() {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [pilgrims, setPilgrims] = useState<any[]>([]);
  const [ringkasan, setRingkasan] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadBatches = useCallback(() => {
    fetch('/api/admin/attendance')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBatches(d.batches || []);
          if (d.batches?.length > 0 && !selectedBatchId) {
            setSelectedBatchId(d.batches[0].id);
          }
        }
      });
  }, [selectedBatchId]);

  const loadPilgrims = useCallback(() => {
    if (!selectedBatchId) return;
    setLoading(true);
    fetch(`/api/admin/attendance?batch_id=${selectedBatchId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPilgrims(d.pilgrims || []);
          setRingkasan(d.ringkasan || null);
        }
        setLoading(false);
      });
  }, [selectedBatchId]);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { if (selectedBatchId) loadPilgrims(); }, [selectedBatchId, loadPilgrims]);

  const updateStatus = async (jamaahId: number, status: string) => {
    const res = await fetch('/api/admin/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'UPDATE_ATTENDANCE',
        jamaah_id: jamaahId,
        attendance_status: status,
      }),
    });
    const d = await res.json();
    if (d.success) {
      setToast({ msg: d.message, type: 'success' });
      loadPilgrims();
    } else {
      setToast({ msg: d.message || 'Gagal update presensi', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-xs gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Presensi Bandara & QR Koper Jamaah</h2>
          <p className="text-sm text-slate-500 mt-1">Check-in keberangkatan jamaah di bandara dan verifikasi label tag koper.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select value={selectedBatchId || ''} onChange={e => setSelectedBatchId(Number(e.target.value))} className="p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold w-full md:w-64">
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.batch_name}</option>
            ))}
          </select>
        </div>
      </div>

      {ringkasan && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-slate-400 uppercase">Belum Hadir</p>
            <p className="text-2xl font-black text-amber-600 mt-1 font-mono">{ringkasan.belum_hadir}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
            <p className="text-xs font-bold text-emerald-600 uppercase">Hadir di Bandara</p>
            <p className="text-2xl font-black text-emerald-700 mt-1 font-mono">{ringkasan.hadir_bandara}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-indigo-200 shadow-xs">
            <p className="text-xs font-bold text-indigo-600 uppercase">Boarding / Berangkat</p>
            <p className="text-2xl font-black text-indigo-700 mt-1 font-mono">{ringkasan.boarding}</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center py-12 text-slate-400">Memuat data presensi...</p>
      ) : pilgrims.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          Belum ada jamaah terdaftar di kloter ini.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
              <tr>
                <th className="p-3">Nama Jamaah</th>
                <th className="p-3">No. HP</th>
                <th className="p-3">QR Tag Koper</th>
                <th className="p-3 text-center">Status Presensi</th>
                <th className="p-3 text-right">Aksi Check-in</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pilgrims.map((p: any) => (
                <tr key={p.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-900">{p.full_name} <span className="block text-[10px] text-slate-400 font-mono">{p.nik}</span></td>
                  <td className="p-3 font-mono text-slate-600">{p.phone || '-'}</td>
                  <td className="p-3 font-mono text-indigo-600 font-bold">{p.luggage_tag_code || <span className="text-slate-400 font-normal">Belum di-generate</span>}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      p.attendance_status === 'BOARDING' ? 'bg-indigo-50 text-indigo-700' :
                      p.attendance_status === 'HADIR_BANDARA' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'
                    }`}>
                      {p.attendance_status || 'BELUM_HADIR'}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    <button onClick={() => updateStatus(p.id, 'HADIR_BANDARA')} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700">
                      Hadir
                    </button>
                    <button onClick={() => updateStatus(p.id, 'BOARDING')} className="px-2.5 py-1 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700">
                      Boarding
                    </button>
                    <button onClick={() => updateStatus(p.id, 'BELUM_HADIR')} className="px-2.5 py-1 bg-slate-100 text-slate-600 rounded-lg font-bold hover:bg-slate-200">
                      Reset
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <ToastContainer toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
