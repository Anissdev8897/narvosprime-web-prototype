// weapons/WeaponSocket.tsx — montage conditionnel + Suspense + ErrorBoundary + attache impérative
// Supporte les armes GLB (useGLTF) ET FBX (useLoader+FBXLoader) : dispatch par
// extension vers deux composants loader qui partagent la même logique d'attache.
import { Component, memo, Suspense, useEffect, useRef, type ReactNode } from "react";
import { useGLTF } from "@react-three/drei";
import { useLoader } from "@react-three/fiber";
import { FBXLoader } from "three-stdlib";
import * as THREE from "three";
import { findBone, boneWorldScale } from "./findBone";
import { resolveOffset } from "./resolveOffset";
import { cloneWeapon } from "./cloneWeapon";
import { RIG_PROFILES } from "./rigProfiles";
import { weaponRegistry } from "./weaponRegistry";
import { weaponOffsetStore, useWeaponOffsets } from "./weaponOffsetStore";
import { weaponCalibrationStore, useWeaponCalibration } from "./weaponCalibrationStore";
import { weaponEditorStore, useWeaponEditor } from "./weaponEditorStore";
import type { CalibMode } from "./weaponCalibrationStore";
import { autoWeaponScale } from "./weaponScale";
import type { WeaponType } from "./weaponClassifier";
import type { RigFamily, WeaponProfile, SocketName } from "./weaponTypes";

// Socket d'arme RANGÉE : le torse (Spine), pas la main. Une arme rangée parentée à la main
// suit le balancement des bras (course/idle) → elle "bouge" sur le dos. Sur le Spine elle
// reste collée au corps. (Seul Spine est dispo dans SocketName ; couvre dos/torse.)
const SHEATHED_SOCKET: SocketName = "Spine";

interface Props {
  rigRoot: THREE.Object3D;   // objet contenant les os (le clone rendu)
  rigScale: number;          // échelle effective du perso (déclencheur de recompute)
  weaponId: string | undefined;
  family: RigFamily;
  attacking: boolean;        // pour visibility "combat" (ignoré si "always")
  /** Type de personnage (archétype joueur / "monster") → clé de calibrage classe×arme. */
  characterKind?: string;
  /** true = arme du JOUEUR → exposée à l'éditeur in-game (gizmo). */
  editable?: boolean;
}

// Chemins d'armes déjà constatés manquants/404 → on n'essaie PLUS de les charger.
// Évite le churn (throw → ErrorBoundary → re-render) à chaque re-montage du perso
// (ex: changement d'archétype) quand un fichier d'arme est absent → supprime les
// micro-freezes et le spam console.
const FAILED_WEAPON_PATHS = new Set<string>();

// Un modèle d'arme manquant/cassé ne doit jamais crasher le perso (cf. ProcHeadBoundary).
class WeaponErrorBoundary extends Component<{ path: string; children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch() {
    FAILED_WEAPON_PATHS.add(this.props.path); // mémorise l'échec → plus de re-tentative
    console.warn("[WeaponSocket] arme non chargée (ignorée ensuite) :", this.props.path);
  }
  render() { return this.state.failed ? null : this.props.children; }
}

export const WeaponSocket = memo(function WeaponSocket(p: Props) {
  const profile = weaponRegistry.get(p.weaponId);
  if (!profile) return null;                          // désarmé : aucun hook plus bas (règle des hooks)
  if (FAILED_WEAPON_PATHS.has(profile.path)) return null; // arme manquante connue → on n'essaie plus
  return (
    <WeaponErrorBoundary key={p.weaponId} path={profile.path}> {/* retry au changement d'arme */}
      <Suspense fallback={null}>                      {/* l'arme ne bloque jamais le rendu du perso */}
        <WeaponSocketInner
          rigRoot={p.rigRoot} rigScale={p.rigScale}
          profile={profile} family={p.family} attacking={p.attacking}
          characterKind={p.characterKind ?? p.family}
          editable={p.editable ?? false}
        />
      </Suspense>
    </WeaponErrorBoundary>
  );
});

interface InnerProps {
  rigRoot: THREE.Object3D;
  rigScale: number;
  profile: WeaponProfile;
  family: RigFamily;
  attacking: boolean;
  characterKind: string;
  editable: boolean;
}

