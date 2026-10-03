-- Tests de Shared/Logic/Dialogue.lua (moteur pur).
local reussis, echecs = 0, 0
local function ok(cond, nom) if (cond) then reussis = reussis + 1 else echecs = echecs + 1; print("  ÉCHEC: " .. nom) end end
local function egal(obtenu, attendu, nom) ok(obtenu == attendu, nom .. " (obtenu " .. tostring(obtenu) .. ", attendu " .. tostring(attendu) .. ")") end

-- Conditions/actions injectées (simples) : level_min ≥ 5 => vrai.
Dialogue.Callbacks(
    function(page, conditions)
        for _, c in ipairs(conditions or {}) do
            if (c.type == "level_min" and (page.niveau or 0) < (tonumber(c.params.min) or 0)) then return false end
        end
        return true
    end,
    function(page, actions) end
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
Dialogue.Callbacks(function(p, c) return true end, function(page, actions)
    for _, a in ipairs(actions or {}) do
        if (a.type == "play_animation") then sorti = sorti + 1 end
    end
end)
Dialogue.Demarrer("maitre_forgeron")
Dialogue.Choix(1) -- n0 -> n1
Dialogue.Choix(1) -- n1 -> n2 (onExit de n1 = play_animation)
egal(sorti, 1, "onExit de n1 exécuté (play_animation)")

-- ── 3a : curseur de dialogue PAR JOUEUR (deux conversations, alternées) ─────────
-- Le bug corrigé (lot 7) : `local actif` était UNIQUE pour le module. Deux
-- joueurs en conversation : le second écrasait, et le choix du premier faisait
-- avancer le dialogue du second. Ici on prouve que A ne touche pas B.
Dialogue.Arreter()
local def_b = { id = "test_b", startNode = "b0", npcFolder = "npc_b",
    nodes = {
        { id = "b0", text = "Bonjour B", choices = { { text = "Oui", nextNode = "b1" } } },
        { id = "b1", text = "Fin B" },
    } }
Dialogue.Enregistrer(def_b)

Dialogue.Demarrer("maitre_forgeron")        -- A
local curseur_a = Dialogue.Etat()
Dialogue.Demarrer("test_b")                 -- B
local curseur_b = Dialogue.Etat()
ok(curseur_a ~= nil and curseur_b ~= nil, "deux curseurs existent")
ok(curseur_a ~= curseur_b, "les deux curseurs sont des objets distincts")

Dialogue.Charger(curseur_a)                 -- le joueur A reprend
egal(Dialogue.NoeudCourant().id, "n0", "A reprend au noeud de départ (n0)")
Dialogue.Choix(1)                            -- A avance n0 -> n1
egal(Dialogue.NoeudCourant().id, "n1", "A avance à n1")

Dialogue.Charger(curseur_b)                 -- le joueur B reprend
egal(Dialogue.NoeudCourant().id, "b0", "B est TOUJOURS à b0 (le choix de A n'a pas avancé B)")
ok(curseur_b.currentNodeId == "b0", "le curseur de B n'a pas été muté par le choix de A")

print(reussis .. " reussis, " .. echecs .. " echec(s)")
if (echecs > 0) then error("ÉCHECS") end