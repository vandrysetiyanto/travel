import { NextRequest, NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requireAdmin, requireOwner } from '@/lib/auth';
import { requirePermission } from '@/lib/permissions';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const auth = await requirePermission(req, 'settings.manage');
  if (!auth.ok) return auth.response;

  try {
    initDB();
    const profile = db.prepare('SELECT * FROM company_profile WHERE id = 1').get() || {};
    const bankAccounts = db.prepare('SELECT * FROM bank_accounts ORDER BY id ASC').all() || [];
    return NextResponse.json({ success: true, profile, bankAccounts });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requirePermission(req, 'settings.manage');
  if (!auth.ok) return auth.response;

  try {
    initDB();
    const body = await req.json();
    const { action, profile, bank } = body;

    if (action === 'UPDATE_PROFILE' && profile) {
      db.prepare(`
        INSERT INTO company_profile (id, company_name, legal_name, ppiu_number, address, phone, email, website, director_name, city, tagline, updated_at)
        VALUES (1, @company_name, @legal_name, @ppiu_number, @address, @phone, @email, @website, @director_name, @city, @tagline, CURRENT_TIMESTAMP)
        ON CONFLICT(id) DO UPDATE SET
          company_name = excluded.company_name,
          legal_name = excluded.legal_name,
          ppiu_number = excluded.ppiu_number,
          address = excluded.address,
          phone = excluded.phone,
          email = excluded.email,
          website = excluded.website,
          director_name = excluded.director_name,
          city = excluded.city,
          tagline = excluded.tagline,
          updated_at = CURRENT_TIMESTAMP
      `).run(profile);
      return NextResponse.json({ success: true, message: 'Profil perusahaan berhasil diperbarui' });
    }

    if (action === 'ADD_BANK' && bank) {
      db.prepare(`
        INSERT INTO bank_accounts (bank_name, account_number, account_holder)
        VALUES (@bank_name, @account_number, @account_holder)
      `).run(bank);
      return NextResponse.json({ success: true, message: 'Rekening bank berhasil ditambahkan' });
    }

    if (action === 'DELETE_BANK' && body.id) {
      db.prepare('DELETE FROM bank_accounts WHERE id = ?').run(body.id);
      return NextResponse.json({ success: true, message: 'Rekening bank berhasil dihapus' });
    }

    return NextResponse.json({ success: false, message: 'Aksi tidak valid' }, { status: 400 });
  } catch (err: any) {
    return NextResponse.json({ success: false, message: err.message }, { status: 500 });
  }
}
