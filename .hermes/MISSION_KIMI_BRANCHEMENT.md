# Mission Kimi — choisir, puis brancher

Rédigé le 2026-09-08, après le premier lancement réel du serveur nanos.
Chaque citation de fichier et de ligne a été vérifiée avant d'être écrite.

## Le contexte, en trois phrases

Le serveur nanos a démarré propre pour la première fois aujourd'hui — 6 portails
posés, 4 classes, 2 784 animations, zéro erreur Lua. Il ne démarrait pas avant
parce que **35 modules Lua étaient lus et aucun n'était câblé** dans
`Shared/Index.lua` : le script mourait à la première ligne qui en lisait un.

C'est réparé. Le problème du jour est **la couche au-dessus** : des modules qui
se chargent et que personne n'appelle. Un module chargé sans appelant ne lève
rien, ne loge rien, ne coûte rien. Il n'a **aucun symptôme technique** — seulement
un manque en jeu.

---

# LIRE D'ABORD — la documentation nanos, sur disque

Tout est en local. **Ne cherche rien sur le web**, et surtout ne suppose aucune
signature d'API : sur ce projet, trois signatures inventées ont coûté trois
corrections.

```
WebPortal/Server/nanos_world/
  libraries/api-main/api-main/        ← LA SOURCE DE VÉRITÉ DE L'API
      StaticClasses/   19 fichiers    Client, Input, Events, Package, Sky,
                                      PostProcess, Viewport, Console, Level, HTTP…
      Classes/         36 fichiers    Character, Player, Weapon, Prop, Trigger,
                                      VehicleWheeled, VehicleWater, WebUI, Widget…
      Structs/          6 fichiers
      UtilityClasses/   5 fichiers

  docs/docs-master/docs/             367 fichiers .mdx — le guide, pas l'API
      core-concepts/packages/         Package.toml, cycle de vie, hot-reload
      core-concepts/scripting/        événements, autorité, valeurs d'entité
      core-concepts/server-manual/    Config.toml, lancement
      assets-modding/                 asset packs, Assets.toml, import Unreal

  game-mod/                          LES EXEMPLES OFFICIELS, du code qui tourne
      default-vehicles-main/          22 véhicules complets — le gabarit à copier
      default-characters-main/        personnages modulaires
      default-weapons-master/         armes
      sandbox-master/                 le plus complet ; sa gestion d'Échap est
                                      celle qu'on a reprise
      deathmatch-main/

.claude/skills/nanos-world/SKILL.md   70 ko — tout ce qui a DÉJÀ été payé sur ce
                                      projet : squelette UE4 vs Manny, chemins
                                      .uasset, Package.Require vs require, les
                                      pièges du cook. À lire en entier.
```

⚠ **La doc `.mdx` ne contient PAS l'API.** Le site l'injecte à la compilation.
Une signature ne se lit que dans `libraries/api-main/api-main/`.

---

# TÂCHE 0 — LA SÉLECTION. Rien d'autre avant.

On a des dizaines de gigaoctets d'assets, dont beaucoup d'addons payants. Le
travail n'est pas de tout brancher : **c'est de choisir ce qui marche.**

## Les deux gisements

```
WebPortal/public/models/       ~265 Go, rangé par TYPE
WebPortal/public/asset_game/   ~36 Go, rangé par ÉPOQUE
```

Le point d'entrée est `public/models/CATALOG.md` — il indexe **tout** par
catégorie ET par thème. Version machine : `src/data/asset-catalog.json`.
**Ce n'est pas un `ls` qu'il faut faire.**

## Les quatre critères, tous mesurables — aucun n'est une question de goût

Ils viennent tous d'un défaut réellement payé, aujourd'hui ou avant :

**1. Le squelette** — décisif pour tout ce qui est personnage ou vêtement.
```bash
node scripts/narvos-skeleton-compat.mjs <dossier>
```
Verdicts, et ce qu'ils veulent dire :
- `IDENTIQUE` · `SUR-ENSEMBLE` · `IK SEULS` → **import direct, à retenir**
- `INTERCALE` → des os s'insèrent dans la chaîne. Le mesh est pondéré sur des os
  que `SKEL_Mannequin` n'a pas : ces poids sont perdus et le tronc se déforme
  faux. **Inutilisable tel quel.**
