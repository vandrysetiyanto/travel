'use client';
import React from 'react';
import { fmtRp } from '../format';

export function RevenueTrendChart({ isOwner, monthly }: { isOwner: boolean; monthly: any[] }) {
  if (!isOwner || monthly.length === 0) return null;
  const maxAmt = Math.max(...monthly.map((m: any) => m.amount), 1);
  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-base font-bold text-slate-900">📈 Tren Omset & Penerimaan Bulanan</h3>
          <p className="text-xs text-slate-500">Akumulasi penerimaan pembayaran terverifikasi dalam beberapa bulan terakhir.</p>
        </div>
      </div>
      <div className="h-48 flex items-end gap-3 pt-6 pb-2 px-2 border-b border-slate-100">
        {monthly.map((m: any, idx: number) => {
          const heightPct = Math.max(12, Math.round((m.amount / maxAmt) * 100));
          return (
            <div key={idx} className="flex-1 flex flex-col items-center gap-2 h-full justify-end group relative">
              <div className="absolute -top-10 opacity-0 group-hover:opacity-100 transition bg-slate-900 text-white text-[10px] font-mono py-1 px-2 rounded-lg pointer-events-none whitespace-nowrap shadow-md z-10">
                {m.label}: {fmtRp(m.amount)}
              </div>
              <span className="text-[10px] font-mono font-bold text-slate-600 group-hover:text-emerald-600 transition">
                {m.amount > 0 ? (m.amount >= 1e6 ? `${(m.amount/1e6).toFixed(1)}jt` : fmtRp(m.amount)) : '0'}
              </span>
              <div className="w-full bg-emerald-500/90 group-hover:bg-emerald-600 rounded-t-xl transition-all duration-300" style={{ height: `${heightPct}%` }}></div>
              <span className="text-[11px] font-bold text-slate-500 mt-1 truncate max-w-full">{m.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
