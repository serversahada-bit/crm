import { connection } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { requireUser } from './auth';
import { pool } from './db';
import { ASSUME_GAMAMILK_BEFORE, CACHE_TTL_MS, START_DATE, STATUS_RULES } from './config';
import {
  classifyChannel,
  classifyProduct,
  cleanText,
  DEFAULT_PRODUCT_FILTER,
  isCancelled,
  normalizePhone,
  parseQty,
  parseRupiah,
  PRODUCT_FILTERS,
  ProductCode,
  titleCase,
} from './normalize';
import { quintileBreaks, scoreByBreaks, scoreFrequency, scoreRecency, segmentOf, SegmentId } from './rfm';

export interface Order {
  id: string;
  date: string; // YYYY-MM-DD
  day: number; // hari sejak 1970-01-01
  month: number; // tahun*12 + bulan(0-11)
  phone: string;
  name: string;
  kota: string;
  provinsi: string;
  product: ProductCode;
  qty: number;
  total: number;
  cs: string;
  channel: string;
}

export interface MonthTotals {
  month: number;
  orders: number; // semua order valid (termasuk no. HP disamarkan)
  omzet: number;
  cancelled: number;
}

export type CustomerStatus = 'Aktif' | 'Pasif' | 'Churn';

export interface Customer {
  phone: string;
  name: string;
  kota: string;
  provinsi: string;
  crm: string;
  firstDate: string;
  lastDate: string;
  firstMonth: number;
  orders: number;
  ro: number; // jumlah repeat order = orders - 1
  qty: number;
  spend: number;
  products: ProductCode[];
  lastProduct: ProductCode;
  lastCs: string;
  firstChannel: string;
  avgInterval: number | null; // rata-rata hari antar order
  recency: number; // hari sejak order terakhir
  lifetime: number; // hari dari order pertama ke terakhir
  r: number;
  f: number;
  m: number;
  segment: SegmentId;
  status: CustomerStatus;
}

interface Profile {
  name: string;
  kota: string;
  provinsi: string;
  crm: string;
}

export interface CustomerView {
  filter: string;
  orders: Order[]; // order milik produk yang difilter, urut tanggal
  customers: Customer[];
  byPhone: Map<string, Customer>;
}

export interface Dataset {
  loadedAt: Date;
  refDate: string; // tanggal order terakhir di data, dipakai sebagai "hari ini" analisa
  refDay: number;
  orders: Order[]; // order valid dengan no. HP yang bisa diidentifikasi
  monthly: MonthTotals[];
  totals: { rows: number; valid: number; cancelled: number; masked: number; omzet: number };
  profiles: Map<string, Profile>;
  views: Map<string, CustomerView>;
  ordersByPhone: Map<string, Order[]>;
}

const DAY_MS = 86_400_000;

export function toDay(date: string): number {
  return Math.floor(Date.UTC(+date.slice(0, 4), +date.slice(5, 7) - 1, +date.slice(8, 10)) / DAY_MS);
}

export function monthIndex(date: string): number {
  return +date.slice(0, 4) * 12 + (+date.slice(5, 7) - 1);
}

const MONTHS_ID = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];

export function monthLabel(month: number): string {
  return `${MONTHS_ID[month % 12]} ${Math.floor(month / 12)}`;
}

function productOf(row: RowDataPacket, date: string): ProductCode {
  const product = classifyProduct(row as { barang_1: string; barang: string; isi: string; ket: string });
  return product === 'LAIN' && date < ASSUME_GAMAMILK_BEFORE ? 'GM' : product;
}

/** Kolom cs; jika kosong, ambil dari awal keterangan ("J.Fitria.DHANI..." / "Wahyu.CRM..."). */
function csOf(row: RowDataPacket): string {
  const cs = cleanText(row.cs) || (cleanText(row.ket).replace(/^[JM]\./, '').split('.')[0] ?? '');
  return /^[a-z]/i.test(cs) ? titleCase(cs) : '-';
}

/** time_stamp, atau tanggal_proses bila time_stamp kosong / tanggal nol. Hasil YYYY-MM-DD atau ''. */
function orderDate(timeStamp: unknown, tanggalProses: unknown): string {
  const valid = (v: unknown) => (typeof v === 'string' && !v.startsWith('0000') ? v.slice(0, 10) : '');
  return valid(timeStamp) || valid(tanggalProses);
}

/** Jalankan query dan proses hasilnya baris per baris, tanpa menampung ratusan ribu baris sekaligus di memori. */
function streamRows(sql: string, params: unknown[], onRow: (row: RowDataPacket) => void): Promise<number> {
  return new Promise((resolve, reject) => {
    let count = 0;
    // pool.pool = pool inti mysql2 (API callback) yang mendukung .stream(); koneksi diambil & dikembalikan otomatis.
    const stream = pool.pool.query(sql, params).stream({ highWaterMark: 5000 });
    stream.on('data', (row: RowDataPacket) => {
      try {
        onRow(row);
        count++;
      } catch (err) {
        stream.destroy();
        reject(err);
      }
    });
    stream.on('end', () => resolve(count));
    stream.on('error', reject);
  });
}

