import type { NextRequest } from 'next/server';
import { getView } from '@/lib/dataset';
import { filterCustomers, readCustomerFilters } from '@/lib/customerQuery';
import { DEFAULT_PRODUCT_FILTER, PRODUCT_LABEL, waLink } from '@/lib/normalize';
import { SEGMENT_BY_ID } from '@/lib/rfm';
import { formatPhone } from '@/utils/formatters';

function csvCell(value: string | number): string {
  const s = String(value);
  return /[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET(request: NextRequest) {
  const sp = Object.fromEntries(request.nextUrl.searchParams);
  const produk = sp.produk || DEFAULT_PRODUCT_FILTER;
  const { view } = await getView(produk);
  const rows = filterCustomers(view, readCustomerFilters(sp));

  const header = [
    'Nama', 'No HP', 'Link WA', 'Kota', 'Provinsi', 'Pertama Beli', 'Terakhir Beli', 'Hari Sejak Order Terakhir',
    'Jumlah Order', 'Jumlah RO', 'Total Qty', 'Total Belanja', 'Rata2 Jarak Order (hari)', 'Produk Terakhir',
    'CS Terakhir', 'CRM', 'Channel Pertama', 'R', 'F', 'M', 'Segmen', 'Status',
  ];
  const lines = [header.join(';')];
  for (const c of rows) {
    lines.push(
      [
        c.name, formatPhone(c.phone), waLink(c.phone), c.kota, c.provinsi, c.firstDate, c.lastDate, c.recency,
        c.orders, c.ro, c.qty, c.spend, c.avgInterval ?? '', PRODUCT_LABEL[c.lastProduct],
        c.lastCs, c.crm, c.firstChannel, c.r, c.f, c.m, SEGMENT_BY_ID[c.segment].label, c.status,
      ]
        .map(csvCell)
        .join(';'),
    );
  }

  const filename = `customer-${produk}-${new Date().toISOString().slice(0, 10)}.csv`;
  // BOM agar Excel membaca UTF-8 dengan benar; pemisah ";" sesuai Excel berbahasa Indonesia.
  return new Response('﻿' + lines.join('\r\n'), {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
