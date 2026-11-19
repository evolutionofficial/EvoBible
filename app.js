"use strict";
var API = "https://ddydxagduxhzzsrlwgkd.supabase.co/functions/v1/cari";
function rid() { var a = new Uint8Array(12); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
var devId = lsGet("evo.dev", null); if (!devId) { devId = rid(); lsSet("evo.dev", devId); }
var CRISIS = /(bunuh diri|mengakhiri hidup|akhiri hidup|ingin mati|pengen mati|mau mati|lebih baik mati|tidak ingin hidup|nggak ingin hidup|tidak mau hidup|ga mau hidup|menyakiti diri|melukai diri|mengakhiri semuanya)/i;
function aiKey(q) { return q.toLowerCase().replace(/\s+/g, " ").trim(); }
function careCard() {
  return '<div class="care"><b>Anda tidak sendirian</b><p>Jika Anda sedang berpikir untuk menyakiti diri atau mengakhiri hidup, mohon bicara dengan seseorang sekarang: keluarga, sahabat, atau pendeta yang Anda percaya.</p><p>Layanan Healing119 dari Kementerian Kesehatan: telepon 119 ext. 8, atau chat lewat healing119.id. Jika sibuk, coba lagi sebentar lagi.</p><div class="acts"><a class="btn pri" href="tel:119">Telepon 119</a><a class="btn sec" href="https://healing119.id" target="_blank" rel="noopener">Buka healing119.id</a></div></div>';
}
function renderIfCurrent(key) { if (S.view === "search" && !S.theme && S.mode === "tema" && aiKey(S.q) === key) renderSearch(); }
/* ---------- sesi renungan: 3x sehari (pagi 05-11:59, siang 12-16:59, malam 17-04:59) ---------- */
// MODE UJI: true = kotak cerita selalu muncul & bisa dipakai berkali-kali (tanpa batas 3 sesi/hari). Ubah ke false untuk mengaktifkan batas lagi.
var TEST_NO_LIMIT = true;
var SES = [{ k: "pagi", n: "Pagi", a: 5, b: 12 }, { k: "siang", n: "Siang", a: 12, b: 17 }, { k: "malam", n: "Malam", a: 17, b: 29 }];
function sesNow() {
  var d = new Date(), h = d.getHours(), hh = h < 5 ? h + 24 : h, s = SES[0];
  for (var i = 0; i < SES.length; i++) if (hh >= SES[i].a && hh < SES[i].b) s = SES[i];
  var x = new Date(d.getTime() - 5 * 36e5);
  return { s: s, day: x.getFullYear() + "-" + ("0" + (x.getMonth() + 1)).slice(-2) + "-" + ("0" + x.getDate()).slice(-2) };
}
function sesLog() { var n = sesNow(), L = lsGet("evo.ses", null); if (!L || L.day !== n.day || !L.s) L = { day: n.day, s: {} }; return L; }
function sesUsed() { return sesLog().s[sesNow().s.k] || null; }
function sesAllowed(q) { if (TEST_NO_LIMIT) return true; var u = sesUsed(); return !u || u.key === aiKey(q); }
function sesMark(q) { var n = sesNow(), L = sesLog(), e = L.s[n.s.k]; if (!e || (TEST_NO_LIMIT && e.key !== aiKey(q))) { L.s[n.s.k] = { q: q.trim(), key: aiKey(q), ids: [] }; lsSet("evo.ses", L); } }
function sesSetIds(key, ids, force) { var n = sesNow(), L = sesLog(), e = L.s[n.s.k]; if (e && e.key === key && (force || !e.ids.length) && ids.length && e.ids.join() !== ids.slice(0, 5).join()) { e.ids = ids.slice(0, 5); lsSet("evo.ses", L); } }
function sesNextText() { if (TEST_NO_LIMIT) return "Tulis cerita lain kapan saja untuk renungan dan doa yang baru"; var k = sesNow().s.k; return k === "pagi" ? "Sesi siang dibuka pukul 12.00" : k === "siang" ? "Sesi malam dibuka pukul 17.00" : "Sesi pagi dibuka besok pukul 05.00"; }
function histHtml() {
  var L = sesLog(), h = "";
  SES.forEach(function (s) {
    var e = L.s[s.k]; if (!e) return;
    h += "<h3>" + s.n + " · “" + esc(e.q) + "”</h3>";
    if (e.pr) h += '<p class="hint"><b>' + esc(e.pr.judul) + "</b></p>";
    if (!e.ids.length) h += '<p class="hint">Belum ada ayat tersimpan untuk sesi ini.</p>';
    e.ids.forEach(function (id, i) { h += card(id, { label: i ? "Terkait" : "Rekomendasi", k: "iman" }, null); });
  });
  return h || '<p class="hint">Belum ada renungan hari ini.</p>';
}
function histPart() { return sesNow().s.k === "malam" ? '<button class="btn sec histbtn" type="button" data-act="hist">Riwayat hari ini</button><div class="hist" id="histBox"' + (S.histOpen ? "" : " hidden") + ">" + histHtml() + "</div>" : ""; }
/* ---------- Evo Prayer: satu ayat, satu renungan, satu doa ---------- */
var API_DOA = "https://ddydxagduxhzzsrlwgkd.supabase.co/functions/v1/doa";
var SES_Q = { pagi: ["Apa rencanamu hari ini?", "Ceritakan rencanamu hari ini"], siang: ["Apa yang sedang atau sudah kau perjuangkan?", "Ceritakan perjuanganmu hari ini"], malam: ["Bagaimana harimu?", "Ceritakan harimu"] };
var SES_N = { pagi: "pagi", siang: "siang", malam: "malam" };
var CROSS = "Demi nama Bapa, dan Putra, dan Roh Kudus. Amin.";
function sesSetPrayer(key, pr) { var n = sesNow(), L = sesLog(), e = L.s[n.s.k]; if (e && e.key === key) { e.pr = pr; lsSet("evo.ses", L); } }
function runPrayer(q, cands) {
  var key = aiKey(q), tr = settings.cal === "katolik" ? "katolik" : "protestan", se = sesUsed();
  if (se && se.key === key && se.pr) { S.pr = { q: key, state: "done", data: se.pr }; return; }
  if (navigator.onLine === false) { S.pr = { q: key, state: "off" }; return; }
  S.pr = { q: key, state: "wait" };
  var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 50000);
  function fail(why) { clearTimeout(to); if (S.pr && S.pr.q === key) { S.pr = { q: key, state: "fail", why: why }; renderIfCurrent(key); } }
  fetch(API_DOA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: q.slice(0, 500), ids: cands.slice(0, 40), d: devId, t: tr, s: sesNow().s.k }), signal: ctl.signal })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      clearTimeout(to);
      if (!(S.pr && S.pr.q === key)) return;
      if (j && j.ok && j.id >= 0 && j.id < texts.length && j.doa) { S.pr = { q: key, state: "done", data: j }; sesSetPrayer(key, j); renderIfCurrent(key); }
      else fail(j && j.sebab);
    }, function () { fail("jaringan"); });
}
function paras(t) { return String(t || "").split(/\n+/).filter(function (x) { return x.trim(); }).map(function (x) { return "<p>" + esc(x.trim()) + "</p>"; }).join(""); }
function prayerOnly(p) { return (p.tradisi === "katolik" ? CROSS + "\n\n" : "") + p.doa + (p.penutup ? "\n" + p.penutup : ""); }
function prayerText(p) { return p.judul + "\n\n“" + clean(texts[p.id]) + "”\n(" + refOf(p.id) + ", AYT)\n\n" + (p.makna ? p.makna + "\n\n" : "") + p.renungan + "\n\n" + (p.judul_doa || "Doa") + "\n" + prayerOnly(p) +"\n\n— Evo Bible"; }
function journal() { var J = lsGet("evo.jurnal", []); return Array.isArray(J) ? J : []; }
function journalHas(p) { return journal().some(function (e) { return e.p && e.p.id === p.id && e.p.judul === p.judul && e.p.doa === p.doa; }); }
function prayerBody(p) {
  var id = p.id, h = "";
  h += '<div class="pr-verse"><p class="vt">' + esc(clean(texts[id])) + '</p><div class="vr">' + esc(refOf(id)) + " (AYT)</div></div>";
  if (p.makna) h += '<div class="pr-sec"><h3>Makna ayat</h3>' + paras(p.makna) + "</div>";
  h += '<div class="pr-sec"><h3>Renungan</h3>' + paras(p.renungan) + "</div>";
  h += '<div class="pr-sec pr-doa"><h3>Doa yang disusun</h3>' + (p.judul_doa ? '<h4 class="pr-dtitle">' + esc(p.judul_doa) + "</h4>" : "");
  if (p.tradisi === "katolik") h += '<div class="pr-cross"><small>Buatlah Tanda Salib sambil mengucapkan:</small><p>' + CROSS + "</p></div>";
  h += paras(p.doa) + (p.penutup ? '<p class="pr-end">' + esc(p.penutup) + "</p>" : "") + "</div>";
  return h;
}
function prayerHtml(p, q) {
  var h = '<article class="pray"><div class="pr-kicker">Evo Prayer · Renungan ' + (SES_N[p.sesi] || "") + '</div><h2 class="pr-title">' + esc(p.judul) + "</h2>" + (q ? '<div class="pr-story"><small>Cerita saya</small><p>“' + esc(q) + '”</p></div>' : "");
  h += prayerBody(p).replace('(AYT)</div></div>', '(AYT)</div><button class="txtbtn" type="button" data-act="prread" data-id="' + p.id + '">Baca pasalnya</button><button class="txtbtn" type="button" data-act="primg" data-id="' + p.id + '">Buat gambar</button></div>');
  h += '<div class="pr-acts"><button class="btn pri" type="button" data-act="prcopy">Salin doa</button><button class="btn sec" type="button" data-act="prshare">Bagikan</button><button class="btn sec" type="button" data-act="prsave">' + (journalHas(p) ? "Tersimpan di Jurnal Doa" : "Simpan ke Jurnal Doa") + "</button></div>";
  h += '<p class="pr-note">Doa ini disusun AI untuk membantu Anda menemukan kata-kata, bukan pesan langsung dari Tuhan. Silakan ubah, lewati, atau berdoa dengan kata-kata Anda sendiri.</p></article>';
  return h;
}
function runAI(q, cands) {
  var key = aiKey(q), cache = lsGet("evo.ai", {}), hit = cache[key];
  if (hit && Date.now() - hit.t < 6048e5) { S.ai = { q: key, state: "done", data: hit.d }; return; }
  if (navigator.onLine === false) { S.ai = { q: key, state: "off" }; return; }
  S.ai = { q: key, state: "wait" };
  var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 7000);
  function fail(why) { clearTimeout(to); if (S.ai && S.ai.q === key) { S.ai = { q: key, state: "fail", why: why }; renderIfCurrent(key); } }
  fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: q.slice(0, 240), ids: cands.slice(0, 40), d: devId }), signal: ctl.signal })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      clearTimeout(to);
      if (!(S.ai && S.ai.q === key)) return;
      if (j && j.ok && j.pilihan && j.pilihan.length) {
        S.ai = { q: key, state: "done", data: j };
        cache[key] = { t: Date.now(), d: j };
        var ks = Object.keys(cache); if (ks.length > 20) { ks.sort(function (a, b) { return cache[a].t - cache[b].t; }); delete cache[ks[0]]; }
        lsSet("evo.ai", cache); renderIfCurrent(key);
      } else fail(j && j.sebab);
    }, function () { fail("jaringan"); });
}

