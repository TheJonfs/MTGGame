import json,math,sys
import os
S=os.environ.get('OPEN_SCRATCH', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../analysis/runs/scratch'))+'/rr/'
me=sys.argv[1]
for tag in sys.argv[2:]:
    gs=json.load(open(S+f't_{tag}_0.json'))['results']; ms={}
    for g in gs: ms.setdefault((g['a'],g['b'],g['match']),[]).append(g)
    per={}; g1w=g1n=lw=ln=0
    for (a,b,_),L in ms.items():
        s='a' if a==me else 'b'; o=b if s=='a' else a; w=sum(x['winner']==s for x in L); l=sum(x['winner'] not in (s,'draw') for x in L); per.setdefault(o,[]).append(1 if w>l else 0.5 if w==l else 0)
        for x in L:
            if x['gameNo']==0: g1n+=1; g1w+=x['winner']==s
            else: ln+=1; lw+=x['winner']==s
    allm=[x for v in per.values() for x in v]; n=len(allm); p=sum(allm)/n
    print(f"{tag:14} matches {100*p:.1f} ± {196*math.sqrt(p*(1-p)/n):.1f} | g1 {100*g1w/g1n:.1f} later {100*lw/ln:.1f} ({100*lw/ln-100*g1w/g1n:+.1f}) | "+' '.join(f"{o} {round(100*sum(v)/len(v))}" for o,v in sorted(per.items(),key=lambda x:-sum(x[1])/len(x[1]))))
