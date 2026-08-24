import { readFileSync } from "node:fs";
import { join } from "node:path";
import { catalogFrom, type Catalog } from "./catalog.js";

/** Node-side catalog loader (fs-bound; the `./loader` subpath, like `@shandalar/cards/loader`). */
export function loadCatalog(dir: string): Catalog {
  const read = (f: string) => JSON.parse(readFileSync(join(dir, f), "utf8")) as unknown;
  return catalogFrom({ regions: read("regions.json"), towns: read("towns.json"), opponents: read("opponents.json"), starters: read("starters.json"), dungeons: read("dungeons.json") });
}
