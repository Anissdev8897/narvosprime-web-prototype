-- ═══════════════════════════════════════════════════════════════════════════════
-- NARVOS — prototype iso, côté client.
--
-- Trois rôles :
--   1. tenir la vue isométrique, que nanos ne sait pas verrouiller ;
--   2. offrir un zoom molette, pour MESURER la bonne distance en jouant ;
--   3. faire tourner les vues (F3) : isométrique → 3ᵉ personne → 1ʳᵉ personne.
--
-- POURQUOI UN VERROU : nanos n'expose AUCUN verrou de vue. Vérifié dans
-- Character.json — il n'y a ni SetCanChangeViewMode, ni LockViewMode. Le joueur
-- peut donc sortir de la vue iso par ses propres entrées.
--
-- On réimpose donc l'angle, mais UNIQUEMENT en mode iso : le faire dans les deux
-- autres modes reviendrait à combattre le joueur qui vient de demander à
-- regarder ailleurs. C'est la raison d'être de la machine à états ci-dessous.
--
-- La réimposition tourne sur un Timer à 250 ms, PAS sur Client "Tick" dont la
-- doc dit littéralement « Called Every Frame. Do not abuse » : à 60 ips ce serait
-- 240 fois plus d'appels pour corriger une dérive qui, elle, est humaine.
--
-- ⚠ Le serveur doit avoir posé `CameraMode.FPSTPS` sur le personnage. Avec
-- `TPSOnly`, `SetViewMode(ViewMode.FPS)` est refusé EN SILENCE et F3 semble
-- cassé. `SetCameraMode` est une méthode serveur : le client ne peut pas
-- s'autoriser lui-même.
-- ═══════════════════════════════════════════════════════════════════════════════

-- Valeurs par défaut, écrasées par celles du serveur dès la connexion. Elles
-- existent pour que le fichier soit cohérent seul.
local ISO = {
    pitch      = -50.0,
    yaw        = 45.0,
    arm_length = 2200.0,
    arm_min    = 700.0,
    arm_max    = 3600.0,
}

local PAS_ZOOM = 150.0    -- unités par cran de molette (1,5 m)

-- Distance de la caméra en 3ᵉ personne. 400 unités = 4 m, la valeur mesurée du
-- projet (`tpsDistance` de `createPlayerState()`, skill narvos-level-design).
-- On reprend la métrique existante plutôt que d'en inventer une deuxième.
local BRAS_TPS = 400.0

-- ── Machine à états des vues ───────────────────────────────────────────────────
--
-- L'ordre du cycle est délibéré : on part de la vue du jeu, on s'en éloigne d'un
-- cran, puis on entre dans le personnage. Revenir au début après la 1ʳᵉ personne
-- rend la touche utilisable sans se souvenir de l'état courant.
local VUES = { "iso", "tps", "fps" }

local LIBELLE = {
    iso = "isométrique",
    tps = "3ᵉ personne",
    fps = "1ʳᵉ personne",
}

local vue_courante = 1        -- index dans VUES
local intervalle = nil        -- Timer de réimposition, actif en iso SEULEMENT

local function VueActive()
    return VUES[vue_courante]
end

--- Réimpose l'angle et la distance si le joueur en a dévié.
--- On compare avant d'écrire : régler la caméra sans raison couperait toute
--- interpolation en cours et rendrait le mouvement saccadé.
local function Reimposer()
    -- Garde-fou : le Timer peut survivre d'un cran de trop à un changement de
    -- vue. Sans ce test, il replacerait la caméra iso alors que le joueur vient
    -- de passer en 1ʳᵉ personne.
    if (VueActive() ~= "iso") then return end

    local player = Client.GetLocalPlayer()
    if (not player) then return end

    local rotation = player:GetCameraRotation()
    if (rotation) then
        -- Tolérance : au-delà d'un degré, on considère que ça a bougé.
        if (math.abs(rotation.Pitch - ISO.pitch) > 1.0
            or math.abs(rotation.Yaw - ISO.yaw) > 1.0) then
            player:SetCameraRotation(Rotator(ISO.pitch, ISO.yaw, 0))
        end
    end

    -- `true` demande la valeur de BASE, pas l'interpolée : comparer à
    -- l'interpolée relancerait une correction à chaque frame de transition.
    local arm = player:GetCameraArmLength(true)
    if (arm and math.abs(arm - ISO.arm_length) > 1.0) then
        player:SetCameraArmLength(ISO.arm_length, true)
    end
end

local function ArreterReimposition()
    if (intervalle) then
        Timer.ClearInterval(intervalle)
        intervalle = nil
    end
end

--- Applique la vue courante au personnage et à la caméra.
--- Chaque mode pose TOUT ce dont il a besoin — jamais un delta depuis le mode
--- précédent : sinon l'état final dépendrait du chemin parcouru, et un cycle
--- complet ne reviendrait pas exactement au point de départ.
local function AppliquerVue()
    local player = Client.GetLocalPlayer()
    if (not player) then return end

    local character = player:GetControlledCharacter()
    local vue = VueActive()

    ArreterReimposition()

    if (vue == "iso") then
        -- TPS3 et non TopDown : mesuré le 2026-09-02, TopDown impose son propre
        -- cadrage et ignore SetCameraArmLength (vue de ~200 m pour un bras réglé
        -- à 22 m). L'isométrie se fabrique en TPS, pitch fort + bras contrôlé.
        if (character) then character:SetViewMode(ViewMode.TPS3) end
        player:SetCameraArmLength(ISO.arm_length, true)
        player:SetCameraRotation(Rotator(ISO.pitch, ISO.yaw, 0))
        intervalle = Timer.SetInterval(Reimposer, 250)

    elseif (vue == "tps") then
        if (character) then character:SetViewMode(ViewMode.TPS1) end
        player:SetCameraArmLength(BRAS_TPS, true)
        -- Pas de SetCameraRotation : en 3ᵉ personne le joueur dirige son regard,
        -- et lui imposer un angle au moment où il change de vue le désoriente.

    else -- fps
        -- Le bras n'a pas de sens en 1ʳᵉ personne, mais il reste la valeur de
        -- BASE : le remettre à 0 évite un saut au retour vers une autre vue.
        if (character) then character:SetViewMode(ViewMode.FPS) end
        player:SetCameraArmLength(0.0, true)
    end

    -- La tête du MetaHuman local se cache en 1ʳᵉ personne (Client/MetaCustom.lua).
    -- Par événement et non par appel direct : ce module est requis 2 000 lignes
    -- plus bas, son `local` serait un GLOBAL nil ici.
    Events.Call("Narvos:VuePremierePersonne", vue == "fps")

    Console.Log("Vue : " .. LIBELLE[vue])
end

