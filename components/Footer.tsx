'use client';

import React, { useState, useEffect } from 'react';

export default function Footer() {
  const [company, setCompany] = useState({
    company_name: 'Al-Barakah Tour & Travel',
    legal_name: 'PT. Al-Barakah Mandiri Utama',
    ppiu_number: 'Izin Kemenag No. 123/PPIU/2024',
    address: 'Jl. Jenderal Sudirman No. 45, Jakarta Selatan',
    phone: '0812-3456-7890',
    email: 'info@albarakah.co.id',
  });

  useEffect(() => {
    fetch('/api/admin/settings')
      .then((r) => r.json())
      .then((d) => {
        if (d.success && d.company && d.company.company_name) {
          setCompany(d.company);
        }
      })
      .catch(() => {});
  }, []);

  return (
    <footer className="bg-white border-t border-slate-200/80 text-slate-600 mt-auto">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="md:col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <span className="text-xl">🕋</span>
              <span className="text-base font-extrabold text-slate-900 tracking-tight">
                {company.company_name}
              </span>
            </div>
            <p className="text-xs text-slate-500 max-w-md leading-relaxed">
              {company.legal_name ? `${company.legal_name} • ` : ''}
              {company.ppiu_number}. Penyelenggara Perjalanan Ibadah Umroh (PPIU) resmi terakreditasi Kemenag RI yang melayani ibadah sesuai tuntunan Sunnah.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Layanan Jamaah</h4>
            <ul className="space-y-2 text-xs text-slate-500">
              <li><a href="/packages" className="hover:text-slate-900 transition">Daftar Paket Umroh</a></li>
              <li><a href="/track" className="hover:text-slate-900 transition">Lacak Status Pendaftaran</a></li>
              <li><a href="/register" className="hover:text-slate-900 transition">Pendaftaran Online</a></li>
              <li><a href="/admin/login" className="hover:text-slate-900 transition">Portal Masuk Staf</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">Kantor & Kontak</h4>
            <div className="text-xs text-slate-500 space-y-1.5 leading-relaxed">
              <p>{company.address}</p>
              <p>WhatsApp: <b className="text-slate-800 font-mono">{company.phone}</b></p>
              <p>Email: <span className="text-slate-800">{company.email}</span></p>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-100 mt-8 pt-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-400">
          <p>© {new Date().getFullYear()} {company.legal_name || company.company_name}. Hak Cipta Dilindungi.</p>
          <p>Sistem Operasional Umroh v2.5</p>
        </div>
      </div>
    </footer>
  );
}
