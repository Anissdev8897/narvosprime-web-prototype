// weapons/weaponEditorStore.ts — état de l'ÉDITEUR d'arme in-game (gizmo).
//
// Relie le panneau HTML 🔧 (hors Canvas) au gizmo 3D <WeaponGizmo> (dans le Canvas) :
//   • mode    : type de manipulation du gizmo (off / déplacer / tourner / échelle)
//   • object  : l'Object3D de l'arme ÉQUIPÉE du joueur (posé par WeaponSocket)
//   • target  : la combinaison (classe × type d'arme) que le gizmo doit sauvegarder
//               — renseignée par le WeaponSocket éditable (= l'arme réellement en main).
import { useSyncExternalStore } from "react";
import type * as THREE from "three";

export type GizmoMode = "off" | "translate" | "rotate" | "scale";
/** Mode d'aperçu de l'éditeur : règle l'arme DÉGAINÉE ou RANGÉE. null = suit l'état réel
 *  du joueur (weaponDrawn). Quand l'éditeur est ouvert, on force l'aperçu sur ce mode. */
export type PreviewMode = "drawn" | "sheathed" | null;

let mode: GizmoMode = "off";
let object: THREE.Object3D | null = null;
let target: { kind: string; weaponType: string } | null = null;
let forcedWeaponId: string | null = null; // arme à ÉQUIPER de force (test dans l'éditeur)
let previewMode: PreviewMode = null;       // override d'aperçu rangée/dégainée (éditeur ouvert)
let freezePose = false;                    // calibrage ouvert : FIGE le perso (aucune anim)
let version = 0;
const listeners = new Set<() => void>();
function notify() { version++; for (const fn of listeners) fn(); }

export const weaponEditorStore = {
  getMode(): GizmoMode { return mode; },
  setMode(m: GizmoMode): void { if (m !== mode) { mode = m; notify(); } },
  /** Arme forcée sur le joueur (override de l'arme de classe) — pour visualiser/calibrer
   *  N'IMPORTE quelle arme dans l'éditeur. null = arme de la classe par défaut. */
  getForcedWeaponId(): string | null { return forcedWeaponId; },
  setForcedWeaponId(id: string | null): void { if (id !== forcedWeaponId) { forcedWeaponId = id; notify(); } },
  /** Mode d'aperçu rangée/dégainée forcé par l'éditeur (null = suit le joueur). */
  getPreviewMode(): PreviewMode { return previewMode; },
  setPreviewMode(m: PreviewMode): void { if (m !== previewMode) { previewMode = m; notify(); } },
  getObject(): THREE.Object3D | null { return object; },
  setObject(o: THREE.Object3D | null): void { if (o !== object) { object = o; notify(); } },
  getTarget(): { kind: string; weaponType: string } | null { return target; },
  setTarget(t: { kind: string; weaponType: string } | null): void {
    if (t?.kind !== target?.kind || t?.weaponType !== target?.weaponType) { target = t; notify(); }
  },
  /** Calibrage : true = le perso ne joue AUCUNE animation (pose figée → réglages précis). */
  isPoseFrozen(): boolean { return freezePose; },
  setFreezePose(f: boolean): void { if (f !== freezePose) { freezePose = f; notify(); } },
  subscribe(fn: () => void): () => void { listeners.add(fn); return () => { listeners.delete(fn); }; },
  getVersion(): number { return version; },
};

/** Hook : re-render au changement de mode / d'arme éditable. */
export function useWeaponEditor(): number {
  useSyncExternalStore(weaponEditorStore.subscribe, weaponEditorStore.getVersion, weaponEditorStore.getVersion);
  return version;
}
