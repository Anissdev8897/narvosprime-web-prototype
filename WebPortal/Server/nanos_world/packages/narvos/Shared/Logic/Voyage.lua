-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Voyage.lua — voyager d'un monde à l'autre : les règles.
--
-- Câblage : Narvos.Voyage = Package.Require("Logic/Voyage.lua")
--
-- ── CE QUI EST ICI, ET CE QUI N'Y EST PAS ─────────────────────────────────────
-- Ici : le passage existe-t-il, le monde d'arrivée est-il praticable, le joueur
-- remplit-il la condition de départ, et OÙ atterrit-il.
-- Pas ici : les Trigger, les dimensions, les téléportations. Tout ça vit dans
-- `Server/Voyage.lua`, qui consomme les décisions prises ici.
--
-- La séparation vaut pour la même raison que sur `Sorts` : ce fichier se teste
-- hors moteur, sans map, sans joueur et sans horloge.
--
-- ── LA CONDITION DE DÉPART EST UN CONTEXTE, PAS UNE ENTITÉ ────────────────────
-- `PeutPartir` reçoit une table `{ pilote_vol = ... }` et non un `Player`. C'est
-- ce qui permet de la tester : construire un vrai joueur pilotant un vaisseau
-- demanderait le moteur entier, pour vérifier un booléen.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosVoyage
local Voyage = {}

local Mondes = (Narvos and Narvos.Mondes) or Package.Require("Catalogs/Mondes.lua")

--- Nom du champ `Narvos` portant le catalogue de meshes d'un monde, résolu au
--- moment de l'appel.
---
--- ⚠ RÉSOLU TARD, JAMAIS AU CHARGEMENT. `Mondes.lua` est requis avant les
--- catalogues de map dans `Shared/Index.lua` : une référence prise au chargement
--- vaudrait nil pour toujours, et tous les mondes passeraient pour absents.
---@param monde table
---@return table|nil
function Voyage.CatalogueDe(monde)
    if (type(monde) ~= "table" or type(monde.catalogue) ~= "string") then return nil end
    local racine = Narvos or {}
    local cat = racine[monde.catalogue]
    -- Un catalogue de map porte forcément une liste de meshes. Sans elle, ce
    -- n'est pas une map — mieux vaut le dire que de charger zéro objet et
    -- déclarer le monde ouvert.
    if (type(cat) ~= "table" or type(cat.MESHES) ~= "table") then return nil end
    return cat
end

--- Le monde est-il praticable — c'est-à-dire son décor existe-t-il ?
---
--- Un monde déclaré sans décor est une intention, pas un lieu. Y envoyer un
--- joueur le laisserait flotter dans le vide, sans sol ni repère, et sans aucun
--- message pour lui dire ce qui s'est passé.
---
--- ── DEUX FORMES DE DÉCOR, ET UNE SEULE SUFFIT ─────────────────────────────
--- Depuis le 2026-09-06 un monde peut tenir son décor de DEUX sources :
---   · `niveau`    un sous-niveau Unreal, chargé par le moteur avec la map ;
---   · `catalogue` une liste de meshes posée par `MapLoader`.
--- Les quatre mondes actuels sont des sous-niveaux. Exiger encore un catalogue
--- les déclarerait tous impraticables — et le jeu n'aurait plus aucun portail.
---@param monde_id any
---@return boolean, string|nil
--- ── TROISIÈME FORME DE DÉCOR : DÉJÀ DANS LE PERSISTANT ───────────────────
--- Ajoutée le 2026-09-09, après l'avoir vue échouer au démarrage du serveur :
---
---     orbital -> capitale  FERME : Akarlys n'est pas encore accessible
---     S_WARN  Portail 'Akarlys — descente vers la capitale' non pose
---
--- La capitale n'a ni `niveau` ni `catalogue`, et pourtant son décor EXISTE :
--- ses 13 490 acteurs ont été copiés directement dans `Map_Narvos`, le niveau
--- persistant, parce que les 18 maps de CITY_PACK ne portent AUCUN Landscape
--- (mesuré : `LandscapeProxy=0`, `Heightfield=0`) et qu'une copie d'acteurs
--- était donc la voie simple.
---
--- Il n'y a rien à charger pour ce monde : le moteur a déjà tout, avec la map.
--- `decor_persistant = true` le déclare, et c'est le SEUL des trois cas où
--- `Charger` n'a strictement rien à faire que poser les portails.
function Voyage.MondePraticable(monde_id)
    local monde = Mondes.Trouver(monde_id)
    if (not monde) then return false, "Monde inconnu" end

    -- Un monde peut rester entierement decrit dans le catalogue tout en etant
    -- retire temporairement du parcours. C'est le cas de la Forge pendant sa
    -- refonte D5 : conserver ses coordonnees et ses routes permet de la rouvrir
    -- sans reconstruction, mais aucun portail ne doit encore y conduire.
    if (monde.ouvert == false) then
        return false, (monde.label or tostring(monde_id)) .. " est temporairement fermee"
    end

    -- ⚠ `cuit = false` SE VÉRIFIE ICI, ET C'EST LE SEUL ENDROIT QUI COMPTE.
    --
    -- J'avais mis ce garde dans `VoyageServeur.Charger`. Erreur : c'est
    -- `MondePraticable` qui décide si un PORTAIL est posé. Constaté au
    -- démarrage du 2026-09-09 —
    --     Portail pose : Akarlys — descente vers la capitale
    --     orbital -> capitale  ouvert
    -- alors que `BIG_CITY_NIGHT_1` apparaît ZÉRO fois dans `Assets.toml`. Le
    -- portail invitait le joueur vers une ville absente du pack : pas de sol,
    -- chute sans fin. Un garde placé après la décision ne garde rien.
    if (monde.cuit == false) then
        return false, (monde.label or tostring(monde_id)) .. " n'est pas encore dans le pack cuit"
    end

    if (type(monde.niveau) == "string" and monde.niveau ~= "") then return true, nil end
    if (monde.decor_persistant == true) then return true, nil end
    if (not Voyage.CatalogueDe(monde)) then
        return false, monde.label .. " n'est pas encore accessible"
    end
    return true, nil
