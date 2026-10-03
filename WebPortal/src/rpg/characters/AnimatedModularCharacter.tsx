// ══════════════════════════════════════════════════════════════════════════════
// characters/AnimatedModularCharacter.tsx — Personnage animé in-game (R3F)
//
// • Charge le modèle complet Outfit GLTF (Male_Ranger / Female_Ranger / etc.)
// • Charge les animations FBX Mixamo via useFBX et les retargète vers le
//   squelette Quaternius (noms de bones différents)
// • Applique la teinte de classe sur la tenue (pas sur la peau MI_Regular_*)
// • Animation procédurale en fallback si les FBX échouent
// • Caché en FPS, visible en TPS
// ══════════════════════════════════════════════════════════════════════════════

import { Component, Suspense, useEffect, useMemo, useRef } from "react";
import type { ReactNode } from "react";
import { useGLTF, useFBX } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import type { CharacterConfig, Gender } from "../types";
import { CLASSES } from "../classes/classes";
import { getOutfitPath, getHeadPath, OUTFIT_HEAD_COVERED } from "../loaders/assetManifest";
import { WeaponSocket } from "../weapons/WeaponSocket";
import { AnimationController } from "../animation/AnimationController";
import type { PlayerState } from "../runtime/movement/playerState";

interface Props {
  config: CharacterConfig;
  playerPosition?: React.MutableRefObject<THREE.Vector3>;
  cameraState?: React.MutableRefObject<PlayerState>;
  previewMode?: boolean;
}

// ── Retargeting Mixamo → Quaternius ──────────────────────────────────────────
// FBXLoader strips "mixamorig:" prefix automatically → bone names below are
// the POST-strip Mixamo names mapped to their Quaternius equivalents.
const MIXAMO_TO_QUATERNIUS: Record<string, string> = {
  Hips: "pelvis",
  Spine: "spine_01",
  Spine1: "spine_02",
  Spine2: "spine_03",
  Neck: "neck_01",
  Head: "Head",
  LeftUpLeg: "thigh_l",
  LeftLeg: "calf_l",
  LeftFoot: "foot_l",
  LeftToeBase: "ball_l",
  RightUpLeg: "thigh_r",
  RightLeg: "calf_r",
  RightFoot: "foot_r",
  RightToeBase: "ball_r",
  LeftShoulder: "clavicle_l",
  LeftArm: "upperarm_l",
  LeftForeArm: "lowerarm_l",
  LeftHand: "hand_l",
  RightShoulder: "clavicle_r",
  RightArm: "upperarm_r",
  RightForeArm: "lowerarm_r",
  RightHand: "hand_r",
};

/** Collecte les noms de TOUS les nœuds d'un sous-arbre (pour filtrer les pistes). */
function collectNames(root: THREE.Object3D): Set<string> {
  const names = new Set<string>();
  root.traverse((o) => { if (o.name) names.add(o.name); });
  return names;
}

/**
 * Collecte les quaternions de repos (bind pose LOCAL) de tous les bones d'un
 * squelette. Utilisé pour la compensation de bind pose lors du retargeting.
 * Doit être appelé AVANT tout `AnimationMixer` pour capturer l'état GLTF pur.
 */
function collectRestQuats(root: THREE.Object3D): Map<string, THREE.Quaternion> {
  const rests = new Map<string, THREE.Quaternion>();
  root.traverse((node) => {
    if ((node as THREE.Bone).isBone && node.name) {
      rests.set(node.name, node.quaternion.clone());
    }
  });
  return rests;
}

/**
 * Construit une map nom → bone depuis un groupe (pour le rebinding).
 * Appelé UNE FOIS après le clone de l'Outfit GLTF.
 */
function buildBoneMap(root: THREE.Object3D): Map<string, THREE.Bone> {
  const map = new Map<string, THREE.Bone>();
  root.traverse((node) => {
    if ((node as THREE.Bone).isBone && node.name) {
      map.set(node.name, node as THREE.Bone);
    }
  });
  return map;
}

