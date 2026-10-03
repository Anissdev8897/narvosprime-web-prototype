-- ══════════════════════════════════════════════════════════════════════════════
-- Vestiaire.lua — ce qu'un personnage POSSÈDE et ce qu'il PORTE.
--
-- ── POURQUOI UN MODULE À PART DE Inventory.lua ────────────────────────────────
-- L'inventaire de jeu a six slots — helmet, armor, legs, weapon, offhand,
-- accessory — hérités du prototype web. Le corps modulaire en a huit, et ce ne
-- sont pas les mêmes : visage, tete, torse, epaules, bras, mains, jambes, pieds.
--
-- Les faire coïncider demanderait de renommer les slots de l'inventaire, donc de
-- casser les sauvegardes et le code web qui les lit. On garde deux registres
-- distincts, reliés par la seule chose qu'ils partagent vraiment : les crédits.
--
-- ── LA FRONTIÈRE CRÉATION / BOUTIQUE ──────────────────────────────────────────
-- L'écran de création ne montre plus de vêtements. Il ne montre que ce qui tient
-- de l'identité — corps, visage, coiffure — parce qu'un vêtement se change
-- alors qu'un visage définit le personnage.
--
-- Le CASQUE suit les vêtements : c'est une pièce d'équipement, elle s'achète.
-- La COIFFURE reste à la création : elle appartient au corps.
--
-- Les deux occupent le slot `tete`. C'est voulu, et c'est même le mécanisme :
-- coiffer un casque chasse la coiffure du slot, ce qui évite les cheveux qui
-- traversent le heaume. Un joueur qui retire son casque retrouve ses cheveux,
-- puisque l'apparence de création reste sous la garde-robe (cf. `Tenue`).
--
-- ── LOGIQUE PURE ──────────────────────────────────────────────────────────────
-- Aucun appel moteur ici : ni Character, ni Events, ni Console. Le module tourne
-- en Lua nu, donc sous les tests. Ce qui touche au personnage vit dans
-- Character.lua (Habiller), ce qui touche au réseau dans Server/Vestiaire.lua.
-- ══════════════════════════════════════════════════════════════════════════════

local Vestiaire = {}

--- Résolution paresseuse du catalogue, comme dans Character.lua : Package.Require
--- et `require` nu n'ont pas la même clé de cache, et deux chargements donneraient
--- deux tables distinctes.
local function catalogue()
    if (Narvos and Narvos.Modular) then return Narvos.Modular end
    return Package.Require("Catalogs/Modular.lua")
end

-- ── Registres ─────────────────────────────────────────────────────────────────

--- Ce que l'écran de création a le droit de montrer : l'identité, rien d'autre.
--- `base` porte la peau nue, les visages, les 8 coiffures et les 4 barbes.
---
--- Les CHAPEAUX partagent le slot `tete` avec les coiffures mais restent en
--- `civil`/`uniforme`/`guerre` : ils s'achètent. C'est la même mécanique que le
--- casque — coiffer un couvre-chef chasse les cheveux, l'ôter les rend.
-- ⚠ « civil » EST ENTRÉ ICI LE 2026-09-12, sur demande de Hanibes, répétée deux
-- fois : « il faut que tous les corps et tous les vêtements soient dans la
-- création ». Avant, l écran ne montrait que le corps NU — 6 à 9 pièces par
-- famille — et les 83 vêtements dormaient chez le tailleur. Le joueur créait un
-- personnage en slip et ne comprenait pas où était le modulaire.
--
-- ⚠ ET `uniforme` ET `guerre` AUSSI, une heure plus tard. N ajouter que `civil`
-- ne changeait presque rien : les 55 pièces Trooper sont classées `guerre`, donc
-- les trois familles Trooper restaient en corps nu. Mesuré : 7 pièces par
-- famille avant, 7 après.
--
-- Ce que ça coûte, et il faut le savoir : le tailleur ne vend plus rien qu on ne
-- puisse composer gratuitement à la création. Le jour où la progression et
-- l économie existeront, retirer `guerre` d ici suffira à rendre les armures au
-- marchand — une ligne, et la boutique reprend son objet.
--
-- Le marchand garde les MÊMES registres : il sert à se rhabiller en jeu, pas
-- seulement à s habiller une fois.
Vestiaire.REGISTRES_CREATION = { "base", "civil", "uniforme", "guerre" }

--- Ce que le tailleur vend. `guerre` inclut les casques : ce sont des pièces
--- d'équipement, pas des traits de visage.
Vestiaire.REGISTRES_BOUTIQUE = { "civil", "uniforme", "guerre" }

