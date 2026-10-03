---
name: nanos-world
description: Base fiable pour développer NARVOS sur nanos world — architecture (asset packs Unreal 5.7 + packages Lua), API vérifiée à la source (personnages modulaires, morph targets, animations, caméra iso, autorité, événements, persistance), formats (Package.toml, Assets.toml), whitelist de plugins, et TOUS les pièges déjà rencontrés (chemins .uasset, squelette UE4 vs Manny, require vs Package.Require, VA_* à ne jamais cuire). À invoquer AVANT tout code Lua nanos, tout export d'asset vers nanos, toute modification de nanos_world/.
---

# nanos world — mémoire d'intégration NARVOS

Tout ce qui suit a été **vérifié** le 2026-08-29/30 : soit dans `github.com/nanos-world/api`
(la source réelle de l'API — la doc locale `docs-master` ne la contient PAS, elle l'injecte à
la compilation du site), soit dans le code des game-mods officiels sur disque, soit en
exécution (build UBT, wasmoon). Ce qui n'a pas été vérifié est marqué ⚠ NON VÉRIFIÉ.

## 0. Ce qu'est nanos, en une phrase qui évite 80 % des erreurs

**Un client Unreal 5.7 *shipping* (pas de `Source/`, pas de C++ chargeable) + un serveur qui
exécute des packages Lua.** Unreal ne sert qu'à *fabriquer des assets*, cuits en asset packs.
Le gameplay s'écrit en Lua. Aucun plugin C++ tiers ne s'exécute dans nanos.

Conséquences immédiates :
- Les 20 plugins C++ de `NarvosUE57` (ACF, GAS, FastAI, DragonIK, FGear…) **ne tourneront jamais
  côté nanos**. Ils servent en amont, dans l'éditeur, à produire meshes/anims/matériaux.
- **Les Blueprints, eux, s'exécutent.** La classe `Blueprint` spawne « any Unreal Blueprint
  Actor » cuit dans un pack, et Lua lui parle (`CallBlueprintEvent`, propriétés, dispatchers —
  voir §6). Limite réelle : un Blueprint ne dispose que des nœuds présents dans le client
  (moteur + plugins whitelistés) — pas de nœud venant d'un plugin C++ tiers. Donc « un plugin
  C++ que nanos lirait » : non ; « un Blueprint qui encapsule des actions/animations » : **oui**.
- **Object2Lua** (Forge) est un chemin *distinct* : il convertit les *propriétés* d'un
  Blueprint/DataAsset en table Lua (données), sans exécuter le graphe.
- Les catalogues TS de NARVOS (`classes.ts`, `spellCatalog.ts`, `LootRegistry.ts`…) sont déjà des
  données : ils vont **directement** en Lua (`scripts/narvos-catalogs-to-lua.mjs`), sans Unreal.

## 1. Espace de travail

