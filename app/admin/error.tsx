'use client';

/**
 * Error boundary khusus area admin.
 *
 * Dashboard admin adalah satu komponen raksasa (4.262 baris); satu error data di
 * dalamnya akan menjatuhkan seluruh panel. Boundary ini menahan kerusakan pada
 * area admin dan memberi tombol kembali ke dashboard, tanpa mematikan situs publik.
 */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm">
        <h1 className="text-base font-black text-slate-900">Panel admin gagal dimuat</h1>
        <p className="text-xs text-slate-500 mt-2">
          Situs publik tetap berjalan. Coba muat ulang panel; bila berulang, periksa
          koneksi database atau hubungi pengembang.
        </p>
        {error?.digest && <p className="mt-3 text-[10px] font-mono text-slate-400">kode: {error.digest}</p>}
        <div className="flex justify-center gap-2 mt-5">
          <button onClick={() => reset()} className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800">
            Coba Lagi
          </button>
          <a href="/admin/dashboard" className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50">
            Ke Dashboard
          </a>
        </div>
      </div>
    </div>
  );
}
