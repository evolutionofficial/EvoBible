"use strict";
/* ---------- baca ---------- */
/* ---------- versi Alkitab ----------
   Data versi lain: ver/<kode>.json, susunan sama dengan AYT (kitab → pasal → ayat).
   null = belum ada di versi itu, "=" = digabung ke ayat sebelumnya, "" = tidak dicantumkan (naskah tertua). */
var VERS = {
  ayt: { n: "AYT", full: "Alkitab Yang Terbuka", lang: "id", sub: "Indonesia" },
  tsi: { n: "TSI", full: "Terjemahan Sederhana Indonesia", lang: "id", sub: "Indonesia · bahasa sederhana · PL baru sebagian" },
  kjv: { n: "KJV", full: "King James Version", lang: "en", sub: "Inggris · 1769" },
  web: { n: "WEB", full: "World English Bible", lang: "en", sub: "Inggris · modern" },
  bsb: { n: "BSB", full: "Berean Standard Bible", lang: "en", sub: "Inggris · modern" }
};
var VER_ORDER = ["ayt", "tsi", "kjv", "web", "bsb"];
var VS = lsGet("evo.ver", { main: "ayt", cmp: "" }); if (!VERS[VS.main]) VS.main = "ayt"; if (VS.cmp && !VERS[VS.cmp]) VS.cmp = "";
var VD = {}, VL = {};
function loadVer(k) {
  if (!k || k === "ayt" || VD[k]) return Promise.resolve(true);
  if (VL[k]) return VL[k];
  toast("Mengunduh " + VERS[k].n + "…");
  VL[k] = fetch("ver/" + k + ".json").then(function (r) { if (!r.ok) throw 0; return r.json(); })
    .then(function (d) { VD[k] = d; VL[k] = null; return true; })
    .catch(function () { VL[k] = null; toast("Gagal mengunduh " + VERS[k].n + ". Periksa internet."); return false; });
  return VL[k];
}
function verCh(k, b, c) { return k && k !== "ayt" && VD[k] ? VD[k][b][c - 1] : null; }
function verNA(k, b, c) { var d = verCh(k, b, c); return !!d && d.every(function (x) { return x === null; }); }
function verUsed(b, c) { var k = VS.main; return k !== "ayt" && VD[k] && !verNA(k, b, c) ? k : "ayt"; }
/* teks polos satu ayat menurut versi yang sedang dibaca (untuk salin, gambar, suara) */
function verPlain(b, c, n) {
  var k = verUsed(b, c), raw = BOOKS[b].ch[c - 1].v[n - 1];
  if (k === "ayt") return clean(raw);
  var x = VD[k][b][c - 1][n - 1];
  if (x === null) return clean(raw);
  return x === "=" ? "" : x;
}
function verSync() {
  $("verMain").innerHTML = "<b>" + VERS[VS.main].n + "</b>" + '<svg class="ico" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg>';
  $("verCmp").innerHTML = '<svg class="ico" viewBox="0 0 24 24"><path d="M7 4 3 8l4 4"/><path d="M3 8h13a4 4 0 0 1 4 4"/><path d="m17 20 4-4-4-4"/><path d="M21 16H8a4 4 0 0 1-4-4"/></svg>' + (VS.cmp ? "<b>" + VERS[VS.cmp].n + "</b>" : "Bandingkan");
  $("verCmp").classList.toggle("on", !!VS.cmp);
}
function verList() {
  function row(k, cur, attr) { var v = VERS[k]; return '<button class="verrow" type="button" ' + attr + '="' + k + '" aria-pressed="' + (cur === k) + '"><b>' + v.n + "</b><span>" + v.full + "<small>" + v.sub + "</small></span></button>"; }
  $("verListM").innerHTML = VER_ORDER.map(function (k) { return row(k, VS.main, "data-vm"); }).join("");
  $("verListC").innerHTML = '<button class="verrow" type="button" data-vc="" aria-pressed="' + !VS.cmp + '"><b>—</b><span>Tidak membandingkan</span></button>' + VER_ORDER.filter(function (k) { return k !== VS.main; }).map(function (k) { return row(k, VS.cmp, "data-vc"); }).join("");
}
function verApply() {
  lsSet("evo.ver", VS); verSync(); var y = window.scrollY;
  Promise.all([loadVer(VS.main), loadVer(VS.cmp)]).then(function () { if (S.view === "read" && S.b != null) { renderChapter(S.b, S.c); window.scrollTo(0, y); } });
}
$("verMain").onclick = $("verCmp").onclick = function () { verList(); show("shVer"); };
$("shVer").addEventListener("click", function (e) {
  var t = e.target.closest(".verrow"); if (!t) return;
  if (t.hasAttribute("data-vm")) { VS.main = t.getAttribute("data-vm"); if (VS.cmp === VS.main) VS.cmp = ""; }
  else VS.cmp = t.getAttribute("data-vc");
  hide(); verApply();
});
function renderChapter(b, c, vFocus, vEnd) {
  var bk = BOOKS[b], ch = bk.ch[c - 1];
  S.b = b; S.c = c; clearSel(true);
  if (FIND.b !== b) { FIND.b = b; syncFinders(); }
  $("locText").textContent = bk.n + " " + c; $("chBook").textContent = bk.n; $("chNum").textContent = "Pasal " + c;
  var h = ch.h || {}, html = "", op = false;
  /* versi: muat bila belum ada, sementara tampilkan AYT */
  if ((VS.main !== "ayt" && !VD[VS.main]) || (VS.cmp && VS.cmp !== "ayt" && !VD[VS.cmp])) Promise.all([loadVer(VS.main), loadVer(VS.cmp)]).then(function (ok) { if (ok[0] && ok[1] && S.view === "read" && S.b === b && S.c === c && (VD[VS.main] || VS.main === "ayt")) { var y = window.scrollY; renderChapter(b, c, vFocus, vEnd); if (!vFocus) window.scrollTo(0, y); } });
  var M = verUsed(b, c), md = verCh(M, b, c), C = VS.cmp && VS.cmp !== VS.main ? VS.cmp : "", cd = verCh(C, b, c), showH = M === "ayt";
  if (VS.main !== "ayt" && VD[VS.main] && M === "ayt") html += '<p class="verbanner">' + VERS[VS.main].n + " belum memuat kitab ini. Ditampilkan AYT.</p>";
  ch.v.forEach(function (raw, i) {
    var n = i + 1, brk = i === 0 || raw.charAt(0) === "¶" || (showH && h[i] !== undefined), t = plain(raw), lab = String(n), cls = "", tag = "";
    if (md) {
      var x = md[i];
      if (x === "=") { html += '<span class="v vm" data-v="' + n + '" id="v' + n + '"></span>'; return; }
      if (x === null) { tag = '<i class="vtag">AYT</i>'; cls = " vfb"; }
      else if (x === "") { t = "(tidak dicantumkan dalam naskah tertua)"; cls = " vom"; }
      else t = x;
      var j = i + 1; while (j < md.length && md[j] === "=") j++;
      if (j > i + 1) lab = n + "–" + j;
    }
    if (brk) { if (op) html += "</p>"; if (showH && h[i] !== undefined) html += "<h3>" + esc(h[i]) + "</h3>"; html += "<p>"; op = true; }
    var cmpH = "";
    if (C) {
      var ct;
      if (C === "ayt") ct = plain(raw);
      else if (!cd) ct = null;
      else if (verNA(C, b, c)) ct = null;
      else { var y2 = cd[i]; ct = y2 === null ? "(belum tersedia dalam " + VERS[C].n + ")" : y2 === "=" ? "↑" : y2 === "" ? "(tidak dicantumkan dalam naskah tertua)" : y2; }
      if (ct !== null) cmpH = '<span class="vc" lang="' + VERS[C].lang + '"><i>' + VERS[C].n + "</i>" + esc(ct) + "</span>";
    }
    html += '<span class="v' + cls + (hls[b + ":" + c + ":" + n] ? " hl" : "") + (sors[b + ":" + c + ":" + n] ? " sr sr-" + sors[b + ":" + c + ":" + n] : "") + '" data-v="' + n + '" id="v' + n + '"><b class="vn">' + lab + "</b>" + tag + esc(t) + " " + cmpH + "</span>";
  });
  if (op) html += "</p>";
  if (C && cd && verNA(C, b, c)) html = '<p class="verbanner">' + VERS[C].n + " belum memuat kitab ini.</p>" + html;
  $("text").innerHTML = html; $("text").lang = VERS[M].lang; $("text").classList.toggle("cmp", !!C); verSync();
  setNav($("prev"), prevOf(b, c)); setNav($("next"), nextOf(b, c));
  lsSet("evo.last", { b: b, c: c });
  if (T.on) markVerse();
  if (vFocus && $("v" + vFocus)) { var el = $("v" + vFocus); el.scrollIntoView({ block: "center" }); el.classList.add("flash"); } else window.scrollTo(0, 0);
  if (vFocus && vEnd >= vFocus) { for (var n = vFocus; n <= vEnd; n++) { var e2 = $("v" + n); if (e2) { S.sel.push(n); e2.classList.add("sel"); } } S.quiet = true; updateSel(); }
}
function setNav(btn, t) { btn.hidden = !t; if (t) btn.querySelector("b").textContent = BOOKS[t[0]].n + " " + t[1]; btn._t = t; }
function prevOf(b, c) { if (c > 1) return [b, c - 1]; if (b > 0) return [b - 1, BOOKS[b - 1].ch.length]; return null; }
function nextOf(b, c) { if (c < BOOKS[b].ch.length) return [b, c + 1]; if (b < BOOKS.length - 1) return [b + 1, 1]; return null; }
$("prev").onclick = function () { if (Date.now() - (this._tapT || 0) < 900) return; turnTo(this._t, -1); };
$("next").onclick = function () { if (Date.now() - (this._tapT || 0) < 900) return; turnTo(this._t, 1); };
/* iPhone: ketukan pertama kadang hanya menghentikan gulir yang masih meluncur atau "memilih" tombol,
   sehingga click baru datang di ketukan kedua. Tombol pasal langsung bereaksi saat jari diangkat. */
