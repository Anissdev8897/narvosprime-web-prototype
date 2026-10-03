/**
 * Benchmarks pour le système DataLayers (LRU, éviction, budget VRAM).
 *
 * Mesure les performances AVANT (avant dataLayers) et APRÈS (avec dataLayers)
 * pour quantifier l'impact du nouveau système.
 *
 * Scénarios :
 *   1. LRU eviction : N chunks loaded, éviction des moins prioritaires
 *   2. Budget check : vérification canLoad avec N chunks résidents
 *   3. Layer transitions : N chunks qui passent PreWarm→Activated→Unloaded
 */
import { describe, bench } from "vitest";
import {
  setBudget,
  setLayer,
  canLoad,
  evictToBudget,
  determineLayer,
  clearLayers,
  getTotalVRAM,
} from "./dataLayers";

const MB = 1;

describe("DataLayers benchmarks", () => {
  // ── AVANT : simulation du comportement actuel (sans dataLayers) ──────
  // Le système actuel charge/décharge sans LRU, sans prewarming, sans
  // budget VRAM strict. On simule ça via des opérations basiques.

  bench("AVANT — charger 16 chunks sans budget ni LRU", () => {
    // Simule le comportement actuel : setLoadedChunks direct
    for (let i = 0; i < 16; i++) {
      setLayer(i, "activated", 200 * MB);
    }
    // Pas de vérification de budget
    // Pas d'éviction
    clearLayers();
  });

  bench("APRÈS — charger 16 chunks avec budget VRAM et LRU", () => {
    setBudget(3600);
    for (let i = 0; i < 16; i++) {
      if (!canLoad(200 * MB)) {
        // Budget exceeded : évincer avant de charger
        evictToBudget(200 * MB);
      }
      setLayer(i, "activated", 200 * MB);
    }
    // Vérifier budget après chargement
    while (!canLoad(0) && getTotalVRAM() > 0) {
      const { toUnload } = evictToBudget(0);
      if (toUnload.length === 0) break;
    }
    clearLayers();
  });

  // ── LRU Eviction ────────────────────────────────────────────────────

  bench("AVANT — déchargement séquentiel (pas de LRU)", () => {
    // Comportement actuel : on décharge sans ordre particulier
    for (let i = 0; i < 32; i++) {
      setLayer(i, "activated", 200 * MB);
    }
    for (let i = 0; i < 16; i++) {
      setLayer(i, "unloaded"); // décharge les premiers (pas LRU)
    }
    clearLayers();
  });

  bench("APRÈS — éviction LRU des plus vieux PreWarm", () => {
    setBudget(1200);
    // Charger un mix de chunks
    for (let i = 0; i < 10; i++) {
      setLayer(i, "activated", 200 * MB);
    }
    for (let i = 10; i < 16; i++) {
      setLayer(i, "prewarming", 200 * MB);
    }
    // Total: 3200 > 1200 → éviction LRU
    const { toUnload, toDeactivate } = evictToBudget(0);
    // Les chunks évincés ne sont pas dans le total
    clearLayers();
  });

  // ── determineLayer (prewarming check) ────────────────────────────────

  bench("AVANT — pas de prewarming, distance binaire dans/ hors rayon", () => {
    // Le système actuel : dans le rayon → load, hors rayon → unload
    const inRadius = (dist: number, radius: number) => dist <= radius;
    let count = 0;
    for (let i = 0; i < 100; i++) {
      if (inRadius(i * 50, 2000)) count++;
    }
  });

  bench("APRÈS — determineLayer à 3 niveaux", () => {
    let activated = 0, prewarming = 0, unloaded = 0;
    for (let i = 0; i < 100; i++) {
      const layer = determineLayer(i * 50, 2000, 2800);
      if (layer === "activated") activated++;
      else if (layer === "prewarming") prewarming++;
      else unloaded++;
    }
  });

  // ── Budget VRAM check par frame ─────────────────────────────────────

  bench("AVANT — pas de budget VRAM (jamais vérifié)", () => {
    // Système actuel : budgetMB existe en paramètre mais pas de check
    for (let i = 0; i < 50; i++) {
      // Chargement sans vérification
      setLayer(i, "activated", 200 * MB);
    }
    clearLayers();
  });

  bench("APRÈS — budget VRAM + éviction par frame", () => {
    setBudget(3600);
    for (let frame = 0; frame < 100; frame++) {
      // Simuler 100 frames de streaming
      for (let i = 0; i < 50; i++) {
        if (canLoad(200 * MB)) {
          setLayer(i, "activated", 200 * MB);
        }
      }
      // Éviction LRU par frame
      const { toUnload } = evictToBudget(0);
      for (const id of toUnload) {
        setLayer(id, "unloaded");
      }
    }
    clearLayers();
  });

  // ── promote PreWarm → Activated (à chaque frame) ────────────────────

  bench("APRÈS — promotion PreWarm→Activated (16 chunks simulés)", () => {
    setBudget(3600);
    // Préparer un set de chunks PreWarm
    for (let i = 0; i < 16; i++) {
      setLayer(i, "prewarming", 200 * MB);
    }
    // Simuler la promotion de tous vers Activated (comme si le joueur s'approche)
    for (let i = 0; i < 16; i++) {
      setLayer(i, "activated", 200 * MB);
    }
    clearLayers();
  });

  // ─── Stress : 1000 chunks (cas extrême) ─────────────────────────────
  bench("APRÈS — stress : 1000 chunks, 200 MB chacun, budget 3600 MB", () => {
    setBudget(3600);
    for (let i = 0; i < 1000; i++) {
      // cannot load most → vérification rapide
      const ok = canLoad(200 * MB);
      // Charge seulement si budget OK
      if (ok) {
        setLayer(i, "activated", 200 * MB);
      } else {
        // Tente d'évincer
        const { toUnload } = evictToBudget(200 * MB);
        for (const id of toUnload) setLayer(id, "unloaded");
        const retry = canLoad(200 * MB);
        if (retry) setLayer(i, "activated", 200 * MB);
      }
    }
    clearLayers();
  });
});