- `REPARENTE` → pire, un os pend d'une autre branche.
- `PARTIEL` · `ETRANGER` → autre squelette, retargeting complet.

Mesure du jour sur le pack modulaire `_parts` : **64 pièces sur 221 seulement**
sont importables. 112 `INTERCALE`. **Ne suppose jamais qu'un pack passe.**

**2. Les textures** — un GLB en KTX2 ou WebP s'importe **sans image et sans
erreur**. Le modèle sort gris et rien ne le signale.
```bash
node scripts/narvos-origine-glb.mjs <dossier>
```
Il donne aussi le **générateur** de chaque GLB, et c'est un signal :
- « Unreal Engine … glTF Exporter » → **aller-retour**. L'asset existait déjà
  dans Unreal. Le réimporter crée un doublon.
- « Khronos glTF Blender I/O » → vient de Blender.
- « Meshy » → génération IA.

**3. Le nom de matériau.** Un GLB dont le matériau s'appelle `WorldGridMaterial`
se résout vers le matériau **gris du moteur**. Mesuré aujourd'hui : 42 sur 70
dans `_parts`. Le même script le relève.

**3 bis. L'ampleur, mesurée le 2026-09-08 sur les 10 323 GLB de `public/` :**
```
8 516  generateur « Unreal Engine »   82 % sont des ALLERS-RETOURS
  935  glTF-Transform
  851  Blender

2 598  WorldGridMaterial    25 % du parc, resolus vers le GRIS du moteur
  824  KHR_texture_basisu   importes SANS image et SANS erreur
   28  EXT_texture_webp
```
Le nom reserve vient precisement des allers-retours : l'exportateur glTF d'Unreal
nomme le materiau `WorldGridMaterial` quand la source est le materiau par defaut.
**Un pack majoritairement `WorldGridMaterial` sortira gris**, quoi qu'on fasse
d'autre. C'est un critere d'exclusion, pas un detail.

**4. La VRAM, pas le poids du fichier.** Une texture PNG 2048² est décompressée
en 22 Mo sur le GPU, mipmaps compris. Deux packs mesurés : `Wraith.glb` 832 Mo,
`Murdock_Executioner.glb` 1 024 Mo de VRAM. C'est LA cause des « Context Lost ».
Un pack magnifique et injouable ne se retient pas.

## Ce que tu rends — `docs/SELECTION_ASSETS.md`

Pour **chacun** de nos systèmes, un classement argumenté sur les quatre critères,
avec les sorties brutes :

| système | ce qu'on cherche |
|---|---|
| véhicules | des véhicules **à roues** — voir la tâche 1, c'est tout ce que nanos sait faire |
| inventaire | l'UI. On a 6 systèmes d'inventaire ; il en faut **un** |
| craft | établis, forges, enclumes — les stations sont des `SM_Cube` aujourd'hui |
| minerais | filons, cristaux, veines — 6 gisements attendent un mesh |
| modulaire | pièces au squelette `IDENTIQUE`, textures lisibles |
| ville | props d'intérieur et de rue |

Pour chaque système : **3 candidats maximum**, un recommandé, et **pourquoi**
sur les quatre critères. Pas « c'est joli » — « 68 os, verdict IDENTIQUE,
textures PNG, 4 matériaux nommés proprement, 180 Mo de VRAM ».

⚠ **Un pack écarté doit dire pourquoi.** « INTERCALE, 112 pièces sur 221 » est
une raison. « Pas retenu » n'en est pas une.

---

# TÂCHE 1 — Les véhicules : 38 entrées, zéro consommateur, et une limite dure

```
narvos/Shared/Catalogs/Vehicles.lua:6    Vehicles.VEHICLE_CATALOG = { … }   38 entrées
narvos/Shared/Index.lua:53               Narvos.Vehicles = Package.Require(…)  câblé
narvos-map-proto/Server/**               0 occurrence de `Narvos.Vehicles`
```

