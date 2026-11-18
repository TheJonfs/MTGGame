#!/bin/zsh
cd /Users/christopherjones/MTGGame
LOG=analysis/s72/rating-rebuild.log
until grep -q "^written:" analysis/s72/peasant-rating.log 2>/dev/null; do
  if grep -qE "^(Error|TypeError|RangeError)|    at " analysis/s72/peasant-rating.log 2>/dev/null; then echo "peasant run failed; stopping" >> $LOG; exit 1; fi
  sleep 20
done
echo "$(date +%T) peasant written; starting" >> $LOG
job() { # name n cmd...
  local name=$1 n=$2; shift 2
  local pids=()
  for i in $(seq 0 $((n-1))); do
    "$@" --shard $i/$n --out analysis/runs/${name}_shard$i.json > analysis/runs/${name}_shard$i.log 2>&1 &
    pids+=($!)
  done
  wait $pids
  local got=$(ls analysis/runs/${name}_shard*.json 2>/dev/null | wc -l | tr -d ' ')
  echo "$(date +%T) $name done ($got/$n shards)" >> $LOG
}
job authored176 9 pnpm -s rating:run --offsets 20 --games 6 --seed 47
job sealed176 6 pnpm -s sealed-sim --pools 200 --games 10 --opponents 20 --seed 176 --set plane --recipe classic
job noise176 6 pnpm -s sealed-sim --pools 200 --games 10 --opponents 20 --seed 17601 --set plane --recipe classic --noise 0.4
job draft176 9 pnpm -s draft-cards --pods 300 --games 4 --seed 176 --set plane --recipe classic
echo "$(date +%T) ALLDONE" >> $LOG
