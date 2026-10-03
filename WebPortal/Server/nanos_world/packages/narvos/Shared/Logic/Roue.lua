-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Roue.lua — la roue d'objets (TAB), PAR PERSONNAGE.
--
-- Câblage : Narvos.Roue = Package.Require("Logic/Roue.lua")
--
-- ── CE QUE C'EST ──────────────────────────────────────────────────────────────
-- Cinq emplacements, chacun pointant vers un objet du catalogue : une arme ou
-- un consommable. Activer un emplacement déclenche la logique RÉELLE de l'objet
-- — `Weapons.Donner` pour une arme à feu, `CombatServeur.Equiper` pour une
-- mêlée, décrément + soin/mana pour un consommable. Ce module ne touche aucune
-- API nanos : il décide QUOI faire (le « plan »), le serveur exécute.
--
-- ── POURQUOI PAR PERSONNAGE, CONTRAIREMENT AUX RACCOURCIS ─────────────────────
-- Un raccourci clavier est une habitude du joueur (voir Logic/Raccourcis.lua).
-- Le contenu de la roue, lui, dépend de ce que le PERSONNAGE porte : lier les
-- emplacements au compte mélangerait les sacs de deux personnages, et un
-- emplacement pointerait vers un objet qu'on n'a jamais eu.
--
-- ── LA CORRESPONDANCE item → arme RÉELLE ──────────────────────────────────────
-- Le catalogue (Catalogs/Items.lua, généré) décrit des armes de JDR — stats,
-- rareté, équipement. Il ne dit pas quelle arme nanos elles déclenchent :
-- `Weapons.CATALOGUE` (pistolet/fusil/pompe) et `CombatServeur.ARMES` (batte,
-- hache…) vivent ailleurs. `ARME_PAR_ITEM` est le pont. Il est COMPLÉTÉ au
-- câblage (Shared/Index.lua) : les armes à feu par `ArmesInventaire`, les armes
-- de mêlée par `Logic/Melee.lua` (2026-09-15) — chaque épée, dague, lance ou
-- bâton y équipe SON mesh. L'ancienne approximation « une épée déclenche la
-- batte » est retirée : elle mettait une batte dans la main de sept lames.
--
-- Un item d'arme SANS correspondance (les trois boucliers : aucune logique de
-- parade en main gauche n'existe) est REFUSÉ à l'assignation, avec la raison.
-- Mieux vaut un refus explicite qu'une case qui ne fait rien.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosRoue
local Roue = {}

local Items = (Narvos and Narvos.Items) or Package.Require("Catalogs/Items.lua")
local Inventory = (Narvos and Narvos.Inventory) or Package.Require("Logic/Inventory.lua")

--- Nombre d'emplacements. Le client itère 1..EMPLACEMENTS, jamais `pairs`.
Roue.EMPLACEMENTS = 5

--- item_id → { genre = "feu"|"melee", arme_id = <id réel> [, famille] }.
--- Complétée au câblage (ArmesInventaire, Melee.Integrer) ; une mêlée d'objet a
--- pour `arme_id` l'identifiant de l'OBJET (Server/Combat.lua lit ses réglages).
Roue.ARME_PAR_ITEM = {
    -- Seule arme à feu du catalogue d'items, seul pistolet plausible.
    arch_gun        = { genre = "feu",   arme_id = "pistolet" },
}

local db = nil

--- Injecte la base. Appelé par Server/Index.lua après Comptes.Ouvrir,
--- sur la MÊME connexion que les raccourcis — voir Comptes.Base().
function Roue.UtiliserBase(instance)
    db = instance
end

function Roue.Prete()
    return db ~= nil
end

-- ── Validation (pure, testable hors moteur) ───────────────────────────────────

