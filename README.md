# EvoBible

EvoBible adalah Alkitab Indonesia (Alkitab Yang Terbuka, AYT) yang bisa dicari ayatnya berdasarkan perasaan, misalnya "takut", "kesepian", atau "bersyukur". Situs ini adalah Progressive Web App (PWA): bisa dipasang di layar utama HP, dan teks Alkitab tetap bisa dibaca tanpa internet.

## Cara kerja

- Pembaca dan pencarian dasar berjalan di perangkat: teks AYT dan kamus 50 tema tersimpan di situs, sehingga tetap berfungsi tanpa internet.
- Tombol **Cari** memanggil fungsi server `cari` di Supabase, yang meminta Gemini memilih ayat yang paling sesuai dari ayat-ayat kandidat. Jika panggilan gagal, kuota harian penuh, atau perangkat sedang offline, hasil lokal tetap ditampilkan.

## Struktur berkas

- `index.html`: halaman utama
- `styles.css`: tampilan
- `app.js`: logika aplikasi dan pembaca
- `engine-core.js`: mesin pencarian dasar
- `engine.js`: kamus tema (50 tema)
- `data.js`: teks Alkitab AYT
- `sw.js`: service worker (cache offline)
- `manifest.webmanifest`: data PWA (nama, ikon, warna)
- `icons/`: ikon aplikasi
- `fonts/`: font Plus Jakarta Sans dan Source Serif 4

## Menayangkan

Situs ditayangkan lewat GitHub Pages dari branch `main`, dengan folder root sebagai sumber.

## Backend

- Project Supabase: **evobible** (ref `ddydxagduxhzzsrlwgkd`)
- Fungsi Edge: **cari**
- Tabel **pemakaian**: menyimpan hitungan pemakaian harian untuk batas kuota.
- Rahasia `GEMINI_API_KEY` diisi di Dashboard Supabase > Edge Functions > Secrets.
- Opsional: `GEMINI_MODEL`, `PER_DEVICE_DAILY` (12), `GLOBAL_DAILY` (350).
- Workflow `.github/workflows/keepalive.yml` memanggil fungsi `cari` tiap 3 hari agar project tidak dijeda karena tidak aktif.

## Memperbarui

Ubah `VERSION` di `sw.js` setiap kali berkas situs berubah, agar cache di HP ikut diperbarui.

## Privasi

- Isi pencarian tidak disimpan.
- Hanya hitungan penggunaan harian yang disimpan, dengan kunci acak.
- Saat tombol Cari ditekan, kalimat pencarian dikirim ke server dan ke Google Gemini.

## Lisensi dan atribusi

- Teks Alkitab Yang Terbuka (AYT) © Yayasan Lembaga SABDA 2011, 2024. Boleh dipakai dan dibagikan gratis untuk tujuan non-komersial dengan mencantumkan atribusi. Info: ayt.co. Izin komersial: ylsa@sabda.org.
- Font Plus Jakarta Sans dan Source Serif 4 berlisensi SIL OFL 1.1 (melalui Fontsource).

## Bahasa (i18n)

Aplikasi saat ini hanya berbahasa Indonesia. Terjemahan bahasa Inggris sudah disiapkan, tapi pilihan bahasanya belum ditampilkan.

- `i18n.js`: penerjemah tampilan. Kode tetap menulis teks Indonesia. Saat bahasa Inggris aktif, teks di layar diterjemahkan otomatis. Teks Alkitab, isi AI, dan isian pengguna tidak disentuh.
- `i18n-en.js`: kamus (`exact`), pola teks dinamis (`pat`), serta nama kitab, bulan, dan hari.
- Pratinjau bahasa Inggris: buka aplikasi dengan `?lang=en`.
- Setiap menambah atau mengubah fitur: jelajahi layarnya di `?lang=en`, jalankan `EvoI18n.missing()` di konsol, lalu tambahkan terjemahan yang kurang ke `i18n-en.js`.
- Saat merilis: ubah `ENABLED` di `i18n.js` menjadi `true` dan tambahkan pilihan bahasa di Tampilan.

### Tiga preferensi bahasa yang terpisah (aturan tetap)

Bahasa tampilan **tidak boleh** mengubah bahasa isi. Pengguna bisa memakai tampilan bahasa Inggris tapi tetap membaca ayat dan menerima renungan dalam bahasa Indonesia, atau sebaliknya.

| Preferensi | Kunci penyimpanan | Mengatur | Tidak mengatur |
|---|---|---|---|
| Bahasa tampilan | `evo.lang` (`id`/`en`) | menu, tombol, pengaturan, judul fitur, nama tema, nama kitab di label | teks ayat, isi AI |
| Bahasa isi | `evo.clang` (`id`/`en`) | bahasa renungan dan doa dari AI, bahasa kata kunci pencarian tema, bahasa salam yang dibacakan suara | tampilan |
| Versi Alkitab | `evo.ver` (`main`, `cmp`) | teks ayat di halaman baca, Ayat hari ini, bacaan harian, ayat di hasil Renungan dan pencarian | tampilan |

- Bawaan ketiganya Indonesia/AYT, dan masing-masing diubah sendiri-sendiri di Tampilan.
- Ayat di mana pun selalu memakai versi Alkitab pilihan (dengan cadangan AYT bila versi itu belum memuat kitabnya), tidak pernah mengikuti bahasa tampilan.
- Penerjemah tampilan (`i18n.js`) tidak menyentuh teks ayat, isi AI, atau isian pengguna. Bagian baru yang berisi ayat atau isi AI harus ditambahkan ke daftar `SKIP` di `i18n.js`, atau diberi atribut `data-noi18n`.
- Fungsi AI di server menerima bahasa isi sebagai parameter terpisah (`lang`) dan versi Alkitab sebagai parameter lain, bukan diturunkan dari bahasa tampilan.