/* ---------- settings ---------- */
function applySettings() {
  document.documentElement.style.setProperty("--fs-read", settings.fs + "px");
  $("fsOut").textContent = settings.fs;
  if (settings.theme === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", settings.theme);
  Array.prototype.forEach.call($("themeSeg").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.t === settings.theme)); });
  syncSeasonUI(); applySeason();
}
$("fsDown").onclick = function () { settings.fs = Math.max(14, settings.fs - 1); lsSet("evo.set", settings); applySettings(); };
$("fsUp").onclick = function () { settings.fs = Math.min(30, settings.fs + 1); lsSet("evo.set", settings); applySettings(); };
$("themeSeg").onclick = function (e) { var t = e.target.dataset && e.target.dataset.t; if (!t) return; settings.theme = t; lsSet("evo.set", settings); applySettings(); };

/* ---------- sheets ---------- */
function show(id) { hide(); if (id === "shSeason") drCancelClose(); $(id).hidden = false; openSheet = id; }
function hide() { ["shBooks", "shVer", "shSet", "shVoice", "shCat", "shSeason", "shTrad", "shExit", "shTts"].forEach(function (i) { if (i === "shSeason" && drClose()) return; $(i).hidden = true; }); openSheet = null; }
document.addEventListener("click", function (e) {
  if (e.target.closest("[data-close]")) hide(); else if (e.target.classList && e.target.classList.contains("scrim")) hide();
});
$("btnSet2").onclick = function () { show("shSet"); };

