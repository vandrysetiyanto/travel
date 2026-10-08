#!/usr/bin/env python3
"""
Buat ulang gambar fixture OCR untuk tests/ocr/fixtures (bergaya KARTU seperti
dokumen asli: e-KTP biru + Kartu Keluarga + halaman Paspor dengan zona MRZ).

Jalankan:  python3 tests/ocr/make-fixtures.py
Deterministik, tanpa internet. Butuh Pillow + font DejaVu (bawaan Ubuntu).
Nilai teks dipilih agar cocok dengan tests/ocr/expected.json.
"""
import os

from PIL import Image, ImageDraw, ImageFont

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "fixtures")
os.makedirs(OUT, exist_ok=True)

FB = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"
FR = "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"
FM = "/usr/share/fonts/truetype/dejavu/DejaVuSansMono.ttf"
GRAY = (108, 128, 150)
INK = (18, 32, 52)
W, H = 1000, 631


def ft(p, s):
    return ImageFont.truetype(p, s)


def put(d, xy, text, size=26, font=FB, fill=INK):
    d.text(xy, text, font=ft(font, size), fill=fill)


def gradient(w, h, top, bottom):
    img = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(img)
    for y in range(h):
        t = y / max(1, h - 1)
        d.line([(0, y), (w, y)],
               fill=tuple(int(top[i] + (bottom[i] - top[i]) * t) for i in range(3)))
    return img


def ktp_card(prov, kab, nik, nama, ttl, jk, alamat1, alamat2, out):
    """Kartu bergaya e-KTP: header provinsi, kotak foto, kolom label/nilai."""
    img = gradient(W, H, (206, 228, 249), (156, 199, 240))
    wm = Image.new("RGB", (W, H), (255, 255, 255))
    dw = ImageDraw.Draw(wm)
    dw.text((90, 250), "KTP", font=ft(FB, 190), fill=(238, 245, 252))
    img = Image.blend(img, wm, 0.30)

    d = ImageDraw.Draw(img)
    d.rounded_rectangle([6, 6, W - 7, H - 7], radius=26, outline=(60, 100, 150), width=4)
    d.rounded_rectangle([22, 22, W - 23, H - 23], radius=18, fill=(238, 246, 254),
                        outline=(126, 166, 205), width=2)
    d.line([(46, 122), (W - 46, 122)], fill=(150, 180, 210), width=1)

    d.ellipse([46, 38, 104, 96], outline=(120, 152, 190), width=3, fill=(240, 246, 252))
    d.text((61, 55), "★", font=ft(FB, 30), fill=(150, 172, 200))
    put(d, (126, 40), prov, 27)
    put(d, (126, 74), kab, 23)

    def lab(x, y, t):
        d.text((x, y), t, font=ft(FR, 18), fill=GRAY)

    lab(46, 142, "NIK")
    put(d, (46, 166), nik, 34, FM)
    lab(46, 232, "Nama")
    put(d, (46, 258), nama, 31)
    lab(46, 322, "Tempat/Tgl Lahir")
    put(d, (46, 348), ttl, 28)
    lab(46, 412, "Jenis Kelamin")
    put(d, (46, 438), jk, 28)
    lab(46, 502, "Alamat")
    put(d, (46, 528), alamat1, 25)
    put(d, (46, 560), alamat2, 25)

    lab(560, 232, "Agama")
    put(d, (560, 258), "ISLAM", 28)
    lab(560, 322, "Status Perkawinan")
    put(d, (560, 348), "KAWIN", 28)
    lab(560, 412, "Pekerjaan")
    put(d, (560, 438), "SWASTA", 26)
    lab(360, 412, "Gol. Darah")
    put(d, (360, 438), "O", 28)

    d.rounded_rectangle([790, 140, 952, 336], radius=8, fill=(228, 238, 250),
                        outline=(134, 164, 198), width=2)
    d.text((822, 216), "FOTO", font=ft(FB, 26), fill=(164, 184, 208))
    d.text((822, 250), "3 x 4", font=ft(FR, 20), fill=(172, 192, 212))
    d.line([(790, 380), (952, 380)], fill=(134, 164, 198), width=2)
    d.text((806, 388), "Tanda Tangan", font=ft(FR, 16), fill=(146, 170, 200))
    lab(790, 452, "Berlaku Hingga")
    put(d, (790, 476), "SEUMUR HIDUP", 22)

    img.save(out)
    return out


