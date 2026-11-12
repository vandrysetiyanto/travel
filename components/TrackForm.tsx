'use client';

import React, { useState, useEffect } from 'react';
import { Search, Upload, CheckCircle2, Clock, XCircle, CreditCard, ArrowRight, Building2, AlertCircle, Smartphone } from 'lucide-react';
import { formatRupiah } from '@/lib/utils';

const STATUS_LABEL: Record<string, { text: string; color: string }> = {
  PAID: { text: 'Lunas', color: 'bg-emerald-100 text-emerald-800' },
  DP: { text: 'Sudah DP', color: 'bg-amber-100 text-amber-800' },
  PENDING: { text: 'Menunggu Pembayaran', color: 'bg-rose-100 text-rose-800' },
  CANCELLED: { text: 'Dibatalkan', color: 'bg-slate-100 text-slate-800' },
};

const PAY_STATUS: Record<string, { text: string; color: string }> = {
  APPROVED: { text: 'Terverifikasi', color: 'bg-emerald-100 text-emerald-800' },
  REJECTED: { text: 'Ditolak', color: 'bg-rose-100 text-rose-800' },
  WAITING_APPROVAL: { text: 'Menunggu Verifikasi', color: 'bg-amber-100 text-amber-800' },
};

const INDONESIAN_BANKS = [
  'Bank BCA',
  'Bank Mandiri',
  'Bank BSI (Bank Syariah Indonesia)',
  'Bank BRI',
  'Bank BNI',
  'Bank CIMB Niaga',
  'Bank Permata',
  'Bank Danamon',
  'Bank Muamalat',
  'Bank Mega',
  'Bank BTN',
  'Bank Jago',
  'Seabank',
  'Lainnya (Bank Lain)'
];

const EWALLET_LIST = [
  'QRIS',
  'GoPay',
  'OVO',
  'DANA',
  'ShopeePay',
  'LinkAja',
  'Lainnya (E-Wallet Lain)'
];

// Helper helper format ribuan
const formatThousand = (val: string) => {
  const digits = val.replace(/\D/g, '');
  if (!digits) return '';
  return new Intl.NumberFormat('id-ID').format(Number(digits));
};

