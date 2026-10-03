// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/BuffDisplay.tsx — Affichage des buffs/debuffs temporaires
//
// Position : au-dessus de la barre de sorts
// Affiche les effets actifs avec durée restante et icône
// React.memo : ne se re-render que si buffs change
// ══════════════════════════════════════════════════════════════════════════════

import { memo } from "react";
import type { BuffData } from "./hudTypes";
import { Sparkles, Skull } from "lucide-react";

export interface BuffDisplayProps {
  buffs: BuffData[];
}

/**
 * Effet individuel (memoïsé).
 */
const BuffIcon = memo(function BuffIcon({ buff }: { buff: BuffData }) {
  const remainingPct =
    buff.maxDuration > 0
      ? Math.min(100, (buff.remaining / buff.maxDuration) * 100)
      : 100;

  return (
    <div
      title={`${buff.label} — ${buff.remaining.toFixed(1)}s${
        buff.stacks && buff.stacks > 1 ? ` (x${buff.stacks})` : ""
      }`}
      style={{
        ...styles.buff,
        borderColor: buff.isDebuff ? "#ef444466" : "#22c55e66",
        opacity: remainingPct <= 0 ? 0.3 : 1,
      }}
    >
      {/* Icône */}
      {buff.icon ? (
        <img
          src={buff.icon}
          alt=""
          style={styles.icon}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : buff.isDebuff ? (
        <Skull size={16} color="#ef4444" />
      ) : (
        <Sparkles size={16} color="#22c55e" />
      )}

      {/* Stacks */}
      {buff.stacks && buff.stacks > 1 && (
        <span style={styles.stacks}>{buff.stacks}</span>
      )}

      {/* Timer (durée restante) */}
      <div
        style={{
          ...styles.timerBar,
          width: `${remainingPct}%`,
          background: buff.isDebuff ? "#ef4444" : "#22c55e",
        }}
      />
    </div>
  );
});

/**
 * Affichage des buffs/debuffs actifs.
 * React.memo : ne se re-render que si le tableau buffs change.
 */
export const BuffDisplay = memo(function BuffDisplay({
  buffs,
}: BuffDisplayProps) {
  if (buffs.length === 0) return null;

  return (
    <div style={styles.container}>
      {buffs.map((buff) => (
        <BuffIcon key={buff.id} buff={buff} />
      ))}
    </div>
  );
});
BuffDisplay.displayName = "BuffDisplay";

// ── Styles inline ────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    gap: 4,
    flexWrap: "wrap",
    maxWidth: 200,
  },
  buff: {
    position: "relative",
    width: 32,
    height: 32,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(6,10,18,0.72)",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 4,
    overflow: "hidden",
  },
  icon: {
    width: 18,
    height: 18,
    objectFit: "contain",
    imageRendering: "pixelated",
  },
  stacks: {
    position: "absolute",
    bottom: 1,
    right: 2,
    fontSize: 9,
    fontWeight: 700,
    color: "#fff",
    textShadow: "0 1px 2px #000",
    fontFamily: "monospace",
  },
  timerBar: {
    position: "absolute",
    bottom: 0,
    left: 0,
    height: 2,
    transition: "width 0.3s linear",
  },
};