**Unreal n'est plus dans la boucle.** `NarvosUE57`, l'ADK et `C:\Users\aniss\Documents\nanos_world\`
ont été supprimés le 2026-09-02. Développer sur nanos n'en a pas besoin : le pack de base fournit
500+ static meshes, 150+ skeletal, 300+ sons et 4 maps. Ne pas réinstaller l'ADK sans une raison
nommée (cuire un asset pack NARVOS en est une ; rien d'autre ne l'est aujourd'hui).

```
E:\narvosprime-web-prototype\        LE DÉPÔT — source de vérité
├── WebPortal\Server\
│   ├── Config.toml                        config serveur (déployée vers Steam par script)
│   └── nanos_world\
│       ├── packages\narvos\                 NOTRE package Lua (catalogues + logique, §4)
│       ├── packages\narvos-map-proto\       map prototype isométrique (§7)
│       └── docs\docs-master\                doc nanos (sans l'API : voir §11)
└── scripts\                               outillage (§10)

D:\steam\steamapps\common\nanos-world-playtest\  L'INSTALL STEAM — jamais versionnée
├── NanosWorld.exe                         le client
└── Server\                                binaires du serveur, mis à jour par Steam
    ├── NanosWorldServer.exe
    ├── Config.toml                          copie du projet
    └── Packages\narvos*                     JONCTIONS vers le projet
```

Séparation délibérée : **binaires à Steam, contenu au projet.** Copier les binaires dans le dépôt
(ce qui a été fait puis défait) garantit qu'ils vieilliront face au client — et un client plus
récent que le serveur ne se connecte pas. Le lien se (re)fait par
`node scripts/nanos-deploy-server.mjs --apply`, à relancer après toute mise à jour Steam de nanos :
une réinstallation du dossier `Server\` emporte les jonctions et le `Config.toml` avec elle.

## 2. Asset packs (côté Unreal)

**Règle ADK** (README + doc `importing-assets`) : un pack = `Content/<NomUnique>/`. Deux packs qui
partagent un nom de dossier ne peuvent pas être chargés ensemble. `Content/NanosWorld/` ne doit
être ni modifié, ni copié : toutes les références du jeu pointent dessus telles quelles.

**`Assets.toml`** (à la racine du pack, modèle officiel dans `game-mod/nanos-world-server-main`) :
```toml
[unreal]
    unreal_folders = ["Narvos"]      # nom EXACT du dossier racine sous Content/
    unreal_version = "5.7.0"
    is_plugin_content = false
[assets.skeletal_meshes]           # + maps, static_meshes, sounds, animations, particles, materials, blueprints, others
    SK_X = "Narvos/Characters/SK_X"
```
Le générateur `NanosWorld/Blueprints/Utility/WBP_AssetsTomlGenerator` le produit depuis l'éditeur.

**Référence d'asset en Lua** : `"pack::Asset"` — ex. `"nanos-world::SK_Male"`,
`"nanos-world::SM_Eye"`. Vignettes : `"assets://pack/Thumbnails/x.jpg"`.

**Whitelist de plugins** (`whitelisted-ue-plugins.mdx`, vérifié) — 2 externes à version imposée
(**Kawaii Physics v1.19.1**, **Ultra Dynamic Sky v8.3A**) + natifs : Pose Search, Animation
Warping, Motion Warping, Chooser, Motion Trajectory, Chaos Vehicles, PCG, HDRI Backdrop, CommonUI,
MVVM, Sun Position, Water, Advanced Water, Geometry Scripting, Nanite Displaced Meshes, Rig Logic,
LiveLink Control Rig, Animation Locomotion Library, Hair Strands, Mover, Mutable, Gameplay
Abilities, Niagara Fluids. **Aucun de nos plugins tiers n'y est.** Pièges d'homonymie :
`sky_creator` ≠ Ultra Dynamic Sky, `UIWS` ≠ Water, `FGear` ≠ Chaos Vehicles, `AdvancedGASSystem`
≠ Gameplay Abilities natif.

**Outils de l'ADK** (`NanosWorld/Blueprints/…`) : Placeholders (spawn points, **non cuits**),
`WBP_LuaCodeGenerator` (génère le Lua de spawn depuis la map), `WBP_AssetsTomlGenerator`,
`BP_SunSky`, `MaterialLibrary/PhysicalMaterials/`, `ThumbnailGenerator`. Clic droit → *Run Editor
Utility Widget*. Forge : `Object2Lua`, `quick-instancer`.

## 2 bis. Importer nos GLB dans l'ADK — chaîne établie et mesurée (2026-09-02)

Quatre scripts, dans cet ordre. Chacun encode un piège déjà payé.

```
1. scripts/adk-export-mannequin.py      sort SKEL_Mannequin de l'ADK -> _export/SK_Mannequin.glb
2. scripts/narvos-skeleton-compat.mjs   compare nos GLB a cette reference, ecrit un manifeste
3. scripts/adk-import-narvos.py         importe le manifeste, squelette impose
4. scripts/adk-verify-skeletons.py      relit les assets : a quoi sont-ils VRAIMENT lies ?
```

**Résultat mesuré sur `public/models/personnages`** (1 589 GLB) : 1 243 compatibles sans
retargeting, 603 après exclusion des KTX2 → **611 SkeletalMesh importés, 611 liés à
`SKEL_Mannequin`**, 452 animations, 2 545 assets, 7,9 Go.

### Les cinq pièges, tous vérifiés à l'exécution

1. **`AssetTools.import_asset_tasks()` TUE le commandlet.** Il synchronise le navigateur de
   contenu après import ; un commandlet n'a pas d'application Slate →
   `Assertion failed: CurrentApplication.IsValid()` (SlateApplication.h:321), pile
   `ContentBrowser.dll → AssetTools.dll → InterchangeEngine.dll`. Utiliser
   `InterchangeManager.import_asset()`, qui ne touche jamais au navigateur.
2. **L'export FBX d'un SkeletalMesh plante pareil** — `MeshMergeUtilities` exige un `MeshObject`
   de rendu (`SkinnedMeshComponent.cpp:4677`) et le processus meurt AVANT les cibles suivantes.
   Le glTF passe sans rendu. Ne réactiver le FBX qu'avec `-AllowCommandletRendering`, et en dernier.
3. **`KHR_texture_basisu` (KTX2) n'est PAS lu par Interchange** — 18 extensions KHR supportées,
   pas celle-là. Le mesh et le squelette s'importent, les textures non, **sans erreur** : un
   personnage gris en jeu. Les paires `<pack>` / `<pack>_original` du dépôt existent pour ça —
   pour Unreal, c'est `_original`. ⚠ `_parts` (211 fichiers, le pack MODULAIRE) n'a ni original
   ni `_ktx2_backup` : ses textures sont à retranscoder si on en veut.
4. **Chemins ABSOLUS dans le manifeste.** Un commandlet n'a pas le dépôt pour répertoire courant :
   584 imports ont échoué en silence sur des chemins relatifs.

4 bis. **SAUVEGARDER APRÈS CHAQUE FICHIER, jamais une seule fois à la fin.** Le piège le plus
   coûteux de la chaîne, et le plus silencieux. Les textures compilent en ASYNCHRONE
   (`LogAsyncCompilation`) : une `save_directory` globale en fin de course écrit ce qui est prêt et
   ABANDONNE le reste, puis le processus sort et le travail en cours est perdu. Résultat : des
   personnages **gris**, des matériaux `MI_Body`/`MI_Head` créés mais vides, et **aucune erreur** —
   l'import se déclare complet.

   Établi par expérience isolée (`scripts/adk-test-textures.py`) : le MÊME GLB importé seul rend
   ses 10 `Texture2D`, et zéro enchaîné avec 21 autres. Quatre hypothèses préalables — taille de
   texture, squelette forcé, drapeaux du pipeline, `KHR_texture_basisu` — étaient toutes fausses ;
   `adk-probe-textures.py` a montré que `import_textures` et `import_materials` valaient déjà
   `True`. Après correction : 61 assets → 89, toutes les textures de corps, tête, cheveux et armes.

   Corollaire : `only_if_is_dirty=True`. Avec `False`, la sauvegarde finale réécrivait les 32 000
   assets de `/Game/Narvos` (13 Go, map comprise) à chaque import de quelques fichiers.
5. **Mesh et animation n'ont pas le même critère.** Pour un mesh, des os EN TROP sont ignorés
   (verdict SUR-ENSEMBLE = importable). Pour une animation, chaque piste doit trouver son os :
   les 39 échecs de BikerBundle sont tous `lowerarm_correctiveRoot_r`, un correctif Manny UE5
   absent des 68. Les animations UE5 exigent un retargeting que les meshes n'exigent pas.

6. **Le cook se bloque indéfiniment sur les shaders globaux.** Unreal 5.7 embarque `UbaController`
   et `XGEController` (compilateurs de shaders *distribués*), actifs par défaut. Sur une machine
   seule ils n'ont aucun ouvrier à qui parler : le cook attend pour toujours, **sans erreur**.
   Symptômes : log figé, zéro `ShaderCompileWorker.exe` vivant, et un
   `ShaderCompileWorker-Distributed Diagnostics` imprimé toutes les 15 minutes. Mesuré : 1 h 15
   perdue. Les désactiver dans le `.uproject` — pas par un drapeau de ligne de commande. Preuve
   que c'est réglé : le log dit `No distributed shader compiler controller found`.

7. **UniGLB activé fait planter le cook.** Son contenu d'exemple (487 assets sous
   `Plugins/UniGLB/Content/`) contient `A_face_VRoidSimple`, une AnimSequence **sans squelette** :
   `Animation Compression request failed, Skeleton == nullptr` puis
   `Assertion failed: !Hash.IsZero()` (`AnimSequence.cpp:2151`), et le cook meurt à mi-parcours
   (2 579/3 755 mesuré). UniGLB est un outil d'ÉDITEUR — il n'a rien à faire dans un cook, et son
   contenu ne doit jamais partir dans un pack. Le laisser désactivé ; ne le rallumer que pour un
   import qui en a besoin, et le rééteindre avant de cuire.

**État du `.uproject` de l'ADK** — il n'active que `Water` d'origine :

| plugin | état | pourquoi |
|---|---|---|
| `PythonScriptPlugin` | activé | les scripts d'import/export sont en Python |
| `GLTFExporter` | activé | sort `SK_Mannequin` en glTF |
| `UniGLB` | **désactivé** | casse le cook (piège 7) ; l'import passe par Interchange |
| `UbaController` | **désactivé** | bloque le cook pour toujours (piège 6) |
| `XGEController` | **désactivé** | idem |

### Assembler le pack après le cook

`scripts/nanos-build-asset-pack.mjs` (simulation par défaut, `--apply` pour écrire) produit
`Server/Assets/narvos/`. Trois règles qu'on ne devine pas :

1. Le dossier du pack est en **kebab-case** (`narvos`), mais `unreal_folders` porte le nom **exact**
   qu'avait le dossier sous `Content/` (`Narvos`) — c'est lui qui garde valides les références
   relatives entre assets ; s'en écarter casse matériaux et textures sans message.
2. **`unreal_version` doit être la version RÉELLE du moteur**, lue dans
   `Engine/Build/Build.version`. Le gabarit officiel porte `5.7.0` ; recopié tel quel, le serveur
   refuse le pack : *« Asset Pack Unreal Version: '5.7.0'. Compatible Unreal Versions: '5.7.1,
   5.7.2, 5.7.3, 5.7.4' »*. nanos compare le nombre DÉCLARÉ, pas le contenu — c'est donc une
   correction d'une ligne, sans recook.
3. **Classer les assets par leur classe de registre, jamais par préfixe de nom.** Sur 611
   SkeletalMesh importés, 44 seulement portent `SK_`. `scripts/adk-dump-assets.py` sort
   l'inventaire typé depuis Unreal ; le builder JS le consomme. Le `Assets.toml` est GÉNÉRÉ :
   `[assets.*]` associe un nom (celui qu'écrira le Lua, `narvos::SK_Truc`) à un chemin, et une
   liste tenue à la main serait périmée au premier réimport.

⚠ Importer un GLB d'ANIMATION crée aussi un SkeletalMesh (la pose de liaison embarquée). C'est ce
qui gonfle le compte : sur 611 SkeletalMesh, ~112 seulement sont de vrais corps de personnage.

## 3. Le squelette — l'erreur la plus coûteuse à éviter

nanos exige que les personnages utilisent **`NanosWorld/Characters/Common/SKEL_Mannequin`** et
**`PHYS_Mannequin`** (ragdoll). Doc : *« il n'est possible de convertir que des Skeletal Meshes
qui utilisent déjà le Mannequin par défaut ; plus d'os ou différent = ne marchera pas »*.

**C'est le Mannequin UE4 (~68 os), PAS Manny UE5 (89).** Vérifié os par os dans le package :
`spine_01..03`, `neck_01`, `lowerarm_twist_01_l`, `ik_hand_gun` présents ; `spine_04`, `spine_05`,
`neck_02`, `index_metacarpal_l`, `*_twist_02_l` **absents**.

Mesure exacte sur la référence extraite de l'ADK (`_export/SK_Mannequin.glb`) : **68 os**,
racine `root` → `pelvis` → `spine_01..03` → `clavicle_l` → `upperarm_l`…

**UniGLB n'est plus sur le chemin critique.** Il reste monté dans l'ADK (jonction vers
`Documents/Plugins57/UniGLB`, DLL déjà compilées pour 5.7.0) et son patch `VrmConvertIKRig.cpp`
tient toujours, mais Unreal 5.7 lit le glTF nativement via Interchange — chemin plus court, sans
plugin tiers, et pilotable en commandlet. C'est celui qu'utilise `adk-import-narvos.py` (§2 bis).
L'import headless d'UniGLB, lui, reste cassé (il n'écrivait que le `VA_*_VrmAssetList`).

**L'inventaire a démenti l'intuition de départ.** On croyait nos modèles majoritairement sur
Manny UE5 : c'est l'inverse. Sur 1 589 GLB de `personnages`, **1 243 portent déjà les 68 os**
(794 exactement, 382 en sur-ensemble, 67 auxquels ne manquent que des `ik_*`). Le retargeting
ne concerne que 284 fichiers. Toujours mesurer avec `narvos-skeleton-compat.mjs` avant de
planifier une conversion — l'heuristique de convention d'`unreal-audit-glb.mjs` ne répond pas
à la même question.

## 4. Packages Lua

**Structure** (`packages-guide.mdx`) : `Package.toml` + `Server/`, `Client/`, `Shared/`, chacun
avec un `Index.lua` — **seul fichier exécuté automatiquement**, il `Package.Require` le reste.
Types : `script`, `game-mode`, `loading-screen`, `map`, `c-module`.

**Cycle de vie serveur** (`server-and-client-lifecycle.mdx`) : Start → événement `Start` →
**`Shared/Index.lua` puis `Server/Index.lua`** → hot-download vers les clients → boucle Tick.

**Charger un fichier** : `Package.Require("Logic/Loot.lua")` — **avec l'extension**. Un `require`
nu est le `require` Lua natif côté serveur (il ne connaît pas la racine du package) et seulement
un alias côté client. Les deux n'ont pas la même clé de cache : charger un module par les deux
voies donne **deux tables distinctes**.

**Exporter** entre packages : `Package.Export("Narvos", Narvos)` ; consommer avec
`Package.Import` (⚠ NON VÉRIFIÉ : signature exacte de Import).

**Événements** (`communicating-between-packages.mdx`, `events-guide.mdx`) :
```lua
Player.Subscribe("Spawn", fn) / Player.Unsubscribe("Spawn"[, fn])   -- événements de classe
Events.Call("Nom", ...) / Events.Subscribe("Nom", fn)                -- même côté
Events.CallRemote("Nom", player, Reliability.Reliable, ...)         -- serveur → un client
Events.BroadcastRemote("Nom", Reliability.Reliable, ...)            -- serveur → tous
Events.SubscribeRemote("Nom", fn)                                    -- réception
-- variantes : CallRemotePlayers, BroadcastRemoteDimension, BroadcastRemoteInRadius[Dimension]
-- sur entité : Entity:CallRemoteEvent / CallRemotePlayersEvent / BroadcastRemoteEvent
```
`Reliability` : `0 Unreliable` (perte/désordre possibles), `1 Reliable` (garanti, ordonné).

**Valeurs d'entité** (`entity-values.mdx`) : `entity:SetValue(key, value, sync)` — `sync=true`
(serveur seulement) réplique aux clients ; `entity:GetValue(key, fallback)`. Aussi
`Client.SetValue` / `Server.SetValue` (locaux, sans `sync`).

**Persistance** (`persistent-data.mdx`) : `Package.SetPersistentData("clé.sous_clé", valeur)` →
`Package/.data/PersistentData.toml`, chargé en mémoire au démarrage ; lecture
`Package.GetPersistentData()`.

**`Package.toml`** (modèle : `asset/nanos-world-quaternius-main/Package/Package.toml`) :
`[meta] title/author/version` ; `[script] force_no_map_package, auto_cleanup, load_level_entities,
compatibility_version = "1.93", packages_requirements = [], assets_requirements = ["narvos"],
compatible_game_modes = []`.

## 5. Autorité — lire la légende avant d'appeler une méthode

Chaque méthode/événement de l'API porte une autorité (`authority-concepts.mdx`) :

| Autorité | Méthode appelable… | Événement déclenché… |
|---|---|---|
| **Server** | serveur seulement | serveur |
| **Client** | client seulement | client |
| **Authority** | côté qui a spawné l'entité | idem |
| **Network Authority** | serveur, ou client **si** joueur local = autorité réseau de l'entité | idem |
| **Both** | les deux | les deux |
| **Both (Net Authority First)** | événements seulement | les deux, client autorité d'abord |

Règles : une entité **spawnée serveur est synchronisée** partout ; spawnée client, elle **n'existe
que pour ce client** (l'envoyer au serveur = erreur). L'autorité réseau est **distribuée**
automatiquement (distance, possession, grab, conduite, tir) ; `Actor:SetNetworkAuthority(player)`
et `SetNetworkAuthorityAutoDistributed(bool)` (serveur) la forcent — **toujours rétablir** la
distribution auto ensuite. Debug : *Settings → Debug → Draw Network*.

**Le tirage de butin est une décision d'état de jeu : le serveur tire, le client reçoit.** Chaque
VM a son propre `math.randomseed` ; rejouer côté client donne un autre résultat.

## 6. Personnages — API vérifiée (`Character.json`, `BasePawn.json`, `BasePaintable.json`)

### Construire un personnage modulaire (convention des persos officiels, `default-characters-main`)
```lua
local c = Character(Vector(), Rotator(), "nanos-world::SK_Female")   -- mesh de base (SKEL_Mannequin)
-- Vêtements = skeletal meshes ATTACHÉS, même squelette obligatoire, suivent toutes les animations
c:AddSkeletalMeshAttached("clothes", "nanos-world::SK_CasualSet")
c:AddSkeletalMeshAttached("shoes",   "nanos-world::SK_Sneakers")
-- Yeux et cheveux = static meshes sur SOCKETS du squelette
c:AddStaticMeshAttached("eye_left",  "nanos-world::SM_Eye",       "eye_left")
c:AddStaticMeshAttached("eye_right", "nanos-world::SM_Eye",       "eye_right")
c:AddStaticMeshAttached("hair",      "nanos-world::SM_Hair_Kwang","hair_female")
-- Visage / morphologie = morph targets du mesh de base
c:SetMorphTarget("Nose_Width", 0.3)              -- valeur typique -0.5..0.5 ; GetAllMorphTargetNames() côté client
-- Matériaux : index -1 = tous ; attachable_id cible une pièce attachée
c:SetMaterial("nanos-world::MI_CasualSet_03", -1, "clothes")
c:SetMaterialColorParameter("Tint", Color(0.98,0.85,0.66), -1, "")      -- peau
c:SetMaterialColorParameter("TipColor", Color(0.07,0.03,0.00), -1, "hair")
```
Signatures exactes :
- `AddSkeletalMeshAttached(id, skeletal_mesh_path, socket="", relative_location=Vector(), relative_rotation=Rotator(), use_parent_bounds=true, use_base_leader_pose_component=true, animation_path="", attachable_id="")` — **both**. « must have the same skeleton used by this Actor's mesh ».
- `RemoveSkeletalMeshAttached(id)`, `AddStaticMeshAttached(id, static_mesh_path, socket="", rel_loc, rel_rot, use_parent_bounds=true, attachable_id="")`, `RemoveStaticMeshAttached(id)`, `SetStaticMeshAttachedTransform(id, loc, rot)` — both. `GetMesh()`, `SetMeshSettings(rel_loc, rel_rot=Rotator(0,-90,0), is_visible)`.
- `SetMesh(skeletal_mesh_asset)` — **server, lent** (change le mesh de base).
- `SetMorphTarget(name, value)` / `GetMorphTarget(name)` / `ClearMorphTargets()` — both ; `GetAllMorphTargetNames()` — client.
- `SetMaterial(material_path, index=-1, attachable_id="")`, `SetMaterialColorParameter(param, Color, index, attachable_id)`, `SetMaterialScalarParameter`, `SetMaterialTextureParameter(param, image_path, …)`, `SetMaterialVectorParameter`, `ResetMaterial(index, attachable_id)`, `SetPhysicalMaterial(path)` — both. `SetMaterialFromCanvas/FromSceneCapture/FromWebUI` — client.

### Animer (« aspect vivant »)
- `PlayAnimation(animation_path, slot_type=AnimationSlotType.FullBody, loop_indefinitely=false, blend_in_time=0.25, blend_out_time=0.25, play_rate=1.0, stop_all_montages=false)` — both, lent. Slots : `0 FullBody`, `1 UpperBody`, `2 Head`.
- Locomotion (server, blend spaces 2D) : `SetAnimationIdleWalkRunStanding(bs, enable_turn_in_place=false)`, `…Crouching`, `…Proning` ; transitions `SetAnimationsTransitionStandingCrouching(a, b)`, `…CrouchingProning(a, b)`.
- `SetSpeedMultiplier(f)` (server), `LookAt(location)` (server, IA), `GaitMode {0 None,1 Walking,2 Sprinting}`, `StanceMode {0 None,1 Standing,2 Crouching}`.
- Sons : `SetDeathSound`, `SetPainSound` (convention des persos officiels).

### Créatures non humanoïdes — `CharacterSimple` (`CharacterSimple.json`)
`Character` impose le Mannequin. **`CharacterSimple` accepte n'importe quel mesh, sans
contrainte de squelette** : « simpler Character implementation with basic Movement, aimed for
custom NPCs or basic Pawns ». C'est la classe des monstres, quadrupèdes, créatures.
```lua
local m = CharacterSimple(Vector(), Rotator(), "narvos::SK_Bear", "narvos::ABP_Bear", CollisionType.Auto, true)
--                                   mesh (SK ou SM)   custom_animation_blueprint   gravity_enabled
m:SetAnimationBlueprint(path)                        -- ABP custom (cuit dans le pack)
m:SetAnimationBlueprintPropertyValue("Speed", 300)   -- pilote les variables de l'ABP
m:CallAnimationBlueprintEvent("Roar")                -- déclenche un événement de l'ABP
m:BindAnimationBlueprintEventDispatcher(name, fn)    -- écoute un dispatcher de l'ABP
m:PlayAnimation(path, …)  m:SetMesh(path)            -- comme Character
```
Constructeur : `(location, rotation, mesh, custom_animation_blueprint="", collision_type=Auto,
gravity_enabled=true, spawn_mode=Immediate)`. Conséquence : l'animation d'une créature vit dans
**son Animation Blueprint** (asset cuit dans le pack), et Lua ne fait que lui parler par
propriétés/événements — même modèle que la classe `Blueprint` ci-dessous.

### Acteurs Blueprint — `Blueprint` (`Blueprint.json`)
« A Blueprint Class allows spawning **any** Unreal Blueprint Actor in nanos world. » Autorité
**both**, répliqué ; hérite `Entity → Actor → Paintable`.
```lua
local bp = Blueprint(Vector(), Rotator(), "narvos::BP_Turret", CollisionType.Auto)
bp:CallBlueprintEvent("Fire", target)                 -- both, lent ; retourne les valeurs côté client
bp:SetBlueprintPropertyValue("Range", 1500)           -- client
local v = bp:GetBlueprintPropertyValue("Range")       -- client
bp:BindBlueprintEventDispatcher("OnHit", function(...) end)   -- client ; Unbind(dispatcher[, cb])
```
C'est le pont « logique visuelle Unreal ↔ Lua ». À déclarer dans `Assets.toml` sous
`[assets.blueprints]`. ⚠ NON VÉRIFIÉ : ce qu'un Blueprint peut faire exactement côté réplication
(quels nœuds sont bloqués) — la doc ne le dit pas ; tester avant de s'y appuyer.

### Actor de base (`BaseActor.json`)
`SetScale/SetLocation/SetRotation` — authority ; `AttachTo(actor, AttachmentRule, bone_name, lifespan_when_detached, use_absolute_rotation)`, `Detach()` — authority. `AttachmentRule {0 KeepRelative, 1 KeepWorld, 2 SnapToTarget}`. `CollisionType {0 Normal,1 StaticOnly,2 NoCollision,3 IgnoreOnlyPawn,4 Auto}`. `SetDimension(int)` — server.

## 7. Caméra isométrique — natif

Enums vérifiés : `ViewMode {0 FPS, 1 TPS1, 2 TPS2, 3 TPS3, **4 TopDown**}`,
`CameraMode {0 FPSTPS, 1 FPSOnly, 2 TPSOnly}`.

| Méthode | Autorité | Note |
|---|---|---|
| `Character:SetViewMode(ViewMode.TopDown)` | network-authority | bascule top-down |
| `Character:SetCameraMode(CameraMode.TPSOnly)` | server | interdit le FPS |
| `Player:SetCameraArmLength(len, force=false)` / `GetCameraArmLength(return_base=false)` | both / client | distance |
| `Player:SetCameraRotation(rot)` / `RotateCameraTo(rot, time, exp=0)` | both | pitch iso |
| `Player:SetCameraSocketOffset(vec)` | both | décalage spring arm |
| `Player:SetCameraLocation(vec)` / `TranslateCameraTo` / `SetCameraFOV(fov=90)` / `SetCameraSpeedSettings` | both | **uniquement hors possession** d'un Character |
| `Player:AttachCameraTo(actor, socket_offset, blend_speed)` / `ResetCamera()` | both | |

**Aucun `LockViewMode` n'existe** (vérifié) : le joueur peut changer de vue ; réimposer angle et
distance côté client si nécessaire. Une caméra iso n'allège rien en soi ; elle **borne le frustum**
(pas d'horizon, distance fixe → un seul LOD utile, assets low-poly acceptables). nanos n'expose
**aucun CVar/scalabilité** depuis Lua (seulement `Console.Log/Warn/Error/Debug`).

## 8. Serveur et performance (`server-configuration.mdx`)

### Lancer le serveur

```
cd "D:\steam\steamapps\common\nanos-world-playtest\Server"; .\NanosWorldServer.exe --playtest
```

⚠ **`--playtest` est obligatoire** tant que le client installé est la build Playtest — c'est écrit
dans `quick-start.mdx:141` : « If you are running a Playtest game, you must also start the server
with the `--playtest` flag, otherwise it will not be able to connect to the game. »

Ce piège coûte cher parce qu'il ne ressemble pas à ce qu'il est. Sans le flag, le serveur tourne
sous un autre AppID Steam : il démarre normalement, charge les packages, affiche `Server started!`
et `connected to Steam! VAC Secure!` — puis ignore en silence les paquets UDP du client. Le client
échoue sur `5003 (Timed out attempting to connect)` après exactement 10 s. **Rien dans la console du
serveur ne le laisse deviner.** On croit à un problème de réseau et on perd du temps sur les ports,
le pare-feu et les jonctions — tout cela était sain.

Le seul indice est côté client :

```
WARNING  Running Playtest App ID!
INFO     Disconnected. Connection '#... UDP invalid@127.0.0.1:7777'. Reason: 5003
```

dans `%LOCALAPPDATA%\NanosWorld\Saved\Logs\`. Les deux côtés ne vident leur log sur disque **qu'à la
fermeture** : le `NanosWorldCore.log` du processus en cours fait 0 octet. Lire le fichier horodaté
de la session précédente, pas celui qui porte le nom nu.

Note transport : la connexion de jeu est **UDP**. Sonder le TCP 7777 ne prouve rien — il accepte
alors que l'UDP reste muet.

### Réglages



`max_tick_rate` 15–120 Hz, **30 recommandé** (33 ms par tick, tout s'y passe) ; `max_sync_rate`
1–30 Hz (moins = moins de bande passante, mouvement moins précis) ; `max_send_rate` 128–16384 KB/s
par client (P2P plafonné 1024). `profiling = true` ou commande `profiling` ; Tracy pour le
profilage natif. Côté assets : LODs (la doc recommande 3), instancing via Forge quick-instancer.

## 9. Pièges — chacun a coûté du temps, aucun n'est théorique

**Unreal / assets**
- **Un `.uasset` porte son chemin de package en dur.** Copier `Content/AnimalVarietyPack/` sous
  `Content/NARVOS/AnimalVarietyPack/` par l'explorateur laisse des assets qui se croient à
  `/Game/AnimalVarietyPack/…` : aucune référence ne résout (« Unable to retrieve target USkeleton »,
  180 000 lignes de log pour 44 packs). Déplacer **par l'éditeur** (Fix Up Redirectors), ou remettre
  au chemin déclaré (`scripts/unreal-audit-package-paths.mjs` + `unreal-fix-package-paths.mjs`).
- Un package enregistré par 5.8 **ne se charge pas** en 5.7 (refus net, pas dégradation). Marque
  `++UE5+Release-5.8` dans l'en-tête. UniGLB 1.1 avait son Content en 5.8 → on utilise la 1.0.
- **`VA_*_VrmAssetList`** sont des UObject UniGLB : un asset cuit qui les référence exigerait le
  plugin côté nanos, non whitelisté. **Les supprimer avant de cooker.**
- Le nom du dossier d'un plugin fait partie du contrat (`FindPlugin("<nom>")` déréférencé sans
  test) : `AscentCombatFramework`, `BaconComboGraph`, `SkyCreatorPlugin`, `OverCrowd`.
- `Plugins/` est parcouru **récursivement** : un sous-dossier d'archive y est installé de fait
  (collision `CS0229` sur deux `UniGLB.Build.cs`).
- Compiler ≠ charger : un plugin moteur non activé dans le `.uproject` compile mais sa DLL manque
  au démarrage (`Missing import: UnrealEditor-Mover.dll`). `scripts/unreal-resolve-plugin-deps.mjs`.
- `VRM4UE5` et `UniGLB` sont **mutuellement exclusifs** (51 UClass homonymes → double
  registration fatale).

**Lua / nanos**
- `Package.Require("X.lua")`, jamais `require("X")` (§4).
- Tables 1-based ; `pairs` **sans ordre garanti et différent d'une VM à l'autre** → tout tirage
  indexé doit lire une séquence figée (`*_ORDER`, générée dans l'ordre d'insertion TS).
- Un champ à `nil` **disparaît** de la table (impossible de distinguer « vidé » de « absent » ;
  `pairs` sur une table de slots ne voit pas les slots vides → itérer une liste de slots).
- `t[nil] = v` est une **écriture illégale** (« table index is nil ») là où JS accepte `undefined` ;
  `nil < 0` lève là où JS compare. Valider les types **avant** d'indexer/comparer dans tout
  garde-fou destiné à des données externes (sauvegardes).
- `math.floor(x + 0.5)` = `Math.round` ; `%.0f` et `%d` font de l'arrondi bancaire.
- `for i = 1, n` tronque un `n` fractionnaire ; `i < n` en JS arrondit au supérieur → `math.ceil`.
- `#t` est indéfini sur une table à trous ; `ipairs` s'arrête au premier `nil`.
- `os.time()` est en **secondes** : pas d'identifiant unique dessus (compteur monotone).

### Mesuré le 2026-09-03 — quatre pièges payés en une session

**`Reliability.Reliable` est OBLIGATOIRE en 2ᵉ argument, client → serveur.**
```lua
Events.CallRemote("Narvos:X", Reliability.Reliable, params)   -- ✅
Events.CallRemote("Narvos:X", params)                          -- ❌ muet
```
L'omettre ne lève RIEN : le premier argument utile est pris pour la fiabilité, la
charge utile se perd, et le serveur ne voit jamais l'appel. Cinq relais étaient
muets et l'écran de création paraissait simplement inerte au clic. La doc le
confirme (`events.mdx:41`). Le sens serveur → client, lui, intercale le `player` :
`Events.CallRemote("X", player, Reliability.Reliable, ...)`.

**`local function` déclarée APRÈS son appelant se résout en GLOBAL nil.**
Rencontré **cinq fois** dans une seule session, jamais visible au chargement :

| Symptôme observé | Cause |
|---|---|
| aucun aperçu 3D, jamais | `SessionDans` appelée 9 lignes avant sa déclaration |
| entrer en jeu plante | `DetruireApercu` appelée 48 lignes avant |
| F3 et molette lèvent | `CreationOuverte` déclarée 50 lignes après ses `Input.Bind` |
| plantage à la déconnexion | `arme_suivante` déclarée 600 lignes après sa purge |

Deux règles qui l'éliminent : **les tables indexées par joueur se déclarent
ensemble, en tête du fichier** (le `Player.Subscribe("Destroy")` qui les purge est
presque toujours écrit avant le code qui les remplit) ; et toute fonction appelée
plus haut se déclare en avant, puis **s'assigne** — `X = function()`, jamais
`local function X`, qui recréerait un second local.

⚠ `scripts/lua-harness/syntaxe-check.mjs` ne l'attrape PAS : `load()` valide la
grammaire, pas la portée. Le seul contrôle est de comparer les numéros de ligne.

**Un WebUI ne reçoit pas les `CallEvent` émis dans le même tick.**
`WebUI(...)` rend l'objet immédiatement, mais la page n'a pas chargé : ses
`Events.Subscribe` (posés au `DOMContentLoaded`) n'existent pas encore. Le message
tombe dans le vide et l'écran reste noir, sans erreur. Il faut **tamponner** le
dernier état côté Lua et laisser la page le réclamer quand elle est prête :
```lua
Events.Subscribe("MonUI:Pret", function() ui:CallEvent("Etat", dernier_etat) end)
```

**Le mesh de base d'un `Character` doit être un asset PROUVÉ monté.**
`nanos-world::SK_Male` est cité par la doc, mais rien ne garantit qu'il soit monté
sur un serveur donné. Un mesh introuvable ne lève pas : nanos affiche la **capsule
de collision**, un cylindre blanc. Préférer un asset de son propre pack, vérifié
présent dans `Assets.toml`.

**Réparer un pack PROMU dont les références sont mortes, et le poser sur SKEL_Mannequin**
(prouvé le 2026-09-11 : Defender 33/33 maillages humains, Freeflow 118/118 animations).
`SkeletalMesh.skeleton` est **[Read-Only]** en Python 5.7, sans setter : on ne « réassigne »
pas. Méthode : dupliquer chaque miroir à l'ancien chemin, charger les référents,
`consolidate_assets(miroir, [duplicata])`, puis `consolidate_assets(SKEL_Mannequin, [squelette])`,
enfin `reload_packages` + resauvegarde — `scripts/adk-reparer-squelettes-promus.py` et
`scripts/adk-recharger-et-resauver.py`. ⚠ **Un asset chargé pendant que sa référence est
morte la garde NULLE** même après réparation : toute sonde qui fait `load_asset` AVANT la
réparation l'empoisonne ; seul le rechargement du paquet la relève. Témoin : la table de
noms du `.uasset` relue sur disque.

## 10. Outillage du dépôt (`scripts/`, simulation par défaut, `--apply` pour écrire)

| Script | Rôle |
|---|---|
| `unreal-plugins-migrate.mjs` | enveloppe un `Source/` nu en plugin (`.uplugin` + `Source/<Module>/`) |
| `unreal-fix-includes.mjs` | `Runtime/<Mod>/Public\|Classes/X` → `X` (jamais `Private/`) |
| `unreal-fix-json-literals.mjs` | `TEXT()` sur les littéraux des accesseurs FJsonObject |
| `unreal-plugin-toggle.mjs` | `list` / `on` / `off` par `.uplugin` (`UE_PLUGINS_ROOT`) |
| `unreal-make-57-project.mjs` | projet 5.7 depuis le 5.8 (V7→V6, renommages, dossiers requis) |
| `unreal-resolve-plugin-deps.mjs` | active les plugins moteur exigés par les `.Build.cs` |
| `unreal-uniglb-headless.mjs` | gardes `!IsRunningCommandlet()` + `UPROPERTY` exposées à Python |
| `unreal-stage-models.mjs` | copie les packs GLB dans `ImportSources/` (+ `_Animations`) |
| `unreal-audit-glb.mjs` | squelette/convention/animations par GLB ; `--json` → manifeste 2 passes |
| `unreal-audit-package-paths.mjs` / `unreal-fix-package-paths.mjs` | assets déplacés hors éditeur |
| `adk-setup-import.mjs` | rend l'ADK C++ (module minimal), installe UniGLB + scripts d'import |
| `narvos-catalogs-to-lua.mjs` | **exécute** les catalogues TS (esbuild) → `Shared/Catalogs/*.lua` + `*_ORDER` |
| `lua-harness/` | wasmoon (Lua 5.4 réel) : `run.mjs` 160 assertions, `loot-smoke.mjs` |

`packages/narvos/` : `Shared/Catalogs/` = **généré** (ne pas éditer) ; `Shared/Logic/` = **écrit**
(`Loot.lua`, `Inventory.lua`) ; `Shared/Index.lua` câble tout via `Package.Require`.

## 11. Ce que ce skill ne garantit PAS

- **Rien n'a encore été chargé dans nanos** (ni `Package.Require` serveur, ni client). Le Lua est
  validé sous wasmoon, pas dans le moteur. `Console.Warn` supposé exister.
- L'API complète est dans `github.com/nanos-world/api` — 36 fichiers `Classes/*.json`
  (`BaseActor, BaseDamageable, BaseEntity, BasePaintable, BasePawn, BasePickable, BaseVehicle,
  Billboard, Blueprint, Cable, Canvas, Character, CharacterSimple, Database, Decal, File, Gizmo,
  Grenade, InstancedStaticMesh, Light, Melee, Particle, Player, Prop, SceneCapture, Sound,
  StaticMesh, Text3D, TextRender, Trigger, VehicleWater, VehicleWheeled, Weapon, WebUI, Widget,
  Widget3D`) + `Enums.json`, `StaticClasses/`, `Structs/`. **Aller lire le JSON avant d'affirmer
  une signature** ; la doc locale ne les contient pas.
- Import headless (commandlet) : la conversion tourne mais les sous-assets ne sont pas persistés
  (seul `VA_*` écrit). Importer **depuis l'éditeur** (Tools → Execute Python Script).
- Object2Lua, WBP_LuaCodeGenerator, le cook Forge : lus dans la doc, **jamais exécutés ici**.

## 12. Plusieurs maps dans un serveur : les DIMENSIONS (vérifié 2026-09-03)

nanos ne charge **qu'un seul niveau**. Nos maps ne sont pas des Level : ce sont
des paquets de `StaticMesh` posés par `MapLoader`. « Changer de map » se ferait
donc en DÉCHARGEANT la précédente — et le monde changerait sous les pieds des
joueurs restés derrière.

Les **dimensions** règlent exactement ça. Source : `docs/core-concepts/scripting/dimensions.mdx`.

- Jusqu'à **65 535** dimensions ; tout le monde démarre en **1**.
- `actor:SetDimension(n)` — un acteur d'une autre dimension est DÉTRUIT côté
  client pour les joueurs qui n'y sont pas, et respawné quand ils y entrent.
- Hiérarchie : envoyer un **Player** emmène son **Character**. Envoyer un
  **Character** n'emmène PAS le Player, mais bien ses armes et props tenus.
- ⚠ **Envoyer un véhicule en fait sortir tous les personnages.** Un voyage
  « en vaisseau » ne peut donc pas déplacer le véhicule et son pilote d'un seul
  geste : déplacer le joueur, puis le véhicule, et le laisser rembarquer.
- `Events.BroadcastRemoteDimension(nom, dimension, Reliability.Reliable, ...)`.
- Une entité passée en argument d'un événement distant vers un joueur d'une
  AUTRE dimension arrive à `nil`, avec un avertissement.

**Ordre qui compte** : `SetDimension` PUIS `SetLocation`. L'inverse fait
traverser l'ancien monde jusqu'aux coordonnées du nouveau — chute à travers le
décor, ou apparition d'un instant dans un mur.

**Poser la dimension à la CRÉATION du mesh**, jamais après : `SetDimension` sur
un acteur déjà vu le fait disparaître chez le joueur, et le décor entier
scintille. C'est pourquoi `MapLoader.Charger` accepte `options.dimension` et
l'applique mesh par mesh.

Implémentation NARVOS : `Shared/Catalogs/Mondes.lua` (mondes + passages),
`Shared/Logic/Voyage.lua` (règles, testable), `Server/Voyage.lua` (Trigger,
chargement paresseux, téléportation).

### Ce que nanos n'a PAS

Aucune classe de véhicule volant. `VehicleWheeled` et `VehicleWater`, rien
d'autre. `Character:SetFlyingMode(bool)` existe et coupe la gravité — c'est ce
qu'emploie le package officiel `deathmatch` pour ses spectateurs — mais c'est un
personnage qui vole, pas un appareil.

## 13. Le pont WebUI → Lua ne porte PAS les objets (vu en jeu, 2026-09-04)

**`Events.Call` depuis un WebUI transporte des chaînes et des nombres. Un objet
JavaScript ne passe pas** — et rien ne le signale : pas d'exception côté page,
pas de log côté Lua, l'abonné n'est simplement jamais appelé.

Mesuré sur l'écran de création, huit appels, deux comportements :

| Appel | Argument | Arrive ? |
|---|---|---|
| `Connexion`, `Inscription` | deux chaînes | oui |
| `Choisir`, `Supprimer` | une chaîne | oui |
| `Steam`, `Pret` | rien | oui |
| **`Apercu`** | `{genre, corps, tenue}` | **NON** |
| **`Creer`** | `{nom, corps, class_id, …}` | **NON** |

Conséquences vues à l'écran : **aucun aperçu 3D** (une capsule de collision
blanche à la place du mannequin) et **le bouton CRÉER sans aucun effet**. Deux
symptômes très différents, une seule cause.

