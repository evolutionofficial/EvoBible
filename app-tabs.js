"use strict";
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
