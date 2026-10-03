-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/CharacterCreation.lua — création et roster de personnages.
--
-- Câblage : Narvos.Creation = Package.Require("Logic/CharacterCreation.lua")
--
-- ── CE QUE CE FICHIER EST, ET CE QU'IL N'EST PAS ───────────────────────────────
-- `Logic/Character.lua` ASSEMBLE un personnage déjà décidé : il prend un class_id
-- et fabrique une entité nanos habillée. Il ne décide de rien.
--
-- Ce fichier-ci DÉCIDE : il valide un nom, attribue une identité, fixe les
-- valeurs de départ et tient le roster d'un compte. C'est l'étape qui précède,
-- et elle n'existait pas côté Lua — seul l'assemblage avait été porté.
--
-- ── SOURCE ─────────────────────────────────────────────────────────────────────
-- Port de `components/character/useCharacterStorage.ts` (createCharacter) et de
-- la forme `SavedCharacter` de `src/types.ts`. Le hook React, MySQL et
-- localStorage ne se portent pas : nanos persiste via Package.SetPersistentData.
--
-- ── DIVERGENCE ASSUMÉE vis-à-vis du TS ─────────────────────────────────────────
-- Le TS teste `name.trim()` pour « requis » et « trop court », mais `name.length`
-- (NON rogné) pour « trop long ». Un nom de 16 caractères entouré d'espaces était
-- donc refusé alors que sa forme enregistrée aurait tenu. Ici les trois règles
-- portent sur la chaîne rognée — c'est ce que le champ enregistre.
--
-- ── PURETÉ ─────────────────────────────────────────────────────────────────────
-- Tout ce qui décide est pur et testable hors nanos. Seules `Save`, `Load` et
-- `Delete` touchent Package.*, et elles sont isolées en fin de fichier pour que
-- le reste tourne dans le harnais wasmoon.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosCreation
local Creation = {}

-- Bornes du nom, reprises telles quelles du TS.
Creation.NOM_MIN = 2
Creation.NOM_MAX = 16

-- Le TS type le genre 'M' | 'F'. On garde ces deux lettres : elles partent en
-- base et tout code existant les attend.
Creation.GENRES = { "M", "F" }

-- Clé unique du roster dans PersistentData. Le fichier est un TOML par package :
-- une seule clé bien nommée vaut mieux qu'une clé par personnage, que rien ne
-- permettrait d'énumérer.
local CLE_ROSTER = "narvos_roster"

-- ⚠ `COULEURS_DEFAUT` (skin/hair/jacket) A ÉTÉ RETIRÉ LE 2026-09-04. C'était la
-- palette de la base Dofus, conservée "parce que le schéma l'attend". Elle ne
-- pilotait rien, et le jour où les couleurs ont été branchées elle a cessé
-- d'être inerte pour devenir fausse : `Construire` la rendait à la place du
-- choix du joueur. Les vraies cibles vivent dans `Logic/Apparence.lua`.
--
-- Leçon, pas le détail : une valeur morte gardée "au cas où" n'est pas neutre.
-- Elle occupe la place de la vraie et la masque le jour où celle-ci arrive.

local function catalogue(nom, fichier)
    return (Narvos and Narvos[nom]) or Package.Require("Catalogs/" .. fichier)
end

local Classes = catalogue("Classes", "Classes.lua")
local Modular = catalogue("Modular", "Modular.lua")

-- ── Validation ─────────────────────────────────────────────────────────────────

--- Rogne les espaces aux deux bouts.
--- `%s` couvre espace, tabulation et retours ; `^` et `$` ancrent, sinon le motif
--- mangerait aussi les espaces internes d'un nom en deux mots.
---@param s string
---@return string
local function rogner(s)
    return (tostring(s):gsub("^%s+", ""):gsub("%s+$", ""))
end
Creation.Rogner = rogner

--- Le nom est-il acceptable ?
--- Rend un couple (ok, raison) plutôt que de lever : un nom refusé est un cas
--- de jeu normal, pas une exception. Le TS levait parce qu'il était dans une
--- promesse React ; ici l'appelant est une boucle serveur.
---@param nom any
---@return boolean ok
---@return string|nil raison
function Creation.ValiderNom(nom)
    if (type(nom) ~= "string") then return false, "Nom requis" end

    local propre = rogner(nom)
    if (propre == "") then return false, "Nom requis" end

    -- ⚠ COMPTER LES CARACTÈRES, PAS LES OCTETS.
    --
    -- `#propre` rend des OCTETS : en UTF-8 un « é » en vaut deux. Un nom de 16
    -- caractères accentués en pesait donc plus de 16 et était refusé, alors que le
    -- champ HTML — qui compte en caractères — l'acceptait. Le joueur lisait
    -- « nom trop long » sur un nom manifestement court.
    -- Trouvé par audit le 2026-09-03.
    --
    -- `utf8.len` existe depuis Lua 5.3 et nanos tourne en 5.4. Elle rend `nil`
    -- sur une chaîne mal formée : on retombe alors sur le compte d'octets, ce
    -- qui est plus strict, jamais plus permissif.
    local longueur = utf8.len(propre) or #propre

    if (longueur < Creation.NOM_MIN) then
        return false, "Nom trop court (min " .. Creation.NOM_MIN .. " caractères)"
    end
    if (longueur > Creation.NOM_MAX) then
        return false, "Nom trop long (max " .. Creation.NOM_MAX .. " caractères)"
    end
    return true
