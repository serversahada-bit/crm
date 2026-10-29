import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import type { RowDataPacket } from 'mysql2';
import { Search } from 'lucide-react';
import { CACHE_TTL_MS, START_DATE } from '@/lib/config';
import { getDataset } from '@/lib/dataset';
import { pool } from '@/lib/db';
import { classifyChannel, classifyProduct, isCancelled, normalizePhone, parseRupiah, PRODUCT_LABEL } from '@/lib/normalize';
import { intParam, param, SearchParams, withParams } from '@/lib/params';
import { AutoSubmitSelect } from '@/components/ShellControls';
import { Empty, LoadingBlock, PageHeader, Pagination } from '@/components/ui';
import { formatDate, formatNumber, formatRupiah } from '@/utils/formatters';

const PAGE_SIZE = 50;
const CANCEL_SQL = "(status REGEXP 'batal|cancel|return|retur|gagal|lost by')";

/** Jumlah transaksi per filter: menghitung ratusan ribu baris itu lambat, jadi disimpan selama CACHE_TTL_MS. */
const countCache = globalThis as unknown as { crmTransaksiCount?: Map<string, { total: number; at: number }> };

async function countRows(whereSql: string, args: unknown[]): Promise<number> {
  const cache = (countCache.crmTransaksiCount ??= new Map());
  const key = `${whereSql}|${JSON.stringify(args)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.total;
  const [[{ total }]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM data_transaksi WHERE ${whereSql}`, args);
  if (cache.size > 500) cache.clear();
  cache.set(key, { total, at: Date.now() });
  return total;
}

async function TotalCount({ whereSql, args }: { whereSql: string; args: unknown[] }) {
  return <strong>{formatNumber(await countRows(whereSql, args))}</strong>;
}

function selectRows(whereSql: string, args: unknown[], limit: number, offset: number) {
  return pool.query<RowDataPacket[]>(
    `SELECT kode_booking, resi, time_stamp, first_name, contack, kota, barang, barang_1, LEFT(isi_paket, 40) AS isi,
            jumlah, total_harga, cs, adv, LEFT(keterangan, 60) AS ket, tipe_pembayaran, LEFT(status, 40) AS status
       FROM data_transaksi WHERE ${whereSql}
      ORDER BY time_stamp DESC LIMIT ? OFFSET ?`,
    [...args, limit, offset],
  );
}

