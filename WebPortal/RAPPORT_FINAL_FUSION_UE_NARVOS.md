# RAPPORT FINAL DE FUSION — AUDIT UE → NARVOS ENGINE

**Équipe 15/20 — FUSION**  
**Date :** 30 juillet 2026  
**Projet :** Narvos Prime — WebPortal + Narvos Engine (WASM C++)  
**Sources consolidées :** 19+ rapports d'audit des équipes 1-14 et 16-20  

---

## 1. CARTOGRAPHIE DES PLUGINS UE ANALYSÉS

| # | Plugin/Système UE5 | Niveau d'analyse | Rapport source | État dans Narvos |
|---|---|---|---|---|
| 1 | **Actor/Component Architecture** (AActor, UActorComponent) | Complet | Équipe UE-Part1 → skill `narvos-ue-adaptation-part1` | ✅ Mappé → ECS + React composants |
| 2 | **Gameplay Framework** (GameMode, State, PC, Pawn, Character) | Complet | Équipe UE-Part1 | ✅ Mappé → stores Zustand + CharacterController |
| 3 | **Gameplay Ability System (GAS)** (Abilities, Effects, Attributes) | Complet | Équipe UE-Part1 | ⚠️ Partiel — statusEffects.ts existant, pas d'AbilityStore |
| 4 | **Enhanced Input** (InputActions, MappingContext, Modifiers) | Complet | Équipe UE-Part1 | ⚠️ Partiel — InputManager.ts existe, pas de modifier pipeline |
| 5 | **SaveGame/Serialization** (USaveGame, Versioning) | Complet | Équipe UE-Part1 | ❌ Absent — localStorage dispersé, pas de SaveManager |
| 6 | **Behavior Tree / Blackboard / EQS** | Complet | Équipe UE-Part2 + RAPPORT_IA_WASM | ❌ FSM uniquement — pas de BT, pas de Blackboard |
| 7 | **NavMesh / Pathfinding** (Recast/Detour) | Complet | Équipe UE-Part2 | ⚠️ Grille A* custom — pas de navmesh polygonal |
| 8 | **State Trees** (UE5) | Complet | Équipe UE-Part2 | ❌ Absent — FSM plate (4-8 états) |
| 9 | **Mass Entity ECS** (Archetypes, Chunks) | Complet | Équipe UE-Part2 | ⚠️ Sparse Set ECS — pas d'archetypes SoA |
| 10 | **Animation System** (AnimBP, BlendSpaces, Montages, IK) | Complet | Équipe UE-Part2 | ⚠️ Partiel — Three.js Mixer + WASM AnimGraph déconnectés |
| 11 | **Networking/Replication** (Property Replication, RPC, Iris) | Complet | Équipe UE-Part2 | ❌ Absent — jeu solo uniquement |
| 12 | **Chaos Physics** (Rigid Bodies, Collision Channels) | Complet | Équipe UE-Part3 | ⚠️ BVH maison + cannon-es non intégré |
| 13 | **Materials/Rendering** (MID, MPC, PostProcess) | Complet | Équipe UE-Part3 | ⚠️ Auto-material triplanaire, pas de post-process |
| 14 | **World Partition / Streaming** (Data Layers, HLOD) | Complet | Équipe UE-Part3 | ⚠️ ChunkStreaming WASM, pas de Data Layers |
| 15 | **MetaSounds / Audio** (Submixes, Concurrency, Attenuation) | Complet | Équipe UE-Part3 + AUDIT_AUDIO | ❌ Pas de NarvosAudioManager structuré |
| 16 | **UMG / CommonUI / Slate** (Widgets, Navigation) | Complet | Équipe UE-Part3 + RAPPORT_AUDIT_UXUI | ❌ Pas de widget stack, pas de gamepad nav |
| 17 | **Electron Security** (Sandbox, CSP, IPC, preload) | Complet | audit-electron.md + SECURITY_AUDIT.md | ⚠️ 26 canaux IPC, 4 risques critiques |
| 18 | **WebGL/WebGPU Rendering** (Compute Shaders) | Complet | RENDERING_ANALYSIS_RAPPORT.md | ⚠️ WebGL, WebGPU compute non implémenté |
| 19 | **WASM C++ Core** (ECS, AI, Navigation, Animation, Streaming, Physics, Bridge) | Complet | RAPPORT_AUDIT_WASM_CPP_PART1 + AUDIT_WASM_STREAMING_PHYSICS | ⚠️ 45 fichiers, ~95% complet, 1 bug critique |
| 20 | **Pipeline Assets** (GLB, KTX2, Draco, meshoptimizer) | Complet | VEILLE_TECHNOLOGIQUE_CATALOGUE.md + recherche-ameliorations.md | ✅ gltf-transform présent, meshoptimizer à intégrer |

---

## 2. FONCTIONNALITÉS LES PLUS INTÉRESSANTES POUR NARVOS

### 🔟 Fonctionnalités à fort impact (classées par priorité)

