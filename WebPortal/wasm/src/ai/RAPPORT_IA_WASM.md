# RAPPORT D'AUDIT — Équipe WASM AI

**Date :** 29 juillet 2026  
**Périmètre :** `wasm/src/ai/` (C++) + `src/rpg/wasm/AICommandSync.ts` + `src/rpg/npc/NpcController.ts`  
**Membres audités :** AISystem, AITactical, EQS, AICommandSync, NpcController

---

## 1. Architecture Globale

### 1.1 Technologie décisionnelle : FSM, PAS Behavior Tree

Il n'existe **aucun** Behavior Tree dans le projet. La recherche de `BehaviorTree` dans tout `wasm/` est revenue vide. Les fichiers suivants n'existent tout simplement pas :

- `wasm/src/ai/BehaviorTree.h` — ❌ inexistant
- Aucun nœud BT (Sequence, Selector, Condition, etc.) — ❌ inexistant
- Aucun blackboard — ❌ inexistant
- Aucun service/décorateur — ❌ inexistant

**Décision :** Le système C++ est une **FSM (Finite State Machine)** simple avec 8 états, tous dans `AITactical.h`. La JS utilise une machine à états plus petite (4 états). Les transitions sont des `switch` hardcodés.

### 1.2 Pipeline de décision C++ (WorldCoordinator::Tick → AISystem)

```
WorldCoordinator::Tick(dt)
  ├── 1. AISystem::Update(dt)           ← prises de décision IA
  ├── 2. g_PathManager.Update()         ← avancement des waypoints
  ├── 3. g_TriggerSystem.Tick()         ← zones de trigger
  ├── 4. g_StatusEffects.Tick(dt)       ← brûlure, root, stun
  ├── 5. TickHealthSystem(dt)           ← regen bouclier, mort
  └── 6. TickDeathCleanup(dt)          ← destruction différée des entités mortes
```

**Ordre déterministe documenté** dans `WorldCoordinator.cpp:32-38` — correct et sain.

---

## 2. AISystem (C++ FSM) — Analyse Détaillée

### 2.1 Fichiers

- `wasm/src/ai/AISystem.h` (36 lignes) — déclaration statique
- `wasm/src/ai/AISystem.cpp` (177 lignes) — implémentation
- Compilé via `CMakeLists.txt:34`

### 2.2 Structure

Classe **statique** (tous les membres sont `static`) :

```cpp
class AISystem {
    struct AICommand { Entity; Action; targetPos; targetEntity; yaw; };
    static void Update(f32 dt);
    static void WriteCommands(float* outBuffer, u32* outCount, u32 maxCommands);
    static std::vector<AICommand> s_Commands;
    // Méthodes privées...
};
```

### 2.3 États Implémentés

| État | Enum | Implémenté dans Update() | Transition |
|---|---|---|---|
| Idle | ✅ | `UpdateIdle()` | Cherche le joueur → si trouvé → **Combat** |
| Patrol | ✅ | 🔀 tombe dans `UpdateIdle()` | Idem (Patrol non différencié) |
| Combat | ✅ | `UpdateCombat()` | Cœur tactique (voir §2.5) |
| Flank | ✅ | `UpdateFlank()` | 5s → **Combat** |
| Investigate | ✅ | ❌ Aucun handler | Défini dans l'enum, jamais traité |
| Suppress | ✅ | ❌ Aucun handler | Défini dans l'enum, jamais traité |
| Retreat | ✅ | ❌ Pas de handler propre | Déclenché dans `UpdateCombat()` par changement d'état |
| Dead | ✅ | Skip dans Update() | Défini par `Health::isDead → AITactical::state = Dead` |

**État des lieux :** 5 états sur 8 sont réellement utiles ; Investigate et Suppress sont morts (unused depuis la création).

### 2.4 AICommand — Buffer de sortie

