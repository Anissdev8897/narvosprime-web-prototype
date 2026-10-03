# RÉPARTITION DU CHANTIER — Claude ⟷ Hermes

**Date :** 2026-08-02 · **Base mesurée** (à re-mesurer, jamais recopier) :

```
npm test         → 1743 / 1743, 168 fichiers, 0 échec, aucune suite « (0 test) »
npx tsc --noEmit → 21 erreurs — TOUTES dans le lot Hermes
```

Point de départ de la session : 37 tests rouges + 109 erreurs tsc.

## ✅ Lot tsc de Claude : SOLDÉ (38 → 0)

`MathWasm` 28 · `gameplayDebugger` 17 · `IKController` 11 · `NavMeshBenchmark` 9 ·
`fps.bench` 6 · `characterController.bench` 4 · `footstepSystem` 4 ·
`WasmAnimationGraph` 2 · `WasmPthreads` 1 · `InputTriggers.test` 1.

**Il reste à Claude ses bugs d'audit** (A1-A7, P1-P6, #17) — voir plus bas.

## ⏳ Lot tsc de Hermes : 21 erreurs

`materials/shaders/generated/index.ts` 4 · `WebGPUCanvas.tsx` 3 · `ChunkLOD.ts` 3 ·
`LODBenchmark.ts` 2 · `useChunkLOD.ts` 1 · `ChunkWorker.worker.ts` 1 ·
`gameSettings.ts` 1 · `SpaceWarfare.tsx` 1 · `items/lootTables.ts` 1 ·
`items/stacking.ts` 1 · `ui/Modal.tsx` 1 · `ui/Tooltip.tsx` 1 · `InventoryScreen.tsx` 1.

> **Ce sont les 21 dernières erreurs du projet.** À zéro, `npm run build`
> repasse au vert pour la première fois depuis le 31/07.

---

## RÈGLE N°1 — AUCUN FICHIER PARTAGÉ

La découpe est faite **par fichier**, pas par thème. Un fichier appartient à un seul
des deux. Si un correctif exige de toucher un fichier de l'autre :

