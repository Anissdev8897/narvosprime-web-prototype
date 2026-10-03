// ══════════════════════════════════════════════════════════════════════════════
// render/OcclusionCulling.ts — Occlusion Culling simplifié
//
// Objectif : Éviter de rendre les objets cachés DERRIÈRE d'autres objets
// (ex: un rocher derrière une montagne, une maison derrière une colline).
//
// Approche retenue : Raycast-based simplified occlusion culling.
// On projette des rayons depuis la caméra vers les bounding boxes des objets
// pour détecter les obstructions.
//
// Limitations :
//   - Solution CPU, pas GPU (pour du vrai occlusion culling GPU, il faudrait
//     des HPipes/Z-prepass/occlusion queries)
//   - Approximatif : ne teste que quelques points par objet
//   - Configurable : on peut régler la densité des tests
//
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

/** Configuration de l'occlusion culling. */
export interface OcclusionCullingConfig {
  /** Activer/désactiver le système. */
  enabled: boolean;
  /** Distance max pour tester l'occlusion (au-delà, on cull systématiquement). */
  maxDistance: number;
  /** Distance min (en-deçà, on ne cull jamais — objets trop proches). */
  minDistance: number;
  /** Nombre de rayons par objet (1-8). Plus = précis mais coûteux. */
  raysPerObject: number;
  /** Résolution angulaire des rayons (degrés). Plus petit = plus précis. */
  raySpreadDeg: number;
  /** Seuil de confiance : ratio de rayons bloqués pour déclarer "occludé". */
  occlusionThreshold: number;
  /** Activer le diagnostic. */
  diagnostic: boolean;
}

const DEFAULT_CONFIG: OcclusionCullingConfig = {
  enabled: true,
  maxDistance: 500,
  minDistance: 5,
  raysPerObject: 3,
  raySpreadDeg: 2.0,
  occlusionThreshold: 0.67, // 67% des rayons bloqués = occludé
  diagnostic: false,
};

/** Résultat du test d'occlusion pour un objet. */
export interface OcclusionResult {
  /** ID ou index de l'objet. */
  id: number;
  /** L'objet est-il visible (passe l'occlusion test) ? */
  visible: boolean;
  /** Ratio de rayons bloqués (0 = aucun, 1 = tous). */
  occlusionRatio: number;
  /** Distance à la caméra. */
  distance: number;
}

/** Stats du système d'occlusion. */
export interface OcclusionStats {
  total: number;
  visible: number;
  occluded: number;
  cpuTimeMs: number;
}

// ── Cache de géométrie pour le raycasting ─────────────────────────────────

/**
 * Un occluder est un objet susceptible d'en cacher d'autres.
 * On utilise ses faces (triangles) pour les tests de raycast.
 */
export interface Occluder {
  mesh: THREE.Mesh;
  boundingSphere: THREE.Sphere;
}

/**
 * Système d'occlusion culling basé sur le raycasting.
 *
 * Principe :
 *   1. On collecte les "occludeurs" (gros meshes : terrain, bâtiments, etc.)
 *   2. Pour chaque objet testé, on lance N rayons depuis la caméra vers
 *      sa bounding box, avec un léger spread
 *   3. Si suffisamment de rayons sont bloqués, l'objet est considéré comme
 *      occludé → on le cache
 */
export class OcclusionCullingSystem {
  private config: OcclusionCullingConfig;
  private _raycaster: THREE.Raycaster;
  private _occluders: Occluder[] = [];
  private _direction = new THREE.Vector3();
  private _origin = new THREE.Vector3();
  private _target = new THREE.Vector3();
  private _stats: OcclusionStats = { total: 0, visible: 0, occluded: 0, cpuTimeMs: 0 };

  constructor(config?: Partial<OcclusionCullingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this._raycaster = new THREE.Raycaster();
    this._raycaster.far = this.config.maxDistance;
  }

  /**
   * Enregistre un occluder (gros mesh qui peut en cacher d'autres).
   * Les occludeurs doivent être enregistrés AVANT les tests.
   */
  registerOccluder(mesh: THREE.Mesh): void {
    mesh.updateWorldMatrix(true, false);
    const bbox = new THREE.Box3().setFromObject(mesh);
    const sphere = new THREE.Sphere();
    bbox.getBoundingSphere(sphere);
    this._occluders.push({ mesh, boundingSphere: sphere });
  }

