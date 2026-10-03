// ══════════════════════════════════════════════════════════════════════════════
// professions/professionCatalog.ts — Catalogue des 6 métiers + tiers de ressources.
//
// Source de vérité. Pour étendre : ajoute une entrée / un ResourceTier.
// Tiers calés sur la progression demandée :
//   Niv 1 → matériaux usés · 10 → solides · 20 → raffinés · 30 → magiques
//   40 → lunaires · 50 → légendaires. Rareté + valeur croissantes.
// ══════════════════════════════════════════════════════════════════════════════

import type { ProfessionDef, ProfessionId } from "./professionTypes";

export const PROFESSIONS: ProfessionDef[] = [
  {
    id: "bucheron", label: "Bûcheron", kind: "gather", icon: "🪓", color: "#8b5a2b", gatherVerb: "Couper",
    tiers: [
      { id: "bois_use",        label: "Bois usé",        minLevel: 1,  baseXp: 10,  value: 2,    rarity: "commun",     hits: 3 },
      { id: "chene_solide",    label: "Chêne solide",    minLevel: 10, baseXp: 22,  value: 8,    rarity: "commun",     hits: 4 },
      { id: "bois_ancien",     label: "Bois ancien",     minLevel: 20, baseXp: 40,  value: 20,   rarity: "rare",       hits: 5 },
      { id: "bois_spectral",   label: "Bois spectral",   minLevel: 30, baseXp: 70,  value: 55,   rarity: "epique",     hits: 6 },
      { id: "bois_lunaire",    label: "Bois lunaire",    minLevel: 40, baseXp: 110, value: 130,  rarity: "epique",     hits: 7 },
      { id: "bois_legendaire", label: "Bois légendaire", minLevel: 50, baseXp: 180, value: 320,  rarity: "legendaire", hits: 8 },
    ],
  },
  {
    id: "mineur", label: "Mineur", kind: "gather", icon: "⛏️", color: "#9aa0a6", gatherVerb: "Miner",
    tiers: [
      { id: "pierre_fragile",   label: "Pierre fragile",   minLevel: 1,  baseXp: 10,  value: 2,   rarity: "commun",     hits: 3 },
      { id: "fer",              label: "Fer",              minLevel: 10, baseXp: 24,  value: 9,   rarity: "commun",     hits: 4 },
      { id: "acier",            label: "Acier",            minLevel: 20, baseXp: 44,  value: 24,  rarity: "rare",       hits: 5 },
      { id: "cristal_magique",  label: "Cristal magique",  minLevel: 30, baseXp: 76,  value: 60,  rarity: "epique",     hits: 6 },
      { id: "minerai_lunaire",  label: "Minerai lunaire",  minLevel: 40, baseXp: 120, value: 140, rarity: "epique",     hits: 7 },
      { id: "adamantite",       label: "Adamantite",       minLevel: 50, baseXp: 190, value: 340, rarity: "legendaire", hits: 8 },
    ],
  },
  {
    id: "recolteur", label: "Récolteur", kind: "gather", icon: "🌿", color: "#5cb85c", gatherVerb: "Cueillir",
    tiers: [
      { id: "herbe_commune",    label: "Herbe commune",    minLevel: 1,  baseXp: 9,   value: 2,   rarity: "commun",     hits: 2 },
      { id: "racine_robuste",   label: "Racine robuste",   minLevel: 10, baseXp: 20,  value: 7,   rarity: "commun",     hits: 3 },
      { id: "fleur_de_givre",   label: "Fleur de givre",   minLevel: 20, baseXp: 38,  value: 22,  rarity: "rare",       hits: 3 },
      { id: "lichen_arcanique", label: "Lichen arcanique", minLevel: 30, baseXp: 66,  value: 58,  rarity: "epique",     hits: 4 },
      { id: "essence_lunaire",  label: "Essence lunaire",  minLevel: 40, baseXp: 104, value: 135, rarity: "epique",     hits: 4 },
      { id: "fleur_eternelle",  label: "Fleur éternelle",  minLevel: 50, baseXp: 170, value: 330, rarity: "legendaire", hits: 5 },
    ],
  },
  // ── Métiers d'artisanat (recettes ajoutées dans une phase ultérieure) ─────────
  { id: "forgeron",   label: "Forgeron",   kind: "craft", icon: "🔨", color: "#d9763c", gatherVerb: "Forger",  tiers: [] },
  { id: "alchimiste", label: "Alchimiste", kind: "craft", icon: "⚗️", color: "#a64dff", gatherVerb: "Distiller", tiers: [] },
  { id: "joaillier",  label: "Joaillier",  kind: "craft", icon: "💎", color: "#3fc7ff", gatherVerb: "Sertir",   tiers: [] },
];

