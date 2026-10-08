'use client';
import { useState } from 'react';
import Link from 'next/link';
import { Plane, Menu, X } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          <Link href="/" className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-md shadow-emerald-200">
              <Plane className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xl font-bold tracking-tight text-slate-900">
                Al-Barakah <span className="text-emerald-600">Travel</span>
              </span>
              <p className="text-xs text-slate-600 font-medium tracking-wider uppercase">Official Umroh & Hajj</p>
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
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm px-4 py-2 rounded-lg transition shadow-sm hover:shadow-emerald-200"
            >
              Daftar Sekarang
            </Link>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition focus:outline-none focus:ring-2 focus:ring-emerald-500"
              aria-label="Toggle Navigation Menu"
            >
              {mobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {mobileMenuOpen && (
        <div className="md:hidden border-t border-slate-200 bg-white px-4 pt-2 pb-4 space-y-2 shadow-lg">
          <Link href="/" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 text-sm font-medium">Beranda</Link>
          <Link href="/packages" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 text-sm font-medium">Paket Umroh</Link>
          <Link href="/track" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 text-sm font-medium">Cek Status Tagihan</Link>
          <Link href="/admin/login" onClick={() => setMobileMenuOpen(false)} className="block px-3 py-2 rounded-lg text-slate-700 hover:bg-slate-100 text-sm font-medium">Portal Admin</Link>
        </div>
      )}
    </header>
  );
}
