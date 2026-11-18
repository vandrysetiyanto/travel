'use client';

import { useState } from 'react';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import { Star, CheckCircle2, Heart, Sparkles } from 'lucide-react';

export default function SubmitTestimonialPage() {
  const [formData, setFormData] = useState({
    booking_code: '',
    pilgrim_name: '',
    city: '',
    package_name: 'Paket Umroh Reguler',
    rating: 5,
    comment: '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/testimonials/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });
      const d = await res.json();
      if (d.success) {
        setSubmitted(true);
      } else {
        setError(d.message || 'Gagal mengirim testimoni.');
      }
    } catch {
      setError('Terjadi kesalahan koneksi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#fafafa] text-slate-900">
      <Navbar />

      <main className="flex-1 max-w-xl mx-auto px-4 py-12 w-full">
        <div className="bg-white rounded-3xl border border-slate-200/80 p-8 shadow-sm">
          <div className="text-center space-y-2 mb-8">
            <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto shadow-2xs">
              <Heart className="w-6 h-6" />
            </div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Kesan & Pesan Perjalanan Umroh</h1>
            <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
              Bagikan pengalaman spiritual dan kenyamanan perjalanan ibadah Anda bersama Al-Barakah Travel untuk menginspirasi sesama jamaah.
            </p>
          </div>

          {submitted ? (
            <div className="text-center py-12 space-y-4 animate-fade-in">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h3 className="text-xl font-bold text-slate-900">Jazakallah Khairan Katsiran!</h3>
              <p className="text-xs text-slate-500 max-w-xs mx-auto">
                Testimoni Anda telah berhasil dikirim dan akan segera ditampilkan di halaman utama setelah melalui verifikasi tim kami.
              </p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs font-medium">{error}</div>}

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Booking (Opsional)</label>
                <input
                  type="text"
                  placeholder="Cth: TRV-2026-XXXX"
                  value={formData.booking_code}
                  onChange={e => setFormData({ ...formData, booking_code: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs font-mono bg-slate-50/50 focus:bg-white transition"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nama Lengkap Jamaah *</label>
                  <input
                    type="text"
                    required
                    placeholder="Cth: H. Ahmad Zulkarnain"
                    value={formData.pilgrim_name}
                    onChange={e => setFormData({ ...formData, pilgrim_name: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Kota Asal</label>
                  <input
                    type="text"
                    placeholder="Cth: Jakarta Selatan"
                    value={formData.city}
                    onChange={e => setFormData({ ...formData, city: e.target.value })}
                    className="w-full p-3 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white transition"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Pilihan Paket Umroh</label>
                <select
                  value={formData.package_name}
                  onChange={e => setFormData({ ...formData, package_name: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white transition font-medium"
                >
                  <option value="Paket Umroh Reguler">Paket Umroh Reguler</option>
                  <option value="Paket Umroh Plus Turki">Paket Umroh Plus Turki</option>
                  <option value="Paket Umroh VIP Executive">Paket Umroh VIP Executive</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Penilaian Pelayanan & Akomodasi</label>
                <div className="flex items-center gap-2 py-2">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      type="button"
                      key={star}
                      onClick={() => setFormData({ ...formData, rating: star })}
                      className="p-1 text-amber-400 hover:scale-110 transition"
                    >
                      <Star className={`w-6 h-6 ${star <= formData.rating ? 'fill-current' : 'text-slate-200'}`} />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-bold text-slate-600">{formData.rating} dari 5 Bintang</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kesan & Pesan Perjalanan *</label>
                <textarea
                  required
                  rows={4}
                  placeholder="Ceritakan pengalaman Anda mengenai hotel, pembimbing ibadah (muthawif), konsumsi, dan pelayanan travel..."
                  value={formData.comment}
                  onChange={e => setFormData({ ...formData, comment: e.target.value })}
                  className="w-full p-3 rounded-xl border border-slate-200 text-xs bg-slate-50/50 focus:bg-white transition resize-none"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-md flex items-center justify-center gap-2"
              >
                {loading ? 'Mengirim Testimoni...' : 'Kirim Ulasan Saya 🚀'}
              </button>
            </form>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
