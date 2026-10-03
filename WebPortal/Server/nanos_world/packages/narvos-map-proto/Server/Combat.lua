-- ═══════════════════════════════════════════════════════════════════════════════
-- Server/Combat.lua — ce qui exécute le corps-à-corps.
--
-- Câblage : Package.Require("Server/Combat.lua") depuis Server/Index.lua, APRÈS
-- Server/Session.lua.
--
-- ── LA SÉPARATION, ET POURQUOI ELLE TIENT ─────────────────────────────────────
-- `Shared/Logic/Combat.lua` DÉCIDE : quelle étape de l'enchaînement, quel
-- multiplicateur, quels dégâts, la fenêtre de contre est-elle ouverte. Il se
-- teste sans moteur (149 assertions) et n'appelle aucune API.
-- Ce fichier-ci EXÉCUTE : il fabrique les entités, pose les animations, applique
-- les nombres. Il ne décide de rien.
--
-- ── ⚠ IL N'Y A PAS DE RAYCAST ICI, ET C'EST VOULU ─────────────────────────────
-- On a longtemps cru qu'il faudrait tracer la portée du coup à la main. Deux
-- faits, tous deux vérifiés à la source, disent le contraire :
--
--   1. `Trace` est d'autorité CLIENT dans nanos (`StaticClasses/Trace.json` :
--      LineSingle, SphereSingle… toutes marquées `client`). Un serveur ne peut
--      donc PAS sonder le monde. Écrire un raycast ici n'aurait rien fait, en
--      silence.
--   2. La classe `Melee` s'en charge elle-même. Elle expose `SetBaseDamage`,
--      `SetDamageSettings(debut, duree)` — la fenêtre de dégâts DANS l'animation
--      — `SetCooldown` et `AddAnimationCharacterUse`, et elle émet `Attack`.
--      La détection de contact est à elle.
--
-- Ce fichier ne fait donc que RÉGLER l'arme avant chaque coup, et laisser nanos
-- la résoudre.
--
-- ── LES DÉGÂTS SONT POSÉS AVANT LE COUP, PAS APRÈS ────────────────────────────
-- `SetBaseDamage` prend un entier fixe ; nos dégâts, eux, dépendent de l'étape
-- de l'enchaînement, de la puissance de l'attaquant et d'un tirage critique. On
-- réécrit donc la valeur À CHAQUE coup, juste avant que nanos ne l'applique.
--
-- ⚠ Le tirage critique est fait ICI, côté serveur, jamais côté client : chaque
-- VM Lua a son propre `math.randomseed`, et deux tirages ne donneraient pas le
-- même coup.
-- ═══════════════════════════════════════════════════════════════════════════════

local CombatServeur = {}

local Combat = Narvos.Combat
local Animations = Narvos.Animations
local AnimNoms = Narvos.AnimNoms
local Session = Narvos.SessionServeur

-- ── État ──────────────────────────────────────────────────────────────────────
--
-- ⚠ DÉCLARÉS EN TÊTE. Le `Player.Subscribe("Destroy")` qui les purge est écrit
-- plus bas mais s'exécute au chargement : un `local` posé après lui se
-- résoudrait en GLOBAL nil. Piège rencontré cinq fois sur ce projet.

--- État d'enchaînement par joueur, produit par `Combat.NouvelEtat()`.
local etats = {}

--- L'arme tenue par joueur, pour la détruire au lâcher et à la déconnexion.
local armes = {}

--- Historique de choix d'animation par joueur : évite de rejouer trois fois la
--- même prise d'affilée. `Animations.Choisir` le mute lui-même.
local historiques = {}

--- Dernière réaction jouée, par personnage frappé (ms). Voir `Combat.PeutReagir`.
local reactions = {}

--- Historique des prises de réaction, PARTAGÉ : deux cibles qui encaissent au
--- même instant peuvent jouer la même prise, et ça ne se voit pas.
local historique_reactions = {}

