-- ══════════════════════════════════════════════════════════════════════════════
-- Ramassage.lua — ce qui décide QUOI un objet du monde met dans le sac.
--
-- Câblage : Narvos.Ramassage = Package.Require("Logic/Ramassage.lua")
--
-- ── LE MANQUE QU'IL COMBLE ────────────────────────────────────────────────────
-- Mesuré le 2026-09-12, après trois signalements de Hanibes (« je ne peux pas
-- stocker les armes ou les objets que je fais apparaître ») : le projet n'avait
-- AUCUN mécanisme de ramassage. `grep -rn "Ramasser|Pickup" --include=*.lua` ne
-- rendait que des noms d'ANIMATIONS — une dizaine, cuites et prêtes, pour un
-- geste que rien n'exécutait.
--
-- Le butin des zones, lui, marchait : `VerserButin` écrit directement dans la
-- grille. Ce qui manquait, c'est le pont entre une ENTITÉ du monde et un ITEM
-- du catalogue. Un objet posé par `/prop` ou `/arme` restait décor.
--
-- ── POURQUOI CE FICHIER EST PUR ───────────────────────────────────────────────
-- Il ne touche ni entité, ni joueur, ni grille : il répond à « cette étiquette
-- vaut quel item ? » et « ce point est-il à portée ? ». Le va-et-vient moteur
-- vit dans `narvos-map-proto/Server/Ramassage.lua`. C'est la règle du projet —
-- logique pure d'un côté, coquille impure de l'autre — et c'est ce qui rend
-- cette décision testable sans lancer nanos.
-- ══════════════════════════════════════════════════════════════════════════════

local Ramassage = {}

--- Portée du ramassage, en centimètres.
---
--- 250 cm : un pas et demi. Assez pour ne pas devoir marcher SUR l'objet — la
--- capsule du joueur fait déjà 90 cm de large — et assez peu pour qu'on ne
--- ramasse pas au travers d'un mur sans le voir.
Ramassage.PORTEE_CM = 250.0

--- Les étiquettes d'entité que le serveur sait convertir en item, dans l'ordre
--- où on les interroge.
---
--- ⚠ L'ORDRE COMPTE. Une arme posée au sol porte `narvos_arme` ; un prop porte
--- `narvos_asset`. Une entité pourrait porter les deux (une arme spawnée comme
--- prop) : on veut alors l'ARME, qui est l'objet de jeu, pas son mesh.
Ramassage.ETIQUETTES = { "narvos_arme", "narvos_asset" }

