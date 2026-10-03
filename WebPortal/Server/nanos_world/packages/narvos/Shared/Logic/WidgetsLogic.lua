--- ── WidgetsLogic — quel widget UMG pour quel écran, et avec quelles données ──
---
--- Module PUR : aucune dépendance à l'API nanos, donc testable au harnais.
--- ⚠ Il ne spawne RIEN. `Widget(...)` est `[client]` (libraries/api-main/
--- api-main/Classes/Widget.json:4) et l'exécutant client est la part du
--- propriétaire. Ce module répond à deux questions, et seulement à celles-là :
---
---   1. pour l'écran X, garde-t-on le panneau HTML ou vise-t-on un UMG acheté ?
---      (verdicts mesurés dans docs/UI_UMG_CONTRAT.md §7) ;
---   2. quelles données cet écran consomme-t-il, et d'où viennent-elles ?
---
--- ── POURQUOI AUCUN ÉCRAN N'EST « umg » AUJOURD'HUI ──────────────────────────
--- Mesuré le 2026-09-08 : aucun UserWidget n'est déclaré dans
--- `Server/Assets/narvos/Assets.toml`, MetaCustom et FluidFlux ne sont pas
--- cuits, et DGGUI est un générateur d'UI pour objets Mutable — pas un kit de
--- réglages. `Ecrans()` rend donc trois stratégies seulement :
---
---   "html"        le panneau WebUI fait le travail, ne pas y toucher ;
---   "umg_differe" un équivalent UMG existe MAIS est subordonné à des
---                 prérequis mesurés (cook, déclaration, acteur monde) ;
---   "umg_pret"    le widget est déclaré dans Assets.toml — AUCUN à ce jour.
---
--- Le jour où un cook déclare un widget, `narvos-verifier-catalogues.mjs`
--- (contrôle « Widgets ») voit l'état basculer à "declare", et la stratégie
--- de l'écran se réévalue ICI — pas dans un commentaire perdu.

local WidgetsLogic = {}

-- Même motif de capture que Craft/Recolte : lire Narvos.Widgets s'il est déjà
-- posé par Shared/Index.lua, sinon charger le catalogue soi-même. Le repli
-- crée une seconde table si l'ordre de câblage est cassé — d'où la place de
-- `Narvos.Widgets` AVANT `Narvos.WidgetsLogic` dans Index.lua.
local Widgets = (Narvos and Narvos.Widgets) or Package.Require("Catalogs/Widgets.lua")

