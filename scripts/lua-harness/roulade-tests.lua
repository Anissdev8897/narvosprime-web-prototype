-- ══════════════════════════════════════════════════════════════════════════════
-- roulade-tests.lua — assertions sur Shared/Logic/Roulade.lua.
-- Les noms M_Neutral_Jump_F_Land_Roll viennent du CATALOGUE RÉEL (injectés par
-- roulade.mjs) : le test est représentatif de ce qui tourne en jeu.
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

local function section(n) print("[" .. n .. "]") end

-- ── Clip cuite dans le catalogue réel ─────────────────────────────────────────

section("catalogue")

local sets = Animations.Grouper(NOMS_ROULADE)
ok(Roulade.Verifier(sets), "le clip de reception est cuit (via le vrai Grouper)")

local parMode = sets[Roulade.CLIP]
ok(parMode and parMode["-"], "clip sans mode range sous '-'")
if (parMode and parMode["-"]) then
    egal(parMode["-"][1], Roulade.CLIP, "la premiere prise est le clip nomme")
end

-- ── Verifier : les manques remontent ──────────────────────────────────────────

section("verifier")

ok(not Roulade.Verifier(nil), "sets nil -> non cuit")
ok(not Roulade.Verifier({}), "sets vides -> non cuit")
ok(not Roulade.Verifier({ Autre_Clip = { ["-"] = { "Autre_Clip" } } }), "clip absent -> non cuit")

-- ── Constantes ────────────────────────────────────────────────────────────────

section("constantes")

ok(Roulade.CLIP:find("Land_Roll", 1, true) ~= nil, "le clip est bien une roulade de reception")
ok(Roulade.COOLDOWN_MS > 0, "recharge positive")
ok(Roulade.FONDU_SORTIE >= Roulade.FONDU_ENTREE, "fondu de sortie au moins egal a l'entree")

-- ── Resume ────────────────────────────────────────────────────────────────────

section("resume")

print("")
print(reussis .. " réussis, " .. echecs .. " échoués")
if (echecs > 0) then error("des tests ont échoué", 0) end