/* ---------- routing ---------- */
var VIEWS = { home: "vHome", search: "vSearch", read: "vRead", saved: "vSaved", church: "vChurch", more: "vMore", hymn: "vHymn", kisah: "vKisah", about: "vAbout" };
var NAMES = { home: "beranda", search: "cari", kata: "kata", read: "baca", saved: "tersimpan", church: "gereja", more: "lainnya", hymn: "nyanyian", kisah: "kisah", about: "tentang" };
function go(v) { var h = NAMES[v]; if (location.hash.slice(1) === h) route(); else if (NAV_REPLACE) { curHash = "#" + h; history.replaceState(history.state, "", curHash); route(); } else location.hash = h; }
function openRef(b, c, v, v2) { var h = BOOKS[b].a + "-" + c + (v ? "-" + v + (v2 && v2 >= v ? "-" + v2 : "") : ""); if (location.hash.slice(1) === h) route(); else if (NAV_REPLACE) { curHash = "#" + h; history.replaceState(history.state, "", curHash); route(); } else location.hash = h; }
function showView(v, tabV) {
  if (typeof tbHide === "function" && v !== "read") tbHide(false);
  S.view = v; tabV = tabV || v;
  Object.keys(VIEWS).forEach(function (k) { $(VIEWS[k]).hidden = k !== v; });
  Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) { if (t.dataset.v === tabV) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current"); }); placeInd(true);
  if (v !== "read") { clearSel(true); asStop(); }
  if (v !== "kisah") ksStop();
}
function route() {
  if (openSheet !== "shVoice") hide();
  var h = decodeURIComponent(location.hash.slice(1)), m = /^([A-Za-z0-9]+)-(\d+)(?:-(\d+)(?:-(\d+))?)?$/.exec(h);
  if (m) {
    for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].a === m[1]) {
      var c = Math.min(Math.max(1, +m[2]), BOOKS[i].ch.length), v = m[3] ? Math.min(+m[3], BOOKS[i].ch[c - 1].v.length) : 0;
      showView("read"); renderChapter(i, c, v, m[4] ? Math.min(+m[4], BOOKS[i].ch[c - 1].v.length) : 0); return;
    }
  }
  if (h === "cari") { setSearchTab("tema"); showView("search"); renderSearch(); window.scrollTo(0, 0); return; }
  if (h === "kata") { setSearchTab("kata"); showView("search", "kata"); renderSearch(); window.scrollTo(0, 0); return; }
  if (h === "gereja" && FEATURE_CHURCH) { showView("church"); renderChurch(); window.scrollTo(0, 0); return; }
  if (h === "tersimpan" || h === "sorotan") { showView("saved", "more"); renderSaved(); window.scrollTo(0, 0); return; }
  if (h === "kisah" || h.indexOf("kisah/") === 0) { var kp = h.split("/"); showView("kisah", "more"); renderKisah(kp[1] || "", kp[2] || ""); return; }
  if (h === "tentang") { showView("about", "more"); window.scrollTo(0, 0); return; }
  if (h === "lainnya") { showView("more"); renderMore(); window.scrollTo(0, 0); return; }
  if (h === "nyanyian" || h.indexOf("nyanyian/") === 0) { var hp = h.split("/"); showView("hymn", "more"); renderHymn(hp[1] || "", hp[2] || ""); return; }
  if (h === "baca") { var last = lsGet("evo.last", { b: 0, c: 1 }); if (!BOOKS[last.b] || !BOOKS[last.b].ch[last.c - 1]) last = { b: 0, c: 1 }; showView("read"); renderChapter(last.b, last.c, 0); return; }
  showView("home"); renderHome(); window.scrollTo(0, 0);
}
window.addEventListener("hashchange", function () { if (NAV_REPLACE) return; if (SKIP_H && location.hash === SKIP_H) { SKIP_H = null; return; } SKIP_H = null; route(); });
/* Ketuk tab yang sedang aktif saat halaman sudah digulir → meluncur cepat ke atas (bukan lompat). */
var TOP = { raf: 0 };
function topStop() { if (TOP.raf) { cancelAnimationFrame(TOP.raf); TOP.raf = 0; } }
function smoothTop() {
  topStop();
  var y0 = scrollY; if (y0 <= 0) return;
  var rm = false; try { rm = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
  if (rm) { window.scrollTo(0, 0); return; }
  var dur = Math.max(320, Math.min(700, 260 + y0 * 0.12)), t0 = 0;
  if (AS && AS.on) AS.hold = performance.now() + dur + 1500;
  TOP.raf = requestAnimationFrame(function step(ts) {
    if (!t0) t0 = ts;
    var k = Math.min(1, (ts - t0) / dur), e = 1 - Math.pow(1 - k, 3);
    window.scrollTo(0, Math.round(y0 * (1 - e)));
    TOP.raf = k < 1 ? requestAnimationFrame(step) : 0;
  });
}
["touchstart", "wheel"].forEach(function (ev) { addEventListener(ev, function (e) { if (TOP.raf && !(e.target.closest && e.target.closest("#tabs"))) topStop(); }, { passive: true }); });
var TD = { eat: 0, p: null };
var TAB_ROOT = { home: "home", read: "read", search: "search", kata: "search", more: "more", church: "church" };
$("tabs").onclick = function (e) {
  var t = e.target.closest(".tab"); if (!t) return;
  if (TD.eat > performance.now()) return;
  tabTap(t);
};
function tabTap(t) {
  var root = TAB_ROOT[t.dataset.v];
  if (t.getAttribute("aria-current") === "page" && S.view === root && !(root === "search" && S.theme) && scrollY > 2) { smoothTop(); return; }
  topStop(); go(t.dataset.v);
}

/* ---------- beranda ---------- */
function greeting() { var h = new Date().getHours(); return h < 4 ? "Selamat malam" : h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam"; }
var votdIds = null;
function votdId() {
  if (!votdIds) { var seen = {}; votdIds = []; eng.clusters.forEach(function (c) { c.a.forEach(function (id) { if (!seen[id] && clean(texts[id]).length <= 230 && texts[id].length > 30) { seen[id] = 1; votdIds.push(id); } }); }); votdIds.sort(function (a, b) { return a - b; }); }
  var d = new Date(), day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
  return votdIds[(day * 97) % votdIds.length];
}
function themeOfVerse(id) { for (var i = 0; i < eng.clusters.length; i++) if (eng.clusters[i].a.indexOf(id) >= 0) return eng.clusters[i]; return null; }
function groupKeys(g) { return g[3].split(" ").filter(function (k) { return CLM[k]; }); }
function renderCats() {
  $("cats").innerHTML = GROUPS.map(function (g, n) {
    return '<button class="cat" style="--h:' + g[1] + '" data-cat="' + n + '"><b>' + esc(g[0]) + "</b><small>" + esc(g[2]) + "</small></button>";
  }).join("");
}
function openCat(n) {
  var g = GROUPS[n];
  $("hCat").textContent = g[0]; $("catSub").textContent = g[2];
  $("catList").innerHTML = groupKeys(g).map(function (k) {
    var c = CLM[k];
    return '<button class="tile" style="--h:' + g[1] + '" data-tema="' + k + '"><b>' + esc(c.n) + "</b><small>" + c.a.length + " ayat kunci</small></button>";
  }).join("");
  show("shCat");
}
$("catList").addEventListener("click", function (e) { var t = e.target.closest("[data-tema]"); if (t) { hide(); openTheme(t.dataset.tema); } });
function renderHome() {
  $("greet").textContent = greeting();
  var id = votdId(), th = themeOfVerse(id);
  $("votd").innerHTML = '<div class="lab">Ayat hari ini' + (th ? " · " + esc(th.n) : "") + '</div><p class="vt">' + esc(clean(texts[id])) + '</p><div class="vr">' + esc(refOf(id)) + '</div><div class="acts icons"><button data-act="read" data-id="' + id + '" aria-label="Baca pasalnya" title="Baca pasalnya"><svg class="ico" viewBox="0 0 24 24"><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/></svg></button><button data-act="copy" data-id="' + id + '" aria-label="Salin" title="Salin"><svg class="ico" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg></button><button data-mkimg="1" aria-label="Buat gambar" title="Buat gambar"><svg class="ico" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg></button></div>' + (activeSeasonId() ? '<div class="orn">' + ornSvg(activeSeasonId()) + "</div>" : "");
  var kg = settings.cal === "katolik" ? katToday() : null;
  if (kg) { $("votd").innerHTML = katVotd(kg) + (activeSeasonId() ? '<div class="orn">' + ornSvg(activeSeasonId()) + "</div>" : ""); $("votd").dataset.kat = "1"; } else delete $("votd").dataset.kat;
  var last = lsGet("evo.last", null), cont = $("cont");
  var ok = last && BOOKS[last.b] && BOOKS[last.b].ch[last.c - 1];
  if (!ok) last = { b: 0, c: 1 };
  cont.dataset.b = last.b; cont.dataset.c = last.c;
  kisahHome();
  cont.innerHTML = '<svg class="ico" viewBox="0 0 24 24" style="color:var(--accent)"><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/></svg><span class="t"><small>' + (ok ? "Lanjutkan membaca" : "Mulai membaca") + '</small><b>' + esc(BOOKS[last.b].n) + " " + last.c + "</b></span>";
  renderFeel(); renderCats(); renderBanner();
  renderInstall();
}
function renderFeel() {
  var u = sesUsed(), n = sesNow(), box = $("feelDone"), sq = SES_Q[n.s.k];
  $("feelH").textContent = sq[0]; $("hq").placeholder = sq[1];
  $("homeForm").hidden = !!u && !TEST_NO_LIMIT; $("feelSub").hidden = !!u && !TEST_NO_LIMIT;
  if (!u) { box.hidden = true; box.innerHTML = ""; return; }
  var h = '<p class="sub">Renungan ' + n.s.n.toLowerCase() + " Anda: “" + esc(u.q) + "”</p>";
  if (u.pr) h += '<div class="lab">Evo Prayer</div><h3 class="fd-title">' + esc(u.pr.judul) + "</h3>";
  if (u.ids.length) { var id = u.ids[0]; h += (u.pr ? "" : '<div class="lab">Rekomendasi untuk Anda</div>') + '<p class="vt">' + esc(clean(texts[id])) + '</p><div class="vr">' + esc(refOf(id)) + "</div>"; }
  h += '<div class="acts"><button class="btn pri" type="button" data-ses="open">' + (u.pr ? "Buka renungan dan doa" : u.ids.length > 1 ? "Lihat " + (u.ids.length - 1) + " ayat yang berhubungan" : "Lihat renungan") + "</button>";
  if (n.s.k === "malam") h += '<button class="btn sec" type="button" data-ses="hist">Riwayat hari ini</button>';
  h += '</div><p class="note">' + esc(sesNextText()) + (TEST_NO_LIMIT ? ".</p>" : ". Renungan bisa dipakai tiga kali sehari: pagi, siang, dan malam.</p>");
  box.innerHTML = h; box.hidden = false;
}
setInterval(function () { if (S.view === "home" && !document.hidden) renderFeel(); }, 60000);
document.addEventListener("visibilitychange", function () { if (!document.hidden && S.view === "home") renderFeel(); });
$("homeForm").onsubmit = function (e) { e.preventDefault(); var q = $("hq").value.trim(); if (!q) return; $("hq").blur(); if (!parseRef(q) && !CRISIS.test(q) && !sesAllowed(q)) { renderFeel(); return; } $("hq").value = ""; S.histOpen = false; startSearch(q); };
$("vHome").addEventListener("click", function (e) {
  var t;
  if ((t = e.target.closest("[data-mkimg]"))) { var vb = $("votd"), vt = vb.querySelector(".vt"), vr = vb.querySelector(".vr"); if (window.EvoGambar) EvoGambar.open({ text: vt ? vt.textContent : "", ref: vr ? vr.textContent : "", toast: toast }); return; }
  if ((t = e.target.closest("[data-ses]"))) { var su = sesUsed(); if (su) { S.histOpen = t.dataset.ses === "hist"; startSearch(su.q); } return; }
  if ((t = e.target.closest("[data-kat]"))) { var kg = katToday(); if (!kg) return; if (t.dataset.kat === "copy") copyText(katText(kg, 0) + "\n\n" + kg.label + " (AYT)"); else openRef(kg.b, kg.c, kg.v1, kg.v2); return; }
  if ((t = e.target.closest("[data-cat]"))) { openCat(+t.dataset.cat); return; }
  if ((t = e.target.closest("[data-tema]"))) { openTheme(t.dataset.tema); return; }
  if ((t = e.target.closest("[data-act]"))) { var id = +t.dataset.id; if (t.dataset.act === "copy") copyText(verseCopy(id)); else openRef(bOf[id], cOf[id], vOf[id]); return; }
  if (e.target.closest("#cont")) { var c = $("cont"); openRef(+c.dataset.b, +c.dataset.c, 0); }
});

/* ---------- cari ---------- */
function startSearch(q) { S.q = q; S.sub = true; S.theme = null; S.mode = "tema"; S.ai = null; S.pr = null; S.pendingAI = true; $("q").value = q; syncMode(); pushRecent(q); go("search"); }
function openTheme(k) { S.theme = k; S.moreOpen = false; go("search"); }
function pushRecent(q) { q = q.trim(); if (q.length < 3) return; recent = [q].concat(recent.filter(function (x) { return x !== q; })).slice(0, 6); lsSet("evo.recent", recent); }
// Tab Renungan (cerita & doa) dan tab Cari (kata persis) memakai tampilan yang sama, dengan kotak isian masing-masing.
S.qs = { tema: "", kata: "" };
function setSearchTab(m) {
  if (S.mode !== m) { S.qs[S.mode] = S.q; S.q = S.qs[m] || ""; $("q").value = S.q; S.theme = null; S.pendingAI = false; }
  S.mode = m;
  $("mode").parentNode.hidden = true;
  $("q").placeholder = m === "kata" ? "gembala, kasih setia, Yoh 3:16" : "Hari ini aku merasa…";
  $("q").setAttribute("aria-label", m === "kata" ? "Cari kata persis" : "Ceritakan isi hatimu");
  $("sGo").innerHTML = m === "kata" ? S_LOUPE : S_CROSS; $("sGo").setAttribute("aria-label", m === "kata" ? "Cari" : "Renungan");
  sHeroSync();
}
/* ---------- panggung tab Renungan & Cari ---------- */
var S_CROSS = '<svg class="ico" viewBox="0 0 24 24"><path class="x-sh" d="M12 3.5v17M6.8 8.6h10.4" transform="translate(0 1.1)"/><path class="x-hi" d="M12 3.5v17M6.8 8.6h10.4" transform="translate(0 -.7)"/><path d="M12 3.5v17M6.8 8.6h10.4"/></svg>', S_LOUPE = '<svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>';
var SG_TEMA = [["Takut akan masa depan", "aku takut menghadapi masa depan"], ["Sulit memaafkan", "bagaimana cara memaafkan orang yang menyakitiku"], ["Kehilangan", "sedih ditinggal orang tersayang"], ["Doa belum dijawab", "tuhan kenapa doaku tidak dijawab"], ["Merasa tak berharga", "merasa tidak berharga"], ["Ingin dekat Tuhan", "ingin lebih dekat dengan Tuhan"], ["Lelah", "aku lelah dan letih"]];
var SG_KATA = ["gembala", "kasih setia", "air hidup", "damai sejahtera", "terang", "Mzm 23"];
function sHeroSync() {
  var kata = S.mode === "kata", v = $("vSearch");
  v.classList.toggle("has", !!(S.sub && S.q.trim()) || !!S.theme); v.classList.toggle("kata", kata);
  $("sForm").classList.toggle("ai", !kata);
  $("sTitle").textContent = kata ? "Cari di Alkitab" : "Renungan " + sesNow().s.n.toLowerCase();
  $("sSub").textContent = kata ? "Temukan kembali ayat dari kata yang kamu ingat." : "Ceritakan apa yang sedang kamu rasakan. Firman Tuhan menyertaimu.";
  var list = kata ? SG_KATA.map(function (k) { return [k, k]; }) : SG_TEMA;
  $("sChips").innerHTML = list.map(function (x) { return '<button type="button" class="schip" data-q="' + esc(x[1]) + '">' + esc(x[0]) + "</button>"; }).join("");
}
$("sChips").onclick = function (e) {
  var t = e.target.closest("[data-q]"); if (!t) return;
  S.q = t.dataset.q; $("q").value = S.q; S.sub = true; S.theme = null; S.ai = null; S.pr = null; S.pendingAI = S.mode === "tema"; renderSearch(); window.scrollTo(0, 0);
};
$("q").addEventListener("keydown", function (e) {
  if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); if ($("sForm").requestSubmit) $("sForm").requestSubmit(); else $("sForm").dispatchEvent(new Event("submit", { cancelable: true })); }
});
function syncMode() { Array.prototype.forEach.call($("mode").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.m === S.mode)); }); $("qclr").hidden = !$("q").value; }
$("mode").onclick = function (e) { var m = e.target.dataset && e.target.dataset.m; if (!m) return; S.mode = m; S.theme = null; S.pendingAI = false; syncMode(); renderSearch(); };
var qT;
$("q").addEventListener("input", function () { S.q = $("q").value; S.ai = null; S.pendingAI = false; syncMode(); if (!S.q.trim() && S.sub) { S.sub = false; S.theme = null; renderSearch(); } });
$("sForm").onsubmit = function (e) { e.preventDefault(); S.q = $("q").value; if (!S.q.trim()) return; $("q").blur(); S.sub = true; S.theme = null; window.scrollTo(0, 0); S.ai = null; S.pr = null; S.pendingAI = S.mode === "tema"; renderSearch(); };
$("qclr").onclick = function () { $("q").value = ""; S.q = ""; S.sub = false; S.theme = null; syncMode(); renderSearch(); };

