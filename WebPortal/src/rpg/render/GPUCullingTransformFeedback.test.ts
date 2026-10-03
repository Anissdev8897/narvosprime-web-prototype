// ══════════════════════════════════════════════════════════════════════════════
// render/GPUCullingTransformFeedback.test.ts — Tests du GPU culling
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import {
  FrustumCullingSystem,
  InstanceCullingBattery,
} from "./GPUCullingTransformFeedback";

describe("FrustumCullingSystem", () => {
  let system: FrustumCullingSystem;
  let camera: THREE.PerspectiveCamera;

  beforeEach(() => {
    system = new FrustumCullingSystem({ frustumMargin: 1.0 });
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
  });

  describe("cullSpheres", () => {
    it("garde les objets dans le champ de vision", () => {
      system.updateFrustum(camera);

      const spheres = [
        { center: new THREE.Vector3(0, 0, 0), radius: 1 },    // centre, visible
        { center: new THREE.Vector3(2, 0, 0), radius: 0.5 },  // décalé, visible
        { center: new THREE.Vector3(-2, 0, 0), radius: 0.5 }, // décalé, visible
      ];

      const { visible, culled } = system.cullSpheres(spheres);
      expect(visible.length).toBe(3);
      expect(culled.length).toBe(0);
    });

    it("cull les objets loin derrière la caméra", () => {
      system.updateFrustum(camera);

      // Avec near=0.1 et far=100, les objets en Z négatif (derrière la caméra
      // qui regarde vers Z négatif) sont dans le frustum jusqu'à -100.
      // Pour être cullé, il faut être BEHIND the near plane = Z > 0.1.
      // Donc un objet à Z=5 (entre caméra et near plane inverse) n'est pas visible.
      // En fait la caméra regarde -Z, donc l'objet à Z = -50 est dans le cône,
      // et l'objet à Z = 5 (derrière la caméra) est cullé.
      const spheres = [
        { center: new THREE.Vector3(0, 0, 0), radius: 1 },   // visible (devant)
        { center: new THREE.Vector3(0, 0, 50), radius: 1 },  // derrière la caméra
      ];

      const { visible, culled } = system.cullSpheres(spheres);
      expect(visible.length).toBe(1);
      expect(culled.length).toBe(1);
    });

    it("cull les objets très loin (hors far plane)", () => {
      system.updateFrustum(camera);

      const spheres = [
        { center: new THREE.Vector3(0, 0, -200), radius: 1 },  // très loin
      ];

      const { culled } = system.cullSpheres(spheres);
      expect(culled.length).toBe(1);
    });

    it("cull les objets très loin sur le côté", () => {
      system.updateFrustum(camera);

      const spheres = [
        { center: new THREE.Vector3(100, 0, 0), radius: 1 },  // loin sur le côté
      ];

      const { culled } = system.cullSpheres(spheres);
      expect(culled.length).toBe(1);
    });

    it("retourne des stats correctes pour un mélange visible/cullé", () => {
      system.updateFrustum(camera);

      const spheres = [
        { center: new THREE.Vector3(0, 0, 0), radius: 1 },
        { center: new THREE.Vector3(0, 0, 50), radius: 1 },
        { center: new THREE.Vector3(100, 0, 0), radius: 1 },
        { center: new THREE.Vector3(-2, 0, 0), radius: 0.5 },
      ];

      const { stats } = system.cullSpheres(spheres);
      expect(stats.total).toBe(4);
      expect(stats.visible + stats.culled).toBe(4);
      expect(stats.cpuTimeMs).toBeGreaterThanOrEqual(0);
    });
  });

  describe("isSphereVisible", () => {
    it("retourne true pour un objet dans le frustum", () => {
      system.updateFrustum(camera);
      expect(system.isSphereVisible(new THREE.Vector3(0, 0, 0), 1)).toBe(true);
    });

    it("retourne false pour un objet hors frustum", () => {
      system.updateFrustum(camera);
      expect(system.isSphereVisible(new THREE.Vector3(100, 100, 100), 1)).toBe(false);
    });
  });
});

describe("InstanceCullingBattery", () => {
  let battery: InstanceCullingBattery;
  let camera: THREE.PerspectiveCamera;

  beforeEach(() => {
    battery = new InstanceCullingBattery({ frustumMargin: 1.0 });
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld(true);
    camera.updateProjectionMatrix();
  });

  it("computeInstanceBoundingSpheres retourne des données au format attendu", () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geo, mat, 3);

    // Positionner 3 instances
    const dummy = new THREE.Object3D();
    dummy.position.set(0, 0, 0);
    dummy.updateMatrixWorld(true);
    mesh.setMatrixAt(0, dummy.matrix);
    dummy.position.set(2, 0, 0);
    dummy.updateMatrixWorld(true);
    mesh.setMatrixAt(1, dummy.matrix);
    dummy.position.set(-2, 0, 0);
    dummy.updateMatrixWorld(true);
    mesh.setMatrixAt(2, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;

    const data = battery.computeInstanceBoundingSpheres(mesh);
    expect(data.length).toBe(3 * 4); // 3 instances × (cx,cy,cz,radius)
    expect(data[0]).toBe(0);  // centre x de l'instance 0
    // Le centre exact peut varier légèrement avec l'arrondi float
    expect(Math.abs(data[4] - 2)).toBeLessThan(0.01); // centre x de l'instance 1 ≈ 2
    expect(Math.abs(data[8] - (-2))).toBeLessThan(0.01); // centre x de l'instance 2 ≈ -2
    // Les rayons doivent être positifs
    expect(data[3]).toBeGreaterThan(0);
    expect(data[7]).toBeGreaterThan(0);
    expect(data[11]).toBeGreaterThan(0);
  });

  it("cullInstances retourne un résultat pour chaque instance", () => {
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial();
    const mesh = new THREE.InstancedMesh(geo, mat, 3);

    const dummy = new THREE.Object3D();
    dummy.position.set(0, 0, 0);
    dummy.updateMatrixWorld(true);
    mesh.setMatrixAt(0, dummy.matrix);
    dummy.position.set(10, 0, 0);
    dummy.updateMatrixWorld(true);
    mesh.setMatrixAt(1, dummy.matrix);
    dummy.position.set(0, 0, 50);
    dummy.updateMatrixWorld(true);
    mesh.setMatrixAt(2, dummy.matrix);
    mesh.instanceMatrix.needsUpdate = true;

    const boundingData = battery.computeInstanceBoundingSpheres(mesh);
    const visible = battery.cullInstances(mesh, boundingData, camera);

    expect(visible.length).toBe(3);
    // Chaque entrée est un booléen
    visible.forEach((v) => expect(typeof v).toBe("boolean"));
  });
});
