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

/** Post-S71 (the Duo, installed): what this screen gives the page — the window in CSS px and the safe-area
 * margins iOS keeps clear (status bar, camera, corners), read from a hidden probe padded by env(). */
export function ScreenReadout() {
  const [text, setText] = useState("");
  useEffect(() => {
    const probe = document.createElement("div");
    probe.className = "safe-probe";
    document.body.appendChild(probe);
    const read = () => {
      const cs = getComputedStyle(probe);
      const px = (v: string) => Math.round(parseFloat(v) || 0);
      const standalone = window.matchMedia?.("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone;
      setText(`${window.innerWidth}×${window.innerHeight}${standalone ? " · home screen" : ""} · safe area t${px(cs.paddingTop)} r${px(cs.paddingRight)} b${px(cs.paddingBottom)} l${px(cs.paddingLeft)}`);
    };
    read();
    window.addEventListener("resize", read);
    return () => { window.removeEventListener("resize", read); probe.remove(); };
  }, []);
  return <div className="screen-readout">{text}</div>;
}
