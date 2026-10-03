-- Généré depuis spells/spellCatalog.ts et public/models/spells par scripts/narvos-sorts-vfx.mjs
-- Ne pas éditer à la main : régénérer après toute évolution du catalogue TS ou des images.

local SortsVfx = {}

--- Par sort : l'icône (chemin relatif à Client/UI), l'image retenue dans l'effet
--- source, sa taille en pixels, et le motif d'images du catalogue web.
SortsVfx.SORTS = {
    bruiser_slam = { icone = "img/sorts/bruiser_slam.png", image = 3, largeur = 128, hauteur = 128, source = "Starcaller Spell Animations/VFX 1/Frames/Starcaller_spell_1_frame_#.png" },
    bruiser_shockwave = { icone = "img/sorts/bruiser_shockwave.png", image = 5, largeur = 128, hauteur = 128, source = "Starcaller Spell Animations/VFX 2/Frames/Starcaller_spell_2_frame_#.png" },
    bruiser_rage = { icone = "img/sorts/bruiser_rage.png", image = 6, largeur = 128, hauteur = 128, source = "Starcaller Spell Animations/VFX 3/Frames/Starcaller_spell_3_frame_#.png" },
    dps_fire_shot = { icone = "img/sorts/dps_fire_shot.png", image = 5, largeur = 128, hauteur = 128, source = "Pixel Art VFX - Fire Mage - FULL Version/VFX1/frames/FireMage_skill1_frame#.png" },
    dps_plasma_barrage = { icone = "img/sorts/dps_plasma_barrage.png", image = 6, largeur = 192, hauteur = 128, source = "Pixel Art VFX - Fire Mage - FULL Version/VFX2/frames/FireMage_skill2_frame#.png" },
    dps_evasion = { icone = "img/sorts/dps_evasion.png", image = 6, largeur = 128, hauteur = 128, source = "Pixel Art VFX - Fire Mage - FULL Version/VFX3/frames/FireMage_skill3_frame#.png" },
    tank_bash = { icone = "img/sorts/tank_bash.png", image = 3, largeur = 128, hauteur = 128, source = "Pixel Art Warrior Animations - Full Version/VFX 1/Frames/warrior_skill1_frame#.png" },
    tank_fortress = { icone = "img/sorts/tank_fortress.png", image = 5, largeur = 128, hauteur = 128, source = "Pixel Art Warrior Animations - Full Version/VFX 2/Frames/warrior_skill2_frame#.png" },
    tank_iron_wall = { icone = "img/sorts/tank_iron_wall.png", image = 5, largeur = 128, hauteur = 128, source = "Pixel Art Warrior Animations - Full Version/VFX 3/Frames/warrior_skill3_frame#.png" },
    heal_nano = { icone = "img/sorts/heal_nano.png", image = 5, largeur = 128, hauteur = 128, source = "Pixel Art VFX - Priest - FULL Version/VFX1/Frames/Priest_skill1_frame#.png" },
    heal_drone = { icone = "img/sorts/heal_drone.png", image = 5, largeur = 128, hauteur = 128, source = "Pixel Art VFX - Paladin - FULL Version/VFX 1/Frames/paladin_skill1_frame#.png" },
    heal_barrier = { icone = "img/sorts/heal_barrier.png", image = 6, largeur = 128, hauteur = 128, source = "Pixel Art VFX - Paladin - FULL Version/VFX 2/Frames/paladin_skill2_frame#.png" },
}

-- Ordre du catalogue TS.
SortsVfx.SORTS_ORDER = {
    "bruiser_slam",
    "bruiser_shockwave",
    "bruiser_rage",
    "dps_fire_shot",
    "dps_plasma_barrage",
    "dps_evasion",
    "tank_bash",
    "tank_fortress",
    "tank_iron_wall",
    "heal_nano",
    "heal_drone",
    "heal_barrier",
}

return SortsVfx
