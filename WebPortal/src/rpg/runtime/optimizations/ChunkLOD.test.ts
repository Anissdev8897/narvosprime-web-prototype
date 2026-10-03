// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/ChunkLOD.test.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect } from "vitest";
import * as THREE from "three";
import {
  createChunkLOD,
  createChunkLODSimple,
  lodVariantPath,
  LOD_NEAR,
  LOD_MEDIUM,
  LOD_FAR,
  LOD_CULL,
  LOD_FADE_DIST,
  lodCrossFade,
  applyCrossFade,
  createBillboardSprite,
  extractDominantColor,
  estimateBillboardSize,
  LOD_FILE_SUFFIX_MED,
  LOD_FILE_SUFFIX_LOW,
} from "./ChunkLOD";

describe("createChunkLOD", () => {
  function makeScene(label: string, color?: number): THREE.Object3D {
    const group = new THREE.Group();
    group.name = label;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: color ?? 0xff0000,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `${label}_mesh`;
    group.add(mesh);
    return group;
  }

  it("should create a group with 4 children (high, med, low, cull)", () => {
    const high = makeScene("high");
    const med = makeScene("med");
    const low = makeScene("low");

    const obj = createChunkLOD({ high, medium: med, low });
    expect(obj).toBeInstanceOf(THREE.Group);
    expect(obj.children.length).toBe(4);
    expect(obj.children[0].name).toBe("LOD_HIGH");
    expect(obj.children[1].name).toBe("LOD_MED");
    expect(obj.children[2].name).toBe("LOD_LOW");
    expect(obj.children[3].name).toBe("LOD_CULL");
  });

  it("should default to visible high, invisible med/low/cull", () => {
    const high = makeScene("high");
    const obj = createChunkLOD({ high, medium: null, low: null });
    expect(obj.children[0].visible).toBe(true);
    expect(obj.children[1].visible).toBe(false);
    expect(obj.children[2].visible).toBe(false);
    expect(obj.children[3].visible).toBe(false);
  });

  it("should use billboard as LOW level when provided", () => {
    const high = makeScene("high");
    const billboard = createBillboardSprite(0x888888, 2);
    const obj = createChunkLOD({ high, medium: null, low: null, billboard });
    // Le billboard doit être le niveau LOW
    const lowChild = obj.children[2];
    expect(lowChild.type).toBe("Sprite");
  });

  it("should store worldPos in userData when provided", () => {
    const high = makeScene("high");
    const pos = new THREE.Vector3(100, 0, 200);
    const obj = createChunkLOD({ high, medium: null, low: null }, pos);
    expect(obj.userData.chunkWorldPos).toBeDefined();
    expect(obj.userData.chunkWorldPos.x).toBe(100);
    expect(obj.userData.chunkWorldPos.z).toBe(200);
  });
});

describe("createChunkLODSimple", () => {
  function makeScene(label: string): THREE.Object3D {
    const group = new THREE.Group();
    group.name = label;
    return group;
  }

  it("should create an LOD with 4 levels (high, med, low, cull)", () => {
    const high = makeScene("high");
    const med = makeScene("med");
    const low = makeScene("low");

    const lod = createChunkLODSimple(high, med, low);

    expect(lod).toBeInstanceOf(THREE.LOD);
    expect(lod.levels.length).toBe(4);
    expect(lod.levels[0].distance).toBe(LOD_NEAR);
    expect(lod.levels[1].distance).toBe(LOD_MEDIUM);
    expect(lod.levels[2].distance).toBe(LOD_FAR);
    expect(lod.levels[3].distance).toBe(LOD_CULL);
  });

  it("should fall back to high when med/low are null", () => {
    const high = makeScene("high");
    const lod = createChunkLODSimple(high, null, null);
    expect(lod.levels.length).toBe(4);
    expect(lod.levels[1].object.name).toBe("high");
    expect(lod.levels[2].object.name).toBe("high");
  });

  it("should fall back to med when low is null", () => {
    const high = makeScene("high");
    const med = makeScene("med");
    const lod = createChunkLODSimple(high, med, null);
    expect(lod.levels.length).toBe(4);
    expect(lod.levels[1].object.name).toBe("med");
    expect(lod.levels[2].object.name).toBe("med");
  });

  it("should have the last level invisible for culling", () => {
    const high = makeScene("high");
    const lod = createChunkLODSimple(high, null, null);
    expect(lod.levels[3].object.visible).toBe(false);
  });

  it("should use MEDIUM distance from distanceBand (60m)", () => {
    const high = makeScene("high");
    const lod = createChunkLODSimple(high, null, null);
    expect(lod.levels[1].distance).toBe(60); // MID_MAX = 60
  });
});

