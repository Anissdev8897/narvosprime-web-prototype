-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
			Events.CallRemote("SpawnActionSound", player, Reliability.Reliable, location, _asset)
-- [TROU — ligne jamais lue dans les transcriptions]
			Events.BroadcastRemote("SpawnActionSound", Reliability.Reliable, location, _asset)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
		Chat.BroadcastMessage("<cyan>" .. player:GetName() .. "</> is on a <red>" .. kill_streak .. "</> kill streak!")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
		Chat.BroadcastMessage("<cyan>" .. player:GetName() .. "</> made a <red>" .. label .. "</>")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	end

	if (DeathmatchSettings.mode == GAME_MODE.GUNGAME) then
		if ((player:GetValue("Score") or 0) + 1 == #GunGameWeapons) then
			UpdateMatchState(MATCH_STATES.POST_TIME)
			Server:BroadcastChatMessage("<cyan>" .. player:GetName() .. "</> has won!")
			return
		end

		-- Updates accumulated kill
		local accumulated_kills = player:GetValue("AccumulatedKills") or 0

		if (accumulated_kills >= 1) then
			player:SetValue("AccumulatedKills", 0, true)
			-- Adds score for killing
			-- TODO sound
			AddScore(player, 1, "level_up", "LEVEL UP", false, true)

			-- If has a weapon, destroys it
			local character = player:GetControlledCharacter()
			local weapon = character:GetPicked()
			local old_aiming = character:GetWeaponAimMode()

			if (weapon and weapon:IsValid()) then
				weapon:Destroy()
			end

			local new_weapon = SpawnWeapon(player)

			if (new_weapon) then
				character:PickUp(new_weapon)
				character:SetWeaponAimMode(old_aiming)
			end
		else
			player:SetValue("AccumulatedKills", 1, true)
		end
	end
end

-- Function to Add a Death to the Player's death count
function AddDeath(player, instigator)
	local current_player_deaths = player:GetValue("Deaths") or 0
	player:SetValue("Deaths", current_player_deaths + 1, true)

	-- Checks for Kill Streak ending
	if (instigator) then
		local kill_streak = player:GetValue("KillStreak") or 0

		if (kill_streak >= 5) then
			-- Adds score for that
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
			Chat.BroadcastMessage("<cyan>" .. instigator:GetName() .. "</> ended <cyan>" .. player:GetName() .. "'s</> <red>" .. kill_streak .. "</> streak!")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
		Events.CallRemote("AddScore", player, Reliability.Reliable, score, id, label, use_current_label or false)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Character.Subscribe("TakeDamage", function(character, damage, bone, type, from, instigator, causer)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Character.Subscribe("Death", function(character, last_damage_taken, last_bone_damaged, damage_type_reason, hit_from_direction, instigator)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
		-- Respawns after 5 seconds
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
					RespawnPlayer(_player)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Weapon.Subscribe("Drop", function(weapon, character)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
		Events.BroadcastRemote("SpawnSound", Reliability.Reliable, Vector(), "unreal-tournament-announcer::A_Prepare", true, 1, 1)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]

		CleanUp()

		-- Freeze all characters
		for k, character in pairs(Character.GetAll()) do
			character:SetInputEnabled(false)
			character:SetFlyingMode(true)
		end

	elseif (new_state == MATCH_STATES.IN_PROGRESS) then
		Deathmatch.remaining_time = DeathmatchSettings.match_time
		Deathmatch.first_blood = false

		Events.BroadcastRemote("SpawnSound", Reliability.Reliable, Vector(), "unreal-tournament-announcer::A_Proceed", true, 1, 1)

		Console.Log("Round started!")
		Chat.BroadcastMessage("<grey>Round Started!</>")

		-- Unfreeze all characters
		for k, character in pairs(Character.GetAll()) do
			character:SetInputEnabled(true)
			character:SetFlyingMode(false)
		end

	elseif (new_state == MATCH_STATES.POST_TIME) then
		Deathmatch.remaining_time = DeathmatchSettings.post_time

		-- Freeze all characters
		for k, character in pairs(Character.GetAll()) do
			character:SetInputEnabled(false)
			character:SetFlyingMode(true)
		end
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
		for k, player in pairs(Player.GetAll()) do
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
				Events.CallRemote("SpawnSound", player, Reliability.Reliable, Vector(), "unreal-tournament-announcer::A_Winner", true, 1, 1)
-- [TROU — ligne jamais lue dans les transcriptions]
				Events.CallRemote("SpawnSound", player, Reliability.Reliable, Vector(), "unreal-tournament-announcer::A_LastPlace", true, 1, 1)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
			Chat.BroadcastMessage(tostring(rank) .. "# <cyan>" .. player:GetName() .. "</>: " .. tostring(player_score))
-- [TROU — ligne jamais lue dans les transcriptions]
			Events.CallRemote("SubmitScoreToSteamLeaderboard", player, Reliability.Reliable, player_score)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
		Chat.BroadcastMessage("<grey>=============================</>")

		Console.Log("Post time!")
		Chat.BroadcastMessage("<grey>Post time!</>")
	end

	-- Sends to the player the new match state
	UpdatePlayerMatchState()
end

-- When player joins and/or is ready
Events.SubscribeRemote("PlayerReady", function(player)
	-- If the match is about to end, don't do nothing
	if (Deathmatch.match_state ~= MATCH_STATES.POST_TIME) then
		-- Respawns the character
		local character = RespawnPlayer(player)

		-- If is preparing, freeze him
		if (Deathmatch.match_state == MATCH_STATES.PREPARING) then
			character:SetInputEnabled(false)
			character:SetFlyingMode(true)
		end
	end

	-- Sends him the match state
	UpdatePlayerMatchState(player)

	Chat.BroadcastMessage("<cyan>" .. player:GetName() .. "</> has joined the server")
end)

-- When Player leaves the server
Player.Subscribe("Destroy", function(player)
	-- Destroy it's Character
	local character = player:GetControlledCharacter()
	if (character) then
		character:Destroy()
	end

	Chat.BroadcastMessage("<cyan>" .. player:GetName() .. "</> has left the server")
end)

-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	for k, player in pairs(Player.GetAll()) do
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
		RespawnPlayer(player)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
function RespawnPlayer(player)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local character = player:GetControlledCharacter()

	local spawn_point = DeathmatchSettings.spawn_locations[math.random(#DeathmatchSettings.spawn_locations)]
	if (not spawn_point) then spawn_point = { location = Vector(math.random(-3000, 3000), math.random(-3000, 3000), 0), rotation = Rotator(0, math.random(-180, 180), 0) } end

	local spawn_location = spawn_point.location + Vector(0, 0, math.random(5000, 6000))
	local spawn_rotation = spawn_point.rotation or Rotator(0, math.random(-180, 180), 0)

	-- If player already has a character
	if (character) then

		-- If has a weapon, destroys it
		local weapon = character:GetPicked()

		if (weapon and weapon:IsValid()) then
			weapon:Destroy()
		end

		-- Respawns the character
		character:Respawn(spawn_location, spawn_rotation)
	else
		-- Spawns a new character
		local mesh = CharacterMeshes[math.random(#CharacterMeshes)]
		character = Character(spawn_location, spawn_rotation, mesh)

		-- Bad meshes come with mouth open by default
		character:SetMorphTarget("Close_Mouth", 1)

		character:SetCanPickupPickables(false)
		character:SetCanGrabProps(false)
		character:SetCanDrop(false)
		character:SetSpeedMultiplier(1.3)

		player:Possess(character)
	end

	if (Deathmatch.match_state == MATCH_STATES.PREPARING) then
		character:SetInputEnabled(false)
	end

	-- Spawns a new weapon
	local weapon = SpawnWeapon(player)

	if (weapon) then
		character:PickUp(weapon)
	end

	-- Sets the character invulnerable for 3 seconds
	character:SetInvulnerable(true)
	character:SetMaterialColorParameter("Tint", Color.BLUE)

	Timer.Bind(
		Timer.SetTimeout(function(_character)
			_character:SetMaterialColorParameter("Tint", Color.WHITE)
			_character:SetInvulnerable(false)
		end, 3000, character),
		character
	)

	return character
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	trigger:Subscribe("BeginOverlap", function(self, object)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
			Events.CallRemote("SpawnSound", object:GetPlayer(), Reliability.Reliable, Vector(), "nanos-world::A_VR_Open", true, 1, 1)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
		Events.CallRemote("UpdateMatchState", player, Reliability.Reliable, Deathmatch.match_state, Deathmatch.remaining_time, Deathmatch.sky_hour_time)
-- [TROU — ligne jamais lue dans les transcriptions]
		Events.BroadcastRemote("UpdateMatchState", Reliability.Reliable, Deathmatch.match_state, Deathmatch.remaining_time, Deathmatch.sky_hour_time)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	Events.BroadcastRemote("SpawnSound", Reliability.Reliable, Vector(), announcer, true, 1, 1)
-- [FIN INCONNUE — la suite du fichier n'a jamais été lue dans sa dernière version]