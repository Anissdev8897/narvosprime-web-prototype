-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
SpawnMenu.SpawnItem = function(player, tab, id, spawn_location, spawn_rotation)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	-- If spawning a Prop
	if (tab == "props") then
		-- Rotates the Prop 180 degrees to make it face the player and normalize it to be in range [0-360]
		spawn_rotation.Yaw = spawn_rotation.Yaw + 90
		spawn_rotation:Normalize()

		item = Prop(spawn_location + Vector(0, 0, 50), Rotator(0, spawn_rotation.Yaw, 0), id)

		-- If this Prop is a Breakable Prop, setup it (we only configure Props from Spawn Menu to break*)
		if (BreakableProps[id]) then
			SetupBreakableProp(item)
		end
	else
		if (not SpawnMenu.items[tab] or not SpawnMenu.items[tab][id]) then
			Console.Error("Failed to find item to spawn: Tab '%s'. ID '%s'.", tab, id)
			return
		end

		-- Calls the spawn function
		item = SpawnMenu.items[tab][id].spawn_function(spawn_location, spawn_rotation, tab, id, player)

		-- Forces the Network Authority to the player who spawned it
		item:SetNetworkAuthority(player)

		if (character and character:IsA(Character)) then
			local is_weapon = item:IsA(Weapon)
			local is_melee = item:IsA(Melee)
			local is_grenade = item:IsA(Grenade)

			if (is_weapon or is_melee or is_grenade) then
				-- Stores the old Aim Mode
				local current_aiming_mode = character:GetWeaponAimMode()

				-- Destroys the current picked up item
				local current_picking_weapon = character:GetPicked()
				if (current_picking_weapon) then current_picking_weapon:Destroy() end

				character:PickUp(item)

				if (is_weapon) then
					-- If has previous Aim Mode, sets it again so the Character keeps aiming
					if (current_aiming_mode == AimMode.ADS or current_aiming_mode == AimMode.Zoomed or current_aiming_mode == AimMode.ZoomedZoom) then
						character:SetWeaponAimMode(current_aiming_mode)
					end
				end
			end
		end
	end

	-- Adds to player's history
	SpawnHistory.AddItemToHistory(player, item)
end

-- Handles a Destroy Item event called by client
---@param player Player				The player who triggered it
---@param item any					The item to be destroyed
SpawnMenu.DestroyItem = function(player, item)
	-- Prevent destroying a player character
	if (not item or (item:IsA(Character) and item:GetPlayer())) then
		return
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Events.SubscribeRemote("SpawnItem", function(...)
-- [TROU — ligne jamais lue dans les transcriptions]
	SpawnMenu.SpawnItem(...)
-- [FIN INCONNUE — la suite du fichier n'a jamais été lue dans sa dernière version]