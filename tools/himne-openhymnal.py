# Membuat kidung/pd.json dari Open Hymnal Project (domain publik).
# Pakai: git clone --depth 1 https://github.com/mzealey/openhymnal.git oh && python3 tools/himne-openhymnal.py
# Hanya memuat lagu berlabel "public domain" yang penulis/penerjemahnya wafat sebelum 1956 (UU Hak Cipta: 70 tahun).
import re, glob, json, os, sys
FILES = sorted(glob.glob('oh/Complete/**/*.abc', recursive=True)) + sorted(glob.glob('oh/Choir/**/*.abc', recursive=True))
def years(s): return [int(b) for a,b in re.findall(r'\((\d{3,4})?\s*[-–]\s*(\d{4})\)', s or '')]
def syl_tokens(line):
    line = re.sub(r'^\s*\d+\.\s*~?', '', line.strip())          # nomor bait
    line = line.replace('\\-', '\u2011').replace('~', ' ')
    toks = []
    for t in line.split():
        if t in ('*', '_', '|') or re.fullmatch(r'\d+\.', t): continue
        t = t.replace('_', '').replace('|', '')
        if not t: continue
        parts = t.split('-')
        for i, p in enumerate(parts):
            if p == '' and i == len(parts) - 1: continue
            toks.append([p, i < len(parts) - 1])   # [suku kata, bersambung ke berikutnya]
    return toks
def join(toks):
    out = ''
    for i,(p,cont) in enumerate(toks):
        out += p
        if not cont: out += ' '
    return re.sub(r'\s+', ' ', out.replace('\u2011', '-')).strip()
def meter_lines(toks, meter):
    """bagi suku kata menjadi baris menurut pola metrum (mis. 8 6 8 6), bila jumlahnya pas"""
    total = len(toks)
    if not meter or not sum(meter): return None
    rep = total / sum(meter)
    if abs(rep - round(rep)) > 1e-9 or round(rep) < 1: return None
    pat = meter * int(round(rep)); lines = []; i = 0
    for n in pat:
        seg = toks[i:i+n]; i += n
        if seg and seg[-1][1]: return None       # baris tidak boleh berhenti di tengah kata
        lines.append(join(seg))
    return lines
EXCL = set("I God Lord Jesus Christ Spirit Holy Father Son King Thee Thou Thy Thine He His Him Heaven Savior Saviour Israel Zion Lamb Word Ghost Trinity Redeemer Shepherd Master Prince Love Grace Name Church Cross Easter Bethlehem David Mary Jerusalem Calvary Galilee Jordan Canaan Gilead Satan Thomas Peter Paul Abraham Moses".split())
def punct_lines(text):
    words = text.split(); lines = []; cur = []
    for w in words:
        if cur:
            L = len(' '.join(cur)); prev = cur[-1]; core = w.strip('‘’“”"\'(')
            brk = (L >= 16 and re.search(r'[,;:.!?]$', prev)) or (L >= 16 and core[:1].isupper() and core not in EXCL and not re.search(r"^(O|Oh)$", prev)) or L >= 52
            if brk: lines.append(' '.join(cur)); cur = []
        cur.append(w)
    if cur: lines.append(' '.join(cur))
    return lines
