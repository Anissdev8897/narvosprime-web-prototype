// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/ShaderCache.ts — Cache partagé de ShaderMaterial
//
// Évite de re-compiler des shaders identiques entre différentes instances.
// Chaque matériau est indexé par une clé composite (vertex+fragment+nom) et
// le cache garantit qu'une seule instance est compilée par clé.
//
// Usage :
//   const mat = ShaderCache.getOrCreate(key, () => new ShaderMaterial({...}));
//   // Utiliser mat.clone() si des uniforms différents sont nécessaires
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

export interface ShaderCacheKey {
  /** Nom unique identifiant le matériau (ex: "water", "terrain_gradient") */
  name: string;
  /** Vertex shader source (ou hash du source) */
  vertexShader: string;
  /** Fragment shader source (ou hash du source) */
  fragmentShader: string;
}

/**
 * Cache de ShaderMaterial partagé.
 *
 * Principe :
 * - Les ShaderMaterials sont coûteux à compiler (WebGL compile les shaders).
 * - Si deux chunks utilisent le MÊME matériau procédural, on compile une fois
 *   et on clone pour les variations d'uniforms.
 * - Le clone partage le même programme GL (même `program` Three.js).
 *
 * Usage dans un chunk loader :
 *   const mat = ShaderCache.getOrCreate(
 *     { name: "my_terrain", vertexShader: vs, fragmentShader: fs },
 *     () => new THREE.ShaderMaterial({ vertexShader: vs, fragmentShader: fs, uniforms: {...} })
 *   );
 *   // Pour chaque mesh : mesh.material = mat.clone();
 *   // Puis régler les uniforms spécifiques sur le clone.
 */
export class ShaderCache {
  private static _map = new Map<string, THREE.ShaderMaterial>();

  private static _key(k: ShaderCacheKey): string {
    return `${k.name}::${k.vertexShader.length}:${k.fragmentShader.length}`;
  }

  /**
   * Retourne un matériau existant ou en crée un nouveau via `factory`.
   * Le matériau reste la propriété du cache — NE PAS l'appeler `.dispose()`
   * directement. Utiliser `disposeAll()` à la place (ex: au changement de map).
   */
  static getOrCreate(
    key: ShaderCacheKey,
    factory: () => THREE.ShaderMaterial,
  ): THREE.ShaderMaterial {
    const k = this._key(key);
    const existing = this._map.get(k);
    if (existing) return existing;
    const mat = factory();
    mat.name = key.name;
    this._map.set(k, mat);
    return mat;
  }

  /** Nombre de matériaux uniques dans le cache. */
  static get size(): number {
    return this._map.size;
  }

  /** Libère tous les matériaux du cache. */
  static disposeAll(): void {
    for (const mat of this._map.values()) {
      mat.dispose();
    }
    this._map.clear();
  }

  /** Supprime une entrée spécifique et la libère. */
  static remove(key: ShaderCacheKey): void {
    const k = this._key(key);
    const mat = this._map.get(k);
    if (mat) {
      mat.dispose();
      this._map.delete(k);
    }
  }
}

/**
 * Utilitaire : clone un matériau en lui attachant des uniforms spécifiques.
 * Le clone partage le même programme WebGL que l'original.
 */
export function cloneWithUniforms(
  base: THREE.ShaderMaterial,
  overrides: Record<string, THREE.IUniform>,
): THREE.ShaderMaterial {
  const clone = base.clone();
  for (const [k, v] of Object.entries(overrides)) {
    clone.uniforms[k] = v;
  }
  // Volontairement PAS de `clone.needsUpdate = false`. Dans Three.js
  // `needsUpdate` est un setter en écriture seule dont le corps se réduit à
  // `if (value === true) this.version++` : lui affecter `false` ne fait
  // strictement rien, et le relire rend `undefined`. La ligne donnait
  // l'illusion d'éviter une recompilation qu'elle n'évitait pas — c'est le
  // partage du même source de shader qui fait réutiliser le programme WebGL.
  return clone;
}
