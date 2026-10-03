-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/MetaHumainBP.lua — PILOTER le Meta Customization System au lieu de le
-- réimplémenter.
--
-- Câblage : Narvos.MetaHumainBP = Package.Require("Server/MetaHumainBP.lua")
--           depuis Server/Index.lua.
--
-- ── POURQUOI CE MODULE EXISTE ────────────────────────────────────────────────
-- Mesuré le 2026-09-12, et c'est ce que Hanibes répétait depuis deux jours :
--
--   · `Blueprint:CallBlueprintEvent(nom, ...)` est d'autorité BOTH — le SERVEUR
--     peut déclencher la logique d'un Blueprint Unreal
--     (libraries/api-main/api-main/Stable/Classes/Blueprint.json) ;
--   · ⚠ CORRIGÉ LE 2026-09-13 : cette ligne affirmait `BP_Playable_MH`,
--     `BP_MH_Male_Playable` et `BP_MH_Playable_Female1` « cuits ET déclarés ».
--     Relu dans Assets.toml : AUCUN des trois n'y est (parent
--     `BP_ThirdPersonCharacter` jamais promu). Les porteurs réellement déclarés
--     sont `BP_MH_Male` et `BP_MH_Female`, et ils viennent du catalogue
--     (`Modular.CORPS`, champ `blueprint`) — voir `MetaHumainBP.PorteurDe` ;
--   · ces Blueprints DÉRIVENT DE CHARACTER et portent Body, Face, Torso, Legs,
--     Feet, Prop, Orc_Teeth, LODSync et six Grooms (cheveux, barbe, sourcils,
--     cils, duvet, moustache) ;
--   · leur table de noms expose Change_Top, Change_Bottoms, Change_Shoes,
--     Change_Outfit, Change_Hair, Change_Hair_Colour, Change_Eyes, Change_Skin,
--     Change_Skin_Mat, Change_Skin_Tint, Change_Tattoo, Change_face, plus des
--     curseurs (FaceTypeSlider, EyeBrow_Slider, Eye_Color_Inner_Value).
--     Relevé complet : .hermes/API_BP_METACUSTOM_2026-09-12.md
--
-- Le pont par retarget (Server/MetaHumain.lua) pose des meshes un par un, et il
-- marche — vu en jeu le 11/09. Mais il refait à la main ce que le système acheté
-- sait déjà faire. Ce module-ci lui parle.
--
-- ── ⚠ CE QUE CE MODULE NE PEUT PAS PROUVER TOUT SEUL ─────────────────────────
-- `CallBlueprintEvent` ne rend ses valeurs QUE côté client : un appel serveur ne
-- dit pas s'il a trouvé l'événement, et un nom FAUX ne lève rien. Les noms
-- ci-dessous sont des CANDIDATS lus dans le paquet, pas une API publiée.
--
-- C'est pourquoi ce module est un OUTIL D'ESSAI réservé aux administrateurs, et
-- qu'il journalise chaque appel : le verdict se lit à l'écran, pas ici.
-- ═══════════════════════════════════════════════════════════════════════════════

local MetaHumainBP = {}

-- ── État — tables par personnage, DÉCLARÉES EN TÊTE ──────────────────────────
-- Une table déclarée après sa première lecture vaut nil pour toujours, et c'est
-- muet : cinq diagnostics l'ont déjà coûté sur ce projet.
local acteurs = {}   -- character -> Blueprint posé
local caches = {}    -- character -> true si le mesh nanos est masqué

-- Rotation du mesh nanos dans sa capsule, reprise de Logic/Character.lua : elle
-- est passée explicitement pour ne pas dépendre d un défaut déjà corrigé une fois.
local ROTATION_MESH = Rotator(0, -90, 0)

--- Le constructeur partagé (narvos/Shared/Logic/Character.lua) : le SEUL endroit
--- qui sait masquer et rendre le porteur. Lu à l'appel, jamais au chargement.
local function Constructeur()
    return Narvos and Narvos.CharacterBuilder
end

