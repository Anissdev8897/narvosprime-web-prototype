// archetypes/preloadArchetypeAssets.ts — préchauffe les FBX d'archétype en temps IDLE.
//
// Le choix de maîtrise d'arme (archétype) change l'arme + le pack d'animation du perso.
// Ces fichiers sont des FBX, PARSÉS sur le thread principal au 1er usage → micro-freeze
// au moment du choix. On les précharge pendant les temps morts (requestIdleCallback,
// un à la fois) après le 1er affichage → au choix, tout est déjà en cache = instantané.

import { useGLTF } from "@react-three/drei";
import { preloadGltfPack } from "../animation/useFbxAnimationPack";
import { SWORD_SHIELD_PACK, WEAPON_MELEE_PACK, ARCHER_PACK, MAGIE_PACK, CREATURE_MELEE_PACK, SHOOTER_PACK } from "../animation/animationPacks";
import { weaponRegistry } from "../weapons/weaponRegistry";

let started = false;

// Armes TROP LOURDES (~42 Mo chacune) → JAMAIS préchargées (saturent la VRAM) : elles
// se chargent uniquement à la demande si on les équipe explicitement.
const HEAVY_WEAPON_RE = /epe_darks_fatastique|marteau_de_guerre/i;

/** Idle-callback avec repli setTimeout (typage permissif). */
function onIdle(cb: () => void): void {
  const ric = (globalThis as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
  if (typeof ric === "function") ric(cb, { timeout: 2500 });
  else setTimeout(cb, 300);
}

/** Précharge (une seule fois) les packs d'anim + armes d'archétype, étalé en idle. */
export function preloadArchetypeAssetsIdle(): void {
  if (started) return;
  started = true;

  const jobs: Array<() => void> = [
    // Packs d'animation d'archétype (GLB, off-thread).
    () => preloadGltfPack(SWORD_SHIELD_PACK),
    () => preloadGltfPack(WEAPON_MELEE_PACK),
    () => preloadGltfPack(ARCHER_PACK),
    () => preloadGltfPack(MAGIE_PACK),
    () => preloadGltfPack(CREATURE_MELEE_PACK), // boss mutant (golem/créatures) → 1er spawn sans hitch
    () => preloadGltfPack(SHOOTER_PACK),        // guerrier futuriste (Tosus) → tir sans hitch
  ];
  // Armes d'ARCHÉTYPE (arch_*) uniquement, 1 par créneau idle → changer de classe = arme
  // instantanée, sans pic mémoire. NE PAS précharger TOUT le catalogue : ~26 armes jamais
  // équipées en jeu = ~50-100 Mo de textures RGBA résidentes pour rien (jamais libérées, pas
  // de useGLTF.clear). Le catalogue se charge à la demande (éditeur d'arme = équipement forcé
  // → upload GPU au besoin). Armes lourdes (42 Mo) toujours exclues. Dédup par chemin.
  const seen = new Set<string>();
  for (const wp of weaponRegistry.all()) {
    if (!/\.glb$/i.test(wp.path) || HEAVY_WEAPON_RE.test(wp.path) || seen.has(wp.path)) continue;
    if (!/arch_/i.test(wp.path)) continue; // catalogue exclu → chargé à la demande, pas en RAM permanente
    seen.add(wp.path);
    jobs.push(() => { try { useGLTF.preload(wp.path); } catch { /* fichier absent → ignoré */ } });
  }

  let i = 0;
  const step = () => {
    if (i >= jobs.length) return;
    try { jobs[i++](); } catch { /* parse FBX non bloquant */ }
    onIdle(step); // une tâche par créneau idle → ne bloque jamais une frame
  };
  onIdle(step);
}

let packsWarmed = false;
/** Précharge IMMÉDIATEMENT les 6 packs d'anim d'archétype (petits, anim-only) — à appeler à
 *  l'ouverture du sélecteur d'archétype → changer de classe ne parse plus le pack = pas de
 *  freeze. Idempotent. (Les armes arch_* sont déjà préchauffées par WeaponSocket.) */
export function preloadArchetypePacksNow(): void {
  if (packsWarmed) return;
  packsWarmed = true;
  for (const pack of [SWORD_SHIELD_PACK, WEAPON_MELEE_PACK, ARCHER_PACK, MAGIE_PACK, CREATURE_MELEE_PACK, SHOOTER_PACK]) {
    try { preloadGltfPack(pack); } catch { /* asset absent → ignoré */ }
  }
}
