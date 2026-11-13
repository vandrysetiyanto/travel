'use client';

import { useEffect } from 'react';

/**
 * Error boundary tingkat aplikasi.
 *
 * Sebelumnya TIDAK ADA error.tsx / not-found.tsx. Akibatnya satu error render di
 * komponen mana pun membuat React mengosongkan seluruh halaman — pengguna hanya
 * melihat layar putih tanpa penjelasan dan tanpa jalan pulih selain reload.
 *
 * Dengan berkas ini, error ditangkap, pengguna diberi pilihan untuk mencoba lagi,
 * dan detail teknis dicatat (bisa dikirim ke log server lewat API kecil).
 */
export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    // Catat ke console agar terbaca di log PM2; jangan tampilkan detail ke pengguna.
    console.error('[error-boundary]', error?.message, error?.digest || '');
  }, [error]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm">
        <div className="w-12 h-12 mx-auto rounded-full bg-rose-50 flex items-center justify-center mb-4">
          <span className="text-rose-600 text-xl font-black">!</span>
        </div>
        <h1 className="text-base font-black text-slate-900">Terjadi kesalahan saat menampilkan halaman</h1>
        <p className="text-xs text-slate-500 mt-2">
          Data Anda tidak hilang. Silakan coba lagi; bila masih gagal, muat ulang halaman
          atau hubungi admin dengan menyebutkan kode di bawah.
        </p>
        {error?.digest && (
          <p className="mt-3 text-[10px] font-mono text-slate-400">kode: {error.digest}</p>
        )}
        <div className="flex justify-center gap-2 mt-5">
          <button
            onClick={() => reset()}
            className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800"
          >
            Coba Lagi
          </button>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50"
          >
            Muat Ulang
          </button>
        </div>
      </div>
    </div>
  );
}
