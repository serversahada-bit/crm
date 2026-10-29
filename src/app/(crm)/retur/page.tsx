import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { MessageCircle, PackageX, UserX, Wallet } from 'lucide-react';
import { dataYears, getView, memo, ReturOrder } from '@/lib/dataset';
import { CHANNEL_CSO, DEFAULT_PRODUCT_FILTER, PRODUCT_FILTERS, PRODUCT_LABEL, waLink } from '@/lib/normalize';
import { intParam, param, SearchParams, withParams } from '@/lib/params';
import { AutoSubmitSelect } from '@/components/ShellControls';
import { Card, Empty, HBars, Kpi, LoadingBlock, PageHeader, Pagination, ProductSelect } from '@/components/ui';
import { formatCompactRupiah, formatDate, formatNumber, formatPercent, formatPhone, formatRupiah } from '@/utils/formatters';

const PAGE_SIZE = 50;

export default function ReturPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <>
      <PageHeader
        title="Customer Retur"
        description="Order yang paketnya retur atau gagal kirim menurut data tracking ekspedisi. Order ini tidak dihitung sebagai pembelian, sehingga tidak menambah jumlah customer baru, total customer, maupun omzet."
      />
      <Suspense fallback={<LoadingBlock />}>
        <Retur searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function countBy(rows: ReturOrder[], key: (r: ReturOrder) => string): [string, number][] {
  const map = new Map<string, number>();
  for (const r of rows) map.set(key(r) || '(tanpa keterangan)', (map.get(key(r) || '(tanpa keterangan)') ?? 0) + 1);
  return [...map.entries()].sort((a, b) => b[1] - a[1]);
}

