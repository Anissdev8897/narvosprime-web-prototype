// characters/avatarAssets.ts — chemins GLB des avatars JOUEUR, EXPOSÉS.
//
// Source unique de vérité pour les GLB de chaque avatar : utilisée par les renderers ET
// par le registre de préchargement (gameAssets) → on précharge EXACTEMENT ce que le perso
// rendra, sans dupliquer les chemins ni risquer un décalage cache/rendu.

// ── Sorcier (Mixamo) — LEGACY : le pack entier a été supprimé du disque ──────
//
// `Sorceres_hi_poly/` n'existe plus. Le tableau vide reste pour compat, mais la
// RACINE `SORC` a été retirée : `HumanCharacter` la concaténait encore pour six
// `useGLTF`, et chacun rendait du `text/html` en 200 (fallback SPA de Vite) au
// lieu d'un 404 — donc un plantage de parse glTF sous un `<Suspense>` sans
// ErrorBoundary. Voir HUMAN_FALLBACK ci-dessous.
export const SORCERER_GLBS: string[] = [];

// ── Personnages Bullet (Paragon — rig UE4) ───────────────────────────────────
const CHAR = "/models/assets_character";

export const WRAITH_BASE   = `${CHAR}/wraith/Wraith.glb`;
export const MURDOCK_BASE  = `${CHAR}/murdock/Murdock.glb`;
export const BORIS_BASE    = "/models/personnages/boris/Boris.glb";

export const WRAITH_SKINS: Record<string, string> = {
  wraith:          WRAITH_BASE,
  wraith_lunarops: `${CHAR}/wraith/Wraith_LunarOps.glb`,
  wraith_odgreen:  `${CHAR}/wraith/Wraith_ODGreen.glb`,
};

export const MURDOCK_SKINS: Record<string, string> = {
  murdock:             MURDOCK_BASE,
  murdock_corrupt:     `${CHAR}/murdock/Murdock_Corrupt.glb`,
  murdock_executioner: `${CHAR}/murdock/Murdock_Executioner.glb`,
  murdock_merc:        `${CHAR}/murdock/Murdock_Merc.glb`,
  murdock_sf:          `${CHAR}/murdock/Murdock_SF.glb`,
  murdock_shogun:      `${CHAR}/murdock/Murdock_Shogun_GDC.glb`,
  murdock_wasteland:   `${CHAR}/murdock/Murdock_Wasteland_GDC.glb`,
};

export const WRAITH_ANIMS: string[] = [
  `${CHAR}/wraith/animations/stripped/Ability_E.glb`,
  `${CHAR}/wraith/animations/stripped/Ability_E_Recovery.glb`,
  `${CHAR}/wraith/animations/stripped/Ability_E_Targeting_Loop.glb`,
  `${CHAR}/wraith/animations/stripped/Ability_E_Targeting_Start.glb`,
  `${CHAR}/wraith/animations/stripped/Ability_Q_Fire.glb`,
];

// ── LOCOMOTION native UE4 pour les avatars Paragon ──────────────────────────
//
// POURQUOI CES FICHIERS ET PAS LE GLB MESHY `soldat_humain` :
// Le GLB Meshy est exporté en CENTIMÈTRES — nœud `Armature` à l'échelle 0.01 et
// os `Hips` au repos à Y ≈ 96. Les rigs Paragon sont en MÈTRES (`pelvis` à
// Y ≈ 1.11). Or remapClipsToRig ne fait que RENOMMER les pistes : aucune valeur
// n'est convertie. Une piste `Hips.position` à Y ≈ 92 renommée `pelvis.position`
// projetait donc le squelette à ~60 m — d'où des animations de déplacement
// invisibles alors que l'idle (servi par un autre chemin) restait correct.
//
// Ces clips-ci sont MESURÉS en mètres et déjà en convention UE4 :
//   Jog_Fwd      68 os ciblés, 0 absent de Wraith  ← le plus sûr
//   MM_*         89 os, 14 absents (spine_04/05, métacarpiens UE5) → droppés
//                proprement par remapOne, sans incidence sur la pose.
const MOCAP = "/models/animations/MoCapCombatAnimations_DualCharacter/Demo/Characters";
const MANNY = `${MOCAP}/Mannequins/Animations/Manny`;

