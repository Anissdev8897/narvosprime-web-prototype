// ══════════════════════════════════════════════════════════════════════════════
// runtime/sceneUtils.ts — Utilitaires de post-traitement de scène Three.js
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

/**
 * Applique le filtrage anisotropique maximum sur toutes les textures PBR
 * d'un Object3D et de ses descendants.
 *
 * Pourquoi : Three.js initialise `texture.anisotropy = 1` par défaut (pas de
 * filtrage anisotropique). Résultat : les textures vues sous un angle rasant
 * (sols, murs, dalles) s'étirent et deviennent floues à distance.
 * Avec `anisotropy = maxAniso` (typiquement 8 ou 16 selon le GPU) les textures
 * restent nettes jusqu'au fond de la vue.
 *
 * Coût : négligeable sur GPU dédié (<1 % de performance), très faible sur GPU
 * intégré. À appeler UNE FOIS lors du chargement du modèle (useMemo / useEffect).
 *
 * @param obj      Racine de la hiérarchie à parcourir (scène GLB clonée).
 * @param maxAniso Valeur retournée par `renderer.capabilities.getMaxAnisotropy()`.
 */
export function applyAnisotropy(obj: THREE.Object3D, maxAniso: number): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    for (const mat of mats) {
      const std = mat as THREE.MeshStandardMaterial;
      // Couvre toutes les maps PBR standard : albédo, normal, roughness/metalness,
      // AO et émission.  Les maps absentes (null) sont ignorées.
      for (const tex of [
        std.map, std.normalMap, std.roughnessMap,
        std.metalnessMap, std.aoMap, std.emissiveMap,
      ]) {
        if (tex) {
          tex.anisotropy = maxAniso;
          tex.needsUpdate = true; // force le re-upload vers le GPU
        }
      }
    }
  });
}
