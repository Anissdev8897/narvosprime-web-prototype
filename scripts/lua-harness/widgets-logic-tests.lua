-- ══════════════════════════════════════════════════════════════════════════════
-- widgets-logic-tests.lua — assertions sur Shared/Logic/WidgetsLogic.lua.
-- Chargé par widgets-logic.mjs, qui fournit `WidgetsLogic` et `Widgets`.
--
-- LE DÉFAUT VISÉ : un catalogue d'UI construit depuis une liste de SOUHAITS.
-- `SetBlueprintPropertyValue` ne lève pas sur un nom inconnu et nanos ne lève
-- pas sur un asset non déclaré : la seule défense est que le catalogue
-- s'accorde avec lui-même et que ses états soient ceux mesurés sur disque
-- (le disque, lui, est couvert par le contrôle « Widgets » de
-- narvos-verifier-catalogues.mjs).
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(condition, nom)
    if (condition) then reussis = reussis + 1
    else echecs = echecs + 1 print("  ECHEC  " .. nom) end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
    end
end

local function section(nom) print("[" .. nom .. "]") end

local ETATS = { declare = true, cuit_non_declare = true, adk_seul = true }

-- ── Le catalogue s'accorde avec lui-même ──────────────────────────────────────

section("Cohérence du catalogue")

-- Chaque id d'ORDRE existe dans WIDGETS, et réciproquement : une entrée hors
-- ORDRE ne s'affiche nulle part, un id d'ORDRE sans entrée plante l'affichage.
local nb = 0
for id, w in pairs(Widgets.WIDGETS) do
    nb = nb + 1
    ok(type(w.cle) == "string" and w.cle ~= "", id .. " : cle présente")
    ok(type(w.chemin) == "string" and w.chemin:sub(1, 7) == "Narvos/", id .. " : chemin sous Narvos/")
    ok(ETATS[w.etat] == true, id .. " : etat connu (" .. tostring(w.etat) .. ")")
end
local nb_ordre = 0
for _, id in ipairs(Widgets.ORDRE) do
    nb_ordre = nb_ordre + 1
    ok(Widgets.WIDGETS[id] ~= nil, "ORDRE → " .. id .. " existe")
end
egal(nb, nb_ordre, "WIDGETS et ORDRE se couvrent exactement")

-- 45 entrées mesurées le 2026-09-08 (16 MetaCustom + 17 DGGUI + 7 démos
-- Mutable + 3 Widgets + 1 SmartLocomotion + 1 FluidFlux ;
-- cf. docs/UI_UMG_CONTRAT.md §0.1). StillCam est un acteur, pas un widget : il
-- n'y figure pas.
egal(nb, 45, "45 widgets catalogués")

-- ── Les états mesurés, pas souhaités ──────────────────────────────────────────

section("États")

-- ⚠ ICI AUSSI LA DONNEE ETAIT ECRITE EN DUR (« exactement un declare »). Elle
-- est devenue fausse le 2026-09-11 : la correction du builder de pack a declare
-- l'interface WidgetInterface_DGGUI (un Blueprint, pas un WidgetBlueprint). Le
-- test tombait alors que rien n'etait casse. Qui est declare, c'est le
-- verificateur qui le mesure contre Assets.toml ; ici on teste la FONCTION :
-- un declare rend sa reference, une interface declaree n'en rend jamais.
local declares = 0
for id, w in pairs(Widgets.WIDGETS) do
    if (w.etat == "declare") then
        declares = declares + 1
        local ref_d, raison_d = WidgetsLogic.Reference(id)
        if (w.interface) then
            egal(ref_d, nil, id .. " : une interface declaree ne rend pas de reference")
            ok(type(raison_d) == "string", id .. " : et dit pourquoi")
            ok(not WidgetsLogic.Pret(id), id .. " : une interface n'est jamais prete")
        else
            egal(ref_d, Widgets.PACK .. "::" .. w.cle, id .. " : le declare rend sa reference")
            ok(WidgetsLogic.Pret(id), id .. " : le declare est pret")
        end
    end
end
ok(declares >= 1, "au moins un declare (l'acteur du showcase)")

-- ⚠ ICI L'ETAT ETAIT ECRIT EN DUR (« adk_seul »). Il est devenu faux le
-- 2026-09-09 : le cook a emporte les 16 widgets MetaCustom, et
-- `Catalogs/Widgets.lua` les a passes a `cuit_non_declare`. Le test tombait
-- alors que RIEN n'etait casse — c'est la donnee qui avait bouge, legitimement.
--
-- Ce harnais teste la FONCTION, pas la donnee : `Etat` doit relayer le champ du
-- catalogue, quel qu'il soit. La justesse du champ lui-meme est verifiee
-- ailleurs, et contre la seule autorite qui la connaisse — le pack cuit
-- (`narvos-verifier-catalogues.mjs`, controle « Widgets »). Deux questions
-- differentes, deux endroits.
egal(WidgetsLogic.Etat("metacustom_tops"), Widgets.WIDGETS.metacustom_tops.etat,
    "Etat relaie le champ du catalogue")
