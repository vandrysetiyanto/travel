'use client';

import React from 'react';

/**
 * Komponen Badge "BARU 🌟" otomatis yang bertahan selama 30 hari sejak tanggal rilis.
 * Setelah 30 hari, badge ini otomatis hilang tanpa perlu mengubah kode manual lagi.
 */
export function NewBadge({ releaseDate = '2026-11-14', label = 'BARU' }: { releaseDate?: string; label?: string }) {
  const release = new Date(releaseDate).getTime();
  const now = Date.now();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

  // Jika sudah lebih dari 30 hari, jangan tampilkan apa pun (bersih otomatis)
  if (now - release > thirtyDaysMs) {
    return null;
  }

  return (
    <span className="ml-1.5 px-2 py-0.5 bg-emerald-500 text-white rounded-full text-[9px] font-extrabold tracking-wider animate-pulse inline-flex items-center shadow-xs">
      {label} 🌟
    </span>
  );
}