--- Passe à la vue suivante du cycle.
local function VueSuivante()
    vue_courante = (vue_courante % #VUES) + 1
    AppliquerVue()
end

-- ── Cadrage de l'onglet APPARENCE de l'inventaire (2026-09-14) ─────────────────
-- Régler son MetaHuman en vue iso, c'est le régler à 22 m : on ne voit rien. À
-- l'entrée de l'onglet, la caméra passe UNE fois de face, en 3ᵉ personne ; elle
-- ne bouge plus pendant les réglages (retour de jeu : « la caméra ne doit pas
-- reculer quand je modifie mon personnage ») et la vue du joueur revient à la
-- sortie. `vue_courante` n'est pas touchée : c'est elle que `AppliquerVue` rend.
local CADRAGE_APPARENCE = {
    bras = 260.0,    -- cm : le corps entier dans le cadre, le visage lisible
    pitch = -8.0,    -- léger plongé
}
local apparence_cadree = false

---@param actif boolean
local function CadrerApparence(actif)
    actif = actif == true
    if (actif == apparence_cadree) then return end
    apparence_cadree = actif
    if (not actif) then
        AppliquerVue()
        return
    end
    local player = Client.GetLocalPlayer()
    local character = player and player:GetControlledCharacter()
    if (not character) then return end
    ArreterReimposition()
    -- La tête doit se voir, même si le joueur était en 1ʳᵉ personne.
    Events.Call("Narvos:VuePremierePersonne", false)
    character:SetViewMode(ViewMode.TPS1)
    player:SetCameraArmLength(CADRAGE_APPARENCE.bras, true)
    -- De FACE : le regard de la caméra est l'opposé de celui du personnage.
    local rotation = character:GetRotation()
    player:SetCameraRotation(Rotator(CADRAGE_APPARENCE.pitch, (rotation and rotation.Yaw or 0) + 180, 0))
end

--- Change la distance de caméra d'un cran et l'annonce.
--- L'annonce est le but : c'est elle qui transforme un réglage à l'œil en une
--- mesure qu'on peut recopier dans Package.toml.
---@param delta number
local function Zoomer(delta)
    -- Le zoom ne concerne que la vue iso : en 1ʳᵉ personne il n'a aucun sens, et
    -- en 3ᵉ personne il écraserait la distance que ce mode vient de poser.
    if (VueActive() ~= "iso") then return end

    local player = Client.GetLocalPlayer()
    if (not player) then return end

    local vise = ISO.arm_length + delta
    if (vise < ISO.arm_min) then vise = ISO.arm_min end
    if (vise > ISO.arm_max) then vise = ISO.arm_max end
    if (vise == ISO.arm_length) then return end

    ISO.arm_length = vise
    player:SetCameraArmLength(ISO.arm_length, true)

    Console.Log("iso_arm_length = " .. string.format("%.0f", ISO.arm_length)
        .. "  (" .. string.format("%.1f", ISO.arm_length / 100) .. " m)")
end

-- ── Entrées ────────────────────────────────────────────────────────────────────
--
--- L'ecran de connexion/creation est-il ouvert ?
---
--- ⚠ Il est MODAL : tant qu'il est la, le joueur n'a AUCUN corps (voir
--- Server/Session.lua). Ouvrir l'inventaire, le menu d'animations ou changer de
--- vue n'a donc aucun sens — et pire, ca volerait la souris au seul ecran qui
--- compte, laissant le joueur sans curseur devant un formulaire.
---
--- ⚠ DÉCLARÉE ICI, avant le premier `Input.Bind` qui l'appelle. En Lua un
--- `local` n'existe QU'À PARTIR de sa ligne : declaree plus bas, les
--- gestionnaires de F3 et de la molette resolvaient le nom en GLOBAL (nil) et
--- levaient au premier appui. Trouvee par audit le 2026-09-03.
--- Elle est ASSIGNEE tout en bas, quand le WebUI de creation existe.
local CreationOuverte = function() return false end

--- État du menu d'animations. DÉCLARÉS ICI et pas dans le bloc des emotes plus
--- bas : le gestionnaire d'Échap les lit, et un `local` posé APRÈS lui le ferait
--- résoudre en GLOBAL (nil). Même piège que `CreationOuverte`, quatrième fois
--- dans ce fichier — d'où ce regroupement en tête.
local menu_emotes_ouvert = false
local emote_en_cours = nil

--- État de la roue d'objets (TAB). Même discipline que `menu_emotes_ouvert` :
--- déclaré EN TÊTE parce que le gestionnaire d'Échap le lit — un `local` posé
--- après son lecteur se résout en GLOBAL nil, sans erreur au chargement.
local roue_ouverte = false

--- Dernier état d'assemblage poussé par le serveur. TAMPON : un `CallEvent`
--- émis avant que la page soit prête tombe dans le vide sans erreur (leçon de
--- l'écran de création) — la page réclame l'état à l'ouverture du panneau par
--- `NarvosAssemblage:Pret`. Déclaré EN TÊTE, avec les autres états.
local dernier_etat_assemblage = nil

-- ═══════════════════════════════════════════════════════════════════════════════
-- RECEVOIR LES ÉVÉNEMENTS D'UNE PAGE — SUR L'INSTANCE, JAMAIS SUR `Events`
--
-- ── LE DÉFAUT QUE CETTE MÉCANIQUE RÉPARE ─────────────────────────────────────
-- `Events.Subscribe("X", fn)` NE REÇOIT PAS les événements émis par un WebUI.
-- La réception se fait par la MÉTHODE de l'instance :
--
--     my_ui:Subscribe("MyAnswer", function(param) … end)
--
-- Source : `docs/scripting-reference/classes/webui.mdx:81`, sous le commentaire
-- « Subscribes to receive JS events », et `core-concepts/scripting/user-interface.mdx`
-- lignes 27 et 31. Aucun exemple documenté n'emploie le `Events` global pour ça.
--
-- Ce fichier employait le global pour ses VINGT-CINQ abonnements de page. Rien
-- ne levait, aucune erreur JS, aucune trace : les interfaces s'affichaient et
-- n'agissaient jamais. Écran de création, menu d'animations, props, spawn,
-- commandes — tous muets, pour une seule raison.
--
-- ⚠ CE QUI A MASQUÉ LE DÉFAUT UNE JOURNÉE. Les deux autres sens fonctionnent et
-- ressemblent à celui-ci :
--     serveur -> client   `Events.SubscribeRemote(...)`   ← global, correct
--     Lua     -> page     `ui:CallEvent(...)`             ← instance, correct
-- L'écran de création affichait donc ses 3 factions, 17 corps et 116 pièces, ce
-- qui donnait toutes les apparences d'un pont qui marche. Il ne marchait que
-- dans un sens.
--
-- ── POURQUOI UNE TABLE PLUTÔT QU'UN APPEL DIRECT ─────────────────────────────
-- Deux des trois pages sont créées PARESSEUSEMENT, à la première ouverture. On
-- ne peut donc pas s'abonner à leur chargement. On enregistre les gestionnaires
-- dans une table, et on les pose sur l'instance dès qu'elle existe.
-- ═══════════════════════════════════════════════════════════════════════════════

--- Gestionnaires par page, en attente de leur instance.
--- Direction du dernier coup annonce par le serveur, et l'instant ou son
--- annonce cesse d'etre valable.
---
--- ⚠ DECLARE ICI, en tete, et non pres du bloc de melee plus bas : `ACTIONS.
--- melee_contrer` le lit, et en Lua un `local` pose APRES son lecteur se resout
--- en GLOBAL nil — sans erreur au chargement. Piege rencontre cinq fois ici.
local direction_annoncee = nil

local abonnes = { hud = {}, creation = {}, emotes = {} }

--- Enregistre un gestionnaire d'événement de PAGE.
--- Remplace `Events.Subscribe` pour tout ce qui vient d'un WebUI.
---@param cle string   "hud" | "creation" | "emotes"
---@param nom string   nom de l'événement émis par le JS
---@param fn function
local function Page(cle, nom, fn)
    abonnes[cle][nom] = fn
end

--- Pose sur une instance tous les gestionnaires enregistrés pour elle.
--- À appeler juste après `WebUI(...)`.
---@param cle string
---@param ui table
local function BrancherPage(cle, ui)
    if (not ui) then return end
    for nom, fn in pairs(abonnes[cle] or {}) do
        ui:Subscribe(nom, fn)
    end
end

--- Panneau du HUD ouvert : nil, "inventaire", "personnage", "props", "spawn" ou
--- "commandes". Un seul à la fois — deux panneaux ouverts se disputeraient la
--- souris et le joueur ne saurait plus lequel se ferme quand il rappuie.
---
--- ⚠ REMONTÉ ICI depuis le bloc « Interface » : le répartiteur clavier ci-dessous
--- le lit, et un `local` posé après lui le résoudrait en GLOBAL nil — un menu
--- ouvert ne bloquerait alors plus les émotes. Cinquième instance du piège sur
--- ce fichier, d'où ce regroupement en tête.
local panneau = nil

--- Action dont l'ecran Parametres > Commandes attend la nouvelle touche, ou nil.
---
--- ⚠ LA PAGE NE RECOIT PAS LE CLAVIER. Un WebUI n'a les frappes que s'il a le
--- focus (`WebUI:SetFocus`, Classes/WebUI.json), que ce client ne donne jamais :
--- les panneaux s'ouvrent souris libre, clavier au JEU — c'est ce qui laisse Echap
--- fermer un menu ouvert. L'ecouteur `keydown` d'ateliers.js ne se declenchait
--- donc jamais : « le menu propose de modifier les touches, mais on ne peut pas »
--- (retour de jeu du 2026-09-13). La frappe est capturee ici, par
--- `Input.Subscribe("KeyPress")`. DECLAREE EN TETE : le repartiteur et Echap la
--- lisent plus bas.
local capture_commande = nil

--- Panneaux atteints DEPUIS le menu de pause. Echap y remonte a la pause au
--- lieu de tout fermer : sortir d'un sous-menu directement vers le jeu oblige a
--- refaire Echap pour revenir la ou on etait.
---
--- ⚠ DECLARE ICI, en tete. Le gestionnaire d'Echap le lit ~200 lignes plus bas,
--- et un `local` pose apres son lecteur se resout en GLOBAL nil — sans erreur au
--- chargement. `SOUS_MENUS_PAUSE[panneau]` vaudrait alors toujours nil, Echap
--- fermerait tout depuis les sous-menus, et rien ne le signalerait. Sixieme
--- instance du meme piege sur ce fichier.
---
--- ⚠ `index.js` tient la MEME liste (`SOUS_MENUS`). Les deux doivent rester
--- d'accord : panneau ouvert, le clavier arrive d'abord a la page ; focus au
--- jeu, il arrive ici. Un ecart passe pour un bug intermittent.
local SOUS_MENUS_PAUSE = { graphismes = true, commandes = true, jouabilite = true, interface = true }

-- ═══════════════════════════════════════════════════════════════════════════════
-- LE CLAVIER — UN SEUL ENREGISTREMENT PAR TOUCHE, POUR TOUT LE JEU
--
-- ── LE PIÈGE QUE CETTE ARCHITECTURE ÉVITE ─────────────────────────────────────
-- On pourrait croire qu'il suffit d'`Input.Register` sur la touche choisie, puis
-- de recommencer quand le joueur en change. Mais rien ne garantit que
-- réenregistrer le MÊME nom d'action sur une AUTRE touche défasse l'ancienne
-- liaison, et la doc locale n'expose pas `Input.Unregister`. Une liaison fantôme
-- ne lève rien : la vieille touche continue de déclencher l'action, et le joueur
-- n'a aucun moyen de comprendre pourquoi.
--
-- On enregistre donc UNE FOIS chaque touche assignable, vers un répartiteur qui
-- consulte les tables courantes. Réassigner devient un changement de table :
-- rien à défaire, donc rien à oublier de défaire.
--
-- ── ET POURQUOI UN SEUL RÉPARTITEUR POUR LES COMMANDES *ET* LES ÉMOTES ────────
-- Deux boucles d'enregistrement sur les mêmes touches donneraient deux liaisons
-- sur une touche partagée : le joueur appuie une fois, deux choses partent. Le
-- serveur arbitre déjà à l'assignation (`Raccourcis.UtiliserArbitre`), mais un
-- seul répartiteur rend le conflit STRUCTURELLEMENT impossible côté client.
-- Ordre de priorité : commande d'abord, émote ensuite.
-- ═══════════════════════════════════════════════════════════════════════════════

--- { TOUCHE = action_id }, poussé par le serveur (Server/Commandes.lua).
--- Vide tant que la session n'a rien envoyé : aucune touche ne répond alors, ce
--- qui est préférable à des touches d'usine qui contrediraient les réglages.
local commandes_par_touche = {}
-- L'inverse : action -> touche. Sert aux textes d'aide, qui ne doivent JAMAIS
-- ecrire une touche en dur : « F3 change de vue » a survecu au deplacement de
-- la vue sur F4, et envoyait le joueur ouvrir le mode edition par erreur.
local touches_par_action = {}

--- { TOUCHE = anim_id }, poussé par le serveur (Server/Emotes.lua).
--- ⚠ DÉCLARÉ ICI et non dans le bloc des émotes plus bas : le répartiteur le lit
--- et un `local` posé après lui le résoudrait en GLOBAL nil.
local raccourcis = {}

--- { action_id = fonction }. GARNI TOUT EN BAS du fichier, quand les
--- gestionnaires existent vraiment. Une table vide ici est inoffensive : le
--- répartiteur ne trouve rien et ne fait rien.
local ACTIONS = {}

--- Boutons de souris assignables, noms AFFICHES. ⚠ DECLARE EN TETE : lu par
--- `TouchesAssignables` et par le repartiteur plus bas.
local BOUTONS_SOURIS = { "CLIC_GAUCHE", "CLIC_DROIT", "CLIC_MILIEU", "SOURIS_4", "SOURIS_5" }
local EST_BOUTON_SOURIS = {}
for _, b in ipairs(BOUTONS_SOURIS) do EST_BOUTON_SOURIS[b] = true end

--- Toutes les touches que le serveur peut assigner. Doit rester ALIGNÉ sur
--- `Commandes.ToucheValide` et `Raccourcis.ToucheValide` : une touche que le
--- serveur accepte mais que le client n'a pas enregistrée est un raccourci mort.
local function TouchesAssignables()
    local liste = {}
    for c = string.byte("A"), string.byte("Z") do
        liste[#liste + 1] = string.char(c)
    end
    for n = 0, 9 do liste[#liste + 1] = tostring(n) end
    for n = 1, 12 do liste[#liste + 1] = "F" .. n end
    -- Tab : assignable, et le seul nom non alphanumérique de la liste. Il DOIT
    -- figurer aussi dans `Commandes.TOUCHES_VALIDES` côté serveur — une touche
    -- que le serveur accepte mais que le client n'enregistre pas est un
    -- raccourci mort, et l'inverse une assignation impossible.
    liste[#liste + 1] = "TAB"
    -- Pavé numérique (2026-09-19) : DISTINCT des chiffres du rang supérieur
    -- (input.mdx:116-125 vs 161-171). Noms AFFICHÉS « Num1 »… ; le serveur les
    -- stocke tels quels et `NOM_MOTEUR` les traduit pour Input.Register.
    for n = 0, 9 do liste[#liste + 1] = "NUM" .. n end
    for _, s in ipairs({ "NUM+", "NUM-", "NUM*", "NUM/", "NUM." }) do liste[#liste + 1] = s end
    -- Directionnelles et touches spéciales (input.mdx:131-154), affichées en
    -- français, mappées dans `NOM_MOTEUR`.
    for _, s in ipairs({ "HAUT", "BAS", "GAUCHE", "DROITE",
        "ESPACE", "ENTREE", "SUPPR", "INSERT", "DEBUT", "FIN", "PGPREC", "PGSUIV" }) do
        liste[#liste + 1] = s
    end
    -- Boutons de la souris (2026-09-13 : poings au clic). MEME liste que
    -- `Commandes.TOUCHES_VALIDES` cote serveur ; les noms moteur sont dans
    -- `NOM_MOTEUR`, juste en dessous.
    for _, bouton in ipairs(BOUTONS_SOURIS) do liste[#liste + 1] = bouton end
    return liste
end

--- Nom AFFICHÉ -> nom que le moteur reconnaît.
---
--- ⚠ MESURÉ EN JEU, PAS SUPPOSÉ. Le log client disait, dix fois :
---
---     Registering Input 'NarvosTouche_0' for an unknown Key '0'! Did you mean 'Zero'?
---
--- Les quatre touches de pouvoirs (1-4) n'ont donc JAMAIS été enregistrées. La
--- liste officielle est dans `input.mdx` lignes 116-125 : `One`…`Nine`, `Zero`.
--- Le pavé numérique y figure séparément (`NumPadOne`…), à ne pas confondre.
---
--- On convertit ICI et nulle part ailleurs : le joueur voit « 1 », le serveur
--- stocke « 1 », et seul `Input.Register` reçoit « One ». Faire remonter le nom
--- moteur jusqu'au catalogue obligerait l'écran de réglages à afficher « One ».
local NOM_MOTEUR = {
    ["0"] = "Zero",  ["1"] = "One",   ["2"] = "Two",   ["3"] = "Three",
    ["4"] = "Four",  ["5"] = "Five",  ["6"] = "Six",   ["7"] = "Seven",
    ["8"] = "Eight", ["9"] = "Nine",
    -- `Normaliser` majuscule tout côté serveur, le moteur veut « Tab »
    -- (`input.mdx:111`, la même table qu'`Escape`, qui fonctionne déjà ici).
    ["TAB"] = "Tab",
    -- Souris : `input.mdx` lignes 178-182, et deja employes tels quels par le
    -- gizmo officiel (`gizmo.mdx:36`, `LeftMouseButton` dans MouseDown).
    ["CLIC_GAUCHE"] = "LeftMouseButton",
    ["CLIC_DROIT"]  = "RightMouseButton",
    ["CLIC_MILIEU"] = "MiddleMouseButton",
    ["SOURIS_4"]    = "ThumbMouseButton",
    ["SOURIS_5"]    = "ThumbMouseButton2",
    -- Pavé numérique (2026-09-19) : input.mdx:156-171. Les signes s'affichent
    -- « Num+ »… et s'enregistrent « Add »…, comme les chiffres en « One ».
    ["NUM0"] = "NumPadZero", ["NUM1"] = "NumPadOne", ["NUM2"] = "NumPadTwo",
    ["NUM3"] = "NumPadThree", ["NUM4"] = "NumPadFour", ["NUM5"] = "NumPadFive",
    ["NUM6"] = "NumPadSix", ["NUM7"] = "NumPadSeven", ["NUM8"] = "NumPadEight",
    ["NUM9"] = "NumPadNine",
    ["NUM+"] = "Add", ["NUM-"] = "Subtract", ["NUM*"] = "Multiply",
    ["NUM/"] = "Divide", ["NUM."] = "Decimal",
    -- Directionnelles et touches spéciales : input.mdx:131-154.
    ["HAUT"] = "Up", ["BAS"] = "Down", ["GAUCHE"] = "Left", ["DROITE"] = "Right",
    ["ESPACE"] = "SpaceBar", ["ENTREE"] = "Enter", ["SUPPR"] = "Delete",
    ["INSERT"] = "Insert", ["DEBUT"] = "Home", ["FIN"] = "End",
    ["PGPREC"] = "PageUp", ["PGSUIV"] = "PageDown",
}

--- Les lettres et les touches F passent telles quelles — vérifié `input.mdx`
--- lignes 60-71 (F1..F12) et 78-103 (A..Z).
local function CleMoteur(touche)
    return NOM_MOTEUR[touche] or touche
end

--- Vrai si le personnage du joueur local est au volant (ou passager).
local function AuVolant()
    local joueur = Client.GetLocalPlayer()
    local perso = joueur and joueur:GetControlledCharacter()
    if (not perso) then return false end
    local ok, vehicule = pcall(function() return perso:GetVehicle() end)
    return ok and vehicule ~= nil
end

--- La touche MOTEUR est-elle liee a une action de jeu nanos (conduite comprise) ?
--- Lu a chaque frappe : le joueur peut changer ses liaisons de jeu en cours de
--- partie, et une copie faite au chargement serait perimee.
local function ToucheDuJeu(cle_moteur)
    local ok, liaisons = pcall(function() return Input.GetGameKeyBindings() end)
    if (not ok or type(liaisons) ~= "table") then return false end
    for _, touches in pairs(liaisons) do
        if (type(touches) == "table") then
            for _, t in ipairs(touches) do
                if (t == cle_moteur) then return true end
            end
        elseif (touches == cle_moteur) then
            return true
        end
    end
    return false
end

for _, touche in ipairs(TouchesAssignables()) do
    -- Le NOM D'ACTION garde la touche affichée : c'est lui que le répartiteur
    -- consulte, et il doit rester aligné sur ce que le serveur a enregistré.
    Input.Register("NarvosTouche_" .. touche, CleMoteur(touche))
    Input.Bind("NarvosTouche_" .. touche, InputEvent.Pressed, function()
        -- Une touche est attendue par l'ecran des commandes : c'est une
        -- ASSIGNATION, pas un geste. Sans ce test, appuyer sur I pour
        -- l'assigner ouvrirait l'inventaire par-dessus les reglages.
        if (capture_commande) then return end

        -- Pendant la création le joueur n'a pas de corps, et un menu ouvert
        -- capte le clavier : déclencher une action pendant qu'il saisit un nom
        -- serait absurde. Seul le répartiteur porte ce test — les gestionnaires
        -- n'ont donc pas à le répéter.
        if (CreationOuverte()) then return end

        -- Au volant, les commandes de CONDUITE de nanos passent avant nos menus.
        -- Retour de jeu du 13/09 19h : sur un clavier AZERTY, Z accelere ET ouvrait
        -- le menu vehicules (souris liberee a chaque appui) — la voiture « ne
        -- roulait pas ». Une touche liee au jeu n'ouvre donc rien tant qu'on conduit.
        if (AuVolant() and ToucheDuJeu(CleMoteur(touche))) then return end

        -- Un BOUTON DE SOURIS n'agit que curseur capture. Curseur libre, le clic
        -- appartient a l'interface : cliquer dans l'inventaire ne doit pas donner
        -- de coup de poing, ni rouvrir le menu qu'on vient de cliquer.
        if (EST_BOUTON_SOURIS[touche] and Input.IsMouseEnabled()) then return end

        -- 1. Une commande du jeu ? Elle passe avant tout.
        local action_id = commandes_par_touche[touche]
        if (action_id) then
            local gestionnaire = ACTIONS[action_id]
            if (gestionnaire) then gestionnaire() end
            return
        end

        -- 2. Sinon, une émote. Inerte si un menu est ouvert : la frappe
        -- appartient alors à l'interface.
        if (menu_emotes_ouvert or panneau) then return end

        local id = raccourcis[touche]
        if (not id) then return end

        -- BASCULE : réappuyer sur la même touche ARRÊTE l'émote. Sans ça une
        -- animation en boucle (s'asseoir, s'appuyer) ne pouvait plus être
        -- quittée — aucun contrôle n'émettait `Arreter`.
        if (emote_en_cours == id) then
            emote_en_cours = nil
            Events.CallRemote("Narvos:ArreterEmote", Reliability.Reliable)
            return
        end

        emote_en_cours = id
        Events.CallRemote("Narvos:JouerEmote", Reliability.Reliable, id)
    end)
end

-- Le client 1.154 refuse MouseScrollUp/Down comme touches enregistrées.
-- L'événement documenté transmet (mouse_x, mouse_y, delta) : le cran est le
-- TROISIÈME argument. Les menus gardent leur défilement sans zoomer le monde.
Input.Subscribe("MouseScroll", function(_, _, delta)
    if (CreationOuverte() or panneau or menu_emotes_ouvert or roue_ouverte) then return end
    Zoomer(-(tonumber(delta) or 0) * PAS_ZOOM)
end)

-- ── Interface ──────────────────────────────────────────────────────────────────
--
-- Un seul WebUI pour les deux panneaux. En ouvrir un par panneau lancerait deux
-- navigateurs CEF, chacun avec son processus et sa mémoire, pour afficher deux
-- div qui ne se chevauchent jamais.
--
-- `file:///UI/index.html` est relatif au dossier Client/ du package — c'est la
-- forme qu'emploient les packages officiels (`deathmatch`, `sandbox`).
-- Le HUD devient visible avec la session en jeu ; pas de jauges vides ni de
-- radar superposés au personnage pendant sa création.
local HUD = WebUI("NARVOS HUD", "file:///UI/index.html", WidgetVisibility.Hidden)

-- `panneau` est déclaré EN TÊTE du fichier : le répartiteur clavier le lit.

--- Ouvre un panneau, ou le referme s'il l'était déjà.
---
--- Séquence reprise de `ContextMenu.lua` du sandbox officiel : souris, chat,
--- premier plan. Chaque ligne compte — sans `SetMouseEnabled`, le curseur reste
--- capturé par le jeu et rien n'est cliquable ; sans `Chat.SetVisibility(false)`,
--- la frappe part dans le chat ; sans `BringToFront`, le panneau peut se
--- retrouver sous un autre WebUI.
---@param nom string  "inventaire" | "personnage"
--- ⚠ EXCLUSION MUTUELLE : `FermerAutresMenus` est appele AVANT toute ouverture.
--- Deux interfaces ouvertes se disputent la souris et le chat — la seconde
--- reprend `SetMouseEnabled(true)`, puis la premiere le rend a `false` en se
--- fermant, et le joueur se retrouve sans curseur devant un menu ouvert, sans
--- moyen d'en sortir. Le seul remede fiable est de n'en tolerer qu'un.
---
--- Assignee plus bas : le gestionnaire du menu B n'existe pas encore ici, et une
--- reference directe leverait un ReferenceError (TDZ). Meme motif ref que dans
--- RpgGameWorld cote web.
local FermerAutresMenus = function(_) end

--- Fermeture de la roue d'objets. MÊME pattern que `FermerAutresMenus`
--- juste au-dessus : les gestionnaires de page (`NarvosRoue:UIFermer`) sont
--- enregistrés AVANT la définition réelle, et un `local` posé là-bas se
--- résoudrait ici en GLOBAL nil — la roue ne se fermerait plus, sans erreur.
--- Assignée dans le bloc des emotes, une fois ses dépendances réelles.
local FermerRoue = function() end

local function Basculer(nom, filtre)
    if (CreationOuverte()) then return end
    -- Ouvrir ou fermer un panneau abandonne toute ecoute de touche : une ecoute
    -- restee armee avalerait la prochaine frappe du joueur, en jeu.
    capture_commande = nil

    -- Quitter le TELEPHONE (fermeture ou autre panneau) : le personnage le range
    -- (Server/Communications.lua, geste B8). Sans ce signal il le garderait en
    -- main, animation de consultation en boucle.
    -- Tout appel qui part du téléphone le quitte : le refermer ou ouvrir autre chose.
    if (panneau == "telephone") then
        Events.CallRemote("Narvos:Telephone:Fermer", Reliability.Reliable)
    end

    -- Quitter l'inventaire, c'est quitter son onglet APPARENCE : la vue revient.
    if (panneau == "inventaire") then CadrerApparence(false) end

    if (panneau == nom) then
        if (nom == "vehicules" and filtre) then
            HUD:CallEvent("NarvosVehiculesFiltre", filtre)
            return
        end
        HUD:CallEvent("NarvosFermer")
        Input.SetMouseEnabled(false)
        Chat.SetVisibility(true)
        panneau = nil
        Events.Call("Narvos:PanneauHud", nil)
        return
    end

    FermerAutresMenus("hud")

    panneau = nom
    HUD:CallEvent("NarvosOuvrir", nom)
    -- Signal aux modules qui vivent au rythme d'un panneau (Client/ApercuInventaire.lua
    -- filme le personnage pour le cadre de l'inventaire, et seulement pendant).
    Events.Call("Narvos:PanneauHud", nom)
    if (nom == "vehicules") then HUD:CallEvent("NarvosVehiculesFiltre", filtre or "tous") end
    Input.SetMouseEnabled(true)
    Chat.SetVisibility(false)
    HUD:BringToFront()

    -- Les gros catalogues ne partent qu'A L'OUVERTURE, jamais au spawn : 449
    -- props et 41 invocables font plusieurs dizaines de kilo-octets chacun, et
    -- la plupart des joueurs n'ouvriront jamais ces menus. Meme raisonnement que
    -- pour les emotes.
    if (nom == "props") then
        Events.CallRemote("Narvos:DemanderProps", Reliability.Reliable)
    elseif (nom == "spawn") then
        Events.CallRemote("Narvos:DemanderSpawnables", Reliability.Reliable)
    elseif (nom == "armes") then
        Events.CallRemote("Narvos:DemanderArmes", Reliability.Reliable)
    elseif (nom == "vehicules") then
        Events.CallRemote("Narvos:DemanderVehicules", Reliability.Reliable)
    elseif (nom == "personnage") then
        -- La fiche montre aussi les METIERS : on les redemande a chaque
        -- ouverture, l'XP ayant pu changer depuis la derniere fois.
        Events.CallRemote("Narvos:DemanderMetiers", Reliability.Reliable)
        -- Niveau, pouvoirs et talents (Server/Progression.lua), meme raison.
        Events.CallRemote("Narvos:DemanderProgression", Reliability.Reliable)
    elseif (nom == "commandes") then
        Events.CallRemote("Narvos:DemanderCommandes", Reliability.Reliable)
    elseif (nom == "radar") then
        Events.CallRemote("Narvos:DemanderRadar", Reliability.Reliable)
    end
end

-- L'inventaire, la fiche de personnage, les props, le spawn, les pouvoirs et le
-- menu d'animations passent TOUS par le repartiteur en tete de fichier : leurs
-- touches viennent du serveur et sont reconfigurables. Voir `ACTIONS`, tout en bas.
--
-- Echap fait exception, et c'est deliberé : c'est la sortie de secours. Une
-- touche de secours reconfigurable peut etre perdue, et le joueur se retrouve
-- alors enferme dans un menu sans moyen d'en sortir.
--
-- ── POURQUOI `KeyPress` ET PLUS `Input.Register` / `Input.Bind` ───────────────
--
-- Un binding NE CONSOMME PAS la touche : le menu d'echap de nanos s'ouvrait
-- PAR-DESSUS notre panneau, et le joueur se retrouvait avec deux interfaces
-- superposees qui se disputaient la souris.
--
-- Le seul moyen documente de l'empecher est la valeur de retour de l'evenement.
-- Releve dans `libraries/api-main/api-main/StaticClasses/Input.json`, evenement
-- `KeyPress` :
--
--     "return": [ { "type": "boolean", "description": "Return false to block it" } ]
--
-- `KeyDown` et `KeyUp` portent la meme clause. Le game-mode officiel `sandbox`
-- s'en sert deja (`sandbox-master/Client/Index.lua:270`) pour la meme raison.
--
-- ⚠ Il n'existe AUCUNE fonction pour desactiver le menu d'echap. Verifie dans
-- `Client.json` : il n'expose que `OpenEscapeMenu()` et `SetEscapeMenuText()`.
-- Consommer la touche est donc la seule voie — ne pas chercher un reglage.
--
-- ⚠ On rend `false` DANS TOUS LES CAS pour Echap, y compris quand on ne fait
-- rien (pendant la creation de personnage). Rendre `false` seulement quand on
-- agit laisserait le menu nanos s'ouvrir precisement dans les etats qu'on n'a
-- pas prevus — c'est-a-dire ceux ou il fait le plus de degats.
--- Nom MOTEUR (celui que rend `KeyPress`) -> nom affiche et stocke par le serveur :
--- « One » -> « 1 », « Tab » -> « TAB ». L'inverse exact de `NOM_MOTEUR`, derive
--- de lui plutot que recopie (une liste recopiee finit toujours par diverger).
local NOM_AFFICHE = {}
for affiche, moteur in pairs(NOM_MOTEUR) do NOM_AFFICHE[moteur] = affiche end

local TOUCHES_ASSIGNABLES = {}
for _, t in ipairs(TouchesAssignables()) do TOUCHES_ASSIGNABLES[t] = true end

--- Capture la nouvelle touche d'une commande. Rend `false` : la frappe est
--- CONSOMMEE (ni action, ni menu d'echap nanos).
---@param key_name string
---@return boolean
local function CapturerTouche(key_name)
    local action_id = capture_commande
    if (key_name == "Escape") then
        capture_commande = nil
        if (HUD) then HUD:CallEvent("NarvosCommandesEcoute", "", "annulee") end
        return false
    end
    local touche = NOM_AFFICHE[key_name] or tostring(key_name):upper()
    if (not TOUCHES_ASSIGNABLES[touche]) then
        -- Shift, fleches, pave numerique... : on reste en ecoute et on le dit.
        if (HUD) then HUD:CallEvent("NarvosCommandesEcoute", action_id, "invalide") end
        return false
    end
    capture_commande = nil
    -- Le serveur valide (W A S D reserves, conflits) et renvoie l'etat complet.
    Events.CallRemote("Narvos:DefinirCommande", Reliability.Reliable, action_id, touche)
    return false
end

-- Un BOUTON DE SOURIS s'assigne comme une touche : `KeyPress` ne le voit pas,
-- `MouseDown` si (Input.json). ⚠ Curseur au-dessus du WebUI, le clic peut ne
-- jamais arriver ici : la page capte donc AUSSI son `mousedown` pendant l'ecoute
-- (ateliers.js) et envoie `NarvosCommandes:Definir`. Les deux voies peuvent
-- partir pour le meme clic ; le serveur rend la seconde sans effet
-- (« deja assignee »).
Input.Subscribe("MouseDown", function(key_name)
    if (capture_commande) then return CapturerTouche(key_name) end
end)

Input.Subscribe("KeyPress", function(key_name)
    if (capture_commande) then return CapturerTouche(key_name) end
    if (key_name ~= "Escape") then return end

    -- Pendant la creation de personnage, Echap ne doit rien faire : le joueur
    -- n'est pas encore en jeu, il n'y a ni pause ni partie a quitter.
    if (CreationOuverte()) then return false end

    -- Les graphismes sont un SOUS-menu de la pause : Echap y remonte au lieu de
    -- tout fermer. Sortir d'un sous-menu directement vers le jeu oblige a
    -- refaire Echap pour revenir la ou on etait — et donne l'impression d'avoir
    -- rate le clic.
    if (SOUS_MENUS_PAUSE[panneau]) then
        Basculer("pause")
        return false
    end

    -- Ferme TOUT ce qui est ouvert, pas seulement le panneau HUD : Echap doit
    -- etre la sortie de secours qui marche quel que soit l'etat.
    if (panneau or menu_emotes_ouvert or roue_ouverte) then
        if (panneau) then Basculer(panneau) end
        FermerAutresMenus("aucun")
        return false
    end

    -- Aucun menu n'était ouvert : Échap sert alors de sortie d'emote. C'est le
    -- réflexe attendu quand on se retrouve coincé dans une pose, et ça passe
    -- AVANT le menu — sortir d'une pose est plus urgent que d'ouvrir la pause.
    if (emote_en_cours) then
        emote_en_cours = nil
        Events.CallRemote("Narvos:ArreterEmote", Reliability.Reliable)
        return false
    end

    -- Rien à fermer, rien à arrêter : Échap ouvre NOTRE menu de pause.
    Basculer("pause")
    return false
end)

-- ── HUD : vie, armure, arme ────────────────────────────────────────────────────
--
-- Patron repris du package officiel `deathmatch` : la vie et les munitions ne se
-- demandent pas au serveur, elles s'écoutent sur le personnage et sur l'arme
-- qu'il tient. Un sondage périodique afficherait toujours une frame de retard.
--
-- Les abonnements vivent sur des ENTITÉS, pas sur le package : changer de classe
-- détruit le personnage et en crée un autre. Il faut donc tout ré-abonner à
-- chaque possession, d'où `EquiperHud(character)` appelé depuis la config iso.

local arme_suivie = nil   -- pour se désabonner proprement au lâcher

--- Pousse l'état d'une arme vers le HUD.
local function PousserArme(arme)
    if (not arme or not arme:IsValid()) then
        HUD:CallEvent("HudArme", false)
        return
    end

    -- Le type de viseur est posé sur l'entité par le catalogue d'armes : le
    -- client n'a pas à connaître la table, juste à lire ce qu'elle a laissé.
    local id = arme:GetValue("narvos_arme")
    local def = id and Narvos and Narvos.Weapons and Narvos.Weapons.CATALOGUE[id]

    HUD:CallEvent("HudArme", true,
        def and def.label or "ARME",
        arme:GetAmmoClip(), arme:GetAmmoBag(),
        def and def.viseur or "croix")
end

local function SuivreArme(arme)
    -- Un ancien abonnement survivrait à l'arme lâchée et continuerait d'écrire
    -- des munitions qui ne sont plus les nôtres.
    if (arme_suivie and arme_suivie:IsValid()) then
        arme_suivie:Unsubscribe("AmmoClipChange")
        arme_suivie:Unsubscribe("AmmoBagChange")
    end
    arme_suivie = arme
    if (not arme) then return end

    arme:Subscribe("AmmoClipChange", function(a, _, clip)
        PousserArme(a)
    end)
    arme:Subscribe("AmmoBagChange", function(a, _, bag)
        PousserArme(a)
    end)
end

--- Branche le HUD sur un personnage fraîchement possédé.
local function EquiperHud(character)
    if (not character) then return end

    -- Vie : valeur courante et maximum, puis mise à jour à chaque changement.
    HUD:CallEvent("HudVie", character:GetHealth(), character:GetMaxHealth())
    character:Subscribe("HealthChange", function(c, _, vie)
        HUD:CallEvent("HudVie", vie, c:GetMaxHealth())
    end)

    -- Armure : lue dans les stats NARVOS posées sur l'entité par le builder.
    -- ⚠ Elle est STATIQUE pour l'instant — aucune logique de jeu ne la consomme
    -- encore. La jauge est là et juste ; ce qui la fera descendre viendra avec
    -- le portage de `stats/PlayerStats.ts`.
    local stats = character:GetValue("narvos_stats") or {}
    local bouclier = stats.defense or 0
    HUD:CallEvent("HudArmure", bouclier, bouclier)

    -- Identité de classe : elle pilote la teinte de tout le HUD.
    local class_id = character:GetValue("narvos_class")
    local classe = class_id and Narvos and Narvos.Classes and Narvos.Classes.CLASSES[class_id]
    HUD:CallEvent("HudClasse",
        classe and classe.label or "—",
        character:GetValue("narvos_element"))

    -- Arme déjà en main au moment de la possession (respawn avec équipement).
    local tenue = character:GetPicked()
    if (tenue and tenue:IsA(Weapon)) then
        PousserArme(tenue); SuivreArme(tenue)
    else
        HUD:CallEvent("HudArme", false)
    end

    character:Subscribe("PickUp", function(_, objet)
        if (objet:IsA(Weapon)) then PousserArme(objet); SuivreArme(objet) end
    end)

    character:Subscribe("Drop", function()
        SuivreArme(nil)
        HUD:CallEvent("HudArme", false)
    end)
end

-- ── État poussé par le serveur ─────────────────────────────────────────────────
--
-- Le serveur envoie à chaque changement ; on ne demande jamais. Le panneau
-- s'ouvre donc sur des données déjà là, sans aller-retour ni vide transitoire.

Events.SubscribeRemote("Narvos:Inventaire", function(donnees)
    HUD:CallEvent("NarvosInventaire", donnees)
end)

-- ── Inventaire : gestes de la page (maquette « Inventaire NARVOS », 2026-09-14) ──
-- La page n'envoie qu'un uid ou un emplacement ; le serveur revalide sur le sac.
Page("hud", "NarvosInventaire:Equiper", function(uid)
    Events.CallRemote("Narvos:Inventaire:Equiper", Reliability.Reliable, uid)
end)
Page("hud", "NarvosInventaire:Desequiper", function(slot)
    Events.CallRemote("Narvos:Inventaire:Desequiper", Reliability.Reliable, slot)
end)
Page("hud", "NarvosInventaire:Utiliser", function(uid)
    Events.CallRemote("Narvos:Inventaire:Utiliser", Reliability.Reliable, uid)
end)
Page("hud", "NarvosInventaire:Jeter", function(uid)
    Events.CallRemote("Narvos:Inventaire:Jeter", Reliability.Reliable, uid)
end)
Page("hud", "NarvosInventaire:Detruire", function(uid)
    Events.CallRemote("Narvos:Inventaire:Detruire", Reliability.Reliable, uid)
end)
Events.SubscribeRemote("Narvos:InventaireErreur", function(raison)
    HUD:CallEvent("NarvosInventaireRetour", tostring(raison or ""), "erreur")
end)
Events.SubscribeRemote("Narvos:InventaireInfo", function(texte)
    HUD:CallEvent("NarvosInventaireRetour", tostring(texte or ""), "info")
end)

-- ── Roue d'objets : état et retours ────────────────────────────────────────────

Events.SubscribeRemote("Narvos:Roue", function(donnees)
    HUD:CallEvent("NarvosRoue", donnees)
end)

Events.SubscribeRemote("Narvos:RoueErreur", function(raison)
    HUD:CallEvent("NarvosMessage", raison, "erreur")
    -- Le refus d'un emplacement (vide, objet parti) doit AUSSI se voir dans la
    -- roue elle-même : la case clignote, pas seulement le toast.
    HUD:CallEvent("NarvosRoueRefus", raison)
end)

Events.SubscribeRemote("Narvos:RoueInfo", function(texte)
    HUD:CallEvent("NarvosMessage", texte, "info")
end)

Events.SubscribeRemote("Narvos:RoueActivee", function(emplacement)
    HUD:CallEvent("NarvosRoueActivee", emplacement)
end)

Events.SubscribeRemote("Narvos:Classes", function(donnees)
    HUD:CallEvent("NarvosClasses", donnees)
end)

-- ⚠ LA SOURIS. Le panneau s'affichait sans elle : les recettes etaient
-- visibles et rien n'etait cliquable (audit du 2026-09-11). Patron de
-- l'etabli d'assemblage : ouvrir sans bascule (le rafraichissement qui suit un
-- craft ne doit pas REFERMER), fermer quand le serveur envoie une liste vide
-- (sortie de zone).
Events.SubscribeRemote("Narvos:Atelier", function(station, label, recettes)
    HUD:CallEvent("NarvosAtelier", station, label, recettes)
    if (type(recettes) == "table" and #recettes > 0) then
        if (panneau ~= "atelier") then Basculer("atelier") end
    elseif (panneau == "atelier") then
        Basculer("atelier")
    end
end)
Events.SubscribeRemote("Narvos:AtelierFait", function(recetteId, itemId)
    HUD:CallEvent("NarvosAtelierFait", recetteId, itemId)
end)
Events.SubscribeRemote("Narvos:AtelierErreur", function(raison)
    HUD:CallEvent("NarvosAtelierErreur", raison)
end)
-- Meme patron que l'atelier. Le serveur envoie `false` a la sortie de zone.
Events.SubscribeRemote("Narvos:Gisement", function(donnees)
    HUD:CallEvent("NarvosGisement", donnees)
    if (donnees) then
        if (panneau ~= "gisement") then Basculer("gisement") end
    elseif (panneau == "gisement") then
        Basculer("gisement")
    end
end)
Events.SubscribeRemote("Narvos:GisementFait", function(itemId, quantite)
    HUD:CallEvent("NarvosGisementFait", itemId, quantite)
end)
Events.SubscribeRemote("Narvos:GisementErreur", function(raison)
    HUD:CallEvent("NarvosGisementErreur", raison)
end)
Events.SubscribeRemote("Narvos:Radar", function(donnees)
    HUD:CallEvent("NarvosRadar", donnees)
end)

-- ── Retours de l'interface ────────────────────────────────────────────────────
--
-- `Events.Subscribe` (et non SubscribeRemote) : ces événements viennent du
-- JavaScript de la page, pas du réseau.

Page("hud", "Narvos:UIChoisirClasse", function(class_id)
    -- Le client ne décide de rien : il transmet. Le serveur revalide l'id contre
    -- le catalogue avant d'agir — une interface reste modifiable par le joueur.
    Events.CallRemote("Narvos:ChoisirClasse", Reliability.Reliable, class_id)

    -- Refermer tout de suite : le personnage va être remplacé, et un panneau
    -- resté ouvert décrirait le corps précédent.
    if (panneau) then Basculer(panneau) end
end)

Page("hud", "Narvos:UIFermer", function()
    if (panneau) then Basculer(panneau) end
end)

-- ── Roue d'objets : les choix de la page ───────────────────────────────────────
--
-- Le client ne décide de rien : il transmet, le serveur revalide (assignable ?
-- dans le sac ? emplacement 1..5 ?) avant d'agir. `Reliability.Reliable` en 2e
-- argument, obligatoire client -> serveur — l'omettre perd la charge utile
-- sans erreur.

Page("hud", "NarvosRoue:Activer", function(emplacement)
    Events.CallRemote("Narvos:RoueActiver", Reliability.Reliable, emplacement)
end)

Page("hud", "NarvosRoue:Assigner", function(emplacement, item_id)
    Events.CallRemote("Narvos:RoueAssigner", Reliability.Reliable, emplacement, item_id)
end)

Page("hud", "NarvosRoue:Liberer", function(emplacement)
    Events.CallRemote("Narvos:RoueRetirer", Reliability.Reliable, emplacement)
end)

-- La fermeture repasse par le Lua : lui seul peut rendre la souris au jeu.
Page("hud", "NarvosRoue:UIFermer", function()
    FermerRoue()
end)

-- Radar en continu : la page ré-émet périodiquement pour suivre le joueur.
Page("hud", "Narvos:RadarRefresh", function()
    Events.CallRemote("Narvos:DemanderRadar", Reliability.Reliable)
end)

-- ── Réglages du serveur ────────────────────────────────────────────────────────

-- Le serveur envoie les réglages lus dans [custom_data] : une seule source de
-- vérité, modifiable dans Package.toml sans toucher au code.
--
-- ⚠ Cet événement n'arrivait pas avant le 2026-09-02 : le package était en
-- compatibility_version 1.93, où Events.CallRemote n'a PAS de paramètre
-- `reliability`. Le serveur envoyait donc Reliability.Reliable comme premier
-- argument et la table de config comme second — le client recevait un nombre.
-- Corrigé en passant le package en 1.139. Ne pas redescendre sous 1.139.
Events.SubscribeRemote("NarvosIso:Config", function(config)
    if (type(config) ~= "table") then
        Console.Error("NarvosIso:Config a reçu un " .. type(config)
            .. " au lieu d'une table — compatibility_version trop basse ?")
        return
    end

    ISO.pitch = config.pitch or ISO.pitch
    ISO.yaw = config.yaw or ISO.yaw
    ISO.arm_length = config.arm_length or ISO.arm_length
    ISO.arm_min = config.arm_min or ISO.arm_min
    ISO.arm_max = config.arm_max or ISO.arm_max

    -- Un respawn renvoie la config : on repart de la vue du jeu plutôt que de
    -- laisser le joueur en 1ʳᵉ personne sur un personnage qu'il vient de
    -- reprendre.
    vue_courante = 1
    AppliquerVue()

    -- Le HUD se branche ICI et pas au chargement du package : les
    -- abonnements vivent sur le PERSONNAGE, et changer de classe en detruit
    -- un pour en creer un autre. Cet evenement arrive a chaque possession.
    EquiperHud(Client.GetLocalPlayer() and Client.GetLocalPlayer():GetControlledCharacter())

    -- Les touches viennent des liaisons REELLES du joueur. Si elles ne sont pas
    -- encore arrivees, on nomme l'action sans inventer de touche.
    local t_vue = touches_par_action.vue
    local t_edit = touches_par_action.edition_bascule
    Console.Log("NARVOS iso : vue posée (pitch " .. ISO.pitch
        .. ", bras " .. ISO.arm_length .. "). "
        .. (t_vue and (t_vue .. " change de vue") or "« Changer de vue » dans les commandes")
        .. (t_edit and (", " .. t_edit .. " ouvre le mode edition") or "")
        .. ", molette pour zoomer.")
end)

-- Un package rechargé à chaud laisserait son Timer tourner : il continuerait à
-- écrire dans une caméra que plus personne ne pilote.
Package.Subscribe("Unload", function()
    ArreterReimposition()
end)

-- ═══════════════════════════════════════════════════════════════════════════════
-- ÉCRAN DE CONNEXION / SÉLECTION / CRÉATION
--
-- Un WebUI SÉPARÉ du HUD, et c'est délibéré : le HUD reste tel quel, aucun de ses
-- 254 lignes de CSS ni de ses abonnements n'est touché. L'écran de création vit
-- dans son propre document, s'affiche avant le jeu, et disparaît quand le joueur
-- entre. Rien du système existant ne peut casser.
--
-- Il ne fait que RELAYER. Toute décision est côté serveur (Server/Session.lua) :
--   serveur -> Narvos:Options / Narvos:Session -> ce fichier -> WebUI
--   WebUI   -> NarvosCreation:*                -> ce fichier -> serveur
-- ═══════════════════════════════════════════════════════════════════════════════

local Creation = nil

--- Le WebUI n'est créé qu'au premier message du serveur : le fabriquer au
--- chargement du package l'afficherait avant même de savoir s'il y a une session.
local function OuvrirCreation()
    if (Creation) then return Creation end

    -- Modal : on ferme tout le reste avant d'ouvrir. Un panneau HUD survivant
    -- sous l'ecran de creation continuerait de reclamer la souris.
    FermerAutresMenus("creation")
    if (panneau) then Basculer(panneau) end
    HUD:SetVisibility(WidgetVisibility.Hidden)

    Creation = WebUI("NARVOS Creation", "file:///UI/creation/index.html")

    -- ⚠ ABONNER L'INSTANCE, ici et pas ailleurs. Les evenements emis par la
    -- page n'arrivent QUE par `ui:Subscribe` (webui.mdx:81) ; le `Events`
    -- global ne les voit pas. Et l'instance n'existe qu'a partir de cette
    -- ligne, d'ou l'abonnement differe.
    BrancherPage("creation", Creation)

    -- Même séquence que les panneaux du HUD (voir `Basculer` plus haut) : sans
    -- `SetMouseEnabled`, le curseur reste capturé par le jeu et rien n'est
    -- cliquable ; sans `Chat.SetVisibility(false)`, la frappe part dans le chat.
    Input.SetMouseEnabled(true)
    Chat.SetVisibility(false)
    Creation:BringToFront()

    return Creation
end

--- Ferme l'écran et rend les commandes au jeu.
local function FermerCreation()
    -- Une session déjà en jeu peut arriver après un rechargement du package,
    -- sans avoir créé la page de sélection dans cette instance du client.
    HUD:SetVisibility(WidgetVisibility.Visible)
    if (not Creation) then return end

    Creation:Destroy()
    Creation = nil

    Input.SetMouseEnabled(false)
    Chat.SetVisibility(true)
end

-- ── Serveur -> WebUI ──────────────────────────────────────────────────────────

-- ⚠ COURSE AU DÉMARRAGE. `WebUI(...)` rend l'objet immédiatement, mais la page
-- n'a pas encore chargé : son `DOMContentLoaded` — donc ses `Events.Subscribe` —
-- n'a pas eu lieu. Un `CallEvent` émis dans le même tick tombe dans le vide, et
-- l'écran reste noir sans la moindre erreur.
--
-- On TAMPONNE donc le dernier état, et la page le réclame elle-même quand elle
-- est prête (`NarvosCreation:Pret`). Trouvé par audit le 2026-09-03.
local dernieres_options = nil
local derniere_session = nil

-- ── SONDE TEMPORAIRE ─────────────────────────────────────────────────────────
--
-- Répond à une question binaire que rien d'autre ne tranche : le pont
-- WebUI → Lua porte-t-il une CHAÎNE ?
--
-- Trois lectures possibles dans le log client :
--   « ping cablage » absent          -> le câblage de la page ne va pas au bout
--   « cablage » seul                 -> le clic n'atteint pas le gestionnaire
--   « cablage » + « clic-creer »     -> le pont porte les chaînes, et le défaut
--                                       est dans le passage d'OBJETS
--
-- ⚠ À RETIRER une fois la réponse obtenue.
Page("creation", "NarvosCreation:Ping", function(etape)
    Console.Log("[NARVOS] ping " .. tostring(etape))
end)

Page("creation", "NarvosCreation:Pret", function()
    if (not Creation) then return end
    if (dernieres_options) then Creation:CallEvent("NarvosCreation:Options", dernieres_options) end
    if (derniere_session) then Creation:CallEvent("NarvosCreation:Session", derniere_session) end
end)

Events.SubscribeRemote("Narvos:Options", function(options)
    dernieres_options = options
    OuvrirCreation():CallEvent("NarvosCreation:Options", options)
end)

Events.SubscribeRemote("Narvos:Session", function(session)
    -- `en_jeu` est le seul état qui ferme l'écran. On le traite AVANT d'ouvrir,
    -- sinon une session déjà en jeu recréerait le WebUI qu'on vient de détruire.
    if (session and session.etat == "en_jeu") then
        FermerCreation()
        return
    end

    derniere_session = session
    OuvrirCreation():CallEvent("NarvosCreation:Session", session)
end)

-- ── WebUI -> serveur ──────────────────────────────────────────────────────────
--
-- Aucune validation ici : le client n'a pas autorité. Server/Session.lua revalide
-- tout, y compris l'état dans lequel le joueur a le droit d'agir.
--
-- ⚠ `Reliability.Reliable` EST OBLIGATOIRE EN DEUXIÈME ARGUMENT. En
-- compatibility_version 1.139, `Events.CallRemote` côté client attend
-- `(événement, reliability, args...)`. L'omettre ne lève RIEN : le premier
-- argument utile est pris pour la fiabilité, la charge utile se perd, et le
-- serveur ne voit jamais l'appel. Mesuré le 2026-09-03 — les cinq relais
-- ci-dessous étaient muets, et l'écran de création semblait simplement inerte
-- au clic sur « Créer ».
--
-- C'est le pendant exact du défaut documenté plus haut sur NarvosIso:Config.

-- Le bouton « Continuer » de l'écran Steam. Il n'avait AUCUN gestionnaire : la
-- page l'émettait dans le vide depuis le premier jour.
Page("creation", "NarvosCreation:Steam", function()
    Events.CallRemote("Narvos:ConnexionSteam", Reliability.Reliable)
end)

Page("creation", "NarvosCreation:Connexion", function(identifiant, motdepasse)
    Events.CallRemote("Narvos:Connexion", Reliability.Reliable, identifiant, motdepasse)
end)

Page("creation", "NarvosCreation:Inscription", function(identifiant, motdepasse)
    Events.CallRemote("Narvos:Inscription", Reliability.Reliable, identifiant, motdepasse)
end)

Page("creation", "NarvosCreation:Creer", function(params)
    Console.Log("[NARVOS] client : NarvosCreation:Creer recu du WebUI, type=" .. type(params))
    Events.CallRemote("Narvos:CreerPerso", Reliability.Reliable, params)
end)

Page("creation", "NarvosCreation:Choisir", function(id)
    Events.CallRemote("Narvos:ChoisirPerso", Reliability.Reliable, id)
end)

-- Le monde de depart, choisi sur la carte apres avoir pris son personnage.
--
-- ⚠ AUCUNE VALIDATION ICI, ET C'EST VOULU. Le client n'a pas autorite : c'est
-- `Depart.Retenu`, cote serveur, qui confronte l'identifiant au catalogue et
-- retombe sur le defaut. Filtrer ici donnerait une SECONDE regle, qui finirait
-- par diverger de la premiere — et seule la premiere protege.
--
-- La liste affichee arrive par `Narvos:Session` (champ `departs`), relayee sans
-- transformation par le gestionnaire plus haut.
Page("creation", "NarvosCreation:ChoisirDepart", function(monde_id)
    Events.CallRemote("Narvos:ChoisirDepart", Reliability.Reliable, monde_id)
end)

-- Aperçu 3D : le serveur habille un mannequin hors de la map et cadre la caméra
-- dessus. Voir Server/Session.lua.
Page("creation", "NarvosCreation:Apercu", function(params)
    -- Trace de diagnostic : elle part dans le log du CLIENT
    -- (%LOCALAPPDATA%/NanosWorld/Saved/Logs). Si elle y est mais que le serveur
    -- ne dit rien, la rupture est sur le CallRemote ; si elle n'y est pas, le
    -- WebUI ne parle pas au Lua. A retirer une fois l'apercu vu fonctionner.
    Console.Log("[NARVOS] client : NarvosCreation:Apercu recu du WebUI, type=" .. type(params))
    Events.CallRemote("Narvos:Apercu", Reliability.Reliable, params)
end)

Page("creation", "NarvosCreation:Supprimer", function(id)
    Events.CallRemote("Narvos:SupprimerPerso", Reliability.Reliable, id)
end)

-- Un package rechargé à chaud laisserait le WebUI orphelin, souris capturée et
-- chat masqué — le joueur se retrouverait sans commandes.
Package.Subscribe("Unload", function()
    FermerCreation()
end)

-- =============================================================================
-- MENU D'ANIMATIONS
--
-- Les touches ne sont PAS enregistrees ici : le repartiteur unique en tete de
-- fichier s'en charge, commandes et emotes confondues. Ce bloc ne porte plus
-- que le menu lui-meme.
-- =============================================================================

local Emotes = nil
-- `raccourcis` est declare EN TETE du fichier : le repartiteur le lit.

-- ── Le menu ───────────────────────────────────────────────────────────────────

local function OuvrirMenuEmotes()
    -- Pendant la creation, le joueur n'a pas de corps : aucune emote a jouer.
    if (CreationOuverte()) then return end

    -- Ferme le HUD s'il etait ouvert : voir l'avertissement sur
    -- `FermerAutresMenus` plus haut.
    if (panneau) then Basculer(panneau) end

    if (not Emotes) then
        Emotes = WebUI("NARVOS Emotes", "file:///UI/emotes/index.html")
        BrancherPage("emotes", Emotes)
    end

    menu_emotes_ouvert = true
    Emotes:CallEvent("NarvosEmotes:Ouvrir")
    Input.SetMouseEnabled(true)
    Chat.SetVisibility(false)
    Emotes:BringToFront()

    -- Le catalogue n'est demandé qu'à l'ouverture : il fait plusieurs dizaines de
    -- kilo-octets et la plupart des joueurs n'ouvriront jamais ce menu.
    Events.CallRemote("Narvos:DemanderEmotes", Reliability.Reliable)
end

local function FermerMenuEmotes()
    if (not Emotes or not menu_emotes_ouvert) then return end

    menu_emotes_ouvert = false
    Emotes:CallEvent("NarvosEmotes:Fermer")
    Input.SetMouseEnabled(false)
    Chat.SetVisibility(true)
end

-- ── La roue d'objets (TAB) ─────────────────────────────────────────────────────
--
-- Cycle propre, volontairement HORS des panneaux (`PANNEAUX` côté page ne la
-- connaît pas) : la roue est éphémère — elle s'ouvre, on choisit, elle se
-- referme. Elle ne s'enchaîne ni avec l'inventaire ni avec la pause.
-- Même séquence souris/chat/premier plan que `Basculer` et le menu d'emotes :
-- sans SetMouseEnabled, rien n'est cliquable ; sans BringToFront, la roue peut
-- passer sous un autre WebUI.

FermerRoue = function()
    if (not roue_ouverte) then return end

    roue_ouverte = false
    HUD:CallEvent("NarvosRoue:Fermer")
    Input.SetMouseEnabled(false)
    Chat.SetVisibility(true)
end

local function OuvrirRoue()
    if (CreationOuverte()) then return end

    -- Exclusion mutuelle, même remède que partout : un seul menu à la fois.
    if (panneau) then Basculer(panneau) end
    FermerMenuEmotes()

    roue_ouverte = true
    HUD:CallEvent("NarvosRoue:Ouvrir")
    Input.SetMouseEnabled(true)
    Chat.SetVisibility(false)
    HUD:BringToFront()

    -- Vue fraîche à l'ouverture. Le serveur pousse déjà la roue à chaque envoi
    -- d'inventaire ; on redemande au cas où le sac aurait changé hors de ses
    -- yeux (voyage entre mondes, par exemple).
    Events.CallRemote("Narvos:DemanderRoue", Reliability.Reliable)
end

local function BasculerRoue()
    if (roue_ouverte) then FermerRoue() else OuvrirRoue() end
end

-- La sonde de modalite est assignee ICI, une fois `Creation` declaree plus haut.
CreationOuverte = function() return Creation ~= nil end

-- L'arbitre est assigne ICI, une fois `FermerMenuEmotes` reellement defini.
-- C'est le pattern ref du projet : la reference est posee a l'usage, pas a la
-- declaration, pour qu'aucun appelant ne tombe sur une valeur encore nil.
FermerAutresMenus = function(sauf)
    if (sauf ~= "emotes") then FermerMenuEmotes() end
    if (sauf ~= "roue") then FermerRoue() end
end

-- ═══════════════════════════════════════════════════════════════════════════════
-- L'ÉTABLI D'ASSEMBLAGE — relais page ↔ serveur
--
-- L'assemblage se déclenche par PROXIMITÉ, comme le craft : le serveur envoie
-- `Narvos:AssemblageOuverture` quand le joueur entre dans la zone de l'établi
-- (Server/Assemblage.lua, BeginOverlap du Trigger). Le panneau est un panneau
-- du HUD comme les autres — même souris, même Échap, même voile.
--
-- ⚠ CE FICHIER NE DÉCIDE RIEN. La page émet des intentions (des chaînes :
-- plan_id, slot_id, uid) ; chaque geste est RELAYÉ au serveur, qui revalide
-- tout (proximité, session, uid dans la grille) avant que `Narvos.Assemblage`
-- ne tranche. `Reliability.Reliable` en 2ᵉ argument, obligatoire
-- client -> serveur — l'omettre perd la charge utile sans erreur.
-- ═══════════════════════════════════════════════════════════════════════════════

--- Ouvre le panneau d'assemblage. Appelée par le serveur (proximité) : pas de
--- bascule — un second `BeginOverlap` ne doit pas REFERMER le panneau.
local function OuvrirAssemblage()
    if (CreationOuverte()) then return end
    if (panneau == "assemblage") then return end
    Basculer("assemblage")
end

--- Referme le panneau si c'est lui qui est ouvert (sortie de zone). La session
--- persiste côté serveur — fermer l'interface ne décide rien des pièces.
local function FermerAssemblage()
    if (panneau == "assemblage") then Basculer("assemblage") end
end

-- ── Serveur -> page ───────────────────────────────────────────────────────────

-- L'état complet (plans, session, sac avec uids, filtrage par slot). TAMPONNÉ :
-- l'envoi d'entrée de zone peut précéder le chargement de la page — elle le
-- réclame par `NarvosAssemblage:Pret` quand elle est prête.
Events.SubscribeRemote("Narvos:Assemblage", function(donnees)
    dernier_etat_assemblage = donnees
    if (HUD) then HUD:CallEvent("NarvosAssemblage", donnees) end
end)

Events.SubscribeRemote("Narvos:AssemblageOuverture", function()
    OuvrirAssemblage()
    -- Vue fraîche à l'ouverture : le sac a pu changer hors des yeux du serveur.
    Events.CallRemote("Narvos:DemanderAssemblage", Reliability.Reliable)
end)

Events.SubscribeRemote("Narvos:AssemblageFermeture", function()
    FermerAssemblage()
end)

Events.SubscribeRemote("Narvos:AssemblageErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosAssemblageErreur", tostring(raison or "Assemblage impossible")) end
end)

Events.SubscribeRemote("Narvos:AssemblageInfo", function(texte)
    if (HUD) then HUD:CallEvent("NarvosMessage", tostring(texte or ""), "info") end
end)

Events.SubscribeRemote("Narvos:AssemblageFait", function(item_id, quantite)
    if (HUD) then HUD:CallEvent("NarvosAssemblageFait", item_id, quantite) end
end)

-- ── Page -> serveur ───────────────────────────────────────────────────────────
--
-- ⚠ `Page(...)` ET NON `Events.Subscribe(...)` : les événements d'une WebUI
-- n'arrivent QUE par `ui:Subscribe` sur l'instance. Et la page n'envoie que
-- des chaînes — un objet JS ne traverse pas le pont (il se perd en silence).

-- La page est prête (ouverture du panneau) : on repousse l'état tamponné.
Page("hud", "NarvosAssemblage:Pret", function()
    if (HUD and dernier_etat_assemblage) then
        HUD:CallEvent("NarvosAssemblage", dernier_etat_assemblage)
    end
end)

Page("hud", "NarvosAssemblage:Ouvrir", function(plan_id)
    Events.CallRemote("Narvos:AssemblageOuvrir", Reliability.Reliable, plan_id)
end)

Page("hud", "NarvosAssemblage:Poser", function(slot_id, uid)
    Events.CallRemote("Narvos:AssemblagePoser", Reliability.Reliable, slot_id, uid)
end)

Page("hud", "NarvosAssemblage:Retirer", function(slot_id, item_id)
    Events.CallRemote("Narvos:AssemblageRetirer", Reliability.Reliable, slot_id, item_id)
end)

Page("hud", "NarvosAssemblage:Abandonner", function()
    Events.CallRemote("Narvos:AssemblageAbandonner", Reliability.Reliable)
end)

Page("hud", "NarvosAssemblage:Finaliser", function()
    Events.CallRemote("Narvos:AssemblageFinaliser", Reliability.Reliable)
end)


-- ═══════════════════════════════════════════════════════════════════════════════
-- LE PONT METAHUMAN — RETIRÉ LE 2026-09-14
--
-- Le panneau « metahumain » (touche U, /metahumain) posait des pièces-Blueprints
-- PAR-DESSUS le MetaHuman du joueur : un second corps, féminin pour tous, et des
-- vêtements que le joueur n'avait pas choisis. Retour de jeu de Hanibes :
-- « plusieurs menus MetaHuman sont apparus, supprime cette logique parasite ; un
-- seul menu d'équipement ». L'apparence se règle dans l'INVENTAIRE, onglet
-- APPARENCE (relais `NarvosApparence:*` plus bas), par l'éditeur du Meta
-- Customization System déjà employé à la création (Client/UI/mcs-editeur.js).
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Points de téléportation ───────────────────────────────────────────────────
--
-- Contrat écrit côté serveur (Server/Teleports.lua) :
--   serveur -> client  Narvos:TP:Proche (info | false) · Narvos:TP:Refus (raison)
--                      Narvos:TP:Liste (etat) — `ouvrir = true` quand /tp l'a demandé
--   client -> serveur  Narvos:TP:Utiliser (id) · Narvos:TP:Demander · Narvos:TP:Editer (op, …)
--
-- ⚠ CE FICHIER NE DÉCIDE RIEN. Il retient le point dont le joueur est dans le
-- cercle, pour que la touche sache QUEL point passer ; le serveur revérifie la
-- distance, et toute édition est gardée côté serveur (PeutGerer).
local tp_proche = nil

--- La touche ACTUELLEMENT liée à une action, pour l'invite : le joueur a pu la
--- réassigner, un libellé figé mentirait.
local function ToucheDe(action_id)
    for touche, id in pairs(commandes_par_touche) do
        if (id == action_id) then return touche end
    end
    return nil
end

Events.SubscribeRemote("Narvos:TP:Proche", function(info)
    tp_proche = (type(info) == "table" and type(info.id) == "string") and info or nil
    if (not HUD) then return end
    if (tp_proche) then
        HUD:CallEvent("NarvosTP:Proche", {
            id = tp_proche.id, nom = tp_proche.nom, pret = tp_proche.pret,
            vers = tp_proche.vers, touche = ToucheDe("interagir"),
        })
    else
        HUD:CallEvent("NarvosTP:Proche", false)
    end
end)

Events.SubscribeRemote("Narvos:TP:Refus", function(raison)
    if (HUD) then HUD:CallEvent("NarvosTP:Refus", tostring(raison)) end
end)

Events.SubscribeRemote("Narvos:TP:Liste", function(etat)
    if (type(etat) ~= "table") then
        Console.Error("Narvos:TP:Liste a reçu un " .. type(etat) .. " au lieu d'une table")
        return
    end
    -- Comme le panneau MetaHuman : l'état qui suit une action (`ouvrir` absent)
    -- ne fait que rafraîchir, il ne referme jamais le panneau.
    if (etat.ouvrir == true and panneau ~= "teleports") then Basculer("teleports") end
    if (HUD) then HUD:CallEvent("NarvosTP:Liste", etat) end
end)

Page("hud", "NarvosTP:Demander", function()
    Events.CallRemote("Narvos:TP:Demander", Reliability.Reliable)
end)

-- L'opération est un NOM que le serveur confronte à sa table d'opérations ; les
-- arguments passent tels quels et sont bornés là-bas.
Page("hud", "NarvosTP:Editer", function(operation, a, b, c, d, e)
    Events.CallRemote("Narvos:TP:Editer", Reliability.Reliable, operation, a, b, c, d, e)
end)

-- ── Zaaps : points de sauvegarde (D4, 2026-09-15) ─────────────────────────────
--
-- Contrat écrit côté serveur (Server/Zaaps.lua) :
--   serveur -> client  Narvos:Zaap:Liste (etat) · Narvos:Zaap:Proche (info | false)
--                      Narvos:Zaap:Actif (info) · Narvos:Zaap:Refus (raison)
--   client -> serveur  Narvos:Zaap:Activer (id) · Narvos:Zaap:Demander
--
-- ⚠ CE FICHIER NE DÉCIDE RIEN : il retient le Zaap dont le joueur est dans le
-- cercle pour que la touche d'interaction sache LEQUEL activer ; le serveur
-- revérifie la distance et écrit en base. Le dessin vit dans Client/Zaaps.lua,
-- requis ICI et non avec les autres modules plus bas : les gestionnaires qui
-- suivent le capturent, une déclaration plus tardive leur donnerait un global nil.
local ZaapsClient = Package.Require("Client/Zaaps.lua")
local zaap_proche = nil

Events.SubscribeRemote("Narvos:Zaap:Liste", function(etat)
    if (type(etat) ~= "table") then return end
    ZaapsClient.Afficher(etat)
end)

Events.SubscribeRemote("Narvos:Zaap:Proche", function(info)
    zaap_proche = (type(info) == "table" and type(info.id) == "string") and info or nil
    if (zaap_proche) then ZaapsClient.Recaler(zaap_proche.id) end
    if (not HUD) then return end
    if (zaap_proche) then
        HUD:CallEvent("NarvosZaap:Proche", {
            id = zaap_proche.id, nom = zaap_proche.nom, actif = (zaap_proche.actif == true),
            touche = ToucheDe("interagir"),
        })
    else
        HUD:CallEvent("NarvosZaap:Proche", false)
    end
end)

Events.SubscribeRemote("Narvos:Zaap:Actif", function(info)
    ZaapsClient.Activer(info)
    if (HUD and type(info) == "table") then HUD:CallEvent("NarvosZaap:Actif", tostring(info.nom or "")) end
end)

Events.SubscribeRemote("Narvos:Zaap:Refus", function(raison)
    if (HUD) then HUD:CallEvent("NarvosZaap:Refus", tostring(raison)) end
end)

-- La liste existe dès le chargement : les Zaaps se voient avant qu'on en active un.
Events.CallRemote("Narvos:Zaap:Demander", Reliability.Reliable)

-- ── Édition des PNJ (/editionpnj) ─────────────────────────────────────────────
--
-- Contrat écrit côté serveur (Server/EditionPnj.lua) :
--   serveur -> client  Narvos:EditionPnj:Etat (etat) — `ouvrir = true` quand
--                      /editionpnj l'a demandé
--   client -> serveur  Narvos:EditionPnj:Demander · :Definir (portee, cle, r, g, b,
--                      taille, visible) · :Reinitialiser (portee, cle)
-- Ce fichier ne décide rien : garde et bornes sont côté serveur.
Events.SubscribeRemote("Narvos:EditionPnj:Etat", function(etat)
    if (type(etat) ~= "table") then return end
    -- Un état qui suit un réglage (`ouvrir` absent) rafraîchit sans refermer.
    if (etat.ouvrir == true and panneau ~= "editionpnj") then Basculer("editionpnj") end
    if (HUD) then HUD:CallEvent("NarvosEditionPnj:Etat", etat) end
end)

Page("hud", "NarvosEditionPnj:Demander", function()
    Events.CallRemote("Narvos:EditionPnj:Demander", Reliability.Reliable)
end)

Page("hud", "NarvosEditionPnj:Definir", function(portee, cle, r, g, b, taille, visible)
    Events.CallRemote("Narvos:EditionPnj:Definir", Reliability.Reliable, portee, cle, r, g, b, taille, visible)
end)

Page("hud", "NarvosEditionPnj:Reinitialiser", function(portee, cle)
    Events.CallRemote("Narvos:EditionPnj:Reinitialiser", Reliability.Reliable, portee, cle)
end)

-- ── Porte à code (digicode) ───────────────────────────────────────────────────
--
-- Contrat écrit côté serveur (Server/Digicode.lua) :
--   serveur -> client  Narvos:Digicode:Proche (info | false)
--                      Narvos:Digicode:Clavier (etat = { mode, id, titre, aide })
--                      Narvos:Digicode:Resultat (ok, message)
--   client -> serveur  Narvos:Digicode:Interagir (id) · Narvos:Digicode:Valider (mode, id, code)
--
-- ⚠ CE FICHIER NE DÉCIDE RIEN : ni la proximité (revérifiée), ni le droit de
-- passer (la zone), ni le code (empreinte côté serveur). Il retient la porte dont
-- le joueur est dans le cercle, pour que la touche d'interaction sache laquelle.
local digicode_proche = nil

Events.SubscribeRemote("Narvos:Digicode:Proche", function(info)
    digicode_proche = (type(info) == "table" and type(info.id) == "string") and info or nil
    if (not HUD) then return end
    if (digicode_proche) then
        HUD:CallEvent("NarvosDigicode:Proche", {
            id = digicode_proche.id, passe_droit = digicode_proche.passe_droit == true,
            touche = ToucheDe("interagir"),
        })
    else
        HUD:CallEvent("NarvosDigicode:Proche", false)
    end
end)

Events.SubscribeRemote("Narvos:Digicode:Clavier", function(etat)
    if (type(etat) ~= "table") then return end
    if (panneau ~= "digicode") then Basculer("digicode") end
    if (HUD) then HUD:CallEvent("NarvosDigicode:Clavier", etat) end
end)

-- Un code accepté referme le clavier (le Lua seul rend la souris) ; un refus le
-- laisse ouvert, avec la raison.
Events.SubscribeRemote("Narvos:Digicode:Resultat", function(ok, message)
    if (HUD) then HUD:CallEvent("NarvosDigicode:Resultat", ok == true, tostring(message or "")) end
    if (ok == true and panneau == "digicode") then Basculer("digicode") end
end)

-- ⚠ `id` VIDE et jamais nil : un nil au milieu d'arguments réseau peut décaler
-- ceux qui suivent — le code arriverait à la place de l'identifiant.
Page("hud", "NarvosDigicode:Valider", function(mode, id, code)
    Events.CallRemote("Narvos:Digicode:Valider", Reliability.Reliable,
        tostring(mode or ""), tostring(id or ""), tostring(code or ""))
end)

-- ── Téléphone (smartphone) ────────────────────────────────────────────────────
--
-- Contrat écrit côté serveur (Server/Communications.lua) :
--   serveur -> client  Narvos:Telephone (etat) — `ouvrir = true` quand F7 l'a demandé
--                      Narvos:Telephone:Recu (de, non_lus)
--   client -> serveur  Narvos:Telephone:Ouvrir · Narvos:Telephone:Envoyer (dest_id, texte)
--                      Narvos:Telephone:Lire
-- Le serveur refuse sans smartphone : la touche ne fait que DEMANDER.
Events.SubscribeRemote("Narvos:Telephone", function(etat)
    if (type(etat) ~= "table") then return end
    if (etat.ouvrir == true and panneau ~= "telephone") then Basculer("telephone") end
    if (HUD) then HUD:CallEvent("NarvosTelephone", etat) end
end)

Events.SubscribeRemote("Narvos:Telephone:Recu", function(de, non_lus)
    if (HUD) then HUD:CallEvent("NarvosTelephone:Recu", tostring(de or "?"), tonumber(non_lus) or 0) end
end)

Page("hud", "NarvosTelephone:Envoyer", function(dest_id, texte)
    Events.CallRemote("Narvos:Telephone:Envoyer", Reliability.Reliable,
        tostring(dest_id or ""), tostring(texte or ""))
end)

Page("hud", "NarvosTelephone:Lire", function()
    Events.CallRemote("Narvos:Telephone:Lire", Reliability.Reliable)
end)

-- ── Marchands : parler, dialoguer, commercer ──────────────────────────────────
--
-- Contrat (Server/Index.lua) :
--   serveur -> client  Narvos:MarchandProche (info | false) · Narvos:Dialogue (nœud
--                      présenté : orateur, texte, choix filtrés) · Narvos:DialogueFin
--                      Narvos:DialogueErreur · Narvos:Boutique (etat)
--                      Narvos:BoutiqueFait (id, qte, solde) · Narvos:BoutiqueErreur
--   client -> serveur  Narvos:DialogueDebut (id) · Narvos:DialogueChoisir (indice)
--                      Narvos:Boutique:Acheter (id, qte) · Narvos:Boutique:Vendre (id, qte)
-- Le serveur tranche tout (proximité, prix, solde) ; ce fichier ne fait que relayer.
local marchand_info = nil

Events.SubscribeRemote("Narvos:MarchandProche", function(info)
    marchand_info = (type(info) == "table" and type(info.dialogue) == "string") and info or nil
    if (not HUD) then return end
    if (marchand_info) then
        HUD:CallEvent("NarvosMarchand:Proche", {
            nom = marchand_info.nom, sous_titre = marchand_info.sous_titre,
            touche = ToucheDe("interagir"),
        })
    else
        HUD:CallEvent("NarvosMarchand:Proche", false)
    end
end)

Events.SubscribeRemote("Narvos:Dialogue", function(noeud)
    if (type(noeud) ~= "table") then return end
    if (panneau ~= "dialogue") then Basculer("dialogue") end
    if (HUD) then HUD:CallEvent("NarvosDialogue", noeud) end
end)

-- Fin de conversation : c'est le Lua qui ferme le panneau — lui seul rend la
-- souris au jeu (le même chemin que la touche Échap).
Events.SubscribeRemote("Narvos:DialogueFin", function()
    if (panneau == "dialogue") then Basculer("dialogue") end
end)

Events.SubscribeRemote("Narvos:DialogueErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosDialogueErreur", tostring(raison)) end
end)

Events.SubscribeRemote("Narvos:Boutique", function(etat)
    if (type(etat) ~= "table") then return end
    if (panneau ~= "boutique") then Basculer("boutique") end
    if (HUD) then HUD:CallEvent("NarvosBoutique", etat) end
end)

Events.SubscribeRemote("Narvos:BoutiqueFait", function(item_id, quantite, solde)
    if (HUD) then HUD:CallEvent("NarvosBoutiqueFait", item_id, quantite, solde) end
end)

Events.SubscribeRemote("Narvos:BoutiqueErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosBoutiqueErreur", tostring(raison)) end
end)

Page("hud", "NarvosDialogue:Choisir", function(indice)
    Events.CallRemote("Narvos:DialogueChoisir", Reliability.Reliable, indice)
end)

Page("hud", "NarvosBoutique:Acheter", function(id, quantite)
    Events.CallRemote("Narvos:Boutique:Acheter", Reliability.Reliable, id, quantite)
end)

Page("hud", "NarvosBoutique:Vendre", function(id, quantite)
    Events.CallRemote("Narvos:Boutique:Vendre", Reliability.Reliable, id, quantite)
end)

-- ═══════════════════════════════════════════════════════════════════════════════
-- LES COMMANDES — ce que chaque action fait, et quelle touche la declenche
--
-- ── POURQUOI CETTE TABLE EST TOUT EN BAS ──────────────────────────────────────
-- Elle reference `FermerMenuEmotes`, `Basculer`, `VueSuivante` : des `local`
-- definis plus haut. Ecrite en tete, chacun de ces noms se resoudrait en GLOBAL
-- nil et la touche serait inerte — sans la moindre erreur au chargement. C'est le
-- meme piege que `CreationOuverte` et `FermerAutresMenus` juste au-dessus, et
-- c'est pour ca que `ACTIONS` est DECLAREE en tete puis GARNIE ici.
--
-- ── LE CONTRAT AVEC LE SERVEUR ────────────────────────────────────────────────
-- Chaque cle doit exister dans `Commandes.ACTIONS` cote serveur. Une action
-- presente ici mais absente la-bas n'aura jamais de touche ; l'inverse donne une
-- touche qui ne fait rien. Les deux echouent en silence, donc les deux listes se
-- modifient ENSEMBLE.
-- ═══════════════════════════════════════════════════════════════════════════════

ACTIONS.menu_emotes = function()
    if (menu_emotes_ouvert) then FermerMenuEmotes() else OuvrirMenuEmotes() end
end

--- Tab — range ce qu'on tient en main.
---
--- Le serveur décide : lui seul connaît l'arme portée (`Character:GetPicked()`
--- est côté serveur, comme `Drop`). Le client ne fait que demander.
ACTIONS.equipement_retirer = function()
    Events.CallRemote("Narvos:RetirerEquipement", Reliability.Reliable)
end

--- TAB — la roue d'objets. Côté client elle ne fait que s'ouvrir ; chaque
--- choix (assigner, retirer, activer) est REVALIDÉ par le serveur, qui seul
--- connaît le sac et l'arme réellement tenue.
ACTIONS.roue_objets = function()
    BasculerRoue()
end

ACTIONS.menu_inventaire = function() Basculer("inventaire") end
ACTIONS.menu_personnage = function() Basculer("personnage") end

-- Le MEME panneau que la fiche, ouvert sur l'onglet Competences. Deja ouvert :
-- la touche le referme, comme toute bascule — un second appui qui ne ferait que
-- changer d'onglet laisserait le joueur sans moyen clavier de sortir.
ACTIONS.menu_competences = function()
    local ouvrait = (panneau ~= "personnage")
    Basculer("personnage")
    if (ouvrait and panneau == "personnage" and HUD) then
        HUD:CallEvent("NarvosPersonnage:Onglet", "competences")
    end
end
ACTIONS.menu_props      = function() Basculer("props") end
ACTIONS.menu_spawn      = function() Basculer("spawn") end
ACTIONS.menu_armes      = function() Basculer("armes") end
ACTIONS.menu_vehicules  = function() Basculer("vehicules") end
ACTIONS.menu_vaisseaux  = function() Basculer("vehicules", "vaisseaux") end
ACTIONS.menu_radar      = function() Basculer("radar") end

-- Le nom du panneau porte un tiret : c'est l'`id` de la section HTML, et c'est
-- lui que `Basculer` transmet a la page. L'action, elle, garde le nom sans
-- tiret que le catalogue serveur declare.
-- ⚠ F8 OUVRE L'INVENTAIRE SUR SON ONGLET APPARENCE (2026-09-14) : un seul menu
-- d'équipement. Un corps modulaire y trouve le chemin de sa garde-robe à pièces
-- (`NarvosApparence:GardeRobe`). Rappuyer sur F8 dans l'onglet referme.
ACTIONS.menu_garde_robe = function()
    if (panneau == "inventaire" and apparence_cadree) then return Basculer("inventaire") end
    if (panneau ~= "inventaire") then Basculer("inventaire") end
    if (panneau == "inventaire" and HUD) then HUD:CallEvent("NarvosInventaireOnglet", "apparence") end
end


-- Points de téléportation. L'ÉDITION (F6 par défaut) : la page réclame elle-même
-- la liste à l'ouverture (`NarvosTP:Demander`) ; sans droit, elle n'affiche que
-- le verrou — le serveur refuserait de toute façon.
ACTIONS.menu_teleports = function() Basculer("teleports") end

-- INTERAGIR (Y par défaut) : parler au marchand proche, sinon passer le point de
-- téléportation proche. Une touche pour les gestes « devant quelque chose » ; le
-- marchand d'abord — on ne pose pas un point de TP dans une boutique. Rien de
-- proche : la touche ne fait rien.
-- ⚠ L'ORDRE DES TROIS CAS EST UNE DECISION, PAS UNE HABITUDE.
--
-- Un marchand et un point de teleportation ANNONCENT leur touche a l'ecran
-- (« [Y] parler ») : le joueur a lu une promesse, elle passe avant tout. Le
-- ramassage, lui, n'annonce rien — il vient donc en DERNIER, quand rien d'autre
-- ne reclame la touche. L'inverse ferait ramasser une caisse au lieu d'ouvrir la
-- boutique devant laquelle elle traine.
--
-- Le ramassage lui-meme est decide par le SERVEUR : le client ne sait pas ce qui
-- est ramassable — il n'a ni le catalogue d'objets, ni le contenu du sac — et le
-- laisser trancher ouvrirait la porte a un client modifie qui ramasse a 50 m.
ACTIONS.interagir = function()
    if (marchand_info) then
        Events.CallRemote("Narvos:DialogueDebut", Reliability.Reliable, marchand_info.dialogue)
        return
    end
    if (tp_proche) then
        Events.CallRemote("Narvos:TP:Utiliser", Reliability.Reliable, tp_proche.id)
        return
    end
    -- Le Zaap annonce sa touche (« [Y] activer ») : après le passage, avant la
    -- porte à code et le ramassage.
    if (zaap_proche) then
        Events.CallRemote("Narvos:Zaap:Activer", Reliability.Reliable, zaap_proche.id)
        return
    end
    -- La porte à code annonce elle aussi sa touche : elle passe avant le
    -- ramassage, qui n'annonce rien.
    if (digicode_proche) then
        Events.CallRemote("Narvos:Digicode:Interagir", Reliability.Reliable, digicode_proche.id)
        return
    end
    Events.CallRemote("Narvos:Ramasser", Reliability.Reliable)
end

-- Le téléphone. Une DEMANDE : le serveur répond par l'état et `ouvrir = true`
-- (Narvos:Telephone, plus haut) s'il y a un smartphone dans le sac, sinon par
-- une ligne de chat. Déjà ouvert : la touche le referme.
ACTIONS.menu_telephone = function()
    if (panneau == "telephone") then Basculer("telephone") return end
    Events.CallRemote("Narvos:Telephone:Ouvrir", Reliability.Reliable)
end

-- La touche d'arrestation. Le client ne sait rien : ni qui est a portee, ni
-- qui est menotte, ni s'il porte l'objet. Il demande ; Server/Menottes.lua
-- decide (Logic/Menottes.ActionPour) et repond dans le chat.
ACTIONS.menotter = function()
    Events.CallRemote("Narvos:Menotter", Reliability.Reliable)
end

-- Le cliquetis des menottes. `Sound` est d'autorite CLIENT : le serveur diffuse
-- l'evenement aux joueurs a portee d'oreille, chacun joue le son chez lui.
Events.SubscribeRemote("Narvos:Menottes:Son", function(cle, x, y, z)
    if (type(cle) ~= "string" or cle == "") then return end
    pcall(function()
        Sound(Vector(tonumber(x) or 0, tonumber(y) or 0, tonumber(z) or 0), cle, false, true, SoundType.SFX, 1.0, 1.0)
    end)
end)

-- ── FOUILLER (2026-09-19) ─────────────────────────────────────────────────────
-- Le client ne sait RIEN : ni s'il y a un cadavre, ni son contenu. Il demande ;
-- Server/Fouille.lua trouve le cadavre le plus proche sous la portée et répond
-- par la vue (Narvos:Fouille), ou par une raison (Narvos:FouilleErreur).
ACTIONS.fouiller = function()
    Events.CallRemote("Narvos:Fouiller", Reliability.Reliable)
end

-- ── AUTO-MARCHE (2026-09-19, MÉCANISME FINAL) ────────────────────────────────
-- PREMIÈRE VERSION (retirée) : `MoveTo` serveur — refusé sur un personnage
-- contrôlé, log saturé. Le moteur ne laisse pas le script déplacer un joueur.
-- La doc OFFICIELLE expose `Input.InputKey(key, event, amount)` : force un
-- événement de touche sur le Player Controller LOCAL. On force donc la touche
-- de marche avant : l'axe interne du moteur fait avancer, comme une vraie
-- frappe — mais AUCUN callback script n'est déclenché (bypass), donc pas de
-- boucle avec nos Bind. Les touches réelles viennent de `GetMappedKeys`
-- (AZERTY : Z ; QWERTY : W — jamais codées en dur).
-- L'état du réglage vit dans Paramètres → Jouabilité ; la commande le BASCULE
-- et le serveur répond par la vue (Narvos:Jouabilite), qui resynchronise tout.
local auto_marche_actif = false

local function AutoMarcheDemarrer()
    local ok, touches = pcall(function() return Input.GetMappedKeys("MoveForward") end)
    if (not ok or type(touches) ~= "table") then return end
    for _, touche in ipairs(touches) do
        pcall(function() Input.InputKey(touche, InputEvent.Pressed, 1) end)
    end
end

local function AutoMarcheArreter()
    local ok, touches = pcall(function() return Input.GetMappedKeys("MoveForward") end)
    if (ok and type(touches) == "table") then
        for _, touche in ipairs(touches) do
            pcall(function() Input.InputKey(touche, InputEvent.Released, 0) end)
        end
    end
end

-- Toute frappe PHYSIQUE réelle d'une touche de déplacement arrête l'auto-marche :
-- le joueur reprend la main. `InputKey` ne déclenche AUCUN event script, donc
-- ceci n'entend que les vraies frappes — jamais notre propre forçage.
local function EstToucheDeplacement(nom)
    if (type(nom) ~= "string") then return false end
    for _, action in ipairs({ "MoveForward", "MoveBackward", "MoveLeft", "MoveRight", "MoveJump" }) do
        local ok, touches = pcall(function() return Input.GetMappedKeys(action) end)
        if (ok and type(touches) == "table") then
            for _, t in ipairs(touches) do
                if (t == nom) then return true end
            end
        end
    end
    return false
end

pcall(function()
    Input.Subscribe("KeyDown", function(nom)
        if (auto_marche_actif and EstToucheDeplacement(nom)) then AutoMarcheArreter() end
    end)
end)

ACTIONS.auto_marche = function()
    auto_marche_actif = not auto_marche_actif
    Events.CallRemote("Narvos:DefinirJouabilite", Reliability.Reliable, "auto_marche", auto_marche_actif)
    if (not auto_marche_actif) then AutoMarcheArreter() end
end

-- ⚠ Le réglage ne DÉMARRE pas la marche : il l'AUTORISE. C'est le relâchement
-- de la touche avant réelle qui la déclenche (Bind natif ci-dessous) — sinon
-- cocher la case ferait partir le personnage pendant qu'on règle le menu.
pcall(function()
    Input.Bind("MoveForward", InputEvent.Released, function()
        if (auto_marche_actif) then AutoMarcheDemarrer() end
    end)
end)

-- ── AZERTY / QWERTY (2026-09-19) ──────────────────────────────────────────────
-- La liste fixe `Commandes.RESERVEES` (W A S D) est QWERTY. nanos lie le
-- déplacement selon la disposition RÉELLE du clavier : sur un AZERTY français,
-- c'est Z Q S D. Le client lit les liaisons natives du moteur sur SA machine et
-- les rapporte au serveur, qui refuse ensuite ces touches à l'assignation —
-- un joueur AZERTY ne peut plus réassigner Z et perdre sa marche avant.
local INVERSE_NOM_MOTEUR = {}
for affiche, moteur in pairs(NOM_MOTEUR) do INVERSE_NOM_MOTEUR[moteur] = affiche end
local NATIFS_DEPLACEMENT = {
    MoveForward = true, MoveBackward = true, MoveLeft = true, MoveRight = true,
    MoveJump = true, Sprint = true, Crouch = true,
}

local function SignalerTouchesReservees()
    local ok, liaisons = pcall(function() return Input.GetGameKeyBindings() end)
    if (not ok or type(liaisons) ~= "table") then return end

    local reservees = {}
    for action, touches in pairs(liaisons) do
        if (NATIFS_DEPLACEMENT[action]) then
            local liste = (type(touches) == "table") and touches or { touches }
            for _, t in ipairs(liste) do
                if (type(t) == "string" and t ~= "") then
                    reservees[#reservees + 1] = INVERSE_NOM_MOTEUR[t] or t
                end
            end
        end
    end
    Events.CallRemote("Narvos:TouchesReservees", Reliability.Reliable, reservees)
end

-- ⚠ PAS AU CHARGEMENT (2026-09-19). Appelée ici, la frappe partait AVANT que le
-- serveur connaisse le joueur : « Player not found for Remote Event
-- 'Narvos:TouchesReservees'. Maybe it was called too early by the Client? ».
-- On l'envoie quand la SESSION est prouvée : à la première réception des
-- commandes (le serveur ne pousse qu'une session ouverte), puis à chaque
-- ouverture de l'écran — la disposition ne change pas en partie, mais un
-- changement de fenêtre/clavier entre deux parties est ainsi rattrapé.
local touches_reservees_envoyees = false
local function SignalerTouchesReserveesDesQuePret()
    if (not touches_reservees_envoyees) then
        touches_reservees_envoyees = true
        SignalerTouchesReservees()
    end
end

ACTIONS.vue = function() VueSuivante() end

-- ── Gizmo : ajuster un prop deja pose ─────────────────────────────────────────
--
-- Le module vit dans son propre fichier : `Gizmo` est d'autorite CLIENT, il a
-- son etat (selection, mode, cadence d'envoi) et il n'a rien a voir avec le
-- reste de ce fichier, deja long.
--
-- ⚠ REQUIS ICI ET PAS EN TETE. Il s'abonne a `Narvos:PropsListe` au chargement ;
-- pose plus haut, il serait charge avant que le repartiteur existe, et ses
-- gestionnaires ne seraient jamais atteignables depuis ACTIONS.
local Gizmos = Package.Require("Client/Gizmo.lua")
ACTIONS.gizmo_prise     = function() Gizmos.Prise() end
ACTIONS.gizmo_precedent = function() Gizmos.Precedent() end
ACTIONS.gizmo_suivant   = function() Gizmos.Suivant() end
ACTIONS.gizmo_mode      = function() Gizmos.Mode() end

-- Le MODE édition : il libère la souris, laisse tirer les poignées au curseur,
-- et sauvegarde en sortant. Requis APRÈS `Gizmo.lua` — il l'utilise, et
-- `Package.Require` rend la même table aux deux, donc l'ordre suffit.
local Edition = Package.Require("Client/Edition.lua")
ACTIONS.edition_bascule = function() Edition.Basculer() end

-- Détection d'obstacle pour l'escalade (Trace est une API client : la mesure
-- se fait ici, l'exécution sur le serveur). Requis AVANT les ACTIONS de combat
-- qui l'utilisent (portée des local dans les callbacks).
local TraverseeClient = Package.Require("Client/Traversee.lua")

-- ── Corps-a-corps ─────────────────────────────────────────────────────────────
--
-- ⚠ LE CONTRE PART DIRECTEMENT, SANS PASSER PAR UN MENU NI UNE VERIFICATION
-- LOCALE. La fenetre fait 320 ms ; un aller-retour vers l'interface la mangerait.
-- C'est le serveur qui juge si elle est ouverte — le client ne fait qu'annoncer
-- l'intention, et un contre hors fenetre revient en `Narvos:ContreRate`.
--
-- ⚠ `Reliability.Reliable` en 2e argument, obligatoire client -> serveur.
-- L'omettre ne leve rien : le premier argument utile est pris pour la fiabilite,
-- la charge utile se perd, et le serveur ne voit jamais l'appel.
ACTIONS.melee_contrer = function()
    Events.CallRemote("Narvos:Contrer", Reliability.Reliable, direction_annoncee)
end

ACTIONS.melee_ranger = function()
    Events.CallRemote("Narvos:RangerMelee", Reliability.Reliable)
end

-- Mains nues (Server/Frappes.lua). Le client n'envoie que le GESTE : le serveur
-- verifie mains vides, vehicule, menottes, recuperation, et choisit le coup.
-- ⚠ Menu ouvert ou roue affichee : rien ne part. Le repartiteur filtre deja le
-- curseur libre pour les boutons de souris ; G et K, eux, sont des touches.
local function Frapper(entree)
    if (panneau or menu_emotes_ouvert or roue_ouverte) then return end
    Events.CallRemote("Narvos:Frapper", Reliability.Reliable, entree)
end
ACTIONS.frappe_principale = function() Frapper("principale") end
ACTIONS.frappe_secondaire = function() Frapper("secondaire") end
ACTIONS.coup_pied_droit   = function() Frapper("pied_droit") end
ACTIONS.coup_pied_gauche  = function() Frapper("pied_gauche") end

-- Esquive (Server/Dash.lua). Même garde que les coups : menu ou roue ouverts,
-- rien ne part. Le client n'annonce que l'INTENTION : la direction est décidée
-- par le serveur (vitesse actuelle du personnage, retraite en arrière sinon).
ACTIONS.esquive = function()
    if (panneau or menu_emotes_ouvert or roue_ouverte) then return end
    Events.CallRemote("Narvos:Esquiver", Reliability.Reliable)
end

-- Escalade (Client/Traversee.lua + Server/Traversee.lua). La DÉTECTION se fait
-- ici (Trace est une API client) : le client mesure l'obstacle et envoie les
-- chiffres ; le serveur classe (vault/mantle/grimper), anime et déplace.
ACTIONS.escalade = function()
    if (panneau or menu_emotes_ouvert or roue_ouverte) then return end
    local payload = TraverseeClient.Detection()
    if (payload) then
        Events.CallRemote("Narvos:Escalader", Reliability.Reliable, payload)
    end
end

-- ── Double appui sur Saut face à un mur ───────────────────────────────────────
-- Même logique que le Game Animation Sample : le PREMIER appui sur Espace reste
-- un saut natif ; un DEUXIÈME appui dans la fenêtre (350 ms), face à un mur
-- escaladable, déclenche le saut vers le mur et l'escalade — même chemin serveur
-- que SOURIS_5 (détection client, décision et déplacement serveur).
local dernier_saut_ms = 0

local function EstToucheSaut(nom)
    if (type(nom) ~= "string") then return false end
    local ok, touches = pcall(function() return Input.GetMappedKeys("MoveJump") end)
    if (not ok or type(touches) ~= "table") then return false end
    for _, t in ipairs(touches) do
        if (t == nom) then return true end
    end
    return false
end

pcall(function()
    Input.Subscribe("KeyDown", function(nom)
        if (not EstToucheSaut(nom)) then return end
        if (panneau or menu_emotes_ouvert or roue_ouverte) then return end
        local maintenant = Client.GetTime()
        if (maintenant - dernier_saut_ms <= 350) then
            dernier_saut_ms = 0  -- le double appui est consommé
            local payload = TraverseeClient.Detection()
            if (payload) then
                Events.CallRemote("Narvos:Escalader", Reliability.Reliable, payload)
            end
        else
            dernier_saut_ms = maintenant
        end
    end)
end)

-- Les pouvoirs partent meme si le HUD est ouvert : on se defend en consultant
-- son inventaire. Ce serait different pour un menu MODAL, mais aucun ne l'est
-- hormis l'ecran de creation, deja filtre par le repartiteur.
--- Position du canon de l'arme tenue (socket `muzzle`), ou nil à mains nues.
--- Le serveur n'a pas de squelette (`GetSocketTransform` est CLIENT) : c'est
--- d'ici qu'un sort lancé arme en main sait d'où partir. Le serveur ne garde la
--- position que si elle est à moins de 2 m du corps (Server/Sorts.lua).
local function CanonArme()
    local joueur = Client.GetLocalPlayer()
    local perso = joueur and joueur:GetControlledCharacter()
    local arme = perso and perso:GetPicked()
    if (not arme or not arme:IsValid()) then return nil end
    local ok, t = pcall(function() return arme:GetSocketTransform("muzzle") end)
    if (ok and type(t) == "table" and t.Location) then return t.Location end
    return nil
end

for emplacement = 1, 4 do
    ACTIONS["sort_" .. emplacement] = function()
        Events.CallRemote("Narvos:LancerSort", Reliability.Reliable, emplacement, CanonArme())
    end
end

-- Construction. `prop_pivoter` ne parle pas au serveur : l'angle est un etat
-- CLIENT que le menu envoie avec la pose. Un aller-retour reseau par cran de
-- rotation serait absurde.
local angle_prop = 0

ACTIONS.prop_poser = function()
    if (not HUD) then return end
    -- Le prop a poser est celui que le menu a selectionne : c'est lui qui le
    -- sait, pas ce fichier. On le lui demande plutot que d'en tenir une copie
    -- qui pourrait diverger.
    HUD:CallEvent("NarvosProps:PoserSelection", angle_prop)
end

ACTIONS.prop_pivoter = function()
    angle_prop = (angle_prop + 45) % 360
    if (HUD) then HUD:CallEvent("NarvosProps:Angle", angle_prop) end
end

ACTIONS.prop_retirer = function()
    Events.CallRemote("Narvos:RetirerProp", Reliability.Reliable)
end

-- ── Serveur -> touches ────────────────────────────────────────────────────────

--- Reconstruit la table TOUCHE -> action a chaque envoi du serveur.
---
--- ⚠ ON REMPLACE, on ne fusionne pas. Fusionner laisserait vivre l'ancienne
--- touche d'une action qu'on vient de deplacer : deux touches pour une action,
--- dont une que plus aucun ecran n'affiche.
Events.SubscribeRemote("Narvos:Commandes", function(donnees)
    -- La session est PROUVÉE (le serveur ne pousse les touches qu'à une session
    -- ouverte) : premier moment sûr pour rapporter les touches de déplacement
    -- natives du clavier (AZERTY/QWERTY).
    SignalerTouchesReserveesDesQuePret()
    local table_touches, inverse = {}, {}
    for _, a in ipairs((donnees and donnees.actions) or {}) do
        -- Une touche VIDE est normale : c'est une commande a qui une autre a
        -- repris sa touche. Elle reste sans liaison jusqu'a ce que le joueur
        -- lui en donne une.
        if (a.touche and a.touche ~= "") then
            table_touches[a.touche] = a.id
            inverse[a.id] = a.touche
        end
    end
    commandes_par_touche = table_touches
    touches_par_action = inverse

    if (HUD) then HUD:CallEvent("NarvosCommandes", donnees) end
end)

Events.SubscribeRemote("Narvos:CommandeErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosMessage", raison, "erreur") end
end)

Events.SubscribeRemote("Narvos:CommandeInfo", function(texte)
    if (HUD) then HUD:CallEvent("NarvosMessage", texte, "info") end
end)

-- ── Serveur -> jouabilité (2026-09-19) ────────────────────────────────────────
-- Le serveur renvoie registre + valeurs après chaque changement. On synchronise
-- l'auto-marche local : l'état est UN, qu'il vienne du menu ou de la touche F2.
Events.SubscribeRemote("Narvos:Jouabilite", function(donnees)
    local parametres = (type(donnees) == "table") and donnees.parametres
    if (type(parametres) == "table") then
        for _, p in ipairs(parametres) do
            if (p.id == "auto_marche") then
                auto_marche_actif = p.valeur == true
                if (not auto_marche_actif) then AutoMarcheArreter(true) end
            end
        end
    end
    if (HUD) then HUD:CallEvent("NarvosJouabilite", donnees) end
end)

Events.SubscribeRemote("Narvos:JouabiliteErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosMessage", raison, "erreur") end
end)

-- ── Serveur -> fouille (2026-09-19) ───────────────────────────────────────────
Events.SubscribeRemote("Narvos:Fouille", function(vue)
    if (panneau ~= "fouille") then Basculer("fouille") end
    if (HUD) then HUD:CallEvent("NarvosFouille", vue) end
end)

Events.SubscribeRemote("Narvos:FouilleErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosMessage", raison, "erreur") end
end)

-- ── Serveur -> menu d'animations ──────────────────────────────────────────────

local dernieres_emotes = nil

Page("emotes", "NarvosEmotes:Pret", function()
    if (Emotes and dernieres_emotes) then
        Emotes:CallEvent("NarvosEmotes:Donnees", dernieres_emotes)
    end
end)

Events.SubscribeRemote("Narvos:Emotes", function(donnees)
    dernieres_emotes = donnees
    -- La table des raccourcis est la SEULE source pour les touches : on la
    -- remplace en entier plutôt que de la fusionner, sinon un raccourci retiré
    -- côté serveur continuerait de fonctionner ici.
    raccourcis = (donnees and donnees.raccourcis) or {}

    if (Emotes) then Emotes:CallEvent("NarvosEmotes:Donnees", donnees) end
end)

Events.SubscribeRemote("Narvos:EmoteErreur", function(raison)
    if (Emotes) then Emotes:CallEvent("NarvosEmotes:Erreur", raison) end
end)

-- Le serveur a arrêté une emote en boucle parce que le personnage marchait
-- (Server/Emotes.lua, SurveillerDeplacements). Sans cette remise à zéro, la
-- touche de l'emote enverrait « arrêter » au prochain appui au lieu de la rejouer.
Events.SubscribeRemote("Narvos:EmoteArretee", function()
    emote_en_cours = nil
end)

-- ── Menu -> serveur ───────────────────────────────────────────────────────────

Page("emotes", "NarvosEmotes:Jouer", function(id, boucler)
    emote_en_cours = id
    Events.CallRemote("Narvos:JouerEmote", Reliability.Reliable, id, boucler)
end)

Page("emotes", "NarvosEmotes:Arreter", function()
    emote_en_cours = nil
    Events.CallRemote("Narvos:ArreterEmote", Reliability.Reliable)
end)

Page("emotes", "NarvosEmotes:Assigner", function(touche, id)
    Events.CallRemote("Narvos:DefinirRaccourci", Reliability.Reliable, touche, id)
end)

Page("emotes", "NarvosEmotes:Liberer", function(touche)
    Events.CallRemote("Narvos:RetirerRaccourci", Reliability.Reliable, touche)
end)

Page("emotes", "NarvosEmotes:Fermer", FermerMenuEmotes)

-- Un package rechargé à chaud laisserait le menu orphelin, souris capturée.
Package.Subscribe("Unload", function()
    if (Emotes) then
        FermerMenuEmotes()
        Emotes:Destroy()
        Emotes = nil
    end
end)

-- ═══════════════════════════════════════════════════════════════════════════════
-- PROPS, INVOCATIONS, POUVOIRS — le pont entre le serveur et les panneaux du HUD
--
-- Ce bloc ne DÉCIDE rien : il relaie. Le serveur pousse un état, on le passe à la
-- page ; la page émet une intention, on la passe au serveur. Toute la validation
-- est côté serveur, où le client ne peut pas la contourner.
--
-- ⚠ `Reliability.Reliable` est OBLIGATOIRE en 2ᵉ argument de `CallRemote` dans le
-- sens client -> serveur. L'omettre ne lève RIEN : le premier argument utile est
-- pris pour la fiabilité, la charge utile se perd, et le serveur ne voit jamais
-- l'appel. Cinq relais avaient été muets pour cette raison le 2026-09-03.
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Serveur -> page ───────────────────────────────────────────────────────────

Events.SubscribeRemote("Narvos:Props", function(donnees)
    if (HUD) then HUD:CallEvent("NarvosProps", donnees) end
end)

Events.SubscribeRemote("Narvos:PropPose", function(poses, plafond)
    if (HUD) then HUD:CallEvent("NarvosPropCompte", poses, plafond) end
end)

Events.SubscribeRemote("Narvos:PropErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosMessage", raison, "erreur") end
end)

Events.SubscribeRemote("Narvos:PropInfo", function(texte)
    if (HUD) then HUD:CallEvent("NarvosMessage", texte, "info") end
end)

-- ── Retours du corps-a-corps ──────────────────────────────────────────────────

--- Un coup arrive, et d'ou. C'est ce qui rend la fenetre de contre JOUABLE :
--- sans repere visuel, parer revient a appuyer au hasard.
Events.SubscribeRemote("Narvos:CoupAnnonce", function(direction, fenetre_ms)
    direction_annoncee = direction
    if (HUD) then HUD:CallEvent("NarvosCoupAnnonce", direction, fenetre_ms) end
    -- On oublie la direction a la fermeture de la fenetre : la garder ferait
    -- parer vers un coup deja encaisse.
    Timer.SetTimeout(function() direction_annoncee = nil end, tonumber(fenetre_ms) or 320)
end)

Events.SubscribeRemote("Narvos:Contre", function(cle, multiplicateur)
    if (HUD) then HUD:CallEvent("NarvosContre", cle, multiplicateur) end
end)

Events.SubscribeRemote("Narvos:ContreRate", function(raison)
    if (HUD) then HUD:CallEvent("NarvosMessage", raison, "erreur") end
end)

Events.SubscribeRemote("Narvos:Coup", function(etape, degats, critique)
    if (HUD) then HUD:CallEvent("NarvosCoup", etape, degats, critique) end
end)

Events.SubscribeRemote("Narvos:ArmeMelee", function(_id, label)
    if (HUD) then HUD:CallEvent("NarvosMessage", "Arme : " .. tostring(label), "info") end
end)

-- Frapper hors fenetre n'est PAS une erreur : c'est l'enchainement qui repart
-- de zero. Sans ce retour, le joueur voit son combo tomber sans savoir pourquoi
-- et croit a un coup perdu.
Events.SubscribeRemote("Narvos:CoupRefuse", function(raison)
    if (HUD) then HUD:CallEvent("NarvosCoupRefuse", raison) end
end)

Events.SubscribeRemote("Narvos:Spawnables", function(donnees)
    if (HUD) then HUD:CallEvent("NarvosSpawnables", donnees) end
end)

Events.SubscribeRemote("Narvos:SpawnFait", function(invoques, plafond)
    if (HUD) then HUD:CallEvent("NarvosSpawnCompte", invoques, plafond) end
end)

Events.SubscribeRemote("Narvos:SpawnErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosMessage", raison, "erreur") end
end)

Events.SubscribeRemote("Narvos:SpawnInfo", function(texte)
    if (HUD) then HUD:CallEvent("NarvosMessage", texte, "info") end
end)

Events.SubscribeRemote("Narvos:Sorts", function(donnees)
    -- La barre affichait le NUMERO d'emplacement : un joueur qui a deplace ses
    -- pouvoirs sur A/E/R lisait « 1 2 3 4 ». Le client seul connait les touches.
    if (type(donnees) == "table" and type(donnees.barre) == "table") then
        for _, s in ipairs(donnees.barre) do
            if (type(s) == "table" and s.emplacement) then
                s.touche = touches_par_action["sort_" .. tostring(s.emplacement)] or ""
            end
        end
    end
    if (HUD) then HUD:CallEvent("NarvosSorts", donnees) end
end)

Events.SubscribeRemote("Narvos:SortErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosMessage", raison, "erreur") end
end)

-- ── Page -> serveur ───────────────────────────────────────────────────────────

-- ── Garde-robe ────────────────────────────────────────────────────────────────
--
-- ⚠ `Page(...)` ET NON `Events.Subscribe(...)`. Les evenements emis par une
-- WebUI n'arrivent QUE par la methode d'instance `ui:Subscribe`. Vingt-cinq
-- abonnements du package etaient sur la mauvaise API et ne recevaient rien : le
-- code se chargeait, se lisait bien, et le clic ne faisait simplement rien.
--
-- Le client ne fait que RELAYER : il n'ouvre aucun stock, ne calcule aucun prix
-- et ne connait pas la bourse du joueur. Tout cela vit dans la session serveur.

-- ── Apparence (onglet de l'inventaire) — Server/Vestiaire.lua ───────────────────
-- La page n'émet que l'apparence en JSON : le pont WebUI -> Lua ne porte pas les
-- objets (Server/Session.lua, `Decoder`). Le serveur normalise tout.
Page("hud", "NarvosApparence:Ouvrir", function()
    CadrerApparence(true)
    Events.CallRemote("Narvos:Apparence:Ouvrir", Reliability.Reliable)
end)

Page("hud", "NarvosApparence:Quitter", function()
    CadrerApparence(false)
end)

Page("hud", "NarvosApparence:Changer", function(texte)
    if (type(texte) ~= "string") then return end
    Events.CallRemote("Narvos:Apparence:Changer", Reliability.Reliable, texte)
end)

Page("hud", "NarvosApparence:GardeRobe", function()
    CadrerApparence(false)
    Basculer("garde-robe")
end)

Events.SubscribeRemote("Narvos:Apparence", function(donnees)
    if (HUD and type(donnees) == "table") then HUD:CallEvent("NarvosApparence", donnees) end
end)

Page("hud", "NarvosVestiaire:Ouvrir", function()
    Events.CallRemote("Narvos:Vestiaire:Ouvrir", Reliability.Reliable)
end)

Page("hud", "NarvosVestiaire:Acheter", function(piece_id)
    Events.CallRemote("Narvos:Vestiaire:Acheter", Reliability.Reliable, piece_id)
end)

Page("hud", "NarvosVestiaire:Porter", function(slot, piece_id)
    -- `piece_id` arrive en chaine vide quand la page veut vider le slot : le
    -- pont WebUI ne porte pas nil. Le serveur fait la traduction inverse.
    Events.CallRemote("Narvos:Vestiaire:Porter", Reliability.Reliable, slot, piece_id or "")
end)

Events.SubscribeRemote("Narvos:Vestiaire:Etat", function(donnees)
    if (HUD) then HUD:CallEvent("NarvosVestiaire", donnees) end
end)

Page("hud", "NarvosProps:Poser", function(id, angle)
    Events.CallRemote("Narvos:PoserProp", Reliability.Reliable, id, angle)
end)

Page("hud", "NarvosProps:Vider", function()
    Events.CallRemote("Narvos:ViderProps", Reliability.Reliable)
end)

Page("hud", "NarvosSpawn:Invoquer", function(id, niveau)
    Events.CallRemote("Narvos:Invoquer", Reliability.Reliable, id, niveau)
end)

Page("hud", "NarvosSpawn:Enregistrer", function()
    Events.CallRemote("Narvos:EnregistrerPeuplement", Reliability.Reliable)
end)

Page("hud", "NarvosSpawn:Retirer", function()
    Events.CallRemote("Narvos:RetirerInvocation", Reliability.Reliable)
end)

Page("hud", "NarvosSpawn:Vider", function()
    Events.CallRemote("Narvos:ViderInvocations", Reliability.Reliable)
end)

-- ── Menu de test des armes (O) ────────────────────────────────────────────────
Events.SubscribeRemote("Narvos:Armes", function(donnees)
    if (HUD) then HUD:CallEvent("NarvosArmes", donnees) end
end)
Events.SubscribeRemote("Narvos:ArmeErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosMessage", raison, "erreur") end
end)
Events.SubscribeRemote("Narvos:ArmeInfo", function(texte)
    if (HUD) then HUD:CallEvent("NarvosMessage", texte, "info") end
end)
Page("hud", "NarvosArmes:Donner", function(id)
    Events.CallRemote("Narvos:DonnerArme", Reliability.Reliable, id)
end)
Page("hud", "NarvosArmes:Lacher", function()
    Events.CallRemote("Narvos:LacherArme", Reliability.Reliable)
end)

-- ── Metiers ───────────────────────────────────────────────────────────────────
-- `Narvos:Metiers` : l'etat complet, a l'ouverture de la fiche.
-- `Narvos:Metier`  : un gain, a chaque recolte ou fabrication — il met a jour
-- une seule ligne sans redemander toute la liste.
Events.SubscribeRemote("Narvos:Metiers", function(donnees)
    if (HUD) then HUD:CallEvent("NarvosMetiers", donnees) end
end)
Events.SubscribeRemote("Narvos:Metier", function(gain)
    if (HUD) then HUD:CallEvent("NarvosMetier", gain) end
end)

-- ── Progression : niveau, XP, pouvoirs, talents ───────────────────────────────
-- `Narvos:Progression` : la vue complete (ouverture de la fiche, passage de
-- niveau, geste sur l'arbre). Le client y ajoute les TOUCHES reelles des quatre
-- pouvoirs : lui seul les connait (`touches_par_action`, rebinding compris), et
-- la page afficherait sinon « 1 2 3 4 » a un joueur qui les a deplacees.
Events.SubscribeRemote("Narvos:Progression", function(vue)
    if (not HUD or type(vue) ~= "table") then return end
    for _, c in ipairs(vue.competences or {}) do
        c.touche = touches_par_action["sort_" .. tostring(c.emplacement)] or ""
    end
    vue.touche_menu = touches_par_action.menu_competences or ""
    HUD:CallEvent("NarvosProgression", vue)
end)
-- Un gain d'XP : la barre du HUD et un message court ; la vue complete suit
-- seulement au passage de niveau.
Events.SubscribeRemote("Narvos:XP", function(gain)
    if (HUD) then HUD:CallEvent("NarvosXP", gain) end
end)
Events.SubscribeRemote("Narvos:ProgressionErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosMessage", tostring(raison or ""), "erreur") end
end)
Page("hud", "NarvosProgression:Investir", function(talent_id)
    Events.CallRemote("Narvos:InvestirTalent", Reliability.Reliable, talent_id)
end)
Page("hud", "NarvosProgression:Rembourser", function(talent_id)
    Events.CallRemote("Narvos:RembourserTalent", Reliability.Reliable, talent_id)
end)
Page("hud", "NarvosProgression:Reinitialiser", function()
    Events.CallRemote("Narvos:ReinitialiserTalents", Reliability.Reliable)
end)

-- ── Mort et réapparition (2026-09-15) ─────────────────────────────────────────
-- Le serveur annonce la mort (table : cité de retour, délai) puis le retour
-- (`false`). La page affiche le panneau ; son bouton suit le même chemin que
-- `/revive` (Server/Reapparition.lua). La souris est libérée tant qu'on est mort,
-- sinon le bouton serait inatteignable ; elle est rendue au jeu au retour si
-- aucun panneau n'est ouvert.
Events.SubscribeRemote("Narvos:Mort", function(donnees)
    if (not HUD) then return end
    if (type(donnees) == "table") then
        HUD:CallEvent("NarvosMort", donnees)
        Input.SetMouseEnabled(true)
    else
        HUD:CallEvent("NarvosMort", false)
        if (not panneau) then Input.SetMouseEnabled(false) end
        -- Le retour s'entend : sans lui, l'automatique ressemble à un saut d'image.
        pcall(function()
            Sound(Vector(), "nanos-world::A_VR_Teleport", true, true, SoundType.SFX, 0.8, 1.0)
        end)
    end
end)
Page("hud", "NarvosMort:Reapparaitre", function()
    Events.CallRemote("Narvos:Revive", Reliability.Reliable)
end)

-- ── Menu des vehicules ────────────────────────────────────────────────────────
-- La page AFFICHE, le serveur DECIDE : elle n'emet qu'un identifiant, et la
-- garde `PeutTester` vit cote serveur — la meme que pour `/vehicule`.
Events.SubscribeRemote("Narvos:Vehicules", function(donnees)
    if (HUD) then HUD:CallEvent("NarvosVehicules", donnees) end
end)
Page("hud", "NarvosVehicules:Demander", function()
    Events.CallRemote("Narvos:DemanderVehicules", Reliability.Reliable)
end)
Page("hud", "NarvosVehicules:Spawner", function(id)
    -- Le serveur installe le joueur AU VOLANT : le menu se ferme donc tout de
    -- suite, sinon la souris reste liberee et le chat masque pendant qu'on
    -- essaie de rouler (retour de jeu du 13/09 19h, huit essais « au volant »).
    if (panneau == "vehicules") then Basculer("vehicules") end
    Events.CallRemote("Narvos:SpawnerVehicule", Reliability.Reliable, id)
end)

Page("hud", "NarvosCommandes:Definir", function(action_id, touche)
    -- La page a capte un bouton de souris : l'ecoute est terminee, la frappe
    -- suivante redevient un geste.
    capture_commande = nil
    Events.CallRemote("Narvos:DefinirCommande", Reliability.Reliable, action_id, touche)
end)

-- La page SIGNALE qu'elle attend une touche ; la frappe est capturee par
-- `Input.Subscribe("KeyPress")` (voir `capture_commande`, en tete de fichier).
Page("hud", "NarvosCommandes:Ecouter", function(action_id)
    capture_commande = (type(action_id) == "string" and action_id ~= "") and action_id or nil
end)

Page("hud", "NarvosCommandes:Reinitialiser", function(action_id)
    Events.CallRemote("Narvos:ReinitialiserCommande", Reliability.Reliable, action_id or "")
end)

-- ⚠ Emis par `ateliers.js` via son helper `Lua(...)` : le garde ui-liens ne
-- cherchait que `Events.Call("` litteral, et ces deux-la n'avaient AUCUN relais.
-- Le clic sur une recette et le bouton « Recolter » partaient dans le vide
-- (audit du 2026-09-11). Le serveur ecoute en reseau : il faut relayer.
Page("hud", "Narvos:Crafter", function(station, recetteId)
    Events.CallRemote("Narvos:Crafter", Reliability.Reliable, station, recetteId)
end)
Page("hud", "Narvos:Recolter", function(gisementId)
    Events.CallRemote("Narvos:Recolter", Reliability.Reliable, gisementId)
end)

Page("hud", "NarvosSorts:Lancer", function(emplacement)
    Events.CallRemote("Narvos:LancerSort", Reliability.Reliable, emplacement, CanonArme())
end)

-- Le HUD réclame ses touches dès qu'il est prêt. Sans ça, un joueur qui se
-- connecte pendant que le serveur démarre garderait `commandes_par_touche` vide
-- et AUCUNE touche ne répondrait — sans erreur, ce qui est le pire des échecs.
-- ── Interface : disposition du HUD et boussole (demande B1) ───────────────────
--
-- La disposition est celle de CET écran : persistée côté client
-- (`Package.SetPersistentData("interface")`, comme les graphismes), normalisée
-- par Logic/Disposition.lua à la lecture ET à chaque geste — un fichier retouché
-- à la main ne peut pas pousser un élément hors de l'écran.
local Disposition = Narvos.Disposition
local disposition_hud = Disposition and Disposition.Normaliser(Package.GetPersistentData("interface")) or nil

local function EnvoyerDisposition()
    if (not HUD or not Disposition) then return end
    HUD:CallEvent("NarvosInterface:Etat", {
        disposition = disposition_hud,
        zones = Disposition.ZONES,
        options = Disposition.OPTIONS,
    })
end

local function SauverDisposition(nouvelle)
    if (type(nouvelle) ~= "table") then return end
    disposition_hud = nouvelle
    pcall(function() Package.SetPersistentData("interface", disposition_hud) end)
    EnvoyerDisposition()
end

Page("hud", "Narvos:UIInterfacePanneau", function()
    Basculer("interface")
end)

Page("hud", "NarvosInterface:Placer", function(zone, x, y)
    if (not Disposition) then return end
    SauverDisposition((Disposition.Placer(disposition_hud, zone, x, y)))
end)

Page("hud", "NarvosInterface:Option", function(id, valeur)
    if (not Disposition) then return end
    SauverDisposition((Disposition.Regler(disposition_hud, id, valeur)))
end)

Page("hud", "NarvosInterface:Defaut", function()
    if (not Disposition) then return end
    SauverDisposition(Disposition.Defaut())
end)

-- Boussole : le cap de la CAMÉRA (là où le joueur regarde), envoyé seulement
-- quand il bouge d'au moins un degré — pas un message par trame.
local dernier_cap = nil
Timer.SetInterval(function()
    if (not HUD or not Disposition) then return end
    if (disposition_hud and disposition_hud.options.boussole == false) then return end
    local joueur = Client.GetLocalPlayer()
    if (not joueur) then return end
    local ok, rotation = pcall(function() return joueur:GetCameraRotation() end)
    if (not ok or not rotation) then return end
    local cap = Disposition.Cap(rotation.Yaw)
    if (not cap) then return end
    if (dernier_cap and math.abs(((cap - dernier_cap + 540) % 360) - 180) < 1) then return end
    dernier_cap = cap
    HUD:CallEvent("NarvosBoussole", cap, Disposition.Cardinal(cap))
end, 80)

-- Mini-carte du HUD : tant qu'elle est affichée, le radar est redemandé chaque
-- seconde (le panneau Radar et la minimap Ako le font déjà de leur côté).
Timer.SetInterval(function()
    if (HUD and disposition_hud and disposition_hud.options.carte == true and not CreationOuverte()) then
        Events.CallRemote("Narvos:DemanderRadar", Reliability.Reliable)
    end
end, 1000)

Page("hud", "NarvosHud:Pret", function()
    -- La disposition d'abord : le HUD se met en place avant les données.
    EnvoyerDisposition()
    Events.CallRemote("Narvos:DemanderCommandes", Reliability.Reliable)
    Events.CallRemote("Narvos:DemanderSorts", Reliability.Reliable)
    -- nanos ne rend qu'un NUMERO de dimension : seul le serveur sait a quel
    -- monde il correspond. On le demande a la reconnexion, sinon le HUD
    -- annoncerait la Forge a un joueur reste en orbite.
    Events.CallRemote("Narvos:DemanderMonde", Reliability.Reliable)
end)

-- ── Voyage entre les mondes ───────────────────────────────────────────────────

-- Le ciel du monde. Requis ICI et non en tete de fichier : ce module appelle
-- `Sky`, qui n'existe que cote client, et c'est le seul endroit qui s'en sert.
local Ciel = Package.Require("Client/Ciel.lua")

-- Les bruits de pas. `Sound` est d'autorite CLIENT : ce module ne peut vivre
-- que de ce cote. Il pose sa propre horloge et n'expose que le diagnostic.
local PasClient = Package.Require("Client/Pas.lua")

-- La minimap Ako (widget UMG natif). Elle s'abonne elle-même à `Narvos:Radar` et
-- `Narvos:Voyage`, à côté des gestionnaires de ce fichier, et ne pose RIEN tant
-- que `Narvos.Minimap.PRETE` est faux : le radar WebUI (H) reste alors la carte.
local MinimapClient = Package.Require("Client/Minimap.lua")

-- `/pas` : dit a voix haute quelle categorie a gagne, et par quel etage. Sans
-- lui, une map sans materiau physique sonne « correctement » sur la mauvaise
-- surface et rien ne le signale.
Console.RegisterCommand("pas", function()
    PasClient.Diagnostic(not PasClient.EnDiagnostic())
end, "Bruits de pas : bascule le diagnostic (categorie retenue par pas)")

-- Le diagnostic des personnages : TAILLE RENDUE, lue dans le moteur. Il
-- mesure seul a l'arrivee dans un monde et ecrit dans le journal client
-- (NanosWorldCore.log) — `/diag` le relance a la demande.
-- `DiagnosticPnj` et non `Diagnostic` : `PasClient.Diagnostic` existe deja
-- six lignes plus haut. Deux choses differentes sous le meme nom, c'est un
-- piege pour le lecteur — et `portee-check` l'a pris pour un emploi avant
-- declaration.
local DiagnosticPnj = Package.Require("Client/Diagnostic.lua")
Console.RegisterCommand("diag", function() DiagnosticPnj.Mesurer("commande") end,
    "Mesure la taille RENDUE des personnages alentour (journal client)")

-- Meta Customization System : applique la valeur synchronisee `narvos_mcs` de
-- chaque Blueprint MetaHuman (apercu de creation comme personnages en jeu).
local MetaCustomClient = Package.Require("Client/MetaCustom.lua")

-- Le personnage VIVANT dans le cadre de l'inventaire (SceneCapture -> JPEG base64).
local ApercuInventaire = Package.Require("Client/ApercuInventaire.lua")

-- Les vignettes 3D des objets de notre pack : le client photographie leur mesh.
-- La page envoie la liste en JSON (le pont WebUI -> Lua ne porte pas les tableaux).
local VignettesObjets = Package.Require("Client/VignettesObjets.lua")
VignettesObjets.Configurer(function(mesh, image)
    if (HUD) then HUD:CallEvent("NarvosVignette", mesh, image) end
end)
Page("hud", "NarvosVignettes:Demander", function(texte)
    if (type(texte) ~= "string" or #texte > 20000) then return end
    local ok, liste = pcall(JSON.parse, texte)
    if (ok and type(liste) == "table") then VignettesObjets.Demander(liste) end
end)
ApercuInventaire.Configurer(function(image)
    if (HUD) then HUD:CallEvent("NarvosInventaireApercu", image) end
end)
Console.RegisterCommand("mcs", function()
    local n = 0
    for _, bp in ipairs(Blueprint.GetAll()) do n = n + MetaCustomClient.Appliquer(bp) end
    Console.Log("[MCS] " .. n .. " appel(s) rejoue(s)")
end, "Rejoue l'apparence du Meta Customization System sur les Blueprints visibles")

-- Le serveur demande la mesure (/diag dans le chat) et recoit le rapport : le
-- resultat atterrit dans le journal SERVEUR, lisible sans ouvrir cette machine.
Events.SubscribeRemote("Narvos:DiagDemande", function()
    local _, lignes = DiagnosticPnj.Mesurer("serveur")
    Events.CallRemote("Narvos:DiagRapport", Reliability.Reliable, lignes or {})
end)

Events.SubscribeRemote("Narvos:Voyage", function(donnees)
    if (not donnees or not donnees.label) then return end

    -- Le ciel AVANT le message : la transition dure quelques secondes, autant
    -- qu'elle commence pendant que le joueur lit le nom du monde.
    if (donnees.monde) then Ciel.Appliquer(donnees.monde) end

    -- L'arrivee doit se VOIR. Un changement de decor sans un mot laisse croire a
    -- un bug d'affichage — surtout quand le monde d'arrivee se charge encore par
    -- lots derriere et n'est pas complet a la seconde ou on y pose le pied.
    if (HUD) then
        HUD:CallEvent("NarvosMonde", donnees.label, donnees.description)
    end
    Console.Log("Monde : " .. tostring(donnees.label))
end)

Events.SubscribeRemote("Narvos:VoyageErreur", function(raison)
    if (HUD) then HUD:CallEvent("NarvosMessage", raison, "erreur") end
end)

-- ══════════════════════════════════════════════════════════════════════════════
-- ORBITE DE L'APERÇU — tourner et zoomer autour du personnage en création
-- ══════════════════════════════════════════════════════════════════════════════
--
-- ── POURQUOI CÔTÉ CLIENT ──────────────────────────────────────────────────────
-- `SetCameraLocation` et `SetCameraRotation` existent des DEUX côtés. Passer par
-- le serveur ferait un aller-retour réseau à chaque cran de molette : la caméra
-- traînerait derrière le geste, et un joueur qui tourne son personnage lirait ça
-- comme une latence du jeu.
--
-- Le serveur pose le cadrage initial UNE fois — le mannequin doit être cadré dès
-- la première image, avant même que ce module ait reçu quoi que ce soit — puis
-- envoie l'ancre. Tout le reste se calcule ici.
--
-- ── ELLE NE S'ACTIVE QUE PENDANT LA CRÉATION ─────────────────────────────────
-- `SetCameraLocation` est ignoré en silence dès que le joueur possède un
-- Character. Les abonnements restent donc inertes en jeu, mais on garde quand
-- même le garde `orbite.active` : sans lui, la molette du jeu déclencherait des
-- calculs pour rien à chaque cran.

local orbite = {
    active = false,
    -- Centre de l'orbite, en coordonnées monde. Envoyé par le serveur : la
    -- position du mannequin dépend du nombre de joueurs en création simultanée.
    x = 0, y = 0, z = 0,
    -- Angle autour du personnage. 180 le met de face : le mannequin est posé en
    -- yaw 180, la caméra doit donc le regarder depuis -X.
    yaw = 180,
    -- Élévation, bornée pour ne jamais passer au-dessus ni sous les pieds.
    pitch = -3,
    distance = 300,
    hauteur = 95,
    -- Bouton du milieu maintenu : c'est lui qui autorise la rotation. Sans ce
    -- garde, bouger la souris pour cliquer un curseur ferait tourner la scène.
    tourne = false,
    -- La souris est-elle sur un PANNEAU de la page (liste, fiche, étapes) ? La
    -- page le dit (`NarvosCreation:Survol`). La molette y fait défiler la liste,
    -- et ne doit PAS éloigner la caméra : 28 cm par cran, jusqu'à 7 m, pendant
    -- qu'on parcourt les vêtements (retour de jeu du 2026-09-14).
    survol_ui = false,
}

--- Bornes de la distance, en centimètres.
--- Trop près, la caméra entre dans la tête ; trop loin, le personnage devient un
--- point et l'écran ne sert plus à rien.
local DIST_MIN, DIST_MAX = 90, 700

--- Degrés par cran de molette et par pixel de souris. Réglés pour qu'un tour
--- complet demande un geste franc, pas trois écrans de déplacement.
local PAS_ZOOM = 28
local SENSIBILITE = 0.45

--- Repose la caméra depuis l'état courant.
---
--- ⚠ TRIGONOMÉTRIE EN RADIANS. `math.cos` et `math.sin` ne prennent pas de
--- degrés, et l'oubli ne lève rien : la caméra se pose simplement à un endroit
--- qui n'a aucun rapport avec l'angle demandé.
local function PoserCamera()
    if (not orbite.active) then return end

    local joueur = Client.GetLocalPlayer()
    if (not joueur) then return end

    local rad = math.rad(orbite.yaw)
    local radPitch = math.rad(orbite.pitch)

    -- Le pitch raccourcit le rayon horizontal et élève la caméra : sans ce
    -- cosinus, regarder d'en haut éloignerait aussi le personnage.
    local plat = orbite.distance * math.cos(radPitch)

    local cx = orbite.x + plat * math.cos(rad)
    local cy = orbite.y + plat * math.sin(rad)
    local cz = orbite.z + orbite.hauteur - orbite.distance * math.sin(radPitch)

    joueur:SetCameraLocation(Vector(cx, cy, cz))
    -- La caméra regarde vers le centre : son yaw est l'opposé de sa position.
    joueur:SetCameraRotation(Rotator(orbite.pitch, orbite.yaw + 180, 0))
end

--- L'ancre arrive du serveur à chaque reconstruction de l'aperçu.
Events.SubscribeRemote("Narvos:ApercuOrbite", function(donnees)
    if (type(donnees) ~= "table") then return end

    orbite.x = tonumber(donnees.x) or orbite.x
    orbite.y = tonumber(donnees.y) or orbite.y
    orbite.z = tonumber(donnees.z) or orbite.z
    orbite.hauteur = tonumber(donnees.hauteur) or orbite.hauteur

    -- ⚠ L'ANGLE ET LA DISTANCE NE SONT PAS REINITIALISES.
    --
    -- L'aperçu est reconstruit à chaque changement de tenue, de corps ou de
    -- curseur de visage. Remettre la caméra de face à chaque fois ramènerait le
    -- joueur au point de départ dès qu'il touche un réglage — précisément quand
    -- il est en train de regarder un détail sous un angle choisi.
    if (not orbite.active) then
        orbite.active = true
        orbite.distance = tonumber(donnees.recul) or orbite.distance
        orbite.pitch = tonumber(donnees.pitch) or orbite.pitch
    end

    PoserCamera()
end)

--- Quitter la création rend la caméra au jeu.
Events.SubscribeRemote("Narvos:Session", function(donnees)
    if (type(donnees) == "table" and donnees.etat == "en_jeu") then
        orbite.active = false
        orbite.tourne = false
        orbite.survol_ui = false
    end
end)

-- ── Entrées ───────────────────────────────────────────────────────────────────
--
-- Signatures vérifiées dans la documentation officielle Input et l'API JSON.
-- MouseMove remplace MouseMoveX/Y, dépréciés dans le client 1.154.

Input.Subscribe("MouseDown", function(touche)
    if (orbite.active and touche == "MiddleMouseButton") then orbite.tourne = true end
end)

Input.Subscribe("MouseUp", function(touche)
    if (touche == "MiddleMouseButton") then orbite.tourne = false end
end)

-- Le relâchement peut se perdre quand la fenêtre perd le focus : sans cette
-- purge, la scène resterait accrochée au curseur au retour.
Input.Subscribe("WindowFocusChange", function(focus)
    if (not focus) then orbite.tourne = false end
end)

Input.Subscribe("MouseMove", function(delta_x, delta_y)
    if (not orbite.active or not orbite.tourne) then return end
    orbite.yaw = (orbite.yaw + (tonumber(delta_x) or 0) * SENSIBILITE) % 360

    local p = orbite.pitch + (tonumber(delta_y) or 0) * SENSIBILITE
    -- Bornes serrées : au-delà, on regarde le crâne ou la plante des pieds, et
    -- la silhouette qu'on est venu juger disparaît.
    if (p < -55) then p = -55 end
    if (p > 45) then p = 45 end
    orbite.pitch = p

    PoserCamera()
end)

Page("creation", "NarvosCreation:Survol", function(sur_panneau)
    orbite.survol_ui = sur_panneau == true
end)

Input.Subscribe("MouseScroll", function(_, _, delta)
    if (not orbite.active or orbite.survol_ui) then return end

    -- `delta` est positif vers le haut. Molette avant = se rapprocher, ce qui est
    -- le sens qu'attend n'importe qui ayant deja manipule une vue 3D.
    local d = orbite.distance - (tonumber(delta) or 0) * PAS_ZOOM
    if (d < DIST_MIN) then d = DIST_MIN end
    if (d > DIST_MAX) then d = DIST_MAX end
    orbite.distance = d

    PoserCamera()
end)

-- ── Qualité graphique ─────────────────────────────────────────────────────────
--
-- Les trois niveaux vivent dans `narvos/Shared/Logic/Graphismes.lua` — module
-- PUR, 108 assertions (`node scripts/lua-harness/graphismes.mjs`). Ici, on ne
-- fait qu'APPLIQUER : aucune valeur n'est écrite dans ce fichier.
--
-- ⚠ CE QU'ON NE PEUT PAS RÉGLER, ET POURQUOI ON N'ESSAIE PAS.
-- Relevé le 2026-09-08 dans l'API : `Console.RunCommand` dit « only
-- scripting-registered commands can be triggered ». Les commandes moteur
-- (`sg.ShadowQuality`, `r.ScreenPercentage`, résolution des ombres, qualité de
-- texture, antialiasing) sont donc FERMÉES au Lua. Elles restent dans le menu de
-- nanos, que le joueur règle une fois. Notre menu règle ce qui est à nous.
--
-- ⚠ Aucun getter n'existe pour le post-process : on ne peut pas lire l'état
-- initial pour y revenir. « Élevé » est donc un rendu de référence CHOISI, écrit
-- dans le module — pas « les valeurs par défaut d'Unreal ».

local niveau_graphique = Narvos and Narvos.Graphismes
    and Narvos.Graphismes.Normaliser(Package.GetPersistentData("graphismes"))
    or "moyen"

--- Applique le profil aux acteurs déjà présents.
---
--- ⚠ `Entity.GetAll()` est `[both]` : appelable côté client, il rend « all
--- Entities of the class this is called on ». On le passe sur StaticMesh ET
--- Prop : ce sont les deux classes qui portent le décor. Les personnages en sont
--- volontairement exclus — couper leurs ombres rendrait les joueurs difficiles à
--- situer, et c'est de la lisibilité, pas du confort.
---@param profil table
local function AppliquerAuDecor(profil)
    for _, classe in ipairs({ StaticMesh, Prop }) do
        if (classe and classe.GetAll) then
            for _, acteur in pairs(classe.GetAll() or {}) do
                if (acteur and acteur.IsValid and acteur:IsValid()) then
                    acteur:SetCastShadow(profil.ombres)
                    acteur:SetRenderCullDistance(profil.cull)
                end
            end
        end
    end
end

--- Pose un niveau : effets d'image, ciel, plan proche, décor.
---@param nom string
---@param silencieux boolean?  true = ne pas prévenir la page (elle vient de le demander)
local function AppliquerGraphismes(nom, silencieux)
    if (not Narvos or not Narvos.Graphismes) then return end

    niveau_graphique = Narvos.Graphismes.Normaliser(nom)
    local p = Narvos.Graphismes.Profil(niveau_graphique)

    PostProcess.SetBloom(p.bloom_intensite, p.bloom_seuil)
    PostProcess.SetChromaticAberration(p.aberration_intensite, p.aberration_depart)
    PostProcess.SetImageEffects(p.vignette, p.grain)
    Client.SetNearClipPlane(p.plan_proche)
    Viewport.SetBloodScreenEnabled(p.ecran_sang)

    -- Le ciel est un singleton client : `Ciel.Appliquer` le repose à chaque
    -- voyage. On écrase donc APRÈS lui, et le voyage suivant remettra ses
    -- valeurs à lui — c'est accepté : le niveau se réapplique au prochain
    -- changement de réglage, et un ciel de monde qui prime sur un réglage de
    -- confort est le bon ordre de priorité.
    if (Sky) then
        Sky.SetCloudCoverage(p.nuages)
        Sky.SetFog(p.brouillard)
    end

    AppliquerAuDecor(p)

    -- ⚠ La persistance passe par `Package.SetPersistentData`, `[both]`, écrit sur
    -- le disque du CLIENT. `Client.SetValue` ne survivrait pas à la session, et
    -- un réglage graphique qu'il faut refaire à chaque connexion n'est pas un
    -- réglage — c'est une corvée.
    Package.SetPersistentData("graphismes", niveau_graphique)

    if (not silencieux and HUD) then
        HUD:CallEvent("NarvosGraphismes", Narvos.Graphismes.PourInterface(niveau_graphique))
    end
end

-- Le décor arrive par lots (chunks) longtemps après le spawn : un acteur né
-- après l'application du niveau garderait ses ombres et sa portée d'origine.
-- On rattrape donc chaque naissance.
for _, classe in ipairs({ StaticMesh, Prop }) do
    if (classe and classe.Subscribe) then
        classe.Subscribe("Spawn", function(acteur)
            if (not acteur or not Narvos or not Narvos.Graphismes) then return end
            local p = Narvos.Graphismes.Profil(niveau_graphique)
            acteur:SetCastShadow(p.ombres)
            acteur:SetRenderCullDistance(p.cull)
        end)
    end
end

-- La page demande la liste à l'ouverture du panneau. Elle ne la recopie pas :
-- libellés, résumés et ordre viennent tous de `PourInterface`. Une liste
-- recopiée finit toujours par diverger de sa source.
Page("hud", "Narvos:UIGraphismesDemande", function()
    if (not HUD or not Narvos or not Narvos.Graphismes) then return end
    HUD:CallEvent("NarvosGraphismes", Narvos.Graphismes.PourInterface(niveau_graphique))
end)

Page("hud", "Narvos:UIGraphismes", function(nom)
    AppliquerGraphismes(nom)
end)

-- ── Menu de pause ─────────────────────────────────────────────────────────────

Page("hud", "Narvos:UIReprendre", function()
    if (panneau) then Basculer(panneau) end
end)

Page("hud", "Narvos:UIGraphismesPanneau", function()
    Basculer("graphismes")
end)

-- Remonter des graphismes vers la pause. `Basculer` bascule : depuis
-- "graphismes", `Basculer("pause")` ouvre bien la pause au lieu de refermer.
Page("hud", "Narvos:UIPause", function()
    Basculer("pause")
end)

Page("hud", "Narvos:UICommandesPanneau", function()
    -- L'écran s'ouvre : la session existe forcément (on est en jeu), c'est le
    -- moment sûr de rapporter les touches de déplacement natives du clavier.
    SignalerTouchesReserveesDesQuePret()
    Basculer("commandes")
end)

-- ── Jouabilité (2026-09-19) ───────────────────────────────────────────────────
-- Le panneau est un sous-menu de la pause, comme « Graphismes » et « Commandes ».
-- À l'ouverture, on DEMANDE l'état : le serveur répond par Narvos:Jouabilite
-- (registre + valeurs), la page rend ce qu'elle reçoit — ajouter un paramètre
-- demain ne touche ni ce fichier ni la page.
Page("hud", "Narvos:UIJouabilitePanneau", function()
    Basculer("jouabilite")
end)

Page("hud", "Narvos:UJouabiliteDemande", function()
    Events.CallRemote("Narvos:DemanderJouabilite", Reliability.Reliable)
end)

Page("hud", "Narvos:UIJouabiliteDefinir", function(id, valeur)
    Events.CallRemote("Narvos:DefinirJouabilite", Reliability.Reliable, id, valeur)
end)

Page("hud", "Narvos:UIJouabiliteReinit", function(id)
    Events.CallRemote("Narvos:ReinitialiserJouabilite", Reliability.Reliable, id)
end)

-- ── Fouille (2026-09-19) ──────────────────────────────────────────────────────
-- Le panneau s'ouvre QUAND le serveur répond (Narvos:Fouille), jamais à la
-- demande : un client modifié ne peut pas s'ouvrir un menu de butin vide. Les
-- gestes partent d'ici, le serveur revalide (proximité, contenu, sac).
Page("hud", "Narvos:UIFouillePrendre", function(uid, quantite)
    Events.CallRemote("Narvos:FouillePrendre", Reliability.Reliable, uid, quantite)
end)

Page("hud", "Narvos:UIFouilleTout", function()
    Events.CallRemote("Narvos:FouilleToutPrendre", Reliability.Reliable)
end)

Page("hud", "Narvos:UIFouilleFermer", function()
    if (panneau == "fouille") then Basculer("fouille") end
end)

--- Quitter.
---
--- ⚠ CE BOUTON DÉCONNECTE, IL NE FERME PAS L'APPLICATION. `Client.json` n'expose
--- aucun `Quit` ni `Exit` — vérifié fonction par fonction sur ses 27 fonctions
--- statiques. `Client.Disconnect()` est tout ce qui existe : le joueur revient
--- au menu principal de nanos, d'où il ferme le jeu lui-même.
--- Le libellé du bouton dit donc « Quitter la partie », pas « Quitter le jeu » —
--- promettre une fermeture qui n'arrive pas serait pire que de ne rien promettre.
Page("hud", "Narvos:UIQuitter", function()
    Console.Log("Deconnexion demandee depuis le menu de pause.")
    Client.Disconnect()
end)

-- Le niveau enregistré s'applique dès que le joueur est en jeu. Pas au
-- chargement du package : `Sky` et le décor n'existent pas encore, et
-- `AppliquerAuDecor` passerait sur une scène vide.
Client.Subscribe("SpawnLocalPlayer", function()
    AppliquerGraphismes(niveau_graphique, true)
end)

-- ── Le HUD reçoit enfin sa page ───────────────────────────────────────────────
--
-- ⚠ EN FIN DE FICHIER, et c'est nécessaire. `HUD` existe depuis le début, mais
-- ses gestionnaires (`Page("hud", …)`) sont enregistrés tout au long du
-- chargement — jusqu'au pont des props et des pouvoirs, tout en bas. Abonner
-- plus tôt ne poserait que ceux déjà connus, et les menus Props, PNJ, Commandes
-- et la barre de pouvoirs resteraient muets.
BrancherPage("hud", HUD)
