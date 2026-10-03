-- ══════════════════════════════════════════════════════════════════════════════
-- raccourcis-tests.lua — assertions sur Shared/Logic/Raccourcis.lua.
-- Chargé par raccourcis.mjs, qui fournit `Raccourcis`, `Narvos.Emotes` et
-- le global `FausseBaseRaccourcis`.
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

-- Une animation réelle du catalogue : coder un identifiant en dur le ferait
-- disparaître à la prochaine régénération.
local ANIM
for id in pairs(Narvos.Emotes.ANIMATIONS) do ANIM = id break end

-- ── Validation de touche ──────────────────────────────────────────────────────

section("ToucheValide")

egal(Raccourcis.ToucheValide("E"), true, "lettre acceptee")
egal(Raccourcis.ToucheValide("5"), true, "chiffre accepte")
egal(Raccourcis.ToucheValide("F7"), true, "F7 accepte")
egal(Raccourcis.ToucheValide("F12"), true, "F12 accepte")
-- Le pave numerique est volontairement REFUSE : on ne connait pas le nom que
-- nanos attend pour ces touches, et un nom invente cree un raccourci mort.
egal(Raccourcis.ToucheValide("NumPad3"), false, "pave numerique refuse (nom nanos inconnu)")

egal(Raccourcis.ToucheValide(""), false, "vide refuse")
egal(Raccourcis.ToucheValide(nil), false, "nil refuse sans lever")
egal(Raccourcis.ToucheValide(42), false, "nombre refuse sans lever")
egal(Raccourcis.ToucheValide("EE"), false, "deux lettres refusees")
egal(Raccourcis.ToucheValide("F13"), false, "F13 refuse")
egal(Raccourcis.ToucheValide("Ctrl+E"), false, "combinaison refusee")
egal(Raccourcis.ToucheValide("MouseLeft"), false, "souris refusee")

-- ⚠ Les touches de DEPLACEMENT restent refusees en dur : nanos les gere en
-- amont du script, les reassigner ne les libererait pas.
for _, t in ipairs({ "W", "A", "S", "D" }) do
    egal(Raccourcis.ToucheValide(t), false, "touche de deplacement refusee : " .. t)
end
egal(Raccourcis.ToucheValide("w"), false, "minuscule d'une touche de deplacement refusee aussi")

-- ⚠ CHANGEMENT DE COMPORTEMENT, 2026-09-03. `B`, `I`, `F3` et `F10` etaient
-- refusees EN DUR. Elles ne le sont plus, et c'est une CORRECTION, pas un
-- relachement : depuis que ces touches sont RECONFIGURABLES (Logic/Commandes),
-- la liste figee mentait dans les deux sens. Un joueur ayant deplace son
-- inventaire sur `J` se voyait toujours refuser `I` — devenue libre — et
-- pouvait poser une emote sur `J`, qui ne l'etait plus.
--
-- La verite vit desormais dans l'arbitre injecte, teste juste en dessous.
egal(Raccourcis.ToucheValide("B"), true, "B libre sans arbitre")
egal(Raccourcis.ToucheValide("I"), true, "I libre sans arbitre")
egal(Raccourcis.ToucheValide("F10"), true, "F10 libre sans arbitre")

-- ── L'arbitre des commandes ───────────────────────────────────────────────────

section("arbitre des commandes")

-- L'arbitre repond « quelle commande occupe cette touche, pour ce compte ».
-- On en pose un faux : le vrai lit la base, ce qui n'est pas ce qu'on teste ici.
Raccourcis.UtiliserArbitre(function(compte_id, touche)
    if (compte_id == 7 and touche == "P") then return "menu_props" end
    return nil
end)

egal(Raccourcis.ToucheValide("P", 7), false, "touche prise par une commande refusee")
egal(Raccourcis.ToucheValide("P", 8), true, "meme touche libre pour un AUTRE compte")
egal(Raccourcis.ToucheValide("K", 7), true, "touche libre acceptee malgre l'arbitre")

-- ⚠ Sans compte, l'arbitre ne peut pas repondre : on ne doit PAS refuser par
-- defaut. Refuser rendrait tout inassignable hors session, et le message
-- parlerait d'un conflit qui n'existe pas.
egal(Raccourcis.ToucheValide("P"), true, "sans compte, aucun conflit detectable")

-- On repose l'absence d'arbitre pour la suite : les tests ci-dessous ne
-- traitent pas des commandes, et un arbitre residuel les ferait echouer pour
-- une raison sans rapport.
Raccourcis.UtiliserArbitre(nil)

section("ToucheValide (suite)")

-- La casse ne doit pas creer deux raccourcis distincts sur la meme touche.
egal(Raccourcis.Normaliser("e"), "E", "normalisation en majuscule")
egal(Raccourcis.Normaliser(nil), "", "normalisation de nil sans lever")

-- ── Definir / ParCompte ───────────────────────────────────────────────────────

section("Definir / ParCompte")

local base = FausseBaseRaccourcis()
Raccourcis.UtiliserBase(base)

