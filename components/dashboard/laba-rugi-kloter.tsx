'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { EmptyState } from '@/components/dashboard/ui-dasar';
import { fmtRp } from '@/components/dashboard/format';

/**
 * Laba Rugi per Kloter (cost center).
 *
 * Ini tampilan dari data yang sudah dihitung server (`per_kloter` di
 * /api/admin/financial). Sebelumnya angka itu hanya bisa dilihat lewat API —
 * staf tidak punya cara membaca margin per keberangkatan.
 *
 * Yang ditampilkan:
 *   - kartu ringkasan (pendapatan, beban, laba, margin rata-rata)
 *   - tabel per kloter: pendapatan, beban, laba kotor, margin %, jumlah jamaah
 *   - baris "belum teralokasi" DIPISAH dan ditandai, karena itu biaya nyata
 *     yang belum dibebankan ke keberangkatan mana pun — bukan diabaikan
 */

type Kloter = {
  batch_id: number | null;
  batch_name: string;
  package_name: string | null;
  departure_date: string | null;
  return_date: string | null;
  status_batch: string | null;
  jumlah_jamaah: number;
  pendapatan: number;
  beban: number;
  laba_kotor: number;
  margin_persen: number;
};

type Data = {
  per_kloter: Kloter[];
  belum_teralokasi: { pendapatan: number; beban: number; laba_kotor: number };
  total: { pendapatan: number; beban: number; laba_kotor: number };
};

