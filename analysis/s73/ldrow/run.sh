#!/bin/zsh
# S73 Part 3: the Warband's land-destruction row keyed on `landdeck`, paired against the same sixty, fifteen and guide with
# the row dropped. 160 matches a pairing against the WHOLE Open field, seed 91, five shards an arm.
d=analysis/s73/ldrow; pids=()
common=(--only warband --matches 160 --seed ${1:-91} --deck warband:$d/warband-sixty.json --deck-side $d/warband-fifteen.json --deck-guide $d/warband-guide.json)
for i in 0 1 2 3 4; do
  pnpm -s open:rr $common --shard $i/5 --out $d/row-s${1:-91}_$i.json > $d/row-s${1:-91}_$i.log 2>&1 & pids+=($!)
  pnpm -s open:rr $common --guide-drop molten_rain,terrain_collapse --shard $i/5 --out $d/base-s${1:-91}_$i.json > $d/base-s${1:-91}_$i.log 2>&1 & pids+=($!)
done
fail=0; for p in $pids; do wait $p || fail=1; done
(( fail )) && { echo "LDROW FAILED"; tail -3 $d/*.log; exit 1; }
python3 analysis/s73/swap-read.py warband "open:warband landdeck row (2 Molten Rain, 2 Terrain Collapse when landdeck) seed ${1:-91}" $d/base-s${1:-91} $d/row-s${1:-91} | tee $d/row-s${1:-91}.txt
echo "LDROW DONE"
