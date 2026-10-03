// ══════════════════════════════════════════════════════════════════════════════
// components/inventory/InventoryScreen.tsx — Écran d'inventaire complet
//
// Fusionne la grille, l'équipement, les crédits, le craft.
// Utilise inventoryStore (SyncExternalStore) comme backend.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo } from "react";
import { useInventory, inventoryStore } from "../../rpg/items/inventoryStore";
import { craftItem, type CraftStation } from "../../rpg/items/craftingSystem";
import { getEquippedStats } from "../../rpg/items/equipmentSlots";
import type { EquipSlot } from "../../rpg/items/ItemDefinition";
import { ITEM_DB } from "../../rpg/items/itemCatalog";
import { InventoryGrid } from "./InventoryGrid";
import { EquipmentPanel } from "./EquipmentPanel";
import { CraftingPanel } from "./CraftingPanel";

export type InventoryTab = "inventory" | "equipment" | "craft_forge" | "craft_workbench" | "craft_alchemy" | "craft_refinery";

interface InventoryScreenProps {
  onClose: () => void;
  playerLevel?: number;
}

export function InventoryScreen({
  onClose,
  playerLevel = 1,
}: InventoryScreenProps) {
  const inv = useInventory();
  const [tab, setTab] = useState<InventoryTab>("inventory");
  const [craftingOpen, setCraftingOpen] = useState<CraftStation | null>(null);

  // Stats cumulées de l'équipement (pour comparaison)
  const equippedStats = useMemo(() => getEquippedStats(inv.equipment), [inv.equipment]);

  // Compteurs pour le craft (itemId → quantité totale)
  const inventoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const inst of inv.grid.instances) {
      counts[inst.itemId] = (counts[inst.itemId] ?? 0) + inst.quantity;
    }
    return counts;
  }, [inv.grid.instances]);

  // Drag & drop handlers
  const handleMoveItem = useCallback(
    (uid: string, newX: number, newY: number): boolean => {
      return inventoryStore.moveItem(uid, newX, newY);
    },
    []
  );

  const handleEquipFromGrid = useCallback((uid: string) => {
    inventoryStore.equipFromGrid(uid);
  }, []);

  const handleUnequip = useCallback((slot: EquipSlot) => {
    inventoryStore.unequipToGrid(slot);
  }, []);

  const handleDropItem = useCallback((uid: string) => {
    inventoryStore.removeItem(uid);
  }, []);

  const handleCraft = useCallback(
    (recipeId: string) => {
      const result = craftItem(recipeId, inventoryCounts, playerLevel);
      if (!result) return;

      // Retirer les ingrédients de l'inventaire
      for (const ing of result.consumed) {
        let remaining = ing.quantity;
        for (const inst of inv.grid.instances) {
          if (remaining <= 0) break;
          if (inst.itemId === ing.itemId) {
            const toRemove = Math.min(remaining, inst.quantity);
            inventoryStore.removeItem(inst.uid, toRemove);
            remaining -= toRemove;
          }
        }
      }

      // Ajouter le résultat
      inventoryStore.addItemById(result.result.itemId, result.result.quantity);
    },
    [inventoryCounts, playerLevel, inv.grid.instances]
  );

  // Tabs
  const tabs: { id: InventoryTab; label: string }[] = [
    { id: "inventory", label: "📦 Inventaire" },
    { id: "equipment", label: "🛡️ Équipement" },
    { id: "craft_forge", label: "🔥 Forge" },
    { id: "craft_workbench", label: "🔧 Établi" },
    { id: "craft_alchemy", label: "⚗️ Alchimie" },
    { id: "craft_refinery", label: "🏭 Raffinerie" },
  ];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(5, 4, 12, 0.92)",
        zIndex: 9998,
        display: "flex",
        flexDirection: "column",
        fontFamily: "monospace",
        backdropFilter: "blur(6px)",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "14px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}
      >
        <div style={{ fontSize: 20, fontWeight: 900, color: "#e2e8f0", letterSpacing: "0.15em" }}>
          INVENTAIRE
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span style={{ color: "#fbbf24", fontSize: 13, fontWeight: 700 }}>
            🪙 {inv.credits} crédits
          </span>
          <span style={{ fontSize: 12, color: "#64748b" }}>
            {inv.grid.instances.length}/{inv.grid.cols * inv.grid.rows} slots
          </span>
          <button
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#94a3b8",
              borderRadius: 5,
              padding: "6px 14px",
              cursor: "pointer",
              fontSize: 12,
              fontWeight: 700,
              fontFamily: "monospace",
            }}
          >
            ✕ Fermer
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div
        style={{
          display: "flex",
          gap: 2,
          padding: "8px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.05)",
          overflowX: "auto",
        }}
      >
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: "7px 14px",
              fontSize: 11,
              fontWeight: 700,
              fontFamily: "monospace",
              cursor: "pointer",
              background:
                tab === t.id
                  ? "rgba(255,255,255,0.08)"
                  : "transparent",
              color: tab === t.id ? "#e2e8f0" : "#64748b",
              border: `1px solid ${
                tab === t.id
                  ? "rgba(255,255,255,0.15)"
                  : "transparent"
              }`,
              borderRadius: 5,
              whiteSpace: "nowrap",
              transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div style={{ flex: 1, padding: 20, overflowY: "auto", display: "flex", gap: 20 }}>
        {/* Tab: Inventory Grid */}
        {tab === "inventory" && (
          <div style={{ flex: 1 }}>
            <InventoryGrid
              grid={inv.grid}
              onMoveItem={handleMoveItem}
              onEquipItem={handleEquipFromGrid}
              onDropItem={handleDropItem}
              equippedStats={equippedStats}
            />
          </div>
        )}

        {/* Tab: Equipment */}
        {tab === "equipment" && (
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <div style={{ width: 300 }}>
              <EquipmentPanel
                equipment={inv.equipment}
                onUnequip={handleUnequip}
                currentStats={equippedStats}
              />
              {/* Résumé des stats */}
              <div
                style={{
                  marginTop: 16,
                  background: "rgba(0,0,0,0.3)",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.08)",
                  padding: 12,
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 700, color: "#94a3b8", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                  Stats cumulées
                </div>
                {Object.keys(equippedStats).length === 0 && (
                  <div style={{ fontSize: 11, color: "#475569" }}>Aucun équipement porté</div>
                )}
                {Object.entries(equippedStats).map(([key, val]) => (
                  <div key={key} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, lineHeight: 1.8 }}>
                    <span style={{ color: "#94a3b8" }}>{key}</span>
                    <span style={{ color: "#4ade80", fontWeight: 700 }}>+{val}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Craft tabs */}
        {tab.startsWith("craft_") && (
          <div style={{ flex: 1 }}>
            <CraftingPanel
              station={tab.replace("craft_", "") as CraftStation}
              inventoryCounts={inventoryCounts}
              playerLevel={playerLevel}
              onCraft={handleCraft}
              onClose={() => setTab("inventory")}
            />
          </div>
        )}
      </div>

      {/* Footer / Légende */}
      <div
        style={{
          padding: "10px 24px",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          fontSize: 10,
          color: "#475569",
          display: "flex",
          gap: 16,
        }}
      >
        <span>🖱 Glisser-déposer pour déplacer</span>
        <span>🖱 Clic droit pour menu d'action</span>
        <span>🖱 Survoler pour infobulle</span>
        <span>🔄 Double-clic équip. pour déséquiper</span>
      </div>
    </div>
  );
}