/** Logique d'attache PARTAGÉE (GLB & FBX) : os → socket → arme clonée + offset.
 *  `attachVersion` : versions qui exigent un RE-CLONE (offsets + calibrage).
 *  `reapplyVersion` : versions qui n'exigent qu'un RE-APPLY d'offset léger (+ éditeur :
 *    previewMode/gizmo) → on NE re-clone PAS l'arme à chaque frame de drag du gizmo. */
function useAttachWeapon(scene: THREE.Object3D, p: InnerProps, attachVersion: number, reapplyVersion: number) {
  const { rigRoot, rigScale, profile, family, attacking, characterKind, editable } = p;
  const socketRef = useRef<THREE.Object3D | null>(null);
  const weaponRef = useRef<THREE.Object3D | null>(null);
  const boneRef = useRef<THREE.Object3D | null>(null);   // os porteur ACTUEL (main ou Spine)
  const modeRef = useRef<CalibMode | null>(null);        // mode attaché ACTUEL (drawn/sheathed)
  const attackingRef = useRef(attacking);
  attackingRef.current = attacking;

  // Mode de port : DÉGAINÉE (attacking) ou RANGÉE. L'éditeur peut forcer l'aperçu d'un mode
  // (previewMode) pour régler l'arme rangée sans avoir à la dégainer/rengainer en jeu.
  const computeMode = (): CalibMode => {
    const pv = editable ? weaponEditorStore.getPreviewMode() : null;
    return pv ?? (attackingRef.current ? "drawn" : "sheathed");
  };

  // Os porteur selon le mode : DÉGAINÉE → main (profile.socket), RANGÉE → torse (Spine).
  // Repli sur la main si pas de Spine (jamais détaché).
  // Fallback générique main droite si l'os exact est introuvable.
  const boneForMode = (mode: CalibMode): THREE.Object3D | null => {
    const socketName: SocketName = mode === "drawn" ? profile.socket : SHEATHED_SOCKET;
    const pat = RIG_PROFILES[family]?.[socketName] ?? RIG_PROFILES.custom[socketName];
    let bone = findBone(rigRoot, pat);
    if (bone) return bone;
    // Fallback pour mode dégainé : cherche un os main droite générique
    if (mode === "drawn") {
      bone = findBone(rigRoot, /(right.?hand|hand.?right|RightHand|Hand_R|hand_r)$/i);
      if (bone) return bone;
      bone = findBone(rigRoot, /hand/i); // dernier recours : n'importe quel os "hand"
      if (bone) return bone;
    }
    // Fallback pour mode rangé : retente avec l'os de socket dégainé
    const dp = RIG_PROFILES[family]?.[profile.socket] ?? RIG_PROFILES.custom[profile.socket];
    return findBone(rigRoot, dp);
  };

  // Attache le socket à un os en annulant l'échelle monde de CET os (espace mètres).
  const mountOnBone = (socket: THREE.Object3D, bone: THREE.Object3D) => {
    const k = boneWorldScale(bone) || 1;
    socket.scale.setScalar(1 / k);
    bone.add(socket);
  };
  // Applique l'offset (pos/rot/échelle) du MODE courant à l'arme déjà attachée.
  //   1. override par-arme-exacte (weaponOffsetStore) · 2. calibrage classe×type×MODE
  //   · 3. offset profil · 4. auto-scale bbox.
  const applyModeOffset = (weapon: THREE.Object3D) => {
    const mode = computeMode();
    const off = resolveOffset(profile, family);
    const cal = weaponCalibrationStore.resolve(characterKind, profile.type, mode);
    const ovr = weaponOffsetStore.get(profile.id);
    const pos = ovr?.position ?? cal?.position ?? off.position;
    const rot = ovr?.rotation ?? cal?.rotation ?? off.rotation;
    const scl = ovr?.scale ?? cal?.scale ?? autoWeaponScale(weapon, profile.type as WeaponType);
    weapon.position.fromArray(pos);
    weapon.quaternion.setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2]));
    weapon.scale.setScalar(scl);
  };

  // Recompute sur rigScale (slider live) + override d'offset, JAMAIS sur attacking.
  useEffect(() => {
    const mode0 = computeMode();
    const bone = boneForMode(mode0);
    if (!bone) {
      console.warn(`[WeaponSocket] os introuvable : famille=${family} socket=${mode0 === "drawn" ? profile.socket : SHEATHED_SOCKET}`);
      return;
    }
    const socket = new THREE.Object3D();
    socket.name = `__weapon_socket_${profile.id}__`;

    const weapon = cloneWeapon(scene);
    weapon.traverse((o) => { const m = o as THREE.Mesh; if (m.isMesh) m.castShadow = true; });
    weaponRef.current = weapon;
    applyModeOffset(weapon); // offset du mode courant (dégainé/rangé)

    socket.add(weapon);
    socket.visible = profile.visibility === "always" ? true : attackingRef.current;
    mountOnBone(socket, bone);                         // annule l'échelle de CET os
    socketRef.current = socket;
    boneRef.current = bone;
    modeRef.current = mode0;

    // Expose l'arme du JOUEUR à l'éditeur in-game (gizmo) + la combinaison à sauver.
    if (editable) {
      weaponEditorStore.setObject(weapon);
      weaponEditorStore.setTarget({ kind: characterKind, weaponType: profile.type });
    }

    return () => {
      boneRef.current?.remove(socket);                 // retire de l'os porteur courant (main OU Spine)
      socketRef.current = null;
      weaponRef.current = null;
      boneRef.current = null;
      modeRef.current = null;
      if (editable && weaponEditorStore.getObject() === weapon) weaponEditorStore.setObject(null);
    };
  }, [rigRoot, rigScale, scene, profile, family, characterKind, editable, attachVersion]);

  // Dégaine/rengaine (attacking) ou réglage éditeur (reapplyVersion) : si le MODE change, on
  // RE-PARENTE le socket sur le bon os (main↔Spine) SANS re-cloner l'arme, puis ré-applique
  // l'offset du mode. Une arme rangée passe ainsi sur le torse → elle ne suit plus la main.
  useEffect(() => {
    const socket = socketRef.current;
    const weapon = weaponRef.current;
    if (!socket || !weapon) return;
    const mode = computeMode();
    if (mode !== modeRef.current) {
      const newBone = boneForMode(mode);
      if (newBone && newBone !== boneRef.current) {
        boneRef.current?.remove(socket);
        mountOnBone(socket, newBone);                  // recalcule 1/k pour le nouvel os
        boneRef.current = newBone;
      }
      modeRef.current = mode;
    }
    applyModeOffset(weapon);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attacking, reapplyVersion]);

  // Visibilité — toggle seul, aucun update/frame.
  useEffect(() => {
    const s = socketRef.current;
    if (s) s.visible = profile.visibility === "always" ? true : attacking;
  }, [attacking, profile]);
}

