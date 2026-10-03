---@class NanosWorldWeapons
NanosWorldWeapons = {}
Package.Export("NanosWorldWeapons", NanosWorldWeapons)

---@class AK47: Weapon
---@overload fun(location: Vector, rotation: Rotator): AK47
NanosWorldWeapons.AK47 = Weapon.Inherit("AK47", {
	name = "AK-47",
	image = "assets://nanos-world/Thumbnails/SK_AK47.jpg",
	category = "rifles",
})

function NanosWorldWeapons.AK47:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_AK47", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(30, 1000)
	self:SetDamage(30)
	self:SetSpread(30)
	self:SetRecoil(0.25)
	self:SetBulletSettings(1, 30000, 30000, Color(100, 58, 0))
	self:SetSightTransform(Vector(0, 0, -1), Rotator(-1.5, 0, 0))
	self:SetLeftHandTransform(Vector(22, 0, 9), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-10, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
	self:SetCadence(0.1)
	self:SetWallbangSettings(200, 0.75)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
	self:SetParticlesShells("nanos-world::P_Weapon_Shells_762x39")

	self:SetSoundDry("nanos-world::A_Rifle_Dry")
	self:SetSoundLoad("nanos-world::A_Rifle_Load")
	self:SetSoundUnload("nanos-world::A_Rifle_Unload")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_AK47_Shot")
	self:SetSoundFireLastBullets("nanos-world::A_SMG_Dry", 6)

	self:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Rifle")
	self:SetAnimationFire("nanos-world::A_AK47_Fire")

	self:SetMagazineMesh("nanos-world::SM_AK47_Mag_Empty")
	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Regular")
end

---@class AK74U: Weapon
---@overload fun(location: Vector, rotation: Rotator): AK74U
NanosWorldWeapons.AK74U = Weapon.Inherit("AK74U", {
	name = "AK-74U",
	image = "assets://nanos-world/Thumbnails/SK_AK74U.jpg",
	category = "rifles",
})

function NanosWorldWeapons.AK74U:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_AK74U", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(30, 1000)
	self:SetDamage(25)
	self:SetSpread(15)
	self:SetRecoil(0.3)
	self:SetBulletSettings(1, 30000, 30000, Color(100, 58, 0))
	self:SetSightTransform(Vector(0, 0, -2), Rotator(-3, 0, 0))
	self:SetLeftHandTransform(Vector(26, 0, 9), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-10, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
	self:SetCadence(0.085)
	self:SetWallbangSettings(200, 0.50)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
	self:SetParticlesShells("nanos-world::P_Weapon_Shells_545x39")

	self:SetSoundDry("nanos-world::A_Rifle_Dry")
	self:SetSoundLoad("nanos-world::A_Rifle_Load")
	self:SetSoundUnload("nanos-world::A_Rifle_Unload")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_AK74U_Shot")
	self:SetSoundFireLastBullets("nanos-world::A_SMG_Dry", 6)

	self:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Rifle")
	self:SetAnimationFire("nanos-world::A_AK74U_Fire")

	self:SetMagazineMesh("nanos-world::SM_AK74U_Mag_Empty")
	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Regular")
end

---@class GE36: Weapon
---@overload fun(location: Vector, rotation: Rotator): GE36
NanosWorldWeapons.GE36 = Weapon.Inherit("GE36", {
	name = "Gewehr 36",
	image = "assets://nanos-world/Thumbnails/SK_GE36.jpg",
	category = "rifles",
})

function NanosWorldWeapons.GE36:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_GE36", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(30, 1000)
	self:SetDamage(30)
	self:SetSpread(15)
	self:SetRecoil(0.25)
	self:SetBulletSettings(1, 30000, 30000, Color(100, 58, 0))
	self:SetSightTransform(Vector(0, 0, -2.4), Rotator(0, 0, 0))
	self:SetLeftHandTransform(Vector(24, 0, 9), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-10, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
	self:SetCadence(0.125)
	self:SetWallbangSettings(200, 0.5)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
	self:SetParticlesShells("nanos-world::P_Weapon_Shells_556x45")

	self:SetSoundDry("nanos-world::A_Rifle_Dry")
	self:SetSoundLoad("nanos-world::A_Rifle_Load")
	self:SetSoundUnload("nanos-world::A_Rifle_Unload")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_Rifle_Shot")
	self:SetSoundFireLastBullets("nanos-world::A_SMG_Dry", 6)

	self:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Rifle")
	self:SetAnimationFire("nanos-world::A_GE36_Fire")

	self:SetMagazineMesh("nanos-world::SM_GE36_Mag_Empty")
	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Regular_X")
end

---@class Glock: Weapon
---@overload fun(location: Vector, rotation: Rotator): Glock
NanosWorldWeapons.Glock = Weapon.Inherit("Glock", {
	name = "Glock",
	image = "assets://nanos-world/Thumbnails/SK_Glock.jpg",
	category = "pistols",
})

function NanosWorldWeapons.Glock:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_Glock", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(17, 1000)
	self:SetDamage(15)
	self:SetSpread(20)
	self:SetRecoil(0.5)
	self:SetBulletSettings(1, 30000, 30000, Color(13, 100, 0))
	self:SetSightTransform(Vector(0, 0, 1), Rotator(-0.5, 0, 0))
	self:SetLeftHandTransform(Vector(0, 0, -4), Rotator(0, 60, 100))
	self:SetRightHandOffset(Vector(-25, 0, 0))
	self:SetHandlingMode(HandlingMode.SingleHandedWeapon)
	self:SetCadence(0.15)
	self:SetWallbangSettings(160, 0.25)

	self:SetSightFOVMultiplier(0.6)
	self:SetUsageSettings(false, false)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
	self:SetParticlesShells("nanos-world::P_Weapon_Shells_9mm")

	self:SetSoundDry("nanos-world::A_Pistol_Dry")
	self:SetSoundLoad("nanos-world::A_Pistol_Load")
	self:SetSoundUnload("nanos-world::A_Pistol_Unload")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_Glock_Shot")
	self:SetSoundFireLastBullets("nanos-world::A_SMG_Dry", 3)

	self:SetAnimationCharacterFire("nanos-world::A_Mannequin_Sight_Fire_Pistol")
	self:SetAnimationFire("nanos-world::A_Glock_Fire")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Pistol")

	self:SetMagazineMesh("nanos-world::SM_Glock_Mag_Empty")
	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Circle")
end

---@class DesertEagle: Weapon
---@overload fun(location: Vector, rotation: Rotator): DesertEagle
NanosWorldWeapons.DesertEagle = Weapon.Inherit("DesertEagle", {
	name = "Desert Eagle",
	image = "assets://nanos-world/Thumbnails/SK_DesertEagle.jpg",
	category = "pistols",
})

function NanosWorldWeapons.DesertEagle:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_DesertEagle", CollisionType.Auto, true, SpawnMode.AfterConstructor)

-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, -1.4), Rotator(-1, 0, 0))
	self:SetLeftHandTransform(Vector(0, 0, -4), Rotator(0, 60, 100))
	self:SetRightHandOffset(Vector(-25, 0, 0))
	self:SetHandlingMode(HandlingMode.SingleHandedWeapon)
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
NanosWorldWeapons.ColtPython = Weapon.Inherit("ColtPython", {
	name = "Colt Python",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
function NanosWorldWeapons.ColtPython:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_ColtPython", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, -2), Rotator(-0.1, 0, 0))
	self:SetLeftHandTransform(Vector(0, 0, -4), Rotator(0, 60, 100))
	self:SetRightHandOffset(Vector(-25, 0, 0))
	self:SetHandlingMode(HandlingMode.SingleHandedWeapon)
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

---@class Lewis: Weapon
---@overload fun(location: Vector, rotation: Rotator): Lewis
NanosWorldWeapons.Lewis = Weapon.Inherit("Lewis", {
	name = "Lewis Gun",
	image = "assets://nanos-world/Thumbnails/SK_Lewis.jpg",
	category = "vintage",
})

function NanosWorldWeapons.Lewis:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_Lewis", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(47, 1000)
	self:SetDamage(25)
	self:SetSpread(10)
	self:SetRecoil(0.25)
	self:SetBulletSettings(1, 30000, 30000, Color(100, 58, 0))
	self:SetSightTransform(Vector(-15, 0, -8), Rotator(-1.5, 0, 0))
	self:SetLeftHandTransform(Vector(27, 0, 6), Rotator(0, 60, 80))
	self:SetRightHandOffset(Vector(-5, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
	self:SetCadence(0.175)
	self:SetWallbangSettings(200, 0.6)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
	self:SetParticlesShells("nanos-world::P_Weapon_Shells_556x45")

	self:SetSoundDry("nanos-world::A_Rifle_Dry")
	self:SetSoundUnload("nanos-world::A_MMG_Reload")
	self:SetSoundLoad("nanos-world::A_Rifle_Semi_Load")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_Rifle_Shot_B")
	self:SetSoundFireLastBullets("nanos-world::A_SMG_Dry", 8)

	self:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Rifle")
	self:SetAnimationFire("nanos-world::A_Lewis_Fire")

	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Regular_X")
end

---@class AR4: Weapon
---@overload fun(location: Vector, rotation: Rotator): AR4
NanosWorldWeapons.AR4 = Weapon.Inherit("AR4", {
	name = "AR-15",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
function NanosWorldWeapons.AR4:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_AR4", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, -3.5), Rotator(-0.5, 0, 0))
	self:SetLeftHandTransform(Vector(25, 0, 10.5), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-10, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
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
	self:SetMagazineMesh("nanos-world::SM_AR4_Mag_Empty")
	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Regular")
end

---@class Moss500: Weapon
---@overload fun(location: Vector, rotation: Rotator): Moss500
NanosWorldWeapons.Moss500 = Weapon.Inherit("Moss500", {
	name = "Moss 500",
	image = "assets://nanos-world/Thumbnails/SK_Moss500.jpg",
	category = "shotguns",
})

function NanosWorldWeapons.Moss500:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_Moss500", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(6, 1000, 1)
	self:SetDamage(30)
	self:SetSpread(70)
	self:SetRecoil(3)
	self:SetBulletSettings(6, 10000, 30000, Color(100, 58, 0))
	self:SetSightTransform(Vector(0, 0, 3.6), Rotator(-2, 0, 0))
	self:SetLeftHandTransform(Vector(36.8, 0, 3.8), Rotator(-5, 10, 190))
	self:SetRightHandOffset(Vector(0, 0, 3))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
	self:SetCadence(0.9)
	self:SetWallbangSettings(100, 0.25)

	self:SetSightFOVMultiplier(0.75)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
	self:SetParticlesShells("nanos-world::P_Weapon_Shells_12Gauge")

	self:SetSoundDry("nanos-world::A_Shotgun_Dry")
	self:SetSoundLoad("nanos-world::A_Shotgun_Load_Bullet")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_Shotgun_Shot")
	self:SetSoundFireLastBullets("nanos-world::A_SMG_Dry", 1)

	self:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire_Heavy")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Shotgun")
	self:SetAnimationFire("nanos-world::A_Moss500_Fire")

	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Shotgun")
end

---@class AP5: Weapon
---@overload fun(location: Vector, rotation: Rotator): AP5
NanosWorldWeapons.AP5 = Weapon.Inherit("AP5", {
	name = "MP5",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
function NanosWorldWeapons.AP5:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_AP5", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, -2.2), Rotator(-2, 0, 0))
	self:SetLeftHandTransform(Vector(21, 0, 9), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-10, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
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
NanosWorldWeapons.SMG11 = Weapon.Inherit("SMG11", {
	name = "MAC-10",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
function NanosWorldWeapons.SMG11:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_SMG11", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, -6.5), Rotator(-5, 0, 0))
	self:SetLeftHandTransform(Vector(-0.5, -3, -1), Rotator(0, 25, 155))
	self:SetRightHandOffset(Vector(-35, 0, -5))
	self:SetHandlingMode(HandlingMode.SingleHandedWeapon)
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
NanosWorldWeapons.ASVal = Weapon.Inherit("ASVal", {
	name = "AS-Val",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
function NanosWorldWeapons.ASVal:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_ASVal", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, -1), Rotator(-1.5, 0, 0))
	self:SetLeftHandTransform(Vector(23.5, 0, 9), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-12.5, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
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
NanosWorldWeapons.M1911 = Weapon.Inherit("M1911", {
	name = "M1911",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_M1911", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, 1.5), Rotator(0, 0, 0))
	self:SetLeftHandTransform(Vector(0, 0, -4), Rotator(0, 60, 100))
	self:SetRightHandOffset(Vector(-25, 0, 0))
	self:SetHandlingMode(HandlingMode.SingleHandedWeapon)
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
	name = "Makarov",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_Makarov", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, 1.3), Rotator(-1, 0, 0))
	self:SetLeftHandTransform(Vector(0, 0, -4), Rotator(0, 60, 100))
	self:SetRightHandOffset(Vector(-25, 0, 0))
	self:SetHandlingMode(HandlingMode.SingleHandedWeapon)
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
	name = "UMP-45",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_UMP45", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, -1.9), Rotator(-0.4, 0, 0))
	self:SetLeftHandTransform(Vector(17, -2, 1), Rotator(25, 25, 160))
	self:SetRightHandOffset(Vector(-10, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
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
	name = "P90",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_P90", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, -6.25), Rotator(-1, 0, 0))
	self:SetLeftHandTransform(Vector(0, 0, -4), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-20, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
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
	name = "Gewehr 3",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_GE3", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, -2.5), Rotator(-1.5, 0, 0))
	self:SetLeftHandTransform(Vector(27.5, 0, 11), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-10, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
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
	self:SetMagazineMesh("nanos-world::SM_GE36_Mag_Empty")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	name = "Automatkarbin 5C",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_AK5C", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, -1.75), Rotator(0, 0, 0))
	self:SetLeftHandTransform(Vector(25, 0, 10), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-10, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
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
	name = "SA-80",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_SA80", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, -7), Rotator(0, 0, 0))
	self:SetLeftHandTransform(Vector(10, 0, 7.3), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-20, 0, -3))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
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
	name = "Sten",
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_Sten", CollisionType.Auto, true, SpawnMode.AfterConstructor)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	self:SetSightTransform(Vector(0, 0, 0.5), Rotator(0, 0, 0))
	self:SetLeftHandTransform(Vector(16.5, 0, 5.5), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-10, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
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
	self:SetSightTransform(Vector(0, 0, 0.5), Rotator(-0.5, 0, 0))
	self:SetLeftHandTransform(Vector(33, 0, 3), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-5, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
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
	self:SetSightTransform(Vector(0, 0, -2.5), Rotator(-0.5, 0, 0))
	self:SetLeftHandTransform(Vector(27.5, 0, 10), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-10, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
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

---@class Ithaca37: Weapon
---@overload fun(location: Vector, rotation: Rotator): Ithaca37
NanosWorldWeapons.Ithaca37 = Weapon.Inherit("Ithaca37", {
	name = "Ithaca 37",
	image = "assets://nanos-world/Thumbnails/SK_Ithaca37.jpg",
	category = "shotguns",
})

function NanosWorldWeapons.Ithaca37:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_Ithaca37", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(6, 1000, 1)
	self:SetDamage(30)
	self:SetSpread(70)
	self:SetRecoil(3)
	self:SetBulletSettings(6, 10000, 30000, Color(100, 58, 0))
	self:SetSightTransform(Vector(0, 0, 5.5), Rotator(-1, 0, 0))
	self:SetLeftHandTransform(Vector(35, 0, 6), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(0, 0, 5))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
	self:SetCadence(0.9)
	self:SetWallbangSettings(100, 0.25)

	self:SetSightFOVMultiplier(0.75)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
	self:SetParticlesShells("nanos-world::P_Weapon_Shells_12Gauge")

	self:SetSoundDry("nanos-world::A_Shotgun_Dry")
	self:SetSoundLoad("nanos-world::A_Shotgun_Load_Bullet")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_ShotgunBlast_Shot")
	self:SetSoundFireLastBullets("nanos-world::A_SMG_Dry", 2)

	self:SetAnimationFire("nanos-world::A_Ithaca37_Fire")
	self:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire_Heavy")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Shotgun")

	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Shotgun")
end

---@class Rem870: Weapon
---@overload fun(location: Vector, rotation: Rotator): Rem870
NanosWorldWeapons.Rem870 = Weapon.Inherit("Rem870", {
	name = "Rem 870",
	image = "assets://nanos-world/Thumbnails/SK_Rem870.jpg",
	category = "shotguns",
})

function NanosWorldWeapons.Rem870:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_Rem870", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(6, 1000, 1)
	self:SetDamage(30)
	self:SetSpread(70)
	self:SetRecoil(3)
	self:SetBulletSettings(6, 10000, 30000, Color(100, 58, 0))
	self:SetSightTransform(Vector(0, 0, 4.5), Rotator(-2, 0, 0))
	self:SetLeftHandTransform(Vector(35, 0, 6), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(0, 0, 5))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
	self:SetCadence(0.9)
	self:SetWallbangSettings(100, 0.25)

	self:SetSightFOVMultiplier(0.75)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
	self:SetParticlesShells("nanos-world::P_Weapon_Shells_12Gauge")

	self:SetSoundDry("nanos-world::A_Shotgun_Dry")
	self:SetSoundLoad("nanos-world::A_Shotgun_Load_Bullet")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_Shotgun_Shot_C")
	self:SetSoundFireLastBullets("nanos-world::A_SMG_Dry", 2)

	self:SetAnimationFire("nanos-world::A_Rem870_Fire")
	self:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire_Heavy")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Shotgun")

	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Shotgun")
end

---@class SPAS12: Weapon
---@overload fun(location: Vector, rotation: Rotator): SPAS12
NanosWorldWeapons.SPAS12 = Weapon.Inherit("SPAS12", {
	name = "SPAS12",
	image = "assets://nanos-world/Thumbnails/SK_SPAS12.jpg",
	category = "shotguns",
})

function NanosWorldWeapons.SPAS12:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_SPAS12", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(6, 1000, 1)
	self:SetDamage(20)
	self:SetSpread(60)
	self:SetRecoil(2)
	self:SetBulletSettings(6, 10000, 30000, Color(100, 58, 0))
	self:SetSightTransform(Vector(0, 0, 2.3), Rotator(-1.5, 0, 0))
	self:SetLeftHandTransform(Vector(30, -0.5, 6), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(0, 0, 4))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
	self:SetCadence(0.6)
	self:SetWallbangSettings(100, 0.25)

	self:SetSightFOVMultiplier(0.75)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
	self:SetParticlesShells("nanos-world::P_Weapon_Shells_12Gauge")

	self:SetSoundDry("nanos-world::A_Shotgun_Dry")
	self:SetSoundLoad("nanos-world::A_Shotgun_Load_Bullet")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_Shotgun_Shot_B")
	self:SetSoundFireLastBullets("nanos-world::A_SMG_Dry", 2)

	self:SetAnimationFire("nanos-world::A_SPAS12_Fire")
	self:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire_Heavy")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Shotgun")

	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Shotgun")
end

---@class M1Garand: Weapon
---@overload fun(location: Vector, rotation: Rotator): M1Garand
NanosWorldWeapons.M1Garand = Weapon.Inherit("M1Garand", {
	name = "M1Garand",
	image = "assets://nanos-world/Thumbnails/SK_M1Garand.jpg",
	category = "vintage",
})

function NanosWorldWeapons.M1Garand:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_M1Garand", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(8, 1000)
	self:SetDamage(35)
	self:SetSpread(10)
	self:SetRecoil(0.5)
	self:SetBulletSettings(1, 30000, 30000, Color(100, 58, 0))
	self:SetSightTransform(Vector(0, 0, 2.5), Rotator(1.2, 0, 0))
	self:SetLeftHandTransform(Vector(25, 0, 6), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-5, 0, 0))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
	self:SetCadence(0.2)
	self:SetWallbangSettings(200, 0.75)

	self:SetSightFOVMultiplier(0.5)
	self:SetUsageSettings(false, false)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
	self:SetParticlesShells("nanos-world::P_Weapon_Shells_9x18")

	self:SetSoundDry("nanos-world::A_Rifle_Dry")
	self:SetSoundLoad("nanos-world::A_Rifle_Load")
	self:SetSoundUnload("nanos-world::A_Rifle_Unload")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_M1Garand_Shot")
	self:SetSoundFireLastBullets("nanos-world::A_M1Garand_Ping", 1)

	self:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Rifle")

	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Regular_X")
end

---@class AWP: Weapon
---@overload fun(location: Vector, rotation: Rotator): AWP
NanosWorldWeapons.AWP = Weapon.Inherit("AWP", {
	name = "AWP",
	image = "assets://nanos-world/Thumbnails/SK_AWP.jpg",
	category = "sniper-rifles",
})

function NanosWorldWeapons.AWP:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_AWP", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(10, 1000)
	self:SetDamage(90)
	self:SetSpread(10)
	self:SetRecoil(1.5)
	self:SetBulletSettings(1, 30000, 30000, Color(100, 58, 0))
	self:SetSightTransform(Vector(-15, 0, -4.5), Rotator(0, 0, 0))
	self:SetLeftHandTransform(Vector(25, 0, 6), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-10, 0, 2))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
	self:SetCadence(2)
	self:SetWallbangSettings(200, 0.75)

	self:SetSightFOVMultiplier(0.1)
	self:SetUsageSettings(false, false)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
	self:SetParticlesShells("nanos-world::P_Weapon_Shells_762x39")

	self:SetSoundDry("nanos-world::A_Shotgun_Dry")
	self:SetSoundLoad("nanos-world::A_Shotgun_Load_Bullet")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_SniperRifle_Shot")
	self:SetSoundFireLastBullets("nanos-world::A_SMG_Dry", 2)

	self:SetAnimationFire("nanos-world::A_AWP_Fire")
	self:SetAnimationCharacterFire("nanos-world::A_Mannequin_Sight_Fire_Pistol")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Rifle")

	self:AddStaticMeshAttached("sight", "nanos-world::SM_Scope_25x56", "", Vector(20, 0, 11.175))
end

---@class DC15S: Weapon
---@overload fun(location: Vector, rotation: Rotator): DC15S
NanosWorldWeapons.DC15S = Weapon.Inherit("DC15S", {
	name = "DC15S",
	image = "assets://nanos-world/Thumbnails/SK_DC15S.jpg",
	category = "rifles",
})

function NanosWorldWeapons.DC15S:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SK_DC15S", CollisionType.Auto, true, SpawnMode.AfterConstructor)

	self:SetAmmoSettings(30, 1000)
	self:SetDamage(25)
	self:SetSpread(40)
	self:SetRecoil(0.4)
	self:SetBulletSettings(1, 30000, 30000, Color(0, 0, 1000))
	self:SetSightTransform(Vector(-6, 0, -5), Rotator(0, 0, 0))
	self:SetLeftHandTransform(Vector(19, 0, 5), Rotator(0, 60, 90))
	self:SetRightHandOffset(Vector(-7, 0, -1))
	self:SetHandlingMode(HandlingMode.DoubleHandedWeapon)
	self:SetCadence(0.175)
	self:SetWallbangSettings(200, 0.75)

	self:SetSightFOVMultiplier(0.6)

	self:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
	self:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")

	self:SetSoundDry("nanos-world::A_Rifle_Dry")
	self:SetSoundLoad("nanos-world::A_Rifle_Load")
	self:SetSoundUnload("nanos-world::A_Rifle_Unload")
	self:SetSoundZooming("nanos-world::A_AimZoom")
	self:SetSoundAim("nanos-world::A_Rattle")
	self:SetSoundFire("nanos-world::A_Blast_Shot")
	self:SetSoundFireLastBullets("nanos-world::A_SMG_Dry", 6)

	self:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire")
	self:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Rifle")

	self:SetCrosshairMaterial("nanos-world::MI_Crosshair_Regular")
end

---@class G67: Grenade
---@overload fun(location: Vector, rotation: Rotator): G67
NanosWorldWeapons.G67 = Grenade.Inherit("G67", {
	name = "Grenade",
	image = "assets://nanos-world/Thumbnails/SM_Grenade_G67.jpg",
	category= "grenades",
})

function NanosWorldWeapons.G67:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SM_Grenade_G67", nil, nil, CollisionType.Auto, true, SpawnMode.AfterConstructor)
end


---@class Knife: Melee
---@overload fun(location: Vector, rotation: Rotator): Knife
NanosWorldWeapons.Knife = Melee.Inherit("Knife", {
	name = "Knife",
	image = "assets://nanos-world/Thumbnails/SM_M9.jpg",
	category = "melees",
})

function NanosWorldWeapons.Knife:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SM_M9", CollisionType.Normal, true, HandlingMode.SingleHandedMelee, nil, true, SpawnMode.AfterConstructor)
	self:AddAnimationCharacterUse("nanos-world::AM_Mannequin_Melee_Stab_Attack")
	self:SetDamageSettings(0.3, 0.3)
	self:SetCooldown(1.5)
	self:SetBaseDamage(50)
	self:SetImpactSound(SurfaceType.Default, "nanos-world::A_MetalHeavy_Impact_MS")
end

---@class Crowbar: Melee
---@overload fun(location: Vector, rotation: Rotator): Crowbar
NanosWorldWeapons.Crowbar = Melee.Inherit("Crowbar", {
	name = "Crowbar",
	image = "assets://nanos-world/Thumbnails/SM_Crowbar_01.jpg",
	category = "melees"
})

function NanosWorldWeapons.Crowbar:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SM_Crowbar_01", CollisionType.Normal, true, HandlingMode.SingleHandedMelee, nil, true, SpawnMode.AfterConstructor)
	self:SetScale(Vector(1.5, 1.5, 1.5))
	self:AddAnimationCharacterUse("nanos-world::AM_Mannequin_Melee_Slash_Attack")
	self:SetDamageSettings(0.3, 0.5)
	self:SetCooldown(1.0)
	self:SetBaseDamage(40)
	self:SetImpactSound(SurfaceType.Flesh, "nanos-world::A_Punch_Cue")
	self:SetImpactSound(SurfaceType.Default, "nanos-world::A_MetalHeavy_Impact_MS")
end

---@class BaseballBat: Melee
---@overload fun(location: Vector, rotation: Rotator): BaseballBat
NanosWorldWeapons.BaseballBat = Melee.Inherit("BaseballBat", {
	name = "Baseball Bat",
	image = "assets://nanos-world/Thumbnails/SM_BaseballBat_01.jpg",
	category = "melees"
})

function NanosWorldWeapons.BaseballBat:Constructor(location, rotation)
	self.Super:Constructor(location or Vector(), rotation or Rotator(), "nanos-world::SM_BaseballBat_01", CollisionType.Normal, true, HandlingMode.SingleHandedMelee, nil, true, SpawnMode.AfterConstructor)
	self:AddAnimationCharacterUse("nanos-world::AM_Mannequin_Melee_Slash_Attack")
	self:SetDamageSettings(0.3, 0.5)
	self:SetAttachmentSettings(Vector(0, 0, -10), Rotator(-10, 0, 0))
	self:SetCooldown(1.0)
	self:SetBaseDamage(30)
	self:SetImpactSound(SurfaceType.Flesh, "nanos-world::A_Punch_Cue")
	self:SetImpactSound(SurfaceType.Default, "nanos-world::A_MetalHeavy_Impact_MS")
end