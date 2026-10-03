# Audit de refonte — NARVOS PRIME (nanos world) — 03/10/2026

Audit en lecture seule demandé par Hanibes avant toute refonte. Règle du brief :
CONSERVER → CORRIGER → AMÉLIORER → REMPLACER seulement si nécessaire.

Sources : le code remonté sur `E:\narvosprime-web-prototype` (42 995 lignes de Lua
écrites à la main, catalogues exclus), les docs de `.hermes\`, le lore Canva
(`LORE_NARVOS_PRIME.md`, lu en entier le 03/10). Ce qui n'a pas pu être vérifié est
marqué **NON VÉRIFIÉ**. Rien n'a été lancé en jeu : le pack cuit est perdu.

Chemins abrégés : `S/` = `narvos-map-proto/Server`, `C/` = `narvos-map-proto/Client`,
`L/` = `narvos/Shared/Logic`, `Cat/` = `narvos/Shared/Catalogs`.

## 0. Ce qui bloque tout le reste

| blocage | fait mesuré | conséquence |
|---|---|---|
| Pack cuit perdu (88,7 Go) | `Assets.toml` remonté = 3 Mo, surtout des trous ; section animations : 44 lignes vivantes, 1 848 commentées ou trouées | aucun asset `narvos::` n'est garanti en jeu ; 9 harnais rouges |
| **`Map_Narvos.umap` et `Map_Alien.umap` absents de l'ADK récupéré** | `adk/Content/Narvos/Maps` ne contient que Forge, Megastructure, Orbital, Tower (vérifié le 03/10) | un recook ne rend PAS le monde persistant ni Azur : il faudrait les rebâtir dans l'éditeur, ou les retrouver par le balayage DMDE de D: |
| Éditeur Unreal non lancé | `unreal-mcp` refuse la connexion | pas de blend space, pas de niveau, pas de NavMesh |
| Un seul exemplaire, pas de git | `E:` USB, déjà formaté une fois | toute refonte se fait sans filet |

Tant que ces quatre points tiennent, seul le travail **Lua + données + harnais** est
possible, et il ne peut pas être vu en jeu.

## 1. Ce qui marche et qu'on garde

- **Séparation décision / exécution** : `L/` est du Lua pur testé par harnais (107
  harnais, 90 verts, 11 750 assertions), `S/` touche le moteur. À conserver partout.
- **Comptes, roster, inventaire** : vus en jeu (`AUDIT_SYSTEMES_2026-09-11.md`).
- **Monde** : une carte persistante, 7 mondes, 14 liaisons, `MondePraticable`,
  pose générique des portails (`S/Index.lua:4111-4121`).
- **IA** : `L/Ia.lua` (états repos/patrouille/poursuite/attaque/repli, phases
  décalées, pas d'allocation par décision), `S/Peuplement.lua` (deux rayons, plafond
  120, réapparition 45 s).
- **Sorts** : 12 sorts, autorité serveur sur classe, mana, cooldown ; geste par prise
  d'arme ; origine de bouche bornée.
- **Traversée** (escalade/franchissement v2), esquive, ciel UDS par monde, mode
  édition F3 + gizmo, Zaaps, réapparition.

## 2. Sorts et capacités

**État.** `Cat/Spells.lua` (généré depuis `spellCatalog.ts`) : 12 sorts, 3 par classe,
champs `damage, heal, manaCost, cooldown, speed, range, aoeRadius, archetype`. Animation,
VFX et rythme vivent hors données, dans des tables Lua écrites à la main
(`L/Sorts.lua:244-451`). L'exécution est un `if/elseif` sur l'archétype
(`S/Sorts.lua:442-504`).

| étage du pipeline voulu | aujourd'hui |
|---|---|
| Activation, validation, coût, cooldown | présents, côté serveur |
| Animation | présente (geste UpperBody, libération plafonnée à 900 ms) |
| VFX | présent (lanceur, aura, zone, impact, trajet) |
| SFX | **absent** : aucun son de sort |
| Collision | **absente** : cible par distance ou cône 2D, pas de trace |
| Dégâts | présents mais plats : pas de critique, pas de défense, pas d'élément |
| Statuts, boucliers, buffs | **absents** : les descriptions promettent « stun 2 s », « absorbe 200 », « +40 % 8 s », rien ne l'applique |
| Projectile | simulé : une particule glisse vers une position figée, `homing` jamais lu |
| Zone persistante | absente |
| Feedback de touche | absent pour les sorts (la mêlée a `Narvos:Coup`) |

**Défauts.** L'AOE touche tout le monde (un soin soigne l'ennemi) ; pas de filtre
faction ni véhicule ; `Elements` (`strongVs`, `weakVs`, `statusEffect`) n'est lu que
pour l'affichage ; deux modèles de dégâts (sorts plats, mêlée via `Combat.Degats`) ;
trois implémentations du cooldown ; `Archetypes` (10) et `Competences` (40 compétences
théoriques) jamais empruntés par le lancement ; esquive et roulade hors pipeline ;
**aucun harnais ne charge `S/Sorts.lua`**.

**Structure cible, sans réécriture.**
1. `HANDLERS[archetype](ctx)` à la place du `if/elseif`.
2. Champs optionnels au catalogue (`effects`, `status`, `shield`, `sfx`, `gesture`,
   `releaseMs`), lus par `L/Sorts.Plan`, repli sur les tables actuelles.
3. Module pur `L/Statuts.lua` (appliquer, durer, absorber) + harnais.
4. `Appliquer` passe par `Combat.Degats` + triangle des éléments (canon du lore).
5. `Cibles(ctx, filtre)` partagé (faction, dimension, véhicule) pour sorts et frappes.
6. Esquive branchée comme capacité `dash` ; énergie commune.
7. Harnais serveur pour `S/Sorts.lua` AVANT d'y toucher (il vient des historiques).

## 3. Locomotion et animations

**Constat principal.** `Character.lua:253` pose `narvos::BS_Narvos_Locomotion`, blend
space fabriqué le 23/09 et cuit — absent du pack remonté. Il est 1D (vitesse seule) :
le pas de côté et la marche arrière joueraient des boucles avant. Ce qui se passe sans
l'asset est NON VÉRIFIÉ. Trois docs disent encore `LOCOMOTION = nil` (périmés).

**Limite du moteur, certaine.** Le `Character` joueur de nanos n'accepte PAS d'AnimBP
personnalisé (seul `CharacterSimple` a `SetAnimationBlueprint`). Motion matching,
warping, aim offset sur mesure, couches d'animation au-delà des deux slots : hors de
portée depuis Lua. La locomotion « AAA » du brief se réduit donc à : blend spaces 2D
(debout, accroupi), transitions, réglages d'accélération et de freinage, montages bien
synchronisés. C'est l'alternative compatible avec le projet.

**Disponible et inutilisé.** 3 749 animations au catalogue, dont 884 `M_Neutral_*`
(départs 120, arrêts 66, pivots 60, virages 72), `AS_Dodge`/`AM_Dodge` à root motion,
variantes de saut et d'atterrissage, équipement d'arme, poses d'aim offset. Zéro
animation de lancement de sort (pack MagicCombatSystem absent).

**Défauts.** Esquive : pas d'invulnérabilité, pas de verrou d'entrée, `DUREE_MS = 250`
jamais lu pour des clips de 0,5 s. Roulade : passive seulement, 3,3 s sans verrou.
Traversée : déplacement 0,8–2,2 s pour des clips de 1,7–5,0 s à root motion
(désynchronisé, double déplacement NON VÉRIFIÉ). Aucun arbitrage entre slots. PNJ
`CharacterSimple` : ABP vide, boucle unique, certains choix faux (`Dead_17`,
`Running` en repos).

| faisable en Lua maintenant | bloqué par éditeur + cook |
|---|---|
| `SetAccelerationSettings` / `SetBrakingSettings` (inertie), `SetJumpZVelocity` | blend space 2D directionnel, accroupi |
| repli propre si le blend space manque | départs, arrêts, pivots dans le blend |
| verrou d'entrée, invulnérabilité, énergie pour esquive et roulade | set de locomotion arme en main, aim offset |
| durées alignées sur les clips, arbitre de slots pur + harnais | roulade active, montages de sort |
| atterrissages par allure, `AnimationEndNotify` | ABP des monstres |

## 4. Monde

**Modèle actuel** (`Cat/Mondes.lua`, écrit à la main) : `Map_Narvos` persistant, mondes
séparés par la distance, monde d'un joueur déduit de sa position (sphères de 6 km).

| id | nom | sous-niveau | note |
|---|---|---|---|
| forge | La Forge | Map_Forge | `ouvert=false` |
| tower | La Tour | Map_Tower | |
| alien | Azur | Map_Alien | **umap absent de l'ADK** |
| orbital | Hub Orbital | Map_Orbital | vol activé |
| capitale | Akarlys | aucun (13 490 acteurs dans Map_Narvos) | **umap absent de l'ADK** |
| foret | Sylve de Verdant | ForestKitONE | |
| megastructure | Mégastructure | Map_Megastructure | hors `DECALAGES` |

**Défauts.**
- Portails de montée Tour et Azur restés aux anciennes coordonnées
  (`Mondes.lua:512,520` : z = 345 et 1 586 ; arrivées remesurées à z ≈ 151 935 et
  153 506, `:218,239`). Vérifié dans le fichier ; effet en jeu NON VÉRIFIÉ.
- Aucun streaming : tous les sous-niveaux chargés en permanence, zéro appel `Level.*`.
- Téléport entre mondes et réapparition n'envoient pas `Narvos:Voyage` : ciel et HUD
  restent ceux du monde quitté.
- `Teleports.COORD_MAX` = 10 000 000 : tout point posé sur la Mégastructure
  (Y = 10 385 420) serait refusé (déduit, non testé).
- `/exporter decor` écrit `DecorPose.lua`, jamais rechargé.
- Identifiants de mondes en dur : `Mondes.lua:699,704`, `Depart.lua:49,105`,
  `S/Index.lua:57,87-91,3083,4150-4153`, `S/Reapparition.lua:62`, `Cat/NiveauxPnj.lua`,
  `Cat/Zones.lua`.
- Chargés, jamais utilisés : `Arenes`, `WorldSim`, `GenerateurCartes`, `Map_Orbital.lua`.
- Vaisseaux : 5 Blueprints au catalogue, tous `disponible=false` ; `/vaisseau` ne fait
  que basculer le mode vol. Pas de séquence d'entrée atmosphérique.

**Structure cible** (données pures, les lecteurs actuels continuent de marcher) :

```
GALAXIES → SYSTEMES (position du hub) → PLANETES (corps, rayon, identité, lore)
         → REGIONS → MONDES (la feuille actuelle = Level / Donjon)