--- Les écrans du jeu et leur stratégie mesurée.
---   panneau_html  : clé du panneau dans narvos-map-proto/Client/UI/index.js
---   widget_umg    : id dans Widgets.WIDGETS, ou nil si aucun équivalent mesuré
---   prerequis     : ce qui manque avant que « umg_differe » devienne jouable
---   donnees       : d'où viennent les données de l'écran (modules câblés dans
---                   Shared/Index.lua — vérifiés le 2026-09-08)
WidgetsLogic.ECRANS = {
    inventaire = {
        strategie = "html",
        panneau_html = "inventaire",
        widget_umg = nil,
        justification = "aucun UMG d'inventaire cuit ni dans l'ADK nanos ; " ..
                        "Inventory System Pro (81 WBP) n'a jamais quitté public/asset_game",
        donnees = { source = "Narvos.Inventory", detail = "grille persistée, uid par instance" },
    },
    personnage = {
        strategie = "html",
        panneau_html = "personnage",
        widget_umg = nil,
        justification = "pas d'équivalent UMG mesuré pour classes/stats",
        donnees = { source = "Narvos.Classes + Narvos.Stats", detail = "classe, niveau, stats" },
    },
    props = {
        strategie = "html",
        panneau_html = "props",
        widget_umg = nil,
        justification = "Widget_Props MetaCustom est un vestiaire d'accessoires " ..
                        "de personnage couplé à BP_Meta_Styler, pas un panneau de spawn",
        donnees = { source = "Narvos.Props + Narvos.PropsNarvos", detail = "catalogues vérifiés contre Assets.toml" },
    },
    spawn = {
        strategie = "html",
        panneau_html = "spawn",
        widget_umg = nil,
        justification = "aucun équivalent UMG mesuré",
        donnees = { source = "Narvos.Spawnables", detail = "56 références vérifiées" },
    },
    commandes = {
        strategie = "html",
        panneau_html = "commandes",
        widget_umg = "widgets_manette",
        justification = "WB_SimpleController AFFICHE les touches (overlay d'aide), " ..
                        "il n'édite pas les bindings ; Raccourcis.lua + HTML font le travail",
        prerequis = { "déclaration Assets.toml" },
        donnees = { source = "Narvos.Raccourcis", detail = "touches et actions" },
    },
    garde_robe = {
        strategie = "umg_differe",
        panneau_html = "garde-robe",
        widget_umg = "metacustom_customizer",
        justification = "l'équivalent UMG existe (MetaCustom, 16 widgets mesurés) mais " ..
                        "non cuit, non déclaré, couplé à BP_Meta_Styler et à des " ..
                        "vignettes à l'ancien chemin /Game/Metahuman_Customization_System/…",
        prerequis = {
            "cook du pack MetaCustom (526 .uasset dans l'ADK, 0 dans le pack)",
            "déclaration des clés dans Assets.toml [assets.blueprints] — catégorie à confirmer",
            "reparentage des références /Game/Metahuman_Customization_System/… (ou monter ce dossier dans unreal_folders)",
            "spawn côté client de BP_Meta_Styler (les widgets le cherchent par GetAllActorsOfClass)",
            "relevé éditeur des variables exposées : les noms mesurés ne garantissent pas l'exposition",
        },
        donnees = { source = "Narvos.Vestiaire + Narvos.Modular", detail = "identités par famille/genre, pièces par slot" },
    },
    radar = {
        strategie = "html",
        panneau_html = "radar",
        widget_umg = nil,
        justification = "aucun équivalent UMG ; rendu temps réel déjà fait en canvas",
        donnees = { source = "Logic/Radar.lua", detail = "positions à projeter — câblé dans Shared/Index.lua:196 depuis le 2026-09-09 (correction propriétaire)" },
    },
    pause = {
        strategie = "html",
        panneau_html = "pause",
        widget_umg = nil,
        justification = "BasicMenu (Lobby) navigue entre les démos Mutable ; " ..
                        "pas paramétrable depuis Lua sans contrat mesuré",
        donnees = { source = "Narvos.Graphismes", detail = "niveau courant affiché sous « Paramètres »" },
    },
    graphismes = {
        strategie = "html",
        panneau_html = "graphismes",
        widget_umg = "dggui_coquille",
        justification = "DGGUI génère l'UI d'un CustomizableObjectInstance Mutable " ..
                        "(mesuré : /Script/CustomizableObject dans les 17 fichiers) ; " ..
                        "l'utiliser ici suppose de fabriquer un objet Mutable dont les " ..
                        "paramètres seraient nos réglages — un détour, pas un raccourci",
        prerequis = {
            "cook des 14 éléments DGGUI (3 coquilles seulement sont cuites)",
            "un CustomizableObject portant les réglages comme paramètres",
        },
        donnees = { source = "Narvos.Graphismes", detail = "Graphismes.PourInterface(actuel) — liste, libellés, détails dérivés" },
    },
}

--- Ordre d'affichage des écrans (pairs n'a pas d'ordre garanti).
WidgetsLogic.ORDRE_ECRANS = {
    "inventaire", "personnage", "props", "spawn", "commandes",
    "garde_robe", "radar", "pause", "graphismes",
}

--- Vrai si `id` désigne un widget connu du catalogue.
---@param id any
---@return boolean
function WidgetsLogic.ExisteWidget(id)
    return type(id) == "string" and Widgets.WIDGETS[id] ~= nil
end

--- L'état mesuré d'un widget : "declare" | "cuit_non_declare" | "adk_seul" |
--- nil si inconnu. C'est CET état, pas le souhait, qui décide ce qu'un
--- exécutant client peut tenter.
---@param id any
---@return string|nil
function WidgetsLogic.Etat(id)
    if (not WidgetsLogic.ExisteWidget(id)) then return nil end
    return Widgets.WIDGETS[id].etat
end

