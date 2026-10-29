'use client';

import { useActionState } from 'react';
import { addMember } from '@/app/(crm)/pembagian/actions';
import { FormMessage, SubmitButton } from './AuthForms';

export function AddMemberForm({ suggestions }: { suggestions: string[] }) {
  const [state, action] = useActionState(addMember, undefined);
  return (
    // key berubah setelah sukses agar isian form kosong kembali
    <form action={action} className="auth-form" key={state?.ok}>
      <label className="field">
        <span>Nama CRM</span>
        <input className="input-text" name="nama" list="crm-names" placeholder="mis. Indri" required />
        <datalist id="crm-names">
          {suggestions.map((c) => (
            <option key={c} value={c} />
          ))}
        </datalist>
      </label>
      <FormMessage state={state} />
      <SubmitButton pending="Menyimpan...">Tambah ke tim</SubmitButton>
    </form>
  );
}
