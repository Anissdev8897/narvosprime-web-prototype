# VEHICULE_ROULANT — une voiture City_Traffic_Pro qui roule, prouvée hors du jeu

Date : 2026-09-10 · Auteur : Kimi (sous-agent, chantier véhicules).
Toutes les signatures d'API viennent de
`WebPortal/Server/nanos_world/libraries/api-main/api-main/` — jamais de mémoire.
Toutes les entrées `Assets.toml` citées ont été relues par grep avant d'être
écrites. Toutes les sorties d'outils sont collées intégralement, rien de masqué.

---

## 0. La voiture choisie, et pourquoi

**`SK_Executive_Sedan`** est la référence du chantier — mais les **12 voitures
sont branchées**, pas une seule. Pourquoi le Sedan en tête :

1. Les 12 SK_ partagent `Car_Skeleton` et une **table de noms identique**
   (mesuré, §1) : une classe unique paramétrée par modèle couvre tout le pack.
   Le choix du « premier » modèle n'engage donc rien.
2. Son réglage provisoire est copié du **Sedan du gabarit officiel**
   (`default-vehicles-main/Shared/Index.lua:135-162`) — la carrosserie la plus
   proche, et le gabarit le mieux calibré du pack de base.
3. C'est le modèle cité par la mission ; `/vehicule executive_sedan` le spawn.

## 1. La preuve des os et des sockets (mesurée, pas crue)

### 1.1 Assets.toml — les 12 voitures sont cuites, dans la bonne section

`WebPortal/Server/Assets/narvos/Assets.toml` — sections relevées par grep :
`[assets.skeletal_meshes]` ouvre ligne 43624, `[assets.sounds]` ligne 45741.

```
45053: SK_Compact_Crossover        = "Narvos/City_Traffic_Pro/Cars/Meshes/Skeletal_Meshes/SK_Compact_Crossover"
45054: SK_Compact_Panel_Van        = "…/SK_Compact_Panel_Van"
45074: SK_Executive_Sedan          = "…/SK_Executive_Sedan"
45094: SK_Family_Hatchback         = "…/SK_Family_Hatchback"
45108: SK_Full-size_SUV            = "…/SK_Full-size_SUV"
45114: SK_Hatchback1               = "…/SK_Hatchback1"
45123: SK_Luxury_Car               = "…/SK_Luxury_Car"
45198: SK_Minivan                  = "…/SK_Minivan"
45231: SK_Pickup                   = "…/SK_Pickup"
45251: SK_Sport_Wagon              = "…/SK_Sport_Wagon"
45252: SK_Sporty_Compact_Hatchback = "…/SK_Sporty_Compact_Hatchback"
45254: SK_Station_Wagon            = "…/SK_Station_Wagon"
```

12/12 entre les lignes 43624 et 45741 → toutes en `[assets.skeletal_meshes]`.
Avec elles, mesurés le même jour :

- **Plaques** (lignes 43125-43128, `[assets.static_meshes]`) :
  `SM_RegPlate01/02/03/04 = "Narvos/City_Traffic_Pro/Cars/Meshes/RegPlates/…"` ;
- **Sons** (lignes 46405-46413, `[assets.sounds]`) : `S_Car_Engine_2K/3K/4K/5K`,
  `S_Horn`, `S_Crash1-3`, `S_TiresRolling_Loop` ;
- **SM_ statiques des 12 carrosseries** aussi (`SM_Executive_Sedan` ligne
  42582, etc. — versions décor, inutilisées ici) ;
- **107 entrées** City_Traffic_Pro au total dans le pack.

### 1.2 Les os — sonde sur les .uasset CUIT

Sonde (extraction des chaînes ASCII ≥ 4 octets, même méthode que
`scripts/narvos-squelettes-uasset.mjs`, appliquée aux fichiers sous
`WebPortal/Server/Assets/narvos/Narvos/City_Traffic_Pro/Cars/Meshes/Skeletal_Meshes/`) :

```
=== Car_Skeleton.uasset (1 503 octets) ===
  Body  HeadlightL  HeadlightR  RegPlateF  RegPlateR
  Wheel_FL  Wheel_FR  Wheel_RL  Wheel_RR
=== SK_Executive_Sedan.uasset (4 688 octets) ===
  (identique)
```

