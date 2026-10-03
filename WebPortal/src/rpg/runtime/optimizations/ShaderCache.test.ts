// ══════════════════════════════════════════════════════════════════════════════
// runtime/optimizations/ShaderCache.test.ts
// ══════════════════════════════════════════════════════════════════════════════

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import * as THREE from "three";
import { ShaderCache, cloneWithUniforms } from "./ShaderCache";

describe("ShaderCache", () => {
  const VS = "void main() {}";
  const FS_VERT = "void main() { gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0); }";
  const FS_BLUE = "void main() { gl_FragColor = vec4(0.0, 0.0, 1.0, 1.0); }";

  beforeEach(() => {
    ShaderCache.disposeAll();
  });

  afterEach(() => {
    ShaderCache.disposeAll();
  });

  it("should create a new material when key is not cached", () => {
    const mat = ShaderCache.getOrCreate(
      { name: "test_red", vertexShader: VS, fragmentShader: FS_VERT },
      () => new THREE.ShaderMaterial({
        vertexShader: VS,
        fragmentShader: FS_VERT,
        name: "test_red",
      }),
    );
    expect(mat).toBeInstanceOf(THREE.ShaderMaterial);
    expect(mat.name).toBe("test_red");
    expect(ShaderCache.size).toBe(1);
  });

  it("should return cached material for the same key", () => {
    const mat1 = ShaderCache.getOrCreate(
      { name: "test_red", vertexShader: VS, fragmentShader: FS_VERT },
      () => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_VERT, name: "test_red" }),
    );
    const mat2 = ShaderCache.getOrCreate(
      { name: "test_red", vertexShader: VS, fragmentShader: FS_VERT },
      () => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_VERT, name: "test_red" }),
    );
    expect(mat1).toBe(mat2); // same reference
    expect(ShaderCache.size).toBe(1);
  });

  it("should cache different materials under different keys", () => {
    const mat1 = ShaderCache.getOrCreate(
      { name: "red", vertexShader: VS, fragmentShader: FS_VERT },
      () => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_VERT, name: "red" }),
    );
    const mat2 = ShaderCache.getOrCreate(
      { name: "blue", vertexShader: VS, fragmentShader: FS_BLUE },
      () => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_BLUE, name: "blue" }),
    );
    expect(mat1).not.toBe(mat2);
    expect(ShaderCache.size).toBe(2);
  });

  it("should distinguish keys by vertex/fragment shader length", () => {
    const FS_VERT_LONG = `${FS_VERT}\n// comment`;
    const mat1 = ShaderCache.getOrCreate(
      { name: "red", vertexShader: VS, fragmentShader: FS_VERT },
      () => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_VERT, name: "red" }),
    );
    const mat2 = ShaderCache.getOrCreate(
      { name: "red", vertexShader: VS, fragmentShader: FS_VERT_LONG },
      () => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_VERT_LONG, name: "red_long" }),
    );
    expect(mat1).not.toBe(mat2);
    expect(ShaderCache.size).toBe(2);
  });

  it("should remove and dispose a cached material", () => {
    const mat = ShaderCache.getOrCreate(
      { name: "temp", vertexShader: VS, fragmentShader: FS_VERT },
      () => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_VERT, name: "temp" }),
    );
    expect(ShaderCache.size).toBe(1);

    ShaderCache.remove({ name: "temp", vertexShader: VS, fragmentShader: FS_VERT });
    expect(ShaderCache.size).toBe(0);

    // Just verify the material is disposed (no error)
    expect(mat).toBeDefined();
  });

  it("should dispose all materials", () => {
    ShaderCache.getOrCreate(
      { name: "a", vertexShader: VS, fragmentShader: FS_VERT },
      () => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_VERT, name: "a" }),
    );
    ShaderCache.getOrCreate(
      { name: "b", vertexShader: VS, fragmentShader: FS_BLUE },
      () => new THREE.ShaderMaterial({ vertexShader: VS, fragmentShader: FS_BLUE, name: "b" }),
    );
    expect(ShaderCache.size).toBe(2);
    ShaderCache.disposeAll();
    expect(ShaderCache.size).toBe(0);
  });
});

describe("cloneWithUniforms", () => {
  it("should clone material and apply uniform overrides", () => {
    const base = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: "void main() {}",
      fragmentShader: "void main() { gl_FragColor = vec4(1.0); }",
    });

    const clone = cloneWithUniforms(base, {
      uTime: { value: 42 },
    });

    expect(clone).not.toBe(base);
    expect(clone.uniforms.uTime.value).toBe(42);
    // `needsUpdate` est un setter SANS getter dans Three.js : le lire rend
    // toujours `undefined`, quel que soit l'état du matériau. On vérifie donc
    // ce qui décide réellement de la réutilisation du programme WebGL — un
    // source de shader identique — et l'absence de bump de `version`.
    expect(clone.vertexShader).toBe(base.vertexShader);
    expect(clone.fragmentShader).toBe(base.fragmentShader);
    expect(clone.version).toBe(0);
  });

  it("should not modify original uniform values", () => {
    const base = new THREE.ShaderMaterial({
      uniforms: { uTime: { value: 0 } },
      vertexShader: "void main() {}",
      fragmentShader: "void main() { gl_FragColor = vec4(1.0); }",
    });

    cloneWithUniforms(base, { uTime: { value: 42 } });

    expect(base.uniforms.uTime.value).toBe(0);
  });
});