async function loadFromDb(): Promise<Dataset> {
  const today = new Date().toISOString().slice(0, 10);

  // String yang sering berulang (kota, CS, channel) di-intern agar hemat memori.
  const interned = new Map<string, string>();
  const intern = (s: string) => {
    const hit = interned.get(s);
    if (hit !== undefined) return hit;
    interned.set(s, s);
    return s;
  };

  const orders: Order[] = [];
  const monthly = new Map<number, MonthTotals>();
  const totals = { rows: 0, valid: 0, cancelled: 0, masked: 0, omzet: 0 };

  const handleRow = (row: RowDataPacket) => {
    const date = orderDate(row.time_stamp, row.tanggal_proses);
    if (date < START_DATE || date > today) return;
    const month = monthIndex(date);
    let m = monthly.get(month);
    if (!m) monthly.set(month, (m = { month, orders: 0, omzet: 0, cancelled: 0 }));

    if (isCancelled(row.status)) {
      totals.cancelled++;
      m.cancelled++;
      return;
    }
    const total = parseRupiah(row.total_harga);
    totals.valid++;
    totals.omzet += total;
    m.orders++;
    m.omzet += total;

    const phone = normalizePhone(row.contack);
    if (!phone) {
      totals.masked++;
      return;
    }
    orders.push({
      id: row.kode_booking,
      date,
      day: toDay(date),
      month,
      phone,
      name: cleanText(row.first_name),
      kota: intern(cleanText(row.kota)),
      provinsi: intern(cleanText(row.provinsi)),
      product: productOf(row, date),
      qty: parseQty(row.jumlah ?? row.jumlah_1),
      total,
      cs: intern(csOf(row)),
      channel: intern(classifyChannel(row.ket, row.tipe_pembayaran, row.adv)),
    });
  };

  totals.rows = await streamRows(
    // Tanggal dipilih di JS, bukan dengan literal '0000-00-00' di SQL: MySQL 8 (mode NO_ZERO_DATE) menolak literal itu.
    `SELECT kode_booking, time_stamp, tanggal_proses,
            contack, first_name, kota, provinsi, barang, barang_1, LEFT(isi_paket, 40) AS isi,
            total_harga, jumlah, jumlah_1, cs, adv, LEFT(keterangan, 60) AS ket, tipe_pembayaran,
            LEFT(status, 60) AS status
       FROM data_transaksi
      WHERE time_stamp >= ? OR tanggal_proses >= ?`,
    [START_DATE, START_DATE],
    handleRow,
  );
  orders.sort((a, b) => a.day - b.day);

  const [customerRows] = await pool.query<RowDataPacket[]>(
    'SELECT hp_customer, nama_customer, kabupaten, provinsi, crm FROM data_customer',
  );
  const profiles = new Map<string, Profile>();
  for (const row of customerRows) {
    const phone = normalizePhone(row.hp_customer);
    if (!phone) continue;
    profiles.set(phone, {
      name: cleanText(row.nama_customer),
      kota: cleanText(row.kabupaten),
      provinsi: cleanText(row.provinsi),
      crm: cleanText(row.crm),
    });
  }

  const ordersByPhone = new Map<string, Order[]>();
  for (const o of orders) {
    const list = ordersByPhone.get(o.phone);
    if (list) list.push(o);
    else ordersByPhone.set(o.phone, [o]);
  }

  const refDate = orders.length ? orders[orders.length - 1].date : today;
  const ds: Dataset = {
    loadedAt: new Date(),
    refDate,
    refDay: toDay(refDate),
    orders,
    monthly: [...monthly.values()].sort((a, b) => a.month - b.month),
    totals,
    profiles,
    views: new Map(),
    ordersByPhone,
  };
  // Filter default & "semua produk" dihitung sekarang agar halaman pertama tidak perlu menunggu.
  for (const filter of [DEFAULT_PRODUCT_FILTER, 'all']) ds.views.set(filter, buildView(ds, filter));
  return ds;
}

interface DatasetCache {
  current?: Dataset; // data terakhir yang berhasil dimuat
  loading?: Promise<Dataset>; // pemuatan ulang yang sedang berjalan
  loader: typeof loadFromDb;
}

const store = globalThis as unknown as { crmDataset?: DatasetCache };

function cacheState(): DatasetCache {
  // Saat dev, loader berbeda = kode ini baru di-hot-reload, jadi data lama dibuang. Tidak dicek di produksi:
  // instrumentation.ts dan halaman bisa memuat modul ini sebagai instance terpisah, tapi berbagi cache yang sama.
  const stale = process.env.NODE_ENV !== 'production' && store.crmDataset?.loader !== loadFromDb;
  if (!store.crmDataset || stale) store.crmDataset = { loader: loadFromDb };
  return store.crmDataset;
}

