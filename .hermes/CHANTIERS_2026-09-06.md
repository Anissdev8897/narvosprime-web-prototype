# Tous les chantiers NARVOS — inventaire et ordre

Établi le 2026-09-06, à la demande : *« liste tous les chantiers, définis leur
ordre de priorité, ne commence rien de nouveau »*.

Trois sources : ce qui était déjà ouvert, le brief gameplay du jour, et
`objetic_gameplay.txt`.

---

## A — En cours

| # | chantier | état |
|---|---|---|
| A1 | **Cook** | relancé après deux crashs. 2 h par passe. |

---

## B — Débloqué dès que le cook finit

| # | chantier | pourquoi il attend |
|---|---|---|
| B1 | **`Assets.toml` complet** | le pack actuel a **8 animations** au lieu de 3 216 |
| B2 | **Catalogue props NARVOS** | 82 décors aujourd'hui, ~570 attendus |
| B3 | **170 références mortes** | 166 émotes + peau + `SM_Patch_Sol` |
| B4 | **Test en jeu de `Map_Narvos`** | la carte est cuite et déclarée |
| B5 | **Valider combat / IA / gizmo** | écrits, jamais exécutés |
| B6 | **Import animaux + bâtiments** | 142 GLB + 183 + **670 FBX** prêts |
| B7 | **Locomotion (blend spaces)** | aucun BS dans le pack, mesuré |
| B8 | **Modulaire Defender** | zéro entrée Defender, mesuré |

---

## C — Dette technique existante

| # | chantier | note |
|---|---|---|
| C1 | **World Partition** | échec compris ; voie B recommandée |
| C2 | HLOD, Data Layers, PCG, AutoInstancedActor | derrière C1 |
| C3 | **Mobilier de la Forge sur le relief** | `Trace` est client-authority |
| C4 | Masquage de la peau (`OpacityMask`) | contredit la limite qui justifiait Mutable |
| C5 | `BP_Test` Mutable | rien n'est prouvé sans lui |
| C6 | 3 textures d'arbres, FoliageTypes | petit |
| C7 | 20 homonymes `WorldGridMaterial` | nom réservé par le moteur |
| C8 | Trancher `decor_glb` | doublon avec le niveau |
| C9 | **Perf 400 joueurs** | rien mesuré, jamais plus d'un joueur |
| C10 | ~65 Go d'assets | rapport écrit, doublons **non certifiés** |
| C11 | Audit création — 40 C / 21 R / 7 I | preuves fichier:ligne |

---

## D — Nouveaux chantiers du brief

| # | chantier |
|---|---|
| D1 | **Amélioration de la map** avec les assets existants (bâtiments, végétation, mobilier, interactifs, véhicules, structures) |
| D2 | **Système de craft** général et modulaire |
| D3 | **Récolte des ressources** dans le monde |
| D4 | **Refonte de l'inventaire** — qualité graphique et ergonomie |
| D5 | **Tri de `asset_game/a_trier`** |
| D6 | **Réemploi des systèmes existants** |
| D7 | **Cohérence de la chaîne** explore → récolte → craft → commerce |

---

## E — La couche RP (`objetic_gameplay.txt`)

15 catégories, ~350 cases. Résumé par famille :

| famille | contenu |
|---|---|
| E1 | Identité : métier, grades, guildes, réputation, permis, casier, propriété |
| E2 | Communication : chat local, radio, téléphone, canaux de faction |
| E3 | Économie : banque, ATM, virements, salaires, taxes, contrats, immobilier |
| E4 | Craft et récolte (= D2 + D3, en plus détaillé) |
| E5 | Véhicules RP : propriété, garage, carburant, dégâts, plaques |
| E6 | Construction joueur : fondations, murs, permissions, persistance |
| E7 | Monde vivant : PNJ civils, routines, dialogues, événements |
| E8 | Missions et contrats |
| E9 | Factions : hiérarchie, coffre, territoire, diplomatie |
| E10 | Territoires et propriétés |
| E11 | Survie : faim, oxygène, radiation, combinaison |
| E12 | Technologie : implants, drones, terminaux, piratage |
| E13 | Mort et blessures : inconscience, réanimation, hôpital |
| E14 | Administration : panel, logs, sanctions, modération |
| E15 | **Persistance serveur** |

---

## Ce que la mesure dit de l'état réel

