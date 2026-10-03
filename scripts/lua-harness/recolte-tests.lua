-- ══════════════════════════════════════════════════════════════════════════════
-- recolte-tests.lua — assertions sur Shared/Logic/Recolte.lua.
-- Chargé par recolte.mjs, qui fournit `Recolte`, `Narvos.Gisements`
-- (catalogue RÉEL) et `Narvos.Items` (catalogue RÉEL).
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

local function contient(texte, fragment)
    return type(texte) == "string" and texte:find(fragment, 1, true) ~= nil
end

-- ══════════════════════════════════════════════════════════════════════════════
-- COHÉRENCE DU CATALOGUE (le vrai, pas une copie)
-- ══════════════════════════════════════════════════════════════════════════════

section("coherence catalogue")

local problemes = Recolte.Verifier(Narvos.Items.ITEM_DB)
for _, p in ipairs(problemes) do print("  PROBLEME  " .. p) end
egal(#problemes, 0, "les gisements referencent uniquement des items existants")

ok(#Recolte.Sequence() >= 5, "au moins cinq gisements")

local mines = Recolte.GisementsDeZone("mines")
local cavernes = Recolte.GisementsDeZone("cavernes")
local labyrinthe = Recolte.GisementsDeZone("labyrinthe")
egal(#mines, 2, "zone mines : deux gisements")
egal(#cavernes, 2, "zone cavernes : deux gisements")
egal(#labyrinthe, 2, "zone labyrinthe : deux gisements")
egal(#Recolte.GisementsDeZone("zone_inconnue"), 0, "zone inconnue : liste vide")
egal(Recolte.Gisement("filon_metal_rare").ressource, "metal_rare", "Gisement() rend la fiche reelle")
egal(Recolte.Gisement("introuvable"), nil, "Gisement() inconnu : nil")
egal(Recolte.Gisement(nil), nil, "Gisement(nil) : nil, sans lever")

-- ══════════════════════════════════════════════════════════════════════════════
-- PEUT — l'outil et le palier, avec la RAISON
-- ══════════════════════════════════════════════════════════════════════════════

section("Peut")

local filon = Recolte.Gisement("filon_metal_rare")

local o1, r1 = Recolte.Peut(filon, { outil = "pioche", palier = 2 })
egal(o1, true, "outil + palier suffisants : accepte")
egal(r1, nil, "aucune raison sur un succes")

local o2, r2 = Recolte.Peut(filon, { outil = "marteau", palier = 2 })
egal(o2, false, "mauvais outil : refuse")
ok(contient(r2, "pioche"), "la raison nomme l'outil attendu (" .. tostring(r2) .. ")")

local o3, r3 = Recolte.Peut(filon, { outil = "pioche", palier = 0 })
egal(o3, false, "palier trop bas : refuse")
ok(contient(r3, "palier"), "la raison nomme le palier (" .. tostring(r3) .. ")")

local o4, r4 = Recolte.Peut(filon, nil)
egal(o4, false, "etat joueur absent : refuse")
egal(r4, "état du joueur absent", "raison explicite")

-- corps sans outil (veine_vie) : mains nues autorisees, mais palier requis.
local veine = Recolte.Gisement("veine_vie")
local o5, r5 = Recolte.Peut(veine, { outil = nil, palier = 1 })
egal(o5, true, "veine de vie : mains nues acceptees")

-- ── PLUSIEURS OUTILS DANS LE SAC — le defaut du 2026-09-13 ────────────────────
-- `OutilDuJoueur` (Server/Index.lua) rendait le PREMIER outil trouve, dans
-- l'ordre d'une liste ecrite en dur { pioche, foreuse, collecteur }. Un mineur qui
-- portait une pioche ET une foreuse etait donc « un joueur a pioche » pour
-- toujours : le coeur de plasma et l'amplificateur (foreuse) lui repondaient
-- « il te faut une foreuse », foreuse en poche. L'etat porte desormais l'ENSEMBLE
-- des outils possedes.
local plasma = Recolte.Gisement("ceur_plasma")
ok(plasma ~= nil and plasma.outil == "foreuse", "le coeur de plasma demande la foreuse (catalogue)")
local sac_complet = { outils = { pioche = true, foreuse = true }, palier = 9 }
egal(Recolte.Peut(plasma, sac_complet), true, "pioche ET foreuse en poche : la foreuse suffit")
egal(Recolte.Peut(filon, sac_complet), true, "pioche ET foreuse en poche : la pioche aussi")

local o6, r6 = Recolte.Peut(filon, { outils = { foreuse = true }, palier = 9 })
egal(o6, false, "foreuse seule : le filon (pioche) est refuse")
ok(contient(r6, "pioche"), "la raison nomme toujours l'outil attendu (" .. tostring(r6) .. ")")

egal(Recolte.Peut(filon, { outils = {}, palier = 9 }), false, "sac sans outil : refuse")
egal(Recolte.Peut(veine, { outils = {}, palier = 1 }), true, "sac sans outil : les mains nues suffisent a la veine")

-- Une valeur d'ensemble qui n'est pas `true` ne compte pas : un outil « possede »
-- a 0 exemplaire serait une recolte gratuite.
egal(Recolte.Peut(filon, { outils = { pioche = false }, palier = 9 }), false,
     "outils.pioche = false ne vaut pas une pioche")

-- Les outils requis, lus dans le catalogue — la liste que le serveur doit
-- chercher dans le sac, au lieu d'une copie ecrite a la main.
local requis = Recolte.OutilsRequis()
ok(type(requis) == "table" and #requis > 0, "OutilsRequis rend une liste non vide")
local vus = {}
for _, o in ipairs(requis) do vus[o] = (vus[o] or 0) + 1 end
for _, id in ipairs(Recolte.Sequence()) do
    local g = Recolte.Gisement(id)
    if (g.outil ~= nil) then ok(vus[g.outil] == 1, "outil requis liste une fois : " .. g.outil) end
end
local d1 = table.concat(Recolte.OutilsRequis(), ",")
local d2 = table.concat(Recolte.OutilsRequis(), ",")
egal(d1, d2, "OutilsRequis est deterministe (ordre du catalogue, pas de pairs)")

-- ── LE GESTE DE RECOLTE (2026-09-13) ──────────────────────────────────────────
-- Les 72 animations de Farming And Mining sont cuites sur SKEL_Mannequin depuis
-- le cook du 13/09 (pari du squelette gagne). La recolte, elle, etait instantanee
-- et immobile. Chaque outil exige par un gisement doit avoir son geste — un outil
-- ajoute au catalogue sans geste est une recolte sans corps, et ce test le voit.
section("gestes de recolte")

for _, outil in ipairs(Recolte.OutilsRequis()) do
    local g = Recolte.GESTES_OUTIL[outil]
    ok(type(g) == "table", "l outil « " .. outil .. " » a un geste")
    ok(g and type(g.animation) == "string" and g.animation:match("^narvos::") ~= nil,
       "le geste de « " .. outil .. " » nomme une animation du pack")
    ok(g and type(g.mesh) == "string" and g.mesh:match("^narvos::") ~= nil,
       "le geste de « " .. outil .. " » nomme l outil tenu en main")
end

local g_filon = Recolte.GesteDe(filon)
ok(g_filon ~= nil and g_filon == Recolte.GESTES_OUTIL[filon.outil], "GesteDe rend le geste de l outil du gisement")
egal(Recolte.GesteDe(veine), nil, "mains nues : aucun geste d outil")
egal(Recolte.GesteDe(nil), nil, "gisement nil : nil, sans lever")

-- ══════════════════════════════════════════════════════════════════════════════
-- RENDEMENT — bornes, bonus de palier, rng injecté
-- ══════════════════════════════════════════════════════════════════════════════

section("Rendement")

local zero = function() return 0 end
local un = function() return 1 end

local liste, raison = Recolte.Rendement(filon, 1, zero)
egal(raison, nil, "rendement avec rng sain")
egal(liste[1].item_id, "metal_rare", "le gisement produit sa ressource")
egal(liste[1].quantite, 1, "tirage 0 : quantite minimale")

local liste2 = Recolte.Rendement(filon, 1, un)
egal(liste2[1].quantite, 3, "tirage 1 : quantite maximale plafonnee")

-- Bonus de palier : niveau 3 sur un gisement requis 1, bonus 1 => max 5, min 1.
local liste3, r3b = Recolte.Rendement(filon, 3, un)
egal(r3b, nil, "palier superieur : ok")
egal(liste3[1].quantite, 5, "le palier eleve le plafond (1 + 2 x bonus)")

-- Beaucoup de tirages : le rendement reste DANS les bornes elargies.
local x = 12345
local function pseudo_rng()
    x = (x * 137 + 71) % 997
    return x / 997
end
local dans_borne = true
for _ = 1, 500 do
    local l = Recolte.Rendement(filon, 1, pseudo_rng)
    local q = l[1].quantite
    if (q < 1 or q > 3) then dans_borne = false break end
end
ok(dans_borne, "500 tirages : toujours entre min et max (palier 1)")

local x2 = 999
local function pseudo_rng2()
    x2 = (x2 * 137 + 71) % 997
    return x2 / 997
end
local dans_borne2 = true
for _ = 1, 500 do
    local l = Recolte.Rendement(filon, 3, pseudo_rng2)
    local q = l[1].quantite
    if (q < 1 or q > 5) then dans_borne2 = false break end
end
ok(dans_borne2, "500 tirages : toujours entre min et max elargi (palier 3)")

local l4, r4b = Recolte.Rendement(filon, 1, nil)
egal(l4, nil, "rng absent : nil")
egal(r4b, "rng manquant", "raison explicite")

local l5, r5b = Recolte.Rendement(filon, 1, function() return "oui" end)
egal(l5, nil, "rng qui ne rend pas un nombre : nil, sans lever")

-- ══════════════════════════════════════════════════════════════════════════════
-- REPOUSSE — récolté ≠ réinitialisé, et immuabilité
-- ══════════════════════════════════════════════════════════════════════════════

section("EstPret / repousse")

local etat_neuf = Recolte.EtatNeuf("filon_metal_rare")
egal(Recolte.EstPret(filon, etat_neuf, 0), true, "jamais recolte : pret des le depart")
egal(Recolte.EstPret(filon, nil, 0), true, "etat absent : pret")

local etat_recolte = Recolte.MarquerRecolte(etat_neuf, 1000)
egal(Recolte.EstPret(filon, etat_recolte, 1000 + 59999), false, "apres recolte : encore en repousse")
egal(Recolte.EstPret(filon, etat_recolte, 1000 + 60000), true, "repousse ecoulee : pret")

-- ⚠ L'IMMUABILITE : MarquerRecolte ne doit pas toucher l'etat d'entree.
egal(etat_neuf.vide_a_ms, nil, "immuable : l'etat d'entree reste intact apres MarquerRecolte")

local etat_zone = Recolte.Reinitialiser(etat_recolte)
egal(Recolte.EstPret(filon, etat_zone, 0), true, "reinitialise (zone dechargee) : pret immediatement")
egal(Recolte.EstPret(filon, etat_zone, 1000), true, "reinitialise : meme pendant l'ancienne repousse")
egal(etat_recolte.reinitialise, false, "immuable : Reinitialiser n'ecrase pas l'etat d'entree")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end