import { isCustomCharacter } from "./customCharacterStore";
import { bulletSkinPath } from "./avatarAssets";
// characters/playerAvatars.ts — avatars JOUABLES sélectionnables à la création.
//
// "wraith*"   = Wraith Paragon (rig UE4, anims embarquées) → OwnAnimPlayerCharacter.
// "murdock*"  = Murdock Paragon (rig UE4, anims embarquées) → OwnAnimPlayerCharacter.
// Les Meshy   = /models/pnj/<folder>/ rendus par MeshyPlayerCharacter.

export interface PlayerAvatar {
  id: string;
  label: string;
  isMeshy: boolean;
  ownAnimPath?: string;
  ownAnimScale?: number;
  sharedRig?: boolean;
  /**
   * Le rig est un UE Mannequin (`root`, `pelvis`, `spine_01`, `clavicle_l`…)
   * SANS animation embarquée → il faut lui servir les clips partagés
   * `BULLET_LOCOMOTION`, comme à Wraith et Murdock.
   *
   * POURQUOI CE DRAPEAU EXISTE : le dispatcher d'animation ne reconnaissait
   * que `isBulletAvatar()`, c'est-à-dire les seuls packs Paragon. Les avatars
   * ajoutés ensuite tombaient dans la branche « anims embarquées uniquement »
   * — or ils n'en ont AUCUNE (mesuré : 0 clip dans chacun de leurs GLB). Ils
   * apparaissaient donc figés en pose de repos, sans le moindre message.
   */
  ueMannequinRig?: boolean;
}

// Corps sans arme fusionnée — chemins mesurés, testés présents sur le disque
// par playerAvatars.test.ts (le fallback SPA de Vite rend un chemin faux muet).
const SAMURAI_CASQUE   = "/models/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_WithHelmet.glb";
const SAMURAI_TETE_NUE = "/models/personnages/CyberpunkSamurai/Meshes/SK_CyberpunkSamurai_WithoutHelmet.glb";
const VALKIRIA = "/models/personnages/Valkiria/Old_version/Mesh/SK_Valkiria.glb";

export const DEFAULT_AVATAR = "wraith";

export const PLAYER_AVATARS: PlayerAvatar[] = [
  // Wraith (Paragon) — rig UE4, anims embarquées
  { id: "wraith",          label: "Wraith",          isMeshy: false, ownAnimPath: bulletSkinPath("wraith")! },
  { id: "wraith_lunarops", label: "Wraith Lunar",    isMeshy: false, ownAnimPath: bulletSkinPath("wraith_lunarops")! },
  { id: "wraith_odgreen",  label: "Wraith OD",       isMeshy: false, ownAnimPath: bulletSkinPath("wraith_odgreen")! },
  // Murdock (Paragon) — rig UE4, anims embarquées
  { id: "murdock",             label: "Murdock",          isMeshy: false, ownAnimPath: bulletSkinPath("murdock")! },
  { id: "murdock_corrupt",     label: "Murdock Corrupt",  isMeshy: false, ownAnimPath: bulletSkinPath("murdock_corrupt")! },
  { id: "murdock_executioner", label: "Murdock Exec",     isMeshy: false, ownAnimPath: bulletSkinPath("murdock_executioner")! },
  { id: "murdock_merc",        label: "Murdock Merc",     isMeshy: false, ownAnimPath: bulletSkinPath("murdock_merc")! },
  { id: "murdock_sf",          label: "Murdock SF",       isMeshy: false, ownAnimPath: bulletSkinPath("murdock_sf")! },
  { id: "murdock_shogun",      label: "Murdock Shogun",   isMeshy: false, ownAnimPath: bulletSkinPath("murdock_shogun")! },
  { id: "murdock_wasteland",   label: "Murdock Wasteland",isMeshy: false, ownAnimPath: bulletSkinPath("murdock_wasteland")! },

  // ── CORPS SANS ARME FUSIONNÉE ─────────────────────────────────────────────
  // Wraith et Murdock portent leur arme DANS le modèle (18 614 et 17 044
  // triangles, en primitives séparées). `builtinWeaponMask` la masque, mais ces
  // corps-ci n'en ont pas du tout : ils sont nés pour un système d'équipement.
  //
  // Même convention de squelette que Wraith — vérifié os par os : `root`,
  // `pelvis`, `spine_01`, `clavicle_l`, `upperarm_l`… (UE Mannequin). Ils en ont
  // 68 contre 155 pour Wraith, mais c'est un SOUS-ENSEMBLE : les clips partagés
  // se lient par nom, les os absents (sac à dos, pistons) ne reçoivent rien.
  //
  // Wraith lui-même embarque 0 animation — ses clips viennent du set partagé.
  // Ces corps sont donc dans exactement la même situation.

  // ── TROOPER RETIRÉ DU ROSTER — pack exporté SANS SES MATÉRIAUX ────────────
  // Les 33 GLB du set n'ont qu'un seul matériau : `WorldGridMaterial`, le
  // damier gris par défaut d'Unreal. Vérifié un par un — pas une exception.
  // En jeu, les trois morphologies apparaissaient entièrement grises.
  //
  // Les 136 textures du Trooper SONT dans le pack
  // (`Textures/Trooper_Armor_Combined/`, `Trooper_Heads_and_Bodies/`…), mais
  // les rebrancher à la main demanderait de deviner, sur 33 fichiers, quel
  // atlas va sur quel mesh — et la variante « single_mat » n'a QU'UN matériau
  // pour le corps ET la tête, qui ont pourtant des jeux de textures distincts.
  // Le suffixe `_N_ydown` signale en plus une convention de normales inversée.
  // Une erreur d'affectation ne se verrait qu'à l'œil, jamais à la compilation.
  //
  // POUR LES RÉTABLIR : réexporter le pack depuis Unreal avec ses matériaux
  // (décocher « Export Proxy Materials » ne suffit pas — il faut que les
  // Material Instances soient assignées aux Skeletal Meshes avant l'export).
  // Le test `playerAvatars.test.ts` refusera tout avatar resté sur
  // `WorldGridMaterial`, donc l'erreur ne peut pas revenir en silence.

  // Cyberpunk Samurai — casque amovible : deux entrées, un seul rig.
  { id: "samurai",         label: "Samouraï",          isMeshy: false, ownAnimPath: SAMURAI_CASQUE , ueMannequinRig: true },
  { id: "samurai_nohelm",  label: "Samouraï (tête nue)", isMeshy: false, ownAnimPath: SAMURAI_TETE_NUE , ueMannequinRig: true },

  // Valkiria — ATTENTION : son rig source contient une FAUTE DE FRAPPE,
  // `spene_03` au lieu de `spine_03`. Un clip qui pilote `spine_03` ne trouvera
  // donc rien à cet os. Relevé à la mesure, laissé tel quel : renommer l'os
  // désynchroniserait le GLB de ses propres animations livrées à côté.
  { id: "valkiria", label: "Valkiria", isMeshy: false, ownAnimPath: VALKIRIA , ueMannequinRig: true },

  // ── Rampage RETIRÉ du roster jouable ──────────────────────────────────────
  // Rampage est la brute/troll de Paragon : silhouette non humaine, à sa place
  // parmi les ennemis et pas dans la sélection de personnage. Les 3 variantes
  // sont désormais des mobs hostiles (npcCatalog : rampage_brute / _elemental /
  // _redneck). Les assets restent dans avatarAssets (RAMPAGE_SKINS) — ce sont
  // les NpcDef qui les référencent maintenant via modelPath.
  // Un personnage sauvegardé qui pointait sur "rampage*" est rattrapé par
  // coerceAvatarId() → retombe sur DEFAULT_AVATAR.
];

