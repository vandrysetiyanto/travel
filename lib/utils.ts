export function formatRupiah(amount: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
}

export function generateBookingCode(): string {
  const date = new Date();
  const year = date.getFullYear().toString().slice(-2);
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const random = Math.floor(1000 + Math.random() * 9000);
  return `UMR-${year}${month}-${random}`;
}

export function generatePaymentNumber(): string {
  const date = new Date();
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);
  return `PAY-${timestamp}${random}`;
}

/** Nomor kuitansi pembayaran (pengganti generatePaymentNumber versi lama). */
export function generateReceiptNumber(): string {
  const timestamp = Date.now().toString().slice(-6);
  const random = Math.floor(100 + Math.random() * 900);
  return `KW-${timestamp}${random}`;
}
