#!/bin/zsh
# S73a Part 1 — attribution by switching off: zsh analysis/s73/attr.sh <format> <list> <tag> [open:rr args…]
# One arm of a list against its format's field (160 matches a pairing, seed 91, five shards) under changed conditions for
# EVERY seat; `base` (no args) is the pilot and table as they stand. Read with attr-read.py against the table of record.
fmt=$1; list=$2; tag=$3; shift 3
dir=analysis/s73/attr/${fmt}-${list}; mkdir -p $dir
[[ -f $dir/$tag.done ]] && exit 0
pids=(); for i in ${=SHARDS:-0 1 2 3 4}; do pnpm -s open:rr --format $fmt --only $list --matches 160 --seed 91 --shard $i/5 --out $dir/${tag}_$i.json "$@" > $dir/${tag}_$i.log 2>&1 & pids+=($!); done
fail=0; for p in $pids; do wait $p || fail=1; done
(( fail )) && { echo "ATTR FAILED $fmt:$list $tag"; exit 1; }
touch $dir/$tag.done; echo "ATTR DONE $fmt:$list $tag"
