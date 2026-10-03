# MISSION KIMI — cuire ce qu'on a, acheter le reste (il est court)

Date : 2026-09-09 · Émetteur : Claude · Destinataire : Kimi
Fait suite à [ASSETS_OBJECTIFS_RP.md](ASSETS_OBJECTIFS_RP.md) — **lis d'abord le bloc de
correction en tête de ton propre rapport.**

---

## 0. La leçon, avant tout le reste

Ton rapport annonçait dix manques et un « joker » à convertir. Après vérification :
**le joker était déjà cuit** (c'est `CITY_PACK`, la capitale), et sur les huit manques
que j'avais moi-même retenus après correction, **six ont leur source chez nous.**

La cause est la même des deux côtés, et c'est la seule chose à retenir de cette mission :

> **Une absence cherchée avec le mauvais vocabulaire est une absence inventée.**

Le compte des faux positifs de cette seule journée, tous jugés sur le NOM au lieu du
CHEMIN et de la NATURE :

| requête | ce qu'elle rendait vraiment |
|---|---|
| `drone` | des enceintes de discothèque — le vrai drone s'appelle `DRAGONFLY` |
| `atm` | de l'*atmosphere* — la vraie ATM s'appelle `SM_Atm_Cube`, et elle est cuite |
| `crystal` | des sons de pas sur armure |
| `corn` | « corner », en chunks Halo |
| `crop` | « mi**crop**hones » |
| `computer` | des chunks de décor Halo — les vrais sont dans `SCI_FI_LABORATORY` |
| `cuff` | « s**cuff** », des bruits de semelle |
| `car` | des **cargopants** et des **cartridge** |

Huit requêtes, huit réponses justes, huit conclusions fausses.

---

## 1. Où en sont vraiment les huit manques

Tout est mesuré sur `WebPortal/Server/Assets/narvos/Assets.toml` (pack cuit),
`WebPortal/public/asset_game/a_trier/`, `WebPortal/public/models/` et
`WebPortal/Server/adk/Content/`.

| # | Manque | Verdict | Où est la source |
|--:|---|---|---|
| **1** | **Véhicule terrestre pilotable** | **À CUIRE** | `adk/Content/City_Traffic_Pro/Cars/Meshes/Skeletal_Meshes/` : **`Car_Skeleton` + 12 SkeletalMesh de voiture, chacun avec son PhysicsAsset** (`SK_Executive_Sedan`, `SK_Pickup`, `SK_Full-size_SUV`, `SK_Minivan`, `SK_Compact_Panel_Van`, `SK_Luxury_Car`, `SK_Station_Wagon`, `SK_Sport_Wagon`, `SK_Family_Hatchback`, `SK_Hatchback1`, `SK_Sporty_Compact_Hatchback`, `SK_Compact_Crossover`). 587 uasset, **0 dans le toml**. |
| **2** | **Objet de communication tenu en main** | **PARTIEL — déjà cuit** | `SM_TABLET_PC` est cuit (`CITY_PACK/INTERIORS/LIBRARY/MESHES/`). Une tablette tient très bien le rôle en RP futuriste. Reste absent : téléphone, talkie. |
| **3** | **Caméra de surveillance** | **À CUIRE** | GLB : `SM_CCTVCameras_Down/_Straight/_UP` (`models/environnements/ParkingGarage/Meshes/`) et `SM_Security_Camera_Base/_Lens/_Viewcone` (Voyager, **en GLB ET en uasset**). Base + lentille séparées : une tourelle motorisée est possible. |
| **4** | **Minerai / cristal récoltable** | **À CUIRE** | `a_trier/asset_trier/animation_craf/Hyper Inventory…V2/…/ResourcePack/Raw_Resources/` : **7 minerais** (`SM_Ore_Coal/_Copper/_Gold/_Iron/_Silver/_Stone/_Uranium`), **5 lingots**, **5 gemmes** (`SM_Diamond`, `SM_Emerald`, `SM_Ruby`, `SM_Sapphire`, `SM_Topaz`), plus argile, silex, soufre, charbon, ferraille. 89 uasset. |
| **5** | **Agriculture** | **À CUIRE** | Même pack : `BP_Farming_Master`, `BP_BigFarmingPlot`, `BP_SmallFarmingPlot`, `SM_FarmingPlot_01/02`, les sols, **8 sortes de graines**, sacs d'engrais, et même un `BP_Vendor_Child_Farmer`. Le `Food` voisin fait 247 uasset. |
| **6** | **Badge / accréditation** | **À CUIRE** | `Inventory_System_Pro_by_Moonville/…/Art/Keycard/` : `SM_Keycard` + `MI_Keycard` + 5 textures + `DA_Keycard`. Aussi `models/armes/Sci_fi/FBX/Prop_KeyCard.glb`. Et les `BP_LootSecurityClearanceLvl1/2/3` de Defender dans l'ADK. **0 dans le toml.** |
| **7** | **Menottes, mobilier de commissariat** | **MANQUANT** | Zéro, partout — GLB, uasset, ADK, pack cuit. Les 69 hits `cuff` étaient tous des `scuff` de bruitage. **Vrai manque.** |
| **8** | **Lecteur de badge / scanner biométrique** | **DÉTOURNABLE** | `SM_KeyPanel01.glb` (`models/environnements/SciFiWorld/Meshes/`) fait un clavier mural. `SM_Xray_Scanner` (portique) est déjà cuit. Pas de lecteur biométrique dédié. |

**Bilan : un seul vrai manque (n°7), deux demi-manques (n°2 téléphone, n°8 lecteur), et
cinq chantiers de cook.**

---

## 2. Ce que je te demande — DANS CET ORDRE

### A. Chiffrer les cooks, avant de parler d'achat (priorité)

Pour chacun des cinq chantiers du §1, produis une fiche :

- **le chemin source exact** et le nombre d'assets réellement utiles (des meshes, pas des
  `T_*` et `MI_*` qui gonflent les comptes — c'est l'incertitude que tu avais toi-même
  signalée sur Metaverse) ;
