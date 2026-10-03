# Audit de Couverture de Tests — NARVOS PRIME WebPortal

**Date :** 2026-07-30  
**Projet :** `E:\narvosprime-web-prototype\WebPortal`  
**Technologie :** React + Three.js (R3F) + Vitest  
**Tests existants :** 161 fichiers de test, couvrant 148 fichiers source sur 598  

---

## Résumé Exécutif

- **Couverture nominale :** 24.7 % des fichiers source ont un test correspondant
- **450 fichiers source (75.3%) sans AUCUN test**
- **Concentration du risque :** les 4 fichiers critiques identifiés sont tous non testés
- **Dette technique majeure :** les couches `utils/`, `wasm/`, `runtime/`, `weapons/`, `forge/` et `characters/` sont quasi intégralement non couvertes

---

## I. Fichiers Critiques NON Testés (demandés)

### 1. `src/rpg/runtime/RpgGameWorld.tsx` — 4018 lignes, 269 branches
**Statut :** ❌ AUCUN TEST  
**Rôle :** Composant central du monde de jeu — orchestre la map, le joueur, les PNJ, le combat, les quêtes, les véhicules, l'inventaire, l'interface.

**Fonctions clés sans test :**
| Fonction | Lignes | Branches | Risque |
|---|---|---|---|
| `RpgGameWorld()` | ~200-3800 | ~250 | 🔴 CRITIQUE — god component |
| `MapModel()` | 344-367 | 6 | 🔴 Rendu map + collisions |
| `LootProximity()` | 389-403 | 4 | 🟡 Détection loot |
| `TargetingTicker()` | 422-443 | 4 | 🟡 Ciblage ennemi |
| `StatusEffectTicker()` | 452-457 | 3 | 🟡 Effets de statut |
| `QuestReachWatcher()` | 462-475 | 3 | 🟡 Progression quêtes |
| `SHIPS_PER_MAP` (static data) | 277-330 | — | 🟡 Config vaisseaux par map |

**Branches non couvertes :**
- Gestion du spawn initial (sauvegarde vs map forcée)
- Logique d'embarquement/débarquement de vaisseaux (E, Shift+E)
- Switch FPS↔TPS caméra
- Modes de mort : HEROIC (hardcore ladder), NORMAL (respawn)
- Pause / menus modaux (invOpen, charMenu, questOpen, talentOpen)
- Système de warp spatial (boundary hit, atmosphère)
- Gestion des coffres / loot de cadavres
- Système de craft / récolte / professions
- Intégration complète du combat (auto-attack, dégâts, munitions, rechargement)

### 2. `src/rpg/characters/OwnAnimPlayerCharacter.tsx` — 714 lignes, 55 branches
**Statut :** ❌ AUCUN TEST  
**Rôle :** Rendu du personnage joueur avec son propre rig + animations embarquées.

**Fonctions clés sans test :**
| Fonction | Lignes | Risque |
|---|---|---|
| `OwnAnimCore()` | 105-714 | 🔴 Animation complète + état |
| `resolveYawOffset()` | 61-63 | 🟡 Convention UE vs Mixamo |
| Emote loading/playback | 198-232 | 🟡 Chargement asynchrone |
| Climb state machine | 387-399 | 🔴 Escalade complexe |
| Locomotion blend | 400-490 | 🔴 Blend directionnel 16 clips |
| Crouch additif + stationary | 358-385 | 🟡 Hystérésis anti-oscillation |
| Idle variants | 193-208 | 🟡 Variantes idle asynchrones |

**Edge cases critiques manquants :**
- Crouch hystérésis : seuil entrée (0.2) vs sortie (0.5) → oscillation possible
- Deadzone anti-oscillation yaw (0.001 rad) → micro-lerp en idle
- `stationaryCrouch` : test de `currentAction === "idle"` qui s'auto-invalide
- Interruption d'émote par gameplay (mouvement, crouch, mort, attaque)
- Invisibilité (status effect) → toggle opacité matériaux
- Fallback `play(action)` quand les clips directionnels ne sont pas chargés

