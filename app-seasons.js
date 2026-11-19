"use strict";
/* ---------- Evo Seasons: tema mengikuti masa gerejawi ---------- */
var ST = '<path class="w" d="M0-7 2-2 7 0 2 2 0 7-2 2-7 0-2-2z"/>';
function star(x, y, s, c) { return '<g transform="translate(' + x + ' ' + y + ') scale(' + s + ')" class="' + (c || "c") + '"><path d="M0-7 2-2 7 0 2 2 0 7-2 2-7 0-2-2z"/></g>'; }
var ORN = {
advent: '<ellipse class="a" cx="60" cy="86" rx="40" ry="17" opacity=".0"/><ellipse cx="60" cy="88" rx="38" ry="15" fill="none" stroke="#6fbf86" stroke-width="11" stroke-dasharray="7 3"/><ellipse cx="60" cy="88" rx="38" ry="15" fill="none" stroke="#3f9a62" stroke-width="3" stroke-dasharray="2 6"/>'
  + '<circle cx="31" cy="92" r="2.6" fill="#e5484d"/><circle cx="90" cy="84" r="2.6" fill="#e5484d"/><circle cx="68" cy="102" r="2.6" fill="#e5484d"/>'
  + '<rect class="w" x="30" y="62" width="7" height="26" rx="1.5"/><rect class="w" x="47" y="54" width="7" height="34" rx="1.5"/><rect fill="#f4a6c9" x="66" y="58" width="7" height="30" rx="1.5"/><rect class="w" x="83" y="66" width="7" height="22" rx="1.5"/>'
  + '<path class="c" d="M33.5 50c-4 5-3 9 0 10 3-1 4-5 0-10zM50.5 42c-4 5-3 9 0 10 3-1 4-5 0-10zM69.5 46c-4 5-3 9 0 10 3-1 4-5 0-10zM86.5 54c-4 5-3 9 0 10 3-1 4-5 0-10z"/>'
  + star(14, 30, .9) + star(104, 24, 1.1) + star(100, 52, .6) + star(20, 56, .6),
christmas: star(60, 22, 2.1, "c") + '<path class="c" opacity=".16" d="M60 22 40 100h40z"/>'
  + '<path fill="#8a5a2b" d="M34 100v-26l26-18 26 18v26z"/><path fill="#6d4420" d="M30 76 60 52l30 24-4 4-26-20-26 20z"/><path class="c" d="M52 100V84a8 8 0 0 1 16 0v16z"/><ellipse class="w" cx="60" cy="97" rx="7" ry="3.2" opacity=".95"/>'
  + '<g transform="translate(14 0)"><path fill="#3aa86a" d="M10 98h20L20 74z"/><path fill="#2f9a5d" d="M12 80h16L20 62z"/><path fill="#3aa86a" d="M14 66h12L20 50z"/><rect fill="#7a4a22" x="18" y="98" width="4" height="5"/><circle fill="#e5484d" cx="16" cy="90" r="2.4"/><circle class="c" cx="24" cy="82" r="2.2"/><circle fill="#e5484d" cx="20" cy="68" r="2"/>' + star(20, 48, .7, "c") + '</g>'
  + star(102, 40, .8) + star(96, 64, .55),
lent: '<circle cx="60" cy="62" r="42" fill="none" class="sw" stroke-width="1.4" opacity=".5"/><circle cx="60" cy="62" r="33" fill="none" class="sw" stroke-width="1" opacity=".35"/><rect class="w" x="55.5" y="22" width="9" height="78" rx="2"/><rect class="w" x="36" y="42" width="48" height="9" rx="2"/>',
palm: '<g transform="translate(0 4)"><path d="M60 106V74" stroke="#9c7a4a" stroke-width="5" stroke-linecap="round"/>'
  + [-72, -48, -24, 0, 24, 48, 72].map(function (a, i) { return '<g transform="rotate(' + a + ' 60 76)"><ellipse cx="60" cy="42" rx="' + (i % 2 ? 6 : 7.5) + '" ry="' + (i === 3 ? 36 : 31) + '" fill="' + (i % 2 ? "#7fd18a" : "#4fb865") + '"/><path d="M60 14V74" stroke="#2f8f4b" stroke-width="1.2"/></g>'; }).join("") + '</g>'
  + star(16, 24, .7) + star(106, 20, .8),
goodfriday: '<path fill="#000" opacity=".35" d="M0 120V92c18-10 34-14 60-14s42 4 60 14v28z"/><rect class="w" x="54.5" y="14" width="11" height="84" rx="2.4"/><rect class="w" x="32" y="36" width="56" height="11" rx="2.4"/><path d="M0 102c20-10 36-14 60-14s40 4 60 14" fill="none" class="sa" stroke-width="1.6" opacity=".6"/>',
holysat: '<path fill="#000" opacity=".28" d="M10 108V70a50 50 0 0 1 100 0v38z"/><path fill="#0b1020" d="M26 108V72a34 34 0 0 1 68 0v36z"/><path class="c" opacity=".16" d="M44 108V76a16 16 0 0 1 32 0v32z"/><circle cx="32" cy="92" r="17" fill="#8794b8"/><circle cx="29" cy="88" r="14" fill="#9eaace"/><path class="c" d="M92 22a12 12 0 1 0 8 20 10 10 0 0 1-8-20z" opacity=".85"/>' + star(24, 28, .7) + star(58, 14, .6) + star(100, 62, .5),
easter: '<g stroke-linecap="round" class="sa" stroke-width="3">' + [-80, -55, -30, 0, 30, 55, 80].map(function (a) { return '<path transform="rotate(' + a + ' 60 74)" d="M60 24v-12"/>'; }).join("") + '</g><circle class="c" cx="60" cy="74" r="26"/>'
  + '<path fill="#6c5a3a" d="M18 108V78a30 30 0 0 1 60 0v30z" opacity=".0"/><path fill="#7a6a4a" d="M20 110V86a26 26 0 0 1 52 0v24z"/><path class="w" d="M32 110V88a14 14 0 0 1 28 0v22z"/><circle cx="84" cy="94" r="16" fill="#9a8a68"/><circle cx="81" cy="91" r="12" fill="#b3a380"/>'
  + '<g transform="translate(100 98)"><circle class="w" cx="0" cy="-8" r="4"/><circle class="w" cx="7" cy="-3" r="4"/><circle class="w" cx="-7" cy="-3" r="4"/><circle class="w" cx="4" cy="5" r="4"/><circle class="w" cx="-4" cy="5" r="4"/><circle class="c" r="3.2"/></g><path d="M0 110h120" class="sa" stroke-width="2" opacity=".5"/>',
ascension: '<path d="M44 14h32l22 92H22z" class="c" opacity=".3"/><path d="M52 14h16l10 92H42z" class="w" opacity=".5"/><g class="w"><circle cx="30" cy="96" r="12"/><circle cx="46" cy="90" r="16"/><circle cx="66" cy="92" r="15"/><circle cx="84" cy="98" r="11"/><rect x="24" y="96" width="66" height="14" rx="7"/></g><g class="w" opacity=".7"><circle cx="100" cy="44" r="6"/><circle cx="108" cy="46" r="5"/><rect x="95" y="46" width="18" height="6" rx="3"/></g>'
  + '<path class="w" d="M60 30c-3 8-3 16 0 22 3-6 3-14 0-22z" opacity=".95"/>' + star(20, 30, .8) + star(98, 20, .7),
pentecost: '<path d="M60 22c-14 18-20 28-20 44a20 20 0 0 0 40 0c0-16-6-26-20-44z" fill="#ff6a2b"/><path d="M60 40c-8 11-12 18-12 28a12 12 0 0 0 24 0c0-10-4-17-12-28z" fill="#ffb02e"/><path d="M60 58c-4 6-6 10-6 15a6 6 0 0 0 12 0c0-5-2-9-6-15z" fill="#fff3c4"/>'
  + '<path d="M22 56c-8 10-11 15-11 22a11 11 0 0 0 22 0c0-7-3-12-11-22z" fill="#ff8a3d"/><path d="M98 52c-8 10-11 15-11 22a11 11 0 0 0 22 0c0-7-3-12-11-22z" fill="#ff8a3d"/><path d="M22 70c-4 5-5 8-5 11a5 5 0 0 0 10 0c0-3-1-6-5-11z" fill="#ffd36a"/><path d="M98 66c-4 5-5 8-5 11a5 5 0 0 0 10 0c0-3-1-6-5-11z" fill="#ffd36a"/>'
  + '<g transform="translate(60 14)"><path class="w" d="M0 0c-6-5-16-5-24-1 7 0 12 2 15 6-5 1-9 4-11 8 6-3 12-3 17-1 2-5 5-9 8-12 4 2 8 6 11 12 1-8-3-17-16-12z" opacity=".0"/><path class="w" d="M-26 6c8-6 18-4 24 2 4-8 12-12 22-10-6 2-10 6-12 11 8 0 14 5 17 12-8-5-14-4-20-1-4 7-12 10-20 6 4-2 7-5 8-9-6-1-12-4-19-11z"/><circle cx="12" cy="3" r="1.2" fill="#2b2b2b"/></g>',
trinity: '<g fill="none" class="sa" stroke-width="3.4"><circle cx="60" cy="48" r="24"/><circle cx="43" cy="76" r="24"/><circle cx="77" cy="76" r="24"/></g><path class="c" d="M60 40 66 52h-12z" opacity="0"/><circle class="c" cx="60" cy="66" r="5"/><path d="M60 14 20 100h80z" fill="none" class="sw" stroke-width="1.2" opacity=".35"/>' + star(14, 18, .8) + star(106, 20, .7),
ordinary: '<path d="M60 112C60 86 62 62 70 34" fill="none" stroke="#2f8f4b" stroke-width="4" stroke-linecap="round" class="sg"/>'
  + '<path fill="#5fbf7a" d="M62 96c-18 2-28-6-30-20 16-2 28 4 30 20z"/><path fill="#7fd18a" d="M64 80c16 0 26-8 28-22-16-1-27 6-28 22z"/><path fill="#5fbf7a" d="M64 62c-14 0-22-8-24-20 14-1 23 6 24 20z"/><path fill="#7fd18a" d="M68 46c12-2 18-10 18-22-13 0-19 9-18 22z"/><path class="c" d="M70 34c-2-6-1-11 4-15 3 5 2 11-4 15z"/>'
  + '<ellipse cx="60" cy="112" rx="30" ry="4" class="w" opacity=".3"/>' + star(20, 26, .6) + star(100, 70, .5)
};

