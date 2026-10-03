// ══════════════════════════════════════════════════════════════════════════════
// animation/useFbxAnimationPack.ts — Chargement d'un pack d'anims FBX (Mixamo).
//
// Charge une liste de FBX (via drei useFBX, comme HumanCharacter), extrait le clip
// de chaque fichier, retire le préfixe "mixamorig:" et le renomme par son action.
// Le résultat = AnimationClip[] directement consommables par AnimationController.
//
// Usage (dans un composant R3F monté sous <Canvas>) :
//   const clips = useFbxAnimationPack(MELEE_PACK);
//   // → new AnimationController(group, clips, { initial: "idle" })
// ══════════════════════════════════════════════════════════════════════════════

import { useMemo } from "react";
import { useLoader } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { FBXLoader } from "three-stdlib";
import type * as THREE from "three";
import { asAction, renameClip, bakeArmatureRotation } from "./mixamoRetarget";
import type { FbxAnimSpec } from "./animationPacks";

/**
 * Charge un pack FBX → AnimationClip[] nommés par action.
 * @param strip true (défaut) : retire le préfixe "mixamorig:" (rigs Meshy, os sans
 *   préfixe). false : garde le préfixe (rigs Mixamo natifs, ex: Sorcier).
 */
export function useFbxAnimationPack(specs: FbxAnimSpec[], strip = true): THREE.AnimationClip[] {
  const paths = useMemo(() => specs.map((s) => s.path), [specs]);
  // useLoader avec un tableau → un Group par fichier (chacun avec .animations).
  const loaded = useLoader(FBXLoader, paths) as unknown as THREE.Group[];

  return useMemo(() => {
    const groups = Array.isArray(loaded) ? loaded : [loaded];
    const out: THREE.AnimationClip[] = [];
    groups.forEach((g, i) => {
      const clip = g?.animations?.[0];
      const spec = specs[i];
      if (clip && spec) out.push(strip ? asAction(clip, spec.action) : renameClip(clip, spec.action));
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, strip]);
}

/** Préchargement (optionnel) — à appeler au boot pour éviter un hitch au 1er usage. */
export function preloadFbxPack(specs: FbxAnimSpec[]): void {
  for (const s of specs) useLoader.preload(FBXLoader, s.path);
}

// ══════════════════════════════════════════════════════════════════════════════
// Variante GLB (recommandée) — les packs convertis FBX→GLB se chargent via useGLTF.
// GLTFLoader est robuste (pas de "Unknown property type"), parse hors thread principal
// (pas de freeze), et préserve les anims. Même logique de strip/rename que la version FBX.
// ══════════════════════════════════════════════════════════════════════════════

/** Charge un pack GLB → AnimationClip[] nommés par action (skip les GLB sans anim).
 *  Pack vide (specs=[]) → useGLTF([]) retourne [] sans fetch. */
export function useGltfAnimationPack(specs: FbxAnimSpec[], strip = true): THREE.AnimationClip[] {
  const paths = useMemo(() => specs.map((s) => s.path), [specs]);
  const loaded = useGLTF(paths as string[]) as unknown as Array<{ animations: THREE.AnimationClip[]; scene?: THREE.Object3D }>;

  return useMemo(() => {
    const arr = Array.isArray(loaded) ? loaded : [loaded];
    const out: THREE.AnimationClip[] = [];
    arr.forEach((g, i) => {
      let clip = g?.animations?.[0];
      const spec = specs[i];
      if (!clip || !spec) return;
      if (strip) {
        // Rigs Meshy (strip) : si l'ARMATURE du pack est PIVOTÉE (conversion FBX→GLB +90° X),
        // on cuit sa rotation dans les pistes du root — sinon le squelette cible s'effondre
        // sous le sol (« monstre invisible »). Détection générique depuis la scène du pack.
        const arm = g.scene?.getObjectByName("Armature") ?? g.scene?.children?.[0];
        if (arm) clip = bakeArmatureRotation(clip, arm.quaternion);
        out.push(asAction(clip, spec.action));
      } else {
        out.push(renameClip(clip, spec.action));
      }
    });
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loaded, strip]);
}

/** Préchargement GLB (temps idle / boot). */
export function preloadGltfPack(specs: FbxAnimSpec[]): void {
  for (const s of specs) useGLTF.preload(s.path);
}