function parseRef(q) {
  var m = /^\s*([1-3]?\s*[a-zA-Z][a-zA-Z.\s-]*?)\s*(\d+)(?:\s*[:.\s]\s*(\d+))?\s*$/.exec(q);
  if (!m) return null;
  function norm(s) { return s.toLowerCase().replace(/[.\s]+/g, ""); }
  var key = norm(m[1]), hit = -1, i;
  if (key.length < 2) return null;
  for (i = 0; i < BOOKS.length && hit < 0; i++) if (norm(BOOKS[i].a) === key || norm(BOOKS[i].n) === key) hit = i;
  for (i = 0; i < BOOKS.length && hit < 0; i++) if (norm(BOOKS[i].n).indexOf(key) === 0) hit = i;
  if (hit < 0) return null;
  var c = +m[2]; if (c < 1 || c > BOOKS[hit].ch.length) return null;
  var v = m[3] ? +m[3] : 0; if (v && v > BOOKS[hit].ch[c - 1].v.length) v = 0;
  return { b: hit, c: c, v: v };
}
function termRegex(q) {
  var info = eng.parse(q), set = {};
  info.forEach(function (t) { set[t.w] = 1; if (t.s >= 0 && ED.vocab[t.s].length >= 4) set[ED.vocab[t.s]] = 1; });
  var arr = Object.keys(set).filter(function (w) { return w.length >= 3; }).sort(function (a, b) { return b.length - a.length; }).map(function (w) { return w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); });
  return arr.length ? new RegExp("(" + arr.join("|") + ")", "gi") : null;
}
function hilite(t, re) { var s = clean(t); if (!re) return esc(s); var out = "", last = 0, m; re.lastIndex = 0; while ((m = re.exec(s))) { if (!m[0]) { re.lastIndex++; continue; } out += esc(s.slice(last, m.index)) + "<mark>" + esc(m[0]) + "</mark>"; last = m.index + m[0].length; } return out + esc(s.slice(last)); }
var SAVE_I = '<svg class="ico" viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>';
var COPY_I = '<svg class="ico" viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/></svg>';
var GO_SPARK = '<svg class="ico" viewBox="0 0 24 24"><path d="M12 3c.6 4.3 2.7 6.4 7 7-4.3.6-6.4 2.7-7 7-.6-4.3-2.7-6.4-7-7 4.3-.6 6.4-2.7 7-7z"/><path d="M19 15.5c.25 1.6 1 2.35 2.5 2.5-1.5.25-2.25 1-2.5 2.5-.25-1.5-1-2.25-2.5-2.5 1.5-.15 2.25-.9 2.5-2.5z"/></svg>';
var IMG_I = '<svg class="ico" viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="8.5" cy="9.5" r="1.6"/><path d="M21 16l-5-5-8 8"/></svg>';
function imgVerse(id) { if (window.EvoGambar) EvoGambar.open({ text: clean(texts[id]), ref: refOf(id), toast: toast }); }
function card(id, why, re, alasan) {
  var w = why ? '<span class="why" style="--h:' + hueOf(why.k) + '">' + (why.label ? esc(why.label) : (why.a ? "Ayat kunci" : "Terkait") + " · " + esc(why.n)) + "</span>" : '<span class="why lexw">Mengandung kata Anda</span>';
  return '<div class="rcard" data-id="' + id + '" role="button" tabindex="0"><div class="rref">' + esc(refOf(id)) + '</div><div class="rtx">' + hilite(texts[id], re) + '</div>' + (alasan ? '<p class="alasan"><b>Mengapa cocok:</b> ' + esc(alasan) + "</p>" : "") + '<div class="rft">' + w +
    '<button class="mini-ib" data-act="img" aria-label="Buat gambar ayat">' + IMG_I + '</button><button class="mini-ib" data-act="copy" aria-label="Salin ayat">' + COPY_I + '</button><button class="mini-ib" data-act="save" aria-pressed="' + (!!hls[keyOf(id)]) + '" aria-label="Simpan ayat">' + SAVE_I + "</button></div></div>";
}
function renderSearch() {
  var body = $("sBody"), q = S.q.trim();
  syncMode(); sHeroSync();
  if (S.theme) return renderTheme(body);
  if (!S.sub || !q) { body.innerHTML = ""; return; }
  var html = "", ref = parseRef(q);
  if (ref) { html += '<button class="go" data-b="' + ref.b + '" data-c="' + ref.c + '" data-v="' + ref.v + '"><b>Buka ' + esc(BOOKS[ref.b].n + " " + ref.c + (ref.v ? ":" + ref.v : "")) + "</b>" + (ref.v ? "<span>" + esc(clean(BOOKS[ref.b].ch[ref.c - 1].v[ref.v - 1])) + "</span>" : "") + "</button>"; }
  var re = termRegex(q);
  if (S.mode === "tema") {
    if (q.length < 3) { body.innerHTML = html + '<p class="hint">Tulis minimal tiga huruf.</p>'; return; }
    if (!ref && !CRISIS.test(q) && !sesAllowed(q)) {
      var u0 = sesUsed();
      body.innerHTML = html + '<div class="empty">Anda sudah memakai renungan sesi ' + sesNow().s.n.toLowerCase() + " (“" + esc(u0.q) + "”). " + esc(sesNextText()) + '.</div><button class="btn pri histbtn" type="button" data-act="sesopen">Lihat renungan sesi ini</button>' + histPart();
      return;
    }
    var r = eng.search(q, { limit: 40 }), key = aiKey(q), crisis = CRISIS.test(q);
    var cands = r.results.map(function (x) { return x.id; });
    if (S.pendingAI) { S.pendingAI = false; if (!ref && !crisis && r.results.length) sesMark(q); if (!ref && !crisis && cands.length >= 3) runPrayer(q, cands); }
    var pr = S.pr && S.pr.q === key ? S.pr : null;
    if (crisis || (pr && pr.state === "done" && pr.data.krisis)) html += careCard();
    if (r.sel.length && !(pr && pr.state === "done")) html += '<div class="found">Cocok dengan tema: ' + r.sel.map(function (c) { return '<button class="tchip" style="--h:' + hueOf(c.k) + '" data-tema="' + c.k + '">' + esc(c.n) + "</button>"; }).join("") + "</div>";
    if (pr && pr.state === "wait") { body.innerHTML = html + '<div class="wait" role="status"><span class="dots"><i></i><i></i><i></i></span>Menyusun renungan dan doa untuk Anda…</div>'; return; }
    if (pr && pr.state === "done") {
      var mid = pr.data.id, rel = r.results.filter(function (x) { return x.id !== mid; }).slice(0, 4);
      html += prayerHtml(pr.data, q);
      if (rel.length) html += '<div class="mini">Ayat yang berhubungan</div>' + rel.map(function (x) { return card(x.id, x.why, re); }).join("");
      sesSetIds(key, [mid].concat(rel.map(function (x) { return x.id; })), true);
    } else if (!r.results.length) {
      html += '<div class="empty">Belum ada ayat yang cocok dengan “' + esc(q) + '”. Coba kata yang lebih umum, misalnya “takut”, “marah”, atau “keluarga”.</div>';
    } else {
      if (pr && pr.state === "fail" && pr.why === "batas") html += '<p class="hint">Penyusunan doa sedang penuh hari ini. Berikut ayat yang dipilih dari HP Anda.</p>';
      else if (pr && pr.state === "fail") html += '<p class="hint">Renungan dan doa belum bisa disusun. Berikut ayat yang dipilih dari HP Anda.</p><button class="btn pri histbtn" type="button" data-act="prretry">Coba susun doa lagi</button>';
      else if (pr && pr.state === "off") html += '<p class="hint">Sedang tanpa internet. Berikut ayat yang dipilih dari HP Anda.</p>';
      var top = r.results.slice(0, 5);
      html += '<div class="mini">Rekomendasi untuk Anda</div>' + card(top[0].id, top[0].why, re);
      if (top.length > 1) html += '<div class="mini">Ayat yang berhubungan</div>' + top.slice(1).map(function (x) { return card(x.id, x.why, re); }).join("");
      sesSetIds(key, top.map(function (x) { return x.id; }));
    }
    var se = sesUsed();
    if (se && se.key === key) html += '<p class="hint">' + esc(sesNextText()) + (TEST_NO_LIMIT ? ".</p>" : ". Satu renungan untuk setiap sesi: pagi, siang, dan malam.</p>") + histPart();
  } else {
    var terms = q.toLowerCase().split(/\s+/).filter(Boolean), res = [], total = 0;
    for (var i = 0; i < texts.length; i++) {
      var low = texts[i].toLowerCase(), ok = true;
      for (var k = 0; k < terms.length; k++) if (low.indexOf(terms[k]) < 0) { ok = false; break; }
      if (ok) { total++; if (res.length < 60) res.push(i); }
    }
    var re2 = new RegExp("(" + terms.map(function (t) { return t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }).join("|") + ")", "gi");
    if (total) html += '<div class="found">' + total.toLocaleString("id-ID") + " ayat mengandung semua kata" + (total > res.length ? ", menampilkan " + res.length + " pertama" : "") + "</div>";
    else if (!ref) html += '<div class="empty">Tidak ada ayat yang mengandung “' + esc(q) + "”.</div>";
    html += res.map(function (id) { var c = card(id, null, re2); return c.replace("Mengandung kata Anda", esc(BOOKS[bOf[id]].n)); }).join("");
  }
  body.innerHTML = html;
}
function renderTheme(body) {
  var c = CLM[S.theme], h = hueOf(c.k);
  var html = '<div class="thead"><button class="back" data-act="back"><svg class="ico" viewBox="0 0 24 24" style="width:16px;height:16px"><path d="m15 6-6 6 6 6"/></svg>Semua tema</button><h1>' + esc(c.n) + '</h1><p>' + c.a.length + " ayat kunci" + (c.x.length ? " dan " + Math.min(c.x.length, 25) + " ayat terkait" : "") + "</p></div>";
  var why = { k: c.k, n: c.n, a: 1 };
  html += c.a.map(function (id) { return card(id, why, null); }).join("");
  if (c.x.length) {
    if (!S.moreOpen) html += '<button class="more" data-act="more">Tampilkan ayat terkait</button>';
    else { var w2 = { k: c.k, n: c.n, a: 0 }; html += '<div class="mini">Ayat terkait</div>' + c.x.slice(0, 25).map(function (id) { return card(id, w2, null); }).join(""); }
  }
  body.innerHTML = html;
}
$("sBody").addEventListener("click", function (e) {
  var t;
  if ((t = e.target.closest("[data-act]")) && t.dataset.act === "back") { S.theme = null; go("home"); return; }
  if (t && t.dataset.act === "more") { S.moreOpen = true; renderSearch(); return; }
  if (t && t.dataset.act === "hist") { S.histOpen = !S.histOpen; var hb = $("histBox"); if (hb) hb.hidden = !S.histOpen; return; }
  if (t && t.dataset.act === "sesopen") { var su = sesUsed(); if (su) { S.q = su.q; $("q").value = su.q; S.theme = null; S.mode = "tema"; S.ai = null; S.pr = null; S.pendingAI = true; syncMode(); renderSearch(); window.scrollTo(0, 0); } return; }
  if (t && t.dataset.act === "prretry") { S.pr = null; S.pendingAI = true; renderSearch(); return; }
  if (t && t.dataset.act === "prread") { var pid = +t.dataset.id; openRef(bOf[pid], cOf[pid], vOf[pid]); return; }
  if (t && t.dataset.act === "primg") { imgVerse(+t.dataset.id); return; }
  if (t && /^pr(copy|share|save)$/.test(t.dataset.act)) {
    var p0 = S.pr && S.pr.state === "done" ? S.pr.data : null; if (!p0) return;
    if (t.dataset.act === "prcopy") copyText(prayerOnly(p0), "Doa disalin");
    else if (t.dataset.act === "prshare") { if (navigator.share) navigator.share({ title: p0.judul, text: prayerText(p0) }).catch(function () {}); else copyText(prayerText(p0), "Renungan dan doa disalin"); }
    else if (!journalHas(p0)) { var J = journal(); var je0 = { id: uuid(), t: Date.now(), q: S.q.trim(), p: p0 }; J.unshift(je0); lsSet("evo.jurnal", J.slice(0, 500)); cloudJr(je0); t.textContent = "Tersimpan di Jurnal Doa"; toast("Disimpan ke Jurnal Doa (Lainnya › Tersimpan)"); }
    return;
  }
  if (t && t.dataset.act === "img") { var ce = t.closest(".rcard"); if (ce) imgVerse(+ce.dataset.id); return; }
  if (t && (t.dataset.act === "copy" || t.dataset.act === "save")) {
    var cardEl = t.closest(".rcard"), id = +cardEl.dataset.id;
    if (t.dataset.act === "copy") copyText(verseCopy(id)); else toggleHl(id, t);
    return;
  }
  if ((t = e.target.closest("[data-q]"))) { S.q = t.dataset.q; $("q").value = S.q; S.sub = true; S.theme = null; S.ai = null; S.pr = null; S.pendingAI = S.mode === "tema"; pushRecent(S.q); renderSearch(); return; }
  if ((t = e.target.closest("[data-tema]"))) { S.theme = t.dataset.tema; S.moreOpen = false; renderSearch(); window.scrollTo(0, 0); return; }
  if ((t = e.target.closest(".go"))) { openRef(+t.dataset.b, +t.dataset.c, +t.dataset.v); return; }
  if ((t = e.target.closest(".rcard"))) { var i2 = +t.dataset.id; if (S.q) pushRecent(S.q); openRef(bOf[i2], cOf[i2], vOf[i2]); }
});
$("sBody").addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("rcard")) { e.preventDefault(); e.target.click(); } });
function toggleHl(id, btn) {
  var k = keyOf(id), on = !hls[k];
  if (on) hls[k] = 1; else delete hls[k];
  lsSet("evo.hl", hls); cloudHl(on ? [k] : [], on ? [] : [k]);
  if (btn) btn.setAttribute("aria-pressed", String(on));
  toast(on ? "Ayat disimpan" : "Simpanan dihapus");
}

