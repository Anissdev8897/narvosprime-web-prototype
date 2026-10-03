// characters/MeshyPlayerCharacter.tsx — JOUEUR rendu avec un modèle Meshy (soldat).
//
// Clone d'HumanCharacter mais :
//   • charge le GLB Meshy choisi (getNpcModelPath) au lieu du Sorcerer FBX,
//   • anims = NPC_ANIM_SOURCE (soldat_humain) — même squelette biped Meshy,
//     + optionnellement un PACK FBX Mixamo (PLAYER_FBX_PACK) retargeté (préfixe
//       "mixamorig:" retiré) → tes animations récentes sur le joueur,
//   • couleurs d'origine (aucune teinte),
//   • pas de socket d'arme (v1).
// Piloté par cameraState (vitesse → loco, castToken → sort, dead → mort).
import { Component, memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import { AnimationController } from "../animation/AnimationController";
import { dispatchAnimEvent } from "../camera/recoilDispatcher";
import { statusEffects } from "../combat/statusEffects";
import { useGltfAnimationPack } from "../animation/useFbxAnimationPack";
import { PLAYER_FBX_PACK, type FbxAnimSpec } from "../animation/animationPacks";
import { useArchetype } from "../archetypes/archetypeStore";
import { ARCHETYPES } from "../archetypes/archetypeCatalog";
import { weaponForArchetype } from "../archetypes/archetypeWeapon";
import { weaponAnimPackForType } from "../weapons/weaponAnimationBinder";
import { WeaponSocket } from "../weapons/WeaponSocket";
import { BoneAttachment, type CharAttachment } from "./BoneAttachment";
import { getNpcModelPath } from "../loaders/assetManifest";
import { qualityVariant } from "../loaders/assetQuality";
import { useCharacterScale } from "./useCharacterScale";
import type { PlayerState } from "../runtime/movement/playerState";

// Source d'anims partagée (squelette biped Meshy de référence).
const ANIM_SOURCE = getNpcModelPath("soldat_humain");
useGLTF.preload(ANIM_SOURCE);

// Orientation : modèle "face" comme le Sorcerer (offset PI). Si l'avatar apparaît
// dos à la caméra, passer YAW_OFFSET à 0.
const YAW_OFFSET = Math.PI;

const NO_EXTRA: THREE.AnimationClip[] = [];

interface Props {
  modelId: string;
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  cameraState: React.MutableRefObject<PlayerState>;
  dead?: boolean;
  /** Arme dégainée (F) : pilote les anims de combat (pack) + la visibilité de l'arme. */
  weaponDrawn?: boolean;
  /** Forge Personnages : attachements rigides (casque/cape/accessoire) montés sur le rig. */
  attachments?: CharAttachment[];
  /** Forge Personnages : multiplicateur d'échelle global (défaut 1). */
  scaleMult?: number;
  /** Signal au parent que le modèle + anims sont chargés (1er frame rendu). */
  onCharacterReady?: () => void;
}

// ── Cœur de rendu : reçoit d'éventuels clips FBX supplémentaires ────────────────
function MeshyCore({ modelId, playerPosition, cameraState, dead = false, weaponDrawn = false, attachments, scaleMult = 1, extraClips, onCharacterReady }: Props & { extraClips: THREE.AnimationClip[] }) {
  const group = useRef<THREE.Group>(null);
  const readyFired = useRef(false);
  const characterScale = useCharacterScale();
  const deadRef = useRef(false);
  deadRef.current = dead;

  const { scene } = useGLTF(qualityVariant(getNpcModelPath(modelId)));
  const { animations: glbClips } = useGLTF(ANIM_SOURCE);
  const cloned = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  // FBX d'abord → priorité dans la résolution par nom de l'AnimationController.
  const clips = useMemo(() => [...extraClips, ...glbClips], [extraClips, glbClips]);

  useEffect(() => {
    cloned.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true; m.receiveShadow = true;
        // Clone les matériaux → le fondu d'invisibilité reste ISOLÉ (SkeletonUtils
        // partage les matériaux avec le modèle source utilisé par les PNJ).
        if (Array.isArray(m.material)) m.material = m.material.map((x) => x.clone());
        else if (m.material) m.material = (m.material as THREE.Material).clone();
      }
    });
  }, [cloned]);

  // Fondu d'invisibilité (sort Guerrier) — appliqué seulement au CHANGEMENT d'état.
  const invisRef = useRef(false);

  const animCtrl = useRef<AnimationController | null>(null);
  useEffect(() => {
    if (!group.current || clips.length === 0) { animCtrl.current = null; return; }
    animCtrl.current = new AnimationController(group.current, clips, { initial: "idle", onEvent: dispatchAnimEvent });
    return () => animCtrl.current?.dispose();
  }, [clips, cloned]);

  const currentYaw = useRef(0);
  const lastCastToken = useRef(0);
  const lastAttackToken = useRef(0);
  const lastReloadToken = useRef(0);
  const lastJumpToken = useRef(0);
  // Arme de l'archétype actif (modèle FBX attaché à la main du soldat Meshy).
  const archetype = useArchetype();
  const archWeaponId = weaponForArchetype(archetype);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    if (!readyFired.current) { readyFired.current = true; onCharacterReady?.(); }

    const s = cameraState.current;
    const pos = playerPosition.current;

    g.position.set(pos.x, pos.y, pos.z);
    g.visible = s.view === "tps";

    // Invisibilité (sort Guerrier) : fondu appliqué une seule fois au changement.
    const inv = statusEffects.isPlayerInvisible();
    if (inv !== invisRef.current) {
      invisRef.current = inv;
      cloned.traverse((o) => {
        const mm = (o as THREE.Mesh).material;
        const mats = (Array.isArray(mm) ? mm : mm ? [mm] : []) as THREE.Material[];
        for (const mat of mats) {
          mat.transparent = inv;
          (mat as THREE.MeshStandardMaterial).opacity = inv ? 0.22 : 1;
          mat.needsUpdate = true;
        }
      });
    }

    const targetYaw = s.yaw + YAW_OFFSET;
    currentYaw.current = THREE.MathUtils.lerp(currentYaw.current, targetYaw, 1 - Math.exp(-10 * dt));
    g.rotation.y = currentYaw.current;

    if (animCtrl.current) {
      // Mort : prioritaire (gel sur la dernière frame).
      if (deadRef.current) {
        if (animCtrl.current.currentAction !== "death") animCtrl.current.play("death");
        animCtrl.current.update(dt);
        return;
      }
      // ── Combat : overlay upper-body (tir/sort pendant la locomotion) ────────
      if (s.attackToken !== lastAttackToken.current) {
        lastAttackToken.current = s.attackToken;
        animCtrl.current.playOverlay("attack");
      } else if (s.reloadToken !== lastReloadToken.current) {
        lastReloadToken.current = s.reloadToken;
        animCtrl.current.playOverlay("channeling");
      } else if (s.castToken !== lastCastToken.current) {
        lastCastToken.current = s.castToken;
        animCtrl.current.playOverlay("cast");
      } else if (s.jumpToken !== lastJumpToken.current) {
        lastJumpToken.current = s.jumpToken;
        animCtrl.current.play("jump");
      } else {
        const cur = animCtrl.current.currentAction;
        const busy = cur === "jump" || cur === "landing";
        if (!busy) {
          // ── Crouch additif (blendé par-dessus la locomotion) ──────────────
          animCtrl.current.setCrouch(s.crouching);

          // Locomotion basée sur moveState (CharacterController, seuils corrects)
          const ms = s.moveState;
          const sp = s.horizontalSpeed;
          const action = ms === "sprint" ? "sprint"
            : ms === "run"    ? "run"
            : ms === "walk"   ? "walk"
            : "idle";
          animCtrl.current.play(action);
          if (action === "walk") {
            animCtrl.current.setLocomotionTimeScale(THREE.MathUtils.clamp(sp / 2.8, 0.5, 1.6));
          } else if (action === "run") {
            animCtrl.current.setLocomotionTimeScale(THREE.MathUtils.clamp(sp / 5.5, 0.7, 1.3));
          } else if (action === "sprint") {
            animCtrl.current.setLocomotionTimeScale(THREE.MathUtils.clamp(sp / 6, 1.0, 1.6));
          }
        }
      }
      animCtrl.current.update(dt);
    }
  });

  return (
    <group ref={group} dispose={null}>
      <primitive object={cloned} scale={characterScale * scaleMult} />
      {/* Forge Personnages : attachements rigides sur le rig Meshy (os nommés mixamo). */}
      {attachments?.map((a) => (
        <BoneAttachment key={a.id} rigRoot={cloned} family="mixamo" attach={a} />
      ))}
      <WeaponSocket
        rigRoot={cloned}
        rigScale={characterScale}
        weaponId={archWeaponId}
        family="mixamo"
        characterKind={archetype ?? "default"}
        editable
        attacking={weaponDrawn} /* visible uniquement arme dégainée (visibility "combat") */
      />
    </group>
  );
}

