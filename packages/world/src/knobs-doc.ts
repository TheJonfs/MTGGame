import { DIFFICULTIES, KNOBS, KNOB_LAYERS, type KnobSpec } from "./knobs.js";

/** docs/knobs.md is GENERATED from the registry (`pnpm knobs:doc`); a test
 * asserts the file matches this output, so the doc can't drift (principle 11). */
export function renderKnobsDoc(): string {
  const lines: string[] = [];
  lines.push("# Knobs registry");
  lines.push("");
  lines.push("*Generated from `packages/world/src/knobs.ts` by `pnpm knobs:doc` — do not edit by hand; a test fails when this file is out of sync.*");
  lines.push("");
  lines.push("Every overworld tunable (manifest principle 5). Difficulty bundles, regions, dungeons, opponents, and one-off events are all just sources of knob values, merged whole-value per key in this precedence (later wins):");
  lines.push("");
  lines.push(`\`world defaults\` < ${KNOB_LAYERS.map((l) => `\`${l}\``).join(" < ")}`);
  lines.push("");
  lines.push("| knob | default | unit | description |");
  lines.push("|---|---|---|---|");
  for (const [k, spec] of Object.entries(KNOBS) as [string, KnobSpec<unknown>][]) {
    lines.push(`| \`${k}\` | \`${JSON.stringify(spec.default)}\` | ${spec.unit} | ${spec.description} |`);
  }
  lines.push("");
  lines.push("## Difficulty bundles");
  lines.push("");
  lines.push("Named knob sources (manifest §2b). Only `standard` is tuned for the slice (it is the registry defaults); `easy` and `hard` are UNTUNED placeholders awaiting slice playtesting.");
  lines.push("");
  for (const [name, src] of Object.entries(DIFFICULTIES)) {
    const entries = Object.entries(src);
    lines.push(`- **${name}**: ${entries.length === 0 ? "(defaults)" : entries.map(([k, v]) => `\`${k}\` = \`${JSON.stringify(v)}\``).join(", ")}`);
  }
  lines.push("");
  return lines.join("\n");
}
