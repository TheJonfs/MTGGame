# -*- coding: utf-8 -*-
"""S73 Part 1: builds docs/reference/vintage-audit-s73.md from the trial shards, rows.json (roles and notes, by hand),
the census (pnpm vintage-audit --summary --json) and audit-hand.md (the prose, with {{PLACEHOLDERS}}).
   pnpm -s vintage-audit --summary --json analysis/s73/census.json && python3 analysis/s73/audit-doc.py"""
import json, glob, math, os, re, sys
A = 'analysis/s73/'
rowsmeta = json.load(open(A + 'rows.json')); census = json.load(open(A + 'census.json'))
names = {}
for f in glob.glob('data/cards/**/*.json', recursive=True):
    d = json.load(open(f)); names[d['id']] = d['name']
def load(prefix, me):
    ms = {}
    fs = sorted(glob.glob(prefix + '_[0-9].json')); assert len(fs) == 5, prefix
    for f in fs:
        for g in json.load(open(f))['results']:
            if g.get('match') is not None: ms.setdefault((g['a'], g['b'], g['match']), []).append(g)
    out = {}
    for (a, b, m), gs in ms.items():
        side = 'a' if a == me else 'b'; opp = b if a == me else a
        pts = lambda g: 1.0 if g['winner'] == side else 0.5 if g['winner'] == 'draw' else 0.0
        w = sum(pts(g) for g in gs); l = len(gs) - w
        g1 = [pts(g) for g in gs if g['gameNo'] == 0]
        out[(opp, a, b, m)] = dict(match=1.0 if w > l else 0.5 if w == l else 0.0, g1=g1[0] if g1 else None)
    return out
def paired(vals):
    n = len(vals); m = sum(vals) / n; sd = math.sqrt(sum((v - m) ** 2 for v in vals) / (n - 1))
    return 100 * m, 196 * sd / math.sqrt(n)
def read(fmt, lst, tag, seed):
    d = f"{A}audit/{fmt}-{lst}{rowsmeta.get(f'{fmt}:{lst} {tag}', {}).get('suffix', '')}/"
    if not (os.path.exists(f'{d}{tag}-s{seed}.done') and os.path.exists(f'{d}base-s{seed}.done')): return None
    B, S = load(f'{d}base-s{seed}', lst), load(f'{d}{tag}-s{seed}', lst); keys = sorted(set(B) & set(S)); assert len(keys) == len(B) == len(S)
    r = lambda X, f: 100 * sum(X[k][f] for k in keys) / len(keys)
    dm, em = paired([S[k]['match'] - B[k]['match'] for k in keys]); d1, e1 = paired([S[k]['g1'] - B[k]['g1'] for k in keys])
    lost = []
    for o in sorted({k[0] for k in keys}):
        ks = [k for k in keys if k[0] == o]; dd, ee = paired([S[k]['match'] - B[k]['match'] for k in ks])
        if dd + ee < 0: lost.append((o, dd, ee))
    return dict(base=r(B, 'match'), swap=r(S, 'match'), d=dm, e=em, g1b=r(B, 'g1'), g1s=r(S, 'g1'), d1=d1, e1=e1, lost=lost, n=len(keys), keys=keys, B=B, S=S)
def swaptext(spec, short=False):
    parts = [p.split(':') for p in spec.split(';')]; to = names[parts[0][2]]; n = sum(int(p[1]) for p in parts)
    return f"{n} {to} for " + ', '.join(f"{p[1]} {names[p[0]]}" for p in parts)
trials = []
for b in sorted(glob.glob(A + 'batch*.txt')):
    for line in open(b):
        if line.startswith('#') or not line.strip(): continue
        fmt, lst, tag, spec = line.split(); k = f'{fmt}:{lst} {tag}'
        if any(t['k'] == k for t in trials): continue
        trials.append(dict(k=k, fmt=fmt, lst=lst, tag=tag, spec=spec))
if not any(t['k'] == 'open:emeraldsnakes guard' for t in trials): trials.insert(0, dict(k='open:emeraldsnakes guard', fmt='open', lst='emeraldsnakes', tag='guard', spec='elvish_visionary:4:clutch_guard'))
cname = {f"{c['format']}:{c['key']}": c['name'] for c in census}
FMT = {'open': 'the Open', 'peasant': 'Peasant', 'bodies': 'Bodies', 'nothing-dear': 'Nothing Dear'}
fname = lambda f: FMT.get(f, f.capitalize())
done = []; pending = []
for t in trials:
    r1 = read(t['fmt'], t['lst'], t['tag'], 91)
    if not r1: pending.append(t); continue
    assert t['k'] in rowsmeta, t['k']
    t.update(r1=r1, r2=read(t['fmt'], t['lst'], t['tag'], 173), meta=rowsmeta[t['k']]); done.append(t)