## ⚠ CE QUE J'AI DÉJÀ VÉRIFIÉ POUR TOI — ne le refais pas, et ne le contredis pas sans mesure

**nanos n'a que DEUX classes de véhicule.** Relevé dans
`libraries/api-main/api-main/Classes/` :

```
BaseVehicle.json     VehicleWheeled.json     VehicleWater.json
```

**Aucune classe d'aéronef. Aucune classe de mech.** Et `Chaos Vehicles`, bien
que sur la whitelist nanos, **n'est pas activé** dans l'ADK — vérifié dans
`NanosWorldADK.uproject`, il n'y est même pas déclaré.

Donc, sur les 38 entrées : `chasseur_avion`, `phamtom`, `corvette`, `longsword`,
`wraith`, `mech_niko` **ne seront jamais pilotables comme véhicules**. Le
catalogue vient du runtime web, où `ShipController` les pilotait — ce contrôleur
n'existe pas ici.

## Le gabarit existe, copie-le

`game-mod/default-vehicles-main/Shared/Index.lua` — 22 véhicules complets. Le
patron, vérifié :

```lua
NanosWorldVehicles.Offroad = VehicleWheeled.Inherit("Offroad", {
    name = "Offroad", image = "assets://…", category = "wheeled",
    torque_curve = { [0.0] = 0.5, [800.0] = 0.9, [2000.0] = 1.0, … },
    forward_gears = { 4.25, 2.52, 1.66, 1.22, 1 }, reverse_gears = { 4.04 },
})
function NanosWorldVehicles.Offroad:Constructor(location, rotation)
    self.Super:Constructor(location, rotation, "nanos-world::SK_Offroad", …)
    self:AddStaticMeshAttached("wheel_FL", "…SM_Offroad_Tire", "VisWheel_FL")
    self:SetEngineSetup(400, 4000, 900, 0.2, 5, 600, self.torque_curve)
    self:SetSteeringSetup(SteeringType.Ackermann)
    self:SetDifferentialSetup(DifferentialType.AllWheelDrive)
end
```

Les roues s'attachent par **socket** (`VisWheel_FL`, `VisWheel_FR`…) : un mesh
sans ces sockets ne roulera pas. C'est un critère de sélection.

## Ce que tu rends

`docs/VEHICULES_NANOS.md` : quelles entrées deviennent des `VehicleWheeled`,
lesquelles deviennent du **décor posé**, lesquelles sont abandonnées. Puis le
catalogue et la logique.

⚠ **Vérifie que chaque `mesh` existe dans le pack cuit** —
`Server/Assets/narvos/Assets.toml`. Un nom inventé est une référence morte que
`narvos-verifier-catalogues.mjs` signalera.

---

# TÂCHE 2 — Les marchands : le catalogue existe, personne ne les pose

```
narvos/Shared/Catalogs/Merchants.lua:6   Merchants.MERCHANTS = { … }
narvos/Shared/Index.lua                  Narvos.Merchants = Package.Require(…)  câblé
narvos-map-proto/Server/**               2 mentions de « marchand », les DEUX en commentaire
```

Aucune ligne de serveur ne spawne un marchand. On ne peut acheter nulle part.

**Ce qu'il y a déjà** : `Server/Peuplement.lua` sait poser des entités autour du
joueur — naissance 8 000, mort 14 000, plafond 120, période 1 000 ms (lignes
42-62). Et le dialogue est prêt : `Logic/Dialogue.lua` porte `EnregistrerTout`,
`Demarrer`, `Choix`, `Callbacks`, avec ses définitions sous
`Narvos.DialoguesCatalog`.

⚠ **`Dialogue` a un `local actif` UNIQUE au module.** Sans encadrer chaque accès
par `Dialogue.Etat()` / `Dialogue.Charger(etat)`, deux joueurs en conversation
s'écrasent : le choix du premier fait avancer le dialogue du second. Le patron
est déjà écrit dans `Server/Index.lua` autour de `Dialogue.Choix` — reprends-le.

