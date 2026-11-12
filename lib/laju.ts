/**
 * Pembatas laju sederhana berbasis memori (per proses).
 *
 * Dipakai di endpoint yang memanggil layanan berbayar / berat (OCR), agar tidak
 * bisa dibanjiri dari luar. travel-app berjalan satu instance (fork_mode),
 * jadi cukup memakai Map; bila kelak di-cluster, pindahkan ke Redis/tabel.
 */

type Catatan = { hit: number; mulai: number };

const peta = new Map<string, Catatan>();

/** Bersihkan entri lama agar Map tidak tumbuh tanpa batas. */
function bersihkan(jendelaMs: number) {
  if (peta.size < 1000) return;
  const now = Date.now();
  for (const [k, v] of Array.from(peta.entries())) {
    if (now - v.mulai > jendelaMs) peta.delete(k);
  }
}

export function ipPemanggil(req: Request): string {
  const h = req.headers;
  const fwd = h.get('x-forwarded-for') || h.get('x-real-ip') || '';
  return fwd.split(',')[0].trim() || 'tanpa-ip';
}

export type HasilBatas = { boleh: boolean; sisa: number; sisaDetik: number; batas: number };

/**
 * Cek & catat satu pemakaian.
 * @param kunci  pengenal unik (mis. `ocr:1.2.3.4`)
 * @param batas  jumlah maksimum dalam jendela waktu
 * @param jendelaMs panjang jendela dalam milidetik
 */
export function batasiLaju(kunci: string, batas: number, jendelaMs: number): HasilBatas {
  const now = Date.now();
  const v = peta.get(kunci);

  if (!v || now - v.mulai >= jendelaMs) {
    peta.set(kunci, { hit: 1, mulai: now });
    bersihkan(jendelaMs);
    return { boleh: true, sisa: batas - 1, sisaDetik: Math.ceil(jendelaMs / 1000), batas };
  }

  if (v.hit >= batas) {
    return {
      boleh: false,
      sisa: 0,
      sisaDetik: Math.ceil((jendelaMs - (now - v.mulai)) / 1000),
      batas,
    };
  }

  v.hit += 1;
  return { boleh: true, sisa: batas - v.hit, sisaDetik: Math.ceil((jendelaMs - (now - v.mulai)) / 1000), batas };
}
