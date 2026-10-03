// ══════════════════════════════════════════════════════════════════════════════
// animation/animationPacks.ts — Manifeste des packs d'animation FBX (Mixamo).
//
// Les FBX vivent dans public/models/assets_character/animation_*. Chaque pack
// associe un ActionId du jeu (idle/run/attack/…) à un fichier FBX. Au chargement,
// useFbxAnimationPack retire le préfixe "mixamorig:" → les clips se branchent sur
// les squelettes Meshy des PNJ.
//
// ⚙️ data-driven : pour brancher une anim, il suffit d'ajouter une ligne ici.
//   L'ActionId DOIT exister dans CLIP_CANDIDATES (AnimationController) :
//   idle · walk · run · sprint · jump · attack · cast · channeling · hit · death · dodge · ultimate
// ══════════════════════════════════════════════════════════════════════════════

import type { ActionId } from "../types";
import { CLIP_CANDIDATES } from "./AnimationController";

export const ANIM_PACK_ROOT = "/models/assets_character";

export interface FbxAnimSpec { action: ActionId; path: string; }

/**
 * Ne garde qu'UN clip par action.
 *
 * `UNARMED_PACK` déclare 12 variantes pour `punch1`, 12 pour `punch2`, 12 pour
 * `punch3`. Or le chargeur appelle `renameClip(clip, action)` : les 12 finissent
 * avec le MÊME nom, et `resolveActions` retient la première trouvée. Les onze
 * autres sont téléchargées, parsées, gardées en mémoire — et jamais jouées.
 *
 * Charger le pack entier coûterait 43 fichiers là où 7 suffisent. Les variantes
 * restent déclarées dans le catalogue : le jour où un tirage aléatoire par coup
 * sera implémenté, elles seront prêtes.
 */
export function firstPerAction(pack: FbxAnimSpec[]): FbxAnimSpec[] {
  const parAction = new Map<ActionId, FbxAnimSpec[]>();
  for (const spec of pack) {
    const liste = parAction.get(spec.action);
    if (liste) liste.push(spec);
    else parAction.set(spec.action, [spec]);
  }

  const retenus: FbxAnimSpec[] = [];
  for (const [action, variantes] of parAction) {
    retenus.push(variantes.find((v) => estPrefere(action, v.path)) ?? variantes[0]);
  }
  // On conserve l'ordre de déclaration du catalogue, pas celui de la Map.
  return pack.filter((spec) => retenus.includes(spec));
}

/**
 * La variante choisie respecte-t-elle la préférence de `CLIP_CANDIDATES` ?
 *
 * POURQUOI CE DÉTOUR.
 * `CLIP_CANDIDATES` encode l'alternance gauche/droite du combo : `punch1` cite
 * une main DROITE en tête, `punch2` une main GAUCHE (`attack_hook_Lhand_01`),
 * `punch3` de nouveau la droite. Mais cette préférence était **inatteignable** :
 * le chargeur appelle `renameClip(clip, action)`, qui écrase le nom d'origine
 * par l'id d'action. Au moment où `resolveActions` consulte ses candidats,
 * plus aucun clip ne s'appelle `attack_hook_Lhand_01` — seul le nom générique
 * `punch2` peut encore matcher. Les 18 GLB main gauche étaient donc déclarés,
 * téléchargeables, et jamais joués.
 *
 * On applique donc la préférence AU CHOIX DU FICHIER, avant le renommage :
 * c'est le seul moment où les noms d'origine existent encore.
 */
function estPrefere(action: ActionId, path: string): boolean {
  const candidats = CLIP_CANDIDATES[action];
  if (!candidats?.length) return false;
  const fichier = path.split("/").pop()?.replace(/\.(glb|gltf)$/i, "") ?? "";
  // Premier candidat seulement : c'est lui qui porte l'intention (la latéralité).
  return fichier === candidats[0];
}