### ⚠ L'asymétrie est réelle

Le sens **Lua → WebUI porte bien les tables**. C'est ainsi que partent les
3 factions, les 17 corps et les 116 pièces modulaires, et ça marche. Ne pas en
déduire que l'inverse fonctionne — c'est exactement le raisonnement qui a laissé
ce défaut ouvert une journée.

### La parade

```js
// page
const structureVersLua = (nom, objet) => Events.Call(nom, JSON.stringify(objet));
```

```lua
-- Lua : accepter les DEUX formes, pour ne rien casser si nanos évolue
local function Decoder(params)
    if (type(params) == "table") then return params end
    if (type(params) ~= "string") then return nil end
    if (JSON == nil or JSON.parse == nil) then return nil end
    local ok, decode = pcall(JSON.parse, params)
    return (ok and type(decode) == "table") and decode or nil
end
```

`JSON.parse` est documenté côté Lua (`file.mdx`).

### Comment le diagnostiquer en dix secondes

Poser la trace **AVANT toute garde**, des deux côtés :

```lua
Events.SubscribeRemote("Narvos:X", function(player, params)
    Console.Log("[NARVOS] X recu — type=" .. type(params))   -- premiere ligne
```

Aucune trace serveur = l'événement ne quitte pas le client. Une trace avec
`type=string` là où on attendait `table` = le pont a serialisé. Une trace après
une garde ne distingue pas « jamais arrivé » de « refusé » — deux causes
opposées.

