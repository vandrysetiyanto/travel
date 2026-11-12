import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';
import { catatHppPenyerahan } from '@/lib/persediaan';

initDB();

export async function GET(request: Request) {
  const auth = await requirePermission(request, 'inventory.read');
  if (!auth.ok) return auth.response;

  try {
    const items = db.prepare('SELECT * FROM inventory_items ORDER BY created_at DESC').all();
    const handovers = db.prepare(`
      SELECT h.*, i.name as item_name, i.code as item_code, i.unit,
             j.full_name as jamaah_name, j.nik, t.booking_code
      FROM inventory_handover h
      JOIN inventory_items i ON h.item_id = i.id
      JOIN transactions t ON h.transaction_id = t.id
      JOIN master_jamaah j ON t.jamaah_id = j.id
      ORDER BY h.handed_over_at DESC
    `).all();

    return NextResponse.json({ success: true, items, handovers });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const auth = await requireAdmin(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'ADD_ITEM') {
      { const cek = await requirePermission(req, 'inventory.create'); if (!cek.ok) return cek.response; }
      const { code, name, category, stock_total, unit, description, unit_cost } = body;
      if (!code || !name) {
        return NextResponse.json({ success: false, message: 'Kode dan nama barang wajib diisi' }, { status: 400 });
      }
      db.prepare(`
        INSERT INTO inventory_items (code, name, category, stock_total, unit, description, unit_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(
        code, name, category || 'Perlengkapan', Number(stock_total) || 0, unit || 'Pcs', description || '',
        Math.max(0, Math.round(Number(unit_cost) || 0)),
      );
      return NextResponse.json({ success: true, message: 'Barang berhasil ditambahkan' });
    }

    if (action === 'UPDATE_STOCK') {
      { const cek = await requirePermission(req, 'inventory.update'); if (!cek.ok) return cek.response; }
      const { item_id, stock_total, unit_cost } = body;
      if (unit_cost !== undefined && unit_cost !== null && unit_cost !== '') {
        db.prepare('UPDATE inventory_items SET stock_total = ?, unit_cost = ? WHERE id = ?')
          .run(Number(stock_total), Math.max(0, Math.round(Number(unit_cost) || 0)), item_id);
      } else {
        db.prepare('UPDATE inventory_items SET stock_total = ? WHERE id = ?').run(Number(stock_total), item_id);
      }
      return NextResponse.json({ success: true, message: 'Stok berhasil diperbarui' });
    }

    if (action === 'HANDOVER') {
      { const cek = await requirePermission(req, 'inventory.update'); if (!cek.ok) return cek.response; }
      const { transaction_id, item_id, qty, notes } = body;
      if (!transaction_id || !item_id) {
        return NextResponse.json({ success: false, message: 'Transaksi dan Barang wajib dipilih' }, { status: 400 });
      }
      const item = db.prepare('SELECT * FROM inventory_items WHERE id = ?').get(item_id) as any;
      const countQty = Number(qty) || 1;
      if (!item || item.stock_total < countQty) {
        return NextResponse.json({ success: false, message: 'Stok barang tidak mencukupi' }, { status: 400 });
      }
      /*
       * Stok keluar + HPP dicatat dalam SATU transaksi.
       *
       * Sebelumnya unit_cost tidak pernah dibaca, jadi nilai seragam/koper yang
       * diserahkan ke jamaah tidak pernah masuk laporan keuangan. Sekarang nilai
       * qty x unit_cost dijurnal (Dr Beban Perlengkapan / Cr Persediaan) dan
       * ditautkan ke baris penyerahan lewat ledger.handover_id.
       */
      let hpp = 0;
      let catatanHpp = '';
      const proses = db.transaction(() => {
        db.prepare('UPDATE inventory_items SET stock_total = stock_total - ? WHERE id = ?').run(countQty, item_id);
        const info = db.prepare(`
          INSERT INTO inventory_handover (transaction_id, item_id, qty, notes)
          VALUES (?, ?, ?, ?)
        `).run(transaction_id, item_id, countQty, notes || '');

        const hasil = catatHppPenyerahan(
          db, Number(info.lastInsertRowid), item_id, countQty,
          'Penyerahan perlengkapan jamaah', transaction_id,
        );
        hpp = hasil.nilai;
        catatanHpp = hasil.alasan || '';
      });
      proses();

      return NextResponse.json({
        success: true,
        message: hpp > 0
          ? `Penyerahan barang dicatat. HPP Rp ${hpp.toLocaleString('id-ID')} dijurnal.`
          : `Penyerahan barang dicatat. HPP belum dijurnal: ${catatanHpp}`,
        hpp,
      });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}