export function formatRupiah(value: number): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(value);
}

export function formatCompactRupiah(value: number): string {
  if (value >= 1_000_000_000) {
    return `Rp ${(value / 1_000_000_000).toFixed(1)} M`;
  }
  if (value >= 1_000_000) {
    return `Rp ${(value / 1_000_000).toFixed(0)} Jt`;
  }
  return formatRupiah(value);
}

export function formatDate(dateString: string): string {
  try {
    const d = new Date(dateString);
    return new Intl.DateTimeFormat('id-ID', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    }).format(d);
  } catch {
    return dateString;
  }
}

export function formatNumber(value: number, digits = 0): string {
  return new Intl.NumberFormat('id-ID', { maximumFractionDigits: digits }).format(value);
}

export function formatPercent(ratio: number, digits = 1): string {
  return `${formatNumber(ratio * 100, digits)}%`;
}

/** 45 -> "45 hari", 400 -> "1 thn 1 bln" */
export function formatDays(days: number | null): string {
  if (days === null) return '-';
  if (days < 60) return `${days} hari`;
  const months = Math.round(days / 30.4);
  if (months < 12) return `${months} bln`;
  const years = Math.floor(months / 12);
  const rest = months % 12;
  return rest ? `${years} thn ${rest} bln` : `${years} thn`;
}

/** 6281234567890 -> 0812-3456-7890, 85291234567 -> +852 9123 4567 */
export function formatPhone(phone: string): string {
  if (phone.startsWith('852') && phone.length === 11) return `+852 ${phone.slice(3, 7)} ${phone.slice(7)}`;
  const local = phone.startsWith('62') ? '0' + phone.slice(2) : phone;
  return local.replace(/^(\d{4})(\d{4})(\d+)$/, '$1-$2-$3');
}
