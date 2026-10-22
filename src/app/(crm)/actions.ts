'use server';

import { refresh } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { reloadDataset } from '@/lib/dataset';

export async function reloadData() {
  await requireUser();
  try {
    await reloadDataset();
  } catch (err) {
    // Database sedang tidak bisa diakses: tetap tampilkan data terakhir yang berhasil dimuat.
    console.error('[crm] Muat ulang data gagal:', err);
  }
  refresh();
}
