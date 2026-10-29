import { connection } from 'next/server';
import { getDataset } from '@/lib/dataset';
import { formatDate, formatNumber } from '@/utils/formatters';

export async function DataFreshness() {
  await connection(); // di luar catch agar sinyal render dinamis Next.js tidak tertelan
  const ds = await getDataset().catch(() => null);
  if (!ds) return null;
  const time = ds.loadedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  // Tanggal upload terakhir (bukan tanggal order terakhir); jika tidak tercatat, pakai tanggal order terakhir.
  const upload = ds.lastUpload ? `${formatDate(ds.lastUpload.slice(0, 10))} ${ds.lastUpload.slice(11, 16).replace(':', '.')}` : null;
  return (
    <div className="freshness" title={`Order terakhir di data: ${formatDate(ds.refDate)}`}>
      <span className="dot ok" />
      <div>
        <div>{upload ? `Upload ${upload}` : `Data s/d ${formatDate(ds.refDate)}`}</div>
        <div className="muted-small">
          {formatNumber(ds.totals.valid)} order · dimuat {time}
        </div>
      </div>
    </div>
  );
}
