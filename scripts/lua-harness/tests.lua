-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Inventory.SetItemDatabase(ITEM_DB)
-- [TROU — ligne jamais lue dans les transcriptions]
local def = ITEM_DB.arch_sword
local smallDef = ITEM_DB.potion_soin_mineure

-- ══════════════════════════════════════════════════════════ constantes ══
print("[constantes]")
local labels_count = 0
for _ in pairs(Inventory.EQUIP_SLOT_LABELS) do labels_count = labels_count + 1 end
-- ⚠ 12 SLOTS depuis le 2026-09-19 (brief équipements 3D) : casque, torse,
-- jambes, chaussures, arme, secondaire, collier, anneau 1/2, bijoux, ceinture,
-- cape — l'ancien contrat (6) venait du port web.
eq(labels_count, 12, "EQUIP_SLOT_LABELS a 12 slots")
eq(Inventory.EQUIP_SLOT_LABELS.helmet, "Casque", "label helmet")
eq(Inventory.EQUIP_SLOT_LABELS.accessory, "Bijoux", "label accessory")
eq(#Inventory.EQUIPMENT_SLOTS_ORDERED, 12, "EQUIPMENT_SLOTS_ORDERED a 12 entrées")
eq(#Inventory.EQUIP_SLOTS, 12, "EQUIP_SLOTS a 12 entrées")
eq(Inventory.EQUIPMENT_SLOTS_ORDERED[4].slot, "shoes", "ordre d'affichage")

-- ═════════════════════════════════════════════════════════════════ piles ════
print("[stacking]")
do
	local instances = { { itemId="potion_soin_mineure", quantity=3, uid="u1", gridX=0, gridY=0, gridW=1, gridH=1 } }
	local inst, space = Inventory.FindStackTarget(smallDef, instances, 2)
	ok(inst ~= nil, "FindStackTarget trouve une pile")
	eq(inst and inst.uid, "u1", "FindStackTarget uid")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(Inventory.FindStackTarget(smallDef, full, 1), nil, "FindStackTarget refuse une pile pleine")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(Inventory.FindStackTarget(def, swords, 1), nil, "FindStackTarget refuse un non-stackable")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
eq(Inventory.AddToStack({quantity=3}, 5, 10), 8, "AddToStack additionne")
eq(Inventory.AddToStack({quantity=7}, 5, 10), 10, "AddToStack clampe à maxStack")
eq(Inventory.RemoveFromStack({quantity=10}, 3), 7, "RemoveFromStack soustrait")
eq(Inventory.RemoveFromStack({quantity=3}, 10), 0, "RemoveFromStack plancher à 0")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local source, split = Inventory.SplitStack({itemId="x", quantity=10, uid="u1", gridX=0, gridY=0, gridW=1, gridH=1}, 3, 2, 2)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(Inventory.SplitStack({quantity=5}, 0, 1, 1), nil, "SplitStack refuse amount <= 0")
	eq(Inventory.SplitStack({quantity=5}, 5, 1, 1), nil, "SplitStack refuse amount >= quantity")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local dest, source = Inventory.MergeStacks({itemId="test", quantity=3}, {itemId="test", quantity=5}, 10)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local dest2, source2 = Inventory.MergeStacks({itemId="test", quantity=5}, {itemId="test", quantity=8}, 10)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(Inventory.MergeStacks({itemId="item_a", quantity=1}, {itemId="item_b", quantity=1}, 10), nil, "MergeStacks refuse ids différents")
	eq(Inventory.MergeStacks({itemId="t", quantity=3}, {itemId="t", quantity=10}, 10), nil, "MergeStacks refuse dest pleine")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
print("[gridInventory]")
-- [TROU — ligne jamais lue dans les transcriptions]
	local g = Inventory.CreateGridState()
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local c = Inventory.CreateGridState(6, 8)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g = Inventory.CreateGridState()
	eq(Inventory.IsAreaFree(g, 0, 0, 1, 1), true, "IsAreaFree coin haut-gauche")
	eq(Inventory.IsAreaFree(g, 7, 9, 1, 1), true, "IsAreaFree coin opposé")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(Inventory.IsAreaFree(g, 2, 2, 1, 1), false, "IsAreaFree collision origine")
	eq(Inventory.IsAreaFree(g, 3, 3, 1, 1), false, "IsAreaFree collision surface")
	eq(Inventory.IsAreaFree(g, 0, 0, 1, 1), true, "IsAreaFree hors collision (0,0)")
	eq(Inventory.IsAreaFree(g, 4, 4, 1, 1), true, "IsAreaFree hors collision (4,4)")
	eq(Inventory.IsAreaFree(g, 2, 2, 1, 1, "u1"), true, "IsAreaFree excludeUid")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g = Inventory.CreateGridState()
	local x, y = Inventory.FindFreeSlot(g, 1, 1)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g4 = Inventory.CreateGridState(4, 4)
-- [TROU — ligne jamais lue dans les transcriptions]
	local fx = Inventory.FindFreeSlot(g4, 1, 1)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g1 = Inventory.CreateGridState(1, 1)
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(Inventory.FindFreeSlot(g1, 1, 1), nil, "FindFreeSlot grille saturée")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g = Inventory.CreateGridState()
	local r = Inventory.AddItemToGrid(g, def)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g = Inventory.CreateGridState()
	local r1 = Inventory.AddItemToGrid(g, smallDef, 3)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local r2 = Inventory.AddItemToGrid(r1, smallDef, 2)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g = Inventory.CreateGridState()
	local r1 = Inventory.AddItemToGrid(g, smallDef, smallDef.maxStack)
-- [TROU — ligne jamais lue dans les transcriptions]
	local r2 = Inventory.AddItemToGrid(r1, smallDef, 1)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(Inventory.AddItemToGrid(g, small_sword), nil, "AddItemToGrid nil si grille pleine")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g = Inventory.CreateGridState(5, 5)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local r1 = Inventory.AddItemToGrid(g, d1)
-- [TROU — ligne jamais lue dans les transcriptions]
	local r2 = Inventory.AddItemToGrid(r1, d2)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(Inventory.AssertGridValid(r2), true, "cohabitation: grille valide")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g = Inventory.CreateGridState()
	local r = Inventory.AddItemToGrid(g, smallDef, 5)
	local g2, removed = Inventory.RemoveItemFromGrid(r, r.instances[1].uid)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local r10 = Inventory.AddItemToGrid(Inventory.CreateGridState(), smallDef, 10)
	local g3, removed3 = Inventory.RemoveItemFromGrid(r10, r10.instances[1].uid, 3)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g4, removed4 = Inventory.RemoveItemFromGrid(Inventory.CreateGridState(), "inconnu")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g = Inventory.AddItemToGrid(Inventory.CreateGridState(), def)
	local moved = Inventory.MoveItemInGrid(g, g.instances[1].uid, 4, 4)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	local g2 = Inventory.CreateGridState(4, 4)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
print("[inventoryStore]")
local Store = Inventory.Store

-- ⚠ LE SOLDE DE DÉPART EST LU, PAS RECOPIÉ.
--
-- Ces tests portaient `200` en dur. Le jour où `Inventory.DEFAULT_CREDITS` est
-- passé à 500, QUATRE assertions sont devenues fausses d'un coup — et la suite
-- est restée rouge. Une suite rouge cesse d'être lue : le jour où un VRAI
-- défaut la fait tomber, personne ne le distingue du bruit.
--
-- C'est la règle du dépôt appliquée aux tests eux-mêmes : une valeur recopiée
-- diverge toujours de sa source. On lit donc la constante, et changer le solde
-- de départ ne casse plus rien.
local DEPART = Inventory.DEFAULT_CREDITS

Store.Reset()
do
	local s = Store.Get()
	eq(#s.grid.instances, 0, "état initial: grille vide")
	eq(s.credits, DEPART, "état initial: solde de départ (" .. tostring(DEPART) .. ")")
	eq(s.equipment.weapon, nil, "état initial: weapon nil")
end

-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(Store.EquipFromGrid(uid), true, "EquipFromGrid réussit")
	eq(#Store.Get().grid.instances, 0, "EquipFromGrid retire de la grille")
	ok(Store.Get().equipment.weapon ~= nil, "EquipFromGrid remplit le slot")
	eq(Store.Get().equipment.weapon.itemId, "arch_sword", "EquipFromGrid bon item")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	Store.EquipFromGrid(uid1)
	Store.EquipFromGrid(uid2)
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(s2.equipment.weapon.itemId, "plasma_blade", "EquipFromGrid remplace l'arme")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(found, true, "EquipFromGrid renvoie l'item délogé en grille")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	Store.EquipFromGrid(Store.Get().grid.instances[1].uid)
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(Store.UnequipToGrid("weapon"), true, "UnequipToGrid réussit")
	eq(Store.Get().equipment.weapon, nil, "UnequipToGrid vide le slot")
	eq(#Store.Get().grid.instances, 1, "UnequipToGrid replace en grille")
	eq(Store.Get().grid.instances[1].itemId, "arch_sword", "UnequipToGrid bon item")
end

Store.Reset()
Store.AddCredits(50)
eq(Store.Get().credits, DEPART + 50, "AddCredits +50")
-- On retire PLUS que le solde courant : ce qui est testé est le plancher à 0,
-- pas une soustraction précise. Un montant fixe ne tiendrait que pour un solde
-- de départ donné — c'est exactement ce qui a cassé ici.
Store.AddCredits(-(DEPART + 50 + 1))
eq(Store.Get().credits, 0, "AddCredits clampé à 0")
Store.SetCredits(999)
eq(Store.Get().credits, 999, "SetCredits")
Store.SetCredits(-5)
eq(Store.Get().credits, 0, "SetCredits clampé à 0")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
Store.AddCredits(500)
Store.Reset()
eq(#Store.Get().grid.instances, 0, "Reset vide la grille")
eq(Store.Get().credits, DEPART, "Reset remet le solde de départ")

-- `Roster.CREDITS_DEPART` doit valoir la même chose. Le contrôle ne peut pas
-- vivre ICI : ce harnais ne charge qu'`Inventory.lua`, et tirer `Roster`
-- amènerait toute sa chaîne de dépendances pour lire un nombre. Il est dans
-- `scripts/lua-harness/constantes-check.mjs`, qui compare les fichiers.

Store.Reset()
Store.AddItemById("arch_sword")
Store.EquipFromGrid(Store.Get().grid.instances[1].uid)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	Store.AddCredits(10)
	Store.AddCredits(10)
-- [TROU — ligne jamais lue dans les transcriptions]
	unsubscribe()
	Store.AddCredits(10)
	eq(calls, 2, "unsubscribe stoppe les notifications")

	local before = Store.Get().revision
	Store.AddCredits(1)
	eq(Store.Get().revision, before + 1, "revision incrémentée")
	ok(not rawequal(Store.Get(), nil), "Get rend un état")
end

do
	-- uid uniques même en rafale (le TS collisionnait sur Date.now()).
	local seen = {}
	local dup = false
	for _ = 1, 500 do
		local uid = Inventory.NextUid()
		if (seen[uid]) then dup = true end
		seen[uid] = true
	end
	eq(dup, false, "NextUid n'entre jamais en collision")
end

do
	-- Sac restauré (redémarrage serveur) : les uid relus sont réservés, le prochain
	-- objet n'hérite jamais de l'identité d'une pile existante (vu en jeu 15/09).
	local courant = Inventory.GetUidCounter()
	local haut = courant + 40
	local grille = { cols = 8, rows = 10, instances = {
		{ itemId = "ak74u", quantity = 1, gridX = 0, gridY = 0, gridW = 1, gridH = 1, uid = "inst_" .. (haut - 5) },
		{ itemId = "lewis", quantity = 1, gridX = 1, gridY = 0, gridW = 1, gridH = 1, uid = "inst_" .. haut },
		{ itemId = "vieux", quantity = 1, gridX = 2, gridY = 0, gridW = 1, gridH = 1, uid = "u9" } } }
	local porte = { weapon = { itemId = "deagle", quantity = 1, uid = "inst_" .. (haut + 3) } }
	eq(Inventory.ReserverUids(grille, porte), haut + 3, "ReserverUids : compteur au plus grand uid (grille + porte)")
	local neuf = Inventory.NextUid()
	ok(neuf ~= "inst_" .. haut and neuf ~= "inst_" .. (haut + 3) and neuf == "inst_" .. (haut + 4),
		"ReserverUids : le prochain uid est libre")
	eq(Inventory.ReserverUids({ instances = { { uid = "inst_1" } } }, nil), haut + 4,
		"ReserverUids : un sac plus ancien ne fait jamais reculer le compteur")
	eq(Inventory.ReserverUids(nil, nil), haut + 4, "ReserverUids : sac absent sans effet")
	eq(Inventory.ReserverUids({ instances = { { uid = 12 }, { uid = "inst_x" }, "pas une pile" } }, { weapon = "x" }), haut + 4,
		"ReserverUids : uid illisibles ignores")
end

do
	-- Débordement : 25 potions (maxStack 10) → 3 piles, rien de perdu.
	local g = Inventory.AddItemToGrid(Inventory.CreateGridState(), smallDef, 25)
	eq(#g.instances, 3, "débordement: 3 piles")
	eq(Inventory.CountItem(g, smallDef.id), 25, "débordement: aucune unité perdue")

	-- Grille 2x1 : 25 potions n'y tiennent pas → refus TOTAL, grille intacte.
	local tiny = Inventory.CreateGridState(2, 1)
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	-- EquipFromGrid : pas de perte d'item quand le délogé ne peut pas revenir.
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
		credits = 0,
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
	eq(Store.EquipFromGrid(gun_uid), false, "EquipFromGrid refuse si le délogé ne rentre pas")
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]
-- [TROU — ligne jamais lue dans les transcriptions]