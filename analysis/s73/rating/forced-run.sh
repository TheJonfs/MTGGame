#!/bin/zsh
# S73 Part 2 (concern 54): the forced-inclusion runs for the fourteen carried Limited cards, on the current pilot.
# Sealed: 200 pools, ten decks a card seeded (140 of the 200), the sealed176 run's shape. Draft: 300 pods, seat 0 seeded.
cd /Users/christopherjones/MTGGame
F=altar_of_dementia,curiosity,demonic_tutor,disenchant,duress,entomb,giant_growth,orcish_lumberjack,ovna_the_enchantress,scepter_of_dominance,the_bailiff,the_pearl_cleric,waste_not,zinnia_the_undertow
LOG=analysis/s73/rating/forced-run.log; : > $LOG
job() { local name=$1 n=$2; shift 2; local pids=()
  for i in $(seq 0 $((n-1))); do "$@" --shard $i/$n --out analysis/runs/${name}_shard$i.json > analysis/runs/${name}_shard$i.log 2>&1 & pids+=($!); done
  wait $pids; echo "$(date +%T) $name done ($(ls analysis/runs/${name}_shard*.json 2>/dev/null | wc -l | tr -d ' ')/$n shards)" >> $LOG }
job forced176 9 pnpm -s sealed-sim --pools 200 --games 10 --opponents 20 --seed 17673 --set plane --recipe classic --force $F --force-decks 10
job fdraft176 9 pnpm -s draft-cards --pods 300 --games 4 --seed 17673 --set plane --recipe classic --force $F
echo "$(date +%T) ALLDONE" >> $LOG
