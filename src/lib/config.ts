// Aturan bisnis yang bisa disesuaikan. Semua angka dalam satuan hari kecuali disebutkan lain.

/** Data dianalisa mulai tanggal ini. */
export const START_DATE = '2023-01-01';

/**
 * Order dari CS ini bukan customer (endorse, pemenang giveaway, aset live, dll.) dan tidak dihitung sama sekali.
 * Dicocokkan per kata pada nama CS, mis. "ADV Google Bagas", "Afia Rizqi Tazkya". Huruf kecil semua.
 */
export const NON_CUSTOMER_CS = ['afia', 'bagas', 'dani', 'dhani'];

/** Sama seperti NON_CUSTOMER_CS, tapi dicocokkan dengan awalan nama CS, mis. "FFHana", "FFsherly". */
export const NON_CUSTOMER_CS_PREFIX = ['ff'];

/**
 * Order Jan-Nov 2023 tidak punya kolom produk sama sekali. Di awal 2024 ±99% order adalah Gamamilk,
 * jadi order tanpa info produk sebelum tanggal ini dianggap Gamamilk. Isi '' untuk mematikan.
 */
export const ASSUME_GAMAMILK_BEFORE = '2024-01-01';

/** Lama data disimpan di memori server sebelum dimuat ulang dari database (ms). */
export const CACHE_TTL_MS = 10 * 60 * 1000;

/** Status customer berdasarkan jarak hari sejak order terakhir. */
export const STATUS_RULES = {
  aktifMaxDays: 60, // <= 60 hari: Aktif
  pasifMaxDays: 180, // 61-180 hari: Pasif, > 180 hari: Churn
};

/** Skor Recency: order terakhir <= N hari yang lalu mendapat skor tsb. Di luar semuanya = 1. */
export const RECENCY_SCORE: { maxDays: number; score: number }[] = [
  { maxDays: 30, score: 5 },
  { maxDays: 60, score: 4 },
  { maxDays: 90, score: 3 },
  { maxDays: 180, score: 2 },
];

/** Skor Frequency: jumlah order >= N mendapat skor tsb (dicek dari atas). */
export const FREQUENCY_SCORE: { minOrders: number; score: number }[] = [
  { minOrders: 10, score: 5 },
  { minOrders: 5, score: 4 },
  { minOrders: 3, score: 3 },
  { minOrders: 2, score: 2 },
  { minOrders: 1, score: 1 },
];

/** Monetary diskor 1-5 berdasarkan kuintil total belanja seluruh customer. */

/** Reminder RO: customer dengan 1 order dianggap butuh RO setelah N hari. */
export const DEFAULT_RO_INTERVAL_DAYS = 30;

/** Reminder RO: toleransi hari sebelum jatuh tempo agar sudah muncul di daftar. */
export const RO_REMINDER_LEAD_DAYS = 5;

/** Pembagian otomatis: customer baru CSO dengan order pertama sejak tanggal ini dibagikan ke tim CRM. */
export const DISTRIBUTION_START = '2026-10-01';

/**
 * Customer baru dibagikan setelah paketnya tercatat diterima di tabel tracking. Jika data tracking belum masuk,
 * dibagikan setelah N hari sejak order selama tidak tercatat retur.
 */
export const DISTRIBUTION_WAIT_DAYS = 14;
