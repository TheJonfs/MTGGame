#!/bin/zsh
# S73a: card-rating v1.7 — the whole rebuild on pilot 177 (books 174 and 175 repaired; the Limited builder and drafter
# on castableWith). Peasant first, then the four runs (the post-S72 shapes and seeds, renamed).
cd /Users/christopherjones/MTGGame
LOG=analysis/s73/rating/rebuild-177.log; : > $LOG
pnpm -s rating:format --format peasant --write > analysis/s73/rating/peasant-177.log 2>&1
grep -q "^written:" analysis/s73/rating/peasant-177.log || { echo "peasant failed" >> $LOG; exit 1; }
echo "$(date +%T) peasant written" >> $LOG
job() { local name=$1 n=$2; shift 2; local pids=()
  for i in $(seq 0 $((n-1))); do "$@" --shard $i/$n --out analysis/runs/${name}_shard$i.json > analysis/runs/${name}_shard$i.log 2>&1 & pids+=($!); done
  wait $pids; echo "$(date +%T) $name done ($(ls analysis/runs/${name}_shard*.json 2>/dev/null | wc -l | tr -d ' ')/$n shards)" >> $LOG }
job authored177 9 pnpm -s rating:run --offsets 20 --games 6 --seed 47
job sealed177 6 pnpm -s sealed-sim --pools 200 --games 10 --opponents 20 --seed 176 --set plane --recipe classic
job noise177 6 pnpm -s sealed-sim --pools 200 --games 10 --opponents 20 --seed 17601 --set plane --recipe classic --noise 0.4
job draft177 9 pnpm -s draft-cards --pods 300 --games 4 --seed 176 --set plane --recipe classic
echo "$(date +%T) ALLDONE" >> $LOG
