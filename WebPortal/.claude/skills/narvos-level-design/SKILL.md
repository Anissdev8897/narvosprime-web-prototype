---
name: narvos-level-design
description: Métriques de gameplay mesurées et principes de level design pour NARVOS PRIME. À invoquer AVANT de toucher à une map, un point d'apparition, un placement de PNJ, une limite de map, ou toute constante de mouvement/collision.
---

# narvos-level-design

Métriques réelles du projet + principes tirés de *« LD — In Pursuit of Better Levels »*
(Alex K / @TychoBolt), appliqués à NARVOS PRIME.

---

## 1. Pourquoi ce fichier existe

Le document de référence ouvre sur ce constat :

> « Nailing down all the relevant measurements and documenting them is a very
> important step. It allows you to test and figure out the proper values in a
> quick and dirty setup. »

NARVOS PRIME n'avait **aucune** de ces mesures écrites. Elles vivaient éparpillées
dans `playerConfig.ts`, `CollisionWorld.ts` et `CharacterController.ts`, souvent
sous forme de constantes anonymes. Trois bugs de la session du 2026-07-29 en
descendent directement, et tous les trois sont des métriques non documentées :

| Constante | Valeur | Ce qu'elle cassait |
|---|---|---|
| `raycaster.far = fromHeight + 60` | plancher monde **absolu** à y = −60 | Sous −60, plus AUCUNE détection de sol. La Forge a un offset de −401 → chute libre. Et sous `fromHeight` = −60, `far` devenait négatif : le raycast ne renvoyait plus jamais rien. |
| seuil de chute `y < -50`, renvoi `(0,5,0)` | constantes globales | Sol de la Forge à ≈ −27,8 → 22 unités de marge, et un point de renvoi dans le vide. Vécu comme « un mur invisible qui ramène au départ ». |
| `isEnvelopingShell` : diagonale seule | ≥ 2000 u | Quatre plaques de sol (larges et **plates**) prises pour des boîtes de ciel → collision retirée → on traverse la map. |

**La règle qui en sort : aucune valeur de gameplay spatiale ne doit être un
nombre nu dans le code.** Elle est soit dans la table ci-dessous, soit
justifiée par une mesure écrite à côté d'elle.

---

## 2. Le « Gym » — métriques mesurées

Le document recommande un niveau bac-à-sable où toutes les métriques sont posées
et testables. En attendant qu'il existe, voici la table de référence, **calculée
depuis le code**, pas estimée.

### Personnage

Échelle par défaut `CHARACTER_SCALE_DEFAULT = 0.7` (`characterScale.ts`),
réglable de 0,2 à 1,0. Les valeurs de taille sont des **getters dynamiques** —
elles suivent le slider admin sans reload.

| Métrique | Natif (×1.0) | À l'échelle 0.7 | Source |
|---|---|---|---|
| Taille debout | 1,80 m | **1,26 m** | `PLAYER_CONFIG.height` |
| Taille accroupi | 0,99 m | **0,69 m** | × `crouchHeightMult` 0,55 |
| Rayon de capsule | 0,35 m | **0,245 m** | `PLAYER_CONFIG.radius` |
| Hauteur des yeux | 1,65 m | **1,155 m** | `PLAYER_CONFIG.eyeHeight` |
| Marche franchissable | 0,40 m | **0,28 m** | `PLAYER_CONFIG.stepHeight` |

### Déplacement

| Métrique | Valeur | Note |
|---|---|---|
| Marche | **3,2 m/s** | par défaut, sans touche |
| Course (Maj) | **6,0 m/s** | |
| Sprint | 9,5 m/s | réservé aux événements (glissade, dash) |
| Accroupi | **1,44 m/s** | 3,2 × `crouchSpeedMult` 0,45 |
| Glissade | durée 0,8 s · déclenche > 4,0 m/s · sort < 1,0 m/s | |

Les vitesses ne sont **jamais** mises à l'échelle : un perso miniature marche
toujours à 3,2 m/s. Le gameplay est préservé, la silhouette non.

### Saut — dérivé, à ne pas régler à l'œil

`jumpVelocity` 6,2 m/s · `gravity` 22 m/s²

| Métrique | Valeur |
|---|---|
| Hauteur de saut | **0,87 m** |
| Temps en l'air | **0,56 s** |
| Portée depuis la marche | **1,80 m** |
| Portée depuis la course | **3,38 m** |
| Portée depuis le sprint | 5,35 m |
| Portée accroupi | 0,81 m |
| Vitesse de chute terminale | 60 m/s (`maxFall`) |

