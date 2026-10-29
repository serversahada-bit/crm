import type { NextRequest } from 'next/server';
import { getView } from '@/lib/dataset';
import { campaignProgress, findCampaign, loadMembers } from '@/lib/kampanye';
import { waLink } from '@/lib/normalize';
import { buildXlsx, XlsxColumn } from '@/lib/xlsx';

const COLUMNS: XlsxColumn[] = [
  { header: 'Nama', width: 26 },
  { header: 'No HP', width: 16 },
  { header: 'Link WA', width: 28 },
  { header: 'Kota', width: 20 },
  { header: 'CRM', width: 16 },
  { header: 'Terakhir Beli Sebelum Kampanye', width: 14 },
  { header: 'Jumlah Order', width: 10 },
  { header: 'Total Belanja', width: 14, money: true },
  { header: 'Status', width: 14 },
  { header: 'Tanggal Closing', width: 12 },
  { header: 'Channel Closing', width: 20 },
  { header: 'CS Closing', width: 16 },
  { header: 'Box Closing', width: 10 },
  { header: 'Omzet Closing', width: 14, money: true },
];

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const campaign = await findCampaign(Number((await params).id) || 0);
  if (!campaign) return new Response('Kampanye tidak ditemukan', { status: 404 });
  const { ds } = await getView(campaign.produk); // juga memastikan user sudah login
  const sp = request.nextUrl.searchParams;
  const tab = sp.get('tab') ?? '';
  const crm = sp.get('crm') ?? '';

  const rows = campaignProgress(ds, campaign, await loadMembers(campaign.id))
    .members.filter(
      (m) =>
        (tab === 'closing' ? m.closingDate : tab === 'belum' ? !m.closingDate : true) && (!crm || (m.crm || '(tanpa CRM)') === crm),
    )
    .sort((a, b) => b.spend - a.spend)
    .map((m) => [
      m.name,
      m.phone,
      waLink(m.phone),
      m.kota,
      m.crm,
      m.lastDate,
      m.orders,
      m.spend,
      m.closingDate ? 'Sudah closing' : 'Belum closing',
      m.closingDate,
      m.closingChannel,
      m.closingCs,
      m.closingDate ? m.closingQty : null,
      m.closingDate ? m.closingSpend : null,
    ]);

  const file = await buildXlsx('Kampanye', COLUMNS, rows);
  const filename = `kampanye-${campaign.id}-${tab || 'semua'}-${ds.refDate}.xlsx`;
  return new Response(new Uint8Array(file), {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="${filename}"`,
    },
  });
}