  /**
   * Enregistre plusieurs occludeurs depuis une scène.
   * Seuls les grands meshes (area > threshold) sont retenus.
   */
  registerOccludersFromScene(
    root: THREE.Object3D,
    minArea: number = 100,
  ): number {
    let count = 0;
    root.traverse((child) => {
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh || !mesh.geometry) return;

      // Vérifier la taille approximative
      const bbox = new THREE.Box3().setFromObject(mesh);
      const size = new THREE.Vector3();
      bbox.getSize(size);
      const area = size.x * size.y + size.y * size.z + size.z * size.x;

      if (area >= minArea) {
        this.registerOccluder(mesh);
        count++;
      }
    });
    return count;
  }

  /** Vide la liste des occludeurs. */
  clearOccluders(): void {
    this._occluders = [];
  }

  /**
   * Teste si un point est visible depuis la caméra (non occludé).
   * Lance plusieurs rayons avec un léger spread pour robustesse.
   */
  private testPointVisibility(
    worldPoint: THREE.Vector3,
    cameraPosition: THREE.Vector3,
  ): { visible: boolean; blockedRays: number; totalRays: number } {
    const dir = new THREE.Vector3().copy(worldPoint).sub(cameraPosition);
    const distance = dir.length();
    dir.normalize();

    // Trop loin ou trop proche → shortcut
    if (distance > this.config.maxDistance) return { visible: false, blockedRays: 1, totalRays: 1 };
    if (distance < this.config.minDistance) return { visible: true, blockedRays: 0, totalRays: 1 };

    const rays = this.config.raysPerObject;
    const spreadRad = THREE.MathUtils.degToRad(this.config.raySpreadDeg);
    let blocked = 0;

    // Rayon central
    this._raycaster.set(cameraPosition, dir);
    const hits = this._raycaster.intersectObjects(
      this._occluders.map((o) => o.mesh),
      false,
    );

    // Vérifier si le premier hit est AVANT la cible
    if (hits.length > 0 && hits[0].distance < distance - 0.5) {
      blocked++;
    }

    // Rayons avec spread (génère des directions légèrement déviées)
    for (let i = 1; i < rays; i++) {
      const angle = (i / rays) * Math.PI * 2;
      const deviation = new THREE.Vector3(
        Math.cos(angle) * spreadRad,
        Math.sin(angle) * spreadRad * 0.5,
        0,
      );
      const deviatedDir = new THREE.Vector3().copy(dir).add(deviation).normalize();
      this._raycaster.set(cameraPosition, deviatedDir);
      const devHits = this._raycaster.intersectObjects(
        this._occluders.map((o) => o.mesh),
        false,
      );
      if (devHits.length > 0 && devHits[0].distance < distance - 0.5) {
        blocked++;
      }
    }

    return {
      visible: blocked / rays < this.config.occlusionThreshold,
      blockedRays: blocked,
      totalRays: rays,
    };
  }

  /**
   * Teste l'occlusion pour une liste d'objets définis par leur bounding sphere.
   * Retourne un tableau de résultats (même ordre que l'entrée).
   */
  testOcclusionBatch(
    objects: Array<{
      id: number;
      boundingSphere: THREE.Sphere;
    }>,
    camera: THREE.Camera,
  ): { results: OcclusionResult[]; stats: OcclusionStats } {
    const t0 = performance.now();
    if (!this.config.enabled || this._occluders.length === 0) {
      // Pas d'occludeurs → tout est visible
      const dt = performance.now() - t0;
      const results = objects.map((o) => {
        const dist = o.boundingSphere.center.distanceTo(camera.position);
        const isTooFar = dist > this.config.maxDistance;
        return {
          id: o.id,
          visible: !isTooFar,
          occlusionRatio: isTooFar ? 1 : 0,
          distance: dist,
        };
      });
      const visibleCount = results.filter((r) => r.visible).length;
      this._stats = {
        total: objects.length,
        visible: visibleCount,
        occluded: objects.length - visibleCount,
        cpuTimeMs: performance.now() - t0,
      };
      return { results, stats: this._stats };
    }

    const cameraPos = camera.position;
    const results: OcclusionResult[] = [];
    let visibleCount = 0;
    let occludedCount = 0;

    for (const obj of objects) {
      const dist = obj.boundingSphere.center.distanceTo(cameraPos);

      // Trop proche → pas de test
      if (dist < this.config.minDistance) {
        results.push({ id: obj.id, visible: true, occlusionRatio: 0, distance: dist });
        visibleCount++;
        continue;
      }

      // Trop loin → cullé
      if (dist > this.config.maxDistance) {
        results.push({ id: obj.id, visible: false, occlusionRatio: 1, distance: dist });
        occludedCount++;
        continue;
      }

      // Tester un point au centre + extensions
      const centerPoint = obj.boundingSphere.center;
      const testResult = this.testPointVisibility(centerPoint, cameraPos);

      if (testResult.visible) {
        results.push({ id: obj.id, visible: true, occlusionRatio: testResult.blockedRays / testResult.totalRays, distance: dist });
        visibleCount++;
      } else {
        results.push({ id: obj.id, visible: false, occlusionRatio: testResult.blockedRays / testResult.totalRays, distance: dist });
        occludedCount++;
      }
    }

    const dt = performance.now() - t0;
    this._stats = {
      total: objects.length,
      visible: visibleCount,
      occluded: occludedCount,
      cpuTimeMs: dt,
    };

    return { results, stats: this._stats };
  }

  /**
   * Teste l'occlusion pour un tableau de bounding spheres (format natif Three.js).
   * Version plus légère sans IDs, retourne un mask booléen.
   */
  testSpheres(
    spheres: THREE.Sphere[],
    camera: THREE.Camera,
  ): boolean[] {
    const objects = spheres.map((s, i) => ({
      id: i,
      boundingSphere: s,
    }));
    const { results } = this.testOcclusionBatch(objects, camera);
    return results.map((r) => r.visible);
  }

  /** Met à jour la configuration. */
  setConfig(config: Partial<OcclusionCullingConfig>): void {
    this.config = { ...this.config, ...config };
    this._raycaster.far = this.config.maxDistance;
  }

  /** Active/désactive le diagnostic. */
  setDiagnostic(v: boolean): void {
    this.config.diagnostic = v;
  }

  /** Retourne les stats du dernier test. */
  get lastStats(): OcclusionStats {
    return this._stats;
  }

  /** Nombre d'occludeurs enregistrés. */
  get occluderCount(): number {
    return this._occluders.length;
  }

  /** Libère les ressources. */
  dispose(): void {
    this._occluders = [];
  }
}

