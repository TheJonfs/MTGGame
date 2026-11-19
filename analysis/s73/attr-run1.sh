#!/bin/zsh
# S73a Part 1, round one: for each list that left its record — the pilot as it stands; books 170–176 and moxkeep off;
# the v1.4 ratings; and both (the table of record's conditions).
BOOKS=tapmill,fightwait,landburn,scaledburn,burstaim,burstpay,exchangestatic,doubleaim,nyxsize,heldback,orderfind,moxkeep
R=analysis/s73/card-rating-v1.4.json
for fl in "nothing-dear undertow" "open levy" "bodies stampede" "nothing-dear levy" "abzan warden" "mardu burn" "naya lifegain" "naya wurms" "temur wurmspeaker"; do
  f=${fl% *}; l=${fl#* }
  zsh analysis/s73/attr.sh $f $l base &
  zsh analysis/s73/attr.sh $f $l books-off --off $BOOKS & wait
  zsh analysis/s73/attr.sh $f $l v14 --rating $R &
  zsh analysis/s73/attr.sh $f $l both --off $BOOKS --rating $R & wait
  echo "$(date +%T) $f:$l done"
done
echo ROUND1-DONE