--- Horloge de combat, en millisecondes.
--- ⚠ TEMPS RÉEL depuis le 2026-09-19 (`Server.GetTime`, StaticClasses/Server.json),
--- et NON PLUS un compteur de minuterie. Le compteur avançait de 50 ms par tour,
--- or un tour vaut 475 à 685 ms pour 500 demandés (relevé de `Sorts.lua`,
--- 2026-09-15) et le serveur en perd quand il peine : l'horloge retardait.
--- Conséquence mesurée : `enchaine_de` (420 ms × cadence pour la première
--- attaque) restait DEVANT elle, chaque second coup était refusé « Coup en
--- cours », et la chaîne ne quittait jamais l'étape 1. `os.time()` ne suffit pas
--- non plus : il compte en secondes entières, et toute la mécanique
--- d'enchaînement se joue sous la seconde.
--- Harnais : scripts/lua-harness/combat-horloge.mjs.
local function horloge_ms() return Server.GetTime() end

--- Les animations groupées par action, calculées UNE fois.
--- `Grouper` sépare prises et modes ; sans lui on jouerait le nom brut et on
--- perdrait les trois variantes de chaque attaque.
local sets = Animations.Grouper((AnimNoms and AnimNoms.NOMS) or {})

-- ── Catalogue des armes ───────────────────────────────────────────────────────
--
-- ⚠ CES NEUF MESHES SONT LES SEULS VÉRIFIÉS PRÉSENTS. Ils viennent du pack de
-- BASE nanos, relevés dans `Catalogs/Props.lua` (généré depuis le contenu
-- installé). Les cinq armes du pack `FreeflowCombatSystem` — Crowbar, Pipe,
-- Sledgehammer, Baseball_01/02 — ne sont PAS cuites : `Assets.toml` n'en porte
-- aucune. Les nommer ici aurait donné une capsule de collision blanche, sans
-- erreur et sans explication.
--
-- `allonge` et `cadence` reprennent les unités de `Shared/Logic/Combat.lua`.
-- `degats` est le socle de l'arme, avant puissance et critique.
CombatServeur.ARMES = {
    { id = "pied_de_biche", label = "Pied-de-biche", mesh = "nanos-world::SM_Crowbar_01",
      degats = 22, allonge = 150, cadence = 0.9, prise = "SingleHandedMelee" },
    { id = "batte", label = "Batte de baseball", mesh = "nanos-world::SM_BaseballBat_01",
      degats = 26, allonge = 175, cadence = 1.0, prise = "SingleHandedMelee" },
    { id = "hache", label = "Hache", mesh = "nanos-world::SM_Axe_01",
      degats = 34, allonge = 160, cadence = 1.25, prise = "DoubleHandedMelee" },
    { id = "masse", label = "Masse", mesh = "nanos-world::SM_Hammer",
      degats = 38, allonge = 140, cadence = 1.45, prise = "DoubleHandedMelee" },
    { id = "cle", label = "Cle a molette", mesh = "nanos-world::SM_PipeWrench_01",
      degats = 24, allonge = 130, cadence = 0.95, prise = "SingleHandedMelee" },
    { id = "pelle", label = "Pelle", mesh = "nanos-world::SM_Shovel_01",
      degats = 28, allonge = 180, cadence = 1.15, prise = "DoubleHandedMelee" },
}

local par_id = {}
for _, a in ipairs(CombatServeur.ARMES) do par_id[a.id] = a end

--- Fenêtre de dégâts dans l'animation, en fraction de sa durée.
--- 0,3 à 0,8 : le coup ne blesse ni au départ du geste ni pendant le retour.
--- Valeurs de l'exemple officiel de la doc (`melee.mdx`), pas inventées.
CombatServeur.DEGATS_DEBUT = 0.3
CombatServeur.DEGATS_DUREE = 0.5

-- Déclarations avancées : ces fonctions s'appellent mutuellement.
local EtatDe, ArmeDe, PoserAnimation, ReglerCoup, Annoncer

EtatDe = function(player)
    local e = etats[player]
    if (not e) then e = Combat.NouvelEtat(); etats[player] = e end
    return e
end

ArmeDe = function(player)
    local a = armes[player]
    if (a and a.entite and a.entite:IsValid()) then return a end
    return nil
end