Avant de proposer un ordre, quatre faits relevés dans le code aujourd'hui.

**1. La persistance existe déjà, à moitié.** Quatre tables SQL :
`comptes`, `personnages`, `commandes`, `raccourcis`. La table `personnages`
porte `nom, class_id, genre, lore_id, corps, niveau, tenue, garde_robe, morphs,
credits, couleurs`.

Donc : compte, personnage, apparence complète, touches réassignées **et
l'argent** survivent déjà à une déconnexion. E15 n'est pas un chantier vierge.

**2. ⚠ L'INVENTAIRE N'EST PAS SAUVEGARDÉ.** `Inventory.lua` fait 1 021 lignes et
ne touche **aucune base** — aucune colonne d'inventaire dans `personnages`,
aucun `SetPersistentData`. **Le sac est vidé à chaque déconnexion.**

C'est le fait qui réordonne tout : D2 (craft), D3 (récolte) et D4 (inventaire)
versent tous dans un contenant percé. Fabriquer un objet qui disparaît à la
déconnexion n'est pas un système de craft, c'est une démonstration.

**3. Trois systèmes écrits aujourd'hui n'ont jamais tourné.** Combat, IA, gizmo :
499 assertions vertes, mais tout repose sur des signatures **lues** dans
`nanos-world/api`, pas éprouvées. Tant qu'un seul n'a pas tourné, on ne sait pas
si la lecture était juste — et tout ce qu'on écrira ensuite fera les mêmes
hypothèses.

**4. Deux systèmes sont écrits mais sans matière.** Les monstres n'ont aucune
animation (leurs GLB en portent zéro) ; la locomotion n'a aucun blend space cuit.
Ce ne sont pas des bugs, ce sont des imports manquants.

---

## L'ordre proposé

### Phase 0 — Savoir si ça marche (jours)

1. **A1** finir le cook
2. **B1 → B4** pack complet, références mortes, **test en jeu**
3. **B5** valider combat / IA / gizmo dans le moteur

> Rien d'autre ne doit démarrer avant. Trois systèmes reposent sur des
> hypothèses d'API non éprouvées ; si l'une est fausse, elle l'est aussi dans
> tout ce qu'on écrira après.

### Phase 1 — Boucher le trou (avant tout contenu)

4. **Persistance de l'inventaire** — une table, un chargement, une sauvegarde
5. **B6** import animaux + bâtiments (le FBX en commandlet n'est pas mesuré)
6. **B7 / B8** locomotion et modulaire, si les assets arrivent

> L'inventaire d'abord. C'est trois heures de travail qui décident si le craft
> vaut quelque chose.

### Phase 2 — La chaîne de gameplay (D2, D3, D4, D7)

7. **Ressources dans le monde** — l'objet ramassable, le point de récolte
8. **Craft** — recettes en catalogue généré, stations, transformation
9. **Inventaire** — refonte visuelle, sur les 523 icônes déjà cataloguées
10. **D1** amélioration de la map avec nos assets

> Dans cet ordre : sans ressource dans le monde, une recette n'est qu'une entrée
> d'interface. C'est le point que le brief souligne lui-même.

### Phase 3 — Ce qui rend le monde habitable

11. Économie (E3) : banque, virements, prix — la colonne `credits` existe déjà
12. Véhicules persistants (E5)
13. Propriétés et territoires (E10)
14. Métiers et factions (E1, E9)

### Phase 4 — Monde vivant (E7, E8)

15. PNJ civils, routines, dialogues — l'IA existe, il lui manque les rôles
16. Missions et contrats
17. Événements dynamiques

### Phase 5 — Futuriste et RP profond (E11, E12, E13, E2)

18. Survie : oxygène, radiation, combinaison
19. Implants, drones, terminaux
20. Mort, blessures, médecine
21. Communication : radio, téléphone

### Phase 6 — Échelle (C9, E14)

22. Administration et modération
23. Tests 10 → 50 → 100 → 200 → 400 joueurs
24. C1 World Partition, C2 HLOD/PCG — l'optimisation quand il y a de quoi
    optimiser

### En parallèle, sans bloquer — pour Hermes

- **D5** tri de `asset_game/a_trier`
- **C10** les 65 Go
- **C11** correctifs de l'audit
- lot 2 jamais lancé : icônes dans l'UI, `void_saber`, rapport animations

---

## Deux désaccords avec la feuille de route du `.txt`

**« Persistance serveur » en phase 2 est trop tard et trop large.** Une moitié
est faite (compte, personnage, apparence, touches, crédits). L'autre — surtout
l'inventaire — doit passer **avant** le craft, pas après. C'est une table, pas
un chantier.

**World Partition en phase 1 est trop tôt.** C'est de l'optimisation de
streaming. Elle a déjà coûté un crash de 14 minutes, et l'assemblage en
sous-niveaux **fonctionne**. Elle vaut le coup quand la carte sera pleine — pas
quand elle est encore vide.

---

# Ajout du 2026-09-07 — les systemes de `src/rpg` jamais portes vers nanos

Releve exhaustif : 53 sous-systemes dans `WebPortal/src/rpg`. Apres retrait de
l'infrastructure React/Three.js (runtime, render, camera, wasm, threading,
memory, cache, loaders, materials, skeleton, ragdoll, math, benchmarks,
monitoring — sans equivalent possible dans nanos), voici le gameplay ECRIT en TS
et ABSENT du port Lua :

