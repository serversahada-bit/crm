export type SearchParams = { [key: string]: string | string[] | undefined };

export function param(sp: SearchParams, key: string, fallback = ''): string {
  const v = sp[key];
  return (Array.isArray(v) ? v[0] : v)?.trim() || fallback;
}

export function intParam(sp: SearchParams, key: string, fallback: number): number {
  const n = parseInt(param(sp, key), 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** URL dengan query saat ini + perubahan. Nilai kosong/null menghapus key. */
export function withParams(path: string, sp: SearchParams, changes: Record<string, string | number | null>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const val = Array.isArray(v) ? v[0] : v;
    if (val) q.set(k, val);
  }
  for (const [k, v] of Object.entries(changes)) {
    if (v === null || v === '') q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `${path}?${s}` : path;
}
