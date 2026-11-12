/**
 * Relasi booking <-> jamaah yang sesungguhnya.
 *
 * Sebelumnya hubungan ini menumpang kolom teks `master_jamaah.group_code` yang
 * berisi KODE BOOKING. Akibatnya satu jamaah hanya bisa terhubung ke satu booking,
 * dan pendaftaran ulang MENIMPA kode booking lama (booking lama kehilangan
 * anggotanya tanpa pesan apa pun).
 *
 * Tabel `booking_jamaah` memperbaikinya dengan id:
 *   booking_jamaah(id, transaction_id FK, jamaah_id FK, peran, urutan)
 *   UNIQUE(transaction_id, jamaah_id)  -> satu jamaah tidak dobel di satu booking
 *
 * Aturan bisnis (dari Vandri): jamaah BOLEH ikut umroh berkali-kali, tetapi
 * TIDAK BOLEH beririsan waktunya — ia harus menyelesaikan satu perjalanan
 * sebelum bisa terdaftar di perjalanan berikutnya. Aturan itu diterapkan di
 * `cekBentrokJadwal()`, bukan di skema, karena rentang tanggal ada di `batches`.
 */
import type Database from 'better-sqlite3';

/** Buat tabel bila belum ada (dipanggil dari initDB). */
export function pastikanBookingJamaah(db: Database.Database): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS booking_jamaah (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      transaction_id INTEGER NOT NULL,
      jamaah_id INTEGER NOT NULL,
      peran TEXT NOT NULL DEFAULT 'ANGGOTA',
      urutan INTEGER NOT NULL DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (transaction_id, jamaah_id),
      FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE,
      FOREIGN KEY (jamaah_id) REFERENCES master_jamaah(id) ON DELETE RESTRICT
    );
  `);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bj_jamaah ON booking_jamaah(jamaah_id)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_bj_tx ON booking_jamaah(transaction_id)`);
}

/** Semua jamaah dalam satu booking (dari tabel penghubung, fallback ke leader). */
export function jamaahBooking(db: Database.Database, transactionId: number): { jamaah_id: number; peran: string; urutan: number }[] {
  const rows = db
    .prepare('SELECT jamaah_id, peran, urutan FROM booking_jamaah WHERE transaction_id = ? ORDER BY urutan ASC, id ASC')
    .all(transactionId) as { jamaah_id: number; peran: string; urutan: number }[];
  if (rows.length) return rows;

  // Fallback untuk data lama: leader saja.
  const tx = db.prepare('SELECT jamaah_id FROM transactions WHERE id = ?').get(transactionId) as { jamaah_id: number } | undefined;
  return tx?.jamaah_id ? [{ jamaah_id: tx.jamaah_id, peran: 'LEADER', urutan: 1 }] : [];
}

/** Tautkan satu jamaah ke satu booking (idempoten). */
export function tautkanJamaah(db: Database.Database, transactionId: number, jamaahId: number, peran = 'ANGGOTA', urutan = 1): void {
  db.prepare(
    `INSERT INTO booking_jamaah (transaction_id, jamaah_id, peran, urutan) VALUES (?, ?, ?, ?)
     ON CONFLICT(transaction_id, jamaah_id) DO UPDATE SET peran = excluded.peran, urutan = excluded.urutan`,
  ).run(transactionId, jamaahId, peran, urutan);
}

export type BentrokJadwal = {
  jamaah_id: number;
  nama: string;
  booking_code: string;
  batch_name: string;
  departure_date: string;
  return_date: string;
};

/**
 * Cek bentrok jadwal: apakah ada jamaah yang masih terikat booking AKTIF
 * yang rentang tanggalnya beririsan dengan batch tujuan?
 *
 * "Aktif" = status booking bukan CANCELLED, dan batch-nya bukan CANCELLED.
 * Dua rentang dianggap beririsan bila `mulai1 <= selesai2 AND mulai2 <= selesai1`
 * (perbandingan tanggal ISO YYYY-MM-DD aman secara leksikografis).
 *
 * `kecualikanTransactionId` dipakai saat MENGUBAH booking yang sudah ada supaya
 * booking itu tidak dianggap bentrok dengan dirinya sendiri.
 */
export function cekBentrokJadwal(
  db: Database.Database,
  jamaahIds: number[],
  batchTujuan: { departure_date: string; return_date: string; id?: number },
  kecualikanTransactionId?: number,
): BentrokJadwal[] {
  if (!jamaahIds.length) return [];
  const mulai = batchTujuan.departure_date;
  const selesai = batchTujuan.return_date;
  if (!mulai || !selesai) return [];

  const tanda = jamaahIds.map(() => '?').join(',');
  const syaratKecuali = kecualikanTransactionId ? ' AND t.id <> ?' : '';
  const params: any[] = [...jamaahIds, mulai, selesai];
  if (kecualikanTransactionId) params.push(kecualikanTransactionId);

  return db
    .prepare(`
      SELECT bj.jamaah_id,
             j.full_name AS nama,
             t.booking_code,
             b.batch_name,
             b.departure_date,
             b.return_date
      FROM booking_jamaah bj
      JOIN transactions t ON t.id = bj.transaction_id
      JOIN batches b      ON b.id = t.batch_id
      JOIN master_jamaah j ON j.id = bj.jamaah_id
      WHERE bj.jamaah_id IN (${tanda})
        AND t.status <> 'CANCELLED'
        AND COALESCE(b.status, 'OPEN') <> 'CANCELLED'
        AND b.departure_date <= ?          -- perjalanan lama mulai sebelum tujuan selesai
        AND ? <= b.return_date             -- tujuan mulai sebelum perjalanan lama selesai
        ${syaratKecuali}
    `)
    .all(...params) as BentrokJadwal[];
}

/** Pesan bentrok yang bisa langsung ditampilkan ke pendaftar. */
export function pesanBentrok(daftar: BentrokJadwal[]): string {
  const unik = new Map<number, BentrokJadwal>();
  for (const b of daftar) if (!unik.has(b.jamaah_id)) unik.set(b.jamaah_id, b);
  return Array.from(unik.values())
    .map(
      (b) =>
        `${b.nama} masih terdaftar di "${b.batch_name}" (${b.departure_date} s/d ${b.return_date}, kode ${b.booking_code}). ` +
        `Satu jamaah hanya boleh mengikuti satu perjalanan pada satu waktu.`,
    )
    .join(' ');
}
