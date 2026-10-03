-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Quetes.Accepter("forge_first_blood")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Quetes.Accepter("forge_collecte_essences")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Quetes.Accepter("forge_frontline" )
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Quetes.Accepter("forge_frontline")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Quetes.Accepter("forge_frontline")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Quetes.Accepter("tower_hold")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Quetes.Accepter("test_survie")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Quetes.Accepter("test_escorte")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- ── 9. Immuabilité : l'état d'entrée n'est pas muté ────────────────────────────
Quetes.Charger(nil)
Quetes.Accepter("tower_hold")
local avant = Quetes.Etat()
Quetes.SurKill(nil)
ok(Quetes.Etat() ~= avant, "état neuf après mutation (référence différente)")
ok(#avant.active == 1, "l'état d'avant n'a pas été muté")

-- ── 10. Quête de KILL avec enemyFolder (le hook passe folder=nil → « kill any ») ──
-- Le hook serveur (lot 8) appelle SurKillJoueur(player, nil). Ça doit avancer les
-- quêtes « tuer N » SANS enemyFolder, et PAS celles qui exigent un folder précis.
Quetes.Charger(nil)
local def_escadre = { id = "test_escadre", title = "Escadre", objectives = { { kind = "kill", label = "vaisseaux", target = 2, enemyFolder = "space_ship" } } }
Catalogo.QUETES[#Catalogo.QUETES + 1] = def_escadre
Catalogo.ORDRE[#Catalogo.ORDRE + 1] = "test_escadre"
Catalogo.Quete = function(id) for _, q in ipairs(Catalogo.QUETES) do if (q.id == id) then return q end end end
Quetes.Initialiser(Catalogo)
Quetes.Accepter("test_escadre")
Quetes.Accepter("forge_first_blood") -- kill any

-- SurKill("space_ship") : avance l'escadre ET le « kill any » (le folder matche les deux)
egal(#Quetes.SurKill("space_ship"), 0, "1 kill space_ship → rien encore (target 2)")
egal(#Quetes.SurKill("space_ship"), 1, "2 kills space_ship → escadre terminée")
ok(Quetes.EstTerminee("test_escadre"), "test_escadre terminée (enemyFolder matché)")
ok(not Quetes.EstTerminee("forge_first_blood"), "forgé first blood pas encore (target 5)")

-- SurKill(nil) : n'avance PAS l'escadre (enemyFolder requis), avance le « kill any »
Quetes.Charger(nil)
Quetes.Accepter("test_escadre")
Quetes.Accepter("forge_first_blood")
egal(#Quetes.SurKill(nil), 0, "kill nil n'avance pas l'escadre (enemyFolder != nil)")
ok(not Quetes.EstTerminee("test_escadre"), "escadre PAS terminée par un kill non-folderé")
local nb_active_apres = #Quetes.Etat().active
egal(nb_active_apres >= 1, true, "forgé first blood reste active (1 kill sur 5)")

-- ── 11. SurKill avec LISTE de tags (GetActorTags) : matche si UN tag = enemyFolder ──
local def_escadre2 = { id = "test_escadre2", title = "Escadre 2", objectives = { { kind = "kill", label = "vaisseaux", target = 1, enemyFolder = "space_ship" } } }
Catalogo.QUETES[#Catalogo.QUETES + 1] = def_escadre2
Catalogo.ORDRE[#Catalogo.ORDRE + 1] = "test_escadre2"
Quetes.Initialiser(Catalogo)
Quetes.Accepter("test_escadre2")
egal(#Quetes.SurKill({ "zombie" }), 0, "tags {zombie} sans space_ship → escadre2 rien")
egal(#Quetes.SurKill({ "zombie", "space_ship" }), 1, "tags {zombie,space_ship} → escadre2 terminée")
ok(Quetes.EstTerminee("test_escadre2"), "escadre2 terminée par tag space_ship")

print(reussis .. " reussis, " .. echecs .. " echec(s)")
if (echecs > 0) then error("ÉCHECS") end