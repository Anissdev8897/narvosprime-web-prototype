# AUDIT D'INTÉGRATION — 24 packs + nos systèmes (2026-09-11)

Demande de Hanibes : « ne te contente pas de vérifier que les assets sont présents.
Vérifie qu'ils sont branchés, utilisés par nos systèmes et pris en compte dans le Cook.
Réutilise notre architecture. » Six audits en lecture seule (5 sur Fable 5, véhicules
sur Sonnet après la limite Fable), synthèse et correctifs par Opus 5.

**La contrainte qui décide de tout** (skill nanos-world §0, §17) : aucun plugin C++
tiers ne tourne dans nanos ; un Blueprint se spawne mais `Character` ne traverse pas le
pont Lua↔BP ; pas d'AIController, de Behavior Tree ni d'AttributeSet pilotables ; UI =
WebUI. Donc « intégrer un système Blueprint » = **récolter ses assets** et **porter sa
logique dans nos modules Lua**, jamais le faire tourner tel quel.

---

## 0. Corrigé aujourd'hui, sans cook — à TESTER (serveur relancé avec `--playtest`)

| cassure (audit) | cause | correctif |
|---|---|---|
| clic sur une recette sans effet | `ateliers.js` émet `Narvos:Crafter` par son helper `Lua()` ; aucun relais `Page("hud", …)` | relais ajouté, `Client/Index.lua` |
| panneau d'atelier non cliquable | `#atelier` hors `PANNEAUX`, souris jamais rendue | ouverture/fermeture par `Basculer` (patron de l'établi) + `PANNEAUX` |
| toutes les recettes refusées | serveur lit `s.perso.niveau` ; le personnage porte `level` | 5 lectures corrigées (craft, gisement, rendement, dialogues) |
| gisement : handler qui lève | `Inventory.` nu (local à Logic) | `Narvos.Inventory.` ×5 |
| bouton « Récolter » sans effet ; panneau qui reste | même helper `Lua()` ; aucun message à la sortie de zone | relais + `Narvos:Gisement false` à la sortie |
| raisons d'erreur jamais affichées | 21 `CallRemote` serveur sans fiabilité : le message passait en 3ᵉ argument (fiabilité) | `Reliability.Reliable` inséré ; garde `appels-distants-check.mjs` |
| stats de combat d'une classe inconnue | `perso.class_id`/`niveau` (Combat), `s.personnage` (Sorts) | `classId`/`level`/`s.perso` |
| radar injoignable | `menu_radar` absent de `Commandes.ACTIONS` | touche **H** |
| garde vert, défaut présent | `ui-liens.mjs` ne cherchait que `Events.Call("` | motif élargi à `Lua("` |

Marchands : 7 corps de packs texturés (Valkiria, Samurai ×2, Troopers M/F casque ou
tête nue) au lieu des Meshy gris ×100 — **jamais vus en jeu**.
Batterie : 66 harnais · 6 886 assertions · 0 rouge.

## 1. Encore cassé dans nos systèmes (audit, non corrigé)

- **Butin procédural mort-né** : `Loot.RollLoot` tire à 50 % un `gen_*` hors `ITEM_DB`
  → affiché par son id, refusé par la roue, invendable (`Loot.lua:337`, `Inventory.lua:494`).
- **Boutique et dialogues sans client** : le serveur envoie `Narvos:Boutique`/`Dialogue*`,
  aucun abonné ; `/acheter` au chat seulement.
- **Quêtes inertes** (`Quetes.Accepter` sans appelant, état en mémoire, XP ajoutée au NIVEAU).
- **Équipement jamais persisté** (`EnregistrerSac` écrit `equipment = {}`).
- **Compétences/Talents** câblés, jamais appelés ; `niveau` jamais mis à jour.
- **Outils de récolte inatteignables** (pioche/foreuse/collecteur dans aucun loot ni stock).
- **Tout le mobilier est à la Forge** (ateliers, établi, coffres, gisements, marchands).
- Inventaire WebUI = liste en lecture seule (ni grille, ni glisser-déposer, ni action).

## 2. Les 24 packs — verdicts mesurés

