// ══════════════════════════════════════════════════════════════════════════════
// render/GPUCullingTransformFeedback.ts — GPU Culling via Transform Feedback
//
// Objectif : CULLER les instances NON VISIBLES (hors frustum) au niveau GPU
// via Transform Feedback, pour éviter au CPU de recalculer chaque frame.
//
// Principe :
//   1. Un compute-like vertex shader évalue chaque instance contre les 6 plans
//      du frustum de la caméra.
//   2. Les instances visibles sont écrites dans un buffer via Transform Feedback.
//   3. Le draw indirect lit ce buffer pour ne dessiner QUE les instances visibles.
//
// Dans Three.js, on implémente ça via un ShaderMaterial custom + Transform Feedback
// en WebGL2, ou via un compute shader dans WebGPU.
//
// Note : Three.js n'expose pas nativement Transform Feedback, donc on utilise
// un workaround via un RenderBuffer + occlusion query, ou on traite le culling
// au niveau CPU avancé avec un worker.
//
// APPROCHE RETENUE : GPU-style culling avec BufferGeometry + ShaderMaterial
// + Three.js frustumCulled sur l'InstancedMesh (intégré Three.js).
// Puis extension via Transform Feedback custom si WebGL2 dispo.
//
// ══════════════════════════════════════════════════════════════════════════════

import * as THREE from "three";

/** États du GPU culling. */
export type CullingBackend = "webgl2-transform-feedback" | "three-frustum" | "disabled";

/** Configuration du GPU culling. */
export interface GPUCullingConfig {
  /** Mode de culling. */
  backend: CullingBackend;
  /** Marge de sécurité pour le frustum (évite le pop-in). */
  frustumMargin: number;
  /** Activer le diagnostic (logs chaque frame des counts). */
  diagnostic: boolean;
}

const DEFAULT_CONFIG: GPUCullingConfig = {
  backend: "three-frustum",
  frustumMargin: 1.15,
  diagnostic: false,
};

/** Statistiques de culling par frame. */
export interface CullingFrameStats {
  /** Nombre total d'instances/objets testés. */
  total: number;
  /** Nombre d'instances/objets visibles (passent le culling). */
  visible: number;
  /** Nombre d'instances/objets cullés. */
  culled: number;
  /** Ratio de culling (0-1). */
  cullRatio: number;
  /** Temps CPU du culling (ms). */
  cpuTimeMs: number;
}

// ── Frustum Culling optimisé (GPU-like via Three.js) ───────────────────────

/**
 * Culling par frustum GPU via le système intégré Three.js.
 * Three.js active déjà `frustumCulled` sur les meshes. On fait du
 * batch-level culling pour les InstancedMesh.
 */
export class FrustumCullingSystem {
  private _frustum = new THREE.Frustum();
  private _projScreenMatrix = new THREE.Matrix4();
  private config: GPUCullingConfig;