/** Clip de locomotion → ActionId à lui donner via renameClip(). */
export const BULLET_LOCOMOTION: { path: string; action: string }[] = [
  // IDLE — indispensable. En retirant le GLB Meshy `soldat_humain`, on a
  // supprimé la seule source du clip "Idle_11" : plus aucune action `idle` ne
  // se résolvait et le filet de secours d'AnimationController rabattait le
  // personnage sur "Ability_E_0", une animation de SORT, en position debout.
  // Ce clip-ci est déjà en convention UE4 et en mètres (pelvis Y ≈ 0.95) —
  // c'est celui que playEmote servait déjà correctement pour les variantes.
  { path: "/models/animations/WW100IdleAnimPack/Animations/UE4/AS_StandUpright_Normal01_Loop01.glb", action: "idle" },
  { path: `${MOCAP}/Mannequin_UE4/Animations/Jog_Fwd.glb`, action: "run" },
  { path: `${MOCAP}/Mannequin_UE4/Animations/Jog_Fwd.glb`, action: "sprint" },
  { path: `${MANNY}/MM_Walk_Fwd.glb`,  action: "walk" },
  { path: `${MANNY}/MM_Jump.glb`,      action: "jump" },
  { path: `${MANNY}/MM_Land.glb`,      action: "landing" },
  { path: `${MANNY}/MM_Fall_Loop.glb`, action: "fall" },
];

// ── Repli de `HumanCharacter` — remplace le pack Sorceres supprimé ───────────
//
// `HumanCharacter` chargeait son MESH et cinq clips depuis `Sorceres_hi_poly/`,
// disparu du disque. Il reste monté par trois surfaces (aperçu de création,
// Forge Équipements, Forge Personnages), sous un `<Suspense>` SANS
// ErrorBoundary : un GLB absent n'y dégrade pas, il casse la branche.
//
// Ces cinq chemins-ci sont MESURÉS présents et déjà éprouvés sur le rig Paragon
// (68 os, 0 absent de Wraith) — ce sont ceux de BULLET_LOCOMOTION juste au-dessus,
// plus le sort Q de Wraith. Le contrôleur d'animation défaut déjà sur `"wraith"`
// (`avatarKey: config.modelId ?? "wraith"`), donc le rig ne change pas de famille.
//
// ⚠ PAS DE CLIP DE MORT sur ce rig : aucun `*death*.glb` n'existe pour Paragon
// dans le dépôt. Le slot est laissé VIDE plutôt que garni d'une chute d'escalade
// (`Traversal_Wall_Climb_DeathFall`), qui jouerait une pose d'agrippement.
// `HumanCore` ignore proprement un clip absent (`if (!src) continue`).
export const HUMAN_FALLBACK = {
  /** Mesh rigué — sert de source de squelette ET de modèle affiché. */
  mesh: WRAITH_BASE,
  /** Idle anim-only, convention UE4 et en mètres. */
  idle: "/models/animations/WW100IdleAnimPack/Animations/UE4/AS_StandUpright_Normal01_Loop01.glb",
  walk: `${MANNY}/MM_Walk_Fwd.glb`,
  run:  `${MOCAP}/Mannequin_UE4/Animations/Jog_Fwd.glb`,
  cast: `${CHAR}/wraith/animations/stripped/Ability_Q_Fire.glb`,
} as const;

// ── LOCOMOTION DIRECTIONNELLE (pack UTA, dépouillé) ─────────────────────────
//
// Marche ET course dans les 8 directions, plus sprint et idle. Source :
// public/models/divers/UTA/, passé par `scripts/strip-anim-glb.mjs` qui retire
// mesh/skin/textures (261 Mo → 42 Mo pour 26 clips).
//
// POURQUOI CE PACK ET PAS UN AUTRE — vérifié, pas supposé :
//   • UTA         68 os ciblés, 0 absent de Wraith  → 100 % de recouvrement
//   • ThirdPerson 89 os, 14 absents (spine_04/05, métacarpiens UE5)
//   • GameAnimationSample : 23 dossiers d'animation, ZÉRO fichier — le piège
//     principal, `Test-Path` sur le dossier renvoie True.
// Contrôlable à tout moment : `node scripts/check-clip-rig.mjs <rig> <clip>`.
const UTA = "/models/animations/uta_locomotion";
const UTA_PREFIX = "AnimSeq_Traversal_Movement";
/** Pack UTA complet (non strippé) — substituts pour les clips absents de uta_locomotion/. */
const UTA_DIVERS = "/models/divers/UTA/AnimSeq";

