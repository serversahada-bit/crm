import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { PRODUCT_FILTERS } from '@/lib/normalize';
import type { CustomerStatus } from '@/lib/dataset';
import { SEGMENT_BY_ID, SegmentId } from '@/lib/rfm';
import { formatNumber } from '@/utils/formatters';
import { AutoSubmitSelect } from './ShellControls';

export function PageHeader({ title, description, children }: { title: string; description: string; children?: React.ReactNode }) {
  return (
    <div className="view-header">
      <div className="view-header-title">
        <h1>{title}</h1>
        <p>{description}</p>
      </div>
      {children && <div className="view-header-actions">{children}</div>}
    </div>
  );
}

export function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'indigo',
}: {
  label: string;
  value: string;
  hint?: string;
  icon: LucideIcon;
  tone?: 'indigo' | 'emerald' | 'amber' | 'purple';
}) {
  return (
    <div className="kpi-card">
      <div className="kpi-top">
        <span className="kpi-label">{label}</span>
        <div className={`kpi-icon-wrap ${tone}`}>
          <Icon size={20} />
        </div>
      </div>
      <div className="kpi-value">{value}</div>
      {hint && <div className="trend-desc">{hint}</div>}
    </div>
  );
}

export function Card({ title, description, children, actions }: { title: string; description?: string; children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h3>{title}</h3>
          {description && <p>{description}</p>}
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

export interface BarSeries {
  key: string;
  label: string;
  color: string;
}

/** Grafik batang vertikal bertumpuk, tanpa library. */
export function StackedBars({
  data,
  series,
  format = (v) => formatNumber(v),
}: {
  data: { label: string; values: Record<string, number> }[];
  series: BarSeries[];
  format?: (v: number) => string;
}) {
  const max = Math.max(...data.map((d) => series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0))) || 1;
  return (
    <div>
      <div className="legend">
        {series.map((s) => (
          <span key={s.key}>
            <i style={{ background: s.color }} /> {s.label}
          </span>
        ))}
      </div>
      <div className="vbars">
        {data.map((d) => {
          const total = series.reduce((s, x) => s + (d.values[x.key] ?? 0), 0);
          const tip = `${d.label}\n` + series.map((s) => `${s.label}: ${format(d.values[s.key] ?? 0)}`).join('\n');
          return (
            <div className="vbar" key={d.label} title={tip}>
              <div className="vbar-stack" style={{ height: `${(total / max) * 100}%` }}>
                {series.map((s) => (
                  <div key={s.key} style={{ flexGrow: d.values[s.key] ?? 0, background: s.color }} />
                ))}
              </div>
              <span className="vbar-label">{d.label}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Daftar batang horizontal: label, batang, nilai. */
export function HBars({
  items,
  format = (v) => formatNumber(v),
  color = 'var(--primary)',
}: {
  items: { label: React.ReactNode; value: number; sub?: string; color?: string }[];
  format?: (v: number) => string;
  color?: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.value));
  return (
    <div className="hbars">
      {items.map((item, idx) => (
        <div className="hbar-row" key={idx}>
          <div className="hbar-label">{item.label}</div>
          <div className="hbar-track">
            <div className="hbar-fill" style={{ width: `${(item.value / max) * 100}%`, background: item.color ?? color }} />
          </div>
          <div className="hbar-value">
            {format(item.value)}
            {item.sub && <span> {item.sub}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

export function SegmentBadge({ segment }: { segment: SegmentId }) {
  const s = SEGMENT_BY_ID[segment];
  return (
    <span className="pill" style={{ color: s.color, background: `color-mix(in srgb, ${s.color} 15%, transparent)` }}>
      {s.label}
    </span>
  );
}

const STATUS_TONE: Record<CustomerStatus, string> = { Aktif: 'success', Pasif: 'warning', Churn: 'danger' };

export function StatusBadge({ status }: { status: CustomerStatus }) {
  return <span className={`pill tone-${STATUS_TONE[status]}`}>{status}</span>;
}

export function Pagination({ page, totalPages, href }: { page: number; totalPages: number; href: (page: number) => string }) {
  if (totalPages <= 1) return null;
  return (
    <div className="pagination">
      <span>
        Halaman {formatNumber(page)} dari {formatNumber(totalPages)}
      </span>
      <div>
        {page > 1 ? (
          <Link className="btn-ghost" href={href(page - 1)}>
            <ChevronLeft size={15} /> Sebelumnya
          </Link>
        ) : null}
        {page < totalPages ? (
          <Link className="btn-ghost" href={href(page + 1)}>
            Berikutnya <ChevronRight size={15} />
          </Link>
        ) : null}
      </div>
    </div>
  );
}

export function ProductSelect({ value }: { value: string }) {
  return (
    <label className="field">
      <span>Produk</span>
      <AutoSubmitSelect name="produk" defaultValue={value}>
        {PRODUCT_FILTERS.map((p) => (
          <option key={p.value} value={p.value}>
            {p.label}
          </option>
        ))}
      </AutoSubmitSelect>
    </label>
  );
}

export function LoadingBlock({ label = 'Memuat & menghitung data...' }: { label?: string }) {
  return (
    <div className="loading-block">
      <div className="spinner" />
      <span>{label}</span>
      <span className="muted-small">Pemuatan pertama dari database butuh beberapa detik.</span>
    </div>
  );
}

export function Empty({ children }: { children: React.ReactNode }) {
  return <div className="empty">{children}</div>;
}
