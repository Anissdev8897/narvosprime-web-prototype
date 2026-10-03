# 🏆 RAPPORT FINAL — FUSION DES OPTIMISATIONS

**Projet :** Narvos Prime WebPortal  
**Date :** 2026-07-30  
**Agents :** Équipes RENDU (10) · WASM C++ (5) · IA (5) · AUDIT DATA (10) · COMMIT & SKILLS (10) · FPS (1) · FORGE (3) · DETTE TECHNIQUE (3) · AUDIO (3) · FUSION (10)  
**Total agents mobilisés :** ~60  

---

## TABLE DES MATIÈRES

1. [RÉSUMÉ EXÉCUTIF](#1-résumé-exécutif)
2. [GAINS PAR ÉQUIPE](#2-gains-par-équipe)
3. [BENCHMARKS COMPARATIFS](#3-benchmarks-comparatifs)
4. [BUGS CORRIGÉS](#4-bugs-corrigés)
5. [NOUVEAUX SYSTÈMES IMPLÉMENTÉS](#5-nouveaux-systèmes-implémentés)
6. [PROCHAINES ÉTAPES](#6-prochaines-étapes)
7. [RISQUES ET RÉGRESSIONS](#7-risques-et-régressions)
8. [DETTE TECHNIQUE RÉSIDUELLE](#8-dette-technique-résiduelle)

---

## 1. RÉSUMÉ EXÉCUTIF

```
═══════════════════════════════════════════════════════════════════════
RAPPORT FINAL D'OPTIMISATION — NARVOS PRIME WEBPORTAL
═══════════════════════════════════════════════════════════════════════

📊 MÉTRIQUES GÉNÉRALES DU PROJET
  • Fichiers source TS/TSX:        ~500+ (507 fichiers)
  • Fichiers de test:              93 → 96 (+3 nouveaux FPS)
  • Tests unitaires:               709/709 → 761/761 ✅ (+52 tests)
  • Erreurs tsc:                   0
  • Fichiers C++ WASM:             45 (18 .cpp + 27 .h)
  • Fonctions WASM exportées:      ~150
  • Lignes de code total:          ~66 777 (src/ + electron/ + net/)

✅ OPTIMISATIONS RÉALISÉES
  • Bugs corrigés:                 8 (dont 2 critiques, 2 hauts)
  • Bugs supplémentaires FPS:      4 identifiés (2 critiques dégâts×2)
  • Draw calls:                    25 222 → 737 (×34 réduction)
  • VRAM auto-material:            500 Mo → 26 Mo (×19 réduction)
  • Nouveaux tests:                +52 (93→96 fichiers, 709→761 tests)
  • Skills créés:                  20+ (7 projet + 12 HermesClaw + 1 moteur)
  • Rapports d'audit générés:      10+

⚠️ PROBLÈMES CRITIQUES RESTANTS
  • P0 — Freeze NavMeshBaker:      16,4 s bloquant (à découper)
  • P0 — Map invisible changement: Cause non trouvée (piste setLoadedChunks)
  • P0 — Double dégâts FPS:        B1+B2 (dégâts ×2 armes + unarmed)
  • P0 — Git non initialisé:       Aucun historique de version
  • P1 — AI WASM déconnectée:      WriteCommands non bindé
  • P1 — PlayerTag shadowing:      IA C++ ne trouve jamais le joueur

═══ TOP 5 GAINS CHIFFRÉS ═══
  1. RENDU — Draw calls ×34 réduction (25222→737)
  2. RENDU — VRAM auto-material ×19 (500→26 Mo)
  3. RENDU — Chunks forge 32→8 (75% réduction)
  4. TESTS — +52 tests, 761/761 ✅ (100% pass rate)
  5. TYPECHECK — 0 erreurs tsc (propre)

═══════════════════════════════════════════════════════════════════════
```

---

## 2. GAINS PAR ÉQUIPE

### 2.1 Équipe RENDU (10 agents) — StreamingPuzzleMap, materials, loaders

| Métrique | Avant | Après | Gain | Détail |
|---|---|---|---|---|
| **Draw calls Orbital** | 25 222 | **737** | **×34** | Chunking de la map monolithique |
| **VRAM auto-material** | ~500 Mo (bakes) | **~26 Mo** | **×19** | Auto-material triplanaire procédural |
| **VRAM par chunk (KTX2 BC1)** | ~500 Mo | **~396 Mo** | **-21%** | Compression KTX2 BC1 |
| **Chunks forge** | 32 | **8** | **-75%** | Sync manifest (forgeChunks.ts) |
| **Triangles nuls supprimés** | 292 020 | **0** | **100%** | clean-chunk-slivers.mjs |
| **Textures KTX2 converties** | — | **15 textures** | **Nouveau** | scripts/textures-to-ktx2.mjs |
| **Culling** | Sous-estimé ×2.56 | **Corrigé** | ✅ | Métadonnées sphères corrigées |

**Recommandations clés :**
- P0: Paralléliser MAX_CONCURRENT=2→4 (gain -40% temps chargement)
- P1: LOD progressif chunks (gain -50% draw calls à distance)
- P1: Streaming directionnel WASM (priorité champ de vision)

### 2.2 Équipe WASM C++ (5 agents) — 45 fichiers audités

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| **Fichiers audités** | 0 | **45** (100%) | Nouveau |
| **Bugs critiques** | Inconnu | **1** (PlayerTag shadowing) | Identifié |
| **Bugs mineurs** | Inconnu | **3** (Vehicle sol plat, StateMachine stub, AnimationGraph 85%) | Identifiés |
| **Fonctions API JS** | ? | **~150** | Cartographié |
| **WriteCommands bind** | Absent | **À faire** | Bloque pipeline IA |

**Bugs C++ identifiés :**
| ID | Fichier | Problème | Sévérité |
|---|---|---|---|
| W1 | `ai/AISystem.cpp:13` | PlayerTag shadowing → IA ne trouve jamais le joueur | 🔴 Critique |
| W2 | `physics/Vehicle.cpp:50` | Suspension sol plat y=0 → véhicule inutilisable hors terrain plat | 🟡 Limitation |
| W3 | `animation/AnimationGraph.cpp:104` | AddStateMachine stub → ignore les paramètres | 🟡 Mineur |
| W4 | `physics/TriggerSystem.cpp:84-113` | O(N×M) par tick → 100+ zones ralentissent | 🟠 Performance |

### 2.3 Équipe IA WASM (5 agents) — AISystem, AICommandSync, NpcController

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| **Compréhension pipeline IA** | 0 | **Pipeline complet cartographié** | Nouveau |
| **WriteCommands** | Non bindé | **À faire (P1)** | Bloquant |
| **États C++ réels** | ? | **5/8 actifs** (3 morts) | Cartographié |
| **Champs morts AITactical** | ? | **4 champs** (alertLevel, accuracy, suppressing, squadLeader) | Identifié |
| **Dualité C++/JS** | Inconnue | **Redondance totale** (deux FSM complètes) | Architecture |

**Recommandations IA :**
- **P1:** Binder WriteCommands dans Bindings.cpp → débloque pipeline WASM→JS
- **P2:** Ajouter `#include "components/PlayerTag.h"` dans AISystem.cpp
- **P3:** Choisir maître unique WASM ou JS pour l'IA NPC
- **P3:** Implémenter ou supprimer Investigate/Suppress (2 états morts)

### 2.4 Équipe AUDIT DATA (10 agents) — 13 fichiers audités

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| **Fichiers audités** | 0 | **13** | Cartographié |
| **Bugs H (critiques)** | — | **4** | Identifiés |
| **Bugs M (moyens)** | — | **4** | Identifiés |
| **Bugs m (mineurs)** | — | **7** | Identifiés |

**Bugs DATA critiques :**
| ID | Fichier | Problème | Sévérité |
|---|---|---|---|
| H1 | `weaponProfiles.json:34` | grip arch_gun `one_hand` vs classifier `two_hand` | 🔴 Haute |
| H2 | `weaponProfiles.json` | type `sword` invalide (n'existe pas dans WeaponType) | 🔴 Haute |
| H3 | `assets-manifest.json` | Tous les tableaux vides → impossible valider chemins GLB | 🔴 Haute |
| H4 | `playerConfig.ts` vs `characterScale.ts` | Commentaire "reload required" factice (getters dynamiques) | 🔴 Haute |

### 2.5 Équipe COMMIT & SKILLS (10 agents)

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| **Tests** | 709/709 | **761/761** (+52) ✅ | 93→96 fichiers |
| **Erreurs tsc** | 8 | **0** ✅ | Nettoyé |
| **Bugs corrigés** | — | **8** | Voir §4 |
| **Skills créés** | 13 | **20+** | +7 projet + 12 HermesClaw |
| **Fichiers .bak** | 15 | **15** (identifiés) | À nettoyer |
| **Git** | ❌ Non initialisé | **Toujours pas initialisé** | P0 |

### 2.6 Équipe FPS (1 agent) — Vérification finale

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| **Tests FPS** | 0 | **7 tests** (5+2) | Nouveau |
| **Tests totaux** | 709/93 | **761/96** | +52 tests, +3 fichiers |
| **Bugs FPS** | — | **4 identifiés** (2 P0, 1 P2, 1 P3) | Documenté |

**Bugs FPS :**
| ID | Problème | Sévérité |
|---|---|---|
| B1 | Double dégâts armes (autoAttackRef + onFireImpact) | 🔴 P0 |
| B2 | Double dégâts unarmed (unarmedStrikeRef + autoAttackRef) | 🔴 P0 |
| B3 | Animation de punch non jouée en FPS (fireToken vs oneShotToken) | 🟡 P2 |
| B4 | autoAttackRef passé aux deux viewmodels (incohérence) | 🟢 P3 |

### 2.7 Équipe FORGE P2 (3 agents) — Éditeur de mondes

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| **Tests Forge** | 31/5 files | **31/5 files** (inchangé) | Stable |
| **Lacunes identifiées** | — | **7 lacunes critiques** | Documentées |
| **Undo/Redo** | Partiel | **6 problèmes** (gizmo, material, terrain, chemins, calques) | Identifié |

### 2.8 Équipe DETTE TECHNIQUE (3 agents)

| Catégorie | Occurrences | Priorité |
|---|---|---|
| `console.log/warn/error` | **~190 appels** | 🔴 Haute |
| `eslint-disable` | **52** (30 exhaustivedeps, 10 no-explicit-any) | 🔴 Haute |
| `as any / as unknown` | **49 occurrences** | 🟠 Moyenne |
| Fichiers > 500 lignes | **14 fichiers** | 🟠 Moyenne |
| `catch` vides | **4** (storage.ts) | 🔴 Haute |
| `null!` | **1** | 🟢 Basse |
| `@ts-ignore` | **0** dans src/ | ✅ Propre |
| `TODO/FIXME` | **0** dans src/ | ✅ Propre |

### 2.9 Équipe AUDIO (3 agents)

| Métrique | Avant | Après | Gain |
|---|---|---|---|
| **Documentation** | Obsolète | **Problèmes identifiés** | À réécrire |
| **Spatialisation 3D** | Absente | **Documenté** | P2 |
| **bug playOneShotWebAudio** | bypass masterGain | **Documenté** | P2 |
| **Fuite mémoire audio** | Présente | **Documenté** | P3 |
| **Fichiers audio sur disque** | 614 fichiers | **Inventoriés** | Cartographié |

---

## 3. BENCHMARKS COMPARATIFS

### 3.1 Performance Rendu

| Métrique | AVANT (estimation baseline) | APRÈS (état actuel) | OBJECTIF (court terme) |
|---|---|---|---|
| **Draw calls (Orbital)** | 25 222 | **737** | <500 (avec LOD) |
| **Draw calls (Forge 8 chunks)** | ~6 400 | **~800-1 600** | <1 000 |
| **VRAM chunks (8×)** | ~4 000 Mo (bakes) | **~3 168 Mo** (KTX2) | <2 000 Mo |
| **VRAM auto-material** | ~500 Mo (bakes) | **~26 Mo** | ~26 Mo ✅ |
| **Temps chargement initial** | ~120-180 s | **~90 s** (soupape) | <30 s |
| **Upload GPU textures/chunk** | ~4-8 s | **~2-4 s** (lots 16) | <1 s (parallélisé) |
| **Micro-freezes chargement** | ~11,5 s/chunk | **~3,5-11,5 s/chunk** | <1 s/chunk |
| **FPS (Forge, 8 chunks)** | ~30-45 | **~45-60** (estimé) | 60+ stable |
| **Triangles nuls** | 292 020 | **0** ✅ | 0 |

### 3.2 Performance CPU

| Métrique | AVANT | APRÈS | OBJECTIF |
|---|---|---|---|
| **NavMesh bake** | 16,4 s (bloquant) | **16,4 s** (inchangé) | <1 s (découpé) |
| **GLTF Parse chunk** | ~2 000 ms | **500-2 000 ms** | <500 ms |
| **Rebuild auto-material ×8** | ~300 ms | **100-300 ms** | <50 ms |
| **Segments blocked/frame** | <0,1 ms | **<0,1 ms** ✅ | <0,1 ms |
| **Tests unitaires** | 709/709 (15,5 s) | **761/761 (20,6 s)** | <30 s |
| **Build tsc** | ~2 min | **~2 min** ✅ | <2 min |
| **Build vite complet** | 7+ min | **7+ min** (assets 27 845+) | <3 min |

### 3.3 Qualité Code

| Métrique | AVANT | APRÈS | OBJECTIF |
|---|---|---|---|
| **Erreurs tsc** | ~8 | **0** ✅ | 0 |
| **Tests passants** | 709 (93 files) | **761 (96 files)** | 800+ |
| **Fichiers .bak** | ~15 | **15** (identifiés) | 0 |
| **console.log prod** | ~190 | **~190** (identifiés) | <10 |
| **eslint-disable** | ~52 | **52** (identifiés) | <10 |
| **as any** | ~49 | **49** (identifiés) | <5 |
| **catch vides** | ~4 | **4** (identifiés) | 0 |
| **Plus gros fichier** | 3 995 lg (RpgGameWorld) | **3 995 lg** (identifié) | <800 lg |
| **Git** | ❌ | **❌** (toujours pas init) | ✅ initialisé |

### 3.4 Performance WASM

| Métrique | AVANT | APRÈS | OBJECTIF |
|---|---|---|---|
| **Temps init WASM** | ~1-2 s | **~1-2 s** | <500 ms |
| **Temps tick WASM** | <1 ms | **<1 ms** ✅ | <0,5 ms |
| **Buffer streaming** | Alloué dynamiquement | **Alloué dynamiquement** | Pool fixe |
| **BVH build** | Median split | **Median split** | SAH (-30% raycast) |
| **Vehicle suspension** | Sol plat (y=0) | **Sol plat (y=0)** Bug | Raycast réel |

### 3.5 Évolution des Tests

| Session | Fichiers de test | Tests passants | Δ |
|---|---|---|---|
| Baseline (état initial) | ~85 | ~650 | — |
| 27-29 Juillet | 93 | **709** | +59 |
| 30 Juillet (FPS) | 96 | **761** | +52 |
| **TOTAL** | **96** | **761** | **+111** |

---

## 4. BUGS CORRIGÉS

### 4.1 Session 27-29 Juillet (8 bugs)

| # | Bug | Fichier(s) | Sévérité | Correctif |
|---|---|---|---|---|
| 1 | Crash React — hooks conditionnels après `\|\|` | BodyTintAdmin, MapGenPanel, ArrowMutationAdmin | 🔴 Critique | Restructuration hooks |
| 2 | Sphères de culling sous-estimées (×2.56) | StreamingPuzzleMap.tsx | 🔴 Haute | Correction métadonnées |
| 3 | Triangles d'aire nulle (292 020) | clean-chunk-slivers.mjs | 🔴 Haute | Script nettoyage |
| 4 | Repli mémoire auto (RangeError → degradeVariant) | StreamingPuzzleMap.tsx | 🟡 Moyenne | OOM fallback |
| 5 | Auto-material triplanaire runtime (242 meshes) | AutoMaterial.ts | 🟡 Moyenne | Runtime shader patch |
| 6 | DoubleSide faces terrain (MWAM) | StreamingPuzzleMap, AutoMaterial | 🟡 Moyenne | Face culling corrigé |
| 7 | Loading lock à 88% (loadBusyRef) | hydrateAll.ts | 🟡 Moyenne | Lock timeout fix |
| 8 | forgeChunks.ts désynchronisé (32→8) | chunkStream.ts | 🟡 Moyenne | Sync manifest |

### 4.2 Passation antérieure (8+ bugs)

| # | Bug | Statut |
|---|---|---|
| 1 | Détection sol (raycaster.far) | ✅ Corrigé |
| 2 | Filet anti-chute | ✅ Corrigé |
| 3 | Coques enveloppantes collision | ✅ Corrigé |
| 4 | Murs invisibles admin | ✅ Corrigé |
| 5 | Troopers sans texture | ✅ Corrigé |
| 6 | Monstres invisibles (Torus → Tosus) | ✅ Corrigé |
| 7 | Crabe Aquarys microscopique | ✅ Corrigé |
| 8 | Audio inaudible changement stage | ✅ Corrigé |
| 9 | CSP Electron wasm-unsafe-eval | ✅ Corrigé |
| 10 | Cache ERR pour mp4 dev | ✅ Corrigé |

### 4.3 Bugs FPS Identifiés (4 bugs — NON corrigés)

| ID | Bug | Fichier | Sévérité | Correctif nécessaire |
|---|---|---|---|---|
| B1 | Double dégâts armes | RpgGameWorld.tsx:1675+3200 | 🔴 P0 | Retirer onFireImpact de FpsWeaponViewmodel |
| B2 | Double dégâts unarmed | RpgGameWorld.tsx:1696+3210 | 🔴 P0 | Retirer onFireImpact de FpsUnarmedViewmodel |
| B3 | Animation punch FPS absente | RpgGameWorld.tsx:3209 | 🟡 P2 | Ajouter attackToken += 1 dans createUnarmedStrikeHandler |
| B4 | autoAttackRef incohérent | RpgGameWorld.tsx:3200+3210 | 🟢 P3 | Refactor sémantique des callbacks |

---

## 5. NOUVEAUX SYSTÈMES IMPLÉMENTÉS

### 5.1 Rendu & Streaming

| Système | Fichier(s) | Description |
|---|---|---|
| **Auto-material triplanaire** | `AutoMaterial.ts`, `autoMaterialStore.ts`, `autoMaterialConfig.ts` | Shader procédural terrain (26 Mo au lieu de 500 Mo) |
| **Streaming Debug HUD** | `StreamingDebugHud.tsx` | HUD debug (boutons F3) pour culling et auto-material |
| **Nettoyage triangles nuls** | `clean-chunk-slivers.mjs`, `clean-slivers.mjs` | Suppression 292 020 triangles d'aire nulle |
| **Conversion textures KTX2** | `chunks-to-ktx2.mjs`, `textures-to-ktx2.mjs` | Pipeline conversion textures format KTX2 BC1 |
| **Chunks forge 32→8** | `chunkStream.ts` | Sync manifest réduit de 32 à 8 chunks |
| **Qualité variante** | `assetQuality.ts` | Système variants .glb / .med.glb / .low.glb |

### 5.2 FPS & Camera

| Système | Fichier(s) | Description |
|---|---|---|
| **FpsWeaponViewmodel** | `RpgGameWorld.tsx` | Arme 3D overlay 1ʳᵉ personne |
| **FpsUnarmedViewmodel** | `RpgGameWorld.tsx` | Bras nus FPS |
| **BucheronAxeViewmodel** | `RpgGameWorld.tsx` | Hache bûcheron FPS (forcée) |
| **cameraViewStore** | `cameraViewStore.ts` | Store React pour vue FPS/TPS |
| **Tests FPS** | 7 nouveaux tests | cameraViewStore (5) + equippedWeaponStore (2) |

### 5.3 Skills & Documentation

| Skill | Domaine | Description |
|---|---|---|
| `narvos-project-map` | Projet | Carte mentale, architecture, métriques |
| `narvos-error-log` | Projet | Journal d'erreurs (NE PAS EFFACER) |
| `narvos-iteration-guard` | Projet | Procédure post-modification |
| `narvos-preflight` | Projet | Checklist pré-publication |
| `narvos-mesh-pipeline` | Projet | Pipeline Unreal→GLB→chunks→runtime |
| `narvos-measure-first` | Projet | Discipline de diagnostic (10 règles) |
| `narvos-level-design` | Projet | Métriques gameplay + principes level design |
| `narvos-corrections-20260729` | HermesClaw | Documentation complète bugs, tests, skills |
| `narvos-engine-reference` | Moteur | Référence complète moteur Narvos Prime |
| 12 skills HermesClaw | HermesClaw | Auto-debugging, audit, sécurité, etc. |

### 5.4 Rapports d'Audit (10+ générés)

| Rapport | Agent | Pages |
|---|---|---|
| `RAPPORT_GLOBAL_2026-07-29.md` | FUSION | ~290 lignes |
| `NARVOS_ENGINE_ANALYSIS_RAPPORT.md` | Analyse moteur | ~25 Ko |
| `RENDERING_ANALYSIS_RAPPORT.md` | Améliorations RENDU | ~496 lignes |
| `AUDIT_RAPPORT.md` | AUDIT DATA | ~173 lignes |
| `RAPPORT_AUDIT_UXUI.md` | UX/UI | — |
| `RAPPORT-DETTE-TECHNIQUE.md` | Dette technique | ~296 lignes |
| `RAPPORT_FINAL_COMMIT_SKILLS.md` | Commit & Skills | ~229 lignes |
| `WASM_VS_JS_DUALITE_RAPPORT.md` | Dualité WASM/JS | ~512 lignes |
| `RAPPORT_AUDIT_WASM_CPP_PART1.md` | WASM C++ Part 1 | ~323 lignes |
| `RAPPORT_IA_WASM.md` | IA WASM | ~435 lignes |
| `FPS_FINAL_VERIFICATION_RAPPORT.md` | Vérification FPS | ~219 lignes |
| `AUDIT_AUDIO_RAPPORT.md` | Audio | ~353 lignes |
| `RAPPORT_OUTILS_EDITEUR.md` | Outils éditeur | ~540 lignes |
| `RAPPORT_FORGE_P2.md` | Forge P2 | ~280 lignes |
| **`RAPPORT_FINAL_OPTIMISATIONS.md`** 🆕 | **FUSION FINALE** | **Ce fichier** |

---

## 6. PROCHAINES ÉTAPES

### 6.1 P0 — Bloquant (immédiat)

| # | Action | Sous-système | Effort | Référence |
|---|---|---|---|---|
| 1 | **`git init` et commiter la baseline** | Projet | ~10 min | COMMIT |
| 2 | **Corriger double dégâts FPS (B1+B2)** — retirer onFireImpact | RpgGameWorld.tsx | ~15 min | FPS |
| 3 | **Corriger freeze NavMeshBaker (16,4 s)** — découpage + cache | Mouvement/Physique | 1 jour | GLOBAL |
| 4 | **Diagnostiquer map invisible** — piste setLoadedChunks | Rendu | 1-2 jours | GLOBAL |
| 5 | **Binder WriteCommands WASM** dans Bindings.cpp | IA WASM | 2h | IA |
| 6 | **Corriger PlayerTag shadowing** — #include PlayerTag.h | IA C++ | ~5 min | C++ |

### 6.2 P1 — Critique (cette semaine)

| # | Action | Effort | Référence |
|---|---|---|---|
| 1 | Paralléliser chargement chunks (MAX_CONCURRENT=2→4) | 1 jour | RENDU |
| 2 | Upload GPU priorisé (lots 32-64) | 2 jours | RENDU |
| 3 | LOD progressif chunks | 3 jours | RENDU |
| 4 | Streaming directionnel WASM (dot product caméra) | 2 jours | RENDU |
| 5 | Corriger B3 FPS (animation punch) | 1h | FPS |
| 6 | Corriger H1/H2 weaponProfiles.json (grip, type) | 1h | DATA |
| 7 | Nettoyer 15+ fichiers .bak | ~15 min | COMMIT |
| 8 | Exécuter `__narvosNpcDiag()` | ~10 min | GLOBAL |
| 9 | Ajouter spawn Orbital dans mapConfig.ts | ~30 min | GLOBAL |

### 6.3 P2 — Moyen (ce mois)

| # | Action | Effort | Référence |
|---|---|---|---|
| 1 | SAH BVH (-30% raycast) | 3 jours | WASM C++ |
| 2 | Pool mémoire streaming fixe | 0,5 jour | WASM C++ |
| 3 | Cache temporal raycast WASM | 1 jour | WASM C++ |
| 4 | Régénérer métadonnées chunks (`npm run generate:assets`) | ~5 min | RENDU |
| 5 | Valider murs invisibles toutes maps | 1 jour | GLOBAL |
| 6 | Appeler `disposeAutoMaterial()` changement perso | ~30 min | RENDU |
| 7 | Nettoyer catalogue armes via weaponClassifier.ts | 1 jour | DATA |
| 8 | Unifier système IA NPC (WASM ou JS) | 2-3 jours | IA/WASM |
| 9 | Remplacer console.log par logger structuré | 3 jours | DETTE |
| 10 | Correction FPS zoom (Ctrl potentiel conflit) | 1h | FPS |

### 6.4 P3 — Long terme

| # | Action | Effort |
|---|---|---|
| 1 | Refactorer RpgGameWorld.tsx (3 995 lignes → modules) | 3-5 jours |
| 2 | Refactorer Inventory.ts (10 421 lignes) | 3-5 jours |
| 3 | Implémenter Vue FPS complète (bras + synchro TPS) | 5-7 jours |
| 4 | Implémenter NewHUD par faction (spec 1074 lignes) | 3-4 jours |
| 5 | Ajouter LOS check dans NpcController | 1 jour |
| 6 | Intégrer meshoptimizer pipeline GLB | 1-2 jours |
| 7 | Activer AssetBudgetBridge WASM | 2 jours |
| 8 | Détection d'immobilité (idle → skip tick) | 0,5 jour |
| 9 | Migrer A* → ReCAST navmesh polygonal | 3-4 semaines |
| 10 | Architecture réseau multijoueur | 4-8 semaines |

---

## 7. RISQUES ET RÉGRESSIONS

### 7.1 Risques Immédiats

| # | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| **R1** | **Régression auto-material** si mise à jour Three.js (onBeforeCompile fragile) | 🟠 Moyenne | Affichage terrain cassé | Tests visuels post-update |
| **R2** | **Dérive budget VRAM** StreamingPuzzleMap — estimation statique WASM vs réel GPU | 🟠 Moyenne | OOM GPU / crash WebGL | Synchro budget temps réel |
| **R3** | **Divergence IA NPC** — deux FSM (JS + WASM) non synchronisées | 🔴 Haute | Comportement PNJ erratique | Unifier ou supprimer une des deux |
| **R4** | **Map invisible** au changement de personnage — cause non trouvée | 🔴 Haute | Joueur bloqué | Piste setLoadedChunks + disposeAutoMaterial |
| **R5** | **Freeze 16,4 s** NavMeshBaker — bloquant si pas découpé | 🔴 Haute | Game freeze sortie vaisseau | Découpage + cache par map |

### 7.2 Risques Techniques

| # | Risque | Sous-système | Détail |
|---|---|---|---|
| **R6** | **WebGL Context Lost** après modifications streaming | Rendu | Dispose VRAM réel, chunks 256px, purge THREE.Cache |
| **R7** | **Recompilation shader onBeforeCompile** — fragile aux versions Three.js | Auto-material | customProgramCacheKey mitige |
| **R8** | **Double mémoire animation** — clips chargés dans Three.js + WASM | Animation | 2× stockage clips pour PNJ militaires |
| **R9** | **Double malloc/free HEAPF32** pour clips anim | WASM Bridge | Overhead à quantifier |
| **R10** | **SegmentBlocked C++ — delta shadowing** (2 déclarations) | Collision | Bug silencieux si BVH présent |
| **R11** | **TriggerSystem O(N×M)** — 100+ zones ralentissent le tick | Physique | Ajouter BVH spatial |

### 7.3 Risques Qualité

| # | Risque | Détail |
|---|---|---|
| **R12** | **Console.log en production** — ~190 appels exposent données internes | Migration logger structuré |
| **R13** | **catch vides storage.ts** — 4 erreurs silencieuses → perte données joueur | Au minimum logger |
| **R14** | **Monkey-patches globaux** — createImageBitmap, computeBoundsTree, installKtx2Everywhere | Fragile aux updates dépendances |
| **R15** | **Tests manquants** — StreamingPuzzleMap, RpgGameWorld, WASM bridges | Ajouter tests intégration |

### 7.4 Regressions Potentielles (à surveiller)

| # | Changement | Risque régression | Signe précurseur |
|---|---|---|---|
| **Reg1** | MAX_CONCURRENT 2→4 | Thrash réseau/mémoire | isContextLost() → baisser à 1 |
| **Reg2** | Correction double dégâts FPS | Arme ne fait plus de dégâts en FPS | Test combat FPS |
| **Reg3** | Suppression AnimationGraph WASM | PNJ militaires sans animation | AnimationBinding test |
| **Reg4** | Chunking maps | Collision incohérente | CollisionWorld test |
| **Reg5** | Correction PlayerTag shadowing | PlayerTag non trouvé → crash | getEntityCount() |

---

## 8. DETTE TECHNIQUE RÉSIDUELLE

### 8.1 Par Priorité

| Priorité | Catégorie | Items | Effort estimé |
|---|---|---|---|
| 🔴 **Haute** | `console.log` → logger structuré | ~190 appels | 3 jours |
| 🔴 **Haute** | `catch (e) { }` vides → logger/traiter | 4 (storage.ts) | 1h |
| 🔴 **Haute** | RpgGameWorld.tsx → refactor modules | 3 995 lignes | 3-5 jours |
| 🔴 **Haute** | Monkey-patches console.warn → retirer | 2 fichiers | 1h |
| 🟠 **Moyenne** | `as any` → `unknown` + type guards | 49 occurrences | 2 jours |
| 🟠 **Moyenne** | Fichiers > 500 lignes → découper | 14 fichiers | 5-10 jours |
| 🟠 **Moyenne** | `eslint-disable exhaustive-deps` → corriger | 30 occurrences | 2 jours |
| 🟠 **Moyenne** | `eslint-disable no-explicit-any` → corriger | 10 occurrences | 1 jour |
| 🟢 **Basse** | `null!` → initialisation sécurisée | 1 occurrence | 30 min |
| 🟢 **Basse** | `.bak` files → nettoyer | 15 fichiers | 15 min |

### 8.2 Par Fichier (Top 10 dette)

| Rang | Fichier | Lignes | Dette | Problème principal |
|---|---|---|---|---|
| 1 | `RpgGameWorld.tsx` | **3 995** | 🔴 Critique | Monolithe, 9x eslint-disable |
| 2 | `Inventory.ts` | **10 421** | 🔴 Critique | Monstre, deuxième plus gros |
| 3 | `StreamingPuzzleMap.tsx` | **1 027** | 🟠 Élevée | doLoadChunk 350+ lignes, 3x eslint-disable |
| 4 | `AnimationController.ts` | **922** | 🟠 Élevée | 922 lignes, WeakMap leak |
| 5 | `storage.ts` | **864** | 🟠 Élevée | ~45 console.log, 4 catch vides |
| 6 | `electron/main.ts` | **843** | 🟠 Élevée | ~36 console.log |
| 7 | `AudioManager.ts` | **725** | 🟠 Élevée | ~20 console.log, bypass masterGain |
| 8 | `OwnAnimPlayerCharacter.tsx` | **698** | 🟠 Élevée | Trop gros |
| 9 | `Npc.tsx` | **660** | 🟠 Élevée | Dualité IA dispatch |
| 10 | `ForgeEditor.tsx` | **653** | 🟠 Élevée | Forge monolithique |

### 8.3 Fils Rouges Transversaux

1. **Accès `window as any` / `narvosLauncher as any`** — 15+ occurrences → typage global `declare global { interface Window { narvosLauncher: ... } }`
2. **Monkey-patching Three.js** — 3 patchs globaux (computeBoundsTree, installKtx2Everywhere, createImageBitmap) → use extension points officiels
3. **Dualité WASM/JS** — 5 systèmes dupliqués (Collision, AI, Animation, NavMesh, Streaming) → unifier par flux unidirectionnel
4. **Logs de diagnostic conditionnels** — `if (DEV) console.log(...)` → module `logger.ts` avec niveaux et filtrage

---

## ANNEXE A — RÉCAPITULATIF ÉQUIPES

| Équipe | Agents | Périmètre | Résultats clés | Rapports |
|---|---|---|---|---|
| **RENDU** | 10 | StreamingPuzzleMap, materials, loaders, chunkCache | Draw calls 25 222→737, VRAM 500→26 Mo, 8 chunks | RENDERING_ANALYSIS_RAPPORT.md |
| **WASM C++** | 5 | 45 fichiers, 9 sous-systèmes | 1 bug critique (PlayerTag), 3 bugs, ~150 fns API | RAPPORT_AUDIT_WASM_CPP_PART1.md |
| **IA WASM** | 5 | AISystem, AICommandSync, NpcController | Pipeline complet cartographié, WriteCommands non bindé | RAPPORT_IA_WASM.md |
| **AUDIT DATA** | 10 | 13 fichiers données | 4 H, 4 M, 7 m bugs identifiés | AUDIT_RAPPORT.md |
| **COMMIT & SKILLS** | 10 | Git, tests, compilation, skills | 709→761 tests ✅, 20+ skills, 0 erreurs tsc | RAPPORT_FINAL_COMMIT_SKILLS.md |
| **FPS** | 1 | Vérification FPS/TPS | 4 bugs (2 P0), 7 tests, chaîne valide | FPS_FINAL_VERIFICATION_RAPPORT.md |
| **FORGE P2** | 3 | Éditeur de mondes Forge | 7 lacunes critiques identifiées (undo, copy, multi-select) | RAPPORT_FORGE_P2.md |
| **DETTE TECHNIQUE** | 3 | Scan qualité complet | ~310 items, 190 console.log, 52 eslint-disable | RAPPORT-DETTE-TECHNIQUE.md |
| **AUDIO** | 3 | AudioManager, WebAudio | Documentation obsolète, spatialisation absente | AUDIT_AUDIO_RAPPORT.md |
| **FUSION** | 10 | Consolidation globale | Rapport global, roadmap, métriques | RAPPORT_GLOBAL_2026-07-29.md |

---

## ANNEXE B — MÉTRIQUES CLÉS (Carte de Score)

| Domaine | Score | État |
|---|---|---|
| **TypeScript (tsc)** | 🟢 **100%** | 0 erreurs |
| **Tests unitaires** | 🟢 **100%** | 761/761 pass |
| **Bugs corrigés** | 🟢 **8+10** | Sérieux identifiés et corrigés |
| **Rapports d'audit** | 🟢 **15+** | Cartographie complète du projet |
| **Build Vite** | 🟡 **Partiel** | tsc OK, bundling lent (7+ min) |
| **Git** | 🔴 **0%** | Pas d'historique de version |
| **Bugs ouverts (critiques)** | 🟡 **4 P0** | 2 dégâts ×2 + 2 bugs gameplay |
| **FPS** | 🟡 **Stable** | 4 bugs restants dont 2 P0 |
| **Documentation** | 🟡 **Partielle** | Audio obsolète, skills à jour |
| **Dette technique** | 🟠 **Élevée** | ~310 items, 14 fichiers > 500 lignes |

---

*Rapport consolidé par l'Équipe FUSION FINALE — 30 juillet 2026.*  
*Sources : 10+ équipes, 15+ rapports d'audit, code source complet.*