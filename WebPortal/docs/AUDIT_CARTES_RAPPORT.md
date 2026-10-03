# 📊 AUDIT SYSTÈME DE CARTES — RAPPORT COMPLET

**Équipe AUDIT CARTES** | 5 agents | Juillet 2026

> Fichiers audités : StreamingPuzzleMap.tsx, chunkCache.ts, mapBoundsStore.ts, mapBoundsFit.ts, mapConfig.ts, assetManifest.ts, forgeChunks.ts, envelopingShell.ts, streamingDiagnostics.ts, spawnPointStore.ts, CollisionWorld.ts, MAPS_LOADING_ANALYSIS.md, chunk-metadata.json (×4)

---

## SYNTHÈSE EXÉCUTIVE

| Priorité | Problèmes | Impact |
|----------|-----------|--------|
| 🔴 **CRITIQUE** | 2 | Orbital culling inefficace (rayons 30k+) + cache sans éviction |
| 🟠 **HAUTE** | 3 | Déséquilibre poids chunks Forge (×8), version manuelle cache, maps OBJ/MTL mortes |
| 🟡 **MOYENNE** | 4 | Pas de monitoring cache, timeout 90s, validation clearance croisée, fallback séquentiel sans budget |
| 🟢 **BASSE** | 3 | Offset orbital incertain, maps legacy non-streamées, dépendance C++ non testée |

---

## 1. 🔴 STREAMING — StreamingPuzzleMap.tsx

### 1.1 Architecture
```
WASM actif ?
  ├─ OUI → initStreaming(budget, maxLoaded, loadRadius, unloadRadius)  
  │        tickStreaming() / drainStreamingCommands() chaque frame
  │        2 charges concurrentes max (MAX_CONCURRENT=2)
  │        Tous les chunks = essentiels (chargés avant reveal)
  │
  └─ NON → Sequential fallback (1 par 1 avec rAF)
```

### 1.2 Problèmes Identifiés

#### 🔴 1.2.1 — Orbital : rayons de culling WASM inefficaces
Les métadonnées Orbital incluent la coque enveloppante :
- Chunk 7 : **rayon 30 837 unités** (vs 109–2534 pour la Forge)
- Le code Three.js corrige en calculant `bbox.getBoundingSphere()` **après exclusion des coques**, mais le **C++ WASM** utilise les métadonnées brutes
- **Impact** : le WASM ne déclenche jamais d'unload (tout est « en vue ») → pression VRAM permanente → perte de contexte

#### 🔴 1.2.2 — Safety timeout 90s trop long
```typescript
const SAFETY_MS = 90_000; // 90 secondes !
```
- Si un chunk est bloqué (réseau, OOM), l'écran de chargement reste 90s
- La soupape App.tsx est à 120s → le pipeline lourd continue PENDANT le gameplay

#### 🟡 1.2.3 — Fallback séquentiel sans budget VRAM
```typescript
// Lignes 1000-1016 : après échec WASM, charge TOUS les chunks
for (const chunk of metaRef.current) {
  await doLoadChunk(chunk.id);  // Pas de maxLoaded!
}
```
- Sans WASM : pas de `setLoadedChunks` jusqu'au completeFired
- Aucun budget VRAM respecté en fallback

#### 🟢 1.2.4 — offset Y = -50 pour Orbital discutable
Les centres Y des chunks Orbital vont de **-1465 à +1260**
- L'offset [0, -50, 0] ne centre rien → vérifier sol réel

### 1.3 Optimisations Recommandées

| # | Action | Effort | Gain |
|---|--------|--------|------|
| **S1** | Transmettre les sphères corrigées (sans coque) au C++ WASM via `registerStreamingChunk` | 2j | 🔴 Critique |
| **S2** | Réduire SAFETY_MS de 90s → 30s avec progression visible | 1h | 🟡 Moyen |
| **S3** | Ajouter `maxLoaded` au fallback séquentiel + budget VRAM approximatif | 1j | 🟡 Moyen |
| **S4** | Recalculer offset Orbital par sondes verticales (comme la Forge) | 1j | 🟢 Basse |

