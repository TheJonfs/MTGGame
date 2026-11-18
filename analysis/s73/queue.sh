#!/bin/zsh
# S73 Part 1 — a batch of trial rows, one after another: zsh analysis/s73/queue.sh <batch-file> [seed]
# Each line: <format> <list> <tag> <swap>. Results append to analysis/s73/audit/results-s<seed>.txt.
seed=${2:-91}
while read -r fmt list tag swap; do
  [[ -z "$fmt" || "$fmt" == \#* ]] && continue
  zsh analysis/s73/trial.sh $fmt $list $tag "$swap" $seed 160 > analysis/s73/audit/_last.log 2>&1
  if grep -q "TRIAL DONE" analysis/s73/audit/_last.log; then cat analysis/s73/audit/${fmt}-${list}/${tag}-s${seed}.txt >> analysis/s73/audit/results-s${seed}.txt; echo >> analysis/s73/audit/results-s${seed}.txt
  else echo "## FAILED ${fmt}:${list} ${tag} (${swap})" >> analysis/s73/audit/results-s${seed}.txt; tail -5 analysis/s73/audit/${fmt}-${list}/${tag}-s${seed}_0.log >> analysis/s73/audit/results-s${seed}.txt; fi
done < $1
echo "BATCH DONE $1"
