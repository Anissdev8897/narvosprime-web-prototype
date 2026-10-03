-- Genere par scripts/narvos-nanos-base-to-lua.mjs depuis le contenu nanos
-- installe. Ne pas editer a la main : regenerer apres toute mise a jour du
-- client (Steam peut ajouter ou retirer des assets du pack de base).
--
-- Particules du pack de base : 173 effets, 8 familles.
local Vfx = {}

--- Prefixe d'asset. Ces particules appartiennent au pack de base nanos, pas
--- au notre : elles sont deja chez chaque joueur, rien a telecharger.
Vfx.PACK = "nanos-world"

Vfx.FAMILLES = {
    "ambiance",
    "autre",
    "explosion",
    "fumee",
    "impact",
    "magie",
    "onde",
    "reacteur",
}

Vfx.EFFETS = {
    { id = "P_Distortion_01", famille = "ambiance", label = "Distortion 01" },
    { id = "P_Distortion_02", famille = "ambiance", label = "Distortion 02" },
    { id = "P_Distortion_3D", famille = "ambiance", label = "Distortion 3D" },
    { id = "P_Distortion_SQ", famille = "ambiance", label = "Distortion SQ" },
    { id = "P_FlareShimmer_01", famille = "ambiance", label = "Flare Shimmer 01" },
    { id = "P_FlareShimmer_02", famille = "ambiance", label = "Flare Shimmer 02" },
    { id = "P_Jets", famille = "ambiance", label = "Jets" },
    { id = "P_Leaders", famille = "ambiance", label = "Leaders" },
    { id = "P_LeadersRing", famille = "ambiance", label = "Leaders Ring" },
    { id = "P_SparksFlair", famille = "ambiance", label = "Sparks Flair" },
    { id = "P_Streamer", famille = "ambiance", label = "Streamer" },
    { id = "P_Beam", famille = "autre", label = "Nanos Beam" },
    { id = "P_Bullet_Trail", famille = "autre", label = "Bullet Trail System" },
    { id = "P_DirectionalBurst", famille = "autre", label = "Directional Burst" },
    { id = "P_Error", famille = "autre", label = "Error" },
    { id = "P_Explosion", famille = "autre", label = "Explosion" },
    { id = "P_Explosion_Dirt", famille = "autre", label = "PS Explosion Dirt" },
    { id = "P_Explosion_Water", famille = "autre", label = "PS Explosion Water" },
    { id = "P_Fire", famille = "autre", label = "Fire" },
    { id = "P_Fire_01", famille = "autre", label = "NFire 00" },
    { id = "P_Fire_02", famille = "autre", label = "NFire 01" },
    { id = "P_Fire_03", famille = "autre", label = "NFire 02" },
    { id = "P_Fire_04", famille = "autre", label = "NFire 03" },
    { id = "P_Fire_05", famille = "autre", label = "NFire 04" },
    { id = "P_Fire_06", famille = "autre", label = "NFire 05" },
    { id = "P_Fire_07", famille = "autre", label = "NFire 06" },
    { id = "P_Fire_08", famille = "autre", label = "NFire 07" },
    { id = "P_Fire_09", famille = "autre", label = "NFire 08" },
    { id = "P_Fire_10", famille = "autre", label = "NFire 09" },
    { id = "P_Fire_11", famille = "autre", label = "NFire 10" },
    { id = "P_Fire_12", famille = "autre", label = "NFire 11" },
    { id = "P_Fire_13", famille = "autre", label = "NFire 12" },
    { id = "P_Fire_14", famille = "autre", label = "NFire 13" },
    { id = "P_Fire_15", famille = "autre", label = "NFire 14" },
    { id = "P_Fire_16", famille = "autre", label = "NFire 15" },
    { id = "P_Fire_Exp_01", famille = "autre", label = "NFire Exp 00" },
    { id = "P_Fire_Exp_02", famille = "autre", label = "NFire Exp 01" },
    { id = "P_Fire_Exp_03", famille = "autre", label = "NFire Exp 03" },
    { id = "P_Fire_Grd_01", famille = "autre", label = "NFire Grd 00" },
    { id = "P_Fire_Grd_02", famille = "autre", label = "NFire Grd 01" },
    { id = "P_Fire_Grd_03", famille = "autre", label = "NFire Grd 02" },
    { id = "P_Fountain", famille = "autre", label = "Fountain" },
    { id = "P_GrenadeEXP_Air", famille = "autre", label = "Grenade EXP Air" },
    { id = "P_GrenadeEXP_Concrete", famille = "autre", label = "Grenade EXP Concrete" },
    { id = "P_GrenadeEXP_Default", famille = "autre", label = "Grenade EXP Default" },
    { id = "P_GrenadeEXP_Dirt", famille = "autre", label = "Grenade EXP Dirt" },
    { id = "P_GrenadeEXP_Grass", famille = "autre", label = "Grenade EXP Grass" },
    { id = "P_GrenadeEXP_Ice", famille = "autre", label = "Grenade EXP Ice" },
    { id = "P_GrenadeEXP_Metal", famille = "autre", label = "Grenade EXP Metal" },
    { id = "P_GrenadeEXP_Sand", famille = "autre", label = "Grenade EXP Sand" },
    { id = "P_GrenadeEXP_Snow", famille = "autre", label = "Grenade EXP Snow" },
    { id = "P_GrenadeEXP_Water", famille = "autre", label = "Grenade EXP Water" },
    { id = "P_GrenadeEXP_Wood", famille = "autre", label = "Grenade EXP Wood" },
    { id = "P_HangingParticulates", famille = "autre", label = "Hanging Particulates" },
    { id = "P_LTGrenadeEXP_Air", famille = "autre", label = "LTGrenade EXP Air" },
    { id = "P_LTGrenadeEXP_Concrete", famille = "autre", label = "LTGrenade EXP Concrete" },
    { id = "P_LTGrenadeEXP_Default", famille = "autre", label = "LTGrenade EXP Default" },
    { id = "P_LTGrenadeEXP_Dirt", famille = "autre", label = "LTGrenade EXP Dirt" },
    { id = "P_LTGrenadeEXP_Grass", famille = "autre", label = "LTGrenade EXP Grass" },
    { id = "P_LTGrenadeEXP_Ice", famille = "autre", label = "LTGrenade EXP Ice" },
    { id = "P_LTGrenadeEXP_Metal", famille = "autre", label = "LTGrenade EXP Metal" },
    { id = "P_LTGrenadeEXP_Sand", famille = "autre", label = "LTGrenade EXP Sand" },
    { id = "P_LTGrenadeEXP_Snow", famille = "autre", label = "LTGrenade EXP Snow" },
    { id = "P_LTGrenadeEXP_Water", famille = "autre", label = "LTGrenade EXP Water" },
    { id = "P_LTGrenadeEXP_Wood", famille = "autre", label = "LTGrenade EXP Wood" },
    { id = "P_OmnidirectionalBurst", famille = "autre", label = "Omnidirectional Burst" },
    { id = "P_Ribbon", famille = "autre", label = "Ribbon" },
    { id = "P_Sparks", famille = "autre", label = "Sparks" },
    { id = "P_Weapon_BarrelSmoke", famille = "autre", label = "Weapon Barrel Smoke System" },
    { id = "P_Weapon_Shells_12Gauge", famille = "autre", label = "Weapon Shells 12Gauge System" },
    { id = "P_Weapon_Shells_45ap", famille = "autre", label = "Weapon Shells 45ap System" },
    { id = "P_Weapon_Shells_545x39", famille = "autre", label = "Weapon Shells 545x39 System" },
    { id = "P_Weapon_Shells_556x45", famille = "autre", label = "Weapon Shells 556x45 System" },
    { id = "P_Weapon_Shells_762x39", famille = "autre", label = "Weapon Shells 762x39 System" },
    { id = "P_Weapon_Shells_9mm", famille = "autre", label = "Weapon Shells 9mm System" },
    { id = "P_Weapon_Shells_9x18", famille = "autre", label = "Weapon Shells 9x18 System" },
    { id = "PS_Blood_Impact", famille = "autre", label = "PS Blood Impact" },
    { id = "P_Explode_01", famille = "explosion", label = "Explode 01" },
    { id = "P_Explode_02", famille = "explosion", label = "Explode 02" },
    { id = "P_Explode_03", famille = "explosion", label = "Explode 03" },
    { id = "P_Explosion_Fire_01", famille = "explosion", label = "Explosion Fire 01" },
    { id = "P_Explosion_Fire_02", famille = "explosion", label = "Explosion Fire 02" },
    { id = "P_Explosion_Fire_03", famille = "explosion", label = "Explosion Fire 03" },
    { id = "P_Explosion_Fire_04", famille = "explosion", label = "Explosion Fire 04" },
    { id = "P_Explosion_Fire_05", famille = "explosion", label = "Explosion Fire 05" },
    { id = "P_Explosion_Fire_06", famille = "explosion", label = "Explosion Fire 06" },
    { id = "P_Explosion_Fire_07", famille = "explosion", label = "Explosion Fire 07" },
    { id = "P_Explosion_Fire_08", famille = "explosion", label = "Explosion Fire 08" },
    { id = "P_Explosive_01", famille = "explosion", label = "Explosive 01" },
    { id = "P_Explosive_02", famille = "explosion", label = "Explosive 02" },
    { id = "P_Explosive_03", famille = "explosion", label = "Explosive 03" },
    { id = "P_Explosive_04", famille = "explosion", label = "Explosive 04" },
    { id = "P_Explosive_05", famille = "explosion", label = "Explosive 05" },
    { id = "P_Explosive_06", famille = "explosion", label = "Explosive 06" },
    { id = "P_Explosive_07", famille = "explosion", label = "Explosive 07" },
    { id = "P_Explosive_08", famille = "explosion", label = "Explosive 08" },
    { id = "P_Explosive_09", famille = "explosion", label = "Explosive 09" },
    { id = "P_Explosive_10", famille = "explosion", label = "Explosive 10" },
    { id = "P_Explosive_11", famille = "explosion", label = "Explosive 11" },
    { id = "P_RBExplode", famille = "explosion", label = "RBExplode" },
    { id = "P_Smoke", famille = "fumee", label = "Smoke" },
    { id = "P_Smoke_01", famille = "fumee", label = "Smoke 01" },
    { id = "P_Smoke_02", famille = "fumee", label = "Smoke 02" },
    { id = "P_Smoke_03", famille = "fumee", label = "Smoke 03" },
    { id = "P_Smoke_04", famille = "fumee", label = "Smoke 04" },
    { id = "P_Smoke_05", famille = "fumee", label = "Smoke 05" },
    { id = "P_Smoke_06", famille = "fumee", label = "Smoke 06" },
    { id = "P_Smoke_07", famille = "fumee", label = "Smoke 07" },
    { id = "P_Burst_01", famille = "impact", label = "Burst 01" },
    { id = "P_Burst_02", famille = "impact", label = "Burst 02" },
    { id = "P_Destruction", famille = "impact", label = "Destruction" },
    { id = "P_HighImpact", famille = "impact", label = "High Impact" },
    { id = "P_ImpactExplosion_01", famille = "impact", label = "Impact Explosion 01" },
    { id = "P_ImpactExplosion_02", famille = "impact", label = "Impact Explosion 02" },
    { id = "P_ImpactExplosion_03", famille = "impact", label = "Impact Explosion 03" },
    { id = "P_ImpactExplosion_04", famille = "impact", label = "Impact Explosion 04" },
    { id = "P_ImpactExplosion_05", famille = "impact", label = "Impact Explosion 05" },
    { id = "P_ImpactExplosion_06", famille = "impact", label = "Impact Explosion 06" },
    { id = "P_ImpactExplosion_07", famille = "impact", label = "Impact Explosion 07" },
    { id = "P_ImpactExplosion_08", famille = "impact", label = "Impact Explosion 08" },
    { id = "P_FXVariety_AquaStorm", famille = "magie", label = "Aqua Storm" },
    { id = "P_FXVariety_DarkStorm", famille = "magie", label = "Dark Storm" },
    { id = "P_FXVariety_Explosion", famille = "magie", label = "Explosion" },
    { id = "P_FXVariety_FireBall", famille = "magie", label = "Fire Ball" },
    { id = "P_FXVariety_FireStorm", famille = "magie", label = "Fire Storm" },
    { id = "P_FXVariety_HealAura", famille = "magie", label = "Heal Aura" },
    { id = "P_FXVariety_Hit_01", famille = "magie", label = "Hit1" },
    { id = "P_FXVariety_Hit_02", famille = "magie", label = "Hit2" },
    { id = "P_FXVariety_Laser_01", famille = "magie", label = "Laser01" },
    { id = "P_FXVariety_Lightning_01", famille = "magie", label = "Lightning1" },
    { id = "P_FXVariety_Lightning_02", famille = "magie", label = "Lightning2" },
    { id = "P_FXVariety_Lightning_03", famille = "magie", label = "Lightning3" },
    { id = "P_FXVariety_MagicCircle", famille = "magie", label = "Magic Circle1" },
    { id = "P_FXVariety_ShootingStar", famille = "magie", label = "Shooting Star1" },
    { id = "P_FXVariety_ShotShockWave", famille = "magie", label = "Shot Shockwave" },
    { id = "P_FXVariety_Storm", famille = "magie", label = "Storm" },
    { id = "P_FXVariety_ThunderBall", famille = "magie", label = "Thunder Ball" },
    { id = "P_FXVariety_ThunderBallHit", famille = "magie", label = "Thunder Ball Hit" },
    { id = "P_FXVariety_ThunderStorm", famille = "magie", label = "Thunder Storm" },
    { id = "P_FXVariety_WaterBall", famille = "magie", label = "Water Ball" },
    { id = "P_FXVariety_WaterBallHit", famille = "magie", label = "Water Ball Hit" },
    { id = "P_ShockWave_01", famille = "onde", label = "Shock Wave 01" },
    { id = "P_ShockWave_02", famille = "onde", label = "Shock Wave 02" },
    { id = "P_ShockWave_03", famille = "onde", label = "Shock Wave 03" },
    { id = "P_ShockWave_04", famille = "onde", label = "Shock Wave 04" },
    { id = "P_ShockWave_05", famille = "onde", label = "Shock Wave 05" },
    { id = "P_ShockWave_06", famille = "onde", label = "Shock Wave 06" },
    { id = "P_ShockWave_07", famille = "onde", label = "Shock Wave 07" },
    { id = "P_ShockWave_08", famille = "onde", label = "Shock Wave 08" },
    { id = "P_ShockWave_09", famille = "onde", label = "Shock Wave 09" },
    { id = "P_ShockWave_10", famille = "onde", label = "Shock Wave 10" },
    { id = "P_ShockWave_11", famille = "onde", label = "Shock Wave 11" },
    { id = "P_ShockWave_12", famille = "onde", label = "Shock Wave 12" },
    { id = "P_ShockWave_13", famille = "onde", label = "Shock Wave 13" },
    { id = "P_ShockWave_14", famille = "onde", label = "Shock Wave 14" },
    { id = "P_RocketExhaust_Afterburn", famille = "reacteur", label = "Rocket Exhaust Afterburn" },
    { id = "P_RocketExhaust_Afterburn_Jet", famille = "reacteur", label = "Rocket Exhaust Afterburn Jet" },
    { id = "P_RocketExhaust_Blue", famille = "reacteur", label = "Rocket Exhaust Blue" },
    { id = "P_RocketExhaust_BlueRed", famille = "reacteur", label = "Rocket Exhaust Blue Red" },
    { id = "P_RocketExhaust_Crackling", famille = "reacteur", label = "Rocket Exhaust Crackling" },
    { id = "P_RocketExhaust_Energy", famille = "reacteur", label = "Rocket Exhaust Energy" },
    { id = "P_RocketExhaust_Green", famille = "reacteur", label = "Rocket Exhaust Green" },
    { id = "P_RocketExhaust_Maniac", famille = "reacteur", label = "Rocket Exhaust Maniac" },
    { id = "P_RocketExhaust_Pixie", famille = "reacteur", label = "Rocket Exhaust Pixie" },
    { id = "P_RocketExhaust_Plume_01", famille = "reacteur", label = "Rocket Exhaust Plume 1" },
    { id = "P_RocketExhaust_Plume_02", famille = "reacteur", label = "Rocket Exhaust Plume 2" },
    { id = "P_RocketExhaust_Plume_03", famille = "reacteur", label = "Rocket Exhaust Plume 3" },
    { id = "P_RocketExhaust_Realistic", famille = "reacteur", label = "Rocket Exhaust Realistic" },
    { id = "P_RocketExhaust_Red", famille = "reacteur", label = "Rocket Exhaust Red" },
    { id = "P_RocketExhaust_SciFi", famille = "reacteur", label = "Rocket Exhaust Sci Fi" },
    { id = "P_RocketExhaust_Violet", famille = "reacteur", label = "Rocket Exhaust Violet" },
    { id = "P_RocketExhaust_White", famille = "reacteur", label = "Rocket Exhaust White" },
    { id = "P_RocketExhaust_Yellow", famille = "reacteur", label = "Rocket Exhaust Yellow" },
}

