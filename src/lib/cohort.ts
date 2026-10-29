import type { Customer, CustomerView, Dataset } from './dataset';
import { memo, monthIndex } from './dataset';
import { CUSTOMER_SOURCES } from './normalize';

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

/** `include` memilih customer yang ikut dihitung (mis. tahun cohort, sumber customer). */
export function computeCohort(ds: Dataset, view: CustomerView, include: (c: Customer) => boolean = () => true): CohortResult {
  const refMonth = monthIndex(ds.refDate);
  const rows = new Map<number, CohortRow>();

  for (const c of view.customers) {
    if (!include(c)) continue;
    let row = rows.get(c.firstMonth);
    if (!row) {
      row = { month: c.firstMonth, size: 0, active: new Array(refMonth - c.firstMonth + 1).fill(0) };
      rows.set(c.firstMonth, row);
    }
    row.size++;
  }

  // Order urut tanggal, jadi bulan order tiap customer tidak pernah mundur: cukup ingat bulan terakhir yang sudah dihitung.
  const lastOffset = new Map<string, number>();
  for (const o of view.orders) {
    const c = view.byPhone.get(o.phone)!;
    const row = rows.get(c.firstMonth);
    if (!row || !include(c)) continue;
    const offset = o.month - c.firstMonth;
    if (lastOffset.get(o.phone) === offset) continue;
    lastOffset.set(o.phone, offset);
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

const LIFETIME_BUCKETS = ['Hanya 1x beli', '< 1 bulan', '1 - 3 bulan', '3 - 6 bulan', '6 - 12 bulan', '1 - 2 tahun', '> 2 tahun'];
/** Batas atas (hari, tidak termasuk) bucket '< 1 bulan' sampai '1 - 2 tahun'; sisanya '> 2 tahun'. */
const LIFETIME_LIMITS = [30, 90, 180, 365, 730];
const RO_BUCKETS = ['1x (belum RO)', '2x (RO 1)', '3x', '4-5x', '6-9x', '10x+'];

function roBucket(orders: number): number {
  if (orders <= 3) return orders - 1;
  if (orders <= 5) return 3;
  return orders <= 9 ? 4 : 5;
}

/** Berapa lama customer bertahan: jarak order pertama ke order terakhir. Satu kali putaran atas daftar customer. */
export function computeLifetime(cs: Customer[]): LifetimeStats {
  const buckets = new Array<number>(LIFETIME_BUCKETS.length).fill(0);
  const ro = new Array<number>(RO_BUCKETS.length).fill(0);
  const lifetimes: number[] = [];
  const intervals: number[] = [];
  let totalOrders = 0;
  for (const c of cs) {
    totalOrders += c.orders;
    ro[roBucket(c.orders)]++;
    if (c.orders === 1) {
      buckets[0]++;
      continue;
    }
    lifetimes.push(c.lifetime);
    if (c.avgInterval! > 0) intervals.push(c.avgInterval!);
    const i = LIFETIME_LIMITS.findIndex((max) => c.lifetime < max);
    buckets[i === -1 ? LIFETIME_BUCKETS.length - 1 : i + 1]++;
  }

  return {
    customers: cs.length,
    repeaters: lifetimes.length,
    repeatRate: cs.length ? lifetimes.length / cs.length : 0,
    avgOrders: cs.length ? totalOrders / cs.length : 0,
    avgLifetimeRepeaters: lifetimes.length ? Math.round(lifetimes.reduce((a, b) => a + b, 0) / lifetimes.length) : 0,
    medianLifetimeRepeaters: median(lifetimes),
    medianInterval: intervals.length ? median(intervals) : null,
    buckets: LIFETIME_BUCKETS.map((label, i) => ({ label, count: buckets[i] })),
    roDistribution: RO_BUCKETS.map((label, i) => ({ label, count: ro[i] })),
  };
}

/** Tabel cohort + statistik lama bertahan untuk filter tahun & sumber (di-cache sampai data dimuat ulang). */
export function cohortSummary(ds: Dataset, view: CustomerView, tahun: string, sumber: string) {
  return memo(view, `cohort|${tahun}|${sumber}`, () => {
    const include = (c: Customer) => (!tahun || c.firstDate.startsWith(tahun)) && (!sumber || c.source === sumber);
    return { cohort: computeCohort(ds, view, include), life: computeLifetime(view.customers.filter(include)) };
  });
}

/** Retensi customer baru per sumber (CSO / marketplace / CRM) untuk satu tahun cohort atau semua. */
export function sourceComparison(ds: Dataset, view: CustomerView, tahun: string) {
  return memo(view, `cohort-sumber|${tahun}`, () =>
    CUSTOMER_SOURCES.map((s) => {
      const include = (c: Customer) => (!tahun || c.firstDate.startsWith(tahun)) && c.source === s.value;
      return { ...s, cohort: computeCohort(ds, view, include), life: computeLifetime(view.customers.filter(include)) };
    }),
  );
}
