# RAPPORT GLOBAL NARVOS PRIME — 29 JUILLET 2026

**Équipe FUSION (Consolidation)**  
**Sources :** PASSATION_2026-07-29.md · NARVOS_ENGINE_ANALYSIS_RAPPORT.md · recherche-ameliorations.md · rapport-corrections-2026-06-12.md · SPECIFICATIONS_HUD_SYSTEM.md · MAPS_LOADING_ANALYSIS.md · AUDIO_SETUP.md · package.json · code source complet

---

## 1. RÉSUMÉ EXÉCUTIF

### État général du projet

Narvos Prime est un MMORPG 3D science-fiction en développement, basé sur une architecture **hybride WebAssembly (C++) + Three.js/React-Three-Fiber (R3F)**, embarqué via **Electron 39**. Le moteur est fonctionnel et jouable, avec des systèmes de streaming spatial, de collision BVH, d'animation retargetée multi-skeleton, d'IA PNJ, de combat, de quêtes, de professions, de loot, et de génération procédurale de carte.

**Métriques clés :**
| Métrique | Valeur |
|----------|--------|
| Fichiers source TypeScript/TSX | ~350+ (93 fichiers test, ~250 fichiers source) |
| Tests | 709 tests verts (état PASSATION) — 93 fichiers de test |
| `tsc` | 1 erreur pré-existante (`CollisionWorld.ts:20`, typage `three-mesh-bvh`) |
| Linter | Aucun |
| Couverture WASM→JS | ~55+ fonctions exportées, aucun typage automatique (déclarations .d.ts manuelles) |
| Plus gros fichier | `RpgGameWorld.tsx` — **3984 lignes** |
| Deuxième plus gros | `StreamingPuzzleMap.tsx` — **1027 lignes** |
| Troisième plus gros | `AnimationController.ts` — **922 lignes** |
| Déploiement | Vite 6 · Electron 39 · build Windows/Mac/Linux via electron-builder |

### Problèmes critiques (Top 5)

| # | Problème | Priorité | Sous-système |
|---|----------|----------|-------------|
| 1 | **Freeze 16,4 s en sortant de vaisseau** — NavMeshBaker intégral non-différé | **P0** | Mouvement/Physique |
| 2 | **Map invisible au changement de personnage** — cause non trouvée, piste `StreamingPuzzleMap` sans flush `setLoadedChunks` | **P0** | Rendu |
| 3 | **Crash accroupi + strafe** — non diagnostiqué, hypothèse perte contexte WebGL | **P1** | Animation/Mouvement |
| 4 | **Vue FPS : bras/armes/mains manquants** — 4 demandes fusionnées, synchronisation FPS/TPS requise | **P1** | Animation/Combat/Rendu |
| 5 | **RpgGameWorld.tsx monolithique** — 3984 lignes, 200+ imports, pas de découpage possible sans refactor | **P1** | Architecture |

### Améliorations rapides (Quick Wins)

