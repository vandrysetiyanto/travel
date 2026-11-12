import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { catatHppPenyerahan, hapusHppPenyerahan } from '@/lib/persediaan';

initDB();

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'checklist.read');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const jamaah_id = searchParams.get('jamaah_id');

    const master = db.prepare('SELECT * FROM checklist_master ORDER BY category, item_code').all();

    if (jamaah_id) {
      const items = db.prepare(`
        SELECT cm.*, COALESCE(jc.status, 'BELUM') as status, jc.notes, jc.updated_at
        FROM checklist_master cm
        LEFT JOIN jamaah_checklist jc ON cm.id = jc.checklist_master_id AND jc.jamaah_id = ?
        ORDER BY cm.category, cm.item_code
      `).all(jamaah_id);
      return NextResponse.json({ success: true, master, items });
    }

    return NextResponse.json({ success: true, master });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const auth = await requireAdmin(request);
  if (!auth.ok) return auth.response;

  try {
    const body = await request.json();
    const { action } = body;

    if (action === 'UPDATE_STATUS') {
      { const cek = await requirePermission(request, 'checklist.update'); if (!cek.ok) return cek.response; }
      const { jamaah_id, checklist_master_id, status, notes } = body;
      if (!jamaah_id || !checklist_master_id || !status) {
        return NextResponse.json({ success: false, message: 'Data tidak lengkap' }, { status: 400 });
      }

      // Check if linked to inventory
      let hppDicatat = 0;
      const masterItem = db.prepare('SELECT * FROM checklist_master WHERE id = ?').get(checklist_master_id) as any;
      const current = db.prepare('SELECT status FROM jamaah_checklist WHERE jamaah_id = ? AND checklist_master_id = ?').get(jamaah_id, checklist_master_id) as any;
      const oldStatus = current ? current.status : 'BELUM';

      // Upsert status
      db.prepare(`
        INSERT INTO jamaah_checklist (jamaah_id, checklist_master_id, status, notes, updated_at)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(jamaah_id, checklist_master_id) DO UPDATE SET
        status = excluded.status, notes = excluded.notes, updated_at = CURRENT_TIMESTAMP
      `).run(jamaah_id, checklist_master_id, status, notes || '');

      // Inventory adjustment if linked and status changed to SUDAH / DIAMBIL from BELUM (or vice versa)
      if (masterItem && masterItem.is_inventory_linked && masterItem.inventory_item_id) {
        const naik = status === 'SUDAH' || status === 'DIAMBIL';
        const turun = status === 'BELUM';
        const sebelumnyaNaik = oldStatus === 'SUDAH' || oldStatus === 'DIAMBIL';
        const sebelumnyaTurun = oldStatus === 'BELUM';

        if (sebelumnyaTurun && naik) {
          /*
           * Barang diserahkan. Sebelumnya blok ini menulis kolom `handed_at`
           * yang tidak ada (nama benarnya `handed_over_at`) dan mengirim
           * transaction_id = NULL padahal kolomnya NOT NULL — sehingga setiap
           * centang berujung error 500 dan stok tidak tercatat.
           *
           * Sekarang: booking dicari lewat booking_jamaah (id), penyerahan
           * dicatat dengan kolom yang benar + jamaah_id, stok dipotong dalam
           * satu transaksi. Bila jamaah belum punya booking, stok tetap
           * dipotong tetapi baris handover dilewati (kolom transaction_id
           * masih NOT NULL di skema lama).
           */
          const booking = db
            .prepare(`SELECT transaction_id FROM booking_jamaah WHERE jamaah_id = ? ORDER BY id DESC LIMIT 1`)
            .get(jamaah_id) as { transaction_id: number } | undefined;

          const simpan = db.transaction(() => {
            db.prepare('UPDATE inventory_items SET stock_total = MAX(0, stock_total - 1) WHERE id = ?')
              .run(masterItem.inventory_item_id);
            // HPP dicatat setelah baris penyerahan dibuat (butuh handover_id).
            if (booking?.transaction_id) {
              const info = db.prepare(`
                INSERT INTO inventory_handover (item_id, qty, transaction_id, jamaah_id, handed_over_at, notes)
                VALUES (?, 1, ?, ?, CURRENT_TIMESTAMP, ?)
              `).run(
                masterItem.inventory_item_id,
                booking.transaction_id,
                jamaah_id,
                `Diserahkan ke jamaah #${jamaah_id} - ${masterItem.item_name}`,
              );
              const hasil = catatHppPenyerahan(
                db, Number(info.lastInsertRowid), masterItem.inventory_item_id, 1,
                `Checklist: ${masterItem.item_name}`, booking.transaction_id,
              );
              hppDicatat = hasil.nilai;
            }
          });
          simpan();
        } else if (sebelumnyaNaik && turun) {
          // Dikembalikan: stok pulih dan baris penyerahan terakhir dicabut.
          const simpan = db.transaction(() => {
            db.prepare('UPDATE inventory_items SET stock_total = stock_total + 1 WHERE id = ?')
              .run(masterItem.inventory_item_id);
            const terakhir = db
              .prepare(`SELECT id FROM inventory_handover WHERE item_id = ? AND jamaah_id = ? ORDER BY id DESC LIMIT 1`)
              .get(masterItem.inventory_item_id, jamaah_id) as { id: number } | undefined;
            if (terakhir) {
              // Ledger HPP harus ikut hilang agar beban tidak menggantung.
              hapusHppPenyerahan(db, terakhir.id);
              db.prepare('DELETE FROM inventory_handover WHERE id = ?').run(terakhir.id);
            }
          });
          simpan();
        }
      }

      return NextResponse.json({
        success: true,
        message: hppDicatat > 0
          ? `Status checklist diperbarui. HPP Rp ${hppDicatat.toLocaleString('id-ID')} dijurnal.`
          : 'Status checklist berhasil diperbarui',
        hpp: hppDicatat,
      });
    }

    if (action === 'SAVE_MASTER') {
      { const cek = await requirePermission(request, 'checklist.update'); if (!cek.ok) return cek.response; }
      const { id, category, item_code, item_name, is_inventory_linked, inventory_item_id, is_mandatory } = body;
      if (!category || !item_code || !item_name) {
        return NextResponse.json({ success: false, message: 'Kategori, kode, dan nama item wajib diisi' }, { status: 400 });
      }

      if (id) {
        db.prepare(`
          UPDATE checklist_master SET category = ?, item_code = ?, item_name = ?, is_inventory_linked = ?, inventory_item_id = ?, is_mandatory = ?
          WHERE id = ?
        `).run(category, item_code, item_name, is_inventory_linked ? 1 : 0, inventory_item_id || null, is_mandatory ? 1 : 0, id);
        return NextResponse.json({ success: true, message: 'Master checklist diperbarui' });
      } else {
        db.prepare(`
          INSERT INTO checklist_master (category, item_code, item_name, is_inventory_linked, inventory_item_id, is_mandatory)
          VALUES (?, ?, ?, ?, ?, ?)
        `).run(category, item_code, item_name, is_inventory_linked ? 1 : 0, inventory_item_id || null, is_mandatory ? 1 : 0);
        return NextResponse.json({ success: true, message: 'Master checklist ditambahkan' });
      }
    }

    if (action === 'DELETE_MASTER') {
      { const cek = await requirePermission(request, 'checklist.update'); if (!cek.ok) return cek.response; }
      const { id } = body;
      db.prepare('DELETE FROM checklist_master WHERE id = ?').run(id);
      return NextResponse.json({ success: true, message: 'Master checklist dihapus' });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak dikenali' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
