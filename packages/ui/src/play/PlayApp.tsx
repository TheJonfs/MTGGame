import { useMemo, useState } from "react";
import type { PlayerId } from "@shandalar/engine";
import type { Difficulty } from "@shandalar/agents";
import { DECKS, DECK_ARCHETYPES, type DeckKey } from "@shandalar/sim/decks";
import { EXPANSION_DECKS } from "@shandalar/sim/expansion-decks";
import { loadOracle, loadPool, type OracleEntry, type SavedGame } from "../engine-bridge";
import { MatchController } from "./match-controller";
import { PlayMatch, loadStops } from "./PlayMatch";
import { cardName } from "../labels";

/**
 * Match shell (S10 Part 3, ADR-058): setup → play → end screen, with
 * watch-replay (the viewer route consumes the produced log), rematch on the
 * same seed, and download of the saved game.
 */

/** S18: /play offers the slice decks A–E and the beast decks (beast:<key>) so the S17 cards
 * (Channeler, Bouncer, Grenade …) can be played by hand in the director round. */
type PlayDeck = DeckKey | `beast:${string}`;
const PLAY_DECKS: { key: PlayDeck; label: string }[] = [
  ...(Object.keys(DECKS) as DeckKey[]).map((k) => ({ key: k as PlayDeck, label: `${k} · ${DECKS[k].name}` })),
  ...Object.entries(EXPANSION_DECKS).map(([k, v]) => ({ key: `beast:${k}` as PlayDeck, label: `${v.name} (${v.color} ${v.tier})` })),
];
function playDeck(key: PlayDeck): { name: string; decklist: { cardId: string; count: number }[]; archetype: "aggro" | "midrange" | "control" } {
  if (key.startsWith("beast:")) { const b = EXPANSION_DECKS[key.slice(6)]!; return { name: b.name, decklist: b.decklist.map((e) => ({ ...e })), archetype: b.archetype }; }
  const k = key as DeckKey;
  return { name: DECKS[k].name, decklist: DECKS[k].decklist.map((e) => ({ ...e })), archetype: DECK_ARCHETYPES[k] };
}

interface Setup {
  humanDeck: PlayDeck;
  aiDeck: PlayDeck;
  difficulty: Difficulty;
  humanSeat: PlayerId;
  seed: string; // empty = random
}

const DIFFICULTIES: Difficulty[] = ["apprentice", "journeyman", "master"];

function DeckPicker({ label, value, onChange }: { label: string; value: PlayDeck; onChange: (d: PlayDeck) => void }) {
  return (
    <div className="deck-picker">
      <div className="flyout-title">{label}</div>
      {PLAY_DECKS.map(({ key, label: text }, i) => (
        <label key={key} className={value === key ? "picked" : ""} style={i === 5 ? { marginTop: 6, borderTop: "1px solid var(--ink-soft)", paddingTop: 4 } : undefined}>
          <input type="radio" checked={value === key} onChange={() => onChange(key)} /> {text}
        </label>
      ))}
    </div>
  );
}

function SetupScreen({ onStart }: { onStart: (s: Setup) => void }) {
  const [setup, setSetup] = useState<Setup>({
    humanDeck: "A",
    aiDeck: "D",
    difficulty: "journeyman",
    humanSeat: 0,
    seed: "",
  });
  return (
    <div className="loader">
      <div className="box play-setup">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>New Match</h2>
        <div style={{ display: "flex", gap: 24, textAlign: "left", justifyContent: "center" }}>
          <DeckPicker label="Your deck" value={setup.humanDeck} onChange={(d) => setSetup({ ...setup, humanDeck: d })} />
          <DeckPicker label="Opponent deck" value={setup.aiDeck} onChange={(d) => setSetup({ ...setup, aiDeck: d })} />
          <div className="deck-picker">
            <div className="flyout-title">Opponent</div>
            {DIFFICULTIES.map((d) => (
              <label key={d} className={setup.difficulty === d ? "picked" : ""}>
                <input type="radio" checked={setup.difficulty === d} onChange={() => setSetup({ ...setup, difficulty: d })} /> {d}
              </label>
            ))}
            <div className="flyout-title" style={{ marginTop: 8 }}>You play</div>
            {([0, 1] as PlayerId[]).map((s) => (
              <label key={s} className={setup.humanSeat === s ? "picked" : ""}>
                <input type="radio" checked={setup.humanSeat === s} onChange={() => setSetup({ ...setup, humanSeat: s })} />{" "}
                {s === 0 ? "first (on the play)" : "second (on the draw)"}
              </label>
            ))}
            <div className="flyout-title" style={{ marginTop: 8 }}>Seed</div>
            <input
              type="text"
              placeholder="random"
              value={setup.seed}
              onChange={(e) => setSetup({ ...setup, seed: e.target.value })}
              style={{ width: 90 }}
            />
          </div>
        </div>
        <p>
          <button className="primary" onClick={() => onStart(setup)}>Start match</button>{" "}
          <a className="linkish" href="/">⟵ main menu</a> <a className="linkish" href="/viewer">viewer</a> <a className="linkish" href="/gallery">gallery</a>
        </p>
      </div>
    </div>
  );
}

