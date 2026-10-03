// ══════════════════════════════════════════════════════════════════════════════
// characters/HumanCharacter.tsx — Modèle "Humain" (Sorcerer rigué Mixamo, AVEC visage)
//
// IMPORTANT : Sorcerer_hi_poly.fbx est un mesh STATIQUE (0 os). MAIS chaque fichier
// d'anim (~30 Mo) contient le mesh + le rig Mixamo + son animation. On utilise donc
// un FBX d'anim comme MODÈLE (mesh + rig) et on extrait les clips des autres : même
// export Mixamo → mêmes noms d'os → binding DIRECT, aucun retargeting. On retire
// seulement le root motion (Hips.position) pour garder l'anim sur place.
//
// Modèle sans texture → matériau procédural (peau vs tenue selon le nom de matériau).
// ══════════════════════════════════════════════════════════════════════════════

import { Component, memo, useEffect, useMemo, useRef, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { SkeletonUtils } from "three-stdlib";

import type { CharacterConfig } from "../types";
import { CLASSES } from "../classes/classes";
import { AnimationController } from "../animation/AnimationController";
import { dispatchAnimEvent } from "../camera/recoilDispatcher";
import { statusEffects } from "../combat/statusEffects";
import { useArchetype } from "../archetypes/archetypeStore";
import { weaponForArchetype } from "../archetypes/archetypeWeapon";
import { weaponAnimPackForType } from "../weapons/weaponAnimationBinder";
import { useEquippedWeapons } from "../weapons/equippedWeaponStore";
import { weaponRegistry } from "../weapons/weaponRegistry";
import type { WeaponType } from "../weapons/weaponClassifier";
import { ARCHETYPES } from "../archetypes/archetypeCatalog";
import { useGltfAnimationPack } from "../animation/useFbxAnimationPack";
import type { FbxAnimSpec } from "../animation/animationPacks";
import { UNARMED_PACK, UNARMED_STANCE_PACK } from "../animation/animationPacks";
import { WeaponSocket } from "../weapons/WeaponSocket";
import { weaponEditorStore, useWeaponEditor } from "../weapons/weaponEditorStore";
import { characterOffsetStore } from "./characterOffsetStore";
import { applyBodyTint, type PartTints } from "./bodyParts";
import { sanitizeHexColor } from "../utils/color";
import { useBodyTints } from "./bodyTintStore";
import { useAnimOverrideVersion } from "../animation/animClipStore";
import type { PlayerState } from "../runtime/movement/playerState";
import type { ActionId } from "../types";

interface Props {
  config: CharacterConfig;
  playerPosition: React.MutableRefObject<THREE.Vector3>;
  cameraState: React.MutableRefObject<PlayerState>;
  /** true = le joueur est mort → joue l'anim de mort (gel sur la dernière frame). */
  dead?: boolean;
  /** Arme dégainée (F) : anims de combat (pack) + visibilité de l'arme. */
  weaponDrawn?: boolean;
  /** Forge Personnages : attachements rigides (casque/cape/accessoire) montés sur le rig. */
  attachments?: CharAttachment[];
  /** Forge Personnages : multiplicateur d'échelle global du perso (défaut 1). */
  scaleMult?: number;
}

import { useCharacterScale } from "./useCharacterScale";
import { BoneAttachment, type CharAttachment } from "./BoneAttachment";

import { HUMAN_FALLBACK } from "./avatarAssets"; // chemins PARTAGÉS avec le préchargeur (anti-drift)

// ── Réglages (à ajuster visuellement si besoin) ──────────────────────────────
// HUMAN_SCALE = conversion d'unités FBX Mixamo (cm) → mètres monde.
// CHARACTER_SCALE = facteur global pour adapter le perso aux maps (cf.
// characters/characterScale.ts). Ne change PAS HUMAN_SCALE — change CHARACTER_SCALE
// pour redimensionner joueur + PNJ ensemble.
const HUMAN_TARGET_HEIGHT = 1.8;   // hauteur cible (m) — normalisation bbox du GLB Sorcier
const HUMAN_YAW_OFFSET = Math.PI;  // orientation "face"
// Cache du facteur d'échelle par GLB SOURCE (uuid) → pas de re-mesure bbox à chaque re-mount.
const baseScaleCache = new Map<string, number>();

// Nettoie un clip pour le rejouer "sur place" sans artefact de conversion FBX→GLB :
//   • retire la POSITION du bone racine (Hips/Root/Armature) → root motion sur place ;
//   • retire TOUTE piste de .scale → une anim humanoïde Mixamo n'anime JAMAIS l'échelle
//     des os ; une piste scale parasite (cm→m baké à la conversion) écrase/contorsionne
//     le perso quand l'arme est dégainée (clips de pack GLB). On la supprime.
// Le bone racine garde sa rotation (orientation du corps), on n'enlève que sa position.
function stripRootMotion(clip: THREE.AnimationClip): THREE.AnimationClip {
  const tracks = clip.tracks.filter((t) => {
    const dot = t.name.lastIndexOf(".");
    const bone = dot !== -1 ? t.name.slice(0, dot) : t.name;
    const prop = dot !== -1 ? t.name.slice(dot) : "";
    if (prop === ".scale") return false;                       // artefact d'échelle → out
    if (prop === ".position" && /(hips|root|armature|rootnode)$/i.test(bone)) return false; // root motion → out
    return true;
  });
  return new THREE.AnimationClip(clip.name, clip.duration, tracks);
}

// TEINTE GLOBALE (option C) : le mesh Sorcier est un blob Tripo monolithique (1 matériau,
// couleurs en vertex-colors) → impossible de cibler bottes/visage. On applique donc UNE
// teinte d'ensemble : material.color MULTIPLIE les vertex-colors. Blanc (#ffffff) = vraies
// couleurs du modèle (neutre) ; toute autre couleur recolore l'ensemble. On clone le
// matériau (isole le fondu d'invisibilité) puis on POSE la couleur (idempotent → pas de
// dérive cumulative au re-réglage de la teinte).
// + TEINTE PAR-PARTIE (option B) : par-dessus la teinte globale, applyBodyTint re-multiplie
// les vertex-colors par BANDE DE HAUTEUR (bottes/pantalon/ceinture/torse/visage). Blanc
// partout = neutre. Coexiste avec la teinte globale (final = vColor × global × bande).
// Recolor matériau (teinte globale) — SYNCHRONE, peu coûteux. La teinte PAR-PARTIE
// (applyBodyTint, boucle per-vertex lourde) est appliquée séparément, DIFFÉRÉE hors de la
// frame de mount par l'appelant (cf. useEffect) pour ne pas figer l'apparition du perso.
function applyMaterial(obj: THREE.Object3D, tint: THREE.Color) {
  const recolor = (mat: THREE.Material): THREE.Material => {
    const c = mat.clone();
    const std = c as THREE.MeshStandardMaterial;
    if (std.color) std.color.copy(tint); // multiplie les vertex-colors (blanc = neutre)
    return c;
  };
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    if (!m.isMesh || !m.material) return;
    m.castShadow = true;
    m.receiveShadow = true;
    if (Array.isArray(m.material)) m.material = m.material.map(recolor);
    else m.material = recolor(m.material);
  });
}

