'use client';

import { useState, useEffect, useCallback } from 'react';
import { Star, CheckCircle2, Trash2, MessageSquare, Send } from 'lucide-react';
import { ToastContainer } from './ui-dasar';

export function TestimonialsTab() {
  const [testimonials, setTestimonials] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadTestimonials = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/testimonials')
      .then(r => r.json())
      .then(d => {
        if (d.success) setTestimonials(d.testimonials || []);
        setLoading(false);
      });
  }, []);

  useEffect(() => { loadTestimonials(); }, [loadTestimonials]);

  const handleAction = async (id: number, action: 'APPROVE' | 'DELETE') => {
    const res = await fetch('/api/admin/testimonials', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    const d = await res.json();
    if (d.success) {
      setToast({ msg: d.message, type: 'success' });
      loadTestimonials();
    } else {
      setToast({ msg: d.message || 'Gagal memproses aksi', type: 'error' });
    }
  };

  const copyWhatsAppLink = (bookingCode?: string) => {
    const code = bookingCode || 'TRV-UMROH';
    const link = `https://travel.idigivice.com/testimonial/submit?ref=${code}`;
    const text = `Assalamu’alaikum Wr. Wb. Bpk/Ibu Jamaah, semoga ibadah umrohnya mabrur. Mohon kesediaannya membagikan kesan perjalanan Anda di: ${link}`;
    navigator.clipboard.writeText(text);
    setToast({ msg: 'Tautan & Pesan WhatsApp berhasil disalin!', type: 'success' });
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-xs gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Moderasi Ulasan & Testimoni Jamaah</h2>
          <p className="text-sm text-slate-500 mt-1">Kelola dan setujui ulasan jamaah yang akan ditampilkan di halaman utama website.</p>
        </div>
        <button
          onClick={() => copyWhatsAppLink()}
          className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs transition flex items-center gap-2 shadow-sm"
        >
          <Send className="w-4 h-4" /> Salin Tautan WhatsApp Ulasan
        </button>
      </div>

      {loading ? (
        <p className="text-center py-12 text-slate-400">Memuat data testimoni...</p>
      ) : testimonials.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          Belum ada ulasan atau testimoni masuk.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
              <tr>
                <th className="p-3">Jamaah & Asal</th>
                <th className="p-3">Paket</th>
                <th className="p-3">Rating</th>
                <th className="p-3">Komentar</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-right">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {testimonials.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50/50">
                  <td className="p-3">
                    <span className="font-bold text-slate-900 block">{t.pilgrim_name}</span>
                    <span className="text-[10px] text-slate-400">{t.city} {t.booking_code && `• ${t.booking_code}`}</span>
                  </td>
                  <td className="p-3 text-slate-600 font-medium">{t.package_name}</td>
                  <td className="p-3">
                    <div className="flex items-center text-amber-400 gap-0.5">
                      {[...Array(t.rating || 5)].map((_, i) => (
                        <Star key={i} className="w-3.5 h-3.5 fill-current" />
                      ))}
                    </div>
                  </td>
                  <td className="p-3 text-slate-700 max-w-xs truncate">{t.comment}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      t.status === 'APPROVED' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {t.status}
                    </span>
                  </td>
                  <td className="p-3 text-right space-x-1">
                    {t.status !== 'APPROVED' && (
                      <button onClick={() => handleAction(t.id, 'APPROVE')} className="px-2.5 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700">
                        Setujui
                      </button>
                    )}
                    <button onClick={() => handleAction(t.id, 'DELETE')} className="px-2.5 py-1 bg-rose-50 text-rose-600 rounded-lg font-bold hover:bg-rose-100">
                      Hapus
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {toast && <ToastContainer toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
