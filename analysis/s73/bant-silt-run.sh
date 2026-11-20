#!/bin/zsh
# Post-S73a (2026-11-20): Bant with Chris's Bant Silt registered (twelve lists) — the table of record re-run on pilot 183:
# 100 game ones and 60 matches a pairing, seed 91, as record2-run.sh ran it.
export OPEN_SCRATCH=analysis/s73/bant-silt
f=bant
zsh scripts/open/rr.sh $f-g1 100 --format $f --seed 91
zsh scripts/open/rr.sh $f-m 100 --format $f --matches 60 --seed 91
pnpm -s open:rr --format $f --merge analysis/s73/bant-silt/rr/$f-g1_?.json --record --out analysis/s73/bant-silt/$f-rr.json > analysis/s73/bant-silt/$f-rr.txt 2>&1
pnpm -s open:rr --format $f --matches-report analysis/s73/bant-silt/rr/$f-m_?.json --record --out analysis/s73/bant-silt/$f-matches.md > analysis/s73/bant-silt/$f-matches.txt 2>&1
echo "$(date +%T) RECORD-DONE"