## 14. Recevoir d'un WebUI : `ui:Subscribe`, JAMAIS `Events.Subscribe`

**C'est le défaut le plus coûteux du portage.** Vingt-cinq abonnements posés sur
la mauvaise API : toutes les interfaces s'affichaient, aucune ne pouvait agir.

```lua
-- ❌ ne reçoit RIEN d'un WebUI, et ne lève pas
Events.Subscribe("MonEvenement", fn)

-- ✅ la seule forme documentée
mon_ui:Subscribe("MonEvenement", function(param) … end)
```

Sources : `docs/scripting-reference/classes/webui.mdx:81`, sous le commentaire
« Subscribes to receive JS events » ; `core-concepts/scripting/user-interface.mdx`
lignes 27 et 31. Aucun exemple de la doc n'emploie le `Events` global pour ça.

### Les trois sens, et pourquoi deux d'entre eux trompent

| Sens | API | Correct ? |
|---|---|---|
| serveur → client | `Events.SubscribeRemote(...)` | ✅ global |
| Lua → page | `ui:CallEvent(...)` | ✅ instance |
| **page → Lua** | **`ui:Subscribe(...)`** | ✅ **instance** |

Les deux premiers marchaient. L'écran de création affichait donc ses 3 factions,
ses 17 corps et ses 116 pièces — toutes les apparences d'un pont fonctionnel. Il
ne fonctionnait que dans un sens, et rien ne le disait : pas d'exception Lua, pas
d'erreur JavaScript dans le log CEF, aucune trace nulle part.

### Conséquence pratique : abonner APRÈS la création

Une page créée paresseusement n'a pas d'instance au chargement du package. Les
gestionnaires s'enregistrent donc dans une table, et se posent dès que le WebUI
existe :

```lua
local abonnes = { hud = {}, creation = {} }
local function Page(cle, nom, fn) abonnes[cle][nom] = fn end
local function BrancherPage(cle, ui)
    for nom, fn in pairs(abonnes[cle] or {}) do ui:Subscribe(nom, fn) end
end
-- puis, juste après WebUI(...) :  BrancherPage("creation", Creation)
```

⚠ Pour une page dont les gestionnaires sont enregistrés tout au long du fichier,
brancher EN FIN DE FICHIER — sinon seuls les premiers sont posés.

### Le contrôle qui l'aurait attrapé en une commande

Croiser ce que les pages ÉMETTENT avec ce que le Lua ÉCOUTE :

```bash
grep -rhoE 'Events\.Call\("[^"]+"' Client/UI/ | sort -u    # emis
grep -oE 'Subscribe\("([^"]+)"' Client/Index.lua | sort -u  # ecoutes
```

Le même croisement a révélé un second trou : `NarvosCreation:Steam` était émis
par le bouton « Continuer » et n'avait **aucun** abonné.

## 15. Les noms de touches ne sont pas ceux qu'on croit

```
Registering Input 'NarvosTouche_0' for an unknown Key '0'! Did you mean 'Zero'?
```

Les chiffres s'écrivent **`One`, `Two`, … `Nine`, `Zero`** (`input.mdx:116-125`),
jamais `"1"`. Le pavé numérique est séparé : `NumPadOne`… (`input.mdx:161-170`).
Lettres et `F1`..`F12` passent telles quelles (`input.mdx:60-71`, `78-103`).

⚠ Convertir au SEUL point d'appel d'`Input.Register`. Faire remonter le nom
moteur jusqu'au catalogue de touches ferait afficher « One » au joueur dans
l'écran de réglages.

⚠ NON RÉSOLU : `MouseScrollUp` / `MouseScrollDown` sont documentés
(`input.mdx:183-184`) et REFUSÉS par le client 1.152.2, sans suggestion. La doc
locale et le moteur installé divergent. Ne pas inventer un nom de remplacement —
une liaison morte de plus serait tout aussi muette.


## 16. Mutable EST whitelisté — correction du 2026-09-04

J'ai écrit dans ce skill que « aucun plugin C++ tiers ne s'exécute dans nanos »,
et j'en ai conclu que Mutable était hors de portée. **La conclusion était fausse.**

`docs/assets-modding/whitelisted-ue-plugins.mdx` distingue deux listes :

| section | ce que ça veut dire |
|---|---|
| **External Plugins** | à installer soi-même, **version imposée** — Kawaii Physics `v1.19.1`, Ultra Dynamic Sky `v8.3A` |
| **Native Plugins** | *« You can just enable them in Plugins panel »* |

**Mutable est dans les natifs** (ligne 53). Y figurent aussi, et ça compte pour
NARVOS : **Rig Logic (MetaHuman)**, Pose Search, Animation Warping, Motion
Warping, Chooser, Motion Trajectory, Gameplay Abilities, PCG, Hair Strands,
Mover, Geometry Scripting, Niagara Fluids.

La règle exacte est donc : **aucun plugin HORS de ces deux listes ne tourne**.
Les 20 plugins C++ de `NarvosUE57` (ACF, FastAI, DragonIK, FGear…) restent
exclus — mais ne pas en déduire que la liste est vide.

### L'API Blueprint de Mutable — relevée dans la source 5.7 le 2026-09-04

`D:/Epic Games/UE_5.7/Engine/Plugins/Mutable/Source/CustomizableObject/Public/MuCO/`

**Aucun C++ à écrire.** Tout le pilotage runtime est exposé au Blueprint :

| classe | ce qu'elle expose |
|---|---|
| `UCustomizableSkeletalComponent` | `UCLASS(Blueprintable, BlueprintType, meta = (BlueprintSpawnableComponent))` — **posable dans un BP**. 10 `BlueprintCallable` : `SetCustomizableObjectInstance`, `SetComponentName`, `UpdateSkeletalMeshAsync`, `UpdateSkeletalMeshAsyncResult` |
| `UCustomizableObjectInstance` | **~30 `BlueprintCallable`** : `SetIntParameterSelectedOption(FString, FString, int32)`, `SetFloatParameterSelectedOption`, `SetColorParameterSelectedOption(FString, FLinearColor)`, `SetBoolParameterSelectedOption` |
| — | `UPROPERTY(Transient, BlueprintAssignable) FObjectInstanceUpdatedDelegate UpdatedDelegate` |

⚠ **LE BP EST NÉCESSAIREMENT ÉVÉNEMENTIEL.** `UpdateSkeletalMeshAsync` et le
`UpdatedDelegate` : on pose les paramètres, on lance l'update, **on attend le
délégué**. Lire le mesh à la ligne suivante ne rend rien. C'est ce que veut dire
« le BP doit être fait d'une façon particulière, ça fonctionne par threads ».

Les types en jeu (`FString`, `float`, `FLinearColor`, `bool`) traversent tous le
pont Lua ↔ BP : un `CallBlueprintEvent("SetTenue", "torse_a", 3)` suffit à piloter
une instance, et un `BindBlueprintEventDispatcher` à recevoir la fin de l'update.

### Ce qui reste à trancher

Le blocage n'est PAS l'API Mutable — c'est le pont. Voir §17 : `Character` ne
traverse pas, et `Character:SetMesh` prend un **chemin d'asset**, pas un pointeur,
alors qu'un mesh généré au runtime n'a pas de chemin. Comment le corps fusionné
rejoint le `Character` nanos reste **non prouvé**.

