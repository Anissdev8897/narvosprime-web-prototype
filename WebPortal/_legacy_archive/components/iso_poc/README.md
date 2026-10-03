# POC iso 3D NARVOS PRIME — README

Composant standalone qui valide le pipeline 3D temps reel iso (vue Dofus-like
moderne) avec un systeme d'entites unifie (joueur + monstres) configurable
par fichiers JSON, et un combat tour par tour.

**Aucun fichier du moteur 2D existant n'est modifie.** Toggle via `F11`.

---

## Statut

| Sprint | Etat | Contenu |
|---|---|---|
| **Sprint 1** | OK | OrthographicCamera iso + GLB anime + toon shading + outline faction + grille |
| **Sprint 3** (en cours) | OK structure | EntityDefinition, EntityRegistry, configs JSON, PreCombatPanel, multi-entites, HUD combat |
| Sprint 3 reste | partiel | Pathfinding A*, calcul reachable/attackable, IA monstre, exec move/cast visuelle |
| Sprint 2 (polish visuel) | a faire | Color grading, diamond shadow, emissive map highlights |
| Sprint 4 | a faire | Charger maps GLB (M02 etc.), collisions PhysicsSystem |

---

## Demarrage

1. `cd WebPortal && npm run dev` -> http://localhost:3005
2. Appuyer sur **F11** depuis n'importe quel ecran
3. Panneau pre-combat : choisir personnage + map + 1 a 3 monstres
4. Cliquer "Pret >>" pour spawn et lancer le combat
5. HUD apparait : timeline en haut, HP/PA/PM joueur en bas, spell bar

---

## Architecture

```
WebPortal/components/iso_poc/
├── IsometricPocViewer.tsx     Composant principal (Canvas R3F + HUD + PreCombat)
├── PreCombatPanel.tsx         Selection perso/map/monstres (modal)
├── HudOverlay.tsx             Timeline + HP/PA/PM + spell bar + end turn
├── EntityView.tsx             Wrapper rendu d'une entite (Character3D + ring)
├── Character3D.tsx            Charge GLB + AnimationMixer (Sprint 1)
├── ToonOutline.tsx            MeshToonMaterial 3 tons + Inverted Hull (Sprint 1)
├── IsometricCamera.tsx        OrthographicCamera 30° follow_smooth (Sprint 1)
├── TileGrid.tsx               Grille cellules + highlights (Sprint 1)
├── combat/
│   ├── CombatTypes.ts         Spell, GridCell, CombatEntity, TurnPhase
│   ├── EntityDefinition.ts    EntityDefinition unifie (player/monster/npc)
│   ├── EntityRegistry.ts      Loader configs JSON + validation + queries
│   └── useCombatStore.ts      useReducer init/move/cast/end_turn
└── README.md

WebPortal/public/configs/iso_poc/   <-- 6 configs JSON
├── classes.json                3 classes (knight_akarlys, tank_mezalayis, prophet_zayan)
├── spells.json                 10 sorts (3 par classe + neutres + monster_*)
├── characters.json             3 persos prefab (Kira AKARLYS, Droak MEZA, Velsa ZAYAN)
├── monsters.json               3 monstres (crab, canopy_prophet, pressure_manipulator)
├── maps_3d.json                4 maps (test_arena + 3 maps GLB pour Sprint 4)
└── spawn_points.json           Points de spawn par map + faction + tag

WebPortal/public/models/iso_poc/    <-- 10 GLB Meshy AI
├── kgnitig/                    Idle + Walking + Running
├── mercenaire_tank/            Idle + Walking
├── profhete/                   Idle + Walking
├── canopy_prophet/             Idle
├── pressure_manipulator/       Idle
└── aquarys_crab/               Idle
```

---

## Systeme d'entites unifie

Tous les acteurs (joueur, monstre, PNJ, boss) partagent le meme schema
`EntityDefinition`. La discrimination se fait par le champ `kind`.

```ts
type EntityKind = "player" | "monster" | "npc" | "boss" | "elite";

interface EntityDefinition {
  id, name, kind, faction, classId?, model: ModelConfig,
  stats?: CharacterStats, spellIds?: string[], level?, aiBehavior?,
}
```

`CharacterDefinition` etend EntityDefinition (kind="player", + startMapId, startCell).
`MonsterDefinition` etend EntityDefinition (kind="monster"|"elite"|"boss", + level, aiBehavior, xpReward).

Cela permet de manipuler les entites de maniere uniforme dans le rendu
(`EntityView`) et le combat (`useCombatStore`).

---

## Fichiers de configuration

Tout est modifiable sans toucher au code. Recharger la page apres modif JSON.

### Ajouter un personnage prefab

