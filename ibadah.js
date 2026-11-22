/* Catatan Ibadah: rekam khotbah, salin ke tulisan, ringkasan otomatis.
   - Rekaman dipotong per 5 menit dan disimpan di HP (IndexedDB) selagi merekam, jadi aman kalau aplikasi tertutup.
   - Layar bisa dihitamkan penuh (layar tetap menyala lewat Wake Lock) supaya hemat baterai tetapi mikrofon tetap aktif.
   - Saat sesi diakhiri, tiap potongan disalin ke teks lewat function `ibadah` (Gemini), lalu diringkas. Audio dihapus setelah berhasil.
   - Ayat yang dibuka selama sesi dicatat beserta menitnya.
   app.js memanggil EvoIbadah.init(ctx), EvoIbadah.render(id), EvoIbadah.onRef(...) dan EvoIbadah.sync(). */
(function () {
  "use strict";
  var API = "https://ddydxagduxhzzsrlwgkd.supabase.co/functions/v1/ibadah";
  var SEG_MS = 5 * 60 * 1000;          // panjang satu potongan rekaman
  var MAX_MS = 3 * 3600 * 1000;        // sesi berhenti otomatis setelah 3 jam
  var MAX_BLOB = 14000000;             // batas ukuran satu potongan yang dikirim (byte)
  var MIN_SEC = 15;                    // sesi lebih pendek dari ini dibuang
  var MAXI = Number.MAX_SAFE_INTEGER;
  var ctx = null, $ = null, esc = null;
  var R = { on: false };               // sesi yang sedang merekam
  var L = [];                          // daftar sesi (terbaru dulu)
  var PR = {};                         // keterangan kemajuan per sesi
  var PROC = {};                       // sesi yang sedang diproses
  var V = { id: "" };                  // tampilan: "" = daftar, selain itu = rincian
  var OK = !!(window.indexedDB && window.MediaRecorder && navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
  var IOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  function noop() {}
  function standalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone === true; }

  /* ---------- penyimpanan (IndexedDB) ---------- */
  var DBP = null;
  function idb() {
    if (DBP) return DBP;
    DBP = new Promise(function (res, rej) {
      var r; try { r = indexedDB.open("evobible-ibadah", 1); } catch (e) { rej(e); return; }
      r.onupgradeneeded = function () { var d = r.result; d.createObjectStore("sesi", { keyPath: "id" }); d.createObjectStore("chk", { keyPath: ["sid", "seg", "i"] }); };
      r.onsuccess = function () { res(r.result); };
      r.onerror = function () { DBP = null; rej(r.error); };
    });
    return DBP;
  }
  function tx(store, mode, fn) {
    return idb().then(function (d) {
      return new Promise(function (res, rej) {
        var t = d.transaction(store, mode), out = fn(t.objectStore(store));
        t.oncomplete = function () { res(out && "result" in out ? out.result : undefined); };
        t.onabort = t.onerror = function () { rej(t.error || new Error("idb")); };
      });
    });
  }
  function putSesi(s) {
    var i = -1; for (var k = 0; k < L.length; k++) if (L[k].id === s.id) { i = k; break; }
    if (i >= 0) L[i] = s; else { L.push(s); }
    L.sort(function (a, b) { return b.t0 - a.t0; });
    return tx("sesi", "readwrite", function (st) { return st.put(s); });
  }
  function getSesi(id) { return tx("sesi", "readonly", function (st) { return st.get(id); }); }
  function allSesi() { return tx("sesi", "readonly", function (st) { return st.getAll(); }).then(function (a) { L = (a || []).sort(function (x, y) { return y.t0 - x.t0; }); return L; }); }
  function putChunk(c) { return tx("chk", "readwrite", function (st) { return st.put(c); }); }
  function segRange(sid, seg) { return IDBKeyRange.bound([sid, seg, 0], [sid, seg, MAXI]); }
  function getChunks(sid, seg) { return tx("chk", "readonly", function (st) { return st.getAll(segRange(sid, seg)); }); }
  function delChunks(sid, seg) { return tx("chk", "readwrite", function (st) { return st.delete(segRange(sid, seg)); }); }
  function delAllChunks(sid) { return tx("chk", "readwrite", function (st) { return st.delete(IDBKeyRange.bound([sid, 0, 0], [sid, MAXI, MAXI])); }); }
  function maxSeg(sid) {
    return tx("chk", "readonly", function (st) { return st.getAllKeys(IDBKeyRange.bound([sid, 0, 0], [sid, MAXI, MAXI])); })
      .then(function (ks) { var m = -1; (ks || []).forEach(function (k) { if (k[1] > m) m = k[1]; }); return m + 1; });
  }

  /* ---------- bantuan ---------- */
  function fmtDur(sec) { sec = Math.max(0, Math.round(sec)); var h = Math.floor(sec / 3600), m = Math.floor(sec / 60) % 60, s = sec % 60; return (h ? h + ":" + (m < 10 ? "0" : "") + m : m) + ":" + (s < 10 ? "0" : "") + s; }
  function fmtMin(sec) { var m = Math.round(sec / 60); return m < 1 ? "<1 mnt" : m + " mnt"; }
  function fmtDate(t) { try { return new Date(t).toLocaleDateString("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric" }); } catch (e) { return new Date(t).toDateString(); } }
  function fmtClock(t) { var d = new Date(t); return ("0" + d.getHours()).slice(-2) + "." + ("0" + d.getMinutes()).slice(-2); }
  function elapsed() { return R.on ? (Date.now() - R.s.t0) / 1000 : 0; }
  function b64(blob) {
    return new Promise(function (res, rej) {
      var fr = new FileReader();
      fr.onload = function () { var s = String(fr.result); res(s.slice(s.indexOf(",") + 1)); };
      fr.onerror = function () { rej(fr.error); };
      fr.readAsDataURL(blob);
    });
  }
  function copyText(t) {
    if (navigator.clipboard && navigator.clipboard.writeText) return navigator.clipboard.writeText(t);
    return new Promise(function (res, rej) {
      var a = document.createElement("textarea"); a.value = t; a.style.cssText = "position:fixed;opacity:0"; document.body.appendChild(a); a.select();
      try { document.execCommand("copy") ? res() : rej(); } catch (e) { rej(e); } a.remove();
    });
  }
  function find(id) { for (var i = 0; i < L.length; i++) if (L[i].id === id) return L[i]; return null; }

  /* ---------- rujukan ayat (teks -> buka ayat) ---------- */
  function nrm(s) { return String(s).toLowerCase().replace(/[^a-z0-9 ]+/g, " ").replace(/\s+/g, " ").trim(); }
  function parseRef(txt) {
    var m = /^\s*(.+?)\s+(\d{1,3})(?:\s*[:.]\s*(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?\s*$/.exec(String(txt));
    if (!m) return null;
    var nm = nrm(m[1]), B = ctx.BOOKS, b = -1, i, cand = [];
    for (i = 0; i < B.length; i++) { if (nrm(B[i].n) === nm || nrm(B[i].a) === nm) { b = i; break; } if (nrm(B[i].n).indexOf(nm) === 0) cand.push(i); }
    if (b < 0 && cand.length === 1) b = cand[0];
    if (b < 0) return null;
    var c = +m[2]; if (c < 1 || c > B[b].ch.length) return null;
    var v = m[3] ? +m[3] : 0, n = B[b].ch[c - 1].v.length; if (v > n) v = n;
    var v2 = m[4] ? Math.min(+m[4], n) : 0;
    return { b: b, c: c, v: v, v2: v2 };
  }

  /* ---------- rekam ---------- */
  function pickMime() {
    var c = ["audio/mp4;codecs=mp4a.40.2", "audio/mp4", "audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus"];
    for (var i = 0; i < c.length; i++) { try { if (MediaRecorder.isTypeSupported(c[i])) return c[i]; } catch (e) {} }
    return "";
  }
  function getStream() { return navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: false, noiseSuppression: true, autoGainControl: true } }); }
  function watchTrack() {
    var tr = R.stream && R.stream.getAudioTracks()[0]; if (!tr) return;
    tr.onended = function () { if (R.on && !R.ending) setTimeout(revive, 400); };
    tr.onmute = function () { R.muteAt = Date.now(); };
    tr.onunmute = function () {
      var g = R.muteAt ? Date.now() - R.muteAt : 0; R.muteAt = 0;
      if (g > 4000) ctx.toast("Mikrofon sempat terputus ±" + Math.round(g / 1000) + " detik");
      revive();
    };
  }
  function lock() {
    if (!R.on) return;
    if (!("wakeLock" in navigator)) { R.nolock = true; return; }
    if (R.wl) return;
    navigator.wakeLock.request("screen").then(function (s) { R.wl = s; s.addEventListener("release", function () { if (R.wl === s) R.wl = null; }); }).catch(noop);
  }
  function newSeg() {
    if (!R.on) return;
    R.seg++; var seg = R.seg, i = 0, rec;
    try { rec = R.mime ? new MediaRecorder(R.stream, { mimeType: R.mime, audioBitsPerSecond: 32000 }) : new MediaRecorder(R.stream); }
    catch (e) { try { rec = new MediaRecorder(R.stream); } catch (e2) { R.dead = true; ui(); ctx.toast("Perekaman tidak bisa dimulai"); return; } }
    var mt = rec.mimeType || R.mime || "audio/mp4";
    R.rec = rec; R.dead = false;
    rec.ondataavailable = function (e) {
      if (!e.data || !e.data.size) return;
      var k = i++, c = { sid: R.s.id, seg: seg, i: k, mime: mt, blob: e.data };
      R.writes = R.writes.then(function () { return putChunk(c); }).catch(noop);
    };
    rec.onstop = function () {
      if (R.rec !== rec) return;
      if (R.ending) { R.writes.then(R.fin || finish); return; }
      if (R.on) newSeg();
    };
    try { rec.start(15000); } catch (e3) { R.dead = true; ui(); return; }
    clearTimeout(R.segT); R.segT = setTimeout(function () { if (R.on && !R.ending && R.rec === rec && rec.state === "recording") { try { rec.stop(); } catch (e) {} } }, SEG_MS);
  }
  function stopQuiet() { var r = R.rec; R.rec = null; clearTimeout(R.segT); if (r) { r.onstop = null; try { if (r.state !== "inactive") r.stop(); } catch (e) {} } }
  function revive() {
    if (!R.on || R.ending) return;
    var tr = R.stream && R.stream.getAudioTracks()[0], okT = tr && tr.readyState === "live", okR = R.rec && R.rec.state === "recording";
    if (okT && okR) return;
    if (okT) { stopQuiet(); newSeg(); return; }
    getStream().then(function (st) { if (!R.on || R.ending) { st.getTracks().forEach(function (t) { t.stop(); }); return; } try { R.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {} R.stream = st; watchTrack(); stopQuiet(); newSeg(); ui(); })
      .catch(function () { R.dead = true; ui(); ctx.toast("Mikrofon terputus. Buka Catatan Ibadah lalu ketuk Lanjutkan."); });
  }
  function mulai() {
    if (R.on) return;
    if (!OK) { ctx.toast("Perekaman belum didukung di browser ini"); return; }
    getStream().then(function (stream) {
      var mime = pickMime(), s = { id: ctx.uuid(), t0: Date.now(), t1: 0, dur: 0, st: "rekam", nseg: 0, mime: mime, ayat: [], tx: {}, lang: ctx.lang() };
      R = { on: true, s: s, stream: stream, mime: mime, seg: -1, rec: null, writes: Promise.resolve(), last: "", tickT: 0, saveAt: 0 };
      putSesi(s).then(noop, noop);
      watchTrack(); lock(); newSeg();
      R.tickT = setInterval(tick, 1000);
      ui(); tick();
      ctx.toast("Merekam. Ketuk ikon bulan untuk layar hitam.");
    }).catch(function (e) {
      ctx.toast(e && (e.name === "NotAllowedError" || e.name === "SecurityError") ? "Izinkan mikrofon untuk merekam" : "Mikrofon tidak bisa dipakai");
    });
  }
  function akhiri(force) {
    if (!R.on || R.ending) return;
    if (!force && !confirm("Akhiri sesi ibadah dan mulai menyalin ke tulisan?")) return;
    R.ending = true; clearTimeout(R.segT); black(false);
    var w = R.writes, done = false, fin = function () { if (!done) { done = true; finish(); } };
    R.fin = fin;
    var r = R.rec;
    if (r && r.state !== "inactive") { try { r.stop(); } catch (e) { w.then(fin); } setTimeout(function () { if (!done) w.then(fin); }, 3000); }
    else w.then(fin);
  }
  function finish() {
    if (!R.on) return;
    var s = R.s; clearInterval(R.tickT); clearTimeout(R.segT);
    try { R.stream.getTracks().forEach(function (t) { t.stop(); }); } catch (e) {}
    try { R.wl && R.wl.release(); } catch (e) {}
    s.t1 = Date.now(); s.dur = Math.round((s.t1 - s.t0) / 1000); s.nseg = R.seg + 1;
    R = { on: false }; black(false);
    if (s.dur < MIN_SEC) { delAllChunks(s.id).then(noop, noop); tx("sesi", "readwrite", function (st) { return st.delete(s.id); }).then(noop, noop); L = L.filter(function (x) { return x.id !== s.id; }); ui(); ctx.toast("Rekaman terlalu singkat, tidak disimpan"); return; }
    s.st = "antre"; putSesi(s).then(function () { ui(); ctx.go("ibadah/" + s.id); proses(s.id); }, function () { ctx.toast("Rekaman belum bisa disimpan"); });
  }
  function tick() {
    if (!R.on) return;
    var e = elapsed(); R.s.dur = Math.round(e);
    var t = fmtDur(e), a = $("ibpT"), b = $("ibbT"), c = $("ibTimer"); if (a) a.textContent = t; if (b && !R.hint) b.textContent = t; if (c) c.textContent = t;
    var pill = $("ibPill"); if (pill) pill.hidden = !(S_visible() === false);
    if (Date.now() - R.saveAt > 20000) { R.saveAt = Date.now(); R.s.t1 = Date.now(); putSesi(R.s).then(noop, noop); }
    if (Date.now() - R.s.t0 > MAX_MS) { ctx.toast("Sesi mencapai 3 jam dan diakhiri"); akhiri(true); }
  }
  function S_visible() { var v = $("vIbadah"); return !!v && !v.hidden; }
  document.addEventListener("visibilitychange", function () {
    if (!R.on) return;
    if (document.visibilityState === "hidden") { R.hiddenAt = Date.now(); return; }
    var g = R.hiddenAt ? Date.now() - R.hiddenAt : 0; R.hiddenAt = 0;
    R.wl = null; lock();
    var rec = R.rec && R.rec.state === "recording";
    revive();
    if (g > 5000 && !rec) ctx.toast("Rekaman sempat berhenti ±" + Math.round(g / 1000) + " detik karena layar terkunci. Jangan kunci layar, cukup hitamkan.");
  });
  window.addEventListener("beforeunload", function (e) { if (R.on) { e.preventDefault(); e.returnValue = ""; } });

  /* ---------- layar hitam ---------- */
  var TAP = { n: 0, t: 0, h: 0 };
  function black(on) {
    var b = $("ibBlack"); if (!b) return;
    if (on && !R.on) return;
    b.hidden = !on; R.black = !!on; TAP.n = 0;
    if (on) { R.hint = true; $("ibbT").textContent = "Ketuk dua kali untuk membuka"; clearTimeout(TAP.h); TAP.h = setTimeout(function () { R.hint = false; tick(); }, 3500); }
  }
  function blackTap() {
    var now = Date.now();
    if (now - TAP.t < 450) { TAP.n = 0; black(false); return; }
    TAP.t = now; R.hint = true; $("ibbT").textContent = "Ketuk dua kali untuk membuka";
    clearTimeout(TAP.h); TAP.h = setTimeout(function () { R.hint = false; tick(); }, 2500);
  }

  /* ---------- catat ayat yang dibuka ---------- */
  function onRef(b, c, v, v2) {
    if (!R.on || R.ending) return;
    var key = b + ":" + c + ":" + (v || 0) + ":" + (v2 || 0); if (key === R.last) return; R.last = key;
    var bk = ctx.BOOKS[b]; if (!bk) return;
    var l = bk.n + " " + c + (v ? ":" + v + (v2 && v2 > v ? "-" + v2 : "") : "");
    if (R.s.ayat.length < 300) R.s.ayat.push({ o: Math.round(elapsed()), l: l });
  }

  /* ---------- salin ke tulisan dan ringkasan ---------- */
  function post(body, ms) {
    var ctl = typeof AbortController === "function" ? new AbortController() : null, tm = ctl ? setTimeout(function () { ctl.abort(); }, ms) : 0;
    return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined })
      .then(function (r) { clearTimeout(tm); return r.json().catch(function () { return { ok: false, sebab: "galat" }; }); },
        function (e) { clearTimeout(tm); var er = new Error("jaringan"); if (e && e.name === "AbortError") er.sebab = "galat"; else er.net = true; throw er; });
  }
  function postRetry(body, ms) {
    var n = 0;
    function go() {
      return post(body, ms).then(function (j) {
        if (j && j.ok) return j;
        var er = new Error(j && j.sebab || "galat"); er.sebab = j && j.sebab || "galat";
        if (er.sebab === "batas" || er.sebab === "format" || er.sebab === "belum_siap") throw er;
        if (++n < 3) return new Promise(function (r) { setTimeout(r, 2500 * n); }).then(go);
        throw er;
      }, function (e) { if (e.net && ++n < 3 && navigator.onLine !== false) return new Promise(function (r) { setTimeout(r, 2500 * n); }).then(go); throw e; });
    }
    return go();
  }
  function setProg(sid, t) { if (t) PR[sid] = t; else delete PR[sid]; ui(true); }
  function langkah(s) {
    var n = s.nseg || 0, p = Promise.resolve(); s.tx = s.tx || {};
    for (var k = 0; k < n; k++) (function (k) {
      p = p.then(function () {
        if (typeof s.tx[k] === "string") return;
        setProg(s.id, "Menyalin suara " + (k + 1) + "/" + n + "…");
        return getChunks(s.id, k).then(function (cs) {
          if (!cs || !cs.length) { s.tx[k] = ""; return putSesi(s); }
          var blob = new Blob(cs.map(function (c) { return c.blob; }), { type: cs[0].mime || s.mime || "audio/mp4" });
          if (blob.size > MAX_BLOB) { var er = new Error("besar"); er.sebab = "besar"; throw er; }
          return b64(blob).then(function (a) { return postRetry({ a: a, m: blob.type || "audio/mp4", d: ctx.devId, lang: s.lang || "id" }, 115000); })
            .then(function (j) { s.tx[k] = String(j.teks || ""); return putSesi(s); })
            .then(function () { return delChunks(s.id, k); });
        });
      });
    })(k);
    return p.then(function () {
      var all = []; for (var k = 0; k < n; k++) if (s.tx[k]) all.push(s.tx[k]);
      s.transkrip = all.join("\n\n").trim();
      if (s.transkrip.length < 20) { s.hasil = { judul: "", tema: "", ringkasan: "Tidak ada ucapan yang terdengar jelas di rekaman ini.", poin: [], ayat: [], penerapan: [] }; s.st = "selesai"; return putSesi(s); }
      return ringkas(s);
    });
  }
  function ringkas(s) {
    setProg(s.id, "Menyusun ringkasan…");
    var ay = [], seen = {}; (s.ayat || []).forEach(function (a) { if (!seen[a.l]) { seen[a.l] = 1; ay.push(a.l); } });
    return postRetry({ k: "ringkas", t: s.transkrip.slice(0, 150000), ay: ay.slice(0, 60), d: ctx.devId, lang: s.lang || "id" }, 100000).then(function (j) {
      s.hasil = j.hasil; s.judul = (j.hasil.judul || "").trim(); s.st = "selesai"; s.err = ""; return putSesi(s);
    });
  }
  function msgErr(e) {
    if (e && e.net) return "Belum ada koneksi internet.";
    var c = e && e.sebab;
    return c === "batas" ? "Batas harian tercapai. Coba lagi besok; rekaman tetap tersimpan di HP." : c === "besar" ? "Potongan rekaman terlalu besar untuk dikirim." : c === "belum_siap" ? "Layanan belum siap. Coba lagi nanti." : "Penyalinan belum berhasil. Rekaman tetap tersimpan di HP.";
  }
  function proses(sid) {
    if (PROC[sid]) return Promise.resolve(); PROC[sid] = true;
    return getSesi(sid).then(function (s) {
      if (!s || s.st === "selesai") return;
      if (navigator.onLine === false) { s.st = "antre"; return putSesi(s); }
      s.st = "proses"; s.err = "";
      return putSesi(s).then(function () { ui(); return langkah(s); }).then(function () {
        setProg(sid, ""); ctx.toast("Catatan ibadah siap"); cloudPush(s);
      }, function (e) {
        setProg(sid, ""); s.st = e && e.net ? "antre" : "gagal"; s.err = msgErr(e); return putSesi(s).then(function () { if (s.st === "gagal") ctx.toast(s.err); });
      });
    }).catch(noop).then(function () { delete PROC[sid]; ui(); });
  }
  function resumeAll() {
    if (navigator.onLine === false) return;
    L.forEach(function (s) { if ((s.st === "antre" || s.st === "proses") && !PROC[s.id]) proses(s.id); });
  }

  /* ---------- impor rekaman (mis. dari Voice Memos) ---------- */
  var EXT = { m4a: "audio/m4a", mp3: "audio/mp3", wav: "audio/wav", aac: "audio/aac", ogg: "audio/ogg", flac: "audio/flac", webm: "audio/webm", opus: "audio/opus", mp4: "audio/m4a" };
  function impor(file) {
    if (!file) return;
    var ext = (file.name.split(".").pop() || "").toLowerCase(), mime = EXT[ext] || (/^audio\//.test(file.type) ? file.type : "");
    if (mime === "audio/mp4" || mime === "audio/x-m4a") mime = "audio/m4a";
    if (!mime) { ctx.toast("Format berkas ini belum didukung. Pakai m4a, mp3, wav, atau aac."); return; }
    if (file.size > MAX_BLOB) { ctx.toast("Berkas terlalu besar (maks ±14 MB, sekitar 30 menit). Pangkas dulu di Voice Memos atau rekam langsung di sini."); return; }
    var s = { id: ctx.uuid(), t0: file.lastModified || Date.now(), t1: 0, dur: 0, st: "antre", nseg: 1, mime: mime, ayat: [], tx: {}, lang: ctx.lang(), imp: true };
    putChunk({ sid: s.id, seg: 0, i: 0, mime: mime, blob: file }).then(function () { return putSesi(s); }).then(function () { ui(); ctx.go("ibadah/" + s.id); proses(s.id); }, function () { ctx.toast("Berkas belum bisa disimpan di HP"); });
  }

  /* ---------- akun (opsional): simpan hasil ke Supabase ---------- */
  function dels() { try { var a = JSON.parse(localStorage.getItem("evo.ibdel") || "[]"); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function setDels(a) { try { localStorage.setItem("evo.ibdel", JSON.stringify(a.slice(-200))); } catch (e) {} }
  function crow(s) {
    return { id: s.id, user_id: ctx.user().id, dibuat: new Date(s.t0).toISOString(), judul: (s.judul || "").slice(0, 200) || null,
      data: { dur: s.dur || 0, hasil: s.hasil || null, ayat: s.ayat || [], catatan: s.catatan || "", lang: s.lang || "id", imp: !!s.imp }, transkrip: (s.transkrip || "").slice(0, 190000) };
  }
  function cloudPush(s) { var sb = ctx.sb(), u = ctx.user(); if (!sb || !u || !s || s.st !== "selesai") return; sb.from("ibadah").upsert([crow(s)], { onConflict: "id" }).then(noop, noop); }
  function cloudDel(id) {
    var sb = ctx.sb(), u = ctx.user();
    var keep = function () { var d = dels(); d.push(id); setDels(d); };
    if (!sb || !u) { if (u === null && sb) return; keep(); return; }
    sb.from("ibadah").delete().eq("id", id).then(function (r) { if (r && r.error) keep(); }, keep);
  }
  function sync() {
    var sb = ctx.sb(), u = ctx.user(); if (!OK || !sb || !u) return Promise.resolve();
    var pending = dels(), skip = {}; pending.forEach(function (i) { skip[i] = 1; });
    var pre = pending.length ? sb.from("ibadah").delete().in("id", pending) : Promise.resolve({});
    return pre.then(function (r) { if (!r || !r.error) setDels([]); return Promise.all([allSesi(), sb.from("ibadah").select("id").order("dibuat", { ascending: false }).limit(300)]); })
      .then(function (res) {
        var rem = res[1]; if (rem.error) throw rem.error;
        var have = {}; (rem.data || []).forEach(function (r) { have[r.id] = 1; });
        var local = {}; L.forEach(function (s) { local[s.id] = 1; });
        L.forEach(function (s) { if (s.st === "selesai" && !have[s.id]) cloudPush(s); });
        var need = (rem.data || []).map(function (r) { return r.id; }).filter(function (i) { return !local[i] && !skip[i]; }).slice(0, 60);
        if (!need.length) return;
        return sb.from("ibadah").select("id,dibuat,judul,data,transkrip").in("id", need).then(function (r) {
          if (r.error) throw r.error;
          return Promise.all((r.data || []).map(function (x) {
            var d = x.data || {};
            return putSesi({ id: x.id, t0: Date.parse(x.dibuat) || Date.now(), t1: 0, dur: d.dur || 0, st: "selesai", nseg: 0, ayat: d.ayat || [], tx: {}, lang: d.lang || "id", imp: !!d.imp, judul: x.judul || "", hasil: d.hasil || null, catatan: d.catatan || "", transkrip: x.transkrip || "" });
          }));
        });
      }).then(function () { ui(true); }, noop);
  }

  /* ---------- tampilan ---------- */
  function statusLine(s) {
    if (PR[s.id]) return PR[s.id];
    if (s.st === "rekam") return "Sedang merekam";
    if (s.st === "antre") return "Menunggu internet untuk disalin";
    if (s.st === "proses") return "Menyalin…";
    if (s.st === "gagal") return s.err || "Belum berhasil";
    return "";
  }
  function title(s) { return s.judul || (s.hasil && s.hasil.judul) || (s.imp ? "Rekaman impor" : "Ibadah " + fmtDate(s.t0)); }
  var MIC_I = '<svg class="ico" viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21M8.5 21h7"/></svg>';
  var MOON_I = '<svg class="ico" viewBox="0 0 24 24"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/></svg>';
  var CHEV = '<svg class="ico chev" viewBox="0 0 24 24"><path d="m9 5 7 7-7 7"/></svg>';
  function cardHtml() {
    if (!OK) return '<div class="ibcard"><p class="ibnote">Perekaman belum didukung di browser ini. Coba buka EvoBible di Safari (iPhone) atau Chrome (Android).</p></div>';
    var h = '<div class="ibcard' + (R.on ? " live" : "") + '">';
    if (R.on) {
      h += '<div class="ibrec"><i class="ibdot"></i><div><b>Sedang merekam</b><small id="ibTimer">' + fmtDur(elapsed()) + '</small></div></div>';
      if (R.dead) h += '<p class="ibwarn">Mikrofon terputus. Ketuk Lanjutkan.</p><button class="btn pri ibbtn" type="button" data-ib="revive">Lanjutkan merekam</button>';
      h += '<div class="ibacts"><button class="btn pri ibbtn" type="button" data-ib="black">' + MOON_I + 'Layar hitam</button><button class="btn sec ibbtn" type="button" data-ib="stop">Akhiri sesi</button></div>';
      if (R.nolock) h += '<p class="ibwarn">HP ini tidak bisa menahan layar tetap menyala. Atur Auto-Lock ke Tidak Pernah selama khotbah, kalau tidak rekaman berhenti saat layar terkunci.</p>';
      else h += '<p class="ibnote">Layar hitam menghemat baterai, tetapi jangan kunci layar dengan tombol samping: rekaman akan berhenti. Ketuk dua kali pada layar hitam untuk membuka.</p>';
    } else {
      h += '<button class="btn pri ibbtn ibstart" type="button" data-ib="start">' + MIC_I + 'Mulai sesi ibadah</button>';
      h += '<label class="btn sec ibbtn ibimp">Impor rekaman<input id="ibFile" type="file" accept="audio/*,.m4a,.mp3,.wav,.aac,.ogg,.flac,.opus,.webm" hidden></label>';
      h += '<p class="ibnote">Mulai saat khotbah dimulai, akhiri saat selesai. Setelah itu rekaman disalin ke tulisan dan diringkas, lalu audionya dihapus. Ayat yang kamu buka selama sesi ikut dicatat.</p>';
      if (IOS && !standalone()) h += '<p class="ibwarn">Di iPhone, pasang EvoBible ke Layar Utama (Bagikan › Tambah ke Layar Utama) supaya layar bisa tetap menyala saat merekam.</p>';
      h += '<p class="ibnote small">Rekaman dikirim ke server dan layanan Google Gemini untuk disalin, lalu tidak disimpan. Mintalah izin gereja sebelum merekam khotbah.</p>';
    }
    return h + "</div>";
  }
  function listHtml() {
    var h = cardHtml();
    var rows = L.filter(function (s) { return !(R.on && R.s && s.id === R.s.id); });
    if (!rows.length) return h + '<p class="ibempty">Belum ada catatan ibadah.</p>';
    h += '<div class="sec"><h2>Catatan</h2></div><div class="morelist">';
    rows.forEach(function (s) {
      var st = statusLine(s), sub = fmtDate(s.t0) + (s.dur ? " · " + fmtMin(s.dur) : "");
      var one = s.st === "selesai" && s.hasil ? (s.hasil.tema || s.hasil.ringkasan || "") : "";
      h += '<button class="morerow ibrow" type="button" data-ib="open" data-id="' + esc(s.id) + '"><span class="mi">' + MIC_I + '</span><span class="mt"><b>' + esc(title(s)) + '</b><small>' + esc(sub) + "</small>" + (st ? '<small class="ibst ' + esc(s.st) + '">' + esc(st) + "</small>" : one ? '<small class="ibone">' + esc(one.slice(0, 110)) + "</small>" : "") + "</span>" + CHEV + "</button>";
    });
    return h + "</div>";
  }
  function refChip(t) { return '<button class="ibchip" type="button" data-ib="ref" data-ref="' + esc(t) + '">' + esc(t) + "</button>"; }
  function detailHtml(s) {
    var h = hasilHtml(s), st = statusLine(s);
    var out = '<h2 class="ibh">' + esc(title(s)) + "</h2><p class=\"ibmeta\">" + esc(fmtDate(s.t0)) + (s.imp ? "" : " · " + fmtClock(s.t0)) + (s.dur ? " · " + fmtMin(s.dur) : "") + "</p>";
    if (st && s.st !== "selesai") {
      out += '<div class="ibcard"><p class="ibst ' + esc(s.st) + '">' + esc(st) + "</p>";
      if (s.st === "gagal" || s.st === "antre") out += '<button class="btn pri ibbtn" type="button" data-ib="retry" data-id="' + esc(s.id) + '">Coba lagi</button>';
      if (s.st === "proses" || PR[s.id]) out += '<p class="ibnote">Biarkan aplikasi tetap terbuka sampai selesai. Audio dihapus setelah berhasil disalin.</p>';
      out += "</div>";
    }
    out += h;
    out += '<div class="ibacts wrap"><button class="btn sec ibbtn" type="button" data-ib="rename" data-id="' + esc(s.id) + '">Ubah judul</button>';
    if (s.st === "selesai") out += '<button class="btn sec ibbtn" type="button" data-ib="copy" data-id="' + esc(s.id) + '">Salin catatan</button>' + (navigator.share ? '<button class="btn sec ibbtn" type="button" data-ib="share" data-id="' + esc(s.id) + '">Bagikan</button>' : "");
    if (s.st === "selesai" && s.transkrip) out += '<button class="btn sec ibbtn" type="button" data-ib="again" data-id="' + esc(s.id) + '">Ulangi ringkasan</button>';
    out += '<button class="btn sec ibbtn ibdel" type="button" data-ib="del" data-id="' + esc(s.id) + '">Hapus</button></div>';
    return out;
  }
  function hasilHtml(s) {
    var r = s.hasil, h = "";
    if (r) {
      if (r.tema) h += '<p class="ibtema">' + esc(r.tema) + "</p>";
      if (r.ringkasan) h += '<h3>Ringkasan</h3><p class="ibp">' + esc(r.ringkasan) + "</p>";
      if (r.poin && r.poin.length) h += "<h3>Poin utama</h3><ol class=\"iblist\">" + r.poin.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ol>";
      if (r.ayat && r.ayat.length) h += '<h3>Ayat yang disebut</h3><div class="ibchips">' + r.ayat.map(refChip).join("") + "</div>";
      if (r.penerapan && r.penerapan.length) h += "<h3>Untuk direnungkan</h3><ul class=\"iblist\">" + r.penerapan.map(function (p) { return "<li>" + esc(p) + "</li>"; }).join("") + "</ul>";
    }
    if (s.ayat && s.ayat.length) {
      h += '<h3>Ayat yang kamu buka</h3><div class="ibchips">' + s.ayat.map(function (a) { return '<button class="ibchip" type="button" data-ib="ref" data-ref="' + esc(a.l) + '">' + esc(a.l) + "<small>menit " + Math.floor(a.o / 60) + "</small></button>"; }).join("") + "</div>";
    }
    if (s.st === "selesai") h += '<h3>Catatan pribadi</h3><textarea class="ibnotes" id="ibNotes" data-id="' + esc(s.id) + '" rows="4" maxlength="3000" placeholder="Tulis yang ingin kamu ingat…">' + esc(s.catatan || "") + "</textarea>";
    if (s.transkrip) h += '<details class="ibtr"><summary>Transkrip lengkap</summary><div class="ibtrt">' + esc(s.transkrip).replace(/\n\n/g, "</p><p>").replace(/^/, "<p>").replace(/$/, "</p>") + '</div><button class="txtbtn" type="button" data-ib="copytr" data-id="' + esc(s.id) + '">Salin transkrip</button></details>';
    return h;
  }
  function textOf(s) {
    var r = s.hasil || {}, o = [title(s), fmtDate(s.t0)];
    if (r.tema) o.push("", r.tema);
    if (r.ringkasan) o.push("", "Ringkasan", r.ringkasan);
    if (r.poin && r.poin.length) { o.push("", "Poin utama"); r.poin.forEach(function (p, i) { o.push((i + 1) + ". " + p); }); }
    if (r.ayat && r.ayat.length) o.push("", "Ayat: " + r.ayat.join("; "));
    if (r.penerapan && r.penerapan.length) { o.push("", "Untuk direnungkan"); r.penerapan.forEach(function (p) { o.push("- " + p); }); }
    if (s.catatan) o.push("", "Catatan pribadi", s.catatan);
    return o.join("\n");
  }
  function ui(soft) {
    var pill = $("ibPill"); if (pill) pill.hidden = !R.on || S_visible();
    var m = $("ibpT"); if (m && R.on) m.textContent = fmtDur(elapsed());
    if (!S_visible()) return;
    var body = $("ibBody"); if (!body) return;
    var ae = document.activeElement;
    if (soft && ae && ae.id === "ibNotes") return;   // jangan ganggu saat mengetik catatan
    var h;
    if (V.id) { var s = find(V.id); h = s ? detailHtml(s) : '<p class="ibempty">Catatan tidak ditemukan.</p>'; $("ibTitle").textContent = "Catatan Ibadah"; }
    else { h = listHtml(); $("ibTitle").textContent = "Catatan Ibadah"; }
    body.innerHTML = h;
  }
  function render(id) {
    V.id = id || "";
    var body = $("ibBody"); if (!body) return;
    allSesi().then(function () { if (R.on && R.s && !find(R.s.id)) L.unshift(R.s); ui(); }, function () { ui(); });
  }

  /* ---------- aksi ---------- */
  function onClick(e) {
    var f = e.target.closest && e.target.closest("[data-ib]"); if (!f) return;
    var a = f.dataset.ib, id = f.dataset.id, s = id ? find(id) : null;
    if (a === "start") mulai();
    else if (a === "stop") akhiri(false);
    else if (a === "black") black(true);
    else if (a === "revive") revive();
    else if (a === "open") ctx.go("ibadah/" + id);
    else if (a === "retry" && s) { s.st = "antre"; s.err = ""; putSesi(s).then(function () { proses(s.id); ui(); }); }
    else if (a === "ref") { var p = parseRef(f.dataset.ref); if (p) ctx.openRef(p.b, p.c, p.v, p.v2); else ctx.toast("Ayat tidak ditemukan"); }
    else if (a === "copy" && s) copyText(textOf(s)).then(function () { ctx.toast("Catatan disalin"); }, function () { ctx.toast("Belum bisa menyalin"); });
    else if (a === "copytr" && s) copyText(s.transkrip || "").then(function () { ctx.toast("Transkrip disalin"); }, function () { ctx.toast("Belum bisa menyalin"); });
    else if (a === "share" && s) { try { navigator.share({ title: title(s), text: textOf(s) }).catch(noop); } catch (x) {} }
    else if (a === "rename" && s) { var t = prompt("Judul catatan", title(s)); if (t !== null) { s.judul = t.trim().slice(0, 100); putSesi(s).then(function () { cloudPush(s); ui(); }); } }
    else if (a === "again" && s) { s.st = "proses"; putSesi(s).then(function () { PROC[s.id] = true; ui(); return ringkas(s); }).then(function () { setProg(s.id, ""); cloudPush(s); }, function (er) { setProg(s.id, ""); s.st = "selesai"; putSesi(s); ctx.toast(msgErr(er)); }).then(function () { delete PROC[s.id]; ui(); }); }
    else if (a === "del" && s) {
      if (!confirm("Hapus catatan ini? Transkrip dan ringkasannya ikut terhapus.")) return;
      L = L.filter(function (x) { return x.id !== s.id; });
      tx("sesi", "readwrite", function (st) { return st.delete(s.id); }).then(noop, noop); delAllChunks(s.id).then(noop, noop); cloudDel(s.id);
      ctx.go("ibadah"); ctx.toast("Catatan dihapus");
    }
  }
  function init(c) {
    ctx = c; $ = c.$; esc = c.esc;
    var v = $("vIbadah"); if (!v) return;
    v.addEventListener("click", onClick);
    v.addEventListener("change", function (e) { if (e.target && e.target.id === "ibFile") { var f = e.target.files && e.target.files[0]; e.target.value = ""; impor(f); } });
    v.addEventListener("input", function (e) {
      if (!e.target || e.target.id !== "ibNotes") return;
      var s = find(e.target.dataset.id); if (!s) return; s.catatan = e.target.value.slice(0, 3000);
      clearTimeout(init.nt); init.nt = setTimeout(function () { putSesi(s).then(function () { cloudPush(s); }, noop); }, 700);
    });
    $("ibBack").onclick = function () { if (V.id) ctx.go("ibadah"); else ctx.go("lainnya"); };
    var pill = $("ibPill");
    if (pill) pill.addEventListener("click", function (e) { if (e.target.closest("[data-ibp='black']")) black(true); else ctx.go("ibadah"); });
    var b = $("ibBlack"); if (b) b.addEventListener("pointerup", blackTap);
    if (!OK) return;
    allSesi().then(function () {
      // sesi yang terputus saat merekam (aplikasi tertutup): pulihkan dan salin
      return Promise.all(L.filter(function (s) { return s.st === "rekam"; }).map(function (s) {
        return maxSeg(s.id).then(function (n) {
          if (!n) { return tx("sesi", "readwrite", function (st) { return st.delete(s.id); }).then(function () { L = L.filter(function (x) { return x.id !== s.id; }); }); }
          s.nseg = n; s.t1 = s.t1 || Date.now(); s.dur = s.dur || Math.round((s.t1 - s.t0) / 1000); s.st = "antre"; s.rec = 1; return putSesi(s);
        });
      }));
    }).then(function () { if (L.some(function (s) { return s.rec; })) ctx.toast("Rekaman yang terputus dipulihkan dan disalin"); resumeAll(); }, noop);
    window.addEventListener("online", function () { resumeAll(); });
  }
  window.EvoIbadah = { init: init, render: render, onRef: onRef, sync: sync, active: function () { return !!R.on; } };
})();
