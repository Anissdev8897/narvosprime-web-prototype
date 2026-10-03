-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Vestiaire.lua — le tailleur et la garde-robe.
--
-- Câblage : Package.Require("Server/Vestiaire.lua") depuis Server/Index.lua,
-- APRÈS Server/Session.lua — ce module lit la session pour savoir quel
-- personnage le joueur incarne.
--
-- ── CE QUE LE CLIENT N'ENVOIE JAMAIS ──────────────────────────────────────────
-- Ni le prix, ni son solde, ni la famille de son corps, ni l'identifiant de son
-- personnage. Tout cela vient de la SESSION, côté serveur. Le client n'envoie
-- que deux choses : quelle pièce, et dans quel slot.
--
-- Ce n'est pas de la prudence de principe. Le prix est calculé par
-- `Vestiaire.Prix`, et le laisser voyager permettrait d'acheter à zéro ; la
-- famille décide de la compatibilité des volumes, et la laisser voyager
-- permettrait de porter une armure Trooper sur un corps Stylized.
--
-- ── L'ORDRE DES ÉCRITURES ─────────────────────────────────────────────────────
-- On persiste AVANT de rhabiller. Une base qui refuse l'écriture doit laisser le
-- joueur tel qu'il était : l'inverse lui montrerait une pièce qu'il perdrait à
-- la reconnexion, ce qui est le pire des deux.
-- ═══════════════════════════════════════════════════════════════════════════════

local VestiaireServeur = {}

local Logique = Narvos.Vestiaire
local Modular = Narvos.Modular
local Roster = Narvos.Roster
local Session = Narvos.SessionServeur
local Builder = Narvos.CharacterBuilder

--- Délai minimal entre deux opérations de garde-robe, en millisecondes.
--- Un achat écrit en base : sans plafond de cadence, une touche maintenue
--- enverrait des dizaines d'UPDATE par seconde.
VestiaireServeur.DELAI_MS = 200

-- ── État ──────────────────────────────────────────────────────────────────────
--
-- ⚠ DÉCLARÉS EN TÊTE. Le `Player.Subscribe("Destroy")` écrit plus bas s'exécute
-- au chargement du fichier : un `local` posé après lui se résoudrait en GLOBAL
-- nil. Piège rencontré cinq fois sur ce projet.

--- Dernière opération par joueur, en millisecondes du compteur de package.
local derniere = {}

--- Apparence MetaHuman à écrire en base, par joueur : { compte_id, perso_id,
--- ligne, echeance_ms }. Voir « Apparence du Meta Customization System » plus bas.
local apparences_a_ecrire = {}

--- Compteur monotone. `os.time()` est en SECONDES : il ne distinguerait pas
--- deux clics séparés de 200 ms.
local horloge_ms = 0
Timer.SetInterval(function() horloge_ms = horloge_ms + 100 end, 100)

-- ── Résolution du personnage ──────────────────────────────────────────────────

--- Rend tout ce dont les opérations ont besoin, ou nil et une raison.
---
--- Ramassé en un seul endroit parce que les trois gestionnaires ont exactement
--- les mêmes préalables. Les répéter aurait fini par en oublier un.
---@param player table
---@return table|nil  { compte_id, perso, corps, famille, genre, character }
---@return string|nil raison
local function Contexte(player)
    local s = Session.De(player)
    if (not s or not s.compte) then return nil, "Non connecte" end
    if (not s.perso) then return nil, "Aucun personnage" end

    local corps = Modular.Corps(s.perso.corps)
    if (not corps) then return nil, "Ce personnage n a pas de corps modulaire" end

    return {
        compte_id = s.compte.id,
        perso = s.perso,
        corps = corps,
        famille = corps.famille,
        genre = corps.genre,
        character = player:GetControlledCharacter(),
    }, nil
end

--- Garde-robe du personnage courant, toujours sous forme normalisée.
--- `Roster` la rend déjà décodée, mais un personnage créé avant la garde-robe
--- n'en a pas : `Charger(nil)` donne alors une table vide plutôt que nil.
local function GardeRobeDe(ctx)
    return Logique.Charger(ctx.perso.gardeRobe)
end

--- Cadence. Rend faux quand l'opération arrive trop tôt.
local function CadenceOk(player)
    local precedente = derniere[player]
    if (precedente and (horloge_ms - precedente) < VestiaireServeur.DELAI_MS) then
        return false
    end
    derniere[player] = horloge_ms
    return true
