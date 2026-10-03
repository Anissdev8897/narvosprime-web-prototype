// weapons/WeaponGizmo.tsx — gizmo 3D de placement d'arme (dans le Canvas).
//
// Manipule directement l'Object3D de l'arme équipée du joueur (posé par WeaponSocket
// éditable). À la fin du glissé, écrit la transformation dans weaponCalibrationStore
// pour la combinaison (classe × type d'arme) en cours → persisté + appliqué à toutes
// les armes du même type sur cette classe. Plus précis que les sliders.
//
// On écrit UNIQUEMENT au relâché (onMouseUp) : pendant le glissé, le gizmo bouge l'objet
// librement ; on évite ainsi de ré-attacher l'arme (bump du store) en plein drag.
import { useRef } from "react";
import { TransformControls } from "@react-three/drei";
import * as THREE from "three";
import { weaponEditorStore, useWeaponEditor } from "./weaponEditorStore";
import { weaponCalibrationStore } from "./weaponCalibrationStore";

export function WeaponGizmo() {
  useWeaponEditor(); // re-render au changement de mode / d'arme éditable
  const euler = useRef(new THREE.Euler());
  const mode = weaponEditorStore.getMode();
  const obj = weaponEditorStore.getObject();
  const target = weaponEditorStore.getTarget();

  if (mode === "off" || !obj || !target) return null;

  const writeBack = () => {
    euler.current.setFromQuaternion(obj.quaternion, "XYZ");
    // Sauve dans le MODE réglé (dégainé/rangé) → sinon on écrivait toujours "drawn" et la
    // ré-application relisait l'autre mode → l'arme « snap back » et ne suivait pas le drag.
    const mode = weaponEditorStore.getPreviewMode() ?? "drawn";
    weaponCalibrationStore.set(target.kind, target.weaponType, {
      position: [obj.position.x, obj.position.y, obj.position.z],
      rotation: [euler.current.x, euler.current.y, euler.current.z],
      scale: obj.scale.x,
    }, mode);
  };

  return (
    <TransformControls
      object={obj}
      mode={mode}
      space="local"
      size={0.7}
      onMouseUp={writeBack}
    />
  );
}
