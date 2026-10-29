# CRM PTSLU

Aplikasi data customer & analisa retensi Gamamilk. Membaca langsung dari database MySQL `dataslu` (XAMPP),
menggantikan pengelolaan data customer manual.

## Menjalankan

1. Start **MySQL** di XAMPP Control Panel.
2. Cek koneksi di `.env.local` (contoh di `.env.example`).
3. `npm install` lalu `npm run dev`, buka http://localhost:3000

Data dimuat dari DB lalu disimpan di memori server selama 10 menit. Tombol **Muat ulang data** memaksa ambil ulang.
Hasil hitungan halaman (dashboard, cohort, RFM, urutan customer) di-cache per data (`memo` di `src/lib/dataset.ts`), dan
ringkasan halaman utama dihitung di latar belakang setiap selesai memuat (`src/lib/summary.ts`), jadi membuka halaman tidak
menghitung ulang ratusan ribu order. Sidebar menampilkan waktu upload terakhir dari `file_upload_sheet` / `waktu_cron`.

## Login

- Akun disimpan di tabel **`login_crm`** (database `dataslu`), dibuat otomatis saat aplikasi pertama kali dibuka.
- Saat tabel masih kosong, halaman `/login` menampilkan form **Buat akun admin pertama**.
- Admin menambah akun CS/admin lain lewat menu **Pengguna**; tiap user bisa ganti password di **Akun Saya** (klik nama di sidebar).
- `.env.local` wajib berisi `SESSION_SECRET` (acak, min. 16 karakter) untuk menandatangani cookie login.
- Password disimpan sebagai hash scrypt. Salah password 5x → username dikunci 5 menit.
  Akun yang dinonaktifkan atau diganti password-nya otomatis keluar dari semua perangkat.

## Menu

| Menu | Isi |
| --- | --- |
| Dashboard | Total customer, customer RO, customer aktif, omzet, customer baru vs RO per bulan, channel, kota, CS |
| Data Customer | Semua customer 2023-sekarang (no. HP, jumlah order/RO, total belanja, segmen), filter, export Excel, detail riwayat order |
| Riwayat Transaksi | Order mentah dari `data_transaksi` |
| Analisa RFM | 11 segmen RFM + saran tindakan, peta Recency x Frequency; bisa per tahun transaksi |
| Analisa Cohort | Tabel retensi per bulan pertama beli, kurva retensi, berapa lama customer bertahan; filter tahun & sumber customer (CSO / marketplace / CRM) |
| Reminder RO | Customer yang sudah waktunya beli lagi + tombol WhatsApp, filter per CRM |
| Customer Retur | Order retur / gagal kirim dari data tracking ekspedisi, alasan, per CS, customer yang tidak dihitung |
| Kampanye Treatment | Target satu segmen RFM (mis. Can't Lose Them) dibekukan saat kampanye dibuat, lalu dipantau closing vs target CR, per minggu, per CRM, per channel; daftar belum closing + WA + export Excel |
| Pembagian CRM (admin) | Tim CRM penerima, pembagian otomatis customer baru CSO, hasil per CRM |
| Pengguna (admin) | Tambah akun, ubah peran & nama CS, reset password, nonaktifkan akun |

## Aturan data (lihat `src/lib/config.ts` dan `src/lib/normalize.ts`)

- **1 customer = 1 no. HP** yang dinormalisasi ke `628xxx` (tanpa +, spasi, atau -); nomor Hong Kong tetap `852xxxxxxxx`.
  Order marketplace dengan no. HP disamarkan (`******99`) tidak bisa dihitung sebagai customer.
- Order non-customer (endorse / giveaway) dari CS **Afia, Bagas, Dani/Dhani, FF...** tidak dihitung sama sekali
  (`NON_CUSTOMER_CS` di `src/lib/config.ts`).
- Export Data Customer berupa file **.xlsx** agar no. HP tampil utuh di Excel, termasuk kolom produk yang pernah dibeli.
- Order dengan status batal/cancel/retur/gagal tidak dihitung. Beberapa order di hari yang sama = 1 kali beli.
- Order CSO yang retur tetap berstatus `1` di `data_transaksi`, jadi dicek lewat `resi` ke tabel **`tracking`**
  (retur / returned to sender / dibatalkan ekspedisi). Order ini tidak dihitung sebagai pembelian, customer baru, maupun omzet
  (`src/lib/retur.ts`).
- Sumber customer = channel order pertama: **CSO** (iklan / WA), marketplace, atau CRM.
- RFM per tahun: hanya order tahun tsb, Recency dihitung per 31 Desember (atau data terakhir untuk tahun berjalan).
- Produk dibaca dari `barang_1` → `barang` → `isi_paket` → `keterangan`. Order tanpa info produk sebelum 2024 (Jan-Nov 2023)
  dan kode paket `R-n`/`S-n` tanpa nama produk dianggap **Gamamilk**.
- Status: Aktif ≤ 60 hari, Pasif 61-180 hari, Churn > 180 hari sejak order terakhir.
- RFM: Recency & Frequency memakai batas tetap, Monetary memakai kuintil total belanja.

## Pembagian customer ke CRM

- Tim CRM penerima diatur admin di menu **Pembagian CRM** (tabel `crm_tim`); hasil pembagian di tabel `crm_pembagian`.
  Keduanya dibuat otomatis. Kolom `data_customer.crm` tidak diubah.
- Customer baru CSO dengan order pertama sejak `DISTRIBUTION_START` dibagikan otomatis setiap data dimuat (tiap 10 menit)
  ke CRM aktif dengan jatah paling sedikit di bulan order pertamanya.
- Customer dibagikan setelah paketnya tercatat diterima di `tracking`, atau setelah `DISTRIBUTION_WAIT_DAYS` hari bila data
  tracking belum masuk. Admin bisa mengganti CRM pemegang dari halaman detail customer.

## Kampanye treatment

- Admin membuat kampanye di menu **Kampanye Treatment**: segmen, produk, tanggal mulai/selesai, target CR. Daftar customer
  segmen tsb disimpan (tabel `crm_kampanye`, `crm_kampanye_customer`) karena customer yang closing otomatis pindah segmen.
- Closing = customer di daftar yang punya order sukses produk kampanye antara tanggal mulai dan selesai, lewat channel apa pun
  (rincian lewat CRM vs channel lain ditampilkan). Order retur dan non-customer tidak dihitung.
- Selama kampanye belum mulai, daftar customer bisa diambil ulang dari data terbaru.

## Struktur

- `src/lib/dataset.ts`: memuat & membersihkan data, profil customer, skor RFM
- `src/lib/cohort.ts`: retensi cohort & lama bertahan
- `src/lib/rfm.ts`: definisi segmen
- `src/lib/pembagian.ts`: pembagian customer baru CSO ke tim CRM
- `src/lib/auth.ts`, `session.ts`, `users.ts`, `password.ts`: login & akun
- `src/proxy.ts`: mengalihkan request tanpa login ke `/login`
- `src/app/(crm)/*`: halaman CRM (Server Components, filter lewat URL); `src/app/login`: halaman login
