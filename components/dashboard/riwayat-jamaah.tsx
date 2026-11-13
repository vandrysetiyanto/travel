'use client';

import React, { useEffect, useState } from 'react';
import { EmptyState } from '@/components/dashboard/ui-dasar';
import { fmtRp } from '@/components/dashboard/format';

/**
 * Riwayat Jamaah per Paket & Batch.
 *
 * Menjawab pertanyaan yang sebelumnya tidak bisa dijawab sistem:
 * "jamaah ini sudah ikut paket apa dan kloter mana saja?"
 * Satu baris = satu jamaah (bukan satu transaksi), dengan riwayat yang bisa
 * dibuka. Data diambil dari /api/admin/jamaah/riwayat.
 */

type Riwayat = {
  transaction_id: number;
  booking_code: string;
  package_name: string;
  category: string;
  batch_name: string;
  departure_date: string;
  return_date: string;
  status_booking: string;
  total_amount: number;
  paid_amount: number;
  remaining_amount: number;
};

type BarisJamaah = {
  jamaah_id: number;
  nik: string;
  full_name: string;
  phone: string;
  jumlah_keberangkatan: number;
  jumlah_batal: number;
  jumlah_paket_berbeda: number;
  berulang: boolean;
  status_terkini: 'AKTIF' | 'SELESAI' | 'BATAL' | 'BELUM_PERNAH';
  terakhir: { package_name: string; batch_name: string; departure_date: string; status_booking: string } | null;
  riwayat: Riwayat[];
};

const WARNA_STATUS: Record<string, string> = {
  AKTIF: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SELESAI: 'bg-slate-100 text-slate-600 border-slate-200',
  BATAL: 'bg-rose-50 text-rose-700 border-rose-200',
  BELUM_PERNAH: 'bg-amber-50 text-amber-700 border-amber-200',
};

const TEKS_STATUS: Record<string, string> = {
  AKTIF: 'Aktif',
  SELESAI: 'Selesai',
  BATAL: 'Dibatalkan',
  BELUM_PERNAH: 'Belum pernah',
};

