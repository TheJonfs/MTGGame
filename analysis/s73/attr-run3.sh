#!/bin/zsh
# S73a Part 5: the lists the run of record moved eight points or more with no list change of their own and no audit
# base arm — the pilot as it stands; books 170–176 and moxkeep off; the v1.4 ratings; both.
BOOKS=tapmill,fightwait,landburn,scaledburn,burstaim,burstpay,exchangestatic,doubleaim,nyxsize,heldback,orderfind,moxkeep
R=analysis/s73/card-rating-v1.4.json
for fl in "peasant elder" "sultai auras" "jund bfh" "jund reaper" "jund auras" "temur temurcontrol" "mardu roll"; do
  f=${fl% *}; l=${fl#* }
  zsh analysis/s73/attr.sh $f $l base &
  zsh analysis/s73/attr.sh $f $l books-off --off $BOOKS & wait
  zsh analysis/s73/attr.sh $f $l v14 --rating $R &
  zsh analysis/s73/attr.sh $f $l both --off $BOOKS --rating $R & wait
  echo "$(date +%T) $f:$l done"
done
echo ROUND3-DONE
