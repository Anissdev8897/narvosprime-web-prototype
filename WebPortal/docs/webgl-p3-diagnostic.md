# WebGL P3 — Diagnostic et Recommandations

**Date** : 2026-07-30  
**Projet** : Narvos Prime Web Portal  
**Source** : Analyse des configurations WebGLRenderer dans tout le projet  

---

## 1. Résumé des configurations WebGLRenderer actuelles

| Composant | Fichier | powerPreference | antialias | alpha | stencil | depth | DPR | toneMapping |
|-----------|---------|----------------|-----------|-------|---------|-------|-----|-------------|
| **RpgGameWorld** (Map monde) | `src/rpg/runtime/RpgGameWorld.tsx:2760` | `"high-performance"` | `true` | _(par défaut)_ | `false` | _(par défaut)_ | `QUALITY_DPR[quality]` | _(par défaut)_ |
| **ForgeEditor** (Éditeur de map) | `src/rpg/forge/ForgeEditor.tsx:513` | _(par défaut)_ | `true` | _(par défaut)_ | _(par défaut)_ | _(par défaut)_ | `[1, 2]` | `ACESFilmic` |
| **AssetBrowser** (Prévisualisation forge) | `src/rpg/forge/AssetBrowser.tsx:31` | `"low-power"` | `true` | `true` | _(par défaut)_ | _(par défaut)_ | `[1, 1.5]` | _(par défaut)_ |
| **ClassPreview3D** (Perso menu) | `src/components/character/ClassPreview3D.tsx:145` | `"high-performance"` | `true` | `true` | _(par défaut)_ | _(par défaut)_ | `[1, 1.5]` | _(par défaut)_ |
| **ForgePersonnages** | `src/rpg/characters/ForgePersonnages.tsx:129` | _(par défaut)_ | _(par défaut)_ | _(par défaut)_ | _(par défaut)_ | _(par défaut)_ | `[1, 2]` | _(par défaut)_ |
| **ForgeEquipements** | `src/rpg/characters/ForgeEquipements.tsx:121` | _(par défaut)_ | _(par défaut)_ | _(par défaut)_ | _(par défaut)_ | _(par défaut)_ | `[1, 2]` | _(par défaut)_ |
| **test-chunk-materials** (HTML test) | `public/test-chunk-materials.html:215` | _(par défaut)_ | `true` | _(par défaut)_ | _(par défaut)_ | _(par défaut)_ | _(par défaut)_ | `ACESFilmic` |

### 1.1 DPR par qualité (gameSettings.ts)

```typescript
low:    [0.6, 1]     // min: 60% du pixel ratio natif
medium: [1, 1.5]     // min: 100%, max: 150%
high:   [1, 2]       // min: 100%, max: 200%
```

---

## 2. Analyse détaillée

### 2.1 `powerPreference`

**Actuel :**
- **`"high-performance"`** — RpgGameWorld (main game), ClassPreview3D, legacy GameEngine
- **`"low-power"`** — AssetBrowser (prévisualisations forge)
- **Par défaut (aucun)** — ForgeEditor, ForgePersonnages, ForgeEquipements, HeroPreview3D, test-chunk-materials

**Problème :** Le ForgeEditor n'a PAS de `powerPreference`. Sur les machines hybrides (Intel iGPU + NVIDIA/AMD dGPU), le navigateur peut assigner l'iGPU au canvas de l'éditeur → perfs réduites pour le rendu 3D de la carte.

**Recommandation :** Ajouter `powerPreference: "high-performance"` à TOUS les canvas de rendu 3D qui affichent la carte monde, l'éditeur, et la scène de jeu. Conserver `"low-power"` uniquement pour les vignettes/previews (AssetBrowser).

### 2.2 `antialias`

**Actuel :** `true` partout où il est spécifié.

**Problème :** L'antialiasing MSAA a un coût GPU significatif. Sur du low-end (< 30 FPS), il devrait être désactivé dynamiquement. Actuellement, il est toujours activé.

**Recommandation :**
- Rendre `antialias` dynamique selon la qualité graphique : `low → false`, `medium, high → true`
- Ou brancher un détecteur de FPS qui désactive MSAA si < 30 FPS

### 2.3 `alpha` (canal alpha du framebuffer)

**Actuel :** 
- `true` pour les previews avec fond transparent (AssetBrowser, ClassPreview3D, HeroPreview3D)
- Non spécifié (donc `false`) pour le game world et le ForgeEditor

**Problème :** Aucun — les configurations actuelles sont correctes. `alpha: true` coûte ~8-16 Mo de VRAM supplémentaire, donc le garder uniquement là où le fond transparent est nécessaire est la bonne approche.

