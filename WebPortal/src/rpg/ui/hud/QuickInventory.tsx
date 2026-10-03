// ══════════════════════════════════════════════════════════════════════════════
// ui/hud/QuickInventory.tsx — Inventaire rapide (5 emplacements)
//
// Position : à gauche de la barre de sorts
// Affiche 5 emplacements d'objets avec icône et quantité
// React.memo : ne se re-render que si items change
// ══════════════════════════════════════════════════════════════════════════════

import { memo } from "react";
import type { QuickSlotItem } from "./hudTypes";
import { Package } from "lucide-react";

export interface QuickInventoryProps {
  items: QuickSlotItem[];
  onUseItem?: (index: number) => void;
}

const MAX_SLOTS = 5;

/**
 * Emplacement individuel (memoïsé).
 */
const QuickSlot = memo(function QuickSlot({
  item,
  index,
  onUse,
}: {
  item: QuickSlotItem | null;
  index: number;
  onUse: (i: number) => void;
}) {
  if (!item) {
    return (
      <div style={styles.emptySlot}>
        <span style={styles.key}>{index + 1}</span>
      </div>
    );
  }

  return (
    <button
      onClick={() => onUse(index)}
      title={`${item.label}${item.quantity > 0 ? ` (x${item.quantity})` : ""}`}
      style={styles.slot}
    >
      {/* Icône */}
      {item.icon ? (
        <img
          src={item.icon}
          alt=""
          style={styles.icon}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <Package size={16} style={{ color: "#94a3b8" }} />
      )}

      {/* Quantité */}
      {item.quantity > 0 && <span style={styles.count}>{item.quantity}</span>}
    </button>
  );
});

/**
 * Inventaire rapide : 5 emplacements d'objets.
 * React.memo : ne se re-render que si le tableau items change.
 */
export const QuickInventory = memo(function QuickInventory({
  items,
  onUseItem,
}: QuickInventoryProps) {
  const slots: (QuickSlotItem | null)[] = [];
  for (let i = 0; i < MAX_SLOTS; i++) {
    slots.push(items[i] ?? null);
  }

  return (
    <div style={styles.container}>
      {slots.map((item, i) => (
        <QuickSlot
          key={item?.id ?? `empty-${i}`}
          item={item}
          index={i}
          onUse={onUseItem ?? (() => {})}
        />
      ))}
    </div>
  );
});
QuickInventory.displayName = "QuickInventory";

// ── Styles inline ────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    gap: 4,
  },
  slot: {
    position: "relative",
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(10,12,20,0.7)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 4,
    cursor: "pointer",
    transition: "border-color 0.15s",
  },
  emptySlot: {
    width: 40,
    height: 40,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "rgba(10,12,20,0.3)",
    border: "1px dashed rgba(255,255,255,0.06)",
    borderRadius: 4,
  },
  key: {
    fontSize: 9,
    fontWeight: 700,
    color: "#475569",
    fontFamily: "monospace",
  },
  icon: {
    width: 22,
    height: 22,
    objectFit: "contain",
    imageRendering: "pixelated",
  },
  count: {
    position: "absolute",
    bottom: 1,
    right: 2,
    fontSize: 9,
    fontWeight: 700,
    color: "#e8ecf6",
    textShadow: "0 1px 2px #000",
    fontFamily: "monospace",
  },
};
