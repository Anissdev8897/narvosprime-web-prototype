# 🔍 RAPPORT D'ANALYSE MOTEUR — Narvos Prime Engine

**Date :** 29 juillet 2026  
**Périmètre :** WebPortal/src/rpg/ — Moteur de jeu complet  
**Systèmes analysés :** 11 (Runtime, Characters, Animation, WASM, NPC, Weapons, Combat, Camera, Audio, Quests, Loot, Professions)

---

## TABLE DES MATIÈRES

1. [Résumé Exécutif](#1-résumé-exécutif)
2. [Architecture Générale](#2-architecture-générale)
3. [Sous-Système : Runtime / Monde](#3-sous-système--runtime--monde)
4. [Sous-Système : Characters](#4-sous-système--characters)
5. [Sous-Système : Animation](#5-sous-système--animation)
6. [Sous-Système : WASM / Bridge Natif](#6-sous-système--wasm--bridge-natif)
7. [Sous-Système : NPC](#7-sous-système--npc)
8. [Sous-Système : Weapons](#8-sous-système--weapons)
9. [Sous-Système : Combat](#9-sous-système--combat)
10. [Sous-Système : Camera](#10-sous-système--camera)
11. [Sous-Système : Audio](#11-sous-système--audio)
12. [Sous-Système : Quests](#12-sous-système--quests)
13. [Sous-Système : Loot / Inventory](#13-sous-système--loot--inventory)
14. [Sous-Système : Professions](#14-sous-système--professions)
15. [Dette Technique Transversale](#15-dette-technique-transversale)
16. [Recommandations](#16-recommandations)

---

## 1. Résumé Exécutif

Le moteur de Narvos Prime est une architecture **hybride WASM + Three.js/React-Three-Fiber (R3F)** avec une forte séparation singletons purs + composants React. Il combine :

- **Un rendu 3D web** via R3F/Three.js avec streaming de chunks spatial
- **Un moteur physique/collision/AI natif** compilé en WASM (Emscripten, module `narvos-engine.js`)
- **Un système d'animation** basé sur `AnimationController` wrapper de `THREE.AnimationMixer` avec retargeting cross-skeleton
- **Une architecture data-driven** : catalogues (NPC, armes, quêtes, loot, professions) en constantes TypeScript

**Forces :** Documentation inline exhaustive en français, tests unitaires nombreux (jest), patterns singletons cohérents, résilience aux erreurs (fallbacks OOM, soupapes de sécurité, limites de VRAM).

**Faiblesses :** RpgGameWorld.tsx monolithique (3984 lignes), 4 systèmes de streaming redondants (WASM + Budget + JS fallback), dualité NPC controller (JS/C++), pas de typage fort WASM→JS, dépendances circulaires potentielles.

---

## 2. Architecture Générale

### 2.1 Structure des dossiers

```
src/rpg/
├── runtime/        # Monde 3D, collision, streaming, HUD, éditeur, donjon
├── characters/     # Joueur (OwnAnimPlayer, HumanCharacter, Modular)
├── animation/      # Contrôleur, retargeting, locomotion blend, émotes
├── wasm/           # Bridge WASM (collision, AI, streaming, navmesh)
├── npc/            # Catalogue, IA, placement, respawn, registre
├── weapons/        # Catalogue, shop, animation, offset, viewmodel
├── combat/         # Ammo, combos, dégâts, statuts, effets
├── camera/         # Store vue caméra, recoil, profils
├── audio/          # Gestionnaire événements audio, killstreak, annonces
├── quests/         # Store quêtes, catalogue, journal
├── loot/           # Registre butin, inventaire, coffres, butin procédural
├── professions/    # Métiers (bûcheronnage, forge, récolte), craft
├── spells/         # Sorts, zones AoE, VFX
├── archetypes/     # Archétypes de classe, sorts
├── stats/          # Statistiques joueur, progression
├── types/          # Types partagés
├── classes/        # Définitions de classes
├── elements/       # Éléments
├── factions/       # Système de factions
├── persistence/    # Base de données (IndexedDB) et localStorage
├── loaders/        # Asset loaders (GLTF, KTX2, qualité)
├── materials/      # Matériaux paysage, auto-material
├── ui/             # Composants UI (HUD, barres, panneaux)
├── mapgen/         # Génération procédurale de map
├── forge/          # Éditeur Forge
├── world/          # État monde
├── settings/       # Paramètres jeu
└── utils/          # Utilitaires (AudioManager, color, etc.)
```

### 2.2 Pattern Singleton dominant

La majorité des systèmes critiques suivent le pattern **singleton hors-React + hook `useSyncExternalStore`** :

- `collisionWorld` (CollisionWorld.ts)
- `gameModeStore` (gameModeStore.ts)
- `spawnPointStore` (spawnPointStore.ts)
- `ammoStore` (ammoStore.ts)
- `damageEvents` (damageEvents.ts)
- `statusEffects` (statusEffects.ts)
- `npcRegistry` (npcRegistry.ts)
- `questStore` (questStore.ts)
- `professionStore` (professionStore.ts)
- `cameraViewStore` (cameraViewStore.ts)
- `wasmWorldCoordinator` (WasmWorldCoordinator.ts)
- `audioEvents` (audioEventManager.ts)
- `cooldownStore` (cooldownStore.ts)
- `respawnManager` (respawnManager.ts)

### 2.3 Points d'entrée majeurs

- **RpgGameWorld.tsx** (3984 lignes) : Composant monolithique qui assemble tout — Canvas R3F, joueur, caméra, NPC, HUD, véhicules, donjon, sorts
- **StreamingPuzzleMap.tsx** (1027 lignes) : Chargement chunké avec gestion mémoire, BVH, textures GPU, fallbacks
- **WasmWorldTicker.tsx** : Boucle WASM par frame (tick, AI, dégâts, budget, navmesh)
- **AnimationController.ts** (922 lignes) : Wrapper AnimationMixer avec résolution par nom, crossfade, overlays

---

## 3. Sous-Système : Runtime / Monde

### 3.1 CollisionWorld (runtime/CollisionWorld.ts)
- **Rôle :** Système de collision hybride WASM + Three.js BVH
- **Singleton :** `export const collisionWorld`
- **Dépendances :** `wasm/WasmBridge`, `wasm/PhysicsSync`, `three-mesh-bvh`
- **Mécanique :**
  - `isBlocked()` : WASM broadphase (AABB) sinon Three.js raycast
  - `getGroundY()` : Toujours Three.js BVH (précision normale)
  - `registerScene()` / `add()` / `remove()` : Dual-register
- **Risques :**
  - `wasmActive` dépend de `isEngineLoaded()` — un appel avant init renvoie false sans erreur
  - `sceneRoot()` nullable si `colliders[0]` absent
- **Dette :** Hardcodage `_wasmColliderSeq = 90000` comme seed

### 3.2 StreamingPuzzleMap (runtime/StreamingPuzzleMap.tsx)
- **Rôle :** Chargement chunké de la map avec streaming spatial WASM
- **Taille :** 1027 lignes, plus gros composant après RpgGameWorld
- **Mécanique :**
  - Loader GLTF avec cache IndexedDB + fallback qualité dégradée sur OOM
  - Frustum culling par chunk avec sphère englobante calculée sur géométrie réelle
  - Auto-material paysage (remplacement des bakes par carrelage monde)
  - Coques envelopantes exclues de la collision
  - Upload GPU des textures par lots (max 2048px, KTX2 aware)
- **Bugs corrigés (commentés) :**
  - `GROUND_SEARCH_DEPTH` fixe au lieu de formule `fromHeight+60` → Forge à Y=-401 invisible
  - Budget VRAM 600 Mo → 3600 Mo (chunks KTX2 à ~396 Mo pièce)
  - `requestIdleCallback` pour `disposeStaleAutoMaterials` (appel synchrone → crash WebGL natif)
  - Rayon de culling sous-estimé par metadata → bandes noires
  - Colliders non retirés au déchargement → murs traversables
  - Soupape de sécurité 90s pour éviter blocage écran de chargement
- **Dette :**
  - Parse GLTF avec `createImageBitmap` masqué globalement (side-effect)
  - File d'attente de chargement limitée à MAX_CONCURRENT=2
  - Logique de reveal différente WASM vs fallback (essentialSet vs allDone)

### 3.3 RpgGameWorld (runtime/RpgGameWorld.tsx)
- **Rôle :** Point d'entrée du monde de jeu. Assemble TOUT.
- **Taille :** **3984 lignes** — le plus gros fichier du projet
- **Dépendances :** ~200 imports de 40+ sous-systèmes
- **Risques :**
  - Monolithe extrême : toucher un import = risque de régression global
  - Pas de découpage en hooks/contexts réutilisables
  - La logique de voyage spatial, combat, HUD, véhicules, donjon est TOUTE ici
- **Dette :** Refactor nécessaire en plusieurs fichiers (GameScene, CombatManager, TravelController...)

### 3.4 Map / Spawn
- `mapConfig.ts` : Points de spawn statiques (forge=[0,5,10], donjon_furiste=[0,6,34], orbital=[1000,50,0])
- `spawnPointStore.ts` : Override éditeur persisté (localStorage + IndexedDB)
- `gameModeStore.ts` : Mode normal/edit avec hook réactif `useEditMode()`

---

## 4. Sous-Système : Characters

### 4.1 OwnAnimPlayerCharacter (characters/OwnAnimPlayerCharacter.tsx)
- **Rôle :** Joueur à rig propre avec animations embarquées (Paragon/Wraith/Ninja/RobotGirl)
- **Taille :** 698 lignes
- **Dépendances :** AnimationController, avatarAssets, WeaponSocket, statusEffects, locomotionBlend, emoteStore
- **Mécanique :**
  - Normalisation par bounding-box à TARGET_HEIGHT=1.8m
  - Masquage inconditionnel des armes intégrées (setBuiltinWeaponVisible)
  - Packs de classe pour rigs compatibles (sharedRig)
  - Émotes + variantes idle asynchrones
  - Blend accroupi via offset de pelvis dédié (CROUCH_PELVIS_DROP=0.373)
- **Risques :**
  - `useCharacterScale()` change l'échelle du mesh mais pas collision/caméra → désync possible
  - Le clone `SkeletonUtils.clone(scene)` replique tout le sous-arbre à chaque montage

### 4.2 HumanCharacter (characters/HumanCharacter.tsx)
- **Rôle :** Modèle Sorcier Mixamo rig statique (FBX anim = mesh + rig)
- **Taille :** 508 lignes
- **Spécificité :** Sorcier legacy — fichiers supprimés, remplacé par OwnAnimPlayerCharacter
- **Dette :** Backup `baseScaleCache` (WeakMap-like mais Map string → uuid) — pas de purge

### 4.3 avatarAssets (characters/avatarAssets.ts)
- **Rôle :** Source unique des chemins GLB pour tous les avatars
- **Contenu :** Wraith (5 skins), Murdock (6 skins), Rampage (3 skins), WRAITH_ANIMS, BULLET_LOCOMOTION, UTA_LOCOMOTION, CROUCH_LOCOMOTION, UTA_TRAVERSAL
- **Complexité :** 3 squelettes différents (Mixamo/Meshy, UE4/Paragon, UTA) avec conventions d'axes différentes
- **YAW_OFFSET :** Mixamo/Meshy = Math.PI, UE Mannequin = Math.PI/2

---

## 5. Sous-Système : Animation

### 5.1 AnimationController (animation/AnimationController.ts)
- **Rôle :** Wrapper principal de THREE.AnimationMixer
- **Taille :** 922 lignes
- **Dépendances :** mixamoRetarget, boneMask, animClipStore, animEvents
- **Mécanique :**
  - Résolution par nom de clip via CLIP_CANDIDATES (fallback multi-noms 26 actions)
  - Crossfade fluide avec retour auto des one-shots
  - Overlays upper-body pour combat (stripLowerBodyTracks)
  - Clip additif procédural de crouch (createCrouchClip)
  - Re-mapping universel de squelettes (remapClipsToRig → WeakMap cache)
  - Dispatch d'AnimEvents frame-exact (recoil, futurs SFX/VFX)
- **Risques :**
  - 26 entrées ActionId avec ~250 candidats de noms — fragilité si nouveau nom de clip
  - `ONE_SHOT` set ne correspond à `OVERLAY_ELIGIBLE` que partiellement
- **Dette :** WeakMap cache (`rigBoneCache`, `rigClipCache`) jamais nettoyé explicitement

### 5.2 mixamoRetarget (animation/mixamoRetarget.ts)
- **Rôle :** Retargeting Mixamo→Meshy (préfixe `mixamorig:`) + UE4/Paragon
- **SKELETON_ALIASES :** 58 paires d'os (Meshy↔UE4)
- **Fonctions :** stripMixamoPrefix, dropScaleTracks, bakeArmatureRotation, remapClipsToRig
- **Risques :** `bakeArmatureRotation` applique armQuat aux pistes hips — si armature absente ou nulle, le PNJ s'effondre

### 5.3 locomotionBlend (animation/locomotionBlend.ts)
- **Rôle :** Blend space directionnel 8 directions (pur, sans Three.js)
- **Mécanique :** `solveLocomotion()` → gait/idle/run + blendWeights + timeScale
- **Tests :** ~5953 lignes de tests — un des systèmes les mieux testés
- **Qualité :** Hystérésis directionnelle (empêche clignotement aux frontières)

---

## 6. Sous-Système : WASM / Bridge Natif

### 6.1 WasmBridge (wasm/WasmBridge.ts)
- **Rôle :** Charge et expose le module WASM NarvosEngine
- **Singleton :** `wasmModule` + `loadPromise`
- **Mécanique :** Script tag + factory globale (Emscripten MODULARIZE)
- **Interface :** 55+ fonctions exportées (ECS, collision, BVH, véhicule, statuts, animation, streaming, budget, navmesh)
- **Risques :**
  - `NarvosWasmModule` est un type partiel déclaré à la main — pas de génération .d.ts depuis C++
  - Échec silencieux si `locateFile` ne trouve pas les fichiers .wasm
  - Pas de mécanisme de retry si le script tag échoue
- **Dette :** Aucune vérification runtime que les fonctions WASM sont callables avant appel

### 6.2 NavMeshBaker (wasm/NavMeshBaker.ts)
- **Rôle :** Échantillonne la CollisionWorld pour construire un navmesh A* dans WASM
- **Mécanique :** Grille régulière, cache par empreinte (fingerprint de scène)
- **Limites :** MAX_CELLS = 40 000 (évite 357s de bake — mesuré)
- **Bug corrigé :** Cache hit évite re-raycast complet après remontage (changement de perso)
- **Risques :** Double raycast par cellule (getGroundY + isBlocked) → coûteux

### 6.3 Autres bridges WASM
- **WasmWorldCoordinator.ts :** init/tick/reset du monde WASM (timeScale, tickCount)
- **WasmWorldTicker.tsx :** Boucle R3F → sync position → tick → drain dégâts → AI commands → status effects → asset budget
- **WasmNpcBridge.ts :** Enregistrement NPC WASM, dispatch AI commands
- **AICommandSync.ts :** Lecture des commandes AI WASM
- **DamageEventSync.ts :** Drain des événements dégâts WASM
- **StatusEffectSync.ts :** Pull des statuts WASM → JS
- **ChunkStreamingBridge.ts :** Streaming spatial via WASM
- **AssetBudgetBridge.ts :** Budget VRAM géré par WASM
- **NavMeshBridge.ts :** Pont bas niveau A* WASM
- **AnimationBridge.ts :** Pont animation WASM (squelettes, clips, blend graph)
- **TriggerBridge.ts :** Zones de trigger WASM
- **PhysicsSync.ts :** Sync collision WASM

### 6.4 Problème architectural majeur
**Dualité AI NPC :** `WasmWorldTicker` tick le monde WASM (`wasmWorldCoordinator.tick(dt)`) qui fait tourner l'AI C++, puis `readAICommands()` lit les commandes et les dispatche via `wasmNpcBridge.dispatchCommands()` vers les NPCs JS. Mais les NPCs JS ont AUSSI leur propre IA dans `NpcController.ts`. Les deux systèmes cohabitent sans isolation claire — un NPC peut recevoir des ordres des deux côtés.

---

## 7. Sous-Système : NPC

### 7.1 Npc.tsx
- **Rôle :** PNJ animé + IA combat + lancer de sorts
- **Taille :** 660 lignes
- **Dépendances :** AnimationController, NpcController, npcCatalog, spellCatalog, CollisionWorld, npcRegistry, respawnManager, wasmNpcBridge
- **Mécanique :**
  - Charge GLB Meshy + clips partagés `soldat_humain` (source canonique)
  - Hiérarchie de résolution des clips : ownAnims > packClips > refAnims > ownAnims (fallback)
  - Réactions universelles (REACTIONS_PACK) ajoutées au set
  - Loot déposé à la mort (LootRegistry roll)
  - Barre de vie billboard + label niveau

### 7.2 NpcController (npc/NpcController.ts)
- **Rôle :** Machine à états IA PUR (idle → chase → attack → dead)
- **Taille :** 156 lignes, bien factorisé
- **Mécanique :** `decideNpcState()` avec hystérésis (leash, attackKeep, giveUpTime)
- **Risques :** Aucune dépendance au LOS (canSee) pour la poursuite — le PNJ traverse les murs si le joueur est à portée mais hors vue

### 7.3 npcCatalog (npc/npcCatalog.ts)
- **Rôle :** Catalogue data-driven de ~55 entrées NPC
- **Types de PNJ :** Soldats, ennemis, monstres de donjon, personnages Paragon, zombies, Rampage
- **Dette :** Les chemins `modelPath` sont dupliqués entre catalog et avatarAssets

### 7.4 npcRegistry (npc/npcRegistry.ts)
- **Rôle :** Registre runtime avec broadphase grille uniforme XZ (CELL=4)
- **Singleton :** `npcRegistry`
- **Fonctions :** forEachEnemyInRadius, findAimedEnemy, lootableCorpsesInRadius
- **Qualité :** Zéro allocation par requête (callbacks), grille 2D pour requêtes spatiales rapides

### 7.5 respawnManager (npc/respawnManager.ts)
- **Rôle :** Cycle de réapparition des PNJ placés par admin
- **Mécanique :** Anti-camping (8m), epoch pour clé React, tick ~1x/s

---

## 8. Sous-Système : Weapons

### 8.1 weaponCatalog.ts
- **Rôle :** Inventaire data-driven des armes (WEAPON_ROOT + ARMES_ROOT)
- **~50 fichiers** classés automatiquement par weaponClassifier
- **Fonctions :** buildEntries, catalogProfiles, weaponsByAnimPack

### 8.2 weaponClassifier.ts
- **Rôle :** Classification par regex sur le nom de fichier
- **14 WeaponType** avec métadonnées associées (animPackFolder, grip, socket)
- **Règles ordonnées** : clip > throwable > ammo > ignore > shield > bow > staff > gun > sword_2h > dagger > axe > blunt > spear > sword_1h
- **Dette :** Règles fragiles (dépendent des conventions de nommage marketplace)
- **Bug connu commenté :** `AS_` regex trop large attrapait `as-vulcan_scarlet_lance` → corrigé avec casse stricte

### 8.3 weaponShop.ts
- **Rôle :** Prix, rareté, icônes par type d'arme
- **Prix :** base × catégorie (dagger=60, sword_2h=250, gun=220)

### 8.4 Autres fichiers armes
- `weaponAnimClips.ts` (252 lignes) : Clips FPS par famille (grenade, revolver, shotgun_double/pompe/semi)
- `WeaponSocket.tsx` (293 lignes) : Attachement d'arme aux os du rig
- `FpsWeaponViewmodel.tsx` (209 lignes) : Viewmodel FPS première personne
- `weaponAnimationBinder.ts` : Binding animation weapon
- `weaponCalibrationStore.ts`, `weaponOffsetStore.ts`, `weaponEditorStore.ts` : Stores de calibration
- `weaponBob.ts`, `weaponSway.ts` : Effets de mouvement d'arme

---

## 9. Sous-Système : Combat

### 9.1 ammoStore.ts
- **Rôle :** Réserve de munitions (arrows, cells)
- **Pattern :** Mutation directe + localStorage persist
- **Qualité :** `consume()` atomique (vérifie puis décrémente)

### 9.2 unarmedCombat.ts
- **Rôle :** Machine d'état combo mains nues (3 steps + finisher varié)
- **COMBO_WINDOW_MS = 600ms, CHARGE_MS = 350ms**
- **Bug connu :** Strike et action dérivés du même tirage (pas deux randoms indépendants — corrigé)

### 9.3 statusEffects.ts
- **Rôle :** Moteur de statuts (burn, root, stun, invisibilité)
- **Singleton :** `statusEffects`
- **Mécanique :** tick(dt) central avec BURN_TICK=0.5s, souscription React via useSyncExternalStore
- **Risques :** `h.applyDamage()` appelé dans la boucle tick — modifie l'état NPC pendant l'itération Map

### 9.4 Autres combat
- `damageEvents.ts` : Ring-buffer de dégâts (MAX_QUEUE=64)
- `cooldownStore.ts` : Cooldowns globaux
- `expeditionLedger.ts` : Registre d'expédition
- `spellDamage.ts` : Dégâts de sorts
- `npcHitReact.ts` : Réactions NPC aux coups
- `unarmedStrikes.ts` : Catalogue de frappes
- `rollDamage.ts` : Calcul degâts

---

## 10. Sous-Système : Camera

### 10.1 cameraViewStore.ts
- **Rôle :** Miroir réactif de la vue caméra (FPS/TPS)
- **Pattern :** Store avec garde-fou (no-op si unchanged) car appelé 60x/s depuis useFrame
- **Bug connu :** La vue vit dans `camState` (useRef) — muter un ref ne notifie pas React → l'arme FPS n'apparaissait pas au toggle F1

### 10.2 CameraRecoilController.ts
- **Rôle :** Recul de caméra au tir
- **Taille :** ~80 lignes
- **Dépendances :** recoilProfiles.ts, recoilDispatcher.ts

### 10.3 Autres camera
- `RecoilAdminPanel.tsx` : Interface admin pour éditer les profils de recul
- `ICameraShakeable.ts` : Interface de secouement caméra
- `ease.ts` : Fonctions d'easing

---

## 11. Sous-Système : Audio

### 11.1 audioEventManager.ts
- **Rôle :** Façade singleton des événements audio gameplay
- **Composants :** KillStreakAudioSystem, AreaAnnouncementSystem, BossWarningAudioSystem
- **Points d'entrée :** registerKill(), bossEngaged(), enterMap(), questAccepted(), tick(dt), reset()

### 11.2 Sous-systèmes audio
- `killStreakAudio.ts` : Séries de kills (double/triple/.../massacre)
- `areaAnnouncements.ts` : Annonces d'entrée de zone
- `bossWarningAudio.ts` : Alerte boss
- `KillStreakHud.tsx` : Affichage toast des paliers
- `AudioManager.ts` (dans `../../utils/AudioManager`) : Gestionnaire audio bas niveau (non analysé)

### 11.3 Risques
- `playAnnouncement(QUEST_VOICE)` appelé sans vérifier que le fichier `queteune.mp3` existe

---

## 12. Sous-Système : Quests

### 12.1 questStore.ts
- **Rôle :** État runtime des quêtes (singleton, persistance par personnage)
- **Modèle :** Auto-complétion (objectifs tous remplis → completed)
- **Types d'objectifs :** kill, reach, collect
- **Persistance :** localStorage + IndexedDB (character_state)
- **Sécurité :** `sanitize()` filtre les quêtes inconnues (catalogue modifié)

### 12.2 questCatalog.ts
- **Rôle :** Définitions des quêtes
- **Structure :** id, label, description, objectives[], rewards, requires, mapId

---

## 13. Sous-Système : Loot / Inventory

### 13.1 LootRegistry.ts
- **Rôle :** Catalogue de butin + génération pondérée par zone
- **Taille :** 252 lignes
- **Contenu :** Potions, clés donjon, munitions, clés véhicules, invocations pets, ressources, équipement → **~53 items**
- **Zones :** spore, space, forge (avec poids distincts)
- **rollLoot() :** 50% procédural, 50% catalogue zone + chance bonus rareté

### 13.2 Inventory.ts
- **Rôle :** Système d'inventaire (création, ajout, équipement)
- **Taille :** 10421 lignes (gros fichier)

### 13.3 Autres loot
- `chestRegistry.ts` : Registre des coffres
- `chestCatalog.ts` : Catalogue des coffres
- `proceduralLoot.ts` : Génération procédurale d'items
- `bags.ts` : Système de poids/sacs
- `consumableSlots.ts` : Slots de consommables
- `gear.ts` : Équipement

---

## 14. Sous-Système : Professions

### 14.1 professionStore.ts
- **Rôle :** État runtime des métiers (singleton, persistance par personnage)
- **Contenu :** Niveaux (1→50), XP, endurance partagée (STAMINA_MAX=100, REGEN=6/s), sac de ressources
- **Fonctions :** addXp, craft, spendStamina, regen, addResource
- **Craft :** Atomique (vérifie niveau + ressources avant consommation)

### 14.2 professionCatalog.ts
- **Rôle :** Définitions des métiers et recettes de craft
- **Taille :** 316 lignes

### 14.3 HarvestNode.tsx
- **Rôle :** Nœud de récolte (bûcheronnage, minage, cueillette)

### 14.4 Autres professions
- `HarvestNodeAdminPanel.tsx` : Panneau admin
- `GatherMiniGame.tsx` : Mini-jeu de récolte
- `ForgeMiniGame.tsx` : Mini-jeu de forge
- `CraftingPanel.tsx` : Interface de craft
- `BucheronAxeViewmodel.tsx` : Viewmodel hache bûcheron
- `harvestModelCatalog.ts` : Catalogues des modèles de récolte

---

## 15. Dette Technique Transversale

### 15.1 Code Quality
| Problème | Fichiers | Gravité |
|---------|----------|---------|
| `RpgGameWorld.tsx` monolithique (3984 lignes, 200+ imports) | runtime/RpgGameWorld.tsx | 🔴 Critique |
| Global createImageBitmap shadowed | StreamingPuzzleMap.tsx:758 | 🟡 Moyen |
| WeakMap caches sans cleanup | mixamoRetarget.ts, AnimationController.ts | 🟡 Moyen |
| Chaînes de chemins dupliquées | npcCatalog.ts, avatarAssets.ts | 🟡 Moyen |
| Dualité AI (WASM + JS NpcController) | wasm/AICommandSync.ts + npc/NpcController.ts | 🔴 Critique |
| 5+ systèmes de streaming différents | StreamingPuzzleMap + WasmStreaming + AssetBudget + fallback | 🟠 Élevé |
| `// eslint-disable-next-line` abondantes | Multiples fichiers | 🟢 Faible |

### 15.2 Tests
- **Nombreux tests** couvrant les systèmes clés : CollisionWorld, mapBounds, locomotionBlend, mixamoRetarget, NPC, armes
- **Tests manquants :** StreamingPuzzleMap, RpgGameWorld, WASM bridges, AnimationController (intégration)

### 15.3 Bugs connus (documentés dans les commentaires)
1. **Murs traversables** après déchargement de chunk (colliders non retirés) → corrigé
2. **Bandes noires** à la rotation caméra (rayon culling sous-estimé) → corrigé
3. **Crash WebGL** lors du changement de couches auto-material (dispose synchrone interdit) → corrigé
4. **Map invisible** en fallback WASM au reveal (setLoadedChunks manquant dans soupape) → corrigé
5. **Arme FPS invisible** au toggle F1 (useRef non notifié) → corrigé
6. **Combo punch/kick désynchronisé** (deux tirages randoms indépendants) → corrigé
7. **Perte collision Forge** à Y=-401 (GROUND_SEARCH_DEPTH négatif) → corrigé
8. **OOM chunk** (retry même fichier saturé) → corrigé avec descente de variante

---

## 16. Recommandations

### 🔴 Priorité Critique
1. **Refactorer RpgGameWorld.tsx** en modules séparés (GameScene, CombatManager, TravelController, HUDController, DungeonManager)
2. **Unifier le système d'IA** : choisir WASM ou JS pour les NPC, pas les deux
3. **Générer les types WASM** automatiquement depuis le C++ (wasm-bindgen ou équivalent)
4. **Nettoyer le dualisme de streaming** : WASM ou JS, pas 3 systèmes (budget + streaming + fallback)

### 🟠 Priorité Élevée
5. **Ajouter un cache TTL** aux WeakMaps de retargeting (fuite mémoire lente)
6. **Centraliser les chemins d'assets** dans un registre unique (pas de duplication catalog/avatarAssets)
7. **Ajouter des tests d'intégration** pour WASM→JS bridges
8. **Réduire MAX_CONCURRENT=2** → 4-6 pour améliorer temps de chargement

### 🟡 Priorité Moyenne
9. **Déplacer les 26 actionId + candidats** dans un fichier data-driven JSON
10. **Ajouter un mécanisme de retry** pour le chargement WASM (script tag onerror)
11. **Remplacer les singletons** par des contextes React (injection de dépendances)
12. **Documenter le protocole WASM** (mémoire partagée, structures binaires)

### 🟢 Priorité Faible
13. **Supprimer HumanCharacter** (legacy Sorcier remplacé par OwnAnimPlayerCharacter)
14. **Nettoyer les fichiers `.bak`** (3 fichiers dans le dépôt)
15. **Ajouter des métriques** (nombre de chunks chargés, temps de bake, utilisation VRAM)

---

*Rapport généré par l'Équipe ANALYSE MOTEUR (50 agents) le 29 juillet 2026.*
*Projet : Narvos Prime — WebPortal*