| # | Fonctionnalité UE | Justification Narvos | Effort estimé |
|---|---|---|---|
| **1** | **AnimationGraph WASM** (State Machine + Blend Spaces) | Déjà compilé dans le WASM (`AnimationGraph.h/.cpp`), skeleton présent, 24 fonctions d'API exportées. Il suffit de le **connecter** au pipeline JS. Gain immédiat : animation procédurale, transitions fluides, IK. | 2 jours |
| **2** | **Behavior Tree + Blackboard** (remplacement de la FSM) | IA NPC actuellement divisée en FSM JS (NpcController, 4 états) + FSM WASM (AISystem, 8 états, 2 morts). Unifier en BT + Blackboard donne une AI composable, testable, data-driven. Permet les patterns complexes (patrouille → investigate → combat avec flanquement → retreat). | 3 jours |
| **3** | **NavMesh polygonal (ReCAST-like)** | Grille A* actuelle limitée (8-connexe, pas de multi-hauteur, pas de crowd avoidance). ReCAST en WASM donnerait un pathfinding AAA, tiled, avec détourage et pentes. | 3-4 semaines |
| **4** | **Motion Matching** | AnimationController actuel (26 actions, 250 candidats, crossfade) — fonctionnel mais pas scalable. Motion Matching = animations infinies et réactives basées sur vélocité/trajectoire. | 4-6 semaines |
| **5** | **Gameplay Ability System (GAS)** | 13 sorts, 12 talents, 5 archétypes existants mais pas de système unifié. AbilityStore + EffectDefinition + AttributeSet = système de combat cohérent. | 1 semaine |
| **6** | **Enhanced Input Pipeline** | InputManager actuel fonctionnel mais sans modifiers (deadzone, scalar, smooth, response curve), sans mapping context stack, sans gamepad. | 3 jours |
| **7** | **Post-Processing Pipeline** (Bloom, DOF, SSAO) | Three.js EffectComposer + @react-three/postprocessing disponibles mais pas utilisés. Bloom = essentiel pour le rendu cartoon/Dofus-like. | 1 jour |
| **8** | **Llama.cpp sidecar** (dialogues PNJ LLM) | NPC actuellement muets (FSM uniquement). LLM local (Phi-3-mini / Llama-3.2-1B) pour dialogues dynamiques. transformers.js pour le web, Llama.cpp sidecar pour Electron. | 2-3 semaines |
| **9** | **Gamepad-first Navigation** (CommonUI) | UI conçue souris seulement. GamepadFocusManager + WidgetStack pour navigation manette complète. | 2 jours |
| **10** | **Data Layers + HLOD** | Actuellement chargement binaire (chunk présent/absent). Data Layers permettraient des couches jour/nuit, instance, événements. HLOD = chunks distants simplifiés. | 2-3 semaines |

---

## 3. ÉLÉMENTS ADAPTABLES

### Architecture & Patterns directement adaptables

| Concept UE | Adaptation Narvos | Faisabilité |
|---|---|---|
| **AActor → EntityView React** | Composant React + hook `useEntity(entityId)` + store Zustand | ✅ Immédiate (pattern déjà utilisé partiellement) |
| **UActorComponent → Hook React** | `useHealth()`, `useInventory()`, `useAbility()` | ✅ Immédiate — pattern existant à généraliser |
| **AGameMode → gameModeStore** | Store Zustand définissant les règles du jeu, spawn, phases | ✅ Existe déjà |
| **APlayerController → PlayerRig** | Composant React possédant le pawn, gérant l'input | ✅ Existe déjà |
| **UInputAction → InputAction type** | Typed actions avec triggers (pressed, hold, released) | ✅ Faisable en 2 jours |
| **UMaterialInstanceDynamic → MaterialInstanceStore** | Clonage + paramétrage runtime des matériaux | ✅ Faisable en 1 jour |
| **USoundAttenuation → PannerNode** | Spatialisation 3D via Web Audio API PannerNode | ✅ Faisable en 1 jour |
| **USoundConcurrency → AudioConcurrency** | Limite de voix, stopOldest, retriggerTime | ✅ Faisable en 1 jour |
| **FHitResult → CollisionResult** | Struct avec hit, point, normal, distance, object | ✅ Faisable en 1 jour |
| **UUserWidget → React composant** | Composants React avec CSS Modules (pattern déjà utilisé) | ✅ Immédiate |
| **SaveGame versioning → SaveVersion + migrations** | Migration pipeline avec backup slot | ✅ Faisable en 2 jours |

### Code C++ WASM directement exploitable