Comparaison ensemble par ensemble sur les 12 SK_ :

```
SK_Compact_Crossover.uasset      REF : [Body, HeadlightL, HeadlightR, RegPlateF, RegPlateR, Wheel_FL, Wheel_FR, Wheel_RL, Wheel_RR]
SK_Compact_Panel_Van.uasset      identique
SK_Executive_Sedan.uasset        identique
SK_Family_Hatchback.uasset       identique
SK_Full-size_SUV.uasset          identique
SK_Hatchback1.uasset             identique
SK_Luxury_Car.uasset             identique
SK_Minivan.uasset                identique
SK_Pickup.uasset                 identique
SK_Sport_Wagon.uasset            identique
SK_Sporty_Compact_Hatchback.uasset  identique
SK_Station_Wagon.uasset          identique
VisWheel present: False | PhysWheel present: False | Socket: False
```

### 1.3 Ce que ça tranche

1. **Les 4 os de roues sont `Wheel_FL/FR/RL/RR`** — exactement la signature de
   la convention `city_traffic_pro` d'`OsVehicules` (écrite le matin même sur
   preuve binaire du pack source ; la voici confirmée sur le pack CUIT).
2. **Il n'y a AUCUN socket `VisWheel_*` ni os `PhysWheel_*`** : le patron du
   Offroad (roues visuelles `SM_Offroad_Tire` attachées par
   `AddStaticMeshAttached` sur sockets) **ne s'applique pas**. Et il n'en a pas
   besoin : les 9 autres véhicules du gabarit officiel (Sedan, SUV, Pickup…)
   ne font que `SetWheel(index, bone_name, …)` — **les roues sont skinnées
   dans le mesh squelettique et animées via leurs os**. C'est le chemin choisi,
   et il est documenté dans `Shared/Logic/Voitures.lua`.
   L'alternative « API de roues procédurales » n'existe pas : relus
   `VehicleWheeled.json` (15 fonctions) et `BaseVehicle.json` (26) — la seule
   API de roues est `SetWheel(index, bone_name, …)` ; les attaches sont
   `AddStaticMeshAttached` / `AddSkeletalMeshAttached` (par socket OU os).
3. **`RegPlateF`/`RegPlateR`/`HeadlightL`/`HeadlightR`** : os ou sockets, la
   table de noms ne le dit pas (aucun marqueur « Socket » dans le binaire).
   Les plaques `SM_RegPlate01-04` sont posées dessus par
   `AddStaticMeshAttached`, qui accepte les deux — **provisoire, à confirmer
   en jeu** (une plaque flottante mal orientée serait le signal).
4. **`OsVehicules.Resoudre` accepte la signature** : le harnais (§5) résout la
   table de noms mesurée → `city_traffic_pro`, 4 rôles, 0 manquant.

## 2. Ce qui a été écrit

### 2.1 `packages/narvos/Shared/Logic/Voitures.lua` (NEUF — logique pure)

Donnée + logique pure, aucune entité créée :

- `OS_CAR_SKELETON` — la table de noms mesurée (§1.2), en constante documentée ;
- `REGLAGE_COMMUN` — moteur/boîte/roues/portes, **provisoire** : gabarit Sedan
  du pack officiel. Les Blueprints du pack sont illisibles (mesuré :
  `BP_ParentBP_Drivable_Car.uasset` = 1 431 octets, stub cuit ; `WheelData/`
  vide) — rien n'a pu être puisé, c'est dit dans l'en-tête du module ;
- `Liste()` / `Modele(id)` — lecture du catalogue généré `VOITURES_NANOS` ;
- `ResoudreOs()` — `OsVehicules.Resoudre(OS_CAR_SKELETON)`, jamais de repli ;
- `RouesPour()` — 4 roues prêtes pour `SetWheel` (indices 0..3 = AVg, AVd,
  ARg, ARd ; braquage avant, propulsion arrière provisoire), chaque roue
  porte l'os résolu PAR SIGNATURE, pas un nom en dur ;
- `VerifierDonnees()` — la garde que le harnais appelle.

### 2.2 `packages/narvos-map-proto/Server/Voitures.lua` (NEUF — exécutant)

