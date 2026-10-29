// Pembersihan data mentah dari tabel data_transaksi / data_customer.

export type ProductCode = 'GM' | 'GMP' | 'GMPLUS' | 'ETF' | 'PB' | 'GNAIT' | 'LAIN';

export const PRODUCT_LABEL: Record<ProductCode, string> = {
  GM: 'Gamamilk',
  GMP: 'Gamamilk Premium',
  GMPLUS: 'Gamamilk Plus',
  ETF: 'Etacefit',
  PB: 'Phenobody',
  GNAIT: 'Gnait',
  LAIN: 'Tidak diketahui',
};

/** Pilihan filter produk. "gamamilk" = semua varian Gamamilk. */
export const PRODUCT_FILTERS: { value: string; label: string; codes: ProductCode[] | null }[] = [
  { value: 'gamamilk', label: 'Gamamilk (semua varian)', codes: ['GM', 'GMP', 'GMPLUS'] },
  { value: 'GM', label: 'Gamamilk Reguler', codes: ['GM'] },
  { value: 'GMP', label: 'Gamamilk Premium', codes: ['GMP'] },
  { value: 'GMPLUS', label: 'Gamamilk Plus', codes: ['GMPLUS'] },
  { value: 'ETF', label: 'Etacefit', codes: ['ETF'] },
  { value: 'PB', label: 'Phenobody', codes: ['PB'] },
  { value: 'GNAIT', label: 'Gnait', codes: ['GNAIT'] },
  { value: 'all', label: 'Semua produk', codes: null },
];

export const DEFAULT_PRODUCT_FILTER = 'gamamilk';

/** Nomor luar negeri yang diterima apa adanya: [kode negara, jumlah digit total]. Hong Kong = 852 + 8 digit. */
const FOREIGN_PHONES: [string, number][] = [['852', 11]];

/**
 * Menyeragamkan nomor HP ke format 628xxxxxxxxx (tanpa +, spasi, atau -). Nomor Hong Kong tetap 852xxxxxxxx.
 * Nomor yang disamarkan marketplace (mengandung *) atau tidak valid menghasilkan null.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw || raw.includes('*')) return null;
  let digits = raw.replace(/\D/g, '');
  // Dicek sebelum aturan "8xx" karena 852xxxxxxxx bisa terbaca sebagai 0852 (Telkomsel).
  if (FOREIGN_PHONES.some(([code, length]) => digits.startsWith(code) && digits.length === length)) return digits;
  if (digits.startsWith('0')) digits = '62' + digits.slice(1);
  else if (digits.startsWith('8')) digits = '62' + digits;
  if (!digits.startsWith('628') || digits.length < 10 || digits.length > 15) return null;
  return digits;
}

function matchProduct(text: string | null | undefined, allowShortCode: boolean): ProductCode | null {
  if (!text) return null;
  const s = text.toUpperCase();
  if (s.includes('ETACEFIT') || (allowShortCode && /^EC\d/.test(s))) return 'ETF';
  if (s.includes('PHENO')) return 'PB';
  if (s.includes('GNAIT')) return 'GNAIT';
  if (s.includes('GAMAMILK PREMIUM') || (allowShortCode && /(^|[^A-Z])GMP/.test(s))) return 'GMP';
  if (s.includes('GAMAMILK PLUS')) return 'GMPLUS';
  if (s.includes('GAMAMILK') || (allowShortCode && /(^|[^A-Z])GM([^A-Z]|$)|^GM\d/.test(s))) return 'GM';
  return null;
}

/** Menentukan produk dari kolom yang paling bersih dulu, lalu kolom cadangan. */
export function classifyProduct(row: {
  barang_1: string | null;
  barang: string | null;
  isi: string | null;
  ket: string | null;
}): ProductCode {
  return (
    matchProduct(row.barang_1, true) ??
    matchProduct(row.barang, true) ??
    matchProduct(row.isi, true) ??
    matchProduct(row.ket, true) ??
    // Kode paket R-n / S-n tanpa nama produk (mis. Des 2024): ±97% kode ini dipakai order Gamamilk.
    (/^[RS]-\d/i.test(row.isi ?? '') ? 'GM' : 'LAIN')
  );
}

export const CHANNEL_CRM = 'CRM (Repeat Order)';
/** Order dari iklan / WA yang ditangani CS akuisisi (CSO). */
export const CHANNEL_CSO = 'Iklan / WA (Akuisisi)';

/** Channel penjualan, diturunkan dari keterangan, tipe pembayaran, dan kolom adv. */
export function classifyChannel(ket: string | null, payment: string | null, adv: string | null): string {
  const s = `${ket ?? ''} ${payment ?? ''}`.toLowerCase();
  if (s.includes('shopee')) return 'Shopee';
  if (s.includes('tiktok')) return 'TikTok';
  if (s.includes('lazada')) return 'Lazada';
  if (s.includes('tokopedia')) return 'Tokopedia';
  if ((adv ?? '').toUpperCase().startsWith('CRM')) return CHANNEL_CRM;
  return CHANNEL_CSO;
}

export type CustomerSource = 'cso' | 'marketplace' | 'crm';

/** Sumber customer = channel order pertamanya. */
export const CUSTOMER_SOURCES: { value: CustomerSource; label: string }[] = [
  { value: 'cso', label: 'CSO (iklan / WA)' },
  { value: 'marketplace', label: 'Marketplace' },
  { value: 'crm', label: 'CRM' },
];

export function sourceOfChannel(channel: string): CustomerSource {
  if (channel === CHANNEL_CSO) return 'cso';
  if (channel === CHANNEL_CRM) return 'crm';
  return 'marketplace';
}

const CANCELLED = /batal|cancel|return|retur|gagal|lost by/i;

export function isCancelled(status: string | null): boolean {
  return !!status && CANCELLED.test(status);
}

/** Angka rupiah dari kolom teks. Nilai < 1.000 dianggap salah input dan diabaikan. */
export function parseRupiah(raw: string | null): number {
  const n = Number((raw ?? '').replace(/[^\d]/g, ''));
  return Number.isFinite(n) && n >= 1000 ? n : 0;
}

export function parseQty(raw: string | null): number {
  const n = parseInt((raw ?? '').replace(/[^\d]/g, ''), 10);
  return Number.isFinite(n) && n > 0 && n < 1000 ? n : 1;
}

export function cleanText(raw: string | null | undefined): string {
  const s = (raw ?? '').trim();
  return s === '-' || s.includes('*') || s.startsWith('#') ? '' : s;
}

/** "indri", "INDRI " -> "Indri" agar nama CS yang sama tidak terhitung dua kali. */
export function titleCase(raw: string): string {
  return raw
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .replace(/(^|[\s.(-])(\p{L})/gu, (_, sep: string, ch: string) => sep + ch.toUpperCase());
}

export function waLink(phone: string, text?: string): string {
  return `https://wa.me/${phone}${text ? `?text=${encodeURIComponent(text)}` : ''}`;
}
