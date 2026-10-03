# FORGE P2 — Rapport d'Analyse et Plan d'Amélioration

**Date :** 30 juillet 2026  
**Contexte :** Éditeur de mondes Forge — `WebPortal/src/rpg/forge/`  
**Périmètre :** undo/redo, copy/paste, sélection multiple, gizmos, snap grid, export/import, collaboration

---

## Résumé Exécutif

L'éditeur Forge est fonctionnel mais présente **7 lacunes critiques** qui limitent son utilisation pour des projets sérieux. Ce rapport détaille l'état actuel, les problèmes, et les correctifs à appliquer, avec des priorités et un effort estimé.

**Tests actuels :** 5 test files, 31 tests — **tous passent**. La couverture est correcte pour le store et les helpers mais n'existe **pas** pour les composants React (ForgeBuilderScene, ForgeEditor).

---

## 1. Undo/Redo

### État actuel
- `EditHistory` dans `forgeSceneStore.ts` : pile `past`/`future` de snapshots JSON (history max = 500)
- Poussé manuellement *avant* certaines opérations seulement : `addObject`, `removeObject`, `duplicateObject`, `alignObjects`, `addWater`, `createPath`, `loadPrefab`
- `handleUndo`/`handleRedo` relié à Ctrl+Z / Ctrl+Shift+Z / Ctrl+Y

### Problèmes identifiés
1. **❌ `updateObject` et `updateWater` ne poussent PAS dans l'historique**  
   → Les gizmos (translate/rotate/scale via `commitTransform` → `onObjectUpdate`) ne sont **pas annulables**
2. **❌ Matériau non undoable** (les changements de `material` passent par `updateObject`)
3. **❌ Terrains non undoable** (`patchTerrain` modifie directement sans snapshot)
4. **❌ Chemins (`paths`) non snapshotés** — seuls `objects` et `waters` sont capturés
5. **❌ Calques (`layers`) et paramètres (`settings`) non undoable**
6. **❌ Pas de débounce/batch** — le terrain sculpting génère des centaines de mutations sans les grouper

### Correctifs requis
| # | Action | Effort | Priorité |
|---|--------|--------|----------|
| 1.1 | `SceneSnapshot` → inclure `paths`, `terrains` | 1h | **Haute** |
| 1.2 | `commitTransform` → push history AVANT mutation | 0.5h | **Haute** |
| 1.3 | `updateObject`/`updateWater` → option `recordHistory: boolean` ou wrapper dédié | 1h | **Haute** |
| 1.4 | `patchTerrain` → push snapshots (avec debounce 200ms) | 1h | **Moyenne** |
| 1.5 | Material edits → push history | 0.5h | **Moyenne** |
| 1.6 | `EditHistory` → ajouter `batch( fn )` pour grouper mutations consécutives | 1.5h | **Basse** |
| 1.7 | Tests undo/redo sur gizmo + terrain | 1h | **Moyenne** |

---

## 2. Copy/Paste (Presse-papier)

### État actuel
- `duplicateObject()` : duplique **un seul** objet sélectionné avec un décalage de +2m
- Raccourci Ctrl+D fonctionnel
- Pas de vrai presse-papier système

### Problèmes identifiés
1. **❌ Pas de Ctrl+C / Ctrl+V** — seulement duplication (Ctrl+D)
2. **❌ Mono-objet seulement** — pas de copie multiple
3. **❌ Pas de copie entre scènes** (objet perdu en changeant de scène)
4. **❌ Pas de copie d'eau, chemins, terrains**
5. **❌ Pas de feedback visuel (clipboard interne)**