end

-- ── Envoi de l'état ───────────────────────────────────────────────────────────

--- Pousse vers le client tout ce que l'écran affiche.
---
--- Le stock est recalculé à chaque ouverture plutôt que mis en cache : il dépend
--- de la famille et du genre, donc du personnage, et un cache par joueur serait
--- une occasion de servir le stock d'un autre.
---@param player table
---@param message? string  retour d'une action, affiché en bandeau
function VestiaireServeur.Envoyer(player, message)
    local ctx, raison = Contexte(player)
    if (not ctx) then
        Events.CallRemote("Narvos:Vestiaire:Etat", player, Reliability.Reliable,
            { erreur = raison })
        return
    end

    local garde_robe = GardeRobeDe(ctx)

    -- `possede` part en LISTE. Une table Lua indexée par chaîne traverse le pont
    -- vers le WebUI comme un objet, ce qui marche, mais une liste se parcourt
    -- pareil des deux côtés et évite d'avoir à deviner la forme reçue.
    local possedes = {}
    for id in pairs(garde_robe.possede) do possedes[#possedes + 1] = id end
    table.sort(possedes)

    Events.CallRemote("Narvos:Vestiaire:Etat", player, Reliability.Reliable, {
        slots = Modular.SLOTS,
        stock = Logique.Stock(ctx.famille, ctx.genre),
        possede = possedes,
        porte = garde_robe.porte,
        credits = tonumber(ctx.perso.credits) or 0,
        famille = ctx.famille,
        genre = ctx.genre,
        message = message,
    })
end

-- ── Rhabillage du personnage vivant ───────────────────────────────────────────

--- Réapplique l'apparence et la garde-robe sur le corps possédé.
---
--- Un seul appel à `Habiller` : l'apparence et les vêtements partagent les mêmes
--- slots, et deux appels successifs se retireraient l'un l'autre puisque
--- `AddSkeletalMeshAttached` écrase l'identifiant de slot.
local function Rhabiller(ctx, garde_robe)
    if (not ctx.character or not ctx.character:IsValid()) then return end

    -- ⚠ LES MORPHS ET LES COULEURS DOIVENT REPASSER À CHAQUE FOIS. Cet appel
    -- les omettait : `Habiller` recevait `nil`, et `Morphs.Resoudre(nil)` rend
    -- une table vide — aucun morph n'était réappliqué, mais les pièces venaient
    -- d'être RÉ-ATTACHÉES, donc leur matériau était neuf et sans teinte. Acheter
    -- une chemise remettait donc le visage au neutre et effaçait les couleurs.
    -- Rien ne le signalait : le personnage changeait, c'était l'effet attendu.
    local tenue = Logique.Tenue(ctx.perso.apparence or ctx.perso.tenue, garde_robe)
    -- Même règle pour l'apparence MetaHuman : un rhabillage sans elle re-posait le
    -- Blueprint nu (identité et vêtements par défaut).
    local metacustom = Narvos.MetaCustomLogic and Narvos.MetaCustomLogic.Normaliser(
        Narvos.MetaCustomLogic.Decoder(ctx.perso.metacustom), ctx.corps and ctx.corps.genre) or nil
    local ok, raison = Builder.Habiller(
        ctx.character, ctx.corps, tenue, ctx.perso.morphs, ctx.perso.colors, metacustom)
    if (not ok) then
        Console.Error("[NARVOS] vestiaire : rhabillage refuse — " .. tostring(raison))
    end
end

-- ── Achat ─────────────────────────────────────────────────────────────────────

--- Achète une pièce pour le personnage courant.
---@param player table
---@param piece_id string
function VestiaireServeur.Acheter(player, piece_id)
    if (type(piece_id) ~= "string" or piece_id == "") then return end
    if (not CadenceOk(player)) then return end

    local ctx, raison = Contexte(player)
    if (not ctx) then return VestiaireServeur.Envoyer(player, raison) end

    local credits = tonumber(ctx.perso.credits) or 0
    local neuve, reste = Logique.Acheter(
        GardeRobeDe(ctx), credits, piece_id, ctx.famille, ctx.genre)

    -- En cas de refus, `reste` porte la raison. Le contrat de la fonction pure
    -- réunit les deux dans le même retour : nil + raison, ou table + solde.
    if (not neuve) then
        return VestiaireServeur.Envoyer(player, tostring(reste))
    end

    -- Persister AVANT de modifier la session : si la base refuse, le joueur
    -- garde son solde et rien n'a bougé.
    local ok, pourquoi = Roster.MajGardeRobe(ctx.compte_id, ctx.perso.id, neuve, reste)
    if (not ok) then
        return VestiaireServeur.Envoyer(player, pourquoi or "Enregistrement impossible")
    end

    ctx.perso.gardeRobe = neuve
    ctx.perso.credits = reste

    local piece = Modular.PIECES[piece_id]
    VestiaireServeur.Envoyer(player, "Achete : " .. (piece and piece.label or piece_id))
end

-- ── Port ──────────────────────────────────────────────────────────────────────

--- Équipe ou retire une pièce.
---@param player table
---@param slot string
---@param piece_id string|nil  chaîne vide ou nil pour retirer
function VestiaireServeur.Porter(player, slot, piece_id)
    if (type(slot) ~= "string" or slot == "") then return end
    if (not CadenceOk(player)) then return end

    -- Le pont WebUI ne porte pas nil : un slot vidé arrive en chaîne vide.
    -- Le traduire ici évite que la logique pure ait à connaître ce détail de
    -- transport.
    if (piece_id == "") then piece_id = nil end

    local ctx, raison = Contexte(player)
    if (not ctx) then return VestiaireServeur.Envoyer(player, raison) end

    local neuve, pourquoi = Logique.Porter(
        GardeRobeDe(ctx), slot, piece_id, ctx.famille, ctx.genre)
    if (not neuve) then
        return VestiaireServeur.Envoyer(player, tostring(pourquoi))
    end

    local credits = tonumber(ctx.perso.credits) or 0
    local ok, echec = Roster.MajGardeRobe(ctx.compte_id, ctx.perso.id, neuve, credits)
    if (not ok) then
        return VestiaireServeur.Envoyer(player, echec or "Enregistrement impossible")
    end

    ctx.perso.gardeRobe = neuve
    Rhabiller(ctx, neuve)

    VestiaireServeur.Envoyer(player, nil)
end

-- ── Apparence du Meta Customization System, EN JEU (2026-09-14) ───────────────
--
-- Retour de jeu de Hanibes : « un seul menu d'équipement accessible en jeu ».
-- Le corps MetaHuman s'habille par le système acheté — vêtements, coiffure,
-- visage, peau, yeux, corps — et l'éditeur qui le règle existait DÉJÀ, pour la
-- création (Client/UI/mcs-editeur.js, écrit « partagé avec le menu en jeu »).
-- Il est désormais servi aussi dans l'inventaire, onglet APPARENCE. La logique
-- ne change pas : `MetaCustomLogic.Normaliser` borne tout, `Encoder` écrit la
-- colonne `metacustom`, `MetaHumainBP.Apparence` montre (valeur synchronisée).
--
-- ── MONTRER TOUT DE SUITE, ÉCRIRE APRÈS LE DERNIER GESTE ─────────────────────
-- Une glissière tirée émet une apparence toutes les 120 ms. Une écriture en base
-- par pas serait des dizaines d'UPDATE par seconde ; la cadence du vestiaire
-- (200 ms) en PERDRAIT, dont peut-être la dernière — celle que le joueur voulait.
-- On montre chaque proposition, et on écrit la plus récente quand les gestes
-- cessent (`DELAI_ECRITURE_APPARENCE_MS`), ou à la déconnexion.

VestiaireServeur.DELAI_ECRITURE_APPARENCE_MS = 1500

--- Taille maximale d'une apparence reçue du WebUI, en octets. Une apparence
--- réelle pèse ~2 Ko ; au-delà, c'est une charge fabriquée.
VestiaireServeur.TAILLE_MAX_APPARENCE = 16000

--- Écrit l'apparence en attente d'un joueur. Rend true si rien n'attendait ou
--- si l'écriture a réussi.
---@param player table
---@return boolean
local function EcrireApparence(player)
    local attente = apparences_a_ecrire[player]
    if (not attente) then return true end
    apparences_a_ecrire[player] = nil
    local ok, raison = Roster.MajMetaCustom(attente.compte_id, attente.perso_id, attente.ligne)
    if (not ok) then
        Console.Error("[NARVOS] apparence non enregistree : " .. tostring(raison))
        if (player and player:IsValid()) then
            Events.CallRemote("Narvos:Apparence", player, Reliability.Reliable,
                { enregistre = false, message = "Apparence NON enregistree : " .. tostring(raison) })
        end
    end
    return ok == true
end

Timer.SetInterval(function()
    for player, attente in pairs(apparences_a_ecrire) do
        if (horloge_ms >= attente.echeance_ms) then EcrireApparence(player) end
    end
end, 250)

--- Pousse au client l'éditeur d'apparence : options du genre et apparence
--- courante, ou la raison pour laquelle ce corps ne se règle pas ici.
---@param player table
---@param message string|nil
function VestiaireServeur.EnvoyerApparence(player, message)
    local L = Narvos.MetaCustomLogic
    local ctx, raison = Contexte(player)
    if (not ctx or not L) then
        Events.CallRemote("Narvos:Apparence", player, Reliability.Reliable,
            { disponible = false, message = raison or "Apparence indisponible" })
        return
    end
    -- Un corps MODULAIRE (anciens personnages) garde sa garde-robe à pièces :
    -- la page propose alors de l'ouvrir, sans second éditeur.
    if (not ctx.corps.blueprint) then
        Events.CallRemote("Narvos:Apparence", player, Reliability.Reliable, {
            disponible = false, garde_robe = true,
            message = "Ce corps s'habille piece par piece, dans la garde-robe.",
        })
        return
    end
    Events.CallRemote("Narvos:Apparence", player, Reliability.Reliable, {
        disponible = true,
        options = L.Options(ctx.genre),
        apparence = L.Normaliser(L.Decoder(ctx.perso.metacustom), ctx.genre),
        message = message,
    })
end

--- Applique une apparence proposée par l'éditeur en jeu.
---@param player table
---@param texte any  apparence en JSON (le pont WebUI -> Lua ne porte pas les objets)
function VestiaireServeur.ChangerApparence(player, texte)
    if (type(texte) ~= "string" or #texte > VestiaireServeur.TAILLE_MAX_APPARENCE) then return end
    local L = Narvos.MetaCustomLogic
    local ctx = Contexte(player)
    if (not ctx or not L or not ctx.corps.blueprint) then return end
    if (not ctx.character or not ctx.character:IsValid()) then return end

    local ok_json, proposee = pcall(JSON.parse, texte)
    if (not ok_json or type(proposee) ~= "table") then return end

    -- Le GENRE du corps fait foi, jamais celui de la proposition.
    local apparence = L.Normaliser(proposee, ctx.genre)
    if (not apparence) then return end
    local ligne = L.Encoder(apparence)
    if (ligne == ctx.perso.metacustom) then return end

    ctx.perso.metacustom = ligne
    if (Narvos.MetaHumainBP) then Narvos.MetaHumainBP.Apparence(ctx.character, apparence) end
    apparences_a_ecrire[player] = {
        compte_id = ctx.compte_id, perso_id = ctx.perso.id, ligne = ligne,
        echeance_ms = horloge_ms + VestiaireServeur.DELAI_ECRITURE_APPARENCE_MS,
    }
end

-- ── Événements ────────────────────────────────────────────────────────────────

Events.SubscribeRemote("Narvos:Apparence:Ouvrir", function(player)
    VestiaireServeur.EnvoyerApparence(player, nil)
end)

Events.SubscribeRemote("Narvos:Apparence:Changer", function(player, texte)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "inventaire")) then return end
    VestiaireServeur.ChangerApparence(player, texte)
end)

Events.SubscribeRemote("Narvos:Vestiaire:Ouvrir", function(player)
    VestiaireServeur.Envoyer(player, nil)
end)

Events.SubscribeRemote("Narvos:Vestiaire:Acheter", function(player, piece_id)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "inventaire")) then return end
    VestiaireServeur.Acheter(player, piece_id)
end)

Events.SubscribeRemote("Narvos:Vestiaire:Porter", function(player, slot, piece_id)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "inventaire")) then return end
    VestiaireServeur.Porter(player, slot, piece_id)
end)

-- Le compteur de cadence est indexé par joueur : sans purge, la table grossirait
-- à chaque déconnexion et retiendrait des entités mortes.
Player.Subscribe("Destroy", function(player)
    derniere[player] = nil
    -- Le dernier réglage d'apparence part en base AVANT d'oublier le joueur.
    EcrireApparence(player)
end)

return VestiaireServeur