/**
 * Relie les SkinnedMesh d'une partie séparée (tête, cheveux…) au squelette
 * maître du corps Outfit.
 *
 * Pourquoi ça fonctionne : les deux packs Quaternius (Outfits Fantasy et
 * Ultimate Modular) partagent le même squelette universel — mêmes noms de bones,
 * même rest pose. Les boneInverses de la partie sont donc mathématiquement
 * équivalents ; seuls les pointeurs vers les bones changent.
 *
 * @param partClone  Clone indépendant du GLTF de la partie (SkeletonUtils.clone)
 * @param masterBoneMap  Map nom→bone extraite du corps Outfit cloné
 */
function bindPartToMaster(
  partClone: THREE.Object3D,
  masterBoneMap: Map<string, THREE.Bone>,
): void {
  partClone.traverse((node) => {
    const sm = node as THREE.SkinnedMesh;
    if (!sm.isSkinnedMesh) return;

    // Pour chaque slot de bone dans le SkinnedMesh de la partie,
    // on remplace le bone local par le bone homonyme du squelette maître.
    const remappedBones = sm.skeleton.bones.map(
      (b) => masterBoneMap.get(b.name) ?? b
    );
    // On crée un nouveau skeleton avec les bones remappés MAIS les mêmes
    // boneInverses (rest-pose identique entre les deux packs Quaternius).
    const newSkeleton = new THREE.Skeleton(remappedBones, sm.skeleton.boneInverses);
    // Les OS sont ceux du maître : plusieurs pièces animent donc la même
    // hiérarchie. C'est le cas que `DetachedBindMode` couvre — `AttachedBindMode`
    // (le défaut) suppose que le mesh possède son squelette et partage son
    // espace monde, ce qui est faux ici et décale les pièces dès que le maître
    // n'est pas à l'identité.
    sm.bindMode = THREE.DetachedBindMode;
    sm.bind(newSkeleton, sm.bindMatrix);
    sm.castShadow = true;
    sm.frustumCulled = false;
  });
}

/**
 * Retargète un clip Mixamo vers le squelette Quaternius.
 *
 * PROBLÈME sans compensation :
 *   AnimationMixer REMPLACE bone.quaternion par la valeur Mixamo.
 *   Les FBX Mixamo stockent les quaternions en T-pose Mixamo (≠ identity),
 *   qui inclut une rotation de coordonnées (~90° X) et les orientations
 *   anatomiques propres à Mixamo. Appliqués tels quels sur Quaternius
 *   (bind pose différent), les os se déforment ou s'inversent.
 *
 * FORMULE CORRECTE (retargeting bind-pose complet) :
 *   q_corrected = q_quat_rest × inv(q_mix_rest) × q_mix_anim
 *
 *   - q_quat_rest  = repos de l'os dans le squelette Quaternius (GLTF)
 *   - q_mix_rest   = repos de l'os dans le squelette Mixamo (1er frame idle)
 *   - q_mix_anim   = valeur de la piste au keyframe t
 *
 *   → quand q_mix_anim = q_mix_rest (T-pose), résultat = q_quat_rest ✓
 *   → pendant l'anim, le delta Mixamo est transposé dans le frame Quaternius ✓
 *
 * Seul le pelvis est exclu : sa rotation Quaternius (~106° autour de X)
 * encode la conversion Z-up→Y-up ; son orientation est gérée par le groupe
 * parent (yaw du joueur), pas par la piste d'animation.
 */
