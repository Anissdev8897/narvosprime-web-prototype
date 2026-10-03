// characters/OwnAnimPlayerCharacter.tsx — JOUEUR à RIG PROPRE + anims embarquées.
//
// Pour les personnages NON-biped-Meshy (RobotGirl, Ninja, Sorcier hi-poly…) : leur
// GLB contient SES PROPRES animations (idle/walk/run…), jouées via l'AnimationController
// (résolution par nom). Normalisé par bounding-box (échelle source inconnue).
//
// ── Animations de CLASSE pour les rigs compatibles ───────────────────────────────
// Si l'avatar est marqué `sharedRig` (os "Hips/Spine/…" convention Meshy — ex: Ninja),
// on charge EN PLUS le pack d'animation de l'archétype (guerrier/archer/mage…) et on le
// branche quand l'arme est dégainée → le perso joue les anims de sa classe, comme les
// soldats Meshy. Les rigs incompatibles (RobotGirl, os "CC_Base_*") n'ont QUE leurs
// anims embarquées (un pack ne se lierait pas → T-pose figée). C'est le mapper universel.
//
// WeaponSocket : attaché pour les rigs `sharedRig` (os "RightHand/LeftHand" → l'arme de
// la classe est VISIBLE en main, avec calibrage). Les rigs incompatibles n'ont pas d'arme.
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { useGLTF } from "@react-three/drei";
import { setBuiltinWeaponVisible } from "./builtinWeaponMask";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import { AnimationController } from "../animation/AnimationController";
import { renameClip } from "../animation/mixamoRetarget";
import { useGltfAnimationPack } from "../animation/useFbxAnimationPack";
import { useAnimOverrideVersion } from "../animation/animClipStore";
import type { FbxAnimSpec } from "../animation/animationPacks";
import { dispatchAnimEvent } from "../camera/recoilDispatcher";
import { PLAYER_CONFIG } from "../runtime/movement/playerConfig";
import { statusEffects } from "../combat/statusEffects";
import { useArchetype } from "../archetypes/archetypeStore";
import { ARCHETYPES } from "../archetypes/archetypeCatalog";
import { weaponAnimPackForType } from "../weapons/weaponAnimationBinder";
import { weaponForArchetype } from "../archetypes/archetypeWeapon";
import { WeaponSocket } from "../weapons/WeaponSocket";
import { BoneAttachment, type CharAttachment } from "./BoneAttachment";
import { weaponEditorStore, useWeaponEditor } from "../weapons/weaponEditorStore";
import { characterOffsetStore } from "./characterOffsetStore";
import { useCharacterScale } from "./useCharacterScale";
import { emoteStore } from "../animation/emoteStore";
import { IdleVariantController, IDLE_VARIANT_PATHS } from "../animation/idleVariantController";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { configureGLTFLoader } from "../loaders/sharedLoaders";
import { avatarUsesUeRig } from "./playerAvatars";
import { UNARMED_PACK, firstPerAction } from "../animation/animationPacks";
import { isBulletAvatar, WRAITH_ANIMS, BULLET_LOCOMOTION, UTA_LOCOMOTION, UTA_TRAVERSAL, CROUCH_LOCOMOTION, P2_TRAVERSAL } from "./avatarAssets";
import { solveLocomotion } from "../animation/locomotionBlend";
import { playerAnimDebug } from "../animation/playerAnimDebug";
import { PLAYER_CONFIG as C } from "../runtime/movement/playerConfig";

import type { PlayerState } from "../runtime/movement/playerState";
import type { ActionId } from "../types";


/**
 * Offset de yaw entre l'orientation de la caméra et le modèle 3D.
 *
 * Convention Mixamo/Meshy : le modèle regarde -Z → YAW_OFFSET = PI
 * Convention UE Mannequin  : le modèle regarde +X → YAW_OFFSET = PI/2
 *
 * Détecté via offsetKey (id avatar) qui transite par avatarUsesUeRig().
 */
function resolveYawOffset(offsetKey?: string): number {
  return avatarUsesUeRig(offsetKey) ? Math.PI / 2 : Math.PI;
}
const TARGET_HEIGHT = 1.8;        // hauteur cible (m) — normalisation bbox.

/**
 * Descente du bassin de la pose accroupie, en unités du RIG (pas du monde).
 *
 * Mesurée par cinématique directe sur `Anim_Crouch_Idle_Hip` : bassin à 0,968
 * debout, 0,595 accroupi. Le même écart de 0,373 se retrouve au genou
 * (0,574→0,202), à la cheville (0,583→0,211) et à la pointe (0,393→0,021) : la
 * pose descend en bloc, donc un offset de groupe la restitue exactement.
 *
 * Cette valeur n'a rien d'arbitraire — la re-mesurer si le clip d'accroupi
 * change : `node scripts/inspect-clip-tracks.mjs <clip.glb> pelvis`.
 */
