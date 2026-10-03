-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Commandes.lua — touches des COMMANDES du jeu, par compte.
--
-- Câblage : Narvos.Commandes = Package.Require("Logic/Commandes.lua")
--
-- ── DEUX SYSTÈMES DE TOUCHES, ET POURQUOI ILS RESTENT SÉPARÉS ─────────────────
-- `Raccourcis.lua` associe une TOUCHE LIBRE à une animation : le joueur en pose
-- autant qu'il veut, sur les touches qu'il veut, et le catalogue d'animations
-- grossit sans fin.
-- Ce fichier-ci fait l'inverse : une LISTE FERMÉE d'actions du jeu, chacune avec
-- une touche par défaut, que le joueur peut réassigner. On ne peut ni en ajouter
-- ni en retirer — ce sont les commandes que le code sait exécuter.
--
-- Les mélanger donnerait un écran de réglages où « ouvrir l'inventaire » et
-- « s'asseoir en tailleur » cohabitent dans la même liste de 166 entrées.
--
-- ── L'ARBITRAGE EST ICI, PAS AILLEURS ─────────────────────────────────────────
-- Deux actions sur la même touche, c'est un bug que le joueur ne peut pas
-- diagnostiquer : il appuie, deux choses se produisent, ou une seule au hasard.
-- `Definir` REPREND donc la touche à celui qui l'avait, et le DIT à l'appelant
-- (3ᵉ valeur de retour) pour que l'écran puisse l'afficher. Un vol silencieux
-- serait tout aussi déroutant que le conflit.
--
-- Les animations passent par le même arbitre via `Raccourcis.UtiliserArbitre`.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosCommandes
local Commandes = {}

local db = nil

--- Injecte la base. Appelé par Server/Index.lua après Comptes.Ouvrir.
function Commandes.UtiliserBase(instance)
    db = instance
end

function Commandes.Prete()
    return db ~= nil
end

-- ── Le catalogue fermé ────────────────────────────────────────────────────────

