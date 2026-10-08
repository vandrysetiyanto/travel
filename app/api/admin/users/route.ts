import { NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import db, { initDB } from '@/lib/db';
import { requireOwner } from '@/lib/auth';

initDB();

/** Daftar staf — hanya OWNER. */
export async function GET(req: Request) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  try {
    const users = db.prepare('SELECT id, name, email, role, created_at FROM users ORDER BY created_at DESC').all();
    return NextResponse.json({ success: true, users });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

/** Kelola staf — hanya OWNER. Password SELALU disimpan sebagai hash bcrypt. */
export async function POST(req: Request) {
  const auth = await requireOwner(req);
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { action } = body;

    if (action === 'CREATE_USER') {
      const { name, email, password, role } = body;
      if (!name || !email || !password) {
        return NextResponse.json({ success: false, message: 'Nama, email, dan password wajib diisi' }, { status: 400 });
      }
      if (String(password).length < 8) {
        return NextResponse.json({ success: false, message: 'Password minimal 8 karakter' }, { status: 400 });
      }
      const cleanEmail = String(email).trim().toLowerCase();
      const exist = db.prepare('SELECT id FROM users WHERE email = ?').get(cleanEmail);
      if (exist) {
        return NextResponse.json({ success: false, message: 'Email sudah terdaftar' }, { status: 400 });
      }
      db.prepare('INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)').run(
        name,
        cleanEmail,
        bcrypt.hashSync(String(password), 10),
        role === 'OWNER' ? 'OWNER' : 'ADMIN'
      );
      return NextResponse.json({ success: true, message: 'User berhasil dibuat' });
    }

    if (action === 'UPDATE_USER') {
      const { id, name, email, password, role } = body;
      const cleanEmail = String(email).trim().toLowerCase();

      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
      if (target && target.role === 'OWNER' && role !== 'OWNER') {
        const owners = db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'OWNER'`).get() as any;
        if (owners.c <= 1) {
          return NextResponse.json({ success: false, message: 'Tidak dapat menurunkan role satu-satunya akun Owner' }, { status: 400 });
        }
      }

      if (password) {
        if (String(password).length < 8) {
          return NextResponse.json({ success: false, message: 'Password minimal 8 karakter' }, { status: 400 });
        }
        db.prepare('UPDATE users SET name = ?, email = ?, password = ?, role = ? WHERE id = ?').run(
          name,
          cleanEmail,
          bcrypt.hashSync(String(password), 10),
          role,
          id
        );
      } else {
        db.prepare('UPDATE users SET name = ?, email = ?, role = ? WHERE id = ?').run(name, cleanEmail, role, id);
      }
      return NextResponse.json({ success: true, message: 'User berhasil diperbarui' });
    }

    if (action === 'DELETE_USER') {
      const { id } = body;
      const count = db.prepare(`SELECT COUNT(*) as c FROM users WHERE role = 'OWNER'`).get() as any;
      const target = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as any;
      if (target?.role === 'OWNER' && count.c <= 1) {
        return NextResponse.json({ success: false, message: 'Tidak dapat menghapus satu-satunya akun Owner' }, { status: 400 });
      }
      if (Number(id) === auth.user?.uid) {
        return NextResponse.json({ success: false, message: 'Tidak dapat menghapus akun Anda sendiri' }, { status: 400 });
      }
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
      return NextResponse.json({ success: true, message: 'User berhasil dihapus' });
    }

    return NextResponse.json({ success: false, message: 'Action tidak valid' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
