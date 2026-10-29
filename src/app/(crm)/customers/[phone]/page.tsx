import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarClock, MessageCircle, Repeat, ShoppingBag, Wallet } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { crmOptions } from '@/lib/customerQuery';
import { Dataset, getView, Order, ReturOrder } from '@/lib/dataset';
import { CUSTOMER_SOURCES, DEFAULT_PRODUCT_FILTER, PRODUCT_LABEL, waLink } from '@/lib/normalize';
import { listTeam } from '@/lib/pembagian';
import { param, SearchParams } from '@/lib/params';
import { SEGMENT_BY_ID } from '@/lib/rfm';
import { Card, Kpi, LoadingBlock, SegmentBadge, StatusBadge } from '@/components/ui';
import { formatDate, formatDays, formatNumber, formatPhone, formatRupiah } from '@/utils/formatters';
import { assignCrm } from '../../pembagian/actions';

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

type HistoryRow = (Order & { retur?: undefined }) | (ReturOrder & { qty?: undefined; retur: true });

/** Order sukses + order retur / gagal kirim, terbaru di atas. */
function history(ds: Dataset, phone: string): HistoryRow[] {
  const rows: HistoryRow[] = [
    ...(ds.ordersByPhone.get(phone) ?? []),
    ...(ds.returnsByPhone.get(phone) ?? []).map((r) => ({ ...r, retur: true as const })),
  ];
  return rows.sort((a, b) => b.day - a.day);
}

async function CustomerDetail({ params, searchParams }: { params: Promise<{ phone: string }>; searchParams: Promise<SearchParams> }) {
  const { phone } = await params;
  const produk = param(await searchParams, 'produk', DEFAULT_PRODUCT_FILTER);
  const { ds, view } = await getView(produk);
  // Profil memakai filter produk aktif; jika customer tidak membeli produk tsb, pakai semua produk.
  const all = (await getView('all')).view;
  const c = view.byPhone.get(phone) ?? all.byPhone.get(phone);
  if (!c) notFound();

  const rows = history(ds, phone);
  const segment = SEGMENT_BY_ID[c.segment];
  const nextRo = c.avgInterval ?? 30;
  const assignment = ds.assignments.get(phone);
  const isAdmin = (await getCurrentUser())?.role === 'admin';
  const crmNames = isAdmin ? crmOptions(all, (await listTeam()).map((m) => m.nama)) : [];
  const sourceLabel = CUSTOMER_SOURCES.find((s) => s.value === c.source)?.label;

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
            {sourceLabel && ` · Sumber: ${sourceLabel}`}
          </p>
          <div className="badges">
            <SegmentBadge segment={c.segment} />
            <StatusBadge status={c.status} />
            <span className="pill">
              RFM {c.r}-{c.f}-{c.m}
            </span>
            {c.returs > 0 && <span className="pill tone-danger">{c.returs}x retur / gagal kirim</span>}
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

      {isAdmin && (
        <Card
          title="CRM Pemegang"
          description={
            assignment
              ? `Dibagikan ${assignment.method === 'manual' ? `manual${assignment.by ? ` oleh ${assignment.by}` : ''}` : 'otomatis'} pada ${formatDate(assignment.at)}${assignment.cso ? `, CSO: ${assignment.cso}` : ''}.`
              : c.crm
                ? 'Belum dibagikan lewat CRM; nama di atas dari kolom crm data_customer.'
                : 'Customer ini belum punya CRM.'
          }
        >
          <form action={assignCrm} className="inline-form">
            <input type="hidden" name="phone" value={c.phone} />
            <label className="field">
              <span>Ganti CRM</span>
              <select className="dropdown-select" name="crm" defaultValue={assignment?.crm ?? ''}>
                <option value="">(belum dibagikan)</option>
                {crmNames.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn-ghost">
              Simpan
            </button>
          </form>
        </Card>
      )}

      <Card
        title="Riwayat Order"
        description={`${formatNumber(rows.length)} order (semua produk), terbaru di atas. Order retur / gagal kirim tidak dihitung sebagai pembelian.`}
      >
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
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o, i) => (
                <tr key={`${o.id}-${i}`} className={o.retur ? 'row-muted' : undefined}>
                  <td className="nowrap">{formatDate(o.date)}</td>
                  <td className="mono">{o.id}</td>
                  <td>{PRODUCT_LABEL[o.product]}</td>
                  <td className="num">{o.qty ?? '-'}</td>
                  <td className="num nowrap">{formatRupiah(o.total)}</td>
                  <td>{o.cs}</td>
                  <td>{o.channel}</td>
                  <td>{o.kota || '-'}</td>
                  <td>
                    {o.retur ? (
                      <>
                        <span className={`pill tone-${o.kind === 'Retur' ? 'danger' : 'warning'}`}>{o.kind}</span>
                        {o.reason && <div className="muted-small">{o.reason}</div>}
                      </>
                    ) : (
                      <span className="pill tone-success">OK</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
