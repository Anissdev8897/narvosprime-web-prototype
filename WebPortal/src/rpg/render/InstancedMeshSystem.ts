// ══════════════════════════════════════════════════════════════════════════════
// render/InstancedMeshSystem.ts — optimisation par InstancedMesh
//
// Objectif : Grouper les objets répétés (arbres, rochers, lampadaires, etc.)
// qui partagent la MÊME géométrie et le MÊME matériau en UN SEUL InstancedMesh
// → 1 draw call pour N instances au lieu de N draw calls.
//
// Fonctionnement :
//   1. scanScene() analyse une scène Three.js et détecte les meshes candidats
//      (même geometry + material, position distincte)
//   2. buildInstances() crée les InstancedMesh correspondants
//   3. Le système gère le cycle de vie : dispose, mise à jour, stats
//
// Usage typique :
//   const system = new InstancedMeshSystem();
//   system.scanScene(chunkScene);     // analyse
//   system.buildInstances(chunkScene); // rebuild
//   console.log(system.stats);         // draw calls économisés
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

/** Configuration du regroupement par similarité. */
export interface InstancingConfig {
  /** Seuil de similarité de position pour fusionner deux meshes (0 = même position exacte). */
  positionThreshold: number;
  /** Ignorer les meshes avec moins de N triangles (décor trop petit). */
  minTriangles: number;
  /** Nombre max d'instances par InstancedMesh (au-delà, on crée un second). */
  maxInstancesPerBatch: number;
}

const DEFAULT_CONFIG: InstancingConfig = {
  positionThreshold: 0.001,
  minTriangles: 20,
  maxInstancesPerBatch: 1024,
};

/** Résultat de l'analyse pour un groupe de meshes identiques. */
export interface MeshGroup {
  /** La géométrie partagée. */
  geometry: THREE.BufferGeometry;
  /** Le matériau partagé (ou null si mixte). */
  material: THREE.Material | null;
  /** Toutes les matrices monde de chaque instance. */
  worldMatrices: THREE.Matrix4[];
  /** Nombre de triangles par instance. */
  triangleCount: number;
  /** L'InstancedMesh créé (après build). */
  instanceMesh: THREE.InstancedMesh | null;
}

/** Statistiques du système d'instancing. */
export interface InstancingStats {
  /** Nombre de meshes individuels avant instancing. */
  originalMeshCount: number;
  /** Nombre de meshes après instancing. */
  instancedMeshCount: number;
  /** Draw calls économisés (original - instancié). */
  drawCallsSaved: number;
  /** Nombre d'instances créées au total. */
  totalInstances: number;
  /** Détail par groupe. */
  groups: MeshGroup[];
}

// ── Clé de hachage pour identifier une géométrie + matériau uniques ─────────

function geometryKey(geo: THREE.BufferGeometry): string {
  // On se base sur l'UUID + attributs essentiels pour l'identité GPU
  const attrs = ["position", "normal", "uv", "index"];
  const sigs = attrs.map((a) => {
    const attr = geo.getAttribute(a);
    if (!attr) return `${a}:none`;
    return `${a}:${attr.itemSize}x${attr.count}:${(attr as any).array?.byteLength ?? 0}`;
  });
  return `${geo.uuid}|${sigs.join("|")}`;
}

function materialKey(mat: THREE.Material | null): string {
  if (!mat) return "null";
  // On compare par type, color, map, etc. — PAS par UUID, car chaque nouveau
  // MeshStandardMaterial({ color: 0xff0000 }) a un UUID différent mais EST identique.
  const m = mat as THREE.MeshStandardMaterial;
  const color = m.color?.getHex?.() ?? "none";
  const mapUuid = m.map?.uuid ?? "none";
  const roughness = m.roughness ?? "none";
  const metalness = m.metalness ?? "none";
  return `${mat.type}:c${color}:m${mapUuid}:r${roughness}:me${metalness}`;
}

