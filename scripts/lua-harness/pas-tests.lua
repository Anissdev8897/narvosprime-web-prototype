-- ═══════════════════════════════════════════════════════════════════════════════
-- pas-tests.lua — de la surface touchée à une clé d'échantillon.
--
-- Ce que ces tests protègent : le SILENCE. Un pas qui ne joue pas ne lève
-- aucune erreur — ni côté Lua, ni côté moteur : `Sound()` avec une clé inconnue
-- ne fait rien. C'est le mode d'échec le plus discret du projet, et il touche
-- quelque chose que le joueur entend à chaque seconde de jeu.
--
-- La question posée ici n'est donc pas « la fonction rend-elle une chaîne »
-- mais « CHAQUE chemin possible mène-t-il à une clé qui existe dans le pack ».
-- ═══════════════════════════════════════════════════════════════════════════════

local reussis, echoues = 0, 0

local function ok(condition, quoi)
    if (condition) then
        reussis = reussis + 1
    else
        echoues = echoues + 1
        print("  ECHEC : " .. quoi)
    end
end

local function eq(a, b, quoi)
    if (a == b) then
        reussis = reussis + 1
    else
        echoues = echoues + 1
        print(string.format("  ECHEC : %s  (obtenu %s, attendu %s)",
            quoi, tostring(a), tostring(b)))
    end
end

Audio.Configurer(Sons, Pas)

-- ── 1. Le catalogue généré n'est pas vide, et il est cohérent ────────────────
print("[1. le catalogue genere]")