end

--- Liste des mondes praticables, pour l'affichage et le diagnostic.
---@return table
function Voyage.MondesPraticables()
    local sortie = {}
    for _, m in ipairs(Mondes.MONDES) do
        if (Voyage.MondePraticable(m.id)) then sortie[#sortie + 1] = m end
    end
    return sortie
end

--- Le voyage est-il possible ?
---
---@param liaison table   une entrée de `Mondes.LIAISONS`
---@param contexte table  { pilote_vol = boolean }
---@return boolean, string|nil
function Voyage.PeutPartir(liaison, contexte)
    if (type(liaison) ~= "table") then return false, "Passage inconnu" end

    local ok, raison = Voyage.MondePraticable(liaison.vers)
    if (not ok) then return false, raison end

    -- Monter dans l'espace à pied n'a aucun sens. Descendre non plus, mais la
    -- gravité s'en charge : la condition ne porte donc que sur la montée, et
    -- c'est le catalogue qui le dit (`exige_vol`), pas ce fichier.
    if (liaison.exige_vol) then
        local c = contexte or {}
        if (not c.pilote_vol) then
            return false, "Il faut piloter un vaisseau pour rejoindre l'espace"
        end
    end

    return true, nil
end

--- Où le joueur atterrit-il ?
--- Rend (dimension, position) du monde d'arrivée, ou nil si le monde n'existe pas.
---@param monde_id any
---@return integer|nil, table|nil
function Voyage.Arrivee(monde_id)
    local monde = Mondes.Trouver(monde_id)
    if (not monde) then return nil, nil end
    return monde.dimension, monde.arrivee
end

--- Passages partant d'un monde, avec leur état.
--- Sert au diagnostic au démarrage : c'est la seule vue qui dise, en une fois,
--- quels portails seront réellement posés et lesquels ne le seront pas.
---@param monde_id any
---@return table
function Voyage.EtatDepuis(monde_id)
    local sortie = {}
    for _, l in ipairs(Mondes.LiaisonsDepuis(monde_id)) do
        local ok, raison = Voyage.MondePraticable(l.vers)
        sortie[#sortie + 1] = {
            de = l.de,
            vers = l.vers,
            label = l.label,
            exige_vol = l.exige_vol and true or false,
            praticable = ok,
            raison = raison,
        }
    end
    return sortie
end

--- Tous les passages, avec leur état. Un seul appel pour tout le diagnostic.
---@return table
function Voyage.Etat()
    local sortie = {}
    for _, m in ipairs(Mondes.MONDES) do
        for _, e in ipairs(Voyage.EtatDepuis(m.id)) do sortie[#sortie + 1] = e end
    end
    return sortie
end

return Voyage
