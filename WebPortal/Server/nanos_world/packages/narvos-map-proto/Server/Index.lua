-- ═══════════════════════════════════════════════════════════════════════════════
-- NARVOS — prototype iso, côté serveur.
--
-- Ce n'est plus une démo de caméra : la boucle utilise le VRAI contenu NARVOS.
--   · les 4 classes du catalogue TS (stats, élément, couleur de tenue)
--   · le loot procédural par zone (spore / space / forge)
--   · l'inventaire porté depuis le TS (grille, empilement, crédits)
--
-- Le package `narvos` exporte la table globale `Narvos` (Package.Export). Elle
-- est donc lisible ici SANS import — à condition que narvos soit chargé avant,
-- ce que garantit `packages_requirements = ["narvos"]` dans Package.toml.
--
-- Aucun asset pack n'est requis : uniquement des assets `nanos-world::`.
--
-- ── UNITÉS ─────────────────────────────────────────────────────────────────────
-- nanos hérite des unités Unreal : 1 unité = 1 cm. Toutes les distances ci-dessous
-- sont écrites en mètres puis converties, parce que les métriques du projet
-- (skill narvos-level-design) sont en mètres et qu'un nombre nu en centimètres
-- ne se relit pas.
-- ═══════════════════════════════════════════════════════════════════════════════

local M = 100.0   -- 1 mètre

-- Métriques mesurées du projet (skill narvos-level-design §2). Elles servent à
-- dimensionner les repères : un espace ne se juge pas dans l'absolu, il se juge
-- contre la taille du joueur et sa portée de saut.
local METRIQUES = {
    taille_joueur       = 1.80 * M,
    portee_saut_marche  = 1.80 * M,
    portee_saut_course  = 3.38 * M,
}

local config = Server.GetMapConfig() or {}

local ISO = {
    pitch      = config.iso_pitch or -50.0,
    yaw        = config.iso_yaw or 45.0,
    arm_length = config.iso_arm_length or 2200.0,
    arm_min    = config.iso_arm_min or 700.0,
    arm_max    = config.iso_arm_max or 3600.0,
}

-- ── Terrain de jeu ─────────────────────────────────────────────────────────────

-- ── SERVICES DE JEU : AKARLYS ─────────────────────────────────────────────────
--
-- Depuis le 2026-09-06 les quatre mondes sont des sous-niveaux de `Map_Narvos`,
-- separes dans l'espace : l'orbite occupe l'origine, la Forge est a 80 km de la.
-- Tout ce que ce fichier posait autour de `Vector(0, 0, SOL_Z)` — pads de
-- classe, coffres, zones de loot, armurier, reperes d'echelle — atterrissait
-- donc au milieu du hub orbital, dans le vide.
--
-- D5 (18/09/2026) : la Forge est retiree temporairement. Les services autrefois
-- poses autour d'elle (pads, marchands, armurier, coffres, ateliers, gisements)
-- suivent tous UNE ancre commune, maintenant l'arrivee mesuree d'Akarlys.
-- Aucun jeu de coordonnees n'est recopie.
local MONDE_SERVICES_ID = "capitale"
local ANCRE = (Narvos.Mondes.Trouver(MONDE_SERVICES_ID) or {}).arrivee or Vector()

-- Le sol de l'aire de services. `ANCRE` porte le sol PLUS UN METRE :
-- Landscape, voir le pave ci-dessous) : un objet pose « au sol » se place donc
-- a `SOL_SERVICES + hauteur`, pas a `ANCRE.Z + hauteur`, qui le ferait flotter a
-- un metre.
--
-- ⚠ POURQUOI CETTE CONSTANTE EXISTE — incident du 2026-09-10. Quatre `Prop`
-- gardaient un Z ABSOLU (5, 25, 40, 90), ecrit quand le sol valait 0 et que
-- tout vivait a l'origine. Leurs X et Y avaient suivi le deplacement vers la
-- Forge, pas leur Z : les repères des pads de classe et les repères d'echelle
-- etaient enterres a 1,46 km SOUS le terrain, pendant que leurs declencheurs,
-- eux, etaient au bon endroit. Des pads invisibles — la « fausse affordance »
-- que leur propre commentaire disait empecher. Le garde qui ferme la forme :
-- `scripts/lua-harness/z-absolu-check.mjs`.
local SOL_SERVICES = ANCRE.Z - 1.0 * M

-- ⚠ RELATIF A L'ANCRE, plus absolu. `ANCRE` porte deja la hauteur du sol plus
-- un metre (raycast au centre du Landscape) : y rajouter 100 mettrait tout le
-- mobilier a deux metres au-dessus du terrain.
local SOL_Z = 0.0
local RAYON_SPAWN = 12.0 * M
local RAYON_PADS = 8.0 * M
local RAYON_ZONES = 20.0 * M
local RAYON_MARCHANDS = 15.0 * M   -- entre le cercle de spawn (12 m) et les coffres (20 m)

-- Une zone de loot par pool du catalogue. Les clés DOIVENT exister dans
-- Narvos.LootLogic.ZONE_POOLS — sinon RollLoot retombe silencieusement sur
-- `forge` et les trois coffres donnent le même butin sans qu'on le voie.
local ZONES = {
    { id = "spore", nom = "Spore",  couleur = Color(0.2, 0.9, 0.3), niveau = 5  },
    { id = "space", nom = "Espace", couleur = Color(0.3, 0.5, 1.0), niveau = 15 },
    { id = "forge", nom = "Forge",  couleur = Color(1.0, 0.5, 0.1), niveau = 25 },
}

local DELAI_RECHARGE = 8000    -- ms avant qu'un coffre redonne du butin

-- ── État ───────────────────────────────────────────────────────────────────────

-- Inventaire par joueur. Clé = Player, valeur = grille de Narvos.Inventory.
--
-- ⚠ EN MÉMOIRE, MAIS PLUS ÉPHÉMÈRE. Ce commentaire disait « la persistance
-- viendra quand le format sera figé » — elle est arrivée le 2026-09-06 : le sac
-- est chargé au spawn depuis `perso.inventaire` et réécrit à la déconnexion.
-- Cette table reste la copie de travail, la base fait foi entre deux sessions.
local inventaires = {}

--- Équipement PORTÉ par joueur (emplacements de `Narvos.Inventory`), à côté du sac.
---
--- ⚠ IL ÉTAIT SAUVÉ VIDE : `EnregistrerSac` écrivait `equipment = {}` à chaque
--- sauvegarde, et rien ne le chargeait. Depuis le 2026-09-14 (inventaire de la
--- maquette « Inventaire NARVOS »), il est relu au spawn depuis
--- `perso.inventaire.equipment` et réécrit avec le sac.
local equipements = {}

--- Arme suivante dans le cycle, par joueur.
---
--- ⚠ DECLAREE ICI, avec les autres tables par joueur, et PAS a son premier
--- usage 660 lignes plus bas. En Lua un `local` n'existe qu'a partir de sa
--- ligne : le gestionnaire Player "Destroy" qui la purge se trouve AVANT, et
--- `arme_suivante[player] = nil` y indexait un GLOBAL nil — il levait a chaque
--- deconnexion. Cinquieme occurrence de ce piege dans la session ; les tables
--- par joueur se declarent donc ensemble, en tete, et se purgent ensemble.
--- Trouve par audit le 2026-09-03.
local arme_suivante = {}

--- Atelier courant du joueur, et gisement survole.
---
--- ⚠ DECLARES ICI, PAS PRES DE LEUR USAGE. Ils etaient `local` aux lignes 613
--- et 719, donc APRES le gestionnaire de deconnexion qui les purge (l. 500).
--- Un nom employe avant son `local` se resout en GLOBAL nil : `nil[player]`
--- LEVE, et tout ce qui suit dans le gestionnaire etait saute — dont la purge
--- de `arme_suivante`, elle-meme ajoutee pour colmater une fuite. Trouve par
--- `portee-check.mjs` le 2026-09-07.
local atelier_du_joueur = {}
local gisement_proche = {}   -- player -> gisement_id (dernier node survole)
local gisement_positions = {} -- gisement_id -> Vector (position world du node, pour le radar)
local marchand_proche = {}   -- player -> entrée de Merchants.MERCHANTS (dernier marchand survolé)

-- Classe attribuée en tour de rôle, pour que les 4 soient visibles à l'écran
-- sans avoir à se reconnecter quatre fois.
local prochaine_classe = 1

local zones_pretes = {}        -- [zone_id] = true si le coffre peut redonner

-- ── Envois vers l'interface ────────────────────────────────────────────────────
--
-- ⚠ DÉFINIES ICI, EN HAUT, ET PAS AVEC LE RESTE DU PONT D'INTERFACE. En Lua, une
-- `local function` n'existe qu'à partir de sa ligne : déclarées plus bas, elles
-- seraient `nil` au moment où `SpawnPersonnage` les appelle, et le spawn
-- échouerait sur un « attempt to call a nil value ». C'est le même piège que le
-- CLAUDE.md du dépôt documente pour RpgGameWorld.
--
-- Le serveur POUSSE l'état ; le client se contente d'afficher. L'alternative —
-- le client demande, le serveur répond — ajoute un aller-retour à chaque
-- ouverture de panneau et montre un inventaire vide le temps qu'il revienne.

--- Aplatit une grille d'inventaire en liste affichable.
--- L'interface rend une liste, pas une grille : lui envoyer les coordonnées
--- ferait passer des champs que personne ne lit.
---@param grille table
---@return table
local function InventaireAffichable(player)
    -- ⚠ `Narvos.SessionServeur` et non `Session` : ce `local` est déclaré plus bas
    -- dans le fichier, et ici il se résoudrait en GLOBAL nil.
    local s = Narvos.SessionServeur and Narvos.SessionServeur.De(player) or nil
    local perso = s and s.perso or nil
    -- La vue est calculée par `Logic/InventaireVue.lua` (onglets, emplacements,
    -- fiche) : elle garde `objets[].id/nom/quantite/rarete`, que lisent aussi la
    -- boutique (echanges.js) et l'ancien rendu.
    return Narvos.InventaireVue.Construire(
        { grid = inventaires[player], equipment = equipements[player] or {} },
        {
            credits = perso and perso.credits or 0,
            statistiques = Narvos.ProgressionServeur and Narvos.ProgressionServeur.Statistiques(player) or nil,
            est_arme = function(id)
                return Narvos.Roue ~= nil and Narvos.Roue.ARME_PAR_ITEM ~= nil and Narvos.Roue.ARME_PAR_ITEM[id] ~= nil
            end,
            utilisable = function(id)
                local d = Narvos.Inventory.GetItemDef(id)
                local e = d and d.useEffect
                return e ~= nil and ((tonumber(e.heal) or 0) > 0 or (tonumber(e.mana) or 0) > 0)
            end,
        })
end

--- Bonus de stats de l'équipement porté (somme des définitions), pour la
--- progression et le combat. Table vide sans équipement.
---@param player table
---@return table
Narvos.EquipementDe = function(player)
    return Narvos.Inventory.GetEquippedStats(equipements[player] or {})
end

--- Envoie la roue d'objets. DÉCLARÉE avant `EnvoyerInventaire` et assignée
--- juste après : l'inventaire la pousse à chaque envoi, pour que la roue suive
--- le sac dès qu'il change (potion bue, vente, ramassage) sans qu'aucun des
--- appelants d'`EnvoyerInventaire` ait à y penser. En Lua un `local` n'existe
--- qu'à partir de sa ligne — d'où la déclaration avancée plutôt qu'une fonction
--- posée plus bas, qui se résoudrait en GLOBAL nil.
local EnvoyerRoue

--- Envoie l'inventaire d'un joueur à son interface.
--- `inventaires` est déclarée juste au-dessus, dans la section État : cette
--- fonction la voit donc directement, sans indirection.
local function EnvoyerInventaire(player)
    if (not player) then return end
    Events.CallRemote("Narvos:Inventaire", player, Reliability.Reliable,
        InventaireAffichable(player))
    EnvoyerRoue(player)
end

--- Les assignations sont PAR PERSONNAGE : sans session ouverte la roue est
--- vide, et l'interface affiche ses cinq cases libres.
EnvoyerRoue = function(player)
    if (not player or not Narvos.Roue) then return end
    local s = Narvos.SessionServeur and Narvos.SessionServeur.De(player) or nil
    local perso = s and s.perso or nil
    Events.CallRemote("Narvos:Roue", player, Reliability.Reliable,
        Narvos.Roue.Vue(inventaires[player], perso and perso.id or nil))
end

--- Envoie les classes jouables et celle qu'incarne le joueur.
--- `Creation.Options()` est la source : le menu affiche exactement ce que
--- l'écran de création proposerait, sans seconde liste à tenir à jour.
local function EnvoyerClasses(player)
    if (not player) then return end

    local character = player:GetControlledCharacter()
    Events.CallRemote("Narvos:Classes", player, Reliability.Reliable, {
        classes  = Narvos.Creation.Options().classes,
        actuelle = character and character:GetValue("narvos_class") or nil,
    })
end

-- ── Utilitaires ────────────────────────────────────────────────────────────────

--- Retrouve le joueur qui contrôle un Character.
--- Il n'existe pas d'accès inverse documenté et vérifié ; on balaye les joueurs
--- et on compare le personnage contrôlé, qui l'est (`GetControlledCharacter`).
---@param acteur table
---@return table|nil
local function JoueurDe(acteur)
    if (not acteur) then return nil end
    for _, player in ipairs(Player.GetAll()) do
        if (player:GetControlledCharacter() == acteur) then return player end
    end
    return nil
end

--- Position sur un cercle, en partant du nord et en tournant dans le sens horaire.
---@param index integer  1-based
---@param total integer
---@param rayon number
---@param z number
---@return table Vector
local function SurCercle(index, total, rayon, z)
    local angle = (index - 1) * (2 * math.pi / total) - math.pi / 2
    return Vector(ANCRE.X + math.cos(angle) * rayon,
                  ANCRE.Y + math.sin(angle) * rayon,
                  ANCRE.Z + z)
end

--- Un point de l'aire de services d'Akarlys, en coordonnees monde.
--- Meme role que `SurCercle` pour les emplacements qui ne sont pas sur un cercle.
---@param dx number
---@param dy number
---@param dz number
---@return table
local function PresDe(dx, dy, dz)
    return Vector(ANCRE.X + dx, ANCRE.Y + dy, ANCRE.Z + dz)
end

-- ── Personnage ─────────────────────────────────────────────────────────────────

--- Applique la vue isométrique.
--- SetCameraMode appartient au Character, la distance et l'angle au Player —
--- d'où les deux objets en paramètres.
local function AppliquerVueIso(player, character)
    -- FPSTPS et non TPSOnly : `SetCameraMode` est SERVEUR, et c'est lui qui
    -- AUTORISE la première personne. Le client peut ensuite basculer seul
    -- (`SetViewMode` est network-authority), mais pas si le serveur l'a
    -- interdit — TPSOnly rendait la touche F3 inopérante sans rien dire.
    character:SetCameraMode(CameraMode.FPSTPS)

    -- ⚠ PAS de SetViewMode(ViewMode.TopDown). Mesuré le 2026-09-02 : avec
    -- TopDown, un bras réglé à 2200 (22 m) donnait une vue d'environ 200 m de
    -- large — le personnage faisait quelques pixels. TopDown impose son propre
    -- cadrage et ignore SetCameraArmLength. Ni la doc ni Character.json ne le
    -- disent ; c'est la mesure à l'écran qui l'établit.
    --
    -- On fabrique donc l'isométrie en TPS : pitch fort + bras contrôlé. Moins
    -- « officiel », mais c'est le seul montage où la distance nous obéit — et
    -- la distance est justement ce qu'on doit régler.

    -- `force = true` : sans lui la valeur est interpolée depuis la distance
    -- courante et le premier cadrage arrive en glissant.
    player:SetCameraArmLength(ISO.arm_length, true)
    player:SetCameraRotation(Rotator(ISO.pitch, ISO.yaw, 0))
end

-- ⚠ DECLAREE ICI, avant ses appelants. Elle vivait 340 lignes plus bas :
-- `AnnoncerClasse` (choix de classe) et `VerserButin` (ouverture d'un
-- coffre) la resolvaient donc en GLOBALE nil, et levaient
-- « attempt to call a nil value » a la premiere utilisation.
-- Trouve par scripts/lua-harness/portee-check.mjs le 2026-09-03.
--- Neutralise les balises de texte riche dans une chaine venant du joueur.
---
--- ⚠ `Chat.BroadcastMessage` interprete `<cyan>`, `<yellow>`, `</>`... Or
--- `player:GetName()` est controle par le CLIENT : un pseudo contenant `</>` ou
--- `<red>` deforme les messages de tout le serveur, et rien ne l'empeche.
--- Trouve par audit le 2026-09-03.
---
--- On remplace `<` par une parenthese plutot que de l'echapper : nanos n'expose
--- aucune sequence d'echappement documentee, et une balise cassee resterait
--- visible. Une parenthese, elle, se lit.
---@param texte any
---@return string
local function SansBalise(texte)
    return (tostring(texte or ""):gsub("[<>]", { ["<"] = "(", [">"] = ")" }))
end

--- Annonce au joueur ce qu'il incarne. Le chat est le seul retour visible
--- vérifié dans la doc (Chat.BroadcastMessage) — il n'y a pas de HUD ici.
local function AnnoncerClasse(player, class_id)
    local classe = Narvos.Classes.CLASSES[class_id]
    if (not classe) then return end

    local stats = classe.baseStats or {}
    Chat.BroadcastMessage(
        "<cyan>" .. SansBalise(player:GetName()) .. "</>"
        .. " incarne <yellow>" .. tostring(classe.label or class_id) .. "</>"
        .. " (" .. tostring(classe.element) .. ", " .. tostring(classe.role) .. ")"
        .. " — PV " .. tostring(stats.hp or "?")
        .. " · vitesse " .. tostring(stats.moveSpeed or "?")
    )
end

