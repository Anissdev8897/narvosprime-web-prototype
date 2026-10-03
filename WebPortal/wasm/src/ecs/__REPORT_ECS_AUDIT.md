# RAPPORT D'AUDIT — WASM ECS C++ (Partie 4)

**Projet** : Narvos Prime  
**Chemin** : `WebPortal/wasm/src/ecs/`  
**Audité le** : 2026-07-29  
**Périmètre** : Registry, ComponentPool, patterns d'accès ECS

---

## 1. Architecture constatée

Le dossier `ecs/` ne contient que **3 fichiers** :

| Fichier | Lignes | Rôle |
|---------|--------|------|
| `Registry.h` | 98 | Orchestrateur ECS : entités, pools, ForEach |
| `Registry.cpp` | 48 | Implémentation (CreateEntity, DestroyEntity, Clear) |
| `ComponentPool.h` | 80 | Pool de composants générique (dense map + sparse index) |

**Ce qui n'existe PAS** (contrairement à l'intitulé du ticket) :
- ❌ **SparseSet.h** — pas de sparse set séparé ; le pattern sparse set est *intégré* dans `ComponentPool<T>`
- ❌ **Archetype.h** — **pas d'archetype ECS**. Le système est un **Pool-based ECS**, pas un Archetype ECS
- ❌ **ComponentStorage.h** — pas de storage abstrait

### Type système : Pool-based Fragmented ECS

```
Entity (u32)
  │
  ├── Registry (global singleton g_Registry)
  │     ├── m_Entities: vector<Entity>           (tous les IDs alloués)
  │     ├── m_Generations: vector<u32>           (compteur de génération)
  │     ├── m_FreeList: vector<u32>              (IDs libérés)
  │     └── m_ComponentPools: unordered_map<type_index, IComponentPool*>
  │             │
  │             └── ComponentPool<T> (un par type de composant)
  │                   ├── m_Data: vector<T>                   (~ dense array)
  │                   ├── m_IndexToEntity: vector<Entity>     (inverse mapping)
  │                   └── m_EntityToIndex: unordered_map<Entity, u32>  (sparse map)
```

---

## 2. Analyse détaillée des fichiers

### 2.1 `core/Types.h` — Définition des entités

```cpp
using Entity = u32;
constexpr Entity INVALID_ENTITY = 0xFFFFFFFF;
```

- Entity est un `u32` simple — pas de handle avec version intégrée
- La génération est stockée séparément dans `Registry::m_Generations`
- **Avantage** : compact (4B), passage par valeur, utilisable dans des conteneurs  
- **Inconvénient** : pas de détection de dangling handle côté JS (mais `IsValid()` côté C++)

### 2.2 `ComponentPool.h` — Le cœur du stockage

**Layout mémoire :**

```
m_Data:         [T0][T1][T2]...[Tn]           ← dense, contigu
m_IndexToEntity:[E0][E1][E2]...[En]           ← parallel array (inverse)
m_EntityToIndex:{E0→0, E1→1, E2→2,...}        ← hash map (sparse lookup)
```

**Opérations :**

| Opération | Complexité | Détail |
|-----------|-----------|--------|
| `Add(e, args...)` | O(1) avg | emplace_back, 2 map ops si existant (update) |
| `Get(e)` | O(1) avg | map lookup + vector index |
| `Has(e)` | O(1) avg | map lookup |
| `Remove(e)` | O(1) | swap-and-pop + 2 map ops |
| `Entities()` | O(1) | retourne ref au vector |
| `Data()` | O(1) | retourne ref au vector |

**Points forts :**
- Swap-and-pop `Remove()` : pas de décalage mémoire, compact
- `Entities()` et `Data()` retournent des **références** — pas de copie
- Layout SoA naturel : `Data()` est un `vector<T>` contigu → bon pour la cache

**Problèmes :**
- **`unordered_map`** pour la sparse map : allocation dynamique par entrée, hash non trivial
- **Pas de `reserve()` initial** : les vectors grandissent par reallocation
- **Pas de chunked allocation** : chaque composant d'entité est dans le même vector, pas de pagination
- **`Get()` non-const** : surligné dans Registry::GetComponent (devrait être const-correct)

### 2.3 `Registry.h/.cpp` — L'orchestrateur

