# Panduan menulis isi "Kisah" untuk EvoBible

EvoBible adalah aplikasi Alkitab berbahasa Indonesia untuk umat Katolik dan Protestan, banyak dipakai orang lanjut usia. Fitur "Kisah" berisi bacaan pendek (3–5 menit) yang enak dibaca atau dibacakan oleh suara HP. Isinya nanti ditinjau oleh romo/katekis, jadi tulis serapi dan seakurat mungkin.

## Gaya bahasa
- Bahasa Indonesia baku yang hangat, sederhana, dan mengalir seperti bercerita. Kalimat pendek–sedang. Hindari istilah sulit; bila perlu, jelaskan singkat.
- Sapa pembaca dengan "kita" (bukan "Anda" atau "kamu").
- Ejaan nama mengikuti kebiasaan Gereja Katolik Indonesia: Santo/Santa, Yohanes, Fransiskus, Teresia, Agustinus, Petrus, Paulus, Maria, Yosef, Ignatius, dst. Nama tempat memakai bentuk Indonesia bila lazim (Roma, Yerusalem, Asisi, Siena, Aleksandria).
- Nama Allah: "Allah", "Tuhan", "Yesus", "Kristus", "Roh Kudus". Kata ganti untuk Allah/Yesus memakai huruf kapital: Dia, -Nya, Ia.
- Tanpa emoji, tanpa judul subbagian di dalam paragraf, tanpa daftar berbutir di dalam kisah.

## Akurasi (paling penting)
- Tulis HANYA fakta yang sudah mapan dan umum diketahui tentang tokoh itu. Bila ragu tentang suatu rincian (tahun, tempat, angka), JANGAN dicantumkan.
- Kisah legendaris/tradisi (misalnya kisah Santo Georgius dan naga, Santa Veronika) wajib ditandai "menurut tradisi" atau "kisah yang diwariskan turun-temurun menyebutkan…".
- JANGAN mengarang kutipan langsung dari orang kudus. Kutipan hanya boleh bila sangat terkenal dan pasti (misalnya "Hatiku gelisah sampai beristirahat dalam Engkau" dari Agustinus), dan tetap ditulis sebagai parafrase dengan "ia pernah menulis bahwa …".
- Jangan menyebut mukjizat sebagai fakta sejarah bila Gereja sendiri hanya meriwayatkannya; pakai "diriwayatkan".
- Ajaran harus sesuai iman Katolik untuk orang kudus dan peringatan Maria; untuk perumpamaan dan tokoh Alkitab, tulis netral sehingga cocok untuk Katolik maupun Protestan.

## Hak cipta
- Semua teks ditulis dengan kata-kata sendiri. Jangan menyalin atau meniru susunan kalimat dari situs, buku, atau Wikipedia.
- Jangan mengutip Alkitab kata per kata lebih dari satu frasa pendek. Ceritakan ulang dengan bahasa sendiri dan cantumkan rujukan ayatnya.

## Format rujukan ayat
Gunakan singkatan kitab berikut, diikuti pasal:ayat atau pasal:ayat-ayat, misalnya "Mat 5:16", "Luk 15:11-32", "Kis 9:1-19", "Yoh 3:16".
Kej Kel Im Bil Ul Yos Hak Rut 1Sam 2Sam 1Raj 2Raj 1Taw 2Taw Ezr Neh Est Ayb Mzm Ams Pkh Kid Yes Yer Rat Yeh Dan Hos Yl Am Ob Yun Mi Nah Hab Zef Hag Za Mal Mat Mrk Luk Yoh Kis Rm 1Kor 2Kor Gal Ef Flp Kol 1Tes 2Tes 1Tim 2Tim Tit Flm Ibr Yak 1Ptr 2Ptr 1Yoh 2Yoh 3Yoh Yud Why
Hanya Alkitab 66 kitab (tanpa Deuterokanonika).

## Skema JSON
Tulis satu berkas JSON (UTF-8) berisi ARRAY objek. Validasi dengan `python3 -c "import json;json.load(open('BERKAS'))"` sebelum selesai.

### Santo/Santa dan peringatan Maria (berkas santo-*.json)
{
  "id": "01-28-thomas-aquinas",            // MM-DD-nama-pendek, huruf kecil, tanda hubung
  "tgl": "01-28",                          // MM-DD
  "nama": "Santo Thomas Aquinas",           // nama lengkap seperti di kalender
  "gelar": "Imam dan Pujangga Gereja",      // gelar liturgis singkat; "" bila tidak ada
  "tingkat": "Peringatan wajib",            // salah satu: Hari Raya | Pesta | Peringatan wajib | Peringatan fakultatif
  "masa": "1225–1274",                      // tahun hidup bila pasti; "abad ke-3" bila hanya itu yang pasti; "" untuk peringatan Maria/peristiwa
  "ringkas": "Satu kalimat (maks. 22 kata) yang memperkenalkan tokoh/peringatan ini.",
  "kisah": ["paragraf 1", "paragraf 2", "paragraf 3"],   // 3–5 paragraf, total 220–380 kata
  "teladan": "Satu paragraf (50–90 kata): apa yang bisa kita teladani hari ini, konkret dan sederhana.",
  "doa": "Doa singkat 2–4 kalimat kepada Allah dengan perantaraan orang kudus ini, diakhiri 'Amin.'",
  "ayat": "Mat 5:16"                        // satu rujukan ayat yang sesuai dengan teladannya
}

### Perumpamaan Yesus (berkas perumpamaan.json)
{
  "id": "anak-yang-hilang",
  "judul": "Anak yang Hilang",
  "ref": "Luk 15:11-32",                    // rujukan utama; bila ada di lebih dari satu Injil, pakai yang paling lengkap
  "ref2": ["Mat 18:12-14"],                 // rujukan paralel lain (boleh kosong [])
  "ringkas": "Satu kalimat (maks. 22 kata).",
  "kisah": ["paragraf", "..."],             // 3–5 paragraf, 200–350 kata: menceritakan ulang perumpamaan dengan hidup, setia pada teks, dengan latar budaya singkat bila membantu
  "makna": "Satu paragraf (60–110 kata): pesan utama yang diajarkan Yesus.",
  "renungan": ["pertanyaan 1", "pertanyaan 2", "pertanyaan 3"],   // pertanyaan pribadi yang lembut
  "doa": "Doa singkat 2–4 kalimat, diakhiri 'Amin.'"
}

### Tokoh Alkitab (berkas tokoh.json)
{
  "id": "abraham",
  "nama": "Abraham",
  "julukan": "Bapa orang beriman",          // frasa pendek
  "pl": true,                               // true = Perjanjian Lama, false = Perjanjian Baru
  "ref": ["Kej 12:1-9", "Kej 22:1-19"],     // 2–4 rujukan bagian penting kisahnya
  "ringkas": "Satu kalimat (maks. 22 kata).",
  "kisah": ["paragraf", "..."],             // 3–5 paragraf, 250–400 kata
  "teladan": "Satu paragraf (50–90 kata).",
  "doa": "Doa singkat 2–4 kalimat, diakhiri 'Amin.'"
}
