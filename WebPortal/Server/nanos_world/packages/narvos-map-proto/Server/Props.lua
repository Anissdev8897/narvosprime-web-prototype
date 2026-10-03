-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Props.lua — poser du décor en jeu.
--
-- Câblage : Package.Require("Server/Props.lua") depuis Server/Index.lua, APRÈS
-- Server/Session.lua.
--
-- ── OÙ SE POSE UN PROP, ET POURQUOI LE SERVEUR LE DÉCIDE ──────────────────────
-- Le client pourrait envoyer la position visée : c'est un pas de plus vers un
-- joueur qui pose un mur à l'autre bout de la map, ou dans le sol d'un autre.
-- Le serveur calcule donc lui-même, depuis la position et l'orientation du
-- personnage qu'il possède déjà. Le client n'envoie que l'IDENTIFIANT du prop.
--
-- ── DEUX PLAFONDS, POUR DEUX RISQUES DIFFÉRENTS ───────────────────────────────
--   · `PLAFOND_PAR_JOUEUR` — un joueur qui maintient la touche enfoncée poserait
--     des centaines d'entités répliquées en quelques secondes.
--   · `DELAI_MS` — même sans plafond atteint, la cadence saturerait le réseau
--     avant que le compte ne monte.
-- Les deux sont nécessaires : le premier borne le total, le second la vitesse.
--
-- ── PROP ET PAS STATICMESH ────────────────────────────────────────────────────
-- `MapLoader` pose ses 12 987 meshes de décor en `StaticMesh`, qui est plus léger.
-- Ici c'est l'inverse : un prop posé par un joueur doit pouvoir être attrapé,
-- déplacé, détruit. C'est exactement ce que la classe `Prop` fournit, et la
-- différence de coût ne se voit pas sur quelques dizaines d'objets.
-- ═══════════════════════════════════════════════════════════════════════════════

local PropsServeur = {}

local Catalogue = Narvos.Props
local CatalogueNarvos = Narvos.PropsNarvos
local Session = Narvos.SessionServeur

--- Chemin complet d'un prop, cherche dans les DEUX catalogues.
---
--- ⚠ LE PACK DE BASE D'ABORD. Si un id existe des deux cotes, c'est celui de
--- nanos qui gagne : il est deja chez tous les joueurs, la ou le notre exige un
--- telechargement. Un doublon est possible — le constructeur de pack suffixe les
--- collisions DANS notre pack, pas entre les deux.
local function AssetDe(id)
    local a = Catalogue.Asset(id)
    if (a) then return a end
    if (CatalogueNarvos) then return CatalogueNarvos.Asset(id) end
    return nil
end

--- Objets posés simultanément par un même joueur.
-- ── LA GARDE D'ÉDITION : QUI ÉDITE OÙ ────────────────────────────────────────
--
-- Ce fichier ne connaît ni `Zones`, ni `Session`, ni la base. Il appelle une
-- fonction qu'on lui donne : `garde(player, x, y, z)` → `true` ou `false, raison`.
-- `Server/Index.lua` y branche la vraie, qui croise la session du joueur et le
-- catalogue de zones. Même discipline que `Agriculture`, qui reçoit sa base par
-- `UtiliserBase` plutôt que de l'ouvrir lui-même.
--
-- ⚠ **FERMÉE PAR DÉFAUT, ET C'EST LE POINT.** Tant que personne n'a appelé
-- `UtiliserGarde`, tout est refusé. Une garde ouverte par défaut serait
-- invisible si on oubliait de la brancher : le monde entier resterait éditable
-- par n'importe qui, et rien ne le dirait. C'est exactement ce qui est arrivé le
-- 2026-09-08, où 35 modules étaient lus et aucun câblé — le silence coûtait six
-- systèmes. Ici, l'oubli se voit à la première pose : personne ne peut rien
-- poser, et le message le dit.
local garde = function()
    return false, "Edition non configuree sur ce serveur (garde non branchee)"
end