local function ensemble(liste)
    local s = {}
    for _, v in ipairs(liste) do s[v] = true end
    return s
end

local CREATION = ensemble(Vestiaire.REGISTRES_CREATION)
local BOUTIQUE = ensemble(Vestiaire.REGISTRES_BOUTIQUE)

--- Vrai si la pièce relève de la création plutôt que de la boutique.
---@param piece table|nil
---@return boolean
function Vestiaire.EstIdentite(piece)
    return type(piece) == "table" and CREATION[piece.registre] == true
end

--- Vrai si la pièce est un TRAIT : un visage, une peau découpée, une main nue.
---
--- ⚠ DISTINCT d'`EstIdentite` DEPUIS LE 2026-09-12. Tant que la création ne
--- montrait que le registre `base`, les deux questions se confondaient. Depuis
--- que TOUT s y montre (décision de Hanibes), `EstIdentite` répond « visible à la
--- création » — c est-à-dire tout — et ne dit plus rien de la nature de la pièce.
---
--- Ce qu on protège ici n a pas changé : un trait ne se VEND pas. Faire payer un
--- visage obligerait le joueur à acheter sa propre tête.
---@param piece table|nil
---@return boolean
function Vestiaire.EstTrait(piece)
    return type(piece) == "table" and piece.registre == "base"
end

--- Vrai si la pièce est vendue.
---@param piece table|nil
---@return boolean
function Vestiaire.EstVendable(piece)
    return type(piece) == "table" and BOUTIQUE[piece.registre] == true
end

-- ── Prix ──────────────────────────────────────────────────────────────────────
--
-- Dérivé du registre et du slot, pas saisi pièce par pièce. Une table de 116 prix
-- écrits à la main dériverait au premier ajout d'asset, et personne ne le verrait :
-- une pièce sans prix serait gratuite, en silence.

local PRIX_REGISTRE = {
    civil = 120,
    uniforme = 260,
    guerre = 420,
}

--- Un torse coûte plus qu'une paire de gants : il couvre plus de surface et change
--- davantage la silhouette. Le facteur suit cette surface.
local FACTEUR_SLOT = {
    torse = 1.0,
    jambes = 0.9,
    tete = 0.7,
    epaules = 0.6,
    bras = 0.6,
    mains = 0.5,
    pieds = 0.5,
    visage = 0.4,
    -- Une barbe ne se vend pas — elle releve du registre `base`, donc n'a jamais
    -- de prix. Le facteur est la pour que l'ajout d'une barbe payante un jour ne
    -- retombe pas sur le defaut generique de 0.7.
    barbe = 0.3,
}

--- Prix d'une pièce, ou nil si elle n'est pas à vendre.
--- Rend nil plutôt que 0 : un prix nul serait indistinguable d'un cadeau, et le
--- serveur laisserait passer l'achat d'une pièce hors boutique.
---@param piece table|nil
---@return integer|nil
function Vestiaire.Prix(piece)
    if (not Vestiaire.EstVendable(piece)) then return nil end

    local base = PRIX_REGISTRE[piece.registre]
    if (not base) then return nil end

    return math.floor(base * (FACTEUR_SLOT[piece.slot] or 0.7) + 0.5)
end

-- ── Listes ────────────────────────────────────────────────────────────────────

