// ══════════════════════════════════════════════════════════════════════════════
// progression.mjs — parité TS ↔ Lua du NIVEAU du personnage (menu Compétences).
//
//   node scripts/lua-harness/progression.mjs
//
// ── CE QU'IL PROUVE ──────────────────────────────────────────────────────────
// `Logic/Progression.lua` porte à la main quatre formules du prototype web :
//   · xpForLevel / addXp          (stats/PlayerStats.ts)
//   · createStats + effectiveStats, part talents (stats/PlayerStats.ts)
//   · zoneLevelRange / xpForKill  (npc/npcLeveling.ts)
//   · investTalent / refundTalent / resetTalents (talents/talentEffects.ts)
// On n'oppose pas le Lua à des valeurs recopiées : on EXÉCUTE le TS (esbuild)
// et on compare sur toute la plage — 50 niveaux, toutes les classes, des
// cascades de gains, des séquences de gestes sur l'arbre.
//
// ⚠ UN SEUL PASSAGE LUA qui rend du JSON (wasmoon corrompt son `_ENV` après
// quelques centaines de `doString`), et AUCUNE table JS poussée vers Lua
// (plantage du processus entier, cf. talents.mjs) : les entrées sont écrites
// en texte Lua.
// ══════════════════════════════════════════════════════════════════════════════

import { execFileSync } from "node:child_process";
import { LuaFactory } from "wasmoon";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { pathToFileURL } from "node:url";

const RACINE = "E:/narvosprime-web-prototype";
const ESBUILD = `${RACINE}/WebPortal/node_modules/esbuild/bin/esbuild`;
const RPG = `${RACINE}/WebPortal/src/rpg`;
const LUA = `${RACINE}/WebPortal/Server/nanos_world/packages/narvos/Shared`;

let reussis = 0;
let echecs = 0;
const egal = (obtenu, attendu, nom) => {
  const ok = (typeof obtenu === "number" && typeof attendu === "number")
    ? Math.abs(obtenu - attendu) < 1e-9
    : JSON.stringify(obtenu) === JSON.stringify(attendu);
  if (ok) reussis++;
  else { echecs++; console.log(`  ECHEC  ${nom}  Lua=${JSON.stringify(obtenu)}  TS=${JSON.stringify(attendu)}`); }
};
const vrai = (c, nom) => { if (c) reussis++; else { echecs++; console.log(`  ECHEC  ${nom}`); } };

// ── 1. Le TS, exécuté ────────────────────────────────────────────────────────
const dossier = fs.mkdtempSync(path.join(os.tmpdir(), "progression-ts-"));
const entree = path.join(dossier, "entree.ts");
fs.writeFileSync(entree, [
  `export { MAX_LEVEL, createStats, effectiveStats, xpForLevel, addXp } from "${RPG}/stats/PlayerStats.ts";`,
  `export { ZONE_LEVEL_RANGES, zoneLevelRange, xpForKill, enemyHpMultiplier, enemyDamageMultiplier, levelFromDistance, levelTierColor } from "${RPG}/npc/npcLeveling.ts";`,
  `export { BOSS_STATS, MOB_STATS, clampResist } from "${RPG}/npc/npcStatPresets.ts";`,
  `export { SPELL_CATALOG, getSpellsForClass } from "${RPG}/spells/spellCatalog.ts";`,
  `export { aggregateTalents, investTalent, refundTalent, resetTalents, talentPointsAvailable, talentPointsEarned, LEVELS_PER_TALENT_POINT } from "${RPG}/talents/talentEffects.ts";`,
  `export { CLASSES } from "${RPG}/classes/classes.ts";`,
  `export { TALENTS } from "${RPG}/talents/talentCatalog.ts";`,
].join("\n"));
const sortie = path.join(dossier, "bundle.mjs");
execFileSync("node", [ESBUILD, entree, "--bundle", "--format=esm", "--platform=node",
  `--outfile=${sortie}`, "--log-level=error",
  "--define:import.meta.env.DEV=false", "--define:import.meta.env.PROD=true",
  "--define:import.meta.env={}", "--define:process.env.NODE_ENV=\"production\""]);
const ts = await import(pathToFileURL(sortie).href);

