-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Spawner.lua — faire apparaître PNJ, monstres et créatures en jeu.
--
-- Câblage : Package.Require("Server/Spawner.lua") depuis Server/Index.lua, APRÈS
-- Server/Session.lua.
--
-- ── DEUX CLASSES nanos, ET LE CRITÈRE QUI LES SÉPARE ──────────────────────────
--   · `Character`       impose SKEL_Mannequin (68 os) mais joue TOUTES nos
--                       animations et accepte les pièces modulaires attachées.
--   · `CharacterSimple` accepte n'importe quel mesh — y compris un static mesh —
--                       et ne sait animer que par son propre Animation Blueprint.
--
-- Le critère n'est PAS le rôle du PNJ mais le SQUELETTE de son mesh, et il se
-- MESURE — il ne se devine pas.
--
-- ⚠ CORRECTION DU 2026-09-04. On avait d'abord cru les PNJ non riggés :
-- `narvos-skeleton-compat.mjs` leur comptait « un ou deux os ». C'était FAUX.
-- Après import, `adk-verify-skeletons.py` mesure :
--
--     60 SkeletalMesh · 37 squelettes fraîchement créés · 208 AnimSequence
--
-- Ce sont de vrais personnages animés, sur leurs propres rigs. Ils ne peuvent
-- donc pas passer par `Character`, qui impose SKEL_Mannequin, mais bien par
-- `CharacterSimple` — d'où le drapeau `simple` du catalogue, et non `statique`.
--
-- Se tromper de classe ne lève pas : `Character` sur un mesh étranger affiche la
-- capsule de collision, un cylindre blanc, et la partie continue.
--
-- ── CE QUE CE MODULE NE FAIT PAS ──────────────────────────────────────────────
-- Aucune IA. Un PNJ apparu reste sur place. Le brancher sur `factions-ai` est un
-- chantier distinct, et un PNJ immobile est déjà utile : peupler, tester une
-- échelle, vérifier un matériau. Prétendre le contraire donnerait un système qui
-- promet un comportement qu'il n'a pas.
-- ═══════════════════════════════════════════════════════════════════════════════

local Spawner = {}

local Catalogue = Narvos.Spawnables
local Session = Narvos.SessionServeur

--- Entités vivantes par joueur.
Spawner.PLAFOND_PAR_JOUEUR = 25

--- Délai minimal entre deux invocations, en millisecondes.
Spawner.DELAI_MS = 400

--- Distance d'apparition devant le joueur, en centimètres.
--- Plus loin que les props : un corps de 180 cm posé à 250 cm chevaucherait le
--- joueur dès qu'il avance.
Spawner.DISTANCE = 420.0

--- Élévation. Les `Character` de nanos spawnent au-dessus du sol et retombent ;
--- partir des pieds les ferait traverser le plancher.
Spawner.HAUTEUR = 100.0

-- ── OPTIMISATION PAR DISTANCE ─────────────────────────────────────────────────
--
-- ⚠ CE N'EST PAS UN RÉGLAGE DE TICK D'ANIMATION. C'est du RÉSEAU, et il faut le
-- lire dans ce sens : nanos calcule, pour chaque joueur et chaque acteur
-- synchronisé, une « pertinence » qui est le POURCENTAGE DE TICKS où les
-- snapshots de cet acteur lui sont réellement envoyés.
--
--     pertinence = clamp(100 - ((distance / 1000) - 1) * niveau * multiplicateur, 0, 100)
--
-- Seul le trafic **unreliable** est concerné — mouvement, actions transitoires.
-- Les événements distants, les spawns et les changements de valeur passent
-- toujours en entier, quelle que soit la distance. Baisser la pertinence d'un
-- PNJ lointain ne le fait donc pas disparaître : il bouge moins souvent.
--
-- ── POURQUOI LE FAIRE ICI ────────────────────────────────────────────────────
-- Cet appel n'existait NULLE PART dans le dépôt (0 occurrence, mesuré le
-- 2026-09-09), alors que la contrainte annoncée du projet est 400 joueurs. Avec
-- 25 PNJ par joueur (`PLAFOND_PAR_JOUEUR`), c'est le poste de trafic qui monte
-- le plus vite : chaque PNJ est synchronisé vers chaque joueur à portée.
--
-- ── D'OÙ VIENNENT CES NOMBRES ────────────────────────────────────────────────
-- Ils ne sont pas choisis, ils sont DÉRIVÉS de `IaServeur.PORTEE_MONDE` — la
-- distance au-delà de laquelle un joueur n'est même pas proposé comme cible à un
-- PNJ. Un PNJ plus loin que ça ne peut RIEN faire qui concerne ce joueur.
--
-- On veut donc que la synchronisation s'arrête bien APRÈS cette portée, jamais
-- avant : un PNJ doit être déjà fluide quand il devient capable d'agir. D'où un
-- facteur de marge, et une coupure calculée, pas recopiée.
--
-- Par défaut (niveau 4, marge 3) la coupure passe de 26 000 unités — le réglage
-- serveur seul — à 18 000, soit 180 m. Les mannequins de test, eux, n'agissent
-- jamais : leur marge est plus courte.