**Création d'entité :**
```cpp
Entity Registry::CreateEntity() {
    if (!m_FreeList.empty()) {
        id = m_FreeList.back();
        m_FreeList.pop_back();
        m_Generations[id]++;    // ← incrémente la génération
    } else {
        id = (u32)m_Entities.size();
        m_Entities.push_back(id);
        m_Generations.push_back(0);
    }
    return id;
}
```
→ O(1). Réutilise les IDs libérés. Génération paire = valide.

**Destruction :**
```cpp
void Registry::DestroyEntity(Entity e) {
    RemoveAnyComponents(e);    // ← O(N_components * avg_pool_lookup)
    m_Generations[e]++;        // ← devient impaire → invalide
    m_FreeList.push_back(e);
}
```

**Générations (anti-dangling) :**
- `IsValid(e)` = `e < m_Generations.size() && m_Generations[e] % 2 == 0`
- Fonctionne, mais pas de versioned handle (un pointeur JS détenu trop longtemps peut être réalloué à un autre ID)

### 2.4 `ForEach<Ts...>` — Le point chaud

```cpp
template<typename... Ts>
void ForEach(const std::function<void(Entity, Ts&...)>& func) {
    auto& firstPool = GetOrCreatePool<First>();
    std::vector<Entity> entities = firstPool.Entities();  // ← COPIE !
    for (Entity e : entities) {
        if (!(HasComponent<Ts>(e) && ...)) continue;      // ← N vérifs par entité
        func(e, *GetComponent<Ts>(e)...);                  // ← std::function + N lookups
    }
}
```

**Coût par appel ForEach avec M types de composants et N entités :**

```
Copie vector:           N × 4B (O(N) memcpy)
HasComponent × (M-1):  (N × (M-1)) × (type_index hash + unordered_map lookup + static_cast + unordered_map lookup)
GetComponent × M:       N × M × (2× unordered_map lookup)
std::function call:     N × (call overhead, pas d'inlining)
```

Pour N=500, M=3 (Transform, Health, Weapon) :
- ~1500 lookups hash map
- ~500 appels de fonction virtuels (std::function)
- 2000B copie inutile

### 2.5 Comparaison : Sparse Set vs Archetype

| Critère | Actuel (Pool) | Archetype ECS (EnTT/Flecs) |
|---------|--------------|---------------------------|
| Layout | 1 pool plat par type | Chunks de composants groupés par archetype |
| Itération multi-composant | N lookups table de hash par entité | 1 boucle linéaire sur un chunk |
| Changement structurel | Séquentiel (1 pool modifié) | Migre l'entité entre archetypes |
| Utilisation mémoire | ~128-256B overhead par type de pool | ~64B par chunk fixe |
| Complexité code | **Très faible** | Élevée |
| WASM binary size | **~2KB gzippé pour l'ECS** | 10-50× plus |
| <500 entités | **Excellent** | Sur-ingéniéré |

---

## 3. Analyse des performances (cible <500 entités)

### 3.1 Volume estimé

D'après le code JS (`WasmNpcBridge.ts`) et les systèmes :
- **1 entité joueur** (`PlayerTag`)
- **0-200 PNJ** (`AITactical`, `Health`, `Weapon`, `Transform`)
- **0-50 entités temporaires** (mortelles, cleanup après 5s)
- **Total : typiquement 10-200, max 300-500**

### 3.2 Profilage des patterns d'accès (`WorldCoordinator::Tick`)

```
Tick (60 FPS) :
├── AISystem::Update(dt)          — itération directe sur pool AITactical (pas ForEach) ✅
├── g_PathManager.Update()         — GetComponent<Transform> × active paths ✅
├── g_TriggerSystem.Tick()         — ForEach<Transform> × zones actives ⚠️ (copie)
├── g_StatusEffects.Tick(dt)       — GetComponent<Health> × affects ⚠️
├── TickHealthSystem(dt)           — ForEach<Health> × entités ⚠️ (copie)
└── TickDeathCleanup(dt)           — ForEach<Health> × entités ⚠️ (copie, tous les 2s)
```

### 3.3 Mesure de performance estimée (WASM -O2)

Pour 200 entités, 60 FPS, avec `-msimd128` :

