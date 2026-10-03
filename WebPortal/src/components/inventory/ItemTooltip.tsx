// ══════════════════════════════════════════════════════════════════════════════
// components/inventory/ItemTooltip.tsx — Tooltip survol d'item
//
// Affiche les infos détaillées d'un item : stats, description, comparaison
// avec l'équipement actuel.
// ══════════════════════════════════════════════════════════════════════════════

import React from "react";
import type { ItemDefinition, ItemStats } from "../../rpg/items/ItemDefinition";
import { RARITY_COLORS, RARITY_LABELS, EQUIP_SLOT_LABELS, ITEM_TYPE_LABELS } from "../../rpg/items/ItemDefinition";

interface ItemTooltipProps {
  def: ItemDefinition;
  /** Stats de l'équipement actuel pour comparaison (optionnel) */
  compareStats?: ItemStats;
  /** Slot comparé (pour la couleur de bordure de comparaison) */
  compareSlot?: string;
  style?: React.CSSProperties;
}

/**
 * Affiche une stat avec sa valeur et la différence avec l'équipement actuel.
 */
function StatLine({
  label,
  current,
  equipped,
}: {
  label: string;
  current: number;
  equipped?: number;
}) {
  const diff = equipped !== undefined ? current - equipped : 0;
  const diffColor = diff > 0 ? "#4ade80" : diff < 0 ? "#f87171" : "#94a3b8";

  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, lineHeight: 1.6 }}>
      <span style={{ color: "#94a3b8" }}>{label}</span>
      <span>
        <span style={{ color: "#e2e8f0", fontWeight: 700 }}>+{current}</span>
        {equipped !== undefined && (
          <span style={{ color: diffColor, marginLeft: 6, fontSize: 11 }}>
            ({diff > 0 ? "+" : ""}{diff})
          </span>
        )}
      </span>
    </div>
  );
}

export function ItemTooltip({ def, compareStats, compareSlot, style }: ItemTooltipProps) {
  const rarityColor = def.color ?? RARITY_COLORS[def.rarity];

  return (
    <div style={{
      position: "absolute",
      zIndex: 9999,
      pointerEvents: "none",
      background: "rgba(10, 8, 20, 0.95)",
      border: `1px solid ${rarityColor}66`,
      borderRadius: 8,
      padding: "12px 14px",
      minWidth: 220,
      maxWidth: 320,
      backdropFilter: "blur(8px)",
      fontFamily: "monospace",
      boxShadow: `0 4px 20px rgba(0,0,0,0.6), 0 0 12px ${rarityColor}22`,
      ...style,
    }}>
      {/* Nom + Rareté */}
      <div style={{ fontWeight: 900, fontSize: 14, color: rarityColor, marginBottom: 2 }}>
        {def.label}
      </div>
      <div style={{ display: "flex", gap: 6, fontSize: 10, color: "#64748b", marginBottom: 8 }}>
        <span style={{ color: rarityColor }}>{RARITY_LABELS[def.rarity]}</span>
        <span>·</span>
        <span>{ITEM_TYPE_LABELS[def.type]}</span>
        {def.equipSlot && (
          <>
            <span>·</span>
            <span>{EQUIP_SLOT_LABELS[def.equipSlot]}</span>
          </>
        )}
        <span>·</span>
        <span>Niv.{def.level}</span>
      </div>

      {/* Description */}
      {def.description && (
        <div style={{ fontSize: 11, color: "#94a3b8", marginBottom: 8, lineHeight: 1.4, fontStyle: "italic" }}>
          {def.description}
        </div>
      )}

      {/* Stats */}
      {Object.keys(def.stats).length > 0 && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6, marginTop: 4 }}>
          {def.stats.attackPower !== undefined && (
            <StatLine label="ATQ" current={def.stats.attackPower} equipped={compareStats?.attackPower} />
          )}
          {def.stats.defense !== undefined && (
            <StatLine label="DÉF" current={def.stats.defense} equipped={compareStats?.defense} />
          )}
          {def.stats.puissance !== undefined && (
            <StatLine label="PUISS" current={def.stats.puissance} equipped={compareStats?.puissance} />
          )}
          {def.stats.maxHp !== undefined && (
            <StatLine label="PV" current={def.stats.maxHp} equipped={compareStats?.maxHp} />
          )}
          {def.stats.maxMana !== undefined && (
            <StatLine label="MANA" current={def.stats.maxMana} equipped={compareStats?.maxMana} />
          )}
          {def.stats.critique !== undefined && (
            <StatLine label="CRIT" current={def.stats.critique} equipped={compareStats?.critique} />
          )}
          {def.stats.vitesse !== undefined && (
            <StatLine label="VIT" current={def.stats.vitesse} equipped={compareStats?.vitesse} />
          )}
        </div>
      )}

      {/* Effet utilisable */}
      {def.useEffect && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6, marginTop: 4 }}>
          <div style={{ fontSize: 11, color: "#4ade80" }}>
            {def.useEffect.description ?? "Utilisable"}
          </div>
        </div>
      )}

      {/* Stackable */}
      {def.stackable && (
        <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6, marginTop: 4, fontSize: 10, color: "#64748b" }}>
          Empilable ×{def.maxStack}
        </div>
      )}

      {/* Valeur */}
      <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 6, marginTop: 4, display: "flex", justifyContent: "space-between", fontSize: 10, color: "#64748b" }}>
        <span>Poids: {def.weight} kg</span>
        <span>Valeur: {def.value} crédits</span>
      </div>
    </div>
  );
}
