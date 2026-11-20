#!/bin/zsh
# Book 184 (endtap): the suite, the ladder alone, then Bant Silt against the Bant field with the book on and off
# (160 game ones a pairing, seed 91, the same seeds both arms).
pnpm test > analysis/s73/test-book184.log 2>&1
pnpm ladder > analysis/s73/ladder-book184.log 2>&1
export OPEN_SCRATCH=analysis/s73/book184
zsh scripts/open/rr.sh silt-on 160 --format bant --only silt --seed 91
zsh scripts/open/rr.sh silt-off 160 --format bant --only silt --seed 91 --off endtap --off-for silt
echo "$(date +%T) BOOK184-DONE"