--- Pièces d'une famille et d'un genre, groupées par slot, filtrées par un test.
---
--- Le filtre de famille n'est pas cosmétique : une pièce Trooper posée sur un
--- corps Stylized ne partage pas ses volumes et s'interpénètre. Laisser le joueur
--- l'acheter reviendrait à lui vendre un défaut.
local function grouper(famille, genre, garder, decrire)
    local Modular = catalogue()
    local sortie = {}

    for _, slot in ipairs(Modular.SLOTS) do
        local liste = {}

        for id, piece in pairs(Modular.PIECES) do
            local bon_genre = (piece.genre == genre or piece.genre == "*")
            if (piece.slot == slot and piece.famille == famille and bon_genre
                and garder(piece)) then
                liste[#liste + 1] = decrire(id, piece)
            end
        end

        -- `pairs` n'a aucun ordre garanti en Lua et il change d'une VM à l'autre :
        -- sans ce tri, la boutique se réordonnerait entre deux ouvertures.
        table.sort(liste, function(a, b) return a.id < b.id end)

        if (#liste > 0) then sortie[slot] = liste end
    end

    return sortie
end

--- Ce que le tailleur propose à un corps donné.
---@param famille string
---@param genre string
---@return table  { [slot] = { { id, label, ensemble, registre, prix }, … } }
function Vestiaire.Stock(famille, genre)
    return grouper(famille, genre, Vestiaire.EstVendable, function(id, piece)
        return {
            id = id,
            label = piece.label,
            ensemble = piece.ensemble,
            registre = piece.registre,
            prix = Vestiaire.Prix(piece),
        }
    end)
end

--- Ce que l'écran de création montre : TOUTES les pieces de la famille.
---
--- ── POURQUOI PAS SEULEMENT L'IDENTITE ────────────────────────────────────────
--- Le pack ne livre qu'UNE peau par slot : un seul torse, une seule paire de
--- mains. Restreindre l'ecran au registre `base` ne laissait donc rien a
--- interchanger — le systeme modulaire existait sans se voir.
---
--- On montre donc l'ensemble : torse 1, torse 2, tete 1, tete 2. C'est la brique
--- de base, celle sur laquelle tout le reste se construit.
---
--- La boutique garde son role : acheter EN JEU, apres la creation. Qu'une piece
--- apparaisse aux deux endroits n'est pas un doublon — l'une compose, l'autre
--- vend.
---
--- ⚠ UN SLOT A OPTION UNIQUE RESTE MASQUE : un seul choix n'en est pas un, et
--- une carte sur laquelle cliquer ne change rien se lit comme une panne.
---@param famille string
---@param genre string
---@return table
function Vestiaire.Identites(famille, genre)
    -- ⚠ LE FILTRE EST REVENU, ET C'EST UNE DÉCISION, PAS UN OUBLI.
    --
    -- Cette fonction a rendu un temps TOUTES les pièces de la famille, registres
    -- de boutique compris. L'écran de création offrait alors sept torses, dont
    -- six à vendre : le joueur composait gratuitement une tenue que le tailleur
    -- était censé lui vendre, et la boutique n'avait plus d'objet.
    --
    -- La règle tient en une phrase : LA CRÉATION DONNE UN CORPS, LE MARCHAND
    -- L'HABILLE. Ce qui reste ici est donc le registre `base` — la peau
    -- découpée par slot et les visages. Sur `stylized`, cela laisse trois
    -- visages par genre : un vrai choix d'identité, et rien à porter.
    local tout = grouper(famille, genre, Vestiaire.EstIdentite, function(id, piece)
        return {
            id = id,
            label = piece.label,
            ensemble = piece.ensemble,
            registre = piece.registre,
        }
    end)

    -- ── TOUS LES SLOTS, MÊME CEUX À UNE SEULE PIÈCE ──────────────────────────
    --
    -- Cette fonction écartait les slots n'offrant qu'une pièce (`#liste > 1`),
    -- pour ne pas afficher de faux choix. Conséquence en jeu, capture à l'appui :
    -- l'écran ne montrait QUE le visage. Torse, jambes et mains — la peau — sont
    -- à une pièce par genre et disparaissaient, alors que ce sont eux qui
    -- composent le corps.
    --
    -- On les rend donc tous. Un slot à une pièce n'est pas un choix, c'est une
    -- PART DU CORPS : le joueur voit de quoi il est assemblé, et la pièce s'y
    -- teinte comme les autres. Et le jour où une variante est cuite, elle
    -- apparaît sans qu'on touche à ce fichier.
    --
    -- ⚠ CE QUI NE CHANGE PAS : le filtre de REGISTRE. `EstIdentite` ne laisse
    -- passer que `base`. La création donne un corps, le marchand l'habille —
    -- règle qui a déjà cédé deux fois, et que trois tests verrouillent.
    local sortie = {}
    for slot, liste in pairs(tout) do
        sortie[slot] = liste
    end
    return sortie
end
--- Toutes les pièces d'identité, y compris les slots à option unique.
--- L'écran n'en a pas besoin ; `TenueBase` et les tests, si.
---@param famille string
---@param genre string
---@return table
function Vestiaire.IdentitesCompletes(famille, genre)
    return grouper(famille, genre, Vestiaire.EstIdentite, function(id, piece)
        return { id = id, label = piece.label, ensemble = piece.ensemble }
    end)
end

-- ── Tenue offerte au départ ───────────────────────────────────────────────────
--
-- Un personnage neuf ne sort pas en sous-vêtements. On lui offre UNE tenue, et
-- une seule : la moins chère qui couvre le torse et les jambes.
--
-- Calculée plutôt qu'écrite. Une table « famille+genre → ensemble » serait juste
-- le jour où on l'écrit, et fausse au premier pack ajouté — avec un personnage
-- qui spawnerait à moitié nu, sans que rien ne le signale.

--- Ensemble offert à la création : le moins cher couvrant torse ET jambes.
---
--- Rend une table `{ [slot] = piece_id }`, vide si aucun ensemble ne couvre les
--- deux. Vide est un état acceptable : la peau nue reste sous les vêtements, le
--- personnage est présentable, simplement pas habillé.
---@param famille string
---@param genre string
---@return table
function Vestiaire.TenueDepart(famille, genre)
    local Modular = catalogue()

    -- Regroupement par ENSEMBLE (Casual, Aviator, Cop…) : offrir un torse d'un
    -- ensemble et des jambes d'un autre donnerait une tenue dépareillée.
    local par_ensemble = {}
    for id, piece in pairs(Modular.PIECES) do
        local bon_genre = (piece.genre == genre or piece.genre == "*")
        if (piece.famille == famille and bon_genre and Vestiaire.EstVendable(piece)) then
            local nom = piece.ensemble or "?"
            local e = par_ensemble[nom]
            if (not e) then e = { pieces = {}, cout = 0 } par_ensemble[nom] = e end

            -- Un ensemble peut proposer deux pièces pour le même slot (une version
            -- « with_hands », une sans). On garde la première dans l'ordre des
            -- identifiants, pour que le résultat ne dépende pas de `pairs`.
            local actuel = e.pieces[piece.slot]
            if (not actuel or id < actuel) then e.pieces[piece.slot] = id end
        end
    end

    local meilleur, meilleur_cout = nil, nil
    for nom, e in pairs(par_ensemble) do
        if (e.pieces.torse and e.pieces.jambes) then
            local cout = 0
            for _, id in pairs(e.pieces) do
                cout = cout + (Vestiaire.Prix(Modular.PIECES[id]) or 0)
            end
            -- `nom` départage à coût égal : sans lui le choix dépendrait de
            -- `pairs`, et deux joueurs identiques n'auraient pas la même tenue.
            if (not meilleur_cout or cout < meilleur_cout
                or (cout == meilleur_cout and nom < meilleur)) then
                meilleur, meilleur_cout = nom, cout
            end
        end
    end

    if (not meilleur) then return {} end

    local sortie = {}
    for slot, id in pairs(par_ensemble[meilleur].pieces) do sortie[slot] = id end
    return sortie
end

-- ── État d'un personnage ──────────────────────────────────────────────────────

--- Garde-robe vide. `possede` est un ENSEMBLE (id → true) et non une liste :
--- l'appartenance se teste en O(1) et un doublon devient impossible.
---@return table
function Vestiaire.Nouvelle()
    return { possede = {}, porte = {} }
end

--- Garde-robe d'un personnage neuf : la tenue offerte, possédée ET portée.
---@param famille string
---@param genre string
---@return table
function Vestiaire.Initiale(famille, genre)
    local sortie = Vestiaire.Nouvelle()
    for slot, id in pairs(Vestiaire.TenueDepart(famille, genre)) do
        sortie.possede[id] = true
        sortie.porte[slot] = id
    end
    return sortie
end

--- Copie défensive. Toutes les opérations rendent une table NEUVE : une
--- opération refusée doit laisser l'état d'origine intact, et une mutation en
--- place l'aurait déjà modifié quand la vérification suivante échoue.
local function copier(garde_robe)
    local neuve = { possede = {}, porte = {} }
    for id in pairs(garde_robe.possede or {}) do neuve.possede[id] = true end
    for slot, id in pairs(garde_robe.porte or {}) do neuve.porte[slot] = id end
    return neuve
end

--- Normalise une garde-robe venue de la base ou du disque.
--- Une valeur absente ou mal formée redonne une garde-robe vide plutôt que nil :
--- l'appelant n'a pas à tester, et un état corrompu ne se propage pas.
---@param brut table|nil
---@return table
function Vestiaire.Charger(brut)
    local sortie = Vestiaire.Nouvelle()
    if (type(brut) ~= "table") then return sortie end

    if (type(brut.possede) == "table") then
        for cle, valeur in pairs(brut.possede) do
            -- Deux formes acceptées : l'ensemble { id = true } et la liste
            -- { id1, id2 }. La base rend l'une ou l'autre selon que la valeur a
            -- traversé un encodage JSON, qui change un ensemble en objet.
            if (valeur == true and type(cle) == "string") then
                sortie.possede[cle] = true
            elseif (type(valeur) == "string") then
                sortie.possede[valeur] = true
            end
        end
    end

    if (type(brut.porte) == "table") then
        for slot, id in pairs(brut.porte) do
            if (type(slot) == "string" and type(id) == "string") then
                sortie.porte[slot] = id
            end
        end
    end

    return sortie
end

-- ── Achat ─────────────────────────────────────────────────────────────────────

--- Achète une pièce.
---@param garde_robe table
---@param credits integer
---@param piece_id string
---@param famille string   famille du corps, pour refuser une pièce incompatible
---@param genre string
---@return table|nil garde_robe
---@return integer|string credits restants, ou la raison du refus
function Vestiaire.Acheter(garde_robe, credits, piece_id, famille, genre)
    local Modular = catalogue()

    if (type(garde_robe) ~= "table") then return nil, "garde-robe absente" end
    if (type(credits) ~= "number") then return nil, "credits absents" end

    local piece = Modular.PIECES[piece_id]
    if (not piece) then return nil, "piece inconnue" end
    if (not Vestiaire.EstVendable(piece)) then return nil, "piece hors boutique" end

    -- La famille et le genre viennent du SERVEUR, jamais du client : sans cette
    -- vérification un client modifié achèterait une pièce d'une autre
    -- morphologie et sortirait avec un personnage disloqué.
    if (piece.famille ~= famille) then return nil, "morphologie incompatible" end
    if (piece.genre ~= genre and piece.genre ~= "*") then return nil, "genre incompatible" end

    if (garde_robe.possede[piece_id]) then return nil, "deja possede" end

    local prix = Vestiaire.Prix(piece)
    if (not prix) then return nil, "piece sans prix" end
    if (credits < prix) then return nil, "credits insuffisants" end

    local neuve = copier(garde_robe)
    neuve.possede[piece_id] = true

    return neuve, credits - prix
end

-- ── Port ──────────────────────────────────────────────────────────────────────

--- Équipe une pièce, ou vide un slot quand `piece_id` est nil.
---
--- Une pièce non possédée est REFUSÉE : c'est le seul contrôle qui empêche un
--- client modifié de porter tout le catalogue sans payer.
---@param garde_robe table
---@param slot string
---@param piece_id string|nil
---@param famille string
---@param genre string
---@return table|nil garde_robe
---@return string|nil raison
function Vestiaire.Porter(garde_robe, slot, piece_id, famille, genre)
    local Modular = catalogue()

    if (type(garde_robe) ~= "table") then return nil, "garde-robe absente" end

    local slot_connu = false
    for _, s in ipairs(Modular.SLOTS) do
        if (s == slot) then slot_connu = true break end
    end
    if (not slot_connu) then return nil, "slot inconnu" end

    local neuve = copier(garde_robe)

    -- Retirer : le slot redevient vide, et l'apparence de création reparaît
    -- dessous — c'est ainsi qu'on retrouve ses cheveux en ôtant son casque.
    if (piece_id == nil) then
        neuve.porte[slot] = nil
        return neuve, nil
    end

    local piece = Modular.PIECES[piece_id]
    if (not piece) then return nil, "piece inconnue" end
    if (piece.slot ~= slot) then return nil, "piece d un autre slot" end
    if (piece.famille ~= famille) then return nil, "morphologie incompatible" end
    if (piece.genre ~= genre and piece.genre ~= "*") then return nil, "genre incompatible" end
    if (not garde_robe.possede[piece_id]) then return nil, "piece non possedee" end

    neuve.porte[slot] = piece_id
    return neuve, nil
end

--- Ce qu'il faut passer à `Builder.Habiller` : l'apparence figée à la création,
--- recouverte par ce que le joueur porte.
---
--- L'ordre compte, et c'est tout le mécanisme. Les deux tables emploient les
--- mêmes slots : un casque doit chasser la coiffure du slot `tete`, jamais
--- l'inverse. Retirer le casque rend le slot à la coiffure, sans rien stocker.
---@param apparence table|nil  choix de création (visage, coiffure)
---@param garde_robe table|nil
---@return table
function Vestiaire.Tenue(apparence, garde_robe)
    local sortie = {}
    if (type(apparence) == "table") then
        for slot, id in pairs(apparence) do sortie[slot] = id end
    end
    if (type(garde_robe) == "table" and type(garde_robe.porte) == "table") then
        for slot, id in pairs(garde_robe.porte) do sortie[slot] = id end
    end
    return sortie
end

return Vestiaire