- **les dépendances** : plugin requis ? Blueprint qui appelle du C++ ? matériaux à
  rebrancher (le cas comparable mesuré donnait 24/24 gris après copie) ;
- **le risque nommé**, en une phrase.

Ordre de valeur, à vérifier plutôt qu'à croire :

1. **City_Traffic_Pro** — débloque à lui seul la phase 2.15 (garage, véhicules
   persistants), 3.22 (convois) et 5.42 (police). ⚠ La question qui décide de tout :
   **les os de roues de `Car_Skeleton` sont-ils exploitables par `VehicleWheeled` de
   nanos ?** nanos n'a que `VehicleWheeled` et `VehicleWater`, **aucun aéronef**, et
   `Chaos Vehicles` est whitelisté mais PAS activé dans l'ADK. Si ça bloque, dis-le : le
   repli est les 10 véhicules du pack de base Steam.
2. **Hyper Inventory V2** — un seul cook couvre les manques 4 ET 5 (minerais + agriculture),
   plus 247 aliments, 100 outils, 448 armes, 317 structures, 286 icônes. C'est le vrai
   joker de ce parc, et cette fois je l'ai vérifié : `Raw_Resources` et `Farming` ne sont
   nulle part dans le toml.
3. **Caméras** (n°3) et **Keycard** (n°6) — petits, isolés, sans dépendance apparente.

### B. Chercher sur Fab — la liste est courte

Uniquement ceci. **Ne cherche rien d'autre sans m'avoir montré qu'on ne l'a pas.**

| Priorité | Cherche | Pourquoi |
|---|---|---|
| 1 | **Menottes, mobilier de commissariat, cellule** | le seul manque total (n°7) |
| 2 | **Smartphone / talkie-walkie tenu en main** | on n'a que la tablette (n°2) |
| 3 | **Lecteur de badge mural, scanner biométrique** | on n'a que le clavier `SM_KeyPanel01` (n°8) |

Et **seulement si** le point A conclut que `City_Traffic_Pro` est inutilisable :

| 4 | **Voitures squelettiques, Chaos Vehicles, UE 5.7** | repli du n°1 |

### Contraintes NON NÉGOCIABLES pour tout candidat Fab

Note-les pour chacun, sinon la fiche ne sert à rien :

1. **UE 5.7.** Un pack 5.0-5.3 seul est un risque, dis-le.
2. **Squelette.** Pour un personnage : nanos exige **`SKEL_Mannequin`, le Mannequin UE4
   (~68 os)** — PAS Manny UE5 (89 os). C'est l'erreur la plus chère du projet.
3. **Véhicule** : SkeletalMesh avec os de roues, pas un StaticMesh. Deux classes
   seulement : `VehicleWheeled`, `VehicleWater`. **Aucun aéronef.**
4. **Aucun plugin C++.** nanos est un client *shipping* ; un pack qui dépend d'un plugin
   tiers est inutilisable. Les Blueprints, eux, s'exécutent.
5. **Pas de `+` ni de caractère exotique dans un nom d'asset** — un `+` fait refuser le
   pack ENTIER par nanos. Déjà payé.