### Correctifs requis
| # | Action | Effort | Priorité |
|---|--------|--------|----------|
| 2.1 | Implémenter `clipboardStore` interne (Map mémoire, persistant session) | 1h | **Haute** |
| 2.2 | `handleCopy` / `handlePaste` avec Ctrl+C / Ctrl+V | 0.5h | **Haute** |
| 2.3 | Copie multi-objets (basé sur la future sélection multiple) | 0.5h | **Haute** |
| 2.4 | Copie des eaux sélectionnées | 0.3h | **Moyenne** |
| 2.5 | Tests : copy + paste vérifie objets, positions, propriétés | 0.5h | **Moyenne** |

---

## 3. Sélection Multiple

### État actuel
- `selectedObjectId: string | null` — **un seul** objet sélectionnable
- La sélection se fait par clic sur un objet ou via le panneau Calques
- Pas de Shift+click, pas de box/rectangle selection, pas de batch

### Problèmes identifiés
1. **❌ Architecture monolithique** — tout l'éditeur tourne autour d'un seul `selectedObjectId`
2. **❌ Pas de Shift+click** pour ajouter/retirer de la sélection
3. **❌ Pas de box selection (clic-glisser sur le sol)**
4. **❌ Pas de Select All (Ctrl+A)**
5. **❌ Pas d'opérations batch sur la sélection** : delete, move, scale, material
6. **❌ Gizmo TransformControls ne supporte pas le multi** (attaché à un seul groupe)

### Correctifs requis
| # | Action | Effort | Priorité |
|---|--------|--------|----------|
| 3.1 | `selectedObjectIds: Set<string>` au lieu de `selectedObjectId` (refactor store + UI) | 2h | **Haute** |
| 3.2 | Shift+click : toggle dans la sélection | 0.5h | **Haute** |
| 3.3 | Ctrl+A : sélectionner tous les objets visibles | 0.3h | **Moyenne** |
| 3.4 | Box selection : pointerDown → pointerUp sur le sol, dessine un rectangle, sélectionne les objets dans l'aire | 2h | **Moyenne** |
| 3.5 | Batch delete (tous les selected) | 0.3h | **Haute** |
| 3.6 | Batch move via gizmo : déplacer la sélection comme un groupe | 1.5h | **Haute** |
| 3.7 | Batch scale/rotate via gizmo | 1h | **Moyenne** |
| 3.8 | Batch material edit (appliquer à tous les selected) | 0.5h | **Basse** |
| 3.9 | Tests : sélection multiple, box, batch delete | 1h | **Moyenne** |

---

## 4. Gizmos (TransformControls)

### État actuel
- `<TransformControls>` de drei, modes translate/rotate/scale
- Snap translation et rotation configurés
- Commit sur `onMouseUp` → `commitTransform()` → `onObjectUpdate`
- Un seul gizmo attaché au groupe de l'objet sélectionné

### Problèmes identifiés
1. **❌ Aucun push undo avant commit** — le gizmo n'est pas annulable
2. **❌ Pas de gizmo multi-sélection** (nécessite un groupe temporaire)
3. **❌ Pas de gizmo pour les eaux** (seulement les objets) — mais est-ce souhaitable ?
4. **❌ Pas de gizmo pour les terrains** (position/déplacement via sliders uniquement)
5. **❌ Pas de gizmo snapping visuel** (guide lines, highlight quand snap activé)
6. **❌ Mode 'water' dans le Toolbar mais pas de gizmo dédié**

