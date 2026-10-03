-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/ApercuInventaire.lua — le personnage VIVANT dans le cadre de l'inventaire.
--
-- Câblage : `Package.Require("Client/ApercuInventaire.lua")` depuis Client/Index.lua,
-- qui lui confie l'envoi au HUD (`Configurer`). Le module écoute
-- `Narvos:PanneauHud` (émis par `Basculer` à chaque ouverture/fermeture) : il ne
-- filme QUE pendant que l'inventaire est ouvert.
--
-- ── POURQUOI (2026-09-15) ─────────────────────────────────────────────────────
-- Demande de Hanibes, capture d'écran à l'appui : « affichez notre personnage dans
-- le cadre », au lieu du losange posé dans la silhouette vide. Le personnage réel
-- (MetaHuman, tenue, arme tenue) est filmé par un `SceneCapture` — classe
-- d'autorité CLIENT (Classes/SceneCapture.json) — placé DEVANT lui, qui ne rend
-- que ses acteurs (`AddRenderActor` : porteur, Blueprint attaché, arme). Chaque
-- image part au WebUI en PNG base64 (`EncodeToBase64Async`) : une page ne reçoit
-- ni texture ni matériau, seulement des chaînes.
--
-- ⚠ PNG et non JPEG (vu en jeu le 2026-09-15) : le rendu « acteurs seuls » a un fond
-- TRANSPARENT, que le JPEG remplit de noir. Affiché en `mix-blend-mode: screen`
-- pour effacer ce noir, le personnage devenait un fantôme pâle, le cadre au travers.
-- ⚠ Une lampe locale éclaire le personnage de face tant que l'inventaire est
-- ouvert : de nuit, le cadre ne montrait qu'une silhouette sombre. Elle n'existe
-- que chez ce client et disparaît à la fermeture.
--
-- ⚠ `enable_distance_optimization = false` : l'optimisation baisse la cadence quand
-- aucun matériau du monde n'affiche la texture — c'est exactement notre cas.
-- ⚠ Un seul encodage à la fois (`en_cours`) : empiler des encodages asynchrones sur
-- une machine chargée noierait le WebUI d'images périmées.
-- ═══════════════════════════════════════════════════════════════════════════════

local ApercuInventaire = {}

--- Taille de l'image, en pixels. Portrait 1:2,5 : la colonne « silhouette » du
--- cadre est haute et étroite (maquette Inventaire NARVOS).
ApercuInventaire.LARGEUR = 256
ApercuInventaire.HAUTEUR = 640

--- Champ HORIZONTAL (degrés). Étroit : l'image est en portrait, un champ large
--- tordrait le corps aux extrémités.
ApercuInventaire.FOV = 24

--- Recul de la caméra devant le personnage, en cm, et hauteur de visée par
--- rapport à `GetLocation` (le centre de la capsule, au bassin).
ApercuInventaire.DISTANCE_CM = 250
ApercuInventaire.HAUTEUR_VISEE_CM = 5

--- Période d'envoi d'une image au HUD, en millisecondes.
ApercuInventaire.PERIODE_MS = 150

--- Cadence de rendu du SceneCapture (secondes entre deux rendus).
ApercuInventaire.CADENCE_RENDU_S = 0.1

--- Lampe de face : intensité (lampe de pièce du package officiel : 100), recul
--- devant le personnage et hauteur au-dessus du bassin, en cm.
ApercuInventaire.LAMPE_INTENSITE = 20
ApercuInventaire.LAMPE_RECUL_CM = 170
ApercuInventaire.LAMPE_HAUTEUR_CM = 90

