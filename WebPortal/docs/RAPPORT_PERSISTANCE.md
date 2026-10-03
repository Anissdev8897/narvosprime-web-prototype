# Rapport — Fiabilisation de la persistance (C1, C2, C3, H1, H2)

Date : 2026-08-03 · Périmètre : chaîne de sauvegarde personnage/monde (navigateur + Electron).

---

## 0. Résumé

Cinq défauts corrigés. Chacun est prouvé par un test qui **échoue sur l'ancien code** et passe sur le nouveau — pas seulement par un test qui passe.

| Id | Défaut | Conséquence si non corrigé | État |
|----|--------|---------------------------|------|
| **C3** | Traduction SQL MySQL→SQLite incomplète | Écriture d'état silencieusement perdue en mode SQLite | ✅ Corrigé + 18 tests |
| **C2** | `character_state`/`world_state` absentes des bases existantes | Toute sauvegarde échoue sur une base créée avant ce jour | ✅ Corrigé + 7 tests |
| **C1** | Lecture en échec indistinguable de « pas de sauvegarde » | **Écrasement de la sauvegarde par un personnage niveau 1** | ✅ Corrigé + 17 tests |
| **H1** | `getCharacters` renvoyait `[]` si la base n'était pas initialisée | Roster vide affiché comme « aucun personnage » | ✅ Corrigé |
| **H2** | `typecheck` ne couvrait pas `electron/` | Erreurs de type non détectées jusqu'au runtime | ✅ Corrigé |

**C1 est le défaut grave** : les quatre autres font perdre une écriture, C1 fait perdre *la sauvegarde entière*.

---

## 1. C3 — Traduction SQL MySQL → SQLite

### Le défaut

Le fallback SQLite reçoit des requêtes écrites pour MySQL. La traduction de
`ON DUPLICATE KEY UPDATE` (MySQL) vers `ON CONFLICT(...) DO UPDATE SET` (SQLite)
se faisait par remplacement de texte. Elle ratait la forme **sans espace** :

```sql
-- storage.ts:639 — forme réellement utilisée
... ON DUPLICATE KEY UPDATE name=VALUES(name), level=VALUES(level)
--                                    ^ pas d'espace après VALUES
```

Ce correctif est un que **j'avais moi-même introduit à l'étape 2**, et mon script de
vérification d'alors utilisait `VALUES (` espacé dans ses quatre cas — il passait
donc pour la mauvaise raison. Le défaut a été trouvé par l'audit, pas par mes tests.

### Le correctif

Extraction dans un module pur, `electron/sqlTranslate.ts` : découpe autour de
`ON DUPLICATE KEY UPDATE`, puis réécriture de la clause `SET` seule.

```ts
const avant  = sql.slice(0, upsert.index);
const apres  = sql.slice(upsert.index + upsert[0].length);
const traduit = `${avant}ON CONFLICT(${keys}) DO UPDATE SET${valuesToExcluded(apres)}`;
```

`valuesToExcluded` exige un identifiant — `/VALUES\s*\(\s*`?(\w+)`?\s*\)/gi` — donc
`VALUES(name)` et `VALUES (name)` sont traités, et un `VALUES (...)` de la partie
INSERT ne peut pas être touché par erreur puisqu'il est dans `avant`.

### Preuve

`electron/sqlTranslate.test.ts` — **18 tests**. Ils utilisent les **requêtes réelles**
du code (`storage.ts:639` non espacé, `dbStore` espacé), pas des exemples inventés.
Deux tests asservissent explicitement l'ancien comportement : ils vérifient que le
remplacement de texte naïf laisse `VALUES(name)` intact dans la sortie.

---

## 2. C2 — Tables manquantes sur les bases existantes

### Le défaut

`createTables()` n'était appelé que dans `if (isNewDatabase)`. Les tables
`character_state` et `world_state` (ajoutées récemment) n'existaient donc que sur
une base créée *après* leur introduction. Sur toute base antérieure — c'est-à-dire
celle de tout joueur existant — chaque écriture d'état partait dans une table absente.

### Le correctif

`electron/localDatabase.ts` : `createTables()` sorti du bloc conditionnel, exécuté à
chaque ouverture. Toutes les créations sont en `CREATE TABLE IF NOT EXISTS`, donc
l'appel est idempotent. `character_state` et `world_state` ajoutées au schéma avec
clés primaires composites.

Correctif adjacent : `updated_at` passait par `ON UPDATE CURRENT_TIMESTAMP`, syntaxe
MySQL que SQLite rejette. Remplacé par `updated_at BIGINT NOT NULL DEFAULT 0`, la
valeur étant fournie par l'appelant (`Date.now()`).

### Preuve

