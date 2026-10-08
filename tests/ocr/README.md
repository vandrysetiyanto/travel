# Test OCR — travel-app

Alat untuk menguji ekstraksi OCR (`POST /api/ocr`) **KTP, Kartu Keluarga (KK), dan Paspor**.
Dibuat untuk dievaluasi manual: setiap field ditampilkan berdampingan dengan nilai harapan,
supaya Anda bisa menilai sendiri benar atau tidak.

## Cara pakai

### 1. Uji semua fixture bawaan (dibandingkan dengan nilai harapan)

```bash
cd /root/travel-app
node tests/ocr/run-ocr-test.mjs
```

Contoh keluaran:

```
--- KTP — NIK berspasi (format cetak asli)
    ktp_spasi.png  docType=KTP  HTTP 200  812 ms
    nik            : "3204123456780001"
    fullName       : "SITI AMINAH"
    ...
      OK    nik             harap="3204123456780001" dapat="3204123456780001"
      OK    fullName        harap="SITI AMINAH" dapat="SITI AMINAH"
      -> 6/6 field sesuai

RINGKASAN: 38/38 pemeriksaan sesuai  |  semua benar
```

### 2. Uji gambar Anda sendiri (foto KTP/KK asli)

```bash
node tests/ocr/run-ocr-test.mjs --image /path/ke/foto-ktp.jpg --doc-type KTP --raw
```

- `--doc-type` opsional: `KTP`, `KK`, `PASPOR`. Kalau dikosongkan, jenis dokumen dideteksi otomatis.
- `--raw` menampilkan **teks mentah hasil OCR** — berguna untuk menilai kenapa sebuah field salah.

### 3. Opsi lain

| Opsi | Arti |
|---|---|
| `--base <url>` | alamat aplikasi (default `http://localhost:3000`) |
| `--only <kata>` | hanya jalankan kasus yang labelnya memuat kata itu (mis. `--only KK`) |
| `--json` | keluarkan hasil sebagai JSON untuk diolah lagi |
| `--raw` | tampilkan teks mentah OCR |

Exit code `1` bila ada pemeriksaan yang tidak sesuai — bisa dipakai di script.

## Isi folder

| Berkas | Fungsi |
|---|---|
| `run-ocr-test.mjs` | runner pengujian (Node 18+; memakai `fetch`/`FormData` bawaan) |
| `expected.json` | daftar kasus + nilai harapan tiap field |
| `make-fixtures.py` | membuat ulang gambar fixture (`python3 tests/ocr/make-fixtures.py`) |
| `fixtures/` | gambar uji: 3 varian KTP, 1 KK, 1 Paspor |

## Kasus yang diuji

1. KTP NIK rapat (`3174012508900001`)
2. KTP NIK **berspasi** `3204 1234 5678 0001` (format cetak asli)
3. KTP **miring** + noise (simulasi foto HP)
4. KK dengan `docType=KK`
5. KK **tanpa** `docType` (deteksi otomatis — jalur form publik)
6. KTP **tanpa** `docType` (deteksi otomatis)
7. KK padahal pengguna salah pilih "Paspor" (uji pemilihan hasil terbaik)
8. Paspor — parsing zona MRZ (nomor, tanggal lahir, jenis kelamin, masa berlaku)

## Menambah kasus

Tambahkan entri ke `cases` di `expected.json`:

```json
{
  "file": "ktp_baru.png",
  "docType": "KTP",
  "label": "KTP — kasus baru",
  "expect": { "nik": "1234...", "address_contains": "JALAN" }
}
```

Kunci yang diakhiri `_contains` = pencocokan sebagian (mis. `"address_contains": "MELATI"`).

## Catatan

- Gambar fixture adalah **data sintetis** (bukan data orang nyata) dan boleh di-commit.
- Endpoint `/api/ocr` **tidak menyimpan** gambar maupun hasilnya — file hanya dibaca di memori.
- Perbaikan yang sudah ada hanya menyempurnakan **parsing**. Foto yang sangat miring/gelap/buram
  masih bisa meleset dan perlu tahap lanjutan (koreksi perspektif + peregangan kontras).