Un test au harnais qui prouve qu'un achat débite la bourse et crédite le sac.

---

# TÂCHE 3 — `Peuplement.Charger` n'est appelé nulle part

```
narvos-map-proto/Server/Peuplement.lua:181   function Peuplement.Charger(liste, decalage)
narvos-map-proto/Server/Peuplement.lua:213   function Peuplement.Etat()
narvos-map-proto/Server/Index.lua            0 appel
```

Vérifié à la main **et** par `appels-check.mjs`. C'est pour ça que la map est
vide de PNJ.

⚠ **`appels-check` a eu un faux négatif sur exactement ce cas**, et la leçon vaut
pour toi : sa première version cherchait `.Charger(` par nom et trouvait
`Dialogue.Charger`, `Quetes.Charger`. Elle déclarait donc `Peuplement.Charger`
appelée. **Le nom seul ne prouve rien** — vérifie le récepteur.

⚠ **Le monde d'arrivée compte.** `Mondes.CENTRES` et les `arrivee` viennent
d'être **remesurés par raycast aujourd'hui** : les quatre étaient dans le vide,
1 500 m sous le sol. Trois sont corrigés. Peuple par rapport à ces centres.

---

# TÂCHE 4 — Quatre événements de mêlée que personne n'écoute

```
NarvosCoup   NarvosCoupAnnonce   NarvosCoupRefuse   NarvosContre
```

Le Lua les pousse par `HUD:CallEvent`, **aucune page ne s'y abonne**. Le joueur
n'a aucun retour quand il frappe, encaisse, ou contre. La logique existe ; le
visuel manque.

Ils sont dans `TROUS_CONNUS` de `scripts/lua-harness/ui-liens.mjs` — **retire les
lignes** quand tu les branches. Le contrôle échoue aussi si la liste décrit un
état passé : elle ne peut pas pourrir.

1. Lis les quatre `HUD:CallEvent` dans `Client/Index.lua` pour connaître les
   arguments **réellement envoyés**.
2. Ça va dans la **couche HUD** de `Client/UI/` — celle qui s'affiche en continu
   et ne se clique pas, distincte des panneaux.
3. `direction_annoncee` existe déjà et sert à `ACTIONS.melee_contrer` :
   l'annonce a une direction à montrer.

## ⚠ La direction visuelle n'est pas négociable

- **Pas d'ornement.** Un filet SÉPARE ou va jusqu'au bord. Un moignon décoratif,
  jamais. C'est le détail qui fait « interface générée ».
- **Pas de grille de cartes uniformes**, pas de dégradés décoratifs, pas
  d'espacement régulier partout. Contraste d'échelle, panneaux inégaux.
- Le style existe : `Client/UI/style.css`, avec ses variables (`--accent`,
  `--texte-faible`, les cinq couleurs de rareté). Suis-le.

---

# TÂCHE 5 — L'INTERFACE. C'est la plus importante, et on s'y prend mal depuis le début.

## Le constat, et il vient du patron du projet

« On branche rien, on fait des menus qui ressemblent à rien. » Il a raison, et la
mesure lui donne raison deux fois.

## Ce qu'on a ACHETÉ et jamais touché — 44 WidgetBlueprint, déjà cuits

```
MetaCustom (16)   L'INTERFACE MODULAIRE COMPLÈTE, homme ET femme
    Widget_Tops · Widget_TopsM        Widget_Bottoms · Widget_BottomsM
    Widget_Hair · Widget_Hair_M       Widget_Skin · Widget_Skin_M
    Widget_ShoesM                     Widget_Costumes · Widget_CostumesM
    Widget_Props · Widget_PropsM      Widget_Customization · Widget_Customizer

UI (16)           kit générique « DynamicallyGeneratedGUI »
    Bool · Float · Int · Color · ColorBar · List · Label · Section · Layers ·
    IntThumbnail · Projector · ProjectorButton · State · Instance

Infinite (2) · Lobby (2) · Showcase (2)    HUD + menu de base
FluidFlux (2)                              BP_Hud
Widgets (3)                                EUW_InteractableButton, WB_SimpleController
```

