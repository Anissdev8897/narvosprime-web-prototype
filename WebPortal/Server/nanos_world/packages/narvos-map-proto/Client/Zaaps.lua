-- ═══════════════════════════════════════════════════════════════════════════════
-- Client/Zaaps.lua — ce que le joueur VOIT d'un Zaap : un socle sombre, un anneau
-- lumineux, un cristal qui flotte au-dessus, une lumière.
--
-- Câblage : `Package.Require("Client/Zaaps.lua")` depuis Client/Index.lua, qui
-- relaie `Narvos:Zaap:Liste` → `Afficher` et `Narvos:Zaap:Actif` → `Activer`.
--
-- ── POURQUOI CÔTÉ CLIENT (2026-09-15, D4) ─────────────────────────────────────
-- · La décoration n'a rien à décider : le serveur tient les déclencheurs et la
--   base (Server/Zaaps.lua), la page ne fait que dessiner.
-- · Chaque joueur voit SON Zaap actif autrement (cyan) que les autres (violet) :
--   une entité serveur montrerait la même couleur à tous.
-- · `GetBounds` est d'autorité CLIENT. Les dimensions de `SM_Crystal_Large_01` ne
--   sont écrites nulle part (relevé binaire du .uexp non concluant) : on les MESURE
--   ici, une fois le mesh chargé, et on met le cristal à la taille voulue au lieu
--   de deviner une échelle.
--
-- Toutes les entités sont SANS COLLISION : un obstacle que seul ce client
-- connaîtrait ferait diverger sa prédiction de mouvement de celle du serveur.
-- ═══════════════════════════════════════════════════════════════════════════════

local ZaapsClient = {}

-- ── Réglages visuels ──────────────────────────────────────────────────────────
ZaapsClient.MATERIAU = "nanos-world::M_Default_Masked_Lit"
ZaapsClient.CYLINDRE = "nanos-world::SM_Cylinder"
ZaapsClient.SOCLE_DIAMETRE_CM = 220
ZaapsClient.SOCLE_HAUTEUR_CM = 14
ZaapsClient.ANNEAU_DIAMETRE_CM = 250
ZaapsClient.ANNEAU_HAUTEUR_CM = 5
ZaapsClient.CRISTAL = "narvos::SM_Crystal_Large_01"
ZaapsClient.CRISTAL_REPLI = "nanos-world::SM_Sphere"
ZaapsClient.CRISTAL_HAUTEUR_CM = 150
ZaapsClient.CRISTAL_LARGEUR_MAX_CM = 110
ZaapsClient.CRISTAL_ENVOL_CM = 40
ZaapsClient.FLOTTEMENT_CM = 8
ZaapsClient.FLOTTEMENT_PERIODE_MS = 3200
ZaapsClient.LUMIERE_HAUTEUR_CM = 130
ZaapsClient.LUMIERE_INTENSITE = 18
ZaapsClient.LUMIERE_PORTEE_CM = 900
ZaapsClient.EMISSION = 6.0
ZaapsClient.COULEUR_ACTIF = Color(0.20, 0.85, 1.00)
ZaapsClient.COULEUR_REPOS = Color(0.55, 0.35, 1.00)
ZaapsClient.SON_ACTIVATION = "nanos-world::A_VR_Confirm"
ZaapsClient.EFFET_ACTIVATION = "narvos::P_Health_Potion"
--- Sans sol trouvé (géométrie pas encore chargée), on suppose le point posé à
--- hauteur de capsule : c'est ce que rend `GetLocation` d'un personnage debout.
ZaapsClient.DEMI_CAPSULE_CM = 90
ZaapsClient.ATTENTE_SOUS_SOL_CM = 5000
local MESURE_ESSAIS = 25
local MESURE_PAS_MS = 200
local TICK_MS = 50

-- ── État — DÉCLARÉ EN TÊTE ────────────────────────────────────────────────────
local visuels = {}   -- id -> { point, sol, socle, anneau, cristal, lumiere, cristal_repos }
local actif = nil    -- id du Zaap actif de CE joueur
local horloge_ms = 0

local function Detruire(entite)
    if (entite and entite:IsValid()) then entite:Destroy() end
end

