import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { Download } from 'lucide-react';
import { FREQUENCY_SCORE, RECENCY_SCORE } from '@/lib/config';
import { dataYears, getView } from '@/lib/dataset';
import { DEFAULT_PRODUCT_FILTER } from '@/lib/normalize';
import { param, SearchParams } from '@/lib/params';
import { SEGMENT_BY_ID, SEGMENTS, segmentOf } from '@/lib/rfm';
import { rfmSummary } from '@/lib/summary';
import { AutoSubmitSelect } from '@/components/ShellControls';
import { Card, LoadingBlock, PageHeader, ProductSelect } from '@/components/ui';
import { formatCompactRupiah, formatDate, formatDays, formatNumber, formatPercent, formatRupiah } from '@/utils/formatters';

export default function RfmPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <>
      <PageHeader
        title="Analisa RFM"
        description="Mengelompokkan customer berdasarkan Recency (kapan terakhir beli), Frequency (berapa kali beli), dan Monetary (total belanja)."
      />
      <Suspense fallback={<LoadingBlock />}>
        <Rfm searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Rfm({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const produk = param(sp, 'produk', DEFAULT_PRODUCT_FILTER);
  const { ds, view } = await getView(produk, param(sp, 'periode'));
  const periode = view.year ? String(view.year) : '';
  const cs = view.customers;
  const query = `produk=${produk}${periode ? `&periode=${periode}` : ''}`;
  const yearEnd = periode && `${periode}-12-31` < ds.refDate ? `${periode}-12-31` : ds.refDate;
  // Di-cache sampai data dimuat ulang.
  const { totalSpend, stats, grid, gridMax, mBreaks } = rfmSummary(view);

  const recencyText = (score: number) => {
    const idx = RECENCY_SCORE.findIndex((r) => r.score === score);
    if (idx === -1) return `> ${RECENCY_SCORE[RECENCY_SCORE.length - 1].maxDays} hari`;
    const lower = idx === 0 ? 0 : RECENCY_SCORE[idx - 1].maxDays + 1;
    return `${lower}-${RECENCY_SCORE[idx].maxDays} hari`;
  };
  const freqText = (score: number) => {
    const idx = FREQUENCY_SCORE.findIndex((r) => r.score === score);
    const min = FREQUENCY_SCORE[idx].minOrders;
    const max = idx === 0 ? null : FREQUENCY_SCORE[idx - 1].minOrders - 1;
    return max === null ? `≥ ${min}x` : min === max ? `${min}x` : `${min}-${max}x`;
  };
  const monetaryText = (score: number) => {
    const lo = score === 1 ? 0 : mBreaks[score - 2];
    const hi = score === 5 ? null : mBreaks[score - 1];
    return hi === null ? `> ${formatCompactRupiah(lo)}` : `${score === 1 ? '≤' : formatCompactRupiah(lo) + ' -'} ${formatCompactRupiah(hi)}`;
  };

  return (
    <>
      <Form action="" className="filter-bar">
        <ProductSelect value={produk} />
        <label className="field">
          <span>Periode transaksi</span>
          <AutoSubmitSelect name="periode" defaultValue={periode}>
            <option value="">Semua (2023 - sekarang)</option>
            {dataYears(ds).map((y) => (
              <option key={y} value={y}>
                Tahun {y}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
      </Form>

      {periode && (
        <div className="note">
          <span>
            RFM tahun {periode}: hanya {formatNumber(cs.length)} customer yang order di tahun {periode}, dengan Frequency & Monetary dari
            order tahun itu saja dan Recency dihitung per {formatDate(yearEnd)}.
          </span>
        </div>
      )}

      <div className="segment-grid">
        {SEGMENTS.map((seg) => {
          const s = stats.get(seg.id)!;
          return (
            <div className="segment-card" key={seg.id} style={{ borderTopColor: seg.color }}>
              <div className="segment-card-head">
                <h4 style={{ color: seg.color }}>{seg.label}</h4>
                <span className="segment-share">{formatPercent(cs.length ? s.count / cs.length : 0)}</span>
              </div>
              <div className="segment-count">{formatNumber(s.count)} <span>customer</span></div>
              <p className="segment-desc">{seg.description}</p>
              <dl className="segment-stats">
                <div>
                  <dt>Kontribusi omzet</dt>
                  <dd>{formatPercent(totalSpend ? s.spend / totalSpend : 0)}</dd>
                </div>
                <div>
                  <dt>Rata-rata order</dt>
                  <dd>{s.count ? formatNumber(s.orders / s.count, 1) : '-'}x</dd>
                </div>
                <div>
                  <dt>Terakhir beli</dt>
                  <dd>{s.count ? `${formatDays(Math.round(s.recency / s.count))} lalu` : '-'}</dd>
                </div>
                <div>
                  <dt>Rata-rata belanja</dt>
                  <dd>{s.count ? formatRupiah(Math.round(s.spend / s.count)) : '-'}</dd>
                </div>
              </dl>
              <p className="segment-action">💡 {seg.action}</p>
              <div className="segment-links">
                <Link className="link" href={`/customers?${query}&segmen=${seg.id}`}>
                  Lihat customer →
                </Link>
                <a className="link" href={`/api/export/customers?${query}&segmen=${seg.id}`}>
                  <Download size={13} /> Excel
                </a>
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid-2">
        <Card title="Peta Recency × Frequency" description="Jumlah customer di tiap kombinasi skor. Warna = segmen, makin pekat = makin banyak.">
          <div className="rf-grid">
            <div className="rf-axis-y">Recency (R)</div>
            <table>
              <tbody>
                {[5, 4, 3, 2, 1].map((r) => (
                  <tr key={r}>
                    <th>
                      R{r}
                      <span>{recencyText(r)}</span>
                    </th>
                    {[1, 2, 3, 4, 5].map((f) => {
                      const seg = SEGMENT_BY_ID[segmentOf(r, f)];
                      const n = grid[r - 1][f - 1];
                      const alpha = 15 + Math.round((n / gridMax) * 70);
                      return (
                        <td
                          key={f}
                          title={`${seg.label}: ${formatNumber(n)} customer`}
                          style={{ background: `color-mix(in srgb, ${seg.color} ${alpha}%, transparent)` }}
                        >
                          <Link href={`/customers?${query}&segmen=${seg.id}`}>
                            <strong>{formatNumber(n)}</strong>
                            <span>{seg.label}</span>
                          </Link>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <th />
                  {[1, 2, 3, 4, 5].map((f) => (
                    <th key={f}>
                      F{f}
                      <span>{freqText(f)}</span>
                    </th>
                  ))}
                </tr>
              </tfoot>
            </table>
            <div className="rf-axis-x">Frequency (F)</div>
          </div>
        </Card>

        <Card title="Cara Skor Dihitung" description="Skor 1 (terendah) sampai 5 (terbaik). Aturan bisa diubah di src/lib/config.ts.">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Skor</th>
                <th>Recency</th>
                <th>Frequency</th>
                <th>Monetary</th>
              </tr>
            </thead>
            <tbody>
              {[5, 4, 3, 2, 1].map((s) => (
                <tr key={s}>
                  <td>
                    <strong>{s}</strong>
                  </td>
                  <td>{recencyText(s)}</td>
                  <td>{freqText(s)} order</td>
                  <td>{monetaryText(s)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted-small" style={{ marginTop: '0.75rem' }}>
            Recency dihitung dari order terakhir di data (atau 31 Desember bila memilih periode tahun). Beberapa order di hari yang sama dihitung 1 kali beli. Monetary dibagi per
            kuintil (20%) total belanja customer, dan segmen ditentukan dari kombinasi R dan F.
          </p>
        </Card>
      </div>
    </>
  );
}