Le vestiaire modulaire **existe en UMG**. On a écrit un panneau `garde-robe` en
HTML à la place. Le kit `DGGUI` est exactement ce qu'il fallait pour un écran de
réglages — on a écrit les graphismes à la main.

## ⚠ CE QUE J'AI VÉRIFIÉ DANS L'API, ET QUI CHANGE TOUT

Relevé dans `libraries/api-main/api-main/Classes/Widget.json`. **Un UMG acheté se
pilote entièrement depuis Lua** :

```lua
Widget:CallBlueprintEvent(nom, args...)         appeler un événement du Blueprint
Widget:BindBlueprintEventDispatcher(nom, cb)    recevoir ses clics
Widget:UnbindBlueprintEventDispatcher(nom, cb)
Widget:SetBlueprintPropertyValue(nom, valeur)   écrire ses variables
Widget:GetBlueprintPropertyValue(nom)           les relire
Widget:SetContentForSlot(nom_slot, widget)      remplir ses slots nommés
Widget:AddChild(WebUI|Widget)                   UMG et WebUI SE COMPOSENT
Widget:AddToViewport()  ·  SetSlotCanvasLayout(...)  ·  SetFocus()
Widget:SpawnWidget3D(location, rotation, ...)   et même en 3D dans le monde
```

Toutes `[client]`. **`AddChild` accepte un `WebUI` OU un `Widget`** : on peut
donc garder nos pages HTML là où elles servent et les poser DANS un cadre UMG
acheté. Le type déclaré est `any`, pas un scalaire.

**On n'a jamais eu besoin d'écrire du HTML à la main.**

## Ce que tu fais

1. **Ouvre les 16 widgets de MetaCustom dans l'éditeur** et relève, pour chacun :
   son nom exact d'asset cuit (`Assets.toml`), ses **variables Blueprint**
   exposées, ses **event dispatchers**, ses **slots nommés**. C'est le contrat.
   ⚠ Un nom de propriété supposé échoue en silence : `SetBlueprintPropertyValue`
   ne lève pas sur un nom inconnu.
2. **`docs/UI_UMG_CONTRAT.md`** — ce relevé, widget par widget. C'est le livrable
   qui compte : sans lui, personne ne peut piloter ces widgets.
3. **Le catalogue Lua** `Shared/Catalogs/Widgets.lua` : widget → asset cuit →
   propriétés → dispatchers. Vérifié contre `Assets.toml`, comme tout le reste.
4. **La logique** dans `Shared/Logic/` : quel widget pour quel écran, quelles
   données lui envoyer.

⚠ **Tu ne spawnes aucun Widget.** `Widget(...)` est de l'API nanos, donc un
exécutant `Client/` — ma part. Toi tu établis le contrat et les données.

⚠ **Ce qui existe déjà et ne doit pas être jeté** : neuf panneaux WebUI tournent
(`inventaire`, `personnage`, `props`, `spawn`, `commandes`, `garde-robe`,
`radar`, `pause`, `graphismes`). Dis pour chacun s'il vaut mieux le garder en
HTML ou le remplacer par un UMG acheté — **et pourquoi**. Un panneau qui marche
et qu'on remplace pour rien est du temps perdu.

## Les pièces modulaires elles-mêmes

```
MetaCustom             526 assets
Mat_Clothing_Master                 maître SAIN — Diffuse · Normal_Map · MetalRoughOcclusion
_parts_png             221 GLB      transcodés du KTX2 aujourd'hui
432 icônes de craft    WebP         public/textures/icons/craft/, 18 familles
```

⚠ **64 des 221 pièces seulement sont importables** (112 `INTERCALE`). C'est
exactement pourquoi la tâche 0 passe avant.

⚠ **`SOUS_MENUS` est recopié des deux côtés** (`index.js` et `Client/Index.lua`).
Impossible de fusionner : la touche arrive à l'un ou à l'autre selon le focus.
`ui-liens.mjs` les confronte, prouvé sur une divergence introduite exprès.