--- Element de sort -> effets, par role dans la mise en scene.
--- projectile = ce qui voyage · impact = ce qui touche · zone = l'aire
--- d'effet · aura = ce qui reste sur le lanceur.
Vfx.PAR_ELEMENT = {
    fire = { projectile = "P_FXVariety_FireBall", impact = "P_FXVariety_Explosion", zone = "P_FXVariety_FireStorm", aura = "P_Explosion_Fire_03" },
    electric = { projectile = "P_FXVariety_ThunderBall", impact = "P_FXVariety_ThunderBallHit", zone = "P_FXVariety_ThunderStorm", aura = "P_FXVariety_Lightning_02" },
    water = { projectile = "P_FXVariety_WaterBall", impact = "P_FXVariety_WaterBallHit", zone = "P_FXVariety_AquaStorm", aura = "P_FXVariety_MagicCircle" },
    ice = { projectile = "P_FXVariety_WaterBall", impact = "P_FXVariety_WaterBallHit", zone = "P_FXVariety_AquaStorm", aura = "P_FXVariety_MagicCircle" },
    earth = { projectile = "P_FXVariety_Hit_01", impact = "P_ShockWave_03", zone = "P_ShockWave_09", aura = "P_FXVariety_MagicCircle" },
    wind = { projectile = "P_FXVariety_ShootingStar", impact = "P_FXVariety_Hit_02", zone = "P_FXVariety_Storm", aura = "P_Streamer" },
    light = { projectile = "P_FXVariety_ShootingStar", impact = "P_FlareShimmer_01", zone = "P_FXVariety_HealAura", aura = "P_FXVariety_HealAura" },
    dark = { projectile = "P_FXVariety_Laser_01", impact = "P_FXVariety_Hit_02", zone = "P_FXVariety_DarkStorm", aura = "P_FXVariety_MagicCircle" },
    void = { projectile = "P_FXVariety_Laser_01", impact = "P_Distortion_01", zone = "P_FXVariety_DarkStorm", aura = "P_Distortion_3D" },
    poison = { projectile = "P_FXVariety_Hit_01", impact = "P_FXVariety_Hit_02", zone = "P_Smoke_04", aura = "P_FXVariety_MagicCircle" },
}

