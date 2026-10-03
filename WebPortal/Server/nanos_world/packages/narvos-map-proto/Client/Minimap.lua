-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/Minimap.lua — la minimap Ako Minimap System, branchée sur le radar.
--
-- Câblage : `Package.Require("Client/Minimap.lua")` depuis Client/Index.lua.
-- Pièces : `Narvos.Minimap` (catalogue GÉNÉRÉ, clés par chemin, boîte mesurée).
--
-- ── CE QUE LE WIDGET ATTEND, MESURÉ ───────────────────────────────────────────
-- Sonde du 2026-09-13 (scripts/adk-sonder-ako.py, export T3D du DataAsset) :
--   · le widget trouve le joueur par `GetActorOfClass(player ref)` — une classe
--     Blueprint. Le Character nanos est une classe C++ du client, invisible de
--     l'ADK : on attache au personnage local un Actor Blueprint VIDE,
--     BP_NarvosCarteJoueur, vers lequel une ClassRedirect ramène la classe de la
--     démo que le DataAsset cite (DefaultEngine.ini) ;
--   · les pictogrammes suivent `item_setting` : BP_NarvosCarteRepere, un proxy par
--     repère du radar ;
--   · les bornes : UN BP_MAP_Bounds lu à la construction du widget
--     (MAPBouns_type = BASE_ON_BOX_BOUND). Les mondes sont à 20 km les uns des
--     autres : on en pose un par monde, au centre du monde, et le widget est
--     REFAIT à chaque voyage.
--
-- ── LE SERVEUR NE CHANGE PAS ──────────────────────────────────────────────────
-- `Narvos:DemanderRadar` reste la source unique : même filtrage, même portée
-- (`rayon_m`, qui dimensionne aussi la boîte), mêmes repères que le radar WebUI.
--
-- ── L'API, LUE ET NON DEVINÉE ─────────────────────────────────────────────────
-- `Blueprint(location, rotation, path)` [both], `Actor:AttachTo(other, rule,
-- bone)` [authority], `Actor:SetScale(Vector)` [authority], `Widget(path)`
-- [client] + `AddToViewport()` / `SetVisibility(WidgetVisibility)` [client],
-- `Client.GetLocalPlayer()` — `libraries/api-main/api-main`. Une entité spawnée
-- par le client n'existe QUE pour lui : c'est voulu, chaque joueur a sa carte.
--
-- ── ⚠ CE QUI N'EST PAS PROUVÉ ─────────────────────────────────────────────────
--   · que `Widget("narvos::ui_minimap_showup")` résolve (WidgetBlueprint déclaré
--     sous [assets.blueprints] depuis le 2026-09-13 — le constructeur prend un
--     BlueprintPath, indice fort, pas preuve) ;
--   · que `GetActorOfClass` trouve un proxy spawné par nanos, et qu'il suive le
--     personnage une fois attaché ;
--   · la correspondance zoom / taille de boîte : `/minimap <metres>` la règle en jeu.
-- Sans le catalogue prêt, RIEN n'est posé : le radar WebUI (H) reste la carte.
-- ═══════════════════════════════════════════════════════════════════════════════

local MinimapClient = {}

-- ── État — DÉCLARÉ EN TÊTE ────────────────────────────────────────────────────
local etat = {
    personnage = nil,     -- le Character auquel le proxy est attaché
    proxy = nil,          -- BP_NarvosCarteJoueur
    bornes = nil,         -- BP_MAP_Bounds du monde courant
    widget = nil,         -- ui_minimap_showup
    monde = nil,          -- id du monde des bornes
    demi_etendue_cm = nil,
    reperes = {},         -- [cle] = entité BP_NarvosCarteRepere
    masquee = false,
    reglage_m = nil,      -- demi-étendue imposée par /minimap, sinon la portée du radar
}

--- Période de la surveillance : personnage changé, monde changé.
MinimapClient.SURVEILLANCE_MS = 1000
--- Rafraîchissement des repères : les gisements sont fixes, on suit le JOUEUR
--- par le proxy attaché — pas besoin du rythme du panneau Radar (600 ms).
MinimapClient.RADAR_MS = 5000

local function Catalogue()
    return Narvos and Narvos.Minimap or nil
end