function retargetClip(
  clip: THREE.AnimationClip,
  validBones?: Set<string>,
  boneRests?: Map<string, THREE.Quaternion>,
  mixamoRest?: Map<string, THREE.Quaternion>,
): THREE.AnimationClip {
  const tracks: THREE.KeyframeTrack[] = [];
  const _q = new THREE.Quaternion(); // réutilisable – évite les allocations

  for (const track of clip.tracks) {
    const dotIdx = track.name.indexOf(".");
    let boneName = dotIdx !== -1 ? track.name.slice(0, dotIdx) : track.name;
    const property = dotIdx !== -1 ? track.name.slice(dotIdx) : "";
    // On ne garde QUE les rotations (.quaternion).
    // .position = root motion (perso dérive) + proportions Mixamo (os mal redimensionnés).
    if (property !== ".quaternion") continue;
    boneName = boneName.replace(/^mixamorig[:_]?/i, "");
    const mapped = MIXAMO_TO_QUATERNIUS[boneName] ?? boneName;
    // Pelvis exclu : sa rotation encode la conversion Z-up→Y-up Blender→Three.js.
    if (mapped === "pelvis") continue;
    // Ignore les os absents du squelette Quaternius (doigts, orteils Mixamo).
    if (validBones && !validBones.has(mapped)) continue;

    const t = track.clone();
    t.name = mapped + property;

    // ── Compensation de bind pose complète ──────────────────────────────────
    // q_corrected = q_quat_rest × inv(q_mix_rest) × q_mix_anim
    // Calculé uniquement si les deux tables de repos sont disponibles.
    // track.clone() produit un nouveau Float32Array (.slice()) → mutation safe.
    if (boneRests && mixamoRest) {
      const qQuatRest  = boneRests.get(mapped);
      const qMixRest   = mixamoRest.get(mapped);
      if (qQuatRest && qMixRest) {
        // inv(q_mix_rest) calculé une seule fois par os (pas dans la boucle keyframe)
        const qInvMixRest = qMixRest.clone().invert();
        const vals = t.values as Float32Array;
        for (let i = 0; i < vals.length; i += 4) {
          _q.set(vals[i], vals[i + 1], vals[i + 2], vals[i + 3]);
          _q.premultiply(qInvMixRest); // _q = inv(q_mix_rest) × q_anim
          _q.premultiply(qQuatRest);   // _q = q_quat_rest × inv(q_mix_rest) × q_anim ✓
          vals[i]     = _q.x;
          vals[i + 1] = _q.y;
          vals[i + 2] = _q.z;
          vals[i + 3] = _q.w;
        }
      }
    }

    tracks.push(t);
  }
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

/**
 * Retire le keyframe d'initialisation T-pose (frame 0) des clips Mixamo
 * après compensation de bind pose.
 *
 * Convention Mixamo : tous les FBX exportés incluent un premier keyframe
 * à time=0 en T-pose (reference frame).  Après notre formule de retargeting,
 * ce frame 0 évalue à la T-pose Quaternius.  Sans trim :
 *   • à la boucle (LoopRepeat → wrap time=0) → flash T-pose au seam
 *   • à la transition (AnimationAction.reset() → time=0) → T-pose pendant le crossfade
 *
 * Après trim, le clip commence au keyframe 1 (première pose réelle de l'animation).
 * LoopRepeat wrap vers ce frame 1 → boucle fluide, jamais de T-pose visible.
 */
function trimInitFrame(clip: THREE.AnimationClip): THREE.AnimationClip {
  if (!clip.tracks.length) return clip;
  const firstTimes = clip.tracks[0].times;
  if (firstTimes.length < 2) return clip;

  // Temps du keyframe 1 = début de l'animation réelle (frame 0 = T-pose Mixamo)
  const trimTime = firstTimes[1];

  const newTracks = clip.tracks.map((track) => {
    const tc = track.clone();
    const vSize = track.getValueSize();
    // Nombre de keyframes à supprimer au début (avant trimTime)
    let si = 0;
    while (si < tc.times.length && tc.times[si] < trimTime - 1e-5) si++;
    if (si === 0) return tc;
    // Décaler les temps pour ramener le 1er keyframe restant à t=0
    const dt = tc.times[si];
    const newTimes = new Float32Array(tc.times.length - si);
    for (let i = 0; i < newTimes.length; i++) newTimes[i] = tc.times[si + i] - dt;
    (tc as any).times  = newTimes;
    (tc as any).values = (tc.values as Float32Array).slice(si * vSize);
    return tc;
  });

  return new THREE.AnimationClip(clip.name, clip.duration - trimTime, newTracks);
}

// ── Teinture matériaux (peau préservée) ──────────────────────────────────────
// Utilise lerp (50 %) plutôt que multiply :
//   multiply(tint) → material.color = pure tint → pixels sombres de la texture
//   se multiplient par une teinte saturée → perte de détail / rendu monochrome.
//   lerp(tint, 0.5) → color = (white×0.5 + tint×0.5) → teinte lumineuse qui
//   laisse la texture exprimer ses variations claires/sombres.
function applyTint(obj: THREE.Object3D, tint: THREE.Color, emissive: THREE.Color) {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    const mats = Array.isArray(m.material) ? m.material : [m.material];
    const painted = mats.map((mat) => {
      const std = (mat as THREE.MeshStandardMaterial).clone();
      const isSkin = std.name.toLowerCase().includes("regular");
      if (!isSkin) {
        // Teinte douce : préserve le détail de la texture tout en colorisant
        std.color.lerp(tint, 0.5);
        if (std.emissive) { std.emissive.copy(emissive); std.emissiveIntensity = 0.08; }
      } else {
        std.color.set(1, 1, 1);
        std.emissiveIntensity = 0;
      }
      std.needsUpdate = true;
      return std;
    });
    m.material = Array.isArray(m.material) ? painted : painted[0];
    m.castShadow = true;
    m.receiveShadow = true;
    m.frustumCulled = false;
  });
}

