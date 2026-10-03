# 🔧 CORRECTIONS — session du 31/07/2026

Toutes les corrections de la session, avec pour chacune : le symptôme observé, la
cause racine **mesurée**, le correctif, et ce qui reste à vérifier.

État global : **112 → 109 erreurs tsc**, tests **40 échecs / 1707** inchangés
(tous pré-existants), aucune régression introduite.

---

## Vue d'ensemble

| # | Symptôme | Cause racine | Fichier |
|---|---|---|---|
| 1 | TPS écran noir (regard vers le haut) | borne de confort l'emportant sur la géométrie | `CollisionWorld.ts` |
| 2 | Caméra verrouillée à vie sur un NaN | accumulateur persistant sans validation | `FpsCamera.ts` |
| 3 | Chute de framerate (ma régression) | raycast exhaustif à chaque frame | `FpsCamera.ts` |
| 4 | Les coups ne s'animent pas | pack d'animation jamais chargé | `OwnAnimPlayerCharacter.tsx` |
| 5 | Pack d'animation de 521 Mo | géométrie embarquée dans chaque clip | `strip-anim-meshes.mjs` |
| 6 | 43 fichiers pour 7 actions | variantes renommées à l'identique | `animationPacks.ts` |
| 7 | Accroupi ne suit pas la direction | poids des diagonales perdus | `AnimationController.ts` |
| 8 | Sol traversable, trous dans la map | soupape plus courte que le chargement | `StreamingPuzzleMap.tsx` |
| 9 | Chute sous la map à la connexion | gravité active sans collision | `PlayerRig.tsx` |
| 10 | Joueur posé 200 m trop bas (ma régression) | garde levée au premier chunk | `PlayerRig.tsx` |
| 11 | Point d'apparition hors de la map | valeur jamais vérifiée | `mapConfig.ts` |
| 12 | Gels de ~1,8 s au démarrage | découpage en rangées, pas en temps | `NavMeshBaker.ts` |
| 13 | Reveal prématuré | filet de 120 s < 165 s de chargement | `App.tsx` |
| 14 | Un serveur injouable, l'autre non | **sauvegarde empoisonnée** | `RpgGameWorld.tsx`, `progressionStore.ts` |
| — | Pas de commande pour s'équiper | — | `registerAdminCommands.ts` |

---

## 1. Caméra TPS sous le sol

**Symptôme** — écran noir en 3ᵉ personne dès un regard vers le haut.

**Mesure** — au point d'apparition de la Forge (sol à −26), la caméra tombait à
**y = −28,83**, soit 2,83 m dans la roche, **dès 16,8°** de regard vers le haut.
Seuil = `asin(eyeHeight / tpsDistance)` = `asin(1,155 / 4)`.

**Cause racine** — `CollisionWorld.resolveCameraPosition` faisait :

```ts
const safe = Math.max(minDist, hits[0].distance - padding);
```

`minDist` est une borne de **confort** (ne pas coller à la tête du joueur). En
`Math.max`, elle l'emporte sur le point d'impact. Un agent l'ayant montée de
`0,84` à `2,0`, et le sol étant touché à 1,16 m, la fonction renvoyait 2,0 :
**l'anti-clip poussait lui-même la caméra à travers le sol**.

**Aggravation** — constatant que « la collision pousse la caméra dans le
terrain », l'agent suivant a **désactivé l'anti-clip** au lieu de corriger
`minDist`. La caméra est alors partie librement à 4 m sous la roche.

**Correctif** — le point d'impact devient une contrainte dure
(`safe = max(CAMERA_MIN_CLEARANCE, blocked)`), l'anti-clip est réactivé, et un
**plancher sol indépendant du toggle** est ajouté : `cameraCollisionStore` est
OFF par défaut à la demande de l'utilisateur, mais « pas d'anti-clip mur » n'a
jamais voulu dire « la caméra peut entrer dans le sol ».

