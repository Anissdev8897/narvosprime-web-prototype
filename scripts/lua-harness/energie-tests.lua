-- ══════════════════════════════════════════════════════════════════════════════
-- energie-tests.lua — assertions sur Shared/Logic/Energie.lua.
-- ══════════════════════════════════════════════════════════════════════════════

local reussis, echecs = 0, 0

local function ok(c, nom)
    if (c) then reussis = reussis + 1
    else echecs = echecs + 1; print("  ECHEC  " .. nom) end
end

local function egal(obtenu, attendu, nom)
    if (obtenu == attendu) then reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu=" .. tostring(attendu))
    end
end

local function presque(obtenu, attendu, tol, nom)
    if (math.abs(obtenu - attendu) <= tol) then reussis = reussis + 1
    else
        echecs = echecs + 1
        print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(obtenu) .. "  attendu~=" .. tostring(attendu))
    end
end

local function section(n) print("[" .. n .. "]") end

-- ── État neuf ─────────────────────────────────────────────────────────────────

section("etat_neuf")

local etat = {}
egal(Energie.Reserve(etat, 0), Energie.DEPART, "un etat vierge part plein")
egal(etat.reserve, Energie.DEPART, "la reserve est posee dans l'etat")

-- ── Régénération paresseuse ───────────────────────────────────────────────────

section("regen")

local etat2 = { reserve = 50, dernier = 10000 }
-- Repos de 5 s : (5000 - 1500)/1000 * 15 = 52,5 -> 102,5 -> plafonné à 100.
egal(Energie.Reserve(etat2, 15000), Energie.MAX, "regen plafonnee au maximum")
egal(etat2.dernier, 15000, "la lecture recale l'horloge")

-- Repos insuffisant : pas de regen, l'horloge ne bouge pas.
local etat3 = { reserve = 40, dernier = 10000 }
egal(Energie.Reserve(etat3, 11000), 40, "repos trop court : rien ne regenere")
egal(etat3.dernier, 10000, "l'horloge reste au dernier usage")

-- Regen partielle : repos de 2,5 s -> (2500-1500)/1000*15 = 15 points.
local etat4 = { reserve = 10, dernier = 10000 }
egal(Energie.Reserve(etat4, 12500), 25, "regen partielle exacte")

-- ── Dépense ───────────────────────────────────────────────────────────────────

section("depense")

local etat5 = { reserve = 100, dernier = 0 }
egal(Energie.Peut(etat5, 55, 0), true, "100 permet 55")
egal(Energie.Depenser(etat5, 55, 0), 45, "reste 45 apres 55")
egal(Energie.Peut(etat5, 55, 0), false, "45 ne permet plus 55")

-- La dépense ne descend jamais sous zéro.
local etat6 = { reserve = 10, dernier = 0 }
egal(Energie.Depenser(etat6, 30, 0), 0, "depense plafonnee a zero")

-- ── Purge (pendant l'escalade) ────────────────────────────────────────────────

section("purge")

local etat7 = { reserve = 2, dernier = 0 }
egal(Energie.Purger(etat7, 1, 0), true, "purge 1 : il reste 1")
egal(Energie.Purger(etat7, 1, 0), false, "purge 1 : reserve vide -> retomber")
egal(Energie.Purger(etat7, 1, 0), false, "purge 1 : toujours vide -> retomber")

-- ── Constantes ────────────────────────────────────────────────────────────────

section("constantes")

ok(Energie.COUTS.vault < Energie.COUTS.mantle, "vault moins cher que mantle")
ok(Energie.COUTS.mantle < Energie.COUTS.climb, "mantle moins cher que grimper")
ok(Energie.COUTS.climb < Energie.MAX, "grimper possible a pleine reserve")
ok(Energie.REGEN_S > 0, "regen positive")
ok(Energie.DELAI_REGEN_MS > 0, "delai de regen positif")

-- ── Resume ────────────────────────────────────────────────────────────────────

section("resume")

print("")
print(reussis .. " réussis, " .. echecs .. " échoués")
if (echecs > 0) then error("des tests ont échoué", 0) end