import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requirePermission } from '@/lib/permissions';
import { galatServer } from '@/lib/galat';

initDB();

/**
 * Riwayat jamaah per PAKET & BATCH.
 *
 * Sebelumnya aplikasi hanya bisa menjawab "transaksi apa saja yang ada"
 * (satu baris = satu booking). Pertanyaan yang sebenarnya dipakai staf —
 * "jamaah ini sudah ikut paket apa dan kloter mana saja" — tidak bisa dijawab
 * tanpa membuka satu per satu.
 *
 * Endpoint ini mengelompokkan per JAMAAT (bukan per transaksi):
 *   - jumlah keberangkatan (termasuk yang batal, ditandai)
 *   - daftar paket & batch yang pernah/sedang diikuti, urut waktu
 *   - status terkini (aktif / selesai / batal)
 *
 * Bentuk respons: { jamaah: [...] } dengan `riwayat` berupa array.
 */
export async function GET(request: Request) {
  const auth = await requirePermission(request, 'jamaah.read');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const cari = String(searchParams.get('search') || '').trim();
    const filterBatch = Number(searchParams.get('batch_id')) || null;
    const filterPaket = Number(searchParams.get('package_id')) || null;
    const hanyaBerulang = searchParams.get('berulang') === '1';
    const limit = Math.min(Math.max(Number(searchParams.get('limit')) || 500, 1), 2000);

    let syarat = 'WHERE 1=1';
    const params: any[] = [];
    if (cari) {
      syarat += ' AND (j.full_name LIKE ? OR j.nik LIKE ? OR j.phone LIKE ?)';
      const t = `%${cari}%`;
      params.push(t, t, t);
    }

    /*
     * Satu query: setiap baris = satu keberangkatan (transaksi).
     * Dikelompokkan di sisi aplikasi agar jumlah query tetap 1 berapa pun
     * banyaknya jamaah — menghindari pola N+1.
     */
    const baris = db
      .prepare(`
        SELECT j.id AS jamaah_id, j.nik, j.full_name, j.phone,
               t.id AS transaction_id, t.booking_code, t.status AS status_booking,
               t.total_amount, t.paid_amount, t.remaining_amount, t.created_at,
               b.id AS batch_id, b.batch_name, b.departure_date, b.return_date, b.status AS status_batch,
               p.id AS package_id, p.name AS package_name, p.category
          FROM transactions t
          JOIN master_jamaah j ON j.id = t.jamaah_id
          JOIN batches  b ON b.id = t.batch_id
          JOIN packages p ON p.id = b.package_id
         ${syarat}
         ORDER BY j.full_name ASC, b.departure_date ASC
      `)
      .all(...params) as any[];

    /*
     * Jamaah tanpa booking tetap harus muncul (agar bisa dilihat siapa yang
     * belum pernah berangkat). PENTING: filter pencarian WAJIB ikut diterapkan
     * di sini — kalau tidak, daftar jamaah diambil tanpa syarat dan hasil
     * pencarian tetap memuat SEMUA orang (bug yang pernah terjadi).
     */
    let syaratJamaah = 'WHERE 1=1';
    const paramsJamaah: any[] = [];
    if (cari) {
      syaratJamaah += ' AND (full_name LIKE ? OR nik LIKE ? OR phone LIKE ?)';
      const t = `%${cari}%`;
      paramsJamaah.push(t, t, t);
    }
    const semuaJamaah = db
      .prepare(`SELECT id AS jamaah_id, nik, full_name, phone FROM master_jamaah ${syaratJamaah} ORDER BY full_name ASC`)
      .all(...paramsJamaah) as any[];

    type Riwayat = {
      transaction_id: number;
      booking_code: string;
      package_id: number;
      package_name: string;
      category: string;
      batch_id: number;
      batch_name: string;
      departure_date: string;
      return_date: string;
      status_booking: string;
      status_batch: string;
      total_amount: number;
      paid_amount: number;
      remaining_amount: number;
      dibuat: string;
    };

    const peta = new Map<number, { jamaah: any; riwayat: Riwayat[] }>();

    for (const j of semuaJamaah) {
      peta.set(Number(j.jamaah_id), { jamaah: j, riwayat: [] });
    }

    for (const b of baris) {
      const entri = peta.get(Number(b.jamaah_id));
      if (!entri) continue;
      entri.riwayat.push({
        transaction_id: b.transaction_id,
        booking_code: b.booking_code,
        package_id: b.package_id,
        package_name: b.package_name,
        category: b.category,
        batch_id: b.batch_id,
        batch_name: b.batch_name,
        departure_date: b.departure_date,
        return_date: b.return_date,
        status_booking: b.status_booking,
        status_batch: b.status_batch,
        total_amount: Number(b.total_amount) || 0,
        paid_amount: Number(b.paid_amount) || 0,
        remaining_amount: Number(b.remaining_amount) || 0,
        dibuat: b.created_at,
      });
    }

    const hariIni = new Date().toISOString().slice(0, 10);

    let hasil = Array.from(peta.values()).map(({ jamaah, riwayat }) => {
      const aktif = riwayat.filter((r) => r.status_booking !== 'CANCELLED');
      const terakhir = aktif.length ? aktif[aktif.length - 1] : riwayat[riwayat.length - 1] || null;

      // Status terkini: kalau ada yang belum pulang -> AKTIF, kalau semua sudah lewat -> SELESAI
      let statusTerkini: 'AKTIF' | 'SELESAI' | 'BATAL' | 'BELUM_PERNAH';
      if (!riwayat.length) statusTerkini = 'BELUM_PERNAH';
      else if (!aktif.length) statusTerkini = 'BATAL';
      else if (aktif.some((r) => r.return_date >= hariIni)) statusTerkini = 'AKTIF';
      else statusTerkini = 'SELESAI';

      const paketUnik = Array.from(new Set(riwayat.map((r) => r.package_id)));

      return {
        jamaah_id: jamaah.jamaah_id,
        nik: jamaah.nik,
        full_name: jamaah.full_name,
        phone: jamaah.phone,
        jumlah_keberangkatan: aktif.length,
        jumlah_batal: riwayat.length - aktif.length,
        jumlah_paket_berbeda: paketUnik.length,
        berulang: aktif.length >= 2,
        status_terkini: statusTerkini,
        terakhir: terakhir
          ? {
              package_name: terakhir.package_name,
              batch_name: terakhir.batch_name,
              departure_date: terakhir.departure_date,
              status_booking: terakhir.status_booking,
            }
          : null,
        riwayat,
      };
    });

    // Filter opsional (dipakai UI untuk "hanya yang berulang" / per batch / per paket)
    if (filterBatch) hasil = hasil.filter((h) => h.riwayat.some((r) => Number(r.batch_id) === filterBatch));
    if (filterPaket) hasil = hasil.filter((h) => h.riwayat.some((r) => Number(r.package_id) === filterPaket));
    if (hanyaBerulang) hasil = hasil.filter((h) => h.berulang);

    const ringkas = {
      total_jamaah: hasil.length,
      berulang: hasil.filter((h) => h.berulang).length,
      aktif: hasil.filter((h) => h.status_terkini === 'AKTIF').length,
      selesai: hasil.filter((h) => h.status_terkini === 'SELESAI').length,
      belum_pernah: hasil.filter((h) => h.status_terkini === 'BELUM_PERNAH').length,
      total_keberangkatan: hasil.reduce((t, h) => t + h.jumlah_keberangkatan, 0),
    };

    return NextResponse.json({ success: true, ringkas, jamaah: hasil.slice(0, limit) });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/jamaah/riwayat' });
  }
}