**Couverture** — `FpsCamera.tps.test.ts`, dont un balayage −90°→+90°.

> **Règle** — une borne de **confort** doit toujours CÉDER à une contrainte
> **physique**. `Math.max(confort, géométrie)` donne le dernier mot au côté qui
> traverse.

---

## 2. Verrou NaN de la caméra TPS

`FpsCamera.tpsSmoothed` est un accumulateur **persistant** entre frames.
`NaN.lerp(valide, α)` reste `NaN` : une seule frame polluée verrouille la caméra
définitivement, et Three.js culle alors toute la scène.

Le mode FPS y échappait uniquement parce qu'il réécrit `cam.position.set(...)`
en entier à chaque frame — il s'auto-répare.

**Correctif** — ne rien absorber d'invalide, et se réinitialiser si
l'accumulateur a dérivé malgré tout.

> **Règle** — tout état lissé entre frames doit valider son entrée. `Math.max` /
> `Math.min` / `THREE.MathUtils.clamp` **ne filtrent pas** le NaN :
> `Math.max(1.5, Math.min(12, NaN))` vaut `NaN`.

---

## 3. Régression de perf que j'ai introduite

Le plancher sol du §1 appelait `collisionWorld.getGroundY()` **à chaque frame**,
sans condition. Or cette fonction utilise `firstHitOnly = false` sur
`GROUND_SEARCH_DEPTH = 1000` : elle **collecte tous les impacts** au lieu de
s'arrêter au premier. Le `CharacterController` en fait déjà une par frame — le
total avait doublé.

**Correctif** — le raycast ne part que si `target.y < pos.y + CLEARANCE`,
c'est-à-dire uniquement au-delà de ~17° de regard vers le haut.

> **Règle** — avant d'ajouter un appel dans `useFrame`, lire le CORPS de la
> fonction appelée. Le nom `getGroundY` suggère un raycast unique ; le code fait
> une collecte exhaustive sur 1000 unités.

---

## 4. Le combo de poings n'animait rien

**Symptôme** — clic gauche à mains nues : les dégâts partent, le personnage ne
bouge pas.

**Cause racine** — la chaîne était complète de bout en bout
(`mouseup` → `advanceCombo` → `oneShotAction` + `oneShotToken` → `play(action)`),
mais `UNARMED_PACK` n'était **dans aucune liste de jobs** du renderer réellement
monté. Son seul consommateur était `HumanCharacter` — le Sorcier legacy, jamais
monté.

**Ce qui masquait la panne** — `ACTION_FALLBACK` n'a aucune entrée pour
`punch*`/`kick`, donc `resolveAction` retombe sur `idle`, et le filet de secours
mappe `idle` sur `clips[0]`. **Ni erreur, ni avertissement.**

**Piège associé** — `bootAssets.ts` **préchargeait** `UNARMED_PACK` en HTTP.
Précharger n'injecte rien dans le mixer : le cache réseau était chaud, le
personnage restait sans clip. Une ligne de préchargement donne l'illusion du
câblage.

**Vérifié en jeu** :
```
[AnimLoad] 61 clips depuis 61 fichiers · [punch1, punch2, punch3, punch_charged, kick, kick_charged, …]
[AnimCtrl] murdock: fall→punch1 clip="punch1" dur=0.83s
```

> **Règle** — un filet de secours qui substitue silencieusement une action rend
> toute panne d'animation invisible. Il faut un `console.warn` nommant l'action
> manquante, sinon le diagnostic part sur la logique de combat, qui fonctionne.

---

## 5. Packs d'animation — 521 Mo → 48 Mo

Chaque « clip » du pack `FPP_combat_fists` embarquait le personnage entier :
1 mesh, 2 primitives, **5 textures**, 1 skin — **9,42 Mo par animation**.

Three.js lie les pistes aux **nœuds** par leur nom : mesh, skin, matériaux et
textures ne sont jamais lus dans un fichier de clip.