--- Installe la garde d'édition.
---@param fn fun(player:table, x:number, y:number, z:number):boolean, string|nil
function PropsServeur.UtiliserGarde(fn)
    if (type(fn) ~= "function") then return false end
    garde = fn
    return true
end

-- ── LES ENTITÉS DE JEU POSABLES (2026-09-19) ─────────────────────────────────
-- Le menu de props propose aussi les ENTITÉS de jeu — gisements, ateliers —,
-- cataloguées par `Narvos.PoseRecolte` (pur, prouvé par `pose-recolte.mjs`).
-- Leur pose n'est pas celle d'un décor : il faut le déclencheur de proximité,
-- l'état de récolte/atelier et la ligne de persistance. Ce fichier ne connaît
-- ni les uns ni les autres — il DÉLÈGUE, même discipline que la garde.
-- `Server/Index.lua` y branche la vraie (`UtiliserPoseurEntite`).
-- ⚠ FERMÉ PAR DÉFAUT : tant que rien n'est branché, une entité du menu se
-- refuse avec un message, au lieu de poser un décor mort qui mentirait.
local poseur_entite = nil
---@param fn fun(player:table, id:string, position:table, yaw:number):boolean, string|nil
function PropsServeur.UtiliserPoseurEntite(fn)
    if (type(fn) ~= "function") then return false end
    poseur_entite = fn
    return true
end

PropsServeur.PLAFOND_PAR_JOUEUR = 60

--- Délai minimal entre deux poses, en millisecondes.
PropsServeur.DELAI_MS = 250

--- Distance de pose devant le personnage, en centimètres (unité nanos).
--- 250 cm : assez loin pour ne pas s'incruster dans le joueur, assez près pour
--- qu'il voie ce qu'il pose.
PropsServeur.DISTANCE = 250.0

--- Élévation de la pose. Un prop posé au niveau des pieds traverse le sol le
--- temps que la physique le repousse, ce qui donne un sursaut visible.
PropsServeur.HAUTEUR = 60.0

-- ── État ──────────────────────────────────────────────────────────────────────
--
-- ⚠ DÉCLARÉS EN TÊTE. Le `Player.Subscribe("Destroy")` qui les purge est écrit
-- plus bas mais s'exécute au chargement : un `local` posé après lui le ferait
-- résoudre en GLOBAL nil. Piège rencontré cinq fois sur ce projet.

--- Props posés par joueur, dans l'ordre de pose (le dernier est en fin de liste).
local poses = {}

--- Dernière pose par joueur, en millisecondes du compteur de package.
local derniere = {}

--- Compteur monotone, en millisecondes. `os.time()` est en SECONDES : il ne
--- distinguerait pas deux poses séparées de 250 ms.
local horloge_ms = 0
Timer.SetInterval(function() horloge_ms = horloge_ms + 100 end, 100)

-- ── Pose ──────────────────────────────────────────────────────────────────────

--- Point de pose devant un personnage.
---@param character table
---@return table
local function DevantLe(character)
    local origine = character:GetLocation()
    local rotation = character:GetRotation()

    -- `GetForwardVector` donne le vecteur unitaire du regard. Le reconstruire à
    -- la main depuis le yaw marcherait aussi, mais ignorerait le pitch : le prop
    -- se poserait toujours à hauteur constante, y compris en visant le sol.
    local avant = rotation:GetForwardVector()

    return Vector(
        origine.X + avant.X * PropsServeur.DISTANCE,
        origine.Y + avant.Y * PropsServeur.DISTANCE,
        origine.Z + PropsServeur.HAUTEUR)
end