--- Le porteur d'un genre, LU DANS LE CATALOGUE : le premier corps jouable de
--- `Modular.JOUABLES` qui porte un `blueprint` et ce genre ; à défaut, le premier
--- corps jouable Blueprint, quel que soit son genre ; sinon nil.
---
--- ⚠ CE QUI ÉTAIT ÉCRIT ICI AVANT LE 2026-09-13 : une table en dur,
--- `BP_Playable_MH` / `BP_MH_Male_Playable` / `BP_MH_Playable_Female1`. Aucun des
--- trois n'est dans Assets.toml — leur parent `BP_ThirdPersonCharacter` n'a jamais
--- été promu, et la création est passée aux Blueprints à parent natif
--- (`BP_MH_Male`, `BP_MH_Female`). La table, elle, n'avait pas suivi : `/mhbp`
--- sans argument posait un Blueprint absent. Trouvé par le contrôle « Citations
--- Lua » du vérificateur, le soir même où il a été écrit. Une copie du catalogue
--- diverge toujours de sa source (CLAUDE.md) : on itère la source.
---@param genre any  "M", "F" ou nil
---@return string|nil
function MetaHumainBP.PorteurDe(genre)
    local Modular = Narvos and Narvos.Modular
    if (not Modular or type(Modular.JOUABLES) ~= "table" or type(Modular.CORPS) ~= "table") then
        return nil
    end
    local voulu = (genre ~= nil) and tostring(genre):upper() or nil
    local repli = nil
    for _, id in ipairs(Modular.JOUABLES) do
        local corps = Modular.CORPS[id]
        local bp = corps and corps.blueprint
        if (type(bp) == "string" and bp ~= "") then
            if (voulu == nil or corps.genre == voulu) then return bp end
            repli = repli or bp
        end
    end
    return repli
end

--- Événements CANDIDATS, relevés dans la table de noms des paquets.
--- `arg` dit ce que l appel semble attendre d après son nom — à confirmer en jeu.
MetaHumainBP.EVENEMENTS = {
    { nom = "Change_Top",              arg = "indice" },
    { nom = "Change_Bottoms",          arg = "indice" },
    { nom = "Change_Shoes",            arg = "indice" },
    { nom = "Change_Outfit",           arg = "indice" },
    { nom = "Change_Prop",             arg = "indice" },
    { nom = "Change_Hair",             arg = "indice" },
    { nom = "Change_Hair_Colour",      arg = "indice" },
    { nom = "Change_Eyes",             arg = "indice" },
    { nom = "Change_Skin",             arg = "indice" },
    { nom = "Change_Skin_Mat",         arg = "indice" },
    { nom = "Change_Skin_Tint",        arg = "valeur" },
    { nom = "Change_Skin_Color_Value", arg = "valeur" },
    { nom = "Change_Tattoo",           arg = "indice" },
    { nom = "Change_face",             arg = "indice" },
}

local par_nom = {}
for _, e in ipairs(MetaHumainBP.EVENEMENTS) do par_nom[e.nom:lower()] = e end

--- Un événement du relevé, par son nom (insensible à la casse), ou nil.
---@param nom any
---@return table|nil
function MetaHumainBP.Evenement(nom)
    if (type(nom) ~= "string") then return nil end
    return par_nom[nom:lower()]
end

-- ── Poser et retirer ─────────────────────────────────────────────────────────

--- Détruit le Blueprint posé, SANS toucher au mesh nanos. Rend true s il y en avait un.
local function DetruireActeur(character)
    local bp = acteurs[character]
    acteurs[character] = nil
    if (bp == nil) then return false end
    if (bp:IsValid()) then bp:Destroy() end
    return true
end

--- Rend le mesh nanos visible (matériaux d origine compris).
local function RendreMesh(character)
    local B = Constructeur()
    if (B and B.RendrePorteur) then
        B.RendrePorteur(character)
    else
        pcall(function() character:SetMeshSettings(Vector(0, 0, 0), ROTATION_MESH, true) end)
    end
end

--- Retire le Blueprint d un personnage ET lui rend son mesh. Rend true s il y
--- avait un Blueprint.
---
--- ⚠ Un Blueprint posé veut dire un porteur MASQUÉ (`HabillerBlueprint` le masque
--- avant la pose). Jusqu au 2026-09-13, cette fonction ne le rendait que si
--- `/mhbp cacher` avait servi — et passait alors `Vector(1, 1, 1)` comme
--- « échelle » (c est la POSITION relative, BasePawn.json) avec `false` : elle
--- RE-CACHAIT. Quitter un corps MetaHuman laissait un personnage invisible.
---@param character table|nil
---@return boolean
function MetaHumainBP.Retirer(character)
    if (character == nil) then return false end
    local masque = caches[character]
    caches[character] = nil
    local avait = DetruireActeur(character)
    if (avait or masque) then RendreMesh(character) end
    if (avait) then Console.Log("[MHBP] porteur retire") end
    return avait
