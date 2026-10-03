-- ═══════════════════════════════════════════════════════════════════════════════
-- Logic/Assemblage.lua — le craft par ASSEMBLAGE : le joueur pose réellement
-- les pièces une à une (véhicules, armes, objets), là où `Logic/Craft.lua` fait
-- recette → sortie d'un bloc.
--
-- Câblage : Narvos.Assemblage = Package.Require("Logic/Assemblage.lua") dans
-- Shared/Index.lua, APRÈS Narvos.Inventory (capturé au chargement, avec repli).
--
-- ── PUR ET PROUVABLE ──────────────────────────────────────────────────────────
-- Aucun appel à l'API nanos. La grille ENTRE EN PARAMÈTRE ; chaque mutation
-- rend une NOUVELLE grille ou nil + raison, jamais de mutation en place — même
-- discipline que Craft et Boutique. AUCUN identifiant d'objet ni d'asset n'est
-- écrit en dur ici : tout vient du plan passé en paramètre. Le catalogue de
-- plans (chantier B) et la WebUI (chantier C) consomment CE module comme
-- contrat ; les plans seront générés, et `ValiderPlan` est le garde sur lequel
-- le générateur s'appuie.
--
-- ── UN SEUL MODÈLE, PARAMÉTRÉ PAR LE PLAN ─────────────────────────────────────
-- Il n'y a PAS une logique pour les véhicules et une autre pour les armes. Un
-- plan décrit des emplacements (slots) ; le module ne connaît que des slots :
--
--   plan = {
--     id        = "…",                          -- chaîne non vide, sans « ;|:,= »
--     label     = "…",                          -- optionnel (affichage)
--     resultat  = { item_id = "…", quantite = 1 },   -- quantite optionnelle (1)
--     familles  = { nom = { item_id, … } },     -- optionnel
--     emplacements = {                          -- LISTE ordonnée, ≥ 1, SANS TROU
--       { id = "…",                             -- unique dans le plan, non vide
--         label = "…",                          -- optionnel (défaut : id)
--         obligatoire = true|false,             -- EXPLICITE, jamais nil
--         quantite = 4,                         -- optionnel, entier ≥ 1 (défaut 1)
--         filtre = {                            -- REQUIS, au moins UN critère
--           items      = { item_id, … },        -- liste blanche explicite
--           famille    = "nom",                 -- résolu via plan.familles[nom]
--           types      = { "material", … },     -- sur def.type
--           categories = { … },                 -- sur def.category
--           raretes    = { … },                 -- sur def.rarity
--         } },
--       …
--     },
--   }
-- Tous les critères présents doivent passer (ET). Le refus nomme le PREMIER
-- critère fautif : « pièce non prévue… », « mauvaise famille… », « mauvais
-- type… », « mauvaise catégorie… », « mauvaise rareté… », « emplacement
-- complet… », « emplacement inconnu… », « objet inconnu du catalogue… ».
--
-- ── ⚠ RÉPONSE NOIRE SUR BLANC Nº 1 : L'ABANDON REND TOUT ─────────────────────
-- Les pièces posées REVIENNENT au joueur, intégralement, ou pas du tout.
-- `Abandonner` SIMULE la restitution de TOUTES les pièces posées sur la grille
-- AVANT de fermer quoi que ce soit ; si une seule ne rentre pas, l'abandon est
-- REFUSÉ (« pas de place pour rendre les pièces ») et la session reste OUVERTE
-- — le joueur peut vider son sac et revenir. Il n'existe aucun chemin où une
-- pièce posée disparaît : c'est LA question qui fait perdre l'inventaire d'un
-- joueur, et elle est tranchée ici, pas au hasard d'un appelant.
--
-- ── ⚠ RÉPONSE NOIRE SUR BLANC Nº 2 : L'ASSEMBLAGE EN COURS EST PERSISTÉ ──────
-- PERSISTÉ, pas perdu. La pose CONSOMME réellement la pièce (retrait UID de la
-- grille, ci-dessous) : une session en mémoire seule, perdue à la déconnexion
-- ou au redémarrage, serait des pièces mangées — exactement le défaut de la
-- réponse nº 1. Chaque mutation réécrit donc la ligne du joueur dans la table
-- `assemblages` (créée dans Comptes.Ouvrir, connexion injectée par
-- `UtiliserBase`, même discipline qu'Agriculture ; le WHERE proprietaire n'est
-- jamais décoratif). Au retour, l'exécutant serveur relit le plan dans le
-- catalogue (chantier B) et appelle `Reprendre` : les pièces qui ne trouvent
-- plus leur emplacement (plan retouché entre-temps) sont rendues NOMMÉMENT dans
-- `a_rendre` pour restitution. Sans base injectée, `Ouvrir` REFUSE — une
-- session non persistée est une perte de pièces en attente, pas un mode dégradé.
--
-- ── LE MÊME MÉCANISME QUE Craft.Consommer ─────────────────────────────────────
-- `Inventory.RemoveItemFromGrid` prend un UID, pas un item_id (en-tête de
-- Craft.lua) : `Poser` planifie les (uid, prise) EN LECTURE SEULE — la pile
-- existe, la pièce est acceptée, les quantités suffisent — PUIS applique le
-- retrait. `Retirer` applique la garde inverse, « la place avant la
-- consommation » : il SIMULE l'ajout à la grille avant de sortir la pièce de
-- l'emplacement ; sans place, la pièce reste posée. `Finaliser` de même :
-- complétude obligatoire d'abord, place du résultat SIMULÉE ensuite, et
-- seulement alors la session est détruite — les pièces posées ne sont
-- « détruites » (absorbées dans le résultat) que lorsque la livraison est
-- certaine. Un échec laisse session et grille STRICTEMENT intactes.
--
-- ── ⚠ UN EMPLACEMENT VIDE N'EST PAS nil ───────────────────────────────────────
-- En Lua un champ à nil DISPARAÎT de la table : « vidé » deviendrait
-- indistinguable de « jamais existé », et `pairs` ne le verrait pas. La
-- session itère donc une LISTE de slots (construite dans l'ordre du plan) et
-- chaque slot une LISTE de pièces ; jamais `#` ni `pairs` sur une table à
-- trous. `ValiderPlan` refuse même un plan dont la liste d'emplacements a un
-- trou — c'est le piège exact que le générateur (chantier B) ne doit pas
-- pouvoir produire en silence.
-- ═══════════════════════════════════════════════════════════════════════════════

local Assemblage = {}

local function requis(nom, fichier)
    return (Narvos and Narvos[nom]) or Package.Require(fichier)
end
local Inventory = requis("Inventory", "Logic/Inventory.lua")

-- ── État ──────────────────────────────────────────────────────────────────────
-- Tables indexées par joueur EN TÊTE (règle §3) : une session par propriétaire
-- (l'identifiant de personnage). On n'itère JAMAIS cette table — accès par clé
-- uniquement ; l'ordre de `pairs` n'a aucun sens pour des sessions.
local sessions = {}

-- Base injectée par l'exécutant serveur (Comptes.Base()), jamais require() ici.
local db = nil

-- ── Utilitaires internes ──────────────────────────────────────────────────────

--- `valeur` est-elle dans la LISTE ? Balayage linéaire — les filtres sont
--- courts et l'appartenance doit rester lisible dans les motifs de refus.
---@param liste table|nil
---@param valeur any
---@return boolean
local function dans_liste(liste, valeur)
    if (type(liste) ~= "table") then return false end
    for _, v in ipairs(liste) do
        if (v == valeur) then return true end
    end
    return false
end

--- Un identifiant qui contiendrait un séparateur du format de persistance
--- casserait le décodage EN SILENCE. On le refuse plutôt que de tronquer —
--- même discipline que l'encodeur d'inventaire de Roster.
---@param v any
---@return string|nil
local function identifiant_propre(v)
    if (type(v) ~= "string" or v == "") then return nil end
    if (v:find("[;|:,=]")) then return nil end
    return v
end

--- Le slot d'id `slot_id` dans la session, ou nil. Itère la LISTE des slots :
--- un slot vide (aucune pièce) existe quand même — c'est tout le point.
---@param session table
---@param slot_id any
---@return table|nil
local function trouver_slot(session, slot_id)
    if (type(slot_id) ~= "string") then return nil end
    for _, slot in ipairs(session.slots) do
        if (slot.id == slot_id) then return slot end
    end
    return nil
end

--- Pose `q` unités de `item_id` dans le slot : fusionne avec l'entrée existante
--- ou AJOUTE en fin de liste. La liste reste dense par construction.
---@param slot table
---@param item_id string
---@param q integer
local function ajouter_piece(slot, item_id, q)
    for _, p in ipairs(slot.pieces) do
        if (p.item_id == item_id) then
            p.quantite = p.quantite + q
            slot.pose = slot.pose + q
            return
        end
    end
    slot.pieces[#slot.pieces + 1] = { item_id = item_id, quantite = q }
    slot.pose = slot.pose + q
end

--- Retire `q` unités de `item_id` du slot. L'entrée tombée à 0 est SUPPRIMÉE
--- par table.remove : la liste reste dense, sans trou. L'appelant a déjà
--- vérifié la suffisance.
---@param slot table
---@param item_id string
---@param q integer
local function retirer_piece(slot, item_id, q)
    for index, p in ipairs(slot.pieces) do
        if (p.item_id == item_id) then
            if (p.quantite <= q) then
                table.remove(slot.pieces, index)
                slot.pose = slot.pose - p.quantite
            else
                p.quantite = p.quantite - q
                slot.pose = slot.pose - q
            end
            return
        end
    end
end

--- La pièce `item_id` passe-t-elle le FILTRE du slot ? Rend true, ou false +
--- le motif NOMMÉ (premier critère fautif). Ne regarde ni l'occupation ni la
--- session : c'est le test de CONFORMITÉ, partagé par `Accepte` (qui ajoute
--- les gardes d'occupation) et `Reprendre` (qui revalide des pièces posées).
---@param plan table
---@param slot table
---@param item_id any
---@return boolean ok
---@return string|nil raison
local function conforme_filtre(plan, slot, item_id)
    if (type(item_id) ~= "string" or item_id == "") then
        return false, "pièce invalide"
    end
    local def = Inventory.GetItemDef(item_id)
    if (def == nil) then
        return false, "objet inconnu du catalogue : " .. item_id
    end
    local f = slot.filtre

    if (f.items ~= nil and not dans_liste(f.items, item_id)) then
        return false, "pièce non prévue pour l'emplacement « " .. slot.id .. " »"
    end
    if (f.famille ~= nil) then
        local membres = (type(plan.familles) == "table") and plan.familles[f.famille] or nil
        if (not dans_liste(membres, item_id)) then
            return false, "mauvaise famille : « " .. f.famille .. " » attendue pour « "
                .. slot.id .. " »"
        end
    end
    if (f.types ~= nil and not dans_liste(f.types, def.type)) then
        return false, "mauvais type : « " .. tostring(def.type) .. " » au lieu de « "
            .. table.concat(f.types, " », « ") .. " »"
    end
    if (f.categories ~= nil and not dans_liste(f.categories, def.category)) then
        return false, "mauvaise catégorie : « " .. tostring(def.category) .. " » au lieu de « "
            .. table.concat(f.categories, " », « ") .. " »"
    end
    if (f.raretes ~= nil and not dans_liste(f.raretes, def.rarity)) then
        return false, "mauvaise rareté : « " .. tostring(def.rarity) .. " » au lieu de « "
            .. table.concat(f.raretes, " », « ") .. " »"
    end
    return true, nil
end

--- Construit la session : la LISTE des slots, dans l'ordre du plan, chacun
--- avec sa liste de pièces (vide) et son compteur posé. Le plan doit avoir
--- été validé AVANT — cette fonction ne devine rien.
---@param joueur_id string
---@param plan table
---@return table
local function nouvelle_session(joueur_id, plan)
    local slots = {}
    for index, e in ipairs(plan.emplacements) do
        slots[index] = {
            id = e.id,
            label = e.label or e.id,
            obligatoire = e.obligatoire,
            quantite = e.quantite or 1,
            filtre = e.filtre,
            pieces = {},
            pose = 0,
        }
    end
    return { proprietaire = joueur_id, plan = plan, slots = slots }
end

--- Les slots OBLIGATOIRES incomplets, NOMMÉS, dans l'ordre du plan.
---@param session table
---@return table Liste de { id, label, requis, pose, manque } — vide si complet
local function liste_manquants(session)
    local manquants = {}
    for _, slot in ipairs(session.slots) do
        if (slot.obligatoire and slot.pose < slot.quantite) then
            manquants[#manquants + 1] = {
                id = slot.id,
                label = slot.label,
                requis = slot.quantite,
                pose = slot.pose,
                manque = slot.quantite - slot.pose,
            }
        end
    end
    return manquants
end

-- ── Persistance (table `assemblages`, format texte propre — pas de JSON pur) ──
--
-- Format : `plan_id ; slot=item:q,item:q | slot=…`. Trois séparateurs choisis
-- pour ne jamais apparaître dans un identifiant — `identifiant_propre` le
-- GARANTIT à la validation du plan et à l'encodage. Ordre DÉTERMINISTE : on
-- itère la LISTE des slots puis la LISTE des pièces, jamais `pairs`.

---@param session table
---@return string
local function encoder_session(session)
    local plan_id = identifiant_propre(session.plan.id)
    -- ValiderPlan a déjà refusé les identifiants à séparateur : nil ici serait
    -- une session construite à la main — écrire une ligne indécodable serait
    -- pire que lever.
    assert(plan_id, "assemblage : identifiant de plan incodable")
    local blocs = {}
    for _, slot in ipairs(session.slots) do
        if (slot.pose > 0) then
            local sid = identifiant_propre(slot.id)
            assert(sid, "assemblage : identifiant d'emplacement incodable")
            local entrees = {}
            for _, p in ipairs(slot.pieces) do
                local pid = identifiant_propre(p.item_id)
                assert(pid, "assemblage : identifiant de pièce incodable")
                entrees[#entrees + 1] = pid .. ":" .. p.quantite
            end
            blocs[#blocs + 1] = sid .. "=" .. table.concat(entrees, ",")
        end
    end
    return plan_id .. ";" .. table.concat(blocs, "|")
end

--- Chaîne → { plan_id, pieces = { { slot, item_id, quantite }, … } }.
--- TOLÉRANTE mais pas devineuse : une entrée mal formée est ÉCARTÉE, et une
--- chaîne sans tête rend nil — jamais une session à moitié devinée.
---@param chaine any
---@return table|nil
local function decoder_session(chaine)
    if (type(chaine) ~= "string" or chaine == "") then return nil end
    local plan_id, corps = chaine:match("^([^;]+);(.*)$")
    if (not plan_id) then return nil end
    local pieces = {}
    for bloc in tostring(corps):gmatch("[^|]+") do
        local slot, liste = bloc:match("^([^=]+)=(.*)$")
        if (slot) then
            for entree in tostring(liste):gmatch("[^,]+") do
                local item, q = entree:match("^([^:]+):(%d+)$")
                local quantite = tonumber(q)
                -- Un item qui porterait un séparateur est une entrée mal
                -- formée : ÉCARTÉE, jamais demi-parsée (cf. identifiant_propre).
                if (item and not item:find("[;|,=]") and quantite and quantite > 0) then
                    pieces[#pieces + 1] = { slot = slot, item_id = item, quantite = quantite }
                end
            end
        end
    end
    return { plan_id = plan_id, pieces = pieces }
end

--- Réécrit la ligne du joueur après CHAQUE mutation. Sans base, on ne fait
--- rien : seul `Ouvrir` exige la base (une session n'existe que si elle est
--- persistée) ; ce garde couvre les outils de test qui injecteraient à retard.
---@param session table
local function ecrire_ligne(session)
    if (not db) then return end
    db:Execute(
        "INSERT OR REPLACE INTO assemblages (proprietaire_id, plan_id, donnees)"
            .. " VALUES (:0, :1, :2)",
        session.proprietaire, session.plan.id, encoder_session(session))
end

---@param joueur_id string
local function effacer_ligne(joueur_id)
    if (not db) then return end
    db:Execute("DELETE FROM assemblages WHERE proprietaire_id = :0", joueur_id)
end

--- La ligne persistée du joueur, décodée, ou nil.
---@param joueur_id string
---@return table|nil { plan_id, pieces }
local function lire_ligne(joueur_id)
    if (not db) then return nil end
    local lignes = db:Select(
        "SELECT plan_id, donnees FROM assemblages WHERE proprietaire_id = :0", joueur_id)
    local ligne = lignes and lignes[1] or nil
    if (not ligne) then return nil end
    return decoder_session(ligne.donnees)
end

-- ── Base ──────────────────────────────────────────────────────────────────────

--- Injecte la base. Appelé par l'exécutant serveur après Comptes.Ouvrir, sur
--- la MÊME connexion — voir Comptes.Base(). nil débranche (Prete() → false).
---@param instance any
function Assemblage.UtiliserBase(instance)
    db = instance
end

--- La base est-elle injectée ? `Ouvrir` l'exige (voir l'en-tête, réponse nº 2).
---@return boolean
function Assemblage.Prete()
    return db ~= nil
end

-- ── Validation du plan — le garde du générateur (chantier B) ──────────────────

--- Le plan est-il bien formé ? REND true, nil ou false, raison NOMMÉE ; ne
--- lève jamais. C'est le contrat que le générateur de plans doit respecter :
--- slot sans id, doublon d'id, `obligatoire` absent (nil n'est pas false !),
--- quantité invalide, filtre absent ou sans critère, famille inconnue du plan,
--- trou dans la liste des emplacements, identifiant à séparateur.
---
--- Les identifiants d'objets (résultat, `items`, membres de familles) sont en
--- outre vérifiés CONTRE LE CATALOGUE quand il est disponible ; sans catalogue
--- injecté, seule la forme est prouvée (un plan généré se valide toujours
--- catalogue en main). `types`/`categories`/`raretes` sont des ENUMS OUVERTS :
--- leur forme est vérifiée, pas leurs valeurs — l'appartenance se juge à la
--- pose, contre la définition réelle de la pièce.
---@param plan any
---@return boolean ok
---@return string|nil raison
function Assemblage.ValiderPlan(plan)
    if (type(plan) ~= "table") then return false, "plan absent ou non-table" end
    if (not identifiant_propre(plan.id)) then
        return false, "plan sans identifiant propre (vide, ou caractère « ;|:,= »)"
    end

    -- Le résultat : ce que la finalisation doit pouvoir poser dans la grille.
    if (type(plan.resultat) ~= "table" or not identifiant_propre(plan.resultat.item_id)) then
        return false, "plan « " .. tostring(plan.id) .. " » : résultat sans item_id propre"
    end
    if (plan.resultat.quantite ~= nil
        and (type(plan.resultat.quantite) ~= "number" or plan.resultat.quantite < 1
            or plan.resultat.quantite % 1 ~= 0)) then
        return false, "plan « " .. plan.id .. " » : quantité de résultat invalide"
    end
    local catalogue = Inventory.GetItemDatabase()
    if (catalogue ~= nil and Inventory.GetItemDef(plan.resultat.item_id) == nil) then
        return false, "plan « " .. plan.id .. " » : résultat inconnu du catalogue : "
            .. plan.resultat.item_id
    end

    -- Les familles : listes non vides d'identifiants propres (existants si le
    -- catalogue est là).
    if (plan.familles ~= nil) then
        if (type(plan.familles) ~= "table") then
            return false, "plan « " .. plan.id .. " » : familles non-table"
        end
        for nom, membres in pairs(plan.familles) do
            if (type(nom) ~= "string" or nom == "") then
                return false, "plan « " .. plan.id .. " » : famille sans nom"
            end
            if (type(membres) ~= "table" or #membres == 0) then
                return false, "plan « " .. plan.id .. " » : famille « " .. nom .. " » vide"
            end
            for _, m in ipairs(membres) do
                if (not identifiant_propre(m)) then
                    return false, "plan « " .. plan.id .. " » : famille « " .. nom
                        .. " » : membre impropre"
                end
                if (catalogue ~= nil and Inventory.GetItemDef(m) == nil) then
                    return false, "plan « " .. plan.id .. " » : famille « " .. nom
                        .. " » : « " .. m .. " » inconnu du catalogue"
                end
            end
        end
    end

    -- Les emplacements : une LISTE, sans trou. `#` s'arrête au premier nil ;
    -- compter par `pairs` et comparer est le seul test honnête du trou.
    if (type(plan.emplacements) ~= "table") then
        return false, "plan « " .. plan.id .. " » : emplacements absents"
    end
    local compte = 0
    for _ in pairs(plan.emplacements) do compte = compte + 1 end
    if (compte ~= #plan.emplacements) then
        return false, "plan « " .. plan.id
            .. " » : trou dans la liste des emplacements — un champ à nil DISPARAÎT"
    end
    if (#plan.emplacements == 0) then
        return false, "plan « " .. plan.id .. " » : aucun emplacement"
    end

    local vus = {}
    for index, e in ipairs(plan.emplacements) do
        if (type(e) ~= "table") then
            return false, "plan « " .. plan.id .. " » : emplacement " .. index .. " non-table"
        end
        if (not identifiant_propre(e.id)) then
            return false, "plan « " .. plan.id .. " » : emplacement " .. index
                .. " sans id propre"
        end
        if (vus[e.id]) then
            return false, "plan « " .. plan.id .. " » : doublon d'emplacement « " .. e.id .. " »"
        end
        vus[e.id] = true
        -- nil n'est PAS false : un champ `obligatoire` oublié disparaît de la
        -- table et deviendrait « facultatif » par accident. Explicite ou rien.
        if (type(e.obligatoire) ~= "boolean") then
            return false, "plan « " .. plan.id .. " » : emplacement « " .. e.id
                .. " » : obligatoire absent — true ou false explicite, jamais nil"
        end
        if (e.quantite ~= nil
            and (type(e.quantite) ~= "number" or e.quantite < 1 or e.quantite % 1 ~= 0)) then
            return false, "plan « " .. plan.id .. " » : emplacement « " .. e.id
                .. " » : quantité invalide"
        end
        if (type(e.filtre) ~= "table") then
            return false, "plan « " .. plan.id .. " » : emplacement « " .. e.id
                .. " » sans filtre"
        end

        local criteres = 0
        for _, cle in ipairs({ "items", "types", "categories", "raretes" }) do
            local liste = e.filtre[cle]
            if (liste ~= nil) then
                if (type(liste) ~= "table" or #liste == 0) then
                    return false, "plan « " .. plan.id .. " » : emplacement « " .. e.id
                        .. " » : filtre." .. cle .. " vide"
                end
                for _, v in ipairs(liste) do
                    if (type(v) ~= "string" or v == "") then
                        return false, "plan « " .. plan.id .. " » : emplacement « " .. e.id
                            .. " » : filtre." .. cle .. " non-chaîne"
                    end
                    if (cle == "items" and catalogue ~= nil
                        and Inventory.GetItemDef(v) == nil) then
                        return false, "plan « " .. plan.id .. " » : emplacement « " .. e.id
                            .. " » : « " .. v .. " » inconnu du catalogue"
                    end
                end
                criteres = criteres + 1
            end
        end
        if (e.filtre.famille ~= nil) then
            if (type(e.filtre.famille) ~= "string" or e.filtre.famille == "") then
                return false, "plan « " .. plan.id .. " » : emplacement « " .. e.id
                    .. " » : famille non-chaîne"
            end
            if (type(plan.familles) ~= "table" or plan.familles[e.filtre.famille] == nil) then
                return false, "plan « " .. plan.id .. " » : emplacement « " .. e.id
                    .. " » : famille « " .. e.filtre.famille .. " » absente du plan"
            end
            criteres = criteres + 1
        end
        if (criteres == 0) then
            return false, "plan « " .. plan.id .. " » : emplacement « " .. e.id
                .. " » : filtre sans critère — un emplacement qui accepte tout doit le dire"
        end
    end

    return true, nil
end

--- Les emplacements du plan, normalisés pour l'affichage (chantier C) :
--- LISTE de { id, label, obligatoire, quantite }, dans l'ordre du plan.
--- Rend nil, raison si le plan est malformé — l'UI ne dessine jamais un plan
--- que le modèle aurait refusé.
---@param plan any
---@return table|nil liste
---@return string|nil raison
function Assemblage.Emplacements(plan)
    local ok, raison = Assemblage.ValiderPlan(plan)
    if (not ok) then return nil, raison end
    local liste = {}
    for index, e in ipairs(plan.emplacements) do
        liste[index] = {
            id = e.id,
            label = e.label or e.id,
            obligatoire = e.obligatoire,
            quantite = e.quantite or 1,
        }
    end
    return liste, nil
end

-- ── Cycle de vie ──────────────────────────────────────────────────────────────

--- Ouvre un assemblage. REFUSE si : la base n'est pas injectée (réponse nº 2),
--- le plan est malformé (ValiderPlan), une session est déjà en cours, ou une
--- ligne persistée existe déjà (l'exécutant doit `Reprendre`, pas écraser —
--- écraser abandonnerait des pièces consommées dans le vide).
---@param joueur_id any
---@param plan any
---@return boolean ok
---@return string|nil raison
function Assemblage.Ouvrir(joueur_id, plan)
    if (not db) then return false, "Base indisponible" end
    if (type(joueur_id) ~= "string" or joueur_id == "") then
        return false, "propriétaire invalide"
    end
    local ok, raison = Assemblage.ValiderPlan(plan)
    if (not ok) then return false, raison end
    if (sessions[joueur_id] ~= nil) then
        return false, "assemblage déjà en cours — l'abandonner ou le finaliser d'abord"
    end
    if (lire_ligne(joueur_id) ~= nil) then
        return false, "un assemblage persisté existe — le reprendre, ne pas l'écraser"
    end

    local session = nouvelle_session(joueur_id, plan)
    sessions[joueur_id] = session
    ecrire_ligne(session)
    return true, nil
end

--- La pièce `item_id` est-elle acceptable dans l'emplacement `slot_id` ?
--- Le refus dit POURQUOI (premier motif fautif, cf. l'en-tête). C'est la
--- question que l'UI pose au survol d'une pièce, AVANT de tenter la pose.
---@param joueur_id any
---@param slot_id any
---@param item_id any
---@return boolean ok
---@return string|nil raison
function Assemblage.Accepte(joueur_id, slot_id, item_id)
    local session = sessions[joueur_id]
    if (not session) then return false, "aucun assemblage en cours" end
    local slot = trouver_slot(session, slot_id)
    if (not slot) then return false, "emplacement inconnu : " .. tostring(slot_id) end
    if (slot.pose >= slot.quantite) then
        return false, ("emplacement complet (%d/%d)"):format(slot.pose, slot.quantite)
    end
    return conforme_filtre(session.plan, slot, item_id)
end

--- Ce qui manque pour finaliser, NOMMÉMENT : LISTE de { id, label, requis,
--- pose, manque } pour chaque emplacement OBLIGATOIRE incomplet, dans l'ordre
--- du plan. Liste vide = complet (ou pas de session — les deux se distinguent
--- par `Vue`, qui rend nil sans session).
---@param joueur_id any
---@return table
function Assemblage.Manquants(joueur_id)
    local session = sessions[joueur_id]
    if (not session) then return {} end
    return liste_manquants(session)
end

--- Tous les emplacements obligatoires sont-ils remplis ? false sans session.
---@param joueur_id any
---@return boolean
function Assemblage.Complet(joueur_id)
    local session = sessions[joueur_id]
    if (not session) then return false end
    return #liste_manquants(session) == 0
end

--- Vue de la session pour l'affichage (chantier C) : COPIES, jamais l'état
--- interne — un appelant qui écrirait dedans contournerait la persistance.
--- Chaque slot porte sa LISTE de pièces (vide s'il n'a rien : un emplacement
--- vide existe, il n'est pas nil). nil sans session.
---@param joueur_id any
---@return table|nil { plan_id, label, resultat = { item_id, quantite }, slots = { … } }
function Assemblage.Vue(joueur_id)
    local session = sessions[joueur_id]
    if (not session) then return nil end
    local slots = {}
    for index, slot in ipairs(session.slots) do
        local pieces = {}
        for j, p in ipairs(slot.pieces) do
            pieces[j] = { item_id = p.item_id, quantite = p.quantite }
        end
        slots[index] = {
            id = slot.id,
            label = slot.label,
            obligatoire = slot.obligatoire,
            quantite = slot.quantite,
            pose = slot.pose,
            pieces = pieces,
        }
    end
    return {
        plan_id = session.plan.id,
        label = session.plan.label or session.plan.id,
        resultat = {
            item_id = session.plan.resultat.item_id,
            quantite = session.plan.resultat.quantite or 1,
        },
        slots = slots,
    }
end

-- ── Mutations (grille immuable : nouvelle grille rendue, ou nil + raison) ─────

--- Pose `quantite` (défaut 1) unités de la pile `uid` dans l'emplacement
--- `slot_id`. CONSOMMATION UID-CORRECTE, le mécanisme de Craft.Consommer :
---   PHASE 1, lecture seule — la pile existe, la pièce est acceptée (motif
---   nommé sinon), les quantités suffisent des DEUX côtés. Le plan de retrait
---   (uid, prise) est établi sans rien toucher.
---   PHASE 2, application — RemoveItemFromGrid sur l'UID (jamais l'item_id),
---   pièce rangée dans le slot, ligne persistée.
---@param joueur_id any
---@param grille table NarvosGridState
---@param slot_id any
---@param uid any
---@param quantite any|nil défaut 1
---@return table|nil grille_neuve
---@return string|nil raison
function Assemblage.Poser(joueur_id, grille, slot_id, uid, quantite)
    local session = sessions[joueur_id]
    if (not session) then return nil, "aucun assemblage en cours" end
    if (type(grille) ~= "table" or type(grille.instances) ~= "table") then
        return nil, "grille invalide"
    end
    local slot = trouver_slot(session, slot_id)
    if (not slot) then return nil, "emplacement inconnu : " .. tostring(slot_id) end
    if (type(uid) ~= "string" or uid == "") then return nil, "uid invalide" end
    local q = quantite or 1
    if (type(q) ~= "number" or q < 1 or q % 1 ~= 0) then
        return nil, "quantité invalide"
    end

    -- ── PHASE 1 — SNAPSHOT, lecture seule : rien ne bouge tant que tout n'est
    -- pas prouvé possible.
    local inst = Inventory.FindInstance(grille, uid)
    if (not inst) then return nil, "pièce absente de la grille : " .. uid end
    local ok, raison = Assemblage.Accepte(joueur_id, slot_id, inst.itemId)
    if (not ok) then return nil, raison end
    if (inst.quantity < q) then
        return nil, ("la pile %s n'a que %d unité(s)"):format(uid, inst.quantity)
    end
    local capacite = slot.quantite - slot.pose
    if (q > capacite) then
        return nil, ("l'emplacement « %s » n'attend plus que %d pièce(s)"):format(
            slot.id, capacite)
    end
    -- Le plan de consommation : (uid, prise) — un UID, pas un item_id.
    local plan_retrait = { { uid = uid, prise = q } }

    -- ── PHASE 2 — APPLICATION : la grille rendue est NOUVELLE (immuable).
    local nouvelle, retiree = Inventory.RemoveItemFromGrid(
        grille, plan_retrait[1].uid, plan_retrait[1].prise)
    if (retiree == nil) then
        return nil, "instance introuvable : " .. tostring(uid)
    end
    ajouter_piece(slot, inst.itemId, q)
    ecrire_ligne(session)
    return nouvelle, nil
end

--- Reprend `quantite` (défaut 1) unités de `item_id` posées dans `slot_id` et
--- les RESTITUE à la grille. GARDE « LA PLACE AVANT LA CONSOMMATION » :
--- l'ajout est SIMULÉ sur la grille AVANT de sortir la pièce de l'emplacement
--- — sans place, la pièce reste posée, rien n'est mangé. (AddItemToGrid étant
--- immuable, la grille simulée EST la grille rendue quand tout va bien.)
---@param joueur_id any
---@param grille table NarvosGridState
---@param slot_id any
---@param item_id any
---@param quantite any|nil défaut 1
---@return table|nil grille_neuve
---@return string|nil raison
function Assemblage.Retirer(joueur_id, grille, slot_id, item_id, quantite)
    local session = sessions[joueur_id]
    if (not session) then return nil, "aucun assemblage en cours" end
    if (type(grille) ~= "table" or type(grille.instances) ~= "table") then
        return nil, "grille invalide"
    end
    local slot = trouver_slot(session, slot_id)
    if (not slot) then return nil, "emplacement inconnu : " .. tostring(slot_id) end
    if (type(item_id) ~= "string" or item_id == "") then
        return nil, "pièce invalide"
    end
    local q = quantite or 1
    if (type(q) ~= "number" or q < 1 or q % 1 ~= 0) then
        return nil, "quantité invalide"
    end

    local posee = 0
    for _, p in ipairs(slot.pieces) do
        if (p.item_id == item_id) then posee = p.quantite break end
    end
    if (posee == 0) then
        return nil, "aucune « " .. item_id .. " » posée dans « " .. slot.id .. " »"
    end
    if (q > posee) then
        return nil, ("seulement %d « %s » posée(s) dans « %s »"):format(
            posee, item_id, slot.id)
    end
    local def = Inventory.GetItemDef(item_id)
    if (not def) then return nil, "objet inconnu du catalogue : " .. item_id end

    -- PLACE D'ABORD : la simulation ne mute rien. Échec ⇒ pièce toujours posée.
    local essai = Inventory.AddItemToGrid(grille, def, q)
    if (not essai) then
        return nil, "pas de place pour rendre la pièce — elle reste posée"
    end
    retirer_piece(slot, item_id, q)
    ecrire_ligne(session)
    return essai, nil
end

--- Abandonne : TOUTES les pièces posées REVIENNENT à la grille, ou AUCUNE.
--- PHASE 1 — la restitution de chaque pièce est simulée en chaîne (chaque
--- AddItemToGrid immuable nourrit la suivante) ; la première qui ne rentre pas
--- REFUSE l'abandon : session ouverte, grille intacte, rien perdu.
--- PHASE 2 — tout rentre : la session est fermée et la ligne persistée effacée.
---@param joueur_id any
---@param grille table NarvosGridState
---@return table|nil grille_neuve
---@return string|nil raison
function Assemblage.Abandonner(joueur_id, grille)
    local session = sessions[joueur_id]
    if (not session) then return nil, "aucun assemblage en cours" end
    if (type(grille) ~= "table" or type(grille.instances) ~= "table") then
        return nil, "grille invalide"
    end

    local courante = grille
    for _, slot in ipairs(session.slots) do
        for _, p in ipairs(slot.pieces) do
            local def = Inventory.GetItemDef(p.item_id)
            if (not def) then
                return nil, "pièce disparue du catalogue : " .. p.item_id
                    .. " — l'assemblage reste ouvert"
            end
            local suivante = Inventory.AddItemToGrid(courante, def, p.quantite)
            if (not suivante) then
                return nil, "pas de place pour rendre les pièces — l'assemblage reste ouvert"
            end
            courante = suivante
        end
    end

    sessions[joueur_id] = nil
    effacer_ligne(joueur_id)
    return courante, nil
end

--- Finalise : complétude obligatoire d'abord (manquants NOMMÉS sinon), place
--- du résultat SIMULÉE ensuite — et seulement alors les pièces posées sont
--- absorbées : la session est détruite et la ligne persistée effacée. Sans
--- place, RIEN n'est détruit : les pièces restent récupérables par `Retirer`
--- ou `Abandonner`. Rend la grille neuve ET le résultat posé.
---@param joueur_id any
---@param grille table NarvosGridState
---@return table|nil grille_neuve
---@return table|string|nil resultat { item_id, quantite } ou raison
function Assemblage.Finaliser(joueur_id, grille)
    local session = sessions[joueur_id]
    if (not session) then return nil, "aucun assemblage en cours" end
    if (type(grille) ~= "table" or type(grille.instances) ~= "table") then
        return nil, "grille invalide"
    end

    local manquants = liste_manquants(session)
    if (#manquants > 0) then
        local noms = {}
        for _, m in ipairs(manquants) do
            noms[#noms + 1] = ("%s (%d/%d)"):format(m.label, m.pose, m.requis)
        end
        return nil, "il manque : " .. table.concat(noms, ", ")
    end

    local resultat = {
        item_id = session.plan.resultat.item_id,
        quantite = session.plan.resultat.quantite or 1,
    }
    local def = Inventory.GetItemDef(resultat.item_id)
    if (not def) then
        return nil, "résultat inconnu du catalogue : " .. resultat.item_id
    end

    -- PLACE AVANT DESTRUCTION : la simulation ne consomme rien. Échec ⇒ la
    -- session reste ouverte et chaque pièce est encore là.
    local finale = Inventory.AddItemToGrid(grille, def, resultat.quantite)
    if (not finale) then
        return nil, "pas de place pour le résultat — rien n'a été détruit"
    end

    sessions[joueur_id] = nil
    effacer_ligne(joueur_id)
    return finale, resultat
end

-- ── Reprise après déconnexion ─────────────────────────────────────────────────

--- La ligne persistée du joueur, décodée : { plan_id, pieces } ou nil.
--- L'exécutant serveur s'en sert pour savoir QUEL plan recharger depuis le
--- catalogue (chantier B) avant d'appeler `Reprendre`.
---@param joueur_id any
---@return table|nil
function Assemblage.Charger(joueur_id)
    if (type(joueur_id) ~= "string" or joueur_id == "") then return nil end
    return lire_ligne(joueur_id)
end

--- Reconstruit la session depuis la base (le joueur a déco entre deux pièces).
--- Le plan DOIT être celui de la ligne persistée : un autre plan est refusé,
--- la ligne reste — l'exécutant décide ensuite (reprendre le bon plan, ou
--- faire rendre les pièces). Les pièces persistées qui ne trouvent plus leur
--- place — emplacement disparu, filtre retouché, capacité réduite, objet
--- inconnu — sont rendues NOMMÉMENT dans `a_rendre` ({ item_id, quantite }) :
--- c'est à l'exécutant de les restituer à la grille (lui seul la détient),
--- avec la même garde de place que partout.
---@param joueur_id any
---@param plan any
---@return boolean ok
---@return table|string|nil a_rendre_ou_raison
function Assemblage.Reprendre(joueur_id, plan)
    if (not db) then return false, "Base indisponible" end
    if (type(joueur_id) ~= "string" or joueur_id == "") then
        return false, "propriétaire invalide"
    end
    local ok, raison = Assemblage.ValiderPlan(plan)
    if (not ok) then return false, raison end

    local ligne = lire_ligne(joueur_id)
    if (not ligne) then
        return false, "aucun assemblage persisté"
    end
    if (ligne.plan_id ~= plan.id) then
        return false, "le plan persisté (« " .. ligne.plan_id
            .. " ») n'est pas « " .. plan.id .. " »"
    end

    local session = nouvelle_session(joueur_id, plan)
    local a_rendre = {}
    for _, piece in ipairs(ligne.pieces) do
        local slot = trouver_slot(session, piece.slot)
        local conforme = false
        if (slot) then
            conforme = conforme_filtre(plan, slot, piece.item_id)
        end
        if (not slot or not conforme) then
            -- Le plan a changé sous la pièce : elle n'a plus sa place ici.
            a_rendre[#a_rendre + 1] = { item_id = piece.item_id, quantite = piece.quantite }
        else
            local capacite = slot.quantite - slot.pose
            local prise = math.min(capacite, piece.quantite)
            if (prise > 0) then ajouter_piece(slot, piece.item_id, prise) end
            if (prise < piece.quantite) then
                a_rendre[#a_rendre + 1] = {
                    item_id = piece.item_id, quantite = piece.quantite - prise }
            end
        end
    end

    sessions[joueur_id] = session
    ecrire_ligne(session)   -- la ligne est normalisée sur le plan actuel
    return true, a_rendre
end

return Assemblage
