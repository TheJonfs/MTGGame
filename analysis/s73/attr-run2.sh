#!/bin/zsh
# S73a Part 1, round two: the five lists the books moved — each book (and moxkeep) off singly. Three shards of five
# (96 matches a pairing), paired against the same matches of `base`: enough to find a ten-point book.
export SHARDS="0 1 2"
RULES=(tapmill fightwait landburn scaledburn burstaim burstpay exchangestatic doubleaim nyxsize heldback orderfind moxkeep)
for fl in "nothing-dear undertow" "open levy" "nothing-dear levy" "naya wurms" "temur wurmspeaker"; do
  f=${fl% *}; l=${fl#* }
  for a b c in $RULES; do
    for r in $a $b $c; do zsh analysis/s73/attr.sh $f $l off-$r --off $r & done; wait
  done
  echo "$(date +%T) $f:$l done"
done
echo ROUND2-DONE
