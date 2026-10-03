-- Spawn Menu Data
SpawnMenu = SpawnMenu or {
	-- Whether the menu is opened
	is_opened = false,

	-- List of all items
	items = {},
}

-- Exposes SpawnMenu to other packages
Sandbox.SpawnMenu = SpawnMenu

-- Configures the Highlight colors to be used
Client.SetHighlightColor(Color(0, 1, 0, 1.20), 0, HighlightMode.Always) -- Index 0
Client.SetOutlineColor(Color(0, 0, 10), 2) -- Index 2

-- Caches Sounds with Auto Play = false
SoundDeleteItemFromHistory = Sound(Vector(), "nanos-world::A_Player_Eject", true, false, SoundType.UI, 0.1, 1, 400, 3600, 0, false, 0, false)
SoundButtonHover = Sound(Vector(), "nanos-world::A_Button_Hover_Cue", true, false, SoundType.UI, 1, 1, 400, 3600, 0, false, 0, false)
SoundButtonClick = Sound(Vector(), "nanos-world::A_Button_Click_Cue", true, false, SoundType.UI, 1, 1, 400, 3600, 0, false, 0, false)
SoundSpawnItem = Sound(Vector(), "nanos-world::A_Button_Click_Up_Cue", true, false, SoundType.UI, 1, 1.1, 400, 3600, 0, false, 0, false)
SoundSelectOption = Sound(Vector(), "nanos-world::A_Button_Click_Up_Cue", true, false, SoundType.UI, 1, 1.1, 400, 3600, 0, false, 0, false)
SoundInvalidAction = Sound(Vector(), "nanos-world::A_Invalid_Action", true, false, SoundType.UI, 1, 1, 400, 3600, 0, false, 0, false)


SpawnMenu.AddInheritedClasses = function(tab, parent_class, custom_validator)
	-- Iterates all existing classes
	for _, class in pairs(parent_class.GetInheritedClasses(true)) do
		SpawnMenu.AddInheritedClass(tab, class, custom_validator, true)
	end

	-- Subscribes for further created classes
	parent_class.Subscribe("ClassRegister", function(class)
		SpawnMenu.AddInheritedClass(tab, class, custom_validator)
	end)
end

SpawnMenu.AddInheritedClass = function(tab, class, custom_validator, dont_add_to_spawn_menu)
	if (class.name and (not custom_validator or custom_validator(class))) then
		-- Overrides custom tab
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Package.Subscribe("Load", function()
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	SpawnMenu.AddInheritedClasses("npcs", CharacterSimple)
	SpawnMenu.AddInheritedClasses("npcs", CharacterGASP)
	SpawnMenu.AddInheritedClasses("weapons", Melee)
	-- All inherited from Prop we consider Entity
	SpawnMenu.AddInheritedClasses("entities", Prop)
	SpawnMenu.AddInheritedClasses("weapons", Grenade)
	SpawnMenu.AddInheritedClasses("weapons", Weapon)
	SpawnMenu.AddInheritedClasses("vehicles", VehicleWheeled)
	SpawnMenu.AddInheritedClasses("vehicles", VehicleWater)

	-- Calls UI to add all items
	Sandbox.HUD:CallEvent("SetSpawnMenuItems", SpawnMenu.items)
end)

SpawnMenu.Close = function()
	SpawnMenu.is_opened = false

	Sandbox.HUD:CallEvent("ToggleSpawnMenuVisibility", false)
	Input.SetMouseEnabled(false)
	Chat.SetVisibility(true)

	PlayClickSound(0.9)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	Input.SetMouseEnabled(true)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	PlayClickSound(1.1)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Input.Bind("SpawnMenu", InputEvent.Released, function()
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Input.Bind("SpawnMenu", InputEvent.Pressed, function()
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
function PlayHoverSound(pitch)
-- [TROU — ligne jamais lue dans les transcriptions]
	SoundButtonHover:Play()
end

function PlayClickSound(pitch)
	SoundButtonClick:SetPitch(pitch or 1)
	SoundButtonClick:Play()
end

Sandbox.HUD:Subscribe("HoverSound", PlayHoverSound)
Sandbox.HUD:Subscribe("ClickSound", PlayClickSound)


-- Handle for selecting an Item from the SpawnMenu
Sandbox.HUD:Subscribe("SpawnItem", function(category, asset_id)
	-- Gets the world spawn location to spawn the Item
	local viewport_2D_center = Viewport.GetViewportSize() / 2
	local viewport_3D = Viewport.DeprojectScreenToWorld(viewport_2D_center)
	local trace_max_distance = 5000

	local start_location = viewport_3D.Position
	local end_location = viewport_3D.Position + viewport_3D.Direction * trace_max_distance
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
    local trace_result = Trace.LineSingle(start_location, end_location, CollisionChannel.WorldStatic | CollisionChannel.WorldDynamic | CollisionChannel.Water, TraceMode.TraceOnlyVisibility)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	if (not Events.Call("SpawnItem_" .. asset_id, category, asset_id, spawn_location, spawn_rotation)) then
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	Events.CallRemote("SpawnItem", Reliability.Reliable, category, asset_id, spawn_location, spawn_rotation)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	SoundSpawnItem:Play()
-- [FIN INCONNUE — la suite du fichier n'a jamais été lue dans sa dernière version]