-- `perso` est la fiche choisie a l'ecran de selection (Server/Session.lua).
-- Elle est OPTIONNELLE : sans elle on retombe sur l'ancien tirage a la ronde,
-- ce qui garde les spawns de test et les PNJ fonctionnels.
---@param depart_id string|nil  monde choisi a l'ecran de depart ; nil = cercle Forge
local function SpawnPersonnage(player, perso, depart_id)
    local class_id
    if (perso and perso.classId) then
        class_id = perso.classId
    else
        local ids = Narvos.CharacterBuilder.ClassIds()
        class_id = ids[((prochaine_classe - 1) % #ids) + 1]
        prochaine_classe = prochaine_classe + 1
    end

    -- ── LE MONDE CHOISI PAR LE JOUEUR ────────────────────────────────────────
    --
    -- `depart_id` vient de `Session` APRES revalidation par `Depart.Retenu` : il
    -- designe forcement un monde praticable. On redemande quand meme le point a
    -- `Depart.Point`, qui le lit dans le catalogue — recopier la position ici en
    -- ferait une seconde source de verite, et les deux divergeraient.
    --
    -- ⚠ LE REPLI RESTE LE CERCLE, PAS LE CENTRE D'UN MONDE. Sans choix (PNJ,
    -- spawns de test, ancien appel a deux arguments), on garde exactement le
    -- comportement d'avant : quatre points autour de l'ancre de la Forge. Un
    -- point unique ferait empiler les corps des joueurs qui arrivent ensemble.
    local point
    if (depart_id and Narvos.Depart) then
        local choisi = Narvos.Depart.Point(depart_id)
        -- `Point` rend nil si le monde n'est plus praticable — cas reel : le
        -- pack a change entre le choix et l'arrivee. On le dit et on retombe.
        if (choisi) then
            point = choisi
        else
            Console.Error("Spawn : depart '" .. tostring(depart_id) ..
                "' refuse a l'arrivee, repli sur la Forge")
        end
    end
    point = point or SurCercle(math.random(4), 4, RAYON_SPAWN, SOL_Z)

    -- Le builder fait tout : corps, tenue selon le rôle, yeux, teinte de classe,
    -- stats posées sur l'entité et vitesse appliquée.
    local character, raison = Narvos.CharacterBuilder.Spawn(
        class_id, point, Rotator(0, 45, 0),
        perso and perso.gender or nil,
        perso and perso.corps or nil)
    if (not character) then
        Console.Error("Spawn NARVOS impossible : " .. tostring(raison))
        return nil
    end

    -- Apparence CHOISIE a la creation (visage, cheveux) FUSIONNEE avec ce que le
    -- joueur porte. Les deux occupent les memes slots, donc un seul appel les
    -- pose : deux appels successifs se retireraient l'un l'autre, puisque
    -- `AddSkeletalMeshAttached` ecrase l'identifiant de slot.
    local corps = perso and perso.corps and Narvos.Modular.Corps(perso.corps) or nil
    if (corps) then
        -- ⚠ CE BLOC LISAIT `perso.equipement`, UN CHAMP QUI N'EXISTE PAS.
        --
        -- Aucun code ne le pose — `grep -rn "equipement" --include=*.lua` ne
        -- rendait que cette ligne. Les vêtements portés vivent dans
        -- `perso.gardeRobe.porte`. Le joueur achetait donc chez le tailleur, se
        -- voyait habillé, se reconnectait, et retrouvait son personnage en
        -- tenue de création : la boutique n'avait aucun effet durable.
        --
        -- Rien ne le signalait. `pairs(nil or {})` itère une table vide sans
        -- broncher, et le personnage sortait habillé — de son identité seule.
        -- Trouvé par audit le 2026-09-04.
        --
        -- On délègue à `Vestiaire.Tenue`, la MÊME fonction qu'emploie le
        -- rhabillage en jeu (`Server/Vestiaire.lua`). Deux fusions écrites
        -- séparément finiraient par diverger, et c'est exactement le genre
        -- d'écart qui ne se voit qu'après une reconnexion.
        local porte = Narvos.Vestiaire.Tenue(
            perso.apparence or perso.tenue, perso.gardeRobe)

        local ok, pourquoi = Narvos.CharacterBuilder.Habiller(
            character, corps, porte, perso.morphs, perso.colors,
            Narvos.MetaCustomLogic.Normaliser(Narvos.MetaCustomLogic.Decoder(perso.metacustom), corps.genre))
        if (not ok) then
            Console.Error("[NARVOS] habillage au spawn refuse — " .. tostring(pourquoi))
        end

        -- Les ÉQUIPEMENTS (casque, armure, bijoux…) se rattachent après la
        -- tenue : le personnage se reconnecte déjà équipé, pas seulement quand
        -- il change d'objet en jeu. `Narvos.RhabillerEquipements` est assignée
        -- PLUS BAS dans ce fichier (elle dépend d'`equipements` et d'Inventory) ;
        -- au runtime du spawn elle existe forcément.
        if (Narvos.RhabillerEquipements) then Narvos.RhabillerEquipements(player) end
    end

    player:Possess(character)
    AppliquerVueIso(player, character)
    AnnoncerClasse(player, class_id)

    -- ── LE SAC EST RELU, PLUS RECRÉÉ ────────────────────────────────────────
    -- `CreateGridState()` seul donnait une grille NEUVE à chaque connexion :
    -- tout ce que le joueur portait était perdu, sans message. `perso.inventaire`
    -- est déjà décodé par `Roster.depuisLigne` ; un personnage d'avant la colonne
    -- rend une grille vide, ce qui est exactement l'ancien comportement.
    local sauve = perso and perso.inventaire
    inventaires[player] = (type(sauve) == "table" and type(sauve.grid) == "table")
        and sauve.grid or Narvos.Inventory.CreateGridState()
    -- L'équipement porté revient avec le sac (il était sauvé vide avant le 2026-09-14).
    equipements[player] = (type(sauve) == "table" and type(sauve.equipment) == "table")
        and sauve.equipment or {}
    -- Les uid relus sont RÉSERVÉS : sans ça, le compteur repart de 1 à chaque
    -- redémarrage et le prochain objet reçu prend l'identité d'une pile du sac
    -- (vu en jeu le 2026-09-15 : fiche de l'AK-74U au clic sur un Desert Eagle).
    Narvos.Inventory.ReserverUids(inventaires[player], equipements[player])

    -- Le client réimpose l'angle périodiquement : aucune API ne VERROUILLE le
    -- ViewMode, le joueur peut en sortir par ses propres entrées.
    Events.CallRemote("NarvosIso:Config", player, Reliability.Reliable, ISO)

    -- L interface s ouvre sur un etat deja connu : sans cet envoi initial,
    -- le premier appui sur I montrerait un inventaire vide.
    EnvoyerInventaire(player)
    EnvoyerClasses(player)

    -- ⚠ Les raccourcis d'animation partent MAINTENANT, pas a l'ouverture du menu.
    -- Sans cet envoi, la table `raccourcis` du client restait vide et les touches
    -- enregistrees en base etaient mortes tant que le joueur n'avait pas ouvert B
    -- au moins une fois — un raccourci qu'il faut aller chercher n'en est pas un.
    -- Trouve par audit le 2026-09-03.
    if (Narvos.EmotesServeur) then Narvos.EmotesServeur.Envoyer(player) end

    -- Les TOUCHES partent au spawn, pas a l'ouverture d'un menu : sans elles le
    -- repartiteur clavier du client est vide et AUCUNE touche ne repond — ni
    -- l'inventaire, ni les pouvoirs, ni le menu d'animations. C'est peu de
    -- donnees (quatorze actions) contre un jeu entierement muet.
    if (Narvos.CommandesServeur) then Narvos.CommandesServeur.Envoyer(player) end
    if (Narvos.SortsServeur) then Narvos.SortsServeur.Envoyer(player) end

    return character
end

-- ── LA PAUSE AVANT LE JEU ─────────────────────────────────────────────────────
--
-- Le joueur n'a plus de corps a la connexion : il ouvre une session, s'identifie,
-- puis choisit ou cree un personnage. `Session.spawner` est rappele seulement
-- une fois ce choix fait. Voir Server/Session.lua.
-- La base des comptes et du roster. SQLite en local ; sur le VPS, seule cette
-- ligne change (DatabaseEngine.MySQL ou .PostgreSQL, meme SQL derriere).
-- Echec = pas de comptes : on le dit fort, sinon le joueur resterait bloque a
-- l'ecran de connexion sans savoir pourquoi.
if (Narvos.Comptes.Ouvrir()) then
    Narvos.Roster.UtiliserBase(Narvos.Comptes.Base())
    Narvos.Raccourcis.UtiliserBase(Narvos.Comptes.Base())
    Narvos.Commandes.UtiliserBase(Narvos.Comptes.Base())
    Narvos.Roue.UtiliserBase(Narvos.Comptes.Base())
    Narvos.Agriculture.UtiliserBase(Narvos.Comptes.Base())
    Narvos.Jouabilite.UtiliserBase(Narvos.Comptes.Base())
    -- Assemblage : la table `assemblages` est créée dans Comptes.Ouvrir, sur la
    -- MÊME connexion. Sans cette ligne, `Assemblage.Ouvrir` REFUSE tout — une
    -- session non persistée est une perte de pièces en attente (en-tête du
    -- module, réponse nº 2).
    Narvos.Assemblage.UtiliserBase(Narvos.Comptes.Base())

    -- ⚠ L'ARBITRE DES TOUCHES. Sans cette ligne, une emote peut se poser sur la
    -- meme touche qu'une commande : le joueur appuie, deux choses partent, et
    -- rien dans le jeu ne lui dit pourquoi. `Commandes` est le seul module qui
    -- voit les DEUX tables, donc le seul qui puisse trancher.
    Narvos.Raccourcis.UtiliserArbitre(Narvos.Commandes.ToucheOccupee)

    Console.Log("NARVOS : base des comptes ouverte.")
else
    Console.Error("NARVOS : base des comptes INDISPONIBLE — aucune connexion possible.")
end

local Session = Package.Require("Server/Session.lua")
Session.spawner = SpawnPersonnage

-- Exposee pour les modules serveur qui ont besoin de savoir a quel compte
-- appartient un joueur (Server/Emotes.lua). Pas dans Shared/ : la session n'a de
-- sens que cote serveur, un client n'a rien a en connaitre.
Narvos.SessionServeur = Session

-- ── DROITS DE GESTION — décidés côté SERVEUR, jamais par le client ────────────
--
-- Administrateur = la SESSION le dit : Steam ID déclaré dans Config.toml
-- (`Session.AppliquerDroits`, à chaque connexion) OU drapeau `est_admin` du compte
-- en base. ⚠ SQLite rend 0/1 : comparer au NOMBRE, car `0` est VRAI en Lua.
--
-- `PeutGerer` est l'UNIQUE règle des outils de gestion — commandes DEV,
-- invocation de PNJ, véhicules, export du décor, menu des armes. Avant, chaque
-- porte avait la sienne, et trois n'en avaient AUCUNE : l'export à la sortie de
-- F3 réécrivait le catalogue de la map pour n'importe quel joueur, et le menu
-- d'invocation comme le spawn de véhicule passaient sans contrôle (2026-09-11).
local function EstAdmin(player)
    local s = Session.De(player)
    return s ~= nil and s.compte ~= nil and (tonumber(s.compte.est_admin) or 0) == 1
end

--- Ouvert si le serveur est en mode développement (`commandes_dev`, Package.toml)
--- OU au joueur administrateur.
local function PeutGerer(player)
    return config.commandes_dev == true or EstAdmin(player)
end

--- La même règle, au format des gardes injectées (`permis, raison`).
local function GardeGestion(player)
    if (PeutGerer(player)) then return true end
    return false, "Reserve aux administrateurs"
end

-- Le personnage se compose SUR LA MAP : on pose la scene a l'ecart du cercle de
-- spawn, mais au meme niveau de sol. Seul ce fichier connait `SOL_Z` et l'echelle
-- de la map courante — d'ou l'injection plutot qu'une constante dans Session.lua.
Session.PoserAncreApercu(PresDe(RAYON_SPAWN * 2.2, 0, SOL_Z))

-- Animations contextuelles + raccourcis clavier. Charge APRES Session, dont il
-- lit l'etat pour refuser d'agir sur un joueur encore a l'ecran de selection.
Narvos.EmotesServeur = Package.Require("Server/Emotes.lua")

-- ── Les quatre systemes de jeu ────────────────────────────────────────────────
--
-- Tous chargent APRES Session pour la meme raison qu'Emotes : chacun refuse
-- d'agir sur un joueur qui n'a pas encore de corps, et le verifie par
-- `Session.EnJeu`. Les poser avant laisserait `Narvos.SessionServeur` a nil et
-- la garde d'etat tomberait toujours a « pas en jeu », donc rien ne marcherait.
--
-- `Commandes` fait exception : il agit des qu'une SESSION existe, sans attendre
-- le corps — regler ses touches depuis l'ecran de selection est legitime.
Narvos.CommandesServeur = Package.Require("Server/Commandes.lua")
Narvos.PropsServeur = Package.Require("Server/Props.lua")

-- ── QUI ÉDITE OÙ ──────────────────────────────────────────────────────────────
--
-- `Server/Props.lua` refuse TOUT tant que cette garde n'est pas installée. C'est
-- voulu : une garde ouverte par défaut serait invisible si on oubliait de la
-- brancher, et le monde entier resterait éditable par n'importe qui sans qu'un
-- seul message ne le dise. Le 2026-09-08, 35 modules étaient lus et aucun câblé
-- — le silence avait coûté six systèmes. Ici l'oubli se voit à la première pose.
--
-- La garde croise trois choses que `Props.lua` n'a pas à connaître :
--   · le COMPTE du joueur et son droit d'admin  → `Session.De`
--   · le MONDE où il se trouve                  → `Mondes.ParPosition`
--   · les zones déclarées                       → `Catalogs/Zones.lua`
--
-- ⚠ On résout le monde par la POSITION VISÉE, pas par la dimension du joueur.
-- Tous les joueurs restent en dimension 1 (voir l'en-tête de `Voyage.lua`) : la
-- dimension ne distingue donc aucun monde, et s'en servir rendrait toujours le
-- même. Les mondes sont séparés par leurs COORDONNÉES, à 80 km les uns des
-- autres.
--
-- ⚠ NOMMÉE depuis le 2026-09-13 : la porte à code (Server/Digicode.lua) applique
-- EXACTEMENT cette règle — qui construit ici pose, change le code et passe sans
-- code. Une seconde copie divergerait à la première retouche des zones.
local function PeutEditerIci(player, x, y, z)
    local s = Session.De(player)
    if (not s or not s.compte) then
        return false, "Session inconnue"
    end

    local monde = Narvos.Mondes.ParPosition(Vector(x, y, z))
    if (not monde) then
        -- Hors de tout monde connu : il n'existe aucune zone là-bas, donc aucun
        -- droit. On le dit plutôt que de laisser `Zones` conclure la même chose
        -- avec un message qui parlerait de zones alors que c'est le MONDE qui
        -- manque.
        return false, "Position hors de tout monde connu"
    end

    return Narvos.Zones.PeutEditer(Narvos.ZonesCatalogue.Toutes(), monde.id, x, y, z, {
        compte_id = s.compte.id,
        -- SQLite rend 0/1, pas false/true : `s.compte.est_admin` vaut donc le
        -- NOMBRE 0 pour un joueur ordinaire — et en Lua `0` est VRAI. Comparer
        -- explicitement, sinon tout le monde serait admin.
        est_admin = (tonumber(s.compte.est_admin) or 0) == 1,
    })
end
Narvos.PropsServeur.UtiliserGarde(PeutEditerIci)
-- IA des PNJ. AVANT le Spawner, qui lui confie chaque invocation : requis apres
-- lui, `Narvos.IaServeur` serait nil au moment ou Spawner s'en sert.
Narvos.IaServeur = Package.Require("Server/Ia.lua")
Narvos.SpawnerServeur = Package.Require("Server/Spawner.lua")
Narvos.SpawnerServeur.UtiliserGarde(GardeGestion)
-- Peuplement : fait exister les PNJ AUTOUR des joueurs, et les retire ailleurs.
-- APRES Ia (il lui confie chaque PNJ ne) et apres Spawner, dont il est le
-- pendant automatique : Spawner invoque a la demande, Peuplement selon la carte.
-- Capturé en local, comme `Session` : c'est CE nom qui appelle `Charger` au
-- chargement — `appels-check.mjs` vérifie le RECEPTEUR, pas le nom de fonction.
local Peuplement = Package.Require("Server/Peuplement.lua")
Narvos.PeuplementServeur = Peuplement
-- Export : fige en catalogue ce qui a ete pose en jeu. APRES Props, Spawner et
-- Peuplement, dont il lit les listes.
Narvos.Export = Package.Require("Server/Export.lua")

-- Le menu N ferme la boucle sans exiger une commande de chat : l'auteur choisit
-- les niveaux, pose ses PNJ, puis enregistre le catalogue relu au redemarrage.
Events.SubscribeRemote("Narvos:EnregistrerPeuplement", function(player)
    if (not Session.EnJeu(player)) then return end
    local permis, raison = GardeGestion(player)
    if (not permis) then
        Events.CallRemote("Narvos:SpawnErreur", player, Reliability.Reliable,
            raison or "Enregistrement reserve aux administrateurs")
        return
    end
    local ok, message = Narvos.Export.Pnj(player)
    Events.CallRemote(ok and "Narvos:SpawnInfo" or "Narvos:SpawnErreur",
        player, Reliability.Reliable,
        tostring(message) .. (ok and " — relu au prochain redemarrage" or ""))
end)

-- ── SAUVEGARDE À LA SORTIE DU MODE ÉDITION ────────────────────────────────────
--
-- `Client/Edition.lua` émet ceci quand le joueur quitte l'édition (F3 ou la
-- croix). C'est la MÊME fonction que `/exporter decor` : une seule voie
-- d'écriture, donc pas de « ça dépend comment on ferme ». Le jour où l'export
-- changera, il changera pour les deux.
--
-- ⚠ On ne renvoie l'erreur qu'au joueur concerné, et seulement s'il y en a une :
-- un « rien à exporter » à chaque fermeture apprendrait au joueur à ignorer le
-- bandeau, et le vrai message se perdrait dedans.
Events.SubscribeRemote("Narvos:ExporterProps", function(player)
    -- ⚠ L'EXPORT ÉCRIT DANS LE DÉPÔT (DecorPose.lua). Sans cette garde, un joueur
    -- ordinaire qui quittait F3 remplaçait le décor de la map par le sien.
    if (not PeutGerer(player)) then return end
    local ok, message = Narvos.Export.Props(player)
    -- `nil` = rien a sauver : silence, c'est le cas courant. `false` = une
    -- ecriture a echoue : celle-la, le joueur doit la voir.
    if (ok == false and message) then
        Chat.SendMessage(player, "<red>Sauvegarde : " .. tostring(message) .. "</>")
    end
end)
-- ── Points de téléportation ──────────────────────────────────────────────────
-- Génériques, toutes maps : un point porte son monde et des coordonnées locales.
-- PASSER = tout joueur (le serveur revérifie la distance) ; ÉDITER = PeutGerer.
-- APRÈS Export, dont il emprunte l'écriture de catalogue (`Export.Catalogue`).
Narvos.TeleportsServeur = Package.Require("Server/Teleports.lua")
Narvos.TeleportsServeur.Configurer({
    joueur_de = JoueurDe,
    peut_gerer = PeutGerer,
    ecrire = Narvos.Export.Catalogue,
    -- Un passage vers un AUTRE monde demande qu'il soit chargé : même appel que
    -- /monde. Lu à l'APPEL : Voyage est câblé plus bas dans ce fichier.
    charger_monde = function(monde_id)
        if (Narvos.VoyageServeur) then Narvos.VoyageServeur.Charger(monde_id) end
    end,
})
Narvos.TeleportsServeur.Charger()

-- ── Zaaps (D4, 2026-09-15) ────────────────────────────────────────────────────
-- Points de sauvegarde : le dernier activé devient le point de réapparition du
-- personnage (colonne `personnages.zaap`). ACTIVER = tout joueur vivant (distance
-- revérifiée) ; ÉDITER = PeutGerer. APRÈS Teleports, dont il emprunte les
-- coordonnées, et Export, dont il emprunte l'écriture de catalogue.
Narvos.ZaapsServeur = Package.Require("Server/Zaaps.lua")
Narvos.ZaapsServeur.Configurer({
    joueur_de = JoueurDe,
    peut_gerer = PeutGerer,
    ecrire = Narvos.Export.Catalogue,
    charger_monde = function(monde_id)
        if (Narvos.VoyageServeur) then Narvos.VoyageServeur.Charger(monde_id) end
    end,
    perso_de = function(player)
        local s = Narvos.SessionServeur and Narvos.SessionServeur.De(player)
        return s and s.perso or nil
    end,
    enregistrer = function(player, zaap_id)
        local s = Narvos.SessionServeur and Narvos.SessionServeur.De(player)
        if (not s or not s.compte or not s.perso) then return false, "Aucun personnage en jeu" end
        return Narvos.Roster.EnregistrerZaap(s.compte.id, s.perso.id, zaap_id)
    end,
})
Narvos.ZaapsServeur.Charger()

Narvos.SortsServeur = Package.Require("Server/Sorts.lua")
-- Corps-a-corps. APRES Session (il lit `Session.De` et `Session.EnJeu`) et
-- APRES que Shared ait charge `Narvos.Combat` et `Narvos.Animations`, dont il
-- est l'executant : le module partage decide, celui-ci fabrique les entites et
-- pose les nombres.
Narvos.CombatServeur = Package.Require("Server/Combat.lua")
-- Mains nues (poings G/D, pieds G/D). APRES Combat : il en reprend le modele de
-- degats (`Combat.Degats`, `Combat.POINGS`).
Narvos.FrappesServeur = Package.Require("Server/Frappes.lua")
-- Esquive directionnelle (dash). APRES Session (EnJeu) ; même modèle que
-- Frappes : gardes, animation IP, impulsion serveur.
Narvos.DashServeur = Package.Require("Server/Dash.lua")
-- Jauge d'énergie (escalade). AVANT Traversee : elle la consulte à chaque geste.
Narvos.EnergieServeur = Package.Require("Server/Energie.lua")
-- Escalade (vault/mantle/grimper). APRÈS Dash : même modèle, plus les traces.
Narvos.TraverseeServeur = Package.Require("Server/Traversee.lua")
-- Roulade de réception après chute (passif, événement d'atterrissage).
Narvos.RouladeServeur = Package.Require("Server/Roulade.lua")
-- Niveau, XP et talents du personnage (menu Personnage > Compétences, touche
-- F5). APRES Sorts (il module l'etat de lancement) et Frappes/Combat (qui lisent
-- ses bonus au moment du coup). Gains : victoires (evenement Death), quetes
-- (OctroyerRecompense), /xp pour l'essai.
Narvos.ProgressionServeur = Package.Require("Server/Progression.lua")
-- Relève un joueur mort à l'arrivée de son monde. APRÈS Sorts (il rend le mana
-- par sa porte). Aucun code ne relevait un joueur avant le 2026-09-15.
Narvos.ReapparitionServeur = Package.Require("Server/Reapparition.lua")

-- /editionpnj : repères radar des PNJ, animaux, ressources, véhicules (couleur,
-- taille, visibilité par sorte/rôle/PNJ) et diagnostic texture de chaque PNJ.
-- La garde est la règle d'administration commune ; FERMÉE tant qu'elle n'est pas
-- branchée (le module refuse tout).
Narvos.EditionPnjServeur = Package.Require("Server/EditionPnj.lua")
Narvos.EditionPnjServeur.UtiliserGarde(GardeGestion)

-- Tailleur et garde-robe. Charge APRES Session comme les autres : il lit le
-- personnage courant pour connaitre sa morphologie et sa bourse, deux valeurs
-- que le client ne doit jamais fournir lui-meme.
Narvos.VestiaireServeur = Package.Require("Server/Vestiaire.lua")

-- Les voitures City_Traffic_Pro cuites. APRES Session comme les autres : le
-- spawn exige un personnage contrôlé. La classe `VehicleWheeled` héritée, le
-- spawn devant le joueur, la montée au volant et la purge à la déconnexion
-- sont dans ce module ; la commande `/vehicule` est plus bas, avec les autres.
Narvos.VoituresServeur = Package.Require("Server/Voitures.lua")
Narvos.VoituresServeur.UtiliserGarde(GardeGestion)

-- Portails entre les mondes. Les portails eux-memes sont poses plus bas, une
-- fois la Forge chargee : un Trigger sans sol sous lui est franchissable en
-- chute libre, ce qui n'est pas le voyage qu'on veut.
Narvos.VoyageServeur = Package.Require("Server/Voyage.lua")
Narvos.VoyageServeur.Diagnostic()

Player.Subscribe("Spawn", function(player)
    Session.Ouvrir(player)
end)

-- Le personnage meurt avec son joueur : sans ça, un corps orphelin reste dans le
-- monde à chaque déconnexion.
--- Enregistre le sac d'un joueur, s'il en a un et si sa session le permet.
---
--- ⚠ EXTRAITE POUR ETRE APPELEE DE PLUSIEURS ENDROITS. La deconnexion n'est pas
--- le seul moment ou l'on peut tout perdre : un serveur qui tombe, un joueur
--- qui voyage et dont la connexion lache pendant le chargement. Chaque appel
--- supplementaire retrecit la fenetre de perte.
---
--- ⚠ MAIS PAS A CHAQUE MUTATION. Un joueur qui glisse une pile dans sa grille
--- produirait une ecriture par pixel de glissement.
---@param player table
---@return boolean
local function EnregistrerSac(player)
    local grille = inventaires[player]
    local s = Session and Session.De and Session.De(player) or nil
    if (not grille or not s or not s.compte or not s.perso) then return false end
    -- ⚠ `pcall` ne dit que « pas d'exception ». `EnregistrerInventaire` REFUSE
    -- par sa valeur de retour (false, raison) : ne lire que le premier booleen
    -- du pcall a laisse passer « Base indisponible » a CHAQUE sauvegarde, sans
    -- une ligne au journal — aucun sac n'a jamais ete ecrit (trouve 2026-09-14).
    local ok, enregistre, raison = pcall(function()
        return Narvos.Roster.EnregistrerInventaire(
            s.compte.id, s.perso.id, { grid = grille, equipment = equipements[player] or {} })
    end)
    if (not ok or enregistre ~= true) then
        Console.Warn("Inventaire non enregistre : " .. tostring(ok and raison or enregistre))
        return false
    end
    return true
end

-- ⚠ EXPOSEE POUR `Server/Voyage.lua`, qui est requis AVANT ce point. Il la lit
-- donc au MOMENT DE L'APPEL (quand un joueur voyage), pas au chargement — a ce
-- moment-la elle existe. Une reference prise au chargement vaudrait nil pour
-- toujours, et c'est le piege qui a ete rencontre cinq fois sur ce projet.
Narvos.EnregistrerSac = EnregistrerSac

-- ── Butin des PNJ hostiles ───────────────────────────────────────────────────
-- L'IA signale seulement le coup fatal, ses statistiques et LE CADAVRE. La
-- suite appartient à Server/Fouille.lua : cadavre fouillable, ou auto-loot
-- selon les réglages de jouabilité. Un objet n'est annonce qu'apres ajout ET
-- sauvegarde ; en cas de sac plein ou d'echec SQL, aucun faux gain n'est
-- affiche — et rien ne quitte le cadavre sans etre entre dans le sac.
Narvos.IaServeur.UtiliserMort(function(player, suivi, entite)
    Narvos.FouilleServeur.SurMort(player, suivi, entite)
end)

-- ── Fouille des cadavres et réglages de jouabilité ───────────────────────────
-- `FouilleServeur` relie le modèle pur (Logic/Fouille.lua) au monde : grille du
-- sac, sauvegarde, renvoi de l'inventaire. `JouabiliteServeur` tient les
-- réglages (auto-loot, auto-marche…) sur le compte, en base.
Narvos.JouabiliteServeur = Package.Require("Server/Jouabilite.lua")
Narvos.FouilleServeur = Package.Require("Server/Fouille.lua")
Narvos.FouilleServeur.Brancher({
    grille = function(player) return inventaires[player] end,
    ecrire = function(player, grille)
        inventaires[player] = grille
        return EnregistrerSac(player)
    end,
    envoyer_inventaire = EnvoyerInventaire,
})

-- ── Auto-marche (2026-09-19, CORRIGÉ 19/09) ──────────────────────────────────
-- PREMIÈRE VERSION : `MoveTo` serveur à chaque cap reçu. Le moteur l'a refusé
-- sur un personnage contrôlé (« You cannot MoveTo Characters which have Player
-- controlling it ») — le log en était saturé. La doc OFFICIELLE (docs.nanos-world.com,
-- Input.InputKey) expose la synthèse de touche côté CLIENT : c'est là que la
-- marche continue doit vivre, plus aucun ordre serveur.
-- Les handlers sont donc RÉSERVÉS (aucun MoveTo) : le client ne doit plus les
-- appeler. Ils restent pour ne pas casser un client ancien qui les émettrait.
Events.SubscribeRemote("Narvos:AutoMarcheAvancer", function(player, yaw)
    -- Mécanisme retiré : voir le client (Input.InputKey). Aucun déplacement ici.
end)

Events.SubscribeRemote("Narvos:AutoMarcheStop", function(player)
    -- Mécanisme retiré : l'arrêt est naturel (la touche forcée est relâchée).
end)

-- ── Établi d'assemblage ───────────────────────────────────────────────────────
--
-- L'exécutant de l'assemblage pièce par pièce (véhicules, armes, objets — le
-- MODÈLE est `Narvos.Assemblage`, partagé et prouvé ; ce module ne fait que
-- relier proximité, session, grille et sauvegarde). Requis ICI, après Session
-- et EnregistrerSac qu'on lui injecte.
--
-- ⚠ Le catalogue des plans est lu À L'EXÉCUTION via `catalogue_plans` : il est
-- généré par un chantier parallèle (`Shared/Catalogs/Plans.lua` → `Narvos.Plans`)
-- et AUCUNE liste de plans n'est recopiée ici. Tant que `Narvos.Plans` n'est pas
-- câblé, l'établi affiche honnêtement « aucun plan disponible » au lieu de
-- dessiner des plans bouchonnés.
Narvos.AssemblageServeur = Package.Require("Server/Assemblage.lua")
Narvos.AssemblageServeur.Brancher({
    session = Session,
    inventaires = inventaires,
    enregistrer_sac = EnregistrerSac,
    envoyer_inventaire = EnvoyerInventaire,
    joueur_de = JoueurDe,
    catalogue_plans = function()
        -- Le catalogue du chantier B exporte `PLANS` (table unique, vérifiée
        -- par cablage-check). Garde nil seulement si le module est décâblé :
        -- l'établi affiche alors honnêtement « aucun plan disponible ».
        if (not Narvos.Plans) then return nil end
        if (type(Narvos.Plans.PLANS) == "table") then return Narvos.Plans.PLANS end
        return nil
    end,
})

-- ── Compagnons ────────────────────────────────────────────────────────────────
--
-- L'exécutant des compagnons. Le MODÈLE (`Narvos.Animaux`) et le CATALOGUE
-- (`Narvos.AnimauxCatalogue`, généré) sont partagés et prouvés ; ce module ne
-- fait que relier session, entité, suivi et persistance.
--
-- ⚠ L'ÉTAT DE CUISSON EST DANS LE CATALOGUE GÉNÉRÉ, PAS ICI. Ce commentaire disait
-- « AUCUNE n'est cuite » — vrai à l'écriture, faux depuis le cook du 2026-09-10
-- (41 `cuit = true`). L'exécutant refuse toujours une espèce non cuite EN LA
-- NOMMANT : c'est ce refus qui reste vrai, quelle que soit la liste du jour.
Narvos.AnimauxServeur = Package.Require("Server/Animaux.lua")
Narvos.AnimauxServeur.Configurer({
    session = Session,
    joueur_de = JoueurDe,
})

-- ── Pont MetaHuman : RETIRÉ le 2026-09-14 ─────────────────────────────────────
-- `Server/MetaHumain.lua` posait des pièces-Blueprints par-dessus le MetaHuman du
-- joueur (panneau U, /metahumain) : second corps, vêtements non choisis. Retour de
-- jeu : « logique parasite, un seul menu d'équipement ». L'apparence passe par le
-- Meta Customization System, réglé dans l'inventaire (Server/Vestiaire.lua).

-- ── La MEME garde-robe, mais PILOTEE au lieu d etre reportee ─────────────────
-- Le pont ci-dessus pose des meshes un par un. `Server/MetaHumainBP.lua` parle
-- au systeme qui sait deja le faire : `CallBlueprintEvent` est d autorite
-- SERVEUR, et les Blueprints du Meta Customization System sont declares depuis
-- la correction du builder du 11/09. Outil d essai tant qu un appel reel n a pas
-- tranche en jeu (voir .hermes/API_BP_METACUSTOM_2026-09-12.md).
Narvos.MetaHumainBP = Package.Require("Server/MetaHumainBP.lua")

Player.Subscribe("Destroy", function(player)
    -- ── ENREGISTRER LE SAC, AVANT TOUT LE RESTE ─────────────────────────────
    --
    -- ⚠ L'ORDRE EST LA SEULE CHOSE QUI COMPTE ICI. `Session.Fermer` plus bas
    -- efface la session, donc le compte et le personnage : écrire après elle
    -- n'aurait plus de destinataire. Et `inventaires[player] = nil` efface la
    -- source. Entre les deux, il n'y a qu'une fenêtre — celle-ci.
    --
    -- ⚠ À LA DÉCONNEXION SEULEMENT, jamais à chaque mutation : un joueur qui
    -- glisse une pile dans sa grille produirait une écriture par pixel de
    -- glissement. Les autres moments d'écriture (changement de map, coffre
    -- fermé) s'ajouteront quand ils existeront, pas avant.
    EnregistrerSac(player)

    local character = player:GetControlledCharacter()
    if (character) then character:Destroy() end
    inventaires[player] = nil
    equipements[player] = nil
    atelier_du_joueur[player] = nil
    gisement_proche[player] = nil
    marchand_proche[player] = nil
    -- ⚠ `arme_suivante` aussi : c'est une table indexee par ENTITE joueur. Ne pas
    -- la purger y laisse une reference morte a chaque deconnexion, et la table
    -- grossit tant que le serveur tourne. Trouve par audit le 2026-09-03.
    arme_suivante[player] = nil
    -- Purge de la proximité de l'établi : même discipline qu'`atelier_du_joueur`.
    if (Narvos.AssemblageServeur) then Narvos.AssemblageServeur.Oublier(player) end
    -- Sans ca, la session survivrait a son joueur et garderait son compte ouvert.
    Session.Fermer(player)
end)

-- ── Pads de classe ─────────────────────────────────────────────────────────────

--- Un pad par classe : marcher dessus rhabille le personnage à cette classe.
--- C'est la seule interaction possible sans API d'entrée vérifiée côté serveur,
--- et elle a un mérite : elle se teste en jouant, pas en tapant une commande.
local function PoserPadsDeClasse()
    local ids = Narvos.CharacterBuilder.ClassIds()

    for i, class_id in ipairs(ids) do
        local classe = Narvos.Classes.CLASSES[class_id]
        local position = SurCercle(i, #ids, RAYON_PADS, 20.0)
        local teinte = Narvos.CharacterBuilder.HexToColor(classe.outfitColor) or Color(1, 1, 1)

        -- Repère visible au sol : sans lui le pad est un déclencheur invisible,
        -- soit exactement la « fausse affordance » que le level design proscrit.
        Prop(Vector(position.X, position.Y, SOL_SERVICES + 5.0), Rotator(), "nanos-world::SM_Cylinder",
            CollisionType.NoCollision, false)

        -- 7e argument = overlap_only_classes. Sans liste blanche, le moteur teste
        -- CHAQUE entite qui bouge contre ce volume et le signale comme source de
        -- lag. Seuls des personnages nous interessent ici.
        local pad = Trigger(position, Rotator(), Vector(1.5 * M), TriggerType.Sphere, false, teinte, { "Character" })

        pad:Subscribe("BeginOverlap", function(_, acteur)
            local player = JoueurDe(acteur)
            if (not player) then return end

            -- Déjà de cette classe : ne rien faire, sinon on ré-habille et on
            -- re-spamme le chat à chaque pas sur le pad.
            if (acteur:GetValue("narvos_class") == class_id) then return end

            local ok, raison = Narvos.CharacterBuilder.ApplyClass(acteur, class_id)
            if (ok) then
                AnnoncerClasse(player, class_id)
            else
                Console.Error("Changement de classe refusé : " .. tostring(raison))
            end
        end)
    end
end

-- ═══ METIERS — ce que la fiche personnage affiche ════════════════════════════
--
-- La liste ITERE le catalogue : un metier ajoute cote TS apparait ici sans
-- toucher au Lua. Chaque entree porte sa `fiche` calculee cote serveur (niveau,
-- XP, cible, progression) : la page n'a aucune courbe a reimplementer, et une
-- seconde courbe en JavaScript finirait par diverger de la premiere.
local function EnvoyerMetiers(player)
    local s = Session.De(player)
    local perso = s and s.perso
    local etat = (perso and perso.metiers) or {}
    local liste = {}
    for _, m in ipairs(Narvos.Metiers.PROFESSIONS) do
        liste[#liste + 1] = {
            id = m.id, label = m.label, icon = m.icon, color = m.color, kind = m.kind,
            fiche = Narvos.MetiersLogique.Fiche(etat, m.id),
        }
    end
    Events.CallRemote("Narvos:Metiers", player, Reliability.Reliable, {
        metiers = liste, niveau_max = Narvos.MetiersLogique.NIVEAU_MAX,
    })
end

Events.SubscribeRemote("Narvos:DemanderMetiers", function(player)
    if (not Session.EnJeu(player)) then return end
    EnvoyerMetiers(player)
end)

-- ═══ METIERS — gagner de l'XP en pratiquant ══════════════════════════════════
--
-- Un seul chemin pour la recolte ET la fabrication : sans lui, chaque gestionnaire
-- recopierait « completer l'etat, ajouter, sauver, annoncer », et les deux
-- copies divergeraient a la premiere correction.
--
-- ⚠ DECLAREE AVANT LE CRAFT ET LA RECOLTE, qui l'appellent tous deux. Un
-- `local function` place APRES son appelant vaut nil a l'appel, sans rien lever
-- au chargement — piege paye cinq fois sur ce projet (voir la fiche memoire
-- « Lua : local function apres son appelant »).
--
-- ⚠ LE CALCUL DE L'XP EST PASSE EN FONCTION, pas en nombre : il a besoin du
-- metier, qu'on ne connait qu'ici — et un metier nil (outil ou station sans
-- metier) ne doit rien calculer du tout.
local function GagnerXPMetier(player, metier, calcul)
    if (metier == nil) then return end
    local s = Session.De(player)
    local perso = s and s.perso
    if (not perso) then return end

    -- Un personnage d'avant le 2026-09-12 n'a aucun metier en base : on complete
    -- au niveau 1 plutot que de refuser l'XP.
    local etat = perso.metiers or {}
    if (etat[metier] == nil) then
        local neuf = Narvos.MetiersLogique.EtatNeuf({ metier })
        local complet = {}
        for k, v in pairs(etat) do complet[k] = v end
        complet[metier] = neuf[metier]
        etat = complet
    end

    local xp = calcul(metier)
    if (not xp or xp <= 0) then return end

    local suivant, niveaux = Narvos.MetiersLogique.AjouterXP(etat, metier, xp)
    perso.metiers = suivant

    local ok, raison = Narvos.Roster.EnregistrerMetiers(perso.compte, perso.id, suivant)
    if (not ok) then
        Console.Error("[METIERS] sauvegarde refusee pour " .. tostring(perso.name)
            .. " : " .. tostring(raison))
    end

    local fiche = Narvos.MetiersLogique.Fiche(suivant, metier)
    Events.CallRemote("Narvos:Metier", player, Reliability.Reliable, {
        metier = metier, xp_gagnee = xp, niveaux = niveaux, fiche = fiche,
    })
    if (niveaux > 0) then
        Chat.SendMessage(player, "<cyan>" .. metier .. "</> — niveau <yellow>"
            .. fiche.niveau .. "</>")
    end
end

-- ── Coffres de loot ────────────────────────────────────────────────────────────

-- Définitions procédurales (`gen_*`) inscrites dans ITEM_DB à la volée. Elles
-- sont PERSISTÉES (`loot_gen_defs`) : un sac qui contient un `gen_*` doit
-- pouvoir être relu après un redémarrage, sinon l'item redevient un fantôme.
local defs_loot_generees = {}

--- Verse un butin dans l'inventaire du joueur et l'annonce.
--- RollLoot rend des objets déjà résolus (catalogue ou procéduraux) ; c'est
--- Inventory qui décide de l'empilement et du placement en grille.
local function VerserButin(player, zone)
    local grille = inventaires[player]
    if (not grille) then return end

    local butin = Narvos.LootLogic.RollLoot(zone.id, zone.niveau, math.random(1, 3))
    if (not butin or #butin == 0) then
        Chat.BroadcastMessage("<grey>" .. zone.nom .. " : rien cette fois.</>")
        return
    end

    -- ⚠ AddItemToGrid est IMMUABLE : il rend une NOUVELLE grille, ou nil si ça ne
    -- rentre pas. Il ne rend pas un booléen et ne modifie pas l'ancienne. Lire son
    -- retour comme un `ok` sans réassigner laisse l'inventaire vide pour toujours,
    -- sans la moindre erreur — le piège exact que ce commentaire existe pour éviter.
    local noms = {}
    for _, item in ipairs(butin) do
        -- ⚠ RELIER AVANT DE VERSER (2026-09-19). Un drop PROCÉDURAL porte un id
        -- `gen_*` tiré à la volée : ITEM_DB ne le connaît pas. `EnregistrerDef`
        -- l'inscrit (et on le persiste), sinon le sac stockerait un itemId sans
        -- définition — invisible à la vue, inutilisable, perdu au redémarrage.
        -- Les entrées du catalogue, elles, sont DÉSORMAIS dans ITEM_DB via
        -- `Loot.Integrer` (Shared/Index.lua) : GetItemDef les résout.
        local def = Narvos.Inventory.GetItemDef(item.id)
        if (def == nil) then
            def = Narvos.LootLogic.EnregistrerDef(Narvos.Items.ITEM_DB, item)
            if (def and tostring(item.id):match("^gen_")) then
                defs_loot_generees[item.id] = def
                pcall(function() Package.SetPersistentData("loot_gen_defs", defs_loot_generees) end)
            end
        end

        -- Les entrées de LOOT_CATALOG sont des DÉFINITIONS : pas de champ
        -- `quantity`. La quantité se décide ici, pas dans le catalogue.
        local suivante = Narvos.Inventory.AddItemToGrid(grille, def, 1)
        if (suivante) then
            grille = suivante
            noms[#noms + 1] = tostring(def.label or def.id)
        else
            -- Une grille pleine n'est pas une erreur : c'est une information de jeu.
            noms[#noms + 1] = "(sac plein) " .. tostring(def.label or def.id)
        end
    end

    inventaires[player] = grille
    -- ⚠ Sauvegarder le sac ICI, pas seulement à la déconnexion : un serveur qui
    -- tombe juste après un coffre perdrait le butin découvert en session et jamais
    -- persisté. Moment DISCRET (un coffre par walk-in), donc conforme à la règle
    -- « pas d'écriture par pixel de glissement » posée plus haut.
    EnregistrerSac(player)
    EnvoyerInventaire(player)

    Chat.BroadcastMessage(
        "<cyan>" .. SansBalise(player:GetName()) .. "</> — <yellow>" .. zone.nom .. "</> : "
        .. table.concat(noms, ", ")
        .. "  [" .. Narvos.Inventory.UsedCells(grille) .. "/" .. Narvos.Inventory.MaxSlots(grille) .. "]"
    )
end

-- ── Ateliers de craft ───────────────────────────────────────────────────────────
-- Le craft est porté (Recettes.lua + Craft.lua, parité prouvée) mais jamais mis
-- en jeu : une recette sans station ne s'exécute nulle part. On pose donc les
-- 4 stations dans le monde (forge, workbench, alchemy, refinery) et on câble
-- Narvos:Crafter. La validation (station requise, entrées, palier) est faite par
-- Craft.Fabriquer ; ici on ne fait que relier grille + session + sauvegarde.
-- NB : le mesh (SM_Cube) est un placeholder ; les vrais meshes d'atelier ne sont
-- pas dans le pack cuit (côté éditeur/Unreal).

local RAYON_ATELIERS = 10.0 * M
local LABELS_STATION = { forge = "Forge", workbench = "Établi", alchemy = "Alchimie", refinery = "Raffinerie" }
local STATIONS_MONDE = { "forge", "workbench", "alchemy", "refinery" }
-- Station où le joueur se tient (posé au BeginOverlap du déclencheur). Évite de
-- crafter un objet « forge » depuis n'importe où via le client.
-- (`atelier_du_joueur` est declare en tete, avec les autres tables par joueur)
-- Forward : `Fabriquer` (plus haut) appelle SurCraftJoueur définie plus bas.
local SurCraftJoueur

--- Recettes d'une station, avec le compte possédé pour afficher le craftable.
local function RecettesDe(station, grille)
    local recettes = {}
    for _, id in ipairs(Narvos.Recettes.ORDRE) do
        local r = Narvos.Recettes.RECETTES[id]
        if (r and r.station == station) then
            local entrees = {}
            for _, e in ipairs(r.entrees) do
                entrees[#entrees + 1] = {
                    item_id = e.item_id, quantite = e.quantite,
                    possede = Narvos.Inventory.CountItem(grille, e.item_id),
                }
            end
            recettes[#recettes + 1] = {
                id = r.id, label = r.label, sortie = r.sortie.item_id,
                sortie_quantite = r.sortie.quantite, entrees = entrees, palier = r.palier,
            }
        end
    end
    return recettes
end

--- Envoie à un joueur les recettes de la station où il se tient.
local function OuvrirAtelier(player, station)
    local grille = inventaires[player]
    if (not grille) then return end
    Events.CallRemote("Narvos:Atelier", player, Reliability.Reliable,
        station, LABELS_STATION[station] or station, RecettesDe(station, grille))
end

--- Crafter une recette depuis une station : c'est le serveur qui décide, jamais
--- le client (grille réelle, recette réelle, palier réel), puis sauvegarde.
local function Fabriquer(player, station, recetteId)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "inventaire")) then return end
    local grille = inventaires[player]
    local s = Session and Session.De and Session.De(player) or nil
    if (not grille or not s or not s.perso) then
        Events.CallRemote("Narvos:AtelierErreur", player, Reliability.Reliable, "pas de session")
        return
    end
    if (atelier_du_joueur[player] ~= station) then
        Events.CallRemote("Narvos:AtelierErreur", player,Reliability.Reliable, 
            "Approchez-vous d'une station " .. (LABELS_STATION[station] or station))
        return
    end
    local recette = Narvos.Craft.Recette(recetteId)
    if (not recette) then
        Events.CallRemote("Narvos:AtelierErreur", player, Reliability.Reliable, "recette inconnue")
        return
    end
    local fin, raison = Narvos.Craft.Fabriquer(grille, recette, station, s.perso.level or 0)
    if (not fin) then
        Events.CallRemote("Narvos:AtelierErreur", player, Reliability.Reliable, raison or "craft impossible")
        return
    end
    inventaires[player] = fin
    EnregistrerSac(player)
    EnvoyerInventaire(player)

    -- L'XP de metier, APRES que l'objet est bien dans le sac : `Craft.Fabriquer`
    -- a deja refuse plus haut tout ce qui manquait (entrees, station, palier).
    GagnerXPMetier(player, Narvos.MetiersLogique.MetierDeStation(recette.station),
        function(metier)
            return Narvos.MetiersLogique.XpDeFabrication(Narvos.Metiers, metier, recette.palier)
        end)

    SurCraftJoueur(player, recette.sortie.item_id)
    Events.CallRemote("Narvos:AtelierFait", player, Reliability.Reliable, recetteId, recette.sortie.item_id)
end

--- Pose les 4 stations (prop + déclencheur) autour du point d'ancrage.
local function PoserAteliers()
    local poses = 0
    for i, station in ipairs(STATIONS_MONDE) do
        local position = SurCercle(i, #STATIONS_MONDE, RAYON_ATELIERS, SOL_Z)
        -- Le mesh vient du catalogue genere : la vraie station si sa cle est
        -- declaree, le cube sinon. Une reference morte ne leve RIEN dans nanos —
        -- le prop n apparait pas et le joueur croit a un trou du monde.
        Prop(position, Rotator(), Narvos.Ateliers.Mesh(station), CollisionType.Normal, false)

        -- ── LA STATION QUI TOURNE ────────────────────────────────────────────
        -- Le pack livre 27 stations ANIMEES : soufflet de forge, alambic,
        -- tour, perceuse. `CharacterSimple` accepte n importe quel mesh, sans
        -- contrainte de squelette — c est le patron deja eprouve sur les animaux
        -- (Server/Animaux.lua), et la seule voie pour un pack etranger.
        --
        -- ⚠ SANS COLLISION : le prop pose juste au-dessus porte deja la sienne.
        -- Deux volumes au meme endroit coinceraient le joueur.
        --
        -- ⚠ `PlayAnimation` sur une cle inconnue ne leve RIEN — la station
        -- resterait figee sans que personne l apprenne. D ou le couple
        -- mesh+animation pris dans le catalogue GENERE, qui ne le publie que si
        -- les DEUX cles sont declarees dans Assets.toml.
        local animee = Narvos.Ateliers.Animee(station)
        if (animee) then
            local pose_ok, entite = pcall(CharacterSimple, position, Rotator(),
                animee.mesh, "", CollisionType.NoCollision, true)
            if (pose_ok and entite) then
                pcall(function() entite:PlayAnimation(animee.animation, "", true) end)
            else
                Console.Warn("Atelier " .. tostring(station) .. " : station animee refusee ("
                    .. tostring(animee.mesh) .. ")")
            end
        end
        local trigger = Trigger(position, Rotator(), Vector(2.5 * M), TriggerType.Sphere,
            false, nil, { "Character" })
        trigger:Subscribe("BeginOverlap", function(_, acteur)
            local player = JoueurDe(acteur)
            if (not player) then return end
            atelier_du_joueur[player] = station
            OuvrirAtelier(player, station)
        end)
        trigger:Subscribe("EndOverlap", function(_, acteur)
            local player = JoueurDe(acteur)
            if (not player) then return end
            atelier_du_joueur[player] = nil
            -- Fermer le panneau : liste vide = « plus d'atelier ici » côté client.
            Events.CallRemote("Narvos:Atelier", player, Reliability.Reliable,
                station, LABELS_STATION[station] or station, {})
        end)
        if (trigger:IsValid()) then poses = poses + 1 end
    end
    return poses
end

-- Le client envoie une INTENTION (station + recette) ; le serveur décide.
Events.SubscribeRemote("Narvos:Crafter", function(player, station, recetteId)
    Fabriquer(player, station, recetteId)
end)

--- Pose l'établi d'assemblage : 5ᵉ point du cercle des stations, le même patron
--- (prop repère + déclencheur de proximité). La logique — garde de proximité,
--- ouverture/fermeture de l'interface, handlers — vit dans Server/Assemblage.lua.
local function PoserEtabliAssemblage()
    return Narvos.AssemblageServeur.PoserEtabli(
        SurCercle(5, 5, RAYON_ATELIERS, SOL_Z), 2.5 * M)
end

-- ── Récolte (EXPLORE → RÉCOLTE → RESSOURCES) ────────────────────────────────────
-- Recolte.lua est pur ; le serveur fournit l'horloge, le RNG, l'état du joueur.
local maintenant_ms = 0
Timer.SetInterval(function() maintenant_ms = maintenant_ms + 1000 end, 1000)
-- Temps réel pour `repousse_ms` (un serveur qui rame ferait dériver l'horloge
-- logique). Repli sûr sur `maintenant_ms` si `os.time` est indisponible.
local function HorlogeMs()
    local ok, t = pcall(os.time)
    if (ok and type(t) == "number") then return t * 1000 end
    return maintenant_ms
end

-- (`gisement_proche` est declare en tete, avec les autres tables par joueur)
local gisement_etats = {}    -- gisement_id -> etat (état world du node)

-- ── POSE MANUELLE DES ENTITÉS (2026-09-19) ────────────────────────────────────
-- Les gisements et ateliers posés À LA MAIN depuis le menu de props, en plus du
-- cercle automatique. Une pose = un prop + un déclencheur + un état + une ligne
-- de persistance (`Narvos.PoseRecolte` décide, `ReposerPosees` rejoue au
-- démarrage). Les nœuds du cercle restent dans `gisement_etats` ; chaque
-- INSTANCE porte SON état, pour qu'un filon posé à la main repousse pour lui.
local poses_entites = {}     -- cle -> { plan, prop, trigger, ref, etat? }

--- Le gisement que désigne cet identifiant — instance posée à la main, ou
--- nœud du catalogue — et SON état. Sans cette résolution, récolter une
--- instance lirait l'état du nœud du catalogue : deux filons partageraient
--- la même repousse.
local function RefDeGisement(id)
    local pose = poses_entites[id]
    if (pose) then return pose.ref, pose.etat end
    return id, gisement_etats[id]
end

-- ⚠ L'ENSEMBLE DES OUTILS, PAS LE PREMIER. Jusqu'au 2026-09-13 cette fonction
-- rendait le premier outil d'une liste recopiee en dur { pioche, foreuse,
-- collecteur } : un joueur porteur d'une pioche ET d'une foreuse etait « a
-- pioche » pour toujours, et tout gisement a foreuse lui repondait « il te faut
-- une foreuse ». La liste vient maintenant du catalogue (`Recolte.OutilsRequis`).
local function OutilsDuJoueur(player)
    local outils = {}
    local grille = inventaires[player]
    if (not grille) then return outils end
    for _, outil in ipairs(Narvos.Recolte.OutilsRequis()) do
        if (Narvos.Inventory.CountItem(grille, outil) > 0) then outils[outil] = true end
    end
    return outils
end

local function EtatJoueur(player)
    local s = Session.De(player)
    return { outils = OutilsDuJoueur(player), palier = (s and s.perso and s.perso.level) or 1 }
end

-- Envoie au client de quoi afficher l'état du gisement (pret ? outil ? palier ?).
local function Reperer(player, gisement_id)
    gisement_proche[player] = gisement_id
    -- Instance posée à la main, ou nœud du catalogue : chaque entité a SON état.
    local ref, etat = RefDeGisement(gisement_id)
    local gisement = Narvos.Recolte.Gisement(ref)
    if (gisement == nil) then Events.CallRemote("Narvos:GisementErreur", player, Reliability.Reliable, "gisement inconnu"); return end
    local ok, raison = Narvos.Recolte.Peut(gisement, EtatJoueur(player))
    Events.CallRemote("Narvos:Gisement", player, Reliability.Reliable, {
        id = gisement_id,
        ressource = gisement.ressource,
        ready = Narvos.Recolte.EstPret(gisement, etat, HorlogeMs()),
        ok = ok,
        raison = raison,
    })
end

local function PoserGisements()
    local i = 0
    for _, gisement_id in ipairs(Narvos.Recolte.Sequence()) do
        i = i + 1
        local position = SurCercle(i, #Narvos.Recolte.Sequence(), RAYON_ATELIERS, SOL_Z)
        gisement_positions[gisement_id] = position

        -- ── LE VRAI MESH, LE CUBE EN REPLI ────────────────────────────────────
        -- Mesure du 2026-09-13 : les six gisements etaient poses en
        -- `nanos-world::SM_Cube`, tous. Un filon, une grotte a cristaux et un
        -- organisme alien : six cubes gris identiques. Le catalogue n'avait pas de
        -- champ `mesh` — Gisements.lua le disait lui-meme : il s'ajouterait apres
        -- l'import dans l'ADK et un cook.
        --
        -- Les minerais de Hyper et les rochers de Crystals sont maintenant cuits :
        -- un gisement qui porte `mesh` l'affiche. Le cube reste le repli, pour
        -- qu'un gisement sans mesh reste VISIBLE et atteignable — un gisement
        -- invisible serait une recolte que personne ne trouve.
        local def = Narvos.Recolte.Gisement(gisement_id)
        local mesh = (def and type(def.mesh) == "string" and def.mesh ~= "") and def.mesh
            or "nanos-world::SM_Cube"
        Prop(position, Rotator(), mesh, CollisionType.Normal, false)
        gisement_etats[gisement_id] = Narvos.Recolte.EtatNeuf(gisement_id)
        local trigger = Trigger(position, Rotator(), Vector(2.5 * M), TriggerType.Sphere,
            false, nil, { "Character" })
        trigger:Subscribe("BeginOverlap", function(_, acteur)
            local player = JoueurDe(acteur)
            if (player) then Reperer(player, gisement_id) end
        end)
        trigger:Subscribe("EndOverlap", function(_, acteur)
            local player = JoueurDe(acteur)
            if (player and gisement_proche[player] == gisement_id) then
                gisement_proche[player] = nil
                -- Fermer le panneau cote client : sans ce message il restait
                -- affiche apres la sortie de zone (audit du 2026-09-11).
                Events.CallRemote("Narvos:Gisement", player, Reliability.Reliable, false)
            end
        end)
    end
end

-- ── POSE MANUELLE : le poseur que le menu de props appelle ────────────────────
-- `Server/Props.lua` délègue ici quand l'identifiant posé est une ENTITÉ de jeu
-- (`Narvos.PoseRecolte.ENTREES` : gisements et ateliers). Même patron que les
-- nœuds automatiques — prop + déclencheur sphérique de 2,5 m + état —, plus la
-- ligne de persistance que `ReposerPosees` rejouera au prochain démarrage.

--- Clé du fichier `.data/PersistentData.toml` du package.
local POSE_CLE_PERSISTANCE = "recolte_places"

local function EnregistrerPosees()
    local lignes = {}
    for _, pose in pairs(poses_entites) do
        lignes[#lignes + 1] = Narvos.PoseRecolte.LigneDe(pose.plan)
    end
    pcall(function()
        Package.SetPersistentData(POSE_CLE_PERSISTANCE, Narvos.PoseRecolte.Serialiser(lignes))
    end)
end

--- Pose UNE entité (gisement ou atelier) avec son déclencheur et son état.
--- `persister` = true en pose manuelle ; false pendant la relecture au
--- démarrage (une seule écriture à la fin, pas une par entité).
local function PoserEntite(id, position, yaw, persister)
    local cles = {}
    for cle in pairs(poses_entites) do cles[#cles + 1] = cle end
    local plan, raison = Narvos.PoseRecolte.PlanDePose(
        Narvos.PoseRecolte.ENTREES, cles, id, position, yaw)
    if (not plan) then return false, raison end

    local ok, prop = pcall(Prop, position, Rotator(0, yaw, 0), plan.mesh)
    if (not ok or not prop) then return false, "Pose impossible" end
    -- L'export doit savoir CE QU'EST le prop, pas seulement où il est — même
    -- discipline que `narvos_asset` côté décors.
    pcall(function() prop:SetValue("narvos_entite", plan.cle, false) end)

    local trigger = Trigger(position, Rotator(), Vector(plan.trigger.rayon_m * M),
        TriggerType.Sphere, false, nil, { "Character" })

    local pose = { plan = plan, prop = prop, trigger = trigger, ref = plan.ref }

    if (plan.kind == "gisement") then
        pose.etat = Narvos.Recolte.EtatNeuf(plan.ref)
        if (trigger and trigger:IsValid()) then
            trigger:Subscribe("BeginOverlap", function(_, acteur)
                local p = JoueurDe(acteur)
                if (p) then Reperer(p, plan.cle) end
            end)
            trigger:Subscribe("EndOverlap", function(_, acteur)
                local p = JoueurDe(acteur)
                if (p and gisement_proche[p] == plan.cle) then
                    gisement_proche[p] = nil
                    Events.CallRemote("Narvos:Gisement", p, Reliability.Reliable, false)
                end
            end)
        end
    else
        if (trigger and trigger:IsValid()) then
            -- Atelier posé à la main : même contrat que les stations du cercle —
            -- le joueur CRAFTE où il se tient, jamais depuis n'importe où.
            -- ⚠ L'ÉTABLI D'ASSEMBLAGE (2026-09-19) : son système n'est pas le
            -- craft mais l'assemblage pièce par pièce — il branche le MÊME
            -- déclencheur vers AssemblageServeur.Entrer/Sortir.
            if (plan.kind == "etabli") then
                trigger:Subscribe("BeginOverlap", function(_, acteur)
                    local p = JoueurDe(acteur)
                    if (p and Narvos.AssemblageServeur) then Narvos.AssemblageServeur.Entrer(p) end
                end)
                trigger:Subscribe("EndOverlap", function(_, acteur)
                    local p = JoueurDe(acteur)
                    if (p and Narvos.AssemblageServeur) then Narvos.AssemblageServeur.Sortir(p) end
                end)
            else
                trigger:Subscribe("BeginOverlap", function(_, acteur)
                    local p = JoueurDe(acteur)
                    if (not p) then return end
                    atelier_du_joueur[p] = plan.ref
                    OuvrirAtelier(p, plan.ref)
                end)
                trigger:Subscribe("EndOverlap", function(_, acteur)
                    local p = JoueurDe(acteur)
                    if (not p) then return end
                    atelier_du_joueur[p] = nil
                    Events.CallRemote("Narvos:Atelier", p, Reliability.Reliable,
                        plan.ref, LABELS_STATION[plan.ref] or plan.ref, {})
                end)
            end
        end
    end

    poses_entites[plan.cle] = pose
    if (persister) then EnregistrerPosees() end
    return true, nil
end

--- Rejoue au démarrage tout ce qui a été posé à la main. L'ordre est celui du
--- tri de `Serialiser` : déterministe, donc les clés d'instance retombent
--- exactement sur les mêmes.
local function ReposerPosees()
    local ok, tout = pcall(Package.GetPersistentData)
    local texte = (ok and type(tout) == "table") and tout[POSE_CLE_PERSISTANCE] or nil
    if (type(texte) ~= "string" or texte == "") then return 0 end
    local n = 0
    for _, ligne in ipairs(Narvos.PoseRecolte.DepuisPersistance(texte)) do
        local pose_ok, raison = PoserEntite(ligne.id, ligne.position, ligne.yaw, false)
        if (pose_ok) then
            n = n + 1
        else
            Console.Warn("[POSE] relecture refusee pour " .. tostring(ligne.id)
                .. " : " .. tostring(raison))
        end
    end
    if (n > 0) then EnregistrerPosees() end
    Console.Log(("[POSE] %d entite(s) posee(s) a la main relue(s) depuis la persistance"):format(n))
    return n
end

-- Le menu de props délègue ici toute pose d'ENTITÉ de jeu. Appelé AU CHARGEMENT,
-- après `PropsServeur` (en tête) et après les déclarations ci-dessus.
Narvos.PropsServeur.UtiliserPoseurEntite(function(player, id, position, yaw)
    return PoserEntite(id, position, yaw, true)
end)

-- ── Radar (mini-carte) ───────────────────────────────────────────────────────
--
-- ⚠ CE HANDLER PORTAIT QUATRE DÉFAUTS, TOUS MESURÉS LE 2026-09-09. Ils sont de
-- la même famille : une grandeur transmise sans son unité ni son axe, et une
-- page qui suppose les deux.
--
--   1. Les distances partaient en CENTIMÈTRES (`player:GetLocation()` et les
--      positions des catalogues sont en unités Unreal). La page les comparait à
--      `RAYON_RADAR_M = 600`, lu comme des mètres. Le radar affichait donc SIX
--      MÈTRES en annonçant « rayon 600 m ». Sept repères sur huit tombaient en
--      chevron de bord. Le facteur `M` (ligne 22) est utilisé par
--      `RAYON_ATELIERS` et par les sphères de déclenchement du même fichier :
--      seul le radar l'ignorait.
--
--   2. L'étiquette affichée au joueur héritait de la même erreur — un facteur
--      100 sur un nombre qu'il lit.
--
--   3. **Le radar projetait le mauvais PLAN.** Il envoyait `pos.z` et `gpos.z`,
--      c'est-à-dire l'ALTITUDE. Chez Unreal le sol est le plan X/Y, Z est la
--      hauteur ; `SurCercle` (ligne 201) le dit explicitement : `cos → X`,
--      `sin → Y`, `Z = ANCRE.Z + z`. Les six gisements partagent donc UN SEUL Z
--      (mesuré : 180 134 pour les six) et s'empilaient sur une même ordonnée.
--      L'axe vertical du radar ne montrait pas le nord/sud : il montrait un
--      écart d'altitude, nul par construction.
--
--   4. `Logic/Radar.lua` — module pur, prouvé par `lua-harness/radar.mjs` contre
--      le TS d'origine — n'était **pas câblé** dans `Shared/Index.lua`, donc
--      inutilisable. C'est le défaut qui a tué le serveur le 2026-09-08 avec
--      `Narvos.Mondes` : présent sur le disque, absent du moteur.
--
-- Le nom `worldZ` du module vient de son origine Three.js, où l'axe vertical est
-- Y et le sol le plan X/Z. On lui passe donc le **Y d'Unreal** : c'est la même
-- mathématique, c'est le nom qui trompe. Ne pas « corriger » le module — le
-- harnais le compare au TS ligne à ligne.
local PORTEE_RADAR_M = 600.0  -- au-delà, la page dessine un chevron orienté
local MAX_REPERES = 64        -- plafond du fil ; 14 repères existent aujourd'hui

Events.SubscribeRemote("Narvos:DemanderRadar", function(player)
    -- ⚠ `GetLocation` EST SUR LE CHARACTER, PAS SUR LE PLAYER. Un Player n'a pas
    -- de position : il pilote un personnage qui, lui, en a une. Mesuré en jeu le
    -- 2026-09-11 — « attempt to call a nil value (method 'GetLocation') » à
    -- CHAQUE rafraîchissement du radar (600 ms), quinze fois en dix secondes, et
    -- le panneau restait vide. Rien ne l'avait vu : le radar n'a pas de harnais
    -- de bout en bout, et `Logic/Radar.lua` — prouvé, lui — reçoit des nombres.
    local character = player:GetControlledCharacter()
    if (not character or not character:IsValid()) then return end
    local pos = character:GetLocation()
    -- Conversion cm → m UNE SEULE FOIS, ici. Tout ce qui sort de ce handler est
    -- en mètres, y compris pour l'étiquette.
    --
    -- ⚠ `X` `Y` `Z` EN MAJUSCULES. Un Vector nanos n'a pas de champ `x` : le
    -- lire rend nil, et le diviser LÈVE. Mesuré en jeu le 2026-09-12 —
    -- « attempt to perform arithmetic on a nil value (field 'x') » à chaque
    -- rafraîchissement du radar, et le panneau restait vide. Les tables de
    -- `Logic/Teleports.lua`, elles, sont des tables Lua à nous et gardent leurs
    -- minuscules : c'est la NATURE de l'objet qui décide, pas l'habitude.
    local jx, jy = pos.X / M, pos.Y / M

    -- Styles réglés par /editionpnj (Server/EditionPnj.lua) : couleur, taille,
    -- visibilité par sorte de repère. Sans le module, le défaut d'avant.
    local Edition = Narvos.EditionPnjServeur
    local points = {}
    local style_ressource = Edition and Edition.StylePour("ressource") or nil
    if (not style_ressource or style_ressource.visible) then
        for gisement_id, gpos in pairs(gisement_positions) do
            local gisement = Narvos.Recolte.Gisement(gisement_id)
            points[#points + 1] = {
                x = gpos.X / M, z = gpos.Y / M,   -- z = le Y d'Unreal : le plan du SOL
                label = (gisement and gisement.label) or gisement_id,
                -- Une table distincte par repère : le sérialiseur nanos traite
                -- aussi les références partagées comme des tables récursives.
                teinte = style_ressource and {
                    style_ressource.teinte[1], style_ressource.teinte[2], style_ressource.teinte[3],
                } or { 0.55, 0.85, 1.0 },
                taille = style_ressource and style_ressource.taille or nil,
                sorte = "ressource",
            }
        end
    end
    -- PNJ vivants, animaux, véhicules (demande B5) : déjà filtrés, stylés et
    -- limités à la portée de lecture ; le tri et le plafond ci-dessous valent
    -- pour eux comme pour les gisements.
    if (Edition) then
        for _, p in ipairs(Edition.PointsEntites(character, M)) do points[#points + 1] = p end
    end
    -- Les portails restent TOUJOURS envoyés, quelle que soit leur distance :
    -- à l'échelle solaire ils sont à des dizaines de kilomètres et leur rôle
    -- est justement d'être une boussole, pas un point de proximité.
    local portails = {}
    local style_portail = Edition and Edition.StylePour("portail") or nil
    if (not style_portail or style_portail.visible) then
        for _, liaison in ipairs(Narvos.Mondes.LIAISONS) do
            portails[#portails + 1] = {
                x = liaison.position.X / M, z = liaison.position.Y / M,
                label = liaison.label,
                -- La teinte d'un portail est CELLE DE SA LIAISON (elle code la
                -- destination) : le réglage n'en change que la taille.
                teinte = { liaison.teinte.r, liaison.teinte.g, liaison.teinte.b },
                taille = style_portail and style_portail.taille or nil,
                sorte = "portail",
            }
        end
    end

    -- Le module trie par distance et plafonne. Les gisements peuvent se
    -- multiplier ; le fil, lui, ne doit pas suivre — ce message part toutes les
    -- secondes tant que le panneau est ouvert.
    local proches = Narvos.Radar.Points(points, jx, jy, PORTEE_RADAR_M, MAX_REPERES)
    local retenus = {}
    for _, e in ipairs(proches) do retenus[#retenus + 1] = e.point end
    for _, p in ipairs(portails) do retenus[#retenus + 1] = p end

    Events.CallRemote("Narvos:Radar", player, Reliability.Reliable, {
        joueur = { x = jx, z = jy },
        points = retenus,
        -- La portée voyage AVEC les données : l'étiquette de la page et son
        -- seuil de dessin viennent de la même source que le filtrage serveur.
        -- Deux constantes égales de part et d'autre d'une frontière finissent
        -- toujours par diverger.
        rayon_m = PORTEE_RADAR_M,
    })
end)

-- ═══ RAMASSER — du monde vers le sac ═════════════════════════════════════════
--
-- Mesure du 2026-09-12 : le projet n'avait AUCUN ramassage. Les objets poses par
-- `/prop` ou `/arme` restaient du decor, et le sac ne se remplissait que par le
-- butin des zones. Hanibes l'a signale trois fois.
--
-- La DECISION (portee, plus proche, etiquette -> objet) vit dans
-- `narvos/Shared/Logic/Ramassage.lua`, testable hors moteur. Ce module-ci parle
-- a nanos. On lui INJECTE l'acces au sac plutot que d'exposer `inventaires` :
-- deux chemins d'ecriture vers la meme grille, c'est ainsi qu'on perd du butin.
Narvos.RamassageServeur = Package.Require("Server/Ramassage.lua")
Narvos.RamassageServeur.Configurer({
    grille = function(player) return inventaires[player] end,
    ecrire = function(player, grille)
        local ancienne = inventaires[player]
        inventaires[player] = grille
        if (not EnregistrerSac(player)) then inventaires[player] = ancienne; return false end
        EnvoyerInventaire(player)
        return true
    end,
})

Events.SubscribeRemote("Narvos:Ramasser", function(player)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "interaction")) then return end
    local ok, message = Narvos.RamassageServeur.Ramasser(player)
    Chat.SendMessage(player, ok
        and ("<cyan>ramasse :</> " .. tostring(message))
        or ("<grey>" .. tostring(message) .. "</>"))
end)

-- ═══ MENOTTES — l'executant de Logic/Menottes.lua ═══════════════════════════════
--
-- Mesure du 2026-09-13 : la decision (qui menotte qui, capacites perdues,
-- evasion) etait ecrite et prouvee depuis septembre — 110 assertions — et AUCUN
-- fichier du serveur ne l'appelait. Les assets du pack Multiplayer_Handcuff_System
-- entrent au cook du meme jour (SM_Handcuff, AS_Handcuffed, Wav_Handcuff_Sound).
-- Meme patron que le ramassage : on INJECTE l'acces au sac et aux droits.
Narvos.MenottesServeur = Package.Require("Server/Menottes.lua")
Narvos.MenottesServeur.Configurer({
    grille = function(player) return inventaires[player] end,
    est_admin = PeutGerer,
})
do
    -- Le point d'injection prevu par le module : il ne nomme jamais l'asset.
    local ok, raison = Narvos.Menottes.Configurer({
        animation_menotte = Narvos.MenottesServeur.ASSETS.animation,
    })
    if (not ok) then Console.Error("Menottes : configuration refusee — " .. tostring(raison)) end
end

Events.SubscribeRemote("Narvos:Menotter", function(player)
    if (not Session.EnJeu(player)) then return end
    local ok, message = Narvos.MenottesServeur.Agir(player)
    Chat.SendMessage(player, ok
        and ("<cyan>" .. tostring(message) .. "</>")
        or ("<grey>" .. tostring(message) .. "</>"))
end)

-- ═══ TALKIE-WALKIE, SMARTPHONE, DIGICODE — les exécutants du 2026-09-13 ═════════
--
-- Les décisions (Logic/Radio, Telephone, Digicode, TexteChat) sont prouvées par
-- 93 assertions. Ici on les BRANCHE : même patron d'injection que le ramassage et
-- les menottes — l'exécutant ne connaît ni `inventaires`, ni la session, ni les
-- zones ; on les lui passe.
local function NomDuPersonnage(player)
    local s = Session.De(player)
    return s and s.perso and s.perso.name or nil
end

Narvos.CommunicationsServeur = Package.Require("Server/Communications.lua")
Narvos.CommunicationsServeur.Configurer({
    grille = function(player) return inventaires[player] end,
    est_admin = PeutGerer,
    nom = NomDuPersonnage,
})

Narvos.DigicodeServeur = Package.Require("Server/Digicode.lua")
Narvos.DigicodeServeur.Configurer({
    base = Narvos.Comptes.Base(),
    grille = function(player) return inventaires[player] end,
    ecrire = function(player, grille)
        inventaires[player] = grille
        EnregistrerSac(player)
        EnvoyerInventaire(player)
    end,
    compte_de = function(player)
        local s = Session.De(player)
        return s and s.compte and s.compte.id or nil
    end,
    -- LA garde des props, telle quelle : voir `PeutEditerIci` plus haut.
    peut_editer_ici = PeutEditerIci,
    joueur_de = JoueurDe,
    est_admin = PeutGerer,
})
Narvos.DigicodeServeur.Charger()

-- Le player ENVOIE une intention Récolter (station du clic) ; le serveur décide.
Events.SubscribeRemote("Narvos:Recolter", function(player, gisement_id)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "interaction")) then return end
    local ref, etat = RefDeGisement(gisement_id)
    local gisement = Narvos.Recolte.Gisement(ref)
    local grille = inventaires[player]
    local s = Session.De(player)
    if (gisement == nil) then Events.CallRemote("Narvos:GisementErreur", player, Reliability.Reliable, "gisement inconnu"); return end
    if (grille == nil or s == nil or s.perso == nil) then return end
    if (not Narvos.Recolte.EstPret(gisement, etat, HorlogeMs())) then
        Events.CallRemote("Narvos:GisementErreur", player, Reliability.Reliable, "pas encore prêt"); return end
    local ok, raison = Narvos.Recolte.Peut(gisement, EtatJoueur(player))
    if (not ok) then Events.CallRemote("Narvos:GisementErreur", player, Reliability.Reliable, raison or "récolte impossible"); return end
    local rendement, rRaison = Narvos.Recolte.Rendement(gisement, s.perso.level or 1, math.random)
    if (not rendement) then Events.CallRemote("Narvos:GisementErreur", player, Reliability.Reliable, rRaison or "tirage invalide"); return end
    for _, drop in ipairs(rendement) do
        local def = Narvos.Inventory.GetItemDef(drop.item_id)
        if (def == nil) then
            Events.CallRemote("Narvos:GisementErreur", player, Reliability.Reliable, "item inconnu: " .. tostring(drop.item_id)); return end
        local suivante = Narvos.Inventory.AddItemToGrid(grille, def, drop.quantite)
        if (suivante == nil) then
            Events.CallRemote("Narvos:GisementErreur", player, Reliability.Reliable, "sac plein"); return end
        grille = suivante
    end
    local nouveau = Narvos.Recolte.MarquerRecolte(etat, HorlogeMs())
    local pose = poses_entites[gisement_id]
    if (pose) then pose.etat = nouveau else gisement_etats[gisement_id] = nouveau end
    inventaires[player] = grille
    EnregistrerSac(player)
    EnvoyerInventaire(player)

    -- ── L'XP DE METIER, APRES LE SAC ─────────────────────────────────────────
    -- APRES : si le sac est plein, la recolte a echoue plus haut et ne doit rien
    -- rapporter. Une XP gagnee sur un objet qu'on n'a pas pu garder ferait monter
    -- un metier en recoltant dans le vide.
    GagnerXPMetier(player, Narvos.MetiersLogique.MetierDOutil(gisement.outil),
        function(metier)
            local total = 0
            for _, drop in ipairs(rendement) do total = total + (tonumber(drop.quantite) or 0) end
            return Narvos.MetiersLogique.XpDeRecolte(Narvos.Metiers, metier, gisement.palier, total)
        end)

    -- ── LE GESTE ───────────────────────────────────────────────────────────────
    -- La recolte etait instantanee et IMMOBILE : le sac se remplissait devant un
    -- personnage qui ne bougeait pas. Les animations de Farming And Mining sont
    -- cuites sur SKEL_Mannequin (cook du 2026-09-13) : l'outil apparait en main,
    -- le coup se joue, l'outil repart. `Recolte.GesteDe` decide, ici on joue.
    local geste = Narvos.Recolte.GesteDe(gisement)
    local recolteur = player:GetControlledCharacter()
    if (geste and recolteur and recolteur:IsValid()) then
        pcall(function() recolteur:AddStaticMeshAttached("narvos_outil_recolte", geste.mesh, "hand_r") end)
        pcall(function()
            recolteur:PlayAnimation(geste.animation, AnimationSlotType.FullBody, false, 0.15, 0.25, 1.0, false)
        end)
        Timer.SetTimeout(function()
            if (recolteur:IsValid()) then
                pcall(function() recolteur:RemoveStaticMeshAttached("narvos_outil_recolte") end)
            end
        end, 1800)
    end

    Events.CallRemote("Narvos:GisementFait", player, Reliability.Reliable, rendement[1].item_id, rendement[1].quantite)
end)

-- ── Quêtes & dialogue (serveur) ────────────────────────────────────────────────
-- Les moteurs `Logic/Quetes.lua` et `Logic/Dialogue.lua` sont purs ; ici on les
-- relie : état par joueur (snapshot), hooks (kill/craft/collect), récompenses,
-- et émission d'UI pour les dialogues.
local quetes_etats = {}   -- player -> QuestState (persistance)
local dialogue_actifs = {} -- player -> dialogue_id en cours

Narvos.Quetes.Initialiser(Narvos.QuetesCatalog)
Narvos.Quetes.Callbacks(
    function(etat) end, -- la persistance se fait par snapshot explicite (SauverQuetes)
    function(nom, donnees) end
)
Narvos.Dialogue.EnregistrerTout(Narvos.DialoguesCatalog.DIALOGUES)

local function ChargerQuetes(player)
    Narvos.Quetes.Charger(quetes_etats[player])
end
local function SauverQuetes(player)
    quetes_etats[player] = Narvos.Quetes.Etat()
end

--- Octroie la récompense d'une quête juste complétée (xp/credits/items).
local function OctroyerRecompense(player, def)
    if (def == nil or def.reward == nil) then return end
    local s = Session.De(player)
    local grille = inventaires[player]
    -- ⚠ CETTE LIGNE AJOUTAIT L'XP AU CHAMP `niveau` (2026-09-13) : un champ que
    -- personne ne lit (la fiche porte `level`), et un montant d'XP compte comme
    -- des niveaux. L'XP passe desormais par la courbe du personnage.
    if (def.reward.xp and Narvos.ProgressionServeur) then
        Narvos.ProgressionServeur.GagnerXP(player, def.reward.xp, "quete")
    end
    if (def.reward.credits and s and s.perso and s.compte) then
        s.perso.credits = (tonumber(s.perso.credits) or 0) + (tonumber(def.reward.credits) or 0)
        -- La bourse n'est PAS dans le blob du sac : sans MajCredits, la
        -- recompense disparaissait a la reconnexion (meme regle que la boutique).
        local ok_c, pourquoi_c = Narvos.Roster.MajCredits(s.compte.id, s.perso.id, s.perso.credits)
        if (not ok_c) then Console.Warn("Quete : solde non persiste — " .. tostring(pourquoi_c)) end
    end
    if (def.reward.items and grille) then
        for _, item_id in ipairs(def.reward.items) do
            local it = Narvos.Inventory.GetItemDef(item_id)
            if (it) then
                local suivante = Narvos.Inventory.AddItemToGrid(grille, it, 1)
                if (suivante) then grille = suivante end
            end
        end
        inventaires[player] = grille
    end
    if (def.reward.items or def.reward.xp or def.reward.credits) then
        EnregistrerSac(player)
        EnvoyerInventaire(player)
    end
end

--- Hook : un kill ennemi vient de survenir.
local function SurKillJoueur(player, folder)
    ChargerQuetes(player)
    local terminees = Narvos.Quetes.SurKill(folder)
    for _, def in ipairs(terminees) do OctroyerRecompense(player, def) end
    SauverQuetes(player)
end

-- ── Hook kill : la quête « tue N » progresse au coup FATAL ─────────────────────
-- Approche #2 : lire `instigator` depuis l'événement `Death` (VÉRIFIÉ
-- `BaseDamageable.json:204-237` : `Death(self, last_damage_taken, last_bone_damaged,
-- damage_type_reason, hit_from_direction, instigator: Player?, causer: Actor?)`).
-- Décision : `instigator` = le joueur au coup FATAL. Environnemental (chute,
-- poison, lave) => `instigator` = nil => AUCUN crédit. Un autre joueur qui achève
-- => l'instigator de CE coup est crédité (dernier coup = crédit de kill, standard).
-- Aucune table par joueur à purger : `instigator` est un argument d'événement,
-- pas un état. (La voie #1 « dernier agresseur » exigerait une table + purge.)
-- `folder` : nil ici = matche les quêtes « tuer N » sans enemyFolder. Les quêtes à
-- enemyFolder (ex. "space_ship") relèvent d'un contexte spatial absent du hub — le
-- getter du folder d'entité n'a pas pu être confirmé dans l'API (voir rubrique).
Character.Subscribe("Death", function(self, last_damage_taken, bone, damage_type_reason, hit_direction, instigator, causer)
    if (instigator ~= nil) then
        -- folder(s) de l'ennemi = ses tags (GetActorTags, BaseActor.json) : une quête
        -- `enemyFolder:"space_ship"` matche si l'ennemi porte ce tag. Repli nil (kill-any).
        local tags = nil
        if (type(self) == "table" and self.GetActorTags) then
            local ok_t, res = pcall(self.GetActorTags, self)
            if (ok_t and type(res) == "table" and #res > 0) then tags = res end
        end
        SurKillJoueur(instigator, tags)
    end
end)

--- Hook : un item vient d'être fabriqué.
SurCraftJoueur = function(player, item_id)
    ChargerQuetes(player)
    local terminees = Narvos.Quetes.Fabriquer(item_id)
    for _, def in ipairs(terminees) do OctroyerRecompense(player, def) end
    SauverQuetes(player)
end

--- Le joueur démarre un dialogue avec un PNJ (côté serveur, il décide).
--- Curseur de conversation PAR JOUEUR.
---
--- ⚠ `dialogue_actifs` ne retient que QUEL dialogue le joueur suit. Le curseur
--- (noeud courant, historique, variables) vit dans `Logic/Dialogue.lua` et y est
--- UNIQUE. Sans cette table, deux joueurs en conversation se marchaient dessus :
--- le choix de l un faisait avancer le dialogue de l autre. Meme encadrement que
--- `ChargerQuetes` / `SauverQuetes`, qui etait deja correct.
--- Trouve le 2026-09-07 en verifiant le cablage du lot M5.
local dialogue_curseurs = {}
local dialogue_joueur = nil  -- joueur courant pour l'évaluateur de conditions de dialogue

-- Déclaration avancée : l'exécuteur d'actions passé à `Dialogue.Callbacks` plus
-- bas l'appelle, mais elle n'est définie qu'avec le reste des marchands. Sans
-- ce `local`, la fermeture capturerait une GLOBALE nil (le piège des portées,
-- déjà rencontré cinq fois dans ce dépôt).
local EnvoyerBoutique

-- ── Réputation par joueur (runtime) : état vide au premier accès. ──
local rep_joueurs = {}
local function ReputationDe(player)
    if (rep_joueurs[player] == nil) then rep_joueurs[player] = Narvos.Reputation.EtatVide() end
    return rep_joueurs[player]
end

-- ── Évaluateur de conditions de dialogue (injecté une fois) : la CAPACITÉ qui
-- manquait (`reputation_min` existait dans les données, aucun système ne la satisfaisait).
--
-- ⚠ `Callbacks`, ET PAS `Injecter`. `Injecter` n'a jamais existé dans
-- `Logic/Dialogue.lua` — trouvé le 2026-09-08 en câblant `Narvos.Dialogue`.
-- L'appel aurait levé « attempt to call a nil value (field 'Injecter') » dès que
-- cette ligne serait atteinte, et rien ne le signalait avant : le module n'était
-- pas câblé, donc `Narvos.Dialogue` valait nil et la ligne 55 mourait d'abord.
--
-- La vraie signature est `Dialogue.Callbacks(evalCond, execAct)` — deux
-- fonctions, la seconde optionnelle. On ne passe que l'évaluateur de conditions.
-- Le joueur dont un nœud vient d'ouvrir la boutique : DialogueChoisir ne
-- renvoie alors pas le nœud (le panneau boutique est déjà à l'écran).
local boutique_envoyee = nil

Narvos.Dialogue.Callbacks(function(page, conditions)
    if (dialogue_joueur == nil) then return true end
    for _, c in ipairs(conditions or {}) do
        local p = c.params or {}
        if (c.type == "reputation_min") then
            if ((ReputationDe(dialogue_joueur)[p.faction] or 0) < (tonumber(p.min) or 0)) then return false end
        elseif (c.type == "reputation_max") then
            if ((ReputationDe(dialogue_joueur)[p.faction] or 0) > (tonumber(p.max) or 999999)) then return false end
        elseif (c.type == "level_min") then
            local perso = EtatJoueur(dialogue_joueur)
            if (((perso and perso.palier) or 0) < (tonumber(p.min) or 0)) then return false end
        elseif (c.type == "level_max") then
            local perso = EtatJoueur(dialogue_joueur)
            if (((perso and perso.palier) or 0) > (tonumber(p.max) or 999999)) then return false end
        end
    end
    return true
end, function(page, actions)
    -- Exécuteur d'actions de dialogue (second paramètre de `Callbacks`,
    -- facultatif). Une seule action existe aujourd'hui : `ouvrir_boutique`,
    -- posée par les dialogues GÉNÉRÉS des marchands (plus bas). `dialogue_joueur`
    -- est le joueur dont la conversation est chargée à cet instant — c'est lui,
    -- et personne d'autre, qui reçoit le stock.
    for _, a in ipairs(actions or {}) do
        if (a.type == "ouvrir_boutique" and dialogue_joueur) then
            EnvoyerBoutique(dialogue_joueur, a.params and a.params.marchand)
            boutique_envoyee = dialogue_joueur
        end
    end
end)

--- Ce que le client affiche d'un nœud : qui parle, le texte, et les choix DÉJÀ
--- FILTRÉS par leurs conditions. Le client renvoie l'INDICE d'un choix dans CETTE
--- liste — `Dialogue.Choix` compte dans la liste filtrée : envoyer le nœud brut
--- afficherait des choix verrouillés et décalerait les indices.
local function PresenterNoeud(noeud)
    local choix = {}
    for i, c in ipairs(Narvos.Dialogue.ChoixFiltres()) do choix[i] = { texte = c.text } end
    return { id = noeud.id, orateur = noeud.speaker, texte = noeud.text, choix = choix }
end

local function DialogueDebut(player, dialogue_id)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "interaction")) then return end
    local def = Narvos.Dialogue.Def(dialogue_id)
    if (def == nil) then Events.CallRemote("Narvos:DialogueErreur", player, Reliability.Reliable, "dialogue inconnu"); return end
    dialogue_joueur = player
    local noeud = Narvos.Dialogue.Demarrer(dialogue_id)
    if (noeud == nil) then Events.CallRemote("Narvos:DialogueErreur", player, Reliability.Reliable, "verrouillé"); return end
    dialogue_actifs[player] = dialogue_id
    dialogue_curseurs[player] = Narvos.Dialogue.Etat()
    Events.CallRemote("Narvos:Dialogue", player, Reliability.Reliable, PresenterNoeud(noeud))
end

--- Le joueur choisit une option (index dans la liste FILTRÉE).
local function DialogueChoisir(player, index)
    local id = dialogue_actifs[player]
    if (id == nil) then return end
    dialogue_joueur = player
    Narvos.Dialogue.Charger(dialogue_curseurs[player])
    local noeud = Narvos.Dialogue.Choix(index)
    dialogue_curseurs[player] = Narvos.Dialogue.Etat()
    if (noeud == nil) then
        dialogue_actifs[player] = nil
        dialogue_curseurs[player] = nil
        Events.CallRemote("Narvos:DialogueFin", player)
    elseif (boutique_envoyee == player) then
        -- Le nœud vient d'ouvrir la boutique (action `ouvrir_boutique`) : son
        -- panneau est à l'écran. Renvoyer le nœud rouvrirait le dialogue PAR-DESSUS.
        boutique_envoyee = nil
    else
        Events.CallRemote("Narvos:Dialogue", player, Reliability.Reliable, PresenterNoeud(noeud))
    end
end

Events.SubscribeRemote("Narvos:DialogueDebut", function(player, id) DialogueDebut(player, id) end)
Events.SubscribeRemote("Narvos:DialogueChoisir", function(player, index) DialogueChoisir(player, index) end)

-- Purge de l'état de dialogue à la déconnexion. `dialogue_actifs` et
-- `dialogue_curseurs` sont déclarées dans CE fichier mais APRÈS le gestionnaire
-- Player "Destroy" initial : les y purger les résoudrait en globales nil (le
-- piège des locals, rencontré cinq fois ici). D'où ce second gestionnaire,
-- placé après leurs déclarations.
Player.Subscribe("Destroy", function(player)
    -- Si le module Dialogue tient encore le curseur de CE joueur, on le referme
    -- proprement : sinon il survivrait jusqu'à la prochaine conversation de
    -- n'importe qui.
    if (dialogue_curseurs[player] ~= nil and Narvos.Dialogue.Etat() == dialogue_curseurs[player]) then
        Narvos.Dialogue.Arreter()
    end
    dialogue_actifs[player] = nil
    dialogue_curseurs[player] = nil
    if (dialogue_joueur == player) then dialogue_joueur = nil end
end)

-- ── Marchands ─────────────────────────────────────────────────────────────────
--
-- Le catalogue `Narvos.Merchants` (8 marchands, câblé dans Shared/Index.lua)
-- n'avait AUCUN consommateur : pas une ligne ne posait un marchand, et on ne
-- pouvait acheter nulle part. Cette section branche les trois maillons :
--   1. les PNJ sont POSÉS autour de l'aire de spawn (`PoserMarchands`, appelée
--      au chargement) ;
--   2. chaque marchand porte un dialogue GÉNÉRÉ depuis le catalogue, dont le
--      choix « Voir la boutique » pousse le stock au joueur (action
--      `ouvrir_boutique`, exécutée par le second callback de `Dialogue.Callbacks`,
--      plus haut) ;
--   3. l'achat est décidé ICI (`AcheterChez`) via `Narvos.Boutique`, module pur
--      dont le harnais prouve qu'un achat débite la bourse et crédite le sac.

--- Envoie le stock d'un marchand au joueur (panneau futur ; le chat et
--- `/acheter` servent déjà en jeu).
---@param player table
---@param marchand_id any
EnvoyerBoutique = function(player, marchand_id)
    if (not player) then return end
    local m = nil
    for _, e in ipairs(Narvos.Merchants.MERCHANTS) do
        if (e.id == marchand_id) then m = e break end
    end
    if (not m) then return end

    -- ⚠ GARDE DE PROXIMITÉ (2026-09-19). Un client pouvait demander un dialogue
    -- de marchand depuis n'importe où et recevoir le stock — l'achat, lui, était
    -- déjà gardé. Même contrat ici : la boutique ne s'ouvre que près du marchand.
    if (marchand_proche[player] ~= m) then
        Chat.SendMessage(player, "<grey>Approchez-vous d'un marchand.</>")
        return
    end

    -- ⚠ L'ÉQUIPEMENTIER MÈNE AU TAILLEUR, il n'ouvre pas une boutique vide.
    -- Son stock ne cite que des `part:` — des pièces de tenue, que
    -- `Boutique.Stock` écarte toutes (231 sur 231, mesuré le 2026-09-09). Le
    -- tailleur, lui, lit `Modular.PIECES` filtré par la morphologie du joueur :
    -- c'est le seul endroit qui sait ce que nanos peut vraiment afficher.
    -- Deux chemins pour vendre la même chose, c'est un de trop.
    if (Narvos.Boutique.EstEquipementier(m)) then
        Narvos.VestiaireServeur.Envoyer(player)
        return
    end

    local liste, ecartes = Narvos.Boutique.Stock(m)
    local stock = {}
    for _, e in ipairs(liste) do
        stock[#stock + 1] = {
            id = e.id,
            nom = e.def.label or e.id,
            prix = e.prix,
            rarete = e.def.rarity or "common",
            rachat = Narvos.Boutique.PrixRachat(m, e.def),
        }
    end

    local s = Session.De(player)
    Events.CallRemote("Narvos:Boutique", player, Reliability.Reliable, {
        marchand = m.id,
        nom = m.name,
        sous_titre = m.subtitle,
        stock = stock,
        ecartes = ecartes,
        credits = (s and s.perso and tonumber(s.perso.credits)) or 0,
    })
end

--- Achète chez le marchand DONT LE JOUEUR EST PROCHE. Le client n'envoie que
--- l'objet et la quantité : le marchand, le prix et le solde viennent du
--- serveur — le même verrou que `atelier_du_joueur` pour le craft.
---@param player table
---@param item_id any
---@param quantite any
local function AcheterChez(player, item_id, quantite)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "inventaire")) then return end
    local m = marchand_proche[player]
    if (not m) then
        Chat.SendMessage(player, "<grey>Approchez-vous d'un marchand.</>")
        return
    end
    local s = Session.De(player)
    local grille = inventaires[player]
    if (not grille or not s or not s.compte or not s.perso) then
        Events.CallRemote("Narvos:BoutiqueErreur", player, Reliability.Reliable, "pas de session")
        return
    end

    local nouvelle, reste = Narvos.Boutique.Acheter(
        m, grille, tonumber(s.perso.credits) or 0, item_id, quantite)
    if (not nouvelle) then
        Events.CallRemote("Narvos:BoutiqueErreur", player, Reliability.Reliable, tostring(reste))
        Chat.SendMessage(player, "<grey>" .. tostring(reste) .. "</>")
        return
    end

    -- La logique pure a déjà tout tranché : le module rend le couple NEUF
    -- (grille, solde) ou rien. Ici on applique, puis on persiste les DEUX
    -- moitiés — le sac par EnregistrerSac, la bourse par MajCredits (la colonne
    -- `credits` ne vit pas dans le blob d'inventaire).
    inventaires[player] = nouvelle
    s.perso.credits = reste
    EnregistrerSac(player)
    local ok, pourquoi = Narvos.Roster.MajCredits(s.compte.id, s.perso.id, reste)
    if (not ok) then
        Console.Warn("Boutique : solde non persiste — " .. tostring(pourquoi))
    end
    EnvoyerInventaire(player)

    local def = Narvos.Inventory.GetItemDef(item_id)
    Chat.SendMessage(player, ("<cyan>achete</> : %s — solde <yellow>%d cr</>")
        :format(tostring(def and def.label or item_id), reste))
    Events.CallRemote("Narvos:BoutiqueFait", player, Reliability.Reliable, item_id, quantite or 1, reste)
end

--- Vend au marchand proche. Mêmes verrous que l'achat.
---@param player table
---@param item_id any
---@param quantite any
local function VendreChez(player, item_id, quantite)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "inventaire")) then return end
    local m = marchand_proche[player]
    if (not m) then
        Chat.SendMessage(player, "<grey>Approchez-vous d'un marchand.</>")
        return
    end
    local s = Session.De(player)
    local grille = inventaires[player]
    if (not grille or not s or not s.compte or not s.perso) then
        Events.CallRemote("Narvos:BoutiqueErreur", player, Reliability.Reliable, "pas de session")
        return
    end

    local nouvelle, reste = Narvos.Boutique.Vendre(
        m, grille, tonumber(s.perso.credits) or 0, item_id, quantite)
    if (not nouvelle) then
        Events.CallRemote("Narvos:BoutiqueErreur", player, Reliability.Reliable, tostring(reste))
        Chat.SendMessage(player, "<grey>" .. tostring(reste) .. "</>")
        return
    end

    inventaires[player] = nouvelle
    s.perso.credits = reste
    EnregistrerSac(player)
    local ok, pourquoi = Narvos.Roster.MajCredits(s.compte.id, s.perso.id, reste)
    if (not ok) then
        Console.Warn("Boutique : solde non persiste — " .. tostring(pourquoi))
    end
    EnvoyerInventaire(player)

    local def = Narvos.Inventory.GetItemDef(item_id)
    Chat.SendMessage(player, ("<cyan>vendu</> : %s — solde <yellow>%d cr</>")
        :format(tostring(def and def.label or item_id), reste))
    Events.CallRemote("Narvos:BoutiqueFait", player, Reliability.Reliable, item_id, quantite or 1, reste)