def kk_card(no_kk, kepala, alamat1, alamat2, rows, out):
    """Kartu Keluarga: nomor di kanan atas, tabel anggota."""
    w, h = 1120, 780
    img = gradient(w, h, (238, 248, 240), (198, 230, 206))
    wm = Image.new("RGB", (w, h), (255, 255, 255))
    dw = ImageDraw.Draw(wm)
    dw.text((150, 120), "KK", font=ft(FB, 200), fill=(240, 250, 243))
    img = Image.blend(img, wm, 0.28)

    d = ImageDraw.Draw(img)
    d.rounded_rectangle([6, 6, w - 7, h - 7], radius=22, outline=(74, 126, 90), width=4)
    d.rounded_rectangle([24, 24, w - 25, h - 25], radius=16, fill=(253, 255, 253),
                        outline=(146, 190, 156), width=2)
    d.line([(50, 132), (w - 50, 132)], fill=(160, 196, 170), width=1)

    d.ellipse([50, 46, 108, 104], outline=(130, 170, 140), width=3, fill=(244, 251, 245))
    d.text((65, 63), "★", font=ft(FB, 30), fill=(152, 186, 162))
    d.text((132, 50), "KARTU KELUARGA", font=ft(FB, 32), fill=(22, 52, 32))
    d.text((134, 90), "REPUBLIK INDONESIA", font=ft(FR, 19), fill=(84, 116, 94))
    d.text((800, 52), "No. KK", font=ft(FR, 18), fill=GRAY)
    d.text((800, 76), no_kk, font=ft(FM, 29), fill=(18, 44, 28))

    d.text((50, 152), "Nama Kepala Keluarga", font=ft(FR, 18), fill=GRAY)
    d.text((50, 178), kepala, font=ft(FB, 30), fill=(18, 44, 28))
    d.text((50, 236), "Alamat", font=ft(FR, 18), fill=GRAY)
    d.text((50, 262), alamat1, font=ft(FB, 24), fill=(18, 44, 28))
    d.text((50, 294), alamat2, font=ft(FB, 24), fill=(18, 44, 28))

    ty = 360
    d.rectangle([50, ty, w - 50, ty + 46], fill=(226, 241, 230), outline=(152, 192, 162))
    for x, t in ((66, "No"), (150, "Nama"), (520, "NIK"), (790, "Jenis Kelamin")):
        d.text((x, ty + 12), t, font=ft(FB, 21), fill=(30, 60, 40))
    for i, (no, nama, nik, jk) in enumerate(rows):
        y = ty + 46 + i * 50
        d.rectangle([50, y, w - 50, y + 50], outline=(174, 208, 184))
        d.text((66, y + 13), no, font=ft(FR, 21), fill=(30, 46, 36))
        d.text((150, y + 12), nama, font=ft(FB, 21), fill=(24, 40, 30))
        d.text((520, y + 13), nik, font=ft(FM, 21), fill=(24, 40, 30))
        d.text((790, y + 12), jk, font=ft(FR, 21), fill=(24, 40, 30))

    d.text((50, 660), "Dikeluarkan Tanggal", font=ft(FR, 18), fill=GRAY)
    d.text((50, 684), "01-03-2019", font=ft(FB, 22), fill=(24, 44, 30))
    d.line([(730, 660), (1010, 660)], fill=(146, 184, 156), width=2)
    d.text((790, 670), "Kepala Dinas", font=ft(FR, 16), fill=(136, 166, 146))

    img.save(out)
    return out


def paspor_page(out):
    """Halaman data paspor + dua baris zona MRZ (monospace)."""
    w, h = 1200, 620
    img = Image.new("RGB", (w, h), (252, 250, 245))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle([6, 6, w - 7, h - 7], radius=18, outline=(120, 130, 150), width=3)
    put(d, (40, 30), "REPUBLIK INDONESIA / REPUBLIC OF INDONESIA", 26)
    put(d, (40, 70), "PASPOR / PASSPORT", 30)
    d.text((40, 140), "Nomor Paspor / Passport No.", font=ft(FR, 22), fill=GRAY)
    put(d, (40, 170), "C12345678", 32, FM)
    d.text((40, 230), "Nama Lengkap / Full Name", font=ft(FR, 22), fill=GRAY)
    put(d, (40, 260), "AHMAD FAUZI", 30)
    d.text((40, 320), "Kewarganegaraan / Nationality", font=ft(FR, 22), fill=GRAY)
    put(d, (40, 350), "INDONESIA", 28)
    d.text((620, 320), "Tanggal Lahir / Date of Birth", font=ft(FR, 22), fill=GRAY)
    put(d, (620, 350), "25 AUG 1990", 28)
    d.text((620, 410), "Berlaku Hingga / Date of Expiry", font=ft(FR, 22), fill=GRAY)
    put(d, (620, 440), "15 AUG 2030", 28)
    put(d, (40, 500), "P<IDNFAUZI<<AHMAD<<<<<<<<<<<<<<<<<<<<<<<<<<<<<<", 26, FM)
    put(d, (40, 540), "C123456784IDN9008254M3008152<<<<<<<<<<<<<<<<02", 26, FM)
    img.save(out)
    return out


