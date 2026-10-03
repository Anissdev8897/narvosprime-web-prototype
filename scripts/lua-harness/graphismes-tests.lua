-- ══════════════════════════════════════════════════════════════════════════════
-- graphismes-tests.lua — assertions sur Shared/Logic/Graphismes.lua.
-- Chargé par graphismes.mjs, qui fournit `Graphismes`.
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

-- ── Les trois niveaux existent, et seulement eux ──────────────────────────────

section("Niveaux")

egal(#Graphismes.NIVEAUX, 3, "trois niveaux, pas plus")
egal(Graphismes.NIVEAUX[1], "faible", "le premier est le moins cher")
egal(Graphismes.NIVEAUX[2], "moyen",  "le deuxieme")
egal(Graphismes.NIVEAUX[3], "eleve",  "le troisieme est le plus cher")

for _, n in ipairs(Graphismes.NIVEAUX) do
    ok(Graphismes.PROFILS[n] ~= nil,  "profil present pour " .. n)
    ok(Graphismes.LIBELLES[n] ~= nil, "libelle present pour " .. n)
    ok(Graphismes.RESUMES[n] ~= nil,  "resume present pour " .. n)
end

-- Le compte doit correspondre des DEUX cotes : une entree en trop dans PROFILS
-- serait un niveau que l'interface n'affiche jamais.
local nb_profils = 0
for _ in pairs(Graphismes.PROFILS) do nb_profils = nb_profils + 1 end
egal(nb_profils, #Graphismes.NIVEAUX, "aucun profil orphelin hors de NIVEAUX")

ok(Graphismes.Existe(Graphismes.DEFAUT), "le niveau par defaut est un niveau connu")

-- ── Normaliser rend TOUJOURS un niveau ────────────────────────────────────────
--
-- C'est l'assertion qui compte le plus. `PostProcess.SetBloom(nil, nil)` ne leve
-- pas : un nil qui traverse produit un rendu faux et silencieux.

section("Normaliser ne rend jamais nil")

egal(Graphismes.Normaliser("faible"), "faible", "un niveau valide passe tel quel")
egal(Graphismes.Normaliser("eleve"),  "eleve",  "idem pour eleve")

for _, absurde in ipairs({ "ultra", "", "FAIBLE", "Moyen", "élevé" }) do
    ok(Graphismes.Existe(Graphismes.Normaliser(absurde)),
       "entree invalide ramenee a un niveau connu : " .. absurde)
end

-- `ipairs` s'arrete au premier nil : ces trois-la se testent separement.
ok(Graphismes.Existe(Graphismes.Normaliser(nil)),   "nil ramene a un niveau connu")
ok(Graphismes.Existe(Graphismes.Normaliser(42)),    "un nombre ramene a un niveau connu")
ok(Graphismes.Existe(Graphismes.Normaliser({})),    "une table ramenee a un niveau connu")
ok(Graphismes.Existe(Graphismes.Normaliser(false)), "un booleen ramene a un niveau connu")

egal(Graphismes.Normaliser(nil), Graphismes.DEFAUT, "le repli est bien le defaut declare")

-- ── Les profils sont complets, et cohérents entre eux ─────────────────────────
--
-- Une cle manquante dans un seul profil se traduit par `SetBloom(nil)` a ce
-- niveau-la, et a ce niveau-la seulement. C'est le pire cas : ca marche a la
-- verification, ca casse chez le joueur qui a choisi l'autre niveau.

section("Profils complets")

local CLES = {
    "bloom_intensite", "bloom_seuil", "aberration_intensite", "aberration_depart",
    "vignette", "grain", "nuages", "brouillard", "plan_proche",
    "ecran_sang", "ombres", "cull",
}

for _, n in ipairs(Graphismes.NIVEAUX) do
    local p = Graphismes.PROFILS[n]
    for _, cle in ipairs(CLES) do
        ok(p[cle] ~= nil, n .. " declare " .. cle)
    end
    -- Aucune cle en trop : une cle que l'executant ne lit pas est du bruit, et
    -- une faute de frappe (`vignete`) laisse la vraie cle a nil sans rien dire.
    local nb = 0
    for _ in pairs(p) do nb = nb + 1 end
    egal(nb, #CLES, n .. " n'a aucune cle en trop")
end

-- ── L'ordre du moins cher au plus cher est réellement tenu ────────────────────
--
-- Ce n'est pas cosmetique : si `faible` coutait plus que `eleve`, le joueur qui
-- baisse la qualite perdrait des images par seconde. Personne ne penserait a
-- verifier ca — et le symptome serait « le menu graphique ne sert a rien ».

section("Monotonie du cout")

local function croissant(cle, nom)
    local f = Graphismes.PROFILS.faible[cle]
    local m = Graphismes.PROFILS.moyen[cle]
    local e = Graphismes.PROFILS.eleve[cle]
    ok(f <= m and m <= e, nom .. " croit de faible a eleve (" .. f .. " / " .. m .. " / " .. e .. ")")
end

croissant("bloom_intensite",      "l'intensite du bloom")
croissant("vignette",             "la vignette")
croissant("grain",                "le grain")
croissant("nuages",               "la couverture nuageuse")
croissant("brouillard",           "le brouillard")
croissant("aberration_intensite", "l'aberration chromatique")
croissant("cull",                 "la distance d'affichage")

-- Le plan proche va dans l'AUTRE sens : plus il est loin, moins on dessine.
local pf = Graphismes.PROFILS.faible.plan_proche
local pm = Graphismes.PROFILS.moyen.plan_proche
local pe = Graphismes.PROFILS.eleve.plan_proche
ok(pf >= pm and pm >= pe, "le plan proche recule quand la qualite baisse")

ok(Graphismes.PROFILS.faible.ombres == false, "faible coupe les ombres portees")
ok(Graphismes.PROFILS.eleve.ombres  == true,  "eleve les garde")

-- ⚠ Unites : `cull` est en CENTIMETRES. 15 000 = 150 m. Un profil sous 10 000
-- ferait disparaitre le decor a moins de 100 m — c'est l'erreur metre/centimetre
-- qui a rendu 31 PNJ hauts de 1,7 cm.
for _, n in ipairs(Graphismes.NIVEAUX) do
    ok(Graphismes.PROFILS[n].cull >= 10000,
       n .. " garde une portee d'au moins 100 m (valeur en cm)")
end

-- ── Profil rend une COPIE ─────────────────────────────────────────────────────

section("Profil est isole")

local a = Graphismes.Profil("moyen")
a.bloom_intensite = 999
local b = Graphismes.Profil("moyen")
egal(b.bloom_intensite, Graphismes.PROFILS.moyen.bloom_intensite,
     "ecrire dans un profil rendu ne contamine pas le suivant")
egal(Graphismes.PROFILS.moyen.bloom_intensite ~= 999, true,
     "la table interne est intacte")

local c = Graphismes.Profil("n'existe pas")
ok(c ~= nil and c.bloom_intensite ~= nil, "Profil sur une entree invalide rend quand meme un profil")

-- ── Suivant tourne en rond ────────────────────────────────────────────────────

section("Suivant")

egal(Graphismes.Suivant("faible"), "moyen",  "faible -> moyen")
egal(Graphismes.Suivant("moyen"),  "eleve",  "moyen -> eleve")
egal(Graphismes.Suivant("eleve"),  "faible", "eleve -> faible, la boucle est fermee")
ok(Graphismes.Existe(Graphismes.Suivant(nil)), "Suivant(nil) rend un niveau connu")

-- Trois pas ramenent au depart, quel que soit le point de depart.
for _, n in ipairs(Graphismes.NIVEAUX) do
    egal(Graphismes.Suivant(Graphismes.Suivant(Graphismes.Suivant(n))), n,
         "trois pas depuis " .. n .. " reviennent a " .. n)
end

-- ── PourInterface : UNE seule source pour les libellés ────────────────────────
--
-- Le JavaScript ne doit rien recopier. Une liste recopiee diverge toujours de sa
-- source — `Roster.EncoderCouleurs` iterait `{skin, hair, jacket}` ecrit en dur
-- alors que les vraies cibles s'appelaient autrement, et rendait une chaine VIDE
-- sans le moindre signal.

section("PourInterface")

local vue = Graphismes.PourInterface("moyen")
egal(#vue, 3, "trois entrees rendues")

local actifs = 0
for i, e in ipairs(vue) do
    egal(e.id, Graphismes.NIVEAUX[i], "l'ordre de NIVEAUX est respecte en position " .. i)
    ok(e.libelle ~= nil and e.libelle ~= "", "libelle non vide pour " .. e.id)
    ok(e.resume ~= nil and e.resume ~= "",   "resume non vide pour " .. e.id)
    egal(e.libelle, Graphismes.LIBELLES[e.id], "le libelle vient de LIBELLES, pas d'une copie")
    egal(e.resume,  Graphismes.RESUMES[e.id],  "le resume vient de RESUMES, pas d'une copie")
    if (e.actif) then actifs = actifs + 1 end
end
egal(actifs, 1, "exactement un niveau marque actif")

for _, e in ipairs(vue) do
    if (e.id == "moyen") then ok(e.actif, "c'est bien le niveau demande qui est actif") end
end

-- ── Les chiffres affiches sont DERIVES, pas recopies ──────────────────────────
--
-- Une interface qui annonce « portee reduite » ne se verifie pas. Une qui
-- annonce 150 m se verifie en marchant. Ces assertions garantissent que le
-- chiffre affiche suit le profil, et ne se fige pas quand le profil change.

section("Details derives")

for _, e in ipairs(vue) do
    ok(e.details ~= nil, "details presents pour " .. e.id)
    egal(e.details.portee_m, math.floor(Graphismes.PROFILS[e.id].cull / 100),
         e.id .. " : la portee affichee est cull/100")
    egal(e.details.ombres, Graphismes.PROFILS[e.id].ombres,
         e.id .. " : les ombres affichees sont celles du profil")
end

-- ⚠ La conversion cm -> m se fait UNE fois, en Lua. Si le JavaScript la refaisait,
-- on aurait 1,5 m au lieu de 150 : c'est l'erreur metre/centimetre qui a rendu
-- 31 PNJ hauts de 1,7 cm.
egal(vue[1].details.portee_m, 150, "faible affiche bien 150 m, pas 15000 ni 1")

-- `effets` dit s'il reste un effet d'image. Faible n'en a aucun — c'est la
-- promesse du niveau, elle doit se lire dans la donnee et pas seulement dans le
-- texte du resume.
egal(vue[1].details.effets, false, "faible n'annonce aucun effet d'image")
egal(vue[3].details.effets, true,  "eleve en annonce")

-- Sur une entree invalide, l'interface reste utilisable : un menu graphique ou
-- aucun bouton n'est marque laisse le joueur sans savoir ou il en est.
local vue_nil = Graphismes.PourInterface(nil)
local actifs_nil = 0
for _, e in ipairs(vue_nil) do if (e.actif) then actifs_nil = actifs_nil + 1 end end
egal(actifs_nil, 1, "meme sur une entree invalide, un niveau est marque actif")

-- ── Bilan ─────────────────────────────────────────────────────────────────────

print("")
print(reussis .. " reussis, " .. echecs .. " echec(s)")
if (echecs > 0) then error("des assertions ont echoue", 0) end