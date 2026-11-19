# -*- coding: utf-8 -*-
"""S73a Part 5 (a study for Chris's question): the --swap string that takes every High Ground out of every list of a
format, each for a basic of its pair's colour the list has more pips of.   python3 analysis/s73/groundless.py <format>"""
import json, glob, re, sys
HG = {'tallyflame_court': 'UR', 'wrackroot': 'UG', 'shevelport': 'WG', 'obsidian_observatory': 'WB', 'cairnbrand': 'BR', 'hearthspire': 'RW', 'volmaw': 'UB', 'nightbower': 'BG', 'ranksmere': 'WU', 'burnfallow': 'RG'}
BASIC = {'W': 'plains', 'U': 'island', 'B': 'swamp', 'R': 'mountain', 'G': 'forest'}
cost = {}
for f in glob.glob('data/cards/**/*.json', recursive=True):
    d = json.load(open(f)); cost[d['id']] = d.get('manaCost') or ''
out = {}
J = json.load(open(f'data/convocation/formats/{sys.argv[1]}/lists.json'))
for l in J['lists']:
    if l['key'] in J.get('archived', {}): continue
    pips = {c: sum(e['count'] * len(re.findall(c, cost[e['cardId']])) for e in l['decklist']) for c in 'WUBRG'}
    for e in l['decklist']:
        if e['cardId'] in HG:
            a, b = HG[e['cardId']]; out.setdefault(l['key'], []).append(f"{e['cardId']}:{e['count']}:{BASIC[a if pips[a] >= pips[b] else b]}")
print('|'.join(k + ':' + ';'.join(v) for k, v in out.items()))
