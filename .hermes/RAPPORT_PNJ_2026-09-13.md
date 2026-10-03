# Enquête PNJ — taille, transparence, textures (13/09, lecture seule)

Tout ce qui suit a été mesuré sur disque, sans éditeur, sans cook et sans nanos.
Scripts et sorties brutes : ce dossier (`scratchpad/pnj/`). La liste des commandes est au §9.

## 0. En bref

| Symptôme | Cause prouvée | Nombre | L'outil d'optimisation ? |
|---|---|---|---|
| PNJ géants | L'animation de repos (menu admin) porte la racine ×100 par rapport à la pose de référence. Le Lua multiplie encore par 100 (`echelle`, calculée sur les bornes de la pose de référence). | 29 entrées, 150 à 175 m une fois animées (crabe : 126 m). Sans animation : 1,5 à 1,75 m, taille juste. | NON |
| « On voit à travers » | Le matériau cuit est `BLEND_Translucent` : le glTF « Merged_Animations » (export Blender 4.2.57) est en `alphaMode: BLEND`. | 11 entrées | En partie : pour 3 PNJ, le `Character_output` opaque est passé en KTX2 obligatoire, Interchange l'a refusé et le générateur a pris le mesh translucide. |
| Gris / « sans texture » | (1) matériaux Defender NON COMPILÉS (« Missing Material Function ») ; (2) parent de matériau hors pack ; (3) mannequins de démo publiés comme « Infectés » ; (4) lézard sans image | 8 + 5 + 10 + 1. Dans les mondes, **18 points de peuplement sur 24** sont des Defender gris. | NON. Le seul effet de l'outil : textures 512 px au lieu de 2048 px sur 12 monstres. |
| Émission jaune qui déborde (19 h) | Tous les Meshy ont `emissiveTexture = baseColor`, avec `emissiveFactor [1,1,1]`, dès l'export d'origine. Le PNJ de la capture n'est **pas identifié**. | 33 matériaux | NON : le facteur est identique dans les originaux du 10/05. |

## 1. A — Inventaire des PNJ réellement posés

Journal serveur `D:/steam/steamapps/common/nanos-world-playtest/Server/.logs/NanosWorldCore.log` (17:55:56) :
`Peuplement : 24 point(s) declares` · `Marchands : 8/8 poses … 8 incarne(s) par un personnage de pack` · `Ateliers : 4/4`.

| Voie | Fichier:ligne | Classe | Échelle Lua | Animation | PNJ |
|---|---|---|---|---|---|
| Marchands (à la Forge, `ANCRE` = arrivée forge) | `narvos-map-proto/Server/Index.lua:1900` (`INCARNATION_MARCHANDS`), `:1931` (`PoserMarchands`) | `Character` | `SetScale` seulement si `echelle` ≠ 1 : aucun ici | locomotion `BS_EnemyWalk` | Valkiria ×1, CyberpunkSamurai sans casque ×2, avec casque ×1, Troopers ×4 |
| Armurier | `Index.lua:3274` → `CharacterBuilder.Spawn("warrior_tank")` | `Character` | 1 | locomotion | `SM_ZombieSoldierTankman_UE4` |
| Peuplement (tower et alien, 12 points par monde) | `Index.lua:3470` → `Peuplement.lua:111` | Defender : `Character` ; venom : `CharacterSimple` | venom ×100 | **aucune** pour `CharacterSimple` | tower : murdock ×3, shadowops ×3, executionerV2 ×3, venom_stalker ×3 · alien : wraithlunarops ×3, murdockwasteland ×3, shadowops ×3, venom_stalker ×3 |
| Menu admin (touche N) | `Spawner.lua:229` | `CharacterSimple` si `simple` (34 entrées), `Character` sinon (50) | `SetScale(echelle)` (`:290`) | **`PlayAnimation(ANIM_REPOS[id], "", true)`** (`:281`) pour 32 entrées | les 84 entrées de `Catalogs/Spawnables.lua` |
| Compagnons | `Server/Animaux.lua:131` | `CharacterSimple` | — | — | aucun compagnon adopté dans le journal |

Aucune voie ne pose de PNJ près de la capitale. Le géant de la capture 18 h vient donc très probablement du menu admin, mais ce n'est pas prouvé : l'invocation n'est pas journalisée.