end

-- Le client envoie une INTENTION (objet + quantité) ; le serveur décide.
Events.SubscribeRemote("Narvos:Boutique:Acheter", function(player, item_id, quantite)
    AcheterChez(player, item_id, quantite)
end)
Events.SubscribeRemote("Narvos:Boutique:Vendre", function(player, item_id, quantite)
    VendreChez(player, item_id, quantite)
end)

--- Un dialogue par marchand, GÉNÉRÉ depuis le catalogue : l'accueil est le
--- `greeting` du marchand, et « Voir la boutique » porte l'action
--- `ouvrir_boutique` que l'exécuteur d'actions (plus haut) traduit en envoi du
--- stock. Huit dialogues écrits à la main divergeraient du catalogue au premier
--- renommage.
local function EnregistrerDialoguesMarchands()
    for _, m in ipairs(Narvos.Merchants.MERCHANTS) do
        Narvos.Dialogue.Enregistrer({
            id = "marchand_" .. m.id,
            title = m.name,
            npcFolder = m.folder,
            npcName = m.name,
            startNode = "accueil",
            nodes = {
                {
                    id = "accueil",
                    text = m.greeting,
                    speaker = m.name .. " — " .. m.subtitle,
                    choices = {
                        { text = "Voir la boutique", nextNode = "boutique" },
                        { text = "Au revoir.", nextNode = "fin" },
                    },
                },
                {
                    id = "boutique",
                    text = "Fais ton choix.",
                    speaker = m.name,
                    onEnter = { { type = "ouvrir_boutique", params = { marchand = m.id } } },
                    choices = {
                        { text = "C'est tout.", nextNode = "fin" },
                    },
                },
                {
                    id = "fin",
                    text = "Reviens quand tu veux.",
                    speaker = m.name,
                },
            },
        })
    end