// ── 2. Les entrées, communes aux deux côtés ──────────────────────────────────
const CLASSES = Object.keys(ts.CLASSES);
const NIVEAUX_STATS = [1, 2, 7, 13, 25, 49, 50];
const JEUX_TALENTS = [
  {},
  { sur_vitality: 3, sur_carapace: 2 },
  { man_affinity: 3, dmg_precise: 1, mob_celerity: 2, mob_stride: 1 },
  { dmg_sharp: 3, dmg_precise: 3, dmg_overload: 2, sur_endurance: 1 },
];
const DEPARTS = [[1, 0], [1, 79], [3, 100], [12, 0], [49, 0], [49, 27000], [50, 0]];
const GAINS = [0, 1, 26, 80, 81, 500, 1234, 5000, 99999, 400000];
const ZONES = [...Object.keys(ts.ZONE_LEVEL_RANGES), "inconnue", "capitale", "foret", "alien"];
const IDS_TALENTS = ts.TALENTS.map((t) => t.id);
// Séquences de gestes : investir, rembourser, réinitialiser — dont des refus
// (prérequis absent, point manquant, rang max, dépendance au remboursement).
const SEQUENCES = [
  { niveau: 4, gestes: [["+", "dmg_sharp"]] },
  { niveau: 5, gestes: [["+", "dmg_precise"], ["+", "dmg_sharp"], ["+", "dmg_sharp"]] },
  { niveau: 15, gestes: [["+", "dmg_sharp"], ["+", "dmg_precise"], ["-", "dmg_sharp"], ["-", "dmg_precise"], ["-", "dmg_sharp"]] },
  { niveau: 50, gestes: [["+", "sur_vitality"], ["+", "sur_vitality"], ["+", "sur_vitality"], ["+", "sur_vitality"], ["+", "sur_carapace"], ["0", ""], ["+", "mob_celerity"]] },
  { niveau: 20, gestes: [["+", "inexistant"], ["-", "man_affinity"], ["+", "man_affinity"], ["+", "man_economy"], ["+", "man_economy"]] },
];

const luaTable = (obj) => `{ ${Object.entries(obj).map(([k, v]) => `${k} = ${v}`).join(", ")} }`;
const luaListe = (arr) => `{ ${arr.map((v) => (typeof v === "string" ? JSON.stringify(v) : Array.isArray(v) ? luaListe(v) : typeof v === "object" ? luaTable(v) : String(v))).join(", ")} }`;

