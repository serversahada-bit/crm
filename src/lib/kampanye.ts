// Kampanye treatment: daftar customer satu segmen RFM dibekukan saat kampanye dibuat,
// lalu dipantau berapa yang closing (order lagi) sejak tanggal mulai. Segmen RFM sendiri selalu berubah:
// customer yang closing pindah segmen, jadi tanpa snapshot hasilnya tidak bisa diukur.
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import type { Dataset, Order } from './dataset';
import { pool } from './db';
import { CHANNEL_CRM, PRODUCT_FILTERS } from './normalize';
import type { SegmentId } from './rfm';

export const CAMPAIGN_TABLE = 'crm_kampanye';
export const CAMPAIGN_MEMBER_TABLE = 'crm_kampanye_customer';

export interface Campaign {
  id: number;
  nama: string;
  segment: SegmentId;
  produk: string; // nilai PRODUCT_FILTERS
  mulai: string; // YYYY-MM-DD, closing dihitung sejak tanggal ini
  selesai: string | null; // null = berjalan terus
  targetCr: number; // persen, mis. 2.5
  targetCount: number; // jumlah customer di snapshot
  snapshotDate: string; // tanggal data saat daftar customer diambil
  createdBy: string;
}

export interface CampaignMember {
  phone: string;
  name: string;
  kota: string;
  crm: string;
  lastDate: string; // order terakhir sebelum kampanye
  orders: number;
  spend: number;
}

export interface CampaignInput {
  nama: string;
  segment: SegmentId;
  produk: string;
  mulai: string;
  selesai: string | null;
  targetCr: number;
}

const tablesReady = globalThis as unknown as { crmKampanyeTables?: Promise<void> };

function ensureTables(): Promise<void> {
  tablesReady.crmKampanyeTables ??= Promise.all([
    pool.query(
      `CREATE TABLE IF NOT EXISTS ${CAMPAIGN_TABLE} (
         id INT AUTO_INCREMENT PRIMARY KEY,
         nama VARCHAR(150) NOT NULL,
         segmen VARCHAR(30) NOT NULL,
         produk VARCHAR(20) NOT NULL,
         mulai DATE NOT NULL,
         selesai DATE NULL,
         target_cr DECIMAL(5,2) NOT NULL,
         jumlah_target INT NOT NULL DEFAULT 0,
         tgl_snapshot DATE NOT NULL COMMENT 'tanggal data saat daftar customer diambil',
         dibuat_oleh VARCHAR(50) NULL,
         dibuat_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    ),
    pool.query(
      `CREATE TABLE IF NOT EXISTS ${CAMPAIGN_MEMBER_TABLE} (
         kampanye_id INT NOT NULL,
         hp VARCHAR(20) NOT NULL,
         nama VARCHAR(100) NULL,
         kota VARCHAR(100) NULL,
         crm VARCHAR(100) NULL,
         terakhir_beli DATE NULL COMMENT 'order terakhir sebelum kampanye',
         jumlah_order INT NOT NULL DEFAULT 0,
         total_belanja BIGINT NOT NULL DEFAULT 0,
         PRIMARY KEY (kampanye_id, hp)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    ),
  ])
    .then(() => undefined)
    .catch((err) => {
      tablesReady.crmKampanyeTables = undefined;
      throw err;
    });
  return tablesReady.crmKampanyeTables;
}

function toCampaign(row: RowDataPacket): Campaign {
  return {
    id: row.id,
    nama: row.nama,
    segment: row.segmen,
    produk: row.produk,
    mulai: row.mulai,
    selesai: row.selesai,
    targetCr: Number(row.target_cr),
    targetCount: row.jumlah_target,
    snapshotDate: row.tgl_snapshot,
    createdBy: row.dibuat_oleh ?? '',
  };
}

export async function listCampaigns(): Promise<Campaign[]> {
  await ensureTables();
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${CAMPAIGN_TABLE} ORDER BY mulai DESC, id DESC`);
  return rows.map(toCampaign);
}

export async function findCampaign(id: number): Promise<Campaign | null> {
  await ensureTables();
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${CAMPAIGN_TABLE} WHERE id = ?`, [id]);
  return rows[0] ? toCampaign(rows[0]) : null;
}

/** Daftar customer kampanye tidak berubah setelah dibuat, jadi disimpan di memori (dihapus saat diambil ulang / dihapus). */
const memberCache = globalThis as unknown as { crmKampanyeMembers?: Map<number, CampaignMember[]> };

