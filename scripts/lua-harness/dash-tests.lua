-- ══════════════════════════════════════════════════════════════════════════════
-- dash-tests.lua — assertions sur Shared/Logic/Dash.lua.
-- Les noms ACB_Dash utilisés viennent du CATALOGUE RÉEL (injectés par dash.mjs),
-- pas d'exemples inventés : le test est représentatif de ce qui tourne en jeu.
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

-- ── Direction depuis un vecteur d'intention ───────────────────────────────────

section("direction")

-- Convention mesurée sur Frappes/Sorts : x = avant, y = droite.
egal(Dash.DirectionDepuis({ x = 1, y = 0 }), "avant", "axe x positif -> avant")
egal(Dash.DirectionDepuis({ x = -1, y = 0 }), "arriere", "axe x negatif -> arriere")
egal(Dash.DirectionDepuis({ x = 0, y = 1 }), "droite", "axe y positif -> droite")
egal(Dash.DirectionDepuis({ x = 0, y = -1 }), "gauche", "axe y negatif -> gauche")

-- Diagonale parfaite : l'avant/arriere prime (convention >=, plus lisible en jeu).
egal(Dash.DirectionDepuis({ x = 1, y = 1 }), "avant", "diagonale parfaite -> avant")

-- Diagonale non equilibrée : l'axe dominant gagne.
egal(Dash.DirectionDepuis({ x = 0.3, y = 0.95 }), "droite", "diagonale penchee -> droite")
egal(Dash.DirectionDepuis({ x = -0.9, y = 0.4 }), "arriere", "diagonale penchee -> arriere")

-- Entrées dégradées : jamais d'erreur, jamais de direction inventée.
egal(Dash.DirectionDepuis(nil), nil, "vecteur nil rend nil")
egal(Dash.DirectionDepuis({ x = 0, y = 0 }), nil, "vecteur nul rend nil")
egal(Dash.DirectionDepuis({}), nil, "vecteur vide rend nil")

-- Un vecteur non normalisé doit donner la même direction que son normalisé.
egal(Dash.DirectionDepuis({ x = 50, y = 0 }), "avant", "norme libre : la direction seule compte")

-- ── Intégration catalogue réel → clips ────────────────────────────────────────

section("integration")

-- Le catalogue réel (16 noms cuits) passe par le vrai Grouper.
local sets = Animations.Grouper(NOMS_DASH)

local manquants = Dash.Verifier(sets)
egal(#manquants, 0, "aucune direction sans clip : " .. table.concat(manquants, ", "))

-- Les quatre bases donnent chacune un clip IP réel.
for _, direction in ipairs({ "avant", "arriere", "gauche", "droite" }) do
    local clip = Animations.Choisir(sets, Dash.CLIPS[direction], "IP", nil, function() return 0 end)
    ok(clip ~= nil, "clip IP reel pour " .. direction)
    ok(clip ~= nil and clip:find("_IP", 1, true) ~= nil, "mode IP respecte pour " .. direction)
end

-- ── Verifier : les manques remontent, pas en silence ──────────────────────────

section("verifier")

local incomplets = {
    ACB_Dash_Forward = { IP = { "ACB_Dash_Forward_IP_Anim" } },
    ACB_Dash_Backward = { IP = { "ACB_Dash_Backward_IP_Anim" } },
    ACB_Dash_Left = { IP = { "ACB_Dash_Left_IP_Anim" } },
    -- ACB_Dash_Right absent exprès
}
local manquants2 = Dash.Verifier(incomplets)
egal(#manquants2, 1, "une direction manquante signalee")
egal(manquants2[1], "ACB_Dash_Right", "c'est la droite qui manque")

egal(#Dash.Verifier(nil), 4, "sets nil -> les quatre directions manquent")
egal(#Dash.Verifier({}), 4, "sets vides -> les quatre directions manquent")

-- ── Constantes ────────────────────────────────────────────────────────────────

section("constantes")

ok(Dash.FORCE > 0, "l'impulsion est positive")
ok(Dash.COOLDOWN_MS >= Dash.DUREE_MS, "la recharge couvre au moins le geste")
ok(Dash.SEUIL_VITESSE < Dash.FORCE, "le seuil d'immobilite reste sous l'impulsion")

-- ── Resume ────────────────────────────────────────────────────────────────────

section("resume")

print("")
print(reussis .. " réussis, " .. echecs .. " échoués")
if (echecs > 0) then error("des tests ont échoué", 0) end