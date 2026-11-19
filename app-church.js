"use strict";
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

