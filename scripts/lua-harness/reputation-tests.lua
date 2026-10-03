-- Tests de Shared/Logic/Reputation.lua (comportement).
local reussis, echecs = 0, 0
local function ok(c, n) if c then reussis = reussis + 1 else echecs = echecs + 1; print("  ÉCHEC: " .. n) end end
local function egal(a, b, n) ok(a == b, n .. " (obtenu " .. tostring(a) .. ", attendu " .. tostring(b) .. ")") end

-- ── Palier courant ─────────────────────────────────────────────────────────────
egal(Reputation.Tier(-99999), "hostile", "très négatif → hostile")
egal(Reputation.Tier(-3000), "unfriendly", "-3000 → unfriendly")
egal(Reputation.Tier(-1), "unfriendly", "-1 → unfriendly (bornes incl.)")
egal(Reputation.Tier(0), "neutral", "0 → neutral")
egal(Reputation.Tier(2999), "neutral", "2999 → neutral")
egal(Reputation.Tier(3000), "friendly", "3000 → friendly")
egal(Reputation.Tier(9000), "honored", "9000 → honored")
egal(Reputation.Tier(21000), "revered", "21000 → revered")
egal(Reputation.Tier(42000), "exalted", "42000 → exalted")

-- ── Tier suivant ───────────────────────────────────────────────────────────────
egal(Reputation.Suivant("neutral").id, "friendly", "neutral → friendly")
egal(Reputation.Suivant("exalted"), nil, "exalted → rien (fin)")
egal(Reputation.Suivant("inconnu"), nil, "tier inconnu → rien")

-- ── Réduction marchand ─────────────────────────────────────────────────────────
egal(Reputation.ReductionMarchand("hostile"), 3.0, "hostile → ×3")
egal(Reputation.ReductionMarchand("neutral"), 1.0, "neutral → ×1")
egal(Reputation.ReductionMarchand("exalted"), 0.6, "exalted → ×0.6")

-- ── État (gain / lose / set, immuable) ─────────────────────────────────────────
local e0 = Reputation.EtatVide()
egal(e0.akarlys, 0, "état vide : akarlys 0")
local e1 = Reputation.gain(e0, "akarlys", 150)
egal(e1.akarlys, 150, "gain 150 → akarlys 150")
egal(e0.akarlys, 0, "gain ne mute pas l'état d'origine (immuable)")
local e2 = Reputation.lose(e1, "akarlys", 50)
egal(e2.akarlys, 100, "lose 50 → akarlys 100")
local e3 = Reputation.set(e2, "zayan", 999)
egal(e3.zayan, 999, "set zayan 999")

-- ── Tier d'une faction (parité tierOf) ────────────────────────────────────────
egal(Reputation.TierFaction(e1, "akarlys"), "neutral", "150 → neutral")
egal(Reputation.TierFaction(Reputation.set(e0, "akarlys", 5000), "akarlys"), "friendly", "5000 → friendly")

print(("\ncomportement : %d reussis, %d echec(s)"):format(reussis, echecs))
if (echecs > 0) then os.exit(1) end