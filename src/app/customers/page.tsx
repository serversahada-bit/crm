import { Suspense } from 'react';
import Form from 'next/form';
import Link from 'next/link';
import { Download, MessageCircle, Search } from 'lucide-react';
import { getView } from '@/lib/dataset';
import { csOptions, filterCustomers, readCustomerFilters, SORTS } from '@/lib/customerQuery';
import { DEFAULT_PRODUCT_FILTER, PRODUCT_LABEL, waLink } from '@/lib/normalize';
import { intParam, param, SearchParams, withParams } from '@/lib/params';
import { SEGMENTS } from '@/lib/rfm';
import { Empty, LoadingBlock, PageHeader, Pagination, ProductSelect, SegmentBadge, StatusBadge } from '@/components/ui';
import { AutoSubmitSelect } from '@/components/ShellControls';
import { formatDate, formatDays, formatNumber, formatPhone, formatRupiah } from '@/utils/formatters';

const PAGE_SIZE = 50;
const YEARS = ['2023', '2024', '2025', '2026'];

export default function CustomersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <>
      <PageHeader
        title="Data Customer"
        description="Semua customer 2023 - sekarang: nomor telepon, riwayat pembelian, jumlah RO, dan segmen RFM."
      />
      <Suspense fallback={<LoadingBlock />}>
        <CustomerTable searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function CustomerTable({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sp = await searchParams;
  const produk = param(sp, 'produk', DEFAULT_PRODUCT_FILTER);
  const f = readCustomerFilters(sp);
  const { view } = await getView(produk);
  const rows = filterCustomers(view, f);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const page = Math.min(intParam(sp, 'page', 1), totalPages);
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const exportHref = withParams('/api/export/customers', sp, { page: null, produk });

  return (
    <div className="table-card">
      <Form action="" className="filter-bar boxed">
        <label className="field grow">
          <span>Cari</span>
          <div className="input-icon">
            <Search size={15} />
            <input className="input-text" name="q" defaultValue={f.q} placeholder="Nama atau no. HP..." />
          </div>
        </label>
        <ProductSelect value={produk} />
        <label className="field">
          <span>Segmen RFM</span>
          <AutoSubmitSelect name="segmen" defaultValue={f.segmen}>
            <option value="">Semua segmen</option>
            {SEGMENTS.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <label className="field">
          <span>Status</span>
          <AutoSubmitSelect name="status" defaultValue={f.status}>
            <option value="">Semua</option>
            <option value="Aktif">Aktif (≤ 60 hari)</option>
            <option value="Pasif">Pasif (61-180 hari)</option>
            <option value="Churn">Churn (&gt; 180 hari)</option>
          </AutoSubmitSelect>
        </label>
        <label className="field">
          <span>Tipe</span>
          <AutoSubmitSelect name="tipe" defaultValue={f.tipe}>
            <option value="">Semua</option>
            <option value="ro">Sudah RO (≥ 2x)</option>
            <option value="sekali">Baru 1x beli</option>
          </AutoSubmitSelect>
        </label>
        <label className="field">
          <span>Pertama beli</span>
          <AutoSubmitSelect name="tahun" defaultValue={f.tahun}>
            <option value="">Semua tahun</option>
            {YEARS.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <label className="field">
          <span>CS terakhir</span>
          <AutoSubmitSelect name="cs" defaultValue={f.cs}>
            <option value="">Semua CS</option>
            {csOptions(view).map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <label className="field">
          <span>Kota</span>
          <input className="input-text" name="kota" defaultValue={f.kota} placeholder="mis. Bekasi" />
        </label>
        <label className="field">
          <span>Urutkan</span>
          <AutoSubmitSelect name="sort" defaultValue={f.sort}>
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </AutoSubmitSelect>
        </label>
        <button type="submit" className="btn-primary-gradient">
          Terapkan
        </button>
      </Form>

      <div className="table-toolbar">
        <span>
          <strong>{formatNumber(rows.length)}</strong> customer ditemukan
        </span>
        <a className="btn-ghost" href={exportHref}>
          <Download size={15} /> Export CSV (Excel)
        </a>
      </div>

      {pageRows.length === 0 ? (
        <Empty>Tidak ada customer yang cocok dengan filter.</Empty>
      ) : (
        <div className="table-wrapper">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Customer</th>
                <th>No. HP</th>
                <th>Kota</th>
                <th>Pertama beli</th>
                <th>Terakhir beli</th>
                <th className="num">Order</th>
                <th className="num">RO</th>
                <th className="num">Total belanja</th>
                <th>Produk terakhir</th>
                <th>CS terakhir</th>
                <th>Segmen</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((c) => (
                <tr key={c.phone}>
                  <td>
                    <Link className="link strong" href={`/customers/${c.phone}?produk=${produk}`}>
                      {c.name}
                    </Link>
                  </td>
                  <td className="nowrap">
                    <a className="wa" href={waLink(c.phone)} target="_blank" rel="noreferrer" title="Chat WhatsApp">
                      <MessageCircle size={14} /> {formatPhone(c.phone)}
                    </a>
                  </td>
                  <td>{c.kota || '-'}</td>
                  <td className="nowrap">{formatDate(c.firstDate)}</td>
                  <td className="nowrap">
                    {formatDate(c.lastDate)}
                    <div className="muted-small">{formatDays(c.recency)} lalu</div>
                  </td>
                  <td className="num">{c.orders}</td>
                  <td className="num">{c.ro}</td>
                  <td className="num nowrap">{formatRupiah(c.spend)}</td>
                  <td>{PRODUCT_LABEL[c.lastProduct]}</td>
                  <td>{c.lastCs}</td>
                  <td>
                    <SegmentBadge segment={c.segment} />
                  </td>
                  <td>
                    <StatusBadge status={c.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Pagination page={page} totalPages={totalPages} href={(p) => withParams('/customers', sp, { page: p })} />
    </div>
  );
}