async function Retur({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const produk = param(sp, 'produk', DEFAULT_PRODUCT_FILTER);
  const tahun = param(sp, 'tahun');
  const sumber = param(sp, 'sumber', 'cso');
  const status = param(sp, 'status');
  const cs = param(sp, 'cs');
  const { ds, view } = await getView(produk);

  const codes = PRODUCT_FILTERS.find((p) => p.value === produk)?.codes;
  // Customer yang punya minimal 1 order sukses (semua produk); sisanya tidak dihitung sebagai customer.
  const isCustomer = (phone: string) => ds.ordersByPhone.has(phone);
  const base = ds.returns.filter(
    (r) =>
      (!codes || codes.includes(r.product)) &&
      (!tahun || r.date.startsWith(tahun)) &&
      (sumber !== 'cso' || r.channel === CHANNEL_CSO),
  );
  const rows = base
    .filter(
      (r) =>
        (!cs || r.cs === cs) && (!status || (status === 'bukan' ? !isCustomer(r.phone) : isCustomer(r.phone))),
    )
    .reverse();

  const phones = new Set(base.map((r) => r.phone));
  const notCustomer = [...phones].filter((p) => !isCustomer(p)).length;
  const lostValue = base.reduce((s, r) => s + r.total, 0);
  // Rasio retur order CSO pada periode & produk yang sama.
  const delivered = memo(
    view,
    `retur-cso|${tahun}`,
    () => view.orders.filter((o) => o.channel === CHANNEL_CSO && (!tahun || o.date.startsWith(tahun))).length,
  );
  const csoReturns = base.filter((r) => r.channel === CHANNEL_CSO).length;

  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(intParam(sp, 'page', 1), totalPages);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <>
      <Form action="" className="filter-bar">
        <ProductSelect value={produk} />
        <label className="field">
          <span>Tahun order</span>
          <AutoSubmitSelect name="tahun" defaultValue={tahun}>
            <option value="">Semua tahun</option>
            {dataYears(ds).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <label className="field">
          <span>Channel</span>
          <AutoSubmitSelect name="sumber" defaultValue={sumber}>
            <option value="cso">CSO (iklan / WA)</option>
            <option value="semua">Semua channel</option>
          </AutoSubmitSelect>
        </label>
        <label className="field">
          <span>Status customer</span>
          <AutoSubmitSelect name="status" defaultValue={status}>
            <option value="">Semua</option>
            <option value="bukan">Belum pernah terima paket (tidak dihitung customer)</option>
            <option value="customer">Sudah jadi customer (ada order sukses)</option>
          </AutoSubmitSelect>
        </label>
        <label className="field">
          <span>CS</span>
          <AutoSubmitSelect name="cs" defaultValue={cs}>
            <option value="">Semua CS</option>
            {countBy(base, (r) => r.cs)
              .filter(([k]) => k !== '-')
              .map(([k]) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
          </AutoSubmitSelect>
        </label>
      </Form>

      <div className="stats-grid">
        <Kpi label="Order Retur / Gagal Kirim" value={formatNumber(base.length)} hint={`${formatNumber(phones.size)} no. HP`} icon={PackageX} tone="amber" />
        <Kpi
          label="Tidak Dihitung Customer"
          value={formatNumber(notCustomer)}
          hint="No. HP yang semua ordernya retur / gagal kirim"
          icon={UserX}
          tone="purple"
        />
        <Kpi
          label="Rasio Retur CSO"
          value={formatPercent(csoReturns + delivered ? csoReturns / (csoReturns + delivered) : 0)}
          hint={`${formatNumber(csoReturns)} dari ${formatNumber(csoReturns + delivered)} order CSO`}
          icon={PackageX}
        />
        <Kpi label="Nilai Order Retur" value={formatCompactRupiah(lostValue)} hint="Tidak masuk omzet customer" icon={Wallet} tone="emerald" />
      </div>

      <div className="grid-2">
        <Card title="Alasan Retur" description="Keterangan dari ekspedisi (10 terbanyak).">
          <HBars items={countBy(base, (r) => r.reason).slice(0, 10).map(([label, value]) => ({ label, value }))} color="var(--danger)" />
        </Card>
        <Card title="Retur per CS" description="CS yang menangani order (10 terbanyak).">
          <HBars
            items={countBy(base, (r) => r.cs)
              .filter(([k]) => k !== '-')
              .slice(0, 10)
              .map(([label, value]) => ({ label, value }))}
            color="var(--warning)"
          />
        </Card>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <span>
            <strong>{formatNumber(rows.length)}</strong> order retur / gagal kirim, terbaru di atas
          </span>
        </div>
        {pageRows.length === 0 ? (
          <Empty>Tidak ada order retur untuk filter ini.</Empty>
        ) : (
          <div className="table-wrapper">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Tanggal</th>
                  <th>Customer</th>
                  <th>Produk</th>
                  <th className="num">Total</th>
                  <th>CS</th>
                  <th>Keterangan</th>
                  <th>Status customer</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => {
                  const customer = isCustomer(r.phone);
                  return (
                    <tr key={`${r.id}-${i}`}>
                      <td className="nowrap">{formatDate(r.date)}</td>
                      <td>
                        {customer ? (
                          <Link className="link strong" href={`/customers/${r.phone}?produk=all`}>
                            {r.name || '(tanpa nama)'}
                          </Link>
                        ) : (
                          <strong>{r.name || '(tanpa nama)'}</strong>
                        )}
                        <div className="muted-small">
                          <a className="wa" href={waLink(r.phone)} target="_blank" rel="noreferrer">
                            <MessageCircle size={12} /> {formatPhone(r.phone)}
                          </a>{' '}
                          · {r.kota || '-'}
                        </div>
                      </td>
                      <td>{PRODUCT_LABEL[r.product]}</td>
                      <td className="num nowrap">{formatRupiah(r.total)}</td>
                      <td>{r.cs}</td>
                      <td>
                        <span className={`pill tone-${r.kind === 'Retur' ? 'danger' : 'warning'}`}>{r.kind}</span>
                        {r.reason && <div className="muted-small">{r.reason}</div>}
                      </td>
                      <td>
                        <span className={`pill tone-${customer ? 'success' : 'danger'}`}>
                          {customer ? 'Sudah jadi customer' : 'Tidak dihitung'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} href={(p) => withParams('/retur', sp, { page: p })} />
      </div>
    </>
  );
}