Chaque clé a été remontée à son `Assets.toml`, puis au paquet cuit (table d'imports décodée : `uasset-imports.mjs`), puis à la source ADK et au GLB (`RelativeFilename` dans l'`AssetImportData`). Tableau complet dans `synthese.txt`, détail dans `inventaire.txt`.

Sources d'import des PNJ web (import ADK du 03/09, jamais refait) :
- `public/models/pnj/*` : GLB Blender, PNG 2048² ou 4096², sans extension obligatoire ;
- `Server/adk/_textures_png/pnj_monstre/*` : copies WebP → PNG **512²**, Draco conservé (12 monstres) ;
- `general`, `soldat_humain`, `mercenaire_alien` : **aucun `Character_output` importé** (0 fichier dans `Content/Narvos/pnj/<x>/`), parce que la source est en KTX2 obligatoire.

## 2. B — Échelle

### Mécanisme, mesuré sur `soldat_femme` puis sur les 32 PNJ animés

GLB source : un nœud `Armature` (non os), échelle **0,01**, porte `Hips` (t = 0,36 / 95,86 / 3,27). Les IBM portent ×100 et les sommets mesurent 1,70 m.

Interchange traite ce nœud de deux façons différentes :
- **pose de référence** (Skeleton et SkeletalMesh, source ET cuit) : racine `Hips` avec `s = 0.0001` et `t = (0.0036, 0.0327, 0.9586)` ;
  `uasset-transforms.mjs …_Skeleton.uasset` → `@4500 q=-0.5753,-0.44,0.5309,0.44 t=0.0036,0.0327,0.9586 s=0.0001` ;
- **AnimSequence** (`AnimationSequencerDataModel`) : canaux de la racine avec position Z ∈ [93,1 ; 95,8] et échelle par défaut **0,01 / 0,01 / 0,01** ;
  `canaux-anim2.mjs …AnimationsRunning.uasset` → canaux 0-2 = 300 clés (Z 93.1156..95.8376), canaux 6-8 `n=0 defaut=0.0100000 has=1`.
  Les os enfants sont identiques des deux côtés (LeftUpLeg 229,725 / 916,47 / −901,97, échelle 1).

Conclusion : l'animation perd l'échelle 0,01 du nœud `Armature`. Dès qu'elle joue, la racine vaut ×100 par rapport à la pose de référence, et le maillage rendu est 100 fois plus grand. Pour le crabe, facteur 78,87 (= 100 × 0,7887, l'échelle animée de ses `Hips`). Pour les rigs sans nœud `Armature` (gatonomi, gralynis, lizard), facteur 1.

L'échelle Lua `echelle = 100` a été posée le 05/09 sur les **bornes de la pose de référence** (1,7 u, `adk-bornes-pnj.py` et `_pnj-bounds.json`), quand ces PNJ étaient des statues. `ANIM_REPOS` est arrivé le 09/09, et les géants ont été vus le 10/09. Le « correctif du 1,7 cm » n'est pas appliqué deux fois dans le Lua : le second ×100 vient de l'asset d'animation.

| Famille | Entrées | Bornes (u) | echelle | Statique | Animé (menu) |
|---|---|---|---|---|---|
| Meshy `pnj/` (20) | soldat_*, mercenaire_*, sou_major, general*, gran_cheff, kgnitig, grunt, gronomi_*, grongnoni, profhete*, venom_stalker | 1,437 à 1,700 | 100 (gronomi_ardent 104,38 ; grongnoni 103,31) | 1,50 à 1,70 m | **150 à 170 m** |
| Meshy `pnj_monstre` (8) | canopy ×2, mycelium ×2, parasite ×2, pressure ×2 | 1,635 à 1,750 | 100 | 1,63 à 1,75 m | **163 à 175 m** |
| Crabe | aquarys_crab | 0,004 | 40 000 | 1,60 m | **126 m** |
| Rigs sans Armature | gatonomi, gralynis_boss, lizard | 199,3 / 200,0 / 103,2 | 1 | 1,99 / 2,00 / 1,03 m | identique |
| Sans animation | blackorn (0,93 m), mob_boss (1,54 m) | — | 100 | juste | — |
| Corps de packs (`Character`) | Troopers, Valkiria, Cyberpunk, Defender, mannequins, armurier | 162 à 197 | 1 | 1,62 à 1,97 m | — |

Tous les squelettes d'animation sont LE MÊME asset Skeleton que le mesh : les animations jouent donc bien. Le venom_stalker du peuplement n'est pas animé et mesure 1,7 m.

