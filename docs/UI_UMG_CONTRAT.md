# UI_UMG_CONTRAT — le contrat des widgets UMG achetés, mesuré sur disque

Date : 2026-09-08 · Auteur : Kimi (sous-agent, Tâche 5 uniquement).
**Re-vérifié le 2026-09-09** (mission `MISSION_KIMI_20260909.md` §3.1) — voir la
note ci-dessous : l'état mesuré n'a pas changé, la réponse décisionnelle est en §0-R.

---

## NOTE DU 2026-09-09 — re-mesure face à l'état du dépôt (cook en cours)

Le propriétaire a travaillé le 09/09 (radar, Vasska, Combat, tests, Voyage,
Spawner) et un cook tourne (82 879 paquets restants au moment de la mission).
Toutes les mesures du 08/09 ont été **refaites** ; ce qui a changé et ce qui
n'a pas bougé :

**Inchangé (re-mesuré le 09/09) :**

```
$ stat Assets.toml            → modifié le 2026-09-09 13:47, 64 453 lignes (régénéré, contenu widgets identique)
$ grep -c BIG_CITY_NIGHT_1 Assets.toml   → 0     (le cook n'a pas encore produit ces entrées)
$ grep -c ForestKitONE     Assets.toml   → 0     (idem — le garde `cuit = false` doit RESTER)
$ grep -c MetaCustom / Widget_Tops / BP_Hud Assets.toml → 0 / 0 / 0
[assets.blueprints] ligne 64424 : 24 entrées, toujours SEUL l'acteur BC_MutableShowcaseHud (l.64440), 0 UserWidget déclaré
pack cuit : 0 dossier MetaCustom, 0 FluidFlux ; Widget_DGGUI.uasset toujours daté du 2026-09-07 (non recuit)
ADK : MetaCustom 14 widgets Meta_Styler + 2 Widget_Customization, BP_Hud FluidFlux, 20 fichiers DGGUI — tous présents, ADK-seuls
```

**Changé (par le propriétaire, pas par ce chantier) :**

- `Shared/Index.lua` : 216 → **228 lignes** ; `Narvos.Radar = Package.Require("Logic/Radar.lua")`
  ajouté ligne **196** (le point « Radar non câblé » du handoff est résolu).
  Le câblage de la tâche 5 est intact : `Narvos.Widgets` ligne **110**,
  `Narvos.WidgetsLogic` ligne **226**.
- Conséquence : la note « Radar pas câblé » de `WidgetsLogic.lua` était
  périmée — corrigée le 09/09 (seule retouche de ce chantier).

**Contrôles relancés le 09/09 (sorties intégrales en fin de note) :**
`cablage-check` VERT (65 modules lus tous câblés, 101 champs accédés existent) ·
`ui-liens` VERT (9 panneaux, sous-menus des deux côtés) ·
`appels-check` RAPPORTE (134 jamais appelées / 141 confinées — chiffres identiques
à ceux de la mission, rien de nouveau imputable à ce chantier) ·
`narvos-verifier-catalogues` VERT (**Widgets 45 références ok**, 0 référence morte).

---

## 0-R. RÉPONSE DÉCISIONNELLE (2026-09-09) — « lesquels valent d'être branchés, pour quel panneau »

Question posée par la mission du 09/09 (§3.1 et §7.1). Réponse mesurée, pas
ressentie : **aucun widget n'est branchable aujourd'hui, et un seul couple
widget/panneau justifie d'engager les préalables.**

### Le verdict en une phrase

Tant qu'un cook n'embarque pas les widgets ET ne les déclare pas dans
`Assets.toml`, `Widget("narvos::X")` ne peut résoudre pour **aucun** des 44 :
le seul asset déclaré (`BC_MutableShowcaseHud`) est un acteur, pas un
UserWidget. Brancher quoi que ce soit avant produirait des références mortes
silencieuses — le défaut exact que ce dépôt a déjà payé.

### Le seul couple qui vaut l'effort : `garde-robe` → MetaCustom (`Widget_Customizer` + 13 panneaux)

**Pourquoi lui** : c'est le seul pack qui couvre un vrai manque ressenti
(« des menus qui ressemblent à rien ») avec un équivalent fonctionnel complet
(vestiaire homme/femme, mesuré : 13 panneaux d'items + conteneur + 2 écrans de
curseurs corps/visage). Tous les autres packs sont des coquilles de démo
(Lobby/Infinite/Showcase), des briques minimales (`EUW_InteractableButton`),
des affichages sans édition (`WB_SimpleController`), ou un générateur couplé à
Mutable (DGGUI — voir §0.3 : utiliser DGGUI pour « graphismes » suppose de
fabriquer un CustomizableObject dont les paramètres seraient nos réglages,
un détour qui coûte plus cher que le panneau HTML existant).

**Les quatre préalables, chiffrés, dans l'ordre :**

