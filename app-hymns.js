"use strict";
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