end

--- Pose le Blueprint du système sur un personnage et l y attache.
---
--- ⚠ ATTACHÉ À `root`, comme le pont : c est l os que les 68 du squelette nanos
--- portent tous. Un os inventé ne lève rien et colle l acteur à l origine.
---@param character table|nil
---@param genre any  "M", "F" ou nil pour le porteur mixte
---@param chemin_force string|nil  chemin d un Blueprint, prioritaire sur `genre`
---@return boolean, string|nil
function MetaHumainBP.Poser(character, genre, chemin_force)
    if (character == nil or not character:IsValid()) then
        return false, "aucun personnage"
    end

    -- ── LE CATALOGUE PASSE AVANT LA TABLE LOCALE ─────────────────────────────
    -- Depuis que les corps MetaHuman sont des entrees de `Modular.CORPS`
    -- (champ `blueprint`, genere le 2026-09-12), c est le CATALOGUE qui dit
    -- quel Blueprint porte quel corps. `PorteurDe` ne sert qu a la commande
    -- d essai `/mhbp`, ou aucun corps n est choisi — et lit ce meme catalogue.
    local chemin = chemin_force or MetaHumainBP.PorteurDe(genre)
    if (chemin == nil) then
        return false, "aucun corps jouable Blueprint dans Modular.JOUABLES"
    end
    -- ── LE MÊME BLUEPRINT RESTE ─────────────────────────────────────────────
    -- L'écran de création rappelle `Habiller` à CHAQUE curseur tiré. Recréer le
    -- Blueprint à chaque pas rechargerait le MetaHuman entier et le ferait
    -- clignoter : s'il porte déjà ce chemin, on le garde — l'apparence change
    -- par la valeur `narvos_mcs` (MetaHumainBP.Apparence), pas par une repose.
    local deja = acteurs[character]
    if (deja and deja:IsValid()) then
        local ok_c, pose = pcall(function() return deja:GetValue("narvos_blueprint") end)
        if (ok_c and pose == chemin) then return true, chemin end
    end

    -- ⚠ DÉTRUIRE, PAS `Retirer` : l appelant (`HabillerBlueprint`) vient de
    -- masquer le porteur. `Retirer` le rendrait, et le mannequin nanos
    -- réapparaîtrait SOUS le nouveau MetaHuman à chaque changement de corps.
    DetruireActeur(character)

    local ok, bp = pcall(function()
        return Blueprint(character:GetLocation(), character:GetRotation(),
            chemin, CollisionType.NoCollision)
    end)
    if (not ok or not bp) then
        Console.Error("[MHBP] Blueprint refuse : " .. tostring(chemin) .. " — " .. tostring(bp))
        return false, "Blueprint refuse : " .. tostring(chemin)
    end

    -- `AttachTo` rend `attached_successfully` (BaseActor.json). Ignoré jusqu au
    -- 2026-09-13 : un acteur non attaché reste à son point de spawn et ne suit
    -- rien — le MetaHuman « ne bouge pas », et on accuserait le retarget.
    -- `lifespan_when_detached = 0` : détaché, il est DÉTRUIT (BaseActor.json).
    -- Avec le défaut -1, un personnage détruit sans `Retirer` (déconnexion,
    -- changement de classe) laissait son MetaHuman debout, figé : rapport client
    -- du 2026-09-14, deux `BP_NarvosMH_F` superposés dont un non attaché.
    local appel, attache = pcall(function()
        return bp:AttachTo(character, AttachmentRule.SnapToTarget, "root", 0)
    end)
    acteurs[character] = bp
    -- Nomme l'entite pour le client (`/diag`, Client/Diagnostic.lua) : aucun
    -- accesseur ne rend l'asset d'un Blueprint cote client.
    pcall(function() bp:SetValue("narvos_blueprint", chemin, true) end)
    Console.Log("[MHBP] porteur pose : " .. tostring(chemin)
        .. " (attached=" .. tostring(appel and attache) .. ")")
    if (not appel or attache == false) then
        Console.Error("[MHBP] AttachTo a ECHOUE pour " .. tostring(chemin) .. " : " .. tostring(attache))
    end
    return true, chemin
