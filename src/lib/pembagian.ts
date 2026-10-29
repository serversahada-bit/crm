// Pembagian otomatis customer baru dari CSO (CS akuisisi) ke tim CRM.
// Disimpan di tabel milik aplikasi ini; kolom data_customer.crm (diisi sistem lain) tidak diubah.
import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { DISTRIBUTION_START, DISTRIBUTION_WAIT_DAYS } from './config';
import type { Customer, Dataset } from './dataset';
import { pool } from './db';

export const ASSIGNMENT_TABLE = 'crm_pembagian';
export const TEAM_TABLE = 'crm_tim';

export interface Assignment {
  phone: string;
  crm: string;
  cso: string; // CS order pertama
  firstDate: string; // tanggal order pertama (YYYY-MM-DD)
  method: 'otomatis' | 'manual';
  by: string | null; // username yang membagi manual
  at: string; // waktu dibagikan
}

export interface TeamMember {
  nama: string;
  aktif: boolean;
}

/** Status paket diterima di tabel tracking. */
const DELIVERED = ['Selesai', 'Completed', 'DELIVERED', 'Sampai Tujuan'];

/** Waktu lokal server dalam format DATETIME MySQL. */
function nowSql(): string {
  const d = new Date();
  d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
  return d.toISOString().slice(0, 19).replace('T', ' ');
}

const tablesReady = globalThis as unknown as { crmPembagianTables?: Promise<void> };

/** Tabel tim & pembagian di database dataslu, dibuat otomatis jika belum ada. */
function ensureTables(): Promise<void> {
  tablesReady.crmPembagianTables ??= Promise.all([
    pool.query(
      `CREATE TABLE IF NOT EXISTS ${TEAM_TABLE} (
         id INT AUTO_INCREMENT PRIMARY KEY,
         nama VARCHAR(100) NOT NULL,
         aktif TINYINT(1) NOT NULL DEFAULT 1,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         UNIQUE KEY uq_${TEAM_TABLE}_nama (nama)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    ),
    pool.query(
      `CREATE TABLE IF NOT EXISTS ${ASSIGNMENT_TABLE} (
         hp VARCHAR(20) NOT NULL PRIMARY KEY COMMENT 'no. HP customer, format 628xxx',
         crm VARCHAR(100) NOT NULL,
         cso VARCHAR(100) NULL COMMENT 'CS order pertama',
         tgl_order DATE NULL COMMENT 'tanggal order pertama',
         kode_booking VARCHAR(100) NULL,
         cara ENUM('otomatis', 'manual') NOT NULL DEFAULT 'otomatis',
         oleh VARCHAR(50) NULL,
         dibagi_pada DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         KEY idx_${ASSIGNMENT_TABLE}_crm (crm)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    ),
  ])
    .then(() => undefined)
    .catch((err) => {
      tablesReady.crmPembagianTables = undefined;
      throw err;
    });
  return tablesReady.crmPembagianTables;
}

function toAssignment(row: RowDataPacket): Assignment {
  return {
    phone: row.hp,
    crm: row.crm,
    cso: row.cso ?? '',
    firstDate: row.tgl_order ?? '',
    method: row.cara,
    by: row.oleh,
    at: row.dibagi_pada,
  };
}

export async function loadAssignments(): Promise<Map<string, Assignment>> {
  await ensureTables();
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${ASSIGNMENT_TABLE}`);
  return new Map(rows.map((row) => [row.hp, toAssignment(row)]));
}

export async function listTeam(): Promise<TeamMember[]> {
  await ensureTables();
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT nama, aktif FROM ${TEAM_TABLE} ORDER BY id`);
  return rows.map((row) => ({ nama: row.nama, aktif: row.aktif === 1 }));
}

export async function addTeamMember(nama: string): Promise<boolean> {
  await ensureTables();
  const [result] = await pool.query<ResultSetHeader>(`INSERT IGNORE INTO ${TEAM_TABLE} (nama) VALUES (?)`, [nama]);
  return result.affectedRows > 0;
}

export async function setTeamMemberActive(nama: string, aktif: boolean) {
  await ensureTables();
  await pool.query(`UPDATE ${TEAM_TABLE} SET aktif = ? WHERE nama = ?`, [aktif ? 1 : 0, nama]);
}

/** Hapus dari tim. Customer yang sudah dibagikan ke CRM ini tetap tercatat. */
export async function removeTeamMember(nama: string) {
  await ensureTables();
  await pool.query(`DELETE FROM ${TEAM_TABLE} WHERE nama = ?`, [nama]);
}

/** Terapkan pembagian ke data di memori agar langsung terlihat tanpa muat ulang. */
function applyToDataset(ds: Dataset, phone: string, assignment: Assignment | null) {
  if (assignment) ds.assignments.set(phone, assignment);
  else ds.assignments.delete(phone);
  const crm = assignment?.crm ?? ds.profiles.get(phone)?.crm ?? '';
  for (const view of ds.views.values()) {
    const c = view.byPhone.get(phone);
    if (c) c.crm = crm;
  }
}

