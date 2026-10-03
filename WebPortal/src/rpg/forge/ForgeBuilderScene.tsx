/**
 * forge/ForgeBuilderScene.tsx — Scène d'édition 3D pour la Forge.
 *
 * Corrections clés :
 *  • GIZMO ATTACHÉ : l'objet sélectionné est rendu DANS <TransformControls> (l'ancienne
 *    version laissait le gizmo détaché de tout → déplacements sans effet). Snap appliqué,
 *    OrbitControls auto-désactivé pendant le drag (makeDefault).
 *  • MÉTÉO LIVE : la lumière directionnelle dérive de l'angle solaire + du preset météo ;
 *    la brume est appliquée en direct (useEffect sur scene.fog). Ciel découplé de la grille.
 *  • CALQUES : les objets d'un calque masqué ne sont pas rendus ; un calque verrouillé
 *    bloque la sélection. Hitbox de sélection = bounding box réelle du modèle.
 */
import { useRef, useCallback, useMemo, useState, useEffect, Suspense } from 'react';
import { ThreeEvent, useThree } from '@react-three/fiber';
import { OrbitControls, TransformControls, Grid, Sky, Stars, Environment, ContactShadows, useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import type { ForgeObject, ForgeWater, WaterKind, ForgeMaterial } from './forgeSceneStore';
import { forgeSceneStore, sceneTerrains } from './forgeSceneStore';
import { applyMaterialOverride } from './applyMaterial';
import type { AssetEntry } from './assetScanner';
import type { Layer } from './ForgePanels';
import { ForgeMapBackdrop } from './ForgeMapBackdrop';
import { WeatherRig } from './ForgeWeatherRig';
import { TerrainMesh } from './TerrainMesh';
import { RoadMesh } from './RoadMesh';
import type { BrushMode } from './terrainData';
import { useFrame } from '@react-three/fiber';
import { forgeSync } from './forgeSync';
import { usePeers } from './forgePresenceStore';
import { collisionWorld } from '../runtime/CollisionWorld';
import { decideGroundClick } from './groundClickAction';

// FORGE LIVE : diffuse ma caméra (throttle interne) + affiche les curseurs des pairs.
function ForgeLivePresence() {
  const peers = usePeers();
  useFrame(({ camera }) => {
    if (forgeSync.isActive()) forgeSync.sendPresence([camera.position.x, camera.position.y, camera.position.z]);
  });
  return (
    <>
      {peers.map((p) => (
        <group key={p.id} position={p.cam}>
          <mesh><sphereGeometry args={[0.35, 12, 12]} /><meshBasicMaterial color={p.color} transparent opacity={0.55} /></mesh>
          <Html distanceFactor={14} position={[0, 0.6, 0]}>
            <div style={{ background: "rgba(2,6,12,0.9)", color: p.color, padding: "1px 7px", borderRadius: 3, fontSize: 11, fontFamily: "monospace", whiteSpace: "nowrap", border: `1px solid ${p.color}` }}>
              👤 {p.name}
            </div>
          </Html>
        </group>
      ))}
    </>
  );
}

export type ToolMode = 'select' | 'translate' | 'rotate' | 'scale' | 'terrain' | 'spline' | 'water' | 'vegetation';

export interface EditorSettings {
  snapEnabled: boolean;
  snapStep: number;
  gridVisible: boolean;
  autoSaveInterval: number;
  showWaterNormals: boolean;
}

const WATER_COLORS: Record<WaterKind, string> = { riviere: '#3aa7d6', lac: '#2f86c9', mer: '#1d5fa5', ocean: '#0c3c78' };

// `WEATHER` et `WeatherRig` vivent désormais dans `ForgeWeatherRig.tsx` : le
// runtime (`ForgeBuiltMap`) en a besoin pour rejouer l'ambiance de l'auteur, et
// il ne peut pas importer ce fichier-ci sans tirer tout l'éditeur dans le bundle.

// Modèle (clone caché à la sélection : il est re-rendu dans le gizmo).
function MeshRenderer({ path, material }: { path: string; material?: ForgeMaterial }) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => { const c = scene.clone(true); applyMaterialOverride(c, material); return c; }, [scene, material]);
  return <primitive object={cloned} />;
}

