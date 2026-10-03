/**
 * Prototype/_shared/bootstrap.ts — Préambule commun à TOUS les prototypes.
 *
 * Reprend ce que `src/main.tsx` installe avant de monter React. Chaque
 * prototype le recopiait : au troisième, la copie aurait divergé et un seul
 * aurait eu le correctif KTX2 (cf. docs/ARCHITECTURE_PROTOTYPES.md §3).
 *
 * À appeler UNE fois, en tête du `main.tsx` du prototype, avant `createRoot`.
 */
import { useGLTF } from "@react-three/drei";
import { Cache as ThreeCache } from "three";

import { installKtx2Everywhere } from "../../src/rpg/loaders/installKtx2Everywhere";

let installe = false;

export function bootstrapPrototype(): void {
  // Idempotent : deux appels (import croisé, HMR) ne doivent pas réinstaller
  // le filtre de console, sinon les wrappers s'empilent à chaque rechargement.
  if (installe) return;
  installe = true;

  // Cache d'octets three.js — évite le re-téléchargement des GLB déjà chargés.
  ThreeCache.enabled = true;

  // Draco : décodeurs servis depuis public/draco/ (pas le CDN Google).
  useGLTF.setDecoderPath("/draco/");

  // KTX2 global — sans lui, les textures compressées échouent et le maillage
  // rend en BLANC, sans aucune erreur. C'est le piège le plus cher du projet.
  installKtx2Everywhere();

  // Silence du warning THREE "No target node found for track" : spam inoffensif
  // émis à chaque clip retargeté, qui noie les vrais messages du prototype.
  const warnOrigine = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const m = args[0];
    if (typeof m === "string" && m.startsWith("THREE.PropertyBinding: No target node found")) return;
    warnOrigine(...args);
  };
}