/* ---------- ayat tersimpan ---------- */
function journalHtml() {
  var J = journal(); if (!J.length) return "";
  return '<div class="mini">Jurnal Doa</div>' + J.map(function (e, i) {
    var p = e.p, d = new Date(e.t).toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
    return '<details class="jr"><summary><b>' + esc(p.judul) + "</b><small>" + esc(d) + " · " + esc(refOf(p.id)) + "</small></summary>" + (e.q ? '<p class="jr-q">Cerita Anda: “' + esc(e.q) + "”</p>" : "") + prayerBody(p) +
      '<div class="pr-acts"><button class="btn sec" type="button" data-jr="copy" data-i="' + i + '">Salin doa</button><button class="btn sec" type="button" data-jr="share" data-i="' + i + '">Bagikan</button><button class="btn sec" type="button" data-jr="del" data-i="' + i + '">Hapus</button></div></details>';
  }).join("") + '<div class="mini">Ayat tersimpan</div>';
}
var svTab = "simpan";
function keyIds(store) { return Object.keys(store).filter(validKey).map(function (k) { var p = k.split(":").map(Number); return gid(p[0], p[1], p[2]); }).sort(function (a, b) { return a - b; }); }
function svSegHtml(nS, nR) { return '<div class="seg svseg" id="svSeg" role="tablist"><button type="button" role="tab" data-sv="simpan" aria-pressed="' + (svTab === "simpan") + '">Disimpan' + (nS ? " · " + nS : "") + '</button><button type="button" role="tab" data-sv="sorot" aria-pressed="' + (svTab === "sorot") + '">Disorot' + (nR ? " · " + nR : "") + "</button></div>"; }
function renderSorot(seg) {
  var ids = keyIds(sors);
  $("svCopy").hidden = !ids.length;
  $("svBody").innerHTML = seg + (ids.length ? '<div class="found">' + ids.length + " ayat disorot</div>" + ids.map(function (id) { return card(id, null, null).replace("Mengandung kata Anda", esc(BOOKS[bOf[id]].n)).replace('class="rcard"', 'class="rcard" style="border-left:6px solid var(--sr-' + (sors[keyOf(id)] || "y") + ')"'); }).join("") :
    '<div class="empty"><p style="margin:0 0 6px;font-weight:700;color:var(--fg)">Belum ada ayat yang disorot</p>Saat membaca, ketuk sebuah ayat lalu pilih Soroti. Sorotan menandai ayat yang penting atau sudah Anda baca, dan selalu terlihat saat pasal itu dibuka.</div>');
  $("svBody").dataset.ids = ids.join(",");
}
/* ---------- Lainnya ---------- */
function navHash(h) { if (location.hash.slice(1) === h) route(); else if (NAV_REPLACE) { curHash = "#" + h; history.replaceState(history.state, "", curHash); route(); } else location.hash = h; }
var MUSIC_I = '<svg class="ico" viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>';
var MARK_I = '<svg class="ico" viewBox="0 0 24 24"><path d="M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1z"/></svg>';
var INFO_I = '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.01"/></svg>';
$("abBack").onclick = function () { navHash("lainnya"); };
/* Bahasa aplikasi (evo.lang) — hanya tampilan; bahasa isi & versi Alkitab terpisah. */
(function () {
  var cur = "id"; try { cur = localStorage.getItem("evo.lang") === "en" ? "en" : "id"; } catch (e) {}
  Array.prototype.forEach.call($("langSeg").querySelectorAll("button"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.l === cur)); });
  $("langSeg").onclick = function (e) {
    var b = e.target.closest("[data-l]"); if (!b || b.dataset.l === cur) return;
    try { localStorage.setItem("evo.lang", b.dataset.l); } catch (x) {}
    location.reload();
  };
})();
var GEAR_I = '<svg class="ico" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>';
var CHEV_R = '<svg class="ico chev" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>';
function renderMore() {
  var kat = settings.cal === "katolik";
  var rows = [
    ["nyanyian", MUSIC_I, "Nyanyian", (kat ? "Madah Bakti dan Puji Syukur" : "Kidung Jemaat, Pelengkap Kidung Jemaat, dan Nyanyikanlah Kidung Baru") + ", serta himne klasik berbahasa Inggris"],
    ["kisah", KS_I, "Kisah", kat ? "Orang kudus sepanjang tahun, perumpamaan Yesus, dan tokoh Alkitab" : "Perumpamaan Yesus dan tokoh Alkitab"],
    ["tersimpan", MARK_I, "Tersimpan", "Ayat tersimpan, sorotan, dan Jurnal Doa"],
    ["@set", GEAR_I, "Pengaturan", "Ukuran huruf, tema warna, bahasa, dan kalender gereja"],
    ["tentang", INFO_I, "Tentang & Kredit", "Lisensi Alkitab, layanan, dan sumber konten"]
  ];
  $("moreBody").innerHTML = '<div class="morelist">' + rows.map(function (r) {
    return '<button class="morerow" type="button" data-more="' + r[0] + '"><span class="mi">' + r[1] + "</span><span class=\"mt\"><b>" + r[2] + "</b><small>" + r[3] + "</small></span>" + CHEV_R + "</button>";
  }).join("") + "</div>";
}
$("moreBody").addEventListener("click", function (e) {
  var t = e.target.closest("[data-more]"); if (!t) return;
  var k = t.dataset.more; if (k === "@set") show("shSet"); else navHash(k);
});

