import { useEffect, useState } from "react";
import { getLayoutSetting, isCompact, LAYOUT_LABEL, setLayoutSetting, subscribeLayout, type LayoutSetting } from "../layout-mode";

/** Post-S71: the layout override — auto follows the window; compact and full force one side (per device). */
export function LayoutPicker({ className }: { className?: string }) {
  const [, force] = useState(0);
  useEffect(() => subscribeLayout(() => force((n) => n + 1)), []);
  const setting = getLayoutSetting();
  return (
    <label className={className} title="Compact suits short or narrow screens (a folding phone, a small window). Auto switches by window size; remembered on this device.">
      layout{" "}
      <select value={setting} onChange={(e) => setLayoutSetting(e.target.value as LayoutSetting)}>
        {(["auto", "compact", "full"] as LayoutSetting[]).map((s) => <option key={s} value={s}>{LAYOUT_LABEL[s]}</option>)}
      </select>
      {setting === "auto" && <span style={{ opacity: 0.7 }}> · now {isCompact() ? "compact" : "full"}</span>}
    </label>
  );
}
