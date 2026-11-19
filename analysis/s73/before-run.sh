#!/bin/zsh
# S73a Part 3: Bodies and Nothing Dear before the grounds — Part 1's fixes and Part 2's adoptions in, ADR-201 not.
# 100 game ones and 60 matches a pairing, seed 91. Not recorded as tables of record.
export OPEN_SCRATCH=analysis/s73/before
for f in bodies nothing-dear; do
  zsh scripts/open/rr.sh $f-g1 100 --format $f --seed 91
  zsh scripts/open/rr.sh $f-m 100 --format $f --matches 60 --seed 91
  pnpm -s open:rr --format $f --merge analysis/s73/before/rr/$f-g1_?.json --out analysis/s73/before/$f-rr.json > analysis/s73/before/$f-rr.txt 2>&1
  pnpm -s open:rr --format $f --matches-report analysis/s73/before/rr/$f-m_?.json --out analysis/s73/before/$f-matches.md > analysis/s73/before/$f-matches.txt 2>&1
  echo "$(date +%T) $f done"
done
echo BEFORE-DONE
