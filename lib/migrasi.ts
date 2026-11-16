/**
 * Migration runner — versi skema yang terlacak.
 *
 * MASALAH YANG DIPERBAIKI:
 * Sebelumnya perubahan skema dilakukan lewat 12 pemanggilan `ensureColumn` yang
 * tersebar di lib/db.ts (653 baris), `PRAGMA user_version` tetap 0, dan tidak ada
 * catatan versi mana yang sudah dijalankan. Akibatnya:
 *   - tidak ada cara tahu skema database produksi sudah sampai versi berapa
 *   - tidak ada rollback / jejak urutan perubahan
 *   - perubahan berisiko (rename, ubah tipe, backfill) tidak bisa direncanakan
 *
 * CARA KERJA:
 *   - setiap perubahan = satu entri berurutan di MIGRATIONS (nomor 1..N)
 *   - `PRAGMA user_version` menyimpan nomor terakhir yang sudah diterapkan
 *   - hanya migrasi dengan nomor > user_version yang dijalankan
 *   - setiap migrasi berjalan DALAM SATU transaksi: gagal = dibatalkan semua
 *   - hasil dicatat ke tabel `schema_migrations` (siapa, kapan, berapa lama)
 *
 * ATURAN PENULISAN MIGRASI:
 *   - WAJIB idempoten (aman bila dijalankan ulang pada DB yang sudah setengah jalan)
 *   - JANGAN mengubah migrasi yang sudah pernah dirilis — tambahkan nomor baru
 *   - JANGAN pernah menghapus kolom/tabel berisi data produksi tanpa rencana ekspor
 */
import type Database from 'better-sqlite3';

export type Migrasi = {
  nomor: number;
  nama: string;
  jalankan: (db: Database.Database) => void;
};

