# AUDIT SAUVEGARDE NARVOS PRIME — 30/07/2026

**Fichiers audités** : `dbStore.ts`, `utils/storage.ts`, `progressionStore.ts` + **47 stores localStorage** recensés (23 avec DB bridge, 3 sans, + utils/App/AudioManager).

---

## 🔴 CRITIQUE — 5 problèmes

### 1. Schéma non versionné sur 9 stores personnage
**Impact** : Données corrompues silencieusement si le schéma change.

Les clés des stores **personnage** (progression, quests, professions, archetype, reputation, pets, consumableSlots, tint/model) n'ont **PAS** de suffixe `:v1`/`:v2`. Si la structure des données évolue (ex: nouveau champ obligatoire), l'ancien JSON est lu tel quel → champs `undefined`, comportement imprévisible.

**Contraste** : Les stores **monde/admin** sont versionnés : `narvos:settings:v1`, `narvos:world_state:v1`, `narvos:animoverride:v2`, `narvos:characteroffset:v3`.

**Fichiers concernés** :
- `src/rpg/stats/progressionStore.ts` → clé `narvos:progress:${charId}`
- `src/rpg/quests/questStore.ts` → clé `narvos:quests:${charId}`
- `src/rpg/professions/professionStore.ts` → clé `narvos:professions:${charId}`
- `src/rpg/archetypes/archetypeStore.ts` → clé `narvos:archetype:${charId}`
- `src/rpg/reputation/reputationStore.ts` → clé `narvos:reputation:${charId}`
- `src/rpg/pets/petStore.ts` → clé `narvos:pets:${charId}`
- `src/rpg/loot/consumableSlots.ts` → clé `narvos:consumableSlots:${charId}`
- `src/rpg/persistence/appearance.ts` → clés `narvos:tint:${charId}`, `narvos:model:${charId}`

### 2. 3 stores sans AUCUNE intégration base de données
**Impact** : Données perdues en Electron si la machine change ou si localStorage est vidé.

`petStore`, `ammoStore`, `reputationStore` écrivent **uniquement** en localStorage. Aucun appel à `saveCharacterDb()`/`saveWorldDb()`. Les autres stores personnage ont tous un bridge DB.

| Store | localStorage | DB bridge | Gravité |
|-------|-------------|-----------|---------|
| petStore | ✅ | ❌ | Perte des pets possédés, niveaux |
| ammoStore | ✅ | ❌ | Perte des munitions |
| reputationStore | ✅ | ❌ | Perte de la réputation par faction |

### 3. ammoStore est GLOBAL, pas par personnage
**Impact** : Tous les personnages partagent la même réserve de munitions.

Clé unique `narvos:ammo` sans `charId`. Si on change de perso, on hérite des flèches/cellules du précédent. Aucune isolation.

### 4. petStore et reputationStore : pas d'hydratation DB asynchrone
**Impact** : En Electron, la base est source de vérité mais ces stores ne la lisent jamais.

Les autres stores personnage (progression, quests, professions, archetype, consumableSlots) font `loadCharacterDb().then(db => ...)` après `load()`. petStore a `init()` mais ne fait que `load()` depuis localStorage. reputationStore idem. Donc même si des données existent en base MySQL, elles sont ignorées.

### 5. Conflit localStorage vs DB — pas de stratégie de merge
**Impact** : L'hydratation DB écrase silencieusement le localStorage.

Séquence type : 
1. Le joueur joue → écriture synchrone localStorage + écriture asynchrone débouncée DB
2. Plus tard, `hydrate()` charge la DB → **remplace** l'état mémoire par la valeur DB
3. Si la DB a une version périmée (débounce pas encore flushé, ou autre client), les données récentes localStorage sont perdues

Aucun mécanisme de `lastWriteTimestamp` ou de merge champ par champ.

---

## 🟠 MEDIUM — 5 problèmes

### 6. Pas de système de migration structuré (sauf gameSettings)
**Impact** : Évolution du schéma = rustines manuelles dans sanitize().

Seul `gameSettings.ts` a un vrai système de migration (`SETTINGS_MIGRATION = 2` avec `migration` persisté). Les autres stores utilisent `sanitize()`/`fromPartial()` qui répare les données à CHAQUE chargement sans persister la correction. Fonctionnel mais :