/** Construit un pack à partir d'un dossier + map (action → nom de fichier FBX). */
export function buildPack(folder: string, map: Partial<Record<ActionId, string>>): FbxAnimSpec[] {
  return (Object.entries(map) as [ActionId, string][]).map(([action, file]) => ({
    action,
    path: `${ANIM_PACK_ROOT}/${folder}/${file}`,
  }));
}

// ── Pack de DÉMONSTRATION : mêlée — DÉSACTIVÉ (animation_meelee/ absent) ────
export const MELEE_PACK: FbxAnimSpec[] = [];
// buildPack("animation_meelee", { idle:"standing idle.fbx", jump:"standing jump.fbx", attack:"standing melee attack horizontal.fbx", hit:"standing block react large.fbx" });

// ── Pack du JOUEUR (avatar Meshy) ────────────────────────────────────────────
// VIDE par défaut → le joueur garde ses clips GLB partagés (comportement actuel,
// zéro changement). Remplis ce mapping (action → fichier FBX) pour utiliser tes
// animations Mixamo récentes sur le joueur. Ex :
//   export const PLAYER_FBX_PACK = buildPack("animation_meelee", {
//     idle: "standing idle.fbx", run: "standing run forward.fbx",
//     attack: "standing melee attack horizontal.fbx", jump: "standing jump.fbx",
//     hit: "standing react large gut.fbx", death: "...",
//   });
export const PLAYER_FBX_PACK: FbxAnimSpec[] = [];

// ══════════════════════════════════════════════════════════════════════════════
// Packs par TYPE D'ARME / créature (mappings PROPOSÉS — à corriger librement).
// Ils alimentent le WeaponAnimationBinder + le MonsterAnimationAssignmentSystem.
// ══════════════════════════════════════════════════════════════════════════════

// ── Packs d'ARCHÉTYPE en GLB ─────────────────────────────────────────────────
// ÉTAT : les dossiers animation_* n'existent PAS encore sur disque.
// Les packs sont VIDES → useGltfAnimationPack([]) retourne [] sans erreur.
// Quand les GLB Mixamo seront placés dans public/models/assets_character/animation_*/,
// réactiver les buildPack ci-dessous.
// ─────────────────────────────────────────────────────────────────────────────

export const SWORD_SHIELD_PACK: FbxAnimSpec[] = [];
// buildPack("animation_sword_and_shield", { idle:"sword and shield idle.glb", walk:"sword and shield walk.glb", run:"sword and shield run.glb", jump:"sword and shield jump.glb", attack:"sword and shield slash.glb", cast:"sword and shield power up.glb", hit:"sword and shield impact.glb", death:"sword and shield death.glb" });

export const WEAPON_MELEE_PACK: FbxAnimSpec[] = [];
// buildPack("animation_meelee", { idle:"standing idle.glb", walk:"standing walk forward.glb", run:"standing run forward.glb", jump:"standing jump.glb", attack:"standing melee attack horizontal.glb", hit:"standing react large gut.glb" });

export const ARCHER_PACK: FbxAnimSpec[] = [];
// buildPack("animation_archer", { idle:"standing idle 01.glb", walk:"standing walk forward.glb", run:"standing run forward.glb", attack:"standing aim recoil.glb", channeling:"standing draw arrow.glb", hit:"standing react small from front.glb", death:"standing death forward 01.glb", dodge:"standing dodge forward.glb" });

export const MAGIE_PACK: FbxAnimSpec[] = [];
// buildPack("animation_magie", { idle:"standing idle.glb", walk:"Standing Walk Forward.glb", run:"Standing Run Forward.glb", sprint:"Standing Sprint Forward.glb", jump:"Standing Jump.glb", attack:"Standing 1H Magic Attack 01.glb", cast:"Standing 2H Cast Spell 01.glb", channeling:"Standing 2H Magic Attack 01.glb", ultimate:"Standing 2H Magic Area Attack 01.glb", hit:"Standing React Large From Front.glb", death:"Standing React Death Forward.glb" });

export const CREATURE_MELEE_PACK: FbxAnimSpec[] = [];
// buildPack("creature_animation_melee", { idle:"mutant idle.glb", walk:"mutant walking.glb", run:"mutant run.glb", jump:"mutant jumping.glb", attack:"mutant swiping.glb", cast:"mutant jump attack.glb", ultimate:"mutant roaring.glb", death:"mutant dying.glb" });

