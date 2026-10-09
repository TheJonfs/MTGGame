import { useMemo, useState } from "react";
import { devMenuEnabled } from "../dev";
import { DevSetup, type DevMatch } from "./DevSetup";
import { SetupScreen, type PlaySetup } from "./SetupScreen";
import { loadOracle, loadPool, type OracleEntry, type SavedGame } from "../engine-bridge";
import { MatchController } from "./match-controller";
import { PlayMatch, loadStops } from "./PlayMatch";
import { cardName } from "../labels";

/**
 * Match shell (S10 Part 3, ADR-058): setup → play → end screen, with
 * watch-replay (the viewer route consumes the produced log), rematch on the
 * same seed, and download of the saved game.
 */

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
  const [lastSetup, setLastSetup] = useState<PlaySetup | null>(null);
  const [dev, setDev] = useState(false); // post-S58: the dev setup is a link from the setup, not the default

  useMemo(() => {
    loadOracle().then(setOracle);
  }, []);

  // S34 director round: the dev setup hands a finished custom spec (the Lab's dials) straight to the controller.
  const [lastDev, setLastDev] = useState<DevMatch | null>(null);
  const beginDev = (m: DevMatch, seedOverride?: number) => {
    const c = new MatchController(pool, {
      humanSeat: m.humanSeat,
      custom: m.custom,
      ...((seedOverride ?? m.seed) !== undefined ? { seed: (seedOverride ?? m.seed)! } : {}),
      aiDelayMs: Number(localStorage.getItem("shandalar-ai-delay") ?? 400),
    });
    c.stops = loadStops();
    setLastDev(m); setLastSetup(null);
    setController(c);
    setScreen("match");
    void c.start();
  };
  const begin = (setup: PlaySetup, seedOverride?: number) => {
    const seed = seedOverride ?? (setup.seed.trim() !== "" ? Number(setup.seed) : undefined);
    const { human, enemy } = setup;
    const c = new MatchController(pool, {
      humanSeat: setup.humanSeat,
      // S18: always the explicit-spec path (20 life, no ante), whatever the two decks are
      custom: { human: { name: `You · ${human.name}`, decklist: human.decklist.map((e) => ({ ...e })) }, enemy: { name: enemy.name, decklist: enemy.decklist.map((e) => ({ ...e })), difficulty: setup.difficulty, archetype: enemy.archetype, ...(enemy.portrait ? { portrait: enemy.portrait } : {}) }, rules: { startingLife: 20, ante: 0 }, modifiers: [] },
      ...(seed !== undefined && Number.isFinite(seed) ? { seed } : {}),
      aiDelayMs: Number(localStorage.getItem("shandalar-ai-delay") ?? 400),
    });
    c.stops = loadStops();
    setLastSetup(setup); setLastDev(null);
    setController(c);
    setScreen("match");
    void c.start();
  };

  if (screen === "setup" || !controller) return dev && devMenuEnabled() ? <DevSetup pool={pool} onStart={beginDev} /> : <SetupScreen pool={pool} oracle={oracle} onStart={(s) => begin(s)} {...(devMenuEnabled() ? { onDev: () => setDev(true) } : {})} />;
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
      onRematch={() => (lastDev ? beginDev(lastDev, controller.seed) : lastSetup && begin(lastSetup, controller.seed))}
      onNew={() => setScreen("setup")}
      onWatch={() => onWatchReplay(JSON.parse(controller.savedGame()) as SavedGame)}
    />
  );
}
