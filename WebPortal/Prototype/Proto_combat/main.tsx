/**
 * Proto_combat/main.tsx — Point d'entrée standalone du prototype de combat.
 *
 * Monte CombatPrototypeSandbox dans un root React dédié, SANS App.tsx ni le
 * routeur du jeu. Zéro dépendance au runtime RPG (pas de map, pas de HUD).
 *
 * Accessible via http://localhost:3005/Prototype/Proto_combat/
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { useGLTF } from "@react-three/drei";
import { Cache as ThreeCache } from "three";

import { CombatPrototypeSandbox } from "./CombatPrototypeSandbox";
import { installKtx2Everywhere } from "../../src/rpg/loaders/installKtx2Everywhere";

// ── Repris de main.tsx (indispensables) ──────────────────────────────────────

// Cache d'octets three.js — évite le re-téléchargement des GLB déjà chargés.
ThreeCache.enabled = true;

// Draco : décodeurs servis depuis public/draco/ (pas de CDN Google).
useGLTF.setDecoderPath("/draco/");

// KTX2 global — sinon les textures compressées échouent (maillage blanc).
installKtx2Everywhere();

// Silence du warning THREE "No target node found for track" (spam inoffensif).
{
  const _warn = console.warn.bind(console);
  console.warn = (...args: unknown[]) => {
    const m = args[0];
    if (
      typeof m === "string" &&
      m.startsWith("THREE.PropertyBinding: No target node found")
    )
      return;
    _warn(...args);
  };
}

// ── Montage ───────────────────────────────────────────────────────────────────
ReactDOM.createRoot(document.getElementById("root")!).render(
  <CombatPrototypeSandbox />,
);