-- ⚠ `pcall` PREND LES ARGUMENTS, on ne les capture pas dans une closure : `...`
-- est illégal dans une fonction non variadique, et Lua le refuse AU CHARGEMENT.
Annoncer = function(player, nom, ...)
    pcall(Events.CallRemote, nom, player, Reliability.Reliable, ...)
end

-- ── Poser l'animation du prochain coup ────────────────────────────────────────

--- `Combat` rend une ACTION (`ACB_Attack_01`) ; `Animations.Choisir` en tire un
--- nom complet, avec sa prise et son mode. Sans ce passage, trois coups
--- d'affilée rejoueraient exactement le même geste — nos packs livrent trois
--- prises par attaque, et c'est le seul endroit qui le sait.
---
--- ⚠ MODE `IP`, pas `RM`. « RM » = root motion : l'animation emporte la racine
--- du personnage, ce qui le déplacerait pendant le coup et le désynchroniserait
--- de la portée que nanos vient de calculer.
---@param player table
---@param melee table
---@param action string
PoserAnimation = function(player, melee, action)
    if (not action or not melee or not melee:IsValid()) then return end
    local histo = historiques[player]
    if (not histo) then histo = {}; historiques[player] = histo end

    local nom = Animations.Choisir(sets, action, "IP", histo)
    if (not nom) then
        -- Un pack pas encore cuit ne doit pas rendre l'arme muette : elle
        -- frappera avec son animation précédente plutôt qu'avec aucune.
        Console.Warn(("Combat : aucune animation pour l'action '%s'"):format(tostring(action)))
        return
    end

    pcall(function()
        melee:ClearAnimationsCharacterUse()
        melee:AddAnimationCharacterUse(Animations.Asset(nom))
    end)
end

--- Règle l'arme pour le coup qui vient : dégâts calculés, animation choisie.
---@param player table
---@param coup table  ce que rend `Combat.Frapper`
ReglerCoup = function(player, coup)
    local a = ArmeDe(player)
    if (not a or not coup) then return end

    -- ⚠ `Session.De(player)`, PAS `Session.Personnage` : cette seconde n'existe
    -- pas. Je l'avais écrite de mémoire ; le seul accesseur est `De`, et c'est
    -- son champ `perso` qui porte le personnage (Server/Session.lua:203).
    local sess = Session and Session.De and Session.De(player) or nil
    local perso = sess and sess.perso or nil
    -- ⚠ Champs du personnage charge (Roster.depuisLigne) : `classId` et `level`.
    -- `class_id`/`niveau` n'existent pas : tout le monde frappait avec les
    -- statistiques d'une classe inconnue (audit du 2026-09-11).
    -- Bonus plats des TALENTS (défense, critique), comme `effectiveStats` :
    -- lus au moment du coup, jamais recopiés (Server/Progression.lua).
    local bonus = Narvos.ProgressionServeur and Narvos.ProgressionServeur.BonusCombat(player) or nil
    local stats = Combat.Statistiques(perso and perso.classId, perso and perso.level, bonus)

    -- ⚠ LE TIRAGE CRITIQUE EST FAIT ICI ET NULLE PART AILLEURS. C'est une
    -- décision d'état de jeu : la refaire côté client donnerait un autre nombre.
    local d = Combat.Degats(stats, a.def, coup.multiplicateur, nil, nil)

    -- `SetBaseDamage` veut un ENTIER. Un flottant y serait tronqué en silence,
    -- et un coup à 19,8 deviendrait 19 sans qu'on sache pourquoi.
    local degats = math.floor((d and d.degats or 1) + 0.5)
    if (degats < 1) then degats = 1 end

    pcall(function() a.entite:SetBaseDamage(degats) end)
    -- Une arme d'objet porte les gestes de sa famille (posés à l'équipement).
    if (not a.reglages) then PoserAnimation(player, a.entite, coup.action) end

    Annoncer(player, "Narvos:Coup", coup.etape, degats, d and d.critique or false)
end

-- ── Équiper ───────────────────────────────────────────────────────────────────