| lignes | sous-systeme | remarque |
|---|---|---|
| 2 175 | **audio** | et le pack ne declare que **7 sons** |
| 1 803 | **professions** | recolte + craft — LOT 4 en cours |
| 1 782 | **dialogue** | aucun `Dialogue.lua` |
| 1 171 | **quests** | aucun `Quetes.lua` |
| 819 | arenas | |
| 660 | chat | `Commandes.lua` couvre les commandes, pas le chat |
| 587 | archetypes | |
| 521 | pets | |
| 497 | talents | |
| 426 | world | |
| 416 | mapgen | |
| 382 | persistence | partiellement fait par `Roster.lua` |
| 302 | settings | |
| 301 | hud | |
| 213 | skills | |
| 200 | reputation | |

⚠ **`forge` (5 687 lignes) et `ui` (4 109) sont a trancher** : mi-gameplay,
mi-rendu React. A regarder avant de decider s'ils se portent.

## Le corollaire qui compte plus que la liste

Sur les 20 modules de `Shared/Logic/`, **3 declarent le fichier TS dont ils
viennent**. Les 17 autres — `Combat.lua` et `Ia.lua` compris — ont un equivalent
dans `src/rpg` et ne le nomment nulle part.

**On ne peut donc pas savoir s'ils ont ete portes ou reinventes**, et une
divergence y serait invisible. Chantier a part entiere : passer les 17 en revue,
et imposer l'en-tete de provenance.

## Et le trou d'assets que la regle fait apparaitre

`harvestModelCatalog.ts` : le metier **MINEUR** tourne sur un rocher procedural
parce que les « 24 Free Ores and Minerals » sont des PNG et non des meshes.
Or `CraftingSystem/Meshes/` porte `SM_OreMetal`, `SM_Metal`, `SM_Cooper`, et le
depot compte 50 GLB de rochers. Le bucheron a ses 8 arbres cables ; le mineur
n'a rien. **A combler.**

---

# Ajout du 2026-09-07 (apres-midi) — ce que la verification du lot 4 a decouvert

## 1. DECISION DE JEU : quelle est la liste d'objets de NARVOS ?

Le TypeScript porte **deux univers d'objets qui ne se croisent pas** :

```
src/rpg/items/itemCatalog.ts                26 objets
src/rpg/professions/professionCatalog.ts    42 ressources
intersection                                 0
```

Zero identifiant commun. Deux economies cote a cote. **Ce n'est pas un probleme
de portage, c'est une decision jamais prise** : tant qu'elle ne l'est pas, tout
craft porte versera dans un camp au hasard.

Troisieme defaut de cette famille trouve le meme jour, apres :
- deux listes de recettes rivales (`CRAFT_RECIPES` par station vs `RECIPES` par profession) ;
- deux multiplicateurs de critique (`combat/rollDamage.ts` 1,75 vs `spells/SpellDef.ts` 1,5).

## 2. Importer les 16 meshes de matieres dans l'ADK

`public/models/systemes/RPGEngineUltimateMultip/RPG_Engine/CraftingSystem/Meshes/`
porte 16 GLB (`SM_OreMetal`, `SM_Metal`, `SM_Glass`, `SM_Transistor`,
`SM_Microchip`, `SM_CompLens`…). **Zero sur seize est dans le pack cuit** —
verifie contre `Assets.toml` le 2026-09-07.