ok(#Pas.CATEGORIES > 0, "au moins une categorie")
ok(#Pas.CATEGORIES >= 20, "les 25 categories du pack sont la (obtenu " .. #Pas.CATEGORIES .. ")")

local total_cles = 0
local vues = {}
for _, cat in ipairs(Pas.CATEGORIES) do
    local seaux = Pas.PAR_CATEGORIE[cat]
    ok(type(seaux) == "table", "categorie " .. cat .. " a ses seaux")
    local n = 0
    for _, seau in ipairs({ "marche", "course", "chute", "autre" }) do
        ok(type(seaux[seau]) == "table", cat .. "." .. seau .. " est une liste")
        for _, cle in ipairs(seaux[seau]) do
            -- Une clé vue deux fois viendrait d'un dossier lu deux fois : la
            -- fusion Water/Water_stereofix est le seul cas où ça pourrait
            -- arriver, et elle doit fusionner sans dupliquer.
            ok(vues[cle] == nil, "cle unique : " .. cle)
            vues[cle] = cat
            n = n + 1
            total_cles = total_cles + 1
        end
    end
    ok(n > 0, "categorie " .. cat .. " porte au moins un echantillon")
end
ok(total_cles >= 400, "le pack porte ses ~490 echantillons (obtenu " .. total_cles .. ")")

-- ── 2. Toute catégorie ATTEIGNABLE mène à une clé ────────────────────────────
-- C'est le test qui compte. Trois sources nomment une catégorie :
-- `PAS_PAR_SURFACE`, les règles `PAS_REGLES`, et `PAS_DEFAUT`. Chacune doit
-- pointer vers une catégorie que le pack fournit, pour les trois allures.
print("[2. toute categorie atteignable mene a une cle]")

local function ToutesAllures(cat, origine)
    for _, allure in ipairs({ "marche", "course", "chute" }) do
        local cle, seau = Audio.ChoisirPas(cat, allure, 0)
        ok(type(cle) == "string" and cle ~= "",
            origine .. " -> " .. cat .. " / " .. allure .. " rend une cle")
        ok(seau ~= nil, origine .. " -> " .. cat .. " / " .. allure .. " nomme son seau")
    end
end

for surface, cat in pairs(Sons.PAS_PAR_SURFACE) do
    ok(Pas.PAR_CATEGORIE[cat] ~= nil,
        "SurfaceType " .. surface .. " -> categorie '" .. cat .. "' existe dans le pack")
    ToutesAllures(cat, "SurfaceType " .. surface)
end

for _, regle in ipairs(Sons.PAS_REGLES) do
    ok(Pas.PAR_CATEGORIE[regle.categorie] ~= nil,
        "regle -> categorie '" .. regle.categorie .. "' existe dans le pack")
    ToutesAllures(regle.categorie, "regle")
end

ok(Pas.PAR_CATEGORIE[Sons.PAS_DEFAUT] ~= nil,
    "PAS_DEFAUT ('" .. tostring(Sons.PAS_DEFAUT) .. "') existe dans le pack")
ToutesAllures(Sons.PAS_DEFAUT, "PAS_DEFAUT")

-- ── 3. Le repli par allure — mesuré, pas supposé ─────────────────────────────
-- Cinq categories n'ont AUCUN echantillon `marche` dans le pack. Sans repli,
-- marcher dans l'eau serait silencieux. On le verifie sur les cas reels.
print("[3. le repli par allure]")

for _, cat in ipairs({ "water", "brush", "leaves", "glass", "deckwood" }) do
    if (Pas.PAR_CATEGORIE[cat]) then
        eq(#Pas.PAR_CATEGORIE[cat].marche, 0, cat .. " n'a bien aucun echantillon 'marche'")
        local cle, seau = Audio.ChoisirPas(cat, "marche", 0.5)
        ok(type(cle) == "string", cat .. " en marche rend quand meme une cle (repli)")
        ok(seau ~= "marche", cat .. " en marche a bien change de seau (" .. tostring(seau) .. ")")
    end
end

-- ── 4. La classification : trois étages, dans le bon ordre ───────────────────
print("[4. la classification]")

-- Étage 1 : le SurfaceType gagne quand il est concluant.
eq(Audio.CategorieImpact(3, "SM_Beton_Sol"), "grass",
    "SurfaceType.Grass (3) l'emporte sur un nom qui dit beton")
eq(Audio.CategorieImpact(2, "SM_Herbe"), "concrete",
    "SurfaceType.Concrete (2) l'emporte sur un nom qui dit herbe")

-- ⚠ Le piege : `Default` vaut 0, et 0 est une valeur legitime. Elle ne doit PAS
-- passer pour une reponse, sinon l'etage 2 n'est jamais atteint.
eq(Audio.CategorieDeSurface(0), nil, "SurfaceType.Default (0) n'est PAS une reponse")
eq(Audio.CategorieDeSurface(21), nil, "SurfaceType.Air (21) n'est pas un sol")
eq(Audio.CategorieDeSurface(12), nil, "SurfaceType.Flesh (12) n'est pas un sol")
eq(Audio.CategorieDeSurface(99), nil, "un SurfaceType inconnu n'invente rien")
eq(Audio.CategorieDeSurface(nil), nil, "un SurfaceType absent n'invente rien")

-- Étage 2 : le nom, quand la surface ne dit rien.
eq(Audio.CategorieImpact(0, "SM_Concrete_Floor_01"), "concrete",
    "sans surface, le nom du composant decide")
eq(Audio.CategorieImpact(0, "", "Actor_Snow_Field"), "snow",
    "un nom vide passe au suivant")
eq(Audio.CategorieImpact(0, "SM_Rien_De_Connu"), Sons.PAS_DEFAUT,
    "aucun nom ne matche : le defaut")

-- Étage 3 : plusieurs noms, le premier CONCLUANT gagne — pas le premier tout court.
eq(Audio.CategorieImpact(0, "SM_Machin", "Zone_Gravel_02"), "gravel",
    "le premier nom concluant gagne, pas le premier nom")

-- ── 5. Le tirage est déterministe et borné ───────────────────────────────────
print("[5. le tirage]")

local seaux = Pas.PAR_CATEGORIE["concrete"]
local n = #seaux.marche
ok(n > 0, "concrete a des echantillons de marche")
eq(Audio.ChoisirPas("concrete", "marche", 0), seaux.marche[1], "tirage 0 -> premier")
eq(Audio.ChoisirPas("concrete", "marche", 0.999999), seaux.marche[n], "tirage ~1 -> dernier")
-- Un tirage hors bornes ne doit pas indexer hors de la liste : c'est le seul
-- endroit ou une erreur Lua serait possible, et elle tuerait le timer client.
ok(Audio.ChoisirPas("concrete", "marche", -1) ~= nil, "tirage negatif reste dans la liste")
ok(Audio.ChoisirPas("concrete", "marche", 5) ~= nil, "tirage > 1 reste dans la liste")
ok(Audio.ChoisirPas("concrete", "marche", nil) ~= nil, "tirage nil reste dans la liste")

-- ── 6. Les refus honnêtes ────────────────────────────────────────────────────
print("[6. les refus]")

eq(Audio.ChoisirPas("categorie_qui_n_existe_pas", "marche", 0), nil,
    "une categorie inconnue rend nil, elle n'invente pas un pas")
eq(Audio.ChoisirPas(nil, "marche", 0), nil, "une categorie nil rend nil")

-- Sans catalogue de pas, la classification marche toujours mais le choix non :
-- c'est la difference entre « je ne sais pas quoi jouer » et « je joue faux ».
Audio.Configurer(Sons, nil)
eq(Audio.ChoisirPas("concrete", "marche", 0), nil, "sans catalogue Pas : nil, pas un pas au hasard")
eq(Audio.CategorieImpact(2, "x"), "concrete", "sans catalogue Pas, la classification marche encore")
Audio.Configurer(Sons, Pas)

-- ── Bilan ────────────────────────────────────────────────────────────────────
print(string.format("%d reussis, %d echec(s)", reussis, echoues))
if (echoues > 0) then error("pas-tests : " .. echoues .. " echec(s)") end