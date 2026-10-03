// ══════════════════════════════════════════════════════════════════════════════
// npc/npcLeveling.ts — Système de niveaux des PNJ/monstres (logique PURE)
//
// Source de vérité UNIQUE pour :
//   • la plage de niveaux de chaque zone (Forge 1-20, Spatial 10-30, Tower 30-50)
//   • la courbe de difficulté (PV / dégâts / puissance des sorts par niveau)
//   • l'XP octroyée à la mort
//   • la répartition des niveaux DANS une zone (selon la distance au hub)
//   • la configuration "serveur" (mode héroïque ×2)
//
// Aucune dépendance React/Three → testable et réutilisable côté serveur/SQL.
//
// CHOIX DE DESIGN (validés avec l'utilisateur) :
//   • Courbe ÉQUILIBRÉE : progression maîtrisée, calquée sur le joueur (+8 %/niv).
//     Les ennemis montent un peu plus vite en PV pour rester "coriaces" sans être
//     injustes — le sous-niveau se paie, mais le joueur de bon niveau s'en sort.
//   • Répartition SELON LA DISTANCE : proche du hub = bas de plage, loin = haut.
//   • SERVEUR HÉROÏQUE : multiplicateur global isolé dans SERVER_CONFIG (×2 XP).
// ══════════════════════════════════════════════════════════════════════════════

// ── Plages de niveaux par zone (clé = id de map dans assetManifest.MAPS) ───────
export const ZONE_LEVEL_RANGES: Record<string, [number, number]> = {
  forge:   [1, 20],   // Forge World — première zone
  orbital: [10, 30],  // Maps spatiales — zone intermédiaire
  tower:   [30, 50],  // Tower defense — zone finale
};

/** Plage par défaut si une map n'est pas répertoriée. */
const DEFAULT_RANGE: [number, number] = [1, 20];

/** Plage [min, max] de niveaux d'une zone. */
export function zoneLevelRange(zoneId: string): [number, number] {
  return ZONE_LEVEL_RANGES[zoneId] ?? DEFAULT_RANGE;
}

// ── Courbe de difficulté (ÉQUILIBRÉE) ──────────────────────────────────────────
// Le joueur gagne +8 %/niveau (cf. createStats). On garde les ennemis dans le
// même ordre de grandeur, légèrement plus tanky pour le "ressenti d'élite".
export const HP_GROWTH_PER_LEVEL  = 0.12; // +12 % PV par niveau
export const DMG_GROWTH_PER_LEVEL = 0.10; // +10 % dégâts (et puissance des sorts)/niveau

// XP : xp = K · niveau^1.5. Même exposant que la courbe joueur (xpForLevel = 80·L^1.5)
// → le nombre de kills par niveau reste CONSTANT sur tout le jeu (les L^1.5 s'annulent).
// K = 13 ⇒ ~6 kills/niveau en normal, ~3 en héroïque (×2). "Pas trop rapide". ✓
export const XP_PER_KILL_K = 13;

// ── Configuration "serveur" (un seul endroit à régler) ─────────────────────────
export const SERVER_CONFIG = {
  /** Nom du mode (cosmétique / futur HUD). */
  name: "Héroïque",
  /** Multiplicateur de gain d'XP. Serveur héroïque = ×2 (demande utilisateur). */
  xpRate: 2,
  /**
   * Multiplicateur GLOBAL de difficulté ennemie (PV + dégâts), au-dessus de la
   * courbe par niveau. 1 = courbe seule (numéros exactement comme prévisualisés).
   * Passer à 2 pour doubler la dureté brute des ennemis sur tout le jeu.
   */
  enemyStatMult: 1,
} as const;

/** Multiplicateur de PV pour un niveau (courbe + difficulté serveur). */
export function enemyHpMultiplier(level: number): number {
  return (1 + (level - 1) * HP_GROWTH_PER_LEVEL) * SERVER_CONFIG.enemyStatMult;
}

/** Multiplicateur de dégâts / puissance des sorts pour un niveau. */
export function enemyDamageMultiplier(level: number): number {
  return (1 + (level - 1) * DMG_GROWTH_PER_LEVEL) * SERVER_CONFIG.enemyStatMult;
}

/** XP octroyée au joueur pour avoir vaincu un ennemi de ce niveau (inclut xpRate). */
export function xpForKill(level: number): number {
  return Math.round(XP_PER_KILL_K * Math.pow(level, 1.5) * SERVER_CONFIG.xpRate);
}

// ── Répartition des niveaux DANS une zone (selon la distance au hub) ───────────
/**
 * Niveau d'un spawn d'après sa distance horizontale au centre du hub (0,0).
 * Proche = bas de la plage de zone ; loin = haut de la plage.
 *
 * IMPORTANT : on normalise sur la PLAGE DE DISTANCE DES ENNEMIS [minDist, maxDist],
 * pas sur l'absolu. Les ennemis d'une zone sont souvent regroupés dans un anneau
 * (p.ex. 44-58 m du hub) ; sans ça, ils se tasseraient tous en haut de plage.
 * Ainsi l'ennemi le plus proche = niveau min de zone, le plus loin = niveau max,
 * et la plage complète (p.ex. 1-20) est réellement exploitée. Les PNJ plus proches
 * que le 1er ennemi (alliés au hub) sont ramenés au niveau min.
 *
 * @param zoneId   id de la map (détermine la plage)
 * @param dist     distance horizontale (m) du spawn au centre
 * @param minDist  distance de l'ennemi le PLUS PROCHE (→ niveau min de zone)
 * @param maxDist  distance de l'ennemi le PLUS LOIN   (→ niveau max de zone)
 */
export function levelFromDistance(
  zoneId: string, dist: number, minDist: number, maxDist: number,
): number {
  const [min, max] = zoneLevelRange(zoneId);
  const span = maxDist - minDist;
  const t = span > 0 ? Math.min(1, Math.max(0, (dist - minDist) / span)) : 0;
  return Math.max(min, Math.min(max, Math.round(min + t * (max - min))));
}

// ── Couleur du tag de niveau (ressenti de palier / danger) ─────────────────────
/** Couleur du "[Lvl N]" selon le palier — aide à jauger le danger d'un coup d'œil. */
export function levelTierColor(level: number): string {
  if (level <= 10) return "#c8d4e0"; // gris-blanc — commun
  if (level <= 20) return "#6ee7a8"; // vert      — peu dangereux
  if (level <= 30) return "#5bb8ff"; // bleu      — intermédiaire
  if (level <= 40) return "#c084fc"; // violet    — dangereux
  return "#ff8a4c";                  // orange    — élite
}