/** Vérifie si un mesh est candidat à l'instancing. */
function isInstancingCandidate(
  mesh: THREE.Mesh,
  config: InstancingConfig,
): boolean {
  if (!mesh.geometry) return false;
  const geo = mesh.geometry;
  const idx = geo.getIndex();
  const pos = geo.getAttribute("position");
  if (!pos) return false;

  // Compter les triangles
  const triCount = idx ? idx.count / 3 : pos.count / 3;
  if (triCount < config.minTriangles) return false;

  // Vérifier que le matériau est standard (pas de shader custom complexe)
  const mat = mesh.material as THREE.Material;
  if (mat) {
    const type = (mat as any).type;
    // On accepte les matériaux standards
    if (
      type !== "MeshStandardMaterial" &&
      type !== "MeshPhongMaterial" &&
      type !== "MeshLambertMaterial" &&
      type !== "MeshMatcapMaterial" &&
      type !== "MeshBasicMaterial" &&
      type !== "MeshPhysicalMaterial"
    ) {
      return false;
    }
  }

  return true;
}

// ── Classe principale ───────────────────────────────────────────────────────

export class InstancedMeshSystem {
  private config: InstancingConfig;
  private groups: Map<string, MeshGroup> = new Map();
  private _originalMeshCount = 0;
  private _instancedMeshCount = 0;

