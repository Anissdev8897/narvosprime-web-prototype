---
name: narvos-lua
description: >
  Architecture Lua de NARVOS sur nanos world — les 80 modules, leur câblage, ce
  qui est réellement APPELÉ, les invariants du serveur, et les gardes qui
  empêchent les récidives. À invoquer AVANT d'ajouter un module Lua, de câbler
  quoi que ce soit dans Shared/Index.lua, ou de brancher un système côté serveur.
  Complète le skill `nanos-world`, qui couvre l'API du moteur ; celui-ci couvre
  NOTRE code.
---

# narvos-lua — l'architecture Lua de NARVOS

Le skill `nanos-world` dit ce que le MOTEUR sait faire. Celui-ci dit ce que NOUS
avons écrit, ce qui est branché, et surtout **ce qui ne l'est pas**.

Mesuré le 2026-09-10. Chaque chiffre porte sa commande : un compteur sans sa
commande est un compteur qu'on recopiera.

---

## 0. La règle qui gouverne tout le reste

**Un module traverse TROIS états, et deux d'entre eux sont muets.**

```
   écrit          →      câblé          →      appelé
(un fichier)      (Shared/Index.lua)     (quelqu'un s'en sert)
      │                    │                     │
 harnais vert         charge sans           existe en jeu
 mais INEXISTANT      erreur mais           ← le seul état qui compte
 en jeu               NE FAIT RIEN
```

Le 2026-09-08, **35 modules étaient écrits et aucun câblé**. Le serveur mourait
au premier qu'il touchait, et six systèmes n'existaient pas — écran de création,
spawn, ciel, peuplement, menus, HUD — pour une seule ligne manquante.

⚠ **Les harnais ne voient RIEN de ça.** Ils chargent les modules en direct
(`readFileSync` + `doString`) et leur fournissent leurs dépendances à la main.
Ils prouvent que le code est JUSTE, jamais qu'il est BRANCHÉ. Plus de 2 700
assertions vertes pendant que le serveur mourait ligne 55.

---

## 1. Où vit quoi

```
WebPortal/Server/nanos_world/packages/
  narvos/                        LE package de logique — partagé serveur/client
    Shared/Index.lua             ⚠ LE SEUL CÂBLAGE. Un module absent ici n'existe pas.
    Shared/Logic/    44 fichiers, 13 018 lignes   logique PURE, testable sans moteur
    Shared/Catalogs/ 36 fichiers, 17 321 lignes   données ; la plupart GÉNÉRÉES
  narvos-map-proto/              LE package de map — l'exécutant
    Server/          14 fichiers,  6 930 lignes   entités, base, événements
    Client/           4 fichiers,  2 395 lignes   UI, gizmo, entrées
```

```bash
# reproduire ces chiffres
find WebPortal/Server/nanos_world/packages/narvos/Shared/Logic -name '*.lua' | wc -l
find WebPortal/Server/nanos_world/packages -name '*.lua' -exec cat {} + | wc -l
```

### La séparation qui rend tout testable

`Shared/Logic/` **n'appelle JAMAIS l'API nanos**. Pas de `Character()`, pas de
`Events`, pas de `Vector` construit. Il reçoit des données, il rend des
décisions. C'est ce qui permet de le prouver sous wasmoon sans moteur ni base.

`narvos-map-proto/Server/` est l'exécutant : il fabrique les entités, ouvre la
base, s'abonne aux événements, et **injecte** dans la logique ce dont elle a
besoin (`UtiliserBase`, `UtiliserGarde`, `Configurer`).

⚠ **Un module de `Logic/` qui appelle nanos casse son propre harnais** et perd la
seule preuve qu'on ait de lui.

### `Package.Require` résout dans le package COURANT

`narvos-map-proto` ne require **rien** de `narvos`. Tout transite par la table
exportée : `Package.Export("Narvos", Narvos)` d'un côté, `Narvos.X` de l'autre.
Un `Package.Require("Catalogs/X.lua")` écrit dans map-proto cherche
`narvos-map-proto/Catalogs/X.lua` — et plante au démarrage, jamais avant.

