// ══════════════════════════════════════════════════════════════════════════════
// AUTO-GENERATED — shader registry
// All precompiled shaders re-exported from a single entry point.
// ══════════════════════════════════════════════════════════════════════════════

import { terrain_vert_glsl } from './terrain_vert';
import { terrain_frag_glsl } from './terrain_frag';
import { mesh_vert_glsl, mesh_vert_spv, mesh_vert_spv_size } from './mesh_vert';
import { mesh_frag_glsl, mesh_frag_spv, mesh_frag_spv_size } from './mesh_frag';

export { terrain_vert_glsl, terrain_frag_glsl, mesh_vert_glsl, mesh_vert_spv, mesh_vert_spv_size, mesh_frag_glsl, mesh_frag_spv, mesh_frag_spv_size };

/**
 * Map of shader IDs to their GLSL source strings.
 * Used by the auto-material system to load precompiled shaders.
 */
export const precompiledShaders: Record<string, string> = {
  'terrain_vert': terrain_vert_glsl,
  'terrain_frag': terrain_frag_glsl,
  'mesh_vert': mesh_vert_glsl,
  'mesh_frag': mesh_frag_glsl,
};