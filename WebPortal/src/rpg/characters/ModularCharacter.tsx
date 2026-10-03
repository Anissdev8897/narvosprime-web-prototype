// ══════════════════════════════════════════════════════════════════════════════
// characters/ModularCharacter.tsx — Personnage modulaire assemblé (R3F)
//
// Assemble dynamiquement les parties (Body/Arms/Legs/Feet/Head/Shoulders) + arme,
// applique le thème de classe (couleur PBR + emissive glow) et joue l'idle.
//
// Modularité runtime : changer `config.parts` ou `config.theme` recharge
// uniquement la/les partie(s) concernée(s) (React reconcilie les <Part>).
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import type { CharacterConfig, EquipmentSlot } from "../types";
import { CLASSES } from "../classes/classes";
import {
  getModularPartPath,
  getWeaponPath,
  type OutfitTheme,
} from "../loaders/assetManifest";

// Tous les slots modulaires que getModularPartPath peut produire.
// Retourne null pour les slots non disponibles → filtrés ci-dessous.
const ALL_MODULAR_SLOTS: EquipmentSlot[] = [
  "body", "arms", "legs", "feet", "head", "shoulders",
];

interface ModularCharacterProps {
  config: CharacterConfig;
  theme?: OutfitTheme;
  /** Rotation Y continue (pour la prévisualisation tournante) */
  autoRotate?: boolean;
}

// ── Une partie modulaire (mesh skinné cloné + teinté) ─────────────────────────
//
// Matériaux Quaternius dans le GLTF :
//   MI_Ranger / MI_Peasant  → tenue  : reçoit la teinte de classe
//   MI_Regular_Female/Male  → peau   : garde la texture naturelle (pas de tint classe)
//
function Part({
  path,
  tint,
  emissive,
}: {
  path: string;
  tint: THREE.Color;
  emissive: THREE.Color;
}) {
  const { scene } = useGLTF(path);

  // Clone indépendant (useGLTF cache le scene globalement)
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  useEffect(() => {
    cloned.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;

      const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];

      const newMats = mats.map((m) => {
        const std = m as THREE.MeshStandardMaterial;
        // Clone pour ne pas polluer le cache global useGLTF
        const mat = std.clone();

        // Les matériaux de peau (MI_Regular_*) gardent leur texture naturelle —
        // ne PAS appliquer la teinte de classe dessus.
        const isSkin = std.name.toLowerCase().includes("regular");

        if (!isSkin) {
          // Tenue : teinte classe + léger glow emissive
          mat.color.lerp(tint, 0.5);
          if (mat.emissive) {
            mat.emissive.copy(emissive);
            mat.emissiveIntensity = 0.18;
          }
        } else {
          // Peau : couleur blanche = texture s'affiche telle quelle
          mat.color.set(1, 1, 1);
          mat.emissiveIntensity = 0;
        }

        mat.needsUpdate = true;
        return mat;
      });

      mesh.material = Array.isArray(mesh.material) ? newMats : newMats[0];
      mesh.castShadow = true;
      mesh.receiveShadow = true;
    });
  }, [cloned, tint, emissive]);

  return <primitive object={cloned} />;
}

// ── Arme tenue (GLB statique, sans skin) ──────────────────────────────────────
function Weapon({ path }: { path: string }) {
  const { scene } = useGLTF(path);
  const cloned = useMemo(() => scene.clone(), [scene]);
  // Position approximative dans la main droite (à ajuster via BoneAttachment futur)
  return <primitive object={cloned} position={[0.35, 1.0, 0.1]} scale={1} />;
}

// ══════════════════════════════════════════════════════════════════════════════
// Composant principal
// ══════════════════════════════════════════════════════════════════════════════

export function ModularCharacter({ config, theme = "Ranger", autoRotate = false }: ModularCharacterProps) {
  const group = useRef<THREE.Group>(null);
  const cls = CLASSES[config.classId];

  // Thème de couleur : override `tint` du config, sinon couleur de classe
  const tint = useMemo(
    () => new THREE.Color(config.tint ?? cls.outfitColor),
    [config.tint, cls.outfitColor]
  );
  const emissive = useMemo(() => new THREE.Color(cls.outfitEmissive), [cls.outfitEmissive]);

  // Résout les chemins des parties selon le thème + slots disponibles.
  // getModularPartPath retourne null pour les slots non supportés → filtrés.
  const partPaths = useMemo(() => {
    const paths: { slot: EquipmentSlot; path: string }[] = [];
    for (const slot of ALL_MODULAR_SLOTS) {
      const p = getModularPartPath(config.gender, theme, slot);
      if (p) paths.push({ slot, path: p });
    }
    return paths;
  }, [config.gender, theme]);

  // Chemin de l'arme de la classe
  const weaponPath = useMemo(() => getWeaponPath(cls.weaponKey), [cls.weaponKey]);

  // Auto-rotation pour la prévisualisation
  useEffect(() => {
    if (!autoRotate) return;
    let raf = 0;
    const rotate = () => {
      if (group.current) group.current.rotation.y += 0.005;
      raf = requestAnimationFrame(rotate);
    };
    raf = requestAnimationFrame(rotate);
    return () => cancelAnimationFrame(raf);
  }, [autoRotate]);

  return (
    <group ref={group} dispose={null}>
      {partPaths.map(({ slot, path }) => (
        <Part key={`${slot}-${path}`} path={path} tint={tint} emissive={emissive} />
      ))}
      {weaponPath && <Weapon path={weaponPath} />}
    </group>
  );
}

// Preload des tenues les plus communes (perf : évite le pop-in)
// Les parties Ranger sont les plus complètes (head + shoulders).
export function preloadCommonParts() {
  for (const gender of ["male", "female"] as const) {
    for (const slot of ALL_MODULAR_SLOTS) {
      const p = getModularPartPath(gender, "Ranger", slot);
      if (p) useGLTF.preload(p);
    }
  }
}
