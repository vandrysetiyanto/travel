#!/usr/bin/env node
/**
 * QA/QC: audit otorisasi tiap route API.
 *
 * Memeriksa kode sumber apakah setiap handler punya gerbang otorisasi dan
 * mencocokkannya dengan hasil uji HTTP tanpa sesi (anonim).
 */
import fs from 'node:fs';
import path from 'node:path';

const AKAR = '/root/travel-app/app/api';

function cariRoute(dir, hasil = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) cariRoute(p, hasil);
    else if (e.name === 'route.ts') hasil.push(p);
  }
  return hasil;
}

const routes = cariRoute(AKAR).sort();
const BASE = 'http://127.0.0.1:3000';

console.log(`\nTotal route API: ${routes.length}\n`);
console.log('ROUTE'.padEnd(34), 'METHOD'.padEnd(18), 'GERBANG', 'ANONIM');
console.log('-'.repeat(90));

const temuan = [];

for (const file of routes) {
  const src = fs.readFileSync(file, 'utf8');
  const rel = file.replace(AKAR + '/', '').replace('/route.ts', '') || '(root)';

  // daftar method yang diekspor
  const methods = [...src.matchAll(/export\s+async\s+function\s+(GET|POST|PUT|PATCH|DELETE)/g)].map((m) => m[1]);

  // gerbang otorisasi yang terdeteksi di dalam file
  const gerbang = [];
  if (/requirePermission\s*\(/.test(src)) gerbang.push('izin');
  if (/requireAdmin\s*\(/.test(src)) gerbang.push('login');
  if (/requireOwner\s*\(/.test(src)) gerbang.push('owner');
  if (/rateLimit|rate_limit/.test(src)) gerbang.push('ratelimit');
  if (/zod|validate\(|sanitize/i.test(src)) gerbang.push('validasi');

  const label = gerbang.length ? gerbang.join('+') : '❌ TIDAK ADA';
  if (!gerbang.length) temuan.push({ rel, jenis: 'tanpa-gerbang', detail: `method: ${methods.join(',')}` });

  console.log(rel.padEnd(34), methods.join(',').padEnd(18), label);

  // uji anonim
  for (const m of methods) {
    try {
      const r = await fetch(`${BASE}/api/${rel}`, { method: m });
      const status = r.status;
      await r.text();
      // Route publik memang boleh 200; yang mencurigakan adalah route admin tanpa gerbang
      const publik = /^(master|register|track|payments\/upload)/.test(rel);
      if (!publik && status >= 200 && status < 300) {
        console.log(' '.repeat(34), '⚠️  ANONIM DAPAT 200 — tidak terproteksi!');
        temuan.push({ rel, jenis: 'anonim-200', detail: `${m} -> ${status}` });
      }
    } catch (e) {
      console.log(' '.repeat(34), `error: ${e.message}`);
    }
  }
}

console.log('\n=== TEMUAN ===');
if (!temuan.length) console.log('  (tidak ada)');
for (const t of temuan) console.log(`  [${t.jenis}] ${t.rel} — ${t.detail}`);