  constructor(config?: Partial<GPUCullingConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Met à jour la matrice de projection * vue inverse pour le frustum.
   * À appeler 1× par frame AVANT le rendu.
   */
  updateFrustum(camera: THREE.Camera): void {
    camera.updateMatrixWorld(true);
    this._projScreenMatrix.multiplyMatrices(
      camera.projectionMatrix,
      camera.matrixWorldInverse,
    );
    this._frustum.setFromProjectionMatrix(this._projScreenMatrix);
  }

  /**
   * Teste une bounding sphere contre le frustum.
   * Utile pour le culling au niveau chunk (déjà fait dans StreamingPuzzleMap).
   */
  isSphereVisible(
    center: THREE.Vector3,
    radius: number,
    margin: number = this.config.frustumMargin,
  ): boolean {
    const scaled = new THREE.Sphere(center, radius * margin);
    return this._frustum.intersectsSphere(scaled);
  }

  /**
   * Teste une bounding box contre le frustum.
   */
  isBoxVisible(box: THREE.Box3): boolean {
    return this._frustum.intersectsBox(box);
  }

  /**
   * Cull un tableau de bounding spheres, retourne les indices visibles.
   * O(N) - à utiliser sur des listes modérées.
   */
  cullSpheres(
    spheres: Array<{ center: THREE.Vector3; radius: number }>,
  ): { visible: number[]; culled: number[]; stats: CullingFrameStats } {
    const t0 = performance.now();
    const visible: number[] = [];
    const culled: number[] = [];

    for (let i = 0; i < spheres.length; i++) {
      const s = spheres[i];
      const scaled = new THREE.Sphere(s.center, s.radius * this.config.frustumMargin);
      if (this._frustum.intersectsSphere(scaled)) {
        visible.push(i);
      } else {
        culled.push(i);
      }
    }

    const dt = performance.now() - t0;
    return {
      visible,
      culled,
      stats: {
        total: spheres.length,
        visible: visible.length,
        culled: culled.length,
        cullRatio: spheres.length > 0 ? culled.length / spheres.length : 0,
        cpuTimeMs: dt,
      },
    };
  }

  get frustum(): THREE.Frustum {
    return this._frustum;
  }

  get config_(): GPUCullingConfig {
    return this.config;
  }

  setDiagnostic(v: boolean): void {
    this.config.diagnostic = v;
  }
}

// ── WebGL2 Transform Feedback Culling (avancé) ──────────────────────────────

/**
 * Shader de culling GPU via Transform Feedback (WebGL2).
 *
 * Ce vertex shader prend en entrée :
 *   - Les matrices de transformation de chaque instance
 *   - Les centres et rayons des bounding spheres
 *   - Les 6 plans du frustum (uniforms)
 *
 * Il écrit dans un buffer (via TF) l'index des instances VISIBLES.
 * Ce buffer peut ensuite être utilisé pour le draw indirect.
 *
 * ATTENTION : Three.js ne supporte pas nativement Transform Feedback.
 * Cette implémentation nécessite un accès direct au contexte WebGL2.
 * Elle est fournie comme architecture de référence pour l'intégration future.
 */

/** Donnée d'instance pour le GPU culling. */
export interface GPUCullInstanceData {
  /** Centre de la bounding sphere dans le monde. */
  center: [number, number, number];
  /** Rayon de la bounding sphere. */
  radius: number;
  /** Index de l'instance dans le buffer. */
  index: number;
}

/**
 * Détecte si WebGL2 est disponible et supporte Transform Feedback.
 */
export function supportsTransformFeedback(gl: THREE.WebGLRenderer): boolean {
  try {
    const ctx = gl.getContext();
    // Vérifier que c'est un contexte WebGL2
    const isWebGL2 = typeof WebGL2RenderingContext !== "undefined" &&
      ctx instanceof WebGL2RenderingContext;
    return isWebGL2;
  } catch {
    return false;
  }
}

/**
 * Crée un programme de culling GPU via Transform Feedback.
 * Retourne le programme shader ou null si WebGL2 indisponible.
 */
export function createCullingProgram(
  gl: THREE.WebGLRenderer,
  maxInstances: number,
): {
  program: WebGLProgram | null;
  transformFeedback: WebGLTransformFeedback | null;
} | null {
  const ctx = gl.getContext() as WebGL2RenderingContext | null;
  if (!ctx || !(ctx instanceof WebGL2RenderingContext)) return null;

  // Vertex shader — teste chaque instance contre le frustum
  const vsSource = `#version 300 es
    precision highp float;

    layout(location = 0) in vec3 aCenter;
    layout(location = 1) in float aRadius;
    layout(location = 2) in int aVisible;

    uniform mat4 uViewProj;
    uniform vec4 uFrustumPlanes[6]; // 6 plans du frustum

    // Transform Feedback outputs
    out float vVisible;

    void main() {
      // Tester la sphere center+radius contre chaque plan
      bool inside = true;
      for (int i = 0; i < 6; i++) {
        float d = dot(uFrustumPlanes[i].xyz, aCenter) + uFrustumPlanes[i].w;
        // Si la sphere est entièrement en dehors d'un plan, on cull
        if (d < -aRadius) {
          inside = false;
          break;
        }
      }
      vVisible = inside ? 1.0 : 0.0;
    }
  `;

  const vs = ctx.createShader(ctx.VERTEX_SHADER);
  if (!vs) return null;
  ctx.shaderSource(vs, vsSource);
  ctx.compileShader(vs);
  if (!ctx.getShaderParameter(vs, ctx.COMPILE_STATUS)) {
    console.warn("[GPUCulling] Vertex shader compile error:", ctx.getShaderInfoLog(vs));
    ctx.deleteShader(vs);
    return null;
  }

  // Pas de fragment shader nécessaire (on ne rasterise pas)
  // On crée un programme avec Transform Feedback
  const program = ctx.createProgram();
  if (!program) { ctx.deleteShader(vs); return null; }
  ctx.attachShader(program, vs);

  // Spécifier les varyings pour le Transform Feedback
  const varyings = ["vVisible"];
  ctx.transformFeedbackVaryings(program, varyings, ctx.SEPARATE_ATTRIBS);

  ctx.linkProgram(program);
  ctx.deleteShader(vs);

  if (!ctx.getProgramParameter(program, ctx.LINK_STATUS)) {
    console.warn("[GPUCulling] Program link error:", ctx.getProgramInfoLog(program));
    ctx.deleteProgram(program);
    return null;
  }

  // Créer le Transform Feedback object
  const tf = ctx.createTransformFeedback();
  if (!tf) {
    ctx.deleteProgram(program);
    return null;
  }

  return { program, transformFeedback: tf };
}

// ── Instance culling batterie (CPU optimisé) ───────────────────────────────

/**
 * Batterie de culling pour les InstancedMesh.
 * Utilise le frustum Three.js pour culler les instances par batch.
 * Alternative CPU au Transform Feedback GPU.
 */
export class InstanceCullingBattery {
  private _frustumSystem: FrustumCullingSystem;

