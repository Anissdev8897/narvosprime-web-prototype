-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Character.lua — assemble un personnage NARVOS depuis les catalogues.
--
-- Câblage : Narvos.CharacterBuilder = Package.Require("Logic/Character.lua")
--
-- POURQUOI CE FICHIER : les 4 classes de NARVOS portent une identité VISUELLE
-- (outfitColor, outfitEmissive, element) et des STATS. Ce module traduit cette
-- identité en appels nanos, sans qu'aucun asset custom ne soit nécessaire : il
-- habille des meshes `nanos-world::` et les TEINTE aux couleurs de la classe.
--
-- C'est délibérément une couche de SUBSTITUTION. Le jour où les assets NARVOS
-- sont cuits, seule la table APPARENCE change — la logique d'assemblage, les
-- stats et les appels nanos restent identiques.
--
-- ── LA CONTRAINTE QUI GOUVERNE TOUT ────────────────────────────────────────────
-- `AddSkeletalMeshAttached` exige, selon l'API : « must have the same skeleton
-- used by this Actor's mesh ». Un vêtement n'est donc PAS un mesh posé : il est
-- skinné au Mannequin et suit les animations du corps. D'où la séparation :
--   · vêtements  → AddSkeletalMeshAttached  (même squelette)
--   · yeux/cheveux → AddStaticMeshAttached  (sur un socket)
--   · visage/morpho → SetMorphTarget        (blendshapes du mesh de base)
-- C'est exactement la structure à deux couches de l'éditeur web (anatomie vs
-- vêtements) : elle se transpose sans rien changer.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosCharacterBuilder
local Builder = {}

-- Résolution paresseuse : Shared/Index.lua a normalement déjà chargé les
-- catalogues. On réutilise SA table plutôt que de relancer un chargement —
-- `require` nu et Package.Require n'ont pas la même clé de cache, deux
-- chargements donneraient deux tables distinctes.
-- ⚠ LE PRÉFIXE N'EST PAS INCONDITIONNEL. Ce helper sert aussi aux modules de
-- `Logic/` (Macros, Apparence), et préfixer aveuglément donnait
-- `Catalogs/Logic/Macros.lua` — un chemin qui n'existe pas. Le repli levait
-- alors, mais SEULEMENT quand `Narvos.Macros` était nil : jamais en jeu, où
-- Shared/Index.lua charge tout, et jamais en test, où le harnais pose `Narvos`.
-- Un chemin déjà qualifié passe donc tel quel.
local function catalogue(nom, fichier)
    if (Narvos and Narvos[nom]) then return Narvos[nom] end
    local chemin = fichier:find("/") and fichier or ("Catalogs/" .. fichier)
    return Package.Require(chemin)
end

local Classes = catalogue("Classes", "Classes.lua")

-- ── Substitution visuelle ──────────────────────────────────────────────────────

-- ── D'OÙ VIENNENT CES MODÈLES ─────────────────────────────────────────────────
--
-- Du pack `narvos`, cuit depuis l'ADK (skill nanos-world §2 bis) : 611
-- SkeletalMesh, tous liés à SKEL_Mannequin. Les noms ci-dessous sont ceux que
-- déclare son `Assets.toml` — fichier GÉNÉRÉ, donc à RELIRE après tout recook
-- plutôt qu'à recopier de mémoire.
--
-- ⚠ CHANGEMENT DE STRUCTURE. Le pack de base nanos offrait un corps nu
-- (`SK_Male`) qu'on habillait d'une tenue attachée. Nos assets sont des
-- PERSONNAGES COMPLETS : le vêtement fait partie du mesh. Empiler une tenue
-- par-dessus donnerait deux couches qui s'interpénètrent. L'identité de classe
-- passe donc désormais par le CORPS, pas par une pièce ajoutée.
--
-- Le corps est choisi par CLASSE et non par genre : ces quatre modèles ont
-- chacun leur silhouette, et c'est elle qui rend les classes distinguables en
-- vue de dessus — bien plus qu'une teinte. Le genre reste posé sur l'entité
-- (`narvos_gender`) pour le jour où chaque classe aura ses variantes.
local CORPS_PAR_CLASSE = {
    warrior_bruiser = "narvos::SK_CyberpunkSamurai_WithHelmet",
    warrior_dps     = "narvos::SK_CyberpunkSamurai_WithoutHelmet",
    warrior_tank    = "narvos::SM_ZombieSoldierTankman_UE4",
    warrior_heal    = "narvos::SK_Valkiria",
}

-- Repli si une classe entre au catalogue sans qu'on lui donne un corps. Sans ce
-- filet elle spawnerait sans mesh ; `Builder.Validate()` le signale au chargement.
local CORPS_DEFAUT = "narvos::SK_CyberpunkSamurai_WithoutHelmet"

-- Pièces ATTACHABLES, posées PAR-DESSUS un corps déjà habillé. Seules celles qui
-- ne recouvrent pas le mesh ont un sens ici — d'où des accessoires, pas des
-- tenues.
--
-- ⚠ Les clés sont les `role` du catalogue, pas ceux qu'on imagine : la classe
-- `warrior_heal` porte `role = "support"`. La clé `heal` écrite ici au départ ne
-- correspondait à rien et la soigneuse retombait en silence sur le défaut.
local ACCESSOIRE_PAR_ROLE = {
    dps     = "narvos::SK_CyberpunkSamurai_Bag",
    tank    = "narvos::SK_CyberpunkSamurai_Helmet",
    support = "narvos::SK_CyberpunkSamurai_Hair",
}