var ORDER = ["advent", "christmas", "lent", "palm", "goodfriday", "holysat", "easter", "ascension", "pentecost", "trinity", "ordinary"];
var SEA = {
  advent: { n: ["Adven", "Adven"], d: "Masa pengharapan, penantian, dan persiapan hati menyambut kedatangan Kristus.", v: ["Mazmur", 130, 5], g: ["#321a6b", "#7e5bd0"], oc: "#f5cf6b" },
  christmas: { n: ["Natal", "Masa Natal"], d: "Masa sukacita merayakan kelahiran Yesus Kristus, Terang yang datang ke dunia.", v: ["Lukas", 2, 11], g: ["#0b4a2a", "#1f8a4f"], oc: "#f5cf6b" },
  lent: { n: ["Pra-Paskah", "Masa Prapaskah"], d: "Masa pertobatan, doa, dan introspeksi menuju salib Kristus.", v: ["Yoel", 2, 12], g: ["#2a1550", "#654aa0"], oc: "#d9c8ff" },
  palm: { n: ["Minggu Palma", "Minggu Palma"], d: "Pekan Suci dimulai: Yesus masuk ke Yerusalem disambut sorak-sorai dan daun palem.", v: ["Zakharia", 9, 9], g: ["#1a5a2a", "#3f9650"], oc: "#f2e08a" },
  goodfriday: { n: ["Jumat Agung", "Tri Hari Suci"], d: "Mengenang wafat Kristus di kayu salib. Hening, sederhana, penuh syukur atas kasih-Nya.", v: ["Yohanes", 19, 30], g: ["#2b0912", "#7a1830"], oc: "#f0b8c4" },
  holysat: { n: ["Sabtu Sunyi", "Sabtu Suci"], d: "Hari yang hening di antara salib dan kebangkitan. Menanti dalam doa.", v: ["Ratapan", 3, 26], g: ["#0e1328", "#2d3a64"], oc: "#cfd8f5" },
  easter: { n: ["Paskah", "Masa Paskah"], d: "Kristus bangkit! Masa kemenangan, pengharapan, dan hidup yang baru.", v: ["Lukas", 24, 6], g: ["#fffaf0", "#f1d487"], oc: "#d9a21b" },
  ascension: { n: ["Kenaikan Tuhan Yesus", "Kenaikan Tuhan"], d: "Mengenang Kristus naik ke surga dalam kemuliaan, dengan janji kedatangan-Nya kembali.", v: ["Kisah Para Rasul", 1, 9], g: ["#174f8c", "#3a85cc"], oc: "#ffe08a" },
  pentecost: { n: ["Pentakosta", "Hari Raya Pentakosta"], d: "Roh Kudus dicurahkan. Gereja dilahirkan dan diutus ke seluruh dunia.", v: ["Kisah Para Rasul", 2, 4], g: ["#8f1608", "#d34a18"], oc: "#ffd36a" },
  trinity: { n: ["Minggu Trinitas", "Tritunggal Mahakudus"], d: "Memuji Allah Tritunggal: Bapa, Anak, dan Roh Kudus, satu Allah yang kekal.", v: ["Matius", 28, 19], g: ["#fffaf0", "#f1d487"], oc: "#c9971f" },
  ordinary: { n: ["Masa Biasa", "Masa Biasa"], d: "Masa bertumbuh: iman yang berakar dan berbuah dalam kehidupan sehari-hari.", v: ["Kolose", 2, 7], g: ["#14543a", "#2f8a5f"], oc: "#f2e08a" }
};
var MON = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
var PV = null;
function dn(y, m, d) { return Math.round(Date.UTC(y, m, d) / 864e5); }
function dnDate(n) { var d = new Date(n * 864e5); return d.getUTCDate() + " " + MON[d.getUTCMonth()]; }
function dow(n) { return (((n + 4) % 7) + 7) % 7; }
function easterDn(y) {
  var a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451), mo = Math.floor((h + l - 7 * m + 114) / 31), da = (h + l - 7 * m + 114) % 31 + 1;
  return dn(y, mo - 1, da);
}
function adventStart(y) { var x = dn(y, 11, 25), d = dow(x); return x - (d === 0 ? 7 : d) - 21; }
function seasonList(y, cal) {
  var kat = cal === "katolik", out = [];
  for (var Y = y - 1; Y <= y + 1; Y++) {
    var E = easterDn(Y), j6 = dn(Y + 1, 0, 6), add = (7 - dow(j6)) % 7; if (!add) add = 7;
    out.push({ id: "advent", s: adventStart(Y), e: dn(Y, 11, 24) });
    out.push({ id: "christmas", s: dn(Y, 11, 25), e: kat ? j6 + add : j6 - 1 });
    out.push({ id: "lent", s: E - 46, e: E - 8 });
    out.push({ id: "palm", s: E - 7, e: kat ? E - 4 : E - 3 });
    out.push({ id: "goodfriday", s: kat ? E - 3 : E - 2, e: E - 2 });
    out.push({ id: "holysat", s: E - 1, e: E - 1 });
    out.push({ id: "easter", s: E, e: E + 38 });
    out.push({ id: "ascension", s: E + 39, e: E + 48 });
    out.push({ id: "pentecost", s: E + 49, e: E + 55 });
    out.push({ id: "trinity", s: E + 56, e: E + 62 });
  }
  out.sort(function (a, b) { return a.s - b.s; });
  var all = [];
  out.forEach(function (x, n) {
    var prev = all.length ? all[all.length - 1] : null;
    if (prev && x.s > prev.e + 1) all.push({ id: "ordinary", s: prev.e + 1, e: x.s - 1 });
    all.push(x);
  });
  return all;
}
function todayDn() { var t = new Date(); return dn(t.getFullYear(), t.getMonth(), t.getDate()); }
function seasonView() {
  var t = todayDn(), y = new Date().getFullYear(), L = seasonList(y, settings.cal), i, k = -1;
  if (PV) {
    for (i = 0; i < L.length; i++) if (L[i].id === PV && L[i].e >= t) { k = i; break; }
    if (k < 0) for (i = 0; i < L.length; i++) if (L[i].id === PV) { k = i; break; }
  } else for (i = 0; i < L.length; i++) if (t >= L[i].s && t <= L[i].e) { k = i; break; }
  if (k < 0) return null;
  return { cur: L[k], next: L[k + 1] || null };
}
function sname(id) { return SEA[id].n[settings.cal === "katolik" ? 1 : 0]; }
function srange(x) { return x.s === x.e ? dnDate(x.s) : dnDate(x.s) + " – " + dnDate(x.e); }
function ornSvg(id) { return '<svg class="orn-svg" viewBox="0 0 120 120" aria-hidden="true">' + ORN[id] + "</svg>"; }
function activeSeasonId() { if (PV) return PV; if (settings.sea === "off") return null; var v = seasonView(); return v ? v.cur.id : null; }
function bookIdx(n) { for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].n === n) return i; return -1; }
function idOfRef(b, c, v) { for (var i = 0; i < texts.length; i++) if (bOf[i] === b && cOf[i] === c && vOf[i] === v) return i; return -1; }
function renderBanner() {
  var el = $("seasonBanner"), v = seasonView();
  if (!v) { el.hidden = true; return; }
  var id = v.cur.id;
  el.hidden = false;
  el.innerHTML = '<span class="bt">' + ornSvg(id) + '</span><span class="bx"><b>' + esc(sname(id)) + '</b><small>' + (PV ? "Pratinjau \u00B7 " : "") + esc(srange(v.cur)) + '</small></span><svg class="ico" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
}
function openSeason() {
  var v = seasonView(); if (!v) return;
  var id = v.cur.id, m = SEA[id], bi = bookIdx(m.v[0]), vid = bi >= 0 ? idOfRef(bi, m.v[1], m.v[2]) : -1;
  $("drBody").innerHTML = '<div class="drhead"><div class="drt"><div class="tag">' + (PV ? "Pratinjau tema" : "Masa gerejawi saat ini") + "</div><h3>" + esc(sname(id)) + '</h3><div class="sd">' + esc(srange(v.cur)) + '</div></div><div class="stile">' + ornSvg(id) + "</div></div>"
    + '<div class="drbody"><p class="sp">' + esc(m.d) + "</p>"
    + (v.next ? '<div class="sn">Berikutnya: <b>' + esc(sname(v.next.id)) + "</b> \u00B7 " + esc(dnDate(v.next.s)) + "</div>" : "")
    + (vid >= 0 ? '<div class="drverse"><div class="lab">Renungan masa ini</div><p class="vt">' + esc(clean(texts[vid])) + '</p><div class="vr">' + esc(refOf(vid)) + '</div><button class="sref" type="button" data-sref="' + id + '">Baca pasalnya</button></div>' : "")
    + "</div>";
  $("drBody").querySelector(".stile").style.cssText = "background:linear-gradient(165deg," + m.g[0] + "," + m.g[1] + ");--oc:" + m.oc;
  show("shSeason");
}
$("seasonBanner").onclick = openSeason;
$("sBadge").onclick = openSeason;
$("shSeason").addEventListener("click", function (e) { var t = e.target.closest("[data-sref]"); if (!t) return; var m = SEA[t.dataset.sref].v; hide(); openRef(bookIdx(m[0]), m[1], m[2]); });
/* ---------- laci masa gerejawi: tutup dengan gerak dinamis & ikut jari ----------
   Tutup: turun sedikit (ancang-ancang), lalu melesat ke atas makin cepat sambil mengecil,
   latar buram memudar. Geser ke atas: laci menempel di jari; dilepas jauh/cepat = tutup dari
   posisi itu, kalau tidak memantul kembali. Ditarik ke bawah: melar seperti karet. */