const CROUCH_PELVIS_DROP = 0.373;
const NO_EXTRA: THREE.AnimationClip[] = [];
const EMPTY_PACK: FbxAnimSpec[] = [];

// Loader partagé pour GLB d'émotes/variantes idle (Workers via sharedLoaders)
const _emoteLoader = new GLTFLoader();
configureGLTFLoader(_emoteLoader);

interface Props {
  path: string;
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  cameraState: React.MutableRefObject<PlayerState>;
  dead?: boolean;
  /** Multiplicateur d'échelle par-dessus la normalisation bbox (réglage par avatar). */
  scaleMul?: number;
  /** Rig compatible Mixamo/Meshy ("Hips/Spine") → peut recevoir les packs de classe. */
  sharedRig?: boolean;
  /** Arme dégainée (F) → bascule sur les anims de combat de la classe. */
  weaponDrawn?: boolean;
  /** Clé d'offset d'orientation (= id avatar). */
  offsetKey?: string;
  /** Forge Personnages : attachements rigides (casque/cape/accessoire) montés sur le rig. */
  attachments?: CharAttachment[];
  /** Signal au parent que le modèle + anims sont chargés (1er frame rendu). */
  onCharacterReady?: () => void;
}

// ── Cœur de rendu : reçoit d'éventuels clips de classe supplémentaires ────────────
function OwnAnimCore({
  path, playerPosition, cameraState, dead = false, scaleMul = 1, weaponDrawn = false, offsetKey, attachments,
  extraClips, weaponId, characterKind, weaponFamily = "mixamo", onCharacterReady,
}: Props & { extraClips: THREE.AnimationClip[]; weaponId?: string; characterKind?: string; weaponFamily?: string }) {
  const group = useRef<THREE.Group>(null);
  const readyFired = useRef(false);
  const characterScale = useCharacterScale();
  const deadRef = useRef(false);
  deadRef.current = dead;

  const { scene, animations } = useGLTF(path);
  // ARME INTÉGRÉE — les avatars Paragon sortent d'Unreal avec leur arme
  // fusionnée au modèle (Wraith : 18 614 tris de canon, Murdock : 17 044 tris
  // d'armes). Sans ce masque, équiper une arme en affiche DEUX, et à mains nues
  // le personnage tient une arme qu'il n'a pas.
  //
  // C'est masquable parce que l'arme est une PRIMITIVE distincte, avec son
  // propre matériau : glTF → Three.js en fait un Mesh à part entière.
  const { object, baseScale } = useMemo(() => {
    const c = SkeletonUtils.clone(scene);
    c.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.isMesh) {
        m.castShadow = true; m.receiveShadow = true; m.frustumCulled = false;
        if (Array.isArray(m.material)) m.material = m.material.map((x) => x.clone());
        else if (m.material) m.material = (m.material as THREE.Material).clone();
      }
    });
    // Matrices monde à jour AVANT mesure (clone jamais rendu) → bbox correcte.
    c.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(c);
    const h = Math.max(0.001, box.max.y - box.min.y);
    const bs = (TARGET_HEIGHT / h) * scaleMul;

    return { object: c, baseScale: bs };
  }, [scene, scaleMul, path]);

  // Masquage INCONDITIONNEL, et c'est voulu :
  //   • aucune arme équipée → le joueur ne doit voir que ses mains ;
  //   • une arme équipée    → c'est CELLE-LÀ qu'on affiche, attachée à l'os
  //     `weapon_r`, pas celle qu'Unreal a soudée au torse.
  // Dans les deux cas l'arme intégrée est de trop. La garder conditionnelle
  // n'ajouterait qu'un état de plus à désynchroniser.
  //
  // Réappliqué quand `object` change : un clone frais réaffiche toujours la
  // sienne.
  useEffect(() => {
    setBuiltinWeaponVisible(object, false);
  }, [object]);

  // Pack de classe d'abord → priorité dans la résolution par nom de l'AnimationController.
  const clips = useMemo(() => [...extraClips, ...animations], [extraClips, animations]);

  const animVer = useAnimOverrideVersion(); // rebuild SEULEMENT quand un override change
  const animCtrl = useRef<AnimationController | null>(null);
  useEffect(() => {
    if (!group.current || clips.length === 0) { animCtrl.current = null; return; }
    animCtrl.current = new AnimationController(group.current, clips, {
      initial: lastActionRef.current, onEvent: dispatchAnimEvent, avatarKey: offsetKey,
      avatarMode: weaponDrawn ? "drawn" : "base",
    });
    // Expose le contrôleur au HUD de debug (F9). Singleton hors-React : le HUD
    // vit dans l'arbre DOM, le contrôleur dans le Canvas.
    playerAnimDebug.set(animCtrl.current);
    return () => { playerAnimDebug.set(null); animCtrl.current?.dispose(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, object, animVer]);

  const currentYaw = useRef(0);
  const lastCastToken = useRef(0);
  const lastAttackToken = useRef(0);
  const lastReloadToken = useRef(0);
  const lastJumpToken = useRef(0);
  const lastOneShotToken = useRef(0);
  const wasGroundedRef = useRef(true);
  const invisRef = useRef(false);
  const offsetGroup = useRef<THREE.Group>(null); // offset d'orientation PAR ANIMATION
  const lastActionRef = useRef<ActionId>("idle"); // anim en cours → évite le snap-idle au rebuild
  const offActRef = useRef(""); const offModeRef = useRef(""); const offVerRef = useRef(-1);
  // Y calibré par l'utilisateur pour l'action courante, mémorisé à part : la
  // descente d'accroupissement s'y ajoute chaque frame sans l'écraser.
  const offBaseY = useRef(0);
  const crouchDrop = useRef(0);
  // Hystérésis stationaryCrouch : évite l'oscillation play("crouch")↔play("idle")
  // quand horizontalSpeed fluctue autour du seuil de 0.3 m/s (Agent scan #1).
  // NE PAS ajouter currentAction === "idle" à la condition — voir ligne 374.
  const wasStationaryRef = useRef(false);
  const debugMoveLogged = useRef(false);

  // ── Émotes & variantes idle ─────────────────────────────────────────────────
  const idleVarCtrl = useRef(new IdleVariantController(IDLE_VARIANT_PATHS.length));
  const idleVarClips = useRef<THREE.AnimationClip[]>([]);
  const isIdleVariantRef = useRef(false);
  const lastIdleVarIdx = useRef(-1);

  useEffect(() => {
    const clips: THREE.AnimationClip[] = [];
    let cancelled = false;
    IDLE_VARIANT_PATHS.forEach((p, i) => {
      _emoteLoader.load(p, (gltf) => {
        if (!cancelled && gltf.animations[0]) clips[i] = gltf.animations[0];
      }, undefined, () => {});
    });
    idleVarClips.current = clips;
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    let lastVer = emoteStore.getSnapshot().version;
    const unsub = emoteStore.subscribe(() => {
      const snap = emoteStore.getSnapshot();
      if (snap.version === lastVer) return;
      lastVer = snap.version;
      const ctrl = animCtrl.current;
      if (!ctrl) return;

      if (snap.emoteId === null) {
        ctrl.cancelEmote(0.3);
        return;
      }
      _emoteLoader.load(snap.glbPath!, (gltf) => {
        if (!animCtrl.current) return;
        const clip = gltf.animations[0];
        if (!clip) return;
        isIdleVariantRef.current = false;
        animCtrl.current.playEmote(clip, snap.loop);
      });
    });
    return unsub;
  }, []);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;

    if (!readyFired.current) { readyFired.current = true; onCharacterReady?.(); }

    const s = cameraState.current;
    const pos = playerPosition.current;

    g.position.set(pos.x, pos.y, pos.z);
    g.visible = s.view === "tps";

    const inv = statusEffects.isPlayerInvisible();
    if (inv !== invisRef.current) {
      invisRef.current = inv;
      object.traverse((o) => {
        const mm = (o as THREE.Mesh).material;
        const mats = (Array.isArray(mm) ? mm : mm ? [mm] : []) as THREE.Material[];
        for (const mat of mats) {
          mat.transparent = inv;
          (mat as THREE.MeshStandardMaterial).opacity = inv ? 0.22 : 1;
          mat.needsUpdate = true;
        }
      });
    }

    const yawOff = resolveYawOffset(offsetKey);
    const targetYaw = s.yaw + yawOff;
    // Deadzone anti-oscillation : si l'écart est < 0.001 rad (~0.057°), on
    // snap directement pour éviter le micro-lerp perpétuel qui fait osciller
    // le personnage de gauche à droite en idle (Agent scan #2).
    const yawDiff = targetYaw - currentYaw.current;
    if (Math.abs(yawDiff) > 0.001) {
      currentYaw.current = THREE.MathUtils.lerp(currentYaw.current, targetYaw, 1 - Math.exp(-10 * dt));
    } else {
      currentYaw.current = targetYaw;
    }
    g.rotation.y = currentYaw.current;

    // Offset spécifique à l'animation EN COURS (groupe local).
    const og = offsetGroup.current;
    if (og) {
      const act = animCtrl.current?.currentAction ?? "idle";
      lastActionRef.current = act;
      const mode = s.weaponDrawn ? "drawn" : "base"; // idle rangé ≠ idle dégainé
      const ver = characterOffsetStore.getVersion();
      if (act !== offActRef.current || mode !== offModeRef.current || ver !== offVerRef.current) {
        offActRef.current = act; offModeRef.current = mode; offVerRef.current = ver;
        const off = characterOffsetStore.get(offsetKey, mode as "base" | "drawn", act);
        og.rotation.set(off.rotation[0], off.rotation[1], off.rotation[2]);
        og.position.set(off.position[0], off.position[1], off.position[2]);
        offBaseY.current = off.position[1];
      }

      // ── Descente du bassin en accroupi ────────────────────────────────────
      // `remapClipsToRig` supprime toutes les pistes .position, et c'est cette
      // piste-là qui portait TOUTE la descente de l'accroupi : mesuré 0,373 sur
      // le rig UTA (bassin 0,968 debout → 0,595 accroupi), le même écart se
      // retrouvant au genou, à la cheville et à la pointe — donc une translation
      // rigide, exactement restituable par un offset de groupe.
      //
      // Piloté par `crouching` et NON par `currentAction` : en marche accroupie
      // l'action reste "idle" et un offset par action ne s'appliquerait jamais.
      //
      // Multiplié par l'échelle : l'offset est en unités monde alors que 0,373
      // est en unités du rig. Sans ça, la valeur calée sur Wraith (0,928) serait
      // fausse de 14 % sur Rampage (0,814) et fausse après tout coup de curseur
      // sur la taille du personnage.
      const wantDrop = (s.crouching || s.sliding)
        ? CROUCH_PELVIS_DROP * baseScale * characterScale
        : 0;
      // Lissage exponentiel : le fondu d'animation dure ~0,2 s, une marche
      // d'escalier de 35 cm sur une frame se verrait.
      crouchDrop.current += (wantDrop - crouchDrop.current) * (1 - Math.exp(-12 * dt));
      og.position.y = offBaseY.current - crouchDrop.current;
    }

    if (animCtrl.current) {
      // ── Émote en cours → vérifier si le gameplay l'interrompt ──────────────
      if (animCtrl.current.isEmotePlaying) {
        const sp = s.horizontalSpeed;
        const interrupt = sp > 0.3 || s.crouching || deadRef.current
          || s.attackToken !== lastAttackToken.current
          || s.castToken !== lastCastToken.current
          || s.jumpToken !== lastJumpToken.current
          || s.reloadToken !== lastReloadToken.current;

        if (interrupt) {
          animCtrl.current.cancelEmote(0.3);
          if (!isIdleVariantRef.current) emoteStore.cancel();
          isIdleVariantRef.current = false;
        } else if (!isIdleVariantRef.current) {
          animCtrl.current.update(dt);
          return;
        }
      }

      // ── Gameplay animation standard ────────────────────────────────────────
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
      } else if (s.oneShotToken !== lastOneShotToken.current) {
        lastOneShotToken.current = s.oneShotToken;
        animCtrl.current.play(s.oneShotAction);
      } else {
        const wasGround = wasGroundedRef.current;
        wasGroundedRef.current = s.grounded;
        if (!wasGround && s.grounded) animCtrl.current.play("landing");

        const cur = animCtrl.current.currentAction;
        const busy = cur === "jump" || cur === "landing";
        if (!busy) {
          // ── Crouch additif (blendé par-dessus la locomotion) ──────────────
          // s.sliding inclus : si le rig n'a pas de clip "Sliding", l'action retombe
          // sur run/crouch — la pose additive garde le perso bas pendant la glissade.
          //
          // EXCLUSION MUTUELLE avec la pose complète (voir `stationaryCrouch` plus
          // bas). Les deux mécanismes sont complémentaires mais PAS cumulables :
          // l'additif replie les jambes PAR-DESSUS ce qui joue en dessous. Quand la
          // pose accroupie complète tourne déjà, le repli s'applique deux fois —
          // mesuré : chevilles à 0,968, soit à hauteur de hanche, jambes escamotées
          // derrière le tablier d'armure. L'additif ne sert QUE sur une locomotion
          // debout (marche/course accroupie).
          // ── Hystérésis : seuil de sortie (0.5) > seuil d'entrée (0.2) pour
          // éviter l'oscillation play("crouch")↔play("idle") quand la vitesse
          // fluctue autour de 0.3 (Agent scan #1).
          //
          // NE PAS tester currentAction === "idle" ici : quand play("crouch")
          // change currentAction en "crouch", la condition s'invalide elle-même
          // à la frame suivante → play("idle") → oscillation infinie à 60 Hz
          // (crouch stutter / freeze, Agent scan #3).
          const stationaryCrouch = s.crouching && !s.sliding
            && (wasStationaryRef.current
              ? s.horizontalSpeed <= 0.5
              : s.horizontalSpeed <= 0.2);
          wasStationaryRef.current = stationaryCrouch;
          // L'additif ne sert QUE sur une locomotion debout (marche/course accroupie)
          // quand les clips crouchwalk dédiés ne sont pas disponibles.
          // ── Si les clips crouchwalk existent (CROUCH_LOCOMOTION chargée), on
          // les utilise pour la locomotion accroupie → PAS d'additif : les clips
          // contiennent déjà la pose accroupie native, sans déformation.
          const useCrouchAdditive = (s.crouching || s.sliding) && !stationaryCrouch
            && !(s.crouching && animCtrl.current.hasCrouchwalkLocomotion);
          animCtrl.current.setCrouch(useCrouchAdditive);

          if (s.climbState !== "none") {
            // L'escalade confisque toute la locomotion : couper la couche de
            // blend, sinon les jambes continueraient de marcher dans le vide
            // pendant que le buste s'accroche.
            animCtrl.current.clearLocomotionBlend();
            const climbClip = s.climbState === "attaching" ? "climb_start"
              : s.climbState === "topping" ? "climb_top"
              : "climb_idle";
            // Fondu TRÈS court (0.08 s) : sur un fondu normal, la pose de saut
            // et celle d'accroche se mélangent à parts égales pendant ~0.3 s, ce
            // qui déforme visiblement le rig au moment précis où le joueur
            // regarde le personnage se coller au mur.
            animCtrl.current.play(climbClip, 0.08);
          } else if (!s.grounded && s.velocity.y < -1) {
            animCtrl.current.play("fall");
          } else {
            // Locomotion basée sur moveState (CharacterController, seuils corrects)
            const ms = s.moveState;
            const sp = s.horizontalSpeed;
            const action = ms === "slide"  ? "slide"
              : ms === "sprint" ? "sprint"
              : ms === "run"    ? "run"
              : ms === "walk"   ? "walk"
              : "idle";

            if (action !== "idle" && !debugMoveLogged.current) {
              debugMoveLogged.current = true;
              if (process.env.NODE_ENV !== 'production') {
                // Diagnostic COMPLET de la décision de blend. Les trois valeurs
                // ci-dessous sont les seules qui peuvent faire retomber la
                // locomotion sur l'ancien `play(action)` : la couche absente,
                // l'intention locale nulle, ou la vitesse sous le seuil.
                const dbg = solveLocomotion({
                  localX: s.localMoveX, localZ: s.localMoveZ, speed: sp,
                  walkSpeed: C.walkSpeed, runSpeed: C.runSpeed,
                });
                console.info(
                  `[AnimDebug] First move: sp=${sp.toFixed(2)} ms=${ms} action=${action} grounded=${s.grounded}\n` +
                  `  hasLocomotionBlend=${animCtrl.current.hasLocomotionBlend} ` +
                  `(${animCtrl.current.locomotionClipCount} clips directionnels)\n` +
                  `  intention locale : x=${s.localMoveX.toFixed(3)} z=${s.localMoveZ.toFixed(3)}\n` +
                  `  solveLocomotion → gait=${dbg.gait} weights=${dbg.weights.length} ` +
                  `[${dbg.weights.map((w) => `${w.dir}:${w.weight.toFixed(2)}`).join(", ")}] ` +
                  `runBlend=${dbg.runBlend.toFixed(2)} timeScale=${dbg.timeScale.toFixed(2)}`,
                );
              }
            }

            // ── Blend directionnel ────────────────────────────────────────
            // Quand les 16 clips UTA sont chargés, la locomotion passe par un
            // mélange pondéré plutôt qu'un `play()` unique : c'est ce qui
            // distingue avancer, reculer et straffer, et ce qui produit les
            // diagonales sans clip dédié.
            //
            // Le fallback `play(action)` reste en place pour les avatars dont
            // les clips directionnels ne sont pas chargés — jamais de T-pose.
            let blendDrives = false;
            if (animCtrl.current.hasLocomotionBlend) {
              // Chargement conditionnel : si les clips crouchwalk ne sont pas
              // chargés, on ne signale PAS crouching → solveLocomotion
              // retourne "walk"/"run" normal, et l'additif gère le repli.
              const useCrouchwalk = s.crouching && animCtrl.current.hasCrouchwalkLocomotion;
              const blend = solveLocomotion({
                localX: s.localMoveX,
                localZ: s.localMoveZ,
                speed: sp,
                walkSpeed: C.walkSpeed,
                runSpeed: C.runSpeed,
                crouching: useCrouchwalk,
              });
              animCtrl.current.setLocomotionBlend(
                blend.weights,
                blend.gait === "idle" ? "walk" : blend.gait,
                // ^ idle → walk (fallback) : setLocomotionBlend n'accepte pas "idle" mais
                // les weights sont vides, donc aucun clip n'est piloté. Le gait sert
                // uniquement à lastLocoGait pour la reprise au prochain mouvement.
                blend.timeScale,
                dt,
                blend.runBlend,
              );
              // LA COUCHE DIRECTIONNELLE POSSÈDE TOUTE LA LOCOMOTION AU SOL —
              // pas seulement les frames où elle produit des poids.
              //
              // La version précédente testait `blend.weights.length > 0`, ce qui
              // la faisait lâcher dès que l'intention tombait à zéro. Or au
              // relâchement des touches l'intention s'annule INSTANTANÉMENT
              // alors que la vitesse décroît progressivement : `moveState` reste
              // "walk" quelques frames, l'ancien `play("walk")` reprenait la main
              // en plein milieu, puis la rendait au pas suivant. D'où le
              // battement idle↔walk observé dans les logs, et un pas qui ne
              // bouclait jamais.
              //
              // `setLocomotionBlend` gère déjà proprement l'arrêt : il rejoue la
              // dernière répartition connue pendant son fondu descendant.
              // La glissade reste exclue — son clip dédié n'a pas d'équivalent
              // directionnel et son timing est celui d'un one-shot.
              blendDrives = action !== "slide";
            }

            // Quand le blend pilote, la couche de BASE reste sur "idle" : c'est
            // elle que setLocomotionBlend atténue à (1 - poidsDuBlend). Rejouer
            // "walk" ici superposerait un second cycle de marche aux mêmes os —
            // le pas ne bouclait alors jamais.
            if (blendDrives) {
              idleVarCtrl.current.update(dt, false);
              lastIdleVarIdx.current = -1;
              // ACCROUPI À L'ARRÊT — pose complète, pas seulement l'additif.
              //
              // L'additif ne fait fléchir que les jambes par-dessus la couche du
              // dessous. Superposé à un cycle de marche il suffit ; superposé à
              // l'idle debout il donne un personnage à moitié plié, buste droit.
              // Immobile, on joue donc la VRAIE pose accroupie en pleine couche.
              // Même prédicat que celui qui coupe l'additif ci-dessus — les deux
              // DOIVENT rester d'accord, sinon on retombe sur le double repli.
              if (!animCtrl.current.isEmotePlaying) {
                animCtrl.current.play(stationaryCrouch ? "crouch" : "idle");
              }
            } else if (action === "idle") {
              const varIdx = idleVarCtrl.current.update(dt, true);
              if (varIdx >= 0 && varIdx !== lastIdleVarIdx.current && idleVarClips.current[varIdx]) {
                lastIdleVarIdx.current = varIdx;
                animCtrl.current.playEmote(idleVarClips.current[varIdx], true, 0.5);
                isIdleVariantRef.current = true;
              } else if (!animCtrl.current.isEmotePlaying) {
                animCtrl.current.play("idle");
              }
            } else {
              idleVarCtrl.current.update(dt, false);
              lastIdleVarIdx.current = -1;
              animCtrl.current.play(action);
              // TimeScale par action : clip stride (m/s à timeScale=1) vs vitesse réelle
              const PC = PLAYER_CONFIG;
              if (action === "walk") {
                animCtrl.current.setLocomotionTimeScale(THREE.MathUtils.clamp(sp / PC.walkStride, 0.5, 2.5));
              } else if (action === "run") {
                animCtrl.current.setLocomotionTimeScale(THREE.MathUtils.clamp(sp / PC.runStride, 0.5, 2.0));
              } else if (action === "sprint") {
                animCtrl.current.setLocomotionTimeScale(THREE.MathUtils.clamp(sp / PC.sprintStride, 0.5, 2.0));
              } else if (action === "slide") {
                // Si le clip slide manque, l'action résolue est run/crouch : on
                // continue de caler la cadence sur la vitesse (sinon foot sliding).
                const isRealSlide = animCtrl.current.currentAction === "slide";
                animCtrl.current.setLocomotionTimeScale(
                  isRealSlide ? 1.0 : THREE.MathUtils.clamp(sp / PC.runStride, 0.5, 2.0),
                );
              }
            }
          }
        } else {
          idleVarCtrl.current.update(dt, false);
        }
      }
      animCtrl.current.update(dt);
    }
  });

  // Arme attachée à la main (rigs compatibles : os "RightHand/LeftHand" → family "mixamo").
  // weaponId fourni uniquement pour sharedRig → RobotGirl (incompatible) reste sans socket.
  return (
    <group ref={group} dispose={null}>
      <group ref={offsetGroup}>
        <primitive object={object} scale={baseScale * characterScale} />
        {/* Forge Personnages : attachements rigides sur le rig propre (sockets génériques). */}
        {attachments?.map((a) => (
          <BoneAttachment key={a.id} rigRoot={object} family="custom" attach={a} />
        ))}
        {weaponId && (
          <WeaponSocket
            rigRoot={object}
            rigScale={baseScale * characterScale}
            weaponId={weaponId}
            family={weaponFamily as "mixamo" | "quaternius" | "custom"}
            characterKind={characterKind ?? "default"}
            editable
            attacking={weaponDrawn}
          />
        )}
      </group>
    </group>
  );
}

