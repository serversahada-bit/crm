// Dipanggil sekali saat server Next.js menyala.
export async function register() {
  // Lewati saat `next build`, dan hanya untuk runtime Node.js (driver MySQL tidak jalan di Edge).
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.NEXT_PHASE === 'phase-production-build') return;
  const { warmDataset } = await import('./lib/dataset');
  // Tidak di-await: server langsung siap menerima request sementara data dimuat di latar belakang.
  warmDataset();
}