["prev", "next"].forEach(function (id) {
  var btn = $(id), st = null;
  btn.addEventListener("touchstart", function (e) { var p = e.touches[0]; st = { x: p.clientX, y: p.clientY, t: Date.now() }; }, { passive: true });
  btn.addEventListener("touchend", function (e) {
    var p = e.changedTouches[0], s0 = st; st = null;
    if (!s0 || (SW && SW.on) || Math.abs(p.clientX - s0.x) > 12 || Math.abs(p.clientY - s0.y) > 12 || Date.now() - s0.t > 700) return;
    if (e.cancelable) e.preventDefault();
    btn._tapT = Date.now(); turnTo(btn._t, id === "next" ? 1 : -1);
  });
});

/* ---------- animasi gulungan halaman (pindah pasal) ----------
   Punggung buku di kiri. Salinan halaman ditaruh di atas pasal yang baru dirender, lalu
   tergulung menjadi silinder kertas. Garis lipatan: dot(p, d) = m + s, d = arah gulungan
   (ke kiri, miring menurut tilt), m = posisi sudut terdepan, s = jarak lipatan dari sudut itu.
   tilt > 0: sudut bawah-kanan memimpin; tilt < 0: sudut atas-kanan memimpin.
   Tombol: animasi otomatis. Geser jari: gulungan menempel pada jari. Semua gerak hanya transform. */
