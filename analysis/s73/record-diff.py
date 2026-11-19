# -*- coding: utf-8 -*-
"""S73a Part 5: the tables of record against the ones they replace (analysis/s73/record-prev/). python3 analysis/s73/record-diff.py"""
import json
FM = ['open', 'peasant', 'naya', 'esper', 'mardu', 'grixis', 'jund', 'jeskai', 'sultai', 'abzan', 'temur', 'bant', 'bodies', 'nothing-dear']
for f in FM:
    N = json.load(open(f'data/convocation/formats/{f}/matches.json'))['byList']; P = json.load(open(f'analysis/s73/record-prev/{f}-matches.json'))['byList']
    print(f"\n### {f}\n\n| list | matches | game one | was | move |\n|---|---|---|---|---|")
    for k in sorted(N, key=lambda k: -N[k]['matches']):
        p = P.get(k); print(f"| {k} | {N[k]['matches']:.1f} | {N[k]['gameOne']:.1f} | {p['matches'] if p else '—'} | {('%+.1f' % (N[k]['matches'] - p['matches'])) if p else 'new'} |")