/* ---------- renderSaved ---------- */
function renderSaved() {
  var seg = svSegHtml(keyIds(hls).length, keyIds(sors).length);
  if (svTab === "sorot") { renderSorot(seg); return; }
  var ids = Object.keys(hls).map(function (k) { var p = k.split(":").map(Number); return gid(p[0], p[1], p[2]); }).sort(function (a, b) { return a - b; });
  $("svCopy").hidden = !ids.length;
  $("svBody").innerHTML = seg + (sb && googleOn && !user ? '<div class="nudge"><p>Masuk dengan Google agar ayat tersimpan dan Jurnal Doa tidak hilang dan bisa dibuka di HP lain.</p><button class="btn pri gbtn" type="button" data-login="1">' + G_I + "Masuk dengan Google</button></div>" : "") + journalHtml() + (ids.length ? '<div class="found">' + ids.length + " ayat</div>" + ids.map(function (id) { return card(id, null, null).replace("Mengandung kata Anda", esc(BOOKS[bOf[id]].n)); }).join("") :
    '<div class="empty"><p style="margin:0 0 6px;font-weight:700;color:var(--fg)">Belum ada ayat tersimpan</p>Ketuk sebuah ayat saat membaca lalu pilih Simpan ayat, atau ketuk ikon penanda pada hasil pencarian.</div>');
  $("svBody").dataset.ids = ids.join(",");
}
$("svBody").addEventListener("click", function (e) {
  var svb = e.target.closest("[data-sv]"); if (svb) { svTab = svb.dataset.sv; renderSaved(); return; }
  var jb = e.target.closest("[data-jr]");
  if (jb) {
    var J = journal(), je = J[+jb.dataset.i]; if (!je) return;
    if (jb.dataset.jr === "copy") copyText(prayerOnly(je.p), "Doa disalin");
    else if (jb.dataset.jr === "share") { if (navigator.share) navigator.share({ title: je.p.judul, text: prayerText(je.p) }).catch(function () {}); else copyText(prayerText(je.p), "Renungan dan doa disalin"); }
    else if (jb.dataset.jr === "del") { cloudJrDel(je.id); J.splice(+jb.dataset.i, 1); lsSet("evo.jurnal", J); renderSaved(); toast("Dihapus dari Jurnal Doa"); }
    return;
  }
  var t = e.target.closest("[data-act]"), cardEl = e.target.closest(".rcard"); if (!cardEl) return;
  var id = +cardEl.dataset.id;
  if (t && t.dataset.act === "img") { imgVerse(id); return; }
  if (t && t.dataset.act === "copy") { copyText(verseCopy(id)); return; }
  if (t && t.dataset.act === "save") { toggleHl(id, t); renderSaved(); return; }
  openRef(bOf[id], cOf[id], vOf[id]);
});
$("svCopy").onclick = function () { var ids = $("svBody").dataset.ids.split(",").filter(Boolean).map(Number); copyText(ids.map(function (id) { return clean(texts[id]) + "\n" + refOf(id) + " (AYT)"; }).join("\n\n"), "Semua ayat tersimpan disalin"); };

