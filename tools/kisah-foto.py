#!/usr/bin/env python3
"""Proses foto kisah: python3 tools/kisah-foto.py <folder-gambar> [id ...]
Nama file = id kisah (mis. nuh.jpg). Pinggiran putih dipotong, lalu dibuat
kisah/img/<id>.webp (960x640) dan kisah/img/<id>-k.webp (200x200), dan kisah/gambar.json diperbarui."""
import os, sys, json
from PIL import Image, ImageStat
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DST = os.path.join(ROOT, "kisah", "img"); os.makedirs(DST, exist_ok=True)
def trim(im):
    """Buang pinggiran putih dan sisa kolase: garis putih (talang) di 30% tepi beserta semua yang di luarnya."""
    g = im.convert("L"); w, h = g.size; px = g.load()
    def row(y): return sum(px[x, y] for x in range(0, w, 4)) / len(range(0, w, 4))
    def col(x): return sum(px[x, y] for y in range(0, h, 4)) / len(range(0, h, 4))
    T = 232
    t = 0
    for y in range(0, int(h * .3)):
        if row(y) > T: t = y + 1
    b = h
    for y in range(h - 1, int(h * .7), -1):
        if row(y) > T: b = y
    l = 0
    for x in range(0, int(w * .3)):
        if col(x) > T: l = x + 1
    r = w
    for x in range(w - 1, int(w * .7), -1):
        if col(x) > T: r = x
    pad = 2
    l, t = (l + pad if l else 0), (t + pad if t else 0); r, b = (r - pad if r < w else w), (b - pad if b < h else h)
    return im.crop((l, t, r, b)), (l, t, w - r, h - b)
def cover(im, tw, th, fy=0.5):
    w, h = im.size; s = max(tw / w, th / h); im = im.resize((round(w * s), round(h * s)), Image.LANCZOS)
    x = (im.width - tw) // 2; y = int((im.height - th) * fy); return im.crop((x, y, x + tw, y + th))
def main():
    src = sys.argv[1]; only = set(sys.argv[2:])
    man = os.path.join(ROOT, "kisah", "gambar.json"); have = set(json.load(open(man))) if os.path.exists(man) else set()
    for f in sorted(os.listdir(src)):
        k, ext = os.path.splitext(f)
        if ext.lower() not in (".jpg", ".jpeg", ".png", ".webp") or (only and k not in only): continue
        im, cut = trim(Image.open(os.path.join(src, f)).convert("RGB"))
        cover(im, 960, 640).save(os.path.join(DST, k + ".webp"), "WEBP", quality=74, method=6)
        cover(im, 200, 200, 0.3).save(os.path.join(DST, k + "-k.webp"), "WEBP", quality=72, method=6)
        have.add(k); print(k, "potong", cut if any(cut) else "-")
    json.dump(sorted(have), open(man, "w"))
    print(len(have), "kisah bergambar")
if __name__ == "__main__": main()