// RIG PROPRE COMPATIBLE ARME (Ninja) : utilise SES anims embarquées (idle/marche/course/
// attaque/mort) qui se lient PARFAITEMENT à son squelette, + l'arme de classe VISIBLE.
// On N'INJECTE PAS les packs externes : leur pose de repos (Mixamo, calée sur le Sorcier)
// diffère de celle du Ninja → ils le cassaient en T-pose une fois dégainé.
function OwnAnimWithPack(props: Props) {
  const arch = useArchetype();
  useWeaponEditor(); // re-render si l'éditeur force une arme
  const weaponId = weaponEditorStore.getForcedWeaponId() ?? weaponForArchetype(arch);
  return (
    <OwnAnimCore
      {...props}
      extraClips={NO_EXTRA}        // anims PROPRES uniquement (pas de pack → plus de T-pose)
      weaponId={weaponId}          // arme de classe visible en main
      characterKind={arch ?? "default"}
    />
  );
}

// RIG INCOMPATIBLE (RobotGirl…) : anims embarquées uniquement, pas d'arme (os non standard).
function OwnAnimNoPack(props: Props) {
  const arch = useArchetype();
  return <OwnAnimCore {...props} extraClips={NO_EXTRA} characterKind={arch ?? "default"} />;
}

// AVATARS BULLET/PARAGON (rig UE4) : pas d'anims embarquées.
//
// La locomotion vient de clips DÉJÀ en convention UE4 et DÉJÀ en mètres
// (BULLET_LOCOMOTION), pas du GLB Meshy `soldat_humain`. Ce dernier est exporté
// en CENTIMÈTRES : ses pistes `Hips.position` (Y ≈ 92) étaient renommées
// `pelvis.position` sans conversion d'unité — remapClipsToRig ne fait que
// renommer — et projetaient le squelette à ~60 m. Résultat : marche/course
// invisibles, alors que l'idle restait correct parce qu'il est servi par
// playEmote sur un clip UE4 brut, sans passer par le remap.
//
// WeaponSocket family="custom" car les os UE4 sont "hand_r", pas "RightHand".
function OwnAnimBullet(props: Props) {
  const arch = useArchetype();
  useWeaponEditor();
  const weaponId = weaponEditorStore.getForcedWeaponId() ?? weaponForArchetype(arch);

  const [loadedClips, setLoadedClips] = useState<THREE.AnimationClip[]>([]);
  useEffect(() => {
    let cancelled = false;
    const clips: THREE.AnimationClip[] = [];
    // Abilities (déjà nommées Ability_*) + locomotion (renommée en ActionId).
    const jobs: { path: string; action?: string }[] = [
      ...BULLET_LOCOMOTION,
      // 16 clips directionnels (marche + course × 8 directions) + sprint.
      // Chargés APRÈS BULLET_LOCOMOTION : ils portent des noms distincts
      // (`walk_forward`…) et alimentent la couche de blend, sans écraser les
      // actions simples que le fallback continue d'utiliser.
      ...UTA_LOCOMOTION,
      // Saut découpé + raccord d'escalade. OUBLI CORRIGÉ : ces clips étaient
      // déclarés dans le catalogue mais JAMAIS demandés ici, donc `climb_start`
      // et consorts ne se résolvaient jamais et l'escalade restait sans pose.
      ...UTA_TRAVERSAL,
      // Marche accroupie 4 directions + transitions debout↔accroupi.
      ...CROUCH_LOCOMOTION,
      // PLAYER P2 — Dash, wall run, slide, ledge grab
      ...P2_TRAVERSAL,
      // COMBAT À MAINS NUES — punch1/2/3, punch_charged, kick, kick_charged, hit.
      //
      // CHAÎNON MANQUANT, corrigé le 31/07/2026. Le combo de poings était câblé
      // de bout en bout (clic → advanceCombo → oneShotToken → play(action)) mais
      // AUCUN clip de frappe n'était chargé ici : `play("punch1")` ne résolvait
      // rien, et le filet de sécurité d'AnimationController rabattait sur
      // « idle ». Les dégâts partaient quand même — d'où le symptôme « les coups
      // font mal mais le personnage ne frappe pas ».
      //
      // Le pack cible bien le squelette UE4 (root/pelvis/spine_01/hand_r…, 68 os)
      // et son pelvis est à 0,968 m : il est en MÈTRES, donc pas concerné par le
      // piège des clips UE4 en centimètres.
      //
      // `firstPerAction` est indispensable : le catalogue déclare 43 entrées pour
      // 7 actions seulement.
      ...firstPerAction(UNARMED_PACK),
      ...WRAITH_ANIMS.map((path) => ({ path })),
    ];
    let done = 0;
    let failed = 0;
    // PUBLICATION INCRÉMENTALE, pas tout-ou-rien.
    // L'ancienne version n'appelait setLoadedClips qu'à `done === jobs.length` :
    // un seul fichier lent bloquait les 41 autres, et le personnage restait sans
    // aucun clip jusqu'au bout (c'est ce qui déclenchait le filet de sécurité).
    // On publie donc par paliers — le perso s'anime dès les premiers clips.
    let lastPublished = 0;
    const publish = () => {
      if (cancelled || clips.length === lastPublished) return;
      lastPublished = clips.length;
      setLoadedClips([...clips]);
    };
    const finish = () => {
      done++;
      // Palier tous les 8 clips, plus une publication finale garantie.
      if (done % 8 === 0) publish();
      if (done === jobs.length) {
        publish();
        if (process.env.NODE_ENV !== "production") {
          const loco = clips.filter((c) => /^(walk|run)_/.test(c.name)).length;
          console.info(
            `[AnimLoad] ${clips.length} clips depuis ${jobs.length} fichiers` +
            (failed ? ` · ${failed} ÉCHECS` : "") +
            ` · ${loco} clips directionnels` +
            (loco === 0 ? " ← BLEND DÉSACTIVÉ, le fallback play() prendra la main" : "") +
            ` · noms : [${clips.map((c) => c.name).join(", ")}]`,
          );
        }
      }
    };
    jobs.forEach(({ path, action }) => {
      _emoteLoader.load(path, (gltf) => {
        if (cancelled) return;
        // renameClip conserve les pistes telles quelles et ne change QUE le nom
        // du conteneur → resolveActions trouve l'action par égalité exacte.
        if (action) {
          const src = gltf.animations[0];
          if (src) clips.push(renameClip(src, action));
          else if (process.env.NODE_ENV !== "production") {
            console.warn(`[AnimLoad] ${path} : GLB sans animation → action "${action}" perdue`);
          }
        } else {
          clips.push(...gltf.animations);
        }
        finish();
      }, undefined, (err) => {
        failed++;
        if (process.env.NODE_ENV !== "production") {
          console.warn(`[AnimLoad] ÉCHEC ${path} :`, err);
        }
        finish();
      });
    });
    return () => { cancelled = true; };
  }, []);

  // Les clips de locomotion arrivent EN TÊTE : resolveActions parcourt
  // CLIP_CANDIDATES dans l'ordre et s'arrête au premier trouvé, donc un clip
  // explicitement nommé "walk" gagne sur toute correspondance par sous-chaîne.
  const extraClips = loadedClips;

  return (
    <OwnAnimCore
      {...props}
      extraClips={extraClips}
      weaponId={weaponId}
      weaponFamily="custom"
      characterKind={arch ?? "default"}
    />
  );
}

