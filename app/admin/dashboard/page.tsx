'use client';

/* ===================== EMPTY STATE HELPER ===================== */
function EmptyState({ icon, title, description, actionText, onAction }: {
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

/* ===================== TOAST NOTIFICATION ===================== */
function ToastContainer({ toast, onClose }: { toast: { msg: string; type: 'success' | 'error' | 'info' } | null; onClose: () => void }) {
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
import { useState, useEffect, useCallback, useRef } from 'react';
import { CheckSquare,
  FileText, Calculator, Wallet,
  LayoutDashboard, Users, Package, Boxes, ShoppingBag, Receipt,
  TrendingUp, Plane, ClipboardList, Building2, ShieldCheck, LogOut,
  Menu, X, CheckCircle2, Clock, AlertCircle, RefreshCw, BookOpen, CreditCard, FileSpreadsheet
} from 'lucide-react';


const fmt = (n: number) => new Intl.NumberFormat('id-ID').format(n);
const fmtRp = (n: number) => 'Rp ' + fmt(n);

type Tab = 'dashboard' | 'jamaah' | 'paket' | 'batches' | 'inventory' | 'master-coa' | 'transaksi' | 'manifest' | 'checklist' | 'laporan' | 'pembayaran' | 'laba-rugi' | 'neraca' | 'arus-kas' | 'ledger' | 'stock-ledger' | 'general-journal' | 'expenses' | 'registrations' | 'staf' | 'settings';
type MasterSub = 'jamaah' | 'paket' | 'inventaris';

/* ===================== DASHBOARD TAB ===================== */
function DashboardTab({ isOwner }: { isOwner: boolean }) {
  const [stats, setStats] = useState<any>(null);
  const [recent, setRecent] = useState<any[]>([]);
  useEffect(() => {
    fetch('/api/admin/stats').then(r => r.json()).then(d => {
      if (d.success) { setStats(d.stats); setRecent(d.recentTransactions || []); }
    });
  }, []);
  if (!stats) return <p className="text-center py-12 text-gray-500">Memuat data...</p>;
  const primaryCards = [
    ...(isOwner ? [
      { label: 'Total Omset', value: fmtRp(stats.totalRevenue), hint: 'Pendapatan bruto paket', color: 'text-slate-900' },
      { label: 'Total Piutang', value: fmtRp(stats.totalReceivables), hint: 'Sisa tagihan berjalan', color: 'text-amber-600' },
    ] : []),
    { label: 'Total Jamaah', value: fmt(stats.totalJamaah) + ' Orang', hint: 'Jamaah terdaftar', color: 'text-slate-900' },
    { label: 'Total Transaksi', value: fmt(stats.totalTransactions) + ' Trx', hint: 'Akumulasi booking', color: 'text-slate-900' },
  ];

  const statusCards = [
    { label: 'Lunas', value: fmt(stats.paidCount), badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    { label: 'Sudah DP', value: fmt(stats.dpCount), badge: 'bg-amber-50 text-amber-700 border-amber-200' },
    { label: 'Pending Tagihan', value: fmt(stats.pendingCount), badge: 'bg-rose-50 text-rose-700 border-rose-200' },
  ];

  return (
    <div className="space-y-6">
      {/* Linear Style Primary Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {primaryCards.map((c, i) => (
          <div key={i} className="bg-white rounded-2xl p-5 border border-slate-200/80 shadow-xs hover:border-slate-300 transition flex flex-col justify-between">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">{c.label}</span>
            <div className="my-2">
              <p className={`text-2xl font-black tracking-tight ${c.color}`}>{c.value}</p>
            </div>
            <p className="text-[11px] text-slate-400 font-medium">{c.hint}</p>
          </div>
        ))}
      </div>

      {/* Secondary Status Breakdown Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {statusCards.map((c, i) => (
          <div key={i} className="bg-white border border-slate-200/70 rounded-xl px-4 py-3 flex items-center justify-between shadow-2xs">
            <span className="text-xs font-semibold text-slate-600">{c.label}</span>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${c.badge}`}>{c.value}</span>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-xl shadow p-6">
        <h3 className="font-bold text-gray-800 mb-4">Transaksi Terbaru</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead><tr className="bg-gray-50 text-left">
              <th className="p-3">Kode</th><th className="p-3">Jamaah</th><th className="p-3">Paket</th>
              <th className="p-3">Total</th><th className="p-3">Dibayar</th><th className="p-3">Status</th><th className="p-3">Tanggal</th>
            </tr></thead>
            <tbody>
              {recent.map((t: any) => (
                <tr key={t.id} className="border-b hover:bg-gray-50">
                  <td className="p-3 font-mono text-xs">{t.booking_code}</td>
                  <td className="p-3">{t.full_name}</td>
                  <td className="p-3 text-xs">{t.package_name}</td>
                  <td className="p-3">{fmtRp(t.total_amount)}</td>
                  <td className="p-3">{fmtRp(t.paid_amount)}</td>
                  <td className="p-3"><StatusBadge s={t.status} /></td>
                  <td className="p-3 text-xs">{t.created_at}</td>
                </tr>
              ))}
              {recent.length === 0 && <tr><td colSpan={7}><EmptyState icon="" title="Belum Ada Transaksi" description="Belum ada riwayat transaksi atau booking umroh yang tercatat di sistem." /></td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ s }: { s: string }) {
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

function DocBadge({ s }: { s: string }) {
  const c = s === 'SUDAH' || s === 'ISSUED' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700';
  return <span className={'px-2 py-0.5 rounded text-xs font-medium ' + c}>{s}</span>;
}

/* Field input generik untuk form master. WAJIB di level modul (BUKAN di dalam
   komponen): kalau dideklarasikan di dalam, React menganggapnya tipe komponen
   baru tiap render -> <input> di-unmount & di-mount ulang tiap ketikan ->
   fokus hilang dan kursor melompat. */
function FInput({ label, field, type, form, setForm, placeholder, maxLength }: {
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

/* ===================== MASTER TAB ===================== */
function MasterTab({ sub, setSub }: { sub: MasterSub; setSub: (s: MasterSub) => void }) {
  const tabs: { id: MasterSub; label: string }[] = [
    { id: 'jamaah', label: ' Master Jamaah' },
    { id: 'paket', label: ' Master Paket' },
    { id: 'inventaris', label: ' Master Inventory' },
  ];
  return (
    <div>
      <div className="flex gap-2 mb-6">
        {tabs.map(t => (
          <button key={t.id} onClick={() => setSub(t.id)}
            className={'px-4 py-2 rounded-lg text-sm font-medium transition ' + (sub === t.id ? 'bg-emerald-600 text-white' : 'bg-white text-gray-600 hover:bg-gray-50')}>
            {t.label}
          </button>
        ))}
      </div>
      {sub === 'jamaah' && <MasterJamaah />}
      {sub === 'paket' && <MasterPaket />}
      {sub === 'inventaris' && <MasterInventaris />}
    </div>
  );
}

/* --- Master Jamaah --- */
function MasterJamaah() {
  const [list, setList] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [mode, setMode] = useState<'idle'|'open'>('idle');
  const [form, setForm] = useState<any>({});
  const [ocrLoading, setOcrLoading] = useState<string>('');
  const ktpFileRef = useRef<HTMLInputElement>(null);
  const kkFileRef = useRef<HTMLInputElement>(null);
  const paspFileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    const q = search ? `?search=${encodeURIComponent(search)}` : '';
    fetch('/api/admin/jamaah' + q).then(r => r.json()).then(d => { if (d.success) setList(d.jamaah || []); });
  }, [search]);
  useEffect(() => { load(); }, [load]);

  const openAdd = () => { setForm({}); setMode('open'); };
  const openEdit = (j: any) => { setForm(j); setMode('open'); };

  const mergeKeep = (p: any, patch: Record<string, string | undefined>) => {
    const next = { ...p };
    for (const [k, v] of Object.entries(patch)) {
      if (v && !next[k]) next[k] = v;
    }
    return next;
  };

  const handleOCR = async (docType: 'KTP'|'KK'|'PASPOR', fileRef: React.RefObject<HTMLInputElement>) => {
    const file = fileRef.current?.files?.[0];
    if (!file) return (window as any).__showAdminToast ? (window as any).__showAdminToast('Pilih file gambar terlebih dahulu', 'error') : alert('Pilih file gambar terlebih dahulu');
    setOcrLoading(docType);
    const fd = new FormData(); fd.append('image', file); fd.append('docType', docType);
    try {
      const res = await fetch('/api/ocr', { method: 'POST', body: fd });
      const d = await res.json();
      if (d.success && d.data) {
        setForm((prev: any) => mergeKeep(prev, d.data));
        (window as any).__showAdminToast ? (window as any).__showAdminToast(`Berhasil scan ${docType}!`, 'success') : alert(`Berhasil scan ${docType}!`);
      } else {
        alert(d.message || 'OCR gagal mengenali teks');
      }
    } catch (e: any) {
      alert('Gagal OCR: ' + e.message);
    }
    setOcrLoading('');
  };

  const save = async () => {
    if (!form.nik || !form.full_name) return (window as any).__showAdminToast ? (window as any).__showAdminToast('NIK dan Nama wajib diisi', 'error') : alert('NIK dan Nama wajib diisi');
    const res = await fetch('/api/admin/jamaah', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ action: form.id ? 'UPDATE_JAMAAH' : 'CREATE_JAMAAH', ...form }) 
    });
    const d = await res.json(); 
    (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error') : alert(d.message); 
    if (d.success) { setMode('idle'); setForm({}); load(); }
  };

  const remove = async (id: number) => {
    if (!confirm('Hapus data jamaah ini?')) return;
    const res = await fetch('/api/admin/jamaah', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ action: 'DELETE_JAMAAH', id }) 
    });
    const d = await res.json(); 
    if (d.success) load(); 
    else alert(d.message);
  };

  return (
    <div className="space-y-6">
      {/* Header & Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900">Database Data Jamaah</h3>
          <p className="text-xs text-slate-500">Pusat data informasi pribadi, paspor, dan dokumen jemaah.</p>
        </div>
        <div className="flex items-center gap-3 w-full sm:w-auto">
          <input 
            value={search} 
            onChange={e => setSearch(e.target.value)} 
            className="w-full sm:w-64 border rounded-xl px-3 py-2 text-xs" 
            placeholder="Cari NIK, Nama, atau No HP..." 
          />
          <button onClick={openAdd} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition shrink-0">+ Tambah Jamaah</button>
        </div>
      </div>

      {/* Modal Form Centered Pop-up */}
      {mode === 'open' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-3xl w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">{form.id ? 'Edit Data Jamaah' : 'Tambah Jamaah Baru'}</h3>
                <p className="text-xs text-slate-500">Lengkapi data pribadi dan dokumen pendukung.</p>
              </div>
              <button onClick={() => setMode('idle')} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            {/* OCR Smart Scan Section */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50 p-4 rounded-xl border border-slate-200/60">
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">Scan KTP (AI OCR)</p>
                <div className="flex gap-2">
                  <input type="file" accept="image/*" ref={ktpFileRef} className="hidden" onChange={() => handleOCR('KTP', ktpFileRef)} />
                  <button onClick={() => ktpFileRef.current?.click()} disabled={ocrLoading === 'KTP'} className="w-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold py-1.5 px-3 rounded-lg text-xs transition">
                    {ocrLoading === 'KTP' ? 'Memproses...' : 'Upload KTP'}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">Scan Kartu Keluarga (KK)</p>
                <div className="flex gap-2">
                  <input type="file" accept="image/*" ref={kkFileRef} className="hidden" onChange={() => handleOCR('KK', kkFileRef)} />
                  <button onClick={() => kkFileRef.current?.click()} disabled={ocrLoading === 'KK'} className="w-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold py-1.5 px-3 rounded-lg text-xs transition">
                    {ocrLoading === 'KK' ? 'Memproses...' : 'Upload KK'}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-bold text-slate-700">Scan Paspor</p>
                <div className="flex gap-2">
                  <input type="file" accept="image/*" ref={paspFileRef} className="hidden" onChange={() => handleOCR('PASPOR', paspFileRef)} />
                  <button onClick={() => paspFileRef.current?.click()} disabled={ocrLoading === 'PASPOR'} className="w-full bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 font-bold py-1.5 px-3 rounded-lg text-xs transition">
                    {ocrLoading === 'PASPOR' ? 'Memproses...' : 'Upload Paspor'}
                  </button>
                </div>
              </div>
            </div>

            {/* Form Fields Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FInput label="NIK KTP *" field="nik" form={form} setForm={setForm} placeholder="3201xxxxxxxxxxxx"/>
              <FInput label="Nama Lengkap *" field="full_name" form={form} setForm={setForm} placeholder="Sesuai KTP"/>
              <FInput label="Nomor WhatsApp / HP *" field="phone" form={form} setForm={setForm} placeholder="0812xxxxxxxx"/>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Jenis Kelamin</label>
                <select value={form.gender || 'L'} onChange={e => setForm({...form, gender: e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="L">Laki-laki</option>
                  <option value="P">Perempuan</option>
                </select>
              </div>
              <FInput label="Tempat Lahir" field="birth_place" form={form} setForm={setForm} placeholder="Jakarta"/>
              <FInput label="Tanggal Lahir" field="birth_date" type="date" form={form} setForm={setForm}/>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Alamat Sesuai KTP</label>
                <input value={form.address || ''} onChange={e => setForm({...form, address: e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" placeholder="Jl. Raya No. 123, RT/RW..."/>
              </div>
              <FInput label="Nomor Paspor" field="passport_number" form={form} setForm={setForm} placeholder="A1234567"/>
              <FInput label="Tanggal Terbit Paspor" field="passport_issue_date" type="date" form={form} setForm={setForm}/>
              <FInput label="Tanggal Expired Paspor" field="passport_expiry_date" type="date" form={form} setForm={setForm}/>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Status Visa</label>
                <select value={form.visa_status || 'PENDING'} onChange={e => setForm({...form, visa_status: e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="PENDING">Pending</option>
                  <option value="PROCESSING">Processing</option>
                  <option value="APPROVED">Approved</option>
                </select>
              </div>
              <FInput label="Kontak Darurat (Nama & HP)" field="emergency_contact" form={form} setForm={setForm} placeholder="Budi (0812...)"/>
              <FInput label="Riwayat Penyakit / Alergi" field="medical_notes" form={form} setForm={setForm} placeholder="Asam lambung / Hipertensi"/>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setMode('idle')} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={save} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Simpan Jamaah</button>
            </div>
          </div>
        </div>
      )}

      {/* Jamaah Table View */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">NIK</th>
              <th className="p-3">Nama Lengkap</th>
              <th className="p-3">L/P</th>
              <th className="p-3">No. HP</th>
              <th className="p-3">Paspor</th>
              <th className="p-3">Visa</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map((j: any) => (
              <tr key={j.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono text-slate-500 font-bold">{j.nik}</td>
                <td className="p-3 font-bold text-slate-900">{j.full_name}</td>
                <td className="p-3 text-slate-600">{j.gender}</td>
                <td className="p-3 font-mono text-slate-600">{j.phone}</td>
                <td className="p-3 font-mono text-slate-600">{j.passport_number || '-'}</td>
                <td className="p-3"><DocBadge s={j.visa_status}/></td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={() => openEdit(j)} className="text-indigo-600 hover:underline font-bold">Edit</button>
                  <button onClick={() => remove(j.id)} className="text-rose-600 hover:underline font-bold">Hapus</button>
                </td>
              </tr>
            ))}
            {list.length === 0 && (
              <tr><td colSpan={7} className="text-center py-8 text-slate-400">Belum ada data jemaah terdaftar.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --- Master Paket --- */
/* --- Master Paket --- */
function MasterPaket() {
  const [packages, setPackages] = useState<any[]>([]);
  const [pkgMode, setPkgMode] = useState<'idle'|'add'|'edit'>('idle');
  const [form, setForm] = useState<any>({});

  const load = () => { fetch('/api/admin/packages').then(r=>r.json()).then(d=>{ if(d.success){setPackages(d.packages||[]);} }); };
  useEffect(()=>{load();},[]);

  const save = async () => {
    if(!form.name||!form.price) return alert('Nama dan harga wajib diisi');
    const action = pkgMode === 'edit' ? 'UPDATE_PACKAGE' : 'CREATE_PACKAGE';
    const res = await fetch('/api/admin/packages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form, action})});
    const d = await res.json(); 
    if(d.success){
      alert('Paket berhasil disimpan');
      setPkgMode('idle');
      setForm({});
      load();
    } else {
      alert(d.message || 'Gagal menyimpan paket');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900">Katalog Paket Perjalanan</h3>
          <p className="text-xs text-slate-500">Manajemen program paket umroh/haji dan fasilitas utama.</p>
        </div>
        <button onClick={()=>{setForm({});setPkgMode('add');}} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ Tambah Paket</button>
      </div>

      {pkgMode !== 'idle' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">{pkgMode==='edit'?'Edit Paket Perjalanan':'Tambah Paket Perjalanan Baru'}</h3>
              <button onClick={()=>setPkgMode('idle')} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <FInput label="Nama Paket *" field="name" form={form} setForm={setForm} placeholder="Contoh: Umroh Reguler 9 Hari"/>
              <FInput label="Kategori" field="category" form={form} setForm={setForm} placeholder="Reguler / VIP"/>
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Harga (Rp) *</label>
                  <span className="text-[11px] font-bold text-emerald-600">{form.price ? fmtRp(Number(form.price)) : ''}</span>
                </div>
                <input type="number" inputMode="numeric" pattern="[0-9]*" value={form.price||''} onChange={e=>setForm({...form,price:e.target.value})} placeholder="35000000" className="w-full border rounded-xl px-3 py-2 text-xs font-mono" />
              </div>
              <FInput label="Durasi (Hari)" field="duration_days" type="number" form={form} setForm={setForm} placeholder="9"/>
              <FInput label="Hotel Makkah" field="hotel_makkah" form={form} setForm={setForm} placeholder="Pullman Zamzam"/>
              <FInput label="Hotel Madinah" field="hotel_madinah" form={form} setForm={setForm} placeholder="Front Pekan"/>
              <FInput label="Maskapai" field="airline" form={form} setForm={setForm} placeholder="Saudia Airlines"/>
              <FInput label="Kota Berangkat" field="departure_city" form={form} setForm={setForm} placeholder="Jakarta"/>
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Deskripsi & Fasilitas</label>
                <textarea value={form.description||''} onChange={e=>setForm({...form,description:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" rows={3} placeholder="Fasilitas termasuk tiket pesawat, visa, bus AC, dll..."/>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={()=>setPkgMode('idle')} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={save} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Simpan Paket</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">Nama Paket</th>
              <th className="p-3">Kategori</th>
              <th className="p-3">Harga</th>
              <th className="p-3">Durasi</th>
              <th className="p-3">Hotel (Makkah / Madinah)</th>
              <th className="p-3">Maskapai</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {packages.map((p:any)=>(
              <tr key={p.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-bold text-slate-900">{p.name}</td>
                <td className="p-3 text-slate-600">{p.category}</td>
                <td className="p-3 font-mono font-bold text-emerald-600">{fmtRp(p.price)}</td>
                <td className="p-3 text-slate-600">{p.duration_days} hari</td>
                <td className="p-3 text-slate-600">{p.hotel_makkah} / {p.hotel_madinah}</td>
                <td className="p-3 text-slate-600">{p.airline}</td>
                <td className="p-3 text-right">
                  <button onClick={()=>{setForm(p);setPkgMode('edit');}} className="text-indigo-600 hover:underline font-bold">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --- Master Batches --- */
function MasterBatches() {
  const [batches, setBatches] = useState<any[]>([]);
  const [packages, setPackages] = useState<any[]>([]);
  const [batchMode, setBatchMode] = useState<'idle'|'add'|'edit'>('idle');
  const [batchForm, setBatchForm] = useState<any>({});

  const load = () => { 
    fetch('/api/admin/packages').then(r=>r.json()).then(d=>{ 
      if(d.success){
        setBatches(d.batches||[]);
        setPackages(d.packages||[]);
      } 
    }); 
  };
  useEffect(()=>{load();},[]);

  const saveBatch = async () => {
    if(!batchForm.package_id||!batchForm.batch_name||!batchForm.departure_date||!batchForm.return_date) return alert('Paket, nama batch, dan tanggal wajib diisi');
    const action = batchMode === 'edit' ? 'UPDATE_BATCH' : 'CREATE_BATCH';
    const res = await fetch('/api/admin/packages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...batchForm, action})});
    const d = await res.json(); 
    if(d.success){
      alert('Batch berhasil disimpan');
      setBatchMode('idle');
      setBatchForm({});
      load();
    } else {
      alert(d.message || 'Gagal menyimpan batch');
    }
  };

  const deleteBatch = async (id: number) => {
    if(!confirm('Hapus batch ini?')) return;
    const res = await fetch('/api/admin/packages',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'DELETE_BATCH', id})});
    const d = await res.json(); 
    if(d.success) load(); 
    else alert(d.message);
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900">Jadwal & Batch Keberangkatan</h3>
          <p className="text-xs text-slate-500">Manajemen kuota kursi, jadwal musim, dan status operasional.</p>
        </div>
        <button onClick={()=>{setBatchForm({});setBatchMode('add');}} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ Tambah Batch</button>
      </div>

      {batchMode !== 'idle' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">{batchMode==='edit'?'Edit Batch Keberangkatan':'Tambah Batch Keberangkatan Baru'}</h3>
              <button onClick={()=>setBatchMode('idle')} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Pilih Paket *</label>
                <select value={batchForm.package_id||''} onChange={e=>setBatchForm({...batchForm, package_id:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="">-- Pilih Paket Perjalanan --</option>
                  {packages.map((p:any)=>(<option key={p.id} value={p.id}>{p.name} ({fmtRp(p.price)})</option>))}
                </select>
              </div>
              <FInput label="Nama Batch / Musim *" field="batch_name" form={batchForm} setForm={setBatchForm} placeholder="Batch 1 - Oktober"/>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Status Batch</label>
                <select value={batchForm.status||'OPEN'} onChange={e=>setBatchForm({...batchForm,status:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="OPEN">Open</option><option value="FULL">Full</option><option value="CLOSED">Closed</option>
                </select>
              </div>
              <FInput label="Tanggal Berangkat *" field="departure_date" type="date" form={batchForm} setForm={setBatchForm}/>
              <FInput label="Tanggal Pulang *" field="return_date" type="date" form={batchForm} setForm={setBatchForm}/>
              <FInput label="Kuota Kursi *" field="quota" type="number" form={batchForm} setForm={setBatchForm} placeholder="45"/>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={()=>setBatchMode('idle')} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={saveBatch} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Simpan Batch</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">Nama Batch</th>
              <th className="p-3">Paket</th>
              <th className="p-3">Berangkat</th>
              <th className="p-3">Pulang</th>
              <th className="p-3 text-center">Kuota</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {batches.map((b:any)=>(
              <tr key={b.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-bold text-slate-900">{b.batch_name}</td>
                <td className="p-3 text-slate-600">{b.package_name}</td>
                <td className="p-3 font-mono text-slate-600">{b.departure_date}</td>
                <td className="p-3 font-mono text-slate-600">{b.return_date}</td>
                <td className="p-3 text-center font-mono font-bold text-slate-900">{b.quota}</td>
                <td className="p-3"><StatusBadge s={b.status}/></td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={()=>{setBatchForm(b);setBatchMode('edit');}} className="text-indigo-600 hover:underline font-bold">Edit</button>
                  <button onClick={()=>deleteBatch(b.id)} className="text-rose-600 hover:underline font-bold">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* --- Master Inventaris --- */
function MasterInventaris() {
  const [items, setItems] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<any>({});

  const load = () => { fetch('/api/admin/inventory').then(r=>r.json()).then(d=>{ if(d.success) setItems(d.items||[]); }); };
  useEffect(()=>{load();},[]);

  const save = async () => {
    if(!form.code||!form.name) return alert('Kode dan Nama wajib diisi');
    const res = await fetch('/api/admin/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ADD_ITEM',...form})});
    const d = await res.json(); 
    if(d.success){
      alert('Barang inventaris berhasil disimpan');
      setShowForm(false);
      setForm({});
      load();
    } else {
      alert(d.message || 'Gagal menyimpan barang');
    }
  };

  const updateStock = async (id:number, stock:string) => {
    await fetch('/api/admin/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'UPDATE_STOCK',item_id:id,stock_total:stock})});
    load();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900">Inventaris & Stok Logistik</h3>
          <p className="text-xs text-slate-500">Manajemen perlengkapan jamaah dan mutasi stok gudang.</p>
        </div>
        <button onClick={()=>{setForm({});setShowForm(true);}} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ Tambah Barang</button>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Tambah Barang Inventaris Baru</h3>
              <button onClick={()=>setShowForm(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>
            <div className="space-y-3">
              <FInput label="Kode Barang *" field="code" form={form} setForm={setForm} placeholder="KOD-001"/>
              <FInput label="Nama Barang *" field="name" form={form} setForm={setForm} placeholder="Koper / Kain Ihram"/>
              <FInput label="Kategori" field="category" form={form} setForm={setForm} placeholder="Perlengkapan"/>
              <FInput label="Stok Awal" field="stock_total" type="number" form={form} setForm={setForm} placeholder="100"/>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={()=>setShowForm(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={save} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Simpan Barang</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">Kode</th>
              <th className="p-3">Nama Barang</th>
              <th className="p-3">Kategori</th>
              <th className="p-3 text-center">Stok Total</th>
              <th className="p-3 text-center">Stok Keluar</th>
              <th className="p-3 text-right">Aksi Update Stok</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.map(it=>(
              <tr key={it.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono text-slate-500 font-bold">{it.code}</td>
                <td className="p-3 font-bold text-slate-900">{it.name}</td>
                <td className="p-3 text-slate-600">{it.category || '-'}</td>
                <td className="p-3 text-center font-mono font-bold text-emerald-600">{it.stock_total}</td>
                <td className="p-3 text-center font-mono text-slate-600">{it.stock_out || 0}</td>
                <td className="p-3 text-right">
                  <input type="number" defaultValue={it.stock_total} onBlur={e=>updateStock(it.id, e.target.value)} className="w-20 border rounded-lg px-2 py-1 text-xs text-center font-mono" />
                </td>
              </tr>
            ))}
            {items.length===0 && <tr><td colSpan={6} className="text-center py-8 text-slate-400">Belum ada barang perlengkapan terdaftar.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== TRANSAKSI TAB ===================== */
function TransaksiTab() {
  const [txList, setTxList] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [jamaahList, setJamaahList] = useState<any[]>([]);
  const [filter, setFilter] = useState('ALL');
  const [showBooking, setShowBooking] = useState(false);
  const [detail, setDetail] = useState<any>(null);
  const [bookForm, setBookForm] = useState<any>({});
  const [jamaahSearch, setJamaahSearch] = useState('');
  const [payForm, setPayForm] = useState<any>({});
  const [showPayForm, setShowPayForm] = useState(false);
  const [invItems, setInvItems] = useState<any[]>([]);
  const [bookItems, setBookItems] = useState<{item_id:string; qty:number}[]>([]);

  const loadTx = useCallback(() => {
    const q = filter !== 'ALL' ? `?status=${filter}` : '';
    fetch('/api/admin/transactions' + q).then(r=>r.json()).then(d=>{ if(d.success) setTxList(d.transactions||[]); });
  }, [filter]);
  useEffect(()=>{loadTx();},[loadTx]);
  useEffect(()=>{
    fetch('/api/admin/packages').then(r=>r.json()).then(d=>{ if(d.success) setBatches(d.batches||[]); });
    fetch('/api/admin/inventory').then(r=>r.json()).then(d=>{ if(d.success) setInvItems(d.items||[]); });
  },[]);

  const searchJamaah = () => {
    if(!jamaahSearch) return;
    fetch('/api/admin/jamaah?search='+encodeURIComponent(jamaahSearch)).then(r=>r.json()).then(d=>{ if(d.success) setJamaahList(d.jamaah||[]); });
  };

  const createBooking = async () => {
    if(!bookForm.jamaah_id||!bookForm.batch_id) return (window as any).__showAdminToast ? (window as any).__showAdminToast('Pilih Jamaah dan Batch terlebih dahulu', 'error') : alert('Pilih Jamaah dan Batch');
    const res = await fetch('/api/admin/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'CREATE_BOOKING',...bookForm})});
    const d = await res.json();
    if(d.success){
      const items = bookItems.filter(it=>it.item_id && Number(it.qty)>0);
      for(const it of items){
        const hr = await fetch('/api/admin/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'HANDOVER',transaction_id:d.transaction_id,item_id:it.item_id,qty:it.qty})});
        const hd = await hr.json();
        if(!hd.success) alert('Gagal menyerahkan salah satu item: ' + hd.message);
      }
      setShowBooking(false);setBookForm({});setBookItems([]);loadTx();
    }
    (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error') : alert(d.message);
  };

  const loadDetail = async (id: number) => {
    const res = await fetch('/api/admin/transactions?id='+id);
    const d = await res.json(); if(d.success) setDetail(d.transaction);
  };

  const addPayment = async () => {
    if(!payForm.amount) return (window as any).__showAdminToast ? (window as any).__showAdminToast('Nominal pembayaran wajib diisi', 'error') : alert('Nominal wajib diisi');
    const res = await fetch('/api/admin/transactions',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'ADD_PAYMENT',transaction_id:detail.id,...payForm})});
    const d = await res.json(); (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error') : alert(d.message); if(d.success){setShowPayForm(false);setPayForm({});loadDetail(detail.id);loadTx();}
  };

  const printReceipt = async (pay: any) => {
    let company: any = { company_name: 'Al-Barakah Tour & Travel', ppiu_number: 'Izin Kemenag No. 123/PPIU/2024', address: 'Jakarta Selatan', phone: '0812-3456-7890', director_name: 'H. Fachrul Kurniawan' };
    try {
      const res = await fetch('/api/admin/settings');
      const d = await res.json();
      if (d.success && d.profile?.company_name) company = d.profile;
    } catch {}

    const w = window.open('','','width=700,height=750');
    if(!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Kwitansi Pembayaran - ${pay.receipt_number}</title>
          <style>
            body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; padding: 25px; color: #1e293b; line-height: 1.4; }
            .header { border-bottom: 2px solid #059669; padding-bottom: 12px; margin-bottom: 18px; display: flex; justify-content: space-between; }
            .watermark { position: fixed; top: 35%; left: 15%; font-size: 80px; font-weight: 900; color: rgba(5, 150, 105, 0.04); transform: rotate(-30deg); text-transform: uppercase; z-index: -1; pointer-events: none; }
            .stamp-box { position: relative; display: inline-block; }
            .stamp-badge { border: 2px solid #059669; border-radius: 8px; color: #059669; font-size: 10px; font-weight: 900; padding: 4px 8px; text-transform: uppercase; display: inline-block; margin-top: 15px; transform: rotate(-5deg); background: rgba(236, 253, 245, 0.8); }
            .brand h2 { margin: 0; color: #059669; font-size: 20px; text-transform: uppercase; }
            .brand p { margin: 2px 0; font-size: 11px; color: #64748b; }
            .title-box { text-align: right; }
            .title-box h3 { margin: 0; font-size: 16px; color: #0f172a; text-transform: uppercase; }
            .title-box p { margin: 2px 0; font-size: 11px; font-family: monospace; font-weight: bold; }
            .receipt-grid { width: 100%; border-collapse: collapse; margin: 15px 0; font-size: 12px; }
            .receipt-grid td { padding: 6px 8px; border-bottom: 1px solid #f1f5f9; }
            .receipt-grid td.label { width: 28%; color: #64748b; font-weight: 600; }
            .receipt-grid td.val { font-weight: 700; color: #0f172a; }
            .amount-box { background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 12px 16px; margin: 15px 0; display: flex; justify-content: space-between; align-items: center; }
            .amount-box span { font-size: 13px; font-weight: bold; color: #065f46; }
            .amount-box b { font-size: 20px; font-weight: 900; color: #059669; }
            .footer-sign { margin-top: 35px; display: flex; justify-content: space-between; font-size: 11px; }
            .footer-sign div { text-align: center; width: 180px; }
            .sign-line { margin-top: 50px; border-bottom: 1px solid #334155; font-weight: bold; padding-bottom: 2px; }
            .note { font-size: 10px; color: #94a3b8; margin-top: 25px; border-top: 1px dashed #cbd5e1; padding-top: 6px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="brand">
              <h2>${company.company_name}</h2>
              <p>${company.legal_name ? company.legal_name + ' | ' : ''}${company.ppiu_number}</p>
              <p>${company.address} | Telp: ${company.phone}</p>
            </div>
            <div class="title-box">
              <h3>Tanda Terima Pembayaran</h3>
              <p>${pay.receipt_number}</p>
            </div>
          </div>

          <table class="receipt-grid">
            <tr><td class="label">Telah Terima Dari</td><td class="val">: ${detail.full_name} (NIK: ${detail.nik})</td></tr>
            <tr><td class="label">Untuk Pembayaran</td><td class="val">: ${pay.payment_phase} (${detail.package_name} - ${detail.batch_name})</td></tr>
            <tr><td class="label">Kode Booking</td><td class="val">: ${detail.booking_code}</td></tr>
            <tr><td class="label">Metode Pembayaran</td><td class="val">: ${pay.payment_type} ${pay.bank_name ? '(' + pay.bank_name + ')' : ''}</td></tr>
            <tr><td class="label">Tanggal Transaksi</td><td class="val">: ${pay.created_at}</td></tr>
          </table>

          <div class="amount-box">
            <span>JUMLAH PEMBAYARAN:</span>
            <b>${fmtRp(pay.amount)}</b>
          </div>

          <table class="receipt-grid" style="font-size: 11px;">
            <tr><td class="label">Total Biaya Paket</td><td class="val">: ${fmtRp(detail.total_amount)}</td></tr>
            <tr><td class="label">Total Sudah Masuk</td><td class="val">: ${fmtRp(detail.paid_amount)}</td></tr>
            <tr><td class="label">Sisa Tagihan (Piutang)</td><td class="val" style="color: #e11d48;">: ${fmtRp(detail.remaining_amount)}</td></tr>
          </table>

          <div class="footer-sign">
            <div>
              <p>Penyetor / Jamaah</p>
              <div class="sign-line">${detail.full_name}</div>
            </div>
            <div>
              <p>${company.city || 'Kota'}, ${new Date().toLocaleDateString('id-ID')}</p>
              <p>Penerima / Petugas Kasir</p>
              <div class="sign-line">${company.director_name || 'Admin'}</div>
            </div>
          </div>

          <p class="note">Kwitansi ini adalah bukti pembayaran yang sah dan dicetak otomatis melalui sistem ${company.company_name}.</p>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };


  if (detail) return (
    <div className="space-y-4">
      <button onClick={()=>setDetail(null)} className="text-blue-600 hover:underline text-sm">&larr; Kembali ke Daftar Transaksi</button>
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-start mb-4">
          <div><h3 className="font-bold text-xl text-gray-800">{detail.booking_code}</h3><p className="text-sm text-gray-500">{detail.full_name} ({detail.nik})</p></div>
          <StatusBadge s={detail.status}/>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div><span className="text-gray-500">Paket:</span><p className="font-medium">{detail.package_name}</p></div>
          <div><span className="text-gray-500">Batch:</span><p className="font-medium">{detail.batch_name}</p></div>
          <div><span className="text-gray-500">Total:</span><p className="font-bold">{fmtRp(detail.total_amount)}</p></div>
          <div><span className="text-gray-500">Dibayar:</span><p className="font-bold text-green-600">{fmtRp(detail.paid_amount)}</p></div>
          <div><span className="text-gray-500">Sisa:</span><p className="font-bold text-red-600">{fmtRp(detail.remaining_amount)}</p></div>
          <div><span className="text-gray-500">HP:</span><p>{detail.phone}</p></div>
          <div><span className="text-gray-500">Paspor:</span><p>{detail.passport_number || '-'}</p></div>
          <div><span className="text-gray-500">Visa:</span><DocBadge s={detail.visa_status}/></div>
        </div>
      </div>
      {/* Payment Timeline */}
      <div className="bg-white rounded-xl shadow p-6">
        <div className="flex justify-between items-center mb-4">
          <h3 className="font-bold text-gray-800">Riwayat Pembayaran</h3>
          {detail.status !== 'PAID' && <button onClick={()=>{setPayForm({});setShowPayForm(true);}} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">+ Tambah Pembayaran</button>}
        </div>
        {showPayForm && (
          <div className="bg-gray-50 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Nominal</label><input type="number" inputMode="numeric" pattern="[0-9]*" value={payForm.amount||''} onChange={e=>setPayForm({...payForm,amount:e.target.value})} placeholder="0" className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Metode</label><select value={payForm.payment_type||'CASH'} onChange={e=>setPayForm({...payForm,payment_type:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"><option>CASH</option><option>TRANSFER</option></select></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Bank</label><input value={payForm.bank_name||''} onChange={e=>setPayForm({...payForm,bank_name:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
              <div><label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label><input value={payForm.notes||''} onChange={e=>setPayForm({...payForm,notes:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
            </div>
            <div className="mt-3 flex gap-2"><button onClick={addPayment} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">Simpan</button><button onClick={()=>setShowPayForm(false)} className="bg-gray-300 px-4 py-2 rounded-lg text-sm">Batal</button></div>
          </div>
        )}
        <div className="space-y-3">
          {(detail.payments||[]).map((pay:any,i:number)=>(
            <div key={i} className="flex items-center gap-4 border-l-4 border-emerald-500 pl-4 py-2">
              <div className="flex-1">
                <p className="font-medium text-sm">{pay.payment_phase} - {fmtRp(pay.amount)}</p>
                <p className="text-xs text-gray-500">{pay.receipt_number} | {pay.payment_type} {pay.bank_name?'('+pay.bank_name+')':''} | {pay.created_at}</p>
              </div>
              <button onClick={()=>printReceipt(pay)} className="text-blue-600 hover:underline text-xs">Cetak Kwitansi</button>
            </div>
          ))}
          {(!detail.payments||detail.payments.length===0) && <p className="text-gray-400 text-sm">Belum ada pembayaran</p>}
        </div>
      </div>
      {/* Handover log */}
      {detail.handovers && detail.handovers.length > 0 && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-gray-800 mb-3">Serah Terima Barang</h3>
          {detail.handovers.map((h:any,i:number)=>(<div key={i} className="flex justify-between border-b py-2 text-sm"><span>{h.item_name} ({h.item_code})</span><span>{h.qty} {h.unit}</span><span className="text-gray-500">{h.handed_over_at}</span></div>))}
        </div>
      )}
    </div>
  );


  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div className="flex gap-1">
          {['ALL','PENDING','DP','PAID','CANCELLED'].map(s=>(<button key={s} onClick={()=>setFilter(s)} className={'px-3 py-1 rounded-full text-xs font-bold transition '+(filter===s?'bg-slate-900 text-white':'bg-slate-100 text-slate-600 hover:bg-slate-200')}>{s==='ALL'?'Semua':s}</button>))}
        </div>
        <button onClick={()=>{setShowBooking(true);setBookForm({});setBookItems([]);setJamaahList([]);}} className="ml-auto bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ Booking Baru</button>
      </div>

      {showBooking && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Form Booking Pendaftaran Baru</h3>
              <button onClick={()=>setShowBooking(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Cari Jamaah (NIK / Nama) *</label>
                <div className="flex gap-2">
                  <input value={jamaahSearch} onChange={e=>setJamaahSearch(e.target.value)} className="flex-1 border rounded-xl px-3 py-2 text-xs" placeholder="Ketik NIK atau Nama..."/>
                  <button onClick={searchJamaah} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold">Cari</button>
                </div>
                {jamaahList.length>0 && (
                  <div className="mt-2 border rounded-xl max-h-40 overflow-y-auto bg-white shadow-md">
                    {jamaahList.map((j:any)=>(<button key={j.id} onClick={()=>{setBookForm({...bookForm,jamaah_id:j.id});setJamaahList([]);setJamaahSearch(j.full_name+' ('+j.nik+')');}} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs border-b border-slate-100">{j.full_name} - {j.nik} - {j.phone}</button>))}
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Batch Keberangkatan *</label>
                  <select value={bookForm.batch_id||''} onChange={e=>setBookForm({...bookForm,batch_id:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                    <option value="">-- Pilih Batch --</option>
                    {batches.map((b:any)=>(<option key={b.id} value={b.id}>{b.batch_name} - {b.package_name} ({fmtRp(b.price)}) — Kuota: {b.filled_quota||0}/{b.quota||45}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Pembayaran Awal (DP)</label>
                  <input type="number" inputMode="numeric" pattern="[0-9]*" value={bookForm.initial_payment||''} onChange={e=>setBookForm({...bookForm,initial_payment:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs font-mono" placeholder="0"/>
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Metode Bayar</label>
                  <select value={bookForm.payment_type||'CASH'} onChange={e=>setBookForm({...bookForm,payment_type:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                    <option>CASH</option><option>TRANSFER</option>
                  </select>
                </div>
              </div>

              {/* Live Price & Remaining Balance Calculator */}
              {(() => {
                const selectedBatch = batches.find((b: any) => String(b.id) === String(bookForm.batch_id));
                const totalPrice = selectedBatch ? selectedBatch.price : 0;
                const payAmount = Number(bookForm.initial_payment) || 0;
                const remaining = Math.max(0, totalPrice - payAmount);
                if (!selectedBatch) return null;
                return (
                  <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Harga Paket</p>
                      <p className="text-sm font-bold text-slate-900">{fmtRp(totalPrice)}</p>
                    </div>
                    <div className="text-center">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Dibayar Sekarang</p>
                      <p className="text-sm font-bold text-emerald-600">{fmtRp(payAmount)}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-[10px] font-bold text-slate-500 uppercase">Sisa Tagihan</p>
                      <p className={"text-sm font-black " + (remaining === 0 ? "text-emerald-700" : "text-rose-600")}>
                        {fmtRp(remaining)} {remaining === 0 ? " LUNAS" : ""}
                      </p>
                    </div>
                  </div>
                );
              })()}

              <div className="border-t border-slate-100 pt-3">
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">Perlengkapan Logistik (Opsional)</label>
                  <button onClick={()=>setBookItems([...bookItems,{item_id:'',qty:1}])} className="text-xs text-indigo-600 font-bold hover:underline">+ Tambah Item</button>
                </div>
                <div className="space-y-2">
                  {bookItems.map((it,idx)=>(
                    <div key={idx} className="flex gap-2 items-center">
                      <select value={it.item_id} onChange={e=>{const next=[...bookItems];next[idx]={...next[idx],item_id:e.target.value};setBookItems(next);}} className="flex-1 border rounded-xl px-3 py-1.5 text-xs">
                        <option value="">-- Pilih Barang Inventaris --</option>
                        {invItems.map((i:any)=>(<option key={i.id} value={i.id}>{i.name} (Stok: {i.stock_total})</option>))}
                      </select>
                      <input type="number" inputMode="numeric" pattern="[0-9]*" min={1} value={it.qty} onChange={e=>{const next=[...bookItems];next[idx]={...next[idx],qty:Number(e.target.value)};setBookItems(next);}} className="w-20 border rounded-xl px-3 py-1.5 text-xs text-center font-mono" placeholder="Qty"/>
                      <button onClick={()=>setBookItems(bookItems.filter((_,i)=>i!==idx))} className="text-rose-600 text-xs font-bold px-2">Hapus</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={()=>setShowBooking(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={createBooking} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Proses Booking</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">Kode</th>
              <th className="p-3">Jamaah</th>
              <th className="p-3">Paket</th>
              <th className="p-3 text-right">Total</th>
              <th className="p-3 text-right">Dibayar</th>
              <th className="p-3 text-right">Sisa</th>
              <th className="p-3">Status</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {txList.map((t:any)=>(
              <tr key={t.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono text-slate-500 font-bold">{t.booking_code}</td>
                <td className="p-3 font-bold text-slate-900">{t.full_name}</td>
                <td className="p-3 text-slate-600">{t.package_name}</td>
                <td className="p-3 text-right font-mono font-bold text-slate-900">{fmtRp(t.total_amount)}</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-600">{fmtRp(t.paid_amount)}</td>
                <td className="p-3 text-right font-mono font-bold text-rose-600">{fmtRp(t.remaining_amount)}</td>
                <td className="p-3"><StatusBadge s={t.status}/></td>
                <td className="p-3 text-right">
                  <button onClick={()=>loadDetail(t.id)} className="text-indigo-600 hover:underline font-bold">Detail</button>
                </td>
              </tr>
            ))}
            {txList.length===0 && <tr><td colSpan={8} className="text-center py-8 text-slate-400">Belum ada transaksi pendaftaran.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ===================== INVENTORY TAB ===================== */
function InventoryTab() {
  const [items, setItems] = useState<any[]>([]);
  const [handovers, setHandovers] = useState<any[]>([]);
  const [txList, setTxList] = useState<any[]>([]);
  const [form, setForm] = useState<any>({});
  const [showForm, setShowForm] = useState(false);

  const load = () => {
    fetch('/api/admin/inventory').then(r=>r.json()).then(d=>{ if(d.success){setItems(d.items||[]);setHandovers(d.handovers||[]);} });
    fetch('/api/admin/transactions').then(r=>r.json()).then(d=>{ if(d.success) setTxList(d.transactions||[]); });
  };
  useEffect(()=>{load();},[]);

  const doHandover = async () => {
    if(!form.transaction_id||!form.item_id) return alert('Transaksi dan Barang wajib dipilih');
    const res = await fetch('/api/admin/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'HANDOVER',...form})});
    const d = await res.json(); (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error') : alert(d.message); if(d.success){setShowForm(false);setForm({});load();}
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end"><button onClick={()=>{setForm({qty:1});setShowForm(true);}} className="bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm">+ Serah Terima Barang</button></div>
      {showForm && (
        <div className="bg-white rounded-xl shadow p-6">
          <h3 className="font-bold text-gray-800 mb-4">Form Serah Terima</h3>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Transaksi / Jamaah</label>
            <select value={form.transaction_id||''} onChange={e=>setForm({...form,transaction_id:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih --</option>
              {txList.map((t:any)=>(<option key={t.id} value={t.id}>{t.booking_code} - {t.full_name}</option>))}
            </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Barang</label>
            <select value={form.item_id||''} onChange={e=>setForm({...form,item_id:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm">
              <option value="">-- Pilih --</option>
              {items.map((it:any)=>(<option key={it.id} value={it.id}>{it.name} (Stok: {it.stock_total})</option>))}
            </select></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Qty</label><input type="number" inputMode="numeric" pattern="[0-9]*" value={form.qty||1} onChange={e=>setForm({...form,qty:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:outline-none"/></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1">Catatan</label><input value={form.notes||''} onChange={e=>setForm({...form,notes:e.target.value})} className="w-full border rounded-lg px-3 py-2 text-sm"/></div>
          </div>
          <div className="mt-4 flex gap-2"><button onClick={doHandover} className="bg-emerald-600 text-white px-6 py-2 rounded-lg text-sm">Serahkan</button><button onClick={()=>setShowForm(false)} className="bg-gray-300 text-gray-700 px-6 py-2 rounded-lg text-sm">Batal</button></div>
        </div>
      )}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <h3 className="font-bold text-gray-800 p-4 pb-0">Log Serah Terima</h3>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left">
            <th className="p-3">Booking</th><th className="p-3">Jamaah</th><th className="p-3">Barang</th><th className="p-3">Qty</th><th className="p-3">Tanggal</th>
          </tr></thead>
          <tbody>
            {handovers.map((h:any,i:number)=>(<tr key={i} className="border-b hover:bg-gray-50">
              <td className="p-3 font-mono text-xs">{h.booking_code}</td><td className="p-3">{h.jamaah_name}</td>
              <td className="p-3">{h.item_name} ({h.item_code})</td><td className="p-3">{h.qty} {h.unit}</td>
              <td className="p-3 text-xs">{h.handed_over_at}</td>
            </tr>))}
            {handovers.length===0 && <tr><td colSpan={5} className="p-6 text-center text-gray-400">Belum ada serah terima</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}


/* ===================== MANIFEST TAB ===================== */
function ManifestTab() {
  const [manifest, setManifest] = useState<any[]>([]);
  const [batches, setBatches] = useState<any[]>([]);
  const [batchId, setBatchId] = useState('');
  const [docFilter, setDocFilter] = useState<'ALL' | 'NO_VISA' | 'NO_PASSPORT'>('ALL');

  const load = useCallback(() => {
    const q = batchId ? `?batch_id=${batchId}` : '';
    fetch('/api/admin/manifest' + q).then(r=>r.json()).then(d=>{ if(d.success){setManifest(d.manifest||[]);setBatches(d.batches||[]);} });
  }, [batchId]);
  useEffect(()=>{load();},[load]);

  const filteredManifest = manifest.filter(m => {
    if (docFilter === 'NO_VISA') return m.visa_status !== 'ISSUED';
    if (docFilter === 'NO_PASSPORT') return m.passport_status !== 'SUDAH' || !m.passport_number;
    return true;
  });

  const missingPassportCount = manifest.filter(m => m.passport_status !== 'SUDAH' || !m.passport_number).length;
  const missingVisaCount = manifest.filter(m => m.visa_status !== 'ISSUED').length;

  const exportExcel = () => {
    import('xlsx').then(XLSX => {
      const data = filteredManifest.map((m:any,i:number)=>({'No':i+1,'Nama':m.full_name,'NIK':m.nik,'JK':m.gender,'TTL':m.birth_place+', '+m.birth_date,'No. Paspor':m.passport_number||'-','Exp Paspor':m.passport_expiry||'-','Paspor':m.passport_status,'Visa':m.visa_status,'HP':m.phone,'Paket':m.package_name,'Batch':m.batch_name,'Berangkat':m.departure_date,'Maskapai':m.airline,'Hotel Makkah':m.hotel_makkah,'Hotel Madinah':m.hotel_madinah}));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Manifest Keberangkatan");
      XLSX.writeFile(wb, `Manifest-Keberangkatan-${batchId || 'Semua'}.xlsx`);
    }).catch(() => alert('Library xlsx belum siap'));
  };

  const printManifest = () => {
    const w = window.open('', '', 'width=900,height=800');
    if (!w) return;
    w.document.write(`
      <html>
        <head>
          <title>Manifest Keberangkatan Jamaah</title>
          <style>
            body { font-family: sans-serif; padding: 20px; color: #1e293b; }
            h2, p { margin: 0 0 5px 0; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 15px; display: flex; justify-content: space-between; align-items: flex-end; }
            table { width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 10px; }
            th, td { border: 1px solid #cbd5e1; padding: 6px 8px; text-align: left; }
            th { background: #f1f5f9; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <div>
              <h2>MANIFEST KEBERANGKATAN JAMAAH</h2>
              <p>Total Jamaah: ${filteredManifest.length} Orang</p>
            </div>
            <div><p>Tanggal Cetak: ${new Date().toLocaleDateString('id-ID')}</p></div>
          </div>
          <table>
            <thead>
              <tr>
                <th>No</th><th>Nama Jamaah</th><th>NIK</th><th>L/P</th><th>No. Paspor</th><th>Status Paspor</th><th>Status Visa</th><th>No. HP</th>
              </tr>
            </thead>
            <tbody>
              ${filteredManifest.map((m:any, i:number)=>`
                <tr>
                  <td>${i+1}</td>
                  <td><b>${m.full_name}</b></td>
                  <td>${m.nik}</td>
                  <td>${m.gender}</td>
                  <td>${m.passport_number || '-'}</td>
                  <td>${m.passport_status || '-'}</td>
                  <td>${m.visa_status || '-'}</td>
                  <td>${m.phone}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </body>
      </html>
    `);
    w.document.close();
    w.print();
  };

  return (
    <div className="space-y-6">
      {/* Filters & Actions Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Pilih Batch Keberangkatan</label>
            <select value={batchId} onChange={e=>setBatchId(e.target.value)} className="border rounded-xl px-3 py-2 text-xs font-bold text-slate-900 bg-white">
              <option value="">-- Semua Batch Keberangkatan --</option>
              {batches.map((b:any)=>(<option key={b.id} value={b.id}>{b.batch_name} ({b.package_name})</option>))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-slate-400 mb-1">Filter Dokumen</label>
            <div className="flex gap-1">
              {[
                { id: 'ALL', label: `Semua (${manifest.length})` },
                { id: 'NO_PASSPORT', label: `Belum Paspor (${missingPassportCount})` },
                { id: 'NO_VISA', label: `Belum Visa (${missingVisaCount})` },
              ].map(f=>(
                <button
                  key={f.id}
                  onClick={()=>setDocFilter(f.id as any)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition ${docFilter===f.id ? 'bg-slate-900 text-white shadow-xs' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex gap-2">
          <button onClick={printManifest} className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold px-4 py-2 rounded-xl text-xs transition">
            🖨️ Cetak / PDF
          </button>
          <button onClick={exportExcel} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-xs">
            📊 Export Excel
          </button>
        </div>
      </div>

      {/* Manifest Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">No</th>
              <th className="p-3">Nama Jamaah</th>
              <th className="p-3">NIK</th>
              <th className="p-3">L/P</th>
              <th className="p-3">No. Paspor</th>
              <th className="p-3">Status Paspor</th>
              <th className="p-3">Status Visa</th>
              <th className="p-3">No. WhatsApp</th>
              <th className="p-3">Batch / Paket</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredManifest.map((m:any, i:number)=>(
              <tr key={m.id || i} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono text-slate-400">{i+1}</td>
                <td className="p-3 font-bold text-slate-900">{m.full_name}</td>
                <td className="p-3 font-mono text-slate-600">{m.nik}</td>
                <td className="p-3 text-slate-600">{m.gender}</td>
                <td className="p-3 font-mono text-slate-600">{m.passport_number || '-'}</td>
                <td className="p-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${m.passport_status==='SUDAH'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>
                    {m.passport_status || 'BELUM'}
                  </span>
                </td>
                <td className="p-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${m.visa_status==='ISSUED'?'bg-emerald-50 text-emerald-700':'bg-amber-50 text-amber-700'}`}>
                    {m.visa_status || 'PENDING'}
                  </span>
                </td>
                <td className="p-3 font-mono text-slate-600">{m.phone}</td>
                <td className="p-3 text-slate-600">{m.batch_name}</td>
              </tr>
            ))}
            {filteredManifest.length===0 && (
              <tr><td colSpan={9} className="text-center py-8 text-slate-400">Tidak ada data manifest yang sesuai dengan filter.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function LaporanTab({ isOwner }: { isOwner: boolean }) {
  const [reports, setReports] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [batches, setBatches] = useState<any[]>([]);
  const [period, setPeriod] = useState('ALL');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');
  const [batchId, setBatchId] = useState('');

  const load = useCallback(() => {
    let q = `?period=${period}`;
    if (period==='DAILY' && date) q += `&date=${date}`;
    if (period==='MONTHLY' && month) q += `&month=${month}`;
    if (period==='YEARLY' && year) q += `&year=${year}`;
    if (batchId) q += `&batch_id=${batchId}`;
    fetch('/api/admin/reports' + q).then(r=>r.json()).then(d=>{
      if(d.success){setReports(d.reports||[]);setSummary(d.summary);setBatches(d.batches||[]);}
    });
  }, [period, date, month, year, batchId]);
  useEffect(()=>{load();},[load]);

  const exportExcel = () => {
    import('xlsx').then(XLSX => {
      const data = reports.map((r:any,i:number)=>({'No':i+1,'Kode':r.booking_code,'Jamaah':r.full_name,'NIK':r.nik,'Paket':r.package_name,'Total':r.total_amount,'Dibayar':r.paid_amount,'Sisa':r.remaining_amount,'Status':r.payment_status,'Tanggal':r.transaction_date}));
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'Laporan');
      XLSX.writeFile(wb, 'laporan-keuangan.xlsx');
    });
  };

  const printReport = () => {
    const w = window.open('','','width=1100,height=700'); if(!w) return;
    const rows = reports.map((r:any,i:number)=>`<tr><td>${i+1}</td><td>${r.booking_code}</td><td>${r.full_name}</td><td>${r.package_name}</td><td style="text-align:right">${fmtRp(r.total_amount)}</td><td style="text-align:right">${fmtRp(r.paid_amount)}</td><td style="text-align:right">${fmtRp(r.remaining_amount)}</td><td>${r.payment_status}</td></tr>`).join('');
    w.document.write(`<html><head><title>Laporan</title><style>body{font-family:Arial;font-size:11px;padding:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #333;padding:4px 6px}th{background:#059669;color:#fff}</style></head><body>
      <h2 style="text-align:center">LAPORAN KEUANGAN AL-BARAKAH TOUR</h2>
      <p>Periode: ${period} | Transaksi: ${summary?.total_transactions||0} | Omset: ${fmtRp(summary?.total_revenue||0)} | Piutang: ${fmtRp(summary?.total_receivables||0)}</p>
      <table><thead><tr><th>No</th><th>Kode</th><th>Jamaah</th><th>Paket</th><th>Total</th><th>Dibayar</th><th>Sisa</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close(); w.print();
  };


  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow p-4">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Periode</label>
          <select value={period} onChange={e=>setPeriod(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="ALL">Semua</option><option value="DAILY">Harian</option><option value="MONTHLY">Bulanan</option><option value="YEARLY">Tahunan</option>
          </select></div>
          {period==='DAILY' && <div><label className="block text-xs font-medium text-gray-600 mb-1">Tanggal</label><input type="date" value={date} onChange={e=>setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/></div>}
          {period==='MONTHLY' && <div><label className="block text-xs font-medium text-gray-600 mb-1">Bulan</label><input type="month" value={month} onChange={e=>setMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/></div>}
          {period==='YEARLY' && <div><label className="block text-xs font-medium text-gray-600 mb-1">Tahun</label><input type="number" inputMode="numeric" pattern="[0-9]*" value={year} onChange={e=>setYear(e.target.value)} placeholder="2026" className="border rounded-lg px-3 py-2 text-sm w-24 focus:ring-2 focus:ring-emerald-500 focus:outline-none"/></div>}
          <div><label className="block text-xs font-medium text-gray-600 mb-1">Batch</label>
          <select value={batchId} onChange={e=>setBatchId(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"><option value="">Semua</option>{batches.map((b:any)=>(<option key={b.id} value={b.id}>{b.batch_name}</option>))}</select></div>
          <button onClick={printReport} className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm"> Cetak</button>
          <button onClick={exportExcel} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm"> Excel</button>
        </div>
      </div>
      {summary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-4">
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">Total Transaksi</p>
            <p className="text-2xl font-extrabold text-slate-900 mt-1">{summary.total_transactions} Trx</p>
          </div>
          {isOwner && (
            <div className="bg-emerald-50/70 rounded-2xl shadow-xs border border-emerald-200 p-4">
              <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Total Omset</p>
              <p className="text-2xl font-extrabold text-emerald-800 mt-1">{fmtRp(summary.total_revenue)}</p>
            </div>
          )}
          {isOwner && (
            <div className="bg-rose-50/70 rounded-2xl shadow-xs border border-rose-200 p-4">
              <p className="text-xs font-bold text-rose-700 uppercase tracking-wider">Total Piutang</p>
              <p className="text-2xl font-extrabold text-rose-800 mt-1">{fmtRp(summary.total_receivables)}</p>
            </div>
          )}
          <div className="bg-emerald-50/70 rounded-2xl shadow-xs border border-emerald-200 p-4">
            <p className="text-xs font-bold text-emerald-700 uppercase tracking-wider">Lunas (PAID)</p>
            <p className="text-2xl font-extrabold text-emerald-800 mt-1">{summary.paid_count}</p>
          </div>
          <div className="bg-amber-50/70 rounded-2xl shadow-xs border border-amber-200 p-4">
            <p className="text-xs font-bold text-amber-700 uppercase tracking-wider">DP / Pending</p>
            <p className="text-2xl font-extrabold text-amber-800 mt-1">{summary.dp_count + summary.pending_count}</p>
          </div>
        </div>
      )}

      {/* Visualisasi Grafik Tren Omset & Transaksi (Data Visualization Skill) */}
      {reports.length > 0 && isOwner && (() => {
        // Group reports by transaction month or date
        const monthlyGroups: Record<string, { revenue: number; count: number }> = {};
        reports.forEach((r: any) => {
          const key = (r.transaction_date || '').substring(0, 7) || 'Umum';
          if (!monthlyGroups[key]) monthlyGroups[key] = { revenue: 0, count: 0 };
          monthlyGroups[key].revenue += Number(r.paid_amount) || 0;
          monthlyGroups[key].count += 1;
        });

        const sortedKeys = Object.keys(monthlyGroups).sort();
        const maxRev = Math.max(...sortedKeys.map(k => monthlyGroups[k].revenue), 1);

        return (
          <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                  <span></span> Grafik Tren Pendapatan Terkumpul
                </h4>
                <p className="text-xs text-slate-500">Visualisasi uang masuk berdasarkan periode laporan yang dipilih.</p>
              </div>
            </div>

            <div className="space-y-3 pt-2">
              {sortedKeys.map(key => {
                const item = monthlyGroups[key];
                const pct = Math.round((item.revenue / maxRev) * 100);
                return (
                  <div key={key} className="space-y-1">
                    <div className="flex justify-between text-xs font-semibold">
                      <span className="text-slate-700 font-mono">{key} ({item.count} Transaksi)</span>
                      <span className="text-emerald-700 font-bold">{fmtRp(item.revenue)}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3.5 overflow-hidden p-0.5 border border-slate-200">
                      <div
                        className="bg-gradient-to-r from-emerald-500 to-teal-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${Math.max(pct, 4)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left">
            <th className="p-3">Kode</th><th className="p-3">Jamaah</th><th className="p-3">Paket</th>
            {isOwner && <th className="p-3">Total</th>}
            {isOwner && <th className="p-3">Dibayar</th>}
            {isOwner && <th className="p-3">Sisa</th>}
            <th className="p-3">Status</th><th className="p-3">Tanggal</th>
          </tr></thead>
          <tbody>
            {reports.map((r:any)=>(<tr key={r.transaction_id} className="border-b hover:bg-gray-50">
              <td className="p-3 font-mono text-xs">{r.booking_code}</td><td className="p-3">{r.full_name}</td>
              <td className="p-3 text-xs">{r.package_name}</td>
              {isOwner && <td className="p-3">{fmtRp(r.total_amount)}</td>}
              {isOwner && <td className="p-3 text-green-600">{fmtRp(r.paid_amount)}</td>}
              {isOwner && <td className="p-3 text-red-600">{fmtRp(r.remaining_amount)}</td>}
              <td className="p-3"><StatusBadge s={r.payment_status}/></td><td className="p-3 text-xs">{r.transaction_date}</td>
            </tr>))}
            {reports.length===0 && <tr><td colSpan={8} className="p-6 text-center text-gray-400">Tidak ada data</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}


/* ===================== KELOLA STAF TAB (OWNER only) ===================== */
function KelolaStaf() {
  const [list, setList] = useState<any[]>([]);
  const [mode, setMode] = useState<'idle'|'add'|'edit'>('idle');
  const [form, setForm] = useState<any>({});

  const load = () => { fetch('/api/admin/users').then(r=>r.json()).then(d=>{ if(d.success) setList(d.users||[]); }); };
  useEffect(()=>{load();},[]);

  const save = async () => {
    if(!form.name||!form.username||(mode==='add'&&!form.password)) return alert('Nama, username, dan password wajib diisi');
    const action = mode === 'edit' ? 'UPDATE_USER' : 'CREATE_USER';
    const res = await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({...form, action})});
    const d = await res.json(); 
    if(d.success){
      alert('Berhasil menyimpan staf');
      setMode('idle');
      setForm({});
      load();
    } else {
      alert(d.message || 'Gagal menyimpan');
    }
  };

  const remove = async (id: number) => {
    if(!confirm('Hapus staf ini?')) return;
    const res = await fetch('/api/admin/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'DELETE_USER', id})});
    const d = await res.json(); 
    if(d.success) load(); 
    else alert(d.message);
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900">Kelola Staf & Admin</h3>
          <p className="text-xs text-slate-500">Manajemen akun staf internal tour & travel.</p>
        </div>
        <button onClick={()=>{setForm({});setMode('add');}} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ Tambah Staf</button>
      </div>

      {mode !== 'idle' && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">{mode==='edit'?'Edit Data Staf':'Tambah Staf Baru'}</h3>
              <button onClick={()=>setMode('idle')} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nama Lengkap *</label>
                <input type="text" value={form.name||''} onChange={e=>setForm({...form, name:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" placeholder="Nama lengkap..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Username *</label>
                <input type="text" value={form.username||''} onChange={e=>setForm({...form, username:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" placeholder="Username login..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Password {mode==='edit' && '(Kosongkan jika tidak diubah)'}</label>
                <input type="password" value={form.password||''} onChange={e=>setForm({...form, password:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" placeholder="Password..." />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Role / Hak Akses *</label>
                <select value={form.role||'STAFF'} onChange={e=>setForm({...form, role:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="STAFF">STAFF</option>
                  <option value="OWNER">OWNER</option>
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={()=>setMode('idle')} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={save} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Simpan Staf</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">Nama</th>
              <th className="p-3">Username</th>
              <th className="p-3">Role</th>
              <th className="p-3 text-right">Aksi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {list.map(u=>(
              <tr key={u.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-bold text-slate-900">{u.name}</td>
                <td className="p-3 font-mono text-slate-600">{u.username}</td>
                <td className="p-3">
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold ${u.role==='OWNER'?'bg-indigo-50 text-indigo-700':'bg-slate-100 text-slate-700'}`}>{u.role}</span>
                </td>
                <td className="p-3 text-right space-x-2">
                  <button onClick={()=>{setForm(u);setMode('edit');}} className="text-indigo-600 hover:underline font-bold">Edit</button>
                  <button onClick={()=>remove(u.id)} className="text-rose-600 hover:underline font-bold">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function PembayaranTab() {
  const [kode, setKode] = useState('');
  const [data, setData] = useState<any>(null);
  const [msg, setMsg] = useState('');
  const [loading, setLoading] = useState(false);
  const [recentPending, setRecentPending] = useState<any[]>([]);

  const loadPending = async () => {
    try {
      const r = await fetch('/api/admin/transactions');
      const d = await r.json();
      if (d.success) {
        const pendingList = (d.transactions || []).filter((t: any) => t.status === 'DP' || t.status === 'PENDING').slice(0, 10);
        setRecentPending(pendingList);
      }
    } catch {}
  };

  useEffect(() => { loadPending(); }, []);

  const load = async (booking: string) => {
    if (!booking) return;
    setLoading(true); setMsg('');
    try {
      const r = await fetch('/api/payments?booking_code=' + encodeURIComponent(booking));
      const d = await r.json();
      if (d.success) setData(d);
      else { setData(null); setMsg(d.message || 'Booking tidak ditemukan'); }
    } catch (e: any) { setMsg(e.message); }
    setLoading(false);
  };

  const verify = async (paymentId: number, action: 'APPROVE' | 'REJECT') => {
    const catatan = action === 'REJECT' ? (prompt('Alasan penolakan (opsional):') || '') : '';
    const r = await fetch('/api/payments/verify', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_id: paymentId, action, notes: catatan }),
    });
    const d = await r.json();
    (window as any).__showAdminToast ? (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error') : alert(d.message || (d.success ? 'Berhasil' : 'Gagal'));
    if (d.success) {
      if (kode) load(kode);
      loadPending();
    }
  };

  return (
    <div className="space-y-6">
      {/* Search Header */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs space-y-3">
        <div>
          <h3 className="text-base font-black text-slate-900">Verifikasi Pembayaran & Transfer</h3>
          <p className="text-xs text-slate-500">Periksa bukti transfer jamaah dan setujui atau tolak pembayaran.</p>
        </div>
        <div className="flex gap-2">
          <input
            value={kode}
            onChange={e => setKode(e.target.value.toUpperCase())}
            placeholder="Masukkan Kode Booking (Cth: UMR-2610-4821)"
            className="flex-1 border rounded-xl px-4 py-2.5 text-xs font-mono focus:ring-2 focus:ring-slate-900 focus:outline-none"
            onKeyDown={e => e.key === 'Enter' && load(kode)}
          />
          <button
            onClick={() => load(kode)}
            disabled={loading}
            className="bg-slate-900 text-white font-bold px-6 py-2.5 rounded-xl text-xs disabled:opacity-50 transition shadow-xs hover:bg-slate-800"
          >
            {loading ? 'Mencari...' : 'Cari Booking'}
          </button>
        </div>
        {msg && <p className="text-xs mt-2 font-bold text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200">{msg}</p>}
      </div>

      {/* Booking Details Card */}
      {data && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-5 animate-in fade-in duration-200">
          <div className="flex flex-wrap justify-between items-start gap-4 border-b border-slate-100 pb-4">
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">Booking Code</span>
              <h2 className="text-lg font-black text-slate-900 mt-1">{data.booking.booking_code}</h2>
              <p className="text-xs font-bold text-slate-700 mt-0.5">{data.booking.full_name} <span className="font-normal text-slate-500">(NIK: {data.booking.nik})</span></p>
            </div>
            <div className="text-right">
              <span className="text-[10px] font-black uppercase tracking-wider bg-slate-100 text-slate-600 px-2.5 py-1 rounded-md">Status Pembayaran</span>
              <p className="text-sm font-black text-slate-900 mt-1"><StatusBadge s={data.booking.status}/></p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-slate-50 p-4 rounded-xl border border-slate-200/60">
            <div><span className="text-slate-500 font-medium">Paket Perjalanan:</span><p className="font-bold text-slate-900 mt-0.5">{data.booking.package_name} ({data.booking.batch_name})</p></div>
            <div><span className="text-slate-500 font-medium">Total Biaya:</span><p className="font-bold font-mono text-slate-900 mt-0.5">{fmtRp(data.booking.total_amount)}</p></div>
            <div><span className="text-slate-500 font-medium">Sisa Tagihan:</span><p className="font-bold font-mono text-rose-600 mt-0.5">{fmtRp(data.booking.remaining_amount)}</p></div>
          </div>

          <div className="space-y-3">
            <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Riwayat & Bukti Pembayaran</h4>
            <div className="space-y-3">
              {(data.payments || []).map((pay: any) => (
                <div key={pay.id} className="bg-white border border-slate-200/80 rounded-2xl p-4 flex flex-wrap justify-between items-center gap-4 shadow-xs hover:border-slate-300 transition">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{pay.receipt_number}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${pay.status === 'VERIFIED' ? 'bg-emerald-50 text-emerald-700' : pay.status === 'REJECTED' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>
                        {pay.status}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-700">{pay.payment_phase} — <span className="font-mono text-emerald-600">{fmtRp(pay.amount)}</span></p>
                    <p className="text-[11px] text-slate-500">Metode: {pay.payment_type} {pay.bank_name ? '(' + pay.bank_name + ')' : ''} | Tanggal: {pay.created_at}</p>
                    {pay.proof_url && (
                      <a href={pay.proof_url} target="_blank" rel="noreferrer" className="inline-block mt-1 text-xs font-bold text-indigo-600 hover:underline">
                        📄 Lihat Bukti Transfer / Kwitansi &rarr;
                      </a>
                    )}
                  </div>

                  {pay.status === 'PENDING' && (
                    <div className="flex gap-2">
                      <button onClick={() => verify(pay.id, 'APPROVE')} className="bg-slate-900 text-white font-bold px-4 py-2 rounded-xl text-xs hover:bg-slate-800 transition">
                        Setujui
                      </button>
                      <button onClick={() => verify(pay.id, 'REJECT')} className="bg-rose-50 text-rose-700 font-bold px-4 py-2 rounded-xl text-xs hover:bg-rose-100 transition">
                        Tolak
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {(!data.payments || data.payments.length === 0) && (
                <p className="text-xs text-slate-400 py-4 text-center">Belum ada riwayat pembayaran untuk booking ini.</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Recent Pending Verification Quick List */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider">Antrean Booking Pending / Belum Lunas</h4>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
                <th className="p-3">Kode Booking</th>
                <th className="p-3">Jamaah</th>
                <th className="p-3">Paket</th>
                <th className="p-3 text-right">Sisa Tagihan</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">Aksi Cepat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentPending.map((t: any) => (
                <tr key={t.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono text-slate-500 font-bold">{t.booking_code}</td>
                  <td className="p-3 font-bold text-slate-900">{t.full_name}</td>
                  <td className="p-3 text-slate-600">{t.package_name}</td>
                  <td className="p-3 text-right font-mono font-bold text-rose-600">{fmtRp(t.remaining_amount)}</td>
                  <td className="p-3"><StatusBadge s={t.status}/></td>
                  <td className="p-3 text-right">
                    <button onClick={() => { setKode(t.booking_code); load(t.booking_code); }} className="text-indigo-600 hover:underline font-bold">Verifikasi</button>
                  </td>
                </tr>
              ))}
              {recentPending.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Tidak ada antrean pembayaran pending.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function RegistrationsTab() {
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(()=>{
    fetch('/api/admin/registrations').then(r=>r.json()).then(d=>{ if(d.success) setList(d.registrations||[]); }).finally(()=>setLoading(false));
  },[]);

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl shadow overflow-hidden">
        <div className="p-4 border-b"><h3 className="font-bold text-gray-800">Pendaftaran Online (semua booking)</h3>
        <p className="text-xs text-gray-500">Termasuk pendaftaran mandiri dari halaman publik /register.</p></div>
        <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="bg-gray-50 text-left">
            <th className="p-3">Kode Booking</th><th className="p-3">Jemaah Utama</th><th className="p-3">NIK</th>
            <th className="p-3">Paket / Batch</th><th className="p-3">Jemaah</th><th className="p-3">Total</th>
            <th className="p-3">Dibayar</th><th className="p-3">Status</th><th className="p-3">Terdaftar</th>
          </tr></thead>
          <tbody>
            {list.map((r:any)=>(
              <tr key={r.id} className="border-b hover:bg-gray-50">
                <td className="p-3 font-mono text-xs">{r.booking_code}</td>
                <td className="p-3">{r.full_name}</td>
                <td className="p-3 font-mono text-xs">{r.nik}</td>
                <td className="p-3 text-xs">{r.package_name}<br/><span className="text-gray-500">{r.batch_name}</span></td>
                <td className="p-3">{r.total_pilgrims} orang</td>
                <td className="p-3">{fmtRp(r.total_amount)}</td>
                <td className="p-3 text-green-600">{fmtRp(r.paid_amount)}</td>
                <td className="p-3"><StatusBadge s={r.payment_status}/></td>
                <td className="p-3 text-xs text-gray-500">{r.created_at}</td>
              </tr>
            ))}
            {!loading && list.length===0 && <tr><td colSpan={9} className="p-6 text-center text-gray-400">Belum ada pendaftaran online</td></tr>}
            {loading && <tr><td colSpan={9} className="p-6 text-center text-gray-400">Memuat...</td></tr>}
          </tbody>
        </table></div>
      </div>
    </div>
  );
}


/* ===================== PENGATURAN PROFIL TRAVEL ===================== */
function PengaturanTab() {
  const [profile, setProfile] = useState<any>({});
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddBankModal, setShowAddBankModal] = useState(false);
  const [newBank, setNewBank] = useState({ bank_name: '', account_number: '', account_holder: '' });

  const loadData = useCallback(() => {
    fetch('/api/admin/settings')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setProfile(d.profile || {});
          setBankAccounts(d.bankAccounts || []);
        }
      });
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const saveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'UPDATE_PROFILE', profile }),
      });
      const d = await res.json();
      if ((window as any).__showAdminToast) {
        (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error');
      }
      if (d.success) loadData();
    } catch {
      if ((window as any).__showAdminToast) (window as any).__showAdminToast('Gagal menyimpan profil', 'error');
    }
    setLoading(false);
  };

  const addBankAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBank.bank_name || !newBank.account_number || !newBank.account_holder) {
      if ((window as any).__showAdminToast) (window as any).__showAdminToast('Lengkapi data bank', 'error');
      return;
    }
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'ADD_BANK', bank: newBank }),
    });
    const d = await res.json();
    if ((window as any).__showAdminToast) (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error');
    if (d.success) {
      setNewBank({ bank_name: '', account_number: '', account_holder: '' });
      setShowAddBankModal(false);
      loadData();
    }
  };

  const deleteBank = async (id: number) => {
    if (!confirm('Hapus rekening ini?')) return;
    const res = await fetch('/api/admin/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_BANK', id }),
    });
    const d = await res.json();
    if ((window as any).__showAdminToast) (window as any).__showAdminToast(d.message, d.success ? 'success' : 'error');
    if (d.success) loadData();
  };

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Profile Form */}
      <form onSubmit={saveProfile} className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-900"></span> Identitas Resmi & Kop Cetak Dokumen
            </h3>
            <p className="text-xs text-slate-500">Informasi ini otomatis tampil pada header Kwitansi, Manifest, Label Koper, dan Laporan.</p>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition disabled:opacity-50"
          >
            {loading ? '...' : 'Simpan'}
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nama Brand Travel *</label>
            <input
              value={profile.company_name || ''}
              onChange={e => setProfile({ ...profile, company_name: e.target.value })}
              placeholder="Contoh: Al-Barakah Tour & Travel"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nama Legalitas PT / CV</label>
            <input
              value={profile.legal_name || ''}
              onChange={e => setProfile({ ...profile, legal_name: e.target.value })}
              placeholder="Contoh: PT. Al-Barakah Mandiri Utama"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">No. Izin PPIU / Kemenag *</label>
            <input
              value={profile.ppiu_number || ''}
              onChange={e => setProfile({ ...profile, ppiu_number: e.target.value })}
              placeholder="Contoh: Izin Kemenag No. 123/PPIU/2024"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nama Direktur / Pimpinan *</label>
            <input
              value={profile.director_name || ''}
              onChange={e => setProfile({ ...profile, director_name: e.target.value })}
              placeholder="Contoh: H. Ahmad Fauzi"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Nomor Telepon / WhatsApp</label>
            <input
              value={profile.phone || ''}
              onChange={e => setProfile({ ...profile, phone: e.target.value })}
              placeholder="Contoh: 081234567890"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Email Resmi</label>
            <input
              type="email"
              value={profile.email || ''}
              onChange={e => setProfile({ ...profile, email: e.target.value })}
              placeholder="info@travelumroh.com"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Alamat Kantor Pusat</label>
            <textarea
              rows={2}
              value={profile.address || ''}
              onChange={e => setProfile({ ...profile, address: e.target.value })}
              placeholder="Jalan Raya Umroh No. 45, Jakarta Selatan"
              className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-sm focus:ring-2 focus:ring-slate-900 focus:outline-none"
            />
          </div>
        </div>
      </form>

      {/* Bank Accounts Section */}
      <div className="bg-white rounded-2xl shadow-xs border border-slate-200 p-6 space-y-6">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div>
            <h3 className="text-lg font-extrabold text-slate-900 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-600"></span> Rekening Bank Pembayaran Jamaah
            </h3>
            <p className="text-xs text-slate-500">Daftar rekening tujuan transfer yang akan tampil pada halaman pembayaran & kwitansi.</p>
          </div>
          <button
            onClick={() => setShowAddBankModal(true)}
            className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-4 py-2 rounded-xl text-xs transition shadow-xs flex items-center gap-1.5"
          >
            <span>+ Tambah Rekening</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bankAccounts.map((b: any) => (
            <div key={b.id} className="bg-slate-50 border border-slate-200/80 rounded-2xl p-4 flex flex-col justify-between space-y-3 shadow-xs">
              <div>
                <div className="flex justify-between items-start">
                  <span className="text-xs font-black px-2.5 py-1 rounded-md bg-white border border-slate-200 text-slate-800">{b.bank_name}</span>
                  <button onClick={() => deleteBank(b.id)} className="text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg text-xs font-bold transition">
                    Hapus
                  </button>
                </div>
                <p className="font-mono text-base font-black text-slate-900 mt-3">{b.account_number}</p>
                <p className="text-xs font-bold text-slate-600 mt-0.5">a.n. {b.account_holder}</p>
              </div>
            </div>
          ))}
          {bankAccounts.length === 0 && (
            <div className="col-span-full text-center py-12 text-slate-400 text-xs">Belum ada rekening bank terdaftar.</div>
          )}
        </div>
      </div>

      {/* Add Bank Centered Modal Pop-up */}
      {showAddBankModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 max-w-md w-full p-6 space-y-6">
            <div className="flex justify-between items-center border-b border-slate-100 pb-4">
              <h3 className="text-base font-black text-slate-900">Tambah Rekening Bank Baru</h3>
              <button onClick={() => setShowAddBankModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-lg">&times;</button>
            </div>
            <form onSubmit={addBankAccount} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nama Bank (Cth: BCA / Mandiri / BSI)</label>
                <input
                  type="text"
                  value={newBank.bank_name}
                  onChange={e => setNewBank({ ...newBank, bank_name: e.target.value })}
                  placeholder="BCA / Mandiri / BSI"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nomor Rekening</label>
                <input
                  type="text"
                  value={newBank.account_number}
                  onChange={e => setNewBank({ ...newBank, account_number: e.target.value })}
                  placeholder="1234567890"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs font-mono text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Atas Nama (Pemilik Rekening)</label>
                <input
                  type="text"
                  value={newBank.account_holder}
                  onChange={e => setNewBank({ ...newBank, account_holder: e.target.value })}
                  placeholder="PT. Travel Umroh"
                  className="w-full border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:ring-2 focus:ring-slate-900 focus:outline-none"
                  required
                />
              </div>
              <div className="pt-3 flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddBankModal(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 font-bold hover:bg-slate-50 transition"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="bg-slate-900 hover:bg-slate-800 text-white font-bold px-5 py-2 rounded-xl transition shadow-xs"
                >
                  Simpan Rekening
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function ChecklistTab() {
  const [jamaahList, setJamaahList] = useState<any[]>([]);
  const [selectedJamaah, setSelectedJamaah] = useState<any>(null);
  const [checklistData, setChecklistData] = useState<{ master: any[], items: any[] }>({ master: [], items: [] });
  const [loading, setLoading] = useState(false);
  const [savingId, setSavingId] = useState<number | null>(null);
  const [searchFilter, setSearchFilter] = useState('');

  useEffect(() => {
    fetchJamaah();
  }, []);

  const fetchJamaah = async () => {
    try {
      const res = await fetch('/api/admin/jamaah');
      const data = await res.json();
      if (data.success) {
        const list = data.jamaah || data.data || [];
        setJamaahList(list);
        if (list.length > 0) {
          selectJamaah(list[0]);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const selectJamaah = async (jamaah: any) => {
    setSelectedJamaah(jamaah);
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/checklist?jamaah_id=${jamaah.id}`);
      const data = await res.json();
      if (data.success) {
        setChecklistData({ master: data.master || [], items: data.items || [] });
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const toggleStatus = async (item: any) => {
    if (!selectedJamaah) return;
    const currentStatus = item.status;
    // Toggle cycle: BELUM -> SUDAH (atau DIAMBIL jika inventory linked) -> BELUM
    let nextStatus = 'SUDAH';
    if (item.is_inventory_linked) {
      nextStatus = (currentStatus === 'BELUM') ? 'DIAMBIL' : 'BELUM';
    } else {
      nextStatus = (currentStatus === 'BELUM') ? 'SUDAH' : 'BELUM';
    }

    setSavingId(item.id);
    try {
      const res = await fetch('/api/admin/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'UPDATE_STATUS',
          jamaah_id: selectedJamaah.id,
          checklist_master_id: item.id,
          status: nextStatus
        })
      });
      const data = await res.json();
      if (data.success) {
        selectJamaah(selectedJamaah);
      } else {
        alert(data.message || 'Gagal memperbarui status');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setSavingId(null);
    }
  };

  const filteredJamaah = jamaahList.filter((j: any) => 
    j.full_name?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    j.passport_number?.toLowerCase().includes(searchFilter.toLowerCase()) ||
    j.phone?.toLowerCase().includes(searchFilter.toLowerCase())
  );

  const categories = Array.from(new Set(checklistData.master.map((m: any) => m.category)));

  // Calculate overall completeness percentage
  const totalItems = checklistData.items.length;
  const completedItems = checklistData.items.filter((i: any) => i.status === 'SUDAH' || i.status === 'DIAMBIL').length;
  const progressPercent = totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900">Checklist Kelengkapan & Logistik Jamaah</h2>
            <p className="text-sm text-slate-500 mt-1">
              Centang item kelengkapan di bawah ini untuk memverifikasi dokumen dan menyerahkan perlengkapan. Penyerahan logistik otomatis memotong stok gudang.
            </p>
          </div>
          {selectedJamaah && (
            <div className="flex items-center gap-3 bg-slate-50 px-4 py-3 rounded-xl border border-slate-200/60">
              <div className="text-right">
                <div className="text-xs font-semibold text-slate-500">Progress Kelengkapan</div>
                <div className="text-sm font-bold text-slate-900">{completedItems} dari {totalItems} item ({progressPercent}%)</div>
              </div>
              <div className="w-12 h-12 rounded-full bg-emerald-50 border-2 border-emerald-500 flex items-center justify-center text-emerald-700 font-bold text-xs">
                {progressPercent}%
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Jamaah Selector Sidebar */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-sm lg:col-span-1 flex flex-col h-[700px]">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-slate-800 mb-2">Pilih Jamaah ({filteredJamaah.length})</h3>
            <input
              type="text"
              placeholder="Cari nama / paspor / no. HP..."
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:border-slate-900"
            />
          </div>
          <div className="space-y-2 overflow-y-auto flex-1 pr-1">
            {filteredJamaah.map((j: any) => (
              <button
                key={j.id}
                onClick={() => selectJamaah(j)}
                className={`w-full text-left p-3 rounded-xl border transition text-sm flex flex-col gap-1 ${selectedJamaah?.id === j.id ? 'border-slate-900 bg-slate-900 text-white font-medium shadow-sm' : 'border-slate-100 hover:bg-slate-50 text-slate-700'}`}
              >
                <div className="font-semibold truncate">{j.full_name}</div>
                <div className={`text-xs flex items-center justify-between ${selectedJamaah?.id === j.id ? 'text-slate-300' : 'text-slate-400'}`}>
                  <span>{j.passport_number || 'Paspor belum'}</span>
                  <span>{j.phone || '-'}</span>
                </div>
              </button>
            ))}
            {filteredJamaah.length === 0 && (
              <div className="py-12 text-center text-xs text-slate-400">Tidak ada jamaah ditemukan</div>
            )}
          </div>
        </div>

        {/* Interactive Checklist Detail Panel */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-sm lg:col-span-3">
          {selectedJamaah ? (
            <div className="space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 border-b border-slate-100 gap-4">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">{selectedJamaah.full_name}</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    NIK: {selectedJamaah.nik || '-'} | No. Paspor: <span className="font-medium text-slate-700">{selectedJamaah.passport_number || 'Belum diisi'}</span> | Telp: {selectedJamaah.phone || '-'}
                  </p>
                </div>
                <span className="px-3 py-1 bg-emerald-50 text-emerald-700 text-xs font-semibold rounded-full border border-emerald-200 w-fit">
                  Aktif / Terdaftar
                </span>
              </div>

              {loading ? (
                <div className="py-24 text-center text-slate-400 text-sm">Memuat data checklist jamaah...</div>
              ) : (
                <div className="space-y-6 max-h-[580px] overflow-y-auto pr-2">
                  {categories.map((cat: any) => {
                    const itemsInCat = checklistData.items.filter((i: any) => i.category === cat);
                    return (
                      <div key={cat} className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 px-1">{cat}</h4>
                          <span className="text-[11px] text-slate-400">
                            {itemsInCat.filter((i: any) => i.status === 'SUDAH' || i.status === 'DIAMBIL').length} / {itemsInCat.length} Selesai
                          </span>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          {itemsInCat.map((item: any) => {
                            const isDone = item.status === 'SUDAH' || item.status === 'DIAMBIL';
                            const isSaving = savingId === item.id;
                            return (
                              <div
                                key={item.id}
                                onClick={() => !isSaving && toggleStatus(item)}
                                className={`p-4 rounded-xl border transition cursor-pointer flex items-start gap-3.5 select-none shadow-xs ${
                                  isDone 
                                    ? 'bg-emerald-50/40 border-emerald-300/80 hover:bg-emerald-50/70' 
                                    : 'bg-white border-slate-200/80 hover:border-slate-300 hover:bg-slate-50/50'
                                }`}
                              >
                                <div className="pt-0.5">
                                  <div className={`w-5 h-5 rounded-md border flex items-center justify-center transition ${
                                    isDone ? 'bg-emerald-600 border-emerald-600 text-white' : 'border-slate-300 bg-white'
                                  }`}>
                                    {isDone && (
                                      <svg className="w-3.5 h-3.5 stroke-[3]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                      </svg>
                                    )}
                                  </div>
                                </div>
                                <div className="flex-1">
                                  <div className="flex items-center justify-between">
                                    <span className={`text-sm font-semibold ${isDone ? 'text-emerald-900' : 'text-slate-800'}`}>
                                      {item.item_name}
                                    </span>
                                    <span className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider ${
                                      item.status === 'SUDAH' ? 'bg-emerald-100 text-emerald-800' :
                                      item.status === 'DIAMBIL' ? 'bg-blue-100 text-blue-800' : 'bg-slate-100 text-slate-500'
                                    }`}>
                                      {item.status}
                                    </span>
                                  </div>
                                  <div className="text-xs text-slate-500 mt-1 flex items-center justify-between">
                                    <span>{item.item_code}</span>
                                    {item.is_inventory_linked && (
                                      <span className="text-[11px] font-medium text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded">
                                        📦 Potong Stok Gudang
                                      </span>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="py-24 text-center text-slate-400 text-sm">Pilih jamaah terlebih dahulu di sebelah kiri untuk melihat dan mencentang kelengkapan</div>
          )}
        </div>
      </div>
    </div>
  );
}



/* ===================== JURNAL BUKU BESAR ===================== */
function LedgerTab() {
  const [ledger, setLedger] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'GET_LEDGER' })
    }).then(r => r.json()).then(d => {
      if (d.success) setLedger(d.ledger || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
      <h3 className="text-base font-black text-slate-900">Jurnal Buku Besar (General Ledger)</h3>
      {loading ? <p className="text-center text-slate-400 py-8">Memuat...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
                <th className="p-3">Tanggal</th>
                <th className="p-3">Kode Akun</th>
                <th className="p-3">Nama Akun</th>
                <th className="p-3">Keterangan</th>
                <th className="p-3 text-right">Debit (Rp)</th>
                <th className="p-3 text-right">Kredit (Rp)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ledger.map((l:any)=>(
                <tr key={l.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono text-slate-500">{l.entry_date}</td>
                  <td className="p-3 font-mono font-bold text-slate-700">{l.coa_code}</td>
                  <td className="p-3 font-bold text-slate-900">{l.coa_name}</td>
                  <td className="p-3 text-slate-600">{l.description}</td>
                  <td className="p-3 text-right font-mono font-bold text-emerald-600">
                    {l.entry_type === 'DEBIT' ? fmtRp(l.amount) : '-'}
                  </td>
                  <td className="p-3 text-right font-mono font-bold text-rose-600">
                    {l.entry_type === 'CREDIT' ? fmtRp(l.amount) : '-'}
                  </td>
                </tr>
              ))}
              {ledger.length === 0 && (
                <tr><td colSpan={6} className="text-center py-8 text-slate-400">Belum ada entri buku besar.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ===================== MUTASI STOK GUDANG ===================== */
function StockLedgerTab() {
  const [handovers, setHandovers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/inventory/ledger').then(r => r.json()).then(d => {
      if (d.success) setHandovers(d.handovers || d.data || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs space-y-4">
      <h3 className="text-base font-black text-slate-900">Mutasi Stok Gudang & Penyerahan Perlengkapan</h3>
      {loading ? <p className="text-center text-slate-400 py-8">Memuat...</p> : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
                <th className="p-3">Tanggal</th>
                <th className="p-3">Nama Jamaah</th>
                <th className="p-3">Nama Barang</th>
                <th className="p-3 text-center">Jumlah Keluar</th>
                <th className="p-3">Catatan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {handovers.map((h:any)=>(
                <tr key={h.id} className="hover:bg-slate-50 transition">
                  <td className="p-3 font-mono text-slate-500">{h.handover_date || h.created_at}</td>
                  <td className="p-3 font-bold text-slate-900">{h.full_name || h.jamaah_name}</td>
                  <td className="p-3 font-bold text-slate-700">{h.item_name || h.name}</td>
                  <td className="p-3 text-center font-mono font-bold text-rose-600">-{h.quantity || h.qty}</td>
                  <td className="p-3 text-slate-600">{h.notes || '-'}</td>
                </tr>
              ))}
              {handovers.length === 0 && (
                <tr><td colSpan={5} className="text-center py-8 text-slate-400">Belum ada mutasi stok gudang.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}



/* ===================== JURNAL UMUM TAB ===================== */
function GeneralJournalTab() {
  const [journals, setJournals] = useState<any[]>([]);
  const [coaList, setCoaList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ journal_date: new Date().toISOString().split('T')[0], debit_coa_id: '', credit_coa_id: '', amount: '', description: '' });

  const loadData = () => {
    fetch('/api/admin/financial?period=ALL').then(r => r.json()).then(d => {
      if (d.success) {
        setJournals(d.generalJournals || []);
        setCoaList(d.coaList || []);
      }
    });
  };

  useEffect(() => { loadData(); }, []);

  const saveJournal = () => {
    if (!form.debit_coa_id || !form.credit_coa_id || !form.amount) {
      alert('Semua field wajib diisi!');
      return;
    }
    fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CREATE_GENERAL_JOURNAL', ...form })
    }).then(r => r.json()).then(d => {
      if (d.success) {
        alert('Jurnal umum berhasil disimpan!');
        setShowModal(false);
        setForm({ journal_date: new Date().toISOString().split('T')[0], debit_coa_id: '', credit_coa_id: '', amount: '', description: '' });
        loadData();
      } else {
        alert(d.message || 'Gagal menyimpan jurnal');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900">Jurnal Umum (Memorial)</h3>
          <p className="text-xs text-slate-500">Pencatatan transaksi akuntansi berpasangan (Double-Entry).</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ Buat Jurnal Baru</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">Tanggal</th>
              <th className="p-3">Debit (Akun)</th>
              <th className="p-3">Kredit (Akun)</th>
              <th className="p-3 text-right">Jumlah (Rp)</th>
              <th className="p-3">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {journals.map((j:any)=>(
              <tr key={j.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono text-slate-500">{j.journal_date}</td>
                <td className="p-3 font-bold text-slate-900">{j.debit_code} - {j.debit_name}</td>
                <td className="p-3 font-bold text-slate-900">{j.credit_code} - {j.credit_name}</td>
                <td className="p-3 text-right font-mono font-bold text-emerald-600">{fmtRp(j.amount)}</td>
                <td className="p-3 text-slate-600">{j.description}</td>
              </tr>
            ))}
            {journals.length === 0 && (
              <tr><td colSpan={5} className="text-center py-8 text-slate-400">Belum ada jurnal umum.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Form Jurnal Umum (Memorial)</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tanggal *</label>
                <input type="date" value={form.journal_date} onChange={e=>setForm({...form, journal_date:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Akun Debit *</label>
                <select value={form.debit_coa_id} onChange={e=>setForm({...form, debit_coa_id:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="">-- Pilih Akun Debit --</option>
                  {coaList.map((c:any)=>(<option key={c.id} value={c.id}>[{c.coa_code}] {c.coa_name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Akun Kredit *</label>
                <select value={form.credit_coa_id} onChange={e=>setForm({...form, credit_coa_id:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="">-- Pilih Akun Kredit --</option>
                  {coaList.map((c:any)=>(<option key={c.id} value={c.id}>[{c.coa_code}] {c.coa_name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Jumlah (Rp) *</label>
                <input type="number" inputMode="numeric" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs font-mono" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Keterangan / Deskripsi</label>
                <input value={form.description} onChange={e=>setForm({...form, description:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" placeholder="Keterangan transaksi..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={saveJournal} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Simpan Jurnal</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}



/* ===================== BEBAN OPERASIONAL TAB ===================== */
function ExpensesTab() {
  const [expenses, setExpenses] = useState<any[]>([]);
  const [coaList, setCoaList] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({ expense_date: new Date().toISOString().split('T')[0], coa_account_id: '', amount: '', description: '' });

  const loadData = () => {
    fetch('/api/admin/financial?period=ALL').then(r => r.json()).then(d => {
      if (d.success) {
        setExpenses(d.expensesList || []);
        setCoaList(d.coaList || []);
      }
    });
  };

  useEffect(() => { loadData(); }, []);

  const saveExpense = () => {
    if (!form.coa_account_id || !form.amount) {
      alert('Akun Beban dan Jumlah wajib diisi!');
      return;
    }
    fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'CREATE_EXPENSE', ...form })
    }).then(r => r.json()).then(d => {
      if (d.success) {
        alert('Beban operasional berhasil dicatat!');
        setShowModal(false);
        setForm({ expense_date: new Date().toISOString().split('T')[0], coa_account_id: '', amount: '', description: '' });
        loadData();
      } else {
        alert(d.message || 'Gagal mencatat beban');
      }
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs">
        <div>
          <h3 className="text-base font-black text-slate-900">Beban Operasional (Expenses)</h3>
          <p className="text-xs text-slate-500">Pencatatan pengeluaran dan biaya operasional travel.</p>
        </div>
        <button onClick={() => setShowModal(true)} className="bg-slate-900 text-white px-4 py-2 rounded-xl text-xs font-bold hover:bg-slate-800 transition">+ Catat Beban Baru</button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600 border-b border-slate-200 text-left">
              <th className="p-3">Tanggal</th>
              <th className="p-3">Akun Beban</th>
              <th className="p-3 text-right">Jumlah (Rp)</th>
              <th className="p-3">Keterangan</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {expenses.map((e:any)=>(
              <tr key={e.id} className="hover:bg-slate-50 transition">
                <td className="p-3 font-mono text-slate-500">{e.expense_date}</td>
                <td className="p-3 font-bold text-slate-900">{e.coa_code} - {e.coa_name}</td>
                <td className="p-3 text-right font-mono font-bold text-rose-600">{fmtRp(e.amount)}</td>
                <td className="p-3 text-slate-600">{e.description}</td>
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr><td colSpan={4} className="text-center py-8 text-slate-400">Belum ada data beban operasional.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl space-y-4 animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center border-b border-slate-100 pb-3">
              <h3 className="text-base font-black text-slate-900">Catat Beban Operasional Baru</h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold text-sm">✕</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Tanggal *</label>
                <input type="date" value={form.expense_date} onChange={e=>setForm({...form, expense_date:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Pilih Akun Beban (COA) *</label>
                <select value={form.coa_account_id} onChange={e=>setForm({...form, coa_account_id:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="">-- Pilih Akun Beban --</option>
                  {coaList.map((c:any)=>(<option key={c.id} value={c.id}>[{c.coa_code}] {c.coa_name}</option>))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Jumlah (Rp) *</label>
                <input type="number" inputMode="numeric" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs font-mono" placeholder="0" />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">Keterangan / Keperluan</label>
                <input value={form.description} onChange={e=>setForm({...form, description:e.target.value})} className="w-full border rounded-xl px-3 py-2 text-xs" placeholder="Contoh: Pembayaran listrik kantor..." />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
              <button onClick={() => setShowModal(false)} className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl">Batal</button>
              <button onClick={saveExpense} className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Simpan Beban</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}


export default function AdminDashboard() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const showToast = (msg: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ msg, type });
    setTimeout(() => {
      setToast((curr) => (curr?.msg === msg ? null : curr));
    }, 4000);
  };

  useEffect(() => {
    // Expose toast helper for child components
    (window as any).__showAdminToast = showToast;
  }, []);
  const [activeTab, setActiveTab] = useState<Tab>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin_active_tab');
      if (saved) return saved as Tab;
    }
    return 'dashboard';
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('admin_active_tab', activeTab);
    }
  }, [activeTab]);
  const [sideOpen, setSideOpen] = useState(true);
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    'Master Data': true,
    'Transaksi & Keuangan': true,
    'Operasional & Jamaah': true,
  });
  const [user, setUser] = useState<any>(null);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    const raw = localStorage.getItem('admin_user');
    if (raw) setUser(JSON.parse(raw));
  }, []);

  useEffect(() => {
    if (!user) return;
    fetch('/api/admin/staff/me')
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem('admin_user');
          window.location.href = '/admin/login';
        }
      })
      .catch(() => {});
  }, [user]);

  const isOwner = user?.role === 'OWNER';

      const menuGroups: { groupName: string; items: { id: Tab; icon: React.ReactNode; label: string }[] }[] = [
    {
      groupName: 'Master Data',
      items: [
        { id: 'jamaah', icon: <Users className="w-4 h-4" />, label: 'Data Jamaah' },
        { id: 'paket', icon: <Package className="w-4 h-4" />, label: 'Paket Perjalanan' },
        { id: 'batches', icon: <Plane className="w-4 h-4" />, label: 'Jadwal & Batch' },
        { id: 'inventory', icon: <Boxes className="w-4 h-4" />, label: 'Inventaris & Stok' },
        { id: 'master-coa' as Tab, icon: <Calculator className="w-4 h-4" />, label: 'Master Akun COA' },
      ],
    },
    {
      groupName: 'Transaksi & Akuntansi',
      items: [
        { id: 'transaksi', icon: <ShoppingBag className="w-4 h-4" />, label: 'Transaksi & Booking' },
        { id: 'pembayaran', icon: <Receipt className="w-4 h-4" />, label: 'Verifikasi Pembayaran' },
        { id: 'general-journal' as Tab, icon: <BookOpen className="w-4 h-4" />, label: 'Jurnal Umum (Memorial)' },
        { id: 'expenses' as Tab, icon: <CreditCard className="w-4 h-4" />, label: 'Beban Operasional' },
      ],
    },
    {
      groupName: 'Operasional & Jamaah',
      items: [
        { id: 'manifest', icon: <Plane className="w-4 h-4" />, label: 'Manifest Keberangkatan' },
        { id: 'registrations', icon: <ClipboardList className="w-4 h-4" />, label: 'Registrasi Online' },
        { id: 'checklist' as Tab, icon: <CheckSquare className="w-4 h-4" />, label: 'Checklist Kelengkapan' },
      ],
    },
    {
      groupName: 'Laporan & Keuangan',
      items: [
        { id: 'laporan', icon: <TrendingUp className="w-4 h-4" />, label: 'Laporan Keuangan' },
        { id: 'laba-rugi', icon: <FileText className="w-4 h-4" />, label: 'Laporan Laba Rugi' },
        { id: 'neraca', icon: <Calculator className="w-4 h-4" />, label: 'Laporan Neraca' },
        { id: 'arus-kas', icon: <Wallet className="w-4 h-4" />, label: 'Laporan Arus Kas' },
        { id: 'ledger' as Tab, icon: <FileSpreadsheet className="w-4 h-4" />, label: 'Jurnal Buku Besar' },
        { id: 'stock-ledger' as Tab, icon: <Boxes className="w-4 h-4" />, label: 'Mutasi Stok Gudang' },
      ],
    },
    ...(isOwner
      ? [
          {
            groupName: 'Pengaturan & Akses',
            items: [
              { id: 'settings' as Tab, icon: <Building2 className="w-4 h-4" />, label: 'Profil Tour & Travel' },
              { id: 'staf' as Tab, icon: <ShieldCheck className="w-4 h-4" />, label: 'Kelola Staf' },
            ],
          },
        ]
      : []),
  ];
  const allItems = [
    { id: 'dashboard' as Tab, icon: <LayoutDashboard className="w-4 h-4" />, label: 'Dashboard Overview' },
    ...menuGroups.flatMap(g => g.items),
  ];

  const currentTabInfo = allItems.find(m => m.id === activeTab) || allItems[0];

  const toggleGroup = (groupName: string) => {
    setOpenGroups(prev => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  const handleSelectTab = (tab: Tab) => {
    setActiveTab(tab);
    setMobileMenuOpen(false);
  };

  return (
    <div className="flex h-screen bg-slate-100 overflow-hidden">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 md:hidden backdrop-blur-xs transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar Navigation (Linear Ultra-Clean Style) */}
      <aside
        className={`bg-white text-slate-700 border-r border-slate-200/80 transition-all duration-200 flex flex-col z-50 
        fixed md:static inset-y-0 left-0 
        ${mobileMenuOpen ? 'translate-x-0 w-64 shadow-xl' : '-translate-x-full md:translate-x-0'} 
        ${sideOpen ? 'md:w-60' : 'md:w-16'}`}
      >
        {/* Brand Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-xl bg-slate-900 text-white flex items-center justify-center text-sm font-bold shrink-0">
              
            </div>
            {(sideOpen || mobileMenuOpen) && (
              <div className="truncate">
                <h1 className="font-extrabold text-sm tracking-tight text-slate-900">Al-Barakah</h1>
                <p className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider">Management</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setSideOpen(!sideOpen)}
            className="hidden md:flex text-slate-400 hover:text-slate-700 p-1.5 rounded-lg hover:bg-slate-100 transition"
          >
            <Menu className="w-4 h-4" />
          </button>
          <button
            onClick={() => setMobileMenuOpen(false)}
            className="md:hidden text-slate-400 hover:text-slate-700 p-1.5 rounded-lg"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Menu Items List */}
        <nav className="flex-1 py-3 px-2.5 space-y-3 overflow-y-auto">
          {/* Main Dashboard Button */}
          <button
            onClick={() => handleSelectTab('dashboard')}
            title="Dashboard"
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-left transition text-xs font-semibold ${
              activeTab === 'dashboard'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            <LayoutDashboard className={`w-4 h-4 shrink-0 ${activeTab === 'dashboard' ? 'text-white' : 'text-slate-400'}`} />
            {(sideOpen || mobileMenuOpen) && <span className="truncate">Dashboard Overview</span>}
          </button>

          {/* Submenu Groups */}
          {menuGroups.map(group => {
            const isGroupOpen = openGroups[group.groupName] ?? true;
            const hasActiveChild = group.items.some(it => it.id === activeTab);

            return (
              <div key={group.groupName} className="space-y-0.5">
                {(sideOpen || mobileMenuOpen) && (
                  <button
                    onClick={() => toggleGroup(group.groupName)}
                    className="w-full flex items-center justify-between px-2.5 py-1 text-[10px] font-bold tracking-wider uppercase text-slate-400 hover:text-slate-600 transition"
                  >
                    <span className={hasActiveChild ? 'text-slate-900 font-black' : ''}>{group.groupName}</span>
                    <span className="text-[10px]">{isGroupOpen ? '▾' : '▸'}</span>
                  </button>
                )}

                {/* Sub-items */}
                {(!sideOpen && !mobileMenuOpen ? true : isGroupOpen) && (
                  <div className="space-y-0.5">
                    {group.items.map(item => {
                      const isActive = activeTab === item.id;
                      return (
                        <button
                          key={item.id}
                          onClick={() => handleSelectTab(item.id)}
                          title={item.label}
                          className={`w-full flex items-center gap-2.5 px-3 py-1.5 rounded-xl text-left transition text-xs font-medium ${
                            isActive
                              ? 'bg-slate-900 text-white font-bold shadow-xs'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <span className={`shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`}>{item.icon}</span>
                          {(sideOpen || mobileMenuOpen) && <span className="truncate">{item.label}</span>}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>

        {/* Logout Footer */}
        <div className="p-3 border-t border-slate-100">
          <button
            onClick={async () => {
              try {
                await fetch('/api/admin/logout', { method: 'POST' });
              } catch {}
              localStorage.removeItem('admin_user');
              window.location.href = '/admin/login';
            }}
            title="Keluar (Logout)"
            className="w-full text-left flex items-center gap-2 px-3 py-2 rounded-xl text-rose-600 hover:bg-rose-50 transition text-xs font-semibold"
          >
            <LogOut className="w-4 h-4 shrink-0" />
            {(sideOpen || mobileMenuOpen) && <span>Keluar Sistem</span>}
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden bg-slate-50">
        {/* Top Header */}
        <header className="bg-white border-b border-slate-200 px-4 sm:px-6 py-3.5 flex justify-between items-center sticky top-0 z-30 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="md:hidden p-2 rounded-xl text-slate-600 hover:bg-slate-100 transition focus:outline-none"
              aria-label="Open Navigation Menu"
            >
              <Menu className="w-5 h-5" />
            </button>
            <h2 className="text-lg sm:text-xl font-extrabold text-slate-800 flex items-center gap-2">
              <span>{currentTabInfo.icon}</span>
              <span className="truncate">{currentTabInfo.label}</span>
            </h2>
          </div>
          <div className="flex items-center gap-2.5 text-right">
            <span className="hidden sm:inline-block text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
              {user?.role || 'STAFF'}
            </span>
            <span className="text-xs font-bold text-slate-700 truncate max-w-[140px] sm:max-w-none">
              {user?.name || 'Admin'}
            </span>
          </div>
        </header>

        {/* Scrollable View Content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          {activeTab === 'dashboard' && <DashboardTab isOwner={isOwner} />}
          {activeTab === 'jamaah' && <MasterJamaah />}
        {activeTab === 'checklist' && <ChecklistTab />}
          {activeTab === 'paket' && <MasterPaket />}
          {activeTab === 'batches' && <MasterBatches />}
          {activeTab === 'inventory' && <MasterInventaris />}
          {activeTab === 'transaksi' && <TransaksiTab />}
          {activeTab === 'manifest' && <ManifestTab />}
          {activeTab === 'staf' && isOwner && <KelolaStaf />}
          {activeTab === 'settings' && isOwner && <PengaturanTab />}
          {activeTab === 'pembayaran' && <PembayaranTab />}
          {activeTab === 'registrations' && <RegistrationsTab />}
          {activeTab === 'laporan' && <LaporanTab isOwner={isOwner} />}
          {activeTab === 'master-coa' && <MasterCOATab />}
          {activeTab === 'laba-rugi' && <LabaRugiTab isOwner={isOwner} />}
          {activeTab === 'neraca' && <NeracaTab />}
          {activeTab === 'arus-kas' && <ArusKasTab />}
            {activeTab === 'ledger' && <LedgerTab />}
            {activeTab === 'stock-ledger' && <StockLedgerTab />}
          {activeTab === 'general-journal' && <GeneralJournalTab />}
          {activeTab === 'expenses' && <ExpensesTab />}
        </div>
      </main>
      <ToastContainer toast={toast} onClose={() => setToast(null)} />
    </div>
  );
}



/* ===================== MASTER COA TAB ===================== */
function MasterCOATab() {
  const [coaList, setCoaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('Beban Operasional');
  const [group, setGroup] = useState('Beban');
  const [msg, setMsg] = useState('');

  const loadCOA = () => {
    setLoading(true);
    fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'GET_COA' })
    }).then(r => r.json()).then(d => {
      if (d.success) setCoaList(d.coa || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  };

  useEffect(() => { loadCOA(); }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'SAVE_COA', id: editId, coa_code: code, coa_name: name, coa_type: type, coa_group: group })
    });
    const json = await res.json();
    if (json.success) {
      setMsg(json.message);
      setShowModal(false);
      setEditId(null);
      setCode(''); setName('');
      loadCOA();
    } else {
      setMsg('Gagal: ' + json.message);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus akun COA ini?')) return;
    await fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_COA', id })
    });
    loadCOA();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center bg-white rounded-xl shadow p-4">
        <div>
          <h2 className="text-base font-black text-slate-900">Master Chart of Accounts (COA)</h2>
          <p className="text-xs text-slate-500">Kelola daftar akun standar akuntansi untuk pencatatan keuangan travel.</p>
        </div>
        <button
          onClick={() => { setEditId(null); setCode(''); setName(''); setShowModal(true); }}
          className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-xl text-xs font-bold transition"
        >
          + Tambah Akun COA
        </button>
      </div>

      {msg && <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl text-xs font-semibold">{msg}</div>}

      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Kode Akun</th>
              <th className="text-left px-4 py-3 font-bold">Nama Akun</th>
              <th className="text-left px-4 py-3 font-bold">Tipe</th>
              <th className="text-left px-4 py-3 font-bold">Kelompok</th>
              <th className="text-right px-4 py-3 font-bold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {coaList.map((item: any) => (
              <tr key={item.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono font-bold text-slate-900">{item.coa_code}</td>
                <td className="px-4 py-3 font-semibold text-slate-800">{item.coa_name}</td>
                <td className="px-4 py-3 text-slate-600">{item.coa_type}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700">{item.coa_group}</span>
                </td>
                <td className="px-4 py-3 text-right space-x-2">
                  <button
                    onClick={() => { setEditId(item.id); setCode(item.coa_code); setName(item.coa_name); setType(item.coa_type); setGroup(item.coa_group); setShowModal(true); }}
                    className="text-blue-600 hover:underline font-semibold"
                  >
                    Edit
                  </button>
                  <button onClick={() => handleDelete(item.id)} className="text-rose-600 hover:underline font-semibold">Hapus</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-slate-900">{editId ? 'Edit Akun COA' : 'Tambah Akun COA Baru'}</h3>
            <form onSubmit={handleSave} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kode Akun (Contoh: 5-108)</label>
                <input type="text" value={code} onChange={e => setCode(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs font-mono" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Nama Akun</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Tipe Akun</label>
                <input type="text" value={type} onChange={e => setType(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs" required />
              </div>
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kelompok Utama</label>
                <select value={group} onChange={e => setGroup(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs">
                  <option value="Aset">Aset</option>
                  <option value="Liabilitas">Liabilitas</option>
                  <option value="Ekuitas">Ekuitas</option>
                  <option value="Pendapatan">Pendapatan</option>
                  <option value="Beban">Beban</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 border rounded-xl text-xs font-semibold">Batal</button>
                <button type="submit" className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-bold">Simpan</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}


/* ===================== LAPORAN LABA RUGI & BEBAN ===================== */
function LabaRugiTab({ isOwner }: { isOwner: boolean }) {
  const [data, setData] = useState<any>(null);
  const [expensesList, setExpensesList] = useState<any[]>([]);
  const [coaList, setCoaList] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('ALL');
  const [date, setDate] = useState('');
  const [month, setMonth] = useState('');
  const [year, setYear] = useState('');

  // Form input expense
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [coaId, setCoaId] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().slice(0,10));
  const [amount, setAmount] = useState('');
  const [desc, setDesc] = useState('');
  const [method, setMethod] = useState('TRANSFER');
  const [ref, setRef] = useState('');
  const [msg, setMsg] = useState('');

  const load = useCallback(() => {
    let q = `?period=${period}`;
    if (period === 'DAILY' && date) q += `&date=${date}`;
    if (period === 'MONTHLY' && month) q += `&month=${month}`;
    if (period === 'YEARLY' && year) q += `&year=${year}`;
    setLoading(true);
    fetch('/api/admin/financial' + q).then(r => r.json()).then(d => {
      if (d.success) setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));

    // Load expenses & COA
    fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'GET_EXPENSES' })
    }).then(r => r.json()).then(d => {
      if (d.success) setExpensesList(d.expenses || []);
    });

    fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'GET_COA' })
    }).then(r => r.json()).then(d => {
      if (d.success) {
        const bebanCoa = (d.coa || []).filter((item: any) => item.coa_group === 'Beban');
        setCoaList(bebanCoa);
        if (bebanCoa.length > 0 && !coaId) setCoaId(bebanCoa[0].id);
      }
    });
  }, [period, date, month, year]);

  useEffect(() => { load(); }, [load]);

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg('');
    const res = await fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ADD_EXPENSE',
        coa_account_id: coaId,
        expense_date: expDate,
        amount: Number(amount),
        description: desc,
        payment_method: method,
        reference: ref
      })
    });
    const json = await res.json();
    if (json.success) {
      setMsg(json.message);
      setAmount(''); setDesc(''); setRef('');
      setShowAddExpense(false);
      load();
    } else {
      setMsg('Gagal: ' + json.message);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!confirm('Hapus catatan beban ini?')) return;
    await fetch('/api/admin/financial', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_EXPENSE', id })
    });
    load();
  };

  if (!data) return <div className="text-center text-slate-400 py-12">Memuat laporan...</div>;

  const lr = data.laba_rugi;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow p-4 flex flex-wrap justify-between items-center gap-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div><label className="block text-xs font-medium text-slate-600 mb-1">Periode</label>
          <select value={period} onChange={e => setPeriod(e.target.value)} className="border rounded-lg px-3 py-2 text-sm">
            <option value="ALL">Semua</option><option value="DAILY">Harian</option><option value="MONTHLY">Bulanan</option><option value="YEARLY">Tahunan</option>
          </select></div>
          {period === 'DAILY' && <div><label className="block text-xs font-medium text-slate-600 mb-1">Tanggal</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/></div>}
          {period === 'MONTHLY' && <div><label className="block text-xs font-medium text-slate-600 mb-1">Bulan</label><input type="month" value={month} onChange={e => setMonth(e.target.value)} className="border rounded-lg px-3 py-2 text-sm"/></div>}
          {period === 'YEARLY' && <div><label className="block text-xs font-medium text-slate-600 mb-1">Tahun</label><input type="number" inputMode="numeric" pattern="[0-9]*" value={year} onChange={e => setYear(e.target.value)} placeholder="2026" className="border rounded-lg px-3 py-2 text-sm w-24"/></div>}
          <button onClick={load} className="bg-slate-900 text-white px-4 py-2 rounded-lg text-xs font-bold">Tampilkan</button>
        </div>
        <button
          onClick={() => setShowAddExpense(!showAddExpense)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-xs font-bold transition shadow-xs"
        >
          {showAddExpense ? 'Tutup Form Beban' : '+ Catat Beban Operasional'}
        </button>
      </div>

      {msg && <div className="bg-emerald-50 text-emerald-800 p-3 rounded-xl text-xs font-semibold">{msg}</div>}

      {/* Form Input Expense */}
      {showAddExpense && (
        <form onSubmit={handleAddExpense} className="bg-white rounded-2xl border border-slate-200/80 p-5 space-y-4 shadow-xs">
          <h3 className="text-sm font-black text-slate-900">Form Pencatatan Beban Operasional</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Akun Beban (COA) *</label>
              <select value={coaId} onChange={e => setCoaId(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs" required>
                {coaList.map((c: any) => (
                  <option key={c.id} value={c.id}>{c.coa_code} - {c.coa_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Tanggal Beban *</label>
              <input type="date" value={expDate} onChange={e => setExpDate(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Jumlah (Rp) *</label>
              <input type="number" inputMode="numeric" value={amount} onChange={e => setAmount(e.target.value)} placeholder="Contoh: 5000000" className="w-full border rounded-xl px-3 py-2 text-xs font-mono" required />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Keterangan / Deskripsi *</label>
              <input type="text" value={desc} onChange={e => setDesc(e.target.value)} placeholder="Contoh: Pembayaran hotel Makkah batch 1" className="w-full border rounded-xl px-3 py-2 text-xs" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Metode Bayar</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="w-full border rounded-xl px-3 py-2 text-xs">
                <option value="TRANSFER">Transfer Bank</option>
                <option value="CASH">Tunai (Cash)</option>
                <option value="GIRO">Giro / Cek</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end pt-2">
            <button type="submit" className="bg-slate-900 text-white px-6 py-2.5 rounded-xl text-xs font-bold">Simpan Beban</button>
          </div>
        </form>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> Pendapatan (Omset)</h3>
          <p className="text-2xl font-black text-slate-900">{fmtRp(lr.total_paid)}</p>
          <p className="text-xs text-slate-400">Total Tagihan: {fmtRp(lr.total_revenue)} | Piutang: {fmtRp(lr.total_outstanding)}</p>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> Beban Operasional</h3>
          <p className="text-2xl font-black text-rose-600">{fmtRp(lr.total_expenses)}</p>
        </div>
        <div className={`rounded-2xl border p-5 shadow-xs ${lr.gross_profit >= 0 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> Laba Bersih / Kotor</h3>
          <p className={`text-2xl font-black ${lr.gross_profit >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>{fmtRp(lr.gross_profit)}</p>
        </div>
      </div>

      {/* Beban by Group */}
      {lr.expenses_by_group && lr.expenses_by_group.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Rincian Beban per Kategori COA</h3>
          <div className="space-y-2">
            {lr.expenses_by_group.map((g: any, i: number) => (
              <div key={i} className="flex justify-between items-center text-sm border-b border-slate-100 pb-2">
                <span className="text-slate-600 font-medium">{g.coa_code} - {g.coa_name}</span>
                <span className="font-bold text-slate-900">{fmtRp(g.total_expense)}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Expenses History Table */}
      <div className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-slate-100">
          <h3 className="text-xs font-black text-slate-900 uppercase tracking-wider">Riwayat Pencatatan Beban</h3>
        </div>
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left px-4 py-3 font-bold">Tanggal</th>
              <th className="text-left px-4 py-3 font-bold">Akun COA</th>
              <th className="text-left px-4 py-3 font-bold">Keterangan</th>
              <th className="text-right px-4 py-3 font-bold">Jumlah</th>
              <th className="text-right px-4 py-3 font-bold">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {expensesList.map((exp: any) => (
              <tr key={exp.id} className="border-t border-slate-100 hover:bg-slate-50/50">
                <td className="px-4 py-3 font-mono">{exp.expense_date}</td>
                <td className="px-4 py-3 font-bold text-slate-900">{exp.coa_code} - {exp.coa_name}</td>
                <td className="px-4 py-3 text-slate-700">{exp.description}</td>
                <td className="px-4 py-3 text-right font-bold text-rose-600">{fmtRp(exp.amount)}</td>
                <td className="px-4 py-3 text-right">
                  <button onClick={() => handleDeleteExpense(exp.id)} className="text-rose-600 hover:underline font-semibold">Hapus</button>
                </td>
              </tr>
            ))}
            {expensesList.length === 0 && (
              <tr>
                <td colSpan={5} className="text-center py-8 text-slate-400">Belum ada catatan beban operasional.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}


/* ===================== NERACA ===================== */
function NeracaTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/financial?period=ALL').then(r => r.json()).then(d => {
      if (d.success) setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (!data) return <div className="text-center text-slate-400 py-12">Memuat...</div>;

  const n = data.neraca;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ASET */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> ASET</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Kas & Bank</span><span className="font-bold">{fmtRp(n.aset.kas_bank)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Piutang Jamaah</span><span className="font-bold">{fmtRp(n.aset.piutang_jamaah)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Persediaan</span><span className="font-bold">{fmtRp(n.aset.persediaan)}</span></div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900"><span>Total Aset</span><span>{fmtRp(n.aset.total_aset)}</span></div>
          </div>
        </div>
        {/* LIABILITAS */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> LIABILITAS</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Utang Vendor</span><span className="font-bold">{fmtRp(n.liabilitas.utang_vendor)}</span></div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900"><span>Total Liabilitas</span><span>{fmtRp(n.liabilitas.total_liabilitas)}</span></div>
          </div>
        </div>
        {/* EKUITAS */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> EKUITAS</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Modal Pemilik</span><span className="font-bold">{fmtRp(n.ekuitas.modal_pemilik)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Laba Ditahan</span><span className="font-bold">{fmtRp(n.ekuitas.laba_ditahan)}</span></div>
            <div className="border-t border-slate-200 pt-2 flex justify-between font-black text-slate-900"><span>Total Ekuitas</span><span>{fmtRp(n.ekuitas.total_ekuitas)}</span></div>
          </div>
        </div>
      </div>
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
        <p className="text-xs text-slate-400 text-center">Aset = Liabilitas + Ekuitas → {fmtRp(n.aset.total_aset)} = {fmtRp(n.liabilitas.total_liabilitas)} + {fmtRp(n.ekuitas.total_ekuitas)}</p>
      </div>
    </div>
  );
}

/* ===================== ARUS KAS ===================== */
function ArusKasTab() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch('/api/admin/financial?period=ALL').then(r => r.json()).then(d => {
      if (d.success) setData(d);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  if (!data) return <div className="text-center text-slate-400 py-12">Memuat...</div>;

  const ak = data.arus_kas;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> Saldo Kas</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Kas Awal</span><span>{fmtRp(ak.kas_awal)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Kas Akhir</span><span className="font-bold">{fmtRp(ak.kas_akhir)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Perubahan</span><span className={ak.perubahan_kas >= 0 ? 'text-emerald-700' : 'text-rose-700'}>{fmtRp(ak.perubahan_kas)}</span></div>
          </div>
        </div>
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3"> Arus Kas Per Aktivitas</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-slate-600">Operasi</span><span className="font-bold text-emerald-700">{fmtRp(ak.arus_operasi)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Investasi</span><span className="font-bold text-blue-700">{fmtRp(ak.arus_investasi)}</span></div>
            <div className="flex justify-between"><span className="text-slate-600">Pendanaan</span><span className="font-bold text-amber-700">{fmtRp(ak.arus_pendanaan)}</span></div>
          </div>
        </div>
      </div>
    </div>
  );
}


