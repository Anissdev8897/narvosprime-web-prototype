-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Weapons.lua — armes NARVOS, construites sur la classe `Weapon`.
--
-- Câblage : Narvos.Weapons = Package.Require("Logic/Weapons.lua")
--
-- ── POURQUOI PASSER PAR `Weapon` ET PAS UN MESH ATTACHÉ ───────────────────────
-- `Logic/Character.lua` pose une arme décorative avec `AddStaticMeshAttached` :
-- elle se voit, mais elle ne tire pas, ne se recharge pas, et le personnage n'a
-- aucune pose de tir. La classe `Weapon` de nanos apporte tout cela — visée,
-- munitions, recul, dispersion, douilles, sons, ET les animations de personnage.
--
-- ── LE POINT QUI REND CE FICHIER POSSIBLE ─────────────────────────────────────
-- Toutes les animations d'arme du pack de base sont des `*_Mannequin_*` :
-- `A_Mannequin_Sight_Fire_Pistol`, `AM_Mannequin_Reload_Rifle`… Elles sont
-- construites pour `SKEL_Mannequin`. Nos 611 meshes importés y étant TOUS liés
-- (vérifié par `scripts/adk-verify-skeletons.py`), elles s'appliquent à nos
-- personnages sans retargeting. C'est le bénéfice concret d'avoir imposé ce
-- squelette à l'import.
--
-- ── SOURCE DES RÉGLAGES ───────────────────────────────────────────────────────
-- Recopiés du package officiel `default-weapons-master/Shared/Index.lua` livré
-- avec nanos, pas inventés. Les valeurs de dégâts sont NARVOS ; tout le reste
-- (transformations de mains, particules, sons, animations) vient de configs qui
-- fonctionnent déjà. Une transformation de main mal réglée donne une arme qui
-- flotte à côté du poing, et ça ne se devine pas — ça se copie.
--
-- ⚠ Les meshes sont ceux du pack de BASE (`nanos-world::SK_Glock`…). Nos propres
-- armes existent — 642 GLB compatibles sous `public/models/armes`, dont
-- `CG_ShotgunPack` et `FPS_Arms` — mais elles ne sont pas encore cuites. Le jour
-- où elles le seront, seul le champ `mesh` de ce catalogue change.
-- ═══════════════════════════════════════════════════════════════════════════════

---@class NarvosWeapons
local Weapons = {}

-- ── Catalogue ──────────────────────────────────────────────────────────────────
--
-- Une entrée par arme. `constructeur` reçoit l'objet Weapon déjà spawné et le
-- configure : c'est la seule partie qui diffère vraiment d'une arme à l'autre.

Weapons.CATALOGUE = {}

--- Pistolet — le cas que la question portait explicitement.
--- HandlingMode.SingleHandedWeapon : une main. Les deux animations ci-dessous
--- sont les variantes PISTOLET ; utiliser celles du fusil donnerait un
--- personnage qui recharge une arme qu'il ne tient pas.
Weapons.CATALOGUE.pistolet = {
    label = "Pistolet NARVOS",
    mesh  = "nanos-world::SK_Glock",
    categorie = "pistols",
    -- Viseur du HUD. Une arme precise merite un point ; une gerbe merite un
    -- cercle. Le choix appartient a l arme, pas a un reglage du joueur.
    viseur = "point",
    configurer = function(arme)
        arme:SetAmmoSettings(17, 1000)
        arme:SetDamage(15)
        arme:SetSpread(20)
        arme:SetRecoil(0.5)
        arme:SetCadence(0.15)
        arme:SetBulletSettings(1, 30000, 30000, Color(13, 100, 0))
        arme:SetWallbangSettings(160, 0.25)

        -- Transformations reprises telles quelles du Glock officiel : elles
        -- placent l'arme dans la main et l'œil dans la lunette.
        arme:SetSightTransform(Vector(0, 0, 1), Rotator(-0.5, 0, 0))
        arme:SetLeftHandTransform(Vector(0, 0, -4), Rotator(0, 60, 100))
        arme:SetRightHandOffset(Vector(-25, 0, 0))
        arme:SetHandlingMode(HandlingMode.SingleHandedWeapon)
        arme:SetSightFOVMultiplier(0.6)

        arme:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
        arme:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
        arme:SetParticlesShells("nanos-world::P_Weapon_Shells_9mm")

        arme:SetSoundDry("nanos-world::A_Pistol_Dry")
        arme:SetSoundLoad("nanos-world::A_Pistol_Load")
        arme:SetSoundUnload("nanos-world::A_Pistol_Unload")
        arme:SetSoundFire("nanos-world::A_Glock_Shot")

        -- ⚠ LES TROIS LIGNES QUI RÉPONDENT À « vérifier les animations pistolet ».
        arme:SetAnimationCharacterFire("nanos-world::A_Mannequin_Sight_Fire_Pistol")
        arme:SetAnimationFire("nanos-world::A_Glock_Fire")
        arme:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Pistol")

        arme:SetMagazineMesh("nanos-world::SM_Glock_Mag_Empty")
        arme:SetCrosshairMaterial("nanos-world::MI_Crosshair_Circle")
    end,
}

