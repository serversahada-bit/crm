// Ringkasan halaman yang berat dihitung (customer per bulan, statistik RFM), di-cache per view sampai data dimuat ulang.
import { cohortSummary, sourceComparison } from './cohort';
import { filterCustomers, readCustomerFilters } from './customerQuery';
import { CustomerView, Dataset, memo } from './dataset';
import { DEFAULT_PRODUCT_FILTER } from './normalize';
import { quintileBreaks, SEGMENTS } from './rfm';

/** Customer unik per bulan: baru (order pertama di bulan itu) vs RO, plus omzet. Urut bulan. */
export function monthlyCustomers(view: CustomerView) {
  return memo(view, 'dashboard-bulanan', () => {
    const perMonth = new Map<number, { fresh: number; ro: number; omzet: number }>();
    const lastMonth = new Map<string, number>(); // order urut tanggal: cukup ingat bulan terakhir tiap customer
    for (const o of view.orders) {
      let m = perMonth.get(o.month);
      if (!m) perMonth.set(o.month, (m = { fresh: 0, ro: 0, omzet: 0 }));
      m.omzet += o.total;
      if (lastMonth.get(o.phone) === o.month) continue;
      lastMonth.set(o.phone, o.month);
      if (view.byPhone.get(o.phone)!.firstMonth === o.month) m.fresh++;
      else m.ro++;
    }
    return [...perMonth.entries()].sort((a, b) => a[0] - b[0]);
  });
}

/** Statistik per segmen, peta Recency x Frequency, dan batas kuintil Monetary. */
export function rfmSummary(view: CustomerView) {
  return memo(view, 'rfm', () => {
    const cs = view.customers;
    const stats = new Map(SEGMENTS.map((s) => [s.id, { count: 0, spend: 0, recency: 0, orders: 0 }]));
    const grid = Array.from({ length: 5 }, () => new Array<number>(5).fill(0)); // grid[r-1][f-1]
    for (const c of cs) {
      const s = stats.get(c.segment)!;
      s.count++;
      s.spend += c.spend;
      s.recency += c.recency;
      s.orders += c.orders;
      grid[c.r - 1][c.f - 1]++;
    }
    return {
      totalSpend: cs.reduce((s, c) => s + c.spend, 0),
      stats,
      grid,
      gridMax: Math.max(1, ...grid.flat()),
      mBreaks: quintileBreaks(cs.map((c) => c.spend)),
    };
  });
}

/**
 * Hitung ringkasan halaman utama untuk filter bawaan segera setelah data dimuat,
 * agar pengunjung pertama tidak perlu menunggu.
 */
export function warmSummaries(ds: Dataset) {
  const view = ds.views.get(DEFAULT_PRODUCT_FILTER);
  if (!view) return;
  monthlyCustomers(view);
  rfmSummary(view);
  cohortSummary(ds, view, '', '');
  sourceComparison(ds, view, '');
  filterCustomers(view, readCustomerFilters({}));
}
