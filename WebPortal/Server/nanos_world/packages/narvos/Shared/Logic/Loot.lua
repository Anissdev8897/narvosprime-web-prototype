-- ═══════════════════════════════════════════════════════════════════════════════
-- Shared/Logic/Loot.lua — portage de loot/LootRegistry.ts (rollLoot) et de
-- loot/proceduralLoot.ts (génération procédurale) du runtime web.
--
-- Câblage attendu depuis Shared/Index.lua :
--     Narvos.LootLogic = Package.Require("Logic/Loot.lua")
--
-- Trois règles gouvernent tout le fichier :
--
--  1. L'ORDRE de consommation du RNG est l'invariant. Une itération de RollLoot
--     consomme 2 tirages au minimum, 8 au maximum. Réorganiser un calcul (par
--     exemple nommer l'item avant d'en tirer le type) ne change pas le résultat
--     « en moyenne » : ça décale toute la séquence et fait diverger le portage du
--     runtime TS ainsi que tout test à RNG scripté.
--
--  2. Le tirage est une décision d'état de jeu : il appartient au SERVEUR, qui
--     réplique le résultat. Chaque VM Lua exécute son propre math.randomseed :
--     rejouer le tirage côté client donnerait un autre butin.
--
--  3. Les items rendus par la branche catalogue sont des RÉFÉRENCES vers
--     LOOT_CATALOG, partagées par tous les drops. Muter un item reçu (quantité,
--     durabilité, enchantement) corrompt le catalogue global pour la session
--     entière. Seuls les items procéduraux sont des tables neuves.
-- ═══════════════════════════════════════════════════════════════════════════════

---@alias ProceduralRarity "common"|"rare"|"epic"|"legendary"|"mythic"
---@alias ItemKind "weapon"|"armor"|"tech_component"|"space_artifact"

---@class NarvosLoot
local Loot = {}

-- Shared/Index.lua a déjà résolu le catalogue dans le cas nominal : on réutilise
-- cette table au lieu de relancer un chargement. `require` nu et Package.Require
-- n'ont pas la même clé de cache — deux chargements donneraient deux tables
-- distinctes, et un correctif appliqué à l'une laisserait l'autre périmée.
-- Effet de bord utile : un harnais de test peut poser Narvos.Loot avant de
-- charger ce fichier pour injecter un catalogue réduit, sans dépendre de Package.
local Catalog = (Narvos and Narvos.Loot) or Package.Require("Catalogs/Loot.lua")

local LOOT_CATALOG = Catalog.LOOT_CATALOG

