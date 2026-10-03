-- ══════════════════════════════════════════════════════════════════════════════
-- combat-tests.lua — assertions sur Shared/Logic/Combat.lua.
-- Chargé par combat.mjs, qui fournit `Combat`, `Anims` (Logic/Animations.lua)
-- et le global `Narvos` (Classes, Items, AnimNoms).
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

--- Aléa fixe : rend toujours la même valeur. C'est ce qui rend le jet de
--- critique reproductible — sans injection, chaque VM tirerait autre chose et
--- ces assertions seraient impossibles à écrire.
local function fixe(v) return function() return v end end

-- ══════════════════════════════════════════════════════════════════════════════
-- COHERENCE AVEC LE CATALOGUE D'ANIMATIONS
--
-- C'est la partie qui rapporte le plus. Une action renommée à l'import ne LEVE
-- PAS : le coup part, consomme sa recuperation, et le personnage ne bouge pas.
-- Le meme defaut silencieux que les 67 animations mortes deja payees ici.
-- ══════════════════════════════════════════════════════════════════════════════

section("coherence catalogue")

local sets = Anims.Grouper(Narvos.AnimNoms.NOMS)

local manquants = Combat.Verifier(sets)
for _, nom in ipairs(manquants) do print("  ABSENT  " .. nom) end
egal(#manquants, 0, "toutes les actions de la chaine existent dans le catalogue")

egal(#Combat.Verifier(nil), 0, "Verifier(nil) ne leve pas")
egal(#Combat.Verifier({}), #Combat.CHAINE * 2, "sets vide : tout est signale")

-- ── La chaine elle-meme ───────────────────────────────────────────────────────

section("CHAINE")

ok(#Combat.CHAINE >= 2, "la chaine a au moins deux coups")

local precedent = 0
for i, def in ipairs(Combat.CHAINE) do
    ok(def.multiplicateur > precedent, "coup " .. i .. " : multiplicateur croissant")
    precedent = def.multiplicateur
    ok(def.duree_ms > 0, "coup " .. i .. " : duree positive")
    ok(type(def.action) == "string", "coup " .. i .. " : action nommee")
    ok(type(def.reaction) == "string", "coup " .. i .. " : reaction nommee")
end

-- Le dernier coup ne prolonge rien : sans cela la chaine boucherait sur son
-- multiplicateur le plus fort et ne redescendrait jamais.
egal(Combat.CHAINE[#Combat.CHAINE].fenetre_ms, 0, "le dernier coup ne rouvre pas de fenetre")

-- ══════════════════════════════════════════════════════════════════════════════
-- DIRECTIONS
-- ══════════════════════════════════════════════════════════════════════════════

section("Direction")

egal(#Combat.DIRECTIONS, 4, "quatre directions, comme les montages Freeflow")

egal(Combat.Direction(0), "Front", "0 deg : de face")
egal(Combat.Direction(44), "Front", "44 deg : encore de face")
egal(Combat.Direction(46), "Right", "46 deg : bascule a droite")
egal(Combat.Direction(90), "Right", "90 deg : a droite")
egal(Combat.Direction(180), "Back", "180 deg : dans le dos")
egal(Combat.Direction(270), "Left", "270 deg : a gauche")
egal(Combat.Direction(-90), "Left", "-90 deg : a gauche aussi")
egal(Combat.Direction(359), "Front", "359 deg : revenu de face")

-- Un angle non normalise arrive des qu'on soustrait deux yaw : il ne doit pas
-- sortir de la table et rendre nil, ce qui ferait planter l'indexation suivante.
egal(Combat.Direction(360), "Front", "un tour complet")
egal(Combat.Direction(450), "Right", "au-dela d'un tour")
egal(Combat.Direction(-450), "Left", "sous moins d'un tour")

-- ⚠ Pas de repli sur "Front" : un coup recu dans le dos jouerait un montage de
-- face, faux et invisible autrement qu'en jouant.
egal(Combat.Direction(nil), nil, "angle nil : nil, sans lever")
egal(Combat.Direction("gauche"), nil, "angle non numerique : nil")
egal(Combat.Direction("90"), "Right", "angle en chaine accepte")

egal(Combat.DirectionValide("Front"), true, "Front est valide")
egal(Combat.DirectionValide("front"), false, "la casse compte")
egal(Combat.DirectionValide(nil), false, "nil n'est pas une direction")
egal(Combat.DirectionValide(90), false, "un nombre n'est pas une direction")

-- ══════════════════════════════════════════════════════════════════════════════
-- ENCHAINEMENT
-- ══════════════════════════════════════════════════════════════════════════════

section("Frapper / EtapeSuivante")

local etat = Combat.NouvelEtat()
egal(etat.etape, 0, "on demarre chaine a zero")
-- ⚠ `false` et non `nil` : un champ a nil DISPARAIT de la table, et « vide »
-- deviendrait indistinguable d'« absent ».
egal(etat.contre_direction, false, "aucune annonce = false, pas nil")

local ok1, raison1, coup1 = Combat.Frapper(etat, 0)
egal(ok1, true, "premier coup accepte")
egal(raison1, nil, "aucune raison d'echec")
egal(coup1.etape, 1, "c'est le premier coup de la chaine")
egal(coup1.action, Combat.CHAINE[1].action, "l'action du premier coup")
egal(coup1.dernier, false, "le premier coup n'est pas le dernier")

-- Marteler la touche ne doit rien donner tant que le coup n'est pas fini.
egal(select(1, Combat.Frapper(etat, 10)), false, "refuse pendant la recuperation")
egal(select(2, Combat.Frapper(etat, 10)), "Coup en cours", "et le dit")

local D1 = Combat.CHAINE[1].duree_ms
local F1 = Combat.CHAINE[1].fenetre_ms

-- La borne compte des deux cotes : un `<` au lieu d'un `<=` laisserait
-- l'enchainement impossible si le pas de temps tombait pile sur la limite.
egal(Combat.EtapeSuivante(etat, D1 - 1), nil, "juste avant la fin : rien")
egal(Combat.EtapeSuivante(etat, D1), 2, "exactement a la fin : enchaine")
egal(Combat.EtapeSuivante(etat, D1 + F1), 2, "dernier instant de la fenetre")
egal(Combat.EtapeSuivante(etat, D1 + F1 + 1), 1, "hors fenetre : la chaine repart de zero")

-- Interroger ne doit rien changer : le HUD appelle EtapeSuivante a chaque frame.
egal(etat.etape, 1, "EtapeSuivante ne mute pas l'etat")

local _, _, coup2 = Combat.Frapper(etat, D1)
egal(coup2.etape, 2, "deuxieme coup")
ok(coup2.multiplicateur > coup1.multiplicateur, "le deuxieme coup frappe plus fort")

local t3 = D1 + Combat.CHAINE[2].duree_ms
local _, _, coup3 = Combat.Frapper(etat, t3)
egal(coup3.etape, 3, "troisieme coup")
egal(coup3.dernier, true, "le troisieme est le dernier")
egal(coup3.reaction, Combat.CHAINE[3].reaction, "sa reaction projette")

-- Chaine terminee : le coup suivant repart du premier, meme immediatement apres
-- la recuperation.
local t4 = t3 + Combat.CHAINE[3].duree_ms
local _, _, coup4 = Combat.Frapper(etat, t4)
egal(coup4.etape, 1, "apres le dernier coup, la chaine repart de zero")

-- Une pause casse la chaine.
local casse = Combat.NouvelEtat()
Combat.Frapper(casse, 0)
local _, _, reprise = Combat.Frapper(casse, D1 + F1 + 5000)
egal(reprise.etape, 1, "une pause longue casse la chaine")

section("cadence de l'arme")

-- Une masse frappe plus lentement. La cadence etire la recuperation ET la
-- fenetre : etirer la seule recuperation ferait de l'arme lourde la seule a ne
-- pas pouvoir enchainer, ce qui n'est pas ce qu'on veut dire par « lente ».
local lourd = Combat.NouvelEtat()
local _, _, coup_lourd = Combat.Frapper(lourd, 0, { cadence = 2 })
egal(coup_lourd.duree_ms, D1 * 2, "cadence 2 : recuperation doublee")
egal(coup_lourd.fenetre_ms, F1 * 2, "cadence 2 : fenetre doublee")
egal(Combat.EtapeSuivante(lourd, D1 * 2), 2, "et l'enchainement suit")

-- Une cadence absurde ne doit pas rendre l'arme injouable.
local zero = Combat.NouvelEtat()
local _, _, coup_zero = Combat.Frapper(zero, 0, { cadence = 0 })
egal(coup_zero.duree_ms, D1, "cadence nulle : repli sur la cadence neutre")
local negatif = Combat.NouvelEtat()
local _, _, coup_neg = Combat.Frapper(negatif, 0, { cadence = -3 })
egal(coup_neg.duree_ms, D1, "cadence negative : repli, sans lever")

section("robustesse de l'enchainement")

egal(select(1, Combat.Frapper(nil, 0)), false, "etat nil refuse sans lever")
egal(select(1, Combat.Frapper(Combat.NouvelEtat(), nil)), false, "instant nil refuse sans lever")
egal(Combat.EtapeSuivante(nil, 0), nil, "EtapeSuivante(nil) ne leve pas")
egal(Combat.EtapeSuivante({}, 0), 1, "etat vide : premier coup")

-- ══════════════════════════════════════════════════════════════════════════════
-- FENETRE DE CONTRE
-- ══════════════════════════════════════════════════════════════════════════════

section("Telegraphier / PeutContrer")

local def_etat = Combat.NouvelEtat()
egal(select(1, Combat.PeutContrer(def_etat, 0)), false, "rien a contrer au depart")
egal(select(2, Combat.PeutContrer(def_etat, 0)), "Aucune attaque a contrer", "et le dit")

egal(select(1, Combat.Telegraphier(def_etat, "Back", 1000)), true, "annonce acceptee")
egal(def_etat.contre_direction, "Back", "la direction est retenue")

local FIN = 1000 + Combat.FENETRE_CONTRE_MS
egal(select(1, Combat.PeutContrer(def_etat, 1000)), true, "contre possible des l'annonce")
egal(select(1, Combat.PeutContrer(def_etat, FIN)), true, "encore possible au dernier instant")
egal(select(1, Combat.PeutContrer(def_etat, FIN + 1)), false, "plus possible apres")
egal(select(2, Combat.PeutContrer(def_etat, FIN + 1)), "Fenetre de contre passee", "et le dit")

-- Forme directionnelle : la parade doit designer le bon cote.
egal(select(1, Combat.PeutContrer(def_etat, 1100, "Back")), true, "bon cote accepte")
egal(select(1, Combat.PeutContrer(def_etat, 1100, "Front")), false, "mauvais cote refuse")
egal(select(2, Combat.PeutContrer(def_etat, 1100, "Front")), "Mauvais cote", "et le dit")

egal(select(1, Combat.Telegraphier(def_etat, "Haut", 1000)), false, "direction inconnue refusee")
egal(select(1, Combat.Telegraphier(def_etat, nil, 1000)), false, "direction nil refusee sans lever")
egal(select(1, Combat.Telegraphier(nil, "Back", 1000)), false, "etat nil refuse sans lever")
egal(select(1, Combat.PeutContrer(nil, 0)), false, "PeutContrer(nil) ne leve pas")

section("deux assaillants")

-- ⚠ On garde l'annonce dont la fenetre se FERME LE PLUS TOT — le coup imminent.
-- Garder la plus recente ferait parer un coup pas encore parti tout en
-- encaissant celui qui arrive.
local assailli = Combat.NouvelEtat()
Combat.Telegraphier(assailli, "Front", 1000)
Combat.Telegraphier(assailli, "Left", 1100)
egal(assailli.contre_direction, "Front", "l'annonce imminente est conservee")
egal(assailli.contre_jusqu_a, 1000 + Combat.FENETRE_CONTRE_MS, "et sa fenetre aussi")

-- Une annonce expiree ne bloque pas la suivante.
local expire = Combat.NouvelEtat()
Combat.Telegraphier(expire, "Front", 0)
Combat.Telegraphier(expire, "Left", Combat.FENETRE_CONTRE_MS + 1)
egal(expire.contre_direction, "Left", "une annonce expiree cede la place")

section("Contrer")

local riposte = Combat.NouvelEtat()
Combat.Telegraphier(riposte, "Right", 500)

local okc, raisonc, plan = Combat.Contrer(riposte, 600)
egal(okc, true, "contre reussi dans la fenetre")
egal(raisonc, nil, "aucune raison d'echec")
egal(plan.direction, "Right", "le montage suit la direction de l'attaque recue")
egal(plan.action, "Counter_Right", "la cle de montage porte la direction")
egal(plan.multiplicateur, Combat.MULT_CONTRE, "la riposte rend des degats")

-- La fenetre se ferme : un contre n'est pas rejouable sur la meme annonce.
egal(riposte.contre_direction, false, "la fenetre est refermee (false, pas nil)")
egal(select(1, Combat.Contrer(riposte, 610)), false, "pas de second contre sur la meme annonce")

-- ⚠ Un contre RATE ferme aussi la fenetre : sans cela, marteler la touche
-- finirait toujours par tomber juste.
local rate = Combat.NouvelEtat()
Combat.Telegraphier(rate, "Back", 0)
egal(select(1, Combat.Contrer(rate, 10, "Front")), false, "mauvais cote : contre refuse")
egal(rate.contre_direction, false, "et la fenetre est consommee quand meme")

-- Hors fenetre, il n'y avait rien a consommer.
local tard = Combat.NouvelEtat()
Combat.Telegraphier(tard, "Back", 0)
egal(select(1, Combat.Contrer(tard, Combat.FENETRE_CONTRE_MS + 50)), false, "trop tard : refuse")

egal(select(1, Combat.Contrer(nil, 0)), false, "Contrer(nil) ne leve pas")
egal(select(1, Combat.Contrer(Combat.NouvelEtat(), nil)), false, "instant nil refuse sans lever")

-- ══════════════════════════════════════════════════════════════════════════════
-- DEGATS
-- ══════════════════════════════════════════════════════════════════════════════

section("Degats")

local NEUTRE = { puissance = 0, critique = 0 }
local ARME10 = { degats = 10 }

local d = Combat.Degats(NEUTRE, ARME10, 1, { defense = 0 }, fixe(0.99))
egal(d.degats, 10, "sans puissance ni defense : les degats de l'arme")
egal(d.critique, false, "pas de critique a 0 % de chance")

-- base * (1 + puissance/100) — calcDamage, spells/SpellDef.ts
egal(Combat.Degats({ puissance = 100, critique = 0 }, ARME10, 1, nil, fixe(0.99)).degats, 20,
    "100 de puissance double les degats")

-- max(1, brut * (1 - def/(def+80))) — applyDamage, stats/PlayerStats.ts
egal(Combat.Degats(NEUTRE, ARME10, 1, { defense = 80 }, fixe(0.99)).degats, 5,
    "une defense egale a la constante coupe la moitie")

-- x1,5 en critique — calcDamage
local crit = Combat.Degats({ puissance = 0, critique = 100 }, ARME10, 1, nil, fixe(0.0))
egal(crit.critique, true, "100 % de chance : toujours critique")
egal(crit.degats, 15, "le critique multiplie par 1,5")

-- Le tirage est `alea() * 100 < critique` : a 50 points, 0,49 passe et 0,50 non.
egal(Combat.Degats({ critique = 50 }, ARME10, 1, nil, fixe(0.49)).critique, true, "0,49 sous 50 points")
egal(Combat.Degats({ critique = 50 }, ARME10, 1, nil, fixe(0.50)).critique, false, "0,50 n'est pas sous 50")

-- ⚠ math.floor(x + 0.5), jamais `%.0f` : l'arrondi bancaire rendrait 6 pour 6,5
-- un coup sur deux, et deux coups identiques donneraient deux nombres.
egal(Combat.Degats(NEUTRE, { degats = 13 }, 0.5, nil, fixe(0.99)).degats, 7,
    "6,5 s'arrondit a 7, pas a 6")

-- Plancher a 1 : un coup qui affiche 0 se lit comme un coup qui n'a pas touche.
egal(Combat.Degats(NEUTRE, { degats = 0 }, 1, { defense = 100000 }, fixe(0.99)).degats, 1,
    "les degats ne descendent jamais sous 1")

-- Le multiplicateur de la chaine mord.
local faible = Combat.Degats(NEUTRE, ARME10, Combat.CHAINE[1].multiplicateur, nil, fixe(0.99)).degats
local fort = Combat.Degats(NEUTRE, ARME10, Combat.CHAINE[#Combat.CHAINE].multiplicateur, nil, fixe(0.99)).degats
ok(fort > faible, "le dernier coup de la chaine fait plus mal que le premier")

-- Le contre aussi.
ok(Combat.Degats(NEUTRE, ARME10, Combat.MULT_CONTRE, nil, fixe(0.99)).degats > faible,
    "une riposte fait plus mal qu'un premier coup")

-- Sans arme, on frappe quand meme : refuser ferait une touche qui ne repond pas.
egal(Combat.Degats(NEUTRE, nil, 1, nil, fixe(0.99)).degats, Combat.POINGS.degats,
    "sans arme : les poings")
ok(Combat.Degats(nil, nil, nil, nil, fixe(0.99)).degats >= 1, "Degats(nil…) ne leve pas")

-- ⚠ `nil < 0` LEVE en Lua : toute valeur externe est convertie avant d'etre
-- comparee. Un champ empoisonne ne doit pas emporter le serveur.
ok(Combat.Degats({ puissance = "abc", critique = {} }, { degats = "x" }, "y", { defense = false },
    fixe(0.99)).degats >= 1, "champs de mauvais type : repli, sans lever")

-- ══════════════════════════════════════════════════════════════════════════════
-- STATISTIQUES ET ARME
-- ══════════════════════════════════════════════════════════════════════════════

section("Statistiques")

-- Catalogue REEL : une fausse table de classes ferait passer la suite alors que
-- le vrai catalogue a change de forme.
local CLASSE = nil
for id in pairs(Narvos.Classes.CLASSES) do
    if (CLASSE == nil or id < CLASSE) then CLASSE = id end
end
ok(CLASSE ~= nil, "le catalogue de classes n'est pas vide")

local base = Narvos.Classes.CLASSES[CLASSE].baseStats
local s1 = Combat.Statistiques(CLASSE, 1)
egal(s1.puissance, base.attackPower, "niveau 1 : la puissance est l'attackPower de la classe")
egal(s1.defense, base.defense, "niveau 1 : la defense de la classe")
egal(s1.critique, math.floor(base.critChance * 100 + 0.5), "critChance en POINTS de critique")

-- +8 % par niveau, comme createStats. Le critique, lui, n'est PAS majore par le
-- niveau — le TS non plus.
local s2 = Combat.Statistiques(CLASSE, 2)
egal(s2.puissance, math.floor(base.attackPower * 1.08 + 0.5), "niveau 2 : +8 % de puissance")
egal(s2.critique, s1.critique, "le niveau ne touche pas au taux de critique")

local s_bonus = Combat.Statistiques(CLASSE, 1, { puissance = 7, defense = 3, critique = 5 })
egal(s_bonus.puissance, s1.puissance + 7, "le bonus d'equipement s'ajoute a la puissance")
egal(s_bonus.defense, s1.defense + 3, "et a la defense")
egal(s_bonus.critique, s1.critique + 5, "et au critique")

-- ⚠ On ne lit PAS `attackPower` dans le bonus : le catalogue d'items porte les
-- deux cles sur certaines pieces, et l'epee qui declare les deux compterait
-- deux fois. Ce choix appartient a la couche equipement.
egal(Combat.Statistiques(CLASSE, 1, { attackPower = 99 }).puissance, s1.puissance,
    "attackPower du bonus ignore : pas de double compte")

-- Un monstre n'a pas de classe NARVOS. Le rendre inoffensif serait pire
-- qu'approximatif.
local sans = Combat.Statistiques(nil, 1)
egal(sans.puissance, Combat.BASE_INCONNUE.attackPower, "classe absente : base de repli")
egal(Combat.Statistiques("classe_inexistante", 1).puissance, Combat.BASE_INCONNUE.attackPower,
    "classe inconnue : meme repli")
egal(Combat.Statistiques(CLASSE, 0).puissance, s1.puissance, "niveau 0 : traite comme 1")
egal(Combat.Statistiques(CLASSE, nil).puissance, s1.puissance, "niveau nil : traite comme 1")
egal(Combat.Statistiques(CLASSE, 1, "pas une table").puissance, s1.puissance, "bonus invalide ignore")

section("ArmeDepuisItem")

local ARME_ID = nil
for id, def in pairs(Narvos.Items.ITEM_DB) do
    if (def.type == "weapon" and (ARME_ID == nil or id < ARME_ID)) then ARME_ID = id end
end
ok(ARME_ID ~= nil, "le catalogue d'items contient au moins une arme")

local arme = Combat.ArmeDepuisItem(ARME_ID)
ok(arme ~= nil, "l'arme du catalogue est reconnue")
egal(arme.id, ARME_ID, "l'identifiant est reporte")
ok(arme.degats > Combat.POINGS.degats, "une arme frappe plus fort que les poings")

egal(Combat.ArmeDepuisItem("item_inexistant"), nil, "item inconnu : nil")
egal(Combat.ArmeDepuisItem(nil), nil, "item nil : nil, sans lever")
egal(Combat.ArmeDepuisItem(42), nil, "item non textuel : nil")

-- ══════════════════════════════════════════════════════════════════════════════
-- RESOLUTION DES MONTAGES
-- ══════════════════════════════════════════════════════════════════════════════

section("MontageContre")

-- Noms fabriques pour le test : aucun montage Freeflow n'est declare dans
-- Assets.toml a ce jour, et en inventer un dans le module livrerait un nom que
-- le moteur ne resout pas — sans erreur, puisqu'un asset absent est ignore.
local NOMS = {
    "AM_Counter_Back_02",
    "AM_Counter_Back_01",
    "AM_Counter_Front_01",
    "AM_Counter_Left_01",
    "AM_Counter_Right_01",
    "AM_Counter_Backhand_01",  -- piege : contient « Back » sans etre une direction
    "Front_Kick_01",
    "AM_Takedown_Left",
}

local backs = Combat.MontageContre(NOMS, "Back")
egal(#backs, 2, "deux montages arriere, et le Backhand n'en est pas")
egal(backs[1], "AM_Counter_Back_01", "la liste est triee")
egal(backs[2], "AM_Counter_Back_02", "dans un ordre stable d'une VM a l'autre")

-- Bordage par « _ » des deux cotes : la direction en tete ou en fin de nom compte.
egal(#Combat.MontageContre(NOMS, "Front"), 2, "Front en tete de nom compte aussi")
egal(#Combat.MontageContre(NOMS, "Left"), 2, "Left en fin de nom compte aussi")

egal(#Combat.MontageContre(NOMS, "Haut"), 0, "direction inconnue : liste vide")
egal(#Combat.MontageContre(NOMS, nil), 0, "direction nil : liste vide, sans lever")
egal(#Combat.MontageContre(nil, "Back"), 0, "liste nil : liste vide, sans lever")
egal(#Combat.MontageContre({}, "Back"), 0, "liste vide : liste vide")

-- ══════════════════════════════════════════════════════════════════════════════
-- ALEA INJECTABLE
-- ══════════════════════════════════════════════════════════════════════════════

section("Generateur")

-- Le serveur decide, le client recoit : rejouer une graine doit rejouer
-- exactement le meme combat.
local a, b = Combat.Generateur(12345), Combat.Generateur(12345)
local identiques = true
for _ = 1, 50 do
    if (a() ~= b()) then identiques = false break end
end
ok(identiques, "meme graine, meme suite")

local c = Combat.Generateur(999)
ok(Combat.Generateur(12345)() ~= c(), "graines differentes, suites differentes")

local dans_borne = true
local g = Combat.Generateur(7)
for _ = 1, 200 do
    local v = g()
    if (v <= 0 or v >= 1) then dans_borne = false break end
end
ok(dans_borne, "les valeurs restent dans ]0, 1[")

-- ⚠ 0 est un point fixe de la suite de Lehmer : sans garde, la graine 0 rendrait
-- toujours la meme valeur et tous les critiques tomberaient pareil.
local z1 = Combat.Generateur(0)
local v1, v2 = z1(), z1()
ok(v1 ~= v2, "graine 0 : la suite avance quand meme")
ok(Combat.Generateur(nil)() > 0, "graine nil : repli, sans lever")
ok(Combat.Generateur("abc")() > 0, "graine non numerique : repli, sans lever")

-- Un coup complet reste reproductible bout en bout.
local rng1, rng2 = Combat.Generateur(2024), Combat.Generateur(2024)
local stats = Combat.Statistiques(CLASSE, 10)
local suite_egale = true
for _ = 1, 30 do
    local r1 = Combat.Degats(stats, ARME10, 1.15, { defense = 20 }, rng1)
    local r2 = Combat.Degats(stats, ARME10, 1.15, { defense = 20 }, rng2)
    if (r1.degats ~= r2.degats or r1.critique ~= r2.critique) then suite_egale = false break end
end
ok(suite_egale, "deux VM avec la meme graine calculent les memes degats")

-- ── Gestes des PNJ et reactions aux coups (2026-09-13) ────────────────────────
-- Mesure du jour : `IaServeur.Frapper` appliquait les degats SANS animation (le
-- PNJ blesse sans bouger), et le champ `reaction` de chaque coup etait calcule par
-- `Combat.Frapper` sans qu'aucune cible ne le joue. Les animations existent,
-- cuites (Freeflow, ACB_Attack_0x / ACB_Hurt*). Ce qui manquait est la decision.

section("gestes et reactions")

local n = #Combat.CHAINE
ok(n >= 1, "la chaine de coups n est pas vide")
egal(Combat.EtapeCyclique(nil), 1, "premier coup d un PNJ : etape 1")
egal(Combat.EtapeCyclique(1), math.min(2, n) == 2 and 2 or 1, "l etape avance")
egal(Combat.EtapeCyclique(n), 1, "apres le dernier coup, on reprend au premier")
egal(Combat.EtapeCyclique(n + 5), 1, "une etape hors chaine repart au premier coup")
egal(Combat.EtapeCyclique("x"), 1, "une etape non numerique repart au premier coup")

for i = 1, n do
    egal(Combat.ReactionPour(i), Combat.CHAINE[i].reaction, "la reaction de l etape " .. i .. " vient de la chaine")
end
egal(Combat.ReactionPour(nil), Combat.CHAINE[1].reaction, "etape inconnue : la reaction du premier coup")
egal(Combat.ReactionPour(0), Combat.CHAINE[1].reaction, "etape 0 : la reaction du premier coup")
egal(Combat.ReactionPour(n + 1), Combat.CHAINE[1].reaction, "etape hors chaine : la reaction du premier coup")

-- ⚠ LA RECUPERATION. Trois coups en 300 ms rejoueraient trois fois la reaction
-- depuis son debut : la cible tremblerait sur place au lieu de reculer.
ok(Combat.REACTION_RECUP_MS > 0, "la recuperation de reaction est positive")
egal(Combat.PeutReagir(nil, 1000), true, "jamais touche : reagit")
egal(Combat.PeutReagir(1000, 1000 + Combat.REACTION_RECUP_MS - 1), false, "trop tot : ne reagit pas")
egal(Combat.PeutReagir(1000, 1000 + Combat.REACTION_RECUP_MS), true, "a la borne : reagit")
egal(Combat.PeutReagir(1000, nil), false, "instant inconnu : ne reagit pas (un garde qui ne mesure rien compte pour vert)")

-- Le cote d'un coup (reactions par cote des infectes, Catalogs/Gestes.lua).
-- Victime tournee vers +X : avant = (1, 0), droite = (0, 1) (repere Unreal, Y a droite).
local AV, DR = { x = 1, y = 0 }, { x = 0, y = 1 }
egal(Combat.CoteDuCoup(AV, DR, { x = 1, y = 0 }), "avant", "attaquant devant")
egal(Combat.CoteDuCoup(AV, DR, { x = -1, y = 0 }), "arriere", "attaquant derriere")
egal(Combat.CoteDuCoup(AV, DR, { x = 0, y = 1 }), "droite", "attaquant a droite")
egal(Combat.CoteDuCoup(AV, DR, { x = 0, y = -1 }), "gauche", "attaquant a gauche")
egal(Combat.CoteDuCoup(AV, DR, { x = 0.8, y = 0.6 }), "avant", "trois quarts avant : avant")
egal(Combat.CoteDuCoup(AV, DR, { x = -0.3, y = -0.9 }), "gauche", "trois quarts gauche : gauche")
egal(Combat.CoteDuCoup(nil, nil, nil), "avant", "donnees absentes : un cote valide, jamais nil")
for _, cote in ipairs({ "avant", "arriere", "gauche", "droite" }) do
    local trouve = false
    for _, v in ipairs({ { x = 1, y = 0 }, { x = -1, y = 0 }, { x = 0, y = 1 }, { x = 0, y = -1 } }) do
        if (Combat.CoteDuCoup(AV, DR, v) == cote) then trouve = true end
    end
    ok(trouve, "le cote « " .. cote .. " » est atteignable")
end

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end