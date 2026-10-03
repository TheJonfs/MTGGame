/**
 * Post-S53 (Chris: "promote all the token arts to portraits for the Convocation to draw from"): the tokens' square
 * originals (assets/images/token-NAME/canonical.png → /portraits/token-NAME.png) join the Convocation's faces beside the
 * world catalog's opponents — the overworld's encounter roster is untouched. Colours from each token's def, for the
 * face-by-colour pick. Generated with the copy; regenerate it the same way when a token gains art.
 */
export const TOKEN_FACES: readonly { portrait: string; colors: string }[] = [
  { portrait: "token-bear", colors: "G" }, // Bear Token (bear_2_2)
  { portrait: "token-beast", colors: "G" }, // Beast Token (beast_4_4_g)
  { portrait: "token-bird", colors: "W" }, // Bird Token (bird_1_1_flying)
  { portrait: "token-elemental", colors: "G" }, // Elemental Token (elemental_5_3_g)
  { portrait: "token-elemental-red", colors: "R" }, // Elemental Token (elemental_1_1_r)
  { portrait: "token-faerie", colors: "U" }, // Faerie Token (faerie_1_1_u)
  { portrait: "token-faerie-rogue", colors: "B" }, // Faerie Rogue Token (faerie_rogue_1_1_flying)
  { portrait: "token-goblin", colors: "R" }, // Goblin Token (goblin_1_1)
  { portrait: "token-saproling", colors: "G" }, // Saproling Token (saproling_1_1_g)
  { portrait: "token-snake-green", colors: "G" }, // Snake Token (snake_1_1_g)
  { portrait: "token-soldier", colors: "W" }, // Soldier Token (soldier_1_1)
  { portrait: "token-sphinx", colors: "WU" }, // Sphinx Token (sphinx_4_4_wu)
  { portrait: "token-spirit-white", colors: "W" }, // Spirit Token (spirit_1_1_w_flying)
  { portrait: "token-weird", colors: "UR" }, // Weird Token (weird_x_x_ur)
  { portrait: "token-wurm", colors: "G" }, // Wurm Token (wurm_4_4)
  { portrait: "token-zombie", colors: "B" }, // Zombie Token (zombie_2_2)
];
