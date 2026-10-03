// ══════════════════════════════════════════════════════════════════════════════
// weapons/weaponClassifier.ts — "WeaponTypeClassifier" (asset → type → animation).
//
// Analyse le NOM d'un fichier d'arme et en déduit son type, puis le pack
// d'animation cohérent + les défauts de grip/socket. 100% data-driven : les règles
// sont des (regex → type) ordonnées, plus une table type → métadonnées.
//
// Flux : chemin fichier → classifyWeapon() → WeaponType → weaponTypeMeta() →
//        { animPackFolder, grip, socket, isWeapon }.
//
// Décisions projet :
//   • armes à feu (gun) → réutilisent le pack "animation_archer" (visée).
//   • épées 2 mains (claymore / grande épée) → pack "animation_meelee".
// ══════════════════════════════════════════════════════════════════════════════

import type { GripKind, SocketName } from "./weaponTypes";

export type WeaponType =
  | "sword_1h" | "sword_2h" | "dagger" | "axe" | "blunt" | "spear"
  | "bow" | "staff" | "gun" | "shield"
  | "ammo" | "throwable" | "clip" | "ignore";

export interface WeaponTypeMeta {
  /** Pack d'animation (dossier sous assets_character/) ou null si non équipable. */
  animPackFolder: string | null;
  grip: GripKind;
  /** Main principale qui tient l'arme. */
  socket: SocketName;
  /** Main de support (2 mains / offhand). */
  supportSocket?: SocketName;
  /** false = munition / prop / jetable → PAS une arme de main équipable. */
  isWeapon: boolean;
}

export const WEAPON_TYPE_META: Record<WeaponType, WeaponTypeMeta> = {
  sword_1h: { animPackFolder: "animation_sword_and_shield", grip: "one_hand", socket: "RightHand", isWeapon: true },
  sword_2h: { animPackFolder: "animation_meelee", grip: "two_hand", socket: "RightHand", supportSocket: "LeftHand", isWeapon: true },
  dagger:   { animPackFolder: "animation_meelee", grip: "one_hand", socket: "RightHand", isWeapon: true },
  axe:      { animPackFolder: "animation_meelee", grip: "one_hand", socket: "RightHand", isWeapon: true },
  blunt:    { animPackFolder: "animation_meelee", grip: "one_hand", socket: "RightHand", isWeapon: true },
  spear:    { animPackFolder: "animation_meelee", grip: "two_hand", socket: "RightHand", supportSocket: "LeftHand", isWeapon: true },
  bow:      { animPackFolder: "animation_archer", grip: "two_hand", socket: "LeftHand", supportSocket: "RightHand", isWeapon: true },
  staff:    { animPackFolder: "animation_magie", grip: "two_hand", socket: "RightHand", supportSocket: "LeftHand", isWeapon: true },
  gun:      { animPackFolder: "animation_shooter", grip: "two_hand", socket: "RightHand", supportSocket: "LeftHand", isWeapon: true }, // pack tireur dédié (≠ archer) → pas de collision visée arc
  shield:   { animPackFolder: "animation_sword_and_shield", grip: "one_hand", socket: "LeftHand", isWeapon: true }, // offhand
  ammo:     { animPackFolder: null, grip: "one_hand", socket: "RightHand", isWeapon: false },
  throwable:{ animPackFolder: null, grip: "one_hand", socket: "RightHand", isWeapon: false },
  clip:     { animPackFolder: null, grip: "one_hand", socket: "RightHand", isWeapon: false },
  ignore:   { animPackFolder: null, grip: "one_hand", socket: "RightHand", isWeapon: false },
};