// (offsets d'arme retirés : gérés par weaponProfiles.json / WeaponSocket — SP-1)

// OUTFIT_HEAD_COVERED est maintenant importé depuis assetManifest (source unique de vérité).

// ── Error boundary léger pour le chargement optionnel du head GLTF ──────────
// Si le fichier Male_Head.gltf / Female_Head.gltf n'est pas encore en place,
// useGLTF lance une erreur (404 → Suspense rejection). Ce boundary la capte
// silencieusement → la sphère procédurale reste visible en fallback.
interface EBState { error: boolean }
class HeadErrorBoundary extends Component<{ children: ReactNode }, EBState> {
  constructor(props: { children: ReactNode }) { super(props); this.state = { error: false }; }
  static getDerivedStateFromError() { return { error: true }; }
  render() { return this.state.error ? null : this.props.children; }
}

// ── HeadAttachment — charge + relie le Head GLTF au squelette maître ────────
// Composant séparé pour isoler l'appel useGLTF(headPath) dans son propre arbre
// Suspense/ErrorBoundary. Attachement impératif au group de l'Outfit cloné.
function HeadAttachment({
  gender,
  outfitClone,
  masterBoneMap,
  skinColor,
}: {
  gender: Gender;
  outfitClone: THREE.Object3D;
  masterBoneMap: Map<string, THREE.Bone>;
  skinColor: string;
}) {
  const headPath = getHeadPath(gender);
  const { scene: headScene } = useGLTF(headPath);

  useEffect(() => {
    const headClone = SkeletonUtils.clone(headScene);

    // Relie les SkinnedMesh de la tête au squelette du corps Outfit
    bindPartToMaster(headClone, masterBoneMap);

    // Applique la couleur de peau sur tous les matériaux du head
    headClone.traverse((node) => {
      const m = node as THREE.SkinnedMesh;
      if (!m.isMesh || !m.material) return;
      const mats = Array.isArray(m.material) ? m.material : [m.material];
      const painted = mats.map((mat) => {
        const std = (mat as THREE.MeshStandardMaterial).clone();
        std.color.set(skinColor ?? "#e0ac69");
        std.roughness = 0.65;
        std.metalness = 0.0;
        std.needsUpdate = true;
        return std;
      });
      m.material = Array.isArray(m.material) ? painted : painted[0];
    });

    // Masquer la sphère procédurale (fallback) quand le vrai head est chargé
    const procHead = outfitClone.getObjectByName("__proc_head__");
    if (procHead) procHead.visible = false;

    outfitClone.add(headClone);

    return () => {
      outfitClone.remove(headClone);
      // Restaurer la sphère proc si le GLTF de tête est démonté
      const ph = outfitClone.getObjectByName("__proc_head__");
      if (ph) ph.visible = true;
    };
  }, [headScene, outfitClone, masterBoneMap, skinColor]);

  return null; // rendu impératif — aucun JSX
}