made = []
made.append(ktp_card("PROVINSI DKI JAKARTA", "KOTA ADMINISTRASI JAKARTA SELATAN",
                     "3174012508900001", "BUDI SANTOSO", "JAKARTA, 25-08-1990", "LAKI-LAKI",
                     "JL. MELATI NO. 12 RT 004 RW 002", "KEL. CILANDAK TIMUR KEC. PASAR MINGGU",
                     os.path.join(OUT, "ktp_rapat.png")))
made.append(ktp_card("PROVINSI JAWA BARAT", "KABUPATEN BANDUNG",
                     "3204 1234 5678 0001", "SITI AMINAH", "BANDUNG, 12-05-1995", "PEREMPUAN",
                     "JL. MERDEKA NO. 45 RT 001 RW 005", "KEL. SUKAJADI KEC. SUKAJADI",
                     os.path.join(OUT, "ktp_spasi.png")))
made.append(ktp_card("PROVINSI JAWA TIMUR", "KOTA SURABAYA",
                     "3578 1122 3344 0002", "AHMAD FAUZI", "SURABAYA, 03-11-1988", "LAKI-LAKI",
                     "JL. RAYA DARMO NO. 88 RT 003 RW 007", "KEL. DR. SOETOMO KEC. TEGALSARI",
                     os.path.join(OUT, "ktp_miring.png")))
made.append(kk_card("3204123456780009", "BUDI SANTOSO",
                    "JL. MELATI NO. 12 RT 004 RW 002", "KEL. CILANDAK TIMUR KEC. PASAR MINGGU",
                    [("1", "BUDI SANTOSO", "3174012508900001", "LAKI-LAKI"),
                     ("2", "SITI AMINAH", "3204123456780001", "PEREMPUAN")],
                    os.path.join(OUT, "kk.png")))
made.append(paspor_page(os.path.join(OUT, "paspor.png")))

# kartu untuk menguji pola foto kecil: kata alamat bergabung ("TANAH RENDAH") dan RT/RW 000/000
made.append(ktp_card("PROVINSI SUMATERA UTARA", "KABUPATEN BATUBARA",
                     "3674 0722 5702 5099", "DEWI ANGRAINI", "MEDAN, 05-09-1991", "PEREMPUAN",
                     "TAMBAKREJO RT/RW 000/000", "KEL. TANAH RENDAH KEC. AIR PUTIH",
                     os.path.join(OUT, "ktp_kecil2.png")))

# varian "foto HP resolusi kecil": lebar ~690 px + JPEG, seperti foto dari ponsel
# (tesseract menjatuhkan baris teks pada resolusi ini -> pra-proses harus menaikkannya)
_img = Image.open(os.path.join(OUT, "ktp_rapat.png"))
_kecil = _img.resize((688, round(_img.height * 688 / _img.width)), Image.LANCZOS)
_kecil.save(os.path.join(OUT, "ktp_kecil.jpg"), quality=72)
made.append(os.path.join(OUT, "ktp_kecil.jpg"))

# versi foto HP resolusi rendah dari kartu di atas (di sinilah kata alamat bergabung)
_img2 = Image.open(os.path.join(OUT, "ktp_kecil2.png"))
_kecil2 = _img2.resize((700, round(_img2.height * 700 / _img2.width)), Image.LANCZOS)
_kecil2.save(os.path.join(OUT, "ktp_kecil2.jpg"), quality=70)
made.append(os.path.join(OUT, "ktp_kecil2.jpg"))

# varian "miring": putar sedikit (simulasi foto HP)
img = Image.open(os.path.join(OUT, "ktp_miring.png"))
img.rotate(-1.2, resample=Image.BICUBIC, fillcolor=(214, 232, 250)).save(
    os.path.join(OUT, "ktp_miring.png"))

print("fixture dibuat di", OUT)
for p in made:
    print(f"  {os.path.basename(p)}  {os.path.getsize(p)} byte  {Image.open(p).size}")
