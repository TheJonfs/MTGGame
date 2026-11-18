#!/bin/zsh
# S73 Part 1 — one paired trial row: zsh analysis/s73/trial.sh <format> <list> <tag> '<from:n:to[;from:n:to]>' [seed] [matches]
# The base arm (the list as registered) is run once per format/list/seed and reused by every swap of that list.
# Five shards an arm. Never edit source or run tests while this runs (the sims import the live tree).
set -u
fmt=$1; list=$2; tag=$3; swap=$4; seed=${5:-91}; n=${6:-160}
# AUDIT_SUFFIX: a second set of arms for the same list under changed code (the concern-59 re-runs use -fix59)
dir=analysis/s73/audit/${fmt}-${list}${AUDIT_SUFFIX:-}; mkdir -p $dir
base=$dir/base-s${seed}; arm=$dir/${tag}-s${seed}
pids=()
if [[ ! -f ${base}.done ]]; then
  for i in 0 1 2 3 4; do pnpm -s open:rr --format $fmt --only $list --matches $n --seed $seed --shard $i/5 --out ${base}_$i.json > ${base}_$i.log 2>&1 & pids+=($!); done
fi
if [[ ! -f ${arm}.done ]]; then
  for i in 0 1 2 3 4; do pnpm -s open:rr --format $fmt --only $list --swap "${list}:${swap}" --matches $n --seed $seed --shard $i/5 --out ${arm}_$i.json > ${arm}_$i.log 2>&1 & pids+=($!); done
fi
fail=0; for p in $pids; do wait $p || fail=1; done
if (( fail )); then echo "TRIAL FAILED ${fmt}:${list} ${tag}"; grep -lE '^(Error|TypeError|RangeError)|    at ' $dir/*.log; exit 1; fi
touch ${base}.done ${arm}.done
python3 analysis/s73/swap-read.py $list "${fmt}:${list} ${tag} (${swap}) seed ${seed}" ${base} ${arm} | tee ${arm}.txt
echo "TRIAL DONE ${fmt}:${list} ${tag}"