6. **Licence**, et **pas de marque réelle**. ⚠ `a_trier/asset_trier/20x Vehicles 3D Models
   Pack 2` est précisément ce qu'il ne faut pas : des fichiers DCC bruts (`.max`, `.obj`,
   `.3ds`, `.c4d`), aucun asset Unreal, aucun rig, et des BMW / Ferrari / Chevrolet
   nommément. Ne le compte pas comme une ressource.

Rendu : par manque, un tableau **nom · éditeur · prix · version UE · squelette · meshes
utiles · lien Fab · le risque en une phrase**. Puis : **le plus petit panier qui débloque
le plus de phases.**

---

## 3. AVANT TOUT ÇA — 37 vêtements cuits qui ne servent à rien

Ton manque n°2 (« 0 PNJ civil clé en main ») est faux, et ce qu'il cache vaut mieux qu'un
achat.

`Shared/Catalogs/Modular.lua` déclare **42 pièces, 1 seule famille**. Le pack cuit
contient une garde-robe MetaCustom entière dont **aucune** pièce n'y figure :

```
SK_Shirt  SK_Shirt2  SK_Pants  SK_Pants_2  SK_Pants3  SK_Jacket  SK_Dress  SK_Dress_Sim
SK_Boots  SK_Boots_2  SK_Socks  SK_SocksM  SK_Suspenders  SK_Belt  SK_Inner_Clothing
SK_Set_3_Work_Top  SK_Set_3_Work_Skirt  SK_Set_1_Crop_Top  SK_Set_1Shorts  SK_Set_2_Pants
SK_Sci_Fi_Jumpsuit  SK_Sci_Fi_Armor  SK_Male_Armor_Top  SK_Male_Armor_Bottoms
SK_Meta_Female_Base  SK_MetaP  SK_MetaP1  …  (~37, sur 2 100 SkeletalMesh cuits)
```

Un ouvrier, un civil, un employé se composent **aujourd'hui**. L'en-tête de `Modular.lua`
dit que les deux familles passent `AddSkeletalMeshAttached` (« leurs noms d'os concordent
avec SKEL_Mannequin, vérifié ») et que le seul obstacle est le mélange des VOLUMES — ce
que `ValiderTenue` refuse déjà.

⚠ **Le catalogue est GÉNÉRÉ** par `scripts/narvos-modular-to-lua.mjs`, « reconstruit depuis
les GLB réellement importés ». Ces pièces sont venues par l'ADK, pas par GLB : le
générateur ne les voit probablement pas. **Ne les ajoute pas à la main — le prochain
`--apply` les écraserait.** Le travail est d'élargir la source du générateur.

Zéro euro, assets déjà cuits, et ça referme ton manque n°2 tout seul.

---

## 4. Contexte à jour, pour que tu ne remesures pas

- Cook terminé, pack régénéré 17:19 (212 858 fichiers, 1 575 clés `CITY_PACK`).
- Capitale et forêt **jouables** : les deux gardes `cuit = false` sont retirés.
- Ta dernière incertitude est levée : `voyage.mjs` **131/131**, six points de départ.
- Deux défauts que ton audit documentaire ne pouvait pas voir, corrigés depuis :
  `VoyageServeur.Charger` ignorait `decor_persistant` (portail affiché, voyage refusé) ;
  la forêt n'avait **aucune liaison** — déclarée, praticable, injoignable. Elle a
  maintenant sa route depuis Akarlys, 20 km au sol.
- **Le choix du point de départ est branché** (2026-09-09) : nouvel état `depart` entre la
  sélection et le jeu, carte des six mondes dessinée depuis les vraies coordonnées,
  revalidation serveur par `Depart.Retenu`.
- Ta question ouverte sur le mécanisme dormant `cuit = false` : **on le garde.** Il est
  placé avant la décision, la seule position où un garde garde quelque chose.
- Batterie complète verte : **3 028 assertions**, 0 référence morte, 88 générateurs.
- Ta roue TAB est branchée des deux côtés (`ui-liens` vert, 98 tests). Au passage :
  `SM_FirstAidKit_001/002`, `SM_Bandage_001/002`, `SM_Aspirin_001/002` existent dans
  `animation_craf/Survival Crafting System` — de quoi donner un vrai mesh à l'emplacement
  « kit de soin » de la roue.
- `ui-liens` couvre désormais **les deux pages** WebUI. Il n'en regardait qu'une, et
  annonçait quand même « tous les liens sont reliés » : le flux connexion / roster /
  création / départ n'était vérifié par rien.