function EndScreen({
  c,
  pool,
  onRematch,
  onNew,
  onWatch,
}: {
  c: MatchController;
  pool: Map<string, import("@shandalar/cards").CardDef>;
  onRematch: () => void;
  onNew: () => void;
  onWatch: () => void;
}) {
  const r = c.result!;
  const you = c.humanSeat;
  const won = r.winner === you;
  const topSpells = Object.entries(r.facts.spellsCast)
    .map(([cardId, counts]) => ({ cardId, you: counts[you], them: counts[you === 0 ? 1 : 0] }))
    .filter((s) => s.you + s.them > 0)
    .sort((a, b) => b.you + b.them - (a.you + a.them))
    .slice(0, 6);
  const download = () => {
    const blob = new Blob([c.savedGame()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `game-${c.seed}.json`;
    a.click();
  };
  return (
    <div className="loader">
      <div className="box play-setup">
        <h2 style={{ fontFamily: "var(--serif)", marginTop: 0 }}>
          {r.winner === null ? "Draw" : won ? "Victory" : "Defeat"}
        </h2>
        <p style={{ fontSize: 12 }}>
          {r.reason === "CONCEDE" ? "By concession" : r.reason === "LIFE" ? "By damage" : r.reason.toLowerCase()} ·{" "}
          turn {r.turns} · life {r.finalLife[you]}–{r.finalLife[you === 0 ? 1 : 0]} · seed {c.seed}
        </p>
        <table className="end-stats">
          <thead>
            <tr><th></th><th>You</th><th>Opponent</th></tr>
          </thead>
          <tbody>
            <tr><td>Damage dealt</td><td>{r.facts.damageDealt[you]}</td><td>{r.facts.damageDealt[you === 0 ? 1 : 0]}</td></tr>
            <tr><td>Cards drawn</td><td>{r.facts.cardsDrawn[you]}</td><td>{r.facts.cardsDrawn[you === 0 ? 1 : 0]}</td></tr>
            <tr><td>Creatures lost</td><td>{r.facts.creaturesLost[you]}</td><td>{r.facts.creaturesLost[you === 0 ? 1 : 0]}</td></tr>
            {topSpells.map((s) => (
              <tr key={s.cardId}><td>{cardName(pool, s.cardId)}</td><td>{s.you}</td><td>{s.them}</td></tr>
            ))}
          </tbody>
        </table>
        <p>
          <button className="primary" onClick={onWatch}>Watch replay</button>{" "}
          <button onClick={onRematch}>Rematch (same seed)</button>{" "}
          <button onClick={onNew}>New match</button>{" "}
          <button className="linkish" onClick={download}>download log</button>
        </p>
      </div>
    </div>
  );
}

export function PlayApp({ onWatchReplay }: { onWatchReplay: (game: SavedGame) => void }) {
  const pool = useMemo(loadPool, []);
  const [oracle, setOracle] = useState<Record<string, OracleEntry>>({});
  const [screen, setScreen] = useState<"setup" | "match" | "end">("setup");
  const [controller, setController] = useState<MatchController | null>(null);
  const [lastSetup, setLastSetup] = useState<Setup | null>(null);

  useMemo(() => {
    loadOracle().then(setOracle);
  }, []);

  const begin = (setup: Setup, seedOverride?: number) => {
    const seed = seedOverride ?? (setup.seed.trim() !== "" ? Number(setup.seed) : undefined);
    const human = playDeck(setup.humanDeck), enemy = playDeck(setup.aiDeck);
    const c = new MatchController(pool, {
      humanSeat: setup.humanSeat,
      // S18: always the explicit-spec path so beast decks and slice decks mix freely (rules as the old slice-deck form: 20 life, no ante).
      custom: { human: { name: "You", decklist: human.decklist }, enemy: { name: enemy.name, decklist: enemy.decklist, difficulty: setup.difficulty, archetype: enemy.archetype }, rules: { startingLife: 20, ante: 0 }, modifiers: [] },
      ...(seed !== undefined && Number.isFinite(seed) ? { seed } : {}),
      aiDelayMs: Number(localStorage.getItem("shandalar-ai-delay") ?? 400),
    });
    c.stops = loadStops();
    setLastSetup(setup);
    setController(c);
    setScreen("match");
    void c.start();
  };

  if (screen === "setup" || !controller) return <SetupScreen onStart={begin} />;
  if (screen === "match") {
    return (
      <PlayMatch
        c={controller}
        pool={pool}
        oracle={oracle}
        onGameOver={() => setScreen("end")}
      />
    );
  }
  return (
    <EndScreen
      c={controller}
      pool={pool}
      onRematch={() => lastSetup && begin(lastSetup, controller.seed)}
      onNew={() => setScreen("setup")}
      onWatch={() => onWatchReplay(JSON.parse(controller.savedGame()) as SavedGame)}
    />
  );
}