function EditableWater({ water, isSelected, onClick }: { water: ForgeWater; isSelected: boolean; onClick: () => void }) {
  return (
    <mesh position={water.pos} rotation={[-Math.PI / 2, 0, water.rotY]} onPointerDown={(e) => { if (e.button !== 2) { e.stopPropagation(); onClick(); } }}>
      <planeGeometry args={water.size} />
      <meshStandardMaterial color={WATER_COLORS[water.kind]} transparent opacity={isSelected ? 0.85 : 0.6} roughness={0.1} metalness={0.4} />
      {isSelected && (
        <Html distanceFactor={3}>
          <div style={{ background: '#4fc3f7', color: '#0f172a', padding: '2px 6px', borderRadius: 4, fontSize: 10, whiteSpace: 'nowrap', fontFamily: 'JetBrains Mono, monospace' }}>
            {water.kind} ({water.size[0]}×{water.size[1]}m)
          </div>
        </Html>
      )}
    </mesh>
  );
}

function EditorGrid({ visible }: { visible: boolean }) {
  if (!visible) return null;
  return <Grid position={[0, 0, 0]} args={[100, 100]} cellSize={1} cellThickness={0.5} cellColor="#1e293b"
    sectionSize={5} sectionThickness={1} sectionColor="#334155" fadeDistance={50} infiniteGrid />;
}

function SplineTool({ points, onPointsChange }: { points: THREE.Vector3[]; onPointsChange: (p: THREE.Vector3[]) => void }) {
  const [dragging, setDragging] = useState<number | null>(null);
  const curve = useMemo(() => (points.length < 2 ? null : new THREE.CatmullRomCurve3(points)), [points]);
  return (
    <group>
      {points.map((pt, i) => (
        <mesh key={i} position={pt} onPointerDown={() => setDragging(i)} onPointerUp={() => setDragging(null)}
          onPointerMove={(e) => {
            if (dragging !== i) return;
            // `e.point` est l'intersection avec la SPHÈRE de contrôle elle-même,
            // pas avec le sol : en la recopiant, le point glissait sur la surface
            // de la petite bille (rayon 0,2) et partait n'importe où dès que le
            // curseur en effleurait le bord.
            //
            // On projette le rayon du curseur sur un plan HORIZONTAL passant par
            // le point d'origine : le déplacement suit la souris en X/Z et garde
            // l'altitude du point, qui vient du terrain au moment de la pose.
            const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -pt.y);
            const hit = new THREE.Vector3();
            if (!e.ray.intersectPlane(plane, hit)) return; // rayon parallèle au plan
            const p = [...points];
            p[i] = hit;
            onPointsChange(p);
          }}>
          <sphereGeometry args={[0.2, 16, 16]} />
          <meshStandardMaterial color={dragging === i ? '#f59e0b' : '#4fc3f7'} emissive={dragging === i ? '#f59e0b' : '#4fc3f7'} emissiveIntensity={0.3} />
        </mesh>
      ))}
      {curve && points.length >= 2 && (
        <mesh>
          <tubeGeometry args={[curve, 32, 0.3, 8, false]} />
          <meshStandardMaterial color="#f59e0b" transparent opacity={0.6} />
        </mesh>
      )}
    </group>
  );
}

interface ForgeBuilderSceneProps {
  sceneId: string;
  toolMode: ToolMode;
  selectedObjectId: string | null;
  settings: EditorSettings;
  pendingAsset: AssetEntry | null;
  splinePoints: THREE.Vector3[];
  layers: Layer[];
  sunAngle: number;
  weatherPreset: string;
  fogDensity: number;
  /** M6 : le bouton « ombres » de l'éditeur pilotait le Canvas mais PAS le rig
   *  d'éclairage — shadows y était écrit en dur. Un réglage qui ne règle rien. */
  showShadows: boolean;
  onObjectSelect: (id: string | null) => void;
  onObjectUpdate: (id: string, updates: Partial<ForgeObject>) => void;
  onObjectRemove: (id: string) => void;
  onWaterUpdate: (id: string, updates: Partial<ForgeWater>) => void;
  onAddObject: (asset: AssetEntry, pos: THREE.Vector3) => void;
  onSplinePointsChange: (points: THREE.Vector3[]) => void;
  onPlacementMode: (active: boolean) => void;
  // Terrain (outil terrain) :
  terrainBrush: BrushMode;
  brushSize: number;
  brushStrength: number;
  activeTerrainId?: string;
  onTerrainCommit: (terrainId: string, heights: number[]) => void;
  // Végétation : dispersion d'un modèle en cluster.
  onScatter: (asset: AssetEntry, center: THREE.Vector3) => void;
}

