#!/bin/zsh
# S73a (v1.7): the forced-inclusion runs for the 36 cards the pilot-177 Limited runs saw under 100 times.
# Sealed: 400 pools, ten decks a card seeded (360 of the 400). Draft: 700 pods, seat 0 seeded (about nineteen pods a card).
cd /Users/christopherjones/MTGGame
F=aetherbolt,altar_of_dementia,barren_moor,burnfallow_exuberant,curiosity,demonic_tutor,dungrove_elder,entomb,forgotten_cave,highland_ritual,library_of_alexandria,lonely_sandbar,manaba,molten_rain,odile_the_tallyflame,ovna_the_enchantress,sacred_helix,sapwell_dryad,secluded_steppe,taiga,the_bailiff,the_dredger,the_fordkeeper,the_pearl_cleric,the_reaper,the_reeve,the_stoker,the_unwinder,the_usher,thought_replacement,tormods_crypt,tranquil_thicket,valakut_the_molten_pinnacle,voracious_cobra,wall_of_razors,waste_not
LOG=analysis/s73/rating/forced-run-177.log; : > $LOG
job() { local name=$1 n=$2; shift 2; local pids=()
  for i in $(seq 0 $((n-1))); do "$@" --shard $i/$n --out analysis/runs/${name}_shard$i.json > analysis/runs/${name}_shard$i.log 2>&1 & pids+=($!); done
  wait $pids; echo "$(date +%T) $name done ($(ls analysis/runs/${name}_shard*.json 2>/dev/null | wc -l | tr -d ' ')/$n shards)" >> $LOG }
job forced177 9 pnpm -s sealed-sim --pools 400 --games 10 --opponents 20 --seed 17773 --set plane --recipe classic --force $F --force-decks 10
job fdraft177 9 pnpm -s draft-cards --pods 700 --games 4 --seed 17773 --set plane --recipe classic --force $F
echo "$(date +%T) ALLDONE" >> $LOG
