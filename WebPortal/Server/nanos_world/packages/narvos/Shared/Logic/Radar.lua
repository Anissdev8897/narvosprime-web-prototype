-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Radar.lua — Mini-carte / radar (port de projection.ts, pur)
--
-- ── PARITÉ ────────────────────────────────────────────────────────────────────
-- `Radar.worldToRadar` est le port EXACT de `src/rpg/runtime/radar/projection.ts`.
-- `scripts/lua-harness/radar.mjs` bundle le TS réel via esbuild et compare
-- chaque cas : mêmes { x, y, inBounds }. C'est ce qui prouve le portage.
-- ═══════════════════════════════════════════════════════════════════════════════

local Radar = {}

--- Port EXACT de worldToRadar. Retourne { x, y, inBounds }.
--- @param worldX   X monde (m)   @param worldZ  Z monde (m)
--- @param arenaRadius rayon de l'arène (m)   @param radarSize taille carrée (px)
function Radar.worldToRadar(worldX, worldZ, arenaRadius, radarSize)
    local center = radarSize / 2
    local pxPerMeter = center / arenaRadius          -- ratio px par mètre monde
    local x = center + worldX * pxPerMeter
    local y = center + worldZ * pxPerMeter
    local inBounds = math.sqrt(worldX * worldX + worldZ * worldZ) <= arenaRadius
    return { x = x, y = y, inBounds = inBounds }
end

