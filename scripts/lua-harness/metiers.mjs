import { RACINE_DEPOT } from "./_racine.mjs";
import { bundleTS } from "./_bundle.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// metiers.mjs — parité TS ↔ Lua de la progression des MÉTIERS.
//
//   node scripts/lua-harness/metiers.mjs
//
// ── CE QU'IL PROUVE ──────────────────────────────────────────────────────────
// `Logic/Metiers.lua` est un PORT de `professions/professionTypes.ts` et de la
// partie XP de `professionStore.ts`. Un port qui « a l'air juste » dérive : un
// arrondi différent décale l'XP d'un point sur quelques niveaux, et le joueur
// ne progresse plus pareil selon le client.
//
// On ne compare donc pas le Lua à des valeurs recopiées : on EXÉCUTE le TS,
// compilé par esbuild, et on oppose ses sorties à celles du Lua sur TOUTE la
// plage — les 50 niveaux, et des cascades de gains réels.
// ══════════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const RACINE = RACINE_DEPOT + "";
const LUA = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;

let reussis = 0;
let echecs = 0;
const egal = (obtenu, attendu, nom) => {
  if (JSON.stringify(obtenu) === JSON.stringify(attendu)) reussis++;
  else { echecs++; console.log(`  ECHEC  ${nom}  Lua=${JSON.stringify(obtenu)}  TS=${JSON.stringify(attendu)}`); }
};
const vrai = (c, nom) => { if (c) reussis++; else { echecs++; console.log(`  ECHEC  ${nom}`); } };

// ── 1. Le TS, exécuté ────────────────────────────────────────────────────────
const tmp = path.join(os.tmpdir(), `metiers-ts-${Date.now()}.mjs`);
await bundleTS(`${RACINE}/WebPortal/src/rpg/professions/professionTypes.ts`, tmp);
const ts = await import(pathToFileURL(tmp).href);

const tmp2 = path.join(os.tmpdir(), `metiers-cat-${Date.now()}.mjs`);
await bundleTS(`${RACINE}/WebPortal/src/rpg/professions/professionCatalog.ts`, tmp2);
const cat = await import(pathToFileURL(tmp2).href);

// ── 2. Le Lua ────────────────────────────────────────────────────────────────
const lua = await new LuaFactory().createEngine();
await lua.doString(`
Metiers = (function()
${fs.readFileSync(`${LUA}/Catalogs/Metiers.lua`, "utf8")}
end)()
ML = (function()
${fs.readFileSync(`${LUA}/Logic/Metiers.lua`, "utf8")}
end)()
Gisements = (function()
${fs.readFileSync(`${LUA}/Catalogs/Gisements.lua`, "utf8")}
end)()
Recettes = (function()
${fs.readFileSync(`${LUA}/Catalogs/Recettes.lua`, "utf8")}
end)()
`);

// ⚠ UN SEUL PASSAGE LUA. wasmoon corrompt son environnement apres quelques
// centaines d'appels `doString` successifs — la premiere version de ce harnais
// cassait au 23e niveau sur « attempt to index a nil value (upvalue '_ENV') ».
// Le Lua calcule donc TOUT en une fois et rend un JSON, que le JS compare.
const GAINS = [10, 0, 49, 51, 400, 1234, 5000, 99999, 7, 250000, 3];
const ids = cat.PROFESSIONS.map((d) => d.id);