/** Customer baru CSO (order pertama sejak DISTRIBUTION_START) yang belum punya CRM, urut order pertama. */
export function pendingCustomers(ds: Dataset): Customer[] {
  const all = ds.views.get('all')?.customers ?? [];
  return all
    .filter((c) => c.source === 'cso' && c.firstDate >= DISTRIBUTION_START && !ds.assignments.has(c.phone))
    .sort((a, b) => (a.firstDate < b.firstDate ? -1 : a.firstDate > b.firstDate ? 1 : 0));
}

/** Kode booking yang paketnya sudah tercatat diterima di tabel tracking. */
async function deliveredBookings(ids: string[]): Promise<Set<string>> {
  const delivered = new Set<string>();
  for (let i = 0; i < ids.length; i += 1000) {
    const [rows] = await pool.query<RowDataPacket[]>(
      `SELECT d.kode_booking FROM data_transaksi d JOIN tracking t ON t.tracking_id = d.resi
        WHERE d.kode_booking IN (?) AND t.status_paket IN (?)`,
      [ids.slice(i, i + 1000), DELIVERED],
    );
    for (const row of rows) delivered.add(row.kode_booking);
  }
  return delivered;
}

async function distribute(ds: Dataset): Promise<number> {
  const team = (await listTeam()).filter((m) => m.aktif).map((m) => m.nama);
  const pending = pendingCustomers(ds);
  if (!team.length || !pending.length) return 0;

  const firstOrder = (c: Customer) => ds.ordersByPhone.get(c.phone)![0];
  const delivered = await deliveredBookings(pending.map((c) => firstOrder(c).id));
  const ready = pending.filter((c) => {
    const first = firstOrder(c);
    // Order retur sudah tidak dihitung, jadi tanpa data tracking cukup ditunggu beberapa hari.
    return delivered.has(first.id) || ds.refDay - first.day >= DISTRIBUTION_WAIT_DAYS;
  });
  if (!ready.length) return 0;

  // Dibagi rata per bulan order pertama: customer berikutnya ke CRM dengan jatah paling sedikit di bulan itu.
  const counts = new Map<string, number>();
  for (const a of ds.assignments.values()) {
    const key = `${a.firstDate.slice(0, 7)}|${a.crm}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const at = nowSql();
  const assigned: Assignment[] = [];
  for (const c of ready) {
    const month = c.firstDate.slice(0, 7);
    let crm = team[0];
    for (const name of team) if ((counts.get(`${month}|${name}`) ?? 0) < (counts.get(`${month}|${crm}`) ?? 0)) crm = name;
    counts.set(`${month}|${crm}`, (counts.get(`${month}|${crm}`) ?? 0) + 1);
    assigned.push({ phone: c.phone, crm, cso: firstOrder(c).cs, firstDate: c.firstDate, method: 'otomatis', by: null, at });
  }

  await pool.query(`INSERT IGNORE INTO ${ASSIGNMENT_TABLE} (hp, crm, cso, tgl_order, kode_booking, cara) VALUES ?`, [
    assigned.map((a) => [a.phone, a.crm, a.cso, a.firstDate, ds.ordersByPhone.get(a.phone)![0].id, a.method]),
  ]);
  for (const a of assigned) applyToDataset(ds, a.phone, a);
  return assigned.length;
}

const running = globalThis as unknown as { crmDistributing?: Promise<number> };

/** Bagikan customer baru CSO yang sudah siap ke tim CRM aktif. Mengembalikan jumlah customer yang dibagikan. */
export function distributeNewCustomers(ds: Dataset): Promise<number> {
  running.crmDistributing ??= distribute(ds).finally(() => {
    running.crmDistributing = undefined;
  });
  return running.crmDistributing;
}

/** Ubah CRM pemegang satu customer secara manual. `crm` kosong = hapus pembagian. */
export async function assignManually(ds: Dataset, phone: string, crm: string, by: string) {
  await ensureTables();
  if (!crm) {
    await pool.query(`DELETE FROM ${ASSIGNMENT_TABLE} WHERE hp = ?`, [phone]);
    applyToDataset(ds, phone, null);
    return;
  }
  const first = ds.ordersByPhone.get(phone)?.[0];
  const assignment: Assignment = {
    phone,
    crm,
    cso: first?.cs ?? '',
    firstDate: first?.date ?? '',
    method: 'manual',
    by,
    at: nowSql(),
  };
  await pool.query(
    `INSERT INTO ${ASSIGNMENT_TABLE} (hp, crm, cso, tgl_order, kode_booking, cara, oleh) VALUES (?, ?, ?, ?, ?, 'manual', ?)
     ON DUPLICATE KEY UPDATE crm = VALUES(crm), cara = 'manual', oleh = VALUES(oleh), dibagi_pada = CURRENT_TIMESTAMP`,
    [phone, crm, assignment.cso, assignment.firstDate || null, first?.id ?? null, by],
  );
  applyToDataset(ds, phone, assignment);
}