var RM = false; try { RM = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
var TURN = null, SW = null;
function EIO(p) { return p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2; }
function EO(p) { return 1 - Math.pow(1 - p, 3); }
function curMain() { return document.querySelector("#vRead .rmain"); }
/* render pasal saat itu juga (animasi butuh hasilnya langsung); hashchange berikutnya dilewati */
var SKIP_H = null;
function goNow(b, c) {
  if (NAV_REPLACE) { openRef(b, c); return; }
  var h = "#" + BOOKS[b].a + "-" + c;
  showView("read"); renderChapter(b, c, 0);
  if (location.hash !== h) { SKIP_H = h; location.hash = h; }
}
function curlLayer(main, masked) {
  var r = main.getBoundingClientRect(), W = innerWidth, H = innerHeight;
  var ov = document.createElement("div"), pg = document.createElement("div");
  ov.className = "curl"; ov.setAttribute("aria-hidden", "true"); pg.className = "curl-p"; pg.style.width = W + "px"; pg.style.height = H + "px";
  var cl = main.cloneNode(true); Array.prototype.forEach.call(cl.querySelectorAll("[id]"), function (n) { n.removeAttribute("id"); });
  cl.style.cssText = "position:absolute;margin:0;left:" + r.left + "px;top:" + r.top + "px;width:" + r.width + "px";
  pg.appendChild(cl);
  var o = { ov: ov, pg: pg, W: W, H: H, L: Math.ceil(Math.hypot(W, H) * 2) + 8, RW: Math.round(Math.min(160, Math.max(100, W * .32))) };
  if (!masked) { ov.appendChild(pg); document.body.appendChild(ov); return o; }
  o.wrap = document.createElement("div"); o.wrap.className = "curl-w"; o.sh = document.createElement("div"); o.sh.className = "curl-s"; o.roll = document.createElement("div"); o.roll.className = "curl-r";
  o.wrap.style.width = o.wrap.style.height = o.L + "px"; o.roll.style.height = o.L + "px"; o.roll.style.width = o.RW + "px"; o.sh.style.width = Math.round(o.RW * .55) + "px";
  o.wrap.appendChild(pg); o.wrap.appendChild(o.sh); ov.appendChild(o.wrap); ov.appendChild(o.roll); document.body.appendChild(ov);
  return o;
}
function curlGeo(o, tilt) {
  var dx = -Math.cos(tilt), dy = -Math.sin(tilt), m = Infinity, M = -Infinity, P = null;
  [[0, 0], [o.W, 0], [0, o.H], [o.W, o.H]].forEach(function (c) { var v = c[0] * dx + c[1] * dy; if (v < m) { m = v; P = c; } if (v > M) M = v; });
  return { dx: dx, dy: dy, P: P, m: m, end: M - m + o.RW + 40 };
}
function curlPlace(o, tilt, s) {
  var g = curlGeo(o, tilt), f = Math.max(0, Math.min(1, s / g.end)), k = .3 + .7 * Math.min(1, f * 2.4), w = o.RW * k;
  var nx = -g.dy, ny = g.dx, L = o.L, deg = Math.atan2(g.dy, g.dx) * 180 / Math.PI;
  var Ox = g.P[0] + s * g.dx - L / 2 * nx, Oy = g.P[1] + s * g.dy - L / 2 * ny;
  o.wrap.style.transform = "translate3d(" + Ox + "px," + Oy + "px,0) rotate(" + deg + "deg)";
  o.pg.style.transform = "rotate(" + (-deg) + "deg) translate3d(" + (-Ox) + "px," + (-Oy) + "px,0)";
  o.roll.style.transform = "translate3d(" + (Ox - w * g.dx) + "px," + (Oy - w * g.dy) + "px,0) rotate(" + deg + "deg) scaleX(" + k + ")";
  o.sh.style.transform = "scaleX(" + k + ")";
}
function curlRun(o, tiltAt, s0, s1, dur, ease, done) {
  var t0 = 0;
  function fr(ts) {
    if (!t0) t0 = ts;
    var p = Math.min(1, (ts - t0) / dur), s = s0 + (s1 - s0) * ease(p);
    curlPlace(o, tiltAt(s), s); curlRun.last = performance.now();
    if (p < 1) requestAnimationFrame(fr); else done();
  }
  requestAnimationFrame(fr);
}
function curlClean(o, base, done) { requestAnimationFrame(function () { o.ov.remove(); if (base) base.ov.remove(); TURN = null; if (done) done(); }); }
/* pengaman: bila karena apa pun lapisan gulungan tertinggal tanpa animasi berjalan, bersihkan */
setInterval(function () {
  if (!TURN || (SW && SW.on && !SW.rel)) { curlRun.last = performance.now(); return; }
  if (performance.now() - (curlRun.last || 0) > 2500) { Array.prototype.forEach.call(document.querySelectorAll(".curl"), function (n) { n.remove(); }); TURN = null; }
}, 1000);
function turnTo(t, dir, done) {
  if (!t) return;
  if (RM || TURN || S.view !== "read") { openRef(t[0], t[1]); if (done) done(); return; }
  TURN = true;
  var o, base = null, E, tiltAt;
  if (dir > 0) { o = curlLayer(curMain(), true); goNow(t[0], t[1]); }
  else { base = curlLayer(curMain(), false); goNow(t[0], t[1]); o = curlLayer(curMain(), true); }
  E = curlGeo(o, .1).end;
  tiltAt = function (s) { return .42 - .32 * Math.min(1, s / E); };
  var s0 = dir > 0 ? 0 : E, s1 = dir > 0 ? E : 0;
  curlPlace(o, tiltAt(s0), s0);
  curlRun(o, tiltAt, s0, s1, 1250, EIO, function () { curlClean(o, base, done); });
}

/* geser jari untuk pindah pasal: kiri = berikutnya, kanan = sebelumnya */
function swTilt(sw, s) {
  var t = sw.tb - (sw.y - sw.y0) / sw.o.H * .9; t = Math.max(-.6, Math.min(.6, t));
  return t * (1 - .55 * Math.min(1, s / sw.E));
}
function swBegin(sw, dir, t) {
  TURN = true; sw.on = true; sw.dir = dir; sw.old = [S.b, S.c, scrollY]; sw.base = null;
  if (dir > 0) { sw.o = curlLayer(curMain(), true); goNow(t[0], t[1]); }
  else { sw.base = curlLayer(curMain(), false); goNow(t[0], t[1]); sw.o = curlLayer(curMain(), true); }
  sw.E = curlGeo(sw.o, 0).end; sw.tb = (sw.y0 / sw.o.H - .5) * .8; sw.s = dir > 0 ? 0 : sw.E;
  curlPlace(sw.o, swTilt(sw, sw.s), sw.s);
  (function fr() {
    if (sw.rel) return;
    var tl = swTilt(sw, sw.s), g = curlGeo(sw.o, tl), tg = sw.x * g.dx + sw.y * g.dy - g.m + sw.o.RW * .45;
    tg = Math.max(0, Math.min(sw.E, tg)); sw.s += (tg - sw.s) * .32;
    curlPlace(sw.o, tl, sw.s); requestAnimationFrame(fr);
  })();
}
function swRelease() {
  var sw = SW; SW = null; if (!sw || !sw.on) return; sw.rel = true;
  var h = sw.hist, a = h[0], b = h[h.length - 1], vx = b[1] - a[1] > 0 ? (b[0] - a[0]) / (b[1] - a[1]) : 0;
  var fx = sw.x / sw.o.W, go = sw.dir > 0 ? (vx < -.35 || (fx < .55 && vx < .25)) : (vx > .35 || (fx > .45 && vx > -.25));
  var tb = swTilt(sw, 0), to = (sw.dir > 0) === go ? sw.E : 0, dist = Math.abs(to - sw.s);
  var dur = Math.max(280, Math.min(750, dist / Math.max(.7, Math.abs(vx))));
  curlRun(sw.o, function (s) { return tb * (1 - .55 * Math.min(1, s / sw.E)); }, sw.s, to, dur, EO, function () {
    if (!go) { goNow(sw.old[0], sw.old[1]); window.scrollTo(0, sw.old[2]); }
    curlClean(sw.o, sw.base);
  });
}
/* Di iPhone, touchmove/touchend dikirim ke elemen yang pertama disentuh meski elemen itu sudah
   dibuang (teks pasal dirender ulang saat geser dimulai) dan tidak menggelembung ke #vRead.
   Karena itu pendengar dipasang juga langsung pada elemen sasaran dan pada document. */
function swMove(e) {
  var sw = SW; if (!sw || sw.lastEv === e) return; sw.lastEv = e;
  if (e.touches.length > 1) { if (!sw.on) SW = null; return; }
  var p = e.touches[0], dx = p.clientX - sw.x0, dy = p.clientY - sw.y0;
  sw.x = p.clientX; sw.y = p.clientY; sw.hist.push([p.clientX, performance.now()]); if (sw.hist.length > 6) sw.hist.shift();
  if (!sw.on) {
    if (Math.abs(dy) > 12 && Math.abs(dy) >= Math.abs(dx)) { SW = null; return; }
    if (Math.abs(dx) < 14 || Math.abs(dx) < Math.abs(dy) * 1.3) return;
    var dir = dx < 0 ? 1 : -1, t = dir > 0 ? $("next")._t : $("prev")._t;
    if (!t || TURN) { SW = null; return; }
    swBegin(sw, dir, t);
  }
  if (e.cancelable) e.preventDefault();
}
function swEnd() {
  var sw = SW; if (sw && sw.tgt) { sw.tgt.removeEventListener("touchmove", swMove); sw.tgt.removeEventListener("touchend", swEnd); sw.tgt.removeEventListener("touchcancel", swEnd); }
  swRelease();
}
$("vRead").addEventListener("touchstart", function (e) {
  if (SW && SW.on) return;
  SW = null;
  if (RM || TURN || e.touches.length > 1 || (e.target.closest && e.target.closest("input,select,textarea,.finder"))) return;
  var p = e.touches[0], now = performance.now(), tg = e.target;
  SW = { x0: p.clientX, y0: p.clientY, x: p.clientX, y: p.clientY, on: false, hist: [[p.clientX, now]], tgt: tg };
  tg.addEventListener("touchmove", swMove, { passive: false }); tg.addEventListener("touchend", swEnd); tg.addEventListener("touchcancel", swEnd);
}, { passive: true });
document.addEventListener("touchmove", swMove, { passive: false });
document.addEventListener("touchend", swEnd);
document.addEventListener("touchcancel", swEnd);
document.addEventListener("visibilitychange", function () { if (document.hidden) swEnd(); });

/* ---------- gulir otomatis ----------
   Posisi disimpan sebagai pecahan piksel dan dimajukan tiap frame menurut waktu nyata,
   jadi geraknya halus (bukan loncat 1 piksel). Berhenti sejenak saat layar disentuh,
   dan di akhir pasal otomatis menggulung ke pasal berikutnya. */
var AS_SP = [5, 7, 10, 14, 20], AS_N = ["Sangat pelan", "Pelan", "Sedang", "Cepat", "Sangat cepat"];
var AS = { on: false, run: false, sp: Math.min(4, Math.max(0, +lsGet("evo.as", 2) || 0)), y: 0, last: 0, hold: 0, endT: 0 };
var AS_PAUSE = '<svg class="ico" viewBox="0 0 24 24"><path d="M9 5v14M15 5v14"/></svg>', AS_PLAY = '<svg class="ico" viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>';
function asUi() {
  $("asbar").hidden = !AS.on; document.body.classList.toggle("autoscroll", AS.on);
  $("btnAuto").classList.toggle("on", AS.on); $("btnAuto").setAttribute("aria-pressed", AS.on ? "true" : "false");
  $("asSpd").textContent = AS_N[AS.sp]; $("asSlow").disabled = AS.sp === 0; $("asFast").disabled = AS.sp === AS_SP.length - 1;
  $("asPlay").innerHTML = AS.run ? AS_PAUSE : AS_PLAY; $("asPlay").setAttribute("aria-label", AS.run ? "Jeda" : "Lanjutkan");
}
function asFrac(f) {
  var m = document.querySelector("#vRead .rmain"); if (!m) return;
  if (f > 0.001) { m.style.transform = "translate3d(0," + (-f).toFixed(3) + "px,0)"; m.style.willChange = "transform"; }
  else if (m.style.transform) { m.style.transform = ""; m.style.willChange = ""; }
}
function asLoop(ts) {
  if (!AS || !AS.on) { asFrac(0); return; } requestAnimationFrame(asLoop);
  var dt = AS.last ? Math.min(64, ts - AS.last) : 0; AS.last = ts;
  if (!AS.run || TURN || AS.hold > ts || S.view !== "read" || S.sel.length || document.hidden || T.on) { asFrac(0); AS.y = scrollY; AS.endT = 0; return; }
  var max = document.documentElement.scrollHeight - innerHeight;
  if (Math.abs(scrollY - Math.floor(AS.y)) > 2) { AS.y = scrollY; asFrac(0); }
  if (AS.y >= max - 1) {
    asFrac(0);
    if (!AS.endT) AS.endT = ts + 1800;
    else if (ts > AS.endT) { AS.endT = 0; var nt = nextOf(S.b, S.c); if (nt) turnTo(nt, 1, function () { AS.y = 0; AS.hold = performance.now() + 1500; }); else { AS.run = false; asUi(); toast("Sudah sampai akhir Alkitab"); } }
    return;
  }
  AS.y = Math.min(max, AS.y + AS_SP[AS.sp] * dt / 1000);
  var iy = Math.floor(AS.y); if (iy !== scrollY) window.scrollTo(0, iy);
  asFrac(AS.y - iy);
}
function asStart() { AS.on = true; AS.run = true; AS.y = scrollY; AS.last = 0; AS.hold = 0; asUi(); requestAnimationFrame(asLoop); }
function asStop() { if (!AS || !AS.on) return; AS.on = false; AS.run = false; asFrac(0); asUi(); }
$("btnAuto").onclick = function () { if (AS.on) asStop(); else { if (T.on) stopTTS(); asStart(); } };
$("asStop").onclick = asStop;
$("asPlay").onclick = function () { AS.run = !AS.run; AS.hold = 0; AS.last = 0; asUi(); };
$("asSlow").onclick = function () { if (AS.sp > 0) { AS.sp--; lsSet("evo.as", AS.sp); asUi(); } };
$("asFast").onclick = function () { if (AS.sp < AS_SP.length - 1) { AS.sp++; lsSet("evo.as", AS.sp); asUi(); } };
addEventListener("touchstart", function (e) { if (AS.on && !(e.target.closest && e.target.closest(".asbar"))) AS.hold = Infinity; }, { passive: true });
["touchend", "touchcancel"].forEach(function (ev) { addEventListener(ev, function () { if (AS.on && AS.hold === Infinity) AS.hold = performance.now() + 1500; }, { passive: true }); });
addEventListener("wheel", function () { if (AS.on) AS.hold = performance.now() + 1500; }, { passive: true });
document.addEventListener("keydown", function (e) {
  if (e.key === "Escape") { if (openSheet) hide(); else clearSel(); return; }
  if (S.view !== "read" || openSheet || /input|textarea/i.test(e.target.tagName || "")) return;
  var t = e.key === "ArrowLeft" ? $("prev")._t : e.key === "ArrowRight" ? $("next")._t : null; if (t) turnTo(t, e.key === "ArrowLeft" ? -1 : 1);
});
$("text").addEventListener("click", function (e) {
  var v = e.target.closest(".v"); if (!v) return;
  var n = +v.dataset.v, i = S.sel.indexOf(n);
  if (S.quiet) { S.quiet = false; if (i >= 0) { updateSel(); return; } }
  if (i >= 0) { S.sel.splice(i, 1); v.classList.remove("sel"); } else { S.sel.push(n); v.classList.add("sel"); } S.selHidden = false;
  updateSel();
});
function clearSel(silent) { S.sel = []; S.quiet = false; Array.prototype.forEach.call(document.querySelectorAll(".v.sel"), function (el) { el.classList.remove("sel"); }); if (silent) { $("selbar").classList.remove("on"); document.body.classList.remove("selopen"); } else updateSel(); }
function rangeStr(nums) { var s = nums.slice().sort(function (a, b) { return a - b; }), out = [], i = 0; while (i < s.length) { var j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i ? s[i] + "-" + s[j] : String(s[i])); i = j + 1; } return out.join(","); }
function updateSel() {
  var n = S.sel.length, on = n > 0 && !S.quiet && !S.selHidden, sh = $("selbar");
  sh.classList.toggle("on", on); sh.setAttribute("aria-hidden", String(!on)); document.body.classList.toggle("selopen", on);
  if (!n) { S.selHidden = false; return; }
  var srt = S.sel.slice().sort(function (a, b) { return a - b; });
  $("selInfo").textContent = BOOKS[S.b].n + " " + S.c + ":" + rangeStr(srt) + (n > 1 ? " · " + n + " ayat" : "");
  var allHl = S.sel.every(function (v) { return hls[S.b + ":" + S.c + ":" + v]; });
  $("selHlT").textContent = allHl ? "Hapus simpan" : "Simpan";
  $("selHl").setAttribute("aria-pressed", String(allHl));
  var cs = S.sel.map(function (v) { return sors[S.b + ":" + S.c + ":" + v] || ""; }), same = cs.every(function (c) { return c === cs[0]; }) ? cs[0] : "";
  Array.prototype.forEach.call($("selColors").querySelectorAll("[data-c]"), function (b) { b.setAttribute("aria-pressed", String(!!same && b.dataset.c === same)); });
  $("selNone").hidden = !cs.some(Boolean);
}
$("selClear").onclick = function () { clearSel(); };
$("selHide").onclick = function () { S.selHidden = true; updateSel(); };
$("selHl").onclick = function () {
  var allHl = S.sel.every(function (v) { return hls[S.b + ":" + S.c + ":" + v]; });
  S.sel.forEach(function (v) { var k = S.b + ":" + S.c + ":" + v; if (allHl) delete hls[k]; else hls[k] = 1; $("v" + v).classList.toggle("hl", !allHl); });
  var ks = S.sel.map(function (v) { return S.b + ":" + S.c + ":" + v; }); cloudHl(allHl ? [] : ks, allHl ? ks : []);
  lsSet("evo.hl", hls); toast(allHl ? "Simpanan dihapus" : "Ayat disimpan"); clearSel();
};
function srClass(el, c) { el.className = el.className.replace(/\s*\bsr(-[a-z])?\b/g, ""); if (c) el.classList.add("sr", "sr-" + c); }
$("selColors").onclick = function (e) {
  var bt = e.target.closest("button"); if (!bt || !S.sel.length) return;
  var c = bt.dataset.c || "", vs = S.sel.slice(), ks = vs.map(function (v) { return S.b + ":" + S.c + ":" + v; });
  ks.forEach(function (k, i) { if (c) sors[k] = c; else delete sors[k]; var el = $("v" + vs[i]); if (el) srClass(el, c); });
  lsSet("evo.sor", sors); cloudSor(c ? ks : [], c ? [] : ks, c); toast(c ? "Disorot " + SR_C[c].toLowerCase() : "Sorotan dihapus"); clearSel();
};
function selText() {
  var s = S.sel.slice().sort(function (a, b) { return a - b; }), bk = BOOKS[S.b], ch = bk.ch[S.c - 1];
  var body = s.map(function (n) { var t = verPlain(S.b, S.c, n); return !t ? "" : s.length > 1 ? n + " " + t : t; }).filter(Boolean).join("\n");
  return body + "\n\n" + bk.n + " " + S.c + ":" + rangeStr(s) + " (" + VERS[verUsed(S.b, S.c)].n + ")";
}
$("selCopy").onclick = function () { copyText(selText()); clearSel(); };
$("selShare").onclick = function () { var t = selText(); if (navigator.share) navigator.share({ text: t }).catch(function () {}); else copyText(t); clearSel(); };
$("selImg").onclick = function () { var s = S.sel.slice().sort(function (a, b) { return a - b; }), bk = BOOKS[S.b], ch = bk.ch[S.c - 1]; if (!s.length || !window.EvoGambar) return; var tx = s.map(function (n) { return verPlain(S.b, S.c, n); }).filter(Boolean).join(" "); var vu = verUsed(S.b, S.c); EvoGambar.open({ text: tx, ref: bk.n + " " + S.c + ":" + rangeStr(s) + (vu !== "ayt" ? " (" + VERS[vu].n + ")" : ""), toast: toast }); clearSel(); };
(function () {
  var sh = $("selbar"), y0 = null, dy = 0, pid = null;
  sh.addEventListener("pointerdown", function (e) { if (e.target.closest("button")) return; y0 = e.clientY; dy = 0; pid = e.pointerId; sh.classList.add("drag"); try { sh.setPointerCapture(pid); } catch (x) {} });
  sh.addEventListener("pointermove", function (e) { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = "translateY(" + dy + "px)"; });
  function up() { if (y0 === null) return; y0 = null; sh.classList.remove("drag"); sh.style.transform = ""; if (dy > 60) { S.selHidden = true; updateSel(); } }
  sh.addEventListener("pointerup", up); sh.addEventListener("pointercancel", up);
})();