// Deux loaders distincts (un type de composant stable par arme → règle des hooks OK).
function WeaponGltf(p: InnerProps) {
  const { scene } = useGLTF(p.profile.path);
  const off = useWeaponOffsets() + useWeaponCalibration(); // re-clone (offsets/calibrage)
  useAttachWeapon(scene, p, off, off + useWeaponEditor());  // re-apply léger (+ éditeur)
  return null;
}
function WeaponFbx(p: InnerProps) {
  const scene = useLoader(FBXLoader, p.profile.path) as unknown as THREE.Group;
  const off = useWeaponOffsets() + useWeaponCalibration();
  useAttachWeapon(scene, p, off, off + useWeaponEditor());
  return null;
}

function WeaponSocketInner(p: InnerProps) {
  return /\.fbx$/i.test(p.profile.path) ? <WeaponFbx {...p} /> : <WeaponGltf {...p} />;
}

// Préchauffe le cache drei UNIQUEMENT pour les armes de classe réellement équipées
// (arch_*, ~600 Ko). NE PAS précharger tout le catalogue : il contient des armes lourdes
// (Meshy ~42 Mo) → précharger les 26 armes d'un coup saturait la VRAM (Context Lost / freeze).
// Les autres armes se chargent À LA DEMANDE (off-thread) seulement si on les équipe.
["arch_sword", "arch_shield", "arch_bow", "arch_arrow", "arch_staff", "arch_gun", "arch_dagger"].forEach((id) => {
  const wp = weaponRegistry.get(id);
  if (wp && /\.glb$/i.test(wp.path)) useGLTF.preload(wp.path);
});