**Outil** — `scripts/strip-anim-meshes.mjs`
```bash
node scripts/strip-anim-meshes.mjs <dossier> [--out <dossier>] [--dry-run]
```
Résultat : **−90,8 %**, 69 os et l'animation préservés sur les 55 fichiers.
Originaux intacts (travail en `--out`, non destructif).

Trois pièges rencontrés en l'écrivant :
1. **Ne jamais pruner les nœuds** — dans un fichier de clip, les nœuds « vides »
   SONT le squelette. Garde-fou qui refuse d'écrire si le compte bouge.
2. `@gltf-transform/functions` tire `sharp`, binaire natif cassé sur cette
   machine. Pour une opération sans image, n'importer que `core`.
3. **Vérifier l'unité** avant de brancher un pack UE : lire la translation du
   `pelvis`. Ici 0,968 → mètres, donc pas concerné par le piège des clips UE4 en
   centimètres qui projette le squelette à 60 m.

---

## 6. Un clip par action

`UNARMED_PACK` déclare **43 entrées pour 7 actions** (12 variantes de `punch1`).
`renameClip` leur donne le même nom, `resolveActions` retient la première : les
36 autres étaient téléchargées, parsées, gardées en mémoire — jamais jouées.

`firstPerAction()` les filtre. Les variantes restent au catalogue pour un futur
tirage aléatoire par coup.

---

## 7. Marche accroupie directionnelle

**Symptôme** (rapporté) — « l'animation accroupie vers l'avant suit mal la
direction, pareil pour la droite ».

**Cause racine** — `solveLocomotion` raisonne sur **8 directions** (un cran tous
les 45°) mais `CROUCH_LOCOMOTION` ne fournit que **4 clips**. La clé
`crouchwalk_forwardRight` ne correspondait à aucune action : **le poids était
perdu**, pas redistribué.

Pire : `setLocomotionBlend` ne fabriquait de toute façon que des clés
`walk_<dir>` / `run_<dir>`. Les clips accroupis étaient chargés, enregistrés… et
à poids 0 en permanence. C'est la couche additive qui déformait une marche
debout.

**Correctif** — branche `crouchwalk` + table `CROUCH_FALLBACK` répartissant
chaque diagonale sur les deux cardinales voisines. Ajout du getter
`hasCrouchwalkLocomotion`.

**Bénéfice annexe** — élimine les **3 erreurs tsc pré-existantes**
d'`OwnAnimPlayerCharacter`. Elles n'étaient pas cosmétiques : elles pointaient
exactement ce trou fonctionnel.

> **Règle** — quand un solveur produit plus de cas que le jeu de clips n'en
> couvre, la clé manquante ne doit JAMAIS être silencieusement ignorée. Un
> `Map.get()` qui renvoie `undefined` dans une table de poids est une perte
> d'énergie invisible.

---

## 8. Chunks abandonnés → sol traversable

```
chargement réel   : 165 s (8 chunks)
soupape de reveal :  90 s        ← tirait AVANT la fin
puis              : loadQueueRef.current.length = 0   → file PURGÉE
```

La soupape se déclenchait pendant un chargement **qui progressait normalement**,
et purgeait la file. Les derniers chunks n'étaient **jamais** chargés : pas de
géométrie ⇒ pas de collider ⇒ sol traversable.

**Correctif** — soupape de **blocage** et non de durée : elle mesure le temps
écoulé depuis le **dernier chunk abouti** (`STALL_MS = 45 s`). Tant que ça
avance, on laisse finir.

Effet de bord voulu : **l'écran de chargement dure naturellement le temps qu'il
faut**, sans délai arbitraire.

> **Règle** — une soupape doit rattraper un BLOCAGE, pas punir la lenteur.

---

## 9. La gravité tournait pendant le chargement

`PlayerRig` n'avait **aucune garde** sur l'état du monde. `inputEnabled` ne coupe
que le clavier et la souris.

