
-- Narvos RPG Scripting (Lua)
-- Permet de définir les sorts sans toucher au code source du moteur.

Spells = {
    FIREBALL = {
        name = "Boule de Feu",
        cost = 4, -- PA
        range = 6,
        baseDamage = 25,
        onCast = function(target)
            print("Lancement de Boule de Feu sur " .. target.name)
            return Spells.FIREBALL.baseDamage * 1.5
        end
    },
    
    HEAL = {
        name = "Soin Vital",
        cost = 3,
        range = 4,
        baseHeal = 20,
        type = "DEFENSIVE"
    }
}

return Spells