> Le document est explicite là-dessus : « If the player can jump a 3 meter
> distance, then placing a platform 3,15 meters away over a fatal pitfall
> probably isn't a good idea. In cases like these it's generally better to
> **exaggerate** the distances. »
>
> Concrètement pour NARVOS : un vide de **2 à 3,3 m** est le pire cas — franchissable
> en courant, pas en marchant. Soit on reste sous 1,7 m (toujours franchissable),
> soit on passe au-delà de 4 m (visiblement infranchissable).

### Terrain & collision

| Métrique | Valeur | Source |
|---|---|---|
| Pente max marchable | **60°** | `getGroundY` filtre `normale.y > 0.5` |
| Profondeur de recherche du sol | **1000 u** | `GROUND_SEARCH_DEPTH` — distance, PAS un plancher absolu |
| Tolérance d'accroche au sol | 0,08 m | `groundSnap`, non scalée |
| Seuil de chute | ≥ **200 u sous le point d'apparition** | plafond dur dans `fallThreshold()` |
| Marge auto de chute | 300 u sous le `keepIn` le plus bas | `MARGE_CHUTE` |

### Détection de coque enveloppante

Trois conditions, **toutes requises** (`envelopingShell.ts`) :

| Seuil | Valeur | Pourquoi |
|---|---|---|
| Diagonale min | 4000 u | coque orbitale mesurée : 7806 u |
| Épaisseur min (plus petit axe) | 1500 u | coque 2463 u · gros rocher 1010 u · **plaques de sol 41 à 168 u** |
| Triangles max | 5000 | coque orbitale : 1719 tris |

Une coque **enveloppe** → grande dans les trois axes. Un sol est large et **plat**.
C'est l'épaisseur qui les sépare, jamais la diagonale seule.

---

## 3. Avant de toucher à une map

Le document propose un ordre. Adapté au projet :

1. **Restrictions / Objectifs / Contexte** — ce qu'on doit faire, ce qu'on veut
   faire, ce qu'il faut considérer. Évite la page blanche et le retravail.
2. **Diagramme à bulles** — les zones et leurs connexions, avant toute géométrie.
3. **Blockout grossier** — « quick and dirty », à la bonne échelle. Pas joli, pas
   réutilisé.
4. **Vérifier l'échelle avec une référence humaine dans la scène.** Le document
   insiste : à l'œil nu, sans référence, une salle paraît juste. Avec un
   personnage dedans, on découvre qu'elle est deux fois trop grande.
5. **Playtest tôt et souvent.** « Playtests should drive the iteration, not the
   other way around. » Et surtout : **le retour négatif prime**. Un seul testeur
   qui signale un saut difficile compte plus que trois qui complimentent la
   composition.

### Chemin critique / chemin doré

- **Critique** = la route la plus rapide pour finir.
- **Doré** = la route que le concepteur préfère, celle qui offre la meilleure
  expérience.

Les prévoir tôt. Puis tester en ne suivant **ni l'un ni l'autre**.

---

## 4. Orientation — le vrai levier pour un monde ouvert

Une map de la taille de la Forge ou de l'Orbital se perd facilement. Le document
donne une échelle utile :

| Échelle | Exemple | Rôle |
|---|---|---|
| **Micro** | souche, squelette, épave | Casse les environnements qui se répètent (grottes, forêts, couloirs). Devient critique quand aucun macro n'est visible. |
| **Meso** | cabane, poste, atelier | Pont entre les deux. Unique dans sa zone, pas visible de loin. |
| **Macro** | tour immense, structure orbitale | Oriente sur toute la map. Sert aussi de but (« weenie »). |

Le test d'orientation du document, applicable tel quel :

> « Think of how you would explain to someone how to get somewhere:
> *Follow this road until you get to a fallen tree, then take a left turn…*
> Could you easily guide someone through your level in this way? »

Si la réponse est non sur la Forge, il manque des repères — pas des flèches d'UI.

**Attention au piège du landmark raté :** il ne doit pas pouvoir être confondu
avec un élément naturel de l'environnement. Un buisson n'est pas un repère. Un
squelette qui pointe une direction, oui. Et il faut les **varier** : toujours le
même cadavre au même type d'embranchement perd son effet et sort le joueur du jeu.

---

## 5. Lisibilité

Le principe central : **ce n'est pas une absence de couleur, c'est de l'harmonie.**

- Environnement **désaturé**, personnages et éléments importants **saturés**
  (Team Fortress 2), ou l'inverse en luminosité (Rainbow Six: Siege : personnages
  sombres sur environnement clair).
- **Gradient de complexité visuelle** (Unreal Tournament 4) : peu de détail là où
  le joueur marche — sols, murs à hauteur d'homme — et davantage dans les
  plafonds, piliers, zones non praticables.
- La végétation est la première source de bruit : variation de couleur **au sein
  d'un même groupe** et ombres portées créent du contraste là où il ne devrait
  pas y en avoir.

