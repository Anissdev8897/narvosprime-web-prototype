# Rapport d'Audit — Level Design des Maps de Combat Narvos Prime

**Date** : 2026-07-29
**Périmètre** : 12 fichiers analysés (placement, respawn, config, bounds, streaming, factions, NPC catalog)
**Référence** : Level Design — In Pursuit of Better Levels (Alex K., 127 pages)
**Maps existantes** : Forge (8 chunks), Donjon Furiste (4 chunks), Orbital (8 chunks)

---

## Résumé Exécutif

```
COMBAT SPACES:     ❌ ABSENT  — aucun front/flanc/arrière défini
COVER SYSTEM:      ❌ ABSENT  — pas de cover data-driven (hard/soft/hybrid)
PLAYSTYLES:        ⚠️ PARTIEL — les archétypes existent côté combat, les maps ne les supportent pas
VANTAGE POINTS:    ❌ ABSENT  — pas de système de révélation/vista
ENCOUNTER WAVES:   ⚠️ BASIQUE — respawn timer existe, pas de pattern de vagues
ENEMY SYNERGY:     ⚠️ RICHE catalogue (40+ NPCs), MAIS plate utilisation placement plat
VISUAL LANGUAGE:   ✅ ART OK   — factions distinctes, tilesets cohérents
                    ❌ GAMEPLAY — pas de signposting / breadcrumbs / nope zones
INFRA TECHNIQUE:   ✅ SOLIDE   — streaming chunks, broadphase NPC, murs invisibles
```

---

## 1. COMBAT SPACES — Fronts, flancs, arrière

### État actuel : ❌ ABSENT

**Ce qui existe** : La map physique est chargée par `StreamingPuzzleMap.tsx` via 8-12 chunks GLB provenant d'Unreal Engine. Les limites sont gérées par `mapBoundsStore` (murs `block` / `keepIn`). Le joueur apparaît à un point défini par `mapConfig.ts` (MAP_SPAWN) ou `spawnPointStore` (éditable).

**Ce qui manque** :

| Principe du livre | Statut | Détail |
|---|---|---|
| Front défini | ❌ | Aucune zone "front de combat" n'existe dans le code. Les NPC sont placés en coordonnées brutes. |
| No man's land | ❌ | Pas de zone neutre dangereuse entre entrée et arène. |
| Flancs identifiables | ❌ | Pas de routes latérales balisées. |
| Arrière / retraite | ❌ | Pas de zone de repli ni de seconde ligne. |
| Déplacement du front | ❌ | Pas de phases qui reculent le combat. |
| Combat space visible avant l'entrée | ❌ | Le spawn dépose le joueur directement dans la map — pas de "vista" ou plan d'ensemble. |

**Preuve dans le code** : `npcPlacementStore.ts` stocke les PNJ comme `{[mapId]: PlacedNpc[]}` avec `pos: [x,y,z]` — pas de zone, pas de groupe tactique, pas de phase. `mapConfig.ts` a exactement 3 entrées (forge, donjon_furiste, orbital). Pas de concept "entry trigger", "combat zone", "safe zone".

### Recommandations 🔴

1. **Ajouter un système de zones tactiques** — chaque map se divise en `CombatZone[]` : `zone: { id, label, kind: "entry" | "front" | "flank_left" | "flank_right" | "rear" | "no_mans_land", polygone xz }`
2. **Marquer le point d'entrée** comme zone "safe" avec vue sur l'arène (cf. règle d'or #2 : *Show, don't tell*)
3. **Créer un no man's land** visible entre l'entrée et le premier front ennemi — zone dangereuse sans cover
4. **Définir 2-3 phases de front** par rencontre (ex: phase 1 = front A, phase 2 = ennemis reculent vers front B)

---

## 2. COVER SYSTEM — Hard / Soft / Hybrid

### État actuel : ❌ ABSENT