const brut = await lua.doString(`
  local function q(s) return string.format("%q", tostring(s)) end
  local parts = {}
  local function ajouter(cle, valeur) parts[#parts + 1] = q(cle) .. ":" .. valeur end

  ajouter("max", tostring(ML.NIVEAU_MAX))
  ajouter("inf_au_max", tostring(ML.XpPourNiveau(ML.NIVEAU_MAX) == math.huge))

  local courbe, totale = {}, {}
  for l = 1, ML.NIVEAU_MAX - 1 do
    courbe[#courbe + 1] = tostring(ML.XpPourNiveau(l))
    totale[#totale + 1] = tostring(ML.XpTotalePourNiveau(l))
  end
  ajouter("courbe", "[" .. table.concat(courbe, ",") .. "]")
  ajouter("totale", "[" .. table.concat(totale, ",") .. "]")

  local paliers = {}
  for _, m in ipairs(Metiers.PROFESSIONS) do
    local ligne = {}
    for l = 1, ML.NIVEAU_MAX do
      local t = ML.MeilleurPalier(m, l)
      ligne[#ligne + 1] = q(t and t.id or "nil")
    end
    paliers[#paliers + 1] = q(m.id) .. ":[" .. table.concat(ligne, ",") .. "]"
  end
  ajouter("paliers", "{" .. table.concat(paliers, ",") .. "}")

  local cascade = {}
  local etat = ML.EtatNeuf({ "mineur" })
  for _, g in ipairs({ ${GAINS.join(",")} }) do
    local suivant, n = ML.AjouterXP(etat, "mineur", g)
    etat = suivant
    cascade[#cascade + 1] = q(etat.mineur.niveau .. "|" .. etat.mineur.xp .. "|" .. n)
  end
  ajouter("cascade", "[" .. table.concat(cascade, ",") .. "]")

  local e = ML.EtatNeuf({ "mineur", "bucheron" })
  local s = ML.AjouterXP(e, "mineur", 5000)
  ajouter("immuable", tostring(e.mineur.niveau == 1 and e.mineur.xp == 0 and s ~= e))
  local s2, n2 = ML.AjouterXP(e, "fantome", 5000)
  ajouter("fantome", tostring(s2 == e and n2 == 0 and s2.fantome == nil))
  local s3, n3 = ML.AjouterXP(e, "mineur", -40)
  ajouter("negatif", tostring(s3 == e and n3 == 0))

  local f1 = ML.Fiche(ML.EtatNeuf({ "mineur" }), "mineur")
  ajouter("fiche_neuve", tostring(f1.niveau == 1 and f1.xp == 0 and f1.cible == ML.XpPourNiveau(1) and f1.max == false))
  local f2 = ML.Fiche((ML.AjouterXP(ML.EtatNeuf({ "mineur" }), "mineur", 10^9)), "mineur")
  ajouter("fiche_max", tostring(f2.niveau == ML.NIVEAU_MAX and f2.cible == 0 and f2.progression == 1 and f2.max == true))

  -- ── COUVERTURE : tout outil et toute station REELLEMENT employes ────────
  -- On itere les VRAIS catalogues : une liste d'outils recopiee ici serait
  -- complete aujourd'hui et perimee au prochain gisement.
  local outils_sans, stations_sans = {}, {}
  for _, g in pairs(Gisements.GISEMENTS or Gisements) do
    if type(g) == "table" and g.outil and ML.MetierDOutil(g.outil) == nil then
      outils_sans[#outils_sans + 1] = q(g.outil)
    end
  end
  for _, r in pairs(Recettes.RECETTES or Recettes) do
    if type(r) == "table" and r.station and ML.MetierDeStation(r.station) == nil then
      stations_sans[#stations_sans + 1] = q(r.station)
    end
  end
  ajouter("outils_sans_metier", "[" .. table.concat(outils_sans, ",") .. "]")
  ajouter("stations_sans_metier", "[" .. table.concat(stations_sans, ",") .. "]")

  -- Tout metier vise par ces tables existe au catalogue.
  local cibles_mortes = {}
  local connus = {}
  for _, m in ipairs(Metiers.PROFESSIONS) do connus[m.id] = true end
  for _, t in ipairs({ ML.METIER_PAR_OUTIL, ML.METIER_PAR_STATION }) do
    for k, v in pairs(t) do
      if not connus[v] then cibles_mortes[#cibles_mortes + 1] = q(k .. "->" .. v) end
    end
  end
  ajouter("cibles_mortes", "[" .. table.concat(cibles_mortes, ",") .. "]")

  -- L'XP derivee n'est jamais nulle pour un metier qui a des paliers/recettes.
  local nuls = {}
  for _, m in ipairs(Metiers.PROFESSIONS) do
    if m.kind == "gather" and ML.XpDeRecolte(Metiers, m.id, 0, 1) <= 0 then nuls[#nuls + 1] = q("recolte:" .. m.id) end
  end
  for _, id in ipairs({ "forgeron", "alchimiste" }) do
    if ML.XpDeFabrication(Metiers, id, 0) <= 0 then nuls[#nuls + 1] = q("fabrication:" .. id) end
  end
  ajouter("xp_nulles", "[" .. table.concat(nuls, ",") .. "]")

  -- Un palier au-dela du catalogue prend le dernier, jamais zero.
  ajouter("palier_hors_borne", tostring(ML.XpDeRecolte(Metiers, "mineur", 99, 1) > 0))
  ajouter("metier_inconnu_zero", tostring(ML.XpDeRecolte(Metiers, "fantome", 1, 1) == 0))
  ajouter("quantite_multiplie", tostring(ML.XpDeRecolte(Metiers, "mineur", 0, 3) == 3 * ML.XpDeRecolte(Metiers, "mineur", 0, 1)))

  ajouter("n_metiers", tostring(#Metiers.PROFESSIONS))
  ajouter("n_recettes", tostring(#Metiers.RECIPES))
  return "{" .. table.concat(parts, ",") .. "}"
`);
const L = JSON.parse(brut);

