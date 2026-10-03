// ══════════════════════════════════════════════════════════════════════════════
// proceduralLoot.ts — Générateur d'items procéduraux avec raretés pondérées
// Module pur (aucun effet de bord) : le RNG est injecté pour permettre les tests.
// ══════════════════════════════════════════════════════════════════════════════

// ── Raretés procédurales (sous-ensemble des raretés globales du projet) ────────
export type ProceduralRarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythic';

/** Couleurs canoniques par rareté procédurale. */
export const RARITY_COLORS: Record<ProceduralRarity, string> = {
  common:    '#c0c0c0', // gris
  rare:      '#4ade80', // vert
  epic:      '#5b9bff', // bleu
  legendary: '#c084fc', // violet
  mythic:    '#ff8a4c', // orange
};

/**
 * Distribution cumulative pour pickRarity().
 * Chaque entrée = [rareté, seuil cumulé].
 * common 0→0.65 (65 %), rare 0.65→0.85 (20 %), epic 0.85→0.95 (10 %),
 * legendary 0.95→0.99 (4 %), mythic 0.99→1.00 (1 %).
 */
export const RARITY_THRESHOLDS: Array<[ProceduralRarity, number]> = [
  ['common',    0.65],
  ['rare',      0.85],
  ['epic',      0.95],
  ['legendary', 0.99],
  ['mythic',    1.0],
];

/** Multiplicateurs de stats selon la rareté. */
const RARITY_MULT: Record<ProceduralRarity, number> = {
  common:    1,
  rare:      1.5,
  epic:      2.2,
  legendary: 3.2,
  mythic:    4.5,
};

// ── Types d'items ──────────────────────────────────────────────────────────────
export type ItemKind = 'weapon' | 'armor' | 'tech_component' | 'space_artifact';

// ── Item procédural généré ─────────────────────────────────────────────────────
export interface ProceduralItem {
  id: string;
  /** Nom complet ex. « Sabre Plasma Légendaire de Lvl 12 » */
  name: string;
  kind: ItemKind;
  rarity: ProceduralRarity;
  level: number;
  /** Couleur hex = RARITY_COLORS[rarity] */
  color: string;
  stats: {
    puissance?: number;
    defense?: number;
    critique?: number;
    vitesse?: number;
  };
  /** Valeur économique en crédits. */
  value: number;
}

// ── Listes de noms ─────────────────────────────────────────────────────────────
const ADJECTIVES = ['Sombre', 'Pulsant', 'Brisé', 'Ancien', 'Spectral'];

const BASE_NAMES: Record<ItemKind, string[]> = {
  weapon:          ['Sabre', 'Pistolet', 'Lame', 'Foudre'],
  armor:           ['Armure', 'Plastron', 'Bouclier'],
  tech_component:  ['Module', 'Circuit', 'Coeur'],
  space_artifact:  ['Relique', 'Fragment', 'Sceau'],
};

const RARITY_TITLE: Record<ProceduralRarity, string> = {
  common:    'Commun',
  rare:      'Rare',
  epic:      'Épique',
  legendary: 'Légendaire',
  mythic:    'Mythique',
};

// ── Utilitaire : pick aléatoire dans un tableau ─────────────────────────────────
function pickFrom<T>(arr: T[], rng: () => number): T {
  return arr[Math.floor(rng() * arr.length)];
}

// ── API publique ───────────────────────────────────────────────────────────────

/**
 * Sélectionne une rareté procédurale à partir d'un seul tirage RNG [0, 1[.
 * @param rng Fonction renvoyant un nombre dans [0, 1[ (injectée pour les tests).
 */
export function pickRarity(rng: () => number): ProceduralRarity {
  const r = rng();
  for (const [rarity, threshold] of RARITY_THRESHOLDS) {
    if (r < threshold) return rarity;
  }
  // Sécurité : r === 1.0 (cas théorique) → mythic
  return 'mythic';
}

/**
 * Génère un item procédural à partir d'un niveau et d'un RNG injecté.
 * Fonction pure : aucun effet de bord.
 *
 * @param level  Niveau de l'ennemi (influence les stats).
 * @param rng    Générateur de nombres aléatoires [0, 1[.
 */
export function generateItem(level: number, rng: () => number): ProceduralItem {
  // 1) Rareté
  const rarity = pickRarity(rng);

  // 2) Type d'item
  const kinds: ItemKind[] = ['weapon', 'armor', 'tech_component', 'space_artifact'];
  const kind = kinds[Math.floor(rng() * 4)] as ItemKind;

  // 3) Multiplicateur de rareté
  const rarityMult = RARITY_MULT[rarity];

  // 4) Stats selon le kind
  //    Formule pour chaque stat : base = (5 + level * 0.4) * rarityMult, arrondi
  const statBase = (5 + level * 0.4) * rarityMult;
  const s = Math.round(statBase);

  const stats: ProceduralItem['stats'] = {};
  switch (kind) {
    case 'weapon':
      stats.puissance = s;
      stats.critique  = s;
      break;
    case 'armor':
      stats.defense = s;
      // vitesse = légère pénalité (valeur positive représente la réduction de vitesse)
      stats.vitesse = Math.max(1, Math.round(s * 0.3));
      break;
    case 'tech_component':
      stats.critique = s;
      stats.vitesse  = s;
      break;
    case 'space_artifact':
      stats.puissance = s;
      stats.defense   = s;
      break;
  }

  // 5) Nom : {Adjectif} {Nom-de-base} {RaretéTitle} de Lvl {level}
  const adjective = pickFrom(ADJECTIVES, rng);
  const baseName  = pickFrom(BASE_NAMES[kind], rng);
  const name = `${adjective} ${baseName} ${RARITY_TITLE[rarity]} de Lvl ${level}`;

  // 6) id (utilise rng pour le suffixe aléatoire → reproductible en test avec rng fixe)
  const suffix = Math.floor(rng() * 10_000);
  const id = `gen_${rarity}_${kind}_${Date.now()}_${suffix}`;

  // 7) value
  const value = Math.round((10 + level * 5) * rarityMult);

  return {
    id,
    name,
    kind,
    rarity,
    level,
    color: RARITY_COLORS[rarity],
    stats,
    value,
  };
}
