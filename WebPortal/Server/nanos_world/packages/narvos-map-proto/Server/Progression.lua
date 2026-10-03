-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Progression.lua — exécutant du NIVEAU, de l'XP et des TALENTS.
--
-- Câblage : Narvos.ProgressionServeur = Package.Require("Server/Progression.lua")
--           depuis Server/Index.lua, APRÈS Session, Sorts et Frappes.
--
-- ── LA DÉCISION EST AILLEURS ──────────────────────────────────────────────────
-- Courbe d'XP, cascade de niveaux, XP d'une victoire, statistiques dérivées,
-- règles de l'arbre de talents : `Shared/Logic/Progression.lua`, pur, prouvé
-- contre le TS exécuté (scripts/lua-harness/progression.mjs). Ici : lire la
-- session, écrire la base, poser PV / vitesse / mana sur le corps, prévenir la
-- page.
--
-- ── OÙ VIT L'ÉTAT ─────────────────────────────────────────────────────────────
-- Sur `s.perso` (`level`, `xp`, `talents`), relu de la base par
-- `Roster.depuisLigne`. Aucune table par joueur ici : rien à purger, rien qui
-- diverge de la fiche que les autres modules lisent déjà (Combat, Frappes,
-- Recolte lisent `perso.level`).
--
-- ── CE QUI FAIT GAGNER DE L'XP ────────────────────────────────────────────────
--   · une victoire : l'événement `Death` d'un Character ou CharacterSimple dont
--     l'`instigator` est un joueur (coups, sorts — `Server/Sorts.lua` transmet
--     désormais le lanceur) ;
--   · une quête terminée (`OctroyerRecompense`, Server/Index.lua) ;
--   · `/xp <montant>` pour l'essai, réservée à l'administration.
-- ═══════════════════════════════════════════════════════════════════════════════

local ProgressionServeur = {}

local Logique = Narvos.Progression
local Session = Narvos.SessionServeur

--- Valeur posée sur un PNJ pour DÉCLARER son niveau (sinon : bas de plage de sa
--- zone). Lue par la victoire ; aucun peuplement ne la pose encore.
ProgressionServeur.CLE_NIVEAU_PNJ = "narvos_niveau"

-- ── Utilitaires ───────────────────────────────────────────────────────────────
-- ⚠ DÉCLARÉS EN TÊTE : `local function` ne crée son nom qu'à sa ligne.

local Contexte, ClasseDe, Persister, Valide

--- Session et fiche d'un joueur en jeu, ou nil.
Contexte = function(player)
    if (not player or not Session or not Session.EnJeu(player)) then return nil, nil end
    local s = Session.De(player)
    if (not s or not s.perso or not s.compte) then return nil, nil end
    return s, s.perso
end

--- Classe réellement jouée : même ordre que `SortsServeur.Etat` (la fiche,
--- puis la valeur posée sur le corps) — la barre de sorts et la fiche ne
--- doivent pas décrire deux classes différentes.
ClasseDe = function(player, perso)
    if (perso and perso.classId) then return perso.classId end
    local c = player and player:GetControlledCharacter()
    local ok, v = pcall(function() return c and c:GetValue("narvos_class") end)
    return ok and v or nil
end

--- Écrit niveau, XP et talents. Un refus se DIT au journal : une progression
--- perdue à la reconnexion sans une ligne rouge est le défaut qu'on vient de
--- payer sur le sac (2026-09-14).
Persister = function(s, perso)
    local ok, raison = Narvos.Roster.EnregistrerProgression(
        s.compte.id, perso.id, perso.level, perso.xp, perso.talents)
    if (not ok) then
        Console.Error("[PROGRESSION] sauvegarde refusee pour " .. tostring(perso.name)
            .. " : " .. tostring(raison))
    end
    return ok
end

Valide = function(entite)
    if (not entite) then return false end
    local ok, v = pcall(function() return entite:IsValid() end)
    return ok and v == true
end

-- ── Statistiques appliquées ───────────────────────────────────────────────────

--- Statistiques du personnage d'un joueur (classe × niveau × talents), ou nil.
---@param player table
---@return table|nil
function ProgressionServeur.Statistiques(player)
    local _, perso = Contexte(player)
    if (not perso) then return nil end
    -- L'équipement porté (sac du serveur, `Narvos.EquipementDe`) entre dans les
    -- statistiques : PV, mana, puissance, défense, critique.
    local equipement = Narvos.EquipementDe and Narvos.EquipementDe(player) or nil
    return Logique.Statistiques(ClasseDe(player, perso), perso.level, perso.talents, equipement)
end

--- Bonus plats des talents pour `Combat.Statistiques` (défense, critique).
---@param player table
---@return table
function ProgressionServeur.BonusCombat(player)
    return Logique.BonusCombat(ProgressionServeur.Statistiques(player))
