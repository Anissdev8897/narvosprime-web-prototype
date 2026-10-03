// ══════════════════════════════════════════════════════════════════════════════
// animations/animationMap.ts — Mapping clips Mixamo → actions de jeu + fallback
//
// Source primaire : Sorceres_hi_poly (squelette Mixamo, ~60 clips).
// Pour chaque ActionId, on définit le clip Mixamo correspondant + une chaîne
// de repli si le clip est absent (retarget / pack alternatif).
// ══════════════════════════════════════════════════════════════════════════════

import type { ActionId, AnimationMapEntry } from "../types";

/**
 * Dossier source des clips (relatif à public/). Les FBX seront convertis en GLB
 * ou chargés via FBXLoader. Voir loaders/animationLoader.ts.
 */
export const ANIMATION_SOURCE_DIR = "/assets/rpg/animations";

/**
 * Mapping action → clip Mixamo (nom de fichier sans extension).
 * Les clips marqués MISSING n'existent pas dans la source → fallback obligatoire.
 */
export const ANIMATION_MAP: Record<ActionId, AnimationMapEntry> = {
  idle: {
    action: "idle",
    clip: "Breathing Idle",
    fallbacks: [],
  },
  walk: {
    action: "walk",
    clip: "Standing Walk Forward",
    fallbacks: ["idle"],
  },
  run: {
    action: "run",
    clip: "Running",
    fallbacks: ["walk", "idle"],
  },
  sprint: {
    action: "sprint",
    clip: "Standing Sprint Forward",
    fallbacks: ["run", "walk"],
  },
  jump: {
    action: "jump",
    clip: "Standing Jump",
    fallbacks: ["idle"],
  },
  crouch: {
    action: "crouch",
    clip: "Crouching Idle",
    fallbacks: ["idle"],
  },
  attack: {
    action: "attack",
    clip: "Standing 1H Magic Attack 01",
    fallbacks: ["cast", "idle"],
  },
  cast: {
    action: "cast",
    clip: "Standing 2H Magic Attack 01",
    fallbacks: ["attack", "idle"],
  },
  channeling: {
    action: "channeling",
    clip: "Standing 2H Cast Spell 01",
    fallbacks: ["cast", "idle"],
  },
  hit: {
    action: "hit",
    clip: "Standing React Small From Front",
    fallbacks: ["idle"],
  },
  death: {
    action: "death",
    clip: "Standing React Death Forward",
    fallbacks: ["hit"],
  },
  // ── Clips ABSENTS dans la source → fallback automatique ────────────────────
  dodge: {
    action: "dodge",
    clip: "", // pas de clip dodge → fallback
    fallbacks: ["jump", "run", "walk"],
  },
  ultimate: {
    action: "ultimate",
    clip: "Standing 2H Magic Area Attack 01", // le cast le plus spectaculaire
    fallbacks: ["channeling", "cast"],
  },
  // ── Combat mains nues (répertoire animation_punch) ─────────────────────────
  punch1: { action: "punch1", clip: "Punching", fallbacks: ["attack", "idle"] },
  punch2: { action: "punch2", clip: "Cross Punch", fallbacks: ["punch1", "attack"] },
  punch3: { action: "punch3", clip: "Uppercut", fallbacks: ["punch1", "attack"] },
  punch_charged: { action: "punch_charged", clip: "Punch Combo", fallbacks: ["punch3", "punch1"] },
  kick:   { action: "kick", clip: "Roundhouse Kick", fallbacks: ["punch1", "attack"] },
  kick_charged: { action: "kick_charged", clip: "Martelo", fallbacks: ["kick", "punch1"] },
  bighit: { action: "bighit", clip: "Big Hit To Head", fallbacks: ["hit", "idle"] },
  block:  { action: "block", clip: "Hit Reaction", fallbacks: ["hit", "idle"] },
  stun:   { action: "stun", clip: "Stunned", fallbacks: ["hit", "idle"] },
  fall:    { action: "fall", clip: "Falling Idle", fallbacks: ["idle"] },
  landing: { action: "landing", clip: "Hard Landing", fallbacks: ["idle"] },
  // ── Wraith ability animations (Paragon UE4) ───────────────────────────────
  ability_e:              { action: "ability_e", clip: "Ability_E_0", fallbacks: ["cast"] },
  ability_e_recovery:     { action: "ability_e_recovery", clip: "Ability_E_Recovery_0", fallbacks: ["idle"] },
  ability_e_targeting_loop:  { action: "ability_e_targeting_loop", clip: "Ability_E_Targeting_Loop_0", fallbacks: ["channeling"] },
  ability_e_targeting_start: { action: "ability_e_targeting_start", clip: "Ability_E_Targeting_Start_0", fallbacks: ["cast"] },
  ability_q:              { action: "ability_q", clip: "Ability_Q_Fire_0", fallbacks: ["attack"] },
  slide:    { action: "slide", clip: "Sliding", fallbacks: ["crouch", "run", "idle"] },
  // Escalade de mur : les clips viennent du pack UTA (chargés par UTA_TRAVERSAL,
  // déjà renommés), PAS de la source Mixamo que décrit cette table. Le champ
  // `clip` reste donc vide et les fallbacks assurent une pose plausible si le
  // pack n'est pas chargé — jamais de T-pose.
  climb_start: { action: "climb_start", clip: "", fallbacks: ["climb_idle", "jump", "idle"] },
  climb_idle:  { action: "climb_idle",  clip: "", fallbacks: ["idle"] },
  climb_up_l:  { action: "climb_up_l",  clip: "", fallbacks: ["climb_idle", "idle"] },
  climb_up_r:  { action: "climb_up_r",  clip: "", fallbacks: ["climb_idle", "idle"] },
  climb_top:   { action: "climb_top",   clip: "", fallbacks: ["climb_idle", "landing", "idle"] },
};

