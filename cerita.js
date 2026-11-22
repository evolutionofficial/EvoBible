/* EvoBible: Cari Kisah. Cari kisah, tokoh, atau peristiwa Alkitab dari deskripsi bebas.
   Katalog: cerita/pl.json dan cerita/pb.json (dibuat dengan tools/cerita-build.py, rujukan diperiksa terhadap AYT).
   Pencarian lokal (offline) selalu jalan; AI (fungsi "kisah") menyusun ulang dan boleh menyarankan rujukan lain,
   yang diperiksa lagi di perangkat dan diberi label "Saran AI". Item bertanda x adalah tafsiran. */
(function () {
  "use strict";
  var API = "https://ddydxagduxhzzsrlwgkd.supabase.co/functions/v1/kisah";
  var C = null, X = {}, ready = null, seq = 0;
  var STOP = {};
  ("yang dan di ke dari untuk pada dengan itu ini ada apa siapa mana kapan bagaimana kenapa mengapa saat waktu ketika tentang soal cerita kisah dalam alkitab bible ayat tolong cari carikan mau ingin aku saya kamu dia mereka nya lah kah atau juga sudah pernah dulu yg dgn utk sebuah seorang oleh akan telah agar supaya sampai hingga lalu terus lagi nih dong sih ya diri").split(" ").forEach(function (w) { STOP[w] = 1; });
  var GEN = { ngapain: 1, apa: 1, melakukan: 1, lakukan: 1, kerja: 1, nabi: 1, raja: 1, rasul: 1, tokoh: 1, orang: 1, hamba: 1, perjanjian: 1, lama: 1, baru: 1 };
  var SYN = { yesus: "kristus mesias anak allah tuhan", kristus: "yesus mesias", mesias: "kristus yesus", setan: "iblis", iblis: "setan", hantu: "roh jahat", jahat: "setan iblis roh", mukjizat: "ajaib tanda keajaiban", ajaib: "mukjizat", mati: "meninggal kematian", meninggal: "mati kematian", bangkit: "kebangkitan hidup kembali", gua: "lubang goa", goa: "gua", singa: "singa", ikan: "paus", paus: "ikan", bahtera: "kapal air bah", banjir: "air bah bahtera", perahu: "kapal bahtera", api: "tungku bara", hakim: "hakim", perempuan: "wanita istri", wanita: "perempuan istri", anak: "putra putri", lahir: "kelahiran", sakit: "sembuh penyakit", sembuh: "sakit penyakit", buta: "mata", lumpuh: "pincang", kaya: "harta kekayaan", uang: "perak emas", doa: "berdoa", puasa: "berpuasa", takut: "gentar cemas", sedih: "tangis ratap", menikah: "pernikahan kawin", nikah: "pernikahan", angin: "badai", badai: "angin topan", laut: "danau", bintang: "bintang", mimpi: "penglihatan", penglihatan: "mimpi", malaikat: "utusan", tampak: "menampakkan penampakan", menampakkan: "penampakan tampak", muncul: "menampakkan penampakan", teofani: "penampakan", teofani2: "" };
  function fold(s) { s = String(s || "").toLowerCase(); try { s = s.normalize("NFD").replace(/[̀-ͯ]/g, ""); } catch (e) {} return s.replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim(); }
  function stem(w) {
    if (w.length < 5) return w;
    var p = /^(meng|meny|mem|men|me|ber|ter|di|ke|pe|per|se)/.exec(w); if (p && w.length - p[1].length >= 4) w = w.slice(p[1].length);
    var s = /(kan|an|i|nya|lah|kah|pun)$/.exec(w); if (s && w.length - s[1].length >= 4) w = w.slice(0, w.length - s[1].length);
    return w;
  }
  function toks(s) { var o = [], seen = {}; fold(s).split(" ").forEach(function (w) { if (!w || STOP[w] || seen[w]) return; seen[w] = 1; o.push(w); }); return o; }
  function stems(s) { return toks(s).map(stem); }

  function load() {
    if (ready) return ready;
    function get(f) { return fetch("cerita/" + f + ".json").then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }); }
    ready = Promise.all([get("pl"), get("pb")]).then(function (a) {
      C = a[0].concat(a[1]); var df = {};
      C.forEach(function (e) {
        e._j = fold(e.j); e._t = (e.t || []).map(fold); e._tt = fold((e.t || []).join(" "));
        e._k = fold(e.k); e._s = fold(e.s); e._r = fold(e.r);
        var all = stems(e.j + " " + (e.t || []).join(" ") + " " + e.k + " " + e.s), seen = {};
        e._w = {}; all.forEach(function (w) { e._w[w] = 1; if (!seen[w]) { seen[w] = 1; df[w] = (df[w] || 0) + 1; } });
      });
      X.df = df; X.n = C.length; return C;
    });
    return ready;
  }
  function has(t, w) { if (w.length > 4) return t.indexOf(w) >= 0; return (" " + t).indexOf(" " + w) >= 0; }
  function idf(w) { var d = X.df[w] || 0; return Math.log(1 + X.n / (1 + d)); }

  function scope(q) {
    var f = fold(q), sc = "";
    if (/\b(perjanjian lama|pl)\b/.test(f)) sc = "pl"; else if (/\b(perjanjian baru|pb)\b/.test(f)) sc = "pb";
    return sc;
  }
  function expand(ws) {
    var out = [], seen = {};
    ws.forEach(function (w) { [w].concat((SYN[w] || "").split(" ")).forEach(function (x, i) { x = stem(x); if (!x || seen[x]) return; seen[x] = 1; out.push({ w: x, k: i ? 0.55 : 1, orig: !i }); }); });
    return out;
  }
  function search(q) {
    var sc = scope(q), base = toks(q.replace(/perjanjian\s+(lama|baru)/ig, " ")).filter(function (w) { return w !== "pl" && w !== "pb"; });
    var ws = base.filter(function (w) { return !GEN[w]; }); if (!ws.length) ws = base;
    var ex = expand(ws); if (!ex.length) return { list: [], tokoh: "" };
    var res = [];
    C.forEach(function (e) {
      if (sc === "pl" && e.o >= 40e6) return; if (sc === "pb" && e.o < 40e6) return;
      var s = 0, hit = 0;
      ex.forEach(function (x) {
        var wgt = idf(x.w) * x.k, raw = x.orig ? x.w : x.w, m = 0;
        if (has(e._j, raw)) m = Math.max(m, 4); if (has(e._tt, raw)) m = Math.max(m, 5); if (has(e._k, raw)) m = Math.max(m, 3.2);
        if (has(e._r, raw)) m = Math.max(m, 2.5); if (has(e._s, raw)) m = Math.max(m, 1.6); if (!m && e._w[x.w]) m = 1.2;
        if (m) { s += m * wgt; if (x.orig) hit++; }
      });
      var need = ws.length >= 4 ? 2 : 1;
      if (s > 0 && (hit >= need || ws.length === 1 || s > 9)) res.push({ e: e, s: s + hit * 2 });
    });
    res.sort(function (a, b) { return b.s - a.s || a.e.o - b.e.o; });
    /* mode tokoh: satu nama yang cocok dengan banyak kisah -> semua kisahnya, urut Alkitab */
    var tk = "";
    if (ws.length === 1) {
      var cnt = {};
      ws.forEach(function (w) { if (w.length < 4) { cnt[w] = 0; return; } var n = 0; C.forEach(function (e) { if (e._t.some(function (t) { return t === w || t.indexOf(w + " ") === 0 || t.indexOf(" " + w) >= 0; })) n++; }); cnt[w] = n >= 0.3 * (X.df[stem(w)] || 1) ? n : 0; });
      var bw = ""; ws.forEach(function (w) { if (cnt[w] >= 3 && (!bw || cnt[w] > cnt[bw])) bw = w; });
      if (bw) {
        var all = C.filter(function (e) { if (sc === "pl" && e.o >= 40e6) return false; if (sc === "pb" && e.o < 40e6) return false; return e._t.some(function (t) { return t === bw || t.indexOf(bw + " ") === 0 || t.indexOf(" " + bw) >= 0; }); });
        if (all.length >= 3) { all.sort(function (a, b) { return a.o - b.o; }); res = all.map(function (e) { return { e: e, s: 99 }; }); tk = bw; }
      }
    }
    return { list: res, tokoh: tk };
  }

  /* ---------- tampilan ---------- */
  var ctx, V, SUG = ["Yesus menampakkan diri di Perjanjian Lama", "Daniel di gua singa", "nabi Elia ngapain", "Yunus dan ikan besar", "Musa dan semak yang menyala", "Dua belas pengintai", "perempuan yang berani", "Daud dan Goliat"];
  var ST = { q: "", res: null, ai: null, aiState: "", tokoh: "", more: false };
  function bookIdx(a) { for (var i = 0; i < ctx.BOOKS.length; i++) if (ctx.BOOKS[i].a.toLowerCase() === a.toLowerCase()) return i; return -1; }
  function parseR(r) {
    var m = /^\s*([1-3]?\s?[A-Za-z]+)\s+(\d+)(?::(\d+))?(?:-(\d+)(?::(\d+))?)?/.exec(r || ""); if (!m) return null;
    var b = bookIdx(m[1].replace(/\s/g, ""));
    if (b < 0) { for (var i = 0; i < ctx.BOOKS.length; i++) { var nm = ctx.BOOKS[i].n.toLowerCase().replace(/\s/g, ""); if (nm === m[1].toLowerCase().replace(/\s/g, "") || ctx.BOOKS[i].a.toLowerCase() === m[1].toLowerCase()) { b = i; break; } } }
    if (b < 0) return null;
    var c = +m[2]; if (c < 1 || c > ctx.BOOKS[b].ch.length) return null;
    var vmax = ctx.BOOKS[b].ch[c - 1].v.length, v = m[3] ? +m[3] : 0, v2 = 0;
    if (v) { if (v > vmax) return null; if (m[4] && !m[5]) v2 = Math.min(+m[4], vmax); }
    return { b: b, c: c, v: v, v2: v2 };
  }
  function chip(t) { return '<span class="cchip">' + ctx.esc(t) + "</span>"; }
  function item(e, why, tag) {
    var p = parseR(e.r), x = e.x ? '<span class="ctaf" title="Penafsiran Kristen, bukan keterangan langsung teks">Tafsiran</span>' : "";
    return '<div class="rcard ccard" data-r="' + ctx.esc(e.r) + '" role="button" tabindex="0"><div class="rref">' + ctx.esc(e.r) + x + (tag ? '<span class="csug">' + ctx.esc(tag) + "</span>" : "") + '</div><b class="cj">' + ctx.esc(e.j) + "</b>" +
      (e.s ? '<p class="cs">' + ctx.esc(e.s) + "</p>" : "") + (why ? '<p class="alasan"><b>Mengapa cocok:</b> ' + ctx.esc(why) + "</p>" : "") +
      ((e.t && e.t.length) ? '<div class="cchips">' + e.t.slice(0, 4).map(chip).join("") + "</div>" : "") + (p ? "" : "") + "</div>";
  }
  function paint() {
    var b = V.querySelector("#cBody"), h = "";
    if (!ST.q) { b.innerHTML = '<p class="cnote">Ketik kisah yang kamu ingat, nama tokoh, atau peristiwanya. Tidak perlu tahu ayatnya.</p>'; return; }
    if (!ST.res) { b.innerHTML = '<p class="cnote">Mencari…</p>'; return; }
    var list = [], seen = {}, i;
    if (ST.ai && ST.ai.length) {
      ST.ai.forEach(function (a) {
        if (a.id) { var e = X.by[a.id]; if (e && !seen[a.id]) { seen[a.id] = 1; list.push({ e: a.x && !e.x ? Object.assign({}, e, { x: 1 }) : e, why: a.a }); } }
        else if (a.r && parseR(a.r)) { var pr = parseR(a.r), nm = a.r; list.push({ e: { j: a.j || a.r, r: a.r, s: "", t: [], x: a.x ? 1 : 0 }, why: a.a, tag: "Saran AI, periksa ayatnya" }); }
      });
      ST.res.list.slice(0, 5).forEach(function (r) { if (!seen[r.e.i]) { seen[r.e.i] = 1; if (!ST.tokoh) list.push({ e: r.e }); } });
    } else {
      var lim = ST.more ? 60 : (ST.tokoh ? 60 : 12);
      list = ST.res.list.slice(0, lim).map(function (r) { return { e: r.e }; });
    }
    if (ST.tokoh) h += '<p class="cnote">Semua kisah tentang <b>' + ctx.esc(ST.tokoh) + "</b> yang ada di katalog, urut menurut kitab.</p>";
    if (ST.aiState === "wait") h += '<p class="cnote cai">Menyempurnakan hasil dengan AI…</p>';
    else if (ST.aiState === "off") h += '<p class="cnote">Hasil dari katalog di perangkat (AI tidak terjangkau).</p>';
    else if (ST.aiState === "limit") h += '<p class="cnote">Batas pencarian AI hari ini tercapai. Hasil dari katalog di perangkat.</p>';
    if (!list.length) h += '<div class="care"><b>Belum ketemu</b><p>Coba kata lain: nama tokoh, tempat, atau benda dalam kisahnya (mis. “gua singa”, “tungku api”, “ikan besar”).</p></div>';
    h += list.map(function (x) { return item(x.e, x.why, x.tag); }).join("");
    if (!ST.aiState || ST.aiState === "off" || ST.aiState === "limit") if (!ST.ai && !ST.tokoh && ST.res.list.length > 12 && !ST.more) h += '<button class="btn sec cmore" type="button" data-more="1">Tampilkan lebih banyak</button>';
    if (list.some(function (x) { return x.e.x; })) h += '<p class="cnote cfoot">“Tafsiran” berarti kaitannya dipahami lewat penafsiran Kristen; teksnya sendiri tidak menyebut hal itu secara langsung.</p>';
    h += '<p class="cnote cfoot">Katalog kisah masih draf dan disusun dengan bantuan AI. Periksa ayatnya sebelum dipakai untuk mengajar.</p>';
    b.innerHTML = h;
  }
  function run(q) {
    q = (q || "").trim(); ST.q = q; ST.res = null; ST.ai = null; ST.aiState = ""; ST.tokoh = ""; ST.more = false;
    var my = ++seq; V.querySelector("#cq").value = q; V.classList.toggle("has", !!q); paint();
    if (!q) return;
    load().then(function () {
      if (my !== seq) return;
      if (!X.by) { X.by = {}; C.forEach(function (e) { X.by[e.i] = e; }); }
      var ref = ctx.parseRef ? ctx.parseRef(q) : null;
      ST.res = search(q); ST.tokoh = ST.res.tokoh ? (function () { var t = ""; ST.res.list.some(function (r) { return (r.e.t || []).some(function (n) { if (fold(n).indexOf(ST.res.tokoh) >= 0) { t = n; return true; } }); }); return t || ST.res.tokoh; })() : "";
      paint();
      if (ST.tokoh && ST.res.list.length >= 3 && toks(q).length <= 2) return; // daftar tokoh sudah lengkap tanpa AI
      if (!navigator.onLine) { ST.aiState = "off"; paint(); return; }
      ST.aiState = "wait"; paint();
      var cand = ST.res.list.slice(0, 30).map(function (r) { return [r.e.i, r.e.r, r.e.j, r.e.s.slice(0, 140)]; });
      fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q: q, c: cand, d: ctx.devId, lang: ctx.lang() }) })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (my !== seq) return;
          if (j && j.ok && j.hasil && j.hasil.length) { ST.ai = j.hasil; ST.aiState = ""; }
          else if (j && j.sebab === "batas") ST.aiState = "limit"; else ST.aiState = j && j.ok ? "" : "off";
          paint();
        }).catch(function () { if (my !== seq) return; ST.aiState = "off"; paint(); });
    });
  }
  function build() {
    V.innerHTML = '<div class="inner cwrap"><div class="cseg seg" role="group" aria-label="Jenis pencarian"><button type="button" data-g="kata" aria-pressed="false">Kata persis</button><button type="button" data-g="cerita" aria-pressed="true">Kisah Alkitab</button></div>' +
      '<h1 class="ctitle">Cari Kisah</h1><p class="ssub">Lupa ayatnya? Tulis ceritanya dengan katamu.</p>' +
      '<form class="sbox" id="cForm" role="search"><div class="sta"><textarea id="cq" rows="3" maxlength="200" autocomplete="off" enterkeyhint="search" placeholder="mis. Yesus menampakkan diri di Perjanjian Lama" aria-label="Cari kisah di Alkitab"></textarea></div><button type="submit" class="sgo" aria-label="Cari"><svg class="ico" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg></button></form>' +
      '<div class="schips" id="cChips">' + SUG.map(function (s) { return '<button type="button" class="schip" data-q="' + ctx.esc(s) + '">' + ctx.esc(s) + "</button>"; }).join("") + '</div><div id="cBody"></div></div>';
    V.addEventListener("click", function (e) {
      var t;
      if ((t = e.target.closest("[data-g]"))) { if (t.dataset.g === "kata") ctx.go("kata"); return; }
      if ((t = e.target.closest("[data-q]"))) { run(t.dataset.q); window.scrollTo(0, 0); return; }
      if ((t = e.target.closest("[data-more]"))) { ST.more = true; paint(); return; }
      if ((t = e.target.closest(".ccard"))) { var p = parseR(t.dataset.r); if (p) ctx.openRef(p.b, p.c, p.v, p.v2); }
    });
    V.addEventListener("keydown", function (e) { if ((e.key === "Enter" || e.key === " ") && e.target.classList && e.target.classList.contains("ccard")) { e.preventDefault(); e.target.click(); } });
    V.querySelector("#cForm").onsubmit = function (e) { e.preventDefault(); var q = V.querySelector("#cq").value; V.querySelector("#cq").blur(); run(q); };
    V.querySelector("#cq").addEventListener("keydown", function (e) { if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); V.querySelector("#cForm").requestSubmit(); } });
    V.querySelector("#cq").addEventListener("input", function () { if (!this.value.trim() && ST.q) run(""); });
  }
  window.EvoCerita = {
    init: function (c) { ctx = c; V = c.$("vCerita"); build(); },
    render: function (q) { load(); if (q != null && q !== ST.q) run(q); else if (!ST.q) paint(); },
    parseR: function (r) { return parseR(r); },
    _s: function (q) { return load().then(function () { var r = search(q); return r.list.slice(0, 8).map(function (x) { return [Math.round(x.s * 10) / 10, x.e.r, x.e.j]; }); }); }
  };
})();