```cpp
struct AICommand {
    Entity entity;           // entité propriétaire
    enum Action : u8 { None, MoveTo, Attack, FindCover, Retreat, Die };
    glm::vec3 targetPos;
    Entity targetEntity;
    f32 yaw;
};
```

`WriteCommands()` sérialise chaque commande en **7 floats** dans un buffer plat :
```
[entity(float), action(float), targetPos.x, targetPos.y, targetPos.z, targetEntity(float), yaw]
```

### 2.5 Logique de Combat (`UpdateCombat`)

```
UpdateCombat(e, ai, dt)
├── Vérifie Transform + Health + Weapon
├── Si target invalide → ChooseTarget() → return
├── Si target détruite → retour Idle
├── Si PAS de LOS depuis 3s → transition Flank
├── Si shield ≤ 0 ET HP < 30% max ET courage < 0.5
│   └── État = Retreat, FindCover(), émet AICommand::Retreat
├── Si pas en cover ET distance < 15 ET rôle ≠ Brute
│   └── FindCover() via EQS
└── Si LOS + ammo > 0
    └── Émet AICommand::Attack (avec yaw calculé)
```

**Forces :** Logique de couverture, flank, retraite basée sur courage — plus riche que la JS.

**Faiblesses :** `courage` est initialisé à 1.0 et JAMAIS modifié → la condition de retraite ne se déclenche que si un autre système touche à `courage`. De fait, la retraite n'arrive jamais.

### 2.6 `ChooseTarget()`

- Cherche l'entité marquée `PlayerTag` (toujours le joueur)
- Vérifie `CanSeeTarget()` avant d'assigner
- Stocke `lastKnownEnemyPos` pour la recherche de couverture

**Limitation :** Cible unique (le joueur) — pas de priorisation entre plusieurs ennemis, pas de changement de cible.

### 2.7 `CanSeeTarget()`

- Raycast oculaire (oeil des deux entités : y +1.6m)
- Délègue à `EQS::TraceTest()` → `CollisionSystem.SegmentBlocked()`
- ✔️ Propre et efficace

---

## 3. AITactical (Component Data)

**Fichier :** `wasm/src/components/AITactical.h` (25 lignes)

Structure **header-only** — pas de `.cpp`. C'est un pur composant ECS.

```cpp
struct AITactical {
    AIState state = AIState::Idle;
    AISquadRole role = AISquadRole::Grunt;
    Entity target = INVALID_ENTITY;
    Entity squadLeader = INVALID_ENTITY;
    glm::vec3 lastKnownEnemyPos{0.0f};
    glm::vec3 coverPos{0.0f};
    f32 stateTime = 0.0f;
    f32 alertLevel = 0.0f;
    f32 courage = 1.0f;
    f32 accuracy = 0.8f;
    bool inCover = false;
    bool suppressing = false;
};
```

**Champs non utilisés dans la logique actuelle :**

| Champ | Utilisé ? |
|---|---|
| `alertLevel` | ❌ Jamais lu |
| `courage` | ✅ `UpdateCombat` le lit (mais jamais modifié → toujours 1.0) |
| `accuracy` | ❌ Jamais lu |
| `suppressing` | ❌ Jamais lu |
| `squadLeader` | ❌ Aucune logique d'escouade |

**Rôles définis mais pas de logique différenciée :**

| Rôle | Effet |
|---|---|
| Grunt | Comportement par défaut |
| Leader | ❌ Aucune logique spéciale |
| Sniper | ❌ Aucune logique spéciale |
| Brute | ✅ Condition `role != Brute` dans FindCover → les Brutes ne cherchent PAS la couverture |

---

## 4. EQS (Environmental Query System)

### 4.1 Fichiers

- `wasm/src/ai/EQS.h` (37 lignes) — types + déclaration
- `wasm/src/ai/EQS.cpp` (40 lignes) — implémentation
- Compilé via `CMakeLists.txt:31-32`

### 4.2 Architecture

