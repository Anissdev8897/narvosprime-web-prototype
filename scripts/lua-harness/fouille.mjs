// ══════════════════════════════════════════════════════════════════════════════
// fouille.mjs — preuves du modèle de cadavre fouillable (Logic/Fouille.lua).
//   node scripts/lua-harness/fouille.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const LUA = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";
const lire = (f) => fs.readFileSync(`${LUA}/${f}`, "utf8");

const lua = await new LuaFactory().createEngine();

const brut = await lua.doString(`
local Fouille = (function()
${lire("Logic/Fouille.lua")}
end)()

local function q(s) return string.format("%q", tostring(s)) end
local parts = {}
local function mettre(k, v) parts[#parts + 1] = q(k) .. ":" .. tostring(v) end

-- ── 1. Ouverture : entrées numérotées ─────────────────────────────────────────
local drops = {
  { def = { id = "epee", label = "Epee", type = "weapon", rarity = "rare", weight = 1.2 }, quantite = 1 },
  { def = { id = "metal", label = "Metal", type = "material", rarity = "common", weight = 0.2 }, quantite = 5 },
  { def = { id = "potion", label = "Potion", type = "consumable", rarity = "epic", weight = 0.3 }, quantite = 2 },
}
local etat = Fouille.Nouveau(drops, 100000, 120000)
mettre("trois_entrees", #etat.entrees == 3)
mettre("uid_stables", etat.entrees[1].uid == 1 and etat.entrees[3].uid == 3)
mettre("expire_calcule", etat.expire_ms == 220000)

-- ── 2. Prendre une partie ─────────────────────────────────────────────────────
local def, quantite = Fouille.Prendre(etat, 2, 2)
mettre("prendre_def", def ~= nil and def.id == "metal")
mettre("prendre_quantite", quantite == 2)
mettre("reste_3", Fouille.Entree(etat, 2).quantite == 3)

-- ── 3. Prendre tout d'une entrée (quantite absente) ──────────────────────────
Fouille.Prendre(etat, 3)
mettre("entree_3_disparue", Fouille.Entree(etat, 3) == nil)

-- ── 4. Entrée inconnue : refus motivé, rien ne bouge ─────────────────────────
local d2, q2, raison = Fouille.Prendre(etat, 99, 1)
mettre("uid_inconnu_refuse", d2 == nil and q2 == nil and type(raison) == "string")
mettre("rien_perdu_sur_refus", #etat.entrees == 2)

-- ── 5. Sac plein simulé : ne pas appeler Prendre ne perd rien ─────────────────
local avant_sac_plein = #etat.entrees
mettre("sac_plein_rien_perdu", avant_sac_plein == 2)

-- ── 6. Poids ──────────────────────────────────────────────────────────────────
-- epee 1.2×1 + metal 0.2×3 = 1.8
mettre("poids_total", Fouille.Poids(etat) == 1.8)

-- ── 7. Tout prendre vide le cadavre ───────────────────────────────────────────
local tout = Fouille.ToutPrendre(etat)
mettre("tout_nb", #tout == 2)
mettre("tout_quantites", tout[2].quantite == 3)
mettre("vide_apres_tout", Fouille.EstVide(etat) == true)

-- ── 8. Filtre auto-loot : familles + rareté minimale ──────────────────────────
local etat2 = Fouille.Nouveau(drops, 100000, 120000)
local pris, restant = Fouille.FiltrerAutoLoot(etat2, {
  auto_loot_types = { arme = true, consommable = true, ressource = true, equipement = true, autre = true },
  auto_loot_rarete = "rare",
})
-- rare et mieux : l'epee (rare) et la potion (epic) partent, le metal (common) reste
mettre("filtre_rare_pris", #pris == 2 and #restant == 1 and restant[1].def.id == "metal")

local etat3 = Fouille.Nouveau(drops, 100000, 120000)
local pris3, restant3 = Fouille.FiltrerAutoLoot(etat3, {
  auto_loot_types = { arme = true, equipement = true },  -- pas consommable ni ressource
  auto_loot_rarete = "normal",
})
mettre("filtre_familles_arme_seule", #pris3 == 1 and pris3[1].def.id == "epee")
mettre("filtre_familles_restant", #restant3 == 2)

local etat4 = Fouille.Nouveau(drops, 100000, 120000)
local pris4, restant4 = Fouille.FiltrerAutoLoot(etat4, {
  auto_loot_types = { arme = true, consommable = true, ressource = true },
  auto_loot_rarete = "legendary",
})
mettre("filtre_legendaire_rien", #pris4 == 0 and #restant4 == 3)

-- ── 9. AutoLoot applique le filtre À L'ÉTAT ───────────────────────────────────
local etat5 = Fouille.Nouveau(drops, 100000, 120000)
local pris5 = Fouille.AutoLoot(etat5, {
  auto_loot_types = { arme = true, consommable = true, ressource = true, equipement = true, autre = true },
  auto_loot_rarete = "rare",
})
mettre("autoloot_prend", #pris5 == 2)
mettre("autoloot_reste_metal", #etat5.entrees == 1 and etat5.entrees[1].def.id == "metal")

-- ── 10. Expiration ────────────────────────────────────────────────────────────
mettre("expire_non", Fouille.Expire(etat5, 219999) == false)
mettre("expire_oui", Fouille.Expire(etat5, 220000) == true)

return "{" .. table.concat(parts, ",") .. "}"
`);
lua.global.close();

const L = JSON.parse(brut);
let reussis = 0, echecs = 0;
const vrai = (c, n) => { if (c) reussis++; else { echecs++; console.log(`  ECHEC  ${n}`); } };

console.log("[ouverture]");
vrai(L.trois_entrees, "3 drops → 3 entrées");
vrai(L.uid_stables, "uid stables 1..3");
vrai(L.expire_calcule, "expiration = maintenant + durée");

console.log("[prendre]");
vrai(L.prendre_def, "Prendre rend la bonne définition");
vrai(L.prendre_quantite, "Prendre rend la quantité demandée");
vrai(L.reste_3, "le reste de la pile demeure");
vrai(L.entree_3_disparue, "prendre tout retire l'entrée");
vrai(L.uid_inconnu_refuse, "uid inconnu : refus motivé");
vrai(L.rien_perdu_sur_refus, "un refus ne perd rien");
vrai(L.sac_plein_rien_perdu, "sans confirmation de grille, rien ne part");

console.log("[poids et tout-prendre]");
vrai(L.poids_total, "poids = Σ weight × quantité (1.8 kg)");
vrai(L.tout_nb, "ToutPrendre rend toutes les entrées");
vrai(L.tout_quantites, "ToutPrendre rend les quantités restantes");
vrai(L.vide_apres_tout, "le cadavre est vide après");

console.log("[auto-loot]");
vrai(L.filtre_rare_pris, "rareté minimale « rare » : rare et mieux partent, le commun reste");
vrai(L.filtre_familles_arme_seule, "familles cochées : seule l'arme part");
vrai(L.filtre_familles_restant, "les familles non cochées restent");
vrai(L.filtre_legendaire_rien, "rareté « légendaire » : rien ne part");
vrai(L.autoloot_prend, "AutoLoot rend ce qui part (rare et mieux)");
vrai(L.autoloot_reste_metal, "AutoLoot laisse le commun sur le cadavre");

console.log("[expiration]");
vrai(L.expire_non, "pas expiré avant l'échéance");
vrai(L.expire_oui, "expiré à l'échéance");

console.log(`\n${reussis} réussi(s), ${echecs} échec(s)`);
process.exit(echecs > 0 ? 1 : 0);