# RAPPORT — Outils Éditeur UE → Équivalents Narvos

**Équipe :** 6/20 — Outils Éditeur & Plugins Développeur  
**Projet :** Narvos Prime WebPortal (React 19 + R3F 9 + Three.js 0.181 + TS 5.8)  
**Sources UE :** UE 5.8 (E:\UE_5.8\Engine\) + UE 5.7 (D:\Epic Games\UE_5.7\Engine\)  
**Date :** 2026-07-30  
**Auteur :** Agent 6/20

---

## Table des matières

1. [Blutility (Editor Utility Blueprints)](#1-blutility-editor-utility-blueprints)
2. [Data Validation](#2-data-validation)
3. [Asset Audit](#3-asset-audit)
4. [Blueprint Debugger](#4-blueprint-debugger)
5. [Unreal Insights / Profiler](#5-unreal-insights--profiler)
6. [Sequencer / Movie Render Queue](#6-sequencer--movie-render-queue)
7. [Content Browser](#7-content-browser)
8. [Synthèse & Plan d'action](#8-synthèse--plan-daction)

---

## 1. Blutility (Editor Utility Blueprints)

### Fonctionnement (UE)

Blutility est un **module noyau** d'Unreal Engine (`Engine/Source/Editor/Blutility/`) qui permet de créer des outils d'éditeur en Blueprint (visuel, sans C++). Il expose plusieurs classes de base :

| Classe | Rôle |
|--------|------|
| `UEditorUtilityBlueprint` | Asset Blueprint de base pour outil éditeur |
| `UAssetActionUtility` | Menu contextuel (clic droit) sur des assets dans le Content Browser |
| `UActorActionUtility` | Menu contextuel sur des acteurs dans le Level Viewport |
| `UEditorUtilityWidget` | Widget UI customisable (panneau éditeur avec UMG) |
| `UEditorUtilityWidgetBlueprint` | Blueprint pour créer des widgets UI éditeur |
| `UEditorUtilityTask` | Tâche asynchrone avec barre de progression |
| `AEditorUtilityCamera` | Caméra éditeur (capture, tooling) |
| `UEditorUtilityObject` | Objet utilitaire générique |
| `GlobalEditorUtilityBase` | (déprécié) Itération sur sélection, fonctions globales |

**Fonctionnalités clés :**
- Scripts exécutables depuis le menu Tools → Execute
- Raccourcis claviers personnalisables
- Intégration Content Browser (menus contextuels, filtres)
- Intégration Level Editor (menus contextuels sur acteurs)
- Tâches batch asynchrones avec notification UI
- Panneaux d'éditeur dockables (Editor Utility Widget)

### Intérêt pour Narvos

Le projet Narvos WebPortal a déjà une **infrastructure d'éditeur in-game naissante** (AdminPanel, ForgeEditor, NpcAdminPanel, PropAdminPanel) mais il manque un **système unifié d'outils scriptables** que les développeurs puissent étendre sans modifier le code noyau.

### Équivalent Narvos Proposé

**« Narvos Tool System » (NTS)** — un système d'outils éditeur scriptable en TypeScript/React :

```
src/rpg/runtime/editor/
├── tool-registry.ts          ← Enregistrement/découverte des outils
├── tool-context.ts           ← Contexte d'exécution (sélection, monde)
├── ToolHost.tsx              ← Hôte des panneaux d'outils (dockable)
├── tools/                    ← Outils installables
│   ├── asset-batch/          ← Actions batch sur assets
│   ├── scene-actions/        ← Actions sur objets de scène
│   └── custom/               ← Outils utilisateur
└── Toolbar.tsx               ← Barre d'outils principale
```

**Principes :**
1. **Enregistrement déclaratif** : chaque outil s'enregistre via `registerTool({ id, label, icon, component, menuHooks })`
2. **Contextes d'exécution** : sélection d'asset, sélection d'objet 3D, état du monde
3. **Tâches asynchrones** : système de progression uniforme (déjà partiellement présent via `preloadNpcAssets`)
4. **Panneaux dockables** : fenêtres flottantes redimensionnables (cf. Pattern déjà existant dans les AdminPanels)
5. **Scriptable par l'utilisateur** : hooks TypeScript que les développeurs peuvent écrire sans modifier le core

**Ce qui existe déjà dans Narvos et peut être réutilisé :**
- Les stores Zustand (`npcAdminStore`, `propPlacementStore`, `forgeSceneStore`) servent déjà de base
- Les panneaux existants (`NpcAdminPanel`, `PropAdminPanel`, `AdminPanel`) deviendraient des `Tool` enregistrés
- Le mode admin (`isAdmin()`) sert de contrôle d'accès

---

## 2. Data Validation

### Fonctionnement (UE)

Plugin `Editor/DataValidation` (activé par défaut). Système de validation d'assets avec :

- **`UEditorValidatorSubsystem`** — Ordonnanceur central qui :
  - Parcourt les assets (par filtre, par changelist, ou tout le projet)
  - Exécute tous les validateurs enregistrés sur chaque asset
  - Collecte les résultats (errors/warnings)
  
- **`UEditorValidatorBase`** — Classe de base pour les validateurs :
  - `EditorValidator_Localization` — validation des locales
  - `EditorValidator_Material` — validation des matériaux
  - `EditorValidator_ActionUtility` — validation via Blutility
  - `UPackageFileValidator` — validation des fichiers package
  - `UWorldPartitionChangelistValidator` — validation World Partition

- **`UDataValidationCommandlet`** — Validation en CLI (CI/CD)
- **`UDataValidationFixers`** — Infrastructure d'auto-correction
- Résultats détaillés par asset : `FValidateAssetsDetails` avec messages tokenizés, statistiques par validateur

### Intérêt pour Narvos

Le projet a déjà :
- `ASSET_AUDIT.md` — audit manuel des assets 3D
- `assetQuality.ts` — gestion des niveaux de qualité
- `assets-manifest.json` — manifeste d'assets

Mais il manque un **système automatisé de validation** qui vérifie l'intégrité des assets au chargement et au développement.

### Équivalent Narvos Proposé

**« Narvos Asset Validator » (NAV)** — système de validation d'assets web :

```
src/rpg/runtime/editor/validation/
├── validation-registry.ts    ← Enregistrement des validateurs
├── validator-base.ts         ← Classe de base / interface
├── validators/               ← Validateurs intégrés
│   ├── asset-path.ts         ← Chemins d'assets valides
│   ├── manifest-entry.ts     ← Cohérence manifeste/fichier
│   ├── glb-integrity.ts      ← Intégrité GLB (chargement)
│   ├── texture-exists.ts     ← Textures référencées existent
│   └── animation-clips.ts    ← Clips d'animations valides
├── ValidationRunner.ts       ← Exécuteur (UI + rapport)
└── ValidationCLI.ts          ← Exécution en ligne de commande
```

**Architecture :**
1. **Interface Validateur** : `{ name, category, validate(asset: AssetEntry): Promise<ValidationResult[]> }`
2. **Exécution** : en parallèle avec barre de progression (déjà testé via `preloadNpcAssets`)
3. **Rapports** : Markdown formaté comme `ASSET_AUDIT.md`
4. **CLI** : exécutable via `npm run validate` (check avant build)
5. **Intégration éditeur** : panneau admin "Validation" qui liste les problèmes

**Cas d'usage immédiats pour Narvos :**
- Vérifier que tous les GLB référencés dans `asset-catalog.json` existent sur disque
- Valider que les chemins d'animations dans `npcCatalog` pointent vers des fichiers valides
- Détecter les textures manquantes dans les matériaux PBR
- Vérifier la cohérence des manifests après ajout d'un asset pack

---

## 3. Asset Audit

### Fonctionnement (UE)

Contrairement à Data Validation (validation *fonctionnelle*), l'Asset Audit dans UE est un **ensemble d'outils de visualisation et d'analyse** :

- **Reference Viewer** — Graphe des dépendances entre assets
- **Size Map** — Carte thermique de la taille mémoire des assets
- **Asset Audit window** — Filtrage et inspection par propriétés (taille, type, dépendances)
- **Cooker auditing** — Vérification de ce qui sera cuit
- **Asset Manager** — Règles de gestion des assets (Primary Asset Ids, bundles)
- **Redirectors** — Détection des redirecteurs orphelins

Ces outils sont répartis dans `AssetManagerEditor`, `AssetRegistry` et le `ContentBrowser`.

### Intérêt pour Narvos

Le projet web a des défis uniques de gestion d'assets :
- GLB 3D models (certains jusqu'à 3GB source)
- Textures PBR multiples
- Manifests JSON
- Animation packs

### Équivalent Narvos Proposé

**« Narvos Asset Inspector » (NAI)** — hub d'audit et d'inspection :

```
src/rpg/runtime/editor/asset-inspector/
├── AssetInspectorPanel.tsx     ← Panneau principal
├── AssetDependencyGraph.tsx    ← Graphe des dépendances (R3F/SVG)
├── AssetSizeMap.tsx            ← Carte des tailles mémoire
├── AssetPropertyFilter.tsx     ← Filtrage avancé (type, taille, statut)
├── AssetCookPreview.tsx        ← Simulation du bundle de build
└── AssetRedirectScanner.ts     ← Détection des chemins cassés
```

**Fonctionnalités :**
1. **Scan complet** : liste tous les assets du projet avec métadonnées
2. **Graphe de dépendances** : outil visuel pour voir quels assets référencent quoi (utile pour les GLB et leurs textures)
3. **Size Map** : visualise les assets les plus lourds, priorisation pour LOD
4. **Filtres** : par type (mesh, texture, animation, audio), par taille, par état de chargement
5. **Export** : génération de rapports d'audit structurés

**Ce qui existe déjà :**
- `AssetScanner` dans `forge/assetScanner.ts` — scanne les modèles
- `assetManifest.ts` — catégorisation des assets
- `assetQuality.ts` — niveaux de qualité

**Intégration avec l'existant :**
- Le ForgeEditor a déjà un `AssetBrowser` avec catégories — peut être étendu
- L'onglet "Admin" du jeu peut héberger le panneau AssetInspector

---

## 4. Blueprint Debugger

### Fonctionnement (UE)

Composant intégré à l'éditeur de Blueprint (module `Kismet`) :

- **`FBlueprintDebugger`** — Point d'entrée, gère l'état global du débogueur
- **`SKismetDebuggingView`** — Widget principal : arbre des objets en cours de débogage
- **`SKismetDebugTreeView`** — Inspection des variables en runtime
- **`SBlueprintEditorSelectedDebugObjectWidget`** — Sélection de l'objet à déboguer

**Fonctionnalités :**
1. Breakpoints dans les Blueprint nodes
2. Step over / step into / step out
3. Watch de variables en temps réel (PIE)
4. Call stack inspection
5. Pin value display pendant l'exécution
6. Debug d'instances multiples (plusieurs acteurs)

### Intérêt pour Narvos

Narvos est un projet **TypeScript/React/Three.js**. Le débogage se fait via :
- Les DevTools navigateur (breakpoints, console)
- Les outils React DevTools
- Les Three.js Inspector

Cependant, il manque des **outils de débogage "in-game"** spécifiques au jeu (visualisation des états, inspection des systèmes).

### Équivalent Narvos Proposé

**« Narvos Debug Console » (NDC)** — débogueur in-game intégré :

```
src/rpg/runtime/debug/
├── DebugConsole.tsx           ← Console de débogage (touche ~)
├── VariableWatcher.tsx        ← Watch de variables runtime
├── StateInspector.tsx         ← Inspection des stores Zustand
├── PerformanceBreakdown.tsx   ← Breakdown frame par frame
├── EntityInspector.tsx        ← Click + inspect objet 3D
└── LogViewer.tsx              ← Filtre et niveau de logs
```

**Fonctionnalités :**
1. **Console** : exécution de commandes TypeScript en temps réel
2. **State Inspector** : inspection live des stores Zustand (game state, player state, combat state)
3. **Entity Inspector** : clic sur un objet 3D en jeu → affiche ses props, animations, collisions
4. **Variable Watcher** : ajoute des variables à surveiller (FPS, position, état d'animation)
5. **Log Viewer** : niveau de log configurable (debug/info/warn/error), filtrage par système
6. **Breakdown** : temps par système (render, animation, physique, réseau)

**Ce qui existe déjà :**
- `PerfOverlay.tsx` — FPS/1% low/draw calls
- `CollisionDebugOverlay.tsx` — visualisation capsule
- `StressBots.tsx` / `StressTestPanel.tsx` — test de charge
- `debugCollisions.ts` — toggle collision debug

**Évolution :** Ces composants disparates devraient être unifiés sous un même panneau de débogage (touche F12 ou \`).

---

## 5. Unreal Insights / Profiler

### Fonctionnement (UE)

Unreal Insights est un **suite de profilage complète** séparée en plusieurs couches :

**Programme autonome** (`Engine/Programs/UnrealInsights`) :
- Se connecte à une trace UE en temps réel ou lit un fichier `.utrace`
- Affichage timeline multi-track

**Modules d'analyse** (`Engine/Source/Developer/TraceInsights`) :
- **Timing Insights** — timeline CPU/GPU, threads, frames
- **Memory Insights** — allocation, fragmentation, LLM tags
- **Loading Insights** — profiling du chargement de niveau
- **Context Switches** — analyse des changements de contexte
- **Cook Insights** — profiling du cooking
- **Net Insights** — analyse réseau

**Plugins spécialisés** : `AudioInsights`, `ChaosInsights`, `MassInsights`, `NiagaraInsights`, `IoStoreInsights`

**Fonctionnalités clés :**
- Timeline frame précise (stats par frame)
- Flame graph des appels CPU
- Allocation mémoire par tag
- Profilage I/O
- Trames réseau

### Intérêt pour Narvos

Le projet a un `PerfOverlay` basique (FPS + draw calls) mais manque d'outils de profilage approfondis pour diagnostiquer :
- Les lags de chargement de maps (~1.3GB Forge)
- Les goulots d'étranglement render/CPU
- La mémoire WebGL / texture
- Les frametime spikes

### Équivalent Narvos Proposé

**« Narvos Profiler Suite » (NPS)** — suite de profilage multi-couche :

```
src/rpg/runtime/profiler/
├── ProfilerHost.tsx           ← Hôte unifié Ctrl+Shift+P
├── profiler-store.ts          ← Store des métriques temps réel
├── panes/
│   ├── FrameTimeline.tsx      ← Timeline frame + breakdown
│   ├── MemoryGraph.tsx        ← Mémoire (JS heap, GL textures, GLB)
│   ├── DrawCallAnalyzer.tsx   ← Draw calls détaillés par objet
│   ├── LoadingProfiler.tsx    ← Profilage chargement map/chunk
│   ├── WebGLProfiler.tsx      ← Informations WebGL (limits, textures)
│   └── NetworkProfiler.tsx    ← Latence et bande passante
├── exporters/
│   └── trace-exporter.ts      ← Capture de trace JSON
└── hooks/
    ├── useFrameProfiler.ts    ← Hook perf par frame
    ├── useMemoryProfiler.ts   ← Hook mémoire (performance.memory)
    └── useLoadingProfiler.ts  ← Hook chargement
```

**Fonctionnalités :**
1. **Frame Breakdown** : par catégorie (render, animation, update, physics, particles) — similaire au Stat Unit de l'UE
2. **Memory Profiler** : heap JS, textures WebGL, GLB chargés, géométries Three.js
3. **Loading Profiler** : chronologie du chargement de map avec détail par chunk (hérité du problème Forge 1.3GB)
4. **WebGL Info** : nombre de textures, programmes shader, limites GPU
5. **Draw Call Inspector** : breakdown par objet (meshes, matériaux, shadow maps)
6. **Export** : capture des traces vers JSON pour analyse comparative

**Ce qui existe déjà :**
- `PerfProbe` / `PerfHud` dans `PerfOverlay.tsx` — mesure FPS + draw calls
- Base R3F : `useFrame` + `gl.info.render.calls` déjà utilisés

**Priorité :** Loading Profiler est le plus critique (problème connu du timeout Forge).

---

## 6. Sequencer / Movie Render Queue

### Fonctionnement (UE)

Sequencer est l'**éditeur non-linéaire** d'Unreal Engine, organisé en plusieurs couches :

**Core** (`Engine/Source/Editor/Sequencer` + `SequencerCore`) :
- Timeline multi-pistes
- Keyframes sur n'importe quelle propriété
- Pistes : transform, animation, audio, event, camera, material, etc.
- Sous-séquences, blending, sections

**MovieScene** (`Engine/Source/Runtime/MovieScene`) :
- Runtime data model : sections, tracks, évaluation
- Système d'évaluation template-based
- Sérialisation compacte

**Plugins associés :**
- `LevelSequenceEditor` — séquences dans le niveau
- `SequencerScripting` — API Python/Blueprint
- `SequencerAnimTools` — outils d'animation ControlRig
- `SequenceRecorder` — capture d'animations in-game
- `MovieRenderPipeline` — rendu cinématique haute qualité
- `SequenceValidator` — validation des séquences

**Fonctionnalités :**
- Animation d'acteurs, caméras, lumières, propriétés
- Cinématiques in-engine
- Montage sonore multipistes
- Export vidéo (Movie Render Queue)
- Animation procédurale via ControlRig

### Intérêt pour Narvos

Narvos utilise déjà un **animation state machine** (`AnimationStateMachine.tsx`) mais n'a pas :
- D'éditeur de timeline pour les cinématiques/scènes scriptées
- D'outil de capture/playback d'actions joueur
- De système de séquences pour les quêtes/événements

### Équivalent Narvos Proposé

**« Narvos Sequence Editor » (NSE)** — système de séquences et cinématiques :

```
src/rpg/runtime/editor/sequencer/
├── SequenceTimeline.tsx       ← Timeline éditeur
├── SequencePlayer.tsx         ← Lecteur de séquences (runtime)
├── SequenceStore.ts           ← State management des séquences
├── tracks/
│   ├── TransformTrack.tsx     ← Piste position/rotation/scale
│   ├── AnimationTrack.tsx     ← Piste d'animation (blend)
│   ├── CameraTrack.tsx        ← Piste caméra (FOV, position)
│   ├── EventTrack.tsx         ← Piste d'événements (dialogue, quête)
│   ├── AudioTrack.tsx         ← Piste audio
│   └── PropertyTrack.tsx      ← Piste propriété générique
├── SequenceRecorder.tsx       ← Capture d'actions joueur
├── SequenceValidator.tsx      ← Validation des séquences
└── exports/
    └── CameraPathExporter.ts  ← Export caméra vers animation
```

**Architecture :**
1. **Timeline** : barre de temps avec pistes, keyframes (ou plutôt keyframes adaptés au web : interpolation)
2. **Runtime Player** : `SequencePlayer.tsx` qui évalue les pistes et applique les transformations
3. **Pistes extensibles** : enregistrement de nouveaux types de pistes
4. **Format de données** : JSON sérialisable, exportable en animation GLB

**Cas d'usage Narvos :**
- Cinématiques de quêtes (caméra qui se déplace + dialogue)
- Animations scriptées (PNJ qui effectue une action séquentielle)
- "Replay" de séquence pour les tutoriels
- Démo/trailer généré in-engine
- **Urgent** : animation de caméra pour les donjons et boss fights

**Concurrence avec l'existant :**
- Le système d'animation actuel (`AnimationStateMachine.tsx`) est pour les animations de personnage en temps réel
- Le Sequence Editor serait pour les séquences scriptées (cutscenes, événements)
- Les deux peuvent coexister : l'ASM gère l'état, le SE gère la chronologie

---

## 7. Content Browser

### Fonctionnement (UE)

Le Content Browser d'UE est à la fois un module noyau (`Engine/Source/Editor/ContentBrowser`) et des plugins de data source :

**Structure en data sources :**
- **`ContentBrowserAssetDataSource`** — assets du projet (.uasset)
- **`ContentBrowserClassDataSource`** — classes C++ et Blueprint
- **`ContentBrowserFileDataSource`** — fichiers externes (textures, modèles)
- **`ContentBrowserAliasDataSource`** — alias virtuel pour organisation

**Fonctionnalités :**
- Arborescence de dossiers + vue liste/grille/vignettes
- Recherche textuelle avec syntaxe avancée
- Filtres par type, par tag, par collection
- Menus contextuels (import, rename, delete, asset actions)
- Drag & drop dans le niveau/éditeur
- Collections et favoris
- Colonnes personnalisables (size, type, date, LOD, etc.)
- Source control integration
- Migration d'assets entre projets

### Intérêt pour Narvos

Le projet a déjà plusieurs navigateurs d'assets :
- `AssetBrowser.tsx` dans Forge (modèles 3D)
- `TextureBrowser.tsx` dans Forge (textures)
- `assetManifest.ts` / `asset-catalog.json` (index global)

Mais ces navigateurs sont **déconnectés** les uns des autres et manquent d'un **système unifié**.

### Équivalent Narvos Proposé

**« Narvos Content Browser » (NCB)** — navigateur d'assets unifié :

```
src/rpg/runtime/editor/content-browser/
├── ContentBrowser.tsx            ← Panneau principal
├── ContentBrowserToolbar.tsx     ← Barre de recherche/filtres
├── TreeView.tsx                  ← Arborescence par catégories
├── GridView.tsx                  ← Grille de vignettes
├── DetailPanel.tsx               ← Panneau détail de l'asset
├── PreviewPane.tsx               ← Aperçu 3D (réutilise PreviewModel)
├── AssetThumbnail.tsx            ← Vignette générique mémoire-cache
├── data-sources/                 ← Sources de données
│   ├── model-source.ts           ← GLB/glTF
│   ├── texture-source.ts         ← Textures (PNG, JPG, KTX2)
│   ├── animation-source.ts       ← Animation packs
│   ├── audio-source.ts           ← Audio (MP3, OGG, WAV)
│   ├── manifest-source.ts        ← Assets manifestés
│   └── script-source.ts          ← Scripts/JSON/TS
├── content-filters.ts            ← Système de filtres unifié
└── ContentBrowserContextMenu.tsx ← Menu contextuel extensible
```

**Architecture (pattern Data Source d'UE) :**
1. **Interface `ContentDataSource`** : `{ id, name, getItems(filter), getThumbnail(id), getPreview(id) }`
2. **Implémentations** : chaque type d'asset implémente l'interface
3. **Vues** : TreeView + GridView + DetailPanel
4. **Context Menu** : extensible via enregistrement de actions par type
5. **Search** : index Fuse.js pour la recherche full-text

**Ce qui existe déjà et peut être réutilisé :**
- `AssetBrowser.tsx` Forge → deviendrait la sous-vue `model-source`
- `TextureBrowser.tsx` Forge → deviendrait `texture-source`
- `assetScanner.ts` → alimenterait les sources
- `PreviewModel` (AssetBrowser.tsx) → `PreviewPane`
- Le pattern de vignette sans WebGL (icône + nom) est déjà implémenté

**Intégration :**
- Dans ForgeEditor (déjà un asset browser)
- Dans AdminPanel (pour administrer les assets)
- En overlay in-game (débogueur/développeur)
- **Portail web standalone** (page `/tools/assets`) pour les non-développeurs

---

## 8. Synthèse & Plan d'action

### Récapitulatif

| Outil UE | Équivalent Narvos | Priorité | Complexité | Dépendances |
|----------|-------------------|----------|------------|-------------|
| **Blutility** | Narvos Tool System (NTS) | 🟡 Moyenne | Haute | Architecture existante des stores |
| **Data Validation** | Narvos Asset Validator (NAV) | 🟢 Haute | Moyenne | `assetScanner`, `assetManifest` |
| **Asset Audit** | Narvos Asset Inspector (NAI) | 🟡 Moyenne | Haute | NAV, `assetManifest` |
| **Blueprint Debugger** | Narvos Debug Console (NDC) | 🟢 Haute | Moyenne | Stores Zustand existants |
| **Unreal Insights** | Narvos Profiler Suite (NPS) | 🟡 Moyenne | Haute | `PerfOverlay` existant |
| **Sequencer** | Narvos Sequence Editor (NSE) | 🔵 Basse | Très haute | Animation system existant |
| **Content Browser** | Narvos Content Browser (NCB) | 🟢 Haute | Haute | Forge AssetBrowser existant |

### Calendrier recommandé

**Phase 1 — Fondations (semaine 1-2) :**
1. ✅ **NAV** (Asset Validator) — le plus rapide à implémenter car il s'appuie sur `assetScanner` existant
2. ✅ **NDC** (Debug Console) — fusionner les outils de debug existants sous une UI unifiée
3. ✅ **NCB** (Content Browser) — unifier les navigateurs Forge existants

**Phase 2 — Moyen terme (semaine 3-4) :**
4. ✅ **NTS** (Tool System) — architecture d'enregistrement, faire migrer les panneaux admin existants
5. ✅ **NAI** (Asset Inspector) — dépend de NAV + NCB

**Phase 3 — Long terme (semaine 5+) :**
6. ✅ **NPS** (Profiler Suite) — Loading Profiler en priorité (problème Forge connu)
7. ✅ **NSE** (Sequence Editor) — le plus complexe, dépend du système d'animation

### Quick Wins immédiats

1. **Unifier les panneaux debug** : `PerfOverlay`, `CollisionDebugOverlay`, `StressTestPanel` sous une touche `~` commune
2. **Étendre la validation** : ajouter des validateurs simples pour les manifests
3. **Centraliser le Content Browser** : faire hériter `TextureBrowser` et `AssetBrowser` d'une base commune
4. **Ajouter le Loading Profiler** au panneau PerfOverlay existant (le problème Forge est prioritaire)

### Risques identifiés

1. **Performance WebGL** : les outils d'inspection 3D ne doivent pas impacter les performances de jeu (cf. anti-crash déjà implémenté dans AssetBrowser : un seul Canvas)
2. **Bundle size** : ces outils ne doivent pas être inclus dans le build de production (déjà géré par le flag admin + `import.meta.env.DEV`)
3. **Mémoire** : l'inspection d'assets lourds (GLB 3D) doit être lazy (chargement au clic, pas au scan)

---

*Rapport généré par l'Agent 6/20 — Équipe Outils Éditeur UE*
