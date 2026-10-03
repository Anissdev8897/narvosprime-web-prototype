-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/VignettesObjets.lua — le RENDU 3D des objets (armes, consommables…), pour
-- leurs vignettes d'inventaire.
--
-- Câblage : `Package.Require("Client/VignettesObjets.lua")` depuis Client/Index.lua,
-- qui relaie la demande de la page (`NarvosVignettes:Demander`) et confie l'envoi
-- (`Configurer`). Tout se passe CÔTÉ CLIENT : aucun aller-retour serveur.
--
-- ── POURQUOI (2026-09-15) ─────────────────────────────────────────────────────
-- Demande de Hanibes : « faites une impression 3D en 2D pour chaque arme ou
-- consommable dans l'inventaire », au lieu d'icônes qui ne ressemblent à rien.
-- Premier essai : les rendus livrés par nanos (Thumbnails/*.jpg) — vus en jeu, ce
-- sont des PHOTOS d'objet posé sur une route, l'arme y occupe un quart de l'image :
-- dans une vignette de 58 px, on voit du bitume. On photographie donc NOUS-MÊMES
-- chaque objet, en studio :
--   1. le mesh est posé loin au-dessus du joueur, chez lui seul : `StaticMesh`
--      (autorité both) pour un mesh statique, `CharacterSimple` (autorité both,
--      accepte un SkeletalMesh) pour une arme à feu — `Weapon` est serveur ;
--   2. trois lampes locales l'éclairent : la photo ne dépend ni de l'heure ni de
--      la météo du monde ;
--   3. un `SceneCapture` ne rend QUE lui (`AddRenderActor`) : fond TRANSPARENT
--      (blog nanos 2022-09, « Render Only ») — d'où le PNG, le JPEG jette l'alpha ;
--   4. vue de profil légèrement plongeante, cadrée LARGE sur les bornes : la page
--      (inventaire.js, InvDetourer) recadre au pixel près sur l'objet.
-- Aucune image n'est gardée ici : la page les garde. Seuls les ÉCHECS sont notés,
-- pour ne pas re-photographier un mesh introuvable à chaque ouverture.
-- ═══════════════════════════════════════════════════════════════════════════════

local VignettesObjets = {}

--- Côté de la photo, en pixels. Large : la page recadre sur l'objet puis réduit,
--- un objet qui n'occupe qu'une partie du cadre reste net.
VignettesObjets.TAILLE = 512
--- Champ horizontal de la caméra (degrés).
VignettesObjets.FOV = 30
--- Hauteur du « studio » au-dessus du joueur, en cm : hors de vue, en plein ciel.
VignettesObjets.ALTITUDE_CM = 20000
--- Temps laissé au moteur pour charger le mesh et ses textures avant la photo.
VignettesObjets.ATTENTE_CHARGEMENT_MS = 450
--- Délai entre la pose des lampes et la photo (une à deux images rendues).
VignettesObjets.ATTENTE_ECLAIRAGE_MS = 80
--- Élévation de la caméra au-dessus de l'horizon de l'objet (degrés).
VignettesObjets.ELEVATION_DEG = 16
--- Lacet de l'objet : trois quarts, la pointe (+X) vient un peu vers la caméra.
--- La caméra est du côté +Y et regarde vers -Y : l'axe +X (canon, lame) part vers
--- la DROITE de l'image, comme sur les planches d'armes.
VignettesObjets.LACET_OBJET_DEG = 18
--- Marge autour de la sphère englobante (1 = elle touche le bord).
VignettesObjets.MARGE = 0.95
--- Recul minimal de la caméra, en cm. Le plan de coupe proche d'Unreal (~10 cm)
--- trancherait une pomme cadrée à 11 cm : sous ce recul, on resserre le champ.
VignettesObjets.RECUL_MIN_CM = 80
--- Rayon d'objet (cm) pour lequel les intensités ci-dessous sont réglées. Les
--- lampes sont en carré inverse : elles sont posées à des multiples du rayon, leur
--- intensité suit donc le rayon au CARRÉ — sinon une pomme serait brûlée et un
--- fusil dans le noir.
VignettesObjets.RAYON_REFERENCE_CM = 40
--- Lampes du studio, en multiples du rayon de l'objet : x (long de l'objet),
--- y (vers la caméra), z (hauteur). Intensités de lampes ordinaires (le package
--- officiel pose 100 pour une lampe de pièce).
--- ⚠ Divisées par ~2,5 et sources resserrées le 2026-09-15 : le Lewis Gun (métal
--- argenté, bois orange) sortait BLANC — reflets de lampes larges sur le métal.
VignettesObjets.LUMIERES = {
    { x = -1.8, y = 2.6, z = 2.4, intensite = 45, couleur = Color(1.00, 0.97, 0.92) }, -- clé
    { x = 2.4, y = 1.8, z = 0.3, intensite = 18, couleur = Color(0.80, 0.90, 1.00) },  -- débouché
    { x = 0.5, y = -2.4, z = 1.9, intensite = 28, couleur = Color(0.70, 0.90, 1.00) }, -- contre-jour
}
--- Rayon de la source lumineuse, en fraction du rayon de l'objet : petit = reflets nets.
VignettesObjets.SOURCE_LUMIERE = 0.12

-- ── État (déclaré en tête : les minuteries plus bas le lisent) ─────────────────
local echecs = {}       -- mesh -> true : photo impossible, ne pas réessayer
local file = {}         -- meshes à photographier, dans l'ordre des demandes
local en_file = {}      -- mesh -> true tant qu'il attend
local en_cours = false
local capture = nil
local lumieres = {}
local envoyer = nil

--- Confie la fonction qui porte (mesh, image base64 PNG ou "") à la page.
---@param fn function
function VignettesObjets.Configurer(fn)
    if (type(fn) == "function") then envoyer = fn end
end

local function Envoyer(mesh, image)
    if (envoyer) then pcall(envoyer, mesh, image or "") end
end

local function Preparer()
    if (capture and capture:IsValid()) then return true end
    local t = VignettesObjets.TAILLE
    -- render_rate -1 : aucune capture automatique, on déclenche à la demande.
    local ok, sc = pcall(SceneCapture, Vector(0, 0, 0), Rotator(), t, t, -1, 20000, VignettesObjets.FOV, false)
    if (not ok or not sc) then
        Console.Warn("[VIGNETTES] SceneCapture refuse : " .. tostring(sc))
        return false
    end
    capture = sc
    -- EyeAdaptation : le fond est vide, l'exposition automatique brûlerait l'objet.
    for _, drapeau in ipairs({ "Atmosphere", "Fog", "VolumetricFog", "Cloud", "EyeAdaptation", "Bloom", "LensFlares" }) do
        pcall(function() capture:SetShowFlag(drapeau, false) end)
    end
    return true
end

--- Rotator qui regarde de `depuis` vers `vers` (degrés).
local function Viser(depuis, vers)
    local dx, dy, dz = vers.X - depuis.X, vers.Y - depuis.Y, vers.Z - depuis.Z
    local plat = math.sqrt(dx * dx + dy * dy)
    return Rotator(math.deg(math.atan(dz, plat)), math.deg(math.atan(dy, dx)), 0)
end

--- Un mesh squelettique se reconnaît à son nom (`SK_`, `SKM_`) ; un nom trompeur
--- est rattrapé par les bornes nulles du StaticMesh (voir Photographier).
local function NomSquelettique(mesh)
    local nom = mesh:match("::(.+)$") or mesh
    return nom:match("^SKM?_") ~= nil
end

--- Pose l'objet au studio. Rend l'acteur, ou nil si le moteur le refuse.
local function Poser(mesh, centre, squelettique)
    local rotation = Rotator(0, VignettesObjets.LACET_OBJET_DEG, 0)
    local ok, objet
    if (squelettique) then
        -- ⚠ ±90° (vu en jeu le 2026-09-15) : un CharacterSimple tourne son mesh d'un
        -- quart de tour (convention des personnages Unreal). Sans compensation, le
        -- canon d'une arme pointait VERS la caméra : cinq armes photographiées en
        -- diagonale, méconnaissables. +90° les a mises de profil mais canon à
        -- GAUCHE ; -90° les pose canon à droite, comme les planches d'armes.
        rotation = Rotator(0, VignettesObjets.LACET_OBJET_DEG - 90, 0)
        ok, objet = pcall(CharacterSimple, centre, rotation, mesh, "", CollisionType.NoCollision, false)
    else
        ok, objet = pcall(StaticMesh, centre, rotation, mesh, CollisionType.NoCollision)
    end
    if (ok and objet and objet:IsValid()) then return objet end
    return nil
end

local function EteindreLumieres()
    for _, l in ipairs(lumieres) do
        if (l:IsValid()) then l:Destroy() end
    end
    lumieres = {}
end

--- Allume les lampes autour de l'objet (origine, rayon en cm).
local function Eclairer(origine, rayon)
    EteindreLumieres()
    local portee = rayon * 8 + 400
    local echelle = (rayon / VignettesObjets.RAYON_REFERENCE_CM) ^ 2
    for _, def in ipairs(VignettesObjets.LUMIERES) do
        local position = Vector(origine.X + def.x * rayon, origine.Y + def.y * rayon, origine.Z + def.z * rayon)
        local ok, l = pcall(Light, position, Rotator(), def.couleur, LightType.Point,
            def.intensite * echelle, portee, 44, 0, portee * 2, true, false, true, rayon * VignettesObjets.SOURCE_LUMIERE)
        if (ok and l) then lumieres[#lumieres + 1] = l end
    end
end

local Suivant

--- Fin d'une photo (réussie ou non) : range le studio et passe à la suivante.
local function Terminer(mesh, objet, image)
    if (image and image ~= "") then
        Envoyer(mesh, image)
    else
        echecs[mesh] = true
        Envoyer(mesh, "")
    end
    if (objet and objet:IsValid()) then objet:Destroy() end
    EteindreLumieres()
    en_cours = false
    Suivant()
end

--- Photographie un mesh. `essai_squelettique` force CharacterSimple (second essai
--- d'un mesh qu'un StaticMesh n'a pas su afficher).
local function Photographier(mesh, essai_squelettique)
    local joueur = Client.GetLocalPlayer()
    local perso = joueur and joueur:GetControlledCharacter()
    local base = (perso and perso:IsValid()) and perso:GetLocation() or Vector(0, 0, 0)
    local centre = Vector(base.X, base.Y, base.Z + VignettesObjets.ALTITUDE_CM)
    local squelettique = essai_squelettique or NomSquelettique(mesh)

    local objet = Poser(mesh, centre, squelettique)
    if (not objet) then
        if (not squelettique) then return Photographier(mesh, true) end
        return Terminer(mesh, nil, "")
    end

    Timer.SetTimeout(function()
        if (not objet:IsValid() or not capture or not capture:IsValid()) then
            return Terminer(mesh, objet, "")
        end
        local ok_b, bornes = pcall(function() return objet:GetBounds() end)
        local rayon = (ok_b and type(bornes) == "table" and tonumber(bornes.SphereRadius)) or 0
        -- Bornes nulles : le StaticMesh n'a rien affiché (mesh squelettique mal nommé).
        if (rayon < 1) then
            if (not squelettique) then
                objet:Destroy()
                return Photographier(mesh, true)
            end
            return Terminer(mesh, objet, "")
        end
        local origine = bornes.Origin or centre
        local distance = rayon * VignettesObjets.MARGE / math.sin(math.rad(VignettesObjets.FOV / 2))
        local champ = VignettesObjets.FOV
        if (distance < VignettesObjets.RECUL_MIN_CM) then
            distance = VignettesObjets.RECUL_MIN_CM
            champ = 2 * math.deg(math.asin(math.min(1, rayon * VignettesObjets.MARGE / distance)))
        end
        local elev = math.rad(VignettesObjets.ELEVATION_DEG)
        local camera = Vector(origine.X, origine.Y + math.cos(elev) * distance, origine.Z + math.sin(elev) * distance)
        Eclairer(origine, rayon)
        local pose = pcall(function()
            capture:ClearRenderActors()
            capture:AddRenderActor(objet)
            capture:SetFOVAngle(champ)
            capture:SetLocation(camera)
            capture:SetRotation(Viser(camera, origine))
        end)
        if (not pose) then return Terminer(mesh, objet, "") end
        -- Une image plus tard : les lampes tout juste créées sont dans la scène rendue.
        Timer.SetTimeout(function()
            if (not objet:IsValid() or not capture:IsValid()) then return Terminer(mesh, objet, "") end
            local lance = pcall(function()
                capture:CaptureScene(false)
                capture:EncodeToBase64Async(ImageFormat.PNG, function(image)
                    Terminer(mesh, objet, type(image) == "string" and image or "")
                end)
            end)
            if (not lance) then Terminer(mesh, objet, "") end
        end, VignettesObjets.ATTENTE_ECLAIRAGE_MS)
    end, VignettesObjets.ATTENTE_CHARGEMENT_MS)
end

Suivant = function()
    if (en_cours or #file == 0) then return end
    if (not Preparer()) then
        -- Pas de SceneCapture : toutes les demandes gardent leur repli.
        for _, mesh in ipairs(file) do echecs[mesh] = true; Envoyer(mesh, "") end
        file, en_file = {}, {}
        return
    end
    local mesh = table.remove(file, 1)
    en_file[mesh] = nil
    en_cours = true
    Photographier(mesh, false)
end

--- Demande les vignettes d'une liste de meshes. Un échec connu répond tout de
--- suite ; les autres sont photographiés un à un (la page garde les images).
---@param liste table  clés « pack::Mesh »
function VignettesObjets.Demander(liste)
    if (type(liste) ~= "table") then return end
    for _, mesh in ipairs(liste) do
        if (type(mesh) == "string" and mesh:match("^[%w%-]+::[%w_]+$")) then
            if (echecs[mesh]) then
                Envoyer(mesh, "")
            elseif (not en_file[mesh]) then
                en_file[mesh] = true
                file[#file + 1] = mesh
            end
        end
    end
    Suivant()
end

--- Nombre d'échecs connus et de photos en attente (diagnostic).
function VignettesObjets.Etat()
    local n = 0
    for _ in pairs(echecs) do n = n + 1 end
    return n, #file
end

return VignettesObjets