export function ForgeBuilderScene({
  sceneId, toolMode, selectedObjectId, settings, pendingAsset, splinePoints,
  layers, sunAngle, weatherPreset, fogDensity, showShadows,
  onObjectSelect, onObjectUpdate, onWaterUpdate, onAddObject, onSplinePointsChange, onPlacementMode,
  terrainBrush, brushSize, brushStrength, activeTerrainId, onTerrainCommit, onScatter,
}: ForgeBuilderSceneProps) {
  const scene = forgeSceneStore.get(sceneId);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const transformRef = useRef<any>(null);
  const selectedGroupRef = useRef<THREE.Group>(null);
  /**
   * Position de l'aperçu de placement — `null` quand AUCUNE surface valide n'est
   * sous le curseur (monde de collision pas encore peuplé, ou curseur dans le vide).
   *
   * L'aperçu n'est alors pas rendu du tout, et cette absence EST le retour visuel :
   * pas de fantôme → rien ne se posera ici. Une position de repli (y = 0) afficherait
   * au contraire un aperçu à un endroit où le clic ne pose rien — c'est M1.
   */
  const [mousePos, setMousePos] = useState<THREE.Vector3 | null>(null);

  // Calques : map id → état (visibilité / verrou) pour filtrer/bloquer.
  const layerById = useMemo(() => new Map(layers.map((l) => [l.id, l])), [layers]);
  const isVisible = useCallback((o: ForgeObject) => layerById.get(o.layerId ?? 'default')?.visible !== false, [layerById]);
  const isLocked = useCallback((o: ForgeObject) => layerById.get(o.layerId ?? 'default')?.locked === true, [layerById]);

  const handleGroundClick = useCallback((e: ThreeEvent<MouseEvent>) => {
    if (e.button === 2) return;

    // ── M1 : surface picking via le monde de collision réel ──────────────────
    // `e.point` est l'intersection avec le plan capteur (y ≈ −0.01 ou la
    // géométrie du backdrop). Sur la Forge (sol ≈ −51), poser à y=0 plaçait
    // l'objet 50 m au-dessus du décor. `pickSurface` interroge le monde de
    // collision peuplé par ForgeMapBackdrop + TerrainMesh, et distingue trois
    // états pour éviter le raccourci « rien = poser à 0 ».
    // La DÉCISION vit dans `groundClickAction.ts` — TS pur, testé sans React.
    // Ici on ne fait qu'exécuter. Les deux règles qui tiennent M1 (jamais de pose
    // hors `hit`, et `empty` ≠ `miss`) sont documentées et testées là-bas.
    const pick = collisionWorld.pickSurface(e.ray.origin, e.ray.direction);
    const action = decideGroundClick(pick, toolMode, pendingAsset !== null);

    switch (action.kind) {
      case 'spline':
        onSplinePointsChange([...splinePoints, action.point.clone()]);
        return;
      case 'scatter':
        if (pendingAsset) onScatter(pendingAsset, action.point.clone());
        return;
      case 'place':
        if (pendingAsset) {
          onAddObject(pendingAsset, action.point);
          onPlacementMode(false); // seulement quand l'objet est RÉELLEMENT posé
        }
        return;
      case 'deselect':
        onObjectSelect(null);
        return;
      case 'none':
        return;
    }
  }, [toolMode, pendingAsset, splinePoints, onSplinePointsChange, onAddObject, onScatter, onObjectSelect, onPlacementMode]);

  const handlePointerMove = useCallback((e: ThreeEvent<PointerEvent>) => {
    if (!pendingAsset) return;
    const pick = collisionWorld.pickSurface(e.ray.origin, e.ray.direction);
    // `null` hors `hit` → l'aperçu disparaît. Le repli sur `e.point` affichait un
    // fantôme à y ≈ 0 : le joueur visait un endroit où le clic ne posait rien.
    setMousePos(pick.status === "hit" ? pick.point.clone() : null);
  }, [pendingAsset]);

  if (!scene) return null;

  const selectedObj = scene.objects.find((o) => o.id === selectedObjectId) ?? null;
  const selectedWater = scene.waters.find((w) => w.id === selectedObjectId) ?? null;
  const gizmoMode = toolMode === 'rotate' ? 'rotate' : toolMode === 'scale' ? 'scale' : 'translate';
  const step = settings.snapEnabled ? settings.snapStep : null;

  // Commit de la transform du gizmo → store (avec snap).
  const commitTransform = () => {
    const t = selectedGroupRef.current;
    if (!t) return;
    const sn = (v: number) => (step ? Math.round(v / step) * step : v);
    // AUCUN plancher sur Y. `Math.max(0, …)` supposait que le sol de toute map
    // est à zéro : sur la Forge (sol ≈ −51) il remontait chaque objet déplacé au
    // gizmo à la hauteur 0, c'est-à-dire ~50 m au-dessus du décor, en écrasant
    // silencieusement la position que l'utilisateur venait de choisir.
    // L'altitude vient désormais du raycast sur la géométrie réelle.
    if (selectedObj) {
      onObjectUpdate(selectedObj.id, {
        pos: [sn(t.position.x), sn(t.position.y), sn(t.position.z)],
        rot: [t.rotation.x, t.rotation.y, t.rotation.z],
        scale: [t.scale.x, t.scale.y, t.scale.z],
      });
    } else if (selectedWater) {
      onWaterUpdate(selectedWater.id, { pos: [sn(t.position.x), t.position.y, sn(t.position.z)], rotY: t.rotation.y });
    }
  };

  return (
    <>
      <WeatherRig sunAngle={sunAngle} preset={weatherPreset} fogDensity={fogDensity} shadows={showShadows} />

      {/* Map de base (édition d'une map existante) : backdrop visuel, sans collision.
          Les gestionnaires de clic vivent ICI, sur la géométrie RÉELLE : c'est elle
          qui donne le point de pose. Le backdrop était auparavant muet — le rayon le
          touchait, mais personne n'écoutait, et le plan de secours à y=0 raflait le
          clic parce qu'il est plus PROCHE de la caméra que le terrain (sol de la
          Forge à ≈ −51). D'où des objets posés 50 m au-dessus du décor. */}
      {scene.baseMap && (
        <group onClick={handleGroundClick} onPointerMove={handlePointerMove}>
          <ForgeMapBackdrop mapId={scene.baseMap} />
        </group>
      )}

      {/* Forge Live : curseurs des co-éditeurs + diffusion de ma caméra. */}
      <ForgeLivePresence />

      {/* Routes/chemins : géométrie de ruban le long des splines validées. */}
      {(scene.paths ?? []).map((p) => <RoadMesh key={p.id} path={p} />)}

      {/* Terrains sculptés (multi-tuiles) : seul le terrain ACTIF est éditable en mode terrain. */}
      {sceneTerrains(scene).map((t, i) => (
        <TerrainMesh key={t.id ?? `terrain-${i}`} terrain={t}
          editable={toolMode === 'terrain' && t.id === activeTerrainId}
          brushMode={terrainBrush} brushSize={brushSize} brushStrength={brushStrength}
          onCommit={(h) => onTerrainCommit(t.id ?? `terrain-${i}`, h)} />
      ))}

      {/* Sol cliquable de SECOURS — scènes vierges uniquement.
          Quand une map de base est chargée, c'est elle qu'on raycaste (voir plus
          haut) : ce plan ne doit alors PAS exister. Il mesure 500×500 centré sur
          l'origine alors que la Forge s'étend sur plusieurs milliers d'unités —
          il volait le clic à l'intérieur du carré, et laissait le reste de la
          carte sans aucun gestionnaire à l'extérieur. */}
      {!scene.baseMap && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} onClick={handleGroundClick} onPointerMove={handlePointerMove}>
          <planeGeometry args={[500, 500]} />
          <meshStandardMaterial color="#0f172a" roughness={0.9} transparent opacity={0.5} />
        </mesh>
      )}

      <EditorGrid visible={settings.gridVisible} />
      <ContactShadows opacity={0.4} width={100} height={100} blur={1} far={20} />

      {/* Objets NON sélectionnés (les masqués par calque sont omis). */}
      {scene.objects.filter((o) => o.id !== selectedObjectId && isVisible(o)).map((obj) => (
        <SelectableObject key={obj.id} obj={obj} locked={isLocked(obj)} onSelect={() => { if (!isLocked(obj)) onObjectSelect(obj.id); }} />
      ))}

      {/* Eaux non sélectionnées. */}
      {scene.waters.filter((w) => w.id !== selectedObjectId).map((w) => (
        <EditableWater key={w.id} water={w} isSelected={false} onClick={() => onObjectSelect(w.id)} />
      ))}

      {/* SÉLECTION sous gizmo : objet/eau rendu DANS TransformControls (attaché → édition réelle). */}
      {(selectedObj || selectedWater) && (
        <TransformControls
          ref={transformRef} mode={gizmoMode} size={0.8}
          translationSnap={step ?? undefined}
          rotationSnap={step ? Math.PI / 12 : undefined}
          onMouseUp={commitTransform}
        >
          {/* key=selectedObjectId : la position de départ ne se ré-applique QU'au changement
              de sélection, pas pendant le drag (sinon React écrasait le gizmo → retour origine).
              Le commit se fait à la FIN du drag (onMouseUp), pas à chaque frame. */}
          <group
            key={selectedObjectId ?? "sel"}
            ref={selectedGroupRef}
            position={(selectedObj?.pos ?? selectedWater!.pos) as [number, number, number]}
            rotation={selectedObj ? selectedObj.rot : [0, selectedWater!.rotY, 0]}
            scale={(selectedObj?.scale ?? [1, 1, 1]) as [number, number, number]}
          >
            {selectedObj && <Suspense fallback={null}><MeshRenderer path={selectedObj.model} material={selectedObj.material} /></Suspense>}
            {selectedWater && (
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={selectedWater.size} />
                <meshStandardMaterial color={WATER_COLORS[selectedWater.kind]} transparent opacity={0.85} roughness={0.1} metalness={0.4} />
              </mesh>
            )}
          </group>
        </TransformControls>
      )}

      {/* `mousePos` non nul ⇒ il vient d'un `pickSurface` réussi, donc d'une vraie
          surface. Ce clic-ci court-circuitait `handleGroundClick` et posait
          directement à `mousePos` — quand celui-ci retombait sur y ≈ 0, c'était
          une quatrième porte d'entrée pour M1. Elle est fermée par la garde. */}
      {pendingAsset && mousePos && (
        <mesh position={mousePos} onClick={() => { onAddObject(pendingAsset, mousePos); onPlacementMode(false); }}>
          <boxGeometry args={[1, 1, 1]} />
          <meshStandardMaterial color="#4fc3f7" transparent opacity={0.3} wireframe />
        </mesh>
      )}

      {toolMode === 'spline' && (
        <group>
          <SplineTool points={splinePoints} onPointsChange={onSplinePointsChange} />
          {splinePoints.map((pt, i) => (
            <Html key={i} position={pt} distanceFactor={2}><div style={{ color: '#94a3b8', fontSize: 9 }}>Pt {i + 1}</div></Html>
          ))}
        </group>
      )}

      {/* En mode pinceau (terrain/végétation) : clic GAUCHE peint/disperse, rotation au clic DROIT. */}
      <OrbitControls makeDefault enableDamping dampingFactor={0.1} maxDistance={200} minDistance={1} target={[0, 1, 0]}
        mouseButtons={(toolMode === 'terrain' || toolMode === 'vegetation')
          ? { LEFT: undefined as unknown as THREE.MOUSE, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }
          : undefined} />
    </>
  );
}

