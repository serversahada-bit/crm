import { Suspense } from 'react';
import Link from 'next/link';
import { LogOut } from 'lucide-react';
import { getCurrentUser } from '@/lib/auth';
import { logout } from '@/app/login/actions';
import { ActiveNavLinks, NavLinks } from './NavLinks';

function initials(nama: string): string {
  return nama
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join('');
}

export async function UserMenu() {
  const user = await getCurrentUser();
  if (!user) return null;
  return (
    <div className="user-menu">
      <Link href="/akun" className="user-mini-profile" title="Pengaturan akun">
        <div className="user-avatar">{initials(user.nama)}</div>
        <div className="user-meta">
          <div className="name">{user.nama}</div>
          <div className="role">{user.role === 'admin' ? 'Admin' : `CS${user.namaCs ? ` · ${user.namaCs}` : ''}`}</div>
        </div>
      </Link>
      <form action={logout}>
        <button className="icon-button" type="submit" title="Keluar" aria-label="Keluar">
          <LogOut size={16} />
        </button>
      </form>
    </div>
  );
}

/** Menu khusus admin, hanya dirender untuk user ber-role admin. */
export async function AdminNav() {
  const user = await getCurrentUser();
  if (user?.role !== 'admin') return null;
  return (
    <div>
      <div className="nav-section-title">Admin</div>
      <Suspense fallback={<NavLinks group="admin" />}>
        <ActiveNavLinks group="admin" />
      </Suspense>
    </div>
  );
}