-- Ré-export par commodité (LootRegistry.ts l'exporte aussi). 7 raretés, à ne pas
-- confondre avec RARITY_COLORS plus bas : voir le commentaire de cette table.
Loot.RARITY_COLOR = Catalog.RARITY_COLOR

-- Object.values(LOOT_CATALOG) s'appuie sur l'ordre d'insertion, garanti par JS.
-- `pairs` n'a aucun ordre et en change d'une VM à l'autre : sans liste figée, le
-- bonus de rareté ne serait ni reproductible ni testable, et deux VM ne tireraient
-- pas le même index pour la même valeur de RNG.
-- Le générateur de catalogues émet désormais LOOT_CATALOG_ORDER, qui fige
-- l'ordre d'insertion du TS. On le préfère au tri alphabétique : à séquence de
-- RNG identique, TS et Lua tirent alors le MÊME item de bonus. Le tri reste en
-- repli pour un catalogue produit par une version antérieure du générateur.
local CATALOG_IDS = {}
if type(Catalog.LOOT_CATALOG_ORDER) == "table" then
	for _, id in ipairs(Catalog.LOOT_CATALOG_ORDER) do
		if LOOT_CATALOG[id] ~= nil then
			CATALOG_IDS[#CATALOG_IDS + 1] = id
		end
	end
else
	for id in pairs(LOOT_CATALOG) do
		CATALOG_IDS[#CATALOG_IDS + 1] = id
	end
	table.sort(CATALOG_IDS)
end
Loot.CATALOG_IDS = CATALOG_IDS

-- Le catalogue est constant : le filtre epic/legendary est calculé une fois au
-- chargement. Le TS le reconstruisait à CHAQUE bonus, en reparcourant tout le
-- catalogue, armes comprises.
local BONUS_POOL = {}
for _, id in ipairs(CATALOG_IDS) do
	local item = LOOT_CATALOG[id]
	if (item.rarity == "epic" or item.rarity == "legendary") then
		BONUS_POOL[#BONUS_POOL + 1] = item
	end
end

-- ── Utilitaires numériques ─────────────────────────────────────────────────────

-- Math.round arrondit au demi SUPÉRIEUR, vers +∞ (0.5 → 1, -2.5 → -2). Lua n'a
-- pas math.round, et string.format("%.0f") ferait de l'arrondi bancaire
-- (2.5 → 2) : une stat sur deux divergerait du runtime web.
local function round_half_up(x)
	return math.floor(x + 0.5)
end

-- +1 partout : l'indexation JS est 0-based, les tables Lua sont 1-based. C'est le
-- décalage le plus facile à perdre au portage (3 sites dans la chaîne de butin).
---@param arr table Séquence dense 1-based
---@param rng fun(): number
local function pick_from(arr, rng)
	return arr[math.floor(rng() * #arr) + 1]
end

-- ── Constantes du générateur procédural ────────────────────────────────────────

-- Divergence VOLONTAIRE avec Loot.RARITY_COLOR (7 raretés, catalogue) : le
-- générateur procédural a sa propre palette de 5 couleurs dans proceduralLoot.ts,
-- différente pour les mêmes noms de rareté. Ne pas fusionner les deux tables.
Loot.RARITY_COLORS = {
	common    = "#c0c0c0", -- gris
	rare      = "#4ade80", -- vert
	epic      = "#5b9bff", -- bleu
	legendary = "#c084fc", -- violet
	mythic    = "#ff8a4c", -- orange
}

-- Distribution CUMULÉE (pas des probabilités individuelles) : common 65 %,
-- rare 20 %, epic 10 %, legendary 4 %, mythic 1 %. Doit rester triée croissante,
-- et les seuils rester flottants : jamais de comparaison d'égalité dessus.
Loot.RARITY_THRESHOLDS = {
	{ "common",    0.65 },
	{ "rare",      0.85 },
	{ "epic",      0.95 },
	{ "legendary", 0.99 },
	{ "mythic",    1.0  },
}

local RARITY_MULT = {
	common    = 1,
	rare      = 1.5,
	epic      = 2.2,
	legendary = 3.2,
	mythic    = 4.5,
}

local KINDS = { "weapon", "armor", "tech_component", "space_artifact" }

local ADJECTIVES = { "Sombre", "Pulsant", "Brisé", "Ancien", "Spectral" }

local BASE_NAMES = {
	weapon         = { "Sabre", "Pistolet", "Lame", "Foudre" },
	armor          = { "Armure", "Plastron", "Bouclier" },
	tech_component = { "Module", "Circuit", "Coeur" },
	space_artifact = { "Relique", "Fragment", "Sceau" },
}

local RARITY_TITLE = {
	common    = "Commun",
	rare      = "Rare",
	epic      = "Épique",
	legendary = "Légendaire",
	mythic    = "Mythique",
}

-- Remonté en constante de module : le TS réallouait cette table à chaque drop.
local ICON_BY_KIND = {
	weapon         = "⚔️",
	armor          = "🛡️",
	tech_component = "🔩",
	space_artifact = "🌀",
}

-- Date.now() est en millisecondes ; os.time() est en SECONDES, et un RollLoot avec
-- count > 1 génère plusieurs items dans la même seconde — les ids seraient
-- confondus. Compteur monotone amorcé sur l'horodatage de démarrage : unique dans
-- la VM, croissant, et de même magnitude qu'un timestamp ms.
local id_stamp = os.time() * 1000

local function next_id_stamp()
	id_stamp = id_stamp + 1
	return id_stamp
end

-- ── API procédurale ────────────────────────────────────────────────────────────

--- Sélectionne une rareté procédurale. Consomme EXACTEMENT 1 tirage.
---@param rng fun(): number Tirage dans [0, 1[
---@return ProceduralRarity
function Loot.PickRarity(rng)
	local r = rng()

	for _, entry in ipairs(Loot.RARITY_THRESHOLDS) do
		-- `<` strict : r valant exactement 0.65 donne "rare", pas "common".
		if (r < entry[2]) then return entry[1] end
	end

	-- Inatteignable avec math.random ([0, 1[), mais un RNG de test peut rendre 1.0.
	return "mythic"
end

--- Génère un item procédural. Fonction pure hors compteur d'id.
--- Consomme EXACTEMENT 5 tirages, dans cet ordre : rareté, kind, adjectif,
--- nom de base, suffixe d'id. Cet ordre est le contrat testé.
---@param level number Niveau de l'ennemi, pilote les stats
---@param rng fun(): number
---@return table item
function Loot.GenerateItem(level, rng)
	-- Un niveau non entier produisait un item incohérent avec lui-même : le nom
	-- planchait le niveau ("Lvl 12") mais le champ `level` gardait 12.5. On
	-- normalise UNE fois, ici, et tout ce qui suit lit `level`.
	level = math.floor(level or 1)

	-- 1) Rareté
	local rarity = Loot.PickRarity(rng)

	-- 2) Type d'item. Le 4 est codé en dur comme en TS (et non #KINDS) : si un 5e
	--    kind apparaît, les DEUX fichiers doivent bouger ensemble, sinon les
	--    distributions divergent en silence.
	local kind = KINDS[math.floor(rng() * 4) + 1]

	-- 3-4) Stats : une seule valeur de base, répartie selon le kind.
	local rarity_mult = RARITY_MULT[rarity]
	local s = round_half_up((5 + level * 0.4) * rarity_mult)

	local stats = {}
	if (kind == "weapon") then
		stats.puissance = s
		stats.critique = s
	elseif (kind == "armor") then
		stats.defense = s
		-- Pénalité de vitesse exprimée en POSITIF (c'est une réduction), plancher à 1.
		stats.vitesse = math.max(1, round_half_up(s * 0.3))
	elseif (kind == "tech_component") then
		stats.critique = s
		stats.vitesse = s
	elseif (kind == "space_artifact") then
		stats.puissance = s
		stats.defense = s
	end

	-- 5) Nom. `level` est un entier côté gameplay, mais toute division Lua 5.4
	--    rend un float : string.format("%d", 12.5) lèverait. On plancher pour ne
	--    jamais casser la génération sur une donnée sale.
	local adjective = pick_from(ADJECTIVES, rng)
	local base_name = pick_from(BASE_NAMES[kind], rng)
	local name = string.format("%s %s %s de Lvl %d",
		adjective, base_name, RARITY_TITLE[rarity], level)

	-- 6) Id
	local suffix = math.floor(rng() * 10000)
	local id = string.format("gen_%s_%s_%d_%d", rarity, kind, next_id_stamp(), suffix)

	return {
		id = id,
		name = name,
		kind = kind,
		rarity = rarity,
		level = level,
		color = Loot.RARITY_COLORS[rarity],
		stats = stats,
		value = round_half_up((10 + level * 5) * rarity_mult),
	}
end

--- Adapte un item procédural au format des entrées de LOOT_CATALOG.
---@param proc table Retour de Loot.GenerateItem
---@return table loot_item
function Loot.ProceduralToLootItem(proc)
	-- Copie superficielle des stats : l'item rendu doit être détachable du
	-- générateur, c'est le seul drop que l'appelant peut muter sans dégât.
	local stat_bonus = {}
	for key, value in pairs(proc.stats) do
		stat_bonus[key] = value
	end

	return {
		id = proc.id,
		label = proc.name,
		rarity = proc.rarity, -- ProceduralRarity ⊂ Rarity : jamais alien ni divine
		value = proc.value,
		statBonus = stat_bonus,
		icon = ICON_BY_KIND[proc.kind] or "✨",
		category = "resource",
		color = proc.color,
		kind = proc.kind,
	}
end

-- ── Pools de zone ──────────────────────────────────────────────────────────────

-- Trois zones seulement. Toute autre zone retombe sur forge, y compris
-- "donjon_furiste" réellement utilisée en production côté web : ce n'est pas un
-- bug à corriger ici sans décision produit.
-- Les totaux ne sont PAS normalisés (spore 100, space 100, forge 110) : RollLoot
-- recalcule le poids total, il ne faut surtout pas « arrondir » ces valeurs.
local ZONE_POOLS = {
	spore = {
		{ id = "fragment_vie",    weight = 40 },
		{ id = "cristal_energie", weight = 35 },
		{ id = "adn_alien",       weight = 15 },
		{ id = "powertox",        weight = 8  },
		{ id = "voidcore",        weight = 2  },
	},
	space = {
		{ id = "cristal_energie", weight = 35 },
		{ id = "metal_rare",      weight = 25 },
		{ id = "noyau_plasma",    weight = 15 },
		{ id = "nano_composant",  weight = 12 },
		{ id = "powernax",        weight = 8  },
		{ id = "voidcore",        weight = 3  },
		{ id = "cryon_x",         weight = 2  },
	},
	forge = {
		{ id = "fragment_vie",  weight = 22 },
		{ id = "metal_rare",    weight = 18 },
		{ id = "combat_boots",  weight = 14 },
		{ id = "combat_helmet", weight = 12 },
		{ id = "combat_gloves", weight = 11 },
		{ id = "power_ring",    weight = 9  },
		{ id = "plasma_blade",  weight = 8  },
		{ id = "cyber_armor",   weight = 6  },
		{ id = "void_amulet",   weight = 4  },
		{ id = "powernax",      weight = 3  },
		{ id = "cryon_x",       weight = 3  },
	},
}
Loot.ZONE_POOLS = ZONE_POOLS

local DEFAULT_POOL = ZONE_POOLS.forge

-- ── Point d'entrée du butin ────────────────────────────────────────────────────

--- Tire le butin d'un ennemi.
---
--- Le tableau rendu ne contient PAS forcément `count` éléments : zéro si l'id tiré
--- manque au catalogue, jusqu'à 2 × count avec les bonus de rareté. Les appelants
--- qui lisent [1] doivent gérer le nil.
---
---@param zone_id string Zone inconnue → pool forge
---@param enemy_level number
---@param count? number Défaut 1. Un 0 explicite rend un tableau vide.
---@param rng? fun(): number Défaut math.random. Injectable pour les tests.
---@return table[] items
function Loot.RollLoot(zone_id, enemy_level, count, rng)
	-- `count or 1` transformerait un RollLoot(z, l, 0) légitime en une itération :
	-- le défaut JS ne s'applique qu'à undefined, pas à 0.
	if (count == nil) then count = 1 end
	rng = rng or math.random

	local pool = ZONE_POOLS[zone_id] or DEFAULT_POOL

	local total_weight = 0
	for _, entry in ipairs(pool) do
		total_weight = total_weight + entry.weight
	end

	-- 0 sous le niveau 5, puis un palier par tranche de 5, plafonné à 3 (15 %).
	-- math.floor obligatoire : `/` rend toujours un float en Lua 5.4.
	local rarity_bonus = math.min(3, math.floor(enemy_level / 5))

	local items = {}

	-- `i < count` en JS produit ceil(count) iterations pour un count fractionnaire ;
	-- `for _ = 1, count` en tronque une. math.ceil retablit l equivalence exacte.
	for _ = 1, math.ceil(count) do
		if (rng() < 0.5) then
			-- Branche procédurale : 5 tirages de plus, consommés par GenerateItem.
			items[#items + 1] = Loot.ProceduralToLootItem(Loot.GenerateItem(enemy_level, rng))
		else
			-- Roulette pondérée : on soustrait les poids jusqu'à passer sous zéro.
			local roll = rng() * total_weight
			for _, entry in ipairs(pool) do
				roll = roll - entry.weight
				if (roll <= 0) then
					-- Un id de pool absent du catalogue ne pousse RIEN et l'itération
					-- se termine quand même : c'est ce qui rend le tableau plus court.
					local item = LOOT_CATALOG[entry.id]
					if (item) then items[#items + 1] = item end
					break
				end
			end
		end

		-- `and` paresseux, comme le `&&` du TS : sous le niveau 5 aucun tirage n'est
		-- consommé ici. Dérouler cette condition en `if` imbriqué avec un rng()
		-- systématique décalerait toute la séquence.
		-- Le bonus est un item EN PLUS, pas un remplacement.
		if (rarity_bonus > 0 and rng() < rarity_bonus * 0.05) then
			local bonus = BONUS_POOL[math.floor(rng() * #BONUS_POOL) + 1]
			if (bonus) then items[#items + 1] = bonus end
		end
	end

	return items
end

-- ── Filet de sécurité ──────────────────────────────────────────────────────────

--- Vérifie que chaque id de pool existe dans le catalogue.
---@return string[] missing Références "zone/id" introuvables
function Loot.Validate()
	local missing = {}

	-- Tri des zones : le rapport doit être identique d'une VM à l'autre, `pairs`
	-- ne le garantit pas. Lister les zones en dur ici les désynchroniserait de
	-- ZONE_POOLS au premier ajout.
	local zone_ids = {}
	for zone_id in pairs(ZONE_POOLS) do
		zone_ids[#zone_ids + 1] = zone_id
	end
	table.sort(zone_ids)

	for _, zone_id in ipairs(zone_ids) do
		for _, entry in ipairs(ZONE_POOLS[zone_id]) do
			if (not LOOT_CATALOG[entry.id]) then
				missing[#missing + 1] = zone_id .. "/" .. entry.id
			end
		end
	end

	return missing
end

-- Sans tsc, une faute de frappe sur un id de pool ne casse plus rien : elle se
-- traduit par un drop silencieusement perdu, que le `if (item)` avale. On la
-- signale au chargement plutôt que de la laisser passer en production.
if (Console) then
	local log = Console.Warn or Console.Log
	for _, reference in ipairs(Loot.Validate()) do
		log("[Narvos.Loot] id de pool absent du catalogue : %s", reference)
	end
end

-- ═══════════════════════════════════════════════════════════════════════════════
-- RELIER LE CATALOGUE AU SAC (2026-09-19)
--
-- Le sac ne connaît QUE `Items.ITEM_DB` (`Inventory.GetItemDef`). Or
-- `LOOT_CATALOG` décrit 101 définitions dont la plupart n'existaient pas dans
-- ITEM_DB : un coffre les versait, le sac stockait l'`itemId`, et la vue
-- d'inventaire les SAUTAIT (définition absente) — un drop fantôme, sans erreur
-- ni journal. `Adapter` convertit une définition du catalogue (champs web :
-- `statBonus`, `slot`, `kind`) vers ce que l'inventaire lit (`stats`,
-- `equipSlot`, `type`, `stackable`…) ; `Integrer` verse les absentes, sans
-- jamais écraser un item déjà présent ; `EnregistrerDef` fait de même pour UN
-- drop procédural (`gen_*`, id aléatoire par conception), au moment où il est
-- tiré — l'exécutant persiste ensuite la définition (Server/Index.lua,
-- `loot_gen_defs`).
-- ═══════════════════════════════════════════════════════════════════════════════

---@param entree table  définition LOOT_CATALOG (ou drop procédural adapté)
---@return table  copie compatible ITEM_DB — jamais la table d'origine.
function Loot.Adapter(entree)
	local def = {}
	for k, v in pairs(entree or {}) do def[k] = v end

	if (type(def.label) ~= "string" or def.label == "") then def.label = def.id end
	if (type(def.rarity) ~= "string") then def.rarity = "common" end
	if (type(def.color) ~= "string") then
		def.color = Loot.RARITY_COLORS[def.rarity] or Loot.RARITY_COLORS.common
	end

	-- Le champ web s'appelle `statBonus` ; l'inventaire et le combat lisent
	-- `stats` (GetEquippedStats agrège tout champ numérique).
	if (type(def.stats) ~= "table" and type(def.statBonus) == "table") then
		def.stats = {}
		for k, v in pairs(def.statBonus) do
			if (type(v) == "number") then def.stats[k] = v end
		end
	end
	if (type(def.stats) ~= "table") then def.stats = {} end

	-- `slot` web -> `equipSlot` inventaire ; `kind` weapon/armor -> `type`.
	if (def.equipSlot == nil and type(def.slot) == "string") then def.equipSlot = def.slot end
	if (def.type == nil) then
		if (def.kind == "weapon" or def.kind == "armor") then
			def.type = def.kind
		elseif (def.equipSlot == "weapon") then
			def.type = "weapon"
		end
	end

	-- Empilabilité : une arme ou une pièce d'équipement ne s'empile pas.
	if (def.stackable == nil) then
		def.stackable = (def.type ~= "weapon" and def.equipSlot == nil)
	end
	if (def.maxStack == nil) then def.maxStack = def.stackable and 50 or 1 end
	if (def.gridW == nil) then def.gridW = 1 end
	if (def.gridH == nil) then def.gridH = 1 end
	if (def.weight == nil) then
		def.weight = (def.type == "weapon" or def.equipSlot ~= nil) and 1.0 or 0.2
	end
	if (def.value == nil) then def.value = 1 end
	if (def.level == nil) then def.level = 1 end
	if (def.description == nil) then def.description = "" end
	if (def.icon == nil) then def.icon = "✨" end

	return def
end

--- Verse TOUTES les définitions du catalogue absentes du sac. Jamais d'écrasement.
---@param items table  Items.ITEM_DB (muté : uniquement des AJOUTS)
---@return table  { ajoutes = number, deja = number }
function Loot.Integrer(items)
	if (type(items) ~= "table") then return { ajoutes = 0, deja = 0 } end
	local ajoutes, deja = 0, 0

	local ids = {}
	for id in pairs(LOOT_CATALOG) do ids[#ids + 1] = id end
	table.sort(ids)

	for _, id in ipairs(ids) do
		if (items[id] ~= nil) then
			deja = deja + 1
		else
			items[id] = Loot.Adapter(LOOT_CATALOG[id])
			ajoutes = ajoutes + 1
		end
	end
	return { ajoutes = ajoutes, deja = deja }
end

--- Inscrit UNE définition absente du sac (drop procédural `gen_*`). Rend la
--- définition adaptée — l'exécutant peut la persister et la verser au sac.
---@param items table  Items.ITEM_DB
---@param entree table  la définition brute (ProceduralToLootItem, ou résolue)
---@return table|nil  la définition inscrite, ou celle déjà présente.
function Loot.EnregistrerDef(items, entree)
	if (type(items) ~= "table" or type(entree) ~= "table") then return nil end
	if (type(entree.id) ~= "string" or entree.id == "") then return nil end

	if (items[entree.id] ~= nil) then return items[entree.id] end
	local def = Loot.Adapter(entree)
	items[entree.id] = def
	return def
end

return Loot
