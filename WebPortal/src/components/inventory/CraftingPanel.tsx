// ══════════════════════════════════════════════════════════════════════════════
// components/inventory/CraftingPanel.tsx — UI de craft
//
// Affiche les recettes disponibles par station, les ingrédients requis/manquants,
// et permet de lancer un craft.
// ══════════════════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from "react";
import type { CraftStation } from "../../rpg/items/craftingSystem";
import { CRAFT_RECIPES, recipesByStation, checkRecipe } from "../../rpg/items/craftingSystem";
import { ITEM_DB } from "../../rpg/items/itemCatalog";
import { RARITY_COLORS } from "../../rpg/items/ItemDefinition";

interface CraftingPanelProps {
  station: CraftStation;
  inventoryCounts: Record<string, number>;
  playerLevel: number;
  onCraft: (recipeId: string) => void;
  onClose: () => void;
}

const STATION_LABELS: Record<CraftStation, string> = {
  forge: "🔥 Forge",
  workbench: "🔧 Établi",
  alchemy: "⚗️ Alchimie",
  refinery: "🏭 Raffinerie",
};

export function CraftingPanel({
  station,
  inventoryCounts,
  playerLevel,
  onCraft,
  onClose,
}: CraftingPanelProps) {
  const recipes = recipesByStation(station);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.7)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        fontFamily: "monospace",
        backdropFilter: "blur(4px)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "rgba(10, 8, 20, 0.95)",
          border: "1px solid rgba(255,255,255,0.12)",
          borderRadius: 10,
          padding: 24,
          maxWidth: 560,
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
          boxShadow: "0 8px 40px rgba(0,0,0,0.6)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 16,
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            paddingBottom: 12,
          }}
        >
          <div style={{ fontSize: 18, fontWeight: 900, color: "#e2e8f0", letterSpacing: "0.1em" }}>
            {STATION_LABELS[station]}
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "1px solid rgba(255,255,255,0.2)",
              color: "#94a3b8",
              borderRadius: 4,
              padding: "4px 10px",
              cursor: "pointer",
              fontSize: 12,
              fontFamily: "monospace",
            }}
          >
            ✕ Fermer
          </button>
        </div>

        {/* Liste des recettes */}
        {recipes.length === 0 && (
          <div style={{ color: "#64748b", fontSize: 12, textAlign: "center", padding: 20 }}>
            Aucune recette disponible pour cette station.
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {recipes.map((recipe) => {
            const check = checkRecipe(recipe.id, inventoryCounts, playerLevel);
            const resultDef = ITEM_DB[recipe.result.itemId];
            const rarityColor = resultDef?.color ?? RARITY_COLORS[resultDef?.rarity ?? "common"];
            const canCraft = check?.available ?? false;

            return (
              <div
                key={recipe.id}
                style={{
                  background: canCraft
                    ? "rgba(74, 222, 128, 0.05)"
                    : "rgba(0,0,0,0.2)",
                  border: `1px solid ${
                    canCraft ? "rgba(74, 222, 128, 0.3)" : "rgba(255,255,255,0.06)"
                  }`,
                  borderRadius: 6,
                  padding: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    {/* Nom du résultat */}
                    <div style={{ fontWeight: 800, fontSize: 13, color: rarityColor }}>
                      {resultDef?.icon ?? "❓"} {recipe.label}
                    </div>
                    <div style={{ fontSize: 10, color: "#64748b", marginTop: 2 }}>
                      {recipe.description}
                    </div>
                  </div>

                  {/* Bouton Craft */}
                  <button
                    disabled={!canCraft}
                    onClick={() => onCraft(recipe.id)}
                    style={{
                      padding: "6px 14px",
                      fontSize: 11,
                      fontWeight: 700,
                      fontFamily: "monospace",
                      borderRadius: 4,
                      cursor: canCraft ? "pointer" : "default",
                      background: canCraft
                        ? "rgba(74, 222, 128, 0.15)"
                        : "rgba(255,255,255,0.05)",
                      color: canCraft ? "#4ade80" : "#475569",
                      border: `1px solid ${
                        canCraft ? "rgba(74, 222, 128, 0.4)" : "rgba(255,255,255,0.08)"
                      }`,
                      whiteSpace: "nowrap",
                    }}
                  >
                    Crafter ×{recipe.result.quantity}
                  </button>
                </div>

                {/* Ingrédients */}
                <div style={{ marginTop: 8, fontSize: 11 }}>
                  <div style={{ color: "#64748b", marginBottom: 4 }}>Ingrédients :</div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {recipe.ingredients.map((ing) => {
                      const ingDef = ITEM_DB[ing.itemId];
                      const have = inventoryCounts[ing.itemId] ?? 0;
                      const enough = have >= ing.quantity;
                      return (
                        <span
                          key={ing.itemId}
                          style={{
                            padding: "3px 7px",
                            borderRadius: 4,
                            background: enough
                              ? "rgba(74, 222, 128, 0.08)"
                              : "rgba(248, 113, 113, 0.08)",
                            border: `1px solid ${
                              enough ? "rgba(74, 222, 128, 0.2)" : "rgba(248, 113, 113, 0.2)"
                            }`,
                            color: enough ? "#4ade80" : "#f87171",
                            fontSize: 10,
                          }}
                        >
                          {ingDef?.icon ?? "❓"} {ingDef?.label ?? ing.itemId}{" "}
                          {have}/{ing.quantity}
                        </span>
                      );
                    })}
                  </div>
                </div>

                {/* Temps craft + difficulté */}
                <div
                  style={{
                    marginTop: 6,
                    display: "flex",
                    gap: 12,
                    fontSize: 10,
                    color: "#475569",
                  }}
                >
                  <span>⏱ {recipe.craftTimeSec}s</span>
                  <span>🎯 Difficulté {recipe.difficulty}</span>
                  <span>Niveau requis: {recipe.requiredLevel}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
