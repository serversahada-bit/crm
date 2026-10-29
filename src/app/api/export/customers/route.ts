import type { NextRequest } from 'next/server';
import { getView } from '@/lib/dataset';
import { filterCustomers, readCustomerFilters } from '@/lib/customerQuery';
import { CUSTOMER_SOURCES, DEFAULT_PRODUCT_FILTER, PRODUCT_LABEL, waLink } from '@/lib/normalize';
import { SEGMENT_BY_ID } from '@/lib/rfm';
import { buildXlsx, XlsxColumn } from '@/lib/xlsx';

const COLUMNS: XlsxColumn[] = [
  { header: 'Nama', width: 26 },
  { header: 'No HP', width: 16 },
  { header: 'Link WA', width: 28 },
  { header: 'Kota', width: 20 },
  { header: 'Provinsi', width: 18 },
  { header: 'Pertama Beli', width: 12 },
  { header: 'Terakhir Beli', width: 12 },
  { header: 'Hari Sejak Order Terakhir' },
  { header: 'Jumlah Order' },
  { header: 'Jumlah RO' },
  { header: 'Total Qty' },
  { header: 'Total Belanja', width: 14, money: true },
  { header: 'Rata2 Jarak Order (hari)' },
  { header: 'Produk Terakhir', width: 18 },
  { header: 'Produk Pernah Dibeli', width: 34 },
  { header: 'CS Terakhir', width: 16 },
  { header: 'CRM', width: 16 },
  { header: 'Channel Pertama', width: 20 },
  { header: 'Sumber', width: 16 },
  { header: 'Jumlah Retur' },
  { header: 'R', width: 5 },
  { header: 'F', width: 5 },
  { header: 'M', width: 5 },
  { header: 'Segmen', width: 18 },
  { header: 'Status', width: 8 },
];

export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const produk = sp.produk || DEFAULT_PRODUCT_FILTER;
  const { view } = await getView(produk, sp.periode ?? '');
  // Produk yang pernah dibeli dihitung dari semua order, bukan hanya produk yang sedang difilter.
  const all = (await getView('all')).view;
  const rows = filterCustomers(view, readCustomerFilters(sp)).map((c) => [
    c.name,
    c.phone, // tanpa +, spasi, atau -; disimpan sebagai teks agar tidak jadi 6,28E+12 di Excel
    waLink(c.phone),
    c.kota,
    c.provinsi,
    c.firstDate,
    c.lastDate,
    c.recency,
    c.orders,
    c.ro,
    c.qty,
    c.spend,
    c.avgInterval,
    PRODUCT_LABEL[c.lastProduct],
    (all.byPhone.get(c.phone)?.products ?? c.products).map((p) => PRODUCT_LABEL[p]).join(', '),
    c.lastCs,
    c.crm,
    c.firstChannel,
    CUSTOMER_SOURCES.find((s) => s.value === c.source)?.label ?? '',
    c.returs,
    c.r,
    c.f,
    c.m,
    SEGMENT_BY_ID[c.segment].label,
    c.status,
  ]);

  const file = await buildXlsx('Customer', COLUMNS, rows);
  const filename = `customer-${produk}${view.year ? `-rfm${view.year}` : ''}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
