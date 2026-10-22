'use server';

import { refresh } from 'next/cache';
import { invalidateDataset } from '@/lib/dataset';

export async function reloadData() {
  invalidateDataset();
  refresh();
}
