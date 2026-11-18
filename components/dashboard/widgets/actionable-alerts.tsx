'use client';
import React from 'react';
import { fmtRp } from '../format';

export function ActionableAlertsBanner({ stats, setActiveTab }: { stats: any; setActiveTab: (t: any) => void }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      <div className="bg-gradient-to-br from-indigo-900 to-slate-900 text-white p-5 rounded-2xl shadow-sm flex flex-col justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-indigo-300">🚀 Kloter Keberangkatan Terdekat</span>
          {stats.nextBatch ? (
            <div className="mt-2">
              <h4 className="text-base font-black">{stats.nextBatch.batch_name}</h4>
              <p className="text-xs text-indigo-200 mt-0.5">{stats.nextBatch.package_name}</p>
              <p className="text-xs font-mono text-emerald-400 mt-2 font-bold">📅 {stats.nextBatch.departure_date}</p>
            </div>
          ) : (
            <p className="text-xs text-slate-400 mt-2">Tidak ada jadwal keberangkatan terdekat.</p>
          )}
        </div>
        {stats.nextBatch && (
          <button onClick={() => setActiveTab('kesiapan-kloter')} className="mt-4 text-xs font-bold text-indigo-300 hover:text-white underline text-left">
            Lihat Kesiapan Kloter &rarr;
          </button>
        )}
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">⚠️ Perhatian & Peringatan</span>
          <div className="mt-2 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Pembayaran Menunggu Verifikasi:</span>
              <span className={`font-bold font-mono ${stats.pendingVerification > 0 ? 'text-amber-600' : 'text-slate-600'}`}>{stats.pendingVerification} Trx</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Komisi Siap Dicairkan:</span>
              <span className="font-bold font-mono text-emerald-600">{fmtRp(stats.readyCommissions || 0)}</span>
            </div>
          </div>
        </div>
        <button onClick={() => setActiveTab('pembayaran')} className="mt-4 text-xs font-bold text-emerald-600 hover:underline text-left">
          Kelola Antrean &rarr;
        </button>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col justify-between">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">🛂 Dokumen & Paspor</span>
          <div className="mt-2 space-y-2 text-xs">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Paspor Belum / Perlu Dilengkapi:</span>
              <span className="font-bold font-mono text-rose-600">{stats.passportRisks || 0} Jamaah</span>
            </div>
          </div>
        </div>
        <button onClick={() => setActiveTab('tracking-dokumen')} className="mt-4 text-xs font-bold text-indigo-600 hover:underline text-left">
          Buka Tracking Dokumen &rarr;
        </button>
      </div>
    </div>
  );
}
