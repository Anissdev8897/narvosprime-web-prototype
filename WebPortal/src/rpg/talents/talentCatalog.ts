// ══════════════════════════════════════════════════════════════════════════════
// talents/talentCatalog.ts — Arbre de talents par ARCHÉTYPES de combat
//
// 4 branches universelles (toutes classes) : Dégâts / Survie / Mobilité / Mana.
// Le joueur gagne 1 point de talent tous les LEVELS_PER_TALENT_POINT niveaux
// (cf talentEffects.ts) et les investit dans des nœuds tiérés.
//
// Chaque nœud porte un EFFET PAR RANG (cumulatif). L'agrégat de tous les rangs
// investis est calculé par talentEffects.aggregateTalents() et appliqué au plus
// près de chaque usage (dégâts, stats, coût/régén mana, vitesse).
//
// 💡 Pour équilibrer : ajuste les valeurs `effect`, `maxRank`, ou ajoute des
//    nœuds. Les prérequis (`requires`) forcent un ordre de progression.
// ══════════════════════════════════════════════════════════════════════════════

export type TalentBranch = "damage" | "survival" | "mobility" | "mana";

/** Effet d'UN rang de talent (valeurs additionnées par rang investi). */
export interface TalentEffect {
  /** +% dégâts des sorts (0.06 = +6 %/rang). */
  damagePct?: number;
  /** +points de critique (plat, %/rang). */
  critFlat?: number;
  /** +% PV max. */
  maxHpPct?: number;
  /** +points de défense (plat). */
  defenseFlat?: number;
  /** +% mana max. */
  maxManaPct?: number;
  /** -% coût en mana des sorts (0.06 = -6 %/rang). */
  manaCostReductionPct?: number;
  /** +% régénération de mana. */
  manaRegenPct?: number;
  /** +% vitesse de déplacement. */
  moveSpeedPct?: number;
}

export interface TalentNode {
  id: string;
  branch: TalentBranch;
  name: string;
  description: string;
  /** Rang maximum investissable. */
  maxRank: number;
  /** Profondeur dans la branche (1 = base). Pour le layout vertical. */
  tier: number;
  /** id du nœud prérequis (doit avoir ≥ 1 rang). undefined = racine. */
  requires?: string;
  /** Effet appliqué PAR rang. */
  effect: TalentEffect;
}

export const BRANCH_META: Record<TalentBranch, { label: string; color: string; icon: string }> = {
  damage:   { label: "Dégâts",   color: "#ef4444", icon: "⚔️" },
  survival: { label: "Survie",   color: "#22c55e", icon: "🛡️" },
  mobility: { label: "Mobilité", color: "#38bdf8", icon: "💨" },
  mana:     { label: "Mana",     color: "#a855f7", icon: "🔮" },
};

export const TALENTS: TalentNode[] = [
  // ── Dégâts ───────────────────────────────────────────────────────────────
  { id: "dmg_sharp",   branch: "damage",   name: "Frappe aiguisée", tier: 1, maxRank: 3,
    description: "Augmente les dégâts de tous tes sorts.",
    effect: { damagePct: 0.06 } },
  { id: "dmg_precise", branch: "damage",   name: "Précision",       tier: 2, maxRank: 3, requires: "dmg_sharp",
    description: "Augmente ton taux de critique.",
    effect: { critFlat: 3 } },
  { id: "dmg_overload",branch: "damage",   name: "Surcharge",       tier: 3, maxRank: 2, requires: "dmg_precise",
    description: "Dégâts de sorts massivement accrus.",
    effect: { damagePct: 0.10 } },

  // ── Survie ───────────────────────────────────────────────────────────────
  { id: "sur_vitality",branch: "survival", name: "Vitalité",        tier: 1, maxRank: 3,
    description: "Augmente tes points de vie maximum.",
    effect: { maxHpPct: 0.08 } },
  { id: "sur_carapace",branch: "survival", name: "Carapace",        tier: 2, maxRank: 3, requires: "sur_vitality",
    description: "Augmente ta défense (réduction des dégâts reçus).",
    effect: { defenseFlat: 4 } },
  { id: "sur_endurance",branch: "survival",name: "Endurance",       tier: 3, maxRank: 2, requires: "sur_carapace",
    description: "Réserve de PV supplémentaire pour les combats longs.",
    effect: { maxHpPct: 0.07 } },

  // ── Mobilité ─────────────────────────────────────────────────────────────
  { id: "mob_celerity",branch: "mobility", name: "Célérité",        tier: 1, maxRank: 3,
    description: "Augmente ta vitesse de déplacement.",
    effect: { moveSpeedPct: 0.05 } },
  { id: "mob_stride",  branch: "mobility", name: "Foulée ample",    tier: 2, maxRank: 2, requires: "mob_celerity",
    description: "Vitesse de déplacement encore accrue.",
    effect: { moveSpeedPct: 0.06 } },
  { id: "mob_reflex",  branch: "mobility", name: "Réflexes",        tier: 3, maxRank: 2, requires: "mob_stride",
    description: "Initiative au combat + un peu de critique.",
    effect: { critFlat: 2 } },

  // ── Mana ─────────────────────────────────────────────────────────────────
  { id: "man_affinity",branch: "mana",     name: "Affinité magique",tier: 1, maxRank: 3,
    description: "Augmente ta réserve de mana maximum.",
    effect: { maxManaPct: 0.08 } },
  { id: "man_economy", branch: "mana",     name: "Économie",        tier: 2, maxRank: 3, requires: "man_affinity",
    description: "Réduit le coût en mana de tes sorts.",
    effect: { manaCostReductionPct: 0.06 } },
  { id: "man_flow",    branch: "mana",     name: "Flux arcanique",  tier: 3, maxRank: 2, requires: "man_economy",
    description: "Accélère la régénération de ton mana.",
    effect: { manaRegenPct: 0.12 } },
];

const BY_ID: Record<string, TalentNode> = Object.fromEntries(TALENTS.map((t) => [t.id, t]));
export function getTalent(id: string): TalentNode | undefined { return BY_ID[id]; }

export function talentsByBranch(branch: TalentBranch): TalentNode[] {
  return TALENTS.filter((t) => t.branch === branch).sort((a, b) => a.tier - b.tier);
}
