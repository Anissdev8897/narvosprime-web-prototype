# 📊 RAPPORT PROJET NARVOS PRIME — 31/07/2026

## 🏗️ Architecture
- **Moteur** : Electron + Vite + React + Three.js (R3F)
- **Port** : 3005 (Vite dev server)
- **Commande** : `npm run go` (kill-node + electron:dev)
- **Mémoire** : `.hermes/STUDIO.md` (commune agents)
- **API Test** : `window.__narvosTest` (testInputBridge.ts)
- **Bridge fichier** : `public/test-commands.json` (poll 500ms)

## ✅ BUGS CORRIGÉS (25+)

| # | Bug | Fichier | Statut |
|---|-----|---------|--------|
| 1 | Import spawnProtectionEnd cassé | RpgGameWorld.tsx | ✅ |
| 2 | e.approach is not a function | MathWasm.ts | ✅ |
| 3 | fastAtan2 import manquant | locomotionBlend.ts | ✅ |
| 4 | CTRL toggle (hold→press) | CharacterController.ts + InputManager.ts | ✅ |
| 5 | SSAO NormalPass warning | PostProcessingPipeline.tsx | ✅ |
| 6 | Écran noir FPS (V toggle) | RpgGameWorld.tsx (Suspense) | ✅ |
| 7 | cameraViewStore désynchro | cameraViewStore.ts + playerState.ts | ✅ |
| 8 | Oscillation crouch idle | OwnAnimPlayerCharacter.tsx (hystérésis) | ✅ |
| 9 | BVH_BATCH 8→2 + merge traversals | StreamingPuzzleMap.tsx | ✅ |
| 10 | collisionWorld null guard + Set O(1) | CollisionWorld.ts | ✅ |
| 11 | Path traversal electron | electron/main.ts | ✅ |
| 12 | NPC snapped sous sol | Npc.tsx | ✅ |
| 13 | 7 animations GLB → substituts UTA | avatarAssets.ts | ✅ |
| 14 | QuestDef types + event bus | questStore.ts | ✅ |
| 15 | ammoStore scopé par charId | ammoStore.ts | ✅ |
| 16 | Aperçu WRAITH → MURDOCK | ClassPreview3D.tsx | ✅ |
| 17 | Armes GLB 404 (chemin cassé) | weaponProfiles.json + weaponCatalog.ts | ✅ |
| 18 | KTX2 OOM (worker 4→1) | sharedLoaders.ts | ✅ |
| 19 | Colliders doublés (clear BVH) | CollisionWorld.ts | ✅ |
| 20 | Spawn forge y=5→y=-26 | mapConfig.ts | ✅ |
| 21 | dashEnduranceSpent undefined | PlayerRig.tsx (guard) | ✅ |
| 22 | dead code slopeslide/ledgegrab | OwnAnimPlayerCharacter.tsx | ✅ |
| 23 | Armes intégrées visibles (regex) | builtinWeaponMask.ts | ✅ |
| 24 | Crouch walk déformé | AnimationController.ts (reverti) | ⚠️ |
| 25 | FPS combat animations | RpgGameWorld.tsx (reverti) | ⚠️ |

## 🔴 BUGS EN COURS

| # | Bug | Gravité | Détail |
|---|-----|---------|--------|
| 1 | **TPS écran noir** | 🔴 P0 | Caméra 3ème personne = noir. FPS marche. Pitch clamp + near:0.3 + collision off + spawn fix appliqués. Fonctionnait puis cassé par changements agents. FpsCamera.ts forward offset retiré, RpgGameWorld.tsx + AnimationController.ts reverti. |
| 2 | Modèle 3D timeout 15s | 🟠 P1 | Murdock.glb 93MB ne charge pas dans les 15s. Filet de sécurité déclenché 4×. |
| 3 | Fuite mémoire reload | 🟠 P1 | Colliders s'accumulent (71→1538), VRAM non libérée, chunks 30-90s |
| 4 | FPS poings/armes | 🟡 P2 | Animations combat FPS pas implémentées |

## 📁 FICHIERS MODIFIÉS

| Fichier | Changements |
|---------|------------|
| `src/rpg/runtime/movement/FpsCamera.ts` | Pitch clamp ±86°, collision off, forward offset retiré, YXZ order |
| `src/rpg/runtime/RpgGameWorld.tsx` | near:0.3, Suspense local FPS (reverti), safety net 5s (retiré) |
| `src/rpg/runtime/movement/CharacterController.ts` | CTRL toggle, fallThreshold -10000, crouchToggled |
| `src/rpg/runtime/movement/InputManager.ts` | crouchEdge, consumeCrouch, injectCrouch |
| `src/rpg/runtime/movement/playerConfig.ts` | tpsDistance 4.0 |
| `src/rpg/runtime/mapConfig.ts` | forge spawn [0,-26,10] |
| `src/rpg/runtime/CollisionWorld.ts` | colliderSet, null guard, clear() avec dispose BVH |
| `src/rpg/loaders/sharedLoaders.ts` | KTX2 worker 4→1 |
| `src/rpg/characters/OwnAnimPlayerCharacter.tsx` | Timeout 5s→15s, dead code retiré, oneShotAction fix |
| `src/rpg/characters/builtinWeaponMask.ts` | Regex armes CamelCase |
| `src/rpg/characters/ClassPreview3D.tsx` | WRAITH→MURDOCK + modelPath dynamique |
| `src/rpg/weapons/weaponProfiles.json` | assets_character→armes/weapon |
| `src/rpg/weapons/FpsUnarmedViewmodel.tsx` | Import React |
| `public/models/assets_character/murdock/Murdock.glb` | KTX2→PNG (93MB) |

## 🧠 STUDIO IA

| Rôle | Skill | Statut |
|------|-------|--------|
| Chef Projet | `studio-pm` | Actif |
| Développeur | `studio-dev` | Actif |
| QA Testeur | `studio-qa` | Actif |
| Optimiseur | `studio-perf` | Actif |
| Level Design | `studio-level-design` | Créé |
| Moteur | `studio-engine-dev` | Créé |
| Combat | `studio-combat` | Créé |
| Analyse Vidéo | `studio-video-analysis` | Créé |
| Architecture | `studio-ia-architecture` | Créé |
| Test Interactif | `game-tester` | Créé |

## 📈 STATS
- **Tests** : 1685/1701 passent (16 pré-existants)
- **Agents déployés** : ~60 cette session
- **Fichiers modifiés** : 25+
- **Compilation** : 0 nouvelle erreur tsc
- **Modèle** : Murdock.glb 93MB PNG (40 textures)

## 🎯 PROCHAINES ÉTAPES
1. 🔴 **Fixer TPS écran noir** — PRIORITÉ ABSOLUE
2. 🟠 Précharger Murdock.glb dans AssetPreloader (timeout 15s→30s)
3. 🟠 Nettoyage mémoire au changement de perso
4. 🟡 Ré-implémenter combat FPS (sans casser TPS)
5. 🟡 Ré-implémenter crouch walk (sans casser TPS)