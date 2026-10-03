-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/MapLoader.lua — fait apparaître une map importée depuis un GLB.
--
-- Câblage : Narvos.MapLoader = Package.Require("Logic/MapLoader.lua")
--
-- ── POURQUOI CE MODULE EXISTE ─────────────────────────────────────────────────
-- Interchange importe un GLB de map en meshes SÉPARÉS et ne crée AUCUN Level :
-- la Forge donne 12 987 StaticMesh et rien qui les assemble. Sans ce chargeur,
-- ils sont dans le pack et invisibles.
--
-- ── TROIS DÉCISIONS QUI GOUVERNENT LE FICHIER ─────────────────────────────────
--
-- 1. `StaticMesh`, PAS `Prop`. Un Prop est une entité physique répliquée, conçue
--    pour des objets qu'on pousse. En poser 12 987 pour du décor saturerait le
--    réseau. La doc est explicite : StaticMesh « offers better performance on
--    spawning Static objects than Props ».
--
-- 2. Spawn à Vector(0,0,0). Les transforms sont CUITES dans les sommets
--    (`bake_meshes = True`, vérifié par adk-probe-pipeline.py) : chaque mesh
--    porte déjà sa position monde. Lui en donner une le déplacerait deux fois.
--
-- 3. PAR LOTS, jamais d'un bloc. 12 987 spawns dans une seule frame gèlent le
--    serveur assez longtemps pour que les clients se déconnectent. On étale sur
--    des Timers — c'est la même raison qui fait charger les maps du runtime web
--    en chunks séquentiels (cf. PuzzleMap dans le dépôt).
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosMapLoader
local MapLoader = {}

-- Meshes par lot, et pause entre deux lots. 200 × 40 ms fait la Forge en ~2,6 s
-- sans à-coup visible. Monter le lot accélère mais rallonge chaque frame ;
-- c'est le compromis à régler si le serveur bégaie au chargement.
MapLoader.PAR_LOT = 200
MapLoader.PAUSE_MS = 40

-- Meshes posés, par map. Sert au déchargement : sans cette liste, rien ne
-- permettrait de retrouver 12 987 entités pour les détruire.
local posees = {}

