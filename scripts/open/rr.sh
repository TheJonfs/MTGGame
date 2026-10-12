#!/bin/zsh
# rr.sh tag games [open:rr args…] — a round-robin (or, with --matches N, the match tables) on N shards in parallel;
# the raw shard files are kept as <scratch>/rr/<tag>_<i>.json. RR_SHARDS (default 8) sets N; OPEN_SCRATCH the
# scratch directory (default analysis/runs/scratch, which git ignores).
#   scripts/open/rr.sh rec 100                       # game one, every pairing
#   scripts/open/rr.sh m 100 --matches 60 --seed 91  # matches
# then: pnpm open:rr --merge <scratch>/rr/rec_?.json --out analysis/runs/rr.json
#       pnpm open:rr --matches-report <scratch>/rr/m_?.json --record --out analysis/runs/matches.md
# open:rr reads the FIRST occurrence of a flag, so your arguments go first: a --seed of yours wins over the default 56.
# (Until S61 the default came first and a passed --seed was silently ignored — every "seed 91" table was seed 56.)
# A TAG IS USED ONCE: shard files left under the same tag by an older run with more shards are merged in with the new
# ones (post-S60: two stale files in a table of record). This script refuses a tag that already has files.
tag=$1; games=$2; shift 2
ROOT=${0:A:h}/../..
S=${OPEN_SCRATCH:-$ROOT/analysis/runs/scratch}
N=${RR_SHARDS:-8}
mkdir -p $S/rr; cd $ROOT
if [[ -n "$(ls $S/rr 2>/dev/null | grep "^${tag}_[0-9]*\.json$")" ]]; then echo "rr.sh: the tag $tag already has shard files in $S/rr — use a new tag or remove them"; exit 1; fi
for i in $(seq 0 $((N-1))); do pnpm -s open:rr "$@" --games $games --seed 56 --shard $i/$N --out $S/rr/${tag}_$i.json > /dev/null 2>&1 & done
wait
echo "done $tag"
