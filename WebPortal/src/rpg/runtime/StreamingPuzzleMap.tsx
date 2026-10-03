import { memo, useEffect, useRef, useState, useCallback } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { collisionWorld } from "./CollisionWorld";
import { isEnvelopingShell } from "./envelopingShell";
import { applyAnisotropy } from "./sceneUtils";
import { qualityVariant, degradeVariant, assetExists } from "../loaders/assetQuality";
import { loadTerrainSelection } from "../materials/terrainMaterialStore";
import { applyAutoMaterial, loadAutoMaterialTextures, isAutoMaterialDisabled, refreshAutoMaterial, rebuildAutoMaterial, autoMaterialGeneration, disposeStaleAutoMaterials, isLandscapeFallback, isAutoMaterialName } from "../materials/autoMaterialStore";
import { configureGLTFLoader, registerRenderer, ktx2SupportSummary } from "../loaders/sharedLoaders";
import { playerPositionStore } from "../wasm/playerPositionStore";
import {
  initStreaming,
  registerStreamingChunk,
  markChunkLoaded,
  markChunkUnloaded,
  tickStreaming,
  drainStreamingCommands,
  clearStreaming,
  getStreamingFingerprint,
  updateChunkRadius,
  StreamCommandType,
} from "../wasm/ChunkStreamingBridge";
import type { StreamingCommand, ChunkMetadata } from "../wasm/ChunkStreamingBridge";
import { isEngineLoaded, loadNarvosEngine } from "../wasm/WasmBridge";
import { streamingDiagnostics } from "./streamingDiagnostics";
import { eventBus } from "./core/EventBus";
import { getCachedChunk, storeCachedChunk, validateCacheFingerprint } from "./loading/chunkCache";
import { ChunkWorkerPool } from "../threading/ChunkWorkerPool";


const CHUNK_TIMEOUT_MS = 60_000;

// Pré-alloués hors composant → zéro allocation par frame pour le frustum culling
const _frustum = new THREE.Frustum();
const _projScreenMatrix = new THREE.Matrix4();
const CULL_MARGIN = 1.15; // marge 15 % pour éviter le pop-in au bord du FOV

function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, reject) => {
      t = setTimeout(() => reject(new Error(`${label} timeout`)), ms);
    }),
  ]);
}

function disposeMaterial(mat: THREE.Material): void {
  for (const key of Object.keys(mat)) {
    const val = (mat as unknown as Record<string, unknown>)[key];
    if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose();
  }
  mat.dispose();
}

/** Collecte toutes les textures uniques des matériaux d'un sous-arbre. */
function collectTextures(root: THREE.Object3D): THREE.Texture[] {
  const seen = new Set<THREE.Texture>();
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const mat of mats) {
      if (!mat) continue;
      for (const key of Object.keys(mat)) {
        const val = (mat as unknown as Record<string, unknown>)[key];
        if (val && (val as THREE.Texture).isTexture) seen.add(val as THREE.Texture);
      }
    }
  });
  return Array.from(seen);
}

const MAX_TEX_DIM = 2048;

/** Réduit une texture trop large via un canvas offscreen (CPU → GPU safe). */
/**
 * Octets par pixel réellement occupés sur le GPU.
 *
 * Une texture KTX2 transcodée reste COMPRESSÉE en VRAM — c'est tout l'intérêt.
 * Compter 4 octets/pixel pour tout le monde surestime les chunks de la forge
 * d'un facteur 4 (mesuré : 2503 Mo annoncés pour ~570 Mo réels), ce qui fait
 * évincer des chunks encore utiles et troue la map.
 *
 * Les formats à blocs encodent des tuiles 4×4 : 8 octets/bloc = 0,5 o/px
 * (BC1, ETC1/2 RGB), 16 octets/bloc = 1 o/px (BC3, BC7, ASTC 4×4, ETC2 RGBA).
 */
function bytesPerPixel(tex: THREE.Texture): number {
  if (!(tex as THREE.CompressedTexture).isCompressedTexture) return 4;
  switch (tex.format as number) {
    case THREE.RGB_S3TC_DXT1_Format:
    case THREE.RGBA_S3TC_DXT1_Format:
    case THREE.RGB_ETC1_Format:
    case THREE.RGB_ETC2_Format:
      return 0.5;
    default:
      // BC3/BC7, ASTC 4×4, ETC2 RGBA, et tout format à blocs 16 octets.
      return 1;
  }
}

function downsampleTexture(tex: THREE.Texture): void {
  // Une texture compressée n'a pas d'`image` dessinable : `drawImage` jetterait,
  // l'exception serait avalée par le catch de l'appelant et `gl.initTexture()`
  // ne serait jamais atteint — le préchauffage GPU sauterait en silence.
  // Elle est déjà à la bonne taille de toute façon (fixée à l'encodage KTX2).
  if ((tex as THREE.CompressedTexture).isCompressedTexture) return;
  const img = tex.image as HTMLImageElement | ImageBitmap | HTMLCanvasElement | undefined;
  if (!img) return;
  const w = (img as { width?: number }).width ?? 0;
  const h = (img as { height?: number }).height ?? 0;
  if (w <= MAX_TEX_DIM && h <= MAX_TEX_DIM) return;

  const scale = MAX_TEX_DIM / Math.max(w, h);
  const nw = Math.round(w * scale);
  const nh = Math.round(h * scale);
  const canvas = typeof OffscreenCanvas !== "undefined"
    ? new OffscreenCanvas(nw, nh)
    : document.createElement("canvas");
  if ("width" in canvas) { canvas.width = nw; canvas.height = nh; }
  const ctx = (canvas as HTMLCanvasElement).getContext("2d") as CanvasRenderingContext2D | null;
  if (!ctx) return;
  ctx.drawImage(img as CanvasImageSource, 0, 0, nw, nh);
  tex.image = canvas;
  tex.needsUpdate = true;
}

/**
 * Force l'upload GPU de toutes les textures d'un chunk, par lots de 2 par
 * frame. Textures > 2048px sont réduites AVANT upload pour éviter l'OOM GPU.
 * Bail immédiat si le contexte WebGL est perdu.
 */
