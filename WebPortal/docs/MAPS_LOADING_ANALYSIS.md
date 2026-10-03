# 📊 Analyse du Chargement des Maps Planétaires

## 🔍 État Actuel

### ❌ Problème Détecté

Les maps planétaires OBJ/MTL **ne sont PAS chargées** actuellement :

1. **PreloadService** (`services/preloadService.ts`)
   - `DISABLE_PLANETARY_MAPS = true` (ligne 43)
   - Les maps sont listées mais ignorées lors du chargement
   - Seulement simulation du chargement pour la progression

2. **WorldGenerator** (`core/WorldGenerator.ts`)
   - `loadPlanetScene()` génère un terrain **procédural**
   - Ne charge **PAS** les fichiers OBJ/MTL depuis `models_unreal/`
   - Utilise seulement `generateTerrain()` qui crée un terrain procédural

3. **GameEngine** (`components/GameEngine.tsx`)
   - `DISABLE_PLANETARY_MAPS = false` (ligne 66)
   - Appelle `loadPlanetScene()` quand on change de planète
   - Mais cette fonction ne charge pas les maps OBJ/MTL

### 📁 Maps Disponibles

Les maps suivantes sont listées dans `preloadService.ts` mais jamais chargées :

```typescript
const mapFiles = [
  { type: 'obj', path: '/models_unreal/map_MEZALAYIS/NaturalRoads.obj' },
  { type: 'mtl', path: '/models_unreal/map_MEZALAYIS/NaturalRoads.mtl' },
  { type: 'obj', path: '/models_unreal/map_akarlys/Demo_Landscape_A.obj' },
  { type: 'mtl', path: '/models_unreal/map_akarlys/Demo_Landscape_A.mtl' },
  { type: 'obj', path: '/models_unreal/map_zayan/open_world_LSP_v2.obj' },
  { type: 'mtl', path: '/models_unreal/map_zayan/open_world_LSP_v2.mtl' },
];
```

### 🎯 Planètes Configurées

Dans `constants.ts`, les planètes sont configurées avec :
- `id`: 'akarlys', 'zayan', 'mezalayis'
- Mais aucune référence aux fichiers OBJ/MTL

## ✅ Solution Proposée

### Option 1 : Charger les Maps OBJ/MTL (Recommandé)

1. **Activer le chargement dans PreloadService** :
   ```typescript
   private static readonly DISABLE_PLANETARY_MAPS = false;
   ```

2. **Modifier WorldGenerator.loadPlanetScene()** pour charger les maps :
   ```typescript
   public async loadPlanetScene(config: PlanetConfig, interactables: THREE.Object3D[]): Promise<void> {
     // Charger la map OBJ/MTL selon la planète
     const mapPath = this.getMapPathForPlanet(config.id);
     if (mapPath) {
       await this.loadMapOBJ(mapPath, interactables);
     } else {
       // Fallback: terrain procédural
       this.generateTerrain(config, interactables);
     }
   }
   ```

3. **Harmoniser les flags** :
   - Supprimer `DISABLE_PLANETARY_MAPS` de `GameEngine.tsx`
   - Utiliser seulement celui de `PreloadService`

### Option 2 : Garder le Terrain Procédural (Actuel)

Si on veut garder le terrain procédural :
1. Supprimer les références aux maps OBJ/MTL
2. Garder `DISABLE_PLANETARY_MAPS = true`
3. Documenter que le terrain est procédural

## 🔧 Correction Nécessaire

**Action requise** : Décider si on veut :
- ✅ Charger les maps OBJ/MTL réelles (Option 1)
- ✅ Garder le terrain procédural (Option 2)

Ensuite, harmoniser les flags et implémenter le chargement si nécessaire.