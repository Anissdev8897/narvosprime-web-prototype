# MISSION KIMI — faire apparaître un véhicule PILOTABLE

Rédigée le 2026-09-10 après le cook. Ton branchement précédent est vérifié :
5 gardes verts, 55 harnais / 3 500 assertions, 0 référence morte, modules en Lua
pur. Rien à corriger. Celle-ci est la suite directe.

**Objectif : un joueur monte dans une voiture et la conduit.** Pas une
architecture, pas un catalogue de douze — **une** voiture qui roule, prouvée en
jeu. Le reste vient après.

---

## 0. Ce qui a changé cette nuit — les voitures existent

`City_Traffic_Pro` n'était pas cuit pour deux raisons cumulées :
`DirectoriesToNeverCook=(Path="City_Traffic_Pro")` et le pack resté hors de
`Content/Narvos/` alors que `unreal_folders = ["Narvos"]`. Promu (299 assets,
0 raté), cuit (36 min, `Packages Remain 0`), empaqueté.

**12 SkeletalMesh sont maintenant déclarés dans `[assets.skeletal_meshes]`** —
vérifié ligne 45053 et suivantes de `Assets.toml` :

```
narvos::SK_Compact_Crossover   narvos::SK_Compact_Panel_Van
narvos::SK_Executive_Sedan     narvos::SK_Family_Hatchback
narvos::SK_Full-size_SUV       narvos::SK_Hatchback1
narvos::SK_Luxury_Car          narvos::SK_Minivan
narvos::SK_Pickup              narvos::SK_Sport_Wagon
narvos::SK_Sporty_Compact_Hatchback   narvos::SK_Station_Wagon
```

⚠ **Ne prends pas les `SM_` du même pack** : ce sont les versions STATIQUES,
présentes elles aussi dans le toml (88 clés). Une StaticMesh ne conduit pas.
J'ai failli livrer un « P1 débloqué » là-dessus — mon témoin comptait la chaîne
`City_Traffic_Pro` au lieu des SkeletalMesh. Le préfixe `SK_` compte ici.

Os relevés dans le binaire de `Car_Skeleton` : **`Body`, `Wheel_FL`, `Wheel_FR`,
`Wheel_RL`, `Wheel_RR`** — et rien d'autre.

## 1. La question qui bloquait est RÉPONDUE

« Est-ce que `VehicleWheeled` accepte `Car_Skeleton` ? » — **oui**, et la
convention d'os n'a aucune importance. Lu dans
`docs/docs-master/docs/assets-modding/creating-assets/skeletal-meshes/vehicles-meshes.mdx` :

> *« Any Skeletal Mesh with any Skeleton will work… Yours don't need to follow
> this naming, as the Wheel Bone names are set through Lua. »*

Le nom d'os est un **paramètre de `SetWheel`**. Trois règles et un interdit dans
ce même document :

- un os par roue ;
- racine orientée **X vers l'avant, Z vers le haut** ;
- racine idéalement à l'échelle `1, 1, 1` ;
- ⚠ **« Do not add physics shapes to the Wheels! »** — ça cause des problèmes de
  physique.

### ⚠ MESURÉ APRÈS COUP : 8 voitures sur 12 sont dans le cas interdit

J'ai lu les 12 `_PhysicsAsset` dans leur binaire. Résultat :

| formes sur les roues | voitures |
|---|---|
| **4 sphères — cas INTERDIT par le doc** | Compact_Crossover · Compact_Panel_Van · **Executive_Sedan** · Family_Hatchback · Full-size_SUV · Luxury_Car · Sport_Wagon · Sporty_Compact_Hatchback |
| **0 — propres** | **`SK_Pickup`** · `SK_Minivan` · `SK_Hatchback1` · `SK_Station_Wagon` |

**Commence par `SK_Pickup`.** J'avais écrit `SK_Executive_Sedan` plus bas dans
cette mission : c'était avant la mesure, et c'est l'un des huit mauvais. Corrigé.

Si tu dois quand même faire rouler l'un des huit : les sphères se retirent dans
l'éditeur (mon travail, demande-le), pas en Lua. Et le symptôme à reconnaître —
voiture qui tremble, s'enfonce, ou décolle — vient de LÀ, pas de tes réglages de
suspension. Ne passe pas la nuit sur `SetWheel`.

## 2. L'API, relevée dans le JSON — ne l'invente pas

Source : `WebPortal/Server/nanos_world/libraries/api-main/api-main/Classes/VehicleWheeled.json`.
**Toutes les méthodes de configuration sont `server`.**

```lua
local voiture = VehicleWheeled(
    location, rotation,
    "narvos::SK_Pickup",            -- SkeletalMeshPath (0 forme sur les roues)
    CollisionType.Auto,             -- collision_type
    true,                           -- gravity_enabled
    true                            -- auto_unflip
    -- puis : engine_sound, horn_sound, brake_sound, engine_start_sound,
    --        vehicle_door_sound, auto_start_engine, custom_animation_blueprint,
    --        spawn_mode  — tous avec des defauts nanos-world:: utilisables
)
```