---

## 2. ⚠ CE QUI EST ÉCRIT ET INJOIGNABLE — au 2026-09-10

C'est la section à lire avant d'écrire un nouveau système : **il en existe
peut-être déjà un, mort.**

### Jamais câblés — RÉSOLU le 2026-09-10

Six fichiers étaient dans cet état, dont deux avec un harnais vert :
`Logic/WorldSim.lua`, `Logic/Audio.lua`, `Logic/Talents.lua`,
`Catalogs/Sons.lua`, `Catalogs/Vegetation.lua`, `Catalogs/Patches.lua`.

Tous câblés. `Audio.Configurer(Sons)` et `TalentsLogic.Configurer(Talents)` sont
appelés au câblage — sans quoi les modules tournaient sur un catalogue `nil` et
rendaient toujours la même chose, sans erreur.

⚠ `Logic/Talents` est câblé **`Narvos.TalentsLogic`** : `Narvos.Talents` est le
CATALOGUE. Deux fichiers du même nom dans deux dossiers — les confondre donne un
`nil` silencieux, comme `AnimNoms`/`Animations`.

⚠ **Câbler ne veut pas dire UTILISER.** `MapLoader.PoserPatches` et
`PoserVegetation` existent toujours sans appelant : les catalogues sont
joignables, le poseur reste à écrire.

⚠ `narvos-verifier-catalogues.mjs` déclarait ces catalogues « ok » : il vérifie
que leurs références d'assets existent, pas que quelqu'un les charge. Un
catalogue peut être parfaitement valide et parfaitement mort.

Le contrôle qui ferme ce trou : `node scripts/lua-harness/modules-orphelins-check.mjs`.

### Câblés mais jamais appelés — chargés, inertes

12 modules de logique : `Cameras`, `Combat`, `Ia`, `Menottes`, `OsVehicules`,
`Sorts`, `WidgetsLogic`, `Crypto`, `Voyage`, `GenerateurCartes`, `Chat`,
`Animaux`.

Tous ne sont pas des défauts. `Voyage` et `Crypto` sont consommés par leurs
homologues serveur (`VoyageServeur`, et `Comptes` capture `Crypto` au
chargement) ; `Combat` et `Ia` attendent leur exécutant. Mais `Menottes`,
`Cameras` et `OsVehicules` ont été écrits le 2026-09-10 **et rien ne les
invoque** : leur gameplay n'existe pas.

### Reproduire ce relevé

```bash
node scripts/lua-harness/cablage-check.mjs            # câblé ↔ lu
node scripts/lua-harness/modules-orphelins-check.mjs  # fichier ↔ câblé
```

**Les deux, jamais l'un seul.** `cablage-check` confronte chaque `Narvos.X` LU à
son assignation ; il ne voit pas un module que personne ne lit ET qui n'est pas
câblé — celui-là n'apparaît d'aucun côté de la comparaison. C'est ce qui a laissé
six fichiers morts, dont deux avec un harnais vert.

`modules-orphelins-check` ferme cette moitié : il part des FICHIERS et exige que
chacun soit câblé. Il porte une liste de tolérances, chacune avec sa raison — et
il refuse aussi les **tolérances périmées**, ce qui l'a fait rougir sur sa propre
liste dès la première exécution (`Map_forge_map` y figurait alors qu'il était
câblé).

---

## 3. Le câblage — `Shared/Index.lua`

L'ordre compte, et pas pour des raisons de style :

1. **Catalogues d'abord** — données pures, aucune dépendance entre elles.
2. **`Mondes` avant `Voyage` et `Ciel`.** Les deux savent se replier sur un
   `Package.Require` direct, mais ce repli crée une **SECONDE table** : deux
   catalogues distincts pour la même donnée, et une modification de l'un
   invisible depuis l'autre.
3. **`Crypto` avant `Comptes`** — `Comptes` le capture au chargement.
4. **Logique ensuite**, dans l'ordre de ses dépendances.
5. **`Package.Export("Narvos", Narvos)` en dernier.**

