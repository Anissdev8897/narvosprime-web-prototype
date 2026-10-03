// runtime/loading/hydrateAll.ts — hydratation ATTENDUE de TOUS les stores éditables.
//
// Avant l'entrée en jeu, toutes les données configurées par l'admin (placements PNJ,
// offsets d'arme/anim, calibrages, comportements, environnement, mutations, réglages…)
// doivent être chargées depuis la base AVANT de collecter/précharger les assets — sinon
// le préchargeur ignore les PNJ placés et les modifs s'appliquent APRÈS le spawn (freeze).
//
// `hydrateAllStores()` lance tous les hydrate en parallèle et RÉSOUT quand TOUT est prêt.
// Mémoïsé (une seule passe par session) → ré-appelable sans coût (cache intelligent).
import { portalStore } from "../donjon/portalStore";
import { spawnPointStore } from "../spawnPointStore";
import { mapBoundsStore } from "../mapBoundsStore";
import { portalAdminStore } from "../donjon/portalAdminStore";
import { arrowMutationStore } from "../combat/arrowMutationStore";
import { npcPlacementStore } from "../../npc/npcPlacementStore";
import { harvestNodeStore } from "../../professions/harvestNodeStore";
import { environmentStore } from "../environment/environmentStore";
import { weaponOffsetStore } from "../../weapons/weaponOffsetStore";
import { weaponCalibrationStore } from "../../weapons/weaponCalibrationStore";
import { characterOffsetStore } from "../../characters/characterOffsetStore";
import { bodyTintStore } from "../../characters/bodyTintStore";
import { animClipStore } from "../../animation/animClipStore";
import { recoilProfileStore } from "../../camera/recoilProfileStore";
import { hydrateSettingsFromDb } from "../../settings/gameSettings";
import { customMapStore } from "../../world/customMapStore";
import { forgeSceneStore } from "../../forge/forgeSceneStore";
import { customCharacterStore } from "../../characters/customCharacterStore";
import { customEquipmentStore } from "../../characters/customEquipmentStore";
import { worldStore } from "../../world/worldStateStore";
import { hydrateScaleFromDb } from "../../characters/characterScale";
import { hydrateOffsetFromDb } from "../../characters/cameraOffset";

let pending: Promise<void> | null = null;

/** Hydrate TOUS les stores éditables (idempotent + mémoïsé). Résout quand tout est chargé. */
export function hydrateAllStores(): Promise<void> {
  if (pending) return pending;
  const jobs: Array<Promise<unknown>> = [
    customMapStore.hydrate(), // EN PREMIER conceptuellement : enregistre les maps custom dans le manifest
    forgeSceneStore.hydrate(), // scènes de l'éditeur Forge (rendu des maps editor://)
    customCharacterStore.hydrate(), // persos composés (Forge Personnages)
    customEquipmentStore.hydrate(), // bibliothèque d'équipements
    worldStore.hydrate(),           // univers vivant (simulation persistante)
    portalStore.hydrate(),
    spawnPointStore.hydrate(), // points de spawn éditables par map
    mapBoundsStore.hydrate(), // murs invisibles / limites de map posés en admin
    portalAdminStore.hydrate(),
    arrowMutationStore.hydrate(),
    npcPlacementStore.hydrate(),
    harvestNodeStore.hydrate(),
    environmentStore.hydrate(),
    weaponOffsetStore.hydrate(),
    weaponCalibrationStore.hydrate(),
    characterOffsetStore.hydrate(),
    bodyTintStore.hydrate(),
    animClipStore.hydrate(),
    recoilProfileStore.hydrate(),
    hydrateSettingsFromDb(),
    hydrateScaleFromDb(),
    hydrateOffsetFromDb(),
    // audioManager.hydrateFromDb() RETIRÉ : redondant avec hydrateSettingsFromDb (qui
    // applique déjà music×master via applyAudio) ET en COURSE avec lui (deux clés DB
    // différentes écrivaient musicVolume en parallèle → dernier gagnant aléatoire,
    // pouvait imposer un volume 0 persisté = « musiques chargées mais inaudibles »).
  ];
  // Un hydrate qui échoue ne doit PAS bloquer l'entrée → on tolère les rejets individuels.
  // ET un hydrate qui NE SE RÉSOUT JAMAIS (timeout DB / IPC Electron bloqué) ne doit pas
  // figer l'écran de chargement → on course contre un délai max et on entre avec ce qu'on a.
  const HYDRATE_TIMEOUT_MS = 8000;
  let timedOut = false;
  let timer: ReturnType<typeof setTimeout>;
  const all = Promise.allSettled(jobs).then(() => undefined);
  const timeout = new Promise<void>((resolve) => {
    timer = setTimeout(() => {
      timedOut = true;
      console.warn("[hydrateAll] délai dépassé — entrée avec données partielles");
      resolve();
    }, HYDRATE_TIMEOUT_MS);
  });
  pending = Promise.race([all, timeout]).then(() => {
    partial = timedOut;
    // CRITIQUE : annuler le timer quand l'hydratation GAGNE la course — sinon le warn
    // « délai dépassé » s'affichait 8 s plus tard MÊME quand tout avait réussi (faux positif
    // qui a fait croire à des données partielles pendant toute la phase de debug).
    clearTimeout(timer);
    if (!timedOut) console.info("[hydrateAll] hydratation complète ✓");
  });
  return pending;
}

// true si la DERNIÈRE passe est entrée avec des données partielles (timeout gagné).
let partial = false;

/** Force une nouvelle passe d'hydratation (ex: après des modifs admin → re-préchargement). */
export function invalidateHydration(): void { pending = null; }

/**
 * RE-hydrate si la passe initiale était PARTIELLE (timeout : pendant le chargement de map,
 * le main thread sature → les réponses IPC MySQL n'arrivent pas dans les 8 s et les lectures
 * dbStore expirent en null). À appeler APRÈS la révélation, au calme : les stores ré-essaient
 * leurs lectures DB et appliquent les données manquantes (PNJ placés, portails… poppent alors,
 * l'étagement se ré-arme tout seul). No-op si la passe initiale était complète.
 */
export function rehydrateIfPartial(): Promise<void> {
  if (!partial) return Promise.resolve();
  console.info("[hydrateAll] passe initiale partielle → re-hydratation post-chargement");
  partial = false;
  pending = null;
  return hydrateAllStores();
}
