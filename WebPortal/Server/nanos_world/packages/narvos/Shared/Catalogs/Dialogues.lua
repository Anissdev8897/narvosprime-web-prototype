-- ── CATALOGUE DES DIALOGUES ─ échantillon (structure portée de dialogueRunner.ts) ──
-- ⚠ Les VRAIS dialogues vivent en YAML (`dialogueLoader.ts` parseYamlDialogue → DialogueDef[]).
-- Ce fichier est un échantillon SÉLECTIONNÉ pour éprouver le moteur `Logic/Dialogue.lua`.
-- À remplacer par le contenu YAML porté (données pré-analysées).
local Dialogues = {}

local DIALOGUES = {
    {
        id = "maitre_forgeron",
        title = "Le maître forgeron",
        npcFolder = "blacksmith",
        npcName = "Maître Forgeron",
        startNode = "n0",
        nodes = {
            {
                id = "n0", text = "Bienvenue, hero. Ta lame est en mauvais état.",
                speaker = "Maître Forgeron",
                onEnter = { { type = "play_sound", params = { sound = "greet" } } },
                choices = {
                    { text = "Peux-tu la réparer ?", nextNode = "n1" },
                    { text = "Juste passer.", nextNode = "n2", conditions = { { type = "level_min", params = { min = 5 } } } },
                },
            },
            {
                id = "n1", text = "Approche. Il me faut 5 éclats d'acier.",
                speaker = "Maître Forgeron",
                onEnter = { { type = "give_quest", params = { questId = "forge_first_blood" } } },
                onExit = { { type = "play_animation", params = { anim = "waves" } } },
                choices = {
                    { text = "C'est parti.", nextNode = "n2" },
                },
            },
            {
                id = "n2", text = "Reviens quand tu seras prêt.",
                speaker = "Maître Forgeron",
                onEnter = { { type = "nop", params = {} } },
            },
        },
    },
}

Dialogues.DIALOGUES = DIALOGUES
Dialogues.ORDRE = {}
for i, d in ipairs(DIALOGUES) do Dialogues.ORDRE[i] = d.id end

--- Dialogue par id.
function Dialogues.Dialogue(id)
    for _, d in ipairs(DIALOGUES) do if (d.id == id) then return d end end
    return nil
end

return Dialogues
