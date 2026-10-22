import { Suspense } from 'react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import Image from 'next/image';
import sahadaLogo from '@/assets/brand/sahada-logo.png';
import { getCurrentUser } from '@/lib/auth';
import { param, SearchParams } from '@/lib/params';
import { DB_ERROR, safeNext } from '@/lib/userForm';
import { countUsers } from '@/lib/users';
import { LoginForm, SetupAdminForm } from '@/components/AuthForms';

export const metadata: Metadata = { title: 'Masuk | CRM PTSLU' };

export default function LoginPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <Image src={sahadaLogo} alt="PT Sahada Laku Utama" className="auth-logo" priority />
          <span className="auth-app-name">CRM PTSLU</span>
        </div>
        <Suspense fallback={<div className="spinner auth-spinner" />}>
          <LoginContent searchParams={searchParams} />
        </Suspense>
      </div>
    </div>
  );
}

async function LoginContent({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await connection();
  const next = safeNext(param(await searchParams, 'next'));

  let loggedIn = false;
  let userCount = 0;
  let dbError = false;
  try {
    loggedIn = (await getCurrentUser()) !== null;
    userCount = await countUsers();
  } catch {
    dbError = true;
  }
  if (loggedIn) redirect(next);

  if (dbError) {
    return (
      <>
        <h1 className="auth-title">Tidak bisa terhubung</h1>
        <div className="form-msg error">{DB_ERROR}</div>
        <a className="btn-ghost btn-block" href="/login">
          Coba lagi
        </a>
      </>
    );
  }

  if (userCount === 0) {
    return (
      <>
        <h1 className="auth-title">Buat akun admin pertama</h1>
        <p className="auth-sub">
          Belum ada akun di tabel <code>login_crm</code>. Akun ini yang nantinya menambahkan akun CS lain.
        </p>
        <SetupAdminForm />
      </>
    );
  }

  return (
    <>
      <h1 className="auth-title">Masuk</h1>
      <p className="auth-sub">Gunakan akun CRM yang diberikan admin.</p>
      <LoginForm next={next} />
    </>
  );
}
