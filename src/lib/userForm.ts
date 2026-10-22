import { PASSWORD_MIN_LENGTH } from './password';
import type { Role } from './users';

/** Hasil server action form: pesan error atau sukses yang ditampilkan di form. */
export type FormState = { error?: string; ok?: string } | undefined;

export function field(fd: FormData, name: string): string {
  return String(fd.get(name) ?? '').trim();
}

export function readUsername(fd: FormData): string {
  return field(fd, 'username').toLowerCase();
}

export function usernameError(username: string): string | null {
  if (!/^[a-z0-9._-]{3,50}$/.test(username)) return 'Username 3-50 karakter: huruf kecil, angka, titik, minus, atau garis bawah.';
  return null;
}

/** Cek password baru + konfirmasinya. */
export function newPasswordError(fd: FormData, name = 'password', confirm = 'konfirmasi'): string | null {
  const password = String(fd.get(name) ?? '');
  if (password.length < PASSWORD_MIN_LENGTH) return `Password minimal ${PASSWORD_MIN_LENGTH} karakter.`;
  if (password !== String(fd.get(confirm) ?? '')) return 'Konfirmasi password tidak sama.';
  return null;
}

export function readRole(fd: FormData): Role {
  return field(fd, 'role') === 'admin' ? 'admin' : 'cs';
}

/** Hanya izinkan redirect ke path internal. */
export function safeNext(raw: string): string {
  return raw.startsWith('/') && !raw.startsWith('//') && !raw.startsWith('/login') ? raw : '/';
}

export const DB_ERROR = 'Database tidak bisa diakses. Pastikan MySQL di XAMPP Control Panel sudah Start.';
