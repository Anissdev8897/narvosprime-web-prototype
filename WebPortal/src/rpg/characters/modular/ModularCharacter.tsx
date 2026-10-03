// ══════════════════════════════════════════════════════════════════════════════
// characters/modular/ModularCharacter.tsx — Assemblage d'un personnage modulaire.
//
// Charge la pièce `body` (qui FOURNIT le squelette de référence), puis re-lie
// chaque autre pièce sur CE squelette. Résultat : un seul AnimationMixer pilote
// l'ensemble — corps, vêtements et accessoires bougent d'un bloc.
//
// Pourquoi le corps sert de référence : c'est la seule pièce toujours présente
// (REQUIRED_SLOTS) et la plus complète en os. Une veste n'a que 90 os ; en faire
// la référence amputerait le squelette des jambes.
// ══════════════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import { mapLoaderExtend } from "../../loaders/sharedLoaders";
import { getPart, type Gender, type ModularPart } from "./partCatalog";
import { resolveVisibleSlots, type BodySlot } from "./bodySlots";
import { rebindSkinnedMesh, collectSkinnedMeshes } from "./rebindSkinnedMesh";
import { isSkinSlot, prepareTintable, applyTint, isIrisMaterial } from "./skinTint";
import {
  PROPORTION_DEFS, sanitizeProportions, scaleFactor, type BodyProportions,
} from "./bodyProportions";

export interface ModularCharacterProps {
  gender: Gender;
  /** emplacement → id de pièce. Les emplacements absents ne sont pas rendus. */
  equipped: Partial<Record<BodySlot, string>>;
  /** Clips à jouer sur le squelette assemblé (déjà retargetés en amont). */
  clips?: THREE.AnimationClip[];
  initialClip?: string;
  scale?: number;
  /**
   * Épaisseur de la morphologie — largeur et profondeur, JAMAIS la hauteur.
   *
   * Les quatre morphologies partagent une seule géométrie (cf. `bodyArchetypes`) :
   * `girth` est ce qui les distingue à l'écran. Appliqué sur X et Z uniquement —
   * l'étirer aussi en Y donnerait un personnage plus grand, pas plus corpulent,
   * et casserait l'accord avec les métriques de gameplay (hauteur de saut, pas
   * franchissable) qui supposent une taille constante.
   *
   * 1 = inchangé. `BUILDS` va de 0,92 (maigre) à 1,22 (corpulent).
   */
  girth?: number;
  /** Réglages fins de silhouette (épaules, taille, bras). Absent = origine. */
  proportions?: BodyProportions;
  /** Teinte de PEAU (`#ffffff` = inchangée). N'affecte ni vêtements ni yeux. */
  skinTint?: string;
  /** Couleur des IRIS (`#ffffff` = inchangée). Indépendante de la peau. */
  eyeTint?: string;
}

