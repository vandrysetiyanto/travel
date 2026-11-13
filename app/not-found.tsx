import Link from 'next/link';

/**
 * Halaman 404.
 *
 * Tanpa not-found.tsx, Next menampilkan halaman bawaan yang berbahasa Inggris dan
 * tidak punya jalan kembali ke aplikasi — pengguna jamaah akan bingung.
 */
export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-6 text-center shadow-sm">
        <p className="text-4xl font-black text-slate-200">404</p>
        <h1 className="text-base font-black text-slate-900 mt-2">Halaman tidak ditemukan</h1>
        <p className="text-xs text-slate-500 mt-2">
          Alamat yang Anda buka tidak tersedia atau sudah dipindahkan.
        </p>
        <div className="flex justify-center gap-2 mt-5">
          <Link href="/" className="px-4 py-2 text-xs font-bold bg-slate-900 text-white rounded-xl hover:bg-slate-800">
            Ke Beranda
          </Link>
          <Link href="/packages" className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50">
            Lihat Paket
          </Link>
          <Link href="/track" className="px-4 py-2 text-xs font-bold text-slate-600 rounded-xl border border-slate-200 hover:bg-slate-50">
            Cek Booking
          </Link>
        </div>
      </div>
    </div>
  );
}