### 3. `src/rpg/runtime/movement/FpsCamera.ts` — 130 lignes, 8 branches
**Statut :** ❌ AUCUN TEST  
**Rôle :** Logique caméra FPS/TPS pure — position, head-bob, shake, recoil.

**Fonctions sans test :**
| Fonction | Risque |
|---|---|
| `apply()` | Dispatcher FPS vs TPS |
| `applyFps()` | Head-bob + position yeux |
| `applyTps()` | Orbite TPS + anti-clip + lissage |
| `applyShake()` | Recul directionnel + tremblement trauma |

**Branches critiques :**
- `state.view === "tps"` → sélection FPS vs TPS
- `state.grounded && horizontalSpeed > 0.5` → bob conditionnel
- `cameraCollisionStore.get()` → anti-clip mur TPS (raycast)
- Première frame TPS → snap au lieu de lerp
- `intensity < 0.0001` → court-circuit shake
- Recul caméra piloté par animation events

### 4. `src/rpg/weapons/WeaponSocket.tsx` — 238 lignes, 15 branches
**Statut :** ❌ AUCUN TEST  
**Rôle :** Montage conditionnel d'arme sur le rig du personnage (GLB/FBX, dégainé/rangé).

**Fonctions sans test :**
| Fonction | Risque |
|---|---|
| `WeaponSocket()` (memo) | Garde-fou : arme absente, ErrorBoundary, Suspense |
| `useAttachWeapon()` | Logique d'attache impérative complexe |
| `boneForMode()` | Résolution os porteur avec fallbacks en cascade |
| `applyModeOffset()` | Résolution offset (override → calibrage → profil → auto-scale) |
| `mountOnBone()` | Annulation échelle monde de l'os |
| `WeaponGltf()` / `WeaponFbx()` | Dispatch par extension |

**Edge cases :**
- `FAILED_WEAPON_PATHS` : mémorisation des 404 pour éviter re-tentatives infinies
- Changement de mode dégainé↔rangé → re-parentage os (main→Spine) sans re-clone
- Fallback main droite générique si l'os exact est introuvable
- `WeaponErrorBoundary` : masque silencieux des erreurs de chargement
- Préchargement sélectif (7 armes de classe ~600 Ko, pas le catalogue Meshy ~42 Mo)

---

## II. Top 15 Fichiers NON Testés les Plus Risqués (par branches + taille)

| Rang | Fichier | Lignes | Branches | Exporté | Domaine |
|---|---|---|---|---|---|
| 1 | `runtime/RpgGameWorld.tsx` | 4018 | 269 | ✅ | Monde de jeu |
| 2 | `animation/AnimationController.ts` | 922 | 77 | ✅ | Animation |
| 3 | `utils/AudioManager.ts` | 725 | 90 | — | Audio |
| 4 | `wasm/MathWasm.ts` | 631 | 79 | ✅ | Maths WASM |
| 5 | `dialogue/dialogueLoader.ts` | 502 | 87 | ✅ | Dialogues |
| 6 | `utils/storage.ts` | 891 | 67 | — | Persistance |
| 7 | `runtime/input/EnhancedInputManager.ts` | 516 | 44 | ✅ | Input |
| 8 | `cache/levels.ts` | 467 | 24 | ✅ | Cache |
| 9 | `monitoring/MonitoringService.ts` | 464 | 25 | ✅ | Monitoring |
| 10 | `runtime/movement/CharacterController.ts` | 406 | 25 | ✅ | Mouvement |
| 11 | `materials/autoMaterialStore.ts` | 396 | 16 | ✅ | Matériaux |
| 12 | `forge/graph/nodes.ts` | 343 | 14 | — | Forge |
| 13 | `runtime/CollisionWorld.ts` | 250 | 26 | — | Collisions |
| 14 | `forge/graph/executor.ts` | 242 | 24 | ✅ | Forge |
| 15 | `characters/AnimatedModularCharacter.tsx` | 606 | 34 | ✅ | Personnage |