/** Daftar migrasi — urut naik, tidak boleh ada nomor yang dilompati. */
export const MIGRATIONS: Migrasi[] = [
  {
    nomor: 1,
    nama: 'baseline-skema-awal',
    jalankan: () => {
      /*
       * Baseline: skema awal sudah dibuat oleh initDB (CREATE TABLE IF NOT EXISTS).
       * Migrasi ini hanya menandai "database sudah berada di versi 1" sehingga
       * migrasi berikutnya punya titik awal yang jelas.
       */
    },
  },
  {
    nomor: 2,
    nama: 'cost-center-batch-id',
    jalankan: (db) => {
      /*
       * Menambahkan kolom `batch_id` agar setiap baris biaya/pendapatan bisa
       * ditelusuri ke kloter keberangkatan tertentu (cost center).
       *
       * Tanpa ini, laporan per paket hanya bisa menebak dari transaksi, dan
       * beban operasional (hotel, tiket, katering) tidak punya kloter sama
       * sekali — margin per keberangkatan tidak bisa dihitung.
       *
       * Aditif & idempoten: kolom nullable, tidak mengubah data lama.
       */
      const adaKolom = (tabel: string, kolom: string) =>
        (db.prepare(`PRAGMA table_info(${tabel})`).all() as { name: string }[]).some((c) => c.name === kolom);

      if (!adaKolom('ledger', 'batch_id')) {
        db.exec('ALTER TABLE ledger ADD COLUMN batch_id INTEGER REFERENCES batches(id)');
      }
      if (!adaKolom('expenses', 'batch_id')) {
        db.exec('ALTER TABLE expenses ADD COLUMN batch_id INTEGER REFERENCES batches(id)');
      }
      if (!adaKolom('general_journals', 'batch_id')) {
        db.exec('ALTER TABLE general_journals ADD COLUMN batch_id INTEGER REFERENCES batches(id)');
      }

      // Indeks: laporan per kloter memindai kolom ini terus-menerus.
      db.exec('CREATE INDEX IF NOT EXISTS idx_ledger_batch    ON ledger(batch_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_expenses_batch  ON expenses(batch_id)');
      db.exec('CREATE INDEX IF NOT EXISTS idx_journals_batch  ON general_journals(batch_id)');

      /*
       * Backfill: baris lama yang lahir dari transaksi booking diberi kloter
       * sesuai transaksinya. Hanya mengisi yang masih NULL, jadi aman diulang
       * dan tidak menimpa penetapan manual.
       */
      db.exec(`
        UPDATE ledger
           SET batch_id = (SELECT t.batch_id FROM transactions t WHERE t.id = ledger.transaction_id)
         WHERE batch_id IS NULL
           AND transaction_id IS NOT NULL
           AND EXISTS (SELECT 1 FROM transactions t WHERE t.id = ledger.transaction_id);
      `);
    },
  },
  {
    nomor: 3,
    nama: 'itinerary-paket',
    jalankan: (db) => {
      /*
       * Program harian (itinerary) per paket.
       *
       * Dibutuhkan skenario "Reschedule / Reroute": tanpa daftar kegiatan per
       * hari, penyesuaian check-in/check-out hotel dan porsi katering tidak
       * punya dasar hitung. Selain itu itinerary dipakai untuk brosur & manifest.
       */
      db.exec(`
        CREATE TABLE IF NOT EXISTS package_itinerary (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          package_id INTEGER NOT NULL,
          hari INTEGER NOT NULL,
          judul TEXT NOT NULL,
          kegiatan TEXT,
          kota TEXT,
          hotel TEXT,
          makan TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (package_id) REFERENCES packages(id) ON DELETE CASCADE,
          UNIQUE(package_id, hari)
        );
      `);
      db.exec('CREATE INDEX IF NOT EXISTS idx_itinerary_paket ON package_itinerary(package_id, hari)');
    },
  },
  {
    nomor: 4,
    nama: 'data-paspor-manifest-bandara',
    jalankan: (db) => {
      /*
       * Melengkapi data paspor sesuai standar manifest bandara (IATA API
       * Guidelines / APIS): kewarganegaraan, negara penerbit, tanggal terbit,
       * kedaluwarsa, kontak darurat, dan catatan medis.
       *
       * TEMUAN PENTING: form UI sudah meminta `passport_issue_date`,
       * `passport_expiry_date`, `emergency_contact`, dan `medical_notes`, tetapi
       * kolomnya TIDAK PERNAH ADA di database dan API tidak menyimpannya —
       * artinya bertahun-tahun data yang diketik staf hilang tanpa error.
       *
       * Semua kolom nullable: tidak memaksa data lama diisi.
       */
      const adaKolom = (tabel: string, kolom: string) =>
        (db.prepare(`PRAGMA table_info(${tabel})`).all() as { name: string }[]).some((c) => c.name === kolom);

      const tambah = (kolom: string, ddl: string) => {
        if (!adaKolom('master_jamaah', kolom)) db.exec(`ALTER TABLE master_jamaah ADD COLUMN ${ddl}`);
      };

      // Wajib untuk APIS
      tambah('nationality', "nationality TEXT DEFAULT 'ID'");
      tambah('passport_country', "passport_country TEXT DEFAULT 'ID'");

      // Standar paspor & operasional lapangan
      tambah('passport_issue_date', 'passport_issue_date TEXT');
      tambah('passport_expiry_date', 'passport_expiry_date TEXT');
      tambah('emergency_contact', 'emergency_contact TEXT');
      tambah('medical_notes', 'medical_notes TEXT');

      /*
       * Satukan dua kolom kedaluwarsa: `passport_expiry` (dipakai manifest lama)
       * dan `passport_expiry_date` (dipakai form). Salin nilai yang ada agar
       * tidak ada data yang "hilang" hanya karena nama kolom berbeda.
       */
      db.exec(`
        UPDATE master_jamaah
           SET passport_expiry = passport_expiry_date
         WHERE (passport_expiry IS NULL OR passport_expiry = '')
           AND passport_expiry_date IS NOT NULL AND passport_expiry_date <> '';
      `);

      // Nilai kosong string -> NULL agar filter "belum punya paspor" akurat
      db.exec(`
        UPDATE master_jamaah SET passport_number = NULL WHERE TRIM(COALESCE(passport_number,'')) = '';
        UPDATE master_jamaah SET passport_expiry = NULL WHERE TRIM(COALESCE(passport_expiry,'')) = '';
      `);

      db.exec('CREATE INDEX IF NOT EXISTS idx_jamaah_passport ON master_jamaah(passport_expiry)');
    },
  },
  {
    nomor: 5,
    nama: 'modul-komisi-agen',
    jalankan: (db) => {
      /*
       * Modul Komisi Agen:
       * - Master agents (FIX vs AKUMULASI)
       * - agent_tiers (ambang batas & kenaikan untuk mode AKUMULASI)
       * - commissions (status PENDING -> ELIGIBLE saat lunas -> PAID saat dibayar)
       * - commission_payments (pencatatan pembayaran, bisa dicicil)
       * - COA baru: 5-110 Beban Komisi, 2-102 Utang Komisi, 1-105 Piutang Agen
       * - Kolom agent_id di transactions
       */
      db.exec(`
        CREATE TABLE IF NOT EXISTS agents (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          code TEXT UNIQUE NOT NULL,
          name TEXT NOT NULL,
          type TEXT DEFAULT 'PERORANGAN', -- PERORANGAN | TRAVEL | KOMUNITAS
          phone TEXT,
          email TEXT,
          bank_name TEXT,
          bank_account_no TEXT,
          bank_holder_name TEXT,
          commission_mode TEXT DEFAULT 'FIX', -- FIX | AKUMULASI
          fix_amount REAL DEFAULT 0,
          status TEXT DEFAULT 'AKTIF', -- AKTIF | NONAKTIF
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS agent_tiers (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          agent_id INTEGER NOT NULL,
          min_count INTEGER NOT NULL,
          max_count INTEGER, -- NULL = tak terbatas (e.g. 6+)
          amount REAL NOT NULL,
          FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
        );

        CREATE TABLE IF NOT EXISTS commissions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          transaction_id INTEGER UNIQUE NOT NULL,
          agent_id INTEGER NOT NULL,
          jamaah_id INTEGER NOT NULL,
          calculation_type TEXT NOT NULL, -- FIX | AKUMULASI
          jamaah_index INTEGER, -- hitungan ke- sekian saat lahir (snapshot)
          tier_applied TEXT, -- deskripsi tier mis. "1-5" atau "6+"
          nominal REAL NOT NULL,
          status TEXT DEFAULT 'PENDING', -- PENDING | ELIGIBLE | PAID | CANCELLED
          repeat_policy TEXT DEFAULT 'ALWAYS', -- ALWAYS | FIRST_ONLY (snapshot kebijakan saat lahir)
          eligible_date TEXT, -- tanggal layak cair (mis. tanggal keberangkatan / lunas)
          paid_date TEXT,
          ledger_id INTEGER,
          notes TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
          FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE RESTRICT,
          FOREIGN KEY (jamaah_id) REFERENCES master_jamaah(id) ON DELETE RESTRICT
        );

        CREATE TABLE IF NOT EXISTS commission_payments (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          commission_id INTEGER NOT NULL,
          amount REAL NOT NULL,
          paid_date TEXT DEFAULT CURRENT_TIMESTAMP,
          method TEXT DEFAULT 'TRANSFER',
          reference_no TEXT,
          proof_image TEXT,
          paid_by TEXT,
          created_at TEXT DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (commission_id) REFERENCES commissions(id) ON DELETE CASCADE
        );
      `);

      // Tambah kolom commission_id di ledger jika belum ada
      const hasLedgerCommId = (db.prepare('PRAGMA table_info(ledger)').all() as { name: string }[]).some(c => c.name === 'commission_id');
      if (!hasLedgerCommId) {
        db.exec('ALTER TABLE ledger ADD COLUMN commission_id INTEGER REFERENCES commissions(id) ON DELETE CASCADE');
      }

      // Tambah kolom agent_id di transactions jika belum ada
      const hasAgentId = (db.prepare('PRAGMA table_info(transactions)').all() as { name: string }[]).some(c => c.name === 'agent_id');
      if (!hasAgentId) {
        db.exec('ALTER TABLE transactions ADD COLUMN agent_id INTEGER REFERENCES agents(id) ON DELETE SET NULL');
      }

      // Tambah COA baru untuk komisi
      const coaList = [
        { code: '5-110', name: 'Beban Komisi Agen', group: 'Beban', type: 'Beban Operasional' },
        { code: '2-102', name: 'Utang Komisi Agen', group: 'Liabilitas', type: 'Liabilitas Jangka Pendek' },
        { code: '1-105', name: 'Piutang Agen', group: 'Aset', type: 'Aset Lancar' },
      ];
      const insertCoa = db.prepare('INSERT OR IGNORE INTO chart_of_accounts (coa_code, coa_name, coa_type, coa_group) VALUES (?, ?, ?, ?)');
      for (const c of coaList) {
        insertCoa.run(c.code, c.name, c.type, c.group);
      }

      // Indeks performa
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_commissions_status ON commissions(status);
        CREATE INDEX IF NOT EXISTS idx_commissions_agent ON commissions(agent_id);
        CREATE INDEX IF NOT EXISTS idx_agent_tiers_agent ON agent_tiers(agent_id);
      `);
    },
  },
];

export type HasilMigrasi = {
  dari: number;
  ke: number;
  dijalankan: string[];
  total: number;
};

function pastikanTabel(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      nomor INTEGER PRIMARY KEY,
      nama TEXT NOT NULL,
      diterapkan_pada DATETIME DEFAULT CURRENT_TIMESTAMP,
      durasi_ms INTEGER NOT NULL DEFAULT 0
    );
  `);
}

export function versiSkema(db: Database.Database): number {
  return Number(db.pragma('user_version', { simple: true })) || 0;
}

export function jalankanMigrasi(db: Database.Database): HasilMigrasi {
  pastikanTabel(db);

  const dari = versiSkema(db);
  const ke = MIGRATIONS.reduce((maks, m) => Math.max(maks, m.nomor), 0);
  const dijalankan: string[] = [];

  const tertunda = MIGRATIONS
    .filter((m) => m.nomor > dari)
    .sort((a, b) => a.nomor - b.nomor);

  for (const m of tertunda) {
    const mulai = Date.now();
    /*
     * Setiap migrasi dalam transaksi sendiri: bila gagal, perubahan migrasi itu
     * dibatalkan seluruhnya dan versi TIDAK dinaikkan — sehingga boot berikutnya
     * mencoba lagi dari titik yang sama, bukan dari kondisi setengah jadi.
     */
    const jalan = db.transaction(() => {
      m.jalankan(db);
      db.prepare('INSERT OR REPLACE INTO schema_migrations (nomor, nama, durasi_ms) VALUES (?, ?, ?)')
        .run(m.nomor, m.nama, Date.now() - mulai);
      db.pragma(`user_version = ${m.nomor}`);
    });
    jalan();
    dijalankan.push(`${m.nomor}:${m.nama}`);
  }

  return { dari, ke: versiSkema(db), dijalankan, total: MIGRATIONS.length };
}
