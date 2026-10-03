// forge/ForgeBuiltMap.tsx — rendu JOUABLE d'une map créée dans l'éditeur Forge.
//
// Une map "editor" = liste d'objets placés + surfaces d'eau (forgeSceneStore). Le rendu
// applique le MÊME étagement anti-freeze que PuzzleMap (chunks) : les modèles sont montés
// UN PAR UN avec une pause requestAnimationFrame entre chaque + précompilation GPU
// (compileAsync) + enregistrement collision au fur et à mesure → la map s'assemble sans
// figer le thread, même avec des centaines d'objets (kit modulaire).
//
// Optimisation : les modèles DISTINCTS ne sont chargés/parsés qu'UNE fois (templates),
// puis CLONÉS pour chaque instance (un kit village = 1 GLB chargé, 150 clones). Le dispose
// libère chaque template une seule fois (les clones partagent géométrie/matériaux).
//
// STREAMING PAR PROXIMITÉ (grandes maps) : au-delà de STREAM_MIN objets ET si la position
// joueur est fournie, les objets sont partitionnés en CELLULES (chunkStream). Seules les
// cellules proches du joueur sont MONTÉES (clone + collision) ; les lointaines sont
// DÉMONTÉES (retrait scene-graph + collisionWorld.remove). Borne le nombre de nœuds,
// d'entrées BVH collision et de draw calls → mémoire/perf stables sur maps immenses
// ("chargement dynamique selon la position du joueur"). Les TEMPLATES restent résidents
// (déjà dédupliqués : 1 GLB par modèle) → pas de re-parse/hitch en re-rentrant dans une zone.
import { memo, useEffect, useRef, useState } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import * as THREE from "three";
import { forgeSceneStore, sceneTerrains, type WaterKind, type ForgeObject } from "./forgeSceneStore";
import { ForgeMapBackdrop } from "./ForgeMapBackdrop";
import { WeatherRig, DEFAULT_WEATHER } from "./ForgeWeatherRig";
import { TerrainMesh } from "./TerrainMesh";
import { RoadMesh } from "./RoadMesh";
import { applyMaterialOverride } from "./applyMaterial";
import { collisionWorld } from "../runtime/CollisionWorld";
import { applyAnisotropy } from "../runtime/sceneUtils";
import { configureGLTFLoader, registerRenderer } from "../loaders/sharedLoaders";
import { chunkObjects, activeCells } from "./chunkStream";

const WATER_COLOR: Record<WaterKind, string> = { riviere: "#3aa7d6", lac: "#2f86c9", mer: "#1d5fa5", ocean: "#0c3c78" };

// Streaming : en deçà de ce nb d'objets, on charge tout (overhead inutile). Au-delà,
// on streame par cellule autour du joueur.
const STREAM_MIN = 80;
const CELL = 40;        // taille d'une cellule (unités monde)
const RADIUS = 75;      // rayon de chargement autour du joueur (~3×3 cellules)
const TICK_MS = 350;    // cadence de réévaluation des cellules actives


const OBJ_TIMEOUT_MS = 30000;
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<T>((_, reject) => { t = setTimeout(() => reject(new Error(`${label} timeout`)), ms); }),
  ]);
}
function disposeTemplate(root: THREE.Object3D): void {
  root.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (mesh.geometry) {
      (mesh.geometry as THREE.BufferGeometry & { disposeBoundsTree?: () => void }).disposeBoundsTree?.();
      mesh.geometry.dispose();
    }
    const m = mesh.material as THREE.Material | THREE.Material[] | undefined;
    if (m) (Array.isArray(m) ? m : [m]).forEach((mat) => {
      for (const key of Object.keys(mat)) {
        const val = (mat as unknown as Record<string, unknown>)[key];
        if (val && (val as THREE.Texture).isTexture) (val as THREE.Texture).dispose();
      }
      mat.dispose();
    });
  });
}

