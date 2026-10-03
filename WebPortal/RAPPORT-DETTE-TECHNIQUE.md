# RAPPORT DETTE TECHNIQUE — Narvos Prime WebPortal

> **Équipe DETTE TECHNIQUE** — Scan complet du 29/07/2026  
> **Périmètre :** `src/`, `electron/`, `net/`, `scripts/` (exclut `node_modules/`, `_legacy_archive/`)  
> **Fichiers source :** ~500+ .ts/.tsx, ~66 777 lignes total

---

## VUE D'ENSEMBLE — COMPTEURS PAR CATÉGORIE

| # | Catégorie | Occurrences | Priorité |
|---|---|---|---|
| 1 | `console.log / warn / error` (debug en prod) | **~190 appels** | 🔴 HAUTE |
| 2 | `eslint-disable` (règles contournées) | **52** | 🔴 HAUTE |
| 3 | `as any / as unknown` (casts forcés) | **49** | 🟠 MOYENNE |
| 4 | Fichiers > 500 lignes (composants obèses) | **14 fichiers** | 🟠 MOYENNE |
| 5 | `catch` vide (erreurs ignorées) | **4** | 🔴 HAUTE |
| 6 | `null!` (assertions non-null) | **1 (src/)** | 🟡 BASSE |
| 7 | `@ts-ignore / @ts-expect-error` | **0 (src/)** | 🟢 OK |
| 8 | `TODO / FIXME / HACK / XXX` (src/) | **0** | 🟢 OK (dans le src actif) |
| 9 | `any` dans les signatures de types | 0 explicite | 🟢 OK |
| 10 | `setTimeout(0, ...)` (hack timing) | **0** | 🟢 OK |
| **TOTAL** | | **~310 items** | |

---

## 1. 🔴 `console.log / warn / error` — Logs de debug en production

### `src/` — 152 appels

**Les pires fichiers :**

| Fichier | Lignes | Occurrences |
|---|---|---|
| `src/utils/storage.ts` | 1–864 | **~45 appels** |
| `src/utils/AudioManager.ts` | 1–653 | **~20 appels** |
| `src/rpg/runtime/RpgGameWorld.tsx` | 1–3995 | **~12 appels** |
| `src/rpg/runtime/StreamingPuzzleMap.tsx` | 1–1027 | **~10 appels** |
| `src/rpg/animation/AnimationController.ts` | 1–922 | **~5 appels** |
| `src/rpg/characters/OwnAnimPlayerCharacter.tsx` | 1–698 | **~3 appels** |
| `src/rpg/npc/Npc.tsx` | 1–660 | **~3 appels** |
| `src/rpg/materials/autoMaterialStore.ts` | 1–396 | **~7 appels** |
| `src/main.tsx` | — | Monkey-patch de `console.warn` |
| `src/rpg/runtime/PuzzleMap.tsx` | — | Monkey-patch de `console.warn` |

**Exemples représentatifs :**
```typescript
// src/utils/storage.ts:21-22
console.log(`%c[Storage] Electron detected: ${isElectron}`, ...);
console.log(`%c[Storage] narvosLauncher available:`, 'color: blue', ...);

// src/rpg/runtime/PuzzleMap.tsx:141-142
const _warn = console.warn;
console.warn = (...args: unknown[]) => { ... };  // Monkey-patch !

// src/main.tsx:42-43
const _warn = console.warn.bind(console);
console.warn = (...args: unknown[]) => { ... };  // Monkey-patch !
```

### `electron/` — ~64 appels

| Fichier | Occurrences |
|---|---|
| `electron/main.ts` (808 lignes) | **~36 appels** |
| `electron/localDatabase.ts` (808 lignes) | **~26 appels** |
| `electron/database.ts` (570 lignes) | **~14 appels** |

Les logs Electron sont plus acceptables (process back-end), mais `main.ts` et `localDatabase.ts` sont saturés.

### `net/` — 8 appels

```typescript
// net/socket.ts:85-306
console.log('[Socket] Connected');
console.log('[Socket] Disconnected');
console.error('[Socket] Error:', error);
console.warn('[Socket] Not connected, cannot send');
console.warn('[Socket] Server error:', ...);
```

