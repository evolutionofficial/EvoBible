#!/usr/bin/env python3
"""Bangun cerita/pl.json dan cerita/pb.json dari tools/cerita-src/*.txt dan periksa semua rujukan ayat terhadap teks AYT di data.js.
Format baris: Judul | Rujukan | Tokoh (pisah koma) | Kata kunci | Ringkasan [| T]
  - Rujukan: "Kej 6:9-9:17", "Kej 6:9-22", "Kej 6-9" (pasal utuh), beberapa dipisah ";"  (T = tafsiran, bukan pernyataan teks)
Pakai: python3 tools/cerita-build.py"""
import json, re, subprocess, sys, glob, os
os.chdir(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
dump = subprocess.run(["node", "-e", "global.window={};require('./data.js');const B=window.__BIBLE;console.log(JSON.stringify(B.map(b=>({a:b.a,n:b.n,v:b.ch.map(c=>c.v.length)}))))"], capture_output=True, text=True, check=True).stdout
BK = json.loads(dump); AB = {b["a"]: i for i, b in enumerate(BK)}
err = []
def pos(tok, ctx):
    m = re.fullmatch(r"(\d+)(?::(\d+))?", tok.strip())
    if not m: raise ValueError("bentuk " + tok)
    return int(m.group(1)), int(m.group(2)) if m.group(2) else 0
def check_part(part, ln):
    m = re.fullmatch(r"([1-3]?[A-Za-z]+)\s+(.+)", part.strip())
    if not m or m.group(1) not in AB: err.append(f"{ln}: kitab? {part}"); return None
    b = AB[m.group(1)]; body = m.group(2); ch = BK[b]["v"]
    a, _, z = body.partition("-")
    try: c1, v1 = pos(a, ln); c2, v2 = pos(z, ln) if z else (None, None)
    except Exception as e: err.append(f"{ln}: {e} {part}"); return None
    if ":" not in a:   # pasal utuh
        if c2 is None: c2 = c1
        if not (1 <= c1 <= len(ch) and c1 <= c2 <= len(ch)): err.append(f"{ln}: pasal di luar {part}"); return None
        return b, c1, 1
    if not (1 <= c1 <= len(ch)) or not (1 <= v1 <= ch[c1 - 1]): err.append(f"{ln}: ayat awal tidak ada {part} (maks {ch[c1-1] if 1<=c1<=len(ch) else '?'})"); return None
    if z:
        if ":" in z:   # lintas pasal
            if not (c1 <= c2 <= len(ch)) or not (1 <= v2 <= ch[c2 - 1]): err.append(f"{ln}: ayat akhir tidak ada {part}"); return None
        else:
            if v1 > c2 or c2 > ch[c1 - 1]: err.append(f"{ln}: rentang ayat salah {part} (maks {ch[c1-1]})"); return None
    return b, c1, v1
out = {"pl": [], "pb": []}; seen = {}
for f in sorted(glob.glob("tools/cerita-src/*.txt")):
    for n, line in enumerate(open(f, encoding="utf-8"), 1):
        line = line.strip()
        if not line or line.startswith("#"): continue
        p = [x.strip() for x in line.split("|")]
        ln = f"{os.path.basename(f)}:{n}"
        if len(p) < 5: err.append(f"{ln}: kolom kurang ({len(p)}) {line[:50]}"); continue
        j, r, t, k, s = p[:5]; x = 1 if len(p) > 5 and p[5].upper() == "T" else 0
        if len(s) < 20: err.append(f"{ln}: ringkasan terlalu pendek"); continue
        first = None
        for part in r.split(";"):
            pp = check_part(part, ln)
            if pp and first is None: first = pp
        if not first: continue
        b, c, v = first
        base = re.sub(r"[^a-z0-9]+", "-", j.lower()).strip("-")[:40]; seen[base] = seen.get(base, 0) + 1
        e = {"i": base + ("" if seen[base] == 1 else "-" + str(seen[base])), "j": j, "r": r, "t": [x.strip() for x in t.split(",") if x.strip()], "k": k, "s": s, "o": b * 1000000 + c * 1000 + v}
        if x: e["x"] = 1
        out["pb" if b >= 39 else "pl"].append(e)
for key in out: out[key].sort(key=lambda e: e["o"])
for key, arr in out.items():
    if arr:
        json.dump(arr, open(f"cerita/{key}.json", "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
        print(key, len(arr), "kisah", os.path.getsize(f"cerita/{key}.json") // 1024, "KB")
if err:
    print("\n".join(err)); print(len(err), "KESALAHAN"); sys.exit(1)