--- L'objet peut-il occuper un emplacement ?
--- Rend (ok, raison) : un refus est un cas normal, jamais une exception.
---@param item_id any
---@return boolean, string|nil
function Roue.Assignable(item_id)
    if (type(item_id) ~= "string" or item_id == "") then
        return false, "Objet requis"
    end

    local def = Items.ITEM_DB[item_id]
    if (not def) then
        return false, "Objet inconnu : " .. tostring(item_id)
    end

    if (Roue.ARME_PAR_ITEM[item_id]) then return true, nil end

    -- Une arme du catalogue SANS correspondance réelle : refusée, et on dit
    -- pourquoi. Les boucliers sont ici — aucune logique de main gauche n'existe.
    if (def.type == "weapon") then
        return false, "« " .. (def.label or item_id)
            .. " » n'a pas d'arme réelle correspondante"
    end

    -- Un consommable n'est utile que s'il fait QUELQUE CHOSE. Les six potions
    -- « fusion C » du catalogue n'ont pas de useEffect : buvables en apparence,
    -- inertes en fait — les accepter créerait une case qui vole une potion
    -- sans rien rendre.
    local effet = def.useEffect
    if (effet and ((effet.heal or 0) > 0 or (effet.mana or 0) > 0)) then
        return true, nil
    end

    if (def.type == "consumable") then
        return false, "« " .. (def.label or item_id)
            .. " » n'a aucun effet d'utilisation"
    end

    return false, "Ni arme ni consommable utilisable"
end

-- ── Accès à la base ───────────────────────────────────────────────────────────

--- Assignations d'un personnage : { [emplacement] = item_id }.
---
--- Les entrées pointant vers un objet DISPARU du catalogue sont écartées
--- silencieusement — même discipline que `Raccourcis.ParCompte` : retirer un
--- objet du jeu ne doit pas casser la roue, l'emplacement devient inerte.
---@param perso_id string|nil
---@return table
function Roue.ParPerso(perso_id)
    local sortie = {}
    if (not db or perso_id == nil) then return sortie end

    local lignes = db:Select(
        "SELECT emplacement, item_id FROM roue WHERE perso_id = :0 ORDER BY emplacement ASC",
        perso_id)

    for _, l in ipairs(lignes or {}) do
        local e = tonumber(l.emplacement)
        if (e and e >= 1 and e <= Roue.EMPLACEMENTS and Items.ITEM_DB[l.item_id]) then
            sortie[e] = l.item_id
        end
    end
    return sortie
end

--- Assigne un objet à un emplacement.
---
--- Un emplacement déjà garni est RÉÉCRIT, pas refusé : c'est ce que le joueur
--- attend quand il réassigne. La clé primaire (perso, emplacement) le garantit.
---@param perso_id string
---@param emplacement any
---@param item_id any
---@return boolean, string|nil
function Roue.Definir(perso_id, emplacement, item_id)
    if (not db) then return false, "Base indisponible" end
    if (perso_id == nil) then return false, "Personnage inconnu" end

    local e = tonumber(emplacement)
    if (not e or e ~= math.floor(e) or e < 1 or e > Roue.EMPLACEMENTS) then
        return false, "Emplacement hors 1.." .. Roue.EMPLACEMENTS
    end

    local ok, raison = Roue.Assignable(item_id)
    if (not ok) then return false, raison end

    -- `INSERT OR REPLACE` : une seule requête, atomique. Un DELETE puis INSERT
    -- laisserait une fenêtre où l'emplacement n'existe plus.
    db:Execute(
        "INSERT OR REPLACE INTO roue (perso_id, emplacement, item_id) VALUES (:0, :1, :2)",
        perso_id, e, item_id)

    return true, nil
end

--- Vide un emplacement.
---@param perso_id string
---@param emplacement any
---@return boolean
function Roue.Retirer(perso_id, emplacement)
    if (not db or perso_id == nil) then return false end

    local e = tonumber(emplacement)
    if (not e) then return false end

    -- ⚠ Le `perso_id` dans le WHERE n'est pas décoratif : l'emplacement vient
    -- du client, et sans lui un joueur viderait la roue d'un autre.
    local touchees = db:Execute(
        "DELETE FROM roue WHERE perso_id = :0 AND emplacement = :1",
        perso_id, e)

    return (tonumber(touchees) or 0) > 0
end

-- ── Activation : le plan, pas le geste ────────────────────────────────────────

