import { NextResponse } from 'next/server';
import db from '@/lib/db';
import { requirePermission, catatAudit } from '@/lib/permissions';

/**
 * Role yang dipakai user tetapi tidak ada di tabel roles.
 *
 * Sebelumnya sinkronRBAC() diam-diam menimpanya menjadi VIEWER saat boot. Itu
 * bertentangan dengan default-deny di permissionsOf(): salah ketik role atau
 * role yang baru dihapus justru memberi 7 izin baca (jamaah, booking,
 * pembayaran) tanpa pernah muncul sebagai masalah.
 *
 * Sekarang: role dibiarkan apa adanya (= 0 izin), dan ditampilkan di sini agar
 * pemilik bisa memutuskan — dilengkapi tombol perbaiki yang eksplisit.
 */
export async function GET(req: Request) {
  const auth = await requirePermission(req, 'staff.manage');
  if (!auth.ok) return auth.response;

  const dikenal = new Set((db.prepare('SELECT code FROM roles').all() as { code: string }[]).map((r) => r.code));

  const users = db
    .prepare('SELECT id, name, email, role FROM users ORDER BY id')
    .all() as { id: number; name: string; email: string; role: string }[];

  const yatim = users
    .filter((u) => !dikenal.has(String(u.role || '').trim().toUpperCase()))
    .map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      izin: 0, // default deny: role tak dikenal tidak memberi izin apa pun
    }));

  return NextResponse.json({
    success: true,
    jumlah: yatim.length,
    users: yatim,
    rolesTersedia: Array.from(dikenal).sort(),
  });
}

/**
 * Perbaiki role user yang tidak dikenal — TINDAKAN EKSPLISIT, bukan otomatis.
 * Body: { userId, role }  atau  { semua: true, role }
 */
export async function POST(req: Request) {
  const auth = await requirePermission(req, 'staff.manage');
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const roleBaru = String(body.role || '').trim().toUpperCase();
    if (!roleBaru) {
      return NextResponse.json({ success: false, message: 'Role tujuan wajib dipilih.' }, { status: 400 });
    }
    const ada = db.prepare('SELECT id FROM roles WHERE code = ?').get(roleBaru) as { id: number } | undefined;
    if (!ada) {
      return NextResponse.json({ success: false, message: `Role ${roleBaru} tidak terdaftar.` }, { status: 400 });
    }

    const dikenal = new Set((db.prepare('SELECT code FROM roles').all() as { code: string }[]).map((r) => r.code));
    let target: { id: number; email: string; role: string }[] = [];

    if (body.semua === true) {
      target = (db.prepare('SELECT id, email, role FROM users').all() as any[])
        .filter((u) => !dikenal.has(String(u.role || '').trim().toUpperCase()));
    } else {
      const uid = Number(body.userId);
      if (!uid) return NextResponse.json({ success: false, message: 'userId tidak valid.' }, { status: 400 });
      const u = db.prepare('SELECT id, email, role FROM users WHERE id = ?').get(uid) as any;
      if (!u) return NextResponse.json({ success: false, message: 'User tidak ditemukan.' }, { status: 404 });
      target = [u];
    }

    if (!target.length) {
      return NextResponse.json({ success: true, message: 'Tidak ada role menggantung untuk diperbaiki.' });
    }

    const upd = db.prepare('UPDATE users SET role = ? WHERE id = ?');
    db.transaction(() => {
      for (const u of target) {
        upd.run(roleBaru, u.id);
        catatAudit({
          user: auth.user,
          action: 'UPDATE',
          module: 'user_role',
          recordId: String(u.id),
          before: { email: u.email, role: u.role },
          after: { email: u.email, role: roleBaru },
          notes: 'Perbaikan role menggantung (eksplisit oleh admin)',
        });
      }
    })();

    return NextResponse.json({
      success: true,
      message: `${target.length} pengguna diperbaiki menjadi ${roleBaru}.`,
      diperbaiki: target.map((u) => ({ id: u.id, email: u.email, dari: u.role, ke: roleBaru })),
    });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