function HumanCore({ config, playerPosition, cameraState, dead = false, weaponDrawn = false, attachments, scaleMult = 1, extraClips, unarmedClips }: Props & { extraClips: THREE.AnimationClip[]; unarmedClips: THREE.AnimationClip[] }) {
  const group = useRef<THREE.Group>(null);
  const cls = CLASSES[config.classId];
  const deadRef = useRef(false);
  deadRef.current = dead;
  // Échelle LIVE : si l'admin bouge le slider, le mesh se re-render au prochain
  // tick React (la collision/caméra restent figées au boot — reload pour update).
  const characterScale = useCharacterScale();

  const tint     = useMemo(() => new THREE.Color(sanitizeHexColor(config.tint ?? cls.outfitColor, cls.outfitColor)), [config.tint, cls.outfitColor]);
  const emissive = useMemo(() => new THREE.Color(cls.outfitEmissive), [cls.outfitEmissive]);
  const skin     = useMemo(() => new THREE.Color(config.skinColor ?? "#e0ac69"), [config.skinColor]);

  // Modèle + anims en GLB (parsing OFF-thread + Draco/WebP → ~3,8 Mo au lieu de 124 Mo
  // de FBX parsés sur le thread principal = fin du gros freeze au spawn).
  //   • Breathing Idle.glb = mesh rigué + idle (compressé)
  //   • Running/Magic/Death.glb = ANIM-ONLY (squelette + anim, sans mesh) ≈ 100 Ko
  const idleG  = useGLTF(HUMAN_FALLBACK.mesh);      // MESH (rig source)
  // IDLE depuis un GLB ANIM-ONLY : l'anim embarquée dans le GLB de mesh n'est pas
  // garantie propre (une quantification `gltf-transform optimize` avait déjà donné
  // une T-pose sur le pack précédent). On charge donc l'idle séparément.
  const idleAnimG = useGLTF(HUMAN_FALLBACK.idle);   // anim-only (idle SANS arme)
  const walkG  = useGLTF(HUMAN_FALLBACK.walk);      // anim-only (marche)
  const runG   = useGLTF(HUMAN_FALLBACK.run);       // anim-only (course/sprint)
  const castG  = useGLTF(HUMAN_FALLBACK.cast);      // anim-only (sort)

  // Le MODÈLE = le mesh rigué du GLB idle (clone indépendant). Échelle NORMALISÉE par
  // bounding-box (hauteur cible ≈ 1,8 m) : le GLB (mètres) a une échelle source différente
  // du FBX (cm) → on ne dépend plus d'une constante figée, on cale sur la vraie hauteur.
  const { cloned, baseScale } = useMemo(() => {
    const c = SkeletonUtils.clone(idleG.scene);
    // `baseScale` ne dépend que du GLB SOURCE → on le CACHE par scène source (uuid). Évite un
    // Box3.setFromObject (traverse toute la géométrie du clone) à CHAQUE re-mount du perso
    // (changement d'archétype/avatar) — c'était un hitch au changement de perso.
    let bs = baseScaleCache.get(idleG.scene.uuid);
    if (bs === undefined) {
      c.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(c);
      const h = Math.max(0.001, box.max.y - box.min.y);
      bs = HUMAN_TARGET_HEIGHT / h;
      baseScaleCache.set(idleG.scene.uuid, bs);
    }
    return { cloned: c, baseScale: bs };
  }, [idleG.scene]);
  const bodyTints = useBodyTints(); // teintes par-partie (bandes Y), re-applique au changement
  useEffect(() => {
    applyMaterial(cloned, tint); // recolor global SYNC → le perso s'affiche correctement de suite
    // Teinte PAR-PARTIE (lourde : re-multiplie ~1,45M vertex-colors par bande) DIFFÉRÉE en rAF
    // → hors de la frame de mount. Le perso apparaît immédiatement, le tint par-partie s'applique
    // à la frame suivante (pop imperceptible) au lieu de bloquer plusieurs frames = fin du freeze
    // au changement de perso. (applyBodyTint early-out instantané si aucune teinte active.)
    const raf = requestAnimationFrame(() => {
      cloned.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.isMesh && m.material) applyBodyTint(m, bodyTints);
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [cloned, tint, bodyTints]);
  // Libère les MATÉRIAUX clonés (applyMaterial fait mat.clone() par mesh) au démontage du perso
  // → évite une fuite JS lente sur les changements répétés de perso. On NE touche PAS
  // geometry/textures (PARTAGÉES avec la scène source via SkeletonUtils.clone).
  useEffect(() => {
    const c = cloned;
    return () => {
      c.traverse((o) => {
        const m = (o as THREE.Mesh).material;
        const mats = Array.isArray(m) ? m : m ? [m] : [];
        for (const mat of mats) (mat as THREE.Material).dispose();
      });
    };
  }, [cloned]);

  // `unarmedClips` (combo punch/kick + impact) arrive en PROP — chargé par HumanCoreSafe
  // sous un FbxPackBoundary : un GLB punch manquant dégrade en [] au lieu de faire
  // disparaître tout le joueur (CharacterErrorBoundary).

  // Clips (même rig → binding direct, juste root motion retiré).
  const clips = useMemo(() => {
    const raw: [string, THREE.AnimationClip | undefined][] = [
      ["Breathing Idle", idleAnimG.animations[0]],  // anim-only propre (≠ Idle.glb optimisé)
      ["Walking", walkG.animations[0]],          // → slot walk (déplacement normal)
      ["Running", runG.animations[0]],           // → slot run + sprint (fallback "Running")
      ["Standing 2H Magic Attack 01", castG.animations[0]],
      // Pas d'entrée « mort » : aucun clip de mort n'existe sur le rig Paragon
      // dans le dépôt. Voir HUMAN_FALLBACK — on laisse le slot vide plutôt que
      // d'y mettre une chute d'escalade qui jouerait une pose d'agrippement.
    ];
    const out: THREE.AnimationClip[] = [];
    for (const [name, src] of raw) {
      if (!src) continue;
      src.name = name;
      out.push(stripRootMotion(src));
    }
    // Pack d'archétype d'abord (priorité par nom) + clips mains nues + root motion retiré.
    return [...extraClips.map(stripRootMotion), ...unarmedClips.map(stripRootMotion), ...out];
  }, [idleAnimG, walkG, runG, castG, extraClips, unarmedClips]);

  const animVer = useAnimOverrideVersion(); // rebuild SEULEMENT quand un override change
  const animCtrl = useRef<AnimationController | null>(null);
  // BUILD du contrôleur : UNIQUEMENT quand le mesh change (cloned) ou qu'un override est
  // édité (animVer). PLUS sur weaponDrawn → le dégainage ne recrée plus le mixer (fini le
  // hitch + le restart d'anim « collision »). Le jeu de clips initial vient de la closure.
  useEffect(() => {
    if (!group.current || clips.length === 0) { animCtrl.current = null; return; }
    animCtrl.current = new AnimationController(group.current, clips, {
      initial: lastActionRef.current, onEvent: dispatchAnimEvent,
      avatarKey: config.modelId ?? "wraith",
      avatarMode: weaponDrawn ? "drawn" : "base",
    });
    return () => { animCtrl.current?.dispose(); animCtrl.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cloned, animVer]);

  // SWAP des clips (dégainer/rengainer) SANS rebuild : setClips réutilise le mixer et
  // crossfade l'action courante vers sa version du nouveau mode (base↔dégainé fluide).
  useEffect(() => {
    animCtrl.current?.setClips(clips, weaponDrawn ? "drawn" : "base");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clips, weaponDrawn]);

  const currentYaw = useRef(0);
  const lastCastToken = useRef(0);
  const lastAttackToken = useRef(0);
  const lastReloadToken = useRef(0);
  const lastJumpToken = useRef(0);
  const lastOneShot = useRef(0); // canal générique punch/kick/hit/dodge
  const invisRef = useRef(false);
  // Arme : override de l'éditeur (visualisation) > archétype > arme de classe par défaut.
  const archetype = useArchetype();
  useWeaponEditor(); // re-render si l'éditeur force une arme
  const equipped = useEquippedWeapons();
  // Priorité : override éditeur (admin) > arme PRINCIPALE équipée. RIEN d'équipé → AUCUNE
  // arme visible (mode mains nues : poings de combat, pas d'arme d'archétype fantôme).
  const archWeaponId = weaponEditorStore.getForcedWeaponId() ?? equipped.primary;

  // Offset d'orientation PAR ANIMATION (corrige une anim retournée) — appliqué chaque
  // frame au groupe local selon l'action en cours, sans toucher aux assets.
  const offsetGroup = useRef<THREE.Group>(null);
  const avatarKey = config.modelId ?? "wraith";
  const lastActionRef = useRef<ActionId>("idle"); // anim en cours → évite le snap-idle au rebuild
  // Cache de l'offset : on ne relit/ré-applique que si action/état/réglage change (anti-GC).
  const offActRef = useRef(""); const offModeRef = useRef(""); const offVerRef = useRef(-1);

  useFrame((_, dt) => {
    const g = group.current;
    if (!g) return;
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

    const targetYaw = s.yaw + HUMAN_YAW_OFFSET;
    currentYaw.current = THREE.MathUtils.lerp(currentYaw.current, targetYaw, 1 - Math.exp(-10 * dt));
    g.rotation.y = currentYaw.current;

    // Offset spécifique à l'animation EN COURS (groupe local) → corrige l'orientation
    // d'une anim donnée (ex: idle d'arme retourné) sans affecter les autres.
    const og = offsetGroup.current;
    if (og) {
      const act = animCtrl.current?.currentAction ?? "idle";
      lastActionRef.current = act;
      const mode = s.weaponDrawn ? "drawn" : "base"; // idle rangé ≠ idle dégainé
      const ver = characterOffsetStore.getVersion();
      // Ne relit + ré-applique QUE si quelque chose a changé (sinon 0 alloc, 0 matrice salie).
      if (act !== offActRef.current || mode !== offModeRef.current || ver !== offVerRef.current) {
        offActRef.current = act; offModeRef.current = mode; offVerRef.current = ver;
        const off = characterOffsetStore.get(avatarKey, mode as "base" | "drawn", act);
        og.rotation.set(off.rotation[0], off.rotation[1], off.rotation[2]);
        og.position.set(off.position[0], off.position[1], off.position[2]);
      }
    }

    if (animCtrl.current) {
      // CALIBRAGE d'arme : pose FIGÉE — aucune animation (mixer gelé, aucun play) → les
      // réglages d'offset s'appliquent sur un perso parfaitement immobile.
      if (weaponEditorStore.isPoseFrozen()) return;
      // Mort : prioritaire sur tout → joue l'anim de mort une fois et stoppe la locomotion.
      if (deadRef.current) {
        if (animCtrl.current.currentAction !== "death") animCtrl.current.play("death");
        animCtrl.current.update(dt);
        return;
      }
      // One-shot générique (punch/kick/hit/dodge) — prioritaire sur la locomotion, cède à la
      // mort. Joue l'action signalée puis retour auto à l'idle (ONE_SHOT).
      if (s.oneShotToken !== lastOneShot.current) {
        lastOneShot.current = s.oneShotToken;
        animCtrl.current.play(s.oneShotAction);
      }
      const sp = s.horizontalSpeed;
      if (s.attackToken !== lastAttackToken.current) {
        lastAttackToken.current = s.attackToken;
        animCtrl.current.play("attack"); // auto-attaque (clic gauche)
      } else if (s.reloadToken !== lastReloadToken.current) {
        lastReloadToken.current = s.reloadToken;
        animCtrl.current.play("channeling"); // rechargement (R)
      } else if (s.castToken !== lastCastToken.current) {
        lastCastToken.current = s.castToken;
        animCtrl.current.play("cast"); // 1 seule anim de sort chargée (perf)
      } else if (s.jumpToken !== lastJumpToken.current) {
        lastJumpToken.current = s.jumpToken;
        animCtrl.current.play("jump"); // saut (Espace) — one-shot
      } else {
        const cur = animCtrl.current.currentAction;
        // BUSY = toute action en cours que la locomotion ne doit PAS écraser. Les coups de
        // poing/pied manquaient ici → la locomotion (idle/walk) écrasait l'anim de punch à
        // la frame suivante = « les poings ne marchent pas ». Couvre TOUS les one-shots.
        const busy = cur === "cast" || cur === "ultimate" || cur === "attack" || cur === "channeling"
          || cur === "punch1" || cur === "punch2" || cur === "punch3" || cur === "punch_charged"
          || cur === "kick" || cur === "kick_charged" || cur === "hit" || cur === "dodge";
        if (!busy && s.crouching) {
          animCtrl.current.play("crouch"); // accroupi maintenu (Ctrl) — prioritaire sur la loco
        } else if (!busy) {
          // Locomotion pilotée par la VITESSE horizontale (et non par `grounded`) :
          // en hub orbital le perso est "aérien" mais doit montrer sa course quand
          // il se déplace, au lieu de glisser figé en idle.
          // Logique demandée : idle (immobile) → walk (déplacement normal) → sprint
          // (course/touche sprint, vitesse élevée). Le clip "run" reste chargé (utilisé
          // par les packs de classe dégainés) mais la locomotion de base saute walk↔sprint.
          const action = sp > 7.5 ? "sprint" : sp > 0.3 ? "walk" : "idle";
          animCtrl.current.play(action);
          if (action === "walk") {
            // Clip "Walking" auteuré ~1,5 m/s : cadence calée sur la vitesse réelle
            // (jambes lentes au pas, plus rapides en marche soutenue) sans glisse.
            animCtrl.current.setLocomotionTimeScale(THREE.MathUtils.clamp(sp / 1.5, 0.6, 2.2));
          } else if (action === "sprint") {
            // Sprint = clip "Running" (fallback) calé sur ~6 m/s.
            animCtrl.current.setLocomotionTimeScale(THREE.MathUtils.clamp(sp / 6, 0.8, 1.4));
          }
        }
      }
      animCtrl.current.update(dt);
    }
  });

  return (
    <group ref={group} dispose={null}>
      <group ref={offsetGroup}>
        <primitive object={cloned} scale={baseScale * characterScale * scaleMult} />
        {/* Forge Personnages : attachements rigides (casque/cape/accessoire) sur le rig Sorcier (mixamo). */}
        {attachments?.map((a) => (
          <BoneAttachment key={a.id} rigRoot={cloned} family="mixamo" attach={a} />
        ))}
        {/* Arme PRINCIPALE : seulement si équipée (inventaire) ou forcée (éditeur).
            Rien d'équipé → AUCUN modèle d'arme = vrai mode mains nues. */}
        {archWeaponId && (
          <WeaponSocket
            rigRoot={cloned}
            rigScale={baseScale * characterScale}
            weaponId={archWeaponId}
            family="mixamo"
            characterKind={archetype ?? "default"}
            editable
            attacking={weaponDrawn} /* visible uniquement arme dégainée (visibility "combat") */
          />
        )}
        {/* GUERRIER : bouclier par DÉFAUT en main gauche (arch_shield) — SAUF si une arme
            secondaire est équipée (elle prend la place de l'offhand). */}
        {archetype === "guerrier" && !!archWeaponId && !equipped.secondary && (
          <WeaponSocket
            rigRoot={cloned}
            rigScale={baseScale * characterScale}
            weaponId="arch_shield"
            family="mixamo"
            characterKind={archetype}
            editable
            attacking={weaponDrawn}
          />
        )}
        {/* ARME SECONDAIRE équipée (offhand : bouclier, dague…) — socket selon son profil. */}
        {equipped.secondary && (
          <WeaponSocket
            rigRoot={cloned}
            rigScale={baseScale * characterScale}
            weaponId={equipped.secondary}
            family="mixamo"
            characterKind={archetype ?? "default"}
            editable
            attacking={weaponDrawn}
          />
        )}
        {/* ARCHER : flèche encochée en MAIN DROITE (arch_arrow, socket RightHand, visibility
            "combat" → visible seulement arme dégainée). L'arc (main gauche) reste intact. */}
        {archetype === "archer" && (
          <WeaponSocket
            rigRoot={cloned}
            rigScale={baseScale * characterScale}
            weaponId="arch_arrow"
            family="mixamo"
            characterKind={archetype}
            editable
            attacking={weaponDrawn}
          />
        )}
      </group>
    </group>
  );
}

// Repli si un FBX du pack échoue au chargement (useLoader lève, ≠ useGLTF) :
// on retombe sur les anims Sorcier par défaut sans casser le rendu du joueur.
// `resetKey` (= archétype) remplace l'ancien `key={arch}` : changer d'archétype NE REMONTE
// PLUS tout le sous-arbre perso (clone + mixer + armes) — seul le pack de clips change, swappé
// in-place via setClips (HumanCore). getDerivedStateFromProps réinitialise l'état d'échec quand
// l'archétype change (sinon, une fois en fallback, on y resterait au prochain archétype).
class FbxPackBoundary extends Component<
  { fallback: ReactNode; children: ReactNode; resetKey: string },
  { failed: boolean; key: string }
> {
  state = { failed: false, key: this.props.resetKey };
  static getDerivedStateFromError() { return { failed: true }; }
  static getDerivedStateFromProps(
    props: { resetKey: string }, state: { failed: boolean; key: string },
  ): { failed: boolean; key: string } | null {
    if (props.resetKey !== state.key) return { failed: false, key: props.resetKey };
    return null;
  }
  componentDidCatch(e: unknown) { console.warn("[HumanCharacter] pack FBX non chargé → anims par défaut :", e); }
  render() { return this.state.failed ? this.props.fallback : this.props.children; }
}

const NO_CLIPS: THREE.AnimationClip[] = [];
const EMPTY_PACK: FbxAnimSpec[] = [];

// Clips MAINS NUES chargés ICI (sous le FbxPackBoundary de HumanCoreSafe) : un GLB punch
// manquant fait tomber CE composant → fallback = HumanCore sans clips mains nues, le joueur
// reste visible (vs avant : l'erreur remontait à CharacterErrorBoundary → joueur invisible).
function HumanCoreUnarmed(props: Props & { extraClips: THREE.AnimationClip[] }) {
  const unarmedClips = useGltfAnimationPack(UNARMED_PACK, false); // rig Sorcier → garde "mixamorig:"
  return <HumanCore {...props} unarmedClips={unarmedClips} />;
}
function HumanCoreSafe(props: Props & { extraClips: THREE.AnimationClip[] }) {
  return (
    <FbxPackBoundary resetKey="unarmed" fallback={<HumanCore {...props} unarmedClips={NO_CLIPS} />}>
      <HumanCoreUnarmed {...props} />
    </FbxPackBoundary>
  );
}

// Pack d'archétype chargé SANS strip (Sorcier = rig Mixamo natif, os préfixés
// "mixamorig:" → on GARDE le préfixe pour que les clips se lient).
function HumanWithPack({ pack, ...props }: Props & { pack: FbxAnimSpec[] }) {
  const clips = useGltfAnimationPack(pack, false); // GLB, garde le préfixe "mixamorig:" (rig Sorcier)
  // Pack fourni à l'AnimationController seulement si l'arme est DÉGAINÉE (idle combat
  // vs idle normal) — sans re-cloner le mesh.
  return <HumanCoreSafe {...props} extraClips={props.weaponDrawn ? clips : NO_CLIPS} />;
}
function HumanNoPack(props: Props) {
  return <HumanCoreSafe {...props} extraClips={NO_CLIPS} />;
}

function HumanCharacterImpl(props: Props) {
  // Pack d'anim DÉGAINÉ piloté par l'ARME ÉQUIPÉE :
  //   • arme équipée (inventaire / éditeur) → pack du TYPE de l'arme ;
  //   • RIEN d'équipé → STANCE MAINS NUES (posture de combat, poings levés) ;
  //   • repli : arme par défaut de l'archétype si elle est forcée par l'éditeur.
  // Fourni à l'AnimationController seulement arme DÉGAINÉE ; rangée → anims propres du perso.
  const equipped = useEquippedWeapons();
  useWeaponEditor();
  const forcedId = weaponEditorStore.getForcedWeaponId();
  const effectiveId = forcedId ?? equipped.primary;
  const equippedType = effectiveId
    ? (weaponRegistry.get(effectiveId)?.type as WeaponType | undefined)
    : undefined;
  const pack = equippedType ? weaponAnimPackForType(equippedType) : UNARMED_STANCE_PACK;
  if (pack.length === 0) return <HumanNoPack {...props} />;
  return (
    <FbxPackBoundary resetKey={`${equippedType ?? "unarmed"}`} fallback={<HumanNoPack {...props} />}>
      <HumanWithPack {...props} pack={pack} />
    </FbxPackBoundary>
  );
}

export const HumanCharacter = memo(HumanCharacterImpl);
