"use strict";
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
function askTradisi() { if (openSheet) { setTimeout(askTradisi, 1500); return; } show("shTrad"); }
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