## 3. C — « On voit à travers »

1. **Translucidité, prouvée dans le cuit.** 11 entrées : soldat_humain, general, mercenaire_alien, canopy ×2, mycelium ×2, parasite ×2, pressure ×2.
   - `Material_1.uexp` cuit (mycelium_host_female) contient `BLEND_Translucent`, `TranslucentBasePass…`, `TranslucencyPolicy` et `FGPUSkinVertexFactory`.
   - Le source ADK contient `BLEND_Translucent` ; les `Character_output` ont `BLEND_Opaque`.
   - GLB : `"alphaMode":"BLEND","doubleSided":true` dans **tous** les `Meshy_AI_biped_Meshy_AI_Meshy_Merged_Animations.glb` (Blender I/O 4.2.57, dès le 10/05), alors que les `Character_output.glb` (Blender I/O 4.0.43) sont OPAQUE.
   - Aucune image n'a d'alpha (WebP `VP8 ` sans alpha, PNG RGB) : le mode BLEND ne sert à rien et casse le tri de profondeur.
2. **Normales et faces** : NORMAL présent sur 100 % des primitives, `doubleSided` partout, `TwoSided` dans les matériaux cuits. Ce n'est pas la cause.
3. **Os et influences** (point du coordinateur) : ≤ 161 os par maillage (Meshy 24, crabe 27, monstres 38 à 76, packs 61 à 81, Manny 161) et ≤ 8 influences mesurées (Meshy 4, Troopers 7-8, Valkiria 5).
   Aucun PNJ ne dépasse 255 os ou 8 influences, donc `Support16BitBoneIndex` et `UnlimitedBoneInfluences` ne les concernent pas (voir `influences.txt`). Les monstres compressés en Draco n'ont pas été décodés ; leurs jumeaux non compressés en ont 4.
   `UseExperimentalChunking` : effet sur des maillages de 24 os non prouvé, peu probable.
4. **Hypothèses non prouvées** : caméra à l'intérieur d'un géant de 170 m ; culling sur des bornes calculées pour 1,7 m. LOD : non mesuré.

## 4. D — Textures (85 entrées : 84 du menu + armurier)

Méthode :
- imports cuits du mesh → matériaux → chaîne de parents ;
- échecs de compilation relevés dans `NanosWorldADK-backup-2026.09.13-14.41.51.log` (dernier cook complet, `Packages Remain 0`) et `…07.34.36.log` ;
- `FGPUSkinVertexFactory` dans la shader map cuite ;
- textures décodées : format, taille, blocs distincts de la mip 64² en ligne (`texture-cuite.mjs`).

| Cause (jugée sur la nature) | N | Entrées | Preuve |
|---|---|---|---|
| Texture OK (compile, skin, texture projet non uniforme) | 45 | 20 Meshy pnj, 12 monstres, merchants ×4 corps, Troopers ×6, Cyber ×2, Valkiria, 3 BodyForms, armurier | 208 textures décodées, 0 absente ; 1 seule uniforme (`MetaCustom/T_Shorts_Top_BaseColor` 8192², RGB 189/188/189), mais c'est le défaut du parent `Mat_Clothing_Master`, écrasé par les MIC, et sa source ADK pèse 18 Ko (uniforme d'origine) |
| … dont corps translucide | 11 | voir §3 | `BLEND_Translucent` cuit |
| … dont textures 512 px (optimisation web) | 12 | 8 Meshy monstres + crabe, gatonomi, gralynis (512), blackorn (256) | `_textures_png` : PNG 512² ; original `Assets/alien/mob/mycelium_host_female.glb` : JPEG 2048² |
| **Matériau NON COMPILÉ → Default Material (damier gris)** | 8 | sk_hero, sk_murdock, sk_murdockexecutionerv2 (2 slots), sk_murdockwasteland, sk_shadowops (2), sk_trooper, sk_wraithlunarops, modulaire_defender_mannequin_f (M_Mannequin) | Log : `M_Murdock.uasset: Failed to compile Material for platform PCD3D_SM6, Default Material will be used in game.` suivi de `Missing Material Function` ; pas de `FGPUSkinVertexFactory` |
| **Référence cassée (parent hors pack)** | 5 | sk_l_male, sk_m_male, sk_m_male2, sk_m_male3, sk_s_male | Les MIC `M_TrainingSoldier*` importent `/Game/Defender/Demo/Levels/UndergroundBaseLevel/Materials/M_TrainingSoldier`, présent seulement sous `Content/Defender/` (`+DirectoriesToNeverCook=(Path="Defender")`) |
| Mannequin de démo publié comme « Infecté » (mauvais asset) | 10 | infecte_* (dont zombiesoldier4, sans aucune texture) | Chemin `…/Characters/<X>/Demo/Mannequin*/…/SK_Mannequin` (règle du générateur `narvos-spawnables-to-lua.mjs:187`) |
| Mannequins de test (gris par conception) | 15 | mannequin_* | textures présentes |
| Sans image à la source | 1 | lizard | `lizard.glb` : 0 image ; matériau `ojo` sans texture |
| Couleur de sommet (voulu) | 1 | mob_boss | `M_NarvosCouleurSommet` |

