// ragdoll/RagdollSystem.test.ts — Tests unitaires du système ragdoll
import { describe, it, expect } from "vitest";
import * as THREE from "three";
import { RagdollSystem, RagdollInstance, ragdollSystem } from "./RagdollSystem";

/**
 * Squelette minimal RÉELLEMENT simulable : `create()` exige au moins 3 os
 * reconnus (`bones.length < 3 → null`), et la reconnaissance passe par des
 * patterns ancrés (`/^(hips|pelvis|root)$/`). Un os nommé « Hips_0 » ne
 * correspond donc à rien : plusieurs tests construisaient des squelettes que le
 * système rejette, puis affirmaient qu'un ragdoll était né.
 */
function makeSkeleton(rootY = 1.0): THREE.Group {
  const root = new THREE.Group();
  const hips = new THREE.Bone();
  hips.name = "Hips";
  const spine = new THREE.Bone();
  spine.name = "Spine";
  const head = new THREE.Bone();
  head.name = "Head";
  spine.add(head);
  hips.add(spine);
  root.add(hips);

  hips.position.set(0, rootY, 0);
  spine.position.set(0, 0.3, 0);
  head.position.set(0, 0.2, 0);
  root.updateWorldMatrix(true, true);
  return root;
}

describe("RagdollSystem", () => {
  it("should be a singleton", () => {
    expect(ragdollSystem).toBeInstanceOf(RagdollSystem);
    expect(ragdollSystem.maxRagdolls).toBeGreaterThan(0);
  });

  it("should start enabled with 0 instances", () => {
    expect(ragdollSystem.enabled).toBe(true);
    expect(ragdollSystem.count).toBe(0);
  });

  it("should not spawn ragdoll from an empty group (no bones)", () => {
    const root = new THREE.Group();
    const scene = new THREE.Scene();
    const inst = ragdollSystem.spawn(root, scene);
    expect(inst).toBeNull();
    expect(ragdollSystem.count).toBe(0);
  });

  it("should return null for disable state without spawning", () => {
    const root = new THREE.Group();
    const scene = new THREE.Scene();
    ragdollSystem.enabled = false;
    const inst = ragdollSystem.spawn(root, scene);
    expect(inst).toBeNull();
    ragdollSystem.enabled = true;
  });

  it("should clear all instances", () => {
    const scene = new THREE.Scene();

    ragdollSystem.spawn(makeSkeleton(), scene);
    expect(ragdollSystem.count).toBeGreaterThan(0);
    ragdollSystem.clear();
    expect(ragdollSystem.count).toBe(0);
  });

  it("should enforce maxRagdolls limit", () => {
    const scene = new THREE.Scene();
    ragdollSystem.clear();
    const originalMax = ragdollSystem.maxRagdolls;

    // Créer plus d'instances que la limite
    for (let i = 0; i < originalMax + 2; i++) {
      ragdollSystem.spawn(makeSkeleton(), scene);
    }

    // Le plafond doit MORDRE : sans squelette valide, `count` restait à 0 et
    // l'assertion « <= max » passait sans rien prouver.
    expect(ragdollSystem.count).toBe(originalMax);
    ragdollSystem.clear();
  });
});

describe("RagdollInstance", () => {
  it("should return null when created from an object with no bones", () => {
    const root = new THREE.Group();
    const scene = new THREE.Scene();
    const inst = RagdollInstance.create(root, scene);
    expect(inst).toBeNull();
  });

  it("should create a ragdoll instance from a skeleton with bones", () => {
    const root = new THREE.Group();
    const scene = new THREE.Scene();

    // Créer un squelette minimal (hips + spine + head)
    const hips = new THREE.Bone();
    hips.name = "Hips";
    const spine = new THREE.Bone();
    spine.name = "Spine";
    const head = new THREE.Bone();
    head.name = "Head";
    spine.add(head);
    hips.add(spine);
    root.add(hips);

    // Mettre à jour les matrices
    hips.position.set(0, 0.9, 0);
    spine.position.set(0, 0.3, 0);
    head.position.set(0, 0.2, 0);
    root.updateWorldMatrix(true, true);

    const inst = RagdollInstance.create(root, scene);
    expect(inst).not.toBeNull();
    expect(inst!.expired).toBe(false);
    expect(inst!.visualRoot).toBeDefined();

    // Nettoyage
    inst!.dispose();
    expect(inst!.expired).toBe(true);
  });

  it("should simulate physics update without crashing", () => {
    const root = new THREE.Group();
    const scene = new THREE.Scene();

    const hips = new THREE.Bone();
    hips.name = "Hips";
    const spine = new THREE.Bone();
    spine.name = "Spine";
    const head = new THREE.Bone();
    head.name = "Head";
    spine.add(head);
    hips.add(spine);
    root.add(hips);

    hips.position.set(0, 1.5, 0);
    spine.position.set(0, 0.3, 0);
    head.position.set(0, 0.2, 0);
    root.updateWorldMatrix(true, true);

    const inst = RagdollInstance.create(root, scene);
    expect(inst).not.toBeNull();

    // Simuler quelques frames
    inst!.update(0.016); // ~60fps
    inst!.update(0.016);
    inst!.update(0.016);

    expect(inst!.expired).toBe(false);

    inst!.dispose();
  });

  it("should expire after its TTL", () => {
    const scene = new THREE.Scene();
    const inst = RagdollInstance.create(makeSkeleton(), scene);
    expect(inst).not.toBeNull();

    // Avance rapide — le TTL est 5s + fade 0.8s ≈ 5.8s
    for (let i = 0; i < 400; i++) {
      inst!.update(0.016);
    }

    // Devrait être expiré après ~6.4s
    expect(inst!.expired).toBe(true);

    inst!.dispose();
  });
});