export default function TransaksiPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <>
      <PageHeader title="Riwayat Transaksi" description="Data order mentah dari tabel data_transaksi, terbaru di atas." />
      <Suspense fallback={<LoadingBlock label="Memuat transaksi..." />}>
        <Transaksi searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Transaksi({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const ds = await getDataset(); // daftar resi retur & indeks no. HP sudah ada di memori
  const sp = await searchParams;
  const q = param(sp, 'q');
  const dari = param(sp, 'dari');
  const sampai = param(sp, 'sampai');
  const status = param(sp, 'status');
  const page = intParam(sp, 'page', 1);

  const where: string[] = ['time_stamp >= ?'];
  const args: unknown[] = [START_DATE];
  if (dari) {
    where.push('time_stamp >= ?');
    args.push(dari);
  }
  if (sampai) {
    where.push('time_stamp < DATE_ADD(?, INTERVAL 1 DAY)');
    args.push(sampai);
  }
  // Resi retur diambil dari memori (beberapa ribu), jauh lebih cepat daripada subquery ke tabel tracking per baris.
  const failedResi = [...ds.failedDeliveries.keys()];
  if (status === 'valid') {
    where.push(`NOT ${CANCEL_SQL}`);
    if (failedResi.length) {
      where.push('(resi IS NULL OR resi NOT IN (?))');
      args.push(failedResi);
    }
  }
  if (status === 'batal') where.push(CANCEL_SQL);
  if (status === 'retur') {
    where.push(failedResi.length ? 'resi IN (?)' : 'FALSE');
    if (failedResi.length) args.push(failedResi);
  }
  if (q) {
    const digits = q.replace(/\D/g, '');
    if (digits.length >= 6 && digits.length === q.replace(/[\s+()-]/g, '').length) {
      // Cari no. HP lewat indeks di memori (semua format penulisan sudah diseragamkan), lalu ambil barisnya per id.
      const needle = (normalizePhone(digits) ?? digits).replace(/^62/, '').replace(/^0/, '');
      const ids: number[] = [];
      for (const [phone, list] of ds.rowIdsByPhone) if (phone.includes(needle)) ids.push(...list);
      where.push(ids.length ? '(id IN (?) OR kode_booking = ? OR resi = ?)' : '(kode_booking = ? OR resi = ?)');
      if (ids.length) args.push(ids.slice(0, 20_000));
      args.push(q, q);
    } else {
      where.push('(kode_booking = ? OR resi = ? OR first_name LIKE ?)');
      args.push(q, q, `%${q}%`);
    }
  }
  const whereSql = where.join(' AND ');

  let found: RowDataPacket[];
  let total: number | null = null; // diketahui langsung dari memori; null = dihitung di database (menyusul)
  if (status === 'retur' && !q) {
    // Daftar ribuan resi di IN (...) lambat di MariaDB. Urutan & halaman diambil dari memori, database cukup 1 halaman.
    const list = ds.failedRows.filter((r) => {
      const day = r.time.slice(0, 10);
      return r.time >= START_DATE && (!dari || day >= dari) && (!sampai || day <= sampai);
    });
    total = list.length;
    const ids = list.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE + 1).map((r) => r.id);
    found = ids.length ? (await selectRows('id IN (?)', [ids], PAGE_SIZE + 1, 0))[0] : [];
  } else {
    // Ambil 1 baris lebih untuk tahu ada halaman berikutnya; jumlah total dihitung terpisah agar tabel tidak menunggu.
    [found] = await selectRows(whereSql, args, PAGE_SIZE + 1, (page - 1) * PAGE_SIZE);
  }
  const hasNext = found.length > PAGE_SIZE;
  const rows = found.slice(0, PAGE_SIZE);
  const failed = ds.failedDeliveries;

  return (
    <div className="table-card">
      <Form action="" className="filter-bar boxed">
        <label className="field grow">
          <span>Cari</span>
          <div className="input-icon">
            <Search size={15} />
            <input className="input-text" name="q" defaultValue={q} placeholder="Kode booking, resi, nama, atau no. HP..." />
          </div>
        </label>
        <label className="field">
          <span>Dari tanggal</span>
          <input className="input-text" type="date" name="dari" defaultValue={dari} min={START_DATE} />
        </label>
        <label className="field">
          <span>Sampai tanggal</span>
          <input className="input-text" type="date" name="sampai" defaultValue={sampai} min={START_DATE} />
        </label>
        <label className="field">
          <span>Status</span>
          <AutoSubmitSelect name="status" defaultValue={status}>
            <option value="">Semua</option>
            <option value="valid">Valid (tidak batal / retur)</option>
            <option value="batal">Batal (status order)</option>
            <option value="retur">Retur / gagal kirim (tracking)</option>
          </AutoSubmitSelect>
        </label>
        <button type="submit" className="btn-primary-gradient">
          Terapkan
        </button>
      </Form>

      <div className="table-toolbar">
        <span>
          {total !== null ? (
            <strong>{formatNumber(total)}</strong>
          ) : (
            <Suspense fallback={<span className="muted-small">menghitung...</span>}>
              <TotalCount whereSql={whereSql} args={args} />
            </Suspense>
          )}{' '}
          transaksi
        </span>
      </div>

      {rows.length === 0 ? (
        <Empty>Tidak ada transaksi yang cocok.</Empty>
      ) : (
        <div className="table-wrapper">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Tanggal</th>
                <th>Kode booking</th>
                <th>Nama</th>
                <th>No. HP</th>
                <th>Produk</th>
                <th className="num">Qty</th>
                <th className="num">Total</th>
                <th>CS</th>
                <th>Channel</th>
                <th>Kota</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const phone = normalizePhone(r.contack);
                const retur = r.resi ? failed.get(r.resi) : undefined;
                const cancelled = isCancelled(r.status) || !!retur;
                return (
                  <tr key={r.kode_booking} className={cancelled ? 'row-muted' : undefined}>
                    <td className="nowrap">{r.time_stamp ? formatDate(r.time_stamp) : '-'}</td>
                    <td className="mono">{r.kode_booking}</td>
                    <td>{r.first_name || '-'}</td>
                    <td className="nowrap">
                      {phone ? (
                        <Link className="link" href={`/customers/${phone}?produk=all`}>
                          {r.contack}
                        </Link>
                      ) : (
                        <span className="muted-small">{r.contack || '-'}</span>
                      )}
                    </td>
                    <td>{PRODUCT_LABEL[classifyProduct(r as { barang_1: string; barang: string; isi: string; ket: string })]}</td>
                    <td className="num">{r.jumlah ?? '-'}</td>
                    <td className="num nowrap">{formatRupiah(parseRupiah(r.total_harga))}</td>
                    <td>{r.cs || '-'}</td>
                    <td className="nowrap">{classifyChannel(r.ket, r.tipe_pembayaran, r.adv)}</td>
                    <td>{r.kota || '-'}</td>
                    <td>
                      {retur ? (
                        <>
                          <span className={`pill tone-${retur.kind === 'Retur' ? 'danger' : 'warning'}`}>{retur.kind}</span>
                          {retur.reason && <div className="muted-small">{retur.reason}</div>}
                        </>
                      ) : (
                        <span className={`pill tone-${cancelled ? 'danger' : 'success'}`}>{r.status === '1' ? 'OK' : r.status || '-'}</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} hasNext={hasNext} href={(p) => withParams('/transaksi', sp, { page: p })} />
    </div>
  );
}