// ── 3. Le Lua, en un passage ────────────────────────────────────────────────
const lua = await new LuaFactory().createEngine();
const lire = (f) => fs.readFileSync(`${LUA}/${f}`, "utf8");
const brut = await lua.doString(`
Stats = (function() ${lire("Catalogs/Stats.lua")} end)()
Spells = (function() ${lire("Catalogs/Spells.lua")} end)()
NiveauxPnj = (function() ${lire("Catalogs/NiveauxPnj.lua")} end)()
Classes = (function() ${lire("Catalogs/Classes.lua")} end)()
CatTalents = (function() ${lire("Catalogs/Talents.lua")} end)()
TalentsLogique = (function() ${lire("Logic/Talents.lua")} end)()
TalentsLogique.Configurer(CatTalents)
P = (function() ${lire("Logic/Progression.lua")} end)()

-- Non configuré : erreur FRANCHE, pas un repli silencieux.
local ok_nc, err_nc = pcall(P.NiveauMax)

P.Configurer({ stats = Stats, niveaux_pnj = NiveauxPnj, classes = Classes,
  talents = CatTalents, talents_logique = TalentsLogique })

local out = {}
local function q(s) return string.format("%q", tostring(s)) end
local function num(v)
  if (v == math.huge) then return q("inf") end
  if (type(v) ~= "number") then return "null" end
  if (v == math.floor(v)) then return string.format("%d", v) end
  return string.format("%.17g", v)
end
local function mettre(cle, json) out[#out + 1] = q(cle) .. ":" .. json end

mettre("non_configure_leve", tostring(not ok_nc))
mettre("non_configure_message", q(err_nc))
mettre("max", num(P.NiveauMax()))

local courbe = {}
for l = 1, P.NiveauMax() do courbe[#courbe + 1] = num(P.XpPourNiveau(l)) end
mettre("courbe", "[" .. table.concat(courbe, ",") .. "]")

local cascades = {}
for _, d in ipairs(${luaListe(DEPARTS)}) do
  for _, g in ipairs(${luaListe(GAINS)}) do
    local e, n = P.AjouterXP({ niveau = d[1], xp = d[2] }, g)
    cascades[#cascades + 1] = "[" .. num(e.niveau) .. "," .. num(e.xp) .. "," .. num(n) .. "]"
  end
end
mettre("cascades", "[" .. table.concat(cascades, ",") .. "]")

local kills = {}
for l = 1, 60 do kills[#kills + 1] = num(P.XpPourVictoire(l)) end
mettre("kills", "[" .. table.concat(kills, ",") .. "]")

local zones = {}
for _, z in ipairs(${luaListe(ZONES)}) do
  local p = P.PlageZone(z)
  zones[#zones + 1] = "[" .. num(p[1]) .. "," .. num(p[2]) .. "]"
end
mettre("zones", "[" .. table.concat(zones, ",") .. "]")

local stats = {}
for _, c in ipairs(${luaListe(CLASSES)}) do
  for _, n in ipairs(${luaListe(NIVEAUX_STATS)}) do
    for _, t in ipairs(${luaListe(JEUX_TALENTS)}) do
      local s = P.Statistiques(c, n, t)
      stats[#stats + 1] = "[" .. num(s.vie_max) .. "," .. num(s.mana_max) .. "," .. num(s.puissance)
        .. "," .. num(s.defense) .. "," .. num(s.critique) .. "," .. num(s.vitesse)
        .. "," .. num(P.ModificateursSorts(s).degats_mult) .. "," .. num(P.ModificateursSorts(s).cout_mult)
        .. "," .. num(P.ModificateursSorts(s).regen_mult) .. "," .. num(P.ModificateursSorts(s).mana_max)
        .. "," .. num(P.BonusCombat(s).defense) .. "," .. num(P.BonusCombat(s).critique) .. "]"
    end
  end
end
mettre("stats", "[" .. table.concat(stats, ",") .. "]")

local sequences = {}
for _, seq in ipairs(${luaListe(SEQUENCES.map((s) => [s.niveau, s.gestes]))}) do
  local niveau, talents = seq[1], {}
  local etapes = {}
  for _, g in ipairs(seq[2]) do
    local geste = (g[1] == "+") and "investir" or (g[1] == "-") and "rembourser" or "reinitialiser"
    local ok, res = P.ModifierTalents(niveau, talents, geste, g[2])
    if (ok) then talents = res end
    local vue = P.VueTalents(niveau, talents)
    local rangs = {}
    for _, id in ipairs(${luaListe(IDS_TALENTS)}) do rangs[#rangs + 1] = num(talents[id] or 0) end
    etapes[#etapes + 1] = "[" .. table.concat(rangs, ",") .. "," .. num(vue.disponibles) .. "]"
  end
  sequences[#sequences + 1] = "[" .. table.concat(etapes, ",") .. "]"
end
mettre("sequences", "[" .. table.concat(sequences, ",") .. "]")

-- ── Comportements propres au Lua ───────────────────────────────────────────
local fiche_max = P.Fiche({ niveau = 50, xp = 999 })
mettre("fiche_max", "[" .. num(fiche_max.cible) .. "," .. num(fiche_max.progression) .. "," .. tostring(fiche_max.max) .. "," .. num(fiche_max.xp) .. "]")
local fiche_1 = P.Fiche({ niveau = 1, xp = 40 })
mettre("fiche_1", "[" .. num(fiche_1.cible) .. "," .. num(fiche_1.progression) .. "," .. num(fiche_1.xp_cumulee) .. "]")
local fiche_12 = P.Fiche({ niveau = 12, xp = 5 })
mettre("fiche_12_cumulee", num(fiche_12.xp_cumulee))
mettre("classe_inconnue", tostring(P.Statistiques("classe_fantome", 5, {}) == nil))
local norm = P.Normaliser({ niveau = -3, xp = -10 })
mettre("normaliser_bas", "[" .. num(norm.niveau) .. "," .. num(norm.xp) .. "]")
local norm2 = P.Normaliser({ niveau = 999, xp = 50 })
mettre("normaliser_haut", "[" .. num(norm2.niveau) .. "," .. num(norm2.xp) .. "]")
local valides = P.TalentsValides({ dmg_sharp = 9, inconnu = 2, sur_vitality = 0, mob_celerity = 2.7 })
mettre("talents_valides", "[" .. num(valides.dmg_sharp) .. "," .. tostring(valides.inconnu == nil) .. "," .. tostring(valides.sur_vitality == nil) .. "," .. num(valides.mob_celerity) .. "]")
mettre("niveau_ennemi", "[" .. num(P.NiveauEnnemi("forge", nil)) .. "," .. num(P.NiveauEnnemi("tower", nil)) .. ","
  .. num(P.NiveauEnnemi("forge", 99)) .. "," .. num(P.NiveauEnnemi("orbital", 3)) .. "," .. num(P.NiveauEnnemi("capitale", "12")) .. "]")
local okr, raison = P.ModifierTalents(10, {}, "reinitialiser", nil)
mettre("reinit_vide", "[" .. tostring(okr) .. "," .. q(raison) .. "]")
local okg, rg = P.ModifierTalents(10, {}, "voler", "dmg_sharp")
mettre("geste_inconnu", "[" .. tostring(okg) .. "," .. q(rg) .. "]")
local vue = P.VueTalents(7, { dmg_sharp = 1 })
mettre("vue", "[" .. num(vue.gagnes) .. "," .. num(vue.depenses) .. "," .. num(vue.disponibles) .. "," .. num(vue.prochain_point)
  .. "," .. num(#vue.branches) .. "," .. num(#vue.noeuds) .. "," .. tostring(vue.noeuds[1].peut_rembourser) .. "," .. tostring(vue.noeuds[2].peut_investir) .. "]")
local cid = (${luaListe(CLASSES)})[1]
local nu = P.Statistiques(cid, 10, { sur_vitality = 2 })
local arme = P.Statistiques(cid, 10, { sur_vitality = 2 }, { maxHp = 20, puissance = 7, defense = 3, critique = 2, maxMana = 10 })
mettre("equipement", "[" .. num(arme.puissance - nu.puissance) .. "," .. num(arme.defense - nu.defense) .. "," .. num(arme.critique - nu.critique)
  .. "," .. tostring(arme.vie_max > nu.vie_max) .. "," .. tostring(arme.mana_max > nu.mana_max)
  .. "," .. num(P.BonusCombat(arme).puissance) .. "," .. num(P.BonusCombat(arme).defense - P.BonusCombat(nu).defense) .. "]")
local vue_max = P.VueTalents(50, {})
mettre("vue_max_prochain", tostring(vue_max.prochain_point))

-- ── Ennemis par niveau (2026-09-15) ─────────────────────────────────────────
local mults = {}
for l = 1, 60 do mults[#mults + 1] = "[" .. num(P.MultVieEnnemi(l)) .. "," .. num(P.MultDegatsEnnemi(l)) .. "," .. q(P.CouleurPalier(l)) .. "]" end
mettre("ennemis_mults", "[" .. table.concat(mults, ",") .. "]")
local distances = {}
for _, z in ipairs(${luaListe(ZONES)}) do
  for _, d in ipairs({ { 0, 10, 50 }, { 10, 10, 50 }, { 30, 10, 50 }, { 50, 10, 50 }, { 80, 10, 50 }, { 44, 44, 58 }, { 51, 44, 58 }, { 20, 20, 20 } }) do
    distances[#distances + 1] = num(P.NiveauParDistance(z, d[1], d[2], d[3]))
  end
end
mettre("ennemis_distances", "[" .. table.concat(distances, ",") .. "]")
local ennemis = {}
for _, c in ipairs(${luaListe(CLASSES)}) do
  local sorts = P.SortsPourClasse(Spells.SPELL_CATALOG, c)
  local ids = {}
  for _, sp in ipairs(sorts) do ids[#ids + 1] = q(sp.id) end
  local principal = P.SortPrincipal(sorts)
  for _, n in ipairs({ 1, 5, 20, 30, 50 }) do
    for _, r in ipairs({ "mob", "boss" }) do
      local e = P.StatistiquesEnnemi({ class_id = c, niveau = n, rang = r, sorts = sorts })
      ennemis[#ennemis + 1] = "[" .. q(c) .. "," .. num(n) .. "," .. q(r) .. "," .. num(e.vie_max) .. "," .. num(e.degats)
        .. "," .. num(e.defense) .. "," .. num(e.resistance) .. "," .. num(e.cadence_ms) .. "," .. num(e.echelle)
        .. "," .. num(e.xp) .. "," .. q(principal and principal.id or "") .. ",[" .. table.concat(ids, ",") .. "]]"
    end
  end
end
mettre("ennemis_stats", "[" .. table.concat(ennemis, ",") .. "]")
local inconnue = P.StatistiquesEnnemi({ class_id = "classe_fantome", niveau = 0, rang = "elite" })
mettre("ennemi_defauts", "[" .. q(inconnue.rang) .. "," .. num(inconnue.niveau) .. "," .. num(inconnue.vie_max) .. "," .. num(inconnue.defense) .. "]")

return "{" .. table.concat(out, ",") .. "}"
`);
const L = JSON.parse(brut);
lua.global.close();

