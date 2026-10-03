// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/bodyProportions.ts — Réglages fins de silhouette.
//
// Trois curseurs : largeur d'épaule, hauteur de taille, longueur des bras.
//
// ── POURQUOI DES OS ET PAS DES MORPHS ────────────────────────────────────────
//
// Un morph target déformerait le maillage librement, mais il faudrait l'AUTEUR
// du morph : le pack Biker n'en fournit aucun, et les 1445 cibles MPFB2 sont
// indexées sur une topologie différente (19 158 sommets contre 8 049 pour notre
// tête — mesuré par `scripts/check-target-topology.mjs`). Les appliquer ici
// donnerait du bruit, pas une morphologie.
//
// Le squelette, lui, est commun aux deux genres (161 os, 100 % de recouvrement).
// Mettre un os à l'échelle déplace la peau qui lui est liée : c'est exact,
// gratuit, et ça marche sur toute pièce greffée sans traitement particulier.
//
// ── LES BORNES SONT VOLONTAIREMENT ÉTROITES ──────────────────────────────────
//
// ±10 %. Au-delà, la peau se pince aux articulations : les poids de skinning ont
// été peints pour la silhouette d'origine, pas pour une épaule deux fois plus
// large. Un curseur qui casse le personnage à fond de course n'est pas un
// réglage, c'est un piège.
// ══════════════════════════════════════════════════════════════════════════════

/** Réglages de silhouette. `0` = morphologie d'origine, bornes ±1. */
export interface BodyProportions {
  /** Écartement des clavicules. */
  shoulderWidth: number;
  /** Élévation de la taille (allonge le buste, raccourcit les jambes). */
  waistHeight: number;
  /** Allongement des bras. */
  armLength: number;
}

export const DEFAULT_PROPORTIONS: BodyProportions = {
  shoulderWidth: 0,
  waistHeight: 0,
  armLength: 0,
};

/** Amplitude maximale appliquée à l'échelle d'un os, en fraction. */
export const PROPORTION_RANGE = 0.1;

export interface ProportionDef {
  key: keyof BodyProportions;
  label: string;
  /** Os affectés — noms du mannequin UE5, communs aux deux genres. */
  bones: string[];
  /**
   * Os recevant l'échelle INVERSE.
   *
   * Une échelle non uniforme se propage aux enfants. Un enfant pivoté par
   * rapport à son parent reçoit le facteur sur un axe qui n'est plus le sien :
   * ça cisaille au lieu d'allonger. Poser `1/f` sur lui annule exactement
   * l'héritage — il est repoussé par le parent allongé, mais garde sa forme.
   */
  counterBones?: string[];
  /** Axe local mis à l'échelle. */
  axis: "x" | "y" | "z";
}

/**
 * Quels os pour quel curseur.
 *
 * Les os sont nommés explicitement plutôt que déduits d'un préfixe : `upperarm`
 * matche 24 os sur ce squelette (twists, correctifs, biceps…), et les mettre
 * TOUS à l'échelle déformerait deux fois la même chair.
 */
export const PROPORTION_DEFS: ProportionDef[] = [
  {
    key: "shoulderWidth",
    label: "Largeur d'épaule",
    bones: ["clavicle_l", "clavicle_r"],
    axis: "x",
  },
  {
    key: "waistHeight",
    label: "Hauteur de la taille",
    // Seulement les deux premières vertèbres : au-delà, on allonge le thorax et
    // la tête part vers le plafond au lieu que la taille remonte.
    bones: ["spine_01", "spine_02"],
    // X, pas Y. Mesuré : `spine_01 → spine_02` translate de [0.07, 0, 0].
    // L'intuition « la colonne monte, donc Y » est fausse ici — l'axe est
    // LOCAL à l'os, pas celui du monde.
    axis: "x",
  },
  {
    key: "armLength",
    label: "Longueur des bras",
    // ── POURQUOI SEULEMENT LA RACINE DE LA CHAÎNE ────────────────────────────
    //
    // Symptôme rapporté : les bras ÉPAISSISSENT au lieu de s'allonger. L'axe
    // n'est pourtant pas en cause — mesuré, `upperarm_l → lowerarm_l` translate
    // de [0.28, 0, 0], donc X est bien l'axe long.
    //
    // Cause : une échelle NON UNIFORME se propage aux enfants. `lowerarm` est
    // pivoté par rapport à `upperarm` ; le facteur reçu sur X ne tombe plus le
    // long de l'avant-bras mais en travers, ce qui cisaille au lieu d'allonger.
    // C'est la raison pour laquelle les rigs d'animation évitent l'échelle non
    // uniforme sur les os.
    //
    // `upperarm` s'allonge, `lowerarm` reçoit l'inverse : il est repoussé par le
    // bras allongé mais garde ses propres proportions, au lieu d'hériter d'un
    // facteur qui ne tombe plus le long de son axe.
    bones: ["upperarm_l", "upperarm_r"],
    counterBones: ["lowerarm_l", "lowerarm_r"],
    axis: "x",
  },
];

/** Ramène une valeur dans [-1, 1]. `NaN` et absent → 0. */
export function clampProportion(v: number | undefined): number {
  if (typeof v !== "number" || !Number.isFinite(v)) return 0;
  return Math.max(-1, Math.min(1, v));
}

/**
 * Normalise des réglages venus du stockage.
 *
 * Un personnage d'avant ces curseurs n'a pas de proportions ; un fichier corrompu
 * peut en avoir de folles. Les deux doivent donner une silhouette d'origine, pas
 * un personnage tordu.
 */
export function sanitizeProportions(p?: Partial<BodyProportions> | null): BodyProportions {
  return {
    shoulderWidth: clampProportion(p?.shoulderWidth),
    waistHeight: clampProportion(p?.waistHeight),
    armLength: clampProportion(p?.armLength),
  };
}

/**
 * Facteur d'échelle d'un curseur : −1 → 0,9 · 0 → 1 · +1 → 1,1.
 *
 * Toujours strictement positif — une échelle nulle ou négative retournerait la
 * géométrie de l'os et enverrait le membre à l'envers.
 */
export function scaleFactor(value: number): number {
  return 1 + clampProportion(value) * PROPORTION_RANGE;
}

/** `true` si aucun réglage ne s'écarte de l'origine — permet de sauter le parcours du squelette. */
export function isDefaultProportions(p: BodyProportions): boolean {
  return PROPORTION_DEFS.every((d) => clampProportion(p[d.key]) === 0);
}
