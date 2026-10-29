'use server';

import { refresh } from 'next/cache';
import { redirect } from 'next/navigation';
import { requireAdmin } from '@/lib/auth';
import { getView } from '@/lib/dataset';
import { campaignStatus, createCampaign, deleteCampaign, findCampaign, resnapshotCampaign } from '@/lib/kampanye';
import { PRODUCT_FILTERS } from '@/lib/normalize';
import { SEGMENTS, SegmentId } from '@/lib/rfm';
import { field, FormState } from '@/lib/userForm';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function readId(fd: FormData): number {
  const id = Number(field(fd, 'id'));
  return Number.isInteger(id) && id > 0 ? id : 0;
}

export async function createCampaignAction(_prev: FormState, fd: FormData): Promise<FormState> {
  const me = await requireAdmin();
  const nama = field(fd, 'nama');
  const segment = field(fd, 'segmen') as SegmentId;
  const produk = field(fd, 'produk');
  const mulai = field(fd, 'mulai');
  const selesai = field(fd, 'selesai') || null;
  const targetCr = Number(field(fd, 'target_cr').replace(',', '.'));

  if (!nama || nama.length > 150) return { error: 'Nama kampanye wajib diisi (maks. 150 karakter).' };
  if (!SEGMENTS.some((s) => s.id === segment)) return { error: 'Pilih segmen RFM.' };
  if (!PRODUCT_FILTERS.some((p) => p.value === produk)) return { error: 'Pilih produk.' };
  if (!DATE_RE.test(mulai)) return { error: 'Tanggal mulai wajib diisi.' };
  if (selesai && (!DATE_RE.test(selesai) || selesai < mulai)) return { error: 'Tanggal selesai harus sesudah tanggal mulai.' };
  if (!Number.isFinite(targetCr) || targetCr <= 0 || targetCr > 100) return { error: 'Target CR harus antara 0 dan 100%.' };

  const { ds } = await getView(produk);
  const id = await createCampaign(ds, { nama, segment, produk, mulai, selesai, targetCr }, me.username);
  redirect(`/kampanye/${id}`);
}

/** Ambil ulang daftar customer dari data terbaru, hanya selama kampanye belum dimulai. */
export async function resnapshotAction(fd: FormData) {
  await requireAdmin();
  const campaign = await findCampaign(readId(fd));
  if (!campaign) return;
  const { ds } = await getView(campaign.produk);
  if (campaignStatus(ds, campaign) !== 'Belum mulai') return;
  await resnapshotCampaign(ds, campaign);
  refresh();
}

export async function deleteCampaignAction(fd: FormData) {
  await requireAdmin();
  await deleteCampaign(readId(fd));
  redirect('/kampanye');
}