### 2.4 `stencil`

**Actuel :** Explicitement `false` sur RpgGameWorld. Non spécifié ailleurs (Three.js par défaut = `true`).

**Problème :** Le stencil buffer est activé par défaut sur ForgeEditor, ClassPreview3D, et autres canvas. Si aucun effet (découpage stencil, post-processing type outline) ne l'utilise, il gaspille de la VRAM et du débit mémoire.

**Recommandation :** Ajouter `stencil: false` sur tous les Canvas qui n'utilisent pas le stencil. Vérifier si le ForgeEditor ou ForgePersonnages utilisent des effets stencil (probablement non).

### 2.5 `depth`

**Actuel :** Jamais spécifié. Three.js par défaut = `true`.

**Problème :** Aucun. Le depth buffer est nécessaire pour le rendu 3D. Aucune recommandation de changement.

### 2.6 `precision` (Shader precision)

**Actuel :** Jamais spécifié. Three.js utilise `highp` par défaut partout.

**Problème :** `highp` est coûteux sur les GPU mobiles/intégrés (calculs plus lents, plus de consommation). Sur les machines low-end, forcer `mediump` pour les fragment shaders peut améliorer les FPS de 20-40%.

**Recommandation :** 
- Détecter les GPU low-end et passer en `mediump` pour les fragment shaders
- Garder `highp` pour les vertex shaders (précision nécessaire pour les transformations)

---

## 3. Extensions WebGL

### 3.1 Extensions utilisées

Le projet utilise les extensions suivantes, principalement via Three.js :

| Extension | Rôle | Utilisation |
|-----------|------|-------------|
| **KTX2 / Basis Universal** | Textures GPU compressées (BC7, ETC2, ASTC) | `src/rpg/loaders/ktx2.ts` ← usage critique |
| **Transform Feedback (WebGL2 natif)** | GPU culling avancé | `src/rpg/render/GPUCullingTransformFeedback.ts` |
| **ANGLE_instanced_arrays** | Instancing (implicite via Three.js) | `InstancedMeshSystem.ts`, `NatureDecorField`, `ArrowRenderer` |
| **OES_standard_derivatives** | Shader derivatives (implicite Three.js) | Utilisé par les shaders PBR |
| **OES_texture_float / half_float** | Textures flottantes | Utilisé par le HDR / tone mapping |
| **EXT_texture_filter_anisotropic** | Anisotropic filtering | `applyAnisotropy()` dans `sceneUtils.ts` |

### 3.2 Extensions non utilisées (opportunités)

| Extension | Bénéfice | Priorité |
|-----------|----------|----------|
| **EXT_disjoint_timer_query** | Profiling GPU précis (timing des draw calls) | **Moyenne** — utile en dev/diagnostic, pas en prod |
| **WEBGL_debug_renderer_info** | Identifier le GPU exact (debug) | **Basse** — sécurité (fingerprinting) |
| **WEBGL_compressed_texture_s3tc / etc1 / astc** | Fallback formats compressés | **Haute** — déjà via KTX2 loader |
| **OES_element_index_uint** | Indices 32-bit (>65536 vertex) | **Haute** — Three.js le requiert pour les gros maillages |
| **EXT_frag_depth** | Fragment depth modification | **Basse** — usage de niche |
| **WEBGL_multi_draw** | Multi draw calls en un seul appel | **Haute** — peut améliorer le CPU overhead des appels draw |
| **WEBGL_draw_buffers** | Multiple render targets (MRT) | **Moyenne** — si post-processing ou deferred shading |

### 3.3 Constats importants

1. **Instancing via Three.js** : Le projet utilise `InstancedMesh` abondamment (`InstancedMeshSystem`, `NatureDecorField`, `ArrowRenderer`). Three.js demande `ANGLE_instanced_arrays` automatiquement si WebGL1, mais c'est natif en WebGL2. Vérifier que `capabilities.isWebGL2` est utilisé pour décider du backend.

2. **GPUCullingTransformFeedback** : Le code actuel détecte WebGL2 pour le Transform Feedback mais le backend par défaut est `"three-frustum"` (CPU). Le Transform Feedback natif n'est pas encore implémenté (code commenté/partiel).

3. **KTX2 detectSupport** : Le KTX2Loader détecte automatiquement les formats compressés supportés. La fonction `ktx2SupportSummary()` dans `sharedLoaders.ts` expose les formats activés pour le diagnostic.

4. **Aucun usage de `EXT_disjoint_timer_query`** : Pas de profiling GPU fin. Le `RenderBenchmark.ts` utilise `renderer.info` (compteurs Three.js) qui sont CPU-side.

