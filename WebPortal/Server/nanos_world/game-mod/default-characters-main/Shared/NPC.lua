-- Base helper class for NPCs, used by Character and CharacterSimple
NPCBase = {}

if (Client) then
	-- Sandbox Context Menu Items when selecting NPCs (note: it only works with Sandbox game-mode)
	NPCBase.selected_context_menu_items = {
		{
			label = "auto walk",
			type = "checkbox",
			callback = function(value)
				Sandbox.ContextMenu.selected_entity:CallRemoteEvent("SetAutoWalk", Reliability.Reliable, value)
			end,
			value = function()
				return Sandbox.ContextMenu.selected_entity:GetValue("AutoWalk")
			end,
		},
		{
			label = "run when damaged",
			type = "checkbox",
			callback = function(value)
				Sandbox.ContextMenu.selected_entity:CallRemoteEvent("SetRunWhenDamaged", Reliability.Reliable, value)
			end,
			value = function()
				return Sandbox.ContextMenu.selected_entity:GetValue("RunWhenDamaged")
			end,
		},
	}

	-- When spawns
	function NPCBase:OnSpawn()
		-- Spawn sound 50% of chance
		if (self.spawn_sound and math.random() < 0.5) then
			self:OnPlaySound(self.spawn_sound)
		end

		if (self.random_sound) then
			Timer.Bind(
				-- After 10 seconds, plays sound 50% of chance
				Timer.SetInterval(function()
					-- Skips if dead
					if (self:IsDead() or math.random() < 0.5) then return end

					-- Plays "random" sound
					self:OnPlaySound(self.random_sound)

				end, 10000, self),
				self
			)
		end
	end

	-- Helper to play sounds attached
	function NPCBase:OnPlaySound(sound_asset)
		local sound = Sound(self:GetLocation(), sound_asset, false, true, SoundType.SFX, 0.3, 1, 400, 3600, AttenuationFunction.NaturalSound)
		sound:AttachTo(self, AttachmentRule.SnapToTarget, "", 0)
	end
end

if (Server) then
	function NPCBase:SetAutoWalk(player, auto_walk)
		if (self.timer_walk and Timer.IsValid(self.timer_walk)) then
			Timer.ClearInterval(self.timer_walk)
		end

		self:SetValue("AutoWalk", auto_walk, true)

		-- If it has a Player, do not walk
		if (self:GetPlayer() ~= nil) then return end

		if (auto_walk) then
			self.timer_walk = Timer.SetInterval(
				function(bound_character)
					-- Does not move it already moving or dead or in ragdoll
					if (bound_character:GetMovingTo() ~= Vector() or bound_character:IsDead()) then return end

					-- Character specific
					if (bound_character:IsA(Character)) then
						-- Does not move if in ragdoll or not on ground
						if (bound_character:IsInRagdollMode() or bound_character:GetStanceMode() == StanceMode.None) then return end

						-- Make him walk
						bound_character:SetGaitMode(GaitMode.Walking)
					end

					-- Walk 30 meters away max
					self:MoveRandom(3000)
				end, math.random(5000) + 5000, self
			)

			Timer.Bind(self.timer_walk, self)
		else
			self:StopMovement()
		end
	end

	function NPCBase:SetRunWhenDamaged(player, run)
		self:SetValue("RunWhenDamaged", run, true)
	end

	-- Randomly walk a NPC to somewhere around within distance
	function NPCBase:MoveRandom(distance)
		-- If it has a Player, do not move
		if (self:GetPlayer() ~= nil) then return end

		local random_location = self:GetLocation() + Vector(math.random(distance) - distance / 2, math.random(distance) - distance / 2, 0)
		self:MoveTo(random_location, 250)
	end

	-- Run away when taking damage
	function NPCBase:__OnTakeDamage(damage, bone, type, from_direction, instigator, causer)
		-- Only run if not dead and no player possessing
		if (self:IsDead() or self:GetPlayer() ~= nil) then return end

		-- Does not run if set to do not run
		if (not self:GetValue("RunWhenDamaged")) then return end

		-- Avoid those damage types
		if (type == DamageType.RunOverVehicle or type == DamageType.RunOverProp or type == DamageType.Fall) then return end

		-- Character has special checks and logic
		if (self:IsA(Character)) then
			self:SetGaitMode(GaitMode.Sprinting)
		end

		local current_location = self:GetLocation()
		local run_to_location = current_location + from_direction * 3000

		-- Run 30 meters away max in the opposite direction
		self:MoveTo(Vector(run_to_location.X, run_to_location.Y, current_location.Z), 1000)
	end

	-- After dying, destroys the Character after 10 seconds
	function NPCBase:__OnDeath(...)
		-- Calls inherited methods
		if (self.OnDeath) then
			self:OnDeath(...)
		end

		-- Only destroys if no player possessing
		if (self:GetPlayer() ~= nil) then return end

		self:SetLifeSpan(10)
	end

	-- If got possessed, disables AI
	function NPCBase:__OnPossess(...)
		-- Calls inherited methods
		if (self.OnPossess) then
			self:OnPossess(...)
		end

		self:SetAIEnabled(false)
	end

	function NPCBase:SetAIEnabled(enabled)
		if (enabled) then
			if (self:GetPlayer() ~= nil) then
				Console.Error("Cannot enable AI on a Character with a Player")
				return
			end

			-- Auto Walk and Run ON by default
			self:SetAutoWalk(nil, true)
			self:SetRunWhenDamaged(nil, true)

			-- Immediately walks after spawning
			self:MoveRandom(2000)
		else
			-- Disable auto walking
			if (self.timer_walk and Timer.IsValid(self.timer_walk)) then
				Timer.ClearInterval(self.timer_walk)
				self.timer_walk = nil
			end

			-- Stops current movement
			self:StopMovement()
		end
	end
