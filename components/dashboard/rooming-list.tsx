'use client';

import { useState, useEffect, useCallback } from 'react';
import { Building2, Users, Bed, CheckCircle2, Trash2 } from 'lucide-react';
import { ToastContainer } from './ui-dasar';

export function RoomingListTab() {
  const [batches, setBatches] = useState<any[]>([]);
  const [selectedBatchId, setSelectedBatchId] = useState<number | null>(null);
  const [pilgrims, setPilgrims] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hotelLoc, setHotelLoc] = useState<'MAKKAH' | 'MADINAH'>('MAKKAH');
  const [roomType, setRoomType] = useState('QUAD');
  const [roomNumber, setRoomNumber] = useState('');
  const [selectedJamaahId, setSelectedJamaahId] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | 'info' } | null>(null);

  const loadBatches = useCallback(() => {
    fetch('/api/admin/rooming')
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setBatches(d.batches || []);
          if (d.batches?.length > 0 && !selectedBatchId) {
            setSelectedBatchId(d.batches[0].id);
          }
        }
      });
  }, [selectedBatchId]);

  const loadDetail = useCallback(() => {
    if (!selectedBatchId) return;
    setLoading(true);
    fetch(`/api/admin/rooming?batch_id=${selectedBatchId}`)
      .then(r => r.json())
      .then(d => {
        if (d.success) {
          setPilgrims(d.pilgrims || []);
          setRooms(d.rooms || []);
        }
        setLoading(false);
      });
  }, [selectedBatchId]);

  useEffect(() => { loadBatches(); }, [loadBatches]);
  useEffect(() => { if (selectedBatchId) loadDetail(); }, [selectedBatchId, loadDetail]);

  const handleAssign = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatchId || !roomNumber || !selectedJamaahId) {
      setToast({ msg: 'Pilih jamaah, masukkan nomor kamar, dan lokasi hotel.', type: 'error' });
      return;
    }

    const res = await fetch('/api/admin/rooming', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'ASSIGN_ROOM',
        batch_id: selectedBatchId,
        hotel_location: hotelLoc,
        room_type: roomType,
        room_number: roomNumber,
        jamaah_id: selectedJamaahId,
      }),
    });
    const d = await res.json();
    if (d.success) {
      setToast({ msg: d.message, type: 'success' });
      setRoomNumber('');
      setSelectedJamaahId(null);
      loadDetail();
    } else {
      setToast({ msg: d.message || 'Gagal alokasi kamar', type: 'error' });
    }
  };

  const handleRemove = async (id: number) => {
    const res = await fetch('/api/admin/rooming', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'REMOVE_ROOM', id }),
    });
    const d = await res.json();
    if (d.success) {
      setToast({ msg: 'Alokasi kamar dihapus', type: 'success' });
      loadDetail();
    } else {
      setToast({ msg: d.message || 'Gagal menghapus', type: 'error' });
    }
  };

  const currentBatch = batches.find(b => b.id === Number(selectedBatchId));
  const assignedJamaahIds = new Set(rooms.filter(r => r.hotel_location === hotelLoc).map(r => r.jamaah_id));
  const unassignedPilgrims = pilgrims.filter(p => !assignedJamaahIds.has(p.id));

  // Kelompokkan kamar berdasarkan room_number
  const groupedRooms: Record<string, any[]> = {};
  for (const r of rooms.filter(x => x.hotel_location === hotelLoc)) {
    (groupedRooms[r.room_number] ||= []).push(r);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center bg-white p-6 rounded-2xl border border-slate-200 shadow-xs gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Rooming List & Alokasi Kamar Hotel Saudi</h2>
          <p className="text-sm text-slate-500 mt-1">Atur pembagian kamar hotel Makkah dan Madinah per kloter keberangkatan.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <select value={selectedBatchId || ''} onChange={e => setSelectedBatchId(Number(e.target.value))} className="p-2.5 rounded-xl border border-slate-200 bg-white text-xs font-bold w-full md:w-64">
            {batches.map(b => (
              <option key={b.id} value={b.id}>{b.batch_name} ({b.departure_date})</option>
            ))}
          </select>
        </div>
      </div>

      {currentBatch && (
        <div className="flex gap-2 border-b border-slate-200 pb-2">
          <button onClick={() => setHotelLoc('MAKKAH')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${hotelLoc === 'MAKKAH' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            Hotel Makkah: {currentBatch.hotel_makkah || 'Belum diatur'}
          </button>
          <button onClick={() => setHotelLoc('MADINAH')} className={`px-4 py-2 rounded-xl text-xs font-bold transition ${hotelLoc === 'MADINAH' ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 border border-slate-200'}`}>
            Hotel Madinah: {currentBatch.hotel_madinah || 'Belum diatur'}
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Form Alokasi */}
        <div className="bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <Bed className="w-4 h-4 text-emerald-600" /> Alokasi Kamar ({hotelLoc})
          </h3>
          <form onSubmit={handleAssign} className="space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Pilih Jamaah (Belum Masuk Kamar)</label>
              <select value={selectedJamaahId || ''} onChange={e => setSelectedJamaahId(Number(e.target.value))} className="w-full p-2.5 rounded-xl border border-slate-200 bg-white">
                <option value="">-- Pilih Jamaah --</option>
                {unassignedPilgrims.map(p => (
                  <option key={p.id} value={p.id}>{p.full_name} ({p.gender})</option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Tipe Kamar</label>
                <select value={roomType} onChange={e => setRoomType(e.target.value)} className="w-full p-2.5 rounded-xl border border-slate-200 bg-white">
                  <option value="QUAD">Quad (4 Bed)</option>
                  <option value="TRIPLE">Triple (3 Bed)</option>
                  <option value="DOUBLE">Double (2 Bed)</option>
                  <option value="SINGLE">Single (1 Bed)</option>
                </select>
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">No. Kamar</label>
                <input type="text" value={roomNumber} onChange={e => setRoomNumber(e.target.value)} placeholder="cth. 302" required className="w-full p-2.5 rounded-xl border border-slate-200 font-mono" />
              </div>
            </div>

            <button type="submit" className="w-full py-2.5 bg-emerald-600 text-white rounded-xl font-bold shadow-sm hover:bg-emerald-700 transition">
              + Masukkan ke Kamar
            </button>
          </form>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 text-xs text-slate-600 space-y-1">
            <p><b>Total Jamaah Kloter:</b> {pilgrims.length}</p>
            <p><b>Sudah di Kamar ({hotelLoc}):</b> {assignedJamaahIds.size}</p>
            <p><b>Belum Alokasi:</b> {unassignedPilgrims.length}</p>
          </div>
        </div>

        {/* Daftar Kamar & Alokasi */}
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-6 shadow-xs space-y-4">
          <h3 className="text-base font-bold text-slate-900">Daftar Kamar Hotel {hotelLoc}</h3>

          {loading ? (
            <p className="text-center py-12 text-slate-400">Memuat rooming list...</p>
          ) : Object.keys(groupedRooms).length === 0 ? (
            <div className="p-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-2xl">
              Belum ada kamar yang dialokasikan di hotel ini. Gunakan form di samping untuk memasukkan jamaah ke kamar.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(groupedRooms).map(([num, members]: [string, any[]]) => (
                <div key={num} className="border border-slate-200 rounded-xl p-4 bg-slate-50/50 space-y-2">
                  <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                    <span className="font-mono font-bold text-slate-900">Kamar {num}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 font-mono">
                      {members[0]?.room_type} ({members.length} Orang)
                    </span>
                  </div>
                  <ul className="space-y-1.5 text-xs">
                    {members.map((m: any) => (
                      <li key={m.id} className="flex justify-between items-center bg-white p-2 rounded-lg border border-slate-100">
                        <span className="font-bold text-slate-800">{m.jamaah_name} <span className="text-[10px] text-slate-400 font-mono">({m.gender})</span></span>
                        <button onClick={() => handleRemove(m.id)} className="text-rose-500 hover:text-rose-700 font-bold p-1" title="Keluarkan dari kamar">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {toast && <ToastContainer toast={toast} onClose={() => setToast(null)} />}
    </div>
  );
}
