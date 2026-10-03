-- ══════════════════════════════════════════════════════════════════════════════
-- morphs-tests.lua — resolution des curseurs de morphologie.
--
-- Ce qui compte ici, c'est la REMISE A ZERO de l'extremite opposee. Les deux
-- morphs d'un axe tirent les memes sommets en sens contraire : les laisser tous
-- deux actifs les annule partiellement, et le curseur semble ne plus repondre
-- passe un certain point. C'est un defaut qu'on ne voit pas en lisant le code.
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

-- ── Invariants du catalogue ───────────────────────────────────────────────────

ok(#Morphs.CURSEURS > 0, "le catalogue contient des curseurs")
ok(#Morphs.ZONES > 0, "le catalogue contient des zones")
ok(type(Morphs.MESH) == "string" and Morphs.MESH:find("::"),
   "le mesh porteur est nomme avec son pack")

local zonesConnues = {}
for _, z in ipairs(Morphs.ZONES) do zonesConnues[z.id] = true end

local sansZone, sansPositif, memeMorph = 0, 0, 0
for _, c in ipairs(Morphs.CURSEURS) do
    if (not zonesConnues[c.zone]) then sansZone = sansZone + 1 end
    if (type(c.positif) ~= "string" or c.positif == "") then sansPositif = sansPositif + 1 end
    -- Un curseur dont les deux extremites sont le MEME morph ne bougerait que
    -- dans un sens, et l'autre moitie de la course serait morte.
    if (c.negatif and c.negatif == c.positif) then memeMorph = memeMorph + 1 end
end
egal(sansZone, 0, "chaque curseur appartient a une zone declaree")
egal(sansPositif, 0, "chaque curseur a un morph positif")
egal(memeMorph, 0, "aucun curseur n'a deux fois le meme morph")

-- Les identifiants doivent etre uniques : deux curseurs de meme id rendraient
-- `Morphs.Curseur` ambigu et un reglage en ecraserait un autre.
local vus, doublons = {}, 0
for _, c in ipairs(Morphs.CURSEURS) do
    if (vus[c.id]) then doublons = doublons + 1 end
    vus[c.id] = true
end
egal(doublons, 0, "les identifiants de curseur sont uniques")

-- ── Un curseur de reference, cherche par ses proprietes ───────────────────────
--
-- Coder « nose-hump » ici lierait les tests a une regeneration du catalogue.

local bipolaire
for _, c in ipairs(Morphs.CURSEURS) do
    if (c.negatif) then bipolaire = c break end
end
ok(bipolaire ~= nil, "le catalogue contient un curseur bipolaire")

if (not bipolaire) then
    print(string.format("%d reussi(s), %d echec(s)", reussis, echoues))
    error("impossible de continuer")
end

-- ── Bornage ───────────────────────────────────────────────────────────────────

egal(Morphs.Borner(bipolaire, 2), 1, "au-dela de 1, le curseur est borne a 1")
egal(Morphs.Borner(bipolaire, -2), -1, "un bipolaire descend jusqu'a -1")
egal(Morphs.Borner(bipolaire, "nawak"), 0, "une valeur non numerique vaut 0")
egal(Morphs.Borner(bipolaire, nil), 0, "nil vaut 0")

local unipolaire
for _, c in ipairs(Morphs.CURSEURS) do
    if (not c.negatif) then unipolaire = c break end
end
if (unipolaire) then
    egal(Morphs.Borner(unipolaire, -1), 0,
         "un unipolaire ne descend pas sous zero")
end

-- ── Resolution ────────────────────────────────────────────────────────────────

local milieu = Morphs.Resoudre({})
egal(milieu[bipolaire.negatif], 0, "au repos, l'extremite negative est a zero")
egal(milieu[bipolaire.positif], 0, "au repos, l'extremite positive est a zero")

local droite = Morphs.Resoudre({ [bipolaire.id] = 0.6 })
egal(droite[bipolaire.positif], 0.6, "vers la droite, le morph positif prend la valeur")
egal(droite[bipolaire.negatif], 0, "vers la droite, le morph negatif est REMIS A ZERO")

local gauche = Morphs.Resoudre({ [bipolaire.id] = -0.4 })
-- Le poids est toujours POSITIF : c'est le morph choisi qui porte le sens.
ok(math.abs(gauche[bipolaire.negatif] - 0.4) < 1e-9,
   "vers la gauche, le morph negatif prend la valeur absolue")
egal(gauche[bipolaire.positif], 0, "vers la gauche, le morph positif est REMIS A ZERO")

-- ⚠ LE TEST QUI COMPTE. Traverser le milieu doit eteindre l'ancienne extremite.
-- Sans la remise a zero, les deux resteraient actifs et se contrarieraient.
local apres = Morphs.Resoudre({ [bipolaire.id] = 0.9 })
egal(apres[bipolaire.negatif], 0, "traverser le milieu eteint l'ancienne extremite")

local borne = Morphs.Resoudre({ [bipolaire.id] = 99 })
egal(borne[bipolaire.positif], 1, "la resolution borne aussi")

egal(next(Morphs.Resoudre(nil)), nil, "resoudre nil ne rend rien")
egal(next(Morphs.Resoudre("nawak")), nil, "resoudre n'importe quoi ne rend rien")

-- Un identifiant inconnu est IGNORE, il ne doit pas apparaitre en sortie : le
-- client peut envoyer ce qu'il veut, et `SetMorphTarget` sur un nom invente ne
-- leve pas — le defaut serait donc muet.
local inconnu = Morphs.Resoudre({ ["curseur_qui_n_existe_pas"] = 1 })
egal(inconnu["curseur_qui_n_existe_pas"], nil, "un curseur inconnu n'entre pas dans la sortie")

-- ── Choix de forme ────────────────────────────────────────────────────────────

if (#Morphs.CHOIX > 0) then
    local c = Morphs.CHOIX[1]
    ok(#c.options >= 2, "un choix de forme a au moins deux options")

    local pose = Morphs.Resoudre({ [c.id] = c.options[1].nom })
    egal(pose[c.options[1].morph], 1, "l'option choisie est a 1")
    egal(pose[c.options[2].morph], 0, "les autres options sont a 0")

    -- Exclusivite : sans elle, deux formes se superposeraient.
    local actives = 0
    for _, o in ipairs(c.options) do
        if ((pose[o.morph] or 0) > 0) then actives = actives + 1 end
    end
    egal(actives, 1, "une seule option de forme est active a la fois")

    local aucune = Morphs.Resoudre({})
    local zero = 0
    for _, o in ipairs(c.options) do
        if ((aucune[o.morph] or 0) == 0) then zero = zero + 1 end
    end
    egal(zero, #c.options, "sans choix, aucune forme n'est active")
end

-- ── Recherche ─────────────────────────────────────────────────────────────────

egal(Morphs.Curseur(bipolaire.id).id, bipolaire.id, "un curseur se retrouve par son id")
egal(Morphs.Curseur("inexistant"), nil, "un id inconnu rend nil")
egal(Morphs.Curseur(nil), nil, "nil rend nil")

local zone = Morphs.ParZone(bipolaire.zone)
ok(#zone > 0, "une zone rend ses curseurs")
local tousDeLaZone = true
for _, c in ipairs(zone) do
    if (c.zone ~= bipolaire.zone) then tousDeLaZone = false end
end
ok(tousDeLaZone, "ParZone ne rend que les curseurs de la zone demandee")
egal(#Morphs.ParZone("zone_inexistante"), 0, "une zone inconnue rend une liste vide")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print(string.format("%d reussi(s), %d echec(s)", reussis, echoues))
if (echoues > 0) then error("tests morphs en echec") end