Le chemin sûr en attendant reste le **bake hors ligne** — le commandlet
`COIBakingTest` rend des SkeletalMesh ordinaires, fusionnés et sections masquées,
livrables comme n'importe quel asset.

C'est précisément ce que `AddSkeletalMeshAttached` ne sait pas faire : masquer
les sections du corps sous un vêtement. D'où l'interpénétration visible en jeu.

## 17. Le pont Lua ↔ Blueprint — ce qui rend Mutable envisageable

nanos expose une classe `Blueprint` (`docs/scripting-reference/classes/blueprint.mdx`) :

```lua
local bp = Blueprint(Vector(), Rotator(), "narvos::BP_MonPerso")
bp:CallBlueprintEvent("SetTenue", "torse_a", "jambes_b", 3)
bp:BindBlueprintEventDispatcher("Pret", function(self, arg) … end)
```

Un Blueprint spawné côté SERVEUR est répliqué automatiquement, comme toute
entité nanos.

### Types qui traversent (table complète du doc)

`Boolean` · `Byte` · `Integer` · `Integer64` · `Float` · `Enum` · `String` ·
`Name` · `Text` · `Vector2D` · `Vector` · `Rotator` · `Color` · `LinearColor`,
plus les classes nanos `StaticMesh`, `Prop`, `Weapon`, `Vehicle`, `Grenade`,
`Melee`, `Light`, `Decal`, `TextRender`, `Sound`, et `Canvas`/`WebUI` en
aller simple (Lua → BP seulement).

### ⚠ Ce qui NE traverse pas : `Character`

`Character` est ABSENT de la table. On ne peut donc pas confier le personnage du
joueur à un Blueprint. C'est LA contrainte qui décide de l'architecture d'une
customisation par Mutable :

| brique | qui la tient |
|---|---|
| déplacement, caméra, collision, possession | `Character` nanos |
| génération du corps fusionné | Blueprint + CustomizableObjectInstance |
| lien entre les deux | **non prouvé** |

Le test qui tranche, et il est court : un `BP_Test` portant un Customizable
Object, spawné depuis Lua, et voir s'il s'affiche et se laisse attacher au
Character. Tant qu'il n'est pas fait, ne rien affirmer sur Mutable au runtime.

### Pourquoi ça vaut le détour — l'argument de perf

Un personnage composé par `AddSkeletalMeshAttached` porte **un composant
skeletal par pièce**. Avec le corps et 8 slots, c'est 9 composants par joueur —
**3 600 pour 400 joueurs**, chacun skinné et dessiné séparément.

Mutable fusionne en UN mesh et compose les textures en un seul matériau : 400
composants au lieu de 3 600. C'est aussi la seule voie qui masque les sections du
corps sous un vêtement — ce que l'attachement ne sait pas faire, d'où
l'interpénétration visible en jeu.

⚠ **CE QUI COÛTE N'EST PAS L'ANIMATION.** `AddSkeletalMeshAttached` a
`use_base_leader_pose_component = true` **par défaut** (7ᵉ paramètre, cf. § API).
Leader pose = les composants attachés **n'évaluent pas leur propre anim graph**,
ils copient les transforms du leader. **Une évaluation par personnage, pas une
par pièce.**

Ce qui monte avec le nombre de pièces : draw calls, skinning GPU, tick et render
state par composant, copie des transforms vers chaque suiveur. Réel, mais ce
n'est pas « calculer N personnages par tick ». Ne pas reprendre cet argument-là :
il est faux et il décrédibilise le vrai, qui tient tout seul.

## 18. Cacher le corps de base — la fin de « l'ancienne tenue »

`Pawn:SetMeshSettings(relative_location, relative_rotation, visible)` rend le mesh
principal d'un `Character` **invisible**. Vérifié dans le client 1.152.2 : la
méthode figure dans la table de binding Lua (voisine de `SetFlyingMode`,
`SetCanCrouch`), et les chaînes `relative_location`, `relative_rotation`,
`is_visible`, `visible` sont dans le binaire. Absente de la doc locale.

⚠ Le blog de juillet 2026 note un correctif « `visible` wrong default parameter ».
**Passer les trois arguments explicitement**, jamais s'appuyer sur le défaut.

### Ce que ça change

Avant, le mesh donné à `Character()` était un personnage COMPLET, vêtements
cuits dedans ; empiler une tenue par-dessus donnait deux couches qui
s'interpénètrent aux jointures. Maintenant le porteur est caché et ne sert plus
qu'à trois choses invisibles : squelette, animation, capsule.

Tout ce qui se voit vient d'un slot, **peau comprise**. Une armure occupe le slot
`torse` et la pièce de peau en sort : elle REMPLACE au lieu de recouvrir.

Condition : la famille doit livrer une peau découpée par slot. Les deux packs le
font (`sk_male_form_upper/legs/hands/feet/head`, `body_chest_m/legs/hands/face`),
et `Modular.PorteurCachable(famille, genre)` le vérifie avant de cacher — sans
peau découpée, cacher rendrait le joueur invisible.

## 18 bis. Porter un MetaHuman sur le Character nanos — le pont par retarget vivant

Écrit le 2026-09-11, **[À VÉRIFIER EN JEU]** : rien n'a encore tourné.

Un vêtement MetaHuman (squelette 342 os) ne suit PAS le Character en leader pose :
40 à 67 % de son poids tombe sur des os absents de SKEL_Mannequin (§33). Le pack
Meta Customization System montre la voie dans ses propres BP « Playable » : un mesh
pilote invisible joue les animations, le MetaHuman COPIE sa pose par retarget.

| pièce | rôle | fabriquée par |
|---|---|---|
| `IK_NanosMannequin` | rig source, sur `/Game/NanosWorld/Characters/Mannequin/SK_Mannequin` (la pose de référence réelle du runtime) | `scripts/adk-pont-metahuman.py` `etape_rigs()` |
| `IK_NarvosMetaHuman` + `RTG_NanosVersMetaHuman` | rig cible + retargeter ; UE 5.6+ : **pile d'opérations** (`add_default_ops()`, sinon il ne bouge rien) ; correspondance EXACT | idem |
| `ABP_NanosVersMetaHuman` | ABP du pack DUPLIQUÉ (Python ne crée pas de nœud de graphe), nœud `RetargetPoseFromMesh` en `PARENT_SKELETAL_MESH_COMPONENT`, retargeter remplacé | `etape_abp()` |
| `BP_NarvosMH_*` | un Blueprint par pièce, **sans graphe** : racine = SkeletalMeshComponent + cet ABP (`SubobjectDataSubsystem.make_new_scene_root`) | `etape_porteur()` |

Côté Lua (`narvos-map-proto/Server/MetaHumain.lua`) : `Blueprint(...)` puis
`AttachTo(character, AttachmentRule.SnapToTarget, "root")` — un NOM D'OS fait
attacher au maillage, dont le nœud copie la pose (parent = le SkeletalMeshComponent
qui anime). Noms de binding vérifiés dans `NanosWorldServer.exe` le 2026-09-11 :
`RemoveAllSkeletalMeshesAttached`, `RemoveAllStaticMeshesAttached`, `ResetMaterial`,
`SetMeshSettings`, `GetControlledCharacter`, `AttachTo`, `SetMaterial`.

⚠ **Le porteur doit rester RENDU.** Caché par `SetMeshSettings(…, false)`, un mesh
peut cesser de rafraîchir ses os hors rendu (`VisibilityBasedAnimTickOption`) : le
MetaHuman figerait. D'où `Mat_Invisible` (le matériau que le pack pose sur son pilote)
sur tous ses slots. Hypothèse non mesurée — `/metahumain porteur cache` bascule
l'autre méthode pour trancher à l'écran.

## 19. Deux squelettes dans SciFi_Trooper_Set — mesuré le 2026-09-04

Les 127 GLB du pack se répartissent **sans recouvrement** :

| os | nombre | premiers os | usage |
|---|---|---|---|
| 68 | 67 | `root, pelvis, spine_01…` | armure, corps nu → `AddSkeletalMeshAttached` |
| 2 | 60 | `root_heaD, head_acc` | coiffures, barbes, accessoires de tête |

`AddSkeletalMeshAttached` exige le **même squelette** que le corps : une coiffure
importée en SkeletalMesh serait refusée. Elles s'importent donc en **StaticMesh**
(`NARVOS_STATIC=1` dans `adk-import-narvos.py`, qui pose
`force_all_mesh_as_type = IFMT_STATIC_MESH`) et s'attachent par
`AddStaticMeshAttached(id, mesh, "head")` — `head` fait partie des 68 os, donc le
socket existe sur toutes les morphologies.

Conséquence dans `Builder.Habiller` : **appeler les DEUX retraits** sur chaque
slot. `RemoveSkeletalMeshAttached` ne retire pas un StaticMesh et réciproquement ;
n'en appeler qu'un laisserait la coiffure sous le casque.

## 20. Un manifeste d'import DOIT porter `racine`

`adk-import-narvos.py` la lit sans défaut (`donnees["racine"]`). Un manifeste sans
elle s'arrête sur `KeyError: 'racine'` — et comme la chaîne enchaîne, le cook
tourne ensuite dix minutes pour rien. C'est la **racine commune des packs**
(`WebPortal/public/models`), pas le dossier du pack courant.

Forme minimale :

```json
{ "racine": "…/WebPortal/public/models",
  "fichiers": [ { "fichier": "<chemin ABSOLU>", "verdict": "…", "os": 0 } ] }
```

Le chemin doit être **absolu** : Interchange résout un chemin relatif depuis
`Engine/Binaries/Win64/` et répond « There was no data to import ». Piège déjà
payé deux fois sur ce projet.

## 21. `nanos-build-asset-pack.mjs` SIMULE sans `--apply`

Sans le drapeau, il affiche ce qu'il ferait, écrit **« Rien écrit. »** et sort en
**code 0**. `Assets.toml` reste alors périmé — et la vérification qui suit
signale des références mortes pour des assets pourtant bien cuits.

Symptôme exact rencontré le 2026-09-04 : `StaticMesh 4461 → 4485` dans
l'inventaire (le cook avait bien pris les 24 coiffures), mais
`Modular 150 references — 17 MORTE(S)`. Chercher la cause côté cook ou côté
catalogue aurait été une perte de temps : elle était dans un drapeau.

## 22. Copier des `.uasset` d'un pack tiers dans l'ADK

Voie **beaucoup** plus sûre que l'import GLB quand le pack est déjà en `.uasset` :
un pack Unreal 4.26 se charge tel quel en 5.7 (vérifié : 24/24 assets, 0 illisible).

⚠ Mais ses **références internes cassent**. Le pack d'origine se monte sous
`/Game/<Pack>/…` ; dans l'ADK il vit sous `/Game/Narvos/<Pack>/…`. Les matériaux
ne résolvent plus, et les meshes sortent **gris** — mesuré : 24/24 sans matériau
après copie.

Le rebranchement par **nom de slot** ne marche pas toujours : les slots portent
souvent des noms d'atelier (`Hair`, `Hat`, `lambert1`, `China_mat`), pas des noms
de matériau. Sur les 24 coiffures Stylized, un seul slot correspondait.

La voie qui a marché : apparier par le **nom du mesh**, avec une table explicite
(`scripts/adk-rebrancher-coiffures.py`). 24/24 rebranchés, 26 slots.
Un mesh sans correspondance est laissé INTACT et signalé — une coiffure grise
nommée vaut mieux qu'un cheveu texturé avec de la peau, qu'on prendrait pour un
bug de rendu.

⚠ Toujours **sauver après chaque mesh** : la compilation des textures est
asynchrone, et un `save_directory` groupé écrit des matériaux avant que leurs
images existent.

## 23. Corps morphable — la chaîne complète, faite le 2026-09-04

`base_morphable` porte **290 morph targets nommés**, pilotables par
`SetMorphTarget(nom, valeur)`. C'est le SEUL corps du jeu qui en a.

### Ce qui rend la chose possible

Le prototype web n'utilise **pas** de morph targets glTF : il applique les
deltas MakeHuman en CPU dans les vertex buffers Three.js. Rien de cela ne se
transpose — le Lua nanos n'a aucun accès aux sommets. Il faut donc CUIRE les
morphs dans le SkeletalMesh, ce que fait `scripts/narvos-morphs-vers-glb.mjs`.

### Les deux espaces de sommets

| | taille | rôle |
|---|---|---|
| canonique | 19 158 | l'ordre de `base.obj` ; les `.morphs` y sont indexés, helpers MakeHuman compris |
| rendu | 14 517 + 160 | ce que le GLB porte, avec les sommets dupliqués aux coutures UV |

Le GLB embarque `_MORPH_INDEX` (rendu → canonique). Les deux sommets d'une
couture partagent le même index canonique et reçoivent donc le même delta —
c'est ce qui empêche le maillage de se fendre.

⚠ Les deltas sont en **décimètres** MakeHuman, le corps riggé en **mètres**
(`morphUnitScale: 0.1` dans les extras). L'oublier ne lève rien : le visage se
déforme dix fois trop.

### Le squelette s'emboîte — mesuré, pas supposé

