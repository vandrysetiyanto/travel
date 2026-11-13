'use client';

/**
 * Komponen UI dasar dashboard.
 *
 * Dipisahkan dari app/admin/dashboard/page.tsx yang sebelumnya memuat 30 komponen
 * dan 4.300+ baris dalam satu berkas. Berkas sebesar itu membuat setiap perubahan
 * berisiko menjatuhkan seluruh panel admin dan sulit diuji terpisah.
 *
 * Modul ini hanya komponen presentasional (tanpa akses data).
 */
import React from 'react';

export function EmptyState({ icon, title, description, actionText, onAction }: {
  icon: string; title: string; description: string; actionText?: string; onAction?: () => void;
}) {
  return (
    <div className="py-12 px-4 text-center flex flex-col items-center justify-center">

      <div className="w-16 h-16 rounded-2xl bg-slate-100 flex items-center justify-center text-3xl mb-3 border border-slate-200 shadow-xs">
        {icon}
      </div>
      <h4 className="font-extrabold text-slate-800 text-base">{title}</h4>
      <p className="text-xs text-slate-500 max-w-sm mt-1 mb-4 leading-relaxed">{description}</p>
      {actionText && onAction && (
        <button onClick={onAction} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-xs">
          {actionText}
        </button>
      )}
    </div>
  );
}

export function StatusBadge({ s }: { s: string }) {
  const isPaid = s === 'PAID';
  const isDp = s === 'DP';
  const isPending = s === 'PENDING';
  
  const style = isPaid 
    ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
    : isDp 
    ? 'bg-amber-50 text-amber-700 border-amber-200' 
    : isPending 
    ? 'bg-rose-50 text-rose-700 border-rose-200' 
    : 'bg-slate-100 text-slate-600 border-slate-200';

  const dot = isPaid ? 'bg-emerald-500' : isDp ? 'bg-amber-500' : isPending ? 'bg-rose-500' : 'bg-slate-400';

  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${style}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot}`} />
      {s === 'PAID' ? 'Lunas' : s === 'DP' ? 'Sudah DP' : s === 'PENDING' ? 'Menunggu' : s}
    </span>
  );
}

export function DocBadge({ s }: { s: string }) {
  const c = s === 'SUDAH' || s === 'ISSUED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  return <span className={'px-2 py-0.5 rounded text-xs font-medium ' + c}>{s}</span>;
}

export function ToastContainer({ toast, onClose }: { toast: { msg: string; type: 'success' | 'error' | 'info' } | null; onClose: () => void }) {
  if (!toast) return null;
  const isSuccess = toast.type === 'success';
  const isError = toast.type === 'error';

  return (
    <div className="fixed bottom-5 right-5 z-50 animate-in slide-in-from-bottom-5 duration-300">
      <div className={"flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl border text-sm font-medium " + 
        (isSuccess ? "bg-slate-900 text-white border-emerald-500/40" : isError ? "bg-rose-950 text-rose-100 border-rose-500/40" : "bg-slate-900 text-white border-slate-700")}>
        <span className="text-lg">{isSuccess ? "" : isError ? "" : ""}</span>
        <span className="max-w-xs">{toast.msg}</span>
        <button onClick={onClose} className="text-slate-400 hover:text-white ml-2 text-xs"></button>
      </div>
    </div>
  );
}

export function FInput({ label, field, type, form, setForm, placeholder, maxLength }: {
  label: string; field: string; type?: string;
  form: any; setForm: (updater: (prev: any) => any) => void;
  placeholder?: string; maxLength?: number;
}) {
  const isNum = type === 'number';
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      <input
        type={type || 'text'}
        inputMode={isNum ? 'numeric' : undefined}
        pattern={isNum ? '[0-9]*' : undefined}
        placeholder={placeholder}
        maxLength={maxLength}
        value={form[field] || ''}
        onChange={e => setForm((p: any) => ({ ...p, [field]: e.target.value }))}
        className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"
      />
    </div>
  );
}
