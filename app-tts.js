"use strict";
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

