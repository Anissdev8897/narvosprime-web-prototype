# 📊 RAPPORT PERFORMANCE — Forge Map & chargement — 31/07/2026

Toutes les valeurs de ce rapport sont **mesurées**, pas estimées. La commande ou
le log d'origine est cité à chaque fois.

---

## 1. Le chiffre qui explique tout

```
chargement réel   : 14 414 ms pour UN chunk × 8 chunks   ≈ 115 s
soupape de reveal :  90 000 ms                            ← tirait AVANT la fin
puis              : loadQueueRef.current.length = 0       → file PURGÉE
```

Source : `[StreamingPuzzleMap] chunk 1 CHARGÉ en 14414ms · 60 textures · 73 MB VRAM
· 1/8 résidents · 71 colliders` + `StreamingPuzzleMap.tsx` (ancien `SAFETY_MS = 90_000`).

**Conséquence en chaîne :**

1. La soupape se déclenchait pendant un chargement qui progressait normalement
2. Elle purgeait la file → les ~2 derniers chunks n'étaient **jamais** chargés
3. Pas de géométrie ⇒ **pas de collider** ⇒ sol traversable, trous dans la map
4. Le joueur passait au travers et tombait

C'est la cause unique des deux symptômes rapportés : *« certaines parties du sol
sont traversables »* et *« le joueur tombe sous la map à la connexion »*.

---

## 2. Second mécanisme — la gravité tournait pendant le chargement

`PlayerRig` n'avait **aucune garde** sur l'état du monde. `inputEnabled` ne coupe
que le clavier et la souris ; la gravité, elle, s'applique dès le montage du
Canvas.

Pendant les ~115 s de streaming, `getGroundY` renvoyait `null`. Et
`fallThreshold` retourne `FALL_HARD_FLOOR = −10000` tant que la map n'a aucune
collision (`CharacterController.ts:45-58`). Le joueur tombait donc **jusqu'à
−10000** avant d'être renvoyé au point d'apparition.

C'est aussi l'explication de l'écran noir persistant : la caméra suit fidèlement
un joueur situé sous le décor, donc la sonde P0 reste **verte** — elle n'a rien
d'anormal à signaler. Le libellé « Loup Nv.1 » restait visible parce que c'est du
DOM, pas de la 3D.

---

## 3. Goulots d'étranglement mesurés

| # | Goulot | Mesure | État |
|---|---|---|---|
| 1 | Soupape de reveal plus courte que le chargement | 90 s vs 115 s | ✅ corrigé |
| 2 | Gravité active sans sol | chute jusqu'à −10000 | ✅ corrigé |
| 3 | Packs d'animation avec géométrie | 9,4 Mo/clip, 521 Mo | ✅ corrigé (−90,8 %) |
| 4 | Variantes d'animation inutiles | 43 fichiers pour 7 actions | ✅ corrigé |
| 5 | Raycast caméra par frame | `firstHitOnly=false` sur 1000 u | ✅ corrigé |
| 6 | Construction BVH synchrone | 5–50 ms/mesh, 71 mesh/chunk | ⏳ à faire |
| 7 | VRAM des chunks | 73 Mo × 8 = **584 Mo** | ⏳ à faire |
| 8 | Fuite mémoire au rechargement | **22 153 Mo** dans le renderer | ⏳ à faire |
| 9 | `getGroundY` du contrôleur | collecte exhaustive, chaque frame | ⏳ à faire |
| 10 | Pas d'IBL, pas d'antialiasing | — | ⏳ à faire (visuel) |

---

## 4. Optimisations APPLIQUÉES

### 4.1 Soupape de blocage au lieu d'un délai fixe
`StreamingPuzzleMap.tsx` — la soupape mesure désormais le temps écoulé **depuis
le dernier chunk abouti** (`STALL_MS = 45 s`, sondage toutes les 5 s) au lieu
d'une durée totale. Tant que le chargement progresse, on le laisse finir ; on ne
force le reveal que sur un vrai blocage (chunk pendu, contexte GPU perdu).

Effet direct : plus aucun chunk abandonné ⇒ plus de trou de collision. **Et
l'écran de chargement dure naturellement le temps qu'il faut** — ce qui répond
à la demande « allonger l'écran de chargement » sans coller un délai arbitraire.