// ── Chargement des 7 clips FBX ───────────────────────────────────────────────
const FBX_BASE = "/models/assets_character/rpg/animations";

function useFbxClips(
  validBones: Set<string>,
  boneRests: Map<string, THREE.Quaternion>,
): THREE.AnimationClip[] {
  const idle    = useFBX(`${FBX_BASE}/Breathing Idle.fbx`);
  const run     = useFBX(`${FBX_BASE}/Running.fbx`);
  const sprint  = useFBX(`${FBX_BASE}/Standing Sprint Forward.fbx`);
  const cast    = useFBX(`${FBX_BASE}/Standing 2H Cast Spell 01.fbx`);
  const atk     = useFBX(`${FBX_BASE}/Standing 2H Magic Attack 01.fbx`);
  const ult     = useFBX(`${FBX_BASE}/Standing 2H Magic Area Attack 01.fbx`);
  const death   = useFBX(`${FBX_BASE}/Standing React Death Forward.fbx`);

  return useMemo(() => {
    // ── Étape 1 : extraire le T-pose Mixamo depuis le squelette FBX idle statique ──
    const mixamoRest = new Map<string, THREE.Quaternion>();
    if (idle) {
      idle.traverse((node) => {
        if ((node as THREE.Bone).isBone && node.name) {
          let bname = node.name.replace(/^mixamorig[:_]?/i, "");
          const mapped = MIXAMO_TO_QUATERNIUS[bname] ?? bname;
          mixamoRest.set(mapped, node.quaternion.clone());
        }
      });
    }

    // ── Étape 2 : retargeter tous les clips avec la formule complète ──────────
    const raw: [string, THREE.Group][] = [
      ["Breathing Idle", idle],
      ["Running", run],
      ["Standing Sprint Forward", sprint],
      ["Standing 2H Cast Spell 01", cast],
      ["Standing 2H Magic Attack 01", atk],
      ["Standing 2H Magic Area Attack 01", ult],
      ["Standing React Death Forward", death],
    ];
    const clips: THREE.AnimationClip[] = [];
    for (const [name, fbx] of raw) {
      const src = fbx.animations[0];
      if (!src) continue;
      src.name = name;
      // trimInitFrame supprime le frame 0 T-pose Mixamo APRÈS retargeting →
      // élimine le flash T-pose aux seams de boucle et pendant les crossfades.
      clips.push(trimInitFrame(retargetClip(src, validBones, boneRests, mixamoRest)));
    }
    return clips;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idle, run, sprint, cast, atk, ult, death, validBones, boneRests]);
}