--- Niveau `distance_optimization` du serveur.
---
--- ⚠ RECOPIÉ DE `Server/Config.toml`, faute de mieux : l'API nanos n'expose pas
--- ce réglage au Lua (`Server.GetMaxPlayers` et `GetTickRate` existent, pas
--- celui-ci). Les deux valeurs sont donc confrontées par
--- `scripts/lua-harness/constantes-check.mjs` — un écart ferait calculer une
--- portée qui ne correspond à rien.
Spawner.NIVEAU_OPTIMISATION = 4

--- Marge, en multiples de `IaServeur.PORTEE_MONDE`, avant la coupure de synchro.
Spawner.MARGE_PORTEE = 3.0

--- Marge des mannequins de test : ils ne prennent jamais de cible.
Spawner.MARGE_PORTEE_TEST = 1.5

-- ── ANIMATION DES CharacterSimple ───────────────────────────────────────────
--
-- ⚠ POURQUOI LE 4ᵉ ARGUMENT DU CONSTRUCTEUR RESTE VIDE. Ce paramètre attend
-- un Animation Blueprint (`BlueprintPath`, cf. `Classes/CharacterSimple.json`)
-- fabriqué POUR LE SQUELETTE du mesh. Or il n'en existe AUCUN de cuit pour
-- ces rigs : 0 entrée ABP dans `Assets.toml` du pack narvos (grep « ABP_ »),
-- et le pack de base n'en a que trois — `ABP_Offroad`, `ABP_StackOBot`,
-- `ABP_Chicken` — pour trois squelettes qui ne sont ceux d'aucun de nos PNJ.
-- En passer un quand même déformerait le modèle, sans erreur.
--
-- LA MÉTHODE CORRECTE EST DONC `PlayAnimation` (même JSON, autorité
-- « authority » — le serveur, qui spawne) avec une AnimSequence DU MÊME
-- SQUELETTE : chaque PNJ a été importé avec ses animations, cuites à côté de
-- son mesh. Le choix ci-dessous est fait PAR LE CONTENU du clip (durée,
-- activité, déplacement, hanches) et non par son nom — mesuré le 2026-09-09,
-- les noms de clips Meshy sont décalés d'un dossier à l'autre (dans
-- `mercenaire_humain_tank`, le clip nommé « Walking » CONTIENT l'idle).
--
-- ⚠ CETTE TABLE N'EST PAS RECOPIÉE À LA MAIN. Elle est générée depuis les
-- verdicts de `scripts/lua-harness/pnj-anims-verif.mjs` (mesure des GLB
-- sources) et chaque entrée est revérifiée contre `Assets.toml` par
-- `scripts/lua-harness/pnj-anims.mjs` — y compris la règle « animation dans
-- le même dossier que le mesh », qui vaut compatibilité de squelette
-- (`pnj-squelettes.mjs` : 34/34, noms d'os + ordre + pose de repos).
--
-- ⚠ CECI AJOUTE DU TICK, il n'en économise pas : ces PNJ coûtaient le minimum
-- précisément parce qu'ils n'animaient rien.
Spawner.ANIM_REPOS = {
    soldat_humain = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsIdle_11_13",
    soldat_femme = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsRunning_13",
    soldat_vert = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsIdle_11_15",
    soldat_mercenaire = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsIdle_11_14",
    mercenaire_tank = "mercenaire_tank_walking_Anim",
    mercenaire_humain_tank = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsWalking_11",
    sou_major = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsDead_17",
    general = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsRunning",
    general_mission = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsDead_2",
    gran_cheff = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsIdle_11_3",
    kgnitig = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsIdle_11_9",
    grunt = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsJazz_Hands_inplace",
    mercenaire_alien = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsRunning_10",
    gronomi_mineur = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsRunning_7",
    gronomi_ardent = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsIdle_11_5",
    gronomi_infaterie = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsDead_6",
    grongnoni_majeur = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsDead_4",
    profhete = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsIdle_11_12",
    profhete_alien = "profhete_alien_walking_Anim",
    venom_stalker = "venom_stalker_walking_Anim",
    aquarys_crab = "Meshy_AI_quadruped_model_Animation_Walking_withSkin_Anim",
    canopy_prophet_female = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsRunning_18",
    canopy_prophet_male = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsWalking_19",
    mycelium_host_female = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsWalking_20",
    mycelium_host_male = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsWalking_21",
    parasite_sower_female = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsRunning_22",
    parasite_sower_male = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsWalking_23",
    pressure_manipulator_female = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsWalking_24",
    pressure_manipulator_male = "Meshy_AI_biped_Meshy_AI_Meshy_Merged_AnimationsWalking_25",
    gatonomi = "Monster03_AllAnimMonster03_Idle",
    gralynis_boss = "Monster04_AllAnimMonster04_Idle",
    lizard = "lizardrig_001_rig_001_Idle_1",
}

--- PNJ simples SANS animation jouable, prouvé — ils restent des statues tant
--- que personne n'a tranché leur clip en jeu ou dans l'éditeur :
---   · blackorn  : 10 clips mixamo anonymes, TOUS en déplacement (33 à 92
---     unités XZ) — aucun ne tient sur place ; deux finissent en l'air.
---   · mob_boss  : 2 clips de 0,03 s et 0,07 s, activité nulle — des poses,
---     pas des animations.
--- Le harnais `pnj-anims.mjs` exige que cette liste et `ANIM_REPOS` couvrent
--- exactement les entrées `simple` du catalogue, sans trous ni doublons.
Spawner.ANIM_BLOQUES = {
    blackorn = true, mob_boss = true,
    -- Civils MetaCustom (2026-09-19) : corps CharacterSimple portant leurs
    -- propres animations de squelette, aucune PlayAnimation scriptée.
    civil_sk_meta_female_base = true,
    civil_sk_metap = true,
    civil_sk_metap1 = true,
}

--- Multiplicateur donnant une coupure de synchro à `distance` unités.
---
--- La pertinence tombe à 0 quand `((d / 1000) - 1) * niveau * mult = 100`.
--- On inverse. En deçà de 1 000 unités la formule n'a pas de solution utile
--- (la pertinence y vaut déjà 100) : on rend alors 0, qui signifie « toujours
--- pertinent » — jamais un nombre négatif, qui inverserait la courbe.
---@param distance number  coupure voulue, en unités Unreal
---@return number
function Spawner.MultiplicateurPour(distance)
    local d = tonumber(distance) or 0
    local pas = (d / 1000.0) - 1.0
    if (pas <= 0) then return 0.0 end
    return 100.0 / (pas * Spawner.NIVEAU_OPTIMISATION)
end

--- Coupure que le réglage serveur applique DÉJÀ, multiplicateur à 1.
---
--- C'est le plafond : on peut couper plus tôt, jamais plus tard. Un
--- multiplicateur sous 1 étendrait la synchronisation au-delà de ce que le
--- serveur fait de lui-même — dépenser de la bande passante en croyant en
--- économiser.
---@return number
function Spawner.CoupureParDefaut()
    return 1000.0 * (100.0 / Spawner.NIVEAU_OPTIMISATION + 1.0)
end

-- ── État ──────────────────────────────────────────────────────────────────────
--
-- ⚠ DÉCLARÉS EN TÊTE, avant le `Player.Subscribe("Destroy")` qui les purge.

local invoques = {}
local derniere = {}

local horloge_ms = 0
Timer.SetInterval(function() horloge_ms = horloge_ms + 100 end, 100)

-- ── Invocation ────────────────────────────────────────────────────────────────

---@param character table
---@return table
local function DevantLe(character)
    local origine = character:GetLocation()
    local avant = character:GetRotation():GetForwardVector()
    return Vector(
        origine.X + avant.X * Spawner.DISTANCE,
        origine.Y + avant.Y * Spawner.DISTANCE,
        origine.Z + Spawner.HAUTEUR)
end

--- Fait apparaître une entrée du catalogue devant le joueur.
---@param player table
---@param id string
---@param niveau number|nil  niveau manuel, entier entre 1 et le niveau maximal
---@return boolean, string|nil
function Spawner.Invoquer(player, id, niveau)
    local entree = Catalogue.Trouver(id)
    if (not entree) then return false, "Entree inconnue" end

    local niveau_max = (Narvos.Progression and Narvos.Progression.NiveauMax
        and Narvos.Progression.NiveauMax()) or 50
    local niveau_pnj = tonumber(niveau)
    if (niveau_pnj == nil) then niveau_pnj = tonumber(entree.niveau) or 1 end
    if (niveau_pnj ~= math.floor(niveau_pnj)
            or niveau_pnj < 1 or niveau_pnj > niveau_max) then
        return false, "Niveau entier de 1 a " .. tostring(niveau_max) .. " requis"
    end

    local asset = Catalogue.Asset(id)
    if (not asset) then return false, "Asset absent du pack" end

    local character = player:GetControlledCharacter()
    if (not character) then return false, "Aucun personnage" end

    local liste = invoques[player]
    if (not liste) then liste = {}; invoques[player] = liste end

    if (#liste >= Spawner.PLAFOND_PAR_JOUEUR) then
        return false, "Maximum de " .. Spawner.PLAFOND_PAR_JOUEUR .. " invocations"
    end

    local precedente = derniere[player]
    if (precedente and (horloge_ms - precedente) < Spawner.DELAI_MS) then
        return false, "Trop rapide"
    end

    local position = DevantLe(character)
    -- Face au joueur : `+ 180` sur le yaw. Un PNJ qui apparaît de dos donne
    -- l'impression d'un bug avant même qu'on ait regardé son modèle.
    local rotation = Rotator(0, character:GetRotation().Yaw + 180, 0)

    local ok, entite
    if (entree.simple) then
        -- `CharacterSimple` accepte n'importe quel mesh — static, ou skeletal
        -- sur un squelette étranger. Pas d'Animation Blueprint : lui en passer
        -- un fabriqué pour un autre squelette déformerait le modèle sans erreur.
        ok, entite = pcall(CharacterSimple, position, rotation, asset, "",
            CollisionType.Auto, true)
    else
        ok, entite = pcall(Character, position, rotation, asset)
        -- NOTRE locomotion. `CharacterSimple` (la branche du dessus) n'expose
        -- pas cette methode : seul le vrai `Character` la recoit.
        if (ok and entite) then Narvos.CharacterBuilder.PoserLocomotion(entite) end
    end

    if (not ok or not entite) then return false, "Invocation impossible" end

    -- Animation de repos, en boucle. Voir le pavé au-dessus d'ANIM_REPOS :
    -- aucun Animation Blueprint compatible n'est cuit, la séquence jouée est
    -- choisie par contenu sur le MÊME squelette, et le harnais
    -- `pnj-anims.mjs` vérifie que la référence existe dans le pack.
    -- Un PNJ sans entrée (ANIM_BLOQUES) reste une statue — dit, pas caché.
    local anim_jouee = false
    if (entree.simple) then
        local anim = Spawner.ANIM_REPOS[id]
        if (anim) then
            anim_jouee = pcall(function()
                entite:PlayAnimation(Catalogue.PACK .. "::" .. anim, "", true)
            end)
        end
    end

    -- Échelle : certaines créatures sont exportées à une taille absurde. Le
    -- crabe Aquarys demande x40 — sans ça il apparaît de la taille d'un pouce.
    -- ⚠ ANIMÉ, l'échelle n'est PAS la même : l'animation de repos des GLB Meshy
    -- porte déjà ×100 sur l'os racine (mesure du 2026-09-13,
    -- scripts/narvos-pnj-facteur-anim.mjs). Poser `echelle` sur un PNJ animé
    -- donnait 150 à 175 m ; `echelle_animee` (générée) est celle qui rend sa taille.
    local echelle = tonumber(anim_jouee and entree.echelle_animee or entree.echelle)
    if (echelle and echelle ~= 1) then
        pcall(function() entite:SetScale(Vector(echelle, echelle, echelle)) end)
    end

    -- ⚠ APRES L'ECHELLE, PAS AVANT. Un PNJ agrandi occupe plus d'ecran et se
    -- remarque de plus loin : le guide nanos cite explicitement « a scaled up
    -- actor » comme cas ou il faut GARDER la pertinence longtemps. On compense
    -- donc la coupure par l'echelle, sinon un geant a 150 m saccaderait alors
    -- qu'il est le plus visible de la scene.
    --
    -- ⚠ MAIS BORNEE PAR LA COUPURE PAR DEFAUT. `echelle` vaut 100 pour tout le
    -- monde (conversion metre -> centimetre) SAUF le crabe Aquarys, a 40 000 :
    -- x400. Sans borne, sa coupure irait a 72 km, soit un multiplicateur de
    -- 0,35 — on synchroniserait ce PNJ TROIS FOIS PLUS LOIN que le reglage
    -- serveur ne le fait. On depenserait de la bande passante en croyant en
    -- economiser. La regle : on peut couper plus tot que le defaut, jamais
    -- plus tard.
    pcall(function()
        local marge = (entree.role == "test") and Spawner.MARGE_PORTEE_TEST or Spawner.MARGE_PORTEE
        local base = (Narvos.IaServeur and Narvos.IaServeur.PORTEE_MONDE) or 6000.0
        local grandeur = math.max(1.0, (echelle or 100) / 100.0)
        local coupure = math.min(base * marge * grandeur, Spawner.CoupureParDefaut())
        entite:SetDistanceOptimizationMultiplier(Spawner.MultiplicateurPour(coupure))
    end)

    -- ⚠ CONFIER LE PNJ A L'IA, sinon il apparait et reste plante. C'est le seul
    -- point d'entree : un PNJ invoque autrement ne bougera pas, et rien ne le
    -- signalera. `Prendre` lit `entree.role` pour choisir le profil, et un role
    -- inconnu retombe sur `passif` — jamais sur un comportement agressif.
    if (Narvos.IaServeur) then
        local pris, erreur = pcall(function()
            Narvos.IaServeur.Prendre(entite, entree, { niveau = niveau_pnj })
        end)
        if (not pris) then
            Console.Warn("[SPAWNER] IA refusee pour " .. tostring(entree and entree.id)
                .. " : " .. tostring(erreur))
        end
    end

    -- ⚠ MEME RAISON QUE POUR LES PROPS : sans l'identifiant de catalogue pose
    -- sur l'entite, l'export ne saurait pas QUELLE espece a produit ce corps.
    pcall(function() entite:SetValue("narvos_spawnable", id, false) end)
    -- Identite SYNCHRONISEE (3e argument `true`). Le diagnostic client
    -- (Client/Diagnostic.lua) ne peut pas lire le mesh d'un personnage — aucun
    -- accesseur cote client — il le nomme par cette valeur, et compare l'echelle
    -- demandee a la taille RENDUE.
    pcall(function()
        entite:SetValue("narvos_pnj", id, true)
        entite:SetValue("narvos_echelle", echelle or 1, true)
        -- Tous les PNJ portent le niveau choisi, y compris les rôles passifs.
        -- L'IA réécrit la même valeur pour les hostiles avec leurs statistiques.
        entite:SetValue("narvos_niveau", niveau_pnj, true)
    end)

    liste[#liste + 1] = entite
    derniere[player] = horloge_ms

    return true, nil
end

--- Les PNJ qu'un joueur a invoques, avec leur entree de catalogue.
---
--- ⚠ ACCESSEUR AJOUTE POUR L'EXPORT. `invoques` est local a ce fichier, et c'est
--- bien : personne d'autre ne doit pouvoir y ecrire. Mais l'export a besoin de
--- LIRE ce qui a ete pose pour le figer en catalogue — d'ou cette lecture seule,
--- qui rend une copie et jamais la table elle-meme.
---@param player table
---@return table  liste de { entite, id }
function Spawner.Invoques(player)
    local liste = invoques[player]
    if (not liste) then return {} end
    local sortie = {}
    for _, e in ipairs(liste) do
        if (e and e:IsValid()) then sortie[#sortie + 1] = e end
    end
    return sortie
end

--- Retire la dernière invocation encore valide.
---@param player table
---@return boolean
function Spawner.RetirerDernier(player)
    local liste = invoques[player]
    if (not liste) then return false end

    while (#liste > 0) do
        local e = table.remove(liste)
        if (e and e:IsValid()) then e:Destroy(); return true end
    end
    return false
end

---@param player table
---@return integer
function Spawner.ToutRetirer(player)
    local liste = invoques[player]
    if (not liste) then return 0 end

    local n = 0
    for _, e in ipairs(liste) do
        if (e and e:IsValid()) then e:Destroy(); n = n + 1 end
    end
    invoques[player] = nil
    return n
end

---@param player table
---@return integer
function Spawner.Compte(player)
    local liste = invoques[player]
    if (not liste) then return 0 end

    -- ⚠ Les MORTS ne comptent pas (2026-09-15) : un cadavre reste valide jusqu'à sa
    -- destruction, et les corps remplissaient le plafond d'invocations.
    local n = 0
    for _, e in ipairs(liste) do
        local vivant = false
        pcall(function() vivant = e:IsValid() and not e:IsDead() end)
        if (vivant) then n = n + 1 end
    end
    return n
end

-- ── Réseau ────────────────────────────────────────────────────────────────────

local function EnJeu(player)
    return Session and Session.EnJeu(player)
end

-- ── LA GARDE : QUI PEUT INVOQUER ─────────────────────────────────────────────
--
-- Invoquer est un outil de GESTION (peupler, tester), pas un geste de joueur :
-- le menu passait jusqu'ici par cet événement sans le moindre contrôle, alors
-- que les commandes de développement, elles, étaient gardées. Un client modifié
-- envoyait `Narvos:Invoquer` directement.
--
-- Ce fichier ne connaît ni les comptes ni la config : `Server/Index.lua` branche
-- la vraie règle (`commandes_dev` OU administrateur). FERMÉE PAR DÉFAUT, comme
-- la garde de `Props.lua` : un oubli de branchement se voit au premier essai.
local garde = function()
    return false, "Invocation non configuree sur ce serveur (garde non branchee)"
end

--- Installe la garde d'invocation.
---@param fn fun(player:table):boolean, string|nil
function Spawner.UtiliserGarde(fn)
    if (type(fn) ~= "function") then return false end
    garde = fn
    return true
end

---@param player table
function Spawner.Envoyer(player)
    Events.CallRemote("Narvos:Spawnables", player, Reliability.Reliable, {
        roles = Catalogue.ROLES,
        entrees = Catalogue.ENTREES,
        invoques = Spawner.Compte(player),
        plafond = Spawner.PLAFOND_PAR_JOUEUR,
        niveau_max = (Narvos.Progression and Narvos.Progression.NiveauMax
            and Narvos.Progression.NiveauMax()) or 50,
    })
end

Events.SubscribeRemote("Narvos:DemanderSpawnables", function(player)
    if (not EnJeu(player)) then return end
    Spawner.Envoyer(player)
end)

Events.SubscribeRemote("Narvos:Invoquer", function(player, id, niveau)
    if (not EnJeu(player)) then return end

    local permis, refus = garde(player)
    if (not permis) then
        Events.CallRemote("Narvos:SpawnErreur", player, Reliability.Reliable,
            refus or "Invocation reservee aux administrateurs")
        return
    end

    local ok, raison = Spawner.Invoquer(player, id, niveau)
    if (not ok) then
        Events.CallRemote("Narvos:SpawnErreur", player, Reliability.Reliable, raison)
        return
    end
    Events.CallRemote("Narvos:SpawnFait", player, Reliability.Reliable,
        Spawner.Compte(player), Spawner.PLAFOND_PAR_JOUEUR)
end)

Events.SubscribeRemote("Narvos:RetirerInvocation", function(player)
    if (not EnJeu(player)) then return end

    Spawner.RetirerDernier(player)
    Events.CallRemote("Narvos:SpawnFait", player, Reliability.Reliable,
        Spawner.Compte(player), Spawner.PLAFOND_PAR_JOUEUR)
end)

Events.SubscribeRemote("Narvos:ViderInvocations", function(player)
    if (not EnJeu(player)) then return end

    local n = Spawner.ToutRetirer(player)
    Events.CallRemote("Narvos:SpawnFait", player, Reliability.Reliable, 0,
        Spawner.PLAFOND_PAR_JOUEUR)
    Events.CallRemote("Narvos:SpawnInfo", player, Reliability.Reliable,
        n .. " invocation(s) retiree(s)")
end)

--- Purge à la déconnexion : sinon les PNJ d'un joueur parti peuplent la map
--- pour toujours, et la table retient le joueur en mémoire.
Player.Subscribe("Destroy", function(player)
    Spawner.ToutRetirer(player)
    derniere[player] = nil
end)

return Spawner