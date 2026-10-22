'use server';

import { createSession, requireUser } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { FormState, newPasswordError } from '@/lib/userForm';
import { findUserById, updateUserPassword } from '@/lib/users';

export async function changeOwnPassword(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireUser();
  const user = await findUserById(me.id);
  if (!user) return { error: 'Akun tidak ditemukan.' };
  if (!(await verifyPassword(String(fd.get('lama') ?? ''), user.passwordHash))) return { error: 'Password saat ini salah.' };
  const error = newPasswordError(fd);
  if (error) return { error };

  await updateUserPassword(user.id, await hashPassword(String(fd.get('password'))));
  // Sesi di perangkat lain tidak berlaku lagi; sesi di perangkat ini diperbarui.
  const updated = await findUserById(user.id);
  if (updated) await createSession(updated);
  return { ok: 'Password berhasil diganti.' };
}