// Variante SANS pack (clips GLB partagés uniquement) — fallback sûr.
function MeshyNoFbx(props: Props) {
  return <MeshyCore {...props} extraClips={NO_EXTRA} />;
}
// Variante AVEC pack FBX (charge + retarget les clips Mixamo de l'archétype).
// Le pack est TOUJOURS chargé (cache), mais n'est fourni à l'AnimationController que
// si l'arme est DÉGAINÉE → idle combat (pack) vs idle normal (glb) sans re-cloner le mesh.
function MeshyWithPack({ pack, ...props }: Props & { pack: FbxAnimSpec[] }) {
  const packClips = useGltfAnimationPack(pack); // GLB (strip "mixamorig:" pour rig Meshy)
  return <MeshyCore {...props} extraClips={props.weaponDrawn ? packClips : NO_EXTRA} />;
}

// Repli si un FBX du pack échoue au chargement (useLoader lève, pas comme useGLTF) :
// on retombe sur les anims GLB par défaut au lieu de casser le rendu du joueur.
class FbxPackBoundary extends Component<{ fallback: ReactNode; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(e: unknown) { console.warn("[MeshyPlayer] pack FBX non chargé → anims par défaut :", e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const EMPTY_PACK: FbxAnimSpec[] = [];

function MeshyPlayerCharacterImpl(props: Props) {
  // ── Filet de sécurité : si le GLB Meshy n'est pas chargé après 5s (Suspense
  //    bloqué, GLB 404, corrompu, Draco fail), on signale quand même au parent
  //    que le personnage est "prêt" → le joueur entre en jeu sans modèle visible.
  const readyFired = useRef(false);
  useEffect(() => {
    const doReady = () => {
      if (!readyFired.current) {
        readyFired.current = true;
        props.onCharacterReady?.();
      }
    };
    const timer = setTimeout(() => {
      console.warn("[MeshyPlayer] Filet de sécurité 5s — le modèle Meshy n'a pas chargé à temps (GLB manquant/corrompu/Suspense)");
      doReady();
    }, 5000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onCharacterReady, props.modelId]);

  const arch = useArchetype();
  // Pack d'anim = celui de l'archétype actif (via le binder) ; sinon PLAYER_FBX_PACK.
  const pack = arch ? weaponAnimPackForType(ARCHETYPES[arch].weaponType)
                    : (PLAYER_FBX_PACK.length > 0 ? PLAYER_FBX_PACK : EMPTY_PACK);
  if (pack.length === 0) return <MeshyNoFbx {...props} />;
  return (
    <FbxPackBoundary key={arch ?? "none"} fallback={<MeshyNoFbx {...props} />}>
      <MeshyWithPack {...props} pack={pack} />
    </FbxPackBoundary>
  );
}

export const MeshyPlayerCharacter = memo(MeshyPlayerCharacterImpl);