function OwnAnimImpl(props: Props) {
  // ── Filet de sécurité : si le GLB n'est pas chargé après 5s (Suspense bloqué,
  //    GLB 404, corrompu, Draco fail), on signale quand même au parent que le
  //    personnage est "prêt" → le joueur entre en jeu sans modèle visible au lieu
  //    de rester bloqué sur l'écran de chargement.
  const readyFired = useRef(false);
  useEffect(() => {
    const doReady = () => {
      if (!readyFired.current) {
        readyFired.current = true;
        props.onCharacterReady?.();
      }
    };
    const timer = setTimeout(() => {
      console.warn("[OwnAnimPlayer] Filet de sécurité 15s — le modèle 3D n'a pas chargé à temps (GLB manquant/corrompu/Suspense)");
      doReady();
    }, 15000);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.onCharacterReady, props.path]);

  if (props.sharedRig) return <OwnAnimWithPack {...props} />;
  // `isBulletAvatar` ne couvre QUE les packs Paragon (Wraith / Murdock /
  // Rampage). Les avatars au rig UE Mannequin ajoutés depuis n'ont, eux non
  // plus, aucune animation embarquée — mesuré : 0 clip dans chaque GLB. Sans
  // ce second test ils tombaient dans `OwnAnimNoPack`, qui ne fournit AUCUN
  // clip : personnage figé en pose de repos, sans erreur ni avertissement.
  const rigUE = props.offsetKey
    && (isBulletAvatar(props.offsetKey) || avatarUsesUeRig(props.offsetKey));
  if (rigUE) return <OwnAnimBullet {...props} />;
  return <OwnAnimNoPack {...props} />;
}

export const OwnAnimPlayerCharacter = memo(OwnAnimImpl);
