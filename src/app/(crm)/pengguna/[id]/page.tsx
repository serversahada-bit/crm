import { Suspense } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireAdmin } from '@/lib/auth';
import { csOptions } from '@/lib/customerQuery';
import { getView } from '@/lib/dataset';
import { findUserById } from '@/lib/users';
import { Card, LoadingBlock } from '@/components/ui';
import { EditUserForm, ResetPasswordForm } from '@/components/UserForms';
import { formatDate } from '@/utils/formatters';
import { toggleActive } from '../actions';

export default function KelolaPenggunaPage({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<LoadingBlock label="Memuat akun..." />}>
      <KelolaPengguna params={params} />
    </Suspense>
  );
}

async function KelolaPengguna({ params }: { params: Promise<{ id: string }> }) {
  const me = await requireAdmin();
  const id = Number((await params).id);
  const user = Number.isInteger(id) && id > 0 ? await findUserById(id) : null;
  if (!user) notFound();
  const csNames = csOptions((await getView('all')).view);
  const isMe = user.id === me.id;

  return (
    <>
      <div className="view-header">
        <div className="view-header-title">
          <Link className="link back" href="/pengguna">
            <ArrowLeft size={15} /> Pengguna
          </Link>
          <h1>{user.nama}</h1>
          <p>
            <span className="mono">{user.username}</span> · dibuat {formatDate(user.createdAt)} · login terakhir{' '}
            {user.lastLogin ? formatDate(user.lastLogin) : 'belum pernah'}
          </p>
          <div className="badges">
            <span className={`pill ${user.role === 'admin' ? 'tone-info' : ''}`}>{user.role === 'admin' ? 'Admin' : 'CS'}</span>
            <span className={`pill tone-${user.aktif ? 'success' : 'danger'}`}>{user.aktif ? 'Aktif' : 'Nonaktif'}</span>
          </div>
        </div>
      </div>

      <div className="grid-3">
        <Card title="Data Akun">
          <EditUserForm user={{ id: user.id, nama: user.nama, role: user.role, namaCs: user.namaCs }} csNames={csNames} />
        </Card>
        <Card title="Reset Password" description="Setelah diganti, akun ini harus login ulang dengan password baru.">
          <ResetPasswordForm userId={user.id} />
        </Card>
        <Card
          title="Status Akun"
          description={user.aktif ? 'Akun nonaktif tidak bisa login dan langsung keluar dari semua perangkat.' : 'Akun ini tidak bisa login.'}
        >
          {isMe ? (
            <p className="muted-small">Anda tidak bisa menonaktifkan akun sendiri.</p>
          ) : (
            <form action={toggleActive}>
              <input type="hidden" name="id" value={user.id} />
              <button type="submit" className={`btn-block ${user.aktif ? 'btn-danger' : 'btn-primary-gradient'}`}>
                {user.aktif ? 'Nonaktifkan akun' : 'Aktifkan kembali'}
              </button>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
