// Paket yang tidak sampai ke customer (retur / gagal kirim), dibaca dari tabel tracking ekspedisi.
// Order CSO yang retur tetap berstatus "1" di data_transaksi, jadi status pengirimannya harus dicek lewat no. resi.
import type { RowDataPacket } from 'mysql2';
import { pool } from './db';

export type ReturKind = 'Retur' | 'Gagal kirim';

export interface ReturInfo {
  kind: ReturKind;
  reason: string;
}

const RETUR_SQL = "(t.retur_flag IN ('Retur', 'Returned to Sender') OR t.status_paket IN ('Retur', 'Returned to Sender') OR t.status = 'Retur')";

/** Kondisi SQL (alias tabel tracking = t) untuk paket retur atau pengiriman yang dibatalkan ekspedisi. */
const TRACKING_FAILED_SQL = `(${RETUR_SQL} OR t.retur_flag = 'Cancelled' OR t.status_paket = 'Dibatalkan')`;

const SELECT_FAILED = `SELECT t.tracking_id, ${RETUR_SQL} AS retur,
       LEFT(COALESCE(NULLIF(t.rts_reason, ''), NULLIF(t.granular_status, ''), t.status_paket), 80) AS alasan
  FROM tracking t`;

/** "Return to sender: Nobody at address" -> "Nobody at address", "UNABLE_TO_FIND_ADDRESS" -> "Unable to find address". */
function cleanReason(raw: string | null): string {
  let s = (raw ?? '').replace(/^return to sender:\s*/i, '').trim();
  if (/^[A-Z_, ]+$/.test(s)) s = s.replace(/_/g, ' ').toLowerCase().replace(/^./, (ch) => ch.toUpperCase());
  return /^(retur|returned to sender|dibatalkan|cancelled)$/i.test(s) ? '' : s;
}

function toInfo(row: RowDataPacket): ReturInfo {
  return { kind: row.retur ? 'Retur' : 'Gagal kirim', reason: cleanReason(row.alasan) };
}

/** Semua resi yang retur / gagal kirim (beberapa ribu baris). */
export async function loadFailedDeliveries(): Promise<Map<string, ReturInfo>> {
  const [rows] = await pool.query<RowDataPacket[]>(`${SELECT_FAILED} WHERE ${TRACKING_FAILED_SQL}`);
  return new Map(rows.map((row) => [row.tracking_id, toInfo(row)]));
}
