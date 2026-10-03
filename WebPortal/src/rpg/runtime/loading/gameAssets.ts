// runtime/loading/gameAssets.ts — REGISTRE central + EXTENSIBLE des assets "render-time".
//
// Point UNIQUE qui énumère tout ce que le jeu rendra hors map/vaisseaux. Deux familles :
//   • GLOBAUX (épinglés) : avatar joueur, armes arch_*, packs d'anim — toujours nécessaires,
//     chargés une fois, JAMAIS évincés (réutilisés sur toutes les maps).
//   • PER-MAP (évinçables) : PNJ/monstres PLACÉS par l'admin sur une map donnée — évincés du
//     cache GPU/RAM à la sortie de la map (cf. AssetPreloader.evict) → mémoire bornée sur
//     longues sessions.
//
// EXTENSIBILITÉ : chaque sous-système enregistre son collecteur (global ou per-map) sans
// modifier ce fichier → impossible d'oublier une catégorie éditable. Les offsets/calibrages/
// comportements sont des DONNÉES (déjà hydratées) → appliqués au rendu, pas ici.
//
// ⚠ Appeler APRÈS hydrateAllStores() : la liste des PNJ placés vient de la base hydratée.
import { BOOT_AVATAR_GLBS } from "../../characters/avatarAssets";
import { weaponRegistry } from "../../weapons/weaponRegistry";
import {
  MAGIE_PACK, ARCHER_PACK, WEAPON_MELEE_PACK, SWORD_SHIELD_PACK, CREATURE_MELEE_PACK, SHOOTER_PACK,
} from "../../animation/animationPacks";
import { npcPlacementStore } from "../../npc/npcPlacementStore";
import { npcAssetUrls } from "../../npc/preloadNpc";
import { MAPS } from "../../loaders/assetManifest";

// Armes Meshy TROP LOURDES (~42 Mo) → jamais préchargées en masse (Context Lost VRAM).
const HEAVY_WEAPON_RE = /epe_darks_fatastique|marteau_de_guerre/i;
const PACKS = [MAGIE_PACK, ARCHER_PACK, WEAPON_MELEE_PACK, SWORD_SHIELD_PACK, CREATURE_MELEE_PACK, SHOOTER_PACK];

/** Collecteur GLOBAL (épinglé) : URLs render-time toujours nécessaires (indép. de la map). */
export type GlobalCollector = () => string[];
/** Collecteur PER-MAP (évinçable) : URLs render-time spécifiques à une map. */
export type MapCollector = (mapId: keyof typeof MAPS) => string[];

const globalCollectors: GlobalCollector[] = [];
const mapCollectors: MapCollector[] = [];

export function registerGlobalCollector(fn: GlobalCollector): void { globalCollectors.push(fn); }
export function registerMapCollector(fn: MapCollector): void { mapCollectors.push(fn); }

function run<T extends (...a: never[]) => string[]>(list: T[], call: (fn: T) => string[]): string[] {
  const out: string[] = [];
  for (const fn of list) {
    try { for (const u of call(fn)) out.push(u); }
    catch (e) { console.warn("[gameAssets] collecteur en échec :", e); }
  }
  return out;
}

/** URLs GLOBALES épinglées (avatar/armes/packs) — jamais évincées. */
export function collectGlobalAssets(): string[] {
  return [...new Set(run(globalCollectors, (f) => f()))];
}
/** URLs PER-MAP (PNJ placés…) d'une map — évinçables à la sortie. */
export function collectMapAssets(mapId: keyof typeof MAPS): string[] {
  return [...new Set(run(mapCollectors, (f) => f(mapId)))];
}
/** Tout le warm d'une map = globaux + per-map (dédupliqué). */
export function collectWarmAssets(mapId: keyof typeof MAPS): string[] {
  return [...new Set([...collectGlobalAssets(), ...collectMapAssets(mapId)])];
}

// ── Collecteurs intégrés ─────────────────────────────────────────────────────
registerGlobalCollector(() => BOOT_AVATAR_GLBS); // avatar joueur Wraith (épinglé)
registerGlobalCollector(() =>                  // armes de classe arch_* (hors lourdes)
  weaponRegistry.all()
    .filter((wp) => /^arch_/.test(wp.id) && /\.glb$/i.test(wp.path) && !HEAVY_WEAPON_RE.test(wp.path))
    .map((wp) => wp.path),
);
registerGlobalCollector(() =>                  // packs d'anim (magie/archer/melee/sword/creature/shooter)
  PACKS.flatMap((pack) => pack.filter((s) => /\.glb$/i.test(s.path)).map((s) => s.path)),
);
registerMapCollector((mapId) =>               // PNJ/monstres placés par l'admin (évinçable)
  npcPlacementStore.list(mapId).flatMap((n) => npcAssetUrls(n.folder)),
);