const BY_ID: Record<string, ProfessionDef> = Object.fromEntries(PROFESSIONS.map((p) => [p.id, p]));

export function getProfession(id: ProfessionId): ProfessionDef {
  return BY_ID[id];
}

export const PROFESSION_IDS = PROFESSIONS.map((p) => p.id) as ProfessionId[];

// ── Index ressources (libellé / rareté / valeur par itemId) — pour HUD + économie ──
import type { ResourceTier } from "./professionTypes";
export const RESOURCE_BY_ID: Record<string, ResourceTier> = Object.fromEntries(
  PROFESSIONS.flatMap((p) => p.tiers.map((t) => [t.id, t])),
);
export function resourceLabel(itemId: string): string {
  return RESOURCE_BY_ID[itemId]?.label ?? itemId;
}

export const RARITY_COLOR: Record<string, string> = {
  commun: "#c7cdd6",
  rare: "#3fa9ff",
  epique: "#b46bff",
  legendaire: "#ffb547",
};

// ══════════════════════════════════════════════════════════════════════════════
// Recettes d'artisanat — consomment les ressources récoltées (bois/minerai/plantes)
// → objets fabriqués. Paliers calés sur la même progression (1/10/20/30/40/50).
// ══════════════════════════════════════════════════════════════════════════════
import type { CraftRecipe } from "./professionTypes";