egal(select(1, Raccourcis.Definir(1, "E", ANIM)), true, "assignation reussie")
egal(Raccourcis.ParCompte(1)["E"], ANIM, "raccourci relu")

-- Minuscule : doit tomber sur la MEME touche, pas en creer une seconde.
Raccourcis.Definir(1, "e", ANIM)
local n = 0
for _ in pairs(Raccourcis.ParCompte(1)) do n = n + 1 end
egal(n, 1, "minuscule et majuscule sont la meme touche")

egal(select(1, Raccourcis.Definir(1, "W", ANIM)), false, "touche de deplacement refusee")

-- ⚠ `Definir` DOIT transmettre le compte a l'arbitre. Sans ce passage, la
-- validation ne verrait jamais les commandes du joueur et le conflit passerait
-- — c'est precisement le trou que l'arbitre existe pour fermer.
Raccourcis.UtiliserArbitre(function(compte_id, touche)
    if (compte_id == 1 and touche == "P") then return "menu_props" end
    return nil
end)
egal(select(1, Raccourcis.Definir(1, "P", ANIM)), false, "conflit avec une commande refuse")
egal(select(1, Raccourcis.Definir(2, "P", ANIM)), true, "meme touche acceptee sur un autre compte")
Raccourcis.UtiliserArbitre(nil)
egal(select(1, Raccourcis.Definir(1, "E", "animation_inexistante")), false, "animation inconnue refusee")
egal(select(1, Raccourcis.Definir(nil, "E", ANIM)), false, "compte absent refuse")

-- Reassigner une touche deja prise doit REECRIRE, pas echouer : c'est ce que le
-- joueur attend.
local autre
for id in pairs(Narvos.Emotes.ANIMATIONS) do
    if (id ~= ANIM) then autre = id break end
end
egal(select(1, Raccourcis.Definir(1, "E", autre)), true, "reassignation acceptee")
egal(Raccourcis.ParCompte(1)["E"], autre, "la reassignation a bien remplace")

-- Cloisonnement des comptes.
Raccourcis.Definir(2, "R", ANIM)
egal(Raccourcis.ParCompte(1)["R"], nil, "le raccourci d'un autre compte n'apparait pas")
egal(Raccourcis.ParCompte(2)["R"], ANIM, "chaque compte a les siens")

egal(next(Raccourcis.ParCompte(999)), nil, "compte sans raccourci rend une table vide")
egal(next(Raccourcis.ParCompte(nil)), nil, "compte nil rend une table vide sans lever")

-- ── Animation disparue ────────────────────────────────────────────────────────
--
-- C'est ce qui rend le systeme evolutif : retirer un pack ne doit pas casser le
-- menu, le raccourci devient inerte.

section("animation disparue")

base:Injecter(1, "T", "anim_qui_nexiste_plus")
egal(Raccourcis.ParCompte(1)["T"], nil, "un raccourci vers une animation absente est ignore")
ok(Raccourcis.ParCompte(1)["E"] ~= nil, "les autres raccourcis survivent")

-- ── Retirer ───────────────────────────────────────────────────────────────────

section("Retirer")

egal(Raccourcis.Retirer(1, "E"), true, "retrait reussi")
egal(Raccourcis.ParCompte(1)["E"], nil, "la touche est libre")
egal(Raccourcis.Retirer(1, "E"), false, "retirer une touche libre echoue")

-- ⚠ Retrait croise : la touche vient du client, sans compte_id dans le WHERE un
-- joueur effacerait les raccourcis d'un autre.
Raccourcis.Definir(2, "Y", ANIM)
egal(Raccourcis.Retirer(1, "Y"), false, "un compte ne peut pas retirer le raccourci d'un autre")
egal(Raccourcis.ParCompte(2)["Y"], ANIM, "le raccourci de l'autre compte est intact")

-- ── Plafond ───────────────────────────────────────────────────────────────────

section("plafond")

local lettres = "CEFGHJKLMNOPQRTUVXYZ"
for i = 1, #lettres do
    Raccourcis.Definir(3, lettres:sub(i, i), ANIM)
end
local compte = 0
for _ in pairs(Raccourcis.ParCompte(3)) do compte = compte + 1 end
ok(compte <= Raccourcis.MAX, "le plafond est respecte (" .. compte .. ")")

-- Reassigner une touche DEJA prise doit rester possible meme a la limite.
if (compte >= Raccourcis.MAX) then
    egal(select(1, Raccourcis.Definir(3, "C", autre)), true,
         "reassignation possible meme au plafond")
end

-- ── Hors base ─────────────────────────────────────────────────────────────────

section("hors base")

Raccourcis.UtiliserBase(nil)
egal(Raccourcis.Prete(), false, "Prete() faux sans base")
egal(next(Raccourcis.ParCompte(1)), nil, "lecture vide sans base")
egal(select(1, Raccourcis.Definir(1, "E", ANIM)), false, "ecriture impossible sans base")
egal(Raccourcis.Retirer(1, "E"), false, "retrait impossible sans base")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end