-- ── LA PROJECTION DU SAC — la duplication fermée le 2026-09-13 ────────────────
--
-- Une arme équipée par la roue (TAB) RESTE dans le sac : l'entité tenue n'en est
-- que la projection (`Narvos:RoueActiver`, « l'objet équipé reste dans le sac »).
-- Or elle porte `narvos_arme`, comme une arme posée par `/arme`. Relevé en
-- écrivant les menottes : TAB equipe, T range — `character:Drop()` laisse
-- l'entité AU SOL —, Y la ramasse, et le sac gagne un exemplaire. Répété, c'est
-- une arme gratuite par tour, sans un signal.
--
-- La marque distingue les deux cas. Elle est posée par l'exécutant au moment où
-- la roue équipe, lue par le ramassage et par le gestionnaire de `Drop`.

--- Valeur d'entité (serveur seul) posée sur une arme équipée DEPUIS LE SAC.
Ramassage.MARQUE_PROJECTION = "narvos_projection_sac"

--- Une entité portant cette valeur peut-elle entrer dans un sac ?
--- Seul `true` exclut : une valeur absente (`nil`, ou le repli `false` de
--- `GetValue`) désigne un objet qui n'existe QUE dans le monde.
---@param projection any  valeur lue sous MARQUE_PROJECTION
---@return boolean
function Ramassage.EstRamassable(projection)
    return projection ~= true
end

--- Que devient une entité lâchée (touche T, mort, lâcher natif) ?
---
---   "detruire" — c'est une projection : l'objet est toujours dans le sac, le
---                laisser au sol en ferait un second exemplaire ;
---   "laisser"  — l'objet n'existe que dans le monde : le détruire le perdrait.
---@param projection any  valeur lue sous MARQUE_PROJECTION
---@return string
function Ramassage.SortDuLacher(projection)
    if (projection == true) then return "detruire" end
    return "laisser"
end

--- Distance horizontale au carré entre deux points.
---
--- ⚠ AU CARRÉ, et HORIZONTALE. Au carré parce qu'une racine par entité et par
--- pression de touche ne sert à rien : comparer des carrés ordonne pareil.
--- Horizontale parce qu'un objet tombé à ses pieds et un objet sur une table à
--- la même verticale doivent tous deux être à portée — c'est la hauteur qui
--- varie le plus, et c'est elle qui compte le moins.
---@param ax number
---@param ay number
---@param bx number
---@param by number
---@return number
function Ramassage.DistanceCarree(ax, ay, bx, by)
    local dx = (tonumber(ax) or 0) - (tonumber(bx) or 0)
    local dy = (tonumber(ay) or 0) - (tonumber(by) or 0)
    return dx * dx + dy * dy
end

--- Ce point est-il à portée de ramassage ?
---@param ax number
---@param ay number
---@param bx number
---@param by number
---@param portee number|nil  centimètres ; défaut PORTEE_CM
---@return boolean
function Ramassage.APortee(ax, ay, bx, by, portee)
    local p = tonumber(portee) or Ramassage.PORTEE_CM
    return Ramassage.DistanceCarree(ax, ay, bx, by) <= (p * p)
end

--- Parmi des candidats, le plus proche à portée — ou nil.
---
--- Rend nil plutôt que le premier venu : ramasser un objet qu'on ne regarde pas
--- est plus déroutant que de ne rien ramasser.
---@param candidats table[]  { { id, x, y, … } }
---@param x number
---@param y number
---@param portee number|nil
---@return table|nil
function Ramassage.PlusProche(candidats, x, y, portee)
    if (type(candidats) ~= "table") then return nil end
    local p = tonumber(portee) or Ramassage.PORTEE_CM
    local limite = p * p

    local meilleur, meilleure_d = nil, nil
    for i = 1, #candidats do
        local c = candidats[i]
        if (type(c) == "table") then
            local d = Ramassage.DistanceCarree(x, y, c.x, c.y)
            if (d <= limite and (meilleure_d == nil or d < meilleure_d)) then
                meilleur, meilleure_d = c, d
            end
        end
    end
    return meilleur
end

--- L'item du catalogue que vaut une étiquette d'entité, ou nil.
---
--- ── DEUX SOURCES, UNE SEULE RÉPONSE ───────────────────────────────────────────
--- `narvos_arme` porte un identifiant d'arme : il a son entrée dans le catalogue
--- d'objets, on la rend telle quelle.
--- `narvos_asset` porte un nom de MESH (`narvos::SM_Barrel`) : ce n'est pas un
--- identifiant d'objet. On le cherche parmi les items dont le `mesh` correspond ;
--- sans correspondance, l'entité n'est pas ramassable — et c'est juste, un décor
--- ne doit pas entrer dans un sac.
---@param etiquette string        "narvos_arme" | "narvos_asset"
---@param valeur any
---@param items table             le catalogue, { [id] = def }
---@return table|nil def
function Ramassage.ItemDe(etiquette, valeur, items)
    if (type(valeur) ~= "string" or valeur == "") then return nil end
    if (type(items) ~= "table") then return nil end

    if (etiquette == "narvos_arme") then
        if (items[valeur]) then return items[valeur] end
        for _, def in pairs(items) do
            if (def.arme == valeur) then return def end
        end
        return nil
    end

    if (etiquette == "narvos_asset") then
        -- Comparaison sur le nom NU, sans le préfixe de pack : le catalogue
        -- d'objets écrit tantôt « narvos::SM_X », tantôt « SM_X », et comparer
        -- les chaînes entières laisserait la moitié des correspondances de côté.
        local nu = valeur:match("::(.+)$") or valeur
        for id, def in pairs(items) do
            local m = def and def.mesh
            if (type(m) == "string") then
                if ((m:match("::(.+)$") or m) == nu) then return items[id] end
            end
        end
    end

    return nil
end

return Ramassage