end

-- Character and CharacterSimple Base class
BaseDefaultCharacter = Character.Inherit("BaseDefaultCharacter", NPCBase)
BaseDefaultCharacterSimple = CharacterSimple.Inherit("BaseDefaultCharacterSimple", NPCBase)

if (Server) then
	-- Base Character constructor and events
	function BaseDefaultCharacter:Constructor(location, rotation, mesh, enable_ai)
		self.Super:Constructor(location or Vector(), rotation or Rotator(0, math.random(360), 0), mesh, CollisionType.Auto, true, nil, nil, nil, SpawnMode.AfterConstructor)

		if (enable_ai) then
			self:SetAIEnabled(true)
		end
	end

	-- After entering ragdoll, after some time, get up
	function BaseDefaultCharacter:__OnRagdollModeChange(was_in_ragdoll, is_in_ragdoll)
		if (not is_in_ragdoll) then return end

		-- Only stand up if no player possessing
		if (self:GetPlayer() ~= nil) then return end

		Timer.Bind(
			Timer.SetTimeout(function()
				-- If dead, not in ragdoll or has player possessing, do nothing
				if (self:IsDead() or not self:IsInRagdollMode() or self:GetPlayer() ~= nil) then return end

				self:SetRagdollMode(false)
				self:SetGaitMode(GaitMode.Sprinting)
			end, 3000),
			self
		)
	end

	BaseDefaultCharacter.Subscribe("TakeDamage", BaseDefaultCharacter.__OnTakeDamage)
	BaseDefaultCharacter.Subscribe("Death", BaseDefaultCharacter.__OnDeath)
	BaseDefaultCharacter.Subscribe("Possess", BaseDefaultCharacter.__OnPossess)
	BaseDefaultCharacter.Subscribe("RagdollModeChange", BaseDefaultCharacter.__OnRagdollModeChange)
	BaseDefaultCharacter.SubscribeRemote("SetAutoWalk", BaseDefaultCharacter.SetAutoWalk)
	BaseDefaultCharacter.SubscribeRemote("SetRunWhenDamaged", BaseDefaultCharacter.SetRunWhenDamaged)


	-- Base CharacterSimple constructor and events
	function BaseDefaultCharacterSimple:Constructor(location, rotation, mesh, animation_blueprint, enable_ai)
		self.Super:Constructor(location or Vector(), rotation or Rotator(0, math.random(360), 0), mesh, animation_blueprint, CollisionType.Auto, true, SpawnMode.AfterConstructor)

		if (enable_ai) then
			self:SetAIEnabled(true)
		end
	end

	BaseDefaultCharacterSimple.Subscribe("TakeDamage", BaseDefaultCharacterSimple.__OnTakeDamage)
	BaseDefaultCharacterSimple.Subscribe("Death", BaseDefaultCharacterSimple.__OnDeath)
	BaseDefaultCharacterSimple.Subscribe("Possess", BaseDefaultCharacterSimple.__OnPossess)
	BaseDefaultCharacterSimple.SubscribeRemote("SetAutoWalk", BaseDefaultCharacterSimple.SetAutoWalk)
	BaseDefaultCharacterSimple.SubscribeRemote("SetRunWhenDamaged", BaseDefaultCharacterSimple.SetRunWhenDamaged)
end

if (Client) then
	BaseDefaultCharacter.SubscribeRemote("PlaySound", BaseDefaultCharacter.OnPlaySound)
	BaseDefaultCharacter.Subscribe("Spawn", BaseDefaultCharacter.OnSpawn)

	BaseDefaultCharacterSimple.SubscribeRemote("PlaySound", BaseDefaultCharacterSimple.OnPlaySound)
	BaseDefaultCharacterSimple.Subscribe("Spawn", BaseDefaultCharacterSimple.OnSpawn)
end