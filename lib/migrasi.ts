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