Le repli dynamique employé par 7 modules :

```lua
local function catalogue(nom, fichier)
    return (Narvos and Narvos[nom]) or Package.Require(fichier)
end
```

Il lit le global **au moment de l'appel**, pas au chargement — c'est ce qui rend
les harnais possibles (on monte et démonte des catalogues entre deux assertions).
⚠ C'est aussi ce qui **masque un câblage manquant** : le repli fonctionne, avec
une seconde table.

### Deux noms différents pour deux choses différentes

`Narvos.AnimNoms` = le CATALOGUE (`Catalogs/Animations.lua`).
`Narvos.Animations` = la LOGIQUE (`Logic/Animations.lua`).
Les intervertir donne un `nil` silencieux : `Resume` sur un catalogue vaut nil, et
`nil(...)` ne lève qu'à la ligne atteinte, jamais au chargement. Même précaution
pour `QuetesCatalog`/`Quetes` et `DialoguesCatalog`/`Dialogue`.

---

## 4. Les systèmes, et leur état réel

| système | logique | exécutant | état |
|---|---|---|---|
| comptes, roster, création | `Comptes` `Roster` `CharacterCreation` `Apparence` `Morphs` `Macros` | `Server/Session.lua` | **en jeu** |
| mondes et voyage | `Mondes` `Voyage` `Depart` `Ciel` | `Server/Voyage.lua` | **en jeu** — 10 portails posés au boot |
| inventaire, craft, récolte | `Inventory` `Craft` `Recolte` `Boutique` | — | logique prouvée ; boucle de jeu partielle |
| décor et édition | `Zones` `MapLoader` | `Server/Props.lua` `Server/Export.lua` `Client/Gizmo.lua` `Client/Edition.lua` | **écrit, jamais vu en jeu** (§6) |
| véhicules | `OsVehicules` `Voitures` | `Server/Voitures.lua` | **en cours** — 12 voitures cuites et déclarées, spawn non prouvé |
| menottes, caméras | `Menottes` `Cameras` | — | **câblés, jamais appelés** |
| PNJ, IA, peuplement | `Ia` `Spawnables` | `Server/Ia.lua` `Server/Spawner.lua` `Server/Peuplement.lua` | **en jeu** — 24 points au boot |

---

## 5. Les invariants du code

Chacun a coûté une session. Le skill `nanos-world` porte ceux du moteur ; voici
ceux de NOTRE code.

**Une garde se pose sur la valeur qui DÉCIDE.** Poser un prop : sur la position
d'ARRIVÉE, pas sur les pieds du joueur. Déplacer au gizmo : sur la DESTINATION —
sinon on pose chez soi puis on traîne l'objet dehors, la portée bornant un geste
et non une suite de gestes.

**Une garde d'autorisation est FERMÉE par défaut.** Non branchée et permissive,
elle est invisible ; non branchée et restrictive, elle se voit au premier geste.
`PropsServeur.UtiliserGarde` refuse tout tant que `Server/Index.lua` n'a rien
installé.

**Une liste de permissions, jamais une liste d'interdits.** `Logic/Zones.lua`
refuse hors de toute zone. Une liste d'interdits se troue à chaque nouvelle map ;
une liste de permissions ne laisse passer que ce qu'on a nommé.

**Ne jamais recopier une liste de clés.** `ipairs({ "orbital", "tower", "alien" })`
— écrit quand il y avait quatre mondes — a posé **7 portails sur 10** en silence.
Itérer le catalogue et filtrer sur une PROPRIÉTÉ (`m.decor_persistant`,
`m.niveau`), jamais sur un nom. Contrôle : `listes-recopiees-check.mjs`.

**SQLite rend `0`/`1`, pas `false`/`true` — et `0` est VRAI en Lua.**
`if (compte.est_admin) then` est vrai pour tout le monde. Comparer :
`(tonumber(v) or 0) == 1`.

