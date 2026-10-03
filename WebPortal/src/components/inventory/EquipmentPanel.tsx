// ══════════════════════════════════════════════════════════════════════════════
// components/inventory/EquipmentPanel.tsx — Panneau d'équipement 6 slots
//
// Affiche les 6 slots d'équipement avec l'item porté.
// Drag & drop depuis la grille pour équiper.
// Tooltip avec comparaison.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from "react";
import type { EquipSlot } from "../../rpg/items/ItemDefinition";
import type { ItemStats } from "../../rpg/items/ItemDefinition";
import type { EquipmentState } from "../../rpg/items/equipmentSlots";
import { ITEM_DB } from "../../rpg/items/itemCatalog";
import { RARITY_COLORS } from "../../rpg/items/ItemDefinition";
import { EQUIPMENT_SLOTS_ORDERED } from "../../rpg/items/equipmentSlots";
import { ItemTooltip } from "./ItemTooltip";

interface EquipmentPanelProps {
  equipment: EquipmentState;
  onUnequip: (slot: EquipSlot) => void;
  /** Stats de l'équipement actuel pour comparaison croisée */
  currentStats?: ItemStats;
}

export function EquipmentPanel({
  equipment,
  onUnequip,
  currentStats,
}: EquipmentPanelProps) {
  const [hoveredSlot, setHoveredSlot] = useState<EquipSlot | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

  const handleMouseEnter = useCallback(
    (slot: EquipSlot, e: React.MouseEvent) => {
      if (equipment[slot]) {
        setHoveredSlot(slot);
        setTooltipPos({ x: e.clientX + 12, y: e.clientY - 10 });
      }
    },
    [equipment]
  );

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (hoveredSlot) {
      setTooltipPos({ x: e.clientX + 12, y: e.clientY - 10 });
    }
  }, [hoveredSlot]);

  const handleMouseLeave = useCallback(() => {
    setHoveredSlot(null);
  }, []);

  // Trouver la définition de l'item survolé
  const hoveredItem =
    hoveredSlot && equipment[hoveredSlot]
      ? ITEM_DB[equipment[hoveredSlot]!.itemId]
      : undefined;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        background: "rgba(0,0,0,0.3)",
        borderRadius: 8,
        border: "1px solid rgba(255,255,255,0.08)",
        padding: 12,
        fontFamily: "monospace",
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 700,
          color: "#94a3b8",
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          marginBottom: 4,
          textAlign: "center",
        }}
      >
        Équipement
      </div>

      {EQUIPMENT_SLOTS_ORDERED.map(({ slot, label, icon }) => {
        const inst = equipment[slot];
        const def = inst ? ITEM_DB[inst.itemId] : undefined;
        const rarityColor = def?.color ?? RARITY_COLORS[def?.rarity ?? "common"];

        return (
          <div
            key={slot}
            onMouseEnter={(e) => handleMouseEnter(slot, e)}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            onDoubleClick={() => {
              if (inst) onUnequip(slot);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "7px 10px",
              background: inst
                ? `rgba(0,0,0,0.4)`
                : "rgba(255,255,255,0.03)",
              border: inst
                ? `1px solid ${rarityColor}66`
                : "1px dashed rgba(255,255,255,0.1)",
              borderRadius: 5,
              cursor: inst ? "pointer" : "default",
              transition: "all 0.15s",
              minHeight: 36,
            }}
            title={inst ? `${def?.label} (Double-clic pour déséquiper)` : label}
          >
            {/* Icône du slot */}
            <span style={{ fontSize: 16, width: 22, textAlign: "center", opacity: inst ? 1 : 0.4 }}>
              {inst ? def?.icon ?? icon : icon}
            </span>

            {/* Nom du slot ou de l'item */}
            <div style={{ flex: 1, fontSize: 11 }}>
              {inst ? (
                <span style={{ color: rarityColor, fontWeight: 700 }}>
                  {def?.label ?? inst.itemId}
                  {inst.quantity > 1 && ` ×${inst.quantity}`}
                </span>
              ) : (
                <span style={{ color: "#64748b" }}>{label}</span>
              )}
            </div>
          </div>
        );
      })}

      <div
        style={{
          fontSize: 9,
          color: "#475569",
          textAlign: "center",
          marginTop: 4,
        }}
      >
        Double-clic pour déséquiper
      </div>

      {/* Tooltip */}
      {hoveredItem && hoveredSlot && equipment[hoveredSlot] && (
        <ItemTooltip
          def={hoveredItem}
          compareStats={currentStats}
          style={{ left: tooltipPos.x, top: tooltipPos.y }}
        />
      )}
    </div>
  );
}
