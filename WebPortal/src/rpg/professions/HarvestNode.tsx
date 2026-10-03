// professions/HarvestNode.tsx — nœud de récolte interactif (arbre / rocher / buisson).
//
// Machine à états : alive → (coups) → depleting → depleted (base/souche) → respawn.
// Le visuel et l'animation d'épuisement dépendent du MÉTIER :
//   bûcheron → arbre qui bascule (fall)   · mineur → rocher qui rétrécit (shrink)
//   récolteur → buisson qui rétrécit (shrink).
// S'enregistre dans harvestRegistry (handle chop appelé par le mini-jeu). Détecte
// la proximité du joueur. Le gather (XP/ressource) est générique côté RpgGameWorld.
import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF, useTexture } from "@react-three/drei";
import * as THREE from "three";
import { collisionWorld } from "../runtime/CollisionWorld";
import { harvestRegistry, type ChopResult } from "./harvestRegistry";
import type { ProfessionId } from "./professionTypes";
import {
  TREE_MODELS, BUSH_MODELS, TREE_TARGET_HEIGHT, BUSH_TARGET_HEIGHT, pickHarvestModel,
  type HarvestModel,
} from "./harvestModelCatalog";

const FALL_DURATION = 1.1;
const RESPAWN_DELAY = 22;
const PROXIMITY = 3.4;

type NodeKind = "tree" | "rock" | "bush";
interface KindStyle { kind: NodeKind; hits: number; deplete: "fall" | "shrink"; }

/** Métier → apparence + résistance + animation d'épuisement. */
function styleFor(profession: ProfessionId): KindStyle {
  switch (profession) {
    case "mineur":    return { kind: "rock", hits: 5, deplete: "shrink" };
    case "recolteur": return { kind: "bush", hits: 3, deplete: "shrink" };
    default:          return { kind: "tree", hits: 4, deplete: "fall" }; // bûcheron
  }
}

interface Props {
  id: string;
  position: [number, number, number];
  profession: ProfessionId;
  rotation?: [number, number, number];
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  onProximity: (id: string, near: boolean) => void;
}