end
EnregistrerDialoguesMarchands()

--- Qui INCARNE chaque marchand dans nanos — une distribution, pas une donnée du web.
---
--- ── POURQUOI PAS `m.folder` ──────────────────────────────────────────────────
--- `Merchants.lua` est GÉNÉRÉ depuis `npc/merchants.ts` : son `folder` nomme le
--- dossier GLB du prototype WEB. Dans nanos, ces dossiers sont des `Meshy_AI_*`,
--- les bouche-trous gris à `echelle = 100` — les « PNJ très grands, sans leur
--- texture » vus en jeu le 2026-09-10. Changer `folder` dans le TS changerait
--- aussi le prototype web.
---
--- On distribue donc les rôles ICI, parmi les corps de packs achetés qui sont À
--- LA FOIS (mesuré le 2026-09-11) :
---   · texturés — Valkiria 16 textures, CyberpunkSamurai 32 (`_assets-inventory.json`) ;
---   · sur `SKEL_Mannequin`, le squelette de nanos (lu dans leurs `.uasset`) :
---     donc `Character`, avec les animations du moteur — pas une statue ;
---   · à l'échelle 1 — packs Unreal, déjà en centimètres.
--- Trois corps remplissent ces conditions aujourd'hui. Defender (60 corps, 581
--- textures) les rejoindra quand son squelette sera réparé : ses `.uasset`
--- pointent `/Game/Defender/.../SK_MannequinMainUE4M`, disparu à la promotion
--- (journal du cook de nuit : « which does not exist »).
---
--- ⚠ Un marchand ABSENT de cette table garde son corps du web, et le témoin de
--- démarrage le COMPTE (« … incarne(s) par un personnage de pack, n par le corps
--- du web »). Contrôle statique : `scripts/lua-harness/incarnations-check.mjs`.
local INCARNATION_MARCHANDS = {
    mer_potions    = "modulaire_narvos_valkiria_f",                                  -- Lyra, apothicaire
    mer_weapons    = "«redacted:sk_…»",      -- Kael, armurier-forgeron
    mer_armor      = "«redacted:sk_…»", -- Brunha, armuriere
    mer_resources  = "modulaire_narvos_operateur_m",                                 -- Drog, ressources
    mer_magic      = "«redacted:sk_…»",                               -- Oracle Vesh, arcanes
    mer_general    = "modulaire_narvos_operateur_m",                                 -- Marchand errant, bazar
    mer_vehicles   = "«redacted:sk_…»",                 -- Garagiste Talen
    mer_equipement = "«redacted:sk_…»",           -- Vasska, equipementiere
}

