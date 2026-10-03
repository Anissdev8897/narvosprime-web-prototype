// ══════════════════════════════════════════════════════════════════════════════
// Proto_combat/combatClips.ts — Quels clips le banc charge, et pourquoi ceux-là.
//
// ── LE PROBLÈME QUE CE FICHIER RÈGLE ─────────────────────────────────────────
//
// Le banc montait `soldat_humain/Meshy_AI_biped_Character_output.glb`. Mesuré en
// console :
//
//   [AnimCtrl] AUCUN clip "idle" résolu → repli sur "Armature|clip0|baselayer"
//   [AnimCtrl] locomotion INCOMPLÈTE — Clips disponibles : [Armature|clip0|baselayer]
//
// Ce GLB porte UN clip. Les 61 clips du brief ne sont PAS dans le personnage :
// ils vivent dans des packs séparés, chargés puis retargetés sur le rig. Sans
// eux, `play("punch2")` retombait sur l'unique clip et l'enchaînement était
// invisible — la machine tournait pourtant correctement (le journal le montrait).
//
// ── CE QUI EST CHOISI, ET SUR QUELLE MESURE ──────────────────────────────────
//
// Rig : WRAITH (UE4, 68 os). C'est la cible mesurée des clips FPP_combat_fists —
// « 0 os absent » d'après `src/rpg/sandbox/sandboxAssets.ts`, qui a déjà fait ce
// travail pour l'étape 1 de la sandbox. On CONSOMME ce constat, on ne le refait
// pas (cf. la leçon « chercher l'existant avant d'écrire »).
//
// Clips : `FPP_combat_fists` — 55 GLB légers, un seul dossier, toutes les
// frappes du combo. On ne charge PAS la locomotion complète du jeu
// (BULLET/UTA/CROUCH/P2, plusieurs dizaines de fichiers lourds) : le
// personnage du banc ne se déplace pas. Un essai doit coûter une seconde.
//
// RÈGLE D'OR (brief §5) : ce fichier IMPORTE les catalogues du jeu, il ne les
// modifie pas. Les chemins sont DÉRIVÉS d'`UNARMED_PACK` — si le dossier bouge
// côté jeu, le banc suit sans édition.
// ══════════════════════════════════════════════════════════════════════════════

import { UNARMED_PACK, UNARMED_STANCE_PACK } from "../../src/rpg/animation/animationPacks";
import { WRAITH_ANIMS, WRAITH_BASE } from "../../src/rpg/characters/avatarAssets";

/** Personnage du banc. Rig UE4 = cible mesurée des clips de poings. */
export const PERSONNAGE = WRAITH_BASE;

/** Hauteur cible (m). Même valeur que le joueur en jeu — réglages comparables. */
export const HAUTEUR_CIBLE = 1.8;

/** Un fichier à charger. `action` absent = le clip garde son nom d'origine. */
export interface JobClip {
  path: string;
  action?: string;
}

/**
 * Dossier des clips de poings, DÉRIVÉ du catalogue du jeu plutôt que recopié.
 * Une constante en dur ici deviendrait fausse en silence le jour où le pack
 * déménage — et le symptôme serait un personnage figé, pas une erreur.
 */
const FISTS = UNARMED_PACK[0].path.replace(/\/[^/]+$/, "");

/**
 * Le mapping action → clip du banc.
 *
 * Il est EXPLICITE et non repris de `firstPerAction(UNARMED_PACK)` pour une
 * raison précise : la LATÉRALITÉ. `punch1` droite → `punch2` GAUCHE → `punch3`
 * droite. Un enchaînement qui frappe trois fois du même poing se lit comme une
 * animation en boucle plutôt que comme un combat (cf. `unarmedStrikes.ts`, qui
 * documente le même constat côté jeu).
 *
 * ⚠️ `hit` : le pack ne contient AUCUNE réaction aux coups — vérifié sur les 55
 * fichiers, et `REACTIONS_PACK` est vide côté jeu. `block_in` (le mouvement de
 * protection) sert d'approximation. C'est le clip à remplacer en premier quand
 * un pack de réactions arrivera ; le reste du système (8 directions dans
 * `hitDirection.ts`) est déjà écrit pour l'accueillir.
 */
export const JOBS_ACTION: JobClip[] = [
  { action: "idle",           path: `${FISTS}/idle_breathing.glb` },
  { action: "punch1",         path: `${FISTS}/attack_jab_Rhand_01.glb` },
  { action: "punch2",         path: `${FISTS}/attack_hook_Lhand_01.glb` },
  { action: "punch3",         path: `${FISTS}/attack_uppercut_Rhand_01.glb` },
  { action: "kick",           path: `${FISTS}/attack_special_kick.glb` },
  { action: "punch_charged",  path: `${FISTS}/attack_special_01.glb` },
  { action: "kick_charged",   path: `${FISTS}/attack_special_02.glb` },
  { action: "block",          path: `${FISTS}/block_loop.glb` },
  { action: "hit",            path: `${FISTS}/block_in.glb` },
  { action: "stun",           path: `${FISTS}/block_out.glb` },
  { action: "walk",           path: `${FISTS}/walk.glb` },
  { action: "run",            path: `${FISTS}/run.glb` },
  { action: "jump",           path: `${FISTS}/jump_loop.glb` },
];

/**
 * Tous les autres fichiers du pack, chargés SANS renommage : ils gardent leur
 * nom de fichier et ne servent qu'au panneau de clips (étape 2 du brief).
 *
 * L'ORDRE compte. `resolveActions` retient le PREMIER clip qui correspond, et
 * un clip brut nommé `attack_hook_Rhand_02` correspondrait aussi à `punch2`.
 * Les jobs d'action passent donc en tête — le mapping explicite gagne toujours.
 */
export const JOBS_BRUTS: JobClip[] = [
  ...new Set([...UNARMED_PACK, ...UNARMED_STANCE_PACK].map((s) => s.path)),
]
  .filter((p) => !JOBS_ACTION.some((j) => j.path === p))
  .map((path) => ({ path }));

/** Capacités Wraith (`Ability_E_*`, `Ability_Q_*`) — clips déjà nommés.
 *  `ability_e_targeting_loop` est la boucle de VISÉE de l'attaque chargée (§8). */
export const JOBS_CAPACITES: JobClip[] = WRAITH_ANIMS.map((path) => ({ path }));

export const TOUS_LES_JOBS: JobClip[] = [
  ...JOBS_ACTION,
  ...JOBS_CAPACITES,
  ...JOBS_BRUTS,
];

/** Chemins UNIQUES à télécharger, dans l'ordre de première apparition. */
export const CHEMINS_UNIQUES: string[] = [
  ...new Set(TOUS_LES_JOBS.map((j) => j.path)),
];
