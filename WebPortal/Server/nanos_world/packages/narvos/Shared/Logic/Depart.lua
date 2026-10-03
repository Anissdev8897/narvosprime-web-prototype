-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Depart.lua — où le joueur choisit d'apparaître, une fois son personnage
-- créé.
--
-- Câblage : `Narvos.Depart = Package.Require("Logic/Depart.lua")` dans
-- `Shared/Index.lua`.
--
-- ── CE QUE CE MODULE REMPLACE ────────────────────────────────────────────────
-- Avant, `SpawnPersonnage` (Server/Index.lua) posait le corps sur
-- `SurCercle(math.random(4), 4, RAYON_SPAWN, SOL_Z)` : un point tiré au hasard
-- parmi quatre, TOUJOURS autour de la Forge. Le joueur ne choisissait rien, et
-- les cinq autres mondes n'existaient qu'au bout d'un portail.
--
-- ── POURQUOI UN MODULE PUR ───────────────────────────────────────────────────
-- La question « où peut-on apparaître » se répond entièrement sur des données :
-- le catalogue des mondes, et le fait qu'un monde soit praticable. Aucun besoin
-- du moteur. Elle est donc testable — `scripts/lua-harness/depart.mjs` —, et
-- c'est ce qui permet de garantir qu'on ne proposera JAMAIS un monde absent du
-- pack cuit.
--
-- ── LA GÉOMÉTRIE RÉELLE N'EST PAS UNE CARTE ──────────────────────────────────
-- Mesuré sur `Mondes.CENTRES` : les cinq mondes de surface partagent le même X
-- (-8 513 420, à la Forge près) et s'échelonnent en Y de 0,2 à 8,4 millions.
-- Ils sont ALIGNÉS. L'orbital, lui, est à X ≈ 951 — ailleurs.
--
-- Dessiner ça littéralement donne une ligne droite et un point isolé : exact, et
-- illisible. On expose donc les deux lectures, et l'interface tranche :
--   · `position`  les vraies coordonnées, pour qui veut une carte fidèle ;
--   · `via`       par où l'on y accède, qui décrit la TOPOLOGIE — et chez nous
--                 tout passe par l'orbital.
-- ═══════════════════════════════════════════════════════════════════════════════

local Depart = {}

local function requis(nom, fichier)
    return (Narvos and Narvos[nom]) or Package.Require(fichier)
end

local Mondes = requis("Mondes", "Catalogs/Mondes.lua")
local Voyage = requis("Voyage", "Logic/Voyage.lua")

--- Le monde proposé par défaut, quand le joueur ne choisit pas.
---
--- ⚠ AKARLYS DEPUIS LE 2026-09-15. C'était la Forge (« le monde
--- d'atterrissage ») ; Hanibes l'a retirée du choix de départ tant qu'elle n'est
--- pas optimisée (`depart = false` dans Catalogs/Mondes.lua). La capitale est la
--- CITÉ du jeu, son décor est dans le niveau persistant et son sol a été mesuré
--- par six sondes : c'est le défaut qui perd le moins un nouveau joueur.
Depart.DEFAUT = "capitale"

--- Un monde est-il PROPOSÉ au départ ? Tout monde praticable l'est, sauf s'il
--- porte `depart = false` — une décision de conception, pas un état du pack.
---@param monde table|nil
---@return boolean
local function Proposable(monde)
    return monde ~= nil and monde.depart ~= false
end

--- Les mondes où l'on peut apparaître, prêts pour l'interface.
---
--- ⚠ ON DÉLÈGUE À `Voyage.MondePraticable`, ON NE REFAIT PAS SON TRAVAIL.
--- Cette fonction connaît les trois formes de décor (sous-niveau, catalogue,
--- décor déjà dans le persistant) ET le drapeau `cuit`. La recopier ici
--- garantirait qu'un jour l'une des deux oublie un cas — et proposer un monde
--- absent du pack fait tomber le joueur dans le vide, sans message.
---@param prefere string|nil  la cité enregistrée du personnage : marquée par défaut si elle est recevable
---@return table  liste de { id, label, description, position, defaut, via }
function Depart.Options(prefere)
    local sortie = {}
    -- La cité déjà choisie est présélectionnée ; sinon le défaut du jeu.
    local marque = (Depart.Valide(prefere) and prefere) or Depart.DEFAUT
    for _, m in ipairs(Voyage.MondesPraticables()) do
      if (Proposable(m)) then
        local centre = Mondes.CENTRES[m.id]
        -- ⚠ `Voyage.Arrivee` REND DEUX VALEURS : (dimension, position). Prendre
        -- la premiere donne un NOMBRE, et l'indexer leve. Attrape par le harnais
        -- des la premiere execution — c'est exactement ce qu'il est la pour
        -- faire, parce qu'en jeu ca aurait plante au moment de la creation d'un
        -- personnage, donc devant un joueur.
        local dimension, a = Voyage.Arrivee(m.id)
        sortie[#sortie + 1] = {
            id = m.id,
            label = m.label,
            description = m.description,
            -- Le POINT D'ARRIVÉE, pas le centre : c'est là que le corps se pose,
            -- et il a été mesuré par raycast. Le centre est le milieu du terrain,
            -- qui peut être un flanc de falaise.
            dimension = dimension,
            position = a and { x = a.X or a.x, y = a.Y or a.y, z = a.Z or a.z } or nil,
            centre = centre and { x = centre.X or centre.x, y = centre.Y or centre.y } or nil,
            defaut = (m.id == marque),
            via = Depart.Via(m.id),
        }
      end
    end
    return sortie
