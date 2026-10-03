// ══════════════════════════════════════════════════════════════════════════════
// render/InstancedMeshSystem.test.ts — Tests du système d'instancing
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach } from "vitest";
import * as THREE from "three";
import { InstancedMeshSystem, optimizeChunkScene } from "./InstancedMeshSystem";

// Helper: crée un mesh avec une géométrie simple
function createTestMesh(
  geo: THREE.BufferGeometry,
  color: number = 0xff0000,
  name?: string,
): THREE.Mesh {
  const mat = new THREE.MeshStandardMaterial({ color });
  const mesh = new THREE.Mesh(geo, mat);
  if (name) mesh.name = name;
  return mesh;
}

function createBoxGeometry(): THREE.BufferGeometry {
  return new THREE.BoxGeometry(1, 1, 1);
}

function createSphereGeometry(): THREE.BufferGeometry {
  return new THREE.SphereGeometry(0.5, 8, 8);
}

describe("InstancedMeshSystem", () => {
  let system: InstancedMeshSystem;

  beforeEach(() => {
    system = new InstancedMeshSystem({ minTriangles: 0 });
  });

  describe("scanScene", () => {
    it("détecte les meshes répétés avec la même géométrie", () => {
      const scene = new THREE.Group();
      const geo = createBoxGeometry();

      // 3 cubes identiques
      const m1 = createTestMesh(geo);
      m1.position.set(0, 0, 0);
      const m2 = createTestMesh(geo);
      m2.position.set(2, 0, 0);
      const m3 = createTestMesh(geo);
      m3.position.set(4, 0, 0);

      scene.add(m1, m2, m3);
      m1.updateMatrixWorld(true);
      m2.updateMatrixWorld(true);
      m3.updateMatrixWorld(true);

      system.scanScene(scene);

      expect(system.groupCount).toBe(1); // un seul groupe (même geo + mat)
      expect(system.stats.originalMeshCount).toBe(3);
      expect(system.stats.totalInstances).toBe(3);
    });

    it("sépare les meshes avec des géométries différentes", () => {
      const scene = new THREE.Group();
      const box = createTestMesh(createBoxGeometry());
      box.position.set(0, 0, 0);
      const sphere = createTestMesh(createSphereGeometry());
      sphere.position.set(2, 0, 0);

      scene.add(box, sphere);
      box.updateMatrixWorld(true);
      sphere.updateMatrixWorld(true);

      system.scanScene(scene);

      expect(system.groupCount).toBe(2);
      expect(system.stats.originalMeshCount).toBe(2);
    });

    it("sépare les meshes avec des matériaux différents", () => {
      const scene = new THREE.Group();
      const geo = createBoxGeometry();
      const m1 = createTestMesh(geo, 0xff0000);
      m1.position.set(0, 0, 0);
      const m2 = createTestMesh(geo, 0x00ff00);
      m2.position.set(2, 0, 0);

      scene.add(m1, m2);
      m1.updateMatrixWorld(true);
      m2.updateMatrixWorld(true);

      system.scanScene(scene);
      expect(system.groupCount).toBe(2); // matériaux différents → groupes séparés
    });

    it("ignore les meshes avec trop peu de triangles", () => {
      const systemSmall = new InstancedMeshSystem({ minTriangles: 100 });
      const scene = new THREE.Group();
      // Un petit plan a 2 triangles
      const geo = new THREE.PlaneGeometry(0.1, 0.1);
      const m = createTestMesh(geo);
      scene.add(m);
      m.updateMatrixWorld(true);

      systemSmall.scanScene(scene);
      expect(systemSmall.groupCount).toBe(0); // ignoré car trop petit
    });
  });

  describe("buildInstances", () => {
    it("crée un InstancedMesh pour les objets répétés", () => {
      const scene = new THREE.Group();
      const geo = createBoxGeometry();
      const m1 = createTestMesh(geo);
      const m2 = createTestMesh(geo);
      m1.position.set(0, 0, 0);
      m2.position.set(2, 0, 0);
      scene.add(m1, m2);
      m1.updateMatrixWorld(true);
      m2.updateMatrixWorld(true);

      system.scanScene(scene);
      const count = system.buildInstances(scene);

      expect(count).toBeGreaterThanOrEqual(1);

      // Vérifier qu'il y a un InstancedMesh dans la scène
      let found = false;
      scene.traverse((child) => {
        if ((child as THREE.InstancedMesh).isInstancedMesh) {
          found = true;
        }
      });
      expect(found).toBe(true);
    });

    it("les meshes originaux sont cachés après build", () => {
      const scene = new THREE.Group();
      const geo = createBoxGeometry();
      const m1 = createTestMesh(geo);
      const m2 = createTestMesh(geo);
      scene.add(m1, m2);
      m1.updateMatrixWorld(true);
      m2.updateMatrixWorld(true);

      system.scanScene(scene);
      system.buildInstances(scene);

      expect(m1.visible).toBe(false);
      expect(m2.visible).toBe(false);
    });

    it("ne crée pas d'InstancedMesh pour les objets uniques", () => {
      const scene = new THREE.Group();
      const geo1 = createBoxGeometry();
      const geo2 = createSphereGeometry();
      const m1 = createTestMesh(geo1);
      const m2 = createTestMesh(geo2);
      scene.add(m1, m2);
      m1.updateMatrixWorld(true);
      m2.updateMatrixWorld(true);

      system.scanScene(scene);
      system.buildInstances(scene);

      // Pas d'instancing car chaque geo+mat est unique
      let instancedCount = 0;
      scene.traverse((child) => {
        if ((child as THREE.InstancedMesh).isInstancedMesh) {
          instancedCount++;
        }
      });
      expect(instancedCount).toBe(0);
    });
  });

  describe("stats", () => {
    it("calcule correctement drawCallsSaved", () => {
      const scene = new THREE.Group();
      const geo = createBoxGeometry();
      for (let i = 0; i < 5; i++) {
        const m = createTestMesh(geo);
        m.position.set(i * 2, 0, 0);
        scene.add(m);
        m.updateMatrixWorld(true);
      }

      system.scanScene(scene);
      system.buildInstances(scene);
      const stats = system.stats;

      expect(stats.originalMeshCount).toBe(5);
      expect(stats.totalInstances).toBe(5);
      // Au moins 4 draw calls économisés (5 - 1 InstancedMesh)
      expect(stats.drawCallsSaved).toBeGreaterThanOrEqual(4);
    });
  });

  describe("restore", () => {
    it("restaure la visibilité des meshes originaux", () => {
      const scene = new THREE.Group();
      const geo = createBoxGeometry();
      const m1 = createTestMesh(geo);
      const m2 = createTestMesh(geo);
      scene.add(m1, m2);
      m1.updateMatrixWorld(true);
      m2.updateMatrixWorld(true);

      system.scanScene(scene);
      system.buildInstances(scene);
      expect(m1.visible).toBe(false);

      system.restore(scene);
      expect(m1.visible).toBe(true);
    });
  });

  describe("optimizeChunkScene", () => {
    it("retourne null si aucun groupe trouvé", () => {
      const scene = new THREE.Group();
      const geo1 = createBoxGeometry();
      const geo2 = createSphereGeometry();
      scene.add(createTestMesh(geo1));
      scene.add(createTestMesh(geo2));

      const result = optimizeChunkScene(scene, { minTriangles: 0 });
      expect(result).toBeNull();
    });

    it("retourne des stats si des instances sont créées", () => {
      const scene = new THREE.Group();
      const geo = createBoxGeometry();
      for (let i = 0; i < 5; i++) {
        const m = createTestMesh(geo);
        m.position.set(i * 2, 0, 0);
        scene.add(m);
        m.updateMatrixWorld(true);
      }

      const result = optimizeChunkScene(scene, { minTriangles: 0 });
      expect(result).not.toBeNull();
      expect(result!.drawCallsSaved).toBeGreaterThanOrEqual(4);
    });
  });
});
