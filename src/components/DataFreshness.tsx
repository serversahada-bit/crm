import { connection } from 'next/server';
import { getDataset } from '@/lib/dataset';
import { formatDate, formatNumber } from '@/utils/formatters';

export async function DataFreshness() {
  await connection(); // di luar catch agar sinyal render dinamis Next.js tidak tertelan
  const ds = await getDataset().catch(() => null);
  if (!ds) {
    return (
      <div className="freshness">
        <span className="dot err" />
        <div className="muted-small">Database tidak terhubung</div>
      </div>
    );
  }
  const time = ds.loadedAt.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
  return (
    <div className="freshness">
      <span className="dot ok" />
      <div>
        <div>Data s/d {formatDate(ds.refDate)}</div>
        <div className="muted-small">
          {formatNumber(ds.totals.valid)} order · dimuat {time}
        </div>
      </div>
    </div>
  );
}