describe("lodCrossFade", () => {
  it("should return 1 before fade zone", () => {
    expect(lodCrossFade(0, 60, 5)).toBe(1);
    expect(lodCrossFade(55, 60, 5)).toBe(1);
  });

  it("should return 0 after fade zone", () => {
    expect(lodCrossFade(65, 60, 5)).toBe(0);
    expect(lodCrossFade(100, 60, 5)).toBe(0);
  });

  it("should interpolate linearly inside fade zone", () => {
    // À 60 mètres (threshold), le résultat doit être 0.5
    const factor = lodCrossFade(60, 60, 5);
    expect(factor).toBeCloseTo(0.5, 2);
  });

  it("should handle edge: exactly at threshold - fadeDist", () => {
    const factor = lodCrossFade(55, 60, 5);
    expect(factor).toBe(1);
  });

  it("should handle edge: exactly at threshold + fadeDist", () => {
    const factor = lodCrossFade(65, 60, 5);
    expect(factor).toBe(0);
  });
});

describe("applyCrossFade", () => {
  function makeColoredMesh(color: number): THREE.Object3D {
    const g = new THREE.Group();
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({ color });
    const m = new THREE.Mesh(geo, mat);
    g.add(m);
    return g;
  }

  it("should set opacity on current and next level", () => {
    const current = makeColoredMesh(0xff0000);
    const next = makeColoredMesh(0x00ff00);

    applyCrossFade(current, next, 0.3);

    // Vérifier que les matériaux sont en transparent
    const curMat = (current.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;
    const nextMat = (next.children[0] as THREE.Mesh).material as THREE.MeshStandardMaterial;

    expect(curMat.transparent).toBe(true);
    expect(curMat.opacity).toBeCloseTo(0.3, 5);
    expect(nextMat.transparent).toBe(true);
    expect(nextMat.opacity).toBeCloseTo(0.7, 5);
  });

  it("should do nothing when either arg is null", () => {
    const current = makeColoredMesh(0xff0000);
    expect(() => applyCrossFade(current, null, 0.5)).not.toThrow();
    expect(() => applyCrossFade(null, current, 0.5)).not.toThrow();
  });
});

describe("createBillboardSprite", () => {
  it("should create a THREE.Sprite", () => {
    const sprite = createBillboardSprite(0xff0000, 2);
    expect(sprite).toBeInstanceOf(THREE.Sprite);
    expect(sprite.scale.x).toBe(2);
    expect(sprite.scale.y).toBe(2);
  });

  it("should have transparent material", () => {
    const sprite = createBillboardSprite(0x888888, 1);
    const mat = sprite.material as THREE.SpriteMaterial;
    expect(mat.transparent).toBe(true);
  });
});

describe("extractDominantColor", () => {
  it("should return average color of meshes", () => {
    const g = new THREE.Group();
    const m1 = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0xff0000 }),
    );
    const m2 = new THREE.Mesh(
      new THREE.BoxGeometry(1, 1, 1),
      new THREE.MeshStandardMaterial({ color: 0x00ff00 }),
    );
    g.add(m1);
    g.add(m2);

    // Attendu : (255+0)/2=128, (0+255)/2=128, (0+0)/2=0 → 0x808000
    // r=0.5*255=128/0x80, g=0.5*255=128/0x80, b=0
    const color = extractDominantColor(g);
    expect(color).toBe(0x808000);
  });

  it("should return default gray when no meshes", () => {
    const g = new THREE.Group();
    expect(extractDominantColor(g)).toBe(0x888888);
  });
});

describe("lodVariantPath", () => {
  it("should add .lod_med suffix to .glb path", () => {
    expect(lodVariantPath("/maps/forge/chunks/chunk_0.glb", "med"))
      .toBe("/maps/forge/chunks/chunk_0.lod_med.glb");
  });

  it("should add .lod_low suffix to .glb path", () => {
    expect(lodVariantPath("chunks/chunk_5.glb", "low"))
      .toBe("chunks/chunk_5.lod_low.glb");
  });

  it("should return original path for high level", () => {
    expect(lodVariantPath("/maps/forge/chunks/chunk_0.glb", "high"))
      .toBe("/maps/forge/chunks/chunk_0.glb");
  });

  it("should handle paths with existing suffix", () => {
    expect(lodVariantPath("chunk_0.med.glb", "low"))
      .toBe("chunk_0.med.lod_low.glb");
  });

  it("should use LOD_FILE_SUFFIX constants", () => {
    expect(LOD_FILE_SUFFIX_MED).toBe("lod_med");
    expect(LOD_FILE_SUFFIX_LOW).toBe("lod_low");
  });
});
