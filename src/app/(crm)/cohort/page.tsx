import { Suspense } from 'react';
import Form from 'next/form';
import { CalendarRange, Hourglass, Repeat, ShoppingCart } from 'lucide-react';
import { cohortSummary, sourceComparison } from '@/lib/cohort';
import { dataYears, getView, monthLabel } from '@/lib/dataset';
import { CUSTOMER_SOURCES, DEFAULT_PRODUCT_FILTER } from '@/lib/normalize';
import { param, SearchParams } from '@/lib/params';
import { AutoSubmitSelect } from '@/components/ShellControls';
import { Card, HBars, Kpi, LoadingBlock, PageHeader, ProductSelect, StackedBars } from '@/components/ui';
import { formatDays, formatNumber, formatPercent } from '@/utils/formatters';

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

/** Bulan ke-N yang ditampilkan di perbandingan sumber customer. */
const SOURCE_OFFSETS = [1, 2, 3, 6, 12];

function heat(ratio: number): string {
  // Skala warna retensi: 0% transparan, >= 40% paling pekat.
  const pct = Math.min(90, Math.round(10 + (ratio / 0.4) * 80));
  return `color-mix(in srgb, var(--success) ${ratio > 0 ? pct : 0}%, transparent)`;
}

async function Cohort({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const produk = param(sp, 'produk', DEFAULT_PRODUCT_FILTER);
  const tahun = param(sp, 'tahun');
  const sumber = param(sp, 'sumber');
  const tampil = param(sp, 'tampil', 'persen');
  const { ds, view } = await getView(produk);

  // Tahun & sumber berlaku untuk semua angka di halaman ini, bukan hanya tabel cohort. Hasilnya di-cache.
  const { cohort, life } = cohortSummary(ds, view, tahun, sumber);
  const curve = cohort.average.slice(1, 25);
  const sumberLabel = CUSTOMER_SOURCES.find((s) => s.value === sumber)?.label;
  const periodLabel = tahun ? `customer baru ${tahun}` : '2023 - sekarang';
  const bySource = sourceComparison(ds, view, tahun);

  return (
    <>
      <Form action="" className="filter-bar">
        <ProductSelect value={produk} />
        <label className="field">
          <span>Tahun cohort</span>
          <AutoSubmitSelect name="tahun" defaultValue={tahun}>
            <option value="">Semua (2023 - sekarang)</option>
            {dataYears(ds).map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <label className="field">
          <span>Sumber customer</span>
          <AutoSubmitSelect name="sumber" defaultValue={sumber}>
            <option value="">Semua sumber</option>
            {CUSTOMER_SOURCES.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
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
        <Kpi
          label="Rata-rata Order"
          value={`${formatNumber(life.avgOrders, 2)}x`}
          hint={`Per customer (${periodLabel}${sumberLabel ? `, ${sumberLabel}` : ''})`}
          icon={ShoppingCart}
        />
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

      <Card
        title="Perbandingan Sumber Customer"
        description={`Retensi customer baru berdasarkan channel order pertama (${periodLabel}). B1 = % yang beli lagi 1 bulan setelah bulan pertama, dst.`}
      >
        <div className="table-wrapper">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Sumber</th>
                <th className="num">Customer baru</th>
                <th className="num">Repeat rate</th>
                {SOURCE_OFFSETS.map((k) => (
                  <th key={k} className="num">
                    B{k}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bySource.map((s) => (
                <tr key={s.value} className={s.value === sumber ? 'row-highlight' : undefined}>
                  <td>
                    <strong>{s.label}</strong>
                  </td>
                  <td className="num">{formatNumber(s.life.customers)}</td>
                  <td className="num">{formatPercent(s.life.repeatRate)}</td>
                  {SOURCE_OFFSETS.map((k) => {
                    const v = s.cohort.average[k];
                    return (
                      <td key={k} className="num" style={{ background: v == null ? undefined : heat(v) }}>
                        {v == null ? '-' : formatPercent(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

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
        title={sumberLabel ? `Tabel Retensi Cohort: Customer Baru ${sumberLabel}` : 'Tabel Retensi Cohort'}
        description={`Baris = bulan pertama beli${sumberLabel ? ` (order pertama lewat ${sumberLabel})` : ''}. Kolom B1, B2, ... = bulan ke-N setelahnya. Angka = % (atau jumlah) customer cohort tsb yang order lagi di bulan itu. Order retur / gagal kirim tidak dihitung.`}
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
