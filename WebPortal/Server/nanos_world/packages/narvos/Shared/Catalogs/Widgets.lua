-- ═══════════════════════════════════════════════════════════════════════════════
-- Widgets.lua — catalogue des WidgetBlueprint UMG achetés, mesuré sur disque.
--
-- ── ⚠ ÉCRIT À LA MAIN, PAS GÉNÉRÉ ─────────────────────────────────────────────
-- Ce fichier n'est la sortie d'aucun générateur TS : il transpose le relevé de
-- `docs/UI_UMG_CONTRAT.md` (lui-même produit par `scripts/narvos-umg-scan.py`,
-- extraction des tables de noms des `.uasset`). Ne jamais le passer sous
-- `narvos-catalogs-to-lua.mjs --apply`.
--
-- ── POURQUOI PAS DE `narvos::X` DANS CE FICHIER ───────────────────────────────
-- Jusqu'au 2026-09-13, AUCUN UserWidget n'était déclaré dans Assets.toml : le
-- constructeur de pack ne connaissait que la classe `Blueprint`, et les 47
-- WidgetBlueprint cuits tombaient en « classe muette ». Il les déclare depuis
-- (`nanos-build-asset-pack.mjs`, `WidgetBlueprint: "blueprints"`). Les fiches
-- gardent néanmoins `cle` + `etat` plutôt qu'une référence toute faite :
-- `WidgetsLogic.Reference` ne construit `narvos::<cle>` que pour un `declare`,
-- et le vérificateur contrôle l'IDENTITÉ par le CHEMIN (une clé homonyme est un
-- rang, qui glisse). Les champs :
--   cle     la clé déclarée pour ce chemin dans Assets.toml
--   chemin  le chemin Unreal mesuré sur disque (sans le préfixe du pack)
--   etat    où en est l'asset, vérifié par le contrôle « Widgets » de
--           narvos-verifier-catalogues.mjs :
--             "declare"           → dans Assets.toml [assets.blueprints]
--             "cuit_non_declare"  → .uasset présent dans le pack cuit, pas de clé
--             "adk_seul"          → .uasset dans l'ADK seulement (pas cuit)
--
-- ⚠ `etat` VIEILLIT À CHAQUE COOK. Le cook du 2026-09-09 a emporté les 16 widgets
-- MetaCustom encore "adk_seul" ; celui du 2026-09-13 a DÉCLARÉ tous les widgets
-- cuits (28 fiches passées à "declare", et la clé de l'outil visage corrigée en
-- `Widget_Customization_2`). Relancer `node scripts/narvos-verifier-catalogues.mjs`
-- après CHAQUE cook : il signale un état périmé sous « ETAT », distinct d'une
-- référence morte.
-- Décompte au 2026-09-13 : 30 declare · 0 cuit_non_declare · 15 adk_seul.
--
-- ── CE QUE LES CHAMPS VEULENT DIRE ────────────────────────────────────────────
--   fonctions    noms MESURÉS dans la table de noms du .uasset. Appelables par
--                Widget:CallBlueprintEvent(nom, ...) [client]. ⚠ Les PARAMÈTRES
--                ne sont pas vérifiables sans l'éditeur : le nom seul est sûr.
--   dispatchers  idem pour Widget:BindBlueprintEventDispatcher [client].
--                "probable" = signature de délégué mesurée, nature (dispatcher
--                vs événement custom) non tranchée sans l'éditeur.
--   dependances  acteurs/assets que le widget cherche dans le monde. Un widget
--                dont la dépendance n'est pas spawnée est une coquille inerte.
-- ═══════════════════════════════════════════════════════════════════════════════

local Widgets = {}

Widgets.PACK = "narvos"

