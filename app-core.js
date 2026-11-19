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
settings.sea = "on";
var recent = lsGet("evo.recent", []);
var openSheet = null, toastT;

/* ---------- shared helpers ---------- */
function norm(s) { return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim(); }

function toast(m) { var t = $("toast"); t.textContent = m; t.hidden = false; clearTimeout(toastT); toastT = setTimeout(function () { t.hidden = true; }, 3500); }
function copyText(text, msg) {
  function done() { toast(msg || "Disalin"); }
  function fb() { var ta = document.createElement("textarea"); ta.value = text; ta.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(ta); ta.select(); try { document.execCommand("copy"); done(); } catch (e) { toast("Tidak bisa menyalin"); } document.body.removeChild(ta); }
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, fb); else fb();
}
function verseCopy(id) { return clean(texts[id]) + "\n\n" + refOf(id) + " (AYT)"; }
