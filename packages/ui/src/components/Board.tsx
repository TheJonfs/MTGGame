import { getObject, type EngineCtx, type PlayerId } from "@shandalar/engine";
import { CardTile } from "./CardTile";
import { CardFrame } from "./CardFrame";
import type { OracleEntry } from "../engine-bridge";

interface BoardProps {
  ctx: EngineCtx;
  oracle: Record<string, OracleEntry>;
  revealOpponent: boolean;
  onHover: (id: string) => void;
  onClick: (id: string) => void;
  selected: string | null;
}

/** Permanents of one controller, split lands / other, attachments grouped beside hosts. */
function PermanentsRow({ ctx, player, onHover, onClick, selected }: BoardProps & { player: PlayerId }) {
  const state = ctx.state;
  const inCombat = new Set([...state.combat.attackers, ...state.combat.blocks.map((b) => b.blocker)]);
  const ids = state.battlefield.filter((id) => {
    const o = getObject(state, id);
    return o.controller === player && !inCombat.has(id);
  });
  const attachments = new Map<string, string[]>();
  const standalone: string[] = [];
  for (const id of ids) {
    const o = getObject(state, id);
    if (o.attachedTo && state.objects[o.attachedTo]) {
      attachments.set(o.attachedTo, [...(attachments.get(o.attachedTo) ?? []), id]);
    } else {
      standalone.push(id);
    }
  }
  const lands = standalone.filter((id) => ctx.defs.def(getObject(state, id).cardId).types.includes("Land"));
  const rest = standalone.filter((id) => !lands.includes(id));

  const tile = (id: string, small = false) => (
    <CardTile key={id} ctx={ctx} obj={getObject(state, id)} small={small} onHover={onHover} onClick={onClick} selected={selected === id} />
  );

  return (
    <>
      <div className="zone-row">
        {rest.map((id) =>
          attachments.has(id) ? (
            <div className="host-group" key={id}>
              {tile(id)}
              {attachments.get(id)!.map((a) => tile(a, true))}
            </div>
          ) : (
            tile(id)
          ),
        )}
      </div>
      <div className="zone-row lands">{lands.map((id) => tile(id, true))}</div>
    </>
  );
}

/** Two aligned rows: attackers above their blockers, column per attacker (art-direction §2). */
function CombatLane({ ctx, onHover, onClick, selected }: BoardProps) {
  const state = ctx.state;
  if (state.combat.attackers.length === 0) return null;
  return (
    <div className="combat-lane">
      <div className="lane-title">Combat — attackers above, blockers below, paired by column</div>
      <div className="lane-grid">
        {state.combat.attackers.map((attackerId) => {
          const attacker = state.objects[attackerId];
          const blockers = (state.combat.blockOrder[attackerId] ?? []).filter((b) => state.objects[b]);
          return (
            <div className="combat-col" key={attackerId}>
              <div className="attacker-slot">
                {attacker && <CardTile ctx={ctx} obj={attacker} onHover={onHover} onClick={onClick} selected={selected === attackerId} />}
              </div>
              <div className="blocker-slot">
                {blockers.map((b) => (
                  <CardTile key={b} ctx={ctx} obj={getObject(state, b)} onHover={onHover} onClick={onClick} selected={selected === b} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function HandRow({ ctx, player, faceDown, oracle, onHover, onClick, selected }: BoardProps & { player: PlayerId; faceDown: boolean }) {
  const hand = ctx.state.players[player].hand;
  if (faceDown) {
    return (
      <div className="hand-row">
        {hand.map((id) => (
          <div key={id} className="facedown" style={{ backgroundImage: "url(/card-back.png)" }} />
        ))}
      </div>
    );
  }
  return (
    <div className="hand-row">
      {hand.map((id) => {
        const obj = getObject(ctx.state, id);
        return (
          <div key={id} onMouseEnter={() => onHover(id)} onClick={() => onClick(id)} style={{ cursor: "pointer" }}>
            <CardFrame def={ctx.defs.def(obj.cardId)} oracle={oracle[obj.cardId]} mini />
          </div>
        );
      })}
    </div>
  );
}

export function Board(props: BoardProps) {
  const { ctx, revealOpponent } = props;
  // Seat convention: player 0 at the bottom ("you"), player 1 across the table.
  return (
    <div className="board">
      <div className="row-label">Opponent hand ({ctx.state.players[1].hand.length})</div>
      <HandRow {...props} player={1} faceDown={!revealOpponent} />
      <div className="row-label">Opponent battlefield</div>
      <PermanentsRow {...props} player={1} />
      <CombatLane {...props} />
      <div className="row-label">Your battlefield</div>
      <PermanentsRow {...props} player={0} />
      <div className="row-label">Your hand ({ctx.state.players[0].hand.length})</div>
      <HandRow {...props} player={0} faceDown={false} />
    </div>
  );
}
