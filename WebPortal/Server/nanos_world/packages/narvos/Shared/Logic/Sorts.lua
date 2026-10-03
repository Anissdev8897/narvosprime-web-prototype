-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Sorts.lua — lancer un pouvoir : coût, recharge, mise en scène.
--
-- Câblage : Narvos.Sorts = Package.Require("Logic/Sorts.lua")
--
-- ── CE QUE CE FICHIER FAIT, ET CE QU'IL NE FAIT PAS ───────────────────────────
-- Il DÉCIDE : le sort existe-t-il, la classe y a-t-elle droit, la recharge
-- est-elle écoulée, le mana suffit-il — et il rend un PLAN de mise en scène.
-- Il ne spawne rien, ne joue aucune particule, ne touche à aucune entité nanos.
--
-- C'est ce qui le rend testable hors moteur (wasmoon, env node, zéro DOM), là où
-- une fonction qui appellerait `Particle(...)` ne le serait pas. Le côté impur
-- vit dans `Server/Sorts.lua`, qui consomme le plan.
--
-- ── LE TEMPS EST UN PARAMÈTRE, PAS UNE LECTURE D'HORLOGE ──────────────────────
-- Aucune fonction ici n'appelle `os.time()` ni `os.clock()`. `os.time()` est en
-- SECONDES : une recharge de 1 s y serait indistinguable de 0. Et une horloge
-- lue à l'intérieur rendrait chaque test dépendant du moment où il tourne.
-- L'appelant passe `maintenant` (secondes, décimales) ; le serveur l'obtient
-- d'un accumulateur monotone piloté par Timer.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosSorts
local Sorts = {}

local Spells = (Narvos and Narvos.Spells) or Package.Require("Catalogs/Spells.lua")
local Classes = (Narvos and Narvos.Classes) or Package.Require("Catalogs/Classes.lua")
local Vfx = (Narvos and Narvos.Vfx) or Package.Require("Catalogs/Vfx.lua")
local SortsVfx = (Narvos and Narvos.SortsVfx) or Package.Require("Catalogs/SortsVfx.lua")

-- ── Mise en scène (2026-09-14) ─────────────────────────────────────────────────
-- Retour de jeu : « effets 3D du pack, les images 2D pour l'ICÔNE des sorts ». Le
-- billboard 2D animé du jour même est retiré ; les images web ne servent plus
-- qu'aux icônes (`IconePage`), les effets en jeu sont des particules 3D.

--- Vitesse d'un projectile dont le catalogue ne donne aucune (`speed = 0`) mais
--- qui doit quand même VOYAGER : un sort qui apparaît sur la cible sans trajet ne
--- se lit pas comme lancé. 18 m/s : entre les 14 et 30 m/s du catalogue.
Sorts.VITESSE_DEFAUT_CM_S = 1800

--- Borne du temps de vol : au-delà, l'impact arriverait après que le joueur a
--- décroché ; en deçà de 80 ms, le trajet ne se voit plus.
Sorts.VOL_MIN_S = 0.08
Sorts.VOL_MAX_S = 1.5

--- Emplacements de la barre. Fixé par `Commandes.ACTIONS` (`sort_1`..`sort_4`) :
--- les deux doivent bouger ensemble, sinon une touche pointerait dans le vide.
Sorts.EMPLACEMENTS = 4

-- ── Lecture du catalogue ──────────────────────────────────────────────────────

local par_id = {}
for _, s in ipairs(Spells.SPELL_CATALOG or {}) do par_id[s.id] = s end

---@param sort_id any
---@return table|nil
function Sorts.Trouver(sort_id)
    if (type(sort_id) ~= "string") then return nil end
    return par_id[sort_id]
end