---

## 4. Context Loss Handling

### 4.1 État actuel — BON

Le mécanisme est bien implémenté, en 3 couches :

| Couche | Composant | Rôle |
|--------|-----------|------|
| **Restauration** | `ContextLossGuard.tsx` | `preventDefault()` sur `webglcontextlost` + `invalidate()` sur `webglcontextrestored` |
| **Sécurité** | `RpgGameWorld.tsx` | Timer 8s qui force `window.location.reload()` si pas de restauration |
| **Robustesse** | `StreamingPuzzleMap.tsx` | Vérifie `isContextLost()` avant l'upload GPU, boucle d'attente 500ms |

Points forts :
- `preventDefault()` correct : sans lui le contexte est irrécupérable
- UI de perte affichée (bannière avec bouton "Recharger maintenant")
- `restoreEpoch` force le remount complet des objets GPU
- Le streaming de chunks détecte le contexte perdu et attend (évite les timeouts de 20s)

### 4.2 Faiblesses

1. **Rechargement brutal** : `window.location.reload()` perd l'état mémoire du jeu. Proposer un save state avant reload.
2. **Pas de restauration des programmes shader** : Three.js ne recompile pas automatiquement tous les programmes. Certains ShaderMaterial customs pourraient ne pas se restaurer.
3. **Pas de backoff expononiel** : La boucle `while (ctx.isContextLost())` dans StreamingPuzzleMap tourne toutes les 500ms sans backoff.
4. **Multi-canvas** : ContextLossGuard n'est que dans RpgGameWorld. Si la Forge ou les previews perdent leur contexte, ils ne sont pas protégés.

### 4.3 Recommandations

1. **Sauvegarder l'état avant reload** : Sérialiser les données critiques (position, inventaire) dans `sessionStorage` avant `window.location.reload()`.
2. **Ajouter un ContextLossGuard basique** sur le ForgeEditor et les previews (même minimal : preventDefault + invalidate).
3. **Exponential backoff** dans StreamingPuzzleMap : `500ms → 1s → 2s → 4s → max 8s` au lieu de 500ms constant.

---

## 5. Recommandations prioritaires

### 5.1 CRITIQUE — powerPreference manquant

**Fichier :** `ForgeEditor.tsx:513`  
**Action :** Ajouter `powerPreference: "high-performance"`  

```diff
- gl={{ antialias: true, toneMapping: ... }}
+ gl={{ antialias: true, powerPreference: "high-performance", toneMapping: ... }}
```

### 5.2 HAUTE — antialias dynamique

**Fichier :** `RpgGameWorld.tsx`, `gameSettings.ts`  
**Action :** Rendre `antialias` dépendant de la qualité graphique

```typescript
// gameSettings.ts
export const QUALITY_ANTIALIAS: Record<GraphicsQuality, boolean> = {
  low: false,
  medium: true,
  high: true,
};

// RpgGameWorld.tsx
const antialias = QUALITY_ANTIALIAS[gameSettings.video.quality];
gl={{ antialias, powerPreference: "high-performance", stencil: false, ... }}
```

### 5.3 HAUTE — stencil buffer inutile

**Fichier :** `ForgeEditor.tsx`, `ClassPreview3D.tsx`, `ForgePersonnages.tsx`, `ForgeEquipements.tsx`, `AssetBrowser.tsx`  
**Action :** Ajouter `stencil: false` à tous les Canvas qui n'utilisent pas de masque de stencil

### 5.4 MOYENNE — Precision low-end

**Fichier :** `RpgGameWorld.tsx` ou nouveau fichier `src/rpg/render/precisionDetector.ts`  
**Action :** Détecter les GPU low-end et réduire la précision des fragment shaders

```typescript
// Détection : WebGL query sur le GPU vendor
function isLowEndGPU(gl: WebGLRenderingContext): boolean {
  const debugExt = gl.getExtension('WEBGL_debug_renderer_info');
  if (!debugExt) return false;
  const renderer = gl.getParameter(debugExt.UNMASKED_RENDERER_WEBGL);
  return /Intel HD Graphics|Mali|Adreno 5|PowerVR/i.test(renderer);
}
```

Application Three.js : Three.js ne supporte pas le changement de precision par renderer.
Solution : configurer manuellement les `ShaderMaterial` avec `precision: 'mediump'`.
Ou via un hack WebGL : après création du renderer, modifier `gl.getContextAttributes()` n'est pas possible.
**Alternative pratique** : définir une variable d'environnement `PRECISION` utilisée dans les ShaderMaterial customs.

