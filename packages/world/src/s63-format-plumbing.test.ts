import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { FIELD_FORMAT_IDS } from "./formats.js";
import { formatReferenceText } from "./open-reference-build.js";
import { FORMAT_STRENGTH, OPEN_MATCH_MEANS, OPEN_MEANS } from "./open-matches.generated.js";
import { openStrength } from "./constructed-builder.js";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "../../..");
const json = <T>(f: string) => JSON.parse(readFileSync(join(ROOT, f), "utf8")) as T;

describe("S63 Part 2 — the formats' plumbing", () => {
  it("the game-one means are generated from each format's means.json, and a list's strength is its match rate where recorded, else its game one (run `pnpm open:gen` after `open:rr --merge … --record`)", () => {
    const want: Record<string, number> = {};
    for (const id of FIELD_FORMAT_IDS) for (const [k, v] of Object.entries(json<{ byList: Record<string, number> }>(`data/convocation/formats/${id}/means.json`).byList)) want[`${id}:${k}`] = v;
    expect(OPEN_MEANS).toEqual(want);
    for (const k of Object.keys(want)) expect(openStrength(k), k).toBe(OPEN_MATCH_MEANS[k] ?? want[k]);
    expect(FORMAT_STRENGTH["peasant:elder"]).toBe(OPEN_MATCH_MEANS["peasant:elder"]);
  });
  it("every format with a field of its own but the Open has docs/reference/<id>-lists.md, in sync with its sources (run `pnpm open:gen`)", () => {
    for (const id of FIELD_FORMAT_IDS.filter((f) => f !== "open")) expect(readFileSync(join(ROOT, `docs/reference/${id}-lists.md`), "utf8"), id).toBe(formatReferenceText(ROOT, id));
  });
});