async function uploadChunkTextures(
  gl: THREE.WebGLRenderer,
  root: THREE.Object3D,
  cancelledRef: { current: boolean },
): Promise<{ count: number; vramMB: number; uncompressed: number }> {
  const textures = collectTextures(root);
  let vramBytes = 0;
  const BATCH = 16;
  for (let i = 0; i < textures.length; i += BATCH) {
    if (cancelledRef.current) break;
    if (gl.getContext().isContextLost()) {
      // Contexte perdu → on skip le reste de l'upload GPU. Les textures déjà uploadées
      // survivent, Three.js les re-crée sur `webglcontextrestored` (ContextLossGuard).
      // Le chunk sera complet dès que le GPU revient.
      break;
    }
    for (let j = i; j < Math.min(i + BATCH, textures.length); j++) {
      const tex = textures[j];
      try {
        downsampleTexture(tex);
        gl.initTexture(tex);
        const img = tex.image as { width?: number; height?: number } | undefined;
        // ×1.33 = chaîne de mipmaps complète (1 + 1/4 + 1/16 + …).
        if (img?.width && img?.height) {
          vramBytes += img.width * img.height * bytesPerPixel(tex) * 1.33;
        }
      } catch {
        /* texture corrompue ou contexte perdu → le matériau garde sa couleur de base */
      }
    }
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
  }
  return {
    count: textures.length,
    vramMB: Math.round(vramBytes / (1024 * 1024)),
    // Combien de textures sont RESTÉES non compressées après transcodage. Une
    // valeur non nulle signifie que KTX2Loader n'avait aucun format compressé
    // disponible et a produit du RGBA32 : ×8 en VRAM, sans aucun signe d'erreur.
    // Sans ce compteur, le seul symptôme est un chiffre de VRAM anormal noyé
    // parmi les autres chunks.
    uncompressed: textures.reduce(
      (n, t) => n + ((t as THREE.CompressedTexture).isCompressedTexture ? 0 : 1),
      0,
    ),
  };
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) {
      (mesh.geometry as THREE.BufferGeometry & { disposeBoundsTree?: () => void }).disposeBoundsTree?.();
      mesh.geometry.dispose();
    }
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (m) (Array.isArray(m) ? m : [m]).forEach(disposeMaterial);
  });
}

interface ChunkMetaEntry {
  id: number;
  file: string;
  center: [number, number, number];
  radius: number;
  estimatedMB: number;
}

interface StreamingPuzzleMapProps {
  chunkDir: string;
  budgetMB?: number;
  maxLoaded?: number;
  loadRadius?: number;
  unloadRadius?: number;
  /** Décalage monde appliqué aux chunks (ex: map UE5 exportée à Y=200). */
  offset?: [number, number, number];
  onChunkProgress?: (loaded: number, total: number) => void;
  /**
   * Appelé quand TOUTE la géométrie et toutes les textures des chunks ont été
   * libérées, après démontage. La libération est étalée sur plusieurs frames
   * (2 chunks par frame) pour ne pas figer l'image : un remontage immédiat
   * ferait donc cohabiter l'ancienne map et la nouvelle en mémoire. C'est
   * précisément ce doublement qui produisait « RangeError: Array buffer
   * allocation failed ». Attendre ce signal avant de remonter l'évite.
   */
  onDisposed?: () => void;
  onComplete?: () => void;
}

