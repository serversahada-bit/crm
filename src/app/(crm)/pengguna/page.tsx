import { Suspense } from 'react';
import Link from 'next/link';
import { requireAdmin } from '@/lib/auth';
import { csOptions } from '@/lib/customerQuery';
import { getView } from '@/lib/dataset';
import { listUsers } from '@/lib/users';
import { Card, LoadingBlock, PageHeader } from '@/components/ui';
import { CreateUserForm } from '@/components/UserForms';
import { formatDate } from '@/utils/formatters';

export default function PenggunaPage() {
  return (
    <>
      <PageHeader title="Pengguna" description="Kelola akun login CRM: tambah akun CS/admin, ubah peran, reset password, dan nonaktifkan akun." />
      <Suspense fallback={<LoadingBlock label="Memuat akun..." />}>
        <UserList />
      </Suspense>
    </>
  );
}

async function UserList() {
  const me = await requireAdmin();
  const users = await listUsers();
  const csNames = csOptions((await getView('all')).view);

  return (
    <div className="grid-users">
      <section className="table-card">
        <div className="table-toolbar">
          <span>
            <strong>{users.length}</strong> akun · {users.filter((u) => u.aktif).length} aktif
          </span>
        </div>
        <div className="table-wrapper">
          <table className="data-table compact">
            <thead>
              <tr>
                <th>Nama</th>
                <th>Username</th>
                <th>Peran</th>
                <th>Nama CS</th>
                <th>Status</th>
                <th>Login terakhir</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className={u.aktif ? undefined : 'row-muted'}>
                  <td>
                    <strong>{u.nama}</strong>
                    {u.id === me.id && <span className="muted-small"> (Anda)</span>}
                  </td>
                  <td className="mono">{u.username}</td>
                  <td>
                    <span className={`pill ${u.role === 'admin' ? 'tone-info' : ''}`}>{u.role === 'admin' ? 'Admin' : 'CS'}</span>
                  </td>
                  <td>{u.namaCs || '-'}</td>
                  <td>
                    <span className={`pill tone-${u.aktif ? 'success' : 'danger'}`}>{u.aktif ? 'Aktif' : 'Nonaktif'}</span>
                  </td>
                  <td className="nowrap">{u.lastLogin ? formatDate(u.lastLogin) : 'Belum pernah'}</td>
                  <td className="nowrap">
                    <Link className="link" href={`/pengguna/${u.id}`}>
                      Kelola →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Card title="Tambah Pengguna" description="Isi Nama CS sesuai nama di data transaksi agar nanti bisa difilter per CS.">
        <CreateUserForm csNames={csNames} />
      </Card>
    </div>
  );
}