--- Sorts d'une classe, dans l'ordre du catalogue.
---
--- ⚠ ON PARCOURT `SPELL_CATALOG` EN `ipairs`, jamais `par_id` en `pairs` :
--- l'ordre de `pairs` n'est pas garanti et diffère d'une VM à l'autre. La barre
--- de sorts changerait d'ordre entre le serveur et le client.
---@param class_id any
---@return table
function Sorts.ParClasse(class_id)
    local sortie = {}
    if (type(class_id) ~= "string") then return sortie end
    for _, s in ipairs(Spells.SPELL_CATALOG or {}) do
        if (s.classId == class_id) then sortie[#sortie + 1] = s end
    end
    return sortie
end

--- Barre de sorts : `EMPLACEMENTS` cases, garnies par la classe.
--- Les cases vides valent `false` et non `nil` — un `nil` disparaîtrait de la
--- table et `#barre` ne dirait plus rien.
---@param class_id any
---@return table
function Sorts.Barre(class_id)
    local liste = Sorts.ParClasse(class_id)
    local barre = {}
    for i = 1, Sorts.EMPLACEMENTS do
        barre[i] = liste[i] or false
    end
    return barre
end

--- Sort occupant un emplacement (1..EMPLACEMENTS), ou nil.
---@param class_id any
---@param emplacement any
---@return table|nil
function Sorts.ParEmplacement(class_id, emplacement)
    local n = tonumber(emplacement)
    if (not n or n < 1 or n > Sorts.EMPLACEMENTS) then return nil end
    local sort = Sorts.Barre(class_id)[math.floor(n)]
    return sort or nil
end

-- ── État de lancement ─────────────────────────────────────────────────────────

--- Mana par défaut d'une classe, repris de ses statistiques de base.
--- Une classe inconnue ne doit pas empêcher de lancer : 100 est le repli.
---@param class_id any
---@return integer
function Sorts.ManaMax(class_id)
    local c = (Classes.CLASSES or {})[class_id or ""]
    local m = c and c.baseStats and tonumber(c.baseStats.mana)
    return math.floor(m or 100)
end

--- Régénération de mana, en points par seconde.
--- Proportionnelle au réservoir : une classe à 120 de mana ne doit pas mettre
--- deux fois plus longtemps à se remplir qu'une à 60.
Sorts.REGEN_PAR_SECONDE = 0.04

--- Nouvel état de lancement pour un personnage.
---@param class_id any
---@return table
function Sorts.NouvelEtat(class_id)
    local max = Sorts.ManaMax(class_id)
    return {
        class_id = class_id,
        mana = max,
        mana_max = max,
        -- `prets[sort_id] = instant auquel la recharge s'achève`
        prets = {},
        -- Modificateurs du personnage (niveau, talents) : neutres tant que
        -- `Moduler` n'a rien posé. Voir `Logic/Progression.lua`.
        cout_mult = 1,
        regen_mult = 1,
        degats_mult = 1,
    }
end

--- Pose les modificateurs du personnage sur son état de lancement : mana max
--- (niveau × talents), multiplicateurs de coût, de régénération et de dégâts.
--- Le mana courant est BORNÉ au nouveau maximum — jamais rempli : monter de
--- niveau en plein combat ne doit pas rendre une barre pleine gratuitement.
--- (Le soin complet du passage de niveau est une décision de l'exécutant.)
---@param etat table
---@param mods table|nil { mana_max, cout_mult, regen_mult, degats_mult }
function Sorts.Moduler(etat, mods)
    if (type(etat) ~= "table" or type(mods) ~= "table") then return end
    local function positif(v, defaut)
        local n = tonumber(v)
        if (not n or n <= 0) then return defaut end
        return n
    end
    etat.mana_max = math.floor(positif(mods.mana_max, etat.mana_max or Sorts.ManaMax(etat.class_id)))
    etat.cout_mult = positif(mods.cout_mult, 1)
    etat.regen_mult = positif(mods.regen_mult, 1)
    etat.degats_mult = positif(mods.degats_mult, 1)
    if ((tonumber(etat.mana) or 0) > etat.mana_max) then etat.mana = etat.mana_max end
end

--- Coût RÉEL d'un sort pour cet état : `Math.round(manaCost × manaCostMult)`,
--- la formule du HUD web (hud/GameHUD.tsx). Arrondi .5 vers le haut.
---@param etat table|nil
---@param sort table
---@return integer
function Sorts.Cout(etat, sort)
    local base = tonumber(sort and sort.manaCost) or 0
    local mult = tonumber(type(etat) == "table" and etat.cout_mult) or 1
    return math.floor(base * mult + 0.5)
end

--- Recharge restante, en secondes (0 si prêt).
---@param etat table
---@param sort_id string
---@param maintenant number
---@return number
function Sorts.Restant(etat, sort_id, maintenant)
    if (type(etat) ~= "table" or type(etat.prets) ~= "table") then return 0 end
    local t = tonumber(maintenant)
    local fin = tonumber(etat.prets[sort_id])
    if (not t or not fin) then return 0 end
    local reste = fin - t
    if (reste <= 0) then return 0 end
    return reste
end

--- Le sort peut-il partir ?
--- Rend (ok, raison) : un refus est un cas normal du jeu, pas une exception.
---@param etat table
---@param sort_id any
---@param maintenant number
---@return boolean, string|nil
function Sorts.PeutLancer(etat, sort_id, maintenant)
    if (type(etat) ~= "table") then return false, "Etat de lancement absent" end

    local sort = Sorts.Trouver(sort_id)
    if (not sort) then return false, "Pouvoir inconnu" end

    -- ⚠ Contrôle de PROPRIÉTÉ, pas de confort d'affichage. `sort_id` arrive du
    -- client : sans cette ligne, un soigneur lancerait le barrage plasma du DPS.
    if (sort.classId ~= etat.class_id) then
        return false, "Ce pouvoir n'appartient pas a votre classe"
    end

    local reste = Sorts.Restant(etat, sort.id, maintenant)
    if (reste > 0) then
        return false, ("Recharge : %.1f s"):format(reste)
    end

    local cout = Sorts.Cout(etat, sort)
    if ((tonumber(etat.mana) or 0) < cout) then
        return false, "Energie insuffisante"
    end

    return true, nil
end

--- ── LE GESTE DU LANCEUR, PAR ARCHETYPE ───────────────────────────────────────
---
--- Demande de Hanibes le 2026-09-12 : « ajoute des animations de sorts ainsi que
--- des effets visuels adaptés aux différentes animations et actions du guerrier ».
--- Les effets existaient ; le GESTE, non — un sort partait d'un personnage
--- immobile, et seule la particule bougeait.
---
--- ⚠ AUCUNE ANIMATION D'INCANTATION DANS LE PACK. Mesuré le 2026-09-12 :
--- « Cast », « Spell », « Magic » rendent ZERO sur les 3 016 actions cuites.
--- Nos animations sont du corps-à-corps et de l'arme à feu. On prend donc le
--- geste de COMBAT le plus proche du role, plutot que d'inventer un nom qui
--- n'existe pas — `PlayAnimation` sur un asset absent echoue en SILENCE, et le
--- sort partirait sans geste sans que rien ne le dise.
---
--- Les quatre retenus, verifies presents dans `Catalogs/Animations.lua` :
---   projectile  AS_HeavyObjectThrow      un lancer a deux mains, ample
---   aoe         AM_GroundTakedownPunch   un coup porte vers le SOL
---   buff/shield ACB_Taunt_01_IP_Anim     une posture tenue, en place
---   basic       MM_ChargedAttack_Anim    une frappe chargee
---
--- ⚠ `_IP` pour la posture : en place. Une animation a racine mobile (RM)
--- deplacerait le lanceur pendant son incantation.
---
--- ⚠ `aoe` : `AS_` et plus `AM_GroundTakedownPunch` (2026-09-15). Le montage
--- importait quatre assets de /Game/FreeflowCombatSystem/ absents du pack (fenêtre
--- de coup, infos de dégâts) ; la séquence n'importe que SKEL_Mannequin — lu dans
--- le paquet cuit.
Sorts.GESTES = {
    projectile = "narvos::AS_HeavyObjectThrow",
    aoe        = "narvos::AS_GroundTakedownPunch",
    buff       = "narvos::ACB_Taunt_01_IP_Anim",
    shield     = "narvos::ACB_Taunt_01_IP_Anim",
    basic      = "narvos::MM_ChargedAttack_Anim",
}

-- ── GESTES ARME EN MAIN (2026-09-15) ─────────────────────────────────────────
--
-- Demande de Hanibes : « trouve une animation adaptée au lancement de sorts avec
-- une arme ». Avant, une arme à feu tenue remplaçait le geste par SA pose de TIR
-- pour tous les archétypes — un bouclier ou un soin « tiraient » (enquête
-- .hermes/ENQUETE_ARMES_SORTS_2026-09-15.md §3). Les gestes à deux mains
-- (`AS_HeavyObjectThrow`) faisaient, eux, lâcher la visée du fusil.
--
-- Le pack Tactical_HandSignals est fait pour ça : le personnage GARDE son arme
-- dans la main droite et fait le geste de la GAUCHE. Deux jeux, selon la prise :
-- `Rifle_` (arme tenue à deux mains) et `Pistol_` (une main). Les clés sont
-- vérifiées dans Assets.toml, et chaque paquet cuit n'importe que
-- /Game/NanosWorld/Characters/Common/SKEL_Mannequin.
Sorts.GESTES_ARME = {
    deux_mains = {
        projectile = "narvos::Rifle_HandSignal_Forward_Anim",   -- la main désigne la cible
        aoe        = "narvos::Rifle_HandSignal_GetDown_Anim",   -- la main plaque vers le sol
        buff       = "narvos::Rifle_HandSignal_PointUp_Anim",   -- la main levée
        shield     = "narvos::Rifle_HandSignal_Halt_Anim",      -- la paume ouverte, en garde
        basic      = "narvos::Rifle_HandSignal_Forward_Anim",
    },
    une_main = {
        projectile = "narvos::Pistol_HandSignal_Forward_Anim",
        aoe        = "narvos::Pistol_HandSignal_GetDown_Anim",
        buff       = "narvos::Pistol_HandSignal_PointUp_Anim",
        shield     = "narvos::Pistol_HandSignal_Halt_Anim",
        basic      = "narvos::Pistol_HandSignal_Forward_Anim",
    },
}

--- Prise d'une arme d'après son `HandlingMode` (Enums.json : SingleHandedWeapon=0,
--- DoubleHandedWeapon=1, SingleHandedMelee=2, DoubleHandedMelee=3). Les autres
--- modes (lancer, torche, caisse) n'ont pas de geste d'incantation propre.
Sorts.PRISES = { [0] = "une_main", [1] = "deux_mains", [2] = "une_main", [3] = "deux_mains" }

---@param handling_mode any
---@return string|nil
function Sorts.Prise(handling_mode)
    return Sorts.PRISES[tonumber(handling_mode) or -1]
end

--- Le geste d'un archétype SELON L'ARME tenue : jeu de la prise, sinon le geste
--- à mains nues.
---@param archetype any
---@param prise string|nil  "une_main" | "deux_mains" | nil (mains nues)
---@return string
function Sorts.GesteAvecArme(archetype, prise)
    local jeu = Sorts.GESTES_ARME[prise]
    if (not jeu) then return Sorts.Geste(archetype) end
    return jeu[archetype] or jeu.basic
end

-- ── SYNCHRONISATION GESTE / EFFET / DÉGÂTS (2026-09-15) ─────────────────────────
--
-- Avant, les effets et les dégâts partaient À L'APPUI, avant même que la main ne
-- bouge. Chaque geste a maintenant un instant de LIBÉRATION : l'effet de départ,
-- le projectile, la zone et les dégâts attendent ce moment.
--
-- `duree_s` : durée RÉELLE de la séquence, lue dans l'asset source de l'ADK
-- (propriété SequenceLength, 2026-09-15) — 2,333 s pour les signaux (70 images),
-- 2,867 s pour le lancer, 2,367 s pour le coup au sol.
-- `liberation` : fraction de la séquence où le geste « donne ». RÉGLÉE À L'ŒIL :
-- c'est la valeur à corriger si l'effet part trop tôt ou trop tard.
-- `vitesse` : cadence de lecture (`PlayAnimation` play_rate). Les signaux sont
-- faits pour être lisibles de loin ; à 1,0 un sort attendrait près d'une seconde.
Sorts.RYTHMES = {
    ["narvos::Rifle_HandSignal_Forward_Anim"]  = { duree_s = 2.333, liberation = 0.30, vitesse = 1.6 },
    ["narvos::Rifle_HandSignal_GetDown_Anim"]  = { duree_s = 2.333, liberation = 0.34, vitesse = 1.6 },
    ["narvos::Rifle_HandSignal_PointUp_Anim"]  = { duree_s = 2.333, liberation = 0.30, vitesse = 1.6 },
    ["narvos::Rifle_HandSignal_Halt_Anim"]     = { duree_s = 2.333, liberation = 0.28, vitesse = 1.6 },
    ["narvos::Pistol_HandSignal_Forward_Anim"] = { duree_s = 2.333, liberation = 0.30, vitesse = 1.6 },
    ["narvos::Pistol_HandSignal_GetDown_Anim"] = { duree_s = 2.333, liberation = 0.34, vitesse = 1.6 },
    ["narvos::Pistol_HandSignal_PointUp_Anim"] = { duree_s = 2.333, liberation = 0.30, vitesse = 1.6 },
    ["narvos::Pistol_HandSignal_Halt_Anim"]    = { duree_s = 2.333, liberation = 0.28, vitesse = 1.6 },
    ["narvos::AS_HeavyObjectThrow"]            = { duree_s = 2.867, liberation = 0.36, vitesse = 1.4 },
    ["narvos::AS_GroundTakedownPunch"]         = { duree_s = 2.367, liberation = 0.40, vitesse = 1.4 },
}

--- Rythme d'un geste absent de la table : lu à vitesse normale, libéré vite.
Sorts.RYTHME_DEFAUT = { duree_s = 1.0, liberation = 0.3, vitesse = 1.0 }
--- Plafond du délai de libération, en millisecondes : au-delà, le joueur croit
--- que la touche n'a pas répondu.
Sorts.LIBERATION_MAX_MS = 900

--- Rythme d'un geste : (vitesse de lecture, délai de libération en ms).
---@param geste any
---@return number, integer
function Sorts.Rythme(geste)
    local r = Sorts.RYTHMES[geste] or Sorts.RYTHME_DEFAUT
    local vitesse = tonumber(r.vitesse) or 1
    if (vitesse <= 0) then vitesse = 1 end
    local delai = math.floor((tonumber(r.duree_s) or 0) * (tonumber(r.liberation) or 0) / vitesse * 1000 + 0.5)
    if (delai < 0) then delai = 0 end
    if (delai > Sorts.LIBERATION_MAX_MS) then delai = Sorts.LIBERATION_MAX_MS end
    return vitesse, delai
end

--- Le geste d'un archetype, ou celui de `basic` a defaut.
---
--- Rend TOUJOURS quelque chose : un archetype inconnu vaut mieux joue en frappe
--- generique que pas joue du tout — le joueur verrait sinon son personnage
--- lancer un sort sans bouger, et croirait a une panne.
---@param archetype any
---@return string
function Sorts.Geste(archetype)
    if (type(archetype) ~= "string") then return Sorts.GESTES.basic end
    return Sorts.GESTES[archetype] or Sorts.GESTES.basic
end

--- Chemin de l'ICÔNE d'un sort, relatif à la page (Client/UI) : l'image de son
--- effet web à son plein, choisie par le générateur. Nil sans icône.
---@param sort_id any
---@return string|nil
function Sorts.IconePage(sort_id)
    local e = type(sort_id) == "string" and (SortsVfx.SORTS or {})[sort_id] or nil
    if (type(e) ~= "table" or type(e.icone) ~= "string") then return nil end
    return e.icone
end

--- Temps de vol d'un projectile sur `distance_cm`, borné à [VOL_MIN_S, VOL_MAX_S].
---@param distance_cm number
---@param vitesse_cm_s number
---@return number
function Sorts.TempsDeVol(distance_cm, vitesse_cm_s)
    local d = math.max(0, tonumber(distance_cm) or 0)
    local v = tonumber(vitesse_cm_s) or 0
    if (v <= 0) then v = Sorts.VITESSE_DEFAUT_CM_S end
    local t = d / v
    if (t < Sorts.VOL_MIN_S) then return Sorts.VOL_MIN_S end
    if (t > Sorts.VOL_MAX_S) then return Sorts.VOL_MAX_S end
    return t
end

-- ── LES EFFETS 3D DE CHAQUE SORT (2026-09-14) ───────────────────────────────────
--
-- Retour de jeu de Hanibes : « remplace les effets pixel-art par les effets 3D
-- déjà présents dans le pack ». Relevé sur les 75 particules cuites de NOTRE pack
-- (lecture des .uasset : contenu, boucle ou coup unique, échelle) — rapport du
-- 14/09 — puis choisi sort par sort. Une DÉCISION, écrite ici comme
-- `Modular.JOUABLES` : aucun catalogue ne dit quel éclat va avec quel pouvoir.
--
-- Rôles : `lanceur` naît sur le lanceur, orienté comme lui · `voyage` part avec
-- le projectile (le premier voyage, les suivants l'accompagnent) · `impact` au
-- point touché · `zone` au centre de l'aire · `aura` s'ATTACHE au lanceur pour
-- `duree_s` (bouclier, rage). Un effet : une clé, ou { asset, echelle, duree_s }.
--
-- ⚠ Chaque clé `narvos::` est contrôlée par narvos-verifier-catalogues.mjs
-- (« Citations Lua ») ; chaque `nanos-world::` par sorts-tests.lua contre Vfx.lua.
-- Écartés au relevé : P_SlimeBall (jaune-vert, pas du feu), les faisceaux et
-- nuages géants de SpaceScenes, les traînées d'arme liées à une animation.
Sorts.EFFETS_3D = {
    bruiser_slam = {
        impact = { "narvos::FXS_Strike", "narvos::P_Sparks" },
    },
    bruiser_shockwave = {
        lanceur = { "narvos::P_Sparks" },
        zone = { "narvos::P_Attack_ComboFX", "narvos::P_Skill_Leap_Base_Velocity_Impact" },
    },
    bruiser_rage = {
        lanceur = { { asset = "narvos::P_RBurst_Lightning_Pull_01", echelle = 0.5 } },
        aura = { asset = "narvos::P_electricity_arc", duree_s = 8 },
    },
    dps_fire_shot = {
        lanceur = { "narvos::P_PP" },
        voyage = { "nanos-world::P_FXVariety_FireBall", "narvos::P_Embers" },
        impact = { "narvos::P_Explosion" },
    },
    dps_plasma_barrage = {
        lanceur = { { asset = "narvos::NS_FlameThrower", duree_s = 0.6 } },
        zone = { "narvos::P_Env_Fire_PP_01", "narvos::P_Fire_TrapBossEnd_mobile" },
    },
    dps_evasion = {
        lanceur = { "narvos::FXS_Counter" },
        aura = { asset = "narvos::P_Embers", duree_s = 3 },
    },
    tank_bash = {
        lanceur = { "narvos::FXS_Ground_Impact" },
        impact = { "narvos::P_Impact01" },
    },
    tank_fortress = {
        lanceur = { "narvos::P_RBurst_Lightning_Pull_01" },
        zone = { "narvos::P_Skill_Leap_Base_Velocity_Impact", "narvos::FXS_Ground_Impact" },
    },
    tank_iron_wall = {
        lanceur = { "narvos::P_Skill_001" },
        aura = { asset = "narvos::P_powershield_constant", echelle = 0.25, duree_s = 10 },
    },
    heal_nano = {
        lanceur = { "narvos::P_HealingProbe" },
        aura = { asset = "narvos::P_Health_Potion", duree_s = 3 },
    },
    heal_drone = {
        lanceur = { "narvos::P_HealingProbe" },
        zone = { { asset = "narvos::P_Summon_Parent_Startup", duree_s = 6 }, "narvos::P_Dissolve" },
    },
    heal_barrier = {
        lanceur = { "narvos::P_Dissolve" },
        aura = { asset = "narvos::P_powershield_constant_02", duree_s = 10 },
    },
}

--- Rôles d'effets d'un plan, dans l'ordre où le serveur les pose.
Sorts.ROLES_EFFETS = { "lanceur", "voyage", "impact", "zone" }

--- Un effet normalisé { asset, echelle, duree_s }, ou nil.
local function EffetNormalise(e)
    if (type(e) == "string" and e ~= "") then return { asset = e, echelle = 1, duree_s = nil } end
    if (type(e) ~= "table" or type(e.asset) ~= "string" or e.asset == "") then return nil end
    local echelle = tonumber(e.echelle) or 1
    local duree = tonumber(e.duree_s)
    return { asset = e.asset, echelle = (echelle > 0) and echelle or 1, duree_s = (duree and duree > 0) and duree or nil }
end

--- Une liste d'effets normalisés (jamais nil).
local function ListeEffets(v)
    local sortie = {}
    if (v == nil) then return sortie end
    if (type(v) == "string" or (type(v) == "table" and v.asset ~= nil)) then v = { v } end
    for _, e in ipairs(v) do
        local n = EffetNormalise(e)
        if (n) then sortie[#sortie + 1] = n end
    end
    return sortie
end

--- Les effets 3D d'un sort, par rôle : le choix sort par sort (`EFFETS_3D`), ou
--- à défaut ceux de son ÉLÉMENT dans le pack de base (`Vfx.PourElement`).
---@param sort table
---@return table { lanceur = {…}, voyage = {…}, impact = {…}, zone = {…}, aura = effet|nil }
function Sorts.Effets(sort)
    local choisi = type(sort) == "table" and type(sort.id) == "string" and Sorts.EFFETS_3D[sort.id] or nil
    if (choisi) then
        return {
            lanceur = ListeEffets(choisi.lanceur),
            voyage = ListeEffets(choisi.voyage),
            impact = ListeEffets(choisi.impact),
            zone = ListeEffets(choisi.zone),
            aura = EffetNormalise(choisi.aura),
        }
    end
    local par = Vfx.PourElement(type(sort) == "table" and sort.element or nil)
    local archetype = type(sort) == "table" and sort.archetype or "basic"
    local e = { lanceur = {}, voyage = {}, impact = {}, zone = {}, aura = nil }
    if (archetype == "projectile") then
        e.voyage = ListeEffets(Vfx.Asset(par.projectile))
        e.impact = ListeEffets(Vfx.Asset(par.impact))
    elseif (archetype == "aoe") then
        e.zone = ListeEffets(Vfx.Asset(par.zone))
        e.lanceur = ListeEffets(Vfx.Asset(par.aura))
    elseif (archetype == "buff" or archetype == "shield") then
        e.lanceur = ListeEffets(Vfx.Asset(par.aura))
    else
        e.impact = ListeEffets(Vfx.Asset(par.impact))
    end
    return e
end

--- Mise en scène d'un sort : quelles particules, où, sur quel rayon.
---
--- L'archétype décide du RÔLE joué par chaque effet — un projectile voyage puis
--- frappe, une zone se pose au sol, un buff reste sur le lanceur. Sans ça, les
--- douze sorts rendraient le même éclat au même endroit.
---@param sort table
---@return table
function Sorts.Plan(sort)
    local effets = Sorts.Effets(sort)
    local archetype = sort.archetype or "basic"

    local plan = {
        sort_id = sort.id,
        element = sort.element,
        archetype = archetype,
        label = sort.label,
        degats = tonumber(sort.damage) or 0,
        soin = tonumber(sort.heal) or 0,
        portee = tonumber(sort.range) or 0,
        rayon = tonumber(sort.aoeRadius) or 0,
        vitesse = tonumber(sort.speed) or 0,
        -- Les effets 3D par rôle (`Sorts.Effets`) : c'est ce que le serveur pose.
        effets = effets,
        -- Résumé à un asset par rôle (premier de chaque liste), gardé pour les
        -- lecteurs qui ne veulent qu'un nom : journal, harnais.
        vfx_lanceur = ((effets.lanceur[1] or effets.aura) or {}).asset,
        vfx_voyage = (effets.voyage[1] or {}).asset,
        vfx_impact = ((effets.impact[1] or effets.zone[1]) or {}).asset,
        -- Le geste voyage AVEC le plan : le serveur n'a alors qu'une chose a
        -- lire, et l'animation ne peut pas diverger de l'effet qu'elle habille.
        geste = Sorts.Geste(archetype),
        -- Trajet : le projectile VOYAGE, à la vitesse du catalogue (m/s -> cm/s)
        -- ou à la vitesse par défaut.
        homing = sort.homing == true,
        vitesse_cm_s = ((tonumber(sort.speed) or 0) > 0) and (tonumber(sort.speed) * 100) or Sorts.VITESSE_DEFAUT_CM_S,
    }


    return plan
end

--- Lance le sort : consomme le mana, arme la recharge, rend le plan.
---
--- L'état est MUTÉ. C'est délibéré : un état de combat recopié à chaque frappe
--- ferait une allocation par coup, et rien d'autre ne le lit pendant l'appel.
---@param etat table
---@param sort_id any
---@param maintenant number
---@return boolean ok
---@return string|nil raison
---@return table|nil plan
function Sorts.Lancer(etat, sort_id, maintenant)
    local ok, raison = Sorts.PeutLancer(etat, sort_id, maintenant)
    if (not ok) then return false, raison, nil end

    local sort = Sorts.Trouver(sort_id)
    local t = tonumber(maintenant) or 0

    etat.mana = (tonumber(etat.mana) or 0) - Sorts.Cout(etat, sort)
    if (etat.mana < 0) then etat.mana = 0 end

    local cd = tonumber(sort.cooldown) or 0
    if (cd > 0) then etat.prets[sort.id] = t + cd end

    -- Dégâts du personnage : niveau (puissance) × talents, posés par
    -- `Moduler`. Le plan reste celui du catalogue pour tout le reste.
    local plan = Sorts.Plan(sort)
    plan.degats = plan.degats * (tonumber(etat.degats_mult) or 1)
    return true, nil, plan
end

--- Régénère le mana sur `dt` secondes. À appeler depuis un Timer serveur.
---@param etat table
---@param dt number
function Sorts.Regenerer(etat, dt)
    if (type(etat) ~= "table") then return end
    local pas = tonumber(dt)
    if (not pas or pas <= 0) then return end

    local max = tonumber(etat.mana_max) or 0
    local courant = tonumber(etat.mana) or 0
    if (courant >= max) then return end

    courant = courant + max * Sorts.REGEN_PAR_SECONDE * pas * (tonumber(etat.regen_mult) or 1)
    etat.mana = (courant > max) and max or courant
end

--- Vue de la barre pour le HUD : sort, recharge restante, coût, lançable ou non.
---@param etat table
---@param maintenant number
---@return table
function Sorts.VueBarre(etat, maintenant)
    local sortie = {}
    if (type(etat) ~= "table") then return sortie end

    for i, sort in ipairs(Sorts.Barre(etat.class_id)) do
        if (sort) then
            local ok = Sorts.PeutLancer(etat, sort.id, maintenant)
            sortie[i] = {
                emplacement = i,
                id = sort.id,
                label = sort.label,
                element = sort.element,
                archetype = sort.archetype,
                cout = Sorts.Cout(etat, sort),
                icone = Sorts.IconePage(sort.id) or false,
                recharge = tonumber(sort.cooldown) or 0,
                restant = Sorts.Restant(etat, sort.id, maintenant),
                pret = ok,
            }
        else
            sortie[i] = { emplacement = i, vide = true }
        end
    end
    return sortie
end

return Sorts