--- Le sol sous un point, ou la hauteur de capsule en repli.
local function Sol(x, y, z)
    local ok, r = pcall(function()
        return Trace.LineSingle(Vector(x, y, z + 50), Vector(x, y, z - 400),
            CollisionChannel.WorldStatic, TraceMode.TraceComplex, {})
    end)
    if (ok and type(r) == "table" and r.Success and r.ImpactPoint) then return r.ImpactPoint.Z end
    return z - ZaapsClient.DEMI_CAPSULE_CM
end

--- Rappelle `rappel(bornes)` dès que le mesh est chargé (bornes non nulles), ou
--- `rappel(nil)` après MESURE_ESSAIS tentatives.
local function Mesurer(objet, rappel, essai)
    essai = essai or 1
    if (not objet or not objet:IsValid()) then return end
    local ok, b = pcall(function() return objet:GetBounds() end)
    if (ok and type(b) == "table" and (tonumber(b.SphereRadius) or 0) >= 1) then return rappel(b) end
    if (essai >= MESURE_ESSAIS) then return rappel(nil) end
    Timer.SetTimeout(function() Mesurer(objet, rappel, essai + 1) end, MESURE_PAS_MS)
end

--- Met `objet` (mesuré à l'échelle 1) à l'échelle `s`, boîte centrée en (x, y), le
--- bas à `bas_z`. Rend la position du pivot obtenue.
local function Ajuster(objet, b, s, x, y, bas_z)
    local L = objet:GetLocation()
    local O, E = b.Origin, b.BoxExtent
    local pivot = Vector(x - s.X * (O.X - L.X), y - s.Y * (O.Y - L.Y), bas_z + s.Z * (L.Z - (O.Z - E.Z)))
    objet:SetScale(s)
    objet:SetLocation(pivot)
    return pivot
end

local function Cylindre(v, diametre, hauteur, bas_z)
    local p = v.point
    local c = StaticMesh(Vector(p.x, p.y, bas_z - ZaapsClient.ATTENTE_SOUS_SOL_CM), Rotator(),
        ZaapsClient.CYLINDRE, CollisionType.NoCollision)
    c:SetMaterial(ZaapsClient.MATERIAU)
    Mesurer(c, function(b)
        if (not b) then return end
        Ajuster(c, b, Vector(diametre / (2 * b.BoxExtent.X), diametre / (2 * b.BoxExtent.Y),
            hauteur / (2 * b.BoxExtent.Z)), p.x, p.y, bas_z)
    end)
    return c
end

local function Colorer(v)
    local couleur = (actif == v.point.id) and ZaapsClient.COULEUR_ACTIF or ZaapsClient.COULEUR_REPOS
    local e = ZaapsClient.EMISSION
    pcall(function()
        v.anneau:SetMaterialColorParameter("Emissive", Color(couleur.R * e, couleur.G * e, couleur.B * e))
    end)
    pcall(function() v.lumiere:SetColor(couleur) end)
end

--- Le cristal : mesuré, mis à la hauteur voulue sans dépasser la largeur maximale.
--- Un mesh qui ne se charge pas cède la place à une sphère lumineuse.
local function Cristal(v, mesh)
    local p = v.point
    local bas = v.sol + ZaapsClient.SOCLE_HAUTEUR_CM + ZaapsClient.CRISTAL_ENVOL_CM
    -- Né SOUS le sol le temps de la mesure : ni caché (des bornes d'acteur masqué
    -- ne sont pas garanties), ni visible à la mauvaise taille.
    local c = StaticMesh(Vector(p.x, p.y, bas - ZaapsClient.ATTENTE_SOUS_SOL_CM), Rotator(0, p.yaw or 0, 0),
        mesh, CollisionType.NoCollision)
    v.cristal = c
    Mesurer(c, function(b)
        if (not b) then
            Detruire(c)
            if (mesh ~= ZaapsClient.CRISTAL_REPLI) then return Cristal(v, ZaapsClient.CRISTAL_REPLI) end
            Console.Warn("[ZAAP] cristal introuvable pour " .. tostring(p.id))
            return
        end
        local haut = ZaapsClient.CRISTAL_HAUTEUR_CM / (2 * b.BoxExtent.Z)
        local large = ZaapsClient.CRISTAL_LARGEUR_MAX_CM / (2 * math.max(b.BoxExtent.X, b.BoxExtent.Y))
        local s = math.min(haut, large)
        v.cristal_repos = Ajuster(c, b, Vector(s, s, s), p.x, p.y, bas)
        if (mesh == ZaapsClient.CRISTAL_REPLI) then
            pcall(function() c:SetMaterial(ZaapsClient.MATERIAU) end)
            pcall(function() c:SetMaterialColorParameter("Emissive", Color(2, 2, 3)) end)
        end
    end)
end

local function Construire(point)
    local v = { point = point, sol = Sol(point.x, point.y, point.z) }
    v.anneau = Cylindre(v, ZaapsClient.ANNEAU_DIAMETRE_CM, ZaapsClient.ANNEAU_HAUTEUR_CM, v.sol)
    pcall(function() v.anneau:SetMaterialColorParameter("Tint", Color(0.02, 0.02, 0.03)) end)
    v.socle = Cylindre(v, ZaapsClient.SOCLE_DIAMETRE_CM, ZaapsClient.SOCLE_HAUTEUR_CM, v.sol)
    pcall(function()
        v.socle:SetMaterialColorParameter("Tint", Color(0.05, 0.06, 0.08))
        v.socle:SetMaterialScalarParameter("Metallic", 0.7)
        v.socle:SetMaterialScalarParameter("Roughness", 0.3)
    end)
    v.lumiere = Light(Vector(point.x, point.y, v.sol + ZaapsClient.LUMIERE_HAUTEUR_CM), Rotator(),
        ZaapsClient.COULEUR_REPOS, LightType.Point, ZaapsClient.LUMIERE_INTENSITE,
        ZaapsClient.LUMIERE_PORTEE_CM, 44, 0, 8000, true, false, true, 25)
    Cristal(v, ZaapsClient.CRISTAL)
    Colorer(v)
    return v
end

local function Demolir(v)
    for _, cle in ipairs({ "socle", "anneau", "cristal", "lumiere" }) do Detruire(v[cle]) end
end

--- Remplace tous les Zaaps dessinés par la liste reçue.
--- `etat = { points = {…}, actif = id | "" | nil }` — `actif` absent : inchangé.
function ZaapsClient.Afficher(etat)
    if (type(etat) ~= "table") then return end
    if (type(etat.actif) == "string") then actif = (etat.actif ~= "") and etat.actif or nil end
    for id, v in pairs(visuels) do
        Demolir(v)
        visuels[id] = nil
    end
    for _, p in ipairs(type(etat.points) == "table" and etat.points or {}) do
        if (type(p) == "table" and type(p.id) == "string" and tonumber(p.x) and tonumber(p.y) and tonumber(p.z)) then
            local ok, v = pcall(Construire, p)
            if (ok) then
                visuels[p.id] = v
            else
                Console.Warn("[ZAAP] dessin refuse pour " .. p.id .. " : " .. tostring(v))
            end
        end
    end
end

--- Le serveur a enregistré l'activation : couleurs, son, éclat.
function ZaapsClient.Activer(info)
    if (type(info) ~= "table" or type(info.id) ~= "string") then return end
    actif = info.id
    for _, v in pairs(visuels) do Colorer(v) end
    local ici = Vector(tonumber(info.x) or 0, tonumber(info.y) or 0, tonumber(info.z) or 0)
    pcall(function() Sound(ici, ZaapsClient.SON_ACTIVATION, false, true, SoundType.SFX, 1.0, 1.0) end)
    pcall(function() Particle(ici, Rotator(), ZaapsClient.EFFET_ACTIVATION, true, true) end)
end

--- À l'approche, la géométrie est chargée : on recale le socle sur le vrai sol si
--- le premier relevé n'avait trouvé que le repli.
function ZaapsClient.Recaler(id)
    local v = visuels[id]
    if (not v) then return end
    local sol = Sol(v.point.x, v.point.y, v.point.z)
    if (math.abs(sol - v.sol) < 2) then return end
    Demolir(v)
    visuels[id] = Construire(v.point)
end

-- Le cristal flotte. Une seule horloge pour tous les Zaaps : il y en a peu.
Timer.SetInterval(function()
    horloge_ms = horloge_ms + TICK_MS
    local phase = math.sin((horloge_ms % ZaapsClient.FLOTTEMENT_PERIODE_MS) / ZaapsClient.FLOTTEMENT_PERIODE_MS * 2 * math.pi)
    for _, v in pairs(visuels) do
        local r = v.cristal_repos
        if (r and v.cristal and v.cristal:IsValid()) then
            v.cristal:SetLocation(Vector(r.X, r.Y, r.Z + phase * ZaapsClient.FLOTTEMENT_CM))
        end
    end
end, TICK_MS)

return ZaapsClient
