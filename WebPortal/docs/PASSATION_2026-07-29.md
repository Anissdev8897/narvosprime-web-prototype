# Passation — session du 2026-07-29

Pour l'agent qui reprend. Trois parties : ce qui est corrigé et vérifié, ce que
je n'ai **pas** réussi à corriger (avec ce que j'ai éliminé, pour ne pas le
refaire), et la liste restante avec les pistes que j'ai pu établir.

**État du dépôt** : 709 tests / 93 fichiers verts · `tsc` = 1 erreur
pré-existante (`CollisionWorld.ts:20`, typage `three-mesh-bvh`) · aucun linter.

---

## 1. Corrigé et vérifié

### 1.1 Détection du sol — `raycaster.far` était un plancher monde

`CollisionWorld.getGroundY()` faisait `raycaster.far = fromHeight + 60`. Ce n'est
pas une distance de recherche : c'est un **plancher absolu à y = −60**, où qu'on
soit. La Forge porte un offset de −401 → sous −60, plus aucune détection de sol.
Et dès que `fromHeight` passait sous −60, `far` devenait **négatif** : le raycast
ne renvoyait plus jamais rien, sans erreur.

Remplacé par `GROUND_SEARCH_DEPTH = 1000`, une vraie distance.

**C'est la cause racine du « trigger qui fait respawn au même endroit ».** Preuve
dans le log utilisateur : six chutes aux **mêmes X/Z** `(-264.9, …, 298.2)` —
le joueur n'avait jamais bougé, il tombait au point d'apparition en boucle.

### 1.2 Filet anti-chute — deux constantes globales

`CharacterController` ligne ~248 : seuil `y < -50`, renvoi à `(0, 5, 0)`. Aucune
des deux ne survit à une map décalée (sol de la Forge à ≈ −27,8).

Devenu de la donnée de map : seuil via `mapBoundsStore.fallFloor()`, renvoi via
`mapSpawn()`. Plus un **plafond dur** dans `fallThreshold()` : le seuil est forcé
à ≥ 200 unités sous le point d'apparition, quelle que soit la valeur réglée ou
héritée. Marge auto `MARGE_CHUTE = 300`.

Trace ajoutée : chaque renvoi logue position, seuil et compteur (`[Chute n]`).

### 1.3 Coques enveloppantes — le filtre supprimait le sol

`isEnvelopingShell` ne testait que la diagonale. Mesuré au `gltf-transform` sur
`chunks_v3` : **4 plaques de sol** classées coques et retirées de la collision.

```
chunk_06  ground_with_grass…  2301 tris  1737 x  168 x 1935
chunk_06  ground_with_grass…  1412 tris  1307 x   79 x 1839
chunk_06  cliff_blend_005…     686 tris  1366 x   41 x 1677
chunk_06  cliff_blend_2…      3570 tris  1444 x   47 x 1700
```

Critère ajouté : **épaisseur du plus petit axe ≥ 1500** (`EPAISSEUR_MIN`),
diagonale portée à 4000. Une coque enveloppe → grande dans les trois axes ; un
sol est plat. Re-mesuré après correctif : **Forge 0 exclusion**, Orbital garde sa
vraie coque (`001`, 4702×2463×5724, 1719 tris).

### 1.4 Système de murs invisibles admin

