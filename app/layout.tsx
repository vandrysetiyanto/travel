import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Al-Barakah Tour & Travel Umroh - Sistem Pendaftaran & Manajemen',
  description: 'Portal Resmi Pendaftaran dan Manajemen Paket Tour & Travel Umroh',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="id">
      <body className="min-h-screen bg-slate-50 text-slate-900 antialiased flex flex-col">
        {children}
      </body>
    </html>
  );
}
