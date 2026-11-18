import jsPDF from 'jspdf';
import 'jspdf-autotable';

export function generateBrochure(pkg: any) {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(18);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text('BROSUR PAKET PERJALANAN', 14, 20);

  doc.setFontSize(12);
  doc.setTextColor(16, 185, 129); // emerald-600
  doc.text(pkg.name || 'Paket Umroh', 14, 28);

  doc.setFontSize(10);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(`Kategori: ${pkg.category || 'Umroh Reguler'} | Durasi: ${pkg.duration_days || 9} Hari`, 14, 35);

  // Tabel Detail / Fasilitas
  const startY = 45;
  (doc as any).autoTable({
    startY,
    head: [['Komponen', 'Keterangan']],
    body: [
      ['Maskapai Penerbangan', pkg.airline || '-'],
      ['Kota Keberangkatan', pkg.departure_city || 'Jakarta (CGK)'],
      ['Hotel Makkah', pkg.hotel_makkah || '-'],
      ['Hotel Madinah', pkg.hotel_madinah || '-'],
      ['Harga Quad (4 Bed)', `Rp ${Number(pkg.price_quad || pkg.price || 0).toLocaleString('id-ID')}`],
      ['Harga Triple (3 Bed)', `Rp ${Number(pkg.price_triple || pkg.price || 0).toLocaleString('id-ID')}`],
      ['Harga Double (2 Bed)', `Rp ${Number(pkg.price_double || pkg.price || 0).toLocaleString('id-ID')}`],
    ],
    theme: 'striped',
    headStyles: { fillColor: [15, 23, 42] },
  });

  // Deskripsi & Fasilitas
  const finalY = (doc as any).lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text('Fasilitas & Keterangan Paket:', 14, finalY);

  doc.setFontSize(9);
  doc.setTextColor(71, 85, 105);
  const splitDesc = doc.splitTextToSize(pkg.description || 'Tidak ada keterangan tambahan.', 180);
  doc.text(splitDesc, 14, finalY + 6);

  // Footer
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Dicetak dari Sistem Al-Barakah Tour & Travel — Dokumen Sah', 14, 285);

  doc.save(`Brosur-${(pkg.name || 'Paket').replace(/\\s+/g, '-')}.pdf`);
}
