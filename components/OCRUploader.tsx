'use client';

import React, { useState } from 'react';
import { Camera, RefreshCw, CheckCircle, AlertCircle } from 'lucide-react';

export type DocType = 'KTP' | 'KK' | 'PASPOR';

/** Data hasil OCR (semua field opsional — yang tidak terbaca dibiarkan kosong). */
export interface OCRResult {
  nik?: string;
  noKK?: string;
  fullName?: string;
  birthPlace?: string;
  birthDate?: string;
  gender?: string;
  address?: string;
  passportNumber?: string;
  passportExpiry?: string;
  docType?: DocType;
  detectedDocType?: DocType | '';
}

interface OCRUploaderProps {
  onDataExtracted: (data: OCRResult) => void;
  defaultDocType?: DocType;
}

const DOC_META: Record<DocType, { icon: string; title: string; hint: string; button: string }> = {
  KTP: {
    icon: '🪪',
    title: 'KTP',
    hint: 'Unggah foto e-KTP yang jelas: NIK, nama, tempat/tanggal lahir, dan alamat akan terisi otomatis.',
    button: 'Pilih / Ambil Foto KTP',
  },
  KK: {
    icon: '👨‍👩‍👧',
    title: 'Kartu Keluarga',
    hint: 'Unggah foto Kartu Keluarga: No. KK dan nama kepala keluarga akan terisi otomatis.',
    button: 'Pilih / Ambil Foto KK',
  },
  PASPOR: {
    icon: '🛂',
    title: 'Paspor',
    hint: 'Unggah foto halaman data paspor (bagian bawah bergaris): nomor paspor, tanggal lahir, dan masa berlaku akan terisi.',
    button: 'Pilih / Ambil Foto Paspor',
  },
};

export default function OCRUploader({ onDataExtracted, defaultDocType = 'KTP' }: OCRUploaderProps) {
  const [docType, setDocType] = useState<DocType>(defaultDocType);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const meta = DOC_META[docType];

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPreview(URL.createObjectURL(file));
    setLoading(true);
    setError(null);
    setSuccess(false);
    setNote(null);

    const formData = new FormData();
    formData.append('image', file);
    // Kirim jenis dokumen yang dipilih pengguna — sebelumnya ini tidak dikirim sama sekali
    // sehingga dokumen KK selalu diparse sebagai KTP.
    formData.append('docType', docType);

    try {
      const res = await fetch('/api/ocr', {
        method: 'POST',
        body: formData,
      });
      const result = await res.json();

      if (result.success && result.data) {
        setSuccess(true);
        if (result.data.detectedDocType && result.data.detectedDocType !== docType) {
          setNote(
            `Isi dokumen terbaca sebagai ${result.data.detectedDocType}. Data terbaik dari kedua jenis sudah dipakai — mohon periksa hasilnya.`
          );
        }
        onDataExtracted(result.data);
      } else {
        setError(
          result.message ||
            'Gagal mengenali isi dokumen. Anda tetap dapat menginput datanya secara manual di form bawah.'
        );
      }
    } catch (err: any) {
      setError('Koneksi OCR terganggu. Silakan lengkapi form di bawah secara manual.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-emerald-50/60 border-2 border-dashed border-emerald-300 rounded-2xl p-5">
      <div className="flex flex-wrap gap-1.5 mb-4">
        {(Object.keys(DOC_META) as DocType[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => {
              setDocType(t);
              setSuccess(false);
              setError(null);
              setNote(null);
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
              docType === t
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'bg-white text-slate-600 border-slate-300 hover:border-emerald-400'
            }`}
          >
            {DOC_META[t].icon} {DOC_META[t].title}
          </button>
        ))}
      </div>

      <div className="flex flex-col sm:flex-row items-center gap-5">
        <div className="w-full sm:w-1/3 flex flex-col items-center justify-center">
          {preview ? (
            <img
              src={preview}
              alt={`Preview ${meta.title}`}
              className="w-full h-32 object-cover rounded-lg border border-emerald-200 shadow-sm"
            />
          ) : (
            <div className="w-full h-32 bg-white rounded-lg border border-dashed border-emerald-300 flex flex-col items-center justify-center text-slate-400 p-4 text-center">
              <Camera className="w-8 h-8 text-emerald-500 mb-1" />
              <span className="text-xs">Foto / Scan {meta.title}</span>
            </div>
          )}
        </div>

        <div className="w-full sm:w-2/3 space-y-3">
          <div>
            <h4 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span>✨ Fitur Cerdas: Auto-Fill Form via Scan {meta.title} (OCR)</span>
            </h4>
            <p className="text-xs text-slate-600 mt-1">{meta.hint}</p>
          </div>

          <label className="inline-flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold px-4 py-2.5 rounded-xl cursor-pointer shadow-sm transition">
            <Camera className="w-4 h-4" />
            <span>{loading ? `Membaca Teks ${meta.title}...` : meta.button}</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleFileChange} disabled={loading} />
          </label>

          {loading && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 animate-pulse font-medium">
              <RefreshCw className="w-4 h-4 animate-spin" />
              <span>Memproses OCR &amp; ekstraksi teks {meta.title} secara otomatis...</span>
            </div>
          )}

          {success && (
            <div className="flex items-center gap-2 text-xs text-emerald-700 bg-emerald-100/80 px-3 py-1.5 rounded-lg font-medium">
              <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>Data {meta.title} berhasil diekstrak ke formulir! Silakan periksa kembali kecocokan data.</span>
            </div>
          )}

          {note && (
            <div className="flex items-center gap-2 text-xs text-sky-800 bg-sky-50 px-3 py-1.5 rounded-lg border border-sky-200">
              <AlertCircle className="w-4 h-4 text-sky-600 shrink-0" />
              <span>{note}</span>
            </div>
          )}

          {error && (
            <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg border border-amber-200">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