-- ── PLUS D'ARME POSÉE PAR LA CLASSE ───────────────────────────────────────────
--
-- Une table `ARME_PAR_CLASSE` attachait ici un static mesh dans `hand_r` au
-- moment du spawn : katana, fusil ou fourreau selon la classe. Retirée le
-- 2026-09-12 sur retour de jeu de Hanibes — « supprime la batte que le
-- personnage tient quand il arrive ; à l'arrivée, mains nues ».
--
-- Ce n'était pas qu'une décoration de trop : cette arme-là n'était RELIÉE À RIEN.
-- Elle ne faisait pas de dégâts, ne se rangeait pas (`melee_ranger`, V, ne
-- connaît que les `Melee` créées par Server/Combat.lua), n'occupait aucun
-- emplacement de la roue, et se superposait à l'arme réelle qu'on équipe. Le
-- joueur voyait deux armes dont une seule répondait.
--
-- Les armes viennent maintenant d'UNE seule voie, celle qui décide vraiment :
--   · à feu   → Narvos.Weapons.Donner        (roue TAB, butin, marchand)
--   · mêlée   → Narvos.CombatServeur.Equiper (roue TAB, commande /arme)
--
-- La table n'est pas conservée « au cas où » : sur ce projet, une valeur morte
-- gardée par précaution a déjà repris la place d'un vrai choix le jour où on l'a
-- rebranchée (COULEURS_DEFAUT, 2026-09-05).

-- ── Couleur ────────────────────────────────────────────────────────────────────