**Un champ à `nil` DISPARAÎT de la table.** Impossible de distinguer « vidé » de
« jamais renseigné » ; `pairs` ne le voit pas. Itérer une liste d'emplacements.

**`pairs` n'a pas d'ordre garanti** et n'a pas le même d'une VM à l'autre. Tout
tirage indexé lit une séquence figée ; toute sortie comparable est triée.

**`local function` déclarée après son appelant se résout en GLOBAL nil**, sans
erreur au chargement. Tables indexées par joueur déclarées en tête ;
`X = function()` et non `local function X`. Contrôle : `portee-check.mjs`.

**Client → serveur : `Events.CallRemote("X", Reliability.Reliable, …)`.**
L'omettre ne lève rien, la charge utile se perd.

**La fiabilité est POSITIONNELLE, des deux côtés.** Serveur :
`Events.CallRemote(event, player, reliability, args…)` ; client :
`Events.CallRemote(event, reliability, args…)` ; `BroadcastRemote(event, reliability, args…)`.
Écrire `CallRemote("X", player, "raison")` passe le message comme fiabilité : 21 appels
serveur perdaient leur raison d'erreur (2026-09-11). Contrôle : `appels-distants-check.mjs`.

**Le personnage chargé porte `level` et `classId`** (`Roster.depuisLigne`), jamais
`niveau`/`class_id` (noms de COLONNES). Cinq lectures fausses refusaient toutes les
recettes et donnaient à chacun les stats d'une classe inconnue (2026-09-11).

**Un helper d'émission cache ses événements aux gardes.** `ateliers.js` émet par
`Lua(nom, …)` : `ui-liens` ne voyait que `Events.Call("` et restait vert sur deux
événements sans relais. Motif élargi le 2026-09-11.

**Recevoir d'un WebUI : `ui:Subscribe`, jamais `Events.Subscribe`.** 25
abonnements posés sur la mauvaise API : toutes les interfaces s'affichaient,
aucune n'agissait.

---

## 6. Les gardes — et ce qu'ils ne couvrent pas

```bash
node scripts/lua-harness/tout.mjs                     # TOUTE la batterie, un verdict
node scripts/lua-harness/syntaxe-check.mjs            # grammaire + node --check des générateurs
node scripts/lua-harness/portee-check.mjs             # emploi avant déclaration
node scripts/lua-harness/listes-recopiees-check.mjs   # copie de catalogue
node scripts/lua-harness/appels-distants-check.mjs    # fiabilité des CallRemote
node scripts/lua-harness/cablage-check.mjs            # Narvos.X lu ↔ assigné
node scripts/lua-harness/constantes-check.mjs         # deux constantes du même fait
node scripts/lua-harness/schema-check.mjs             # CREATE vs ALTER
node scripts/narvos-verifier-catalogues.mjs           # références d'assets
```

État au 2026-09-10 : **56 harnais · 3 558 assertions · 0 rouge**, 6 gardes verts.

⚠ **Aucun de ces gardes ne prouve qu'un système EXISTE EN JEU.** Le seul témoin
est le journal du serveur au démarrage — et encore : `Package loaded` s'imprime
même après une erreur Lua qui a stoppé le script. Le vrai témoin est une trace
que le module lui-même émet (« Portail pose : … », « Peuplement : 24 points »).

---

## 7. ⚠ EN COURS — ce qui manque à ce jour

