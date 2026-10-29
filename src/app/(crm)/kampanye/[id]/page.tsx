import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, Download, MessageCircle, Package, Percent, Target, Users } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { getView, toDay } from '@/lib/dataset';
import { campaignProgress, campaignStatus, findCampaign, loadMembers, MemberResult } from '@/lib/kampanye';
import { CHANNEL_CRM, PRODUCT_FILTERS, waLink } from '@/lib/normalize';
import { intParam, param, SearchParams, withParams } from '@/lib/params';
import { SEGMENT_BY_ID } from '@/lib/rfm';
import { AutoSubmitSelect } from '@/components/ShellControls';
import { Card, Empty, HBars, Kpi, LoadingBlock, Pagination, StackedBars } from '@/components/ui';
import { formatCompactRupiah, formatDate, formatDays, formatNumber, formatPercent, formatPhone, formatRupiah } from '@/utils/formatters';
import { deleteCampaignAction, resnapshotAction } from '../actions';

const PAGE_SIZE = 50;

export default function KampanyeDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<SearchParams>;
}) {
  return (
    <Suspense fallback={<LoadingBlock />}>
      <KampanyeDetail params={params} searchParams={searchParams} />
    </Suspense>
  );
}

const SHORT_DATE = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** Closing baru per minggu sejak tanggal mulai, dipisah lewat CRM vs channel lain. */
function weeklyClosing(mulai: string, until: string, closed: MemberResult[]) {
  const start = toDay(mulai);
  const weeks = Math.max(1, Math.floor((toDay(until) - start) / 7) + 1);
  const data = Array.from({ length: weeks }, (_, i) => ({
    label: SHORT_DATE.format(new Date((start + i * 7) * 86_400_000)),
    values: { crm: 0, lain: 0 },
  }));
  for (const m of closed) {
    const w = Math.floor((toDay(m.closingDate!) - start) / 7);
    if (data[w]) data[w].values[m.closingChannel === CHANNEL_CRM ? 'crm' : 'lain']++;
  }
  return data;
}