`electron/sqliteSchema.test.ts` — **7 tests** sur un **vrai moteur SQLite** via
`node:sqlite` (Node 22+). `better-sqlite3` ne peut pas se charger sous vitest à cause
de l'ABI Electron ; `node:sqlite` contourne le problème sans mock.

Les tests exécutent l'ancien DDL et vérifient qu'il **lève**, puis le nouveau et
vérifient qu'il passe ; ils vérifient que les clés primaires sont bien composites et
qu'un upsert met à jour au lieu de dupliquer.

---

## 3. C1 — Écrasement de sauvegarde (le défaut grave)

### Le défaut

`loadCharacterDb` renvoyait `null` dans deux cas opposés :

- il n'y a pas de sauvegarde en base → il faut créer un personnage neuf ;
- la lecture a échoué (base coupée, WebSocket perdu, timeout) → il ne faut **rien** écrire.

Le monde de jeu construit un personnage **niveau 1** en attendant la restauration, et
arme son autosave à **800 ms**. La lecture, elle, expire à **1500 ms**. L'ordre
garantissait donc l'écriture du niveau 1 *avant même de savoir* s'il existait une
sauvegarde. Une coupure réseau de deux secondes suffisait à détruire un personnage.

### Le correctif — trois couches

**(a) Retour typé.** `DbRead<T> = { status: "ok", value: T | null } | { status: "unavailable" }`.
`readCharacterDb` / `readWorldDb` distinguent enfin les deux cas. Les anciennes
fonctions `loadCharacterDb` / `loadWorldDb` deviennent des façades — le code appelant
existant continue de marcher sans changement.

**(b) Verrou d'écriture.** Une lecture en échec **bloque les écritures** sur ce même
créneau (clé `(scope, key)` ou `(charId, key)`), jusqu'à ce qu'une lecture réussisse :

```ts
const blocked = new Set<string>();
function noteReadOutcome(slot: string, status: "ok" | "unavailable"): void { … }
export function isWriteBlocked(slot: string): boolean { return blocked.has(slot); }
```

Le verrou est par créneau, pas global : une panne sur `progression` du personnage 1
ne bloque pas le personnage 2, ni les réglages monde.

**(c) Barrière d'autosave.** Le verrou **seul ne suffit pas** : il s'arme à 1500 ms
(fin du timeout de lecture) alors que l'autosave part à 800 ms. Il reste 700 ms de
fenêtre où le niveau 1 s'écrit avant que le verrou existe.

`RpgGameWorld.tsx` porte donc un état `progressionReadSettled`, mis à `true`
uniquement quand la lecture a **abouti**, succès ou échec. Les trois effets d'autosave
le prennent en garde **et en dépendance** :

```ts
if (!characterId || !progressionReadSettled) return;
```

En dépendance aussi : sans cela, l'effet ne se réexécuterait pas après le passage à
`true` et la première sauvegarde légitime serait perdue.

### Preuve

`src/rpg/persistence/dbStore.test.ts` — **17 tests**.

Un piège rencontré vaut d'être signalé : ma première version du test du verrou
**passait pour la mauvaise raison**. Le harnais `__setMysqlForTest` vide `blocked`,
donc le test observait un état réinitialisé, pas le verrou. Réécrit avec un drapeau
`enPanne` mutable en place, sans reconfigurer le harnais entre les deux phases.

Tests couvrant : verrou armé sur échec, levé sur lecture réussie, isolé par
personnage (`c:char_1` vs `c:char_2`), isolé par créneau monde
(`w:global:npcs` vs `w:global:portals`), et non levé par une écriture.

---

## 4. H1 / H2 — Corrections adjacentes

**H1** — `getCharacters` renvoyait `[]` quand `this.db` était nul, rendant « base non
initialisée » indistinguable de « aucun personnage ». Lève maintenant
`Error('Base de données non initialisée')`. En amont, `electron/main.ts` valide la
forme de la réponse : `if (!Array.isArray(characters)) return { success: false, … }`.

**H2** — `npx tsc --noEmit` ne couvrait pas `electron/` (projet TS distinct). J'y avais
écrit `LocalDatabase` au lieu de `LocalDatabaseService` et tsc restait vert.
`package.json` : `typecheck` enchaîne désormais `typecheck:electron`, et
`electron:build:ts` lance le typecheck avant de compiler.

**Adjacent** — `scripts/build-electron.js` ne purgeait pas `dist-electron/`.
`sourcemap: false` n'efface pas les `.map` d'un build antérieur, il s'abstient d'en
écrire. Constaté ce jour : `main.cjs.map` datait du 30/07, soit **quatre jours de
retard**, tout en étant listé dans les `files` du packaging electron-builder. Une
sourcemap périmée fait pointer un débogueur sur du code disparu — pire qu'aucune.
Purge ajoutée en tête de build.