### Correctifs requis
| # | Action | Effort | Priorité |
|---|--------|--------|----------|
| 4.1 | Push undo history AVANT commitTransform | 0.3h | **Haute** |
| 4.2 | Gizmo multi : créer un groupe temporaire, appliquer la translation aux centres de chaque objet | 2h | **Haute** |
| 4.3 | Gizmo pour eaux (position + rotation Y, pas d'échelle) | 0.5h | **Basse** |
| 4.4 | Visual snap indicators (snap guides en overlay) | 1h | **Basse** |
| 4.5 | Tests : commit gizmo → snapshot store values | 0.5h | **Moyenne** |

---

## 5. Snap Grid

### État actuel
- `snap(v, step)` : `Math.round(v / step) * step` si `step > 0`
- Configurable : snapStep 0.5 / 1 / 2.5 / 5 / 10 m
- Toggle on/off dans la toolbar et les paramètres
- Appliqué dans `addObject`, `commitTransform` (gizmo translation + rotation)

### Problèmes identifiés
1. **❌ Grille visuelle <Grid> et snap sont décorrélés** — <Grid> utilise `cellSize={1}` / `sectionSize={5}` quel que soit `snapStep`
2. **❌ Pas de snap pour le terrain sculpting** (les raises/lowers sont continus)
3. **❌ Pas de snap pour la spline** (les points de chemin sont placés en continu)
4. **❌ Pas d'affichage du curseur "magnétique"** quand le snap attire une position
5. **❌ Pas de snap custom par outil** (snap fin en translation, grossier en rotation)

### Correctifs requis
| # | Action | Effort | Priorité |
|---|--------|--------|----------|
| 5.1 | Synchroniser le rendu <Grid> avec `snapStep` (cellSize = snapStep, sectionSize = snapStep*5) | 0.5h | **Haute** |
| 5.2 | Appliquer snap aux points de spline (quand snap activé) | 0.5h | **Moyenne** |
| 5.3 | Snap visuel : highlight du point aimanté | 1h | **Basse** |
| 5.4 | Tests : snap grid → visual grid params cohérents | 0.3h | **Basse** |

---

## 6. Export/Import

### État actuel
- Sauvegarde locale localStorage + IndexedDB (`saveWorldDb`)
- "Publish" → `customMapStore` (carte jouable in-game)
- Prefabs : sauvegardés dans localStorage sous `forge_prefabs`
- Aucun export fichier

### Problèmes identifiés
1. **❌ Pas d'export JSON fichier** (download .forge.json)
2. **❌ Pas d'import JSON fichier** (upload .forge.json → nouveau scene)
3. **❌ Pas d'export GLB de la scène complète**
4. **❌ Pas de partage par URL/code**
5. **❌ Pas d'export sélectif** (exporter juste la sélection)
6. **❌ Prefabs limités au localStorage** — pas de répertoire partagé

### Correctifs requis
| # | Action | Effort | Priorité |
|---|--------|--------|----------|
| 6.1 | Export JSON : downloadBlob(JSON.stringify(scene), 'scene.forge.json') | 0.5h | **Haute** |
| 6.2 | Import JSON : file input → parse → forgeSceneStore.create() | 1h | **Haute** |
| 6.3 | Export sélection (objets selected → .forge.json) | 0.5h | **Moyenne** |
| 6.4 | Import via drag-and-drop | 1h | **Basse** |
| 6.5 | Export/import de prefabs (fichier .forge-prefab.json) | 0.5h | **Basse** |
| 6.6 | Tests : export → import → données identiques | 0.5h | **Moyenne** |

---

## 7. Collaboration (Forge Live)

### État actuel
- `forgeSync.ts` : WebSocket via `net/socket`
- Sync snapshot complet de la scène (dernier save gagne)
- Présence : caméra diffusée (throttle 100ms), curseurs des pairs affichés en 3D
- Auto-rejoindre à l'arrivée d'un pair (broadcast du snapshot)

### Problèmes identifiés
1. **❌ "Last save wins" destructeur** — si deux éditeurs modifient en même temps, le dernier écrit écrase sans avertissement
2. **❌ Chemins (`paths`) et terrains multi (`terrains[]`) non synchronisés**
3. **❌ Sélection non partagée** — on ne voit pas ce que l'autre éditeur a sélectionné
4. **❌ Pas d'opération de haute-fidélité (OT/CRDT)** — seulement des snapshots bruts
5. **❌ Pas de conflit détecté / notifié à l'utilisateur**
6. **❌ Pas de verrouillage d'objet** (deux personnes modifient le même objet)
7. **❌ Pas de chat intégré**

### Correctifs requis
| # | Action | Effort | Priorité |
|---|--------|--------|----------|
| 7.1 | Sync `paths` et `terrains` dans le message FORGE_SCENE | 0.5h | **Haute** |
| 7.2 | Broadcast de la sélection (FORGE_SELECT) → voir les objets sélectionnés par les pairs | 1h | **Moyenne** |
| 7.3 | Détection de conflit : timestamp + avertissement si écrase | 2h | **Moyenne** |
| 7.4 | Lock d'objet (requestLock/releaseLock via WebSocket) | 2h | **Basse** |
| 7.5 | Tests : forgeSync → envoi snapshot, présence, sélection | 1h | **Moyenne** |

---

## Priorités Recommandées

### Phase 1 — Fondations (Urgent, ~4h)
| Priorité | Tâche | Effort |
|----------|-------|--------|
| P0 | Undo gizmo/updateObject + snapshot terrains/paths | 2h |
| P0 | Copy/Paste multi-objets (presse-papier interne) | 1.5h |
| P0 | Export/import JSON fichier | 1.5h |

### Phase 2 — Productivité (~6h)
| Priorité | Tâche | Effort |
|----------|-------|--------|
| P1 | Sélection multiple : Set<id>, Shift+click, batch delete | 3h |
| P1 | Sync paths/terrains dans collaboration | 0.5h |
| P1 | Grille visuelle synchronisée avec snapStep | 0.5h |
| P1 | Tests de non-régression pour chaque fonctionnalité | 2h |

### Phase 3 — Confort (~8h)
| Priorité | Tâche | Effort |
|----------|-------|--------|
| P2 | Gizmo multi-sélection | 2h |
| P2 | Box selection visuelle | 2h |
| P2 | Batch material edit | 1h |
| P2 | Détection de conflit collaboration | 2h |
| P2 | Tests d'intégration | 1h |

### Phase 4 — Polish (~6h)
| Priorité | Tâche | Effort |
|----------|-------|--------|
| P3 | Undo batch pour terrain sculpting | 1.5h |
| P3 | Lock d'objet collaboration | 2h |
| P3 | Snap visuel (guides) | 1h |
| P3 | Export/import prefabs fichiers | 0.5h |
| P3 | Snap spline | 0.5h |

---

## Architecture des Modifications

### Nouveaux fichiers nécessaires
```
forge/clipboardStore.ts        — Presse-papier interne (copie multi-objets)
forge/selectionUtils.ts        — Helpers sélection multiple (box, intersection)
forge/sceneIO.ts               — Export/import JSON fichier
```

### Fichiers à modifier
```
forgeSceneStore.ts              — SceneSnapshot enrichi, batch undo
ForgeEditor.tsx                 — selectedObjectIds → Set, handlers copy/paste/selectAll
ForgeBuilderScene.tsx           — Box selection, gizmo multi, snap grid synced
ForgeToolbar.tsx                — Boutons copy/paste, selectAll
forgeSync.ts                    — Sync paths + terrains + selection
ForgePanels.tsx                 — Batch material edit UI
```

---

## Conclusion

L'éditeur Forge a une base solide (EditHistory, TransformControls, forgeSync, présence) mais chaque fonctionnalité s'arrête à l'essentiel sans aller jusqu'à l'expérience utilisateur complète.

**Les 3 correctifs les plus impactants :**
1. **Rendre le gizmo undoable** — sans ça l'outil de base (déplacer/rotation) n'est pas annulable, ce qui est rédhibitoire
2. **Presse-papier + export JSON** — la rétention de données est le minimum pour un éditeur
3. **Sélection multiple** — débloque toutes les opérations batch et améliore le flux de travail 10×

Tous les tests existants (31/31) passent. Chaque phase doit maintenir cette barre.

---

*Rapport généré par analyse statique du code source le 30 juillet 2026.*