export const SHOOTER_PACK: FbxAnimSpec[] = [];
// buildPack("animation_shooter", { idle:"Idle.glb", walk:"walk forward.glb", run:"run forward.glb", sprint:"sprint forward.glb", jump:"jump loop.glb", attack:"standing aim recoil.glb", channeling:"idle aiming.glb", death:"death from the front.glb" });

// ── Packs mains nues — GLBs FPP_combat_fists (57 fichiers) ─────────────────
// Les fichiers vivent dans /models/animations/FPP_combat_fists/Animations/No_Rootmotion/
// et ont été convertis depuis Sorcerer. Les actions CLIP_CANDIDATES (punch1/2/3,
// punch_charged, kick, kick_charged) mappent sur les frappes boxe.
// GLB ALLÉGÉS — géométrie retirée (`scripts/strip-anim-meshes.mjs`).
//
// Les fichiers d'origine (`No_Rootmotion/`) embarquent chacun le personnage
// ENTIER : 1 mesh skinné, 2 primitives, 5 textures. Mesuré : 9,4 Mo par clip,
// 521 Mo pour le pack. Les charger sur le joueur rechargerait le même mesh 43
// fois — freeze assuré, et perte de contexte GPU sur une machine déjà limite.
//
// Three.js lie les pistes aux NŒUDS par leur nom : le mesh ne sert à rien dans
// un fichier de clip. Après strip : 48 Mo pour les 55 fichiers (−90,8 %), avec
// les 69 os et l'animation intacts.
//
// Les originaux restent dans `No_Rootmotion/` — rien n'a été écrasé.
const FISTS = "/models/animations/FPP_combat_fists/Animations/anim_only";