/** Muat ulang dari DB (paling banyak satu proses sekaligus). Data lama tetap dipakai sampai selesai. */
function startReload(): Promise<Dataset> {
  const state = cacheState();
  state.loading ??= loadFromDb()
    .then((ds) => {
      state.current = ds;
      return ds;
    })
    .finally(() => {
      state.loading = undefined;
    });
  return state.loading;
}

/**
 * Data seluruh order. Hanya pemuatan pertama sejak server menyala yang perlu ditunggu;
 * setelah CACHE_TTL_MS data diperbarui di latar belakang sambil tetap menyajikan data sebelumnya.
 */
async function ensureDataset(): Promise<Dataset> {
  const { current } = cacheState();
  if (!current) return startReload();
  if (Date.now() - current.loadedAt.getTime() > CACHE_TTL_MS) {
    startReload().catch((err) => console.error('[crm] Gagal memperbarui data, tetap memakai data sebelumnya:', err));
  }
  return current;
}

export async function getDataset(): Promise<Dataset> {
  await connection();
  await requireUser(); // semua data customer hanya untuk user yang login
  return ensureDataset();
}

/** Dipanggil saat server menyala (src/instrumentation.ts) agar data siap sebelum ada yang membuka halaman. */
export function warmDataset() {
  const started = Date.now();
  startReload()
    .then((ds) => console.log(`[crm] Data siap: ${ds.totals.valid} order dalam ${Date.now() - started} ms`))
    .catch((err) => console.error('[crm] Pemanasan data gagal, akan dicoba lagi saat halaman dibuka:', err));
}

/** Tombol "Muat ulang data": tunggu sampai data terbaru selesai dimuat. */
export async function reloadDataset() {
  await startReload();
}

function statusOf(recency: number): CustomerStatus {
  if (recency <= STATUS_RULES.aktifMaxDays) return 'Aktif';
  if (recency <= STATUS_RULES.pasifMaxDays) return 'Pasif';
  return 'Churn';
}

function mostCommon(values: string[]): string {
  const counts = new Map<string, number>();
  let best = '';
  let bestCount = 0;
  for (const v of values) {
    if (!v) continue;
    const c = (counts.get(v) ?? 0) + 1;
    counts.set(v, c);
    if (c > bestCount) [best, bestCount] = [v, c];
  }
  return best;
}

function buildView(ds: Dataset, filter: string): CustomerView {
  const codes = (PRODUCT_FILTERS.find((p) => p.value === filter) ?? PRODUCT_FILTERS[0]).codes;
  const orders = codes ? ds.orders.filter((o) => codes.includes(o.product)) : ds.orders;

  const grouped = new Map<string, Order[]>();
  for (const o of orders) {
    const list = grouped.get(o.phone);
    if (list) list.push(o);
    else grouped.set(o.phone, [o]);
  }

  const customers: Customer[] = [];
  for (const [phone, list] of grouped) {
    // Beberapa baris di hari yang sama dihitung sebagai 1 kali pembelian.
    const days = [...new Set(list.map((o) => o.day))];
    const first = list[0];
    const last = list[list.length - 1];
    const profile = ds.profiles.get(phone);
    const recency = ds.refDay - last.day;
    const lifetime = last.day - first.day;
    const name = [...list].reverse().find((o) => o.name)?.name || profile?.name || '(tanpa nama)';
    customers.push({
      phone,
      name,
      kota: last.kota || profile?.kota || mostCommon(list.map((o) => o.kota)),
      provinsi: last.provinsi || profile?.provinsi || '',
      crm: profile?.crm ?? '',
      firstDate: first.date,
      lastDate: last.date,
      firstMonth: first.month,
      orders: days.length,
      ro: days.length - 1,
      qty: list.reduce((s, o) => s + o.qty, 0),
      spend: list.reduce((s, o) => s + o.total, 0),
      products: [...new Set(list.map((o) => o.product))],
      lastProduct: last.product,
      lastCs: last.cs,
      firstChannel: first.channel,
      avgInterval: days.length > 1 ? Math.round(lifetime / (days.length - 1)) : null,
      recency,
      lifetime,
      r: scoreRecency(recency),
      f: scoreFrequency(days.length),
      m: 0,
      segment: 'lost',
      status: statusOf(recency),
    });
  }

  const breaks = quintileBreaks(customers.map((c) => c.spend));
  for (const c of customers) {
    c.m = scoreByBreaks(c.spend, breaks);
    c.segment = segmentOf(c.r, c.f);
  }

  return { filter, orders, customers, byPhone: new Map(customers.map((c) => [c.phone, c])) };
}

/** Profil customer + RFM untuk filter produk tertentu (di-memo per dataset). */
export async function getView(filter: string = DEFAULT_PRODUCT_FILTER): Promise<{ ds: Dataset; view: CustomerView }> {
  const ds = await getDataset();
  const key = PRODUCT_FILTERS.some((p) => p.value === filter) ? filter : DEFAULT_PRODUCT_FILTER;
  let view = ds.views.get(key);
  if (!view) {
    view = buildView(ds, key);
    ds.views.set(key, view);
  }
  return { ds, view };
}
