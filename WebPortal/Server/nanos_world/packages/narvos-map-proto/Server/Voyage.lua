-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Voyage.lua — les portails entre les mondes.
--
-- Câblage : Package.Require("Server/Voyage.lua") depuis Server/Index.lua, APRÈS
-- Server/Session.lua et APRÈS le chargement de la map de départ.
--
-- ── COMMENT ON VOYAGE, PUISQUE nanos NE CHANGE PAS DE NIVEAU ──────────────────
-- nanos charge UN seul niveau. Nos maps sont des paquets de StaticMesh posés par
-- `MapLoader`. « Changer de map » se ferait donc en déchargeant la première —
-- et le monde changerait sous les pieds des joueurs restés derrière.
--
-- On emploie les DIMENSIONS : chaque map vit dans la sienne, toutes coexistent,
-- et un acteur d'une dimension n'existe pas pour les joueurs des autres. Voyager
-- se réduit alors à `player:SetDimension(n)` puis à poser le personnage au point
-- d'arrivée.
--
-- ── CHARGEMENT PARESSEUX ──────────────────────────────────────────────────────
-- Une map ne se charge qu'au PREMIER voyage vers elle, et reste ensuite. Charger
-- les trois au démarrage ferait des milliers d'entités pour des mondes que
-- personne ne visitera peut-être ; les décharger au départ du dernier joueur
-- ferait payer le chargement à chaque aller-retour.
--
-- ── CE QUI EST HONNÊTEMENT INCOMPLET ──────────────────────────────────────────
-- « Partir avec un véhicule volant » suppose des véhicules volants. Il n'y en a
-- AUCUN dans le pack cuit (mesuré le 2026-09-03 : `[assets.*]` n'en contient pas
-- un), et nanos n'expose pas de classe de véhicule volant — seulement
-- `VehicleWheeled` et `VehicleWater`.
--
-- La condition est donc implémentée mais son alimentation ne l'est pas : elle
-- lit `character:GetValue("narvos_vol")`, que le futur système de vaisseaux
-- posera. `GetValue`/`SetValue` sont l'API vérifiée d'entity-values ; on ne
-- devine aucune signature de véhicule.
-- ═══════════════════════════════════════════════════════════════════════════════

local VoyageServeur = {}

local Mondes = Narvos.Mondes
local Voyage = Narvos.Voyage
local Session = Narvos.SessionServeur

--- Délai minimal entre deux voyages d'un même joueur, en millisecondes.
--- Sans lui, rester sur le portail relancerait le voyage à chaque frame de
--- chevauchement — le joueur clignoterait entre deux mondes sans pouvoir sortir.
VoyageServeur.DELAI_MS = 3000

-- ── État ──────────────────────────────────────────────────────────────────────
--
-- ⚠ DÉCLARÉS EN TÊTE, avant le `Player.Subscribe("Destroy")` qui les purge.

--- Mondes dont le décor est posé : { monde_id = true }.
local charges = {}

--- Portails posés, par monde de départ. Sert au rechargement à chaud.
local portails = {}

--- Dernier voyage par joueur, en millisecondes du compteur de package.
local dernier = {}

local horloge_ms = 0
Timer.SetInterval(function() horloge_ms = horloge_ms + 100 end, 100)

-- ── Chargement d'un monde ─────────────────────────────────────────────────────