--- Pose un prop devant le joueur.
---@param player table
---@param id string      identifiant du catalogue
---@param angle? number  rotation en degrés autour de Z
---@return boolean, string|nil
function PropsServeur.Poser(player, id, angle)
    local character = player:GetControlledCharacter()
    if (not character) then return false, "Aucun personnage" end

    -- ⚠ LES ENTITÉS DE JEU D'ABORD (gisements, ateliers, 2026-09-19) : leur id
    -- n'est pas celui d'un décor du catalogue, et leur pose doit créer le
    -- déclencheur, l'état et la ligne de persistance — c'est le poseur branché
    -- par `Server/Index.lua` qui s'en charge. Les entités ne rejoignent PAS la
    -- liste `poses` du joueur : ni le gizmo ni « tout retirer » ne doivent
    -- toucher un nœud de récolte.
    if (Narvos.PoseRecolte and Narvos.PoseRecolte.ENTREES
        and Narvos.PoseRecolte.Trouver(Narvos.PoseRecolte.ENTREES, id)) then
        if (not poseur_entite) then
            return false, "Entite non posable ici (poseur non branche)"
        end
        local precedente = derniere[player]
        if (precedente and (horloge_ms - precedente) < PropsServeur.DELAI_MS) then
            return false, "Trop rapide"
        end
        local yaw = character:GetRotation().Yaw + (tonumber(angle) or 0)
        local position = DevantLe(character)
        local permis, refus = garde(player, position.X, position.Y, position.Z)
        if (not permis) then return false, refus or "Edition refusee ici" end
        local ok, raison = poseur_entite(player, id, position, yaw)
        if (ok) then derniere[player] = horloge_ms end
        return ok, raison
    end

    local asset = AssetDe(id)
    if (not asset) then return false, "Prop inconnu" end

    local liste = poses[player]
    if (not liste) then liste = {}; poses[player] = liste end

    if (#liste >= PropsServeur.PLAFOND_PAR_JOUEUR) then
        return false, "Maximum de " .. PropsServeur.PLAFOND_PAR_JOUEUR .. " props poses"
    end

    local precedente = derniere[player]
    if (precedente and (horloge_ms - precedente) < PropsServeur.DELAI_MS) then
        return false, "Trop rapide"
    end

    -- Le prop reprend l'orientation du joueur, plus l'angle qu'il a choisi à la
    -- molette. Sans ça, tous les props se posent face au nord et rien ne
    -- s'aligne sur ce qu'on construit.
    local yaw = character:GetRotation().Yaw + (tonumber(angle) or 0)

    -- ⚠ LA GARDE SE POSE SUR LA POSITION D'ARRIVÉE, pas sur celle du joueur.
    -- Un joueur debout à la limite de sa maison pose devant lui : la moitié des
    -- poses tomberaient dehors si on jugeait sur ses pieds. `DevantLe` est donc
    -- calculé UNE fois et sert aux deux — le recalculer plus bas laisserait la
    -- garde juger un point que le prop n'occupe pas.
    local position = DevantLe(character)
    local permis, refus = garde(player, position.X, position.Y, position.Z)
    if (not permis) then return false, refus or "Edition refusee ici" end

    local ok, prop = pcall(Prop, position, Rotator(0, yaw, 0), asset)
    if (not ok or not prop) then return false, "Pose impossible" end

    -- ⚠ ON MEMORISE L'ASSET SUR L'ENTITE. Sans ca, l'export saurait OU est le
    -- prop mais pas CE QU'IL EST : un catalogue de positions sans meshes.
    pcall(function() prop:SetValue("narvos_asset", asset, false) end)

    liste[#liste + 1] = prop
    derniere[player] = horloge_ms

    return true, nil
end

--- Retire le dernier prop posé par ce joueur.
---
--- On dépile jusqu'à trouver une entité encore valide : un prop détruit
--- autrement (explosion, nettoyage de map) laisse un trou dans la liste, et
--- s'arrêter au premier trou rendrait la touche inerte sans raison visible.
---@param player table
---@return boolean
function PropsServeur.RetirerDernier(player)
    local liste = poses[player]
    if (not liste) then return false end

    while (#liste > 0) do
        local prop = table.remove(liste)
        if (prop and prop:IsValid()) then
            prop:Destroy()
            return true
        end
    end
    return false
end

--- Retire TOUT ce qu'un joueur a posé. Appelé à la déconnexion, et par la
--- commande de chat.
---@param player table
---@return integer
function PropsServeur.ToutRetirer(player)
    local liste = poses[player]
    if (not liste) then return 0 end

    local n = 0
    for _, prop in ipairs(liste) do
        if (prop and prop:IsValid()) then prop:Destroy(); n = n + 1 end
    end
    poses[player] = nil
    return n
end

--- Combien ce joueur a-t-il posé ? Sert au compteur du menu.
---@param player table
---@return integer
function PropsServeur.Compte(player)
    local liste = poses[player]
    if (not liste) then return 0 end

    local n = 0
    for _, prop in ipairs(liste) do
        if (prop and prop:IsValid()) then n = n + 1 end
    end
    return n
end

-- ── Réseau ────────────────────────────────────────────────────────────────────

local function EnJeu(player)
    return Session and Session.EnJeu(player)
end

--- Pousse le catalogue vers le menu du joueur.
---
--- Envoyé À LA DEMANDE et non au spawn : 449 entrées font plusieurs dizaines de
--- kilo-octets, et beaucoup de joueurs n'ouvriront jamais ce menu.
---@param player table
function PropsServeur.Envoyer(player)
    -- Les deux catalogues sont CONCATENES, pas fusionnes par id : le client
    -- affiche des listes, il n'a pas besoin d'un index.
    local categories, pieces, entites = {}, {}, {}
    for _, c in ipairs(Catalogue.CATEGORIES) do categories[#categories + 1] = c end
    for _, p in ipairs(Catalogue.PIECES) do pieces[#pieces + 1] = p end
    if (CatalogueNarvos) then
        for _, c in ipairs(CatalogueNarvos.CATEGORIES) do categories[#categories + 1] = c end
        for _, p in ipairs(CatalogueNarvos.PIECES) do pieces[#pieces + 1] = p end
    end
    -- Les ENTITÉS de jeu (gisements, ateliers) : même menu, section dédiée.
    if (Narvos.PoseRecolte and Narvos.PoseRecolte.ENTREES) then
        for _, e in ipairs(Narvos.PoseRecolte.ENTREES) do
            entites[#entites + 1] = {
                id = e.id, label = e.label, kind = e.kind,
                icone = e.icone, cuit = e.cuit,
            }
        end
    end

    Events.CallRemote("Narvos:Props", player, Reliability.Reliable, {
        categories = categories,
        pieces = pieces,
        entites = entites,
        poses = PropsServeur.Compte(player),
        plafond = PropsServeur.PLAFOND_PAR_JOUEUR,
    })
end

Events.SubscribeRemote("Narvos:DemanderProps", function(player)
    if (not EnJeu(player)) then return end
    PropsServeur.Envoyer(player)
end)

Events.SubscribeRemote("Narvos:PoserProp", function(player, id, angle)
    if (not EnJeu(player)) then return end

    local ok, raison = PropsServeur.Poser(player, id, angle)
    if (not ok) then
        Events.CallRemote("Narvos:PropErreur", player, Reliability.Reliable, raison)
        return
    end
    Events.CallRemote("Narvos:PropPose", player, Reliability.Reliable,
        PropsServeur.Compte(player), PropsServeur.PLAFOND_PAR_JOUEUR)
end)

Events.SubscribeRemote("Narvos:RetirerProp", function(player)
    if (not EnJeu(player)) then return end

    PropsServeur.RetirerDernier(player)
    Events.CallRemote("Narvos:PropPose", player, Reliability.Reliable,
        PropsServeur.Compte(player), PropsServeur.PLAFOND_PAR_JOUEUR)
end)

Events.SubscribeRemote("Narvos:ViderProps", function(player)
    if (not EnJeu(player)) then return end

    local n = PropsServeur.ToutRetirer(player)
    Events.CallRemote("Narvos:PropPose", player, Reliability.Reliable, 0,
        PropsServeur.PLAFOND_PAR_JOUEUR)
    Events.CallRemote("Narvos:PropInfo", player, Reliability.Reliable,
        n .. " prop(s) retire(s)")
end)

-- ── Gizmo : deplacer un prop deja pose ────────────────────────────────────────
--
-- ⚠ LE GIZMO EST CLIENT, LE DEPLACEMENT EST SERVEUR. `Gizmo` est d'autorite
-- CLIENT dans nanos : il n'existe que chez le joueur qui le manipule, et son
-- evenement `Transform` ne quitte pas sa machine. `Actor:SetLocation` est
-- d'autorite. Le client envoie donc la transform visee, le serveur la valide
-- puis l'applique — et c'est la replication qui la montre aux autres.
--
-- ⚠ NEUF NOMBRES, PAS UNE TABLE. Une table traverserait, mais neuf scalaires ne
-- peuvent pas etre a moitie decodes : c'est le meme choix que pour le pont
-- WebUI, ou une structure se perd en silence.

--- Distance maximale entre le joueur et l'endroit ou il pose son objet.
--- Sans elle, un client modifie poserait un mur a l'autre bout de la carte.
PropsServeur.PORTEE_GIZMO = 5000.0

--- Bornes d'echelle. Un prop a 0 est invisible et increvable ; a 50 il bouche
--- la carte. Les deux servent a quelqu'un qui veut nuire, pas a construire.
PropsServeur.ECHELLE_MIN = 0.1
PropsServeur.ECHELLE_MAX = 8.0

local function Borner(v, mini, maxi)
    v = tonumber(v)
    if (not v) then return nil end
    if (v ~= v) then return nil end           -- NaN : `nan ~= nan` est vrai
    if (v < mini) then return mini end
    if (v > maxi) then return maxi end
    return v
end

--- Le prop d'identifiant `id`, s'il appartient bien a ce joueur.
---
--- La propriete n'est pas verifiee par un champ : elle EST la liste `poses`.
--- Chercher ailleurs qu'ici laisserait un joueur deplacer le decor d'un autre.
---@param player table
---@param id any
---@return table|nil
function PropsServeur.SienPar(player, id)
    local liste = poses[player]
    if (not liste) then return nil end
    local n = tonumber(id)
    if (not n) then return nil end
    for _, prop in ipairs(liste) do
        if (prop and prop:IsValid() and prop:GetID() == n) then return prop end
    end
    return nil
end

--- Les props d'un joueur, avec leur asset ET leur transform.
---
--- ⚠ DISTINCT DE `EnvoyerListe`. Celle-ci pousse au CLIENT ce qu'il faut pour
--- selectionner : un id d'entite et une position. L'export, lui, a besoin de
--- l'ASSET — sans lui, le catalogue dirait « quelque chose ici » sans dire quoi.
---@param player table
---@return table
function PropsServeur.MesProps(player)
    local liste = poses[player] or {}
    local sortie = {}
    for _, prop in ipairs(liste) do
        if (prop and prop:IsValid()) then
            local p = prop:GetLocation()
            local r = prop:GetRotation()
            local e = prop:GetScale()
            -- `GetAssetName` n'est pas une methode verifiee : on lit la valeur
            -- posee a la pose, qui l'est.
            local ok, asset = pcall(function() return prop:GetValue("narvos_asset", nil) end)
            sortie[#sortie + 1] = {
                asset = ok and asset or nil,
                x = p.X, y = p.Y, z = p.Z,
                pitch = r.Pitch, yaw = r.Yaw, roll = r.Roll,
                sx = e.X, sy = e.Y, sz = e.Z,
            }
        end
    end
    return sortie
end

--- Les props de ce joueur, pour que son client sache quoi selectionner.
---@param player table
function PropsServeur.EnvoyerListe(player)
    local liste = poses[player] or {}
    local sortie = {}
    for _, prop in ipairs(liste) do
        if (prop and prop:IsValid()) then
            local p = prop:GetLocation()
            local r = prop:GetRotation()
            local e = prop:GetScale()
            sortie[#sortie + 1] = {
                id = prop:GetID(),
                x = p.X, y = p.Y, z = p.Z,
                pitch = r.Pitch, yaw = r.Yaw, roll = r.Roll,
                sx = e.X, sy = e.Y, sz = e.Z,
            }
        end
    end
    Events.CallRemote("Narvos:PropsListe", player, Reliability.Reliable, sortie)
end

--- Applique la transform demandee par le gizmo d'un joueur.
---@return boolean, string|nil
function PropsServeur.Bouger(player, id, x, y, z, pitch, yaw, roll, sx, sy, sz)
    local prop = PropsServeur.SienPar(player, id)
    if (not prop) then return false, "Cet objet n'est pas a vous" end

    local character = player:GetControlledCharacter()
    if (not character) then return false, "Aucun personnage" end

    x, y, z = tonumber(x), tonumber(y), tonumber(z)
    if (not x or not y or not z) then return false, "Position invalide" end
    if (x ~= x or y ~= y or z ~= z) then return false, "Position invalide" end

    -- La portee se mesure depuis le JOUEUR, pas depuis l'ancienne position du
    -- prop : sinon on deplacerait un objet de proche en proche jusqu'au bout de
    -- la carte, cinq metres a la fois.
    local o = character:GetLocation()
    local dx, dy, dz = x - o.X, y - o.Y, z - o.Z
    if ((dx * dx + dy * dy + dz * dz) > (PropsServeur.PORTEE_GIZMO ^ 2)) then
        return false, "Trop loin de vous"
    end

    -- ⚠ LA DESTINATION, PAS L'ORIGINE. Sans cette garde, un joueur poserait un
    -- prop chez lui — ce qui est permis — puis le TRAÎNERAIT au gizmo jusque
    -- dans la rue. La portée seule ne l'en empêche pas : elle borne un geste, pas
    -- une succession de gestes. C'est le même raisonnement que le commentaire
    -- ci-dessus sur la portée mesurée depuis le joueur.
    local permis, refus = garde(player, x, y, z)
    if (not permis) then return false, refus or "Edition refusee ici" end

    prop:SetLocation(Vector(x, y, z))
    prop:SetRotation(Rotator(tonumber(pitch) or 0, tonumber(yaw) or 0, tonumber(roll) or 0))

    local ex = Borner(sx, PropsServeur.ECHELLE_MIN, PropsServeur.ECHELLE_MAX)
    local ey = Borner(sy, PropsServeur.ECHELLE_MIN, PropsServeur.ECHELLE_MAX)
    local ez = Borner(sz, PropsServeur.ECHELLE_MIN, PropsServeur.ECHELLE_MAX)
    if (ex and ey and ez) then prop:SetScale(Vector(ex, ey, ez)) end

    return true, nil
end

Events.SubscribeRemote("Narvos:DemanderPropsListe", function(player)
    if (not EnJeu(player)) then return end
    PropsServeur.EnvoyerListe(player)
end)

Events.SubscribeRemote("Narvos:GizmoBouger",
    function(player, id, x, y, z, pitch, yaw, roll, sx, sy, sz)
        if (not EnJeu(player)) then return end
        local ok, raison = PropsServeur.Bouger(player, id, x, y, z, pitch, yaw, roll, sx, sy, sz)
        if (not ok) then
            Events.CallRemote("Narvos:PropErreur", player, Reliability.Reliable, raison)
        end
    end)

Events.SubscribeRemote("Narvos:SupprimerProp", function(player, id)
    if (not EnJeu(player)) then return end
    local prop = PropsServeur.SienPar(player, id)
    if (not prop) then return end
    prop:Destroy()
    PropsServeur.EnvoyerListe(player)
    Events.CallRemote("Narvos:PropPose", player, Reliability.Reliable,
        PropsServeur.Compte(player), PropsServeur.PLAFOND_PAR_JOUEUR)
end)

--- Purge à la déconnexion. Sans ça les props d'un joueur parti resteraient
--- éternellement, et la table le retiendrait en mémoire.
Player.Subscribe("Destroy", function(player)
    PropsServeur.ToutRetirer(player)
    derniere[player] = nil
end)

return PropsServeur