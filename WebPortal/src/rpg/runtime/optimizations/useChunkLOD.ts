// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/useChunkLOD.ts — React hook: LOD progressif pour chunks
//
// Intègre le système ChunkLOD dans le pipeline StreamingPuzzleMap.
// Ce hook :
//   1. Charge les variantes LOD (.lod_med.glb, .lod_low.glb) pour chaque chunk
//   2. Crée un THREE.LOD (ou groupe ChunkLOD) avec cross-fade
//   3. Met à jour la visibilité et le niveau LOD chaque frame via useFrame
//
// Usage dans StreamingPuzzleMap.tsx :
//   const { applyLOD, updateLOD, disposeLOD } = useChunkLOD(chunkDir, gl);
//   ...
//   // Après chargement d'un chunk :
//   const lodObj = await applyLOD(chunkId, chunkScene, worldPos);
//   // Dans useFrame :
//   updateLOD(cameraPos);
//   // Au déchargement :
//   disposeLOD(chunkId);
//
// ══════════════════════════════════════════════════════════════════════════════

import { useRef, useCallback, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";

import {
  createChunkLOD,
  createChunkLODSimple,
  updateChunkLODWithFade,
  clearCrossFade,
  lodVariantPath,
  createBillboardSprite,
  extractDominantColor,
  estimateBillboardSize,
} from "./ChunkLOD";

import { qualityVariant } from "../../loaders/assetQuality";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

interface LODEntry {
  lodGroup: THREE.Object3D;
  worldPos: THREE.Vector3;
  chunkId: number;
  active: boolean;
}

// Cache des loaders GLTF pour le chargement des variantes LOD
let lodLoader: GLTFLoader | null = null;

/**
 * Charge une variante LOD depuis le disque/cache.
 */
async function loadLODVariant(
  basePath: string,
  level: "med" | "low",
  gl: THREE.WebGLRenderer,
): Promise<THREE.Group | null> {
  try {
    const lodPath = lodVariantPath(basePath, level === "med" ? "med" : "low");
    const resolved = qualityVariant(lodPath);

    // HEAD check rapide — si la variante n'existe pas, on skip
    try {
      const head = await fetch(resolved, { method: "HEAD" });
      if (!head.ok) return null;
    } catch {
      return null;
    }

    if (!lodLoader) {
      lodLoader = new GLTFLoader();
      // Même config que StreamingPuzzleMap
      const { configureGLTFLoader } = await import("../../loaders/sharedLoaders");
      configureGLTFLoader(lodLoader);
    }

    const { scene } = await new Promise<{ scene: THREE.Group }>(
      (resolve, reject) => {
        lodLoader!.load(resolved, (gltf) => resolve(gltf), undefined, reject);
      },
    );

    // Upload GPU des textures de la variante
    const textures: THREE.Texture[] = [];
    scene.traverse((child) => {
      const m = child as THREE.Mesh;
      if (!m.isMesh) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      for (const mat of mats) {
        if (!mat) continue;
        for (const key of Object.keys(mat)) {
          const val = (mat as unknown as Record<string, unknown>)[key];
          if (val && (val as THREE.Texture).isTexture) textures.push(val as THREE.Texture);
        }
      }
    });

    for (const tex of textures) {
      try {
        gl.initTexture(tex);
      } catch {
        // texture corrompue → ignorer
      }
    }

    return scene;
  } catch {
    // Variante indisponible → fallback silencieux sur HIGH
    return null;
  }
}

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useChunkLOD(
  chunkDir: string,
  enableBillboard: boolean = true,
) {
  const { gl, camera } = useThree();
  const lodEntries = useRef<Map<number, LODEntry>>(new Map());
  const cameraPos = useRef(new THREE.Vector3());
  const dtRef = useRef(0);
  const prevTimeRef = useRef(performance.now());

  /**
   * Applique le LOD à un chunk nouvellement chargé.
   * Retourne l'objet 3D avec LOD à ajouter à la scène.
   */
  const applyLOD = useCallback(
    async (
      chunkId: number,
      fullScene: THREE.Object3D,
      worldPos: THREE.Vector3,
    ): Promise<THREE.Object3D> => {
      // Construire le chemin de base (sans suffixe qualité)
      const baseName = `${chunkDir}/chunk_${String(chunkId + 1).padStart(2, "0")}.glb`;

      // Charger les variantes LOD
      const [medScene, lowScene] = await Promise.all([
        loadLODVariant(baseName, "med", gl),
        loadLODVariant(baseName, "low", gl),
      ]);

      // Créer un billboard si demandé
      let billboard: THREE.Sprite | null = null;
      if (enableBillboard && lowScene === null) {
        // Extraire la couleur dominante pour le billboard
        const color = extractDominantColor(fullScene);
        const size = estimateBillboardSize(fullScene);
        billboard = createBillboardSprite(color, size);
      }

      // Créer le groupe LOD (avec cross-fade)
      const lodGroup = createChunkLOD(
        {
          high: fullScene,
          medium: medScene,
          low: lowScene,
          billboard,
        },
        worldPos,
      );

      // Ajouter le niveau LOW du groupe à la scène
      // (le groupe lui-même sera rendu par le moteur Three.js)
      lodEntries.current.set(chunkId, {
        lodGroup,
        worldPos: worldPos.clone(),
        chunkId,
        active: true,
      });

      return lodGroup;
    },
    [chunkDir, gl, enableBillboard],
  );

  /**
   * Version simple (sans cross-fade, utilisant THREE.LOD natif).
   */
  const applyLODSimple = useCallback(
    async (
      chunkId: number,
      fullScene: THREE.Object3D,
    ): Promise<THREE.LOD> => {
      const baseName = `${chunkDir}/chunk_${String(chunkId + 1).padStart(2, "0")}.glb`;
      const [medScene, lowScene] = await Promise.all([
        loadLODVariant(baseName, "med", gl),
        loadLODVariant(baseName, "low", gl),
      ]);

      const lod = createChunkLODSimple(fullScene, medScene, lowScene);
      lodEntries.current.set(chunkId, {
        lodGroup: lod,
        worldPos: new THREE.Vector3(),
        chunkId,
        active: true,
      });

      return lod;
    },
    [chunkDir, gl],
  );

  /**
   * Met à jour tous les LOD entries chaque frame.
   */
  const updateAllLODs = useCallback(() => {
    const now = performance.now();
    dtRef.current = (now - prevTimeRef.current) / 1000;
    prevTimeRef.current = now;

    const pos = camera.position;
    cameraPos.current.copy(pos);

    for (const [, entry] of lodEntries.current) {
      if (!entry.active) continue;

      // Si c'est un groupe ChunkLOD, on utilise le cross-fade
      if (entry.lodGroup.type === "Group" || entry.lodGroup.type === "Scene") {
        // On ne peut pas passer directement à updateChunkLODWithFade
        // car il attend un THREE.LOD. On gère la visibilité manuellement.
        const dist = pos.distanceTo(entry.worldPos);
        const { LOD_MEDIUM, LOD_FAR, LOD_CULL } = require("./ChunkLOD");

        // Déterminer quel niveau est visible
        let targetVisible = 0; // 0=HIGH, 1=MED, 2=LOW, 3=CULL
        if (dist <= LOD_MEDIUM) targetVisible = 0;
        else if (dist <= LOD_FAR) targetVisible = 1;
        else if (dist <= LOD_CULL) targetVisible = 2;
        else targetVisible = 3;

        // Afficher seulement le niveau cible
        const names = ["LOD_HIGH", "LOD_MED", "LOD_LOW", "LOD_CULL"];
        for (let i = 0; i < 4; i++) {
          const child = entry.lodGroup.children.find(
            (c) => c.name === names[i],
          );
          if (child) {
            child.visible = i === targetVisible;
          }
        }
      }

      // Si c'est un THREE.LOD natif, on utilise updateChunkLOD
      if (entry.lodGroup instanceof THREE.LOD) {
        const lodCamera = new THREE.Camera();
        lodCamera.position.copy(cameraPos.current);
        entry.lodGroup.update(lodCamera);
      }
    }
  }, [camera.position]);

  /**
   * Dispose un chunk LOD.
   */
  const disposeLOD = useCallback((chunkId: number) => {
    const entry = lodEntries.current.get(chunkId);
    if (entry) {
      entry.active = false;

      // Nettoyer les matériaux et géométries
      entry.lodGroup.traverse((child) => {
        const mesh = child as THREE.Mesh;
        if (!mesh.isMesh) return;
        if (mesh.geometry) mesh.geometry.dispose();
        const mats = Array.isArray(mesh.material)
          ? mesh.material
          : [mesh.material];
        for (const mat of mats) {
          if (!mat) continue;
          for (const key of Object.keys(mat)) {
            const val = (mat as unknown as Record<string, unknown>)[key];
            if (val && (val as THREE.Texture).isTexture) {
              (val as THREE.Texture).dispose();
            }
          }
          mat.dispose();
        }
      });

      clearCrossFade(chunkId);
      lodEntries.current.delete(chunkId);
    }
  }, []);

  /**
   * Nettoie toutes les entrées LOD.
   */
  const disposeAll = useCallback(() => {
    const ids = Array.from(lodEntries.current.keys());
    for (const id of ids) disposeLOD(id);
    lodEntries.current.clear();
  }, [disposeLOD]);

  // Cleanup automatique au démontage
  useEffect(() => {
    return () => {
      disposeAll();
    };
  }, [disposeAll]);

  return {
    applyLOD,
    applyLODSimple,
    updateAllLODs,
    disposeLOD,
    disposeAll,
    lodEntries,
  };
}