/**
 * Variantes additionnelles (pour la diversité visuelle des sorts).
 * Permet de piocher aléatoirement un clip de cast parmi plusieurs.
 */
export const CAST_VARIANTS: string[] = [
  "Standing 1H Magic Attack 01",
  "Standing 1H Magic Attack 02",
  "Standing 1H Magic Attack 03",
  "Standing 2H Magic Attack 01",
  "Standing 2H Magic Attack 02",
  "Standing 2H Magic Attack 03",
  "Standing 2H Magic Attack 04",
  "Standing 2H Magic Attack 05",
];

export const AOE_CAST_VARIANTS: string[] = [
  "Standing 2H Magic Area Attack 01",
  "Standing 2H Magic Area Attack 02",
];

export const IDLE_VARIANTS: string[] = [
  "Breathing Idle",
  "Idle",
  "Standing Idle 02",
  "Standing Idle 03",
  "Standing Idle 04",
];

/**
 * Résout l'action effective à jouer : si le clip de l'action demandée est vide,
 * remonte la chaîne de fallback jusqu'à trouver un clip non vide.
 */
export function resolveAnimation(action: ActionId): { action: ActionId; clip: string } {
  const visited = new Set<ActionId>();
  let current: ActionId | undefined = action;

  while (current !== undefined && !visited.has(current)) {
    visited.add(current);
    const entry: AnimationMapEntry = ANIMATION_MAP[current];
    if (entry.clip) {
      return { action: current, clip: entry.clip };
    }
    // Prendre le premier fallback non visité
    current = entry.fallbacks.find((f: ActionId) => !visited.has(f));
  }

  // Dernier recours absolu : idle
  return { action: "idle", clip: ANIMATION_MAP.idle.clip };
}

/**
 * Mapping de noms d'os Mixamo → squelette Quaternius (pour le retarget).
 * À compléter selon les noms réels du rig Quaternius après inspection.
 */
export const MIXAMO_BONE_MAP: Record<string, string> = {
  "mixamorig:Hips": "Hips",
  "mixamorig:Spine": "Spine",
  "mixamorig:Spine1": "Spine1",
  "mixamorig:Spine2": "Spine2",
  "mixamorig:Neck": "Neck",
  "mixamorig:Head": "Head",
  "mixamorig:LeftShoulder": "LeftShoulder",
  "mixamorig:LeftArm": "LeftArm",
  "mixamorig:LeftForeArm": "LeftForeArm",
  "mixamorig:LeftHand": "LeftHand",
  "mixamorig:RightShoulder": "RightShoulder",
  "mixamorig:RightArm": "RightArm",
  "mixamorig:RightForeArm": "RightForeArm",
  "mixamorig:RightHand": "RightHand",
  "mixamorig:LeftUpLeg": "LeftUpLeg",
  "mixamorig:LeftLeg": "LeftLeg",
  "mixamorig:LeftFoot": "LeftFoot",
  "mixamorig:RightUpLeg": "RightUpLeg",
  "mixamorig:RightLeg": "RightLeg",
  "mixamorig:RightFoot": "RightFoot",
};
