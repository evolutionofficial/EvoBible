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
    ["Pergumulan", 214, "Takut, cemas, sakit, kesepian, dan masa sulit", "takut cemas sakit mati sendiri diam marah iri godaan"],
    ["Pengharapan", 172, "Penghiburan, damai, dan janji Tuhan", "harapan hibur damai kuat sabar tunggu janji lindung salib selamat akhir"],
    ["Bersyukur", 36, "Sukacita, pujian, dan kebaikan Tuhan", "syukur sukacita puji anugerah baik ciptaan roh"],
    ["Kasih dan sesama", 338, "Keluarga, sahabat, pengampunan, dan melayani", "kasih ampun keluarga anak sahabat musuh layan jemaat"],
    ["Introspeksi", 262, "Memeriksa hati, dosa, kejujuran, dan iman", "dosa jujur rendah menang iman doa firman dekat"],
    ["Mencari arah", 280, "Hikmat, tujuan hidup, pekerjaan, dan keputusan", "hikmat tujuan identitas kerja uang belajar pemimpin adil"]
  ];
  GROUPS.forEach(function (g) { setHue(g[1], g[3].replace("cemas ", "").replace(" cemas", "")); });
  function hueOf(k) { return HUE[k] !== undefined ? HUE[k] : 172; }
  var TNAME = { takut: "Takut dan cemas" };

  /* ---------- state ---------- */
  var S = { view: "home", b: 0, c: 1, sel: [], q: "", mode: "tema", theme: null, moreOpen: false, pendingAI: false, ai: null };
  var hls = lsGet("evo.hl", {});
  var settings = lsGet("evo.set", { fs: 21, theme: "auto" });
  if (!settings.cal) settings.cal = "protestan";
  if (!settings.sea) settings.sea = "on";
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
  function renderSeasonCard() {
    var el = $("seasonCard"), v = seasonView();
    if (!v) { el.hidden = true; return; }
    var id = v.cur.id, m = SEA[id], bi = bookIdx(m.v[0]), ref = bi >= 0 ? m.v[0] + " " + m.v[1] + ":" + m.v[2] : "";
    el.hidden = false;
    el.innerHTML = '<div class="si"><div class="tag">' + (PV ? "Pratinjau tema" : "Masa gerejawi saat ini") + "</div><h3>" + esc(sname(id)) + '</h3><div class="sd">' + esc(srange(v.cur)) + '</div><p class="sp">' + esc(m.d) + "</p>"
      + (v.next ? '<div class="sn">Berikutnya: <b>' + esc(sname(v.next.id)) + "</b> · " + esc(dnDate(v.next.s)) + "</div>" : "")
      + (ref ? '<button class="sref" type="button" data-sref="' + id + '">Renungkan: ' + esc(ref) + "</button>" : "")
      + '</div><div class="stile" style="background:linear-gradient(165deg,' + m.g[0] + "," + m.g[1] + ');--oc:' + m.oc + '">' + ornSvg(id) + "</div>";
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
  function refreshSeason() { applySeason(); renderSeasonCard(); if (S.view === "home") renderHome(); }
  function syncSeasonUI() {
    Array.prototype.forEach.call($("calSeg").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.k === settings.cal)); });
    Array.prototype.forEach.call($("seaSeg").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.k === settings.sea)); });
    $("pvGrid").innerHTML = ORDER.map(function (id) { var m = SEA[id]; return '<button type="button" data-pv="' + id + '"><i style="background:linear-gradient(135deg,' + m.g[0] + "," + m.g[1] + ')"></i>' + esc(sname(id)) + "</button>"; }).join("");
  }
  $("calSeg").onclick = function (e) { var k = e.target.dataset && e.target.dataset.k; if (!k) return; settings.cal = k; lsSet("evo.set", settings); syncSeasonUI(); refreshSeason(); };
  $("seaSeg").onclick = function (e) { var k = e.target.dataset && e.target.dataset.k; if (!k) return; settings.sea = k; lsSet("evo.set", settings); syncSeasonUI(); refreshSeason(); };
  $("pvGrid").onclick = function (e) { var b = e.target.closest("[data-pv]"); if (!b) return; PV = b.dataset.pv; hide(); refreshSeason(); go("home"); window.scrollTo(0, 0); };
  function pvStep(d) { var i = ORDER.indexOf(PV); PV = ORDER[(i + d + ORDER.length) % ORDER.length]; refreshSeason(); }
  $("pvPrev").onclick = function () { pvStep(-1); };
  $("pvNext").onclick = function () { pvStep(1); };
  $("pvDone").onclick = function () { PV = null; refreshSeason(); };
  document.addEventListener("visibilitychange", function () { if (!document.hidden && !PV) refreshSeason(); });

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
  function show(id) { hide(); $(id).hidden = false; open = id; }
  function hide() { ["shBooks", "shSet", "shVoice", "shCat"].forEach(function (i) { $(i).hidden = true; }); open = null; }
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
    if (open !== "shVoice") hide();
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
    $("votd").innerHTML = '<div class="lab">Ayat hari ini' + (th ? " · " + esc(th.n) : "") + '</div><p class="vt">' + esc(clean(texts[id])) + '</p><div class="vr">' + esc(refOf(id)) + '</div><div class="acts"><button data-act="read" data-id="' + id + '">Baca pasalnya</button><button data-act="copy" data-id="' + id + '">Salin</button></div>' + (activeSeasonId() ? '<div class="orn">' + ornSvg(activeSeasonId()) + "</div>" : "");
    var last = lsGet("evo.last", null), cont = $("cont");
    var ok = last && BOOKS[last.b] && BOOKS[last.b].ch[last.c - 1];
    if (!ok) last = { b: 0, c: 1 };
    cont.dataset.b = last.b; cont.dataset.c = last.c;
    cont.innerHTML = '<svg class="ico" viewBox="0 0 24 24" style="color:var(--accent)"><path d="M12 6c-2-1.5-5-2-8-2v14c3 0 6 .5 8 2 2-1.5 5-2 8-2V4c-3 0-6 .5-8 2z"/><path d="M12 6v14"/></svg><span class="t"><small>' + (ok ? "Lanjutkan membaca" : "Mulai membaca") + '</small><b>' + esc(BOOKS[last.b].n) + " " + last.c + "</b></span>";
    renderCats(); renderSeasonCard();
    renderInstall();
  }
  $("homeForm").onsubmit = function (e) { e.preventDefault(); var q = $("hq").value.trim(); if (!q) return; $("hq").blur(); startSearch(q); };
  $("vHome").addEventListener("click", function (e) {
    var t;
    if ((t = e.target.closest("[data-sref]"))) { var m = SEA[t.dataset.sref].v; openRef(bookIdx(m[0]), m[1], m[2]); return; }
    if ((t = e.target.closest("[data-cat]"))) { openCat(+t.dataset.cat); return; }
    if ((t = e.target.closest("[data-tema]"))) { openTheme(t.dataset.tema); return; }
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
      if (r.sel.length) html += '<div class="found">Cocok dengan tema: ' + r.sel.map(function (c) { return '<button class="tchip" style="--h:' + hueOf(c.k) + '" data-tema="' + c.k + '">' + esc(c.n) + "</button>"; }).join("") + "</div>";
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
    if ((t = e.target.closest("[data-tema]"))) { S.theme = t.dataset.tema; S.moreOpen = false; renderSearch(); window.scrollTo(0, 0); return; }
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
    if (T.on) markVerse();
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

  /* ---------- membacakan Alkitab (suara bawaan HP) ---------- */
  var synth = window.speechSynthesis, tts = lsGet("evo.tts", {}), RATES = [0.8, 0.9, 1, 1.15], voices = [], T = { on: false, paused: false, b: 0, c: 1, i: 0, tok: 0, errs: 0, list: null, k: 0 };
  if (tts.auto === undefined) tts.auto = true;
  if (!tts.rate) tts.rate = 0.9;
  function saveTTS() { lsSet("evo.tts", tts); }
  if (!synth || typeof SpeechSynthesisUtterance === "undefined") { $("btnListen").hidden = true; }
  function loadVoices() { try { voices = synth.getVoices() || []; } catch (e) { voices = []; } }
  if (synth) { loadVoices(); if (synth.addEventListener) synth.addEventListener("voiceschanged", loadVoices); else synth.onvoiceschanged = loadVoices; }
  function idVoices() { return voices.filter(function (v) { return /^(id|in)([-_]|$)/i.test(v.lang) || /indones/i.test(v.name); }); }
  function vscore(v) { return (/google|natural|neural|enhanced|premium/i.test(v.name + v.voiceURI) ? 3 : 0) + (v.localService ? 0 : 1); }
  function pickVoice() {
    var l = idVoices(), x = l.filter(function (v) { return v.voiceURI === tts.voice; })[0];
    if (x) return x;
    l.sort(function (a, b) { return vscore(b) - vscore(a); }); return l[0] || null;
  }
  function vtext(raw) { return raw.replace(/^¶/, "").replace(/^\(\d+-\d+\)\s*/, ""); }
  function say(text, done) {
    var u = new SpeechSynthesisUtterance(text), v = pickVoice(); u.lang = "id-ID";
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = tts.rate; u.pitch = 1;
    u.onend = function () { T.errs = 0; done(); };
    u.onerror = function (e) { if (e && (e.error === "canceled" || e.error === "interrupted")) return; if (++T.errs > 2) { stopTTS(); toast("Suara tidak bisa diputar di HP ini"); return; } done(); };
    synth.speak(u);
  }
  function markVerse() {
    Array.prototype.forEach.call(document.querySelectorAll(".v.speak"), function (el) { el.classList.remove("speak"); });
    if (!T.on || S.view !== "read" || S.b !== T.b || S.c !== T.c) return;
    var el = $("v" + (T.i + 1)); if (!el) return;
    el.classList.add("speak");
    var r = el.getBoundingClientRect(), H = window.innerHeight;
    if (r.top < 90 || r.bottom > H - 150) el.scrollIntoView({ block: "center", behavior: "smooth" });
  }
  function updatePlayer() {
    $("pTitle").textContent = BOOKS[T.b].n + " " + T.c + ":" + (T.i + 1);
    $("pPlay").textContent = T.paused ? "Lanjut" : "Jeda";
    $("pRate").textContent = tts.rate + "×";
    $("btnListen").classList.toggle("on", T.on);
  }
  function step(tok, intro) {
    if (tok !== T.tok || !T.on || T.paused) return;
    var ch = BOOKS[T.b].ch[T.c - 1];
    if (intro) { markVerse(); say(BOOKS[T.b].n + " pasal " + T.c, function () { step(tok, false); }); return; }
    if (T.list) {
      if (T.k >= T.list.length) { stopTTS(); return; }
      T.i = T.list[T.k] - 1;
      updatePlayer(); markVerse();
      say(vtext(ch.v[T.i]), function () { T.k++; step(tok, false); });
      return;
    }
    if (T.i >= ch.v.length) {
      var nx = nextOf(T.b, T.c);
      if (tts.auto && nx) {
        var follow = S.view === "read" && S.b === T.b && S.c === T.c;
        T.b = nx[0]; T.c = nx[1]; T.i = 0; updatePlayer();
        if (follow) openRef(T.b, T.c);
        step(tok, true);
      } else stopTTS();
      return;
    }
    updatePlayer(); markVerse();
    say(vtext(ch.v[T.i]), function () { T.i++; step(tok, false); });
  }
  function restartTTS() { synth.cancel(); T.tok++; T.paused = false; T.errs = 0; updatePlayer(); var tok = T.tok; setTimeout(function () { step(tok, false); }, 60); }
  function startTTS(b, c, i, intro, list) {
    synth.cancel(); T.tok++; T.on = true; T.paused = false; T.b = b; T.c = c; T.i = i; T.errs = 0; T.list = list || null; T.k = 0;
    document.body.classList.add("speaking"); $("player").hidden = false; updatePlayer();
    var tok = T.tok; setTimeout(function () { step(tok, !!intro); }, 60);
  }
  function stopTTS() {
    T.tok++; T.on = false; T.paused = false; try { synth.cancel(); } catch (e) {}
    document.body.classList.remove("speaking"); $("player").hidden = true; markVerse(); $("btnListen").classList.remove("on");
  }
  $("btnListen").onclick = function () {
    if (T.on) { stopTTS(); return; }
    if (S.sel.length) { var list = S.sel.slice().sort(function (a, b) { return a - b; }); startTTS(S.b, S.c, list[0] - 1, false, list); }
    else startTTS(S.b, S.c, 0, true);
  };
  $("pStop").onclick = stopTTS;
  $("pPlay").onclick = function () {
    if (!T.on) return;
    if (T.paused) restartTTS();
    else { T.paused = true; T.tok++; synth.cancel(); updatePlayer(); }
  };
  $("pRate").onclick = function () {
    var k = RATES.indexOf(tts.rate); tts.rate = RATES[(k + 1) % RATES.length]; saveTTS();
    if (T.on && !T.paused) restartTTS(); else updatePlayer();
  };
  function drawVoices() {
    var l = idVoices(), cur = pickVoice();
    $("vNote").textContent = l.length ? "Suara yang tersedia tergantung HP Anda. Ketuk satu suara untuk mencoba dan memilihnya." : "HP Anda belum punya suara bahasa Indonesia. Buka Pengaturan HP, cari “teks ke ucapan” (text-to-speech), lalu unduh bahasa Indonesia. Sementara itu, suara bawaan HP dipakai.";
    $("vList").innerHTML = l.map(function (v, n) {
      return '<button class="vopt' + (cur && cur.voiceURI === v.voiceURI ? " cur" : "") + '" data-u="' + esc(v.voiceURI) + '"><b>Suara ' + (n + 1) + '</b><small>' + esc(v.name) + " · " + esc(v.lang) + (v.localService ? "" : " · perlu internet") + "</small></button>";
    }).join("");
    $("vAuto").checked = !!tts.auto;
  }
  $("pVoice").onclick = function () { loadVoices(); drawVoices(); show("shVoice"); };
  $("vList").addEventListener("click", function (e) {
    var t = e.target.closest(".vopt"); if (!t) return;
    tts.voice = t.dataset.u; saveTTS(); drawVoices();
    var was = T.on && !T.paused; synth.cancel(); T.tok++;
    say("Selamat membaca Firman Tuhan.", function () { if (was) restartTTS(); });
  });
  $("vAuto").onchange = function () { tts.auto = this.checked; saveTTS(); };

  if ("serviceWorker" in navigator && location.protocol !== "file:") { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }

  applySettings();
  route();
})();