/* ---------- pilih kitab ---------- */
var tab = 0, pick = -1, fmode = false, bq = "";
function drawBooks() {
  var html = "";
  if (pick >= 0 && !fmode) {
    var bk = BOOKS[pick];
    html += '<button class="back2" id="bkBack"><svg class="ico" viewBox="0 0 24 24" style="width:16px;height:16px"><path d="m15 6-6 6 6 6"/></svg>Semua kitab</button><h3 style="margin:0 0 12px;font-size:22px;font-weight:800;letter-spacing:-.02em">' + esc(bk.n) + '</h3><div class="chs">';
    for (var c = 1; c <= bk.ch.length; c++) html += '<button data-c="' + c + '" class="' + (pick === S.b && c === S.c ? "cur" : "") + '">' + c + "</button>";
    html += "</div>";
  } else {
    var curB = fmode ? FIND.b : S.b, q = norm(bq);
    if (fmode) html += '<input class="bkq" id="bkq" type="search" placeholder="Ketik nama kitab" autocomplete="off" value="' + esc(bq) + '" aria-label="Cari kitab">';
    if (!q) html += '<div class="tabs2" role="tablist"><button role="tab" data-tab="0" aria-selected="' + (tab === 0) + '"><b>Perjanjian Lama</b><small>39 kitab</small></button><button role="tab" data-tab="1" aria-selected="' + (tab === 1) + '"><b>Perjanjian Baru</b><small>27 kitab</small></button></div>';
    html += '<div class="books">';
    var n = 0;
    for (var i = q ? 0 : (tab ? 39 : 0); i < (q ? 66 : (tab ? 66 : 39)); i++) { if (q && norm(BOOKS[i].n).indexOf(q) < 0) continue; n++; html += '<button data-b="' + i + '" class="' + (i === curB ? "cur" : "") + '">' + esc(BOOKS[i].n) + "</button>"; }
    if (q && !n) html += '<p class="vnote">Kitab tidak ditemukan.</p>';
    html += "</div>";
  }
  $("booksBody").innerHTML = html;
}
$("btnLoc").onclick = function () { fmode = false; bq = ""; pick = -1; tab = S.b >= 39 ? 1 : 0; drawBooks(); show("shBooks"); var cur = $("booksBody").querySelector(".cur"); if (cur) cur.scrollIntoView({ block: "center" }); };
$("booksBody").addEventListener("click", function (e) {
  var t = e.target.closest("button"); if (!t) return;
  if (t.dataset.tab) { tab = +t.dataset.tab; drawBooks(); }
  else if (t.dataset.b && fmode) { FIND.b = +t.dataset.b; FIND.c = ""; FIND.v1 = ""; FIND.v2 = ""; syncFinders(); hide(); var fc = document.querySelector(".finder:not([hidden]) .fc"); setTimeout(function () { var f = visibleFinder(); if (f) f.querySelector(".fc").focus(); }, 60); }
  else if (t.dataset.b) { pick = +t.dataset.b; drawBooks(); $("booksBody").scrollTop = 0; }
  else if (t.id === "bkBack") { pick = -1; drawBooks(); }
  else if (t.dataset.c) { var b = pick; hide(); openRef(b, +t.dataset.c); }
});

