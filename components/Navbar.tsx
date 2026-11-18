'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plane, Menu, X, ArrowRight, ShieldCheck } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-3 group">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-600 to-emerald-700 flex items-center justify-center text-white shadow-md shadow-emerald-200 transition group-hover:scale-105">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <span className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900">
                Al-Barakah <span className="text-emerald-600">Travel</span>
              </span>
              <div className="flex items-center gap-1">
                <ShieldCheck className="w-3 h-3 text-emerald-600" />
                <p className="text-[10px] text-slate-500 font-bold tracking-wider uppercase">PPIU Kemenag Resmi</p>
              </div>
            </div>
          </Link>

          <nav className="hidden md:flex items-center space-x-6 text-sm font-medium text-slate-600">
            <Link href="/" className="py-2 hover:text-emerald-600 transition">Beranda</Link>
            <Link href="/packages" className="py-2 hover:text-emerald-600 transition">Paket Umroh</Link>
            <Link href="/track" className="py-2 hover:text-emerald-600 transition">Cek Status Tagihan</Link>
            <Link href="/admin/login" className="text-xs bg-slate-100 hover:bg-slate-200 px-3 py-1.5 rounded-lg text-slate-700 transition">Portal Admin</Link>
          </nav>

          <div className="flex items-center space-x-3">
            <Link
              href="/register"
              className="hidden sm:inline-flex bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm px-4 py-2 rounded-xl transition shadow-sm hover:shadow-emerald-200 items-center gap-1.5"
            >
              <span>Daftar Sekarang</span>
              <ArrowRight className="w-4 h-4" />
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2.5 rounded-xl text-slate-700 hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-16 left-0 right-0 border-b border-slate-200 bg-white/95 backdrop-blur-xl px-4 pt-3 pb-6 space-y-2 shadow-xl animate-fade-in">
          <Link href="/" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 text-sm font-bold transition">
            🏠 Beranda
          </Link>
          <Link href="/packages" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 text-sm font-bold transition">
            🕋 Katalog Paket Umroh
          </Link>
          <Link href="/track" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl text-slate-800 hover:bg-emerald-50 hover:text-emerald-700 text-sm font-bold transition">
            🔍 Cek Status & Tagihan
          </Link>
          <Link href="/register" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold text-center shadow-md">
            ✨ Daftar Umroh Sekarang
          </Link>
          <div className="pt-2 border-t border-slate-100">
            <Link href="/admin/login" onClick={() => setMobileMenuOpen(false)} className="block px-4 py-2.5 rounded-xl text-slate-500 hover:bg-slate-100 text-xs font-semibold text-center">
              🔐 Masuk Portal Admin / Staf
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
