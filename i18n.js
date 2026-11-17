/* EvoBible i18n: lapisan terjemahan antarmuka.
 *
 * Cara kerja
 *   Kode aplikasi tetap menulis teks dalam bahasa Indonesia. Bila bahasa Inggris aktif, lapisan ini
 *   menerjemahkan teks yang tampil di layar (isi teks dan atribut aria-label, placeholder, title, alt) memakai:
 *     1. I18N_EN.exact    kamus persis: teks Indonesia -> teks Inggris
 *     2. I18N_EN.pat      pola untuk teks yang berisi angka, nama, atau tanggal
 *     3. nama kitab, bulan, dan hari di dalam teks
 *   Teks Alkitab, isi tulisan AI, dan isian pengguna tidak disentuh (lihat SKIP).
 *   Saat bahasa Indonesia aktif, lapisan ini tidak berjalan sama sekali.
 *
 * Menambah atau mengubah fitur
 *   Tulis teks Indonesia seperti biasa, lalu tambahkan terjemahannya di i18n-en.js.
 *   Untuk mencari teks yang belum diterjemahkan: buka aplikasi dengan ?lang=en, jelajahi layarnya,
 *   lalu jalankan EvoI18n.missing() di konsol.
 *
 * Merilis pilihan bahasa
 *   Ubah ENABLED menjadi true, lalu tambahkan pilihan bahasa di pengaturan yang menyimpan
 *   localStorage "evo.lang" ("id" atau "en") dan memuat ulang halaman.
 *
 * Aturan tetap: lapisan ini HANYA untuk bahasa tampilan (evo.lang). Bahasa isi (evo.clang: renungan,
 * doa AI, kata kunci pencarian) dan versi Alkitab (evo.ver: teks ayat di mana pun) adalah preferensi
 * terpisah dan tidak boleh diturunkan dari bahasa tampilan. Lihat README, bagian "Bahasa (i18n)".
 */
(function () {
  var ENABLED = false;
  var D = window.I18N_EN || { exact: {}, pat: [], books: {}, months: {}, days: {} };
  var lang = "id";
  try { if (ENABLED && localStorage.getItem("evo.lang") === "en") lang = "en"; } catch (e) {}
  var m = /[?&]lang=(en|id)\b/.exec(location.search);
  if (m) lang = m[1];

  var api = { lang: lang, t: function (s) { return s; }, missing: function () { return []; }, enabled: ENABLED };
  window.EvoI18n = api;
  if (lang !== "en") return;
  document.documentElement.lang = "en";

  // Bagian yang tidak diterjemahkan: teks Alkitab, isi AI, isian pengguna.
  var SKIP = "#text .v:not(.vom), #text h3, .go span, .vt, .rtx, .vc, .pr-title, .pr-story p, .pr-sec > p, .pr-dtitle, .pr-end, .jr-body, [data-noi18n], script, style, code";
  var ATTRS = ["aria-label", "placeholder", "title", "alt"];

  var EX = {};
  Object.keys(D.exact).forEach(function (k) { EX[norm(k)] = D.exact[k]; });
  var bookNames = Object.keys(D.books).sort(function (a, b) { return b.length - a.length; });
  var BOOK_ANY = bookNames.length ? new RegExp("(^|[\\s(“\"])(" + bookNames.map(esc).join("|") + ")(?=\\s+\\d)", "g") : null;
  var MON = Object.keys(D.months), MON_RE = MON.length ? new RegExp("(\\d{1,2}\\s+)(" + MON.join("|") + ")\\b|\\b(" + MON.join("|") + ")(\\s+\\d{4})", "g") : null;
  var DAY = Object.keys(D.days), DAY_RE = DAY.length ? new RegExp("\\b(" + DAY.join("|") + ")(?=,\\s*\\d)", "g") : null;
  var miss = {};

  function esc(s) { return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }
  function norm(s) { return String(s).replace(/\s+/g, " ").trim(); }
  function keep(orig, out) {
    var a = /^\s*/.exec(orig)[0], b = /\s*$/.exec(orig)[0];
    return a + out + b;
  }
  /* nama kitab, bulan, dan hari di dalam teks */
  function names(s) {
    if (BOOK_ANY) s = s.replace(BOOK_ANY, function (all, pre, bk) { return pre + D.books[bk]; });
    if (MON_RE) s = s.replace(MON_RE, function (all, d, m1, m2, y) { return m1 ? d + D.months[m1] : D.months[m2] + y; });
    if (DAY_RE) s = s.replace(DAY_RE, function (all, d) { return D.days[d]; });
    return s;
  }
  function tr(s) {
    var k = norm(s);
    if (!k || !/[A-Za-z]/.test(k)) return s;
    if (EX[k] != null) return keep(s, EX[k]);
    for (var i = 0; i < D.pat.length; i++) {
      var p = D.pat[i];
      if (p[0].test(k)) return keep(s, names(k.replace(p[0], p[1])));
    }
    var n = names(k);
    if (n !== k || (MON_RE && new RegExp(MON_RE.source).test(k)) || (BOOK_ANY && new RegExp(BOOK_ANY.source).test(k))) return keep(s, n);
    miss[k] = (miss[k] || 0) + 1;
    return s;
  }
  api.t = tr;
  api.missing = function () { return Object.keys(miss).sort(); };

  var done = new WeakMap();
  function doText(node) {
    var pe = node.parentElement;
    if (pe && (pe.tagName === "TEXTAREA" || pe.tagName === "INPUT")) return; // isian pengguna
    var v = node.nodeValue;
    if (done.get(node) === v) return;
    var out = tr(v);
    done.set(node, out);
    if (out !== v) node.nodeValue = out;
  }
  function doAttrs(el) {
    var mem = done.get(el) || {};
    for (var i = 0; i < ATTRS.length; i++) {
      var a = ATTRS[i], v = el.getAttribute(a);
      if (v == null || mem[a] === v) continue;
      var out = tr(v); mem[a] = out;
      if (out !== v) el.setAttribute(a, out);
    }
    done.set(el, mem);
  }
  function skipped(el) { return el && el.closest && el.closest(SKIP); }
  function walk(root) {
    if (root.nodeType === 3) { if (!skipped(root.parentElement)) doText(root); return; }
    if (root.nodeType !== 1 || skipped(root)) return;
    doAttrs(root);
    var w = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
      acceptNode: function (n) { return n.nodeType === 1 && n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT; }
    });
    var n;
    while ((n = w.nextNode())) { if (n.nodeType === 3) doText(n); else doAttrs(n); }
  }
  function start() {
    walk(document.body);
    new MutationObserver(function (list) {
      for (var i = 0; i < list.length; i++) {
        var r = list[i];
        if (r.type === "childList") { for (var j = 0; j < r.addedNodes.length; j++) walk(r.addedNodes[j]); }
        else if (r.type === "characterData") { if (!skipped(r.target.parentElement)) doText(r.target); }
        else if (r.type === "attributes") { if (!skipped(r.target)) doAttrs(r.target); }
      }
    }).observe(document.body, { childList: true, subtree: true, characterData: true, attributes: true, attributeFilter: ATTRS });
  }
  if (document.body) start(); else document.addEventListener("DOMContentLoaded", start);
})();