end

--- La classe existe-t-elle au catalogue ?
---@param class_id any
---@return boolean
function Creation.ClasseValide(class_id)
    return type(class_id) == "string" and Classes.CLASSES[class_id] ~= nil
end

--- Le genre est-il l'un des deux attendus ?
---@param genre any
---@return boolean
function Creation.GenreValide(genre)
    for _, g in ipairs(Creation.GENRES) do
        if (genre == g) then return true end
    end
    return false
end

-- ── Identité ───────────────────────────────────────────────────────────────────

-- Alphabet base 36, comme `Math.random().toString(36)` côté TS.
local BASE36 = "0123456789abcdefghijklmnopqrstuvwxyz"

--- Identifiant unique : `char_<millisecondes>_<6 caractères base 36>`.
--- Horloge et RNG sont injectables — c'est la seule façon de tester un
--- générateur d'identité, et ça évite de dépendre de `os` si nanos le retire
--- un jour du bac à sable Lua.
---@param horloge? fun():integer  millisecondes
---@param rng? fun():number       0..1
---@return string
function Creation.NouvelId(horloge, rng)
    horloge = horloge or function()
        -- os.time rend des SECONDES : ×1000 pour rester dans l'unité du TS.
        -- Sans `os`, on retombe sur 0 et c'est le suffixe aléatoire qui porte
        -- seul l'unicité.
        if (os and os.time) then return math.floor(os.time() * 1000) end
        return 0
    end
    rng = rng or math.random

    local suffixe = {}
    for i = 1, 6 do
        -- ⚠ UN SEUL tirage, retenu dans une variable. Écrire
        -- `BASE36:sub(math.floor(rng()*36)+1, math.floor(rng()*36)+1)` appelle
        -- `rng()` DEUX fois : les bornes sont alors indépendantes, et `sub`
        -- rend une chaîne vide (si j < i) ou plusieurs caractères. L'identifiant
        -- perdait son entropie sans que rien ne le signale.
        -- Trouvé par audit le 2026-09-03.
        local k = math.floor(rng() * 36) + 1
        suffixe[i] = BASE36:sub(k, k)
    end

    return "char_" .. tostring(horloge()) .. "_" .. table.concat(suffixe)
end

-- ── Construction ───────────────────────────────────────────────────────────────

