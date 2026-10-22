'use server';

import { refresh } from 'next/cache';
import { createSession, requireAdmin } from '@/lib/auth';
import { hashPassword } from '@/lib/password';
import { field, FormState, newPasswordError, readRole, readUsername, usernameError } from '@/lib/userForm';
import {
  countActiveAdmins,
  findUserById,
  findUserByUsername,
  insertUser,
  setUserActive,
  updateUserPassword,
  updateUserProfile,
} from '@/lib/users';

function readId(fd: FormData): number {
  const id = Number(field(fd, 'id'));
  return Number.isInteger(id) && id > 0 ? id : 0;
}

export async function createUser(_prev: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const username = readUsername(fd);
  const nama = field(fd, 'nama');
  const error = usernameError(username) ?? (nama ? null : 'Nama wajib diisi.') ?? newPasswordError(fd);
  if (error) return { error };
  if (await findUserByUsername(username)) return { error: `Username "${username}" sudah dipakai.` };

  await insertUser({
    username,
    nama,
    passwordHash: await hashPassword(String(fd.get('password'))),
    role: readRole(fd),
    namaCs: field(fd, 'nama_cs') || null,
  });
  refresh();
  return { ok: `Akun "${username}" berhasil dibuat.` };
}

export async function updateUser(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const target = await findUserById(readId(fd));
  if (!target) return { error: 'Akun tidak ditemukan.' };
  const nama = field(fd, 'nama');
  if (!nama) return { error: 'Nama wajib diisi.' };
  const role = readRole(fd);
  if (target.role === 'admin' && role !== 'admin' && target.aktif && (await countActiveAdmins()) <= 1) {
    return { error: 'Minimal harus ada 1 admin aktif.' };
  }
  await updateUserProfile(target.id, { nama, role, namaCs: field(fd, 'nama_cs') || null });
  refresh();
  return { ok: target.id === me.id && role !== 'admin' ? 'Tersimpan. Anda bukan admin lagi.' : 'Perubahan tersimpan.' };
}

export async function resetPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const target = await findUserById(readId(fd));
  if (!target) return { error: 'Akun tidak ditemukan.' };
  const error = newPasswordError(fd);
  if (error) return { error };
  await updateUserPassword(target.id, await hashPassword(String(fd.get('password'))));
  // Sesi lama milik akun ini otomatis tidak berlaku; jika mengganti password sendiri, buat sesi baru.
  if (target.id === me.id) {
    const updated = await findUserById(me.id);
    if (updated) await createSession(updated);
  }
  return { ok: 'Password berhasil diganti. Akun tsb harus login ulang dengan password baru.' };
}

export async function toggleActive(fd: FormData) {
  const me = await requireAdmin();
  const target = await findUserById(readId(fd));
  if (!target || target.id === me.id) return; // admin tidak bisa menonaktifkan dirinya sendiri
  await setUserActive(target.id, !target.aktif);
  refresh();
}
