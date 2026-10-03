-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/Traversee.lua — détection d'obstacle pour l'escalade.
--
-- Câblage : Narvos.TraverseeClient = Package.Require("Client/Traversee.lua")
-- depuis Client/Index.lua.
--
-- ── POURQUOI ICI, ET PAS SUR LE SERVEUR ───────────────────────────────────────
-- `Trace` est une API CLIENT de nanos (l'exemple officiel est Client/Index.lua,
-- docs static-classes/trace.mdx). Sur le serveur, `Trace` est nil. La DÉTECTION
-- vit donc ici ; le SERVEUR reçoit les mesures et décide/exécute.
--
-- ── CE QUE LA DÉTECTION MESURE (roadmap franchissement) ──────────────────────
-- 1. FACE + NORMALE : trois traces horizontales (genou/hanche/poitrine) donnent
--    le point d'impact ; deux traces latérales donnent la tangente de la face,
--    d'où la normale (le résultat de hit nanos n'expose pas de normale).
-- 2. SOMMET : trace verticale descendante (Downwards Trace) au-delà de la face ;
--    retry à +5 cm pour les obstacles fins.
-- 3. CLEARANCE : capsule verticale au-dessus du point de pose — s'il y a un
--    obstacle au-dessus du sommet, pas de place pour le personnage, on refuse.
-- 4. PROFONDEUR : trace horizontale juste sous le sommet (pour le vault).
--
-- ── LE pcall AU BON ENDROIT ────────────────────────────────────────────────────
-- `pcall(Trace.LineSingle, ...)` évalue `Trace.LineSingle` AVANT d'entrer dans
-- pcall : si `Trace` est nil, l'erreur part quand même. La forme sûre est
-- `pcall(function() return Trace.LineSingle(...) end)` — l'indexation se fait
-- DANS la fonction protégée. Même piège relevé sur tous les appels moteur.
-- ═══════════════════════════════════════════════════════════════════════════════

local TraverseeClient = {}

local Traversee = Narvos.Traversee

--- Canaux et mode de trace, construits une seule fois.
local COLLISION = CollisionChannel.WorldStatic | CollisionChannel.WorldDynamic
local MODE_TRACE = TraceMode.TraceOnlyVisibility | TraceMode.TraceComplex

-- Capsule du personnage (rayon, demi-hauteur) pour le clearance check.
-- La capsule nanos fait ~180 cm de haut pour un rayon de ~35 cm.
local CAPSULE_RAYON = 35
local CAPSULE_DEMI_HAUTEUR = 90

--- Trace ligne protégée : renvoie le résultat ou nil.
local function TraceLigne(depart, arrivee)
    local ok, resultat = pcall(function()
        return Trace.LineSingle(depart, arrivee, COLLISION, MODE_TRACE)
    end)
    if (ok and resultat and resultat.Success) then return resultat end
    return nil
end

--- Trace capsule protégée : renvoie le résultat ou nil.
local function TraceCapsule(depart, arrivee)
    local ok, resultat = pcall(function()
        return Trace.CapsuleSingle(depart, arrivee, CAPSULE_RAYON,
            CAPSULE_DEMI_HAUTEUR, COLLISION, MODE_TRACE)
    end)
    if (ok and resultat and resultat.Success) then return resultat end
    return nil
end

