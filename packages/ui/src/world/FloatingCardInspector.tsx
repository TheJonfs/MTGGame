import { useRef, useState } from "react";
import type { CardDef } from "@shandalar/cards";
import { CardFrame } from "../components/CardFrame";
import type { OracleEntry } from "../engine-bridge";

/**
 * S14 round 2 (Chris): a draggable floating card inspector for the world's
 * browsing screens (editor, shop, collection) — hover a card, see it full
 * size. Position remembered; printed/our-frame toggle; collapsible.
 */
const POS_KEY = "shandalar-world-inspector-pos";

export function FloatingCardInspector({ def, oracle, printed, onTogglePrinted }: { def: CardDef | null; oracle: Record<string, OracleEntry>; printed: boolean; onTogglePrinted: () => void }) {
  const [pos, setPos] = useState<{ x: number; y: number }>(() => {
    try {
      const raw = localStorage.getItem(POS_KEY);
      if (raw) return JSON.parse(raw) as { x: number; y: number };
    } catch { /* default */ }
    return { x: Math.max(16, window.innerWidth - 300), y: Math.max(80, window.innerHeight - 340) };
  });
  const [collapsed, setCollapsed] = useState(false);
  const drag = useRef<{ dx: number; dy: number } | null>(null);
  return (
    <div className={`floating-inspector world-inspector${collapsed ? " collapsed" : ""}`} style={{ left: pos.x, top: pos.y }}>
      <div
        className="drag-bar"
        title="Drag to move"
        onPointerDown={(e) => {
          if ((e.target as HTMLElement).closest("button")) return;
          drag.current = { dx: e.clientX - pos.x, dy: e.clientY - pos.y };
          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          setPos({ x: Math.max(0, Math.min(window.innerWidth - 120, e.clientX - drag.current.dx)), y: Math.max(0, Math.min(window.innerHeight - 40, e.clientY - drag.current.dy)) });
        }}
        onPointerUp={() => {
          if (!drag.current) return;
          drag.current = null;
          localStorage.setItem(POS_KEY, JSON.stringify(pos));
        }}
      >
        <span>⋮⋮ Inspector</span>
        <span>
          {def && def.source === "real" && <button className="linkish" onClick={onTogglePrinted}>{printed ? "our frame" : "printed card"}</button>}
          <button className="linkish" onClick={() => setCollapsed(!collapsed)}>{collapsed ? "show" : "hide"}</button>
        </span>
      </div>
      {!collapsed && (
        <div style={{ display: "flex", justifyContent: "center", padding: "4px 0 2px" }}>
          {def ? <CardFrame def={def} oracle={oracle[def.id]} showPrinted={printed} /> : <div style={{ fontSize: 11, color: "var(--ink-soft)", padding: 8 }}>Hover a card to inspect it.</div>}
        </div>
      )}
    </div>
  );
}