`scripts/narvos-hierarchie-os.mjs` compare les **chaînes parentales**, pas des
ensembles de noms (l'erreur MetaHuman). Verdict sur ce corps : **IDENTIQUE** —
les 68 os de nos corps sont tous présents avec le même parent. `spine_04`,
`spine_05` et `neck_02` existent mais forment une branche PARALLÈLE sous
`spine_03`, pas une insertion : `spine_03 → neck_01 → head` reste intacte.

Et **0 %** du poids de peau repose sur les 21 os supplémentaires. Imposer
SKEL_Mannequin à l'import ne perd donc rien.

### Coût

Mesuré : 290 morphs de visage = **48,7 Mo en dense**, 3,15 Mo en creux. On écrit
dense — rien ne garantit qu'Interchange lise les accessors `sparse`, et un import
qui échoue coûte plus cher que 45 Mo sur un pack de 31 Go.

### Le piège qui a coûté le plus

`"BIN\0".trim()` **ne retire pas le `\0`** — `trim` ne s'occupe que des espaces.
Le test `type === "BIN"` échouait donc, le chunk binaire restait vide, et la
première lecture d'accessor sortait des bornes avec un message qui ne désignait
pas la cause.

Second piège : `base_skinned.glb` **entrelace** tous ses attributs (stride 48).
Une lecture qui ignore le stride ramène les octets des attributs voisins — sans
erreur. Et `new Uint32Array(buffer, offset, n)` exige un offset aligné, ce qu'un
`Buffer` Node découpé dans son pool ne garantit pas : lire par `DataView`.

### Vérifier, toujours

`scripts/adk-verifier-morphs.py` compte les morphs ET distingue les **nommés**
des **numérotés**. Un morph numéroté (`..._MorphTarget_17`) existe, se voit dans
l'éditeur, et reste inatteignable depuis le Lua — c'est ce qui était arrivé aux
52 cibles ARKit. Résultat sur ce corps : 290 nommés, 0 numéroté.

## 24. L'écran de curseurs — ce qui a été appris en le faisant

L'étape « Visage » vit dans `Client/UI/creation/` (index.js + style.css) et
n'apparaît que si `familleDe(genre, corps) === "mpfb"` — `etapesVisibles()` la
retire du fil autrement, y compris pour la touche Échap qui recule d'un cran.
Une étape traversable mais inerte se lit comme un bug, pas comme une option.

### Trois décisions qui portent l'écran

**Zones repliées par défaut.** 11 zones, 138 réglages : tout déplier donnerait
trois écrans de défilement avant le premier geste. Le compteur d'une zone montre
ce qui est **réglé**, pas ce qui est disponible — la seule des deux informations
qui change pendant qu'on travaille.

**Symétrie liée par défaut.** 74 curseurs sur 138 vont par paires `l-`/`r-`.
Séparés, il faudrait régler deux fois chaque trait pour un visage symétrique,
qui est le cas courant. Un bouton `⇄` dissocie ; le bouton « relier » aligne le
droit sur le gauche, parce que garder deux valeurs sous un seul curseur
mentirait sur ce qui est appliqué.

**Débounce 120 ms sur l'aperçu.** Une glissière émet des dizaines d'`input` par
seconde. Le rendu de la ligne se met à jour tout de suite (texte + classe), mais
`rendreCreation()` n'est PAS rappelé pendant le glissement : reconstruire la
liste à chaque pixel ferait perdre le focus et hacherait le geste.

### Deux défauts attrapés avant livraison

`let morphs` avait été déclaré près de son rendu, donc **après** `majApercu` qui
le lit — zone morte temporelle, le même piège que le TDZ Lua rencontré cinq fois
ici. Déclaré en tête, à côté de `brouillon`.

`.morph-ligne` était en `grid` à quatre colonnes fixes. Or une ligne porte trois
enfants, ou quatre avec le bouton de symétrie : sur les lignes SANS paire, la
glissière tombait dans la colonne du bouton et se réduisait à quelques pixels —
un défaut invisible là où on regarde, puisque les zones commencent par des
paires. Passé en `flex`, avec largeurs fixes sur le nom et la valeur.

### Le catalogue voyage déjà

`Session.Options()` envoie `morphs = { mesh, zones, curseurs, choix }`. Le client
n'a rien à deviner, et un curseur ne peut pas pointer un morph absent du mesh :
le catalogue est généré depuis `targetNames` du GLB.

## 25. Macros de corps, orbite, et le test de parcours

### Les macros ne sont PAS des curseurs

`macrodetails` porte 340 morphs, mais ce sont des **ancres** d'une grille à cinq
dimensions : `universal-male-young-maxmuscle-minweight`,
`height/female-old-averagemuscle-averageweight-maxheight`. Aucune ne se règle
seule. Six curseurs (genre, âge, muscle, poids, taille, ethnie) répartissent leur
poids entre les ancres qui les encadrent — `Shared/Logic/Macros.lua`, porté depuis
`macroWeights.ts` du prototype web.

Deux pièges du format, tous deux muets si on se trompe :

- Les suffixes ne sont pas `min`/`max` mais **`minmuscle`**, **`maxweight`**.
- **`averagemuscle-averageweight` N'EXISTE PAS** dans `universal-` : le point
  moyen EST le maillage de base. Mais la famille `height/` **l'a**, elle —
  changer de taille déplace des sommets même à corpulence moyenne. Deux familles
  voisines, deux conventions.

Les macros cohabitent avec les curseurs de visage dans une table plate, préfixées
par `@`. Aucun identifiant MakeHuman ne commence ainsi.

**108 morphs `proportions/male|female` sont EXCLUS** depuis le 2026-09-04, par
la liste `EXCLUS` de `narvos-morphs-vers-glb.mjs`. Ni le web ni nanos ne les
emploient : le prototype règle épaules, taille et longueur de bras par **mise à
l'échelle d'os**, pas par morph target (`bodyProportions.ts` explique pourquoi —
les cibles MPFB2 sont indexées sur une autre topologie que les têtes du jeu).

Le mesh est donc passé de 630 à **522 morphs**, et le GLB de 107 à **89 Mo**.
Porter les proportions un jour se fera par `SetBoneScale` ou équivalent, pas en
rétablissant ces morphs.

### Orbite de l'aperçu — côté client

`SetCameraLocation` / `SetCameraRotation` sont disponibles **des deux côtés**.
Passer par le serveur ferait un aller-retour réseau à chaque cran de molette. Le
serveur pose le cadrage initial une fois puis envoie l'ancre ; le client orbite.

Événements relevés dans le binaire 1.152.2 — `Input.Subscribe` expose
`MouseDown`, `MouseUp`, `MouseEnable`, **`MouseMoveX`**, **`MouseMoveY`**,
**`MouseScroll`**, `WindowFocusChange`. Le bouton du milieu est
`MiddleMouseButton`.

Deux détails qui se paient sinon : l'angle et la distance **ne se réinitialisent
pas** quand l'aperçu est reconstruit (il l'est à chaque curseur bougé, et
ramener la caméra de face à chaque fois serait insupportable) ; et
`WindowFocusChange` doit relâcher la rotation, sinon la scène reste accrochée au
curseur au retour dans la fenêtre.

### Le mannequin en T-pose

Un `Character` spawné ne joue aucune animation : bras tendus, épaules écartées,
aucune silhouette ne ressemble à ce qu'elle sera. `ANIM_IP_customer_idle` en
boucle le remet en posture. **« IP » = in place** : une animation RM emporterait
la racine et le mannequin sortirait du cadre en quelques secondes.

### Le test de parcours

`scripts/lua-harness/parcours.mjs` suit UNE composition de bout en bout :
`Creation.Construire → Roster.Creer → INSERT → SELECT → depuisLigne →
Morphs.Resoudre + Macros.Resoudre`, et confronte **chaque nom produit aux
`targetNames` du GLB cuit**.

C'est le seul test qui puisse attraper un champ perdu entre deux modules dont les
tests unitaires passent tous. Il ferme aussi le mode d'échec le plus coûteux du
projet : un nom de morph faux n'échoue pas, il est ignoré.

## 26. Vêtements taillés dans le corps — la seconde peau

`scripts/narvos-vetements-morphables.mjs` découpe quatre pièces DANS
`base_morphable` et les décale de 3 mm vers l'extérieur. Trois propriétés
s'ensuivent gratuitement :

- mêmes **morph targets** → le vêtement suit chaque réglage du joueur ;
- mêmes **poids de skinning** → il s'anime sans retouche ;
- **aucune interpénétration possible**, puisqu'il EST le corps décalé.

C'est la seule voie ici : les pièces Stylized et Trooper ont d'autres topologies
et d'autres volumes, elles se croiseraient dès le premier curseur de corpulence.

### Le découpage vient des os

Chaque sommet a un os dominant. `spine_*`+`pelvis`+`clavicle`+bras = torse,
`thigh`/`calf` = jambes, `hand`+doigts = mains, `foot`/`ball` = pieds. On garde
les triangles dont **au moins un** sommet est dans la région : n'en garder que
les triangles entiers laisserait un anneau de trous à chaque frontière.

### Deux détails qui décident du résultat

**Le corps n'a pas de NORMAL** — ses attributs sont POSITION, JOINTS_0,
WEIGHTS_0, `_MORPH_INDEX`, TEXCOORD_0. Il faut les reconstruire (moyenne des
normales de face) pour savoir où est « l'extérieur ».

**Un matériau propre par pièce, jamais celui de la peau.** Reprendre `skin`
donnerait un vêtement exactement de la couleur du corps — invisible. Et le
laisser sans matériau ferait retomber Interchange sur `WorldGridMaterial`, le nom
réservé qui avait rendu les 67 pièces Trooper grises.

### Morphs filtrés

Un pantalon n'a aucun besoin des 42 morphs de nez. On ne garde que ceux qui
déplacent réellement un sommet de la pièce (seuil 1e-5, le bruit flottant à 1e-9
ne déplace rien). Résultat : 308 / 232 / 207 / 201 morphs au lieu de 522, et
30 Mo au total.

## 27. `PorteurCachable` doit exiger une pièce de TÊTE

Cacher le mesh de base n'est acceptable que si la peau découpée couvre la tête —
slot `visage` ou `tete`.

⚠ **Sans cette condition, le personnage est décapité.** Les quatre vêtements
`mpfb` — torse, jambes, mains, pieds — suffisaient à déclarer la famille
« cachable » : le porteur disparaissait, et plus rien ne remplaçait la tête.

Stylized (slot `visage`) et Trooper (slot `tete`) passent ; `mpfb` garde son
porteur VISIBLE, ce qui est correct puisque ce corps EST sa propre peau.

## 28. Ne jamais masquer la sortie d'un `--apply`

Deux fois le 2026-09-04 : `node scripts/…-to-lua.mjs --apply > /dev/null 2>&1`
a échoué en silence, et la suite a tourné sur l'ANCIEN catalogue. Le symptôme
apparaît bien plus loin — un test qui échoue sur une fonction qu'on vient
pourtant de corriger.

La cause était trois fois la même : **un backtick dans le texte Lua d'un
générateur**, qui termine son template literal. `scripts/lua-harness/syntaxe-check.mjs`
lance désormais `node --check` sur les 22 générateurs `narvos-*.mjs` — quelques
millisecondes, et cette panne ne peut plus être livrée.


## 29. La création donne un corps, le marchand l'habille — 2026-09-04

Règle de contenu, pas d'API, mais elle a **cédé deux fois** en une journée et le
symptôme est invisible : l'écran marche *mieux* quand elle est violée.

`Vestiaire.Identites(famille, genre)` doit filtrer sur `REGISTRES_CREATION`
(`base` : la peau découpée par slot et les visages). En rendant **toutes** les
pièces de la famille, l'écran offrait sept torses dont six à vendre — le joueur
composait gratuitement la tenue que le tailleur était censé lui vendre.

Trois tests le verrouillent dans les deux sens (`scripts/lua-harness/vestiaire-tests.lua`) :
aucune pièce vendable à la création, aucun trait d'identité en boutique, et au
moins un slot garde plusieurs options — sinon l'étape n'aurait plus d'objet.

### Silhouette et couleurs : le seul réglage des corps sans morph

Les deux corps Stylized n'ont **aucun morph target**, et `SetMorphTarget(name, value)`
n'a **pas** d'`attachable_id` — il ne touche que le mesh de BASE, qui est caché
(§18). Sans `Shared/Logic/Apparence.lua`, ces corps n'auraient aucun réglage.

`SetMaterialColorParameter(param, Color, index, attachable_id)` **a** un
`attachable_id` : les couleurs ATTEIGNENT les pièces attachées. Toute
l'architecture découle de cette asymétrie.

| donnée | table | préfixe | application |
|---|---|---|---|
| morphs de visage | `morphs` | aucun | `SetMorphTarget` |
| macros de corps | `morphs` | `@` | `SetMorphTarget` |
| silhouette | `morphs` | `#` | **`SetScale`**, borné ±12 % |
| couleurs | `couleurs` | — | `SetMaterialColorParameter` |

⚠ **ORDRE DANS `Builder.Habiller` : pièces → morphs → apparence.** Une teinte vise
une pièce par son `attachable_id`, qui n'existe qu'une fois la pièce attachée ;
appelée plus tôt elle ne peint rien, **sans erreur**. Et il faut RÉAPPLIQUER à
chaque rhabillage : `AddSkeletalMeshAttached` repose un matériau neuf, sans teinte.

⚠ **Hauteur en Z, largeur en X/Y.** Unreal est Z-up ; intervertir aplatit le
personnage au sol sans lever d'erreur — ça se lit comme un bug de modèle.

⚠ **La PEAU n'est pas recolorable.** Sondé sur les 27 matériaux du pack
(`scripts/adk-sonder-parametres-materiaux.py`) : `MI_Body` et `MI_Female_Body`
n'exposent aucun paramètre vectoriel, leur teinte est cuite dans la texture.
Recolorables : vêtements (`Color 1` / `Color 2`), yeux, cheveux (`Hair Color`).