Tant qu'ils n'y sont pas, aucun gisement nanos ne peut porter de `mesh` : ce
serait seize references mortes. Chaine : `adk-import-narvos.py` puis cook.

## 3. Cote React — le mineur, faisable TOUT DE SUITE

`src/rpg/professions/harvestModelCatalog.ts` documente le trou :

> « les 24 Free Ores and Minerals sont des PNG (icones 2D), pas des meshes — le
> metier MINEUR conserve donc son rocher procedural »

Les GLB sont la, utilisables par R3F sans aucun cook. Le bucheron a ses 8 arbres
cables ; faire pareil pour le mineur avec `SM_OreMetal.glb`. **Ne depend de rien.**

## 4. Le contrat `station` — le seul reliquat du lot 4

`Craft.PeutFabriquer(..., station, ...)` prend une chaine. Le harnais utilise
`"forge"`, `"atelier"`, `"alchimie"`. Ce que le serveur ecrira reellement (id
d'acteur ? categorie ? interactif de map ?) **n'est pas fige**. A trancher cote
`Server/` avant que l'UI ne branche le craft.

---

# Decision du 2026-09-07 — achat de deux packs d'animations Fab

Retenus **tous les deux**, sur decision du 07/09. Total ~41 a 52 EUR.

| pack | editeur | prix | note | moteur |
|---|---|---|---|---|
| **Crafting Animations** | Excalibur Studios | 15,48–25,81 € | 5,0/5 | UE 4.20–4.27 et 5.0–5.7 |
| **Crafting Anims** | Explosive LLC | 25,81 € | 3,3/5 | UE 4.26–4.27 et 5.0–5.7 |

https://www.fab.com/listings/302ff70e-e6ca-446e-be21-7f54b70726e3
https://www.fab.com/listings/c5ba4371-ead2-4abe-a03b-417e1d8ab458

## Pourquoi ces deux-la et pas les autres

**Les deux sont sur le rig UE4**, donc directement sur `SKEL_Mannequin` (68 os),
le squelette qu'impose nanos. Les paquets mocap concurrents (MC Blacksmith,
MC Fix & Build) sont sur **Manny UE5, 89 os** : ils exigeraient un retargeting,
et notre sortie de retargeting compte deja 1 418 animations au squelette rompu.

Ils ne font pas doublon :

- **Crafting Animations** est le SEUL a couvrir l'**alchimie** (potion, mortier
  et pilon) ; il apporte aussi abattage d'arbre, fendage de bois, minage, forge,
  cuisine, poterie, orpaillage.
- **Crafting Anims** apporte 130 animations de manutention que l'autre n'a pas :
  sciage, creusage, portage, escalade, poussee, traction, peche.

## Ce qu'aucun des deux ne couvre

**La couture.** Aucun pack d'animation de couture ou de tailleur trouve sur Fab
le 2026-09-07. Le metier restera sans animation propre, ou reutilisera une
posture assise (72 `sit_*` disponibles dans le pack cuit).

## ⚠ A verifier a la reception, avant d'importer

`ANIM_IP_*` de `Narvos/BlacksmithAnimations` (20 animations : `hit_loop`,
`polish_loop`, `inspect`, `get_tools`, `discuss`, `customer_idle`) correspond
tres probablement au pack Fab « 37 Blacksmith NPC Mocap Animations ». **On
possede donc deja la forge.** Ne pas reimporter par-dessus : le lot 5 confie a
Hermes doit trancher avant tout import.

# Candidats RESSOURCES — PAS d'achat avant l'inventaire

| pack | prix | forme | reserve |
|---|---|---|---|
| Resource Mining Mesh Pack (BlueWhirl) | 25,81 € | meshes bruts + raffines | ton « Fantasy/Realistic » : or, charbon, argent. Pas NARVOS |
| Shatter Stone (4 packs) | ? | meshes destructibles + Blueprints Chaos + icones UI | ⚠ repose sur Chaos + Blueprints : les MESHES passeraient dans nanos, le SYSTEME n'est pas prouve |
| Stylized Crystals, Rocks and Gems | ? | 50+ sculptes main | stylise |
| Sci Fi Ore Material Pack | ? | **materiaux seuls, aucun mesh** | ne repond pas au besoin |

