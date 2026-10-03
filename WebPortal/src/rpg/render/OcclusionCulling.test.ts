// ══════════════════════════════════════════════════════════════════════════════
// render/OcclusionCulling.test.ts — Tests de l'occlusion culling
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import { OcclusionCullingSystem, applyOcclusionCulling } from "./OcclusionCulling";

describe("OcclusionCullingSystem", () => {
  let system: OcclusionCullingSystem;
  let camera: THREE.PerspectiveCamera;

  beforeEach(() => {
    system = new OcclusionCullingSystem({
      enabled: true,
      maxDistance: 100,
      minDistance: 1,
      raysPerObject: 1,
      occlusionThreshold: 0.5,
      diagnostic: false,
    });
    camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 10);
    camera.lookAt(0, 0, 0);
  });

  describe("sans occludeurs", () => {
    it("considère tous les objets comme visibles", () => {
      const spheres = [
        new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1),
        new THREE.Sphere(new THREE.Vector3(2, 0, 0), 0.5),
      ];

      const visible = system.testSpheres(spheres, camera);
      expect(visible).toEqual([true, true]);
    });

    it("retourne des stats à zéro", () => {
      const spheres = [new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1)];
      system.testSpheres(spheres, camera);
      const stats = system.lastStats;
      expect(stats.total).toBe(1);
      expect(stats.visible).toBe(1);
      expect(stats.occluded).toBe(0);
    });
  });

  describe("avec un occluder", () => {
    it("enregistre un occluder et l'utilise", () => {
      // Créer un grand mur qui cache tout
      const wallGeo = new THREE.BoxGeometry(10, 10, 0.5);
      const wallMat = new THREE.MeshStandardMaterial();
      const wall = new THREE.Mesh(wallGeo, wallMat);
      wall.position.set(0, 0, -3);
      wall.updateMatrixWorld(true);

      system.registerOccluder(wall);
      expect(system.occluderCount).toBe(1);
    });
  });

  describe("registerOccludersFromScene", () => {
    it("enregistre les gros meshes d'une scène", () => {
      const scene = new THREE.Group();

      // Grand mesh (sera occluder)
      const bigWall = new THREE.Mesh(
        new THREE.BoxGeometry(50, 50, 1),
        new THREE.MeshStandardMaterial(),
      );
      scene.add(bigWall);

      // Petit mesh (ne sera pas occluder)
      const smallRock = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 0.5),
        new THREE.MeshStandardMaterial(),
      );
      scene.add(smallRock);

      const count = system.registerOccludersFromScene(scene, 10);
      expect(count).toBe(1); // seul le grand mur est retenu
    });
  });

  describe("testOcclusionBatch", () => {
    it("retourne un résultat par objet", () => {
      const objects = [
        { id: 0, boundingSphere: new THREE.Sphere(new THREE.Vector3(0, 0, 0), 1) },
        { id: 1, boundingSphere: new THREE.Sphere(new THREE.Vector3(5, 0, 0), 1) },
      ];

      const { results, stats } = system.testOcclusionBatch(objects, camera);
      expect(results.length).toBe(2);
      expect(stats.total).toBe(2);
    });

    it("cull les objets trop loin", () => {
      const objects = [
        { id: 0, boundingSphere: new THREE.Sphere(new THREE.Vector3(0, 0, 200), 1) },
      ];

      const { results } = system.testOcclusionBatch(objects, camera);
      expect(results[0].visible).toBe(false);
      expect(results[0].occlusionRatio).toBe(1);
    });
  });
});

describe("applyOcclusionCulling", () => {
  it("retourne des stats sans occludeurs pour une scène vide", () => {
    const scene = new THREE.Group();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    const stats = applyOcclusionCulling(scene, camera);
    expect(stats.total).toBe(0);
    expect(stats.cpuTimeMs).toBeGreaterThanOrEqual(0);
  });

  it("retourne des stats pour une scène avec des meshes", () => {
    const scene = new THREE.Group();
    const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 100);
    camera.position.set(0, 0, 10);

    // Ajouter un gros occluder potentiel
    const wall = new THREE.Mesh(
      new THREE.BoxGeometry(20, 20, 1),
      new THREE.MeshStandardMaterial(),
    );
    wall.position.set(0, 0, -3);
    scene.add(wall);

    // Ajouter un petit mesh derrière
    const rock = new THREE.Mesh(
      new THREE.BoxGeometry(0.5, 0.5, 0.5),
      new THREE.MeshStandardMaterial(),
    );
    rock.position.set(0, 0, -6);
    scene.add(rock);

    const stats = applyOcclusionCulling(scene, camera, {
      enabled: true,
      maxDistance: 100,
      minDistance: 0,
      raysPerObject: 1,
      raySpreadDeg: 0,
      occlusionThreshold: 0.5,
      diagnostic: false,
    });

    expect(stats.total).toBeGreaterThan(0);
    expect(stats.visible + stats.occluded).toBe(stats.total);
  });
});