**Dans les mondes** (hors menu), 33 PNJ :
- 18 Defender **gris** (non compilés), soit 55 % ;
- 8 marchands, 1 armurier et 6 venom_stalker texturés.

C'est la « majorité » constatée par le joueur.

**Pourquoi les Defender ont perdu leur graphe.**
- L'original du pack, `public/asset_game/asset_futuriste/Defender/Defender/Content/Defender/Demo/Characters/Murdock/M_Murdock.uasset` (UE 4.27, 125 819 o), cite `/Game/Defender/Demo/Materials/MaterialFunctions/MF_Bloody|MF_DamageFlash|MF_DissolveEffect|MF_MaterialEffects`.
- La copie promue `Content/Narvos/Defender/…/M_Murdock.uasset` (5.7, 12 589 o, resauvée le 09/09) ne cite plus **aucune** fonction. Ces fonctions existent pourtant sous `Content/Narvos/Defender/Demo/Materials/MaterialFunctions/`.
- Même forme pour les 11 matériaux de corps. Sur l'ensemble du pack, 230 matériaux Defender sur 328 sont plus petits que 80 % de l'original. C'est un indicateur, pas une preuve : `M_MurdockExecutioner`, à 11 %, compile.

Cook complet : 406 matériaux distincts en échec. Principaux packs : ZombieSoldierPack_original 85, Defender 69, CITY_PACK 38, ThirdPerson 32 (`echecs-cook.txt`).

Correctif skeletal du matin : prouvé dans le cuit pour les Meshy (`FGPUSkinVertexFactory` présent sur les 28 `Material_1`).

## 5. E — Les outils d'optimisation : ce qu'ils ont changé

| Passe | Date, générateur | Ce qu'elle fait | Fichiers PNJ touchés | Effet côté nanos |
|---|---|---|---|---|
| `WebPortal/scripts/assets-to-ktx2.mjs` | 26/07, glTF-Transform 4.3.0 | textures seules → KTX2 (max 1024 px), `KHR_texture_basisu` **obligatoire** ; ni draco, ni prune, ni dedup ; sauvegarde `_ktx2_backup/`, **introuvable sur disque** (`find` : 0) | `pnj/{general,soldat_humain,mercenaire_alien}/Meshy_AI_biped_Character_output.glb` ; `pnj_monstre/{bandit,boss_mob,golem_glace,lion,zombi}` | Interchange refuse ces fichiers en entier → ces 3 PNJ utilisent le mesh `Merged_Animations` translucide |
| Passe WebP + Draco | 07/06, glTF-Transform **4.4.0** (script non trouvé ; la version locale est 4.3.0) | WebP 512 px + Draco, tous deux obligatoires | 12 GLB `pnj_monstre` (aquarys, blackorn, canopy ×2, gatonomi, gralynis, lizard (Draco seul), mycelium ×2, parasite ×2, pressure ×2) | Import impossible sans `_textures_png` (WebP → PNG) : textures **512²** dans le pack (16 fois moins de pixels que les originaux 2048²) |
| `scripts/narvos-textures-vers-png.mjs` | 03/09 et 08/09 | WebP ou KTX2 → PNG ; géométrie, matériaux et alphaMode inchangés | `_textures_png/pnj_monstre` (12) ; `public/models_repares/pnj/{general,mercenaire_alien,soldat_humain}` (1024² PNG, OPAQUE, **jamais importés**) | aucun défaut ajouté |

