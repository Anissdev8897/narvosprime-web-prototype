// ══════════════════════════════════════════════════════════════════════════════
// sandbox/sandboxAssets.ts — Manifeste d'assets du PROTOTYPE SANDBOX.
//
// Ce module est le contrat d'entrée du bac à sable (BRIEF_PROTOTYPE_COMBAT,
// ÉTAPE 1) : UN personnage, ses clips d'animation, RIEN d'autre. Aucune map,
// aucun PNJ, aucune arme équipée, aucun HUD.
//
// RÈGLE D'OR (brief §5) : ce fichier IMPORTE les catalogues du jeu mais ne les
// MODIFIE pas. Si une liste change côté jeu (avatarAssets, animationPacks), la
// sandbox suit automatiquement — c'est voulu : on teste le système d'animation
// RÉEL, pas une copie figée qui dériverait.
//
// Le personnage retenu est Wraith :
//   • rig UE4 (root/pelvis/spine_01…hand_r, 68 os) = cible exacte des clips
//     BULLET_LOCOMOTION / UTA / FPP_combat_fists (0 os absent mesuré) ;
//   • GLB KTX2 déjà transcodé, 11,3 Mo — léger à côté des maps chunkées ;
//   • son arme intégrée (18 614 tris de canon) est masquée au runtime par
//     setBuiltinWeaponVisible, comme dans le jeu.
// ══════════════════════════════════════════════════════════════════════════════

import {
  WRAITH_BASE,
  WRAITH_ANIMS,
  BULLET_LOCOMOTION,
  UTA_LOCOMOTION,
  UTA_TRAVERSAL,
  CROUCH_LOCOMOTION,
  P2_TRAVERSAL,
} from "../characters/avatarAssets";
import { UNARMED_PACK, firstPerAction } from "../animation/animationPacks";

/** Avatar unique du prototype. */
export const SANDBOX_CHARACTER: string = WRAITH_BASE;

/**
 * Hauteur cible du personnage, en mètres (normalisation par bounding-box).
 * Même valeur que le joueur en jeu (OwnAnimPlayerCharacter.TARGET_HEIGHT) pour
 * que les réglages d'échelle restent comparables entre prototype et jeu.
 */
export const SANDBOX_TARGET_HEIGHT = 1.8;

/** Un fichier de clip à charger ; `action` absent = clip déjà nommé (Ability_*). */
export interface SandboxClipJob {
  path: string;
  action?: string;
}

/**
 * Jobs de chargement des clips — ASSEMBLAGE STRICTEMENT IDENTIQUE au wrapper
 * Bullet du jeu (OwnAnimPlayerCharacter.OwnAnimBullet, lignes 625-657) :
 *
 *   1. BULLET_LOCOMOTION  — idle + locomotion de base (convention UE4, mètres)
 *   2. UTA_LOCOMOTION     — 16 clips directionnels (marche/course × 8) + sprint
 *   3. UTA_TRAVERSAL      — saut découpé (start/loop/land) + raccords d'escalade
 *   4. CROUCH_LOCOMOTION  — marche accroupie 4 directions + transitions
 *   5. P2_TRAVERSAL       — dash, wall run, slide, ledge grab
 *   6. UNARMED_PACK       — combo poings/kick/hit (firstPerAction : 1 variante
 *                           par action, latéralité CLIP_CANDIDATES respectée)
 *   7. WRAITH_ANIMS       — Ability_E / Ability_Q (clips déjà nommés)
 *
 * L'ORDRE compte : resolveActions retient le premier clip qui matche, donc la
 * locomotion explicite passe avant toute correspondance par sous-chaîne.
 */
export const SANDBOX_CLIP_JOBS: SandboxClipJob[] = [
  ...BULLET_LOCOMOTION,
  ...UTA_LOCOMOTION,
  ...UTA_TRAVERSAL,
  ...CROUCH_LOCOMOTION,
  ...P2_TRAVERSAL,
  ...firstPerAction(UNARMED_PACK),
  ...WRAITH_ANIMS.map((path) => ({ path })),
];

/**
 * Chemins UNIQUES à télécharger, dans l'ordre de première apparition.
 *
 * Deux fichiers servent DEUX actions chacun — choix assumés du catalogue du
 * jeu, pas des doublons :
 *   • `Jog_Fwd.glb`             → `run` ET `sprint` (BULLET_LOCOMOTION) ;
 *   • `attack_special_kick.glb` → `kick` ET `kick_charged` (fallback, UNARMED_PACK).
 *
 * Le jeu les télécharge et les parse DEUX FOIS (deux `loader.load` sur le même
 * path). La sandbox fait mieux : UN fetch par chemin, puis un `renameClip` par
 * job — les pistes sont partagées, le clip renommé ne coûte qu'un conteneur.
 * (Amélioration documentée dans .hermes/DEMANDES_CROISEES.md, non appliquée au
 * jeu : brief §5.)
 */
export const SANDBOX_CLIP_PATHS: string[] = [
  ...new Set(SANDBOX_CLIP_JOBS.map((j) => j.path)),
];
