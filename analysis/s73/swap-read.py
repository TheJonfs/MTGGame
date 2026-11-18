# -*- coding: utf-8 -*-
"""S73 Part 1: one paired trial row from open:rr --matches shards.
   python3 swap-read.py <list> <label> <base-prefix> <swap-prefix>
The two arms share a seed, so match i of a pairing is the same match in both; the gain is the mean of the per-match
differences and its error 1.96 sd/sqrt(n) of those differences. Three columns (ADR-171): matches, game one, games two
and three. ADR-168's bar: the match estimate >= +2 with a positive lower bound, and no defining matchup lost."""
import json, glob, sys, math
me, label, bp, sp = sys.argv[1:5]
def load(prefix):
    ms = {}
    fs = sorted(glob.glob(prefix + '_[0-9].json')); assert len(fs) == 5, (prefix, fs)
    for f in fs:
        for g in json.load(open(f))['results']:
            if g.get('match') is None: continue
            ms.setdefault((g['a'], g['b'], g['match']), []).append(g)
    out = {}
    for (a, b, m), gs in ms.items():
        side = 'a' if a == me else 'b'; opp = b if a == me else a
        pts = lambda g: 1.0 if g['winner'] == side else 0.5 if g['winner'] == 'draw' else 0.0
        w = sum(pts(g) for g in gs); l = len(gs) - w
        g1 = [pts(g) for g in gs if g['gameNo'] == 0]; later = [pts(g) for g in gs if g['gameNo'] != 0]
        out[(opp, a, b, m)] = dict(match=1.0 if w > l else 0.5 if w == l else 0.0, g1=g1[0] if g1 else None, later=later)
    return out
B, S = load(bp), load(sp)
keys = sorted(set(B) & set(S)); assert len(keys) == len(B) == len(S), (len(B), len(S), len(keys))
def paired(vals):
    n = len(vals); m = sum(vals) / n; sd = math.sqrt(sum((v - m) ** 2 for v in vals) / (n - 1)) if n > 1 else 0
    return 100 * m, 196 * sd / math.sqrt(n)
def rate(xs): return 100 * sum(xs) / len(xs) if xs else float('nan')
bm, sm = rate([B[k]['match'] for k in keys]), rate([S[k]['match'] for k in keys])
d, e = paired([S[k]['match'] - B[k]['match'] for k in keys])
g1k = [k for k in keys if B[k]['g1'] is not None and S[k]['g1'] is not None]
d1, e1 = paired([S[k]['g1'] - B[k]['g1'] for k in g1k])
bl = [x for k in keys for x in B[k]['later']]; sl = [x for k in keys for x in S[k]['later']]
pl = lambda xs: (sum(xs) / len(xs)) if xs else 0
dl = 100 * (pl(sl) - pl(bl)); el = 196 * math.sqrt(pl(sl) * (1 - pl(sl)) / max(1, len(sl)) + pl(bl) * (1 - pl(bl)) / max(1, len(bl)))
print(f"## {label}")
print(f"matches {bm:.1f} -> {sm:.1f}  {d:+.1f} +/- {e:.1f}   | game one {rate([B[k]['g1'] for k in g1k]):.1f} -> {rate([S[k]['g1'] for k in g1k]):.1f}  {d1:+.1f} +/- {e1:.1f}   | later {100*pl(bl):.1f} -> {100*pl(sl):.1f}  {dl:+.1f} +/- {el:.1f} (unpaired)   | n {len(keys)}")
opps = sorted({k[0] for k in keys})
rows = []
for o in opps:
    ks = [k for k in keys if k[0] == o]; dd, ee = paired([S[k]['match'] - B[k]['match'] for k in ks])
    rows.append((dd, o, rate([B[k]['match'] for k in ks]), rate([S[k]['match'] for k in ks]), ee))
print('by opponent: ' + ', '.join(f"{o} {b:.0f}->{s:.0f} ({dd:+.0f})" for dd, o, b, s, ee in sorted(rows, reverse=True)))
lost = [f"{o} {dd:+.0f}+/-{ee:.0f}" for dd, o, b, s, ee in rows if dd + ee < 0]
print('pairings lost clear of error: ' + (', '.join(lost) if lost else 'none'))
bar = 'CLEARS' if d >= 2 and d - e > 0 else 'below'
print(f"ADR-168: {bar} (estimate {d:+.1f}, lower bound {d-e:+.1f})" + ('; second seed owed' if bar == 'CLEARS' and d < 5 else ''))
