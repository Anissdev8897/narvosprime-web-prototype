-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Session.lua — la pause entre la connexion et le jeu.
--
-- Câblage : Package.Require("Server/Session.lua") depuis Server/Index.lua, APRÈS
-- que Narvos.CharacterBuilder est disponible.
--
-- ── CE QUE ÇA CHANGE ───────────────────────────────────────────────────────────
-- Avant : `Player.Subscribe("Spawn")` fabriquait immédiatement un personnage, en
-- piochant une classe à la ronde. Le joueur tombait dans le monde sans avoir rien
-- choisi.
--
-- Maintenant, le joueur traverse trois états :
--
--     connexion  --> selection  --> en_jeu
--
--   · connexion : identification. Steam est automatique ; sinon le client montre
--     un formulaire identifiant/mot de passe.
--   · selection : la liste de ses personnages. Aucun ? il DOIT en créer un.
--   · en_jeu    : le personnage est spawné, la boucle normale reprend.
--
-- Le joueur n'a AUCUN corps avant `en_jeu`. C'est la « pause » demandée : rien ne
-- se charge tant qu'un personnage n'est pas choisi.
--
-- ── RÈGLE DE SÉCURITÉ DU FICHIER ───────────────────────────────────────────────
-- Le client envoie des identifiants de personnage. Il ne faut JAMAIS lui faire
-- confiance : chaque manipulation passe par le `compte_id` de la SESSION, jamais
-- par une valeur reçue. `Roster.Supprimer` et `Roster.MajTenue` portent la
-- vérification jusque dans leur `WHERE` SQL — voir Logic/Roster.lua.
--
-- Et un joueur en état `connexion` ne peut RIEN faire d'autre que s'identifier :
-- sans ce garde, un client modifié sauterait l'authentification en envoyant
-- directement `Narvos:ChoisirPerso`.
-- ═══════════════════════════════════════════════════════════════════════════════

local Session = {}

local Comptes = Narvos.Comptes
local Roster = Narvos.Roster
local Creation = Narvos.Creation
local Modular = Narvos.Modular

--- Sessions vivantes, indexées par joueur.
--- Table à clés d'entité : elle est purgée dans `Player.Subscribe("Destroy")`,
--- sinon une session survivrait à son joueur et garderait son compte ouvert.
local sessions = {}

-- ⚠ `DEPART` S'INTERCALE ENTRE LA SELECTION ET LE JEU, il ne remplace rien.
-- Le joueur qui vient de prendre son personnage ne naît plus tout de suite : il
-- choisit d'abord SON MONDE. C'est ce que demandait la consigne — pas de choix
-- pendant la création, un choix au moment d'entrer.
--
-- L'état est porté par le serveur et non par le client parce que c'est lui qui
-- décide où le corps se pose : un client qui sauterait l'écran ne doit pas
-- pouvoir déclencher un spawn. Voir la garde de `Narvos:ChoisirDepart`.
local ETATS = {
    CONNEXION = "connexion",
    SELECTION = "selection",
    DEPART = "depart",
    EN_JEU = "en_jeu",
}

-- ⚠ DÉCLARATIONS AVANCÉES — NE PAS SUPPRIMER.
--
-- En Lua, `local function f` ne crée le local QU'À PARTIR de sa ligne. Une
-- fonction compilée plus haut qui appelle `f` résout le nom en GLOBAL, donc
-- `nil`, et lève à l'exécution — sans que rien ne le signale au chargement.
--
-- Trouvé par audit le 2026-09-03, deux fois dans ce seul fichier :
--   · `EntrerEnJeu` appelait `DetruireApercu` déclarée 48 lignes plus bas
--     -> le joueur ne pouvait PAS entrer en jeu ;
--   · le handler `Narvos:Apercu` appelait `SessionDans` déclarée 9 lignes plus
--     bas -> l'aperçu 3D n'apparaissait JAMAIS.
--
-- Les déclarer ici et les ASSIGNER plus bas (`X = function(...)`, jamais
-- `local function X`) rend l'ordre d'écriture sans importance.
local DetruireApercu
local SessionDans

-- ── Identité Steam ────────────────────────────────────────────────────────────

--- Steam ID d'un joueur, ou nil.
---
--- ⚠ NON VÉRIFIÉ : la documentation locale n'expose pas les signatures de
--- `Player` (les `.mdx` les injectent depuis github.com/nanos-world/api, absent
--- du disque). On sonde donc plusieurs noms plausibles au lieu d'en affirmer un.
--- Si aucun ne répond, le joueur passe simplement par le formulaire — le chemin
--- de repli existe précisément pour ça, et rien ne casse.
---
--- À corriger dès qu'on aura lu `Classes/Player.json` : remplacer cette sonde par
--- l'appel réel.
local function SteamID(player)
    for _, nom in ipairs({ "GetSteamID", "GetSteamId", "GetAccountID" }) do
        local f = player[nom]
        if (type(f) == "function") then
            local ok, valeur = pcall(f, player)
            if (ok and valeur ~= nil and tostring(valeur) ~= "" and tostring(valeur) ~= "0") then
                return tostring(valeur)
            end
        end
    end
    return nil
end

-- ── Envoi de l'état au client ─────────────────────────────────────────────────

