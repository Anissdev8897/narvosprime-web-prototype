// ══════════════════════════════════════════════════════════════════════════════
// runtime/ConsumableBar.tsx — Barre HUD de 3 slots consommables (touches 4/5/6)
//
// • 3 cases à droite de la barre de sorts. Chaque slot affiche l'icône + count.
// • Clic = utilise l'item (onUseSlot)
// • Clic droit = désassigne
// • Glow vert si stock > 0, rouge si épuisé, gris si vide
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";
import type { InventoryState } from "../loot/Inventory";
import { LOOT_CATALOG } from "../loot/LootRegistry";
import { useConsumableSlots } from "../loot/useConsumableSlots";
import { consumableSlotsStore } from "../loot/consumableSlots";

interface Props {
  inventory: InventoryState;
  /** Appelé quand l'utilisateur clique sur un slot pour utiliser l'item. */
  onUseSlot?: (slotIdx: 0 | 1 | 2) => void;
}

export function ConsumableBar({ inventory, onUseSlot }: Props) {
  const slots = useConsumableSlots();

  // Comptage par itemId
  const counts = useMemo(() => {
    const map = new Map<string, number>();
    for (const it of inventory.items) {
      map.set(it.id, (map.get(it.id) ?? 0) + 1);
    }
    return map;
  }, [inventory.items]);

  return (
    <div style={{
      position: "fixed", bottom: 16, left: "50%",
      transform: "translateX(calc(50% + 10px))",
      zIndex: 42, pointerEvents: "auto",
      display: "flex", gap: 6,
    }}>
      {slots.map((itemId, i) => {
        const slotIdx = i as 0 | 1 | 2;
        const keyLabel = i + 4;
        const item = itemId ? LOOT_CATALOG[itemId] : null;
        const count = item ? (counts.get(item.id) ?? 0) : 0;
        const isEmpty = !item;
        const isOut   = item && count === 0;
        const canUse  = !isEmpty && !isOut;

        return (
          <div
            key={slotIdx}
            onClick={() => canUse && onUseSlot?.(slotIdx)}
            onContextMenu={(e) => {
              e.preventDefault();
              if (item) consumableSlotsStore.setSlot(slotIdx, null);
            }}
            title={
              item
                ? `${item.label}\n(${count} disponible${count > 1 ? "s" : ""})\nClic : utiliser — Clic droit : retirer`
                : `Slot ${keyLabel} vide\nAssigne une potion depuis l'inventaire (clic droit sur l'item)`
            }
            style={{
              width: 58, height: 58,
              border: `2px solid ${isEmpty ? "#334155" : isOut ? "#7c2d2d" : canUse ? "rgba(74,222,128,0.7)" : "#334155"}`,
              background: isEmpty
                ? "rgba(15, 23, 42, 0.7)"
                : isOut
                  ? "rgba(124, 45, 45, 0.25)"
                  : "rgba(20, 30, 15, 0.8)",
              borderRadius: 10,
              display: "flex", flexDirection: "column",
              alignItems: "center", justifyContent: "center",
              position: "relative",
              cursor: canUse ? "pointer" : "default",
              fontFamily: "monospace",
              transition: "border-color 150ms, background 150ms, transform 80ms, box-shadow 150ms",
              boxShadow: canUse ? "0 0 10px rgba(74,222,128,0.25)" : "none",
              userSelect: "none",
            }}
          >
            {/* Numéro de touche */}
            <span style={{
              position: "absolute", top: 3, left: 5,
              fontSize: 11, fontWeight: 900,
              color: isEmpty ? "#475569" : isOut ? "#ef4444" : "#a3e635",
            }}>
              {keyLabel}
            </span>

            {/* Icône + count */}
            {item ? (
              <>
                <span style={{
                  fontSize: 26,
                  opacity: isOut ? 0.4 : 1,
                  filter: isOut ? "grayscale(1)" : "none",
                  transition: "opacity 0.2s",
                }}>
                  {item.icon}
                </span>
                <span style={{
                  position: "absolute", bottom: 3, right: 6,
                  fontSize: 11, fontWeight: 900,
                  color: isOut ? "#ef4444" : "#e2e8f0",
                  textShadow: "0 0 4px rgba(0,0,0,0.9)",
                }}>
                  {count}
                </span>
              </>
            ) : (
              <span style={{ fontSize: 18, color: "#475569", opacity: 0.5 }}>+</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