--- Ce que ferait l'activation d'un emplacement, SANS rien déclencher.
---
--- C'est ici que vit la REVALIDATION : l'assignation a beau être persistée,
--- l'objet doit être dans le sac À L'INSTANT de l'activation. Entre-temps il a
--- pu être vendu, déposé, consommé.
---
---@param grille NarvosGridState|nil
---@param par_perso table  résultat de `ParPerso`
---@param emplacement any
---@return table|nil plan { action, arme_id?, effet?, item_id, label }
---@return string|nil raison
function Roue.Activer(grille, par_perso, emplacement)
    local e = tonumber(emplacement)
    if (not e or e < 1 or e > Roue.EMPLACEMENTS) then
        return nil, "Emplacement hors 1.." .. Roue.EMPLACEMENTS
    end

    local item_id = par_perso and par_perso[e]
    if (not item_id) then
        -- Emplacement vide : RIEN ne se déclenche, et la raison le dit pour
        -- que l'interface puisse l'afficher.
        return nil, "Emplacement vide"
    end

    local def = Items.ITEM_DB[item_id]
    if (not def) then return nil, "Objet disparu du catalogue" end

    if (not grille or Inventory.CountItem(grille, item_id) <= 0) then
        return nil, "« " .. (def.label or item_id) .. " » n'est plus dans le sac"
    end

    local correspondance = Roue.ARME_PAR_ITEM[item_id]
    if (correspondance) then
        return {
            action  = correspondance.genre == "feu" and "equiper_feu" or "equiper_melee",
            arme_id = correspondance.arme_id,
            item_id = item_id,
            label   = def.label or item_id,
        }
    end

    local effet = def.useEffect
    if (effet and ((effet.heal or 0) > 0 or (effet.mana or 0) > 0)) then
        return {
            action  = "consommer",
            effet   = effet,
            item_id = item_id,
            label   = def.label or item_id,
        }
    end

    -- Théoriquement impossible si l'assignation est passée par Definir — mais
    -- une ligne écrite avant une évolution du catalogue peut y aboutir.
    return nil, "« " .. (def.label or item_id) .. " » n'est pas utilisable"
end

--- Retire UNE unité de l'objet dans la grille.
--- Rend la NOUVELLE grille (l'originale reste intacte — discipline d'
--- `Inventory.RemoveItemFromGrid`) ou nil s'il n'y en a plus.
---@param grille NarvosGridState|nil
---@param item_id string
---@return NarvosGridState|nil
function Roue.Consommer(grille, item_id)
    if (not grille) then return nil end

    for _, inst in ipairs(grille.instances) do
        if (inst.itemId == item_id and inst.quantity > 0) then
            local nouvelle = Inventory.RemoveItemFromGrid(grille, inst.uid, 1)
            return nouvelle
        end
    end

    return nil
end

-- ── La vue pour l'interface ───────────────────────────────────────────────────

--- Ce que la roue affiche : les 5 emplacements (garnis ou non, avec l'état de
--- présence dans le sac) et les objets du sac qu'on peut y assigner.
---@param grille NarvosGridState|nil
---@param perso_id string|nil
---@return table
function Roue.Vue(grille, perso_id)
    local par_perso = Roue.ParPerso(perso_id)

    local emplacements = {}
    for e = 1, Roue.EMPLACEMENTS do
        local item_id = par_perso[e]
        local def = item_id and Items.ITEM_DB[item_id] or nil

        if (def) then
            local correspondance = Roue.ARME_PAR_ITEM[item_id]
            emplacements[e] = {
                emplacement = e,
                item_id     = item_id,
                nom         = def.label or item_id,
                icone       = def.icon or "?",
                iconFile    = def.iconFile,
                rarete      = def.rarity or "common",
                action      = correspondance
                    and (correspondance.genre == "feu" and "equiper_feu" or "equiper_melee")
                    or "consommer",
                -- Faux quand l'objet assigné n'est plus dans le sac : la case
                -- s'affiche grisée au lieu de promettre un équipement impossible.
                present     = grille ~= nil and Inventory.CountItem(grille, item_id) > 0,
            }
        else
            emplacements[e] = { emplacement = e, item_id = nil }
        end
    end

    -- Éligibles : ce que le sac contient ET que la roue accepte. Une entrée
    -- par objet (pas par pile), triée par nom — une liste instable oblige à
    -- relire chaque ligne à chaque ouverture.
    local eligibles = {}
    if (grille) then
        local vus = {}
        for _, inst in ipairs(grille.instances) do
            if (not vus[inst.itemId]) then
                vus[inst.itemId] = true
                local ok = Roue.Assignable(inst.itemId)
                if (ok) then
                    local def = Items.ITEM_DB[inst.itemId]
                    eligibles[#eligibles + 1] = {
                        item_id  = inst.itemId,
                        nom      = def.label or inst.itemId,
                        icone    = def.icon or "?",
                        iconFile = def.iconFile,
                        rarete   = def.rarity or "common",
                        quantite = Inventory.CountItem(grille, inst.itemId),
                    }
                end
            end
        end
        table.sort(eligibles, function(a, b) return a.nom < b.nom end)
    end

    return { emplacements = emplacements, eligibles = eligibles }
end

return Roue
