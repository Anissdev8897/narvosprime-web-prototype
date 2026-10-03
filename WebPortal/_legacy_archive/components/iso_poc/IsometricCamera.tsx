/**
 * IsometricCamera.tsx - Camera orthographique iso pour le POC NARVOS PRIME.
 *
 * Modes:
 *   - "follow_smooth" : suit la cible avec amortissement (gameplay exploration)
 *   - "fixed"         : centre fixe sans suivi (combat tactique)
 *
 * Angle Dofus-classique: 30 deg elevation, 45 deg azimuth.
 * Vrai iso geometrique: 35.264 deg.
 */

import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useRef } from "react";
import * as THREE from "three";

export type CameraMode = "follow_smooth" | "fixed";

interface IsometricCameraProps {
  /** Cible suivie (position monde). Null en mode fixed sans target. */
  target?: THREE.Object3D | null;
  /** Position fixe regardee si pas de target (mode fixed). */
  fixedTarget?: [number, number, number];
  mode?: CameraMode;
  /** Angle d'elevation au-dessus du plan XZ (deg). 30 = Dofus, 35.264 = vrai iso. */
  elevationDeg?: number;
  /** Angle azimutal autour de Y (deg). 45 par defaut (iso classique). */
  azimuthDeg?: number;
  /** Distance camera-cible. Affecte aussi le near/far. */
  distance?: number;
  /** Hauteur du frustum ortho (zoom). Plus grand = vue plus large. */
  frustumSize?: number;
  /** Smoothing factor pour follow (0..1). 1 = instantane, 0.05 = doux. */
  smoothing?: number;
}

export function IsometricCamera({
  target = null,
  fixedTarget = [0, 0, 0],
  mode = "follow_smooth",
  elevationDeg = 30,
  azimuthDeg = 45,
  distance = 30,
  frustumSize = 18,
  smoothing = 0.08,
}: IsometricCameraProps) {
  const { camera, size, set } = useThree();
  const cameraRef = useRef<THREE.OrthographicCamera | null>(null);
  const followTarget = useRef(new THREE.Vector3(...fixedTarget));

  // Init / replace la camera principale par notre OrthographicCamera
  useEffect(() => {
    const aspect = size.width / size.height;
    const cam = new THREE.OrthographicCamera(
      (-frustumSize * aspect) / 2,
      (frustumSize * aspect) / 2,
      frustumSize / 2,
      -frustumSize / 2,
      0.1,
      1000
    );
    cameraRef.current = cam;
    set({ camera: cam });
  }, [set, size.width, size.height, frustumSize]);

  // Adapte le frustum si la fenetre change
  useEffect(() => {
    if (!cameraRef.current) return;
    const aspect = size.width / size.height;
    cameraRef.current.left = (-frustumSize * aspect) / 2;
    cameraRef.current.right = (frustumSize * aspect) / 2;
    cameraRef.current.top = frustumSize / 2;
    cameraRef.current.bottom = -frustumSize / 2;
    cameraRef.current.updateProjectionMatrix();
  }, [size.width, size.height, frustumSize]);

  useFrame(() => {
    if (!cameraRef.current) return;
    const cam = cameraRef.current;

    // Cible voulue
    let desired = followTarget.current;
    if (mode === "fixed") {
      desired = desired.set(...fixedTarget);
    } else if (target) {
      const targetWorld = new THREE.Vector3();
      target.getWorldPosition(targetWorld);
      desired = followTarget.current.lerp(targetWorld, smoothing);
    }

    // Position camera = cible + offset spherique iso
    const el = THREE.MathUtils.degToRad(elevationDeg);
    const az = THREE.MathUtils.degToRad(azimuthDeg);
    const offsetX = distance * Math.cos(el) * Math.sin(az);
    const offsetY = distance * Math.sin(el);
    const offsetZ = distance * Math.cos(el) * Math.cos(az);

    cam.position.set(desired.x + offsetX, desired.y + offsetY, desired.z + offsetZ);
    cam.lookAt(desired);
  });

  return null;
}
