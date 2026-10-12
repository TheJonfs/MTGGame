import json,sys,math
import os
S=os.environ.get('OPEN_SCRATCH', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../analysis/runs/scratch'))+'/rr/'
me=sys.argv[1]
for tag in sys.argv[2:]:
    try: gs=json.load(open(S+f't_{tag}_0.json'))['results']
    except Exception as e: print(tag,'no data'); continue
    per={}; casts={}
    for g in gs:
        s='a' if g['a']==me else 'b'; o=g['b' if s=='a' else 'a']; per.setdefault(o,[]).append(g['winner']==s)
        lg=g['logA' if s=='a' else 'logB']
        for k,v in lg['cast'].items(): casts[k]=casts.get(k,0)+v
    n=len(gs)
    print(f"{tag:22} "+'  '.join(f"{o} {100*sum(v)/len(v):.0f} ±{196*math.sqrt(max(1e-9,sum(v)/len(v)*(1-sum(v)/len(v)))/len(v)):.0f}" for o,v in sorted(per.items())))
