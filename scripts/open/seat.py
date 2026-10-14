"""seat.py <list> tags… — a match summary over every shard of a tag (rr.sh's <tag>_<i>.json), for the list in that seat:
matches, game one, later games, the rate by opponent, and its most-cast cards a game."""
import json,glob,math,collections,os,sys
S=os.environ.get('OPEN_SCRATCH', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../analysis/runs/scratch'))+'/rr/'
me=sys.argv[1]
for tag in sys.argv[2:]:
    gs=[g for f in sorted(glob.glob(f'{S}{tag}_[0-9]*.json')) for g in json.load(open(f))['results']]
    ms={}
    for g in gs: ms.setdefault((g['a'],g['b'],g['match']),[]).append(g)
    per={};g1=[];lt=[];casts=collections.Counter()
    for (a,b,_),L in ms.items():
        if me not in (a,b): continue
        s='a' if a==me else 'b'; o=b if s=='a' else a
        w=sum(x['winner']==s for x in L); l=sum(x['winner'] not in (s,'draw') for x in L)
        per.setdefault(o,[]).append(1 if w>l else .5 if w==l else 0)
        for x in L:
            (g1 if x['gameNo']==0 else lt).append(x['winner']==s)
            for c,n in (x['logA'] if s=='a' else x['logB'])['cast'].items(): casts[c]+=n
    al=[x for v in per.values() for x in v]; n=len(al); p=sum(al)/n
    print(f"{tag:12} {len(gs)} games, {n} matches: {100*p:.1f} ± {196*math.sqrt(p*(1-p)/n):.1f} | g1 {100*sum(g1)/len(g1):.1f} later {100*sum(lt)/len(lt):.1f}")
    print('   '+' '.join(f"{o} {round(100*sum(v)/len(v))}" for o,v in sorted(per.items(),key=lambda x:-sum(x[1])/len(x[1]))))
    ng=len(g1)+len(lt); print('   casts a game: '+' '.join(f"{c} {n/ng:.2f}" for c,n in casts.most_common(14)))