// Objet sélectionnable : la hitbox de clic est en MONDE (frère du groupe visuel → pas de
// double transform), dimensionnée sur la bounding box réelle du modèle (sélection précise).
function SelectableObject({ obj, locked, onSelect }: { obj: ForgeObject; locked: boolean; onSelect: () => void }) {
  const groupRef = useRef<THREE.Group>(null);
  const [box, setBox] = useState<{ size: [number, number, number]; center: [number, number, number] } | null>(null);
  useEffect(() => {
    const g = groupRef.current;
    if (!g) return;
    const id = requestAnimationFrame(() => {
      g.updateMatrixWorld(true);
      const b = new THREE.Box3().setFromObject(g);
      if (b.isEmpty()) return;
      const s = new THREE.Vector3(); b.getSize(s);
      const c = new THREE.Vector3(); b.getCenter(c);
      setBox({ size: [Math.max(0.4, s.x), Math.max(0.4, s.y), Math.max(0.4, s.z)], center: [c.x, c.y, c.z] });
    });
    return () => cancelAnimationFrame(id);
  }, [obj.model, obj.pos, obj.scale, obj.rot]);
  return (
    <>
      <group ref={groupRef} position={obj.pos} rotation={obj.rot} scale={obj.scale}>
        <Suspense fallback={null}><MeshRenderer path={obj.model} material={obj.material} /></Suspense>
        {locked && <Html distanceFactor={6}><div style={{ fontSize: 10, color: '#ef5350' }}>🔒</div></Html>}
      </group>
      {/* Hitbox monde (invisible) — clic = sélection (sauf calque verrouillé). */}
      <mesh position={box?.center ?? obj.pos} visible={false} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <boxGeometry args={box?.size ?? [2, 2, 2]} />
        <meshBasicMaterial transparent opacity={0} />
      </mesh>
    </>
  );
}
