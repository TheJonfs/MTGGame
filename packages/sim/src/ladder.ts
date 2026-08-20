import { loadCardPool } from "@shandalar/cards/loader";
import { PAIRINGS, type DeckKey } from "./slice-decks.js";
import { runPairingMatch, type AgentKind } from "./fuzz.js";

/**
 * M4 measurement ladder (ADR-049): per-pairing Monte Carlo win rates for a
 * challenger agent vs a baseline, BOTH seatings reported separately (seat
 * advantage is real). The ship gate reads the per-deck aggregation: the
 * challenger must win the majority of games in every deck's hands.
 */

export interface LadderCell {
  pairing: string;
  /** Seat the challenger occupied (0 = on the play first pairing order). */
  challengerSeat: 0 | 1;
  challengerDeck: DeckKey;
  games: number;
  challengerWins: number;
  draws: number;
  meanTurns: number;
}

export interface LadderReport {
  challenger: AgentKind;
  baseline: AgentKind;
  cells: LadderCell[];
  /** Mirror cells (same deck both sides): deck-neutral skill measurement. */
  mirrors: LadderCell[];
  /** Aggregated challenger record with each deck in its hands (pairing cells). */
  perDeck: Record<DeckKey, { wins: number; games: number }>;
  /** Majority in every deck's hands, aggregated over its pairing cells. */
  gateAggregate: boolean;
  /** Majority in every deck's MIRROR, both seatings — the deck-neutral gate. */
  gateMirror: boolean;
}

export async function runLadder(
  cardsDir: string,
  challenger: AgentKind,
  baseline: AgentKind,
  gamesPerCell: number,
  startSeed: number,
  onProgress?: (cell: string, i: number) => void,
): Promise<LadderReport> {
  const pool = loadCardPool(cardsDir);
  const cells: LadderCell[] = [];
  const perDeck = { A: { wins: 0, games: 0 }, B: { wins: 0, games: 0 }, C: { wins: 0, games: 0 }, D: { wins: 0, games: 0 }, E: { wins: 0, games: 0 } };

  for (const [a, b] of PAIRINGS) {
    for (const challengerSeat of [0, 1] as const) {
      const agents: [AgentKind, AgentKind] =
        challengerSeat === 0 ? [challenger, baseline] : [baseline, challenger];
      const cellSeed = startSeed + challengerSeat * 500_000;
      let wins = 0;
      let draws = 0;
      let turns = 0;
      for (let i = 0; i < gamesPerCell; i++) {
        const r = await runPairingMatch(pool.cards, cellSeed + i, a, b, agents);
        if (r.winner === challengerSeat) wins += 1;
        else if (r.winner === null) draws += 1;
        turns += r.turns;
        onProgress?.(`${a}-${b} seat${challengerSeat}`, i + 1);
      }
      const deck = challengerSeat === 0 ? a : b;
      cells.push({
        pairing: `${a}-${b}`,
        challengerSeat,
        challengerDeck: deck,
        games: gamesPerCell,
        challengerWins: wins,
        draws,
        meanTurns: turns / gamesPerCell,
      });
      perDeck[deck].wins += wins;
      perDeck[deck].games += gamesPerCell;
    }
  }

  // Mirror cells: same deck on both sides — pure agent-skill measurement.
  const mirrors: LadderCell[] = [];
  for (const d of Object.keys(perDeck) as DeckKey[]) {
    for (const challengerSeat of [0, 1] as const) {
      const agents: [AgentKind, AgentKind] =
        challengerSeat === 0 ? [challenger, baseline] : [baseline, challenger];
      const cellSeed = startSeed + 1_000_000 + challengerSeat * 500_000;
      let wins = 0;
      let draws = 0;
      let turns = 0;
      for (let i = 0; i < gamesPerCell; i++) {
        const r = await runPairingMatch(pool.cards, cellSeed + i, d, d, agents);
        if (r.winner === challengerSeat) wins += 1;
        else if (r.winner === null) draws += 1;
        turns += r.turns;
        onProgress?.(`${d}-${d} seat${challengerSeat}`, i + 1);
      }
      mirrors.push({
        pairing: `${d}-${d}`,
        challengerSeat,
        challengerDeck: d,
        games: gamesPerCell,
        challengerWins: wins,
        draws,
        meanTurns: turns / gamesPerCell,
      });
    }
  }

  const gateAggregate = (Object.keys(perDeck) as DeckKey[]).every(
    (d) => perDeck[d].wins * 2 > perDeck[d].games,
  );
  const gateMirror = mirrors.every((m) => m.challengerWins * 2 > m.games);
  return { challenger, baseline, cells, mirrors, perDeck, gateAggregate, gateMirror };
}

export function formatLadder(report: LadderReport): string {
  const lines: string[] = [];
  lines.push(`ladder: ${report.challenger} vs ${report.baseline}`);
  for (const c of report.cells) {
    const pct = ((100 * c.challengerWins) / c.games).toFixed(1);
    lines.push(
      `  ${c.pairing} seat${c.challengerSeat} (${report.challenger} plays ${c.challengerDeck}): ${c.challengerWins}/${c.games} (${pct}%), mean turns ${c.meanTurns.toFixed(1)}`,
    );
  }
  lines.push(`  mirrors (same deck both sides — deck-neutral skill):`);
  for (const c of report.mirrors) {
    const pct = ((100 * c.challengerWins) / c.games).toFixed(1);
    lines.push(`    ${c.pairing} seat${c.challengerSeat}: ${c.challengerWins}/${c.games} (${pct}%), mean turns ${c.meanTurns.toFixed(1)}`);
  }
  lines.push(`  per-deck over pairing cells (${report.challenger}'s hands):`);
  for (const [d, r] of Object.entries(report.perDeck)) {
    lines.push(`    ${d}: ${r.wins}/${r.games} (${((100 * r.wins) / r.games).toFixed(1)}%)`);
  }
  lines.push(`  gate/aggregate (majority in every deck's hands over pairings): ${report.gateAggregate ? "PASS" : "FAIL"}`);
  lines.push(`  gate/mirror (majority in every mirror, both seatings): ${report.gateMirror ? "PASS" : "FAIL"}`);
  return lines.join("\n");
}
