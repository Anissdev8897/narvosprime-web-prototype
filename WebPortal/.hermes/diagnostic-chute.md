## DIAGNOSTIC COMPLET — debug.log Narvos WebPortal

### 🔴 CRITIQUE : Boucle de chute infinie (6 chutes, même position)

**Symptôme** : Le personnage "valkiria" tombe en boucle depuis `(-264.9, -38.x, 298.2)` sur la map "forge". Le `fallThreshold` retourne `-38.2` — une valeur dangereusement proche du sol.

**Cause racine (2 bugs combinés)** :

#### Bug A — `fallThreshold` non protégé contre un spawnPoint corrompu
Dans `CharacterController.ts:33-43` :
```ts
function fallThreshold(mapId: string): number {
  const spawnY = mapSpawn(mapId)[1];          // ← peut être corrompu via spawnPointStore
  const seuil = mapBoundsStore.fallFloor(mapId, spawnY - FALL_MARGIN);
  return Math.min(seuil, spawnY - FALL_MARGIN); // ← si spawnY ≈ 162, le seuil = -38.2
}
```
Si `spawnPointStore` contient un Y aberrant (~161.8) pour "forge", `spawnY - 200 = -38.2`.  
Le `Math.min` ne protège pas contre ça car il minore avec la valeur déjà faussée.

La position de chute (-264.9, -38.6, 298.2) est probablement la **position sauvegardée** du personnage (via `loadProgression`), chargée à la place du spawn normal.

#### Bug B — Absence d'anti-rebond dans le respawn
`CharacterController.ts:292-308` : le filet de sécurité détecte la chute, appelle `mapSpawn(mapId)`, et replace le joueur. Mais si `mapSpawn` retourne un point lui aussi problématique (même position corrompue, ou zone sans collision), le joueur retombe immédiatement → **boucle infinie**.

Il n'y a **aucune** détection de rebond : pas de compteur de chutes rapprochées, pas de fallback absolu.

### 🟡 Connexion DB échouée
`storage.ts:28` : `DATABASE CONNECTION FAILED: DB non initialisée`  
→ Problème d'init MySQL/IndexedDB en mode Electron. Ne bloque pas le jeu mais empêche la persistance.

### 🟡 Filet de sécurité 2 min
`App.tsx:83` : Le chargement a pris >2 min → l'écran de chargement est forcé.  
Conséquence directe de la boucle de chute : le jeu n'atteint jamais l'état "ready" normalement.

### 🟢 SSAO warning (bénin)
`NormalPass` manquant dans `EffectComposer`. Ne casse rien.

---

## CORRECTIONS À APPLIQUER

### 1. `CharacterController.ts` — fallThreshold robuste (P0)
- Ne PAS utiliser `mapSpawn` pour calculer le seuil (trop fragile)
- Utiliser `getGroundY` à la position de spawn pour mesurer le VRAI sol
- Si pas de sol mesurable → fallback à -10000 (assez bas pour ne jamais trigger)

### 2. `CharacterController.ts` — anti-rebond (P0)
- Si >2 chutes en <5 secondes → forcer un respawn HORS map (y=+500, le temps que les chunks chargent)
- Logger le diagnostic pour identifier le spawnPoint corrompu

### 3. `mapConfig.ts` — validation spawnPoint (P1)
- Ajouter une vérification que le spawnPoint n'est pas dans le vide (getGroundY non null)
- Si corrompu → fallback au MAP_SPAWN statique