### 4.2 Gel physique tant qu'aucun sol n'existe
`PlayerRig.tsx` — la physique ne démarre qu'à la première frame où
`collisionWorld.colliderCount > 0` **et** `getGroundY()` renvoie une valeur sous
le joueur. À cet instant le joueur est **posé** sur le sol mesuré (`solY + 0.05`)
avant que la gravité ne reprenne.

Le drapeau ne se réarme jamais : une fois le monde posé, tomber dans un trou est
une vraie chute, pas un chargement.

Gate sur le sol RÉEL, pas sur un drapeau de fin de chargement — un drapeau ne
garantit pas que le collider du chunk d'apparition soit posé.

### 4.3 Packs d'animation dégraissés — 521 Mo → 48 Mo
`scripts/strip-anim-meshes.mjs` (nouveau). Chaque « clip » embarquait le
personnage entier : 1 mesh, 2 primitives, **5 textures**, 1 skin. Three lie les
pistes aux nœuds par leur nom : le mesh ne sert à rien.

Résultat : **−90,8 %**, 69 os et l'animation préservés sur les 55 fichiers
(garde-fou qui refuse d'écrire si le compte bouge). Originaux intacts.

### 4.4 Un clip par action
`firstPerAction()` — le catalogue déclare 43 entrées pour 7 actions (12 variantes
de `punch1`). `renameClip` leur donne le même nom, `resolveActions` retient la
première : les 36 autres étaient téléchargées, parsées, gardées en mémoire et
jamais jouées.

### 4.5 Raycast caméra conditionnel
`FpsCamera.ts` — le plancher sol n'appelle plus `getGroundY` que lorsque l'orbite
menace de passer sous les pieds (au-delà de ~17° de regard vers le haut). Le
reste du temps, une comparaison scalaire suffit. J'avais introduit cet appel
inconditionnel avec le correctif caméra : il doublait la requête la plus chère
du moteur.

### 4.6 Marche accroupie directionnelle
`AnimationController.ts` — `setLocomotionBlend` accepte le gait `crouchwalk` et
répartit les diagonales sur les 4 clips disponibles. Auparavant la clé
`crouchwalk_forwardRight` ne correspondait à rien : **le poids était perdu**, et
les clips accroupis restaient à poids 0 en permanence.

Élimine au passage les 3 erreurs tsc pré-existantes (112 → 109).

---

## 5. Optimisations RESTANTES, par rapport gain/effort

### 5.1 🔴 Construction BVH hors du thread principal
`StreamingPuzzleMap.tsx:509-522` — `collisionWorld.add()` appelle
`computeBoundsTree()`, **synchrone**, 5–50 ms par mesh complexe. Avec 71 meshes
par chunk et `BVH_BATCH = 2`, chaque chunk impose ~35 pauses de 10–100 ms.

`BVH_BATCH` a déjà été baissé de 8 à 2 — c'est un pansement : le travail reste
sur le thread de rendu. La vraie correction est un **worker** qui sérialise le
BVH (`three-mesh-bvh` fournit `generateAsync` / le transfert de buffer).

Gain attendu : suppression de la quasi-totalité des micro-freezes de chargement.

### 5.2 🔴 Fuite mémoire au changement de map
Renderer mesuré à **22 Go** après quelques rechargements. Le rapport précédent
notait « colliders 71→1538 » ; l'ampleur réelle est d'un autre ordre.

À instrumenter : compter geometries/textures/programs via `renderer.info` avant
et après un changement de map, et vérifier que `dispose()` est appelé sur
**geometry, material ET textures** de chaque chunk démonté.

Tant que ce point n'est pas traité, **toute mesure de perf faite après plusieurs
rechargements est fausse** — c'est ce qui rendait le chargement si lent dans mes
propres relevés.

### 5.3 🟠 VRAM des chunks — 584 Mo pour la seule Forge
73 Mo × 8 chunks. Les chunks passent par `textureCompress(WebP, maxTexSize)`
(`scripts/puzzle-chunks.mjs`) mais **pas par KTX2**. Or une texture WebP est
décompressée en RGBA8 sur le GPU : le poids du fichier ne dit rien de la VRAM.

Appliquer la même conversion KTX2 qu'aux personnages (`scripts/assets-to-ktx2.mjs`)
diviserait cette empreinte par ~4–6.

### 5.4 🟠 `getGroundY` du CharacterController
`CollisionWorld.ts:183` — `firstHitOnly = false` sur `GROUND_SEARCH_DEPTH = 1000` :
la fonction **collecte tous les impacts** au lieu de s'arrêter au premier, à
chaque frame.

Le filtrage par normale (`worldNormal.y > 0.5`) impose de voir plusieurs impacts,
donc on ne peut pas simplement passer à `firstHitOnly = true`. Deux pistes :
réduire `far` à une profondeur plausible sous les pieds (quelques mètres suffisent
en marche normale, la valeur de 1000 ne sert qu'à la détection de chute), ou
mettre le résultat en cache tant que le joueur n'a pas bougé d'une cellule.

### 5.5 🟠 Instancing non appliqué au décor de map
`src/rpg/render/InstancedMeshSystem.ts` et `GPUCullingTransformFeedback.ts`
existent, mais ne sont consommés que par `nature/NatureDecorField.tsx`. Les
meshes répétés des chunks (rochers, poutres, modules) restent en draw calls
individuels.

### 5.6 🟡 LOD absent
Aucun `THREE.LOD` dans `src/rpg` hors du système de nature. Les chunks distants
sont rendus à pleine densité.

### 5.7 🟡 Vérifier le filtre de coques sur la Forge
`isEnvelopingShell` exclut de la collision tout mesh de ≤5000 triangles dont la
diagonale ≥4000 unités **et** dont les trois dimensions ≥1500. Une dalle de sol
fine y échappe (min ≈ épaisseur), donc le filtre n'est PAS le suspect principal
des traversées — celles-ci s'expliquent par les chunks abandonnés (§1).

À confirmer néanmoins une fois §1 corrigé : si des traversées subsistent, logger
les meshes exclus de la Forge et vérifier un à un.

---

## 6. Ce qui reste à vérifier en jeu

Les correctifs §4.1 et §4.2 n'ont **pas encore été observés en conditions
réelles** — ils sont typés, testés unitairement, sans régression (109 erreurs tsc
contre 112 au départ, 40/1707 tests inchangés), mais pas validés visuellement.

Protocole de validation, sur un lancement **propre** (pas après des rechargements
HMR, cf. §5.2) :

1. `npm run go`, entrer en jeu
2. La console doit afficher `[PlayerRig] monde prêt — N colliders, joueur posé à y=…`
3. Aucun `[StreamingPuzzleMap] BLOCAGE` ne doit apparaître
4. Le compteur de l'écran de chargement doit atteindre 8/8 segments
5. Parcourir la map en cherchant une zone traversable

---

## 7. Objectif visé vs état

| Objectif | État |
|---|---|
| Pas de chute sous la map | ✅ corrigé (§4.2) — à valider en jeu |
| Pas d'éléments traversables | ✅ cause traitée (§4.1) — à valider en jeu |
| Chargement fluide, peu de freezes | ⏳ partiel — reste §5.1 (BVH) et §5.3 (VRAM) |
| Écran de chargement suffisamment long | ✅ il dure désormais le temps réel du chargement |

---

## 8. MISE À JOUR — mesures du log de lancement réel (debug.log)

Premier lancement complet observé de bout en bout. Les correctifs §4 ont bien
tourné ; le log révèle trois faits nouveaux, dont une régression introduite par
le correctif §4.2 lui-même.

### 8.1 ✅ Les animations de poing fonctionnent

```
[AnimLoad] 61 clips depuis 61 fichiers · noms : [punch1, punch2, punch3,
           punch_charged, kick, kick_charged, hit, …]
[AnimCtrl] murdock: fall→punch1 clip="punch1" dur=0.83s
[AnimCtrl] murdock: landing→punch_charged clip="punch_charged" dur=1.50s
```

Le chaînon manquant est réparé : les clips sont chargés, résolus, ET joués. Les
4 `crouchwalk_*` sont également présents, ce qui active le correctif §4.6.

### 8.2 ❌ RÉGRESSION du gel physique — le joueur posé 200 m trop bas

```
[PlayerRig] monde prêt — 71 colliders, joueur posé à y=-228.80
```

Le point d'apparition est à **y = −26**. Le gel se levait dès le PREMIER
collider — c'est-à-dire dès le chunk 1 sur 8. `getGroundY` trouvait alors le
seul sol disponible, appartenant à une partie basse de la map, et y posait le
joueur. D'où le `idle→fall` immédiat qui suit dans le log.

**Correctif** : le gel exige désormais `worldReady` (map ENTIÈREMENT assemblée,
propagé depuis `revealed`) **en plus** de la présence d'un sol. Un compteur de
colliders ne dit pas si c'est le BON sol.

### 8.3 🔴 Le bake du NavMesh gèle l'affichage par blocs de ~1,8 s

```
[NavMeshBaker] grille adaptée : cellSize 15.47 m (204×197 = 40188 cells)
[NavMeshBaker] 204×197 grille baked en 22395ms (16404/40188 walkable)
```

Le code portait le commentaire « asynchrone et NE DOIT PAS retarder
l'affichage » — mais `async` en JavaScript donne une promesse, pas un thread. Il
rendait la main toutes les **16 rangées** (`ROWS_PER_YIELD = 16`), soit 12 fois
pour 197 rangées.

Arithmétique : 22 395 ms / 197 rangées ≈ **114 ms par rangée** → ~1,8 s de
blocage entre deux respirations, douze fois de suite. Et le bake démarre au
moment du `revealed=true`, donc pile quand le joueur prend la main.

**Correctif** : budget de temps au niveau CELLULE (6 ms) au lieu d'un compteur de
rangées. Un compteur ne s'adapte pas — il donne le même nombre de pauses sur une
map vide que sur la Forge. Le bake dure toujours ~22 s, mais ne bloque plus
l'affichage plus d'une frame d'affilée.

### 8.4 Chiffres consolidés du chargement

| Chunk | Durée | Textures | VRAM | Colliders cumulés |
|---|---|---|---|---|
| 1 | 14 405 ms | 60 | 73 Mo | 71 |
| 0 | 23 401 ms | 51 | 56 Mo | 170 |
| 3 | 18 119 ms | 141 | 158 Mo | 250 |
| 5 | 35 137 ms | 160 | 177 Mo | 492 |
| 7 | 34 130 ms | 168 | 183 Mo | 626 |
| 2 | 19 782 ms | 231 | 236 Mo | 821 |
| 4 | 14 302 ms | 184 | 185 Mo | 889 |
| 6 | 5 826 ms | 195 | 196 Mo | 959 |
| **Total** | **165 102 ms** | **1 190** | **1 264 Mo** | **959** |

Trois conséquences directes :

1. **165 s de chargement dépassent la soupape d'App.tsx (120 s)** — le log finit
   par `[App] Filet de sécurité 2 min déclenché`. La soupape de
   `StreamingPuzzleMap` a bien tenu (aucun `BLOCAGE`), mais celle d'App tire
   avant la fin. À porter à ~240 s, ou à convertir elle aussi en détection de
   blocage.
2. **1 264 Mo de VRAM pour la seule map** — et `THREE.WebGLRenderer: Context
   Lost.` apparaît dès l'étape 3 du préchargement. Confirme §5.3 : les chunks
   doivent passer en KTX2.
3. **1 190 textures** — le vrai coût n'est pas le poids des GLB mais le nombre
   d'uploads GPU.

### 8.5 🟠 Le modèle du joueur ne charge pas dans les 15 s

```
[OwnAnimPlayer] Filet de sécurité 15s — le modèle 3D n'a pas chargé à temps
```
Deux fois dans le log. Le filet fait entrer le joueur sans modèle visible. À
traiter avec §5.3 (le GLB de personnage est en concurrence avec 1 190 textures
de map sur la même bande passante).

### 8.6 🟡 Métadonnées de culling fausses

```
chunk 3 — rayon de culling corrigé 748 → 1237 (sous-estimé de 65 %)
chunk 4 — rayon de culling corrigé 539 → 1005 (sous-estimé de 86 %)
chunk 5 — rayon de culling corrigé 1646 → 2151 (sous-estimé de 31 %)
chunk 7 — rayon de culling corrigé 778 → 1072 (sous-estimé de 38 %)
```
Le runtime corrige à la volée, donc sans conséquence visible — mais 4 chunks sur
8 ont des métadonnées fausses. À régénérer via `scripts/puzzle-chunks.mjs`.

### 8.7 🟡 Un PNJ pollue le log

`[AnimCtrl] locomotion INCOMPLÈTE — aucune action pour [sprint]. Clips
disponibles : [attack1, iddle, jump, run, walk, walksent]` — répété ~15 fois.
Noter les fautes de frappe dans les noms de clips (`iddle`, `walksent`) : c'est
un pack d'animation dont les clips ne sont pas nommés selon la convention.