1. ✅ **Corrigé session passation** : Détection de sol (raycaster.far), filet anti-chute, coques enveloppantes, murs invisibles admin, troopers sans texture — tout vérifié
2. **Ajouter spawn Orbital** dans `mapConfig.ts` (point de spawn manquant → spawn dans le vide)
3. **Exécuter `__narvosNpcDiag()`** — diagnostic monstre invisible déjà codé mais jamais lancé
4. **Ajouter `disposeAutoMaterial()`** au cycle de changement de personnage (code existe, personne ne l'appelle)
5. **Valider le système de murs invisibles** sur toutes les maps (fonctionne sur Forge, à vérifier sur les autres)
6. **Nettoyer le catalogue d'armes** — supprimer hors-catalogue via `weaponClassifier.ts` existant
7. **Lancer `generate:assets`** pour régénérer les métadonnées de chunks (corrige le culling sous-estimé)

---

## 2. PROBLÈMES PAR SOUS-SYSTÈME

### 2.1 Animation (idle, crouch, combat, FPS)

| Problème | Cause | Solution | Priorité | Risque |
|----------|-------|----------|----------|--------|
| **Vue FPS : bras/armes/mains manquants** | Les animations de poing en FPS n'affichent pas les bras. Pas de vrai corps visible en FPS. Les animations armes FPS ne sont pas synchronisées TPS. | Implémenter : (1) corps FPS complet, (2) animations armes synchronisées FPS/TPS, (3) reconfiguration complète du système. Voir `cameraViewStore.ts`, `builtinWeaponMask.ts`, `shotgunFpsRegistry.ts`, `weaponAnimClips.ts` (132 clips), `unarmedStrikes.ts`. | **P1** | Contrainte multijoueur : synchro FPS↔TPS obligatoire |
| **Valkiria marche à l'envers** | `ueMannequinRig: true` mais le blend directionnel et le yaw supposent convention Mixamo (−Z). Le mannequin UE regarde +X. | Ajouter un offset de yaw par avatar (probablement 180° ou 90°) à côté du flag `ueMannequinRig`. Attention à la faute de frappe commentée ligne 88. | **P2** | Faible (modèle isolé) |
| **Crash accroupi + strafe** | Non diagnostiqué. NaN écarté via `computeWallHeights`, `setClips` en boucle écarté, récursion `moveAxis` écartée. | Hypothèse : perte de contexte WebGL par thrash de chunks. Correctifs 1.1 et 1.3 (passation) devraient atténuer. À retester. | **P1** | Perte de progression joueur |
| **Retargeting fragile (Mixamo→Meshy)** | 26 ActionId, 250 candidats de noms. `bakeArmatureRotation` peut effondrer le PNJ si armature absente. | Data-driven : déplacer les mapping dans un fichier JSON. Ajouter garde-fou sur `bakeArmatureRotation`. | **P2** | Medium (régression possible) |
| **WeakMap caches sans nettoyage** | `rigBoneCache`, `rigClipCache` (AnimationController), cache retargeting — jamais nettoyés. | Ajouter TTL ou cleanup au changement de map/personnage. | **P3** | Fuite mémoire lente |
| **Pas de Motion Matching** | AnimationMixer avec crossfade seulement. Pas de database de clips, pas de blend space 2D. | Implémenter Motion Matching (phase 2 feuille de route). Le WASM a déjà `AnimationGraph.h` compilé mais inutilisé. | **P3** | Qualité animation limitée |

### 2.2 Mouvement/Physique (CharacterController, collisions, BVH)

| Problème | Cause | Solution | Priorité | Risque |
|----------|-------|----------|----------|--------|
| **Freeze 16,4 s NavMeshBaker** | `bakeNavMeshFromScene()` lancé dans `useEffect([enabled])` de `WasmWorldTicker.tsx`. Rebake intégral à chaque embarquement/débarquement. | (1) Ne rebaker que si scène de collision changée, (2) découper en tranches `await requestAnimationFrame`, (3) cache par map. | **P0** | Bloquant : gameplay bloqué 16 s |
| **CollisionWorld.ts:20 — erreur tsc** | Typage `three-mesh-bvh` manquant ou incompatible avec la version installée. | Corriger l'import ou mettre à jour les types `three-mesh-bvh`. | **P3** | Bloque build TypeScript |
| **Dualité système d'IA (WASM + JS)** | `WasmWorldTicker` tick le monde WASM qui fait tourner l'IA C++, puis `readAICommands()` lit les commandes vers les NPCs JS. Mais les NPCs JS ont AUSSI `NpcController.ts`. Cohabitation sans isolation. | Unifier : choisir WASM ou JS, supprimer l'autre. | **P1** | Régression majeure IA NPC |
| **Pathfinding A* grille limité** | Grille régulière 8-connexe, pas de navmesh polygonal, pas de crowd avoidance, pas de multi-hauteur. | Migrer vers ReCAST-like (navmesh polygonal) — P1 recommandé par équipe Recherche. | **P2** | Limite gameplay mondes ouverts |
| **Double raycast NavMesh (getGroundY + isBlocked)** | Chaque cellule fait deux raycasts → coûteux. | Fusionner en un seul raycast avec test normale. | **P3** | Performance |

### 2.3 Rendu (StreamingPuzzleMap, materials, chunks)

| Problème | Cause | Solution | Priorité | Risque |
|----------|-------|----------|----------|--------|
| **Map invisible au changement de personnage** | Cause non trouvée. 4 hypothèses éliminées (éviction préchargeur, dispose textures terrain, `disposeAutoMaterial` non appelé, `gameReady` non remis). Piste : dans `StreamingPuzzleMap`, `doLoadChunk` n'appelle pas `setLoadedChunks` pendant chargement initial (optimisation Phase 3). | Explorer la piste du commentaire ligne ~889 : sans flush, collision présente mais aucun visuel. Activer `disposeAutoMaterial()` au changement de perso. | **P0** | Joueur bloqué (map invisible) |
| **Micro-freezes résiduels** | Chunks 3,5 à 11,5 s chacun, 794 Mo VRAM cumulés. Rayon de culling sous-estimé par metadata sur 4/8 chunks (écarts 31-86%). | Régénérer les métadonnées de chunks (`generate:assets`). `MAX_CONCURRENT=2` → augmenter à 4-6. | **P2** | Expérience utilisateur dégradée |
| **Coques enveloppantes retirées de la collision** | CORRIGÉ en passation : épaisseur min 1500 ajoutée, diagonale portée à 4000. Forge 0 exclusion, Orbital garde sa vraie coque. | Vérifié passation ; à confirmer en jeu sur toutes les maps. | **P3** (corrigé) | Régression si métadonnées changent |
| **5+ systèmes de streaming redondants** | WASM + ChunkStreaming + AssetBudget + fallback JS + soupape de sécurité. Cohabitation coûteuse. | Unifier : conserver un seul système de streaming. | **P2** | Complexité de maintenance |
| **Global `createImageBitmap` masqué** | Side-effect dans `StreamingPuzzleMap.tsx:758` qui shadow la globale. | Refactorer pour éviter le shadowing. | **P3** | Compatibilité future |
| **Maps OBJ/MTL planétaires non chargées** | `DISABLE_PLANETARY_MAPS = true` dans PreloadService. 6 fichiers OBJ/MTL jamais chargés. `loadPlanetScene()` génère du terrain procédural. | Activer le chargement ou officialiser le terrain procédural et supprimer les références OBJ/MTL. | **P2** | Maps planétaires absentes |

### 2.4 Combat (poings, armes, dégâts)

| Problème | Cause | Solution | Priorité | Risque |
|----------|-------|----------|----------|--------|
| **Catalogue d'armes non nettoyé** | Objets et équipements hors catalogue officiel encore présents. `weaponClassifier.ts` distingue déjà clip/munition/prop/arme. | Utiliser `weaponClassifier.ts` pour filtrer. Le test de comptage (47/48) cassera si filtrage change — c'est voulu. | **P2** | Test à mettre à jour |
| **Bug connu : `statusEffects` modifie l'état NPC pendant itération Map** | `h.applyDamage()` appelé dans la boucle tick de `statusEffects`. | Copier la Map avant itération, ou reporter les modifications. | **P2** | Crash potentiel |
| **Pas de LOS check dans NpcController** | `decideNpcState()` ne vérifie pas la ligne de vue. Le PNJ traverse les murs pour poursuivre. | Ajouter `canSee()` utilisant `CollisionWorld.raycast()` avant chase. | **P2** | Comportement PNJ non réaliste |
| **Inventory.ts : 10 421 lignes** | Fichier monstre, deuxième plus gros du projet. | Refactorer en plusieurs modules (InventoryCore, Equipment, Bags). | **P3** | Risque de régression |
| **Combo punch/kick désynchronisé** | CORRIGÉ : deux tirages randoms indépendants → un seul tirage. | Vérifié en test. | **P3** (corrigé) | — |

### 2.5 IA PNJ (catalogue, placement, animations)

| Problème | Cause | Solution | Priorité | Risque |
|----------|-------|----------|----------|--------|
| **Monstres invisibles (Torus → Tosus)** | CORRIGÉ : packs d'anim FBX→GLB avec Armature pivotée +90° X. `bakeArmatureRotation()` déployé. 7 monstres + réactions hit. | Vérifié numériquement. À confirmer en jeu. | **P2** (corrigé) | — |
| **Crabe Aquarys microscopique** | CORRIGÉ : export Meshy en millimètres (bbox 3,3 mm). `modelScaleMult: 400`. | À long terme : ré-export Meshy à bonne échelle. | **P3** (corrigé) | — |
| **Dualité IA WASM/JS** (cf §2.2) | Doublon : NPC controller JS + WASM actifs simultanément. | Voir §2.2. | **P1** | Comportement erratique |
| **NPC dialog : pas de LLM** | Machine à états uniquement. Pas de dialogue dynamique. | Intégrer transformers.js ou Llama.cpp sidecar. (P1 équipe Recherche) | **P2** | Optionnel (feature) |
| **Pas de génération de dialogue PNJ** | Pas de template, pas de cache. | Phase 2 : ajouter avec Llama.cpp. | **P3** | Optionnel |

### 2.6 Audio

| Problème | Cause | Solution | Priorité | Risque |
|----------|-------|----------|----------|--------|
| **Musique/ambiance inaudible après changement de stage** | CORRIGÉ : `App.stopAll()` tuait le monde au changement de stage (y compris entrée en jeu). Double-hydratation des volumes. | Fix déployé : stopAll seulement hors jeu, hydratation redondante retirée, warning console volume=0. | **P2** (corrigé) | — |
| **Fichiers audio pas dans `public/`** | `soun_effect/` doit être dans `public/` pour accès navigateur. | Déplacer via `Move-Item` ou script npm. | **P3** | Ressources inaccessibles |
| **`playAnnouncement(QUEST_VOICE)` sans vérification** | Appelé sans vérifier que `queteune.mp3` existe. | Ajouter garde-fou `if (exists)` avant play. | **P3** | Console warning |

### 2.7 Quêtes/Économie

| Problème | Cause | Solution | Priorité | Risque |
|----------|-------|----------|----------|--------|
| **Quêtes : pas de système de donjon généré** | Spécification écrite (`docs/superpowers/specs/2026-06-12-p1-2-boss-donjon-furiste-design.md`) mais non implémentée. | Phase 2 roadmap. | **P2** | Manque contenu PvE |
| **Quêtes : pas de mort à enjeu** | Spec écrite (`p1-3-mort-a-enjeu-design.md`) non implémentée. | Phase 2 roadmap. | **P3** | Optionnel |
| **Économie : pas de système de boss** | Spec écrite (`p1-2-boss-donjon-furiste-design.md`) non implémentée. | Phase 2-3. | **P3** | Contenu PvE manquant |

### 2.8 UI/HUD

| Problème | Cause | Solution | Priorité | Risque |
|----------|-------|----------|----------|--------|
| **HUD actuel basique** | `StatsHUD.tsx` simple. Spec HUD par faction écrite (`SPECIFICATIONS_HUD_SYSTEM.md`, 1074 lignes) mais non implémentée. | Implémenter NewHUD avec codes couleurs faction (Akarlys/Zayan/Mezalayis), barres santé/armure, affichage armes, minimap. | **P2** | Feature (non bloquant) |
| **Minimap canvas 2D 10 Hz** | Basse fréquence. | Passer à 30-60 Hz ou utiliser un render target Three.js. | **P3** | Qualité de vie |
| **AnimDebugHud non documenté** | Outil debug présent mais sans doc. | Documenter ou supprimer. | **P3** | Maintenabilité |

### 2.9 Réseau/Multi

| Problème | Cause | Solution | Priorité | Risque |
|----------|-------|----------|----------|--------|
| **Aucun système réseau implémenté** | Le moteur est monojoueur uniquement. Pas de serveur, pas de synchronisation. | Architecture réseau à concevoir (phase long terme). Contrainte FPS/TPS synchro déjà documentée pour le multijoueur futur. | **P3** | Impact fondamental (jeu MMO sans réseau) |

### 2.10 Electron

| Problème | Cause | Solution | Priorité | Risque |
|----------|-------|----------|----------|--------|
| **CSP sans `unsafe-eval`** | CORRIGÉ : `wasm-unsafe-eval` pour Draco/Basis, origines locales seulement. | Vérifié dans `electron/main.ts`. | **P3** (corrigé) | — |
| **`ERR_CACHE_OPERATION_NOT_SUPPORTED` pour mp4** | Cache HTTP Chromium ≠ requêtes RANGE des vidéos du dev-server. CORRIGÉ : `disable-http-cache` en DEV uniquement. | Vérifié. Prod file:// non affectée. | **P3** (corrigé) | — |
| **WebGL Context Lost** | Traité (dispose VRAM réel, chunks 256px, vaisseaux compressés, StrictMode retiré, purge THREE.Cache). | À re-vérifier après modifications. | **P2** | Crash navigateur/Electron |

---

## 3. ROADMAP

### Court terme (1-2 jours)

| # | Action | Sous-système | Dépend de |
|---|--------|-------------|-----------|
| 1 | 🚨 **Corriger le freeze NavMeshBaker (16,4 s)** — découpage + cache par map | Mouvement | — |
| 2 | 🚨 **Diagnostiquer la map invisible** — piste `setLoadedChunks` dans `doLoadChunk` | Rendu | — |
| 3 | 🚨 **Appeler `disposeAutoMaterial()`** au changement de personnage | Rendu | #2 |
| 4 | Exécuter `__narvosNpcDiag()` sur les monstres invisibles | Animation/NPC | — |
| 5 | Ajouter spawn Orbital dans `mapConfig.ts` (coords ~700, 5, 0) | Monde | — |
| 6 | Régénérer métadonnées chunks (`npm run generate:assets`) | Rendu | — |
| 7 | Valider murs invisibles sur toutes les maps | Monde | — |
| 8 | Nettoyer catalogue d'armes via `weaponClassifier.ts` | Combat | — |

### Moyen terme (1-2 semaines)

| # | Action | Priorité | Effort estimé |
|---|--------|----------|--------------|
| 1 | **Refactorer RpgGameWorld.tsx** (3984 lignes → modules) | P1 | 3-5 jours |
| 2 | **Unifier le système d'IA NPC** (WASM ou JS, pas les deux) | P1 | 2-3 jours |
| 3 | **Corriger Valkiria** : offset yaw par avatar | P2 | 1 jour |
| 4 | **Implémenter Vue FPS complète** : bras + armes + synchro TPS | P1 | 5-7 jours |
| 5 | **Ajouter WebGPU compute terrain** via `@react-three/webgpu` | P2 | 2-3 jours |
| 6 | **Implémenter NewHUD** par faction (spec 1074 lignes) | P2 | 3-4 jours |
| 7 | **Ajouter LOS check dans NpcController** | P2 | 1 jour |
| 8 | **Intégrer meshoptimizer** dans pipeline GLB | P2 | 1-2 jours |
| 9 | **Activer AnimationGraph WASM** existant | P2 | 2 jours |
| 10 | **Ajouter tests d'intégration** pour WASM→JS bridges | P2 | 2-3 jours |

### Long terme (1-3 mois)

| # | Action | Priorité | Effort estimé |
|---|--------|----------|--------------|
| 1 | **Refactor Inventory.ts** (10 421 lignes) | P2 | 3-5 jours |
| 2 | **Migrer A* → ReCAST navmesh polygonal** | P2 | 3-4 sem |
| 3 | **Implémenter Motion Matching** complet | P2 | 4-6 sem |
| 4 | **Intégrer Llama.cpp sidecar** pour dialogues PNJ | P2 | 2-3 sem |
| 5 | **HLOD streaming manager** | P3 | 2-3 sem |
| 6 | **RVO2/ORCA crowd avoidance** | P3 | 1-2 sem |
| 7 | **Architecture réseau multijoueur** | P3 | 4-8 sem |
| 8 | **Système de donjon généré** (spec existante) | P2 | 2-3 sem |
| 9 | **Système de boss** (spec existante) | P3 | 2 sem |
| 10 | **Générer les types WASM automatiquement** depuis C++ | P2 | 1 sem |
| 11 | **Blender addon export GLB optimisé** | P2 | 1-2 sem |
| 12 | **Planet maps OBJ/MTL** : charger ou officialiser le procédural | P2 | 1 sem |
| 13 | **WebGPU compute shaders** avancés (occlusion culling, particles) | P3 | 3-4 sem |
| 14 | **Remplacer WebGL par WebGPU** (quand Three.js support stable) | P4 | 1-2 mois |

---

## 4. MÉTRIQUES

### Fichiers

| Catégorie | Comptage | Notes |
|-----------|----------|-------|
| Fichiers source `.ts` | ~250+ | src/rpg/ couvre 20+ sous-systèmes |
| Fichiers `.tsx` (composants React) | ~149 | Composants jeu, UI, éditeurs, forge |
| Fichiers de test `.test.ts` | 93 | Tests unitaires Vitest |
| Scripts pipeline `.mjs` | ~20 | Asset catalog, KTX2, chunks, conversion |
| Docs `.md` | ~30 | Docs projet + specs + rapports |
| **Total fichiers TypeScript/TSX** | **~350+** | Code source du jeu |
| Plus gros fichier | 3 984 lignes | `RpgGameWorld.tsx` |
| 2e plus gros | 1 027 lignes | `StreamingPuzzleMap.tsx` |
| 3e plus gros | 922 lignes | `AnimationController.ts` |

### Tests

| Métrique | Valeur | Source |
|----------|--------|--------|
| Tests passants | **709** | PASSATION (état dépôt) |
| Fichiers de test | **93** | scan src/ |
| Tests système clé | locomotionBlend (~5953 lignes de test) | Le mieux testé |
| Tests manquants | StreamingPuzzleMap, RpgGameWorld, WASM bridges, AnimationController (intégration) | Analyse moteur |
| Coverage scripts pipeline | ktx2-encode.test.mjs | Un seul test .mjs |
| Vitest config | `environment: 'node'`, globals: false | Modules purs |

### Bugs connus

| Gravité | Nombre | Détails |
|---------|--------|---------|
| **P0 — Bloquant** | 2 | Freeze 16,4 s map invisible changement perso |
| **P1 — Critique** | 4 | Crash accroupi+strafe, Vue FPS manquante, RpgGameWorld monolithique, dualité IA WASM/JS |
| **P2 — Majeur** | 10+ | Valkiria inversée, pas de LOS check NPC, WeakMap caches, streaming redondant, maps OBJ/MTL, quêtes donjon/boss non implémentées, HUD basique, WebGL Context Lost |
| **P3 — Mineur** | 8+ | Erreur tsc (1), Inventory.ts monstre, AudioManager vérification mp3, `createImageBitmap` shadow, micromaps/minimap, etc. |
| **CORRIGÉS en passation** | 8+ | Sol raycaster.far, filet anti-chute, coques enveloppantes, troopers sans texture, monstre invisible (Tosus), crabe microscopique, audio inaudible, CSP/Cache Electron |
| **CORRIGÉS sessions antérieures** | 8 | Murs traversables, bandes noires, crash WebGL mat, map invisible WASM, arme FPS invisible, combo punch/kick, perte collision Forge OOM chunk |

### Dette technique

| Problème | Gravité | Fichiers concernés |
|----------|---------|-------------------|
| `RpgGameWorld.tsx` monolithique 3984 lignes | 🔴 Critique | runtime/RpgGameWorld.tsx |
| Dualité AI WASM + JS | 🔴 Critique | wasm/AICommandSync.ts + npc/NpcController.ts |
| Pas de typage WASM auto (déclarations manuelles) | 🔴 Critique | wasm/WasmBridge.ts |
| `Inventory.ts` 10 421 lignes | 🟠 Élevé | loot/Inventory.ts |
| 5+ systèmes de streaming redondants | 🟠 Élevé | StreamingPuzzleMap, WasmStreaming, AssetBudget, fallback |
| WeakMap caches sans cleanup | 🟡 Moyen | mixamoRetarget.ts, AnimationController.ts |
| Chemins assets dupliqués (npcCatalog + avatarAssets) | 🟡 Moyen | npc/npcCatalog.ts, characters/avatarAssets.ts |
| `createImageBitmap` global shadowed | 🟡 Moyen | StreamingPuzzleMap.tsx:758 |
| `// eslint-disable-next-line` abondantes | 🟢 Faible | Multiples fichiers |
| `MAX_CONCURRENT=2` limité | 🟢 Faible | StreamingPuzzleMap.tsx |
| `HumanCharacter` legacy (Sorcier) — à supprimer | 🟢 Faible | characters/HumanCharacter.tsx |
| Fichiers `.bak` dans le dépôt | 🟢 Faible | 3 fichiers |

### Autres métriques

| Métrique | Valeur |
|----------|--------|
| Version TypeScript | ~5.8.2 |
| Version Three.js | 0.181.2 |
| Version React | 19.2.0 |
| Version Electron | 39.2.6 |
| Version Vite | 6.2.0 |
| Version Vitest | 2.1.9 |
| Fonctions WASM exportées | 55+ |
| Taille max VRAM chunks | 794 Mo cumulés |
| Temps bake navmesh max | 16,4 s (204×197 grille, 2988/40188 walkable) |
| NPC catalog entries | ~55 |
| Loot items | ~53 |
| Armes montables | ~48 (avant nettoyage catalogue) |
| Entrées ActionId animation | 26 (~250 candidats de noms) |
| Maps | Forge (chunkée), Orbital, orbital (monolithique) + donjon |
| Build targets | Windows (NSIS), Mac (DMG), Linux (AppImage/deb) |

---

## 5. ANNEXE : SOUS-SYSTÈMES ET RESPONSABLES TECHNIQUES

| Domaine | Expert identifié | Fichier clé |
|---------|-----------------|-------------|
| Architecture générale | Analyse moteur | NARVOS_ENGINE_ANALYSIS_RAPPORT.md |
| Rendu / Streaming | Passation (§3.7) | StreamingPuzzleMap.tsx |
| Collision / Physique | Passation (§1.1–1.3) | CollisionWorld.ts, CharacterController.ts |
| Animation / Retargeting | Passation (§3.2–3.3) | AnimationController.ts, mixamoRetarget.ts |
| NPC / IA | Recherche (§6) | NpcController.ts, npcCatalog.ts |
| Combat / Armes | Recherche (§4) | unarmedCombat.ts, weaponCatalog.ts |
| Audio | Rapport corrections 2026-06-12 | audioEventManager.ts |
| Quêtes / Économie | Analyse moteur (§12) | questStore.ts, questCatalog.ts |
| UI / HUD | Spécifications HUD | SPECIFICATIONS_HUD_SYSTEM.md |
| Electron / Empaquetage | package.json | electron/main.ts |
| Pipeline assets | Scripts npm | scripts/*.mjs |

---

*Rapport consolidé par l'Équipe FUSION (5-10 agents) le 29 juillet 2026.*  
*Sources : PASSATION_2026-07-29.md · NARVOS_ENGINE_ANALYSIS_RAPPORT.md · recherche-ameliorations.md · rapport-corrections-2026-06-12.md + code source complet*