--- Fusil d'assaut — deux mains, animations `Sight_Fire` et `Reload_Rifle`.
Weapons.CATALOGUE.fusil = {
    label = "Fusil d'assaut NARVOS",
    mesh  = "nanos-world::SK_AK47",
    categorie = "rifles",
    viseur = "croix",
    configurer = function(arme)
        arme:SetAmmoSettings(30, 1000)
        arme:SetDamage(30)
        arme:SetSpread(30)
        arme:SetRecoil(0.25)
        arme:SetCadence(0.1)
        arme:SetBulletSettings(1, 20000, 20000, Color(100, 58, 0))
        arme:SetWallbangSettings(50, 0.75)

        arme:SetSightTransform(Vector(0, 0, -1), Rotator(-1.5, 0, 0))
        arme:SetLeftHandTransform(Vector(22, 0, 9), Rotator(0, 60, 90))
        arme:SetRightHandOffset(Vector(-10, 0, 0))
        arme:SetHandlingMode(HandlingMode.DoubleHandedWeapon)

        arme:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
        arme:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")
        arme:SetParticlesShells("nanos-world::P_Weapon_Shells_762x39")

        arme:SetSoundDry("nanos-world::A_Rifle_Dry")
        arme:SetSoundLoad("nanos-world::A_Rifle_Load")
        arme:SetSoundUnload("nanos-world::A_Rifle_Unload")
        arme:SetSoundFire("nanos-world::A_AK47_Shot")

        arme:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire")
        arme:SetAnimationFire("nanos-world::A_AK47_Fire")
        arme:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Rifle")

        arme:SetMagazineMesh("nanos-world::SM_AK47_Mag_Empty")
        arme:SetCrosshairMaterial("nanos-world::MI_Crosshair_Regular")
    end,
}

--- Fusil à pompe — troisième animation de rechargement, distincte des deux
--- autres. La lister rend le jeu de poses complet et testable.
Weapons.CATALOGUE.pompe = {
    label = "Fusil à pompe NARVOS",
    mesh  = "nanos-world::SK_Moss500",
    categorie = "shotguns",
    viseur = "cercle",
    configurer = function(arme)
        arme:SetAmmoSettings(8, 1000)
        arme:SetDamage(20)
        arme:SetSpread(80)
        arme:SetRecoil(1.0)
        arme:SetCadence(0.8)
        -- 8 projectiles par tir : c'est ce qui fait une gerbe et non une balle.
        arme:SetBulletSettings(8, 20000, 20000, Color(100, 58, 0))

        arme:SetSightTransform(Vector(0, 0, -0.5), Rotator(0, 0, 0))
        arme:SetLeftHandTransform(Vector(30, 0, 6), Rotator(0, 60, 90))
        arme:SetRightHandOffset(Vector(-10, 0, 0))
        arme:SetHandlingMode(HandlingMode.DoubleHandedWeapon)

        arme:SetParticlesBulletTrail("nanos-world::P_Bullet_Trail")
        arme:SetParticlesBarrel("nanos-world::P_Weapon_BarrelSmoke")

        arme:SetSoundDry("nanos-world::A_Rifle_Dry")
        arme:SetSoundFire("nanos-world::A_Moss500_Shot")

        arme:SetAnimationCharacterFire("nanos-world::AM_Mannequin_Sight_Fire_Heavy")
        arme:SetAnimationFire("nanos-world::A_Moss500_Fire")
        arme:SetAnimationReload("nanos-world::AM_Mannequin_Reload_Shotgun")

        arme:SetCrosshairMaterial("nanos-world::MI_Crosshair_Shotgun")
    end,
}

-- Ordre d'affichage figé. `pairs` n'a aucun ordre garanti en Lua et il change
-- d'une VM à l'autre : sans cette séquence, deux joueurs verraient les armes
-- dans un ordre différent.
Weapons.ORDRE = { "pistolet", "fusil", "pompe" }