**Ce qui existe** : Aucun système de cover. Les murs `mapBoundsStore` sont des volumes invisibles de délimitation, pas du cover tactique. Les objets 3D (piliers, rochers, caisses) sont purement visuels dans le GLB — non taggés, non query-ables.

**Comparaison livre vs réalité** :

| Type de cover | Livre | Narvos Prime |
|---|---|---|
| Hard (bloque vision + dégâts) | Rochers, piliers | Existe visuellement mais non taggé |
| Soft (bloque vision, dégâts passent) | Buissons | ❌ Pas de support |
| Hybrid (vision passe, dégâts bloqués) | Boucliers énergétiques | ❌ Pas de support |
| Static | Fixe (majorité) | ✅ (géométrie GLB) |
| Moveable | Poussable | ❌ |
| Moving | Plateformes mobiles | ❌ |
| Dynamic | Destructible | ❌ |

**Distance entre covers** : `npcRegistry` a une grille spatiale (CELL=4 unités) mais uniquement pour les PNJ. Aucune métrique de cover n'existe.

**Cover au START** : Le joueur apparaît nu au point de spawn — pas de cover garantie à l'entrée pour évaluer la situation.

### Recommandations 🔴

1. **Créer un `CoverStore`** avec entrées par map : `{ id, pos, size, type: "hard"|"soft"|"hybrid", state: "static"|"moveable"|"moving"|"dynamic", height: "low"|"high" }`
2. **Tagger les objets 3D dans les GLB** via custom attributes Three.js (ou fichier annexe `cover-data.json`) — ne pas laisser le cover implicite
3. **Garantir au moins 1 cover au point de spawn** du joueur
4. **Respecter la règle de distance** : `distance = vitesse_joueur × temps_safe_souhaité` entre les covers
5. **Varier les hauteurs** : low cover (tir par-dessus + vault) ET high cover (coins seulement)
6. **Éviter l'effet "cette zone crie COMBAT"** — placer du cover aussi dans les zones non-combat
7. **Configurer le cover destructible** via le système de dégâts existant

---

## 3. PLAYSTYLES — Les 4 archétypes supportés par les maps ?

### État actuel : ⚠️ PARTIEL (combat OK, maps NON)

Le système de combat supporte 5 archétypes (Mage, Archer, Guerrier, Guerrier Spatial, Ninja) avec des sorts distincts. Mais les maps **n'offrent rien** pour matérialiser ces playstyles.

**Matrice archétype × map** :

| Playstyle | Archétype(s) | Support map | Gap |
|---|---|---|---|
| **Rusher** (charge frontale) | Guerrier, Guerrier Spatial | ❌ | Pas de couloir de charge, pas de ligne droite dégagée |
| **Sniper** (lignes de vue longues) | Archer, Mage | ❌ | Pas de positions surélevées, pas de sightlines > 20m |
| **Ninja** (flanking, routes secondaires) | Ninja | ❌ | Pas de routes de flanking taggées, pas de passages étroits |
| **Opportunist** (interactables) | Tous | ❌ | Aucun interactable de combat (barils, tourelles, pièges) |

**Analyse des chunks (Forge)** :
- Hauteurs Z : 137-183 (46 unités de dénivelé max sur 8 chunks) — relativement plat
- Le plus haut chunk (chunk_02, z≈183) n'est pas marqué comme "sniper position"
- Les spawns ennemis sont dispersés aléatoirement sans structure de route

**Ce qui existe mais n'est pas exploité** :
- Le catalogue NPC a 40+ types avec des rôles variés : DPS (tireurs), Bruiser (mêlée), Tank (encaissement), Heal (soutien)
- La broadphase NPC (`npcRegistry`) permet `forEachEnemyInRadius` — ready pour des zones
- `respawnManager` a `ANTI_CAMP_M = 8` — anti-camping existe mais pas de routes de flanking explicites

### Recommandations 🟡