À garder : KTX2, WebP et Draco pour le **runtime web** (la VRAM de three.js), ainsi que la dédup et le KTX2 de ZombieSoldierPack (web).

À réparer : l'import Unreal doit partir des **originaux**. Unreal recompresse lui-même en BC au cook (DXT1 2048² = 2,8 Mo en `.ubulk`). Originaux disponibles :
- `inpi/Godot/nouveau-projet-de-jeu-(4.5)/asset/characters/<pnj>/Meshy_AI_biped_Character_output.glb` : PNG 2048², OPAQUE ;
- `Assets/alien/mob/<monstre>/<monstre>.glb` : JPEG 2048², non riggé, **même nombre d'indices** que la version riggée (89 985 pour mycelium_f), donc UV probablement compatibles.

L'outil n'explique **ni** la taille (sa géométrie est bit à bit identique ; `Armature` 0,01 est présent dans les originaux du 10/05), **ni** les gris (Defender, TrainingSoldier, mannequins).

## 6. Point du coordinateur — « rocher » émissif jaune (19 h)

- **Non identifié.** Le journal client ne contient que `[DIAG] aucun personnage controle` : aucune mesure `/diag` près d'un PNJ.
- Mécanisme commun, mesuré sur 33 matériaux sources : `emissiveTexture` = la même image que `baseColorTexture`, `emissiveFactor [1,1,1]`, pas de `KHR_materials_emissive_strength`, `metallicFactor` absent (1,0 par défaut glTF). Le matériau cuit câble `MF_Emissive` (`EmissiveTexture`, `EmissiveColor`).
  - Émission = texture entière, sans dépendre de la lumière ; la nuit (capitale à 22:30), l'auto-exposition la fait fleurir.
  - Ajoutée à `BLEND_Translucent` (faces internes visibles) et à la taille ×100, elle peut donner une grande tache avec des « trous ».
  - Unités EV100 ou nits du client nanos : non vérifiables hors moteur.
- Candidats, jugés sur la nature :
  - `mycelium_host_male` : « corps minéralisé » dans `npcCatalog.ts:106`, translucide, 163 m animé ;
  - `mercenaire_tank` : 37,2 % de pixels jaune clair dans sa texture, opaque, 169 m animé.
- À distinguer : CyberpunkSamurai (3 marchands) a `emissive_strength` **20** sur `MI_Body`, mais son émissif est cyan (RGB moyen 0/2/3), pas jaune.

## 7. F — Plan (ordonné)

**Lua seul, sans recook**
1. `Server/Spawner.lua` : ne plus combiner `PlayAnimation` et `SetScale(100)`.
   - Immédiat : ne pas jouer `ANIM_REPOS` pour les entrées dont le facteur d'animation vaut 100 (statues à 1,7 m, comme dans le peuplement).
   - Ou : `SetScale(echelle / facteur)`, puis `SetCapsuleSize` (BasePawn, autorité) à la taille réelle. **À tester en jeu** : capsule du `CharacterSimple`.
