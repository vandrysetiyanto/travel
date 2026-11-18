import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import Link from 'next/link';
import db from '@/lib/db';
import { formatRupiah } from '@/lib/utils';
import { ShieldCheck, Clock, Plane, ArrowRight, Star, Building, Check, Sparkles } from 'lucide-react';

export const revalidate = 30;

export default function HomePage() {
  const packages = db.prepare('SELECT * FROM packages WHERE is_active = 1 ORDER BY price ASC LIMIT 3').all() as any[];
  const batches = db.prepare(`
    SELECT b.*, 
      (SELECT COUNT(*) FROM transactions t WHERE t.batch_id = b.id AND t.status != 'CANCELLED') as filled_quota
    FROM batches b 
    WHERE b.status = 'OPEN'
  `).all() as any[];

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] text-slate-900 selection:bg-slate-900 selection:text-white">
      <Navbar />

      {/* Hero Section — Minimalist Editorial */}
      <section className="relative pt-12 pb-16 sm:pt-20 sm:pb-24 px-4 sm:px-6 lg:px-8 max-w-6xl mx-auto w-full text-center">
        {/* Subtle Badge */}
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-slate-100 border border-slate-200/80 text-slate-700 text-xs font-semibold mb-6 shadow-2xs">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          <span>Izin Resmi PPIU Kemenag RI</span>
          <span className="text-slate-300">•</span>
          <span className="text-slate-500 font-normal">Pasti Berangkat</span>
        </div>

        {/* Hero Title */}
        <h1 className="text-4xl sm:text-6xl lg:text-7xl font-black tracking-tight text-slate-900 leading-[1.08] max-w-4xl mx-auto">
          Ibadah Umroh Nyaman, <br className="hidden sm:inline" />
          <span className="text-slate-500 font-medium">Khusyuk & Terencana.</span>
        </h1>

        {/* Hero Subtitle */}
        <p className="mt-6 text-base sm:text-lg text-slate-600 max-w-2xl mx-auto font-normal leading-relaxed">
          Akomodasi hotel bintang 4 & 5 dekat Masjidil Haram, penerbangan langsung tanpa transit, dan kepastian jadwal keberangkatan secara transparan.
        </p>

        {/* Action Buttons */}
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/packages"
            className="bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold px-6 py-3 rounded-xl text-sm transition shadow-xs flex items-center gap-2 cursor-pointer"
          >
            <span>Pilih Paket Ibadah</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link
            href="/track"
            className="bg-white hover:bg-slate-50 text-slate-700 font-semibold px-6 py-3 rounded-xl text-sm border border-slate-300/80 transition shadow-2xs"
          >
            Lacak Status Pendaftaran
          </Link>
        </div>

        {/* 4 Trust Highlights (Ultra Minimalist Grid) */}
        <div className="mt-16 pt-10 border-t border-slate-200/60 grid grid-cols-2 md:grid-cols-4 gap-6 text-left">
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Izin Resmi</p>
            <p className="text-xs text-slate-500">Akreditasi Kemenag RI</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Direct Flight</p>
            <p className="text-xs text-slate-500">Garuda & Saudia Airlines</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Hotel Dekat Haram</p>
            <p className="text-xs text-slate-500">Akses Jalan Kaki 1-3 Menit</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-bold text-slate-900 uppercase tracking-wider">Bimbingan Sunnah</p>
            <p className="text-xs text-slate-500">Muthawif Berpengalaman</p>
          </div>
        </div>
      </section>

      {/* Featured Packages Section */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12 w-full flex-1">
        <div className="flex flex-wrap items-end justify-between mb-8 pb-4 border-b border-slate-200/80 gap-4">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Jadwal Keberangkatan Terdekat</span>
            <h2 className="text-2xl font-black text-slate-900 tracking-tight mt-0.5">Pilihan Paket Unggulan</h2>
          </div>
          <Link href="/packages" className="text-xs font-bold text-slate-900 hover:text-emerald-700 transition inline-flex items-center gap-1">
            <span>Lihat Semua Paket</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {/* Packages Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {packages.map((pkg) => {
            const pkgBatches = batches.filter((b) => b.package_id === pkg.id);
            const isVip = pkg.category?.toLowerCase().includes('vip') || pkg.price > 35000000;

            return (
              <div
                key={pkg.id}
                className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs hover:border-slate-300 transition flex flex-col justify-between"
              >
                <div className="space-y-4">
                  {/* Category & Badge */}
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

                  {/* Title & Price */}
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-base leading-snug">{pkg.name}</h3>
                    <div className="mt-2 flex items-baseline gap-1">
                      <span className="text-2xl font-black text-slate-900 tracking-tight">{formatRupiah(pkg.price)}</span>
                      <span className="text-xs text-slate-400">/ pax</span>
                    </div>
                  </div>

                  {/* Key Details */}
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

                  {/* Batch availability bar */}
                  {pkgBatches.length > 0 && (
                    <div className="pt-3 border-t border-slate-100 space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-500">Jadwal:</p>
                      {pkgBatches.slice(0, 2).map((b) => {
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
        </div>
      </section>

      {/* Clean Callout */}
      <section className="bg-white border-t border-slate-200/80 py-12 px-4 sm:px-6 lg:px-8 text-center">
        <div className="max-w-2xl mx-auto space-y-4">
          <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">Konsultasi Jadwal & Pendaftaran</h3>
          <p className="text-xs text-slate-500 leading-relaxed">
            Tim konsultan ibadah kami siap membantu merencanakan keberangkatan umroh terbaik untuk Anda dan keluarga.
          </p>
          <div className="pt-2">
            <Link
              href="/packages"
              className="inline-flex items-center gap-2 bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2.5 rounded-xl text-xs transition"
            >
              <span>Hubungi Layanan Jamaah</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
