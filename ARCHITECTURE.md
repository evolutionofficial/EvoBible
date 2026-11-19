# EvoBible — Arsitektur

Dokumen ini menjelaskan struktur EvoBible seperti yang ada sekarang. Dokumen ini hanya mencatat kondisi nyata, tidak mengubah kode.

## Gambaran umum

EvoBible adalah Progressive Web App berisi Alkitab (AYT, TSI, KJV, BSB, dan Web), dengan pencarian ayat berdasarkan perasaan, Renungan, Nyanyian, Kisah, dan gambar ayat untuk dibagikan. Pembaca dan pencarian dasar berjalan di perangkat, dan tetap berfungsi offline berkat service worker.

Situs ini adalah situs statis. Tidak ada proses build. Berkas di root langsung disajikan.

| Bagian | Lokasi | Peran |
|---|---|---|
| Situs statis | root repo | HTML, CSS, JavaScript, data, dan aset |
| Data Alkitab | `ver/*.json` | Teks setiap versi Alkitab |
| Data pendukung | `kisah/`, `kidung/`, `data.js` | Kisah, nyanyian, dan kamus tema |
| Backend | `supabase/functions/doa/` | Fungsi Edge Supabase (`doa`) |
| Alat bantu | `tools/*.py` | Skrip Python untuk menyiapkan data (ikut terunggah ke situs, karena belum dikecualikan di `.assetsignore`) |

## Berkas di root

| Berkas | Peran |
|---|---|
| `index.html` | Halaman utama. Memuat semua skrip secara berurutan |
| `styles.css` | Seluruh gaya tampilan |
| `app.js` | Logika aplikasi, navigasi, dan seluruh fitur UI |
| `engine.js` | Kamus tema (50 tema), dimuat sebagai `window.__ENGINE` |
| `engine-core.js` | Mesin pencarian dasar |
| `data.js` | Teks Alkitab AYT |
| `i18n.js`, `i18n-en.js` | Terjemahan antarmuka (Indonesia dan Inggris) |
| `gambar.js` | Pembuat gambar ayat untuk dibagikan, digambar di canvas |
| `sw.js` | Service worker. `VERSION` dan daftar `PRECACHE` ada di sini |
| `manifest.webmanifest`, `icons/`, `fonts/` | Pemasangan PWA dan aset |
| `vendor/supabase.js` | Klien Supabase pihak ketiga |
| `.assetsignore` | Daftar berkas yang tidak ikut disajikan ke publik |

## Kondisi saat ini

- `app.js` berisi sekitar 2.270 baris dalam satu berkas. Bagian-bagian di dalamnya sudah diberi penanda: data, state, Renungan, Info Gereja, Evo Seasons, Katolik, pengaturan, routing, beranda, cari, Nyanyian, Kisah, baca, cari dengan suara, membaca suara, akun dan sinkron, gestur, dan gulir otomatis. Penanda ini belum dipisah menjadi berkas tersendiri.
- Ada penanganan khusus untuk iPhone dan Safari di dalam `app.js` (gestur sentuh, zoom, dan transisi halaman). Bagian ini harus dipindahkan dengan hati-hati.
- Repo ini belum punya test otomatis.
- Service worker memakai `VERSION` manual (sekarang `v89`) dan cache terpisah untuk versi Alkitab (`evobible-versi-1`).
- `.assetsignore` mengecualikan berkas non-publik seperti `supabase/`, `.github/`, dan `README.md` dari deploy.

## Backend

- Project Supabase `evobible`. Fungsi Edge `doa` memanggil Gemini untuk memilih ayat yang sesuai dari kandidat. Kunci `GEMINI_API_KEY` diisi di Dashboard Supabase, tidak di repo.
- `.github/workflows/keepalive.yml` memanggil fungsi tiap 3 hari supaya project tidak dijeda.

## Aturan kerja untuk perubahan

1. Setiap perubahan pada berkas situs menaikkan `VERSION` di `sw.js`, supaya cache di HP ikut diperbarui.
2. Jika berkas baru dibutuhkan saat offline, tambahkan ke `PRECACHE` di `sw.js`.
3. Berkas yang tidak dibutuhkan aplikasi (misalnya dokumen ini) didaftarkan di `.assetsignore`. `tools/` dan `kisah/PANDUAN.md` belum didaftarkan dan ikut terunggah; itu perlu diputuskan terpisah.
4. Pemecahan `app.js` dilakukan bertahap, dan setiap langkah harus tidak mengubah perilaku. Tanpa test otomatis, uji manual di HP (iPhone dan Android) wajib dilakukan sebelum merge.