Pour NARVOS, avec l'auto-material triplanaire : les 7 couches de terrain sont
justement l'endroit où appliquer ça — désaturer les couches de sol pour que les
PNJ, le loot et les ennemis ressortent.

### Affordance

- **Positive** : a l'air utilisable, l'est.
- **Négative** : a l'air inutilisable, l'est.
- **Fausse** : a l'air utilisable et ne l'est pas → confusion, perte de confiance
  dans tout l'environnement.

Corollaire direct : ne pas mettre d'échelles si on ne peut pas grimper aux
échelles. Le projet a un `ClimbController` — vérifier que ce qui **ressemble** à
grimpable l'est, et l'inverse.

### Zone « nope »

Guider **hors** d'une zone plutôt que d'y mettre un mur : danger visible (feu,
pointes, vide), ennemis clairement supérieurs, ou blocage physique lisible
(escalier effondré, barricade). Et **varier la méthode** — si 90 % des escaliers
sont bloqués par des meubles, ça se voit.

C'est l'alternative de premier choix aux murs invisibles de `mapBoundsStore` :
un mur invisible est la solution quand rien d'autre ne marche, pas la première.

---

## 6. Ne pas surestimer son guidage

Le chapitre le plus utile du document, et le plus contre-intuitif :

- Les **leading lines** existent partout dans un environnement sans rien vouloir
  dire. Le joueur descend le couloir parce que c'est un couloir, pas à cause des
  lignes.
- **Biais du concepteur** : on cherche des repères qu'on a soi-même appris à
  poser. Le joueur ne connaît pas ces codes.
- **La lumière n'attire pas comme un papillon.** Ce qui marche, c'est le
  contraste — et ça peut se faire sans lumière. Si la lumière est parfois un
  guide et parfois de la décoration, elle cesse de guider.
- **Les buts attentionnels rendent aveugle** : un joueur devant une grille
  fermée cherche un interrupteur et ne voit pas la fenêtre ouverte à côté.

Conséquence pratique : tester avec quelqu'un qui ne partage pas ces
connaissances. Sinon on valide un guidage qui n'existe que dans sa propre tête.

---

## 7. Espaces de combat

À appliquer aux zones PvE de la Forge et aux hubs orbitaux.

**Ouvrir des styles de jeu**, pas une seule route : le rusher (charge, courte
portée), le sniper (lignes de vue longues), le ninja (passages détournés, flanc),
l'opportuniste (interactifs, explosifs, environnement).

- **Verticalité** : les espaces plats sont perçus comme ternes.
- **Fronts de combat définis** : où est chaque camp, où est le no man's land.
  Sans ça, c'est du chaos illisible.
- **Routes de flanc** : elles traversent le no man's land, portent la majorité du
  couvert, mais **pas de bonnes positions permanentes** — sinon elles cessent
  d'être des routes. Elles ne doivent pas être disponibles immédiatement.