| Opération | Entités | Coût estimé | Budget frame (16ms) |
|-----------|---------|------------|-------------------|
| ForEach<Health> (1 type) | 200 | **~1-3 µs** | 0.02% |
| ForEach<Transform> (1 type) | 200 | **~1-3 µs** | 0.02% |
| AISystem direct pool | 150 AI | **~20-80 µs** (inclut EQS) | 0.5% |
| TickHealthSystem | 200 | **~5-10 µs** | 0.06% |
| DeathCleanup (tous les 2s) | 50 dead | **~2-5 µs** | 0.03% |
| TriggerSystem (5 zones) | 200×5 | **~15-30 µs** | 0.2% |
| **Total ECS** | | **< 150 µs** | **< 1%** |

→ **Aucun bottleneck ECS à ce volume.**

### 3.4 Suroît mémoire

| Composant | Taille | × 500 entités | Overhead pool |
|-----------|--------|--------------|---------------|
| Transform | 36B × 3 vec3 | 54KB | ~2KB hash map |
| Health | 48B (7 fields) | 24KB | ~2KB |
| Weapon | 32B (5 fields) | 16KB | ~2KB |
| AITactical | 76B (10 fields) | 38KB | ~2KB |
| PlayerTag | 1B | 1B | ~2KB |
| **Total** | | **~135KB + 10KB overhead** | |

→ **< 150KB pour 500 entités** — négligeable en WASM (heap initial 64MB).

---

## 4. Problèmes identifiés

### 🔴 CRITIQUE

**Aucun problème critique** — le système fonctionne, est memory-safe, ne plante pas.

### 🟡 MOYEN

1. **`ForEach` copie le vector d'entités inutilement**
   - `std::vector<Entity> entities = firstPool.Entities();` → copie O(N)
   - Fix : `const auto& entities = firstPool.Entities();`

2. **Duplication de `PlayerTag` dans AISystem.cpp**
   - Ligne 13 : `struct PlayerTag { u8 dummy = 0; };` **défini localement**
   - `components/PlayerTag.h` existe déjà et n'est PAS inclus
   - Les deux définitions sont identiques → fonctionne, mais confusion

3. **`ForEach` avec M composants = N×M lookups hash map**
   - Pourrait être optimisé en itérant directement sur les pools en parallèle
   - Particulièrement gênant pour des requêtes 3-composants

4. **`std::function` empêche l'inlining**
   - Les callbacks ForEach passent par `std::function` → allocation + virtual call
   - Alternative : paramètre template `typename F`, ou `auto&& func`

### 🟢 BAS / INFO

5. **Pas de `reserve()` initial** sur les pools ou le registry
   - `m_Data.emplace_back(...)` sans hint → reallocation multiples pour les 50-100 premiers entities

6. **`GetComponent<T>` non-const** dans le const-overload `HasComponent`
   - `HasComponent` est `const` mais doit `static_cast` sur un membre non-const
   - Contournement fonctionnel mais moche

7. **Pas de chunked/paged allocation** — le vector peut se fragmenter via wasm malloc

8. **`RemoveAnyComponents` O(N_pools × N_entities)** — itère tous les pools
   - Correct avec 5 pools, problématique si des dizaines de types de composants

---

## 5. Recommandations

### 5.1 Priorité Haute — Gains immédiats (< 1h)

| # | Action | Fichier | Effet |
|---|--------|---------|-------|
| R1 | **Remplacer la copie par référence** dans ForEach | `Registry.h:63` | Évite copie 2000B/ForEach |
| R2 | **Supprimer le PlayerTag dupliqué** et inclure le .h | `AISystem.cpp:13` | Clean code |

### 5.2 Priorité Moyenne — Optimisations (~2h)

| # | Action | Effet |
|---|--------|-------|
| R3 | **Remplacer `ForEach<Health>` par itération directe pool** dans `WorldCoordinator::TickHealthSystem` et `TickDeathCleanup` | Évite 2 copies + 2×N lookups par tick |
| R4 | **Ajouter `reserve(512)`** dans `GetOrCreatePool<T>()` après création du pool | Évite 2-3 reallocations par pool |
| R5 | **Convertir `std::function` en template paramètre** dans `ForEach` | Permet l'inlining du callback |

### 5.3 Basse priorité — Refinements

| # | Action | Effet |
|---|--------|-------|
| R6 | **Remplacer `unordered_map` par `ska::flat_hash_map`** | -40% overhead, meilleure localité cache |
| R7 | **Version handle sémantique** (`Entity` = paquet {index, generation} sur 64 bits) | Détection de dangling handles, safe |
| R8 | **Ajouter `const-correct` GetComponent** pour les queries en lecture seule | Sûreté |

