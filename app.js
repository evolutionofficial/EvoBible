(function () {
  "use strict";
  var $ = function (id) { return document.getElementById(id); };
  var mem = {};
  function lsGet(k, d) { try { var v = localStorage.getItem(k); return v === null ? (k in mem ? mem[k] : d) : JSON.parse(v); } catch (e) { return k in mem ? mem[k] : d; } }
  function lsSet(k, v) { mem[k] = v; try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function esc(s) { return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;"); }
  function plain(t) { return t.replace(/^¶/, ""); }
  function clean(t) { return plain(t).replace(/^\(\d+-\d+\)\s*/, ""); }

  /* ---------- data ---------- */
  var BOOKS = window.__BIBLE;
  var ED = window.__ENGINE;
  var texts = [], bOf = [], cOf = [], vOf = [], starts = [];
  BOOKS.forEach(function (bk, b) {
    starts[b] = [];
    bk.ch.forEach(function (ch, c) { starts[b][c + 1] = texts.length; ch.v.forEach(function (t, v) { texts.push(plain(t)); bOf.push(b); cOf.push(c + 1); vOf.push(v + 1); }); });
  });
  var eng = createEngine(ED, texts, Uint8Array.from(bOf));
  var CLM = {}; eng.clusters.forEach(function (c) { CLM[c.k] = c; });
  function gid(b, c, v) { return starts[b][c] + v - 1; }
  function refOf(id) { return BOOKS[bOf[id]].n + " " + cOf[id] + ":" + vOf[id]; }
  function keyOf(id) { return bOf[id] + ":" + cOf[id] + ":" + vOf[id]; }

  var HUE = {};
  function setHue(h, keys) { keys.split(" ").forEach(function (k) { HUE[k] = h; }); }
  var GROUPS = [
    ["Perasaan dan pergumulan", 214, "takut cemas hibur sabar sendiri diam tunggu damai kuat sakit mati harapan"],
    ["Hubungan dengan sesama", 338, "kasih ampun keluarga anak sahabat musuh marah iri layan jemaat"],
    ["Hidup sehari-hari", 36, "kerja uang belajar hikmat tujuan identitas pemimpin adil"],
    ["Karakter dan pergumulan batin", 262, "dosa godaan jujur rendah menang"],
    ["Iman dan Tuhan", 172, "iman doa firman puji dekat roh baik janji anugerah salib selamat lindung ciptaan akhir syukur sukacita"]
  ];
  GROUPS.forEach(function (g) { setHue(g[1], g[2].replace("cemas ", "").replace(" cemas", "")); });
  function hueOf(k) { return HUE[k] !== undefined ? HUE[k] : 172; }
  var TNAME = { takut: "Takut dan cemas" };

  /* ---------- state ---------- */
  var S = { view: "home", b: 0, c: 1, sel: [], q: "", mode: "tema", theme: null, moreOpen: false, pendingAI: false, ai: null };
  var hls = lsGet("evo.hl", {});
  var settings = lsGet("evo.set", { fs: 21, theme: "auto" });
  var recent = lsGet("evo.recent", []);
  var open = null, toastT;
  var API = "https://ddydxagduxhzzsrlwgkd.supabase.co/functions/v1/cari";
  function rid() { var a = new Uint8Array(12); (window.crypto || window.msCrypto).getRandomValues(a); return Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); }
  var devId = lsGet("evo.dev", null); if (!devId) { devId = rid(); lsSet("evo.dev", devId); }
  var CRISIS = /(bunuh diri|mengakhiri hidup|akhiri hidup|ingin mati|pengen mati|mau mati|lebih baik mati|tidak ingin hidup|nggak ingin hidup|tidak mau hidup|ga mau hidup|menyakiti diri|melukai diri|mengakhiri semuanya)/i;
  function aiKey(q) { return q.toLowerCase().replace(/\s+/g, " ").trim(); }
  function careCard() {
    return '<div class="care"><b>Anda tidak sendirian</b><p>Jika Anda sedang berpikir untuk menyakiti diri atau mengakhiri hidup, mohon bicara dengan seseorang sekarang: keluarga, sahabat, atau pendeta yang Anda percaya.</p><p>Layanan Healing119 dari Kementerian Kesehatan: telepon 119 ext. 8, atau chat lewat healing119.id. Jika sibuk, coba lagi sebentar lagi.</p><div class="acts"><a class="btn pri" href="tel:119">Telepon 119</a><a class="btn sec" href="https://healing119.id" target="_blank" rel="noopener">Buka healing119.id</a></div></div>';
  }
  function renderIfCurrent(key) { if (S.view === "search" && !S.theme && S.mode === "tema" && aiKey(S.q) === key) renderSearch(); }
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

  function toast(m) { var t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 1800); }
  function copyText(text, msg) {
    function done() { toast(msg || "Disalin"); }
    function fb() { var ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("Tidak bisa menyalin"); } document.body.removeChild(ta); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fb); else fb();
  }
  function verseCopy(id) { return clean(texts[id]) + "\n\n" + refOf(id) + " (AYT)"; }

  /* ---------- settings ---------- */
  function applySettings() {
    document.documentElement.style.setProperty("--fs-read", settings.fs + "px");
    $("fsOut").textContent = settings.fs;
    if (settings.theme === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", settings.theme);
    Array.prototype.forEach.call($("themeSeg").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.t === settings.theme)); });
  }
  $("fsDown").onclick = function () { settings.fs = Math.max(14, settings.fs - 1); lsSet("evo.set", settings); applySettings(); };
  $("fsUp").onclick = function () { settings.fs = Math.min(30, settings.fs + 1); lsSet("evo.set", settings); applySettings(); };
  $("themeSeg").onclick = function (e) { var t = e.target.dataset && e.target.dataset.t; if (!t) return; settings.theme = t; lsSet("evo.set", settings); applySettings(); };

  /* ---------- sheets ---------- */
  function show(id) { hide(); $(id).hidden = false; open = id; }
  function hide() { ["shBooks", "shSet"].forEach(function (i) { $(i).hidden = true; }); open = null; }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) hide(); else if (e.target.classList && e.target.classList.contains("scrim")) hide();
  });
  $("btnSet").onclick = $("btnSet2").onclick = function () { show("shSet"); };

  /* ---------- routing ---------- */
  var VIEWS = { home: "vHome", search: "vSearch", read: "vRead", saved: "vSaved" };
  var NAMES = { home: "beranda", search: "cari", read: "baca", saved: "sorotan" };
  function go(v) { var h = NAMES[v]; if (location.hash.slice(1) === h) route(); else location.hash = h; }
  function openRef(b, c, v) { var h = BOOKS[b].a + "-" + c + (v ? "-" + v : ""); if (location.hash.slice(1) === h) route(); else location.hash = h; }
  function showView(v) {
    S.view = v;
    Object.keys(VIEWS).forEach(function (k) { $(VIEWS[k]).hidden = k !== v; });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) { if (t.dataset.v === v) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current"); });
    if (v !== "read") clearSel(true);
  }
  function route() {
    hide();
    var h = decodeURIComponent(location.hash.slice(1)), m = /^([A-Za-z0-9]+)-(\d+)(?:-(\d+))?$/.exec(h);
    if (m) {
      for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].a === m[1]) {
        var c = Math.min(Math.max(1, +m[2]), BOOKS[i].ch.length), v = m[3] ? Math.min(+m[3], BOOKS[i].ch[c - 1].v.length) : 0;
        showView("read"); renderChapter(i, c, v); return;
      }
    }
    if (h === "cari") { showView("search"); renderSearch(); if (!S.q && !S.theme) { try { $("q").focus(); } catch (e) {} } window.scrollTo(0, 0); return; }
    if (h === "sorotan") { showView("saved"); renderSaved(); window.scrollTo(0, 0); return; }
    if (h === "baca") { var last = lsGet("evo.last", { b: 0, c: 1 }); if (!BOOKS[last.b] || !BOOKS[last.b].ch[last.c - 1]) last = { b: 0, c: 1 }; showView("read"); renderChapter(last.b, last.c, 0); return; }
    showView("home"); renderHome(); window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", route);
  $("tabs").onclick = function (e) { var t = e.target.closest(".tab"); if (t) go(t.dataset.v); };

  /* ---------- beranda ---------- */
  var EXAMPLES = ["takut menghadapi masa depan", "sulit memaafkan", "merasa kesepian", "doa belum dijawab", "capek dengan pekerjaan"];
  function greeting() { var h = new Date().getHours(); return h < 4 ? "Selamat malam" : h < 11 ? "Selamat pagi" : h < 15 ? "Selamat siang" : h < 18 ? "Selamat sore" : "Selamat malam"; }
  var votdIds = null;
  function votdId() {
    if (!votdIds) { var seen = {}; votdIds = []; eng.clusters.forEach(function (c) { c.a.forEach(function (id) { if (!seen[id] && clean(texts[id]).length <= 230 && texts[id].length > 30) { seen[id] = 1; votdIds.push(id); } }); }); votdIds.sort(function (a, b) { return a - b; }); }
    var d = new Date(), day = Math.floor(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) / 864e5);
    return votdIds[(day * 97) % votdIds.length];
  }
  function themeOfVerse(id) { for (var i = 0; i < eng.clusters.length; i++) if (eng.clusters[i].a.indexOf(id) >= 0) return eng.clusters[i]; return null; }
  function renderHome() {
    $("greet").textContent = greeting();
    $("homeChips").innerHTML = EXAMPLES.map(function (e) { return '<button class="chip" data-q="' + esc(e) + '">' + esc(e) + "</button>"; }).join("");
    var id = votdId(), th = themeOfVerse(id);
    $("votd").innerHTML = '<div class="lab">Ayat hari ini' + (th ? " · " + esc(th.n) : "") + '</div><p class="vt">' + esc(clean(texts[id])) + '</p><div class="vr">' + esc(refOf(id)) + '</div><div class="acts"><button data-act="read" data-id="' + id + '">Baca pasalnya</button><button data-act="copy" data-id="' + id + '">Salin</button></div>';
    var last = lsGet("evo.last", null), cont = $("cont");
    var ok = last && BOOKS[last.b] && BOOKS[last.b].ch[last.c - 1];
    if (!ok) last = { b: 0, c: 1 };
    cont.dataset.b = last.b; cont.dataset.c = last.c;
    cont.innerHTML = '<svg class="ico" viewBox="0 0 24 24" style="color:var(--accent)"><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/></svg><span class="t"><small>' + (ok ? "Lanjutkan membaca" : "Mulai membaca") + '</small><b>' + esc(BOOKS[last.b].n) + " " + last.c + "</b></span>";
    var html = "";
    GROUPS.forEach(function (g) {
      var keys = g[2].split(" ").filter(function (k) { return CLM[k]; });
      html += '<div class="sec"><h2>' + esc(g[0]) + "</h2><span>" + keys.length + " tema</span></div><div class=\"tiles\">";
      keys.forEach(function (k) { var c = CLM[k]; html += '<button class="tile" style="--h:' + g[1] + '" data-theme="' + k + '"><b>' + esc(c.n) + "</b><small>" + c.a.length + " ayat kunci</small></button>"; });
      html += "</div>";
    });
    $("themes").innerHTML = html;
    renderInstall();
  }
  $("homeForm").onsubmit = function (e) { e.preventDefault(); var q = $("hq").value.trim(); if (!q) return; $("hq").blur(); startSearch(q); };
  $("vHome").addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("[data-q]"))) { startSearch(t.dataset.q); return; }
    if ((t = e.target.closest("[data-theme]"))) { openTheme(t.dataset.theme); return; }
    if ((t = e.target.closest("[data-act]"))) { var id = +t.dataset.id; if (t.dataset.act === "copy") copyText(verseCopy(id)); else openRef(bOf[id], cOf[id], vOf[id]); return; }
    if (e.target.closest("#pick")) { go("read"); setTimeout(function () { try { $("btnLoc").click(); } catch (x) {} }, 80); return; }
    if (e.target.closest("#cont")) { var c = $("cont"); openRef(+c.dataset.b, +c.dataset.c, 0); }
  });

  /* ---------- cari ---------- */
  function startSearch(q) { S.q = q; S.theme = null; S.mode = "tema"; S.ai = null; S.pendingAI = true; $("q").value = q; syncMode(); pushRecent(q); go("search"); }
  function openTheme(k) { S.theme = k; S.moreOpen = false; go("search"); }
  function pushRecent(q) { q = q.trim(); if (q.length < 3) return; recent = [q].concat(recent.filter(function (x) { return x !== q; })).slice(0, 6); lsSet("evo.recent", recent); }
  function syncMode() { Array.prototype.forEach.call($("mode").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.m === S.mode)); }); $("qclr").hidden = !$("q").value; }
  $("mode").onclick = function (e) { var m = e.target.dataset && e.target.dataset.m; if (!m) return; S.mode = m; S.theme = null; S.pendingAI = false; syncMode(); renderSearch(); };
  var qT;
  $("q").addEventListener("input", function () { S.q = $("q").value; S.theme = null; S.ai = null; S.pendingAI = false; syncMode(); clearTimeout(qT); qT = setTimeout(renderSearch, 160); });
  $("sForm").onsubmit = function (e) { e.preventDefault(); $("q").blur(); S.q = $("q").value; pushRecent(S.q); S.ai = null; S.pendingAI = S.mode === "tema"; renderSearch(); };
  $("qclr").onclick = function () { $("q").value = ""; S.q = ""; S.theme = null; syncMode(); renderSearch(); $("q").focus(); };

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
  function card(id, why, re, alasan) {
    var w = why ? '<span class="why" style="--h:' + hueOf(why.k) + '">' + (why.label ? esc(why.label) : (why.a ? "Ayat kunci" : "Terkait") + " · " + esc(why.n)) + "</span>" : '<span class="why lexw">Mengandung kata Anda</span>';
    return '<div class="rcard" data-id="' + id + '" role="button" tabindex="0"><div class="rref">' + esc(refOf(id)) + '</div><div class="rtx">' + hilite(texts[id], re) + '</div>' + (alasan ? '<p class="alasan"><b>Mengapa cocok:</b> ' + esc(alasan) + "</p>" : "") + '<div class="rft">' + w +
      '<button class="mini-ib" data-act="copy" aria-label="Salin ayat">' + COPY_I + '</button><button class="mini-ib" data-act="save" aria-pressed="' + (!!hls[keyOf(id)]) + '" aria-label="Sorot ayat">' + SAVE_I + "</button></div></div>";
  }
  function renderSearch() {
    var body = $("sBody"), q = S.q.trim();
    syncMode();
    if (S.theme) return renderTheme(body);
    if (!q) {
      var h = '<div class="mini">Coba tanyakan</div><div class="sugg">';
      ["aku takut menghadapi masa depan", "bagaimana cara memaafkan orang yang menyakitiku", "sedih ditinggal orang tersayang", "tuhan kenapa doaku tidak dijawab", "merasa tidak berharga", "ingin lebih dekat dengan Tuhan", "pemimpin yang baik"].forEach(function (s) { h += '<button data-q="' + esc(s) + '"><svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>' + esc(s) + "</button>"; });
      h += "</div>";
      if (recent.length) { h += '<div class="mini">Terakhir dicari</div><div class="chips" style="margin-top:0">' + recent.map(function (r) { return '<button class="chip" data-q="' + esc(r) + '">' + esc(r) + "</button>"; }).join("") + "</div>"; }
      h += '<p class="hint">Ketik juga alamat ayat seperti <b>Mzm 23</b> atau <b>Yoh 3:16</b> untuk langsung membukanya.</p>';
      body.innerHTML = h; return;
    }
    var html = "", ref = parseRef(q);
    if (ref) { html += '<button class="go" data-b="' + ref.b + '" data-c="' + ref.c + '" data-v="' + ref.v + '"><b>Buka ' + esc(BOOKS[ref.b].n + " " + ref.c + (ref.v ? ":" + ref.v : "")) + "</b>" + (ref.v ? "<span>" + esc(clean(BOOKS[ref.b].ch[ref.c - 1].v[ref.v - 1])) + "</span>" : "") + "</button>"; }
    var re = termRegex(q);
    if (S.mode === "tema") {
      if (q.length < 3) { body.innerHTML = html + '<p class="hint">Tulis minimal tiga huruf.</p>'; return; }
      var r = eng.search(q, { limit: 40 }), key = aiKey(q), crisis = CRISIS.test(q);
      var cands = r.results.map(function (x) { return x.id; });
      if (S.pendingAI) { S.pendingAI = false; if (!crisis && cands.length >= 5) runAI(q, cands); }
      var ai = S.ai && S.ai.q === key ? S.ai : null;
      if (crisis || (ai && ai.state === "done" && ai.data.krisis)) html += careCard();
      if (r.sel.length) html += '<div class="found">Cocok dengan tema: ' + r.sel.map(function (c) { return '<button class="tchip" style="--h:' + hueOf(c.k) + '" data-theme="' + c.k + '">' + esc(c.n) + "</button>"; }).join("") + "</div>";
      if (ai && ai.state === "wait") { body.innerHTML = html + '<div class="wait" role="status"><span class="dots"><i></i><i></i><i></i></span>Mencarikan ayat yang paling sesuai untuk Anda…</div>'; return; }
      if (ai && ai.state === "done") {
        var used = {};
        if (ai.data.ringkasan) html += '<div class="sumcard">' + esc(ai.data.ringkasan) + "</div>";
        ai.data.pilihan.forEach(function (p) { if (p.id >= 0 && p.id < texts.length && !used[p.id]) { used[p.id] = 1; html += card(p.id, { label: "Pilihan untuk Anda", k: "iman" }, re, p.alasan); } });
        var rest = r.results.filter(function (x) { return !used[x.id]; }).slice(0, 6);
        if (rest.length) html += '<div class="mini">Ayat lain yang terkait</div>' + rest.map(function (x) { return card(x.id, x.why, re); }).join("");
      } else if (!r.results.length) {
        html += '<div class="empty">Belum ada ayat yang cocok dengan “' + esc(q) + '”. Coba kata yang lebih umum, misalnya “takut”, “marah”, atau “keluarga”.</div>';
      } else {
        if (ai && ai.state === "fail" && ai.why === "batas") html += '<p class="hint">Pemilihan otomatis sedang penuh hari ini. Berikut hasil dasar dari HP Anda.</p>';
        else if (ai && ai.state === "off") html += '<p class="hint">Sedang tanpa internet. Berikut hasil dasar dari HP Anda.</p>';
        html += r.results.slice(0, 14).map(function (x) { return card(x.id, x.why, re); }).join("");
      }
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
    if (t && (t.dataset.act === "copy" || t.dataset.act === "save")) {
      var cardEl = t.closest(".rcard"), id = +cardEl.dataset.id;
      if (t.dataset.act === "copy") copyText(verseCopy(id)); else toggleHl(id, t);
      return;
    }
    if ((t = e.target.closest("[data-q]"))) { S.q = t.dataset.q; $("q").value = S.q; S.theme = null; S.ai = null; S.pendingAI = S.mode === "tema"; pushRecent(S.q); renderSearch(); return; }
    if ((t = e.target.closest("[data-theme]"))) { S.theme = t.dataset.theme; S.moreOpen = false; renderSearch(); window.scrollTo(0, 0); return; }
    if ((t = e.target.closest(".go"))) { openRef(+t.dataset.b, +t.dataset.c, +t.dataset.v); return; }
    if ((t = e.target.closest(".rcard"))) { var i2 = +t.dataset.id; if (S.q) pushRecent(S.q); openRef(bOf[i2], cOf[i2], vOf[i2]); }
  });
  $("sBody").addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && e.target.classList.contains("rcard")) { e.preventDefault(); e.target.click(); } });
  function toggleHl(id, btn) {
    var k = keyOf(id), on = !hls[k];
    if (on) hls[k] = 1; else delete hls[k];
    lsSet("evo.hl", hls);
    if (btn) btn.setAttribute("aria-pressed", String(on));
    toast(on ? "Ayat disorot" : "Sorotan dilepas");
  }

  /* ---------- sorotan ---------- */
  function renderSaved() {
    var ids = Object.keys(hls).map(function (k) { var p = k.split(":").map(Number); return gid(p[0], p[1], p[2]); }).sort(function (a, b) { return a - b; });
    $("svCopy").hidden = !ids.length;
    $("svBody").innerHTML = ids.length ? '<div class="found">' + ids.length + " ayat</div>" + ids.map(function (id) { return card(id, null, null).replace("Mengandung kata Anda", esc(BOOKS[bOf[id]].n)); }).join("") :
      '<div class="empty"><p style="margin:0 0 6px;font-weight:700;color:var(--fg)">Belum ada sorotan</p>Ketuk sebuah ayat saat membaca lalu pilih Sorot, atau ketuk ikon penanda pada hasil pencarian.</div>';
    $("svBody").dataset.ids = ids.join(",");
  }
  $("svBody").addEventListener("click", function (e) {
    var t = e.target.closest("[data-act]"), cardEl = e.target.closest(".rcard"); if (!cardEl) return;
    var id = +cardEl.dataset.id;
    if (t && t.dataset.act === "copy") { copyText(verseCopy(id)); return; }
    if (t && t.dataset.act === "save") { toggleHl(id, t); renderSaved(); return; }
    openRef(bOf[id], cOf[id], vOf[id]);
  });
  $("svCopy").onclick = function () { var ids = $("svBody").dataset.ids.split(",").filter(Boolean).map(Number); copyText(ids.map(function (id) { return clean(texts[id]) + "\n" + refOf(id) + " (AYT)"; }).join("\n\n"), "Semua sorotan disalin"); };

  /* ---------- baca ---------- */
  function renderChapter(b, c, vFocus) {
    var bk = BOOKS[b], ch = bk.ch[c - 1];
    S.b = b; S.c = c; clearSel(true);
    $("locText").textContent = bk.n + " " + c; $("chBook").textContent = bk.n; $("chNum").textContent = "Pasal " + c;
    var h = ch.h || {}, html = "", op = false;
    ch.v.forEach(function (raw, i) {
      var n = i + 1, brk = i === 0 || raw.charAt(0) === "¶" || h[i] !== undefined;
      if (brk) { if (op) html += "</p>"; if (h[i] !== undefined) html += "<h3>" + esc(h[i]) + "</h3>"; html += "<p>"; op = true; }
      html += '<span class="v' + (hls[b + ":" + c + ":" + n] ? " hl" : "") + '" data-v="' + n + '" id="v' + n + '"><b class="vn">' + n + "</b>" + esc(plain(raw)) + " </span>";
    });
    if (op) html += "</p>";
    $("text").innerHTML = html;
    setNav($("prev"), prevOf(b, c)); setNav($("next"), nextOf(b, c));
    lsSet("evo.last", { b: b, c: c });
    if (vFocus && $("v" + vFocus)) { var el = $("v" + vFocus); el.scrollIntoView({ block: "center" }); el.classList.add("flash"); } else window.scrollTo(0, 0);
  }
  function setNav(btn, t) { btn.hidden = !t; if (t) btn.querySelector("b").textContent = BOOKS[t[0]].n + " " + t[1]; btn._t = t; }
  function prevOf(b, c) { if (c > 1) return [b, c - 1]; if (b > 0) return [b - 1, BOOKS[b - 1].ch.length]; return null; }
  function nextOf(b, c) { if (c < BOOKS[b].ch.length) return [b, c + 1]; if (b < BOOKS.length - 1) return [b + 1, 1]; return null; }
  $("prev").onclick = function () { if (this._t) openRef(this._t[0], this._t[1]); };
  $("next").onclick = function () { if (this._t) openRef(this._t[0], this._t[1]); };
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") { if (open) hide(); else clearSel(); return; }
    if (S.view !== "read" || open || /input|textarea/i.test(e.target.tagName || "")) return;
    var t = e.key === "ArrowLeft" ? $("prev")._t : e.key === "ArrowRight" ? $("next")._t : null; if (t) openRef(t[0], t[1]);
  });
  $("text").addEventListener("click", function (e) {
    var v = e.target.closest(".v"); if (!v) return;
    var n = +v.dataset.v, i = S.sel.indexOf(n);
    if (i >= 0) { S.sel.splice(i, 1); v.classList.remove("sel"); } else { S.sel.push(n); v.classList.add("sel"); }
    updateSel();
  });
  function clearSel(silent) { S.sel = []; Array.prototype.forEach.call(document.querySelectorAll(".v.sel"), function (el) { el.classList.remove("sel"); }); if (silent) $("selbar").hidden = true; else updateSel(); }
  function rangeStr(nums) { var s = nums.slice().sort(function (a, b) { return a - b; }), out = [], i = 0; while (i < s.length) { var j = i; while (j + 1 < s.length && s[j + 1] === s[j] + 1) j++; out.push(j > i ? s[i] + "-" + s[j] : String(s[i])); i = j + 1; } return out.join(","); }
  function updateSel() {
    var n = S.sel.length; $("selbar").hidden = n === 0; if (!n) return;
    $("selInfo").textContent = n + " ayat dipilih";
    var allHl = S.sel.every(function (v) { return hls[S.b + ":" + S.c + ":" + v]; });
    $("selHl").textContent = allHl ? "Lepas sorot" : "Sorot";
  }
  $("selClear").onclick = function () { clearSel(); };
  $("selHl").onclick = function () {
    var allHl = S.sel.every(function (v) { return hls[S.b + ":" + S.c + ":" + v]; });
    S.sel.forEach(function (v) { var k = S.b + ":" + S.c + ":" + v; if (allHl) delete hls[k]; else hls[k] = 1; $("v" + v).classList.toggle("hl", !allHl); });
    lsSet("evo.hl", hls); toast(allHl ? "Sorotan dilepas" : "Ayat disorot"); clearSel();
  };
  $("selCopy").onclick = function () {
    var s = S.sel.slice().sort(function (a, b) { return a - b; }), bk = BOOKS[S.b], ch = bk.ch[S.c - 1];
    var body = s.map(function (n) { var t = clean(ch.v[n - 1]); return s.length > 1 ? n + " " + t : t; }).join("\n");
    copyText(body + "\n\n" + bk.n + " " + S.c + ":" + rangeStr(s) + " (AYT)"); clearSel();
  };

  /* ---------- pilih kitab ---------- */
  var tab = 0, pick = -1;
  function drawBooks() {
    var html = "";
    if (pick >= 0) {
      var bk = BOOKS[pick];
      html += '<button class="back2" id="bkBack"><svg class="ico" viewBox="0 0 24 24" style="width:16px;height:16px"><path d="m15 6-6 6 6 6"/></svg>Semua kitab</button><h3 style="margin:0 0 12px;font-size:22px;font-weight:800;letter-spacing:-.02em">' + esc(bk.n) + '</h3><div class="chs">';
      for (var c = 1; c <= bk.ch.length; c++) html += '<button data-c="' + c + '" class="' + (pick === S.b && c === S.c ? "cur" : "") + '">' + c + "</button>";
      html += "</div>";
    } else {
      html += '<div class="tabs2" role="tablist"><button role="tab" data-tab="0" aria-selected="' + (tab === 0) + '">Perjanjian Lama</button><button role="tab" data-tab="1" aria-selected="' + (tab === 1) + '">Perjanjian Baru</button></div><div class="books">';
      for (var i = tab ? 39 : 0; i < (tab ? 66 : 39); i++) html += '<button data-b="' + i + '" class="' + (i === S.b ? "cur" : "") + '">' + esc(BOOKS[i].n) + "</button>";
      html += "</div>";
    }
    $("booksBody").innerHTML = html;
  }
  $("btnLoc").onclick = function () { pick = -1; tab = S.b >= 39 ? 1 : 0; drawBooks(); show("shBooks"); var cur = $("booksBody").querySelector(".cur"); if (cur) cur.scrollIntoView({ block: "center" }); };
  $("booksBody").addEventListener("click", function (e) {
    var t = e.target.closest("button"); if (!t) return;
    if (t.dataset.tab) { tab = +t.dataset.tab; drawBooks(); }
    else if (t.dataset.b) { pick = +t.dataset.b; drawBooks(); $("booksBody").scrollTop = 0; }
    else if (t.id === "bkBack") { pick = -1; drawBooks(); }
    else if (t.dataset.c) { var b = pick; hide(); openRef(b, +t.dataset.c); }
  });

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
    if (location.protocol === "file:" || isStandalone() || lsGet("evo.installed", 0) || (no && Date.now() - no < 12096e5) || !(android || ios || deferred)) { el.hidden = true; return; }
    var inner;
    if (deferred) inner = "<p>Ikon EvoBible akan muncul di layar HP seperti aplikasi lain. Sekali ketuk, langsung terbuka.</p><div class=\"acts\"><button class=\"btn pri\" data-inst=\"go\">Pasang sekarang</button><button class=\"btn sec\" data-inst=\"later\">Nanti saja</button></div>";
    else if (ios) inner = "<ol><li>Ketuk tombol Bagikan " + SHARE_I + " di bagian bawah layar Safari.</li><li>Geser ke bawah, ketuk <b>Tambah ke Layar Utama</b>.</li><li>Ketuk <b>Tambah</b> di pojok kanan atas.</li></ol><div class=\"acts\"><button class=\"btn sec\" data-inst=\"later\">Nanti saja</button></div>";
    else inner = "<ol><li>Ketuk tombol menu (tiga titik) di pojok kanan atas peramban.</li><li>Pilih <b>Instal aplikasi</b> atau <b>Tambahkan ke layar utama</b>.</li><li>Ketuk <b>Instal</b> atau <b>Tambah</b>.</li></ol><div class=\"acts\"><button class=\"btn sec\" data-inst=\"later\">Nanti saja</button></div>";
    el.innerHTML = "<h2>Pasang EvoBible di layar utama</h2>" + inner; el.hidden = false;
  }
  window.addEventListener("beforeinstallprompt", function (e) { e.preventDefault(); deferred = e; renderInstall(); });
  window.addEventListener("appinstalled", function () { deferred = null; lsSet("evo.installed", 1); renderInstall(); });
  $("install").addEventListener("click", function (e) {
    var t = e.target.closest("[data-inst]"); if (!t) return;
    if (t.dataset.inst === "later") { lsSet("evo.noinst", Date.now()); $("install").hidden = true; return; }
    if (deferred) { deferred.prompt(); deferred.userChoice.then(function (c) { if (c && c.outcome === "accepted") lsSet("evo.installed", 1); deferred = null; renderInstall(); }); }
  });
  if ("serviceWorker" in navigator && location.protocol !== "file:") { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }

  applySettings();
  route();
})();