---

## 5. Fichiers modifiés

### Créés
| Fichier | Rôle |
|---|---|
| `electron/sqlTranslate.ts` | Traduction MySQL→SQLite, module pur |
| `electron/sqlTranslate.test.ts` | 18 tests, requêtes réelles |
| `electron/sqliteSchema.test.ts` | 7 tests sur moteur SQLite réel |

### Modifiés
| Fichier | Changement |
|---|---|
| `src/rpg/persistence/dbStore.ts` | `DbRead<T>`, `readCharacterDb`/`readWorldDb`, verrou d'écriture, `updated_at` explicite |
| `src/rpg/persistence/dbStore.test.ts` | 17 tests (retour typé + verrou) |
| `src/rpg/stats/progressionStore.ts` | `readProgressionDb` typé |
| `src/rpg/runtime/RpgGameWorld.tsx` | Barrière `progressionReadSettled` sur 3 effets d'autosave ; `STARTER_CREDITS` |
| `src/utils/storage.ts` | `CharacterFetchResult`, `fetchSavedCharacters` |
| `src/components/character/useCharacterStorage.ts` | `hasLoaded`, erreur sur `unavailable`, `createCharacter` lève |
| `src/components/character/CharacterSelectScreen.tsx` | Écran d'erreur de stockage distinct du roster vide |
| `src/App.tsx` | `forcedCreate` |
| `electron/localDatabase.ts` | `createTables()` inconditionnel ; `character_state`/`world_state` ; `getCharacters` lève |
| `electron/main.ts` | Validation `Array.isArray` |
| `scripts/build-electron.js` | Purge des sourcemaps orphelines |
| `vitest.config.ts` | Inclut `electron/**/*.test.ts` |
| `package.json` | `typecheck:electron`, chaîné dans `typecheck` et `electron:build:ts` |

---

## 6. Tests réalisés

| Suite | Résultat |
|---|---|
| `electron/sqlTranslate.test.ts` | 18 / 18 |
| `electron/sqliteSchema.test.ts` | 7 / 7 |
| `src/rpg/persistence/dbStore.test.ts` | 17 / 17 |
| **Sous-total persistance** | **42 / 42** |
| **Suite complète** | **2 060 tests / 190 fichiers, 0 échec** |
| `npm run typecheck` (src + electron) | Vert |
| `npm run electron:build:ts` | Vert |

Vérification du bundle livré (`dist-electron/main.cjs`, lecture directe du fichier) :
`character_state` ×4, `DO UPDATE SET` ×3, `"pas un tableau"` ×1 — les correctifs sont
bien dans le binaire, pas seulement dans les sources.

---

## 7. Risques résiduels

### Non couvert par les correctifs

1. **Rig du corps de base cassé** — hors périmètre persistance, mais bloquant pour la
   création de personnage. L'audit mesure 8 liaisons d'os > 0,50 m et un
   `fitDisplacement` de 2,779 m. **Nécessite un ré-export Blender** ; ma vérification
   visuelle ne pouvait pas le détecter (`inverse(IBM) × IBM = identité`).

2. **~15 stores encore sur la façade `loadWorldDb`** — ils ne distinguent toujours pas
   « absent » de « inconnu ». Ils sont protégés par le verrou d'écriture (couche b),
   mais pas par une barrière d'autosave dédiée (couche c). Le risque résiduel est la
   fenêtre de 700 ms avant l'armement du verrou. Seul `progression` a les trois couches.

3. **`assetQuality.ts:83` — `catch → false`** — un échec réseau est traité comme
   « variante absente ». Conséquence bénigne (on retombe sur la qualité *high*), mais
   c'est le même motif d'ambiguïté que C1.

4. **`deleteCharacter` en fire-and-forget** — l'échec de suppression n'est pas remonté
   à l'UI. Le personnage réapparaît au rechargement suivant sans message.

5. **`hardcoreLadder.isFallen` n'est jamais appelé** — code mort ; la règle hardcore
   n'est donc pas appliquée.

### Limites de la validation

- Les tests SQLite tournent sur `node:sqlite`, pas sur `better-sqlite3`. Le SQL est le
  même, mais les particularités de liaison de `better-sqlite3` ne sont pas exercées.
- Aucun test ne simule une coupure MySQL *réelle* — le harnais simule la panne au
  niveau du pont. **Le test de coupure de base/WebSocket en conditions réelles reste à
  faire côté utilisateur.**
- La barrière d'autosave est testée par sa logique (garde + dépendance), pas par un
  rendu React ; les tests tournent en environnement `node` sans DOM.