## 30. Véhicules — `VehicleWheeled`, relevé dans le JSON le 2026-09-10

Source : `libraries/api-main/api-main/Classes/VehicleWheeled.json`. nanos n'a que
**`VehicleWheeled` et `VehicleWater`** — aucun aéronef (§12).

```lua
local v = VehicleWheeled(
    location, rotation,
    "narvos::SK_Pickup",            -- SkeletalMeshPath
    CollisionType.Auto,             -- collision_type
    true,                           -- gravity_enabled
    true                            -- auto_unflip
    -- puis engine_sound, horn_sound, brake_sound, engine_start_sound,
    -- vehicle_door_sound, auto_start_engine, custom_animation_blueprint,
    -- spawn_mode — tous avec des défauts `nanos-world::` utilisables
)
```

**Toutes les méthodes de configuration sont `server`** :
`SetWheel` (28 paramètres), `SetSteeringSetup`, `SetEngineSetup`,
`SetAerodynamicsSetup`, `SetTransmissionSetup`, `SetDifferentialSetup`,
`SetSteeringWheelSetup`, `SetHeadlightsSetup`, `SetTaillightsSetup`,
`SetHeadlightsEnabled`, `SetTaillightsEnabled`, `SetTireFlat`, `SetHornSound`,
`SetAutoStartEngine`, `SetEngineStarted`, `Horn`.
**Client seulement** : `GetRPM`, `GetGear`, `IsInAir`.

```lua
v:SetWheel(index, bone_name, radius, width, max_steer_angle, offset, …)
```

### La convention d'os n'existe pas — c'est un paramètre

Question restée ouverte des semaines (« nos os s'appellent `Wheel_FL`, est-ce que
nanos les accepte ? »). Réponse dans
`docs/assets-modding/creating-assets/skeletal-meshes/vehicles-meshes.mdx` :

> *« Any Skeletal Mesh with any Skeleton will work… Yours don't need to follow
> this naming, as the Wheel Bone names are set through Lua. »*

Trois règles et **un interdit** dans ce même document :

- un os par roue ;
- racine orientée **X vers l'avant, Z vers le haut** ;
- racine idéalement à l'échelle `1, 1, 1` ;
- ⚠ **« Do not add physics shapes to the Wheels! »** — « it will only cause
  physics problems ».

### Le PhysicsAsset est le premier suspect, pas `SetWheel`

Mesuré sur les 12 PhysicsAssets CUITS de City_Traffic_Pro
(`scripts/narvos-phys-roues.mjs`) : **les 12 portent un corps de collision sur
les 4 os de roue**. Aucune n'est propre — l'interdit du doc est violé par tout
le pack.

⚠ **Une version antérieure de cette fiche annonçait « 8 sur 12 », avec quatre
voitures « propres » (`SK_Pickup`, `SK_Minivan`, `SK_Hatchback1`,
`SK_Station_Wagon`). C'était faux** : ces quatre-là ne diffèrent que par la
FORME du volume — capsule (`KSphylElem`) au lieu de sphère (`KSphereElem`) —
pas par son absence. Le premier relevé cherchait le mot « sphère » et a pris
l'absence du mot pour l'absence de la chose. Même faute que le relevé d'os
filtré sur le vocabulaire véhicule (ci-dessous) : **chercher un nom, c'est
présumer la réponse**. Chercher l'OS dans la table de noms, lui, ne présume
rien : un os absent ne porte aucun corps.

Le relevé exact, identique sur les 12 : corps sur `Body` + `Wheel_FL/FR/RL/RR`,
géométrie `KConvexElem` (la carrosserie) plus `KSphereElem` (8 voitures) ou
`KSphylElem` (4 voitures).

Symptôme à reconnaître : véhicule qui tremble, s'enfonce, ou décolle. **Ça vient
de là, pas des réglages de suspension.** Les volumes se retirent dans l'éditeur,
jamais en Lua — et il faut REcuire ensuite (12 assets = cook court).

**Corrigé le 2026-09-10** (`scripts/adk-reparer-roues.py`) : les 48 corps de roue
(4 × 12) sont vidés de leur volume, chaque `Body` garde ses enveloppes convexes.

### Atteindre un PhysicsAsset depuis Python — la porte n'est pas celle qu'on croit

⚠ **`unreal.PhysicsAsset` n'expose AUCUNE propriété éditeur en 5.7.**
`SkeletalBodySetups` et `ConstraintSetup` sont des `UPROPERTY(instanced)` sans
`BlueprintReadWrite` : `get_editor_property("skeletal_body_setups")` répond
« Failed to find property ». On ne peut donc ni lire ni modifier le tableau des
corps, ni en retirer une entrée.

La porte qui marche : **les corps sont des sous-objets NOMMÉS du PhysicsAsset.**

```python
bs = unreal.load_object(pa, "SkeletalBodySetup_%d" % i)   # i = 0, 1, 2, …
os_nom = bs.get_editor_property("bone_name")
agg    = bs.get_editor_property("agg_geom")
for famille in ("sphere_elems", "box_elems", "sphyl_elems",
                "convex_elems", "tapered_capsule_elems"):
    agg.set_editor_property(famille, [])      # vider = plus aucun volume
bs.set_editor_property("agg_geom", agg)
unreal.EditorAssetLibrary.save_asset(chemin, only_if_is_dirty=False)
```

⚠ **`bone_name` et `agg_geom` n'apparaissent PAS dans `dir(bs)`** — et elles sont
pourtant lisibles ET écrivables. Une sonde qui n'essaie que les noms de `dir()`
conclut « aucune propriété » et se trompe. C'est arrivé le 2026-09-10 : le premier
relevé a rendu « propriétés lisibles : AUCUNE » sur un objet parfaitement
manipulable. **Essayer les noms attendus, pas seulement les noms annoncés.**

⚠ **Balayer `SkeletalBodySetup_<n>` sans s'arrêter au premier manquant** : un corps
supprimé laisse un trou dans la numérotation, et s'arrêter là raterait les
suivants en silence.

⚠ **Le code de sortie du commandlet ne vaut rien comme témoin** : `-run=pythonscript`
rend **1** même quand le script s'est déroulé jusqu'au bout et que
`LogPythonScriptCommandlet` écrit « Python script executed successfully ». Lire le
journal, jamais `$?`.

⚠ **Chaque ligne de `LogPython` est écrite DEUX FOIS** dans
`Saved/Logs/NanosWorldADK.log` (une par `print`, une par `unreal.log`). Un
`grep | wc -l` sur cette sortie compte double.

### Lire les os sans l'éditeur — et ne pas filtrer trop tôt

Les chaînes ASCII du `.uasset` suffisent. ⚠ **Ne pas filtrer sur un vocabulaire
choisi d'avance** : un premier relevé de `Car_Skeleton` ne gardait que les mots
contenant « wheel / body / suspension » et concluait « `Body` + 4 roues, rien
d'autre ». Faux. Le squelette porte **14 chaînes d'os** :

```
Body
Wheel_FL   Wheel_FR   Wheel_RL   Wheel_RR
Headlight_L   Headlight_R   HeadlightL   HeadlightR   HeadlighR
PlateF   PlateR   RegPlateF   RegPlateR
```

⚠ **Cinq variantes pour deux phares, dont `HeadlighR` — une faute de frappe dans
l'asset source, sans le « t ».** Quatre variantes pour deux plaques. Seuls `Body`
et les quatre `Wheel_*` sont propres et cohérents.

Conséquence : un nom de phare écrit en dur marchera sur une voiture et pas sur une
autre, **sans erreur** — un os introuvable est simplement ignoré. Les phares se
pilotent de toute façon par `SetHeadlightsSetup(location, color)`, qui prend une
POSITION et pas un nom d'os : il n'y a aucune raison de toucher à ces os-là.

⚠ La leçon dépasse les véhicules : **un filtre appliqué à la mesure décide de ce
qu'on peut découvrir.** Sortir d'abord tout, filtrer ensuite, et dire lequel des
deux on a fait.

## 31. Le `Gizmo` et l'édition — API et souris (2026-09-10)

`Gizmo` est **d'autorité CLIENT**, entièrement :

```lua
Activate(Vector location, Rotator rotation, Vector scale)   Deactivate()
SetTransformMode(GizmoTransformMode mode, boolean combine_translate_rotate)
SetAlignSpace(GizmoAlignSpace space)      -- 1 = World
SetSnapSettings(float pos_grid, float rot_grid, float scale_grid)
PressPointer()   ReleasePointer()   IsInteracting()
-- événement : Transform(self, location, rotation, scale)
```

Les axes X/Y/Z, la rotation, l'échelle, la grille et le snap sont donc **natifs**.
Rien à écrire pour ça.

### La souris — le point qui bloque tout le monde

`PressPointer` / `ReleasePointer` **n'atteignent une poignée que si la souris est
libre** (`Input.SetMouseEnabled(true)`). En mode jeu la souris est capturée par
la caméra : aucun clic ne touche le gizmo, d'où la manipulation au clavier.

L'idiome qui règle « souris libre MAIS caméra utilisable » : **clic droit
maintenu rend la souris à la caméra**, on la relibère au relâchement.

⚠ `IsInteracting()` gouverne trois refus, et chacun coûte un geste perdu : ne pas
basculer de mode d'édition, ne pas changer de prop, ne pas reprendre la caméra
**pendant qu'une poignée est tirée**.

⚠ **`WindowFocusChange` est obligatoire.** Focus perdu pendant un clic maintenu =
le `MouseUp` n'arrive jamais, et le joueur revient avec une caméra accrochée au
curseur, sans moyen de la lâcher.

### La transform ne quitte pas le client

`Transform` est client ; `Actor:SetLocation` est d'autorité. Le client envoie donc
la transform visée, le serveur valide et applique, la réplication montre le
résultat. Envoyer **neuf scalaires, pas une table** : une table ne peut pas être
à moitié décodée, mais le serveur doit borner chaque valeur une par une.

`Transform` se déclenche **à chaque frame** pendant le geste : 60 messages/s et
par joueur. Cadencer (~120 ms) **et forcer un dernier envoi au relâchement**,
sinon la position retenue est celle d'il y a deux ticks.

## 31 bis. `Input` — les événements réels

Relevés dans `StaticClasses/Input.json` :

```
KeyDown(string key_name, float? delta)      KeyPress(...)   KeyUp(...)
MouseDown(string key_name, float x, float y)    MouseUp(...)
MouseEnable(boolean is_enabled)
MouseMove(float delta_x, float delta_y, float x, float y)
MouseScroll(float x, float y, float delta)
KeyBindingChange(string binding_name, string key, float scale)
```

Boutons : `LeftMouseButton`, `RightMouseButton`, `MiddleMouseButton`.
Voir §15 pour les noms de touches (`One`…`Zero`, jamais `"1"`).

## 32. Ce qui décide qu'un asset entre dans le pack — TROIS filtres, pas un

Mesuré le 2026-09-10 en cherchant pourquoi 587 `.uasset` de voitures présents
depuis des semaines étaient comptés **zéro fois** dans `Assets.toml`.

| filtre | où | effet |
|---|---|---|
| `bCookAll=True` | `Config/DefaultGame.ini` | tout cuit, **sauf** exclusions |
| `+DirectoriesToNeverCook=(Path="X")` | idem | `X` n'est pas cuit |
| `unreal_folders = ["Narvos"]` | `Assets.toml` | **seul `Content/Narvos/` part dans le pack** |

Les trois sont indépendants. Un asset peut être **cuit et absent du pack** (hors
`Narvos/`), ou **sous `Narvos/` et non cuit** (exclu). Vérifier les trois avant de
conclure qu'un cook a échoué.

Le motif en place : la copie BRUTE à la racine de `Content/` est exclue, la copie
PROMUE sous `Narvos/` est cuite (sauf sa démo). **Promouvoir, puis cuire.**

### Le cook est INCRÉMENTAL

Mesuré : **3 h 08 m 52 s** à froid (82 950 packages, 2026-09-09) contre **36 min**
à chaud pour un delta de 275 packages (2026-09-10). Estimer un cook : **~35 min si
le DDC est chaud, ~3 h s'il est froid** (premier cook, changement de version d'UE,
`Saved/` vidé). Ne pas annoncer trois heures par défaut.

⚠ Le seul témoin de succès est **`Packages Remain 0`** dans le journal. Le code de
sortie ne dit rien : le cook peut rendre 1 en ayant tout cuit (11 585 erreurs non
fatales attendues, dont des `Content is missing from cook` qui sont la conséquence
des exclusions).

### Promouvoir des assets sous `Narvos/`

`scripts/adk-promouvoir-packs.py`, piloté par variables d'environnement :
`NARVOS_PACKS`, `NARVOS_EXCLURE`, `NARVOS_APPLIQUER=1`, `NARVOS_PLAFOND_GO`.

⚠ `rename_asset` laisse un **redirecteur à la SOURCE**. Le script sauvegarde
désormais source ET destination — sans ça les redirecteurs restent en mémoire,
disparaissent à l'extinction, et les références meurent : **2 382 assets** perdus
ainsi le 2026-09-09. `AssetTools.fixup_referencers` **n'existe plus en 5.7**.

Contrôle après coup :

```bash
node scripts/adk-refs-mortes-cuites.mjs <dossier cuit> Game/Ancien/ Game/Narvos/Ancien/
```

Il cherche dans les assets CUITS ceux qui pointent encore l'ancien chemin.
⚠ Passer les chemins **sans le `/` de tête** : Git Bash réécrit tout argument
commençant par `/` en `C:/Program Files/Git/...`, et le contrôle cherche alors une
chaîne qui n'existe nulle part — il ne trouve rien et se déclare vert.

