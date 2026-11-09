# Keuangan Saya v1.1

Aplikasi keuangan pribadi, 100% offline. Semua data disimpan di perangkat dan
tidak memerlukan internet.

## Isi folder
- `web/` : aplikasi web (buka `web/index.html` langsung di browser)
- `android/` : proyek Android Studio untuk membuat APK (WebView + aset web)

## Fitur v1.1
- Menu terpisah **Pengeluaran** dan **Pemasukan** (tanpa pilihan jenis).
- Pengeluaran: Makanan (Makan, Minum), Transportasi (Bensin, Service, Sewa),
  Tagihan (Internet), Rokok (Cappuccino), Jajan, Lainnya.
- Pemasukan: Gaji, Pendapatan, Lainnya.
- Tambah kategori dan sub sendiri dengan tombol "+ Tambah kategori" / "+ Tambah sub".
- Edit transaksi lama: ketuk baris transaksi, ubah, lalu tekan **Perbarui**.
- Hapus: tekan ✕ sekali, lalu tekan "Hapus?" untuk memastikan.
- Simpan instan dan otomatis: setiap catatan langsung tersimpan.
- Kategori otomatis dari keterangan (contoh: "makan siang" → Makanan).
- Laporan Harian, Mingguan, dan Bulanan, dengan saldo awal, pemasukan,
  pengeluaran, dan saldo akhir.
- Ekspor PDF laporan: tekan **Simpan sebagai PDF**, lalu pilih "Simpan sebagai PDF".
- Nasihat keuangan otomatis sesuai data periode yang dipilih.

## Cara membuat APK (Android)
1. Pasang **Android Studio** (https://developer.android.com/studio).
2. Buka Android Studio → **Open** → pilih folder `android/`.
3. Tunggu proses *Gradle Sync* selesai (pertama kali bisa beberapa menit).
4. Menu **Build → Build Bundle(s) / APK(s) → Build APK(s)**.
5. Hasilnya: `android/app/build/outputs/apk/debug/app-debug.apk`.
6. Pindahkan file APK ke HP dan pasang. Izinkan "Pasang aplikasi tidak dikenal" bila diminta.

Catatan: APK dari Build APK adalah versi *debug*. Untuk dibagikan ke banyak
orang, gunakan **Build → Generate Signed App Bundle / APK** dengan kunci sendiri.

## Mengubah isi aplikasi
Bila mengubah file di `web/`, salin ulang ke `android/app/src/main/assets/`
sebelum membuat APK.

## Catatan
- Cadangkan data dengan mencetak laporan ke PDF secara berkala.
- Versi ini belum diuji langsung di perangkat Android. Jika ada masalah,
  kabari saya gejalanya.