--- Charge une map dans le monde.
---@param catalogue table   table { NOM, MESHES } produite par narvos-map-to-lua.mjs
---@param options? table    { par_lot?, pause_ms?, collision?, decalage?, sur_fin? }
---@return boolean lance
---@return string|nil raison
function MapLoader.Charger(catalogue, options)
    if (type(catalogue) ~= "table" or type(catalogue.MESHES) ~= "table") then
        return false, "catalogue de map invalide"
    end

    local nom = catalogue.NOM or "?"
    if (posees[nom]) then
        return false, "map deja chargee : " .. nom
    end

    options = options or {}
    local par_lot = options.par_lot or MapLoader.PAR_LOT
    local pause = options.pause_ms or MapLoader.PAUSE_MS

    -- `Auto` laisse le moteur déduire la collision du mesh. Un décor sans
    -- collision est traversable : le joueur tombe à travers le sol.
    local collision = options.collision or CollisionType.Auto

    -- ── Dimension ────────────────────────────────────────────────────────────
    --
    -- C'est ce qui permet à plusieurs maps de coexister sans se voir. nanos met
    -- tout en dimension 1 par défaut ; un acteur posé dans une autre n'existe
    -- que pour les joueurs qui s'y trouvent (doc : `dimensions.mdx`).
    --
    -- Sans ça, voyager d'une map à l'autre obligerait à DÉCHARGER la première —
    -- donc à changer le monde de tous les joueurs restés derrière, y compris
    -- ceux qui ne voyagent pas.
    --
    -- ⚠ On pose la dimension mesh par mesh, à la création. `SetDimension` sur un
    -- acteur déjà vu par un joueur le fait disparaître chez lui : le faire après
    -- coup produirait un scintillement du décor entier.
    local dimension = tonumber(options.dimension)

    -- ── Décalage de la map ───────────────────────────────────────────────────
    --
    -- Chaque mesh porte sa transform monde CUITE dans sa géométrie : on les pose
    -- tous à l'origine et ils s'assemblent seuls. Décaler l'origine décale donc
    -- la map entière, sans toucher aux assets ni au catalogue.
    --
    -- Sert au réglage : la Forge flottait au-dessus du joueur, et rien dans le
    -- catalogue ne permet de l'abaisser. `Vector(0, 0, -800)` la descend de 8 m.
    --
    -- ⚠ Le décalage n'est PAS appliqué aux portails ni aux points de spawn, qui
    -- sont posés ailleurs avec leurs propres coordonnées. Décaler la map sans
    -- les décaler laisse le joueur apparaître dans le vide — ou dans le sol.
    local decalage = options.decalage or Vector()

    local meshes = catalogue.MESHES
    local total = #meshes
    local entites = {}
    posees[nom] = entites

    local index = 1
    local echecs = 0

    local function lot()
        local fin = math.min(index + par_lot - 1, total)

        for i = index, fin do
            local asset = "narvos::" .. meshes[i]
            -- Un mesh absent du pack ne doit pas interrompre les 12 000 autres :
            -- on compte et on continue.
            local ok, entite = pcall(StaticMesh, decalage, Rotator(), asset, collision)
            if (ok and entite) then
                if (dimension) then pcall(function() entite:SetDimension(dimension) end) end
                entites[#entites + 1] = entite
            else
                echecs = echecs + 1
            end
        end

        index = fin + 1

        if (index <= total) then
            Timer.SetTimeout(lot, pause)
            return
        end

        Console.Log(("Map '%s' : %d mesh(es) poses, %d echec(s)")
            :format(nom, #entites, echecs))
        if (options.sur_fin) then options.sur_fin(#entites, echecs) end
    end

    Console.Log(("Map '%s' : chargement de %d mesh(es), %d par lot...")
        :format(nom, total, par_lot))
    lot()

    return true
end

--- Retire une map du monde.
--- `auto_cleanup` du Package.toml détruit déjà tout au déchargement ; cette
--- fonction sert au changement de map en cours de partie.
---@param nom string
---@return integer detruites
function MapLoader.Decharger(nom)
    local entites = posees[nom]
    if (not entites) then return 0 end

    local n = 0
    for _, e in ipairs(entites) do
        if (e and e:IsValid()) then e:Destroy(); n = n + 1 end
    end

    posees[nom] = nil
    return n
end

--- Une map est-elle chargée ?
---@param nom string
---@return boolean
--- Déplace une map DÉJÀ posée. Outil de réglage, pas de gameplay.
---
--- Trouver la bonne hauteur demande de voir le résultat : redémarrer le serveur
--- à chaque essai coûterait 40 s pour un chiffre qu'on cherche à l'œil. Cette
--- fonction rejoue le décalage sur les entités en place.
---
--- ⚠ C'est ABSOLU, pas relatif : la position est réécrite, pas ajoutée. Deux
--- appels de suite avec la même valeur laissent la map au même endroit — ce qui
--- est le comportement voulu quand on tâtonne.
---
--- ⚠ Coûteux : une écriture par entité, soit 1 461 pour la Forge. À réserver au
--- réglage. Une fois la valeur trouvée, la passer en `options.decalage` du
--- chargement, où elle ne coûte rien.
---@param nom string
---@param vecteur table  position absolue de l'origine de la map
---@return boolean fait
---@return string|nil raison
function MapLoader.Decaler(nom, vecteur)
    local entites = posees[nom]
    if (not entites) then return false, "map non chargee : " .. tostring(nom) end

    local bouges = 0
    for _, e in ipairs(entites) do
        -- Une entité peut avoir été détruite entre-temps ; on saute sans bruit
        -- plutôt que d'interrompre le déplacement des 1 460 autres.
        if (pcall(function() e:SetLocation(vecteur) end)) then bouges = bouges + 1 end
    end
    return true, nil, bouges
end

function MapLoader.EstChargee(nom)
    return posees[nom] ~= nil
end

--- Pose les dalles qui bouchent les trous de la carte.
---
--- ⚠ POURQUOI CE N'EST PAS `Charger`. Les meshes d'une map ont leurs transforms
--- CUITES dans les sommets : `Charger` les spawne donc tous à `Vector(0,0,0)`.
--- Les dalles, elles, sont UN SEUL cube générique réutilisé N fois — sans
--- position ni échelle explicites, elles s'empileraient toutes à l'origine.
---
--- Le décalage de la map s'applique aussi à elles, sinon elles resteraient aux
--- coordonnées de l'éditeur pendant que le décor, lui, aurait bougé.
---
---@param catalogue table  Catalogs/Patches.lua
---@param options table|nil  { decalage = Vector, dimension = number }
---@return integer posees, integer echecs
function MapLoader.PoserPatches(catalogue, options)
    options = options or {}
    if (type(catalogue) ~= "table" or type(catalogue.LISTE) ~= "table") then
        return 0, 0
    end

    local decalage = options.decalage or Vector()
    local dimension = tonumber(options.dimension)
    local entites = posees["patches"] or {}
    posees["patches"] = entites

    local ok_n, echecs = 0, 0
    for _, p in ipairs(catalogue.LISTE) do
        local pos = Vector(p.position[1] + decalage.X,
                           p.position[2] + decalage.Y,
                           p.position[3] + decalage.Z)
        -- ⚠ La ROTATION compte. Les dalles sont orientées sur la pente locale du
        -- sol : posée à plat sur une pente à 30 deg, une dalle dépasse d'un côté
        -- et laisse un jour de l'autre. L'ordre nanos est (pitch, yaw, roll).
        local r = p.rotation or { 0, 0, 0 }
        local rot = Rotator(r[1], r[2], r[3])
        -- Collision seule : la dalle doit porter le joueur, pas se faire
        -- remarquer. `StaticOnly` suffit, rien ne bouge ici.
        -- Le mesh peut varier PAR ENTREE : les dalles en partagent un seul,
        -- la vegetation en alterne quatre pour ne pas donner quatre clones.
        local asset = "narvos::" .. (p.mesh or "")
        if (not p.mesh) then asset = catalogue.MESH end
        local ok, e = pcall(StaticMesh, pos, rot, asset, p.collision or CollisionType.StaticOnly)
        if (ok and e) then
            pcall(function() e:SetScale(Vector(p.echelle[1], p.echelle[2], p.echelle[3])) end)
            -- Le matériau vient du sol qui BORDE ce trou-là, pas d'un matériau
            -- unique : une dalle d'herbe au milieu de la roche se verrait autant
            -- qu'un trou.
            local mat = p.materiau or catalogue.MATERIAU
            if (mat) then
                pcall(function() e:SetMaterial("narvos::" .. mat, -1) end)
            end
            if (dimension) then pcall(function() e:SetDimension(dimension) end) end
            entites[#entites + 1] = e
            ok_n = ok_n + 1
        else
            echecs = echecs + 1
        end
    end

    Console.Log(("Patches : %d dalle(s) posee(s), %d echec(s)"):format(ok_n, echecs))
    return ok_n, echecs
end

return MapLoader
