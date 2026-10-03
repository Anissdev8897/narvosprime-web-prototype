-- ══════════════════════════════════════════════════════════════════════════════
-- narvos/Shared/Logic/Inventory.lua — Système d'items : piles, grille, équipement
--
-- Portage du runtime TS (src/rpg/items/{stacking,gridInventory,equipmentSlots,
-- inventoryStore}.ts). Module PUR : aucune API nanos n'est appelée, ni au
-- chargement ni à l'exécution. Deux raisons :
--   1. Shared/ tourne dans la VM serveur ET dans chaque VM client ; toucher une
--      API d'un seul côté ferait planter l'autre au require.
--   2. La logique reste testable hors du moteur, comme les tests vitest d'origine.
--
-- AUTORITÉ : le store ci-dessous est un singleton PAR VM. Le serveur fait foi ;
-- un client ne doit s'en servir que pour afficher un état déjà répliqué.
--
-- Conventions : PascalCase pour l'API publique, snake_case pour les locales et
-- paramètres, camelCase pour les CHAMPS DE DONNÉES (itemId, gridW, maxStack…) —
-- ces derniers viennent des catalogues générés depuis le TS, les renommer
-- désynchroniserait le module de Catalogs/*.lua.
--
-- Coordonnées de grille 0-based (héritées du TS et de l'UI web) ; index de liste
-- 1-based (Lua). Les deux cohabitent volontairement : ne jamais convertir une
-- coordonnée, ne jamais indexer `instances` à 0.
-- ══════════════════════════════════════════════════════════════════════════════

---@class NarvosItemStats
---@field attackPower? number
---@field defense? number
---@field maxHp? number
---@field maxMana? number
---@field puissance? number
---@field critique? number
---@field vitesse? number
---@field initative? number

---@class NarvosItemDefinition
---@field id string
---@field label string
---@field type string
---@field rarity string
---@field gridW integer      Largeur occupée dans la grille
---@field gridH integer      Hauteur occupée dans la grille
---@field stackable boolean
---@field maxStack integer   1 = non empilable
---@field stats NarvosItemStats
---@field level integer
---@field equipSlot? NarvosEquipSlot  Défini ⇒ équipable
---@field icon string
---@field value integer
---@field weight number

---@class NarvosItemInstance Une PILE posée dans la grille.
---@field itemId string    Référence vers NarvosItemDefinition.id
---@field quantity integer
---@field gridX integer    0-based
---@field gridY integer    0-based
---@field gridW integer    Dénormalisé depuis la définition au placement
---@field gridH integer
---@field uid string       Identité de la pile (drag & drop, retrait ciblé)

---@class NarvosGridState
---@field cols integer
---@field rows integer
---@field instances NarvosItemInstance[]

---@alias NarvosEquipSlot "helmet"|"armor"|"legs"|"weapon"|"offhand"|"accessory"

---@alias NarvosEquipmentState table<NarvosEquipSlot, NarvosItemInstance>

---@class NarvosInventoryState
---@field grid NarvosGridState
---@field equipment NarvosEquipmentState
---@field credits integer
---@field revision integer  Incrémenté à chaque mutation (détection de changement UI)

---@class NarvosInventory
local Inventory = {}

-- ── Constantes ──────────────────────────────────────────────────────────────

Inventory.DEFAULT_GRID_COLS = 8
Inventory.DEFAULT_GRID_ROWS = 10
--- ⚠ TROISIEME valeur de credits du depot, et elle etait la seule a diverger.
--- Les trois valent 1500 depuis le 2026-10-03 (regle : aucune tenue offerte) :
---   Roster.lua:54       CREDITS_DEPART = 1500 ← fait foi, pose a la creation
---   src/rpg/loot/Inventory.ts:52  STARTER_CREDITS = 1500
--- Celle-ci sert de REPLI (l. 797 et 850 : `next_state.credits or …`). Elle est
--- dormante aujourd hui : l UI n affiche aucun credit, et les credits vivent dans
--- leur propre colonne `personnages.credits`, pas dans le blob d inventaire.
---
--- Alignee quand meme. Sur ce depot, une valeur dormante gardee "au cas ou" a
--- deja pris la place du choix du joueur le jour ou la fonction a ete branchee
--- (COULEURS_DEFAUT, et les couleurs sont parties effacees en base).
Inventory.DEFAULT_CREDITS = 1500

--- Ordre d'affichage des slots d'équipement. Source de vérité UNIQUE : les deux
--- tables suivantes en sont dérivées, pour qu'un renommage ne puisse pas créer
--- de divergence entre le libellé de la fiche et celui de la liste.
Inventory.EQUIPMENT_SLOTS_ORDERED = {
	{ slot = "helmet",    label = "Casque",           icon = "🪖" },
	{ slot = "armor",     label = "Torse",            icon = "🛡️" },
	{ slot = "legs",      label = "Jambes",           icon = "👖" },
	{ slot = "shoes",     label = "Chaussures" },
	{ slot = "weapon",    label = "Arme principale",  icon = "⚔️" },
	{ slot = "offhand",   label = "Arme secondaire",  icon = "🛡️" },
	{ slot = "necklace",  label = "Collier" },
	{ slot = "ring1",     label = "Anneau 1" },
	{ slot = "ring2",     label = "Anneau 2" },
	{ slot = "accessory", label = "Bijoux",           icon = "✨" },
	{ slot = "belt",      label = "Ceinture" },
	{ slot = "cloak",     label = "Cape" },
}

--- Liste ordonnée des 12 identifiants de slot. C'est ELLE qu'il faut itérer, et
--- jamais `pairs(equipment)` : un slot vide est nil en Lua, donc absent de la
--- table — `pairs` ne verrait pas les slots libres et son ordre varie.
Inventory.EQUIP_SLOTS = {}

--- slot → libellé français.
Inventory.EQUIP_SLOT_LABELS = {}

for index, entry in ipairs(Inventory.EQUIPMENT_SLOTS_ORDERED) do
	Inventory.EQUIP_SLOTS[index] = entry.slot
	Inventory.EQUIP_SLOT_LABELS[entry.slot] = entry.label
end

-- ── Utilitaires internes ────────────────────────────────────────────────────

-- NanosTable existe dans le moteur ; le repli permet d'exécuter le module en
-- Lua nu (tests). Réimplémenter systématiquement un utilitaire du moteur serait
-- une faute, l'ignorer rendrait le module intestable : on prend les deux.
local shallow_copy = (NanosTable and NanosTable.ShallowCopy) or function(source)
	local out = {}
	for key, value in pairs(source) do
		out[key] = value
	end
	return out
end

--- Copie de séquence. `ipairs` s'arrêterait au premier trou : on passe par `#`
--- pour que la copie reste fidèle même si un appelant a bricolé la liste.
---@param list any[]
---@return any[]
local function copy_list(list)
	local out = {}
	for index = 1, #list do
		out[index] = list[index]
	end
	return out
end

--- Normalise une quantité d'entrée.
--- `nil` ⇒ 1 (équivalent du paramètre par défaut TS). On NE peut PAS écrire
--- `quantity or 1` : ça transformerait aussi un 0 explicite en 1.
--- Le `math.floor` est obligatoire — en Lua 5.4 toute division rend un float, et
--- un float traîné dans `quantity` casse les comparaisons d'égalité en aval.
---@param value? number
---@return integer|nil quantity nil = appel invalide (≤ 0 ou non numérique)
local function normalize_quantity(value)
	if (value == nil) then return 1 end
	if (type(value) ~= "number") then return nil end

	local amount = math.floor(value)
	if (amount < 1) then return nil end

	return amount
end

--- Clamp entier ≥ 0, utilisé pour les crédits.
---@param value number
---@return integer
local function clamp_positive_int(value)
	if (type(value) ~= "number") then return 0 end
	return math.max(0, math.floor(value))
end

-- ── Base d'items ────────────────────────────────────────────────────────────
--
-- L'instance ne stocke qu'un `itemId` : le catalogue est la source de vérité.
-- Il est INJECTÉ plutôt que require() en dur, pour trois raisons : Shared/Index
-- peut charger Logic/ avant Catalogs/, les tests doivent pouvoir passer un
-- catalogue factice, et un catalogue absent doit dégrader proprement (nil)
-- au lieu de lever au chargement du package.

local item_database = nil

---@param database table<string, NarvosItemDefinition>|nil
function Inventory.SetItemDatabase(database)
	item_database = database
end

---@return table<string, NarvosItemDefinition>|nil
function Inventory.GetItemDatabase()
	-- Résolution paresseuse : si personne n'a injecté, on tente le catalogue
	-- global une fois qu'il existe. Lire une globale absente rend nil, sans erreur.
	if (item_database == nil and Narvos ~= nil and Narvos.Items ~= nil) then
		item_database = Narvos.Items.ITEM_DB
	end

	return item_database
end

---@param item_id string
---@return NarvosItemDefinition|nil
function Inventory.GetItemDef(item_id)
	local database = Inventory.GetItemDatabase()
	if (database == nil or item_id == nil) then return nil end

	return database[item_id]
end

-- ── Identité des instances ──────────────────────────────────────────────────
--
-- Le TS générait `inst_<Date.now()>_<base36>`. Intransposable : os.time() est en
-- SECONDES (plusieurs items lâchés dans la même seconde ⇒ uid identiques) et une
-- collision d'uid confond deux piles dans FindInstance ⇒ inventaire corrompu.
-- Compteur monotone à la place : unicité garantie par construction.

local uid_counter = 0

---@return string
function Inventory.NextUid()
	uid_counter = uid_counter + 1
	return "inst_" .. uid_counter
end

---@return integer
function Inventory.GetUidCounter()
	return uid_counter
end

--- À rappeler au chargement d'une sauvegarde, sinon les uid repartent de 1 et
--- entrent en collision avec ceux déjà présents dans l'inventaire restauré.
--- Ne recule jamais : un snapshot périmé ne peut pas réintroduire de collisions.
---@param value integer
function Inventory.SetUidCounter(value)
	if (type(value) == "number" and value > uid_counter) then
		uid_counter = math.floor(value)
	end
end

--- Réserve les uid d'un sac RESTAURÉ : avance le compteur au-delà du plus grand
--- `inst_<n>` de la grille et des piles portées. Rend le compteur.
---
--- ⚠ POURQUOI (mesuré en jeu le 2026-09-15). `SetUidCounter` n'était appelé
--- NULLE PART : après chaque redémarrage du serveur, le compteur repartait de 1
--- et un objet reçu prenait l'uid d'une pile relue en base. Un Desert Eagle
--- ajouté au sac affichait la fiche de l'AK-74U, deux cartes s'allumaient au même
--- clic — et ÉQUIPER, JETER ou DÉTRUIRE visaient l'autre objet. Relu, le sac
--- perdait l'un des deux (le décodeur garde la première pile d'un uid).
---@param grid NarvosGridState|nil
---@param equipment table|nil  emplacement -> pile portée
---@return integer
function Inventory.ReserverUids(grid, equipment)
	local plus_grand = 0
	local function Voir(pile)
		if (type(pile) ~= "table" or type(pile.uid) ~= "string") then return end
		local n = tonumber(pile.uid:match("^inst_(%d+)$"))
		if (n and n > plus_grand) then plus_grand = n end
	end
	if (type(grid) == "table" and type(grid.instances) == "table") then
		for _, inst in ipairs(grid.instances) do Voir(inst) end
	end
	if (type(equipment) == "table") then
		for _, pile in pairs(equipment) do Voir(pile) end
	end
	Inventory.SetUidCounter(plus_grand)
	return uid_counter
end

-- ══════════════════════════════════════════════════════════════════════════════
-- PILES
-- ══════════════════════════════════════════════════════════════════════════════

--- Première pile du même item disposant d'au moins une unité de place.
--- Itère une SÉQUENCE : « la première pile partielle » n'a de sens que dans un
--- ordre stable, ce qu'une table indexée par uid (pairs) ne donnerait pas.
---@param def NarvosItemDefinition
---@param instances NarvosItemInstance[]
---@return NarvosItemInstance|nil instance
---@return integer|nil space Place restante dans cette pile
function Inventory.FindStackTarget(def, instances)
	if (not def.stackable) then return nil end

	for _, inst in ipairs(instances) do
		if (inst.itemId == def.id) then
			local space = def.maxStack - inst.quantity
			if (space > 0) then return inst, space end
		end
	end

	return nil
end

--- Nouvelle quantité d'une pile après ajout, plafonnée à max_stack.
--- ATTENTION : le surplus au-delà du plafond est perdu. Utiliser
--- Inventory.AddItemToGrid, qui lui fait déborder sur une nouvelle pile.
---@param instance NarvosItemInstance
---@param amount integer
---@param max_stack integer
---@return integer
function Inventory.AddToStack(instance, amount, max_stack)
	return math.min(instance.quantity + amount, max_stack)
end

--- Quantité restante après retrait, plancher à 0.
--- 0 ⇒ la pile doit être SUPPRIMÉE par l'appelant : la fonction ne connaît pas
--- la grille et laisserait sinon une instance fantôme occupant sa surface.
---@param instance NarvosItemInstance
---@param amount integer
---@return integer
function Inventory.RemoveFromStack(instance, amount)
	return math.max(0, instance.quantity - amount)
end

--- Scinde une pile en deux, la nouvelle moitié à la position demandée.
--- Ne VALIDE PAS cette position : la fonction n'a pas accès à la grille, c'est à
--- l'appelant d'avoir appelé IsAreaFree avant.
---@param source NarvosItemInstance
---@param amount integer
---@param new_grid_x integer
---@param new_grid_y integer
---@return NarvosItemInstance|nil source Source allégée (nil = split refusé)
---@return NarvosItemInstance|nil split
function Inventory.SplitStack(source, amount, new_grid_x, new_grid_y)
	if (amount <= 0 or amount >= source.quantity) then return nil end

	local kept = shallow_copy(source)
	kept.quantity = source.quantity - amount

	local split = {
		itemId = source.itemId,
		quantity = amount,
		gridX = new_grid_x,
		gridY = new_grid_y,
		gridW = source.gridW,
		gridH = source.gridH,
		uid = Inventory.NextUid(),
	}

	return kept, split
end

--- Transfère le maximum possible de `source` vers `dest`.
---
--- ORDRE DE RETOUR (dest, source) volontaire : le TS renvoyait `source: null`
--- DANS un objet pour dire « source vidée ». En Lua un champ à nil disparaît de
--- la table, on ne pourrait plus distinguer « vidée » de « échec ». Ici c'est le
--- PREMIER retour qui porte le succès : dest == nil ⇒ fusion impossible ;
--- dest ~= nil et source == nil ⇒ source entièrement absorbée.
---@param source NarvosItemInstance
---@param dest NarvosItemInstance
---@param max_stack integer
---@return NarvosItemInstance|nil dest
---@return NarvosItemInstance|nil source
function Inventory.MergeStacks(source, dest, max_stack)
	if (source.itemId ~= dest.itemId) then return nil end

	local space = max_stack - dest.quantity
	if (space <= 0) then return nil end

	local moved = math.min(source.quantity, space)

	local new_dest = shallow_copy(dest)
	new_dest.quantity = dest.quantity + moved

	if (source.quantity - moved <= 0) then return new_dest, nil end

	local new_source = shallow_copy(source)
	new_source.quantity = source.quantity - moved

	return new_dest, new_source
end

-- ══════════════════════════════════════════════════════════════════════════════
-- GRILLE
--
-- Pas de matrice d'occupation : l'absence de chevauchement n'est garantie que
-- par la discipline des appelants, qui passent TOUS par IsAreaFree. Écrire
-- directement dans grid.instances contourne l'invariant — voir AssertGridValid.
--
-- Toutes les fonctions renvoient une NOUVELLE grille et n'ont aucun effet de
-- bord. C'est ce qui donne la sémantique « échec ⇒ état inchangé » (retour nil)
-- et permet au store de détecter un changement par comparaison de référence.
-- Muter en place casserait les deux.
-- ══════════════════════════════════════════════════════════════════════════════

---@param cols? integer
---@param rows? integer
---@return NarvosGridState
function Inventory.CreateGridState(cols, rows)
	-- `or` ne se déclenche que sur nil et false : en Lua, 0 est truthy. C'est donc
	-- l'équivalent EXACT du paramètre par défaut TS, qui ne se déclenche que sur
	-- undefined — et non une approximation à corriger.
	return {
		cols = cols or Inventory.DEFAULT_GRID_COLS,
		rows = rows or Inventory.DEFAULT_GRID_ROWS,
		instances = {},
	}
end

--- La zone rectangulaire (x, y, w, h) est-elle libre ET dans les bornes ?
---@param grid NarvosGridState
---@param x integer 0-based
---@param y integer 0-based
---@param w integer
---@param h integer
---@param exclude_uid? string Instance à ignorer (déplacement sur sa propre surface)
---@return boolean
function Inventory.IsAreaFree(grid, x, y, w, h, exclude_uid)
	-- Bornes d'abord : test O(1) qui évite de balayer les instances pour rien.
	if (x < 0 or y < 0 or x + w > grid.cols or y + h > grid.rows) then return false end

	for _, inst in ipairs(grid.instances) do
		-- exclude_uid nil ⇒ la comparaison est toujours vraie ⇒ aucune exclusion.
		if (inst.uid ~= exclude_uid) then
			local inst_w = inst.gridW or 1
			local inst_h = inst.gridH or 1

			-- Recouvrement AABB : test sur toute la SURFACE, pas sur l'origine.
			if (x < inst.gridX + inst_w and x + w > inst.gridX
				and y < inst.gridY + inst_h and y + h > inst.gridY) then
				return false
			end
		end
	end

	return true
end

--- Première position libre, balayage row-major (haut→bas, gauche→droite).
--- Pas de rotation ni de compactage.
--- Le retour (0, 0) est une position VALIDE : en Lua 0 est truthy, donc
--- `if (x ~= nil)` comme `if (x)` fonctionnent — contrairement au réflexe TS.
---@param grid NarvosGridState
---@param w integer
---@param h integer
---@return integer|nil x
---@return integer|nil y
function Inventory.FindFreeSlot(grid, w, h)
	-- Coordonnées 0-based : la boucle démarre bien à 0, ce n'est pas un oubli.
	for y = 0, grid.rows - h do
		for x = 0, grid.cols - w do
			if (Inventory.IsAreaFree(grid, x, y, w, h)) then return x, y end
		end
	end

	return nil
end

--- Retrouve une instance par son uid.
---@param grid NarvosGridState
---@param uid string
---@return NarvosItemInstance|nil instance
---@return integer|nil index Index 1-based dans grid.instances
function Inventory.FindInstance(grid, uid)
	for index, inst in ipairs(grid.instances) do
		if (inst.uid == uid) then return inst, index end
	end

	return nil
end

--- Ajoute `quantity` unités d'un item dans la grille.
--- 1. remplit les piles partielles existantes (si empilable) ;
--- 2. place le reliquat dans de nouvelles piles.
--- Opération ATOMIQUE : si tout ne rentre pas, `grid` n'est pas modifiée et on
--- renvoie nil — l'appelant ne se retrouve jamais avec un ajout à moitié fait.
---
--- DIVERGENCES ASSUMÉES vs gridInventory.ts::addItemToGrid — la sémantique Lua
--- est volontairement plus stricte, le TS perdait des items en silence :
---
---  1. PHASE 1, PILES PARTIELLES. Le TS appelait findStackTarget UNE fois, puis
---     addToStack = min(inst.quantity + quantity, maxStack) sur cette SEULE pile
---     et retournait immédiatement : le surplus au-delà du plafond disparaissait
---     sans erreur ni trace. Ici on boucle sur TOUTES les instances, on remplit
---     chaque pile partielle et le reliquat part en phase 2. Conséquence : à
---     entrée identique les totaux d'items DIVERGENT — le Lua conserve ce que le
---     TS jetait. Ne pas « réaligner » sur le TS sans rendre la perte explicite.
---
---  2. PHASE 2, PLAFOND DES NOUVELLES PILES. Le TS créait UNE instance portant
---     la totalité de `quantity`, jamais plafonnée à maxStack (une pile de 25
---     potions alors que maxStack vaut 10). Ici on crée N piles de `per_pile`
---     unités et on renvoie nil dès qu'un FindFreeSlot échoue. Conséquence : le
---     Lua ÉCHOUE là où le TS réussissait. Grille 1×1 vide + 25 potions
---     (maxStack 10) : TS = 1 instance quantity 25 et true ; Lua = nil,
---     Store.AddItem renvoie false et RIEN n'est ajouté. Tout appelant qui
---     testait `if (Store.AddItem(…))` doit lire ce false comme « ça ne rentre
---     pas », pas comme un bug — Store.AddItem, AddItemById, AddItems,
---     EquipFromGrid et UnequipToGrid laissent l'état strictement intact.
---
---  3. ITEMS NON EMPILABLES. Le TS regroupait `quantity` unités dans une seule
---     instance occupant une seule zone gridW × gridH — une « pile » de 3 épées
---     sur 6 cellules, en contradiction avec son propre stackable = false. Ici
---     per_pile vaut 1 : 3 épées 2×3 donnent 3 instances sur 18 cellules, et nil
---     si les 18 ne rentrent pas. L'UI et la 3D doivent donc supporter N
---     instances là où le TS en produisait une (cf. Store.UnequipToGrid, qui
---     repasse removed.quantity dans cette fonction).
---@param grid NarvosGridState
---@param def NarvosItemDefinition
---@param quantity? integer Défaut 1
---@return NarvosGridState|nil
function Inventory.AddItemToGrid(grid, def, quantity)
	if (def == nil or def.id == nil) then return nil end

	local remaining = normalize_quantity(quantity)
	if (remaining == nil) then return nil end

	local instances = copy_list(grid.instances)

	-- max(1, …) : un catalogue mal formé (maxStack 0 ou absent) ferait boucler
	-- la phase 2 à l'infini.
	local max_stack = def.stackable and math.max(1, def.maxStack or 1) or 1
	local width = def.gridW or 1
	local height = def.gridH or 1

	-- ── 1. Remplissage des piles partielles ──────────────────────────────────
	-- Boucle sur TOUTES les instances (divergence 1 de l'en-tête) : le TS n'en
	-- remplissait qu'une et jetait le surplus. Ici le reliquat va en phase 2.
	if (def.stackable) then
		for index, inst in ipairs(instances) do
			if (remaining > 0 and inst.itemId == def.id) then
				local space = max_stack - inst.quantity
				if (space > 0) then
					local moved = math.min(space, remaining)
					-- Copie avant écriture : l'instance d'origine appartient
					-- encore à `grid`, qui doit rester intacte en cas d'échec.
					local updated = shallow_copy(inst)
					updated.quantity = inst.quantity + moved
					instances[index] = updated
					remaining = remaining - moved
				end
			end
		end
	end

	-- ── 2. Nouvelles piles pour le reliquat ──────────────────────────────────
	-- Grille de travail partageant `instances` : FindFreeSlot doit voir les
	-- piles créées dans cette même opération, sinon elles se superposeraient.
	local working = { cols = grid.cols, rows = grid.rows, instances = instances }

	-- Un item non empilable prend une instance par unité (maxStack vaut 1) :
	-- entasser 5 épées dans une seule case violerait sa propre définition.
	-- Divergence 3 de l'en-tête : le TS en faisait une pile unique.
	local per_pile = def.stackable and max_stack or 1

	-- Chaque pile est plafonnée à `per_pile` (divergence 2 de l'en-tête) et doit
	-- trouver sa propre place : nil ⇒ l'appelant garde la grille d'origine.
	while (remaining > 0) do
		local x, y = Inventory.FindFreeSlot(working, width, height)
		if (x == nil) then return nil end

		local taken = math.min(per_pile, remaining)

		instances[#instances + 1] = {
			itemId = def.id,
			quantity = taken,
			gridX = x,
			gridY = y,
			gridW = width,
			gridH = height,
			uid = Inventory.NextUid(),
		}

		remaining = remaining - taken
	end

	return working
end

--- Retire une instance, ou décrémente sa pile.
--- `quantity` absent ⇒ retrait TOTAL. `quantity` à 0 ⇒ décrément de 0 : le test
--- doit être `~= nil` et surtout pas `if (quantity)`, vrai pour 0 en Lua.
---@param grid NarvosGridState
---@param uid string
---@param quantity? integer
---@return NarvosGridState grid Toujours une grille (inchangée si uid inconnu)
---@return NarvosItemInstance|nil removed
function Inventory.RemoveItemFromGrid(grid, uid, quantity)
	local inst, index = Inventory.FindInstance(grid, uid)
	if (inst == nil) then return grid, nil end

	local instances = copy_list(grid.instances)

	if (quantity ~= nil and quantity < inst.quantity) then
		local updated = shallow_copy(inst)
		updated.quantity = Inventory.RemoveFromStack(inst, quantity)
		instances[index] = updated

		local removed = shallow_copy(inst)
		removed.quantity = quantity

		return { cols = grid.cols, rows = grid.rows, instances = instances }, removed
	end

	table.remove(instances, index)

	return { cols = grid.cols, rows = grid.rows, instances = instances }, inst
end

--- Repositionne une instance. nil = destination occupée ou hors bornes.
--- Ni swap ni fusion au drop (comme le TS) : un lâcher sur une pile identique
--- échoue au lieu de fusionner. MergeStacks existe et reste à brancher.
---@param grid NarvosGridState
---@param uid string
---@param new_x integer
---@param new_y integer
---@return NarvosGridState|nil
function Inventory.MoveItemInGrid(grid, uid, new_x, new_y)
	local inst, index = Inventory.FindInstance(grid, uid)
	if (inst == nil) then return nil end

	local width = inst.gridW or 1
	local height = inst.gridH or 1

	-- IsAreaFree teste déjà les bornes (le TS les retestait derrière : doublon).
	if (not Inventory.IsAreaFree(grid, new_x, new_y, width, height, uid)) then return nil end

	local instances = copy_list(grid.instances)

	local updated = shallow_copy(inst)
	updated.gridX = new_x
	updated.gridY = new_y
	instances[index] = updated

	return { cols = grid.cols, rows = grid.rows, instances = instances }
end

--- Quantité totale d'un item DANS LA GRILLE. Les pièces équipées ne comptent pas.
---@param grid NarvosGridState
---@param item_id string
---@return integer
function Inventory.CountItem(grid, item_id)
	local total = 0

	for _, inst in ipairs(grid.instances) do
		if (inst.itemId == item_id) then
			total = total + inst.quantity
		end
	end

	return total
end

--- Nombre de PILES posées.
--- Attention : ce n'est pas comparable à MaxSlots, qui compte des CELLULES.
--- Pour « l'inventaire est-il plein ? », utiliser FindFreeSlot ou UsedCells.
---@param grid NarvosGridState
---@return integer
function Inventory.UsedSlots(grid)
	return #grid.instances
end

--- Nombre total de CELLULES de la grille.
---@param grid NarvosGridState
---@return integer
function Inventory.MaxSlots(grid)
	return grid.cols * grid.rows
end

--- Cellules réellement occupées — la mesure comparable à MaxSlots.
---@param grid NarvosGridState
---@return integer
function Inventory.UsedCells(grid)
	local total = 0

	for _, inst in ipairs(grid.instances) do
		total = total + (inst.gridW or 1) * (inst.gridH or 1)
	end

	return total
end

--- Garde-fou de debug : sans tsc, plus rien ne vérifie statiquement que les
--- appelants passent par IsAreaFree. À appeler après un chargement de sauvegarde.
---@param grid NarvosGridState
---@return boolean valid
---@return string|nil reason
function Inventory.AssertGridValid(grid)
	-- Cette fonction existe pour DIAGNOSTIQUER des données qu'on n'a pas produites
	-- — typiquement après un chargement de sauvegarde, seul endroit où la grille
	-- peut être corrompue. Elle doit donc rapporter, jamais lever : sinon le
	-- garde-fou transforme en crash exactement la corruption qu'il devait nommer.
	--
	-- Deux pièges Lua sans équivalent JS, tous deux sur des champs manquants :
	-- `seen_uids[nil] = true` est une écriture ILLÉGALE (« table index is nil »),
	-- là où `Set.add(undefined)` passe ; et `nil < 0` lève, là où JS compare.
	-- D'où la validation de type AVANT toute indexation ou comparaison.
	if (type(grid) ~= "table" or type(grid.instances) ~= "table") then
		return false, "grille malformée : instances absentes"
	end

	local seen_uids = {}

	for index, inst in ipairs(grid.instances) do
		if (type(inst) ~= "table") then
			return false, "instance non-table à l'index " .. index
		end
		if (type(inst.uid) ~= "string") then
			return false, "uid absent ou non-chaîne à l'index " .. index
		end
		if (type(inst.gridX) ~= "number" or type(inst.gridY) ~= "number") then
			return false, "coordonnées absentes ou non numériques à l'index " .. index
		end

		if (seen_uids[inst.uid]) then
			return false, "uid dupliqué : " .. tostring(inst.uid)
		end
		seen_uids[inst.uid] = true

		local width = inst.gridW or 1
		local height = inst.gridH or 1

		if (inst.gridX < 0 or inst.gridY < 0
			or inst.gridX + width > grid.cols
			or inst.gridY + height > grid.rows) then
			return false, "instance hors bornes à l'index " .. index
		end

		-- Chevauchement : on s'exclut soi-même du test.
		if (not Inventory.IsAreaFree(grid, inst.gridX, inst.gridY, width, height, inst.uid)) then
			return false, "chevauchement à l'index " .. index
		end
	end

	return true
end

-- ══════════════════════════════════════════════════════════════════════════════
-- ÉQUIPEMENT
-- ══════════════════════════════════════════════════════════════════════════════

--- Équipement vide.
--- Un slot libre est nil, donc ABSENT de la table : `CreateEmptyEquipment()`
--- renvoie littéralement `{}`. C'est la raison pour laquelle tout le module
--- itère Inventory.EQUIP_SLOTS et jamais `pairs(equipment)`.
---@return NarvosEquipmentState
function Inventory.CreateEmptyEquipment()
	return {}
end

--- Équipe une instance dans le slot dicté par sa DÉFINITION.
--- Le slot n'est pas au choix du joueur (pas d'arme en main gauche, pas de
--- second accessoire) : c'est le comportement du runtime TS, conservé tel quel.
--- Item inconnu du catalogue ou non équipable ⇒ état rendu inchangé, MÊME
--- référence, displaced nil : l'appelant doit tester `displaced` ET le succès
--- en amont (le store vérifie def.equipSlot avant d'appeler).
---@param equipment NarvosEquipmentState
---@param instance NarvosItemInstance
---@return NarvosEquipmentState equipment
---@return NarvosItemInstance|nil displaced Item délogé du slot
function Inventory.EquipItem(equipment, instance)
	local def = Inventory.GetItemDef(instance.itemId)
	if (def == nil or def.equipSlot == nil) then return equipment, nil end

	local slot = def.equipSlot
	local displaced = equipment[slot]

	local next_equipment = shallow_copy(equipment)
	next_equipment[slot] = instance

	return next_equipment, displaced
end

--- Vide un slot.
--- Sur un slot déjà vide, renvoie la MÊME référence (aucune copie) : c'est ce
--- qui permet au store de déséquiper sans risque quand la grille est pleine —
--- l'état n'est jamais muté avant d'être validé. Ne pas « optimiser » en
--- mutation en place.
---@param equipment NarvosEquipmentState
---@param slot NarvosEquipSlot
---@return NarvosEquipmentState equipment
---@return NarvosItemInstance|nil removed
function Inventory.UnequipSlot(equipment, slot)
	local removed = equipment[slot]
	if (removed == nil) then return equipment, nil end

	local next_equipment = shallow_copy(equipment)
	next_equipment[slot] = nil

	return next_equipment, removed
end

--- L'item est-il équipable, et compatible avec `target_slot` s'il est fourni ?
---@param def NarvosItemDefinition
---@param target_slot? NarvosEquipSlot
---@return boolean
function Inventory.CanEquip(def, target_slot)
	if (def == nil or def.equipSlot == nil) then return false end
	if (target_slot ~= nil and def.equipSlot ~= target_slot) then return false end

	return true
end

--- Équipe depuis la grille, sur un état `{ grid, equipment }` PASSÉ en argument.
--- C'est la logique du Store, rendue pure pour le SERVEUR, qui tient un sac par
--- joueur (le Store est un singleton par VM : il ne peut servir qu'un joueur).
--- Rend (nouvel_etat, nil) ou (nil, raison) ; l'état d'entrée n'est jamais muté.
---@param etat table { grid, equipment }
---@param uid string
---@return table|nil
---@return string|nil
function Inventory.EquiperDepuisGrille(etat, uid)
	if (type(etat) ~= "table" or type(etat.grid) ~= "table") then return nil, "Sac absent" end
	local equipment = (type(etat.equipment) == "table") and etat.equipment or {}

	local inst = Inventory.FindInstance(etat.grid, uid)
	if (inst == nil) then return nil, "Objet introuvable dans le sac" end

	local def = Inventory.GetItemDef(inst.itemId)
	if (def == nil or def.equipSlot == nil) then return nil, "Objet non équipable" end

	local grid, removed = Inventory.RemoveItemFromGrid(etat.grid, uid)
	if (removed == nil) then return nil, "Objet introuvable dans le sac" end

	local next_equipment, displaced = Inventory.EquipItem(equipment, removed)
	if (displaced ~= nil) then
		local displaced_def = Inventory.GetItemDef(displaced.itemId)
		if (displaced_def == nil) then return nil, "Objet porté inconnu du catalogue" end
		local next_grid = Inventory.AddItemToGrid(grid, displaced_def, displaced.quantity)
		if (next_grid == nil) then return nil, "Sac plein : l'objet porté ne peut pas y revenir" end
		grid = next_grid
	end

	return { grid = grid, equipment = next_equipment }, nil
end

--- Déséquipe un slot vers la grille, sur un état `{ grid, equipment }` passé en
--- argument. Même contrat que `EquiperDepuisGrille`.
---@param etat table { grid, equipment }
---@param slot string
---@return table|nil
---@return string|nil
function Inventory.DesequiperVersGrille(etat, slot)
	if (type(etat) ~= "table" or type(etat.grid) ~= "table") then return nil, "Sac absent" end
	local equipment = (type(etat.equipment) == "table") and etat.equipment or {}

	local next_equipment, removed = Inventory.UnequipSlot(equipment, slot)
	if (removed == nil) then return nil, "Emplacement vide" end

	local def = Inventory.GetItemDef(removed.itemId)
	if (def == nil) then return nil, "Objet porté inconnu du catalogue" end

	local next_grid = Inventory.AddItemToGrid(etat.grid, def, removed.quantity)
	if (next_grid == nil) then return nil, "Sac plein" end

	return { grid = next_grid, equipment = next_equipment }, nil
end

--- Somme des stats des DÉFINITIONS portées sur les 6 slots.
--- Aucune notion d'usure, d'enchantement ni de roll par instance ; les bonus de
--- set (setId) ne sont pas appliqués — le TS ne les consommait pas non plus.
--- `pairs` sur def.stats est acceptable ici : une addition est commutative.
---@param equipment NarvosEquipmentState
---@return NarvosItemStats
function Inventory.GetEquippedStats(equipment)
	local total = {}

	for _, slot in ipairs(Inventory.EQUIP_SLOTS) do
		local inst = equipment[slot]
		if (inst ~= nil) then
			local def = Inventory.GetItemDef(inst.itemId)
			if (def ~= nil and def.stats ~= nil) then
				for key, value in pairs(def.stats) do
					if (type(value) == "number") then
						total[key] = (total[key] or 0) + value
					end
				end
			end
		end
	end

	return total
end

-- ══════════════════════════════════════════════════════════════════════════════
-- STORE
--
-- Singleton par VM. Chaque mutation REMPLACE l'état par une nouvelle table puis
-- notifie : `Get()` rend donc une référence stable tant que rien n'a bougé, ce
-- qui permet à l'UI de comparer par référence (ou via `revision`) plutôt que de
-- diffuser à chaque frame. Ne jamais reconstruire l'état à la lecture.
--
-- Aucune persistance : c'est à l'appelant (Server/) de sérialiser Get() et de
-- restaurer via SetUidCounter + ReplaceState.
-- ══════════════════════════════════════════════════════════════════════════════

---@type NarvosInventoryState
local state

-- Séquence, pas un ensemble : l'ordre de notification doit être déterministe et
-- identique serveur/client. `pairs` sur un ensemble ne le garantirait pas.
local listeners = {}

---@return NarvosInventoryState
local function make_initial_state()
	return {
		grid = Inventory.CreateGridState(),
		equipment = Inventory.CreateEmptyEquipment(),
		credits = Inventory.DEFAULT_CREDITS,
		revision = 0,
	}
end

state = make_initial_state()

---@param next_state NarvosInventoryState
local function commit(next_state)
	next_state.revision = state.revision + 1
	state = next_state

	-- Copie avant parcours : un listener a le droit de se désabonner depuis son
	-- propre callback sans corrompre l'itération en cours.
	local snapshot = copy_list(listeners)
	for _, listener in ipairs(snapshot) do
		listener(state)
	end
end

--- Copie de l'état avec un champ remplacé, prête à être commit.
---@param key string
---@param value any
---@return NarvosInventoryState
local function state_with(key, value)
	local next_state = shallow_copy(state)
	next_state[key] = value
	return next_state
end

Inventory.Store = {}

---@return NarvosInventoryState
function Inventory.Store.Get()
	return state
end

--- Réinitialise grille, équipement et crédits.
function Inventory.Store.Reset()
	commit(make_initial_state())
end

--- Restaure un état complet (chargement de sauvegarde).
--- Penser à Inventory.SetUidCounter avant, sinon les nouveaux uid entreront en
--- collision avec ceux des instances restaurées.
---@param next_state NarvosInventoryState
---@return boolean
function Inventory.Store.ReplaceState(next_state)
	if (type(next_state) ~= "table" or next_state.grid == nil) then return false end

	commit({
		grid = next_state.grid,
		equipment = next_state.equipment or Inventory.CreateEmptyEquipment(),
		credits = clamp_positive_int(next_state.credits or Inventory.DEFAULT_CREDITS),
		revision = state.revision,
	})

	return true
end

--- false ⇒ RIEN n'a été ajouté, état strictement intact : la grille ne peut pas
--- accueillir la TOTALITÉ de `quantity`. Plus strict que le TS, qui réussissait
--- toujours en dépassant le plafond de pile ou en perdant le surplus (cf. les
--- divergences documentées sur Inventory.AddItemToGrid). Un appelant porté du TS
--- qui ignorait ce retour doit maintenant gérer l'inventaire plein.
---@param def NarvosItemDefinition
---@param quantity? integer
---@return boolean
function Inventory.Store.AddItem(def, quantity)
	local next_grid = Inventory.AddItemToGrid(state.grid, def, quantity)
	if (next_grid == nil) then return false end

	commit(state_with("grid", next_grid))
	return true
end

---@param item_id string
---@param quantity? integer
---@return boolean
function Inventory.Store.AddItemById(item_id, quantity)
	local def = Inventory.GetItemDef(item_id)
	if (def == nil) then return false end

	return Inventory.Store.AddItem(def, quantity)
end

--- Ajout par lot, ATOMIQUE et en une seule notification : le premier item qui
--- ne rentre pas annule tout le lot (accumulation sur une grille locale).
---@param items { itemId: string, quantity?: integer }[]
---@return boolean
function Inventory.Store.AddItems(items)
	local grid = state.grid

	for _, entry in ipairs(items) do
		local def = Inventory.GetItemDef(entry.itemId)
		if (def == nil) then return false end

		local next_grid = Inventory.AddItemToGrid(grid, def, entry.quantity)
		if (next_grid == nil) then return false end

		grid = next_grid
	end

	commit(state_with("grid", grid))
	return true
end

---@param uid string
---@param quantity? integer Absent = retrait total
---@return NarvosItemInstance|nil removed
function Inventory.Store.RemoveItem(uid, quantity)
	local grid, removed = Inventory.RemoveItemFromGrid(state.grid, uid, quantity)
	if (removed == nil) then return nil end

	commit(state_with("grid", grid))
	return removed
end

---@param uid string
---@param new_x integer
---@param new_y integer
---@return boolean
function Inventory.Store.MoveItem(uid, new_x, new_y)
	local next_grid = Inventory.MoveItemInGrid(state.grid, uid, new_x, new_y)
	if (next_grid == nil) then return false end

	commit(state_with("grid", next_grid))
	return true
end

--- Équipe un item pris dans la grille ; l'éventuel item délogé y retourne.
--- Tout est calculé avant le commit : chaque `return false` laisse donc l'état
--- strictement intact, y compris quand l'item délogé ne peut pas revenir en
--- grille (le TS ignorait cet échec et l'instance disparaissait de la partie).
---@param uid string
---@return boolean
function Inventory.Store.EquipFromGrid(uid)
	-- Une seule logique : celle, pure, que le serveur emploie par joueur.
	local suivant = Inventory.EquiperDepuisGrille(state, uid)
	if (suivant == nil) then return false end

	local next_state = shallow_copy(state)
	next_state.grid = suivant.grid
	next_state.equipment = suivant.equipment
	commit(next_state)

	return true
end

--- Déséquipe un slot vers la grille.
--- L'item repasse par AddItemToGrid : il reçoit donc un NOUVEL uid. Tout
--- drag & drop en cours sur l'ancien uid doit être annulé côté UI.
--- Un équipable est non empilable : si `removed.quantity` > 1, AddItemToGrid en
--- fait autant d'instances distinctes (divergence 3 de sa doc) et renvoie nil si
--- elles ne rentrent pas toutes — d'où false ici, slot laissé équipé.
---@param slot NarvosEquipSlot
---@return boolean
function Inventory.Store.UnequipToGrid(slot)
	local suivant = Inventory.DesequiperVersGrille(state, slot)
	if (suivant == nil) then return false end

	local next_state = shallow_copy(state)
	next_state.grid = suivant.grid
	next_state.equipment = suivant.equipment
	commit(next_state)

	return true
end

--- Crédite ou débite (montant négatif). Solde plancher à 0.
---@param amount integer
function Inventory.Store.AddCredits(amount)
	commit(state_with("credits", clamp_positive_int(state.credits + amount)))
end

---@param amount integer
function Inventory.Store.SetCredits(amount)
	commit(state_with("credits", clamp_positive_int(amount)))
end

---@return NarvosItemStats
function Inventory.Store.GetEquippedStats()
	return Inventory.GetEquippedStats(state.equipment)
end

--- Abonnement aux mutations. Le listener reçoit le nouvel état.
---@param listener fun(state: NarvosInventoryState)
---@return fun() unsubscribe
function Inventory.Store.Subscribe(listener)
	listeners[#listeners + 1] = listener

	return function()
		for index, entry in ipairs(listeners) do
			if (entry == listener) then
				table.remove(listeners, index)
				return
			end
		end
	end
end

return Inventory