2. `scripts/narvos-spawnables-to-lua.mjs` : écrire `facteur_anim`, mesuré dans les sources ADK (racine pose de référence contre racine de l'animation), à la place de l'hypothèse « bornes = rendu ». Garde `lua-harness` : refuser toute entrée animée dont le facteur ≠ 1 sans compensation.
3. `Index.lua:3470` `PEUPLEMENT_PAR_MONDE` : remplacer les 4 Defender gris par des corps prouvés sains et déjà cuits :
   - `SM_ZombieSoldier_UE4`, `SM_ZombieSoldier2_UE4`, `SM_ZombieSoldier4_FullBody_UE4`, `SM_ZombieSoldierWinter_UE4`, `SM_ZombieSoldierTankman_UE4` ;
   - tous sur `SKEL_Mannequin` nanos, compilés, skinnés et texturés (`zombies-materiaux.txt`) ;
   - il faut une entrée Spawnables (générateur).
4. Générateur, règle « Infectés » : viser ces 5 corps entiers, pas `…/Demo/Mannequin*/SK_Mannequin`. Retirer du menu les 5 TrainingSoldiers et `modulaire_defender_mannequin_f` tant qu'ils ne sont pas réparés.
5. En jeu : `/diag` près d'un PNJ invoqué (attendu 150-175 m avant le correctif, 1,5-1,75 m après).

**Éditeur complet + recook** (UMaterial : jamais en commandlet)
6. Defender :
   - restaurer les 11 graphes de corps (M_Hero, M_Murdock, M_MurdockWasteland, M_ShadowOpsPants et Upper, M_Trooper, M_WraithLunarOps, M_Murdock_Body_Executioner_M2, M_VisorGlass_Executioner_M, plus les armes M_MurdockShotgun et M_WraithGun) depuis l'original 4.27, avec un redirect **idempotent** `/Game/Defender/Demo/Materials/` → `/Game/Narvos/Defender/Demo/Materials/` (méthode de la forêt) ;
   - puis `scripts/adk-usage-skeletal.py`, recook ;
   - preuve : 0 « Failed to compile » sur ces 11, et `FGPUSkinVertexFactory` cuit.
7. TrainingSoldiers : promouvoir `Defender/Demo/Levels/UndergroundBaseLevel/Materials/M_TrainingSoldier` et ses dépendances (liens durs + redirect), recook, puis `node scripts/narvos-imports-casses.mjs Narvos/Defender/Demo/Characters/TrainingSoldiers`.
8. Translucides :
   - (a) importer les `Character_output` OPAQUES de `general`, `soldat_humain` et `mercenaire_alien` depuis `inpi/Godot/…/characters/` (`adk-import-narvos.py`, `NARVOS_SANS_SQUELETTE=1`), puis vérifier que le générateur les choisit ;
   - (b) 8 monstres : `BlendMode = Opaque` sur `Material_1` (éditeur), ou copie GLB avec `alphaMode` retiré puis réimport ; dans ce cas, régénérer et relancer `pnj-anims.mjs`, les clés au rang pouvant bouger.
9. Échelle à la source (long terme) : prétraiter un GLB Meshy pour appliquer l'échelle 0,01 de l'`Armature` (translations des os × 0,01 dans la pose et les animations, IBM recalculées), réimporter **un** PNJ, puis vérifier que la racine de la pose de référence et celle de l'animation coïncident (`uasset-transforms.mjs` et `canaux-anim2.mjs`). Généraliser ensuite, et ramener `echelle` à 1.
10. Textures 2048² pour les 8 monstres Meshy (originaux JPEG) après vérification des UV. Émissif : mettre `emissiveFactor` à 0 sur les copies d'import Unreal si la capture le confirme (décision artistique).

## 8. Non prouvé / inconnues

- L'identité des PNJ des captures de 18 h et 19 h, et l'origine « menu admin » (non journalisée).
- Le rendu réel en jeu : aucune mesure `/diag`. L'effet de la translucidité, de l'émissif, de l'auto-exposition et du culling de géants est déduit des données, pas vu.
- L'effet des réglages GPUSkin retirés à 18:46 sur des PNJ ≤ 161 os et ≤ 8 influences : a priori nul, non vérifié en jeu.
- La compatibilité UV des originaux 2048² des monstres ; l'emplacement des originaux de gatonomi, gralynis et blackorn (non cherché à fond).
- La réaction d'Interchange à un GLB dont l'`Armature` est « appliquée » : test sur un PNJ nécessaire.
- La cause exacte de la perte des fonctions à la promotion (le 09/09) : forme identique au pattern « refs effacées », non rejouée.

## 9. Reproduire (lecture seule, depuis ce dossier)

```
node glb-analyse.mjs <glb>                          # nœuds, peau, IBM, bornes repos et animées, matériaux
RACINE=<dossier> node survol-glb.mjs pnj pnj_monstre # générateur, extensions obligatoires, alphaMode, images
node uasset-transforms.mjs <..._Skeleton.uasset>    # pose de référence (doubles)
node canaux-anim2.mjs <AnimSequence.uasset>         # canaux MovieScene (clés + défauts)
node uasset-imports.mjs <paquet cuit .uasset>       # imports et exports décodés (UE5 1018)
node inventaire-pnj.mjs > inventaire.txt            # + inventaire.json
node synthese.mjs                                   # synthese.txt / synthese.json
node echecs-cook.mjs                                # echecs-cook.txt / echecs-materiaux-cook.json
node influences.mjs                                 # influences.txt
node emissif-sources.mjs                            # emissif-sources.txt
node stats-images-glb.mjs <glb…>                    # couleurs, pixels clairs/jaunes
node materiaux-de.mjs <clé Assets.toml…>            # chaîne de matériaux cuits d'un asset
```