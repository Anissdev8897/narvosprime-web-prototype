-- Tests de Shared/Logic/WorldSim.lua (déterminisme + bascule).
local reussis, echecs = 0, 0
local function ok(c, n) if c then reussis = reussis + 1 else echecs = echecs + 1; print("  ÉCHEC: " .. n) end end
local function egal(a, b, n) ok(a == b, n .. " (obtenu " .. tostring(a) .. ", attendu " .. tostring(b) .. ")") end

-- Déterminisme : même seed → même état après N ticks.
local s1 = WorldSim.Etat(42)
local s2 = WorldSim.Etat(42)
local r1 = WorldSim.Avancer(s1, 10)
local r2 = WorldSim.Avancer(s2, 10)
egal(r1.state.epoch, 10, "epoch après 10 ticks")
egal(r1.state.factions.akarlys.power, r2.state.factions.akarlys.power, "déterminisme puissance akarlys")
egal(r1.state.regions.aquarys.price, r2.state.regions.aquarys.price, "déterminisme prix aquarys")
egal(#r1.newEvents, #r2.newEvents, "déterminisme nb événements")

-- État initial.
local s0 = WorldSim.Etat()
egal(s0.epoch, 0, "epoch initial 0")
egal(s0.factions.zayan.power, 50, "puissance initiale 50")
egal(s0.regions.hub.controller, "akarlys", "hub détenu par akarlys")
egal(s0.regions.espace.controller, "zayan", "espace détenu par zayan")
egal(#s0.events, 0, "aucun événement initial")

print(("\ncomportement : %d reussis, %d echec(s)"):format(reussis, echecs))
if (echecs > 0) then os.exit(1) end