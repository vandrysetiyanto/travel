'use client';

import { useState, useEffect, useCallback } from 'react';
import { Plane, CheckCircle2, AlertCircle, Users, Wallet, ShieldCheck, FileCheck } from 'lucide-react';

export function KesiapanKloterTab() {
  const [readiness, setReadiness] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/reports/readiness')
      .then(r => r.json())
      .then(d => {
        if (d.success) setReadiness(d.readiness || []);
        setLoading(false);
      });
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dashboard Kesiapan Operasional Kloter</h2>
          <p className="text-sm text-slate-500 mt-1">Pemantauan persentase kesiapan keberangkatan: pelunasan, paspor, visa, dan checklist.</p>
        </div>
        <button onClick={loadData} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl text-xs font-bold hover:bg-slate-200 transition">
          Muat Ulang
        </button>
      </div>

      {loading ? (
        <p className="text-center py-12 text-slate-400">Memuat data kesiapan kloter...</p>
      ) : readiness.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          Belum ada jadwal batch / kloter keberangkatan.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {readiness.map((b: any) => (
            <div key={b.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700">
                      {b.status}
                    </span>
                    <h3 className="text-lg font-bold text-slate-900 mt-1.5">{b.batch_name}</h3>
                    <p className="text-xs text-slate-500">{b.package_name} • Maskapai: <b>{b.airline || '-'}</b></p>
                  </div>
                  <div className="text-right">
                    <span className="text-2xl font-black font-mono text-emerald-600">{b.readiness_score}%</span>
                    <p className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">Kesiapan</p>
                  </div>
                </div>

                {/* Progress bar */}
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden mt-4">
                  <div className={`h-full rounded-full transition-all duration-500 ${b.readiness_score >= 80 ? 'bg-emerald-500' : b.readiness_score >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${b.readiness_score}%` }}></div>
                </div>

                {/* Grid Indikator */}
                <div className="grid grid-cols-2 gap-3 mt-4 text-xs">
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5"><Users className="w-3.5 h-3.5 text-slate-400" /> Jamaah / Kuota</span>
                    <span className="font-mono font-bold text-slate-900">{b.total_jamaah} / {b.quota}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5"><Wallet className="w-3.5 h-3.5 text-emerald-500" /> Lunas</span>
                    <span className="font-mono font-bold text-emerald-600">{b.lunas_count} / {b.total_jamaah}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5"><ShieldCheck className="w-3.5 h-3.5 text-indigo-500" /> Paspor Aman</span>
                    <span className="font-mono font-bold text-indigo-600">{b.paspor_count} / {b.total_jamaah}</span>
                  </div>
                  <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                    <span className="text-slate-500 flex items-center gap-1.5"><FileCheck className="w-3.5 h-3.5 text-amber-500" /> Visa Issued</span>
                    <span className="font-mono font-bold text-amber-600">{b.visa_count} / {b.total_jamaah}</span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex justify-between items-center text-xs text-slate-500">
                <span>Keberangkatan: <b className="text-slate-800">{b.departure_date}</b></span>
                <span>Pulang: <b className="text-slate-800">{b.return_date || '-'}</b></span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