| pack | nature | dans le cook ? | verdict |
|---|---|---|---|
| Hyper Inventory V2 | BP pur 5.1, 11 Go | non | **C** logique à porter + **A** assets (233 icônes, stations, ressources) |
| Survival Crafting System | BP 4.21 | non | ignorer (concepts seulement) |
| Survival Crafting Stations | BP+meshes 4.26 | non | **A** meshes des stations + 27 stations animées |
| Crystals & Crafting Env. | décor 5.2, textures 8K | non | **A** (plafonner 2048) — gisements, décor, VFX |
| Farming And Mining | anims+outils **4.15**, UE4 Mannequin | non | **A** (anims pioche/houe, outils) |
| Hyper Skill Level Manager v2 | BP 5.1 | non | **C** → `Logic/Metiers.lua` (28 métiers, XP) ; ne pas stager (collision `Content/Hyper`) |
| Crafting Animations | 45 anims **4.20** UE4 Mannequin | non | **A** (forge, minage, alchimie, cuisine) |
| AI Behavior System | BP 5.1 | non | **C** (roaming, strafe, tir, compagnon) + **A** 66 anims, 18 sons |
| AIBehaviorToolkit 5.6 | BP pur, le plus riche | non | **C** : enquête, sonné, alerte, coordination de groupe, modes de patrouille |
| AdvancedGASSystem | **C++** | non | **C** (formules, pénétration, endurance) + A mineur (chiffres de dégâts) |
| Enhanced AI Movement | **C++** | non | **D** |
| Freeflow Combat v2.6 | BP + 118 anims | **cuit mais mort** : squelette exclu du cook | **A** (retarget) + **C** fenêtres de combo réelles |
| SmartLocomotion | BP + blend spaces | anims **exclues** (refs cassées) | **A** blend spaces + roulade |
| Procedural Weapon Anim | FPS, bras Manny | 3 clés mortes | **D** (NeverCook) |
| Ako Minimap | BP/UMG 5.2 | non | **C** → étendre notre radar WebUI |
| Security Camera Vol 01 | FBX 4K | non | **D** ; meshes Defender déjà cuits → écrire l'exécutant de `Cameras.lua` |
| SciFi Plantation Lab | DAZ | non | **D** faible valeur |
| Brendonrise 89 | 1 .blend + desirefx | non | **écarter** |
| Quarantine Medical Tent | 4.26, 121 SM | non | **A** — catégorie décor « medical » |
| Modern Tanks (3D print) | STL, **CC-BY-NC** | non | **ne pas utiliser** (licence) |
| 20x Vehicles Pack 2 | DCC, 7/17 desirefx | non | **D** / écarter |
| Ridable Motor Bikes (+Pack 3 = même) | 4.26, 3 motos + police | non | **A** — os = convention `digital_dive_moto` déjà écrite dans `OsVehicules.lua` |
| Drivable Cars Basic | 5.4, doublon, desirefx | non | ne pas importer |
| Crafting Animations | (voir plus haut) | | |

**Constat transversal n°1 — « cuit n'est pas vivant ».** Defender (60 SK), Freeflow
(118 anims), SmartLocomotion : leurs références pointent les anciens chemins d'avant la
promotion. Journal du cook de nuit : « which does not exist ». La réparation de squelette
par Python est impossible (`SkeletalMesh.skeleton` [Read-Only], aucun setter en 5.7).
Voie à prouver sur UN mesh : refaire exister le squelette à l'ancien chemin, recharger,
puis consolider vers `SKEL_Mannequin` ; pour les anims : `duplicate_and_retarget`
(`scripts/adk-retarget-anims.py`, 1 374/1 374 réussies).

**Constat n°2** : `Catalogs/Animations.lua` est périmé (3 216 noms contre 3 480 cuits).

## 3. Plan ordonné

1. **Tester les correctifs §0** en jeu (serveur `--playtest`) : craft, récolte, radar H, erreurs affichées.
2. **Prouver `VehicleWheeled`** avec `/vehicule` sur une voiture City_Traffic_Pro : prérequis de tout pack véhicule.
3. **Squelettes** : essai de consolidation sur SK_Hero (éditeur, sauvegarde du dossier avant) → Defender, Freeflow, SmartLocomotion → **un seul cook** (jeu + éditeur fermés).
4. **Économie** (réutiliser nos modules) : file de craft temporisée, `Logic/Metiers.lua` + XP, vendeurs (restock, bourse), coffres par liste, butin procédural réparé ou retiré, boutique WebUI, grille d'inventaire + glisser-déposer. Puis récolte d'assets : icônes Hyper, meshes de stations, cristaux, outils, anims métiers → cook.
5. **IA** : porter enquête / sonné / alerte / coordination / tireur dans `Ia.lua` (étendre, pas recopier).
6. **Combat** : Freeflow retargeté + fenêtres réelles ; régénérer `Animations.lua`.
7. **Décor** : Quarantine tent ; catégories CITY_PACK (675) et OpenWorlds (348) dans `narvos-pack-props-to-lua.mjs` ; exécutant des caméras de sécurité.
8. **Minimap** : bornes et fond de carte par monde dans le radar WebUI.
9. **Motos** : migrer, vider les corps de roues, `MOTOS_NANOS` + `Server/Motos.lua`.

