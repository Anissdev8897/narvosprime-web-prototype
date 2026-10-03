// ══════════════════════════════════════════════════════════════════════════════
// weapons/weaponCatalog.ts — Inventaire des armes réelles du dossier weapon/.
//
// Liste les fichiers d'armes relevés dans public/models/armes/weapon/
// et les classe AUTOMATIQUEMENT (type + pack d'animation) via weaponClassifier.
// Les munitions/props/jetables sont inclus mais marqués isWeapon=false.
// ══════════════════════════════════════════════════════════════════════════════

import { classifyWeapon, weaponTypeMeta, type WeaponType } from "./weaponClassifier";
import type { WeaponProfile } from "./weaponTypes";

const WEAPON_ROOT = "/models/armes/weapon";
const ARMES_ROOT = "/models/armes";

/** Fichiers d'armes relevés (chemins relatifs à WEAPON_ROOT). */
export const WEAPON_FILES: string[] = [
  // allweaponrpg
  "allweaponrpg/uploads_files_5605095_battle_axe.glb",
  "allweaponrpg/uploads_files_5605095_claymore.glb",
  "allweaponrpg/uploads_files_5605095_crudgel.glb",
  "allweaponrpg/uploads_files_5605095_giant_mace.glb",
  "allweaponrpg/uploads_files_5605095_keen_axe.glb",
  "allweaponrpg/uploads_files_5605095_mining_axe.glb",
  "allweaponrpg/uploads_files_5605095_recurve_bow.glb",
  "allweaponrpg/uploads_files_5605095_short_sword.glb",
  "allweaponrpg/uploads_files_5605095_spear.glb",
  // arcs
  "arc/bowready.glb",
  "arc/uploads_files_2715090_ANIMATEDBOW.glb",
  "arc/uploads_files_2715090_bowready.glb",
  // magie
  "baton_magique/uploads_files_2214281_Magic+wand.glb",
  // grandes épées
  "epe_darks_fatastique/Meshy_AI_Grande_épée_dark_fa_0603035436_texture.glb",
  // set fantasy modulaire
  "fantasy_weapon/Meshes/Axe00_mesh.glb",
  "fantasy_weapon/Meshes/Bow00_mesh.glb",
  "fantasy_weapon/Meshes/Knife00_mesh.glb",
  "fantasy_weapon/Meshes/Mace00_mesh.glb",
  "fantasy_weapon/Meshes/Shield00_mesh.glb",
  "fantasy_weapon/Meshes/Staff00_mesh.glb",
  "fantasy_weapon/Meshes/Sword00_mesh.glb",
  // contondant lourd
  "marteau_de_guerre/Meshy_AI_Marteau_de_guerre_gé_0603042411_texture.glb",
  // armes à feu sci-fi
  "Sci_fi/FBX/Gun_Pistol.glb",
  "Sci_fi/FBX/Gun_Revolver.glb",
  "Sci_fi/FBX/Gun_Rifle.glb",
  "Sci_fi/FBX/Gun_Sniper.glb",
  // munitions / projectiles (classés ammo → non équipables)
  "arrow/uploads_files_4822805_Arrow+2.glb",
  "fantasy_weapon/Meshes/Arrow00_mesh.glb",
];

/** Fichiers d'armes du dossier armes/ (chemins relatifs à ARMES_ROOT). */
const ARMES_FILES: string[] = [
  // Weapons_Free — armes modernes réalistes
  "Weapons_Free/Meshes/SM_axe_001.glb",
  "Weapons_Free/Meshes/SM_baseball_bat_001.glb",
  "Weapons_Free/Meshes/SM_hockey_stick_001.glb",
  "Weapons_Free/Meshes/SM_knife_001.glb",
  "Weapons_Free/Meshes/SM_pistol_001.glb",
  "Weapons_Free/Meshes/SM_pistol_drum_001.glb",
  "Weapons_Free/Meshes/SM_rifle_001.glb",
  "Weapons_Free/Meshes/SM_shotgun_001.glb",
  "Weapons_Free/Meshes/SM_sniper_rifle_001.glb",
  // HS_WeaponPack_03 — revolvers western
  "HS_WeaponPack_03/Meshes/Revolver/SK_HS_WP03_Revolver_X_0.glb",
  "HS_WeaponPack_03/Meshes/Revolver/SK_HS_WP03_Revolver_Y_0.glb",
  // Action_Crossbow — arbalète mécanique
  "Action_Crossbow/Weapons/SM_Crossbow.glb",
  // Shotgun standalone
  "shotgun/shotgun.glb",
  // Armes fantaisie en vrac
  "weapon/as-vulcan_scarlet_lance_-_3d_model_stylized.glb",
  "weapon/azure_core_blade_-_stylized_fantasy_greatsword.glb",
  "weapon/magic_wand.glb",
  "weapon/medieval_morgenstern.glb",
  "weapon/sceptre_of_the_ancient_free.glb",
  "weapon/wand_pheonixflare (1).glb",
  // CG_ShotgunPack — fusils à pompe animés (3 modèles)
  "CG_ShotgunPack/Weapons/Meshes/SK_DBShotgun.glb",
  "CG_ShotgunPack/Weapons/Meshes/SK_PAShotgun.glb",
  "CG_ShotgunPack/Weapons/Meshes/SK_SAShotgun.glb",
];

