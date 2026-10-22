'use client';

import { useActionState } from 'react';
import { createUser, resetPassword, updateUser } from '@/app/(crm)/pengguna/actions';
import { changeOwnPassword } from '@/app/(crm)/akun/actions';
import type { Role } from '@/lib/users';
import { FormMessage, SubmitButton } from './AuthForms';

function CsNameField({ csNames, defaultValue }: { csNames: string[]; defaultValue?: string | null }) {
  return (
    <label className="field">
      <span>Nama CS di data transaksi (opsional)</span>
      <input className="input-text" name="nama_cs" list="cs-names" defaultValue={defaultValue ?? ''} placeholder="mis. Sherly" />
      <datalist id="cs-names">
        {csNames.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>
    </label>
  );
}

function RoleField({ defaultValue = 'cs' }: { defaultValue?: Role }) {
  return (
    <label className="field">
      <span>Peran</span>
      <select className="dropdown-select" name="role" defaultValue={defaultValue}>
        <option value="cs">CS</option>
        <option value="admin">Admin (bisa kelola pengguna)</option>
      </select>
    </label>
  );
}

function NewPasswordFields({ label = 'Password' }: { label?: string }) {
  return (
    <>
      <label className="field">
        <span>{label} (min. 8 karakter)</span>
        <input className="input-text" name="password" type="password" autoComplete="new-password" required />
      </label>
      <label className="field">
        <span>Ulangi {label.toLowerCase()}</span>
        <input className="input-text" name="konfirmasi" type="password" autoComplete="new-password" required />
      </label>
    </>
  );
}

export function CreateUserForm({ csNames }: { csNames: string[] }) {
  const [state, action] = useActionState(createUser, undefined);
  return (
    // key berubah setelah sukses agar isian form kosong kembali
    <form action={action} className="auth-form" key={state?.ok}>
      <label className="field">
        <span>Nama lengkap</span>
        <input className="input-text" name="nama" required />
      </label>
      <label className="field">
        <span>Username</span>
        <input className="input-text" name="username" autoComplete="off" placeholder="mis. sherly" required />
      </label>
      <RoleField />
      <CsNameField csNames={csNames} />
      <NewPasswordFields />
      <FormMessage state={state} />
      <SubmitButton pending="Menyimpan...">Tambah pengguna</SubmitButton>
    </form>
  );
}

export function EditUserForm({
  user,
  csNames,
}: {
  user: { id: number; nama: string; role: Role; namaCs: string | null };
  csNames: string[];
}) {
  const [state, action] = useActionState(updateUser, undefined);
  return (
    <form action={action} className="auth-form">
      <input type="hidden" name="id" value={user.id} />
      <label className="field">
        <span>Nama lengkap</span>
        <input className="input-text" name="nama" defaultValue={user.nama} required />
      </label>
      <RoleField defaultValue={user.role} />
      <CsNameField csNames={csNames} defaultValue={user.namaCs} />
      <FormMessage state={state} />
      <SubmitButton pending="Menyimpan...">Simpan perubahan</SubmitButton>
    </form>
  );
}

export function ResetPasswordForm({ userId }: { userId: number }) {
  const [state, action] = useActionState(resetPassword, undefined);
  return (
    <form action={action} className="auth-form" key={state?.ok}>
      <input type="hidden" name="id" value={userId} />
      <NewPasswordFields label="Password baru" />
      <FormMessage state={state} />
      <SubmitButton pending="Menyimpan...">Ganti password</SubmitButton>
    </form>
  );
}

export function ChangeOwnPasswordForm() {
  const [state, action] = useActionState(changeOwnPassword, undefined);
  return (
    <form action={action} className="auth-form" key={state?.ok}>
      <label className="field">
        <span>Password saat ini</span>
        <input className="input-text" name="lama" type="password" autoComplete="current-password" required />
      </label>
      <NewPasswordFields label="Password baru" />
      <FormMessage state={state} />
      <SubmitButton pending="Menyimpan...">Ganti password</SubmitButton>
    </form>
  );
}