// Règles ORDONNÉES (1re qui matche gagne). L'ordre est crucial : on écarte d'abord
// les non-armes (prop/enemy), puis les cas spécifiques (2H, dagger) AVANT le générique.
const RULES: { re: RegExp; type: WeaponType }[] = [
  // ── CLIPS D'ANIMATION, TOUT EN HAUT ──────────────────────────────────────────
  // Les packs d'armes exportent leurs animations en GLB, dans les mêmes dossiers
  // que les meshes et sous des noms qui contiennent le nom de l'arme :
  // `Anim_Mann_DBS_Gun_Raise`, `AS_HS_WP03_Revolver_Fire`. Sans cette règle en
  // PREMIER, la règle `gun` les attrapait : mesuré 46 fichiers — 42 en `Anim_`,
  // 4 en `AS_` — qui se retrouvaient équipables et donc en boutique, où ils
  // n'affichaient qu'une paire de bras de mannequin.
  //
  // Ce ne sont pas des déchets : ce sont les animations de tir, de rechargement
  // et de lancer de grenade. Elles vont au binder d'animation d'arme, pas au
  // socket de la main. `WEAPON_ANIM_CLIPS` (weaponAnimClips.ts) les expose.
  //
  // Ancré en DÉBUT DE NOM, et STRICT sur la casse pour `AS_` : c'est la
  // convention Unreal (AnimSequence). Un premier jet en `/^(anim|as)[_-]/i`
  // attrapait `as-vulcan_scarlet_lance_-_3d_model_stylized.glb` — une vraie
  // lance, dont le nom est un slug de marketplace commençant par « as- ». Le
  // test d'inventaire l'a signalé ; d'où les deux motifs séparés.
  { re: /^AS_/, type: "clip" },        // Unreal AnimSequence : casse significative
  { re: /^Anim[_-]/i, type: "clip" },  // export « Anim_Mann_… », casse libre

  // ── Jetables AVANT le filtre prop (ex: "Prop_Grenade" est un jetable, pas un prop) ──
  { re: /grenade|\bmine\b/i, type: "throwable" },
  { re: /arrow|fleche|flèche|[_-]ammo|munition/i, type: "ammo" },
  // ── Non-armes (rejet) ────────────────────────────────────────────────────────
  { re: /\b(prop|enemy)[_-]|crate|barrel|chair|desk|chest|shelves|locker|\bmug\b|syringe|healthpack|keycard|satellite/i, type: "ignore" },
  // ── Armes spécifiques AVANT le générique ────────────────────────────────────
  { re: /shield|bouclier/i, type: "shield" },
  { re: /bow|\barc\b|recurve/i, type: "bow" },
  { re: /wand|baton|bâton|staff|sceptre|scepter/i, type: "staff" },
  { re: /gun|pistol|revolver|rifle|\bsmg\b|sniper|fusil/i, type: "gun" },
  { re: /claymore|greatsword|grande[_ ]?(é|e)p(é|e)e|2h|two[_-]?hand|epe[_-]?dark|épée[_ ]?dark/i, type: "sword_2h" },
  { re: /knife|dagger|dague|couteau/i, type: "dagger" },
  { re: /axe|hache|hatchet/i, type: "axe" },
  { re: /mace|marteau|hammer|cudgel|crudgel|club|gourdin|warhammer|morgenstern|morningstar|\bbat\b|baseball|hockey/i, type: "blunt" },
  { re: /spear|lance|polearm|halberd|hallebarde|pike/i, type: "spear" },
  { re: /sword|epee|épée|sabre|blade|glaive/i, type: "sword_1h" },
];

/** Classe une arme d'après son nom de fichier (ou chemin). Défaut : "ignore". */
export function classifyWeapon(fileOrPath: string): WeaponType {
  const name = fileOrPath.replace(/\\/g, "/").split("/").pop() ?? fileOrPath;
  for (const { re, type } of RULES) if (re.test(name)) return type;
  return "ignore";
}

export function weaponTypeMeta(type: WeaponType): WeaponTypeMeta {
  return WEAPON_TYPE_META[type];
}

/** Raccourci : nom de fichier → dossier de pack d'animation (ou null). */
export function animPackFolderForWeapon(fileOrPath: string): string | null {
  return weaponTypeMeta(classifyWeapon(fileOrPath)).animPackFolder;
}

/** true si le fichier est une arme de main équipable (≠ munition / prop / jetable). */
export function isEquippableWeapon(fileOrPath: string): boolean {
  return weaponTypeMeta(classifyWeapon(fileOrPath)).isWeapon;
}
