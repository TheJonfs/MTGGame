import json,sys,math
import os
S=os.environ.get('OPEN_SCRATCH', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../analysis/runs/scratch'))+'/rr/'
def load(t):
    out={}; idx={}
    for g in json.load(open(S+f't_{t}_0.json'))['results']:
        k=(g['a'],g['b']); i=idx.get(k,0); idx[k]=i+1; out[(g['a'],g['b'],i)]=g
    return out
me=sys.argv[1]; A=load(sys.argv[2])
sc=lambda g: 1.0 if g['winner']!='draw' and (g['winner']=='a')==(g['a']==me) else (0.5 if g['winner']=='draw' else 0.0)
for t in sys.argv[3:]:
    B=load(t); ks=[k for k in B if k in A]; d=[sc(B[k])-sc(A[k]) for k in ks]; n=len(d); m=sum(d)/n; sd=math.sqrt(sum((x-m)**2 for x in d)/(n-1))
    per={}
    for k in ks: per.setdefault(k[1] if k[0]==me else k[0],[]).append(sc(B[k])-sc(A[k]))
    w=sorted((100*sum(v)/len(v),o) for o,v in per.items())
    print(f"{t:26} {100*sum(sc(A[k]) for k in ks)/n:5.1f} → {100*sum(sc(B[k]) for k in ks)/n:5.1f}  {100*m:+5.1f} ± {196*sd/math.sqrt(n):.1f} | worst "+', '.join(f'{o} {x:+.0f}' for x,o in w[:3])+' | best '+', '.join(f'{o} {x:+.0f}' for x,o in w[-3:]))