> **on ne l'édite pas — on écrit la demande dans `.hermes/DEMANDES_CROISEES.md`**
> (fichier / ligne / ce qu'il faut / pourquoi), et l'autre l'applique.

Les deux fichiers à haut risque de collision sont nommément attribués :

| Fichier | Propriétaire | Raison |
|---|---|---|
| `runtime/RpgGameWorld.tsx` (3787 l.) | **Hermes** | O1 et Q1 y vivent (`:2792` far caméra, `:2807-2809` shadow camera). Claude n'y touche pas. |
| `runtime/CollisionWorld.ts` | **Claude** | `getGroundMaterial` (4 err. tsc) + domaine mouvement. Hermes passe par une demande croisée pour M1. |

---

## 🔵 CLAUDE — Squelette · Animation · WASM · Personnage modulaire

### Fichiers possédés
```
src/rpg/animation/**            src/rpg/wasm/**
src/rpg/characters/**           wasm/src/**              (C++)
src/rpg/runtime/movement/**     src/rpg/benchmarks/**
src/rpg/threading/WasmPthreads.ts
src/rpg/audio/footstepSystem.ts + .test.ts
src/rpg/runtime/CollisionWorld.ts
src/rpg/runtime/input/**
src/rpg/forge/ForgePersonnages.tsx + bodyParts.ts
```

### tsc — 38 erreurs
| Fichier | Err. | Nature |
|---|---|---|
| `animation/IKController.ts` | 11 | `IKBenchmarkResult` + `animRunBenchmark` absents du moteur |
| `wasm/NavMeshBenchmark.ts` | 9 | importe 9 symboles que `NavMeshBridge` n'exporte pas |
| `benchmarks/fps.bench.ts` | 6 | signature `CharacterController.update` périmée + `"npc:death"` hors `WorldEvents` |
| `benchmarks/characterController.bench.ts` | 4 | idem |
| `audio/footstepSystem.ts` + `.test.ts` | 4 | `CollisionWorld.getGroundMaterial` n'existe pas |
| `wasm/WasmAnimationGraph.ts` | 2 | `animGraphAddBlendDirectional`, `animGraphGetBlendDecisions` absents |
| `threading/WasmPthreads.ts` | 1 | expression non appelable |
| `runtime/input/InputTriggers.test.ts` | 1 | 3 arguments au lieu de 2 |

> ⚠️ Même schéma que `MathWasm` : **vérifier d'abord si le binding existe** avant
> de le déclarer. Méthode : `Select-String wasm/src/bridge/Bindings.cpp -Pattern 'function\("nom'`
> puis recherche du nom dans le binaire `public/wasm/narvos-engine.wasm`
> (les noms embind vivent dans le `.wasm`, pas dans le `.js`). Si absent →
> binding **optionnel** + garde `e?.nom`, jamais un `as any`.

### Bugs d'audit
| ID | Sév. | Sujet |
|---|---|---|
| **A1** | 🔴 | Crouchwalk diagonale = pose figée. `solveLocomotion` prend l'angle brut ; W+D = 45° → clé `crouchwalk_forwardRight` inexistante → `dominant=null` → `act.time=0` chaque frame |
| **A2** | 🔴 | Le bassin ne descend JAMAIS : `remapOne` supprime toutes les pistes `.position`, le masque `legsOnly` exclut le pelvis → jambes pliées, bassin debout |
| **A5** | 🟠 | `quantizeDirection` (hystérésis 12°) est du code mort — c'est elle qui éviterait A1 |
| **A3** | 🟠 | Events d'overlay lus sur le playhead de `this.current` (clip loopé), pas sur l'overlay |
| **A4** | 🟠 | `makeClipAdditive` reçoit `mixer.timeScale` là où un framerate est attendu |
| **A6** | 🟡 | Retour de saut : idle joué en apesanteur entre fin du clip et `velocity.y < -1` |
| **A7** | 🟡 | `IDLE_SPEED=0.3` vs hystérésis crouch 0.2/0.5 → zone grise |
| **P1** | 🔴 | `characters/modular/` = 100 % code mort (zéro import hors de ses tests) |
| **P2** | 🔴 | Objectif « découper les héros » abandonné : la voie par **os dominant** (skinIndex/skinWeight) n'a jamais été essayée |
| **P4·P5·P6** | 🟠 | Catalogue féminin incomplet, `SLOT_HIDES` vide, offsets à l'aveugle |
| **#17** | 🔴 | IA WASM aveugle — pas de perception après le fix PlayerTag (portage NPCEyesSightPRO, 7 fichiers) |

---

## 🟢 HERMES — Environnement · Rendu · Éclairage · Éditeur de map · UI

### Fichiers possédés
```
src/rpg/runtime/RpgGameWorld.tsx          src/rpg/runtime/TunableEnvironment.tsx
src/rpg/runtime/optimizations/**          src/rpg/materials/**
src/rpg/runtime/WebGPUCanvas.tsx          src/rpg/threading/ChunkWorker.worker.ts
src/rpg/settings/**                       src/rpg/items/**
src/rpg/runtime/space/**                  src/ui/**
src/components/**                         + dayNightCycle · weatherSystem · assetQuality
                                          · PostProcessingPipeline · SettingsPanel
src/rpg/forge/  (TOUT sauf ForgePersonnages.tsx et bodyParts.ts)
```

### tsc — 21 erreurs
| Fichier | Err. | Nature |
|---|---|---|
| `materials/shaders/generated/index.ts` | 4 | 4 noms de shaders introuvables (`terrain_vert_glsl`…) — génération désynchronisée |
| `runtime/WebGPUCanvas.tsx` | 3 | `Props` absent de `@react-three/fiber` (→ `GLProps`) ; `THREE.WebGPURenderer` n'existe pas dans `@types/three` |
| `runtime/optimizations/ChunkLOD.ts` | 3 | `OffscreenCanvas` incompatible ; `Vector3` passé là où une `Camera` est attendue (×2) |
| `runtime/optimizations/LODBenchmark.ts` | 2 | `HTMLCanvasElement` passé pour un `Object3D` |
| `runtime/optimizations/useChunkLOD.ts` | 1 | `Vector3` au lieu de `Camera` |
| `settings/gameSettings.ts` | 1 | `renderer` manquant dans `VideoSettings` |
| `runtime/space/SpaceWarfare.tsx` | 1 | `active` absent de `ProjectilePool` |
| `items/lootTables.ts` · `items/stacking.ts` | 2 | `Rarity` non exporté ; `gridW`/`gridH` manquants |
| `ui/Modal.tsx` · `ui/Tooltip.tsx` | 2 | props `PanelProps` incompatibles ; 1 argument attendu |
| `components/inventory/InventoryScreen.tsx` | 1 | `ItemStats` vs `Record<string, number>` |
| `threading/ChunkWorker.worker.ts` | 1 | `DedicatedWorkerGlobalScope` — manque `"webworker"` dans les libs tsconfig |

### Bugs d'audit
| ID | Sév. | Sujet |
|---|---|---|
| **O1** | 🔴 | **Ombres invisibles sur ~95 % des maps** : shadow camera ortho ±60 m centrée sur l'ORIGINE monde, jamais recentrée sur le joueur. Spawn Forge `[-444,-60,712]` = 830 m hors boîte. Fix classique : shadow camera qui suit le joueur avec *texel snapping* |
| **Q1** | 🔴 | `renderDistance` : slider 300–3000 m persisté et **jamais lu** ; `far` caméra en dur à 2000 |
| **C1** | 🟠 | envMap PMREM régénérée **4×/seconde** en continu (`useEffect` sur `backgroundColor`, qui change à chaque push du cycle) |
| **O2** | 🟠 | La nuit, `sunPos.y` = −10/−20/−15 avec `castShadow` → scène éclairée **par en dessous** |
| **Q2** | 🟠 | Fallback qualité injuste : `low` sans `.low.glb` → repli sur **HIGH**, jamais `.med` |
| **Q3** | 🟠 | PostFX low jamais appliqué : `halfRes` calculé inutilisé, passe normale payée sans SSAO |
| **O3·C2·C3·C4** | 🟡 | chunks jamais `castShadow` · trou 4h→5h dans le cycle · `FogExp2` recréée 4×/s · `STATIC_MAPS` dupliqué |
| **M1** | 🔴 | Forge : plan cliquable à y=−0.01 + clamp `y≥0` → sur la Forge (sol ≈ −51) **tout objet posé flotte 50 m au-dessus** |
| **M2** | 🔴 | Undo incohérent : snapshot `{objects, waters}` seulement ; `updateObject` ne pousse rien ; 500 snapshots JSON ≈ 50 Mo |
| **M3·M4·M5·M7·M11** | 🟠 | calques/préfabs non persistés · météo non WYSIWYG · drag spline sur la sphère · zéro instancing · sync live partielle |
| **M6·M8·M9·M10** | 🟡 | `showShadows` décoratif · save sans dirty-checking · id `Date.now()` · `alignObjects` aplatit à y=0 |

---

## Protocole commun (les deux, à chaque fin de lot)

```powershell
npm test 2>&1 | Select-Object -Last 5          # doit rester 1743+/1743+, 0 échec
npx tsc --noEmit 2>&1 | Select-String "error TS" | Measure-Object   # doit BAISSER
npm test 2>&1 | Select-String "\(0 test\)"     # doit être VIDE
```

Règles héritées de la session (voir `narvos-error-log`, entrées du 02/08) :

1. **Un test rouge n'est pas présumé périmé.** Sur les 15 suites rouges du 31/07,
   **6 correctifs touchaient du code de production**. Lire l'erreur avant de classer.
2. **« (0 test) » est un échec**, pas une suite vide.
3. **Ne jamais faire taire tsc avec `as any`.** C'est exactement ce qui a masqué
   28 appels vers des bindings inexistants pendant des semaines : le seul appel
   rustiné (`approach`) ne levait plus d'erreur, donc plus personne ne voyait le
   problème sur les 27 autres.
4. Compteurs re-mesurés à chaque rapport, jamais recopiés — sortie brute collée.

## Ce que Claude a déjà fait ce jour (ne pas refaire)

Suite de tests remise à 1743/1743 (13 fichiers rouges + 2 qui ne se chargeaient pas).
Six correctifs de production : `RagdollSystem` (API Babylon dans du Three.js),
`ObjectPool.warmupPool` (pré-créait 1 objet au lieu de N), `MappingContext.activateOnly`
(écriture sur getter → levée), `InputModifiers` (division par zéro → `Infinity`),
`Benchmark.tick` (muet sans renderer), `MonitoringService` (fuite de `setInterval`).
Plus : `sharp` réparé (DLL `libvips-cpp` orpheline — **tout le pipeline d'assets**
était hors service), `MathWasm` (28 err.), `gameplayDebugger` (17 err.).