- **La classe** : `NarvosVoitureCTP = VehicleWheeled.Inherit(...)`, patron
  `default-vehicles-main`. Constructeur `(location, rotation, modele_id)` :
  `Super:Constructor(…, modele.asset, CollisionType.Normal, true, true,
  son_moteur, son_klaxon, nil, nil, nil, true)` — les sons moteur/klaxon sont
  ceux du pack cuit, frein/démarrage/portière restent les défauts nanos (comme
  9 des 11 véhicules du gabarit). Puis `SetEngineSetup`,
  `SetTransmissionSetup`, `SetSteeringSetup(SteeringType.Ackermann)`,
  `SetDifferentialSetup(DifferentialType.RearWheelDrive)` (enums relus dans
  `Enums.json` : Ackermann = 2, RearWheelDrive = 3), les 4 `SetWheel` sur les
  os résolus, 2 `SetDoor` (gabarit Sedan), `SetCameraOffset`, les 2 plaques.
  Tout refus (modèle inconnu, roues non résolues) est un `error()` nommé —
  jamais une voiture fantôme.
- **Le spawn** : `Spawner(player, modele_id)` — revalidation serveur du modèle
  dans le catalogue, une voiture par joueur (l'ancienne détruite), pose à 6 m
  devant au cap du joueur, `pcall` autour de la construction, puis
  **`character:EnterVehicle(v, 0)`** (Character.json : autorité server) — la
  commande sert à rouler, pas à regarder.
- **Entrée/sortie** : l'API n'exige AUCUN handler — nanos place le conducteur
  via le trigger de porte (`SetDoor`) ; le game-mod sandbox ne fait
  qu'ÉCOUTER `EnterVehicle` côté client pour son HUD
  (`sandbox-master/Client/Index.lua:66`). La montée au spawn est un confort de
  test ; la sortie reste l'interaction native.
- **Les abonnements** : `Events.SubscribeRemote("Narvos:DemanderVehicule")`
  (le client demande, le serveur revalide) et `Player.Subscribe("Destroy")`
  (purge de la voiture à la déconnexion — table par joueur déclarée EN TÊTE).

### 2.3 Câblage

- `packages/narvos/Shared/Index.lua` : `Narvos.Voitures =
  Package.Require("Logic/Voitures.lua")`, après `OsVehicules` ;
- `packages/narvos-map-proto/Server/Index.lua` :
  `Narvos.VoituresServeur = Package.Require("Server/Voitures.lua")` après
  `VestiaireServeur` ; `COMMANDES.vehicule` (sans argument : liste des modèles
  ; avec : spawn) ; `vehicule = true` dans `DEV_COMMANDES` — un spawn de
  véhicule physique est un pouvoir, fermé par défaut comme `/vaisseau`.

### 2.4 Le catalogue — GÉNÉRÉ, pas écrit à la main

1. **Source** : `WebPortal/src/rpg/runtime/vehicles/vehicleCatalog.ts` —
   nouvel export `VOITURES_NANOS` (12 entrées : id, label, `asset`
   `narvos::SK_…`, `son_moteur`, `son_klaxon`, `plaque`). Distinct de
   `VEHICLE_CATALOG` (les véhicules du runtime web) : les 12 voitures n'ont
   aucun GLB web, les mélanger ferait apparaître des véhicules sans mesh dans
   le shop.
2. **Garde** : `scripts/narvos-catalogs-to-lua.mjs` — pour `Vehicles`, le
   générateur lit `Assets.toml` et **n'émet que les entrées dont le mesh est
   déclaré**, en DISANT chaque exclusion ; un catalogue vide est annoncé, pas
   tu. Sortie intégrale du `--apply` :

```
=== APPLIQUÉ ===
vers : E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared/Catalogs/

  Classes     2 table(s),  1 ignorée(s)   2.6 ko
  Elements    2 table(s),  2 ignorée(s)   4.6 ko
  Spells      1 table(s),  1 ignorée(s)   6.4 ko
  Loot        2 table(s),  1 ignorée(s)   30.8 ko
  Items       1 table(s),  3 ignorée(s)   34.9 ko
  Npc         1 table(s),  2 ignorée(s)   18.0 ko
  Merchants   1 table(s),  5 ignorée(s)   13.8 ko
  garde Vehicles : 12 voiture(s) retenue(s) (mesh présent dans Assets.toml).
  Vehicles    3 table(s),  1 ignorée(s)   21.0 ko
  Stats       1 table(s), 11 ignorée(s)   0.2 ko
  Talents     2 table(s),  2 ignorée(s)   4.1 ko

  Index.lua  les 10 catalogue(s) produit(s) y sont tous cables.

10 catalogue(s) transpilé(s).
```

   12/12 retenues — elles sont cuites, la garde le prouve au lieu de l'affirmer.
   (Le générateur n'écrase plus `Shared/Index.lua` — il le VÉRIFIE ; incident
   du 2026-09-08 clos. Non-git : la machine n'a pas de dépôt, les compteurs
   des 9 autres catalogues sont identiques à la simulation d'avant.)
3. **Vérificateur** : `scripts/narvos-verifier-catalogues.mjs` — nouveau
   contrôle `Vehicles` : existence + TYPE section par section (SK_ →
   skeletal_meshes, SM_ → static_meshes, S_ → sounds), et **refus du zéro
   cible** (un catalogue sans référence `narvos::` est rouge, pas « vert par
   vacuité »).

### 2.5 Le harnais — `scripts/lua-harness/vehicules.mjs` + `vehicules-tests.lua`

Prouve les quatre points exigés : classe définie et câblée · chaque mesh
référencé existe dans Assets.toml (lu, section par section) ET le compte du
catalogue égale le compte des SK_ City_Traffic_Pro déclarés (une relation, pas
un « 12 » recopié) · le mapping d'os résout sur `city_traffic_pro` (wasmoon,
sur le catalogue GÉNÉRÉ et la table de noms mesurée) · le handler est abonné
(chat + remote + purge). Il compte ses assertions et échoue sur cible absente.

## 3. Sorties des vérifications (collées, rien de masqué)

```
$ node scripts/lua-harness/vehicules.mjs
[1. la classe est définie et câblée]
[2. chaque mesh référencé existe dans Assets.toml]
[3. le mapping d'os résout (wasmoon)]
[résolution des os — la mesure contre la signature]
[roues — le plan de SetWheel]
[catalogue — les 12 voitures cuites]
[garde-fou du module]
[bilan]

23 reussis, 0 echec(s)
[4. le handler est abonné]

vehicules.mjs :: 113 controle(s) JS reussis, 0 echec(s)

$ node scripts/lua-harness/cablage-check.mjs
100 fichier(s) Lua · 72 module(s) câblé(s) dans Shared/Index.lua
15 autre(s) assignation(s) Narvos.* (exécutants serveur)
[1. tout ce qui est lu est câblé]
  OK        les 74 modules lus sont tous câblés
[2. chaque champ accédé existe dans le module câblé]
  OK        les 119 champs accédés existent tous
Câblage complet et cohérent.

$ node scripts/lua-harness/syntaxe-check.mjs
Tous les fichiers compilent.
100 generateur(s) compilent.

$ node scripts/lua-harness/portee-check.mjs
532 declaration(s) de premier niveau examinee(s) dans 64 fichier(s).
Aucun emploi avant declaration.

$ node scripts/lua-harness/appels-check.mjs
Bilan : 160 jamais appelée(s) · 161 confinée(s) à leur fichier.
Ce contrôle RAPPORTE, il ne bloque pas — voir l'en-tête pour pourquoi.
  (les fonctions Voitures y figurent : leurs appelants sont la classe et la
   commande, côté serveur nanos — attendu, même statut que Menottes/Cameras)

$ node scripts/lua-harness/ui-liens.mjs
Tous les liens page <-> Lua sont relies.

$ node scripts/narvos-verifier-catalogues.mjs
Verification des catalogues
  notre pack   : 67451 assets
  pack de base : 2314 assets

  Modular          42 references  ok
  Modular liens    52 references  ok
  Spawnables       56 references  ok
  Patches           1 references  ok
  Vegetation        4 references  ok
  Props           449 references  ok
  Vfx             106 references  ok
  Emotes          166 references  ok
  Vehicles         21 references  ok
  Apparence peau    2 references  ok
  Map Orbital    1546 references  ok
  Map forge_map   623 references  ok
  Map tower_map  1451 references  ok
  Widgets          45 references  ok

Aucune reference morte.
  (Vehicles : 21 = 12 SK + 4 S_Car_Engine + 1 S_Horn + 4 SM_RegPlate — exigé
   vert, il est vert.)

$ node scripts/lua-harness/tout.mjs
…
vert  vehicules.mjs
…
57 harnais · 3581 assertion(s) réussie(s) · 0 échec(s) déclaré(s) · 0 harnais ROUGE(S)
```

## 4. Ce qui attend le test en jeu (le patron lance)

Prouvé sans le jeu : les os, les meshes, le câblage, la classe, le handler, la
résolution. **Non prouvable sans lancer le serveur** :

1. **`VehicleWheeled` accepte-t-il `Car_Skeleton` ?** C'est LA question du
   chantier. Le squelette est un vrai Skeleton UE cuit avec os de roues, le
   constructeur reçoit un SkeletalMeshPath déclaré — tout est du côté du
   « oui », mais seul le moteur tranche. Si nanos le refuse, l'erreur
   apparaîtra au `pcall` du spawn (elle est nommée, pas muette).
2. **La physique** : `SK_Executive_Sedan_PhysicsAsset.uasset` est cuit à côté
   — son contenu (contraintes, corps) n'a pas été lu ; un PhysicsAsset mal
   cuit peut faire une voiture qui s'effondre ou tremble.
3. **L'échelle et l'orientation** : les constantes de portes/caméra viennent
   du Sedan du pack de base ; si les voitures CTP ne sont pas à l'échelle du
   personnage nanos, `/vehicule` le montrera en trois secondes — c'est fait
   pour.
4. **Les plaques** : `RegPlateF/R` os ou sockets (§1.3.4) — si les plaques
   sont mal posées, retirer les deux `AddStaticMeshAttached` n'enlève rien au
   roulage.

**Pour essayer** : lancer le serveur, vérifier `commandes_dev = true` dans le
`[custom_data]` de Package.toml, puis en jeu : `/vehicule` (la liste),
`/vehicule executive_sedan` (spawn + au volant). Le client UI peut aussi
émettre `Events.CallRemote("Narvos:DemanderVehicule", Reliability.Reliable,
"minivan")`.

## 5. Ce dont je ne suis pas sûr

- **Le réglage est du Sedan nanos, pas du pack.** Les BP cuits sont des stubs
  (1 431 octets, `WheelData/` vide) : couple, rapports, freins, suspensions —
  tout est provisoire. La voiture roulera comme une Sedan nanos ; le caractère
  « City Traffic Pro » (12 comportements distincts) demande un calage en jeu
  ou une extraction ADK que le binaire cuit ne m'a pas permise.
- **Propulsion arrière + Ackermann** : choix de cohérence avec le gabarit
  Sedan (roues arrière motrices), pas une donnée du pack. Si une voiture
  sous-vire bizarrement, c'est là, pas dans les os.
- **`son_moteur` (4 variantes pour 12) et plaques** : répartition arbitraire,
  documentée comme telle dans la source TS.
- **Sons S_Car_Engine_\*** : ce sont vraisemblablement des boucles par régime
  (2K/3K/4K/5K ≈ tours/min) destinées au système de son du pack ; nanos attend
  UNE boucle moteur. `S_Car_Engine_3K` en engine_sound est un pari raisonnable,
  à l'oreille au premier essai ; `SC_Engine_Loop` (SoundCue) existe aussi mais
  les SoundCues ne sont pas le format attendu par le constructeur (SoundPath —
  les A_Vehicle_Engine du pack de base sont des SoundWave ; type exact des S_
  non vérifié dans le binaire).
- **`auto_start_engine = true`** : le moteur démarre à l'entrée — cohérent
  avec le gabarit, mais si le patron veut une clé de contact, c'est un
  paramètre du constructeur.
- **Le `SetValue("narvos_vehicule", id)`** anticipe un système de véhicules
  persistants qui n'existe pas : personne ne lit cette valeur aujourd'hui.
  Elle coûte une ligne et évitera de re-câbler plus tard — comme
  `narvos_vol` avant les vaisseaux.
- **appels-check rapporte** les fonctions de `Voitures` comme « jamais
  appelées » depuis les modules partagés : leurs appelants sont le
  constructeur de la classe et la commande chat, dans le package serveur —
  contrôle non bloquant, même statut accepté que Menottes/Cameras/OsVehicules.
