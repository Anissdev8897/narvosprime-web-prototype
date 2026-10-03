-- ══════════════════════════════════════════════════════════════════════════════
-- Server/Ramassage.lua — la coquille moteur du ramassage.
--
-- Câblage : Narvos.RamassageServeur = Package.Require("Server/Ramassage.lua")
--           puis Narvos.RamassageServeur.Configurer{ grille = …, ecrire = … }
--
-- La DÉCISION vit dans `narvos/Shared/Logic/Ramassage.lua` — portée, plus proche
-- candidat, conversion étiquette → objet — et se teste hors moteur. Ce fichier-ci
-- ne fait que parler à nanos : énumérer les entités, lire leurs valeurs, les
-- détruire.
--
-- ── CE QU'IL REND POSSIBLE, ET QUI N'EXISTAIT PAS ─────────────────────────────
-- Mesuré le 2026-09-12 : aucun mécanisme de ramassage dans tout le projet. Les
-- objets posés par `/prop` ou `/arme` restaient du décor, et le sac ne se
-- remplissait que par le butin des zones. Hanibes l'a signalé trois fois.
-- ══════════════════════════════════════════════════════════════════════════════

local RamassageServeur = {}

-- ── Injections — déclarées EN TÊTE ───────────────────────────────────────────
-- Une table lue avant sa déclaration vaut nil pour toujours, et c'est muet :
-- cinq diagnostics l'ont déjà coûté sur ce projet.
local obtenir_grille = nil   -- (player) -> grille | nil
local ecrire_grille = nil    -- (player, grille) -> ()

--- Branche ce module sur l'inventaire du serveur.
---
--- L'inventaire vit dans une table locale de `Server/Index.lua` : l'exposer
--- globalement pour ce seul usage donnerait deux chemins d'écriture vers la
--- même grille, et c'est ainsi qu'on perd du butin.
---@param options table  { grille = function(player), ecrire = function(player, grille) }
function RamassageServeur.Configurer(options)
    if (type(options) ~= "table") then return end
    if (type(options.grille) == "function") then obtenir_grille = options.grille end
    if (type(options.ecrire) == "function") then ecrire_grille = options.ecrire end
end

--- Les entités ramassables autour d'un point.
---
--- ⚠ `Weapon` ET `Prop`, séparément. nanos n'offre pas d'énumération commune, et
--- `Entity.GetAll()` rendrait aussi les personnages, les véhicules et le décor —
--- on parcourrait des milliers d'entités à chaque pression de touche.
---@param x number
---@param y number
---@return table[]  { { entite, etiquette, valeur, x, y } }
local function CandidatsAutour(x, y, z, dimension)
    local Logique = Narvos.Ramassage
    local sortie = {}

    local classes = {
        { classe = Weapon, etiquette = "narvos_arme" },
        { classe = Melee, etiquette = "narvos_arme" },
        { classe = Grenade, etiquette = "narvos_arme" },
        { classe = Prop,   etiquette = "narvos_asset" },
    }

    for _, c in ipairs(classes) do
        -- `pcall` : une classe absente d'une version du client ne doit pas tuer
        -- le gestionnaire — le ramassage marcherait alors pour personne.
        local ok, entites = pcall(function() return c.classe.GetAll() end)
        if (ok and type(entites) == "table") then
            for _, e in pairs(entites) do
                local valide = e and e.IsValid and e:IsValid()
                if (valide and (e:GetValue("narvos_ramasse", false) or e:GetDimension() ~= dimension)) then valide = false end
                if (valide and c.classe ~= Prop and e:GetHandler()) then valide = false end
                -- ⚠ Une arme équipée depuis le sac n'en est que la projection :
                -- la ramasser dupliquerait l'objet (Logic/Ramassage.lua).
                if (valide and not Logique.EstRamassable(e:GetValue(Logique.MARQUE_PROJECTION, false))) then
                    valide = false
                end
                if (valide) then
                    local etiquette = e:GetValue(c.etiquette, nil)
                    if (etiquette ~= nil) then
                        local p = e:GetLocation()
                        local d2 = p and (Logique.DistanceCarree(x, y, p.X, p.Y) + (z - p.Z)^2)
                        if (d2 and d2 <= Logique.PORTEE_CM^2 and Logique.ItemDe(c.etiquette, tostring(etiquette), Narvos.Items.ITEM_DB)) then
                            sortie[#sortie + 1] = {
                                entite = e, etiquette = c.etiquette,
                                valeur = etiquette, x = p.X, y = p.Y,
                            }
                        end
                    end
                end
            end
        end
    end
    return sortie
end