--- ⚠ DÉSACTIVÉE LE 2026-09-14, retour de jeu avec capture : dès que le catalogue
--- est devenu PRÊT (pack reconstruit), le widget s'est posé en bas à gauche comme
--- un grand DISQUE GRIS sans aucune carte — « enlève le cercle, il ne sert à rien ».
--- La carte du jeu reste le radar WebUI (en haut à droite, touche H). Le code est
--- gardé : repasser à true le jour où le widget montre une vraie carte du monde.
MinimapClient.ACTIVE = false

local function Pret()
    local c = Catalogue()
    return MinimapClient.ACTIVE and c ~= nil and c.PRETE == true
end

local function Valide(entite)
    return entite ~= nil and entite:IsValid()
end

local function Detruire(entite)
    if (Valide(entite)) then pcall(function() entite:Destroy() end) end
end

local function PersonnageLocal()
    local player = Client.GetLocalPlayer()
    local character = player and player:GetControlledCharacter()
    if (character and character:IsValid()) then return character end
    return nil
end

-- ── Démontage ─────────────────────────────────────────────────────────────────

local function RetirerReperes()
    for cle, entite in pairs(etat.reperes) do
        Detruire(entite)
        etat.reperes[cle] = nil
    end
end

--- Retire le widget, les bornes et les repères. Le proxy reste : il suit le corps.
local function DemonterCarte()
    Detruire(etat.widget)
    Detruire(etat.bornes)
    RetirerReperes()
    etat.widget, etat.bornes, etat.monde, etat.demi_etendue_cm = nil, nil, nil, nil
end

-- ── Montage ───────────────────────────────────────────────────────────────────

--- Le proxy du joueur, attaché au personnage local.
local function AttacherProxy(character)
    Detruire(etat.proxy)
    etat.proxy, etat.personnage = nil, nil
    local ok, proxy = pcall(function()
        return Blueprint(character:GetLocation(), character:GetRotation(), Catalogue().JOUEUR)
    end)
    if (not ok or not Valide(proxy)) then
        Console.Warn("[MINIMAP] proxy joueur refuse : " .. tostring(proxy))
        return
    end
    if (not pcall(function() proxy:AttachTo(character, AttachmentRule.SnapToTarget, "") end)) then
        Console.Warn("[MINIMAP] proxy joueur NON attache — la fleche resterait sur place")
    end
    etat.proxy, etat.personnage = proxy, character
end

--- Les bornes du monde, dimensionnées : demi-étendue voulue / demi-étendue de la
--- boîte à l'échelle 1 (mesurée dans l'ADK).
local function PoserBornes(monde_id, demi_etendue_cm)
    Detruire(etat.bornes)
    etat.bornes = nil
    local centre = Narvos.Mondes.CENTRES[monde_id]
    if (not centre) then return false end
    local boite = Catalogue().BOITE_DEMI_ETENDUE_CM
    local ok, bornes = pcall(function() return Blueprint(centre, Rotator(), Catalogue().BORNES) end)
    if (not ok or not Valide(bornes)) then
        Console.Warn("[MINIMAP] bornes refusees : " .. tostring(bornes))
        return false
    end
    pcall(function()
        bornes:SetScale(Vector(demi_etendue_cm / boite.x, demi_etendue_cm / boite.y, 1.0))
    end)
    etat.bornes, etat.monde, etat.demi_etendue_cm = bornes, monde_id, demi_etendue_cm
    return true
end

--- Le widget, APRÈS le proxy et les bornes : il les cherche à sa construction.
local function CreerWidget()
    Detruire(etat.widget)
    etat.widget = nil
    local ok, widget = pcall(function() return Widget(Catalogue().WIDGET) end)
    if (not ok or not Valide(widget)) then
        Console.Warn("[MINIMAP] widget refuse : " .. tostring(widget))
        return
    end
    pcall(function() widget:AddToViewport() end)
    -- Ne capte pas la souris : le HUD WebUI et le jeu restent cliquables dessous.
    pcall(function()
        widget:SetVisibility(etat.masquee and WidgetVisibility.Hidden or WidgetVisibility.VisibleNotHitTestable)
    end)
    etat.widget = widget
end

