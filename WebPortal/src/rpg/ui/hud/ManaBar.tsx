// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/ManaBar.tsx — Barre de Mana/Énergie du joueur
// React.memo : ne se re-render que si mana/maxMana/color change
// ══════════════════════════════════════════════════════════════════════════════

import { memo } from "react";
import type { Faction } from "../../../types";
import { LOW_MANA_THRESHOLD, BAR_HEIGHT, BAR_WIDTH } from "./hudConstants";

export interface ManaBarProps {
  mana: number;
  maxMana: number;
  color: string;
  faction: Faction;
  label?: string;
}

function pct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

export const ManaBar = memo(function ManaBar({
  mana,
  maxMana,
  color,
  label = "MANA",
}: ManaBarProps) {
  const percent = pct(mana, maxMana);
  const isLow = percent < LOW_MANA_THRESHOLD * 100;

  return (
    <div style={styles.container}>
      <div style={styles.labelRow}>
        <span style={styles.label}>{label}</span>
        <span
          style={{
            ...styles.value,
            color: isLow ? "#fbbf24" : "#cbd5e1",
            fontWeight: isLow ? 800 : 600,
          }}
        >
          {Math.ceil(mana)} / {maxMana}
        </span>
      </div>
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            width: `${percent}%`,
            background: isLow
              ? "linear-gradient(90deg, #b45309, #f59e0b)"
              : `linear-gradient(90deg, ${color}88, ${color})`,
            boxShadow:
              percent > 0
                ? `0 0 8px ${isLow ? "#f59e0b" : color}44`
                : undefined,
            animation: isLow ? "manaPulse 0.9s ease-in-out infinite" : undefined,
          }}
        />
      </div>
    </div>
  );
});
ManaBar.displayName = "ManaBar";

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
    fontSize: 10,
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