---

## 2. 🔴 CACHE — chunkCache.ts

### 2.1 Architecture
```
IndexedDB: narvos-chunk-cache / store "chunks"
  - Clé = URL du fichier
  - Valeur = ArrayBuffer complet
  - Cache_VERSION = 8 (manuel)
  - Fingerprint validation (C++ contre JS)
  - Même store pour CHUNKS + ASSETS (getCachedAsset = getCachedChunk)
```

### 2.2 Problèmes Identifiés

#### 🔴 2.2.1 — Aucune politique d'éviction
- Pas de LRU, pas de quota, pas de TTL
- `store.put(data, url)` écrit indéfiniment
- **Conséquence** : IndexedDB peut saturer (limite navigateur : ~50% de l'espace disque ou ~2 Go)
- Pas de `getSize()` / quota tracking

#### 🟡 2.2.2 — Version manuelle (cache_version = 8)
- Chaque régénération d'assets nécessite un bump manuel
- Oubli → le cache sert des données obsolètes (déjà arrivé aux versions 3,4,5,6,7)
- Aucun mécanisme automatique (hash du chunk-metadata.json)

#### 🟡 2.2.3 — Cross-catégorie cache invalidation
```typescript
export const getCachedAsset = getCachedChunk;
export const storeCachedAsset = storeCachedChunk;
```
- `validateCacheFingerprint()` purge le store ENTIER si fingerprint mismatch
- `validateAssetFingerprint()` fait pareil
- **Impact** : un mismatch fingerprint des chunks purge AUSSI tous les assets in-game
- Deux clés fingerprint (`__narvos_chunk_fingerprint__` et `__narvos_asset_fingerprint__`) mais UN SEUL store → purge atomique

#### 🟡 2.2.4 — Aucun monitoring du cache
- `streamingDiagnostics` ne tracke pas cache hit/miss
- Impossible de savoir si l'IDB accélère ou ralentit
- Les logs disent "chargé en Xms" mais ne distinguent pas réseau vs cache

### 2.3 Optimisations Recommandées

| # | Action | Effort | Gain |
|---|--------|--------|------|
| **C1** | Ajouter LRU + quota max (ex: 500 Mo) avec éviction FIFO à l'écriture | 3j | 🔴 Critique |
| **C2** | Hash automatique (SHA-1 du chunk-metadata.json + filenames) au lieu de version manuelle | 2j | 🟡 Haut |
| **C3** | Stores séparés pour chunks vs assets (ou validation indépendante) | 2j | 🟡 Haut |
| **C4** | Track cache hit/miss dans streamingDiagnostics + timeline | 1j | 🟡 Moyen |
| **C5** | Compresser les ArrayBuffers avec CompressionStream API avant stockage IDB | 3j | 🟢 Basse |

---

## 3. 🟠 CHARGEMENT — Poids et Métadonnées des Chunks

### 3.1 Forge (chunks_v3) — 752 Mo total

| Chunk | High (GLB) | Medium | Low | VertexCount | Rayon |
|-------|-----------|--------|-----|-------------|-------|
| 01 | 36 Mo | 29 Mo | 12 Mo | 259 411 | 2534 |
| 02 | 29 Mo | 21 Mo | 8,4 Mo | 275 018 | 1130 |
| 03 | 80 Mo | 61 Mo | 20 Mo | 209 680 | 659 |
| 04 | 34 Mo | 19 Mo | 7,7 Mo | 234 206 | 651 |
| 05 | 27 Mo | 12 Mo | 4,8 Mo | 208 772 | 469 |
| **06** | **100 Mo** | **85 Mo** | **27 Mo** | 238 139 | 1431 |
| 07 | 25 Mo | 9,7 Mo | 4,2 Mo | 177 436 | 109 |
| 08 | 55 Mo | 41 Mo | 14 Mo | 196 512 | 677 |

**Déséquilibre ×4 en high, ×8 en medium**. Le chunk 06 est un goulet d'étranglement.

### 3.2 Orbital — 181 Mo total

| Chunk | High | Medium | Low | VertexCount | **Rayon 3D** |
|-------|------|--------|-----|-------------|--------------|
| 01 | 8,5 | 8,4 | 6,2 | 872 011 | **19 334** |
| 02 | 8,9 | 8,8 | 6,5 | 1 036 567 | **7 656** |
| 03 | 12 | 11 | 7,9 | 758 225 | **18 675** |
| 04 | 9,3 | 9,1 | 6,4 | 615 617 | **8 182** |
| 05 | 5,7 | 5,7 | 5,2 | 757 962 | **4 418** |
| 06 | 6,9 | 6,9 | 5,4 | 598 524 | **4 378** |
| 07 | 7,0 | 7,0 | 6,1 | 791 741 | **7 087** |
| 08 | 8,4 | 8,4 | 7,1 | 803 927 | **30 837** |

Les rayons incluent la coque enveloppante dans les métadonnées → streaming WASM faussé.

### 3.3 Optimisations Recommandées

| # | Action | Effort | Gain |
|---|--------|--------|------|
| **M1** | Rééquilibrer les chunks Forge : split chunk_06, merge chunk_07 (cible ~40-50 Mo/chunk) | 4j | 🟠 Haut |
| **M2** | Régénérer chunk-metadata.json Orbital SANS la coque (filtrer `isEnvelopingShell` dans le script) | 1j | 🔴 Critique |
| **M3** | Ajouter une vérification CI : alerter si un chunk > 2× la médiane du groupe | 1j | 🟢 Basse |

### 3.4 Comparaison v2 → v3 (Forge)

| Métrique | v2 (chunks) | v3 (chunks_v3) | Amélioration |
|----------|-------------|-----------------|--------------|
| Nodes/chunk | 1623-1624 | 900-901 | ✅ Plus homogène |
| Vertex total | ~2,9 M | ~1,8 M | ✅ -38 % (pruning) |
| Rayons | 213-1676 | 109-2534 | ⚠️ Disparité accrue |
| Couverture | bucketing par sommets | spatial k-d tree (XZ) | ✅ Spatial correct |

---

## 4. 🟠 COQUES ENVELOPPANTES — envelopingShell.ts

### 4.1 Critères Actuels
```typescript
DIAGONALE_MIN = 4000    // Unité monde
EPAISSEUR_MIN = 1500    // Plus petit axe (manquait → sol traversable)
TRIANGLES_MAX = 5000    // Max triangles
```

### 4.2 Fonctionnement
- Testée en **espace monde** (`applyMatrix4`) → correct
- Exclue de la **collision** (StreamingPuzzleMap ligne 494)
- Exclue du **calcul de sphère de culling** (StreamingPuzzleMap ligne 568)
- Exclue du **fit de limites** (mapBoundsFit ligne 61)
- **RENDUE** visuellement (ne disparaît pas)

### 4.3 Problèmes
- Forge v3 avait 4 faux positifs (sol type `ground_with_grass`, `cliff_blend_005`) → **corrigé** par l'ajout d'EPAISSEUR_MIN
- Aucun test pour les chunks Orbital (métadonnées toujours contaminées)

### 4.4 Recommandation
| # | Action | Effort | Gain |
|---|--------|--------|------|
| **E1** | Ajouter un test unitaire qui vérifie qu'aucun chunk Orbital n'a de coque dans ses métadonnées | 2h | 🟡 Moyen |

---

## 5. 🟠 LIMITES DE MAP — mapBoundsStore.ts / mapBoundsFit.ts

### 5.1 Architecture
```
mapBoundsStore:
  - Persistance: localStorage + world DB
  - Deux modes: block (volume interdit, test 3D) / keepIn (volume autorisé, test XZ)
  - fallY = null → auto-calculé depuis le bas des keepIn
  - MARGE_CHUTE = 300 unités dans le calcul automatique

mapBoundsFit:
  - Mesure sur géométrie RÉELLE + points PNJ
  - Exclut les coques
  - Marge = 30 unités
```

### 5.2 Problèmes
- **Aucune limite définie** pour Orbital (fallback sur VIDE)
- `blocksActive()` retourne `false` si `activeMap` est vide → joueur peut sortir du monde
- MARGE_CHUTE = 300 unités pourrait être trop sur Orbital (échelle verticale -1465 à +1260)
- Pas de `keepIn` par défaut pour les maps streamées

### 5.3 Recommandations
| # | Action | Effort | Gain |
|---|--------|--------|------|
| **B1** | Poser un `keepIn` par défaut sur Orbital depuis les métadonnées des chunks | 1j | 🟠 Haut |
| **B2** | Automatiser le fit des limites au build (via `fitMapExtent` sur la map complète) | 2j | 🟡 Moyen |

---

## 6. 🟡 MAP CONFIG — mapConfig.ts

### 6.1 Spawn Points
```typescript
forge:          [0, 5, 10]
donjon_furiste: [0, 6, 34]
orbital:        [1000, 50, 0]   // Ajusté manuellement le 28/07
// Fallback global: [0, 5, 0]
```

- **Orbital OK** : spawn déplacé de (0,5,0) → (1000, 50, 0) pour éviter le vide
- **tower** : pas de spawn défini → fallback (0,5,0), probablement dans le vide

### 6.2 Recommandations
| # | Action | Effort | Gain |
|---|--------|--------|------|
| **F1** | Ajouter spawn pour `tower` dans MAP_SPAWN | 1h | 🟡 Moyen |
| **F2** | Logger un warning si une map n'a pas de spawn + pas de custom | 1h | 🟢 Basse |

---

## 7. 🟠 MAPS PLANÉTAIRES OBJ/MTL — MAPS_LOADING_ANALYSIS.md

### 7.1 Constat
- Le fichier `docs/MAPS_LOADING_ANALYSIS.md` documente des maps OBJ/MTL qui **n'existent plus**
- `models_unreal/` : **dossier introuvable**
- `preloadService.ts` / `WorldGenerator.ts` : **introuvables** dans le code base
- `DISABLE_PLANETARY_MAPS` : introuvable
- `OBJLoader` : introuvable (aucun loader OBJ installé)

### 7.2 Conclusion
**Ce document est obsolète.** L'infrastructure qu'il décrit a été supprimée ou déplacée. Les 3 maps OBJ/MTL (NaturalRoads, Demo_Landscape_A, open_world_LSP_v2) n'ont jamais été chargées en jeu.

### 7.3 Recommandations
| # | Action | Effort | Gain |
|---|--------|--------|------|
| **P1** | Supprimer `docs/MAPS_LOADING_ANALYSIS.md` (obsolète) | 5 min | 🟡 Moyen |
| **P2** | Si les maps OBJ/MTL doivent revivre : implémenter un OBJLoader dans le pipeline de streaming | 5j | 🟢 Basse |

---

## 8. 🟢 COLLISION — CollisionWorld.ts

### 8.1 Architecture hybride
- **WASM actif** : `isSegmentBlocked` via C++ AABB broadphase
- **Toujours Three.js** pour `getGroundY`, `resolveCameraPosition`, `raycastPoint` (précision BVH)
- Chunks ajoutés par lots de 8 avec rAF entre chaque batch

### 8.2 Points d'attention
- `colliderCount` accessible → bon indicateur de fuite mémoire
- `remove()` est appelé au déchargement et **précède** le dispose (corrigé après bug)

---

## 9. 📊 TABLEAU RÉCAPITULATIF DES OPTIMISATIONS

| ID | Priorité | Composant | Problème | Action | Effort |
|----|----------|-----------|----------|--------|--------|
| S1 | 🔴 | Streaming | Rayons WASM Orbital contaminés | Transmettre sphères corrigées au C++ | 2j |
| C1 | 🔴 | Cache | Pas d'éviction | Ajouter LRU + quota 500 Mo | 3j |
| M2 | 🔴 | Orbital | Métadonnées inclus coque | Régénérer chunk-metadata sans coque | 1j |
| M1 | 🟠 | Forge | Chunk 06 = 100 Mo, goulot | Rééquilibrer (split chunk_06) | 4j |
| C2 | 🟠 | Cache | Version manuelle | Hash automatique du manifest | 2j |
| C3 | 🟠 | Cache | Chunks + assets même store | Stores séparés | 2j |
| B1 | 🟠 | Limites | Orbital sans limite | Poser keepIn par défaut | 1j |
| P1 | 🟠 | Docs | MAPS_LOADING_ANALYSIS obsolète | Supprimer ou réécrire | 5 min |
| S2 | 🟡 | Streaming | Safety timeout 90s | Réduire à 30s | 1h |
| S3 | 🟡 | Streaming | Fallback sans budget | Ajouter maxLoaded | 1j |
| C4 | 🟡 | Cache | Pas de monitoring hit/miss | Track dans streamingDiagnostics | 1j |
| E1 | 🟡 | Coques | Test Orbital manquant | Test unitaire | 2h |
| B2 | 🟡 | Limites | Fit manuel | Automatiser au build | 2j |
| F1 | 🟡 | Config | tower sans spawn | Ajouter MAP_SPAWN[tower] | 1h |
| S4 | 🟢 | Streaming | Offset Orbital | Recalculer par sondes | 1j |
| C5 | 🟢 | Cache | Taille IDB élevée | CompressionStream API | 3j |
| F2 | 🟢 | Config | Warning spawn manquant | Logger si fallback | 1h |
| M3 | 🟢 | Métriques | Déséquilibre chunks | CI alert sur médiane ×2 | 1j |

---

## 10. MÉTRIQUES CLÉS DU SYSTÈME

| Métrique | Valeur | Commentaire |
|----------|--------|-------------|
| Budget VRAM | 3600 MB | Recalculé depuis 600 Mo (trop bas) |
| Max loaded chunks | 32 | Forge=8, Orbital=8 → OK |
| Load radius | 2000 | Forge OK, Orbital trop petit (métadonnées) |
| Unload radius | 3000 | Idem |
| MAX_CONCURRENT | 2 | Juste (évite context lost) |
| Texture batch | 16/frame | Avec downscale 2048px |
| Texture batch yield | rAF | Anti context lost |
| Safety timeout | 90s | Trop long |
| Qualité degrade | 4 tentatives | High→Med→Low→Low avec retry |
| Cache version | 8 | Manuelle → risquée |
| COEP/COOP WASM | Requis | Fallback si absent |

---

## 11. CONCLUSION

**Forces du système :**
- Architecture WASM + Three.js hybride bien pensée
- Correction des sphères de culling côté Three.js (contourne métadonnées erronées)
- Dégradation qualité progressive sur OOM
- Coques enveloppantes bien filtrées (collision + culling)
- IndexedDB cache + fingerprint validation
- Télémétrie streaming (streamingDiagnostics)

**Faiblesses critiques :**
1. **🔴** Le pipeline C++ WASM utilise les métadonnées brutes → Orbital ne culle rien
2. **🔴** Cache IDB sans éviction → peut saturer le navigateur
3. **🟠** Déséquilibre des chunks Forge (×8) → temps d'attente variable
4. **🟠** Gestion de version cache 100% manuelle → déjà causé des bugs
5. **🟠** Maps OBJ/MTL = code mort documenté comme actif

**Temps estimé pour les correctifs prioritaires (P1) :** ~5-6 jours
**Temps total recommandé :** ~20 jours