--- Pose le décor d'un monde dans SA dimension, une seule fois.
---@param monde_id string
---@return boolean, string|nil
function VoyageServeur.Charger(monde_id)
    if (charges[monde_id]) then return true, nil end

    local monde = Mondes.Trouver(monde_id)
    if (not monde) then return false, "Monde inconnu" end

    -- ── UN MONDE FERME OU PAS ENCORE CUIT NE SE TENTE PAS ────────────────────
    --
    -- Le catalogue est lu EN DIRECT depuis `packages/` ; les assets, eux,
    -- viennent du pack CUIT. Déclarer un monde dont le sous-niveau n'est pas
    -- encore dans le pack donne le pire des cas : le moteur ne le charge pas, ce
    -- code annonce « chargé par le moteur », et le joueur arrive à l'altitude
    -- mesurée… dans le vide. Il tombe sans fin, et rien ne le signale.
    --
    -- ⚠ Mesuré le 2026-09-09 : `ForestKitONE` apparaît **0 fois** dans
    -- `Assets.toml`, dont la sortie cuite date du 08 à 11 h 55. Le décalage
    -- entre le Lua vivant et le pack figé est structurel — il durera tant qu'un
    -- cook prendra des heures.
    --
    -- La regle partagee connait aussi `ouvert = false` (retrait temporaire D5).
    -- L'appeler ici evite qu'une commande directe charge un monde dont les
    -- portails, eux, ont correctement ete refuses par `MondePraticable`.
    local praticable, raison = Voyage.MondePraticable(monde_id)
    if (not praticable) then return false, raison end

    -- ── UN SOUS-NIVEAU N'A RIEN A POSER ──────────────────────────────────────
    -- Depuis le 2026-09-06 les quatre mondes sont des sous-niveaux Unreal de
    -- `Map_Narvos` : le moteur les charge avec la map, avant que le premier
    -- paquet Lua ne s'execute. Il ne reste donc que les portails a poser.
    --
    -- ⚠ NE PAS "completer" ceci par un `Level.LoadStreamLevel`. Cette API est
    -- d'autorite CLIENT : appelee ici, elle ne ferait rien, en silence.
    if (type(monde.niveau) == "string" and monde.niveau ~= "") then
        charges[monde_id] = true
        Console.Log(("Monde '%s' : sous-niveau '%s', charge par le moteur")
            :format(monde.label, monde.niveau))
        VoyageServeur.PoserPortails(monde_id)
        if (not monde.decor_glb) then return true, nil end
    end

    -- ── UN DECOR DEJA DANS LE PERSISTANT N'A RIEN A POSER NON PLUS ───────────
    --
    -- ⚠ TROISIEME FORME DE DECOR, ET ELLE MANQUAIT ICI. Le 2026-09-09 la
    -- capitale a recu `decor_persistant = true` : ses 13 490 acteurs CITY_PACK
    -- ont ete copies dans `Map_Narvos` meme, donc ni sous-niveau ni catalogue.
    -- J'ai ajoute cette forme a `Voyage.MondePraticable` -- qui decide si le
    -- portail est pose -- et PAS ici. Les deux fonctions se contredisaient : le
    -- portail vers Akarlys s'affichait, le joueur le prenait, et `Charger`
    -- repondait « n'a pas de decor dans le pack ». Exactement la meme faute que
    -- le garde `cuit` place apres la decision : deux fonctions qui repondent a
    -- la meme question doivent connaitre les memes formes.
    --
    -- Trouve par `voyage.mjs` (`sous-niveau nomme : capitale`), et seulement
    -- parce qu'on a fini par lancer TOUTE la batterie de harnais.
    if (monde.decor_persistant == true) then
        charges[monde_id] = true
        Console.Log(("Monde '%s' : decor deja dans la map persistante")
            :format(monde.label))
        VoyageServeur.PoserPortails(monde_id)
        return true, nil
    end

    local catalogue = Voyage.CatalogueDe(monde)
    if (not catalogue) then
        return false, monde.label .. " n'a pas de decor dans le pack"
    end

    charges[monde_id] = true

    Narvos.MapLoader.Charger(catalogue, {
        -- ⚠ `decalage_decor` D ABORD. Le decalage de MONDE place les reperes et
        -- les portails ; le decor d un catalogue, lui, porte ses transforms cuites
        -- dans ses sommets et demande son propre vecteur. Mesure du 2026-09-12 sur
        -- la Forge : les confondre posait le decor 4,72 km a cote du centre, donc a
        -- cheval sur le bord du monde.
        decalage = monde.decalage_decor or Mondes.DECALAGES[monde_id] or Vector(),
        sur_fin = function(poses, echecs)
            Console.Log(("Monde '%s' pose : %d mesh(es), %d echec(s), dimension %d")
                :format(monde.label, poses, echecs, monde.dimension))
            -- On annonce dans LA dimension concernée : les joueurs restés
            -- ailleurs n'ont que faire d'un monde qu'ils ne voient pas.
            VoyageServeur.PoserPortails(monde_id)
        end,
    })

    return true, nil
end

-- ── Condition de départ ───────────────────────────────────────────────────────

--- Le joueur pilote-t-il un appareil capable de rejoindre l'espace ?
---
--- ⚠ ON LIT UNE VALEUR D'ENTITÉ, on n'interroge aucun véhicule. `GetValue` est
--- l'API vérifiée (`entity-values.mdx`) ; les méthodes de véhicule de nanos ne
--- sont PAS dans la doc locale — elles vivent dans le JSON de l'API, et inventer
--- une signature est exactement l'erreur qui a coûté le faux positif MetaHuman.
---
--- Le système de vaisseaux posera `character:SetValue("narvos_vol", true, true)`
--- à l'embarquement. Tant qu'il n'existe pas, la valeur est fausse et les
--- liaisons `exige_vol` restent fermées — ce qui est la vérité, pas un défaut.
---@param player table
---@return boolean
function VoyageServeur.PiloteVol(player)
    local character = player:GetControlledCharacter()
    if (not character) then return false end

    local ok, valeur = pcall(function() return character:GetValue("narvos_vol", false) end)
    return ok and valeur == true
