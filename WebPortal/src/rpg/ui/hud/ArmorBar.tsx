// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/ArmorBar.tsx — Barre d'armure joueur avec animation et glow
// React.memo : ne se re-render que si armor/maxArmor/color change
// ══════════════════════════════════════════════════════════════════════════════

import { memo } from "react";
import type { Faction } from "../../../types";
import { BAR_HEIGHT, BAR_WIDTH } from "./hudConstants";

export interface ArmorBarProps {
  armor: number;
  maxArmor: number;
  color: string;
  faction: Faction;
}

function pct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

export const ArmorBar = memo(function ArmorBar({
  armor,
  maxArmor,
  color,
}: ArmorBarProps) {
  const percent = pct(armor, maxArmor);
  const isFull = percent >= 100;

  return (
    <div style={styles.container}>
      <div style={styles.labelRow}>
        <span style={styles.label}>ARMOR</span>
        <span style={styles.value}>
          {Math.ceil(armor)} / {maxArmor}
        </span>
      </div>
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            width: `${percent}%`,
            background: `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow: isFull
              ? `0 0 14px ${color}, inset 0 0 10px rgba(255,255,255,0.3)`
              : "inset 0 0 6px rgba(255,255,255,0.2)",
          }}
        />
      </div>
    </div>
  );
});
ArmorBar.displayName = "ArmorBar";

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: BAR_WIDTH,
    marginBottom: 4,
  },
  labelRow: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  label: {
    color: "#94a3b8",
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.5px",
    textTransform: "uppercase",
    fontFamily: "monospace",
  },
  value: {
    color: "#cbd5e1",
    fontSize: 10,
    fontWeight: 600,
    fontVariantNumeric: "tabular-nums",
    fontFamily: "monospace",
  },
  track: {
    position: "relative",
    height: BAR_HEIGHT,
    background: "rgba(255,255,255,0.06)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 2,
    overflow: "hidden",
  },
  fill: {
    height: "100%",
    transition: "width 0.25s ease-out",
    borderRadius: 1,
  },
};