export default function TrackForm({ initialCode = '' }: { initialCode?: string }) {
  const [code, setCode] = useState(initialCode);
  // 4 digit terakhir nomor HP — dipakai membuka nama lengkap & nomor kwitansi.
  const [verify, setVerify] = useState('');
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [showUpload, setShowUpload] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState('');

  // Official Destination Banks from DB
  const [officialBanks, setOfficialBanks] = useState<any[]>([]);

  // Form inputs
  const [rawAmount, setRawAmount] = useState('');
  const [displayAmount, setDisplayAmount] = useState('');
  const [uploadPhase, setUploadPhase] = useState('DP');
  const [destinationBank, setDestinationBank] = useState('');
  const [paymentChannel, setPaymentChannel] = useState<'BANK' | 'EWALLET'>('BANK');
  
  // Bank sender
  const [senderBankSelect, setSenderBankSelect] = useState('Bank BCA');
  const [senderBankCustom, setSenderBankCustom] = useState('');
  
  // E-Wallet sender
  const [senderEwalletSelect, setSenderEwalletSelect] = useState('QRIS');
  const [senderEwalletCustom, setSenderEwalletCustom] = useState('');

  const [senderAccountNo, setSenderAccountNo] = useState('');
  const [senderAccountName, setSenderAccountName] = useState('');
  const [uploadFile, setUploadFile] = useState<File | null>(null);

  useEffect(() => {
    if (initialCode) doSearch(initialCode);
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success && d.bankAccounts?.length) {
          setOfficialBanks(d.bankAccounts);
          setDestinationBank(`${d.bankAccounts[0].bank_name} - ${d.bankAccounts[0].account_number}`);
        }
      })
      .catch(() => {});
  }, []);

  const handleAmountChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '');
    setRawAmount(raw);
    setDisplayAmount(raw ? formatThousand(raw) : '');
  };

  const doSearch = async (searchCode?: string) => {
    const q = (searchCode || code).trim();
    if (!q) return;
    setLoading(true);
    setError('');
    setData(null);
    setUploadMsg('');
    try {
      const v = verify.replace(/\D/g, '').slice(0, 4);
      const res = await fetch(`/api/track?code=${encodeURIComponent(q)}${v ? `&verify=${v}` : ''}`);
      const json = await res.json();
      if (json.success) {
        setData(json);
      } else {
        setError(json.message || 'Kode booking tidak ditemukan.');
      }
    } catch (err: any) {
      setError('Gagal menghubungi server.');
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!uploadFile) {
      setUploadMsg('Pilih foto bukti transfer terlebih dahulu.');
      return;
    }
    if (!rawAmount || Number(rawAmount) <= 0) {
      setUploadMsg('Masukkan nominal transfer yang valid.');
      return;
    }

    setUploading(true);
    setUploadMsg('');
    try {
      let finalSenderMethod = '';
      if (paymentChannel === 'BANK') {
        finalSenderMethod = senderBankSelect === 'Lainnya (Bank Lain)' ? senderBankCustom : senderBankSelect;
      } else {
        finalSenderMethod = senderEwalletSelect === 'Lainnya (E-Wallet Lain)' ? senderEwalletCustom : senderEwalletSelect;
      }

      const channelPrefix = paymentChannel === 'EWALLET' ? '[E-Wallet] ' : '[Bank] ';
      const fd = new FormData();
      fd.append('booking_code', data.registration.booking_code);
      fd.append('amount', rawAmount);
      fd.append('payment_phase', uploadPhase);
      fd.append('bank_name', `${destinationBank} (Pengirim: ${channelPrefix}${finalSenderMethod} ${senderAccountNo ? 'No.'+senderAccountNo : ''})`);
      fd.append('account_name', senderAccountName);
      fd.append('proof_image', uploadFile);

      const res = await fetch('/api/payments/upload', { method: 'POST', body: fd });
      const json = await res.json();
      if (json.success) {
        setUploadMsg('✅ Bukti pembayaran berhasil dikirim! Menunggu verifikasi tim admin.');
        setShowUpload(false);
        setUploadFile(null);
        setRawAmount('');
        setDisplayAmount('');
        doSearch();
      } else {
        setUploadMsg('❌ Gagal: ' + json.message);
      }
    } catch (err: any) {
      setUploadMsg('❌ Error: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const reg = data?.registration;
  const statusInfo = reg ? (STATUS_LABEL[reg.payment_status] || STATUS_LABEL.PENDING) : null;

  // Safe Financial Values calculation to avoid NaN
  const pkgPrice = Number(reg?.package_price || reg?.total_amount || reg?.price || 0);
  const paidAmount = Number(reg?.paid_amount || 0);
  const remainingAmount = Number(reg?.remaining_amount != null ? reg.remaining_amount : Math.max(0, pkgPrice - paidAmount));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Cek Status & Invoice Ibadah</h1>
        <p className="text-xs sm:text-sm text-slate-500 mt-1">
          Masukkan Kode Booking yang Anda terima saat pendaftaran untuk memeriksa tagihan dan mengirim bukti transfer.
        </p>
      </div>

      {/* Search Bar */}
      <div className="flex gap-2">
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="Contoh: UMR-2609-1234"
          className="flex-1 bg-white border border-slate-300 rounded-xl px-4 py-3 text-sm font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
        />
        <input
          type="text"
          inputMode="numeric"
          value={verify}
          onChange={(e) => setVerify(e.target.value.replace(/\D/g, '').slice(0, 4))}
          placeholder="4 digit HP"
          title="4 digit terakhir nomor HP yang dipakai saat mendaftar (untuk membuka nama lengkap)"
          className="w-32 bg-white border border-slate-300 rounded-xl px-3 py-3 text-sm font-mono text-center focus:ring-2 focus:ring-slate-900 focus:outline-none"
          onKeyDown={(e) => e.key === 'Enter' && doSearch()}
        />
        <button
          onClick={() => doSearch()}
          disabled={loading}
          className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 rounded-xl transition flex items-center gap-2 text-xs uppercase tracking-wider cursor-pointer"
        >
          <Search className="w-4 h-4" />
          <span>{loading ? 'Mencari...' : 'Cek Status'}</span>
        </button>
      </div>

      {error && (
        <div className="bg-rose-50 text-rose-700 border border-rose-200 p-4 rounded-xl text-xs font-semibold flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {uploadMsg && (
        <div className="bg-emerald-50 text-emerald-800 border border-emerald-200 p-4 rounded-xl text-xs font-semibold">
          {uploadMsg}
        </div>
      )}

      {reg && (
        <div className="space-y-6">
          {/* Invoice Summary Card */}
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
            <div className="bg-slate-900 text-white p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Nomor Booking Resmi</p>
                <p className="text-2xl font-mono font-black text-emerald-400 mt-0.5">{reg.booking_code}</p>
                <p className="text-[11px] text-slate-400 mt-1">Tanggal Daftar: {reg.created_at || '-'}</p>
              </div>
              <span className={`px-3 py-1 rounded-full text-xs font-bold ${statusInfo?.color}`}>
                {statusInfo?.text}
              </span>
            </div>

            <div className="p-5 sm:p-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs border-b border-slate-100">
              <div>
                <span className="text-slate-400 block text-[11px]">Pilihan Paket:</span>
                <span className="font-bold text-slate-900">{reg.package_name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Jadwal / Batch:</span>
                <span className="font-bold text-slate-900">{reg.batch_name || reg.departure_date || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">Nama Jamaah:</span>
                <span className="font-bold text-slate-900">{reg.name || '-'}</span>
              </div>
              <div>
                <span className="text-slate-400 block text-[11px]">WhatsApp:</span>
                <span className="font-bold font-mono text-slate-900">{reg.phone || '-'}</span>
              </div>
            </div>

            {/* Financial Breakdown (Fixed NaN) */}
            <div className="p-5 sm:p-6 bg-slate-50/70 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <span className="text-[11px] text-slate-500 block">Total Biaya Paket:</span>
                <span className="text-lg font-black text-slate-900">{formatRupiah(pkgPrice)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Total Sudah Terbayar:</span>
                <span className="text-lg font-black text-emerald-700">{formatRupiah(paidAmount)}</span>
              </div>
              <div>
                <span className="text-[11px] text-slate-500 block">Sisa Tagihan:</span>
                <span className="text-lg font-black text-rose-600">{formatRupiah(remainingAmount)}</span>
              </div>
            </div>
          </div>

          {/* Official Bank Account Destination Cards */}
          {reg.payment_status !== 'PAID' && (
            <div className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xs">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-emerald-700" />
                  <h3 className="text-sm font-black text-slate-900">Rekening Resmi Tujuan Pembayaran</h3>
                </div>
                <span className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Silakan transfer ke salah satu rekening berikut</span>
              </div>

              {/* Dynamic Bank Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {officialBanks.length > 0 ? (
                  officialBanks.map((b: any) => (
                    <div key={b.id} className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-1">
                      <span className="text-[11px] font-bold text-slate-600 block">{b.bank_name}</span>
                      <span className="text-base font-black font-mono text-slate-900 tracking-tight block">{b.account_number}</span>
                      <span className="text-[11px] text-slate-500 block">a.n {b.account_holder}</span>
                    </div>
                  ))
                ) : (
                  <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200/80 space-y-1 sm:col-span-3">
                    <span className="text-[11px] font-bold text-slate-600 block">Bank Syariah Indonesia (BSI)</span>
                    <span className="text-base font-black font-mono text-slate-900 tracking-tight block">720-123-4567</span>
                    <span className="text-[11px] text-slate-500 block">a.n PT Al-Barakah Mandiri Utama</span>
                  </div>
                )}
              </div>

              {/* Toggle Upload Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => setShowUpload(!showUpload)}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white font-bold px-5 py-2.5 rounded-xl transition text-xs flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  <Upload className="w-3.5 h-3.5" />
                  <span>{showUpload ? 'Tutup Form Upload' : 'Upload Bukti Transfer Pembayaran'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Form Isian Bukti Transfer */}
          {showUpload && (
            <form onSubmit={handleUpload} className="bg-white border border-slate-200/80 rounded-2xl p-5 sm:p-6 space-y-5 shadow-xs">
              <div>
                <h3 className="text-sm font-black text-slate-900">Form Konfirmasi Pembayaran</h3>
                <p className="text-[11px] text-slate-500 mt-0.5">Lengkapi data transfer/e-wallet untuk mempermudah verifikasi tim finance.</p>
              </div>

              {/* Pilih Metode Pembayaran Pengirim */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700">Metode Pengiriman Dana *</label>
                <div className="grid grid-cols-2 gap-2 max-w-sm">
                  <button
                    type="button"
                    onClick={() => setPaymentChannel('BANK')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                      paymentChannel === 'BANK'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Transfer Bank</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setPaymentChannel('EWALLET')}
                    className={`px-4 py-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 border cursor-pointer ${
                      paymentChannel === 'EWALLET'
                        ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <Smartphone className="w-4 h-4" />
                    <span>E-Wallet / QRIS</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* Bank Tujuan */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Rekening Tujuan Travel *</label>
                  <select
                    value={destinationBank}
                    onChange={(e) => setDestinationBank(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    required
                  >
                    {officialBanks.length > 0 ? (
                      officialBanks.map((b: any) => (
                        <option key={b.id} value={`${b.bank_name} - ${b.account_number}`}>
                          {b.bank_name} ({b.account_number} a.n {b.account_holder})
                        </option>
                      ))
                    ) : (
                      <option value="BSI - 720-123-4567">BSI - 720-123-4567 (PT Al-Barakah)</option>
                    )}
                  </select>
                </div>

                {/* Tahap Pembayaran */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Tahap Pembayaran *</label>
                  <select
                    value={uploadPhase}
                    onChange={(e) => setUploadPhase(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  >
                    <option value="DP">Uang Muka (DP)</option>
                    <option value="PELUNASAN">Pelunasan</option>
                    <option value="FULL">Pembayaran Penuh (Full)</option>
                  </select>
                </div>

                {/* Jumlah Transfer (Formatted Auto Rp) */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">Nominal yang Ditransfer *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-2 text-xs font-bold text-slate-400">Rp</span>
                    <input
                      type="text"
                      value={displayAmount}
                      onChange={handleAmountChange}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl pl-9 pr-3 py-2 text-xs font-mono font-bold focus:ring-2 focus:ring-slate-900 focus:outline-none text-slate-900"
                      placeholder="Contoh: 15.000.000"
                      inputMode="numeric"
                      required
                    />
                  </div>
                </div>

                {/* Pilihan Bank / E-Wallet Pengirim */}
                {paymentChannel === 'BANK' ? (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Bank Asal Pengirim *</label>
                    <select
                      value={senderBankSelect}
                      onChange={(e) => setSenderBankSelect(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    >
                      {INDONESIAN_BANKS.map((bank) => (
                        <option key={bank} value={bank}>{bank}</option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label className="block text-xs font-bold text-slate-700 mb-1">Layanan E-Wallet / QRIS Pengirim *</label>
                    <select
                      value={senderEwalletSelect}
                      onChange={(e) => setSenderEwalletSelect(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    >
                      {EWALLET_LIST.map((ew) => (
                        <option key={ew} value={ew}>{ew}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Custom Bank Name if 'Lainnya' */}
                {paymentChannel === 'BANK' && senderBankSelect === 'Lainnya (Bank Lain)' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Bank Pengirim Lainnya *</label>
                    <input
                      type="text"
                      value={senderBankCustom}
                      onChange={(e) => setSenderBankCustom(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      placeholder="Masukkan nama bank pengirim"
                      required
                    />
                  </div>
                )}

                {/* Custom E-Wallet Name if 'Lainnya' */}
                {paymentChannel === 'EWALLET' && senderEwalletSelect === 'Lainnya (E-Wallet Lain)' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-slate-700 mb-1">Nama Aplikasi / E-Wallet Lainnya *</label>
                    <input
                      type="text"
                      value={senderEwalletCustom}
                      onChange={(e) => setSenderEwalletCustom(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                      placeholder="Masukkan nama e-wallet"
                      required
                    />
                  </div>
                )}

                {/* Nomor Rekening / Nomor HP E-Wallet */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {paymentChannel === 'BANK' ? 'Nomor Rekening Pengirim (Opsional)' : 'Nomor HP Akun E-Wallet (Opsional)'}
                  </label>
                  <input
                    type="text"
                    value={senderAccountNo}
                    onChange={(e) => setSenderAccountNo(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder={paymentChannel === 'BANK' ? 'Nomor rekening Anda' : '0812xxxxxxx'}
                    inputMode="numeric"
                  />
                </div>

                {/* Nama Pemilik Rekening / Akun */}
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    {paymentChannel === 'BANK' ? 'Nama Pemilik Rekening *' : 'Nama Akun / Pemilik E-Wallet *'}
                  </label>
                  <input
                    type="text"
                    value={senderAccountName}
                    onChange={(e) => setSenderAccountName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-300 rounded-xl px-3 py-2 text-xs focus:ring-2 focus:ring-slate-900 focus:outline-none"
                    placeholder="Sesuai nama di akun pengirim"
                    required
                  />
                </div>

                {/* File Upload */}
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-700 mb-1">Foto Bukti Transfer / Resi E-Wallet *</label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    className="w-full text-xs border border-slate-300 rounded-xl p-2 bg-slate-50 file:mr-3 file:py-1 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-semibold file:bg-slate-900 file:text-white hover:file:bg-slate-800"
                    required
                  />
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={uploading}
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-6 py-2.5 rounded-xl text-xs transition flex items-center gap-2 cursor-pointer shadow-2xs"
                >
                  {uploading ? 'Mengunggah...' : 'Kirim Bukti Pembayaran Sekarang'}
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </form>
          )}

          {/* Payment History */}
          {data.payments && data.payments.length > 0 && (
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
              <div className="p-4 border-b border-slate-100">
                <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Riwayat Pembayaran Anda</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 text-slate-500">
                    <tr>
                      <th className="text-left px-4 py-2.5 font-bold">No. Kwitansi</th>
                      <th className="text-left px-4 py-2.5 font-bold">Jumlah</th>
                      <th className="text-left px-4 py-2.5 font-bold">Tahap</th>
                      <th className="text-left px-4 py-2.5 font-bold">Status Verifikasi</th>
                      <th className="text-left px-4 py-2.5 font-bold">Tanggal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.payments.map((pay: any) => {
                      const ps = PAY_STATUS[pay.status] || PAY_STATUS.WAITING_APPROVAL;
                      return (
                        <tr key={pay.id} className="border-t border-slate-100">
                          <td className="px-4 py-3 font-mono font-semibold">{pay.payment_number}</td>
                          <td className="px-4 py-3 font-bold text-slate-900">{formatRupiah(pay.amount)}</td>
                          <td className="px-4 py-3 text-slate-600">{pay.payment_phase}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ps.color}`}>{ps.text}</span>
                          </td>
                          <td className="px-4 py-3 text-slate-500">{pay.created_at}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