Pendant le streaming, `getGroundY` renvoyait `null`, et `fallThreshold` vaut
`FALL_HARD_FLOOR = −10000` tant que la map n'a aucune collision. Le joueur
tombait donc **jusqu'à −10000**.

**Correctif** — gel physique complet tant qu'aucun sol n'existe sous les pieds,
puis **pose** du joueur sur le sol mesuré avant que la gravité reprenne.

---

## 10. Ma propre régression sur ce gel

```
[PlayerRig] monde prêt — 71 colliders, joueur posé à y=-228.80
```

Le point d'apparition est à −26. Le gel se levait dès le **premier** collider —
c'est-à-dire dès le chunk 1 sur 8. `getGroundY` trouvait le seul sol disponible,
dans une partie basse de la map, et y posait le joueur.

**Correctif** — le gel exige désormais `worldReady` (map **entièrement**
assemblée, propagé depuis `revealed`) **en plus** de la présence d'un sol.

> **Règle** — un compteur de colliders ne dit pas si c'est le BON sol.

---

## 11. Le point d'apparition de la Forge était faux

Emprise réelle des 8 chunks, calculée depuis les accesseurs `POSITION` des GLB
plus l'offset `[181, −401, −47]` :

```
X [-2125, 1238]   Y [-536, 475]   Z [-736, 2160]
géométrie jouable : plafonne à Y = -51
```

`MAP_SPAWN.forge = [0, -26, 10]` était faux sur les **deux** axes :
- **Y** : −26 est **au-dessus de toute la map**
- **XZ** : (0, 10) est hors de **5 chunks sur 8**, et le seul sol qui s'y trouve
  appartient au chunk 1 dont la géométrie monte jusqu'à −168 → le joueur se
  retrouvait sous ~60 m de structure

Deux corrections successives à l'aveugle (5 → −26) l'avaient laissé faux.

