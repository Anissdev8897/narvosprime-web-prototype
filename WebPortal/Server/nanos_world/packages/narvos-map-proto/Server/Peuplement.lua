-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Peuplement.lua — faire exister les PNJ AUTOUR des joueurs, et nulle part
-- ailleurs.
--
-- Câblage : Package.Require("Server/Peuplement.lua") depuis Server/Index.lua,
-- APRÈS Server/Ia.lua (il lui confie chaque PNJ né).
--
-- ── LE DÉFAUT QUE CE FICHIER RÉPARE ───────────────────────────────────────────
-- `Server/Spawner.lua` fait apparaître un PNJ devant un joueur, et ce PNJ vit
-- ensuite POUR TOUJOURS. Rien ne le retire quand plus personne n'est là.
--
-- Or le coût du tick nanos est le NOMBRE d'entités, pas leur poids, et le
-- serveur vise 30 Hz — 33 ms pour tout. Deux cents bêtes endormies à l'autre
-- bout de la carte coûtent exactement ce que coûtent deux cents bêtes qui se
-- battent sous les yeux d'un joueur.
--
-- ── LA CARTE DÉCLARE, LE SERVEUR FAIT EXISTER ─────────────────────────────────
-- Un point de peuplement dit OÙ et QUOI. Il ne fait rien apparaître. C'est ce
-- module qui décide, à chaque passe, quels points ont un joueur assez près pour
-- mériter une entité — et détruit les autres.
--
-- Conséquence : la carte peut en déclarer cinq cents sans qu'aucune n'existe
-- tant que personne ne s'en approche.
--
-- ── ⚠ POURQUOI DEUX RAYONS, ET PAS UN ─────────────────────────────────────────
-- Un seul rayon fait CLIGNOTER. Le joueur qui marche exactement sur la limite
-- fait naître et mourir la bête à chaque pas, plusieurs fois par seconde.
-- On naît à `RAYON_NAISSANCE` et on ne meurt qu'à `RAYON_MORT`, plus grand :
-- entre les deux il ne se passe rien, et c'est précisément le but.
-- ═══════════════════════════════════════════════════════════════════════════════

local Peuplement = {}

local Spawnables = Narvos.Spawnables
local Session = Narvos.SessionServeur

-- ── Réglages ──────────────────────────────────────────────────────────────────

--- Distance à laquelle un point de peuplement fait naître son PNJ, en cm.
--- 8 000 = 80 m : assez loin pour que l'apparition ne se voie pas, assez près
--- pour que la bête soit là quand le joueur arrive.
Peuplement.RAYON_NAISSANCE = 8000.0

--- Distance à laquelle il meurt. ⚠ DOIT rester nettement plus grande que
--- `RAYON_NAISSANCE`, c'est elle qui supprime le clignotement.
Peuplement.RAYON_MORT = 14000.0

--- Cadence de la passe, en millisecondes. Un point de peuplement n'a pas besoin
--- d'être examiné à 30 Hz : un joueur ne traverse pas 60 m en une seconde.
Peuplement.PERIODE_MS = 1000

--- Plafond d'entités vivantes issues du peuplement, tous points confondus.
--- ⚠ CE N'EST PAS UNE DÉCORATION. C'est la dernière barrière avant qu'une carte
--- trop peuplée ne fasse tomber le tick : au-delà, on ne fait plus naître, même
--- si un joueur est à portée. Mieux vaut une clairière vide qu'un serveur qui
--- bégaie.
Peuplement.PLAFOND = 120

--- Délai avant qu'un point puisse refaire naître après une mort, en ms.
--- Sans lui, tuer un monstre le ferait réapparaître à la passe suivante, sous
--- les yeux du joueur qui vient de l'abattre.
Peuplement.REPOUSSE_MS = 45000

--- Valide un niveau saisi par l'auteur de la carte.
---@param niveau any
---@return boolean
function Peuplement.NiveauValide(niveau)
    local n = tonumber(niveau)
    local max = (Narvos.Progression and Narvos.Progression.NiveauMax
        and Narvos.Progression.NiveauMax()) or 50
    return n ~= nil and n == math.floor(n) and n >= 1 and n <= max
end

-- ── État ──────────────────────────────────────────────────────────────────────
--
-- ⚠ DÉCLARÉS EN TÊTE, avant les abonnements qui les lisent : un `local` posé
-- après son lecteur se résout en GLOBAL nil, sans erreur au chargement.

--- Points de peuplement : liste de { id, spawnable, x, y, z, yaw, rayon? }.
local points = {}

--- État par point, indexé par son rang dans `points` :
--- { entite, mort_a_ms }.
local etats = {}

--- Combien d'entités vivantes ce module a fait naître.
local vivants = 0

local horloge_ms = 0

-- Déclarations avancées : ces fonctions s'appellent mutuellement.
local Vivant, DistanceAuPlusProche, Naitre, Mourir

Vivant = function(e)
    if (not e) then return false end
    local ok, valide = pcall(function() return e:IsValid() end)
    if (not ok or not valide) then return false end
    local ok2, mort = pcall(function() return e:IsDead() end)
    return not (ok2 and mort)
