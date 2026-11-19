# -*- coding: utf-8 -*-
"""S73a Part 2: the adoptions, applied to the formats' list data. python3 analysis/s73/adopt-73a.py
Every swap asserts its slot is there at the count the trial row used; a swap that finds nothing is a failure."""
import json, sys
F = 'data/convocation/formats/'
ADOPT = [  # format, key, [(from, n, to)]
 *[(f, 'wurmspeaker', [('rampant_growth', 4, 'order_druid')]) for f in ('open', 'bant', 'bodies', 'jund', 'sultai', 'temur')],
 ('naya', 'wurms', [('rampant_growth', 4, 'order_druid')]),
 ('nothing-dear', 'br', [('child_of_night', 4, 'daunting_terror')]), ('grixis', 'br', [('child_of_night', 4, 'daunting_terror')]),
 ('bodies', 'stampede', [('centaur_courser', 4, 'daunting_terror')]),
 ('peasant', 'mbc', [('gallows_djinn', 3, 'nyxathid')]),
 ('mardu', 'burn', [('arc_mage', 2, 'storm_shaman'), ('furnace_whelp', 2, 'storm_shaman')]),
 ('open', 'muster', [('suntail_hawk', 2, 'dawnwing_marshal'), ('fencing_ace', 1, 'dawnwing_marshal')]),
 *[(f, 'emeraldsnakes', [('elvish_visionary', 4, 'clutch_guard')]) for f in ('open', 'temur', 'bodies')],
 ('temur', 'reaper', [('wall_of_blossoms', 4, 'clutch_guard')]),
 ('sultai', 'mill', [('tome_scour', 4, 'silt_spirit')]),
]
files = {}
def load(p):
    if p not in files: files[p] = json.load(open(p))
    return files[p]
def find(fmt, key):
    for p in ([F + 'open/seeds.json', F + 'open/contributed.json'] if fmt == 'open' else [F + fmt + '/lists.json']):
        j = load(p)
        for l in j.get('lists', []) + j.get('seeds', []):
            if l['key'] == key: return l
    raise SystemExit(f'no list {fmt}:{key}')
for fmt, key, swaps in ADOPT:
    l = find(fmt, key)
    if 'cards' in l: continue  # the Open's seeds are by card name: edited below, as text
    cards = {e['cardId']: e['count'] for e in l['decklist']}
    before = sum(cards.values())
    for a, n, b in swaps:
        assert cards.get(a, 0) >= n, f'{fmt}:{key} has {cards.get(a, 0)} {a}, wants {n}'
        cards[a] -= n; cards[b] = cards.get(b, 0) + n
        if cards[a] == 0: del cards[a]
        assert cards[b] <= 4, f'{fmt}:{key} {b} over four'
    assert sum(cards.values()) == before
    if 'cards' not in l:
        order = [e['cardId'] for e in l['decklist']]
        # the new card takes the place of the first card it replaced
        out = []
        for c in order:
            if c in cards: out.append({'cardId': c, 'count': cards[c]})
            for a, n, b in swaps:
                if a == c and b not in order and b not in [e['cardId'] for e in out]: out.append({'cardId': b, 'count': cards[b]})
        assert sum(e['count'] for e in out) == before, (fmt, key)
        l['decklist'] = out
    l['source'] = l.get('source', '') + (' ' if l.get('source') else '') + 'S73a (the vintage audit): ' + '; '.join(f'{n} {b} for {a}' for a, n, b in swaps) + '.'
    print('adopted', fmt, key, swaps)
for p, j in files.items():
    if not p.endswith('seeds.json'): open(p, 'w').write(json.dumps(j, indent=1, ensure_ascii=False) + '\n')
# the Open's seeds (card names; the file's own layout is kept)
p = F + 'open/seeds.json'; t = open(p).read()
def seed(key, edits):
    global t
    i = t.index('"key": "%s"' % key); j = t.index('\n   }', i); blk = t[i:j]
    for a, b in edits:
        assert blk.count(a) == 1, (key, a); blk = blk.replace(a, b)
    t = t[:i] + blk + t[j:]; print('adopted open', key, edits)
seed('wurmspeaker', [('"Rampant Growth": 4', '"Order Druid": 4')])
seed('muster', [('"Suntail Hawk": 4', '"Suntail Hawk": 2'), ('"Fencing Ace": 4', '"Fencing Ace": 3,\n    "Dawnwing Marshal": 3')])
open(p, 'w').write(t)