export const UNARMED_PACK: FbxAnimSpec[] = [
  // ── Jabs (directs) ─────────────────────────────────────────────────────
  { action: "punch1",      path: `${FISTS}/attack_jab_Rhand_01.glb` },
  { action: "punch1",      path: `${FISTS}/attack_jab_Rhand_02.glb` },
  { action: "punch1",      path: `${FISTS}/attack_jab_fast_Rhand_01.glb` },
  { action: "punch1",      path: `${FISTS}/attack_jab_fast_Rhand_02.glb` },
  { action: "punch1",      path: `${FISTS}/attack_jab_slow_Rhand_01.glb` },
  { action: "punch1",      path: `${FISTS}/attack_jab_slow_Rhand_02.glb` },
  // ── Hooks (crochets) ─────────────────────────────────────────────────────
  { action: "punch2",      path: `${FISTS}/attack_hook_Rhand_01.glb` },
  { action: "punch2",      path: `${FISTS}/attack_hook_Rhand_02.glb` },
  { action: "punch2",      path: `${FISTS}/attack_hook_fast_Rhand_01.glb` },
  { action: "punch2",      path: `${FISTS}/attack_hook_fast_Rhand_02.glb` },
  { action: "punch2",      path: `${FISTS}/attack_hook_slow_Rhand_01.glb` },
  { action: "punch2",      path: `${FISTS}/attack_hook_slow_Rhand_02.glb` },
  // ── Uppercuts ────────────────────────────────────────────────────────────
  { action: "punch3",      path: `${FISTS}/attack_uppercut_Rhand_01.glb` },
  { action: "punch3",      path: `${FISTS}/attack_uppercut_Rhand_02.glb` },
  { action: "punch3",      path: `${FISTS}/attack_uppercut_fast_Rhand_01.glb` },
  { action: "punch3",      path: `${FISTS}/attack_uppercut_fast_Rhand_02.glb` },
  { action: "punch3",      path: `${FISTS}/attack_uppercut_slow_Rhand_01.glb` },
  { action: "punch3",      path: `${FISTS}/attack_uppercut_slow_Rhand_02.glb` },
  // ── Attaques spéciales / chargées ────────────────────────────────────────
  { action: "punch_charged", path: `${FISTS}/attack_special_01.glb` },
  { action: "punch_charged", path: `${FISTS}/attack_special_02.glb` },
  // ── Kicks ────────────────────────────────────────────────────────────────
  { action: "kick",        path: `${FISTS}/attack_special_kick.glb` },
  { action: "kick_charged", path: `${FISTS}/attack_special_kick.glb` }, // fallback
  // ── Variantes main gauche (mirrorClip appliqué par unarmedStrikes.ts) ────
  { action: "punch1",      path: `${FISTS}/attack_jab_Lhand_01.glb` },
  { action: "punch1",      path: `${FISTS}/attack_jab_Lhand_02.glb` },
  { action: "punch1",      path: `${FISTS}/attack_jab_fast_Lhand_01.glb` },
  { action: "punch1",      path: `${FISTS}/attack_jab_fast_Lhand_02.glb` },
  { action: "punch1",      path: `${FISTS}/attack_jab_slow_Lhand_01.glb` },
  { action: "punch1",      path: `${FISTS}/attack_jab_slow_Lhand_02.glb` },
  { action: "punch2",      path: `${FISTS}/attack_hook_Lhand_01.glb` },
  { action: "punch2",      path: `${FISTS}/attack_hook_Lhand_02.glb` },
  { action: "punch2",      path: `${FISTS}/attack_hook_fast_Lhand_01.glb` },
  { action: "punch2",      path: `${FISTS}/attack_hook_fast_Lhand_02.glb` },
  { action: "punch2",      path: `${FISTS}/attack_hook_slow_Lhand_01.glb` },
  { action: "punch2",      path: `${FISTS}/attack_hook_slow_Lhand_02.glb` },
  { action: "punch3",      path: `${FISTS}/attack_uppercut_Lhand_01.glb` },
  { action: "punch3",      path: `${FISTS}/attack_uppercut_Lhand_02.glb` },
  { action: "punch3",      path: `${FISTS}/attack_uppercut_fast_Lhand_01.glb` },
  { action: "punch3",      path: `${FISTS}/attack_uppercut_fast_Lhand_02.glb` },
  { action: "punch3",      path: `${FISTS}/attack_uppercut_slow_Lhand_01.glb` },
  { action: "punch3",      path: `${FISTS}/attack_uppercut_slow_Lhand_02.glb` },
  // ── Animations de transition / réaction ──────────────────────────────────
  { action: "hit",         path: `${FISTS}/block_in.glb` },
  { action: "hit",         path: `${FISTS}/block_loop.glb` },
  { action: "hit",         path: `${FISTS}/block_out.glb` },
];

export const UNARMED_STANCE_PACK: FbxAnimSpec[] = [
  // Stance de combat à mains nues (idle combat)
  { action: "idle",        path: `${FISTS}/idle_pose.glb` },
  { action: "idle",        path: `${FISTS}/idle_breathing.glb` },
  { action: "idle",        path: `${FISTS}/idle_break.glb` },
  // Locomotion de combat
  { action: "walk",        path: `${FISTS}/walk.glb` },
  { action: "run",         path: `${FISTS}/run.glb` },
  // Sprint
  { action: "sprint",      path: `${FISTS}/sprint_loop.glb` },
  { action: "sprint",      path: `${FISTS}/sprint_in.glb` },
  { action: "sprint",      path: `${FISTS}/sprint_out.glb` },
  // Sauts
  { action: "jump",        path: `${FISTS}/jump_in.glb` },
  { action: "jump",        path: `${FISTS}/jump_loop.glb` },
  { action: "jump",        path: `${FISTS}/jump_out.glb` },
  // Sélection / désélection
  { action: "idle",        path: `${FISTS}/select.glb` },
  { action: "idle",        path: `${FISTS}/deselect.glb` },
];

export const REACTIONS_PACK: FbxAnimSpec[] = [];
// buildPack("Sorceres_hi_poly/animation_punch", { hit:"Hit Reaction.glb", bighit:"Big Hit To Head.glb", stun:"Stunned.glb" });