local par_id = {}
for _, e in ipairs(Vfx.EFFETS) do par_id[e.id] = e end

--- Effet par identifiant, ou nil.
---@param id string
---@return table|nil
function Vfx.Trouver(id)
    if (type(id) ~= "string") then return nil end
    return par_id[id]
end

--- Chemin complet pour `Particle(...)`.
--- Rend nil si l'effet est inconnu : mieux vaut ne rien jouer qu'appeler
--- `Particle()` sur un asset absent, qui echoue en silence.
---@param id string
---@return string|nil
function Vfx.Asset(id)
    if (not Vfx.Trouver(id)) then return nil end
    return Vfx.PACK .. "::" .. id
end

--- Effets d'un element, avec repli sur `light`.
--- Un element sans table dediee ne doit pas faire disparaitre le sort.
---@param element string|nil
---@return table
function Vfx.PourElement(element)
    return Vfx.PAR_ELEMENT[element or ""] or Vfx.PAR_ELEMENT.light
end

--- Effets d'une famille.
---@param famille string
---@return table
function Vfx.ParFamille(famille)
    local sortie = {}
    for _, e in ipairs(Vfx.EFFETS) do
        if (e.famille == famille) then sortie[#sortie + 1] = e end
    end
    return sortie
end

return Vfx
