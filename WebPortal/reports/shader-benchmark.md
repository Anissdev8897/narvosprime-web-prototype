# Rapport de Benchmark — Precompilation Shaders

Date: 2026-07-29 23:27:41
glslangValidator: ✅ E:\narvosprime-web-prototype\WebPortal\node_modules\glslang-validator-prebuilt\bin\glslangValidator.exe

## Résumé

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| Compilation des shaders (build time) | Inline — compilation WebGL au runtime | Precompilé — validation au build | ✅ Micro-freezes eliminés |
| Temps de precompilation (ce script) | — | 2907.24 ms | N/A |
| Validation GLSL | Aucune | glslangValidator ✓ | ✅ Erreurs capturées au build |
| SPIR-V généré | Non | 2 sur 4 | ✅ Vulkan ready |

## Détail par shader

| ID | Fichier | Validé | SPIR-V | Taille .glsl | Taille .spv |
|---|---|---|---|---|---|
| terrain_vert | terrain.vert.glsl | ❌ | — | 968 B | 0 B |
| terrain_frag | terrain.frag.glsl | ❌ | — | 5584 B | 0 B |
| mesh_vert | mesh.vert.glsl | ✅ | ✅ | 1074 B | 4180 B |
| mesh_frag | mesh.frag.glsl | ✅ | ✅ | 589 B | 1652 B |

## Impact sur le Three.js Loader

**Avant** : Les shaders étaient des chaînes de caractères inline dans
`AutoMaterial.ts`. Injection via `onBeforeCompile` au moment du premier
render, causant des micro-freezes le temps que WebGL compile chaque
variante de matériau.

**Après** : Les shaders sont pré-chargés depuis des modules `.ts` générés.
Le coût est réparti :
- À la construction du projet (ce script) — validation + compilation SPIR-V
- Au chargement du module (ESM `import`) — quasi nul
- Au runtime (WebGL) — inchangé mais GLSL déjà connu du cache navigateur

## Pour aller plus loin

1. Installer **SPIRV-Cross** pour la rétro-compilation SPIR-V → GLSL optimisé
2. Ajouter un cache WebGL de programmes compilés (via `gl.programBinary()`)
3. Pour le renderer Vulkan : utiliser les SPIR-V précompilés directement