--- Le spawnable qui joue ce marchand.
---@param m table  entrée de Merchants.MERCHANTS
---@return string id_spawnable
---@return boolean incarne  vrai si la distribution ci-dessus a décidé
local function IncarnationMarchand(m)
    local id = INCARNATION_MARCHANDS[m.id]
    if (id and Narvos.Spawnables.Trouver(id)) then return id, true end
    if (id) then
        Console.Warn("Marchand " .. tostring(m.id) .. " : incarnation '" .. id
            .. "' absente de Spawnables — corps du web en repli")
    end
    return m.folder, false
end

--- Pose les marchands du catalogue en couronne autour de l'aire de spawn.
---
--- ⚠ POSÉS, PAS PEUPLÉS. `Peuplement` fait naître et mourir des PNJ selon la
--- proximité d'un joueur et les confie à l'IA, qui les fait BOUGER : un
--- marchand doit tenir sa boutique, et son déclencheur ne le suivrait pas.
--- C'est le patron de `PoserArmurier`, pas celui de `Naitre`.
local function PoserMarchands()
    local liste = Narvos.Merchants.MERCHANTS
    local poses, incarnes = 0, 0
    for i, m in ipairs(liste) do
        local id_pnj, incarne = IncarnationMarchand(m)
        local entree = Narvos.Spawnables.Trouver(id_pnj)
        local asset = entree and Narvos.Spawnables.Asset(id_pnj) or nil
        if (not asset) then
            -- Un corps inconnu du pack cuit afficherait la capsule blanche.
            -- On écarte et on le dit, une fois, au chargement.
            Console.Warn("Marchand " .. tostring(m.id)
                .. " : corps inconnu (" .. tostring(id_pnj) .. ") — non pose")
        else
            local position = SurCercle(i, #liste, RAYON_MARCHANDS, SOL_Z)
            -- Face au centre de la couronne, comme les pads regardent le spawn.
            local angle = (i - 1) * (2 * math.pi / #liste) - math.pi / 2
            local yaw = math.deg(angle + math.pi)

            -- Le catalogue choisit la classe, comme dans `Peuplement.Naitre` :
            -- `CharacterSimple` (location, rotation, mesh, anim_bp, collision,
            -- gravité — Classes/CharacterSimple.json) pour un squelette étranger ;
            -- `Character` pour un corps sur SKEL_Mannequin, qui reçoit alors les
            -- animations du moteur. Forcer `CharacterSimple` ici figeait en statue
            -- un corps qui sait marcher.
            local ok, pnj
            if (entree.simple) then
                ok, pnj = pcall(CharacterSimple, position, Rotator(0, yaw, 0),
                    asset, "", CollisionType.Auto, true)
            else
                ok, pnj = pcall(Character, position, Rotator(0, yaw, 0), asset)
                -- NOTRE locomotion. `CharacterSimple` (branche du dessus) n'a
                -- pas cette methode : seul le vrai `Character` la recoit.
                if (ok and pnj) then Narvos.CharacterBuilder.PoserLocomotion(pnj) end
            end
            if (not ok or not pnj) then
                Console.Error("Marchand " .. tostring(m.id) .. " : spawn refuse")
            else
                local echelle = tonumber(entree.echelle)
                if (echelle and echelle ~= 1) then
                    pcall(function() pnj:SetScale(Vector(echelle, echelle, echelle)) end)
                end
                pnj:SetValue("narvos_marchand", m.id, true)
                -- Identite SYNCHRONISEE (3e argument `true`). Le diagnostic client
                -- (Client/Diagnostic.lua) ne peut pas lire le mesh d'un personnage — aucun
                -- accesseur cote client — il le nomme par cette valeur, et compare l'echelle
                -- demandee a la taille RENDUE.
                pnj:SetValue("narvos_pnj", id_pnj, true)
                pnj:SetValue("narvos_echelle", echelle or 1, true)
                poses = poses + 1
                if (incarne) then incarnes = incarnes + 1 end

                -- 7e argument = overlap_only_classes, comme partout ici.
                local zone = Trigger(position, Rotator(), Vector(2.5 * M),
                    TriggerType.Sphere, false, nil, { "Character" })
                zone:Subscribe("BeginOverlap", function(_, acteur)
                    local player = JoueurDe(acteur)
                    if (not player) then return end
                    marchand_proche[player] = m
                    -- ⚠ PLUS DE DIALOGUE FORCÉ À L'APPROCHE (2026-09-11) : passer
                    -- près d'un marchand ouvrait sa conversation. On ANNONCE ; le
                    -- joueur parle d'une touche (`interagir`, côté client), qui émet
                    -- `Narvos:DialogueDebut` avec cet identifiant. Le curseur reste
                    -- rangé PAR JOUEUR dans DialogueDebut.
                    Events.CallRemote("Narvos:MarchandProche", player, Reliability.Reliable, {
                        id = m.id, dialogue = "marchand_" .. m.id,
                        nom = m.name, sous_titre = m.subtitle,
                    })
                    Chat.SendMessage(player, "<cyan>" .. m.name .. "</> <grey>("
                        .. m.subtitle .. ")</> : " .. m.greeting)
                end)
                zone:Subscribe("EndOverlap", function(_, acteur)
                    local player = JoueurDe(acteur)
                    if (player and marchand_proche[player]
                        and marchand_proche[player].id == m.id) then
                        marchand_proche[player] = nil
                        Events.CallRemote("Narvos:MarchandProche", player, Reliability.Reliable, false)
                    end
                end)
            end
        end
    end
    -- Le temoin dit QUI joue les marchands, pas seulement combien sont poses :
    -- « 8/8 poses » s'imprimait aussi quand les huit etaient des geants gris.
    Console.Log(("Marchands : %d/%d poses autour de l'aire de spawn ; %d incarne(s) par un personnage de pack, %d par le corps du web.")
        :format(poses, #liste, incarnes, poses - incarnes))
end

local function PoserCoffres()
    for i, zone in ipairs(ZONES) do
        local position = SurCercle(i, #ZONES, RAYON_ZONES, SOL_Z)
        zones_pretes[zone.id] = true

        Prop(Vector(position.X, position.Y, SOL_SERVICES + 40.0), Rotator(), "nanos-world::SM_Cube",
            CollisionType.Normal, false)

        -- 7e argument = overlap_only_classes. Sans liste blanche, le moteur teste
        -- CHAQUE entite qui bouge contre ce volume et le signale comme source de
        -- lag. Seuls des personnages nous interessent ici.
        local coffre = Trigger(position, Rotator(), Vector(2.5 * M), TriggerType.Sphere, false, zone.couleur, { "Character" })

        coffre:Subscribe("BeginOverlap", function(_, acteur)
            if (not zones_pretes[zone.id]) then return end

            local player = JoueurDe(acteur)
            if (not player) then return end

            zones_pretes[zone.id] = false
            VerserButin(player, zone)

            -- Recharge différée : sans elle, rester dans le déclencheur ne
            -- redonne rien (BeginOverlap ne se répète pas), mais entrer/sortir
            -- en boucle viderait le catalogue en quelques secondes.
            Timer.SetTimeout(function() zones_pretes[zone.id] = true end, DELAI_RECHARGE)
        end)
    end
end

-- ── Pont vers l'interface ──────────────────────────────────────────────────────
--
-- Le serveur POUSSE l'état, le client se contente d'afficher. L'alternative —
-- le client demande, le serveur répond — ajoute un aller-retour à chaque
-- ouverture de panneau et affiche un inventaire vide le temps qu'il revienne.
-- Pousser à chaque changement coûte un message par ramassage, ce qui est
-- négligeable, et l'ouverture est instantanée.

--- Change la classe d'un joueur — et donc son CORPS.
---
--- Un simple `ApplyClass` ne suffit plus : depuis que chaque classe a son propre
--- mesh, le corps se choisit à la construction du Character. Il faut donc en
--- refabriquer un. On conserve la position pour que le changement se voie sur
--- place et non par une téléportation.
--- Tab — range ce que le personnage tient en main.
---
--- `Character:GetPicked()` rend l'entité tenue (arme, prop, grenade) ou `nil` ;
--- `Drop()` la relâche. Les deux sont côté serveur, d'où le passage par un
--- événement distant.
---
--- ⚠ CE N'EST PAS UN DÉSHABILLAGE. Les vêtements et chaussures ne sont pas des
--- objets tenus : ce sont des slots du Vestiaire, posés par `Builder.Habiller`
--- et retirés par le même chemin. Les deux systèmes sont distincts, et les
--- confondre ferait disparaître une botte en croyant lâcher un bâton.
Events.SubscribeRemote("Narvos:RetirerEquipement", function(player)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "inventaire")) then return end
    if (not Narvos.SessionServeur.EnJeu(player)) then return end
    if (not player) then return end

    local character = player:GetControlledCharacter()
    if (not character or not character:IsValid()) then return end

    local tenu = character:GetPicked()
    if (not tenu) then
        Chat.SendMessage(player, "<grey>rien en main</>")
        return
    end

    -- Le nom AVANT le Drop : après, l'entité peut être détruite par son
    -- propriétaire et l'interroger lèverait.
    local etiquette = "objet"
    pcall(function() etiquette = tenu:GetClass() or "objet" end)

    character:Drop()
    Chat.SendMessage(player, ("<cyan>rangé</> — %s"):format(tostring(etiquette)))
end)

-- ── La roue d'objets (TAB) ─────────────────────────────────────────────────────
--
-- Cinq emplacements PAR PERSONNAGE, persistés en base (table `roue`), que le
-- joueur garnit avec ce que son sac contient : une arme ou un consommable.
-- L'activation passe par la logique RÉELLE de chaque type, jamais par une
-- imitation :
--   · arme à feu   → Narvos.Weapons.Donner        (Shared/Logic/Weapons.lua)
--   · mêlée        → Narvos.CombatServeur.Equiper (Server/Combat.lua)
--   · consommable  → décrément du sac + SortsServeur.Soigner / AjouterMana
--
-- ⚠ L'OBJET ÉQUIPÉ RESTE DANS LE SAC, comme chez l'armurier : la roue
-- déclenche l'équipement, elle ne gère pas la propriété. Seul le consommable
-- quitte le sac, par définition.
--
-- Tout choix est REVALIDÉ au moment de l'activation (`Roue.Activer`) : l'objet
-- doit être dans le sac à cet instant, peu importe ce que la base raconte.

Events.SubscribeRemote("Narvos:DemanderRoue", function(player)
    if (not Narvos.SessionServeur.EnJeu(player)) then return end
    EnvoyerRoue(player)
end)

--- Refus d'un choix de roue : le message HUD porte la raison, et la case
--- clignote côté interface (relais Narvos:RoueErreur → NarvosRoueRefus).
local function RefuserRoue(player, raison)
    Events.CallRemote("Narvos:RoueErreur", player, Reliability.Reliable,
        tostring(raison or "Refusé"))
end

Events.SubscribeRemote("Narvos:RoueAssigner", function(player, emplacement, item_id)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "roue")) then return end
    if (not Narvos.SessionServeur.EnJeu(player)) then return end
    if (not player) then return end

    local s = Session.De(player)
    local perso = s and s.perso
    if (not perso) then return end

    -- D'abord « est-ce assignable », puis « l'as-tu » : un emplacement pointant
    -- vers un objet qu'on ne porte pas serait une case morte dès sa création.
    local ok0, raison0 = Narvos.Roue.Assignable(item_id)
    if (not ok0) then RefuserRoue(player, raison0) return end

    local grille = inventaires[player]
    if (not grille or Narvos.Inventory.CountItem(grille, item_id) <= 0) then
        local def = Narvos.Items.ITEM_DB[item_id]
        RefuserRoue(player, "« " .. ((def and def.label) or tostring(item_id))
            .. " » n'est pas dans le sac")
        return
    end

    local ok, raison = Narvos.Roue.Definir(perso.id, emplacement, item_id)
    if (not ok) then RefuserRoue(player, raison) return end

    EnvoyerRoue(player)
end)

Events.SubscribeRemote("Narvos:RoueRetirer", function(player, emplacement)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "roue")) then return end
    if (not Narvos.SessionServeur.EnJeu(player)) then return end
    if (not player) then return end

    local s = Session.De(player)
    local perso = s and s.perso
    if (not perso) then return end

    Narvos.Roue.Retirer(perso.id, emplacement)
    EnvoyerRoue(player)
end)

--- Exécute le PLAN d'un objet (`Roue.Activer`) : consommer, prendre une arme à
--- feu en main, prendre une arme de mêlée. UN SEUL chemin pour la roue (TAB) et
--- pour l'inventaire (UTILISER) : deux copies de ce bloc divergeraient.
--- Rend (true, message) ou (false, raison).
local function ExecuterPlanObjet(player, plan)
    local character = player:GetControlledCharacter()
    if (not character or not character:IsValid()) then return false, "Aucun personnage" end

    if (plan.action == "consommer") then
        local nouvelle = Narvos.Roue.Consommer(inventaires[player], plan.item_id)
        if (not nouvelle) then
            return false, "« " .. plan.label .. " » n'est plus dans le sac"
        end
        inventaires[player] = nouvelle

        if (Narvos.SortsServeur) then
            if ((plan.effet.heal or 0) > 0) then
                Narvos.SortsServeur.Soigner(player, plan.effet.heal)
            end
            if ((plan.effet.mana or 0) > 0) then
                Narvos.SortsServeur.AjouterMana(player, plan.effet.mana)
            end
        end

        EnregistrerSac(player)
        -- Pousse l'inventaire ET la roue (EnvoyerRoue y est branchée) : la pile
        -- décrémentée se voit tout de suite dans les deux.
        EnvoyerInventaire(player)
        return true, plan.label .. (plan.effet.description and (" — " .. plan.effet.description) or "")
    end

    if (plan.action == "equiper_feu") then
        -- La mêlée tenue repart d'abord : Weapons.Donner détruit ce qui est
        -- tenu, et CombatServeur garderait la trace de sa Melee détruite.
        Narvos.CombatServeur.Ranger(player)
        -- Un prop tenu (pose en attente) n'est pas un équipement : on le POSE,
        -- on ne le détruit pas — Donner, lui, détruirait tout ce qui est tenu.
        local tenue = character:GetPicked()
        if (tenue and not tenue:IsA(Weapon)) then character:Drop() end
        -- L'arme reste dans le sac : l'entité tenue n'en est que la PROJECTION.
        -- Sans la marque, T la lâchait au sol et Y la ramassait — un exemplaire
        -- de plus par tour (Logic/Ramassage.lua, 2026-09-13).
        local arme, raison = Narvos.Weapons.Donner(character, plan.arme_id)
        if (not arme) then return false, raison or "Équipement de l'arme refusé" end
        Narvos.RamassageServeur.MarquerProjection(arme)
        return true, plan.label .. " en main"

    elseif (plan.action == "equiper_melee") then
        -- CombatServeur.Equiper appelle Ranger, qui ne connaît que les Melee
        -- qu'il a créées : une arme à feu tenue resterait en main, empilée en
        -- silence avec la mêlée (PickUp ne remplace pas — voir Weapons.Donner).
        -- On la dépose d'abord, selon ce même patron : Drop, destruction
        -- différée de 100 ms.
        local tenue = character:GetPicked()
        if (tenue) then
            character:Drop()
            if (tenue:IsA(Weapon)) then
                Timer.SetTimeout(function()
                    if (tenue:IsValid()) then tenue:Destroy() end
                end, 100)
            end
        end
        local ok, raison = Narvos.CombatServeur.Equiper(player, plan.arme_id)
        if (not ok) then return false, raison or "Équipement de mêlée refusé" end
        return true, plan.label .. " en main"
    end

    return false, "« " .. tostring(plan.label) .. " » n'est pas utilisable"
end


-- ── Inventaire : gestes de la page (maquette « Inventaire NARVOS », 2026-09-14) ──
--
-- La page n'envoie qu'un uid (ou un emplacement) ; le serveur revalide TOUT sur
-- le sac réel. Chaque geste renvoie l'inventaire complet, et l'erreur est dite.

local function RefuserInventaire(player, raison)
    Events.CallRemote("Narvos:InventaireErreur", player, Reliability.Reliable, tostring(raison or "Refusé"))
end

local function InfoInventaire(player, texte)
    Events.CallRemote("Narvos:InventaireInfo", player, Reliability.Reliable, tostring(texte or ""))
end

--- Garde commune : joueur en jeu, non menotté, sac chargé.
local function GesteInventairePossible(player)
    if (not player) then return false end
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "inventaire")) then return false end
    if (not Narvos.SessionServeur.EnJeu(player)) then return false end
    return inventaires[player] ~= nil
end