end

--- Pose PV max, vitesse et état de lancement sur le corps contrôlé.
--- `soigner` : PV et mana au maximum (apparition, passage de niveau — la
--- récompense de `addXp` côté web). Sans lui, les PV sont seulement bornés.
---@param player table
---@param soigner boolean
function ProgressionServeur.Appliquer(player, soigner)
    local stats = ProgressionServeur.Statistiques(player)
    local character = player and player:GetControlledCharacter()
    if (not stats or not Valide(character)) then return end

    pcall(function()
        character:SetMaxHealth(stats.vie_max)
        local vie = character:GetHealth()
        if (soigner or (type(vie) == "number" and vie > stats.vie_max)) then
            character:SetHealth(stats.vie_max)
        end
    end)

    -- ⚠ La vitesse d'un MONDE (Voyage : x40 en orbite) prime sur celle du
    -- personnage : on n'écrase qu'une vitesse de sol (≤ 1,5).
    pcall(function()
        local actuelle = tonumber(character:GetSpeedMultiplier()) or 1
        if (actuelle <= 1.5) then character:SetSpeedMultiplier(stats.vitesse) end
    end)

    local sorts = Narvos.SortsServeur
    local etat = sorts and sorts.Etat(player)
    if (etat) then
        Narvos.Sorts.Moduler(etat, Logique.ModificateursSorts(stats))
        if (soigner) then etat.mana = etat.mana_max end
        sorts.Envoyer(player)
    end
end

-- ── Vue pour la page ──────────────────────────────────────────────────────────

--- Tout ce qu'affiche le menu Personnage > Compétences, calculé ici.
---@param player table
---@return table|nil
function ProgressionServeur.Vue(player)
    local _, perso = Contexte(player)
    if (not perso) then return nil end
    local classe_id = ClasseDe(player, perso)
    local stats = Logique.Statistiques(classe_id, perso.level, perso.talents,
        Narvos.EquipementDe and Narvos.EquipementDe(player) or nil)
    local mods = Logique.ModificateursSorts(stats)

    -- Les pouvoirs de la classe, dans l'ordre de la barre : coût et dégâts
    -- MODULÉS (ceux que le lancement appliquera réellement), pas ceux du
    -- catalogue brut.
    local competences = {}
    local etat_cout = { cout_mult = mods.cout_mult }
    for emplacement, sort in ipairs(Narvos.Sorts.Barre(classe_id)) do
        if (sort) then
            local element = (Narvos.Elements and Narvos.Elements.ELEMENTS or {})[sort.element or ""] or {}
            competences[#competences + 1] = {
                emplacement = emplacement,
                id = sort.id,
                label = sort.label,
                description = sort.description,
                element = sort.element,
                element_label = element.label or sort.element,
                couleur = element.color or false,
                -- L'icône = l'image du sort à son plein (générateur des VFX).
                icone = Narvos.Sorts.IconePage(sort.id) or false,
                archetype = sort.archetype,
                degats = math.floor((tonumber(sort.damage) or 0) * mods.degats_mult + 0.5),
                degats_base = tonumber(sort.damage) or 0,
                soin = tonumber(sort.heal) or 0,
                cout = Narvos.Sorts.Cout(etat_cout, sort),
                recharge = tonumber(sort.cooldown) or 0,
                portee = tonumber(sort.range) or 0,
                zone = tonumber(sort.aoeRadius) or 0,
            }
        end
    end

    local classe = (Narvos.Classes.CLASSES or {})[classe_id or ""] or {}
    return {
        nom = perso.name,
        classe = { id = classe_id, label = classe.label or classe_id, element = classe.element, role = classe.role },
        fiche = Logique.Fiche({ niveau = perso.level, xp = perso.xp }),
        stats = stats and {
            vie_max = stats.vie_max, mana_max = stats.mana_max, puissance = stats.puissance,
            defense = stats.defense, critique = stats.critique,
            vitesse = math.floor(stats.vitesse * 100 + 0.5) / 100,
            degats_sorts = math.floor(mods.degats_mult * 100 + 0.5) / 100,
        } or false,
        talents = Logique.VueTalents(perso.level, perso.talents),
        competences = competences,
    }
end

---@param player table
function ProgressionServeur.Envoyer(player)
    local vue = ProgressionServeur.Vue(player)
    if (not vue) then return end
    Events.CallRemote("Narvos:Progression", player, Reliability.Reliable, vue)
end

-- ── Gains ─────────────────────────────────────────────────────────────────────

