'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, BellRing, Grid3x3, LayoutDashboard, PackageX, Receipt, Shuffle, Target, UserCog, Users } from 'lucide-react';

const NAV_GROUPS = {
  main: [
    { href: '/', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/customers', label: 'Data Customer', icon: Users },
    { href: '/transaksi', label: 'Riwayat Transaksi', icon: Receipt },
    { href: '/rfm', label: 'Analisa RFM', icon: Grid3x3 },
    { href: '/cohort', label: 'Analisa Cohort', icon: BarChart3 },
    { href: '/reminder', label: 'Reminder RO', icon: BellRing },
    { href: '/kampanye', label: 'Kampanye Treatment', icon: Target },
    { href: '/retur', label: 'Customer Retur', icon: PackageX },
  ],
  admin: [
    { href: '/pembagian', label: 'Pembagian CRM', icon: Shuffle },
    { href: '/pengguna', label: 'Pengguna', icon: UserCog },
  ],
};

export type NavGroup = keyof typeof NAV_GROUPS;

function isActive(pathname: string | null, href: string) {
  if (!pathname) return false;
  return href === '/' ? pathname === '/' : pathname.startsWith(href);
}

export function NavLinks({ pathname, group = 'main' }: { pathname?: string | null; group?: NavGroup }) {
  return (
    <ul className="nav-menu">
      {NAV_GROUPS[group].map(({ href, label, icon: Icon }) => (
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

export function ActiveNavLinks({ group = 'main' }: { group?: NavGroup }) {
  return <NavLinks pathname={usePathname()} group={group} />;
}