var DR = { closing: false, anim: null, fade: null };
var DR_RM = false; try { DR_RM = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
function drEl() { return $("shSeason").querySelector(".drawer"); }
function drY(el) { var m = /translateY\((-?[\d.]+)px\)/.exec(el.style.transform || ""); return m ? parseFloat(m[1]) : 0; }
function drClose() {
  var sc = $("shSeason"), el = drEl();
  if (sc.hidden || DR.closing) return DR.closing;
  if (DR_RM || !el.animate) return false;
  DR.closing = true; sc.style.pointerEvents = "none";
  var y = drY(el), h = el.getBoundingClientRect().height + 40;
  el.style.animation = "none";
  DR.anim = el.animate([
    { transform: "translateY(" + y + "px) scale(1)", easing: "cubic-bezier(.3,.7,.4,1)" },
    { transform: "translateY(" + (y + 16) + "px) scale(1.012)", offset: .24, easing: "cubic-bezier(.55,0,.85,.25)" },
    { transform: "translateY(" + (-h) + "px) scale(.94)" }
  ], { duration: 480, fill: "forwards" });
  DR.fade = sc.animate([{ opacity: 1 }, { opacity: 1, offset: .3 }, { opacity: 0 }], { duration: 480, fill: "forwards", easing: "ease-in" });
  DR.anim.onfinish = function () {
    sc.hidden = true; DR.closing = false; sc.style.pointerEvents = "";
    try { DR.anim.cancel(); DR.fade.cancel(); } catch (e) {}
    el.style.transform = ""; el.style.animation = ""; DR.anim = DR.fade = null;
  };
  return true;
}
function drCancelClose() {
  if (!DR.closing) return;
  try { DR.anim.onfinish = null; DR.anim.cancel(); DR.fade.cancel(); } catch (e) {}
  var el = drEl(); el.style.transform = ""; el.style.animation = ""; DR.closing = false; DR.anim = DR.fade = null; $("shSeason").style.pointerEvents = "";
}
(function () {
  var sc = $("shSeason"), d = null;
  sc.addEventListener("touchstart", function (e) {
    var el = drEl(); if (DR.closing || e.touches.length > 1) { d = null; return; }
    d = { y0: e.touches[0].clientY, y: e.touches[0].clientY, t0: performance.now(), on: false, atEnd: el.scrollTop + el.clientHeight >= el.scrollHeight - 2, hist: [] };
  }, { passive: true });
  sc.addEventListener("touchmove", function (e) {
    if (!d) return; var el = drEl(), y = e.touches[0].clientY, dy = y - d.y0;
    d.y = y; d.hist.push([y, performance.now()]); if (d.hist.length > 5) d.hist.shift();
    if (!d.on) { if (Math.abs(dy) < 8) return; if (dy < 0 && !d.atEnd) { d = null; return; } if (dy > 0 && el.scrollTop > 0) { d = null; return; } d.on = true; el.style.animation = "none"; }
    var ty = dy < 0 ? dy : Math.pow(dy, .72);
    el.style.transform = "translateY(" + ty + "px)";
    if (e.cancelable) e.preventDefault();
  }, { passive: false });
  function end() {
    if (!d || !d.on) { d = null; return; }
    var el = drEl(), dy = d.y - d.y0, h = d.hist, v = h.length > 1 && performance.now() - h[h.length - 1][1] < 100 ? (h[h.length - 1][0] - h[0][0]) / Math.max(1, h[h.length - 1][1] - h[0][1]) : 0; d = null;
    if (dy < -60 || v < -.5) { hide(); return; }
    var y = drY(el);
    var a = el.animate([{ transform: "translateY(" + y + "px)" }, { transform: "translateY(" + (y < 0 ? 8 : -6) + "px)", offset: .55 }, { transform: "translateY(0px)" }], { duration: 380, easing: "cubic-bezier(.2,.8,.3,1)" });
    el.style.transform = ""; a.onfinish = function () { el.style.animation = ""; };
  }
  sc.addEventListener("touchend", end); sc.addEventListener("touchcancel", end);
})();

/* ---------- Katolik: Injil harian ---------- */
var KAT0 = dn(2026, 10, 16), KAT = ["Lk 18:35-43","Lk 19:1-10","Lk 19:11-28","Lk 19:41-44","Lk 19:45-48","Lk 20:27-40","Mt 25:31-46","Lk 21:1-4","Lk 21:5-11","Lk 21:12-19","Lk 21:20-28","Lk 21:29-33","Lk 21:34-36","Mk 13:33-37","Mt 4:18-22","Lk 10:21-24","Mt 15:29-37","Mt 7:21","Mt 9:27-31","Mt 9:35","Mk 1:1-8","Lk 5:17-26","Lk 1:26-38","Mt 11:28-30","Mt 11:11-15","Mt 11:16-19","Lk 1:26-38","Jn 1:6-8","Mt 21:23-27","Mt 21:28-32","Lk 7:18-23","Mt 1:1-17","Mt 1:18-25","Lk 1:5-25","Lk 1:26-38","Lk 1:39-45","Lk 1:46-56","Lk 1:57-66","Lk 1:67-79","Jn 1:1-18","Mt 10:17-22","Lk 2:22-40","Mt 2:13-18","Lk 2:22-35","Lk 2:36-40","Jn 1:1-18","Lk 2:16-21","Jn 1:19-28","Mt 2:1-12","Mt 4:12-17","Mk 6:34-44","Mk 6:45-52","Lk 4:14-22","Lk 5:12-16","Jn 3:22-30","Mk 1:7-11","Mk 1:14-20","Mk 1:21-28","Mk 1:29-39","Mk 1:40-45","Mk 2:1-12","Mk 2:13-17","Jn 1:35-42","Mk 2:18-22","Mk 2:23-28","Mk 3:1-6","Mk 3:7-12","Mk 3:13-19","Mk 3:20-21","Mk 1:14-20","Mk 16:15-18","Mk 3:31-35","Mk 4:1-20","Mk 4:21-25","Mk 4:26-34","Mk 4:35-41","Mk 1:21-28","Mk 5:1-20","Lk 2:22-40","Mk 6:1-6","Mk 6:7-13","Mk 6:14-29","Mk 6:30-34","Mk 1:29-39","Mk 6:53-56","Mk 7:1-13","Mt 6:1-6","Lk 9:22-25","Mt 9:14-15","Lk 5:27-32","Mk 1:12-15","Mt 25:31-46","Mt 6:7-15","Lk 11:29-32","Mt 7:7-12","Mt 5:20-26","Mt 5:43-48","Mk 9:2-10","Mt 16:13-19","Mt 23:1-12","Mt 20:17-28","Lk 16:19-31","Mt 21:33-43","Lk 15:1-3","Jn 2:13-25","Lk 4:24-30","Mt 18:21-35","Mt 5:17-19","Lk 11:14-23","Mk 12:28-34","Lk 18:9-14","Jn 3:14-21","Jn 4:43-54","Jn 5:1-16","Jn 5:17-30","Jn 5:31-47","Jn 7:1-2","Jn 7:40-53","Jn 12:20-33","Jn 8:1-11","Jn 8:21-30","Jn 8:31-42","Jn 8:51-59","Mt 1:16","Jn 11:45-56","Mk 14:1-15","Jn 12:1-11","Jn 13:21-33","Mt 26:14-25","Jn 13:1-15","Jn 18:1—19:42","Mk 16:1-7","Jn 20:1-9","Mt 28:8-15","Jn 20:11-18","Lk 24:13-35","Lk 24:35-48","Jn 21:1-14","Mk 16:9-15","Jn 20:19-31","Lk 1:26-38","Jn 3:7-15","Jn 3:16-21","Jn 3:31-36","Jn 6:1-15","Jn 6:16-21","Lk 24:35-48","Jn 6:22-29","Jn 6:30-35","Jn 6:35-40","Jn 6:44-51","Jn 6:52-59","Jn 6:60-69","Jn 10:11-18","Jn 10:1-10","Jn 10:22-30","Jn 12:44-50","Jn 13:16-20","Jn 14:1-6","Jn 14:7-14","Jn 15:1-8","Jn 14:21-26","Jn 14:27-31","Jn 15:1-8","Jn 15:9-11","Jn 15:12-17","Jn 15:18-21","Jn 15:9-17","Jn 14:6-14","Jn 16:5-11","Jn 16:12-15","Mk 16:15-20","Jn 16:20-23","Jn 16:23-28","Jn 17:11-19","Jn 16:29-33","Jn 17:1-11","Jn 17:11-19","Jn 17:20-26","Jn 15:9-17","Jn 21:20-25","Jn 20:19-23","Jn 19:25-34","Mk 9:30-37","Mk 9:38-40","Mk 9:41-50","Mk 10:1-12","Mk 10:13-16","Mt 28:16-20","Mk 10:17-27","Mk 10:28-31","Mk 10:32-45","Mk 10:46-52","Mk 11:11-26","Mk 11:27-33","Mk 14:12-16","Lk 1:39-56","Mk 12:13-17","Mk 12:18-27","Mk 12:28-34","Jn 19:31-37","Mk 12:38-44","Mk 3:20-35","Mt 5:1-12","Mt 5:13-16","Mt 5:17-19","Mt 5:20-26","Mt 5:27-32","Mt 5:33-37","Mk 4:26-34","Mt 5:38-42","Mt 5:43-48","Mt 6:1-6","Mt 6:7-15","Mt 6:19-23","Mt 6:24-34","Mk 4:35-41","Mt 7:1-5","Mt 7:6","Mt 7:15-20","Lk 1:57-66","Mt 8:1-4","Mt 8:5-17","Mk 5:21-43","Mt 8:18-22","Mt 16:13-19","Mt 8:28-34","Mt 9:1-8","Mt 9:9-13","Jn 20:24-29","Mk 6:1-6","Mt 9:18-26","Mt 9:32-38","Mt 10:1-7","Mt 10:7-15","Mt 10:16-23","Mt 10:24-33","Mk 6:7-13","Mt 10:34—11:1","Mt 11:20-24","Mt 11:25-27","Mt 11:28-30","Mt 12:1-8","Mt 12:14-21","Mk 6:30-34","Mt 12:38-42","Mt 12:46-50","Mt 13:1-9","Jn 20:1-2","Mt 13:18-23","Mt 13:24-30","Jn 6:1-15","Mt 13:31-35","Mt 13:36-43","Mt 13:44-46","Jn 11:19-27","Mt 13:54-58","Mt 14:1-12","Jn 6:24-35","Mt 14:13-21","Mt 14:22-36","Mt 15:21-28","Mt 16:13-23","Mk 9:2-10","Mt 17:14-20","Jn 6:41-51","Mt 17:22-27","Jn 12:24-26","Mt 18:15-20","Mt 18:21","Mt 19:3-12","Mt 19:13-15","Lk 1:39-56","Mt 19:16-22","Mt 19:23-30","Mt 20:1-16","Mt 22:1-14","Mt 22:34-40","Mt 23:1-12","Jn 6:60-69","Mt 23:13-22","Jn 1:45-51","Mt 23:27-32","Mt 24:42-51","Mt 25:1-13","Mt 25:14-30","Mk 7:1-8","Lk 4:16-30","Lk 4:31-37","Lk 4:38-44","Lk 5:1-11","Lk 5:33-39","Lk 6:1-5","Mk 7:31-37","Lk 6:6-11","Lk 6:12-19","Mt 1:1-16","Lk 6:27-38","Lk 6:39-42","Lk 6:43-49","Mk 8:27-35","Lk 7:1-10","Jn 3:13-17","Jn 19:25-27","Lk 7:36-50","Lk 8:1-3","Lk 8:4-15","Mk 9:30-37","Lk 8:16-18","Mt 9:9-13","Lk 9:1-6","Lk 9:7-9","Lk 9:18-22","Lk 9:43-45","Mk 9:38-43","Lk 9:46-50","Lk 9:51-56","Jn 1:47-51","Lk 10:1-12","Lk 10:13-16","Mt 18:1-5","Mk 10:2-16","Lk 10:25-37","Lk 10:38-42","Lk 11:1-4","Lk 11:5-13","Lk 11:15-26","Lk 11:27-28","Mk 10:17-30","Lk 11:29-32","Lk 11:37-41","Lk 11:42-46","Lk 11:47-54","Lk 12:1-7","Lk 12:8-12","Mk 10:35-45","Lk 10:1-9","Lk 12:35-38","Lk 12:39-48","Lk 12:49-53","Lk 12:54-59","Lk 13:1-9","Mk 10:46-52","Lk 13:10-17","Lk 13:18-21","Lk 13:22-30","Lk 6:12-16","Lk 14:1-6","Lk 14:1","Mk 12:28-34","Mt 5:1-12","Jn 6:37-40","Lk 14:25-33","Lk 15:1-10","Lk 16:1-8","Lk 16:9-15","Mk 12:38-44","Lk 17:1-6","Jn 2:13-22","Lk 17:11-19","Lk 17:20-25","Lk 17:26-37","Lk 18:1-8","Mk 13:24-32","Lk 18:35-43","Lk 19:1-10","Lk 19:11-28","Lk 19:41-44","Lk 19:45-48","Lk 20:27-40","Jn 18:33-37","Lk 21:1-4","Lk 21:5-11","Lk 21:12-19","Lk 17:11-19","Lk 21:29-33","Lk 21:34-36","Lk 21:25-28","Mt 8:5-11","Mt 4:18-22","Mt 15:29-37","Mt 7:21","Mt 9:27-31","Mt 9:35","Lk 3:1-6","Lk 5:17-26","Mt 18:12-14","Lk 1:26-38","Mt 11:11-15","Mt 11:16-19","Mt 17:9","Lk 3:10-18","Mt 21:23-27","Mt 21:28-32","Lk 7:18-23","Lk 7:24-30","Mt 1:1-17","Mt 1:18-25","Lk 1:39-45","Lk 1:26-38","Lk 1:39-45","Lk 1:46-56","Lk 1:57-66","Lk 1:67-79","Jn 1:1-18","Lk 2:41-52","Jn 20:1","Mt 2:13-18","Lk 2:22-35","Lk 2:36-40","Jn 1:1-18"], KAB = { Mt: "Matius", Mk: "Markus", Lk: "Lukas", Jn: "Yohanes" };
function katParse(s) {
  var m = /^(Mt|Mk|Lk|Jn) (\d+):(\d+)(?:-(\d+))?(?:—(\d+):(\d+))?/.exec(s || ""); if (!m) return null;
  var b = bookIdx(KAB[m[1]]); if (b < 0) return null;
  var c = +m[2], v1 = +m[3], n = BOOKS[b].ch[c - 1].v.length, v2 = m[4] ? +m[4] : (m[5] ? n : v1);
  if (v2 > n) v2 = n;
  var label = KAB[m[1]] + " " + c + ":" + v1 + (m[5] ? "—" + m[5] + ":" + m[6] : (m[4] ? "-" + m[4] : ""));
  return { b: b, c: c, v1: v1, v2: v2, label: label };
}
function katToday() { var i = todayDn() - KAT0; return i >= 0 && i < KAT.length ? katParse(KAT[i]) : null; }
function katText(g, max) {
  var out = "";
  for (var v = g.v1; v <= g.v2; v++) { var id = idOfRef(g.b, g.c, v); if (id < 0) continue; var t = clean(texts[id]); if (max && out && (out + " " + t).length > max) return out + " …"; out += (out ? " " : "") + t; }
  return out;
}
function katVotd(g) {
  return '<div class="lab">Injil hari ini · bacaan Misa</div><p class="vt">' + esc(katText(g, 230)) + '</p><div class="vr">' + esc(g.label) + '</div><div class="acts icons"><button data-kat="read" aria-label="Baca dan dengarkan" title="Baca dan dengarkan"><svg class="ico" viewBox="0 0 24 24"><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/></svg></button><button data-kat="copy" aria-label="Salin" title="Salin"><svg class="ico" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></button><button data-mkimg="1" aria-label="Buat gambar" title="Buat gambar"><svg class="ico" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg></button></div>';
}
function applySeason() {
  var id = activeSeasonId(), root = document.documentElement;
  if (id) root.setAttribute("data-season", id); else root.removeAttribute("data-season");
  var b = $("sBadge");
  if (id) { b.hidden = false; b.innerHTML = ornSvg(id); } else b.hidden = true;
  var bg = getComputedStyle(document.body).backgroundColor;
  Array.prototype.forEach.call(document.querySelectorAll('meta[name="theme-color"]'), function (mt) { if (bg) mt.setAttribute("content", bg); });
  document.body.classList.toggle("previewing", !!PV);
  $("pvbar").hidden = !PV;
  if (PV) $("pvName").textContent = sname(PV);
}
function refreshSeason() { applySeason(); renderBanner(); if (S.view === "home") renderHome(); }
function syncSeasonUI() {
  Array.prototype.forEach.call($("calSeg").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.k === settings.cal)); });
  Array.prototype.forEach.call($("seaSeg").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.k === settings.sea)); });
  $("pvGrid").innerHTML = ORDER.map(function (id) { var m = SEA[id]; return '<button type="button" data-pv="' + id + '"><i style="background:linear-gradient(135deg,' + m.g[0] + "," + m.g[1] + ')"></i>' + esc(sname(id)) + "</button>"; }).join("");
}
$("calSeg").onclick = function (e) { var k = e.target.dataset && e.target.dataset.k; if (!k) return; settings.cal = k; lsSet("evo.set", settings); cloudTradisi(k); syncSeasonUI(); refreshSeason(); };
$("seaSeg").onclick = function (e) { var k = e.target.dataset && e.target.dataset.k; if (!k) return; settings.sea = k; lsSet("evo.set", settings); syncSeasonUI(); refreshSeason(); };
$("pvGrid").onclick = function (e) { var b = e.target.closest("[data-pv]"); if (!b) return; PV = b.dataset.pv; hide(); refreshSeason(); go("home"); window.scrollTo(0, 0); };
function pvStep(d) { var i = ORDER.indexOf(PV); PV = ORDER[(i + d + ORDER.length) % ORDER.length]; refreshSeason(); }
$("pvPrev").onclick = function () { pvStep(-1); };
$("pvNext").onclick = function () { pvStep(1); };
$("pvDone").onclick = function () { PV = null; refreshSeason(); };
document.addEventListener("visibilitychange", function () { if (!document.hidden && !PV) refreshSeason(); });