export function LabaRugiKloterTab() {
  const [data, setData] = useState<Data | null>(null);
  const [memuat, setMemuat] = useState(true);
  const [gagal, setGagal] = useState('');
  const [urut, setUrut] = useState<'tanggal' | 'laba' | 'margin'>('tanggal');
  const [hanyaBerjalan, setHanyaBerjalan] = useState(false);

  const muat = () => {
    setMemuat(true);
    setGagal('');
    fetch('/api/admin/financial?period=ALL')
      .then(async (r) => {
        const d = await r.json().catch(() => ({}));
        if (!r.ok || !d.success) throw new Error(d.message || 'Gagal memuat laporan');
        if (!d.per_kloter) throw new Error('Data per kloter tidak tersedia');
        setData(d.per_kloter as Data);
      })
      .catch((e) => setGagal(e.message || 'Gagal memuat'))
      .finally(() => setMemuat(false));
  };

  useEffect(() => { muat(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, []);

  const daftar = useMemo(() => {
    if (!data) return [];
    let d = [...data.per_kloter];
    // Kloter tanpa aktivitas (pendapatan & beban nol) disembunyikan agar tabel terbaca;
    // tetap bisa dilihat dengan menghapus centang? -> tidak: kita tampilkan semua,
    // tetapi yang kosong diletakkan di bawah.
    if (hanyaBerjalan) d = d.filter((k) => k.status_batch !== 'CLOSED');

    if (urut === 'laba') d.sort((a, b) => b.laba_kotor - a.laba_kotor);
    else if (urut === 'margin') d.sort((a, b) => b.margin_persen - a.margin_persen);
    else d.sort((a, b) => String(b.departure_date || '').localeCompare(String(a.departure_date || '')));

    /*
     * Kloter tanpa mutasi SELALU diletakkan paling bawah, apa pun urutannya.
     *
     * Sort sebelumnya menimpa urutan sebelumnya (sort dipanggil lagi), sehingga
     * pengurutan tanggal/laba/margin hilang dan baris kosong bisa muncul di
     * tengah. Sekarang: pisahkan dulu, urutkan masing-masing, lalu gabung.
     */
    const adaData = d.filter((k) => !(k.pendapatan === 0 && k.beban === 0));
    const kosong = d.filter((k) => k.pendapatan === 0 && k.beban === 0);
    return [...adaData, ...kosong];
  }, [data, urut, hanyaBerjalan]);

  const marginRata = data && data.total.pendapatan > 0
    ? Math.round((data.total.laba_kotor / data.total.pendapatan) * 1000) / 10
    : 0;

  if (memuat) return <p className="text-center py-12 text-slate-400 text-sm">Memuat laporan per kloter…</p>;

  if (gagal) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200/80 p-10 text-center">
        <p className="text-sm text-rose-600 font-bold">{gagal}</p>
        <button onClick={muat} className="mt-3 px-4 py-2 text-xs font-bold border border-slate-200 rounded-xl hover:bg-slate-50">
          Coba lagi
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-4">
      {/* Kartu ringkasan */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Pendapatan</p>
          <p className="text-lg font-black font-mono text-slate-900 mt-1">{fmtRp(data.total.pendapatan)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Total Beban</p>
          <p className="text-lg font-black font-mono text-rose-600 mt-1">{fmtRp(data.total.beban)}</p>
        </div>
        <div className="bg-slate-900 text-white rounded-2xl border border-slate-900 p-4 shadow-xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Laba Kotor</p>
          <p className={`text-lg font-black font-mono mt-1 ${data.total.laba_kotor >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
            {fmtRp(data.total.laba_kotor)}
          </p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs">
          <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Margin Rata-rata</p>
          <p className={`text-lg font-black font-mono mt-1 ${marginRata >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {marginRata}%
          </p>
        </div>
      </div>

      {/* Peringatan beban belum teralokasi */}
      {(data.belum_teralokasi.pendapatan !== 0 || data.belum_teralokasi.beban !== 0) && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <p className="text-xs font-black text-amber-900">Ada biaya yang belum dibebankan ke kloter</p>
          <p className="text-[11px] text-amber-800 mt-1">
            Pendapatan {fmtRp(data.belum_teralokasi.pendapatan)} · Beban {fmtRp(data.belum_teralokasi.beban)} ·
            Laba {fmtRp(data.belum_teralokasi.laba_kotor)}.
            Isi kolom <b>Kloter</b> saat mencatat beban agar masuk ke margin keberangkatan yang tepat.
          </p>
        </div>
      )}

      {/* Kontrol */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-wrap items-center gap-2">
        <span className="text-[11px] font-bold text-slate-500">Urutkan:</span>
        {([['tanggal', 'Tanggal'], ['laba', 'Laba'], ['margin', 'Margin']] as const).map(([k, label]) => (
          <button key={k} onClick={() => setUrut(k)}
            className={`px-3 py-1.5 rounded-lg text-[11px] font-bold transition ${urut === k ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            {label}
          </button>
        ))}
        <label className="ml-auto flex items-center gap-2 text-[11px] font-bold text-slate-600">
          <input type="checkbox" checked={hanyaBerjalan} onChange={(e) => setHanyaBerjalan(e.target.checked)}
            className="w-3.5 h-3.5 accent-slate-900" />
          Sembunyikan kloter CLOSED
        </label>
      </div>

      {/* Tabel */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-x-auto">
        {daftar.length === 0 ? (
          <EmptyState icon="📊" title="Belum ada kloter" description="Buat jadwal keberangkatan dan catat pendapatan/beban untuk melihat margin per kloter." />
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
                <th className="p-3">Kloter</th>
                <th className="p-3 text-center">Berangkat</th>
                <th className="p-3 text-center">Jamaah</th>
                <th className="p-3 text-right">Pendapatan</th>
                <th className="p-3 text-right">Beban</th>
                <th className="p-3 text-right">Laba Kotor</th>
                <th className="p-3 text-center">Margin</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {daftar.map((k) => {
                const kosong = k.pendapatan === 0 && k.beban === 0;
                return (
                  <tr key={String(k.batch_id)} className={`hover:bg-slate-50 transition ${kosong ? 'opacity-60' : ''}`}>
                    <td className="p-3">
                      <span className="block font-bold text-slate-900">{k.batch_name}</span>
                      <span className="block text-[10px] text-slate-400">{k.package_name || '-'}</span>
                    </td>
                    <td className="p-3 text-center font-mono text-[11px] text-slate-500">{k.departure_date || '-'}</td>
                    <td className="p-3 text-center font-mono font-bold text-slate-700">{k.jumlah_jamaah}</td>
                    <td className="p-3 text-right font-mono text-slate-800">{fmtRp(k.pendapatan)}</td>
                    <td className="p-3 text-right font-mono text-rose-600">{fmtRp(k.beban)}</td>
                    <td className={`p-3 text-right font-mono font-bold ${k.laba_kotor >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {fmtRp(k.laba_kotor)}
                    </td>
                    <td className="p-3 text-center">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        k.pendapatan === 0 ? 'bg-slate-100 text-slate-500' :
                        k.margin_persen >= 25 ? 'bg-emerald-50 text-emerald-700' :
                        k.margin_persen >= 10 ? 'bg-amber-50 text-amber-700' :
                        'bg-rose-50 text-rose-700'
                      }`}>
                        {k.pendapatan === 0 ? '—' : `${k.margin_persen}%`}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-slate-50 border-t-2 border-slate-200 font-black">
                <td className="p-3 text-slate-900" colSpan={3}>TOTAL (termasuk belum teralokasi)</td>
                <td className="p-3 text-right font-mono">{fmtRp(data.total.pendapatan)}</td>
                <td className="p-3 text-right font-mono text-rose-600">{fmtRp(data.total.beban)}</td>
                <td className={`p-3 text-right font-mono ${data.total.laba_kotor >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {fmtRp(data.total.laba_kotor)}
                </td>
                <td className="p-3 text-center font-mono">{marginRata}%</td>
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <p className="text-[10px] text-slate-400 text-center">
        Margin = (laba kotor ÷ pendapatan) × 100. Kloter tanpa pendapatan ditandai "—" agar tidak menyesatkan.
        Pendapatan dihitung dari akun grup Pendapatan; beban dari akun grup Beban di buku besar.
      </p>
    </div>
  );
}
