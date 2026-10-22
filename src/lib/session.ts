// Token sesi login: payload JSON + tanda tangan HMAC-SHA256. Dipakai juga oleh proxy.ts,
// jadi file ini tidak boleh mengimpor apa pun dari next/headers atau database.
import { createHmac, timingSafeEqual } from 'node:crypto';

export const SESSION_COOKIE = 'crm_session';
export const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // detik

export interface SessionPayload {
  uid: number;
  pv: string; // sidik jari password; berubah saat password diganti sehingga sesi lama tidak berlaku
  exp: number; // unix detik
}

export const SESSION_CONFIG_ERROR =
  'Konfigurasi server belum lengkap: SESSION_SECRET belum diisi (minimal 16 karakter) di .env.local / Environment Variables server.';

export function isSessionConfigured(): boolean {
  return (process.env.SESSION_SECRET ?? '').length >= 16;
}

function secret(): string {
  if (!isSessionConfigured()) throw new Error(SESSION_CONFIG_ERROR);
  return process.env.SESSION_SECRET!;
}

function sign(data: string): string {
  return createHmac('sha256', secret()).update(data).digest('base64url');
}

export function encodeSession(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${data}.${sign(data)}`;
}

/** Payload jika tanda tangan valid dan belum kedaluwarsa, selain itu null. */
export function decodeSession(token: string | undefined): SessionPayload | null {
  if (!token) return null;
  const [data, sig] = token.split('.');
  if (!data || !sig) return null;
  const expected = Buffer.from(sign(data));
  const given = Buffer.from(sig);
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, 'base64url').toString('utf8')) as SessionPayload;
    if (typeof p.uid !== 'number' || typeof p.pv !== 'string' || typeof p.exp !== 'number') return null;
    return p.exp > Date.now() / 1000 ? p : null;
  } catch {
    return null;
  }
}