end

--- Distance du joueur le plus proche d'un point, au carré.
--- ⚠ AU CARRÉ, sans racine : on ne compare que des distances entre elles, et
--- `math.sqrt` appelé pour chaque point et chaque joueur à chaque passe est du
--- calcul pur perdu.
---@param p table
---@param joueurs table
---@return number
DistanceAuPlusProche = function(p, joueurs)
    local mini = math.huge
    for _, j in ipairs(joueurs) do
        local dx, dy, dz = j.x - p.x, j.y - p.y, j.z - p.z
        local d = dx * dx + dy * dy + dz * dz
        if (d < mini) then mini = d end
    end
    return mini
end

-- ── HABILLAGE METACUSTOM (2026-09-19) ─────────────────────────────────────────
-- Les corps MetaCustom (`pnj_simple`) sont NUS : un corps de base, rien sur les
-- épaules. Ici on leur attache des pièces `pnj_simple` du même genre, mêmes
-- primitives que la garde-robe (`AddSkeletalMeshAttached`) — le squelette
-- Skel_Dummy du corps et celui des pièces concordent, c'est la preuve du
-- manifeste qui l'a garanti à la génération.
local function HabillerMetaCustom(entite, asset, rang)
    local Modular = Narvos.Modular
    if (not Modular or not Modular.PIECES) then return end

    local genre_corps = "F"
    for _, c in pairs(Modular.CORPS or {}) do
        if (c.asset == asset) then genre_corps = c.genre break end
    end

    local par_slot = {}
    for _, p in pairs(Modular.PIECES) do
        if (p.pnj_simple and p.genre == genre_corps and p.slot ~= "taille") then
            par_slot[p.slot] = par_slot[p.slot] or {}
            par_slot[p.slot][#par_slot[p.slot] + 1] = p
        end
    end

    -- Choix STABLE par point de peuplement : le même rang refait naître la même
    -- tenue, deux points voisins ne portent pas la même panoplie.
    local pos = 0
    for _, slot in ipairs({ "torse", "jambes", "pieds", "taille", "tete" }) do
        local candidates = par_slot[slot]
        if (candidates) then
            local p = candidates[((rang + pos) % #candidates) + 1]
            pcall(function()
                entite:AddSkeletalMeshAttached("tenue_" .. slot, p.asset)
            end)
            pos = pos + 1
        end
    end
end

Naitre = function(rang, p)
    if (vivants >= Peuplement.PLAFOND) then return end

    local entree = Spawnables and Spawnables.Trouver(p.spawnable) or nil
    local asset = Spawnables and Spawnables.Asset(p.spawnable) or nil
    if (not entree or not asset) then
        -- Un point qui désigne un spawnable absent du pack ne doit pas être
        -- réessayé mille fois : on le neutralise et on le dit une fois.
        Console.Warn(("Peuplement : spawnable inconnu '%s', point %s neutralise")
            :format(tostring(p.spawnable), tostring(p.id)))
        p.spawnable = nil
        return
    end

    local position = Vector(p.x, p.y, p.z)
    local rotation = Rotator(0, tonumber(p.yaw) or 0, 0)

    -- `CharacterSimple` accepte n'importe quel mesh, `Character` impose
    -- SKEL_Mannequin. C'est le catalogue qui sait lequel convient — pas nous.
    local ok, entite
    if (entree.simple) then
        ok, entite = pcall(CharacterSimple, position, rotation, asset, "",
            CollisionType.Auto, true)
    else
        ok, entite = pcall(Character, position, rotation, asset)
        -- NOTRE locomotion. `CharacterSimple` (branche du dessus) n'a pas cette
        -- methode : seul le vrai `Character` la recoit.
        if (ok and entite) then Narvos.CharacterBuilder.PoserLocomotion(entite) end
    end
    if (not ok or not entite) then return end

    local echelle = tonumber(entree.echelle)
    if (echelle and echelle ~= 1) then
        pcall(function() entite:SetScale(Vector(echelle, echelle, echelle)) end)
    end

    -- Identite SYNCHRONISEE (3e argument `true`). Le diagnostic client
    -- (Client/Diagnostic.lua) ne peut pas lire le mesh d'un personnage — aucun
    -- accesseur cote client — il le nomme par cette valeur, et compare l'echelle
    -- demandee a la taille RENDUE.
    pcall(function()
        entite:SetValue("narvos_pnj", p.spawnable, true)
        entite:SetValue("narvos_echelle", echelle or 1, true)
        if (p.niveau) then entite:SetValue("narvos_niveau", p.niveau, true) end
    end)

    etats[rang] = { entite = entite }
    vivants = vivants + 1

    -- Habillage des civils MetaCustom : pièces pnj_simple du même genre, mêmes
    -- primitives que la garde-robe (AddSkeletalMeshAttached).
    if (entree.tenue == "metacustom") then
        HabillerMetaCustom(entite, asset, rang)
    end

    -- ⚠ CONFIER À L'IA, sinon la bête naît et reste plantée. C'est le même
    -- point d'entrée que `Spawner.Invoquer` : un PNJ né autrement ne bougera
    -- pas, et rien ne le signalera.
    if (Narvos.IaServeur) then
        pcall(function()
            Narvos.IaServeur.Prendre(entite, entree, { niveau = p.niveau })
        end)
    end
end

Mourir = function(rang, tue)
    local etat = etats[rang]
    if (not etat) then return end
    if (etat.entite and Vivant(etat.entite)) then
        if (Narvos.IaServeur) then
            pcall(function() Narvos.IaServeur.Oublier(etat.entite) end)
        end
        pcall(function() etat.entite:Destroy() end)
    end
    vivants = math.max(0, vivants - 1)
    -- Un PNJ RETIRÉ parce que plus personne n'est là peut revenir tout de
    -- suite ; un PNJ TUÉ doit attendre. Confondre les deux ferait réapparaître
    -- le monstre sous les yeux de qui vient de l'abattre.
    etats[rang] = tue and { mort_a_ms = horloge_ms } or nil
end

-- ── Le catalogue ──────────────────────────────────────────────────────────────

--- Charge une liste de points de peuplement.
---
--- ⚠ TOLÉRANTE : une entrée mal formée est ÉCARTÉE et comptée, jamais devinée.
--- Un point sans position ferait naître à l'origine du monde — c'est-à-dire au
--- milieu du hub orbital, à 80 km de la carte visée.
---@param liste table|nil
---@param decalage table|nil  Vector à ajouter, si la carte est décalée
---@return integer retenus, integer ecartes
function Peuplement.Charger(liste, decalage)
    points, etats, vivants = {}, {}, 0
    if (type(liste) ~= "table") then return 0, 0 end

    local dx = decalage and (tonumber(decalage.X) or 0) or 0
    local dy = decalage and (tonumber(decalage.Y) or 0) or 0
    local dz = decalage and (tonumber(decalage.Z) or 0) or 0

    local ecartes = 0
    for _, e in ipairs(liste) do
        local x, y, z = tonumber(e.x), tonumber(e.y), tonumber(e.z)
        local spawnable = e.spawnable
        local niveau_ok = e.niveau == nil or Peuplement.NiveauValide(e.niveau)
        if (type(spawnable) == "string" and spawnable ~= ""
                and x and y and z and niveau_ok) then
            points[#points + 1] = {
                id = e.id or ("point_" .. tostring(#points + 1)),
                spawnable = spawnable,
                x = x + dx, y = y + dy, z = z + dz,
                yaw = tonumber(e.yaw) or 0,
                rayon = tonumber(e.rayon),
                niveau = e.niveau ~= nil and math.floor(tonumber(e.niveau)) or nil,
            }
        else
            ecartes = ecartes + 1
        end
    end

    Console.Log(("Peuplement : %d point(s) charge(s), %d ecarte(s)")
        :format(#points, ecartes))
    return #points, ecartes
end

--- Combien de points, et combien d'entités vivantes. Pour le diagnostic.
---@return integer points, integer vivants
function Peuplement.Etat() return #points, vivants end

--- Retire tout. Appelé au changement de map.
function Peuplement.Vider()
    for rang in pairs(etats) do Mourir(rang, false) end
    etats, vivants = {}, 0
end

-- ── La passe ──────────────────────────────────────────────────────────────────

local function Passe()
    horloge_ms = horloge_ms + Peuplement.PERIODE_MS
    if (#points == 0) then return end

    -- Les joueurs, relevés UNE fois. Les redemander par point ferait N×M appels
    -- d'API là où N+M suffisent.
    local joueurs = {}
    for _, player in ipairs(Player.GetAll()) do
        if (not Session or Session.EnJeu(player)) then
            local c = player:GetControlledCharacter()
            if (c) then
                local ok, p = pcall(function() return c:GetLocation() end)
                if (ok and p) then joueurs[#joueurs + 1] = { x = p.X, y = p.Y, z = p.Z } end
            end
        end
    end

    -- Personne en jeu : on retire tout et on s'arrête là. Laisser vivre des PNJ
    -- sur un serveur vide est le cas le plus absurde du lot.
    if (#joueurs == 0) then
        if (vivants > 0) then Peuplement.Vider() end
        return
    end

    for rang, p in ipairs(points) do
        if (p.spawnable) then
            local etat = etats[rang]
            local d2 = DistanceAuPlusProche(p, joueurs)
            local naissance = p.rayon or Peuplement.RAYON_NAISSANCE
            local mort = math.max(Peuplement.RAYON_MORT, naissance * 1.6)

            if (etat and etat.entite) then
                -- Vivant : meurt-il de distance, ou est-il mort tout court ?
                if (not Vivant(etat.entite)) then
                    Mourir(rang, true)
                elseif (d2 > (mort * mort)) then
                    Mourir(rang, false)
                end
            else
                local repos = etat and etat.mort_a_ms
                local pret = (not repos) or ((horloge_ms - repos) >= Peuplement.REPOUSSE_MS)
                if (pret and d2 <= (naissance * naissance)) then
                    Naitre(rang, p)
                end
            end
        end
    end
end

Timer.SetInterval(Passe, Peuplement.PERIODE_MS)

return Peuplement