### Recommandation
- Migration vers un logger structuré (ex: `pino`, `winston`, ou logger interne avec niveaux `debug`/`info`/`warn`/`error`)
- Les messages de diagnostic devraient être conditionnés par `process.env.NODE_ENV !== 'production'` ou `import.meta.env.DEV`
- Supprimer les monkey-patches de `console.warn` dans `PuzzleMap.tsx` et `main.tsx`

---

## 2. 🔴 `eslint-disable` — Règles ESLint désactivées

**52 occurrences dans `src/`**

| Règle contournée | Occurrences | Fichiers touchés |
|---|---|---|
| `react-hooks/exhaustive-deps` | **30** | RpgGameWorld (9), StreamingPuzzleMap (4), PlayerRig (2), HumanCharacter (2), useFbxAnimationPack (2), AnimatedModularCharacter, OwnAnimPlayerCharacter, ForgeBuiltMap, ForgeEditor, ForgeMapBackdrop, GameHUD, Npc, LoadingScreen, StressBots, WeaponSocket, HarvestNode, ForgeMiniGame |
| `@typescript-eslint/no-explicit-any` | **10** | sharedLoaders (3), ktx2 (3), installKtx2Everywhere (1 bloc), CollisionWorld, TransformGizmo, PropPlacer, ForgeBuilderScene, forgeSync, StreamingPuzzleMap |
| `no-console` | **4** | AdminPanel, CanvasErrorBoundary, MapGenPanel, AssetPreloader |
| `@typescript-eslint/no-unused-vars` | **3** | ShipFlightUI |
| `no-alert` | **1** | NpcAdminPanel |

**Exemples :**
```typescript
// src/rpg/runtime/RpgGameWorld.tsx — 9x
// eslint-disable-next-line react-hooks/exhaustive-deps
useEffect(() => { ... }, []); // Dépendances manquantes intentionnellement

// src/rpg/loaders/installKtx2Everywhere.ts:37
/* eslint-disable @typescript-eslint/no-explicit-any */
```

### Recommandation
- `exhaustive-deps` : soit ajouter les dépendances manquantes, soit documenter pourquoi l'effet doit être volontairement partiel (avec commentaire explicite)
- `no-explicit-any` : remplacer par `unknown` + garde de type, ou définir une interface minimale
- `no-console` : remplacer par logger dédié

---

## 3. 🟠 `as any / as unknown` — Casts forcés

**49 occurrences dans `src/`**

### Top fichiers :