end

-- ── Le voyage ─────────────────────────────────────────────────────────────────

--- Envoie un joueur dans un monde.
---@param player table
---@param monde_id string
---@return boolean, string|nil
function VoyageServeur.Envoyer(player, monde_id)
    local dimension, arrivee = Voyage.Arrivee(monde_id)
    if (not dimension) then return false, "Monde inconnu" end

    local character = player:GetControlledCharacter()
    if (not character) then return false, "Aucun personnage" end

    -- ⚠ DIMENSION D'ABORD, POSITION ENSUITE. Déplacer le personnage avant de
    -- changer sa dimension le fait traverser l'ancien monde jusqu'aux
    -- coordonnées du nouveau : il tomberait à travers le décor de départ, ou
    -- apparaîtrait un instant dans un mur, avant de disparaître.
    --
    -- `SetDimension` sur le Player emmène son Character (doc : « When sending a
    -- Player, the Character will move too »).
    -- ── ENREGISTRER LE SAC AVANT DE PARTIR ───────────────────────────────────
    -- Un voyage est le second moment ou tout peut se perdre : le joueur change
    -- de monde, et si sa connexion lache pendant le chargement, la deconnexion
    -- n'aura peut-etre pas le temps d'ecrire. Une ecriture de plus retrecit la
    -- fenetre pour un cout nul — on ne voyage pas dix fois par seconde.
    --
    -- ⚠ LUE ICI, PAS AU CHARGEMENT. `Server/Index.lua` la pose apres avoir
    -- requis ce fichier ; une reference prise en tete vaudrait nil pour toujours.
    if (Narvos.EnregistrerSac) then pcall(Narvos.EnregistrerSac, player) end

    local monde = Mondes.Trouver(monde_id)

    -- ── PLUS DE DIMENSION : LES MONDES SONT SEPARES DANS L'ESPACE ────────────
    -- 80 km entre l'orbite et les planetes, 20 km entre deux planetes. Changer
    -- de dimension rendrait au contraire le joueur AVEUGLE au decor : la
    -- geometrie d'un sous-niveau n'est pas une entite nanos, elle reste en
    -- dimension 1. Le voyage est donc une teleportation, et rien d'autre.
    character:SetLocation(arrivee)

    -- ── VOL ET VITESSE, PAR MONDE ────────────────────────────────────────────
    -- L'orbite fait 40 km du hub a la premiere etoile. A 9,5 m/s c'est 70
    -- minutes ; a x40 c'est deux. Au sol ces valeurs rendraient le jeu
    -- injouable — d'ou le retour explicite a 1 en arrivant sur une planete.
    -- Toujours REMETTRE, jamais seulement poser : un joueur qui redescend en
    -- gardant x40 traverse la carte d'un pas.
    local vol = (monde and monde.vol) and true or false
    local vitesse = tonumber(monde and monde.vitesse) or 1.0
    pcall(function() character:SetFlyingMode(vol) end)
    pcall(function() character:SetSpeedMultiplier(vitesse) end)
    Events.CallRemote("Narvos:Voyage", player, Reliability.Reliable, {
        monde = monde_id,
        label = monde and monde.label or monde_id,
        description = monde and monde.description or nil,
    })

    return true, nil
end

--- Franchissement d'un portail.
---@param player table
---@param liaison table
local function Franchir(player, liaison)
    if (not Session or not Session.EnJeu(player)) then return end

    local precedent = dernier[player]
    if (precedent and (horloge_ms - precedent) < VoyageServeur.DELAI_MS) then return end

    local ok, raison = Voyage.PeutPartir(liaison, { pilote_vol = VoyageServeur.PiloteVol(player) })
    if (not ok) then
        -- On marque quand même l'instant : sinon le refus se répéterait à chaque
        -- frame de chevauchement et noierait le joueur de messages.
        dernier[player] = horloge_ms
        Events.CallRemote("Narvos:VoyageErreur", player, Reliability.Reliable, raison)
        return
    end

    -- Charge le monde d'arrivée s'il ne l'est pas encore. Le voyage part
    -- immédiatement : les meshes arrivent par lots derrière, et le joueur voit
    -- le décor se poser plutôt qu'un écran figé.
    VoyageServeur.Charger(liaison.vers)

    dernier[player] = horloge_ms
    VoyageServeur.Envoyer(player, liaison.vers)
end

-- ── Les portails ──────────────────────────────────────────────────────────────