```cpp
struct EQSTest {
    enum Type { Distance, Dot, Trace, Overlap, PathFind };
    std::function<f32(const glm::vec3&)> scorer;  // lambda: prend position → score
    f32 weight;
};

struct EQSQuery {
    glm::vec3 querier;
    f32 radius;
    u32 gridSize;
    std::vector<EQSTest> tests;
};
```

### 4.3 `RunQuery()`

1. **Génère une grille 2D** de `gridSize × gridSize` cellules centrée sur le querier
2. Pour chaque cellule, évalue **tous les tests** (score × weight)
3. Trie les résultats par score décroissant
4. Retourne le vecteur trié (top = meilleur)

### 4.4 Utilisations dans le code

| Appelant | Query | Tests |
|---|---|---|
| `AISystem::FindCover` | radius=20, gridSize=16 | 1 test Distance (dist lastEnemyPos entre 5 et 15m) |
| `AISystem::CanSeeTarget` | N/A | `TraceTest()` → `CollisionSystem.SegmentBlocked()` (pas une query) |

### 4.5 Forces et limites

**Forces :**
- Système générique et flexible (lambdas, weighted scoring)
- Grid search propre pour la couverture
- TraceTest bien intégré avec le collision system

**Limites :**
- Recherche 2D seulement (pas de Y → ignore la hauteur des obstacles)
- `EQSTest::Type` (Distance, Dot, Trace, Overlap, PathFind) n'est jamais utilisé dans la logique — seul le `scorer` lambda compte
- Seulement 1 type de query utilisé (FindCover)
- gridSize fixe (16) pour FindCover → 256 évaluations/tick, évolue mal avec le nombre de PNJ

---

## 5. AICommandSync (JS — Côté WASM)

**Fichier :** `src/rpg/wasm/AICommandSync.ts` (78 lignes)

### 5.1 Mapping des actions

```typescript
export const enum AIAction {
  None = 0, MoveTo = 1, Attack = 2, FindCover = 3, Retreat = 4, Die = 5,
}
```

✔️ Correspond exactement au `AICommand::Action` C++.

### 5.2 Cycle de vie

```
initAIBuffers() → malloc des buffers WASM (commandes + count)
WasmWorldTicker tick:
  1. wasmWorldCoordinator.tick(dt)  ← AISystem::Update remplit s_Commands
  2. readAICommands()               ← lit les buffers WASM
  3. wasmNpcBridge.dispatchCommands(commands)
freeAIBuffers() → cleanup
```

### 5.3 ❌ PROBLÈME CRITIQUE — WriteCommands n'est PAS bind

```typescript
// AICommandSync.ts:52-53
// Appel C++ : AISystem::WriteCommands(buffer, &count, maxCommands)
// Pour l'instant on lit directement depuis le pool en JS
// car WriteCommands n'est pas encore bind (sera ajouté phase 3)
```

**WriteCommands n'est pas exposé via embind** dans `Bindings.cpp`. La fonction existe en C++ mais :
1. Personne ne l'appelle côté C++
2. Personne ne peut l'appeler côté JS (pas de binding)
3. Le buffer alloué est **toujours zero-filled** (count=0)
4. `readAICommands()` retourne **toujours `[]`**

**Impact :** Le système IA C++ tourne mais ne communique pas avec le runtime JS. Les décisions prises par `AISystem::Update` restent dans `s_Commands` et ne sont jamais consommées.

---

## 6. NpcController (JS — Machine à États Pure)

**Fichier :** `src/rpg/npc/NpcController.ts` (156 lignes)

### 6.1 Architecture

Machine à états **pure JS**, sans dépendance React/Three.js, testable en isolation.

```
États : idle ──(aggroRange)──▶ chase ──(attackRange + LOS)──▶ attack
              ◀────(leash)────┘     ◀──(LOS perdue + giveUpTime)─┘
        hp ≤ 0 ──▶ dead (terminal)
```