```

1. Chaque entrée de `MONDES` reçoit `planete`, `region`, `type`
   (`hub | surface | donjon | interieur | station`), `centre`, `decalage`, `rayon` ;
   `CENTRES` et `DECALAGES` sont DÉRIVÉS de ces champs.
2. Les identifiants en dur deviennent des propriétés : `type == "hub"`,
   `defaut_depart`, `monde.peuplement`, `monde.niveaux`.
3. Une seule porte d'arrivée : téléport et réapparition passent par `Envoyer`.
4. Hub : liste de planètes en WebUI construite depuis `PLANETES`.
5. Entrée atmosphérique côté client dans le gestionnaire `Narvos:Voyage` : fondu,
   transition du ciel Espace → nuages, puis `Level.LoadStreamLevel` à la demande.
   Continuité ressentie, pas de traversée physique continue (limite assumée).
6. Garde `listes-recopiees-check` étendu aux nouvelles tables.

## 5. IA, PNJ, factions

- Toute la chaîne (IA, niveaux PNJ, mêlée par famille d'arme, butin, `/revive`, repli)
  est **écrite et jamais vue en jeu**.
- **Aucun NavMesh** sur aucune map : poursuite, repli et familiers reposent sur
  `MoveTo` (effet en jeu NON VÉRIFIÉ). Éditeur requis.
- La patrouille est du code mort : `Prendre` ne passe jamais de `route`.
- Détection par rayon 3D seul : pas de ligne de vue, pas de couverture, pas de défense
  d'allié, pas de combat PNJ contre PNJ.
- **Factions inertes** : trois factions en dur, aucune matrice d'hostilité (l'hostilité
  vient du `role`), filtre de faction jamais satisfait (`L/Ia.lua:245`), réputation en
  mémoire, jamais écrite ni sauvegardée. Le lore, lui, pose une matrice précise
  (Akar'lys contre les deux, Mezalayis–Zayan neutres, bascule possible) : à porter en
  données, extensible à N factions.
- Quêtes « tuer N » sourdes aux `CharacterSimple` (`S/Index.lua:1865`).
- Deux systèmes de butin, deux vocabulaires de rôle (`enemy` / `ennemi`), trois
  chemins de mêlée.

## 6. Santé du code

- Fichiers-dieux : `S/Index.lua` 4 268 lignes (31 gestionnaires distants, 27 commandes,
  marchands, quêtes, dialogues, radar, coffres…), `C/Index.lua` 3 103.
- 276 `pcall` côté serveur, la plupart avalent l'erreur : un PNJ dont `Prendre` échoue
  apparaît et reste immobile, sans trace.
- Huit minuteries serveur ne servent qu'à compter des millisecondes ; `Vivant` / `EnJeu`
  redéclarés dans ~8 fichiers ; trois abonnés à `Death`.
- Ordre de chargement fixé à la main.

## 7. Performance et réplication

Rien n'a jamais été mesuré (cible écrite : 400 joueurs, 33 ms par tick). Risques lus
dans le code, à mesurer avant de corriger :

1. Radar : `GetAll()` sur toutes les entités, par joueur, chaque seconde.
2. Sorts : message fiable de la barre entière à chaque joueur toutes les 500 ms, même
   sans changement (800 messages/s à 400 joueurs).
3. `Spawner` sans plafond global (25 × joueurs) ; `Peuplement` sans
   `SetDistanceOptimizationMultiplier`.
4. Chaque frappe et chaque sort balaient tous les personnages.
5. Tous les sous-niveaux chargés en permanence chez chaque client.

## 8. Lore — écarts à trancher

- Canon câblé : 3 factions (Akar'lys, Mezalayis, Zayan), 4 classes « Guerrier »,
  10 éléments, lieux Forge / Tour / Hub Orbital / Donjon Furiste, PNJ nommés,
  chronologie du monde-machine, Zha'vori.
- **Couleurs** : lore = bleu / orange / vert ; `Cat/Factions.lua` = bleu / violet / jaune.
- **« 5090 »** n'apparaît nulle part dans le dépôt ni dans le lore.
- **Narvos Prime est UN monde-machine** dans le canon ; le code a déjà des systèmes
  Verdant, Ocre, Azur. Les forêts violettes du brief n'existent pas encore : à poser
  comme planète nouvelle, sans toucher aux lieux canon.
- `LORE_TEMPOREL_PROPOSITION_2026-09-14.md` est une proposition, pas du canon.

## 9. Ordre de travail proposé

| lot | contenu | dépend de |
|---|---|---|
| 0 | `git init`, copie hors de E:, balayage DMDE de D: (rend peut-être `Map_Narvos`, `Map_Alien`, le pack) | Hanibes |
| 1 — stabilité | portails Tour/Azur, arrivée unique (`Narvos:Voyage`), `COORD_MAX`, quêtes et `CharacterSimple`, `pcall` qui journalisent, harnais pour `S/Sorts.lua`, `roster-tests` | Lua seul |
| 2 — locomotion | inertie, verrous et énergie d'esquive, durées alignées, arbitre de slots | Lua seul ; blend spaces 2D : éditeur + cook |
| 3 — capacités | handlers, statuts, boucliers, éléments, cibles filtrées, sons | Lua seul ; VFX/SFX neufs : cook |
| 4 — monde en données | hiérarchie Galaxie → Monde, identifiants en dur retirés, matrice de factions | Lua seul |
| 5 — hub et entrée | sélection de planète, transition, streaming | Lua ; à voir en jeu |
| 6 — planète alien, bases, donjons | terrain, sous-niveaux, NavMesh | éditeur + cook |
| 7 — mesure puis optimisation | radar, barre de sorts, plafonds, streaming | serveur lancé |

Les lots 1 à 4 se font en Lua pur avec harnais, sans pack. Les lots 5 à 7 ne peuvent
être validés qu'avec un client qui se connecte, donc après le lot 0 et un cook.

## 10. Lot 1 — fait le 03/10 (commits `1440f80`, `b1dfbd2`, `e258aeb`)

Batterie : 108 harnais, 91 verts, 17 rouges, 11 809 assertions
(`E:\mes_projet\BATTERIE_14_lot1_fin_2026-10-03.txt`). Rien n'a été vu en jeu.

| correctif | fichiers | preuve |
|---|---|---|
| Menotté : esquive et escalade refusées | `Shared/Logic/Menottes.lua` | `menottes-cablage-check` |
| Portails de montée Tour et Azur posés sur les arrivées remesurées | `Shared/Catalogs/Mondes.lua` | `voyage-tests.lua` : tout portail de départ est dans le monde qu'il quitte |
| Arrivée unique : `VoyageServeur.Annoncer` (vol, vitesse, ciel) appelé par la réapparition, les points de téléportation et les Zaaps quand le monde change | `Server/Voyage.lua`, `Reapparition.lua`, `Teleports.lua`, `Zaaps.lua`, `Index.lua` | `zaaps-serveur.mjs` |
| Points posables sur la Mégastructure (`COORD_MAX` 200 km) | `Shared/Logic/Teleports.lua` | `teleports.mjs` |
| Quêtes « tuer N » : les `CharacterSimple` comptent | `Server/Index.lua` | lecture seule (aucun harnais ne charge `Index.lua`) |
| `IaServeur.Prendre` en échec : journalisé | `Server/Peuplement.lua`, `Spawner.lua` | lecture seule |
| Harnais de l'exécutant des sorts | `scripts/lua-harness/sorts-serveur.mjs` | 42 assertions |

Reste du lot 1 : `roster-tests.lua` (attend la règle « tenue offerte » ou non).
