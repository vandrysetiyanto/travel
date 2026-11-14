import { NextResponse } from 'next/server';
import { galatServer } from '@/lib/galat';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';

initDB();

/** Manifest keberangkatan: satu baris per JEMAAH (leader + anggota group_code),
 *  bukan per booking, supaya daftar manifest benar-benar berisi semua jemaah. */
export async function GET(request: Request) {
  const auth = await requirePermission(request, 'report.operational');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const batch_id = searchParams.get('batch_id');

    let query = `
      SELECT DISTINCT t.id as transaction_id, t.booking_code, t.status as payment_status,
             t.paid_amount, t.remaining_amount, t.total_pilgrims,
             j.id as jamaah_id, j.nik, j.no_kk, j.full_name, j.gender, j.birth_place, j.birth_date,
             j.phone, j.address, j.passport_number, j.passport_expiry, j.passport_status,
             j.passport_issue_date, j.nationality, j.passport_country,
             j.emergency_contact, j.medical_notes,
             j.marriage_doc_status, j.visa_status, j.group_code,
             b.id as batch_id, b.batch_name, b.departure_date, b.return_date,
             p.name as package_name, p.category, p.hotel_makkah, p.hotel_madinah, p.airline
      FROM transactions t
      JOIN batches b ON b.id = t.batch_id
      JOIN packages p ON p.id = b.package_id
      JOIN booking_jamaah bj ON bj.transaction_id = t.id
      JOIN master_jamaah j ON j.id = bj.jamaah_id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (batch_id) {
      query += ' AND t.batch_id = ?';
      params.push(batch_id);
    }

    query += ' ORDER BY b.departure_date ASC, j.full_name ASC';
    const mentah = db.prepare(query).all(...params) as any[];

    /*
     * Aturan imigrasi: paspor harus berlaku minimal 6 BULAN sejak tanggal
     * keberangkatan. Sebelumnya tidak ada pengecekan sama sekali, sehingga
     * jamaah bisa ditolak di bandara tanpa peringatan. Di sini setiap baris
     * diberi penanda agar terlihat merah di UI/cetakan.
     */
    const ENAM_BULAN_MS = 182 * 24 * 60 * 60 * 1000;
    const manifest = mentah.map((m) => {
      const exp = m.passport_expiry || m.passport_expiry_date || null;
      const berangkat = m.departure_date || null;
      let paspor_kurang_6bulan = false;
      let paspor_kedaluwarsa = false;
      let sisa_hari: number | null = null;

      if (exp) {
        const tExp = new Date(`${String(exp).slice(0, 10)}T00:00:00Z`).getTime();
        const tBrg = berangkat ? new Date(`${String(berangkat).slice(0, 10)}T00:00:00Z`).getTime() : null;
        if (!Number.isNaN(tExp)) {
          if (tBrg !== null && !Number.isNaN(tBrg)) {
            sisa_hari = Math.floor((tExp - tBrg) / 86400000);
            paspor_kedaluwarsa = tBrg >= tExp;
            paspor_kurang_6bulan = !paspor_kedaluwarsa && (tExp - tBrg) < ENAM_BULAN_MS;
          } else {
            sisa_hari = Math.floor((tExp - Date.now()) / 86400000);
            paspor_kedaluwarsa = sisa_hari < 0;
          }
        }
      }

      return {
        ...m,
        passport_expiry: exp,
        paspor_kurang_6bulan,
        paspor_kedaluwarsa,
        sisa_hari_paspor: sisa_hari,
        // Penanda kelengkapan: apa yang belum ada untuk manifest bandara
        kurang: [
          !m.passport_number && 'no. paspor',
          !exp && 'kedaluwarsa paspor',
          !m.birth_date && 'tanggal lahir',
          !m.nationality && 'kewarganegaraan',
          !m.passport_country && 'negara penerbit',
        ].filter(Boolean),
      };
    });

    const ringkas = {
      total_jamaah: manifest.length,
      paspor_kurang_6bulan: manifest.filter((m: any) => m.paspor_kurang_6bulan).length,
      paspor_kedaluwarsa: manifest.filter((m: any) => m.paspor_kedaluwarsa).length,
      tanpa_nomor_paspor: manifest.filter((m: any) => !m.passport_number).length,
      data_belum_lengkap: manifest.filter((m: any) => (m.kurang || []).length > 0).length,
    };

    const batches = db.prepare(`
      SELECT b.*, p.name as package_name
      FROM batches b
      JOIN packages p ON b.package_id = p.id
      ORDER BY b.departure_date DESC
    `).all();

    return NextResponse.json({ success: true, manifest, batches, ringkas });
  } catch (error: any) {
    return galatServer(error, { bagian: 'admin/manifest' });
  }
}