**Rien n'est achete cote ressources.** On possede deja ~50 GLB de rochers,
16 meshes de matieres et 432 icones. Acheter avant l'inventaire du lot 5 serait
exactement la faute commise trois fois le 2026-09-07 : construire a cote de ce
qu'on a deja.

---

# REVISION du 2026-09-07 — l'achat d'animations est ANNULE

La decision d'acheter « Crafting Animations » (Excalibur) est **annulee** :
**on possede deja ce pack**, dans
`public/asset_game/a_trier/animation_craf/Crafting_Animations/`.

Verifie fichier par fichier le 2026-09-07 :

```
Mining_START  Mining_IDLE  Mining_END                          MINAGE
Potion_START/IDLE/AddIngredient/Stir/END                       ALCHIMIE
MP_START/IDLE/AddIngredient/CrushIngredients/DumpOut_01/02/END  (mortier+pilon)
Cauldron_START/IDLE/AddIngredient_01/02/END                    (chaudron)
BlackSmith_GrindStone_*  Blacksmith_Forge_*  Blacksmith_Hammer_*  FORGE
Cooking_Stove_*  FryingPan_*                                   CUISINE
Table_START  Table_IDLE  Table_END                             ETABLI
UE4_Mannequin_Skeleton                                         rig UE4 confirme
```

⚠ Notre copie **n'a PAS** l'abattage d'arbre ni le fendage de bois que la fiche
Fab annonce. Elle est anterieure a cette mise a jour.

## Ce qui manque VRAIMENT en animations, apres verification

| metier | etat |
|---|---|
| forge, minage, alchimie, cuisine, etabli, recolte | **possedes** |
| **bois** (abattage, fendage) | absent du depot ET de notre copie Excalibur |
| **couture** | absent partout, aucun pack trouve sur Fab |

## Le SEUL achat justifie : des meshes de ressources

Mesure du 2026-09-07 — les six ressources centrales de NARVOS n'ont **qu'un
emoji** et **aucun mesh** :

| ressource | icone | mesh |
|---|---|---|
| powernax | ⚡ | AUCUN |
| noyau_plasma | 🔥 | AUCUN |
| cristal_energie | 💠 | AUCUN |
| adn_alien | 🧬 | AUCUN |
| metal_rare | ⚙️ | AUCUN |
| fragment_vie | 💚 | AUCUN |

Et le metier MINEUR tourne sur un rocher procedural. Les seuls meshes sci-fi du
depot sont `SM_Microchip`, `SM_Transistor`, `SM_CompLens` — trois composants
electroniques, aucun minerai.

**C'est la, et nulle part ailleurs, qu'un achat se justifie.**

---

# 2026-09-07, fin de journee — PLUS AUCUN ACHAT D'ANIMATION N'EST JUSTIFIE

`MC_Village_Life_Animation_Pack` est sur le disque, dans
`public/asset_game/a_trier/asset_trier/animation_craf/`. **314 animations `am_*`.**
C'est le pack que je recommandais d'acheter 82,64 EUR dix minutes plus tot.

Les deux derniers trous sont combles :

| trou | ce qui le comble | compte |
|---|---|---|
| **couture** | `am_SitChairBEmbroid_*` (broderie assise, avec dialogue et transition) | **11** |
| **bois** | `am_WoodChopAxe_*` + props `SM_Prop_Axe2`, `SK_Logs`, `SM_LogBundle` | complet |

Le pack apporte aussi : faux, rateau, marmite, balai, seau, portage (5 facons),
`BusyTable`, `BusyLow`, priere, nage.

⚠ **Squelette `SKM_MCUE5v2`** — Mannequin UE5 v2. **Retargeting necessaire** vers
nos 68 os. C'est la seule reserve, et elle est serieuse : notre derniere passe de
retargeting a produit 1 418 animations au squelette rompu.

## Le compte de la journee

**Sept fois** le 2026-09-07, on a failli payer ou reecrire ce qu'on possede deja :
craft TS, recolte TS, Crafting_Animations, 37 Blacksmith, Survival Kit,
MC Village Life — et la broderie, ratee par mon propre grep (`embroider` alors
que l'asset s'appelle `Embroid`).

**La regle [[feedback-fusionner-asset-et-systeme]] n'est pas encore un reflexe.**

# MEGASTRUCTURE — l'hypothese de la taille etait juste