Neuf, testé, opérationnel (confirmé en jeu par l'utilisateur).

- `runtime/mapBoundsStore.ts` — murs par map, persistés, hydratés. Deux modes :
  `block` (volume interdit, test 3D) et `keepIn` (volume autorisé, test
  **horizontal seulement** — un test vertical ferait de la limite un plafond).
  17 tests.
- `runtime/mapBoundsFit.ts` — `fitMapExtent()` mesure l'emprise sur la géométrie
  chargée en écartant les coques, et **élargit pour inclure les PNJ placés**.
  7 tests.
- `runtime/MapBoundsGizmo.tsx` + `MapBoundsPanel.tsx` — UI admin (bouton
  « ⬛ Limites »). Boutons « Cerner la map », « Mur ici », édition centre/taille/
  rotation, activation, suppression, altitude de chute.
- `CharacterController.moveAxis` teste la position d'**arrivée**, et ne bloque
  jamais quelqu'un déjà hors zone (sinon il serait figé sans pouvoir revenir).
- `mapBoundsStore.setActiveMap()` posé en `useLayoutEffect` dans `RpgGameWorld` —
  c'est ce qui permet à `CharacterController` de rester du TS pur.

**Orbital n'a aucun mur par défaut**, comme demandé.

### 1.5 Troopers sans texture

Cause : les **33 GLB** du pack ont un seul matériau, `WorldGridMaterial` — le
damier gris par défaut d'Unreal. Le pack a été exporté sans ses matériaux. Ce
n'était pas une régression de code.

Retirés du roster. Garde-fou dans `playerAvatars.test.ts` : ouvre chaque GLB et
refuse tout avatar resté sur `WorldGridMaterial`. Pour les rétablir : réexport
depuis Unreal avec les Material Instances assignées aux Skeletal Meshes.

### 1.6 Skill `narvos-level-design`

`.claude/skills/narvos-level-design/SKILL.md` — digère le PDF de level design
fourni et porte la **première table de métriques joueur** du projet, calculée
depuis le code :

```
taille 1,26 m · accroupi 0,69 m · rayon 0,245 m · marche franchissable 0,28 m
saut : 0,87 m de haut, 0,56 s en l'air
portée : 1,80 m en marche · 3,38 m en course · 5,35 m en sprint
pente max marchable : 60°  (getGroundY filtre normale.y > 0.5)
```

Règle utile immédiatement : un vide de **2 à 3,3 m** est le pire cas —
franchissable en courant, pas en marchant. Rester sous 1,7 m ou au-delà de 4 m.

Le PDF fait 133 Mo, au-delà de la limite de l'outil Read. Passer par
`pdftotext -layout`.

---

## 2. Ce que je n'ai PAS réussi à corriger

### 2.1 La map disparaît au changement de personnage

Signalé résolu côté utilisateur (« le changement fonctionne, mais certains
éléments se dégradent »), mais **je n'ai jamais trouvé la cause**. Quatre
hypothèses éliminées avec preuve — ne pas les refaire :

| Piste | Pourquoi elle ne tient pas |
|---|---|
| Éviction du préchargeur | `evictMapAssets` ne se déclenche que si `lastMapId !== mapId`. Retour sur la même map → pas d'éviction. |
| Dispose des textures terrain | Elles vivent dans les **uniforms d'une closure** (`makeAutoMaterial`), et tous les slots `map`/`normalMap`… sont mis à `null`. `disposeMaterial` itère `Object.keys(mat)` → ne les voit pas. |
| `disposeAutoMaterial()` | Existe et remet correctement `loadPromise = null`, mais **personne ne l'appelle**. |
| `gameReady` non remis à `false` | L'effet `[stage]` fait bien `setGameReady(false)` à chaque entrée en jeu. |

Piste non explorée, la plus prometteuse : dans `StreamingPuzzleMap`, le chemin de
révélation où `doLoadChunk` n'appelle **pas** `setLoadedChunks` pendant le
chargement initial (optimisation Phase 3). Un commentaire ligne ~889 dit
explicitement que sans le flush on révèle « une map TOTALEMENT INVISIBLE —
collision présente, aucun visuel ». Si le symptôme se reproduit **avec la
collision qui marche**, c'est là qu'il faut chercher.

### 2.2 Crash accroupi + strafe

Non diagnostiqué. J'ai vérifié et écarté : NaN via `computeWallHeights`
(`crouchHeightMult` 0,55 × échelle min 0,2 reste positif), `setClips` en boucle
(dépend de `[clips, weaponDrawn]`, pas de la frame), récursion dans `moveAxis`.

Hypothèse restante, non prouvée : perte de contexte WebGL par thrash de
chargement de chunks. Les correctifs 1.1 et 1.3 devraient l'atténuer puisqu'ils
suppriment la boucle chute → renvoi → re-streaming. **À retester.**

### 2.3 Monstres invisibles

Éliminé : fichiers manquants (59/59 présents), résolution de qualité (59/59
servis), `characterScale` (clampé ≥ 0,2). Un diagnostic console
`__narvosNpcDiag()` est installé (`npc/npcVisibilityDiagnostic.ts`) mais
**n'a jamais été exécuté**. C'est le premier geste à faire sur ce sujet.

### 2.4 Spawn Orbital dans le vide

Mesuré : aucun sol à 5 points près de l'origine. Le contenu réel est vers
x ≈ 700–7000. `MAP_SPAWN` n'a pas d'entrée `orbital` → repli `(0,5,0)`.
À poser avec l'outil « 🚩 Spawn » existant, ou à ajouter dans `mapConfig.ts`.

---

## 3. Reste à faire — avec les pistes établies

### 3.1 Freeze de ~15 s en sortant d'un vaisseau — **cause quasi certaine**

Log utilisateur :

```
[NavMeshBaker] 204×197 grille baked en 16412ms (2988/40188 walkable)
```

**16,4 secondes.** Le bake est lancé par `WasmWorldTicker.tsx:61` dans un
`useEffect` dont la dépendance est `[enabled]` :

```tsx
useEffect(() => {
  if (!enabled || !isEngineLoaded()) return;
  …
  void bakeNavMeshFromScene();
  return () => { clearBakedNavMesh(); … };
}, [enabled]);
```

Si `enabled` bascule (ou si le composant est remonté) à l'embarquement puis au
débarquement, le navmesh est **rebaké intégralement**. Le commentaire dit
« fire-and-forget … NE DOIT PAS retarder l'affichage », mais 16 s mesurées
disent que ça bloque en pratique.

Pistes : ne rebaker que si la scène de collision a réellement changé ; découper
le bake en tranches avec `await requestAnimationFrame` entre chaque (même
technique que le chargement séquentiel des chunks) ; ou mettre le résultat en
cache par map.

### 3.2 Valkiria marche à l'envers — **piste établie**

`playerAvatars.ts:92` :

```ts
{ id: "valkiria", label: "Valkiria", isMeshy: false, ownAnimPath: VALKIRIA, ueMannequinRig: true }
```

C'est un rig **mannequin Unreal**, pas Mixamo. Les deux conventions n'ont pas le
même axe avant : Mixamo regarde −Z, le mannequin UE regarde +X. Le blend
directionnel et l'application du yaw supposent la convention Mixamo → l'avatar
joue `walk_forward` en étant tourné à l'opposé.

Le log confirme que les clips sont bien là (16 clips directionnels chargés). Ce
n'est donc pas un problème d'animation mais **d'orientation du modèle**. Piste :
un offset de yaw par avatar (probablement 180° ou 90°), à poser à côté du drapeau
`ueMannequinRig` plutôt qu'en dur.

Attention, commentaire existant ligne 88 : *« son rig source contient une FAUTE
DE FRAPPE »* — à lire avant de toucher.

### 3.3 Vue FPS — le gros morceau

Quatre demandes qui forment un seul chantier :

- Les animations de poing en FPS n'affichent pas les bras
- Ajouter un vrai corps visible en FPS (bras + mains)
- Mode arme complet en FPS, animations arme et mains synchronisées
- Reconfigurer entièrement les animations armes et poings (partiellement
  présentes et mal câblées)

Ce qui existe déjà et qu'il faut relire avant d'écrire quoi que ce soit :
`camera/cameraViewStore.ts` (miroir de `camState.view`, publie uniquement au
changement), `characters/builtinWeaponMask.ts` (masque les armes fusionnées au
mesh), `weapons/shotgunFpsRegistry.ts`, `weapons/weaponAnimClips.ts` (132 clips,
5 familles), `combat/unarmedStrikes.ts` (8 frappes latéralisées),
`animation/mirrorClip.ts`.

Contrainte donnée par l'utilisateur : les animations doivent être **synchronisées
entre FPS et TPS** pour rester cohérentes en multijoueur.

### 3.4 Nettoyage du catalogue d'armes

Supprimer tous les objets et équipements hors catalogue officiel.
`weapons/weaponClassifier.ts` distingue déjà `clip` (animation), munition, prop
et arme — s'en servir plutôt que de filtrer à la main. Un test existant vérifie
le compte d'armes montables (47/48 à une époque) : il cassera si le filtrage
change, c'est voulu.

### 3.5 Ombres, qualité visuelle, harmonisation

- Vrai système d'ombres, rendu à améliorer
- Textures et matériaux de la map
- Harmoniser textures / effets / matériaux via le système de Skills

Le skill `narvos-level-design` section 5 (Lisibilité) donne la direction : ce
n'est pas une absence de couleur mais de l'**harmonie** — environnement désaturé,
personnages et éléments importants saturés ; gradient de complexité visuelle
(peu de détail là où on marche, plus dans les plafonds et zones non praticables).
Les 7 couches de terrain de l'auto-material sont le bon point d'application.

### 3.6 Limites de map sur toutes les cartes

Le système fonctionne sur la Forge. À vérifier map par map. Rappel : Orbital est
volontairement sans mur, l'utilisateur les pose lui-même.

### 3.7 Micro-freezes résiduels

Au-delà du 3.1. Les chunks mettent 3,5 à 11,5 s chacun à charger et montent à
794 Mo de VRAM cumulés (log). Le `rayon de culling corrigé` apparaît sur 4
chunks sur 8 avec des écarts de 31 à 86 % — les métadonnées sous-estiment les
rayons, donc le culling est faux tant que la correction runtime n'a pas eu lieu.
Regénérer les métadonnées de chunks corrigerait ça à la source.

---

## 4. Règles de travail sur ce projet

- **Mesurer avant de conclure.** J'ai perdu du temps cette session à deviner des
  causes sur des composants que je ne peux pas exécuter. Les trois vraies
  trouvailles viennent toutes d'une mesure (gltf-transform sur les chunks, log
  utilisateur, calcul depuis `playerConfig`).
- Le volet navigateur de l'agent **ne composite pas les frames** :
  `requestAnimationFrame` ne se déclenche jamais, la map ne s'assemble pas.
  Toute vérification visuelle passe par l'utilisateur.
- Consigne explicite de l'utilisateur : *« ne valide jamais une fonctionnalité
  uniquement parce que le code est présent »* et *« fais attention à ne pas créer
  d'itérations qui te feraient refaire d'autres manips »*.
- Skills du projet : `narvos-measure-first`, `narvos-level-design`,
  `narvos-mesh-pipeline`, `narvos-iteration-guard`, `narvos-error-log`,
  `narvos-project-map`, `narvos-preflight`, `wasm-engine`.
- Commentaires et docs en **français**.