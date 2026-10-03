// ══════════════════════════════════════════════════════════════════════════════
// spells/SpellVFX.tsx — VFX d'un sort actif (sprite 2D billboard animé en 3D)
//
// • Précharge TOUTES les frames depuis spell.vfxPath ("#" = n° de frame)
// • Loader TOLÉRANT : ignore les frames manquantes (compte réel auto-détecté)
// • Anime réellement les frames (avant : seule la frame 1 s'affichait)
// • Billboard face caméra + déplacement projectile + fondu de fin de vie
// ══════════════════════════════════════════════════════════════════════════════

import { useRef, useEffect, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Trail } from "@react-three/drei";
import * as THREE from "three";
import type { SpellDef } from "./SpellDef";
import { ELEMENTS } from "../elements/elements";
import { npcRegistry } from "../npc/npcRegistry";

export interface ActiveSpell {
  id: string;
  spell: SpellDef;
  origin: THREE.Vector3;
  direction: THREE.Vector3;
  elapsed: number;
  hit: boolean;
  /** Sort CIBLÉ : id de l'ennemi à atteindre (le projectile suit sa position live). */
  targetId?: string;
  /** Dégâts pré-calculés appliqués à l'IMPACT (modèle différé pour le homing). */
  payloadDamage?: number;
}

interface SpellVFXProps {
  active: ActiveSpell;
  onExpire: (id: string) => void;
  /** Sort ciblé : appelé à l'impact avec (position, dégâts, rayon AoE). */
  onImpact?: (pos: THREE.Vector3, damage: number, aoeRadius: number) => void;
}

const LIFETIME = 2.5;
const FRAME_RATE = 14; // images/s de l'animation du sort
const TMP_HOMING = new THREE.Vector3(); // vecteur de travail homing (zéro alloc)

// ── Cache GLOBAL des frames par vfxPath (chargées UNE fois pour la session) ──
// Évite le freeze : avant, CHAQUE sort rechargeait 6-12 PNG depuis le disque puis
// les jetait → texture-thrashing GPU à chaque lancer. Ici : 1 chargement, partagé
// par toutes les instances, jamais disposé. Le Promise déduplique les chargements
// concurrents (10 ennemis lançant le même sort = 1 chargement, pas 10).
const FRAME_CACHE = new Map<string, THREE.Texture[]>();
const FRAME_LOADING = new Map<string, Promise<THREE.Texture[]>>();
const sharedLoader = new THREE.TextureLoader();

function getSpellFrames(vfxPath: string, vfxFrames: number): Promise<THREE.Texture[]> {
  const cached = FRAME_CACHE.get(vfxPath);
  if (cached) return Promise.resolve(cached);
  let p = FRAME_LOADING.get(vfxPath);
  if (!p) {
    p = new Promise((resolve) => {
      const max = Math.max(1, vfxFrames);
      const slots: (THREE.Texture | null)[] = new Array(max).fill(null);
      let pending = max;
      const done = () => {
        const ok = slots.filter((t): t is THREE.Texture => !!t);
        FRAME_CACHE.set(vfxPath, ok);
        FRAME_LOADING.delete(vfxPath);
        resolve(ok);
      };
      for (let i = 1; i <= max; i++) {
        const url = `/models/spells/${vfxPath.replace("#", String(i))}`;
        const at = i - 1;
        sharedLoader.load(
          url,
          (t) => { t.colorSpace = THREE.SRGBColorSpace; slots[at] = t; if (--pending === 0) done(); },
          undefined,
          () => { if (--pending === 0) done(); } // frame absente → ignorée
        );
      }
    });
    FRAME_LOADING.set(vfxPath, p);
  }
  return p;
}

export function SpellVFX({ active, onExpire, onImpact }: SpellVFXProps) {
  const meshRef = useRef<THREE.Mesh>(null);
  const [frames, setFrames] = useState<THREE.Texture[]>(() => FRAME_CACHE.get(active.spell.vfxPath) ?? []);
  const frameIdx = useRef(0);
  const frameTimer = useRef(0);
  const { camera } = useThree();

  const spell = active.spell;

  // ── Frames depuis le cache global (chargées une seule fois) ──────────────
  useEffect(() => {
    if (FRAME_CACHE.has(spell.vfxPath)) return; // déjà en cache → rien à faire
    let cancelled = false;
    getSpellFrames(spell.vfxPath, spell.vfxFrames).then((f) => { if (!cancelled && f.length) setFrames(f); });
    return () => { cancelled = true; }; // PAS de dispose : textures partagées/cachées
  }, [spell.vfxPath, spell.vfxFrames]);

  useFrame((_, dt) => {
    const mesh = meshRef.current;
    if (!mesh || frames.length === 0) return;

    active.elapsed += dt;
    if (active.elapsed > LIFETIME || active.hit) {
      onExpire(active.id);
      return;
    }

    // Billboard : toujours face caméra
    mesh.quaternion.copy(camera.quaternion);

    // ── Déplacement ──────────────────────────────────────────────────────────
    if (active.targetId) {
      // CIBLÉ (homing) : suit la position LIVE de l'ennemi jusqu'à l'impact.
      const target = npcRegistry.get(active.targetId);
      if (!target || !target.isAlive()) {
        // Cible morte/partie → impact au point courant (peut toucher en AoE).
        onImpact?.(mesh.position.clone(), active.payloadDamage ?? 0, spell.aoeRadius);
        active.hit = true;
        onExpire(active.id);
        return;
      }
      TMP_HOMING.copy(target.getPosition());
      TMP_HOMING.y += 1.0; // viser le buste
      TMP_HOMING.sub(mesh.position);
      const dist = TMP_HOMING.length();
      if (dist < 0.7) {
        // ARRIVÉE → dégâts à l'impact (modèle différé) + fin.
        onImpact?.(mesh.position.clone(), active.payloadDamage ?? 0, spell.aoeRadius);
        active.hit = true;
        onExpire(active.id);
        return;
      }
      mesh.position.addScaledVector(TMP_HOMING.divideScalar(dist), spell.speed * dt);
    } else if (spell.speed > 0) {
      // DIRECTIONNEL : avance tout droit le long de la direction de tir.
      mesh.position.addScaledVector(active.direction, spell.speed * dt);
    }

    // Avance de frame
    frameTimer.current += dt;
    if (frameTimer.current > 1 / FRAME_RATE) {
      frameTimer.current = 0;
      frameIdx.current = (frameIdx.current + 1) % frames.length;
    }

    const mat = mesh.material as THREE.MeshBasicMaterial;
    mat.map = frames[frameIdx.current];
    const life = active.elapsed / LIFETIME;
    mat.opacity = Math.max(0, 1 - life * life);
    mat.needsUpdate = true;
  });

  if (frames.length === 0) return null;

  // Couleur du trail = couleur émissive de l'élément du sort (feu = orange, etc.)
  const trailColor = ELEMENTS[spell.element]?.emissive ?? "#ffffff";
  const isProjectile = spell.speed > 0;

  return (
    <>
      {/* Trail lumineux : montre la TRAJECTOIRE du projectile jusqu'à l'impact.
          Uniquement pour les sorts à distance (qui se déplacent). */}
      {isProjectile && (
        <Trail
          target={meshRef}
          width={1.6}
          length={6}
          color={trailColor}
          attenuation={(w) => w * w}
          decay={1}
        />
      )}
      <mesh ref={meshRef} position={active.origin.clone()}>
        <planeGeometry args={[2.5, 2.5]} />
        <meshBasicMaterial map={frames[0]} transparent depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