export function ModularCharacter({ equipped, clips, initialClip, scale = 1, girth = 1, proportions, skinTint, eyeTint }: ModularCharacterProps) {
  const group = useRef<THREE.Group>(null);

  // Emplacements réellement rendus (masquages appliqués : gants > mains nues).
  const visible = useMemo(() => resolveVisibleSlots(equipped), [equipped]);

  const bodyId = equipped.body;
  const bodyPart = bodyId ? getPart(bodyId) : undefined;

  // Les autres pièces, dans l'ordre d'assemblage. L'EMPLACEMENT est conservé :
  // sans lui, impossible de savoir plus bas quelle pièce est de la peau.
  const otherParts = useMemo(() => {
    const out: { slot: BodySlot; part: ModularPart }[] = [];
    for (const slot of visible) {
      if (slot === "body") continue;
      const part = getPart(equipped[slot]!);
      if (part) out.push({ slot, part });
    }
    return out;
  }, [visible, equipped]);

  // UN SEUL appel useGLTF, sur un tableau : le nombre de pièces varie d'une
  // tenue à l'autre, un appel par pièce casserait l'ordre des hooks.
  const paths = useMemo(
    () => [bodyPart?.path, ...otherParts.map((e) => e.part.path)].filter(Boolean) as string[],
    [bodyPart, otherParts],
  );
  const gltfs = useGLTF(paths, true, true, mapLoaderExtend);

  // Assemblage : cloné à chaque changement de tenue (les scènes GLB sont
  // partagées via le cache de drei — muter l'original corromprait les autres
  // instances du même vêtement).
  const assembled = useMemo(() => {
    if (paths.length === 0 || gltfs.length === 0) return null;

    const bodyScene = SkeletonUtils.clone(gltfs[0].scene) as THREE.Object3D;
    const bodyMeshes = collectSkinnedMeshes(bodyScene);
    const skeleton = bodyMeshes[0]?.skeleton;
    if (!skeleton) {
      if (process.env.NODE_ENV !== "production") {
        console.warn("[ModularCharacter] pièce `body` sans squelette — assemblage annulé.");
      }
      return null;
    }

    const root = new THREE.Group();
    root.add(bodyScene);

    // Sous-arbres teintables : le corps + toute pièce d'anatomie. Les vêtements
    // et la chevelure en sont exclus — ils relèvent de `tint`, pas de `skinTint`.
    const skin: THREE.Object3D[] = [bodyScene];

    for (let i = 0; i < otherParts.length; i++) {
      const gltf = gltfs[i + 1];
      if (!gltf) continue;
      const { slot, part } = otherParts[i];
      const partScene = SkeletonUtils.clone(gltf.scene) as THREE.Object3D;
      const meshes = collectSkinnedMeshes(partScene);
      let anyBound = false;

      for (const m of meshes) {
        const res = rebindSkinnedMesh(m, skeleton);
        if (res.ok) { anyBound = true; continue; }
        // Une pièce incompatible est ÉCARTÉE plutôt qu'affichée déchirée.
        m.visible = false;
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            `[ModularCharacter] "${part.id}" non liée : ${res.reason}` +
            (res.unmatched.length ? ` (ex: ${res.unmatched.slice(0, 3).join(", ")})` : ""),
          );
        }
      }
      if (anyBound) {
        root.add(partScene);
        if (isSkinSlot(slot)) skin.push(partScene);
      }
    }

    // Clonage des matériaux DÈS l'assemblage, pas au premier changement de
    // teinte : `SkeletonUtils.clone` les laisse partagés avec le cache de
    // `useGLTF`, et la première écriture colorerait toutes les autres instances
    // du même GLB — y compris les PNJ du monde.
    for (const s of skin) prepareTintable(s);

    return { root, skin };
  }, [gltfs, paths.length, otherParts]);

  // Teintes séparées de l'assemblage : changer de pastille ne doit PAS
  // recharger les GLB ni relancer le remappage d'os.
  //
  // Deux passes distinctes sur LE MÊME sous-arbre, filtrées par nom de matériau :
  // le corps de base et ses yeux sont deux primitives d'un seul maillage. Sans
  // le filtre `except`, un teint sombre colorerait aussi les iris.
  useEffect(() => {
    if (!assembled) return;
    // `exceptMatch` et non `except: ["Eyes"]` : les corps Biker nomment l'iris
    // d'après leur fichier (`M_EyeRefractive_SK_ma_…`), donc aucune liste fixe
    // ne peut le viser. Sans ça, la teinte de peau colorait aussi les yeux.
    for (const s of assembled.skin) applyTint(s, skinTint ?? "#ffffff", { exceptMatch: isIrisMaterial });
  }, [assembled, skinTint]);

  useEffect(() => {
    if (!assembled) return;
    // `flat` : la teinte remplace la texture d'iris au lieu de la multiplier —
    // seule façon de colorer aussi la PUPILLE, noire dans la texture.
    for (const s of assembled.skin) {
      applyTint(s, eyeTint ?? "#ffffff", { onlyMatch: isIrisMaterial, flat: true });
    }
  }, [assembled, eyeTint]);

  // ── Silhouette : mise à l'échelle d'os ────────────────────────────────────
  //
  // L'échelle est AFFECTÉE, jamais multipliée. Un `os.scale.x *= f` se
  // cumulerait à chaque passage de l'effet : le curseur ramené à 0 laisserait
  // l'épaule élargie. Ici `scaleFactor(0) === 1`, donc revenir au centre
  // restaure exactement l'origine, quel que soit le nombre de réglages.
  useEffect(() => {
    if (!assembled) return;
    const p = sanitizeProportions(proportions);
    const parNom = new Map<string, THREE.Object3D>();
    assembled.root.traverse((o) => { if (o.name) parNom.set(o.name, o); });

    for (const def of PROPORTION_DEFS) {
      const f = scaleFactor(p[def.key]);
      for (const nom of def.bones) {
        const os = parNom.get(nom);
        if (!os) continue; // squelette sans cet os : on ignore, on ne devine pas
        os.scale[def.axis] = f;
      }
      // Contre-échelle : annule l'héritage sur l'enfant pivoté. `f` est garanti
      // strictement positif par `scaleFactor`, donc `1 / f` ne peut ni diverger
      // ni retourner l'os.
      for (const nom of def.counterBones ?? []) {
        const os = parNom.get(nom);
        if (!os) continue;
        os.scale[def.axis] = 1 / f;
      }
    }
  }, [assembled, proportions]);

  // ── Animation : un mixer pour TOUT l'assemblage ───────────────────────────
  const mixer = useMemo(() => (assembled ? new THREE.AnimationMixer(assembled.root) : null), [assembled]);

  useEffect(() => {
    if (!mixer || !clips?.length) return;
    const name = initialClip ?? clips[0].name;
    const clip = clips.find((c) => c.name === name) ?? clips[0];
    const action = mixer.clipAction(clip);
    action.play();
    return () => { mixer.stopAllAction(); };
  }, [mixer, clips, initialClip]);

  useEffect(() => () => { mixer?.stopAllAction(); }, [mixer]);

  // Sans ça le mixer ne progresse jamais : le personnage resterait figé sur la
  // 1re frame du clip. `useFrame` est appelé inconditionnellement (règle des
  // hooks) ; le garde est à l'intérieur.
  useFrame((_, dt) => { mixer?.update(dt); });

  if (!assembled) return null;
  return (
    <group ref={group} scale={[scale * girth, scale, scale * girth]}>
      <primitive object={assembled.root} />
    </group>
  );
}