$("booksBody").addEventListener("input", function (e) { if (e.target.id !== "bkq") return; bq = e.target.value; var pos = bq.length; drawBooks(); var el = $("bkq"); el.focus(); try { el.setSelectionRange(pos, pos); } catch (x) {} });

/* ---------- buka ayat: kitab, pasal, ayat - sampai ayat ---------- */
var FIND = { b: 0, c: "", v1: "", v2: "" };
function finderHTML() {
  return '<form class="finder" autocomplete="off"><div class="flabel">Buka kitab, pasal, dan ayat</div><div class="frow">'
    + '<button type="button" class="fbook" aria-label="Pilih kitab"><span></span><svg class="ico" viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"/></svg></button>'
    + '<input class="fn fc" data-k="c" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="Pasal" aria-label="Pasal" enterkeyhint="go">'
    + '<input class="fn fv1" data-k="v1" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="Ayat" aria-label="Ayat" enterkeyhint="go">'
    + '<i class="dash">–</i>'
    + '<input class="fn fv2" data-k="v2" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="s/d" aria-label="Sampai ayat" enterkeyhint="go">'
    + '</div><div class="fheard" aria-live="polite" hidden></div><div class="fbtns"><button class="fmic" type="button" aria-label="Cari dengan suara" hidden><svg class="ico" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg></button><button class="fgo" type="submit"><svg class="ico" viewBox="0 0 24 24"><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/></svg><span>Buka ayat</span></button></div></form>';
}
function visibleFinder() { var l = document.querySelectorAll(".finder"); for (var i = 0; i < l.length; i++) if (l[i].offsetParent !== null) return l[i]; return null; }
function syncFinders() {
  Array.prototype.forEach.call(document.querySelectorAll(".finder"), function (f) {
    f.querySelector(".fbook span").textContent = BOOKS[FIND.b].n;
    ["c", "v1", "v2"].forEach(function (k) { var el = f.querySelector('[data-k="' + k + '"]'); if (el !== document.activeElement) el.value = FIND[k]; });
  });
}
$("finderHome").innerHTML = finderHTML(); $("finderRead").innerHTML = finderHTML();
Array.prototype.forEach.call(document.querySelectorAll(".finder"), function (f) {
  f.querySelector(".fbook").onclick = function () { fmode = true; bq = ""; pick = -1; tab = FIND.b >= 39 ? 1 : 0; drawBooks(); show("shBooks"); var cur = $("booksBody").querySelector(".cur"); if (cur) cur.scrollIntoView({ block: "center" }); };
  f.addEventListener("input", function (e) {
    var k = e.target.dataset && e.target.dataset.k; if (!k) return;
    e.target.value = e.target.value.replace(/\D/g, "").slice(0, 3); FIND[k] = e.target.value; syncFinders();
  });
  f.onsubmit = function (e) {
    e.preventDefault();
    var bk = BOOKS[FIND.b], c = parseInt(FIND.c, 10) || 1, v1 = parseInt(FIND.v1, 10) || 0, v2 = parseInt(FIND.v2, 10) || 0;
    if (c > bk.ch.length) { c = bk.ch.length; toast(bk.n + " hanya punya " + c + " pasal"); }
    var mx = bk.ch[c - 1].v.length;
    if (v1 > mx) { v1 = mx; toast(bk.n + " " + c + " hanya punya " + mx + " ayat"); }
    if (!v1) v2 = 0; else { if (v2 < v1) v2 = v1; if (v2 > mx) v2 = mx; }
    FIND.c = String(c); FIND.v1 = v1 ? String(v1) : ""; FIND.v2 = v1 ? String(v2) : ""; syncFinders();
    try { document.activeElement.blur(); } catch (x) {}
    openRef(FIND.b, c, v1, v2);
  };
});
/* ---------- cari ayat dengan suara ----------
   Contoh ucapan: "Roma pasal dua ayat satu sampai tujuh", "Yohanes tiga enam belas", "Korintus pertama tiga belas". */
