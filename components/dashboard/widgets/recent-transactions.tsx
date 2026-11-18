'use client';
import React from 'react';
import { fmtRp } from '../format';
import { StatusBadge, EmptyState } from '../ui-dasar';

export function RecentTransactionsTable({ recent }: { recent: any[] }) {
  return (
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
  );
}