export const ForgeBuiltMap = memo(function ForgeBuiltMap(
  { sceneId, onReady, playerPosition }:
  { sceneId: string; onReady?: () => void; playerPosition?: React.MutableRefObject<THREE.Vector3> },
) {
  const scene = forgeSceneStore.get(sceneId);
  const [placed, setPlaced] = useState<THREE.Object3D[]>([]);
  const { gl, scene: r3fScene, camera } = useThree();
  const onReadyRef = useRef(onReady); onReadyRef.current = onReady;
  const sceneRef = useRef(r3fScene); sceneRef.current = r3fScene;
  const cameraRef = useRef(camera); cameraRef.current = camera;
  const playerRef = useRef(playerPosition); playerRef.current = playerPosition;
  const templatesRef = useRef<THREE.Object3D[]>([]); // templates distincts → dispose 1×
  const streamTimerKillRef = useRef<(() => void) | null>(null); // coupe le timer de streaming au cleanup

  const objectsKey = (scene?.objects ?? []).map((o) => o.id).join("|");

  useEffect(() => {
    if (!scene) { onReadyRef.current?.(); return; }
    let cancelled = false;

    const loader = new GLTFLoader();
    registerRenderer(gl);
    configureGLTFLoader(loader);
    const maxAniso = gl.capabilities.getMaxAnisotropy();

    const objs = scene.objects;
    const templates = new Map<string, THREE.Object3D>();         // path → scène source (1 parse/modèle)
    const loaded = new Map<string, THREE.Object3D[]>();          // cellKey → instances montées
    const chunks = chunkObjects(objs, CELL);                     // cellKey → objets de la cellule
    const streaming = objs.length > STREAM_MIN && !!playerRef.current;

    /** Monte UN objet : template (dédupliqué) → clone → collision → précompile GPU. */
    async function mountObject(o: ForgeObject, idx: number): Promise<THREE.Object3D | null> {
      let template = templates.get(o.model);
      if (!template) {
        const gltf = await withTimeout(loader.loadAsync(o.model), OBJ_TIMEOUT_MS, `obj ${idx}`);
        if (cancelled) return null;
        template = gltf.scene;
        template.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; } });
        applyAnisotropy(template, maxAniso);
        templates.set(o.model, template);
        templatesRef.current.push(template);
      }
      const inst = template.clone(true);                          // géo/mat partagés → dispose 1× via templates
      applyMaterialOverride(inst, o.material);
      inst.position.set(...o.pos);
      inst.rotation.set(...o.rot);
      inst.scale.set(...o.scale);
      inst.updateMatrixWorld(true);                               // AVANT collision (BVH lit la transform monde)
      inst.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) collisionWorld.add(m); });
      if (typeof gl.compileAsync === "function") {
        try { await withTimeout(gl.compileAsync(inst, cameraRef.current, sceneRef.current), OBJ_TIMEOUT_MS, `compile ${idx}`); }
        catch { /* best-effort */ }
        if (cancelled) return null;
      }
      return inst;
    }

    const flush = () => setPlaced([...loaded.values()].flat());

    /** Charge une cellule (objets étagés : 1 rAF entre chaque → anti-freeze). */
    async function loadCell(key: string): Promise<void> {
      if (cancelled || loaded.has(key)) return;
      const cellObjs = chunks.get(key);
      if (!cellObjs) return;
      const insts: THREE.Object3D[] = [];
      loaded.set(key, insts);                                     // réserve la clé tôt (anti double-chargement)
      for (let i = 0; i < cellObjs.length; i++) {
        if (cancelled || !loaded.has(key)) return;                // déchargée en route → abandonne
        try {
          const inst = await mountObject(cellObjs[i], i);
          if (inst && loaded.has(key)) { insts.push(inst); flush(); }
        } catch (err) {
          console.warn(`[ForgeBuiltMap] cellule ${key} objet ${i} échec`, err);
        }
        await new Promise<void>((r) => requestAnimationFrame(() => r()));
      }
    }

    /** Décharge une cellule : retire la collision + détache du scene-graph (clones non disposés). */
    function unloadCell(key: string): void {
      const insts = loaded.get(key);
      if (!insts) return;
      loaded.delete(key);
      for (const inst of insts) inst.traverse((c) => { const m = c as THREE.Mesh; if (m.isMesh) collisionWorld.remove(m); });
      flush();
    }

    // Sol prêt + reveal immédiat : le joueur entre tout de suite (objets streamés ensuite).
    onReadyRef.current?.();

    if (!streaming) {
      // Petites maps : tout charger, jamais décharger (comportement historique).
      (async () => {
        for (const key of chunks.keys()) { if (cancelled) return; await loadCell(key); }
        if (!cancelled) console.info(`%c[ForgeBuiltMap] ${objs.length} objets assemblés ✓`, "color:#a3e635");
      })();
    } else {
      // Grandes maps : streaming par proximité. Boucle de réévaluation des cellules actives.
      console.info(`%c[ForgeBuiltMap] STREAMING — ${objs.length} objets, ${chunks.size} cellules`, "color:#22d3ee");
      let loadingBusy = false;
      let timer: ReturnType<typeof setTimeout> | null = null;
      const tick = async () => {
        if (cancelled) return;
        const p = playerRef.current?.current;
        if (p) {
          const active = activeCells(p.x, p.z, CELL, RADIUS);
          // Décharge d'abord les lointaines (libère mémoire/collision avant de charger).
          for (const key of [...loaded.keys()]) if (!active.has(key)) unloadCell(key);
          // Charge UNE cellule manquante par tick (étalé → pas de pic de chargement).
          if (!loadingBusy) {
            for (const key of active) {
              if (!loaded.has(key) && chunks.has(key)) {
                loadingBusy = true;
                loadCell(key).finally(() => { loadingBusy = false; });
                break;
              }
            }
          }
        }
        if (!cancelled) timer = setTimeout(tick, TICK_MS);
      };
      tick();
      streamTimerKillRef.current = () => { if (timer) clearTimeout(timer); }; // coupe la boucle au cleanup
    }

    return () => {
      cancelled = true;
      streamTimerKillRef.current?.();
      streamTimerKillRef.current = null;
      // Dispose étagé des templates (1× chacun) → libère la VRAM sans hitch au départ.
      const toDispose = templatesRef.current;
      templatesRef.current = [];
      let di = 0;
      const step = () => {
        const end = Math.min(di + 2, toDispose.length);
        for (; di < end; di++) disposeTemplate(toDispose[di]);
        if (di < toDispose.length) requestAnimationFrame(step);
      };
      step();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sceneId, objectsKey, gl]);

  if (!scene) return null;
  return (
    <group>
      {/* AMBIANCE de l'auteur (M4) — le MÊME rig que l'éditeur, avec les réglages
          enregistrés dans la scène. Sans lui, la map publiée s'affichait sous
          l'éclairage par défaut : un auteur composait une nuit étoilée ou un
          coucher de soleil, et le joueur voyait un plein jour neutre. Rien ne le
          signalait — l'ambiance disparaissait simplement à la publication.
          Scènes créées avant l'ajout du champ → `DEFAULT_WEATHER`. */}
      <WeatherRig {...(scene.weather ?? DEFAULT_WEATHER)} />

      {/* Map EXISTANTE en fond (édition d'une map présente) : rendue + collisionnée. */}
      {scene.baseMap && <ForgeMapBackdrop mapId={scene.baseMap} collision />}
      {/* Terrains sculptés (multi-tuiles) : rendus + collisionnés. */}
      {sceneTerrains(scene).map((t, i) => <TerrainMesh key={t.id ?? `terrain-${i}`} terrain={t} collision />)}
      {/* Routes/chemins. */}
      {(scene.paths ?? []).map((p) => <RoadMesh key={p.id} path={p} />)}
      {/* Sol de base UNIQUEMENT si pas de map de base (sinon le sol de la map sert). */}
      {!scene.baseMap && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
          <planeGeometry args={[800, 800]} />
          <meshStandardMaterial color="#241a10" roughness={1} />
        </mesh>
      )}
      {/* Objets montés (tout ou streamés par proximité). Clé = uuid stable (ré-ordonnage sûr). */}
      {placed.map((obj) => <primitive key={`fobj-${obj.uuid}`} object={obj} />)}
      {/* Eaux : plans légers, montés d'emblée. */}
      {scene.waters.map((w) => (
        <mesh key={w.id} position={w.pos} rotation={[-Math.PI / 2, 0, w.rotY]}>
          <planeGeometry args={w.size} />
          <meshStandardMaterial color={WATER_COLOR[w.kind]} transparent opacity={0.72} roughness={0.15} metalness={0.35} />
        </mesh>
      ))}
    </group>
  );
});
