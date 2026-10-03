# REPRISE — état au 2026-09-09, fin de soirée

Document de passation. Il remplace [HANDOFF_CLAUDE_2026-09-09.md](HANDOFF_CLAUDE_2026-09-09.md)
(matin) sur tout ce qu'ils se disputent.

---

## 0. En une minute

Le cook est **fini** et le pack **reconstruit**. La capitale et la forêt sont **jouables**.
La roue TAB de Kimi est branchée des deux côtés. Le **choix du point de départ est
branché** de bout en bout. Toute la batterie est verte : **3 028 assertions**, 0 référence
morte, 88 générateurs.

**Rien de tout cela n'a encore tourné en jeu.** Les paquets Lua sont lus au démarrage : il
faut relancer le serveur pour que quoi que ce soit de la journée prenne effet.

---

## 1. Ce qui est fait aujourd'hui

### Le cook et le pack

```
Cooked packages 82 950   Packages Remain 0        <- le seul temoin qui vaille
PACK   212 858 fichiers  (contre 282 037 avant : les exclusions marchent enfin)
Assets.toml  10 068 ko · 67 406 lignes · 1 575 cles CITY_PACK
Map_Narvos.umap cuit 14:06:26
```

### Les deux gardes `cuit = false` sont tombés

| monde | témoin |
|---|---|
| forêt | `ForestKitONE.uexp` 15 Mo dans le pack — c'est un sous-niveau, sa présence décide |
| capitale | date du `Map_Narvos.umap` cuit (14:06), postérieure à l'éditeur (13:41) |

⚠ Le témoin que j'avais écrit pour la capitale (`grep BIG_CITY_NIGHT_1`) était **le
mauvais** : ses 13 490 acteurs sont copiés dans `Map_Narvos`, la map source du pack ne
décide de rien. Corrigé dans le commentaire de `Mondes.lua`.

Le **mécanisme** `cuit = false` reste dans `Voyage.lua` (dormant, aucun monde ne porte le
champ). **On le garde** : il est placé avant la décision, la seule position où un garde
garde quelque chose.

### Défauts réels trouvés et corrigés

1. **`mode = "Static"` n'existe pas** (mon invention, sur la capitale et la forêt).
   `Ciel.Reglages` retombait **en silence** sur `VolumetricClouds`/`ClearSkies` : la
   capitale perdait sa nuit de 22h30, la forêt sa brume. → mode prouvé + `ClearSkies` /
   `Foggy`.
2. **`VoyageServeur.Charger` ignorait `decor_persistant`.** J'avais ajouté la 3ᵉ forme de
   décor à `MondePraticable` (qui décide de poser le portail) et pas à `Charger`. Portail
   vers Akarlys affiché, voyage refusé. Deux fonctions qui répondent à la même question
   doivent connaître les mêmes formes.
3. **La forêt n'avait AUCUNE liaison** — déclarée, praticable, injoignable. Elle a
   maintenant sa **Route de la Sylve** depuis Akarlys (20 km au sol), sur des positions
   mesurées : sonde `+500 m Y` de `.hermes/diag_capitale.txt` côté ville, point d'arrivée
   (médiane de 6 raycasts) côté forêt. Choix arbitré avec le propriétaire : aucun corps
   céleste libre n'était sur un relèvement libre.
4. **`Depart.Via` lisait `l.depuis`**, champ inexistant (les liaisons portent `l.de`).
   Elle rendait `nil` partout, en silence, et **aucun des 54 tests ne regardait `via`**.
5. **`talents.mjs` plantait entièrement** — wasmoon ne sait pas pousser un objet JS en
   argument Lua (`{}` plante autant que `{dmg_sharp:2}` ; la même fonction en Lua pur rend
   3). Son `catch (e) { }` **vide** avalait aussi les échecs du fichier de tests.
6. **16 références `Widgets` mortes** — le cook a emporté les widgets MetaCustom, leur
   `etat` disait encore `adk_seul`. → `cuit_non_declare`. Vérificateur : 45/45.

### Quatre invariants recopiés, tous périmés