--- Mini-carte : filtre les points dans un rayon autour du joueur, trie par
--- distance (le plus proche d'abord), plafonne à `max`.
--- `points` : liste de { x, z, id, label, teinte, ... } (PAS de redéfinition :
--- le panneau consomme `Mondes.LIAISONS` et `Gisements`, il ne les fabrique pas).
--- Retourne une liste de { point = p, distance = d }.
function Radar.Points(points, joueurX, joueurZ, rayon, max)
    local out, n = {}, 0
    for _, p in ipairs(points or {}) do
        local dx = (p.x or 0) - joueurX
        local dz = (p.z or 0) - joueurZ
        local distance = math.sqrt(dx * dx + dz * dz)
        if (distance <= rayon) then
            n = n + 1
            out[n] = { point = p, distance = distance }
        end
    end
    table.sort(out, function(a, b) return a.distance < b.distance end)
    if (max and #out > max) then
        local cap, c = {}, 0
        for i = 1, max do c = c + 1; cap[c] = out[i] end
        out = cap
    end
    return out
end

--- Compte les points dans le rayon (sans tri ni plafond) — prédicat du panneau.
function Radar.DansRayon(points, joueurX, joueurZ, rayon)
    local c = 0
    for _, p in ipairs(points or {}) do
        local dx = (p.x or 0) - joueurX
        local dz = (p.z or 0) - joueurZ
        if (math.sqrt(dx * dx + dz * dz) <= rayon) then c = c + 1 end
    end
    return c
end

-- ═══════════════════════════════════════════════════════════════════════════════
-- STYLES DES REPÈRES — PNJ, animaux, ressources, véhicules (demande B5, 13/09)
--
-- Le radar ne montrait que portails et gisements. Il montre désormais ce qui VIT
-- autour du joueur, et `/editionpnj` règle couleur, taille et visibilité :
-- par SORTE (tous les PNJ), par RÔLE (tous les ennemis), par ENTRÉE (ce PNJ-là),
-- sans toucher un seul Blueprint. Ce qui suit ne fait que DÉCIDER : l'exécutant
-- (Server/EditionPnj.lua) lit les entités et persiste les réglages.
--
-- ⚠ PRIORITÉ, du plus général au plus précis : sorte < rôle < entrée. Un réglage
-- partiel (la taille seule) ne remet pas la couleur au défaut : il ne touche que
-- ce qu'il porte.
-- ═══════════════════════════════════════════════════════════════════════════════

--- Sortes de repères, dans l'ordre d'affichage du panneau. ⚠ SÉQUENCE.
Radar.SORTES = { "pnj", "animal", "ressource", "portail", "vehicule" }

Radar.LIBELLES_SORTES = {
    pnj = "PNJ", animal = "Animaux", ressource = "Ressources",
    portail = "Portails", vehicule = "Vehicules",
}

--- Taille d'un repère : rayon du point dessiné, en pixels du radar.
Radar.TAILLE_MIN = 1
Radar.TAILLE_MAX = 10

--- Défaut de chaque sorte.
Radar.STYLE_SORTE = {
    pnj       = { teinte = { 1.00, 0.36, 0.30 }, taille = 3,   visible = true },
    animal    = { teinte = { 0.96, 0.78, 0.30 }, taille = 2.5, visible = true },
    ressource = { teinte = { 0.55, 0.85, 1.00 }, taille = 3,   visible = true },
    portail   = { teinte = { 0.70, 0.90, 1.00 }, taille = 3,   visible = true },
    vehicule  = { teinte = { 0.76, 0.76, 0.84 }, taille = 2.5, visible = true },
}

--- Couleur par rôle de PNJ (les rôles de Catalogs/Spawnables.lua). Un allié et
--- un ennemi ne doivent pas se ressembler sur le radar sans aucun réglage.
Radar.TEINTE_ROLE = {
    allie    = { 0.36, 0.90, 0.45 },
    ennemi   = { 1.00, 0.30, 0.25 },
    monstre  = { 0.92, 0.22, 0.62 },
    marchand = { 1.00, 0.80, 0.22 },
    quete    = { 0.62, 0.52, 1.00 },
    neutre   = { 0.82, 0.82, 0.82 },
    test     = { 0.60, 0.60, 0.60 },
}

local function copieStyle(s)
    return {
        teinte = { s.teinte[1], s.teinte[2], s.teinte[3] },
        taille = s.taille,
        visible = s.visible,
    }
end

local function borne(v, mini, maxi)
    if (v < mini) then return mini end
    if (v > maxi) then return maxi end
    return v
end

--- Valide un réglage PARTIEL venu du panneau. Rend une table ne portant que les
--- champs valides fournis, ou nil + raison si rien d'exploitable.
---@param style any  { teinte = {r,g,b}?, taille = n?, visible = bool? }
---@return table|nil, string|nil
function Radar.NormaliserStyle(style)
    if (type(style) ~= "table") then return nil, "Reglage absent" end
    local sortie, champs = {}, 0
    if (style.teinte ~= nil) then
        local t = style.teinte
        if (type(t) ~= "table") then return nil, "Teinte invalide" end
        local r, g, b = tonumber(t[1] or t.r), tonumber(t[2] or t.g), tonumber(t[3] or t.b)
        if (not r or not g or not b or r ~= r or g ~= g or b ~= b) then return nil, "Teinte invalide" end
        sortie.teinte = { borne(r, 0, 1), borne(g, 0, 1), borne(b, 0, 1) }
        champs = champs + 1
    end
    if (style.taille ~= nil) then
        local n = tonumber(style.taille)
        if (not n or n ~= n) then return nil, "Taille invalide" end
        sortie.taille = borne(n, Radar.TAILLE_MIN, Radar.TAILLE_MAX)
        champs = champs + 1
    end
    if (style.visible ~= nil) then
        if (type(style.visible) ~= "boolean") then return nil, "Visibilite invalide" end
        sortie.visible = style.visible
        champs = champs + 1
    end
    if (champs == 0) then return nil, "Reglage vide" end
    return sortie, nil
end

--- La clé d'un réglage par ENTRÉE : la sorte préfixe l'identifiant, pour qu'un
--- animal et un PNJ de même id ne partagent pas leur réglage.
---@return string
function Radar.CleEntree(sorte, id)
    return tostring(sorte) .. ":" .. tostring(id)
end

--- Style effectif d'un repère.
---@param info table      { sorte, id?, role? }
---@param reglages table|nil { sortes = {}, roles = {}, ids = {} }
---@return table { teinte, taille, visible }
function Radar.Style(info, reglages)
    info = (type(info) == "table") and info or {}
    local sorte = Radar.STYLE_SORTE[info.sorte] and info.sorte or "pnj"
    local style = copieStyle(Radar.STYLE_SORTE[sorte])
    local role = Radar.TEINTE_ROLE[info.role]
    if (sorte == "pnj" and role) then style.teinte = { role[1], role[2], role[3] } end

    local r = (type(reglages) == "table") and reglages or {}
    local couches = {
        (r.sortes or {})[sorte],
        info.role and (r.roles or {})[info.role] or nil,
        info.id and (r.ids or {})[Radar.CleEntree(sorte, info.id)] or nil,
    }
    for i = 1, 3 do
        local c = couches[i]
        if (type(c) == "table") then
            if (type(c.teinte) == "table") then style.teinte = { c.teinte[1], c.teinte[2], c.teinte[3] } end
            if (type(c.taille) == "number") then style.taille = c.taille end
            if (type(c.visible) == "boolean") then style.visible = c.visible end
        end
    end
    return style
end

--- De quoi s'agit-il ? Depuis les valeurs SYNCHRONISÉES qu'y posent les exécutants
--- (`narvos_pnj`, `narvos_marchand`, `narvos_vehicule`) et le catalogue des PNJ.
--- Rend nil pour une entité que rien ne nomme (un joueur, un décor).
---@param valeurs table   { pnj?, marchand?, vehicule? }
---@param trouver function|nil  id -> entrée de Spawnables (ou nil)
---@return table|nil { sorte, id, role?, famille?, label? }
function Radar.Classer(valeurs, trouver)
    if (type(valeurs) ~= "table") then return nil end
    if (type(valeurs.vehicule) == "string" and valeurs.vehicule ~= "") then
        return { sorte = "vehicule", id = valeurs.vehicule }
    end
    local pnj = valeurs.pnj
    if (type(valeurs.marchand) == "string" and valeurs.marchand ~= "") then
        return { sorte = "pnj", id = valeurs.marchand, role = "marchand" }
    end
    if (type(pnj) ~= "string" or pnj == "") then return nil end
    local espece = pnj:match("^compagnon:(.+)$")
    if (espece) then return { sorte = "animal", id = espece } end
    local entree = (type(trouver) == "function") and trouver(pnj) or nil
    return {
        sorte = "pnj",
        id = pnj,
        role = entree and entree.role or "neutre",
        famille = entree and entree.famille or nil,
        label = entree and entree.label or pnj,
    }
end

return Radar