--- Ordre d'affichage — `pairs` n'a aucun ordre garanti en Lua.
Widgets.ORDRE = {
    -- MetaCustom : le vestiaire (16)
    "metacustom_customizer",
    "metacustom_customization_corps",
    "metacustom_customization_visage",
    "metacustom_tops", "metacustom_tops_m",
    "metacustom_bottoms", "metacustom_bottoms_m",
    "metacustom_hair", "metacustom_hair_m",
    "metacustom_skin", "metacustom_skin_m",
    "metacustom_shoes_m",
    "metacustom_costumes", "metacustom_costumes_m",
    "metacustom_props", "metacustom_props_m",
    -- DGGUI : le kit Mutable (3 coquilles cuites + 14 éléments ADK)
    "dggui_coquille", "dggui_widget", "dggui_interface",
    "dggui_bool", "dggui_float", "dggui_int", "dggui_color", "dggui_colorbar",
    "dggui_list", "dggui_label", "dggui_section", "dggui_layers",
    "dggui_intthumbnail", "dggui_projector", "dggui_projectorbutton",
    "dggui_state", "dggui_instance",
    -- Démos Mutable (cuites, déclarées le 2026-09-13)
    "infinite_hud", "infinite_menu",
    "lobby_hud", "lobby_menu",
    "showcase_hud", "showcase_menu", "showcase_hud_acteur",
    -- Widgets divers (cuits)
    "widgets_bouton", "widgets_manette", "widgets_texte", "smartloco_curseur",
    -- FluidFlux (ADK seul)
    "fluidflux_hud",
}