--- Tente de ramasser l'objet le plus proche. Rend (ok, message).
---@param player table
---@return boolean, string
function RamassageServeur.Ramasser(player, entite_visee)
    if (player == nil) then return false, "aucun joueur" end
    if (Narvos.SessionServeur and not Narvos.SessionServeur.EnJeu(player)) then return false, "hors jeu" end
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "interaction")) then return false, "interaction bloquée" end
    if (obtenir_grille == nil) then
        return false, "ramassage non configure"
    end

    local character = player:GetControlledCharacter()
    if (not character or not character:IsValid()) then
        return false, "aucun personnage"
    end

    local grille = obtenir_grille(player)
    if (grille == nil) then return false, "aucun sac" end

    local pos = character:GetLocation()
    local candidats = CandidatsAutour(pos.X, pos.Y, pos.Z, character:GetDimension())
    if (#candidats == 0) then return false, "rien a portee" end

    local choisi = Narvos.Ramassage.PlusProche(candidats, pos.X, pos.Y)
    if (entite_visee) then
        choisi = nil
        for _, candidat in ipairs(candidats) do
            if (candidat.entite == entite_visee) then choisi = candidat; break end
        end
    end
    if (choisi == nil) then return false, "rien a portee" end

    local def = Narvos.Ramassage.ItemDe(
        choisi.etiquette, tostring(choisi.valeur), Narvos.Items.ITEM_DB)
    if (def == nil) then
        return false, "cet objet ne se range pas (" .. tostring(choisi.valeur) .. ")"
    end

    -- ⚠ `AddItemToGrid` est IMMUABLE : il rend une NOUVELLE grille, ou nil si ca
    -- ne rentre pas. Lire son retour comme un booleen sans reassigner laisse le
    -- sac vide pour toujours, sans la moindre erreur.
    local suivante = Narvos.Inventory.AddItemToGrid(grille, def, 1)
    if (suivante == nil) then
        return false, "sac plein"
    end

    -- L'ECRITURE D'ABORD, LA DESTRUCTION ENSUITE. Dans l'ordre inverse, un echec
    -- d'ecriture ferait disparaitre l'objet du monde ET du sac.
    if (not ecrire_grille or ecrire_grille(player, suivante) ~= true) then return false, "sauvegarde du sac refusée" end
    -- Empêche une deuxième interaction pendant que nanos termine la première.
    choisi.entite:SetValue("narvos_ramasse", true, false)
    Timer.SetTimeout(function()
        if (choisi.entite:IsValid()) then choisi.entite:Destroy() end
    end, 100)

    return true, tostring(def.label or def.id)
end

--- Marque une entité comme PROJECTION d'un objet du sac.
--- À appeler par qui équipe un objet sans le retirer du sac (la roue).
---@param entite table
function RamassageServeur.MarquerProjection(entite)
    if (not entite or not entite:IsValid()) then return end
    -- `sync = false` : la marque ne sert qu'au serveur, qui seul décide du
    -- ramassage ; la répliquer coûterait une valeur par arme, pour rien.
    entite:SetValue(Narvos.Ramassage.MARQUE_PROJECTION, true, false)
end

-- ── Le lâcher : une projection ne reste jamais au sol ─────────────────────────
--
-- `Drop` couvre les TROIS portes d'un coup : la touche T (`RetirerEquipement`),
-- la mort (nanos lâche l'arme tenue) et le lâcher natif. Traiter le seul
-- `RetirerEquipement` laisserait les deux autres ouvertes à la duplication — et à
-- une arme utilisable ramassée d'une main étrangère par le ramassage natif.
Character.Subscribe("Drop", function(_, objet)
    if (not objet or not objet.IsValid or not objet:IsValid()) then return end
    local marque = objet:GetValue(Narvos.Ramassage.MARQUE_PROJECTION, false)
    if (Narvos.Ramassage.SortDuLacher(marque) ~= "detruire") then return end
    -- Différé de 100 ms, comme `Weapons.Donner` : détruire DANS le gestionnaire
    -- de Drop détruirait l'entité pendant que le moteur finit de la détacher.
    Timer.SetTimeout(function()
        if (objet:IsValid()) then objet:Destroy() end
    end, 100)
end)

-- Interact est annulable côté serveur (BasePickable officiel). PickUp arrive
-- trop tard : l'arme serait déjà dans la main. Les appels d'équipement explicites
-- Character:PickUp ne sont pas des interactions au sol.
local function IntercepterRamassage(objet, character)
    local player = character and character:GetPlayer()
    if (not player) then return end
    local ok, message = RamassageServeur.Ramasser(player, objet)
    Chat.SendMessage(player, (ok and "<cyan>Dans le sac : " or "<grey>") .. tostring(message) .. "</>")
    return false
end
Weapon.Subscribe("Interact", IntercepterRamassage)
Melee.Subscribe("Interact", IntercepterRamassage)
Grenade.Subscribe("Interact", IntercepterRamassage)

return RamassageServeur