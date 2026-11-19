# -*- coding: utf-8 -*-
"""S73a Part 5: Bodies and Nothing Dear before and after the grounds (Chris's question).
   python3 analysis/s73/before-after.py [after-dir]     (after defaults to the tables of record)
Before: analysis/s73/before/<f>-matches.json (Part 3). Per list: match rate before and after, the move, the rank move,
the High Grounds it plays; the rank correlation; the lists that moved three places or more; holders against the rest."""
import json, math, sys
GROUNDS = ['tallyflame_court', 'wrackroot', 'shevelport', 'obsidian_observatory', 'cairnbrand', 'hearthspire', 'volmaw', 'nightbower', 'ranksmere', 'burnfallow']
after_dir = sys.argv[1] if len(sys.argv) > 1 else None
def rates(p): m = json.load(open(p))['byList']; return {k: (100 * v['mw'] / v['mn'], v['mn']) for k, v in m.items()}
def spearman(a, b):
    n = len(a); return 1 - 6 * sum((x - y) ** 2 for x, y in zip(a, b)) / (n * (n * n - 1))
for f, name in (('bodies', 'Bodies'), ('nothing-dear', 'Nothing Dear')):
    B = rates(f'analysis/s73/groundless/{f}-matches.json'); A = rates(f'{after_dir}/{f}-matches.json' if after_dir else f'analysis/s73/record/{f}-matches.json')
    assert set(A) == set(B), (set(A) ^ set(B))
    lists = {l['key']: l for l in json.load(open(f'data/convocation/formats/{f}/lists.json'))['lists']}
    held = {k: [e['cardId'] for e in lists[k]['decklist'] if e['cardId'] in GROUNDS] for k in A}
    rb = {k: i + 1 for i, k in enumerate(sorted(B, key=lambda k: -B[k][0]))}; ra = {k: i + 1 for i, k in enumerate(sorted(A, key=lambda k: -A[k][0]))}
    print(f'\n**{name}** (matches)\n\n| list | no grounds | with the grounds | move | rank | grounds |\n|---|---|---|---|---|---|')
    for k in sorted(A, key=lambda k: ra[k]):
        e = 196 * math.sqrt(A[k][0] / 100 * (1 - A[k][0] / 100) / A[k][1] + B[k][0] / 100 * (1 - B[k][0] / 100) / B[k][1])
        print(f"| {k} | {B[k][0]:.1f} | {A[k][0]:.1f} | {A[k][0] - B[k][0]:+.1f} ± {e:.1f} | {rb[k]} → {ra[k]} | {', '.join(held[k]) or '—'} |")
    ks = sorted(A); print(f"\n- Rank correlation (Spearman): {spearman([rb[k] for k in ks], [ra[k] for k in ks]):.3f}")
    mv = [k for k in ks if abs(rb[k] - ra[k]) >= 3]; print(f"- Moved three places or more: {', '.join(f'{k} ({rb[k]} → {ra[k]})' for k in mv) or 'none'}")
    print(f"- Mean absolute move: {sum(abs(A[k][0] - B[k][0]) for k in ks) / len(ks):.1f} points; largest: {max(ks, key=lambda k: abs(A[k][0] - B[k][0]))}")
    for n in sorted({len(v) for v in held.values()}):
        g = [k for k in ks if len(held[k]) == n]; print(f"- {n} ground{'s' if n != 1 else ''}: {len(g)} lists, mean after {sum(A[k][0] for k in g) / len(g):.1f} (before {sum(B[k][0] for k in g) / len(g):.1f}) — {', '.join(g)}")
