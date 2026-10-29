'use client';

import { useActionState } from 'react';
import { createCampaignAction } from '@/app/(crm)/kampanye/actions';
import { PRODUCT_FILTERS } from '@/lib/normalize';
import { FormMessage, SubmitButton } from './AuthForms';

export function CreateCampaignForm({
  segments,
  defaultSegment,
  defaultProduct,
  defaultMulai,
}: {
  segments: { id: string; label: string; count: number }[];
  defaultSegment: string;
  defaultProduct: string;
  defaultMulai: string;
}) {
  const [state, action] = useActionState(createCampaignAction, undefined);
  return (
    <form action={action} className="auth-form">
      <label className="field">
        <span>Nama kampanye</span>
        <input className="input-text" name="nama" placeholder="mis. Treatment Can't Lose Them Nov 2026" required />
      </label>
      <label className="field">
        <span>Segmen target</span>
        <select className="dropdown-select" name="segmen" defaultValue={defaultSegment}>
          {segments.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label} ({s.count.toLocaleString('id-ID')} customer)
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Produk (closing & segmen)</span>
        <select className="dropdown-select" name="produk" defaultValue={defaultProduct}>
          {PRODUCT_FILTERS.map((p) => (
            <option key={p.value} value={p.value}>
              {p.label}
            </option>
          ))}
        </select>
      </label>
      <div className="form-row">
        <label className="field">
          <span>Mulai</span>
          <input className="input-text" type="date" name="mulai" defaultValue={defaultMulai} required />
        </label>
        <label className="field">
          <span>Selesai (opsional)</span>
          <input className="input-text" type="date" name="selesai" />
        </label>
      </div>
      <label className="field">
        <span>Target CR (%)</span>
        <input className="input-text" name="target_cr" inputMode="decimal" defaultValue="2,5" required />
      </label>
      <p className="muted-small">
        Jumlah customer di samping segmen dihitung untuk produk Gamamilk. Daftar customer dibekukan saat kampanye dibuat, dan bisa
        diambil ulang selama kampanye belum dimulai.
      </p>
      <FormMessage state={state} />
      <SubmitButton pending="Membuat kampanye...">Buat kampanye</SubmitButton>
    </form>
  );
}