// ── Intégration simplifiée ─────────────────────────────────────────────────

/**
 * Analyse une scène et applique l'occlusion culling à ses meshes.
 * Version "one-shot" pratique pour le diagnostic.
 */
export function applyOcclusionCulling(
  root: THREE.Object3D,
  camera: THREE.Camera,
  config?: Partial<OcclusionCullingConfig>,
): OcclusionStats {
  const system = new OcclusionCullingSystem(config);

  // Enregistrer les gros meshes comme occludeurs
  const occluderCount = system.registerOccludersFromScene(root, 50);

  if (occluderCount === 0) {
    return { total: 0, visible: 0, occluded: 0, cpuTimeMs: 0 };
  }

  // Collecter tous les meshes à tester
  const meshes: THREE.Mesh[] = [];
  root.traverse((child) => {
    if ((child as THREE.Mesh).isMesh) {
      meshes.push(child as THREE.Mesh);
    }
  });

  // Créer les bounding spheres
  const spheres: THREE.Sphere[] = [];
  for (const mesh of meshes) {
    const bbox = new THREE.Box3().setFromObject(mesh);
    const sphere = new THREE.Sphere();
    bbox.getBoundingSphere(sphere);
    spheres.push(sphere);
  }

  // Tester l'occlusion
  const visible = system.testSpheres(spheres, camera);

  // Appliquer la visibilité
  let occluded = 0;
  for (let i = 0; i < meshes.length; i++) {
    if (!visible[i]) {
      // Ne pas masquer les occludeurs eux-mêmes
      const isOccluder = system.occluderCount > 0 &&
        i < meshes.length;
      if (!isOccluder) {
        meshes[i].visible = false;
        occluded++;
      }
    }
  }

  return {
    total: meshes.length,
    visible: meshes.length - occluded,
    occluded,
    cpuTimeMs: system.lastStats.cpuTimeMs,
  };
}
