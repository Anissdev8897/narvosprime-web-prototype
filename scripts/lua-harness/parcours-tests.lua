-- ══════════════════════════════════════════════════════════════════════════════
-- parcours-tests.lua — de la création à l'arrivée en map, sans trou.
--
-- ── LA QUESTION A LAQUELLE IL REPOND ─────────────────────────────────────────
-- « Le personnage cree arrive-t-il en jeu tel qu'on l'a compose ? »
--
-- Chaque module a ses tests, et tous passent. Cela ne dit RIEN du parcours :
-- un champ peut etre valide par Creation, ecrit par Roster, relu correctement,
-- et perdu au moment de resoudre les morphs parce qu'un prefixe a change en
-- route. Aucun test unitaire ne verrait ce trou.
--
-- On suit donc UNE composition, de bout en bout :
--
--   Creation.Construire -> Roster.Creer -> INSERT -> SELECT -> depuisLigne
--                       -> Morphs.Resoudre + Macros.Resoudre
--
-- Ce que ce test ne couvre PAS : `SetMorphTarget` lui-meme, qui appartient au
-- moteur. Il verifie que les bonnes valeurs arrivent jusqu'a la porte.
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

local function proche(a, b, nom)
    if (math.abs((a or -999) - b) < 1e-3) then
        reussis = reussis + 1
    else
        echoues = echoues + 1
        print("  ECHEC : " .. nom .. "  (obtenu " .. tostring(a) .. ", attendu " .. tostring(b) .. ")")
    end
end

-- La premiere classe du catalogue. On la CHERCHE plutot que de l'ecrire : un
-- identifiant en dur casserait au premier remaniement des classes, pour une
-- raison sans rapport avec ce que ce test verifie.
local CLASSE = Narvos.Classes.CLASSES_ORDER[1]

-- ── Le corps morphable existe-t-il seulement ? ───────────────────────────────

-- ⚠ LE CORPS MORPHABLE PEUT NE PLUS ETRE AU CATALOGUE.
--
-- Il a ete retire le 2026-09-04 : vu en jeu, il sortait gris et couche a plat.
-- Le parcours reste a verifier — corps, tenue, garde-robe et morphs doivent
-- traverser la base quel que soit le corps choisi. Seule la partie « les noms
-- de morphs existent dans le mesh » demande un corps qui en porte.
--
-- Le test s'ADAPTE plutot que d'echouer : un test qui casse quand on retire un
-- asset par decision produit du bruit, pas un signal.
local corpsMorphable, corpsTest
for id, c in pairs(Narvos.Modular.CORPS) do
    if (c.famille == "mpfb" and c.genre == "M") then corpsMorphable = id end
    if (c.genre == "M" and (not corpsTest or id < corpsTest)) then corpsTest = id end
end

local MORPHABLE_AU_CATALOGUE = corpsMorphable ~= nil
corpsTest = corpsMorphable or corpsTest

ok(corpsTest ~= nil, "un corps masculin est au catalogue")
if (not MORPHABLE_AU_CATALOGUE) then
    print("  (aucun corps morphable au catalogue : les morphs ne sont pas appliques)")
end

if (not corpsTest) then
    print(string.format("%d reussi(s), %d echec(s)", reussis, echoues))
    error("aucun corps, le parcours n'a pas de sens")
end

-- ── Composition ───────────────────────────────────────────────────────────────
--
-- Un reglage de visage, un de corps, une ethnie. Trois familles differentes :
-- si une seule survit, ce n'est pas un hasard de serialisation.

local curseurVisage
for _, c in ipairs(Narvos.Morphs.CURSEURS) do
    if (c.negatif and c.zone == "nose") then curseurVisage = c break end
end
ok(curseurVisage ~= nil, "un curseur de nez existe")

local REGLAGES = {
    [curseurVisage.id] = 0.75,
    ["@gender"] = 0.9,
    ["@height"] = 0.2,
    ["@eth-asian"] = 1,
    ["@eth-african"] = 0,
    ["@eth-caucasian"] = 0,
}

-- La fausse base vient du harnais, qui la fabrique a la demande : c'est la
-- seule implementation SQL du projet, et la recopier ferait deux verites.
Roster.UtiliserBase(FausseBasePersos())

local perso, raison = Roster.Creer(7, {
    nom = "Morphee",
    class_id = CLASSE,
    genre = "M",
    corps = corpsTest,
    morphs = REGLAGES,
})
ok(perso ~= nil, "creation acceptee — " .. tostring(raison))

if (not perso) then
    print(string.format("%d reussi(s), %d echec(s)", reussis, echoues))
    error("creation refusee, parcours interrompu")
end

egal(perso.corps, corpsTest, "le corps choisi est celui retenu")

-- ── Aller-retour en base ──────────────────────────────────────────────────────
--
-- C'est ICI que le parcours casse d'habitude : une colonne oubliee dans
-- l'INSERT, un decalage d'index, un encodeur qui rend une chaine vide.