export async function loadMembers(id: number): Promise<CampaignMember[]> {
  const cache = (memberCache.crmKampanyeMembers ??= new Map());
  const hit = cache.get(id);
  if (hit) return hit;
  await ensureTables();
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${CAMPAIGN_MEMBER_TABLE} WHERE kampanye_id = ?`, [id]);
  const members = rows.map((row) => ({
    phone: row.hp,
    name: row.nama ?? '',
    kota: row.kota ?? '',
    crm: row.crm ?? '',
    lastDate: row.terakhir_beli ?? '',
    orders: row.jumlah_order,
    spend: Number(row.total_belanja),
  }));
  cache.set(id, members);
  return members;
}

/** Customer segmen kampanye pada data saat ini (sebelum kampanye dimulai). */
function snapshotMembers(ds: Dataset, segment: SegmentId, produk: string): CampaignMember[] {
  const view = ds.views.get(produk);
  if (!view) throw new Error(`View produk ${produk} belum dimuat`);
  return view.customers
    .filter((c) => c.segment === segment)
    .map((c) => ({ phone: c.phone, name: c.name, kota: c.kota, crm: c.crm, lastDate: c.lastDate, orders: c.orders, spend: c.spend }));
}

async function saveMembers(id: number, members: CampaignMember[]) {
  memberCache.crmKampanyeMembers?.delete(id);
  await pool.query(`DELETE FROM ${CAMPAIGN_MEMBER_TABLE} WHERE kampanye_id = ?`, [id]);
  for (let i = 0; i < members.length; i += 1000) {
    await pool.query(
      `INSERT INTO ${CAMPAIGN_MEMBER_TABLE} (kampanye_id, hp, nama, kota, crm, terakhir_beli, jumlah_order, total_belanja) VALUES ?`,
      [
        members
          .slice(i, i + 1000)
          .map((m) => [id, m.phone, m.name.slice(0, 100), m.kota.slice(0, 100), m.crm.slice(0, 100) || null, m.lastDate || null, m.orders, m.spend]),
      ],
    );
  }
}

/** Buat kampanye dan bekukan daftar customer segmen tsb dari data saat ini. Mengembalikan id kampanye. */
export async function createCampaign(ds: Dataset, input: CampaignInput, by: string): Promise<number> {
  await ensureTables();
  const members = snapshotMembers(ds, input.segment, input.produk);
  const [result] = await pool.query<ResultSetHeader>(
    `INSERT INTO ${CAMPAIGN_TABLE} (nama, segmen, produk, mulai, selesai, target_cr, jumlah_target, tgl_snapshot, dibuat_oleh)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [input.nama, input.segment, input.produk, input.mulai, input.selesai, input.targetCr, members.length, ds.refDate, by],
  );
  await saveMembers(result.insertId, members);
  return result.insertId;
}

/** Ambil ulang daftar customer dari data terbaru (hanya masuk akal sebelum kampanye dimulai). */
export async function resnapshotCampaign(ds: Dataset, campaign: Campaign) {
  const members = snapshotMembers(ds, campaign.segment, campaign.produk);
  await saveMembers(campaign.id, members);
  await pool.query(`UPDATE ${CAMPAIGN_TABLE} SET jumlah_target = ?, tgl_snapshot = ? WHERE id = ?`, [
    members.length,
    ds.refDate,
    campaign.id,
  ]);
}

export async function deleteCampaign(id: number) {
  await ensureTables();
  memberCache.crmKampanyeMembers?.delete(id);
  await pool.query(`DELETE FROM ${CAMPAIGN_MEMBER_TABLE} WHERE kampanye_id = ?`, [id]);
  await pool.query(`DELETE FROM ${CAMPAIGN_TABLE} WHERE id = ?`, [id]);
}

export type CampaignStatus = 'Belum mulai' | 'Berjalan' | 'Selesai';

export function campaignStatus(ds: Dataset, c: Campaign): CampaignStatus {
  if (ds.refDate < c.mulai) return 'Belum mulai';
  if (c.selesai && ds.refDate > c.selesai) return 'Selesai';
  return 'Berjalan';
}

/** Jumlah customer closing yang dibutuhkan untuk mencapai target CR. */
export function targetClosing(c: Campaign): number {
  return Math.ceil((c.targetCr / 100) * c.targetCount);
}

export interface MemberResult extends CampaignMember {
  closingOrders: Order[]; // order produk kampanye selama periode kampanye
  closingDate: string | null;
  closingChannel: string;
  closingCs: string;
  closingSpend: number;
  closingQty: number;
}

export interface CampaignProgress {
  members: MemberResult[];
  closing: number;
  cr: number; // 0-1
  needed: number; // jumlah closing untuk mencapai target
  omzet: number;
  qty: number;
  viaCrm: number; // customer yang closing pertamanya lewat channel CRM
}

/**
 * Hitung closing: customer di daftar kampanye yang punya order sukses (bukan retur / non-customer)
 * untuk produk kampanye antara tanggal mulai dan selesai.
 */
export function campaignProgress(ds: Dataset, c: Campaign, members: CampaignMember[]): CampaignProgress {
  const codes = PRODUCT_FILTERS.find((p) => p.value === c.produk)?.codes ?? null;
  const results: MemberResult[] = members.map((m) => {
    const orders = (ds.ordersByPhone.get(m.phone) ?? []).filter(
      (o) => o.date >= c.mulai && (!c.selesai || o.date <= c.selesai) && (!codes || codes.includes(o.product)),
    );
    const first = orders[0];
    return {
      ...m,
      closingOrders: orders,
      closingDate: first?.date ?? null,
      closingChannel: first?.channel ?? '',
      closingCs: first?.cs ?? '',
      closingSpend: orders.reduce((s, o) => s + o.total, 0),
      closingQty: orders.reduce((s, o) => s + o.qty, 0),
    };
  });
  const closed = results.filter((r) => r.closingDate);
  return {
    members: results,
    closing: closed.length,
    cr: c.targetCount ? closed.length / c.targetCount : 0,
    needed: targetClosing(c),
    omzet: closed.reduce((s, r) => s + r.closingSpend, 0),
    qty: closed.reduce((s, r) => s + r.closingQty, 0),
    viaCrm: closed.filter((r) => r.closingChannel === CHANNEL_CRM).length,
  };
}