- La réparation est rejouée à chaque démarrage (coût CPU négligeable mais design fragile)
- Si un jour on veut changer la structure radicalement (ex: renommer un champ), sanitize ne suffira pas

### 7. Débounce DB = fenêtre de perte de 700ms
**Impact** : Crash pendant les 700ms de debounce → données DB périmées.

`saveCharacterDb`/`saveWorldDb` ont un debounce de 700ms. `flushDb()` est appelé au `beforeunload`, mais pas sur crash/kill process. Le localStorage, lui, est écrit **instantanément** → cohérence localStorage/DB non garantie après crash.

### 8. Pas de quota management
**Impact** : localStorage plein → données perdues silencieusement.

TOUS les stores font `catch { /* quota */ }` sans logger ni prévenir. L'utilisateur ne sait jamais que ses données n'ont pas été sauvegardées. Aucune estimation de l'espace utilisé, aucun nettoyage automatique.

### 9. Deux systèmes de persistance indépendants
**Impact** : Complexité, duplication, risque de divergence.

| Système | Stockage | Usage |
|---------|----------|-------|
| `utils/storage.ts` | IndexedDB + MySQL direct | CRUD personnages, maps, sprites, objets, factions |
| `rpg/persistence/dbStore.ts` | MySQL `character_state`/`world_state` | État runtime (progression, quêtes, settings, admin) |

Pas de coordination entre les deux. Les personnages sont créés via `storage.ts` (table `characters`) mais leur état runtime vit dans `dbStore` (table `character_state`). Deux connexions MySQL, deux schémas, deux philosophies.

### 10. IndexedDB (storage.ts) : pas de migration entre versions
**Impact** : DB_VERSION=4 codé en dur, `onupgradeneeded` ne gère que la création.

Si on passe de v4 à v5, `onupgradeneeded` est appelé mais ne fait que `createObjectStore` (no-op si existe déjà). Aucune migration de données entre versions. Si le schéma d'un object store change, les anciens enregistrements deviennent invalides.

---

## 🟢 LOW — 3 problèmes

### 11. Pas de validation de schéma à l'écriture
Les stores écrivent l'état complet sans valider la structure. Un bug mémoire pourrait écrire `{stats: undefined}` et corrompre la sauvegarde.

### 12. Clés localStorage non préfixées par environnement
Toutes les clés sont en `narvos:*`. Pas de distinction dev/prod/staging → les données de dev écrasent celles de prod sur la même machine.

### 13. `App.tsx` et `LoginScreen.tsx` écrivent directement en localStorage
Ces composants font `localStorage.setItem("narvos_user", ...)` sans passer par le bridge DB → le `currentUsername()` de dbStore lit ce localStorage pour scoper les user-data.

---

## 📊 RÉCAPITULATIF

| Catégorie | Count |
|-----------|-------|
| Stores monde/admin (versionnés, DB bridge) | 22 |
| Stores personnage (versionnés, DB bridge) | 5 |
| Stores personnage (NON versionnés, avec DB bridge) | 6 |
| Stores personnage (NON versionnés, SANS DB bridge) | 3 |
| Stores globaux (versionnés, DB bridge) | 3 |
| Stores globaux (NON versionnés, SANS DB bridge) | 1 (ammo) |
| **Total stores localStorage** | **40+** |

---

## 🔧 RECOMMANDATIONS (priorisées)

1. **Ajouter `:v1` sur les 9 clés personnage** + migration lecture ancienne clé → nouvelle clé
2. **Ajouter `saveCharacterDb` dans petStore et reputationStore** + hydratation asynchrone
3. **Scoper ammoStore par personnage** (`narvos:ammo:${charId}`) + bridge DB
4. **Stratégie de merge localStorage↔DB** basée sur `updatedAt` (last-write-wins)
5. **Logger les erreurs quota** (console.warn + éventuellement toast UI)
6. **Unifier les deux systèmes de persistance** à terme (storage.ts → dbStore.ts)
7. **Généraliser le pattern de migration de gameSettings.ts** à tous les stores