/** Clé de direction → suffixe de fichier UTA. Doit rester alignée sur LocoDir. */
const UTA_DIR_FILE: Record<string, string> = {
  forward:      "Forward",
  forwardLeft:  "ForwardLeft",
  forwardRight: "ForwardRight",
  left:         "Left",
  right:        "Right",
  back:         "Back",
  backLeft:     "BackLeft",
  backRight:    "BackRight",
};

/** Nom d'action interne d'un clip directionnel : `walk_forward`, `run_backLeft`… */
export function locoActionName(gait: "walk" | "run", dir: string): string {
  return `${gait}_${dir}`;
}

/** Les 16 clips directionnels + sprint + idle, prêts pour `renameClip()`. */
export const UTA_LOCOMOTION: { path: string; action: string }[] = [
  ...(["walk", "run"] as const).flatMap((gait) =>
    Object.entries(UTA_DIR_FILE).map(([dir, file]) => ({
      path: `${UTA}/${UTA_PREFIX}_${gait === "walk" ? "Walk" : "Run"}_${file}.glb`,
      action: locoActionName(gait, dir),
    })),
  ),
  { path: `${UTA}/${UTA_PREFIX}_Sprint.glb`, action: "sprint" },
  // `idle_uta` sert DEUX rôles : idle de secours, et surtout pose de RÉFÉRENCE
  // pour convertir le squat en additif (makeClipAdditive). Il doit venir du même
  // pack que le squat, sinon la soustraction produit une pose fausse.
  { path: `${UTA}/${UTA_PREFIX}_Idle.glb`,   action: "idle_uta" },
  // ── ACCROUPISSEMENT TACTIQUE (AnimStarterPack d'Epic) ─────────────────────
  //
  // ERREUR CORRIGÉE : la pose venait d'abord de `Climb_Squat_Idle`, tirée du set
  // d'ESCALADE — c'est un accroupissement sur corniche étroite, jambes repliées
  // au sol. Utilisable pour s'agripper, pas pour jouer : le personnage s'asseyait.
  //
  // Ces clips-ci sont de vraies postures basses sur les pieds, avec leurs
  // transitions debout↔accroupi et une marche accroupie dans les 4 directions.
  // Vérifié : 68 os ciblés, 0 absent du rig Paragon — même signature que UTA.
  { path: `${UTA}/Anim_Crouch_Idle_Hip.glb`,           action: "crouch_pose" },
  { path: `${UTA}/Anim_Stand_to_Crouch_Rifle_Hip.glb`, action: "crouch_enter" },
  { path: `${UTA}/Anim_Crouch_to_Stand_Rifle_Hip.glb`, action: "crouch_exit" },
];

/** Marche accroupie, 4 directions — alimente le blend quand `crouching` est actif. */
export const CROUCH_LOCOMOTION: { path: string; action: string }[] = [
  { path: `${UTA}/Anim_Crouch_Walk_Fwd_Rifle_Hip.glb`, action: "crouchwalk_forward" },
  { path: `${UTA}/Anim_Crouch_Walk_Bwd_Rifle_Hip.glb`, action: "crouchwalk_back" },
  { path: `${UTA}/Anim_Crouch_Walk_Lt_Rifle_Hip.glb`,  action: "crouchwalk_left" },
  { path: `${UTA}/Anim_Crouch_Walk_Rt_Rifle_Hip.glb`,  action: "crouchwalk_right" },
];

/** PLAYER P2 — Dash/slide, wall run, ledge grab animations.
 *  Les 7 clips ci-dessous n'existent PAS dans uta_locomotion/ (stripé).
 *  Redirigés vers le pack UTA complet dans divers/UTA/AnimSeq/. */
