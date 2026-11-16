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
  var S = { view: "home", b: 0, c: 1, sel: [], q: "", mode: "tema", theme: null, moreOpen: false, pendingAI: false, ai: null, histOpen: false };
  var hls = lsGet("evo.hl", {}), sors = lsGet("evo.sor", {});
  var SR_C = { y: "Kuning", g: "Hijau", b: "Biru", p: "Merah muda", o: "Oranye" };
  Object.keys(sors).forEach(function (k) { if (!SR_C[sors[k]]) sors[k] = "y"; });
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
  /* ---------- sesi renungan: 3x sehari (pagi 05-11:59, siang 12-16:59, malam 17-04:59) ---------- */
  // MODE UJI: true = kotak cerita selalu muncul & bisa dipakai berkali-kali (tanpa batas 3 sesi/hari). Ubah ke false untuk mengaktifkan batas lagi.
  var TEST_NO_LIMIT = false;
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
  function sesNextText() { if (TEST_NO_LIMIT) return "Mode uji: renungan dan doa bisa dicoba tanpa batas"; var k = sesNow().s.k; return k === "pagi" ? "Sesi siang dibuka pukul 12.00" : k === "siang" ? "Sesi malam dibuka pukul 17.00" : "Sesi pagi dibuka besok pukul 05.00"; }
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
    h += prayerBody(p).replace('(AYT)</div></div>', '(AYT)</div><button class="txtbtn" type="button" data-act="prread" data-id="' + p.id + '">Baca pasalnya</button></div>');
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

  function toast(m) { var t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3500); }
  function copyText(text, msg) {
    function done() { toast(msg || "Disalin"); }
    function fb() { var ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("Tidak bisa menyalin"); } document.body.removeChild(ta); }
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fb); else fb();
  }
  function verseCopy(id) { return clean(texts[id]) + "\n\n" + refOf(id) + " (AYT)"; }



  /* ---------- Info Gereja ---------- */
  // Daftar di bawah ini mudah ditambah: tambahkan satu baris pada CH_CFG.prot (sinode/denominasi baru)
  // atau CH_CFG.kat (jenis Katolik). Struktur aplikasi tidak perlu diubah.
  var CH_CFG = {
    kat: [["all", "Semua gereja Katolik"], ["katedral", "Katedral"], ["paroki", "Paroki"], ["gereja", "Gereja"], ["kapel", "Kapel"], ["stasi", "Stasi"], ["lain", "Lainnya"]],
    prot: [
      { id: "gki", n: "GKI", f: "Gereja Kristen Indonesia", re: /\bGKI\b|Gereja Kristen Indonesia/i },
      { id: "gpib", n: "GPIB", f: "Gereja Protestan di Indonesia bagian Barat", re: /\bGPIB\b|Gereja Protestan di Indonesia bagian Barat/i },
      { id: "hkbp", n: "HKBP", f: "Huria Kristen Batak Protestan", re: /\bHKBP\b|Huria Kristen Batak Protestan/i },
      { id: "gkj", n: "GKJ", f: "Gereja Kristen Jawi Wetan / Jawa", re: /\bGKJ\b|Gereja Kristen Jawa|Gereja Kristen Jawi/i },
      { id: "gmim", n: "GMIM", f: "Gereja Masehi Injili di Minahasa", re: /\bGMIM\b|Gereja Masehi Injili di Minahasa/i },
      { id: "gbi", n: "GBI", f: "Gereja Bethel Indonesia", re: /\bGBI\b|Gereja Bethel Indonesia/i },
      { id: "gpdi", n: "GPdI", f: "Gereja Pantekosta di Indonesia", re: /\bGPdI\b|Gereja Pantekosta di Indonesia/i },
      { id: "gsja", n: "GSJA", f: "Gereja Sidang Jemaat Allah", re: /\bGSJA\b|Gereja Sidang Jemaat Allah/i },
      { id: "advent", n: "Gereja Advent", f: "Gereja Masehi Advent Hari Ketujuh", re: /Advent|\bGMAHK\b/i, den: /adventist/i },
      { id: "baptis", n: "Gereja Baptis", f: "Gereja Baptis", re: /Baptis|Baptist/i, den: /baptist/i }
    ],
    prot_any: /protestant|evangelical|pentecostal|charismatic|lutheran|methodist|presbyterian|reformed|anglican|calvinist|mennonite|salvation_army|apostolic|nazarene|assemblies/i,
    kat_name: /\b(katolik|katedral|paroki|stasi|basilika)\b/i,
    radii: [5, 10, 20],
    endpoints: ["https://overpass-api.de/api/interpreter", "https://overpass.kumi.systems/api/interpreter", "https://overpass.private.coffee/api/interpreter"]
  };
  // Sakelar fitur: ubah menjadi true untuk menampilkan kembali tab Gereja (kodenya tetap ada).
  var FEATURE_CHURCH = false;
  if (!FEATURE_CHURCH) { document.querySelector('.tab[data-v="church"]').hidden = true; $("chSeg").parentNode.hidden = true; }
  var CH = Object.assign({ trad: null, kat: "all", prot: "all", rad: 5, place: null }, lsGet("evo.church", {}));
  CH.q = ""; CH.dq = ""; CH.items = []; CH.status = "idle"; CH.shown = 40;
  function saveCH() { lsSet("evo.church", { trad: CH.trad, kat: CH.kat, prot: CH.prot, rad: CH.rad, place: CH.place }); }
  function chType(t, name) {
    var b = (t.building || "").toLowerCase();
    if (b === "cathedral" || /\bkatedral\b|cathedral/i.test(name)) return "katedral";
    if (/\bparoki\b/i.test(name)) return "paroki";
    if (/\bstasi\b/i.test(name)) return "stasi";
    if (b === "chapel" || /\b(kapel|capel|chapel)\b/i.test(name)) return "kapel";
    if (b === "church" || /\bgereja\b|\bchurch\b|\bbasilika\b/i.test(name)) return "gereja";
    return "lain";
  }
  function chClassify(t) {
    var name = t.name || t["name:id"] || t["name:en"] || "", den = (t.denomination || "").toLowerCase(), trad = "", syn = "";
    if (/catholic|katolik/.test(den) || CH_CFG.kat_name.test(name)) trad = "katolik";
    else {
      for (var i = 0; i < CH_CFG.prot.length; i++) { var p = CH_CFG.prot[i]; if (p.re.test(name) || (p.den && p.den.test(den))) { trad = "protestan"; syn = p.id; break; } }
      if (!trad && CH_CFG.prot_any.test(den)) { trad = "protestan"; syn = "lain"; }
      if (!trad && /orthodox/.test(den)) trad = "ortodoks";
    }
    var a = [t["addr:street"], t["addr:housenumber"]].filter(Boolean).join(" "), place = t["addr:suburb"] || t["addr:city"] || t["addr:district"] || "";
    return { name: name, trad: trad, syn: syn, den: den, type: chType(t, name), addr: [a, place].filter(Boolean).join(", "), phone: t.phone || t["contact:phone"] || "", web: t.website || t["contact:website"] || "", times: t.service_times || "" };
  }
  function chSynName(it) {
    if (it.trad === "katolik") return "Katolik";
    if (it.trad === "ortodoks") return "Ortodoks";
    if (it.trad === "protestan") { for (var i = 0; i < CH_CFG.prot.length; i++) if (CH_CFG.prot[i].id === it.syn) return CH_CFG.prot[i].n; var M = { pentecostal: "Pentakosta", lutheran: "Lutheran", methodist: "Methodis", presbyterian: "Presbiterian", reformed: "Reformed", anglican: "Anglikan", evangelical: "Injili", charismatic: "Karismatik", calvinist: "Calvinis", apostolic: "Apostolik", mennonite: "Mennonit", nazarene: "Nazarene", assemblies: "Sidang Jemaat" }, k = it.den.split(/[;_ ]/)[0]; return M[k] ? "Protestan · " + M[k] : "Protestan (lainnya)"; }
    return "";
  }
  function chTypeName(k) { for (var i = 0; i < CH_CFG.kat.length; i++) if (CH_CFG.kat[i][0] === k) return CH_CFG.kat[i][1]; return "Lainnya"; }
  function haversine(a, b, c, d) { var R = 6371, r = Math.PI / 180, dl = (c - a) * r, dg = (d - b) * r, x = Math.sin(dl / 2) * Math.sin(dl / 2) + Math.cos(a * r) * Math.cos(c * r) * Math.sin(dg / 2) * Math.sin(dg / 2); return 2 * R * Math.asin(Math.sqrt(x)); }
  function chPass(it) {
    if (CH.trad === "katolik") { if (it.trad !== "katolik") return false; if (CH.kat !== "all" && it.type !== CH.kat) return false; }
    else if (CH.trad === "protestan") { if (it.trad !== "protestan") return false; if (CH.prot !== "all" && it.syn !== CH.prot) return false; }
    if (CH.q) { var q = norm(CH.q); if (norm(it.name).indexOf(q) < 0 && norm(chSynName(it)).indexOf(q) < 0) return false; }
    return true;
  }
  function drawChTrad() {
    Array.prototype.forEach.call($("chTrad").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.t === CH.trad)); });
    Array.prototype.forEach.call($("chSeg").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.k === CH.trad)); });
    var html = "";
    if (CH.trad === "katolik") {
      html = '<div class="flabel sub">Jenis gereja</div><div class="fchips">' + CH_CFG.kat.map(function (k) { return '<button type="button" class="fchip" data-kat="' + k[0] + '" aria-pressed="' + (CH.kat === k[0]) + '">' + esc(k[1]) + "</button>"; }).join("") + "</div>";
    } else if (CH.trad === "protestan") {
      var q = norm(CH.dq), list = [{ id: "all", n: "Semua Protestan" }].concat(CH_CFG.prot.filter(function (p) { return !q || norm(p.n + " " + p.f).indexOf(q) >= 0; })).concat([{ id: "lain", n: "Gereja lainnya" }]);
      html = '<div class="flabel sub">Denominasi atau sinode</div><input class="chdq" id="chDq" type="search" placeholder="Cari denominasi atau sinode" autocomplete="off" value="' + esc(CH.dq) + '" aria-label="Cari denominasi atau sinode"><div class="fchips">'
        + list.map(function (p) { return '<button type="button" class="fchip" data-prot="' + p.id + '" aria-pressed="' + (CH.prot === p.id) + '">' + esc(p.n) + "</button>"; }).join("") + "</div>"
        + (q && list.length <= 2 ? '<p class="vnote">Tidak ada di daftar. Pilih &ldquo;Gereja lainnya&rdquo;, atau ketik namanya pada kolom Cari nama gereja.</p>' : "");
    } else if (CH.trad === "semua") {
      html = '<p class="vnote">Menampilkan semua gereja Kristen di sekitar, termasuk yang belum teridentifikasi tradisinya.</p>';
    } else html = '<p class="vnote">Pilih tradisi gereja Anda. Pilihan ini diingat untuk pencarian berikutnya.</p>';
    $("chSub").innerHTML = html;
    if (CH.trad === "protestan") { var el = $("chDq"); if (CH._dqFocus) { el.focus(); try { el.setSelectionRange(el.value.length, el.value.length); } catch (x) {} CH._dqFocus = false; } }
  }
  function drawChRad() { $("chRad").innerHTML = CH_CFG.radii.map(function (r) { return '<button type="button" data-r="' + r + '" aria-pressed="' + (CH.rad === r) + '">' + r + " km</button>"; }).join(""); }
  function drawChList() {
    var st = $("chStat"), ls = $("chList");
    $("chPlaceNote").textContent = CH.place ? "Mencari di sekitar: " + CH.place.label : "Belum ada lokasi. Tekan Gunakan lokasi saya, atau ketik nama kota.";
    if (!CH.trad) { st.textContent = ""; ls.innerHTML = ""; return; }
    if (CH.status === "load") { st.textContent = ""; ls.innerHTML = '<div class="wait"><span class="dots"><i></i><i></i><i></i></span> Mencari gereja…</div>'; return; }
    if (CH.status === "err") { st.textContent = ""; ls.innerHTML = '<div class="empty"><p style="margin:0 0 8px;font-weight:700;color:var(--fg)">Data gereja belum bisa dimuat</p>' + esc(CH.lastErr || "Periksa sambungan internet") + '.<br><button class="btn" id="chRetry" type="button" style="margin-top:12px">Coba lagi</button></div>'; return; }
    if (!CH.place || CH.status === "idle") { st.textContent = ""; ls.innerHTML = ""; return; }
    var all = CH.items.map(function (it) { it.dist = haversine(CH.place.lat, CH.place.lon, it.lat, it.lon); return it; }).sort(function (a, b) { return a.dist - b.dist; });
    var res = all.filter(chPass), unk = all.filter(function (it) { return !it.trad; }).length;
    st.textContent = res.length + " gereja ditemukan dalam " + CH.rad + " km" + (CH.trad !== "semua" && unk ? " · " + unk + " belum teridentifikasi (lihat di Semua denominasi)" : "");
    if (!res.length) { ls.innerHTML = '<div class="empty"><p style="margin:0 0 6px;font-weight:700;color:var(--fg)">Belum ada hasil</p>Coba perluas jarak, ubah pilihan di atas, atau pilih Semua denominasi.</div>'; return; }
    ls.innerHTML = res.slice(0, CH.shown).map(function (it) {
      var dn = chSynName(it), km = it.dist < 1 ? Math.round(it.dist * 1000) + " m" : it.dist.toFixed(1) + " km";
      return '<article class="chrow"><div class="chtop"><h3>' + esc(it.name || "Gereja tanpa nama") + '</h3><span class="chdist">' + km + '</span></div><div class="chbadges"><span class="b-den' + (dn ? "" : " unk") + '">' + esc(dn || "Belum teridentifikasi") + '</span><span class="b-type">' + esc(chTypeName(it.type)) + "</span></div>"
        + (it.addr ? '<p class="chaddr">' + esc(it.addr) + "</p>" : "") + (it.times ? '<p class="chtimes">Jadwal: ' + esc(it.times) + "</p>" : "")
        + '<div class="chacts"><a class="chbtn" target="_blank" rel="noopener" href="https://www.google.com/maps/dir/?api=1&destination=' + it.lat + "," + it.lon + '">Rute</a>'
        + (it.phone ? '<a class="chbtn" href="tel:' + esc(it.phone.replace(/[^+\d]/g, "")) + '">Telepon</a>' : "")
        + (/^https?:\/\//i.test(it.web) ? '<a class="chbtn" target="_blank" rel="noopener" href="' + esc(it.web) + '">Situs</a>' : "") + "</div></article>";
    }).join("") + (res.length > CH.shown ? '<button class="more" id="chMore" type="button">Lihat lebih banyak</button>' : "");
  }
  function renderChurch() { drawChTrad(); drawChRad(); drawChList(); if (CH.place && CH.status === "idle" && CH.trad) loadChurches(); }
  function chFetch(query, i) {
    i = i || 0;
    var ctl = new AbortController(), to = setTimeout(function () { ctl.abort(); }, 30000);
    var url = CH_CFG.endpoints[i] + "?data=" + encodeURIComponent(query);
    return fetch(url, { method: "GET", signal: ctl.signal, cache: "no-store" })
      .then(function (r) {
        clearTimeout(to);
        if (!r.ok) { var err = new Error("HTTP " + r.status); err.code = r.status; throw err; }
        return r.text().then(function (t) { try { return JSON.parse(t); } catch (e) { var er = new Error("format"); er.code = "format"; throw er; } });
      })
      .catch(function (e) {
        clearTimeout(to);
        CH.lastErr = (e && e.name === "AbortError") ? "Waktu habis (server terlalu lama menjawab)" : (e && e.code === "format") ? "Server mengirim data yang tidak terbaca" : (e && e.code) ? "Server peta menolak permintaan (kode " + e.code + ")" : "Tidak bisa terhubung ke server peta";
        if (i + 1 < CH_CFG.endpoints.length) return chFetch(query, i + 1);
        throw e;
      });
  }
  function loadChurches() {
    var p = CH.place; if (!p) return;
    var key = p.lat.toFixed(2) + "," + p.lon.toFixed(2) + "," + CH.rad, c = lsGet("evo.churchc", null);
    if (c && c.k === key && Date.now() - c.t < 6 * 36e5 && c.items) { CH.items = c.items; CH.status = "ok"; CH.shown = 40; drawChList(); return; }
    CH.status = "load"; drawChList();
    var q = "[out:json][timeout:25];nwr(around:" + CH.rad * 1000 + "," + p.lat + "," + p.lon + ")[amenity=place_of_worship][religion=christian];out center 400 tags;";
    chFetch(q).then(function (d) {
      var seen = {};
      CH.items = (d.elements || []).map(function (e) {
        var lat = e.lat !== undefined ? e.lat : e.center && e.center.lat, lon = e.lon !== undefined ? e.lon : e.center && e.center.lon;
        if (lat === undefined || lon === undefined) return null;
        var it = chClassify(e.tags || {}); it.lat = lat; it.lon = lon; return it;
      }).filter(function (it) { if (!it) return false; var k = it.name + "|" + it.lat.toFixed(4) + "|" + it.lon.toFixed(4); if (seen[k]) return false; seen[k] = 1; return true; });
      CH.status = "ok"; CH.shown = 40; lsSet("evo.churchc", { k: key, t: Date.now(), items: CH.items }); drawChList();
    }).catch(function () { CH.status = "err"; drawChList(); });
  }
  function setPlace(lat, lon, label) { CH.place = { lat: lat, lon: lon, label: label }; CH.status = "idle"; saveCH(); drawChList(); if (CH.trad) loadChurches(); }
  function setTrad(t) { CH.trad = t; saveCH(); drawChTrad(); drawChList(); if (CH.place && CH.status === "idle") loadChurches(); }
  $("chTrad").onclick = function (e) { var b = e.target.closest("button"); if (b) setTrad(b.dataset.t); };
  $("chSeg").onclick = function (e) { var k = e.target.dataset && e.target.dataset.k; if (k) setTrad(k); };
  $("chSub").addEventListener("click", function (e) {
    var b = e.target.closest("button"); if (!b) return;
    if (b.dataset.kat) CH.kat = b.dataset.kat; else if (b.dataset.prot) CH.prot = b.dataset.prot; else return;
    saveCH(); drawChTrad(); CH.shown = 40; drawChList();
  });
  $("chSub").addEventListener("input", function (e) { if (e.target.id !== "chDq") return; CH.dq = e.target.value; CH._dqFocus = true; drawChTrad(); });
  $("chRad").onclick = function (e) { var b = e.target.closest("button"); if (!b) return; CH.rad = +b.dataset.r; CH.status = "idle"; saveCH(); drawChRad(); if (CH.place && CH.trad) loadChurches(); else drawChList(); };
  $("chQ").addEventListener("input", function () { CH.q = this.value; CH.shown = 40; drawChList(); });
  $("chList").addEventListener("click", function (e) { if (e.target.closest("#chRetry")) { CH.status = "idle"; loadChurches(); } else if (e.target.closest("#chMore")) { CH.shown += 40; drawChList(); } });
  $("chLoc").onclick = function () {
    if (!navigator.geolocation) { toast("HP ini tidak mendukung lokasi. Ketik nama kota."); return; }
    $("chPlaceNote").textContent = "Mencari lokasi Anda…";
    navigator.geolocation.getCurrentPosition(function (pos) { setPlace(pos.coords.latitude, pos.coords.longitude, "Lokasi Anda"); }, function () { drawChList(); toast("Lokasi tidak diizinkan. Ketik nama kota di bawahnya."); }, { timeout: 12000, maximumAge: 300000 });
  };
  $("chPlaceForm").onsubmit = function (e) {
    e.preventDefault(); var q = $("chPlace").value.trim(); if (!q) return; try { $("chPlace").blur(); } catch (x) {}
    $("chPlaceNote").textContent = "Mencari “" + q + "”…";
    fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=id&q=" + encodeURIComponent(q)).then(function (r) { return r.json(); }).then(function (d) {
      if (!d || !d.length) { drawChList(); toast("Tempat tidak ditemukan"); return; }
      setPlace(+d[0].lat, +d[0].lon, d[0].display_name.split(",").slice(0, 2).join(",").trim());
    }).catch(function () { drawChList(); toast("Gagal mencari tempat. Periksa internet."); });
  };
  drawChTrad();

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
  (function () { var y0 = null; var dr = $("shSeason"); dr.addEventListener("touchstart", function (e) { y0 = e.touches[0].clientY; }, { passive: true }); dr.addEventListener("touchend", function (e) { if (y0 !== null && e.changedTouches[0].clientY - y0 < -50) hide(); y0 = null; }); })();

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
    return '<div class="lab">Injil hari ini · bacaan Misa</div><p class="vt">' + esc(katText(g, 230)) + '</p><div class="vr">' + esc(g.label) + '</div><div class="acts"><button data-kat="read">Baca dan dengarkan</button><button data-kat="copy">Salin</button><button data-mkimg="1">Buat gambar</button></div>';
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
  function hide() { ["shBooks", "shSet", "shVoice", "shCat", "shSeason", "shTrad", "shExit", "shTts"].forEach(function (i) { $(i).hidden = true; }); open = null; }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) hide(); else if (e.target.classList && e.target.classList.contains("scrim")) hide();
  });
  $("btnSet").onclick = $("btnSet2").onclick = function () { show("shSet"); };

  /* ---------- routing ---------- */
  var VIEWS = { home: "vHome", search: "vSearch", read: "vRead", saved: "vSaved", church: "vChurch" };
  var NAMES = { home: "beranda", search: "cari", read: "baca", saved: "tersimpan", church: "gereja" };
  function go(v) { var h = NAMES[v]; if (location.hash.slice(1) === h) route(); else if (NAV_REPLACE) { curHash = "#" + h; history.replaceState(history.state, "", curHash); route(); } else location.hash = h; }
  function openRef(b, c, v, v2) { var h = BOOKS[b].a + "-" + c + (v ? "-" + v + (v2 && v2 >= v ? "-" + v2 : "") : ""); if (location.hash.slice(1) === h) route(); else if (NAV_REPLACE) { curHash = "#" + h; history.replaceState(history.state, "", curHash); route(); } else location.hash = h; }
  function showView(v) {
    S.view = v;
    Object.keys(VIEWS).forEach(function (k) { $(VIEWS[k]).hidden = k !== v; });
    Array.prototype.forEach.call(document.querySelectorAll(".tab"), function (t) { if (t.dataset.v === v) t.setAttribute("aria-current", "page"); else t.removeAttribute("aria-current"); });
    if (v !== "read") clearSel(true);
  }
  function route() {
    if (open !== "shVoice") hide();
    var h = decodeURIComponent(location.hash.slice(1)), m = /^([A-Za-z0-9]+)-(\d+)(?:-(\d+)(?:-(\d+))?)?$/.exec(h);
    if (m) {
      for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].a === m[1]) {
        var c = Math.min(Math.max(1, +m[2]), BOOKS[i].ch.length), v = m[3] ? Math.min(+m[3], BOOKS[i].ch[c - 1].v.length) : 0;
        showView("read"); renderChapter(i, c, v, m[4] ? Math.min(+m[4], BOOKS[i].ch[c - 1].v.length) : 0); return;
      }
    }
    if (h === "cari") { showView("search"); renderSearch(); if (!S.q && !S.theme) { try { $("q").focus(); } catch (e) {} } window.scrollTo(0, 0); return; }
    if (h === "gereja" && FEATURE_CHURCH) { showView("church"); renderChurch(); window.scrollTo(0, 0); return; }
    if (h === "tersimpan" || h === "sorotan") { showView("saved"); renderSaved(); window.scrollTo(0, 0); return; }
    if (h === "baca") { var last = lsGet("evo.last", { b: 0, c: 1 }); if (!BOOKS[last.b] || !BOOKS[last.b].ch[last.c - 1]) last = { b: 0, c: 1 }; showView("read"); renderChapter(last.b, last.c, 0); return; }
    showView("home"); renderHome(); window.scrollTo(0, 0);
  }
  window.addEventListener("hashchange", function () { if (!NAV_REPLACE) route(); });
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
    $("votd").innerHTML = '<div class="lab">Ayat hari ini' + (th ? " · " + esc(th.n) : "") + '</div><p class="vt">' + esc(clean(texts[id])) + '</p><div class="vr">' + esc(refOf(id)) + '</div><div class="acts"><button data-act="read" data-id="' + id + '">Baca pasalnya</button><button data-act="copy" data-id="' + id + '">Salin</button><button data-mkimg="1">Buat gambar</button></div>' + (activeSeasonId() ? '<div class="orn">' + ornSvg(activeSeasonId()) + "</div>" : "");
    var kg = settings.cal === "katolik" ? katToday() : null;
    if (kg) { $("votd").innerHTML = katVotd(kg) + (activeSeasonId() ? '<div class="orn">' + ornSvg(activeSeasonId()) + "</div>" : ""); $("votd").dataset.kat = "1"; } else delete $("votd").dataset.kat;
    var last = lsGet("evo.last", null), cont = $("cont");
    var ok = last && BOOKS[last.b] && BOOKS[last.b].ch[last.c - 1];
    if (!ok) last = { b: 0, c: 1 };
    cont.dataset.b = last.b; cont.dataset.c = last.c;
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
    h += '</div><p class="note">' + esc(sesNextText()) + ". Renungan bisa dipakai tiga kali sehari: pagi, siang, dan malam.</p>";
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
  function startSearch(q) { S.q = q; S.theme = null; S.mode = "tema"; S.ai = null; S.pr = null; S.pendingAI = true; $("q").value = q; syncMode(); pushRecent(q); go("search"); }
  function openTheme(k) { S.theme = k; S.moreOpen = false; go("search"); }
  function pushRecent(q) { q = q.trim(); if (q.length < 3) return; recent = [q].concat(recent.filter(function (x) { return x !== q; })).slice(0, 6); lsSet("evo.recent", recent); }
  function syncMode() { Array.prototype.forEach.call($("mode").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.m === S.mode)); }); $("qclr").hidden = !$("q").value; }
  $("mode").onclick = function (e) { var m = e.target.dataset && e.target.dataset.m; if (!m) return; S.mode = m; S.theme = null; S.pendingAI = false; syncMode(); renderSearch(); };
  var qT;
  $("q").addEventListener("input", function () { S.q = $("q").value; S.theme = null; S.ai = null; S.pendingAI = false; syncMode(); clearTimeout(qT); qT = setTimeout(renderSearch, 160); });
  $("sForm").onsubmit = function (e) { e.preventDefault(); $("q").blur(); S.q = $("q").value; pushRecent(S.q); S.ai = null; S.pr = null; S.pendingAI = S.mode === "tema"; renderSearch(); };
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
      '<button class="mini-ib" data-act="copy" aria-label="Salin ayat">' + COPY_I + '</button><button class="mini-ib" data-act="save" aria-pressed="' + (!!hls[keyOf(id)]) + '" aria-label="Simpan ayat">' + SAVE_I + "</button></div></div>";
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
      if (se && se.key === key) html += '<p class="hint">' + esc(sesNextText()) + ". Satu renungan untuk setiap sesi: pagi, siang, dan malam.</p>" + histPart();
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
    if (t && /^pr(copy|share|save)$/.test(t.dataset.act)) {
      var p0 = S.pr && S.pr.state === "done" ? S.pr.data : null; if (!p0) return;
      if (t.dataset.act === "prcopy") copyText(prayerOnly(p0), "Doa disalin");
      else if (t.dataset.act === "prshare") { if (navigator.share) navigator.share({ title: p0.judul, text: prayerText(p0) }).catch(function () {}); else copyText(prayerText(p0), "Renungan dan doa disalin"); }
      else if (!journalHas(p0)) { var J = journal(); var je0 = { id: uuid(), t: Date.now(), q: S.q.trim(), p: p0 }; J.unshift(je0); lsSet("evo.jurnal", J.slice(0, 500)); cloudJr(je0); t.textContent = "Tersimpan di Jurnal Doa"; toast("Disimpan ke Jurnal Doa (tab Tersimpan)"); }
      return;
    }
    if (t && (t.dataset.act === "copy" || t.dataset.act === "save")) {
      var cardEl = t.closest(".rcard"), id = +cardEl.dataset.id;
      if (t.dataset.act === "copy") copyText(verseCopy(id)); else toggleHl(id, t);
      return;
    }
    if ((t = e.target.closest("[data-q]"))) { S.q = t.dataset.q; $("q").value = S.q; S.theme = null; S.ai = null; S.pr = null; S.pendingAI = S.mode === "tema"; pushRecent(S.q); renderSearch(); return; }
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
    if (t && t.dataset.act === "copy") { copyText(verseCopy(id)); return; }
    if (t && t.dataset.act === "save") { toggleHl(id, t); renderSaved(); return; }
    openRef(bOf[id], cOf[id], vOf[id]);
  });
  $("svCopy").onclick = function () { var ids = $("svBody").dataset.ids.split(",").filter(Boolean).map(Number); copyText(ids.map(function (id) { return clean(texts[id]) + "\n" + refOf(id) + " (AYT)"; }).join("\n\n"), "Semua ayat tersimpan disalin"); };

  /* ---------- baca ---------- */
  function renderChapter(b, c, vFocus, vEnd) {
    var bk = BOOKS[b], ch = bk.ch[c - 1];
    S.b = b; S.c = c; clearSel(true);
    if (FIND.b !== b) { FIND.b = b; syncFinders(); }
    $("locText").textContent = bk.n + " " + c; $("chBook").textContent = bk.n; $("chNum").textContent = "Pasal " + c;
    var h = ch.h || {}, html = "", op = false;
    ch.v.forEach(function (raw, i) {
      var n = i + 1, brk = i === 0 || raw.charAt(0) === "¶" || h[i] !== undefined;
      if (brk) { if (op) html += "</p>"; if (h[i] !== undefined) html += "<h3>" + esc(h[i]) + "</h3>"; html += "<p>"; op = true; }
      html += '<span class="v' + (hls[b + ":" + c + ":" + n] ? " hl" : "") + (sors[b + ":" + c + ":" + n] ? " sr sr-" + sors[b + ":" + c + ":" + n] : "") + '" data-v="' + n + '" id="v' + n + '"><b class="vn">' + n + "</b>" + esc(plain(raw)) + " </span>";
    });
    if (op) html += "</p>";
    $("text").innerHTML = html;
    setNav($("prev"), prevOf(b, c)); setNav($("next"), nextOf(b, c));
    lsSet("evo.last", { b: b, c: c });
    if (T.on) markVerse();
    if (vFocus && $("v" + vFocus)) { var el = $("v" + vFocus); el.scrollIntoView({ block: "center" }); el.classList.add("flash"); } else window.scrollTo(0, 0);
    if (vFocus && vEnd >= vFocus) { for (var n = vFocus; n <= vEnd; n++) { var e2 = $("v" + n); if (e2) { S.sel.push(n); e2.classList.add("sel"); } } S.quiet = true; updateSel(); }
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
    var body = s.map(function (n) { var t = clean(ch.v[n - 1]); return s.length > 1 ? n + " " + t : t; }).join("\n");
    return body + "\n\n" + bk.n + " " + S.c + ":" + rangeStr(s) + " (AYT)";
  }
  $("selCopy").onclick = function () { copyText(selText()); clearSel(); };
  $("selShare").onclick = function () { var t = selText(); if (navigator.share) navigator.share({ text: t }).catch(function () {}); else copyText(t); clearSel(); };
  (function () {
    // geser panel ke bawah untuk menyembunyikan
    var sh = $("selbar"), y0 = null, dy = 0, pid = null;
    sh.addEventListener("pointerdown", function (e) { if (e.target.closest("button")) return; y0 = e.clientY; dy = 0; pid = e.pointerId; sh.classList.add("drag"); try { sh.setPointerCapture(pid); } catch (x) {} });
    sh.addEventListener("pointermove", function (e) { if (y0 === null) return; dy = Math.max(0, e.clientY - y0); sh.style.transform = "translateY(" + dy + "px)"; });
    function up() { if (y0 === null) return; y0 = null; sh.classList.remove("drag"); sh.style.transform = ""; if (dy > 60) { S.selHidden = true; updateSel(); } }
    sh.addEventListener("pointerup", up); sh.addEventListener("pointercancel", up);
  })();

  /* ---------- pilih kitab ---------- */
  var tab = 0, pick = -1, fmode = false, bq = "";
  function norm(s) { return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim(); }
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
      + '<i class="dash">\u2013</i>'
      + '<input class="fn fv2" data-k="v2" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="s/d" aria-label="Sampai ayat" enterkeyhint="go">'
      + '</div><button class="fgo" type="submit">Buka ayat</button></form>';
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
  FIND.b = (function () { var l = lsGet("evo.last", null); return l && BOOKS[l.b] ? l.b : 0; })();
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
  // Cara bicara dicoba bertahap: 0 = suara Indonesia terpilih, 1 = hanya bahasa id-ID, 2 = suara bawaan HP.
  // Cara yang berhasil diingat untuk HP ini (tts.mode).
  function say(text, done, mode) {
    if (mode === undefined) mode = tts.mode || 0;
    var u = new SpeechSynthesisUtterance(text), v = mode === 0 ? pickVoice() : null;
    if (mode < 2) u.lang = "id-ID";
    if (v) { u.voice = v; u.lang = String(v.lang || "id-ID").replace("_", "-"); }
    u.rate = tts.rate; u.pitch = 1;
    u.onend = function () { T.errs = 0; if ((tts.mode || 0) !== mode) { tts.mode = mode; saveTTS(); } done(); };
    u.onerror = function (e) {
      if (e && (e.error === "canceled" || e.error === "interrupted")) return;
      T.lastErr = ((e && e.error) || "tidak diketahui") + " (cara " + (mode + 1) + ")";
      if (mode < 2 && T.on) { say(text, done, mode + 1); return; }
      if (++T.errs > 2) { stopTTS(); ttsHelp(T.lastErr); return; }
      done();
    };
    try { if (synth.paused) synth.resume(); } catch (x) {}
    synth.speak(u);
  }
  function ttsHelp(code) {
    var n = idVoices().length;
    $("ttsCode").textContent = "Keterangan teknis: " + code + " · suara Indonesia di HP ini: " + n + " · total suara: " + voices.length;
    show("shTts");
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
  function restartTTS() { if (synth.speaking || synth.pending) synth.cancel(); T.tok++; T.paused = false; T.errs = 0; updatePlayer(); var tok = T.tok; setTimeout(function () { step(tok, false); }, 60); }
  function startTTS(b, c, i, intro, list) {
    if (synth.speaking || synth.pending) synth.cancel(); T.tok++; T.on = true; T.paused = false; T.b = b; T.c = c; T.i = i; T.errs = 0; T.list = list || null; T.k = 0;
    document.body.classList.add("speaking"); $("player").hidden = false; updatePlayer();
    var tok = T.tok; setTimeout(function () { step(tok, !!intro); }, 60);
  }
  function stopTTS() {
    T.tok++; T.on = false; T.paused = false; try { synth.cancel(); } catch (e) {}
    document.body.classList.remove("speaking"); $("player").hidden = true; markVerse(); $("btnListen").classList.remove("on");
  }
  $("btnListen").onclick = function () {
    if (T.on) { stopTTS(); return; }
    if (voices.length && !idVoices().length && !tts.warned) { tts.warned = true; saveTTS(); ttsHelp("tidak ada suara Bahasa Indonesia"); return; }
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

  /* ---------- akun Google & sinkron (Supabase) ---------- */
  var SB_URL = "https://ddydxagduxhzzsrlwgkd.supabase.co", SB_KEY = "sb_publishable_x1LuicZ10JRKUVeio9WsRw_BgAsA9oQ";
  var sb = null, user = null, syncing = false, googleOn = false;
  try { if (window.supabase && window.supabase.createClient) sb = window.supabase.createClient(SB_URL, SB_KEY, { auth: { flowType: "pkce", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true } }); } catch (e) { sb = null; }
  function noop() {}
  function uuid() { if (window.crypto && crypto.randomUUID) return crypto.randomUUID(); var a = new Uint8Array(16); crypto.getRandomValues(a); a[6] = (a[6] & 15) | 64; a[8] = (a[8] & 63) | 128; var h = Array.prototype.map.call(a, function (b) { return ("0" + b.toString(16)).slice(-2); }).join(""); return h.slice(0, 8) + "-" + h.slice(8, 12) + "-" + h.slice(12, 16) + "-" + h.slice(16, 20) + "-" + h.slice(20); }
  function pend() { var P = lsGet("evo.pend", null); if (!(P && P.hl && P.jr)) return { hl: [], jr: [], sr: [] }; if (!P.sr) P.sr = []; return P; }
  function jrow(e) { return { id: e.id, user_id: user.id, dibuat: new Date(e.t || Date.now()).toISOString(), cerita: String(e.q || "").slice(0, 600), data: e.p }; }
  function signIn() {
    if (!sb) { toast("Login belum bisa dimuat. Periksa internet lalu coba lagi."); return; }
    if (navigator.onLine === false) { toast("Butuh internet untuk masuk."); return; }
    sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: location.origin + location.pathname } }).then(function (r) { if (r && r.error) toast("Gagal membuka login Google."); });
  }
  function signOut() { if (!sb) return; sb.auth.signOut().then(function () { user = null; renderAkun(); toast("Anda sudah keluar. Simpanan tetap ada di HP ini."); }); }
  function renderAkun() {
    var box = $("acct"); if (!box) return;
    if (!sb) { box.innerHTML = '<p class="acct-t">Akun</p><p class="acct-s">Login sedang tidak tersedia. Periksa internet lalu buka ulang aplikasi.</p>'; return; }
    if (!user && !googleOn) { box.innerHTML = ""; box.hidden = true; return; }
    box.hidden = false;
    if (!user) { box.innerHTML = '<p class="acct-t">Akun</p><p class="acct-s">Masuk dengan Google supaya ayat tersimpan dan Jurnal Doa tersimpan selamanya di akun Anda dan bisa dibuka di HP lain.</p><button class="btn pri gbtn" type="button" data-login="1">' + G_I + "Masuk dengan Google</button>"; return; }
    var m = user.user_metadata || {}, nm = m.full_name || m.name || "", em = user.email || "";
    box.innerHTML = '<p class="acct-t">Akun</p><div class="acct-u">' + (m.avatar_url ? '<img src="' + esc(m.avatar_url) + '" alt="" referrerpolicy="no-referrer">' : "") + "<div><b>" + esc(nm || em) + "</b>" + (nm && em ? "<small>" + esc(em) + "</small>" : "") + '<small class="ok">' + (syncing ? "Menyinkronkan…" : "Ayat dan Jurnal Doa tersimpan di akun") + '</small></div></div><button class="btn sec" type="button" data-logout="1">Keluar</button>';
  }
  var G_I = '<svg class="gico" viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>';
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-login]")) { e.preventDefault(); signIn(); return; }
    if (e.target.closest("[data-logout]")) { e.preventDefault(); signOut(); return; }
    var tb = e.target.closest("[data-trad]");
    if (tb) { var k = tb.dataset.trad; settings.cal = k; lsSet("evo.set", settings); syncSeasonUI(); refreshSeason(); cloudTradisi(k); hide(); toast(k === "katolik" ? "Gaya doa: Katolik" : "Gaya doa: Kristen Protestan"); }
  });
  function cloudTradisi(k) { if (sb && user) sb.from("profiles").upsert({ id: user.id, tradisi: k, diubah: new Date().toISOString() }, { onConflict: "id" }).then(noop, noop); }
  function askTradisi() { if (open) { setTimeout(askTradisi, 1500); return; } show("shTrad"); }
  function cloudHl(add, del) {
    if (!sb || !user) return;
    if (add.length) sb.from("ayat_tersimpan").upsert(add.map(function (k) { return { user_id: user.id, kunci: k }; }), { onConflict: "user_id,kunci", ignoreDuplicates: true }).then(noop, noop);
    if (del.length) sb.from("ayat_tersimpan").delete().eq("user_id", user.id).in("kunci", del).then(function (r) { if (r && r.error) throw r.error; }).then(noop, function () { var P = pend(); P.hl = P.hl.concat(del); lsSet("evo.pend", P); });
  }
  function cloudJr(e) { if (sb && user && e && e.id) sb.from("jurnal_doa").upsert([jrow(e)], { onConflict: "id", ignoreDuplicates: true }).then(noop, noop); }
  function cloudJrDel(id) { if (!sb || !user || !id) return; sb.from("jurnal_doa").delete().eq("id", id).then(function (r) { if (r && r.error) throw r.error; }).then(noop, function () { var P = pend(); P.jr.push(id); lsSet("evo.pend", P); }); }
  function validKey(k) { var q = String(k).split(":").map(Number), bk = BOOKS[q[0]], ch = bk && bk.ch[q[1] - 1]; return !!(ch && q[2] >= 1 && q[2] <= ch.v.length); }
  function markChapter() { if (S.view !== "read") return; Array.prototype.forEach.call(document.querySelectorAll("#vRead .v[data-v]"), function (el) { var k = S.b + ":" + S.c + ":" + el.dataset.v; el.classList.toggle("hl", !!hls[k]); srClass(el, sors[k] || ""); }); }
  function cloudSor(add, del, c) {
    if (!sb || !user) return;
    if (add.length) sb.from("sorotan").upsert(add.map(function (k) { return { user_id: user.id, kunci: k, warna: c || sors[k] || "y" }; }), { onConflict: "user_id,kunci" }).then(noop, noop);
    if (del.length) sb.from("sorotan").delete().eq("user_id", user.id).in("kunci", del).then(function (r) { if (r && r.error) throw r.error; }).then(noop, function () { var P = pend(); P.sr = P.sr.concat(del); lsSet("evo.pend", P); });
  }
  function syncAll() {
    if (!sb || !user || syncing) return; syncing = true; renderAkun();
    var uid = user.id, P = pend(), skipHl = {}, skipJr = {}, skipSr = {};
    P.hl.forEach(function (k) { skipHl[k] = 1; }); P.jr.forEach(function (i) { skipJr[i] = 1; }); P.sr.forEach(function (k) { skipSr[k] = 1; });
    var pre = [];
    if (P.hl.length) pre.push(sb.from("ayat_tersimpan").delete().eq("user_id", uid).in("kunci", P.hl));
    if (P.jr.length) pre.push(sb.from("jurnal_doa").delete().in("id", P.jr));
    if (P.sr.length) pre.push(sb.from("sorotan").delete().eq("user_id", uid).in("kunci", P.sr));
    Promise.all(pre).then(function (r0) {
      if (r0.every(function (r) { return !r.error; })) lsSet("evo.pend", { hl: [], jr: [], sr: [] });
      return Promise.all([
        sb.from("profiles").select("tradisi").eq("id", uid).maybeSingle(),
        sb.from("ayat_tersimpan").select("kunci"),
        sb.from("jurnal_doa").select("id,dibuat,cerita,data").order("dibuat", { ascending: false }).limit(500),
        sb.from("sorotan").select("kunci,warna")
      ]);
    }).then(function (res) {
      var err = res[0].error || res[1].error || res[2].error || res[3].error; if (err) throw err;
      var remote = {}; res[1].data.forEach(function (r) { if (!skipHl[r.kunci] && validKey(r.kunci)) remote[r.kunci] = 1; });
      var up = Object.keys(hls).filter(function (k) { return !remote[k]; });
      Object.keys(remote).forEach(function (k) { hls[k] = 1; }); lsSet("evo.hl", hls);
      var rs = {}; res[3].data.forEach(function (r) { if (!skipSr[r.kunci] && validKey(r.kunci)) rs[r.kunci] = SR_C[r.warna] ? r.warna : "y"; });
      var upS = Object.keys(sors).filter(function (k) { return !rs[k]; });
      Object.keys(rs).forEach(function (k) { sors[k] = rs[k]; }); lsSet("evo.sor", sors);
      var J = journal(), have = {};
      J.forEach(function (e) { if (!e.id) e.id = uuid(); have[e.id] = 1; });
      var rj = {};
      res[2].data.forEach(function (r) { if (skipJr[r.id]) return; rj[r.id] = 1; if (!have[r.id] && r.data) J.push({ id: r.id, t: Date.parse(r.dibuat) || Date.now(), q: r.cerita || "", p: r.data }); });
      var upJ = J.filter(function (e) { return !rj[e.id]; });
      J.sort(function (a, b) { return b.t - a.t; }); lsSet("evo.jurnal", J.slice(0, 500));
      var jobs = [];
      if (up.length) jobs.push(sb.from("ayat_tersimpan").upsert(up.map(function (k) { return { user_id: uid, kunci: k }; }), { onConflict: "user_id,kunci", ignoreDuplicates: true }));
      if (upS.length) jobs.push(sb.from("sorotan").upsert(upS.map(function (k) { return { user_id: uid, kunci: k, warna: sors[k] || "y" }; }), { onConflict: "user_id,kunci", ignoreDuplicates: true }));
      if (upJ.length) jobs.push(sb.from("jurnal_doa").upsert(upJ.map(jrow), { onConflict: "id", ignoreDuplicates: true }));
      var tr = res[0].data && res[0].data.tradisi;
      if (tr === "katolik" || tr === "protestan") { if (settings.cal !== tr) { settings.cal = tr; lsSet("evo.set", settings); syncSeasonUI(); refreshSeason(); } }
      else askTradisi();
      return Promise.all(jobs);
    }).then(function () { syncing = false; renderAkun(); markChapter(); if (S.view === "saved") renderSaved(); }, function () { syncing = false; renderAkun(); toast("Sinkron akun belum berhasil. Akan dicoba lagi saat aplikasi dibuka."); });
  }
  if (sb) {
    sb.auth.onAuthStateChange(function (ev, session) {
      var u = (session && session.user) || null, changed = (u && u.id) !== (user && user.id);
      user = u; renderAkun();
      if (u && changed) setTimeout(syncAll, 0);
      if (ev === "SIGNED_IN" && /[?&]code=/.test(location.search)) { try { history.replaceState(null, "", location.pathname + location.hash); } catch (e) {} toast("Berhasil masuk"); }
    });
    window.addEventListener("online", function () { if (user) syncAll(); });
    fetch(SB_URL + "/auth/v1/settings", { headers: { apikey: SB_KEY } }).then(function (r) { return r.json(); }).then(function (j) { googleOn = !!(j && j.external && j.external.google); renderAkun(); if (S.view === "saved") renderSaved(); }, noop);
  }

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
    // Chrome melewati entri riwayat yang dibuat tanpa sentuhan; jadi penjaga dipasang ulang pada sentuhan berikutnya.
    function touchArm() { if (exiting || !needTouch) return; var ua = navigator.userActivation; if (ua && !ua.isActive) return; needTouch = false; arm(); }
    ["pointerup", "touchend", "click", "keydown"].forEach(function (ev) { addEventListener(ev, touchArm, { capture: true, passive: true }); });
    function goBack() {
      if (window.EvoGambar && EvoGambar.isOpen()) { EvoGambar.close(); return; }
      if (open) { hide(); return; }
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

  if ("serviceWorker" in navigator && location.protocol !== "file:") { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }

  applySettings();
  route();
  renderAkun();
})();
