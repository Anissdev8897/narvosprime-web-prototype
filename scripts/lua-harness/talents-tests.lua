-- Tests de Shared/Logic/Talents.lua (investir/rembourser/reset, auto-compté).
local reussis, echecs = 0, 0
local function ok(c, n) if c then reussis = reussis + 1 else echecs = echecs + 1; print("  ÉCHEC: " .. n) end end
local function egal(a, b, n) ok(a == b, n .. " (obtenu " .. tostring(a) .. ", attendu " .. tostring(b) .. ")") end

-- Investir : niveau 15 → 3 points, dmg_sharp (maxRank 3) + dmg_precise.
local e0 = { niveau = 15, talents = {} }
local e1 = Talents.Investir(e0, "dmg_sharp")
egal(e1.talents.dmg_sharp, 1, "investir dmg_sharp → rang 1")
egal(e0.talents.dmg_sharp, nil, "l'état d'origine n'est pas muté (immuable)")

-- Déverrouillage : dmg_precise exige dmg_sharp ≥ 1.
local e2 = Talents.Investir(e1, "dmg_precise")
egal(e2.talents.dmg_precise, 1, "dmg_precise déverrouillé (dmg_sharp ≥ 1)")

-- Point économique : L10 = 2 points, déjà 2 investis → plus de points.
local e3 = Talents.Investir(e2, "dmg_sharp")
egal(e3.talents.dmg_sharp, 2, "2e rang dmg_sharp autorisé (2 points)")
local e4 = Talents.Investir(e3, "maxRank")
egal(e4, e3, "limite point atteinte → pas de mutation")

-- Rembourser un prérequis utilisé par un enfant → bloqué.
local e5 = Talents.Rembourser(e2, "dmg_sharp")
egal(e5.talents.dmg_sharp, 1, "dmg_sharp non remboursable (dmg_precise encore investi)")

-- Reset.
local e6 = Talents.RetirerTous(e2)
egal(next(e6.talents), nil, "reset → talents vides")

-- Agrégation localisée (comportement).
local b = Talents.Agreger({ dmg_sharp = 2 })
egal(b.damageMult, 1 + 0.06 * 2, "Agreger dmg ×2 → damageMult 1.12")

print(("\ncomportement : %d reussis, %d echec(s)"):format(reussis, echecs))
if (echecs > 0) then os.exit(1) end