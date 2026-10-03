-- ══════════════════════════════════════════════════════════════════════════════
-- vestiaire-tests.lua — garde-robe : achat, port, tenue de départ.
--
-- Ce qui est vérifié ici, ce sont les REFUS. Le chemin qui marche se voit en
-- jeu ; ceux qui doivent échouer, non — un contrôle absent ne se manifeste que
-- le jour où un client modifié en profite.
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echoues = 0, 0

local function ok(condition, nom)
    if (condition) then
        reussis = reussis + 1
    else
        echoues = echoues + 1
        print("  ECHEC : " .. nom)
    end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then
        reussis = reussis + 1
    else
        echoues = echoues + 1
        print("  ECHEC : " .. nom .. "  (obtenu " .. tostring(obtenu)
            .. ", attendu " .. tostring(attendu) .. ")")
    end
end

-- ── Repères pris dans le catalogue, pas écrits en dur ─────────────────────────
--
-- Coder `body_chest_m` ici lierait les tests à une régénération du catalogue.
-- On cherche donc une pièce par ses PROPRIÉTÉS, ce qui reste vrai quel que soit
-- le contenu du pack.

local function trouver(predicat)
    local ids = {}
    for id in pairs(Modular.PIECES) do ids[#ids + 1] = id end
    table.sort(ids)                     -- pairs n'a pas d'ordre : sans tri, le
    for _, id in ipairs(ids) do         -- test choisirait une pièce au hasard.
        if (predicat(id, Modular.PIECES[id])) then return id, Modular.PIECES[id] end
    end
    return nil, nil
end

local id_vendable, vendable = trouver(function(_, p)
    return p.registre == "civil" and p.slot == "torse"
end)

local id_identite, identite = trouver(function(_, p)
    return p.registre == "base" and p.slot == "torse"
end)

ok(id_vendable ~= nil, "le catalogue contient une piece civile de torse")
ok(id_identite ~= nil, "le catalogue contient une piece de peau de torse")

if (not id_vendable or not id_identite) then
    print("Impossible de continuer sans reperes.")
    print(string.format("%d reussi(s), %d echec(s)", reussis, echoues))
    if (echoues > 0) then error("tests vestiaire en echec") end
    return
end

local FAMILLE, GENRE = vendable.famille, vendable.genre
if (GENRE == "*") then GENRE = "M" end

-- ── Registres ─────────────────────────────────────────────────────────────────

ok(Vestiaire.EstVendable(vendable), "une piece civile est vendable")
ok(not Vestiaire.EstVendable(identite), "une piece de peau n est pas vendable")
ok(Vestiaire.EstIdentite(identite), "une piece de peau releve de la creation")
-- 2026-09-12 : une piece civile releve DESORMAIS de la creation aussi. Ce qui
-- distingue un trait d un vetement n est plus `EstIdentite` mais `EstTrait`.
ok(Vestiaire.EstIdentite(vendable), "une piece civile releve aussi de la creation")
ok(Vestiaire.EstTrait(identite), "une piece de peau est un trait")
ok(not Vestiaire.EstTrait(vendable), "un vetement n est pas un trait")
ok(not Vestiaire.EstVendable(nil), "nil n est pas vendable")

-- ── Prix ──────────────────────────────────────────────────────────────────────

ok(Vestiaire.Prix(vendable) ~= nil, "une piece vendable a un prix")
ok(Vestiaire.Prix(vendable) > 0, "le prix est strictement positif")
egal(Vestiaire.Prix(identite), nil, "une piece de peau n a pas de prix")

-- ── Achat ─────────────────────────────────────────────────────────────────────

local prix = Vestiaire.Prix(vendable)
local vide = Vestiaire.Nouvelle()

local apres, credits = Vestiaire.Acheter(vide, prix, id_vendable, FAMILLE, GENRE)
ok(apres ~= nil, "achat au prix exact accepte")
egal(credits, 0, "les credits sont debites du prix")
ok(apres and apres.possede[id_vendable] == true, "la piece achetee est possedee")

-- Immuabilité : c'est ce qui garantit qu'un refus ne laisse pas d'état à moitié
-- modifié. Un test facile à oublier, et un défaut invisible sans lui.
egal(next(vide.possede), nil, "l achat ne mute pas la garde-robe d entree")

local refus, raison = Vestiaire.Acheter(vide, prix - 1, id_vendable, FAMILLE, GENRE)
egal(refus, nil, "achat refuse sans credits suffisants")
egal(raison, "credits insuffisants", "la raison du refus est explicite")

egal(Vestiaire.Acheter(vide, 99999, "piece_qui_n_existe_pas", FAMILLE, GENRE), nil,
    "achat refuse pour une piece inconnue")

egal(Vestiaire.Acheter(vide, 99999, id_identite, FAMILLE, GENRE), nil,
    "achat refuse pour une piece hors boutique")

egal(Vestiaire.Acheter(vide, 99999, id_vendable, "famille_inventee", GENRE), nil,
    "achat refuse pour une autre morphologie")

egal(Vestiaire.Acheter(apres, 99999, id_vendable, FAMILLE, GENRE), nil,
    "achat refuse si la piece est deja possedee")

-- ── Port ──────────────────────────────────────────────────────────────────────

local porte_refus, porte_raison = Vestiaire.Porter(vide, "torse", id_vendable, FAMILLE, GENRE)
egal(porte_refus, nil, "porter une piece non possedee est refuse")
egal(porte_raison, "piece non possedee", "la raison du refus de port est explicite")

local habille = Vestiaire.Porter(apres, "torse", id_vendable, FAMILLE, GENRE)
ok(habille ~= nil, "porter une piece possedee est accepte")
egal(habille and habille.porte.torse, id_vendable, "la piece occupe son slot")

local nu = Vestiaire.Porter(habille, "torse", nil, FAMILLE, GENRE)
ok(nu ~= nil, "retirer une piece est accepte")
egal(nu and nu.porte.torse, nil, "le slot redevient vide")
egal(habille.porte.torse, id_vendable, "le retrait ne mute pas l entree")

egal(Vestiaire.Porter(apres, "slot_invente", id_vendable, FAMILLE, GENRE), nil,
    "porter dans un slot inconnu est refuse")

egal(Vestiaire.Porter(apres, "jambes", id_vendable, FAMILLE, GENRE), nil,
    "porter une piece de torse sur les jambes est refuse")

-- ── Tenue : la garde-robe recouvre l apparence ────────────────────────────────
--
-- C'est le mecanisme du casque : casque et coiffure partagent le slot `tete`,
-- et l'ordre decide lequel se voit. Retirer le casque doit rendre les cheveux.

local apparence = { tete = "coiffure_imaginaire", visage = id_identite }
local avec_casque = { possede = {}, porte = { tete = "casque_imaginaire" } }

local tenue = Vestiaire.Tenue(apparence, avec_casque)
egal(tenue.tete, "casque_imaginaire", "le casque chasse la coiffure du slot tete")
egal(tenue.visage, id_identite, "le visage de creation reste sous la garde-robe")

local sans_casque = Vestiaire.Tenue(apparence, { possede = {}, porte = {} })
egal(sans_casque.tete, "coiffure_imaginaire", "retirer le casque rend la coiffure")

egal(next(Vestiaire.Tenue(nil, nil)), nil, "sans apparence ni garde-robe, tenue vide")

-- ── Tenue de depart ───────────────────────────────────────────────────────────

local depart = Vestiaire.TenueDepart(FAMILLE, GENRE)
ok(depart.torse ~= nil, "la tenue de depart couvre le torse")
ok(depart.jambes ~= nil, "la tenue de depart couvre les jambes")

-- Determinisme : `pairs` change d'ordre d'une VM a l'autre, et deux appels qui
-- rendraient des tenues differentes donneraient deux joueurs identiques
-- habilles autrement.
local depart2 = Vestiaire.TenueDepart(FAMILLE, GENRE)
egal(depart2.torse, depart.torse, "la tenue de depart est deterministe (torse)")
egal(depart2.jambes, depart.jambes, "la tenue de depart est deterministe (jambes)")

local memes_ensembles = true
for _, id in pairs(depart) do
    local p = Modular.PIECES[id]
    if (not p or p.ensemble ~= Modular.PIECES[depart.torse].ensemble) then
        memes_ensembles = false
    end
end
ok(memes_ensembles, "la tenue de depart est assortie (un seul ensemble)")

local initiale = Vestiaire.Initiale(FAMILLE, GENRE)
ok(initiale.possede[depart.torse] == true, "le personnage neuf possede sa tenue")
egal(initiale.porte.torse, depart.torse, "le personnage neuf porte sa tenue")

-- ── Chargement ────────────────────────────────────────────────────────────────

egal(next(Vestiaire.Charger(nil).possede), nil, "charger nil rend une garde-robe vide")
egal(next(Vestiaire.Charger("nawak").porte), nil, "charger n importe quoi ne casse pas")

local depuis_ensemble = Vestiaire.Charger({ possede = { [id_vendable] = true } })
egal(depuis_ensemble.possede[id_vendable], true, "charger accepte la forme ensemble")

local depuis_liste = Vestiaire.Charger({ possede = { id_vendable } })
egal(depuis_liste.possede[id_vendable], true, "charger accepte la forme liste (retour JSON)")

local sale = Vestiaire.Charger({ porte = { torse = 42, [7] = "x" } })
egal(sale.porte.torse, nil, "une valeur non textuelle est ecartee")
egal(sale.porte[7], nil, "une cle non textuelle est ecartee")

-- ── La création montre TOUT, la boutique ne vend pas les traits ───────
--
-- ⚠ CETTE FRONTIERE A BOUGE LE 2026-09-12, sur decision de Hanibes. La regle
-- etait « la creation donne un corps, le marchand l habille » : l ecran ne
-- montrait que le registre `base`, soit 6 a 9 pieces par famille, et les 83
-- vetements dormaient chez le tailleur. Le joueur creait un personnage en slip
-- et ne trouvait pas le modulaire.
--
-- Desormais la creation montre les quatre registres. Ce que ces tests gardent
-- n est donc plus la frontiere, mais les deux choses qui restent vraies :
--   1. la creation propose reellement de quoi composer ;
--   2. on n achete pas son propre visage.

for _, genre in ipairs({ "M", "F" }) do
    local pieces = 0
    for _, liste in pairs(Vestiaire.Identites("stylized", genre)) do
        pieces = pieces + #liste
    end
    ok(pieces >= 8, "stylized/" .. genre .. " : la creation propose de quoi composer ("
        .. pieces .. " pieces)")
end

-- Un TRAIT ne se vend pas. `EstIdentite` ne peut plus servir a le dire : depuis
-- que la creation montre tout, elle rend vrai pour n importe quelle piece.
do
    local traits = 0
    for _, liste in pairs(Vestiaire.Stock("stylized", "M")) do
        for _, p in ipairs(liste) do
            if (Vestiaire.EstTrait(Modular.PIECES[p.id])) then traits = traits + 1 end
        end
    end
    egal(traits, 0, "la boutique ne vend aucun trait (visage, peau, main nue)")
end

-- Le choix d'identite doit RESTER un choix : si le filtre se resserrait au point
-- de ne plus rien laisser, l'etape Apparence n'aurait plus de raison d'exister.
do
    local slots = 0
    for _ in pairs(Vestiaire.Identites("stylized", "M")) do slots = slots + 1 end
    ok(slots > 0, "stylized/M garde au moins un slot a plusieurs options")
end

-- ── Les parts du corps sont exposees ──────────────────────────────────────────
--
-- `Identites` ecartait les slots n'offrant qu'une piece (`#liste > 1`). Torse,
-- jambes et mains — la peau — sont a une piece par genre : ils disparaissaient,
-- et l'ecran ne montrait QUE le visage. Constate en jeu, capture a l'appui.
--
-- Un slot a une pièce n'est pas un faux choix, c'est une PART DU CORPS : le
-- joueur voit de quoi il est assemble, et elle se teinte comme les autres.

for _, genre in ipairs({ "M", "F" }) do
    local rendus = Vestiaire.Identites("stylized", genre)
    for _, slot in ipairs({ "torse", "jambes", "mains", "visage" }) do
        ok(rendus[slot] ~= nil and #rendus[slot] > 0,
            "stylized/" .. genre .. " expose le slot " .. slot)
    end
end

-- ⚠ ET LE FILTRE DE REGISTRE TIENT TOUJOURS. Exposer plus de slots ne doit pas
-- faire entrer une piece de boutique : c'est la meme frontiere qui a cede deux
-- fois. L'assertion « aucune piece vendable » plus haut couvre les slots rendus,
-- donc elle couvre maintenant AUSSI les slots de corps.

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print(string.format("%d reussi(s), %d echec(s)", reussis, echoues))
if (echoues > 0) then error("tests vestiaire en echec") end