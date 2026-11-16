'use client';

import { useState, useEffect, useCallback } from 'react';
import { fmtRp } from './format';
import { ToastContainer } from './ui-dasar';

export function MasterAgenTab() {
  const [agents, setAgents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editItem, setEditItem] = useState<any>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  // Form state
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [type, setType] = useState('PERORANGAN');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccNo, setBankAccNo] = useState('');
  const [bankHolder, setBankHolder] = useState('');
  const [commissionMode, setCommissionMode] = useState<'FIX' | 'AKUMULASI'>('FIX');
  const [fixAmount, setFixAmount] = useState('500000');
  const [tiers, setTiers] = useState<any[]>([
    { min_count: 1, max_count: 5, amount: 500000 },
    { min_count: 6, max_count: null, amount: 1000000 },
  ]);
  const [notes, setNotes] = useState('');

  const loadAgents = useCallback(() => {
    setLoading(true);
    fetch('/api/admin/agents')
      .then(r => r.json())
      .then(d => {
        if (d.success) setAgents(d.agents || []);
        setLoading(false);
      });
  }, []);

  useEffect(() => { loadAgents(); }, [loadAgents]);

  const openCreate = () => {
    setEditItem(null);
    setCode('AG-' + Math.floor(100 + Math.random() * 900));
    setName('');
    setType('PERORANGAN');
    setPhone('');
    setEmail('');
    setBankName('');
    setBankAccNo('');
    setBankHolder('');
    setCommissionMode('FIX');
    setFixAmount('500000');
    setTiers([
      { min_count: 1, max_count: 5, amount: 500000 },
      { min_count: 6, max_count: null, amount: 1000000 },
    ]);
    setNotes('');
    setShowModal(true);
  };

  const openEdit = (ag: any) => {
    setEditItem(ag);
    setCode(ag.code);
    setName(ag.name);
    setType(ag.type || 'PERORANGAN');
    setPhone(ag.phone || '');
    setEmail(ag.email || '');
    setBankName(ag.bank_name || '');
    setBankAccNo(ag.bank_account_no || '');
    setBankHolder(ag.bank_holder_name || '');
    setCommissionMode(ag.commission_mode || 'FIX');
    setFixAmount(String(ag.fix_amount || 0));
    if (ag.tiers && ag.tiers.length > 0) {
      setTiers(ag.tiers);
    }
    setNotes(ag.notes || '');
    setShowModal(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const action = editItem ? 'UPDATE_AGENT' : 'CREATE_AGENT';
    const payload = {
      action,
      id: editItem?.id,
      code, name, type, phone, email,
      bank_name: bankName, bank_account_no: bankAccNo, bank_holder_name: bankHolder,
      commission_mode: commissionMode,
      fix_amount: Number(fixAmount) || 0,
      tiers: commissionMode === 'AKUMULASI' ? tiers : [],
      notes,
    };

    const res = await fetch('/api/admin/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const d = await res.json();
    if (d.success) {
      setToast({ msg: d.message, type: 'success' });
      setShowModal(false);
      loadAgents();
    } else {
      setToast({ msg: d.message || 'Gagal menyimpan', type: 'error' });
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Hapus agen ini?')) return;
    const res = await fetch('/api/admin/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'DELETE_AGENT', id }),
    });
    const d = await res.json();
    if (d.success) {
      setToast({ msg: 'Agen dihapus', type: 'success' });
      loadAgents();
    } else {
      setToast({ msg: d.message || 'Gagal menghapus', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Master Agen & Mitra Referral</h2>
          <p className="text-sm text-slate-500 mt-1">Kelola data agen, skema komisi Fix atau Akumulasi bertingkat.</p>
        </div>
        <button onClick={openCreate} className="px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-bold shadow-sm hover:bg-emerald-700 transition">
          + Tambah Agen Baru
        </button>
      </div>

      {loading ? (
        <p className="text-center py-12 text-slate-400">Memuat data agen...</p>
      ) : agents.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          Belum ada agen terdaftar. Klik "+ Tambah Agen Baru" di atas.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((ag: any) => (
            <div key={ag.id} className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">{ag.code}</span>
                    <h3 className="text-base font-bold text-slate-900 mt-1">{ag.name}</h3>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${ag.commission_mode === 'AKUMULASI' ? 'bg-indigo-50 text-indigo-700' : 'bg-emerald-50 text-emerald-700'}`}>
                    {ag.commission_mode}
                  </span>
                </div>
                <div className="mt-4 space-y-1 text-xs text-slate-600">
                  <p><b>Tipe:</b> {ag.type} | <b>Telp:</b> {ag.phone || '-'}</p>
                  <p><b>Bank:</b> {ag.bank_name ? `${ag.bank_name} (${ag.bank_account_no}) a.n ${ag.bank_holder_name}` : '-'}</p>
                  {ag.commission_mode === 'FIX' ? (
                    <p className="text-emerald-600 font-bold mt-2">Komisi Fix: {fmtRp(ag.fix_amount)} / jamaah</p>
                  ) : (
                    <div className="mt-2 space-y-1 bg-slate-50 p-2 rounded-lg">
                      <p className="text-[11px] font-bold text-slate-700">Skema Akumulasi:</p>
                      {(ag.tiers || []).map((t: any, idx: number) => (
                        <p key={idx} className="font-mono text-[11px] text-slate-600">
                          {t.min_count}–{t.max_count || '∞'} jamaah: <b className="text-indigo-600">{fmtRp(t.amount)}</b>
                        </p>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-slate-100 flex justify-between items-center text-xs">
                <div>
                  <span className="text-slate-400">Referral: </span>
                  <b className="text-slate-900">{ag.total_referrals || 0} jamaah</b>
                </div>
                <div className="space-x-2">
                  <button onClick={() => openEdit(ag)} className="px-3 py-1 bg-slate-100 text-slate-700 rounded-lg font-bold hover:bg-slate-200">Edit</button>
                  <button onClick={() => handleDelete(ag.id)} className="px-3 py-1 bg-rose-50 text-rose-600 rounded-lg font-bold hover:bg-rose-100">Hapus</button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal Form */}
      {showModal && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-bold text-slate-900 mb-4">{editItem ? 'Edit Agen' : 'Tambah Agen Baru'}</h3>
            <form onSubmit={handleSave} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Kode Agen</label>
                  <input type="text" value={code} onChange={e => setCode(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-200 font-mono uppercase" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Lengkap</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-200" placeholder="cth. Budi Santoso" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Tipe Mitra</label>
                  <select value={type} onChange={e => setType(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 bg-white">
                    <option value="PERORANGAN">Perorangan</option>
                    <option value="TRAVEL">Sub-Travel</option>
                    <option value="KOMUNITAS">Komunitas / Majelis</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. WhatsApp</label>
                  <input type="text" value={phone} onChange={e => setPhone(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 font-mono" placeholder="0812..." />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nama Bank</label>
                  <input type="text" value={bankName} onChange={e => setBankName(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200" placeholder="BCA / Mandiri" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">No. Rekening</label>
                  <input type="text" value={bankAccNo} onChange={e => setBankAccNo(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Atas Nama</label>
                  <input type="text" value={bankHolder} onChange={e => setBankHolder(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200" />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Skema Komisi</label>
                <select value={commissionMode} onChange={e => setCommissionMode(e.target.value as any)} className="w-full p-2.5 rounded-xl border border-slate-200 bg-white font-bold text-emerald-700">
                  <option value="FIX">Komisi Fix (Nominal Tetap per Jamaah)</option>
                  <option value="AKUMULASI">Komisi Akumulasi Bertingkat (Berdasarkan Jumlah Jamaah)</option>
                </select>
              </div>

              {commissionMode === 'FIX' ? (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Nominal Komisi Fix (Rp)</label>
                  <input type="number" value={fixAmount} onChange={e => setFixAmount(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold" />
                </div>
              ) : (
                <div className="space-y-3 bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-700">Pengaturan Tier Akumulasi:</p>
                  {tiers.map((t, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      <span className="font-mono text-slate-500">{t.min_count} s.d.</span>
                      <input type="number" value={t.max_count ?? ''} placeholder="∞" onChange={e => {
                        const val = e.target.value ? Number(e.target.value) : null;
                        const next = [...tiers]; next[idx].max_count = val; setTiers(next);
                      }} className="w-16 p-1.5 rounded border border-slate-200 font-mono text-center" />
                      <span>jamaah → Rp</span>
                      <input type="number" value={t.amount} onChange={e => {
                        const val = Number(e.target.value) || 0;
                        const next = [...tiers]; next[idx].amount = val; setTiers(next);
                      }} className="flex-1 p-1.5 rounded border border-slate-200 font-mono font-bold" />
                      {idx > 0 && (
                        <button type="button" onClick={() => setTiers(tiers.filter((_, i) => i !== idx))} className="text-rose-500 font-bold px-2">✕</button>
                      )}
                    </div>
                  ))}
                  <button type="button" onClick={() => setTiers([...tiers, { min_count: (tiers[tiers.length - 1]?.max_count || 5) + 1, max_count: null, amount: 1500000 }])} className="text-xs text-indigo-600 font-bold hover:underline">
                    + Tambah Tier Kenaikan
                  </button>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="w-full p-2.5 rounded-xl border border-slate-200" />
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold">Batal</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-sm hover:bg-emerald-700">Simpan Agen</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <ToastContainer toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}

export function KomisiAgenTab() {
  const [commissions, setCommissions] = useState<any[]>([]);
  const [ringkasan, setRingkasan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [payModalItem, setPayModalItem] = useState<any>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payRef, setPayRef] = useState('');
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadData = useCallback(() => {
    setLoading(true);
    fetch(`/api/admin/commissions?status=${filterStatus}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setCommissions(d.commissions || []);
          setRingkasan(d.ringkasan || null);
        }
        setLoading(false);
      });
  }, [filterStatus]);

  useEffect(() => { loadData(); }, [loadData]);

  const handlePay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!payModalItem) return;
    const res = await fetch('/api/admin/commissions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'PAY_COMMISSION',
        commission_id: payModalItem.id,
        amount: Number(payAmount),
        reference_no: payRef,
      }),
    });
    const d = await res.json();
    if (d.success) {
      setToast({ msg: d.message, type: 'success' });
      setPayModalItem(null);
      loadData();
    } else {
      setToast({ msg: d.message || 'Gagal membayar komisi', type: 'error' });
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Pencairan & Daftar Komisi Agen</h2>
          <p className="text-sm text-slate-500 mt-1">Komisi cair (ELIGIBLE) otomatis saat jamaah lunas, siap dicairkan ke agen.</p>
        </div>
        <div className="flex gap-2">
          {['ALL', 'PENDING', 'ELIGIBLE', 'PAID'].map(st => (
            <button key={st} onClick={() => setFilterStatus(st)} className={`px-3 py-1.5 rounded-xl text-xs font-bold transition ${filterStatus === st ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
              {st}
            </button>
          ))}
        </div>
      </div>

      {ringkasan && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-slate-400 uppercase">Pending (Belum Lunas)</p>
            <p className="text-xl font-black text-amber-600 mt-1 font-mono">{fmtRp(ringkasan.total_pending)}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-emerald-200 shadow-xs">
            <p className="text-xs font-bold text-emerald-600 uppercase">Siap Dibayar (Eligible)</p>
            <p className="text-xl font-black text-emerald-700 mt-1 font-mono">{fmtRp(ringkasan.total_eligible)}</p>
          </div>
          <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs">
            <p className="text-xs font-bold text-slate-400 uppercase">Sudah Dibayar (Paid)</p>
            <p className="text-xl font-black text-slate-900 mt-1 font-mono">{fmtRp(ringkasan.total_paid)}</p>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-center py-12 text-slate-400">Memuat data komisi...</p>
      ) : commissions.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center text-slate-400">
          Tidak ada data komisi dengan filter ini.
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
              <tr>
                <th className="p-3">Agen</th>
                <th className="p-3">Jamaah / Booking</th>
                <th className="p-3">Kloter</th>
                <th className="p-3">Tier / Skema</th>
                <th className="p-3 text-right">Nominal</th>
                <th className="p-3 text-center">Status</th>
                <th className="p-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {commissions.map((c: any) => (
                <tr key={c.id} className="hover:bg-slate-50/50">
                  <td className="p-3 font-bold text-slate-900">{c.agent_name} <span className="font-mono text-[10px] text-slate-400">({c.agent_code})</span></td>
                  <td className="p-3">
                    <span className="font-bold text-slate-800">{c.jamaah_name}</span>
                    <span className="block font-mono text-[10px] text-slate-450">{c.booking_code}</span>
                  </td>
                  <td className="p-3 text-slate-600">{c.batch_name || '-'}</td>
                  <td className="p-3 font-mono text-slate-600">{c.calculation_type} ({c.tier_applied || '-'})</td>
                  <td className="p-3 text-right font-mono font-black text-emerald-600">{fmtRp(c.nominal)}</td>
                  <td className="p-3 text-center">
                    <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                      c.status === 'PAID' ? 'bg-emerald-50 text-emerald-700' :
                      c.status === 'ELIGIBLE' ? 'bg-indigo-50 text-indigo-700' :
                      c.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-rose-50 text-rose-700'
                    }`}>
                      {c.status}
                    </span>
                  </td>
                  <td className="p-3 text-center">
                    {c.status === 'ELIGIBLE' && (
                      <button onClick={() => { setPayModalItem(c); setPayAmount(String(c.nominal)); setPayRef(''); }} className="px-3 py-1 bg-emerald-600 text-white rounded-lg font-bold hover:bg-emerald-700 shadow-xs">
                        Bayar
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Bayar */}
      {payModalItem && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Pencairan Komisi</h3>
            <p className="text-xs text-slate-500 mb-4">Agen: <b>{payModalItem.agent_name}</b> | Jamaah: <b>{payModalItem.jamaah_name}</b></p>
            <form onSubmit={handlePay} className="space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Nominal Pembayaran (Rp)</label>
                <input type="number" value={payAmount} onChange={e => setPayAmount(e.target.value)} required className="w-full p-2.5 rounded-xl border border-slate-200 font-mono font-bold" />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Referensi / No. Bukti Transfer</label>
                <input type="text" value={payRef} onChange={e => setPayRef(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 font-mono" placeholder="TRX-BCA-..." />
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <button type="button" onClick={() => setPayModalItem(null)} className="px-4 py-2 bg-slate-100 text-slate-700 rounded-xl font-bold">Batal</button>
                <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-xl font-bold shadow-sm hover:bg-emerald-700">Konfirmasi Bayar & Jurnal</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && <ToastContainer toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
