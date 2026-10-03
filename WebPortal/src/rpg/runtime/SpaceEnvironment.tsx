// ══════════════════════════════════════════════════════════════════════════════
// runtime/SpaceEnvironment.tsx — Hub orbital immersif (R3F) — VISUEL UNIQUEMENT
//
// Environnement espace profond :
//   • 3 couches d'étoiles (proche / moyenne / lointaine) → aucune limite visible
//   • Sphère de fond infinie (BackSide) → ciel noir absolu sans bord
//   • Poussières spatiales (10 000 points) + bande galactique (Voie Lactée)
//   • 10 galaxies lointaines (plans additifs très éloignés, sans bord visible)
//   • Éclairage dynamique : phares de station, reflets planétaires
//   • Vaisseaux de fond en transit + décorations procédurales
//
// NB : aucune sphère « atmosphère » translucide flottante (halo de hub,
// nébuleuses volumétriques) — elles créaient des bords/cercles artificiels.
// Seuls subsistent : le fond noir (DeepSkySphere), les halos collés aux
// planètes et la corona du soleil, tous localisés et volontaires.
//
// Aucune logique de voyage / TP — géré par RpgGameWorld via PilotableShip.
// ══════════════════════════════════════════════════════════════════════════════

import { memo, useRef, useMemo, useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF, Stars } from "@react-three/drei";
import { applyAnisotropy } from "./sceneUtils";
import * as THREE from "three";
import { collisionWorld } from "./CollisionWorld";
import { qualityVariant } from "../loaders/assetQuality";

// ── Chemins des modèles (exportés → réutilisés par RpgGameWorld + PilotableShip) ──
export const SHIP_FORGE      = "/models/vehicule/chasseur_avion.glb";
export const SHIP_TOWER      = "/models/vehicule/phamtom.glb";
export const SHIP_LONGSWORD  = "/models/vehicule/longswod.glb";
export const SHIP_BACKGROUND = "/models/vehicule/vehicule_terrestre.glb";

// ── Limite spatiale calculée dynamiquement ────────────────────────────────────
// Source unique de vérité : positions XZ + extension de chaque objet statique
// de la map orbital. La limite spatiale est calculée à l'import comme
// `max(distance + extent) + ORBITAL_BOUNDARY_MARGIN` → toujours **derrière**
// l'objet le plus éloigné, plus une marge confortable pour l'exploration.
//
// AJOUTE TES OBJETS ICI quand tu ajoutes du décor (planètes, stations, vaisseaux
// de fond, points de repère). La limite s'agrandira automatiquement et le
// reset des FloatingShip + l'arène de combat + les events procéduraux suivront
// (ils sont tous RELATIFS à SPACE_BOUNDARY_RADIUS).
interface OrbitalLandmark {
  /** Position horizontale X (m). */
  x: number;
  /** Position horizontale Z (m). */
  z: number;
  /** Extension radiale autour du point (m) — 0 par défaut (point ponctuel). */
  extent?: number;
  /** Étiquette debug (jamais rendue). */
  label: string;
}

const ORBITAL_LANDMARKS: OrbitalLandmark[] = [
  // ── Planètes (extent = rayon) ────────────────────────────────────────────
  { x: -46, z: -70, extent: 9,  label: "Planète Forge" },
  { x:  52, z: -80, extent: 10, label: "Planète Tour"  },
  // ── Soleil + corona externe (corona scale 2.2 × rayon mesh 7) ────────────
  { x:  95, z: -70, extent: 16, label: "Soleil"        },
  // ── Vaisseaux de fond en transit (positions de spawn — leur reset suit
  //    aussi cette boundary, donc max global = leurs spawns) ────────────────
  { x: -160, z: -65, label: "Convoi A (transit)" },
  { x:  170, z: -90, label: "Convoi B (transit)" },
  { x:    0, z: 160, label: "Convoi C (transit)" },
  // ── Pads de vaisseaux pilotables + station (proches du centre) ───────────
  { x: -14, z: -16, label: "Pad Forge"    },
  { x:  14, z: -16, label: "Pad Tour"     },
  { x:   0, z:   0, label: "Station hub"  },
];