export interface WeaponCatalogEntry {
  path: string;            // chemin servi par Vite (public/)
  name: string;            // nom de fichier
  type: WeaponType;
  animPack: string | null; // dossier de pack d'animation (null si non équipable)
  isWeapon: boolean;       // arme de main équipable ?
}

function buildEntries(root: string, files: string[]): WeaponCatalogEntry[] {
  return files.map((rel) => {
    const type = classifyWeapon(rel);
    const meta = weaponTypeMeta(type);
    return {
      path: `${root}/${rel}`,
      name: rel.split("/").pop() ?? rel,
      type,
      animPack: meta.animPackFolder,
      isWeapon: meta.isWeapon,
    };
  });
}

export const WEAPON_CATALOG: WeaponCatalogEntry[] = [
  ...buildEntries(WEAPON_ROOT, WEAPON_FILES),
  ...buildEntries(ARMES_ROOT, ARMES_FILES),
];

/** Armes de main équipables uniquement (exclut munitions/props). */
export const EQUIPPABLE_WEAPONS: WeaponCatalogEntry[] = WEAPON_CATALOG.filter((w) => w.isWeapon);

/** Regroupe les armes équipables par pack d'animation (pour le binder / UI). */
export function weaponsByAnimPack(): Record<string, WeaponCatalogEntry[]> {
  const out: Record<string, WeaponCatalogEntry[]> = {};
  for (const w of EQUIPPABLE_WEAPONS) {
    if (!w.animPack) continue;
    (out[w.animPack] ??= []).push(w);
  }
  return out;
}

// ── Profils auto-générés : TOUTES les armes du dossier deviennent équipables ──────
// L'id est stable (dérivé du chemin), le type/socket/grip viennent de la classification.
// L'échelle reste à 1 : WeaponSocket applique l'auto-scale (bbox × type) sauf override.

/** Slug propre depuis un nom de fichier (sans extension, sans bruit d'export). */
function slugifyWeaponName(name: string): string {
  return name
    .replace(/\.[^.]+$/, "")                       // extension
    .replace(/^uploads_files_\d+_/i, "")           // préfixe d'upload
    .replace(/^Meshy_AI_/i, "")                    // préfixe Meshy
    .replace(/_\d{6,}_texture$/i, "")              // suffixe d'export Meshy
    .replace(/_mesh$/i, "")                        // suffixe set fantasy
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // accents combinés
    .toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

/** Id de profil stable + UNIQUE pour une entrée du catalogue (dédup par suffixe). */
function catalogWeaponId(entry: WeaponCatalogEntry, used: Set<string>): string {
  const base = `cat_${entry.type}_${slugifyWeaponName(entry.name)}`.replace(/_+/g, "_");
  let id = base, n = 2;
  while (used.has(id)) id = `${base}_${n++}`;
  used.add(id);
  return id;
}

/** Profils d'arme dérivés du catalogue (armes équipables uniquement). */
export function catalogProfiles(): WeaponProfile[] {
  const used = new Set<string>();
  return EQUIPPABLE_WEAPONS.map((w) => {
    const meta = weaponTypeMeta(w.type);
    return {
      id: catalogWeaponId(w, used),
      type: w.type,
      path: w.path,
      grip: meta.grip,
      socket: meta.socket,
      ...(meta.supportSocket ? { supportSocket: meta.supportSocket } : {}),
      visibility: "always" as const,
      ...(w.animPack ? { animationProfile: w.animPack.replace(/^animation_/, "") } : {}),
      offset: { position: [0, 0, 0] as [number, number, number], rotation: [0, 0, 0] as [number, number, number], scale: 1 },
    };
  });
}
