'use server';

import { redirect } from 'next/navigation';
import { createSession, destroySession } from '@/lib/auth';
import { hashPassword, verifyPassword } from '@/lib/password';
import { isSessionConfigured, SESSION_CONFIG_ERROR } from '@/lib/session';
import { DB_ERROR, field, FormState, newPasswordError, readUsername, safeNext, usernameError } from '@/lib/userForm';
import { countUsers, findUserByUsername, insertUser, touchLastLogin, UserRecord } from '@/lib/users';

const MAX_FAILURES = 5;
const LOCK_MS = 5 * 60 * 1000;
const failures = globalThis as unknown as { crmLoginFailures?: Map<string, { count: number; until: number }> };
const failMap = (failures.crmLoginFailures ??= new Map());

/** Sisa menit kunci jika username sedang dikunci karena salah password berulang. */
function lockedMinutes(username: string): number {
  const f = failMap.get(username);
  if (!f || f.until < Date.now()) return 0;
  return Math.ceil((f.until - Date.now()) / 60000);
}

function recordFailure(username: string) {
  const f = failMap.get(username);
  const count = f && f.until < Date.now() && f.count >= MAX_FAILURES ? 1 : (f?.count ?? 0) + 1;
  failMap.set(username, { count, until: count >= MAX_FAILURES ? Date.now() + LOCK_MS : 0 });
}

export async function login(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = readUsername(fd);
  const password = String(fd.get('password') ?? '');
  if (!username || !password) return { error: 'Username dan password wajib diisi.' };
  if (!isSessionConfigured()) return { error: SESSION_CONFIG_ERROR };

  const locked = lockedMinutes(username);
  if (locked) return { error: `Terlalu banyak percobaan gagal. Coba lagi dalam ${locked} menit.` };

  let user: UserRecord | null;
  try {
    user = await findUserByUsername(username);
  } catch {
    return { error: DB_ERROR };
  }
  // Tetap hitung hash walau user tidak ada, agar waktu respon tidak membocorkan username yang valid.
  const valid = user ? await verifyPassword(password, user.passwordHash) : (await hashPassword(password), false);
  if (!user || !valid) {
    recordFailure(username);
    return { error: 'Username atau password salah.' };
  }
  if (!user.aktif) return { error: 'Akun ini sudah dinonaktifkan. Hubungi admin.' };

  failMap.delete(username);
  await createSession(user);
  await touchLastLogin(user.id);
  redirect(safeNext(field(fd, 'next')));
}

/** Membuat akun admin pertama. Hanya berlaku selama tabel login_crm masih kosong. */
export async function setupFirstAdmin(_prev: FormState, fd: FormData): Promise<FormState> {
  const username = readUsername(fd);
  const nama = field(fd, 'nama');
  const error = usernameError(username) ?? (nama ? null : 'Nama wajib diisi.') ?? newPasswordError(fd);
  if (error) return { error };
  // Cek sebelum membuat akun, agar tidak ada akun yang tersimpan tapi gagal login.
  if (!isSessionConfigured()) return { error: SESSION_CONFIG_ERROR };

  let user: UserRecord | null;
  try {
    if ((await countUsers()) > 0) return { error: 'Akun admin sudah ada. Silakan login.' };
    await insertUser({ username, nama, passwordHash: await hashPassword(String(fd.get('password'))), role: 'admin', namaCs: null });
    user = await findUserByUsername(username);
  } catch {
    return { error: DB_ERROR };
  }
  if (!user) return { error: 'Gagal membuat akun.' };
  await createSession(user);
  await touchLastLogin(user.id);
  redirect('/');
}

export async function logout() {
  await destroySession();
  redirect('/login');
}
