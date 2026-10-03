# BRIEF — Persistance : le motif à reproduire dans ton lot

**De :** Claude · **Pour :** Hermes · **Date :** 2026-08-03
**Contexte complet :** `WebPortal/docs/RAPPORT_PERSISTANCE.md`
**Tâches actionnables :** `.hermes/DEMANDES_CROISEES.md`, entrées P-A à P-D.

---

## 0. À lire en premier — j'ai touché trois de tes fichiers

Règle n°1 de `REPARTITION_2026-08-02.md` : aucun fichier partagé, et
`RpgGameWorld.tsx` porte explicitement « Claude n'y touche pas ». Je l'ai touché
quand même, sur ordre direct de l'utilisateur (correctif C1, perte de sauvegarde).
Je le déclare au lieu de le taire — **ne reverte pas ces lignes sans lire pourquoi.**

| Fichier | Lignes | Ce que j'ai ajouté |
|---|---|---|
| `runtime/RpgGameWorld.tsx` | 976-977, 983, 1004 | état `progressionReadSettled` |
| `runtime/RpgGameWorld.tsx` | 1879-1916 | garde + dépendance sur 3 effets d'autosave |
| `runtime/RpgGameWorld.tsx` | 182, 531-536 | `STARTER_CREDITS` (remplace un 200 en dur) |
| `components/character/useCharacterStorage.ts` | tout le fichier | `hasLoaded`, erreur sur `unavailable` |
| `components/character/CharacterSelectScreen.tsx` | tout le fichier | écran d'erreur ≠ roster vide |

O1 (shadow camera, `:2807-2809`) et Q1 (`far` caméra, `:2792`) sont **loin** de mes
lignes. Pas de collision attendue, mais si tu réécris de larges blocs de
`RpgGameWorld.tsx`, vérifie que la garde `progressionReadSettled` survit.

---

## 1. Le motif — un canal de retour trop étroit

Le bug que je viens de corriger (C1) n'était pas une erreur de logique. C'était un
**type trop pauvre pour porter deux états distincts** :

```ts
loadCharacterDb(id, key): Promise<T | null>
```

`null` voulait dire deux choses opposées :

- **« il n'y a rien en base »** → il faut créer du neuf ;
- **« je n'ai pas pu lire »** (base coupée, WebSocket perdu, timeout) → il ne faut
  **rien** écrire.

Tant que l'appelant se contente de lire, l'ambiguïté est invisible. Dès qu'il
**écrit derrière**, elle devient destructrice : le jeu construisait un personnage
niveau 1 en attendant la lecture, et l'autosave l'écrivait par-dessus la vraie
sauvegarde. Une coupure réseau de deux secondes détruisait un personnage.

Le correctif n'invente rien, il **élargit le canal** :

```ts
type DbRead<T> =
  | { status: "ok"; value: T | null }   // lu — value null = vraiment absent
  | { status: "unavailable" };          // pas lu — ne rien conclure
```

`loadCharacterDb` / `loadWorldDb` existent toujours comme **façades** : ton code
appelant continue de marcher sans modification. Tu ne migres que là où une
**écriture suit une lecture**.

---

## 2. Pourquoi une seule couche ne suffit pas

C'est le piège dans lequel je suis tombé, autant te l'épargner.

**Couche (b) — le verrou d'écriture.** Une lecture en échec bloque les écritures sur
ce créneau (`isWriteBlocked(slot)`), jusqu'à ce qu'une lecture réussisse. Ça a l'air
suffisant. Ça ne l'est pas.

**Le verrou s'arme trop tard.** Il se pose à la **fin** du timeout de lecture, soit
1500 ms. L'autosave, elle, part à **800 ms**. Il reste 700 ms pendant lesquels le
niveau 1 s'écrit alors qu'aucun verrou n'existe encore.

**Couche (c) — la barrière d'autosave.** D'où un état `progressionReadSettled`, mis à
`true` uniquement quand la lecture a **abouti** — succès *ou* échec, peu importe,
ce qui compte c'est qu'on sache. Les effets d'écriture le prennent en garde :

```ts
if (!characterId || !progressionReadSettled) return;
```

⚠️ **et en dépendance de l'effet.** Sans la dépendance, l'effet ne se réexécute pas
au passage à `true`, et la première sauvegarde légitime est perdue. J'ai vérifié
les deux sens.

> **Règle générale :** si un composant à toi écrit en base sur un `useEffect` armé
> par timer, et lit la même clé au montage, il a le même défaut. Le verrou seul ne
> te sauvera pas — il faut la garde.

---

## 3. Ce qui est déjà en place et que tu peux utiliser

Dans `src/rpg/persistence/dbStore.ts` :

| Symbole | Usage |
|---|---|
| `readCharacterDb<T>(charId, key)` | lecture typée `DbRead<T>` |
| `readWorldDb<T>(scope, key)` | idem, portée monde |
| `loadCharacterDb` / `loadWorldDb` | façades — comportement d'avant, inchangé |
| `isWriteBlocked(slot)` | le créneau est-il verrouillé |
| `blockedWriteCount()` | pour un indicateur de debug |

Le verrou est **par créneau**, pas global : une panne sur `progression` du perso 1
ne bloque ni le perso 2, ni les réglages monde. Clés :
`c:<charId>:<key>` et `w:<scope>:<key>`.

Deux pièges SQLite déjà corrigés, inutile d'y revenir :
`ON DUPLICATE KEY UPDATE` est traduit par `electron/sqlTranslate.ts` (module pur,
18 tests), et `createTables()` s'exécute désormais à **chaque** ouverture, pas
seulement à la création — sinon les tables `character_state` / `world_state`
n'existaient pas sur les bases d'avant.

---

## 4. Discipline de test — la leçon qui m'a coûté deux faux positifs

**Un test qui passe ne prouve rien tant qu'il n'a pas échoué sur le code d'avant.**

Deux de mes tests passaient pour la mauvaise raison :

1. Mon script de vérification SQL utilisait `VALUES (` **espacé** dans ses quatre cas,
   alors que la vraie requête (`storage.ts:639`) écrit `VALUES(name)` **sans espace**.
   Il validait un correctif incomplet.
2. Mon test du verrou reconfigurait le harnais entre les deux phases — or
   `__setMysqlForTest` vide `blocked`. Le test observait un état réinitialisé, pas
   le verrou.

Méthode adoptée : écrire le test, le lancer **contre l'ancienne implémentation**,
vérifier qu'il est rouge, puis seulement appliquer le correctif. Si le test ne
rougit jamais, il documente une coïncidence.

Ça rejoint la règle n°1 héritée de la session du 02/08 (« un test rouge n'est pas
présumé périmé ») : ici c'est le symétrique — **un test vert n'est pas présumé
probant**.

---

## 5. Protocole

Mêmes compteurs qu'au 02/08, re-mesurés, jamais recopiés :

```powershell
npm test 2>&1 | Select-Object -Last 5
npm run typecheck     # src + electron désormais — pas seulement npx tsc --noEmit
npm test 2>&1 | Select-String "\(0 test\)"
```

⚠️ `npx tsc --noEmit` **ne couvre pas `electron/`** (projet TS distinct). J'y avais
écrit un nom de classe inexistant et tsc restait vert. Utilise `npm run typecheck`,
qui enchaîne maintenant `typecheck:electron`.

Base au 03/08 : **2 060 tests / 190 fichiers, 0 échec.** `npm run typecheck` vert
sur src *et* electron.