`SetWheel` prend **28 paramètres**. Les six premiers portent l'essentiel :

```lua
voiture:SetWheel(index, bone_name, radius, width, max_steer_angle, offset, …)
```

Les autres réglages serveur : `SetSteeringSetup`, `SetEngineSetup`,
`SetAerodynamicsSetup`, `SetTransmissionSetup`, `SetDifferentialSetup`,
`SetSteeringWheelSetup`, `SetHeadlightsSetup`, `SetTaillightsSetup`,
`SetHeadlightsEnabled`, `SetTaillightsEnabled`, `SetTireFlat`, `SetHornSound`,
`SetAutoStartEngine`, `SetEngineStarted`, `Horn`.
Côté **client** seulement : `GetRPM`, `GetGear`, `IsInAir`.

⚠ **Va lire le JSON pour la liste complète des 28 paramètres de `SetWheel`**
avant d'en écrire un seul. Le skill nanos est formel : ne jamais affirmer une
signature sans l'avoir lue à la source.

## 3. Ce que je te demande, dans cet ordre

### A. UNE voiture qui roule — le jalon, et il est court

Une commande de dev (`Commandes.lua` en a déjà) qui fait apparaître
`SK_Pickup` devant le joueur (une des quatre propres, cf. §1), configurée pour ses 4 roues, moteur
démarré. Le joueur monte, conduit.

C'est **le seul livrable qui compte** de cette mission. Tant qu'il n'est pas
prouvé en jeu, tout le reste est de la spéculation — y compris cette mission.

### B. Utilise `OsVehicules.lua`, il attend

Tu l'as écrit hier et **personne ne l'appelle** (0 appel côté serveur, mesuré).
C'est lui qui doit résoudre `Car_Skeleton` → rôles `roue_av_g/av_d/ar_g/ar_d`, et
c'est lui qui évitera que le prochain pack de véhicules rouvre le chantier.

Si sa table ne suffit pas au passage à `SetWheel` (rayon, largeur, angle de
braquage, offset), **élargis la table** — pas le code appelant. Le rayon d'une
roue est une donnée du véhicule, pas une constante de la fonction.

### C. Reprends la FORME du gameplay véhicule du prototype web

`WebPortal/src/rpg/runtime/vehicles/` porte déjà : PV, explosion, réparation,
invocation par clés consommables, marchand « Garagiste », `GroundVehicleController.ts`.
**Ne réinvente pas ce modèle** — porte-le. Ce qui ne se porte pas : la conduite
elle-même, que `VehicleWheeled` fait nativement.

⚠ `vehicleCatalog.ts` est surtout des vaisseaux ; seul `vehicule_terrestre` est
au sol. C'est la STRUCTURE qui t'intéresse, pas ses entrées.

### D. Un catalogue, seulement après que A marche

Douze voitures avec leurs réglages. **Généré ou écrit à la main ?** Écrit à la
main est acceptable ici — ce sont des réglages de conduite, ils ne dérivent
d'aucune source. Mais alors : un harnais qui vérifie que **chaque entrée nomme un
asset présent dans `Assets.toml`**, sinon on retombe sur la référence morte
silencieuse.

## 4. Non négociable — les mêmes qu'hier, plus une

- `Events.CallRemote("X", Reliability.Reliable, …)` client → serveur. L'omettre
  ne lève rien, la charge utile se perd.
- Recevoir d'un WebUI : **`ui:Subscribe`**, jamais `Events.Subscribe`.
- `local function` déclarée **après** son appelant = global `nil`, muet.
- Aucune liste de clés recopiée : `node scripts/lua-harness/listes-recopiees-check.mjs`
  refuse tout littéral dont tous les éléments sont des clés d'un catalogue. Il a
  trouvé deux occurrences réelles cette nuit, dont une que la lecture manuelle
  avait manquée.
- **Lance TOUTE la batterie** : `node scripts/lua-harness/tout.mjs` — la commande
  existe depuis cette nuit (55 harnais, 3 500 assertions). Plus d'excuse pour
  n'en lancer que neuf.
- **NOUVEAU — un témoin doit mesurer la question posée.** Le mien a compté
  `City_Traffic_Pro` et annoncé « P1 débloqué » sur 88 voitures statiques. Pour
  toi : le témoin n'est pas « le véhicule apparaît », c'est **« le joueur le
  conduit »**. Une caisse posée au sol qui ne bouge pas passerait le premier.

## 5. Ce que je fais pendant ce temps

Je vérifie les `_PhysicsAsset` des 12 voitures (formes sur les roues ?), et le
squelette côté racine (orientation X-avant/Z-haut, échelle). Si l'un des deux
cloche, je te le dis avant que tu cherches côté Lua.