## 33. La garde-robe MetaHuman n'est PAS portable — mesuré le 2026-09-10

Corrige l'espoir laissé par §16-17. Détail :
`docs/VERDICT_GARDE_ROBE_2026-09-10.md`.

`AddSkeletalMeshAttached` exige le même squelette que le corps, et `Character`
exige SKEL_Mannequin (68 os, UE4). La garde-robe MetaCustom/MetaWardrobe est
skinnée sur MetaHuman (314 os).

**Les NOMS d'os disaient que c'était jouable** : 61/61 os déformants du Mannequin
présents (100 %), seuls 7 `ik_*` manquants — et les `ik_*` ne déforment rien.
**Deux mesures l'ont démenti**, et aucune ne se lit dans la table de noms :

| pièce | poids reposant sur des os ABSENTS du Mannequin |
|---|---:|
| `SK_Dress` | **67,1 %** |
| `SK_Fantasy_outfit_1` | **55,4 %** |
| `SK_Belt` | **40,4 %** |

Et la hiérarchie **INTERCALE** : `clavicle_l/r` passent par `spine_05`, les doigts
par leurs métacarpiens. `CompatibleSkeletons` ne change rien — il règle une
identité d'ASSET, pas une topologie.

⚠ **Un SkeletalMesh NOMME tout son squelette, y compris ce qu'il ne déforme pas.**
104 vêtements sur 106 « nomment » 255 os : ça ne prouve rien. **Seul le poids
tranche.**

**Ce qui marche, et coûte zéro** : `CharacterSimple` accepte n'importe quel mesh,
sans contrainte de squelette. Ces pièces habillent des PNJ comme corps autonomes.
La garde-robe du JOUEUR reste celle qui est déjà sur SKEL_Mannequin.

Outils : `scripts/narvos-squelettes-uasset.mjs` (quels squelettes un dossier vise),
`scripts/narvos-os-uasset.mjs` (noms d'os, `ik_*` comptés à part),
**`scripts/narvos-poids-hors-squelette.mjs`** (celui qui tranche),
`scripts/adk-export-garde-robe.py` (sortie glTF avec `export_vertex_skin_weights`).

⚠ `GLTFExporter` **refuse les assets `Skeleton`** — il n'exporte que des
`SkeletalMesh`. Passer par une pièce : elle porte squelette ET poids.

⚠ Ces lecteurs de `.uasset` lisent **1 Mo à chaque bout** du fichier : la table de
noms y vit, et certains dépassent 512 Mo — au-delà, V8 refuse de fabriquer la
chaîne (`ERR_STRING_TOO_LONG`).

## 34. Pièges Lua/nanos ajoutés le 2026-09-10

**`Package.Require` résout dans le package COURANT.** Un
`Package.Require("Catalogs/X.lua")` écrit dans `narvos-map-proto` cherche
`narvos-map-proto/Catalogs/X.lua`. **Aucun fichier d'un package n'en require un
autre** : tout transite par la table exportée (`Package.Export("Narvos", …)`).
L'erreur ne se voit qu'au démarrage du serveur.

**SQLite rend `0`/`1`, pas `false`/`true` — et `0` est VRAI en Lua.**
`if (compte.est_admin) then` est vrai pour TOUT LE MONDE. Comparer explicitement :
`(tonumber(v) or 0) == 1`.

**Une garde doit être fermée par défaut.** Une garde d'autorisation non branchée
qui autorise est invisible ; non branchée qui refuse se voit au premier geste. Le
2026-09-08, 35 modules lus et aucun câblé : le silence a coûté six systèmes.

**Une garde se pose sur la valeur qui DÉCIDE.** Poser un prop : sur la position
d'ARRIVÉE, pas sur les pieds du joueur. Déplacer au gizmo : sur la DESTINATION —
sinon on pose chez soi puis on traîne l'objet dehors, la portée bornant un geste
et non une suite de gestes.

## 35. Les gardes du dépôt — ce qui empêche les récidives

```bash
node scripts/lua-harness/tout.mjs                     # TOUTE la batterie, un verdict
node scripts/lua-harness/syntaxe-check.mjs            # grammaire Lua + node --check des générateurs
node scripts/lua-harness/portee-check.mjs             # un nom employé AVANT son local
node scripts/lua-harness/listes-recopiees-check.mjs   # un littéral qui EST une copie de catalogue
node scripts/lua-harness/cablage-check.mjs            # chaque Narvos.X lu a-t-il une assignation
node scripts/lua-harness/constantes-check.mjs         # deux constantes du même fait divergent-elles
node scripts/lua-harness/schema-check.mjs             # CREATE vs ALTER
node scripts/narvos-verifier-catalogues.mjs           # références ET types d'assets
```

**`tout.mjs` est la commande qui manquait.** La règle « lancer TOUTE la batterie »
existait sans moyen de l'appliquer : le 2026-09-09, quatre harnais étaient rouges
pendant qu'on annonçait « 9 verts ».

⚠ Son compteur d'assertions a lui-même sous-compté à sa première écriture — il
exigeait `reussis` au pluriel nu et ratait `%d reussi(s)` : **2 523 annoncées au
lieu de 3 086**, sans un mot. Il sort désormais en ROUGE si le total tombe à zéro :
un compteur faux rassure, il n'alerte pas.

**`listes-recopiees-check`** refuse tout littéral de chaînes dont *tous* les
éléments sont des clés d'un catalogue surveillé. Écrit après qu'un
`ipairs({ "orbital", "tower", "alien" })` — liste de mondes recopiée quand il y en
avait quatre — eut posé **7 portails sur 10** sans un signal. Il a trouvé une
seconde occurrence que la lecture manuelle avait manquée.

## 36. ⚠ EN COURS — ce qui n'est PAS vérifié

Cette section existe pour qu'aucune des lignes ci-dessus ne soit lue comme acquise
par erreur. **Ne rien affirmer d'ici sans l'avoir fait tourner.**

| sujet | état au 2026-09-10 |
|---|---|
| `VehicleWheeled` accepte-t-il `Car_Skeleton` **en jeu** ? | **EN COURS.** Les os sont bons, le doc dit que n'importe quel squelette passe, les 12 voitures sont cuites et déclarées — mais **aucun véhicule n'a jamais été spawné**. Rien ne le prouve. |
| Le mode édition F3 (souris libre, clic droit caméra, sauvegarde à la sortie) | **ÉCRIT, JAMAIS VU.** Le serveur charge sans erreur ; le curseur, la caméra et l'export en sortie ne sont pas prouvés. |
| La garde d'édition refuse-t-elle réellement ? | **ÉCRIT, JAMAIS VU.** 55 assertions sur le modèle pur ; aucun refus observé en jeu. |
| `Menottes`, `Cameras`, `OsVehicules` | **chargés, testés, JAMAIS APPELÉS** côté serveur (0 appel mesuré). |
| Migrations UE 4.19 / 4.22 / 4.25 / 4.26 vers 5.7 | **NON TESTÉES.** Mesuré « c'est du 4.x », pas « ça s'ouvre en 5.7 ». |
| Rebind des 8 voitures à sphères de roues | **NON FAIT.** Utiliser les 4 propres en attendant. |
| Assemblage (craft pièce par pièce) | **NON COMMENCÉ.** |
| Tenue à 400 joueurs | **RIEN MESURÉ.** 33 ms par tick, 3 600 composants skeletal à 400 joueurs — une estimation, pas une mesure. |

### La règle qui gouverne cette section

**Un témoin doit mesurer la question posée.** Trois fois en une session un témoin a
mesuré autre chose :

- une ligne de log cherchée dans le boot alors qu'elle appartient à une fonction
  qui ne tourne qu'au franchissement d'un portail ;
- un compte de la chaîne `City_Traffic_Pro` qui a annoncé « P1 débloqué » sur
  **88 voitures STATIQUES** — une StaticMesh ne conduit pas ;
- un compteur d'assertions au motif trop étroit.

Avant d'écrire « c'est fait », se demander : *si ça ne marchait pas, ce témoin
dirait-il quelque chose ?*

## 37. Importer un pack Unity dans l'ADK — mesuré le 2026-09-10

Un `.unitypackage` est un **tar.gz**, pas un format opaque. Chaque asset y occupe
un dossier GUID : `<guid>/asset` est le **fichier brut** (le FBX, le PNG), et
`<guid>/pathname` son chemin d'origine. Extracteur : `scripts/unity-extraire-package.py`.

Mesuré sur J.Suko Animals (1 735 assets) : **663 fichiers utilisables, 2,25 Go**
— 331 FBX (modèles *et* animations), 322 PNG. Jetés : 185 `.mat`, 149 `.prefab`,
137 `.cs`, 48 scènes, 45 `.controller`. **Le matériau est à refaire** ; les
textures, elles, sortent nommées.

### Les trois murs, dans l'ordre où on les rencontre

⚠ **1. `tarfile` en mode flux échoue sur un flux zip.** `r|gz` fait des lectures
non séquentielles que le deflate ne sert pas : « invalid stored block lengths »
dès le premier bloc, alors que la décompression manuelle du MÊME flux marche.
Matérialiser le `.unitypackage` dans un fichier temporaire seekable.

⚠ **2. MAX_PATH.** La taxonomie d'un pack d'animaux (règne/classe/ordre/espèce/
Models) dépasse 260 caractères. `os.path.exists` rend **False** sur un chemin trop
long — ça se lit « fichier absent » et envoie chercher au mauvais endroit. Le
préfixe `\?\` lève la limite pour Python ; rien ne garantit qu'Unreal
l'accepte, donc **raccourcir la racine d'extraction** est le vrai correctif
(52 caractères gagnés en renommant deux dossiers).

⚠ **3. Interchange ouvre une fenêtre, et un commandlet n'en a pas.**

```
Assertion failed: CurrentApplication.IsValid()  [SlateApplication.h:321]
Script Stack : AssetTools.ImportAssetTasks
```

Deux plantages identiques. Le premier a été imputé à `save = True` (qui passe par
`InternalPromptForCheckoutAndSave`) — **faux** : avec `save = False`, le mesh a
été bâti puis l'assertion est revenue au même endroit, juste après deux
`LogInterchangeEngine: Warning:`. C'est **Interchange** qui affiche sa fenêtre de
résultats dès qu'il a un avertissement, et `automated = True` ne l'en empêche pas.

```python
unreal.SystemLibrary.execute_console_command(
    None, "Interchange.FeatureFlags.Import.FBX 0")
```

Après ça : **40/40 importés, tous en SkeletalMesh.**

### Deux règles qui découlent du reste

- **Une espèce à la fois, sauvée tout de suite.** Un `appError` tue le processus :
  Python ne peut pas l'attraper. Un lot d'un bloc perd tout au premier plantage ;
  espèce par espèce, la relance reprend où elle s'est arrêtée.
- **`import_uniform_scale = 100.0`.** Unity exporte en mètres, Unreal travaille en
  centimètres. Sans facteur, les bêtes arrivent hautes de 1,7 cm — présentes et
  invisibles. Ce dépôt a déjà payé ce piège sur 31 PNJ.

## 38. Nouveautés nanos — changelog officiel relevé le 2026-09-11

**Source lisible** : `https://api.nanos-world.com/game/changelog?page=0&limit=1000` (JSON,
`payload[]` : `name`, `description`, `releasedAt` — 415 versions). La page
`docs.nanos-world.com/changelog` la charge en JavaScript : un fetch n'y voit que « Loading… ».

**Installé chez nous : 1.154.0** (app Steam Playtest 2189700, buildid 25107577, mis à jour le
2026-09-04 ; ligne `Server Version` du journal serveur). **Publiée : 1.155.1** (2026-09-09).
⚠ Tant que Steam n'a pas installé 1.155.1, ses API N'EXISTENT PAS sur notre serveur : les
appeler lève `attempt to call a nil value`. Toujours vérifier la version du journal avant
d'employer une nouveauté, et la détecter (`if (character.SetWeaponShooterMode) then`).

| version | ce qui nous concerne |
|---|---|
| 1.155.1 | `Character:SetWeaponShooterMode(weapon_shooter_mode: boolean)` — **serveur** ; `GetWeaponShooterMode()` — both (lu dans `nanos-world/api` `Classes/Character.json`). Arme tenue toujours visée à l'arrêt et en marche, baissée au sprint ; la visée passe au viseur. Cible naturelle : le menu d'armes (O). · `Client.GetSettings()` · `GetSocketTransform()` accepte les ID d'Attachable · `TranslateTo()` en vitesse implicite (fin des saccades) · `bStayBasedInAir` **activé par défaut** (sync « basée ») · **Lua 5.4.9** · fix `SetCameraMode(FPSOnly)` — nous passons `FPSTPS`, non concernés |
| 1.154.0 | CEF 151 ; fix des asset packs « lean » non envoyés aux clients |
| 1.153.0 | sync « basée » **expérimentale** : un personnage sur une plateforme mobile (Prop, StaticMesh…) est répliqué relativement à elle — concerne vaisseaux et véhicules |
| 1.152.2 | `File.Rename()` ; regroupement des paquets réseau expérimental (commande `use_network_bundle` pour le couper) ; cache fichiers serveur invalidé aussi sur la TAILLE |

Résumés mensuels (Steam news, app 1841660) : août — sync réseau basée, bundling, flottabilité ;
juillet — Spawn Modes, méthodes/événements/ABP de véhicules, **`CharacterSimple` accroupi** ;
juin — **pièces SkeletalMesh attachées refaites**, sandboxing des packages ; mai — ⚠ **format
des Remote Events CHANGÉ (breaking)** ; avril — spawn différé, profileur Tracy.