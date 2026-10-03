// ══════════════════════════════════════════════════════════════════════════════
// Proto_combat/combat/hitDirection.ts — Direction d'un coup encaissé, en 8 secteurs.
//
// Reprend `EACFDirection` (ACF, `ACFCoreTypes.h`) et la méthode de sélection de
// `ComboGraphHelper::GetTagInDirection` (Bacon) : N directions réparties
// uniformément, on garde celle qui MAXIMISE LE PRODUIT SCALAIRE avec la
// direction visée. Cf. docs/COMBAT_MECANIQUES.md §6.
//
// Pourquoi le produit scalaire plutôt qu'une division d'angle : les deux donnent
// le même résultat en 8 secteurs, mais le produit scalaire reste juste quand les
// directions ne sont PAS réparties uniformément (une table à 3 réactions —
// devant / dos / côté — se traite avec le même code).
//
// Module PUR : aucun import de three.js, aucun DOM. Testable sans rendu.
// ══════════════════════════════════════════════════════════════════════════════

/** Les 8 secteurs, dans l'ordre horaire depuis l'avant. Miroir de `EACFDirection`. */
export type HitDirection =
  | "front"
  | "front_right"
  | "right"
  | "back_right"
  | "back"
  | "back_left"
  | "left"
  | "front_left";

/**
 * Ordre CANONIQUE : l'index dans ce tableau EST le secteur, tourné de
 * `i * 2π/8` depuis l'avant, dans le sens horaire (vers la droite du personnage).
 */
export const HIT_DIRECTIONS: readonly HitDirection[] = [
  "front",
  "front_right",
  "right",
  "back_right",
  "back",
  "back_left",
  "left",
  "front_left",
];

/** Ramène un angle dans ]-π, π]. Sans ça, un angle de 3π tomberait dans le mauvais secteur. */
export function normaliseAngle(rad: number): number {
  const deuxPi = Math.PI * 2;
  let a = rad % deuxPi;
  if (a > Math.PI) a -= deuxPi;
  if (a <= -Math.PI) a += deuxPi;
  return a;
}

/**
 * Secteur d'où vient le coup.
 *
 * @param angleRad angle du vecteur « victime → attaquant », exprimé DANS LE
 *   REPÈRE DE LA VICTIME : 0 = pile devant elle, +π/2 = à sa droite, ±π = dans
 *   son dos. C'est bien le repère de la VICTIME et non du monde — un coup dans
 *   le dos ne dépend pas de l'orientation de la caméra.
 */
export function hitDirection(angleRad: number): HitDirection {
  const a = normaliseAngle(angleRad);
  // Direction visée, en coordonnées (avant, droite).
  const vx = Math.cos(a);
  const vy = Math.sin(a);

  const pas = (Math.PI * 2) / HIT_DIRECTIONS.length;
  let meilleur = 0;
  let meilleurDot = -Infinity;
  for (let i = 0; i < HIT_DIRECTIONS.length; i++) {
    const angleSecteur = i * pas;
    const dot = vx * Math.cos(angleSecteur) + vy * Math.sin(angleSecteur);
    if (dot > meilleurDot) {
      meilleurDot = dot;
      meilleur = i;
    }
  }
  return HIT_DIRECTIONS[meilleur];
}

/**
 * Le coup arrive-t-il dans le cône de garde ?
 *
 * `UBlockGameplayEffectComponent` (AdvancedGASSystem) n'ajoute qu'UN champ à
 * l'immunité : `Angle`. Garder n'est donc pas une immunité, c'est un cône
 * frontal — un coup venu du dos traverse la garde intégralement.
 *
 * @param coneDeg ouverture TOTALE du cône (120° = 60° de chaque côté de l'avant).
 */
export function dansConeDeGarde(angleRad: number, coneDeg: number): boolean {
  return Math.abs(normaliseAngle(angleRad)) <= (coneDeg * Math.PI) / 360;
}

/**
 * Clip de réaction pour un secteur, avec repli.
 *
 * La bibliothèque actuelle n'a QU'UN clip `hit`. La règle directionnelle est
 * quand même écrite maintenant : le jour où les huit clips arrivent, seule cette
 * table change. L'inverse — coder « un seul hit » puis rétro-ajouter la
 * direction — obligerait à retoucher tous les appelants.
 *
 * @param disponibles noms de clips réellement résolus sur le rig.
 */
export function clipReaction(
  dir: HitDirection,
  disponibles: ReadonlySet<string>,
): string {
  const candidats = [`hit_${dir}`, ...REPLIS[dir], "hit"];
  for (const c of candidats) if (disponibles.has(c)) return c;
  return "hit"; // dernier recours : l'appelant sait que le clip peut manquer
}

/** Repli d'un secteur vers le secteur cardinal le plus proche. */
const REPLIS: Record<HitDirection, string[]> = {
  front: [],
  front_right: ["hit_front", "hit_right"],
  right: [],
  back_right: ["hit_back", "hit_right"],
  back: [],
  back_left: ["hit_back", "hit_left"],
  left: [],
  front_left: ["hit_front", "hit_left"],
};
