import mysql from 'mysql2/promise';

const globalForDb = globalThis as unknown as { crmPool?: mysql.Pool };

// Satu pool dipakai ulang, termasuk saat hot reload di mode dev.
export const pool =
  globalForDb.crmPool ??
  mysql.createPool({
    host: process.env.DB_HOST ?? '127.0.0.1',
    port: Number(process.env.DB_PORT ?? 3306),
    user: process.env.DB_USER ?? 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME ?? 'dataslu',
    connectionLimit: 5,
    dateStrings: true,
  });

if (process.env.NODE_ENV !== 'production') globalForDb.crmPool = pool;
