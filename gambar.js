/* EvoBible: pembuat gambar ayat untuk dibagikan (WA grup/status, IG Story/Feed, TikTok, dll).
   Semua digambar di HP (canvas), tanpa server. Pakai: EvoGambar.open({ text, ref, toast }). */
(function () {
  "use strict";
  var FMT = { story: [1080, 1920, "Story 9:16"], post: [1080, 1350, "Post 4:5"], kotak: [1080, 1080, "Kotak 1:1"] };
  var SERIF = '"Source Serif 4", Georgia, serif', SANS = '"Plus Jakarta Sans", system-ui, sans-serif';
  var st = { fmt: "story", tpl: "musim", font: "serif", align: "center", size: 100, mark: true, text: "", ref: "", photo: null, toast: null };
  var root = null, cv = null, raf = 0, isOpen = false, lastFocus = null;

  function $(id) { return document.getElementById(id); }
  function cssVar(n, d) { var v = getComputedStyle(document.documentElement).getPropertyValue(n).trim(); return /^#[0-9a-f]{3,8}$/i.test(v) ? v : d; }
  function lin(g, w, h, stops, diag) {
    var gr = diag ? g.createLinearGradient(0, 0, w, h) : g.createLinearGradient(0, 0, 0, h);
    stops.forEach(function (s) { gr.addColorStop(s[0], s[1]); }); g.fillStyle = gr; g.fillRect(0, 0, w, h);
  }
  function glow(g, x, y, r, color, a) {
    var gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, color); gr.addColorStop(1, "rgba(0,0,0,0)");
    g.save(); g.globalAlpha = a; g.fillStyle = gr; g.fillRect(0, 0, g.canvas.width, g.canvas.height); g.restore();
  }
  function shadeTop(g, w, h, a) { var gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, "rgba(0,0,0," + a + ")"); gr.addColorStop(.6, "rgba(0,0,0," + a * .3 + ")"); gr.addColorStop(1, "rgba(0,0,0," + a * .8 + ")"); g.fillStyle = gr; g.fillRect(0, 0, w, h); }
  function rnd(seed) { return function () { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; }; }
  function stars(g, w, h, n) { var r = rnd(7); g.save(); g.fillStyle = "#fff"; for (var i = 0; i < n; i++) { g.globalAlpha = .25 + r() * .6; var s = (r() * 2.2 + .6) * w / 1080; g.beginPath(); g.arc(r() * w, r() * h * .85, s, 0, 7); g.fill(); } g.restore(); }
  function rays(g, w, h, color, a) { g.save(); g.globalAlpha = a; g.fillStyle = color; for (var i = 0; i < 5; i++) { g.beginPath(); g.moveTo(w * (.55 + i * .05), -h * .05); g.lineTo(w * (.1 + i * .17), h * 1.05); g.lineTo(w * (.18 + i * .17), h * 1.05); g.closePath(); g.fill(); } g.restore(); }
  function dots(g, w, h, color, a) { var r = rnd(3); g.save(); g.fillStyle = color; g.globalAlpha = a; for (var i = 0; i < 900 * (w * h) / (1080 * 1920); i++) { g.fillRect(r() * w, r() * h, w / 1080 * 1.5, w / 1080 * 1.5); } g.restore(); }
  function clouds(g, w, h) { var r = rnd(11); g.save(); g.fillStyle = "#fff"; for (var i = 0; i < 9; i++) { g.globalAlpha = .18 + r() * .2; var x = r() * w, y = r() * h, rr = (60 + r() * 140) * w / 1080; g.beginPath(); g.ellipse(x, y, rr * 1.8, rr, 0, 0, 7); g.fill(); } g.restore(); }
  function frame(g, w, h, color, a) { var m = w * .045; g.save(); g.strokeStyle = color; g.globalAlpha = a; g.lineWidth = w / 360; g.strokeRect(m, m, w - m * 2, h - m * 2); g.strokeRect(m * 1.35, m * 1.35, w - m * 2.7, h - m * 2.7); g.restore(); }

  // dark = teks terang. acc = warna aksen untuk tanda kutip dan alamat ayat.
  var TPL = [
    { k: "musim", n: "Masa gerejawi", dark: true, draw: function (g, w, h) { var a = cssVar("--s1", "#2e7d4f"), b = cssVar("--s2", "#a8d5ba"); lin(g, w, h, [[0, a], [1, a]]); glow(g, w * .85, h * .1, w * 1.1, b, .55); glow(g, w * .1, h * .95, w * .9, b, .3); shadeTop(g, w, h, .35); }, acc: function () { return cssVar("--s2", "#f5cf6b"); } },
    { k: "fajar", n: "Fajar", dark: false, draw: function (g, w, h) { lin(g, w, h, [[0, "#fff1dc"], [.55, "#ffd2b0"], [1, "#ff9f8a"]]); glow(g, w * .5, h * .78, w * .7, "#fff6c8", .9); }, ink: "#3b2414", acc: "#c2552f" },
    { k: "senja", n: "Senja", dark: true, draw: function (g, w, h) { lin(g, w, h, [[0, "#2a1458"], [.55, "#a3367a"], [1, "#ff9a62"]]); glow(g, w * .5, h * .92, w * .75, "#ffd28a", .6); }, acc: "#ffd28a" },
    { k: "laut", n: "Laut", dark: true, draw: function (g, w, h) { lin(g, w, h, [[0, "#0d2230"], [.5, "#1d4a5e"], [1, "#2f7c86"]]); rays(g, w, h, "#bfe8ff", .07); }, acc: "#9fdcf0" },
    { k: "hutan", n: "Hutan", dark: true, draw: function (g, w, h) { lin(g, w, h, [[0, "#0c2f22"], [.6, "#1f5b40"], [1, "#4f8f63"]]); rays(g, w, h, "#e9ffd6", .06); glow(g, w * .8, 0, w * .9, "#d7f5b5", .25); }, acc: "#cfe9a8" },
    { k: "kertas", n: "Kertas", dark: false, draw: function (g, w, h) { lin(g, w, h, [[0, "#f8f3e8"], [1, "#efe6d4"]]); dots(g, w, h, "#7a6a50", .08); frame(g, w, h, "#9b8763", .5); }, ink: "#2b2620", acc: "#8a6a32" },
    { k: "malam", n: "Malam", dark: true, draw: function (g, w, h) { lin(g, w, h, [[0, "#050914"], [1, "#152447"]]); glow(g, w * .5, h * .35, w * .9, "#2b4a8a", .6); stars(g, w, h, 160 * (w * h) / (1080 * 1920)); }, acc: "#ffe08a" },
    { k: "langit", n: "Langit", dark: false, draw: function (g, w, h) { lin(g, w, h, [[0, "#9cc3ff"], [1, "#d9f0ff"]]); clouds(g, w, h); }, ink: "#16274a", acc: "#2f5fb3" },
    { k: "mawar", n: "Mawar", dark: false, draw: function (g, w, h) { lin(g, w, h, [[0, "#ffe6ea"], [1, "#f6a9b8"]], true); glow(g, w * .15, h * .1, w * .8, "#ffffff", .6); }, ink: "#4a1f2a", acc: "#b23a58" },
    { k: "emas", n: "Emas", dark: true, draw: function (g, w, h) { lin(g, w, h, [[0, "#141414"], [1, "#24201a"]]); glow(g, w * .5, h * .5, w * .8, "#c9a45c", .18); frame(g, w, h, "#c9a45c", .85); }, ink: "#f5ead2", acc: "#d8b46a" }
  ];
  var PHOTO = { k: "foto", n: "Foto saya", dark: true, acc: "#ffffff", draw: function (g, w, h) {
    var im = st.photo; if (!im) { lin(g, w, h, [[0, "#333"], [1, "#111"]]); return; }
    var s = Math.max(w / im.width, h / im.height), iw = im.width * s, ih = im.height * s;
    g.drawImage(im, (w - iw) / 2, (h - ih) / 2, iw, ih); g.fillStyle = "rgba(0,0,0,.42)"; g.fillRect(0, 0, w, h);
  } };
  function tplOf(k) { if (k === "foto") return PHOTO; for (var i = 0; i < TPL.length; i++) if (TPL[i].k === k) return TPL[i]; return TPL[0]; }
  function accOf(t) { return typeof t.acc === "function" ? t.acc() : t.acc; }

  function wrap(g, text, maxW) {
    var out = [];
    String(text).split(/\n+/).forEach(function (para) {
      var words = para.trim().split(/\s+/), line = "";
      words.forEach(function (wd) { if (!wd) return; var t = line ? line + " " + wd : wd; if (g.measureText(t).width > maxW && line) { out.push(line); line = wd; } else line = t; });
      if (line) out.push(line);
    });
    return out;
  }

  function draw(g, w, h, preview) {
    var t = tplOf(st.tpl);
    g.clearRect(0, 0, w, h); g.save(); t.draw(g, w, h); g.restore();
    var ink = t.ink || (t.dark ? "#ffffff" : "#1b1b1b"), acc = accOf(t) || ink;
    var fam = st.font === "serif" ? SERIF : SANS, weight = st.font === "serif" ? 500 : 600;
    var padX = w * (st.align === "left" ? .11 : .1), maxW = w - padX * 2;
    var zoneTop = st.fmt === "story" ? h * .17 : h * .12, zoneBot = st.fmt === "story" ? h * .78 : h * .82, maxH = zoneBot - zoneTop;
    var text = (st.text || "").trim() || " ", base = { story: 84, post: 68, kotak: 60 }[st.fmt] * w / 1080, size = base * st.size / 100, lines, lh, refSize, block;
    for (var i = 0; i < 40; i++) {
      g.font = weight + " " + size + "px " + fam; lines = wrap(g, text, maxW); lh = size * 1.42;
      refSize = Math.max(size * .5, 28 * w / 1080); block = size * 1.9 + lines.length * lh + (st.ref ? refSize * 2.4 : 0);
      if (block <= maxH || size <= 26 * w / 1080) break; size *= .94;
    }
    var y = zoneTop + (maxH - block) / 2, x = st.align === "left" ? padX : w / 2;
    g.textAlign = st.align === "left" ? "left" : "center"; g.textBaseline = "alphabetic";
    if (t.dark) { g.shadowColor = "rgba(0,0,0,.28)"; g.shadowBlur = size * .25; }
    // tanda kutip besar
    g.save(); g.shadowBlur = 0; g.fillStyle = acc; g.globalAlpha = .9; g.font = "700 " + size * 3.4 + "px " + SERIF; g.fillText("“", x, y + size * 2.3); g.restore();
    y += size * 1.9;
    g.fillStyle = ink; g.font = weight + " " + size + "px " + fam;
    lines.forEach(function (ln, j) { g.fillText(ln, x, y + lh * (j + 1) - lh * .28); });
    y += lines.length * lh;
    if (st.ref) {
      g.shadowBlur = 0; g.fillStyle = acc; g.font = "800 " + refSize + "px " + SANS;
      var r = String(st.ref).toUpperCase(); try { g.letterSpacing = refSize * .08 + "px"; } catch (e) {}
      g.fillText(r, x, y + refSize * 1.9); try { g.letterSpacing = "0px"; } catch (e2) {}
    }
    g.shadowBlur = 0;
    if (st.mark) { var ms = 30 * w / 1080; g.font = "800 " + ms + "px " + SANS; g.fillStyle = ink; g.globalAlpha = .65; g.textAlign = "center"; g.fillText("EvoBible", w / 2, h - (st.fmt === "story" ? h * .07 : h * .05)); g.globalAlpha = 1; }
  }

  function render() {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () { var f = FMT[st.fmt]; if (cv.width !== f[0] || cv.height !== f[1]) { cv.width = f[0]; cv.height = f[1]; } draw(cv.getContext("2d"), f[0], f[1]); $("imk").dataset.fmt = st.fmt; });
  }
  function thumbs() {
    var box = $("imkTpl"), html = "";
    TPL.concat([PHOTO]).forEach(function (t) { html += '<button type="button" class="imk-th" data-tpl="' + t.k + '" aria-pressed="' + (st.tpl === t.k) + '"><canvas width="90" height="160"></canvas><span>' + t.n + "</span></button>"; });
    html += '<label class="imk-th imk-up"><input type="file" accept="image/*" id="imkFile" hidden><span class="imk-plus">+</span><span>Pilih foto</span></label>';
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll("[data-tpl]"), function (b) { var c = b.querySelector("canvas"), g = c.getContext("2d"), t = tplOf(b.dataset.tpl); t.draw(g, 90, 160); });
    $("imkFile").onchange = function () {
      var f = this.files && this.files[0]; if (!f) return;
      var url = URL.createObjectURL(f), im = new Image();
      im.onload = function () { st.photo = im; st.tpl = "foto"; thumbs(); render(); };
      im.onerror = function () { if (st.toast) st.toast("Foto tidak bisa dibuka"); };
      im.src = url; this.value = "";
    };
  }
  function segs() {
    [["imkFmt", "fmt"], ["imkFont", "font"], ["imkAlign", "align"]].forEach(function (p) { Array.prototype.forEach.call($(p[0]).children, function (b) { b.setAttribute("aria-pressed", String(b.dataset.v === st[p[1]])); }); });
    Array.prototype.forEach.call($("imkTpl").querySelectorAll("[data-tpl]"), function (b) { b.setAttribute("aria-pressed", String(b.dataset.tpl === st.tpl)); });
  }
  function fileName() { return "evobible-" + (st.ref || "ayat").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + ".png"; }
  function toFile() {
    var d = cv.toDataURL("image/png"), bin = atob(d.split(",")[1]), a = new Uint8Array(bin.length);
    for (var i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new File([a], fileName(), { type: "image/png" });
  }
  function download(f) { var u = URL.createObjectURL(f), a = document.createElement("a"); a.href = u; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(u); }, 4000); }

  function build() {
    root = document.createElement("div");
    root.className = "imk"; root.id = "imk"; root.hidden = true;
    root.setAttribute("role", "dialog"); root.setAttribute("aria-modal", "true"); root.setAttribute("aria-label", "Buat gambar ayat");
    root.innerHTML =
      '<header class="imk-top"><button type="button" class="ib" data-imk="close" aria-label="Tutup"><svg class="ico" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button><b>Buat gambar</b><span class="imk-sp"></span></header>' +
      '<div class="imk-prev"><canvas id="imkCv" aria-label="Pratinjau gambar"></canvas></div>' +
      '<div class="imk-ctl">' +
        '<div class="seg imk-seg" id="imkFmt">' + Object.keys(FMT).map(function (k) { return '<button type="button" data-v="' + k + '">' + FMT[k][2] + "</button>"; }).join("") + "</div>" +
        '<p class="imk-hint">Story 9:16 untuk WA Status, IG Story, dan TikTok. Post dan Kotak untuk grup WA dan feed.</p>' +
        '<div class="imk-lab">Latar</div><div class="imk-tpl" id="imkTpl"></div>' +
        '<div class="imk-lab">Teks</div>' +
        '<textarea id="imkTx" rows="4" maxlength="600" aria-label="Teks pada gambar"></textarea>' +
        '<input id="imkRef" maxlength="80" aria-label="Alamat ayat" placeholder="Alamat ayat">' +
        '<div class="imk-row"><div class="seg" id="imkFont"><button type="button" data-v="serif">Huruf klasik</button><button type="button" data-v="sans">Huruf modern</button></div>' +
        '<div class="seg" id="imkAlign"><button type="button" data-v="center">Tengah</button><button type="button" data-v="left">Kiri</button></div></div>' +
        '<label class="imk-size">Ukuran huruf<input type="range" id="imkSz" min="70" max="130" step="5" value="100"></label>' +
        '<label class="imk-chk"><input type="checkbox" id="imkMark" checked> Tampilkan tulisan EvoBible</label>' +
      "</div>" +
      '<footer class="imk-act"><button type="button" class="btn sec" data-imk="save">Unduh</button><button type="button" class="btn pri" data-imk="share">Bagikan</button></footer>';
    document.body.appendChild(root);
    cv = $("imkCv");
    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-imk]"), sg = e.target.closest(".seg button"), tb = e.target.closest("[data-tpl]");
      if (b) {
        var a = b.dataset.imk;
        if (a === "close") { close(); return; }
        var f; try { f = toFile(); } catch (x) { if (st.toast) st.toast("Gambar gagal dibuat"); return; }
        if (a === "share") {
          if (navigator.canShare && navigator.canShare({ files: [f] })) navigator.share({ files: [f], title: st.ref || "EvoBible" }).catch(function () {});
          else { download(f); if (st.toast) st.toast("HP ini belum bisa berbagi langsung. Gambar diunduh, silakan bagikan dari galeri."); }
        } else { download(f); if (st.toast) st.toast("Gambar disimpan"); }
        return;
      }
      if (tb) { if (tb.dataset.tpl === "foto" && !st.photo) { $("imkFile").click(); return; } st.tpl = tb.dataset.tpl; segs(); render(); return; }
      if (sg) { var key = { imkFmt: "fmt", imkFont: "font", imkAlign: "align" }[sg.parentNode.id]; if (key) { st[key] = sg.dataset.v; segs(); render(); } }
    });
    $("imkTx").addEventListener("input", function () { st.text = this.value; render(); });
    $("imkRef").addEventListener("input", function () { st.ref = this.value; render(); });
    $("imkSz").addEventListener("input", function () { st.size = +this.value; render(); });
    $("imkMark").addEventListener("change", function () { st.mark = this.checked; render(); });
    root.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  }

  function open(o) {
    o = o || {};
    if (!root) build();
    st.text = String(o.text || "").trim(); st.ref = String(o.ref || "").trim(); st.toast = o.toast || null; st.size = 100;
    $("imkTx").value = st.text; $("imkRef").value = st.ref; $("imkSz").value = 100; $("imkMark").checked = st.mark;
    lastFocus = document.activeElement;
    root.hidden = false; isOpen = true; document.body.classList.add("imk-open");
    thumbs(); segs();
    var go = function () { render(); };
    if (document.fonts && document.fonts.load) Promise.all([document.fonts.load("500 60px " + SERIF), document.fonts.load("800 30px " + SANS), document.fonts.load("600 60px " + SANS)]).then(go, go); else go();
    setTimeout(function () { var b = root.querySelector("[data-imk=close]"); if (b) b.focus(); }, 50);
  }
  function close() { if (!root || !isOpen) return; root.hidden = true; isOpen = false; document.body.classList.remove("imk-open"); if (lastFocus && lastFocus.focus) try { lastFocus.focus(); } catch (e) {} }

  window.EvoGambar = { open: open, close: close, isOpen: function () { return isOpen; } };
})();
