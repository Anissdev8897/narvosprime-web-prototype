-- ═══════════════════════════════════════════════════════════════════════════════
-- droits-tests.lua — qui est administrateur.
--
-- Ce que ces tests protègent, par ordre de gravité :
--   1. un DROIT ACCORDÉ À TORT — un pseudo, un fragment d'identifiant, une valeur
--      abîmée qui tombe par hasard sur quelqu'un d'autre ;
--   2. un droit REFUSÉ en silence au propriétaire — l'identifiant mal écrit dans
--      la config, qui ne se voit qu'au moment où il veut éditer.
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

local PROPRIO = "76561198254124189"      -- relevé dans narvos_comptes.db

-- ── 1. Normaliser ────────────────────────────────────────────────────────────
print("[1. normaliser]")

eq(Droits.Normaliser(PROPRIO), PROPRIO, "chaine valide")
eq(Droits.Normaliser("  " .. PROPRIO .. "  "), PROPRIO, "espaces rognes")
-- Entier Lua 5.4 : exact sur 64 bits.
eq(Droits.Normaliser(76561198254124189), PROPRIO, "entier 64 bits exact")

-- ⚠ LE PIÈGE : un flottant a DÉJÀ perdu ses derniers chiffres. Il doit être
-- refusé, pas arrondi vers un voisin.
local id_f, raison_f = Droits.Normaliser(76561198254124189.0)
eq(id_f, nil, "flottant refuse")
ok(raison_f and raison_f:find("flottant") ~= nil, "la raison nomme le flottant")

eq(Droits.Normaliser("Hanibes"), nil, "un pseudo n'est pas un identifiant")
eq(Droits.Normaliser("7656119825412418"), nil, "16 chiffres refuses")
eq(Droits.Normaliser("765611982541241890"), nil, "18 chiffres refuses")
eq(Droits.Normaliser("12345678901234567"), nil, "17 chiffres sans le prefixe Steam refuses")
eq(Droits.Normaliser("76561198254124189x"), nil, "suffixe parasite refuse")
eq(Droits.Normaliser(""), nil, "vide refuse")
eq(Droits.Normaliser(nil), nil, "nil refuse")
eq(Droits.Normaliser({}), nil, "table refusee")

-- ── 2. Ensemble ──────────────────────────────────────────────────────────────
print("[2. ensemble]")

local e1 = Droits.Ensemble({ admins_steam = { PROPRIO } })
eq(Droits.Compte(e1), 1, "liste d'un element")

local e2, r2 = Droits.Ensemble({ admins_steam = PROPRIO .. ", 76561198000000001" })
eq(Droits.Compte(e2), 2, "chaine separee par des virgules")
eq(#r2, 0, "aucun refus sur deux identifiants valides")

local e3, r3 = Droits.Ensemble({ admins_steam = { PROPRIO, "Hanibes", 3.5 } })
eq(Droits.Compte(e3), 1, "les valeurs invalides sont ecartees")
eq(#r3, 2, "et elles sont RAPPORTEES, pas avalees")

eq(Droits.Compte(Droits.Ensemble(nil)), 0, "pas de config : aucun admin (ferme par defaut)")
eq(Droits.Compte(Droits.Ensemble({})), 0, "config sans cle : aucun admin")
local _, r4 = Droits.Ensemble({ admins_steam = 42 })
eq(#r4, 1, "un type inattendu est rapporte")

-- ── 3. EstAdmin ──────────────────────────────────────────────────────────────
print("[3. est admin]")

eq(Droits.EstAdmin(PROPRIO, e1), true, "le proprietaire est admin")
eq(Droits.EstAdmin("76561198000000002", e1), false, "un autre compte ne l'est pas")
eq(Droits.EstAdmin("Hanibes", e1), false, "le PSEUDO ne donne aucun droit")
eq(Droits.EstAdmin(nil, e1), false, "sans identifiant : non")
eq(Droits.EstAdmin(PROPRIO, nil), false, "sans ensemble : non")
eq(Droits.EstAdmin(PROPRIO, {}), false, "ensemble vide : non")

-- Un fragment ne doit jamais correspondre.
eq(Droits.EstAdmin(PROPRIO:sub(1, 16), e1), false, "un fragment ne correspond pas")

print(string.format("%d reussis, %d echec(s)", reussis, echoues))
if (echoues > 0) then error("droits-tests : " .. echoues .. " echec(s)") end