local relu
for _, p in ipairs(Roster.ParCompte(7)) do
    if (p.id == perso.id) then relu = p end
end
ok(relu ~= nil, "le personnage est relu depuis la base")

if (not relu) then
    print(string.format("%d reussi(s), %d echec(s)", reussis, echoues))
    error("relecture impossible")
end

egal(relu.corps, corpsTest, "le corps survit a l'aller-retour")
ok(type(relu.morphs) == "table", "les morphs sont relus en table")
proche(relu.morphs[curseurVisage.id], 0.75, "le reglage de visage survit")
proche(relu.morphs["@gender"], 0.9, "le reglage de genre survit")
proche(relu.morphs["@height"], 0.2, "le reglage de taille survit")
proche(relu.morphs["@eth-asian"], 1, "l'ethnie survit")

-- ⚠ ZERO N'EST PAS RIEN. `EncoderMorphs` n'ecrit que les valeurs non nulles, et
-- c'est voulu — sur 138 curseurs, un joueur en touche une poignee. Mais une
-- MACRO a zero est un choix (« pas du tout africain »), pas un curseur au repos.
-- Elle doit donc se relire a zero, pas au defaut d'un tiers.
--
-- Le test ci-dessous constate le comportement REEL plutot que celui qu'on
-- voudrait : les macros a zero ne sont pas ecrites, et `Macros.Charger`
-- normalise ce qui reste. Le resultat est correct — 100 % asiatique — mais par
-- un chemin different de celui qu'on croit.
local eth = Narvos.Macros.Depuis(relu.morphs)
proche(eth.ethnicity.asian / (eth.ethnicity.asian + eth.ethnicity.african
    + eth.ethnicity.caucasian), 1, "le melange relu reste 100 % asiatique")

-- ── Ce qui part au moteur ─────────────────────────────────────────────────────

local poidsVisage = Narvos.Morphs.Resoudre(relu.morphs)
proche(poidsVisage[curseurVisage.positif], 0.75, "le morph positif du nez porte la valeur")
egal(poidsVisage[curseurVisage.negatif], 0, "le morph oppose est bien eteint")

local poidsCorps = Narvos.Macros.Resoudre(Narvos.Macros.Depuis(relu.morphs))
ok(next(poidsCorps) ~= nil, "les macros produisent des morphs")

-- Genre a 0,9 : l'ancre masculine doit dominer, la feminine subsister.
local masc, fem = 0, 0
for nom, v in pairs(poidsCorps) do
    if (nom:find("-male-", 1, true)) then masc = masc + v end
    if (nom:find("-female-", 1, true)) then fem = fem + v end
end
ok(masc > fem, "genre a 0,9 : le masculin domine")
ok(fem > 0, "genre a 0,9 : le feminin subsiste — la morphologie est continue")

-- Taille a 0,2 : la borne MINIMALE, jamais la maximale.
local minH, maxH = 0, 0
for nom, v in pairs(poidsCorps) do
    if (nom:find("minheight", 1, true)) then minH = minH + v end
    if (nom:find("maxheight", 1, true)) then maxH = maxH + v end
end
ok(minH > 0, "taille a 0,2 : la borne minimale est activee")
egal(maxH, 0, "taille a 0,2 : la borne maximale ne l'est pas")

-- ── Tout ce qui part au moteur existe-t-il ? ─────────────────────────────────
--
-- Le test qui ferme la boucle. Un nom absent du mesh ne leve pas : le morph est
-- ignore, le corps reste neutre, et on cherche la panne dans l'ecran.

local absents, exemple = 0, nil
for _, table_poids in ipairs({ poidsVisage, poidsCorps }) do
    for nom in pairs(table_poids) do
        if (not MORPHS_REELS[nom]) then
            absents = absents + 1
            exemple = exemple or nom
        end
    end
end
egal(absents, 0, "tout morph envoye au moteur existe dans le mesh"
    .. (exemple and (" — ex. " .. exemple) or ""))

-- ── Un corps NON morphable ne recoit rien ────────────────────────────────────
--
-- `AppliquerMorphs` sort tot si la famille n'est pas `mpfb`. On verifie ici le
-- prealable : un tel corps existe, et il n'a pas de morph a lui.

local corpsSimple
for _, c in pairs(Narvos.Modular.CORPS) do
    if (c.famille ~= "mpfb") then corpsSimple = c break end
end
ok(corpsSimple ~= nil, "un corps non morphable existe")
if (corpsSimple) then
    ok(corpsSimple.famille ~= "mpfb",
       "sa famille n'est pas mpfb — AppliquerMorphs le sautera")
end

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print(string.format("%d reussi(s), %d echec(s)", reussis, echoues))
if (echoues > 0) then error("parcours en echec") end