ok(WidgetsLogic.Etat("metacustom_tops") ~= nil, "et ce champ est renseigne")
egal(WidgetsLogic.Pret("metacustom_tops"), Widgets.WIDGETS.metacustom_tops.etat == "declare",
    "Widget_Tops est pret si et seulement si il est declare")
egal(WidgetsLogic.Etat("dggui_float"), "adk_seul", "Float_DGGUI : non cuit")
-- ⚠ TROISIEME DONNEE EN DUR, TOMBEE LE 2026-09-13 : « coquille DGGUI : cuite, non
-- declaree ». Le constructeur declare desormais les WidgetBlueprint ; la coquille
-- l'est. On teste la FONCTION contre le catalogue, pas la donnee.
egal(WidgetsLogic.Etat("dggui_coquille"), Widgets.WIDGETS.dggui_coquille.etat, "Etat relaie la coquille DGGUI")
egal(WidgetsLogic.Etat("inconnu"), nil, "un id inconnu rend nil, pas une chaîne")

-- Reference : jamais de référence morte construite « au cas où ».
local ref, raison = WidgetsLogic.Reference("showcase_hud_acteur")
egal(ref, "narvos::BC_MutableShowcaseHud", "le déclaré rend sa référence")
-- Un etat NON declare ne rend jamais de reference, quel que soit le widget qui le
-- porte aujourd'hui : on le cherche dans le catalogue au lieu de le supposer.
local non_declare = nil
for id, w in pairs(Widgets.WIDGETS) do
    if (w.etat ~= "declare" and not w.interface) then non_declare = id break end
end
ok(non_declare ~= nil, "au moins un widget non declare existe pour tester le refus")
if (non_declare) then
    local ref2, raison2 = WidgetsLogic.Reference(non_declare)
    ok(ref2 == nil and type(raison2) == "string", non_declare .. " : non declare -> nil + raison, pas une cle morte")
end

-- ── Les écrans ────────────────────────────────────────────────────────────────

section("Écrans")

-- Chaque écran nomme un widget qui EXISTE, ou nil.
for _, nom in ipairs(WidgetsLogic.ORDRE_ECRANS) do
    local e = WidgetsLogic.ECRANS[nom]
    ok(e ~= nil, "ORDRE_ECRANS → " .. nom .. " existe")
    if (e) then
        ok(e.widget_umg == nil or WidgetsLogic.ExisteWidget(e.widget_umg),
           nom .. " : widget_umg dans le catalogue")
        ok(e.strategie == "html" or e.strategie == "umg_differe" or e.strategie == "umg_pret",
           nom .. " : strategie connue")
    end
end

-- Aucun écran ne doit prétendre "umg_pret" tant qu'aucun UserWidget n'est
-- déclaré — ce jour-là, ce test devra être réécrit, en connaissance de cause.
local prets = 0
for _, nom in ipairs(WidgetsLogic.ORDRE_ECRANS) do
    if (WidgetsLogic.ECRANS[nom].strategie == "umg_pret") then prets = prets + 1 end
end
egal(prets, 0, "aucun écran « umg_pret » aujourd'hui")

-- Le seul remplacement sérieux mesuré : garde-robe → MetaCustom.
local g = WidgetsLogic.PourEcran("garde_robe")
egal(g.strategie, "umg_differe", "garde_robe est « umg_differe »")
egal(g.widget_umg, "metacustom_customizer", "garde_robe vise Widget_Customizer")
ok(type(g.prerequis) == "table" and #g.prerequis >= 4, "garde_robe liste ses prérequis (cook, déclaration, reparentage, acteur)")

-- PourEcran ne rend JAMAIS nil : un écran inconnu replie en HTML.
local inconnu = WidgetsLogic.PourEcran("ecran_qui_n_existe_pas")
egal(inconnu.strategie, "html", "écran inconnu → repli html")
ok(inconnu.widget_umg == nil, "écran inconnu → pas de widget")
egal(WidgetsLogic.DonneesPourEcran(nil), nil, "DonneesPourEcran(nil) → nil, pas d'erreur")

-- PourEcran rend une COPIE : écrire dedans ne pollue pas la table interne.
inconnu.strategie = "corrompu"
egal(WidgetsLogic.PourEcran("inventaire").strategie, "html", "la table interne n'a pas bougé")

-- EcransMigrables : aujourd'hui garde_robe seule, avec l'état mesuré du widget.
local migrables = WidgetsLogic.EcransMigrables()
egal(#migrables, 1, "un seul écran migrable aujourd'hui")
egal(migrables[1].ecran, "garde_robe", "c'est garde_robe")
-- Meme correction : on affirme que l'etat RAPPORTE est celui du catalogue pour
-- le widget de cet ecran, pas une chaine recopiee qui vieillit a chaque cook.
egal(migrables[1].etat_widget,
    Widgets.WIDGETS[WidgetsLogic.PourEcran("garde_robe").widget_umg].etat,
    "l'etat rapporte est celui du catalogue")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
print(reussis .. " reussis, " .. echecs .. " echec(s)")
if (echecs > 0) then error("des assertions ont echoue", 0) end