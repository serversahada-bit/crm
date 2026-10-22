import type { Customer, CustomerView } from './dataset';
import { normalizePhone } from './normalize';
import { param, SearchParams } from './params';

export const SORTS: { value: string; label: string; fn: (a: Customer, b: Customer) => number }[] = [
  { value: 'terbaru', label: 'Order terakhir (terbaru)', fn: (a, b) => (a.lastDate < b.lastDate ? 1 : a.lastDate > b.lastDate ? -1 : 0) },
  { value: 'ro', label: 'Jumlah RO terbanyak', fn: (a, b) => b.orders - a.orders || b.spend - a.spend },
  { value: 'belanja', label: 'Total belanja terbesar', fn: (a, b) => b.spend - a.spend },
  { value: 'lama', label: 'Customer terlama', fn: (a, b) => (a.firstDate < b.firstDate ? -1 : a.firstDate > b.firstDate ? 1 : 0) },
  { value: 'recency', label: 'Paling lama tidak beli', fn: (a, b) => b.recency - a.recency },
];

export interface CustomerFilters {
  q: string;
  segmen: string;
  status: string;
  tahun: string;
  tipe: string; // '' | 'ro' | 'sekali'
  cs: string;
  kota: string;
  sort: string;
}

export function readCustomerFilters(sp: SearchParams): CustomerFilters {
  return {
    q: param(sp, 'q'),
    segmen: param(sp, 'segmen'),
    status: param(sp, 'status'),
    tahun: param(sp, 'tahun'),
    tipe: param(sp, 'tipe'),
    cs: param(sp, 'cs'),
    kota: param(sp, 'kota'),
    sort: param(sp, 'sort', 'terbaru'),
  };
}

export function filterCustomers(view: CustomerView, f: CustomerFilters): Customer[] {
  const q = f.q.toLowerCase();
  const qPhone = q.replace(/\D/g, '').length >= 4 ? (normalizePhone(q) ?? q.replace(/\D/g, '').replace(/^0/, '')) : '';
  const kota = f.kota.toLowerCase();

  const result = view.customers.filter((c) => {
    if (q && !(c.name.toLowerCase().includes(q) || (qPhone && c.phone.includes(qPhone)))) return false;
    if (f.segmen && c.segment !== f.segmen) return false;
    if (f.status && c.status !== f.status) return false;
    if (f.tahun && !c.firstDate.startsWith(f.tahun)) return false;
    if (f.tipe === 'ro' && c.orders < 2) return false;
    if (f.tipe === 'sekali' && c.orders !== 1) return false;
    if (f.cs && c.lastCs !== f.cs) return false;
    if (kota && !c.kota.toLowerCase().includes(kota)) return false;
    return true;
  });
  const sort = SORTS.find((s) => s.value === f.sort) ?? SORTS[0];
  return result.sort(sort.fn);
}

/** Daftar CS yang muncul sebagai CS order terakhir, urut terbanyak. */
export function csOptions(view: CustomerView): string[] {
  const counts = new Map<string, number>();
  for (const c of view.customers) if (c.lastCs !== '-') counts.set(c.lastCs, (counts.get(c.lastCs) ?? 0) + 1);
  return [...counts.entries()].filter(([, n]) => n >= 20).sort((a, b) => b[1] - a[1]).map(([k]) => k);
}
