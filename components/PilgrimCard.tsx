'use client';

import React, { useState } from 'react';
import { UserCheck, Trash2, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import OCRUploader, { type OCRResult } from './OCRUploader';

export interface PilgrimData {
  nik: string;
  no_kk: string;
  full_name: string;
  gender: string;
  birth_place: string;
  birth_date: string;
  phone: string;
  address: string;
  passport_number: string;
  passport_expiry: string;
}

interface PilgrimCardProps {
  index: number;
  pilgrim: PilgrimData;
  canRemove: boolean;
  onUpdate: (index: number, field: keyof PilgrimData, value: string) => void;
  onRemove: (index: number) => void;
  onOCR: (index: number, data: OCRResult) => void;
}

export default function PilgrimCard({ index, pilgrim, canRemove, onUpdate, onRemove, onOCR }: PilgrimCardProps) {
  const [showPassport, setShowPassport] = useState(Boolean(pilgrim.passport_number || pilgrim.passport_expiry));
  const nikLen = (pilgrim.nik || '').replace(/\D/g, '').length;
  const isNikValid = nikLen === 16;

  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <span className="text-sm font-bold text-slate-800 flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-emerald-600" />
          <span>Data Jemaah #{index + 1}</span>
        </span>
        {canRemove && (
          <button type="button" onClick={() => onRemove(index)} className="text-xs text-red-500 hover:text-red-700 font-semibold flex items-center gap-1">
            <Trash2 className="w-3.5 h-3.5" />
            <span>Hapus</span>
          </button>
        )}
      </div>

      <OCRUploader defaultDocType="KTP" onDataExtracted={(data) => onOCR(index, data)} />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="block text-xs font-semibold text-slate-700">NIK (16 Digit) *</label>
            <span className={`text-[11px] font-mono font-bold ${isNikValid ? 'text-emerald-600' : nikLen > 0 ? 'text-amber-600' : 'text-slate-400'}`}>
              {nikLen}/16 digit
            </span>
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={16}
            placeholder="16 digit NIK sesuai KTP"
            value={pilgrim.nik}
            onChange={(e) => onUpdate(index, 'nik', e.target.value.replace(/\D/g, ''))}
            className={`w-full bg-slate-50 border rounded-xl px-3 py-2 text-sm focus:ring-2 focus:outline-none font-mono ${
              nikLen > 0 && !isNikValid ? 'border-amber-400 focus:ring-amber-400' : 'border-slate-300 focus:ring-emerald-500'
            }`}
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">No. Kartu Keluarga (Opsional)</label>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={16}
            placeholder="16 digit No. KK"
            value={pilgrim.no_kk}
            onChange={(e) => onUpdate(index, 'no_kk', e.target.value.replace(/\D/g, ''))}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono"
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nama Lengkap *</label>
          <input
            type="text"
            autoComplete="name"
            placeholder="Sesuai KTP / Paspor"
            value={pilgrim.full_name}
            onChange={(e) => onUpdate(index, 'full_name', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Jenis Kelamin</label>
          <select
            value={pilgrim.gender}
            onChange={(e) => onUpdate(index, 'gender', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          >
            <option value="L">Laki-laki</option>
            <option value="P">Perempuan</option>
          </select>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tempat Lahir</label>
            <input
              type="text"
              placeholder="Kota kelahiran"
              value={pilgrim.birth_place}
              onChange={(e) => onUpdate(index, 'birth_place', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Tgl Lahir</label>
            <input
              type="date"
              value={pilgrim.birth_date}
              onChange={(e) => onUpdate(index, 'birth_date', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1">Nomor HP / WhatsApp Jemaah</label>
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            placeholder="08xxxxxxxxxx"
            value={pilgrim.phone}
            onChange={(e) => onUpdate(index, 'phone', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>

        <div className="sm:col-span-2">
          <label className="block text-xs font-semibold text-slate-700 mb-1">Alamat Lengkap</label>
          <input
            type="text"
            autoComplete="street-address"
            placeholder="Alamat sesuai KTP"
            value={pilgrim.address}
            onChange={(e) => onUpdate(index, 'address', e.target.value)}
            className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
          />
        </div>
      </div>

      {/* Progressive Disclosure: Paspor */}
      <div className="border-t border-slate-100 pt-3">
        <button
          type="button"
          onClick={() => setShowPassport(!showPassport)}
          className="flex items-center justify-between w-full text-left text-xs font-bold text-slate-700 hover:text-emerald-700 py-1 transition"
        >
          <span className="flex items-center gap-1.5">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Data Paspor (Opsional — bisa dilengkapi nanti)</span>
          </span>
          {showPassport ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showPassport && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-3 pt-3 border-t border-dashed border-slate-200">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">No. Paspor</label>
              <input
                type="text"
                placeholder="Contoh: X1234567"
                value={pilgrim.passport_number}
                onChange={(e) => onUpdate(index, 'passport_number', e.target.value.toUpperCase())}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none font-mono uppercase"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Masa Berlaku Paspor</label>
              <input
                type="date"
                value={pilgrim.passport_expiry}
                onChange={(e) => onUpdate(index, 'passport_expiry', e.target.value)}
                className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