## 4. Licences à trancher par Hanibes

Desirefx/Telegram : Brendonrise, Quarantine Tent (fichiers dans Materials/Masters),
20x Vehicles (7/17), Drivable Cars, AI Behavior System, Enhanced AI Movement.
CC-BY-NC : Modern Tanks. DAZ : Interactive License requise. Aucune preuve d'achat lue sur
disque pour les 24. **Porter une logique en Lua ne pose pas ce problème ; distribuer des
assets dans le pack client, si.**

## 5. Squelettes réparés — 2026-09-11, 17:40-18:03 (Opus 5)

Méthode : `scripts/adk-reparer-squelettes-promus.py` (duplicata des miroirs aux anciens
chemins, `consolidate_assets`, squelette humain consolidé vers `SKEL_Mannequin`) puis
`scripts/adk-recharger-et-resauver.py` (rechargement des paquets empoisonnés par une sonde,
resauvegarde). Sauvegarde préalable : `adk/_sauvegardes/2026-09-11_squelettes/` (2,8 Go).

Preuve SUR DISQUE (table de noms des .uasset) :
- Defender : **33/33** maillages humains nomment `SKEL_Mannequin`, 0 porte `/Game/Defender/` ;
  SK_Hero pointe son asset physique promu.
- Freeflow : **118/118** animations nomment `SKEL_Mannequin`, 0 le squelette stagé non cuit.
- Générateur de Spawnables (à blanc) : **12 personnages Defender** retenus sur leur nature
  (dossier Characters + `.uasset` sur le squelette nanos), 0 en attente.

Cook lancé à 18:03 : `.hermes/cook_squelettes_2026-09-11.sh` (témoin SK_Hero CUIT, catalogues
régénérés, batterie). **Reste à VOIR en jeu** : un personnage Defender au menu de spawn, et
une animation Freeflow jouée par `PlayAnimation`. SmartLocomotion n'est PAS traité (exclusions
de `DefaultGame.ini` à revoir dossier par dossier).

Résultat du cook (chaîne terminée à 18:49) : « Packages Remain 0 » (31 min), SK_Hero CUIT
nomme `SKEL_Mannequin`, générateur : **12 personnages Defender** au menu de spawn, batterie
66 harnais · 6 910 assertions · 0 rouge.

## 6. Pont MetaHuman (Meta Customization System) — 2026-09-11 soir, ÉCRIT, jamais vu

1. **MetaCustom rapatrié** : les assets promus nommaient le pack stagé (NeverCook), soit
   407 imports, dont 380 avec un jumeau promu. `scripts/adk-rapatrier-metacustom.py`
   (`consolidate_assets` stagé → jumeau, par lots, squelettes d'abord). Sauvegarde :
   `adk/_sauvegardes/2026-09-11_metacustom/` (12 Go, 2 719 fichiers). ⚠ consolidate ne
   patche que les référents CHARGÉS : les autres passent par un redirecteur, d'où
   `adk-recharger-et-resauver.py` ensuite, puis une preuve sur disque.
2. **Retarget** (`scripts/adk-pont-metahuman.py`) : IK_NanosMannequin (20 chaînes) →
   IK_NarvosMetaHuman (28), RTG_NanosVersMetaHuman (6 opérations, EXACT 20/28 : les 8
   Metacarpal restent sans source), ABP_NanosVersMetaHuman (2 nœuds RetargetPoseFromMesh
   en PARENT, squelette cible = Skel_Dummy PROMU), **14 porteurs** `BP_NarvosMH_*`
   (racine = maillage + ABP, sans graphe), manifeste `adk/_pont-metahuman.json`.
3. **Lua** : `Logic/MetaHumain.lua` (règles pures), `Catalogs/MetaHumain.lua` (GÉNÉRÉ,
   `narvos-metahumain-to-lua.mjs`), `Server/MetaHumain.lua` (Blueprint attaché à l'os
   `root`, porteur caché par `Mat_Invisible`), `/metahumain`, événements `Narvos:MetaHumain*`.
   Harnais `metahumain.mjs` : 112 assertions. Batterie : 67 harnais · 7 023 · 0 rouge.
4. **Cook** : `.hermes/cook_pont_metahuman_2026-09-11.sh` (éditeur fermé) — témoins :
   18 fichiers cuits du pont, 14 porteurs déclarés, corps cuit nommant Skel_Dummy promu,
   pièces posables au catalogue.
5. **Reste** : 13 pièces Metawadrobe sur `metahuman_base_skel` (2ᵉ ABP), aucun corps
   masculin sur Skel_Dummy, persistance de la tenue, masques de peau sous les vêtements.