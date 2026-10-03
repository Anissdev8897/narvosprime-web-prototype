import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// jouabilite.mjs — preuves du registre de jouabilité (Logic/Jouabilite.lua).
//   node scripts/lua-harness/jouabilite.mjs
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const LUA = RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";
const lire = (f) => fs.readFileSync(`${LUA}/${f}`, "utf8");

const lua = await new LuaFactory().createEngine();

const brut = await lua.doString(`
local Jouabilite = (function()
${lire("Logic/Jouabilite.lua")}
end)()

local function q(s) return string.format("%q", tostring(s)) end
local parts = {}
local function mettre(k, v) parts[#parts + 1] = q(k) .. ":" .. v end

-- ── 1. Le registre expose ce que l'écran attend ───────────────────────────────
local n_params, n_plats = 0, 0
for _, p in ipairs(Jouabilite.PARAMETRES) do
  n_params = n_params + 1
  if p.type == "groupe" then
    n_plats = n_plats + #(p.sous or {})
  else
    n_plats = n_plats + 1
  end
end
mettre("n_entrees_registre", tostring(n_params))
mettre("n_parametres_plats", tostring(n_plats))

-- auto-loot toggle, auto-loot avancé groupe (2 sous), auto-marche toggle.
mettre("auto_loot_toggle", tostring(Jouabilite.Trouver("auto_loot").type == "toggle"))
mettre("auto_loot_avance_groupe", tostring(Jouabilite.Trouver("auto_loot_avance") and Jouabilite.Trouver("auto_loot_avance").type == "groupe"))
mettre("auto_loot_types_multi", tostring(Jouabilite.Trouver("auto_loot_types").type == "multi"))
mettre("auto_loot_rarete_choix", tostring(Jouabilite.Trouver("auto_loot_rarete").type == "choix"))
mettre("auto_marche_toggle", tostring(Jouabilite.Trouver("auto_marche").type == "toggle"))

-- ── 2. Validation en liste blanche ────────────────────────────────────────────
local v1 = Jouabilite.Valider(Jouabilite.Trouver("auto_loot"), true)
local v2 = Jouabilite.Valider(Jouabilite.Trouver("auto_loot"), "oui")
mettre("val_toggle_ok", tostring(v1 == true))
mettre("val_toggle_refuse_texte", tostring(v2 == false))

local v3 = Jouabilite.Valider(Jouabilite.Trouver("auto_loot_rarete"), "epic")
local v4 = Jouabilite.Valider(Jouabilite.Trouver("auto_loot_rarete"), "invente")
mettre("val_choix_ok", tostring(v3 == true))
mettre("val_choix_refuse", tostring(v4 == false))

local v5 = Jouabilite.Valider(Jouabilite.Trouver("auto_loot_types"), { arme = true, ressource = true })
local v6 = Jouabilite.Valider(Jouabilite.Trouver("auto_loot_types"), { arme = true, n_existe_pas = true })
mettre("val_multi_ok", tostring(v5 == true))
mettre("val_multi_refuse_cle", tostring(v6 == false))

-- ── 3. Défauts : chaque paramètre du registre a une valeur par défaut VALIDE ──
local defauts_ok = true
local defs = Jouabilite.Defauts()
for _, p in ipairs(Jouabilite.PARAMETRES) do
  local liste = (p.type == "groupe") and (p.sous or {}) or { p }
  for _, s in ipairs(liste) do
    local ok = Jouabilite.Valider(s, defs[s.id])
    if not ok then defauts_ok = false end
  end
end
mettre("tous_defauts_validables", tostring(defauts_ok))

-- ── 4. Encodage / décodage aller-retour ───────────────────────────────────────
local enc_toggle = Jouabilite.Encoder(true, Jouabilite.Trouver("auto_loot"))
local dec_toggle = Jouabilite.Decoder(enc_toggle, Jouabilite.Trouver("auto_loot"))
mettre("aller_retour_toggle", tostring(dec_toggle == true))

local enc_multi = Jouabilite.Encoder({ arme = true, consommable = true, ressource = true }, Jouabilite.Trouver("auto_loot_types"))
local dec_multi = Jouabilite.Decoder(enc_multi, Jouabilite.Trouver("auto_loot_types"))
mettre("aller_retour_multi", tostring(dec_multi.arme == true and dec_multi.consommable == true and dec_multi.ressource == true and dec_multi.equipement == nil))

-- ── 5. Vue : structure prête pour l'écran ─────────────────────────────────────
local vue = Jouabilite.Vue(nil)
local groupes, toggles = 0, 0
for _, l in ipairs(vue) do
  if l.type == "groupe" then groupes = groupes + 1 else toggles = toggles + 1 end
end
mettre("vue_groupes", tostring(groupes))
mettre("vue_toggles", tostring(toggles))
local g = vue[2]
mettre("vue_groupe_porte_sous", tostring(g ~= nil and g.type == "groupe" and #g.sous == 2))

-- ── 6. Persistance avec une FAUSSE base ───────────────────────────────────────
local lignes = {}
local fausse_base = {
  Select = function(self, sql, ...) return lignes end,
  Execute = function(self, sql, ...)
    if sql:match("^DELETE") then
      lignes = {}
    elseif sql:match("^INSERT") then
      local compte, pid, valeur = ...
      local trouve = false
      for _, l in ipairs(lignes) do
        if l.parametre_id == pid then l.valeur = valeur; trouve = true end
      end
      if not trouve then lignes[#lignes + 1] = { parametre_id = pid, valeur = valeur } end
    end
  end,
}
Jouabilite.UtiliserBase(fausse_base)
local ok1 = Jouabilite.Definir(1, "auto_marche", true)
mettre("definir_ok", tostring(ok1 == true))
mettre("parcompte_auto_marche", tostring(Jouabilite.ParCompte(1).auto_marche == true))
mettre("parcompte_auto_loot_defaut", tostring(Jouabilite.ParCompte(1).auto_loot == false))
local ok2 = Jouabilite.Definir(1, "auto_loot_rarete", "epic")
mettre("parcompte_rarete_epic", tostring(Jouabilite.ParCompte(1).auto_loot_rarete == "epic"))
Jouabilite.Reinitialiser(1, "auto_loot_rarete")
mettre("reinit_retour_defaut", tostring(Jouabilite.ParCompte(1).auto_loot_rarete == "normal"))
local refus = Jouabilite.Definir(1, "auto_loot", "pas_un_booleen")
mettre("definir_refuse_invalide", tostring(refus == false))

-- ── 7. Extensibilité : une entrée ajoutée au registre sort dans la vue ────────
local avant = #Jouabilite.Vue(nil)
Jouabilite.PARAMETRES[#Jouabilite.PARAMETRES + 1] = {
  id = "futur_test", type = "toggle", defaut = true, categorie = "Futur",
  label = "Paramètre futur", description = "",
}
mettre("extension_vue_plus_un", tostring(#Jouabilite.Vue(nil) == avant + 1))
mettre("extension_trouvable", tostring(Jouabilite.Trouver("futur_test") ~= nil))
mettre("extension_defaut", tostring(Jouabilite.Defauts().futur_test == true))

return "{" .. table.concat(parts, ",") .. "}"
`);
lua.global.close();