--- Options de création, envoyées une fois : classes, genres, pièces modulaires.
--- Construites ici plutôt que codées côté client, pour que l'interface ne puisse
--- jamais proposer une classe ou une pièce que le serveur refuserait.
local function Options()
    -- Les pièces sont indexées par GENRE puis par FAMILLE : l'écran de création
    -- ne doit proposer que ce qui va avec le corps choisi. Les mélanger ici
    -- reviendrait à laisser le joueur composer une tenue que le serveur
    -- refuserait ensuite.
    -- ⚠ IDENTITE SEULEMENT. L'ecran de creation ne propose PLUS de vetements :
    -- ils s'achetent chez le tailleur et s'equipent depuis la garde-robe. Ce qui
    -- reste ici tient du personnage lui-meme — corps, visage, coiffure — parce
    -- qu'un vetement se change alors qu'un visage le definit.
    --
    -- Le filtre vit dans Vestiaire, pas ici : le serveur refuserait de toute
    -- facon un vetement envoye a la creation, et deux listes de registres
    -- finiraient par diverger.
    local pieces = {}
    local corps = {}
    for _, genre in ipairs({ "M", "F" }) do
        corps[genre] = Modular.CorpsParGenre(genre)
        pieces[genre] = {}
        for _, famille in ipairs(Modular.FAMILLES) do
            local par_slot = Narvos.Vestiaire.Identites(famille, genre)

            -- Chaque slot recoit une liste, meme vide : le client itere
            -- `slots` et un nil le ferait planter sur un slot sans piece.
            pieces[genre][famille] = {}
            for _, slot in ipairs(Modular.SLOTS) do
                pieces[genre][famille][slot] = par_slot[slot] or {}
            end
        end
    end

    return {
        factions = Narvos.Factions.Options(),
        classes = Creation.Options().classes,
        genres  = Creation.Options().genres,
        nom_min = Creation.NOM_MIN,
        nom_max = Creation.NOM_MAX,
        slots    = Modular.SLOTS,
        familles = Modular.FAMILLES,
        corps    = corps,
        pieces   = pieces,
        -- Morphologie : catalogue complet, envoye une fois. Seule la famille
        -- `mpfb` y repond ; l'ecran masque l'onglet pour les autres corps.
        morphs = {
            mesh     = Narvos.Morphs.MESH,
            zones    = Narvos.Morphs.ZONES,
            curseurs = Narvos.Morphs.CURSEURS,
            choix    = Narvos.Morphs.CHOIX,
            -- Curseurs de CORPS : six reglages qui pilotent les 340 ancres
            -- `macrodetails`. Le client n'a pas a connaitre la ponderation,
            -- il envoie six nombres et le serveur fait le reste.
            corps    = Narvos.Macros.CURSEURS,
            ethnies  = Narvos.Macros.ETHNIES,
            prefixe  = Narvos.Macros.PREFIXE,
        },
        -- Silhouette et couleurs. Valent pour TOUS les corps, y compris les deux
        -- Stylized sans morph target — c'est le seul reglage que ceux-la
        -- acceptent, et sans lui l'etape Apparence n'aurait rien a offrir sur
        -- les corps que le joueur choisit en pratique.
        apparence = {
            curseurs = Narvos.Apparence.CURSEURS,
            cibles   = Narvos.Apparence.CIBLES,
            palette  = Narvos.Apparence.PALETTE,
            prefixe  = Narvos.Apparence.PREFIXE,
        },
        max_persos = Roster.MAX_PAR_COMPTE,
        -- Meta Customization System : options CUITES par genre et apparence de
        -- depart. Calculees par Logic/MetaCustom.lua depuis le catalogue genere.
        metacustom = Narvos.MetaCustomLogic and {
            M = Narvos.MetaCustomLogic.Options("m"),
            F = Narvos.MetaCustomLogic.Options("f"),
            defaut = { M = Narvos.MetaCustomLogic.Defaut("m"), F = Narvos.MetaCustomLogic.Defaut("f") },
        } or nil,
    }
end

--- Pousse l'état courant vers le client.
---@param player table
---@param erreur string|nil  message à afficher, le cas échéant
function Session.Envoyer(player, erreur)
    local s = sessions[player]
    if (not s) then return end

    local charge = {
        etat = s.etat,
        erreur = erreur,
        pseudo = s.compte and s.compte.pseudo or nil,
        -- ⚠ On n'envoie JAMAIS la ligne de compte brute : elle porte `hash` et
        -- `sel`. Seul le pseudo traverse.
        --
        -- `steam_pseudo` conditionne l'affichage du bloc Steam côté client :
        -- sans lui, un joueur reconnu par Steam voyait quand même le formulaire
        -- identifiant/mot de passe. Trouvé par audit le 2026-09-03.
        steam_pseudo = s.steam_pseudo,
        serveur = s.serveur,
        persos = (s.compte and Roster.ParCompte(s.compte.id)) or {},
    }

    -- Les points de départ, SEULEMENT dans l'état qui les affiche.
    --
    -- ⚠ CALCULÉS À CHAQUE ENVOI, jamais mis en cache. La liste dépend de
    -- `Voyage.MondePraticable`, donc du pack cuit et du drapeau `cuit` : une
    -- copie prise au démarrage proposerait un monde retiré depuis, et le joueur
    -- tomberait dans le vide. Le coût est six entrées de table.
    if (s.etat == ETATS.DEPART and Narvos.Depart) then
        -- La cité déjà choisie par ce personnage est présélectionnée (2026-09-15).
        local cite = s.perso_attente and s.perso_attente.cite
        charge.departs = Narvos.Depart.Options(cite)
        charge.depart_defaut = (Narvos.Depart.Valide(cite) and cite) or Narvos.Depart.DEFAUT
        charge.perso_choisi = s.perso_attente and s.perso_attente.name or nil
    end

    Events.CallRemote("Narvos:Session", player, Reliability.Reliable, charge)