`3 portails`, `4 mondes`, `6 passages`, `adk_seul` ×2. Le pire : `obtenu=8 attendu=6` se
lit comme **deux passages en trop** alors que c'étaient deux mondes en plus. Remplacés par
des relations (`ouverts == #Mondes.LIAISONS`, atteignabilité par parcours de graphe), et
l'échec **nomme** le coupable.

### Le choix du point de départ — branché

- `Session.lua` : nouvel état **`depart`** entre `selection` et `en_jeu`. `ChoisirPerso`
  retient le personnage dans `perso_attente` (**pas** `s.perso`, que tout le serveur lit
  comme « en jeu ») et ouvre la carte. `Narvos:ChoisirDepart` revalide par
  `Depart.Retenu`, puis `EntrerEnJeu(player, perso, depart_id)`.
- `Server/Index.lua` : `SpawnPersonnage(player, perso, depart_id)` relit le point dans le
  catalogue via `Depart.Point`. Sans choix (PNJ, tests), le cercle de la Forge d'avant.
- `Client/Index.lua` : un relais, `NarvosCreation:ChoisirDepart`.
- Page création : écran `depart`, carte SVG dessinée depuis les **vraies coordonnées**
  (cinq mondes en enfilade cy 60-62, orbital détaché cy 260, routes en pointillé selon
  `via`), fiche du monde survolé, bouton. CSS sur les jetons existants.
- Vérifié en Node : tout dans le cadre, **zéro NaN** sur le cas limite d'un seul monde
  (étendue nulle → division par zéro silencieuse, bornée à 1).

### `ui-liens` ne regardait qu'une page sur deux

Tout le flux connexion / roster / création / départ n'était vérifié par **rien** — et le
contrôle annonçait quand même « tous les liens sont reliés ». Étendu : 10 liens de la page
création, les écrans, les identifiants. ⚠ Mon premier bloc n'imprimait **rien** (la page
passe par `versLua()`, pas `Events.Call`) : un garde qui ne trouve rien et se tait compte
pour vert. Il refuse maintenant si son motif devient périmé.

---

## 2. Le rapport de Kimi, et sa correction

[ASSETS_OBJECTIFS_RP.md](ASSETS_OBJECTIFS_RP.md) — bon, honnête, incertitudes marquées.
**Un bloc de correction est en tête**, à lire avant son §3.

Son erreur systématique : le pack `asset_game/…/Metaverse Futuristic Sci-Fi City`, son
« joker à convertir », **EST `CITY_PACK`** — déjà cuit, c'est la capitale. Preuve : le
chemin source `Content/CITY_PACK/BIG_CITY/MESHES/SM_Atm_Cube.uasset` est exactement la clé
cuite `Narvos/CITY_PACK/BIG_CITY/MESHES/SM_Atm_Cube`.