--- Actions du jeu, dans l'ordre d'affichage de l'écran de réglages.
---
--- ⚠ `defaut` doit passer `ToucheValide`. Une valeur fantaisiste ne lèverait
--- pas : `Input.Register` accepterait la chaîne et créerait une liaison morte
--- que le joueur ne pourrait ni utiliser ni comprendre.
---
--- ⚠ Les touches de DÉPLACEMENT (W A S D) sont absentes ET réservées : nanos
--- les gère lui-même, et les réassigner ici ne les libérerait pas.
Commandes.ACTIONS = {
    -- Menus
    { id = "menu_emotes",     categorie = "Menus",        defaut = "B",   label = "Animations et emotes" },
    { id = "menu_props",      categorie = "Menus",        defaut = "P",   label = "Props — poser du decor" },
    { id = "menu_spawn",      categorie = "Menus",        defaut = "N",   label = "PNJ et monstres" },
    -- Menu de TEST : donne n'importe quelle arme du pack de base. Ferme par la
    -- meme garde que /spawn (commandes_dev ou administrateur). A retirer quand
    -- les armes viendront du butin et des marchands.
    { id = "menu_armes",      categorie = "Menus",        defaut = "O",   label = "Armes (test)" },
    { id = "menu_inventaire", categorie = "Menus",        defaut = "I",   label = "Inventaire" },
    { id = "menu_vehicules",  categorie = "Menus",        defaut = "Z",   label = "Vehicules" },
    { id = "menu_vaisseaux",  categorie = "Menus",        defaut = "U",   label = "Vaisseaux" },
    -- ⚠ ETAIT « G » jusqu'au 2026-09-13 : Hanibes a demande G et K nommement
    -- pour les coups de pied (categorie Combat, plus bas). AUCUNE lettre n'etait
    -- libre (relevé sur cette liste : les 22 autres sont prises, W A S D
    -- reservees, E native) : F8 rejoint les menus sur touche de fonction (F6
    -- teleports, F7 telephone). Un compte qui avait assigne G EXPLICITEMENT garde
    -- sa ligne : le dedoublonnage de `ParCompte` retire alors le defaut du coup.
    { id = "menu_garde_robe", categorie = "Menus",        defaut = "F8",  label = "Apparence et vetements (inventaire)" },
    { id = "menu_personnage", categorie = "Menus",        defaut = "F10", label = "Fiche de personnage" },
    -- Le MEME panneau, ouvert sur l'onglet Competences (pouvoirs, talents,
    -- niveau). « K » etait l'usage des jeux ; il sert au coup de pied gauche
    -- depuis la demande du 2026-09-13 20h40, d'ou F5 — modifiable comme le reste.
    { id = "menu_competences", categorie = "Menus",       defaut = "F5",  label = "Competences, talents et niveau" },
    -- Le client liait deja `ACTIONS.menu_radar` ; sans cette entree, aucune
    -- touche ne l'atteignait (audit du 2026-09-11).
    { id = "menu_radar",      categorie = "Menus",        defaut = "H",   label = "Radar (mini-carte)" },
    -- L'ancien panneau MetaHuman est retiré : apparence dans I/F8. Sa touche U,
    -- libre dans le répartiteur, ouvre maintenant les vaisseaux (15/09/2026).

    -- Caméra
    -- ⚠ UNE TOUCHE DE FONCTION, ET PAS `V` NI `KeyV`. Deux raisons, mesurees le
    -- 2026-09-08 et toujours valables :
    --
    --  1. `V` est DEJA pris par `melee_ranger` (voir plus bas). Le harnais
    --     `commandes` a un test d unicite des defauts : il l a attrape.
    --  2. `KeyV` est un CODE NAVIGATEUR. `TOUCHES_VALIDES` n accepte que des
    --     NOMS MOTEUR — une lettre seule, un chiffre, F1-F12, TAB. "KeyV" y
    --     etait refuse, donc le defaut lui-meme etait inassignable.
    --
    -- Le TS met `KeyV` parce que F1/F3 sont capturees PAR LE NAVIGATEUR ; le
    -- client nanos est NATIF, cette contrainte ne s applique pas ici. Les deux
    -- runtimes divergent POUR UNE RAISON : ce n est pas une valeur a aligner.
    --
    -- ⚠ ETAIT F3 jusqu au 2026-09-10, deplace sur F4 : le patron a demande F3
    -- nommement pour le mode edition. Ce paragraphe disait « le Lua garde F3 »
    -- et serait devenu faux en silence — le meme defaut que l en-tete de
    -- `Modular.lua`, ou une prose figee affirmait une verification que le
    -- fichier contredisait 400 lignes plus haut.
    { id = "vue",             categorie = "Camera",       defaut = "F4",  label = "Changer de vue" },
    -- Pouvoirs : quatre emplacements, garnis par la classe du personnage.
    { id = "sort_1",          categorie = "Pouvoirs",     defaut = "1",   label = "Pouvoir 1" },
    { id = "sort_2",          categorie = "Pouvoirs",     defaut = "2",   label = "Pouvoir 2" },
    { id = "sort_3",          categorie = "Pouvoirs",     defaut = "3",   label = "Pouvoir 3" },
    { id = "sort_4",          categorie = "Pouvoirs",     defaut = "4",   label = "Pouvoir 4" },

    -- Equipement.
    -- ⚠ TAB EST PASSE de `equipement_retirer` a `roue_objets` le 2026-09-08 :
    -- la roue est le geste frequent (changer d'arme, boire une potion), ranger
    -- est l'exception. `equipement_retirer` herite de « T », libre. Un compte
    -- qui avait EXPLICITEMENT assigne TAB a `equipement_retirer` garde sa ligne
    -- en base : elle gagne contre le defaut de la roue, qui s'efface alors pour
    -- lui — voir le dedoublonnage dans `ParCompte`.
    { id = "roue_objets",        categorie = "Equipement", defaut = "TAB", label = "Roue des objets" },
    { id = "equipement_retirer", categorie = "Equipement", defaut = "T",   label = "Ranger ce qu'on tient" },

    { id = "prop_poser",      categorie = "Construction", defaut = "F",   label = "Poser le prop tenu" },
    { id = "prop_pivoter",    categorie = "Construction", defaut = "R",   label = "Pivoter le prop tenu" },
    { id = "prop_retirer",    categorie = "Construction", defaut = "X",   label = "Retirer le dernier pose" },
    -- Gizmo : ajuster un prop DEJA pose, sur les trois axes. Distinct de
    -- `prop_pivoter`, qui oriente le prop qu'on tient AVANT de le poser.
    { id = "gizmo_prise",     categorie = "Construction", defaut = "M",   label = "Prendre / lacher au gizmo" },
    -- ⚠ ETAIT « K » jusqu'au 2026-09-13 : K est le second coup de pied (meme
    -- demande, meme absence de lettre libre). F9, outil d'auteur, rare en jeu.
    { id = "gizmo_precedent", categorie = "Construction", defaut = "F9",  label = "Objet precedent" },
    { id = "gizmo_suivant",   categorie = "Construction", defaut = "L",   label = "Objet suivant" },
    { id = "gizmo_mode",      categorie = "Construction", defaut = "J",   label = "Deplacer / tourner / echelle" },
    -- ⚠ F3 ETAIT « Changer de vue », deplace sur F4 le 2026-09-10. Le patron a
    -- demande F3 nommement pour le mode edition, et deux actions sur une meme
    -- touche ne se partagent pas : la seconde ne se declencherait jamais, sans
    -- le moindre message. F4 etait libre (seuls F3 et F10 etaient pris).
    { id = "edition_bascule", categorie = "Construction", defaut = "F3",  label = "Mode edition (souris libre)" },

    -- Corps-a-corps. `contrer` est la seule commande du jeu dont le DELAI compte :
    -- la fenetre est de 320 ms, soit une dizaine de trames. Elle doit rester sur
    -- une touche que la main tient deja, jamais dans un menu.
    { id = "melee_contrer",   categorie = "Combat",       defaut = "C",   label = "Contrer" },
    { id = "melee_ranger",    categorie = "Combat",       defaut = "V",   label = "Ranger l arme de melee" },
    -- Mains nues (Logic/Frappes.lua, demande du 2026-09-13). Les boutons de la
    -- souris sont assignables comme les touches (`TOUCHES_VALIDES`). ⚠ Ces
    -- gestes ne partent que MAINS VIDES : arme a feu en main, le clic gauche tire
    -- et le clic droit vise (liaisons natives de nanos, intactes) ; arme de
    -- melee en main, le clic gauche frappe avec elle (Server/Combat.lua).
    { id = "frappe_principale", categorie = "Combat",     defaut = "CLIC_GAUCHE", label = "Coup de poing (main droite)" },
    { id = "frappe_secondaire", categorie = "Combat",     defaut = "CLIC_DROIT",  label = "Coup de poing (main gauche)" },
    { id = "coup_pied_droit",   categorie = "Combat",     defaut = "G",           label = "Coup de pied droit" },
    { id = "coup_pied_gauche",  categorie = "Combat",     defaut = "K",           label = "Coup de pied gauche" },
    -- L'esquive arrive avec le combat rapproche : bouton lateral de la souris
    -- (SOURIS_4), standard des jeux d'action. Les lettres sont toutes prises
    -- (releve du 2026-09-20 : 22 lettres, W A S D reservees, E natif).
    { id = "esquive",           categorie = "Combat",     defaut = "SOURIS_4",    label = "Esquive / dash" },
    -- L'escalade partage le combat rapproche : l'autre bouton lateral de la
    -- souris (SOURIS_5). Déclenchée près d'un obstacle, sinon rien ne se passe.
    { id = "escalade",          categorie = "Combat",     defaut = "SOURIS_5",    label = "Escalade / franchir" },

    -- Points de téléportation (Server/Teleports.lua), ajoutés le 2026-09-11.
    -- ÉDITION : « F6 », touche de fonction LIBRE (seules F3, F4 et F10 sont
    -- prises), rangée avec les outils d'auteur. La garde est côté SERVEUR : un
    -- joueur sans droit ouvre le panneau et n'y lit que le verrou.
    { id = "menu_teleports",  categorie = "Menus",        defaut = "F6",  label = "Points de teleportation (edition)" },
    -- INTERAGIR : parler au marchand proche, sinon passer le point de TP proche.
    -- « Y », LIBRE (aucun défaut de cette liste). PAS « E » : c'est l'interaction
    -- NATIVE de nanos (ramasser, monter en véhicule) ; près d'une voiture, les
    -- deux se déclencheraient. (S'appelait `tp_utiliser` quelques heures le
    -- 2026-09-11, avant d'englober les marchands : aucune liaison n'était en base.)
    { id = "interagir",       categorie = "Monde",        defaut = "Y",   label = "Interagir (parler, passer un point)" },
    -- MENOTTER : une touche, trois gestes selon l'etat (Logic/Menottes.ActionPour) —
    -- menotter une cible libre, liberer une cible menottee, s'evader quand on
    -- l'est soi-meme. « Q », LIBRE dans cette liste ; PAS « E » (interaction
    -- native, cf. ci-dessus). ⚠ Aucune preuve qu'aucune liaison NATIVE de nanos
    -- n'occupe Q : a verifier au premier essai, et a reassigner sinon.
    { id = "menotter",        categorie = "Monde",        defaut = "Q",   label = "Menotter / liberer (evasion si menotte)" },
    -- TELEPHONE (Server/Communications.lua, 2026-09-13) : carte, messages,
    -- contacts. « F7 », touche de fonction LIBRE dans cette liste (F3, F4, F6,
    -- F10 prises). Le serveur refuse sans smartphone dans le sac. ⚠ Aucune preuve
    -- qu'aucune liaison NATIVE de nanos n'occupe F7.
    { id = "menu_telephone",  categorie = "Menus",        defaut = "F7",  label = "Telephone (carte, messages, contacts)" },

    -- FOUILLER (2026-09-19) : ouvrir le butin d'un cadavre proche. « F1 »,
    -- touche de fonction LIBRE (F3-F10 prises). PAS « E » : interaction native
    -- de nanos (ramasser, monter). PAS une lettre de combat : les plus proches
    -- de la main gauche sont toutes prises (relevé de cette liste).
    { id = "fouiller",       categorie = "Monde",        defaut = "F1",  label = "Fouiller un cadavre" },
    -- AUTO-MARCHE (2026-09-19) : bascule la marche continue. L'état vit dans
    -- Paramètres → Jouabilité (auto_marche) ; cette commande en est le
    -- raccourci. « F2 », touche de fonction LIBRE (F1 fouille, F3-F10 prises,
    -- relevé de cette liste) : toutes les lettres proches de la main gauche
    -- sont prises (W A S D réservées, E native, B émotes).
    { id = "auto_marche",    categorie = "Deplacement",  defaut = "F2",  label = "Auto-marche (basculer)" },
}

