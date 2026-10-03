-- ══════════════════════════════════════════════════════════════════════════════
-- ArmesInventaire.lua — rendre les ARMES stockables dans le sac.
--
-- Câblage : Narvos.ArmesInventaire = Package.Require("Logic/ArmesInventaire.lua")
--           puis Narvos.ArmesInventaire.Integrer() dans Shared/Index.lua.
--
-- ── LE DÉFAUT QU'IL CORRIGE ───────────────────────────────────────────────────
-- Mesuré le 2026-09-12, après trois signalements de Hanibes (« je ne peux pas
-- stocker les armes ») :
--
--     ArmesBase.ARMES   24 armes spawnables   ak47, glock, moss500, …
--     Items.ITEM_DB     81 objets de sac      arch_sword, plasma_blade, …
--     identifiants communs : ZÉRO
--
-- Les deux catalogues sont GÉNÉRÉS, depuis des sources sans rapport : ITEM_DB
-- vient du prototype web (`items/itemCatalog.ts`), ARMES du package officiel
-- nanos. Ils ne se sont jamais connus. Une arme posée au sol n'était donc pas un
-- objet — il n'y avait rien à mettre dans la grille.
--
-- ── POURQUOI DÉRIVER, ET NE PAS ÉCRIRE 24 ENTRÉES ─────────────────────────────
-- Les deux fichiers portent « FICHIER GÉNÉRÉ, ne pas éditer ». Recopier les 24
-- armes dans l'un d'eux serait écrasé au prochain `--apply` ; les écrire ici à
-- la main donnerait une liste qui diverge le jour où le pack d'armes change.
--
-- C'est la règle la plus chèrement payée du projet : « une liste de clés
-- recopiée diverge toujours de sa source ». On ITÈRE donc `ARMES`, et une arme
-- ajoutée demain devient stockable sans qu'on touche à ce fichier.
-- ══════════════════════════════════════════════════════════════════════════════

local ArmesInventaire = {}

--- Encombrement dans la grille, par catégorie d'arme.
---
--- ⚠ C'est un CHOIX de gameplay, pas une donnée du pack : les catégories
--- viennent d'`ArmesBase`, les tailles sont à nous. Une catégorie inconnue
--- retombe sur `defaut` — un pack qui ajoute « launchers » ne casse rien, il
--- occupe simplement la taille moyenne en attendant qu'on tranche.
ArmesInventaire.TAILLES = {
    rifles     = { w = 2, h = 4 },
    smgs       = { w = 2, h = 3 },
    shotguns   = { w = 2, h = 4 },
    snipers    = { w = 2, h = 5 },
    pistols    = { w = 2, h = 2 },
    melee      = { w = 1, h = 3 },
    grenades   = { w = 1, h = 1 },
    special    = { w = 2, h = 3 },
    defaut     = { w = 2, h = 3 },
}

--- Icône par catégorie. Le sac affiche un caractère, pas une image.
ArmesInventaire.ICONES = {
    rifles = "🔫", smgs = "🔫", shotguns = "🔫", snipers = "🎯",
    pistols = "🔫", melee = "🗡️", grenades = "💣", special = "⚙️",
    defaut = "🔫",
}

--- L'entrée d'inventaire que vaut une arme du catalogue.
---
--- Le champ `arme` est le pont de retour : équiper cet objet doit faire spawner
--- CETTE arme, et sans lui il faudrait redeviner l'identifiant depuis le label.
---@param a table  une entrée de ArmesBase.ARMES
---@return table|nil
function ArmesInventaire.Objet(a)
    if (type(a) ~= "table") then return nil end
    if (type(a.id) ~= "string" or a.id == "") then return nil end

    local categorie = (type(a.categorie) == "string") and a.categorie or "defaut"
    local taille = ArmesInventaire.TAILLES[categorie] or ArmesInventaire.TAILLES.defaut

    return {
        id          = a.id,
        label       = (type(a.label) == "string" and a.label ~= "") and a.label or a.id,
        type        = "weapon",
        rarity      = "common",
        description = "Arme — " .. categorie,
        gridW       = taille.w,
        gridH       = taille.h,
        -- Une arme ne s'empile pas : deux exemplaires ont des munitions
        -- différentes, et les fondre ferait disparaître un chargeur.
        stackable   = false,
        maxStack    = 1,
        equipSlot   = "weapon",
        icon        = ArmesInventaire.ICONES[categorie] or ArmesInventaire.ICONES.defaut,
        color       = "#b9c6d2",
        -- Le pont vers le monde : `Weapons.Donner` prend cet identifiant.
        arme        = a.id,
        mesh        = a.mesh,
    }
end

--- Ajoute les armes au catalogue d'objets. Rend le nombre d'entrées ajoutées.
---
--- ⚠ N'ÉCRASE JAMAIS une entrée existante. Si un jour ITEM_DB porte lui-même un
--- `ak47` — réglé à la main, avec des statistiques pensées — c'est LUI qui doit
--- gagner : ce module comble un manque, il n'impose pas sa version.
---@param items table|nil  défaut : Narvos.Items.ITEM_DB
---@param armes table|nil  défaut : Narvos.ArmesBase.ARMES
---@return number ajoutees
---@return number deja_presentes
function ArmesInventaire.Integrer(items, armes)
    items = items or (Narvos and Narvos.Items and Narvos.Items.ITEM_DB)
    armes = armes or (Narvos and Narvos.ArmesBase and Narvos.ArmesBase.ARMES)
    if (type(items) ~= "table" or type(armes) ~= "table") then return 0, 0 end

    local ajoutees, deja = 0, 0
    for i = 1, #armes do
        local objet = ArmesInventaire.Objet(armes[i])
        if (objet) then
            if (items[objet.id] ~= nil) then
                deja = deja + 1
            else
                items[objet.id] = objet
                ajoutees = ajoutees + 1
            end
        end
    end
    return ajoutees, deja
end

--- Raccorde le catalogue réellement utilisable et garde les anciens ids de sac.
function ArmesInventaire.IntegrerCatalogue(weapons, items, roue)
    local ajoutes = 0
    for _, arme_id in ipairs(weapons.ORDRE) do
        local a = weapons.CATALOGUE[arme_id]
        local ancien = arme_id:match("^base_(.+)$")
        local item_id = (ancien and items[ancien]) and ancien or arme_id
        if (not items[item_id]) then
            items[item_id] = ArmesInventaire.Objet({ id = item_id, label = a.label, mesh = a.mesh, categorie = a.categorie })
            ajoutes = ajoutes + 1
        end
        local objet = items[item_id]
        objet.arme = arme_id
        objet.category = "equipment"
        objet.sous_type = a.categorie == "melee" and "melee" or "distance"
        roue.ARME_PAR_ITEM[item_id] = { genre = "feu", arme_id = arme_id }
    end
    return ajoutes
end

function ArmesInventaire.ItemPourArme(arme_id, items)
    if (type(arme_id) ~= "string") then return nil end
    for _, objet in pairs(items or {}) do
        if (objet.arme == arme_id) then return objet end
    end
    return items and items[arme_id] or nil
end

return ArmesInventaire