export function HarvestNode({ id, position, profession, rotation, onProximity }: Props) {
  // NB : `playerPosition` reste dans Props (passé par le parent) mais n'est plus lu ici —
  // la proximité est calculée par HarvestProximityTicker (un seul tick pour tous les nœuds).
  const style = styleFor(profession);
  // Modèle 3D choisi de façon déterministe par id (variété stable). Le mineur n'a
  // pas de modèle 3D (rocher procédural) → model null.
  const model = useMemo<HarvestModel | null>(() => {
    if (style.kind === "tree") return pickHarvestModel(TREE_MODELS, id);
    if (style.kind === "bush") return pickHarvestModel(BUSH_MODELS, id);
    return null;
  }, [style.kind, id]);
  const root = useRef<THREE.Group>(null);
  const body = useRef<THREE.Group>(null);  // partie récoltable : bascule (arbre) ou rétrécit (rocher/buisson)
  const phase = useRef<"alive" | "depleting" | "gone">("alive");
  const hits = useRef(style.hits);
  const animT = useRef(0);
  const respawnT = useRef(0);
  const shake = useRef(0);
  const nearRef = useRef(false);
  // onProximity capturé via ref (l'effet d'enregistrement ne re-run pas à chaque render →
  // évite une closure périmée dans setNear si le parent recrée le callback).
  const onProxRef = useRef(onProximity);
  onProxRef.current = onProximity;

  // Recale au sol au montage (nœuds rendus après l'assemblage de la map).
  useEffect(() => {
    const gy = collisionWorld.getGroundY(position[0], position[2], 300);
    if (gy !== null && root.current) root.current.position.y = gy;
  }, [position]);

  // Enregistrement (handle chop appelé par le mini-jeu via le registre).
  useEffect(() => {
    harvestRegistry.register({
      id, profession,
      getPosition: () => root.current?.position ?? new THREE.Vector3(position[0], position[1], position[2]),
      available: () => phase.current === "alive",
      chop: (quality: number): ChopResult => {
        if (phase.current !== "alive" || quality <= 0) return { struck: false, depleted: false };
        shake.current = 0.25;
        hits.current -= quality >= 0.6 ? 1 : 0.6;
        const depleted = hits.current <= 0;
        if (depleted) { phase.current = "depleting"; animT.current = 0; }
        return { struck: true, depleted };
      },
      // Proximité pilotée par le ticker central (HarvestProximityTicker) → edge-trigger ici.
      setNear: (near: boolean) => {
        if (near !== nearRef.current) { nearRef.current = near; onProxRef.current(id, near); }
      },
    });
    return () => harvestRegistry.unregister(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, profession]);

  // Proximité = ticker central (HarvestProximityTicker). Ici : SEULEMENT l'animation, et un
  // early-return quand le nœud est vivant ET au repos (shake terminé) → zéro travail/frame
  // pour les nœuds idle (le gros du coût à l'échelle).
  useFrame((_, dt) => {
    const b = body.current;
    if (phase.current === "alive") {
      if (shake.current > 0) {
        shake.current = Math.max(0, shake.current - dt);
        if (b) b.rotation.z = Math.sin(performance.now() * 0.05) * 0.06 * (shake.current / 0.25);
      } else if (b && b.rotation.z !== 0) {
        b.rotation.z = 0; // remet droit une fois après le shake
      }
      return; // vivant : pas de machine depleting/gone à faire tourner
    }
    if (phase.current === "depleting") {
      animT.current += dt;
      const t = Math.min(1, animT.current / FALL_DURATION);
      if (b) {
        if (style.deplete === "fall") b.rotation.z = -(t * t) * (Math.PI / 2); // bascule, ease-in
        else { const s = Math.max(0.001, 1 - t); b.scale.setScalar(s); }       // rétrécit
      }
      if (t >= 1) {
        phase.current = "gone";
        respawnT.current = RESPAWN_DELAY;
        if (b) b.visible = false;
        if (nearRef.current) { nearRef.current = false; onProximity(id, false); }
      }
    } else { // gone
      respawnT.current -= dt;
      if (respawnT.current <= 0) {
        phase.current = "alive";
        hits.current = style.hits;
        if (b) { b.visible = true; b.rotation.z = 0; b.scale.setScalar(1); }
      }
    }
  });

  return (
    <group ref={root} position={position} rotation={rotation}>
      {style.kind === "tree" && <TreeVisual bodyRef={body} model={model} />}
      {style.kind === "rock" && <RockVisual bodyRef={body} />}
      {style.kind === "bush" && <BushVisual bodyRef={body} model={model} />}
    </group>
  );
}

// ── Modèle GLB normalisé + texturé (hauteur cible + base recalée à y=0) ──────────
// Les GLB retro n'ont aucun matériau/texture (juste des UV) → on applique la texture
// d'été externe sur un MeshStandardMaterial (alphaTest pour les découpes de feuillage).
// La normalisation par bounding-box rend le rendu robuste à l'échelle source du pack ;
// recaler la base à y=0 fait pivoter la chute (arbre) depuis le pied.
function GlbHarvestModel({ model, targetHeight }: { model: HarvestModel; targetHeight: number }) {
  const { scene } = useGLTF(model.glb);
  const texture = useTexture(model.tex);
  const { object, scale, baseY } = useMemo(() => {
    // Convention glTF : UV origine en haut → flipY=false ; couleur → sRGB.
    texture.flipY = false;
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.needsUpdate = true;
    const mat = new THREE.MeshStandardMaterial({
      map: texture, roughness: 1, metalness: 0, alphaTest: 0.5, side: THREE.DoubleSide,
    });
    const c = scene.clone(true);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) { m.castShadow = true; m.receiveShadow = true; m.material = mat; }
    });
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(0.001, box.max.y - box.min.y);
    const s = targetHeight / h;
    return { object: c, scale: s, baseY: -box.min.y * s };
  }, [scene, texture, targetHeight]);
  return <primitive object={object} scale={scale} position={[0, baseY, 0]} />;
}

