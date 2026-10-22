import { Suspense } from 'react';
import { requireUser } from '@/lib/auth';
import { Card, LoadingBlock, PageHeader } from '@/components/ui';
import { ChangeOwnPasswordForm } from '@/components/UserForms';

export default function AkunPage() {
  return (
    <>
      <PageHeader title="Akun Saya" description="Informasi akun dan penggantian password." />
      <Suspense fallback={<LoadingBlock label="Memuat akun..." />}>
        <Akun />
      </Suspense>
    </>
  );
}

async function Akun() {
  const me = await requireUser();
  return (
    <div className="grid-2">
      <Card title="Profil">
        <dl className="profile-list">
          <div>
            <dt>Nama</dt>
            <dd>{me.nama}</dd>
          </div>
          <div>
            <dt>Username</dt>
            <dd className="mono">{me.username}</dd>
          </div>
          <div>
            <dt>Peran</dt>
            <dd>{me.role === 'admin' ? 'Admin' : 'CS'}</dd>
          </div>
          <div>
            <dt>Nama CS</dt>
            <dd>{me.namaCs || '-'}</dd>
          </div>
        </dl>
        <p className="muted-small" style={{ marginTop: '1rem' }}>
          Perubahan nama atau peran dilakukan oleh admin di menu Pengguna.
        </p>
      </Card>
      <Card title="Ganti Password" description="Setelah diganti, perangkat lain yang sedang login akan otomatis keluar.">
        <ChangeOwnPasswordForm />
      </Card>
    </div>
  );
}