| Fichier | Occurrences | Motif |
|---|---|---|
| `src/utils/storage.ts` | **9** | Accès `narvosLauncher as any`, `char.stats as any` |
| `src/rpg/forge/ForgeBuiltMap.tsx` | **1** | `mat as unknown as Record<string, unknown>` |
| `src/rpg/runtime/StreamingPuzzleMap.tsx` | **4** | `loader as any`, `mat as unknown as`, cast de type |
| `src/rpg/runtime/RpgGameWorld.tsx` | **1** | `window as any` pour electronAPI |
| `src/rpg/runtime/CollisionWorld.ts` | **3** | Monkey-patch prototype Three.js |
| `src/rpg/runtime/CharacteristicsPanel.tsx` | **2** | `stats as unknown as Record<string, unknown>` |
| `src/rpg/runtime/PuzzleMap.tsx` | **1** | `mat as unknown as Record<string, unknown>` |
| `src/rpg/runtime/loading/assetDisposal.ts` | **1** | `mat as unknown as Record<string, unknown>` |
| `src/rpg/runtime/loading/chunkCache.ts` | **1** | `window as unknown as Record<string, unknown>` |
| `src/rpg/runtime/movement/CharacterController.slide.test.ts` | **1** | `as unknown as InputManager` |
| `src/rpg/runtime/movement/ClimbController.test.ts` | **1** | `as unknown as { probe: ClimbProbe }` |
| `src/rpg/runtime/movement/InputManager.ts` | **1** | `as unknown as Promise<void>` |
| `src/rpg/loaders/sharedLoaders.ts` | **1** | `as unknown as { workerConfig? ... }` |
| `src/rpg/loaders/installKtx2Everywhere.ts` | **2** | `as unknown as LoaderCtor` |
| `src/rpg/animation/useFbxAnimationPack.ts` | **2** | `as unknown as THREE.Group[]`, `as unknown as Array<...>` |
| `src/rpg/forge/ForgeBuilderScene.tsx` | **1** | `undefined as unknown as THREE.MOUSE` |
| `src/rpg/forge/forgeSync.ts` | **1** | `socket as any` |
| `src/rpg/skeleton/UniversalRetargeter.ts` | **2** | `tc as any` |
| `src/rpg/characters/AnimatedModularCharacter.tsx` | **2** | `tc as any` |
| `src/rpg/persistence/dbStore.ts` | **1** | `window as any` |
| `src/rpg/wasm/WasmBridge.ts` | **1** | `globalThis as unknown as Record<string, unknown>` |
| `src/rpg/combat/DamageNumbers.tsx` | **2** | `as unknown as { sync?: ... }`, `as unknown as THREE.Mesh` |
| `src/rpg/weapons/WeaponSocket.tsx` | **1** | `as unknown as THREE.Group` |
| `src/components/LoginScreen.tsx` | **2** | `window as any` |
| `src/components/character/CharacterSelectScreen.tsx` | **2** | `window as any` |
| `src/rpg/npc/npcVisibilityDiagnostic.ts` | **1** | `window as unknown as Record<string, unknown>` |
| `src/rpg/runtime/environment/weatherSystem.ts` | **1** | `as unknown as Partial<EnvConfig>` |

**Exemples :**
```typescript
// src/rpg/runtime/CollisionWorld.ts:21-23 — Monkey-patch Three.js
(THREE.BufferGeometry.prototype as any).computeBoundsTree = computeBoundsTree;
(THREE.BufferGeometry.prototype as any).disposeBoundsTree = disposeBoundsTree;
(THREE.Mesh.prototype as any).raycast = acceleratedRaycast;

// src/rpg/skeleton/UniversalRetargeter.ts:225-226
(tc as any).times = newTimes;
(tc as any).values = ...;

// src/rpg/forge/ForgeBuiltMap.tsx:62
const val = (mat as unknown as Record<string, unknown>)[key];
```

### Recommandation
- Centraliser les accès `window.electronAPI` / `narvosLauncher` dans un module avec typages stricts (fichier `global.d.ts`)
- Remplacer `as any` par `unknown` + type guards
- Les monkey-patches Three.js devraient utiliser les déclarations de module (`declare module 'three'`)

---

## 4. 🟠 Fichiers obèses (> 500 lignes)

| Fichier | Lignes | Problème |
|---|---|---|
| `src/rpg/runtime/RpgGameWorld.tsx` | **3 995** | 🔴 MONOLITHE — devrait être découpé en 5+ fichiers |
| `src/rpg/runtime/StreamingPuzzleMap.tsx` | **1 027** | 🟠 Trop gros |
| `src/rpg/animation/AnimationController.ts` | **922** | 🟠 Trop gros |
| `src/utils/storage.ts` | **891** | 🟠 Trop gros |
| `electron/main.ts` | **843** | 🟠 Trop gros |
| `electron/localDatabase.ts` | **808** | 🟠 Trop gros |
| `src/utils/AudioManager.ts` | **725** | 🟠 Trop gros |
| `src/rpg/characters/OwnAnimPlayerCharacter.tsx` | **698** | 🟠 Trop gros |
| `src/rpg/npc/Npc.tsx` | **660** | 🟠 Trop gros |
| `src/rpg/forge/ForgeEditor.tsx` | **653** | 🟠 Trop gros |
| `src/rpg/runtime/SpaceEnvironment.tsx` | **640** | 🟠 Trop gros |
| `src/rpg/characters/AnimatedModularCharacter.tsx` | **606** | 🟠 Trop gros |
| `src/rpg/runtime/admin/AdminPanel.tsx` | **590** | 🟠 Trop gros |
| `electron/database.ts` | **570** | 🟠 Trop gros |

