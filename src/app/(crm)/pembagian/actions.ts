'use server';

import { refresh } from 'next/cache';
import { requireAdmin } from '@/lib/auth';
import { getDataset } from '@/lib/dataset';
import { addTeamMember, assignManually, distributeNewCustomers, removeTeamMember, setTeamMemberActive } from '@/lib/pembagian';
import { field, FormState } from '@/lib/userForm';

export async function addMember(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const nama = field(fd, 'nama').replace(/\s+/g, ' ');
  if (!nama) return { error: 'Nama CRM wajib diisi.' };
  if (nama.length > 100) return { error: 'Nama terlalu panjang.' };
  if (!(await addTeamMember(nama))) return { error: `"${nama}" sudah ada di tim.` };
  refresh();
  return { ok: `${nama} ditambahkan ke tim CRM.` };
}

export async function toggleMember(fd: FormData) {
  await requireAdmin();
  await setTeamMemberActive(field(fd, 'nama'), field(fd, 'aktif') !== '1');
  refresh();
}

export async function removeMember(fd: FormData) {
  await requireAdmin();
  await removeTeamMember(field(fd, 'nama'));
  refresh();
}

export async function distributeNow(): Promise<void> {
  await requireAdmin();
  await distributeNewCustomers(await getDataset());
  refresh();
}

/** Ubah CRM pemegang customer dari halaman detail customer. */
export async function assignCrm(fd: FormData) {
  const me = await requireAdmin();
  const phone = field(fd, 'phone');
  if (!/^628\d{7,12}$/.test(phone)) return;
  await assignManually(await getDataset(), phone, field(fd, 'crm'), me.username);
  refresh();
}
