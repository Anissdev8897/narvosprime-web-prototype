-- ══════════════════════════════════════════════════════════════════════════════
-- macros-tests.lua — six curseurs de corps vers les ancres MakeHuman.
--
-- ── LE TEST QUI COMPTE ────────────────────────────────────────────────────────
-- Chaque nom produit est confronte au catalogue REEL, extrait du GLB cuit. Un
-- nom faux ne leve rien : `SetMorphTarget` sur un morph inexistant est ignore en
-- silence, le corps reste neutre, et on cherche la panne dans l'interface.
--
-- C'est exactement le mode d'echec que la version web signalait deja dans son
-- propre commentaire — « les morphs seraient introuvables et le corps resterait
-- neutre, sans erreur ».
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
    if (math.abs((a or 0) - b) < 1e-6) then
        reussis = reussis + 1
    else
        echoues = echoues + 1
        print("  ECHEC : " .. nom .. "  (obtenu " .. tostring(a) .. ", attendu " .. tostring(b) .. ")")
    end
end

-- ── Structure ─────────────────────────────────────────────────────────────────

egal(#Macros.CURSEURS, 5, "cinq curseurs de corps")
egal(#Macros.ETHNIES, 3, "trois ethnies")

local defaut = Macros.Defaut()
for _, c in ipairs(Macros.CURSEURS) do
    ok(defaut[c.id] ~= nil, "le defaut porte " .. c.id)
end
ok(type(defaut.ethnicity) == "table", "le defaut porte un melange d ethnies")

-- ── Chaque nom produit existe-t-il VRAIMENT ? ────────────────────────────────
--
-- MORPHS_REELS est injecte par le harnais depuis le GLB cuit.

local function verifierNoms(reglage, etiquette)
    local poids = Macros.Resoudre(reglage)
    local total, absents, premier = 0, 0, nil
    for nom in pairs(poids) do
        total = total + 1
        if (not MORPHS_REELS[nom]) then
            absents = absents + 1
            premier = premier or nom
        end
    end
    ok(total > 0, etiquette .. " : produit des morphs")
    if (absents > 0) then
        egal(absents, 0, etiquette .. " : " .. absents .. " nom(s) absent(s) du pack, ex. " .. tostring(premier))
    else
        reussis = reussis + 1
    end
    return poids
end

verifierNoms(Macros.Defaut(), "reglage neutre")
verifierNoms({ gender = 1, age = 1, muscle = 1, weight = 1, height = 1,
               ethnicity = { african = 1, asian = 0, caucasian = 0 } }, "tout au maximum")
verifierNoms({ gender = 0, age = 0, muscle = 0, weight = 0, height = 0,
               ethnicity = { african = 0, asian = 0, caucasian = 1 } }, "tout au minimum")
verifierNoms({ gender = 0.37, age = 0.62, muscle = 0.21, weight = 0.88, height = 0.73,
               ethnicity = { african = 2, asian = 1, caucasian = 3 } }, "valeurs quelconques")

-- ── Repartition ───────────────────────────────────────────────────────────────

-- Un genre franc ne doit activer QUE son extremite : a 1, plus rien de feminin.
local masculin = Macros.Resoudre({ gender = 1, age = 0, muscle = 0.5, weight = 0.5, height = 0.5,
                                   ethnicity = { african = 1, asian = 0, caucasian = 0 } })
proche(masculin["african-male-young"], 1, "genre a 1 : l ancre masculine porte tout le poids")
egal(masculin["african-female-young"], nil, "genre a 1 : aucune ancre feminine")

-- A mi-course, le poids se partage. C'est ce partage qui rend la morphologie
-- continue : sans lui on n aurait qu un catalogue de corps discrets.
local milieu = Macros.Resoudre({ gender = 0.5, age = 0, muscle = 0.5, weight = 0.5, height = 0.5,
                                 ethnicity = { african = 1, asian = 0, caucasian = 0 } })
proche(milieu["african-male-young"], 0.5, "genre a 0.5 : moitie masculine")
proche(milieu["african-female-young"], 0.5, "genre a 0.5 : moitie feminine")

-- La somme d une famille vaut 1 : le corps est toujours quelque part, jamais
-- entre deux etats a moitie appliques.
local somme = 0
for _, e in ipairs({ "african", "asian", "caucasian" }) do
    for _, g in ipairs({ "male", "female" }) do
        for _, a in ipairs({ "young", "old" }) do
            somme = somme + (milieu[e .. "-" .. g .. "-" .. a] or 0)
        end
    end
end
proche(somme, 1, "la famille ethnie x genre x age somme a 1")

-- ── Le trou de la grille ──────────────────────────────────────────────────────
--
-- `averagemuscle-averageweight` n existe PAS chez MakeHuman : le point moyen est
-- le maillage de base. Le produire serait une reference morte.

local moyen = Macros.Resoudre({ gender = 1, age = 0, muscle = 0.5, weight = 0.5, height = 0.5,
                                ethnicity = { african = 1, asian = 0, caucasian = 0 } })
egal(moyen["universal-male-young-averagemuscle-averageweight"], nil,
     "le point moyen/moyen n est pas produit")

-- La famille `height/`, elle, possede bien son moyen/moyen.
local grand = Macros.Resoudre({ gender = 1, age = 0, muscle = 0.5, weight = 0.5, height = 1,
                                ethnicity = { african = 1, asian = 0, caucasian = 0 } })
ok(grand["height/male-young-averagemuscle-averageweight-maxheight"] ~= nil,
   "la famille height a bien son moyen/moyen")

-- ── Taille ────────────────────────────────────────────────────────────────────

local neutre = Macros.Resoudre({ gender = 1, age = 0, muscle = 0.5, weight = 0.5, height = 0.5,
                                 ethnicity = { african = 1, asian = 0, caucasian = 0 } })
local aucuneTaille = true
for nom in pairs(neutre) do
    if (nom:sub(1, 7) == "height/") then aucuneTaille = false end
end
ok(aucuneTaille, "taille a 0.5 : aucun morph de taille (c est le maillage de base)")

local petit = Macros.Resoudre({ gender = 1, age = 0, muscle = 0.5, weight = 0.5, height = 0,
                                ethnicity = { african = 1, asian = 0, caucasian = 0 } })
ok(petit["height/male-young-averagemuscle-averageweight-minheight"] ~= nil,
   "taille a 0 : la borne minimale est activee")
egal(petit["height/male-young-averagemuscle-averageweight-maxheight"], nil,
     "taille a 0 : la borne maximale ne l est pas")

-- ── Bornage et entrees douteuses ──────────────────────────────────────────────

local hors = Macros.Resoudre({ gender = 99, age = -5, muscle = 0.5, weight = 0.5, height = 0.5,
                               ethnicity = { african = 1, asian = 0, caucasian = 0 } })
proche(hors["african-male-young"], 1, "une valeur hors bornes est ramenee")

local sansRien = Macros.Resoudre(nil)
ok(next(sansRien) ~= nil, "resoudre nil rend le corps neutre, pas rien")

local ethNulle = Macros.Resoudre({ gender = 1, age = 0, muscle = 0.5, weight = 0.5, height = 0.5,
                                   ethnicity = { african = 0, asian = 0, caucasian = 0 } })
proche((ethNulle["african-male-young"] or 0) + (ethNulle["asian-male-young"] or 0)
       + (ethNulle["caucasian-male-young"] or 0), 1,
       "une ethnie a somme nulle retombe sur un melange egal")

-- ── Format plat ───────────────────────────────────────────────────────────────

ok(Macros.EstMacro("@gender"), "un identifiant prefixe est reconnu")
ok(not Macros.EstMacro("nose-hump"), "un curseur de visage n est pas une macro")
ok(not Macros.EstMacro(nil), "nil n est pas une macro")

local plat = Macros.Depuis({ ["@gender"] = 1, ["@height"] = 0.2, ["nose-hump"] = 0.5 })
egal(plat.gender, 1, "le format plat lit le genre")
egal(plat.height, 0.2, "le format plat lit la taille")
egal(plat.muscle, 0.5, "un curseur absent prend son defaut")

local ids = Macros.Identifiants()
egal(#ids, #Macros.CURSEURS + #Macros.ETHNIES, "les identifiants couvrent curseurs et ethnies")
for _, id in ipairs(ids) do
    ok(Macros.EstMacro(id), "l identifiant " .. id .. " est prefixe")
end

-- Un reglage de visage seul ne doit pas perturber les macros.
local vide = Macros.Depuis({ ["nose-hump"] = 1 })
egal(vide.gender, 0.5, "sans macro, le genre reste au defaut")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print(string.format("%d reussi(s), %d echec(s)", reussis, echoues))
if (echoues > 0) then error("tests macros en echec") end