`characters.json` :
```json
{
  "id": "char_my_new_hero",
  "name": "Mon Heros",
  "kind": "player",
  "faction": "AKARLYS",
  "classId": "knight_akarlys",
  "model": {
    "basePath": "/models/iso_poc/<dossier>/<file>.glb",
    "animations": {
      "idle":    "/models/iso_poc/<dossier>/<file>_idle.glb",
      "walking": "/models/iso_poc/<dossier>/<file>_walking.glb"
    }
  },
  "stats": { "hp": 100, "hpMax": 100, "pa": 6, "paMax": 6, "pm": 3, "pmMax": 3, "initiative": 8 },
  "spellIds": ["strike_basic", "shield_bash"],
  "startMapId": "test_arena",
  "startCell": { "x": 3, "y": 7 }
}
```

### Ajouter un monstre

`monsters.json` : meme structure + `level`, `aiBehavior` (passive / defensive
/ aggressive / tactical / swarm / boss), `xpReward`.

### Ajouter une map

`maps_3d.json` :
```json
{
  "id": "my_new_map",
  "name": "Ma Map",
  "glbPath": "/models/iso_poc/maps/MyMap.glb",
  "grid": { "width": 16, "height": 14, "cellSize": 1.2 },
  "lightingPreset": "akarlys_day"
}
```
+ ajouter spawn points dans `spawn_points.json` avec `mapId: "my_new_map"`.

---

## Modifier un personnage existant

Tout est dans la def JSON :
- `model.basePath` / `model.animations` -> changer GLB / animations
- `model.scale` / `model.rotationY` / `model.yOffset` -> ajuster placement
- `stats` -> HP, PA, PM, initiative
- `spellIds` -> liste des sorts
- `faction` -> change la couleur outline (cyan / pourpre / ocre / gris)
- `classId` -> reference vers classes.json

Aucune compilation requise, juste rafraichir la page.

---

## Combat tour par tour

`useCombatStore` (useReducer) gere :
- **Timeline** : ordre par initiative descendante
- **Phases** : `idle` -> `init` -> `player_turn` / `enemy_turn` -> `victory`/`defeat`
- **Actions dispatch** : `initCombat`, `selectSpell`, `setHoverCell`, `moveEntity(pmCost)`,
  `castSpell(targets, damage)`, `endTurn` (cycle timeline + refill PA/PM)

Le HUD reagit automatiquement au state. Le bouton "Fin de tour" appelle endTurn().

---

## Controles

| Touche | Action |
|---|---|
| `F11` | toggle POC |
| Click cellule | log `[IsoPOC] Cell clicked` (Sprint 4 = move/cast) |
| Click entite | selection (entity ring jaune) |
| Bouton "Cam: <mode>" | toggle follow_smooth / fixed |
| Bouton "Changer combat" | retour panneau pre-combat |
| Bouton "Fin de tour" | (HUD) end turn (si player_turn) |
| Bouton spell | (HUD) select spell to cast |

---

## Hooks pour la suite

### Sprint 3 finalisation
- Pathfinding A* (existant dans `core/`) -> calcul `reachableCells` quand player_turn
- Calcul `attackableCells` selon spell selectionne (range/lineOfSight)
- Calcul `aoeCells` au hover sur `attackableCells` (preview impact)
- Click cellule reachable -> dispatch `MOVE_ENTITY` + animation walking + lerp position
- Click cellule attackable -> dispatch `CAST_SPELL` + animation cast
- IA simple monstre : choisit target + spell, dispatch MOVE/CAST a son tour

### Sprint 2 polish visuel (apres Sprint 3 finalise)
- Diamond shadow sprite sous chaque entite
- Emissive map sur highlights (gemmes, plasma, yeux)
- Color grading post-process LUT par map (lightingPreset)
- Bloom leger sur spells

### Sprint 4 environnement
- Charger map GLB (`activeMap.glbPath`) en scene 3D
- Synchroniser collisions avec `PhysicsSystem` existant
- Lighting presets reels (`akarlys_day`, `zayan_dusk`, etc.)

### Sprint 5 extension
- Animations Mixamo retargetees pour Attack/Cast/Hit/Death
- LOD + instancing pour scaling multi-mobs
- Cache GLB / batched load au boot

---

## Risques connus restants

| Risque | Status | Sprint cible |
|---|---|---|
| `Character3D` charge multi-GLB par fetch async, peut causer frame manquante | mineur | 3 |
| `EntityRegistry` re-fetch au mount POC, pas de cache global | mineur | 5 |
| `combat.dispatchPhase` n'existe pas dans le store v1 | mineur (dead code retire) | resolu |
| Outline Inverted Hull casse avec multimaterial Meshy | a tester | 2 |
| Tete masque le corps en vue 30° | a tester | 2 |
| Anims attack/cast/hit/death manquantes | bloquant gameplay complet | 3 fin / 5 |

---

## Pour integrer dans `GameEngine.tsx` (apres validation)

Plus tard, on integre via toggle :

```tsx
const [renderMode, setRenderMode] = useState<'2d' | '3d-iso'>('2d');

return renderMode === '3d-iso'
  ? <IsometricPocViewer fullscreen={false} />
  : <Existing2DRenderer />;
```

Le composant POC n'a aucune dependance vers `GameEngine`, `DofusRenderer` ou
`SpriteService`. Il peut tourner en autonomie avec ses propres assets.
