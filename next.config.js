/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // tesseract.js WAJIB di luar bundel Next. Path worker-nya dihitung dari __dirname
    // (src/worker/node/spawnWorker.js -> new Worker(workerPath)). Kalau webpack ikut
    // membundelnya, __dirname jadi .next/server/app/api/ocr, worker gagal dimuat, dan
    // createWorker tidak pernah settle -> request /api/ocr menggantung tanpa balasan.
    serverComponentsExternalPackages: ['better-sqlite3', 'tesseract.js', 'tesseract.js-core'],
  },
};

module.exports = nextConfig;
