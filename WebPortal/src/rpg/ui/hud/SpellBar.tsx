// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/SpellBar.tsx — Barre de sorts (4 sorts + 1 ultimate)
//
// Position : bas-centre de l'écran
// Affiche jusqu'à 4 sorts + 1 slot ultimate avec cooldowns visuels
// React.memo : ne se re-render que si spells/cooldowns change
// ══════════════════════════════════════════════════════════════════════════════

import { memo, useCallback } from "react";
import type { SpellSlotData } from "./hudTypes";
import {
  Zap,
  ShieldPlus,
  HeartPulse,
  Flame,
  Sparkles,
  Radiation,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface SpellBarProps {
  spells: SpellSlotData[];
  onCastSpell?: (index: number) => void;
}

const MAX_SLOTS = 5; // 4 spells + 1 ultimate

/** Sélectionne l'icône Lucide selon le type de sort. */
function spellLucideIcon(spell: SpellSlotData): LucideIcon {
  if (spell.isUltimate) return Radiation;
  if (spell.id.includes("heal") || spell.id.includes("soin")) return HeartPulse;
  if (spell.id.includes("shield") || spell.id.includes("bouclier"))
    return ShieldPlus;
  if (spell.id.includes("aoe") || spell.id.includes("flame")) return Flame;
  return Sparkles;
}

/** Cooldown ratio pour l'overlay circulaire. */
function cdRatio(spell: SpellSlotData): number {
  if (spell.cooldown <= 0) return 0;
  return Math.min(1, Math.max(0, spell.currentCooldown / spell.cooldown));
}

/**
 * Slot individuel de sort (memoïsé).
 */
const SpellSlot = memo(function SpellSlot({
  spell,
  index,
  onCast,
}: {
  spell: SpellSlotData;
  index: number;
  onCast: (i: number) => void;
}) {
  const Icon = spellLucideIcon(spell);
  const ready = spell.currentCooldown <= 0;
  const ratio = cdRatio(spell);
  const sweepDeg = ratio * 360;

  return (
    <button
      onClick={() => onCast(index)}
      title={`${spell.label} (${spell.manaCost} mana)${
        spell.description ? `\n${spell.description}` : ""
      }`}
      style={{
        ...styles.slot,
        borderColor: ready ? "var(--accent, #60a5fa)" : "#3a3f4d",
        boxShadow: ready
          ? "0 0 12px color-mix(in srgb, var(--accent, #60a5fa) 28%, transparent)"
          : undefined,
        opacity: ready ? 1 : 0.6,
        cursor: ready ? "pointer" : "default",
      }}
      disabled={!ready}
    >
      {/* Numéro de slot */}
      <span style={styles.key}>{index + 1}</span>

      {/* Icône */}
      {spell.icon ? (
        <img
          src={spell.icon}
          alt=""
          style={styles.icon}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <Icon size={20} style={{ color: "var(--accent, #60a5fa)" }} />
      )}

      {/* Label */}
      <span style={styles.name}>{spell.label}</span>

      {/* Overlay de cooldown */}
      {!ready && (
        <>
          <div
            style={{
              ...styles.cdSweep,
              background: `conic-gradient(rgba(2,4,10,0.66) ${sweepDeg}deg, transparent 0)`,
            }}
          />
          <span style={styles.cdText}>
            {spell.currentCooldown.toFixed(1)}
          </span>
        </>
      )}
    </button>
  );
});

/**
 * Barre de sorts : 4 sorts standards + 1 ultimate.
 * React.memo : ne se re-render que si le tableau spells change.
 */
export const SpellBar = memo(function SpellBar({
  spells,
  onCastSpell,
}: SpellBarProps) {
  const handleCast = useCallback(
    (i: number) => {
      onCastSpell?.(i);
    },
    [onCastSpell]
  );

  const filled = spells.slice(0, MAX_SLOTS);
  const slots: (SpellSlotData | null)[] = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    slots.push(filled[i] ?? null);
  }

  return (
    <div style={styles.bar}>
      {slots.map((spell, i) =>
        spell ? (
          <SpellSlot key={spell.id} spell={spell} index={i} onCast={handleCast} />
        ) : (
          <div key={`empty-${i}`} style={styles.emptySlot}>
            <span style={styles.key}>{i + 1}</span>
          </div>
        )
      )}
    </div>
  );
});
SpellBar.displayName = "SpellBar";

// ── Styles inline ────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  bar: {
    display: "flex",
    gap: 8,
  },
  slot: {
    position: "relative",
    width: 56,
    height: 64,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    background: "rgba(10,12,20,0.8)",
    backdropFilter: "blur(8px)",
    border: "1px solid #3a3f4d",
    color: "#e8ecf6",
    fontSize: 10,
    fontFamily: "Inter, system-ui, sans-serif",
    transition: "transform 0.12s, border-color 0.2s, box-shadow 0.2s",
    cursor: "pointer",
  },
  emptySlot: {
    width: 56,
    height: 64,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(10,12,20,0.4)",
    border: "1px dashed rgba(255,255,255,0.1)",
  },
  key: {
    position: "absolute",
    top: 2,
    left: 4,
    fontSize: 9,
    fontWeight: 700,
    color: "#64748b",
    fontFamily: "monospace",
  },
  icon: {
    width: 24,
    height: 24,
    objectFit: "contain",
    imageRendering: "pixelated",
  },
  name: {
    fontSize: 7,
    lineHeight: 1.1,
    textAlign: "center",
    color: "#c3cad8",
    padding: "0 2px",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  cdSweep: {
    position: "absolute",
    inset: 0,
    pointerEvents: "none",
  },
  cdText: {
    position: "absolute",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontFamily: "monospace",
    fontSize: 16,
    fontWeight: 700,
    color: "#fff",
    textShadow: "0 1px 3px #000",
    pointerEvents: "none",
  },
};
