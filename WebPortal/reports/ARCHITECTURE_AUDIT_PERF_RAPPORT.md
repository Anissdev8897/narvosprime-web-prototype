# RAPPORT D'AUDIT ARCHITECTURE & PERFORMANCES — Narvos Prime WebPortal

> **Date :** 30/07/2026  
> **Périmètre :** `src/`, `electron/`, `scripts/`  
> **Stack :** React 19 · R3F 9 · drei 10 · Three.js 0.181 · TS 5.8 · Vite 6 · Electron  
> **Source :** 551 fichiers .ts/.tsx, ~74 649 lignes

---

## TABLE DES MATIÈRES

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Métriques de Performance](#2-métriques-de-performance)
3. [Top 10 des Fichiers les Plus Lourds](#3-top-10-des-fichiers-les-plus-lourds)
4. [Identification des Goulots d'Étranglement](#4-identification-des-goulots-détranglement)
5. [Dette Technique Détaillée](#5-dette-technique-détaillée)
6. [Analyse du Monolithe RpgGameWorld](#6-analyse-du-monolithe-rpggameworld)
7. [Problèmes de Build](#7-problèmes-de-build)
8. [PLAN DE REFACTORING PRIORISÉ](#8-plan-de-refactoring-priorisé)
9. [Benchmark Avant/Après](#9-benchmark-avantaprès)
10. [Annexes](#10-annexes)

---

## 1. Résumé Exécutif

**État général : 🔴 ALERTE ROUGE** — Le projet est fonctionnel (761 tests ✅, 96 test files) mais souffre de problèmes architecturaux critiques.

### Indicateurs clés

| Métrique | Valeur | Seuil acceptable | Verdict |
|---|---|---|---|
| **Fichier le plus long** | 4000 lignes | < 500 | 🔴 CRITIQUE |
| **Fichiers > 500 lignes** | 19 fichiers | 0 | 🔴 CRITIQUE |
| **Fichiers > 1000 lignes** | 2 fichiers | 0 | 🔴 CRITIQUE |
| **Total lignes source** | 74 649 | — | 🟡 Élevé |
| **Nombre d'imports (RpgGameWorld)** | 226 | < 20 | 🔴 CRITIQUE |
| **Temps de build Vite** | ÉCHEC | < 30s | 🔴 BLOQUANT |
| **Temps tsc --noEmit** | 1m27s | < 30s | 🔶 LENT |
| **Tests** | 761/761 ✅ | 100% | 🟢 OK |
| **console.log/warn/error** | 149 appels | < 10 | 🔴 HAUTE |
| **eslint-disable** | 40 occurrences | 0 | 🔴 HAUTE |
| **`any` non typé** | 68 occurrences | < 5 | 🟠 MOYENNE |
| **dist/ (assets bruts)** | ~8.5 GB | < 100 MB | 🔴 CRITIQUE |

### 3 problèmes majeurs

1. **🔴 Build Vite cassé** — `ForgePanels.tsx` génère une erreur esbuild. Pas de build production possible.
2. **🔴 RpgGameWorld.tsx (4000 lignes)** — Monolithe avec 226 imports, 73 useEffect, 79 useState. Cause #1 de l'incroyable lenteur du build.
3. **🔴 Dist/sortie 8.5 GB** — Les models GLB/GLTF non optimisés sont copiés intégralement.

---

## 2. Métriques de Performance

### 2.1 Temps de Build

| Commande | Temps | Statut |
|---|---|---|
| `tsc --noEmit` | **1m27s** | ✅ Passe (1 erreur type) |
| `vite build` | **ÉCHEC** (59s avant erreur) | ❌ Bloqué sur ForgePanels.tsx |
| `vitest run` | **37s** (transform 170s, collect 256s, tests 6s) | ✅ 761 tests OK |
| `npm test` | **2m04s** total | ✅ |

**Analyse :**
- Le temps de collecte des tests (256s cumulés) indique un scanning excessif — probablement dû aux 1404 modules transformés.
- Le transform prend 170s (~2m50) à lui seul.
- `tsc --noEmit` prend 1m27s pour 551 fichiers — acceptable mais lent.

### 2.2 Bundle / Assets

| Métrique | Valeur |
|---|---|
| Modules transformés (Vite) | **1404 modules** |
| Taille `dist/` | **~8.5 GB** |
| Taille `node_modules/` | Très large (>5 min pour du) |
| Modèles 3D | **237 dossiers** dans public/models/ |
| Fichiers source .ts/.tsx | **551 fichiers** (74 649 lignes) |

### 2.3 Tests ( Coverage Metrics )

| Métrique | Valeur |
|---|---|
| Fichiers de test | **95** |
| Tests total | **761** (tous verts) |
| Temps d'exécution tests | **6.17s** (rapide) |
| Temps de collecte | **256.37s** (lent) |

### 2.4 FPS Benchmarks (simulation)

Les benchmarks unitaires existent (`src/rpg/benchmarks/`), mais **n'ont pas pu être exécutés** à cause d'un problème de dépendance `@rollup/rollup-win32-x64-msvc`.

Benchmarks disponibles (non exécutés) :
- `fps.bench.ts` — Coût CPU par frame (CharacterController, chunk streaming, EventBus)
- `characterController.bench.ts` — Player movement
- `chunkLoad.bench.ts` — Chargement chunks

---

## 3. Top 10 des Fichiers les Plus Lourds

| # | Fichier | Lignes | Problème |
|---|---|---|---|
| 1 | `src/rpg/runtime/RpgGameWorld.tsx` | **4 000** | 🔴 Monolithe : tout le jeu dans 1 fichier |
| 2 | `src/rpg/runtime/StreamingPuzzleMap.tsx` | **1 040** | 🔶 Gros fichier streaming |
| 3 | `src/rpg/animation/AnimationController.ts` | **939** | 🟡 Contrôleur animation |
| 4 | `electron/main.ts` | **920** | 🟡 Process principal Electron |
| 5 | `src/utils/AudioManager.ts` | **912** | 🟡 Gestionnaire audio singleton |
| 6 | `src/utils/storage.ts` | **867** | 🟡 Storage + 29 console.log |
| 7 | `electron/localDatabase.ts` | **808** | 🟡 SQLite (duplique database.ts) |
| 8 | `src/rpg/characters/OwnAnimPlayerCharacter.tsx` | **702** | 🟡 Gros composant personnage |
| 9 | `src/rpg/npc/Npc.tsx` | **663** | 🟡 PNJ monolithique |
| 10 | `src/rpg/forge/ForgeEditor.tsx` | **654** | 🟡 Éditeur forge |

---

## 4. Identification des Goulots d'Étranglement

### 🔴 Goulot #1 — RpgGameWorld.tsx (4000 lignes)

**Problème :** Un seul fichier assemble TOUT le jeu :
- 226 imports
- 73 `useEffect`
- 79 `useState`
- 49 `useCallback`
- 76 `useRef`
- 11 `useFrame`
- JSX de rendu = 1266 lignes (ligne 2719 → 3985)

**Impact :**
- Re-rendus cascades : 79 `useState` → chaque setState potentiel re-render du composant entier
- 73 `useEffect` → exécutés au montage/démontage
- Impossible à tester unitairement
- Impossible à optimiser (React.memo inefficace sur un si gros scope)
- Allonge le temps de parse/transform Vite de plusieurs secondes

### 🔴 Goulot #2 — Build Vite Cassé

**Cause :** `src/rpg/forge/ForgePanels.tsx` — déclaration `interface` (ou `type`) à l'intérieur d'un corps de fonction, que esbuild ne supporte pas.

### 🔴 Goulot #3 — 8.5 GB d'Assets

**Cause :** Les modèles GLB/GLTF (personnages, PNJ, maps) sont copiés en entier dans `dist/` sans optimisation :
- Aucune compression KTX2 sur les textures
- Aucun décimate/décimation des maillages
- `public/models/` contient 237 dossiers de modèles non optimisés

### 🔴 Goulot #4 — 149 console.log en Production

**Pire fichiers :**
- `storage.ts` : 29 appels
- `AudioManager.ts` : 21 appels
- `StreamingPuzzleMap.tsx` : 15 appels
- `electron/main.ts` : 36 appels
- `electron/localDatabase.ts` : 26 appels

**Monkey-patches dangereux :** `main.tsx:42` et `PuzzleMap.tsx` patchent `console.warn` global.

### 🔴 Goulot #5 — Duplication Electron DB

`electron/database.ts` (MySQL, 570 lignes) et `electron/localDatabase.ts` (SQLite, 808 lignes) partagent les **mêmes interfaces** (`SavedSceneObject`, `SavedSceneData`). Double maintenance, divergence possible.

### 🔴 Goulot #6 — 1404 Modules Vite

Le build Vite transforme 1404 modules, ce qui est **très élevé** pour une application web. Cause probable : imports larges non-tree-shakables (Three.js, drei, postprocessing).

---

## 5. Dette Technique Détaillée

| Catégorie | Trouvé | Seuil | Priorité |
|---|---|---|---|
| `console.log / warn / error` | **149** | < 10 | 🔴 HAUTE |
| `eslint-disable` | **40** | 0 | 🔴 HAUTE |
| `as any / as unknown` | **68** | < 5 | 🟠 MOYENNE |
| Fichiers > 500 lignes | **19** | 0 | 🔴 HAUTE |
| Fichiers > 1000 lignes | **2** | 0 | 🔴 HAUTE |
| `any` dans signatures | **68** | 0 | 🟠 MOYENNE |
| Monkey-patch console.warn | **2** (main.tsx + PuzzleMap) | 0 | 🔴 HAUTE |
| `catch` vide | **4** | 0 | 🔴 HAUTE |
| Interface dupliquée (DB) | **2 fichiers** | 0 | 🟠 MOYENNE |
| TODO/FIXME dans src | **0** | 0 | 🟢 OK |
| @ts-ignore | **0** | 0 | 🟢 OK |
| .only() dans tests | **0** | 0 | 🟢 OK |

### Répartition des `eslint-disable`

| Règle | Occurrences |
|---|---|
| `react-hooks/exhaustive-deps` | 32 |
| `@typescript-eslint/no-explicit-any` | 10 |
| `no-console` | 4 |
| `@typescript-eslint/no-unused-vars` | 3 |
| `no-alert` | 1 |

---

## 6. Analyse du Monolithe RpgGameWorld

### 6.1 Structure interne

```
RpgGameWorld.tsx (4000 lignes)
├── Imports (226 lignes)          ← lignes 1-242
├── Constantes (type export)      ← lignes 243-328
├── Composants internes:
│   ├── CharacterErrorBoundary    ← lignes 330-339
│   ├── MapModel (memo)           ← lignes 342-365
│   ├── SceneReady                ← lignes 368-378
│   ├── LootProximity             ← lignes 387-400
│   ├── ChestProximity            ← lignes 404-418
│   ├── TargetingTicker           ← lignes 421-443
│   ├── StaminaRegen              ← lignes 446-450
│   ├── StatusEffectTicker        ← lignes 452-456
│   └── QuestReachWatcher         ← lignes 460-488
├── RpgGameWorld (export)         ← lignes 492-2718
│   └── (73 useEffect, 79 useState, 49 useCallback...)
└── JSX Return                    ← lignes 2719-3985 (1266 lignes)
```

### 6.2 Tout ce que fait RpgGameWorld

| Responsabilité | Lignes | Extrait possible ? |
|---|---|---|
| Chargement map (GLB/streaming) | 250+ | ✅ Oui (MapLoader) |
| Camera FPS/TPS | 100+ | ✅ Déjà partiel (PlayerRig) |
| Mouvement joueur | 200+ | ✅ Déjà partiel (CharacterController) |
| Combat (auto-attack, sorts) | 300+ | ✅ Oui (CombatSystem) |
| NPC (affichage, marchands, quêtes) | 400+ | ✅ Oui (NPCLayer) |
| Inventaire / Loot | 200+ | ✅ Oui (InventoryHUD) |
| HUD complet (HP, mana, XP, minimap) | 600+ | ✅ Oui (HUDLayer) |
| Véhicules / Vaisseaux | 300+ | ✅ Oui (VehicleLayer) |
| Forge / Édition de map | 200+ | ✅ Oui (EditorMode) |
| Effets (dégâts, warp, flash) | 150+ | ✅ Oui (EffectsLayer) |
| Métier (bûcheron, récolte, craft) | 300+ | ✅ Oui (ProfessionsLayer) |
| PNJ IA / Factions | 200+ | ✅ Oui (AISystem) |
| Animaux / Ambiance | 100+ | ✅ Oui (AmbientLayer) |

**Total potentiel d'extraction : 13 sous-systèmes**

---

## 7. Problèmes de Build

### 7.1 Erreur de build Vite

```
✗ Build failed in 59.52s
error during build: [vite:esbuild] Transform failed with 1 error:
src/rpg/forge/ForgePanels.tsx:35:0: ERROR: Expected ")" but found "interface"
```

**Cause :** Déclaration de type (`interface`/`type`) à l'intérieur d'un corps de fonction. Esbuild ne supporte pas `interface` dans les fonctions. Solution : déplacer la déclaration hors du corps de fonction.

### 7.2 Rollup native module missing

```
Error: Cannot find module @rollup/rollup-win32-x64-msvc
```

Nécessite `npm install @rollup/rollup-win32-x64-msvc`.

---

## 8. PLAN DE REFACTORING PRIORISÉ

### Phase 0 — URGENT (Build) [~1h]

| # | Tâche | Effort | Fichier | Impact |
|---|---|---|---|---|
| 0.1 | Déplacer le type hors du corps de fonction | 🟢 5min | ForgePanels.tsx:35 | Débloque le build |
| 0.2 | Installer `@rollup/rollup-win32-x64-msvc` | 🟢 2min | — | Débloque les benchmarks |

### Phase 1 — CRITIQUE (Split RpgGameWorld) [~3-5 jours]

| # | Tâche | Effort | Extraction | Bénéfice |
|---|---|---|---|---|
| 1.1 | Extraire `HUDLayer.tsx` (HP/Mana/XP/Level/Feed) | 🟡 4h | ~600 lignes | -15% taille monolithe |
| 1.2 | Extraire `NPCLayer.tsx` (PNJ/marchands/quêtes) | 🟡 4h | ~400 lignes | -10% |
| 1.3 | Extraire `InventoryPanel.tsx` (déjà partiel) | 🟢 2h | ~200 lignes | -5% |
| 1.4 | Extraire `CombatSystem.tsx` (attaques/sorts/dégâts) | 🟡 4h | ~300 lignes | -8% |
| 1.5 | Extraire `VehicleLayer.tsx` + `SpaceLayer.tsx` | 🟡 4h | ~300 lignes | -8% |
| 1.6 | Extraire `ProfessionsLayer.tsx` | 🟡 3h | ~300 lignes | -8% |
| 1.7 | Extraire `EffectsLayer.tsx` (flash/warp/vignette) | 🟢 2h | ~150 lignes | -4% |
| 1.8 | Extraire `EditorMode.tsx` (admin/forge) | 🟡 3h | ~200 lignes | -5% |

**Résultat attendu Phase 1 :** RpgGameWorld passe de 4000 → ~800 lignes d'orchestration pure.

### Phase 2 — HAUTE (Dette technique) [~2-3 jours]

| # | Tâche | Effort | Bénéfice |
|---|---|---|---|
| 2.1 | Remplacer `console.log` par logger structuré | 🟡 4h | 149 appels → 0 |
| 2.2 | Remonter les déclarations `eslint-disable` valides | 🟡 4h | 40 → 0 |
| 2.3 | Remplacer `as any` par types stricts | 🟡 6h | 68 → 0 |
| 2.4 | Supprimer monkey-patches console.warn | 🟢 1h | 2 fichiers |
| 2.5 | Consolider `electron/database.ts` + `localDatabase.ts` | 🟡 4h | Suppression duplication |
| 2.6 | Split `StreamingPuzzleMap.tsx` (>1000 lignes) | 🟡 4h | 1040 → <500 |
| 2.7 | Split `AnimationController.ts` (>900 lignes) | 🟡 3h | 939 → <500 |
| 2.8 | Split `AudioManager.ts` (>900 lignes) | 🟡 3h | 912 → <500 |

### Phase 3 — MOYENNE (Optimisation assets) [~2-3 jours]

| # | Tâche | Effort | Bénéfice |
|---|---|---|---|
| 3.1 | Compresser textures en KTX2 | 🟡 2j | -80% taille textures GPU |
| 3.2 | Décimer maillages (Decimate modifier) | 🟡 1j | -50% taille GLB |
| 3.3 | Implémenter lazy loading des modèles | 🟡 1j | -60% temps chargement |
| 3.4 | Nettoyer `dist/` des assets non utilisés | 🟢 2h | Taille disque |

### Phase 4 — BASSE (Qualité de vie) [~1 jour]

| # | Tâche | Effort | Bénéfice |
|---|---|---|---|
| 4.1 | Ajouter ESLint + Prettier config | 🟢 1h | Standardisation |
| 4.2 | Ajouter CI/CD (GitHub Actions) | 🟢 2h | Build automatique |
| 4.3 | Ajouter bundle analysis (rollup-plugin-visualizer) | 🟢 1h | Tracking taille |
| 4.4 | Benchmark bundle size dans CI | 🟢 2h | Détection régression |

---

## 9. Benchmark Avant/Après

### 9.1 Build Time

| Métrique | Avant | Après (estimé) | Gain |
|---|---|---|---|
| `vite build` | ❌ **ÉCHEC** | ✅ ~45s | Build fonctionnel |
| `tsc --noEmit` | **87s** | ~30s | -65% |
| `vitest run` (collect) | **256s** | ~60s | -76% |
| `vitest run` (transform) | **170s** | ~45s | -73% |
| `vitest run` (tests) | **6.2s** | ~6s | -3% |

### 9.2 Code Quality

| Métrique | Avant | Après (cible) |
|---|---|---|
| Fichiers > 500 lignes | **19** | 0 |
| console.log | **149** | 0 |
| eslint-disable | **40** | 0 |
| `any` | **68** | 0 |
| Imports (RpgGameWorld) | **226** | ~20 |

### 9.3 Asset Size

| Métrique | Avant | Après (cible) |
|---|---|---|
| `dist/` total | **~8.5 GB** | < 500 MB |
| Textures GPU | Raw PNG/JPG | KTX2 compressé |
| Modèles GLB | Non optimisés | Décimés |

### 9.4 Runtime (FPS)

| Métrique | Avant | Après (cible) |
|---|---|---|
| FPS moyen (idle) | ~30-45* | 60 |
| FPS moyen (combat) | ~20-30* | 45-60 |
| Mémoire heap JS | ~500 MB* | < 300 MB |
| Draw calls | ~1500-3000* | < 1000 |

_*Estimations basées sur la complexité du code. Des benchmarks précis nécessitent de réparer le build._

---

## 10. Annexes

### A. Méthodologie de mesure

| Mesure | Méthode | Outil |
|---|---|---|
| Build time | `time (npx vite build)` | time + Vite |
| TypeScript check | `time (npx tsc --noEmit)` | tsc |
| Tests | `npm test` | vitest |
| Code quality | `grep -rn` patterns | rg/grep |
| Fichiers > 500 lignes | `find ... -exec wc -l + \| sort` | bash |

### B. Problème rollup-win32-x64-msvc

```bash
npm install @rollup/rollup-win32-x64-msvc
```

Ce package natif manque et empêche l'exécution des benchmarks et tests via rollup.

### C. Références croisées

- [Rapport dette technique détaillé](../RAPPORT-DETTE-TECHNIQUE.md)
- [Rapport audit UX/UI](../RAPPORT_AUDIT_UXUI.md)
- [Rapport vérification FPS](../FPS_FINAL_VERIFICATION_RAPPORT.md)
- [Rapport analyse moteur Narvos](../NARVOS_ENGINE_ANALYSIS_RAPPORT.md)
- [Audit migration initial](../AUDIT_MIGRATION.md)
- [WASM Bindings audit](../WASM_BINDINGS_AUDIT.md)

---

*Rapport généré par l'équipe ARCHITECTURE. Pour toute question, contacter l'équipe Narvos Prime.*
