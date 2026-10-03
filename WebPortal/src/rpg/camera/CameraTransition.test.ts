import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { CameraViewTransition, type TransitionEasing } from "./CameraTransition";
import type { CameraPose } from "./cameraPose";

function makePose(overrides?: Partial<CameraPose>): CameraPose {
  return {
    position: new THREE.Vector3(0, 1.65, 0),
    rotation: new THREE.Euler(0, 0, 0, "YXZ"),
    fov: 80,
    near: 0.05,
    far: 30000,
    ...overrides,
  };
}

const FPS_POSE: CameraPose = makePose({
  position: new THREE.Vector3(0, 1.65, 0),
  rotation: new THREE.Euler(0, 0, 0, "YXZ"),
  fov: 80,
});

const TPS_POSE: CameraPose = makePose({
  position: new THREE.Vector3(3, 2, 4),
  rotation: new THREE.Euler(-0.2, 0.5, 0, "YXZ"),
  fov: 75,
});

describe("CameraViewTransition", () => {
  it("nouveau → pas actif, progress=0", () => {
    const t = new CameraViewTransition();
    expect(t.active).toBe(false);
    expect(t.progress).toBe(0);
  });

  it("start() → devient actif", () => {
    const t = new CameraViewTransition();
    t.start(FPS_POSE, TPS_POSE);
    expect(t.active).toBe(true);
    expect(t.progress).toBeCloseTo(0);
  });

  it("snap() → termine immédiatement", () => {
    const t = new CameraViewTransition();
    t.start(FPS_POSE, TPS_POSE);
    expect(t.active).toBe(true);
    t.snap();
    expect(t.active).toBe(false);
    expect(t.progress).toBe(1);
  });

  it("update() retourne la pose blendée pendant la transition", () => {
    const t = new CameraViewTransition({ duration: 1, easing: "linear" });
    t.start(FPS_POSE, TPS_POSE);

    // t=0.3 → blended à 30%
    const pose30 = t.update(0.3);
    expect(pose30).not.toBeNull();
    expect(pose30!.position.x).toBeCloseTo(0.9, 1);  // lerp(0, 3, 0.3)
    expect(pose30!.fov).toBeCloseTo(78.5, 0);        // lerp(80, 75, 0.3)
  });

  it("update retourne null une fois terminée", () => {
    const t = new CameraViewTransition({ duration: 0.1, easing: "linear" });
    t.start(FPS_POSE, TPS_POSE);
    t.update(0.2); // dépasse la durée
    expect(t.active).toBe(false);
    // Update après fin → null
    expect(t.update(0.016)).toBeNull();
  });

  it("start() avant la fin redémarre la transition", () => {
    const t = new CameraViewTransition({ duration: 1, easing: "linear" });
    t.start(FPS_POSE, TPS_POSE);
    t.update(0.5);
    expect(t.progress).toBeCloseTo(0.5);

    // Redémarre avec de nouvelles poses
    const newPose = makePose({ fov: 90 });
    t.start(FPS_POSE, newPose);
    expect(t.progress).toBeCloseTo(0);
    expect(t.active).toBe(true);

    const result = t.update(0.5);
    expect(result!.fov).toBeCloseTo(85); // lerp(80, 90, 0.5)
  });

  it("reset() annule la transition", () => {
    const t = new CameraViewTransition({ duration: 1, easing: "linear" });
    t.start(FPS_POSE, TPS_POSE);
    t.update(0.3);
    t.reset();
    expect(t.active).toBe(false);
    expect(t.progress).toBe(0);
    expect(t.update(0.016)).toBeNull();
  });

  it("easeOutCubic ralentit vers la fin (t < 0.8 → moins que linéaire)", () => {
    // easeOutCubic: progress=0.5 → t effectif ≈ 1-(0.5)³ = 0.875 → plus rapide
    // Comparé à linear où 0.5→0.5
    // En fait easeOutCubic accélère au début
    const t = new CameraViewTransition({ duration: 1, easing: "easeOutCubic" });
    t.start(FPS_POSE, TPS_POSE);

    // À progress=0.5 (temps mi-parcours)
    const result = t.update(0.5);
    // easeOutCubic(0.5) = 1-(0.5)³ = 0.875
    // La position blendée devrait être plus proche de TPS que de FPS
    const distFromStart = result!.position.distanceTo(FPS_POSE.position);
    const totalDist = TPS_POSE.position.distanceTo(FPS_POSE.position);
    const fraction = distFromStart / totalDist;
    // easeOutCubic: t=0.5 → effective=0.875, donc fraction > 0.5
    expect(fraction).toBeGreaterThan(0.5);
  });

  it("smoothstep produit une progression en S", () => {
    // smoothstep(0.5) = 0.5²(3-2×0.5) = 0.5
    const t = new CameraViewTransition({ duration: 1, easing: "smoothstep" });
    t.start(FPS_POSE, TPS_POSE);

    const result = t.update(0.5);
    const distFromStart = result!.position.distanceTo(FPS_POSE.position);
    const totalDist = TPS_POSE.position.distanceTo(FPS_POSE.position);
    expect(distFromStart / totalDist).toBeCloseTo(0.5, 1);
  });

  it("ne plante pas avec dt=0 (frame figée)", () => {
    const t = new CameraViewTransition({ duration: 1, easing: "linear" });
    t.start(FPS_POSE, TPS_POSE);
    const result = t.update(0);
    expect(result).not.toBeNull();
  });
});
