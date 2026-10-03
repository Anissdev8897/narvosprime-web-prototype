// runtime/loading/bootAssets.ts — liste des assets GLOBAUX à charger au BOOT (avant le
// choix du serveur) : avatar joueur, tous les packs d'animation, armes d'archétype, set
// d'anims PNJ partagé. Indépendants de la map → chargés UNE fois derrière l'écran de boot,
// les entrées en jeu suivantes n'ont plus que la map + les PNJ placés à charger.
import { BOOT_AVATAR_GLBS } from "../../characters/avatarAssets";
import {
  SWORD_SHIELD_PACK, WEAPON_MELEE_PACK, ARCHER_PACK, MAGIE_PACK,
  CREATURE_MELEE_PACK, SHOOTER_PACK, UNARMED_PACK, REACTIONS_PACK,
} from "../../animation/animationPacks";
import { weaponRegistry } from "../../weapons/weaponRegistry";
import { getNpcModelPath } from "../../loaders/assetManifest";

/** URLs GLB globales du boot (dédupliquées, ordre = priorité d'affichage). */
export function collectBootAssets(): string[] {
  const urls: string[] = [];

  // 1. Avatar joueur (mesh Wraith par défaut) — le perso doit être prêt en premier.
  urls.push(...BOOT_AVATAR_GLBS);

  // 2. Set d'anims canonique des PNJ bipèdes (partagé par tous les Meshy).
  urls.push(getNpcModelPath("soldat_humain"));

  // 3. Packs d'animation (archétypes + mains nues + réactions) — tous GLB anim-only légers.
  for (const pack of [
    SWORD_SHIELD_PACK, WEAPON_MELEE_PACK, ARCHER_PACK, MAGIE_PACK,
    CREATURE_MELEE_PACK, SHOOTER_PACK, UNARMED_PACK, REACTIONS_PACK,
  ]) {
    for (const s of pack) urls.push(s.path);
  }

  // 4. Armes d'archétype (arch_*) — équipées par défaut selon la classe.
  for (const wp of weaponRegistry.all()) {
    if (wp.id.startsWith("arch_") && /\.glb$/i.test(wp.path)) urls.push(wp.path);
  }

  return [...new Set(urls)];
}
