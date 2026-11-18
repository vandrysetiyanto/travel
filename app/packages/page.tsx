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
                  className={`rounded-2xl border p-6 transition flex flex-col justify-between ${
                isVip
                  ? 'bg-gradient-to-b from-white via-amber-50/20 to-white border-amber-300/80 card-luxury-hover animate-fade-in ring-1 ring-amber-200/50 shadow-lg'
                  : 'bg-white border-slate-200/80 shadow-xs hover:border-slate-300'
              }`}
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider px-2 py-0.5 rounded-md bg-slate-100">
                        {pkg.category}
                      </span>
                      {isVip && (
                        <span className="text-[10px] font-bold text-amber-700 bg-gradient-to-r from-amber-100 to-amber-50 border border-amber-300 px-2.5 py-1 rounded-lg inline-flex items-center gap-1 text-amber-900 shadow-2xs">
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
                      className={`w-full text-center font-bold py-2.5 rounded-xl text-xs transition shadow-2xs block ${
                      isVip
                        ? 'bg-amber-600 hover:bg-amber-700 text-white shadow-amber-600/20'
                        : 'bg-slate-900 hover:bg-slate-800 text-white'
                    }`}
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
      {/* Floating WhatsApp Consultation Button */}
      <a
        href="https://wa.me/628123456789?text=Halo%2C%20saya%20ingin%20konsultasi%20paket%20umroh"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 right-6 z-50 bg-emerald-600 hover:bg-emerald-700 text-white p-3.5 rounded-full shadow-lg transition flex items-center justify-center hover:scale-105 active:scale-95"
        aria-label="Konsultasi WhatsApp"
      >
        <svg className="w-6 h-6 fill-current" viewBox="0 0 24 24">
          <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
        </svg>
      </a>
      <Footer />
    </div>
  );
}