---

## III. Écarts de Couverture par Domaine

| Domaine | Fichiers source | Testés | (%) | Gravité |
|---|---|---|---|---|
| `src/utils/` | 6 | 1 | 17% | 🔴 CRITIQUE — crashReporter, storage, AudioManager non testés |
| `src/rpg/wasm/` | 21 | 2 | 10% | 🔴 CRITIQUE — MathWasm, bridges non testés |
| `src/rpg/weapons/` | 30 | 19 | 63% | 🟡 Moyen — 11 fichiers non testés mais les stores le sont |
| `src/rpg/runtime/` | 41 | 4 | 10% | 🔴 CRITIQUE — cœur du runtime non testé |
| `src/rpg/forge/` | 25 | 4 | 16% | 🔴 ÉLEVÉ — éditeur Forge non testé |
| `src/rpg/npc/` | 24 | 10 | 42% | 🟡 Moyen — pools/stores OK, composants non |
| `src/rpg/characters/` | 24 | 3 | 13% | 🔴 ÉLEVÉ — 3/24 fichiers testés |
| `src/rpg/ui/` | 24 | 1 | 4% | 🟡 UI difficile à tester unitairement |
| `src/rpg/audio/` | 12 | 0 | 0% | 🔴 CRITIQUE — 0% couvert |
| `src/rpg/cache/` | 10 | 8 | 80% | 🟢 Bon |
| `src/rpg/network/` | 4 | 4 | 100% | 🟢 Bon |
| `src/rpg/items/` | 9 | 9 | 100% | 🟢 Bon |
| `src/rpg/combat/` | 13 | 8 | 62% | 🟡 Moyen |
| `src/components/` | 20 | 0 | 0% | 🟡 UI uniquement |

---

## IV. Edge Cases Manquants dans les Tests Existants

L'audit des tests existants montre une bonne qualité pour les fichiers testés. Cependant :

### Patterns de risques non testés :
1. **Intégration inter-systèmes** — Les tests sont unitaires et isolés. Aucun test d'intégration entre CharacterController + AnimationController + FpsCamera + WeaponSocket.
2. **Conditions de course asynchrones** — `OwnAnimPlayerCharacter` charge des GLB d'émotes/idle variants en arrière-plan ; pas de test de l'état intermédiaire (clip non chargé, chargement concurrent).
3. **Cas limites numériques** — `FpsCamera.applyTps()` contient des calculs trigonométriques (sin/cos) avec potentiels NaN/quaternion nul si `d` → 0 ; `solveTwoBoneIKJS` est bien testé côté IK mais pas les intégrations.
4. **Hystérésis d'état** — `stationaryCrouch` dans OwnAnimPlayerCharacter a un seuil entrée/sortie (0.2/0.5 m/s) jamais testé.
5. **Fallbacks en cascade** — `boneForMode()` dans WeaponSocket a 3 niveaux de fallback ; aucun test de chaque branche.

---

## V. Tests Prioritaires à Ajouter (Roadmap)

### P0 — CRITIQUE (bloquant, à faire cette semaine)

| # | Cible | Type de test | Effort | Justification |
|---|---|---|---|---|
| 1 | `FpsCamera.apply()` / `applyFps()` / `applyTps()` | Unitaire pur | 2h | Logique caméra isolable, 130 lignes, pas d'UI. Tester : FPS vs TPS, head-bob, lissage TPS, anti-clip, shake. |
| 2 | `CollisionWorld.resolveCameraPosition()` | Unitaire | 3h | Anti-clip caméra TPS — raycast critique. Tests : pas de collision, collision simple, collision multiple. |
| 3 | `CharacterController` + `playerState` | Unitaire | 4h | Logique de mouvement (406 lignes, 25 branches). Tester : marche/course/sprint/seuils de vitesse, état grounded, saut, dash. |
| 4 | `AnimationController` core | Unitaire | 6h | 922 lignes, 77 branches. Tester au minimum : play/playOverlay/cancelEmote, résolution par nom, blend locomotion, transitions. |
| 5 | `MathWasm` JS fallbacks | Unitaire | 3h | 631 lignes, 79 branches. Tester les chemins JS quand WASM non disponible. |