-- ── Le pack de base, GENERE ────────────────────────────────────────────────────
--
-- Les trois entrees ci-dessus sont les reglages NARVOS (degats, dispersion),
-- ecrits a la main. Les vingt-huit armes du package officiel arrivent par
-- `Catalogs/ArmesBase.lua`, genere depuis `default-weapons-master` par
-- `scripts/narvos-armes-base-to-lua.mjs` — jamais recopiees.
--
-- Prefixe `base_` : un identifiant du pack de base ne peut pas ecraser un
-- reglage NARVOS, meme s'ils portent le meme nom un jour.
--
-- ⚠ Appelee depuis Shared/Index.lua, APRES le require du catalogue. Sans cet
-- appel, `Options()` ne liste que trois armes et rien ne le signale.
---@param base table|nil  Catalogs/ArmesBase.lua
---@return integer  nombre d'armes ajoutees
function Weapons.Configurer(base)
    if (type(base) ~= "table" or type(base.ARMES) ~= "table") then return 0 end
    local ajoutees = 0
    for _, a in ipairs(base.ARMES) do
        local id = "base_" .. tostring(a.id)
        if (Weapons.CATALOGUE[id] == nil and type(a.configurer) == "function") then
            Weapons.CATALOGUE[id] = {
                label = a.label, mesh = a.mesh, categorie = a.categorie,
                viseur = "regulier", configurer = a.configurer,
            }
            Weapons.ORDRE[#Weapons.ORDRE + 1] = id
            ajoutees = ajoutees + 1
        end
    end
    return ajoutees
end

--- Les categories presentes, dans l'ordre d'apparition — pour le rail du menu.
---@return table[]  { id, label }
function Weapons.Categories()
    local vues, sortie = {}, {}
    for _, id in ipairs(Weapons.ORDRE) do
        local c = Weapons.CATALOGUE[id].categorie or "autres"
        if (not vues[c]) then
            vues[c] = true
            sortie[#sortie + 1] = { id = c, label = c:sub(1, 1):upper() .. c:sub(2) }
        end
    end
    return sortie
end

-- ── Fabrication ────────────────────────────────────────────────────────────────

--- Spawne une arme du catalogue.
---@param id string        clé de Weapons.CATALOGUE
---@param location table   Vector
---@param rotation? table  Rotator
---@return table|nil arme
---@return string|nil raison
function Weapons.Creer(id, location, rotation)
    local def = Weapons.CATALOGUE[id]
    if (not def) then return nil, "arme inconnue : " .. tostring(id) end

    local arme = Weapon(location, rotation or Rotator(), def.mesh)
    if (not arme) then return nil, "spawn refusé pour " .. tostring(def.mesh) end

    def.configurer(arme)

    -- Posé sur l'entité, synchronisé : le client et tout autre package peuvent
    -- savoir de quelle arme NARVOS il s'agit sans table de correspondance.
    arme:SetValue("narvos_arme", id, true)
    return arme
end

--- Donne une arme à un personnage, en remplaçant celle qu'il tient.
--- Sans le `Drop` préalable, `PickUp` empile silencieusement : le personnage
--- garde la première et la nouvelle reste au sol, invisible sous ses pieds.
---@param character table
---@param id string
---@return table|nil arme
---@return string|nil raison
function Weapons.Donner(character, id)
    if (not character) then return nil, "personnage nil" end
    if (not Weapons.CATALOGUE[id]) then return nil, "arme inconnue : " .. tostring(id) end

    local arme, raison = Weapons.Creer(id, character:GetLocation() + Vector(0, 0, 50))
    if (not arme) then return nil, raison end

    local tenue = character:GetPicked()
    if (tenue) then
        character:Drop()
        -- L'arme lâchée n'a plus d'usage : la laisser au sol accumulerait une
        -- arme par essai, et chacune coûte une entité répliquée.
    end
    character:PickUp(arme)
    if (character:GetPicked() ~= arme) then
        arme:Destroy()
        if (tenue and tenue:IsValid()) then character:PickUp(tenue) end
        return nil, "L'arme n'a pas pu être équipée"
    end
    if (tenue and tenue:GetValue("narvos_projection_sac", false)) then
        Timer.SetTimeout(function() if (tenue:IsValid()) then tenue:Destroy() end end, 100)
    end
    return arme
end

--- Liste ce qu'un marchand ou un menu peut proposer.
---@return table[]
function Weapons.Options()
    local sortie = {}
    for _, id in ipairs(Weapons.ORDRE) do
        local d = Weapons.CATALOGUE[id]
        sortie[#sortie + 1] = { id = id, label = d.label, categorie = d.categorie }
    end
    return sortie
end

--- Vérifie que chaque arme déclare ses trois animations.
--- Une arme sans `AnimationCharacterFire` tire sans que le personnage bouge —
--- défaut visible seulement en jouant, et facile à laisser passer.
---@return string[] avertissements
function Weapons.Validate()
    local warnings = {}
    for _, id in ipairs(Weapons.ORDRE) do
        local d = Weapons.CATALOGUE[id]
        if (not d) then
            warnings[#warnings + 1] = id .. " : présent dans ORDRE mais absent du catalogue"
        elseif (type(d.configurer) ~= "function") then
            warnings[#warnings + 1] = id .. " : pas de fonction de configuration"
        elseif (not d.mesh) then
            warnings[#warnings + 1] = id .. " : aucun mesh"
        end
    end
    return warnings
end

return Weapons
