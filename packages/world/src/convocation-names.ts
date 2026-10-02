/**
 * Post-S52 (Chris): the Convocation's name pool. The planner's sixteen (S49) stand first; past them a builder
 * composes names in the same register from a given-name list and a family-name list (and, sparingly, "of the …"
 * bynames) — enough for a field of thirty-one today and the hundred-odd the full Convocation will seat. The order is
 * fixed (an event shuffles it by its own seed); no name repeats; none is a mage's, a lord's or a legend's.
 */
export const PLANNER_NAMES: readonly string[] = ["Hesper Lune", "Tamsin Vell", "Orrin Blackquill", "Ilse Marrowgate", "Cassian Dray", "Nerys Fallow", "Dathan Mire", "Perpetua Ash", "Wyn Cordovan", "Sabel Thorne", "Ignatius Reed", "Mora Tideswell", "Corvin Hale", "Lirael Stane", "Osric Fenn", "Ysolt Garrow"];

const GIVEN = ["Aldous", "Benna", "Caro", "Dorrit", "Emeric", "Finola", "Garran", "Halla", "Ivo", "Jessamy", "Kester", "Linnet", "Maude", "Nicander", "Odalys", "Piers", "Quenby", "Rosalind", "Silas", "Tobias", "Ulric", "Verity", "Wilmot", "Xanthe", "Yorick", "Zenna", "Ambrose", "Briar", "Cyprian", "Delphine", "Evander", "Fenwick"] as const;
const FAMILY = ["Ashgrove", "Brackwater", "Coldharrow", "Dunmere", "Eldergate", "Farrow", "Greywether", "Holloway", "Inkwell", "Jessop", "Kettleby", "Larkspur", "Mossbank", "Netherby", "Oakhollow", "Pennyroyal", "Quickthorn", "Ravensworth", "Saltmarsh", "Thistlewood", "Underhill", "Varrow", "Wintermere", "Yarrow", "Amberley", "Birchall", "Candlewick", "Drover", "Emberly", "Foxglove", "Gallowglass", "Harrowgate"] as const;
const BYNAME = ["of the Weir", "of the Low Road", "of the Salt Stair", "of the Ninth Bell", "of the Fen Gate", "of the Tithe Barn", "of the Long Field", "of the Lantern Quay"] as const;
/** Names the plane already uses (the mages' and the placeholders' given names) — never generated. */
const TAKEN = new Set(["Brann", "Kessa", "Varro", "Oriel", "Maelin", "Sorrel", "Hask", "Brennor", "Ysolde", "Edric", "Vael", "Corvane", "Tessaly", "Pell", "Quill", ...PLANNER_NAMES.map((n) => n.split(" ")[0]!)]);

/** The first `count` names of the pool: the planner's sixteen, then the builder's — given × family walked on coprime
 * strides so neither list runs in order, every seventh a byname in place of a family name. Deterministic. */
export function convocationNames(count: number): string[] {
  const out = [...PLANNER_NAMES], seen = new Set<string>(out);
  const given = GIVEN.filter((g) => !TAKEN.has(g));
  for (let i = 0; out.length < count && i < given.length * FAMILY.length; i++) {
    const g = given[(i * 7) % given.length]!, f = FAMILY[(i * 11 + Math.floor(i / given.length) * 5) % FAMILY.length]!;
    const name = i % 7 === 6 ? `${g} ${BYNAME[Math.floor(i / 7) % BYNAME.length]!}` : `${g} ${f}`;
    if (seen.has(name)) continue;
    seen.add(name); out.push(name);
  }
  if (out.length < count) throw new Error(`convocationNames: the pool holds ${out.length} names, ${count} asked`);
  return out.slice(0, count);
}