var NUMW = { nol: 0, satu: 1, se: 1, dua: 2, tiga: 3, empat: 4, lima: 5, enam: 6, tujuh: 7, delapan: 8, sembilan: 9 };
var ORDW = { pertama: 1, kesatu: 1, kedua: 2, ketiga: 3 };
function spWords(t) {
  t = t.toLowerCase().replace(/(\d)\s*[:.]\s*(\d)/g, "$1 ayat $2").replace(/(\d)\s*[-–]\s*(\d)/g, "$1 sampai $2")
    .replace(/s\/d|sampai dengan|hingga|sampai ke/g, " sampai ").replace(/[^a-z0-9 ]+/g, " ").replace(/\bse(puluh|belas|ratus)\b/g, "satu $1")
    .replace(/\bsebelas\b/g, "satu belas").replace(/\bseratus\b/g, "satu ratus");
  var w = t.split(/\s+/).filter(Boolean), out = [], i = 0;
  while (i < w.length) {
    if (NUMW[w[i]] != null && w[i] !== "se" || /^\d+$/.test(w[i])) {
      var tot = 0, cur = 0, used = false;
      while (i < w.length) {
        var x = w[i];
        if (/^\d+$/.test(x)) { if (used) break; cur = +x; used = true; i++; if (!/^(belas|puluh|ratus)$/.test(w[i] || "")) break; continue; }
        if (NUMW[x] != null && x !== "se") { if (used && cur) break; cur = NUMW[x]; used = true; i++; continue; }
        if (x === "belas") { cur = (cur || 1) + 10; i++; continue; }
        if (x === "puluh") { tot += (cur || 1) * 10; cur = 0; i++; continue; }
        if (x === "ratus") { tot += (cur || 1) * 100; cur = 0; i++; continue; }
        break;
      }
      out.push(String(tot + cur));
    } else out.push(w[i++]);
  }
  return out;
}
var SP_ALIAS = { kisahrasul: "Kis", kisahpararasul: "Kis", kidung: "Kid", rajaraja: "Raj", raja: "Raj", hakim: "Hak", hakimhakim: "Hak", johanes: "Yoh", yohannes: "Yoh", mazmur: "Mzm", masmur: "Mzm", wahyu: "Why", pengkotbah: "Pkh", pengkhotbah: "Pkh" };
function spBook(words) {
  var best = null;
  for (var s = 0; s < words.length; s++) for (var e = Math.min(words.length, s + 4); e > s; e--) {
    var key = words.slice(s, e).join(""); if (/\d/.test(key) || key.length < 2) continue;
    var hits = [];
    BOOKS.forEach(function (bk, i) {
      var n = bk.n.toLowerCase().replace(/^[1-3]\s*/, "").replace(/[^a-z]/g, ""), a = bk.a.toLowerCase().replace(/^[1-3]/, "");
      if (n === key || (SP_ALIAS[key] && bk.a.replace(/^[1-3]/, "") === SP_ALIAS[key])) hits.push(i);
    });
    if (hits.length && (!best || e - s > best.e - best.s)) best = { hits: hits, s: s, e: e };
  }
  return best;
}
function spokenRef(text) {
  var w = spWords(text).filter(function (x) { return !/^(kitab|injil|surat|buka|baca|cari|tolong|dari|di|kepada|jemaat|rasul|paulus|yang)$/.test(x) || x === "rasul"; });
  var bk = spBook(w); if (!bk) return null;
  var pre = w[bk.s - 1], post = w[bk.e], nth = 0, rest = w.slice(bk.e);
  if (pre && /^[1-3]$/.test(pre)) nth = +pre;
  else if (pre && ORDW[pre]) nth = ORDW[pre];
  else if (post && ORDW[post]) { nth = ORDW[post]; rest = rest.slice(1); }
  var b = -1;
  bk.hits.forEach(function (i) { var m = /^([1-3])/.exec(BOOKS[i].a); if ((m ? +m[1] : 0) === nth) b = i; });
  if (b < 0 && !nth) {
    var numbered = bk.hits.filter(function (i) { return /^[1-3]/.test(BOOKS[i].a); });
    if (numbered.length === bk.hits.length && /^[1-3]$/.test(rest[0] || "")) { nth = +rest[0]; rest = rest.slice(1); bk.hits.forEach(function (i) { if (+BOOKS[i].a[0] === nth) b = i; }); }
    else if (numbered.length === bk.hits.length) b = numbered[0];
  }
  if (b < 0) b = bk.hits[0];
  var nums = [], role = [], last = "";
  rest.forEach(function (x) { if (/^(pasal|bab)$/.test(x)) last = "c"; else if (x === "ayat") last = "v"; else if (x === "sampai") last = "to"; else if (/^\d+$/.test(x)) { nums.push(+x); role.push(last); last = ""; } });
  var c = 0, v1 = 0, v2 = 0;
  nums.forEach(function (n, k) {
    var r = role[k];
    if (r === "c" || (!r && !c)) { if (!c) c = n; }
    else if (r === "to") { if (v1) v2 = n; }
    else if (!v1) v1 = n; else if (!v2) v2 = n;
  });
  if (!c) c = 1;
  return { b: b, c: c, v1: v1, v2: v2 };
}
window.EvoSpokenRef = function (t) { var r = spokenRef(t); return r && BOOKS[r.b].a + " " + r.c + (r.v1 ? ":" + r.v1 + (r.v2 ? "-" + r.v2 : "") : ""); };
/* Cari ayat dengan suara: rekam sendiri (WAV 16 kHz) lalu dikenali di server (Gemini lewat function `suara`).
   Pengenal suara bawaan Safari tidak dipakai karena di iPhone tidak melepas mikrofon setelah sekali pakai.
   Mikrofon dilepas begitu rekaman selesai, jadi indikator mikrofon iPhone ikut hilang. */