- **Trois types de couvert** : bloque vue **et** dégâts (roche) · bloque la vue
  seule (buisson) · bloque les dégâts seuls (bouclier d'énergie).

### Apparition d'ennemis

Le document est direct : si des ennemis apparaissent hors champ pendant un
combat sans être annoncés, ça se ressent comme du surgissement arbitraire.
Les annoncer — vaisseau qui largue, mur qui explose, son directionnel.

Pertinent pour `factions-ai/` et `world-events/` : un event procédural qui fait
apparaître des ennemis derrière le joueur doit émettre un signal d'abord.

### Points de vue

Montrer l'espace de combat avant d'y entrer aide le joueur à s'orienter et à
planifier. Mais un point de vue **trop fort** — élevé, à couvert, vue sur tous
les ennemis — permet de vider la zone depuis là et annule tout le travail.
Contre-mesures : le rendre mauvais pour combattre (exposé, couvert fragile),
empêcher de tuer depuis là, ou faire arriver des renforts qui le rendent intenable.

---

## 8. Points d'apparition (multijoueur)

Directement applicable au MMO :

- **Au moins 3 sorties** d'une zone d'apparition, à des emplacements et des
  hauteurs différents. Les portes ne doivent pas laisser tirer à travers.
- **Les ennemis ne doivent pas pouvoir entrer** dans la zone d'apparition
  adverse. Barrière d'énergie si l'univers le permet, sinon dénivelé qu'on
  descend sans pouvoir remonter (c'est une « valve »).
- **Points d'apparition mobiles** pour garder le rythme : ils avancent avec la
  progression au lieu de forcer de longues courses après chaque mort.

### PPP — Potential Player Positions

Les positions où un défenseur a l'avantage : derrière un couvert, dans un angle,
en hauteur. **Trop de PPP dans un espace = le joueur qui entre doit scanner dans
toutes les directions et se sent traité injustement.**

Réduire leur nombre, ou les **regrouper** pour qu'ils tiennent dans un même champ
de vision. Diviser physiquement l'espace (mur, barrière) est aussi valable.

---

## 9. Flow

- **Momentum** : concevoir comme si le joueur était une voiture. Les angles à 90°
  forcent le ralentissement.
- **Ne pas encombrer l'avant** du joueur. Trois ou quatre sauts d'affilée pour
  franchir un obstacle, c'est un arrêt complet — remplacer par une rampe (arbre
  tombé, rocher, planche).
- **Aides de collision invisibles** : deviner l'intention du joueur et ajouter du
  collider invisible qui le « pousse » dans la direction voulue, plutôt que de le
  laisser s'accrocher à une chaise. `mapBoundsStore` en mode `block` sert
  exactement à ça.
- **Pas d'espace inutile ni de cul-de-sac** — soit on supprime, soit on donne une
  raison d'y aller (risque/récompense).
- **Boucles** : suppriment le backtracking forcé et donnent des options.

### Portes et valves

| Outil | Effet |
|---|---|
| **Hard gate** | Bloque jusqu'à accomplissement (clé, interrupteur). Force l'exploration. |
| **Soft gate** | Ralentit brièvement (pousser un arbre, ouvrir une vanne). |
| **Valve** | Se referme derrière le joueur (saut d'une corniche, éboulement). Pousse en avant **et permet de décharger la zone précédente**. |

La valve a un intérêt technique direct pour NARVOS : elle justifie
narrativement le déchargement d'une zone de chunks.

---

## 10. Checklist avant de valider une map

- [ ] Toutes les distances de saut sont **hors** de la fenêtre 1,8–3,4 m au-dessus d'un vide mortel
- [ ] Aucune pente praticable ne dépasse 60° (sinon `getGroundY` la rejette et le joueur tombe)
- [ ] Le point d'apparition a du sol dessous — vérifié par raycast, pas à l'œil
- [ ] Le seuil de chute est au moins 200 u sous le sol le plus bas de la zone jouable
- [ ] La map a au moins un repère macro visible et des repères micro aux embranchements
- [ ] On peut décrire un trajet en langage naturel (« jusqu'à l'arbre tombé, puis à gauche »)
- [ ] Les limites sont posées par zone « nope » lisible **avant** de recourir à un mur invisible
- [ ] Testée par quelqu'un qui n'a pas conçu la map
- [ ] Les retours négatifs ont été traités, pas écartés parce que minoritaires

---

## Métrique caméra TPS — mesurée le 31/07/2026

La caméra 3ᵉ personne orbite autour de la tête : `cam.y = pos.y + eyeHeight − sin(pitch)·d`.
Elle passe donc **sous les pieds du joueur** dès que :

```
pitch > asin(eyeHeight / tpsDistance)
```

| Grandeur | Valeur | Source |
|---|---|---|
| `eyeHeight` | **1.155 m** | `1.65 × characterScale(0.7)` — `playerConfig.ts` |
| `tpsDistance` | **4.0 m** | `createPlayerState()` |
| **Seuil de passage sous le sol** | **16,8°** | `asin(1.155 / 4)` |

**16,8° de regard vers le haut, c'est un geste ordinaire** — pas un cas limite.
Sans plancher, tout joueur y arrive en quelques secondes, et se retrouve avec un
écran noir (sous la roche, les faces arrière sont cullées : il n'y a rien à voir).
C'est ce qui a produit le P0 « TPS écran noir ».

Conséquences pour le level design :

- Toute zone jouable doit tolérer une caméra jusqu'à `tpsDistance` DERRIÈRE et
  au-dessus du joueur. Un couloir plus étroit que ~4 m force l'anti-clip en
  permanence : la vue devient subjective sans prévenir.
- Un plafond bas produit le même écran noir que le sol, par le haut : la caméra
  monte quand le joueur regarde vers le bas.
- Le plancher sol de `FpsCamera` est **indépendant** du toggle anti-clip mur
  (`cameraCollisionStore`, OFF par défaut). Ne pas le confondre : couper
  l'anti-clip est un choix de confort, laisser la caméra entrer dans le décor
  est une vue cassée.

Vérifié par `FpsCamera.tps.test.ts` (balayage −90°→+90°).

---

## Source

*Level Design — In Pursuit of Better Levels*, compilé par Alex K (@TychoBolt).
Copie locale : `WebPortal/tools/Copie de LD - In pursuit of better levels.pdf`
(1366 pages, essentiellement des planches ; le texte est extractible avec
`pdftotext -layout`).

Compagnons : `narvos-measure-first` (mesurer avant de conclure),
`narvos-iteration-guard` (vérifs post-modification).