export const RECIPES: CraftRecipe[] = [
  // ── Forgeron : armes & armures (bois + minerai) ─────────────────────────────
  { id: "f_dague_fer", profession: "forgeron", label: "Dague de fer", icon: "🗡️", minLevel: 1, baseXp: 14,
    inputs: [{ itemId: "fer", qty: 2 }, { itemId: "bois_use", qty: 1 }],
    output: { itemId: "dague_fer", label: "Dague de fer", qty: 1, value: 18, rarity: "commun" } },
  { id: "f_epee_acier", profession: "forgeron", label: "Épée d'acier", icon: "⚔️", minLevel: 10, baseXp: 30,
    inputs: [{ itemId: "acier", qty: 3 }, { itemId: "chene_solide", qty: 2 }],
    output: { itemId: "epee_acier", label: "Épée d'acier", qty: 1, value: 65, rarity: "commun" } },
  { id: "f_hache_raffinee", profession: "forgeron", label: "Hache raffinée", icon: "🪓", minLevel: 20, baseXp: 55,
    inputs: [{ itemId: "acier", qty: 4 }, { itemId: "bois_ancien", qty: 2 }],
    output: { itemId: "hache_raffinee", label: "Hache raffinée", qty: 1, value: 150, rarity: "rare" } },
  { id: "f_lame_magique", profession: "forgeron", label: "Lame magique", icon: "🌟", minLevel: 30, baseXp: 95,
    inputs: [{ itemId: "cristal_magique", qty: 3 }, { itemId: "bois_spectral", qty: 2 }],
    output: { itemId: "lame_magique", label: "Lame magique", qty: 1, value: 340, rarity: "epique" } },
  { id: "f_egide_lunaire", profession: "forgeron", label: "Égide lunaire", icon: "🛡️", minLevel: 40, baseXp: 150,
    inputs: [{ itemId: "minerai_lunaire", qty: 4 }, { itemId: "bois_lunaire", qty: 3 }],
    output: { itemId: "egide_lunaire", label: "Égide lunaire", qty: 1, value: 740, rarity: "epique" } },
  { id: "f_lame_adamantite", profession: "forgeron", label: "Lame d'adamantite", icon: "⚜️", minLevel: 50, baseXp: 240,
    inputs: [{ itemId: "adamantite", qty: 5 }, { itemId: "bois_legendaire", qty: 3 }],
    output: { itemId: "lame_adamantite", label: "Lame d'adamantite", qty: 1, value: 1650, rarity: "legendaire" } },

  // ── Alchimiste : potions & élixirs (plantes + minerai) ──────────────────────
  { id: "a_soin_mineur", profession: "alchimiste", label: "Potion de soin mineure", icon: "🧪", minLevel: 1, baseXp: 12,
    inputs: [{ itemId: "herbe_commune", qty: 2 }],
    output: { itemId: "potion_soin_min", label: "Potion de soin mineure", qty: 1, value: 14, rarity: "commun" } },
  { id: "a_vigueur", profession: "alchimiste", label: "Élixir de vigueur", icon: "⚗️", minLevel: 10, baseXp: 28,
    inputs: [{ itemId: "racine_robuste", qty: 3 }, { itemId: "fer", qty: 1 }],
    output: { itemId: "elixir_vigueur", label: "Élixir de vigueur", qty: 1, value: 50, rarity: "commun" } },
  { id: "a_givre", profession: "alchimiste", label: "Philtre de givre", icon: "❄️", minLevel: 20, baseXp: 52,
    inputs: [{ itemId: "fleur_de_givre", qty: 3 }],
    output: { itemId: "philtre_givre", label: "Philtre de givre", qty: 1, value: 125, rarity: "rare" } },
  { id: "a_arcanique", profession: "alchimiste", label: "Décoction arcanique", icon: "🔮", minLevel: 30, baseXp: 90,
    inputs: [{ itemId: "lichen_arcanique", qty: 3 }, { itemId: "cristal_magique", qty: 1 }],
    output: { itemId: "decoction_arcanique", label: "Décoction arcanique", qty: 1, value: 300, rarity: "epique" } },
  { id: "a_lunaire", profession: "alchimiste", label: "Essence concentrée", icon: "🌙", minLevel: 40, baseXp: 145,
    inputs: [{ itemId: "essence_lunaire", qty: 4 }],
    output: { itemId: "essence_concentree", label: "Essence concentrée", qty: 1, value: 690, rarity: "epique" } },
  { id: "a_panacee", profession: "alchimiste", label: "Panacée éternelle", icon: "💟", minLevel: 50, baseXp: 230,
    inputs: [{ itemId: "fleur_eternelle", qty: 5 }, { itemId: "adamantite", qty: 1 }],
    output: { itemId: "panacee_eternelle", label: "Panacée éternelle", qty: 1, value: 1550, rarity: "legendaire" } },

  // ── Joaillier : bijoux (minerai + cristaux + fleurs) ────────────────────────
  { id: "j_anneau_fer", profession: "joaillier", label: "Anneau de fer", icon: "💍", minLevel: 1, baseXp: 13,
    inputs: [{ itemId: "fer", qty: 2 }],
    output: { itemId: "anneau_fer", label: "Anneau de fer", qty: 1, value: 16, rarity: "commun" } },
  { id: "j_pendentif_acier", profession: "joaillier", label: "Pendentif d'acier", icon: "📿", minLevel: 10, baseXp: 29,
    inputs: [{ itemId: "acier", qty: 3 }, { itemId: "racine_robuste", qty: 1 }],
    output: { itemId: "pendentif_acier", label: "Pendentif d'acier", qty: 1, value: 54, rarity: "commun" } },
  { id: "j_bague_givre", profession: "joaillier", label: "Bague de givre", icon: "💎", minLevel: 20, baseXp: 53,
    inputs: [{ itemId: "fleur_de_givre", qty: 2 }, { itemId: "acier", qty: 2 }],
    output: { itemId: "bague_givre", label: "Bague de givre", qty: 1, value: 135, rarity: "rare" } },
  { id: "j_talisman", profession: "joaillier", label: "Talisman magique", icon: "🔱", minLevel: 30, baseXp: 92,
    inputs: [{ itemId: "cristal_magique", qty: 3 }],
    output: { itemId: "talisman_magique", label: "Talisman magique", qty: 1, value: 310, rarity: "epique" } },
  { id: "j_diademe", profession: "joaillier", label: "Diadème lunaire", icon: "👑", minLevel: 40, baseXp: 148,
    inputs: [{ itemId: "minerai_lunaire", qty: 4 }, { itemId: "essence_lunaire", qty: 1 }],
    output: { itemId: "diademe_lunaire", label: "Diadème lunaire", qty: 1, value: 710, rarity: "epique" } },
  { id: "j_couronne", profession: "joaillier", label: "Couronne éternelle", icon: "♛", minLevel: 50, baseXp: 235,
    inputs: [{ itemId: "adamantite", qty: 4 }, { itemId: "fleur_eternelle", qty: 1 }],
    output: { itemId: "couronne_eternelle", label: "Couronne éternelle", qty: 1, value: 1560, rarity: "legendaire" } },
];

export function recipesForProfession(id: ProfessionId): CraftRecipe[] {
  return RECIPES.filter((r) => r.profession === id);
}

// Index des objets fabriqués (label/rareté/valeur) — pour HUD + économie.
export const CRAFT_OUTPUT_BY_ID: Record<string, { label: string; rarity: string; value: number }> =
  Object.fromEntries(RECIPES.map((r) => [r.output.itemId, { label: r.output.label, rarity: r.output.rarity, value: r.output.value }]));

/** Libellé unifié d'un item (ressource récoltée OU objet fabriqué). */
export function itemLabel(itemId: string): string {
  return RESOURCE_BY_ID[itemId]?.label ?? CRAFT_OUTPUT_BY_ID[itemId]?.label ?? itemId;
}
/** Rareté unifiée d'un item (pour la teinte d'affichage). */
export function itemRarity(itemId: string): string {
  return RESOURCE_BY_ID[itemId]?.rarity ?? CRAFT_OUTPUT_BY_ID[itemId]?.rarity ?? "commun";
}
