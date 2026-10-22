import type { CustomerView, Dataset } from './dataset';
import { monthIndex } from './dataset';

export interface CohortRow {
  month: number; // bulan order pertama
  size: number; // jumlah customer baru di bulan tsb
  active: number[]; // active[k] = customer yang order lagi di bulan ke-k setelah bulan pertama
}

export interface CohortResult {
  rows: CohortRow[];
  maxOffset: number;
  /** Rata-rata retensi tertimbang per bulan ke-k, dari cohort yang sudah mencapai bulan ke-k. */
  average: (number | null)[];
}

export function computeCohort(ds: Dataset, view: CustomerView, fromMonth?: number, toMonth?: number): CohortResult {
  const refMonth = monthIndex(ds.refDate);
  const rows = new Map<number, CohortRow>();

  for (const c of view.customers) {
    if ((fromMonth !== undefined && c.firstMonth < fromMonth) || (toMonth !== undefined && c.firstMonth > toMonth)) continue;
    let row = rows.get(c.firstMonth);
    if (!row) {
      row = { month: c.firstMonth, size: 0, active: new Array(refMonth - c.firstMonth + 1).fill(0) };
      rows.set(c.firstMonth, row);
    }
    row.size++;
  }

  const seen = new Set<string>();
  for (const o of view.orders) {
    const c = view.byPhone.get(o.phone)!;
    const row = rows.get(c.firstMonth);
    if (!row) continue;
    const offset = o.month - c.firstMonth;
    const key = `${o.phone}|${offset}`;
    if (seen.has(key)) continue;
    seen.add(key);
    row.active[offset]++;
  }

  const sorted = [...rows.values()].sort((a, b) => a.month - b.month);
  const maxOffset = sorted.reduce((max, r) => Math.max(max, r.active.length - 1), 0);
  const average: (number | null)[] = [];
  for (let k = 0; k <= maxOffset; k++) {
    let size = 0;
    let active = 0;
    // Bulan berjalan belum lengkap, jadi tidak ikut dirata-rata.
    for (const r of sorted) {
      if (r.month + k >= refMonth) continue;
      size += r.size;
      active += r.active[k];
    }
    average.push(size ? active / size : null);
  }
  return { rows: sorted, maxOffset, average };
}

export interface LifetimeBucket {
  label: string;
  count: number;
}

export interface LifetimeStats {
  customers: number;
  repeaters: number;
  repeatRate: number;
  avgOrders: number;
  avgLifetimeRepeaters: number; // hari
  medianLifetimeRepeaters: number; // hari
  medianInterval: number | null; // hari antar pembelian (median dari rata-rata per customer)
  buckets: LifetimeBucket[];
  roDistribution: LifetimeBucket[];
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : Math.round((s[mid - 1] + s[mid]) / 2);
}

/** Berapa lama customer bertahan: jarak order pertama ke order terakhir. */
export function computeLifetime(view: CustomerView): LifetimeStats {
  const cs = view.customers;
  const repeaters = cs.filter((c) => c.orders > 1);
  const lifetimes = repeaters.map((c) => c.lifetime);
  const intervals = repeaters.map((c) => c.avgInterval!).filter((v) => v > 0);

  const bucketDefs: [string, (c: (typeof cs)[number]) => boolean][] = [
    ['Hanya 1x beli', (c) => c.orders === 1],
    ['< 1 bulan', (c) => c.orders > 1 && c.lifetime < 30],
    ['1 - 3 bulan', (c) => c.orders > 1 && c.lifetime >= 30 && c.lifetime < 90],
    ['3 - 6 bulan', (c) => c.orders > 1 && c.lifetime >= 90 && c.lifetime < 180],
    ['6 - 12 bulan', (c) => c.orders > 1 && c.lifetime >= 180 && c.lifetime < 365],
    ['1 - 2 tahun', (c) => c.orders > 1 && c.lifetime >= 365 && c.lifetime < 730],
    ['> 2 tahun', (c) => c.orders > 1 && c.lifetime >= 730],
  ];
  const roDefs: [string, (n: number) => boolean][] = [
    ['1x (belum RO)', (n) => n === 1],
    ['2x (RO 1)', (n) => n === 2],
    ['3x', (n) => n === 3],
    ['4-5x', (n) => n >= 4 && n <= 5],
    ['6-9x', (n) => n >= 6 && n <= 9],
    ['10x+', (n) => n >= 10],
  ];

  return {
    customers: cs.length,
    repeaters: repeaters.length,
    repeatRate: cs.length ? repeaters.length / cs.length : 0,
    avgOrders: cs.length ? cs.reduce((s, c) => s + c.orders, 0) / cs.length : 0,
    avgLifetimeRepeaters: lifetimes.length ? Math.round(lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length) : 0,
    medianLifetimeRepeaters: median(lifetimes),
    medianInterval: intervals.length ? median(intervals) : null,
    buckets: bucketDefs.map(([label, fn]) => ({ label, count: cs.filter(fn).length })),
    roDistribution: roDefs.map(([label, fn]) => ({ label, count: cs.filter((c) => fn(c.orders)).length })),
  };
}