// ── 4. Comparaisons ─────────────────────────────────────────────────────────
vrai(L.non_configure_leve === true, "non configuré : NiveauMax lève");
vrai(/non configuree/.test(L.non_configure_message), "non configuré : le message le dit");
egal(L.max, ts.MAX_LEVEL, "NiveauMax = MAX_LEVEL");

for (let l = 1; l <= ts.MAX_LEVEL; l++) {
  const attendu = ts.xpForLevel(l);
  egal(L.courbe[l - 1], attendu === Infinity ? "inf" : attendu, `xpForLevel(${l})`);
}

let i = 0;
for (const [niveau, xp] of DEPARTS) {
  for (const gain of GAINS) {
    const base = { ...ts.createStats(CLASSES[0], niveau), xp };
    const apres = ts.addXp(base, gain);
    const [n, x, gagnes] = L.cascades[i++];
    egal([n, x], [apres.level, apres.xp], `addXp(L${niveau} xp${xp}, +${gain})`);
    egal(gagnes, apres.level - niveau, `niveaux gagnés (L${niveau}, +${gain})`);
  }
}

for (let l = 1; l <= 60; l++) egal(L.kills[l - 1], ts.xpForKill(l), `xpForKill(${l})`);

ZONES.forEach((z, k) => egal(L.zones[k], ts.zoneLevelRange(z), `zoneLevelRange(${z})`));