export const P2_TRAVERSAL: { path: string; action: string }[] = [
  { path: `${UTA_DIVERS}/Traversal_Movement/AnimSeq_Traversal_Movement_Run_n_Slide_WholeSequence.glb`, action: "slide" },
  { path: `${UTA_DIVERS}/Traversal_Movement/AnimSeq_Traversal_Movement_Sprint.glb`,                    action: "dash_anim" },
  { path: `${UTA_DIVERS}/Traversal_Movement/AnimSeq_Traversal_Movement_WallRun_Left_Loop.glb`,         action: "wallrun" },
  { path: `${UTA_DIVERS}/Traversal_Movement/AnimSeq_Traversal_Movement_WallRun_Right_Loop.glb`,        action: "wallrun_alt" },
  { path: `${UTA_DIVERS}/Traversal_Ledge/AnimSeq_Traversal_Ledge_Climb_HangingIdle.glb`,               action: "ledgegrab" },
  { path: `${UTA_DIVERS}/Traversal_Ledge/AnimSeq_Traversal_Ledge_Climb_HangingIdle_To_4Limbs_Hold_Idle.glb`, action: "ledgegrab_up" },
  { path: `${UTA_DIVERS}/Traversal_Platform/AnimSeq_Traversal_Platform_StepAcross.glb`,                action: "step_up" },
];

/** Séquence de saut découpée + raccord vers l'escalade de mur. */
export const UTA_TRAVERSAL: { path: string; action: string }[] = [
  { path: `${UTA}/${UTA_PREFIX}_Jump_InPlace_PreJump.glb`,    action: "jump_start" },
  { path: `${UTA}/${UTA_PREFIX}_Jump_InPlace_Jump.glb`,       action: "jump" },
  { path: `${UTA}/${UTA_PREFIX}_Jump_InPlace_Loop.glb`,       action: "fall" },
  { path: `${UTA}/${UTA_PREFIX}_Jump_InPlace_PreLanding.glb`, action: "landing_antic" },
  { path: `${UTA}/${UTA_PREFIX}_Jump_InPlace_Landing.glb`,    action: "landing" },
  { path: `${UTA}/${UTA_PREFIX}_Jump_InPlace_to_Wall_Climb_4Limbs_HoldIdle.glb`, action: "climb_start" },
  // Cycle d'escalade : accroche, maintien, montée alternée, sortie au sommet.
  { path: `${UTA}/AnimSeq_Traversal_Wall_Climb_4Limbs_Hold_Idle.glb`, action: "climb_idle" },
  { path: `${UTA}/AnimSeq_Traversal_Wall_Climb_Up_LeftHand.glb`,      action: "climb_up_l" },
  { path: `${UTA}/AnimSeq_Traversal_Wall_Climb_Up_RightHand.glb`,     action: "climb_up_r" },
  { path: `${UTA}/AnimSeq_Traversal_Wall_Climb_End_toStanding.glb`,   action: "climb_top" },
];

// ── Rampage (Paragon — rig UE4, 3 skins) ────────────────────────────────────
const RAMP = `${CHAR}/rampange`;

export const RAMPAGE_BASE = `${RAMP}/Rampage.glb`;

export const RAMPAGE_SKINS: Record<string, string> = {
  rampage:            RAMPAGE_BASE,
  rampage_elemental:  `${RAMP}/Rampage_Elemental.glb`,
  rampage_redneck:    `${RAMP}/Rampage_Redneck.glb`,
};

export function bulletSkinPath(avatarId: string): string | undefined {
  return WRAITH_SKINS[avatarId] ?? MURDOCK_SKINS[avatarId] ?? RAMPAGE_SKINS[avatarId];
}

export function isBulletAvatar(avatarId: string): boolean {
  return avatarId in WRAITH_SKINS || avatarId in MURDOCK_SKINS || avatarId in RAMPAGE_SKINS;
}

// ── Avatars boot (Bullet Paragon) — GLBs bases à précharger au démarrage ────
export const BOOT_AVATAR_GLBS: string[] = [WRAITH_BASE, MURDOCK_BASE, RAMPAGE_BASE];
