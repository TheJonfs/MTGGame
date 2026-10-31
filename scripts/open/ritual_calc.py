"""The Mountain ritual's mana calculator: no AI, no opponent. Deals a 60-card list of Mountains, copies and blanks; each
turn it plays a land and casts every copy in hand that pays for itself; reports how often the mana for a turn reaches
each target by that turn (on the play, seven-card hands, a mulligan to six off zero, one, six or seven lands).
Usage: ritual_calc.py [lands] [trials]"""
import random,sys
LANDS=int(sys.argv[1]) if len(sys.argv)>1 else 24
N=int(sys.argv[2]) if len(sys.argv)>2 else 200000
TARGETS=(5,7,11) # Siege-Gang, a seven-drop, Blaze at X=10
TURNS=range(3,9)
def game(rng,cost,copies):
    deck=['L']*LANDS+['R']*copies+['x']*(60-LANDS-copies)
    while True:
        rng.shuffle(deck); hand=deck[:7]
        if 2<=hand.count('L')<=5: break
        rng.shuffle(deck); hand=deck[:6]; break
    i=len(hand); lands=0; best=[0]*10
    held_l=hand.count('L'); held_r=hand.count('R'); top=0
    for t in range(1,9):
        if t>1:
            c=deck[i]; i+=1
            held_l+=c=='L'; held_r+=c=='R'
        if held_l: held_l-=1; lands+=1
        mana=lands; r=held_r
        # a copy needs its cost in hand mana first; each returns one mana per Mountain
        while r and cost is not None and lands>cost and mana>=cost: mana+=lands-cost; r-=1
        top=max(top,mana); best[t]=top
    return best
rng=random.Random(71)
rows=[('none',None,0)]+[(f'{c} mana x{k}',c,k) for c in (1,2,3) for k in (1,2,4)]
print(f'{LANDS} Mountains, {N} deals. % reaching the target by each turn')
print(f"{'':14}"+''.join(f'{"T"+str(g)+"+":>7}' for g in TURNS)+'   target')
for name,c,k in rows:
    res=[game(rng,c,k) for _ in range(N)]
    for tg in TARGETS:
        print(f'{name:14}'+''.join(f'{100*sum(b[t]>=tg for b in res)/N:7.1f}' for t in TURNS)+f'   {tg}')
    print()
