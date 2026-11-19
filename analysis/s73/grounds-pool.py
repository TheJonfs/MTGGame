# -*- coding: utf-8 -*-
"""S73a Part 4: the High Ground rows pooled over seeds 91 and 173 (paired, per match), read by the strict bar.
A "no<ground>" row is a removal: the ground's worth is the gain with the sign turned.  python3 analysis/s73/grounds-pool.py"""
import json, glob, math, os
A = 'analysis/s73/audit/'
def load(prefix, me):
    ms = {}
    fs = sorted(glob.glob(prefix + '_[0-9].json')); assert len(fs) == 5, prefix
    for f in fs:
        for g in json.load(open(f))['results']:
            if g.get('match') is not None: ms.setdefault((g['a'], g['b'], g['match']), []).append(g)
    out = {}
    for (a, b, m), gs in ms.items():
        side = 'a' if a == me else 'b'
        w = sum(1.0 if g['winner'] == side else 0.5 if g['winner'] == 'draw' else 0.0 for g in gs); l = len(gs) - w
        out[(a, b, m)] = 1.0 if w > l else 0.5 if w == l else 0.0
    return out
def paired(v):
    n = len(v); m = sum(v) / n; sd = math.sqrt(sum((x - m) ** 2 for x in v) / (n - 1)); return 100 * m, 196 * sd / math.sqrt(n)
for line in open('analysis/s73/grounds-batch-73a.txt'):
    if line.startswith('#') or not line.strip(): continue
    fmt, lst, tag, spec = line.split(); d = f'{A}{fmt}-{lst}-73a/'; sign = -1 if tag.startswith('no') else 1
    vals = []; per = []
    for s in (91, 173):
        if not os.path.exists(f'{d}{tag}-s{s}.done'): continue
        B, S = load(f'{d}base-s{s}', lst), load(f'{d}{tag}-s{s}', lst); assert set(B) == set(S)
        v = [sign * (S[k] - B[k]) for k in B]; vals += v; per.append('%+.1f ± %.1f' % paired(v))
    m, e = paired(vals)
    ok = (m - e >= 2) if (len(per) == 2 or m >= 5) else None
    print(f"{fmt}:{lst} {tag.replace('no','')}{' (removal)' if sign<0 else ''} | {' ; '.join(per)} | pooled {m:+.1f} ± {e:.1f} | less error {m-e:+.2f} | {'CLEARS' if ok else 'not read on two seeds' if ok is None else 'hold' if m>=2 and m-e>0 else 'below'}")
