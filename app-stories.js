"use strict";
/* ---------- Kisah: orang kudus, perumpamaan Yesus, tokoh Alkitab ----------
   Data: kisah/santo.json, kisah/perumpamaan.json, kisah/tokoh.json (skema di kisah/PANDUAN.md).
   KS_DRAF = true selama isi belum ditinjau romo/katekis. */
var KS_DRAF = true;
var KS_I = '<svg class="ico" viewBox="0 0 24 24"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5z"/><path d="M4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M9 8h7M9 11.5h5"/></svg>';
var SPK_I = '<svg class="ico" viewBox="0 0 24 24"><path d="M11 5 6 9H3v6h3l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13"/></svg>';
var KS = { d: {}, tab: "", q: "", sp: false };
/* Lambang ilustrasi kisah: simbol tradisional (digambar sendiri, garis 24x24) di atas warna bermakna.
   Pemetaan kisah -> lambang/warna dibuat oleh tools/kisah-lambang.py (field "lambang" & "warna" di kisah/*.json). */
var KS_SYM = {
salib:'<path d="M12 2.5v19M6 8h12"/>',
palma:'<path d="M7 21.5c2.5-6 5-11 10.5-18"/><path d="M9.2 16.6 4.5 15.6M10.6 13.9 6 11.6M12.3 11.3 8.6 7.9M14.2 8.7l-2.4-4.4M10.4 16.9l4.6-.4M12 14.2l4.5-1.5M13.8 11.5l4.1-2.4"/>',
kunci:'<circle cx="7.5" cy="7.5" r="3.5"/><path d="M10 10l10 10M16 16l2.5-2.5M18.5 18.5 21 16"/><circle cx="16.5" cy="7.5" r="3.5"/><path d="M14 10 4 20M8 16l-2.5-2.5M5.5 18.5 3 16"/>',
pedang:'<path d="M12 2.5 14 6v10.5h-4V6z"/><path d="M7 16.5h10M12 16.5v3.5"/><circle cx="12" cy="21" r="1"/>',
buku:'<path d="M3 5.5c3-1.3 6-1.3 9 .8v14c-3-2.1-6-2.1-9-.8z"/><path d="M21 5.5c-3-1.3-6-1.3-9 .8v14c3-2.1 6-2.1 9-.8z"/>',
tongkat:'<path d="M10 22V9.5a5 5 0 1 1 8.5 3.5"/><path d="M15.5 11.2a1.8 1.8 0 1 0 0-3.6"/><path d="M7.5 15h5"/>',
mahkota:'<path d="M3.5 18 2.5 7.5l5 4.5L12 5l4.5 7 5-4.5-1 10.5z"/><path d="M4 21h16"/>',
lili:'<path d="M12 22V11"/><path d="M12 11c-1.8-1.4-2.6-3.7-2-6.5 1.9 1 3 2.4 2 6.5z"/><path d="M12 11c1.8-1.4 2.6-3.7 2-6.5-1.9 1-3 2.4-2 6.5z"/><path d="M12 11C9.5 11.5 7 10.5 5.5 8c2.5-.3 4.8.6 6.5 3zM12 11c2.5.5 5-.5 6.5-3-2.5-.3-4.8.6-6.5 3z"/><path d="M12 17c-1.5-1.8-3.5-2.3-5.5-1.7 1.4 1.6 3.4 2.2 5.5 1.7zM12 19c1.5-1.8 3.5-2.3 5.5-1.7-1.4 1.6-3.4 2.2-5.5 1.7z"/>',
domba:'<path d="M6 13.5c-1.7 0-2.8-1.3-2.4-2.9.3-1.3 1.6-2 2.8-1.6.4-1.5 1.9-2.3 3.4-1.8.8-1.2 2.6-1.5 3.8-.6 1.2-.8 2.9-.3 3.4 1.1 1.4-.2 2.6 1 2.3 2.4-.2 1.2-1.3 1.9-2.4 1.7"/><path d="M6 13.5c.6 1.4 2.1 2 3.4 1.5.8 1 2.4 1.2 3.5.4 1 .8 2.6.6 3.3-.5"/><path d="M8 15.5V20M15.5 15.5V20M18.5 9.8l1.8-1.4 1.2 1.6-1.4 1.2"/>',
roda:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="2"/><path d="M12 3.5V10M12 14v6.5M3.5 12H10M14 12h6.5M6 6l4.6 4.6M13.4 13.4 18 18M18 6l-4.6 4.6M10.6 13.4 6 18"/>',
panah:'<path d="M4 20 18 6M6 20l13-11M4 18 15 4"/><path d="M18 6l1-3.5L15.5 3.5M19 9l2.5-1.7-1.6-2M15 4l.5-2.5 2 .9"/>',
panggangan:'<path d="M4 8h16v7H4zM8 8v7M12 8v7M16 8v7"/><path d="M6 15v5M18 15v5M4 8 2.5 5.5"/>',
kerang:'<path d="M12 20.5 3.5 10.5C4 6 7.6 3.5 12 3.5s8 2.5 8.5 7z"/><path d="M12 20.5 8 4.2M12 20.5 6 6M12 20.5 16 4.2M12 20.5 18 6M12 20.5V3.5"/><path d="M9.5 20.5h5"/>',
bintang:'<path d="m12 3 2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6l-5.4 2.9 1.2-6-4.5-4.2 6.1-.7z"/>',
hati:'<path d="M12 20.5s-8-4.8-8-10.4A4.4 4.4 0 0 1 12 7.7a4.4 4.4 0 0 1 8 2.4c0 5.6-8 10.4-8 10.4z"/><path d="M12 7.7V3M10 4.8h4"/>',
api:'<path d="M12 21.5c-4 0-6.5-2.7-6.5-6.2 0-4 3.5-6 4.2-10.8 2.5 1.6 3.4 4 3.2 6.2 1-.8 1.6-2 1.7-3.4 2.4 2 3.9 4.6 3.9 8 0 3.5-2.5 6.2-6.5 6.2z"/><path d="M12 21.5c-1.7 0-2.8-1.2-2.8-2.7 0-1.8 1.6-2.6 2.6-4.5 1.6 1.4 3 2.6 3 4.5 0 1.5-1.1 2.7-2.8 2.7z"/>',
merpati:'<path d="M3 12.5c3 .2 5.5-.5 7.5-2.3L14 4.5c.6 3-.1 5.4-1.6 7.4"/><path d="M21 7.5c-1.2-.9-2.8-.8-3.8.3-1.5 1.7-2.2 4.4-5.2 6.4-2.6 1.7-5.6 2-8.5 1.6 1.9 1.6 4.3 2.4 6.8 2.2l-1.8 2.5c2.3-.3 4.3-1.4 5.8-3.3 2.4-.6 4-2.4 4.4-4.8z"/><path d="M21 7.5 22.5 8"/>',
gandum:'<path d="M12 22V7"/><path d="M12 7c-1.3-1-1.8-2.6-1.2-4.3 1.4.8 1.9 2.4 1.2 4.3zM12 7c1.3-1 1.8-2.6 1.2-4.3-1.4.8-1.9 2.4-1.2 4.3z" /><path d="M12 11.5c-1.6-.1-2.9-1.2-3.3-2.9 1.6.1 2.9 1.2 3.3 2.9zM12 11.5c1.6-.1 2.9-1.2 3.3-2.9-1.6.1-2.9 1.2-3.3 2.9zM12 15.5c-1.6-.1-2.9-1.2-3.3-2.9 1.6.1 2.9 1.2 3.3 2.9zM12 15.5c1.6-.1 2.9-1.2 3.3-2.9-1.6.1-2.9 1.2-3.3 2.9z"/>',
tunas:'<path d="M12 21v-8"/><path d="M12 13c0-3.5-2.5-6-6.5-6 0 3.6 2.6 6 6.5 6zM12 15c0-3.2 2.3-5.5 6-5.5 0 3.3-2.4 5.5-6 5.5z"/><path d="M5 21h14"/>',
mutiara:'<circle cx="12" cy="13" r="5"/><path d="M10 11.2a2 2 0 0 1 1.6-1.2"/><path d="M3 13.5c1.3 4.6 5 7.5 9 7.5s7.7-2.9 9-7.5"/>',
pelita:'<path d="M3 13c2.5 3 6.5 4 11 3 2.4-.6 4.4-1.8 5.5-3.7.5-.8 1.5-1.1 2.5-.8-1.8-1.4-4.4-1.7-6.5-1.3L4.5 12z"/><path d="M8.5 17.5 7 20h7l-1-2.4"/><path d="M4.2 10.5c-.9-1.2-.8-2.8.4-4.5.9 1.6 1 3.1-.4 4.5z"/>',
koin:'<circle cx="9" cy="9" r="5.5"/><circle cx="15" cy="15" r="5.5"/><path d="M15 12.5v5M13.5 13.6c.3-.6.9-.9 1.6-.9.9 0 1.5.5 1.5 1.1 0 1.5-3.2.9-3.2 2.5 0 .6.7 1.1 1.6 1.1.7 0 1.3-.3 1.6-.9"/>',
ikan:'<path d="M2.5 12c3-4.5 8.5-6 13.5-2.5L21 6v12l-5-3.5C11 18 5.5 16.5 2.5 12z"/><circle cx="7" cy="11" r=".9"/>',
perahu:'<path d="M2.5 15h19l-2.5 4.5H5z"/><path d="M12 15V3l7 9.5h-7M12 5.5 6 12.5h6"/><path d="M2 21.5c1.7 0 1.7-1 3.4-1s1.7 1 3.4 1 1.7-1 3.4-1 1.7 1 3.4 1 1.7-1 3.4-1"/>',
bahtera:'<path d="M2.5 13.5h19l-3 5H5.5z"/><path d="M6 13.5V9h12v4.5M9 9V6.5h6V9M10.5 11h3"/><path d="M2 21.5c1.7 0 1.7-1 3.4-1s1.7 1 3.4 1 1.7-1 3.4-1 1.7 1 3.4 1 1.7-1 3.4-1"/>',
pelangi:'<path d="M2.5 18a9.5 9.5 0 0 1 19 0"/><path d="M5.5 18a6.5 6.5 0 0 1 13 0"/><path d="M8.5 18a3.5 3.5 0 0 1 7 0"/>',
tangga:'<path d="M8 22 10.5 2M16 22 13.5 2"/><path d="M8.6 17.5h6.8M9.2 13h5.6M9.8 8.5h4.4M10.3 4.5h3.4"/>',
loh:'<path d="M3.5 21V8a4 4 0 0 1 8 0v13zM12.5 21V8a4 4 0 0 1 8 0v13z"/><path d="M6 10h3M6 13h3M6 16h3M15 10h3M15 13h3M15 16h3"/>',
kecapi:'<path d="M6 3.5c3 0 4.5 2 6 4.5s3.5 4 7 4l-.5 8.5H6z"/><path d="M9 6v14.5M12 8.2v12.3M15 11v9.5"/>',
anggur:'<path d="M12 5.5V2.5M12 4c1.5-1.5 3.8-1.7 5.5-.5"/><circle cx="9" cy="8" r="2"/><circle cx="13" cy="8" r="2"/><circle cx="11" cy="11.5" r="2"/><circle cx="15" cy="11.5" r="2"/><circle cx="7" cy="11.5" r="2"/><circle cx="9" cy="15" r="2"/><circle cx="13" cy="15" r="2"/><circle cx="11" cy="18.5" r="2"/>',
pohon:'<path d="M12 22v-7M12 15l-3-3M12 17l3.5-3.5"/><path d="M12 15.5c-4.4 0-7.5-2.6-7.5-6S7.6 3 12 3s7.5 3 7.5 6.5-3.1 6-7.5 6z"/>',
rumah:'<path d="M3 11 12 3.5 21 11"/><path d="M5.5 9v8.5h13V9M10 17.5v-5h4v5"/><path d="M2 21h20"/><path d="M4 21l1.5-3.5h13L20 21"/>',
gereja:'<path d="M12 2v4M10.5 3.5h3"/><path d="M12 6 7 11v10h10V11z"/><path d="M3 21V14l4-3M21 21V14l-4-3"/><path d="M10 21v-4a2 2 0 0 1 4 0v4"/>',
duri:'<path d="M3 12c0-2.5 4-4.5 9-4.5s9 2 9 4.5-4 4.5-9 4.5-9-2-9-4.5z"/><path d="M5 9.2 3.8 7M8.5 7.9l-.6-2.4M15.5 7.9l.6-2.4M19 9.2 20.2 7M5 14.8 3.8 17M8.5 16.1l-.6 2.4M15.5 16.1l.6 2.4M19 14.8l1.2 2.2M12 7.5V5M12 16.5V19"/>',
mawar:'<path d="M12 22v-8"/><path d="M12 13.5c-3.2 0-5.5-2.2-5.5-5.2S9 3 12 3s5.5 2.3 5.5 5.3-2.3 5.2-5.5 5.2z"/><path d="M12 6c1.5 0 2.5 1 2.5 2.3S13.4 10.5 12 10.5 9.5 9.6 9.5 8.3"/><path d="M12 18c-1.6-1.6-3.5-1.8-5-1 1.4 1.5 3.3 1.8 5 1z"/>',
sayap:'<path d="M12 9.5c-2-4-5.5-6-10-6 .5 6 3.5 10.5 8 12M12 9.5c2-4 5.5-6 10-6-.5 6-3.5 10.5-8 12"/><path d="M5 7.5c1.5 2.2 3.2 3.8 5.5 4.8M19 7.5c-1.5 2.2-3.2 3.8-5.5 4.8"/><circle cx="12" cy="13" r="2"/><path d="M10 21.5l2-6.5 2 6.5"/>',
rosario:'<path d="M12 14.5c-4.5 0-7.5-2.5-7.5-6S7.5 2.5 12 2.5s7.5 2.5 7.5 6-3 6-7.5 6z" stroke-dasharray=".1 2.4"/><path d="M12 14.5v4M12 22v-3.5M10 19.5h4"/>',
singa:'<path d="M12 4c-4.4 0-8 3.6-8 8s3.6 8 8 8 8-3.6 8-8"/><path d="M20 12c0-4.4-3.6-8-8-8" stroke-dasharray="2 2"/><path d="M9 11.5h.01M15 11.5h.01M10.5 15.5c.8.6 2.2.6 3 0M12 13.5v2"/><path d="M8.5 8.5c1-1 5.9-1 7 0"/>',
paus:'<path d="M2.5 13c0-3 4-5.5 9.5-5.5 4.6 0 7.4 2.3 8.3 4.3l1.7-2.3v6l-2.4-1.2c-1.6 2.7-5 4.2-8.6 4.2C5.5 18.5 2.5 16 2.5 13z"/><circle cx="7" cy="12" r=".9"/><path d="M11 7.5c-.5-1.5.2-3 1.5-3.5M11 7.5c1-1.3 2.7-1.6 4-.8"/>',
jubah:'<path d="M12 3 7 5.5 3.5 21h8.5"/><path d="M12 3l5 2.5L20.5 21H14"/><path d="M12 3v18M10 8.5l2 1.5 2-1.5"/>',
pena:'<path d="M20.5 3.5c-6 0-11.5 4.5-13 11L6 20l5.5-1.5c6.5-1.5 9-7.5 9-15z"/><path d="M6 20 13 13M14.5 9.5l3 .5"/>',
dunia:'<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c-2.5 2.5-3.8 5.5-3.8 9s1.3 6.5 3.8 9c2.5-2.5 3.8-5.5 3.8-9S14.5 5.5 12 3z"/>',
matahari:'<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9 7 7M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
mata:'<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
piala:'<path d="M7 3h10v4.5a5 5 0 0 1-10 0zM12 12.5V18M8 21h8M9.5 18h5"/><path d="M12 6.8a1.6 1.6 0 1 1 0 .01"/>',
roti:'<path d="M3.5 13c0-4 3.8-6.5 8.5-6.5s8.5 2.5 8.5 6.5v4.5h-17z"/><path d="M8 9.5l1.5 3M12 8.5v3.5M16 9.5l-1.5 3"/>',
air:'<path d="M12 2.5S5.5 10 5.5 14.5a6.5 6.5 0 0 0 13 0C18.5 10 12 2.5 12 2.5z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
batu:'<path d="M3 20.5 6 13l3.5-2 3 1.5L16 9l3 2.5 2 9z"/><path d="M9.5 11l1 4.5M16 9v5"/>',
tangan:'<path d="M7 11V5.5a1.5 1.5 0 0 1 3 0V10M10 9.5V4a1.5 1.5 0 0 1 3 0v6M13 9.5V5a1.5 1.5 0 0 1 3 0v6.5M16 10a1.5 1.5 0 0 1 3 0v4c0 4-2.7 7.5-7 7.5-3 0-4.6-1.3-6.2-3.7L3.4 13.6A1.5 1.5 0 0 1 6 12l1 1.5"/>',
pintu:'<path d="M5 21V4.5h14V21"/><path d="M8 21V7.5h8V21M14 14h.01"/><path d="M2.5 21h19"/>',
timbangan:'<path d="M12 3v18M7 21h10M4 7h16"/><path d="M4 7 1.5 13a3 3 0 0 0 5 0zM20 7l-2.5 6a3 3 0 0 0 5 0z"/>',
sabit:'<path d="M6 21 17.5 9.5"/><path d="M17.5 9.5C20 7 19.5 3.5 17 2c.5 3-1.5 5.5-4.5 6"/><path d="M4.5 19.5l3 3"/>',
jala:'<path d="M3 4h18l-3 16H6z"/><path d="M4.2 10h15.6M5.4 16h13.2M9 4l1 16M15 4l-1 16"/>',
ketapel:'<path d="M12 21v-8M12 13 7 6M12 13l5-7"/><path d="M7 6c2-1.5 8-1.5 10 0"/><circle cx="12" cy="4.2" r="1.4"/>',
tongkatgembala:'<path d="M13 22V8a4 4 0 1 0-8 0"/><path d="M5 8c0 1.2.6 2 1.5 2.3"/>',
kandil:'<path d="M12 21.5V9M8 21.5h8M12 9c-1.3 0-2.2-1-2.2-2.3C9.8 5 12 2.5 12 2.5s2.2 2.5 2.2 4.2C14.2 8 13.3 9 12 9zM8.5 12.5h7"/>',
};
function ksThumb(x, cls, day) {
  if (KS.img && KS.img[x.id]) return '<span class="kth ph ' + (cls || "") + '" aria-hidden="true"><img src="kisah/img/' + x.id + '-k.webp" alt="" loading="lazy" decoding="async">' + (day ? "<i>" + day + "</i>" : "") + "</span>";
  var s = KS_SYM[x.lambang] || KS_SYM.salib;
  return '<span class="kth ' + (cls || "") + ' w-' + (x.warna || "putih") + '" aria-hidden="true"><svg viewBox="0 0 24 24">' + s + "</svg>" + (day ? '<i>' + day + "</i>" : "") + "</span>";
}
function ksHero(x) {
  if (KS.img && KS.img[x.id]) return '<div class="kshero ph"><img src="kisah/img/' + x.id + '.webp" alt="" decoding="async"></div>';
  var s = KS_SYM[x.lambang] || KS_SYM.salib;
  return '<div class="kshero w-' + (x.warna || "putih") + '" aria-hidden="true"><svg class="wm" viewBox="0 0 24 24">' + s + '</svg><svg viewBox="0 0 24 24">' + s + "</svg></div>";
}
var KS_JENIS = { santo: "Orang Kudus", perumpamaan: "Perumpamaan", tokoh: "Tokoh Alkitab" };
var KS_BULAN = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
var KS_RANK = { "Hari Raya": 0, "Pesta": 1, "Peringatan wajib": 2, "Peringatan fakultatif": 3 };
function ksImgs() {
  if (!KS.imgP) KS.imgP = fetch("kisah/gambar.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    .then(function (a) { KS.img = {}; (a || []).forEach(function (k) { KS.img[k] = 1; }); });
  return KS.imgP;
}
function ksLoad(j) {
  if (KS.d[j]) return ksImgs().then(function () { return KS.d[j]; });
  return fetch("kisah/" + j + ".json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
    .then(function (a) { KS.d[j] = Array.isArray(a) ? a : []; return ksImgs(); }).then(function () { return KS.d[j]; });
}
function ksKat() { return settings.cal === "katolik"; }
function ksName(j, x) { return j === "perumpamaan" ? x.judul : x.nama; }
function ksMMDD() { var d = new Date(); return ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
function ksTgl(t) { var p = t.split("-"); return (+p[1]) + " " + KS_BULAN[+p[0] - 1]; }
function ksToday() {
  var rot = function () {
    return Promise.all([ksLoad("perumpamaan"), ksLoad("tokoh")]).then(function (r) {
      var all = r[0].map(function (x) { return ["perumpamaan", x]; }).concat(r[1].map(function (x) { return ["tokoh", x]; }));
      if (!all.length) return null;
      var now = new Date(), day = Math.floor((now - new Date(now.getFullYear(), 0, 1)) / 864e5), p = all[day % all.length];
      return { j: p[0], x: p[1], lab: "Kisah hari ini" };
    });
  };
  if (!ksKat()) return rot();
  return ksLoad("santo").then(function (a) {
    var t = ksMMDD(), hit = a.filter(function (x) { return x.tgl === t; });
    hit.sort(function (p, q) { return (KS_RANK[p.tingkat] || 9) - (KS_RANK[q.tingkat] || 9); });
    if (!hit.length) return rot();
    var x = hit[0];
    return { j: "santo", x: x, lab: /^(Santo|Santa) (?!Perawan)/.test(x.nama) ? "Orang kudus hari ini" : "Peringatan hari ini" };
  });
}
function kisahHome() {
  var el = $("kisahToday"); if (!el) return;
  ksToday().then(function (t) {
    if (!t) { el.hidden = true; return; }
    el.hidden = false; el.dataset.j = t.j; el.dataset.id = t.x.id;
    el.innerHTML = '<span class="kl"><span class="mi">' + KS_I + "</span>" + t.lab + '</span><span class="khd">' + ksThumb(t.x, "md") + '<b data-noi18n>' + esc(ksName(t.j, t.x)) + '</b></span><span class="kr" data-noi18n>' + esc(t.x.ringkas || "") + '</span><span class="kgo">Baca kisahnya' + CHEV_R + "</span>";
  });
}
$("kisahToday").onclick = function () { navHash("kisah/" + this.dataset.j + "/" + this.dataset.id); };
function ksNorm(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
function renderKisah(j, id) {
  ksStop();
  var tabs = ksKat() ? ["santo", "perumpamaan", "tokoh"] : ["perumpamaan", "tokoh"];
  if (id && KS_JENIS[j]) {
    S.ksJ = j; S.ksId = id; $("ksTitle").textContent = KS_JENIS[j];
    ksLoad(j).then(function (a) {
      if (S.view !== "kisah" || S.ksId !== id) return;
      for (var i = 0; i < a.length; i++) if (a[i].id === id) { ksRead(j, a, i); return; }
      navHash("kisah/" + j);
    });
    return;
  }
  if (tabs.indexOf(j) < 0) j = tabs.indexOf(KS.tab) >= 0 ? KS.tab : tabs[0];
  KS.tab = j; S.ksJ = j; S.ksId = ""; $("ksTitle").textContent = "Kisah";
  $("ksBody").innerHTML = '<div class="kstabs" role="tablist">' + tabs.map(function (t) {
    return '<button type="button" role="tab" data-kst="' + t + '" aria-selected="' + (t === j) + '">' + KS_JENIS[t] + "</button>";
  }).join("") + '</div><div class="hysearch"><input id="ksQ" type="search" autocomplete="off" placeholder="Cari kisah" aria-label="Cari kisah" value="' + esc(KS.q) + '"></div><div class="kslist" id="ksList"></div>';
  $("ksQ").oninput = function () { KS.q = this.value; ksFill(j); };
  ksLoad(j).then(function () { if (S.view === "kisah" && !S.ksId && KS.tab === j) ksFill(j); });
  window.scrollTo(0, 0);
}
function ksFill(j) {
  var a = KS.d[j] || [], q = ksNorm(KS.q), h = "", last = "";
  if (!a.length) { $("ksList").innerHTML = '<div class="empty">Kisah sedang disiapkan.</div>'; return; }
  var list = a.filter(function (x) { return !q || ksNorm(ksName(j, x) + " " + (x.ringkas || "") + " " + (x.julukan || "") + " " + (x.gelar || "")).indexOf(q) >= 0; });
  list.forEach(function (x) {
    var grp = j === "santo" ? KS_BULAN[+x.tgl.slice(0, 2) - 1] : j === "tokoh" ? (x.pl ? "Perjanjian Lama" : "Perjanjian Baru") : "";
    if (grp && grp !== last) { h += '<div class="flabel">' + grp + "</div>"; last = grp; }
    var side = ksThumb(x, "", j === "santo" ? +x.tgl.slice(3) : 0);
    var sub = j === "santo" ? (x.gelar || x.tingkat) : j === "perumpamaan" ? x.ref : x.julukan;
    h += '<button class="ksrow" type="button" data-ksid="' + esc(x.id) + '">' + side + '<span class="kt"><b data-noi18n>' + esc(ksName(j, x)) + '</b><small data-noi18n>' + esc(sub || "") + "</small></span>" + CHEV_R + "</button>";
  });
  $("ksList").innerHTML = h || '<div class="empty">Tidak ada kisah yang cocok.</div>';
}
function ksRead(j, a, i) {
  var x = a[i], prev = a[i - 1], next = a[i + 1], refs = [], parts = [];
  var meta = j === "santo" ? '<span>' + ksTgl(x.tgl) + "</span><span>" + esc(x.tingkat) + "</span>" : j === "perumpamaan" ? '<span>Perumpamaan Yesus</span><span>' + esc(x.ref) + "</span>" : '<span>' + (x.pl ? "Perjanjian Lama" : "Perjanjian Baru") + "</span>";
  if (j === "santo") refs = [x.ayat]; else if (j === "perumpamaan") refs = [x.ref].concat(x.ref2 || []); else refs = x.ref || [];
  var sub = j === "santo" ? [x.gelar, x.masa].filter(Boolean).join(" · ") : j === "tokoh" ? x.julukan : "";
  var h = '<article class="ksread">' + ksHero(x) + '<div class="ksmeta">' + meta + (KS_DRAF ? '<span class="ksdraf">Draf</span>' : "") + "</div>"
    + '<h2 class="ksh" data-noi18n>' + esc(ksName(j, x)) + "</h2>" + (sub ? '<div class="ksg" data-noi18n>' + esc(sub) + "</div>" : "")
    + '<div class="ksacts"><button type="button" class="kspill" id="ksSpeak">' + SPK_I + '<span>Dengarkan</span></button>'
    + (refs[0] ? '<button type="button" class="kspill" data-ksref="' + esc(refs[0]) + '">' + KS_I + "<span>Baca di Alkitab</span></button>" : "") + "</div>"
    + '<div class="ksbody"><p class="kslead">' + esc(x.ringkas || "") + "</p>" + (x.kisah || []).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join("") + "</div>";
  parts.push(ksName(j, x)); if (x.ringkas) parts.push(x.ringkas); parts = parts.concat(x.kisah || []);
  var tl = j === "perumpamaan" ? "Makna" : "Teladan", tx = j === "perumpamaan" ? x.makna : x.teladan;
  if (tx) { h += '<h3 class="ksh3">' + tl + '</h3><div class="ksbody"><p>' + esc(tx) + "</p></div>"; parts.push(tl + ". " + tx); }
  if (x.renungan && x.renungan.length) { h += '<h3 class="ksh3">Renungkan</h3><ul class="ksbody ksq">' + x.renungan.map(function (r) { return "<li>" + esc(r) + "</li>"; }).join("") + "</ul>"; }
  if (x.doa) { h += '<div class="ksdoa"><h3 class="ksh3">Doa</h3><div class="ksbody"><p>' + esc(x.doa) + "</p></div></div>"; parts.push("Marilah berdoa. " + x.doa); }
  if (refs.length > 1) h += '<h3 class="ksh3">Bacaan</h3><div class="ksrefs">' + refs.map(function (r) { return '<button type="button" class="kspill" data-ksref="' + esc(r) + '">' + esc(r) + "</button>"; }).join("") + "</div>";
  h += '</article><nav class="pn hypn">' + (prev ? '<button type="button" data-ksid="' + esc(prev.id) + '"><small>Sebelumnya</small><b data-noi18n>' + esc(ksName(j, prev)) + "</b></button>" : "<span></span>")
    + (next ? '<button type="button" data-ksid="' + esc(next.id) + '"><small>Berikutnya</small><b data-noi18n>' + esc(ksName(j, next)) + "</b></button>" : "<span></span>") + "</nav>";
  $("ksBody").innerHTML = h; KS.parts = parts; window.scrollTo(0, 0);
}
function ksStop() {
  if (!KS) return;
  if (KS.sp) { KS.sp = false; try { speechSynthesis.cancel(); } catch (e) {} }
  var b = document.getElementById("ksSpeak"); if (b) { b.classList.remove("on"); b.querySelector("span").textContent = "Dengarkan"; }
}
function ksSpeak(parts) {
  if (!("speechSynthesis" in window)) { toast("Suara belum bisa diputar"); return; }
  if (T.on) stopTTS();
  try { speechSynthesis.cancel(); } catch (e) {}
  KS.sp = true; var i = 0, b = $("ksSpeak"); b.classList.add("on"); b.querySelector("span").textContent = "Berhenti"; if (typeof wlSync === "function") wlSync();
  (function nx() {
    if (!KS.sp) return;
    if (i >= parts.length) { ksStop(); return; }
    var u = new SpeechSynthesisUtterance(parts[i++]), v = pickVoice();
    u.lang = "id-ID"; if (v) { u.voice = v; u.lang = String(v.lang || "id-ID").replace("_", "-"); }
    u.rate = tts.rate || 0.9; u.onend = nx; u.onerror = function () { ksStop(); };
    speechSynthesis.speak(u);
  })();
}
$("ksBody").addEventListener("click", function (e) {
  var t = e.target.closest("[data-kst]"); if (t) { KS.q = ""; navHash("kisah/" + t.dataset.kst); return; }
  t = e.target.closest("[data-ksid]"); if (t) { navHash("kisah/" + S.ksJ + "/" + t.dataset.ksid); return; }
  t = e.target.closest("[data-ksref]");
  if (t) {
    var m = /^(.*?)(?:-(\d+))?$/.exec(t.dataset.ksref), r = parseRef(m[1]);
    if (r) { ksStop(); openRef(r.b, r.c, r.v || 0, m[2] && r.v ? +m[2] : 0); } else toast("Ayat tidak ditemukan");
    return;
  }
  if (e.target.closest("#ksSpeak")) { if (KS.sp) ksStop(); else ksSpeak(KS.parts || []); }
});
$("ksBack").onclick = function () { if (S.ksId) navHash("kisah/" + S.ksJ); else navHash("lainnya"); };