var API_SUARA = "https://ddydxagduxhzzsrlwgkd.supabase.co/functions/v1/suara";
var MIC = { st: "idle", f: null, stream: null, ctx: null, node: null, src: null, buf: [], rate: 48000, t0: 0, talk: 0, quiet: 0, timer: 0 };
var MIC_OK = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));
function micUi(f, on) { Array.prototype.forEach.call(document.querySelectorAll(".finder"), function (x) { x.classList.toggle("listening", on && x === f); }); }
function micHeard(f, t, keep) { var h = f.querySelector(".fheard"); h.hidden = !t; h.textContent = t || ""; clearTimeout(h._t); if (t && !keep) h._t = setTimeout(function () { h.hidden = true; }, 3000); }
function micRelease() {
  clearInterval(MIC.timer);
  try { MIC.node && MIC.node.disconnect(); } catch (e) {}
  try { MIC.src && MIC.src.disconnect(); } catch (e) {}
  try { MIC.stream && MIC.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
  try { MIC.ctx && MIC.ctx.close(); } catch (e) {}
  MIC.node = MIC.src = MIC.stream = MIC.ctx = null;
}
function micWav(chunks, rate) {
  var n = 0; chunks.forEach(function (c) { n += c.length; });
  var all = new Float32Array(n), o = 0; chunks.forEach(function (c) { all.set(c, o); o += c.length; });
  var ratio = rate / 16000, len = Math.floor(n / ratio), pcm = new Int16Array(len);
  for (var i = 0; i < len; i++) { var s = all[Math.floor(i * ratio)]; s = Math.max(-1, Math.min(1, s)); pcm[i] = s < 0 ? s * 32768 : s * 32767; }
  var b = new ArrayBuffer(44 + pcm.length * 2), v = new DataView(b);
  function str(p, s) { for (var k = 0; k < s.length; k++) v.setUint8(p + k, s.charCodeAt(k)); }
  str(0, "RIFF"); v.setUint32(4, 36 + pcm.length * 2, true); str(8, "WAVE"); str(12, "fmt "); v.setUint32(16, 16, true); v.setUint16(20, 1, true); v.setUint16(22, 1, true);
  v.setUint32(24, 16000, true); v.setUint32(28, 32000, true); v.setUint16(32, 2, true); v.setUint16(34, 16, true); str(36, "data"); v.setUint32(40, pcm.length * 2, true);
  new Int16Array(b, 44).set(pcm);
  var bytes = new Uint8Array(b), bin = ""; for (var j = 0; j < bytes.length; j += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(j, j + 0x8000));
  return btoa(bin);
}
function micOpen(r) {
  var f = MIC.f; FIND.b = r.b; FIND.c = String(r.c); FIND.v1 = r.v1 ? String(r.v1) : ""; FIND.v2 = r.v2 ? String(r.v2) : ""; syncFinders();
  f.onsubmit({ preventDefault: function () {} });
}
function micFinish(spoke) {
  var f = MIC.f, chunks = MIC.buf, rate = MIC.rate; MIC.buf = [];
  micRelease(); micUi(f, false);
  if (!spoke) { MIC.st = "idle"; micHeard(f, "Tidak terdengar suara"); return; }
  MIC.st = "sending"; micHeard(f, "Mengenali…", true);
  var wav; try { wav = micWav(chunks, rate); } catch (e) { MIC.st = "idle"; micHeard(f, "Suara belum bisa dikenali"); return; }
  fetch(API_SUARA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a: wav, m: "audio/wav", d: devId }) })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      MIC.st = "idle";
      if (!j || !j.ok) { micHeard(f, j && j.sebab === "batas" ? "Batas pencarian suara hari ini sudah habis" : "Suara belum bisa dikenali"); return; }
      var hit = (j.ref && spokenRef(j.ref)) || (j.teks && spokenRef(j.teks));
      if (!hit) { micHeard(f, j.teks ? "Belum dikenali: “" + j.teks + "”" : "Tidak terdengar suara"); return; }
      micHeard(f, "“" + (j.teks || j.ref) + "”"); micOpen(hit);
    })
    .catch(function () { MIC.st = "idle"; micHeard(f, "Perlu internet untuk mencari dengan suara"); });
}
function micStart(f) {
  if (MIC.st === "rec") { micFinish(MIC.talk > 0); return; }
  if (MIC.st !== "idle") return;
  if (T.on) stopTTS();
  MIC.st = "rec"; MIC.f = f; MIC.buf = []; MIC.talk = 0; MIC.quiet = 0; micUi(f, true); micHeard(f, "Sedang mendengarkan…", true);
  var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(); MIC.ctx = ctx;
  try { ctx.resume(); } catch (e) {}
  navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (stream) {
    if (MIC.st !== "rec" || MIC.ctx !== ctx) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
    MIC.stream = stream; MIC.rate = ctx.sampleRate; MIC.t0 = Date.now();
    var src = ctx.createMediaStreamSource(stream), node = ctx.createScriptProcessor(4096, 1, 1); MIC.src = src; MIC.node = node;
    node.onaudioprocess = function (e) {
      if (MIC.st !== "rec") return;
      var d = e.inputBuffer.getChannelData(0); MIC.buf.push(new Float32Array(d));
      var sum = 0; for (var i = 0; i < d.length; i += 4) sum += d[i] * d[i]; var rms = Math.sqrt(sum / (d.length / 4));
      if (rms > 0.025) { MIC.talk++; MIC.quiet = 0; } else if (MIC.talk) MIC.quiet += d.length / MIC.rate;
    };
    src.connect(node); node.connect(ctx.destination);
    MIC.timer = setInterval(function () {
      if (MIC.st !== "rec") return;
      var el = (Date.now() - MIC.t0) / 1000;
      if (MIC.talk >= 3 && MIC.quiet > 1.2) micFinish(true);
      else if (el > 9) micFinish(MIC.talk > 0);
      else if (!MIC.talk && el > 5) micFinish(false);
    }, 150);
  }).catch(function (e) {
    micRelease(); micUi(f, false); MIC.st = "idle";
    micHeard(f, e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "Izinkan mikrofon untuk mencari dengan suara" : "Mikrofon tidak bisa dipakai");
  });
}
if (MIC_OK) Array.prototype.forEach.call(document.querySelectorAll(".finder"), function (f) {
  var btn = f.querySelector(".fmic"); btn.hidden = false;
  btn.onclick = function () { micStart(f); };
});
document.addEventListener("visibilitychange", function () { if (document.hidden && MIC.st === "rec") { micRelease(); micUi(MIC.f, false); MIC.st = "idle"; } });  FIND.b = (function () { var l = lsGet("evo.last", null); return l && BOOKS[l.b] ? l.b : 0; })();
syncFinders();