end

--- Masque ou rend le mesh nanos sous le porteur.
---@param character table|nil
---@param cacher boolean
---@return boolean
function MetaHumainBP.Cacher(character, cacher)
    if (character == nil or not character:IsValid()) then return false end
    if (not cacher) then
        RendreMesh(character)
        caches[character] = nil
        return true
    end
    -- La méthode commune (Logic/Character.lua). Avant le 2026-09-13 : un vecteur
    -- d « échelle » passé comme position, et `false` dans les DEUX sens.
    local B = Constructeur()
    local methode = (B and B.MasquerPorteur) and B.MasquerPorteur(character) or "echec"
    Console.Log("[MHBP] porteur masque par " .. tostring(methode))
    caches[character] = (methode ~= "echec") or nil
    return methode ~= "echec"
end

-- ── Appeler ──────────────────────────────────────────────────────────────────

--- Déclenche un événement du Blueprint posé.
---
--- ⚠ LE RETOUR NE DIT RIEN DU SUCCÈS. `CallBlueprintEvent` ne rend ses valeurs
--- que côté client ; côté serveur, un nom inconnu passe sans un mot. Ce `true`
--- signifie « l appel est parti », jamais « l événement existe ».
---@param character table|nil
---@param evenement any
---@param valeur any  nombre ou chaîne, optionnel
---@return boolean, string|nil
function MetaHumainBP.Appeler(character, evenement, valeur)
    local bp = character and acteurs[character]
    if (bp == nil or not bp:IsValid()) then
        return false, "aucun porteur pose — /mhbp poser"
    end
    if (type(evenement) ~= "string" or evenement == "") then
        return false, "evenement requis"
    end

    local envoye
    if (valeur == nil) then
        envoye = pcall(function() bp:CallBlueprintEvent(evenement) end)
    else
        envoye = pcall(function() bp:CallBlueprintEvent(evenement, valeur) end)
    end
    Console.Log("[MHBP] appel " .. evenement .. " (" .. tostring(valeur) .. ") : "
        .. (envoye and "parti" or "refuse par le moteur"))
    if (not envoye) then return false, "appel refuse par le moteur" end
    return true, "appel parti — le verdict est A L ECRAN"
end

--- Ce qui est posé sur un personnage : le porteur, et si le mesh nanos est caché.
---@param character table|nil
---@return boolean, boolean
function MetaHumainBP.Etat(character)
    local bp = character and acteurs[character]
    if (bp == nil or not bp:IsValid()) then return false, false end
    return true, caches[character] == true
end

--- Pose l'apparence du Meta Customization System sur le Blueprint du personnage.
---
--- Une valeur SYNCHRONISÉE (`narvos_mcs`), pas un appel : `CallBlueprintEvent`
--- côté serveur n'atteindrait pas un client qui arrive après, et le rendu est de
--- toute façon local à chaque client. Client/MetaCustom.lua lit la valeur à
--- l'apparition du Blueprint et à chaque changement, et joue les appels
--- `Narvos*` que `Logic/MetaCustom.Operations` en déduit.
---@param character table|nil
---@param apparence table  apparence NORMALISÉE
---@return boolean
function MetaHumainBP.Apparence(character, apparence)
    local bp = character and acteurs[character]
    if (bp == nil or not bp:IsValid() or type(apparence) ~= "table") then return false end
    local ok = pcall(function() bp:SetValue("narvos_mcs", apparence, true) end)
    return ok
end

--- Nettoyage : appelé quand un joueur part ou change de personnage.
---@param character table|nil
function MetaHumainBP.Oublier(character)
    MetaHumainBP.Retirer(character)
end

-- ── Un personnage détruit emporte son MetaHuman ──────────────────────────────
-- `Oublier` n'était appelé que pour l'aperçu de création. Déconnexion
-- (Server/Index.lua), changement de classe, échec de `ApplyClass` : trois
-- `Destroy()` sans nettoyage, trois MetaHumans orphelins, et les tables
-- `acteurs`/`caches` gardaient des entités mortes. Pas de `Retirer` ici : le
-- porteur n'existe plus, lui rendre son mesh n'a pas de sens.
Character.Subscribe("Destroy", function(character)
    if (acteurs[character] == nil and caches[character] == nil) then return end
    caches[character] = nil
    DetruireActeur(character)
end)

return MetaHumainBP