### 6.2 Paramètres de configuration

```typescript
interface NpcConfig {
  maxHp, moveSpeed, aggroRange, attackRange,
  attackCooldown, attackDamage, hostile
}
```

Configuré dynamiquement dans `Npc.tsx` selon la classe et le niveau du PNJ.

### 6.3 Hystérésis — Anti-flashing

```
attackKeep = attackRange × 1.25   // reste en attack au-delà de la portée
leash      = aggroRange × 1.5     // ne désengage pas immédiatement
giveUpTime = 3.5s                 // abandon après perte de LOS prolongée
lostTimer  += dt si pas engageable; reset sinon
```

### 6.4 `decideNpcState()` — Fonction pure

```typescript
function decideNpcState(current, dist, cfg, senses): NpcState
```

- Joueur mort / PNJ non hostile → idle
- LOS + ≤ attackRange → attack (avec hysteresis)
- ≤ aggroRange → chase (hystérésis jusqu'au leash)
- Sinon → idle

### 6.5 Retour `NpcFrameResult`

```typescript
interface NpcFrameResult {
  action: ActionId;     // "idle" | "run" | "attack" | "death"
  moving: boolean;      // déplacement requis ?
  attackFired: boolean; // infliger des dégâts cette frame ?
}
```

---

## 7. Dualité C++ / JS — Analyse de Cohabitation

### 7.1 Comment les DEUX IA coexistent dans Npc.tsx

```typescript
// LIGNE 373-385 de Npc.tsx (useFrame)
const jsRes = ctrl.update(dt, dist, { canSee, playerAlive: engageable });
let res = jsRes;
if (isEngineLoaded() && ctrl.hostile) {
  const cmd = wasmNpcBridge.getCommand(id);
  if (cmd && cmd.action !== AIAction.None) {
    // OVERRIDE WASM → remplace jsRes
    res = { action: (moving ? "run" : ...), moving, attackFired };
  }
}
```

**Stratégie :** Le JS NpcController **tourne toujours**. Le WASM C++ **peut override** si une commande non-nulle est disponible. En pratique, puisque `readAICommands()` retourne `[]`, seul le JS est actif.

### 7.2 Tableau comparatif

| Aspect | C++ AISystem | JS NpcController |
|---|---|---|
| **Type** | FSM avec 5 états actifs | Machine à états 4 états |
| **Couverture** | ✅ Génère des positions de cover | ❌ Pas de cover |
| **Flanking** | ✅ Flank si LOS perdue > 3s | ❌ Pas de flank (perte LOS → idle après 3.5s) |
| **Retraite** | ✅ Basée sur HP + courage | ❌ Pas de retraite programmée |
| **Squad roles** | ✅ 4 rôles (Grunt/Leader/Sniper/Brute) | ❌ Pas de différenciation |
| **Ligne de vue** | CollisionSystem (WASM) | collisionWorld (Three.js) |
| **Pathfinding** | NavMesh via PathManager | NavMesh via WASM bridge ou direct |
| **Priorisation** | Cible unique (joueur) | Cible unique (joueur) |
| **Tests** | ❌ Aucun | ✅ Testable en isolation |
| **État actif** | Tourne mais déconnecté | ✅ SEUL système actif |

### 7.3 Conflits potentiels

1. **Override sans filet** : Si le WASM est actif, la décision C++ écrase complètement le JS — deux IA indépendantes peuvent faire des choix contradictoires
2. **Décalage d'états** : `AIState::Combat` ≠ `NpcState::attack` ; la traduction via `commandToFrameResult()` est lossy (4 états C++ → 3 animations)
3. **Double LOS** : C++ fait son raycast (collisionSystem), JS fait le sien (collisionWorld Three.js) — résultats potentiellement différents
4. **Dead state** : `AITactical::state = Dead` et `NpcController.state = "dead"` doivent rester synchronisés — deux systèmes health (C++ Health / JS hp)
5. **Pathfinding duel** : Npc.tsx suit soit `NpcController` (déplacement direct vers joueur) soit les waypoints WASM. Si WASM devient actif, le pathfinding doit s'aligner sur le NavMesh C++

---

## 8. État de l'Implémentation — Fichiers par Fichier

| Fichier | Statut | Notes |
|---|---|---|
| `wasm/src/ai/AISystem.h` | ✅ Stable | Interface propre, statique |
| `wasm/src/ai/AISystem.cpp` | ✅ Stable | Logique complète, manque WriteCommands dans Bindings |
| `wasm/src/components/AITactical.h` | ✅ Stable | Data-only, header-only |
| `wasm/src/ai/EQS.h` | ✅ Stable | Générique, flexible |
| `wasm/src/ai/EQS.cpp` | ✅ Stable | 2D grid search, fonctionnel |
| `wasm/src/ai/BehaviorTree.h` | ❌ **Inexistant** | Aucun BT dans le projet |
| `Bindings.cpp` | ✅ Stable | Mais WriteCommands non bind |
| `AICommandSync.ts` | ⚠️ **Incomplet** | Buffer alloué mais jamais écrit |
| `NpcController.ts` | ✅ Stable | Machine à états pure, testable |
| `Npc.tsx` | ✅ Stable | Double AI dispatch correct |

---

## 9. Recommandations

### 9.1 Court terme — Débloquer le pipeline WASM

1. **Ajouter le binding embind pour `WriteCommands`** dans `Bindings.cpp` :
   ```cpp
   function("writeAICommands", +[](uintptr_t buf, uintptr_t count, int max) {
       nv::AISystem::WriteCommands(
           reinterpret_cast<float*>(buf),
           reinterpret_cast<uint32_t*>(count),
           (uint32_t)max);
   });
   ```

2. **Appeler `writeAICommands()` dans `readAICommands()`** avant la lecture du buffer.

### 9.2 Moyen terme — Synchronisation

3. **Single source of truth pour le pathfinding** : Que le WASM ou le JS décide, le pathfinding doit utiliser le même NavMesh.
4. **Unifier le LOS** : Éviter deux raycasts par frame — choisir `CollisionSystem.SegmentBlocked` (WASM, performant) comme unique source.

### 9.3 Long terme — Complétude

5. **Champs morts dans AITactical** : `alertLevel`, `accuracy`, `suppressing`, `squadLeader` — soit les implémenter, soit les retirer.
6. **État `Investigate` et `Suppress`** : Handler manquant — décider si on supprime ou implémente.
7. **EQS étendu** : Utiliser les types de test `Dot`, `Overlap`, `PathFind` pour des queries plus riches (couverture directionnelle, etc.).
8. **Logique d'escouade** : `squadLeader` n'est jamais lu — prévoir un système de communication entre PNJ si voulu.

### 9.4 Risque Architecturel

9. **Dual IA → Fusion** : À terme, le WASM doit remplacer complètement le JS NpcController pour les PNJ hostiles. Actuellement, toute la logique riche (cover, flank, retraite, squad roles) existe en C++ mais est inactive. Le JS est le plan de vol mais manque de profondeur tactique. Décider : fusionner (migrer la logique riche WASM) ou trancher (un seul cerveau).

---

## 10. Résumé

| Métrique | Valeur |
|---|---|
| Fichiers audités | 8 |
| Lignes de code C++ (IA) | ~280 |
| Lignes de code JS (IA) | ~235 |
| Behavior Tree | ❌ Aucun |
| FSM C++ active ? | ✅ Tourne mais déconnectée |
| FSM JS active ? | ✅ Seule IA réelle |
| Pipeline WASM → JS complet ? | ❌ Bloqué (WriteCommands non bind) |
| Vulnérabilités critiques | 0 |
| Anomalies structurelles | 5 |
| Recommandations | 9 |
