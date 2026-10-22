import { cache } from 'react';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { passwordVersion } from './password';
import { decodeSession, encodeSession, SESSION_COOKIE, SESSION_MAX_AGE } from './session';
import { findUserById, Role, UserRecord } from './users';

/** Data user yang aman dikirim ke halaman (tanpa hash password). */
export interface CurrentUser {
  id: number;
  username: string;
  nama: string;
  role: Role;
  namaCs: string | null;
}

/** User yang sedang login, dicek ulang ke database (akun nonaktif / password berubah = keluar). */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const session = decodeSession((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return null;
  const user = await findUserById(session.uid);
  if (!user || !user.aktif || passwordVersion(user.passwordHash) !== session.pv) return null;
  return { id: user.id, username: user.username, nama: user.nama, role: user.role, namaCs: user.namaCs };
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  return user;
}

export async function requireAdmin(): Promise<CurrentUser> {
  const user = await requireUser();
  if (user.role !== 'admin') redirect('/');
  return user;
}

export async function createSession(user: UserRecord) {
  const token = encodeSession({
    uid: user.id,
    pv: passwordVersion(user.passwordHash),
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE,
  });
  (await cookies()).set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: 'lax',
    // Aktifkan (COOKIE_SECURE=true) bila aplikasi diakses lewat https.
    secure: process.env.COOKIE_SECURE === 'true',
    path: '/',
    maxAge: SESSION_MAX_AGE,
  });
}

export async function destroySession() {
  (await cookies()).delete(SESSION_COOKIE);
}
