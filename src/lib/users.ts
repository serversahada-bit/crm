import type { ResultSetHeader, RowDataPacket } from 'mysql2';
import { pool } from './db';

/** Nama tabel akun login CRM di database dataslu. */
export const USER_TABLE = 'login_crm';

export type Role = 'admin' | 'cs';

export interface UserRecord {
  id: number;
  username: string;
  nama: string;
  passwordHash: string;
  role: Role;
  namaCs: string | null;
  aktif: boolean;
  lastLogin: string | null;
  createdAt: string;
}

const tableReady = globalThis as unknown as { loginTable?: Promise<void> };

/** Tabel akun CRM di database dataslu, dibuat otomatis jika belum ada. */
function ensureTable(): Promise<void> {
  tableReady.loginTable ??= pool
    .query(
      `CREATE TABLE IF NOT EXISTS ${USER_TABLE} (
         id INT AUTO_INCREMENT PRIMARY KEY,
         username VARCHAR(50) NOT NULL,
         nama VARCHAR(100) NOT NULL,
         password_hash VARCHAR(255) NOT NULL,
         role ENUM('admin', 'cs') NOT NULL DEFAULT 'cs',
         nama_cs VARCHAR(100) NULL COMMENT 'nama CS di data_transaksi.cs, untuk filter per CS',
         aktif TINYINT(1) NOT NULL DEFAULT 1,
         last_login DATETIME NULL,
         created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
         updated_at DATETIME NULL ON UPDATE CURRENT_TIMESTAMP,
         UNIQUE KEY uq_${USER_TABLE}_username (username)
       ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci`,
    )
    .then(() => undefined)
    .catch((err) => {
      tableReady.loginTable = undefined;
      throw err;
    });
  return tableReady.loginTable;
}

function toUser(row: RowDataPacket): UserRecord {
  return {
    id: row.id,
    username: row.username,
    nama: row.nama,
    passwordHash: row.password_hash,
    role: row.role,
    namaCs: row.nama_cs,
    aktif: row.aktif === 1,
    lastLogin: row.last_login,
    createdAt: row.created_at,
  };
}

export async function countUsers(): Promise<number> {
  await ensureTable();
  const [[row]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${USER_TABLE}`);
  return row.n;
}

export async function findUserByUsername(username: string): Promise<UserRecord | null> {
  await ensureTable();
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${USER_TABLE} WHERE username = ?`, [username]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function findUserById(id: number): Promise<UserRecord | null> {
  await ensureTable();
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${USER_TABLE} WHERE id = ?`, [id]);
  return rows[0] ? toUser(rows[0]) : null;
}

export async function listUsers(): Promise<UserRecord[]> {
  await ensureTable();
  const [rows] = await pool.query<RowDataPacket[]>(`SELECT * FROM ${USER_TABLE} ORDER BY aktif DESC, role, nama`);
  return rows.map(toUser);
}

export async function countActiveAdmins(): Promise<number> {
  await ensureTable();
  const [[row]] = await pool.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM ${USER_TABLE} WHERE role = 'admin' AND aktif = 1`);
  return row.n;
}

export async function insertUser(u: { username: string; nama: string; passwordHash: string; role: Role; namaCs: string | null }): Promise<number> {
  await ensureTable();
  const [res] = await pool.query<ResultSetHeader>(
    `INSERT INTO ${USER_TABLE} (username, nama, password_hash, role, nama_cs) VALUES (?, ?, ?, ?, ?)`,
    [u.username, u.nama, u.passwordHash, u.role, u.namaCs],
  );
  return res.insertId;
}

export async function updateUserProfile(id: number, u: { nama: string; role: Role; namaCs: string | null }) {
  await pool.query(`UPDATE ${USER_TABLE} SET nama = ?, role = ?, nama_cs = ? WHERE id = ?`, [u.nama, u.role, u.namaCs, id]);
}

export async function updateUserPassword(id: number, passwordHash: string) {
  await pool.query(`UPDATE ${USER_TABLE} SET password_hash = ? WHERE id = ?`, [passwordHash, id]);
}

export async function setUserActive(id: number, aktif: boolean) {
  await pool.query(`UPDATE ${USER_TABLE} SET aktif = ? WHERE id = ?`, [aktif ? 1 : 0, id]);
}

export async function touchLastLogin(id: number) {
  await pool.query(`UPDATE ${USER_TABLE} SET last_login = NOW() WHERE id = ?`, [id]);
}