Puis, sur la piste du propriétaire (`asset_game/a_trier` est une mine d'or), **six manques
sur huit** se sont révélés avoir leur source chez nous. La liste Fab est tombée de 8 lignes
à 3. Tout est dans [MISSION_KIMI_FAB_2026-09-09.md](MISSION_KIMI_FAB_2026-09-09.md).

**La leçon, une seule :** une absence cherchée avec le mauvais vocabulaire est une absence
inventée. `drone` → enceintes DJ · `atm` → *atmosphere* · `crystal` → sons de pas · `corn`
→ « corner » · `crop` → « mi**crop**hones » · `cuff` → « s**cuff** » · `car` →
**cargopants**. Huit requêtes justes, huit conclusions fausses.

---

## 3. À FAIRE, dans l'ordre

### 1. Relancer le serveur — rien n'a tourné

C'est la seule chose qui manque pour voir la journée. Ce qui entrera au démarrage :
l'écran de départ, les deux mondes débloqués, la Route de la Sylve, la roue TAB de Kimi et
sa table `ANIM_REPOS`, les gardes retirés.

Ce qu'il faut regarder dans le log :

- `Portail pose : …` — il doit y en avoir **dix** maintenant, dont les deux de la Sylve ;
- `Monde 'Akarlys' : decor deja dans la map persistante` — la branche ajoutée aujourd'hui ;
- l'écran de départ après avoir pris un personnage : six mondes sur la carte.

### 2. Le chantier véhicule — c'est un cook, pas un achat

`adk/Content/City_Traffic_Pro/Cars/Meshes/Skeletal_Meshes/` : **`Car_Skeleton` + 12
SkeletalMesh de voiture avec leurs PhysicsAssets**, 587 uasset, **0 dans le toml**. Le
blocage « aucun véhicule pilotable », qui tenait depuis des semaines, est là.

⚠ La question qui décide : **les os de roues conviennent-ils à `VehicleWheeled` ?** nanos
n'a que `VehicleWheeled` et `VehicleWater`, **aucun aéronef**, et `Chaos Vehicles` est
whitelisté mais **pas activé** dans l'ADK. Repli : les 10 véhicules du pack Steam de base.

### 3. Les autres cooks, par valeur

| chantier | ce que ça débloque |
|---|---|
| **Hyper Inventory V2** (`a_trier/…/animation_craf/`) | minerais (7 `SM_Ore_*`, 5 lingots, 5 gemmes) **et** agriculture (`BP_Farming_Master`, parcelles, 8 graines) — deux manques d'un cook. Plus 247 aliments, 448 armes, 317 structures, 286 icônes |
| **Caméras** | `SM_CCTVCameras_*` (ParkingGarage) + `SM_Security_Camera_Base/Lens/Viewcone` (Voyager, GLB **et** uasset) |
| **Keycard** | `SM_Keycard` + `DA_Keycard` (Inventory System Pro by Moonville) |
| **Kit de soin** | `SM_FirstAidKit_001/002`, `SM_Bandage`, `SM_Aspirin` (Survival Crafting) — donne un vrai mesh à l'emplacement de la roue TAB |

### 4. Les 37 vêtements cuits que rien n'utilise

`Shared/Catalogs/Modular.lua` = **42 pièces, 1 famille**. Le pack cuit porte ~37 pièces
MetaCustom (`SK_Shirt`, `SK_Pants`, `SK_Jacket`, `SK_Set_3_Work_Top`, `SK_Sci_Fi_Jumpsuit`,
`SK_Meta_Female_Base`…) dont **aucune** n'y figure. Un civil se compose aujourd'hui.

⚠ Le catalogue est **généré** par `scripts/narvos-modular-to-lua.mjs` « depuis les GLB
réellement importés » : ces pièces sont venues par l'ADK, donc invisibles au générateur.
**Ne pas éditer le catalogue à la main** — le prochain `--apply` l'écraserait. Le travail
est d'élargir la source du générateur.

### 5. Le reste, connu et non fait

- **Végétation de l'île** (`alien`) : son `InstancedFoliageActor` porte **0 instance**.
  Réutiliser les types du désert (5 194 instances : nature 3 698, SpaceScenes 1 144,
  Fantasy_RPG 352).
- **B — retarget d'un modèle** : `scripts/adk-retarget-un-modele.py` écrit, sonde par
  défaut, jamais lancé.
- **A réduit à 15 doublons réels** parmi les 90 squelettes.
- `SM_Pine2B` : ses deux slots homonymes `Pine2` ont tous deux reçu `MI_Pine2_Bark`. À
  vérifier à l'œil — les aiguilles sont peut-être marron.
- Nommage à trancher : la forêt s'appelle « Sylve de **Verdant** » alors que la planète
  **Verdant** mène à la Forge.

---

## 4. Les règles que cette journée a coûtées

1. **Une absence se prouve avec le vocabulaire du pack, pas le sien.** Juger sur le CHEMIN
   et la NATURE, jamais sur le nom.
2. **Ne jamais recopier un nombre dans un test.** Affirmer la relation. Un compte écrit en
   dur devient faux au monde suivant, et il ne dit pas lequel manque.
3. **Un champ que personne ne teste n'est pas un champ**, c'est un commentaire qui compile
   (`Depart.Via` a rendu `nil` pendant tout ce temps, 54 tests verts).
4. **Un garde qui ne trouve rien à vérifier et se tait compte pour vert.** Exiger qu'il
   trouve au moins une cible.
5. **Un témoin qui mesure autre chose que ce qu'on veut savoir rassure sans rien prouver.**
6. **Lancer TOUTE la batterie.** Quatre harnais étaient rouges pendant que j'annonçais
   « 9 verts » — un sous-ensemble.