/* ---------- scroll shadow ---------- */
window.addEventListener("scroll", function () { Array.prototype.forEach.call(document.querySelectorAll("#vHome .bar"), function (b) { b.classList.toggle("line", window.scrollY > 8); }); }, { passive: true });

/* ---------- pasang ke layar utama ---------- */
var deferred = null;
function isStandalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true; }
function isIOS() { return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
var SHARE_I = '<svg class="shareic" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 15V3M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>';
function renderInstall() {
  var el = $("install"); if (!el) return;
  var no = lsGet("evo.noinst", 0), android = /android/i.test(navigator.userAgent), ios = isIOS();
  if (location.protocol === "file:" || isStandalone() || lsGet("evo.installed", 0) || !(android || ios || deferred)) { el.hidden = true; return; }
  var inner;
  if (deferred) inner = "<p>Ikon EvoBible akan muncul di layar HP seperti aplikasi lain. Sekali ketuk, langsung terbuka.</p><div class=\"acts\"><button class=\"btn pri\" data-inst=\"go\">Pasang sekarang</button></div>";
  else if (ios) inner = "<ol><li>Ketuk tombol Bagikan " + SHARE_I + " di bagian bawah layar Safari.</li><li>Geser ke bawah, ketuk <b>Tambah ke Layar Utama</b>.</li><li>Ketuk <b>Tambah</b> di pojok kanan atas.</li></ol>";
  else inner = "<ol><li>Ketuk tombol menu (tiga titik) di pojok kanan atas peramban.</li><li>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li><li>Ketuk <b>Instal</b> atau <b>Tambah</b>.</li></ol>";
  el.innerHTML = "<h2>Pasang EvoBible di layar utama</h2>" + inner; el.hidden = false;
}
window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; renderInstall(); });
window.addEventListener("appinstalled", function () { deferred = null; lsSet("evo.installed", 1); renderInstall(); });
$("install").addEventListener("click", function (e) {
  var t = e.target.closest("[data-inst]"); if (!t) return;
  if (t.dataset.inst === "later") { lsSet("evo.noinst", Date.now()); $("install").hidden = true; return; }
  if (deferred) { deferred.prompt(); deferred.userChoice.then(function (c) { if (c && c.outcome === "accepted") lsSet("evo.installed", 1); deferred = null; renderInstall(); }); }
});
