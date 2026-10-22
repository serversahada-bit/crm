# CRM PTSLU

Aplikasi data customer & analisa retensi Gamamilk. Membaca langsung dari database MySQL `dataslu` (XAMPP),
menggantikan pengelolaan data customer manual.

## Menjalankan

1. Start **MySQL** di XAMPP Control Panel.
2. Cek koneksi di `.env.local` (contoh di `.env.example`).
3. `npm install` lalu `npm run dev`, buka http://localhost:3000

Data dimuat dari DB lalu disimpan di memori server selama 10 menit. Tombol **Muat ulang data** memaksa ambil ulang.

## Menu

| Menu | Isi |
| --- | --- |
| Dashboard | Total customer, customer RO, customer aktif, omzet, customer baru vs RO per bulan, channel, kota, CS |
| Data Customer | Semua customer 2023-sekarang (no. HP, jumlah order/RO, total belanja, segmen), filter, export CSV, detail riwayat order |
| Riwayat Transaksi | Order mentah dari `data_transaksi` |
| Analisa RFM | 11 segmen RFM + saran tindakan, peta Recency x Frequency |
| Analisa Cohort | Tabel retensi per bulan pertama beli, kurva retensi, berapa lama customer bertahan |
| Reminder RO | Customer yang sudah waktunya beli lagi + tombol WhatsApp |

## Aturan data (lihat `src/lib/config.ts` dan `src/lib/normalize.ts`)

- **1 customer = 1 no. HP** yang dinormalisasi ke `628xxx`. Order marketplace dengan no. HP disamarkan (`******99`) tidak bisa dihitung sebagai customer.
- Order dengan status batal/cancel/retur/gagal tidak dihitung. Beberapa order di hari yang sama = 1 kali beli.
- Produk dibaca dari `barang_1` → `barang` → `isi_paket` → `keterangan`. Order tanpa info produk sebelum 2024 (Jan-Nov 2023)
  dan kode paket `R-n`/`S-n` tanpa nama produk dianggap **Gamamilk**.
- Status: Aktif ≤ 60 hari, Pasif 61-180 hari, Churn > 180 hari sejak order terakhir.
- RFM: Recency & Frequency memakai batas tetap, Monetary memakai kuintil total belanja.

## Struktur

- `src/lib/dataset.ts`: memuat & membersihkan data, profil customer, skor RFM
- `src/lib/cohort.ts`: retensi cohort & lama bertahan
- `src/lib/rfm.ts`: definisi segmen
- `src/app/*`: halaman (Server Components, filter lewat URL)
