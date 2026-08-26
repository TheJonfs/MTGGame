import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { asCardDef, validateCard } from "./validate.js";
import type { CardDef } from "./types.js";

export interface CardPool {
  cards: Map<string, CardDef>;
  warnings: string[];
}

export class CardLoadError extends Error {
  constructor(readonly errors: string[]) {
    super(`Card validation failed:\n${errors.join("\n")}`);
    this.name = "CardLoadError";
  }
}

/** Load and validate every *.json card in a directory (and its tokens/ subdir if present). */
export function loadCardPool(dir: string): CardPool {
  const cards = new Map<string, CardDef>();
  const errors: string[] = [];
  const warnings: string[] = [];

  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.isFile() && entry.name.endsWith(".json")) files.push(join(dir, entry.name));
    // tokens/ since S4; laws/ since S22b (the stronghold laws — uncastable battlefield furniture).
    if (entry.isDirectory() && (entry.name === "tokens" || entry.name === "laws")) {
      for (const t of readdirSync(join(dir, entry.name))) {
        if (t.endsWith(".json")) files.push(join(dir, entry.name, t));
      }
    }
  }
  files.sort(); // deterministic load order

  for (const file of files) {
    let raw: unknown;
    try {
      raw = JSON.parse(readFileSync(file, "utf8"));
    } catch (e) {
      errors.push(`${file}: invalid JSON (${(e as Error).message})`);
      continue;
    }
    const result = validateCard(raw);
    errors.push(...result.errors);
    warnings.push(...result.warnings);
    if (result.errors.length === 0) {
      const card = asCardDef(raw);
      if (cards.has(card.id)) errors.push(`${card.id}: duplicate card id`);
      else cards.set(card.id, card);
    }
  }

  if (errors.length > 0) throw new CardLoadError(errors);
  return { cards, warnings };
}