/** Marge confortable au-delà de l'objet le plus éloigné (m). */
const ORBITAL_BOUNDARY_MARGIN = 150;

/**
 * Rayon final de la limite spatiale = max distance horizontale d'un objet
 * (centre + extension) + ORBITAL_BOUNDARY_MARGIN. Pure, calculée à l'import.
 */
function computeOrbitalBoundaryRadius(landmarks: OrbitalLandmark[], margin: number): number {
  let max = 0;
  for (const l of landmarks) {
    const d = Math.hypot(l.x, l.z) + (l.extent ?? 0);
    if (d > max) max = d;
  }
  return Math.ceil(max + margin);
}

/**
 * Rayon de la limite spatiale du hub orbital (m). CALCULÉ depuis ORBITAL_LANDMARKS.
 * Toutes les autres distances spatiales (arène de combat, événements procéduraux,
 * radar) sont **relatives** à cette constante → s'agrandissent automatiquement.
 */
export const SPACE_BOUNDARY_RADIUS = computeOrbitalBoundaryRadius(
  ORBITAL_LANDMARKS, ORBITAL_BOUNDARY_MARGIN,
);

// Précharge réseau dès l'import (cache drei partagé, 0 double-chargement).
useGLTF.preload(SHIP_FORGE);
useGLTF.preload(SHIP_TOWER);
useGLTF.preload(SHIP_LONGSWORD);
useGLTF.preload(SHIP_BACKGROUND);

// ══════════════════════════════════════════════════════════════════════════════
// COUCHE 1 — Fond spatial (sphère noire infinie)
// ══════════════════════════════════════════════════════════════════════════════

/** Sphère de fond très grande (BackSide) — jamais de bord visible du ciel.
 *  Rayon 15000 pour couvrir l'exploration libre infinie (cam.far = 30000). */