**Correctif** — `[-444, -60, 712]` (centre de l'emprise mesurée) **plus** un
avertissement au démarrage : si `MAP_SPAWN` s'écarte du sol mesuré de plus de
20 m, la console le signale.

> **Règle** — un filet de rattrapage qui ne dit pas qu'il a rattrapé transforme
> un bug bruyant en bug silencieux. Le recalage au sol masquait l'erreur : quelle
> que soit la valeur de `MAP_SPAWN`, le joueur finit posé quelque part.

---

## 12. Le NavMesh gelait l'affichage par blocs de 1,8 s

```
[NavMeshBaker] 204×197 grille baked en 22395ms
```

Le code portait le commentaire « asynchrone et NE DOIT PAS retarder
l'affichage » — mais **`async` en JavaScript donne une promesse, pas un
thread**. Il rendait la main toutes les **16 rangées** : 12 fois pour 197.

22 395 ms / 197 ≈ **114 ms par rangée** → ~1,8 s de gel entre deux respirations,
douze fois. Et le bake démarre au `revealed=true`, pile quand le joueur prend la
main.

**Correctif** — budget de temps (6 ms) au niveau **cellule**. Il a fallu
descendre à la cellule : une rangée coûtant déjà 114 ms, un test en début de
rangée laissait passer le blocage entier.

> **Règle** — une granularité de découpage exprimée en *unités de travail* est
> toujours fausse quelque part ; exprimée en *millisecondes*, elle s'adapte.

---

## 13. Filet de sécurité d'App.tsx trop court

120 s < 165 s de chargement réel : il tirait systématiquement, révélant le jeu
par-dessus une map en assemblage — exactement ce qu'il devait éviter. Porté à
300 s, et il doit rester SUPÉRIEUR à la soupape de `StreamingPuzzleMap`.

---

## 14. Sauvegarde empoisonnée — la cause du « un serveur marche, l'autre non »

**Symptôme** — même build, mêmes correctifs : le serveur « arbre » fonctionne,
le serveur « héroïque » reste en écran noir.

**Cause racine** — `RpgGameWorld.tsx` :

```ts
const playerPos = useRef(
  saved?.position                            // ← dernière position SAUVEGARDÉE
    ? new THREE.Vector3(saved.position.x, saved.position.y, saved.position.z)
    : new THREE.Vector3(...mapSpawn(mapId))  // ← MAP_SPAWN seulement sans sauvegarde
);
```

Un personnage sauvegardé pendant qu'il était sous la carte y **renaît à chaque
connexion**, et `saveProgression` **y réécrit la même position**. C'est une
boucle de rétroaction : le bug d'origine est corrigé, mais sa trace persiste dans
les données et se réinjecte à chaque session.

Corriger `MAP_SPAWN` ne débloque pas ces personnages — la valeur n'est jamais
lue pour eux.

**Correctifs — trois couches :**

1. **`/respawn`** (admin) — renvoie au point d'apparition de la map. Cure
   immédiate pour un personnage déjà empoisonné. Le chat reste utilisable même
   écran noir.
2. **Dernière position saine** (`RpgGameWorld.tsx`) — `saveNow` ne persiste la
   position courante que si le joueur est `grounded`. En l'air, il réécrit le
   dernier point au sol ; à défaut, le point d'apparition de la map.
3. **Garde numérique** (`progressionStore.ts`) — refuse toute position non finie
   ou au-delà de ±20 000, et conserve l'ancienne plutôt que d'écraser. Une
   sauvegarde périmée reste jouable ; une sauvegarde folle, non.

> **Règle** — une différence de comportement entre deux jeux de DONNÉES sur un
> binaire identique élimine le code d'emblée. Avant de chercher un bug de rendu,
> **tester avec un personnage neuf**.

---

## Ajouts au mode admin

| Commande | Effet |
|---|---|
| `/give` | liste les profils équipables |
| `/give arch_sword` | équipe en primaire |
| `/give arch_gun secondary` | équipe en secondaire |
| `/give none` | déséquipe → combo de poings actif |
| `/respawn` | retour au point d'apparition de la map |

`/give none` n'est pas du confort : le combo de poings ne se déclenche que si
aucune arme **primaire** n'est équipée (`RpgGameWorld.tsx:1663`). Sans moyen de
se déséquiper, les animations de frappe sont intestables.

`/help` se construit depuis `getCommandNames()` — rien à maintenir en double.

⚠️ Le panneau admin s'ouvre avec **F8**, pas F12 (capturé par Electron).
Plusieurs commentaires du code parlent encore de F12 : ils sont périmés.

---

## 🔴 Alerte sécurité — à traiter séparément

`scripts/add_super_admin.mjs` contient un **identifiant et un mot de passe en
clair codés en dur**, commités dans le dépôt. À externaliser en variables
d'environnement, et ce mot de passe doit être considéré comme compromis :
il faut le changer.

Par ailleurs `isAdmin()` renvoie `true` inconditionnellement en build dev, et
pour quiconque écrit `localStorage.narvos:admin = '1'`. Le code l'assume comme
provisoire ; le rôle DB `SUPER_ADMIN` existe mais n'est jamais consulté par le
runtime 3D.

---

## Reste à faire

Voir `RAPPORT_PERF_2026-07-31.md` §5 pour le détail chiffré. Par impact :

1. 🔴 **BVH en worker** — `computeBoundsTree()` synchrone, 959 meshes
2. 🔴 **Fuite mémoire** — 22 Go dans le renderer ; tant qu'elle est là, toute
   mesure de perf après rechargement est fausse
3. 🟠 **KTX2 sur les chunks** — 1 264 Mo de VRAM, les chunks sont en WebP alors
   que les personnages sont en KTX2
4. 🟠 **Modèle du joueur** — rate son timeout de 15 s, en concurrence avec
   1 190 textures de map
5. 🟡 4 chunks sur 8 ont un rayon de culling faux dans leurs métadonnées

Non vérifié en jeu à ce stade : §11 (nouveau point d'apparition) et §14
(garde-fous de sauvegarde).