| Fichier WASM | État | Actions |
|---|---|---|
| `ECS/Registry.h` | ✅ 100% complet | Conserver — Sparse Set suffisant pour ~200 entités |
| `AISystem.cpp` | ⚠️ 90% — bug PlayerTag shadowing | **Corriger le bug** (ligne 13 définit un PlayerTag local au lieu d'inclure le header), puis envisager migration vers BT |
| `EQS.cpp` | ✅ 100% — grille + scorers + TraceTest | Conserver — enrichir avec générateurs cercle/cône |
| `NavMesh.cpp` | ✅ 100% — A* 8-connexe + string-pulling | Conserver en attendant ReCAST |
| `PathManager.cpp` | ✅ 100% — per-entity paths | Conserver |
| `AnimationGraph.cpp` | ⚠️ 85% — StateMachine stub, IK partiel | **Compléter** — priorité haute |
| `ChunkStreamingManager.cpp` | ✅ 100% | Conserver — ajouter priorité directionnelle |
| `AssetBudgetManager.cpp` | ✅ 100% | Conserver — résoudre dualité avec ChunkStreaming |
| `CollisionSystem.cpp` | ✅ 100% — dual BVH + Dynamic O(n) | Conserver |
| `BVH.cpp` | ✅ 100% — median-split | Envisager SAH si > 5000 colliders |
| `TriggerSystem.cpp` | ⚠️ 100% — O(n×m) | Conserver — risque quadratique à surveiller |
| `Bindings.cpp` | ✅ 100% — 60+ fonctions embind | Conserver — générer les types TS automatiquement |
| `WorldCoordinator.cpp` | ✅ 100% — 6 étapes déterministes | Conserver — ajouter une étape de sync pré-tick |

---

## 4. ÉLÉMENTS À ÉVITER

### Anti-patterns UE à ne pas copier dans Narvos

| Anti-pattern UE | Raison | Alternative Narvos |
|---|---|---|
| **Blueprint / UObject GC** | Narvos n'a pas de garbage collector C++ ni de VM blueprint | Data-driven configs + composants React |
| **Actor component tick partout** | `bCanEverTick` = chaque composant tické → overhead | ECS systems (un tick par système pour toutes les entités) |
| **Property replication automatique** | Overkill pour un jeu solo ; lourd si le multi vient plus tard | State snapshots sérialisés explicitement |
| **UMG Visual Editor / Blueprint** | Impossible à porter en web | React components (composition > héritage visuel) |
| **Blueprint noding / EventGraph** | Graph visual Ultra | Code textuel avec builder pattern |
| **Heavy inheritance (APawn → ACharacter → ...)** | Complexité inutile en JS | Composition via hooks + stores |
| **Level Streaming Volumes manuels** | Nécessite édition de niveaux | ChunkStreaming automatique par distance |
| **AnimBlueprint per-character** | 1 blueprint par personnage = duplication | AnimationGraph partagé avec paramètres |
| **Multiple GameMode subclasses** | Hiérarchie rigide | gameModeStore avec état et règles |

### Bugs et problèmes critiques identifiés qui bloquent l'adaptation

| Bloqueur | Équipe source | Gravité |
|---|---|---|
| **PlayerTag shadowing dans AISystem.cpp** (ligne 13) — l'IA ne trouve jamais le joueur | RAPPORT_IA_WASM, RAPPORT_AUDIT_WASM_CPP_PART1 | 🔴 **Critique** — fix en 1 ligne |
| **Dualité AI WASM/JS** — deux systèmes actifs simultanément, HP non synchronisé | RAPPORT_GLOBAL, skills UE-Part1/2 | 🔴 **Critique** |
| **RpgGameWorld.tsx monolithique** (3984 lignes, 200+ imports) | Tous les rapports | 🔴 **Critique** |
| **NavMeshBaker freeze 16,4s** | RAPPORT_GLOBAL, RENDERING_ANALYSIS | 🔴 **Bloquant** |
| **Map invisible au changement de personnage** | RAPPORT_GLOBAL | 🔴 **Bloquant** |
| **db:mysqlQuery critique (SQL arbitraire au renderer)** | SECURITY_AUDIT, audit-electron | 🔴 **Critique sécurité** |
| **WebSocket mot de passe en clair** | SECURITY_AUDIT | 🔴 **Critique sécurité** |
| **AnimationGraph WASM déconnecté du Three.js Mixer** | UE-Part2, RAPPORT_AUDIT_WASM_CPP_PART1 | 🟠 **Élevé** |

---

## 5. IDÉES INNOVANTES POUR NARVOS

### Concepts uniques qui distingueraient Narvos d'Unreal

| # | Idée | Source | Description |
|---|---|---|---|
| **1** | **AnimationGraph WASM déterministe + réplicable** | UE-Part2 | L'animation s'exécute dans le WASM (C++) → résultat identique serveur/client → pas de désync. Aucun moteur web ne fait ça. |
| **2** | **LLM local pour PNJ** (transformers.js / Llama.cpp) | recherche-ameliorations.md, UE-Part2 | PNJ avec dialogues dynamiques générés par IA locale. Sans serveur, sans abonnement, privé. |
| **3** | **WebGPU compute pour occlusion culling + terrain procédural** | RENDERING_ANALYSIS, recherche-ameliorations.md | Compute shaders >100× plus rapides que le CPU WASM pour l'occlusion. |
| **4** | **SaveManager avec backup automatique + migration pipeline** | UE-Part1 | Pattern de sauvegarde UE avec versioning, migrations, backup slot et chiffrement AES-GCM. |
| **5** | **Auto-material triplanaire unifié** vs terrain bake | RENDERING_ANALYSIS | Économise 474 Mo VRAM vs textures bakes. Un ShaderMaterial unique avec uniforms globaux (MPC-like) remplacerait les matériaux par chunk. |
| **6** | **Collision layers bitmask + FHitResult-like** | UE-Part3 | Collision channels UE en JS : WORLD, PAWN, NPC, PROJECTILE, VISIBILITY, CAMERA, INTERACT — avec matrice de réponses (Ignore/Overlap/Block). |
| **7** | **MaterialParameterCollection (MPC) global** | UE-Part3 | Paramètres globaux (brouillard, intensité solaire, etc.) partagés entre tous les matériaux. |
| **8** | **Widget Stack + Gamepad Focus** (CommonUI-like React) | UE-Part3 + RAPPORT_AUDIT_UXUI | Navigation UI complète : stack de widgets, bouton retour, focus gamepad. |
| **9** | **RVO2/ORCA Crowd Avoidance** dans PathManager WASM | UE-Part2, recherche-ameliorations.md | Évitement d'agents multi-direction — essentiel pour un MMORPG. |
| **10** | **NavMesh dynamique via navSetCell** (destruction de map) | UE-Part2 | Les chunks détruits/modifiés runtime propagent les cellules walkable → WASM. |

---

## 6. INCOMPATIBILITÉS AVEC NOTRE ARCHITECTURE

### Incompatibilités structurelles (ne peuvent pas être adaptées directement)

| Concept UE | Incompatibilité | Raison |
|---|---|---|
| **Serveur dédié / ROLE_Authority** | L'architecture web est mono-process (WASM single-thread + stores JS). Pas de séparation serveur/client. | Toute la logique est "authority". Si multi un jour → refactor en GameMode abstrait. |
| **Actor Replication / DOR** | Pas de réseau, pas de distance-based relevancy. | À concevoir from scratch si multi un jour. |
| **UObject GC / RF_*** | WASM C++ n'a pas de GC. | RAM gérée manuellement (free list, pools). |
| **Blueprint VM / Kismet** | Interpréteur Blueprint impossible en WASM. | Data-driven JSON/YAML pour les comportements. |
| **AnimBlueprint visual editor** | Graph visuel complexe à porter en web. | AnimationGraph builder en code (JS → WASM). |
| **Chaos Destruction (Fracturing)** | Geometry collections et fracturing temps réel trop lourds pour WebGL. | Destruction scriptée (swap chunk intact ↔ chunk cassé). |
| **Lumen (GI temps réel)** | Pas de compute shaders WebGL. | Lighting statique baked + env map. WebGPU compute dans le futur. |
| **Nanite Virtual Geometry** | Nécessite un driver GPU spécifique et du mesh shading. | HLOD + meshoptimizer + LOD progressif. |
| **Iris (UE5.4+ networking)** | Framework réseau complet — pas applicable sans serveur. | Architecture réseau à concevoir from scratch. |
| **World Partition / OFPA** | Découpage automatique UE5. | Découpage manuel via puzzle-chunks.mjs. |

### Incompatibilités fonctionnelles (contournables avec effort)

| Concept UE | Problème | Solution Narvos |
|---|---|---|
| **AnimMontage** | Sequence d'animations avec sections/slots/notifies | One-shots + overlay upper-body existants. Ajouter queue de montage avec priorité. |
| **Root Motion** | Position driven par l'animation | Actuellement la position est pilotée par l'IA. Root motion = feature additionnelle. |
| **Notify State (begin/tick/end)** | Notifications ponctuelles seulement | `animEvents.ts` à étendre avec durée. |
| **Aim Offset** | Visée indépendante du mouvement | Rotation du torse via bone mask + blend. |
| **IK Rig / IK Retargeting** | Solveur IK sophistiqué | `mixamoRetarget.ts` (58 paires) fait le retargeting. IK two-bone partiel. |
| **Sound Mix Modifiers (push/pop)** | Contexte audio (combat, stealth, underwater) | `pushSoundMix()` / `popSoundMix()` à implémenter dans NarvosAudioManager. |
| **Widget Component 3D** | UI projetée dans le monde | `<Html>` + R3F `billboard` — solution fonctionnelle, pas équivalente. |
| **HLOD (Hierarchical LOD)** | Fusion de chunks distants | Algorithme de clustering de chunks à implémenter. |

---

## 7. IMPACT SUR LE PIPELINE 3D

### État actuel du pipeline

```
Blender (.blend)
  → Export GLB (glTF 2.0 Exporter intégré)
  → puzzle-chunks.mjs (découpage map en chunks)
  → KTX2/Basis compression (assets-to-ktx2.mjs)
  → @gltf-transform (optimisations basiques)
  → Three.js GLTFLoader (runtime)
```

### Améliorations recommandées (par priorité)

| # | Action | Impact | Effort | Priorité |
|---|---|---|---|---|
| **P1** | **Intégrer meshoptimizer** dans le pipeline (vertex quantization, simplification, LOD auto) | -60-80% mémoire GPU | 1-2 sem | 🔴 |
| **P2** | **Blender addon export GLB optimisé** (naming convention, decimate, texture size) | Pipeline fiable, reproductible | 1-2 sem | 🟠 |
| **P3** | **Génération automatique de LOD** via @gltf-transform/functions (decimate 50%→25%→12.5%) | LOD progressif natif | 1 sem | 🟠 |
| **P4** | **Rééquilibrer les chunks Forge** (split chunk_06 100 Mo, merge chunk_07 25 Mo → cible 40-50 Mo) | Chargement uniforme | 4j | 🟠 |
| **P5** | **Régénérer chunk-metadata.json Orbital SANS coque enveloppante** | Culling WASM correct | 1j | 🔴 |
| **P6** | **Hash automatique du manifest** au lieu de version manuelle (CACHE_VERSION=8) | Pas de purge manuelle oubliée | 2j | 🟠 |
| **P7** | **Compression ArrayBuffer avec CompressionStream API** avant stockage IDB | Cache disque plus efficace | 3j | 🟢 |
| **P8** | **Passer de WebGL à WebGPU** (quand Three.js support stable) | Compute shaders, occlusion culling GPU | 1-2 mois | 🟢 |

---

## 8. LISTE PRIORISÉE DES FEATURES À DÉVELOPPER

### 🔴 P0 — Bloquant (immédiat)

| # | Feature | Sous-système | Lien UE | Effort |
|---|---|---|---|---|
| F1 | **Corriger PlayerTag shadowing AISystem.cpp:13** — IA ne trouve pas le joueur | AI/WASM | N/A (bug) | 1h |
| F2 | **Fixer NavMeshBaker freeze 16,4s** (découpage rAF + cache fingerprint) | Mouvement/Physique | NavMesh | 1j |
| F3 | **Diagnostiquer map invisible** (piste `setLoadedChunks` dans doLoadChunk) | Rendu/Streaming | World Partition | 1-2j |
| F4 | **Supprimer db:mysqlQuery** — remplacer par handlers IPC typés | Electron/Security | N/A (sécurité) | 2j |
| F5 | **Migrer WebSocket ws:// → wss://** + hasher mot de passe côté client | Réseau | N/A (sécurité) | 1j |

### 🟠 P1 — Critique (1-2 semaines)

| # | Feature | Sous-système | Lien UE | Effort |
|---|---|---|---|---|
| F6 | **Unifier IA NPC** (supprimer dualité WASM/JS) | AI | Behavior Tree → FSM | 2-3j |
| F7 | **Refactorer RpgGameWorld.tsx** (3984 lignes → modules) | Architecture | N/A | 3-5j |
| F8 | **Implémenter Vue FPS complète** (bras + armes + synchro TPS) | Animation/Combat | AnimBP | 5-7j |
| F9 | **Connecter AnimationGraph WASM** au pipeline Three.js (unifier les deux pistes) | Animation | AnimGraph | 2j |
| F10 | **Implémenter GAS basique** (AbilityStore + EffectDefinition + AttributeSet) | Combat | GAS | 5j |
| F11 | **Ajouter collision layers bitmask** (bitmask + response matrix) | Physique | Collision Channels | 1j |
| F12 | **Implémenter NarvosAudioManager** (submixes, concurrency, attenuation, spatialisation) | Audio | MetaSounds | 2j |
| F13 | **Ajouter post-processing** (Bloom via @react-three/postprocessing) | Rendu | PostProcess | 1j |
| F14 | **Ajouter 3-4 tests d'intégration WASM→JS** | Qualité | N/A | 2-3j |

### 🟡 P2 — Majeur (2-4 semaines)

| # | Feature | Sous-système | Lien UE | Effort |
|---|---|---|---|---|
| F15 | **Behavior Tree + Blackboard Builder WASM** | AI | BT | 3j |
| F16 | **SaveManager unifié** (localStorage + IndexedDB + serveur, versioning, backup) | Sauvegarde | SaveGame | 3j |
| F17 | **Enhanced Input Pipeline** (modifiers: deadzone, scalar, smooth, response curve) | Input | EnhancedInput | 3j |
| F18 | **Widget Stack + GamepadFocusManager** | UI | CommonUI | 2j |
| F19 | **MaterialInstanceStore + MaterialParameterCollection** | Rendu | MID + MPC | 1j |
| F20 | **Data Layer system** (activatable chunk sets) | Streaming | Data Layers | 2j |
| F21 | **LOS check dans NpcController** (utiliser CollisionWorld.raycast) | AI | Perception | 1j |
| F22 | **LOD progressif des chunks** (intégrer les variantes .med.glb/.low.glb) | Rendu | HLOD | 3j |
| F23 | **meshoptimizer dans pipeline GLB** | Pipeline | N/A | 1-2j |
| F24 | **Corriger Valkiria** (offset yaw par avatar) | Animation | Retargeting | 1j |
| F25 | **Implémenter NewHUD** par faction (spécification 1074 lignes) | UI | UMG | 3-4j |

### 🟢 P3 — Secondaire (1-3 mois)

| # | Feature | Sous-système | Lien UE | Effort |
|---|---|---|---|---|
| F26 | **Migrer A* → ReCAST navmesh polygonal** | Pathfinding | NavMesh | 3-4 sem |
| F27 | **Motion Matching complet** (KNN database de clips) | Animation | MotionMatching | 4-6 sem |
| F28 | **Llama.cpp sidecar** pour dialogues PNJ dynamiques | AI/NPC | N/A | 2-3 sem |
| F29 | **cannon-es** pour physique Newtonienne (rigid bodies, forces, contraintes) | Physique | Chaos | 3j |
| F30 | **Refactor Inventory.ts** (10421 lignes → modules) | Architecture | N/A | 3-5j |
| F31 | **RVO2/ORCA crowd avoidance** | Pathfinding | N/A | 1-2 sem |
| F32 | **HLOD streaming manager** (fusion chunks distants) | Streaming | HLOD | 2-3 sem |
| F33 | **Architecture réseau multijoueur** (si le projet devient multi) | Réseau | Replication | 4-8 sem |
| F34 | **Générer les types WASM automatiquement** depuis C++ (embind → .d.ts) | DX/Outils | N/A | 1 sem |
| F35 | **WebGPU compute shaders** (occlusion culling, particules, terrain) | Rendu | Compute | 3-4 sem |
| F36 | **Motion Matching UI Editor** (React Flow + WASM data) | Outils | AnimBlueprint | 3-4 sem |

---

## 9. FEUILLE DE ROUTE

### Court terme (semaine 1 — 30 juillet au 2 août 2026)

```
┌─────────────────────────────────────────────────────┐
│ SEMAINE 1 — URGENCES ET FONDATIONS                  │
├─────────────────────────────────────────────────────┤
│ Lun │ F1  Corriger PlayerTag shadowing              │
│     │ F2  Fixer freeze NavMeshBaker (découpage rAF) │
│     │ F5  Migrer ws:// → wss:// + hash password     │
├─────┼───────────────────────────────────────────────┤
│ Mar │ F3  Diagnostiquer map invisible               │
│     │ F4  Supprimer db:mysqlQuery → handlers typés  │
│     │ F13 Ajouter post-processing Bloom             │
├─────┼───────────────────────────────────────────────┤
│ Mer │ F6  Unifier AI NPC (choisir WASM)             │
│     │ F12 NarvosAudioManager basique                │
│     │ F11 Collision layers bitmask                  │
├─────┼───────────────────────────────────────────────┤
│ Jeu │ F9  Connecter AnimationGraph WASM → Three.js  │
│     │ F19 MaterialInstanceStore + MPC               │
│     │ F18 WidgetStack + GamepadFocusManager         │
├─────┼───────────────────────────────────────────────┤
│ Ven │ F8  Vue FPS complète (bras + armes)          │
│     │ F10 GAS basique (AbilityStore)                │
│     │ F14 Tests intégration WASM→JS                 │
└─────────────────────────────────────────────────────┘
```

**Livrables fin de semaine 1 :**
- ✅ IA NPC unifiée (WASM seulement, plus de dualité)
- ✅ Animation pipeline unifié (Three.js Mixer + WASM AnimationGraph)
- ✅ Sécurité : WebSocket WSS, pas de SQL brut, CSP complète
- ✅ Post-Processing Bloom actif
- ✅ Collision layers opérationnels
- ✅ AudioManager basique avec submixes + spatialisation
- ✅ WidgetStack + GamepadFocusManager
- ✅ NavMeshBaker < 2s (vs 16,4s)
- ✅ Map invisible corrigée

### Moyen terme (semaines 2-4 — août 2026)

```
┌─────────────────────────────────────────────────────────────┐
│ SEMAINES 2-4 — STABILISATION ET RICHESSE                   │
├─────────────────────────────────────────────────────────────┤
│ Sem 2 │ F7  Refactor RpgGameWorld.tsx → GameMode modules   │
│       │ F15 Behavior Tree + Blackboard WASM                 │
│       │ F20 Data Layer system                                │
│       │ F22 LOD progressif des chunks                        │
├─────┼───────────────────────────────────────────────────────┤
│ Sem 3 │ F16 SaveManager unifié                              │
│       │ F17 Enhanced Input Pipeline                          │
│       │ F21 LOS check NpcController                         │
│       │ F23 meshoptimizer dans pipeline GLB                 │
│       │ F25 NewHUD par faction                              │
├─────┼───────────────────────────────────────────────────────┤
│ Sem 4 │ F24 Corriger Valkiria                               │
│       │ P5 Régénérer métadonnées Orbital sans coque         │
│       │ P4 Rééquilibrer chunks Forge                        │
│       │ Tests de régression + validation map complète       │
└─────────────────────────────────────────────────────────────┘
```

**Livrables fin de mois :**
- ✅ RpgGameWorld refactoré en modules (GameMode, CombatHandler, HUD)
- ✅ Behavior Tree + Blackboard pour tous les NPC hostiles
- ✅ SaveManager avec versioning, backup, auto-save
- ✅ Enhanced Input avec modifiers et gamepad
- ✅ LOD progressif pour tous les chunks
- ✅ Data Layers (jour/nuit, instances)
- ✅ meshoptimizer intégré (pipeline GLB optimisé)
- ✅ NewHUD faction déployé

### Long terme (septembre-novembre 2026)

```
┌──────────────────────────────────────────────────────────────┐
│ TRIMESTRE 3-4 2026 — AMÉLIORATIONS MAJEURES                  │
├──────────────────────────────────────────────────────────────┤
│ Sept │ F26 ReCAST navmesh polygonal                          │
│      │ F30 Refactor Inventory.ts                             │
│      │ F31 RVO2/ORCA crowd avoidance                          │
├─────┼────────────────────────────────────────────────────────┤
│ Oct  │ F27 Motion Matching                                   │
│      │ F28 Llama.cpp sidecar dialogues PNJ                    │
│      │ F29 cannon-es physique Newtonienne                     │
├─────┼────────────────────────────────────────────────────────┤
│ Nov  │ F32 HLOD streaming manager                            │
│      │ F34 Génération auto types WASM → .d.ts                 │
│      │ F35 WebGPU compute shaders                            │
│      │ F36 Motion Matching UI Editor                         │
└──────────────────────────────────────────────────────────────┘
```

**Livrables fin de trimestre :**
- ✅ Pathfinding ReCAST polygonal avec crowd avoidance
- ✅ Motion Matching (animations infinies et réactives)
- ✅ Dialogues PNJ LLM (Llama.cpp / transformers.js)
- ✅ Physique Newtonienne (cannon-es)
- ✅ HLOD + occlusion culling GPU
- ✅ Types WASM auto-générés
- ✅ Inventory.ts refactoré

---

## 10. RECOMMANDATIONS D'ARCHITECTURE

### Architecture cible (12 mois)

```
┌─────────────────────────────────────────────────────────────────────┐
│                        NARVOS ENGINE v2                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌───────────────────────┐    ┌──────────────────────────┐           │
│  │   RENDU WEB (client)   │    │   LOGIQUE (WASM C++)     │           │
│  │                        │    │                          │           │
│  │  Three.js/R3F/WebGPU   │    │  ECS (SparseSet → SoA)   │           │
│  │  ├─ PostProcessing     │    │  ├─ Behavior Tree AI     │           │
│  │  ├─ MaterialInstances  │    │  ├─ ReCAST NavMesh       │           │
│  │  ├─ LOD progressif     │◄──►│  ├─ AnimationGraph       │           │
│  │  └─ Frustum culling    │    │  ├─ Motion Matching      │           │
│  │                        │    │  ├─ Physics (BVH+Chaos)  │           │
│  │  ┌───────────────────┐ │    │  └─ ChunkStreaming       │           │
│  │  │   UI (React)      │ │    │                          │           │
│  │  │  ├─ WidgetStack    │ │    │  ┌──────────────────┐    │           │
│  │  │  ├─ GamepadNav     │ │    │  │   LLM Sidecar     │    │           │
│  │  │  ├─ NewHUD Faction │ │    │  │  (Llama.cpp)      │    │           │
│  │  │  └─ SaveManager    │ │    │  │  dialogues PNJ    │    │           │
│  │  └───────────────────┘ │    │  └──────────────────┘    │           │
│  │                        │    │                          │           │
│  │  ┌───────────────────┐ │    │  ┌──────────────────┐    │           │
│  │  │   Audio (WebAudio) │ │    │  │   Asset Pipeline │    │           │
│  │  │  ├─ Submixes       │ │    │  │  meshoptimizer   │    │           │
│  │  │  ├─ Attenuation    │ │    │  │  auto-LOD        │    │           │
│  │  │  └─ Concurrency    │ │    │  │  KTX2/Basis      │    │           │
│  │  └───────────────────┘ │    │  └──────────────────┘    │           │
│  └───────────────────────┘    └──────────────────────────┘           │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐      │
│  │  BRIDGE (Emscripten embind + génération .d.ts automatique) │      │
│  │  Typage fort C++ → TypeScript via bindings auto-générés    │      │
│  └────────────────────────────────────────────────────────────┘      │
│                                                                      │
│  ┌──────────────────────────────────────────────┐                    │
│  │  ÉLECTRON (sandbox=true, CSP, handlers typés) │                    │
│  │  + WebSocket WSS + serveur validation        │                    │
│  └──────────────────────────────────────────────┘                    │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### Principes architecturaux directeurs

#### 1. **Unifier les pipelines duaux**
   - **Animation** : Unifier Three.js AnimationMixer + WASM AnimationGraph en un pipeline unique. Le WASM évalue le graph et écrit les matrices de skinning → Three.js applique.
   - **IA** : Supprimer NpcController.ts (JS). Toute l'IA décisionnelle dans le WASM (BT + Blackboard). JS applique juste `NpcFrameResult`.
   - **Collision** : WASM BVH = source de vérité pour `isBlocked()`. Three.js BVH = fallback + getGroundY. Un seul `registerScene`.
   - **Streaming** : WasmChunkStreaming = décideur. JS exécute les commandes. Supprimer les redondances (AssetBudget + ChunkStreaming fusionnés).

#### 2. **Data-driven plutôt que hard-codé**
   - Behavior Trees définis en JSON → upload WASM
   - AnimationGraph construit par builder JS → WASM
   - Ability configs en JSON → AbilityStore
   - Weapon profiles, NPC catalogs déjà en JSON — maintenir

#### 3. **Préparer le multi-joueur dès maintenant**
   - Même sans serveur dédié :
     - Sérialiser les stores (`toJSON()`/`fromJSON()`)
     - Ajouter WASM `worldExportSnapshot` / `worldImportSnapshot`
     - Abstraction GameMode (logique pure sans Three.js)
   - Quand le multi arrivera, l'architecture sera prête.

#### 4. **Remplacer la dualité par la délégation**
   ```
   React/R3F (rendu + UI)          WASM C++ (logique critique)
   ───────────────────────          ──────────────────────────
   - Mesh, texture, material        - ECS (Transform, Health, AI)
   - Animation playback (GPU)        - AnimationGraph évaluation
   - Audio playback                  - NavMesh pathfinding
   - UI composants                   - Physics / Collision
   - Input capture                   - AI decision (BT)
   - Stores UI (quest, profession)   - Streaming decisions
   ```

#### 5. **Tests et qualité**
   - Maintenir 709+ tests verts
   - Ajouter des tests d'intégration WASM→JS (actuellement 0)
   - **Initialiser Git immédiatement** (baseline après les audits)
   - Automatiser la génération des types WASM → .d.ts

### Dette technique prioritaire

| Dette | Action | Priorité |
|---|---|---|
| Pas de Git | `git init && git add -A && git commit` | 🔴 **Immédiat** |
| RpgGameWorld.tsx 3984 lignes | Refactor en modules (GameMode, CombatHandler, HUDShell) | 🔴 |
| Inventory.ts 10421 lignes | Découpage (InventoryCore, Equipment, Bags) | 🟠 |
| 15 fichiers `.bak` dans le code | `find . -name "*.bak" -delete` | 🟡 |
| Dualité WASM bridges (useWasmWorld.ts / WasmWorldTicker.tsx) | Supprimer useWasmWorld.ts | 🟡 |
| Config MAX_CONCURRENT=2 | Passer à `navigator.hardwareConcurrency / 2` | 🟡 |
| WeakMap caches sans cleanup (AnimationController, mixamoRetarget) | Ajouter TTL ou cleanup | 🟡 |

### Métriques cibles (12 mois)

| Métrique | Actuelle | Cible |
|---|---|---|
| Tests | 709 | 1200+ |
| Erreurs tsc | 1 (three-mesh-bvh) | 0 |
| FPS moyen (Forge) | ~30-45 | 60+ |
| Temps chargement map | ~90s (soupape) | <15s |
| VRAM Forge | 3600 MB budget | <1500 MB |
| NavMesh bake | 16,4s | <2s |
| IA NPC simultanés | ~10 | 50+ |
| Draw calls max | 25 222 (Orbital monolith) | <3000 |
| Fichier le plus long | 3984 lignes (RpgGameWorld) | <1000 lignes |

---

## Annexes

### A. Index des rapports consolidés

| # | Rapport | Équipe | Pages | Priorité fusion |
|---|---|---|---|---|
| 1 | RAPPORT_GLOBAL_2026-07-29.md | FUSION (18 rapports) | 290 lignes | 🔴 |
| 2 | NARVOS_ENGINE_ANALYSIS_RAPPORT.md | Analyse moteur | ~500+ lignes | 🔴 |
| 3 | PASSATION_2026-07-29.md | Passation | ~300 lignes | 🔴 |
| 4 | SECURITY_AUDIT.md | Sécurité (10 agents) | 426 lignes | 🔴 |
| 5 | AUDIT_AUDIO_RAPPORT.md | Audio | 353 lignes | 🟠 |
| 6 | AUDIT_CARTES_RAPPORT.md | Cartes/Streaming (5 agents) | 348 lignes | 🟠 |
| 7 | RENDERING_ANALYSIS_RAPPORT.md | Rendu (10 agents) | 496 lignes | 🟠 |
| 8 | VEILLE_TECHNOLOGIQUE_CATALOGUE.md | Veille (10-20 agents) | 687 lignes | 🟢 |
| 9 | audit-electron.md | Electron | 372 lignes | 🔴 |
| 10 | recherche-ameliorations.md | Recherche (10 agents) | 299 lignes | 🟠 |
| 11 | RAPPORT_IA_WASM.md | IA WASM | 435 lignes | 🔴 |
| 12 | RAPPORT_AUDIT_WASM_CPP_PART1.md | WASM CPP (45 fichiers) | 323 lignes | 🔴 |
| 13 | AUDIT_WASM_STREAMING_PHYSICS.md | WASM Streaming+Physique | 345 lignes | 🟠 |
| 14 | AUDIT_RAPPORT.md | Data (weapons, configs) | 173 lignes | 🟠 |
| 15 | AUDIT_REPORT.md | Test fonctionnel | 107 lignes | 🟢 |
| 16 | AUDIT_MIGRATION.md | Migration Godot→Web | 193 lignes | 🟢 |
| 17 | RAPPORT_AUDIT_UXUI.md | UX/UI (10 agents) | 362 lignes | 🟠 |
| 18 | RAPPORT_FINAL_COMMIT_SKILLS.md | Commit & Skills | 229 lignes | 🟢 |
| 19 | LIVRAISON_RAPPORT_FINAL.md | Livraison finale | 160 lignes | 🟢 |
| — | narvos-ue-adaptation-part1 (skill) | UE→Narvos Part 1 | ~1500 lignes | 🔴 |
| — | narvos-ue-adaptation-part2 (skill) | UE→Narvos Part 2 | ~1200 lignes | 🔴 |
| — | narvos-ue-adaptation-part3 (skill) | UE→Narvos Part 3 | ~1000 lignes | 🔴 |
| — | narvos-engine-reference (skill) | Référence moteur | ~700 lignes | 🔴 |

### B. Glossaire des abréviations

| Abréviation | Signification |
|---|---|
| WASM | WebAssembly |
| R3F | React Three Fiber |
| ECS | Entity Component System |
| BVH | Bounding Volume Hierarchy |
| GAS | Gameplay Ability System |
| BT | Behavior Tree |
| EQS | Environmental Query System |
| FSM | Finite State Machine |
| HLOD | Hierarchical Level of Detail |
| LOD | Level of Detail |
| MPC | Material Parameter Collection |
| MID | Material Instance Dynamic |
| IK | Inverse Kinematics |
| VRAM | Video RAM |
| CSP | Content Security Policy |
| IPC | Inter-Process Communication |

---

*Rapport consolidé par l'Équipe 15/20 — FUSION*  
*30 juillet 2026 · 19 sources d'audit analysées, croisées et synthétisées*  
*Narvos Prime — WebPortal + Narvos Engine (WASM C++)*