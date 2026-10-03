// ══════════════════════════════════════════════════════════════════════════════
// runtime/PuzzleMap.tsx — Chargement séquentiel d'une map découpée en chunks
//
// Pourquoi ce système :
//   Un GLB de 142-171 MB chargé d'un coup gèle le main thread 3-10s
//   (décompression Draco + création BufferGeometry + upload GPU). Même avec
//   Draco activé, le PARSING reste mono-thread.
//
// Stratégie :
//   1) On charge les chunks UN PAR UN (await loader.loadAsync).
//   2) Entre chaque chunk, on fait une pause `requestAnimationFrame` →
//      le navigateur peut peindre 1 frame et rester réactif.
//   3) Chaque chunk arrivé est inséré dans la scène React via setState →
//      le joueur voit littéralement la map s'assembler à l'écran.
//   4) Chaque chunk est enregistré dans `collisionWorld` au fur et à mesure
//      → le joueur peut commencer à marcher sur les premiers chunks pendant
//      que les suivants chargent (UX killer feature).
//
// Convention chunks :
//   • Chemins relatifs à public/ (cf assetManifest.MAPS[mapId].chunks).
//   • Position monde conservée à l'export Blender (zero transform manipulation).
//   • Variantes qualité .med.glb / .low.glb résolues par qualityVariant().
//
// Fallback :
//   Si `chunks` est undefined dans le manifest, le caller (RpgGameWorld)
//   doit utiliser `MapModel` (GLB unique). PuzzleMap n'est rendu QUE
//   lorsqu'on a une liste de chunks à découper.
// ══════════════════════════════════════════════════════════════════════════════

import { memo, useEffect, useMemo, useState, useRef } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { collisionWorld } from "./CollisionWorld";
import { applyAnisotropy } from "./sceneUtils";
import { qualityVariant } from "../loaders/assetQuality";
import { configureGLTFLoader, registerRenderer } from "../loaders/sharedLoaders";
import { eventBus } from "./core/EventBus";

// ── Libération GPU explicite ─────────────────────────────────────────────────
// three.js ne dispose PAS les ressources GPU au GC : il FAUT appeler
// geometry/material/texture.dispose(). Sans ça, changer de map accumule des
// géométries + textures en VRAM jusqu'au crash ("THREE.WebGLRenderer: Context
// Lost"). On parcourt le sous-arbre et on libère tout.
function disposeMaterial(mat: THREE.Material): void {
  for (const key of Object.keys(mat)) {
    const val = (mat as unknown as Record<string, unknown>)[key];
    if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose();
  }
  mat.dispose();
}
// Deadline par chunk : un loadAsync/compileAsync qui ne settle JAMAIS (socket pendu,
// fichier corrompu) bloquerait le reveal gate à l'infini → écran de chargement figé.
// On borne chaque étape ; au-delà → rejet → le chunk est traité comme "échoué" (skip).
const CHUNK_TIMEOUT_MS = 10000; // 10 s : un chunk normal charge en 2-5s. Si >10s c'est bloqué → on passe au suivant.
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, reject) => { t = setTimeout(() => reject(new Error(`${label} timeout`)), ms); }),
  ]);
}

function disposeObject3D(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) {
      // Libère aussi le BVH (three-mesh-bvh) attaché par CollisionWorld, sinon
      // il reste en mémoire après le dispose de la géométrie.
      (mesh.geometry as THREE.BufferGeometry & { disposeBoundsTree?: () => void }).disposeBoundsTree?.();
      mesh.geometry.dispose();
    }
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (m) (Array.isArray(m) ? m : [m]).forEach(disposeMaterial);
  });
}

interface PuzzleMapProps {
  /**
   * Liste ordonnée des chunks à charger. Chaque entrée est un chemin HIGH
   * (canonique) — la variante qualité courante est résolue automatiquement
   * via `qualityVariant()` dans le loop.
   *
   * Ordre = ordre de chargement. Tu peux donc mettre le terrain principal
   * en premier (joueur voit le sol immédiatement) puis les détails ensuite.
   */
  chunks: string[];

  /** Appelé après chaque chunk chargé : (loaded, total) → utile pour HUD. */
  onChunkProgress?: (loaded: number, total: number) => void;

  /** Appelé une seule fois quand tous les chunks sont chargés et insérés. */
  onComplete?: () => void;
}

