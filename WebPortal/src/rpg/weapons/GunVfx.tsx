// weapons/GunVfx.tsx — VFX pool pour les armes à feu : muzzle flash, tracer, impact.
//
// Singleton hors-React : les méthodes spawn* sont appelées depuis autoAttackRef.
// Le composant <GunVfxPool> se monte dans le Canvas et rend les instances actives.
import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

// ── Configuration ──────────────────────────────────────────────────────────────
const FLASH_POOL = 6;
const FLASH_DURATION = 0.06;
const TRACER_POOL = 8;
const TRACER_DURATION = 0.12;
const IMPACT_POOL = 8;
const IMPACT_DURATION = 0.2;

// ── Pool data (module-level, hors React) ───────────────────────────────────────
interface FlashSlot  { active: boolean; timer: number; pos: THREE.Vector3 }
interface TracerSlot { active: boolean; timer: number; from: THREE.Vector3; to: THREE.Vector3 }
interface ImpactSlot { active: boolean; timer: number; pos: THREE.Vector3 }

const flashes:  FlashSlot[]  = Array.from({ length: FLASH_POOL },  () => ({ active: false, timer: 0, pos: new THREE.Vector3() }));
const tracers:  TracerSlot[] = Array.from({ length: TRACER_POOL }, () => ({ active: false, timer: 0, from: new THREE.Vector3(), to: new THREE.Vector3() }));
const impacts:  ImpactSlot[] = Array.from({ length: IMPACT_POOL }, () => ({ active: false, timer: 0, pos: new THREE.Vector3() }));

function nextSlot<T extends { active: boolean; timer: number }>(pool: T[]): T | null {
  for (const s of pool) if (!s.active) return s;
  let oldest = pool[0]; for (const s of pool) if (s.timer < oldest.timer) oldest = s;
  return oldest;
}

export const gunVfx = {
  muzzleFlash(pos: THREE.Vector3) {
    const s = nextSlot(flashes); if (!s) return;
    s.active = true; s.timer = FLASH_DURATION; s.pos.copy(pos);
  },
  tracer(from: THREE.Vector3, to: THREE.Vector3) {
    const s = nextSlot(tracers); if (!s) return;
    s.active = true; s.timer = TRACER_DURATION; s.from.copy(from); s.to.copy(to);
  },
  impact(pos: THREE.Vector3) {
    const s = nextSlot(impacts); if (!s) return;
    s.active = true; s.timer = IMPACT_DURATION; s.pos.copy(pos);
  },
};

// ── R3F component — monte dans le Canvas ───────────────────────────────────────
export function GunVfxPool() {
  const flashMeshes  = useRef<(THREE.Mesh | null)[]>([]);
  const flashLights  = useRef<(THREE.PointLight | null)[]>([]);
  const tracerMeshes = useRef<(THREE.Mesh | null)[]>([]);
  const impactMeshes = useRef<(THREE.Mesh | null)[]>([]);

  useFrame((_, dt) => {
    for (let i = 0; i < FLASH_POOL; i++) {
      const s = flashes[i];
      if (!s.active) { hide(flashMeshes.current[i]); dimLight(flashLights.current[i]); continue; }
      s.timer -= dt;
      if (s.timer <= 0) { s.active = false; hide(flashMeshes.current[i]); dimLight(flashLights.current[i]); continue; }
      const t = s.timer / FLASH_DURATION;
      const m = flashMeshes.current[i];
      if (m) { m.visible = true; m.position.copy(s.pos); m.scale.setScalar(0.08 + 0.12 * t); }
      const l = flashLights.current[i];
      if (l) { l.position.copy(s.pos); l.intensity = 4 * t; }
    }
    for (let i = 0; i < TRACER_POOL; i++) {
      const s = tracers[i];
      const m = tracerMeshes.current[i];
      if (!s.active || !m) { hide(m); continue; }
      s.timer -= dt;
      if (s.timer <= 0) { s.active = false; hide(m); continue; }
      m.visible = true;
      positionTracer(m, s.from, s.to);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = s.timer / TRACER_DURATION;
    }
    for (let i = 0; i < IMPACT_POOL; i++) {
      const s = impacts[i];
      const m = impactMeshes.current[i];
      if (!s.active || !m) { hide(m); continue; }
      s.timer -= dt;
      if (s.timer <= 0) { s.active = false; hide(m); continue; }
      const t = 1 - s.timer / IMPACT_DURATION;
      m.visible = true;
      m.position.copy(s.pos);
      m.scale.setScalar(0.05 + 0.15 * t);
      const mat = m.material as THREE.MeshBasicMaterial;
      mat.opacity = 1 - t;
    }
  });

  return (
    <>
      {Array.from({ length: FLASH_POOL }, (_, i) => (
        <group key={`f${i}`}>
          <mesh ref={r => { flashMeshes.current[i] = r; }} visible={false}>
            <sphereGeometry args={[1, 6, 6]} />
            <meshBasicMaterial color="#ffe8a0" transparent opacity={0.9} depthWrite={false} />
          </mesh>
          <pointLight ref={r => { flashLights.current[i] = r; }} color="#ffd080" intensity={0} distance={5} decay={2} />
        </group>
      ))}
      {Array.from({ length: TRACER_POOL }, (_, i) => (
        <mesh key={`t${i}`} ref={r => { tracerMeshes.current[i] = r; }} visible={false}>
          <cylinderGeometry args={[0.008, 0.008, 1, 4]} />
          <meshBasicMaterial color="#a0d8ff" transparent opacity={0.7} depthWrite={false} />
        </mesh>
      ))}
      {Array.from({ length: IMPACT_POOL }, (_, i) => (
        <mesh key={`i${i}`} ref={r => { impactMeshes.current[i] = r; }} visible={false}>
          <sphereGeometry args={[1, 6, 6]} />
          <meshBasicMaterial color="#ffcc55" transparent opacity={0.8} depthWrite={false} />
        </mesh>
      ))}
    </>
  );
}

function hide(m: THREE.Mesh | null | undefined) { if (m) m.visible = false; }
function dimLight(l: THREE.PointLight | null | undefined) { if (l) l.intensity = 0; }

const _dir = new THREE.Vector3();
const _mid = new THREE.Vector3();
function positionTracer(mesh: THREE.Mesh, from: THREE.Vector3, to: THREE.Vector3) {
  _dir.subVectors(to, from);
  const len = _dir.length();
  _mid.addVectors(from, to).multiplyScalar(0.5);
  mesh.position.copy(_mid);
  mesh.scale.set(1, len, 1);
  mesh.lookAt(to);
  mesh.rotateX(Math.PI / 2);
}
