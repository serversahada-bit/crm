'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, BellRing, Grid3x3, LayoutDashboard, Receipt, Users } from 'lucide-react';

export const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/customers', label: 'Data Customer', icon: Users },
  { href: '/transaksi', label: 'Riwayat Transaksi', icon: Receipt },
  { href: '/rfm', label: 'Analisa RFM', icon: Grid3x3 },
  { href: '/cohort', label: 'Analisa Cohort', icon: BarChart3 },
  { href: '/reminder', label: 'Reminder RO', icon: BellRing },
];

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function NavLinks({ pathname }: { pathname?: string | null }) {
  return (
    <ul className="nav-menu">
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
        <li key={href}>
          <Link
            href={href}
            className={`nav-link ${isActive(pathname ?? null, href) ? 'active' : ''}`}
            onClick={() => document.body.classList.remove('nav-open')}
          >
            <Icon size={18} />
            <span>{label}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function ActiveNavLinks() {
  return <NavLinks pathname={usePathname()} />;
}