def parse(fn):
    s = open(fn, encoding='utf-8', errors='replace').read()
    title = (re.search(r'^T:\s*(.+)$', s, re.M) or [None, ''])[1].strip()
    if not title: return None
    au = (re.search(r'^%OHAUTHOR\s+(.*)$', s, re.M) or [None, ''])[1].strip()
    tr = (re.search(r'^%OHTRANSLATOR\s+(.*)$', s, re.M) or [None, ''])[1].strip()
    cl = re.findall(r'^C:\s*(.+)$', s, re.M)
    if not any('public domain' in c.lower() for c in cl): return ('skip', title, 'bukan domain publik')
    if any('rights reserved' in c.lower() for c in cl): return ('skip', title, 'hak dilindungi')
    deaths = years(au) + (years(tr) if tr and tr.lower() != 'none' else [])
    words = next((c for c in cl if c.lower().startswith('words')), '')
    if deaths and max(deaths) > 1955: return ('skip', title, 'penulis wafat %d' % max(deaths))
    if not deaths:
        ys = [int(y) for y in re.findall(r'\b(1[5-9]\d\d)\b', words)]
        if not ys or max(ys) > 1925: return ('skip', title, 'tahun tidak pasti')
    meter = [int(x) for x in re.findall(r'\d+', (re.search(r'^%OHMETRICAL\s+(.*)$', s, re.M) or [None, ''])[1])]
    # kelompok baris musik: ambil suara pertama yang punya w:
    lines = s.split('\n'); groups = []; cur = None; voice = None; first_voice = None
    for ln in lines:
        m = re.match(r'^\[V:\s*([^\]\s]+)\]', ln)
        if m: voice = m.group(1); cur = None
        if ln.startswith('w:'):
            if first_voice is None: first_voice = voice
            if voice != first_voice: continue
            if cur is None: cur = []; groups.append(cur)
            cur.append(ln[2:])
        elif not ln.startswith('%') and ln.strip() and not ln.startswith('w:') and not m: cur = cur if cur is not None and ln.startswith('w') else cur
    nmax = max((len(g) for g in groups), default=0)
    verses = [[] for _ in range(nmax)]; reff = []; order = []
    for g in groups:
        if len(g) == 1 and nmax > 1: reff += syl_tokens(g[0])
        else:
            for k in range(nmax):
                if k < len(g): verses[k] += syl_tokens(g[k])
    blocks = []
    for k, toks in enumerate(verses):
        if not toks: continue
        L = meter_lines(toks, meter) or punct_lines(join(toks))
        blocks.append({"k": str(k + 1), "l": L})
        if k == 0 and reff: blocks.append({"k": "Reff", "l": punct_lines(join(reff))})
    # bait tambahan W:
    W = re.findall(r'^W:\s?(.*)$', s, re.M); cur = []; nxt = len(verses) + 1
    for w in W + ['']:
        if w.strip() == '':
            if cur:
                cur[0] = re.sub(r'^\s*\d+(\(alt\))?[.,]\s*', '', cur[0]); blocks.append({"k": str(nxt), "l": [x.strip() for x in cur]}); nxt += 1; cur = []
        else:
            t = re.sub(r'^W:\s*', '', w).replace('\\- ', '-').replace('\\-', '-')
            if re.match(r'^\s*\d+\.', t) and cur:
                cur[0] = re.sub(r'^\s*\d+(\(alt\))?[.,]\s*', '', cur[0]); blocks.append({"k": str(nxt), "l": [x.strip() for x in cur]}); nxt += 1; cur = []
            cur.append(t)
    if not blocks: return ('skip', title, 'tanpa lirik')
    who = re.sub(r'\s*\(.*?\)', '', au).strip()
    if tr and tr.lower() != 'none': who += ' · terj. ' + re.sub(r'\s*\(.*?\)', '', tr).strip()
    name = lambda x: ' '.join(reversed([p.strip() for p in x.split(',', 1)])) if ',' in x else x
    cred = name(re.sub(r'\s*\(.*?\)', '', au).split(';')[0].strip()) if au else ''
    if tr and tr.lower() != 'none': cred += (', terj. ' if cred else 'terj. ') + name(re.sub(r'\s*\(.*?\)', '', tr).split(';')[0].strip())
    return {"j": title, "p": cred, "b": blocks, "src": os.path.relpath(fn, 'oh')}
songs = {}; skips = []
for f in FILES:
    r = parse(f)
    if r is None: continue
    if isinstance(r, tuple): skips.append(r[1:]); continue
    key = re.sub(r'[^a-z]', '', r['j'].lower())
    if key in songs: continue
    songs[key] = r
lst = sorted(songs.values(), key=lambda x: re.sub(r'^(the|a|an|o)\s+', '', x['j'].lower()))
for i, x in enumerate(lst, 1):
    x['n'] = str(i)
    for bl in x['b']:
        if bl['l']: bl['l'][0] = re.sub(r'^\s*\d+(\(alt\))?[.,]\s*', '', bl['l'][0])
json.dump({"lagu": [{k: x[k] for k in ('n','j','p','b')} for x in lst]}, open('kidung/pd.json','w'), ensure_ascii=False, separators=(',',':'))
print('lagu:', len(lst), '| dilewati:', len(skips))
from collections import Counter; print(Counter(r for _, r in skips).most_common(8))
