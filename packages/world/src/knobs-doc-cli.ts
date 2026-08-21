/** pnpm knobs:doc — regenerate docs/knobs.md from the registry. */
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { renderKnobsDoc } from "./knobs-doc.js";

const out = join(dirname(fileURLToPath(import.meta.url)), "../../../docs/knobs.md");
writeFileSync(out, renderKnobsDoc());
console.log(`wrote ${out}`);
