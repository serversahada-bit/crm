'use server';

import { refresh } from 'next/cache';
import { requireUser } from '@/lib/auth';
import { invalidateDataset } from '@/lib/dataset';

export async function reloadData() {
  await requireUser();
  invalidateDataset();
  refresh();
}
