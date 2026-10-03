-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Animaux.lua — L'EXÉCUTANT des compagnons.
--
-- Câblage : `Narvos.AnimauxServeur = Package.Require("Server/Animaux.lua")`
-- depuis Server/Index.lua, APRÈS Session (il faut un personnage contrôlé).
--
-- ── LE PARTAGE ────────────────────────────────────────────────────────────────
--   · `Shared/Logic/Animaux.lua` (`Narvos.Animaux`) — l'ÉTAT, pur : adoption,
--     renommage, activation, XP, montée de niveau. Aucun effet de bord ;
--   · `Shared/Catalogs/Animaux.lua` (`Narvos.AnimauxCatalogue`) — les ESPÈCES,
--     GÉNÉRÉ depuis le pack J.Suko extrait ;
--   · `Shared/Logic/Roster.lua` — le codec et la colonne `personnages.animaux` ;
--   · CE FICHIER — l'entité, l'horloge de suivi, la persistance, les commandes.
--
-- ⚠ `Narvos.Animaux` et `Narvos.AnimauxCatalogue` sont DEUX modules. Les
-- confondre donnerait un `nil` silencieux (le piège `Talents`/`TalentsLogic`).
--
-- ── LE REFUS QUI RESTE, MÊME QUAND TOUT EST CUIT ──────────────────────────────
-- Le 2026-09-10 au soir : les 41 espèces importées dans l'ADK, cuites et
-- déclarées (`cuit = true` pour les 41), avec 227 animations. Le refus d'une
-- espèce non cuite reste pourtant écrit ici, et doit le rester : c'est le
-- catalogue GÉNÉRÉ qui dit `cuit`, pas ce commentaire. Une espèce ajoutée au
-- pack demain arrivera `cuit = false` jusqu'au cook suivant.
--
-- `CharacterSimple` sur une référence morte ne lève RIEN — la bête n'apparaît
-- simplement pas. D'où le refus EN LA NOMMANT, plutôt qu'une invocation dans le
-- vide : c'est la différence entre « ça ne marche pas encore » et « ça ne marche
-- pas ».
--
-- (Cette en-tête a d'abord affirmé « AUCUNE n'est importée ni cuite » — vrai à
-- l'écriture, faux trois heures plus tard. Ne pas écrire un ÉTAT dans un
-- commentaire ; écrire le MÉCANISME, et laisser le catalogue porter l'état.)
-- ═══════════════════════════════════════════════════════════════════════════════

local AnimauxServeur = {}

local Animaux = Narvos.Animaux                 -- l'état, pur
local Catalogue = Narvos.AnimauxCatalogue      -- les espèces, généré

-- ── Réglages ─────────────────────────────────────────────────────────────────
local SUIVI_MS = 500          -- fréquence de décision du suivi
local DISTANCE_SUIVI = 300.0  -- au-delà, le compagnon se remet en marche (cm)
local RAYON_ARRIVEE = 150.0   -- 2e argument de MoveTo : un RAYON, pas une vitesse
local RECUL_ORDRE = 200.0     -- déplacement du joueur qui justifie un nouvel ordre
local POSE_DEVANT = 200.0     -- où le compagnon apparaît (cm devant le joueur)

-- ── État — tables par joueur, DÉCLARÉES EN TÊTE ──────────────────────────────
-- Avant tout lecteur. Une table par joueur déclarée après sa première lecture
-- vaut nil pour toujours, et c'est muet : le piège rencontré cinq fois ici.
local etats = {}        -- player -> état pur (Animaux.EtatVide())
local entites = {}      -- player -> CharacterSimple du compagnon actif
-- Dernière espèce dont l'animation a été refusée. Un seul avertissement par
-- espèce : sans ça, un compagnon ressorti dix fois en écrirait dix.
local dernier_diag = nil
local dernier_but = {}  -- player -> Vector du dernier ordre émis

-- Les dépendances que Server/Index.lua injecte. Valeurs par défaut INERTES :
-- sans injection, ce module ne fait rien plutôt que de crasher au chargement.
local deps = {
    session = nil,
    joueur_de = function(_) return nil end,
}

function AnimauxServeur.Configurer(d)
    if (type(d) ~= "table") then return false end
    for k, v in pairs(d) do deps[k] = v end
    return true
end

-- ── Session et persistance ───────────────────────────────────────────────────

local function Contexte(player)
    if (not player) then return nil end
    if (not deps.session or not deps.session.EnJeu(player)) then return nil end
    local s = deps.session.De(player)
    if (not s or not s.compte or not s.perso) then return nil end
    return s
end

--- L'état du joueur, chargé depuis la base au premier accès.
local function EtatDe(player)
    local e = etats[player]
    if (e) then return e end
    local s = Contexte(player)
    if (not s) then return nil end
    -- `s.perso.animaux` porte la colonne telle qu'elle sort de la base ; le
    -- décodeur rend l'état VIDE sur nil, chaîne vide ou contenu illisible.
    e = Narvos.Roster.DecoderAnimaux(s.perso.animaux)
    etats[player] = e
    return e
end

local function Enregistrer(player)
    local s, e = Contexte(player), etats[player]
    if (not s or not e) then return false end
    -- ⚠ Le refus passe par la VALEUR DE RETOUR (false, raison), pas par une
    -- exception : ne lire que le booleen du pcall laissait passer chaque refus
    -- (2026-09-14, meme defaut que EnregistrerSac).
    local ok, enregistre, raison = pcall(function()
        return Narvos.Roster.EnregistrerAnimaux(s.compte.id, s.perso.id, e)
    end)
    if (not ok or enregistre ~= true) then
        Console.Warn("Compagnons non enregistres : " .. tostring(ok and raison or enregistre))
        return false
    end
    return true
end

-- ── L'entité ─────────────────────────────────────────────────────────────────

local function Detruire(player)
    local e = entites[player]
    if (e and e:IsValid()) then e:Destroy() end
    entites[player] = nil
    dernier_but[player] = nil
end

--- Fait apparaître le compagnon actif. Rend (true) ou (false, raison NOMMÉE).
local function Poser(player, espece)
    local character = player:GetControlledCharacter()
    if (not character) then return false, "Aucun personnage" end

    Detruire(player)

    local rotation = character:GetRotation()
    local avant = rotation:GetForwardVector()
    local base = character:GetLocation()
    local position = Vector(
        base.X + avant.X * POSE_DEVANT,
        base.Y + avant.Y * POSE_DEVANT,
        base.Z)

    -- `CharacterSimple` accepte n'importe quel mesh, sans contrainte de
    -- squelette — c'est ce qui rend un pack étranger utilisable. Pas
    -- d'Animation Blueprint : lui en passer un fabriqué pour un autre squelette
    -- déformerait le modèle SANS erreur.
    local ok, entite = pcall(CharacterSimple, position, rotation,
        "narvos::" .. espece.mesh, "", CollisionType.Auto, true)
    if (not ok or not entite) then
        return false, "Invocation impossible (" .. espece.mesh .. ")"
    end

    -- ── L'animation de repos ─────────────────────────────────────────────────
    --
    -- ⚠ Pas d'Animation Blueprint : lui en passer un fabriqué pour un autre
    -- squelette déformerait le modèle SANS erreur. On joue une AnimSequence
    -- directement, en boucle (3ᵉ argument), comme le fait `Spawner` pour les PNJ.
    --
    -- ⚠ `PlayAnimation` sur une clé inconnue ne lève RIEN : la bête reste figée
    -- et personne n'apprend pourquoi. C'est pour ça que `repos` vient du
    -- catalogue GÉNÉRÉ, qui l'a lu dans `Assets.toml` — jamais d'un nom fabriqué
    -- à partir du nom de l'espèce.
    --
    -- Le catalogue préfère les variantes « OnPlace » : le compagnon est déplacé
    -- par `MoveTo`, et une animation à root motion translaterait l'entité en
    -- plus — les deux se battraient.
    if (espece.repos) then
        local ok_anim = pcall(function()
            entite:PlayAnimation("narvos::" .. espece.repos, "", true)
        end)
        if (not ok_anim and dernier_diag ~= espece.id) then
            dernier_diag = espece.id
            Console.Warn("Compagnon " .. espece.id .. " : animation de repos refusee ("
                .. tostring(espece.repos) .. ")")
        end
    end

    -- Identite SYNCHRONISEE (3e argument `true`). Le diagnostic client
    -- (Client/Diagnostic.lua) ne peut pas lire le mesh d'un personnage — aucun
    -- accesseur cote client — il le nomme par cette valeur, et compare l'echelle
    -- demandee a la taille RENDUE.
    -- Prefixe `compagnon:` : une grenouille de 5 cm n'est pas une poupee.
    pcall(function() entite:SetValue("narvos_pnj", "compagnon:" .. espece.id, true) end)

    entites[player] = entite
    return true
end

-- ── Le suivi ─────────────────────────────────────────────────────────────────
--
-- ⚠ ON NE RÉÉMET PAS L'ORDRE À CHAQUE TICK. `MoveTo` relancé toutes les 500 ms
-- redémarre le calcul de chemin et fait piétiner l'entité — la leçon est déjà
-- écrite dans `Server/Ia.lua`. On n'émet que si le joueur a réellement bougé
-- depuis le dernier ordre.
Timer.SetInterval(function()
    for player, entite in pairs(entites) do
        if (not entite or not entite:IsValid()) then
            entites[player] = nil
        else
            local character = player:GetControlledCharacter()
            if (character) then
                local cible = character:GetLocation()
                local ici = entite:GetLocation()
                local dx, dy = cible.X - ici.X, cible.Y - ici.Y
                local distance = math.sqrt(dx * dx + dy * dy)

                if (distance > DISTANCE_SUIVI) then
                    local precedent = dernier_but[player]
                    local bouge = true
                    if (precedent) then
                        local ex, ey = cible.X - precedent.X, cible.Y - precedent.Y
                        bouge = math.sqrt(ex * ex + ey * ey) > RECUL_ORDRE
                    end
                    if (bouge) then
                        dernier_but[player] = cible
                        pcall(function() entite:MoveTo(cible, RAYON_ARRIVEE) end)
                    end
                end
            end
        end
    end
end, SUIVI_MS)

-- ── L'API ────────────────────────────────────────────────────────────────────

--- Les espèces du catalogue, avec leur état d'adoption pour CE joueur.
function AnimauxServeur.Liste(player)
    local e = EtatDe(player)
    local out = {}
    for _, espece in ipairs(Catalogue.ESPECES) do
        local possede = e and Animaux.Obtenu(e, espece.id) or nil
        out[#out + 1] = {
            id = espece.id,
            label = espece.label,
            famille = espece.famille,
            cuit = espece.cuit,
            possede = possede ~= nil,
            surnom = possede and possede.surnom or nil,
            niveau = possede and possede.niveau or nil,
            actif = (e and e.compagnon_actif == espece.id) or false,
        }
    end
    return out
end

function AnimauxServeur.Adopter(player, espece_id, surnom)
    local e = EtatDe(player)
    if (not e) then return false, "Session inconnue" end
    local espece = Catalogue.Trouver(espece_id)
    if (not espece) then return false, "Espece inconnue" end
    if (Animaux.Obtenu(e, espece.id)) then return false, "Deja adopte" end

    -- Le surnom est du texte joueur : il est nettoyé avant d'entrer dans
    -- l'état, pas seulement avant d'entrer en base. Sinon la mémoire porte une
    -- valeur que la base refuserait, et les deux divergent.
    local propre = Narvos.Roster.NettoyerSurnom(surnom)
    if (propre == "") then propre = espece.label end

    etats[player] = Animaux.Adopter(e, espece.id, propre)
    Enregistrer(player)
    return true, propre
end

function AnimauxServeur.Renommer(player, espece_id, surnom)
    local e = EtatDe(player)
    if (not e) then return false, "Session inconnue" end
    if (not Animaux.Obtenu(e, espece_id)) then return false, "Compagnon non possede" end
    local propre = Narvos.Roster.NettoyerSurnom(surnom)
    if (propre == "") then return false, "Surnom vide" end
    etats[player] = Animaux.Renommer(e, espece_id, propre)
    Enregistrer(player)
    return true, propre
end

--- Active un compagnon. `espece_id = nil` désactive.
function AnimauxServeur.Activer(player, espece_id)
    local e = EtatDe(player)
    if (not e) then return false, "Session inconnue" end

    if (espece_id == nil) then
        etats[player] = Animaux.Activer(e, nil)
        Detruire(player)
        Enregistrer(player)
        return true, "range"
    end

    local espece = Catalogue.Trouver(espece_id)
    if (not espece) then return false, "Espece inconnue" end
    if (not Animaux.Obtenu(e, espece.id)) then return false, "Compagnon non possede" end

    -- ⚠ LE REFUS QUI COMPTE. Sans lui, `CharacterSimple` recevrait une
    -- référence morte, ne lèverait rien, et le joueur verrait « compagnon
    -- sorti » sans compagnon. Nommer le mesh manquant est la seule façon que
    -- l'information remonte.
    if (not espece.cuit) then
        return false, "« " .. espece.label .. " » n'est pas cuit dans le pack ("
            .. espece.mesh .. ") — import ADK + cook a faire"
    end

    local ok, raison = Poser(player, espece)
    if (not ok) then return false, raison end

    etats[player] = Animaux.Activer(e, espece.id)
    Enregistrer(player)
    return true, espece.label
end

--- Octroie de l'XP au compagnon ACTIF. Rend (true, niveau) ou (false, raison).
function AnimauxServeur.OctroyerXp(player, montant)
    local e = EtatDe(player)
    if (not e or not e.compagnon_actif) then return false, "Aucun compagnon actif" end
    local n = math.floor(tonumber(montant) or 0)
    if (n <= 0) then return false, "Montant nul" end

    local avant = Animaux.CompagnonActif(e)
    local nouvel = Animaux.OctroyerXp(e, e.compagnon_actif, n)
    etats[player] = nouvel
    Enregistrer(player)

    local apres = Animaux.CompagnonActif(nouvel)
    local monte = (apres and avant and apres.niveau > avant.niveau) or false
    return true, apres and apres.niveau or 1, monte
end

function AnimauxServeur.Actif(player)
    local e = EtatDe(player)
    if (not e) then return nil end
    return Animaux.CompagnonActif(e)
end

-- ── Déconnexion ──────────────────────────────────────────────────────────────
-- ⚠ L'ORDRE COMPTE : enregistrer AVANT d'oublier. `Session.Fermer` (ailleurs)
-- efface le compte et le personnage ; écrire après elle n'aurait plus de
-- destinataire.
Player.Subscribe("Destroy", function(player)
    Enregistrer(player)
    Detruire(player)
    etats[player] = nil
end)

return AnimauxServeur