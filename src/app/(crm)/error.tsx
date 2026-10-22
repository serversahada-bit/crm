'use client';

import { DatabaseZap } from 'lucide-react';

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="error-block">
      <DatabaseZap size={36} />
      <h2>Data tidak bisa dimuat</h2>
      <p>
        Pastikan <strong>MySQL di XAMPP Control Panel sudah Start</strong> dan pengaturan di file <code>.env.local</code> sudah benar
        (DB_HOST, DB_USER, DB_PASSWORD, DB_NAME).
      </p>
      <pre>{error.message}</pre>
      <button className="btn-primary-gradient" onClick={reset}>
        Coba lagi
      </button>
    </div>
  );
}
