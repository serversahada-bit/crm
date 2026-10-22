import { Suspense } from 'react';
import Form from 'next/form';
import { CalendarRange, Hourglass, Repeat, ShoppingCart } from 'lucide-react';
import { computeCohort, computeLifetime } from '@/lib/cohort';
import { getView, monthLabel } from '@/lib/dataset';
import { DEFAULT_PRODUCT_FILTER } from '@/lib/normalize';
import { param, SearchParams } from '@/lib/params';
import { AutoSubmitSelect } from '@/components/ShellControls';
import { Card, HBars, Kpi, LoadingBlock, PageHeader, ProductSelect, StackedBars } from '@/components/ui';
import { formatDays, formatNumber, formatPercent } from '@/utils/formatters';

const YEARS = ['2023', '2024', '2025', '2026'];

export default function CohortPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <>
      <PageHeader
        title="Analisa Cohort"
        description="Customer dikelompokkan berdasarkan bulan pertama beli, lalu dilihat berapa persen yang masih beli di bulan-bulan berikutnya."
      />
      <Suspense fallback={<LoadingBlock />}>
        <Cohort searchParams={searchParams} />
      </Suspense>
    </>
  );
}

function heat(ratio: number): string {
  // Skala warna retensi: 0% transparan, >= 40% paling pekat.
  const pct = Math.min(90, Math.round(10 + (ratio / 0.4) * 80));
  return `color-mix(in srgb, var(--success) ${ratio > 0 ? pct : 0}%, transparent)`;
}

async function Cohort({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const produk = param(sp, 'produk', DEFAULT_PRODUCT_FILTER);
  const tahun = param(sp, 'tahun');
  const tampil = param(sp, 'tampil', 'persen');
  const { ds, view } = await getView(produk);

  const from = tahun ? +tahun * 12 : undefined;
  const to = tahun ? +tahun * 12 + 11 : undefined;
  const cohort = computeCohort(ds, view, from, to);
  const life = computeLifetime(view);
  const curve = cohort.average.slice(1, 25);

  return (
    <>
      <Form action="" className="filter-bar">
        <ProductSelect value={produk} />
        <label className="field">
          <span>Tahun cohort</span>
          <AutoSubmitSelect name="tahun" defaultValue={tahun}>
            <option value="">Semua (2023 - sekarang)</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <label className="field">
          <span>Tampilkan</span>
          <AutoSubmitSelect name="tampil" defaultValue={tampil}>
            <option value="persen">Persentase</option>
            <option value="jumlah">Jumlah customer</option>
          </AutoSubmitSelect>
        </label>
      </Form>

      <div className="stats-grid">
        <Kpi
          label="Repeat Rate"
          value={formatPercent(life.repeatRate)}
          hint={`${formatNumber(life.repeaters)} dari ${formatNumber(life.customers)} customer pernah RO`}
          icon={Repeat}
          tone="emerald"
        />
        <Kpi label="Rata-rata Order" value={`${formatNumber(life.avgOrders, 2)}x`} hint="Per customer selama 2023 - sekarang" icon={ShoppingCart} />
        <Kpi
          label="Lama Bertahan"
          value={formatDays(life.medianLifetimeRepeaters)}
          hint={`Median customer RO (rata-rata ${formatDays(life.avgLifetimeRepeaters)}), dari order pertama ke terakhir`}
          icon={Hourglass}
          tone="purple"
        />
        <Kpi
          label="Jarak Antar Beli"
          value={formatDays(life.medianInterval)}
          hint="Median jarak antar pembelian customer RO"
          icon={CalendarRange}
          tone="amber"
        />
      </div>

      <div className="grid-3">
        <Card title="Kurva Retensi" description="Rata-rata % customer yang beli lagi di bulan ke-N setelah order pertama.">
          <StackedBars
            data={curve.map((v, i) => ({ label: `B${i + 1}`, values: { r: v ?? 0 } }))}
            series={[{ key: 'r', label: '% customer beli lagi', color: 'var(--success)' }]}
            format={(v) => formatPercent(v)}
          />
        </Card>
        <Card title="Berapa Lama Customer Bertahan" description="Jarak order pertama ke order terakhir.">
          <HBars
            items={life.buckets.map((b) => ({ label: b.label, value: b.count, sub: `(${formatPercent(life.customers ? b.count / life.customers : 0)})` }))}
            color="var(--purple)"
          />
        </Card>
        <Card title="Frekuensi Pembelian" description="Berapa kali customer membeli.">
          <HBars
            items={life.roDistribution.map((b) => ({ label: b.label, value: b.count, sub: `(${formatPercent(life.customers ? b.count / life.customers : 0)})` }))}
            color="var(--info)"
          />
        </Card>
      </div>

      <Card
        title="Tabel Retensi Cohort"
        description="Baris = bulan pertama beli. Kolom B1, B2, ... = bulan ke-N setelahnya. Angka = % (atau jumlah) customer cohort tsb yang order lagi di bulan itu."
      >
        <div className="table-wrapper cohort-wrap">
          <table className="cohort-table">
            <thead>
              <tr>
                <th className="sticky">Cohort</th>
                <th className="num">Customer</th>
                {Array.from({ length: cohort.maxOffset }, (_, i) => (
                  <th key={i}>B{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="avg-row">
                <th className="sticky">Rata-rata</th>
                <td className="num">{formatNumber(cohort.rows.reduce((s, r) => s + r.size, 0))}</td>
                {cohort.average.slice(1).map((v, i) => (
                  <td key={i} style={{ background: v === null ? undefined : heat(v) }}>
                    {v === null ? '' : formatPercent(v)}
                  </td>
                ))}
              </tr>
              {cohort.rows.map((row) => (
                <tr key={row.month}>
                  <th className="sticky">{monthLabel(row.month)}</th>
                  <td className="num">{formatNumber(row.size)}</td>
                  {Array.from({ length: cohort.maxOffset }, (_, i) => {
                    const n = row.active[i + 1];
                    if (n === undefined) return <td key={i} className="blank" />;
                    const ratio = row.size ? n / row.size : 0;
                    return (
                      <td key={i} style={{ background: heat(ratio) }} title={`${formatNumber(n)} dari ${formatNumber(row.size)} customer`}>
                        {tampil === 'jumlah' ? formatNumber(n) : formatPercent(ratio)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  );
}