**Risques :** maintenabilité réduite, re-rendus excessifs (React), conflits git fréquents, testabilité faible.

### Recommandation
- `RpgGameWorld.tsx` (3995 lignes) : **priorité #1** — extraire les sous-composants, les hooks personnalisés, les services
- Chaque fichier devrait idéalement faire < 400 lignes

---

## 5. 🔴 `catch` vides — Erreurs ignorées silencieusement

**4 occurrences dans `src/` (toutes dans `src/utils/storage.ts`)**

```typescript
// src/utils/storage.ts:364
} catch (e) { }
// src/utils/storage.ts:389
} catch (e) { }
// src/utils/storage.ts:399
} catch (e) { }
// src/utils/storage.ts:639
} catch (e) { }
```

### Recommandation
- **TRÈS DANGEREUX** — ne jamais ignorer silencieusement une erreur
- Au minimum logger l'erreur : `catch (e) { console.warn('[storage]', e); }`
- Idéalement gérer le cas d'échec (fallback, retry, notification utilisateur)

---

## 6. 🟡 `null!` — Assertions non-null

**1 occurrence dans `src/`**

```typescript
// src/rpg/skeleton/UniversalCharacter.tsx:87
const group = useRef<THREE.Group>(null!);
```

### Recommandation
- Remplacer par une assertion de type sécurisée ou initialiser correctement le ref
- Vérifier que le composant gère le cas où `group.current` est null

---

## 7. ✅ `@ts-ignore / @ts-expect-error` — Propre dans `src/`

**Aucune occurrence dans le code source actif** (`src/`, `electron/`, `net/`).  
(93 occurrences dans `node_modules/` et `_legacy_archive/` seulement — hors périmètre.)

---

## 8. ✅ `TODO / FIXME / HACK / XXX` — Propre dans `src/`

**Aucune occurrence dans le code source actif.**  
(200+ occurrences dans `node_modules/` et `_legacy_archive/` seulement.)

---

## RÉSUMÉ PAR PRIORITÉ

### 🔴 HAUTE — À corriger immédiatement
| Action | Items |
|---|---|
| Remplacer `console.log/warn/error` par un logger structuré | ~190 appels |
| Corriger les 4 `catch (e) { }` vides | 4 dans `storage.ts` |
| Réduire `RpgGameWorld.tsx` (3995 lignes) | 1 fichier monolithe |
| Supprimer les monkey-patches de `console.warn` | 2 fichiers |

### 🟠 MOYENNE — À corriger cette semaine
| Action | Items |
|---|---|
| Remplacer `as any` par `unknown` + type guards | 49 occurrences |
| Découper les 14 fichiers > 500 lignes | 14 fichiers |
| Corriger les `eslint-disable react-hooks/exhaustive-deps` | 30 occurrences |
| Remplacer `eslint-disable no-explicit-any` | 10 occurrences |

### 🟡 BASSE — À planifier
| Action | Items |
|---|---|
| Remplacer `null!` par initialisation sécurisée | 1 occurrence |
| Audit des `eslint-disable` restants | 12 occurrences diverses |

---

## FILS ROUGES TRANSVERSAUX

1. **Accès `window as any` / `narvosLauncher as any`** (15+ occurrences)  
   → Solution : typage global via `declare global { interface Window { narvosLauncher: ... } }`

2. **Monkey-patching Three.js** (`CollisionWorld.ts`, `installKtx2Everywhere.ts`)  
   → Solution : utiliser les extension points officiels ou `declare module`

3. **Logs de diagnostic conditionnels** (`if (DEV) console.log(...)`)  
   → Solution : extraire dans un module `logger.ts` avec niveaux et filtrage par env

4. **Manipulation de `TrackClip.times/values` par `as any`** (`UniversalRetargeter.ts`, `AnimatedModularCharacter.tsx`)  
   → Solution : wrapper typé autour de l'API Three.js Animation

---

*Rapport généré automatiquement par l'Équipe DETTE TECHNIQUE.*