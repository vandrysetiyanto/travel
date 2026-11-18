'use client';

/**
 * Modul dashboard: master
 *
 * Dipisahkan dari app/admin/dashboard/page.tsx (4254 baris, 30 komponen).
 * Berkas sebesar itu membuat setiap perubahan berisiko menjatuhkan seluruh panel.
 * Komponen di sini masih memakai state lokalnya sendiri; pemecahan lebih lanjut
 * (hook data terpisah) dilakukan bertahap agar perilaku tidak berubah.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EmptyState, StatusBadge, DocBadge, FInput } from '@/components/dashboard/ui-dasar';
import { fmt, fmtRp, hariIniWib } from '@/components/dashboard/format';

export function MasterJamaah() {
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

  const mergeKeep = (p: any, patch: Record<string, any>) => {
    const next = { ...p };
    // Map alias kunci OCR ke field form admin
    const keyMap: Record<string, string> = {
      noKK: 'no_kk',
      fullName: 'full_name',
      birthPlace: 'birth_place',
      birthDate: 'birth_date',
      passportNumber: 'passport_number',
      passportExpiry: 'passport_expiry_date',
      passportExpiryDate: 'passport_expiry_date'
    };

    for (const [k, v] of Object.entries(patch)) {
      if (!v) continue;
      const targetKey = keyMap[k] || k;
      // Khusus gender atau field yang ada nilai default 'L', selalu perbarui jika d.data menyediakannya
      if (targetKey === 'gender') {
        next[targetKey] = v;
      } else if (!next[targetKey]) {
        next[targetKey] = v;
      }
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

export function MasterPaket() {
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
              <div className="md:col-span-2 bg-slate-50 p-3 rounded-xl border border-slate-200 grid grid-cols-3 gap-2">
                <div className="col-span-3 text-[11px] font-bold text-slate-700">Harga Kamar Bertingkat (Opsional - jika dikosongkan mengikuti harga dasar):</div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Quad (4 Bed)</label>
                  <input type="number" value={form.price_quad||''} onChange={e=>setForm({...form,price_quad:e.target.value})} placeholder="Standar" className="w-full border rounded-lg p-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Triple (3 Bed)</label>
                  <input type="number" value={form.price_triple||''} onChange={e=>setForm({...form,price_triple:e.target.value})} placeholder="+ Selisih" className="w-full border rounded-lg p-1.5 text-xs font-mono" />
                </div>
                <div>
                  <label className="block text-[10px] text-slate-500 mb-0.5">Double (2 Bed)</label>
                  <input type="number" value={form.price_double||''} onChange={e=>setForm({...form,price_double:e.target.value})} placeholder="+ Selisih" className="w-full border rounded-lg p-1.5 text-xs font-mono" />
                </div>
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

export function MasterBatches() {
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

export function MasterInventaris() {
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

  const updateStock = async (id:number, stock:string, biaya?:string) => {
    await fetch('/api/admin/inventory',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'UPDATE_STOCK',item_id:id,stock_total:stock,unit_cost:biaya})});
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
              <div>
                <FInput label="Harga Satuan (Rp)" field="unit_cost" type="number" form={form} setForm={setForm} placeholder="150000"/>
                <p className="text-[10px] text-slate-500 mt-1">
                  Dipakai menghitung HPP saat barang diserahkan ke jamaah
                  (Dr Beban Perlengkapan / Cr Persediaan).
                </p>
              </div>
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
              <th className="p-3 text-right">Harga Satuan</th>
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
                  <div className="flex items-center gap-1 justify-end">
                    <span className="text-slate-400 text-[10px]">Rp</span>
                    <input type="number" defaultValue={it.unit_cost || 0}
                      onBlur={e=>updateStock(it.id, String(it.stock_total), e.target.value)}
                      className={`w-24 border rounded-lg px-2 py-1 text-xs text-right font-mono ${Number(it.unit_cost)>0?'':'border-amber-300 bg-amber-50'}`}
                      title={Number(it.unit_cost)>0?'Harga satuan':'Belum diisi — HPP tidak akan tercatat'} />
                  </div>
                </td>
                <td className="p-3 text-right">
                  <input type="number" defaultValue={it.stock_total} onBlur={e=>updateStock(it.id, e.target.value, String(it.unit_cost||0))} className="w-20 border rounded-lg px-2 py-1 text-xs text-center font-mono" />
                </td>
              </tr>
            ))}
            {items.length===0 && <tr><td colSpan={7} className="text-center py-8 text-slate-400">Belum ada barang perlengkapan terdaftar.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