end

--- Par où l'on rejoint ce monde depuis les autres — la topologie, pas la carte.
---@param monde_id string
---@return string|nil
function Depart.Via(monde_id)
    -- Le hub est le point d'entrée, pas une destination dépendant du premier
    -- portail de retour trouvé. Pour les planètes, privilégier sa route réelle.
    if (monde_id == "orbital") then return nil end
    if (Mondes.Liaison("orbital", monde_id)) then return "orbital" end
    for _, l in ipairs(Mondes.LIAISONS or {}) do
        -- ⚠ LE CHAMP S'APPELLE `de`, PAS `depuis`. Cette fonction a lu `l.depuis`
        -- jusqu'au 2026-09-09 : un champ qui n'existe nulle part dans
        -- `Mondes.LIAISONS`. Elle rendait donc `nil` pour TOUS les mondes, sans
        -- lever — Lua rend nil sur une clé absente. Les 54 tests du harnais sont
        -- passés au vert parce qu'aucun n'interrogeait `via`.
        --
        -- Encore une clé recopiée qui diverge de sa source. Le test ajouté
        -- au-dessous ferme la porte : il exige une valeur NON NULLE pour au
        -- moins un monde, ce qu'un nom de champ inventé ne peut pas produire.
        if (l.vers == monde_id) then return l.de end
    end
    return nil
end

--- Le choix est-il recevable ?
---
--- ⚠ ON REVALIDE CÔTÉ SERVEUR, TOUJOURS. Le client envoie une chaîne ; un client
--- modifié en enverrait une autre. Sans cette vérification, un joueur se
--- poserait où il veut — y compris dans un monde non cuit, où il tomberait sans
--- fin.
---@param monde_id any
---@return boolean, string|nil
function Depart.Valide(monde_id)
    if (type(monde_id) ~= "string" or monde_id == "") then
        return false, "Choix absent"
    end
    local monde = Mondes.Trouver(monde_id)
    if (not monde) then return false, "Monde inconnu" end
    if (not Proposable(monde)) then return false, "Monde non propose au depart" end
    return Voyage.MondePraticable(monde_id)
end

--- Où poser le corps pour ce choix.
---
--- Rend `nil` sur un choix irrecevable : l'appelant doit alors retomber sur le
--- défaut, jamais poser le corps « quelque part ».
---@param monde_id any
---@return Vector|nil, string|nil
function Depart.Point(monde_id)
    local ok, raison = Depart.Valide(monde_id)
    if (not ok) then return nil, raison end
    -- Deux valeurs, encore : on ne garde que la position.
    local _, position = Voyage.Arrivee(monde_id)
    return position, nil
end

--- Le choix retenu, après validation, avec repli sur le défaut.
---
--- C'est la fonction que le serveur appelle : elle ne rend JAMAIS nil tant qu'au
--- moins un monde est praticable, et elle dit si elle a dû se replier — ce que
--- l'interface doit annoncer au joueur plutôt que de le déplacer en silence.
---@param monde_id any
---@return string|nil, boolean  monde retenu, repli
function Depart.Retenu(monde_id)
    if (Depart.Valide(monde_id)) then return monde_id, false end

    -- Le défaut, s'il est praticable.
    if (Depart.Valide(Depart.DEFAUT)) then return Depart.DEFAUT, true end

    -- Sinon le premier praticable. Cas de bordure réel : si la Forge était un
    -- jour exclue du pack, le jeu doit rester jouable au lieu de refuser tout
    -- spawn.
    local options = Depart.Options()
    if (#options > 0) then return options[1].id, true end

    return nil, true
end

return Depart