-- ── État (déclaré en tête : le gestionnaire d'événement plus bas le lit) ────────
local capture = nil
local lampe = nil
local minuteur = nil
local envoyer = nil
local en_cours = false
local premiere_image_dite = false

--- Confie la fonction qui porte une image (base64) au HUD.
---@param fn function
function ApercuInventaire.Configurer(fn)
    if (type(fn) == "function") then envoyer = fn end
end

local function Personnage()
    local joueur = Client.GetLocalPlayer()
    local c = joueur and joueur:GetControlledCharacter()
    if (c and c:IsValid()) then return c end
    return nil
end

--- Ne rendre que le personnage : son mesh (porteur), ce qui lui est attaché
--- (MetaHuman, accessoires) et l'arme tenue. Refait à chaque image : l'arme peut
--- changer pendant que l'inventaire est ouvert (bouton ÉQUIPER).
local function PoserActeurs(c)
    pcall(function() capture:ClearRenderActors() end)
    pcall(function() capture:AddRenderActor(c) end)
    local ok, attaches = pcall(function() return c:GetAttachedEntities(true) end)
    if (ok and type(attaches) == "table") then
        for _, e in ipairs(attaches) do
            pcall(function() capture:AddRenderActor(e) end)
        end
    end
    local ok_tenu, tenu = pcall(function() return c:GetPicked() end)
    if (ok_tenu and tenu) then pcall(function() capture:AddRenderActor(tenu) end) end
end

--- La caméra (et la lampe) devant le personnage, tournées vers lui.
local function Cadrer(c)
    local position = c:GetLocation()
    local rotation = c:GetRotation()
    local avant = rotation:GetForwardVector()
    local d = ApercuInventaire.DISTANCE_CM
    capture:SetLocation(Vector(position.X + avant.X * d, position.Y + avant.Y * d,
        position.Z + ApercuInventaire.HAUTEUR_VISEE_CM))
    capture:SetRotation(Rotator(0, rotation.Yaw + 180, 0))
    if (lampe and lampe:IsValid()) then
        local r = ApercuInventaire.LAMPE_RECUL_CM
        lampe:SetLocation(Vector(position.X + avant.X * r, position.Y + avant.Y * r,
            position.Z + ApercuInventaire.LAMPE_HAUTEUR_CM))
    end
end

local function Allumer(c)
    if (lampe and lampe:IsValid()) then return end
    local ok, l = pcall(Light, c:GetLocation(), Rotator(), Color(1, 0.97, 0.93), LightType.Point,
        ApercuInventaire.LAMPE_INTENSITE, 600, 44, 0, 2000, true, false, true, 25)
    if (ok and l) then lampe = l end
end

local function Eteindre()
    if (lampe and lampe:IsValid()) then lampe:Destroy() end
    lampe = nil
end

--- Crée le SceneCapture à la première ouverture. Rend false s'il est refusé.
local function Preparer(c)
    if (capture and capture:IsValid()) then return true end
    local ok, sc = pcall(SceneCapture, c:GetLocation(), Rotator(),
        ApercuInventaire.LARGEUR, ApercuInventaire.HAUTEUR,
        ApercuInventaire.CADENCE_RENDU_S, 5000, ApercuInventaire.FOV, false)
    if (not ok or not sc) then
        Console.Warn("[APERCU] SceneCapture refuse : " .. tostring(sc))
        return false
    end
    capture = sc
    -- Le brouillard et l'atmosphère voileraient un personnage filmé à 2,5 m.
    -- ⚠ EyeAdaptation (vu en jeu le 2026-09-15) : autour du personnage, la capture
    -- ne voit que du vide noir ; l'exposition automatique s'y règle et BRÛLE la
    -- peau (blanche dans le cadre, bronzée dans le monde). Bloom : halo sur le noir.
    for _, drapeau in ipairs({ "Atmosphere", "Fog", "VolumetricFog", "Cloud", "EyeAdaptation", "Bloom", "LensFlares" }) do
        pcall(function() capture:SetShowFlag(drapeau, false) end)
    end
    return true
end

--- Commence à filmer (inventaire ouvert).
function ApercuInventaire.Demarrer()
    if (minuteur) then return end
    local c = Personnage()
    if (not c or not Preparer(c)) then return end
    pcall(function() capture:SetFreeze(false) end)
    Allumer(c)
    minuteur = Timer.SetInterval(function()
        local perso = Personnage()
        if (not perso or not capture or not capture:IsValid()) then return end
        PoserActeurs(perso)
        Cadrer(perso)
        if (en_cours or not envoyer) then return end
        en_cours = true
        local ok = pcall(function()
            capture:EncodeToBase64Async(ImageFormat.PNG, function(image)
                en_cours = false
                -- Témoin unique : la forme de ce que rend le moteur (préfixe, taille).
                if (not premiere_image_dite) then
                    premiere_image_dite = true
                    Console.Log("[APERCU] premiere image : type=" .. type(image) .. " taille="
                        .. tostring(type(image) == "string" and #image or 0) .. " debut="
                        .. (type(image) == "string" and image:sub(1, 32) or "?"))
                end
                if (minuteur and type(image) == "string" and image ~= "") then envoyer(image) end
            end)
        end)
        if (not ok) then en_cours = false end
    end, ApercuInventaire.PERIODE_MS)
end

--- Arrête de filmer (inventaire fermé) : le SceneCapture gelé ne coûte plus rien.
function ApercuInventaire.Arreter()
    if (minuteur) then
        Timer.ClearInterval(minuteur)
        minuteur = nil
    end
    en_cours = false
    Eteindre()
    if (capture and capture:IsValid()) then pcall(function() capture:SetFreeze(true) end) end
end

--- Filme-t-on en ce moment ? (diagnostic)
function ApercuInventaire.Actif()
    return minuteur ~= nil
end

Events.Subscribe("Narvos:PanneauHud", function(nom)
    if (nom == "inventaire") then
        ApercuInventaire.Demarrer()
    else
        ApercuInventaire.Arreter()
    end
end)

return ApercuInventaire
