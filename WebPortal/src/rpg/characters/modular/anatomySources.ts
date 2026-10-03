// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/anatomySources.ts — Quelles sources ont droit aux
// carrousels d'anatomie du créateur de personnage.
//
// ── LE PROBLÈME QUE ÇA RÈGLE (05/08/2026) ────────────────────────────────────
//
// `slotSource()` sépare déjà les EMPLACEMENTS : anatomie au créateur, vêtements
// au marchand. Ça ne suffit pas, parce que le découpeur range une pièce par sa
// GÉOMÉTRIE, pas par sa nature : une veste couvre le buste, donc elle sort en
// région `torso` ; des bottes sortent en `feet` ; un chapeau en `head`.
//
// Résultat mesuré avant ce filtre : 40 options dans le carrousel « torse »,
// dont des vestes de zombie, des plastrons de trooper et du cuir de biker. Les
// vrais corps nus étaient noyés — le corps MPFB2 arrivait en 9ᵉ position, et
// passait pour absent.
//
// ── POURQUOI UNE LISTE BLANCHE, ET PAS UN MOTIF SUR LE NOM ───────────────────
//
// Un filtre `/jacket|boots|helmet/` paraît suffisant et ne l'est pas : il laisse
// passer `nuc_jeans`, `nuc_bulletproof`, `nuc_holster`, et il ne dit rien de
// `echo`, `steel` ou `zs4_body` — des personnages qu'on ne sait pas nus sans les
// ouvrir. Un motif qui se trompe REMET de l'armure dans l'anatomie, en silence.
//
// D'où l'inverse : **tout est exclu sauf ce qui est nommé ici**. Une source
// ajoutée par une future extraction reste dehors jusqu'à ce que quelqu'un l'ait
// regardée. C'est le seul sens qui rate du bon côté.
// ══════════════════════════════════════════════════════════════════════════════

import { slotSource, type BodySlot } from "./bodySlots";

/**
 * Sources dont les pièces sont de l'anatomie humaine nue.
 *
 * - `biker`             pack Biker écrit à la main : `m_head_01`, `m_arms`,
 *                       `m_hands`, et surtout `m_body`/`f_body`. Ses vêtements
 *                       vivent dans des slots marchand, ils ne passent pas ici.
 * - `biker_m` `biker_f` les deux corps canoniques, découpés en 6 pièces chacun.
 * - `mpfb`              corps MakeHuman HM08, importé depuis l'addon Blender
 *                       MPFB2. Non dimorphique, donc proposé aux deux genres.
 */
export const ANATOMY_SOURCES: ReadonlySet<string> = new Set([
  "biker",
  "biker_m",
  "biker_f",
  "mpfb",
]);

/**
 * Emplacements soumis à la liste blanche.
 *
 * `hair` en est VOLONTAIREMENT absent. Ni les corps Biker ni MPFB2 n'ont de
 * cheveux : filtrer ferait tomber le carrousel à zéro option, et « TÊTES ET
 * CHEVEUX » perdrait sa moitié. Une coiffure n'est pas une armure — c'est de
 * l'apparence, elle reste au créateur.
 *
 * `body` en est absent aussi : il n'a qu'une liste générée
 * (`bodyArchetypes`), sans pièce de pack.
 */
export const ANATOMY_FILTERED_SLOTS: readonly BodySlot[] = [
  "head",
  "torso",
  "arms",
  "hands",
  "legs",
  "feet",
];

/** Cet emplacement est-il soumis à la liste blanche ? */
export function isAnatomyFiltered(slot: BodySlot): boolean {
  return ANATOMY_FILTERED_SLOTS.includes(slot);
}

/**
 * Cette pièce passe-t-elle la liste blanche ?
 *
 * ⚠ Ne répond QUE de la nature de la pièce, pas de son emplacement : hors des
 * emplacements filtrés, tout passe — y compris un casque, qui appartient au
 * marchand. C'est voulu : le filtre vise la pollution par l'armure DANS
 * l'anatomie, il n'a rien à dire du reste du catalogue.
 *
 * Pour « cette pièce est-elle proposée dans le créateur ? », utiliser
 * `isInCreator`, qui croise les deux critères.
 */
export function isCreatorPart(part: { slot: BodySlot; source?: string }): boolean {
  if (!isAnatomyFiltered(part.slot)) return true;
  return part.source !== undefined && ANATOMY_SOURCES.has(part.source);
}

/**
 * Cette pièce est-elle réellement proposée dans le créateur de personnage ?
 *
 * Les deux conditions, ensemble :
 *   1. l'emplacement se règle à la création (`slotSource`) — pas un casque ;
 *   2. la pièce passe la liste blanche (`isCreatorPart`) — pas une veste rangée
 *      en région `torso` par le découpeur.
 *
 * Ce prédicat existe parce que le premier tout seul laissait passer les vestes,
 * et le second tout seul laissait passer les casques. Les appeler séparément
 * marche à chaque call-site existant, et se trompe partout ailleurs — d'où ce
 * nom unique, qui est le complément exact du stock du marchand.
 */
export function isInCreator(part: { slot: BodySlot; source?: string }): boolean {
  return slotSource(part.slot) === "creator" && isCreatorPart(part);
}