i = 0;
for (const c of CLASSES) {
  for (const n of NIVEAUX_STATS) {
    for (const t of JEUX_TALENTS) {
      const eff = ts.effectiveStats({ ...ts.createStats(c, n), talents: t }, {});
      const vitesse = (ts.CLASSES[c].baseStats.moveSpeed ?? 1) * ts.aggregateTalents(t).moveSpeedMult;
      const [vie, mana, puissance, defense, critique, v, dmul, cmul, rmul, mmax, bdef, bcrit] = L.stats[i++];
      const t_ag = ts.aggregateTalents(t);
      const nom = `${c} L${n} ${JSON.stringify(t)}`;
      egal(vie, eff.maxHp, `maxHp ${nom}`);
      egal(mana, eff.maxMana, `maxMana ${nom}`);
      egal(puissance, eff.puissance, `puissance ${nom}`);
      egal(defense, eff.defense, `defense ${nom}`);
      egal(critique, eff.critique, `critique ${nom}`);
      egal(v, vitesse, `vitesse ${nom}`);
      // Formule de handleCastSpell (RpgGameWorld.tsx) : base × (1 + puissance/100)
      // × talentDmgMult, élément et bonus de vaisseau à 1 (absents de nanos).
      egal(dmul, (1 + eff.puissance / 100) * t_ag.damageMult, `degats_mult ${nom}`);
      egal(cmul, t_ag.manaCostMult, `cout_mult ${nom}`);
      egal(rmul, t_ag.manaRegenMult, `regen_mult ${nom}`);
      egal(mmax, eff.maxMana, `mana_max des sorts ${nom}`);
      egal(bdef, t_ag.defenseFlat, `bonus défense combat ${nom}`);
      egal(bcrit, t_ag.critFlat, `bonus critique combat ${nom}`);
    }
  }
}

SEQUENCES.forEach((seq, s) => {
  let etat = { ...ts.createStats(CLASSES[0], seq.niveau), talents: {} };
  seq.gestes.forEach(([g, id], k) => {
    if (g === "+") etat = ts.investTalent(etat, id);
    else if (g === "-") etat = ts.refundTalent(etat, id);
    else etat = ts.resetTalents(etat);
    const attendu = [...IDS_TALENTS.map((t) => etat.talents[t] ?? 0), ts.talentPointsAvailable(etat)];
    egal(L.sequences[s][k], attendu, `séquence ${s} geste ${k} (${g}${id})`);
  });
});