--- Octroie de l'XP au personnage d'un joueur. Rend les niveaux gagnés.
---@param player table
---@param montant number
---@param raison string  "victoire" | "quete" | "admin"
---@return integer
function ProgressionServeur.GagnerXP(player, montant, raison)
    local s, perso = Contexte(player)
    local gain = math.floor(tonumber(montant) or 0)
    if (not perso or gain <= 0) then return 0 end

    local avant = Logique.Normaliser({ niveau = perso.level, xp = perso.xp })
    local apres, niveaux = Logique.AjouterXP(avant, gain)
    if (apres.niveau == avant.niveau and apres.xp == avant.xp) then return 0 end -- niveau max

    perso.level, perso.xp = apres.niveau, apres.xp
    Persister(s, perso)

    if (niveaux > 0) then
        ProgressionServeur.Appliquer(player, true)
        local vue = Logique.VueTalents(perso.level, perso.talents)
        Chat.SendMessage(player, "<yellow>Niveau " .. perso.level .. " !</>"
            .. ((vue.disponibles > 0) and (" <cyan>" .. vue.disponibles .. " point(s) de talent</> a depenser") or ""))
    end

    Events.CallRemote("Narvos:XP", player, Reliability.Reliable, {
        xp_gagnee = gain,
        niveaux = niveaux,
        raison = raison,
        fiche = Logique.Fiche(apres),
    })
    if (niveaux > 0) then ProgressionServeur.Envoyer(player) end
    return niveaux
end

-- ── Victoires ─────────────────────────────────────────────────────────────────

--- XP d'une victoire : le niveau DÉCLARÉ du vaincu, sinon le bas de plage de sa
--- zone (identifiant de monde, `Mondes.ParPosition`).
local function SurMort(victime, _degats, _os, _type, _direction, instigator)
    if (not Valide(instigator)) then return end

    -- Un corps tenu par un joueur ne rapporte rien : pas d'XP de joueur contre
    -- joueur, que le web n'avait pas non plus.
    local ok_j, joueur = pcall(function() return victime:GetPlayer() end)
    if (ok_j and joueur) then return end

    local zone = nil
    pcall(function()
        local m = Narvos.Mondes.ParPosition(victime:GetLocation())
        zone = m and m.id
    end)
    local declare = nil
    pcall(function() declare = victime:GetValue(ProgressionServeur.CLE_NIVEAU_PNJ) end)

    local niveau = Logique.NiveauEnnemi(zone, declare)
    ProgressionServeur.GagnerXP(instigator, Logique.XpPourVictoire(niveau), "victoire")
end

Character.Subscribe("Death", SurMort)
if (CharacterSimple) then CharacterSimple.Subscribe("Death", SurMort) end

-- ── Apparition ────────────────────────────────────────────────────────────────

--- Tout corps possédé reçoit les statistiques de son personnage : apparition,
--- changement de classe. Un seul point d'entrée plutôt qu'un appel recopié
--- dans chaque chemin de spawn (il y en a quatre).
Player.Subscribe("Possess", function(player, pawn)
    if (not Contexte(player)) then return end
    local ok, humain = pcall(function() return pawn:IsA(Character) end)
    if (not ok or not humain) then return end
    ProgressionServeur.Appliquer(player, true)
    ProgressionServeur.Envoyer(player)
end)

-- ── Talents ───────────────────────────────────────────────────────────────────

local function Modifier(player, geste, talent_id)
    local s, perso = Contexte(player)
    if (not perso) then return end
    if (talent_id ~= nil and type(talent_id) ~= "string") then return end

    local ok, resultat = Logique.ModifierTalents(perso.level, perso.talents, geste, talent_id)
    if (not ok) then
        Events.CallRemote("Narvos:ProgressionErreur", player, Reliability.Reliable, resultat)
        return
    end
    perso.talents = resultat
    Persister(s, perso)
    ProgressionServeur.Appliquer(player, false)
    ProgressionServeur.Envoyer(player)
end

Events.SubscribeRemote("Narvos:DemanderProgression", function(player)
    if (not Contexte(player)) then return end
    ProgressionServeur.Envoyer(player)
end)
Events.SubscribeRemote("Narvos:InvestirTalent", function(player, talent_id)
    Modifier(player, "investir", talent_id)
end)
Events.SubscribeRemote("Narvos:RembourserTalent", function(player, talent_id)
    Modifier(player, "rembourser", talent_id)
end)
Events.SubscribeRemote("Narvos:ReinitialiserTalents", function(player)
    Modifier(player, "reinitialiser", nil)
end)

Console.Log(("[PROGRESSION] niveaux et talents prets — niveau max %d, XP victoire niveau 1 : %d, %d talents")
    :format(Logique.NiveauMax(), Logique.XpPourVictoire(1), #(Narvos.Talents.TALENTS or {})))

return ProgressionServeur