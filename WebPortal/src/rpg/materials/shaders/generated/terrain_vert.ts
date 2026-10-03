// ══════════════════════════════════════════════════════════════════════════════
// AUTO-GENERATED — Do not edit directly.
// Generated: 2026-07-29 23:27:39
// Source:    shaders/terrain.vert.glsl
// Target:    webgl
// Stage:     vert
// Description: Terrain auto-material vertex injection
// Status:    ❌ VALIDATION FAILED (see error below)
// ══════════════════════════════════════════════════════════════════════════════


/**
 * GLSL source: shaders/terrain.vert.glsl
 * Validated:   no
 */
export const terrain_vert_glsl: string = `// ══════════════════════════════════════════════════════════════════════════════
// terrain.vert.glsl — Terrain auto-material VERTEX injection (WebGL/Three.js)
//
// Injected into Three.js's MeshStandardMaterial at these points:
//   - VERT_DECL: after  #include <common>
//   - VERT_BODY: after  #include <begin_vertex>
//
// Relies on:
//   modelMatrix, objectNormal, transformed  (Three.js built-in uniforms/vars)
// ══════════════════════════════════════════════════════════════════════════════

// ── VERT_DECL ────────────────────────────────────────────────────────────────
varying vec3 vAutoWorldPos;
varying vec3 vAutoWorldNormal;

// ── VERT_BODY ────────────────────────────────────────────────────────────────
// objectNormal is set by <beginnormal_vertex>, which runs BEFORE
// <begin_vertex> — we can safely read it here.
  vAutoWorldPos    = (modelMatrix * vec4(transformed, 1.0)).xyz;
  vAutoWorldNormal = normalize(mat3(modelMatrix) * objectNormal);
`;

/*
 * ⚠️  COMPILATION ERROR:
 * Command failed: "E:\narvosprime-web-prototype\WebPortal\node_modules\glslang-validator-prebuilt\bin\glslangValidator.exe" -V "E:\narvosprime-web-prototype\WebPortal\src\rpg\materials\shaders\terrain.vert.glsl" -o "E:\narvosprime-web-prototype\WebPortal\src\rpg\materials\shaders\generated\spirv\terrain.vert.spv" -S vert
 */

// Auto-material loader note: import this shader source via
//   import { terrain_vert_glsl } from './generated/terrain_vert';