| sujet | état |
|---|---|
| Un garde « tout module de `Logic/` est câblé » | ✅ **ÉCRIT** : `scripts/lua-harness/modules-orphelins-check.mjs`. Il a trouvé **6 orphelins et sa propre tolérance périmée** à la première exécution. Les 6 sont câblés, le serveur redémarre à 0 erreur / 10 portails. |
| Spawn d'un véhicule pilotable | **ÉCRIT, JAMAIS VU ROULER.** `Shared/Logic/Voitures.lua` + `Server/Voitures.lua` + `/vehicule <id>`, 12 modèles cuits et déclarés. Deux inconnues que seul le jeu tranche : `VehicleWheeled` accepte-t-il `Car_Skeleton`, et la physique (ligne suivante). |
| ⚠ Collision sur les os de roue — **les 12 voitures** | **DÉFAUT MESURÉ, NON CORRIGÉ.** `node scripts/narvos-phys-roues.mjs` : les 12 PhysicsAssets portent un corps sur `Wheel_FL/FR/RL/RR`. Le doc nanos l'interdit (« Do not add physics shapes to the Wheels! »). Symptôme attendu : voiture qui tremble, s'enfonce ou décolle. Le correctif est dans l'éditeur puis un recook — pas en Lua. |
| Mode édition F3, souris libre, sauvegarde en sortie | **ÉCRIT, JAMAIS VU.** Le serveur charge sans erreur ; le curseur, la caméra au clic droit et l'export en sortie ne sont pas prouvés. |
| La garde de zones refuse-t-elle réellement ? | **ÉCRIT, JAMAIS VU.** 55 assertions sur le modèle pur, aucun refus observé en jeu. |
| `Menottes`, `Cameras` | **câblés, jamais appelés.** |
| Bruits de pas | **ÉCRIT ET CÂBLÉ le 2026-09-10, jamais entendu.** `Catalogs/Pas.lua` (GÉNÉRÉ, 490 clés lues dans le pack), `Logic/Audio.lua` (classification + choix, pur), `Client/Pas.lua` (l'horloge, le raycast, `Sound`). 1 001 assertions + les 490 clés confrontées à `Assets.toml`. Reste à entendre : ce module vit **côté client**, et le journal du serveur ne dit RIEN de lui. `/pas` bascule le diagnostic. |
| ⚠ Les maps portent-elles des matériaux physiques ? | **INCONNU.** Si `SurfaceType` vaut `Default` partout, les pas tombent sur le repli par NOM d'acteur, et de l'herbe sonne sur le béton — sans erreur. `/pas` est fait pour trancher ça en dix secondes de marche. |
| Compagnons (`Animaux`) | **BRANCHE ET CUIT le 2026-09-10.** `Catalogs/Animaux.lua` (GENERE, 41 especes, **41 `cuit = true`**) · `Server/Animaux.lua` (`CharacterSimple`, suivi par `MoveTo`, persistance) · colonne `personnages.animaux` + codec `Roster.EncoderAnimaux` · `/compagnon`. 367 assertions + 41 controles disque. Serveur : 0 erreur Lua avec le pack. **Reste a VOIR** : aucun compagnon n'a jamais ete invoque en jeu. |
| Animations des compagnons | **FAIT le 2026-09-10.** 227 AnimSequence cuites et declarees, reparties sur 39 especes, chacune liee au squelette de SON espece. 37 especes ont un repos identifie ; **hummingbird** et **pigeon** restent figes (leur seul clip est un saut / une attaque — mieux vaut l'immobilite qu'une attaque en boucle). shrimp et seahorse n'ont aucune animation dans le pack. |
| Progression du personnage (niveau, XP, talents) | **BRANCHÉE le 2026-09-14, jamais vue en jeu.** `Logic/Progression.lua` (`Narvos.Progression`, port de PlayerStats/npcLeveling/talentEffects, prouvé contre le TS exécuté : `progression.mjs`, 1 637 assertions) + catalogue GÉNÉRÉ `Catalogs/NiveauxPnj.lua` + exécutant `Server/Progression.lua` (`Narvos.ProgressionServeur` : victoires via `Death` Character ET CharacterSimple, quêtes, `/xp` admin, `Player.Subscribe("Possess")` pose PV max / vitesse / mana) + colonnes `xp`, `talents` + panneau Personnage à onglets (F10 / **F5** `menu_competences`). `TalentsLogic` est désormais APPELÉ. Sorts : coût/régén/dégâts modulés (`Sorts.Moduler`), lanceur passé en `instigator`, cibles `CharacterSimple` incluses. Témoin serveur : `[PROGRESSION] niveaux et talents prets`. |
| ⚠ Sauvegardes à une colonne | **RÉPARÉES le 2026-09-14.** `EnregistrerInventaire/Animaux/Metiers` lisaient `Roster.Base()` (inexistant) : refus à chaque appel, avalé par un `pcall` dont on ne lisait que le booléen. Garde : `pcall-retour-perdu-check.mjs`. |
| `WorldSim`, `Chat`, `Competences`, `GenerateurCartes` | **câblés, jamais appelés.** Quatre systèmes écrits et muets (`Competences` : les sorts réels viennent de `Catalogs/Spells.lua` via `Logic/Sorts.lua`). `Chat` est un cas à part : c'est un port du chat WEB alors que nanos a le sien (`Chat.SendMessage`, déjà employé partout) — le brancher DUPLIQUERAIT le chat. À supprimer plutôt qu'à câbler. |
| Craft par assemblage (pièce par pièce) | **ÉCRIT DE BOUT EN BOUT, JAMAIS VU.** Modèle (`Logic/Assemblage.lua`) + exécutant (`Server/Assemblage.lua`) + catalogue généré (`Catalogs/Plans.lua`, 43 plans) + page WebUI (`UI/assemblage.js`). L'établi est posé au boot — depuis aujourd'hui le journal le DIT (« Ateliers : n/n … ; etabli d'assemblage pose »), il était muet avant. |
| Persistance des zones joueur (maisons achetées) | **NON COMMENCÉE** — `Catalogs/Zones.lua` ne porte que les zones du monde. |
| ⚠ **42 paquets cuits sur 90 jamais références** (1 115 clés) | **MESURÉ le 2026-09-11** par `scripts/narvos-assets-cuits-jamais-appeles.mjs`. Les PNJ sont des Meshy/mannequins, le joueur un corps de base : aucun pack acheté n'atteint l'écran hors des sous-niveaux. Cause : les générateurs lisent le TS du web et filtrent sur Assets.toml — un pack Unreal sans pendant TS est invisible. À faire : `narvos-personnages-to-lua.mjs` sur le patron de `narvos-animaux-to-lua.mjs`. Voir `.hermes/HANDOFF_FABLE_2026-09-11.md`. |
| Defender jamais cuit | **CORRIGÉ dans l'ini le 2026-09-11, cook de nuit** — exclu sur le nom `Demo/` alors que tout le pack y vit. Attendu : 60 SkeletalMesh. |
| Menu de test des armes (touche O) | **ÉCRIT le 2026-09-11, jamais vu.** 24 armes du pack de base GÉNÉRÉES depuis le package officiel. À retirer quand le butin distribuera les armes. |
| ⚠ Lancer le serveur | **`--playtest` OBLIGATOIRE** (payé le 2026-09-11) : sans lui, le client Playtest expire en `5003` et le serveur n'écrit rien. Témoin : `Running Playtest App ID!` dans `Server/.logs/NanosWorldCore.log`. Un seul serveur sur 7777/7778. |
| Marchands joués par des corps de packs | **ÉCRIT le 2026-09-11, jamais vu.** `INCARNATION_MARCHANDS` (`Server/Index.lua`) : Valkiria + CyberpunkSamurai, `Character`, échelle 1 — au lieu des Meshy gris à ×100. `PoserMarchands` choisit désormais `Character`/`CharacterSimple` selon le catalogue (il forçait `CharacterSimple`). Garde : `incarnations-check.mjs`. |
| ⚠ Defender : cuit, squelette MORT | Les SK humains pointent `/Game/Defender/.../SK_MannequinMainUE4M`, disparu à la promotion (cook de nuit : « which does not exist »). Leurs os ⊂ `SKEL_Mannequin` : réassigner dans l'ADK + cook, serveur et client arrêtés. |
| Craft, récolte, radar | **CORRIGÉS le 2026-09-11, jamais vus.** Relais `Narvos:Crafter`/`Narvos:Recolter`, souris des panneaux atelier/gisement, `level` au lieu de `niveau`, `Narvos.Inventory`, 21 appels fiabilisés, touche H. Rapport : `.hermes/AUDIT_INTEGRATION_2026-09-11.md`. |
| Boutique, dialogues, quêtes, équipement | **CASSÉS (audit du 2026-09-11)** : pas d'UI boutique/dialogue, quêtes sans appelant, équipement jamais persisté, butin procédural hors `ITEM_DB`. |
| Pont MetaHuman (panneau U, `/metahumain`, `/mhbp`) | **RETIRÉ le 2026-09-14** (retour de jeu : « plusieurs menus MetaHuman, logique parasite, un seul menu d'équipement »). Il posait des pièces-Blueprints féminines PAR-DESSUS le MetaHuman du joueur (second corps, vêtements non choisis). Supprimés : `Server/MetaHumain.lua`, `UI/metahumain.js/css`, la touche `menu_metahumain`, les commandes. Restent (données/tests) : `Logic/MetaHumain.lua` + `Catalogs/MetaHumain.lua` (`MATERIAU_INVISIBLE` sert au porteur). L'apparence passe par le Meta Customization System, réglé dans l'inventaire (ligne suivante). |
| Apparence MetaHuman EN JEU (un seul menu) | **ÉCRIT le 2026-09-14, jamais vu en jeu.** Inventaire (I) → onglet **APPARENCE**, ou **F8** (`menu_garde_robe` ouvre l'inventaire sur cet onglet). Même éditeur que la création (`UI/mcs-editeur.js`, 9 onglets). Relais `NarvosApparence:Ouvrir/Quitter/Changer(json)/GardeRobe` → `Server/Vestiaire.lua` (`Narvos:Apparence:*`) : `MetaCustomLogic.Normaliser` → `MetaHumainBP.Apparence` (valeur synchronisée) → `Roster.MajMetaCustom` écrit 1,5 s après le dernier geste (ou à la déconnexion). Corps modulaire : bouton vers l'ancienne garde-robe. Caméra : cadrée de face UNE fois à l'entrée de l'onglet (`CadrerApparence`), vue du joueur rendue à la sortie. |
| Défaut d'apparence et parasites | **CORRIGÉS le 2026-09-14.** `MetaCustom.Defaut` ne pose AUCUN vêtement (Jacket/Pants/Boots d'office avant) ; grooms filtrés par GENRE DE LIAISON (`genre` généré depuis le nom de liaison) ; teinte par défaut neutre (s = 0). `ApplyClass` ne pose plus l'accessoire de rôle (casque du tank) sur un corps Blueprint — ni au spawn ni sur un pad de classe. `Narvos:ChoisirClasse` garde le corps choisi (ne refabrique plus un corps de classe). `MetaHumainBP` : `AttachTo(…, lifespan 0)` + `Character.Subscribe("Destroy")` — plus de MetaHuman orphelin superposé. Catalogue MetaCustom régénéré : **148/148 options cuites** (54 avant, catalogue périmé). |
| Porteur des corps MetaHuman | **CHANGÉ le 2026-09-14, jamais vu en jeu** : `nanos-world::SK_Mannequin` (SKEL_Mannequin : `hand_r_socket`, `head_socket`, animations natives) au lieu de `SKM_Manny` de Defender (squelette UE5, sockets `hand_rSocket`…) — cause mesurée de la caméra 1ʳᵉ personne AUX PIEDS et de l'arme posée au sol. Générateur : `PORTEUR_METAHUMAIN` (`narvos-modular-to-lua.mjs`), Defender garde SKM_Manny. En FPS la tête du MetaHuman LOCAL est vidée côté client (`Client/MetaCustom.lua`, `Narvos:VuePremierePersonne`). |
| Effets 3D des sorts | **BRANCHÉS le 2026-09-14, jamais vus en jeu.** Billboards 2D retirés (les images web ne font plus que les ICÔNES, `img/sorts/<id>.png`). `Sorts.EFFETS_3D` : choix sort par sort parmi les particules cuites de NOTRE pack (FXS_Strike, P_Explosion, P_powershield_constant…), rôles lanceur/voyage/impact/zone/aura (attachée, `duree_s`, `echelle`) ; repli par élément sur le pack de base. ⚠ `Vfx.lua` citait les NOMS DE FICHIER du pack de base (`P_ky_fireBall`) : 95 clés sur 173 diffèrent (`P_FXVariety_FireBall`) — aucun effet 3D ne chargeait. Générateur et vérificateur lisent désormais `DefaultAssetPack.toml`. |
| Points de téléportation (intérieurs, toutes maps) | **ÉCRIT le 2026-09-11, jamais vu.** Règles pures `Logic/Teleports.lua` (`Narvos.Teleports`, harnais `teleports.mjs`) + points `Catalogs/Teleports.lua` (`Narvos.TeleportsCatalogue`, ÉCRIT par le jeu via `Export.Catalogue` ET par l'éditeur Unreal, `scripts/adk-menu-narvos.py`, menu NARVOS enregistré par `adk/Content/Python/init_unreal.py`) + exécutant `Server/Teleports.lua` (déclencheur + disque au sol par point, passage revérifié à la distance, édition gardée par `PeutGerer`) + `teleports.js/css` (invite, panneau F6 / `/tp`) ; passer = touche Y. Coordonnées LOCALES au monde. ⚠ Deux écrivains, un fichier : éditer dans Unreal serveur ARRÊTÉ. Témoin : `[TP] n point(s) … poses` au boot. |
| Droits de gestion | **CORRIGÉ le 2026-09-11** : une seule règle `PeutGerer` (commandes_dev OU admin) pour DEV, invocation, véhicules, export F3, armes, TP ; `Session.Ouvrir` applique enfin les droits Steam (4ᵉ voie de connexion oubliée). `commandes_dev = true` (Package.toml) ouvre encore tout à tous — décision ouverte. |
| Marchands : parler, dialoguer, commercer | **ÉCRIT le 2026-09-11, jamais vu.** L'approche n'ouvre plus le dialogue : le serveur ANNONCE (`Narvos:MarchandProche`), la touche **interagir** (Y, qui passe aussi les points de TP) émet `Narvos:DialogueDebut`. Nœuds PRÉSENTÉS par `PresenterNoeud` (choix déjà filtrés : le client renvoie un indice de la liste filtrée). Un nœud qui ouvre la boutique ne se renvoie pas (`boutique_envoyee`). Pages `echanges.js/css` (dialogue + boutique). Quêtes : toujours inertes (`give_quest` non exécuté). |
| Peuplement | **Defender à la place des Meshy ×100 le 2026-09-11** : `PEUPLEMENT_PAR_MONDE` nomme `sk_murdock`, `sk_shadowops`, `sk_wraithlunarops`… ; leur rôle « ennemi » vient du générateur (`ROLES_DEFENDER`, narvos-spawnables-to-lua.mjs). Jamais vu en jeu. |
| ⚠ Builder de pack : Blueprints muets | **CORRIGÉ le 2026-09-11** : `typeParPaquet` gardait la dernière entrée de l'inventaire ; un Blueprint y figure deux fois (asset + `_C`), et 257 BP cuits n'étaient jamais déclarés — dont les 14 porteurs MetaHuman. Témoin : le cook du pont compte les porteurs déclarés. |
| Tenue à 400 joueurs | **RIEN MESURÉ.** |

### Comment on ferme une ligne de ce tableau

Pas avec un harnais vert. **En le faisant tourner et en regardant le journal.**

Et le témoin doit mesurer la question posée : trois fois en une session un témoin
a mesuré autre chose — une ligne de log qui appartenait à une fonction jamais
appelée au boot, un compte de chaîne qui a déclaré « débloqué » sur 88 voitures
STATIQUES, un compteur d'assertions au motif trop étroit.

Avant d'écrire « c'est fait » : *si ça ne marchait pas, ce témoin dirait-il
quelque chose ?*