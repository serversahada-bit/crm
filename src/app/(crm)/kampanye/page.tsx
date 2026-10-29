import { Suspense } from 'react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { getView } from '@/lib/dataset';
import { campaignProgress, campaignStatus, listCampaigns, loadMembers } from '@/lib/kampanye';
import { DEFAULT_PRODUCT_FILTER, PRODUCT_FILTERS } from '@/lib/normalize';
import { SEGMENT_BY_ID, SEGMENTS } from '@/lib/rfm';
import { Card, Empty, LoadingBlock, PageHeader } from '@/components/ui';
import { CreateCampaignForm } from '@/components/KampanyeForms';
import { formatDate, formatNumber, formatPercent } from '@/utils/formatters';

export default function KampanyePage() {
  return (
    <>
      <PageHeader
        title="Kampanye Treatment"
        description="Pantau hasil treatment satu segmen RFM: berapa customer di segmen tsb yang closing lagi sejak kampanye dimulai, dibandingkan target CR."
      />
      <Suspense fallback={<LoadingBlock />}>
        <KampanyeList />
      </Suspense>
    </>
  );
}

const STATUS_TONE = { 'Belum mulai': 'info', Berjalan: 'warning', Selesai: '' } as const;

/** Tanggal 1 bulan depan, default tanggal mulai kampanye. */
function nextMonthStart(): string {
  const d = new Date();
  return new Date(Date.UTC(d.getFullYear(), d.getMonth() + 1, 1)).toISOString().slice(0, 10);
}

async function KampanyeList() {
  const { ds, view } = await getView(DEFAULT_PRODUCT_FILTER);
  const isAdmin = (await getCurrentUser())?.role === 'admin';
  const campaigns = await listCampaigns();
  const rows = await Promise.all(
    campaigns.map(async (c) => {
      await getView(c.produk); // pastikan data produk kampanye sudah dihitung
      return { c, status: campaignStatus(ds, c), progress: campaignProgress(ds, c, await loadMembers(c.id)) };
    }),
  );
  const segmentCounts = new Map<string, number>();
  for (const c of view.customers) segmentCounts.set(c.segment, (segmentCounts.get(c.segment) ?? 0) + 1);

  const list = (
    <section className="table-card">
      <div className="table-toolbar">
        <span>
          <strong>{rows.length}</strong> kampanye · data per {formatDate(ds.refDate)}
        </span>
      </div>
      {rows.length === 0 ? (
        <Empty>Belum ada kampanye.{isAdmin ? ' Buat kampanye pertama di samping.' : ''}</Empty>
      ) : (
        <div className="table-wrapper">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Kampanye</th>
                <th>Periode</th>
                <th className="num">Target</th>
                <th className="num">Closing</th>
                <th className="num">CR</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ c, status, progress }) => (
                <tr key={c.id}>
                  <td>
                    <Link className="link strong" href={`/kampanye/${c.id}`}>
                      {c.nama}
                    </Link>
                    <div className="muted-small">
                      {SEGMENT_BY_ID[c.segment]?.label ?? c.segment} · {PRODUCT_FILTERS.find((p) => p.value === c.produk)?.label}
                    </div>
                  </td>
                  <td className="nowrap">
                    {formatDate(c.mulai)} - {c.selesai ? formatDate(c.selesai) : 'sekarang'}
                  </td>
                  <td className="num">{formatNumber(c.targetCount)}</td>
                  <td className="num">
                    {formatNumber(progress.closing)} / {formatNumber(progress.needed)}
                  </td>
                  <td className="num nowrap">
                    <strong>{formatPercent(progress.cr, 2)}</strong>
                    <div className="muted-small">target {formatNumber(c.targetCr, 2)}%</div>
                  </td>
                  <td>
                    <span className={`pill tone-${STATUS_TONE[status]}`}>{status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  if (!isAdmin) return list;
  return (
    <div className="grid-users">
      {list}
      <Card title="Buat Kampanye" description="Daftar customer segmen yang dipilih akan dibekukan sebagai target kampanye.">
        <CreateCampaignForm
          segments={SEGMENTS.map((s) => ({ id: s.id, label: s.label, count: segmentCounts.get(s.id) ?? 0 }))}
          defaultSegment="cant_lose"
          defaultProduct={DEFAULT_PRODUCT_FILTER}
          defaultMulai={nextMonthStart()}
        />
      </Card>
    </div>
  );
}
