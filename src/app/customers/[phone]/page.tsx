import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarClock, MessageCircle, Repeat, ShoppingBag, Wallet } from 'lucide-react';
import { getView } from '@/lib/dataset';
import { DEFAULT_PRODUCT_FILTER, PRODUCT_LABEL, waLink } from '@/lib/normalize';
import { param, SearchParams } from '@/lib/params';
import { SEGMENT_BY_ID } from '@/lib/rfm';
import { Card, Kpi, LoadingBlock, SegmentBadge, StatusBadge } from '@/components/ui';
import { formatDate, formatDays, formatNumber, formatPhone, formatRupiah } from '@/utils/formatters';

export default function CustomerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ phone: string }>;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <CustomerDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function CustomerDetail({ params, searchParams }: { params: Promise<{ phone: string }>; searchParams: Promise<SearchParams> }) {
  const { phone } = await params;
  const produk = param(await searchParams, 'produk', DEFAULT_PRODUCT_FILTER);
  const { ds, view } = await getView(produk);
  // Profil memakai filter produk aktif; jika customer tidak membeli produk tsb, pakai semua produk.
  const c = view.byPhone.get(phone) ?? (await getView('all')).view.byPhone.get(phone);
  if (!c) notFound();

  const orders = [...(ds.ordersByPhone.get(phone) ?? [])].reverse();
  const segment = SEGMENT_BY_ID[c.segment];
  const nextRo = c.avgInterval ?? 30;

  return (
    <>
      <div className="view-header">
        <div className="view-header-title">
          <Link className="link back" href={`/customers?produk=${produk}`}>
            <ArrowLeft size={15} /> Data Customer
          </Link>
          <h1>{c.name}</h1>
          <p>
            {formatPhone(c.phone)} · {[c.kota, c.provinsi].filter(Boolean).join(', ') || 'Alamat tidak tercatat'}
            {c.crm && ` · CRM: ${c.crm}`}
          </p>
          <div className="badges">
            <SegmentBadge segment={c.segment} />
            <StatusBadge status={c.status} />
            <span className="pill">
              RFM {c.r}-{c.f}-{c.m}
            </span>
          </div>
        </div>
        <a className="btn-primary-gradient" href={waLink(c.phone, `Halo kak ${c.name}, `)} target="_blank" rel="noreferrer">
          <MessageCircle size={16} /> Chat WhatsApp
        </a>
      </div>

      <div className="stats-grid">
        <Kpi label="Jumlah Order" value={formatNumber(c.orders)} hint={`${c.ro}x repeat order`} icon={Repeat} tone="emerald" />
        <Kpi label="Total Belanja" value={formatRupiah(c.spend)} hint={`${formatNumber(c.qty)} item/box`} icon={Wallet} tone="amber" />
        <Kpi label="Lama Jadi Customer" value={formatDays(c.lifetime)} hint={`Sejak ${formatDate(c.firstDate)}`} icon={ShoppingBag} tone="purple" />
        <Kpi
          label="Order Terakhir"
          value={`${formatDays(c.recency)} lalu`}
          hint={c.avgInterval ? `Biasanya beli tiap ${formatDays(c.avgInterval)}` : `Perkiraan RO setelah ${nextRo} hari`}
          icon={CalendarClock}
        />
      </div>

      <div className="note">
        <strong style={{ color: segment.color }}>{segment.label}:</strong> {segment.description} <em>Saran: {segment.action}</em>
      </div>

      <Card title="Riwayat Order" description={`${orders.length} order (semua produk), terbaru di atas.`}>
        <div className="table-wrapper">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kode booking</th>
                <th>Produk</th>
                <th className="num">Qty</th>
                <th className="num">Total</th>
                <th>CS</th>
                <th>Channel</th>
                <th>Kota</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.id}>
                  <td className="nowrap">{formatDate(o.date)}</td>
                  <td className="mono">{o.id}</td>
                  <td>{PRODUCT_LABEL[o.product]}</td>
                  <td className="num">{o.qty}</td>
                  <td className="num nowrap">{formatRupiah(o.total)}</td>
                  <td>{o.cs}</td>
                  <td>{o.channel}</td>
                  <td>{o.kota || '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