--- Applique un nouvel état { grid, equipment }, sauve, réapplique les stats du
--- personnage (l'équipement les change) et renvoie la vue.
-- ── ÉQUIPEMENTS ATTACHÉS AU CORPS 3D (2026-09-19) ─────────────────────────────
-- `equipements[player]` dit QUEL objet occupe QUEL emplacement ; ici on le rend
-- VISIBLE sur le personnage : un mesh par emplacement, posé au bon socket du
-- squelette (head, spine_03, pelvis, foot_r, neck_01, index_01_*) — mêmes
-- primitives que la garde-robe (`AddStaticMeshAttached`/`RemoveStaticMeshAttached`
-- de Builder.Habiller), même mémoire en `SetValue` pour savoir quoi retirer au
-- rhabillage suivant. Le MODÈLE (mesh + socket par slot) est pur :
-- Narvos.Equipement3D.Attaches.
local function RhabillerEquipements3D(player)
    local character = player:GetControlledCharacter()
    if (not character or not character:IsValid()) then return end

    local anciens = character:GetValue("narvos_equips", false) or {}
    for _, attache in ipairs(anciens) do
        pcall(function() character:RemoveStaticMeshAttached(attache.id) end)
    end

    local attaches = Narvos.Equipement3D.Attaches(equipements[player] or {}, function(id)
        return Narvos.Inventory.GetItemDef(id)
    end)

    local memoire = {}
    for _, attache in ipairs(attaches) do
        local ok = pcall(function()
            character:AddStaticMeshAttached(attache.id, attache.mesh, attache.socket)
        end)
        if (ok) then memoire[#memoire + 1] = { id = attache.id } end
    end
    character:SetValue("narvos_equips", memoire, false)
end

-- Exposé pour l'appel au SPAWN (plus haut dans le fichier) : un callback compilé
-- avant la déclaration ne peut pas résoudre un `local` ultérieur — la table
-- Narvos, elle, est remplie au chargement, avant tout spawn.
Narvos.RhabillerEquipements = RhabillerEquipements3D

local function AppliquerEtatSac(player, suivant)
    local avant_grille, avant_equipement = inventaires[player], equipements[player]
    inventaires[player] = suivant.grid
    equipements[player] = suivant.equipment
    if (not EnregistrerSac(player)) then
        inventaires[player], equipements[player] = avant_grille, avant_equipement
        return false, "Sauvegarde refusée"
    end
    if (Narvos.ProgressionServeur) then Narvos.ProgressionServeur.Appliquer(player, false) end
    RhabillerEquipements3D(player)
    EnvoyerInventaire(player)
    return true
end

local function EquiperObjetDuSac(player, uid)
    local avant = { grid = inventaires[player], equipment = equipements[player] or {} }
    local inst = Narvos.Inventory.FindInstance(avant.grid, uid)
    if (not inst) then return false, "Objet introuvable" end
    local plan
    if (Narvos.Roue.ARME_PAR_ITEM[inst.itemId]) then
        local raison
        plan, raison = Narvos.Roue.Activer(avant.grid, { inst.itemId }, 1)
        if (not plan) then return false, raison end
    end
    local suivant, raison = Narvos.Inventory.EquiperDepuisGrille(
        avant, uid)
    if (not suivant) then return false, raison end
    local ok, erreur = AppliquerEtatSac(player, suivant)
    if (not ok) then return false, erreur end
    if (plan) then
        ok, erreur = ExecuterPlanObjet(player, plan)
        if (not ok) then
            local restaure = AppliquerEtatSac(player, avant)
            if (not restaure) then Console.Error("Inventaire : restauration après refus d'équipement non enregistrée") end
            return false, erreur
        end
    end
    return true
end

Events.SubscribeRemote("Narvos:Inventaire:Equiper", function(player, uid)
    if (not GesteInventairePossible(player) or type(uid) ~= "string") then return end
    local ok, raison = EquiperObjetDuSac(player, uid)
    if (not ok) then return RefuserInventaire(player, raison) end
    InfoInventaire(player, "Équipé")
end)

--- Déséquipe un emplacement vers le sac ; l'arme en main (sa PROJECTION) repart.
--- UN seul chemin pour la page, la commande /arme rien et tout geste futur.
---@return boolean, string|nil
local function DesequiperEmplacement(player, slot)
    local connu = false
    for _, s in ipairs(Narvos.Inventory.EQUIP_SLOTS) do if (s == slot) then connu = true end end
    if (not connu) then return false, "Emplacement inconnu" end
    local suivant, raison = Narvos.Inventory.DesequiperVersGrille(
        { grid = inventaires[player], equipment = equipements[player] or {} }, slot)
    if (not suivant) then return false, raison end
    local ok, erreur = AppliquerEtatSac(player, suivant)
    if (not ok) then return false, erreur end
    if (slot == "weapon") then
        local character = player:GetControlledCharacter()
        local tenue = character and character:GetPicked()
        if (tenue) then
            character:Drop()
            -- La projection d'une arme du sac n'a pas d'existence propre : lâchée,
            -- elle resterait au sol et se ramasserait une seconde fois.
            if (tenue:GetValue("narvos_projection_sac", false)) then
                Timer.SetTimeout(function() if (tenue:IsValid()) then tenue:Destroy() end end, 100)
            end
        end
        Narvos.CombatServeur.Ranger(player)
    end
    return true, nil
end

Events.SubscribeRemote("Narvos:Inventaire:Desequiper", function(player, slot)
    if (not GesteInventairePossible(player) or type(slot) ~= "string") then return end
    local ok, raison = DesequiperEmplacement(player, slot)
    if (not ok) then return RefuserInventaire(player, raison) end
    InfoInventaire(player, "Déséquipé")
end)

--- L'uid d'une instance de `item_id` posée dans la grille, ou nil.
local function UidDansSac(grille, item_id)
    for _, inst in ipairs((grille and grille.instances) or {}) do
        if (inst.itemId == item_id) then return inst.uid end
    end
    return nil
end

-- ── La roue (TAB) : le MÊME parcours que l'inventaire (2026-09-15) ────────────
-- Une arme de la roue passait directement en main : l'objet restait dans la
-- grille, l'emplacement « arme » ne bougeait pas, et la fiche du personnage ne
-- savait pas ce qu'il tenait. Désormais : arme dans le sac -> ÉQUIPER (grille
-- vers emplacement, puis projection en main) ; arme déjà portée -> reprise en
-- main ; consommable -> inchangé.
Events.SubscribeRemote("Narvos:RoueActiver", function(player, emplacement)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "roue")) then return end
    if (not Narvos.SessionServeur.EnJeu(player)) then return end
    if (not player) then return end

    local s = Session.De(player)
    local perso = s and s.perso
    if (not perso) then return end

    local par_perso = Narvos.Roue.ParPerso(perso.id)
    local e = tonumber(emplacement)
    local item_id = e and par_perso and par_perso[e]
    local correspondance = item_id and Narvos.Roue.ARME_PAR_ITEM[item_id]
    local porte = equipements[player] and equipements[player].weapon

    if (correspondance and porte and porte.itemId == item_id) then
        local def = Narvos.Items.ITEM_DB[item_id]
        local plan = {
            action = correspondance.genre == "feu" and "equiper_feu" or "equiper_melee",
            arme_id = correspondance.arme_id,
            item_id = item_id,
            label = (def and def.label) or item_id,
        }
        local ok, message = ExecuterPlanObjet(player, plan)
        if (not ok) then return RefuserRoue(player, message) end
        Events.CallRemote("Narvos:RoueActivee", player, Reliability.Reliable, emplacement)
        return
    end

    local plan, raison = Narvos.Roue.Activer(inventaires[player], par_perso, emplacement)
    if (not plan) then
        -- Emplacement vide ou objet parti : RIEN ne se déclenche, et le retour
        -- visuel porte la raison.
        RefuserRoue(player, raison)
        return
    end

    if (plan.action == "equiper_feu" or plan.action == "equiper_melee") then
        local uid = UidDansSac(inventaires[player], plan.item_id)
        if (not uid) then return RefuserRoue(player, "« " .. plan.label .. " » n'est plus dans le sac") end
        local ok, erreur = EquiperObjetDuSac(player, uid)
        if (not ok) then return RefuserRoue(player, erreur) end
        Events.CallRemote("Narvos:RoueActivee", player, Reliability.Reliable, emplacement)
        return
    end

    local ok, message = ExecuterPlanObjet(player, plan)
    if (not ok) then
        RefuserRoue(player, message)
        return
    end
    if (plan.action == "consommer") then
        Events.CallRemote("Narvos:RoueInfo", player, Reliability.Reliable, message)
    end
    Events.CallRemote("Narvos:RoueActivee", player, Reliability.Reliable, emplacement)
end)

--- UTILISER : le MÊME plan que la roue (`Roue.Activer` sur un emplacement
--- virtuel), donc le même effet — soin, mana, arme en main.
Events.SubscribeRemote("Narvos:Inventaire:Utiliser", function(player, uid)
    if (not GesteInventairePossible(player) or type(uid) ~= "string") then return end
    local inst = Narvos.Inventory.FindInstance(inventaires[player], uid)
    if (not inst) then return RefuserInventaire(player, "Objet introuvable dans le sac") end
    if (Narvos.Roue.ARME_PAR_ITEM[inst.itemId]) then
        local ok, raison = EquiperObjetDuSac(player, uid)
        if (not ok) then return RefuserInventaire(player, raison) end
        return InfoInventaire(player, "Arme équipée")
    end
    local plan, raison = Narvos.Roue.Activer(inventaires[player], { inst.itemId }, 1)
    if (not plan) then return RefuserInventaire(player, raison) end
    local ok, message = ExecuterPlanObjet(player, plan)
    if (not ok) then return RefuserInventaire(player, message) end
    EnvoyerInventaire(player)
    InfoInventaire(player, message)
end)

--- JETER (une unité) et DÉTRUIRE (la pile) : l'objet quitte le sac.
local function RetirerDuSac(player, uid, tout)
    if (not GesteInventairePossible(player) or type(uid) ~= "string") then return end
    local inst = Narvos.Inventory.FindInstance(inventaires[player], uid)
    if (not inst) then return RefuserInventaire(player, "Objet introuvable dans le sac") end
    local quantite = tout and (tonumber(inst.quantity) or 1) or 1
    local grille = Narvos.Inventory.RemoveItemFromGrid(inventaires[player], uid, quantite)
    if (not grille) then return RefuserInventaire(player, "Retrait impossible") end
    AppliquerEtatSac(player, { grid = grille, equipment = equipements[player] or {} })
    local def = Narvos.Inventory.GetItemDef(inst.itemId)
    InfoInventaire(player, (tout and "Détruit : " or "Jeté : ") .. tostring(def and def.label or inst.itemId))
end

Events.SubscribeRemote("Narvos:Inventaire:Jeter", function(player, uid) RetirerDuSac(player, uid, false) end)
Events.SubscribeRemote("Narvos:Inventaire:Detruire", function(player, uid) RetirerDuSac(player, uid, true) end)

Events.SubscribeRemote("Narvos:ChoisirClasse", function(player, class_id)
    -- ⚠ GARDE D'ÉTAT. C'était le seul SubscribeRemote sans : un client encore à
    -- l'écran de connexion pouvait se faire fabriquer un personnage sans jamais
    -- s'authentifier. Trouvé par audit le 2026-09-03.
    if (not Narvos.SessionServeur.EnJeu(player)) then return end

    if (not player) then return end

    -- ⚠ Une valeur venue du client ne se fait jamais confiance : elle sert
    -- d'index dans un catalogue, et un id inventé spawnerait n'importe quoi.
    if (not Narvos.Creation.ClasseValide(class_id)) then
        Console.Warn("Classe refusée (client) : " .. tostring(class_id))
        return
    end

    local ancien = player:GetControlledCharacter()

    -- ── LE CORPS CHOISI RESTE (2026-09-14) ───────────────────────────────────
    -- Un personnage qui a un corps (MetaHuman choisi a la creation) garde ce
    -- corps : la classe change ses STATS, pas sa silhouette. Refabriquer un
    -- Character ici le rhabillait du corps de CLASSE (samourai, valkyrie) et
    -- perdait l'apparence du joueur.
    local session = Narvos.SessionServeur.De and Narvos.SessionServeur.De(player)
    local perso = session and session.perso
    if (ancien and ancien:IsValid() and perso and perso.corps and Narvos.Modular.Corps(perso.corps)) then
        local ok, raison = Narvos.CharacterBuilder.ApplyClass(ancien, class_id)
        if (not ok) then
            Console.Error("Changement de classe refuse : " .. tostring(raison))
            return
        end
        AnnoncerClasse(player, class_id)
        EnvoyerClasses(player)
        EnvoyerInventaire(player)
        return
    end

    local position = ancien and ancien:GetLocation() or SurCercle(1, 4, RAYON_SPAWN, SOL_Z)
    local rotation = ancien and ancien:GetRotation() or Rotator(0, 45, 0)

    local nouveau, raison = Narvos.CharacterBuilder.Spawn(class_id, position, rotation)
    if (not nouveau) then
        Console.Error("Changement de classe impossible : " .. tostring(raison))
        return
    end

    player:Possess(nouveau)
    if (ancien) then ancien:Destroy() end

    AppliquerVueIso(player, nouveau)
    AnnoncerClasse(player, class_id)
    EnvoyerClasses(player)

    -- La vue et l'inventaire appartiennent au joueur, pas au personnage : les
    -- renvoyer évite un panneau qui décrit le corps précédent.
    Events.CallRemote("NarvosIso:Config", player, Reliability.Reliable, ISO)
    EnvoyerInventaire(player)
end)

-- ── Commandes de chat ──────────────────────────────────────────────────────────
--
-- `Chat.Subscribe("PlayerSubmit")` reçoit (message, player) des DEUX côtés.
-- On le traite ici, côté SERVEUR, parce que les actions qu'il déclenche —
-- `SetFlyingMode` en tête — sont des méthodes serveur : les appeler depuis le
-- client serait refusé en silence.
--
-- Renvoyer `false` empêche le message de partir dans le chat : une commande ne
-- doit pas s'afficher comme une phrase.

-- `SansBalise` est declaree EN TETE du fichier : elle etait ici, et deux
-- appels situes 340 lignes plus haut la resolvaient donc en GLOBALE nil.
-- Voir scripts/lua-harness/portee-check.mjs, qui l'a trouvee.

local COMMANDES = {}

--- Une attribution ne fait jamais apparaître d'arme en main.
local function DonnerAuSac(player, item_id, quantite)
    if (not GesteInventairePossible(player)) then return false, "Inventaire indisponible" end
    local def = Narvos.Items.ITEM_DB[item_id]
        or Narvos.ArmesInventaire.ItemPourArme(item_id, Narvos.Items.ITEM_DB)
    if (not def) then return false, "Objet inconnu : " .. tostring(item_id) end
    local n = tonumber(quantite) or 1
    if (n ~= n or n < 1 or n > 100 or n ~= math.floor(n)) then return false, "Quantité entière de 1 à 100 requise" end
    local avant = inventaires[player]
    local suivant = Narvos.Inventory.AddItemToGrid(avant, def, n)
    if (not suivant) then return false, "Sac plein : aucun objet ajouté" end
    inventaires[player] = suivant
    if (not EnregistrerSac(player)) then
        inventaires[player] = avant
        return false, "Sauvegarde refusée : aucun objet ajouté"
    end
    EnvoyerInventaire(player)
    return true, tostring(def.label or def.id) .. " x" .. n .. " — dans le sac"
end

COMMANDES.give = function(player, _, argument)
    local id, quantite = tostring(argument or ""):match("^%s*(%S+)%s*(%d*)%s*$")
    if (not id) then Chat.SendMessage(player, "<grey>/give identifiant [quantité]</>"); return end
    local ok, message = DonnerAuSac(player, id, quantite ~= "" and quantite or 1)
    Chat.SendMessage(player, (ok and "<cyan>" or "<grey>") .. SansBalise(message) .. "</>")
end

-- ═══ /tenue — CHANGER UNE PIECE EN DIRECT ═════════════════════════════════════
--
-- C'est le TEST du systeme modulaire, reduit a une commande : on demande un
-- torse ou un visage, il change sous les yeux, et le changement est ENREGISTRE.
--
-- Pourquoi une commande alors que l'ecran de creation fait deja ce choix : parce
-- qu'une demonstration doit tenir en quelques secondes, sans repasser par la
-- creation d'un personnage. C'est aussi le TROISIEME moment du modulaire —
-- creation, spawn, et enfin GAMEPLAY — qui manquait encore.
--
--   /tenue                     -> ce que porte le personnage
--   /tenue torse               -> les pieces disponibles pour ce slot
--   /tenue torse soldier_chest_m  -> l'echange, immediat et persiste

--- Rhabille un personnage vivant. Retire d'abord, remet ensuite : sans le
--- retrait, `AddSkeletalMeshAttached` sur un identifiant deja pris empile deux
--- vetements au lieu de remplacer.
local function AppliquerPiece(character, slot, piece)
    character:RemoveSkeletalMeshAttached(slot)
    if (piece) then character:AddSkeletalMeshAttached(slot, piece.asset) end
end