--- Met une arme de mêlée dans la main du joueur.
---
--- ⚠ `PickUp` est d'autorité SERVEUR et prend un Pickable — un `Melee` en est
--- un. Vérifié dans `Classes/Character.json`, pas supposé.
---@param player table
---@param arme_id string
---@return boolean, string|nil
function CombatServeur.Equiper(player, arme_id)
    local def = par_id[arme_id]
    -- ── LES OBJETS DU SAC (2026-09-15) ────────────────────────────────────────
    -- Hors des six outils ci-dessus, `arme_id` est l'identifiant d'un OBJET du
    -- catalogue (épée, dague, lance, bâton…) : `Logic/Melee.lua` donne son vrai
    -- mesh, sa prise, les gestes de sa famille et sa fenêtre de coup.
    local reglages = nil
    if (not def and Narvos.Melee and Narvos.Items) then
        reglages = Narvos.Melee.Reglages(arme_id, Narvos.Items.ITEM_DB[arme_id])
        def = reglages
    end
    if (not def) then return false, "Arme inconnue" end

    local character = player:GetControlledCharacter()
    if (not character) then return false, "Aucun personnage" end

    CombatServeur.Ranger(player)

    -- HandlingMode est une énumération du moteur ; on la lit par son nom pour
    -- que le catalogue reste une table de données et non du code.
    local prise = HandlingMode and HandlingMode[def.prise] or nil

    local ok, melee = pcall(Melee, character:GetLocation(), Rotator(), def.mesh,
        CollisionType.Normal, true, prise, "")
    if (not ok or not melee) then return false, "Arme impossible a creer" end

    pcall(function()
        melee:SetBaseDamage(math.max(1, math.floor(def.degats + 0.5)))
        -- Fenêtre de dégâts dans l'animation, et récupération entre deux coups.
        melee:SetDamageSettings(def.fenetre_debut or CombatServeur.DEGATS_DEBUT,
            def.fenetre_duree or CombatServeur.DEGATS_DUREE)
        melee:SetCooldown(def.cadence)
    end)

    if (reglages) then
        -- Prise AVANT `PickUp` (BasePickable.json : réglage d'attache au ramassage).
        local a = reglages.attache
        pcall(function()
            melee:SetAttachmentSettings(Vector(a.x, a.y, a.z), Rotator(a.pitch, a.yaw, a.roll), "hand_r_socket")
        end)
        local e = tonumber(reglages.echelle) or 1
        if (e > 0 and e ~= 1) then pcall(function() melee:SetScale(Vector(e, e, e)) end) end
        -- Les gestes de la FAMILLE, posés une fois : ils ne suivent plus la chaîne
        -- d'arbalète (ACB_Attack) posée coup après coup, décalée d'un coup.
        pcall(function()
            melee:ClearAnimationsCharacterUse()
            for _, anim in ipairs(reglages.animations) do melee:AddAnimationCharacterUse(anim) end
        end)
        pcall(function()
            melee:SetImpactSound(SurfaceType.Flesh, Narvos.Melee.SON_CHAIR)
            melee:SetImpactSound(SurfaceType.Default, reglages.son_impact)
            melee:SetSoundUse(reglages.son_souffle)
        end)
    end

    armes[player] = {
        entite = melee,
        def = { id = def.id, degats = def.degats, allonge = def.allonge, cadence = def.cadence },
        reglages = reglages,
    }
    etats[player] = Combat.NouvelEtat()

    if (not reglages) then
        PoserAnimation(player, melee, Combat.CHAINE[1] and Combat.CHAINE[1].action)
    end
    pcall(function() character:PickUp(melee) end)
    Console.Log(("[MELEE] %s equipe %s (%s) mesh=%s prise=%s gestes=%d")
        :format(tostring(player:GetName()), tostring(def.id), tostring(reglages and reglages.famille or "outil"),
            tostring(def.mesh), tostring(def.prise), reglages and #reglages.animations or 1))

    Annoncer(player, "Narvos:ArmeMelee", def.id, def.label)
    return true, nil
end

--- Retire et détruit l'arme tenue.
--- On DÉTRUIT plutôt que de lâcher : une arme au sol reste une entité répliquée,
--- et un joueur qui change dix fois d'arme en laisserait dix derrière lui.
---@param player table
function CombatServeur.Ranger(player)
    local a = armes[player]
    if (not a) then return end
    local character = player:GetControlledCharacter()
    if (character) then pcall(function() character:Drop() end) end
    if (a.entite and a.entite:IsValid()) then pcall(function() a.entite:Destroy() end) end
    armes[player] = nil
end

-- ── Le coup ───────────────────────────────────────────────────────────────────

--- Direction d'où vient un coup, du point de vue de la cible.
--- Calculée depuis deux positions et un yaw : aucune API n'est nécessaire, et
--- `Trace` n'aurait de toute façon pas répondu côté serveur.
---@param cible table    Character
---@param origine table  Vector de l'assaillant
---@return string|nil
local function DirectionDuCoup(cible, origine)
    local ok, resultat = pcall(function()
        local p = cible:GetLocation()
        local yaw = cible:GetRotation().Yaw
        local angle = math.deg(math.atan(origine.Y - p.Y, origine.X - p.X)) - yaw
        return Combat.Direction(angle)
    end)
    return ok and resultat or nil
end

--- Le joueur a frappé : on avance l'enchaînement et on prépare le coup suivant.
---@param player table
function CombatServeur.Frapper(player)
    local a = ArmeDe(player)
    if (not a) then return end

    local ok, raison, coup = Combat.Frapper(EtatDe(player), horloge_ms(), a.def)
    if (not ok) then
        -- Frapper hors fenêtre n'est pas une erreur : c'est l'enchaînement qui
        -- repart de zéro. On le dit au client pour que son affichage suive.
        Annoncer(player, "Narvos:CoupRefuse", raison)
        return
    end

    ReglerCoup(player, coup)

    -- La cible ne peut contrer que si on l'a annoncée. On ne connaît pas encore
    -- qui sera touché — nanos le décidera —, donc on annonce à TOUS les joueurs
    -- assez proches pour être concernés. C'est ce que fait la fenêtre de contre
    -- de Freeflow : elle s'ouvre à l'engagement, pas à l'impact.
    local character = player:GetControlledCharacter()
    if (not character) then return end
    local origine = character:GetLocation()
    local portee = (a.def.allonge or 150) * 2.5

    for _, autre in ipairs(Player.GetAll()) do
        if (autre ~= player) then
            local c = autre:GetControlledCharacter()
            if (c) then
                local p = c:GetLocation()
                local dx, dy, dz = p.X - origine.X, p.Y - origine.Y, p.Z - origine.Z
                if ((dx * dx + dy * dy + dz * dz) <= (portee * portee)) then
                    local dir = DirectionDuCoup(c, origine)
                    if (dir) then
                        Combat.Telegraphier(EtatDe(autre), dir, horloge_ms())
                        Annoncer(autre, "Narvos:CoupAnnonce", dir, Combat.FENETRE_CONTRE_MS)
                    end
                end
            end
        end
    end
end

--- Le joueur tente un contre.
---@param player table
---@param direction_visee string|nil  nil = contre non directionnel
function CombatServeur.Contrer(player, direction_visee)
    local ok, raison, plan = Combat.Contrer(EtatDe(player), horloge_ms(), direction_visee)
    if (not ok) then
        Annoncer(player, "Narvos:ContreRate", raison)
        return
    end

    -- ⚠ LE MONTAGE N'EST PAS NOMMÉ ICI. `Combat.Contrer` rend une CLÉ
    -- (« Counter_Front ») ; les 119 montages Freeflow ne sont pas cuits, et
    -- écrire `narvos::AM_Counter_Front` aurait livré un nom que le moteur
    -- ignore en silence. On joue la réaction de notre propre pack, qui existe.
    local a = ArmeDe(player)
    if (a and plan and plan.action) then PoserAnimation(player, a.entite, plan.action) end

    -- ⚠ ON ENVOIE `direction`, PAS `cle`. `Combat.Contrer` rend
    -- `{ direction, action, multiplicateur }` — il n'a JAMAIS eu de champ `cle`,
    -- donc le premier argument partait toujours nil. La page le sait (elle
    -- nomme son paramètre `_cle` et ne l'affiche pas), mais un champ inexistant
    -- transmis à chaque contre est un contrat faux : le jour où quelqu'un s'y
    -- fie, rien ne le prévient. `direction` vaut « Front », « Left »… — c'est
    -- ce qu'un affichage voudrait montrer.
    Annoncer(player, "Narvos:Contre", plan and plan.direction or nil,
        plan and plan.multiplicateur or Combat.MULT_CONTRE)
end

-- ── Branchements ──────────────────────────────────────────────────────────────

local function EnJeu(player)
    return Session and Session.EnJeu(player)
end

--- `Attack` est émis par le personnage quand il frappe avec son Melee.
--- Signature vérifiée dans `Classes/Character.json` : (self, melee).
Character.Subscribe("Attack", function(character, melee)
    local ok, player = pcall(function() return character:GetPlayer() end)
    if (not ok or not player or not EnJeu(player)) then return end
    CombatServeur.Frapper(player)
end)

--- Poings nus : même enchaînement, arme par défaut.
--- `Punch` ne porte que le personnage — vérifié, il n'a pas de second argument.
Character.Subscribe("Punch", function(character)
    local ok, player = pcall(function() return character:GetPlayer() end)
    if (not ok or not player or not EnJeu(player)) then return end
    if (ArmeDe(player)) then return end
    local ok2, _, coup = Combat.Frapper(EtatDe(player), horloge_ms(), Combat.POINGS)
    if (ok2 and coup) then Annoncer(player, "Narvos:Coup", coup.etape, nil, false) end
end)

--- Un joueur frappé voit sa fenêtre de contre s'ouvrir sur la direction réelle
--- du coup. `TakeDamage` porte `from_direction` — on n'a donc rien à deviner.
--- Signature vérifiée dans `Classes/BaseDamageable.json`.
Character.Subscribe("TakeDamage",
    function(character, _damage, _bone, _type, from_direction)
        local ok, player = pcall(function() return character:GetPlayer() end)
        if (not ok or not player or not EnJeu(player)) then return end
        if (not from_direction) then return end
        local dir = DirectionDuCoup(character,
            Vector(character:GetLocation().X - from_direction.X,
                   character:GetLocation().Y - from_direction.Y,
                   character:GetLocation().Z - from_direction.Z))
        if (dir) then Combat.Telegraphier(EtatDe(player), dir, horloge_ms()) end
    end)

--- La cible ENCAISSE : elle joue la réaction du coup reçu.
---
--- Mesure du 2026-09-13 : `Combat.Frapper` rendait `reaction` pour chaque coup
--- (ACB_Hurt, ACB_Hurt_Knockback) et AUCUNE cible ne la jouait — un coup reçu ne se
--- voyait que dans la barre de vie. Couvre les coups de joueur (instigateur =
--- Player, étape lue dans son état) ET de PNJ (causeur = le PNJ, étape posée par
--- `Server/Ia.lua` sous `IaServeur.MARQUE_ETAPE`).
---
--- ⚠ `UpperBody`, pas `FullBody` : un joueur touché doit pouvoir continuer à se
--- déplacer, et un FullBody figerait ses jambes le temps de la réaction.
--- ⚠ Seuls les `Character` (SKEL_Mannequin) : `Character.Subscribe` n'écoute
--- qu'eux, et c'est voulu — l'animation ne se jouerait pas sur un autre squelette.
Character.Subscribe("TakeDamage",
    function(victime, _degats, _os, type_degats, _direction, instigateur, causeur)
        if (type_degats ~= DamageType.Melee and type_degats ~= DamageType.Punch) then return end
        -- Un menotté garde son animation d'entrave : une réaction la remplacerait
        -- et il paraîtrait libre (Server/Menottes.lua).
        if (Narvos.MenottesServeur and Narvos.MenottesServeur.EstEntrave(victime)) then return end
        if (not Combat.PeutReagir(reactions[victime], horloge_ms())) then return end

        -- ── LA REACTION PROPRE A LA FAMILLE D'ABORD ─────────────────────────────
        -- Un infecte touche joue la reaction du COTE d'ou vient le coup
        -- (Catalogs/Gestes.lua, animations retargetees du lot 3), en FullBody : il
        -- n'a pas de jambes a laisser libres, c'est un PNJ.
        local famille = Narvos.IaServeur and Narvos.IaServeur.FamilleDe(victime)
        local propres = famille and Narvos.Gestes and Narvos.Gestes.De(famille)
        if (propres and propres.reactions) then
            local cote = "avant"
            pcall(function()
                local ici = victime:GetLocation()
                local rot = victime:GetRotation()
                local av, dr = rot:GetForwardVector(), rot:GetRightVector()
                local source = (causeur and causeur:IsValid() and causeur:GetLocation())
                    or (instigateur and instigateur:GetControlledCharacter() and instigateur:GetControlledCharacter():GetLocation())
                if (source) then
                    cote = Combat.CoteDuCoup({ x = av.X, y = av.Y }, { x = dr.X, y = dr.Y },
                        { x = source.X - ici.X, y = source.Y - ici.Y })
                end
            end)
            local asset = propres.reactions[cote]
            if (asset) then
                reactions[victime] = horloge_ms()
                pcall(function()
                    victime:PlayAnimation(asset, AnimationSlotType.FullBody, false, 0.05, 0.25, 1.0, false)
                end)
                return
            end
        end

        local etape = nil
        if (instigateur and etats[instigateur]) then
            etape = etats[instigateur].etape
        elseif (causeur and Narvos.IaServeur) then
            pcall(function() etape = causeur:GetValue(Narvos.IaServeur.MARQUE_ETAPE, nil) end)
        end

        local nom = Animations.Choisir(sets, Combat.ReactionPour(etape), "IP", historique_reactions)
        if (not nom) then return end
        reactions[victime] = horloge_ms()
        pcall(function()
            victime:PlayAnimation(Animations.Asset(nom), AnimationSlotType.UpperBody,
                false, 0.05, 0.25, 1.0, false)
        end)
    end)

-- Un personnage détruit n'a plus de réaction à dater.
Character.Subscribe("Destroy", function(personnage) reactions[personnage] = nil end)

-- ⚠ PAS DE `Narvos:EquiperMelee`, ET PAS D'ALLER-RETOUR DE CATALOGUE.
--
-- J'en avais ecrit trois : `EquiperMelee`, `DemanderArmesMelee` et sa reponse
-- `ArmesMelee`. Le croisement emis/ecoutes a montre que RIEN ne les emettait :
-- la seule voie d'equipement aujourd'hui est la commande de chat `/arme`, qui
-- appelle `CombatServeur.Equiper` directement, cote serveur.
--
-- Trois relais morts ne sont pas neutres. Sur ce projet, une valeur gardee « au
-- cas ou » a deja pris la place d'un vrai choix le jour ou on l'a branchee. Le
-- jour ou un menu d'armes existera, il faudra trois lignes pour les remettre —
-- moins que le temps passe a se demander pourquoi ils ne servaient a rien.
--
-- `RangerMelee`, lui, RESTE : la touche V l'emet vraiment.
Events.SubscribeRemote("Narvos:RangerMelee", function(player)
    if (not EnJeu(player)) then return end
    CombatServeur.Ranger(player)
end)

Events.SubscribeRemote("Narvos:Contrer", function(player, direction)
    if (Narvos.MenottesServeur and Narvos.MenottesServeur.Refuse(player, "melee")) then return end
    if (not EnJeu(player)) then return end
    CombatServeur.Contrer(player, direction)
end)

--- Purge à la déconnexion : sans ça l'arme resterait au sol et les tables
--- retiendraient le joueur en mémoire.
Player.Subscribe("Destroy", function(player)
    CombatServeur.Ranger(player)
    etats[player] = nil
    historiques[player] = nil
end)

-- ── Contrôle au chargement ────────────────────────────────────────────────────
--
-- Une action que le pack cuit ne porte pas produirait un coup SANS GESTE, et
-- rien ne le signalerait. On le dit une fois, au démarrage.
local manquants = Combat.Verifier(sets)
if (#manquants > 0) then
    Console.Warn(("Combat : %d action(s) sans animation dans le pack cuit : %s")
        :format(#manquants, table.concat(manquants, ", ")))
end

return CombatServeur