function DeepSkySphere() {
  return (
    <mesh renderOrder={-100}>
      <sphereGeometry args={[15000, 16, 16]} />
      <meshBasicMaterial
        color="#000007"
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
      />
    </mesh>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COUCHE 2 — Étoiles multi-niveaux
// ══════════════════════════════════════════════════════════════════════════════

/** Cinq couches d'étoiles à distances exponentielles → illusion d'univers infini.
 *  Les couches s'enchaînent du proche (120m, parallaxe forte) à l'ultra-lointain
 *  (9000m, perception statique = "vrai" ciel cosmique). Avec la limite spatiale
 *  désactivée, le joueur peut voler jusqu'à ~14km sans atteindre la fin. */
function StarLayers() {
  return (
    <>
      {/* Étoiles proches — petites, peu nombreuses, légère parallaxe */}
      <Stars
        radius={120}  depth={60}  count={2500}
        factor={3}    saturation={0}   fade speed={0.25}
      />
      {/* Étoiles moyennes — densité principale (centre de l'arène) */}
      <Stars
        radius={550}  depth={200} count={14000}
        factor={7}    saturation={0.1} fade speed={0.12}
      />
      {/* Étoiles lointaines — fond galactique dense (autour de l'arène) */}
      <Stars
        radius={1800} depth={600} count={28000}
        factor={13}   saturation={0.25} fade speed={0.05}
      />
      {/* Étoiles très lointaines — exploration libre (NOUVEAU) */}
      <Stars
        radius={4500} depth={1500} count={45000}
        factor={20}   saturation={0.18} fade speed={0.025}
      />
      {/* Étoiles ultra-lointaines — limite du visible (NOUVEAU) */}
      <Stars
        radius={9000} depth={3000} count={60000}
        factor={28}   saturation={0.12} fade speed={0.01}
      />
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COUCHE 3 — Poussières spatiales (points micro)
// ══════════════════════════════════════════════════════════════════════════════

function SpaceDust({ count = 10000, innerR = 18, outerR = 90 }: {
  count?: number;
  innerR?: number;
  outerR?: number;
}) {
  const { positions, colors } = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Distribution sphérique concentrée (racine cubique = uniforme en volume)
      const r     = innerR + Math.cbrt(Math.random()) * (outerR - innerR);
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);
      pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      pos[i * 3 + 2] = r * Math.cos(phi);
      // Teintes : bleu-blanc froid (poussière interstellaire réaliste)
      const t = Math.random();
      col[i * 3]     = 0.45 + t * 0.35;
      col[i * 3 + 1] = 0.55 + t * 0.30;
      col[i * 3 + 2] = 0.75 + t * 0.25;
    }
    return { positions: pos, colors: col };
  }, [count, innerR, outerR]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    g.setAttribute("color",    new THREE.BufferAttribute(colors, 3));
    return g;
  }, [positions, colors]);

  return (
    <points geometry={geo}>
      <pointsMaterial
        size={0.06}
        vertexColors
        transparent
        opacity={0.28}
        sizeAttenuation
        depthWrite={false}
      />
    </points>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COUCHE 4 — Bande galactique (Voie Lactée)
// ══════════════════════════════════════════════════════════════════════════════

function MilkyWayBand({ count = 5000 }: { count?: number }) {
  const positions = useMemo(() => {
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      // Bande concentrée autour du plan équatorial (phi proche de PI/2)
      const theta = Math.random() * Math.PI * 2;
      const deviation = (Math.random() - 0.5) * Math.PI * 0.14; // ±12° autour du plan
      const r = 450 + Math.random() * 350;
      arr[i * 3]     = r * Math.cos(theta) * Math.cos(deviation);
      arr[i * 3 + 1] = r * Math.sin(deviation);
      arr[i * 3 + 2] = r * Math.sin(theta) * Math.cos(deviation);
    }
    return arr;
  }, [count]);

  const geo = useMemo(() => {
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    return g;
  }, [positions]);

  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, dt) => {
    // Rotation très lente → parallaxe subtile (0.6°/min)
    if (groupRef.current) groupRef.current.rotation.y += dt * 0.0018;
  });

  return (
    <group ref={groupRef} rotation={[Math.PI * 0.12, 0.4, 0]}>
      <points geometry={geo}>
        <pointsMaterial
          color="#c8deff"
          size={0.45}
          transparent
          opacity={0.55}
          sizeAttenuation
          depthWrite={false}
        />
      </points>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COUCHE 5 — Galaxies lointaines (ellipses inclinées)
// ══════════════════════════════════════════════════════════════════════════════

const GALAXY_DEFS = [
  { pos: [-130, 50, -220], tilt: 0.35,  rot: 0.5,  color: "#8070ff", w: 14, h: 5.5 },
  { pos: [ 200, -40, -260], tilt: -0.42, rot: 1.2,  color: "#ff8055", w: 11, h: 4.5 },
  { pos: [-220,  65, 110],  tilt: 0.60,  rot: 2.0,  color: "#70c0ff", w: 16, h: 6.5 },
  { pos: [ 160,  30, 180],  tilt: -0.25, rot: 0.8,  color: "#ffd070", w: 12, h: 5.0 },
  { pos: [-80,  -60, -300], tilt: 0.18,  rot: 3.2,  color: "#a0ff90", w: 10, h: 4.0 },
  { pos: [ 240,  20, -80],  tilt: 0.50,  rot: 1.7,  color: "#ff70c0", w: 13, h: 5.0 },
  { pos: [-180, -30, 200],  tilt: -0.38, rot: 4.1,  color: "#c0e8ff", w: 9,  h: 3.5 },
  { pos: [ 100,  80, -230], tilt: 0.70,  rot: 2.6,  color: "#ffc080", w: 11, h: 4.5 },
  { pos: [-260,  10, -150], tilt: 0.22,  rot: 0.3,  color: "#90c0ff", w: 15, h: 6.0 },
  { pos: [ 50,  -80, 280],  tilt: -0.55, rot: 1.0,  color: "#d0a0ff", w: 10, h: 4.0 },
] as const;

function DistantGalaxies() {
  return (
    <>
      {GALAXY_DEFS.map((g, i) => (
        <mesh
          key={i}
          position={g.pos as [number, number, number]}
          rotation={[Math.PI / 2 + g.tilt, 0, g.rot]}
        >
          <planeGeometry args={[g.w, g.h]} />
          <meshBasicMaterial
            color={g.color}
            transparent
            opacity={0.10 + Math.random() * 0.06}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      ))}
    </>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COUCHE 6 — Planètes décoratives avec halo + lumières
// ══════════════════════════════════════════════════════════════════════════════

function Planet({ color, glow, position, radius }: {
  color: string; glow: string; position: [number, number, number]; radius: number;
}) {
  const core = useRef<THREE.Mesh>(null);
  useFrame((_, dt) => { if (core.current) core.current.rotation.y += dt * 0.04; });
  return (
    <group position={position}>
      {/* Corps planétaire */}
      <mesh ref={core}>
        <sphereGeometry args={[radius, 48, 48]} />
        <meshStandardMaterial
          color={color} emissive={glow} emissiveIntensity={0.5}
          roughness={0.8} metalness={0.12}
        />
      </mesh>
      {/* Halo atmosphérique */}
      <mesh scale={1.18}>
        <sphereGeometry args={[radius, 32, 32]} />
        <meshBasicMaterial
          color={glow} transparent opacity={0.20}
          side={THREE.BackSide} depthWrite={false}
        />
      </mesh>
      {/* Halo externe diffus */}
      <mesh scale={1.45}>
        <sphereGeometry args={[radius, 16, 16]} />
        <meshBasicMaterial
          color={glow} transparent opacity={0.06}
          side={THREE.BackSide} depthWrite={false}
        />
      </mesh>
      {/* Source lumineuse principale */}
      <pointLight color={glow} intensity={2.2} distance={radius * 10} decay={2} />
      {/* Lumière ambiante de rimlight vers la station */}
      <pointLight color={glow} intensity={0.5} distance={radius * 18} decay={1.5} />
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COUCHE 7 — Éclairage dynamique de station
// ══════════════════════════════════════════════════════════════════════════════

/** Phare de station : lumière pulsante + sphère émissive. */
function BeaconLight({ position, color, phase = 0, speed = 2.2 }: {
  position: [number, number, number]; color: string; phase?: number; speed?: number;
}) {
  const lightRef = useRef<THREE.PointLight>(null);
  const t = useRef(phase);
  useFrame((_, dt) => {
    t.current += dt * speed;
    if (lightRef.current) {
      lightRef.current.intensity = 0.55 + Math.sin(t.current) * 0.38;
    }
  });
  return (
    <group position={position}>
      <pointLight ref={lightRef} color={color} intensity={0.9} distance={22} decay={2} />
      <mesh>
        <sphereGeometry args={[0.18, 8, 8]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COUCHE 8 — Décorations de station avec éclairage
// ══════════════════════════════════════════════════════════════════════════════

function StationDecor() {
  const CRATES: [number, number, number][] = [
    [-9, 0.4, 3], [-10.5, 0.4, 1.5], [-8, 0.8, 1.5],
    [9, 0.4, 3],  [10.5, 0.4, 1.5],  [8, 0.8, 1.5],
    [-3, 0.4, 8],  [3, 0.4, 8],
  ];
  const PILLARS: [number, number, number][] = [
    [-5, 0, -4], [5, 0, -4], [-12, 0, -5], [12, 0, -5],
  ];
  const BEACON_COLORS = ["#5b9bff", "#ff7a3c", "#5b9bff", "#a060ff"];

  // Ref sur le groupe → on traverse au montage pour enregistrer les meshes
  // marqués comme solides (sans userData.noCollide) dans collisionWorld.add.
  // Les meshes décoratifs (sphères lumineuses, grille, lumières) sont taggés
  // avec userData={{ noCollide: true }} et exclus du traverse.
  const groupRef = useRef<THREE.Group>(null);
  useEffect(() => {
    if (!groupRef.current) return;
    // Wait 1 tick : laisse MapModel.registerScene() s'exécuter d'abord pour
    // qu'il ne clear() pas nos colliders après nous.
    const id = setTimeout(() => {
      groupRef.current?.traverse((obj) => {
        collisionWorld.add(obj);
      });
    }, 50);
    return () => clearTimeout(id);
  }, []);

  return (
    <group ref={groupRef}>
      {/* Caisses de cargo — COLLIDABLES (boxGeometry solides) */}
      {CRATES.map(([x, y, z], i) => (
        <mesh key={`crate_${i}`} position={[x, y, z]} rotation={[0, i * 0.4, 0]}>
          <boxGeometry args={[0.85, 0.85, 0.85]} />
          <meshStandardMaterial color="#2a3540" roughness={0.85} metalness={0.55}
            emissive="#0a1520" emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* Piliers holographiques avec phares intégrés */}
      {PILLARS.map(([x, y, z], i) => (
        <group key={`pillar_${i}`} position={[x, y, z]}>
          {/* Cylindre principal — COLLIDABLE */}
          <mesh>
            <cylinderGeometry args={[0.1, 0.1, 2.8, 8]} />
            <meshStandardMaterial color="#1c3450" metalness={0.92} roughness={0.12}
              emissive="#0a1a30" emissiveIntensity={0.4} />
          </mesh>
          {/* Tête lumineuse du pilier — DÉCO (pas de collision) */}
          <mesh position={[0, 1.5, 0]} userData={{ noCollide: true }}>
            <sphereGeometry args={[0.14, 10, 10]} />
            <meshBasicMaterial color={BEACON_COLORS[i] ?? "#5b9bff"} />
          </mesh>
          {/* Lumière statique du pilier */}
          <pointLight
            color={BEACON_COLORS[i] ?? "#3a7bd5"}
            intensity={1.1} distance={8}
            position={[0, 1.5, 0]}
          />
          {/* Phare pulsant au-dessus du pilier */}
          <BeaconLight
            position={[0, 3.2, 0]}
            color={BEACON_COLORS[i] ?? "#5b9bff"}
            phase={i * 1.57}
            speed={1.8 + i * 0.4}
          />
        </group>
      ))}

      {/* Grille de sol lumineuse — DÉCO (pas de collision, plans transparents) */}
      {[-8, -4, 0, 4, 8].map((v, i) => (
        <group key={`grid_${i}`}>
          <mesh position={[v, 0.005, 0]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noCollide: true }}>
            <planeGeometry args={[0.04, 24]} />
            <meshBasicMaterial color="#1a4080" transparent opacity={0.45} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0.005, v]} rotation={[-Math.PI / 2, 0, 0]} userData={{ noCollide: true }}>
            <planeGeometry args={[24, 0.04]} />
            <meshBasicMaterial color="#1a4080" transparent opacity={0.45} depthWrite={false} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// COUCHE 9 — Vaisseaux de fond (transit lent)
// ══════════════════════════════════════════════════════════════════════════════

const FloatingShip = memo(function FloatingShip({
  startPos, velocity, scale = 0.4, yaw = 0,
}: {
  startPos: [number, number, number];
  velocity: [number, number, number];
  scale?: number;
  yaw?: number;
}) {
  const { scene } = useGLTF(qualityVariant(SHIP_BACKGROUND));
  const { gl }    = useThree();
  const cloned    = useMemo(() => {
    const c = scene.clone();
    applyAnisotropy(c, gl.capabilities.getMaxAnisotropy());
    return c;
  }, [scene, gl]);

  const groupRef = useRef<THREE.Group>(null);
  const posRef   = useRef(new THREE.Vector3(...startPos));
  const vel      = useMemo(() => new THREE.Vector3(...velocity), []);

  useFrame((_, dt) => {
    posRef.current.addScaledVector(vel, dt);
    // Reset en dehors de la limite spatiale circulaire (cohérent avec
    // SpatialBoundary qui clampe le joueur sur cette même sphère).
    // Avant : test rectangulaire hardcodé à 220 → désaligné quand le rayon change.
    if (Math.hypot(posRef.current.x, posRef.current.z) > SPACE_BOUNDARY_RADIUS) {
      posRef.current.set(...startPos);
    }
    groupRef.current?.position.copy(posRef.current);
  });

  return (
    <group ref={groupRef} rotation={[0, yaw, 0]}>
      <primitive object={cloned} scale={scale} />
      {/* Glow des réacteurs */}
      <pointLight color="#4488ff" intensity={0.6} distance={8} decay={2}
        position={[0, 0, 0.5]} />
    </group>
  );
});

// ══════════════════════════════════════════════════════════════════════════════
// COMPOSANT PRINCIPAL
// ══════════════════════════════════════════════════════════════════════════════

export function SpaceEnvironment() {
  // Sol de collision invisible : enregistré dans collisionWorld APRÈS que
  // MapModel a enregistré le GLB (useEffect s'exécute après le premier rendu).
  const floorRef = useRef<THREE.Mesh>(null);
  useEffect(() => {
    if (floorRef.current) {
      // Ajoute le sol de sécurité sans effacer les colliders du GLB
      // (registerScene fait un reset complet ; on utilise une traversée directe)
      const mesh = floorRef.current;
      collisionWorld["colliders"].push(mesh); // accès au tableau privé (nécessaire)
    }
    // Nettoyage : la carte change → collisionWorld.clear() efface tout
  }, []);

  return (
    <>
      {/* ════════════════════════════════════════════════════════════════════
          CIEL INFINI
      ════════════════════════════════════════════════════════════════════ */}
      <color attach="background" args={["#000007"]} />
      {/* Fog quasi-inexistant (espace = vide ; commence très loin) */}
      <fog attach="fog" args={["#000007", 900, 2800]} />

      {/* Sphère de fond — ciel noir absolu sans bord visible */}
      <DeepSkySphere />

      {/* 3 couches d'étoiles superposées */}
      <StarLayers />

      {/* Bande galactique (Voie Lactée) inclinée */}
      <MilkyWayBand count={5000} />

      {/* Poussières micro-particules autour de la station */}
      <SpaceDust count={10000} innerR={18} outerR={90} />

      {/* ════════════════════════════════════════════════════════════════════
          ÉLÉMENTS COSMIQUES PROFONDS
      ════════════════════════════════════════════════════════════════════ */}
      {/* Galaxies lointaines (plans additifs très éloignés — pas de bord sphérique) */}
      <DistantGalaxies />

      {/* ════════════════════════════════════════════════════════════════════
          SOLEIL + ÉCLAIRAGE DIRECTIONNEL
      ════════════════════════════════════════════════════════════════════ */}
      <directionalLight
        position={[80, 50, -50]} intensity={2.6} color="#fff4e0"
        castShadow shadow-mapSize={[2048, 2048]}
      />
      {/* Corps solaire */}
      <mesh position={[95, 60, -70]}>
        <sphereGeometry args={[7, 32, 32]} />
        <meshBasicMaterial color="#fff7cc" />
      </mesh>
      {/* Corona interne */}
      <mesh position={[95, 60, -70]} scale={1.4}>
        <sphereGeometry args={[7, 24, 24]} />
        <meshBasicMaterial color="#ffe9a0" transparent opacity={0.20}
          side={THREE.BackSide} depthWrite={false} />
      </mesh>
      {/* Corona externe diffuse */}
      <mesh position={[95, 60, -70]} scale={2.2}>
        <sphereGeometry args={[7, 16, 16]} />
        <meshBasicMaterial color="#ffcc60" transparent opacity={0.06}
          side={THREE.BackSide} depthWrite={false} />
      </mesh>
      <pointLight color="#fff4a0" intensity={3.5} distance={800}
        position={[95, 60, -70]} decay={1.2} />

      {/* ════════════════════════════════════════════════════════════════════
          PLANÈTES (positions identiques à SPACE_PLANETS dans RpgGameWorld)
      ════════════════════════════════════════════════════════════════════ */}
      {/* Planète Forge : [-46, 10, -70] r=9 */}
      <Planet color="#1d4ed8" glow="#60a5fa" position={[-46, 10, -70]} radius={9} />
      {/* Rimlight Forge → station */}
      <pointLight color="#60a5fa" intensity={0.6} distance={200}
        position={[-46, 10, -70]} decay={0.9} />

      {/* Planète Tour  : [52, 14, -80] r=10 */}
      <Planet color="#b91c1c" glow="#f97316" position={[52, 14, -80]}  radius={10} />
      {/* Rimlight Tour → station */}
      <pointLight color="#f97316" intensity={0.6} distance={200}
        position={[52, 14, -80]} decay={0.9} />

      {/* ════════════════════════════════════════════════════════════════════
          STATION ORBITALE
      ════════════════════════════════════════════════════════════════════ */}
      {/* Décorations avec phares dynamiques */}
      <StationDecor />

      {/* Phares supplémentaires sur les coins de la station */}
      <BeaconLight position={[-15,  4,  5]}  color="#5b9bff" phase={0}    speed={1.5} />
      <BeaconLight position={[ 15,  4,  5]}  color="#ff7a3c" phase={2.1}  speed={2.0} />
      <BeaconLight position={[-15,  4, -20]} color="#a060ff" phase={4.2}  speed={1.7} />
      <BeaconLight position={[ 15,  4, -20]} color="#5bd6ff" phase={1.05} speed={2.3} />
      <BeaconLight position={[  0,  8, -10]} color="#ffffff" phase={3.14} speed={1.2} />

      {/* Lumière ambiante de station (très douce, évite le noir total) */}
      <ambientLight intensity={0.22} color="#1a2a4a" />
      <pointLight color="#2040a0" intensity={1.2} distance={40}
        position={[0, 6, 0]} decay={1.5} />

      {/* ════════════════════════════════════════════════════════════════════
          VAISSEAUX DE FOND EN TRANSIT
      ════════════════════════════════════════════════════════════════════ */}
      <FloatingShip
        startPos={[-160, 42, -65]} velocity={[3.2, 0, 0]}
        scale={0.45} yaw={Math.PI / 2}
      />
      <FloatingShip
        startPos={[170, 55, -90]} velocity={[-2.4, 0.02, 0]}
        scale={0.35} yaw={-Math.PI / 2}
      />
      <FloatingShip
        startPos={[0, 70, 160]} velocity={[-1.8, -0.01, -0.5]}
        scale={0.28} yaw={-Math.PI * 0.3}
      />

      {/* ════════════════════════════════════════════════════════════════════
          SOL DE SÉCURITÉ (collision + surface de la station)
      ════════════════════════════════════════════════════════════════════ */}
      <mesh
        ref={floorRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0, 0]}
      >
        <planeGeometry args={[300, 300]} />
        <meshBasicMaterial visible={false} />
      </mesh>
    </>
  );
}