export function RiwayatJamaahTab() {
  const [data, setData] = useState<BarisJamaah[]>([]);
  const [ringkas, setRingkas] = useState<any>(null);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState('');
  const [cari, setCari] = useState('');
  const [hanyaBerulang, setHanyaBerulang] = useState(false);
  const [terbuka, setTerbuka] = useState<number | null>(null);

  const muat = () => {
    setMemuat(true);
    setGagal('');
    const q = new URLSearchParams();
    if (cari.trim()) q.set('search', cari.trim());
    if (hanyaBerulang) q.set('berulang', '1');
    fetch(`/api/admin/jamaah/riwayat?${q.toString()}`)
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.success) throw new Error(d.message || 'Gagal memuat');
        setData(d.jamaah || []);
        setRingkas(d.ringkas || null);
      })
      .catch((e) => setGagal(e.message || 'Gagal memuat data'))
      .finally(() => setMemuat(false));
  };

  useEffect(() => { muat(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [hanyaBerulang]);

  return (
    <div className="space-y-4">
      {/* Ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: 'Total Jamaah', nilai: ringkas?.total_jamaah ?? 0, warna: 'text-slate-900' },
          { label: 'Berulang (≥2x)', nilai: ringkas?.berulang ?? 0, warna: 'text-indigo-600' },
          { label: 'Aktif', nilai: ringkas?.aktif ?? 0, warna: 'text-emerald-600' },
          { label: 'Selesai', nilai: ringkas?.selesai ?? 0, warna: 'text-slate-600' },
          { label: 'Belum Pernah', nilai: ringkas?.belum_pernah ?? 0, warna: 'text-amber-600' },
        ].map((k) => (
          <div key={k.label} className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
            <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{k.label}</p>
            <p className={`text-xl font-black font-mono mt-1 ${k.warna}`}>{k.nilai}</p>
          </div>
        ))}
      </div>

      {/* Pencarian & filter */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center gap-2">
        <input
          value={cari}
          onChange={(e) => setCari(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && muat()}
          placeholder="Cari nama, NIK, atau nomor HP…"
          className="flex-1 min-w-[220px] px-3 py-2 text-xs border border-slate-200 rounded-xl"
        />
        <label className="flex items-center gap-2 text-xs font-bold text-slate-600 px-2">
          <input type="checkbox" checked={hanyaBerulang} onChange={(e) => setHanyaBerulang(e.target.checked)}
            className="w-3.5 h-3.5 accent-slate-900" />
          Hanya yang berulang
        </label>
        <button onClick={muat} className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800">
          Cari
        </button>
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
        {memuat ? (
          <p className="text-center py-10 text-slate-400 text-sm">Memuat riwayat…</p>
        ) : gagal ? (
          <div className="py-10 text-center">
            <p className="text-sm text-rose-600 font-bold">{gagal}</p>
            <button onClick={muat} className="mt-3 px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50">
              Coba lagi
            </button>
          </div>
        ) : data.length === 0 ? (
          <EmptyState
            icon="📋"
            title="Belum ada data jamaah"
            description="Riwayat akan muncul setelah ada jamaah yang terdaftar pada sebuah paket dan kloter."
          />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
                <th className="p-3">Jamaah</th>
                <th className="p-3 text-center">Umroh ke-</th>
                <th className="p-3">Terakhir</th>
                <th className="p-3 text-center">Paket</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.map((j) => (
                <React.Fragment key={j.jamaah_id}>
                  <tr className="hover:bg-slate-50 transition">
                    <td className="p-3">
                      <span className="block font-bold text-slate-900">{j.full_name}</span>
                      <span className="block text-[10px] text-slate-400 font-mono">{j.nik}</span>
                    </td>
                    <td className="p-3 text-center">
                      <span className="font-mono font-black text-slate-900">{j.jumlah_keberangkatan}</span>
                      {j.berulang && <span className="ml-1 text-[9px] font-bold text-indigo-600">berulang</span>}
                      {j.jumlah_batal > 0 && (
                        <span className="block text-[9px] text-rose-500">{j.jumlah_batal} batal</span>
                      )}
                    </td>
                    <td className="p-3">
                      {j.terakhir ? (
                        <>
                          <span className="block text-slate-700">{j.terakhir.package_name}</span>
                          <span className="block text-[10px] text-slate-400">
                            {j.terakhir.batch_name} · {j.terakhir.departure_date}
                          </span>
                        </>
                      ) : (
                        <span className="text-slate-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-center font-mono text-slate-600">{j.jumlah_paket_berbeda}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${WARNA_STATUS[j.status_terkini]}`}>
                        {TEKS_STATUS[j.status_terkini]}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {j.riwayat.length > 0 ? (
                        <button onClick={() => setTerbuka(terbuka === j.jamaah_id ? null : j.jamaah_id)}
                          className="text-indigo-600 hover:underline font-bold">
                          {terbuka === j.jamaah_id ? 'Tutup' : `Lihat ${j.riwayat.length}`}
                        </button>
                      ) : (
                        <span className="text-slate-300">—</span>
                      )}
                    </td>
                  </tr>

                  {terbuka === j.jamaah_id && (
                    <tr className="bg-slate-50/70">
                      <td colSpan={6} className="p-0">
                        <div className="p-4 space-y-1.5">
                          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">
                            Riwayat keberangkatan (urut waktu)
                          </p>
                          {j.riwayat.map((r, i) => (
                            <div key={r.transaction_id} className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-slate-200/70 px-3 py-2">
                              <span className="flex items-center gap-2">
                                <span className="w-5 h-5 rounded-full bg-slate-900 text-white text-[10px] font-bold flex items-center justify-center">{i + 1}</span>
                                <span>
                                  <span className="block text-[11px] font-bold text-slate-900">{r.package_name}</span>
                                  <span className="block text-[10px] text-slate-500">
                                    {r.batch_name} · {r.departure_date} s/d {r.return_date} · {r.booking_code}
                                  </span>
                                </span>
                              </span>
                              <span className="flex items-center gap-3">
                                <span className="text-right">
                                  <span className="block text-[10px] text-slate-400">Dibayar</span>
                                  <span className="block text-[11px] font-mono font-bold text-emerald-600">{fmtRp(r.paid_amount)}</span>
                                </span>
                                {r.remaining_amount > 0 && (
                                  <span className="text-right">
                                    <span className="block text-[10px] text-slate-400">Sisa</span>
                                    <span className="block text-[11px] font-mono font-bold text-rose-600">{fmtRp(r.remaining_amount)}</span>
                                  </span>
                                )}
                                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  r.status_booking === 'CANCELLED' ? 'bg-rose-50 text-rose-700' :
                                  r.status_booking === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                                  'bg-amber-50 text-amber-700'
                                }`}>
                                  {r.status_booking}
                                </span>
                              </span>
                            </div>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        Satu baris = satu jamaah. "Umroh ke-" menghitung keberangkatan yang tidak dibatalkan.
        Data diambil langsung dari relasi jamaah → batch → paket.
      </p>
    </div>
  );
}