console.log("[courbe]");
egal(L.max, ts.MAX_PROFESSION_LEVEL, "niveau maximal");
for (let l = 1; l < ts.MAX_PROFESSION_LEVEL; l++) {
  egal(L.courbe[l - 1], ts.xpForLevel(l), `xpForLevel(${l})`);
  egal(L.totale[l - 1], ts.totalXpForLevel(l), `totalXpForLevel(${l})`);
}
vrai(L.inf_au_max, "au niveau maximal l'XP requise est infinie, comme en TS");

console.log("[paliers]");
for (const def of cat.PROFESSIONS) {
  for (let l = 1; l <= ts.MAX_PROFESSION_LEVEL; l++) {
    const t = ts.bestTierForLevel(def, l);
    egal(L.paliers[def.id]?.[l - 1], t ? t.id : "nil", `bestTierForLevel(${def.id}, ${l})`);
  }
}

console.log("[cascade]");
const addXpTS = (p, amount) => {
  if (amount <= 0) return [p, 0];
  const q = { ...p };
  let gained = 0;
  q.xp += amount;
  while (q.level < ts.MAX_PROFESSION_LEVEL && q.xp >= ts.xpForLevel(q.level)) {
    q.xp -= ts.xpForLevel(q.level);
    q.level += 1;
    gained += 1;
  }
  if (q.level >= ts.MAX_PROFESSION_LEVEL) q.xp = 0;
  return [q, gained];
};
let pr = { level: 1, xp: 0 };
GAINS.forEach((g, i) => {
  let gained;
  [pr, gained] = addXpTS(pr, g);
  egal(L.cascade[i], `${pr.level}|${pr.xp}|${gained}`, `cascade apres +${g}`);
});

console.log("[immuabilite et fiche]");
vrai(L.immuable, "AjouterXP ne modifie pas l'etat d'origine");
vrai(L.fantome, "un metier inconnu n'est pas cree");
vrai(L.negatif, "un gain negatif ne fait rien");
vrai(L.fiche_neuve, "fiche d'un metier neuf");
vrai(L.fiche_max, "au niveau maximal la fiche n'envoie pas d'infini");

console.log("[branchement]");
egal(L.outils_sans_metier, [], "tout outil de gisement a un metier (sinon la recolte ne rapporte rien)");
egal(L.stations_sans_metier, [], "toute station de recette a un metier (sinon le craft ne rapporte rien)");
egal(L.cibles_mortes, [], "tout metier vise par les tables existe au catalogue");
egal(L.xp_nulles, [], "aucune XP derivee nulle pour un metier pratiquable");
vrai(L.palier_hors_borne, "un palier au-dela du catalogue rapporte le dernier palier, pas zero");
vrai(L.metier_inconnu_zero, "un metier inconnu ne rapporte rien");
vrai(L.quantite_multiplie, "l'XP de recolte est proportionnelle a la quantite");

console.log("[catalogue]");
egal(L.n_metiers, cat.PROFESSIONS.length, "nombre de metiers");
egal(L.n_recettes, cat.RECIPES.length, "nombre de recettes");

lua.global.close();
console.log("");
console.log(`${reussis} reussis, ${echecs} echec(s)`);
if (echecs > 0) process.exitCode = 1;