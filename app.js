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
  settings.sea = "on"; // tema musiman selalu mengikuti kalender (pilihan di pengaturan dihapus)
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
  if (!FEATURE_CHURCH) { document.querySelector('.tab[data-v="church"]').hidden = true; $("chSeg").parentNode.hidden = true; } else { document.querySelector('.tab[data-v="church"]').hidden = false; }
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

  /* ---------- settings ---------- */
  function applySettings() {
    document.documentElement.style.setProperty("--fs-read", settings.fs + "px");
    $("fsOut").textContent = settings.fs;
    if (settings.theme === "auto") document.documentElement.removeAttribute("data-theme"); else document.documentElement.setAttribute("data-theme", settings.theme);
    Array.prototype.forEach.call($("themeSeg").children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.t === settings.theme)); });
    if (settings.lite) document.documentElement.setAttribute("data-lite", "1"); else document.documentElement.removeAttribute("data-lite");
    Array.prototype.forEach.call($("liteSeg").children, function (b) { b.setAttribute("aria-pressed", String((b.dataset.k === "on") === !!settings.lite)); });
    syncSeasonUI(); applySeason();
  }
  $("fsDown").onclick = function () { settings.fs = Math.max(14, settings.fs - 1); lsSet("evo.set", settings); applySettings(); };
  $("fsUp").onclick = function () { settings.fs = Math.min(30, settings.fs + 1); lsSet("evo.set", settings); applySettings(); };
  $("liteSeg").onclick = function (e) { var k = e.target.dataset && e.target.dataset.k; if (!k) return; settings.lite = k === "on"; lsSet("evo.set", settings); applySettings(); };
  $("themeSeg").onclick = function (e) { var t = e.target.dataset && e.target.dataset.t; if (!t) return; settings.theme = t; lsSet("evo.set", settings); applySettings(); };

  /* ---------- sheets ---------- */
  function show(id) { hide(); if (id === "shSeason") drCancelClose(); $(id).hidden = false; open = id; }
  function hide() { ["shBooks", "shVer", "shSet", "shVoice", "shCat", "shSeason", "shTrad", "shExit", "shTts"].forEach(function (i) { if (i === "shSeason" && drClose()) return; $(i).hidden = true; }); open = null; }
  document.addEventListener("click", function (e) {
    if (e.target.closest("[data-close]")) hide(); else if (e.target.classList && e.target.classList.contains("scrim")) hide();
  });
  $("btnSet2").onclick = function () { show("shSet"); };

  /* ---------- routing ---------- */
  var VIEWS = { home: "vHome", search: "vSearch", read: "vRead", saved: "vSaved", church: "vChurch", more: "vMore", hymn: "vHymn", kisah: "vKisah", about: "vAbout", ibadah: "vIbadah" };
  var NAMES = { home: "beranda", search: "cari", kata: "kata", read: "baca", saved: "tersimpan", church: "gereja", more: "lainnya", hymn: "nyanyian", kisah: "kisah", about: "tentang", ibadah: "ibadah" };
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
    if (open !== "shVoice") hide();
    var h = decodeURIComponent(location.hash.slice(1)), m = /^([A-Za-z0-9]+)-(\d+)(?:-(\d+)(?:-(\d+))?)?$/.exec(h);
    if (m) {
      for (var i = 0; i < BOOKS.length; i++) if (BOOKS[i].a === m[1]) {
        var c = Math.min(Math.max(1, +m[2]), BOOKS[i].ch.length), v = m[3] ? Math.min(+m[3], BOOKS[i].ch[c - 1].v.length) : 0;
        var v2 = m[4] ? Math.min(+m[4], BOOKS[i].ch[c - 1].v.length) : 0;
        if (window.EvoIbadah) EvoIbadah.onRef(i, c, v, v2);
        showView("read"); renderChapter(i, c, v, v2); return;
      }
    }
    if (h === "cari") { setSearchTab("tema"); showView("search"); renderSearch(); window.scrollTo(0, 0); return; }
    if (h === "kata") { setSearchTab("kata"); showView("search", "kata"); renderSearch(); window.scrollTo(0, 0); return; }
    if (h === "gereja" && FEATURE_CHURCH) { showView("church"); renderChurch(); window.scrollTo(0, 0); return; }
    if (h === "tersimpan" || h === "sorotan") { showView("saved", "more"); renderSaved(); window.scrollTo(0, 0); return; }
    if (h === "kisah" || h.indexOf("kisah/") === 0) { var kp = h.split("/"); showView("kisah", "more"); renderKisah(kp[1] || "", kp[2] || ""); return; }
    if (h === "ibadah" || h.indexOf("ibadah/") === 0) { showView("ibadah", "more"); if (window.EvoIbadah) EvoIbadah.render(h.split("/")[1] || ""); window.scrollTo(0, 0); return; }
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
  /* Mikrofon Renungan (tab salib): cerita diucapkan lalu menjadi tulisan di kotak Renungan.
     - Android/Chrome: pengenal suara bawaan browser (gratis, teks muncul langsung).
     - iPhone/iPad/Safari: pengenal bawaan tidak dipakai (mikrofon tidak dilepas), jadi direkam sendiri (WAV 16 kHz, maks 60 detik)
       lalu dikenali di server (function `suara`, mode "cerita"). Mikrofon dilepas begitu rekaman selesai. */
  var RM_SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  var RM_APPLE = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) || (/AppleWebKit/.test(navigator.userAgent) && !/Chrome|CriOS|Chromium|Edg|Android/.test(navigator.userAgent));
  var RM_REC = !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && (window.AudioContext || window.webkitAudioContext));
  var RM_WAY = RM_SR && !RM_APPLE ? "web" : RM_REC ? "rec" : "";
  var RMIC = { st: "idle", r: null, want: false, base: "", stream: null, ctx: null, src: null, node: null, buf: [], rate: 48000, t0: 0, talk: 0, quiet: 0, timer: 0 };
  function rmLang() { var cl = ""; try { cl = localStorage.getItem("evo.clang") || ""; } catch (e) {} return cl === "en" ? "en" : "id"; }
  function rmUi(st) {
    RMIC.st = st; var b = $("qmic"), on = st === "rec" || st === "web";
    b.classList.toggle("on", on); b.classList.toggle("busy", st === "sending"); b.disabled = st === "sending";
    b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", on ? "Berhenti mendengarkan" : st === "sending" ? "Mengenali suara" : "Bicara");
  }
  function rmBase() { var v = $("q").value.replace(/\s+$/, ""); RMIC.base = v ? v + " " : ""; }
  function rmPut(t) { $("q").value = (RMIC.base + t).replace(/\s+/g, " ").replace(/^ /, "").slice(0, 500); $("q").dispatchEvent(new Event("input")); }
  // jalur 1: pengenal suara bawaan browser. Di Android mode continuous suka mengulang teks, jadi dipakai sesi pendek yang disambung otomatis.
  function rmWeb() {
    var r; try { r = new RM_SR(); } catch (e) { toast("Mikrofon tidak tersedia di HP ini"); return; }
    r.lang = rmLang() === "en" ? "en-US" : "id-ID"; r.continuous = !/Android/i.test(navigator.userAgent); r.interimResults = true; r.maxAlternatives = 1;
    rmBase(); RMIC.want = true;
    r.onresult = function (e) { var t = ""; for (var i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; rmPut(t); };
    r.onerror = function (e) {
      var c = e && e.error;
      if (c === "not-allowed" || c === "service-not-allowed") toast("Izin mikrofon belum diberikan");
      else if (c === "network") toast("Mikrofon perlu internet");
      else if (c === "audio-capture") toast("Mikrofon tidak ditemukan");
      RMIC.want = false;
    };
    r.onend = function () { if (RMIC.r !== r) return; RMIC.r = null; if (RMIC.want && S.view === "search") rmWeb(); else rmUi("idle"); };
    RMIC.r = r;
    try { r.start(); rmUi("web"); } catch (e) { RMIC.r = null; RMIC.want = false; rmUi("idle"); }
  }
  // jalur 2: rekam sendiri lalu dikenali server
  function rmRelease() {
    clearInterval(RMIC.timer);
    try { RMIC.node && RMIC.node.disconnect(); } catch (e) {}
    try { RMIC.src && RMIC.src.disconnect(); } catch (e) {}
    try { RMIC.stream && RMIC.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { RMIC.ctx && RMIC.ctx.close(); } catch (e) {}
    RMIC.node = RMIC.src = RMIC.stream = RMIC.ctx = null;
  }
  function rmFinish(spoke) {
    var chunks = RMIC.buf, rate = RMIC.rate; RMIC.buf = []; rmRelease();
    if (!spoke) { rmUi("idle"); toast("Tidak terdengar suara"); return; }
    var wav; try { wav = micWav(chunks, rate); } catch (e) { rmUi("idle"); toast("Suara belum bisa dikenali"); return; }
    rmUi("sending"); rmBase();
    fetch(API_SUARA, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a: wav, m: "audio/wav", d: devId, k: "cerita", lang: rmLang() }) })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        rmUi("idle");
        if (!j || !j.ok) { toast(j && j.sebab === "batas" ? "Batas suara hari ini sudah habis" : "Suara belum bisa dikenali"); return; }
        if (!String(j.teks || "").trim()) { toast("Tidak terdengar suara"); return; }
        rmPut(String(j.teks).trim());
      })
      .catch(function () { rmUi("idle"); toast("Mikrofon perlu internet"); });
  }
  function rmRec() {
    if (T.on) stopTTS();
    RMIC.buf = []; RMIC.talk = 0; RMIC.quiet = 0; rmUi("rec");
    var AC = window.AudioContext || window.webkitAudioContext, ctx = new AC(); RMIC.ctx = ctx;
    try { ctx.resume(); } catch (e) {}
    navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }).then(function (stream) {
      if (RMIC.st !== "rec" || RMIC.ctx !== ctx) { stream.getTracks().forEach(function (t) { t.stop(); }); return; }
      RMIC.stream = stream; RMIC.rate = ctx.sampleRate; RMIC.t0 = Date.now();
      var src = ctx.createMediaStreamSource(stream), node = ctx.createScriptProcessor(4096, 1, 1); RMIC.src = src; RMIC.node = node;
      node.onaudioprocess = function (e) {
        if (RMIC.st !== "rec") return;
        var d = e.inputBuffer.getChannelData(0); RMIC.buf.push(new Float32Array(d));
        var sum = 0; for (var i = 0; i < d.length; i += 4) sum += d[i] * d[i]; var rms = Math.sqrt(sum / (d.length / 4));
        if (rms > 0.025) { RMIC.talk++; RMIC.quiet = 0; } else if (RMIC.talk) RMIC.quiet += d.length / RMIC.rate;
      };
      src.connect(node); node.connect(ctx.destination);
      RMIC.timer = setInterval(function () {
        if (RMIC.st !== "rec") return;
        var el = (Date.now() - RMIC.t0) / 1000;
        if (RMIC.talk >= 3 && RMIC.quiet > 3) rmFinish(true);        // selesai bercerita (jeda 3 detik)
        else if (el > 60) rmFinish(true);                         // batas 60 detik
        else if (!RMIC.talk && el > 8) rmFinish(false);             // diam saja
      }, 200);
    }).catch(function (e) {
      rmRelease(); rmUi("idle");
      toast(e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "Izin mikrofon belum diberikan" : "Mikrofon tidak bisa dipakai");
    });
  }
  function rmStop(send) {
    if (RMIC.st === "web") { RMIC.want = false; if (RMIC.r) { try { RMIC.r.stop(); } catch (e) {} } else rmUi("idle"); }
    else if (RMIC.st === "rec") { if (send) rmFinish(RMIC.talk > 0); else { RMIC.buf = []; rmRelease(); rmUi("idle"); } }
  }
  if (RM_WAY) {
    $("qmic").hidden = false;
    $("qmic").onclick = function () { if (RMIC.st === "idle") { if (RM_WAY === "web") rmWeb(); else rmRec(); } else rmStop(true); };
    $("sForm").addEventListener("submit", function () { rmStop(false); });
    $("qclr").addEventListener("click", function () { rmStop(false); });
    window.addEventListener("hashchange", function () { rmStop(false); });
    document.addEventListener("visibilitychange", function () { if (document.hidden) rmStop(false); });
  }

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
  var IB_I = '<svg class="ico" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>';
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
      ["ibadah", IB_I, "Catatan Ibadah", "Rekam khotbah, salin ke tulisan, dan ringkasan otomatis"],
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

  /* ---------- Nyanyian: buku nyanyian gereja ----------
     Isi lagu: kidung/index.json berisi daftar kode buku yang sudah tersedia, misalnya ["kj","pkj"].
     Tiap buku: kidung/<kode>.json = { "lagu": [ { "n": "1", "j": "Judul", "b": [ { "k": "1", "l": ["baris", ...] }, { "k": "Reff", "l": [...] } ] } ] }
     Lirik hanya dimasukkan setelah ada izin tertulis dari pemegang hak cipta. */
  var HY_BOOKS = [
    { k: "mb", n: "Madah Bakti", t: "katolik", pub: "Pusat Musik Liturgi Yogyakarta" },
    { k: "ps", n: "Puji Syukur", t: "katolik", pub: "Komisi Liturgi KWI" },
    { k: "kj", n: "Kidung Jemaat", t: "protestan", pub: "Yayasan Musik Gereja di Indonesia (YAMUGER)" },
    { k: "pkj", n: "Pelengkap Kidung Jemaat", t: "protestan", pub: "Yayasan Musik Gereja di Indonesia (YAMUGER)" },
    { k: "nkb", n: "Nyanyikanlah Kidung Baru", t: "protestan", pub: "" },
    { k: "pd", n: "Himne Klasik", t: "umum", pub: "", en: true }
  ];
  var HY = { ready: null, data: {}, q: "" };
  function hyBook(k) { for (var i = 0; i < HY_BOOKS.length; i++) if (HY_BOOKS[i].k === k) return HY_BOOKS[i]; return null; }
  function hyReady() {
    if (HY.ready) return Promise.resolve(HY.ready);
    return fetch("kidung/index.json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; })
      .then(function (a) { HY.ready = Array.isArray(a) ? a : []; return HY.ready; });
  }
  function hyLoad(k) {
    if (HY.data[k]) return Promise.resolve(HY.data[k]);
    return fetch("kidung/" + k + ".json").then(function (r) { if (!r.ok) throw 0; return r.json(); })
      .then(function (d) { HY.data[k] = d && d.lagu ? d.lagu : []; return HY.data[k]; }).catch(function () { return null; });
  }
  function hyNorm(s) { return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function renderHymn(k, n) {
    var body = $("hyBody"), bk = hyBook(k);
    S.hyK = bk ? k : ""; S.hyN = bk ? n : "";
    if (!bk) {
      $("hyTitle").textContent = "Nyanyian";
      var mine = settings.cal === "katolik" ? "katolik" : "protestan", other = mine === "katolik" ? "protestan" : "katolik";
      hyReady().then(function (ready) {
        if (S.view !== "hymn" || S.hyK) return;
        function grp(t, lab) {
          return '<div class="flabel">' + lab + '</div><div class="hybooks">' + HY_BOOKS.filter(function (b) { return b.t === t; }).map(function (b) {
            var ok = ready.indexOf(b.k) >= 0;
            return '<button class="hybook" type="button" data-hy="' + b.k + '"><b>' + esc(b.n) + "</b><small>" + (ok ? "Buka" : "Segera hadir") + "</small></button>";
          }).join("") + "</div>";
        }
        body.innerHTML = grp("umum", "Himne berbahasa Inggris") + grp(mine, mine === "katolik" ? "Katolik" : "Protestan") + grp(other, other === "katolik" ? "Katolik" : "Protestan");
      });
      window.scrollTo(0, 0); return;
    }
    $("hyTitle").textContent = bk.n;
    hyReady().then(function (ready) {
      if (ready.indexOf(k) < 0) { body.innerHTML = hySoon(bk); return null; }
      return hyLoad(k);
    }).then(function (list) {
      if (!list || S.hyK !== k) { if (list === null && S.hyK === k && !body.querySelector(".hysoon")) body.innerHTML = hySoon(bk); return; }
      if (!n) { hyList(bk, list); return; }
      var i = -1; for (var j = 0; j < list.length; j++) if (String(list[j].n) === String(n)) { i = j; break; }
      if (i < 0) { hyList(bk, list); return; }
      hySong(bk, list, i);
    });
  }
  function hySoon(bk) {
    return '<div class="hysoon"><span class="mi">' + MUSIC_I + "</span><b>" + esc(bk.n) + "</b><p>Segera hadir" + (bk.pub ? ". Menunggu izin dari " + esc(bk.pub) + "." : ".") + "</p></div>";
  }
  function hyList(bk, list) {
    var q = HY.q || "";
    $("hyBody").innerHTML = '<div class="hysearch"><input id="hyQ" type="search" inputmode="search" autocomplete="off" placeholder="Nomor atau judul lagu" aria-label="Cari nomor atau judul lagu" value="' + esc(q) + '"></div><div class="hylist" id="hyList"></div>';
    hyFill(bk, list);
    $("hyQ").oninput = function () { HY.q = this.value; hyFill(bk, list); };
    window.scrollTo(0, 0);
  }
  function hyFill(bk, list) {
    var q = hyNorm(HY.q || ""), out = list.filter(function (s) { return !q || String(s.n) === q || String(s.n).indexOf(q) === 0 || hyNorm(s.j).indexOf(q) >= 0; });
    $("hyList").innerHTML = out.length ? out.slice(0, 400).map(function (s) {
      return '<button class="hyrow" type="button" data-hyn="' + esc(String(s.n)) + '"><span class="hn">' + esc(String(s.n)) + "</span><span class=\"hj\">" + esc(s.j) + "</span></button>";
    }).join("") : '<div class="empty">Tidak ada lagu dengan nomor atau judul itu.</div>';
  }
  function hySong(bk, list, i) {
    var s = list[i], prev = list[i - 1], next = list[i + 1];
    var h = '<article class="hysong"' + (bk.en ? ' lang="en"' : "") + '><div class="hyno">' + esc(bk.n) + " " + esc(String(s.n)) + '</div><h2 class="hyj">' + esc(s.j) + "</h2>" + (s.p ? '<div class="hyp">Syair: <span data-noi18n>' + esc(s.p) + "</span></div>" : "");
    (s.b || []).forEach(function (bt) {
      var reff = /^ref/i.test(bt.k || "");
      h += '<div class="hyb' + (reff ? " reff" : "") + '"><span class="hyk">' + esc(bt.k || "") + '</span><p data-noi18n>' + (bt.l || []).map(function (x) { return '<span class="hl">' + esc(x) + "</span>"; }).join("") + "</p></div>";
    });
    h += '</article><nav class="pn hypn">' + (prev ? '<button type="button" data-hyn="' + esc(String(prev.n)) + '"><small>Sebelumnya</small><b>' + esc(bk.n) + " " + esc(String(prev.n)) + "</b></button>" : "<span></span>")
      + (next ? '<button type="button" data-hyn="' + esc(String(next.n)) + '"><small>Berikutnya</small><b>' + esc(bk.n) + " " + esc(String(next.n)) + "</b></button>" : "<span></span>") + "</nav>";
    $("hyBody").innerHTML = h; window.scrollTo(0, 0);
  }
  $("hyBody").addEventListener("click", function (e) {
    var t = e.target.closest("[data-hy]"); if (t) { HY.q = ""; navHash("nyanyian/" + t.dataset.hy); return; }
    t = e.target.closest("[data-hyn]"); if (t && S.hyK) navHash("nyanyian/" + S.hyK + "/" + t.dataset.hyn);
  });
  $("hyBack").onclick = function () { if (S.hyN) navHash("nyanyian/" + S.hyK); else if (S.hyK) navHash("nyanyian"); else navHash("lainnya"); };

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
    if (e.key === "Escape") { if (open) hide(); else clearSel(); return; }
    if (S.view !== "read" || open || /input|textarea/i.test(e.target.tagName || "")) return;
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
    t = t.toLowerCase().replace(/(\d)\s*[:.]\s*(\d)/g, "$1 ayat $2").replace(/(\d)\s*[-\u2013]\s*(\d)/g, "$1 sampai $2")
      .replace(/s\/d|sampai dengan|hingga|sampai ke/g, " sampai ").replace(/[^a-z0-9 ]+/g, " ").replace(/\bse(puluh|belas|ratus)\b/g, "satu $1")
      .replace(/\bsebelas\b/g, "satu belas").replace(/\bseratus\b/g, "satu ratus");
    var w = t.split(/\s+/).filter(Boolean), out = [], i = 0;
    while (i < w.length) {           // gabung angka kata: "dua puluh tiga" -> 23, "seratus lima puluh" -> 150
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
  function spBook(words) {     // cari nama kitab terpanjang yang cocok; kembalikan {i (indeks kitab), s, e}
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
    if (b < 0 && !nth) {        // kitab bernomor tanpa nomor disebut (mis. "Korintus 1 13"): angka pertama = nomor kitab
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
  function micWav(chunks, rate) {          // Float32 → WAV 16 kHz mono
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
        if (MIC.talk >= 3 && MIC.quiet > 1.2) micFinish(true);        // selesai bicara
        else if (el > 9) micFinish(MIC.talk > 0);                       // batas waktu
        else if (!MIC.talk && el > 5) micFinish(false);                 // diam saja
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
  function ttsEn() { return T.on && VERS[verUsed(T.b, T.c)].lang === "en"; }
  function enVoice() { var l = voices.filter(function (v) { return /^en([-_]|$)/i.test(v.lang); }); l.sort(function (a, b) { return vscore(b) - vscore(a); }); return l[0] || null; }
  function vtext(raw) { return raw.replace(/^¶/, "").replace(/^\(\d+-\d+\)\s*/, ""); }
  // Cara bicara dicoba bertahap: 0 = suara Indonesia terpilih, 1 = hanya bahasa id-ID, 2 = suara bawaan HP.
  // Cara yang berhasil diingat untuk HP ini (tts.mode).
  function say(text, done, mode) {
    if (mode === undefined) mode = tts.mode || 0;
    if (!text) { setTimeout(done, 0); return; }
    var en = ttsEn(), u = new SpeechSynthesisUtterance(text), v = en ? enVoice() : mode === 0 ? pickVoice() : null;
    if (en) u.lang = "en-US"; else if (mode < 2) u.lang = "id-ID";
    if (v) { u.voice = v; u.lang = String(v.lang || (en ? "en-US" : "id-ID")).replace("_", "-"); }
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
    $("ttsCode").textContent = "Keterangan teknis: " + code + " · suara Indonesia di HP ini: " + n + " · total suara: " + voices.length + (voices.length ? " (" + voices.map(function (x) { return x.lang; }).filter(function (l, i, arr) { return arr.indexOf(l) === i; }).join(", ") + ")" : "");
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
    if (intro) { markVerse(); say(ttsEn() ? "" : BOOKS[T.b].n + " pasal " + T.c, function () { step(tok, false); }); return; }
    if (T.list) {
      if (T.k >= T.list.length) { stopTTS(); return; }
      T.i = T.list[T.k] - 1;
      updatePlayer(); markVerse();
      say(verPlain(T.b, T.c, T.i + 1), function () { T.k++; step(tok, false); });
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
    say(verPlain(T.b, T.c, T.i + 1), function () { T.i++; step(tok, false); });
  }
  function restartTTS() { if (synth.speaking || synth.pending) synth.cancel(); T.tok++; T.paused = false; T.errs = 0; updatePlayer(); var tok = T.tok; setTimeout(function () { step(tok, false); }, 60); }
  /* Layar tetap menyala selama mode suara (Alkitab atau Kisah) berjalan, supaya bacaan tidak terhenti karena HP terkunci otomatis.
     Screen Wake Lock dilepas otomatis oleh browser saat aplikasi disembunyikan, jadi diminta lagi saat kembali terlihat. */
  var WL = { s: null, busy: false };
  function wlWant() { return !document.hidden && ((T.on && !T.paused) || (KS && KS.sp)); }
  function wlSync() {
    if (!("wakeLock" in navigator) || WL.busy) return;
    if (wlWant() && !WL.s) {
      WL.busy = true;
      navigator.wakeLock.request("screen").then(function (s) { WL.s = s; s.addEventListener("release", function () { if (WL.s === s) WL.s = null; }); })
        .catch(function () {}).then(function () { WL.busy = false; });
    } else if (!wlWant() && WL.s) { try { WL.s.release(); } catch (e) {} WL.s = null; }
  }
  setInterval(wlSync, 1500);
  document.addEventListener("visibilitychange", wlSync);
  function startTTS(b, c, i, intro, list) {
    asStop(); if (synth.speaking || synth.pending) synth.cancel(); T.tok++; T.on = true; T.paused = false; T.b = b; T.c = c; T.i = i; T.errs = 0; T.list = list || null; T.k = 0;
    document.body.classList.add("speaking"); $("player").hidden = false; updatePlayer();
    var tok = T.tok; setTimeout(function () { step(tok, !!intro); }, 60); wlSync();
  }
  function stopTTS() {
    T.tok++; T.on = false; T.paused = false; try { synth.cancel(); } catch (e) {}
    document.body.classList.remove("speaking"); $("player").hidden = true; markVerse(); $("btnListen").classList.remove("on"); wlSync();
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
    }).then(function () { syncing = false; renderAkun(); markChapter(); if (S.view === "saved") renderSaved(); if (window.EvoIbadah) EvoIbadah.sync(); }, function () { syncing = false; renderAkun(); toast("Sinkron akun belum berhasil. Akan dicoba lagi saat aplikasi dibuka."); });
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

  if (window.EvoIbadah) EvoIbadah.init({ $: $, esc: esc, toast: toast, go: navHash, openRef: openRef, uuid: uuid, devId: devId, BOOKS: BOOKS, lang: rmLang, sb: function () { return sb; }, user: function () { return user; } });

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

  /* ---------- penanda tab yang bergeser (kapsul kaca cair) ---------- */
  var tabInd = document.createElement("span"), indPos = null, indAnim = null;
  tabInd.className = "tab-ind"; tabInd.setAttribute("aria-hidden", "true");
  $("tabs").insertBefore(tabInd, $("tabs").firstChild);
  function placeInd(animate) {
    var cur = $("tabs").querySelector('.tab[aria-current="page"]');
    if (!cur || !cur.offsetWidth) { tabInd.style.opacity = "0"; indPos = null; return; }
    if (cur.classList.contains("tab-c")) { if (indAnim) try { indAnim.cancel(); } catch (e) {} tabInd.style.opacity = "0"; indPos = { x: cur.offsetLeft, w: cur.offsetWidth }; tabInd.style.transform = "translateX(" + indPos.x + "px)"; tabInd.style.width = indPos.w + "px"; return; }
    var x = cur.offsetLeft, w = cur.offsetWidth, a = indPos, reduce = false;
    try { reduce = matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) {}
    tabInd.style.opacity = "1";
    tabInd.style.transform = "translateX(" + x + "px)"; tabInd.style.width = w + "px";
    indPos = { x: x, w: w };
    if (!animate || !a || reduce || !tabInd.animate || (a.x === x && a.w === w)) return;
    if (indAnim) try { indAnim.cancel(); } catch (e) {}
    var right = x > a.x, steps = Math.max(1, Math.round(Math.abs(x - a.x) / w)), dur = Math.min(760, 480 + steps * 70), dir = right ? 1 : -1;
    // sisi depan melaju lebih dulu, sisi belakang menyusul: kapsul memanjang lalu mengerut di tujuan
    var l1 = right ? a.x + (x - a.x) * .25 : a.x + (x - a.x) * .8, r1 = right ? a.x + a.w + (x + w - a.x - a.w) * .8 : a.x + a.w + (x + w - a.x - a.w) * .25;
    var l2 = right ? x - w * .06 : x, r2 = right ? x + w : x + w * 1.06;
    indAnim = tabInd.animate([
      // tetesan air: lepas (sedikit menciut), meluncur memanjang & menipis, menabrak tujuan lalu bergoyang dan tenang
      { transform: "translateX(" + a.x + "px) scale(1, 1)", width: a.w + "px" },
      { transform: "translateX(" + (a.x + a.w * .04) + "px) scale(.94, 1.04)", width: (a.w * .92) + "px", offset: .1 },
      { transform: "translateX(" + l1 + "px) scale(1, .8)", width: (r1 - l1) + "px", offset: .42 },
      { transform: "translateX(" + (l2 + dir * w * .03) + "px) scale(.9, 1.1)", width: (r2 - l2) + "px", offset: .66 },
      { transform: "translateX(" + x + "px) scale(1.06, .95)", width: w + "px", offset: .8 },
      { transform: "translateX(" + x + "px) scale(.98, 1.02)", width: w + "px", offset: .91 },
      { transform: "translateX(" + x + "px) scale(1, 1)", width: w + "px" }
    ], { duration: dur, easing: "cubic-bezier(.3, .7, .3, 1)" });
  }
  window.addEventListener("resize", function () { placeInd(false); });

  /* ---------- geser tetesan air di menu bawah ----------
     Jari menahan & menggeser: tetesan mengikuti jari (memanjang sesuai laju), dilepas -> meluncur ke tab terdekat dan membukanya. */
  function tdTabs() { return Array.prototype.filter.call($("tabs").querySelectorAll(".tab"), function (t) { return !t.hidden && t.offsetWidth; }); }
  function tdNear(cx) { var best = null, bd = 1e9; tdTabs().forEach(function (t) { var d = Math.abs(t.offsetLeft + t.offsetWidth / 2 - cx); if (d < bd) { bd = d; best = t; } }); return best; }
  /* Panel selalu "di depan": sentuhan ditangani langsung lewat touch events (passive:false), jadi tetap
     merespons walau halaman masih meluncur setelah dilempar (iOS menelan klik pertama saat momentum). */
  function tdDown(e) {
    var r = $("tabs").getBoundingClientRect();
    $("tabs").classList.add("press");
    TD.p = { id: e.pointerId, x0: e.clientX, y0: e.clientY, ox: r.left, on: false, lx: e.clientX, lt: e.timeStamp, v: 0, hov: null, tab: e.target.closest(".tab") };
  }
  function tdMove(e) {
    var p = TD.p; if (!p || p.id !== e.pointerId) return;
    if (!p.on) {
      if (Math.abs(e.clientX - p.x0) < 10 || Math.abs(e.clientX - p.x0) < Math.abs(e.clientY - p.y0)) return;
      p.on = true; if (typeof e.pointerId === "number") try { $("tabs").setPointerCapture(e.pointerId); } catch (x) {}
      if (indAnim) try { indAnim.cancel(); } catch (x) {}
      var cur = $("tabs").querySelector('.tab[aria-current="page"]:not(.tab-c)') || tdNear(p.x0 - p.ox);
      p.w = cur.offsetWidth; var ts = tdTabs(); p.min = ts[0].offsetLeft; p.max = ts[ts.length - 1].offsetLeft + ts[ts.length - 1].offsetWidth - p.w;
      tabInd.style.opacity = "1"; tabInd.style.width = p.w + "px";
      var r0 = $("tabs").getBoundingClientRect(); p.cx0 = r0.left + r0.width / 2; p.k0 = 1.045;
      document.body.classList.add("tabdrag");
    }
    var dt = Math.max(8, e.timeStamp - p.lt); p.v = p.v * .6 + ((e.clientX - p.lx) / dt) * .4; p.lx = e.clientX; p.lt = e.timeStamp;
    // posisi jari diukur terhadap ukuran panel saat geser dimulai (tidak ikut melar)
    var cx = (e.clientX - p.cx0) / p.k0 + $("tabs").offsetWidth / 2, raw = cx - p.w / 2, x = Math.max(p.min, Math.min(p.max, raw)), s = Math.min(.28, Math.abs(p.v) * .22);
    // ditarik melewati tab paling ujung: panel melar ke arah tarikan, sisi seberangnya menahan (karet)
    var over = raw > p.max ? raw - p.max : raw < p.min ? raw - p.min : 0, el = $("tabs");
    if (over) {
      var dir = over > 0 ? 1 : -1, st = .07 * (1 - Math.exp(-Math.abs(over) / 110)), W = el.offsetWidth;
      el.classList.add("pull");
      el.style.setProperty("--tbx", (1 + st).toFixed(4)); el.style.setProperty("--tby", (1 - st * .4).toFixed(4));
      el.style.setProperty("--tbt", (dir * st * W / 2).toFixed(2) + "px");
      x += dir * Math.min(8, Math.abs(over) * .15);
    } else if (el.classList.contains("pull")) { el.style.setProperty("--tbx", "1"); el.style.setProperty("--tby", "1"); el.style.setProperty("--tbt", "0px"); }
    p.x = x; tabInd.style.transform = "translateX(" + x + "px) scale(" + (1 + s).toFixed(3) + "," + (1 - s * .6).toFixed(3) + ")";
    var h = tdNear(x + p.w / 2);
    if (h !== p.hov) { if (p.hov) p.hov.classList.remove("hov"); h.classList.add("hov"); if (p.hov && navigator.vibrate) try { navigator.vibrate(6); } catch (x) {} p.hov = h; }
  }
  function tdEnd(e) {
    var p = TD.p; if (!p || p.id !== e.pointerId) return; TD.p = null;
    $("tabs").classList.remove("press");
    var el = $("tabs");
    if (el.classList.contains("pull")) {
      el.classList.remove("pull"); el.classList.add("snapback");
      el.style.setProperty("--tbx", "1"); el.style.setProperty("--tby", "1"); el.style.setProperty("--tbt", "0px");
      clearTimeout(TD.sb); TD.sb = setTimeout(function () { el.classList.remove("snapback"); }, 650);
    }
    if (!p.on) { if (e.tap && p.tab) { TD.eat = performance.now() + 700; tabTap(p.tab); } return; }
    TD.eat = performance.now() + 400; document.body.classList.remove("tabdrag");
    if (p.hov) p.hov.classList.remove("hov");
    var t = tdNear(p.x + p.w / 2);
    indPos = { x: p.x, w: p.w }; tabInd.style.transform = "translateX(" + p.x + "px)";
    if (t.getAttribute("aria-current") === "page") { placeInd(true); return; }
    topStop(); go(t.dataset.v);
  }
  // mouse / pena: pointer events
  $("tabs").addEventListener("pointerdown", function (e) { if (e.pointerType === "touch" || e.button > 0 || !e.target.closest(".tab")) return; tdDown(e); });
  $("tabs").addEventListener("pointermove", function (e) { if (e.pointerType !== "touch") tdMove(e); });
  $("tabs").addEventListener("pointerup", function (e) { if (e.pointerType !== "touch") tdEnd(e); });
  // jari: touch events langsung, tidak menunggu halaman berhenti meluncur
  function tdT(e, t) { return { pointerId: "t" + t.identifier, clientX: t.clientX, clientY: t.clientY, timeStamp: e.timeStamp, target: e.target }; }
  function tdFind(e) { if (!TD.p) return null; for (var i = 0; i < e.changedTouches.length; i++) if ("t" + e.changedTouches[i].identifier === TD.p.id) return e.changedTouches[i]; return null; }
  $("tabs").addEventListener("touchstart", function (e) {
    if (!e.target.closest(".tab") || TD.p) return;
    if (e.cancelable) e.preventDefault();
    tdDown(tdT(e, e.changedTouches[0]));
  }, { passive: false });
  $("tabs").addEventListener("touchmove", function (e) { var t = tdFind(e); if (!t) return; if (e.cancelable) e.preventDefault(); tdMove(tdT(e, t)); }, { passive: false });
  $("tabs").addEventListener("touchend", function (e) { var t = tdFind(e); if (!t) return; if (e.cancelable) e.preventDefault(); var o = tdT(e, t); o.tap = true; tdEnd(o); }, { passive: false });
  $("tabs").addEventListener("touchcancel", function (e) { var t = tdFind(e); if (!t) return; if (TD.p.on) tdEnd(tdT(e, t)); else { TD.p = null; $("tabs").classList.remove("press"); } });

  /* ---------- panel menu bawah mengecil saat halaman digulir turun ----------
     Turun: cepat mengecil sedikit lalu tertahan. Naik: pelan-pelan kembali normal. Di puncak halaman selalu normal. */
  /* Tab Baca: menu bawah bersembunyi saat menggulir turun, muncul lagi bila digulir naik dengan cepat
     (atau di puncak / ujung pasal). */
  var TB = { k: 0, y: scrollY, raf: 0, t: 0, v: 0, hid: false };
  function tbHide(on) {
    if (TB.hid === on) return; TB.hid = on;
    document.body.classList.toggle("tbhide", on);
    if (on) { $("tabs").classList.remove("press"); if (TD.p) { TD.p = null; } }
  }
  addEventListener("scroll", function () {
    if (TB.raf) return;
    TB.raf = requestAnimationFrame(function (ts) {
      TB.raf = 0;
      var y = scrollY, dy = y - TB.y; TB.y = y;
      var dt = Math.max(8, ts - (TB.t || ts - 16)); TB.t = ts; TB.v = TB.v * .5 + (dy / dt) * .5;
      if (S.view === "read" && !S.sel.length) {
        var max = document.documentElement.scrollHeight - innerHeight;
        if (y < 60 || y > max - 24) tbHide(false);
        else if (dy > 0 && y > 90) tbHide(true);
        else if (dy < 0 && TB.v < -0.9) tbHide(false);
      } else tbHide(false);
      if (y < 12) TB.k = 0;
      else if (dy > 0) TB.k = Math.min(1, TB.k + dy / 70);
      else if (dy < 0) TB.k = Math.max(0, TB.k + dy / 180);
      $("tabs").style.setProperty("--tbs", (1 - .08 * TB.k).toFixed(4));
    });
  }, { passive: true });
  $("tabs").addEventListener("pointercancel", function (e) { if (e.pointerType === "touch" || !TD.p || TD.p.id !== e.pointerId) return; if (TD.p.on) tdEnd(e); else { TD.p = null; $("tabs").classList.remove("press"); } });

  if ("serviceWorker" in navigator && location.protocol !== "file:") { window.addEventListener("load", function () { navigator.serviceWorker.register("sw.js").catch(function () {}); }); }

  applySettings();
  route();
  renderAkun();
  document.documentElement.classList.add("ready");
})();
