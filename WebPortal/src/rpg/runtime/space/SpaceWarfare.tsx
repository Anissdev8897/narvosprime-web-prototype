// WebPortal/src/rpg/runtime/space/SpaceWarfare.tsx
import { useRef, useMemo, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SpaceWarfareDirector } from "./SpaceWarfareDirector";
import { eventBus } from "../core/EventBus";
import { FACTIONS } from "../../factions/factions";
import { SPACE_BOUNDARY_RADIUS } from "../SpaceEnvironment";

// Doit rester ≥ à la taille du ProjectilePool créé par le director (80).
const PROJ_CAPACITY = 80;
const MAX_EXPLOSIONS = 16;

const _tmp = new THREE.Vector3();

// ── Modèle 3D de vaisseau spécifique par faction ──────────────────────────────
function SpaceShipModel({ faction }: { faction: string }) {
  const path = faction === "akarlys"
    ? "/models/vehicule/phamtom.glb"
    : faction === "mezalayis"
      ? "/models/vehicule/longswod.glb"
      : "/models/vehicule/chasseur_avion.glb";

  const scale = faction === "akarlys"
    ? 0.8
    : faction === "mezalayis"
      ? 0.4
      : 1.0;

  // Correction d'axe pour aligner le nez vers -Z
  const modelRotation: [number, number, number] = faction === "zayan"
    ? [0, -Math.PI / 2, 0]
    : [0, Math.PI / 2, 0];

  const { scene } = useGLTF(path);

  // Clone pour avoir des instances indépendantes (permet d'altérer les matériaux sans polluer le cache global)
  const cloned = useMemo(() => {
    const c = scene.clone();
    const colorHex = FACTIONS[faction]?.color ?? "#ffffff";
    const col = new THREE.Color(colorHex);

    c.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const m = child as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
        if (m.material) {
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          const newMats = mats.map((mat) => {
            const std = mat.clone() as THREE.MeshStandardMaterial;
            // On fait briller les réacteurs/parties lumineuses avec la couleur de la faction
            std.emissive = col;
            std.emissiveIntensity = 0.8;
            return std;
          });
          m.material = Array.isArray(m.material) ? newMats : newMats[0];
        }
      }
    });
    return c;
  }, [scene, faction]);

  return (
    <primitive
      object={cloned}
      scale={scale}
      rotation={modelRotation}
    />
  );
}

export function SpaceWarfare() {
  const director = useMemo(
    () => new SpaceWarfareDirector({
      factions: ["akarlys", "mezalayis", "zayan"],
      shipsPerFaction: 4,
      arenaRadius: SPACE_BOUNDARY_RADIUS * 0.85,
      respawnDelay: 6,
    }),
    [],
  );
  useEffect(() => () => director.dispose(), [director]);

  const slots = director.fleets;                       // longueur stable (slots réutilisés au respawn)
  const shipRefs = useRef<(THREE.Object3D | null)[]>([]);
  const projInst = useRef<THREE.InstancedMesh>(null);
  const exploRefs = useRef<(THREE.Mesh | null)[]>([]);
  const explosions = useRef<{ pos: THREE.Vector3; age: number; color: THREE.Color }[]>([]);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // Mort d'un vaisseau → file d'explosion (pas de re-render React)
  useEffect(() => {
    return eventBus.on("ship:destroyed", ({ pos, faction }) => {
      explosions.current.push({ pos: pos.clone(), age: 0, color: new THREE.Color(FACTIONS[faction].color) });
      if (explosions.current.length > MAX_EXPLOSIONS) explosions.current.shift();
    });
  }, []);

  useFrame((_, dt) => {
    const step = Math.min(dt, 0.05);
    director.update(step);

    // 1) Vaisseaux
    for (let i = 0; i < slots.length; i++) {
      const m = shipRefs.current[i];
      if (!m) continue;
      const c = slots[i].combatant;
      m.visible = c.alive;
      if (!c.alive) continue;
      m.position.copy(c.position);
      if (c.velocity.lengthSq() > 1e-4) { _tmp.copy(c.position).add(c.velocity); m.lookAt(_tmp); }
    }

    // 2) Projectiles (InstancedMesh)
    const inst = projInst.current;
    if (inst) {
      const active = director.projectiles.active;
      for (let i = 0; i < PROJ_CAPACITY; i++) {
        if (i < active.length && active[i].active) {
          dummy.position.copy(active[i].pos);
          dummy.scale.setScalar(active[i].kind === "missile" ? 1.6 : 1);
        } else {
          dummy.scale.setScalar(0);
        }
        dummy.updateMatrix();
        inst.setMatrixAt(i, dummy.matrix);
      }
      inst.instanceMatrix.needsUpdate = true;
    }

    // 3) Explosions (grossit + fondu)
    for (let i = 0; i < MAX_EXPLOSIONS; i++) {
      const m = exploRefs.current[i];
      if (!m) continue;
      const ex = explosions.current[i];
      if (!ex || ex.age >= 0.8) { m.visible = false; continue; }
      ex.age += dt;
      const t = ex.age / 0.8;
      m.visible = true;
      m.position.copy(ex.pos);
      m.scale.setScalar(1 + t * 6);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.color.copy(ex.color);
      mat.opacity = 0.6 * (1 - t);
    }
    explosions.current = explosions.current.filter((e) => e.age < 0.8);
  });

  return (
    <group>
      {/* Vaisseaux de combat — modèles 3D réels par faction */}
      {slots.map((s, i) => (
        <group key={i} ref={(el) => { shipRefs.current[i] = el; }}>
          <SpaceShipModel faction={s.combatant.faction} />
        </group>
      ))}

      {/* Projectiles (InstancedMesh, rendu additif) */}
      <instancedMesh ref={projInst} args={[undefined, undefined, PROJ_CAPACITY]}>
        <sphereGeometry args={[0.3, 6, 6]} />
        <meshBasicMaterial color="#fff2a0" toneMapped={false} />
      </instancedMesh>

      {/* Pool d'explosions */}
      {Array.from({ length: MAX_EXPLOSIONS }).map((_, i) => (
        <mesh key={`ex${i}`} ref={(el) => { exploRefs.current[i] = el; }} visible={false}>
          <sphereGeometry args={[1, 12, 12]} />
          <meshBasicMaterial transparent opacity={0} depthWrite={false}
            blending={THREE.AdditiveBlending} toneMapped={false} />
        </mesh>
      ))}
    </group>
  );
}

// Preload des vaisseaux de combat pour éviter le lag lors des combats spatiaux
useGLTF.preload("/models/vehicule/phamtom.glb");
useGLTF.preload("/models/vehicule/longswod.glb");
useGLTF.preload("/models/vehicule/chasseur_avion.glb");
