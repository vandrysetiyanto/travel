#!/usr/bin/env node
/**
 * #5 lanjutan: pindahkan komponen dashboard yang lebih besar ke modul terpisah,
 * memakai AST (bukan pencocokan teks) dan memverifikasi tiap potongan.
 *
 * Kelompok:
 *   - master/  : MasterJamaah, MasterPaket, MasterBatches, MasterInventaris
 *   - keuangan/ : LaporanTab, LedgerTab, StockLedgerTab, GeneralJournalTab
 *   - operasional/: ChecklistTab, ManifestTab, RegistrationsTab
 */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire('/root/travel-app/');
const ts = require('typescript');

const PAGE = '/root/travel-app/app/admin/dashboard/page.tsx';
const DIR = '/root/travel-app/components/dashboard';
fs.mkdirSync(DIR, { recursive: true });

let sumber = fs.readFileSync(PAGE, 'utf8');
const asli = sumber.split('\n').length;

const KELOMPOK = {
  'master': ['MasterJamaah', 'MasterPaket', 'MasterBatches', 'MasterInventaris'],
  'keuangan': ['LaporanTab', 'LedgerTab', 'StockLedgerTab', 'GeneralJournalTab'],
  'operasional': ['ChecklistTab', 'ManifestTab', 'RegistrationsTab'],
};

function ambilNode(teks, nama) {
  const sf = ts.createSourceFile(PAGE, teks, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  let node = null;
  const kunjungi = (n) => {
    if (ts.isFunctionDeclaration(n) && n.name?.text === nama) node = n;
    ts.forEachChild(n, kunjungi);
  };
  kunjungi(sf);
  return node ? { mulai: node.getStart(sf), akhir: node.getEnd() } : null;
}

function potonganValid(teks, nama) {
  const cek = ts.createSourceFile('c.tsx', `'use client';\n${teks}`, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  return cek.parseDiagnostics.length === 0 && cek.statements.some((s) => ts.isFunctionDeclaration(s) && s.name?.text === nama);
}

const ringkasan = [];

for (const [modul, daftar] of Object.entries(KELOMPOK)) {
  const dipindah = [];
  for (const nama of daftar) {
    const b = ambilNode(sumber, nama);
    if (!b) { console.log(`  ⚠️  ${nama}: tidak ditemukan`); continue; }

    const teks = sumber.slice(b.mulai, b.akhir).replace(`function ${nama}(`, `export function ${nama}(`);
    if (!potonganValid(teks, nama)) { console.log(`  ⚠️  ${nama}: potongan tidak valid, dilewati`); continue; }

    dipindah.push(teks);
    sumber = sumber.slice(0, b.mulai) + sumber.slice(b.akhir).replace(/^\s*\n/, '\n');
  }

  if (!dipindah.length) continue;

  const header = `'use client';

/**
 * Modul dashboard: ${modul}
 *
 * Dipisahkan dari app/admin/dashboard/page.tsx (${asli} baris, 30 komponen).
 * Berkas sebesar itu membuat setiap perubahan berisiko menjatuhkan seluruh panel.
 * Komponen di sini masih memakai state lokalnya sendiri; pemecahan lebih lanjut
 * (hook data terpisah) dilakukan bertahap agar perilaku tidak berubah.
 */
import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { EmptyState, StatusBadge, DocBadge, FInput } from '@/components/dashboard/ui-dasar';

`;
  fs.writeFileSync(path.join(DIR, `${modul}.tsx`), header + dipindah.join('\n\n') + '\n');
  ringkasan.push(`${modul}: ${dipindah.length} komponen`);
}

console.log('Modul dibuat:', ringkasan.join(' · '));

// impor di page.tsx
const imporBaru = [
  "import { MasterJamaah, MasterPaket, MasterBatches, MasterInventaris } from '@/components/dashboard/master';",
  "import { LaporanTab, LedgerTab, StockLedgerTab, GeneralJournalTab } from '@/components/dashboard/keuangan';",
  "import { ChecklistTab, ManifestTab, RegistrationsTab } from '@/components/dashboard/operasional';",
].filter((l) => !sumber.includes(l.split("from '")[1].replace("';", '')));

if (imporBaru.length) {
  sumber = sumber.replace("'use client';\n", "'use client';\n\n" + imporBaru.join('\n') + '\n', 1);
}

fs.writeFileSync(PAGE, sumber);
console.log(`page.tsx: ${asli} -> ${sumber.split('\n').length} baris`);