end

-- ── Entrée en jeu ─────────────────────────────────────────────────────────────

--- Fait naître le personnage choisi et rend la main au jeu normal.
--- `spawner` est la fonction de spawn de Server/Index.lua, injectée à
--- l'initialisation : ce module ne connaît pas les détails du monde.
---@param depart_id string|nil  monde choisi ; nil = le défaut de `Depart`
local function EntrerEnJeu(player, perso, depart_id)
    local s = sessions[player]
    if (not s) then return end

    -- L'aperçu disparaît AVANT le spawn : le joueur va posséder un vrai corps,
    -- et un mannequin orphelin resterait sous la map pour toujours.
    DetruireApercu(s)

    s.perso = perso
    s.etat = ETATS.EN_JEU

    Events.CallRemote("Narvos:Session", player, Reliability.Reliable, { etat = ETATS.EN_JEU })

    if (Session.spawner) then
        Session.spawner(player, perso, depart_id)
    else
        Console.Error("Session : aucun spawner injecte, le joueur reste sans corps.")
    end
end


-- ═══ APERÇU 3D ════════════════════════════════════════════════════════════════
--
-- Un vrai `Character` spawné hors de la map, avec la caméra du joueur pointée
-- dessus. C'est possible PRÉCISÉMENT parce que le joueur ne possède aucun corps
-- pendant la sélection : la doc note que `Player:SetCameraLocation` et
-- `SetCameraRotation` ne valent QUE hors possession.
--
-- Pourquoi un vrai personnage et pas un rendu hors écran : les 40 pièces sont
-- des skeletal meshes attachés par `AddSkeletalMeshAttached`, qui exige le même
-- squelette. Les assembler pour de bon est donc le seul aperçu FIDÈLE — tout
-- autre procédé montrerait autre chose que ce que le joueur obtiendra.
--
-- ⚠ LIMITE ASSUMÉE : les aperçus de plusieurs joueurs coexistent dans le même
-- monde, espacés de `ECART`. Chacun ne regarde que le sien, mais ils sont
-- techniquement visibles entre eux. Isoler par `SetDimension` supposerait de
-- déplacer aussi le joueur, ce que l'API ne permet pas hors possession — à
-- reprendre si le serveur accueille du monde.

--- Ancrage de la scène de composition.
---
--- ⚠ SUR LA MAP, pas dans un vide sous le décor. Le personnage se compose là où
--- il va vivre : le joueur voit le sol, la lumière et l'échelle réelles pendant
--- qu'il l'habille, au lieu d'un mannequin flottant dans le noir. C'est aussi ce
--- qui rend l'écran de création cohérent avec le jeu au lieu d'en être détaché.
---
--- `ancre` est POSÉE PAR Server/Index.lua, qui seul connaît la hauteur du sol
--- (`SOL_Z`) et le rayon de spawn de la map courante. La valeur ci-dessous n'est
--- qu'un repli si l'injection est oubliée.
--- ── LE CADRAGE ────────────────────────────────────────────────────────────────
--- Troisième personne, de face : le mannequin est tourné vers -X (yaw 180) et la
--- caméra est reculée sur -X, donc ils se regardent.
---
--- `recul` était à 190 cm pour un corps d'1,80 m : à cette distance le cadre
--- coupait la tête et les pieds. 300 cm laisse le corps ENTIER dans l'image avec
--- de l'air au-dessus, ce qu'il faut pour juger une silhouette — c'est la seule
--- chose que cet écran sert à juger.
---
--- `hauteur` vise le sternum plutôt que les yeux : viser la tête fait plonger la
--- caméra et écrase les jambes en perspective.
local APERCU = {
    ancre   = Vector(0, 0, 100),
    ecart   = 260,                   -- entre deux joueurs, sur la map
    recul   = 300,                   -- distance caméra -> personnage
    hauteur = 95,                    -- hauteur de visée, sternum
    pitch   = -3.0,                  -- très léger plongé, pour poser les pieds

    -- Boucle d'attente jouee sur le mannequin. « IP » = in place : elle
    -- n'emporte pas la racine, le mannequin reste dans son cadre.
    -- ⚠ SUFFIXE `_Anim`. Interchange produit DEUX assets par GLB d'animation :
    -- un SkeletalMesh au nom du fichier, et l'AnimSequence suffixee. Sans le
    -- suffixe, nanos repond « of type 'Animation' not found » et le mannequin
    -- reste en pose de bind.
    animation = "narvos::ANIM_IP_customer_idle_Anim",
}

--- Déplace la scène de composition. Appelée par Server/Index.lua au chargement.
---@param position table  Vector
function Session.PoserAncreApercu(position)
    if (position) then APERCU.ancre = position end
end

-- Les corps de base vivent désormais dans `Modular.CORPS` (généré) : ils sont
-- choisis par le joueur à l'étape « Corps », et c'est le corps retenu qui fixe
-- la morphologie — donc quelles pièces sont portables. Une constante codée ici
-- redoublerait le catalogue et finirait par diverger.

-- Horloge monotone, en SECONDES décimales. Sert à la limitation des tentatives
-- de connexion. `os.time()` est en secondes ENTIÈRES : il ne distinguerait pas
-- deux essais séparés d'une demi-seconde, ce qui est exactement l'échelle d'une
-- attaque automatisée.
local horloge = 0.0
Timer.SetInterval(function() horloge = horloge + 0.5 end, 500)

