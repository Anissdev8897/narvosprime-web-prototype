// ══════════════════════════════════════════════════════════════════════════════
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