### 5.5 MOYENNE — EXT_disjoint_timer_query pour profiling

**Fichier :** `RenderBenchmark.ts`  
**Action :** Optionnellement, profiter de `EXT_disjoint_timer_query` pour mesurer les temps GPU réels

```typescript
const ext = gl.getExtension('EXT_disjoint_timer_query');
if (ext) {
  const query = gl.createQueryEXT();
  gl.beginQueryEXT(ext.TIME_ELAPSED_EXT, query);
  // ... render ...
  gl.endQueryEXT(ext.TIME_ELAPSED_EXT);
}
```

⚠ Attention : `EXT_disjoint_timer_query` n'est pas disponible partout (bloqué par certains pilotes/navigateurs pour raisons de sécurité). Ne pas rendre le benchmark dépendant de sa présence.

### 5.6 BASSE — WEBGL_multi_draw

**Fichier :** Code Three.js avancé  
**Action :** Si le projet utilise Three.js r152+, `WEBGL_multi_draw` est automatiquement exploité par le renderer natif. Vérifier la version de Three.js utilisée. Si < r152, envisager la mise à jour.

### 5.7 BASSE — Context Loss sur tous les canvas

**Fichier :** Tous les composants Canvas  
**Action :** Ajouter `ContextLossGuard` ou au moins `preventDefault` sur `webglcontextlost` pour le ForgeEditor, les previews, etc. Sans cela, la perte de contexte est définitive sur ces canvas.

---

## 6. Matrice des changements proposés

| Canvas | powerPreference | antialias | alpha | stencil | ContextLossGuard |
|--------|----------------|-----------|-------|---------|------------------|
| **RpgGameWorld** | ✅ déjà OK | → dynamique (qualité basse=false) | → `false` (pas de fond transparent) | ✅ déjà `false` | ✅ déjà OK |
| **ForgeEditor** | ⚠ manque → `"high-performance"` | → dynamique | → `false` | ⚠ manque → `false` | ⚠ manque |
| **ClassPreview3D** | ✅ déjà OK | → garder `true` | ✅ déjà `true` | ⚠ manque → `false` | ⚠ à voir (faible priorité) |
| **AssetBrowser** | ✅ déjà `"low-power"` | → garder `true` | ✅ déjà `true` | ⚠ manque → `false` | ⚠ à voir |
| **ForgePersonnages** | ⚠ manque → `"high-performance"` | → garder `true` | → `true` ? | ⚠ manque → `false` | ⚠ à voir |
| **ForgeEquipements** | ⚠ manque → `"high-performance"` | → garder `true` | → `true` ? | ⚠ manque → `false` | ⚠ à voir |

---

## 7. Synthèse finale

### Ce qui est déjà bon
- ✅ `powerPreference: "high-performance"` sur le canvas principal (RpgGameWorld)
- ✅ `stencil: false` sur RpgGameWorld (+ sortObjects: false)
- ✅ `failIfMajorPerformanceCaveat: false` (ne bloque pas les GPU vieillissants)
- ✅ `ContextLossGuard` robuste avec timer de sécurité 8s
- ✅ DPR adaptatif selon la qualité graphique (de [0.6, 1] à [1, 2])
- ✅ Textures KTX2 compressées (réduit fortement les risques de context loss par saturation VRAM)
- ✅ InstancedMesh pour le décor (NatureDecorField, ArrowRenderer, InstancedMeshSystem)
- ✅ RenderBenchmark pour mesurer les métriques GPU

### Ce qui doit être amélioré (par ordre de priorité)

1. **ForgeEditor** : ajouter `powerPreference: "high-performance"` + `stencil: false` + ContextLossGuard
2. **antialias dynamique** : désactiver MSAA sur qualité basse ou FPS < 30
3. **stencil sur tous les canvas secondaires** : gaspillage de ~8 Mo de VRAM chacun
4. **precision detection** : `mediump` pour fragment shaders sur GPU low-end
5. **ForgePersonnages / ForgeEquipements** : ajouter `powerPreference: "high-performance"`
6. **ContextLossGuard multi-canvas** : protéger les canvas secondaires
7. **EXT_disjoint_timer_query** : profiling optionnel dans RenderBenchmark

### Impact VRAM estimé des optimisations

| Optimisation | Économie VRAM | Impact FPS |
|-------------|---------------|------------|
| stencil:false (×5 canvas) | ~40 Mo | Négligeable |
| antialias false (low-end) | ~16 Mo (MSAA 4x) | **Significatif** |
| mediump fragment shaders | N/A | **Moyen (15-30%)** |
| KTX2 (déjà fait) | ~80% des textures | Évite les context loss |