--- Pose les portails partant d'un monde.
---
--- Un portail vers un monde SANS décor n'est pas posé : ouvrir une porte sur le
--- vide est pire que ne pas la montrer. Le refus est journalisé, une fois, avec
--- sa raison — c'est ce qui permet de comprendre l'absence sans lire le code.
---@param monde_id string
function VoyageServeur.PoserPortails(monde_id)
    if (portails[monde_id]) then return end

    local monde = Mondes.Trouver(monde_id)
    if (not monde) then return end

    local poses = {}
    portails[monde_id] = poses

    for _, liaison in ipairs(Mondes.LiaisonsDepuis(monde_id)) do
        local praticable, raison = Voyage.MondePraticable(liaison.vers)
        if (not praticable) then
            Console.Warn(("Portail '%s' non pose : %s"):format(liaison.label, raison))
        else
            local zone = Trigger(liaison.position, Rotator(), Vector(liaison.rayon),
                TriggerType.Sphere, false, liaison.teinte or Color(1, 1, 1), { "Character" })

            -- Le portail vit dans la dimension de son monde de DÉPART, sinon il
            -- serait visible et franchissable depuis n'importe où.
            -- ⚠ PAS DE `SetDimension` ICI. Le portail est deja isole par sa
            -- POSITION : celui de la Forge est a 80 km de l'orbite. Lui donner
            -- une dimension le ferait disparaitre pour tout le monde, puisque
            -- les joueurs restent tous en dimension 1.

            zone:Subscribe("BeginOverlap", function(_, acteur)
                -- `BeginOverlap` donne l'ACTEUR, pas le joueur. Un PNJ invoqué
                -- peut le franchir : sans ce test, `GetPlayer()` vaudrait nil et
                -- l'appel suivant lèverait.
                local ok, player = pcall(function() return acteur:GetPlayer() end)
                if (ok and player) then Franchir(player, liaison) end
            end)

            poses[#poses + 1] = zone
            Console.Log(("Portail pose : %s  (%s -> %s%s)"):format(
                liaison.label, liaison.de, liaison.vers,
                liaison.exige_vol and ", vaisseau requis" or ""))
        end
    end
end

-- ── Démarrage ─────────────────────────────────────────────────────────────────

--- Marque un monde comme déjà chargé sans le charger.
--- Sert à la map de départ, que `Server/Index.lua` pose lui-même : sans ça, le
--- premier retour vers elle la reconstruirait par-dessus l'existante.
---@param monde_id string
function VoyageServeur.DeclarerCharge(monde_id)
    local monde = Mondes.Trouver(monde_id)
    local praticable, raison = Voyage.MondePraticable(monde_id)
    if (not praticable) then return false, raison end

    -- Un sous-niveau peut nécessiter un complément GLB. Dans ce cas, passer par
    -- `Charger` garantit que le complément est réellement posé avant d'ouvrir
    -- ses portails.
    if (monde and monde.decor_glb) then
        return VoyageServeur.Charger(monde_id)
    end
    charges[monde_id] = true
    VoyageServeur.PoserPortails(monde_id)
    return true, nil
end

--- Diagnostic au démarrage : quels passages existent, lesquels manquent.
--- Une ligne par liaison, avec la raison — c'est ce qui évite de chercher dans
--- le code pourquoi un portail n'apparaît pas en jeu.
function VoyageServeur.Diagnostic()
    Console.Log("NARVOS — passages entre mondes :")
    for _, e in ipairs(Voyage.Etat()) do
        Console.Log(("  %-8s -> %-8s  %s%s"):format(
            e.de, e.vers,
            e.praticable and "ouvert" or ("FERME : " .. tostring(e.raison)),
            e.exige_vol and "  (vaisseau requis)" or ""))
    end
end

-- ── Réseau ────────────────────────────────────────────────────────────────────

--- Le client demande où il est. Sert au HUD après une reconnexion : nanos ne
--- rend que le numéro de dimension, pas le nom du monde.
Events.SubscribeRemote("Narvos:DemanderMonde", function(player)
    -- ⚠ PAR LA POSITION, PLUS PAR LA DIMENSION. Les quatre mondes partagent la
    -- dimension 1 depuis qu'ils sont separes dans l'espace : `ParDimension`
    -- rendrait le premier de la liste pour n'importe qui — donc « la Forge »
    -- meme en orbite.
    local character = player:GetControlledCharacter()
    local ok, position = pcall(function() return character and character:GetLocation() end)
    local monde = (ok and position) and Mondes.ParPosition(position) or nil
    Events.CallRemote("Narvos:Voyage", player, Reliability.Reliable, {
        monde = monde and monde.id or nil,
        label = monde and monde.label or nil,
        description = monde and monde.description or nil,
    })
end)

--- Purge à la déconnexion : sans ça la table retiendrait le joueur.
Player.Subscribe("Destroy", function(player)
    dernier[player] = nil
end)

return VoyageServeur