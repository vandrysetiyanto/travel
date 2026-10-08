import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';

const dbDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const dbPath = path.join(dbDir, 'travel.db');
const db = new Database(dbPath);

db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as any[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

function ensureIndex(name: string, sql: string) {
  const exists = db.prepare(`SELECT name FROM sqlite_master WHERE type='index' AND name = ?`).get(name);
  if (!exists) db.exec(sql);
}

export function initDB() {
  db.exec(`
    
    CREATE TABLE IF NOT EXISTS company_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      company_name TEXT NOT NULL DEFAULT 'Al-Barakah Tour & Travel',
      legal_name TEXT DEFAULT 'PT. Al-Barakah Mandiri Utama',
      ppiu_number TEXT DEFAULT 'Izin Kemenag No. 123/PPIU/2024',
      address TEXT DEFAULT 'Jl. Jenderal Sudirman No. 45, Jakarta Selatan',
      phone TEXT DEFAULT '0812-3456-7890',
      email TEXT DEFAULT 'info@albarakah.co.id',
      website TEXT DEFAULT 'travel.idigivice.com',
      director_name TEXT DEFAULT 'H. Fachrul Kurniawan',
      city TEXT DEFAULT 'Jakarta Selatan',
      tagline TEXT DEFAULT 'Melayani Ibadah Umroh & Haji Penuh Amanah',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS bank_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      bank_name TEXT NOT NULL,
      account_number TEXT NOT NULL,
      account_holder TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'ADMIN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS master_jamaah (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nik TEXT UNIQUE NOT NULL,
      no_kk TEXT,
      full_name TEXT NOT NULL,
      gender TEXT NOT NULL DEFAULT 'L',
      birth_place TEXT,
      birth_date TEXT,
      phone TEXT,
      email TEXT,
      address TEXT,
      passport_number TEXT,
      passport_expiry TEXT,
      passport_status TEXT NOT NULL DEFAULT 'BELUM',
      marriage_doc_status TEXT NOT NULL DEFAULT 'BELUM',
      visa_status TEXT NOT NULL DEFAULT 'BELUM',
      ktp_image_url TEXT,
      kk_image_url TEXT,
      group_code TEXT,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS packages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Umroh Reguler',
      description TEXT,
      duration_days INTEGER NOT NULL DEFAULT 9,
      price INTEGER NOT NULL,
      hotel_makkah TEXT,
      hotel_madinah TEXT,
      airline TEXT,
      departure_city TEXT DEFAULT 'Jakarta (CGK)',
      image_url TEXT,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS batches (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      package_id INTEGER NOT NULL,
      batch_name TEXT NOT NULL,
      departure_date TEXT NOT NULL,
      return_date TEXT NOT NULL,
      quota INTEGER NOT NULL DEFAULT 45,
      status TEXT NOT NULL DEFAULT 'OPEN',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      booking_code TEXT UNIQUE NOT NULL,
      jamaah_id INTEGER NOT NULL,
      batch_id INTEGER NOT NULL,
      total_amount INTEGER NOT NULL,
      paid_amount INTEGER NOT NULL DEFAULT 0,
      remaining_amount INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      total_pilgrims INTEGER NOT NULL DEFAULT 1,
      notes TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (jamaah_id) REFERENCES master_jamaah(id) ON DELETE RESTRICT,
      FOREIGN KEY (batch_id) REFERENCES batches(id) ON DELETE RESTRICT
    );

    CREATE TABLE IF NOT EXISTS payment_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      receipt_number TEXT UNIQUE NOT NULL,
      amount INTEGER NOT NULL,
      payment_type TEXT NOT NULL DEFAULT 'CASH',
      payment_phase TEXT NOT NULL DEFAULT 'DP',
      bank_name TEXT,
      account_name TEXT,
      proof_image TEXT,
      status TEXT NOT NULL DEFAULT 'APPROVED',
      notes TEXT,
      created_by TEXT DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS inventory_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'Perlengkapan',
      stock_total INTEGER NOT NULL DEFAULT 0,
      unit TEXT NOT NULL DEFAULT 'Pcs',
      description TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS inventory_handover (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      item_id INTEGER NOT NULL,
      qty INTEGER NOT NULL DEFAULT 1,
      status TEXT NOT NULL DEFAULT 'DISERAHKAN',
      handed_over_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (item_id) REFERENCES inventory_items(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS checklist_master (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category TEXT NOT NULL,
      item_code TEXT NOT NULL UNIQUE,
      item_name TEXT NOT NULL,
      is_inventory_linked INTEGER DEFAULT 0,
      inventory_item_id INTEGER,
      is_mandatory INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS jamaah_checklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      jamaah_id INTEGER NOT NULL,
      checklist_master_id INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'BELUM',
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      notes TEXT,
      FOREIGN KEY (jamaah_id) REFERENCES master_jamaah(id) ON DELETE CASCADE,
      FOREIGN KEY (checklist_master_id) REFERENCES checklist_master(id) ON DELETE CASCADE,
      UNIQUE(jamaah_id, checklist_master_id)
    );

    CREATE TABLE IF NOT EXISTS chart_of_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coa_code TEXT NOT NULL UNIQUE,
      coa_name TEXT NOT NULL,
      coa_type TEXT NOT NULL,
      coa_group TEXT NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS expenses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coa_account_id INTEGER NOT NULL,
      expense_date TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT,
      payment_method TEXT DEFAULT 'TRANSFER',
      reference TEXT,
      notes TEXT,
      created_by TEXT DEFAULT 'Admin',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coa_account_id) REFERENCES chart_of_accounts(id)
    );

    CREATE TABLE IF NOT EXISTS ledger (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      coa_account_id INTEGER NOT NULL,
      transaction_id INTEGER,
      expense_id INTEGER,
      entry_type TEXT NOT NULL,
      amount INTEGER NOT NULL,
      description TEXT,
      entry_date TEXT NOT NULL,
      reference TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (coa_account_id) REFERENCES chart_of_accounts(id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (expense_id) REFERENCES expenses(id) ON DELETE CASCADE
    );

  `

);

  // Migrasi kolom untuk database yang sudah berjalan (aman diulang).
  ensureColumn('master_jamaah', 'group_code', 'group_code TEXT');
  ensureColumn('transactions', 'total_pilgrims', 'total_pilgrims INTEGER NOT NULL DEFAULT 1');
  ensureIndex('idx_jamaah_group', 'CREATE INDEX IF NOT EXISTS idx_jamaah_group ON master_jamaah(group_code)');
  ensureIndex('idx_tx_booking', 'CREATE INDEX IF NOT EXISTS idx_tx_booking ON transactions(booking_code)');

  // Migrate older registrations to new schema if table exists
  try {
    const checkOldRegs = db.prepare(`SELECT count(*) as c FROM sqlite_master WHERE type='table' AND name='registrations'`).get() as any;
    if (checkOldRegs && checkOldRegs.c > 0) {
      const oldRegs = db.prepare(`SELECT * FROM registrations`).all() as any[];
      for (const reg of oldRegs) {
        const pilgrim = db.prepare(`SELECT * FROM pilgrims WHERE registration_id = ?`).get(reg.id) as any;
        if (pilgrim) {
          let jId: number;
          const existJ = db.prepare('SELECT id FROM master_jamaah WHERE nik = ?').get(pilgrim.nik) as any;
          if (existJ) {
            jId = existJ.id;
          } else {
            const insJ = db.prepare(`
              INSERT INTO master_jamaah (nik, no_kk, full_name, gender, birth_place, birth_date, phone, email, address, passport_number, ktp_image_url)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `).run(pilgrim.nik, pilgrim.no_kk || '', pilgrim.full_name, pilgrim.gender || 'L', pilgrim.birth_place || '', pilgrim.birth_date || '', pilgrim.phone || reg.applicant_phone, reg.applicant_email || '', pilgrim.address || '', pilgrim.passport_number || '', pilgrim.ktp_image_url || '');
            jId = Number(insJ.lastInsertRowid);
          }

          const existTx = db.prepare('SELECT id FROM transactions WHERE booking_code = ?').get(reg.booking_code);
          if (!existTx) {
            const insTx = db.prepare(`
              INSERT INTO transactions (booking_code, jamaah_id, batch_id, total_amount, paid_amount, remaining_amount, status, created_at)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `).run(reg.booking_code, jId, reg.batch_id, reg.total_amount, reg.paid_amount, reg.remaining_amount, reg.payment_status, reg.created_at);
            const txId = Number(insTx.lastInsertRowid);

            const oldPays = db.prepare(`SELECT * FROM payments WHERE registration_id = ?`).all(reg.id) as any[];
            for (const p of oldPays) {
              db.prepare(`
                INSERT INTO payment_history (transaction_id, receipt_number, amount, payment_type, payment_phase, bank_name, account_name, proof_image, status, notes, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
              `).run(txId, p.payment_number, p.amount, p.payment_type || 'CASH', p.payment_phase || 'DP', p.bank_name || '', p.account_name || '', p.proof_image || '', p.status || 'APPROVED', p.notes || '', p.created_at);
            }
          }
        }
      }
    }
  } catch (err) {
    console.log('Migration note:', err);
  }


  // Seed company profile
  const checkProfile = db.prepare('SELECT COUNT(*) as count FROM company_profile').get() as { count: number };
  if (checkProfile.count === 0) {
    db.prepare(`
      INSERT INTO company_profile (id, company_name, legal_name, ppiu_number, address, phone, email, website, director_name, city, tagline)
      VALUES (1, 'Al-Barakah Tour & Travel', 'PT. Al-Barakah Mandiri Utama', 'Izin Kemenag No. 123/PPIU/2024', 'Jl. Jenderal Sudirman No. 45, Jakarta Selatan', '0812-3456-7890', 'info@albarakah.co.id', 'travel.idigivice.com', 'H. Fachrul Kurniawan', 'Jakarta Selatan', 'Melayani Ibadah Umroh & Haji Penuh Amanah')
    `).run();
  }

  // Seed default bank accounts
  const checkBank = db.prepare('SELECT COUNT(*) as count FROM bank_accounts').get() as { count: number };
  if (checkBank.count === 0) {
    db.prepare(`
      INSERT INTO bank_accounts (bank_name, account_number, account_holder)
      VALUES 
        ('Bank Syariah Indonesia (BSI)', '7123456789', 'PT AL BARAKAH MANDIRI'),
        ('Bank Mandiri', '1230009876543', 'PT AL BARAKAH MANDIRI')
    `).run();
  }

  // Admin & Owner user seed
  const checkOwner = db.prepare(`SELECT COUNT(*) as count FROM users WHERE role = 'OWNER'`).get() as { count: number };
  if (checkOwner.count === 0) {
    db.prepare(`
      INSERT INTO users (name, email, password, role) 
      VALUES (?, ?, ?, ?)
    `).run('Owner / Direktur Travel', 'owner@travel.com', 'owner123', 'OWNER');
  }

  const checkAdmin = db.prepare(`SELECT COUNT(*) as count FROM users WHERE email = 'admin@travel.com'`).get() as { count: number };
  if (checkAdmin.count === 0) {
    db.prepare(`
      INSERT INTO users (name, email, password, role) 
      VALUES (?, ?, ?, ?)
    `).run('Staff Admin Operasional', 'admin@travel.com', 'admin123', 'ADMIN');
  } else {
    db.prepare(`UPDATE users SET role = 'ADMIN' WHERE email = 'admin@travel.com' AND role = 'SUPERADMIN'`).run();
  }

  // Seed default packages if empty
  const checkPackages = db.prepare('SELECT COUNT(*) as count FROM packages').get() as { count: number };
  if (checkPackages.count === 0) {
    const insertPackage = db.prepare(`
      INSERT INTO packages (name, category, description, duration_days, price, hotel_makkah, hotel_madinah, airline, departure_city)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const p1 = insertPackage.run(
      'Paket Umroh Reguler Berkah 9 Hari',
      'Umroh Reguler',
      'Paket ibadah umroh standar bintang 4 dengan fasilitas lengkap dan bimbingan muthawif bersertifikat.',
      9,
      29500000,
      'Pullman Zamzam Makkah (★4)',
      'Movenpick Madinah (★4)',
      'Saudia Airlines Direct',
      'Jakarta (CGK)'
    );

    const p2 = insertPackage.run(
      'Paket Umroh VIP Bintang 5 Plus Kereta Cepat 12 Hari',
      'Umroh VIP',
      'Kenyamanan ibadah maksimal dengan akomodasi hotel bintang 5 depan Masjidil Haram dan Kereta Cepat Haramain.',
      12,
      38500000,
      'Fairmont Clock Royal Tower (★5)',
      'Dar Al Taqwa Madinah (★5)',
      'Garuda Indonesia Direct',
      'Jakarta (CGK)'
    );

    const insertBatch = db.prepare(`
      INSERT INTO batches (package_id, batch_name, departure_date, return_date, quota, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    insertBatch.run(p1.lastInsertRowid, 'Batch 1 - Awal Musim 2026', '2026-10-15', '2026-10-24', 45, 'OPEN');
    insertBatch.run(p1.lastInsertRowid, 'Batch 2 - Akhir Syawal 2026', '2026-11-10', '2026-11-19', 45, 'OPEN');
    insertBatch.run(p2.lastInsertRowid, 'Batch VIP - Musim Liburan', '2026-12-20', '2027-01-01', 35, 'OPEN');
  }

  // Seed default inventory items if empty
  const checkInventory = db.prepare('SELECT COUNT(*) as count FROM inventory_items').get() as { count: number };
  if (checkInventory.count === 0) {
    const insertInv = db.prepare(`
      INSERT INTO inventory_items (code, name, category, stock_total, unit, description)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    insertInv.run('KPR-01', 'Koper Kabin & Bagasi 24"', 'Koper', 100, 'Pcs', 'Koper Fiber Set Al-Barakah');
    insertInv.run('IHR-01', 'Kain Ihram Pria', 'Pakaian', 80, 'Pcs', 'Kain Ihram Handuk Premium');
    insertInv.run('MKN-01', 'Mukena Atasan & Bawahan', 'Pakaian', 80, 'Set', 'Mukena Katun Bordir Travel');
    insertInv.run('BTK-01', 'Batik Seragam Jamaah', 'Pakaian', 150, 'Meter', 'Kain Batik Resmi Travel');
    insertInv.run('TAS-01', 'Tas Paspor & Selempang', 'Aksesoris', 120, 'Pcs', 'Tas kecil tempat dokumen paspor');
    insertInv.run('BUK-01', 'Buku Panduan Doa & Zikir', 'Buku', 200, 'Pcs', 'Buku panduan manasik umroh');
  }

  // Seed Chart of Accounts
  const checkCOA = db.prepare('SELECT COUNT(*) as count FROM chart_of_accounts').get() as { count: number };
  if (checkCOA.count === 0) {
    const coa = db.prepare(`
      INSERT INTO chart_of_accounts (coa_code, coa_name, coa_type, coa_group)
      VALUES (?, ?, ?, ?)
    `);
    // 1. ASET (1000-1999)
    coa.run('1-101', 'Kas & Bank', 'Aset Lancar', 'Aset');
    coa.run('1-102', 'Piutang Jamaah', 'Aset Lancar', 'Aset');
    coa.run('1-103', 'Persediaan / Inventory', 'Aset Lancar', 'Aset');
    coa.run('1-104', 'Peralatan Kantor', 'Aset Tetap', 'Aset');
    // 2. LIABILITAS (2000-2999)
    coa.run('2-101', 'Utang Vendor', 'Liabilitas Jangka Pendek', 'Liabilitas');
    // 3. EKUITAS (3000-3999)
    coa.run('3-101', 'Modal Pemilik', 'Ekuitas', 'Ekuitas');
    coa.run('3-102', 'Laba Ditahan', 'Ekuitas', 'Ekuitas');
    // 4. PENDAPATAN (4000-4999)
    coa.run('4-101', 'Pendapatan Paket Umroh', 'Pendapatan Operasional', 'Pendapatan');
    coa.run('4-102', 'Pendapatan Jasa Tambahan', 'Pendapatan Operasional', 'Pendapatan');
    // 5. BEBAN OPERASIONAL (5000-5999)
    coa.run('5-101', 'Beban Hotel & Akomodasi', 'Beban Operasional', 'Beban');
    coa.run('5-102', 'Beban Tiket Pesawat', 'Beban Operasional', 'Beban');
    coa.run('5-103', 'Beban Muthawif & Pemandu', 'Beban Operasional', 'Beban');
    coa.run('5-104', 'Beban Visa & Pengurusan', 'Beban Operasional', 'Beban');
    coa.run('5-105', 'Beban Transport Lokal', 'Beban Operasional', 'Beban');
    coa.run('5-106', 'Beban Marketing & Administrasi', 'Beban Operasional', 'Beban');
    coa.run('5-107', 'Beban Lain-Lain', 'Beban Operasional', 'Beban');
  }
}

initDB();

  // Seed Checklist Master
  const checkCM = db.prepare('SELECT COUNT(*) as count FROM checklist_master').get() as { count: number };
  if (checkCM.count === 0) {
    const cm = db.prepare(`
      INSERT INTO checklist_master (category, item_code, item_name, is_inventory_linked, inventory_item_id, is_mandatory)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    cm.run('Dokumen', 'DOC_PASPOR', 'Paspor Asli (Valid > 6 Bulan)', 0, null, 1);
    cm.run('Dokumen', 'DOC_VISA', 'Visa Umroh Approved', 0, null, 1);
    cm.run('Dokumen', 'DOC_VAKSIN', 'Sertifikat Vaksin Meningitis / Polio', 0, null, 1);
    cm.run('Dokumen', 'DOC_SEHAT', 'Surat Keterangan Sehat', 0, null, 0);
    cm.run('Dokumen', 'DOC_FOTO', 'Pas Foto Latar Putih 4x6 (4 lbr)', 0, null, 1);
    cm.run('Finansial', 'FIN_DP', 'Pembayaran Uang Muka (DP)', 0, null, 1);
    cm.run('Finansial', 'FIN_LUNAS', 'Pelunasan Biaya Paket', 0, null, 1);
    cm.run('Finansial', 'FIN_KONTRAK', 'Surat Perjanjian Umroh (E-Sign)', 0, null, 1);
    cm.run('Logistik', 'LOG_SERAGAM', 'Seragam Batik Resmi Travel', 1, 1, 1);
    cm.run('Logistik', 'LOG_KOPER', 'Koper Utama & Kabin Set', 1, 2, 1);
    cm.run('Logistik', 'LOG_BUKU', 'Buku Panduan Doa & Zikir', 1, 3, 1);
    cm.run('Logistik', 'LOG_SYAL', 'Syal / Atribut Identitas', 0, null, 0);
    cm.run('Manasik', 'MAN_HADIR', 'Kehadiran Manasik Umroh', 0, null, 1);
  }


export default db;
