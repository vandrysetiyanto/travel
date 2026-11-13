#!/usr/bin/env node
/**
 * #5: pecah dashboard memakai AST TypeScript (bukan pencocokan teks/ kurung).
 *
 * Percobaan berbasis teks gagal 3x karena JSX berisi kurung & kurawal di dalam
 * string/atribut. Di sini `ts.createSourceFile` menentukan rentang SETIAP
 * deklarasi fungsi secara tepat, sehingga pemotongan tidak mungkin salah.
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/root/travel-app/');
const ts = require('typescript');

const PAGE = '/root/travel-app/app/admin/dashboard/page.tsx';
const OUT = '/root/travel-app/components/dashboard';
fs.mkdirSync(OUT, { recursive: true });

let sumber = fs.readFileSync(PAGE, 'utf8');
const asliBaris = sumber.split('\n').length;

const pindah = ['EmptyState', 'StatusBadge', 'DocBadge', 'ToastContainer', 'FInput'];
const blok = {};

// ulangi sampai semua target ditemukan (setiap pemotongan memakai AST baru)
for (const nama of pindah) {
  const sf = ts.createSourceFile(PAGE, sumber, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);

  let node = null;
  const kunjungi = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === nama) node = n;
    ts.forEachChild(n, kunjungi);
  };
  kunjungi(sf);
  if (!node) { console.log(`  ⚠️  ${nama}: tidak ditemukan`); continue; }

  const mulai = node.getStart(sf);
  const akhir = node.getEnd();
  const teks = sumber.slice(mulai, akhir).replace(`function ${nama}(`, `export function ${nama}(`);

  // verifikasi: potongan harus ter-parse sebagai deklarasi fungsi yang sah
  const cek = ts.createSourceFile('cek.tsx', `'use client';\n${teks}`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const sah = cek.statements.some((st) => ts.isFunctionDeclaration(st) && st.name?.text === nama) && cek.parseDiagnostics.length === 0;
  if (!sah) { console.log(`  ⚠️  ${nama}: potongan tidak valid, dilewati`); continue; }

  blok[nama] = teks;
  // hapus beserta satu baris kosong sesudahnya
  const sisaAwal = sumber.slice(0, mulai);
  const sisaAkhir = sumber.slice(akhir).replace(/^\s*\n/, '\n');
  sumber = sisaAwal + sisaAkhir;
}

console.log('Dipindahkan:', Object.keys(blok).join(', ') || '(tidak ada)');

const header = `'use client';

/**
 * Komponen UI dasar dashboard.
 *
 * Dipisahkan dari app/admin/dashboard/page.tsx yang sebelumnya memuat 30 komponen
 * dan 4.300+ baris dalam satu berkas. Berkas sebesar itu membuat setiap perubahan
 * berisiko menjatuhkan seluruh panel admin dan sulit diuji terpisah.
 *
 * Modul ini hanya komponen presentasional (tanpa akses data).
 */
import React from 'react';

`;

fs.writeFileSync(path.join(OUT, 'ui-dasar.tsx'), header + Object.values(blok).join('\n\n') + '\n');

const impor = "import { EmptyState, StatusBadge, DocBadge, FInput, ToastContainer } from '@/components/dashboard/ui-dasar';\n";
if (!sumber.includes('ui-dasar')) {
  sumber = sumber.replace("'use client';\n", "'use client';\n\n" + impor, 1);
}

fs.writeFileSync(PAGE, sumber);
console.log(`page.tsx: ${asliBaris} -> ${sumber.split('\n').length} baris`);