# TÂCHE 6 — Les 65 objets n'ont qu'un émoji

`Items.lua` porte `icon = "⚙️"`, `"🧬"`, `"💠"`. Les **432 icônes WebP** existent
dans `public/textures/icons/craft/`, en 18 familles (`bone`, `cloth`, `gemstone`,
`herbs`, `ingots`, `leather`, `ores`, `recipes`, `tools`, `wood`…), plus un
`_alias.json` que personne n'a lu.

**Le précédent est posé** : les 6 gisements de `Catalogs/Gisements.lua` portent
chacun leur `icone`, vérifiée sur disque (`tex_ingots_01`, `tex_gemstone_01`,
`tex_herbs_01`…). Fais pareil pour les 65.

⚠ **La source fait foi.** `Items.lua` est **GÉNÉRÉ** depuis
`src/rpg/items/itemCatalog.ts` : le champ s'ajoute **là-bas**, puis on régénère.
L'écrire dans le `.lua` le perdrait au prochain `--apply`.

⚠ **Garde l'émoji** — repli quand l'image manque. Ajoute un champ, ne remplace pas.

**Le livrable qui compte : un script qui vérifie que chaque chemin existe sur
disque.** Une icône morte ne se voit qu'à l'écran, et trop tard.

---

# Tes outils — à lancer AVANT et APRÈS chaque chantier

```bash
node scripts/lua-harness/cablage-check.mjs   # le module est-il branché, expose-t-il ce qu'on demande ?
node scripts/lua-harness/appels-check.mjs    # est-il DÉCLENCHÉ ?
node scripts/lua-harness/ui-liens.mjs        # page ↔ Lua : chaque événement a son récepteur ?
node scripts/lua-harness/syntaxe-check.mjs   # Lua + les 74 générateurs
node scripts/lua-harness/portee-check.mjs    # emploi avant déclaration (BLOQUANT)
node scripts/narvos-verifier-catalogues.mjs  # références d'assets mortes
node scripts/narvos-skeleton-compat.mjs <d>  # squelette : import direct ou pas
node scripts/narvos-origine-glb.mjs <d>      # générateur, KTX2/WebP, WorldGridMaterial
```

`cablage-check` et `ui-liens` sont **bloquants**. `appels-check` rapporte sans
bloquer, délibérément : beaucoup de fonctions publiques servent aux harnais ou à
une commande admin. C'est à la lecture de trancher.

# Règles

- **Français**, commentaires compris.
- **Vérifie chaque citation avant de l'écrire.** J'ai envoyé deux fausses
  citations à l'agent précédent, il a eu raison de me corriger. Aujourd'hui
  j'ai failli t'écrire que `SurKillJoueur` n'était pas branché : il l'est,
  `Server/Index.lua:912`.
- **Aucune signature d'API ne se suppose.** Elle se lit dans
  `libraries/api-main/api-main/`, jamais ailleurs.
- **Aucun avertissement d'outil n'est informatif.** Deux « cas informatifs » de
  `portee-check` étaient deux bugs actifs dans le gestionnaire de déconnexion.
- **Un module chargé n'est pas un module appelé.** 2 700 assertions vertes, et
  le serveur mourait à la ligne 55.
- **Quand tu tranches une valeur, cherche-la PARTOUT.** `grep -rn` sur le nom ET
  sur le nombre. Trois valeurs de crédits de départ coexistaient.
- Rapports dans `docs/`, pas `.hermes/`. Colle les sorties brutes.

## Ce que tu rends

`docs/SELECTION_ASSETS.md` **en premier** · `docs/VEHICULES_NANOS.md` · les
marchands posés et leur achat · l'appel de `Peuplement.Charger` · le retour
visuel de mêlée et `TROUS_CONNUS` allégé · catalogues et logique du modulaire +
son panneau · les 65 icônes dans `itemCatalog.ts` et le script qui les vérifie.

Et ta rubrique **« ce dont je ne suis pas sûr »**. C'est elle qui a fait attraper
mes erreurs à l'agent précédent, et c'est ce qui vaut le plus.