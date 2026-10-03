-- ══════════════════════════════════════════════════════════════════════════════
-- Gestes.lua — les gestes propres a une famille de PNJ, par CHEMIN dans le pack.
--
-- FICHIER GENERE par scripts/narvos-gestes-to-lua.mjs depuis Assets.toml.
-- Ne pas editer a la main : regenerer apres chaque construction du pack.
--
-- 1 famille(s) ecrite(s) : Infectes. Une famille absente garde les
-- gestes generiques (chaine Freeflow, ACB_Hurt) dans Ia.lua et Combat.lua.

-- ══════════════════════════════════════════════════════════════════════════════

local Gestes = {}

--- Par famille de Spawnables : attaques (alternees), reactions par cote, cri.
Gestes.FAMILLES = {
    Infectes = {
        attaques = { "narvos::ZombieAttack_Left", "narvos::ZombieAttack_Right" },
        reactions = {
            avant = "narvos::HitZombie_Front",
            arriere = "narvos::HitZombie_Back",
            gauche = "narvos::HitZombie_Left",
            droite = "narvos::HitZombie_Right",
        },
        cri = "narvos::ZombieScream",
    },
}

--- Les gestes d'une famille, ou nil.
---@param famille any
---@return table|nil
function Gestes.De(famille)
    if (type(famille) ~= "string") then return nil end
    return Gestes.FAMILLES[famille]
end

return Gestes