def verdict(t):
    m, r1, r2 = t['meta'], t['r1'], t['r2']
    if m.get('verdict'): return m['verdict']
    if m.get('confounded'): return 'confounded (game one %+.1f ± %.1f)' % (r1['d1'], r1['e1'])
    clears = lambda r: r['d'] >= 2 and r['d'] - r['e'] > 0
    if not clears(r1): return 'below the bar'
    if r1['d'] >= 5: return '**clears**'
    if r2 is None: return 'clears on seed 91; second seed owed'
    # pooled over the two seeds, paired
    vals = [x['S'][k]['match'] - x['B'][k]['match'] for x in (r1, r2) for k in x['keys']]; d, e = paired(vals); t['pooled'] = (d, e)
    return ('**clears** on two seeds' if (r2['d'] >= 2 and r2['d'] - r2['e'] > 0) else '**clears** pooled over two seeds; seed 173 alone is under the bar' if (r2['d'] > 0 and d >= 2 and d - e > 0) else 'does not hold on the second seed') + ' (seed 173 %+.1f ± %.1f; pooled %+.1f ± %.1f)' % (r2['d'], r2['e'], d, e)
for t in done: t['verdict'] = verdict(t)
def rowline(t):
    r = t['r1']; lost = ', '.join(f"{cname.get(t['fmt'] + ':' + o, o)} {dd:+.0f}" for o, dd, ee in r['lost']) or '—'
    return f"| {fname(t['fmt'])} | {cname[t['fmt'] + ':' + t['lst']]} | {swaptext(t['spec'])} | {t['meta']['role']} | {r['base']:.1f} → {r['swap']:.1f} | **{r['d']:+.1f} ± {r['e']:.1f}** | {r['d1']:+.1f} ± {r['e1']:.1f} | {lost} | {t['verdict']} |"
HEAD = "| format | list | swap | why by role | matches | gain | game one | pairings lost | verdict |\n|---|---|---|---|---|---|---|---|---|\n"
order = sorted(done, key=lambda t: -t['r1']['d'])
ROWS = HEAD + '\n'.join(rowline(t) for t in order)
NOTES = '\n'.join(f"- **{fname(t['fmt'])}'s {cname[t['fmt'] + ':' + t['lst']]}, {names[t['spec'].split(';')[0].split(':')[2]]}**: {t['meta']['note']}" for t in order if t['meta'].get('note'))
# the High Grounds census
HG = {'tallyflame_court': 'UR', 'wrackroot': 'UG', 'shevelport': 'WG', 'obsidian_observatory': 'WB', 'cairnbrand': 'BR', 'hearthspire': 'WR', 'volmaw': 'UB', 'nightbower': 'BG', 'ranksmere': 'WU', 'burnfallow': 'RG'}
TRIAD = {'naya': 'RGW', 'esper': 'WUB', 'mardu': 'RWB', 'grixis': 'UBR', 'jund': 'BRG', 'jeskai': 'URW', 'sultai': 'BGU', 'abzan': 'WBG', 'temur': 'GUR', 'bant': 'GWU'}
decks = {}
for f in glob.glob('data/convocation/formats/*/lists.json'):
    fmt = f.split('/')[3]
    for l in json.load(open(f))['lists']: decks[f'{fmt}:{l["key"]}'] = {e['cardId'] for e in l['decklist']}
sys.path.insert(0, A)
CHRIS_OPEN = {'sweep', 'depths', 'hearth', 'pall', 'kiln', 'cinder', 'writ', 'rabble', 'countersnake', 'reaper', 'reaperclio', 'marducontrol', 'emeraldsnakes', 'pinnacle', 'minefield', 'lumenclio', 'earthrise', 'funpolice'}
CHRIS_OWN = {'abzan:bwmassacrats', 'bant:sourworms', 'bodies:bantsnake', 'grixis:mbclio', 'grixis:massacrats', 'jeskai:minefield', 'jund:bfh', 'jund:dragons', 'mardu:witch', 'naya:snakes', 'peasant:wskies', 'peasant:wbbasilisk', 'sultai:massocrafts', 'temur:temurcontrol'}
def contributed(c): return (c['root'].startswith('open:') and c['root'].split(':')[1] in CHRIS_OPEN) or c['root'] in CHRIS_OWN or f"{c['format']}:{c['key']}" in CHRIS_OWN
import subprocess
opendecks = {}
txt = open('packages/sim/src/open-decks.ts').read(); blk = txt[txt.index('export const OPEN_DECKS'):txt.index('export const OPEN_FIELD')]
for m in re.finditer(r'^  (\w+): \{ key: .*?decklist: d\(\[(.*?)\]\)', blk, re.M): opendecks['open:' + m.group(1)] = set(re.findall(r'\["(\w+)", \d+\]', m.group(2)))
decks.update(opendecks)
hgrows = []
for c in census:
    k = f"{c['format']}:{c['key']}"
    if c['format'] == 'peasant': continue
    for h, pair in HG.items():
        if not all(x in c['colours'] for x in pair): continue
        if c['format'] in TRIAD and not all(x in TRIAD[c['format']] for x in pair): continue
        if h in decks[k]: continue
        tr = next((t for t in done if t['fmt'] == c['format'] and t['lst'] == c['key'] and names[h].lower().replace(' ', '_') in t['spec']), None)
        hgrows.append((contributed(c), c['format'], c['name'], names[h], ('%+.1f ± %.1f' % (tr['r1']['d'], tr['r1']['e'])) if tr else '—'))