### P1 — ÉLEVÉ (cette quinzaine)

| # | Cible | Type de test | Effort | Justification |
|---|---|---|---|---|
| 6 | `WeaponSocket.useAttachWeapon()` | Unitaire + mock R3F | 5h | Logique d'attache complexe (238 lignes, 15 branches). Tester : boneForMode, applyModeOffset, dégaine/rengaine, fallback os. |
| 7 | `OwnAnimPlayerCharacter` moteur d'état | Unitaire extrait | 6h | Extraire la logique d'état (lignes 310-490) en fonctions pures testables. Tester : émotes, crouch, climb, locomotion blend. |
| 8 | `storage.ts` (persistence) | Unitaire | 4h | 891 lignes — persistance critique. Tester CRUD, migrations, corruption recovery. |
| 9 | `AudioManager.ts` | Unitaire | 4h | 725 lignes, 90 branches. Tester : chargement, play/stop, volume, spatialisation. |
| 10 | `dialogueLoader.ts` | Unitaire | 3h | 502 lignes, 87 branches. Tester : parsing JSON dialogue, conditions, actions. |

### P2 — MOYEN (ce mois)

| # | Cible | Type de test | Effort |
|---|---|---|---|
| 11 | `EnhancedInputManager.ts` | Unitaire | 4h |
| 12 | `forge/graph/executor.ts` + `nodes.ts` | Unitaire | 5h |
| 13 | `ShipController.ts` | Unitaire | 4h |
| 14 | `StatusEffect` / `cooldownStore` edge cases | Complément | 2h |
| 15 | `RpgGameWorld` extraits de logique pure | Extraction + unitaire | 8h |

### P3 — FOND DE DETTE (trimestre)

| # | Cible |
|---|---|
| 16 | Composants UI `src/components/` — snapshot tests |
| 17 | `src/rpg/ui/` — HUD components |
| 18 | `src/rpg/forge/` — éditeur Forge |
| 19 | Smoke tests d'intégration (spawn → move → attack → loot) |
| 20 | Tests de performance/régression WASM |

---

## VI. Recommandations Structurelles

1. **Extraire la logique métier des composants React** — `RpgGameWorld` (4018 lignes) et `OwnAnimPlayerCharacter` (714 lignes) contiennent de la logique d'état pure mélangée à du rendu. Extraire en stores/fonctions pures testables.

2. **Activer la couverture Vitest** — Ajouter `coverage: { provider: 'v8' }` dans `vitest.config.ts` pour un rapport de couverture réel (branches/lignes/fonctions).

3. **Gate CI** — Bloquer les PR qui font baisser la couverture en dessous d'un seuil (≥25% aujourd'hui, cible 40% dans 3 mois, 60% dans 6 mois).

4. **Prioriser les fichiers à forte criticité métier** — Un fichier de 4000 lignes sans test = risque de régression à chaque modification. Prioriser les extractions.

5. **Tests de non-régression pour les bugs corrigés** — Les fichiers `regression/bugs-20260729.test.ts` montrent une bonne pratique. Continuer à ajouter un test par bug corrigé.

---

## VII. Fichiers Générés

- `coverage_audit.py` — Script Python d'analyse de couverture (exécuté localement)
- Ce rapport : `TEST_COVERAGE_AUDIT.md`

---

**Conclusion :** Le projet a 161 tests de bonne qualité sur les couches stores/cache/items/network, mais **75% du code est non testé**, avec une concentration du risque sur les 15 plus gros fichiers (qui totalisent ~12 000 lignes et 600+ branches sans couverture). Les 5 tests P0 sont isolables et réalisables en ~18h cumulées — ils couvriraient les fonctions les plus critiques (caméra, collisions, mouvement, animation, maths).