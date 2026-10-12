"""trials.py file — each line: tag|list|swap ; runs open:rr --only list --swap (100 games a pairing, seed 56) ten at a time; then prints each trial's paired change against the round-robin of record (rec_*)."""
import subprocess,sys,json,glob,math
from concurrent.futures import ThreadPoolExecutor
import os
S=os.environ.get('OPEN_SCRATCH', os.path.join(os.path.dirname(os.path.abspath(__file__)), '../../analysis/runs/scratch'))
BASE=sys.argv[2] if len(sys.argv)>2 else 'rec'
jobs=[l.strip().split('|') for l in open(sys.argv[1]) if l.strip() and not l.startswith('#')]
def run(j):
    tag,lst,swap=j[:3]
    import os
    if os.path.exists(f'{S}/rr/t_{tag}_0.json'): return
    extra=j[3].split() if len(j)>3 else []
    cmd=['pnpm','-s','open:rr']+([] if '--games' in extra else ['--games','100'])+([] if '--seed' in extra else ['--seed','56'])+['--only',lst,'--out',f'{S}/rr/t_{tag}_0.json']+(['--swap',swap] if swap else [])+extra
    r=subprocess.run(cmd,cwd=os.path.join(os.path.dirname(os.path.abspath(__file__)), '../..'),capture_output=True,text=True)
    if r.returncode: print('FAIL',tag,r.stderr[-400:],flush=True)
with ThreadPoolExecutor(10) as ex: list(ex.map(run,jobs))
def load(pat):
    out={}
    for f in sorted(glob.glob(f'{S}/rr/{pat}')):
        idx={}
        for g in json.load(open(f))['results']:
            k=(g['a'],g['b']); i=idx.get(k,0); idx[k]=i+1; out[(g['a'],g['b'],i)]=g
    return out
REC0=load(BASE+'_*.json')
def sc(g,me): return 1.0 if g['winner']!='draw' and (g['winner']=='a')==(g['a']==me) else (0.5 if g['winner']=='draw' else 0.0)
for j in jobs:
    tag,lst,swap=j[:3]
    B=load(f't_{tag}_0.json')
    if not B: print(tag,'no data'); continue
    REC=load(f't_{j[4]}_0.json') if len(j)>4 else REC0
    if not swap and len(j)<=3: continue
    ks=[k for k in B if k in REC]; d=[sc(B[k],lst)-sc(REC[k],lst) for k in ks]
    n=len(d); m=sum(d)/n; sd=math.sqrt(sum((x-m)**2 for x in d)/(n-1)); ci=196*sd/math.sqrt(n)
    per={}
    for k in ks:
        o=k[1] if k[0]==lst else k[0]; per.setdefault(o,[]).append(sc(B[k],lst)-sc(REC[k],lst))
    worst=sorted(((100*sum(v)/len(v)),o) for o,v in per.items())
    base=100*sum(sc(REC[k],lst) for k in ks)/n
    flag='ADOPT?' if m*100-ci>=2 else ('hurts' if m*100+ci<0 else '')
    print(f'{tag:28} {lst:11} {base:5.1f} → {base+100*m:5.1f}  {100*m:+5.1f} ± {ci:.1f}  {flag:7} worst: '+', '.join(f'{o} {x:+.0f}' for x,o in worst[:3])+' | best: '+', '.join(f'{o} {x:+.0f}' for x,o in worst[-3:]))