1. **Ajouter des tags de route aux maps** : chaque map définit des `Route[]` :
   ```ts
   interface Route {
     id: string;
     kind: "main" | "flank_left" | "flank_right" | "sniper_nest" | "ninja_path";
     waypoints: [number,number,number][];
     recommendedFor: ArchetypeId[];
   }
   ```
2. **Créer au moins 2-3 routes principales par map** (vs règle d'or #3 : *Less is more*)
3. **Ajouter des positions surélevées** (sniper nests) visibles avant d'entrer dans l'arène
4. **Les routes de flanking doivent être visibles depuis le front principal** mais pas accessibles immédiatement
5. **Ajouter des interactables** : barils explosifs, tourelles contrôlables, pièges au sol
6. **Pour l'Orchid Ninja** : au moins un passage étroit par map pour les compétences d'assassin

---

## 4. VANTAGE POINTS — Montrés avant l'entrée dans l'arène

### État actuel : ❌ ABSENT

**Règle d'or #2 du livre** : *Show, don't tell — montrer le combat space avant d'y entrer.*

**Ce qui existe** : Rien. Le système de streaming (`StreamingPuzzleMap.tsx`) charge les chunks par distance au spawn, avec un reveal global une fois tous les chunks "essentiels" chargés. Pas de camera reveal, pas de plan d'ensemble.

**Donjon Furiste** : Le spawn est à [0, 6, 34], l'arène au centre en 0,0,0. Le joueur apparaît face à l'arène (regard vers -Z). C'est une **approximation naturelle** d'un vantage point, mais :
- Aucun temps d'arrêt ne permet au joueur d'observer
- Pas d'annotation UI des positions clés
- Pas de highlight des menaces (snipers ennemis, tourelles)
- Pas de highlight des opportunités (cover, routes de flank)

**Ce qu'il faudrait** (du livre) :
- Montrer MENACES (snipers) ET opportunités (cover, routes cachées, interactables)
- Piège si le vantage est trop puissant : le joueur tue tout sans bouger → solution : vitre blindée, cover fragile, renforts
- Le joueur doit pouvoir PLANIFIER avant d'engager

### Recommandations 🟡

1. **Créer un système de `MapReveal`** : déclenché par zone trigger à l'entrée :
   - Freeze camera 2-3 secondes
   - Overlay icons sur les points clés (⚠️ menace, 🛡️ cover, ➡️ route de flank)
   - Animation de "scan" qui révèle la minimap tactique
2. **Marquer le point de spawn comme vantage point** dans chaque map — position dédiée avec vue dégagée
3. **Ajouter des "teasers"** : montrer l'arène finale depuis le spawn AVANT qu'elle soit accessible (boucle de level design classique)
4. **Ne pas rendre le vantage trop puissant** : si le joueur peut sniper depuis le spawn, ajouter des renforts qui arrivent par l'arrière

---

## 5. ENCOUNTER DESIGN — Vagues et patterns

### État actuel : ⚠️ BASIQUE

**Ce qui existe** (`respawnManager.ts`) :
- Temps de respawn configurable par placement (0 = jamais pour les boss, 45s par défaut)
- Anti-camping (8m de rayon)
- Epoch system pour remount React propre
- `packSize` (1-5) pour le groupe

**Ce qui manque** (du livre) :

| Principe | Livre | Statut |
|---|---|---|
| Vague 1 = faible | Première vague laisse le joueur absorber l'espace | ❌ Pas de vague — tout spawn en même temps |
| Triangle pattern | Mêmes types, plus nombreux | ❌ |
| Diamond pattern | Types plus forts, moins nombreux | ❌ |
| Curveballs | Fumée, tremblements, changement de cover | ❌ |
| Renforts nouvelle direction | Ennemis arrivent de flancs/arrière | ❌ |
| Ennemis qui reculent | Combat space change de phase | ❌ |

**Analyse** : Tous les NPCs sont placés statiquement et respawnent au même endroit. Le combat ne progresse pas — c'est un "mur" qui se reforme indéfiniment.

### Recommandations 🟡

1. **Ajouter un système d'`EncounterWave`** :
   ```ts
   interface EncounterWave {
     id: string;
     delay: number; // ms après début combat ou vague précédente
     spawns: { placementId: string; count: number; fromDirection?: "front"|"left"|"right"|"rear" }[];
     curveballs?: ("smoke"|"quake"|"cover_change"|"darkness")[];
   }
   ```
2. **Première vague = faible** (mobs isolés) → le joueur apprend l'espace
3. **Deuxième vague = triangle** (plus de mêmes ennemis)
4. **Troisième vague = diamond** (types plus forts, moins nombreux)
5. **Ajouter des "curveballs"** : au moins 1 par encounter qui force le joueur à s'adapter
6. **Les boss (respawnSec=0)** doivent déclencher des patterns de vagues spéciales

---

## 6. NAVIGATION & GUIDANCE

### État actuel : ⚠️ ART OK, GAMEPLAY ❌

**Ce qui existe** (good) :
- Factions visuellement distinctes (Akar'lys bleu, Mezalayis orange, Zayan vert)
- Tileset cohérent par planète (COHERENCE_LEVEL_DESIGN.md)
- Minimap avec ennemis rouges (<60m), marchands jaunes, portails violets

**Ce qui manque** :
- Pas de **landmarks** macro/meso visibles et reconnaissables sous tous les angles
- Pas de **signposting** : éclairage, lignes de convergence, breadcrumbs
- Pas de **visual language** gameplay : "cette zone est sûre/ dangereuse / infranchissable"
- Les "nope zones" (murs `block`) sont invisibles — le joueur les découvre en s'y cognant
- Pas de **teasing** : montrer un objectif avant qu'il soit accessible

### Recommandations 🟢

1. **Ajouter au moins 1 landmark macro + 2 landmarks meso par map** (objets distinctifs, visibles de loin)
2. **Utiliser l'éclairage comme guide** : zones claires = sûres / objectif, zones sombres = danger
3. **Rendre les nope zones visibles** : barrière visuelle (laser, fumée, marquage au sol) plutôt que mur invisible
4. **Teasing** : montrer le boss/objectif depuis le spawn mais verrouiller l'accès jusqu'à certaines conditions
5. **Ajouter des breadcrumbs** : traces au sol, lumières, marquages qui mènent à l'objectif
6. **Minimap tactique** : ajouter les covers, routes de flanking, et zones de danger sur la minimap

---

## 7. ENNEMIS ET SYNERGIE

### État actuel : ⚠️ RICH CATALOGUE, USAGE PLAT

**Forces** :
- 40+ NPCs dans `npcCatalog.ts` avec descriptions détaillées
- 4 classes (DPS, Tank, Bruiser, Heal) avec sorts distincts
- 20+ ennemis variés : tireurs, mêlée, boss, monstres alien
- Factions distinctes : Akar'lys (alliés), Mezalayis (mercenaires), Zayan (aliens)

**Faiblesses** :
- Placement = liste plate de `[x,y,z]` — pas de synergie entre types
- Pas de "squad templates" combinant plusieurs rôles
- Pas d'introduction progressive des nouveaux types
- Les boss (respawnSec=0) ne déclenchent pas de pattern spécial
- Les sorts PNJ existent mais l'IA ne fait pas de combos coordonnés

### Recommandations 🟢

1. **Créer des `SquadTemplate[]`** : combinaisons reproductibles d'ennemis (ex: 2 DPS + 1 Tank + 1 Heal)
2. **Introduire les nouveaux types progressivement** : d'abord seul, puis en groupe avec support
3. **Patterns de boss** : ajouter des phases avec des schémas d'attaque cohérents
4. **Synergie entre types** : DPS derrière un Tank, Heal qui buff les Brutes — utilise le système de factions existant

---

## 8. ANALYSE PAR MAP

### Forge (forge_map) — 8 chunks

| Critère | Note | Commentaire |
|---|---|---|
| Taille | ✅ | ~500×500 unités, 8 chunks |
| Complexité | ⚠️ | Décor riche mais pas de structure tactique |
| Couloirs | ❌ | Pas de routes/flancs identifiés |
| Cover | ❌ | Visuel seulement |
| Vantage | ❌ | Spawn à [0,5,10] — pas de vue dégagée |
| Verticalité | ❌ | Z: 137-183, quasiment plat |
| Boss | ❌ | Pas de zone boss dédiée |

**Offset** : [181, -401, -47] — le spawn est à [0,5,10] corrigé. Le sol au spawn est à y≈-27.8.

**PNJ** : Quêtes sur Forge (questCatalog.ts lignes 64-106) mais pas d'arène de combat dédiée.

### Donjon Furiste (donjon_furiste) — 4 chunks

| Critère | Note | Commentaire |
|---|---|---|
| Taille | ✅ | 4 chunks = plus contenu, idéal pour donjon |
| Entrée | ⚠️ | Spawn à [0,6,34] face à l'arène — meilleure configuration |
| Structure | ⚠️ | Architecture de donjon mais pas de salles/séquences |
| Cover | ❌ | Idem |
| Progression | ❌ | Pas de vagues ou de phases |
| Boss | ❌ | Pas de salle de boss identifiée |

**Structure** : Entrée (z=+34) → arène (z=0). Le donjon a une progression naturelle qui pourrait être exploitée avec des portes (gates) et des salles (rooms). La configuration actuelle est une bonne base mais manque de design tactique.

### Orbital — 8 chunks

| Critère | Note | Commentaire |
|---|---|---|
| Taille | ✅ | Massive (rayons jusqu'à 30k unités) |
| Problème technique | ⚠️ | Enveloping shell de 4702×2463×5724 corrigée |
| Contenu | ❌ | Chunks très dispersés (x:-449 à x:7364) |
| Jouabilité | ❌ | Trop grand pour être une arène de combat |

**Note** : Orbital est une map spatiale à très grande échelle, pas une arène de combat classique. Son design est plus proche d'un monde ouvert que d'un combat space. Le chunk 7 a un rayon de 30,836 unités à cause de la coque qui a été corrigée.

---

## 9. INFRASTRUCTURE TECHNIQUE — Ce qui existe et peut être réutilisé

**Points forts existants** :

| Composant | Usage pour level design |
|---|---|
| `mapBoundsStore` (block/keepIn) | Peut être étendu pour tagger des zones de cover |
| `npcRegistry.grid` (CELL=4) | Broadphase déjà prête pour query zones × ennemis |
| `spawnPointStore` | Point de spawn éditable → peut devenir point de vantage |
| `respawnManager` | Anti-camping et epoch déjà bons |
| `factions.ts` | Relations Aly/Enemy tracées → peut guider les combats |
| Streaming chunks | Chargement par distance déjà prêt pour des reveals progressifs |
| `damageEvents` (damageEvents.ts) | Feedback visuel déjà implémenté |
| Minimap (lisibilite spec) | Déjà prête pour afficher cover/routes |

**Extension minimale** : un fichier `mapTacticalData.ts` par map avec les zones, routes, covers, et vagues — sans toucher au système de streaming.

---

## 10. RECOMMANDATIONS PRIORISÉES

### 🔴 Immédiat (bloquant pour le level design)

1. **Créer un système de cover data-driven** — tagger les objets 3D comme cover (hard/soft/hybrid) dans chaque map
2. **Définir des zones tactiques** pour Forge et Donjon Furiste (entrée → front → flancs → arrière)
3. **Marquer le point d'entrée comme vantage** — au moins un plan d'ensemble avant le combat
4. **Garantir du cover au spawn** — le joueur doit pouvoir s'abriter dès l'entrée

### 🟡 Court terme (équilibrage des maps)

5. **Ajouter 2-3 routes par map** dont au moins une route de flanking visible depuis le front
6. **Créer des vagues d'ennemis** (1=faible, 2=triangle, 3=diamond) au lieu du respawn plat
7. **Ajouter des positions surélevées** pour le playstyle Sniper
8. **Ajouter des interactables** (barils explosifs, tourelles) pour l'Opportunist
9. **Exploiter le Donjon Furiste** comme premier niveau "tutoriel" avec progression room-by-room

### 🟢 Moyen terme (contenu & polish)

10. **Ajouter des landmarks** macro et meso par map
11. **Rendre les nope zones visibles** plutôt que des murs invisibles
12. **Créer des squad templates** combinant les 40+ NPCs en patterns de combat
13. **Ajouter le cover et les routes sur la minimap**
14. **Unifier les formules de dégâts** (cf. audit-combat-rapport.md, déjà documenté)
15. **Donjon Furiste** : ajouter portes (gates) et salles (rooms) pour pacing hall → room → hall → room

---

## 11. FICHIERS ANALYSÉS (12)

```
src/rpg/npc/npcPlacementStore.ts         ✓  (115 lignes — placement PNJ par map)
src/rpg/npc/respawnManager.ts            ✓  (78 lignes — respawn + anti-camping)
src/rpg/npc/npcRegistry.ts               ✓  (188 lignes — broadphase spatiale)
src/rpg/npc/npcCatalog.ts                ✓  (261 lignes — 40+ NPCs)
src/rpg/runtime/mapConfig.ts             ✓  (25 lignes — MAP_SPAWN)
src/rpg/runtime/mapBoundsStore.ts        ✓  (281 lignes — murs invisibles)
src/rpg/runtime/mapBoundsFit.ts          ✓  (96 lignes — calcul d'emprise)
src/rpg/runtime/spawnPointStore.ts       ✓  (41 lignes — spawn éditable)
src/rpg/runtime/StreamingPuzzleMap.tsx   ✓  (1039 lignes — streaming chunks)
src/rpg/factions/factions.ts            ✓  (37 lignes — relations factions)
src/rpg/runtime/core/worldTypes.ts       ✓  (41 lignes — types monde)
docs/COHERENCE_LEVEL_DESIGN.md           ✓  (61 lignes — guide artistique)

Chunks metadata:
  public/models/Maps/forge_map/chunks_v3/chunk-metadata.json  ✓  (8 chunks)
  public/models/Maps/Orbital/chunks/chunk-metadata.json       ✓  (8 chunks)
  dist/models/Maps/donjon/                                    ✓  (4 chunks)
```

---

## Conclusion

Narvos Prime a une **architecture technique solide** (streaming, broadphase, persistence) et une **direction artistique cohérente** (factions, tilesets). Mais le **level design tactique est inexistant** : les maps sont des décors 3D sans structure de combat, sans cover, sans routes, sans vagues. 

Le combat système a 5 archétypes bien définis, mais les maps ne permettent à aucun de s'exprimer pleinement. Le joueur arrive dans un espace ouvert, tire sur des ennemis qui respawnent au même endroit toutes les 45 secondes, sans progression, sans surprise, sans choix tactiques.

**Le gap principal** n'est pas technique mais conceptuel : le jeu a été construit comme "exporter une map Unreal → ajouter des ennemis → combat", sans la couche de design qui transforme un décor en **arène de combat**. La priorité #1 est d'ajouter cette couche — cover data, zones tactiques, routes, vagues — en s'appuyant sur l'infrastructure existante qui est prête à l'absorber.

*Rapport généré par audit niveau design, Juillet 2026. Aucun test d'exécution réalisé — analyse statique du code source et des métadonnées.*