local prochain_emplacement = 0

--- Détruit l'aperçu d'un joueur. Sans ça, chaque changement de genre laisserait
--- un corps orphelin dans le monde.
--- ⚠ ASSIGNATION, pas `local function` : voir les déclarations avancées en tête.
DetruireApercu = function(s)
    if (s and s.apercu) then
        -- ⚠ LE BLUEPRINT D'ABORD. Un corps du Meta Customization System pose un
        -- acteur Blueprint ATTACHE au mannequin ; detruire le mannequin seul
        -- laisse l'acteur dans le monde, a l'emplacement d'apercu, visible par
        -- tous ceux qui creent un personnage apres.
        if (Narvos.MetaHumainBP) then
            Narvos.MetaHumainBP.Oublier(s.apercu)
        end
        s.apercu:Destroy()
        s.apercu = nil
    end
end

--- Position réservée à ce joueur.
local function PositionApercu(s)
    if (not s.emplacement) then
        s.emplacement = prochain_emplacement
        prochain_emplacement = prochain_emplacement + 1
    end
    return Vector(APERCU.ancre.X + s.emplacement * APERCU.ecart, APERCU.ancre.Y, APERCU.ancre.Z)
end

--- Construit ou reconstruit l'aperçu, puis cadre la caméra dessus.
---@param player table
---@param params table  { genre, tenue }
function Session.MajApercu(player, params)
    local s = sessions[player]
    if (not s or type(params) ~= "table") then return end

    local genre = (params.genre == "F") and "F" or "M"

    -- Le corps demandé décide du mesh de base ET de la morphologie. Inconnu, on
    -- prend le premier du genre : mieux vaut un mannequin approximatif qu'aucun.
    local corps_id = params.corps
    local corps = Modular.Corps(corps_id)
    if (not corps) then
        local dispo = Modular.CorpsParGenre(genre)
        corps_id = (#dispo > 0) and dispo[1].id or nil
        corps = corps_id and Modular.CORPS[corps_id] or nil
    end
    if (not corps) then
        Console.Error("[NARVOS] apercu : aucun corps disponible pour le genre " .. genre)
        return
    end

    local pos = PositionApercu(s)

    -- Le mesh de base ne peut pas changer sans recréer l'entité : `SetMesh` est
    -- marqué « server, lent » et recrée le squelette de toute façon. On repart
    -- donc d'un corps neuf à chaque changement de genre, et on se contente de
    -- rhabiller quand seul le vêtement bouge.
    -- Changer de corps impose de recréer l'entité : `SetMesh` est marqué
    -- « server, lent » et reconstruit le squelette de toute façon.
    -- ⚠ ON COMPARE L'IDENTIFIANT, PAS LE MESH. Depuis l'arrivee des corps
    -- MetaHuman, le Manny de Defender est le porteur de DEUX familles (defender et
    -- metahuman) : comparer les meshes rendrait « meme corps » pour deux corps
    -- differents, et l'ecran garderait le mannequin precedent.
    if (s.apercu and (s.apercu_genre ~= genre or s.apercu_corps ~= corps_id)) then
        DetruireApercu(s)
    end

    if (not s.apercu) then
        local mesh = corps.asset
        s.apercu = Character(pos, Rotator(0, 180, 0), mesh)
        s.apercu_genre = genre
        s.apercu_corps = corps_id

        -- Trace volontairement bavarde : un mannequin qui ne s'affiche pas ne
        -- lève rien, et sans ces lignes on en est réduit à supposer. À alléger
        -- une fois l'aperçu vu fonctionner.
        Console.Log(string.format(
            "[NARVOS] apercu : corps %s a (%.0f, %.0f, %.0f) — entite %s",
            tostring(mesh), pos.X, pos.Y, pos.Z, tostring(s.apercu ~= nil)))
        -- Mannequin de vitrine, pas un acteur du monde : ni collision, ni chute.
        --
        -- ⚠ NON VÉRIFIÉ : la doc locale n'expose pas les signatures de
        -- `Character` (les .mdx les injectent depuis github.com/nanos-world/api,
        -- absent du disque). Ces deux appels sont donc ISOLÉS : s'ils n'existent
        -- pas, l'aperçu s'affiche quand même — il flottera peut-être ou tombera,
        -- ce qui se voit et se corrige. Les laisser nus tuerait tout le
        -- gestionnaire et l'aperçu n'apparaîtrait JAMAIS, sans indice.
        pcall(function() s.apercu:SetCollision(CollisionType.NoCollision) end)
        pcall(function() s.apercu:SetGravityEnabled(false) end)

        -- ── ANIMATION D'ATTENTE ───────────────────────────────────────────
        --
        -- Un mannequin en T-pose ne se juge pas : les epaules sont ecartees,
        -- les bras tendus, et aucune silhouette ne ressemble a ce qu'elle sera
        -- en jeu. Une boucle d'attente remet le corps dans sa posture normale.
        --
        -- `ANIM_IP_customer_idle` est IN PLACE : elle n'emporte pas la racine,
        -- donc le mannequin ne derive pas hors du cadre. Une animation RM le
        -- ferait sortir de l'ecran en quelques secondes.
        pcall(function()
            s.apercu:PlayAnimation(APERCU.animation, AnimationSlotType.FullBody, true, 0.15, 0.15, 1.0, true)
        end)
    end

    -- Rhabillage. Delegue a Builder.Habiller : l'apercu et le personnage reel
    -- doivent obeir aux MEMES regles, sinon le joueur valide une silhouette qu'il
    -- ne retrouvera pas en jeu. C'est cette fonction qui cache le mesh porteur et
    -- complete les slots vides par la peau nue.
    -- Les morphs voyagent avec la tenue : l'apercu doit montrer le visage que
    -- le joueur regle, sinon il valide un personnage qu'il n'a jamais vu.
    -- L'apparence MetaHuman proposee par la page est NORMALISEE ici : l'apercu ne
    -- montre jamais ce que la creation refuserait.
    local metacustom = Narvos.MetaCustomLogic
        and Narvos.MetaCustomLogic.Normaliser(params.metacustom, genre) or nil
    local ok, raison = Narvos.CharacterBuilder.Habiller(
        s.apercu, corps, params.tenue, params.morphs, params.couleurs, metacustom)
    if (not ok) then
        Console.Error("[NARVOS] apercu : habillage refuse — " .. tostring(raison))
    end

    -- ── Cadrage : troisième personne, de face ────────────────────────────────
    --
    -- En `Rotator(pitch, yaw, roll)`, yaw 0 regarde vers +X. Le mannequin est
    -- posé en yaw 180, donc tourné vers -X. Reculer la caméra sur -X et la
    -- laisser à yaw 0 les met face à face — c'est ce qu'on veut : on juge une
    -- silhouette de face, pas de dos.
    --
    -- ⚠ `SetCameraLocation` et `SetCameraRotation` ne valent QUE hors possession
    -- d'un Character. Pendant la création le joueur n'a pas de corps (l'écran est
    -- modal), donc ils passent. Une fois en jeu ils seraient ignorés en silence.
    -- ── CADRAGE INITIAL, PUIS LE CLIENT PREND LA MAIN ─────────────────────
    --
    -- Le serveur pose la camera une fois, pour que le mannequin apparaisse
    -- cadre des la premiere image. Ensuite c'est le CLIENT qui l'orbite :
    -- `SetCameraLocation` est disponible des deux cotes, et faire un
    -- aller-retour reseau a chaque cran de molette donnerait une camera qui
    -- traine derriere le geste.
    --
    -- ⚠ UNE FOIS PAR SESSION, VRAIMENT (2026-09-14). Le commentaire ci-dessus le
    -- disait, le code reposait la camera a 300 cm DE FACE a CHAQUE reglage
    -- (visage, cheveux, vetement, curseur) : la camera sautait au cadrage de
    -- depart puis revenait quand l'orbite du client la replacait. Retour de jeu
    -- de Hanibes : « la camera recule quand je modifie mon personnage ».
    if (not s.apercu_cadre) then
        s.apercu_cadre = true
        player:SetCameraLocation(Vector(pos.X - APERCU.recul, pos.Y, pos.Z + APERCU.hauteur))
        player:SetCameraRotation(Rotator(APERCU.pitch, 0, 0))
    end

    -- L'ancre part au client : sans elle il ne peut pas calculer d'orbite,
    -- la position du mannequin dependant du nombre de joueurs en creation.
    Events.CallRemote("Narvos:ApercuOrbite", player, Reliability.Reliable, {
        x = pos.X, y = pos.Y, z = pos.Z,
        recul = APERCU.recul, hauteur = APERCU.hauteur, pitch = APERCU.pitch,
    })
end

--- Décode une charge venue du WebUI.
---
--- ── POURQUOI CE DÉTOUR ────────────────────────────────────────────────────────
--- Le pont **WebUI → Lua ne porte pas les objets JavaScript**. Il porte les
--- chaînes et les nombres ; un objet ne lève rien, l'événement n'arrive
--- simplement jamais. Observé en jeu le 2026-09-04 : sur les huit appels de
--- l'écran de création, les six qui passaient des chaînes fonctionnaient, et les
--- DEUX qui passaient un objet étaient morts — `Apercu` (aucun aperçu 3D, un
--- cylindre blanc à la place) et `CreerPerso` (bouton CRÉER sans effet).
---
--- ⚠ L'ASYMÉTRIE EST RÉELLE : le sens Lua → WebUI porte bien les tables. C'est
--- ainsi que partent les factions, les 17 corps et les 116 pièces. Ne pas en
--- déduire que l'inverse marche.
---
--- On accepte les DEUX formes : si une version de nanos se met à transporter les
--- objets, rien ne casse.
---@param params any
---@return table|nil
local function Decoder(params)
    if (type(params) == "table") then return params end
    if (type(params) ~= "string") then return nil end

    -- `JSON.parse` est documenté (`file.mdx`). Le `pcall` couvre le cas où la
    -- chaîne serait tronquée : mieux vaut un refus propre qu'une erreur qui
    -- remonte jusqu'au gestionnaire d'événement et tue l'abonnement.
    if (JSON == nil or JSON.parse == nil) then
        Console.Error("[NARVOS] JSON.parse indisponible — charge WebUI indecodable")
        return nil
    end

    local ok, decode = pcall(JSON.parse, params)
    if (not ok or type(decode) ~= "table") then return nil end
    return decode
end

Events.SubscribeRemote("Narvos:Apercu", function(player, params)
    params = Decoder(params)
    -- ⚠ TRACE AVANT LE GARDE. Sans elle, « aucun log » ne distingue pas
    -- « l'evenement n'arrive jamais » de « il arrive et le garde le refuse » —
    -- deux causes opposees. A retirer une fois l'apercu vu fonctionner.
    local s_diag = sessions[player]
    Console.Log(string.format("[NARVOS] Narvos:Apercu recu — etat=%s params=%s",
        tostring(s_diag and s_diag.etat or "AUCUNE SESSION"), type(params)))

    if (not SessionDans(player, ETATS.SELECTION)) then return end
    Session.MajApercu(player, params)
end)

-- ── Réception des actions du client ───────────────────────────────────────────

--- Session d'un joueur, si elle est dans l'état attendu.
--- Tout handler passe par là : c'est le garde unique qui empêche un client
--- modifié de sauter une étape.
--- ⚠ ASSIGNATION, pas `local function` : voir les déclarations avancées en tête.
SessionDans = function(player, etat_attendu)
    local s = sessions[player]
    if (not s) then return nil end
    if (s.etat ~= etat_attendu) then return nil end
    return s
end

--- Connexion par Steam, à la demande.
---
--- ⚠ CE GESTIONNAIRE MANQUAIT. La page émet `NarvosCreation:Steam` depuis son
--- bouton « Continuer » (creation/index.js:746) et PERSONNE ne l'écoutait : le
--- bouton était mort. Trouvé le 2026-09-04 en recensant les émetteurs de la page
--- face aux abonnés du Lua — un recensement qui a aussi révélé que les 25
--- abonnements de page étaient posés sur la mauvaise API.
---
--- `Session.Ouvrir` tente déjà cette connexion automatiquement. Ce chemin sert
--- au cas où elle a échoué à ce moment-là — Steam pas encore prêt, base
--- indisponible — et rend le bouton honnête au lieu de décoratif.
Events.SubscribeRemote("Narvos:ConnexionSteam", function(player)
    local s = SessionDans(player, ETATS.CONNEXION)
    if (not s) then return end

    local steam = SteamID(player)
    if (not steam) then
        Session.Envoyer(player, "Steam n'a pas fourni d'identifiant")
        return
    end
    if (not Comptes.Prete()) then
        Session.Envoyer(player, "Base des comptes indisponible")
        return
    end

    local compte = Comptes.ConnexionSteam(steam, player:GetName())
    if (not compte) then
        Session.Envoyer(player, "Connexion Steam refusee")
        return
    end

    s.compte = compte
    Session.AppliquerDroits(player, s)
    s.steam_pseudo = compte.pseudo
    s.etat = ETATS.SELECTION
    Session.Envoyer(player)
end)

Events.SubscribeRemote("Narvos:Connexion", function(player, identifiant, motdepasse)
    local s = SessionDans(player, ETATS.CONNEXION)
    if (not s) then return end

    -- ── Limitation de débit ──────────────────────────────────────────────────
    --
    -- PBKDF2 tourne à 1 000 itérations, ~200 fois moins que bcrypt à coût 12.
    -- Le débit est donc la seule barrière restante contre le dictionnaire.
    --
    -- ⚠ LA LIMITE VIT SUR LA SESSION, pas sur l'identifiant. C'est délibéré :
    -- la lier à l'identifiant permettrait à un tiers de bloquer le compte d'un
    -- autre en échouant exprès. Un attaquant qui se reconnecte repart à zéro,
    -- mais il paie une reconnexion complète à chaque cinq essais.
    s.limite = s.limite or Comptes.NouvelleLimite()

    local bloque, reste = Comptes.Bloque(s.limite, horloge)
    if (bloque) then
        Session.Envoyer(player, ("Trop de tentatives — reessayez dans %d s"):format(math.ceil(reste)))
        return
    end

    local compte, raison = Comptes.Connexion(identifiant, motdepasse)
    if (not compte) then
        Comptes.EnregistrerEchec(s.limite, horloge)
        Session.Envoyer(player, raison)
        return
    end

    Comptes.EnregistrerSucces(s.limite)
    s.compte = compte
    Session.AppliquerDroits(player, s)
    s.etat = ETATS.SELECTION
    Session.Envoyer(player)
end)

Events.SubscribeRemote("Narvos:Inscription", function(player, identifiant, motdepasse)
    local s = SessionDans(player, ETATS.CONNEXION)
    if (not s) then return end

    local compte, raison = Comptes.Inscrire(identifiant, motdepasse)
    if (not compte) then
        Session.Envoyer(player, raison)
        return
    end

    s.compte = compte
    Session.AppliquerDroits(player, s)
    s.etat = ETATS.SELECTION
    Session.Envoyer(player)
end)

Events.SubscribeRemote("Narvos:CreerPerso", function(player, params)
    params = Decoder(params)
    local s_diag = sessions[player]
    Console.Log(string.format("[NARVOS] Narvos:CreerPerso recu — etat=%s nom=%s",
        tostring(s_diag and s_diag.etat or "AUCUNE SESSION"),
        tostring(type(params) == "table" and params.nom or "?")))

    local s = SessionDans(player, ETATS.SELECTION)
    if (not s or not s.compte) then return end
    if (type(params) ~= "table") then
        Session.Envoyer(player, "Requete invalide")
        return
    end

    -- ⚠ Le compte vient de la SESSION, jamais de `params`. Sinon un client
    -- créerait des personnages sur le compte d'un autre.
    local perso, raison = Roster.Creer(s.compte.id, {
        nom      = params.nom,
        -- ⚠ La classe de JEU n'est PAS prise telle quelle du client : on la
        -- redérive de la classe de lore par le catalogue. Sinon un client modifié
        -- enverrait `class_id` et `lore_id` incohérents, et la fiche mentirait
        -- sur ses propres statistiques.
        class_id = Narvos.Factions.ClasseDeJeu(params.lore_id) or params.class_id,
        lore_id  = params.lore_id,
        genre    = params.genre,
        -- Le corps decide de la morphologie, donc des pieces portables.
        -- `Construire` le valide contre le catalogue et refuse un corps du
        -- mauvais genre : on peut le transmettre tel quel.
        corps    = params.corps,
        tenue    = params.tenue,
        -- Reglages de morphologie. Bornes et filtres par `Morphs.Resoudre` au
        -- moment de l'application : un identifiant inconnu est ignore, une
        -- valeur hors bornes est ramenee. Rien a valider ici.
        --
        -- La SILHOUETTE voyage dans cette meme table, prefixee `#`. Elle n'est
        -- pas un morph et ne passe pas par le meme chemin d'application, mais
        -- elle se persiste par le meme champ : deux colonnes pour deux tables de
        -- curseurs auraient double la migration sans rien separer d'utile.
        morphs   = params.morphs,
        -- Couleurs. Normalisees par `Apparence.Couleurs` a l'ecriture en base
        -- comme a l'application : une teinte mal formee retombe sur son defaut
        -- au lieu de devenir un noir silencieux.
        couleurs = params.couleurs,
        -- Apparence du Meta Customization System, normalisee contre le catalogue
        -- et le genre DEMANDE, puis encodee pour la colonne `metacustom`.
        metacustom = Narvos.MetaCustomLogic and Narvos.MetaCustomLogic.Encoder(
            Narvos.MetaCustomLogic.Normaliser(params.metacustom, params.genre)) or "",
    })

    if (not perso) then
        Console.Error("[NARVOS] creation refusee : " .. tostring(raison))
        Session.Envoyer(player, raison)
        return
    end

    Console.Log("[NARVOS] personnage cree : " .. tostring(perso.name))
    Session.Envoyer(player)
end)

Events.SubscribeRemote("Narvos:SupprimerPerso", function(player, id)
    local s = SessionDans(player, ETATS.SELECTION)
    if (not s or not s.compte) then return end

    local ok, raison = Roster.Supprimer(s.compte.id, id)
    Session.Envoyer(player, (not ok) and raison or nil)
end)

Events.SubscribeRemote("Narvos:ChoisirPerso", function(player, id)
    local s = SessionDans(player, ETATS.SELECTION)
    if (not s or not s.compte) then return end

    local perso = Roster.Trouver(id)

    -- ⚠ LA vérification qui compte : l'identifiant vient du client, et sans ce
    -- test n'importe qui entrerait en jeu avec le personnage d'un autre.
    if (not perso or perso.compte ~= s.compte.id) then
        Session.Envoyer(player, "Personnage introuvable")
        return
    end

    -- ⚠ ON N'ENTRE PLUS EN JEU ICI. Le personnage est retenu, et le joueur passe
    -- à l'écran des points de départ. C'est `Narvos:ChoisirDepart` qui fait
    -- naître le corps, une fois le monde choisi.
    --
    -- Le personnage est gardé dans `perso_attente` et NON dans `s.perso` :
    -- `s.perso` signifie « en jeu » pour tout le reste du serveur
    -- (`Session.De(player).perso` est lu par les émotes, le vestiaire, la roue).
    -- Le poser trop tôt rendrait un joueur encore à l'écran de choix
    -- indiscernable d'un joueur incarné.
    s.perso_attente = perso
    s.etat = ETATS.DEPART
    Session.Envoyer(player)
end)

--- Le joueur a choisi son monde de départ.
---
--- ⚠ TOUT EST REVALIDÉ ICI. L'identifiant vient du client ; `Depart.Retenu` le
--- confronte au catalogue ET à `Voyage.MondePraticable`, puis retombe sur le
--- défaut plutôt que de refuser. Un client modifié ne peut donc pas se faire
--- poser dans un monde absent du pack — où il tomberait sans fin, sans message.
Events.SubscribeRemote("Narvos:ChoisirDepart", function(player, monde_id)
    -- La garde d'état est la vraie sécurité : sans elle, ce message ferait
    -- naître un second corps à un joueur déjà en jeu.
    local s = SessionDans(player, ETATS.DEPART)
    if (not s or not s.perso_attente) then return end

    local retenu, repli = Narvos.Depart.Retenu(monde_id)
    if (not retenu) then
        -- Aucun monde praticable : le pack est cassé. On le DIT au lieu de poser
        -- le corps « quelque part ».
        Session.Envoyer(player, "Aucun monde n'est accessible pour l'instant")
        return
    end

    if (repli) then
        Console.Log(("[NARVOS] depart '%s' refuse pour %s -> repli sur '%s'")
            :format(tostring(monde_id), tostring(s.perso_attente.name), retenu))
    end

    local perso = s.perso_attente
    s.perso_attente = nil

    -- ── LA CITÉ EST CONSERVÉE (2026-09-15) ────────────────────────────────────
    -- Le monde retenu devient la cité du personnage : présélectionnée à la
    -- connexion suivante, et point de retour de `/revive` après la mort
    -- (Server/Reapparition.lua). Écrit AVANT l'entrée en jeu : une déconnexion
    -- pendant le spawn ne doit pas perdre le choix.
    if (perso.cite ~= retenu) then
        local ecrit, raison = Roster.EnregistrerCite(s.compte.id, perso.id, retenu)
        if (ecrit) then
            perso.cite = retenu
        else
            Console.Warn(("[NARVOS] cite '%s' non enregistree pour %s : %s")
                :format(retenu, tostring(perso.name), tostring(raison)))
        end
    end

    EntrerEnJeu(player, perso, retenu)
end)

-- ── Cycle de vie ──────────────────────────────────────────────────────────────

--- Ouvre une session. À appeler depuis `Player.Subscribe("Spawn")`, À LA PLACE
--- du spawn immédiat.
---@param player table
function Session.Ouvrir(player)
    sessions[player] = { etat = ETATS.CONNEXION, compte = nil, perso = nil }

    -- Les options ne changent pas d'un joueur à l'autre : un seul envoi, avant
    -- l'état, pour que l'interface ait de quoi s'afficher dès le premier rendu.
    Events.CallRemote("Narvos:Options", player, Reliability.Reliable, Options())

    -- Chemin Steam : si nanos nous donne un identifiant, le compte est trouvé ou
    -- créé sans que le joueur tape quoi que ce soit.
    local steam = SteamID(player)
    if (steam and Comptes.Prete()) then
        local compte = Comptes.ConnexionSteam(steam, player:GetName())
        if (compte) then
            sessions[player].compte = compte
            -- ⚠ LA QUATRIÈME VOIE DE CONNEXION. `AppliquerDroits` était appelée par
            -- les trois autres (bouton Steam, identifiant, inscription) mais PAS
            -- ici — la connexion AUTOMATIQUE, celle qu'emprunte presque tout le
            -- monde. Le Steam ID déclaré dans Config.toml n'était donc jamais
            -- appliqué : 124 connexions de Hanibes au journal, zéro ligne « est
            -- ADMINISTRATEUR » (mesuré le 2026-09-11).
            Session.AppliquerDroits(player, sessions[player])
            sessions[player].steam_pseudo = compte.pseudo
            sessions[player].etat = ETATS.SELECTION
        end
    end

    Console.Log(string.format("[NARVOS] session ouverte — etat=%s steam=%s compte=%s",
        tostring(sessions[player].etat), tostring(steam),
        tostring(sessions[player].compte and sessions[player].compte.id or "aucun")))

    Session.Envoyer(player)
end

--- Ferme une session. Sans ça, la table retiendrait le joueur et son compte.
function Session.Fermer(player)
    DetruireApercu(sessions[player])
    sessions[player] = nil
end

--- Session d'un joueur (lecture seule pour le reste du package).
function Session.De(player)
    return sessions[player]
end

--- Le joueur est-il entré en jeu ?
--- Les commandes de chat et les actions de gameplay doivent le vérifier : un
--- joueur encore à l'écran de sélection n'a pas de corps.
function Session.EnJeu(player)
    local s = sessions[player]
    return s ~= nil and s.etat == ETATS.EN_JEU
end

-- ══ DROITS D'ADMINISTRATION ═══════════════════════════════════════════════════
--
-- Qui peut editer la map generale et les zones d'administration. Le MODELE est
-- `Narvos.Droits` (pur, teste) ; ici on lit la config et on l'applique a la
-- connexion.
--
-- ⚠ LA SOURCE EST `Config.toml [custom_settings].admins_steam`, lue par
-- `Server.GetCustomSettings()`. PAS le Package.toml : chaque client le
-- telecharge. Config.toml ne quitte jamais la machine du serveur.
--
-- ⚠ LE CRITERE EST LE STEAM ID, JAMAIS LE PSEUDO : `pseudo` n'est pas unique en
-- base, et a la connexion Steam c'est le nom d'affichage — n'importe qui peut
-- s'appeler « Hanibes ».
--
-- ⚠ EN MEMOIRE SEULEMENT. On pose `est_admin` sur la session, on n'ecrit rien en
-- base : la config reste l'UNIQUE source. Retirer un identifiant de la liste
-- revoque le droit a la prochaine connexion, sans requete a lancer. Les droits
-- poses a la main en SQL restent valables, comme avant.
local reglages_lus, reglages = pcall(function() return Server.GetCustomSettings() end)
local ADMINS, admins_refus = Narvos.Droits.Ensemble(reglages_lus and reglages or nil)

Console.Log(("Droits : %d administrateur(s) Steam declare(s) (Config.toml [custom_settings].admins_steam)")
    :format(Narvos.Droits.Compte(ADMINS)))
for _, raison in ipairs(admins_refus) do
    -- Un identifiant mal ecrit doit se VOIR ici, pas se traduire plus tard par
    -- un « je ne suis pas admin » que personne ne sait expliquer.
    Console.Warn("Droits : valeur REFUSEE dans admins_steam — " .. tostring(raison))
end
if (not reglages_lus) then
    Console.Warn("Droits : Server.GetCustomSettings a echoue — AUCUN administrateur (ferme par defaut)")
end

--- Pose le droit d'administration sur la session si le Steam ID est declare.
--- Appelee par les TROIS voies de connexion (Steam, identifiant, inscription) :
--- en oublier une donnerait un admin qui perd ses droits selon la facon dont il
--- s'est connecte.
---@param player table
---@param s table  la session, `s.compte` deja pose
---@return boolean
function Session.AppliquerDroits(player, s)
    if (not s or not s.compte) then return false end
    local lu, steam = pcall(function() return player:GetSteamID() end)
    if (not lu or not Narvos.Droits.EstAdmin(steam, ADMINS)) then return false end
    s.compte.est_admin = 1
    Console.Log("Droits : " .. tostring(s.compte.pseudo) .. " (" .. tostring(steam)
        .. ") est ADMINISTRATEUR")
    return true
end

Session.ETATS = ETATS

return Session