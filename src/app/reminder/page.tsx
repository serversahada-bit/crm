import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { MessageCircle } from 'lucide-react';
import { DEFAULT_RO_INTERVAL_DAYS, RO_REMINDER_LEAD_DAYS, STATUS_RULES } from '@/lib/config';
import { csOptions } from '@/lib/customerQuery';
import { getView } from '@/lib/dataset';
import { DEFAULT_PRODUCT_FILTER, PRODUCT_LABEL, waLink } from '@/lib/normalize';
import { intParam, param, SearchParams, withParams } from '@/lib/params';
import { AutoSubmitSelect } from '@/components/ShellControls';
import { Empty, LoadingBlock, PageHeader, Pagination, ProductSelect, SegmentBadge } from '@/components/ui';
import { formatDate, formatDays, formatNumber, formatPhone, formatRupiah } from '@/utils/formatters';

const PAGE_SIZE = 50;

const WINDOWS = [
  { value: '', label: 'Semua yang perlu di-follow-up' },
  { value: 'segera', label: `Jatuh tempo ≤ ${RO_REMINDER_LEAD_DAYS} hari lagi` },
  { value: 'lewat', label: 'Lewat jatuh tempo ≤ 30 hari' },
  { value: 'lama', label: 'Lewat jatuh tempo > 30 hari' },
];

export default function ReminderPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <>
      <PageHeader
        title="Reminder Repeat Order"
        description={`Customer yang sudah waktunya beli lagi, berdasarkan kebiasaan jarak beli masing-masing (customer 1x beli: ${DEFAULT_RO_INTERVAL_DAYS} hari). Customer churn (> ${STATUS_RULES.pasifMaxDays} hari) tidak ditampilkan.`}
      />
      <Suspense fallback={<LoadingBlock />}>
        <Reminder searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Reminder({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const produk = param(sp, 'produk', DEFAULT_PRODUCT_FILTER);
  const cs = param(sp, 'cs');
  const win = param(sp, 'jendela');
  const { ds, view } = await getView(produk);

  const due = view.customers
    .filter((c) => c.recency <= STATUS_RULES.pasifMaxDays && (!cs || c.lastCs === cs))
    .map((c) => {
      const interval = c.avgInterval && c.avgInterval > 0 ? c.avgInterval : DEFAULT_RO_INTERVAL_DAYS;
      return { c, interval, overdue: c.recency - interval };
    })
    .filter(({ overdue }) => {
      if (overdue < -RO_REMINDER_LEAD_DAYS) return false;
      if (win === 'segera') return overdue <= 0;
      if (win === 'lewat') return overdue > 0 && overdue <= 30;
      if (win === 'lama') return overdue > 30;
      return true;
    })
    .sort((a, b) => a.overdue - b.overdue);

  const totalPages = Math.max(1, Math.ceil(due.length / PAGE_SIZE));
  const page = Math.min(intParam(sp, 'page', 1), totalPages);
  const rows = due.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div className="table-card">
      <Form action="" className="filter-bar boxed">
        <ProductSelect value={produk} />
        <label className="field">
          <span>Waktu</span>
          <AutoSubmitSelect name="jendela" defaultValue={win}>
            {WINDOWS.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <label className="field">
          <span>CS terakhir</span>
          <AutoSubmitSelect name="cs" defaultValue={cs}>
            <option value="">Semua CS</option>
            {csOptions(view).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
      </Form>

      <div className="table-toolbar">
        <span>
          <strong>{formatNumber(due.length)}</strong> customer perlu di-follow-up (per data {formatDate(ds.refDate)})
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty>Tidak ada customer yang jatuh tempo RO untuk filter ini.</Empty>
      ) : (
        <div className="table-wrapper">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Terakhir beli</th>
                <th>Biasanya beli tiap</th>
                <th>Jatuh tempo</th>
                <th className="num">Order</th>
                <th className="num">Total belanja</th>
                <th>Produk terakhir</th>
                <th>CS</th>
                <th>Segmen</th>
                <th>Hubungi</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, interval, overdue }) => (
                <tr key={c.phone}>
                  <td>
                    <Link className="link strong" href={`/customers/${c.phone}?produk=${produk}`}>
                      {c.name}
                    </Link>
                    <div className="muted-small">
                      {formatPhone(c.phone)} · {c.kota || '-'}
                    </div>
                  </td>
                  <td className="nowrap">
                    {formatDate(c.lastDate)}
                    <div className="muted-small">{formatDays(c.recency)} lalu</div>
                  </td>
                  <td className="nowrap">
                    {formatDays(interval)}
                    {!c.avgInterval && <div className="muted-small">(default, baru 1x beli)</div>}
                  </td>
                  <td className="nowrap">
                    {overdue <= 0 ? (
                      <span className="pill tone-warning">{overdue === 0 ? 'Hari ini' : `${-overdue} hari lagi`}</span>
                    ) : (
                      <span className={`pill tone-${overdue > 30 ? 'danger' : 'info'}`}>Lewat {formatDays(overdue)}</span>
                    )}
                  </td>
                  <td className="num">{c.orders}</td>
                  <td className="num nowrap">{formatRupiah(c.spend)}</td>
                  <td>{PRODUCT_LABEL[c.lastProduct]}</td>
                  <td>{c.lastCs}</td>
                  <td>
                    <SegmentBadge segment={c.segment} />
                  </td>
                  <td>
                    <a
                      className="wa"
                      target="_blank"
                      rel="noreferrer"
                      href={waLink(
                        c.phone,
                        `Halo kak ${c.name}, semoga sehat selalu. Stok ${PRODUCT_LABEL[c.lastProduct]} kakak sepertinya sudah mau habis, mau kami siapkan pesanan berikutnya?`,
                      )}
                    >
                      <MessageCircle size={14} /> WhatsApp
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} href={(p) => withParams('/reminder', sp, { page: p })} />
    </div>
  );
}
