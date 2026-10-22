import { FREQUENCY_SCORE, RECENCY_SCORE } from './config';

export type SegmentId =
  | 'champions'
  | 'loyal'
  | 'potential'
  | 'new'
  | 'promising'
  | 'need_attention'
  | 'about_to_sleep'
  | 'cant_lose'
  | 'at_risk'
  | 'hibernating'
  | 'lost';

export interface SegmentInfo {
  id: SegmentId;
  label: string;
  description: string;
  action: string;
  color: string;
}

export const SEGMENTS: SegmentInfo[] = [
  { id: 'champions', label: 'Champions', color: '#10b981', description: 'Baru beli dan paling sering beli.', action: 'Beri reward/program member, minta testimoni & referral.' },
  { id: 'loyal', label: 'Loyal', color: '#22c55e', description: 'Sering beli, masih cukup baru.', action: 'Tawarkan paket hemat multi-box, jaga hubungan.' },
  { id: 'potential', label: 'Potential Loyalist', color: '#84cc16', description: 'Baru beli, sudah RO 1-3 kali.', action: 'Dorong ke pembelian rutin (langganan bulanan).' },
  { id: 'new', label: 'Customer Baru', color: '#38bdf8', description: 'Order pertama dalam 30 hari terakhir.', action: 'Edukasi cara konsumsi, follow-up saat stok mau habis.' },
  { id: 'promising', label: 'Promising', color: '#6366f1', description: 'Order pertama 1-2 bulan lalu, belum RO.', action: 'Follow-up RO pertama, beri promo khusus RO.' },
  { id: 'need_attention', label: 'Need Attention', color: '#eab308', description: 'Frekuensi sedang, mulai jarang beli.', action: 'Tanyakan kabar & hasil konsumsi, tawarkan promo terbatas.' },
  { id: 'about_to_sleep', label: 'About to Sleep', color: '#f59e0b', description: '2-3 bulan tidak beli, frekuensi rendah.', action: 'Kirim reminder + promo agar tidak hilang.' },
  { id: 'cant_lose', label: "Can't Lose Them", color: '#ef4444', description: 'Dulu sangat sering beli, sekarang lama tidak beli.', action: 'Prioritas utama: telepon langsung, cari tahu alasannya.' },
  { id: 'at_risk', label: 'At Risk', color: '#f97316', description: 'Pernah beli beberapa kali, sudah lama tidak beli.', action: 'Win-back: promo personal & follow-up CS.' },
  { id: 'hibernating', label: 'Hibernating', color: '#a78bfa', description: '3-6 bulan tidak beli, frekuensi rendah.', action: 'Broadcast promo umum, biaya follow-up rendah.' },
  { id: 'lost', label: 'Lost', color: '#64748b', description: 'Lebih dari 6 bulan tidak beli, 1-2 kali order.', action: 'Broadcast sesekali saja / reaktivasi massal.' },
];

export const SEGMENT_BY_ID = Object.fromEntries(SEGMENTS.map((s) => [s.id, s])) as Record<SegmentId, SegmentInfo>;

export function scoreRecency(days: number): number {
  for (const rule of RECENCY_SCORE) if (days <= rule.maxDays) return rule.score;
  return 1;
}

export function scoreFrequency(orders: number): number {
  for (const rule of FREQUENCY_SCORE) if (orders >= rule.minOrders) return rule.score;
  return 1;
}

/** Batas kuintil (20/40/60/80%) dari daftar nilai. */
export function quintileBreaks(values: number[]): number[] {
  const sorted = [...values].sort((a, b) => a - b);
  if (sorted.length === 0) return [0, 0, 0, 0];
  return [0.2, 0.4, 0.6, 0.8].map((q) => sorted[Math.floor(q * (sorted.length - 1))]);
}

export function scoreByBreaks(value: number, breaks: number[]): number {
  let score = 1;
  for (const b of breaks) if (value > b) score++;
  return score;
}

/** Segmen dari grid Recency x Frequency (versi umum RFM). */
export function segmentOf(r: number, f: number): SegmentId {
  if (r >= 4) {
    if (f >= 4) return r === 5 || f === 5 ? 'champions' : 'loyal';
    if (f >= 2) return 'potential';
    return r === 5 ? 'new' : 'promising';
  }
  if (r === 3) {
    if (f >= 4) return 'loyal';
    if (f === 3) return 'need_attention';
    return 'about_to_sleep';
  }
  if (f === 5) return 'cant_lose';
  if (f >= 3) return 'at_risk';
  return r === 2 ? 'hibernating' : 'lost';
}