COMMANDES.tenue = function(player, character, argument)
    local session = Narvos.SessionServeur.De(player)
    if (not session or not session.compte or not session.perso) then
        Chat.SendMessage(player, "<grey>aucun personnage en session</>")
        return
    end

    local Modular = Narvos.Modular
    local perso = session.perso
    local genre = perso.gender or "M"

    -- La morphologie vient du CORPS du personnage : elle décide quelles pièces
    -- il peut porter. Un corps inconnu (fiche ancienne) retombe sur `stylized`,
    -- la famille historique, plutôt que de ne rien proposer.
    local corps = Modular.Corps(perso.corps)
    local famille = corps and corps.famille or "stylized"

    local slot, piece_id = tostring(argument or ""):match("^%s*(%S*)%s*(%S*)%s*$")

    -- Sans argument : ce que porte le personnage, avec les slots disponibles.
    if (not slot or slot == "") then
        Chat.SendMessage(player, "<cyan>tenue de " .. tostring(perso.name) .. "</> "
            .. "<grey>(" .. famille .. ")</>")
        for _, s in ipairs(Modular.SLOTS) do
            local p = Modular.PIECES[perso.tenue and perso.tenue[s]]
            Chat.SendMessage(player, "  <yellow>" .. s .. "</> : "
                .. (p and p.label or "<grey>vide</>"))
        end
        Chat.SendMessage(player, "<grey>/tenue <slot> pour voir les pieces</>")
        return
    end

    if (not Modular.PIECES[piece_id] and (piece_id == nil or piece_id == "")) then
        -- Un slot seul : on liste ce qui est portable, avec l'identifiant a taper.
        local liste = Modular.ParSlot(slot, genre, famille)
        if (#liste == 0) then
            Chat.SendMessage(player, "<grey>slot inconnu ou vide : " .. slot .. "</>")
            Chat.SendMessage(player, "<grey>slots : " .. table.concat(Modular.SLOTS, ", ") .. "</>")
            return
        end
        Chat.SendMessage(player, "<cyan>" .. slot .. "</> — " .. #liste .. " piece(s)")
        for i = 1, #liste do
            Chat.SendMessage(player, "  <yellow>" .. liste[i].id .. "</>  " .. liste[i].label)
        end
        return
    end

    -- Slot + piece : l'echange.
    --
    -- ⚠ On passe par `Roster.MajTenue` et PAS par un attachement direct : c'est
    -- elle qui valide le slot, le genre et la propriete du personnage, et qui
    -- persiste. Un attachement direct donnerait un changement qui disparait a la
    -- reconnexion — une demonstration qui ment.
    local tenue = {}
    for _, sl in ipairs(Modular.SLOTS) do
        if (perso.tenue and perso.tenue[sl]) then tenue[sl] = perso.tenue[sl] end
    end
    tenue[slot] = piece_id

    local ok, raison = Narvos.Roster.MajTenue(session.compte.id, perso.id, tenue)
    if (not ok) then
        Chat.SendMessage(player, "<red>" .. tostring(raison) .. "</>")
        return
    end

    perso.tenue = tenue
    AppliquerPiece(character, slot, Modular.PIECES[piece_id])

    Chat.SendMessage(player, "<green>" .. slot .. "</> -> "
        .. Modular.PIECES[piece_id].label .. " <grey>(enregistre)</>")
end

--- /noclip — traverse le décor et vole.
---
--- ⚠ `SetFlyingMode` NE COUPE QUE LA GRAVITÉ. Ce commentaire affirmait qu'il
--- coupait aussi la collision — c'est faux, vérifié en jeu le 2026-09-05 : le
--- personnage volait et restait bloqué par le décor. C'est ce que fait le
--- package officiel `deathmatch` pour ses spectateurs, et un spectateur ne
--- traverse pas les murs non plus.
---
--- Traverser demande `SetCollision(CollisionType.NoCollision)`, séparément. Les
--- deux ensemble font un vrai noclip ; l'un sans l'autre donne soit un vol
--- bloqué par les murs, soit une chute libre à travers le sol.
---
--- ⚠ Aucun contrôle d'admin ici. C'est un outil de DÉVELOPPEMENT sur un serveur
--- local ; le jour où ce serveur s'ouvre, cette commande doit passer derrière
--- une vérification de droits, sans quoi n'importe qui traverse les murs.
COMMANDES.noclip = function(player, character)
    local actif = not (character:GetValue("narvos_noclip") or false)

    character:SetFlyingMode(actif)
    -- `Normal` et non `Auto` au retour : `Auto` laisse le moteur déduire, et sur
    -- un Character déjà spawné ce n'est pas garanti de revenir à l'état d'avant.
    character:SetCollision(actif and CollisionType.NoCollision or CollisionType.Normal)
    character:SetValue("narvos_noclip", actif, true)

    Chat.SendMessage(player, actif
        and "<cyan>noclip actif</> — vol libre, collisions ignorées"
        or  "<grey>noclip coupé</>")
end

--- /mapz <n> — déplace la Forge en Z, pour trouver sa hauteur à l'œil.
---
--- La map flottait au-dessus du joueur et rien dans le catalogue ne permet de
--- l'abaisser : chaque mesh porte sa transform monde cuite, et ils sont tous
--- posés à l'origine. Déplacer l'origine déplace l'ensemble.
---
--- Outil de RÉGLAGE. Une fois la valeur trouvée, l'ajouter au Z de
--- `decalage_decor` (Catalogs/Mondes.lua) — là elle ne coûte rien, alors qu'ici
--- elle réécrit 623 positions à chaque appel.
---
--- ⚠ RELATIF au calage du catalogue depuis le 2026-09-15. La commande posait le
--- décor à `Vector(0, 0, z)` ABSOLU, écrit quand la Forge vivait à l'origine :
--- depuis qu'elle est calée par `decalage_decor` (-8 472 448, 62 547, …), un seul
--- appel envoyait les 623 meshes à 85 km du joueur.
COMMANDES.mapz = function(player, _character, argument)
    local z = tonumber(argument)
    if (not z or z < -20000 or z > 20000) then
        Chat.SendMessage(player, "<grey>usage : /mapz -800   (ecart en unites au calage du catalogue, -20000..20000)</>")
        return
    end

    local nom = Narvos.MapForge and Narvos.MapForge.NOM
    if (not nom) then
        Chat.SendMessage(player, "<grey>aucune map Forge chargee</>")
        return
    end

    local monde = Narvos.Mondes.Trouver("forge")
    local base = (monde and monde.decalage_decor) or Vector()
    local ok, raison, bouges = Narvos.MapLoader.Decaler(nom, Vector(base.X, base.Y, base.Z + z))
    Chat.SendMessage(player, ok
        and ("<cyan>Forge a %+d unites du calage</> — %d element(s) deplace(s)"):format(z, bouges or 0)
        or ("<grey>%s</>"):format(tostring(raison)))
end

--- /vitesse <n> — multiplicateur de déplacement, pour arpenter une map de 3 km.
COMMANDES.vitesse = function(player, character, argument)
    local n = tonumber(argument)
    if (not n or n <= 0 or n > 20) then
        Chat.SendMessage(player, "<grey>usage : /vitesse 1..20</>")
        return
    end
    character:SetSpeedMultiplier(n)
    Chat.SendMessage(player, ("<cyan>vitesse ×%.1f</>"):format(n))
end

--- /morph <nom> [valeur] — pousse un morph target du visage.
---
--- C'est l'outil de VÉRIFICATION du renommage ARKit. Les 52 cibles de nos têtes
--- ont été nommées d'après l'ordre canonique d'Apple, mais cet ordre est une
--- HYPOTHÈSE : rien ne garantit que l'export Unreal l'ait suivi. Se tromper
--- n'échoue jamais — ça étiquette un sourire en clignement d'œil, en silence.
---
--- Trois essais suffisent à trancher :
---     /morph jawOpen 1        la mâchoire doit s'ouvrir
---     /morph eyeBlinkLeft 1   l'œil GAUCHE doit se fermer
---     /morph mouthSmileLeft 1 le coin GAUCHE de la bouche doit monter
COMMANDES.morph = function(player, character, argument)
    local nom, valeur = (argument or ""):match("^(%S*)%s*(%S*)$")

    -- ── Exploration du catalogue ──────────────────────────────────────────
    --
    -- Le corps morphable porte 290 morphs. Sans ces deux formes, il faudrait
    -- les deviner un par un, et la commande ne servirait qu'a qui connait
    -- deja les noms.
    local Morphs = Narvos.Morphs

    if (not nom or nom == "") then
        Chat.SendMessage(player, "<grey>usage : /morph <nom> [0..1]  .  /morph reset</>")
        local zones = {}
        for _, z in ipairs(Morphs.ZONES) do
            zones[#zones + 1] = z.id .. "(" .. #Morphs.ParZone(z.id) .. ")"
        end
        Chat.SendMessage(player, "<grey>/morph <zone> pour lister : "
            .. table.concat(zones, " ") .. "</>")
        return
    end

    if (nom == "reset") then
        character:ClearMorphTargets()
        Chat.SendMessage(player, "<cyan>morphs remis a zero</>")
        return
    end

    -- `/morph nose` liste les curseurs de la zone, avec leurs DEUX extremites :
    -- ce sont elles qu'attend `SetMorphTarget`, pas l'identifiant du curseur.
    if (valeur == "") then
        local liste = Morphs.ParZone(nom)
        if (#liste > 0) then
            local vus = {}
            for i = 1, math.min(#liste, 10) do
                vus[#vus + 1] = liste[i].positif
            end
            Chat.SendMessage(player, "<grey>" .. SansBalise(nom) .. " : "
                .. table.concat(vus, " ")
                .. (#liste > 10 and (" ... +" .. (#liste - 10)) or "") .. "</>")
            return
        end
    end

    local v = tonumber(valeur)
    if (v == nil) then v = 1.0 end

    character:SetMorphTarget(nom, v)

    -- ⚠ `SansBalise` SUR LE NOM. Il vient du joueur et part dans du rich text :
    -- sans lui, `/morph <img src=x> 1` injecte du balisage dans le chat de tous.
    Chat.SendMessage(player, ("<cyan>%s</> = %.2f"):format(SansBalise(nom), v))
end

--- /ou — position courante, en mètres. Sert à noter un point de la map.
-- ═══ /arme — PRENDRE UNE ARME DE CORPS-A-CORPS ═══════════════════════════════
--
-- Le systeme de melee est ecrit des deux cotes, mais rien ne permettait d'en
-- SAISIR une : `Narvos:EquiperMelee` n'avait aucun appelant. Une commande de
-- chat suffit a l'essayer, et evite d'inventer un menu avant de savoir si le
-- combat se joue bien.
--
--   /arme            -> ce qui est disponible
--   /arme batte      -> la prend
--   /arme rien       -> la range
--
-- ⚠ CE N'EST PAS UNE COMMANDE DE DEVELOPPEMENT. Elle ne donne aucun pouvoir
-- qu'un joueur ne devrait avoir : ramasser une arme est du jeu. Elle disparaitra
-- le jour ou les armes se ramassent au sol.
COMMANDES.arme = function(player, character, argument)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "arme_feu")) then return end
    local Melees = Narvos.CombatServeur
    if (not Melees) then
        Chat.SendMessage(player, "<red>le corps-a-corps n'est pas charge</>")
        return
    end

    -- ⚠ 2026-09-15 : l'arme arrive DANS LE SAC, jamais en main. Demande de
    -- Hanibes : « give -> inventaire -> le joueur choisit d'équiper ». L'objet
    -- d'inventaire d'une arme de mêlée se lit dans `Roue.ARME_PAR_ITEM` (le
    -- catalogue qui relie objet et arme réelle), pas dans une liste recopiée.
    local function ObjetPour(arme_id)
        local ids = {}
        for item_id, c in pairs(Narvos.Roue.ARME_PAR_ITEM) do
            if (c.genre == "melee" and c.arme_id == arme_id) then ids[#ids + 1] = item_id end
        end
        table.sort(ids)
        return ids[1]
    end

    local choix = tostring(argument or ""):match("^%s*(%S*)")

    if (choix == "" or choix == nil) then
        local noms = {}
        for _, a in ipairs(Melees.ARMES) do
            local objet = ObjetPour(a.id)
            noms[#noms + 1] = objet and ("%s <grey>(%d)</>"):format(a.id, a.degats)
                or ("<grey>%s (sans objet)</>"):format(a.id)
        end
        Chat.SendMessage(player, "<yellow>armes</> : " .. table.concat(noms, ", "))
        Chat.SendMessage(player, "<grey>/arme <id> : dans le sac ; /arme rien : range l'arme portee</>")
        return
    end

    if (choix == "rien") then
        local ok, raison = DesequiperEmplacement(player, "weapon")
        Chat.SendMessage(player, ok and "<grey>arme rangee dans le sac</>" or ("<grey>" .. SansBalise(tostring(raison)) .. "</>"))
        return
    end

    local objet = ObjetPour(choix)
    if (not objet) then
        Chat.SendMessage(player, "<red>aucun objet d'inventaire pour l'arme « " .. SansBalise(choix) .. " »</>")
        return
    end
    local ok, message = DonnerAuSac(player, objet, 1)
    Chat.SendMessage(player, (ok and "<cyan>" or "<grey>") .. SansBalise(message) .. "</>")
end

-- ═══ /acheter, /vendre — LA BOUTIQUE DU MARCHAND D'À CÔTÉ ═════════════════════
--
-- Le panneau de boutique n'existe pas encore (chantier UI séparé) ; le chat est
-- le seul retour visible vérifié. Ce NE sont PAS des commandes de
-- développement : acheter est du jeu, et le marchand, le prix comme le solde
-- sont lus côté serveur — le client ne peut rien truquer.
--
--   /acheter                  -> le stock du marchand proche, avec les prix
--   /acheter fragment_vie     -> en achète un
--   /acheter ammo_arrows 20   -> en achète vingt
--   /vendre metal_rare 2      -> en revend deux (au buyFactor du marchand)
--- /craft — ouvre le menu de craft de la station la plus proche.
--- Le joueur DOIT être dans le rayon d'un atelier (déclencheur posé) : sans lui,
--- aucun craft ne s'exécuterait de toute façon — `Fabriquer` exige la même
--- proximité. C'est du JEU, pas du développement : pas dans DEV_COMMANDES.
COMMANDES.craft = function(player, character, argument)
    local station = atelier_du_joueur[player]
    if (not station) then
        Chat.SendMessage(player, "<grey>Approchez-vous d'un atelier.</>")
        return
    end
    OuvrirAtelier(player, station)
end

COMMANDES.acheter = function(player, character, argument)
    local m = marchand_proche[player]
    if (not m) then
        Chat.SendMessage(player, "<grey>approchez-vous d'un marchand</>")
        return
    end

    local item_id, n = tostring(argument or ""):match("^%s*(%S*)%s*(%S*)%s*$")
    if (item_id == "") then
        local stock, ecartes = Narvos.Boutique.Stock(m)
        Chat.SendMessage(player, "<cyan>" .. m.name .. "</> — " .. m.subtitle)
        -- Même bifurcation que `EnvoyerBoutique` : chez l'équipementier, la
        -- liste vide n'est pas un manque de marchandise, c'est le mauvais
        -- guichet. Annoncer « rien a vendre » enverrait le joueur ailleurs.
        if (Narvos.Boutique.EstEquipementier(m)) then
            Chat.SendMessage(player, "<grey>tenues et equipement : ouvrez le vestiaire</>")
            return
        end
        if (#stock == 0) then
            Chat.SendMessage(player, "<grey>rien a vendre pour l'instant</>")
        end
        for _, e in ipairs(stock) do
            Chat.SendMessage(player, ("  <yellow>%s</>  %s — %d cr")
                :format(e.id, tostring(e.def.label or e.id), e.prix))
        end
        if (ecartes > 0) then
            Chat.SendMessage(player, ("<grey>(%d reference(s) pas encore vendables)</>")
                :format(ecartes))
        end
        Chat.SendMessage(player, "<grey>/acheter <objet> [quantite] · /vendre <objet> [quantite]</>")
        return
    end

    AcheterChez(player, item_id, tonumber(n) or 1)
end

COMMANDES.vendre = function(player, character, argument)
    local m = marchand_proche[player]
    if (not m) then
        Chat.SendMessage(player, "<grey>approchez-vous d'un marchand</>")
        return
    end

    local item_id, n = tostring(argument or ""):match("^%s*(%S*)%s*(%S*)%s*$")
    if (item_id == "") then
        Chat.SendMessage(player, "<grey>/vendre <objet> [quantite]</> — le marchand reprend a "
            .. tostring(math.floor((tonumber(m.buyFactor) or 0) * 100)) .. " % de la valeur")
        return
    end

    VendreChez(player, item_id, tonumber(n) or 1)
end

-- ═══ /exporter — FIGER CE QU'ON VIENT DE POSER ═══════════════════════════════
--
-- Le gizmo deplace, le spawner invoque — et tout disparait au rechargement du
-- package. Cette commande ferme la boucle : poser a l'oeil, figer en catalogue,
-- et le monde les repose seul au demarrage suivant.
--
--   /exporter decor   -> Catalogs/DecorPose.lua
--   /exporter pnj     -> Catalogs/Peuplement.lua
--
-- ⚠ COMMANDE DE DEVELOPPEMENT. Elle ECRIT DANS LE DEPOT (les Packages sont des
-- jonctions) : sur un serveur public, n'importe qui pourrait reecrire un
-- catalogue du jeu. Elle est donc dans DEV_COMMANDES, fermee par defaut.
COMMANDES.exporter = function(player, character, argument)
    local Export = Narvos.Export
    if (not Export) then
        Chat.SendMessage(player, "<red>l'export n'est pas charge</>")
        return
    end

    local quoi = tostring(argument or ""):match("^%s*(%S*)"):lower()
    local ok, message

    if (quoi == "decor" or quoi == "props") then
        ok, message = Export.Props(player)
    elseif (quoi == "pnj" or quoi == "peuplement") then
        ok, message = Export.Pnj(player)
    else
        Chat.SendMessage(player, "<yellow>/exporter decor</> ou <yellow>/exporter pnj</>")
        return
    end

    Chat.SendMessage(player, (ok and "<green>" or "<red>") .. tostring(message) .. "</>")
    if (ok) then
        Chat.SendMessage(player, "<grey>redemarrer le serveur pour que le catalogue soit relu</>")
    end
end

COMMANDES.ou = function(player, character)
    local p = character:GetLocation()
    Chat.SendMessage(player, ("<cyan>position</> %.1f  %.1f  %.1f  (m)")
        :format(p.X / M, p.Y / M, p.Z / M))
end

-- ═══ /vaisseau — TENIR LIEU DE VAISSEAU, EN ATTENDANT LES VAISSEAUX ═══════════
--
-- Les liaisons vers l'orbite exigent de piloter un appareil (`exige_vol` dans
-- `Catalogs/Mondes.lua`). Or il n'y a AUCUN vehicule dans le pack cuit —
-- mesure du 2026-09-03 — et nanos n'expose que `VehicleWheeled` et
-- `VehicleWater` : pas de classe volante.
--
-- Cette commande pose la MEME valeur d'entite que posera le futur systeme de
-- vaisseaux, `narvos_vol`. Le jour ou un vaisseau existe, il ecrit cette valeur
-- a l'embarquement et la commande devient superflue — sans qu'une ligne de
-- `Server/Voyage.lua` ne change.
--
-- ⚠ Aucun controle de droits, comme /noclip et /vitesse. Outil de DEVELOPPEMENT
-- sur serveur local. A passer derriere une verification avant toute ouverture.
COMMANDES.vaisseau = function(player, character)
    local actif = not (character:GetValue("narvos_vol") or false)

    -- `SetFlyingMode` est ce qu'emploie le package officiel `deathmatch` pour
    -- ses spectateurs : il coupe la gravite. C'est le comportement le plus
    -- proche d'un appareil en vol qu'on puisse offrir sans vehicule.
    character:SetFlyingMode(actif)
    character:SetValue("narvos_vol", actif, true)

    Chat.SendMessage(player, actif
        and "<cyan>vol actif</> — les rampes orbitales s'ouvrent"
        or  "<grey>vol coupe</>")
end

-- ═══ /vehicule — ESSAYER UNE VOITURE CUITE, POUR DE VRAI ══════════════════════
--
--   /vehicule                     -> les 12 modeles City_Traffic_Pro cuits
--   /vehicule executive_sedan     -> spawn devant soi, au volant direct
--
-- C'est le banc d'essai du chantier voitures : la classe `VehicleWheeled`
-- heritee, les os resolus par signature, le spawn et la montee au volant sont
-- dans `Server/Voitures.lua` (Narvos.VoituresServeur). Cette commande n'est que
-- la poignee — la revalidation du modele est faite la-bas, cote serveur.
--
-- ⚠ DEV, comme /vaisseau : un spawn de vehicule physique entre des mains
-- quelconques remplirait la map d'epaves simulees.
COMMANDES.vehicule = function(player, character, argument)
    local id = tostring(argument or ""):match("^%s*(%S*)")

    if (id == "") then
        local liste = Narvos.Voitures.ListeComplete()
        Chat.SendMessage(player, "<cyan>vehicules</> — " .. #liste .. " modele(s) cuit(s)")
        for _, m in ipairs(liste) do
            Chat.SendMessage(player, "  <yellow>" .. m.id .. "</>  " .. m.label)
        end
        Chat.SendMessage(player, "<grey>usage : /vehicule <id></>")
        return
    end

    local ok, raison = Narvos.VoituresServeur.Spawner(player, id)
    if (not ok) then
        Chat.SendMessage(player, "<grey>" .. tostring(raison) .. "</>")
        return
    end
    Chat.SendMessage(player, "<cyan>" .. id .. "</> — au volant")
end

-- ═══ /compagnon — ADOPTER, SORTIR, RANGER ════════════════════════════════════
--
--   /compagnon                 -> les especes, leur etat d'adoption, leur
--                                 disponibilite reelle (cuit / pas cuit)
--   /compagnon <id>            -> sort ce compagnon (l'adopte s'il ne l'est pas)
--   /compagnon off             -> le range
--
-- ⚠ PAS dans DEV_COMMANDES. Un compagnon est une entite par joueur, plafonnee a
-- une, detruite a la deconnexion — pas un pouvoir de peuplement comme /spawn.
COMMANDES.compagnon = function(player, character, argument)
    local id = tostring(argument or ""):match("^%s*(%S*)")

    if (id == "") then
        local liste = Narvos.AnimauxServeur.Liste(player)
        local cuits = 0
        for _, e in ipairs(liste) do if (e.cuit) then cuits = cuits + 1 end end
        Chat.SendMessage(player, "<cyan>compagnons</> — " .. #liste
            .. " espece(s), " .. cuits .. " reellement invocable(s)")
        for _, e in ipairs(liste) do
            -- L'etat est DIT, pas deduit par le joueur. Une espece grise sans
            -- explication ferait croire a un bug.
            local etat = e.actif and "<green>sorti</>"
                or (e.possede and "<yellow>adopte</>" or "<grey>a adopter</>")
            local dispo = e.cuit and "" or "  <grey>(mesh non cuit)</>"
            Chat.SendMessage(player, "  <yellow>" .. e.id .. "</>  "
                .. e.label .. "  " .. etat .. dispo)
        end
        Chat.SendMessage(player, "<grey>usage : /compagnon <id>  |  /compagnon off</>")
        return
    end

    if (id == "off") then
        local ok, raison = Narvos.AnimauxServeur.Activer(player, nil)
        Chat.SendMessage(player, ok and "<cyan>compagnon range</>"
            or ("<grey>" .. tostring(raison) .. "</>"))
        return
    end

    -- Adoption implicite : le premier /compagnon <id> adopte. Le systeme
    -- d'acquisition (marchand, quete, loot) viendra par-dessus ; refuser ici
    -- rendrait la commande inutilisable avant qu'il existe.
    -- `Adopter` refuse « Deja adopte » : c'est le cas courant ici, pas une
    -- erreur. On ignore son retour et on laisse `Activer` trancher — lui seul
    -- connaît la vraie raison d'un refus (espèce inconnue, mesh non cuit).
    Narvos.AnimauxServeur.Adopter(player, id, nil)
    local ok, raison = Narvos.AnimauxServeur.Activer(player, id)
    if (not ok) then
        Chat.SendMessage(player, "<grey>" .. tostring(raison) .. "</>")
        return
    end
    Chat.SendMessage(player, "<cyan>" .. tostring(raison) .. "</> — vous suit")
end

-- /metahumain et /mhbp : RETIRÉS le 2026-09-14 avec le pont MetaHuman. /mhbp
-- visait des événements (Change_Top…) absents de BP_NarvosMH_M/F — relu dans les
-- paquets cuits — et `/mhbp poser` ajoutait un second MetaHuman au joueur.

-- ═══ /locomotion — NOTRE locomotion, au lieu de celle du moteur ═══════════════
--
-- Mesuré le 2026-09-12 : le jeu tourne sur la locomotion NATIVE de nanos. Nos
-- 3 480 animations cuites ne servent qu aux emotes, au combat et aux PNJ, et
-- AUCUN appel à `SetAnimationIdleWalkRunStanding` n existait dans le paquet.
--
-- L API attend un BLEND SPACE 2D (axe horizontal = vitesse X, vertical = Y).
-- `narvos::BS_EnemyWalk` est le SEUL blend space déclaré du pack, et il est lié
-- à SKEL_Mannequin (mesuré) : il suffit à prouver la voie tout de suite. Les
-- blend spaces propres — marche, course, accroupi — se fabriqueront dans
-- l éditeur depuis nos animations déjà cuites.
--
-- ⚠ `SetAnimationIdleWalkRunStanding` est d autorité SERVEUR et son coût est
-- marqué « slow » dans l API : une commande d essai, pas un appel par trame.
COMMANDES.locomotion = function(player, character, argument)
    if (not character) then
        Chat.SendMessage(player, "<grey>aucun personnage controle</>")
        return
    end

    local asset = tostring(argument or ""):match("^%s*(%S*)")
    if (asset == "") then
        Chat.SendMessage(player, "<cyan>/locomotion narvos::BS_EnemyWalk</>  "
            .. "<grey>pose un blend space de deplacement ; « off » rend celui du moteur</>")
        return
    end

    if (asset == "off") then
        -- Chaîne vide : on rend la main au blend space par défaut de nanos.
        local rendu = pcall(function() character:SetAnimationIdleWalkRunStanding("") end)
        Chat.SendMessage(player, rendu and "<cyan>locomotion du moteur rendue</>"
            or "<grey>refuse par le moteur</>")
        return
    end

    local pose = pcall(function() character:SetAnimationIdleWalkRunStanding(asset, false) end)
    Console.Log("[LOCOMOTION] " .. asset .. " : " .. (pose and "pose" or "refuse"))
    Chat.SendMessage(player, pose
        and ("<cyan>" .. asset .. " pose — marche pour voir</>")
        or ("<grey>refuse : " .. asset .. "</>"))
end

-- ═══ /tp — POINTS DE TÉLÉPORTATION ════════════════════════════════════════════
--
--   /tp                 -> ouvre le panneau d'édition (comme F6) ; la liste n'est
--                          envoyée qu'à qui peut éditer (PeutGerer, côté serveur)
--   /tp creer <nom>     -> un point là où l'on se tient
--   /tp aller <id>      -> s'y rendre
-- Le reste passe par le panneau. La garde vit dans Server/Teleports.lua
-- (`Editer`) : cette commande n'en pose pas une seconde, qui finirait par diverger.
-- ═══ /editionpnj — repères radar et diagnostic texture des PNJ ═══════════════
-- Ouvre le panneau ; chacun le lit, seul un administrateur modifie (garde
-- serveur, Server/EditionPnj.lua).
COMMANDES.editionpnj = function(player, _character, _argument)
    local srv = Narvos.EditionPnjServeur
    if (not srv) then
        Chat.SendMessage(player, "<grey>edition des PNJ indisponible</>")
        return
    end
    srv.Envoyer(player, true, nil)
end

-- /xp <montant> : essai de la progression (niveaux, points de talent). Reservee
-- a l'administration (DEV_COMMANDES) : ouverte, elle donnerait le niveau 50.
--- /revive — le joueur mort revient tout de suite : à son dernier Zaap activé, sinon
--- à l'arrivée de sa cité (Server/Reapparition.lua). Sans rien faire, il revient
--- seul au bout de `Reapparition.DELAI_AUTO_MS`.
--- /revive <joueur> — un administrateur relève quelqu'un d'autre.
--- Ouverte à TOUS pour soi-même : revenir après la mort n'est pas un outil de dev.
COMMANDES.revive = function(player, _character, argument)
    local srv = Narvos.ReapparitionServeur
    local nom = tostring(argument or ""):match("^%s*(.-)%s*$")
    local cible = player
    if (nom ~= "") then
        if (not PeutGerer(player)) then
            Chat.SendMessage(player, "<grey>relever un autre joueur est reserve aux administrateurs</>")
            return
        end
        cible = nil
        for _, p in ipairs(Player.GetAll()) do
            if (tostring(p:GetName()):lower() == nom:lower()) then cible = p break end
        end
        if (not cible) then
            Chat.SendMessage(player, "<grey>joueur introuvable : " .. nom .. "</>")
            return
        end
    end
    local ok, message = srv.Revive(player, cible)
    -- Relevé soi-même : `Revive` a déjà dit « De retour à … ».
    if (ok and cible == player) then return end
    Chat.SendMessage(player, ok and ("<cyan>" .. message .. "</>") or ("<grey>" .. message .. "</>"))
end

COMMANDES.xp = function(player, _character, argument)
    local srv = Narvos.ProgressionServeur
    local montant = math.floor(tonumber(tostring(argument or ""):match("^%s*(%d+)")) or 0)
    if (not srv or montant <= 0) then
        Chat.SendMessage(player, "<grey>usage : /xp <montant></>")
        return
    end
    local niveaux = srv.GagnerXP(player, montant, "admin")
    Chat.SendMessage(player, ("<cyan>+%d XP</>%s"):format(montant,
        niveaux > 0 and (" — <yellow>" .. niveaux .. " niveau(x)</>") or ""))
end

-- ═══ /zaap — POINTS DE SAUVEGARDE (D4, 2026-09-15) ═══════════════════════════
--
--   /zaap                        -> votre Zaap actif, et la liste (ids pour qui édite)
--   /zaap creer <nom>            -> un Zaap là où l'on se tient, tourné comme soi
--   /zaap renommer <id> <nom>
--   /zaap ici <id>               -> le déplacer là où l'on se tient
--   /zaap supprimer <id>
--   /zaap aller <id>             -> s'y rendre (là où l'on réapparaît)
-- Activer un Zaap : touche d'interaction dans son cercle (Server/Zaaps.lua). La
-- garde d'édition vit dans `ZaapsServeur.Editer` : cette commande n'en pose pas
-- une seconde, qui finirait par diverger.
COMMANDES.zaap = function(player, _character, argument)
    local srv = Narvos.ZaapsServeur
    local mot, reste = tostring(argument or ""):match("^%s*(%S*)%s*(.-)%s*$")
    if (mot == "") then
        local zaaps = srv.Liste()
        local arrivee = srv.ArriveePour(player)
        Chat.SendMessage(player, "<cyan>Zaaps</> — " .. #zaaps .. " pose(s) ; point de reapparition : "
            .. (arrivee and Narvos.Zaaps.Libelle(arrivee.nom) or "votre cite"))
        local edition = PeutGerer(player)
        for _, z in ipairs(zaaps) do
            Chat.SendMessage(player, edition and ("  " .. z.id .. " — " .. z.nom .. " (" .. z.monde .. ")")
                or ("  " .. z.nom))
        end
        return
    end
    local ok, message
    if (mot == "creer") then
        ok, message = srv.Editer(player, "Creer", reste)
    elseif (mot == "renommer") then
        local id, nom = reste:match("^(%S+)%s+(.+)$")
        ok, message = srv.Editer(player, "Renommer", id, nom)
    elseif (mot == "ici") then
        ok, message = srv.Editer(player, "DeplacerIci", reste)
    elseif (mot == "supprimer") then
        ok, message = srv.Editer(player, "Supprimer", reste)
    elseif (mot == "aller") then
        ok, message = srv.Editer(player, "Aller", reste)
    else
        Chat.SendMessage(player, "<grey>usage : /zaap | /zaap creer <nom> | /zaap renommer <id> <nom> | "
            .. "/zaap ici <id> | /zaap supprimer <id> | /zaap aller <id></>")
        return
    end
    Chat.SendMessage(player, ok and ("<cyan>" .. tostring(message) .. "</>")
        or ("<grey>" .. tostring(message) .. "</>"))
end

COMMANDES.tp = function(player, _character, argument)
    local srv = Narvos.TeleportsServeur
    local mot, reste = tostring(argument or ""):match("^%s*(%S*)%s*(.-)%s*$")
    if (mot == "") then
        srv.EnvoyerListe(player, true, nil)
        return
    end
    local ok, message
    if (mot == "creer") then
        ok, message = srv.Editer(player, "Creer", reste)
    elseif (mot == "aller") then
        ok, message = srv.Editer(player, "Aller", reste)
    else
        Chat.SendMessage(player, "<grey>usage : /tp  |  /tp creer <nom>  |  /tp aller <id></>")
        return
    end
    Chat.SendMessage(player, ok and ("<cyan>" .. tostring(message) .. "</>")
        or ("<grey>" .. tostring(message) .. "</>"))
end

-- ═══ /armes — MENU DE TEST DES ARMES ═════════════════════════════════════════
--
-- Le pack de base nanos livre 28 armes reglees ; Weapons.lua en recopiait trois.
-- Le catalogue GENERE `ArmesBase` apporte les 24 autres (4 exclues, motivees
-- dans son en-tete). Ce menu existe pour les ESSAYER ; il sera retire quand le
-- butin et les marchands les distribueront. Meme garde que /spawn.
--
--   /armes            -> la liste
--   /armes <id>       -> ajoute l'arme au sac
--   touche O          -> le panneau (Client/UI, panneau « armes »)

--- Le joueur a-t-il le droit d'ouvrir un menu de test ? Meme regle que les
--- commandes DEV : la config serveur, ou un administrateur declare.
local function PeutTester(player)
    return PeutGerer(player)
end

COMMANDES.armes = function(player, character, argument)
    local id = tostring(argument or ""):match("^%s*(%S*)")
    if (id == "") then
        local options = Narvos.Weapons.Options()
        Chat.SendMessage(player, "<cyan>armes</> — " .. #options .. " arme(s), touche O pour le menu")
        for _, a in ipairs(options) do
            Chat.SendMessage(player, "  <yellow>" .. a.id .. "</>  " .. a.label .. "  <grey>" .. tostring(a.categorie) .. "</>")
        end
        return
    end
    local ok, message = DonnerAuSac(player, id, 1)
    Chat.SendMessage(player, (ok and "<cyan>" or "<grey>") .. SansBalise(message) .. "</>")
end

-- ═══ MENU VEHICULES ══════════════════════════════════════════════════════════
--
-- Demande de Hanibes le 2026-09-12 : « ajoute un menu permettant de faire
-- apparaitre les vehicules ». La commande `/vehicule` existait deja ; ce qui
-- manquait, c'est de pouvoir les voir et les choisir sans taper un identifiant
-- qu'aucun ecran n'affichait.
--
-- Meme forme que le menu d'armes, volontairement : le catalogue part a qui
-- demande — VOIR n'est pas SPAWNER — et le refus tombe sur l'action, cote
-- serveur, jamais sur l'affichage.
Events.SubscribeRemote("Narvos:DemanderVehicules", function(player)
    if (not Session.EnJeu(player)) then return end
    Events.CallRemote("Narvos:Vehicules", player, Reliability.Reliable, {
        -- Voitures ET motos : le menu (Z) liste tout ce qui roule et qui est cuit.
        vehicules = Narvos.Voitures.ListeComplete(),
        vaisseaux = Narvos.VaisseauxCatalogue,
        test = PeutTester(player),
    })
end)

Events.SubscribeRemote("Narvos:SpawnerVehicule", function(player, id)
    if (not Session.EnJeu(player)) then return end
    if (type(id) ~= "string") then return end
    -- ⚠ LA MEME GARDE QUE `/vehicule`. Un vehicule physique entre des mains
    -- quelconques remplirait la map d'epaves simulees ; le menu ne doit pas
    -- ouvrir une porte que la commande ferme.
    if (not PeutTester(player)) then
        Chat.SendMessage(player,
            "<grey>Menu de test ferme : commandes_dev ou administrateur requis</>")
        return
    end
    local ok, raison = Narvos.VoituresServeur.Spawner(player, id)
    Chat.SendMessage(player, ok
        and ("<cyan>" .. id .. "</> — au volant")
        or ("<grey>" .. tostring(raison) .. "</>"))
end)

Events.SubscribeRemote("Narvos:DemanderArmes", function(player)
    if (not Session.EnJeu(player)) then return end
    -- Le catalogue part meme sans droit : voir la liste n'est pas prendre une
    -- arme. Le refus, lui, tombe sur `Narvos:DonnerArme`.
    Events.CallRemote("Narvos:Armes", player, Reliability.Reliable, {
        categories = Narvos.Weapons.Categories(),
        armes = Narvos.Weapons.Options(),
        test = PeutTester(player),
    })
end)

Events.SubscribeRemote("Narvos:DonnerArme", function(player, id)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "arme_feu")) then return end
    if (not Session.EnJeu(player)) then return end
    if (type(id) ~= "string") then return end
    if (not PeutTester(player)) then
        Events.CallRemote("Narvos:ArmeErreur", player, Reliability.Reliable,
            "Menu de test ferme : commandes_dev ou administrateur requis")
        return
    end
    local character = player:GetControlledCharacter()
    if (not character) then return end
    local ok, message = DonnerAuSac(player, id, 1)
    Events.CallRemote(ok and "Narvos:ArmeInfo" or "Narvos:ArmeErreur", player, Reliability.Reliable, message)
end)

Events.SubscribeRemote("Narvos:LacherArme", function(player)
    if (not Session.EnJeu(player)) then return end
    local character = player:GetControlledCharacter()
    if (not character) then return end
    local tenue = character:GetPicked()
    if (not tenue) then return end
    character:Drop()
    -- Une arme lachee par le menu de test n'a plus d'usage : la laisser au sol
    -- accumulerait une entite repliquee par essai.
    Timer.SetTimeout(function() if (tenue:IsValid()) then tenue:Destroy() end end, 100)
end)

-- ═══ /radio — LE CANAL DES TALKIES-WALKIES ════════════════════════════════════
--
--   /radio                 canal courant et aide
--   /radio canal 7         regler le canal (1 a 99)
--   /radio on bouge        emettre sur le canal, vers tous les porteurs a l'ecoute
--
-- La decision (qui entend, format de la ligne, nettoyage du texte) est dans
-- Logic/Radio.lua et TexteChat.lua ; Server/Communications.lua releve les faits.
COMMANDES.radio = function(player, _character, argument)
    local ok, message = Narvos.CommunicationsServeur.Radio(player, argument)
    if (message) then
        Chat.SendMessage(player, ok
            and ("<cyan>" .. tostring(message) .. "</>")
            or ("<grey>" .. tostring(message) .. "</>"))
    end
end

-- ═══ /digicode — POSER, RECODER, RETIRER UNE PORTE A CODE ═════════════════════
--
-- Le code ne passe JAMAIS par le chat : la commande ouvre le clavier WebUI.
-- Voir Server/Digicode.lua (regle des zones, blocage, empreinte salee).
COMMANDES.digicode = function(player, character, argument)
    Narvos.DigicodeServeur.Commande(player, character, argument)
end

-- ═══ /minimap — REGLER LA MINIMAP AKO A L'ECRAN ═══════════════════════════════
--
--   /minimap            aide
--   /minimap off | on   cacher / montrer le widget
--   /minimap 300        demi-etendue de la boite a 300 m (reglage du zoom en jeu)
--   /minimap auto       la portee du radar (defaut)
--
-- N'agit que sur l'affichage du joueur qui la tape : le client pose et dimensionne
-- sa carte seul (Client/Minimap.lua). Aucune raison de la reserver aux admins.
COMMANDES.minimap = function(player, _character, argument)
    local a = tostring(argument or ""):lower():match("^%s*(%S*)")
    if (a == "off" or a == "on") then
        Events.CallRemote("Narvos:Minimap:Regler", player, Reliability.Reliable, -1, a == "off")
        return
    end
    if (a == "auto") then
        Events.CallRemote("Narvos:Minimap:Regler", player, Reliability.Reliable, 0, false)
        return
    end
    local metres = tonumber(a)
    if (metres and metres >= 20 and metres <= 6000) then
        Events.CallRemote("Narvos:Minimap:Regler", player, Reliability.Reliable, metres, false)
        return
    end
    Chat.SendMessage(player, "<cyan>/minimap</> off | on | auto | <20-6000> (metres de demi-etendue)")
end

-- ═══ /diag — LA TAILLE RENDUE DES PERSONNAGES, MESUREE PAR LE CLIENT ═════════
--
-- `Actor:GetBounds()` est d'autorite CLIENT : le serveur ne peut pas mesurer ce
-- que le joueur voit. Il demande au client (Client/Diagnostic.lua), qui repond
-- par `Narvos:DiagRapport`, et le serveur ECRIT le rapport dans SON journal —
-- celui qu'on lit sans avoir a ouvrir la machine du joueur.
COMMANDES.diag = function(player)
    Events.CallRemote("Narvos:DiagDemande", player, Reliability.Reliable)
    Chat.SendMessage(player, "<grey>diagnostic demande au client — resultat dans le journal serveur</>")
end

-- ⚠ Le journal du serveur ne s'ecrit sur disque qu'a SA fermeture : le rapport
-- est donc AUSSI ecrit dans un fichier du package, lisible pendant que le jeu
-- tourne (`Packages/narvos-map-proto` est une jonction vers le depot, meme
-- mecanique que Server/Export.lua). Le chemin complet est annonce au joueur.
local DOSSIER_DIAG = "Packages/narvos-map-proto/.data"
local MAX_LIGNES_DIAG = 200

-- Un SUJET par fichier : le rapport de conduite ne doit pas ecraser celui du
-- MetaHuman. Le sujet vient du client : il est borne a des minuscules, jamais
-- pris tel quel dans un chemin.
Events.SubscribeRemote("Narvos:DiagRapport", function(player, lignes, sujet)
    if (type(lignes) ~= "table") then return end
    local nom_sujet = (type(sujet) == "string" and sujet:match("^[a-z_]+$") and #sujet <= 24)
        and sujet or "client"
    local FICHIER_DIAG = DOSSIER_DIAG .. "/diag_" .. nom_sujet .. ".txt"
    Console.Log("[DIAG] rapport " .. nom_sujet .. " de " .. tostring(player:GetName()) .. " (" .. #lignes .. " ligne(s))")
    for i, l in ipairs(lignes) do
        if (i > MAX_LIGNES_DIAG) then break end
        Console.Log("[DIAG] " .. tostring(l))
    end

    local contenu = { "rapport /diag (" .. nom_sujet .. ") de " .. tostring(player:GetName()) }
    pcall(function() contenu[1] = contenu[1] .. " — " .. os.date("%Y-%m-%d %H:%M:%S") end)
    for i, l in ipairs(lignes) do
        if (i > MAX_LIGNES_DIAG) then break end
        contenu[#contenu + 1] = tostring(l)
    end
    local ecrit = pcall(function()
        pcall(function() File.CreateDirectory(DOSSIER_DIAG) end)
        local f = File(FICHIER_DIAG, true)
        f:Write(table.concat(contenu, "\n") .. "\n")
        pcall(function() f:Close() end)
    end)
    local complet = FICHIER_DIAG
    pcall(function() complet = File.GetFullPath(FICHIER_DIAG) end)
    Chat.SendMessage(player, ecrit and ("<grey>rapport /diag ecrit : " .. tostring(complet) .. "</>")
        or "<grey>rapport /diag : ecriture du fichier impossible (voir le journal serveur)</>")
end)

-- ═══ /monde — OU SUIS-JE, OU PUIS-JE ALLER ════════════════════════════════════
--
--   /monde              l'etat de tous les passages
--   /monde orbital      voyage immediat, sans passer par le portail
--
-- Le second usage n'est pas un raccourci de confort : c'est le seul moyen de
-- tester une arrivee quand le portail de depart n'existe pas encore.
COMMANDES.monde = function(player, character, argument)
    local Voyage = Narvos.Voyage
    local Serveur = Narvos.VoyageServeur

    if (argument == nil or argument == "") then
        local ok, dimension = pcall(function() return player:GetDimension() end)
        local ici = character and Narvos.Mondes.ParPosition(character:GetLocation()) or nil
        Chat.SendMessage(player, ("<cyan>ici :</> %s"):format(
            ici and ici.label or ("dimension " .. tostring(dimension))))

        for _, e in ipairs(Voyage.Etat()) do
            Chat.SendMessage(player, ("  %s -> %s  %s%s"):format(
                e.de, e.vers,
                e.praticable and "<green>ouvert</>" or ("<grey>" .. tostring(e.raison) .. "</>"),
                e.exige_vol and "  <yellow>(vaisseau)</>" or ""))
        end
        return
    end

    local cible = argument:lower():match("^%s*(%S+)")
    local praticable, raison = Voyage.MondePraticable(cible)
    if (not praticable) then
        Chat.SendMessage(player, "<grey>" .. tostring(raison) .. "</>")
        return
    end

    Serveur.Charger(cible)
    local ok, motif = Serveur.Envoyer(player, cible)
    if (not ok) then
        Chat.SendMessage(player, "<grey>" .. tostring(motif) .. "</>")
    end
end

--- Commandes qui donnent un pouvoir qu'un joueur ne devrait pas avoir.
--- Tout ce qui n'est pas listé ici reste ouvert : `/tenue`, `/ou`, `/morph`
--- n'agissent que sur son propre personnage et ne cassent rien.
local DEV_COMMANDES = {
    give = true,       -- attribution d'objets : administrateur ou mode dev
    noclip = true,      -- traverse les murs
    vitesse = true,     -- x20 en déplacement
    vaisseau = true,    -- ouvre les liaisons orbitales
    monde = true,       -- téléportation entre les mondes
    vehicule = true,    -- spawn d'un véhicule physique
    armes = true,       -- menu de test des armes (a retirer avec le butin)
    diag = true,        -- mesure la taille RENDUE des personnages (journal)
    mapz = true,        -- déplace TOUTE la map Forge (outil de réglage, 1 461 positions)
    -- ⚠ `exporter` ECRIT DANS LE DEPOT. Sur un serveur public, laisser cette
    -- commande ouverte permettrait a n'importe qui de reecrire un catalogue du
    -- jeu — pas de tricher, de MODIFIER LE CONTENU.
    -- Outils d essai du 2026-09-12 : ils posent des acteurs et changent
    -- l animation d un personnage. Ouverts a tous, ils seraient un jouet.
    locomotion = true,
    exporter = true,
    xp = true,          -- octroie de l'XP (essai de la progression, 2026-09-13)
}

Chat.Subscribe("PlayerSubmit", function(message, player)
    -- Une commande commence par `/`. Tout le reste est une phrase et part
    -- normalement dans le chat.
    local nom, argument = tostring(message):match("^/(%a+)%s*(.*)$")
    if (not nom) then return end

    local commande = COMMANDES[nom:lower()]
    if (not commande) then
        Chat.SendMessage(player, "<grey>commande inconnue : /" .. nom .. "</>")
        return false
    end

    -- ── Commandes de DÉVELOPPEMENT ───────────────────────────────────────────
    --
    -- ⚠ FERMÉES PAR DÉFAUT, et c'est le point. Elles étaient jusqu'ici ouvertes
    -- à tous, sans le moindre contrôle : `/noclip` traverse les murs,
    -- `/vitesse 20` arpente la map, `/vaisseau` ouvre les rampes orbitales,
    -- `/monde` téléporte n'importe où. Sur un serveur public, c'est la partie
    -- entière qui tombe.
    --
    -- Le drapeau vit dans `[custom_data]` de Package.toml. Le RETIRER suffit à
    -- fermer ; le défaut, lui, est sûr. C'est l'inverse de ce qu'on avait —
    -- une porte ouverte qu'il aurait fallu penser à fermer le jour de
    -- l'ouverture, c'est-à-dire le jour où on l'aurait oubliée.
    --
    -- ⚠ Ce n'est PAS un contrôle de droits. Le jour où plusieurs personnes se
    -- connectent à un serveur de développement, il faudra une vraie liste
    -- d'administrateurs — ce drapeau ne distingue pas les joueurs entre eux.
    if (DEV_COMMANDES[nom:lower()] and not PeutGerer(player)) then
        Chat.SendMessage(player, "<grey>/" .. nom .. " est reservee au developpement</>")
        return false
    end

    local character = player:GetControlledCharacter()
    if (not character) then
        Chat.SendMessage(player, "<grey>aucun personnage controle</>")
        return false
    end

    commande(player, character, argument)

    -- `false` retient le message : sans ça, « /noclip » s'afficherait dans le
    -- chat de tout le monde en plus d'agir.
    return false
end)

-- ── Armurier ───────────────────────────────────────────────────────────────────

-- Arme suivante à distribuer, par joueur. Passer dans le déclencheur ajoute
-- l'arme d'après au sac, sans l'équiper : l'essai passe ensuite par le même
-- chemin inventaire -> équipement que le butin, le craft et `/give`.
-- `arme_suivante` est declaree EN TETE du fichier (voir les tables par joueur) :
-- le gestionnaire Player "Destroy" la purge bien avant cette ligne.

--- Un PNJ qui remet une arme au contact.
--- Un personnage non possédé, pas un simple repère : on veut voir à quoi
--- ressemble un PNJ NARVOS, et c'est le même chemin de code que les futurs
--- marchands du catalogue.
local function PoserArmurier()
    local position = PresDe(0, RAYON_PADS, SOL_Z)

    local pnj, raison = Narvos.CharacterBuilder.Spawn(
        "warrior_tank", position, Rotator(0, 180, 0)
    )
    if (not pnj) then
        Console.Error("Armurier : " .. tostring(raison))
        return
    end

    -- Personne ne le possède : sans ça il tomberait en pose de repos par défaut,
    -- ce qui est exactement ce qu'on veut pour un PNJ statique.
    pnj:SetValue("narvos_pnj", "armurier", true)

    local zone = Trigger(position, Rotator(), Vector(2.0 * M), TriggerType.Sphere,
        false, Color(1, 1, 0), { "Character" })

    zone:Subscribe("BeginOverlap", function(_, acteur)
        local player = JoueurDe(acteur)
        if (not player) then return end

        local ordre = Narvos.Weapons.ORDRE
        local index = (arme_suivante[player] or 0) % #ordre + 1
        local id = ordre[index]
        local ok, message = DonnerAuSac(player, id, 1)
        if (not ok) then
            Chat.SendMessage(player, "<grey>Remise d'arme refusée : "
                .. SansBalise(tostring(message)) .. "</>")
            return
        end
        arme_suivante[player] = index

        local def = Narvos.Weapons.CATALOGUE[id]
        Chat.SendMessage(player, "<cyan>" .. SansBalise(tostring(message))
            .. "</>  <grey>(" .. tostring(def.categorie)
            .. ") — repasse pour l'arme suivante</>")
    end)
end

-- ── Repères d'échelle ──────────────────────────────────────────────────────────

--- Le « gym » que le skill narvos-level-design décrit comme manquant : des
--- distances CONNUES posées dans le monde, pour juger l'échelle et la lisibilité
--- en vue de dessus au lieu de l'estimer à l'œil.
local function PoserReperesEchelle()
    local base = PresDe(0, -RAYON_ZONES, SOL_Z)

    -- Une colonne à la taille du joueur : la référence humaine que le level
    -- design exige avant de valider une échelle.
    Prop(Vector(base.X, base.Y, SOL_SERVICES + METRIQUES.taille_joueur / 2), Rotator(),
        "nanos-world::SM_Cylinder", CollisionType.NoCollision, false)

    -- Deux jalons aux portées de saut mesurées. La zone ENTRE les deux est celle
    -- que le level design dit de ne jamais placer au-dessus d'un vide mortel :
    -- franchissable en courant, pas en marchant.
    for _, jalon in ipairs({
        { d = METRIQUES.portee_saut_marche, nom = "saut marche" },
        { d = METRIQUES.portee_saut_course, nom = "saut course" },
    }) do
        Prop(Vector(base.X + jalon.d, base.Y, SOL_SERVICES + 25.0), Rotator(),
            "nanos-world::SM_Cube", CollisionType.NoCollision, false)
    end
end

-- ── Chargement ─────────────────────────────────────────────────────────────────

Package.Subscribe("Load", function()
    -- Garde-fou : si `narvos` n'est pas chargé, tout ce fichier échouerait plus
    -- loin sur des erreurs d'indexation illisibles. Mieux vaut le dire ici.
    if (not Narvos or not Narvos.CharacterBuilder) then
        Console.Error("Package 'narvos' absent — vérifier packages_requirements dans Package.toml.")
        return
    end

    -- Les validations existent depuis le portage TS mais n'étaient jamais
    -- appelées : un repli silencieux (rôle sans tenue, zone de loot absente)
    -- passait inaperçu. Les exécuter au chargement est le seul moment où
    -- quelqu'un les lira.
    for _, avertissement in ipairs(Narvos.CharacterBuilder.Validate()) do
        Console.Warn("Classe : " .. avertissement)
    end
    for _, avertissement in ipairs(Narvos.LootLogic.Validate()) do
        Console.Warn("Loot : " .. avertissement)
    end
    for _, zone in ipairs(ZONES) do
        if (not Narvos.LootLogic.ZONE_POOLS[zone.id]) then
            Console.Warn("Zone '" .. zone.id .. "' absente de ZONE_POOLS — repli sur forge.")
        end
    end

    for _, a in ipairs(Narvos.Weapons.Validate()) do
        Console.Warn("Arme : " .. a)
    end

    -- Regroupement des animations en variantes. Fait UNE fois au chargement :
    -- 1 088 noms à décomposer à chaque attaque coûterait cher pour un résultat
    -- qui ne change jamais.
    if (Narvos.AnimNoms and Narvos.AnimNoms.NOMS) then
        Narvos.AnimSets = Narvos.Animations.Grouper(Narvos.AnimNoms.NOMS)
        local r = Narvos.Animations.Resume(Narvos.AnimSets)
        Console.Log(("Animations : %d actions, %d a prises multiples, %d en IP et RM")
            :format(r.actions, r.a_variantes, r.a_deux_modes))
        if (#r.exemples > 0) then
            Console.Log("  ex. " .. table.concat(r.exemples, ", "))
        end
    else
        -- Le catalogue est GÉNÉRÉ : absent, c'est que le cook ou
        -- `narvos-anims-to-lua.mjs` n'ont pas tourné. Le dire plutôt que de
        -- laisser un tirage muet qui rend toujours nil.
        Console.Warn("Catalogue d'animations absent — relancer scripts/narvos-anims-to-lua.mjs --apply")
    end

    -- ── Décors NARVOS ──────────────────────────────────────────────────────
    -- D5 : la Forge reste dans le catalogue mais `ouvert = false`. Son décor
    -- GLB n'est donc plus posé et aucun portail ne mène vers elle. Les services
    -- de jeu vivent désormais autour de l'arrivée d'Akarlys (ANCRE ci-dessus).

    -- Les autres mondes sont en place eux aussi : on les déclare tout de suite,
    -- sinon leurs portails de retour n'existeraient qu'après le premier voyage
    -- — et un joueur arrivé sur Azur n'aurait aucun moyen d'en repartir.
    --
    -- ⚠ CETTE LISTE ÉTAIT ÉCRITE EN DUR : `{ "orbital", "tower", "alien" }`.
    -- Écrite quand il y avait quatre mondes, jamais rouverte quand la capitale
    -- et la forêt sont arrivées le 2026-09-09. Résultat mesuré au premier
    -- lancement, le 2026-09-10 : **7 portails posés sur 10**. Manquaient le
    -- Spatioport d'Akarlys et les deux bouts de la Route de la Sylve, soit
    -- exactement les liaisons dont le monde de DÉPART était l'un des deux
    -- nouveaux.
    --
    -- Rien ne l'a dit. `MondePraticable` n'avait refusé personne (`Portail non
    -- posé` : zéro occurrence), le `Diagnostic` juste au-dessus annonçait les
    -- quatre passages `ouvert`, et aucune erreur Lua. La boucle n'était pas
    -- atteinte, voilà tout — et une journée de travail sur ces deux mondes
    -- n'existait pas en jeu.
    --
    -- C'est la PROPRIÉTÉ qui décide, pas une liste de noms : un monde dont le
    -- décor est déjà en place — sous-niveau chargé par le moteur, ou acteurs
    -- copiés dans la map persistante — n'a plus que ses portails à poser.
    -- `DeclarerCharge` est idempotent (`PoserPortails` sort tout de suite si le
    -- monde a déjà les siens) et refuse aussi un monde ferme.
    for _, m in ipairs(Narvos.Mondes.MONDES) do
        local decor_en_place = (type(m.niveau) == "string" and m.niveau ~= "")
            or m.decor_persistant == true
        local praticable, raison = Narvos.Voyage.MondePraticable(m.id)
        if (decor_en_place and praticable) then
            Narvos.VoyageServeur.DeclarerCharge(m.id)
        elseif (m.ouvert == false) then
            Console.Log(("Monde '%s' retire temporairement : %s"):format(
                tostring(m.label or m.id), tostring(raison)))
        end
    end
    Narvos.VoyageServeur.Diagnostic()

    -- ── Peuplement des mondes : la carte DÉCLARE, le serveur fait exister ─────
    --
    -- `Peuplement.Charger` n'était appelé NULLE PART (mesuré par
    -- appels-check.mjs le 2026-09-08) — voilà pourquoi la map était vide de PNJ.
    --
    -- Les points sont calculés depuis `Mondes.CENTRES`, remesurés par raycast le
    -- 2026-09-08, et JAMAIS recopiés : une coordonnée recopiée diverge toujours
    -- de sa source. Deux mondes seulement :
    --   · `tower` et `alien` : leurs CENTRES sont les sols mesurés au centre de
    --     chaque Landscape (z = 151 834 et 153 406) ;
    --   · `forge` est EXCLUE : son CENTRE est le centre de l'enveloppe du décor
    --     GLB (z = 180 134), pas un sol, et son terrain a été supprimé du niveau
    --     (en-tête de Catalogs/Mondes.lua) — y faire naître une bête la
    --     lâcherait dans le vide ;
    --   · `orbital` est le hub spatial : pas de sol marchable.
    --
    -- Couronne de douze points par monde, à 150 et 260 m du centre, posés 5 m
    -- AU-DESSUS du sol mesuré au centre : la gravité pose la bête
    -- (CharacterSimple naît avec gravity_enabled). ⚠ Le sol d'une dune à 250 m
    -- du centre n'est PAS mesuré : +5 m couvre un terrain plus BAS, pas un
    -- terrain plus haut de plus de 5 m — ce cas attendra un raycast côté Lua.
    -- ⚠ DE VRAIS CORPS depuis le 2026-09-11 (décision de Hanibes). Ces listes
    -- nommaient des Meshy à l'échelle ×100 — gris, géants au diagnostic. Les
    -- personnages Defender sont texturés, sur le squelette nanos (cook du
    -- 2026-09-11, 12 au catalogue) ; leur rôle « ennemi » vient du générateur
    -- (`ROLES_DEFENDER`). venom_stalker reste : c'est la seule créature du lot.
    local PEUPLEMENT_PAR_MONDE = {
        tower = { "sk_murdock", "sk_shadowops", "sk_murdockexecutionerv2", "venom_stalker" },
        alien = { "sk_wraithlunarops", "sk_murdockwasteland", "sk_shadowops", "venom_stalker" },
    }
    local points_peuplement = {}
    -- ⚠ Cette boucle itérait `ipairs({ "tower", "alien" })` — les clés de la
    -- table ci-dessus, recopiées. Ajouter un monde à `PEUPLEMENT_PAR_MONDE`
    -- n'aurait rien peuplé, sans un mot. Même forme que la liste de mondes
    -- déclarés chargés, qui avait coûté trois portails (voir plus haut).
    -- La table EST la source : on itère ses clés.
    --
    -- Triées, parce que `pairs` ne garantit aucun ordre et n'en rend pas le même
    -- d'une VM à l'autre : sans ça, deux démarrages produiraient les 24 points
    -- dans un ordre différent, et un diagnostic cesserait d'être comparable.
    local mondes_peuples = {}
    for monde_id in pairs(PEUPLEMENT_PAR_MONDE) do
        mondes_peuples[#mondes_peuples + 1] = monde_id
    end
    table.sort(mondes_peuples)

    for _, monde_id in ipairs(mondes_peuples) do
        local centre = Narvos.Mondes.CENTRES[monde_id]
        local especes = PEUPLEMENT_PAR_MONDE[monde_id]
        if (centre and especes) then
            for i = 1, 12 do
                local angle = (i - 1) * (2 * math.pi / 12)
                local rayon = ((i % 2 == 0) and 150 or 260) * M
                points_peuplement[#points_peuplement + 1] = {
                    id = monde_id .. "_" .. i,
                    spawnable = especes[((i - 1) % #especes) + 1],
                    x = centre.X + math.cos(angle) * rayon,
                    y = centre.Y + math.sin(angle) * rayon,
                    z = centre.Z + 5 * M,
                    yaw = math.deg(angle + math.pi),
                }
            end
        end
    end

    -- PNJ places a la main puis figes par `/exporter pnj`. Le catalogue garde
    -- des coordonnees LOCALES : on reapplique le decalage du monde au demarrage,
    -- comme l'export l'a retire. Le niveau voyage avec chaque point et sera passe
    -- a l'IA par `Peuplement.Naitre` a chaque reapparition.
    local places = Narvos.PeuplementCatalogue
    if (type(places) == "table" and type(places.LISTE) == "table"
            and #places.LISTE > 0) then
        local monde = Narvos.Mondes.Trouver(places.MONDE)
        local decalage = monde and (Narvos.Mondes.DECALAGES[places.MONDE] or Vector()) or nil
        if (not monde or not decalage) then
            Console.Warn(("Peuplement place : monde inconnu '%s', catalogue ignore")
                :format(tostring(places.MONDE)))
        else
            for _, e in ipairs(places.LISTE) do
                points_peuplement[#points_peuplement + 1] = {
                    id = e.id,
                    spawnable = e.spawnable,
                    x = (tonumber(e.x) or 0) + decalage.X,
                    y = (tonumber(e.y) or 0) + decalage.Y,
                    z = (tonumber(e.z) or 0) + decalage.Z,
                    yaw = e.yaw,
                    rayon = e.rayon,
                    niveau = e.niveau,
                }
            end
            Console.Log(("Peuplement place : %d point(s) relu(s) pour %s")
                :format(#places.LISTE, tostring(places.MONDE)))
        end
    end
    -- Le récepteur compte : c'est `Peuplement.Charger`, pas un autre `Charger`
    -- (Dialogue, Quetes en ont un — le nom seul ne prouve rien).
    local retenus, ecartes_peuplement = Peuplement.Charger(points_peuplement)
    -- `Etat` sert au diagnostic : on le lit ici plutôt que de croire le retour.
    local nb_points, nb_vivants = Peuplement.Etat()
    Console.Log(("Peuplement : %d point(s) declares (%d ecarte(s)), etat = %d point(s), %d vivant(s)")
        :format(retenus, ecartes_peuplement, nb_points, nb_vivants))

    PoserPadsDeClasse()
    PoserArmurier()
    PoserMarchands()
    PoserCoffres()
    -- ⚠ LES ATELIERS NE SPAWNENT PLUS TOUT SEULS (2026-09-19). PoserAteliers()
    -- et PoserEtabliAssemblage() posaient les 4 stations + l'établi en cercle
    -- autour de l'ancrage de spawn ; la demande est de les PLACER À LA MAIN
    -- (menu de props → « Entités de jeu », persistance `recolte_places`). La
    -- relecture des poses manuelles reste active juste en dessous.
    local ateliers_poses = 0
    local etabli_pose = false
    -- Le journal DIT si les vraies stations sont la. Sans ce compteur, des cubes
    -- gris passeraient pour des ateliers pendant des semaines — c est exactement
    -- ce qui s est produit jusqu au 2026-09-12.
    local stations_cuites, stations_total = Narvos.Ateliers.Compte()
    Console.Log(("Ateliers : %d/%d station(s) posee(s) ; %d/%d avec leur vrai mesh ; etabli d'assemblage %s.")
        :format(ateliers_poses, #STATIONS_MONDE, stations_cuites, stations_total,
            etabli_pose and "pose" or "ABSENT"))
    PoserGisements()
    ReposerPosees()

    -- Relecture des définitions procédurales de loot (2026-09-19) : un sac
    -- contient peut-être un `gen_*` tiré avant le redémarrage. Sans cette
    -- relecture, l'itemId resterait sans définition — invisible et inutilisable.
    do
        local ok, donnees = pcall(Package.GetPersistentData)
        if (ok and type(donnees) == "table" and type(donnees["loot_gen_defs"]) == "table") then
            local n = 0
            for id, def in pairs(donnees["loot_gen_defs"]) do
                if (Narvos.Items.ITEM_DB[id] == nil) then
                    Narvos.Items.ITEM_DB[id] = def
                end
                defs_loot_generees[id] = Narvos.Items.ITEM_DB[id]
                n = n + 1
            end
            Console.Log(("[LOOT] %d definition(s) procedurale(s) relue(s) depuis la persistance"):format(n))
        end
    end

    PoserReperesEchelle()

    Console.Log("NARVOS iso : " .. #Narvos.CharacterBuilder.ClassIds() .. " classes, "
        .. #ZONES .. " zones de loot, repères d'échelle posés.")
end)