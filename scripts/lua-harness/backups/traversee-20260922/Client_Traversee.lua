-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/Traversee.lua — détection d'obstacle pour l'escalade.
--
-- Câblage : Narvos.TraverseeClient = Package.Require("Client/Traversee.lua")
-- depuis Client/Index.lua.
--
-- ── POURQUOI ICI, ET PAS SUR LE SERVEUR ───────────────────────────────────────
-- `Trace` est une API CLIENT de nanos (l'exemple officiel est Client/Index.lua,
-- docs static-classes/trace.mdx). Sur le serveur, `Trace` est nil : la première
-- version l'appelait côté serveur et l'escalade restait muette (log :
-- « attempt to index a nil value (global 'Trace') »). La DÉTECTION vit donc
-- ici ; le SERVEUR reçoit les mesures et décide/exécute (Server/Traversee.lua).
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

--- Trace protégée : renvoie le résultat ou nil.
local function TraceUne(depart, arrivee)
    local ok, resultat = pcall(function()
        return Trace.LineSingle(depart, arrivee, COLLISION, MODE_TRACE)
    end)
    if (ok and resultat and resultat.Success) then return resultat end
    return nil
end

--- Cherche un obstacle franchissable devant le personnage LOCAL.
--- Les mesures brutes sont renvoyées : la classification (vault/mantle/grimper)
--- reste au serveur, qui décide et déplace.
---@return table|nil  { px, py, sommet, profondeur }
function TraverseeClient.Detection()
    local joueur = Client.GetLocalPlayer()
    if (not joueur) then return nil end
    local character = joueur:GetControlledCharacter()
    if (not character) then return nil end

    local position = character:GetLocation()
    local rotation = character:GetRotation()
    local avant = { x = math.cos(math.rad(rotation.Yaw)), y = math.sin(math.rad(rotation.Yaw)) }

    local pieds_z = position.Z - 90  -- le bassin est le centre de la capsule

    -- Trois traces horizontales (genou, hanche, poitrine).
    local point_face
    for _, hauteur_trace in ipairs({ 40, 100, 150 }) do
        local depart = Vector(
            position.X + avant.x * 40,
            position.Y + avant.y * 40,
            pieds_z + hauteur_trace)
        local arrivee = Vector(
            depart.X + avant.x * Traversee.PORTEE,
            depart.Y + avant.y * Traversee.PORTEE,
            depart.Z)
        local trace = TraceUne(depart, arrivee)
        if (trace) then
            point_face = trace.Location
            break
        end
    end
    if (not point_face) then return nil end

    -- Sommet : trace verticale descendante, légèrement au-delà de la face.
    local depart_haut = Vector(
        point_face.X + avant.x * 40,
        point_face.Y + avant.y * 40,
        pieds_z + Traversee.BORNE_CLIMB + 60)
    local bas = Vector(depart_haut.X, depart_haut.Y, pieds_z - 40)
    local verticale = TraceUne(depart_haut, bas)
    -- Si la trace verticale rate (mur trop haut, obstacle trop fin, point de
    -- départ au bord), NE PAS envoyer le Z de la face : le serveur classerait
    -- une hauteur fausse et le personnage partirait dans le vide. On refuse.
    if (not verticale) then
        Console.Log("[TRAVERSEE_CLIENT] sommet introuvable : escalade refusee")
        return nil
    end
    local sommet = verticale.Location.Z

    -- Profondeur : trace horizontale juste sous le sommet (pour le vault).
    local profondeur = 0
    local depart2 = Vector(
        point_face.X + avant.x * 10,
        point_face.Y + avant.y * 10,
        sommet - 10)
    local arrivee2 = Vector(
        depart2.X + avant.x * Traversee.PORTEE,
        depart2.Y + avant.y * Traversee.PORTEE,
        depart2.Z)
    local profonde = TraceUne(depart2, arrivee2)
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
    }
end

return TraverseeClient