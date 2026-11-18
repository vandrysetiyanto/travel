'use client';
import React from 'react';

export function QuickActionsBar({ setActiveTab, pendingVerification, readyCommissions }: { setActiveTab: (t: any) => void; pendingVerification: number; readyCommissions: number }) {
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
      <span className="text-xs font-bold text-slate-700">⚡ Pintasan Cepat:</span>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setActiveTab('transaksi')} className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition">
          🛍️ Buat / Cek Transaksi
        </button>
        <button onClick={() => setActiveTab('pembayaran')} className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5">
          🧾 Verifikasi Bayar {pendingVerification > 0 && <span className="px-1.5 py-0.5 bg-amber-600 text-white rounded-full text-[10px]">{pendingVerification}</span>}
        </button>
        <button onClick={() => setActiveTab('komisi')} className="px-3 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 rounded-xl text-xs font-bold transition flex items-center gap-1.5">
          💸 Pencairan Komisi {readyCommissions > 0 && <span className="px-1.5 py-0.5 bg-emerald-600 text-white rounded-full text-[10px]">{readyCommissions}</span>}
        </button>
        <button onClick={() => setActiveTab('kesiapan-kloter')} className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-800 rounded-xl text-xs font-bold transition">
          ✈️ Kesiapan Kloter
        </button>
      </div>
    </div>
  );
}
