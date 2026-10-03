// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/HealthBar.tsx — Barre de santé joueur avec animation et glow
// React.memo : ne se re-render que si hp/maxHp/color change
// ══════════════════════════════════════════════════════════════════════════════

import { memo } from "react";
import type { Faction } from "../../../types";
import { LOW_HEALTH_THRESHOLD, BAR_HEIGHT, BAR_WIDTH } from "./hudConstants";

export interface HealthBarProps {
  hp: number;
  maxHp: number;
  color: string;
  faction: Faction;
}

function pct(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.max(0, (value / max) * 100));
}

export const HealthBar = memo(function HealthBar({
  hp,
  maxHp,
  color,
}: HealthBarProps) {
  const percent = pct(hp, maxHp);
  const isLow = percent < LOW_HEALTH_THRESHOLD * 100;

  return (
    <div style={styles.container}>
      <div style={styles.labelRow}>
        <span style={styles.label}>HP</span>
        <span style={styles.value}>
          {Math.ceil(hp)} / {maxHp}
        </span>
      </div>
      <div style={styles.track}>
        <div
          style={{
            ...styles.fill,
            width: `${percent}%`,
            background: color,
            boxShadow: isLow ? `0 0 16px ${color}` : "inset 0 0 8px rgba(255,255,255,0.35)",
            animation: isLow ? "healthPulse 0.9s ease-in-out infinite" : undefined,
          }}
        />
      </div>
    </div>
  );
});
HealthBar.displayName = "HealthBar";

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
