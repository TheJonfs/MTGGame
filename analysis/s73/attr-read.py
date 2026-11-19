# -*- coding: utf-8 -*-
"""S73a Part 1: the attribution table. python3 analysis/s73/attr-read.py
Each arm's match rate for the list against its field (160 matches a pairing, seed 91), beside the table of record, and
each arm paired against `base` match by match."""
import json, glob, math, os
def load(d, tag, me):
    ms = {}
    for f in sorted(glob.glob(f'{d}/{tag}_[0-9].json')):
        for g in json.load(open(f))['results']:
            if g.get('match') is not None: ms.setdefault((g['a'], g['b'], g['match']), []).append(g)
    out = {}
    for (a, b, m), gs in ms.items():
        side = 'a' if a == me else 'b'
        w = sum(1.0 if g['winner'] == side else 0.5 if g['winner'] == 'draw' else 0 for g in gs); l = len(gs) - w
        out[(a, b, m)] = 1.0 if w > l else 0.5 if w == l else 0.0
    return out
def paired(v):
    n = len(v); m = sum(v) / n; sd = math.sqrt(sum((x - m) ** 2 for x in v) / (n - 1)); return 100 * m, 196 * sd / math.sqrt(n)
for d in sorted(glob.glob('analysis/s73/attr/*')):
    fmt, lst = os.path.basename(d).rsplit('-', 1) if not os.path.basename(d).startswith('nothing-dear') else ('nothing-dear', os.path.basename(d)[len('nothing-dear-'):])
    rec = json.load(open(f'data/convocation/formats/{fmt}/matches.json'))['byList'].get(lst, {}).get('matches')
    tags = sorted({os.path.basename(f)[:-5] for f in glob.glob(f'{d}/*.done')}, key=lambda t: (t != 'base', t))
    if 'base' not in tags: continue
    B = load(d, 'base', lst); line = [f"{fmt}:{lst}", f"record {rec}", f"base {100 * sum(B.values()) / len(B):.1f}"]
    for t in tags:
        if t == 'base': continue
        S = load(d, t, lst); ks = sorted(set(B) & set(S)); dd, ee = paired([S[k] - B[k] for k in ks])
        line.append(f"{t} {100 * sum(S[k] for k in ks) / len(ks):.1f} ({dd:+.1f} ± {ee:.1f})")
    print(' | '.join(line))