// ══════════════════════════════════════════════════════════════════════════════
// Composant principal
// ══════════════════════════════════════════════════════════════════════════════
export function AnimatedModularCharacter({ config, playerPosition, cameraState, previewMode = false }: Props) {
  const group = useRef<THREE.Group>(null);
  const cls   = CLASSES[config.classId];

  const tint    = useMemo(() => new THREE.Color(config.tint ?? cls.outfitColor), [config.tint, cls.outfitColor]);
  const emissive = useMemo(() => new THREE.Color(cls.outfitEmissive), [cls.outfitEmissive]);

  // Modèle complet (Outfit GLTF) — squelette unique, textures skin incluses
  const outfitPath = getOutfitPath(config.gender, config.outfitStyle);

  const { scene } = useGLTF(outfitPath);
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);
  // Noms de tous les nœuds (filtre les pistes d'anim Mixamo)
  const boneNames = useMemo(() => collectNames(cloned), [cloned]);
  // Quaternions de repos du squelette Quaternius capturés AVANT toute animation.
  // Passés à retargetClip() pour la compensation de bind pose (q_rest × q_mixamo).
  const boneRests = useMemo(() => collectRestQuats(cloned), [cloned]);
  // Map nom→bone pour le rebinding des parties séparées (head GLTF Ultimate Modular).
  const masterBoneMap = useMemo(() => buildBoneMap(cloned), [cloned]);

  // (chargement d'arme retiré : WeaponSocket charge le GLB lui-même — SP-1)

  // Teinte + peau
  useEffect(() => {
    applyTint(cloned, tint, emissive);
  }, [cloned, tint, emissive]);

  // ── Tête procédurale ─────────────────────────────────────────────────────────
  // Le pack Quaternius "Outfits" ne fournit pas de mesh de visage — seulement
  // des accessoires (capuche, casque).  Pour les tenues à visage découvert,
  // on crée une sphère procédurale enfant du bone "Head" : elle suit toutes les
  // animations automatiquement via la hiérarchie de bones (aucun hook par frame).
  useEffect(() => {
    if (OUTFIT_HEAD_COVERED.has(config.outfitStyle)) return;

    let headBone: THREE.Object3D | null = null;
    cloned.traverse((node) => { if (node.name === "Head") headBone = node; });
    if (!headBone) return;

    // Retirer un éventuel head précédent (hot-reload / changement de tenue)
    const prev = headBone.getObjectByName("__proc_head__");
    if (prev) headBone.remove(prev);

    // Tête procédurale : cranium ellipsoïde + nez, regroupés dans un Group.
    // Z=0 sur le groupe : le bone Head a une inclinaison naturelle qui suffit
    // à orienter le visage vers l'avant — inutile d'ajouter un offset Z racine.
    // Les enfants du groupe peuvent avoir des offsets Z librement (nez, oreilles).
    const headGroup = new THREE.Group();
    headGroup.name = "__proc_head__";
    headGroup.position.set(0, 0.09, 0);

    const mat = new THREE.MeshStandardMaterial({
      color: new THREE.Color(config.skinColor ?? "#e0ac69"),
      roughness: 0.65,
      metalness: 0.0,
    });

    // ── Cranium — ellipsoïde aux proportions d'une tête humaine ──────────────
    // Légèrement étroit front/back (×0.81), allongé vertical (×1.18),
    // compressé horizontal (×0.91) → silhouette naturelle de profil.
    const cranGeo = new THREE.SphereGeometry(0.115, 24, 18);
    cranGeo.applyMatrix4(new THREE.Matrix4().makeScale(0.91, 1.18, 0.81));
    const cranMesh = new THREE.Mesh(cranGeo, mat);
    cranMesh.castShadow = true;
    headGroup.add(cranMesh);

    // ── Nez — petit ellipsoïde sur la face avant ──────────────────────────────
    // Positionné dans le tiers bas du visage (Y négatif = bas) et
    // projeté vers l'avant (Z positif = devant dans l'espace local du bone).
    const noseGeo = new THREE.SphereGeometry(0.021, 10, 8);
    noseGeo.applyMatrix4(new THREE.Matrix4().makeScale(1.4, 0.65, 1.75));
    const noseMesh = new THREE.Mesh(noseGeo, mat);
    noseMesh.position.set(0, -0.01, 0.088);
    headGroup.add(noseMesh);

    headBone.add(headGroup);

    return () => {
      headBone!.remove(headGroup);
      cranGeo.dispose();
      noseGeo.dispose();
      mat.dispose();
    };
  }, [cloned, config.outfitStyle, config.skinColor]);

  // (attache hand_r retirée : remplacée par <WeaponSocket family="quaternius"> — SP-1)

  // Clips FBX retargetés (avec compensation de bind pose)
  const clips = useFbxClips(boneNames, boneRests);

  // AnimationController
  const animCtrl = useRef<AnimationController | null>(null);
  useEffect(() => {
    if (!cloned || clips.length === 0) {
      animCtrl.current = null;
      return;
    }
    animCtrl.current = new AnimationController(cloned, clips, { initial: "idle" });
    return () => animCtrl.current?.dispose();
  }, [cloned, clips, config.gender]);

  const proceduralPhase = useRef(0);
  const currentYaw = useRef(0);
  const lastCastToken = useRef(0);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    if (previewMode) {
      if (animCtrl.current) {
        animCtrl.current.play("idle");
        animCtrl.current.update(dt);
      }
      return;
    }

    const s = cameraState!.current;
    const pos = playerPosition!.current;

    g.position.set(pos.x, pos.y, pos.z);
    g.visible = s.view === "tps";

    const targetYaw = s.yaw + Math.PI;
    currentYaw.current = THREE.MathUtils.lerp(currentYaw.current, targetYaw, 1 - Math.exp(-10 * dt));
    g.rotation.y = currentYaw.current;

    if (animCtrl.current) {
      const sp = s.horizontalSpeed;
      if (s.castToken !== lastCastToken.current) {
        // Sort lancé → anim one-shot d'incantation / attaque
        lastCastToken.current = s.castToken;
        animCtrl.current.play(s.castAction);
      } else {
        // Ne pas écraser un one-shot (cast/ultimate/attack) en cours
        const cur = animCtrl.current.currentAction;
        const busy = cur === "cast" || cur === "ultimate" || cur === "attack";
        if (!busy) {
          // Locomotion par vitesse (pas par `grounded`) + cadence de course
          // synchronisée à la vitesse réelle (anti "course frénétique").
          const action = sp > 7.5 ? "sprint" : sp > 0.3 ? "run" : "idle";
          animCtrl.current.play(action);
          if (action === "run") {
            animCtrl.current.setLocomotionTimeScale(THREE.MathUtils.clamp(sp / 6, 0.55, 1.3));
          }
        }
      }
      animCtrl.current.update(dt);
    } else {
      // Animation procédurale (fallback)
      const sp = s.horizontalSpeed;
      if (sp > 0.5) {
        const freq = 6 + sp * 0.8;
        const amp  = 0.03 + Math.min(sp / 9, 1) * 0.06;
        proceduralPhase.current += freq * dt;
        g.position.y = pos.y + Math.abs(Math.sin(proceduralPhase.current)) * amp;
        g.rotation.z = Math.sin(proceduralPhase.current) * 0.025;
      } else {
        proceduralPhase.current += 1.5 * dt;
        g.position.y = pos.y + Math.sin(proceduralPhase.current) * 0.012;
        g.rotation.z = 0;
      }
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={cloned} />
      <WeaponSocket
        rigRoot={cloned}
        rigScale={1}
        weaponId={cls.weaponKey}
        family="quaternius"
        attacking={false}
      />
      {/* Tête réelle (Ultimate Modular) — uniquement pour les tenues à visage découvert.
          Fallback silencieux si Male_Head.gltf / Female_Head.gltf absent (sphère proc reste). */}
      {!OUTFIT_HEAD_COVERED.has(config.outfitStyle) && (
        <HeadErrorBoundary>
          <Suspense fallback={null}>
            <HeadAttachment
              gender={config.gender}
              outfitClone={cloned}
              masterBoneMap={masterBoneMap}
              skinColor={config.skinColor}
            />
          </Suspense>
        </HeadErrorBoundary>
      )}
    </group>
  );
}

/** Précharge les outfits principaux (Ranger M/F) pour éviter le pop-in au lancement. */
export function preloadOutfits() {
  useGLTF.preload(getOutfitPath("male",   "Ranger"));
  useGLTF.preload(getOutfitPath("female", "Ranger"));
  useGLTF.preload(getOutfitPath("male",   "Knight"));
  useGLTF.preload(getOutfitPath("female", "Knight"));
}
