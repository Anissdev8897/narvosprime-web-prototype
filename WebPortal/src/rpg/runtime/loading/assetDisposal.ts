// runtime/loading/assetDisposal.ts — libération GPU explicite des assets PER-MAP.
//
// PROBLÈME : `useGLTF.clear(url)` vide seulement le cache JS de drei — il ne libère PAS
// les ressources GPU (geometry/material/texture) de la scène SOURCE. Three.js ne dispose
// jamais le GPU au GC → à chaque changement de map, les scènes sources des PNJ placés
// (chargées via useGLTF, partagées par les clones SkeletonUtils) restent en VRAM sans
// owner = fuite cumulative → "WebGLRenderer: Context Lost" après quelques voyages.
//
// SOLUTION : un registre url→scene alimenté au chargement (Npc.tsx). À l'éviction, on
// dispose réellement la scène source AVANT `useGLTF.clear`. Sûr car l'éviction n'évince
// QUE les URLs absentes de la nouvelle map (les clones de l'ancienne map sont démontés).
import * as THREE from "three";

const registry = new Map<string, THREE.Object3D>();

/** Enregistre la scène source d'un asset (idempotent : même url → même scène partagée). */
export function registerDisposable(url: string, scene: THREE.Object3D): void {
  registry.set(url, scene);
}

function disposeMaterial(mat: THREE.Material): void {
  for (const key of Object.keys(mat)) {
    const val = (mat as unknown as Record<string, unknown>)[key];
    if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose();
  }
  mat.dispose();
}

/** Libère réellement le GPU de la scène source enregistrée pour `url` (no-op si absente). */
export function disposeAsset(url: string): void {
  const scene = registry.get(url);
  if (!scene) return;
  registry.delete(url);
  scene.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) {
      (mesh.geometry as THREE.BufferGeometry & { disposeBoundsTree?: () => void }).disposeBoundsTree?.();
      mesh.geometry.dispose();
    }
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (m) (Array.isArray(m) ? m : [m]).forEach(disposeMaterial);
  });
}
