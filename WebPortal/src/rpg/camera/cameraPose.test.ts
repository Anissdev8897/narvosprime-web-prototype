import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  poseFromCamera,
  applyPoseToCamera,
  lerpPose,
  focalLengthFromFov,
  defaultFpsPose,
  defaultTpsPose,
  type CameraPose,
} from "./cameraPose";

function makeCam(fov = 80): THREE.PerspectiveCamera {
  const cam = new THREE.PerspectiveCamera(fov, 16 / 9, 0.05, 30000);
  cam.rotation.order = "YXZ";
  return cam;
}

function clonePose(p: CameraPose): CameraPose {
  return {
    position: p.position.clone(),
    rotation: p.rotation.clone(),
    fov: p.fov,
    near: p.near,
    far: p.far,
  };
}

describe("focalLengthFromFov", () => {
  it("80° → ~14.3 mm", () => {
    expect(focalLengthFromFov(80)).toBeCloseTo(14.3, 0);
  });
  it("60° → ~20.8 mm", () => {
    expect(focalLengthFromFov(60)).toBeCloseTo(20.8, 0);
  });
  it("45° → ~29.0 mm", () => {
    expect(focalLengthFromFov(45)).toBeCloseTo(29.0, 0);
  });
});

describe("poseFromCamera / applyPoseToCamera", () => {
  it("lit et applique une pose sur la caméra", () => {
    const cam = makeCam();
    cam.position.set(10, 20, 30);
    cam.rotation.set(0.1, 0.5, 0, "YXZ");
    cam.fov = 90;
    cam.near = 0.1;
    cam.far = 1000;

    const pose = poseFromCamera(cam);
    expect(pose.position.x).toBeCloseTo(10);
    expect(pose.fov).toBe(90);
    expect(pose.near).toBe(0.1);
    expect(pose.far).toBe(1000);

    // Appliquer à une autre caméra
    const cam2 = makeCam();
    applyPoseToCamera(pose, cam2);
    expect(cam2.position.x).toBeCloseTo(10);
    expect(cam2.fov).toBe(90);
  });
});

describe("lerpPose", () => {
  it("t=0 → pose a", () => {
    const a: CameraPose = {
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0, "YXZ"),
      fov: 70, near: 0.05, far: 100,
    };
    const b: CameraPose = {
      position: new THREE.Vector3(10, 5, 0),
      rotation: new THREE.Euler(0.5, 1, 0, "YXZ"),
      fov: 90, near: 0.1, far: 500,
    };
    const out = clonePose(a);
    lerpPose(a, b, 0, out);
    expect(out.position.x).toBeCloseTo(0);
    expect(out.fov).toBeCloseTo(70);
  });

  it("t=1 → pose b", () => {
    const a: CameraPose = {
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0, "YXZ"),
      fov: 70, near: 0.05, far: 100,
    };
    const b: CameraPose = {
      position: new THREE.Vector3(10, 5, 0),
      rotation: new THREE.Euler(0.5, 1, 0, "YXZ"),
      fov: 90, near: 0.1, far: 500,
    };
    const out = clonePose(a);
    lerpPose(a, b, 1, out);
    expect(out.position.x).toBeCloseTo(10);
    expect(out.fov).toBeCloseTo(90);
  });

  it("t=0.5 interpole linéairement position et FOV", () => {
    const a: CameraPose = {
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0, "YXZ"),
      fov: 70, near: 0.05, far: 100,
    };
    const b: CameraPose = {
      position: new THREE.Vector3(10, 0, 0),
      rotation: new THREE.Euler(0, 0, 0, "YXZ"),
      fov: 90, near: 0.05, far: 100,
    };
    const out = clonePose(a);
    lerpPose(a, b, 0.5, out);
    expect(out.position.x).toBeCloseTo(5);
    expect(out.fov).toBeCloseTo(80);
  });

  it("lerp rotation via quaternion (pas de gimbal lock)", () => {
    const a: CameraPose = {
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, 0, 0, "YXZ"),
      fov: 80, near: 0.05, far: 100,
    };
    const b: CameraPose = {
      position: new THREE.Vector3(0, 0, 0),
      rotation: new THREE.Euler(0, Math.PI, 0, "YXZ"), // 180° yaw
      fov: 80, near: 0.05, far: 100,
    };
    const out = clonePose(a);
    lerpPose(a, b, 0.5, out);
    // À mi-chemin entre 0 et π, le quaternion slerp donne ~π/2
    expect(out.rotation.y).toBeCloseTo(Math.PI / 2, 1);
    expect(out.rotation.order).toBe("YXZ");
  });
});

describe("defaultFpsPose", () => {
  it("positionne à la hauteur des yeux", () => {
    const pose = defaultFpsPose({
      yaw: 0, pitch: 0, eyeHeight: 1.65,
      posX: 10, posY: 0, posZ: 20,
    });
    expect(pose.position.x).toBe(10);
    expect(pose.position.y).toBe(1.65);
    expect(pose.position.z).toBe(20);
    expect(pose.fov).toBe(80);
  });

  it("set la rotation YXZ avec yaw/pitch", () => {
    const pose = defaultFpsPose({
      yaw: 1.2, pitch: 0.3, eyeHeight: 1.65,
      posX: 0, posY: 0, posZ: 0,
    });
    expect(pose.rotation.y).toBeCloseTo(1.2);
    expect(pose.rotation.x).toBeCloseTo(0.3);
    expect(pose.rotation.order).toBe("YXZ");
  });
});

describe("defaultTpsPose", () => {
  it("place la caméra derrière le personnage", () => {
    const pose = defaultTpsPose({
      yaw: 0, pitch: 0, eyeHeight: 1.65,
      posX: 0, posY: 0, posZ: 0,
      tpsDistance: 4,
    });
    // Yaw=0 → forward = -Z, backward = +Z
    expect(pose.position.x).toBeCloseTo(0);
    expect(pose.position.z).toBeCloseTo(4); // derrière
    expect(pose.position.y).toBeCloseTo(1.65);
    expect(pose.fov).toBe(75);
  });

  it("orbite avec le pitch", () => {
    const pose = defaultTpsPose({
      yaw: 0, pitch: 0.5, eyeHeight: 1.65,
      posX: 0, posY: 0, posZ: 0,
      tpsDistance: 4,
    });
    // pitch > 0 → caméra au-dessus du personnage
    expect(pose.position.y).toBeLessThan(1.65);
    expect(pose.position.z).toBeGreaterThan(0);
  });
});