Extrait : **82 uasset**, 2 maps de **0,1 Mo** (`L_assets`) et **0,8 Mo**
(`L_Showcase_level`). Ce n'est PAS un monde construit — c'est un **kit modulaire**
et sa salle de demonstration, exactement ce que les 80 Mo compresses laissaient
prevoir.

**Consequence : la capitale ZAYAN est a CONSTRUIRE** a partir de ses pieces. Ce
n'est pas une map a importer.

# Trois paquets neufs, jamais regardes

| paquet | uasset | remarque |
|---|---|---|
| **Hyper Inventory, Crafting, Hotbar, Lootchest & Vendor System V2** | **5 478** | le plus gros systeme d'inventaire du depot |
| **Soulslike Framework - Complete Soulslike Kit** | 2 120 | jamais cite, jamais regarde |
| Farming And Mining Pack | 166 | anims de ferme et de mine |

**Cela porte a CINQ les systemes d'inventaire du depot** (Hyper V2 5478,
Inventory_System_Pro 2220, Hyper V3 1043, Inventory_and_Stat 578,
Survival Crafting 364). La decision « choisir UN systeme » devient urgente.

# Vehicules — rien d'exploitable

`20x Vehicles 3D Models Pack 2` : **11 .rar + 9 .zip + 20 .jpg**, aucun modele
extrait. Rien a evaluer tant que les archives ne sont pas ouvertes.

---

# 2026-09-07 soir — CE QUI RESTE, ET QUI LE FAIT

Critere du partage : **Hermes n'a pas Unreal.** Tout ce qui exige l'editeur, un
cook ou un import reste ici. Le reste part au lot 6.

## MOI — exige Unreal, un cook, ou le moteur

### En cours
1. **Promotion** de `Sewer` (503), `MetaCustom` (560), `FluidFlux` (856) sous
   `/Game/Narvos/` — sans ca, presents dans l'editeur et JAMAIS cuits
2. **Cook** apres promotion

### Bloque, cause connue
3. **`Spaceship Pack 1`** — `ABSENT /Game/Spaceship Pack 1 (pack non stage ?)`.
   L'espace dans le nom. Renommer casserait les references internes ; a traiter
   par `rename_asset` un par un
4. **FluidFlux** — test technique (module C++ present ?) faisable en commandlet ;
   **le rendu se juge a l'oeil, dans l'editeur**. Seul point qui demande une
   fenetre ouverte

### Placement dans les maps
5. **Vehicules sur les routes** des maps humaines — 14 FBX a importer d'abord.
   ⚠ marques reelles (BMW, Ferrari, Lamborghini) : exposition juridique signalee
6. **Vaisseaux dans l'espace** — depend du point 3
7. **Capitale ZAYAN** a CONSTRUIRE depuis le kit MEGASTRUCTURE (82 assets promus).
   Ce n'est pas une map a importer, c'est un assemblage
8. **`Spring Landscape`** en sous-niveau — candidat planete

### Animations
9. **Retarget `MC_Village_Life`** — 314 anims sur `SKM_MCUE5v2` (Manny UE5) vers
   nos 68 os. Contient la broderie (11) et l'abattage. ⚠ notre derniere passe de
   retarget a produit 1 418 animations au squelette rompu
10. **Les 1 925 animations au squelette rompu** — reparer ou ecarter

### Moteur, jamais fait
11. **Lancer le serveur sur `Map_Narvos`** — pas une seule fois
12. **Valider en jeu** combat, IA, peuplement, gizmo, inventaire persiste —
    5 systemes ecrits, 0 execute dans le moteur
13. World Partition voie B, puis HLOD, Data Layers, PCG
14. Mobilier de la Forge sur le relief, masquage de la peau, `BP_Test` Mutable

## HERMES — lot 6, aucune tache n'exige Unreal

15. **Corriger le portage du craft** — 9 recettes TS contre ses 7 inventees
16. **Trancher les deux univers d'objets** — 26 contre 42, intersection zero
17. **Comparer les SIX systemes d'inventaire** et en designer un
18. **Auditer les 15 modules Lua sans source declaree** — porte ou reinvente

## Decisions qui n'appartiennent qu'a toi

19. Les vehicules sous marque : les garder ou non
20. Les ~65 Go de doublons, non certifies
21. Acheter des meshes de minerais sci-fi — le SEUL achat encore justifie