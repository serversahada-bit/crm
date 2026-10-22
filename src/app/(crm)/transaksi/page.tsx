import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { connection } from 'next/server';
import type { RowDataPacket } from 'mysql2';
import { Search } from 'lucide-react';
import { requireUser } from '@/lib/auth';
import { START_DATE } from '@/lib/config';
import { pool } from '@/lib/db';
import { classifyChannel, classifyProduct, isCancelled, normalizePhone, parseRupiah, PRODUCT_LABEL } from '@/lib/normalize';
import { intParam, param, SearchParams, withParams } from '@/lib/params';
import { AutoSubmitSelect } from '@/components/ShellControls';
import { Empty, LoadingBlock, PageHeader, Pagination } from '@/components/ui';
import { formatDate, formatNumber, formatRupiah } from '@/utils/formatters';

const PAGE_SIZE = 50;
const CANCEL_SQL = "(status REGEXP 'batal|cancel|return|retur|gagal|lost by')";

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
  await connection();
  await requireUser();
  const sp = await searchParams;
  const q = param(sp, 'q');
  const dari = param(sp, 'dari');
  const sampai = param(sp, 'sampai');
  const status = param(sp, 'status');
  const page = intParam(sp, 'page', 1);

  const where: string[] = ['time_stamp >= ?'];
  const args: (string | number)[] = [START_DATE];
  if (dari) {
    where.push('time_stamp >= ?');
    args.push(dari);
  }
  if (sampai) {
    where.push('time_stamp < DATE_ADD(?, INTERVAL 1 DAY)');
    args.push(sampai);
  }
  if (status === 'valid') where.push(`NOT ${CANCEL_SQL}`);
  if (status === 'batal') where.push(CANCEL_SQL);
  if (q) {
    const digits = q.replace(/\D/g, '');
    const phone = digits.length >= 6 ? (normalizePhone(digits) ?? digits).replace(/^62/, '') : '';
    where.push(`(kode_booking = ? OR resi = ? OR first_name LIKE ?${phone ? " OR REPLACE(REPLACE(REPLACE(contack, ' ', ''), '-', ''), '+', '') LIKE ?" : ''})`);
    args.push(q, q, `%${q}%`);
    if (phone) args.push(`%${phone}%`);
  }
  const whereSql = where.join(' AND ');

  const [[{ total }]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS total FROM data_transaksi WHERE ${whereSql}`, args);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const current = Math.min(page, totalPages);
  const [rows] = await pool.query<RowDataPacket[]>(
    `SELECT kode_booking, time_stamp, first_name, contack, kota, barang, barang_1, LEFT(isi_paket, 40) AS isi,
            jumlah, total_harga, cs, adv, LEFT(keterangan, 60) AS ket, tipe_pembayaran, LEFT(status, 40) AS status
       FROM data_transaksi WHERE ${whereSql}
      ORDER BY time_stamp DESC LIMIT ? OFFSET ?`,
    [...args, PAGE_SIZE, (current - 1) * PAGE_SIZE],
  );

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
            <option value="valid">Valid (tidak batal)</option>
            <option value="batal">Batal / retur</option>
          </AutoSubmitSelect>
        </label>
        <button type="submit" className="btn-primary-gradient">
          Terapkan
        </button>
      </Form>

      <div className="table-toolbar">
        <span>
          <strong>{formatNumber(total)}</strong> transaksi
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
                const cancelled = isCancelled(r.status);
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
                      <span className={`pill tone-${cancelled ? 'danger' : 'success'}`}>{r.status === '1' ? 'OK' : r.status || '-'}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={current} totalPages={totalPages} href={(p) => withParams('/transaksi', sp, { page: p })} />
    </div>
  );
}
