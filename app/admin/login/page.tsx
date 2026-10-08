'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AlertCircle } from 'lucide-react';

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('admin_user', JSON.stringify(data.user));
        router.push('/admin/dashboard');
        router.refresh();
      } else {
        setError(data.message);
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        setError(err.message);
      } else {
        setError('Terjadi gangguan koneksi ke server');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-emerald-100 selection:text-emerald-900">
      <div className="w-full max-w-sm space-y-6">
        {/* Brand Header */}
        <div className="text-center space-y-1">
          <div className="inline-flex items-center justify-center w-11 h-11 rounded-2xl bg-slate-900 text-white text-xl shadow-xs mb-2">
            🕋
          </div>
          <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Al-Barakah Tour</h1>
          <p className="text-xs text-slate-500 font-medium">Portal Akses Staf & Manajemen</p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          {error && (
            <div className="mb-4 bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2.5 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-500" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@travel.com"
                autoComplete="username"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1.5">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                className="w-full bg-white border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-slate-900 focus:border-slate-900 focus:outline-none transition font-mono"
                required
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-slate-900 hover:bg-slate-800 active:bg-slate-950 text-white font-bold py-2.5 rounded-xl transition text-sm shadow-xs disabled:opacity-60 cursor-pointer pt-2.5"
            >
              {loading ? 'Memverifikasi...' : 'Masuk'}
            </button>
          </form>
        </div>

        {/* Footer Navigation */}
        <div className="text-center">
          <Link
            href="/"
            className="text-xs text-slate-500 hover:text-slate-800 transition font-medium inline-flex items-center gap-1"
          >
            ← Kembali ke Website Utama
          </Link>
        </div>
      </div>
    </div>
  );
}
