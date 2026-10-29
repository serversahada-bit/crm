import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { Repeat, ShieldAlert, UserCheck, Users, Wallet } from 'lucide-react';
import { getView, monthLabel } from '@/lib/dataset';
import { DEFAULT_PRODUCT_FILTER, PRODUCT_FILTERS } from '@/lib/normalize';
import { param, SearchParams } from '@/lib/params';
import { SEGMENTS } from '@/lib/rfm';
import { monthlyCustomers } from '@/lib/summary';
import { Card, HBars, Kpi, LoadingBlock, PageHeader, ProductSelect, StackedBars } from '@/components/ui';
import { formatCompactRupiah, formatNumber, formatPercent } from '@/utils/formatters';

export default function DashboardPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <>
      <PageHeader
        title="Dashboard Customer"
        description="Ringkasan customer 2023 - sekarang: akuisisi, repeat order (RO), dan kesehatan basis customer."
      />
      <Suspense fallback={<LoadingBlock />}>
        <Dashboard searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Dashboard({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const produk = param(sp, 'produk', DEFAULT_PRODUCT_FILTER);
  const { ds, view } = await getView(produk);
  const cs = view.customers;

  const repeaters = cs.filter((c) => c.orders > 1).length;
  const active = cs.filter((c) => c.status === 'Aktif').length;
  const omzet = cs.reduce((s, c) => s + c.spend, 0);
  const productLabel = PRODUCT_FILTERS.find((p) => p.value === produk)?.label ?? '';

  // Customer unik per bulan: baru vs RO (di-cache sampai data dimuat ulang).
  const months = monthlyCustomers(view);
  const shortLabel = (m: number) => monthLabel(m).replace(/ 20(\d\d)$/, " '$1");

  const countBy = (values: string[]) => {
    const map = new Map<string, number>();
    for (const v of values) map.set(v || '(kosong)', (map.get(v || '(kosong)') ?? 0) + 1);
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  };
  const segmentCounts = new Map(countBy(cs.map((c) => c.segment)));
  const channels = countBy(cs.map((c) => c.firstChannel));
  const cities = countBy(cs.map((c) => c.kota)).filter(([k]) => k !== '(kosong)').slice(0, 10);
  const csCounts = countBy(cs.filter((c) => c.orders > 1).map((c) => c.lastCs)).filter(([k]) => k !== '-').slice(0, 10);

  const maskedShare = ds.totals.valid ? ds.totals.masked / ds.totals.valid : 0;

  return (
    <>
      <Form action="" className="filter-bar">
        <ProductSelect value={produk} />
      </Form>

      <div className="stats-grid">
        <Kpi label="Total Customer" value={formatNumber(cs.length)} hint={`No. HP unik yang pernah beli ${productLabel}`} icon={Users} />
        <Kpi
          label="Customer RO"
          value={formatNumber(repeaters)}
          hint={`${formatPercent(cs.length ? repeaters / cs.length : 0)} customer beli lebih dari 1x`}
          icon={Repeat}
          tone="emerald"
        />
        <Kpi
          label="Customer Aktif"
          value={formatNumber(active)}
          hint={`${formatPercent(cs.length ? active / cs.length : 0)} beli dalam 60 hari terakhir`}
          icon={UserCheck}
          tone="purple"
        />
        <Kpi label="Omzet Customer" value={formatCompactRupiah(omzet)} hint={`Rata-rata ${formatCompactRupiah(cs.length ? omzet / cs.length : 0)} / customer`} icon={Wallet} tone="amber" />
      </div>

      <Card title="Customer per Bulan" description="Jumlah customer unik yang order tiap bulan: customer baru vs customer repeat order.">
        <StackedBars
          data={months.map(([m, v]) => ({ label: shortLabel(m), values: { fresh: v.fresh, ro: v.ro } }))}
          series={[
            { key: 'fresh', label: 'Customer baru', color: 'var(--info)' },
            { key: 'ro', label: 'Customer RO', color: 'var(--success)' },
          ]}
        />
      </Card>

      <div className="grid-2">
        <Card
          title="Segmen RFM"
          description="Sebaran customer berdasarkan Recency, Frequency, Monetary."
          actions={<Link className="link" href={`/rfm?produk=${produk}`}>Lihat analisa →</Link>}
        >
          <HBars
            items={SEGMENTS.map((s) => ({
              label: <Link href={`/customers?produk=${produk}&segmen=${s.id}`}>{s.label}</Link>,
              value: segmentCounts.get(s.id) ?? 0,
              color: s.color,
              sub: `(${formatPercent(cs.length ? (segmentCounts.get(s.id) ?? 0) / cs.length : 0)})`,
            }))}
          />
        </Card>
        <Card title="Omzet per Bulan" description="Total nilai order customer teridentifikasi.">
          <StackedBars
            data={months.map(([m, v]) => ({ label: shortLabel(m), values: { omzet: v.omzet } }))}
            series={[{ key: 'omzet', label: 'Omzet', color: 'var(--primary)' }]}
            format={formatCompactRupiah}
          />
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Channel Akuisisi" description="Dari mana customer pertama kali beli.">
          <HBars items={channels.map(([label, value]) => ({ label, value }))} />
        </Card>
        <Card title="Top 10 Kota" description="Jumlah customer per kota.">
          <HBars items={cities.map(([label, value]) => ({ label, value }))} color="var(--purple)" />
        </Card>
        <Card title="Top 10 CS (Customer RO)" description="Customer RO berdasarkan CS order terakhir.">
          <HBars items={csCounts.map(([label, value]) => ({ label, value }))} color="var(--success)" />
        </Card>
      </div>

      <div className="note">
        <ShieldAlert size={16} />
        <span>
          {formatNumber(ds.totals.masked)} order ({formatPercent(maskedShare)}) dari marketplace memakai no. HP yang disamarkan
          (mis. <code>******99</code>) sehingga tidak bisa dihitung sebagai customer. {formatNumber(ds.totals.cancelled)} order
          batal, {formatNumber(ds.totals.retur)} order retur / gagal kirim (data tracking), dan {formatNumber(ds.totals.nonCustomer)}{' '}
          order non-customer (endorse / giveaway: CS Afia, Bagas, Dhani, FF) tidak dihitung, termasuk sebagai customer baru.{' '}
          <Link className="link" href="/retur">
            Lihat customer retur →
          </Link>
        </span>
      </div>
    </>
  );
}
