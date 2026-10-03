# ASSETS vs OBJECTIFS RP — ce qu'on a, ce qui manque, quoi décider

> ## ⚠ CORRECTION — lire avant le §3 « MANQUES »
>
> Vérifié le 2026-09-09 par Claude, mesures ci-dessous reproductibles. **Le texte
> d'origine est conservé intact** ; cette note dit seulement ce qui ne tient pas.
>
> **Une erreur systématique traverse le rapport : le pack `asset_game/…/Metaverse
> Futuristic Sci-Fi City` — le « joker » de la décision n°2 — EST `CITY_PACK`.
> Il est déjà cuit, déjà dans le jeu : c'est la capitale.**
>
> La preuve tient en une ligne. Chemin source du pack :
> `Content/CITY_PACK/BIG_CITY/MESHES/SM_Atm_Cube.uasset`
> Clé cuite dans `Assets.toml` :
> `SM_Atm_Cube = "Narvos/CITY_PACK/BIG_CITY/MESHES/SM_Atm_Cube"`
> Même pack, même arborescence, même asset. Décompte : **1 575 clés `Narvos/CITY_PACK/`
> dans le toml** (BIG_CITY 444, INTERIORS 1 034, DECALS 97 ; DEMO 0/99, exclu à dessein).
>
> ### Ce que cela annule
>
> | § | Manque déclaré | Réalité mesurée |
> |---|---|---|
> | 3 | « Drone quadricoptère — 0 asset » | **CUIT** : `SM_DRAGONFLY_body`, `SM_DRAGONFLY_wing_1`, `SM_DRAGONFLY_wing_2`, `M_DRAGONFLY` (`CITY_PACK/INTERIORS/LIBRARY/MESHES/ROBOTS/`), plus `SM_LANDFLY_BODY` / `SM_LANDFLY_WING` |
> | 5 | « Vraie ATM — MANQUANT en cuit » | **CUIT** : `SM_Atm_Cube` et `SM_Atm_Cube_003`, dans `BIG_CITY/MESHES` — pas dans un dossier de planète. C'est l'asset même que le rapport désigne comme la conversion à faire |
> | 8 | « Raffinerie / usine — GENERATOR_ROOM seul » | **133 clés** `refinery\|SM_FACTORY\|INDUSTRIAL` déjà dans le toml |
> | Décision 2 | « le joker … un seul chantier de conversion lève 4 des 5 manques » | Chantier **déjà fait**. Rien à convertir de ce pack |
>
> ### Pourquoi l'erreur est passée
>
> Les manques ont été cherchés par MOT ANGLAIS (`atm`, `drone`, `factory`) au lieu du
> NOM RÉEL de l'asset. Ce pack appelle son drone `DRAGONFLY` et son distributeur
> `Atm_Cube` : `grep drone` ne rend que des enceintes DJ, et `grep atm` ne rend que de
> l'*atmosphere* — deux conclusions justes sur la requête, fausses sur le monde. Le
> rapport avait pourtant les bons noms en main : il les cite comme cibles de conversion,
> sans les avoir cherchés dans le toml.
>
> C'est la règle déjà payée ailleurs sur ce projet : **juger sur la nature et le chemin,
> jamais sur le nom** — et son corollaire, une ABSENCE se prouve avec le vocabulaire du
> pack, pas avec le sien.
>
> ### Ce qui TIENT, vérifié
>
> - **Manque n°1 — aucun véhicule terrestre pilotable.** Confirmé et c'est le vrai n°1 :
>   `0` entrée de `[assets.skeletal_meshes]` contenant `car|vehic|bus|truck|wheel`.
>   Nuance à connaître : la capitale a bien un `SM_BUS` cuit (+ 4 `MI_BUS_*`), une station
>   de bus, des autoroutes et une gare — mais ce sont des **StaticMesh de décor**, pas des
>   `VehicleWheeled`.
> - **Manque n°6 — objet de communication tenu en main.** Confirmé : les 111 hits `phone`
>   sont des `raptor_microphones` de `tower_map` (Halo).
> - **Manque n°10 — caméra de surveillance cuite.** Confirmé : `SM_CCTV` = 0, et le seul
>   hit `camera` est `AC_Camera`, un ActorComponent de SmartLocomotion.
> - Badges Defender : confirmé, `SecurityClearance` = **0** dans le toml.
> - `SM_AIRCAB` / `SM_AIRCAB_PORT` / `SM_AIRCAB_AREA_GROUND`, `SK_Male_Police_Armor_Army`,
>   `Inst_Police_Armor3`, `SM_Cop_Hat`, 279 refs `HOSPITAL` : tous confirmés cuits.
>
> ### Sur le §5 (garde `cuit = false`)
>
> Exact, y compris la nuance du mauvais témoin `BIG_CITY_NIGHT_1` — qu'il reprend
> correctement de mon propre commentaire. Sa dernière incertitude (« praticabilité
> effective non confirmée, harnais non relancé ») est levée : `voyage.mjs` **131/131**,
> six points de départ mesurés, capitale et Sylve comprises. Et le passage a révélé deux
> défauts que ce rapport ne pouvait pas voir, tous deux corrigés :
> `VoyageServeur.Charger` ignorait `decor_persistant` (portail affiché, voyage refusé),
> et la forêt n'avait **aucune liaison** — déclarée, praticable, injoignable.
>
> Sur sa question ouverte : **conserver le mécanisme dormant** de `Voyage.lua`. Il est
> inerte tant qu'aucun monde ne porte le champ, et il est placé AVANT la décision — la
> seule position où un garde garde quelque chose.