--- Vrai si le widget est déclaré dans Assets.toml — la SEULE condition sous
--- laquelle un `Widget("narvos::" .. cle)` a une chance de résoudre. Une
--- INTERFACE Blueprint déclarée n'est jamais prête : elle se déclare, elle ne
--- se spawne pas. D'où le passage par Reference, seule à trancher.
---@param id any
---@return boolean
function WidgetsLogic.Pret(id)
    return WidgetsLogic.Reference(id) ~= nil
end

--- La référence Lua complète ("narvos::<cle>") — ou nil avec raison.
--- Rend nil tant que l'état n'est pas "declare" : une référence non déclarée
--- est une référence morte silencieuse, et la construire « au cas où » est
--- exactement le défaut que le vérificateur de catalogues traque.
---@param id any
---@return string|nil, string|nil
function WidgetsLogic.Reference(id)
    if (not WidgetsLogic.ExisteWidget(id)) then
        return nil, "widget inconnu du catalogue"
    end
    local w = Widgets.WIDGETS[id]
    if (w.interface) then
        return nil, "interface Blueprint : déclarée peut-être, jamais spawnée par Widget()"
    end
    if (w.etat == "declare") then
        return Widgets.PACK .. "::" .. w.cle, nil
    end
    if (w.etat == "cuit_non_declare") then
        return nil, "cuit mais non déclaré dans Assets.toml : ajouter la clé « " .. w.cle .. " »"
    end
    return nil, "absent du pack cuit (ADK seulement) : cook requis"
end

--- La fiche d'un écran, normalisée. ⚠ Retourne TOUJOURS une table : un écran
--- inconnu rend la fiche "html" sans widget, jamais nil — même règle que
--- Graphismes.Normaliser, même raison (l'appelant n'a pas à gérer le vide).
---@param ecran any
---@return table
function WidgetsLogic.PourEcran(ecran)
    local e = WidgetsLogic.ECRANS[ecran]
    if (e == nil) then
        return {
            strategie = "html",
            panneau_html = (type(ecran) == "string") and ecran or nil,
            widget_umg = nil,
            justification = "écran inconnu du module — repli HTML",
            donnees = nil,
        }
    end
    -- Copie : l'appelant n'écrit jamais dans la table interne.
    local copie = {}
    for cle, valeur in pairs(e) do copie[cle] = valeur end
    -- La stratégie affichée tient compte de l'état MESURÉ du widget visé :
    -- annoncer "umg_differe" pour un widget redevenu indisponible mentirait.
    if (copie.widget_umg ~= nil and not WidgetsLogic.ExisteWidget(copie.widget_umg)) then
        copie.widget_umg = nil
        copie.strategie = "html"
        copie.justification = (copie.justification or "") ..
                              " — widget visé absent du catalogue, repli HTML"
    end
    return copie
end

--- Ce qu'il faut envoyer à l'écran, décrit — pas construit. La construction
--- appartient aux modules sources (Inventory, Vestiaire, Graphismes…), qui
--- connaissent leur format ; ce module n'en duplique aucun.
---@param ecran any
---@return table|nil  { source = "Narvos.X", detail = "…" }
function WidgetsLogic.DonneesPourEcran(ecran)
    return WidgetsLogic.PourEcran(ecran).donnees
end

--- Liste des écrans prêts à basculer vers UMG dès que leurs prérequis tombent.
--- Aujourd'hui : garde_robe seule (les autres "umg" nommés sont des widgets de
--- complément, pas des remplacements). Mesurée, pas souhaitée : une stratégie
--- "umg_differe" dont le widget est "adk_seul" liste ses prérequis.
---@return table
function WidgetsLogic.EcransMigrables()
    local liste = {}
    for _, nom in ipairs(WidgetsLogic.ORDRE_ECRANS) do
        local e = WidgetsLogic.ECRANS[nom]
        if (e.strategie == "umg_differe" and e.widget_umg ~= nil
            and WidgetsLogic.ExisteWidget(e.widget_umg)) then
            liste[#liste + 1] = {
                ecran = nom,
                widget = e.widget_umg,
                etat_widget = WidgetsLogic.Etat(e.widget_umg),
                prerequis = e.prerequis or {},
            }
        end
    end
    return liste
end

return WidgetsLogic