Widgets.WIDGETS = {

    -- ── MetaCustom ─────────────────────────────────────────────────────────
    -- Patron commun des 13 panneaux d'items (mesuré) : CanvasPanel + vbox,
    -- boutons Item_N_Button, événements custom X_N_Pressed, AUCUN dispatcher
    -- custom détecté, dépendance monde BP_Meta_Styler (GetAllActorsOfClass),
    -- vignettes référencées à l'ANCIEN chemin /Game/Metahuman_Customization_System/…
    -- (reparentage ou montage du dossier d'origine requis avant cook — §0.2
    -- du contrat).

    metacustom_customizer = {
        cle = "Widget_Customizer",
        chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_Customizer",
        etat = "declare",
        pack = "MetaCustom",
        role = "conteneur parent du vestiaire : référence les 13 panneaux",
        fonctions = { "Hide", "Hide_gender_selection" },
        dispatchers = { "Change_Hair_Color" }, -- probable (signature mesurée)
        variables = { "Eye_Color", "Eye_Brightness", "Hair_Color_H_Value", "Hair_Color_V_Value" },
        dependances = { "BP_Meta_Styler" },
    },
    metacustom_customization_corps = {
        cle = "Widget_Customization",
        chemin = "Narvos/MetaCustom/Meta_Body_Tool/Widgets/Widget_Customization",
        etat = "declare",
        pack = "MetaCustom",
        role = "curseurs de corps (sliders + cases Enable_*)",
        fonctions = { "LoadGameFromSlot", "SaveGameToSlot" },
        dispatchers = {},
        variables = { "Arm_LengthSlider", "BreastSize_Slider", "Enable_Height", "Enable_Chest_Size" },
        dependances = { "BP_Meta_Body_Tool", "BP_Save_Game_Data" },
        -- ⚠ Homonyme du visage : le pack déclare CELUI-CI `Widget_Customization`
        -- et l'outil visage `Widget_Customization_2` (rang d'homonyme, mesuré au
        -- cook du 2026-09-13). Le vérificateur juge par CHEMIN : un glissement de
        -- rang se voit.
    },
    metacustom_customization_visage = {
        cle = "Widget_Customization_2",
        chemin = "Narvos/MetaCustom/Meta_Face_Tool/Widgets/Widget_Customization",
        etat = "declare",
        pack = "MetaCustom",
        role = "curseurs de visage (BrowShape, Jaw, Lip, Nose…)",
        fonctions = {},
        dispatchers = { "Hide_Orc_Teeth", "Show_Orc_Teeth" }, -- probables
        variables = { "BrowShape_Slider", "EarShapeSlider" },
        dependances = { "BP_Meta_Face_Tool", "BP_Save_Game_Data" },
    },

    metacustom_tops = {
        cle = "Widget_Tops", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_Tops",
        etat = "declare", pack = "MetaCustom", role = "hauts (femme)",
        fonctions = { "Top_1_Pressed", "Top_2_Pressed", "Top_3_Pressed", "Top_4_Pressed",
                      "Top_5_Pressed", "Top_6_Pressed", "Top_7_Pressed", "Remove Top Pressed" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_tops_m = {
        cle = "Widget_TopsM", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_TopsM",
        etat = "declare", pack = "MetaCustom", role = "hauts (homme)",
        fonctions = { "Top_1_Pressed", "Top_2_Pressed", "Top_3_Pressed", "Top_4_Pressed",
                      "Top_5_Pressed", "Top_6_Pressed", "Top_7_Pressed", "Remove Top Pressed" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_bottoms = {
        cle = "Widget_Bottoms", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_Bottoms",
        etat = "declare", pack = "MetaCustom", role = "bas (femme)",
        fonctions = { "Bottoms_1_Pressed", "Bottoms_2_Pressed", "Bottoms_3_Pressed",
                      "Bottoms_4_Pressed", "Bottoms_5_Pressed", "Bottoms_6_Pressed",
                      "Bottoms_7_Pressed", "Remove Bottoms Pressed" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_bottoms_m = {
        cle = "Widget_BottomsM", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_BottomsM",
        etat = "declare", pack = "MetaCustom", role = "bas (homme)",
        fonctions = { "Bottoms_1_Pressed", "Bottoms_2_Pressed", "Bottoms_3_Pressed",
                      "Bottoms_4_Pressed", "Bottoms_5_Pressed", "Bottoms_6_Pressed",
                      "Bottoms_7_Pressed", "Remove Bottoms Pressed" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_hair = {
        cle = "Widget_Hair", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_Hair",
        etat = "declare", pack = "MetaCustom", role = "coiffures (femme)",
        fonctions = { "Groom 1 Pressed", "Groom 2 Pressed", "Groom 3 Pressed", "Groom 4 Pressed",
                      "Groom 5 Pressed", "Groom 6 Pressed", "Groom 7 Pressed", "Remove Groom Pressed" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_hair_m = {
        cle = "Widget_Hair_M", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_Hair_M",
        etat = "declare", pack = "MetaCustom", role = "coiffures (homme)",
        fonctions = { "Groom 1 Pressed", "Groom 2 Pressed", "Groom 3 Pressed", "Groom 4 Pressed",
                      "Groom 5 Pressed", "Groom 6 Pressed", "Groom 7 Pressed", "Remove Groom Pressed" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_skin = {
        cle = "Widget_Skin", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_Skin",
        etat = "declare", pack = "MetaCustom", role = "peaux (femme)",
        fonctions = { "Skin 1 Pressed", "Skin 2 Pressed", "Skin 3 Pressed", "Skin 4 Pressed",
                      "Skin 5 Pressed", "Skin 6 Pressed", "Skin 7 Pressed", "Skin Removed Pressed" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_skin_m = {
        cle = "Widget_Skin_M", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_Skin_M",
        etat = "declare", pack = "MetaCustom", role = "peaux (homme)",
        fonctions = { "Skin 1 Pressed", "Skin 2 Pressed", "Skin 3 Pressed", "Skin 4 Pressed",
                      "Skin 5 Pressed", "Skin 6 Pressed", "Skin 7 Pressed", "Skin Removed Pressed" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_shoes_m = {
        cle = "Widget_ShoesM", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_ShoesM",
        etat = "declare", pack = "MetaCustom", role = "chaussures (homme uniquement mesuré)",
        fonctions = { "Shoes_1_Pressed", "Shoes_2_Pressed", "Shoes_3_Pressed", "Shoes_4_Pressed",
                      "Shoes_5_Pressed", "Shoes_6_Pressed", "Shoes_7_Pressed", "Remove_Shoes_Pressed" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_costumes = {
        cle = "Widget_Costumes", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_Costumes",
        etat = "declare", pack = "MetaCustom", role = "costumes (femme)",
        fonctions = { "Costume_1_Pressed", "Costume_2_Pressed", "Costume_3_Pressed",
                      "Costume_4_Pressed", "Costume_5_Pressed", "Costume_6_Pressed",
                      "Costume_7_Pressed", "Remove_Costume_Button" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_costumes_m = {
        cle = "Widget_CostumesM", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_CostumesM",
        etat = "declare", pack = "MetaCustom", role = "costumes (homme)",
        fonctions = { "Costume_1_Pressed", "Costume_2_Pressed", "Costume_3_Pressed",
                      "Costume_4_Pressed", "Costume_5_Pressed", "Costume_6_Pressed",
                      "Costume_7_Pressed", "Remove_Costume_Button" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_props = {
        cle = "Widget_Props", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_Props",
        etat = "declare", pack = "MetaCustom", role = "accessoires personnage (femme)",
        fonctions = { "Props 1 pressed", "Props 2 pressed", "Props 3 pressed", "Props 4 pressed",
                      "Props 5 pressed", "Props 6 pressed", "Props 7 pressed", "Remove Props Pressed" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },
    metacustom_props_m = {
        cle = "Widget_PropsM", chemin = "Narvos/MetaCustom/Meta_Styler/Widgets/Widget_PropsM",
        etat = "declare", pack = "MetaCustom", role = "accessoires personnage (homme)",
        fonctions = { "Props 1 pressed", "Props 2 pressed", "Props 3 pressed", "Props 4 pressed",
                      "Props 5 pressed", "Props 6 pressed", "Props 7 pressed", "Remove Props Pressed" },
        dispatchers = {}, dependances = { "BP_Meta_Styler" },
    },

    -- ── DGGUI — kit de paramètres Mutable ────────────────────────────────────
    -- ⚠ Tous dépendent de /Script/CustomizableObject (mesuré) : sans
    -- CustomizableObjectInstance, ces widgets n'ont rien à afficher. Ce n'est
    -- PAS un kit de réglages générique (contrat §0.3).

    dggui_coquille = {
        cle = "DynamicallyGeneratedGUI_DGGUI",
        chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/DynamicallyGeneratedGUI_DGGUI",
        etat = "declare",
        pack = "DGGUI",
        role = "coquille : génère l'UI d'un CustomizableObjectInstance",
        fonctions = { "ConstructStates", "ConstructStateWidgets", "CreateBooleanWidget",
                      "CreateFloatWidget", "CreateIntWidget", "CreateColorWidget",
                      "CreateSectionWidget", "CreateProjectorWidget", "CreateInstanceSelector",
                      "AddLayerWidget", "AddParameterToSectionWidget",
                      "AddParameterWidgetToScrollbox", "ActivateNextState",
                      "ActivatePreviousState", "ActivateWireframe", "GetAllUIStatesNames",
                      "GetCurrentStateIndex", "GetCustomizableSkeletalComponent",
                      "IsParameterRelevant", "MoveProjector", "MoveUICam",
                      "ChangeCamYaw", "ChangeCamZoom", "ChangeWireframe" },
        dispatchers = { "InstanceUpdated" }, -- probable
        variables = { "COInstance", "CustomizableComponent", "AllUIStateNames",
                      "InstanceButtons", "InstancesNames", "InLockerEditor" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_widget = {
        cle = "Widget_DGGUI",
        chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/Widget_DGGUI",
        etat = "declare",
        pack = "DGGUI",
        role = "élément conteneur d'un paramètre Mutable",
        fonctions = { "CreateLayerWidgets", "MakesChildWidgets", "IsWidgetActive",
                      "PaintButton", "ReverseColors", "OnHide" },
        dispatchers = {},
        variables = { "ParentWidget", "ParentScrollbox", "LayerIndex", "IconTexture",
                      "ParamName", "UIOrder", "UISectionName" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    -- Déclarée depuis le 2026-09-11 : c'est un Blueprint (pas un
    -- WidgetBlueprint), et le builder de pack taisait les Blueprints inventoriés
    -- après leur classe `_C`. Déclarée ne veut pas dire spawnable :
    -- `interface = true` fait refuser WidgetsLogic.Pret / Reference.
    dggui_interface = {
        cle = "WidgetInterface_DGGUI",
        chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/WidgetInterface_DGGUI",
        etat = "declare",
        interface = true,
        pack = "DGGUI",
        role = "INTERFACE Blueprint (BPTYPE_Interface) — NON spawnable par Widget()",
        fonctions = {}, dispatchers = {}, dependances = {},
    },

    -- Les 14 éléments : ADK seulement, NON cuits (testés un par un le
    -- 2026-09-08 : absents du pack). Événements liés mesurés dans l'ADK.
    dggui_bool = {
        cle = "Bool_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/Bool_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "case à cocher de paramètre",
        fonctions = {}, dispatchers = {},
        evenements_lies = { "CheckBox → OnCheckBoxComponentStateChanged" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_float = {
        cle = "Float_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/Float_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "curseur flottant",
        fonctions = { "OnInit" }, dispatchers = {},
        evenements_lies = { "Slider → OnFloatValueChangedEvent" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_int = {
        cle = "Int_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/Int_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "liste déroulante d'entiers",
        fonctions = { "AddOption", "FillOptionsInfoContainers" }, dispatchers = {},
        evenements_lies = { "ComboBox → OnSelectionChangedEvent" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_color = {
        cle = "Color_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/Color_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "sélecteur de couleur HSV",
        fonctions = { "GetColor", "GetHue", "GetSaturation", "HSVToRGB" }, dispatchers = {},
        evenements_lies = { "Hue_Slider / Saturation_Slider / Value_Slider" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_colorbar = {
        cle = "ColorBar_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/ColorBar_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "barre de couleur",
        fonctions = {}, dispatchers = {},
        evenements_lies = { "Slider → OnFloatValueChangedEvent" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_list = {
        cle = "List_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/List_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "liste à options précédent/suivant",
        fonctions = { "DisplayListOptions", "FillListOptionsArray" }, dispatchers = {},
        variables = { "CurrentOption", "CurrentOptionIndex", "NumOptions" },
        evenements_lies = { "NextOptionButton / PrevOptionButton → OnButtonClickedEvent" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_label = {
        cle = "Label_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/Label_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "étiquette texte",
        fonctions = { "TextToUpper" }, dispatchers = {},
        variables = { "LabelTextBlock" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_section = {
        cle = "Section_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/Section_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "titre de section",
        fonctions = {}, dispatchers = {},
        variables = { "SectionText", "SectionTitleContainer" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_layers = {
        cle = "Layers_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/Layers_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "gestion des couches Mutable",
        fonctions = { "AddLayer", "RemoveLayer", "GetNumLayers" }, dispatchers = {},
        evenements_lies = { "AddButton / RemoveButton → OnButtonClickedEvent" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_intthumbnail = {
        cle = "IntThumbnail_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/IntThumbnail_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "option entière à vignettes",
        fonctions = { "InitThumbnails" }, dispatchers = {},
        evenements_lies = { "CheckBox → OnCheckBoxComponentStateChanged" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_projector = {
        cle = "Projector_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/Projector_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "projecteur 3D + gizmo",
        fonctions = { "ChangeCam" }, dispatchers = {},
        variables = { "AngleDeg", "DefaultAngle" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_projectorbutton = {
        cle = "ProjectorButton_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/ProjectorButton_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "bouton de mode du projecteur",
        fonctions = { "GetCheckedState" }, dispatchers = {},
        variables = { "Mode" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_state = {
        cle = "State_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/State_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "sélecteur d'état Mutable",
        fonctions = { "UpdateStyle" }, dispatchers = {},
        evenements_lies = { "CheckBox → OnCheckBoxComponentStateChanged" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },
    dggui_instance = {
        cle = "Instance_DGGUI", chemin = "Narvos/UI/DynamicallyGeneratedGUI_DGGUI/Instance_DGGUI",
        etat = "adk_seul", pack = "DGGUI", role = "sélecteur d'instance",
        fonctions = {}, dispatchers = {},
        variables = { "InstanceNameText", "NextInstanceButton", "PreviusInstanceButton" },
        dependances = { "CustomizableObjectInstance (Mutable)" },
    },

    -- ── Démos Mutable : Infinite, Lobby, Showcase ────────────────────────────
    -- Cuites, non déclarées. Couplées à leurs scènes de démonstration :
    -- aucune n'est un composant générique réutilisable tel quel.

    infinite_hud = {
        cle = "Infinite_HUD", chemin = "Narvos/Infinite/Infinite_HUD",
        etat = "declare", pack = "Infinite",
        role = "HUD de bench (compteurs d'instances)",
        fonctions = { "ToggleBenchmark", "ToggleWireframe_Keyboard" },
        dispatchers = {},
        variables = { "InstancesGenerated", "InstancesGeneratedText",
                      "InstancesTotal", "InstancesTotalText" },
    },
    infinite_menu = {
        cle = "BasicMenu_Infinite", chemin = "Narvos/Infinite/UIElements/BasicMenu_Infinite",
        etat = "declare", pack = "Infinite",
        role = "menu des paramètres de la démo Infinite",
        fonctions = { "ShowMenu", "HideMenu" },
        dispatchers = {},
        variables = { "SB_InstancesNum", "SB_MaxRegionPerTick", "SB_OccludersNum",
                      "SB_RegionWidthInstances", "SB_RegionWidthScenery", "OptionsIsOpen" },
    },
    lobby_hud = {
        cle = "HUD", chemin = "Narvos/Lobby/HUD",
        etat = "declare", pack = "Lobby",
        role = "HUD du lobby Mutable (projection de vignette)",
        fonctions = { "ApplyProjectionImage", "HideText", "UpdateControlsText" },
        dispatchers = {},
        variables = { "IsWeapon", "IsProjecting", "isMobile", "IsController" },
        -- ⚠ `cle = "HUD"` est d'une genericité dangereuse : à renommer à la
        -- déclaration (ex. Lobby_HUD) pour ne pas masquer un futur HUD à nous.
    },
    lobby_menu = {
        cle = "BasicMenu", chemin = "Narvos/Lobby/UIElements/BasicMenu",
        etat = "declare", pack = "Lobby",
        role = "menu de navigation entre les démos (Infinite/Showcase)",
        fonctions = { "ShowMenu", "HideMenu" },
        dispatchers = {},
        variables = { "EditCharacterButton", "LoadInfiniteButton", "LoadShowcaseButton",
                      "ToggleWireframeCheckBox", "OptionsIsOpen" },
    },
    showcase_hud = {
        cle = "Showcase_HUD", chemin = "Narvos/Showcase/UIElements/Showcase_HUD",
        etat = "declare", pack = "Showcase",
        role = "HUD d'édition d'instance Mutable",
        fonctions = { "ShowInstanceEditUI", "HideInstanceEditUI", "ShowInstanceCloseEditUI",
                      "HideInstanceCloseEditUI", "ShowToggleWireframeUI", "HideToggleWireframeUI",
                      "EditInstance_Keyboard", "EditInstance_Gamepad", "CloseEditInstance_Keyboard",
                      "CloseEditInstance_Gamepad", "ToggleWireframe_Keyboard", "ToggleWireframe_Gamepad",
                      "ApplyProjectionImage", "UpdateControlsText" },
        dispatchers = {},
        variables = { "UINavigation" },
    },
    showcase_menu = {
        cle = "BasicMenu_Showcase", chemin = "Narvos/Showcase/UIElements/BasicMenu_Showcase",
        etat = "declare", pack = "Showcase",
        role = "menu de la démo Showcase",
        fonctions = { "ToggleMenu", "ShowMenu", "HideMenu", "ExitGame", "GoBackToLobby", "Continue" },
        dispatchers = { "OnEditStarted", "OnEditFinished" }, -- probables (liaisons _Event mesurées)
        variables = { "bIsMenuOpen", "ContinueButton", "LoadLobbyButton", "ExitButton" },
    },
    showcase_hud_acteur = {
        cle = "BC_MutableShowcaseHud", chemin = "Narvos/Showcase/ExampleContent/BC_MutableShowcaseHud",
        etat = "declare",
        pack = "Showcase",
        role = "⚠ ACTEUR Blueprint (pas un UserWidget) : se spawne par la classe Blueprint, pas Widget()",
        fonctions = {},
        dispatchers = {},
        variables = { "ShouldDrawCrosshair", "DynUI", "SizeX", "SizeY" },
    },

    -- ── Widgets divers (cuits, déclarés le 2026-09-13) ───────────────────────

    widgets_bouton = {
        cle = "EUW_InteractableButton", chemin = "Narvos/Widgets/WidgetData/EUW_InteractableButton",
        etat = "declare", pack = "Widgets",
        role = "bouton-texte minimal (un TextBlock racine, rien d'autre de mesuré)",
        fonctions = {}, dispatchers = {},
    },
    widgets_manette = {
        cle = "WB_SimpleController", chemin = "Narvos/Widgets/WidgetData/WB_SimpleController",
        etat = "declare", pack = "Widgets",
        role = "overlay d'AFFICHAGE des touches manette/clavier (pas un éditeur de bindings)",
        fonctions = { "SetWSADValues", "SetMouseValues", "GetKeysTotalAnalogState" },
        dispatchers = {},
        variables = { "A_On", "B_On", "X_On", "Y_On", "LB_On", "RB_On", "LT_On", "RT_On",
                      "LS_Position", "RS_Position", "WSAD", "MOUSE" },
    },
    widgets_texte = {
        cle = "WB_SimpleTextBlock", chemin = "Narvos/Widgets/WidgetData/WB_SimpleTextBlock",
        etat = "declare", pack = "Widgets",
        role = "bloc de texte encadré stylé — la brique la plus réutilisable du lot",
        fonctions = { "SetUpBox", "UpdateText" },
        dispatchers = {},
        variables = { "BoxColor", "BoxSize", "IsBold", "TextAlignment", "TextPadding",
                      "TextColor", "ShadowOffset" },
    },
    smartloco_curseur = {
        cle = "Widget_Cursor", chemin = "Narvos/SmartLocomotion/Blueprints/Widget_Cursor",
        etat = "declare", pack = "SmartLocomotion",
        role = "curseur personnalisé (une image, Image_Cursor)",
        fonctions = {}, dispatchers = {},
    },

    -- ── FluidFlux (ADK seul) ─────────────────────────────────────────────────

    fluidflux_hud = {
        cle = "BP_Hud", chemin = "Narvos/FluidFlux/Demo/Blueprints/BP_Hud",
        etat = "adk_seul", pack = "FluidFlux",
        role = "HUD de la démo eau (FPS, changement de map Flux*, presets couleur) — sans usage NARVOS",
        fonctions = { "ToggleVisible" },
        dispatchers = {},
        variables = { "TextFPS", "DeltaMs", "LevelName" },
        dependances = { "maps de démo FluidFlux (FluxOceanMap, FluxBeachMap…)" },
    },
}

return Widgets
