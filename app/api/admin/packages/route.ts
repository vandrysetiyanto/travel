import { NextResponse } from 'next/server';
import { galatServer } from '@/lib/galat';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { requirePermission, catatAudit } from '@/lib/permissions';

initDB();

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'paket.read');
  if (!auth.ok) return auth.response;

  try {
    const packages = db.prepare('SELECT * FROM packages ORDER BY created_at DESC').all() as any[];

    /*
     * Itinerary per paket ikut dikirim agar UI tidak perlu request tambahan.
     * Dikelompokkan per package_id; paket tanpa itinerary mendapat array kosong.
     */
    const itin = db.prepare('SELECT * FROM package_itinerary ORDER BY package_id, hari').all() as any[];
    const perPaket: Record<number, any[]> = {};
    for (const it of itin) (perPaket[Number(it.package_id)] ||= []).push(it);
    for (const p of packages) p.itinerary = perPaket[Number(p.id)] || [];
    const batches = db.prepare(`
      SELECT b.*, p.name as package_name, p.category, p.price as default_price, p.hotel_makkah, p.hotel_madinah, p.airline
      FROM batches b
      JOIN packages p ON b.package_id = p.id
      ORDER BY b.departure_date ASC
    `).all();

    return NextResponse.json({ success: true, packages, batches });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/packages' });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { action } = body;

    // 1. Tambah Paket Baru
    if (action === 'CREATE_PACKAGE' || !action) {
      { const cek = await requirePermission(req, 'paket.create'); if (!cek.ok) return cek.response; }
      const { name, category, description, duration_days, price, hotel_makkah, hotel_madinah, airline, departure_city, departure_date, return_date, quota } = body;

      if (!name || !price) {
        return NextResponse.json({ success: false, message: 'Nama paket dan harga wajib diisi' }, { status: 400 });
      }

      const { price_quad, price_triple, price_double } = body;
      const qPrice = Number(price_quad) || Number(price) || 0;
      const tPrice = Number(price_triple) || qPrice;
      const dPrice = Number(price_double) || qPrice;

      const insertPkg = db.prepare(`
        INSERT INTO packages (name, category, description, duration_days, price, price_quad, price_triple, price_double, hotel_makkah, hotel_madinah, airline, departure_city)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const pkgResult = insertPkg.run(
        name,
        category || 'Umroh Reguler',
        description || '',
        Number(duration_days) || 9,
        Number(price),
        qPrice,
        tPrice,
        dPrice,
        hotel_makkah || '',
        hotel_madinah || '',
        airline || '',
        departure_city || 'Jakarta (CGK)'
      );

      // Jika ada input batch awal
      if (departure_date && return_date) {
        const insertBatch = db.prepare(`
          INSERT INTO batches (package_id, batch_name, departure_date, return_date, quota, status)
          VALUES (?, ?, ?, ?, ?, ?)
        `);
        insertBatch.run(
          pkgResult.lastInsertRowid,
          `Batch 1 - ${name}`,
          departure_date,
          return_date,
          Number(quota) || 45,
          'OPEN'
        );
      }

      return NextResponse.json({ success: true, message: 'Paket berhasil ditambahkan!' });
    }

    // 2. Update Paket
    if (action === 'UPDATE_PACKAGE') {
      { const cek = await requirePermission(req, 'paket.update'); if (!cek.ok) return cek.response; }
      const { id, name, category, description, duration_days, price, price_quad, price_triple, price_double, hotel_makkah, hotel_madinah, airline, departure_city, is_active } = body;
      const qPrice = Number(price_quad) || Number(price) || 0;
      const tPrice = Number(price_triple) || qPrice;
      const dPrice = Number(price_double) || qPrice;

      db.prepare(`
        UPDATE packages SET
          name = ?, category = ?, description = ?, duration_days = ?,
          price = ?, price_quad = ?, price_triple = ?, price_double = ?,
          hotel_makkah = ?, hotel_madinah = ?, airline = ?,
          departure_city = ?, is_active = ?
        WHERE id = ?
      `).run(
        name, category, description, Number(duration_days),
        Number(price), qPrice, tPrice, dPrice,
        hotel_makkah, hotel_madinah, airline,
        departure_city, is_active ?? 1, id
      );
      return NextResponse.json({ success: true, message: 'Data paket berhasil diperbarui!' });
    }

    // 3. Tambah Batch Baru
    if (action === 'CREATE_BATCH') {
      { const cek = await requirePermission(req, 'paket.create'); if (!cek.ok) return cek.response; }
      const { package_id, batch_name, departure_date, return_date, quota, status } = body;
      if (!package_id || !batch_name || !departure_date || !return_date) {
        return NextResponse.json({ success: false, message: 'Paket, nama batch, dan tanggal wajib diisi' }, { status: 400 });
      }
      db.prepare(`
        INSERT INTO batches (package_id, batch_name, departure_date, return_date, quota, status)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(package_id, batch_name, departure_date, return_date, Number(quota) || 45, status || 'OPEN');
      return NextResponse.json({ success: true, message: 'Batch keberangkatan berhasil ditambahkan!' });
    }

    // 4. Update Batch
    if (action === 'UPDATE_BATCH') {
      { const cek = await requirePermission(req, 'paket.update'); if (!cek.ok) return cek.response; }
      const { id, package_id, batch_name, departure_date, return_date, quota, status } = body;
      db.prepare(`
        UPDATE batches SET
          package_id = ?, batch_name = ?, departure_date = ?, return_date = ?, quota = ?, status = ?
        WHERE id = ?
      `).run(package_id, batch_name, departure_date, return_date, Number(quota), status, id);
      return NextResponse.json({ success: true, message: 'Batch keberangkatan berhasil diperbarui!' });
    }

    // 5. Delete Batch — hanya bila belum dipakai booking.
    if (action === 'DELETE_BATCH') {
      { const cek = await requirePermission(req, 'paket.delete'); if (!cek.ok) return cek.response; }
      const { id } = body;
      if (!id) {
        return NextResponse.json({ success: false, message: 'ID batch wajib dikirim' }, { status: 400 });
      }

      const target = db.prepare('SELECT id, batch_name FROM batches WHERE id = ?').get(id) as any;
      if (!target) {
        return NextResponse.json({ success: false, message: 'Batch tidak ditemukan' }, { status: 404 });
      }

      /*
       * Batch yang sudah punya booking tidak boleh dihapus: transactions.batch_id
       * memakai foreign key tanpa ON DELETE CASCADE, sehingga penghapusan akan
       * gagal dengan error SQLite mentah (atau, bila FK dilonggarkan, meninggalkan
       * booking yatim yang merusak laporan).
       */
      const dipakai = db.prepare('SELECT COUNT(*) as c FROM transactions WHERE batch_id = ?').get(id) as any;
      if (dipakai.c > 0) {
        return NextResponse.json({
          success: false,
          message: `Batch "${target.batch_name}" masih dipakai ${dipakai.c} booking. Batalkan booking atau ubah status batch menjadi CLOSED.`,
        }, { status: 409 });
      }

      db.prepare('DELETE FROM batches WHERE id = ?').run(id);
      catatAudit({ user: auth.user, action: 'DELETE', module: 'batch', recordId: id });
      return NextResponse.json({ success: true, message: 'Batch berhasil dihapus' });
    }


    /* ── ITINERARY PER PAKET ─────────────────────────────────────────────
     * Program harian dipakai untuk brosur dan menjadi dasar penyesuaian
     * jadwal hotel/katering saat terjadi reschedule.
     */
    if (action === 'SAVE_ITINERARY') {
      { const cek = await requirePermission(req, 'paket.update'); if (!cek.ok) return cek.response; }
      const { package_id, itinerary } = body;
      const paketId = Number(package_id);
      if (!paketId) {
        return NextResponse.json({ success: false, message: 'ID paket wajib dikirim.' }, { status: 400 });
      }
      const paket = db.prepare('SELECT id, name FROM packages WHERE id = ?').get(paketId) as any;
      if (!paket) {
        return NextResponse.json({ success: false, message: 'Paket tidak ditemukan.' }, { status: 404 });
      }
      if (!Array.isArray(itinerary)) {
        return NextResponse.json({ success: false, message: 'Itinerary harus berupa daftar.' }, { status: 400 });
      }

      // Validasi tiap baris sebelum menyimpan apa pun
      const bersih: { hari: number; judul: string; kegiatan: string; kota: string; hotel: string; makan: string }[] = [];
      const hariTerpakai = new Set<number>();
      // Array.from dipakai karena target TS proyek belum mendukung iterasi Map/iterator langsung.
      const daftarBaris = Array.from(itinerary as any[]).map((row, i) => ({ i, row }));
      for (const { i, row } of daftarBaris) {
        const hari = Number(row?.hari);
        const judul = String(row?.judul || '').trim();
        if (!Number.isInteger(hari) || hari < 1 || hari > 60) {
          return NextResponse.json({ success: false, message: `Baris ${i + 1}: hari harus angka 1–60.` }, { status: 400 });
        }
        if (hariTerpakai.has(hari)) {
          return NextResponse.json({ success: false, message: `Hari ${hari} muncul lebih dari sekali.` }, { status: 400 });
        }
        if (!judul) {
          return NextResponse.json({ success: false, message: `Baris ${i + 1}: judul kegiatan wajib diisi.` }, { status: 400 });
        }
        hariTerpakai.add(hari);
        bersih.push({
          hari,
          judul,
          kegiatan: String(row?.kegiatan || ''),
          kota: String(row?.kota || ''),
          hotel: String(row?.hotel || ''),
          makan: String(row?.makan || ''),
        });
      }

      const simpan = db.transaction(() => {
        db.prepare('DELETE FROM package_itinerary WHERE package_id = ?').run(paketId);
        const ins = db.prepare(`INSERT INTO package_itinerary (package_id, hari, judul, kegiatan, kota, hotel, makan)
                                VALUES (?, ?, ?, ?, ?, ?, ?)`);
        for (const b of bersih) ins.run(paketId, b.hari, b.judul, b.kegiatan, b.kota, b.hotel, b.makan);
      });
      simpan();

      catatAudit({
        user: auth.user, action: 'UPDATE', module: 'itinerary', recordId: paketId,
        after: { paket: paket.name, jumlah_hari: bersih.length },
      });

      return NextResponse.json({
        success: true,
        message: `Itinerary ${paket.name} disimpan (${bersih.length} hari).`,
        jumlah_hari: bersih.length,
      });
    }

    if (action === 'DELETE_ITINERARY') {
      { const cek = await requirePermission(req, 'paket.update'); if (!cek.ok) return cek.response; }
      const paketId = Number(body.package_id);
      if (!paketId) {
        return NextResponse.json({ success: false, message: 'ID paket wajib dikirim.' }, { status: 400 });
      }
      const hapus = db.prepare('DELETE FROM package_itinerary WHERE package_id = ?').run(paketId);
      catatAudit({ user: auth.user, action: 'DELETE', module: 'itinerary', recordId: paketId });
      return NextResponse.json({ success: true, message: `Itinerary dihapus (${hapus.changes} baris).` });
    }


    /* ── RESCHEDULE KLOTER (perubahan jadwal mendadak) ────────────────────
     * Maskapai mengubah tanggal/rute secara tiba-tiba. Aksi ini:
     *   - mengubah tanggal kloter sekaligus (bukan satu per satu)
     *   - mengembalikan DAFTAR JAMAAH TERDAMPAK agar bisa dihubungi
     *   - menolak tanggal yang tidak masuk akal (pulang sebelum berangkat)
     *   - mencatat sebelum/sesudah ke audit
     * Tidak menyentuh uang: perubahan jadwal bukan transaksi keuangan.
     */
    if (action === 'RESCHEDULE_BATCH') {
      { const cek = await requirePermission(req, 'paket.update'); if (!cek.ok) return cek.response; }
      const { batch_id, departure_date, return_date, catatan } = body;

      const id = Number(batch_id);
      const berangkat = String(departure_date || '').slice(0, 10);
      const pulang = String(return_date || '').slice(0, 10);

      if (!id) {
        return NextResponse.json({ success: false, message: 'ID kloter wajib dikirim.' }, { status: 400 });
      }
      const tglSah = (t: string) => /^\d{4}-\d{2}-\d{2}$/.test(t) && !Number.isNaN(new Date(`${t}T00:00:00+07:00`).getTime());
      if (!tglSah(berangkat) || !tglSah(pulang)) {
        return NextResponse.json({ success: false, message: 'Tanggal berangkat & pulang wajib berformat YYYY-MM-DD.' }, { status: 400 });
      }
      if (pulang < berangkat) {
        return NextResponse.json({ success: false, message: 'Tanggal pulang tidak boleh sebelum tanggal berangkat.' }, { status: 400 });
      }

      const batch = db.prepare('SELECT * FROM batches WHERE id = ?').get(id) as any;
      if (!batch) {
        return NextResponse.json({ success: false, message: 'Kloter tidak ditemukan.' }, { status: 404 });
      }

      // Jamaah terdampak: yang masih aktif di kloter ini
      const terdampak = db.prepare(`
        SELECT t.id AS transaction_id, t.booking_code, t.status,
               j.id AS jamaah_id, j.full_name, j.phone
          FROM transactions t
          JOIN master_jamaah j ON j.id = t.jamaah_id
         WHERE t.batch_id = ? AND t.status <> 'CANCELLED'
         ORDER BY j.full_name
      `).all(id) as any[];

      const durasiLama = Math.round(
        (new Date(batch.return_date).getTime() - new Date(batch.departure_date).getTime()) / 86400000,
      );
      const durasiBaru = Math.round((new Date(pulang).getTime() - new Date(berangkat).getTime()) / 86400000);

      db.prepare('UPDATE batches SET departure_date = ?, return_date = ? WHERE id = ?')
        .run(berangkat, pulang, id);

      catatAudit({
        user: auth.user,
        action: 'UPDATE',
        module: 'batch_reschedule',
        recordId: id,
        before: { berangkat: batch.departure_date, pulang: batch.return_date },
        after: { berangkat, pulang, catatan: catatan || '' },
        notes: `${terdampak.length} jamaah terdampak`,
      });

      return NextResponse.json({
        success: true,
        message:
          `Jadwal ${batch.batch_name} diperbarui: ${batch.departure_date} → ${berangkat}, ` +
          `${batch.return_date} → ${pulang}. ${terdampak.length} jamaah perlu diberi tahu.`,
        batch: { id, nama: batch.batch_name, berangkat, pulang },
        durasi: { lama_hari: durasiLama, baru_hari: durasiBaru, selisih_hari: durasiBaru - durasiLama },
        jamaah_terdampak: terdampak,
        jumlah_terdampak: terdampak.length,
      });
    }

    return NextResponse.json({ success: false, message: 'Action tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/packages' });
  }
}