--- Les repères : un proxy par point du radar DANS la boîte ; les portails, à des
--- kilomètres, restent au radar WebUI et à la carte du téléphone.
local function SynchroniserReperes(points, centre, demi_etendue_cm, z)
    local voulus = {}
    for _, p in ipairs(points or {}) do
        local x, y = (tonumber(p.x) or 0) * 100.0, (tonumber(p.z) or 0) * 100.0
        if (math.abs(x - centre.X) <= demi_etendue_cm and math.abs(y - centre.Y) <= demi_etendue_cm) then
            voulus[("%.0f:%.0f"):format(x, y)] = Vector(x, y, z)
        end
    end
    for cle, entite in pairs(etat.reperes) do
        if (not voulus[cle] or not Valide(entite)) then
            Detruire(entite)
            etat.reperes[cle] = nil
        end
    end
    for cle, position in pairs(voulus) do
        if (not etat.reperes[cle]) then
            local ok, repere = pcall(function() return Blueprint(position, Rotator(), Catalogue().REPERE) end)
            if (ok and Valide(repere)) then etat.reperes[cle] = repere end
        end
    end
end

-- ── Le radar pilote la carte ──────────────────────────────────────────────────

local function DemanderRadar()
    Events.CallRemote("Narvos:DemanderRadar", Reliability.Reliable)
end

--- Chaque réponse du radar : (re)pose les bornes si le monde ou la taille ont
--- changé, synchronise les repères, crée le widget s'il manque.
function MinimapClient.SurRadar(donnees)
    if (not Pret() or type(donnees) ~= "table") then return end
    local character = PersonnageLocal()
    if (not character or not Valide(etat.proxy)) then return end
    local monde = Narvos.Mondes.ParPosition(character:GetLocation())
    if (not monde or not Narvos.Mondes.CENTRES[monde.id]) then
        -- L'orbite n'a pas de bord : pas de boîte, pas de carte.
        DemonterCarte()
        return
    end
    local metres = etat.reglage_m or tonumber(donnees.rayon_m) or 0
    if (metres <= 0) then return end
    local demi = metres * 100.0
    local refaire = (etat.monde ~= monde.id) or (etat.demi_etendue_cm ~= demi) or not Valide(etat.bornes)
    if (refaire) then
        DemonterCarte()
        if (not PoserBornes(monde.id, demi)) then return end
    end
    SynchroniserReperes(donnees.points, Narvos.Mondes.CENTRES[monde.id], demi, character:GetLocation().Z)
    if (refaire or not Valide(etat.widget)) then CreerWidget() end
end

--- Surveillance : un nouveau corps (respawn, création) reçoit son proxy, et la
--- carte est redemandée.
local function Surveiller()
    if (not Pret()) then return end
    local character = PersonnageLocal()
    if (not character) then return end
    if (etat.personnage ~= character or not Valide(etat.proxy)) then
        AttacherProxy(character)
        DemonterCarte()
        DemanderRadar()
    end
end

--- `/minimap` relayé par le serveur : `metres` (> 0) impose la demi-étendue de la
--- boîte, 0 rend la portée du radar ; `masquer` cache ou montre le widget.
function MinimapClient.Regler(metres, masquer)
    if (type(masquer) == "boolean") then etat.masquee = masquer end
    -- -1 = ne touche pas la taille (on/off) ; 0 = portée du radar ; > 0 = mètres.
    local m = tonumber(metres)
    if (m ~= nil and m >= 0) then etat.reglage_m = (m > 0) and m or nil end
    if (Valide(etat.widget)) then
        pcall(function()
            etat.widget:SetVisibility(etat.masquee and WidgetVisibility.Hidden or WidgetVisibility.VisibleNotHitTestable)
        end)
    end
    etat.monde = nil   -- force la reconstruction à la prochaine réponse du radar
    DemanderRadar()
end

Events.SubscribeRemote("Narvos:Radar", MinimapClient.SurRadar)

-- Le voyage change de monde : la boîte du monde précédent ne vaut plus rien.
Events.SubscribeRemote("Narvos:Voyage", function()
    DemonterCarte()
    DemanderRadar()
end)

Events.SubscribeRemote("Narvos:Minimap:Regler", function(metres, masquer)
    MinimapClient.Regler(metres, masquer)
end)

if (Pret()) then
    Timer.SetInterval(Surveiller, MinimapClient.SURVEILLANCE_MS)
    Timer.SetInterval(function()
        if (Valide(etat.proxy)) then DemanderRadar() end
    end, MinimapClient.RADAR_MS)
else
    Console.Log("[MINIMAP] catalogue non pret (pieces non cuites) — radar WebUI seul")
end

return MinimapClient