| # | préalable | coût estimé | preuve de sortie |
|---|---|---|---|
| 1 | **Reparentage des références** : les 16 widgets référencent leurs vignettes et `BP_Meta_Styler` à l'ancien chemin `/Game/Metahuman_Customization_System/…` (mesuré dans les tables de noms). Soit déplacer par l'éditeur (Fix Up Redirectors), soit monter aussi `Metahuman_Customization_System` dans `unreal_folders` | une passe éditeur (heures) | plus aucune référence `/Game/Metahuman_Customization_System/` dans le scan, ou le dossier monté |
| 2 | **Cook du pack MetaCustom** (526 `.uasset` dans l'ADK, 0 cuit) | un cook (machine, heures) + vérifier les dépendances plugins (groom/Hair Strands — whitelistés ? non vérifié fichier par fichier, §8) | `Widget_Tops.uasset` présent sous `Server/Assets/narvos/Narvos/MetaCustom/…` |
| 3 | **Déclaration dans `Assets.toml`** : une clé par widget dans `[assets.blueprints]` (catégorie exacte à confirmer au premier cook via `WBP_AssetsTomlGenerator` — §8). ⚠ Homonymie : deux `Widget_Customization` (corps/visage) → clés distinctes | minutes (générateur ADK) | `narvos-verifier-catalogues` fait basculer `etat` à `declare` |
| 4 | **Acteur monde `BP_Meta_Styler` spawné côté client** : les widgets le cherchent par `GetAllActorsOfClass` (mesuré) ; sans lui ils s'affichent mais n'appliquent rien. `BP_Meta_Body_Tool` / `BP_Meta_Face_Tool` / `BP_Save_Game_Data` pour les deux écrans de curseurs | une ligne de spawn client (part du propriétaire) | clic « Top_1 » change la tenue en jeu |

**Ensuite seulement** : l'exécutant client (part du propriétaire) fait
`Widget("narvos::Widget_Customizer")` + `AddToViewport()`, et pilote par
`CallBlueprintEvent` / `BindBlueprintEventDispatcher` avec les noms MESURÉS du
catalogue (`Shared/Catalogs/Widgets.lua` — chaque nom vérifié par un
`GetBlueprintPropertyValue` en retour, puisque `SetBlueprintPropertyValue` ne
lève pas sur nom inconnu). `WidgetsLogic.EcransMigrables()` liste déjà ce
couple avec ses prérequis ; `WidgetsLogic.Reference(id)` refusera de construire
la référence tant que l'état n'est pas `declare`.

### Les trois autres candidats et pourquoi ils ne le valent pas (au 09/09)

| widget mesuré | panneau visé | pourquoi non |
|---|---|---|
| DGGUI (17 fichiers, 3 cuits) | `graphismes` | génère l'UI d'un objet **Mutable**, pas un menu de réglages ; 14 éléments non cuits ; coût = fabriquer un CustomizableObject de réglages ≫ panneau HTML qui marche |
| `WB_SimpleController` (cuit, non déclaré) | `commandes` | **affiche** l'état des touches, ne les édite pas ; `Logic/Raccourcis.lua` + HTML font déjà l'édition persistée |
| `WB_SimpleTextBlock` (cuit, non déclaré) | annonces/infobulles HUD | la seule brique réutilisable sans dépendance — mais elle n'apporte qu'un texte encadré ; à déclarer au prochain cook **si** un besoin d'annonce UMG surgit, pas avant |
| `BasicMenu` (Lobby), `Showcase_HUD`, `Infinite_*`, `BP_Hud` | `pause`, HUD | couplés aux scènes de démo Mutable/FluidFlux (`LoadInfiniteButton`, `OpenLevel FluxOceanMap`…) : pas paramétrables sans réécriture |

**Coût du « rien brancher »** : zéro — les 9 panneaux HTML sont verts sous
`ui-liens`. **Coût du « tout brancher »** : 4 préalables × 16 widgets pour un
seul écran. La décision rationnelle au 09/09 : **garder les 9 panneaux,
programmer le cook MetaCustom comme chantier ADK distinct**, et laisser le
catalogue/la logique déjà câblés absorber la bascule le jour où `etat` passe à
`declare` (le vérificateur le signalera en `ETAT` si l'Assets.toml avance avant
le catalogue).

---

⚠ **L'éditeur Unreal n'a PAS été ouvert.** Tout ce qui suit est extrait des
fichiers sur disque par `scripts/narvos-umg-scan.py` (écrit pour cette tâche) :
un `.uasset` porte une **table de noms** — tout identifiant que le Blueprint
connaît (variables, fonctions custom, composants de l'arbre UMG, références
externes, signatures de délégués) y figure en clair. Sortie brute complète :
`docs/ui-umg-scan.json` (48 widgets balayés, 0 absent).

Ce que cette méthode **peut** prouver : un nom EXISTE dans l'asset.
Ce qu'elle **ne peut pas** prouver : le type exact d'une variable, ses valeurs
par défaut, la liste des paramètres d'une fonction, la mise en page visuelle,
et — pour les widgets **cuits** — le graphe éditeur (stripé au cook ; seuls
survivent variables, fonctions publiques, dispatchers et composants).

Chaque rubrique ci-dessous est donc marquée **MESURÉ** (nom lu dans le
`.uasset`, fichier cité) ou **NON VÉRIFIABLE SANS L'ÉDITEUR**. Rien n'est
inventé : `SetBlueprintPropertyValue` ne lève pas sur un nom inconnu, un nom
supposé est une panne silencieuse (fait établi par le propriétaire, confirmé
par l'absence de tout contrôle côté API —
`libraries/api-main/api-main/Classes/Widget.json:278-292`).

---

## 0. Trois faits qui contredisent la mission — tous mesurés

### 0.1 « 44 WidgetBlueprint, déjà cuits » — faux pour les deux tiers

État réel du pack cuit `WebPortal/Server/Assets/narvos/` (mesuré par `find`
sur les `.uasset`, 2026-09-08) :

| pack | widgets dans l'ADK | **cuits dans le pack** | déclarés dans `Assets.toml` |
|---|--:|--:|--:|
| MetaCustom (16) | 16 (dont 2 `Widget_Customization`) | **0** | 0 |
| UI / DGGUI (16) | 17 fichiers (14 éléments + 2 coquilles + 1 interface) | **3** (coquilles seulement) | 0 |
| Infinite (2) | 2 | 2 | 0 |
| Lobby (2) | 2 | 2 | 0 |
| Showcase (2) | 3 (`Showcase_HUD`, `BasicMenu_Showcase`, + acteur `BC_MutableShowcaseHud`) | 3 | **1** (`BC_MutableShowcaseHud`) |
| FluidFlux (2) | `BP_Hud` (+ presets couleur) | **0** | 0 |
| Widgets (3) | 4+ | 4 (`EUW_InteractableButton`, `WB_SimpleController`, `WB_SimpleTextBlock`, `StillCam`) | 0 |
| (bonus) SmartLocomotion | `Widget_Cursor` | 1 | 0 |

Le seul widget-adjacent **déclaré** dans
`WebPortal/Server/Assets/narvos/Assets.toml` est
`BC_MutableShowcaseHud = "Narvos/Showcase/ExampleContent/BC_MutableShowcaseHud"`
(ligne 64440, section `[assets.blueprints]` ouverte ligne 64424) — et c'est un
**acteur** Blueprint (classe `Blueprint` dans l'inventaire ADK), pas un
UserWidget. **Aucun UserWidget n'est aujourd'hui référençable depuis Lua** :
`Widget("narvos::X")` exige une clé d'`Assets.toml`
(`docs/core-concepts/assets.mdx:124-136` : `"[ASSET_PACK_PATH]::[ASSET_KEY]"`,
la clé étant « defined in the Assets.toml »).

Conséquence directe : **avant tout spawn, il faut un cook qui embarque les
widgets ET un `Assets.toml` qui les déclare.** Le catalogue
`Shared/Catalogs/Widgets.lua` porte donc un champ `etat` par widget
(`declare` / `cuit_non_declare` / `adk_seul`), vérifié par
`scripts/narvos-verifier-catalogues.mjs` (contrôle « Widgets » ajouté pour
cette tâche).

⚠ La catégorie exacte attendue pour un UserWidget dans `Assets.toml`
(`[assets.blueprints]` ou `[assets.others]`) n'est **pas documentée** dans la
doc locale : `docs/core-concepts/assets.mdx:154` ne décrit que « Actor
Blueprints ». Marqué NON VÉRIFIABLE — à trancher au premier cook (le
générateur `WBP_AssetsTomlGenerator` de l'ADK classe par registre, il le
dira).

### 0.2 Les widgets MetaCustom ne sont PAS autonomes

Chacun des 16 référence, en dur dans son `.uasset` :

```
/Game/Metahuman_Customization_System/Meta_Styler/Bluepritns/BP_Meta_Styler
```

(extrait de `WebPortal/Server/adk/Content/Narvos/MetaCustom/Meta_Styler/Widgets/Widget_Tops.uasset`,
table de noms — la faute « Bluepritns » est dans le pack d'origine).

Le graphe contient `GetAllActorsOfClass` : **le widget cherche un acteur
`BP_Meta_Styler` dans le monde** et c'est lui qui applique les tenues. Sans cet
acteur spawné côté client, le vestiaire UMG est une coquille inerte. Les deux
`Widget_Customization` dépendent de même de `BP_Meta_Body_Tool` /
`BP_Meta_Face_Tool` (+ `BP_Save_Game_Data`).

Second point, même table de noms : les copies sous `Content/Narvos/MetaCustom/`
référencent encore leurs textures à **l'ancien chemin**
(`/Game/Metahuman_Customization_System/Textures/…`). C'est le piège §9 du
skill (« un .uasset porte son chemin de package en dur ») : un cook du dossier
`Narvos/MetaCustom` seul produirait des widgets aux vignettes mortes. Le pack
devra monter AUSSI `Metahuman_Customization_System` dans `unreal_folders`, ou
les références devront être reparentées dans l'éditeur.

### 0.3 Le kit DGGUI n'est PAS un kit de réglages générique

La mission le destinait à l'écran « graphismes ». Mesuré : les 14 éléments et
les 2 coquilles référencent tous `/Script/CustomizableObject` (et la plupart
`/Script/GameplayTags`) — c'est le plugin **Mutable**. Les variables sont des
métadonnées de paramètres Mutable (`MutableParamUIMetadata`,
`IntegerOptionUIMetadata_MinimumValue`, `StateMedatada_UIOrder`…), les
fonctions fabriquent un widget PAR PARAMÈTRE d'un `CustomizableObjectInstance`
(`CreateFloatWidget`, `AddParameterToSectionWidget`, `ConstructStates`,
variable `COInstance` — extraits de
`Narvos/UI/DynamicallyGeneratedGUI_DGGUI/DynamicallyGeneratedGUI_DGGUI.uasset`
cuit). DGGUI génère l'UI **d'un objet Mutable**, pas celle d'un menu de
réglages quelconque. Mutable est whitelisté (skill §16), donc le kit TOURNE
dans nanos — mais l'utiliser pour « graphismes » suppose de fabriquer un
CustomizableObject dont les paramètres seraient nos réglages : un détour, pas
un raccourci.

---

## 1. L'API qui pilote tout ça — relue dans `Widget.json`

Fichier : `WebPortal/Server/nanos_world/libraries/api-main/api-main/Classes/Widget.json`
(lu en entier, 376 lignes). Toutes les méthodes sont `"authority": "client"`.

| méthode | ligne | signature vérifiée |
|---|--:|---|
| constructeur UserWidget | 10-19 | `Widget(blueprint_path)` — `BlueprintPath`, « A custom UserWidget Blueprint to spawn » |
| constructeur natif | 20-30 | `Widget(NativeWidget.…)` |
| `CallBlueprintEvent` | 199-223 | `(event_name, arguments...)` — retourne les valeurs de retour **côté client** ; efficacité `slow` |
| `BindBlueprintEventDispatcher` | 225-257 | `(dispatcher_name, callback)` — callback reçoit `(self, params...)` ; retourne le callback |
| `UnbindBlueprintEventDispatcher` | 259-276 | `(dispatcher_name, callback=nil)` |
| `SetBlueprintPropertyValue` | 278-292 | `(property_name, value)` — `slow` ; **aucune validation de nom documentée** |
| `GetBlueprintPropertyValue` | 294-310 | `(property_name)` → `any` |
| `SetContentForSlot` | 142-158 | `(slot_name, widget=nil)` — `nil` retire le contenu |
| `AddChild` | 129-140 | `(other)` — type **`WebUI\|Widget`** : une page HTML se pose DANS un widget |
| `AddToViewport` | 123-127 | remplit tout l'écran |
| `SetSlotCanvasLayout` | 160-197 | `(offset_left_top, offset_right_bottom, anchors_min, anchors_max, alignment)` — exige un parent CanvasPanel |
| `SetSlotAlignment` / `SetSlotPadding` / `SetSlotSize` | 312-373 | selon le type de slot parent |
| `SetVisibility` / `GetVisibility` | 85-107 | `WidgetVisibility` |
| `SetFocus` | 109-114 | un seul widget à la fois |
| `BringToFront` | 116-121 | exige d'être parenté au viewport |
| `SpawnWidget3D` | 34-83 | `(location, rotation, widget_space, auto_size, size, auto_repaint_rate, pivot)` → `Widget3D` |

`"events": []` (ligne 375) : la classe n'émet rien d'elle-même — tout passe par
les dispatchers du Blueprint.

---

## 2. MetaCustom — le vestiaire modulaire (16 widgets, ADK seul)

Source mesurée : `WebPortal/Server/adk/Content/Narvos/MetaCustom/**` (fichiers
non cuits — table de noms COMPLÈTE, graphe éditeur inclus). Copie d'origine
identique sous `Content/Metahuman_Customization_System/`.

**État : `adk_seul` pour les 16.** Rien de cuit, rien de déclaré. Avant tout
usage : cook + déclaration + résoudre la dépendance `BP_Meta_Styler` (§0.2).

### 2.1 Les treize panneaux d'items (Meta_Styler/Widgets/)

Patron commun, mesuré identique sur les treize : un `CanvasPanel`, une
`VerticalBox` (`vbox`), des paires `Item_N_Box` / `Item_N_Button`, 8 événements
liés `OnButtonClickedEvent` (signatures `BndEvt__…_DelegateSignature` dans la
table de noms), et des **événements custom** `X_N_Pressed` + un « remove ».
**Aucun event dispatcher custom détecté** (pas de
`MulticastInlineDelegateProperty` dans la table de noms de `Widget_Tops` —
vérifié widget par widget dans `docs/ui-umg-scan.json`) : ces panneaux
**poussent** vers `BP_Meta_Styler`, ils ne **notifient** pas Lua. Le flux Lua
→ widget se limiterait donc à l'affichage ; la donnée (liste des items) est
câblée en dur côté Blueprint (textures de vignettes à l'ancien chemin).

| widget | taille | événements custom MESURÉS | vignettes référencées |
|---|--:|---|---|
| `Widget_Tops` | 170 346 o | `Top_1_Pressed`…`Top_7_Pressed`, `Remove Top Pressed` | `T_top`, `T_Thumb`, `T_B1`, `T_Remove` |
| `Widget_TopsM` | 169 844 o | idem (`Top_1..7_Pressed`, `Remove Top Pressed`) | mêmes, `Male_Thumbs` |
| `Widget_Bottoms` | 174 142 o | `Bottoms_1..7_Pressed`, `Remove Bottoms Pressed` | `T_Bot_Thumb`, `T_bottom` |
| `Widget_BottomsM` | 173 585 o | idem | idem (Male) |
| `Widget_Hair` | 178 018 o | `Groom 1 Pressed`…`Groom 7 Pressed`, `Remove Groom Pressed` | `Empty_Item_T` (Fantasy_RPG_Game) |
| `Widget_Hair_M` | 177 608 o | idem | idem |
| `Widget_Skin` | 177 997 o | `Skin 1 Pressed`…`Skin 7 Pressed`, `Skin Removed Pressed` | — |
| `Widget_Skin_M` | 177 587 o | idem | — |
| `Widget_ShoesM` | 167 334 o | `Shoes_1..7_Pressed`, `Remove_Shoes_Pressed`, `Shoes Button Pressed` | `T_S_Thumb` |
| `Widget_Costumes` | 175 332 o | `Costume_1..7_Pressed`, `Remove_Costume_Button` | `T_C_Thumb`, `T_C_Thumb3`, `T_Outfit` |
| `Widget_CostumesM` | 173 825 o | idem | `T_C_Thumb`, `T_C_Thumb3` (Male) |
| `Widget_Props` | 172 912 o | `Props 1 pressed`…`Props 7 pressed`, `Remove Props Pressed` | `T_P_Thumb` |
| `Widget_PropsM` | 172 457 o | idem | idem |

- **Variables Blueprint exposées** : NON VÉRIFIABLES telles quelles — des noms
  de variables sont présents (`AllWidgets`, `DataKey`/`DataValue`…), mais
  distinguer une variable exposée d'un nom de pin interne exige l'éditeur.
- **Slots nommés** : `AvailableNamedSlots` figure dans les tables de noms,
  mais **aucun nom de slot concret** n'y apparaît → probablement **aucun
  NamedSlot** ; à confirmer dans l'éditeur avant d'écrire un
  `SetContentForSlot`.

### 2.2 `Widget_Customizer` (Meta_Styler) — le conteneur parent

913 767 o, 1 153 noms. Référence **tous** les widgets Meta_Styler (Tops,
Bottoms, Hair, Skin, Shoes, Costumes, Props, M et non-M) : c'est l'écran qui
les héberge.

MESURÉ (table de noms) :
- composants : `ButtonHair`, `ButtonShowRemoveBottoms`,
  `ButtonShowRemoveCostumes`, `ButtonShowRemoveFeet`, `ButtonShowRemoveProps`,
  `ButtonShowremoveTopsMenu`, `ButtonToggleClothing`, `Female_Button`, un
  CheckBox, `HairColorBorder`, `HairStaturationBoarder` (sic) ;
- variables couleur : `Eye_Color`, `Eye_Brightness`, `Eye_Brightness_Value`,
  `Eye_Inner_Value`, `Eye_Outer_Value`, `Inner_Eye_Color`, `Hair_Color_H_Value`,
  `Hair_Color_V_Value` ;
- fonctions/événements : `Hide`, `Hide_gender_selection`,
  `Change_Hair_Color` — **ce dernier a sa propre
  `…__DelegateSignature`**, donc événement custom OU event dispatcher ;
  `MulticastInlineDelegateProperty` est présent dans la table de noms, ce qui
  fait pencher pour un **dispatcher**. Nature exacte NON tranchée sans
  l'éditeur : si dispatcher → `BindBlueprintEventDispatcher("Change_Hair_Color", cb)` ;
  si événement → il s'appelle par `CallBlueprintEvent`. ⚠ L'hypothèse inverse
  échoue en silence.
- `AvailableNamedSlots` présent ; noms de slots NON identifiables.

### 2.3 `Widget_Customization` — corps (Meta_Body_Tool) et visage (Meta_Face_Tool)

Deux widgets **homonymes**, deux dossiers — attention au chemin dans
`Assets.toml` le jour du cook.

Corps (3 220 058 o). MESURÉ :
- curseurs : `Arm_LengthSlider`, `ArmSizeSlider`, `BreastSize_Slider`,
  `Buttockssize_Slider`… ; cases `Enable_Arm_Length`, `Enable_Arm_Size`,
  `Enable_Buttocks_Size`, `Enable_Chest_Size`, `Enable_Foot_Size`,
  `Enable_Hand_Size`, `Enable_Head_Size`, `Enable_Height`,
  `Enable_Lower_Hip_Size`, `Enable_Lower_Waist_Size`,
  `Enable_Middle_Waist_Size`, `Enable_Shin_Size`, `Enable_Thigh_Size`…
- événements liés : sliders → `OnFloatValueChangedEvent`, cases →
  `OnCheckBoxComponentStateChanged` ;
- persistance : `LoadGameFromSlot`, `SaveGameToSlot`, `Current_Save_Slot`,
  `Main Save Slot` — le widget SAUVEGARDE via un `BP_Save_Game_Data` ;
- dépend de `BP_Meta_Body_Tool`.

Visage (3 180 113 o). MESURÉ :
- curseurs : `BrowShape_Slider`, `EarShapeSlider`, `Enable_Eye_*`,
  `Enable_Jaw Shape`, `Enable_Lip Shape`, `Enable_Nose Shape`…
- customs avec signature de délégué propre : **`Hide_Orc_Teeth`** et
  **`Show_Orc_Teeth`** (même ambiguïté événement/dispatcher que §2.2) ;
- `Face_Slot_1`…`Face_Slot_13` (préréglages) ;
- dépend de `BP_Meta_Face_Tool` et `BP_Save_Game_Data`.

---

## 3. UI / DGGUI — le kit Mutable (17 fichiers ADK, 3 seulement cuits)

Cuits (présents sous `WebPortal/Server/Assets/narvos/Narvos/UI/DynamicallyGeneratedGUI_DGGUI/`,
vérifiés par `find`) : `DynamicallyGeneratedGUI_DGGUI.uasset`,
`Widget_DGGUI.uasset`, `WidgetInterface_DGGUI.uasset`. Les 14 éléments
(`Bool`, `Float`, `Int`, `Color`, `ColorBar`, `List`, `Label`, `Section`,
`Layers`, `IntThumbnail`, `Projector`, `ProjectorButton`, `State`, `Instance`,
suffixés `_DGGUI`) sont dans l'ADK et **pas dans le pack cuit** (test fichier
par fichier, § « DGGUI-cuits » du journal). **État : `cuit_non_declare` pour
les 3 coquilles, `adk_seul` pour les 14 éléments.**

### 3.1 `DynamicallyGeneratedGUI_DGGUI` (coquille, cuite, 35 847 o)

MESURÉ dans le cuit — fonctions publiques (appelables par
`CallBlueprintEvent`, **paramètres NON vérifiables**) :

```
ActivateNextState · ActivatePreviousState · ActivateWireframe ·
AddLayerWidget · AddParameterToSectionWidget · AddParameterWidgetToScrollbox ·
ChangeCamYaw · ChangeCamZoom · ChangeWireframe · CheckIfDefaultStatesAreValid ·
ConstructStates · ConstructStateWidgets · CreateBooleanWidget ·
CreateColorWidget · CreateFloatWidget · CreateInstanceSelector ·
CreateIntWidget · CreateParameterWidget · CreateProjectorWidget ·
CreateSectionWidget · FillGeneratedWidgetsArray · GetAllUIStatesNames ·
GetCurrentStateIndex · GetCustomizableSkeletalComponent · GetInstanceButtons ·
GetParameterName · InitControllerDetection · IsParameterParentActive ·
IsParameterRelevant · MoveProjector · MoveUICam
```

Variables MESURÉES (noms présents ; types NON vérifiables) : `COInstance`,
`CustomizableComponent`, `AllUIStateNames`, `InstanceButtons`,
`InstancesNames`, `bEmptyStates`, `bGameStateExists`, `bInitialStateExists`,
`InLockerEditor`, `CurrentStateWidgetPage`, `EditingProjector`,
`MenuBackground`, `DefaultCamTransform`…
Dispatcher probable : `InstanceUpdated` (nom présent, nature à confirmer).

⚠ Tout cela s'alimente d'un `CustomizableObjectInstance` : sans objet Mutable,
l'écran est vide.

### 3.2 `Widget_DGGUI` (élément conteneur, cuit, 6 833 o)

MESURÉ — fonctions : `CreateLayerWidgets`, `MakesChildWidgets`,
`IsWidgetActive`, `PaintButton`, `ReverseColors`, `OnHide`.
Variables : `ParentWidget`, `ParentScrollbox`, `NewLayerWidget`, `LayerIndex`,
`IconTexture`, `IconColor`, `BackgroundColor`, `ActiveSelected`,
`ActiveUnselected`, `InactiveSelected`, `InactiveUnselected`, plus les
métadonnées Mutable (`ParamName`, `UIOrder`, `UISectionName`, `UIThumbnail`,
`MinimumValue`, `MaximumValue`…).

### 3.3 `WidgetInterface_DGGUI` — pas un widget

`BPTYPE_Interface` dans sa table de noms : c'est une **interface Blueprint**
(le contrat que les éléments implémentent). Non spawnable par `Widget()`.

### 3.4 Les 14 éléments (ADK seul, NON cuits)

MESURÉ (ADK non cuit, graphe complet) — événements liés aux composants :

| élément | composant(s) lié(s) | fonctions/variables notables |
|---|---|---|
| `Bool_DGGUI` | CheckBox → `OnCheckBoxComponentStateChanged` | `CheckBoxLabel` ; commentaire « Updating skeletal mesh when bool value changes » |
| `Float_DGGUI` | Slider → `OnFloatValueChangedEvent`, capture souris/manette | `MainHorizontalBox`, `SelectColor`, `OnInit` |
| `Int_DGGUI` | ComboBox → `OnSelectionChangedEvent` | `AddOption`, `FillOptionsInfoContainers`, `ErrorMsg` |
| `Color_DGGUI` | `Hue_Slider`/`Saturation_Slider`/`Value_Slider` + `EditButton` | `GetColor`, `GetHue`, `GetSaturation`, `HSVToRGB`, `ColorParamName` |
| `ColorBar_DGGUI` | Slider → `OnFloatValueChangedEvent` | `SliderBarColor` |
| `List_DGGUI` | `NextOptionButton`/`PrevOptionButton` | `CurrentOption`, `CurrentOptionIndex`, `NumOptions`, `DisplayListOptions`, `FillListOptionsArray` |
| `Label_DGGUI` | — | `LabelTextBlock`, `TextToUpper` |
| `Section_DGGUI` | — | `SectionText`, `SectionTitleContainer` |
| `Layers_DGGUI` | `AddButton`/`RemoveButton` | `AddLayer`, `RemoveLayer`, `GetNumLayers`, `AddValueToFloatRange`… |
| `IntThumbnail_DGGUI` | CheckBox | `InitThumbnails`, métadonnées `IntegerOptionUIMetadata_*` |
| `Projector_DGGUI` | gizmo 3D | `ChangeCam`, `AngleDeg`, `Cylindrical_X/Y/Z`, `DefaultAngle`… |
| `ProjectorButton_DGGUI` | Button (checkbox) | `GetCheckedState`, `Mode` |
| `State_DGGUI` | CheckBox | `TextCheckBox`, `ThumbnailCheckBox`, `UpdateStyle`, métadonnées `StateMedatada_*` |
| `Instance_DGGUI` | — | `InstanceButton`, `NextInstanceButton`, `PreviusInstanceButton` (sic), `InstanceNameText` |

---

## 4. Infinite, Lobby, Showcase — les démos Mutable (cuites, non déclarées)

Ces packs sont les **scènes de démonstration du système Mutable** (Lobby
contient `COI_Cyborg` / `COI_Weapon`, Customizable Object Instances — mesuré
par listing). Leurs widgets le prouvent : boutons `LoadLobby`,
`LoadInfiniteButton`, `LoadShowcaseButton`. **État : `cuit_non_declare`.**

### 4.1 `Infinite/Infinite_HUD` (10 041 o)

MESURÉ — variables : `InstancesGenerated(Text)`, `InstancesTotal(Text)`.
Fonctions : `ToggleBenchmark`, `ToggleWireframe_Keyboard`. HUD de bench de la
démo Infinite. Aucun intérêt pour NARVOS hors démo.

### 4.2 `Infinite/UIElements/BasicMenu_Infinite` (25 343 o)

MESURÉ — composants : SpinBoxes `SB_InstancesNum`, `SB_MaxRegionPerTick`,
`SB_OccludersNum`, `SB_RegionWidthInstances`, `SB_RegionWidthScenery` ;
boutons `RunInfiniteButton`, `LoadLobbyButton`, `ExitButton`,
`OpenOptionCheckBox` ; conteneurs `MainMenuContainer`, `OptionsMenu`.
Fonctions : `ShowMenu`, `HideMenu`. Binding mesuré : `OnValueCommitted_Event`
(événement des SpinBoxes). Menu des paramètres de la démo — pas un menu
générique.

### 4.3 `Lobby/HUD` (18 293 o)

MESURÉ — fonctions : `ApplyProjectionImage`, `HideText`, `UpdateControlsText`.
Variables : `IsWeapon`, `IsProjecting`, `isMobile`, `IsController`,
`LastMousePosition`. HUD du lobby (projection de la vignette
personnage/arme). Couplé à la scène Lobby.

### 4.4 `Lobby/UIElements/BasicMenu` (16 643 o)

MESURÉ — composants : `EditCharacterButton`, `LoadInfiniteButton`,
`LoadShowcaseButton`, `ToggleWireframeCheckBox`, `OpenOptionCheckBox`,
`OptionContainer`, `OptionsMenu`, `ConfirmButton`, `ExitButton`,
`MainMenuContainer`. Variable : `OptionsIsOpen`. Fonctions : `ShowMenu`,
`HideMenu` (noms présents). Menu de navigation entre les trois démos.

### 4.5 `Showcase/UIElements/Showcase_HUD` (27 357 o)

MESURÉ — fonctions : `ShowInstanceEditUI`, `HideInstanceEditUI`,
`ShowInstanceCloseEditUI`, `HideInstanceCloseEditUI`, `ShowToggleWireframeUI`,
`HideToggleWireframeUI`, `EditInstance_Keyboard`, `EditInstance_Gamepad`,
`CloseEditInstance_Keyboard`, `CloseEditInstance_Gamepad`,
`ToggleWireframe_Keyboard`, `ToggleWireframe_Gamepad`, `ApplyProjectionImage`,
`UpdateControlsText`. Variable : `UINavigation`. HUD d'édition d'instance
Mutable — c'est le frère de `Lobby/HUD` pour la scène Showcase.

### 4.6 `Showcase/UIElements/BasicMenu_Showcase` (12 837 o)

MESURÉ — composants : `ContinueButton`, `LoadLobbyButton`, `ExitButton`,
`MainMenuContainer`. Fonctions : `ToggleMenu`, `ShowMenu`, `HideMenu`,
`ExitGame`, `GoBackToLobby`, `Continue`. **Dispatchers probables** :
`OnEditStarted` et `OnEditFinished` — les liaisons `OnEditStarted_Event` /
`OnEditFinished_Event` et `DelegateProperty` figurent dans la table de noms ;
la forme exacte du nom à passer à `BindBlueprintEventDispatcher` est à
confirmer dans l'éditeur.

### 4.7 `Showcase/ExampleContent/BC_MutableShowcaseHud` (4 212 o) — le SEUL déclaré

`Assets.toml:64440`, `[assets.blueprints]`. Mais c'est un **acteur** (classe
`Blueprint` dans `WebPortal/Server/adk/_assets-inventory.json`), pas un
UserWidget : `DefaultSceneRoot`, `ReceiveDrawHUD`, `ShouldDrawCrosshair`,
`DynUI`, `SizeX`/`SizeY`. Spawnable par la classe `Blueprint` de nanos, pas
par `Widget()`. Son rôle exact (il tient probablement le HUD de la démo) est
NON VÉRIFIÉ — à lire dans l'éditeur si un jour on s'en sert.

---

## 5. Widgets (pack « Widgets », cuit) + Widget_Cursor

### 5.1 `Widgets/WidgetData/EUW_InteractableButton` (2 073 o, cuit)

Table de noms quasi vide de custom : un `TextBlock` racine, et c'est tout.
C'est un **bouton-texte minimal**. Aucune variable, fonction ou dispatcher
custom détecté dans le cuit. Utilisable comme brique (une fois déclaré), mais
il n'apporte rien qu'un `Widget(NativeWidget.Button)` + texte ne fasse déjà —
voir `widget.mdx`, exemple « Creating a Widgets with Childs ».

### 5.2 `Widgets/WidgetData/WB_SimpleController` (20 338 o, cuit)

MESURÉ — c'est un **overlay d'aide manette/clavier** : une variable image par
touche (`A_On`/`A_Off`, `B_`, `X_`, `Y_`, `LB_`, `RB_`, `LT_`, `RT_`, `LS_`,
`RS_`, `DPad_`, `Start_`, `Select_`, `WSAD`, `MOUSE`, `Center_Button_Off`…),
fonctions `SetWSADValues`, `SetMouseValues`, `GetKeysTotalAnalogState`,
`GetInputVectorKeyState`, `VInterpTo`… Il AFFICHE l'état des entrées ; il
n'édite pas des bindings. Réutilisable tel quel comme aide contextuelle
manette, une fois déclaré.

### 5.3 `Widgets/WidgetData/WB_SimpleTextBlock` (6 691 o, cuit)

MESURÉ — variables : `BoxColor`, `BoxSize`, `IsBold`, `TextAlignment`,
`TextPadding`, `TextColor`, `ShadowOffset`, `Font`… Fonctions : `SetUpBox`,
`UpdateText`. Un bloc de texte encadré stylé — la brique la plus réutilisable
du lot (infobulles, annonces).

### 5.4 `Widgets/WidgetData/StillCam` (cuit)

Classe `Blueprint` (acteur caméra) dans l'inventaire — pas un UserWidget.
Hors sujet UI.

### 5.5 `SmartLocomotion/Blueprints/Widget_Cursor` (cuit)

MESURÉ — un seul composant notable : `Image_Cursor`. Curseur personnalisé de
la démo SmartLocomotion.

---

## 6. FluidFlux — `BP_Hud` (ADK seul, NON cuit)

`WebPortal/Server/adk/Content/Narvos/FluidFlux/Demo/Blueprints/BP_Hud.uasset`.
MESURÉ : HUD de la démo FluidFlux — compteur FPS (`TextFPS`, `DeltaMs`,
`FPSTimer`), changement de map (`OpenLevel` vers `FluxOceanMap`,
`FluxBeachMap`, `FluxCoastlineMap`…), presets de couleur d'eau
(`CP_ShoreBlue_01`…), `ToggleVisible`. Références `/Game/Narvos/FluidFlux/…`
(donc la copie sous Narvos est cohérente, contrairement à MetaCustom).
**Aucune réutilisabilité NARVOS** : c'est l'UI de démonstration de l'eau.

---

## 7. Verdict garder / remplacer — les neuf panneaux WebUI

Critères demandés : l'UMG équivalent existe-t-il **vraiment** (cuit +
déclaré + pilotable), le panneau HTML fait-il déjà le travail, coût de
migration. Mesures de référence : §0.1 (aucun UserWidget déclaré), §0.2
(MetaCustom couplé à `BP_Meta_Styler`), §0.3 (DGGUI = Mutable-only).

| panneau (`narvos-map-proto/Client/UI/`) | verdict | pourquoi en une ligne |
|---|---|---|
| `inventaire` | **GARDER** | Aucun UMG d'inventaire n'est cuit ni même dans l'ADK nanos (Inventory System Pro vit dans `public/asset_game`, UE 5.4, jamais importé) ; `Logic/Inventory.lua` (persisté, testé) alimente déjà le panneau HTML. |
| `personnage` | **GARDER** | Pas d'équivalent UMG cuit ; le panneau HTML affiche classes/stats depuis `Narvos.Classes` — rien à gagner. |
| `props` | **GARDER** | `Widget_Props` MetaCustom est un vestiaire d'accessoires de PERSONNAGE (couplé `BP_Meta_Styler`, non cuit), pas un panneau de spawn de props. |
| `spawn` | **GARDER** | Aucun équivalent UMG mesuré ; panneau adossé à `Catalogs/Spawnables.lua`, vérifié par `narvos-verifier-catalogues`. |
| `commandes` | **GARDER** | `WB_SimpleController` est un overlay d'AFFICHAGE des touches (non déclaré), pas un éditeur de bindings ; `Logic/Raccourcis.lua` + HTML font le travail. |
| `garde-robe` | **GARDER, remplacement différé** | L'équivalent UMG existe (MetaCustom, 16 widgets mesurés) MAIS : non cuit, non déclaré, couplé à `BP_Meta_Styler` (acteur monde à spawner), vignettes à l'ancien chemin `/Game/Metahuman_Customization_System/…`. Migration = cook + reparentage + acteur + contrat : un chantier, pas une substitution. |
| `radar` | **GARDER** | Aucun équivalent UMG ; `Logic/Radar.lua` + canvas HTML font déjà le rendu temps réel. |
| `pause` | **GARDER** | `BasicMenu` (Lobby) navigue entre démos Mutable (`LoadInfinite`, `LoadShowcase`) ; pas paramétrable depuis Lua sans contrat mesuré. |
| `graphismes` | **GARDER** | La mission supposait DGGUI fait pour ça ; mesuré §0.3 : DGGUI génère l'UI d'un `CustomizableObjectInstance` Mutable, pas un menu de réglages — et 14 de ses 17 fichiers ne sont même pas cuits. `Logic/Graphismes.lua` + HTML restent la voie. |

**Conclusion du verdict** : aucun remplacement aujourd'hui. Le seul candidat
sérieux est `garde-robe` → MetaCustom, et il est subordonné à quatre travaux
préalables (cook du pack MetaCustom, déclaration `Assets.toml`, reparentage
des références `/Game/Metahuman_Customization_System/…`, spawn de
`BP_Meta_Styler` côté client). Tout le reste serait remplacer ce qui marche
par ce qui n'existe pas encore.

---

## 8. Ce dont je ne suis pas sûr

- **Catégorie `Assets.toml` d'un UserWidget** : la doc locale ne dit pas si un
  UserWidget se déclare en `[assets.blueprints]` ou `[assets.others]`
  (`assets.mdx:154` ne couvre que les Actor Blueprints). À trancher au premier
  cook via `WBP_AssetsTomlGenerator`.
- **`Change_Hair_Color`, `Hide_Orc_Teeth`, `Show_Orc_Teeth`** : événement
  custom ou event dispatcher ? Les signatures `…__DelegateSignature` et
  `MulticastInlineDelegateProperty` sont mesurées, mais la distinction n'est
  pas lisible dans la table de noms. L'hypothèse inverse échoue en silence.
- **Noms des variables vs noms de pins internes** : la table de noms est
  plate ; je ne peux pas garantir que `Eye_Color` (par exemple) est une
  **variable exposée** du widget plutôt qu'un pin de fonction. Seul l'éditeur
  (ou un dump Python `get_editor_property`) tranche.
- **Paramètres des fonctions mesurées** (`CreateFloatWidget`,
  `AddParameterToSectionWidget`…) : les noms de paramètres figurent
  probablement dans la table de noms, mais leur **appariement** à leur
  fonction n'y est pas lisible de façon fiable. Aucune signature complète
  n'est donc affirmée dans ce contrat.
- **Slots nommés** : `AvailableNamedSlots` est présent dans les MetaCustom
  non cuits, mais aucun nom de slot concret n'apparaît — je conclus
  « probablement aucun », pas « aucun ». Pour les widgets CUITS, cette clé
  est stripée au cook : absence de preuve, pas preuve d'absence.
- **`Widget_Customizer` crée-t-il ses fils lui-même ?** Il référence les 13
  panneaux (mesuré), ce qui suggère qu'il les instancie en interne ; mais le
  graphe n'est pas lisible — peut-être attend-il qu'on les lui passe.
- **MetaCustom dépend-il de plugins non whitelistés ?** Le pack s'appelle
  « Metahuman Customization System » ; Rig Logic est whitelisté (skill §16),
  mais je n'ai pas vérifié fichier par fichier les dépendances des 526
  `.uasset` (groom/Hair Strands ? MetaHuman SDK ?). À faire avant de
  planifier le cook.
- **La copie `Content/Narvos/MetaCustom/` est-elle complète ?** 526 `.uasset`
  mesurés, mais je n'ai pas comparé avec le contenu de
  `Content/Metahuman_Customization_System/` (le doublon). Si des assets
  n'ont pas été copiés, les références à l'ancien chemin sont encore plus
  nombreuses que ce que les 16 widgets montrent.
- **`_assets-inventory.json` est antérieur à la copie MetaCustom** (12:53
  contre 20:18 le 2026-09-07) : les classes exactes des assets MetaCustom
  dans le registre ne sont pas mesurées — mes tables de noms disent
  `WidgetBlueprintGeneratedClass`, c'est suffisant pour les widgets, pas pour
  le reste du pack.
- **`EUW_InteractableButton`** : le préfixe `EUW_` suggère un Editor Utility
  Widget à l'origine ; le cuit porte `WidgetBlueprintGeneratedClass`, donc un
  UserWidget runtime — mais pourquoi il est si vide (2 Ko) n'est pas tranché
  : soit il est vraiment minimal, soit son contenu vit dans des assets frères
  non lus.
- **Le cook d'aujourd'hui (Assets.toml daté 2026-09-08 18:07)** n'a pas
  embarqué MetaCustom ni les éléments DGGUI alors que leurs `.uasset`
  existent dans l'ADK : je n'ai pas vérifié si c'est un choix (pack allégé)
  ou un oubli du manifeste de cook.
- **DGGUI sans Mutable** : je n'ai pas prouvé que les coquilles cuites
  refusent de s'afficher sans `CustomizableObjectInstance` — c'est une
  inférence forte des variables/fonctions mesurées, pas un test en jeu.

---

## ANNEXE — sorties brutes des contrôles, relancés le 2026-09-09

(depuis `E:\narvosprime-web-prototype` ; rien de masqué)

### `node scripts/lua-harness/cablage-check.mjs`

```
90 fichier(s) Lua · 64 module(s) câblé(s) dans Shared/Index.lua
14 autre(s) assignation(s) Narvos.* (exécutants serveur)

[1. tout ce qui est lu est câblé]
  OK        les 65 modules lus sont tous câblés

[2. chaque champ accédé existe dans le module câblé]
  OK        les 101 champs accédés existent tous

Câblage complet et cohérent.
```

### `node scripts/lua-harness/ui-liens.mjs` (extraits significatifs)

```
[identifiants]
  OK        les 44 identifiants lus par le JS existent dans le HTML

[panneaux]
  OK        inventaire
  OK        personnage
  OK        props
  OK        spawn
  OK        commandes
  OK        garde-robe
  OK        radar
  OK        pause
  OK        graphismes

[actions du menu de pause]
  OK        commandes
  OK        parametres
  OK        quitter
  OK        reprendre
  OK        retour

[sous-menus de la pause]
  OK        commandes  — déclaré des deux côtés
  OK        graphismes  — déclaré des deux côtés

Tous les liens page <-> Lua sont relies.
```

### `node scripts/lua-harness/appels-check.mjs` (bilan)

```
Bilan : 134 jamais appelée(s) · 141 confinée(s) à leur fichier.
Ce contrôle RAPPORTE, il ne bloque pas — voir l'en-tête pour pourquoi.
```

(134/141 : chiffres identiques à ceux annoncés par la mission du 09/09 —
aucune régression imputable à ce chantier.)

### `node scripts/narvos-verifier-catalogues.mjs`

```
Verification des catalogues
  notre pack   : 64400 assets
  pack de base : 2314 assets

  Modular          42 references  ok
  Modular liens    52 references  ok
  Spawnables       56 references  ok
  Patches           1 references  ok
  Vegetation        4 references  ok
  Props           449 references  ok
  Vfx             106 references  ok
  Emotes          166 references  ok
  Apparence peau    2 references  ok
  Map Orbital    1546 references  ok
  Map forge_map   623 references  ok
  Map tower_map  1451 references  ok
  Widgets          45 references  ok

Aucune reference morte.
```

### Greps cook (mission §6)

```
$ grep -c BIG_CITY_NIGHT_1 WebPortal/Server/Assets/narvos/Assets.toml   → 0
$ grep -c ForestKitONE     WebPortal/Server/Assets/narvos/Assets.toml   → 0
```

Le cook (82 879 paquets restants au démarrage, mission §6) n'a pas encore
produit ces entrées : le garde `cuit = false` de `Voyage.MondePraticable` doit
rester. À revérifier après la fin du cook — les deux greps suffisent.