Date : 2026-09-08/09 · Auteur : Kimi (sous-agent de synthèse — aucun code modifié).
Roadmap de référence : `C:\Users\aniss\OneDrive\Bureau\objetic_gameplay.txt` (541 lignes,
15 sections, 6 phases — lue en entier).
Sources d'assets, lues en entier :

- [INVENTAIRE_GLB_RP.md](INVENTAIRE_GLB_RP.md) — le gisement GLB : `models/` = 10 323 GLB ;
  `asset_game/` = 0 GLB, 41 060 `.uasset` (dont le joker « Metaverse Futuristic Sci-Fi City »,
  3 281 uasset : ATM + hôpital + drones + usine).
- [INVENTAIRE_ADK_RP.md](INVENTAIRE_ADK_RP.md) — l'ADK (~102 000 uasset source) et le pack
  cuit (`WebPortal/Server/Assets/narvos/Assets.toml`, 67 406 lignes, régénéré le 2026-09-09 17:19).

Greps de témoin **re-faits par moi dans ce tour** (pas recopiés) :

```
$ grep -c BIG_CITY_NIGHT_1 WebPortal/Server/Assets/narvos/Assets.toml   → 1
$ grep -c ForestKitONE     WebPortal/Server/Assets/narvos/Assets.toml   → 2
$ wc -l                    WebPortal/Server/Assets/narvos/Assets.toml   → 67406
```

Contexte systèmes déjà branchés : [HANDOFF_CLAUDE_2026-09-09.md](HANDOFF_CLAUDE_2026-09-09.md),
[VEHICULES_VOLANTS_DECISION.md](VEHICULES_VOLANTS_DECISION.md),
[SELECTION_ASSETS.md](SELECTION_ASSETS.md).

