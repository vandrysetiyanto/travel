/**
 * Pembatas percobaan login (anti brute force).
 *
 * Disimpan di memori proses — cukup karena travel-app berjalan satu instance
 * (fork_mode). Bila kelak di-cluster, ganti ke tabel/Redis.
 *
 * Aturan:
 *   - 5 percobaan gagal per (IP + email) -> dikunci 15 menit
 *   - 20 percobaan gagal per IP (lintas email) -> dikunci 15 menit
 *   - Login yang BERHASIL menghapus hitungan
 *
 * Kunci disengaja tidak memberi tahu apakah email terdaftar atau tidak; pesan
 * yang dikembalikan sama bentuknya, hanya menyebut sisa waktu.
 */

type Kunci = { gagal: number; sampai: number };

const perAkun = new Map<string, Kunci>();
const perIp = new Map<string, Kunci>();

const BATAS_AKUN = 5;
const BATAS_IP = 20;
const DURASI_MS = 15 * 60 * 1000;

/** Bersihkan entri kedaluwarsa agar peta tidak tumbuh terus. */
function bersihkan(peta: Map<string, Kunci>) {
  const now = Date.now();
  if (peta.size < 500) return;
  /*
   * Array.from dipakai karena target TS proyek ini belum mendukung iterasi Map.
   *
   * PENTING: `v.sampai > 0` WAJIB ada. Entri yang belum pernah dikunci punya
   * `sampai = 0`, dan tanpa syarat itu semua entri dianggap kedaluwarsa
   * (0 <= now) sehingga langsung terhapus — hitungan tidak pernah mencapai
   * batas dan penguncian tidak pernah aktif.
   */
  for (const [k, v] of Array.from(peta.entries())) {
    if (v.sampai > 0 && v.sampai <= now) peta.delete(k);
  }
}

export function ipPemanggil(req: Request): string {
  const h = req.headers;
  const fwd = h.get('x-forwarded-for') || h.get('x-real-ip') || '';
  const ip = fwd.split(',')[0].trim() || h.get('cf-connecting-ip') || '';
  return ip || 'tanpa-ip';
}

export type StatusKunci = { terkunci: boolean; sisaDetik: number; pesan?: string };

function cekPeta(peta: Map<string, Kunci>, kunci: string, batas: number): StatusKunci {
  const now = Date.now();
  const v = peta.get(kunci);
  if (!v) return { terkunci: false, sisaDetik: 0 };
  if (v.sampai && v.sampai > now) {
    return {
      terkunci: true,
      sisaDetik: Math.ceil((v.sampai - now) / 1000),
      pesan: `Terlalu banyak percobaan login. Coba lagi dalam ${Math.ceil((v.sampai - now) / 60000)} menit.`,
    };
  }
  /*
   * Hanya hapus bila memang PERNAH dikunci lalu kedaluwarsa.
   *
   * Bug sebelumnya: `peta.delete()` dipanggil tanpa syarat, sehingga hitungan
   * percobaan gagal selalu terhapus setiap kali diperiksa — batas 5 percobaan
   * tidak pernah tercapai dan akun tidak pernah terkunci.
   */
  if (v.sampai > 0 && v.sampai <= now) {
    peta.delete(kunci);
  }
  return { terkunci: false, sisaDetik: 0 };
}

/** Periksa apakah kombinasi IP+email atau IP saja sedang dikunci. */
export function cekKunci(ip: string, email: string): StatusKunci {
  const emailBersih = String(email || '').trim().toLowerCase();
  const dariAkun = cekPeta(perAkun, `${ip}|${emailBersih}`, BATAS_AKUN);
  if (dariAkun.terkunci) return dariAkun;
  return cekPeta(perIp, ip, BATAS_IP);
}

/** Catat percobaan gagal. */
export function catatGagal(ip: string, email: string) {
  const now = Date.now();
  const emailBersih = String(email || '').trim().toLowerCase();

  const a = perAkun.get(`${ip}|${emailBersih}`) || { gagal: 0, sampai: 0 };
  a.gagal += 1;
  if (a.gagal >= BATAS_AKUN) a.sampai = now + DURASI_MS;
  perAkun.set(`${ip}|${emailBersih}`, a);

  const i = perIp.get(ip) || { gagal: 0, sampai: 0 };
  i.gagal += 1;
  if (i.gagal >= BATAS_IP) i.sampai = now + DURASI_MS;
  perIp.set(ip, i);

  bersihkan(perAkun);
  bersihkan(perIp);
}

/** Login berhasil -> hapus hitungan untuk kombinasi ini. */
export function hapusKunci(ip: string, email: string) {
  const emailBersih = String(email || '').trim().toLowerCase();
  perAkun.delete(`${ip}|${emailBersih}`);
  const i = perIp.get(ip);
  if (i) {
    i.gagal = Math.max(0, i.gagal - 1);
    if (i.gagal === 0) perIp.delete(ip);
  }
}

/** Untuk uji/operasional: lihat ringkasan tanpa membocorkan data. */
export function ringkasKunci() {
  return { akun: perAkun.size, ip: perIp.size, batasAkun: BATAS_AKUN, batasIp: BATAS_IP, durasiMenit: DURASI_MS / 60000 };
}
