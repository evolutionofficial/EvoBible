/* EvoBible tema-engine: offline, tanpa model eksternal.
   createEngine(data, texts) -> { search(q), clusterList }
   data  = engine.json (vocab, idf, w2i, nb, clusters)
   texts = array teks ayat (urutan global b,c,v) */
function createEngine(data, texts, bookOf) {
  var W2I = data.w2i, IDF = data.idf, VOC = data.vocab, NB = data.nb, CL = data.clusters;
  var TOK = /[a-zà-ÿ]+/g;
  var QSTOP = {};
  ("yang dan di ke dari ini itu dengan untuk pada adalah akan juga atau tetapi tapi karena sebab supaya agar oleh sudah telah dalam tidak bukan ada saya aku engkau kamu kami kita mereka dia ia nya lah kah pun saja hanya lagi sebagai seperti maka lalu jika bila sehingga hingga sampai antara bagi kepada terhadap atas bawah semua setiap suatu dapat bisa harus mau sedang masih belum pernah sekarang bahwa yaitu namun serta pula lain ku mu " +
   "merasa rasa perasaan bagaimana kenapa mengapa apa siapa kapan dimana mana ayat tentang cara ingin minta tolong carikan cari bisakah gimana banget sangat sekali sih dong deh nih kok kalau kalo biar agar lagi terus selalu jadi udah gak nggak enggak tak").split(" ").forEach(function (w) { QSTOP[w] = 1; });

  /* ---- stem kueri: kamus dulu, lalu pelucutan imbuhan ringan ---- */
  var SUF = ["lah", "kah", "pun", "nya", "ku", "mu"], SUF2 = ["kan", "an", "i"];
  var PRE = ["memper", "diper", "meng", "meny", "mem", "men", "me", "peng", "peny", "pem", "pen", "pe", "ber", "ter", "di", "ke", "se", "per"];
  function stemIdx(w) {
    if (W2I[w] !== undefined) return W2I[w];
    var forms = [w], i, j, f;
    SUF.forEach(function (s) { if (w.length - s.length >= 3 && w.slice(-s.length) === s) forms.push(w.slice(0, -s.length)); });
    var f2 = forms.slice();
    forms.forEach(function (x) { SUF2.forEach(function (s) { if (x.length - s.length >= 3 && x.slice(-s.length) === s) f2.push(x.slice(0, -s.length)); }); });
    for (i = 0; i < f2.length; i++) {
      f = f2[i]; if (W2I[f] !== undefined) return W2I[f];
      for (j = 0; j < PRE.length; j++) {
        var p = PRE[j];
        if (f.indexOf(p) === 0 && f.length - p.length >= 3) {
          var r = f.slice(p.length), cands = [r, "k" + r, "t" + r, "p" + r, "s" + r];
          for (var k = 0; k < cands.length; k++) if (W2I[cands[k]] !== undefined) return W2I[cands[k]];
        }
      }
    }
    return -1;
  }

  /* ---- bobot pemicu per kluster ---- */
  var CW = CL.map(function (c) {
    var m = {};
    Object.keys(c.t).forEach(function (w) {
      var wt = c.t[w]; if (!(m[w] >= wt)) m[w] = wt;
      var si = W2I[w]; if (si !== undefined) { var k = "#" + si; if (!(m[k] >= wt)) m[k] = wt; }
    });
    return m;
  });

  /* ---- indeks terbalik (dibangun sekali, malas) ---- */
  var inv = null, dl = null, avg = 0;
  /* implementasi postings sederhana yang benar: pasangan [id, tf] */
  function buildSafe() {
    if (inv) return;
    inv = {}; dl = new Uint16Array(texts.length); var tot = 0;
    for (var i = 0; i < texts.length; i++) {
      var ws = texts[i].toLowerCase().match(TOK) || [], tf = {}, n = 0;
      for (var j = 0; j < ws.length; j++) { var s = W2I[ws[j]]; if (s === undefined) continue; n++; tf[s] = (tf[s] || 0) + 1; }
      for (var key in tf) { (inv[key] || (inv[key] = [])).push(i, tf[key]); }
      dl[i] = n; tot += n;
    }
    avg = tot / texts.length;
  }

  function parseQuery(q) {
    var raw = (q.toLowerCase().match(TOK) || []).filter(function (w) { return !QSTOP[w] && w.length > 1; });
    var seenW = {}, info = [];
    raw.forEach(function (w) { if (seenW[w]) return; seenW[w] = 1; info.push({ w: w, s: stemIdx(w) }); });
    return info;
  }

  function search(q, opts) {
    opts = opts || {};
    var limit = opts.limit || 12;
    var qi = parseQuery(q);
    if (!qi.length) return { clusters: [], results: [], terms: [] };
    var nq = qi.length;

    /* 1. skor kluster */
    var qset = {}; qi.forEach(function (t) { qset[t.w] = 1; });
    var cs = CL.map(function (c, ci) {
      var sc = 0, hit = 0;
      if (c.req && !c.req.some(function (r) { return qset[r]; })) return { ci: ci, sc: 0, hit: 0 };
      qi.forEach(function (t) {
        var a = CW[ci][t.w] || 0, b = t.s >= 0 ? (CW[ci]["#" + t.s] || 0) : 0, m = Math.max(a, b);
        if (m) { sc += m; hit++; }
      });
      return { ci: ci, sc: sc, hit: hit };
    }).filter(function (x) { return x.sc > 0; }).sort(function (a, b) { return b.sc - a.sc; });
    var best = cs.length ? cs[0].sc : 0, sel = [];
    for (var i = 0; i < cs.length && sel.length < 3; i++) {
      if (cs[i].sc >= best * 0.4 && cs[i].sc >= 1.2) sel.push(cs[i]);
    }

    /* 2. BM25 dengan perluasan tetangga */
    buildSafe();
    var qw = {};
    qi.forEach(function (t) {
      if (t.s < 0) return;
      var w = 1; if (!(qw[t.s] >= w)) qw[t.s] = w;
      (NB[t.s] || []).slice(0, 4).forEach(function (n) { var x = 0.3 * n[1]; if (!(qw[n[0]] >= x)) qw[n[0]] = x; });
    });
    var lex = {}, k1 = 1.2, b = 0.6, maxLex = 0;
    Object.keys(qw).forEach(function (s) {
      var p = inv[s]; if (!p) return;
      var idf = Math.log(1 + (texts.length - p.length / 2 + 0.5) / (p.length / 2 + 0.5));
      if (p.length / 2 > 4000) idf *= 0.3;
      for (var i = 0; i < p.length; i += 2) {
        var id = p[i], tf = p[i + 1], v = qw[s] * idf * (tf * (k1 + 1)) / (tf + k1 * (1 - b + b * dl[id] / avg));
        lex[id] = (lex[id] || 0) + v;
      }
    });
    Object.keys(lex).forEach(function (id) {
      var L = dl[id]; if (L < 5) lex[id] *= 0.6; if (L > 50) lex[id] *= 0.85;
      if (lex[id] > maxLex) maxLex = lex[id];
    });

    /* 3. gabung */
    var score = {}, why = {};
    sel.forEach(function (x, rank) {
      var c = CL[x.ci], wc = Math.pow(x.sc / best, 1.5);
      c.a.forEach(function (id, r) { var v = wc * (1 - 0.02 * r); if (v > (score[id] || 0)) { score[id] = v; why[id] = { k: c.k, n: c.n, a: 1 }; } });
      c.x.forEach(function (id, r) { var v = wc * (0.5 - 0.004 * r); if (v > (score[id] || 0)) { score[id] = v; why[id] = { k: c.k, n: c.n, a: 0 }; } });
    });
    var lexW = sel.length ? 0.4 : 1.4;
    if (maxLex) Object.keys(lex).forEach(function (id) {
      var v = lexW * lex[id] / maxLex; id = +id;
      score[id] = (score[id] || 0) + v;
    });
    var ids = Object.keys(score).map(Number).sort(function (a, b) { return score[b] - score[a]; });

    /* 4. keberagaman: maksimum 3 ayat per kitab pada daftar teratas, hindari ayat bertetangga yang sama */
    var results = [], perBook = {}, used = {};
    for (var r = 0; r < ids.length && results.length < limit; r++) {
      var id = ids[r], bk = bookOf[id];
      if ((perBook[bk] || 0) >= 3) continue;
      if (used[id - 1] || used[id + 1]) continue;
      perBook[bk] = (perBook[bk] || 0) + 1; used[id] = 1;
      results.push({ id: id, score: score[id], why: why[id] || null });
    }
    return { sel: sel.map(function (x) { return { k: CL[x.ci].k, n: CL[x.ci].n, i: CL[x.ci].i, sc: x.sc }; }), results: results, terms: qi.map(function (t) { return t.w; }) };
  }
  return { search: search, clusters: CL, parse: parseQuery, stemIdx: stemIdx };
}
if (typeof module !== "undefined") module.exports = createEngine;
