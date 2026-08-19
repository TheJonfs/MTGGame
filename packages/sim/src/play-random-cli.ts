import { fileURLToPath } from "node:url";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { loadCardPool } from "@shandalar/cards";
import { runPairingMatch, matchSpec, savedGame } from "./fuzz.js";
import type { DeckKey } from "./slice-decks.js";

function argOf(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i !== -1 ? process.argv[i + 1] : undefined;
}

const seed = Number(argOf("seed") ?? 1);
const decks = (argOf("decks") ?? "A,B").split(",") as [DeckKey, DeckKey];
const save = argOf("save") ?? `results/game-${decks[0]}-${decks[1]}-${seed}.json`;

const cardsDir = join(dirname(fileURLToPath(import.meta.url)), "../../../data/cards");
const pool = loadCardPool(cardsDir);
const result = await runPairingMatch(pool.cards, seed, decks[0], decks[1]);
writeFileSync(save, savedGame(matchSpec(seed, decks[0], decks[1]), result));
console.log(`${decks[0]} vs ${decks[1]} seed ${seed}: winner ${result.winner ?? "draw"} (${result.reason}, ${result.turns} turns)`);
console.log(save);