HGT = "| format | list | lacks | trial |\n|---|---|---|---|\n" + '\n'.join(f"| {fname(f)} | {n} | {h} | {t} |" for con, f, n, h, t in hgrows if not con)
HGC = "| format | list | lacks |\n|---|---|---|\n" + '\n'.join(f"| {fname(f)} | {n} | {h} |" for con, f, n, h, t in hgrows if con)
# the census
lines = []
for fmt in ['open', 'peasant', 'naya', 'esper', 'mardu', 'grixis', 'jund', 'jeskai', 'sultai', 'abzan', 'temur', 'bant', 'bodies', 'nothing-dear']:
    lines.append(f"\n### {fname(fmt)[0].upper() + fname(fmt)[1:]}\n\n| list | matches of record | base arm now | poolAt | read at | delta | rows run | status |\n|---|---|---|---|---|---|---|---|")
    for c in [c for c in census if c['format'] == fmt]:
        ts = [t for t in done if t['fmt'] == fmt and t['lst'] == c['key']]
        base = ('%.1f' % ts[0]['r1']['base']) if ts else '—'
        clears = [t for t in ts if t['verdict'].startswith('**clears')]
        status = ('contributed: to Chris' if contributed(c) else '') or ('trialled: ' + (f"{len(clears)} clear" if clears else 'nothing clears') if ts else 'owed')
        if contributed(c) and ts: status += f" ({len(ts)} row{'s' if len(ts) > 1 else ''} run at the brief's word)"
        port = '' if c['root'] == f"{fmt}:{c['key']}" else f" ({c['root']})"
        lines.append(f"| {c['name']} | {c['matches'] if c['matches'] is not None else '—'} | {base} | {c['poolAt']} | {c['readAt']}{port} | {len(c['candidates'])} | {len(ts)} | {status} |")
CENSUS = '\n'.join(lines)
owed = {}
for c in census:
    if not contributed(c) and not any(t['fmt'] == c['format'] and t['lst'] == c['key'] for t in done): owed.setdefault(c['format'], []).append(c['name'])
OWED = '\n'.join(f"- **{fname(f)[0].upper() + fname(f)[1:]}** ({len(v)}): {', '.join(v)}." for f, v in owed.items())
drift = sorted({(t['fmt'], t['lst']): (t['r1']['base'] - next(c['matches'] for c in census if c['format'] == t['fmt'] and c['key'] == t['lst']), t) for t in done if next(c['matches'] for c in census if c['format'] == t['fmt'] and c['key'] == t['lst']) is not None}.values(), key=lambda x: x[0])
DRIFT = "| format | list | table of record | base arm now | change |\n|---|---|---|---|---|\n" + '\n'.join(f"| {fname(t['fmt'])} | {cname[t['fmt'] + ':' + t['lst']]} | {t['r1']['base'] - d:.1f} | {t['r1']['base']:.1f} | {d:+.1f} |" for d, t in drift)
hand = open(A + 'audit-hand.md').read()
subs = dict(ROWS=ROWS, NOTES=NOTES, HG_PLANNER=HGT, HG_CHRIS=HGC, CENSUS=CENSUS, OWED=OWED, DRIFT=DRIFT, NROWS=str(len(done)), NLISTS=str(len(census)), NCLEAR=str(sum(1 for t in done if t['verdict'].startswith('**clears'))), NTRIALLED=str(len({(t['fmt'], t['lst']) for t in done})), NCONTRIB=str(sum(1 for c in census if contributed(c))), NOWED=str(sum(len(v) for v in owed.values())))
for k, v in subs.items():
    assert '{{' + k + '}}' in hand, 'audit-hand.md has no {{%s}}' % k
    hand = hand.replace('{{' + k + '}}', v)
assert '{{' not in hand, re.findall(r'\{\{\w+\}\}', hand)
open('docs/reference/vintage-audit-s73.md', 'w').write(hand)
print('rows', len(done), 'pending', [t['k'] for t in pending]); print('clears', subs['NCLEAR'], 'owed', subs['NOWED'], 'contributed', subs['NCONTRIB'])
for t in order: print('%-34s %+5.1f ± %.1f  %s' % (t['k'], t['r1']['d'], t['r1']['e'], t['verdict'][:70]))