/**
 * Composant principal — charge et assemble une map découpée.
 *
 * Memoizé : on évite un re-render si les props sont stables. Le state local
 * `loadedScenes` est ce qui drive le rendu progressif.
 */
export const PuzzleMap = memo(function PuzzleMap({
  chunks,
  onChunkProgress,
  onComplete,
}: PuzzleMapProps) {
  // Une entrée par chunk chargé. On rendra `<primitive>` pour chacune.
  const [loadedScenes, setLoadedScenes] = useState<THREE.Object3D[]>([]);
  const { gl, scene, camera } = useThree();

  // Refs pour les callbacks → évite de relancer l'effet si le caller passe
  // une nouvelle référence de callback à chaque render.
  const onProgressRef = useRef(onChunkProgress);
  onProgressRef.current = onChunkProgress;
  const onCompleteRef = useRef(onComplete);
  onCompleteRef.current = onComplete;

  // Refs scène/caméra : utilisées pour la précompilation GPU (gl.compileAsync).
  // Via refs → un éventuel swap de caméra (marche ↔ pilotage) NE relance PAS
  // le chargement de la map en cours.
  const sceneRef = useRef(scene);
  sceneRef.current = scene;
  const cameraRef = useRef(camera);
  cameraRef.current = camera;

  // Réf vers les chunks chargés → accessible par le cleanup pour libérer la VRAM.
  const loadedRef = useRef<THREE.Object3D[]>([]);

  // Clé stable des chunks → réinit du loading si la liste change vraiment
  // (pas juste une nouvelle ref de tableau). Important pour HMR.
  const chunksKey = useMemo(() => chunks.join("|"), [chunks]);

  useEffect(() => {
    // Sentinelle d'annulation : si le composant démonte (changement de map)
    // pendant le chargement, on arrête la boucle et on jette les chunks
    // déjà chargés (mémoire libérée par le GC car plus de référence React).
    let cancelled = false;

    // Filtre le bruit console non-fatal de GLTFLoader (textures blob embarquées
    // dans les GLB qui échouent à se charger — le rendu continue sans texture).
    const _warn = console.warn;
    console.warn = (...args: unknown[]) => {
      if (args.length > 0 && typeof args[0] === "string" && args[0].includes("THREE.GLTFLoader: Couldn't load texture blob:")) return;
      _warn.apply(console, args);
    };

    const loader = new GLTFLoader();
    registerRenderer(gl);
    configureGLTFLoader(loader);
    const maxAniso = gl.capabilities.getMaxAnisotropy();

    async function loadSequentially(): Promise<void> {
      const accumulated: THREE.Object3D[] = [];
      const failed: string[] = []; // chunks abandonnés (timeout/404 après retry) → bilan
      loadedRef.current = accumulated; // expose au cleanup pour le dispose
      for (let i = 0; i < chunks.length; i++) {
        if (cancelled) return;

        // Résout la variante qualité (high/medium/low) — cf assetQuality.ts.
        const resolvedPath = qualityVariant(chunks[i]);

        try {
          // Charge UN chunk. `loadAsync` est le wrapper Promise de three.js.
          // 2 timeouts rapides : si le chunk ne charge pas en 10s, on le marque
          // comme défaillant et on passe au suivant — plutôt une map partielle
          // qu'un écran de chargement figé à l'infini.
          let gltf: any = null;
          for (let attempt = 0; attempt < 2; attempt++) {
            try {
              gltf = await withTimeout(loader.loadAsync(resolvedPath), CHUNK_TIMEOUT_MS, `chunk ${i} (try ${attempt + 1})`);
              break; // réussi → sort de la boucle
            } catch (e) {
              if (cancelled) return;
              if (attempt === 0) {
                console.warn(`[PuzzleMap] chunk ${i} échec 1er essai → retry…`, e);
                await new Promise<void>((r) => requestAnimationFrame(() => r()));
              } else {
                console.warn(`[PuzzleMap] chunk ${i} abandonné après 2 essais`, e);
                throw e; // laisse le catch externe gérer
              }
            }
          }
          if (!gltf) continue; // sécurité
          // THREE.Cache (activé en main.tsx) garde les octets BRUTS en RAM — utile pour les
          // petits assets partagés, mais un chunk de map (~20 Mo) ne sera pas re-chargé une
          // fois parsé → on le purge du cache d'octets immédiatement (RAM bornée).
          THREE.Cache.remove(resolvedPath);
          if (cancelled) return;

          const chunkScene = gltf.scene;
          // Aniso textures + shadows : même traitement que MapModel.
          chunkScene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) m.receiveShadow = true;
          });
          applyAnisotropy(chunkScene, maxAniso);

          // Enregistre les meshes du chunk dans le système de collisions.
          // `add()` (et pas `registerScene()`) → on n'écrase pas les chunks
          // déjà indexés. Le clear global se fait au changement de map ailleurs.
          chunkScene.traverse((o) => {
            const m = o as THREE.Mesh;
            if (m.isMesh) collisionWorld.add(m);
          });

          // ── Précompilation GPU (anti-hitch principal) ─────────────────────
          // Compile les shaders + upload géométrie/textures AVANT de monter le
          // chunk. Sinon la 1ère frame de rendu fait tout ce travail d'un coup
          // (gros pic pour 3000+ meshes). compileAsync utilise la compilation
          // parallèle (KHR_parallel_shader_compile) → étale la charge.
          // 3e arg = scène principale (fournit les lumières pour les shaders).
          // Guard typeof : compileAsync existe depuis three r151 (on est en r181),
          // mais on reste défensif si le renderer ne l'expose pas.
          if (typeof gl.compileAsync === "function") {
            try {
              // Borné aussi : une compilation pendue ne doit pas figer le gate.
              await withTimeout(gl.compileAsync(chunkScene, cameraRef.current, sceneRef.current), CHUNK_TIMEOUT_MS, `compile ${i}`);
              if (cancelled) return;
            } catch {
              /* compile best-effort (ou timeout) : on monte quand même le chunk */
            }
          }

          accumulated.push(chunkScene);
          // Update React → le chunk apparaît à l'écran. On clone le tableau
          // pour respecter l'immutabilité de useState.
          setLoadedScenes([...accumulated]);
          onProgressRef.current?.(i + 1, chunks.length);
        } catch (err) {
          // Un chunk en erreur ne doit pas bloquer les autres : on log et
          // on continue. La map sera juste partielle (mieux que rien).
          failed.push(resolvedPath);
          console.warn(`[PuzzleMap] chunk failed: ${resolvedPath}`, err);
          onProgressRef.current?.(i + 1, chunks.length);
        }

        // ── Pause pour respirer ────────────────────────────────────────────
        // requestAnimationFrame entre chaque chunk : le browser rend 1 frame,
        // garde la souris/clavier réactifs, puis on enchaîne. C'est la clé
        // anti-freeze : sans cette pause, await loadAsync() ne yield jamais
        // longtemps puisque le parsing GLB est sync à l'intérieur.
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }

      if (!cancelled) {
        // Bilan VÉRIFIABLE de complétude : si "X/X · 0 échoué" la map est ENTIÈRE —
        // tout aspect "incomplet" vient alors d'autre chose (éclairage, brouillard…).
        if (failed.length === 0) {
          console.info(`%c[PuzzleMap] map assemblée ${accumulated.length}/${chunks.length} ✓`, "color:#a3e635");
        } else {
          console.warn(`[PuzzleMap] map PARTIELLE ${accumulated.length}/${chunks.length} — échoués:`, failed);
          eventBus.emit("map:warning", { message: `Map partielle : ${failed.length} chunk(s) manquant(s)` });
        }
        onCompleteRef.current?.();
      }
    }

    loadSequentially();

    return () => {
      cancelled = true;
      console.warn = _warn; // restaure le warn original
      // Libération VRAM explicite : sans ça, changer de map fuit géométries +
      // textures GPU jusqu'au "Context Lost". Les colliders, eux, sont reset au
      // changement de map (collisionWorld.clear dans travelTo).
      // DÉ-BURSTÉ : disposer tous les chunks (geo+BVH+textures) en une boucle sync = gros
      // hitch au changement de map. On étale 2 chunks/rAF (miroir du load path). Les scènes
      // sont déjà détachées du rendu (composant démonté) → libération en arrière-plan sûre.
      const toDispose = loadedRef.current;
      loadedRef.current = [];
      let di = 0;
      const disposeStep = () => {
        const end = Math.min(di + 2, toDispose.length);
        for (; di < end; di++) disposeObject3D(toDispose[di]);
        if (di < toDispose.length) requestAnimationFrame(disposeStep);
      };
      disposeStep();
    };
  }, [chunksKey, gl, chunks]);

  return (
    <>
      {loadedScenes.map((scene, i) => (
        <primitive key={`chunk-${i}-${scene.uuid}`} object={scene} />
      ))}
    </>
  );
});