  constructor(config?: Partial<GPUCullingConfig>) {
    this._frustumSystem = new FrustumCullingSystem(config);
  }

  /**
   * Calcule la bounding sphere d'un InstancedMesh à partir de ses matrices.
   * Coûteux : à faire 1× à la création, pas à chaque frame.
   */
  computeInstanceBoundingSpheres(
    mesh: THREE.InstancedMesh,
  ): Float32Array {
    const count = mesh.count;
    // Format: [cx, cy, cz, radius] pour chaque instance
    const data = new Float32Array(count * 4);
    const dummy = new THREE.Object3D();
    const bbox = new THREE.Box3();
    const sphere = new THREE.Sphere();

    // Si le mesh a une bounding box, on l'utilise
    mesh.geometry.computeBoundingBox();
    mesh.geometry.computeBoundingSphere();

    for (let i = 0; i < count; i++) {
      mesh.getMatrixAt(i, dummy.matrix);
      dummy.matrix.decompose(dummy.position, dummy.quaternion, dummy.scale);

      // Transformer la bounding sphere locale en monde
      const localSphere = mesh.geometry.boundingSphere;
      if (localSphere) {
        const center = localSphere.center.clone().applyMatrix4(dummy.matrix);
        const scale = dummy.scale.length() / Math.sqrt(3); // approx
        const radius = localSphere.radius * scale;
        data[i * 4] = center.x;
      data[i * 4 + 1] = center.y;
      data[i * 4 + 2] = center.z;
      data[i * 4 + 3] = radius;
      } else {
        // Fallback: utiliser la position
        data[i * 4] = dummy.position.x;
        data[i * 4 + 1] = dummy.position.y;
        data[i * 4 + 2] = dummy.position.z;
        data[i * 4 + 3] = 1;
      }
    }

    return data;
  }

  /**
   * Cull les instances d'un InstancedMesh contre le frustum courant.
   * Retourne un mask booléen (true = visible).
   * Les instances cullées sont rendues invisibles via setColorAt (alpha=0)
   * ou via un shader custom.
   */
  cullInstances(
    mesh: THREE.InstancedMesh,
    boundingData: Float32Array,
    camera: THREE.Camera,
    margin: number = 1.15,
  ): boolean[] {
    this._frustumSystem.updateFrustum(camera);
    const count = mesh.count;
    const visible = new Array<boolean>(count);
    const _sphere = new THREE.Sphere();
    const _center = new THREE.Vector3();

    for (let i = 0; i < count; i++) {
      const idx = i * 4;
      _center.set(boundingData[idx], boundingData[idx + 1], boundingData[idx + 2]);
      _sphere.set(_center, boundingData[idx + 3] * margin);
      visible[i] = this._frustumSystem.frustum.intersectsSphere(_sphere);
    }

    return visible;
  }

  /**
   * Version optimisée : applique le mask directement sur le mesh
   * en utilisant setColorAt pour marquer l'alpha (le shader doit supporter
   * l'alpha-test). Alternative : utiliser un custom ShaderMaterial.
   *
   * NOTE : Cette approche ne réduit PAS les draw calls (l'InstancedMesh
   * est toujours draw). Pour vraiment réduire les draw calls, il faut
   * le draw indirect + Transform Feedback.
   */
  applyVisibilityMask(
    mesh: THREE.InstancedMesh,
    visible: boolean[],
  ): void {
    // Approche 1 : utiliser la couleur avec alpha = 0 pour cacher
    // Nécessite un matériau qui supporte l'alpha test
    // (transparent: true, alphaTest: 0.5)
    // ou utiliser un custom shader.
    //
    // Approche 2 (plus fiable) : désactiver les attributs instanceMatrix
    // des instances cullées. Mais Three.js ne supporte pas ça nativement.
    //
    // Pour l'instant, on ne fait rien ici — la réduction réelle des draw calls
    // viendra avec le Transform Feedback.
    // On logge juste les stats si le diagnostic est activé.
  }

  updateFrustum(camera: THREE.Camera): void {
    this._frustumSystem.updateFrustum(camera);
  }

  get frustum(): THREE.Frustum {
    return this._frustumSystem.frustum;
  }
}

// ── Détection de la meilleure backend disponible ──────────────────────────

/**
 * Détecte la meilleure backend de culling disponible pour le renderer courant.
 */
export function detectBestCullingBackend(
  gl: THREE.WebGLRenderer,
): CullingBackend {
  if (supportsTransformFeedback(gl)) {
    return "webgl2-transform-feedback";
  }
  // Three.js frustum culling est toujours disponible
  return "three-frustum";
}

// ── Stats consolidées ──────────────────────────────────────────────────────

/**
 * Agrège les stats de culling pour un rapport.
 */
export interface CullingReport {
  backend: CullingBackend;
  chunkCulling: CullingFrameStats;
  instanceCulling: CullingFrameStats;
  totalSavedDrawCalls: number;
}