--- Normale de la face : deux traces latérales donnent la tangente, la normale
--- est la perpendiculaire orientée vers le personnage. Repli : -avant (le cap),
--- quand les traces latérales ratent (obstacle étroit ou cylindre trop courbe).
---@param position Vector
---@param avant table  { x, y }
---@param hauteur_trace number  Z absolu des traces latérales
---@return table  { x, y }  normale normalisée
local function NormaleFace(position, avant, hauteur_trace)
    local droite = { x = avant.y, y = -avant.x }  -- 90° horaire
    local pts = {}
    for _, cote in ipairs({ -1, 1 }) do
        local depart = Vector(
            position.X + avant.x * 40 + droite.x * 40 * cote,
            position.Y + avant.y * 40 + droite.y * 40 * cote,
            hauteur_trace)
        local arrivee = Vector(
            depart.X + avant.x * Traversee.PORTEE,
            depart.Y + avant.y * Traversee.PORTEE,
            depart.Z)
        local trace = TraceLigne(depart, arrivee)
        if (trace) then table.insert(pts, trace.Location) end
    end
    if (#pts < 2) then return { x = -avant.x, y = -avant.y } end

    local tx = pts[2].X - pts[1].X
    local ty = pts[2].Y - pts[1].Y
    local norme = math.sqrt(tx * tx + ty * ty)
    if (norme < 1) then return { x = -avant.x, y = -avant.y } end
    tx, ty = tx / norme, ty / norme

    -- Perpendiculaire de la tangente, orientée vers le personnage (dot avec -avant > 0).
    local nx, ny = -ty, tx
    if ((nx * -avant.x + ny * -avant.y) < 0) then nx, ny = -nx, -ny end
    return { x = nx, y = ny }
end

--- Clearance check : la capsule du personnage a-t-elle la place de se poser
--- sur le sommet ? Capsule verticale du dessus du point de pose vers le sommet.
---@param landing_x number
---@param landing_y number
---@param sommet number
---@return boolean  true = place libre
local function PlaceDisponible(landing_x, landing_y, sommet)
    local dessus = Vector(landing_x, landing_y, sommet + 90 + 50)
    local pose = Vector(landing_x, landing_y, sommet + 90)
    local trace = TraceCapsule(dessus, pose)
    -- Un hit EN DESSOUS du sommet (le sommet lui-même) est normal : la capsule
    -- finit sa course sur la surface. Un hit AU-DESSUS = obstacle, pas de place.
    if (trace and trace.Location.Z > sommet + 5) then return false end
    return true
end

--- Cherche un obstacle franchissable devant le personnage LOCAL.
--- Les mesures brutes sont renvoyées : la classification (vault/mantle/grimper)
--- reste au serveur, qui décide et déplace.
---@return table|nil  { px, py, sommet, profondeur, nx, ny }
function TraverseeClient.Detection()
    local joueur = Client.GetLocalPlayer()
    if (not joueur) then return nil end
    local character = joueur:GetControlledCharacter()
    if (not character) then return nil end

    local position = character:GetLocation()
    local rotation = character:GetRotation()
    local avant = { x = math.cos(math.rad(rotation.Yaw)), y = math.sin(math.rad(rotation.Yaw)) }

    local pieds_z = position.Z - 90  -- le bassin est le centre de la capsule

    -- ── Face : trois traces horizontales (genou, hanche, poitrine) ──────────
    local point_face
    local hauteur_face = 40
    for _, hauteur_trace in ipairs({ 40, 100, 150 }) do
        local depart = Vector(
            position.X + avant.x * 40,
            position.Y + avant.y * 40,
            pieds_z + hauteur_trace)
        local arrivee = Vector(
            depart.X + avant.x * Traversee.PORTEE,
            depart.Y + avant.y * Traversee.PORTEE,
            depart.Z)
        local trace = TraceLigne(depart, arrivee)
        if (trace) then
            point_face = trace.Location
            hauteur_face = pieds_z + hauteur_trace
            break
        end
    end
    if (not point_face) then return nil end

    -- ── Normale de la face ───────────────────────────────────────────────────
    local normale = NormaleFace(position, avant, hauteur_face)

    -- Direction d'ENTRÉE (opposée à la normale) : vers l'atterrissage.
    local entree = { x = -normale.x, y = -normale.y }

    -- ── Sommet : trace verticale descendante (Downwards Trace) ──────────────
    -- Premier essai au-delà de la face (+40), retry à +5 pour les obstacles fins.
    local verticale
    for _, profondeur_sonde in ipairs({ 40, 5 }) do
        local depart_haut = Vector(
            point_face.X + avant.x * profondeur_sonde,
            point_face.Y + avant.y * profondeur_sonde,
            pieds_z + Traversee.BORNE_CLIMB + 60)
        local bas = Vector(depart_haut.X, depart_haut.Y, pieds_z - 40)
        verticale = TraceLigne(depart_haut, bas)
        if (verticale) then break end
    end
    -- Si la trace verticale rate (mur trop haut, obstacle trop fin), NE PAS
    -- envoyer le Z de la face : le serveur classerait une hauteur fausse et
    -- le personnage partirait dans le vide. On refuse proprement.
    if (not verticale) then
        Console.Log("[TRAVERSEE_CLIENT] sommet introuvable : escalade refusee")
        return nil
    end
    local sommet = verticale.Location.Z

    -- ── Clearance : la capsule a-t-elle la place de se poser ? ──────────────
    -- Le serveur pose à sommet+95 (bassin), 40 cm dans l'axe d'entrée au-delà
    -- de la face. On vérifie la même place côté client.
    local landing_x = point_face.X + entree.x * 40
    local landing_y = point_face.Y + entree.y * 40
    if (not PlaceDisponible(landing_x, landing_y, sommet)) then
        Console.Log("[TRAVERSEE_CLIENT] pas de place sur le sommet : escalade refusee")
        return nil
    end

    -- ── Profondeur : trace horizontale juste sous le sommet (pour le vault) ─
    local profondeur = 0
    local depart2 = Vector(
        point_face.X + avant.x * 10,
        point_face.Y + avant.y * 10,
        sommet - 10)
    local arrivee2 = Vector(
        depart2.X + avant.x * Traversee.PORTEE,
        depart2.Y + avant.y * Traversee.PORTEE,
        depart2.Z)
    local profonde = TraceLigne(depart2, arrivee2)
    if (profonde) then
        local dx = profonde.Location.X - point_face.X
        local dy = profonde.Location.Y - point_face.Y
        profondeur = math.abs(dx * avant.x + dy * avant.y)
    end

    return {
        px = point_face.X,
        py = point_face.Y,
        sommet = sommet,
        profondeur = profondeur,
        nx = normale.x,
        ny = normale.y,
    }
end

return TraverseeClient
