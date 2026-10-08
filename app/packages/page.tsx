'use client';

import React, { useState, useEffect } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import { formatRupiah } from '@/lib/utils';
import { Plane, Clock, ArrowRight, Building, Sparkles } from 'lucide-react';

export default function PackagesPage() {
  const [packages, setPackages] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch('/api/master/packages').then(r => r.json()),
      fetch('/api/admin/packages').then(r => r.json())
    ]).then(([pkgData, batchData]) => {
      if (pkgData.success) setPackages(pkgData.packages || []);
      if (batchData.success) setBatches(batchData.batches || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  const categories = ['ALL', 'Umroh Reguler', 'Umroh VIP', 'Umroh Plus'];

  const filteredPackages = packages.filter(p => {
    if (selectedCategory === 'ALL') return true;
    return p.category?.toLowerCase() === selectedCategory.toLowerCase();
  });

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] text-slate-900 selection:bg-slate-900 selection:text-white">
      <Navbar />
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14 flex-1 w-full">
        {/* Header Title */}
        <div className="max-w-2xl mb-8 space-y-2">
          <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Katalog Resmi</span>
          <h1 className="text-3xl sm:text-4xl font-black text-slate-900 tracking-tight">Daftar Paket Umroh</h1>
          <p className="text-sm text-slate-500 leading-relaxed">
            Seluruh paket dilengkapi fasilitas hotel dekat Masjidil Haram, tiket pesawat direct, muthawif, dan perlengkapan lengkap.
          </p>
        </div>

        {/* Category Filter Chips */}
        <div className="flex flex-wrap gap-2 mb-8 pb-4 border-b border-slate-200/70">
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                selectedCategory === cat
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              {cat === 'ALL' ? 'Semua Kategori' : cat}
            </button>
          ))}
        </div>

        {/* Packages Grid */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-80 bg-slate-200/60 animate-pulse rounded-2xl border border-slate-200" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {filteredPackages.map(pkg => {
              const pkgBatches = batches.filter(b => b.package_id === pkg.id);
              const isVip = pkg.category?.toLowerCase().includes('vip') || pkg.price > 35000000;

              return (
                <div
                  key={pkg.id}
                  className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100">
                        {pkg.category}
                      </span>
                      {isVip && (
                        <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md inline-flex items-center gap-1">
                          <Sparkles className="w-3 h-3" /> Pilihan Utama
                        </span>
                      )}
                    </div>

                    <div>
                      <h3 className="font-extrabold text-slate-900 text-base leading-snug">{pkg.name}</h3>
                      <div className="mt-2 flex items-baseline gap-1">
                        <span className="text-2xl font-black text-slate-900 tracking-tight">{formatRupiah(pkg.price)}</span>
                        <span className="text-xs text-slate-400">/ pax</span>
                      </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Durasi: <b className="text-slate-800">{pkg.duration_days} Hari</b></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Plane className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>Maskapai: <b className="text-slate-800">{pkg.airline}</b></span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Building className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">Hotel: <b className="text-slate-800">{pkg.hotel_makkah?.split('(')[0]}</b></span>
                      </div>
                    </div>

                    {/* Batch Quota Information */}
                    {pkgBatches.length > 0 && (
                      <div className="pt-3 border-t border-slate-100 space-y-1.5">
                        <p className="text-[11px] font-semibold text-slate-500">Jadwal Keberangkatan:</p>
                        {pkgBatches.map(b => {
                          const quota = b.quota || 45;
                          const filled = b.filled_quota || 0;
                          const remaining = Math.max(0, quota - filled);
                          return (
                            <div key={b.id} className="flex justify-between items-center text-[11px] bg-slate-50 px-2.5 py-1.5 rounded-lg">
                              <span className="font-medium text-slate-700">{b.departure_date}</span>
                              <span className={"font-bold " + (remaining <= 5 ? "text-amber-600" : "text-emerald-700")}>
                                Sisa {remaining} Kursi
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="pt-5 mt-4 border-t border-slate-100">
                    <Link
                      href={`/register?package_id=${pkg.id}`}
                      className="w-full text-center bg-slate-900 hover:bg-slate-800 text-white font-bold py-2.5 rounded-xl text-xs transition shadow-2xs block"
                    >
                      Daftar Sekarang
                    </Link>
                  </div>
                </div>
              );
            })}
            {filteredPackages.length === 0 && (
              <div className="col-span-3 py-12 text-center text-xs text-slate-400">
                Tidak ada paket di kategori ini.
              </div>
            )}
          </div>
        )}
      </main>
      <Footer />
    </div>
  );
}