--- Convertit "#1565c0" en Color(r, g, b) normalisé.
--- Les catalogues NARVOS stockent des couleurs CSS ; nanos attend des flottants
--- 0..1. Sans conversion, `Color(21, 101, 192)` donnerait du blanc saturé.
---@param hex string
---@return table|nil
function Builder.HexToColor(hex)
    if (type(hex) ~= "string") then return nil end
    local h = hex:gsub("#", "")
    if (#h ~= 6) then return nil end

    local r = tonumber(h:sub(1, 2), 16)
    local g = tonumber(h:sub(3, 4), 16)
    local b = tonumber(h:sub(5, 6), 16)
    if (not r or not g or not b) then return nil end

    return Color(r / 255, g / 255, b / 255)
end

-- ── Assemblage ─────────────────────────────────────────────────────────────────

--- Habille et teinte un personnage déjà spawné, selon sa classe NARVOS.
--- Séparé de la construction pour rester utilisable sur un personnage existant
--- (changement de classe en jeu, essayage chez un marchand).
---@param character table Character nanos
---@param class_id string  clé de Classes.CLASSES
---@return boolean ok
---@return string|nil raison
function Builder.ApplyClass(character, class_id)
    if (not character) then return false, "personnage nil" end

    local classe = Classes.CLASSES[class_id]
    if (not classe) then return false, "classe inconnue : " .. tostring(class_id) end

    -- Accessoire : skeletal mesh attaché, donc animé avec le corps. Il vient
    -- PAR-DESSUS un corps déjà habillé — pas de tenue ici, elle ferait doublon
    -- avec le mesh (cf. l'en-tête de la section des modèles).
    --
    -- Le rôle peut n'avoir aucun accessoire : c'est un cas normal, pas un défaut.
    --
    -- ⚠ JAMAIS SUR UN CORPS BLUEPRINT (2026-09-14). Un MetaHuman s'habille par le
    -- Meta Customization System, choix du joueur. L'accessoire de rôle (casque du
    -- tank, sac du dps) s'attachait quand même au porteur — au spawn ET en marchant
    -- sur un pad de classe : « un vêtement apparaît sans que le joueur l'ait
    -- sélectionné » (retour de jeu de Hanibes). Un accessoire posé avant ce
    -- correctif est retiré au passage.
    local MHBP = Narvos and Narvos.MetaHumainBP
    local porte_blueprint = (MHBP and MHBP.Etat and (MHBP.Etat(character))) == true
    local accessoire = (not porte_blueprint) and ACCESSOIRE_PAR_ROLE[classe.role] or nil
    if (porte_blueprint) then
        pcall(function() character:RemoveSkeletalMeshAttached("accessoire") end)
    end
    if (accessoire) then
        character:AddSkeletalMeshAttached("accessoire", accessoire)
    end

    -- ⚠ PAS de yeux attachés. Le pack de base nanos exposait un `SM_Eye` posé
    -- sur des sockets `eye_left`/`eye_right` ; nos personnages ont leurs yeux
    -- dans le mesh, et ces sockets n'existent pas sur SKEL_Mannequin. Les
    -- attacher les collerait à l'origine du personnage.

    -- La teinte s'applique à l'accessoire seulement : le corps porte ses propres
    -- matériaux, et les teinter écraserait l'identité visuelle du modèle. Le
    -- 4e argument cible la pièce ; le 3e (-1) signifie « tous les index ».
    -- Sans accessoire, il n'y a rien à teinter.
    if (accessoire) then
        local teinte = Builder.HexToColor(classe.outfitColor)
        if (teinte) then
            character:SetMaterialColorParameter("Tint", teinte, -1, "accessoire")
        end

        -- ⚠ NON VÉRIFIÉ en exécution : `EmissiveColor` n'existe que si le
        -- matériau l'expose, ce que rien ne garantit. On tente sans en dépendre.
        local emissive = Builder.HexToColor(classe.outfitEmissive)
        if (emissive) then
            character:SetMaterialColorParameter("EmissiveColor", emissive, -1, "accessoire")
        end
    end

    -- Les stats vivent sur l'entité, synchronisées : n'importe quel package peut
    -- les lire, et le client les reçoit sans appel réseau supplémentaire.
    character:SetValue("narvos_class", class_id, true)
    character:SetValue("narvos_element", classe.element, true)
    character:SetValue("narvos_stats", classe.baseStats, true)

    -- La vitesse est le seul stat que nanos applique lui-même. Les autres (hp,
    -- mana, defense…) restent des données : c'est notre logique qui les lira.
    if (classe.baseStats and classe.baseStats.moveSpeed) then
        character:SetSpeedMultiplier(classe.baseStats.moveSpeed)
    end

    return true
end

--- Spawne un personnage NARVOS complet.
---@param class_id string
---@param location table Vector
---@param rotation table Rotator
---@param genre? string "male" | "female" — aléatoire si absent
---@param corps_id? string  identifiant d'un Modular.CORPS, prioritaire sur la classe
---@return table|nil character
---@return string|nil raison
-- ── LE BLEND SPACE DE DEPLACEMENT ────────────────────────────────────────────
--
-- Mesure du 2026-09-12 : le jeu tournait sur la locomotion NATIVE de nanos.
-- Nos 3 480 animations cuites ne servaient qu'aux emotes, au combat et aux PNJ,
-- et `SetAnimationIdleWalkRunStanding` n'etait appele QUE par la commande
-- d'essai `/locomotion`. Autrement dit : jamais, en jeu.
--
-- ⚠ UN SEUL DES TROIS BLEND SPACES DU PACK CONVIENT, et ce n'est pas celui que
-- son nom ferait choisir. Squelettes lus dans les paquets cuits le 2026-09-12 :
--
--   BS_EnemyWalk            /Game/NanosWorld/Characters/Common/SKEL_Mannequin
--                           -> LE squelette nanos. Idle + marche 8 directions.
--   BS_MM_WalkRun           SK_Mannequin du pack Sewer — un AUTRE squelette
--   BS_MF_Unarmed_WalkRun   idem
--
-- Poser un blend space d'un squelette etranger ne leve pas : le personnage se
-- fige ou se tord, et rien ne le dit. C'est la NATURE de l'asset qui decide,
-- jamais son nom.
--
-- ⚠ « Enemy » est le nom que lui donne son pack d'origine (Freeflow), pas un
-- role : c'est une marche humanoide ordinaire. Les blend spaces taillés pour
-- NARVOS — marche, course, accroupi — se fabriqueront dans l'editeur depuis nos
-- animations deja cuites (`scripts/adk-fabriquer-blendspaces.py`). Le jour ou
-- ils existent, cette constante seule change.
-- ⚠ RETOUR DE JEU DU 2026-09-13 20h40 (Hanibes, captures) : « en marchant, le
-- personnage reste constamment en posture de combat ; il manque marche, course,
-- deplacement normal et les transitions ». BS_EnemyWalk est la marche de GARDE du
-- Freeflow Combat System (poings leves, 8 directions, pas de course) : pose sur
-- chaque Character, elle remplacait idle, marche, course ET leurs transitions.
--
-- `nil` = la locomotion NATIVE de nanos, complete et synchronisee (idle, marche,
-- course, sprint, accroupi, visee, armes). `PoserLocomotion` ne pose alors rien.
-- Les blend spaces NARVOS (dossier Narvos/Locomotion, 1 253 animations sur
-- SKEL_Mannequin : Idle, Walk, Run, Sprint, Crouch…) se fabriquent dans l'editeur
-- (serveur MCP : create_blend_space + add_blend_space_sample) ; cree le 2026-09-23
-- via MCP, cuit le 23/09 (Packages Remain 0) et integre au pack le 26/09.
-- `narvos::BS_Narvos_Locomotion` : axe X Speed 0..600 (Idle@0, Walk@150, Run@375,
-- Sprint@600), axe Y Direction inutilise (samples a y=0). Tester en jeu :
--   /locomotion narvos::BS_Narvos_Locomotion   (ou « off » pour rendre la main)
Builder.LOCOMOTION = "narvos::BS_Narvos_Locomotion"

--- Le coup de poing NATIF de nanos (clic gauche mains vides) reste-t-il actif ?
---
--- `false` depuis le 2026-09-13 : les mains nues passent par Server/Frappes.lua
--- (poings gauche/droite, coups de pied, touches reassignables, cone serveur).
--- Laisser le natif actif ferait partir DEUX coups au meme clic — le sien, avec
--- son animation, et le notre. Lu par `Spawn` et par Server/Menottes.lua, qui
--- rend les capacites coupees a la liberation : sans cette constante, liberer
--- un joueur rallumerait le poing natif.
Builder.POINGS_NATIFS = false

--- Pose notre blend space de deplacement sur un Character.
---
--- ⚠ `Character` SEULEMENT. `CharacterSimple` — les PNJ a squelette etranger —
--- n'expose pas cette methode ; l'appeler dessus ne ferait qu'un pcall perdu.
---
--- L'appel est d'autorite SERVEUR et marque « slow » dans l'API : une fois au
--- spawn, jamais par trame.
---@param character table|nil
---@return boolean  pose reellement
function Builder.PoserLocomotion(character)
    if (character == nil) then return false end
    if (Builder.LOCOMOTION == nil or Builder.LOCOMOTION == "") then return false end
    -- `false` en second argument : on ne veut pas que nanos tente de deviner la
    -- vitesse depuis l'animation, la capsule la connait deja.
    local pose = pcall(function()
        character:SetAnimationIdleWalkRunStanding(Builder.LOCOMOTION, false)
    end)
    if (not pose) then
        Console.Error("[NARVOS] locomotion refusee : " .. tostring(Builder.LOCOMOTION)
            .. " — le moteur garde la sienne")
    end
    return pose
end

function Builder.Spawn(class_id, location, rotation, genre, corps_id)
    if (not Classes.CLASSES[class_id]) then
        return nil, "classe inconnue : " .. tostring(class_id)
    end

    genre = genre or (math.random(2) == 1 and "male" or "female")

    -- Le corps CHOISI par le joueur l'emporte sur celui de la classe. Sans cette
    -- priorité, l'écran de création montrerait une silhouette que le jeu
    -- remplacerait à la seconde suivante — le pire des deux mondes.
    --
    -- Le repli par classe reste : PNJ, spawns de test et anciennes sauvegardes
    -- n'ont pas de corps modulaire, et doivent continuer à sortir habillés.
    local Modular = catalogue("Modular", "Modular.lua")
    local corps = corps_id and Modular.Corps(corps_id) or nil
    local mesh = (corps and corps.asset) or CORPS_PAR_CLASSE[class_id] or CORPS_DEFAUT

    local character = Character(location, rotation, mesh)

    -- ── NOTRE LOCOMOTION, PAS CELLE DU MOTEUR ────────────────────────────────
    Builder.PoserLocomotion(character)

    -- Mains nues : les notres (Server/Frappes.lua), pas le poing natif.
    pcall(function() character:SetCanPunch(Builder.POINGS_NATIFS) end)

    -- Corps modulaire : la peau vient des slots, le porteur est caché. Sans cet
    -- appel le joueur garderait la tenue cuite dans le mesh.
    if (corps) then
        Builder.Habiller(character, corps, nil)
    end

    local ok, raison = Builder.ApplyClass(character, class_id)
    if (not ok) then
        character:Destroy()
        return nil, raison
    end

    character:SetValue("narvos_gender", genre, true)
    return character
end

--- Liste des classes jouables, dans l'ordre du catalogue TS.
--- `pairs` n'ayant aucun ordre garanti et changeant d'une VM à l'autre, on lit
--- la séquence figée par le générateur : serveur et client voient le même ordre.
---@return string[]
function Builder.ClassIds()
    if (type(Classes.CLASSES_ORDER) == "table") then return Classes.CLASSES_ORDER end

    local ids = {}
    for id in pairs(Classes.CLASSES) do ids[#ids + 1] = id end
    table.sort(ids)
    return ids
end

--- Vérifie que chaque classe est jouable avec les assets disponibles.
--- À appeler au chargement : une classe dont le rôle n'a pas de tenue tomberait
--- silencieusement sur la tenue par défaut, sans que personne ne le remarque.
---@return string[] avertissements
function Builder.Validate()
    local warnings = {}
    for _, id in ipairs(Builder.ClassIds()) do
        local c = Classes.CLASSES[id]

        -- Le corps est ce qui rend une classe reconnaissable : sans le sien, elle
        -- devient le sosie d'une autre. C'est l'avertissement qui compte le plus.
        if (not CORPS_PAR_CLASSE[id]) then
            warnings[#warnings + 1] = id .. " : aucun corps attribué, repli sur " .. CORPS_DEFAUT
        end

        -- Un rôle sans accessoire est normal (tous n'en ont pas). On ne le
        -- signale donc PAS — un avertissement qui se déclenche toujours cesse
        -- d'être lu, et masque ceux qui comptent.

        if (not Builder.HexToColor(c.outfitColor)) then
            warnings[#warnings + 1] = id .. " : outfitColor illisible (" .. tostring(c.outfitColor) .. ")"
        end
    end
    return warnings
end


-- ── Habillage modulaire ────────────────────────────────────────────────────────
--
-- ── CE QUI A CHANGÉ, ET POURQUOI ──────────────────────────────────────────────
-- La note plus haut disait vrai jusqu'ici : nos meshes sont des personnages
-- COMPLETS, et empiler une tenue dessus donnait deux couches qui
-- s'interpénètrent — l'ancienne tenue transparaissait aux jointures.
--
-- Le client expose maintenant `SetMeshSettings(rel_loc, rel_rot, visible)` sur
-- Pawn. Le mesh donné à Character(...) peut donc être CACHÉ. Il ne sert plus
-- qu'à trois choses, toutes invisibles : porter le squelette, jouer
-- l'animation, et dimensionner la capsule de collision.
--
-- Tout ce qui se VOIT vient alors d'un slot, peau comprise. Une armure occupe
-- le slot `torse` et la pièce de peau qui s'y trouvait en sort : elle REMPLACE
-- au lieu de recouvrir. C'est aussi ce qui rend chaque partie modifiable,
-- visage inclus, puisque plus rien n'est cuit dans le mesh de base.
--
-- ── LE REPLI, ET POURQUOI IL EXISTE ───────────────────────────────────────────
-- `Modular.PorteurCachable` est faux pour une famille sans peau découpée. La
-- cacher rendrait le joueur INVISIBLE — un défaut bien pire que celui qu'on
-- corrige, et muet. Dans ce cas le mesh reste visible et on retombe sur
-- l'ancien comportement.
--
-- L'appel est isolé par `pcall` : `SetMeshSettings` est récent, et un client
-- plus ancien le refuserait. Nu, il tuerait tout l'habillage et le personnage
-- sortirait sans le moindre vêtement, sans indice de la cause.

-- ── Morphologie ───────────────────────────────────────────────────────────────
--
-- Seul `base_morphable` porte des morph targets : 290, cuits depuis les packs
-- MakeHuman du prototype web. Sur tout autre corps, `SetMorphTarget` ne lève
-- pas et ne fait rien — c'est pour ça qu'on vérifie la FAMILLE avant d'essayer,
-- plutôt que d'appeler dans le vide et de croire que ça marche.

--- Applique des réglages de morphologie sur un personnage.
---
--- `reglages` porte les identifiants de CURSEUR (`nose-hump`), pas des noms de
--- morph : c'est `Morphs.Resoudre` qui traduit, et qui remet à zéro l'extrémité
--- opposée. Sauter cette étape laisserait les deux morphs d'un axe actifs à la
--- fois, où ils se contrarient.
---@param character table
---@param corps table      entrée de Modular.CORPS
---@param reglages table|nil  { [id_curseur] = nombre }
---@return integer  nombre de morphs posés
function Builder.AppliquerMorphs(character, corps, reglages)
    if (not character or type(corps) ~= "table") then return 0 end
    if (corps.famille ~= "mpfb") then return 0 end

    local Morphs = catalogue("Morphs", "Morphs.lua")
    if (not Morphs) then return 0 end

    local poids = Morphs.Resoudre(reglages)

    -- Les curseurs de CORPS s'ajoutent a ceux du visage. Ils vivent dans la
    -- meme table de reglages, prefixes par `@` : aucun identifiant MakeHuman
    -- ne commence ainsi, la separation est donc sans ambiguite.
    --
    -- ⚠ `Morphs.Resoudre` ecrit des ZEROS explicites pour eteindre l'extremite
    -- opposee de chaque axe. Les macros s'ajoutent APRES, sur des noms
    -- disjoints : aucun des deux ne peut ecraser l'autre.
    local Macros = catalogue("Macros", "Logic/Macros.lua")
    if (Macros) then
        for nom, valeur in pairs(Macros.Resoudre(Macros.Depuis(reglages))) do
            poids[nom] = valeur
        end
    end

    local poses = 0

    for nom, valeur in pairs(poids) do
        -- Isolé : `SetMorphTarget` est récent, et un client plus ancien le
        -- refuserait. Nu, il tuerait tout l'habillage et le personnage
        -- sortirait sans vêtements, pour une raison sans rapport.
        local ok = pcall(function() character:SetMorphTarget(nom, valeur) end)
        if (ok) then poses = poses + 1 end
    end

    return poses
end

--- Applique la silhouette et les couleurs.
---
--- ── POURQUOI C'EST SÉPARÉ DES MORPHS ─────────────────────────────────────────
--- `AppliquerMorphs` sort immédiatement hors de la famille `mpfb`. Or les deux
--- corps Stylized — Opérateur et Valkiria, ceux que le joueur choisit en
--- pratique — n'ont aucun morph target. Sans ce second chemin, ils n'auraient
--- STRICTEMENT aucun réglage d'apparence.
---
--- ── L'ORDRE N'EST PAS NÉGOCIABLE ─────────────────────────────────────────────
--- Les couleurs visent des pièces par leur `attachable_id`. Une pièce pas
--- encore attachée n'a pas d'identifiant : l'appel ne lève rien et ne peint
--- rien. Cette fonction doit donc être appelée APRÈS la boucle d'habillage, et
--- RÉAPPELÉE à chaque rhabillage — `AddSkeletalMeshAttached` repose un matériau
--- neuf, qui a perdu la teinte.
---@param character table
---@param reglages table|nil  la table plate des morphs ; les clés `#…` en sont extraites
---@param couleurs table|nil  { [id_cible] = "#rrggbb" }
---@param slots table|nil     slots réellement posés, `{ [slot] = "static"|"skeletal" }`
---@return integer  nombre de teintes posées
function Builder.AppliquerApparence(character, reglages, couleurs, slots, genre)
    if (not character) then return 0 end

    local Apparence = catalogue("Apparence", "Logic/Apparence.lua")
    if (not Apparence) then return 0 end

    -- ── Silhouette ───────────────────────────────────────────────────────────
    -- Isolée : `SetScale` existe sur Actor, mais un client plus ancien pourrait
    -- le refuser sur Character. Une teinte manquante se voit ; un habillage
    -- entier perdu pour un appel d'échelle, non.
    local echelle = Apparence.Echelle(reglages)
    if (echelle.x ~= 1 or echelle.y ~= 1 or echelle.z ~= 1) then
        pcall(function()
            character:SetScale(Vector(echelle.x, echelle.y, echelle.z))
        end)

        -- ── LA CAPSULE DOIT SUIVRE ────────────────────────────────────────────
        -- nanos la dimensionne sur les bounds du mesh AU SPAWN : un `SetScale`
        -- posterieur change la silhouette et pas la collision. Le grand flotte,
        -- le petit s'enfonce, le large traverse. Aucun message nulle part.
        --
        -- ⚠ LIRE LA BASE UNE SEULE FOIS, sur le personnage NON mis a l'echelle.
        -- `AppliquerApparence` est rappele a chaque rhabillage : relire la
        -- capsule deja agrandie et la remultiplier la ferait enfler a chaque
        -- passage. On memorise donc la base sur l'entite, ou on la lit au
        -- premier appel.
        pcall(function()
            local base = character:GetValue("narvos_capsule_base")
            if (type(base) ~= "table") then
                local r, h, ha = character:GetCapsuleSize()
                base = { rayon = r, demi_hauteur = h, demi_hauteur_accroupi = ha }
                character:SetValue("narvos_capsule_base", base, false)
            end

            local c = Apparence.Capsule(base, echelle)
            if (c) then
                character:SetCapsuleSize(c.rayon, c.demi_hauteur, c.demi_hauteur_accroupi or 0)
            end
        end)
    end

    -- ── Couleurs ─────────────────────────────────────────────────────────────
    local palette = Apparence.Couleurs(couleurs)
    local poses = 0

    for _, cible in ipairs(Apparence.CIBLES) do
        local teinte = Builder.HexToColor(palette[cible.id])

        -- ── ÉCHANGER LE MATÉRIAU AVANT DE LE TEINDRE ─────────────────────────
        --
        -- La peau porte `MI_Body`, qui n'a AUCUN paramètre de couleur : régler
        -- `Teinte` dessus ne lève rien et ne peint rien. Il faut d'abord poser
        -- `MI_NarvosPeau_<genre>`, seule instance qui expose ce paramètre.
        --
        -- ⚠ SEULEMENT SI LE JOUEUR A CHOISI UNE TEINTE. Au défaut, on ne touche
        -- à rien : les corps de base gardent exactement leur matériau et leur
        -- apparence d'origine. Poser l'instance « au cas où » remplacerait un
        -- matériau qui marche par un autre, pour un résultat identique.
        local echange = cible.materiau
            and palette[cible.id] ~= nil
            and palette[cible.id] ~= cible.defaut
        if (echange and teinte) then
            local chemin = cible.materiau
            if (chemin:find("%%s")) then
                chemin = chemin:format(tostring(genre or "M"))
            end
            for _, slot in ipairs(cible.slots or {}) do
                if (slots == nil or slots[slot]) then
                    pcall(function() character:SetMaterial(chemin, -1, slot) end)
                end
            end
        end

        if (teinte) then
            for _, slot in ipairs(cible.slots or {}) do
                -- Ne peindre QUE ce qui est posé. Viser un slot vide ne lève
                -- rien côté Lua, mais nanos journalise un avertissement par
                -- appel : quatre cibles × six slots feraient vingt-quatre
                -- lignes à chaque clic de l'écran de création, et le vrai
                -- avertissement s'y noierait. Même raison que `narvos_slots`.
                if (slots == nil or slots[slot]) then
                    local ok = pcall(function()
                        character:SetMaterialColorParameter(cible.param, teinte, -1, slot)
                    end)
                    if (ok) then poses = poses + 1 end
                end
            end
        end
    end

    return poses
end

--- Rend le PORTEUR (le mesh nanos sous un corps Blueprint) invisible sans
--- l'arreter d'animer. UNE methode pour tous les ponts MetaHuman.
---
--- ── POURQUOI PAR MATERIAU ────────────────────────────────────────────────────
--- Le MetaHuman COPIE la pose du porteur (RetargetPoseFromMesh, mode PARENT). Un
--- mesh CACHE par `SetMeshSettings(..., false)` peut cesser de rafraichir ses os
--- (VisibilityBasedAnimTickOption) : le MetaHuman figerait en pose de reference.
--- Rendu sous `Mat_Invisible` — le materiau que le pack pose lui-meme sur son
--- mesh pilote — il reste anime. Jusqu'au 2026-09-13, ce fichier CACHAIT et
--- Server/MetaHumain.lua passait par le MATERIAU (rapport Fable du 13/09) : deux
--- methodes pour un meme porteur, une seule pouvait etre juste.
---
--- ⚠ NON TRANCHE EN JEU. Sans le materiau au catalogue, repli sur le masquage —
--- et on le DIT, parce qu'un MetaHuman fige ressemble a un bug d'animation.
---@param character table
---@return string methode  "materiau" | "cache" | "echec"
function Builder.MasquerPorteur(character)
    local MH = catalogue("MetaHumainCatalogue", "MetaHumain.lua")
    local invisible = MH and MH.MATERIAU_INVISIBLE
    if (type(invisible) == "string" and invisible ~= "") then
        local ok = pcall(function()
            character:SetMeshSettings(Vector(0, 0, 0), Rotator(0, -90, 0), true)
            character:SetMaterial(invisible, -1)
        end)
        if (ok) then return "materiau" end
    end
    local cache = pcall(function()
        character:SetMeshSettings(Vector(0, 0, 0), Rotator(0, -90, 0), false)
    end)
    if (cache) then
        Console.Warn("[NARVOS] porteur CACHE faute de materiau invisible : le MetaHuman peut figer")
        return "cache"
    end
    return "echec"
end

--- L'inverse exact de `MasquerPorteur` : materiaux d'origine, mesh rendu. Sans
--- lui, quitter un corps Blueprint laissait un personnage INVISIBLE — le porteur
--- restait sous `Mat_Invisible`.
---@param character table
function Builder.RendrePorteur(character)
    pcall(function() character:ResetMaterial(-1) end)
    pcall(function() character:SetMeshSettings(Vector(0, 0, 0), Rotator(0, -90, 0), true) end)
end

--- Pose le Blueprint d'un corps du systeme achete, et masque le porteur.
---
--- ── POURQUOI CE N'EST PAS UNE VARIANTE DE `Habiller` ─────────────────────────
--- `Habiller` retire, pose et compte des PIECES. Ici il n'y en a aucune, et il
--- n'y en aura pas : la famille `metahuman` est generee sans piece, exprès.
--- Melanger les deux aurait donne une fonction dont la moitie du corps ne
--- s'execute jamais, et personne n'aurait su laquelle.
---
--- ── CE QUI N'EST PAS FAIT ICI, ET POURQUOI ───────────────────────────────────
--- Ni morphs ni couleurs : les deux visent le mesh de BASE ou les pieces
--- attachees, tous masques ou absents. Le systeme achete a ses propres reglages
--- (Meta Body Tool : Head Size, Chest, Waist, Thigh, Height, Arm Length) et ils
--- passent par `CallBlueprintEvent`, pas par `SetMorphTarget`.
---
--- ── ⚠ NON PROUVE EN JEU ──────────────────────────────────────────────────────
--- Qu'un Blueprint attache a un Character suive sa capsule et son animation. Le
--- pont par retarget (Server/MetaHumain.lua) le fait depuis le 11/09 et tient,
--- mais avec des MESHES, pas un acteur Blueprint. Le premier verdict est visuel.
---@param character table
---@param corps table  entree de Modular.CORPS portant un champ `blueprint`
---@return boolean ok
---@return string|nil raison
function Builder.HabillerBlueprint(character, corps, metacustom)
    -- Le porteur disparait AVANT la pose : dans l'ordre inverse, le mannequin
    -- nanos apparait une image avant d'etre masque, et ca se voit a chaque
    -- changement de corps dans l'ecran de creation.
    local masque = Builder.MasquerPorteur(character)
    if (masque == "echec") then
        Console.Error("[NARVOS] MetaHuman : porteur impossible a masquer, "
            .. "il restera VISIBLE sous le Blueprint")
    end

    -- ── RETIRER CE QUI ETAIT POSE ────────────────────────────────────────────
    -- Un personnage peut arriver ici en venant d'un corps MODULAIRE — meme
    -- porteur, meme genre, donc l'entite n'est pas recreee. Ses pieces sont
    -- encore attachees : sautees, elles resteraient visibles PAR-DESSUS le
    -- Blueprint, et le joueur verrait une armure Trooper flotter sur un
    -- MetaHuman. On retire d'apres ce qui etait REELLEMENT pose, les deux
    -- methodes d'attachement n'etant pas interchangeables.
    local occupes = character:GetValue("narvos_slots") or {}
    for slot, nature in pairs(occupes) do
        if (nature == "static") then
            pcall(function() character:RemoveStaticMeshAttached(slot) end)
        else
            pcall(function() character:RemoveSkeletalMeshAttached(slot) end)
        end
    end
    pcall(function() character:SetValue("narvos_slots", {}, false) end)

    -- ⚠ `Narvos.MetaHumainBP` vit dans le package narvos-map-proto, pas ici. Le
    -- global `Narvos` est le pont etabli entre les deux (voir `catalogue`
    -- ci-dessus). Absent, on le DIT : un corps invisible sans un mot serait le
    -- pire des resultats.
    local MHBP = Narvos and Narvos.MetaHumainBP
    if (not MHBP) then
        Console.Error("[NARVOS] MetaHuman : Narvos.MetaHumainBP absent — "
            .. "le corps " .. tostring(corps.blueprint) .. " ne sera pas pose")
        return false, "MetaHumainBP non cable"
    end

    local ok, raison = MHBP.Poser(character, corps.genre, corps.blueprint)
    if (not ok) then
        Console.Error("[NARVOS] MetaHuman : pose refusee — " .. tostring(raison))
        return false, raison
    end

    -- L'apparence du Meta Customization System part sur le Blueprint en valeur
    -- SYNCHRONISEE : chaque client l'applique lui-meme (Client/MetaCustom.lua),
    -- y compris celui qui arrive apres la pose.
    if (type(metacustom) == "table" and MHBP.Apparence) then
        MHBP.Apparence(character, metacustom)
    end

    Console.Log("[NARVOS] MetaHuman pose : " .. tostring(corps.blueprint)
        .. " (porteur " .. tostring(corps.asset) .. ", masque="
        .. tostring(masque) .. ")")
    return true, nil
end

--- Habille un personnage : cache le porteur si la famille le permet, puis pose
--- une pièce par slot.
---
--- `choix` ne contient QUE les intentions du joueur. Les parties qu'il n'a pas
--- touchées viennent de la tenue nue de sa famille — sans quoi un personnage
--- neuf serait un squelette invisible.
---@param character table   Character nanos
---@param corps table       entrée de Modular.CORPS (donne famille et genre)
---@param choix table|nil   { [slot] = id_piece | false }
---@param morphs table|nil  { [id_curseur] = nombre } — les `#…` valent pour TOUS les corps,
---                         le reste est ignoré hors famille mpfb
---@param couleurs table|nil { [id_cible] = "#rrggbb" }
---@param metacustom table|nil apparence NORMALISEE du Meta Customization System
---@return boolean ok
---@return string|nil raison
function Builder.Habiller(character, corps, choix, morphs, couleurs, metacustom)
    if (not character) then return false, "personnage nil" end
    if (type(corps) ~= "table") then return false, "corps nil" end

    local Modular = catalogue("Modular", "Modular.lua")
    local famille, genre = corps.famille, corps.genre

    -- ══ LE CORPS EST-IL UN BLUEPRINT ? ═══════════════════════════════════════
    --
    -- Les corps du Meta Customization System ne sont pas des SkeletalMesh : ce
    -- sont des Blueprints qui portent LEUR propre logique — corps, visage,
    -- cheveux, peau, tatouages, vetements. Il n'y a rien a leur attacher, et il
    -- ne faut surtout pas essayer : c'est le systeme achete qui habille.
    --
    -- Le mesh donne a `Character(...)` reste le PORTEUR — squelette, animation,
    -- capsule — et il est masque. Le Blueprint s'y attache et se voit.
    --
    -- ⚠ CE CHEMIN EST LE MEME POUR L'APERCU ET POUR LE JEU. C'est la regle du
    -- fichier : l'apercu et le personnage reel obeissent aux memes regles, sinon
    -- le joueur valide une silhouette qu'il ne retrouvera pas.
    if (corps.blueprint) then
        return Builder.HabillerBlueprint(character, corps, metacustom)
    end

    -- Le chemin inverse : un personnage qui QUITTE un corps Blueprint pour un
    -- corps modulaire. Sans ce retrait, le Blueprint reste attache et le joueur
    -- porte les deux corps l'un dans l'autre. Il ne se voit qu'a l'usage —
    -- `Habiller` est rappele a chaque changement de vetement.
    if (Narvos and Narvos.MetaHumainBP) then
        Narvos.MetaHumainBP.Retirer(character)
    end

    local cachable = Modular.PorteurCachable(famille, genre)
    if (cachable) then
        -- Rotation reprise du défaut nanos : le mesh de base est tourné de -90°
        -- en lacet pour regarder l'avant de la capsule. La passer explicitement
        -- évite de dépendre d'un défaut que le client a déjà corrigé une fois.
        local ok, err = pcall(function()
            character:SetMeshSettings(Vector(0, 0, 0), Rotator(0, -90, 0), false)
        end)
        if (not ok) then
            cachable = false
            Console.Error("[NARVOS] SetMeshSettings indisponible, corps laisse visible : "
                .. tostring(err))
        end
    end

    -- Sans porteur caché, poser la peau par-dessus le mesh visible ne ferait
    -- qu'ajouter la couche qu'on cherche à supprimer. On s'en tient alors aux
    -- vêtements demandés.
    local tenue = cachable
        and Modular.TenueComplete(famille, genre, choix)
        or (choix or {})

    -- On itère la LISTE des slots : en Lua un slot vide DISPARAÎT de la table,
    -- et `pairs` ne verrait jamais qu'une pièce vient d'être retirée.
    -- ── CE QUI EST DÉJÀ POSÉ ──────────────────────────────────────────────────
    --
    -- On retient sur l'entité quel slot porte quoi. Sans cette mémoire, il
    -- fallait appeler les deux `Remove` sur les neuf slots à chaque rhabillage,
    -- et nanos avertissait pour chacun :
    --
    --     RemoveSkeletalMeshAttached: There is no SkeletalMesh attached with ID 'visage'!
    --
    -- Vingt lignes par aperçu, à chaque clic de l'écran de création. Le journal
    -- devenait illisible, et un VRAI avertissement s'y serait noyé.
    --
    -- `SetValue(..., false)` : cet état n'a aucun intérêt pour le client, il ne
    -- sert qu'au serveur pour savoir quoi retirer.
    local occupes = character:GetValue("narvos_slots") or {}
    local neufs = {}

    local poses = 0
    for _, slot in ipairs(Modular.SLOTS) do
        -- Un slot peut accueillir une pièce skinnée (casque Trooper, 68 os) ou
        -- une pièce statique (coiffure, 2 os sur son propre squelette). On
        -- retire selon ce qui était RÉELLEMENT posé : les deux méthodes ne se
        -- remplacent pas l'une l'autre.
        local pose_avant = occupes[slot]
        if (pose_avant == "static") then
            pcall(function() character:RemoveStaticMeshAttached(slot) end)
        elseif (pose_avant) then
            character:RemoveSkeletalMeshAttached(slot)
        end

        local piece = Modular.PIECES[tenue[slot]]
        -- Le genre et la famille sont revérifiés ici : le client peut envoyer
        -- n'importe quel identifiant, et une pièce de la mauvaise morphologie
        -- ne se déforme pas correctement.
        local bon_genre = piece and (piece.genre == genre or piece.genre == "*")
        if (piece and bon_genre and piece.famille == famille) then
            local ok, err = pcall(function()
                if (piece.attache == "static") then
                    -- Un accessoire rigide suit l'os par un SOCKET, sans être
                    -- skinné. `head` fait partie des 68 os du corps, donc il
                    -- existe sur toutes nos morphologies.
                    character:AddStaticMeshAttached(slot, piece.asset, piece.socket or "head")
                else
                    character:AddSkeletalMeshAttached(slot, piece.asset)
                end
            end)
            if (ok) then
                poses = poses + 1
                neufs[slot] = (piece.attache == "static") and "static" or "skeletal"
            else
                Console.Error("[NARVOS] habillage " .. slot .. " -> "
                    .. tostring(piece.asset) .. " : " .. tostring(err))
            end
        end
    end

    -- Écrit APRÈS la boucle : un échec en cours de route ne doit pas laisser
    -- croire qu'une pièce est posée alors qu'elle ne l'est pas — on retirerait
    -- au prochain passage quelque chose qui n'existe pas, et l'avertissement
    -- reviendrait.
    character:SetValue("narvos_slots", neufs, false)

    -- La morphologie APRÈS les pièces : elle ne dépend d'aucune d'elles, mais
    -- l'ordre inverse ferait passer les morphs avant que le mesh soit stable.
    Builder.AppliquerMorphs(character, corps, morphs)

    -- Silhouette et couleurs EN DERNIER, et `neufs` en argument : une teinte
    -- vise une pièce par son `attachable_id`, qui n'existe qu'une fois la pièce
    -- attachée. Appelée plus haut, cette ligne ne peindrait rien — sans erreur,
    -- ce qui est le pire des cas.
    -- `genre` sert a choisir l'instance de peau : les textures du corps
    -- masculin et feminin sont distinctes, donc les instances aussi.
    Builder.AppliquerApparence(character, morphs, couleurs, neufs,
        type(corps) == "table" and corps.genre or nil)

    return true, nil
end

return Builder
