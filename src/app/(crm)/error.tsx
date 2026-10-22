'use client';

import { DatabaseZap } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="error-block">
      <DatabaseZap size={36} />
      <h2>Data tidak bisa dimuat</h2>
      <p>
        Pastikan database MySQL menyala dan bisa diakses, dan pengaturan DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME sudah benar
        (di <code>.env.local</code> untuk lokal, atau Environment Variables di server).
      </p>
      {/* Di mode produksi pesan asli disembunyikan; kode digest dipakai untuk mencarinya di log server. */}
      <pre>{error.digest ? `Kode error: ${error.digest} (cari kode ini di log server)` : error.message}</pre>
      <button className="btn-primary-gradient" onClick={reset}>
        Coba lagi
      </button>
    </div>
  );
}
