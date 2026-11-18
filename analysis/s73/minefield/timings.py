# -*- coding: utf-8 -*-
"""S73 Part 4: the Walls, Minefield and Wrath timings from the narration of Chris's Naya Valakut games against Mardu
Control.  pnpm -s narrate docs/debug_logs/recorded_games/convocation-games-30-NayaValakut.json --match marducontrol > narration.txt
A turn is given as Chris's own n-th turn (the narration's T counts both players' turns)."""
import re, sys
games = []; g = None; mine = 0; my_turn = False
for line in open('analysis/s73/minefield/narration.txt'):
    m = re.match(r'===== game (\d+) (\S+) vs (.+?) — (WON|LOST|drawn) in (\d+) turns', line)
    if m:
        g = dict(n=int(m.group(1)), tag=m.group(2).split(':')[0], opp=m.group(3), res=m.group(4), turns=int(m.group(5)), walls=[], mines=[], wraths=[], twisters=[], helix=[], valakut=[], first_valakut_land=None, wheel=[], their_usher=[]); games.append(g); mine = 0; continue
    m = re.match(r'--- T(\d+) \((MINE|theirs)\)', line)
    if m:
        my_turn = m.group(2) == 'MINE'
        if my_turn and int(m.group(1)) > 0: mine += 1
        g['T'] = int(m.group(1)); continue
    if g is None: continue
    m = re.match(r'   ME\s+\S+\s+cast (.+)', line)
    if m:
        c = m.group(1)
        for key, name in (('walls', 'Wall of Blossoms'), ('mines', 'Powerstone Minefield'), ('wraths', 'Wrath of God'), ('twisters', 'Savage Twister'), ('helix', 'Sacred Helix'), ('wheel', 'Wheel of Fortune')):
            if c.startswith(name): g[key].append(mine if my_turn else f"{mine}*")
    if re.match(r'   ME\s+\S+\s+chooseTriggerTargets .*\{stack: Valakut', line): g['valakut'].append(mine if my_turn else f"{mine}*")
    if re.match(r'   THEM\s+\S+\s+cast The Usher', line): g['their_usher'].append(mine)
f = lambda xs: ', '.join(str(x) for x in xs) or '—'
print("| game | result | turns | Wall of Blossoms | Powerstone Minefield | Wrath of God | Savage Twister | Sacred Helix | Valakut triggers | their Usher |")
print("|---|---|---|---|---|---|---|---|---|---|")
for g in games:
    v = g['valakut']; vs = (f"{len(v)} (first on {v[0]})" if v else '—')
    print(f"| {g['n']} ({g['tag']}) | {g['res'].lower()} | {g['turns']} | {f(g['walls'])} | {f(g['mines'])} | {f(g['wraths'])} | {f(g['twisters'])} | {f(g['helix'])} | {vs} | {f(g['their_usher'])} |")
won = [g for g in games if g['res'] == 'WON']; lost = [g for g in games if g['res'] == 'LOST']
first = lambda gs, k: [g[k][0] for g in gs if g[k] and isinstance(g[k][0], int)]
avg = lambda xs: (sum(xs) / len(xs)) if xs else float('nan')
print()
for name, gs in (('won', won), ('lost', lost)):
    print(f"- **{name}** ({len(gs)}): first Wall on his turn {avg(first(gs,'walls')):.1f} ({len(first(gs,'walls'))} of {len(gs)} games); first Minefield {avg(first(gs,'mines')):.1f} ({len(first(gs,'mines'))} games); a Wrath in {sum(1 for g in gs if g['wraths'])}; first Valakut trigger {avg(first(gs,'valakut')):.1f} ({len(first(gs,'valakut'))} games); Minefields a game {avg([len(g['mines']) for g in gs]):.1f}; Walls a game {avg([len(g['walls']) for g in gs]):.1f}.")