// CORPS COMPOSABLES (Forge Personnages) : roster jouable uniquement (Bullet chars).
export const FORGE_BODIES: PlayerAvatar[] = [
  ...PLAYER_AVATARS,
  // Corps modulaire BikerBundle (pipeline bone dominance) — v2
  { id: "modular", label: "🧩 Modulaire (BikerBundle)", isMeshy: false },
];

// Recherche fusionnée (roster + corps Forge) → les helpers résolvent aussi les corps composables.
const ALL = [...PLAYER_AVATARS, ...FORGE_BODIES.filter((b) => !PLAYER_AVATARS.some((p) => p.id === b.id))];
const findAvatar = (id: string | undefined): PlayerAvatar | undefined => (id ? ALL.find((a) => a.id === id) : undefined);

export function isMeshyAvatar(id: string | undefined): boolean {
  if (!id || id === DEFAULT_AVATAR) return false;
  return findAvatar(id)?.isMeshy ?? false;
}

/** Ramène un id d'avatar à une valeur VALIDE du roster courant. Un id persisté qui a été
 *  retiré du roster (ex: "ninja") ferait charger /models/pnj/<id>/…glb → 404 + crash Canvas
 *  d'aperçu. On retombe sur DEFAULT_AVATAR si l'id n'existe plus. */
export function coerceAvatarId(id: string | undefined): string {
  if (id && isCustomCharacter(id)) return id; // perso composé (Forge Personnages)
  return id && PLAYER_AVATARS.some((a) => a.id === id) ? id : DEFAULT_AVATAR;
}

/** Chemin GLB du perso à anims propres (undefined si ce n'en est pas un). */
export function ownAnimPath(id: string | undefined): string | undefined {
  return findAvatar(id)?.ownAnimPath;
}

/** Multiplicateur d'échelle d'un avatar à rig propre (1 par défaut). */
export function ownAnimScale(id: string | undefined): number {
  return findAvatar(id)?.ownAnimScale ?? 1;
}

/** true si le rig de l'avatar accepte les packs d'anim de classe (Mixamo/Meshy). */
export function avatarSharedRig(id: string | undefined): boolean {
  return findAvatar(id)?.sharedRig ?? false;
}

/** Rig UE Mannequin sans anims embarquées → clips partagés BULLET_LOCOMOTION. */
export function avatarUsesUeRig(id: string | undefined): boolean {
  return findAvatar(id)?.ueMannequinRig ?? false;
}
