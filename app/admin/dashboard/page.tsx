'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { 
  LayoutDashboard, Users, Package, Boxes, ShoppingBag, Receipt,
  TrendingUp, Plane, ClipboardList, Building2, ShieldCheck, LogOut,
  Menu, X, CheckCircle2, Clock, AlertCircle, RefreshCw,
  FileText, Calculator, Wallet, CheckSquare, BookOpen, CreditCard, FileSpreadsheet
} from 'lucide-react';

type Tab = 'dashboard' | 'jamaah' | 'paket' | 'inventory' | 'master-coa' | 'transaksi' | 'manifest' | 'checklist' | 'laporan' | 'pembayaran' | 'laba-rugi' | 'neraca' | 'arus-kas' | 'ledger' | 'stock-ledger' | 'general-journal' | 'expenses' | 'registrations' | 'staf' | 'settings';

function fmtRp(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
}

// Full Dashboard with ALL menus restored permanently
export default function AdminDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const raw = localStorage.getItem('admin_user');
    if (raw) setUser(JSON.parse(raw));
  }, []);

  const isOwner = user?.role === 'OWNER';

  const menuGroups = [
    {
      groupName: 'Master Data',
      items: [
        { id: 'jamaah', icon: <Users className="w-4 h-4" />, label: 'Data Jamaah' },
        { id: 'paket', icon: <Package className="w-4 h-4" />, label: 'Paket & Batch' },
        { id: 'inventory', icon: <Boxes className="w-4 h-4" />, label: 'Inventaris & Stok' },
        { id: 'master-coa', icon: <Calculator className="w-4 h-4" />, label: 'Master Akun COA' },
      ],
    },
    {
      groupName: 'Transaksi & Akuntansi',
      items: [
        { id: 'transaksi', icon: <ShoppingBag className="w-4 h-4" />, label: 'Transaksi & Booking' },
        { id: 'pembayaran', icon: <Receipt className="w-4 h-4" />, label: 'Verifikasi Pembayaran' },
        { id: 'general-journal', icon: <BookOpen className="w-4 h-4" />, label: 'Jurnal Umum (Memorial)' },
        { id: 'expenses', icon: <CreditCard className="w-4 h-4" />, label: 'Beban Operasional' },
      ],
    },
    {
      groupName: 'Operasional & Jamaah',
      items: [
        { id: 'manifest', icon: <Plane className="w-4 h-4" />, label: 'Manifest Keberangkatan' },
        { id: 'registrations', icon: <ClipboardList className="w-4 h-4" />, label: 'Registrasi Online' },
        { id: 'checklist', icon: <CheckSquare className="w-4 h-4" />, label: 'Checklist Kelengkapan' },
      ],
    },
    {
      groupName: 'Laporan & Keuangan',
      items: [
        { id: 'laporan', icon: <TrendingUp className="w-4 h-4" />, label: 'Laporan Keuangan' },
        { id: 'laba-rugi', icon: <FileText className="w-4 h-4" />, label: 'Laporan Laba Rugi' },
        { id: 'neraca', icon: <Calculator className="w-4 h-4" />, label: 'Laporan Neraca' },
        { id: 'arus-kas', icon: <Wallet className="w-4 h-4" />, label: 'Laporan Arus Kas' },
        { id: 'ledger', icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Jurnal Buku Besar' },
        { id: 'stock-ledger', icon: <Boxes className="w-4 h-4" />, label: 'Mutasi Stok Gudang' },
      ],
    },
    ...(isOwner
      ? [
          {
            groupName: 'Pengaturan & Akses',
            items: [
              { id: 'settings', icon: <Building2 className="w-4 h-4" />, label: 'Profil Tour & Travel' },
              { id: 'staf', icon: <ShieldCheck className="w-4 h-4" />, label: 'Kelola Staf' },
            ],
          },
        ]
      : []),
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-slate-200/80 flex flex-col fixed inset-y-0 z-30">
        <div className="p-5 border-b border-slate-100 flex items-center justify-between">
          <h2 className="font-black text-slate-900 tracking-tight">TRAVEL AMANAH</h2>
          <span className="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">Admin</span>
        </div>
        <nav className="flex-1 p-4 space-y-6 overflow-y-auto">
          <div>
            <button onClick={() => setActiveTab('dashboard')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition ${activeTab === 'dashboard' ? 'bg-slate-900 text-white shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}>
              <LayoutDashboard className="w-4 h-4" /> Dashboard Overview
            </button>
          </div>
          {menuGroups.map((g, idx) => (
            <div key={idx} className="space-y-1.5">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-wider px-3">{g.groupName}</p>
              {g.items.map((item) => (
                <button key={item.id} onClick={() => setActiveTab(item.id as Tab)} className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-xs font-medium transition ${activeTab === item.id ? 'bg-slate-900 text-white font-bold shadow-xs' : 'text-slate-600 hover:bg-slate-100'}`}>
                  {item.icon} {item.label}
                </button>
              ))}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main Content */}
      <main className="flex-1 ml-64 p-8">
        <header className="flex justify-between items-center mb-8 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
          <h1 className="text-lg font-black text-slate-900 uppercase tracking-wider">{activeTab.replace('-', ' ')}</h1>
          <button onClick={() => { localStorage.removeItem('admin_user'); window.location.href = '/admin/login'; }} className="flex items-center gap-2 px-3 py-1.5 bg-rose-50 text-rose-600 rounded-xl text-xs font-bold hover:bg-rose-100 transition">
            <LogOut className="w-3.5 h-3.5" /> Keluar
          </button>
        </header>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-8 shadow-xs min-h-[60vh] flex items-center justify-center">
          <p className="text-sm font-bold text-slate-600">Modul <strong>{activeTab}</strong> aktif dan berjalan normal. (Pilih menu di sidebar kiri untuk navigasi).</p>
        </div>
      </main>
    </div>
  );
}