async function KampanyeDetail({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<SearchParams> }) {
  const id = Number((await params).id);
  const sp = await searchParams;
  const campaign = Number.isInteger(id) ? await findCampaign(id) : null;
  if (!campaign) notFound();

  const { ds } = await getView(campaign.produk);
  const isAdmin = (await getCurrentUser())?.role === 'admin';
  const status = campaignStatus(ds, campaign);
  const progress = campaignProgress(ds, campaign, await loadMembers(campaign.id));
  const closed = progress.members.filter((m) => m.closingDate);
  const segment = SEGMENT_BY_ID[campaign.segment];
  const productLabel = PRODUCT_FILTERS.find((p) => p.value === campaign.produk)?.label ?? campaign.produk;
  const reached = progress.closing >= progress.needed;

  const tab = param(sp, 'tab') === 'closing' ? 'closing' : 'belum';
  const crm = param(sp, 'crm');
  const crmNames = [...new Set(progress.members.map((m) => m.crm || '(tanpa CRM)'))].sort();
  const listed = progress.members
    .filter((m) => (tab === 'closing' ? m.closingDate : !m.closingDate) && (!crm || (m.crm || '(tanpa CRM)') === crm))
    .sort((a, b) => (tab === 'closing' ? (a.closingDate! < b.closingDate! ? 1 : -1) : b.spend - a.spend));
  const totalPages = Math.max(1, Math.ceil(listed.length / PAGE_SIZE));
  const page = Math.min(intParam(sp, 'page', 1), totalPages);
  const pageRows = listed.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const perCrm = crmNames.map((name) => {
    const members = progress.members.filter((m) => (m.crm || '(tanpa CRM)') === name);
    const n = members.filter((m) => m.closingDate).length;
    return { name, target: members.length, closing: n, cr: members.length ? n / members.length : 0 };
  });
  const channels = new Map<string, number>();
  for (const m of closed) channels.set(m.closingChannel, (channels.get(m.closingChannel) ?? 0) + 1);
  const until = campaign.selesai && campaign.selesai < ds.refDate ? campaign.selesai : ds.refDate;

  return (
    <>
      <div className="view-header">
        <div className="view-header-title">
          <Link className="link back" href="/kampanye">
            <ArrowLeft size={15} /> Kampanye Treatment
          </Link>
          <h1>{campaign.nama}</h1>
          <p>
            Segmen <strong style={{ color: segment?.color }}>{segment?.label ?? campaign.segment}</strong> · {productLabel} ·{' '}
            {formatDate(campaign.mulai)} - {campaign.selesai ? formatDate(campaign.selesai) : 'sekarang'} · daftar customer per{' '}
            {formatDate(campaign.snapshotDate)}
          </p>
          <div className="badges">
            <span className={`pill tone-${status === 'Berjalan' ? 'warning' : status === 'Belum mulai' ? 'info' : ''}`}>{status}</span>
            <span className="pill">Data per {formatDate(ds.refDate)}</span>
          </div>
        </div>
        <a className="btn-ghost" href={`/api/export/kampanye/${campaign.id}?tab=${tab}${crm ? `&crm=${encodeURIComponent(crm)}` : ''}`}>
          <Download size={15} /> Export Excel
        </a>
      </div>

      {status === 'Belum mulai' && (
        <div className="note">
          <span>
            Kampanye mulai {formatDate(campaign.mulai)}. Closing dihitung dari order sejak tanggal itu.
            {isAdmin && ' Selama belum mulai, daftar customer bisa diambil ulang dari data terbaru.'}
          </span>
          {isAdmin && (
            <form action={resnapshotAction}>
              <input type="hidden" name="id" value={campaign.id} />
              <button className="link" type="submit">
                Ambil ulang daftar customer →
              </button>
            </form>
          )}
        </div>
      )}

      <div className="stats-grid">
        <Kpi
          label="Target Customer"
          value={formatNumber(campaign.targetCount)}
          hint={`Customer ${segment?.label ?? ''} per ${formatDate(campaign.snapshotDate)}`}
          icon={Users}
        />
        <Kpi
          label="Closing"
          value={`${formatNumber(progress.closing)} / ${formatNumber(progress.needed)}`}
          hint={reached ? 'Target tercapai' : `Butuh ${formatNumber(progress.needed - progress.closing)} closing lagi`}
          icon={Target}
          tone="emerald"
        />
        <Kpi
          label="Conversion Rate"
          value={formatPercent(progress.cr, 2)}
          hint={`Target ${formatNumber(campaign.targetCr, 2)}% · ${formatNumber(progress.viaCrm)} closing lewat CRM`}
          icon={Percent}
          tone="purple"
        />
        <Kpi
          label="Omzet Closing"
          value={formatCompactRupiah(progress.omzet)}
          hint={`${formatNumber(progress.qty)} box/item dari customer closing`}
          icon={Package}
          tone="amber"
        />
      </div>

      <Card title="Progres Target" description="Order retur / gagal kirim dan order non-customer tidak dihitung sebagai closing.">
        <div className={`progress${reached ? ' done' : ''}`}>
          <div style={{ width: `${Math.min(100, progress.needed ? (progress.closing / progress.needed) * 100 : 0)}%` }} />
        </div>
        <div className="progress-meta">
          <span>
            {formatNumber(progress.closing)} closing ({formatPercent(progress.cr, 2)})
          </span>
          <span>
            Target {formatNumber(progress.needed)} closing ({formatNumber(campaign.targetCr, 2)}% dari {formatNumber(campaign.targetCount)})
          </span>
        </div>
      </Card>

      <div className="grid-3">
        <Card title="Closing per Minggu" description="Customer closing baru tiap minggu sejak tanggal mulai.">
          {status === 'Belum mulai' ? (
            <Empty>Belum mulai.</Empty>
          ) : (
            <StackedBars
              data={weeklyClosing(campaign.mulai, until, closed)}
              series={[
                { key: 'crm', label: 'Lewat CRM', color: 'var(--success)' },
                { key: 'lain', label: 'Channel lain', color: 'var(--info)' },
              ]}
            />
          )}
        </Card>
        <Card title="Channel Closing" description="Channel order closing pertama tiap customer.">
          {closed.length === 0 ? (
            <Empty>Belum ada closing.</Empty>
          ) : (
            <HBars items={[...channels.entries()].sort((a, b) => b[1] - a[1]).map(([label, value]) => ({ label, value }))} />
          )}
        </Card>
        <Card title="Per CRM" description="CRM pemegang customer saat daftar dibuat.">
          <div className="table-wrapper">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>CRM</th>
                  <th className="num">Target</th>
                  <th className="num">Closing</th>
                  <th className="num">CR</th>
                </tr>
              </thead>
              <tbody>
                {perCrm
                  .sort((a, b) => b.target - a.target)
                  .map((r) => (
                    <tr key={r.name}>
                      <td>{r.name}</td>
                      <td className="num">{formatNumber(r.target)}</td>
                      <td className="num">{formatNumber(r.closing)}</td>
                      <td className="num">{formatPercent(r.cr, 1)}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      <div className="table-card">
        <Form action="" className="filter-bar boxed">
          <input type="hidden" name="tab" value={tab} />
          <div className="tabs">
            <Link className={`btn-ghost${tab === 'belum' ? ' active' : ''}`} href={withParams(`/kampanye/${campaign.id}`, sp, { tab: null, page: null })}>
              Belum closing ({formatNumber(campaign.targetCount - progress.closing)})
            </Link>
            <Link
              className={`btn-ghost${tab === 'closing' ? ' active' : ''}`}
              href={withParams(`/kampanye/${campaign.id}`, sp, { tab: 'closing', page: null })}
            >
              Sudah closing ({formatNumber(progress.closing)})
            </Link>
          </div>
          <label className="field">
            <span>CRM</span>
            <AutoSubmitSelect name="crm" defaultValue={crm}>
              <option value="">Semua CRM</option>
              {crmNames.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </AutoSubmitSelect>
          </label>
        </Form>

        <div className="table-toolbar">
          <span>
            <strong>{formatNumber(listed.length)}</strong> customer{' '}
            {tab === 'closing' ? 'sudah closing, terbaru di atas' : 'belum closing, urut total belanja terbesar'}
          </span>
        </div>

        {pageRows.length === 0 ? (
          <Empty>Tidak ada customer untuk filter ini.</Empty>
        ) : (
          <div className="table-wrapper">
            <table className="data-table compact">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Terakhir beli sebelum kampanye</th>
                  <th className="num">Order</th>
                  <th className="num">Total belanja</th>
                  <th>CRM</th>
                  {tab === 'closing' ? (
                    <>
                      <th>Closing</th>
                      <th>Channel / CS</th>
                      <th className="num">Box</th>
                      <th className="num">Omzet closing</th>
                    </>
                  ) : (
                    <th>Hubungi</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {pageRows.map((m) => (
                  <tr key={m.phone}>
                    <td>
                      <Link className="link strong" href={`/customers/${m.phone}?produk=${campaign.produk}`}>
                        {m.name || '(tanpa nama)'}
                      </Link>
                      <div className="muted-small">
                        {formatPhone(m.phone)} · {m.kota || '-'}
                      </div>
                    </td>
                    <td className="nowrap">
                      {m.lastDate ? formatDate(m.lastDate) : '-'}
                      {m.lastDate && <div className="muted-small">{formatDays(toDay(campaign.snapshotDate) - toDay(m.lastDate))} sebelum daftar dibuat</div>}
                    </td>
                    <td className="num">{formatNumber(m.orders)}</td>
                    <td className="num nowrap">{formatRupiah(m.spend)}</td>
                    <td>{m.crm || '-'}</td>
                    {tab === 'closing' ? (
                      <>
                        <td className="nowrap">{formatDate(m.closingDate!)}</td>
                        <td>
                          {m.closingChannel}
                          <div className="muted-small">{m.closingCs}</div>
                        </td>
                        <td className="num">{formatNumber(m.closingQty)}</td>
                        <td className="num nowrap">{formatRupiah(m.closingSpend)}</td>
                      </>
                    ) : (
                      <td>
                        <a
                          className="wa"
                          target="_blank"
                          rel="noreferrer"
                          href={waLink(m.phone, `Halo kak ${m.name}, semoga sehat selalu. Sudah lama tidak order ${productLabel}, bagaimana kabarnya kak?`)}
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pagination page={page} totalPages={totalPages} href={(p) => withParams(`/kampanye/${campaign.id}`, sp, { page: p })} />
      </div>

      {isAdmin && (
        <details className="note">
          <summary>Hapus kampanye</summary>
          <form action={deleteCampaignAction}>
            <input type="hidden" name="id" value={campaign.id} />
            <span>Kampanye dan daftar customernya akan dihapus permanen. Data order tidak terpengaruh. </span>
            <button className="link" type="submit" style={{ color: 'var(--danger)' }}>
              Ya, hapus kampanye ini
            </button>
          </form>
        </details>
      )}
    </>
  );
}
