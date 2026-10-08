'use client';

import React, { useState, useEffect } from 'react';
import PilgrimCard, { PilgrimData } from '@/components/PilgrimCard';
import type { OCRResult } from '@/components/OCRUploader';
import { formatRupiah } from '@/lib/utils';
import { useSearchParams, useRouter } from 'next/navigation';
import { Plus, CheckCircle, ArrowRight } from 'lucide-react';

export default function RegisterForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preSelectedPkg = searchParams.get('package_id');

  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | ''>('');
  const [selectedBatch, setSelectedBatch] = useState<any | null>(null);

  const [applicant, setApplicant] = useState({ name: '', phone: '', email: '', notes: '' });
  const [pilgrims, setPilgrims] = useState<PilgrimData[]>([
    { nik: '', no_kk: '', full_name: '', gender: 'L', birth_place: '', birth_date: '', phone: '', address: '', passport_number: '', passport_expiry: '' }
  ]);

  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState<any | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/master/packages')
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.batches) {
          setBatches(data.batches);
          if (preSelectedPkg) {
            const matched = data.batches.find((b: any) => b.package_id === parseInt(preSelectedPkg));
            if (matched) {
              setSelectedBatchId(matched.id);
              setSelectedBatch(matched);
            }
          } else if (data.batches.length > 0) {
            setSelectedBatchId(data.batches[0].id);
            setSelectedBatch(data.batches[0]);
          }
        }
      });
  }, [preSelectedPkg]);

  const handleBatchChange = (batchId: number) => {
    setSelectedBatchId(batchId);
    setSelectedBatch(batches.find((item) => item.id === batchId) || null);
  };

  const handleAddPilgrim = () => {
    setPilgrims([...pilgrims, { nik: '', no_kk: '', full_name: '', gender: 'L', birth_place: '', birth_date: '', phone: '', address: '', passport_number: '', passport_expiry: '' }]);
  };

  const handleRemovePilgrim = (index: number) => {
    if (pilgrims.length > 1) setPilgrims(pilgrims.filter((_, i) => i !== index));
  };

  const updatePilgrim = (index: number, field: keyof PilgrimData, value: string) => {
    const updated = [...pilgrims];
    updated[index][field] = value;
    setPilgrims(updated);
    if (index === 0) {
      if (field === 'full_name' && !applicant.name) setApplicant((p) => ({ ...p, name: value }));
      if (field === 'phone' && !applicant.phone) setApplicant((p) => ({ ...p, phone: value }));
    }
  };

  const handleOCR = (index: number, data: OCRResult) => {
    const updated = [...pilgrims];
    if (data.nik) updated[index].nik = data.nik;
    if (data.noKK) updated[index].no_kk = data.noKK;
    if (data.fullName) updated[index].full_name = data.fullName;
    if (data.birthPlace) updated[index].birth_place = data.birthPlace;
    if (data.birthDate) updated[index].birth_date = data.birthDate;
    if (data.gender) updated[index].gender = data.gender;
    if (data.address) updated[index].address = data.address;
    if (data.passportNumber) updated[index].passport_number = data.passportNumber;
    if (data.passportExpiry) updated[index].passport_expiry = data.passportExpiry;
    setPilgrims(updated);
    if (index === 0 && data.fullName) {
      const ocrName = data.fullName;
      setApplicant((p) => ({ ...p, name: ocrName }));
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!selectedBatchId) return setError('Pilih jadwal keberangkatan batch terlebih dahulu.');
    if (!applicant.name || !applicant.phone) return setError('Lengkapi nama dan WhatsApp penanggung jawab.');

    for (let i = 0; i < pilgrims.length; i++) {
      if (!pilgrims[i].full_name || !pilgrims[i].nik) {
        return setError(`Nama Lengkap dan NIK Jemaah #${i + 1} wajib diisi.`);
      }
    }

    setLoading(true);
    try {
      const res = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          batch_id: selectedBatchId,
          applicant_name: applicant.name,
          applicant_phone: applicant.phone,
          applicant_email: applicant.email,
          registration_type: 'ONLINE',
          notes: applicant.notes,
          pilgrims,
        }),
      });
      const resData = await res.json();
      if (resData.success) {
        setSubmitted(resData);
      } else {
        setError(resData.message || 'Gagal mengirim pendaftaran.');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const totalPrice = selectedBatch ? selectedBatch.price * pilgrims.length : 0;

  if (submitted) {
    return (
      <div className="bg-white p-8 rounded-3xl border border-slate-200 text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
          <CheckCircle className="w-10 h-10" />
        </div>
        <div>
          <span className="text-xs font-bold text-emerald-600 uppercase">Pendaftaran Berhasil</span>
          <h1 className="text-2xl font-extrabold text-slate-900 mt-1">Invoice Tagihan Diterbitkan</h1>
          <p className="text-sm text-slate-500 mt-1">Simpan Kode Booking Anda untuk cek status & upload bukti bayar.</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-6 max-w-md mx-auto">
          <span className="text-xs text-emerald-800 font-medium">KODE BOOKING:</span>
          <p className="text-3xl font-mono font-bold text-emerald-900 mt-1">{submitted.booking_code}</p>
          <p className="text-sm text-emerald-800 font-semibold mt-3 pt-3 border-t border-emerald-200">
            Total Tagihan: {formatRupiah(submitted.total_amount)}
          </p>
        </div>
        <button
          onClick={() => router.push(`/track?code=${submitted.booking_code}`)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-6 py-3 rounded-xl transition inline-flex items-center gap-2"
        >
          <span>Lihat Tagihan & Upload Bukti Bayar</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900">Formulir Pendaftaran Umroh</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">Daftar online mandiri tanpa login. Lengkapi data jemaah di bawah ini.</p>
      </div>

      {error && <div className="bg-red-50 text-red-700 border border-red-200 p-4 rounded-xl text-sm font-medium">{error}</div>}

      <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
        <label className="block text-xs font-bold text-slate-700 uppercase">Pilih Paket & Jadwal Keberangkatan</label>
        <select
          value={selectedBatchId}
          onChange={(e) => handleBatchChange(Number(e.target.value))}
          className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2.5 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          required
        >
          <option value="" disabled>-- Pilih Jadwal Batch --</option>
          {batches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.package_name} ({b.batch_name}) - Berangkat: {b.departure_date} - {formatRupiah(b.price)}
            </option>
          ))}
        </select>
      </div>

      <div className="bg-white p-5 rounded-2xl border border-slate-200 space-y-3">
        <h3 className="text-sm font-bold text-slate-900">Data Kontak Pemesan / Penanggung Jawab</h3>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Pemesan *</label>
            <input
              type="text"
              autoComplete="name"
              value={applicant.name}
              onChange={(e) => setApplicant({ ...applicant, name: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="Nama Lengkap"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">No. WhatsApp *</label>
            <input
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              value={applicant.phone}
              onChange={(e) => setApplicant({ ...applicant, phone: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="08xxxxxxxxxx"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Email (Opsional)</label>
            <input
              type="email"
              inputMode="email"
              autoComplete="email"
              value={applicant.email}
              onChange={(e) => setApplicant({ ...applicant, email: e.target.value })}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              placeholder="email@domain.com"
            />
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">Data Jemaah ({pilgrims.length} Orang)</h3>
          <button
            type="button"
            onClick={handleAddPilgrim}
            className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Tambah Jemaah</span>
          </button>
        </div>

        {pilgrims.map((p, idx) => (
          <PilgrimCard
            key={idx}
            index={idx}
            pilgrim={p}
            canRemove={pilgrims.length > 1}
            onUpdate={updatePilgrim}
            onRemove={handleRemovePilgrim}
            onOCR={handleOCR}
          />
        ))}
      </div>

      <div className="bg-slate-900 text-white p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <span className="text-xs text-slate-400 block">Total Tagihan ({pilgrims.length} Jemaah)</span>
          <span className="text-2xl font-extrabold text-emerald-400">{formatRupiah(totalPrice)}</span>
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full sm:w-auto bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold px-6 py-3 rounded-xl transition text-sm flex items-center justify-center gap-2"
        >
          {loading ? 'Memproses Tagihan...' : 'Kirim Pendaftaran & Buat Tagihan'}
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </form>
  );
}