--- Construit un personnage à partir des choix du joueur. PUR : ne persiste rien.
---
--- Séparé de `Save` exprès — un aperçu à l'écran de création doit pouvoir
--- fabriquer la fiche sans l'écrire, et un test doit pouvoir la vérifier sans
--- toucher au disque.
---@param params table  { nom, class_id, genre, compte?, serveur?, horloge?, rng? }
---@return table|nil perso
---@return string|nil raison
function Creation.Construire(params)
    params = params or {}

    local ok, raison = Creation.ValiderNom(params.nom)
    if (not ok) then return nil, raison end

    if (not Creation.ClasseValide(params.class_id)) then
        return nil, "Classe inconnue : " .. tostring(params.class_id)
    end

    -- Le TS impose un genre typé ; ici on refuse au lieu de replier en silence
    -- sur "M", qui donnerait un personnage que le joueur n'a pas demandé.
    if (not Creation.GenreValide(params.genre)) then
        return nil, "Genre invalide : " .. tostring(params.genre)
    end

    -- Tenue modulaire. Absente, on pose celle par défaut (le corps nu) : un
    -- personnage sans tenue serait invisible en jeu. Fournie, elle est validée —
    -- une pièce du mauvais genre ou du mauvais slot ne se déforme pas
    -- correctement, et il vaut mieux le refuser ici qu'à l'attachement.
    -- Corps de base. C'est LUI qui fixe la morphologie, et donc quelles pièces
    -- sont portables : un vêtement MetaHuman ne va pas sur un corps Stylized.
    -- Absent, on prend le premier corps du genre demandé.
    local corps = Modular.Corps(params.corps)
    if (not corps) then
        local dispo = Modular.CorpsParGenre(params.genre)
        if (#dispo == 0) then
            return nil, "Aucun corps disponible pour le genre " .. tostring(params.genre)
        end

        -- ⚠ LE PREMIER CORPS HABILLABLE, PAS LE PREMIER TOUT COURT.
        --
        -- `CorpsParGenre` trie par identifiant. Depuis l'arrivée du corps
        -- morphable — famille `mpfb`, aucun vêtement — c'est LUI qui sortait en
        -- tête, et un personnage créé sans choix explicite naissait nu.
        --
        -- Le corps morphable reste proposé à l'écran ; il n'est simplement pas
        -- le repli silencieux.
        local habillable = {}
        for _, p in pairs(Modular.PIECES) do habillable[p.famille] = true end

        local choisi
        for i = 1, #dispo do
            if (habillable[dispo[i].famille]) then choisi = dispo[i] break end
        end

        -- Aucune famille habillée : on prend quand même le premier plutôt que
        -- de refuser la création. Un personnage nu vaut mieux qu'un joueur
        -- bloqué à l'écran de sélection.
        choisi = choisi or dispo[1]

        corps = Modular.CORPS[choisi.id]
        params.corps = choisi.id
    end

    if (corps.genre ~= params.genre) then
        return nil, "Le corps choisi ne correspond pas au genre"
    end

    local tenue = params.tenue
    if (tenue == nil) then
        tenue = Modular.TenueDefaut(params.genre, corps.famille)
    else
        local ok_tenue, raison_tenue = Modular.ValiderTenue(tenue, params.genre, corps.famille)
        if (not ok_tenue) then return nil, raison_tenue end
    end

    local classe = Classes.CLASSES[params.class_id]

    return {
        -- Pièces modulaires par slot ; `Logic/Character.lua` les attache par
        -- AddSkeletalMeshAttached, qui exige le même squelette — les 40 pièces
        -- du catalogue sont sur SKEL_Mannequin, vérifié.
        tenue     = tenue,
        -- Le corps choisi. La famille s'en déduit (`Modular.Corps(corps).famille`)
        -- et n'est PAS stockée séparément : deux sources pour une même vérité
        -- finiraient par diverger.
        corps     = params.corps,
        -- Reglages de morphologie, transmis TELS QUELS. Ce module ne connait
        -- pas le catalogue de morphs, et le valider ici dupliquerait la borne
        -- que `Morphs.Resoudre` applique deja a chaque application.
        morphs    = type(params.morphs) == "table" and params.morphs or {},
        -- Classe de LORE (PlayerClass, 12 entrées). Purement descriptive : c'est
        -- `classId` qui porte les statistiques. Non validée ici — le catalogue de
        -- factions n'est pas une dépendance de ce module, et une valeur inconnue
        -- ne fait qu'afficher un libellé vide.
        -- ⚠ BORNÉ. `lore_id` vient du client et part en base ; sans garde, on y
        -- écrivait une chaîne de longueur arbitraire, seul champ du dossier à
        -- échapper à toute validation. On refuse ce qui n'est pas un
        -- identifiant plausible plutôt que de le stocker.
        loreId    = (type(params.lore_id) == "string"
                     and #params.lore_id <= 48
                     and params.lore_id:match("^[A-Za-z0-9_]+$")) and params.lore_id or nil,
        id        = Creation.NouvelId(params.horloge, params.rng),
        name      = rogner(params.nom),
        classId   = params.class_id,
        gender    = params.genre,
        level     = 1,
        -- Couleurs choisies, transmises TELLES QUELLES — même raison que les
        -- morphs juste au-dessus : ce module ne connaît pas le catalogue des
        -- cibles, et `Roster.EncoderCouleurs` normalise de toute façon avant
        -- d'écrire en base.
        --
        -- ⚠ Ce champ RENDAIT `COULEURS_DEFAUT` (skin/hair/jacket), palette
        -- héritée de la base Dofus qui ne pilotait rien en jeu. Un personnage
        -- créé après le branchement des couleurs sortait donc avec les
        -- couleurs d'un autre jeu, et le choix du joueur était jeté ici, à
        -- l'endroit exact censé le porter.
        colors    = type(params.couleurs) == "table" and params.couleurs or {},
        headIndex = 0,
        username  = params.compte or "local",
        server    = params.serveur or "local",
        -- Le TS stocke une vignette encodée en base64. Elle ne veut rien dire
        -- côté serveur nanos, et un TOML n'est pas l'endroit d'une image.
        spriteDataUrl = "",
        lastMap   = { x = 0, y = 0 },
        createdAt = (os and os.time) and os.time() or 0,
        -- Élément et rôle sont RECOPIÉS depuis la classe pour que le roster soit
        -- lisible sans recharger les catalogues (écran de sélection, admin).
        -- La source de vérité reste le catalogue : en cas de divergence, c'est
        -- lui qui gagne.
        element   = classe.element,
        role      = classe.role,
    }
end

-- ── Roster (persistance) ───────────────────────────────────────────────────────
--
-- Tout ce qui suit touche Package.* et ne tourne donc QUE dans nanos. Les
-- fonctions rendent des valeurs neutres hors moteur pour que le reste du module
-- reste testable.

--- Le moteur est-il là ?
local function moteur()
    return type(Package) == "table" and Package.GetPersistentData ~= nil
end

--- Roster complet, tous comptes confondus.
---@return table[]
function Creation.Tous()
    if (not moteur()) then return {} end
    local data = Package.GetPersistentData()
    local roster = data and data[CLE_ROSTER]
    -- Un TOML absent ou vide rend nil, pas une table vide : sans ce repli, tout
    -- appelant devrait tester nil avant d'itérer.
    if (type(roster) ~= "table") then return {} end
    return roster
end

--- Personnages d'un compte donné.
---@param compte string
---@return table[]
function Creation.ParCompte(compte)
    local sortie = {}
    for _, perso in ipairs(Creation.Tous()) do
        if (perso.username == compte) then sortie[#sortie + 1] = perso end
    end
    return sortie
end

--- Un nom est-il déjà pris ? Comparaison insensible à la casse : deux joueurs
--- nommés « Hanibes » et « hanibes » seraient indiscernables en jeu.
---@param nom string
---@return boolean
function Creation.NomPris(nom)
    local cible = rogner(nom):lower()
    for _, perso in ipairs(Creation.Tous()) do
        if (tostring(perso.name):lower() == cible) then return true end
    end
    return false
end

--- Crée ET enregistre un personnage.
---@param params table  cf. Creation.Construire
---@return table|nil perso
---@return string|nil raison
function Creation.Creer(params)
    local perso, raison = Creation.Construire(params)
    if (not perso) then return nil, raison end

    -- L'unicité se vérifie APRÈS construction : elle a besoin du nom rogné, et
    -- un nom invalide doit être refusé pour sa forme avant qu'on regarde s'il
    -- est libre.
    if (Creation.NomPris(perso.name)) then
        return nil, "Ce nom est déjà pris"
    end

    if (not moteur()) then return perso end

    local roster = Creation.Tous()
    roster[#roster + 1] = perso
    Package.SetPersistentData(CLE_ROSTER, roster)

    return perso
end

--- Supprime un personnage par son id.
---@param id string
---@return boolean supprime
function Creation.Supprimer(id)
    if (not moteur()) then return false end

    local roster = Creation.Tous()
    local restant = {}
    local trouve = false

    for _, perso in ipairs(roster) do
        if (perso.id == id) then
            trouve = true
        else
            restant[#restant + 1] = perso
        end
    end

    if (not trouve) then return false end

    Package.SetPersistentData(CLE_ROSTER, restant)
    return true
end

--- Retrouve un personnage par son id.
---@param id string
---@return table|nil
function Creation.Trouver(id)
    for _, perso in ipairs(Creation.Tous()) do
        if (perso.id == id) then return perso end
    end
    return nil
end

-- ── Écran de création : ce qu'il faut proposer ─────────────────────────────────

--- Tout ce dont un écran de création a besoin, en un appel.
--- L'ordre des classes vient de CLASSES_ORDER (séquence figée par le générateur)
--- et non de `pairs`, dont l'ordre change d'une VM à l'autre : sans ça, deux
--- joueurs verraient les classes dans un ordre différent.
---@return table
function Creation.Options()
    local classes = {}
    local ordre = Classes.CLASSES_ORDER
    if (type(ordre) ~= "table") then
        ordre = {}
        for id in pairs(Classes.CLASSES) do ordre[#ordre + 1] = id end
        table.sort(ordre)
    end

    for _, id in ipairs(ordre) do
        local c = Classes.CLASSES[id]
        classes[#classes + 1] = {
            id          = id,
            -- Le catalogue nomme ce champ `label`, pas `name`. Écrire `name`
            -- rendait nil en silence : l'écran de création aurait affiché
            -- l'identifiant technique (warrior_bruiser) au lieu du nom.
            label       = c.label,
            description = c.description,
            weaponKey   = c.weaponKey,
            element     = c.element,
            role        = c.role,
            outfitColor = c.outfitColor,
            baseStats   = c.baseStats,
        }
    end

    return {
        classes  = classes,
        genres   = Creation.GENRES,
        nom_min  = Creation.NOM_MIN,
        nom_max  = Creation.NOM_MAX,
    }
end

return Creation