export const StreamingPuzzleMap = memo(function StreamingPuzzleMap({
  chunkDir,
  // BUDGET VRAM — recalculé sur mesure, l'ancienne valeur de 600 Mo était fausse.
  //
  // Mesuré : un chunk de forge porte 566 textures. En KTX2 transcodé BC1 à 1024²,
  // chacune coûte 1024² × 0,5 o × 1,33 (mipmaps) ≈ 700 Ko, soit ~396 Mo par chunk
  // et ~3,2 Go pour les 8.
  //
  // À 600 Mo le gestionnaire ne pouvait donc pas garder deux chunks résidents : il
  // évinçait en boucle, ce qui produisait des TROUS dans la map là où le joueur
  // regardait, et un va-et-vient de décodage qui finissait en perte de contexte
  // WebGL. Le budget doit couvrir la map entière, sinon le streaming se bat
  // contre lui-même.
  budgetMB = 3600,
  maxLoaded = 32,
  loadRadius = 2000,
  unloadRadius = 3000,
  offset,
  onChunkProgress,
  onDisposed,
  onComplete,
}: StreamingPuzzleMapProps) {
  const { gl, scene, camera } = useThree();
  const [loadedChunks, setLoadedChunks] = useState<Map<number, THREE.Object3D>>(
    () => new Map(),
  );

  const onProgressRef = useRef(onChunkProgress);
  onProgressRef.current = onChunkProgress;
  // Ref et non dépendance d'effet : le callback ne doit pas relancer le
  // chargement des chunks s'il change d'identité entre deux rendus.
  const onDisposedRef = useRef(onDisposed);
  onDisposedRef.current = onDisposed;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  const metaRef = useRef<ChunkMetaEntry[]>([]);
  const loadedMapRef = useRef<Map<number, THREE.Object3D>>(new Map());
  const loadingSetRef = useRef<Set<number>>(new Set());
  const cancelledRef = useRef(false);
  const initializedRef = useRef(false);
  const wasmActiveRef = useRef(false);
  const completeFiredRef = useRef(false);
  // Chunks "essentiels" = ceux dont la sphère touche le rayon de chargement au
  // spawn. Le reveal (onComplete) attend que TOUS soient chargés + textures GPU.
  const essentialSetRef = useRef<Set<number>>(new Set());
  const chunkSpheresRef = useRef<Map<number, THREE.Sphere>>(new Map());

  const loaderRef = useRef<GLTFLoader | null>(null);
  const maxAnisoRef = useRef(0);
  // File d'attente de chargement : MAX_CONCURRENT chunks en parallèle.
  // Chaque pipeline interleave via rAF (pas de context lost grâce au yield).
  const loadQueueRef = useRef<number[]>([]);
  // Horodatage du dernier chunk ABOUTI — sert à distinguer « lent » de « bloqué ».
  const lastProgressAtRef = useRef<number>(0);
  /** Dernier état connu de la bascule d'auto-material (détection de changement). */
  const lastAmOffRef = useRef(false);
  /** Dernière génération de config d'auto-material vue par la boucle de rendu. */
  const lastAmGenRef = useRef(autoMaterialGeneration());

  /** Pool de Web Workers pour déporter le fetch réseau hors du thread principal. */
  const poolRef = useRef<ChunkWorkerPool | null>(null);

  const MAX_CONCURRENT = 2;
  const processLoadQueue = useCallback(() => {
    while (
      loadQueueRef.current.length > 0 &&
      loadingSetRef.current.size < MAX_CONCURRENT &&
      !cancelledRef.current &&
      !completeFiredRef.current
    ) {
      const nextId = loadQueueRef.current.shift()!;
      loadingSetRef.current.add(nextId);
      void doLoadChunk(nextId).then(() => processLoadQueue());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadChunk = useCallback(
    (chunkId: number) => {
      if (
        cancelledRef.current ||
        loadedMapRef.current.has(chunkId) ||
        loadingSetRef.current.has(chunkId) ||
        loadQueueRef.current.includes(chunkId)
      )
        return;
      loadQueueRef.current.push(chunkId);
      void processLoadQueue();
    },
    [processLoadQueue],
  );

  const doLoadChunk = useCallback(
    async (chunkId: number) => {
      if (
        cancelledRef.current ||
        loadedMapRef.current.has(chunkId)
      ) {
        loadingSetRef.current.delete(chunkId);
        return;
      }

      const meta = metaRef.current[chunkId];
      if (!meta) {
        // SANS ce delete, le slot reste occupé à vie : processLoadQueue pré-ajoute
        // à loadingSet, et la concurrence est plafonnée à MAX_CONCURRENT (2).
        // Deux ids sans métadonnée = plus aucun chunk ne se charge, jamais.
        loadingSetRef.current.delete(chunkId);
        return;
      }

      try {
        // ── Attendre la restauration du contexte WebGL ──────────────────
        // Si le GPU est perdu (preload trop agressif, onglet inactif…),
        // inutile de lancer loadAsync — il timeout après 10 s × 2 tentatives
        // = 20 s perdues par chunk. On attend plutôt que le navigateur
        // restaure le contexte (ContextLossGuard appelle preventDefault).
        const ctx = gl.getContext();
        if (ctx.isContextLost()) {
          streamingDiagnostics.setStatus(chunkId, "pending");
          while (ctx.isContextLost() && !cancelledRef.current) {
            await new Promise<void>((r) => setTimeout(r, 500));
          }
          if (cancelledRef.current) {
            loadingSetRef.current.delete(chunkId);
            return;
          }
        }
        const loader = loaderRef.current!;
        const t0 = performance.now();
        streamingDiagnostics.setStatus(chunkId, "loading");

        // ── Chargement avec cache IndexedDB ──────────────────────────────
        // 1er passage : fetch réseau → stocke dans IDB.
        // Passages suivants : lecture IDB → zéro réseau (comme le DDC Unreal).
        const loadAt = async (p: string): Promise<{ scene: THREE.Group }> => {
          const cached = await getCachedChunk(p);
          if (cached) {
            return new Promise<{ scene: THREE.Group }>((resolve, reject) => {
              loader.parse(cached, "", (result) => resolve(result), reject);
            });
          }
          // ── Fetch réseau déporté sur Web Worker ───────────────────
          const pool = poolRef.current!;
          const result = await pool.loadChunk(p);
          if (result.error) throw new Error(result.error);
          const buf = result.buffer!;
          storeCachedChunk(p, buf);
          return new Promise<{ scene: THREE.Group }>((resolve, reject) => {
            loader.parse(buf, "", (result) => resolve(result), reject);
          });
        };

        // ── REPLI AUTOMATIQUE SUR SATURATION MÉMOIRE ────────────────────
        // L'ancienne version retentait le MÊME fichier. Or « RangeError: Array
        // buffer allocation failed » ne vient pas d'un aléa réseau : le tampon
        // ne rentre pas, et il ne rentrera pas davantage au second essai.
        // Observé en jeu : chunks 0 et 1 en échec définitif, 6/8 résidents, map
        // trouée pour toute la session parce que le joueur avait choisi « high ».
        //
        // On descend donc d'un cran de variante à chaque saturation. Un cran
        // divise la surface des textures par 4. Le joueur perd un peu de
        // netteté sur ce chunk-là ; il ne perd plus un morceau de map.
        let path = qualityVariant(`${chunkDir}/${meta.file}`);
        let gltf: { scene: THREE.Group } | undefined;
        let lastErr: unknown;
        for (let attempt = 0; attempt < 4 && !gltf; attempt++) {
          try {
            gltf = await loadAt(path);
          } catch (err) {
            lastErr = err;
            if (cancelledRef.current) return;
            const msg = String((err as Error)?.message ?? err);
            const isOom = err instanceof RangeError || /allocation failed|out of memory/i.test(msg);
            if (isOom) {
              const lower = degradeVariant(path);
              if (lower && (await assetExists(lower)).status === "found") {
                console.warn(
                  `[StreamingPuzzleMap] chunk ${chunkId} : mémoire saturée sur ` +
                  `${path.split("/").pop()} → repli sur ${lower.split("/").pop()}`,
                );
                path = lower;
                // Laisse le GC reprendre le tampon avorté avant de réessayer.
                await new Promise<void>((r) => setTimeout(r, 250));
                continue;
              }
              // Déjà au plus bas : inutile d'insister, on remonte l'erreur.
              throw err;
            }
            // Erreur non liée à la mémoire (réseau, parse) → un seul nouvel essai.
            if (attempt >= 1) throw err;
            await new Promise<void>((r) => requestAnimationFrame(() => r()));
          }
        }
        if (!gltf) throw lastErr ?? new Error(`chunk ${chunkId} : échec de chargement`);

        THREE.Cache.remove(path);
        if (cancelledRef.current) return;

        const chunkScene = gltf.scene;

        if (offset) {
          chunkScene.position.set(
            chunkScene.position.x + offset[0],
            chunkScene.position.y + offset[1],
            chunkScene.position.z + offset[2],
          );
          chunkScene.updateMatrixWorld(true);
        }

        // AUTO-MATERIAL PAYSAGE — remplace les bakes par un carrelage monde.
        // DOIT s'exécuter AVANT la fusion de traversals qui fixe les matériaux.
        const repainted = applyAutoMaterial(chunkScene);
        if (repainted > 0 && import.meta.env?.DEV) {
          console.info(`[AutoMaterial] chunk ${chunkId} — ${repainted} meshes repeints`);
        }

        // ── TRAVERSAL FUSIONNÉ ──────────────────────────────────────────────
        // Avant : 4 traversals séparés (material fixup, applyAnisotropy,
        // enveloping shell, frustum culling setup) = 400-800 nœuds visités
        // par chunk. Fusionnés en UNE passe = 100-200 nœuds, économie de
        // 300-600 appels de callback par chunk, sur le thread principal.
        //
        // COQUES ENVELOPPANTES écartées de la COLLISION — mesuré sur la map
        // orbitale : un mesh de 4702×2463×5724 unités pour 1719 triangles,
        // c'est-à-dire une boîte de ciel. Enregistrée comme collider, elle
        // produisait « un mur invisible qui bloque et fait remonter le joueur ».
        const maxAniso = maxAnisoRef.current;
        const collisionMeshes: THREE.Mesh[] = [];
        let coques = 0;
        chunkScene.traverse((o) => {
          const m = o as THREE.Mesh;

          // ── Figer les matrices + frustum culling per-chunk ──────────
          o.matrixAutoUpdate = false;

          if (!m.isMesh) return;

          m.frustumCulled = false;
          m.receiveShadow = true;

          const mats = Array.isArray(m.material) ? m.material : [m.material];
          let matsChanged = false;
          for (let i = 0; i < mats.length; i++) {
            const mat = mats[i] as THREE.MeshStandardMaterial;
            if (!mat) continue;

            // ── Anisotropie PBR ─────────────────────────────────────
            for (const tex of [mat.map, mat.normalMap, mat.roughnessMap,
              mat.metalnessMap, mat.aoMap, mat.emissiveMap]) {
              if (tex) { tex.anisotropy = maxAniso; tex.needsUpdate = true; }
            }

            // ── TERRAIN EN DOUBLE FACE ──────────────────────────────
            if (isAutoMaterialName(mat.name)) {
              mat.side = THREE.DoubleSide;
            }

            // ── WorldGridMaterial → MeshStandardMaterial ────────────
            if (mat.name?.includes("WorldGridMaterial") &&
                !isLandscapeFallback(m.name, mat.name)) {
              mats[i] = new THREE.MeshStandardMaterial({
                color: 0x606060, roughness: 0.85, metalness: 0.0,
                side: THREE.DoubleSide,
              });
              matsChanged = true;
              mat.dispose();
            }
          }
          if (matsChanged) {
            if (Array.isArray(m.material)) m.material = mats;
            else m.material = mats[0];
          }

          // ── Coques enveloppantes → rendues, pas de collision ─────
          if (isEnvelopingShell(m)) { coques++; return; }
          collisionMeshes.push(m);
        });
        if (coques > 0 && import.meta.env?.DEV) {
          console.info(`[StreamingPuzzleMap] chunk ${chunkId} — ${coques} coque(s) exclue(s) de la collision`);
        }
        // ── FIN TRAVERSAL FUSIONNÉ ────────────────────────────────────────────
        // BVH_BATCH = 2 : chaque `collisionWorld.add` construit un BVH
        // (`computeBoundsTree`), opération synchrone sur le thread principal.
        // À 5–50 ms par mesh complexe, 8 par batch produisait des freezes de
        // 40–400 ms. Deux par batch = 10–100 ms max, lissé sur plus de frames.
        const BVH_BATCH = 2;
        for (let bi = 0; bi < collisionMeshes.length; bi += BVH_BATCH) {
          if (cancelledRef.current) break;
          const end = Math.min(bi + BVH_BATCH, collisionMeshes.length);
          for (let mi = bi; mi < end; mi++) {
            collisionWorld.add(collisionMeshes[mi]);
          }
          if (end < collisionMeshes.length) {
            await new Promise<void>((r) => requestAnimationFrame(() => r()));
          }
        }

        if (typeof gl.compileAsync === "function") {
          try {
            await withTimeout(
              gl.compileAsync(chunkScene, cameraRef.current, sceneRef.current),
              CHUNK_TIMEOUT_MS,
              `compile ${chunkId}`,
            );
          } catch {
            /* compile best-effort */
          }
        }

        // ── Upload GPU des textures AVANT de déclarer le chunk chargé ──────
        // compileAsync compile les shaders mais l'upload texture reste lazy
        // (premier draw) → pop-in blanc / freeze au reveal. On force ici,
        // par lots de 2 par frame, avec downscale > 2048px.
        const texStats = await uploadChunkTextures(gl, chunkScene, cancelledRef);

        if (cancelledRef.current) {
          disposeObject3D(chunkScene);
          return;
        }

        // ── Figer les matrices monde (déjà appliqué par chunk dans le
        // traversal fusionné, mais `updateMatrixWorld` doit être appelé
        // une fois pour propager après `matrixAutoUpdate = false`).
        chunkScene.updateMatrixWorld(true);

        // Sphère englobante pour le frustum culling — calculée sur la GÉOMÉTRIE
        // RÉELLE, pas sur les métadonnées.
        //
        // `chunk-metadata.json` dérive son rayon des POSITIONS des nodes, sans
        // tenir compte de l'étendue de leur géométrie : un node posé en P dont
        // le mesh court sur 500 unités ne contribue que P. La sphère est donc
        // systématiquement trop petite et de la géométrie dépasse — le chunk
        // sort du frustum alors qu'il est encore à l'écran, `visible` passe à
        // false, et une BANDE NOIRE apparaît quand la caméra tourne.
        //
        // Invisible tant que le découpage était équilibré par sommets : tous
        // les rayons valaient alors 1400-2200 et couvraient la carte entière.
        // Le passage au bucketing SPATIAL les a ramenés à 213-1676 et a révélé
        // le défaut.
        //
        // Box3.setFromObject traverse la géométrie (~90-190 meshes ici) et rend
        // la boîte monde exacte. Coût payé UNE fois par chargement de chunk.
        // MÊME exclusion pour la sphère de culling. Sur l'orbitale, la coque
        // portait les rayons jusqu'à 30 837 unités pour des chunks dont les
        // centres tiennent dans quelques milliers : le culling ne cullait plus
        // rien, et chaque chunk restait rendu en permanence.
        const bbox = new THREE.Box3();
        chunkScene.traverse((o) => {
          const m = o as THREE.Mesh;
          if (!m.isMesh || isEnvelopingShell(m)) return;
          bbox.expandByObject(m);
        });
        const sphere = new THREE.Sphere();
        if (bbox.isEmpty()) {
          // Chunk sans géométrie visible : on retombe sur les métadonnées plutôt
          // que de fabriquer une sphère vide qui le masquerait définitivement.
          const ox2 = offset?.[0] ?? 0;
          const oy2 = offset?.[1] ?? 0;
          const oz2 = offset?.[2] ?? 0;
          sphere.set(
            new THREE.Vector3(meta.center[0] + ox2, meta.center[1] + oy2, meta.center[2] + oz2),
            meta.radius * CULL_MARGIN,
          );
        } else {
          bbox.getBoundingSphere(sphere);
          sphere.radius *= CULL_MARGIN;
        }
        chunkSpheresRef.current.set(chunkId, sphere);

        // PROPAGER LE VRAI RAYON AU WASM — le chunk-metadata.json contient des
        // rayons calculés sur les positions des nodes SEULES (sans l'étendue
        // des meshes), et inclut les coques enveloppantes. Résultat : des
        // rayons jusqu'à 30 837 unités pour l'orbitale, rendant tout
        // déchargement impossible (dist = distance_joueur - radius ≤ 0 en
        // permanence → le WASM ne décharge jamais rien). On corrige ici avec
        // la vraie sphère (coques exclues).
        if (wasmActiveRef.current && sphere) {
          updateChunkRadius(chunkId, sphere.radius);
        }

        if (import.meta.env?.DEV) {
          const metaR = meta.radius * CULL_MARGIN;
          if (sphere.radius > metaR * 1.25) {
            console.info(
              `[StreamingPuzzleMap] chunk ${chunkId} — rayon de culling corrigé ` +
              `${metaR.toFixed(0)} → ${sphere.radius.toFixed(0)} ` +
              `(les métadonnées le sous-estimaient de ${((sphere.radius / metaR - 1) * 100).toFixed(0)} %)`,
            );
          }
        }

        loadedMapRef.current.set(chunkId, chunkScene);
        // La soupape mesure un BLOCAGE, pas une durée totale : chaque chunk
        // abouti repousse l'échéance (cf. stallTimer plus bas).
        lastProgressAtRef.current = performance.now();
        loadingSetRef.current.delete(chunkId);
        markChunkLoaded(chunkId);
        streamingDiagnostics.setStatus(chunkId, "loaded", {
          loadMs: Math.round(performance.now() - t0),
          textures: texStats.count,
          textureVramMB: texStats.vramMB,
          error: null,
        });

        // TRACE DE CHARGEMENT — le pendant de celle du déchargement.
        // Sans les deux, un chunk jamais demandé, un chunk en échec et un chunk
        // évincé produisent le même trou à l'écran. Le compteur de colliders
        // permet en plus de voir immédiatement si un `clear()` concurrent a
        // effacé ce qui venait d'être enregistré.
        if (process.env.NODE_ENV !== "production") {
          console.info(
            `[StreamingPuzzleMap] chunk ${chunkId} CHARGÉ en ` +
            `${Math.round(performance.now() - t0)}ms · ${texStats.count} textures · ` +
            `${texStats.vramMB.toFixed(0)} MB VRAM · ${loadedMapRef.current.size}/` +
            `${metaRef.current.length} résidents · ${collisionWorld.colliderCount} colliders` +
            (texStats.uncompressed
              ? ` · ⚠ ${texStats.uncompressed} textures NON COMPRESSÉES (KTX2 → RGBA32,` +
                ` formats dispo : ${ktx2SupportSummary()})`
              : ""),
          );
        }

        if (completeFiredRef.current) {
          setLoadedChunks(new Map(loadedMapRef.current));
        }
        onProgressRef.current?.(
          loadedMapRef.current.size,
          metaRef.current.length,
        );

        maybeFireComplete();
      } catch (err) {
        loadingSetRef.current.delete(chunkId);
        // Prévenir le C++ : il croit le chunk chargé dès l'émission de la
        // commande Load — sans MarkUnloaded il ne retentera JAMAIS.
        markChunkUnloaded(chunkId);
        streamingDiagnostics.setStatus(chunkId, "failed", {
          error: err instanceof Error ? err.message : String(err),
        });
        console.warn(`[StreamingPuzzleMap] chunk ${chunkId} failed:`, err);
        // Retirer des essentiels : un chunk échoué ne doit pas bloquer le reveal.
        // Il sera retenté plus tard par le streaming WASM (ou rechargé au prochain
        // déplacement dans sa zone de charge).
        essentialSetRef.current.delete(chunkId);
        maybeFireComplete();
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [chunkDir, gl],
  );

  /** Reveal quand tous les chunks ESSENTIELS sont chargés (mode WASM),
   *  ou quand tout est chargé (fallback). */
  const maybeFireComplete = useCallback(() => {
    if (completeFiredRef.current) return;
    if (wasmActiveRef.current) {
      for (const id of essentialSetRef.current) {
        if (!loadedMapRef.current.has(id)) return;
      }
      completeFiredRef.current = true;
      loadQueueRef.current.length = 0;
      setLoadedChunks(new Map(loadedMapRef.current));
      onCompleteRef.current?.();
    } else {
      const allDone =
        loadingSetRef.current.size === 0 &&
        loadedMapRef.current.size >= metaRef.current.length;
      if (allDone) {
        completeFiredRef.current = true;
        loadQueueRef.current.length = 0;
        setLoadedChunks(new Map(loadedMapRef.current));
        onCompleteRef.current?.();
      }
    }
  }, []);

  const unloadChunk = useCallback((chunkId: number) => {
    const obj = loadedMapRef.current.get(chunkId);
    if (!obj) return;

    // TRACE DE DÉCHARGEMENT — elle manquait, et c'est ce qui rendait le problème
    // indiagnosticable : un chunk évincé par le budget VRAM et un chunk jamais
    // chargé produisent le MÊME symptôme à l'écran (un trou), mais appellent des
    // correctifs opposés. Le log distingue enfin les deux.
    if (process.env.NODE_ENV !== "production") {
      console.info(
        `[StreamingPuzzleMap] DÉCHARGE chunk ${chunkId} — ` +
        `${loadedMapRef.current.size - 1} restants. Si ça arrive alors que le ` +
        `joueur le regarde, le budget VRAM est trop bas pour la map.`,
      );
    }

    loadedMapRef.current.delete(chunkId);
    chunkSpheresRef.current.delete(chunkId);
    markChunkUnloaded(chunkId);

    // RETRAIT DES COLLIDERS — il manquait, et c'est ce qui rendait les murs
    // traversables.
    //
    // Le chargement fait `collisionWorld.add(mesh)` par mesh, mais le
    // déchargement appelait seulement `disposeObject3D`. Les entrées restaient
    // donc dans le tableau de colliders avec une géométrie LIBÉRÉE : le BVH
    // détruit ne renvoie plus aucune intersection, et le raycast conclut « rien
    // devant » — le joueur traverse. Aucune erreur n'est levée, la collision
    // disparaît simplement en silence.
    //
    // Le retrait doit précéder le dispose : sinon on parcourt un arbre en train
    // d'être démantelé.
    obj.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) collisionWorld.remove(m);
    });

    disposeObject3D(obj);
    streamingDiagnostics.setStatus(chunkId, "unloaded", { textures: 0, textureVramMB: 0 });

    setLoadedChunks(new Map(loadedMapRef.current));
  }, []);

  useEffect(() => {
    cancelledRef.current = false;
    initializedRef.current = false;
    wasmActiveRef.current = false;
    completeFiredRef.current = false;
    loadedMapRef.current = new Map();
    loadingSetRef.current = new Set();

    const loader = new GLTFLoader();
    registerRenderer(gl);
    // Lancé en parallèle du streaming, jamais attendu : si les textures
    // arrivent après les premiers chunks, ceux-ci gardent leurs bakes et seuls
    // les suivants sont repeints. Dégradation progressive plutôt que blocage.
    // La sélection de couches AVANT le chargement des textures : elle fixe la
    // config active, donc l'apparence du tout premier chunk peint. L'inverse
    // ferait apparaître le préréglage par défaut le temps d'une frame.
    loadTerrainSelection();
    void loadAutoMaterialTextures();
    configureGLTFLoader(loader);

    // Force TextureLoader au lieu d'ImageBitmapLoader pour le parsing des chunks.
    // Chaque chunk contient ~774 textures WebP ; GLTFParser lance un createImageBitmap
    // par texture, TOUS en parallèle → ~3 GB de bitmaps décodés simultanément →
    // Chromium refuse les décodages en excès → "Couldn't load texture blob:…".
    // En masquant createImageBitmap pendant l'appel synchrone à parse(), le parser
    // choisit TextureLoader (decode via <img>) → le navigateur gère le scheduling.
    const origParse = loader.parse.bind(loader);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (loader as any).parse = function (
      data: ArrayBuffer | string,
      path: string,
      onLoad: (gltf: any) => void,
      onError?: (err: any) => void,
    ) {
      const saved = (globalThis as Record<string, unknown>).createImageBitmap;
      delete (globalThis as Record<string, unknown>).createImageBitmap;
      try {
        origParse(data, path, onLoad, onError);
      } finally {
        (globalThis as Record<string, unknown>).createImageBitmap = saved;
      }
    };

    loaderRef.current = loader;
    maxAnisoRef.current = gl.capabilities.getMaxAnisotropy();

    async function init() {
      // ── Pool de Web Workers pour le fetch réseau ──────────────────
      poolRef.current = new ChunkWorkerPool({ size: 4 });

      const metaUrl = `${chunkDir}/chunk-metadata.json`;
      try {
        const resp = await fetch(metaUrl);
        if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
        const json = await resp.json();
        metaRef.current = json.chunks as ChunkMetaEntry[];
      } catch (err) {
        console.error("[StreamingPuzzleMap] Failed to load metadata:", err);
        return;
      }

      if (cancelledRef.current) return;

      // Télémétrie + total connu immédiatement (l'écran de chargement
      // affichait "0/0 segments" tant qu'aucun chunk n'avait fini).
      streamingDiagnostics.reset(metaRef.current);
      streamingDiagnostics.setRenderer(gl);
      onProgressRef.current?.(0, metaRef.current.length);

      // Charger le moteur WASM AVANT de vérifier — sans ça isEngineLoaded()
      // est toujours false et le fallback charge 928 MB d'un coup → context lost.
      try {
        await loadNarvosEngine();
      } catch {
        // WASM indisponible (env navigateur sans COOP/COEP, etc.) → fallback séquentiel
      }

      if (cancelledRef.current) return;

      if (isEngineLoaded()) {
        initStreaming(budgetMB, maxLoaded, loadRadius, unloadRadius);
        const ox = offset?.[0] ?? 0;
        const oy = offset?.[1] ?? 0;
        const oz = offset?.[2] ?? 0;
        for (const chunk of metaRef.current) {
          registerStreamingChunk({
            id: chunk.id,
            center: [chunk.center[0] + ox, chunk.center[1] + oy, chunk.center[2] + oz],
            radius: chunk.radius,
            estimatedMB: chunk.estimatedMB,
          });
        }
        wasmActiveRef.current = true;

        // ── Validation empreinte cache (C++ = source de vérité) ──
        const fp = getStreamingFingerprint();
        if (fp !== 0) {
          validateCacheFingerprint(fp).then((ok) => {
            if (!ok) console.info("[StreamingPuzzleMap] cache IDB purgé — chunks re-générés");
          });
        }

        // ── TOUS les chunks sont essentiels : chargés AVANT le spawn ──
        // Triés par distance au spawn (le plus proche en premier pour que
        // le joueur voit du contenu dès que possible dans la barre de chargement).
        const spawn = playerPositionStore.getPosition();
        const withDist = metaRef.current.map((c) => {
          const dx = (c.center[0] + ox) - spawn.x;
          const dy = (c.center[1] + oy) - spawn.y;
          const dz = (c.center[2] + oz) - spawn.z;
          const sphereDist = Math.max(0, Math.sqrt(dx * dx + dy * dy + dz * dz) - c.radius);
          return { id: c.id, sphereDist };
        }).sort((a, b) => a.sphereDist - b.sphereDist);
        const essentials = withDist.map((c) => c.id);
        essentialSetRef.current = new Set(essentials);
        streamingDiagnostics.markEssential(essentials);

        // Pré-enqueuer TOUS les chunks pour chargement pendant le loading screen
        for (const id of essentials) {
          loadChunk(id);
        }

        console.info(
          `[StreamingPuzzleMap] preload ALL ${metaRef.current.length} chunks (sorted by distance), budget ${budgetMB}MB`,
        );
      } else {
        // Fallback séquentiel — charge un chunk à la fois, plafonné à maxLoaded
        // pour ne pas exploser la VRAM (sans WASM, les 8 chunks = ~1 GB d'un coup).
        console.warn(
          `[StreamingPuzzleMap] WASM not loaded — sequential fallback (max ${maxLoaded} chunks)`,
        );
        const spawn = playerPositionStore.getPosition();
        const fox = offset?.[0] ?? 0, foy = offset?.[1] ?? 0, foz = offset?.[2] ?? 0;
        const sorted = [...metaRef.current].sort((a, b) => {
          const da = Math.hypot(a.center[0] + fox - spawn.x, a.center[1] + foy - spawn.y, a.center[2] + foz - spawn.z);
          const db = Math.hypot(b.center[0] + fox - spawn.x, b.center[1] + foy - spawn.y, b.center[2] + foz - spawn.z);
          return da - db;
        });
        const capped = sorted.slice(0, maxLoaded);
        for (const chunk of capped) {
          if (cancelledRef.current) break;
          await doLoadChunk(chunk.id);
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }
      }

      initializedRef.current = true;
    }

    init();

    // ── Soupape de sécurité : force le reveal si le chargement est bloqué ──
    // Si après SAFETY_MS init n'a pas réussi à fire onComplete (deadlock résiduel,
    // context loss non récupéré, chunk pendu au-delà du timeout individuel),
    // on force le reveal pour ne pas laisser le joueur sur l'écran de chargement.
    //
    // ⚠ DOIT rester INFÉRIEUR à la soupape d'App.tsx (120 s). Sinon App révèle le
    // jeu par-dessus une map encore en chargement → tout le pipeline lourd (parse
    // GLB, BVH, upload textures) continue de tourner PENDANT le gameplay = freeze.
    // SOUPAPE DE BLOCAGE, PAS DE DURÉE TOTALE.
    //
    // C'était un délai fixe de 90 s. Or le chargement réel mesuré est de
    // ~14,4 s par chunk × 8 chunks = ~115 s : la soupape se déclenchait AVANT
    // la fin d'un chargement qui progressait normalement, et purgeait la file.
    // Les ~2 derniers chunks n'étaient alors JAMAIS chargés — ni géométrie, ni
    // collision. C'est la cause mesurée de « des parties du sol sont
    // traversables » et de « le joueur tombe sous la map ».
    //
    // Une soupape doit rattraper un BLOCAGE (chunk pendu, contexte GPU perdu),
    // pas punir la lenteur. On mesure donc le temps écoulé DEPUIS LE DERNIER
    // CHUNK ABOUTI : tant que ça avance, on laisse finir.
    const STALL_MS = 45_000;
    // Amorçage OBLIGATOIRE : à 0, `performance.now() - 0` dépasse déjà le seuil
    // et la soupape tirerait à la première seconde.
    lastProgressAtRef.current = performance.now();
    const stallTimer = setInterval(() => {
      if (completeFiredRef.current || cancelledRef.current) return;
      const inactif = performance.now() - lastProgressAtRef.current;
      if (inactif < STALL_MS) return;
      {
        console.warn(
          `[StreamingPuzzleMap] BLOCAGE — aucun chunk abouti depuis ${(inactif / 1000).toFixed(0)} s ` +
          `(${loadedMapRef.current.size}/${metaRef.current.length} chargés) → forceComplete`,
        );
        completeFiredRef.current = true;
        // Purge la file (même contrat que maybeFireComplete) : sans ça, les chunks
        // restants continuent de se charger pendant que le joueur joue.
        loadQueueRef.current.length = 0;
        // CRITIQUE : pendant le chargement initial, doLoadChunk n'appelle PAS
        // setLoadedChunks (optimisation Phase 3). Sans ce flush, on révèle une map
        // TOTALEMENT INVISIBLE — collision présente, aucun visuel.
        setLoadedChunks(new Map(loadedMapRef.current));
        onCompleteRef.current?.();
      }
    }, 5_000); // sondage toutes les 5 s — coût nul, réactivité suffisante

    return () => {
      cancelledRef.current = true;
      clearInterval(stallTimer);
      poolRef.current?.terminate();
      poolRef.current = null;
      // (le patch parse force TextureLoader — plus de bruit console texture blob)
      clearStreaming();

      chunkSpheresRef.current.clear();
      const toDispose = Array.from(loadedMapRef.current.values());
      loadedMapRef.current = new Map();
      let di = 0;
      const disposeStep = () => {
        const end = Math.min(di + 2, toDispose.length);
        for (; di < end; di++) disposeObject3D(toDispose[di]);
        if (di < toDispose.length) { requestAnimationFrame(disposeStep); return; }
        onDisposedRef.current?.();
      };
      disposeStep();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chunkDir, budgetMB, maxLoaded, loadRadius, unloadRadius, gl, doLoadChunk]);

  useFrame(() => {
    // Frustum culling par chunk (évite le traversal GPU des chunks hors-vue)
    if (loadedMapRef.current.size > 0) {
      // Forcer la mise à jour de la matrice caméra AVANT le test —
      // useFrame tourne AVANT le rendu R3F, donc matrixWorldInverse
      // serait du frame N-1 → chunks au bord du frustum flickent.
      cameraRef.current.updateMatrixWorld();
      _projScreenMatrix.multiplyMatrices(
        cameraRef.current.projectionMatrix,
        cameraRef.current.matrixWorldInverse,
      );
      _frustum.setFromProjectionMatrix(_projScreenMatrix);
      // Bascule d'auto-material : quand elle change, on repasse sur TOUS les
      // chunks déjà résidents. Sans ça, seuls les chunks chargés ensuite
      // suivraient l'état et la comparaison visuelle ne voudrait rien dire.
      // CHANGEMENT DE COUCHES (éditeur Forge) — on repeint tous les chunks
      // résidents. Comparaison d'entiers à chaque frame : le coût est nul, et
      // c'est le seul pont possible dans ce sens (le monde 3D n'est pas re-rendu
      // par React quand l'UI change).
      const amGen = autoMaterialGeneration();
      if (amGen !== lastAmGenRef.current) {
        lastAmGenRef.current = amGen;
        let rebuilt = 0;
        for (const chunk of loadedMapRef.current.values()) {
          rebuilt += rebuildAutoMaterial(chunk);
        }
        // APRÈS le repeint de tous les chunks, jamais avant : les meshes
        // pointaient encore sur les anciens matériaux jusqu'à cette ligne.
        //
        // DIFFÉRÉ hors useFrame : appeler dispose() pendant le rendu détruit
        // des ressources WebGL → crash natif non rattrapable (Agent scan #3).
        // requestIdleCallback garantit que le GPU a fini le frame courant.
        const freed = requestIdleCallback(
          () => disposeStaleAutoMaterials(),
          { timeout: 2000 },
        ) as unknown as number;
        void freed; // unused — le callback est fire-and-forget
        if (rebuilt) {
          console.info(
            `[AutoMaterial] couches changées — ${rebuilt} meshes repeints (nettoyage différé en idle callback)`,
          );
        }
      }

      const amOff = isAutoMaterialDisabled();
      if (amOff !== lastAmOffRef.current) {
        lastAmOffRef.current = amOff;
        let touched = 0;
        for (const chunk of loadedMapRef.current.values()) {
          touched += refreshAutoMaterial(chunk);
        }
        console.info(
          `[AutoMaterial] ${amOff ? "COUPÉ" : "rétabli"} — ${touched} meshes rebasculés`,
        );
      }

      // Bascule de diagnostic : tout rendre, sans test de frustum. Sert à
      // distinguer un trou de géométrie d'un chunk masqué à tort.
      const noCull = streamingDiagnostics.isCullingDisabled();
      for (const [id, chunk] of loadedMapRef.current) {
        const sphere = chunkSpheresRef.current.get(id);
        const visible = noCull || !sphere || _frustum.intersectsSphere(sphere);
        chunk.visible = visible;
        streamingDiagnostics.setInFrustum(id, visible);
      }
    }

    // Streaming WASM : désactivé une fois tout chargé
    if (!initializedRef.current || !wasmActiveRef.current || completeFiredRef.current) return;
    try {
      const pos = playerPositionStore.getPosition();
      tickStreaming(pos.x, pos.y, pos.z);

      const cmds = drainStreamingCommands();
      for (const cmd of cmds) {
        if (cmd.type === StreamCommandType.Load) {
          loadChunk(cmd.chunkId);
        } else if (cmd.type === StreamCommandType.Unload) {
          unloadChunk(cmd.chunkId);
        }
      }
    } catch (err) {
      console.error("[StreamingPuzzleMap] WASM streaming failed — fallback séquentiel:", err);
      wasmActiveRef.current = false;
      eventBus.emit("map:warning", { message: "Streaming WASM désactivé — chargement séquentiel" });
      void (async () => {
        for (const chunk of metaRef.current) {
          if (cancelledRef.current) break;
          // Sans ce filtre, un chunk DÉJÀ en vol repasse un pipeline complet :
          // double fetch/parse, deux meshes distincts enregistrés dans
          // collisionWorld, et loadedMapRef.set écrase la 1re scène — qui n'est
          // alors jamais disposée ni retirée des colliders (fuite GPU + collider).
          if (loadedMapRef.current.has(chunk.id) || loadingSetRef.current.has(chunk.id)) continue;
          loadingSetRef.current.add(chunk.id); // réserve le slot (doLoadChunk le libère)
          await doLoadChunk(chunk.id);
          await new Promise<void>((r) => requestAnimationFrame(() => r()));
        }
        if (!completeFiredRef.current) {
          completeFiredRef.current = true;
          onCompleteRef.current?.();
        }
      })();
    }
  });

  return (
    <>
      {Array.from(loadedChunks.entries()).map(([id, obj]) => (
        <primitive key={`stream-chunk-${id}`} object={obj} />
      ))}
    </>
  );
});
