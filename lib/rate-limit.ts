/**
 * In-memory IP rate limiter sederhana untuk rute publik.
 * Membatasi max 15 request per 60 detik per IP.
 */
const ipCache = new Map<string, { count: number; resetTime: number }>();

export function checkRateLimit(ip: string, limit = 15, windowMs = 60000): boolean {
  const now = Date.now();
  let record = ipCache.get(ip);

  if (!record || now > record.resetTime) {
    ipCache.set(ip, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count++;
  return true;
}
