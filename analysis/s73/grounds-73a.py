# -*- coding: utf-8 -*-
"""S73a Part 4 (ADR-201): the High Grounds by rule, applied to the planner's lists. python3 analysis/s73/grounds-73a.py
The rule's grounds (Hearthspire, Nightbower, Volmaw; Wrackroot joined on its three rows): one copy for a basic of the
pair's more plentiful colour (pips; a tie or no such basic -> the pair's other basic). The grounds that did not join are
adopted only where their row cleared (ROWS, at the row's own swap). Every edit asserts its slot; none is a no-op."""
import json
F = 'data/convocation/formats/'
RULE = ['hearthspire', 'nightbower', 'volmaw', 'wrackroot']
ROWS = [('grixis', 'clio', 'tallyflame_court', 'island'), ('abzan', 'warden', 'obsidian_observatory', 'plains'),
        ('grixis', 'br', 'cairnbrand', 'swamp'), ('mardu', 'chancel', 'cairnbrand', 'swamp')]
BASIC = {'W': 'plains', 'U': 'island', 'B': 'swamp', 'R': 'mountain', 'G': 'forest'}
NAME = {'hearthspire': 'Hearthspire', 'plains': 'Plains', 'mountain': 'Mountain'}
W = json.load(open('analysis/s73/grounds-worklist.json'))
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
todo = {}  # (fmt,key) -> [(ground, basic)]
basics_left = {}
def plan(fmt, key, g, b, why):
    todo.setdefault((fmt, key), []).append((g, b, why))
for r in W:
    if r['ground'] not in RULE or r['plays'] or r['chris'] or not r['legal']: continue
    k = (r['format'], r['key']); left = basics_left.setdefault(k, {})
    (c1, c2) = sorted(r['pair'], key=lambda c: (-r['pips'][c], -r['basics'][c]))
    pick = None
    for c in (c1, c2):
        have = left.get(BASIC[c], r['basics'][c])
        if have > 0: pick = BASIC[c]; left[pick] = have - 1; break
    assert pick, ('no basic of the pair', k, r['ground'])
    plan(r['format'], r['key'], r['ground'], pick, 'ADR-201')
for fmt, key, g, b in ROWS: plan(fmt, key, g, b, 'its row cleared')
seedtext = open(F + 'open/seeds.json').read(); count = {}
for (fmt, key), sw in sorted(todo.items()):
    l = find(fmt, key)
    for g, b, why in sw: count[(fmt, g)] = count.get((fmt, g), 0) + 1
    if 'cards' in l:  # an Open seed, by card name: edited as text
        i = seedtext.index('"key": "%s"' % key); j = seedtext.index('\n   }', i); blk = seedtext[i:j]
        for g, b, why in sw:
            n = l['cards'][NAME[b]]; old = '"%s": %d' % (NAME[b], n); assert blk.count(old + ',') == 1 and NAME[g] not in blk, (key, old)
            blk = blk.replace(old + ',', '"%s": %d,\n    "%s": 1,' % (NAME[b], n - 1, NAME[g])); l['cards'][NAME[b]] = n - 1
        seedtext = seedtext[:i] + blk + seedtext[j:]
    else:
        d = l['decklist']; before = sum(e['count'] for e in d)
        for g, b, why in sw:
            assert not any(e['cardId'] == g for e in d), (fmt, key, g)
            e = next((e for e in d if e['cardId'] == b), None); assert e and e['count'] >= 1, (fmt, key, b)
            e['count'] -= 1; d.insert(d.index(e), {'cardId': g, 'count': 1})
            if e['count'] == 0: d.remove(e)
        assert sum(e['count'] for e in d) == before
        l['source'] = l.get('source', '') + (' ' if l.get('source') else '') + 'S73a (ADR-201, the High Grounds): ' + '; '.join(f'1 {g} for 1 {b}' + ('' if why == 'ADR-201' else ' (its row cleared)') for g, b, why in sw) + '.'
    print(f'{fmt}:{key}  ' + ', '.join(f'{g} for {b}' + ('' if why == 'ADR-201' else ' [row]') for g, b, why in sw))
for p, j in files.items():
    if not p.endswith('seeds.json'): open(p, 'w').write(json.dumps(j, indent=1, ensure_ascii=False) + '\n')
open(F + 'open/seeds.json', 'w').write(seedtext)
print('\nlists changed:', len(todo), ' swaps:', sum(len(v) for v in todo.values()))
for g in RULE + ['tallyflame_court', 'obsidian_observatory', 'cairnbrand']:
    print(g, {f: n for (f, gg), n in sorted(count.items()) if gg == g}, sum(n for (f, gg), n in count.items() if gg == g))
fm = {}
for (f, k) in todo: fm[f] = fm.get(f, 0) + 1
print('by format', fm)
