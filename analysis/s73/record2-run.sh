#!/bin/zsh
# S73a Part 5: the run of record — every format with a field, 100 game ones and 60 matches a pairing, seed 91,
# with moxkeep, books 170–176 (as fixed in Part 1), card-rating v1.7 (the re-record after the rebuild), landdeck at six, the adoptions and the grounds.
export OPEN_SCRATCH=analysis/s73/record2
for f in bodies nothing-dear peasant naya esper mardu grixis jund jeskai sultai abzan temur bant open; do
  zsh scripts/open/rr.sh $f-g1 100 --format $f --seed 91
  zsh scripts/open/rr.sh $f-m 100 --format $f --matches 60 --seed 91
  pnpm -s open:rr --format $f --merge analysis/s73/record2/rr/$f-g1_?.json --record --out analysis/s73/record2/$f-rr.json > analysis/s73/record2/$f-rr.txt 2>&1
  pnpm -s open:rr --format $f --matches-report analysis/s73/record2/rr/$f-m_?.json --record --out analysis/s73/record2/$f-matches.md > analysis/s73/record2/$f-matches.txt 2>&1
  echo "$(date +%T) $f done"
done
echo RECORD-DONE