/* ---------- tombol Back (Android / aplikasi terpasang) dan swipe-back ----------
   Pola sama dengan Evo Lirik: Back menutup panel, lalu naik ke Beranda, dan di Beranda bertanya "Keluar?".
   Di iPhone tidak ada penjaga (swipe tepi akan memperlihatkan halaman penjaga); cukup navigasi tanpa riwayat
   sehingga swipe-back tidak berpindah-pindah halaman. */
var IOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
var BACK_GUARD = false;
try { BACK_GUARD = !IOS && !!history.pushState && (isStandalone() || /Android/i.test(navigator.userAgent)); } catch (e) {}
var NAV_REPLACE = BACK_GUARD || IOS, curHash = location.hash;
(function () {
  if (!BACK_GUARD) return;
  var exiting = false, L0 = history.length, needTouch = false;
  function arm() { try { history.pushState({ evo: 1 }, "", location.pathname + location.search + curHash); } catch (e) {} }
  try { history.replaceState({ evo: 0 }, "", location.href); arm(); } catch (e) { return; }
  needTouch = true;
  function touchArm() { if (exiting || !needTouch) return; var ua = navigator.userActivation; if (ua && !ua.isActive) return; needTouch = false; arm(); }
  ["pointerup", "touchend", "click", "keydown"].forEach(function (ev) { addEventListener(ev, touchArm, { capture: true, passive: true }); });
  function goBack() {
    if (window.EvoGambar && EvoGambar.isOpen()) { EvoGambar.close(); return; }
    if (openSheet) { hide(); return; }
    if (S.view === "read" && S.sel.length) { clearSel(); return; }
    if (S.view === "search" && S.theme) { S.theme = null; renderSearch(); window.scrollTo(0, 0); return; }
    if (S.view !== "home") { go("home"); return; }
    show("shExit");
  }
  addEventListener("popstate", function () { if (exiting) return; arm(); needTouch = true; goBack(); });
  document.addEventListener("click", function (e) {
    if (!e.target.closest("[data-exit]")) return;
    exiting = true; hide();
    try { history.go(-Math.max(2, history.length - L0 + 1)); } catch (x) {}
    setTimeout(function () { try { window.close(); } catch (y) {} }, 400);
  });
})();
/* Safari mengabaikan user-scalable=no: blokir hanya gesture zoom halaman */
document.addEventListener("gesturestart", function (e) { e.preventDefault(); });

/* ---------- init ---------- */
if ("serviceWorker" in navigator && location.protocol !== "file:") { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }

applySettings();
route();
renderAkun();
