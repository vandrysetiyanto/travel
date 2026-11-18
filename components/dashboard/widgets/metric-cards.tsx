'use client';
import React from 'react';
import { fmt, fmtRp } from '../format';

export function PrimaryMetricCards({ isOwner, stats }: { isOwner: boolean; stats: any }) {
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
    <div className="space-y-4">
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

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {statusCards.map((c, i) => (
          <div key={i} className="bg-white border border-slate-200/70 rounded-xl px-4 py-3 flex items-center justify-between shadow-2xs">
            <span className="text-xs font-semibold text-slate-600">{c.label}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${c.badge}`}>{c.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