Légende des verdicts : **PRÊT** = asset cuit ou GLB utilisable tel quel · **ADAPTABLE** =
asset réel mais à détourner/convertir · **À CUIRE** = la source existe (ADK/uasset/GLB
propre), il manque le passage dans le pack cuit · **MANQUANT** = rien de plausible dans
aucun gisement · **HORS MOTEUR** = le blocage n'est pas un problème d'assets (logique Lua,
limite de l'API nanos, ou décision déjà actée).

---

## 1. Résumé exécutif

**NARVOS peut, avec ses seuls assets actuels, faire tourner dès aujourd'hui le décor
complet d'un RP futuriste** : une capitale cuite et posée dans le niveau persistant
(13 490 acteurs CITY_PACK, `Map_Narvos.umap` cuit le 2026-09-09 14:06), une forêt en
sous-niveau (`ForestKitONE`, cuit le même jour), une station orbitale (`Map_Orbital` +
~53 000 refs de chunks Halo), un **hôpital complet** (map + 102 meshes médicaux), un
**aéroport/terminal de contrôle** (scanners X-ray, robots assistants, portiques), un
**taxi volant** (`SM_AIRCAB` + son port), une armurerie (`WEAPON_CENTER`), une salle de
générateurs, et — fait rare — **toute la couche d'animations sociales RP déjà cuite** :
discussions marchand accept/refuse (BlacksmithAnimations, 88), fouille de sac
(Loot_Anim_Set, 207), 223 idles civils, signes de main radio (253 entrées). Ajoutez
l'armure de police cuite (`SK_Male_Police_Armor_Army`) et 8 marchands déjà posés et
fonctionnels (harnais boutique 44/44, HANDOFF §1) : **les phases 2 et 3 de la roadmap
ont déjà leur décor et leurs gestes. Ce qui leur manque n'est presque jamais un mesh —
c'est la logique Lua (persistance, argent, métiers, missions) et quelques cooks ciblés.**

Les vrais trous d'assets se comptent sur une main : **aucun véhicule terrestre pilotable
cuit** (le seul candidat propre, `vehicule_terrestre.glb`, n'est pas converti ; les 13
voitures de City_Traffic_Pro attendent dans l'ADK), **aucun drone** (les 3 hits « drone »
du pack cuit sont des enceintes DJ), **aucun minerai/cristal récoltable cuit** (les
gisements propres de TropicalAlienWorld ne sont pas cuisinés), **aucun PNJ civil clé en
main** (MetaCustom n'est que partiellement cuit), **aucune vraie ATM** (les 10 hits
« atm » du toml sont de l'*atmosphere*). Le spatial et l'aérien **pilotés** ne sont pas
un manque d'assets mais une limite moteur nanos déjà tranchée : la voie (b) est
recommandée dans VEHICULES_VOLANTS_DECISION — le vol personnage `SetFlyingMode` ×40
couvre déjà la boucle orbitale en production.

**Les 3 décisions à prendre :**

1. **Lancer le chantier véhicule à roues** : conversion SkeletalMesh de
   `vehicule_terrestre.glb` (4 nœuds de roues nommés, JPG source sur disque,
   SELECTION_ASSETS §1) **et/ou** cook des 13 voitures squelettiques de City_Traffic_Pro
   (587 uasset ADK, `Car_Skeleton` partagé) — avec le repli immédiat des 10 véhicules du
   pack de base Steam (HANDOFF §5.6). C'est LE déblocage de la phase 2 (véhicules
   persistants, garage) et d'une partie de la phase 3 (convois, police).
2. **Ouvrir une passe de cook « ADK précieux »** sur les 6 packs identifiés :
   City_Traffic_Pro (587), Spaceship Pack 1 (141), **Defender (2 276 — les badges
   d'accréditation Lvl1/2/3, seuls assets « permis/badge » de tout le parc)**,
   Metahuman_Customization (2 193 — les civils en masse), DMD (909 — tourelles/défenses),
   AdvancedARPGCombat (2 653). Plus, en route `.uasset` avec rebranchement, le joker
   Metaverse d'`asset_game/` (ATM `SM_Atm_Cube`, drones `SM_DRAGONFLY_*`, 149 uasset
   d'usine/raffinerie, hôpital 511 uasset pour le prototype web).
3. **Acter formellement les deux décisions déjà prises de fait** : (a) le garde
   `cuit = false` de `Voyage.MondePraticable` — **déjà retiré des données le 2026-09-09**
   (voir §5 : il ne reste qu'un mécanisme dormant à conserver ou supprimer) ; (b) la
   voie (b) véhicules volants de VEHICULES_VOLANTS_DECISION, qui conditionne tout le
   catalogue véhicules de la roadmap §4.

---

## 2. Phase par phase

### PHASE 1 — Stabiliser le moteur (cook, World Partition, imports, véhicules, Map_Narvos)

Renvoi aux documents existants, rien à réinventer :

- Cook : **terminé pour la ville et la forêt** — voir §5 (greps re-faits : BIG_CITY_NIGHT_1
  = 1, ForestKitONE = 2, toml régénéré 17:19).
- Imports et choix d'assets mesurés : SELECTION_ASSETS (véhicule, inventaire, craft,
  minerais, modulaire, ville — 6 recommandations chiffrées).
- Véhicules : VEHICULES_NANOS (0 mesh cuit, 19 entrées triées) et VEHICULES_VOLANTS_DECISION
  (voie b recommandée, diff prêt non appliqué).
- État des 7 tâches de branchement et contrôles verts : HANDOFF_CLAUDE_2026-09-09.
- Points ouverts connus (pas des assets) : 74 références de stock mortes chez les marchands,
  `iconFile` non consommé côté client, widgets UMG non cuits (0 UserWidget dans le pack).

### PHASE 2 — Fondations RP (persistance, argent, métiers, factions, propriétés, véhicules, inventaire, craft, récolte, construction)

| Système roadmap | Verdict | Asset(s) concret(s) | Ce qui manque |
|---|---|---|---|
| 10. Persistance serveur | **HORS MOTEUR** | — | 0 % assets : logique Lua de sauvegarde (compte → personnage → monde). Priorité n°1 de la roadmap, aucun mesh n'y changera rien. |
| 11. Argent / banque / ATM | **ADAPTABLE** | Cuit : distributeurs `SM_Vending_machine_export_Cube_001` / `_Plane_002` + `MI_Vending`, `SM_GUMBALL_MACHINE` (TERMINAL), consoles `SM_CONTROL_DESK` (GENERATOR_ROOM) ; GLB : façade de banque `models/vehicules/Voyager/…/NYC_Midtown5/StaticMesh/SM_BankSet_Corner01/03.glb`, `SM_BankSet_Tiling01/03.glb` | Vraie ATM : **MANQUANT en cuit** (les 10 hits « atm » du toml sont `SM_Atm_Cube` = *atmosphere*). Source réelle : `asset_game/…/Metaverse Futuristic Sci-Fi City/SM_Atm_Cube.uasset` (route .uasset). À court terme : détourner une vending machine cuite en borne bancaire. |
| 12. Métiers / professions | **ADAPTABLE** | Stations réelles : forge `models/nature/forge_outils` (6/6 Blender, enclume/chaîne/soufflet — SELECTION_ASSETS §3), établis `Post_Apocalyptic/SM_workbench.glb` (85 Mo VRAM) + `SM_cloth_workbench.glb` (64 Mo) ; anims métier cuites : BlacksmithAnimations (88), MC_Village_Life en uasset | Le système (grades, salaires) est Lua. Stations de craft futuristes : `animation_craf/Survival Crafting System` (`SM_AdvancedCookingStation_*`, `SM_ChemistryStation_*`, route .uasset). |
| 13. Factions | **ADAPTABLE / À CUIRE** | Cuit : armure police `SK_Male_Police_Armor_Army` + `Inst_Police_Armor3/4/5`, `SM_Cop_Hat`, PNJ soldats `Narvos/pnj/soldat_*`, `mercenaire_*` (219 refs), WEAPON_CENTER (armurerie complète) | **Badges/uniformes d'accréditation : À CUIRE** — Defender `BP_LootSecurityClearanceLvl1/2/3` (ADK, 0 ref toml). Hiérarchie/territoire/coffre : Lua. |
| 14. Propriétés (maisons, portes verrouillables) | **ADAPTABLE** | Cuit : appartement meublé SCI_FI_APARTMENT, portes des INTERIORS (1 568 refs « door ») ; GLB : portes sci-fi `High_Tech_Base/SM_Door_01/02(+_Frame)`, `SciFi_Space_Station/SM_Space_Station_door1_2x2`, clavier `SciFiWorld/SM_KeyPanel01.glb` | Logique propriétaire/verrou : Lua. Aucun asset bloquant. |
| 15. Véhicules persistants (achat, garage, dégâts) | **À CUIRE** | Candidat choisi et mesuré : `models/vehicule/vehicule_terrestre.glb` (0 WorldGridMaterial, 4 nœuds roues nommés, 63,8 Mo VRAM, JPG source — SELECTION_ASSETS §1) ; ADK : City_Traffic_Pro, 13 voitures squelettiques sur `Car_Skeleton` partagé (587 uasset) | **Aucun SkeletalMesh de véhicule cuit aujourd'hui** (VEHICULES_NANOS : les 46 hits « vehicle » du toml sont des chunks de décor Halo). Repli immédiat : les 10 véhicules du pack de base Steam (HANDOFF §5.6). Conversion static→squelette non chiffrée (risque n°1). |
| 16. Inventaire définitif | **ADAPTABLE (UI, pas assets)** | Maquette mesurée : Inventory System Pro by Moonville, 81 WBP + 13 DataTables (SELECTION_ASSETS §2) | 0 UserWidget cuit (UI_UMG_CONTRAT) ; les 9 panneaux HTML actuels sont à GARDER. `Inventory.lua` (1 021 lignes, persisté, testé) reste la logique — on copie la présentation, pas le moteur. |
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
### PHASE 3 — Monde vivant (PNJ, missions, événements, commerces, entreprises, territoires, économie)
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
### PHASE 4 — Futuriste (implants, drones, scanners, piratage, électronique, stations, spatial, ressources rares)
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
### PHASE 5 — RP profond (téléphone, radio, identité, permis, justice, médecine, police, administration)
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
### PHASE 6 — Scalabilité (50 → 400 joueurs, optimisations)
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
## 3. Les MANQUES consolidés, par impact (dédupliqués, GLB + ADK croisés)

| # | Manque exact | Systèmes bloqués | Alternative éventuelle |
|--:|---|---|---|
| 1 | **Véhicule terrestre pilotable cuit** — 0 SkeletalMesh de véhicule dans Assets.toml (les 46 hits « vehicle » sont des chunks Halo ; VEHICULES_NANOS) | Phase 2.15 (véhicules persistants, garage), 3.22 (convois), 5.42 (véhicules de police/faction), roadmap §4 entière | `vehicule_terrestre.glb` à convertir (roues nommées, JPG source — SELECTION_ASSETS §1) ; City_Traffic_Pro 13 voitures à cuire (ADK, 587) ; repli : 10 véhicules du pack Steam de base |
| 2 | **PNJ civils clé en main** — 0 civil/ouvrier/médecin/scientifique/policier habillé en GLB (0 hit sur 10 323 GLB) ; cuit = vêtements MetaCustom seuls | Phase 3.20 (monde vivant entier), 5.41 (médecins), 5.42 (policiers), métiers 2.12 | À CUIRE : Metahuman_Customization_System (2 193 ADK) + MetaHumans (365) ; assembler civils depuis MetaCustom cuit (136 refs) + 223 idles |
| 3 | **Drone quadricoptère** — 0 asset : les 3 hits « drone » du toml sont des enceintes DJ (`SM_Sound_Drone2_small_speaker_*`) ; GLB : 2 × le même `Enemy_EyeDrone.glb` | Phase 4.28 (drones reco/transport/militaires, caméra drone) | Convertir Metaverse `SM_DRAGONFLY_*`, `SM_Flyer`, `SM_LANDFLY_*` (.uasset) ; extraire meshes Defender `BP_TurretCompanion` |
| 4 | **Minerais / cristaux récoltables cuits** — grep `ore`/`crystal`/`mineral`/`gem` dans le toml : que des chunks forerunner et des sons de pas ; le pack RPG Engine attendu est 16/16 WorldGridMaterial (écarté mesuré) | Phase 2.18 (récolte), 3.26 (chaîne économique ressource→usine), 4.34 (ressources rares) | À CUIRE : TropicalAlienWorld (`SM_cave_cristals`, `SM_lifeform1`, `SM_rockFormation1..5`, 0 WGM — SELECTION_ASSETS §4) + KDRN `Rocks_Ores_Stick.glb` en marqueur léger |
| 5 | **Vraie ATM / borne bancaire** — les 10 hits « atm » du toml sont `SM_Atm_Cube` = *atmosphere* ; 0 ATM GLB prêt | Phase 2.11 (banque, compte, carte), économie joueur | Convertir `asset_game/…/Metaverse/SM_Atm_Cube.uasset` (+ `SM_CURVED_BANK.uasset`) ; à court terme détourner `SM_Vending_machine_export_*` cuit |
| 6 | **Objet de communication tenu en main** — 0 smartphone/talkie en GLB, uasset ou cuit (cherché `phone\|radio\|walkie\|handset\|cell` sur les trois gisements) | Phase 5.36/37 (téléphone, radio — « quasi indispensable » d'après la roadmap) | Anims et cabines déjà là ; le prop tenu peut être un petit mesh générique à modéliser — ou accepter une radio « HUD seul » |
| 7 | **Kit de construction fondations/murs/toits à snap dédié** — les 22 hits « foundation » sont des props halo_map ; les 3 889 refs « wall » sont des bâtiments finis | Phase 2.19 (construction joueur, roadmap §5 : « un des systèmes centraux ») | Kits Mars_Sanctuary (186 refs) + Megastructure (58) cuits, kits GLB SciFiWorld/High_Tech_Base/Post_Apocalyptic à cuire ; le snap reste Lua |
| 8 | **Raffinerie / usine futuriste clé en main** — GLB : 17 hits `factory\|refinery\|industrial\|conveyor\|reactor` presque tous tourelles ; cuit : GENERATOR_ROOM seul | Phase 3.26 (transformation), 2.12 (machines industrielles) | Metaverse : **149 uasset** `refinery\|factory\|industrial\|generator` à convertir ; GENERATOR_ROOM cuit (`SM_GENERATOR_2`, `SM_BATTERY`, `SM_CONTROL_DESK`) en attendant |
| 9 | **Agriculture futuriste** — 0 hydroponie/serre/tracteur (`hydropon\|greenhouse\|tractor` : 0 GLB, 0 uasset) ; cuit : 0 culture (« farm » = noms humoristiques de chunks) | Phase 2/3 (récolte, nourriture, survie §10) | GLB maïs `nature/VOL15_Corn` (23 meshes) + outils `Farming And Mining Pack` (166 uasset) ; hydroponie détournée : capsules `SciFiWorld/SM_LabCapsule08_*` ; plantes OpenWorlds cuites |
| 10 | **Petits trous ciblés** : mesh caméra de surveillance cuit (GLB existe : `SM_CCTVCameras_*`, `SM_Security_Camera_*`) · scanner biométrique/lecteur de badge (0 GLB) · commissariat + menottes (0 hit) · ordinateur « hero » cuit · épave « hero » scénarisée | Phase 4.29/31 (caméras, accès biométrique), 5.40/42 (justice, police) | Cuire les GLB caméras ; badges Defender (À CUIRE) couvrent l'accès ; commissariat : assembler avec kit modulaire + mobilier cuit |

Note de déduplication : « hôpital GLB manquant » n'est PAS dans la liste — tranché ci-dessous.
« Véhicules aériens/spatiaux pilotables » n'y est pas non plus : HORS MOTEUR, décision
voie (b) (VEHICULES_VOLANTS_DECISION).

**Divergences GLB ↔ ADK tranchées :**

- **Hôpital** : MANQUE en GLB (0 mesh médical sur 10 323) mais **EXISTE cuit** (map + 102
  meshes). *Tranché : le pack cuit gagne — nanos est la cible ; la boucle médecine est
  jouable côté décor aujourd'hui.* Le manque GLB ne concerne que le prototype web, et
  Metaverse (511 uasset HOSPITAL) est là si le web doit être aligné.
- **ATM** : les deux inventaires disent vrai sur des gisements différents — le *vrai*
  `SM_Atm_Cube.uasset` est dans `asset_game/` (Metaverse), les `SM_Atm_Cube` du toml sont
  de l'atmosphere. *Tranché : pas d'ATM utilisable aujourd'hui ; conversion Metaverse.*
- **Agriculture** : du maïs existe en GLB web, rien en cuit. *Tranché : MANQUANT pour
  nanos (cible), PRÊT pour le prototype web.*
- **Minerais** : propres en GLB (TropicalAlienWorld), absents du cuit. *Tranché : À CUIRE.*

---

## 4. Les bonnes surprises — déjà cuit, utilisable sans rien acheter

1. **Le cook a fini la ville et la forêt.** `BIG_CITY_NIGHT_1` (1 occ.), `ForestKitONE`
   (2 occ.), 180 entrées `BIG_CITY/MESHES`, 793 refs OpenWorlds dans le toml régénéré à
   17:19 (greps re-faits par moi). La capitale est dans le niveau persistant (13 490
   acteurs, `Map_Narvos.umap` 2026-09-09 14:06) — le garde `cuit = false` est déjà levé
   (voir §5).
2. **Taxi volant `SM_AIRCAB`** + `SM_AIRCAB_PORT` + `SM_AIRCAB_AREA_GROUND` cuits
   (BIG_CITY/MESHES) — le marqueur « futuriste » de la capitale existe déjà, posable
   aujourd'hui (statique).
3. **Hôpital complet** : map HOSPITAL + 102 meshes médicaux (`SM_ANGIOGRAPHY`,
   `SM_ANGIOGRAPHY_ARM`, `SM_BED`, `SM_BED_WALL`, morgue `SM_Autospy_Desk` au
   SCI_FI_LABORATORY). Toute la boucle blessures/médecin/transport médical a son décor.
4. **Aéroport / terminal de contrôle RP** : `SM_Xray_Scanner` + écrans, robots
   `SM_ASSISTANT` / `SM_CAMOOO_ROBOT`, portiques de sécurité, comptoirs — 79 meshes
   TERMINAL. Contrôles d'accès, frontières, douanes : jouables dès que la logique suit.
5. **Animations sociales RP déjà cuites** — la couche « vie » n'attend que Lua :
   discussions marchand `ANIM_IP_customer_idle` / `_discuss` / `_accept` / `_denied`
   (BlacksmithAnimations, 88), fouille de sac `Loot_BackPack_OpenEnter` / `_Inspect_Loop`
   / `_Keep` (Loot_Anim_Set, 207), 223 idles civils (WW100IdleAnimPack), signes de main
   radio (Tactical_HandSignals, 253).
6. **Armure de police cuite** `SK_Male_Police_Armor_Army` + `Inst_Police_Armor3/4/5` +
   `SM_Cop_Hat` — la tenue de faction police est utilisable aujourd'hui, alors même que
   le reste de MetaCustom (widgets UMG) n'est pas cuit.
7. **Badges d'accréditation Defender** (`BP_LootSecurityClearanceLvl1/2/3`) dans l'ADK —
   les seuls assets « permis/badge » du parc, à un cook près pour les phases 4.31 et 5.39.
8. **Station orbitale + ville Halo + forêt déjà cuites** : ~53 000 refs tower_map/halo_map,
   `Map_Orbital`, 228 refs « debris » + milliers de chunks de destruction — épaves à
   volonté pour le gameplay récupération (roadmap §3 « récupération de pièces sur épaves »).
9. **Armurerie WEAPON_CENTER** (map + `SM_GRENADE_1/2`, `SM_ARMOR`, containers) et armes
   modulaires cuites (`Narvos/Weapon/` : `SK_Barrel_01-04`, `SK_Body_01-03`) — la boucle
   militaire de la roadmap §7 a son équipementier.
10. **Caisses ouvrables cuites** `SM_Crate_Wooden_01_open` / `SM_Crate_Metal_01`
    (FreeflowCombatSystem, 161 refs) — loot containers prêts pour missions et épaves.

---

## 5. Conséquence mesurée du cook terminé — le garde `cuit = false`
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
<!-- [TROU — ligne jamais lue dans les transcriptions] -->
## 6. Ce dont je ne suis pas sûr
<!-- [FIN INCONNUE — la suite du fichier n'a jamais été lue dans sa dernière version] -->