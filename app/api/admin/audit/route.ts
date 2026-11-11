import { NextResponse } from 'next/server';
import db, { initDB } from '@/lib/db';
import { requirePermission } from '@/lib/permissions';

initDB();

/**
 * Jejak audit (halaman "Log Aktivitas").
 *
 * GET /api/admin/audit?module=&action=&q=&limit=&offset=
 * Hanya pemegang `audit.read` (default: OWNER).
 */
export async function GET(req: Request) {
  const auth = await requirePermission(req, 'audit.read');
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const moduleQ = searchParams.get('module');
    const actionQ = searchParams.get('action');
    const q = searchParams.get('q');
    const limit = Math.min(Number(searchParams.get('limit') || 100), 500);
    const offset = Math.max(Number(searchParams.get('offset') || 0), 0);

    const syarat: string[] = [];
    const params: any[] = [];
    if (moduleQ && moduleQ !== 'ALL') { syarat.push('module = ?'); params.push(moduleQ); }
    if (actionQ && actionQ !== 'ALL') { syarat.push('action = ?'); params.push(actionQ); }
    if (q) {
      syarat.push('(user_email LIKE ? OR record_id LIKE ? OR notes LIKE ? OR before_json LIKE ? OR after_json LIKE ?)');
      const term = `%${q}%`;
      params.push(term, term, term, term, term);
    }
    const where = syarat.length ? `WHERE ${syarat.join(' AND ')}` : '';

    const total = (db.prepare(`SELECT COUNT(*) c FROM audit_log ${where}`).get(...params) as { c: number }).c;
    const rows = db.prepare(`SELECT * FROM audit_log ${where} ORDER BY id DESC LIMIT ? OFFSET ?`).all(...params, limit, offset);

    const modul = (db.prepare('SELECT DISTINCT module FROM audit_log ORDER BY module').all() as { module: string }[]).map((m) => m.module);
    const aksi = (db.prepare('SELECT DISTINCT action FROM audit_log ORDER BY action').all() as { action: string }[]).map((a) => a.action);

    return NextResponse.json({ success: true, total, rows, modul, aksi, limit, offset });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