// ── Apparences ────────────────────────────────────────────────────────────────
// Arbre : souche procédurale (reste après la chute) + GLB qui bascule depuis sa base.
// Repli sur l'ancien feuillage procédural si aucun modelPath (sécurité).
function TreeVisual({ bodyRef, model }: { bodyRef: React.RefObject<THREE.Group>; model: HarvestModel | null }) {
  return (
    <>
      {/* souche (reste après la chute) */}
      <mesh position={[0, 0.2, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.34, 0.4, 0.4, 10]} />
        <meshStandardMaterial color="#5a3f22" roughness={1} />
      </mesh>
      {/* arbre : pivote depuis la base (y=0) pour tomber */}
      <group ref={bodyRef}>
        {model ? (
          <GlbHarvestModel model={model} targetHeight={TREE_TARGET_HEIGHT} />
        ) : (
          <>
            <mesh position={[0, 1.4, 0]} castShadow>
              <cylinderGeometry args={[0.26, 0.32, 2.6, 10]} />
              <meshStandardMaterial color="#6b4a2b" roughness={1} />
            </mesh>
            <mesh position={[0, 3.0, 0]} castShadow>
              <coneGeometry args={[1.5, 2.4, 12]} />
              <meshStandardMaterial color="#2f6b3a" roughness={0.9} />
            </mesh>
            <mesh position={[0, 4.0, 0]} castShadow>
              <coneGeometry args={[1.05, 1.7, 12]} />
              <meshStandardMaterial color="#377a44" roughness={0.9} />
            </mesh>
          </>
        )}
      </group>
    </>
  );
}

function RockVisual({ bodyRef }: { bodyRef: React.RefObject<THREE.Group> }) {
  return (
    <>
      {/* socle de pierre (reste après extraction) */}
      <mesh position={[0, 0.12, 0]} receiveShadow>
        <cylinderGeometry args={[0.9, 1.0, 0.24, 8]} />
        <meshStandardMaterial color="#4a4f57" roughness={1} />
      </mesh>
      {/* amas de minerai (rétrécit à l'épuisement) */}
      <group ref={bodyRef}>
        <mesh position={[0, 0.7, 0]} castShadow>
          <icosahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial color="#7d848d" roughness={0.85} metalness={0.25} flatShading />
        </mesh>
        <mesh position={[0.55, 0.45, 0.2]} castShadow>
          <icosahedronGeometry args={[0.42, 0]} />
          <meshStandardMaterial color="#8a9aa6" roughness={0.7} metalness={0.45} flatShading />
        </mesh>
        <mesh position={[-0.45, 0.4, -0.25]} castShadow>
          <icosahedronGeometry args={[0.36, 0]} />
          <meshStandardMaterial color="#6f93a6" roughness={0.6} metalness={0.5} flatShading />
        </mesh>
      </group>
    </>
  );
}

function BushVisual({ bodyRef, model }: { bodyRef: React.RefObject<THREE.Group>; model: HarvestModel | null }) {
  return (
    <>
      {/* terre (reste après cueillette) */}
      <mesh position={[0, 0.05, 0]} receiveShadow>
        <cylinderGeometry args={[0.6, 0.65, 0.1, 10]} />
        <meshStandardMaterial color="#4a3a26" roughness={1} />
      </mesh>
      {/* buisson GLB (rétrécit à l'épuisement) — repli procédural si pas de modèle */}
      <group ref={bodyRef}>
        {model ? (
          <GlbHarvestModel model={model} targetHeight={BUSH_TARGET_HEIGHT} />
        ) : (
          <>
            <mesh position={[0, 0.4, 0]} castShadow>
              <icosahedronGeometry args={[0.5, 0]} />
              <meshStandardMaterial color="#3f8c4a" roughness={0.95} flatShading />
            </mesh>
            <mesh position={[0.32, 0.55, 0.1]} castShadow>
              <icosahedronGeometry args={[0.3, 0]} />
              <meshStandardMaterial color="#4fae5c" roughness={0.95} flatShading />
            </mesh>
            <mesh position={[-0.25, 0.5, -0.15]} castShadow>
              <sphereGeometry args={[0.12, 8, 8]} />
              <meshStandardMaterial color="#d97fe0" emissive="#5a2f60" emissiveIntensity={0.3} roughness={0.6} />
            </mesh>
          </>
        )}
      </group>
    </>
  );
}
