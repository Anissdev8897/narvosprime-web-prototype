// professions/CraftingPanel.tsx — atelier d'artisanat (Forgeron / Alchimiste / Joaillier).
//
// Liste les recettes du métier, affiche les ingrédients (possédés/requis), le produit,
// son niveau requis. « Fabriquer » lance le mini-jeu de forge → la qualité module le
// bonus (quantité + XP). Consomme les ressources via professionStore.craft.
import { useState } from "react";
import { useProfessions } from "./useProfessions";
import { professionStore } from "./professionStore";
import { getProfession, recipesForProfession, RARITY_COLOR, itemLabel, itemRarity } from "./professionCatalog";
import type { CraftRecipe, ProfessionId } from "./professionTypes";
import { ForgeMiniGame } from "./ForgeMiniGame";

interface Props {
  profession: ProfessionId;
  pushToast: (text: string, color: string) => void;
  /** Ajoute l'objet fabriqué à l'inventaire principal (équipable/consommable/vendable). */
  onCrafted: (outputItemId: string, qty: number) => void;
  onClose: () => void;
}

/** Qualité (0..1) → bonus de fabrication. */
function qualityTier(q: number): { label: string; bonusQty: number; xpMult: number; color: string } {
  if (q >= 0.78) return { label: "Exceptionnel", bonusQty: 1, xpMult: 1.6, color: "#ffb547" };
  if (q >= 0.45) return { label: "Supérieur", bonusQty: 0, xpMult: 1.15, color: "#3fa9ff" };
  return { label: "Standard", bonusQty: 0, xpMult: 0.85, color: "#c7cdd6" };
}

export function CraftingPanel({ profession, pushToast, onCrafted, onClose }: Props) {
  const st = useProfessions();
  const [crafting, setCrafting] = useState<CraftRecipe | null>(null);
  const def = getProfession(profession);
  const recipes = recipesForProfession(profession);
  const level = st.profs[profession].level;

  const onComplete = (q: number) => {
    const recipe = crafting; setCrafting(null);
    if (!recipe) return;
    const tier = qualityTier(q);
    const res = professionStore.craft(recipe, tier.bonusQty, tier.xpMult);
    if (!res.ok || !res.output) { pushToast("Fabrication impossible (ressources/niveau)", "#f87171"); return; }
    onCrafted(res.output.itemId, res.output.qty); // → inventaire principal
    pushToast(
      `${recipe.icon} ${recipe.output.label} ×${res.output.qty} · ${tier.label} → inventaire` + (res.levels ? ` · Niveau ${professionStore.level(profession)} !` : ""),
      tier.color,
    );
  };

  return (
    <div style={{
      position: "fixed", top: 110, right: 66, zIndex: 58, width: 360, maxHeight: "78vh", overflowY: "auto",
      background: "rgba(12,10,8,0.97)", border: `1px solid ${def.color}`, borderRadius: 12, padding: 16,
      color: "#efe6da", fontFamily: "system-ui, sans-serif", boxShadow: "0 12px 44px rgba(0,0,0,0.65)",
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
        <div style={{ fontWeight: 800, fontSize: 16, color: def.color }}>{def.icon} {def.label} — Atelier</div>
        <button onClick={onClose} style={{ background: "none", border: "none", color: "#9aa3b2", fontSize: 18, cursor: "pointer" }}>✕</button>
      </div>
      <div style={{ fontSize: 12, color: "#b9ad9c", marginBottom: 12 }}>Niveau {level} · {recipes.length} recettes</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {recipes.map((r) => {
          const locked = level < r.minLevel;
          const affordable = professionStore.hasResources(r.inputs);
          const canCraft = !locked && affordable;
          const outCol = RARITY_COLOR[r.output.rarity] ?? "#c7cdd6";
          return (
            <div key={r.id} style={{
              background: "rgba(255,255,255,0.03)", border: `1px solid ${canCraft ? def.color + "55" : "#ffffff14"}`,
              borderRadius: 8, padding: "9px 11px", opacity: locked ? 0.55 : 1,
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontWeight: 700, fontSize: 13, color: outCol }}>{r.icon} {r.output.label}</span>
                <span style={{ fontSize: 11, color: locked ? "#e06b5c" : "#9bbf9b" }}>
                  {locked ? `🔒 Niv. ${r.minLevel}` : `${r.output.value} cr`}
                </span>
              </div>

              {/* Ingrédients */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8, margin: "7px 0", fontSize: 11 }}>
                {r.inputs.map((i) => {
                  const have = professionStore.resource(i.itemId);
                  const ok = have >= i.qty;
                  return (
                    <span key={i.itemId} style={{ color: ok ? "#9bdca3" : "#e69b8f" }}>
                      {itemLabel(i.itemId)} <b>{have}/{i.qty}</b>
                    </span>
                  );
                })}
              </div>

              <button
                disabled={!canCraft}
                onClick={() => setCrafting(r)}
                style={{
                  width: "100%", padding: "7px", fontSize: 12, fontWeight: 800, borderRadius: 6,
                  cursor: canCraft ? "pointer" : "not-allowed",
                  background: canCraft ? def.color : "#2a2620", color: canCraft ? "#0e0a06" : "#6b6358",
                  border: `1px solid ${canCraft ? def.color : "#ffffff10"}`,
                }}
              >
                {locked ? "Verrouillé" : affordable ? "Fabriquer" : "Ressources insuffisantes"}
              </button>
            </div>
          );
        })}
      </div>

      {/* Sac de matériaux (rappel) */}
      <div style={{ marginTop: 12, borderTop: `1px solid ${def.color}22`, paddingTop: 8 }}>
        <div style={{ fontSize: 12, fontWeight: 700, color: def.color, marginBottom: 5 }}>Sac</div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "2px 10px" }}>
          {Object.entries(st.resources).filter(([, n]) => n > 0).map(([id, n]) => (
            <span key={id} style={{ fontSize: 11, color: RARITY_COLOR[itemRarity(id)] ?? "#c7cdd6" }}>{itemLabel(id)} ×{n}</span>
          ))}
        </div>
      </div>

      {crafting && (
        <ForgeMiniGame
          profession={profession}
          color={def.color}
          recipeLabel={crafting.output.label}
          onComplete={onComplete}
          onCancel={() => setCrafting(null)}
        />
      )}
    </div>
  );
}
