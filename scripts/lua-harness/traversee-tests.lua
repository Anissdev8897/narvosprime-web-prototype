-- ══════════════════════════════════════════════════════════════════════════════
-- traversee-tests.lua — assertions sur Shared/Logic/Traversee.lua.
-- Les noms M_Neutral_Traversal viennent du CATALOGUE RÉEL (injectés par
-- traversee.mjs) : le test est représentatif de ce qui tourne en jeu.
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

-- ── Classement par hauteur ────────────────────────────────────────────────────

section("classer")

egal(Traversee.Classer(nil), nil, "hauteur nil refuse")
egal(Traversee.Classer(0), nil, "hauteur nulle refuse")
egal(Traversee.Classer(19), nil, "marche basse : pas une traversee")
egal(Traversee.Classer(20), nil, "borne incluse : 20 refuse")
egal(Traversee.Classer(25), "vault", "muret bas -> vault")
egal(Traversee.Classer(60), "vault", "borne vault incluse")
egal(Traversee.Classer(61), "mantle", "au-dessus du vault -> mantle")
egal(Traversee.Classer(140), "mantle", "borne mantle incluse")
egal(Traversee.Classer(141), "climb", "au-dessus du mantle -> climb")
egal(Traversee.Classer(260), "climb", "borne climb incluse")
egal(Traversee.Classer(261), nil, "trop haut : refuse (le saut natif reprend)")

-- ── Allure ────────────────────────────────────────────────────────────────────

section("allure")

egal(Traversee.Allure(500), "run", "course -> run")
egal(Traversee.Allure(400), "run", "borne run incluse")
egal(Traversee.Allure(100), "walk", "marche -> walk")
egal(Traversee.Allure(30), "walk", "borne marche incluse")
egal(Traversee.Allure(10), "stand", "presque immobile -> stand")
egal(Traversee.Allure(0), "stand", "immobile -> stand")

-- ── Préparation depuis le catalogue réel ──────────────────────────────────────

section("preparer")

local clips = Traversee.Preparer(NOMS_TRAVERSEE)

for _, typ in ipairs({ "vault", "mantle", "climb" }) do
    ok(clips[typ], "famille presente : " .. typ)
    for _, allure in ipairs({ "run", "walk", "stand" }) do
        ok(clips[typ] and clips[typ][allure], "clip reel pour " .. typ .. " / " .. allure)
    end
end

-- Les clips pointent vers de VRAIS noms du catalogue.
local vu = {}
for _, nom in ipairs(NOMS_TRAVERSEE) do vu[nom] = true end
local ok_points = true
for typ in pairs(clips) do
    for allure, nom in pairs(clips[typ]) do
        if (not vu[nom]) then ok_points = false end
    end
end
ok(ok_points, "chaque clip retenu existe dans le catalogue")

-- Les familles étrangères (Hurdle, Catch) ne polluent pas la table.
ok(not clips.hurdle, "hurdle ignore")
ok(not clips.catch, "catch ignore")

-- ── Choix du clip avec repli ──────────────────────────────────────────────────

section("clip")

egal(Traversee.Clip(clips, "vault", "run"), clips.vault.run, "vault run direct")
egal(Traversee.Clip(clips, "climb", "stand"), clips.climb.stand, "climb stand direct")
-- Repli : allure absente -> walk -> stand -> run.
local sans_run = { vault = { walk = clips.vault.walk, stand = clips.vault.stand } }
egal(Traversee.Clip(sans_run, "vault", "run"), clips.vault.walk, "repli run -> walk")
local sans_walk = { vault = { stand = clips.vault.stand, run = clips.vault.run } }
egal(Traversee.Clip(sans_walk, "vault", "walk"), clips.vault.stand, "repli walk -> stand")
egal(Traversee.Clip(nil, "vault", "run"), nil, "clips nil -> nil")
egal(Traversee.Clip({}, "vault", "run"), nil, "clips vides -> nil")

-- ── Verifier : les manques remontent ──────────────────────────────────────────

section("verifier")

egal(#Traversee.Verifier(clips), 0, "catalogue reel : aucune famille manquante")

local partiels = { vault = { run = clips.vault.run } }
local manquants = Traversee.Verifier(partiels)
egal(#manquants, 2, "deux familles absentes signalees")
ok(manquants[1] == "mantle" or manquants[1] == "climb", "les bonnes familles remontent")

egal(#Traversee.Verifier(nil), 3, "nil -> les trois familles manquent")
egal(#Traversee.Verifier({}), 3, "vide -> les trois familles manquent")

-- ── Resume ────────────────────────────────────────────────────────────────────

section("resume")

print("")
print(reussis .. " réussis, " .. echecs .. " échoués")
if (echecs > 0) then error("des tests ont échoué", 0) end