  constructor(config: Partial<InstancingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /** Analyse une scène Three.js et collecte les groupes candidats. */
  scanScene(root: THREE.Object3D): void {
    this.groups.clear();
    this._originalMeshCount = 0;

    const meshes: THREE.Mesh[] = [];
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        meshes.push(child as THREE.Mesh);
      }
    });

    this._originalMeshCount = meshes.length;

    for (const mesh of meshes) {
      if (!isInstancingCandidate(mesh, this.config)) continue;

      const gKey = geometryKey(mesh.geometry);
      const mKey = materialKey(mesh.material as THREE.Material);
      const groupKey = `${gKey}||${mKey}`;

      let group = this.groups.get(groupKey);
      if (!group) {
        // 🟢 Nouveau groupe : on prend la géométrie et le matériau de référence
        const mat = Array.isArray(mesh.material)
          ? (mesh.material[0] ?? null)
          : (mesh.material as THREE.Material | null);

        group = {
          geometry: mesh.geometry,
          material: mat,
          worldMatrices: [],
          triangleCount: 0,
          instanceMesh: null,
        };

        // Compter les triangles
        const idx = mesh.geometry.getIndex();
        const pos = mesh.geometry.getAttribute("position");
        group.triangleCount = idx
          ? idx.count / 3
          : pos
            ? pos.count / 3
            : 0;

        this.groups.set(groupKey, group);
      }

      // Ajouter la matrice monde
      mesh.updateWorldMatrix(true, false);
      group.worldMatrices.push(mesh.matrixWorld.clone());
    }
  }

  /**
   * Construit les InstancedMesh à partir des groupes collectés.
   * Remplace les meshes originaux dans la scène par les instances.
   * Retourne le nombre de meshes instanciés créés.
   */
  buildInstances(root: THREE.Object3D): number {
    let count = 0;
    const created: THREE.InstancedMesh[] = [];

    // Cache les meshes originaux qu'on va remplacer
    const originalMeshes: THREE.Mesh[] = [];
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        originalMeshes.push(child as THREE.Mesh);
      }
    });

    const groups = [...this.groups.values()] as MeshGroup[];
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];
      if (group.worldMatrices.length < 2) continue; // Pas besoin d'instancing pour 1 seul

      const matrices = group.worldMatrices;
      const maxPerBatch = this.config.maxInstancesPerBatch;

      // Créer le(s) InstancedMesh par batch
      const batches = Math.ceil(matrices.length / maxPerBatch);
      for (let b = 0; b < batches; b++) {
        const start = b * maxPerBatch;
        const end = Math.min(start + maxPerBatch, matrices.length);
        const batchSize = end - start;

        const instancedMesh = new THREE.InstancedMesh(
          group.geometry,
          group.material,
          batchSize,
        );

        instancedMesh.castShadow = true;
        instancedMesh.receiveShadow = true;
        instancedMesh.frustumCulled = true;
        instancedMesh.instanceMatrix.needsUpdate = true;

        for (let i = 0; i < batchSize; i++) {
          instancedMesh.setMatrixAt(i, matrices[start + i]);
        }
        instancedMesh.instanceMatrix.needsUpdate = true;

        // Stocker dans le groupe
        if (b === 0) {
          group.instanceMesh = instancedMesh;
        } else {
          // Pour les batches supplémentaires, on crée un groupe virtuel
          const subGroup: MeshGroup = {
            ...group,
            worldMatrices: matrices.slice(start, end),
            instanceMesh: instancedMesh,
          };
          const subKey = `${b}`;
          // On ne stocke pas dans this.groups, on l'ajoute directement à la scène
          root.add(instancedMesh);
          count++;
          created.push(instancedMesh);
          continue;
        }

        root.add(instancedMesh);
        count++;
        created.push(instancedMesh);
      }
    }

    // 🔴 Cacher les meshes originaux (ne pas les supprimer car d'autres systèmes
    // peuvent y faire référence). On les rend invisibles.
    // `matrixAutoUpdate: false` déjà fait dans le pipeline (StreamingPuzzleMap).
    for (const mesh of originalMeshes) {
      mesh.visible = false;
    }

    this._instancedMeshCount = count;
    return count;
  }

  /**
   * Version simplifiée qui scanne ET construit en un appel.
   * Pratique pour une intégration rapide.
   */
  optimize(root: THREE.Object3D): void {
    this.scanScene(root);
    this.buildInstances(root);
  }

  /** Remet les meshes originaux visibles et supprime les InstancedMesh. */
  restore(root: THREE.Object3D): void {
    // Supprimer les InstancedMesh
    const toRemove: THREE.InstancedMesh[] = [];
    root.traverse((child) => {
      if ((child as THREE.InstancedMesh).isInstancedMesh) {
        toRemove.push(child as THREE.InstancedMesh);
      }
    });
    for (const im of toRemove) {
      root.remove(im);
      im.dispose();
    }

    // Rendre les originaux visibles
    root.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        child.visible = true;
      }
    });

    this._instancedMeshCount = 0;
  }

  /** Libère les ressources GPU. */
  dispose(): void {
    for (const [, group] of this.groups) {
      if (group.instanceMesh) {
        group.instanceMesh.dispose();
      }
    }
    this.groups.clear();
    this._originalMeshCount = 0;
    this._instancedMeshCount = 0;
  }

  /** Retourne les statistiques courantes. */
  get stats(): InstancingStats {
    const groups = [...this.groups.values()] as MeshGroup[];
    const totalInstances = groups.reduce(
      (sum, g) => sum + g.worldMatrices.length,
      0,
    );
    return {
      originalMeshCount: this._originalMeshCount,
      instancedMeshCount: this._instancedMeshCount,
      drawCallsSaved: this._originalMeshCount - this._instancedMeshCount,
      totalInstances,
      groups,
    };
  }

  /** Nombre de groupes d'instancing détectés. */
  get groupCount(): number {
    return this.groups.size;
  }
}

// ── Hook d'intégration pour les chunks ─────────────────────────────────────

/**
 * Analyse un chunk chargé et crée les InstancedMesh appropriés.
 * Retourne les stats ou null si rien à instancier.
 */
export function optimizeChunkScene(
  scene: THREE.Object3D,
  config?: Partial<InstancingConfig>,
): InstancingStats | null {
  const system = new InstancedMeshSystem(config);
  system.scanScene(scene);
  system.buildInstances(scene);
  const stats = system.stats;
  if (stats.instancedMeshCount <= 0) return null;
  return stats;
}