--- Catégories, dans l'ordre d'apparition dans ACTIONS.
--- Calculée plutôt qu'écrite : une catégorie oubliée ici ferait disparaître ses
--- actions de l'écran sans qu'aucun test ne le voie.
Commandes.CATEGORIES = (function()
    local vues, sortie = {}, {}
    for _, a in ipairs(Commandes.ACTIONS) do
        if (not vues[a.categorie]) then
            vues[a.categorie] = true
            sortie[#sortie + 1] = a.categorie
        end
    end
    return sortie
end)()

local par_id = {}
for _, a in ipairs(Commandes.ACTIONS) do par_id[a.id] = a end

--- Action par identifiant, ou nil.
---@param action_id any
---@return table|nil
function Commandes.Trouver(action_id)
    if (type(action_id) ~= "string") then return nil end
    return par_id[action_id]
end

-- ── Validation ────────────────────────────────────────────────────────────────

--- Touches acceptées, en motifs Lua. Même liste blanche que `Raccourcis.lua`,
--- et pour la même raison : `Input.Register` avale n'importe quelle chaîne, donc
--- seul ce qui est PROUVÉ fonctionner en jeu entre ici.
local TOUCHES_VALIDES = {
    "^[A-Z]$",
    "^[0-9]$",
    "^F[1-9]$", "^F1[0-2]$",
    -- ⚠ Stockée en MAJUSCULES parce que `Normaliser` majuscule tout. Le moteur,
    -- lui, veut « Tab » : la conversion se fait dans `NOM_MOTEUR` côté client,
    -- au SEUL point d'appel d'`Input.Register` — comme pour les chiffres, qui
    -- s'affichent « 1 » et s'enregistrent « One ».
    "^TAB$",
    -- Boutons de la souris (2026-09-13, coups de poing au clic). Noms AFFICHES,
    -- en majuscules comme le reste ; le client les traduit en noms moteur
    -- (`LeftMouseButton`…, input.mdx:178-182) dans `NOM_MOTEUR`, au seul point
    -- d'appel d'`Input.Register`. La molette n'y est PAS : ses noms documentes
    -- sont refuses par le client installe (Client/Index.lua, NarvosZoomIn).
    "^CLIC_GAUCHE$", "^CLIC_DROIT$", "^CLIC_MILIEU$", "^SOURIS_4$", "^SOURIS_5$",
    -- Pavé numérique (2026-09-19). Noms AFFICHÉS « Num1 »… ; le client les
    -- mappe en noms moteur (`NumPadOne`…, input.mdx:161-171) dans `NOM_MOTEUR`,
    -- même discipline que les chiffres. Le pavé est DISTINCT des chiffres du
    -- rang supérieur, comme l'écrit la doc (input.mdx:116-125 vs 161-171).
    "^NUM[0-9]$", "^NUM%+$", "^NUM%-$", "^NUM%*$", "^NUM/$", "^NUM%.$",
    -- Directionnelles (input.mdx:145-148), affichées en français.
    "^HAUT$", "^BAS$", "^GAUCHE$", "^DROITE$",
    -- Touches spéciales (input.mdx:131-154), affichées en français, mappées
    -- côté client : SpaceBar, Enter, Delete, Insert, Home, End, PageUp, PageDown.
    "^ESPACE$", "^ENTREE$", "^SUPPR$", "^INSERT$", "^DEBUT$", "^FIN$", "^PGPREC$", "^PGSUIV$",
}

--- Touches que le jeu garde pour lui. Les réassigner ne les libérerait pas —
--- nanos gère le déplacement en amont du script — et le joueur perdrait
--- simplement l'usage de la touche.
local RESERVEES = { W = true, A = true, S = true, D = true }

---@param touche any
---@return string
function Commandes.Normaliser(touche)
    return tostring(touche or ""):upper()
end

--- La touche est-elle assignable à une commande ?
--- `reservees` : ensemble optionnel de touches que le CLIENT rapporte comme
--- liées aux déplacements NATIFS de nanos sur SA disposition (`Input.GetGameKeyBindings`) :
--- sur un AZERTY français, ce sont Z, Q, S, D — et non W, A, S, D. Sans cette
--- liste, un joueur AZERTY pourrait réassigner Z et perdre sa marche avant.
---@param touche any
---@param reservees table|nil  { [TOUCHE] = true }
---@return boolean, string|nil
function Commandes.ToucheValide(touche, reservees)
    if (type(touche) ~= "string" or touche == "") then
        return false, "Touche requise"
    end

    local t = touche:upper()

    local reconnue = false
    for _, motif in ipairs(TOUCHES_VALIDES) do
        if (t:match(motif)) then reconnue = true break end
    end
    if (not reconnue) then
        return false, "Touche non reconnue : lettre, chiffre, F1-F12, Tab, pavé numérique, flèches, Espace, Entrée ou bouton de souris"
    end

    if (RESERVEES[t]) then
        return false, "La touche " .. t .. " sert au deplacement"
    end

    if (type(reservees) == "table" and reservees[t]) then
        return false, "La touche " .. t .. " sert au deplacement sur votre clavier"
    end

    return true, nil
end

-- ── Lecture ───────────────────────────────────────────────────────────────────

--- Assignations par défaut : { action_id = TOUCHE }.
---@return table
function Commandes.Defauts()
    local sortie = {}
    for _, a in ipairs(Commandes.ACTIONS) do
        sortie[a.id] = a.defaut
    end
    return sortie
end

--- Assignations d'un compte : les défauts, écrasés par ce qui est en base.
---
--- Une ligne pointant vers une action DISPARUE du catalogue est ignorée : c'est
--- ce qui permet de retirer une commande du jeu sans casser les comptes qui
--- l'avaient réassignée.
---@param compte_id integer|nil
---@return table
function Commandes.ParCompte(compte_id)
    local sortie = Commandes.Defauts()
    if (not db or compte_id == nil) then return sortie end

    -- Les touches posees EXPLICITEMENT en base, pour l'arbitrage ci-dessous.
    local explicites = {}
    for _, l in ipairs(db:Select(
        "SELECT action_id, touche FROM commandes WHERE compte_id = :0", compte_id) or {}) do
        if (par_id[l.action_id]) then
            sortie[l.action_id] = l.touche
            if (l.touche ~= "") then explicites[l.touche] = l.action_id end
        end
    end

    -- ⚠ DEDOUBLANNAGE base > defaut. Quand une action NOUVELLE herite par
    -- defaut d'une touche qu'un compte avait explicitement assignee ailleurs
    -- (TAB, passee de `equipement_retirer` a `roue_objets` le 2026-09-08), la
    -- ligne EN BASE gagne et le defaut s'efface — l'action reste reassignable
    -- depuis l'ecran des commandes. Sans ca, deux actions repondraient a la
    -- meme touche et le repartiteur client n'en garderait qu'une, au hasard
    -- de l'ordre de la liste.
    for _, a in ipairs(Commandes.ACTIONS) do
        local t = sortie[a.id]
        if (t ~= "" and explicites[t] and explicites[t] ~= a.id) then
            sortie[a.id] = ""
        end
    end
    return sortie
end

--- Quelle action occupe cette touche, pour ce compte ? nil si aucune.
--- C'est l'arbitre : `Raccourcis` l'appelle avant d'accepter une animation.
---@param compte_id integer|nil
---@param touche any
---@return string|nil
function Commandes.ToucheOccupee(compte_id, touche)
    local t = Commandes.Normaliser(touche)
    if (t == "") then return nil end

    for action_id, assignee in pairs(Commandes.ParCompte(compte_id)) do
        if (assignee == t) then return action_id end
    end
    return nil
end

--- Vue prête pour l'écran de réglages : liste ordonnée, avec la touche courante
--- et le défaut. Le client n'a alors ni à fusionner ni à trier.
---@param compte_id integer|nil
---@return table
function Commandes.Vue(compte_id)
    local assignees = Commandes.ParCompte(compte_id)
    local sortie = {}
    for _, a in ipairs(Commandes.ACTIONS) do
        sortie[#sortie + 1] = {
            id = a.id,
            label = a.label,
            categorie = a.categorie,
            touche = assignees[a.id],
            defaut = a.defaut,
            modifiee = assignees[a.id] ~= a.defaut,
        }
    end
    return sortie
end

-- ── Écriture ──────────────────────────────────────────────────────────────────

--- Assigne une touche à une action.
---
--- Si la touche appartenait à une AUTRE action, elle lui est reprise et cette
--- action se retrouve sans touche (chaîne vide en base). La 3ᵉ valeur de retour
--- dit laquelle, pour que l'écran l'annonce au lieu de laisser le joueur
--- découvrir la perte plus tard.
---@param compte_id integer
---@param action_id string
---@param touche string
---@param reservees table|nil  touches de déplacement rapportées par le client
---@return boolean ok
---@return string|nil raison
---@return string|nil action_liberee
function Commandes.Definir(compte_id, action_id, touche, reservees)
    if (not db) then return false, "Base indisponible" end
    if (compte_id == nil) then return false, "Compte inconnu" end

    if (not Commandes.Trouver(action_id)) then
        return false, "Commande inconnue : " .. tostring(action_id)
    end

    local ok, raison = Commandes.ToucheValide(touche, reservees)
    if (not ok) then return false, raison end

    local t = Commandes.Normaliser(touche)

    -- Qui détient la touche aujourd'hui ? Calculé AVANT l'écriture : après,
    -- la réponse serait toujours `action_id`.
    local detentrice = Commandes.ToucheOccupee(compte_id, t)
    if (detentrice == action_id) then
        return true, nil, nil -- déjà assignée : rien à faire, et surtout pas la libérer
    end

    if (detentrice) then
        -- Chaîne vide, pas DELETE : supprimer la ligne ferait réapparaître le
        -- DÉFAUT de l'action dépouillée — donc potentiellement le même conflit
        -- au prochain chargement. Une commande sans touche doit le rester.
        db:Execute(
            "INSERT OR REPLACE INTO commandes (compte_id, action_id, touche) VALUES (:0, :1, :2)",
            compte_id, detentrice, "")
    end

    db:Execute(
        "INSERT OR REPLACE INTO commandes (compte_id, action_id, touche) VALUES (:0, :1, :2)",
        compte_id, action_id, t)

    return true, nil, detentrice
end

--- Rend une action à sa touche par défaut.
---@param compte_id integer
---@param action_id string
---@return boolean
function Commandes.Reinitialiser(compte_id, action_id)
    if (not db or compte_id == nil) then return false end
    if (not Commandes.Trouver(action_id)) then return false end

    -- ⚠ `compte_id` dans le WHERE : `action_id` vient du client, et sans lui un
    -- joueur réinitialiserait les commandes d'un autre.
    db:Execute("DELETE FROM commandes WHERE compte_id = :0 AND action_id = :1",
        compte_id, action_id)
    return true
end

--- Rend TOUTES les commandes à leurs défauts.
---@param compte_id integer
---@return boolean
function Commandes.ReinitialiserTout(compte_id)
    if (not db or compte_id == nil) then return false end
    db:Execute("DELETE FROM commandes WHERE compte_id = :0", compte_id)
    return true
end

return Commandes
