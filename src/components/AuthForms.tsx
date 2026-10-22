'use client';

import { useActionState } from 'react';
import { useFormStatus } from 'react-dom';
import { login, setupFirstAdmin } from '@/app/login/actions';
import type { FormState } from '@/lib/userForm';

export function SubmitButton({ children, pending: pendingLabel = 'Memproses...' }: { children: React.ReactNode; pending?: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn-primary-gradient btn-block" disabled={pending}>
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ state }: { state: FormState }) {
  if (state?.error) return <div className="form-msg error" role="alert">{state.error}</div>;
  if (state?.ok) return <div className="form-msg ok" role="status">{state.ok}</div>;
  return null;
}

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState(login, undefined);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="next" value={next} />
      <label className="field">
        <span>Username</span>
        <input className="input-text" name="username" autoComplete="username" autoFocus required />
      </label>
      <label className="field">
        <span>Password</span>
        <input className="input-text" name="password" type="password" autoComplete="current-password" required />
      </label>
      <FormMessage state={state} />
      <SubmitButton pending="Masuk...">Masuk</SubmitButton>
    </form>
  );
}

export function SetupAdminForm() {
  const [state, action] = useActionState(setupFirstAdmin, undefined);
  return (
    <form action={action} className="auth-form">
      <label className="field">
        <span>Nama lengkap</span>
        <input className="input-text" name="nama" autoFocus required />
      </label>
      <label className="field">
        <span>Username</span>
        <input className="input-text" name="username" autoComplete="username" placeholder="mis. admin" required />
      </label>
      <label className="field">
        <span>Password (min. 8 karakter)</span>
        <input className="input-text" name="password" type="password" autoComplete="new-password" required />
      </label>
      <label className="field">
        <span>Ulangi password</span>
        <input className="input-text" name="konfirmasi" type="password" autoComplete="new-password" required />
      </label>
      <FormMessage state={state} />
      <SubmitButton pending="Membuat akun...">Buat akun admin</SubmitButton>
    </form>
  );
}