const L = JSON.parse(brut);
let reussis = 0, echecs = 0;
const egal = (o, a, n) => { if (JSON.stringify(o) === JSON.stringify(a)) reussis++; else { echecs++; console.log(`  ECHEC  ${n}  obtenu=${JSON.stringify(o)}  attendu=${JSON.stringify(a)}`); } };
const vrai = (c, n) => { if (c) reussis++; else { echecs++; console.log(`  ECHEC  ${n}`); } };

console.log("[registre]");
vrai(L.n_entrees_registre === 3, "3 entrées au registre (2 toggles + 1 groupe)");
vrai(L.n_parametres_plats === 4, "4 paramètres plats (auto_loot, 2 sous, auto_marche)");
vrai(L.auto_loot_toggle === true && L.auto_marche_toggle === true, "auto-loot et auto-marche sont des toggles");
vrai(L.auto_loot_avance_groupe === true, "auto-loot avancé est un groupe");
vrai(L.auto_loot_types_multi === true && L.auto_loot_rarete_choix === true, "les sous-paramètres ont les bons types");

console.log("[validation]");
vrai(L.val_toggle_ok === true, "toggle : vrai accepté");
vrai(L.val_toggle_refuse_texte === true, "toggle : texte refusé");
vrai(L.val_choix_ok === true, "choix : valeur de la liste acceptée");
vrai(L.val_choix_refuse === true, "choix : valeur inconnue refusée");
vrai(L.val_multi_ok === true, "multi : clés connues acceptées");
vrai(L.val_multi_refuse_cle === true, "multi : clé inconnue refusée");
vrai(L.tous_defauts_validables === true, "chaque défaut du registre passe la validation");

console.log("[encodage]");
vrai(L.aller_retour_toggle === true, "toggle : aller-retour base");
vrai(L.aller_retour_multi === true, "multi : aller-retour base");

console.log("[vue]");
vrai(L.vue_groupes === 1 && L.vue_toggles === 2, "vue : 1 groupe + 2 toggles");
vrai(L.vue_groupe_porte_sous === true, "vue : le groupe porte ses 2 sous-paramètres");

console.log("[persistance]");
vrai(L.definir_ok === true, "Définir accepte une valeur valide");
vrai(L.parcompte_auto_marche === true, "la valeur définie se relit");
vrai(L.parcompte_auto_loot_defaut === true, "un paramètre non touché garde son défaut");
vrai(L.parcompte_rarete_epic === true, "un choix persiste");
vrai(L.reinit_retour_defaut === true, "Réinitialiser revient au défaut");
vrai(L.definir_refuse_invalide === true, "Définir refuse une valeur invalide");

console.log("[extensibilité]");
vrai(L.extension_vue_plus_un === true, "un paramètre ajouté au registre sort dans la vue");
vrai(L.extension_trouvable === true, "un paramètre ajouté est trouvable");
vrai(L.extension_defaut === true, "un paramètre ajouté a son défaut");

console.log(`\n${reussis} réussi(s), ${echecs} échec(s)`);
process.exit(echecs > 0 ? 1 : 0);