egal(L.fiche_max, [0, 1, true, 0], "Fiche au max : cible 0, progression 1, XP 0");
egal(L.fiche_1, [80, 0.5, 40], "Fiche L1 40 XP");
egal(L.fiche_12_cumulee, Array.from({ length: 11 }, (_, k) => ts.xpForLevel(k + 1)).reduce((a, b) => a + b, 0) + 5, "XP cumulée L12");
vrai(L.classe_inconnue === true, "classe inconnue : nil");
egal(L.normaliser_bas, [1, 0], "Normaliser borne en bas");
egal(L.normaliser_haut, [ts.MAX_LEVEL, 0], "Normaliser borne en haut (XP 0 au max)");
egal(L.talents_valides, [3, true, true, 2], "TalentsValides : rang borné, inconnu et zéro retirés, entier");
egal(L.niveau_ennemi, [1, 30, 20, 10, 12], "NiveauEnnemi : bas de plage, bornage, déclaré");
egal(L.reinit_vide, [false, "Aucun point investi"], "réinitialiser sans point : refus nommé");
egal(L.geste_inconnu, [false, "Geste inconnu"], "geste inconnu refusé");
egal(L.vue, [1, 1, 0, 10, 4, IDS_TALENTS.length, true, false], "VueTalents L7 dmg_sharp=1");
egal(L.vue_max_prochain, false, "VueTalents au max : pas de prochain point");
egal(L.equipement, [7, 3, 2, true, true, 7, 3], "equipement : puissance, defense, critique a plat, PV et mana augmentes, bonus de combat");

// ── Ennemis par niveau (2026-09-15) : parité avec npcLeveling.ts, Npc.tsx, npcStatPresets.ts ──
for (let l = 1; l <= 60; l++) {
  const [vie, deg, couleur] = L.ennemis_mults[l - 1];
  egal(vie, ts.enemyHpMultiplier(l), `enemyHpMultiplier(${l})`);
  egal(deg, ts.enemyDamageMultiplier(l), `enemyDamageMultiplier(${l})`);
  egal(couleur, ts.levelTierColor(l), `levelTierColor(${l})`);
}
{
  let k = 0;
  for (const z of ZONES) {
    for (const [d, dmin, dmax] of [[0, 10, 50], [10, 10, 50], [30, 10, 50], [50, 10, 50], [80, 10, 50], [44, 44, 58], [51, 44, 58], [20, 20, 20]]) {
      egal(L.ennemis_distances[k++], ts.levelFromDistance(z, d, dmin, dmax), `levelFromDistance(${z}, ${d}, ${dmin}, ${dmax})`);
    }
  }
}
// Assemblage de Npc.tsx, recalculé ici depuis les fonctions EXPORTÉES du TS :
// PV = round(hp × enemyHpMultiplier × hpMult) ; dégâts = (sort principal ?? attackPower) × 0,35 ×
// enemyDamageMultiplier ; défense = round(defense × (1 + (L−1) × 0,05)) ; cadence = max(cooldown ?? 1,6 ; 1,8).
for (const [c, n, r, vie, degats, defense, resistance, cadence, echelle, xp, principal, ids] of L.ennemis_stats) {
  const nom = `${c} L${n} ${r}`;
  const base = (ts.CLASSES[c] ?? ts.CLASSES.warrior_bruiser).baseStats;
  const sorts = ts.getSpellsForClass(c);
  egal(ids, sorts.map((sp) => sp.id), `getSpellsForClass ${c}`);
  const proj = sorts.find((sp) => sp.archetype === "projectile" && sp.damage > 0);
  const prim = proj ?? sorts.find((sp) => sp.damage > 0) ?? null;
  egal(principal, prim ? prim.id : "", `pickPrimaryAttackSpell ${c}`);
  const preset = r === "boss" ? ts.BOSS_STATS : ts.MOB_STATS;
  egal(vie, Math.max(1, Math.round(base.hp * ts.enemyHpMultiplier(n) * preset.hpMult)), `vie_max ${nom}`);
  egal(degats, (prim?.damage ?? base.attackPower) * 0.35 * ts.enemyDamageMultiplier(n), `degats ${nom}`);
  egal(defense, Math.round(base.defense * (1 + (n - 1) * 0.05)), `defense ${nom}`);
  egal(resistance, ts.clampResist(preset.resistMult), `resistance ${nom}`);
  egal(cadence, Math.round(Math.max(prim?.cooldown ?? 1.6, 1.8) * 1000), `cadence ${nom}`);
  egal(echelle, preset.scaleMult, `echelle ${nom}`);
  egal(xp, ts.xpForKill(n), `xp ${nom}`);
}
egal(L.ennemi_defauts, ["mob", 1, Math.round(ts.CLASSES.warrior_bruiser.baseStats.hp * ts.enemyHpMultiplier(1)), ts.CLASSES.warrior_bruiser.baseStats.defense],
  "classe inconnue -> bruiser, niveau 0 -> 1, rang inconnu -> mob");

fs.rmSync(dossier, { recursive: true, force: true });
console.log(`progression : ${reussis} reussi(s), ${echecs} echec(s)`);
if (echecs > 0) process.exitCode = 1;