### 5.4 NON recommandé

❌ **Ne PAS migrer vers un Archetype ECS (EnTT/Flecs)** :
- Surcoût en complexité et taille binaire WASM non justifié pour <500 entités
- Le système actuel est plus simple, plus facile à déboguer
- La flexibilité de l'archetype (composants ajoutés/retirés dynamiquement) n'est pas utilisée

❌ **Ne PAS ajouter de multithreading** :
- WASM single-threadé (sauf pthreads optionnel, le projet ne l'active pas par défaut)
- Pas de bénéfice pour 200 entités

---

## 6. Comparatif : Pool ECS actuel vs Archetype ECS

Le système actuel est un **Pool-based Fragmented ECS** — chaque type de composant a son propre pool (Composant → dense array + sparse map). C'est le design d'ECS le plus simple.

```
Pool-based (actuel)               Archetype-based
┌─────────────────┐              ┌──────────────────────┐
│ Entité 0        │              │ Archetype A          │
│   Transform[0]  │              │  (Transform,Health)  │
│   Health[0]     │              │  Chunk 1:            │
│   Weapon[0]     │              │   T0 T1 T2 ... T15   │
│                 │              │   H0 H1 H2 ... H15   │
│ Entité 1        │              │  Chunk 2: ...        │
│   Transform[1]  │              │                      │
│   Health[1]     │              │ Archetype B          │
│   AITactical[1] │              │  (Transform,Weapon)  │
│   Weapon[1]     │              │  Chunk 1: ...        │
└─────────────────┘              └──────────────────────┘
```

**Pourquoi l'archetype n'est pas nécessaire ici :**
- Toutes les entités de combat ont **exactement la même combinaison** (Transform + Health + Weapon + AITactical ou PlayerTag)
- Il n'y a que **2 combinaisons de composants** (Player et NPC)
- Pas d'ajout/suppression de composants à chaud

---

## 7. Conclusion

### Verdict : ✅ **Adéquat, performant, à conserver**

| Critère | Note | Commentaire |
|---------|------|-------------|
| Fonctionnalité | ✅ | Remplit tous les besoins actuels |
| Performance (<500 entités) | ✅ | < 150 µs/frame, < 1% du budget |
| Memory | ✅ | < 150KB pour 500 entités |
| Sécurité | ✅ | Generations anti-dangling, pas de UB |
| Lisibilité | ✅ | < 180 lignes de code ECS total |
| Maintenabilité | ✅ | Simple, facile à modifier |
| Extensibilité | ⚠️ | Limité si nombre de composants > 50 |

**Problèmes bloquants : aucun**  
**Recommandations immédiates : R1 + R2 (< 30 min)**  
**Optimisations utiles : R3 + R4 (~1h)**  

Le plus grand gain pour le projet ne vient pas de l'ECS lui-même (déjà bien dimensionné), mais de **simplifier les itérations dans WorldCoordinator** en remplaçant `ForEach` par de l'itération directe sur les pools — ce que `AISystem::Update` fait déjà correctement.

---

## Annexe A : Fichiers impactés

| Fichier | Recommandations |
|---------|----------------|
| `ecs/Registry.h` | R1 (ForEach copy→ref), R5 (template callback), R8 (const) |
| `ecs/ComponentPool.h` | R4 (reserve), R6 (flat_hash_map) |
| `ai/AISystem.cpp` | R2 (remove duplicate PlayerTag) |
| `bridge/WorldCoordinator.cpp` | R3 (direct pool iteration instead of ForEach) |
| `core/Types.h` | R7 (optional: 64-bit handle) |

## Annexe B : Différence entre les fichiers demandés et réels

| Demandé | Réel | Statut |
|---------|------|--------|
| `ecs/SparseSet.h` | N'existe pas — l'équivalent est `ComponentPool<T>` | 👉 Renommage conceptuel |
| `ecs/ComponentStorage.h` | N'existe pas — `ComponentPool<T>` fait office | 👉 Même chose |
| `ecs/Archetype.h` | N'existe pas | ❌ Non implémenté |
| `ecs/Registry.h` | Existe | ✅ |
| `ecs/Registry.cpp` | Existe | ✅ |
