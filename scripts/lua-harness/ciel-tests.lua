-- ══════════════════════════════════════════════════════════════════════════════
-- ciel-tests.lua — assertions sur Shared/Logic/Ciel.lua.
-- Chargé par ciel.mjs, qui fournit `Mondes`, `Ciel` et le global `Narvos`.
--
-- ── CE QUE CES TESTS EXISTENT POUR ATTRAPER ───────────────────────────────────
-- Un nom d'énumération faux. `SkyMode.Spce` vaut nil, `SetSkyMode(nil)` ne lève
-- pas, et le ciel reste celui d'avant — le joueur voit le ciel de la Forge en
-- orbite et personne n'a d'erreur à lire. C'est exactement la panne des morphs
-- numérotés, transposée au ciel.
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(condition, nom)
    if (condition) then reussis = reussis + 1
    else echecs = echecs + 1 print("  ECHEC  " .. nom) end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
    end
end

local function section(nom) print("[" .. nom .. "]") end

-- ── Le contrôle qui compte ────────────────────────────────────────────────────

section("Verification du catalogue")

local problemes = Ciel.Verifier()
for _, p in ipairs(problemes) do print("  PROBLEME  " .. p) end
egal(#problemes, 0, "aucun monde avec un nom d'enumeration faux")

-- ── Chaque monde déclare son ciel ─────────────────────────────────────────────
--
-- `Sky` est un singleton client : le ciel posé pour un monde RESTE en place au
-- monde suivant. Un monde sans ciel déclaré n'affiche donc pas un défaut, il
-- affiche le ciel de l'endroit d'où l'on vient.

section("Couverture")

for _, m in ipairs(Mondes.MONDES) do
    ok(type(m.ciel) == "table", "ciel declare : " .. m.id)
end

-- ── Ce que le joueur a demandé ────────────────────────────────────────────────

section("Orbital : l'espace")

local orb = Ciel.Reglages("orbital")
egal(orb.mode, "Space", "orbital est en mode Space")
egal(orb.sans_meteo, true, "orbital n'a pas de meteo")
ok(orb.echelle_lune > 1.0, "orbital grossit la lune en planete")
ok(orb.luminosite_nuit > 1.0, "orbital remonte la luminosite nocturne")
egal(orb.brume, 0.0, "le vide n'a pas de brume")

-- La Tour est passee sur la carte DESERTIQUE le 2026-09-06 : son ciel n'est plus
-- une brume epaisse mais un petit matin degage. Ce qui reste vrai, et ce que ce
-- bloc verifie, c'est qu'elle a une meteo declaree et un lever de soleil rasant
-- — c'est la lumiere oblique qui donne son relief a une dune.
section("Tour : le desert au petit matin")

local tour = Ciel.Reglages("tower")
egal(tour.meteo, "SandDustCalm", "la Tour porte le voile de sable")
ok(tour.nuages <= 0.3, "le desert a peu de nuages")
ok(tour.heures < 9, "le soleil de la Tour est encore bas")
egal(tour.sans_meteo, false, "la Tour a bien une meteo")

section("Azur : l'ile alien")

local azur = Ciel.Reglages("alien")
ok(azur ~= nil, "le monde alien a un ciel")
ok(azur.brume <= 0.1, "le lagon garde sa couleur -- presque pas de brume")

section("Forge : le jour")

local forge = Ciel.Reglages("forge")
ok(forge.mode ~= "Space", "la Forge n'est pas dans l'espace")
ok(forge.heures >= 6 and forge.heures <= 18, "la Forge est de jour")

-- ── Le repli ──────────────────────────────────────────────────────────────────
--
-- `Reglages` doit TOUJOURS rendre une table. Le client n'a aucun moyen sensé de
-- traiter un nil : il laisserait le ciel précédent, c'est-à-dire la panne qu'on
-- cherche à éviter.

section("Repli")

local inconnu = Ciel.Reglages("monde_qui_n_existe_pas")
ok(type(inconnu) == "table", "un monde inconnu rend quand meme une table")
egal(inconnu.mode, Ciel.DEFAUT.mode, "un monde inconnu prend le mode par defaut")
ok(Ciel.ModeValide(inconnu.mode), "le mode par defaut est valide")
ok(Ciel.MeteoValide(inconnu.meteo), "la meteo par defaut est valide")

egal(type(Ciel.Reglages(nil)), "table", "nil rend une table")
egal(type(Ciel.Reglages(42)), "table", "un nombre rend une table")

-- ── Validation des noms ───────────────────────────────────────────────────────

section("Enumerations")

ok(Ciel.ModeValide("Space"), "Space est un mode connu")
ok(Ciel.ModeValide("VolumetricAurora"), "VolumetricAurora est un mode connu")
ok(not Ciel.ModeValide("Spce"), "une faute de frappe est rejetee")
ok(not Ciel.ModeValide(nil), "nil n'est pas un mode")
ok(not Ciel.ModeValide(3), "un nombre n'est pas un mode")

ok(Ciel.MeteoValide("Foggy"), "Foggy est une meteo connue")
ok(not Ciel.MeteoValide("Fog"), "Fog n'existe pas -- c'est Foggy")

-- ── Bornes ────────────────────────────────────────────────────────────────────
--
-- Les valeurs viennent d'un catalogue écrit à la main. Une brume à 7 au lieu de
-- 0.7 est une faute de frappe plausible, et UDS ne s'en plaindrait pas.

section("Bornes")

-- ⚠ NE PAS AJOUTER A `Mondes.MONDES`. `Mondes.Trouver` interroge un index
-- `par_id` construit UNE FOIS au chargement du catalogue : un monde ajoute
-- ensuite reste introuvable, `Reglages` retombe sur les defauts, et le test
-- passerait a cote de ce qu'il croit mesurer. (Constate ici meme : deux
-- assertions vertes sur des valeurs qui n'avaient jamais ete bornees.)
--
-- `Reglages` appelle `Mondes.Trouver` AU MOMENT DE L'APPEL. On remplace donc la
-- fonction, ce qui est le seul point d'entree qu'elle utilise.
local trouver_reel = Mondes.Trouver
Mondes.Trouver = function(id)
    if (id == "_test_bornes") then
        return {
            id = "_test_bornes", dimension = 999, catalogue = "Aucun",
            ciel = {
                mode = "NoClouds", meteo = "Cloudy",
                heure = { 99, -5 }, nuages = 7.0, brume = -3.0,
                intensite_soleil = 1e9, transition = 1000,
            },
        }
    end
    return trouver_reel(id)
end

local b = Ciel.Reglages("_test_bornes")
egal(b.nuages, 1.0, "nuages borne a 1")
egal(b.brume, 0.0, "brume borne a 0")
ok(b.intensite_soleil <= 20.0, "intensite du soleil bornee")
ok(b.transition <= 30.0, "transition bornee")
egal(b.heures, 23, "heure borne a 23")
egal(b.minutes, 0, "minute negative ramenee a 0")

-- Les entiers doivent rester des entiers : `SetTimeOfDay` prend deux integer.
egal(math.type and math.type(b.heures) or "integer", "integer", "heures est un entier")

Mondes.Trouver = trouver_reel

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end