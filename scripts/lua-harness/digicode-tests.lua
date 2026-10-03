-- ══════════════════════════════════════════════════════════════════════════════
-- digicode-tests.lua — assertions sur Logic/Digicode.lua.
-- Chargé par digicode.mjs, qui fournit `Digicode`, le VRAI `Crypto` (SHA-256,
-- comparaison à temps constant) et le VRAI catalogue d'objets `VRAIS_ITEMS`.
--
-- Ce que ces tests ferment (2026-09-13) : une porte à code dont le code se
-- devinerait à la main (pas de blocage), se lirait en base (code en clair), ou
-- se contournerait par une faute de format comptée comme un essai valide.
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(condition, nom)
    if (condition) then reussis = reussis + 1
    else echecs = echecs + 1; print("  ECHEC  " .. nom) end
end

local function egal(obtenu, attendu, nom)
    ok(obtenu == attendu, nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
end

local function section(nom) print("[" .. nom .. "]") end

local HACHER = function(texte) return Crypto.Sha256Hex(texte) end
local EGAL = function(a, b) return Crypto.EgalConstant(a, b) end

-- ══════════════════════════════════════════════════════════════════════════════
section("l'objet et le format du code")

ok(VRAIS_ITEMS[Digicode.OBJET] ~= nil, "l'objet digicode existe au catalogue (" .. tostring(Digicode.OBJET) .. ")")

egal(Digicode.CodeValide("1234"), true, "4 chiffres : valide")
egal(Digicode.CodeValide(string.rep("9", Digicode.LONGUEUR_MAX)), true, "longueur maximale : valide")
egal(Digicode.CodeValide(string.rep("1", Digicode.LONGUEUR_MIN - 1)), false, "trop court : refusé")
egal(Digicode.CodeValide(string.rep("1", Digicode.LONGUEUR_MAX + 1)), false, "trop long : refusé")
egal(Digicode.CodeValide("12a4"), false, "une lettre : refusé")
egal(Digicode.CodeValide(" 1234"), false, "un espace : refusé (le clavier n'a pas d'espace)")
egal(Digicode.CodeValide(1234), false, "un NOMBRE et non une chaîne : refusé (« 0012 » perdrait ses zéros)")
egal(Digicode.CodeValide(nil), false, "nil : refusé")
ok(type(select(2, Digicode.CodeValide("12"))) == "string", "le refus porte sa raison")

-- ══════════════════════════════════════════════════════════════════════════════
section("la serrure ne garde JAMAIS le code en clair")

local serrure, raison = Digicode.NouvelleSerrure("porte-1", "4321", "sel-fixe", HACHER)
ok(serrure ~= nil, "serrure créée (raison=" .. tostring(raison) .. ")")
if (serrure) then
    egal(serrure.id, "porte-1", "l'identifiant est gardé")
    egal(serrure.sel, "sel-fixe", "le sel est gardé")
    ok(type(serrure.empreinte) == "string" and #serrure.empreinte == 64, "l'empreinte est un SHA-256 hexadécimal")
    local visible = false
    for _, v in pairs(serrure) do
        if (type(v) == "string" and v:find("4321", 1, true)) then visible = true end
    end
    egal(visible, false, "le code n'apparaît dans AUCUN champ de la serrure")
end
egal(Digicode.NouvelleSerrure("porte-2", "12", "sel", HACHER), nil, "code invalide : pas de serrure")
egal(Digicode.NouvelleSerrure("porte-3", "1234", "", HACHER), nil, "sel vide : pas de serrure (deux portes au même code auraient la même empreinte)")

-- Deux portes au même code, sels différents : empreintes différentes.
local s_a = Digicode.NouvelleSerrure("a", "1111", "sel-a", HACHER)
local s_b = Digicode.NouvelleSerrure("b", "1111", "sel-b", HACHER)
ok(s_a and s_b and s_a.empreinte ~= s_b.empreinte, "même code, sels différents : empreintes différentes")

-- ══════════════════════════════════════════════════════════════════════════════
section("essayer un code")

local essais = Digicode.NouveauxEssais()
local bon, r_bon, essais2 = Digicode.Essayer(essais, serrure, "4321", 100, HACHER, EGAL)
egal(bon, true, "le bon code ouvre")
egal(essais2.echecs, 0, "un succès remet les échecs à zéro")
egal(essais.echecs, 0, "Essayer ne modifie pas l'état reçu")

local mauvais, r_mauvais, e1 = Digicode.Essayer(essais, serrure, "0000", 100, HACHER, EGAL)
egal(mauvais, false, "un mauvais code n'ouvre pas")
egal(e1.echecs, 1, "un mauvais code compte un échec")
ok(type(r_mauvais) == "string", "le refus porte sa raison")

-- ⚠ UNE FAUTE DE FORMAT N'EST PAS UN ESSAI. Elle n'ouvre pas, et elle ne consume
-- pas d'essai : sinon un doigt qui glisse bloquerait le propriétaire.
local faute, _, e_faute = Digicode.Essayer(essais, serrure, "12", 100, HACHER, EGAL)
egal(faute, false, "format invalide : n'ouvre pas")
egal(e_faute.echecs, 0, "format invalide : ne compte PAS d'échec")

-- Le blocage après ESSAIS_MAX échecs.
local e = Digicode.NouveauxEssais()
for i = 1, Digicode.ESSAIS_MAX do
    local _, _, suivant = Digicode.Essayer(e, serrure, "0000", 200, HACHER, EGAL)
    e = suivant
end
ok(e.bloque_jusqu_a >= 200 + Digicode.BLOCAGE_S, "après " .. Digicode.ESSAIS_MAX .. " échecs, le clavier est bloqué")
local bloque, r_bloque = Digicode.Essayer(e, serrure, "4321", 201, HACHER, EGAL)
egal(bloque, false, "PENDANT le blocage, même le bon code est refusé")
ok(type(r_bloque) == "string" and r_bloque:find("bloque", 1, true) ~= nil, "la raison dit que le clavier est bloqué")
local libre = Digicode.Essayer(e, serrure, "4321", 200 + Digicode.BLOCAGE_S, HACHER, EGAL)
egal(libre, true, "à la fin du blocage, le bon code ouvre")

egal(Digicode.Essayer(essais, nil, "4321", 100, HACHER, EGAL), false, "serrure absente : refusé sans lever")
egal(Digicode.Essayer(essais, serrure, "4321", nil, HACHER, EGAL), false, "instant inconnu : refusé")

-- ══════════════════════════════════════════════════════════════════════════════
section("la porte ouverte")

local ouverte_jusqu_a = Digicode.OuvertureJusqua(1000)
egal(ouverte_jusqu_a, 1000 + Digicode.OUVERTURE_S, "la porte reste ouverte OUVERTURE_S secondes")
egal(Digicode.EstOuverte(ouverte_jusqu_a, 1000), true, "ouverte juste après")
egal(Digicode.EstOuverte(ouverte_jusqu_a, 1000 + Digicode.OUVERTURE_S), false, "fermée à l'échéance")
egal(Digicode.EstOuverte(nil, 1000), false, "jamais ouverte : fermée")

-- ══════════════════════════════════════════════════════════════════════════════
section("le lien avec les zones")

-- Qui a le droit d'ÉDITER à l'emplacement de la porte (Logic/Zones.PeutEditer)
-- la pose, en change le code, et passe SANS code. Les autres doivent le taper.
egal(Digicode.PasseDroit(true), true, "droit d'édition sur place : passe sans code")
egal(Digicode.PasseDroit(false), false, "sans droit d'édition : il faut le code")
egal(Digicode.PasseDroit(nil), false, "droit inconnu : il faut le code (garde fermée par défaut)")

print("")
print(string.format("%d reussis, %d echec(s)", reussis, echecs))
REUSSIS, ECHECS = reussis, echecs
if (echecs > 0) then error(echecs .. " test(s) en echec") end