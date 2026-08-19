# Implementer Notes

Practical notes for future implementer sessions. Owned by the implementer; append freely.

## Running things

- `pnpm install` once; Node ≥22 (Chris's machine: Node 26, pnpm 11).
- `pnpm test` — full suite including the 1,000-game fuzz test (~6s total).
- `pnpm typecheck` — strict tsc over every package (no emit).
- `pnpm fuzz --games 1000 --seed 1` — fuzzer CLI; prints terminations, mean turns, and any error with its seed for reproduction.
- Run pnpm scripts from the repo root; the vitest include globs are root-relative.

## How the monorepo is wired

- "Internal packages" pattern: each package's `exports` points at `src/index.ts`. No build step; vitest and tsx execute TS directly, and one root `tsc -p tsconfig.json` typechecks everything. A dist build only becomes necessary when the UI milestone needs bundling.
- Dependency direction is enforced by package.json deps only (`ui → agents/sim → engine → cards → core`). tsc will happily typecheck a backward import if you write one — don't.

## Architecture seams that matter

- **EffectContext** (`packages/cards/src/resolvers.ts`) is the vocabulary/engine seam. Resolvers live in `cards` and never see engine internals; `engine/src/effect-context.ts` implements the interface. Adding a vocabulary word = type + validator row + resolver + (maybe) a new EffectContext op.
- **Agent interface lives in `engine`** (`agent.ts`), not `agents` — engine calls it, and `agents` depends on `engine`. Every decision (priority, declarations, mulligan, discard, trigger targets) is a pick-one-action request, so every decision is a loggable, replayable Action.
- **Statics are computed live; resolved effects are stored.** `characteristics()` scans battlefield statics each call (Pacifism, future anthems) and merges `state.continuousEffects` (pump). Nothing about restrictions is ever stored on the object.
- **Replay feeds the log back**: ReplayRng returns logged RNG draws (asserting purpose/shape), a replay ActionSource returns logged ACTIONs (asserting the requesting player). Agent-internal randomness must NEVER go through the game's logged RNG — RandomAgent has a private PRNG for exactly this reason.

## Determinism gotchas (learned or designed around)

- Decisions with exactly one option are not requested and not logged (lone `pass`, forced empty attack declaration, single-candidate trigger targets). This is safe because it's state-derived and identical in replay — but it means "number of ACTION entries" ≠ "number of decision points."
- `Record` key order matters for byte-identical serialization only until `stableStringify` sorts keys — always compare via `stableStringify`, never raw JSON.
- Object ids are sequential per game (`obj_N`, `stk_N`); replay reproduces them because creation order is deterministic.

## Testing

- Scenario fixtures are JSON under `packages/engine/test/fixtures/`, interpreted by `test/harness.ts` (board state → script → run phases); assertions stay in the vitest cases. The script matcher consumes entries strictly in order, defaulting to pass/first-option, so fixtures read like a transcript of the interesting line of play.
- The harness clears `pendingTriggers` after setup: fixtures describe a standing board, so setup-time ETBs must not fire.
- Synthetic test-only cards (`test_fs_soldier`, `test_pinger`) live in the harness, validated through the normal validator. The slice pool has no first striker or non-mana activated ability; these keep those paths tested.

## Decision protocol (post-S2)

Every choice reaches agents as a request with an enumerated action list; single-option requests are auto-taken and unlogged (ADR-014). Multi-step choices are incremental: attack/block declarations (declare-one/done, ADR-013), blocker damage order (pick-next per multi-blocked attacker), trigger order (pick which goes on the stack next — first placed resolves LAST), mulligan bottoming (pick-per-card). When adding a new choice type: add the Action variant, a RequestPurpose, enumerate in order [safe-default-first, ...], and the harness gets a script-entry kind. The default-first convention matters — scripted fixtures and the "forced choice" auto-take both rely on actions[0] being the no-op/finish option.

Combat staging: declarations accumulate in `state.combat` uncommitted, then `commitAttackers`/`commitBlockers` applies taps/flags all at once — CR's "declared together" semantics with incremental input.

## Known interims / watch list

See handoff Concerns for the authoritative list. Highlights: auto-pay greedy feasibility (correct only while all producers are mono-color — R-006); token color derives from manaCost, so colored tokens read as colorless to future color predicates (R-021 note); trigger conditions are still `self`-only.
