// ══════════════════════════════════════════════════════════════════════════════
// inventaire-vue.mjs — tests de Shared/Logic/InventaireVue.lua et des gestes
// d'équipement purs d'Inventory (EquiperDepuisGrille / DesequiperVersGrille).
//
//   node scripts/lua-harness/inventaire-vue.mjs
//
// Le VRAI catalogue d'objets est chargé (Catalogs/Items.lua) : une vue testée sur
// des objets inventés passerait pendant que le catalogue réel range ses armes
// dans le mauvais onglet.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";
const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");

const lua = await new LuaFactory().createEngine();
const script = `
local reussis, echecs = 0, 0
local function ok(c, nom) if (c) then reussis = reussis + 1 else echecs = echecs + 1 print("  ECHEC  " .. nom) end end
local function egal(a, b, nom) if (a == b) then reussis = reussis + 1 else echecs = echecs + 1 print("  ECHEC  " .. nom .. "  obtenu=" .. tostring(a) .. "  attendu=" .. tostring(b)) end end

local Items = (function() ${lire("Catalogs/Items.lua")} end)()
local Inventory = (function() ${lire("Logic/Inventory.lua")} end)()
Inventory.SetItemDatabase(Items.ITEM_DB)
local Vue = (function() ${lire("Logic/InventaireVue.lua")} end)()

-- Non configurée : erreur franche.
egal(pcall(Vue.Construire, { grid = Inventory.CreateGridState() }, {}), false, "non configuree : leve")
Vue.Configurer({ inventaire = Inventory })

-- Un sac réel : une arme, un casque, un consommable, un matériau.
local function premier(pred)
  for id, def in pairs(Items.ITEM_DB) do if (pred(def)) then return id, def end end
end
local id_arme = premier(function(d) return d.equipSlot == "weapon" end)
local id_casque = premier(function(d) return d.equipSlot == "helmet" end)
local id_conso = premier(function(d) return d.category == "consumable" end)
local id_mat = premier(function(d) return d.category == "material" end)
ok(id_arme and id_casque and id_conso and id_mat, "le catalogue a une arme, un casque, un consommable et un materiau")

local grille = Inventory.CreateGridState()
for _, id in ipairs({ id_arme, id_casque, id_conso, id_mat }) do
  grille = Inventory.AddItemToGrid(grille, Items.ITEM_DB[id], 1) or grille
end
egal(#grille.instances, 4, "quatre objets poses dans la grille")

local vue = Vue.Construire({ grid = grille, equipment = {} }, {
  credits = 742.9,
  est_arme = function(id) return id == id_arme end,
  utilisable = function(id) return id == id_conso end,
})
egal(#vue.onglets, #Vue.ONGLETS, "un onglet par onglet de la maquette")
egal(vue.onglets[1].id, "equipement", "ordre de la maquette : equipement d'abord")
egal(#vue.objets, 4, "quatre objets dans la vue")
egal(vue.credits, 742, "credits entiers")
egal(#vue.emplacements, #Inventory.EQUIPMENT_SLOTS_ORDERED, "tous les emplacements, meme vides")
egal(vue.emplacements[1].slot, Inventory.EQUIPMENT_SLOTS_ORDERED[1].slot, "emplacements dans l'ordre du modele")
egal(vue.emplacements[1].porte, false, "emplacement vide = false (jamais nil)")

local par_id = {}
for _, o in ipairs(vue.objets) do par_id[o.id] = o end
egal(par_id[id_arme].onglet, "armes", "l'arme va dans ARMES")
egal(par_id[id_casque].onglet, "equipement", "le casque va dans EQUIPEMENT")
egal(par_id[id_conso].onglet, "consommables", "le consommable va dans CONSOMMABLES")
egal(par_id[id_mat].onglet, "ressources", "le materiau va dans RESSOURCES")
egal(par_id[id_conso].utilisable, true, "le consommable est utilisable")
egal(par_id[id_casque].equipable, true, "le casque est equipable")
ok(type(par_id[id_arme].uid) == "string", "chaque objet porte son uid")

-- Équiper le casque : il quitte la grille et remplit son emplacement.
local uid_casque = par_id[id_casque].uid
local apres, raison = Inventory.EquiperDepuisGrille({ grid = grille, equipment = {} }, uid_casque)
ok(apres ~= nil, "EquiperDepuisGrille reussit (" .. tostring(raison) .. ")")
egal(#apres.grid.instances, 3, "le casque a quitte la grille")
egal(apres.equipment.helmet and apres.equipment.helmet.itemId, id_casque, "le casque est porte")
egal(#grille.instances, 4, "l'etat d'entree n'est pas mute")

local vue2 = Vue.Construire(apres, {})
local casque_porte = nil
for _, e in ipairs(vue2.emplacements) do if (e.slot == "helmet") then casque_porte = e.porte end end
egal(casque_porte and casque_porte.id, id_casque, "la vue montre le casque porte")
ok(vue2.poids > 0, "le poids compte l'objet porte")

-- Déséquiper : retour dans la grille.
local rendu = Inventory.DesequiperVersGrille(apres, "helmet")
ok(rendu ~= nil, "DesequiperVersGrille reussit")
egal(#rendu.grid.instances, 4, "le casque revient dans la grille")
egal(rendu.equipment.helmet, nil, "l'emplacement est vide")

-- Refus nommés.
egal(select(2, Inventory.EquiperDepuisGrille({ grid = grille, equipment = {} }, "uid_fantome")), "Objet introuvable dans le sac", "uid inconnu refuse")
egal(select(2, Inventory.EquiperDepuisGrille({ grid = grille, equipment = {} }, par_id[id_mat].uid)), "Objet non équipable", "materiau non equipable refuse")
egal(select(2, Inventory.DesequiperVersGrille({ grid = grille, equipment = {} }, "helmet")), "Emplacement vide", "emplacement vide refuse")
egal(select(2, Inventory.EquiperDepuisGrille(nil, "x")), "Sac absent", "sac absent refuse")

-- ── Vignettes 3D (2026-09-15) ──────────────────────────────────────────────────
-- Une arme du pack de base porte le rendu livré par le client ; un objet de NOTRE
-- pack porte son mesh (rendu par le client) ; un objet sans mesh ne porte ni l'un
-- ni l'autre (repli sur l'icône).
local Vignettes = (function() ${lire("Catalogs/Vignettes.lua")} end)()
Vue.Configurer({ inventaire = Inventory, vignettes = Vignettes })
ok(Vignettes.BASE.SK_Lewis == true, "le client livre la vignette du Lewis Gun")
egal(Vignettes.PourMesh("nanos-world::SK_Lewis"), "assets://nanos-world/Thumbnails/SK_Lewis.jpg", "adresse assets:// de la vignette")
egal(Vignettes.PourMesh("narvos::SM_Ammo9mm"), nil, "un mesh de NOTRE pack n'a pas de vignette livree")
egal(Vignettes.PourMesh("nanos-world::SK_Inexistant"), nil, "cle sans vignette : nil")
egal(Vignettes.PourMesh(nil), nil, "mesh nil : nil")

Items.ITEM_DB.essai_lewis = { id = "essai_lewis", label = "Lewis", type = "weapon", equipSlot = "weapon", mesh = "nanos-world::SK_Lewis", gridW = 1, gridH = 1 }
Items.ITEM_DB.essai_munitions = { id = "essai_munitions", label = "9 mm", category = "ammo", mesh = "narvos::SM_Ammo9mm", gridW = 1, gridH = 1, stackable = true, maxStack = 99 }
local sac_v = Inventory.CreateGridState()
sac_v = Inventory.AddItemToGrid(sac_v, Items.ITEM_DB.essai_lewis, 1)
sac_v = Inventory.AddItemToGrid(sac_v, Items.ITEM_DB.essai_munitions, 5)
sac_v = Inventory.AddItemToGrid(sac_v, Items.ITEM_DB[id_mat], 1)
local vue_v = Vue.Construire({ grid = sac_v, equipment = {} }, {})
local v_par_id = {}
for _, o in ipairs(vue_v.objets) do v_par_id[o.id] = o end
egal(v_par_id.essai_lewis.vignette, "assets://nanos-world/Thumbnails/SK_Lewis.jpg", "arme de base : vignette livree")
egal(v_par_id.essai_munitions.vignette, false, "objet de notre pack : pas de vignette livree")
egal(v_par_id.essai_munitions.mesh, "narvos::SM_Ammo9mm", "objet de notre pack : son mesh part a la page")
egal(v_par_id[id_mat].mesh, false, "objet sans mesh : mesh = false (jamais nil)")
egal(v_par_id[id_mat].vignette, false, "objet sans mesh : vignette = false")
Items.ITEM_DB.essai_lewis, Items.ITEM_DB.essai_munitions = nil, nil

-- Onglet d'objets bizarres.
egal(Vue.Onglet(nil, false), "divers", "definition absente : divers")
egal(Vue.Onglet({ category = "vehicule" }, false), "divers", "cle de vehicule : divers")
egal(Vue.Onglet({ category = "equipment" }, true), "armes", "une arme reconnue va dans ARMES meme en equipment")

print(string.format("%d reussis, %d echec(s)", reussis, echecs))
if (echecs > 0) then error(echecs .. " test(s) en echec") end
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
} finally {
  lua.global.close();
}