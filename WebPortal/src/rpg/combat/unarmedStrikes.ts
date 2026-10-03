// ══════════════════════════════════════════════════════════════════════════════
// combat/unarmedStrikes.ts — Frappes mains nues LATÉRALISÉES (gauche / droite).
//
// CE QUE LA MESURE A DONNÉ, et pourquoi les poings et les pieds ne sont pas
// traités pareil :
//
//   POINGS — le pack `animations/FPP_combat_fists` en contient 36, déjà
//   latéralisés à la source : jab / hook / uppercut, × Lhand / Rhand,
//   × slow / normal / fast, × 2 variantes. Rien à fabriquer, tout est là.
//   « FPP » = First Person Perspective : ce sont précisément les clips qu'il
//   faut pour la vue à la première personne.
//
//   PIEDS — UN SEUL clip dans toute la bibliothèque : `attack_special_kick`,
//   sans latéralité. Vérifié sur `animations/`, `assets_character/`,
//   `systemes/` et `personnages/`. Il n'y a donc rien à choisir : le pied
//   gauche s'obtient en MIROITANT le droit (cf. `mirrorClip`).
//
// La latéralité n'est pas cosmétique : elle porte l'alternance du combo. Un
// enchaînement qui frappe deux fois du même poing se lit immédiatement comme
// une animation en boucle plutôt que comme un combat.
// ══════════════════════════════════════════════════════════════════════════════

/** Côté du corps qui frappe. */
export type StrikeSide = "left" | "right";

/** Nature du coup — pilote les dégâts et la portée. */
export type StrikeKind = "jab" | "hook" | "uppercut" | "kick";

export interface StrikeDef {
  kind: StrikeKind;
  side: StrikeSide;
  /**
   * Clips candidats, du plus spécifique au plus générique. Le premier résolu
   * gagne — même stratégie que `CLIP_CANDIDATES` d'AnimationController, pour
   * qu'un rig sans le clip exact retombe sur un équivalent au lieu de figer.
   */
  clips: string[];
  /**
   * `true` = le clip source est de l'AUTRE côté et doit être miroité.
   * Concerne uniquement les coups de pied : il n'en existe qu'un.
   */
  mirrored?: boolean;
  /** Multiplicateur de dégâts, relatif au coup de base. */
  damageMult: number;
  /** Portée en mètres. Un pied porte plus loin qu'un jab. */
  range: number;
  /** Durée avant l'impact (ms) — quand les dégâts s'appliquent dans le clip. */
  impactMs: number;
}

const FPP = "attack";

/**
 * Un jab est rapide et faible, un uppercut lent et fort, un coup de pied porte
 * loin. Ces valeurs viennent de la lisibilité du combat, pas d'un équilibrage
 * chiffré — elles sont là pour que les coups se DISTINGUENT au ressenti.
 */
export const STRIKES: Record<string, StrikeDef> = {
  jab_l:      { kind: "jab",      side: "left",  damageMult: 0.8, range: 1.8, impactMs: 110,
                clips: [`${FPP}_jab_fast_Lhand_01`, `${FPP}_jab_Lhand_01`, `${FPP}_jab_Lhand_02`, "punch1", "Punching"] },
  jab_r:      { kind: "jab",      side: "right", damageMult: 0.8, range: 1.8, impactMs: 110,
                clips: [`${FPP}_jab_fast_Rhand_01`, `${FPP}_jab_Rhand_01`, `${FPP}_jab_Rhand_02`, "punch1", "Punching"] },
  hook_l:     { kind: "hook",     side: "left",  damageMult: 1.2, range: 1.6, impactMs: 170,
                clips: [`${FPP}_hook_Lhand_01`, `${FPP}_hook_Lhand_02`, `${FPP}_hook_fast_Lhand_01`, "punch2", "Cross Punch"] },
  hook_r:     { kind: "hook",     side: "right", damageMult: 1.2, range: 1.6, impactMs: 170,
                clips: [`${FPP}_hook_Rhand_01`, `${FPP}_hook_Rhand_02`, `${FPP}_hook_fast_Rhand_01`, "punch2", "Cross Punch"] },
  uppercut_l: { kind: "uppercut", side: "left",  damageMult: 1.8, range: 1.5, impactMs: 240,
                clips: [`${FPP}_uppercut_Lhand_01`, `${FPP}_uppercut_Lhand_02`, "punch3", "Uppercut"] },
  uppercut_r: { kind: "uppercut", side: "right", damageMult: 1.8, range: 1.5, impactMs: 240,
                clips: [`${FPP}_uppercut_Rhand_01`, `${FPP}_uppercut_Rhand_02`, "punch3", "Uppercut"] },

  // Le clip source est un coup de pied DROIT. Le gauche en est le miroir —
  // c'est la seule façon d'avoir les deux côtés avec un unique clip.
  kick_r:     { kind: "kick",     side: "right", damageMult: 1.6, range: 2.3, impactMs: 260,
                clips: [`${FPP}_special_kick`, "kick", "Roundhouse Kick"] },
  kick_l:     { kind: "kick",     side: "left",  damageMult: 1.6, range: 2.3, impactMs: 260, mirrored: true,
                clips: [`${FPP}_special_kick`, "kick", "Roundhouse Kick"] },
};

export type StrikeId = keyof typeof STRIKES;

/** Ordre d'alternance des poings — gauche, droite, gauche… */
const POINGS: StrikeId[] = ["jab_l", "jab_r", "hook_l", "hook_r"];
const FINISHERS: StrikeId[] = ["uppercut_r", "uppercut_l", "kick_r", "kick_l"];

/**
 * Choisit la frappe du pas `step` du combo.
 *
 * ALTERNANCE GARANTIE : le côté est déduit de la PARITÉ du pas, pas d'un tirage.
 * Un aléatoire pur produirait des séries « gauche gauche gauche » qui se lisent
 * comme un bug d'animation. Le hasard ne sert qu'à choisir la NATURE du
 * finisher, jamais son côté.
 */
export function strikeForStep(
  step: number,
  isFinisher: boolean,
  rng: () => number = Math.random,
): StrikeId {
  const gauche = step % 2 === 1;   // pas impair → poing gauche
  if (!isFinisher) {
    const base = step <= 2 ? 0 : 2; // jab d'abord, crochet ensuite
    return POINGS[base + (gauche ? 0 : 1)];
  }
  // Finisher : nature tirée au sort, côté toujours imposé par la parité.
  const pied = rng() < 0.5;
  if (pied) return gauche ? "kick_l" : "kick_r";
  return gauche ? "uppercut_l" : "uppercut_r";
}

/**
 * Dégâts d'une frappe. `puissance` est la stat du personnage.
 *
 * Le multiplicateur de finisher reste séparé du `damageMult` de la frappe :
 * un uppercut vaut 1,8× qu'il termine un combo ou non, et le finisher double
 * par-dessus. Les deux effets se composent, ils ne se remplacent pas.
 */
export function strikeDamage(id: StrikeId, puissance: number, isFinisher: boolean): number {
  const base = 5 + puissance * 0.4;
  const s = STRIKES[id];
  const brut = base * (s?.damageMult ?? 1) * (isFinisher ? 2 : 1);
  return Math.max(1, Math.round(brut));
}

/** Le clip de cette frappe doit-il être joué en miroir ? */
export function isMirrored(id: StrikeId): boolean {
  return STRIKES[id]?.mirrored === true;
}
