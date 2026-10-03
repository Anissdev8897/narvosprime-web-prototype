// reapparition.mjs — harnais de Logic/Reapparition.lua (retour en jeu d'un joueur
// mort) contre le VRAI catalogue des mondes et les VRAIES règles de départ.
//
//   node scripts/lua-harness/reapparition.mjs
//
// Prouve les RÈGLES (cité d'abord, repli, délai, vie, mana). Le relèvement réel
// (`Respawn`, `SetHealth`) ne se voit qu'en jeu — journal « [REAPPARITION] … ».
import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const SHARED = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";
const regles = fs.readFileSync(`${SHARED}/Logic/Reapparition.lua`, "utf8");
const mondes = fs.readFileSync(`${SHARED}/Catalogs/Mondes.lua`, "utf8");

const factory = new LuaFactory();
const lua = await factory.createEngine();
let reussis = 0;
let echecs = 0;
lua.global.set("verifier", (cond, msg) => {
  if (cond) reussis += 1;
  else { echecs += 1; console.error("ECHEC :", msg); }
});
lua.global.set("REGLES_TEXTE", regles);
lua.global.set("MONDES_TEXTE", mondes);

const script = `
-- Le catalogue construit des Vector et des Color : bouchons à champs nommés.
Vector = function(x, y, z) return { X = x or 0, Y = y or 0, Z = z or 0 } end
Color = function(r, g, b, a) return { R = r, G = g, B = b, A = a } end
Rotator = function(p, y, r) return { Pitch = p or 0, Yaw = y or 0, Roll = r or 0 } end
Package = { Require = function() return {} end }

local R = load(REGLES_TEXTE)()
local Mondes = load(MONDES_TEXTE)()
-- Recevable = proposable au depart (la regle de Logic/Depart.lua, reduite a sa forme).
local function recevable(id) local m = Mondes.Trouver(id); return m ~= nil and m.depart ~= false end

local forge = Mondes.Trouver("forge")
local foret = Mondes.Trouver("foret")
local capitale = Mondes.Trouver("capitale")
verifier(forge and foret and capitale, "catalogue : forge, foret et capitale existent")

-- 1. La CITE d'abord (sans zaap), meme mort ailleurs.
local mort_forge = Vector(forge.arrivee.X + 3000, forge.arrivee.Y - 2000, forge.arrivee.Z - 3300)
local p, id = R.Point(Mondes, { cite = "foret", recevable = recevable, position = mort_forge, defaut = "capitale" })
verifier(id == "foret" and p == foret.arrivee, "cite foret, mort a la Forge -> arrivee de la foret (" .. tostring(id) .. ")")

-- 2. Cite retiree du depart (la Forge) : on ne revient pas la ; monde de la mort.
p, id = R.Point(Mondes, { cite = "forge", recevable = recevable, position = Mondes.CENTRES.tower, defaut = "capitale" })
verifier(id == "tower", "cite retiree du depart -> monde ou le corps est tombe (" .. tostring(id) .. ")")

-- 3. Cite inconnue ou absente : monde de la mort.
p, id = R.Point(Mondes, { cite = "monde_inexistant", recevable = recevable, position = Mondes.CENTRES.alien, defaut = "capitale" })
verifier(id == "alien", "cite inconnue -> monde de la mort")
p, id = R.Point(Mondes, { position = Mondes.CENTRES.capitale, defaut = "tower" })
verifier(id == "capitale" and p == capitale.arrivee, "sans cite -> monde de la mort")

-- 4. Rien d'autre : le defaut.
local sans_position = { Trouver = Mondes.Trouver, ParPosition = function() return nil end }
p, id = R.Point(sans_position, { cite = nil, defaut = "capitale" })
verifier(id == "capitale" and p == capitale.arrivee, "ni cite ni position -> defaut")

-- Chaque monde avec arrivee est une cite possible.
for _, m in ipairs(Mondes.MONDES) do
    if (m.arrivee and m.depart ~= false) then
        local pm, idm = R.Point(Mondes, { cite = m.id, recevable = recevable, position = Vector(0, 0, 0), defaut = "capitale" })
        verifier(idm == m.id and pm == m.arrivee, "cite " .. m.id .. " -> son arrivee")
    end
end

-- Sans recevable fourni : la cite est prise telle quelle si elle existe.
p, id = R.Point(Mondes, { cite = "forge", defaut = "capitale" })
verifier(id == "forge", "sans regle de recevabilite : la cite existante est retenue")

-- Entrees degradees.
verifier(R.Point(nil, { cite = "foret" }) == nil, "catalogue absent -> nil")
verifier(R.Point({}, { cite = "foret", defaut = "capitale" }) == nil, "catalogue vide -> nil")
p, id = R.Point(Mondes, nil)
verifier(p == nil and id == nil, "options absentes, pas de defaut -> nil")

-- Delai minimal avant /revive.
local ok1, reste1 = R.PeutRevenir(1000, 1500)
verifier(ok1 == false and reste1 == R.DELAI_MIN_MS - 500, "mort depuis 0,5 s : refuse, reste " .. tostring(reste1))
local ok2, reste2 = R.PeutRevenir(1000, 1000 + R.DELAI_MIN_MS)
verifier(ok2 == true and reste2 == 0, "delai ecoule : autorise")
verifier(R.PeutRevenir(nil, 5000) == false, "pas mort (nil) : refuse")
verifier(R.PeutRevenir(9000, 5000) == false, "horloge qui recule : refuse, pas de reste negatif")
verifier(select(2, R.PeutRevenir(9000, 5000)) == R.DELAI_MIN_MS, "horloge qui recule : reste plein")

-- Vie : moitié, jamais sous 1.
verifier(R.Vie(132) == 66, "vie : 132 -> 66")
verifier(R.Vie(1) == 1, "vie : 1 -> 1 (plancher)")
verifier(R.Vie(0) == 1 and R.Vie(-5) == 1, "vie : max nul ou negatif -> 1")
verifier(R.Vie(nil) == 1 and R.Vie("abc") == 1 and R.Vie(0/0) == 1, "vie : valeur illisible -> 1")
verifier(R.Vie(math.huge) == 1, "vie : infini -> 1")
verifier(R.Vie("200") == 100, "vie : chaine numerique acceptee")

-- Mana : 30 %, jamais negatif.
verifier(R.Mana(119) == 35, "mana : 119 -> 35")
verifier(R.Mana(0) == 0 and R.Mana(-3) == 0 and R.Mana(nil) == 0, "mana : nul/negatif/absent -> 0")

-- ── D4 : le dernier Zaap active passe AVANT la cite (2026-09-15) ───────────
local pos_zaap = Vector(foret.arrivee.X + 1234, foret.arrivee.Y, foret.arrivee.Z)
local pz, idz, src = R.Point(Mondes, { zaap = { position = pos_zaap, monde = "foret" }, cite = "capitale",
    recevable = recevable, position = Mondes.CENTRES.alien, defaut = "capitale" })
verifier(pz == pos_zaap and idz == "foret" and src == "zaap", "zaap active -> sa position, avant la cite (" .. tostring(src) .. ")")
-- Zaap dans un monde RETIRE du depart : Hanibes l'a pose, il reste valable.
pz, idz, src = R.Point(Mondes, { zaap = { position = pos_zaap, monde = "forge" }, cite = "foret", recevable = recevable })
verifier(src == "zaap" and idz == "forge", "zaap pose dans un monde hors depart : toujours retenu")
-- Zaap supprime depuis (l'executant ne resout rien) : retour a la cite.
pz, idz, src = R.Point(Mondes, { zaap = nil, cite = "foret", recevable = recevable, position = Mondes.CENTRES.alien, defaut = "capitale" })
verifier(idz == "foret" and src == "cite", "sans zaap -> cite choisie au depart (" .. tostring(src) .. ")")
-- Zaap mal forme (pas de position) : ignore, jamais une arrivee nil.
pz, idz, src = R.Point(Mondes, { zaap = { monde = "foret" }, cite = "capitale", recevable = recevable, defaut = "capitale" })
verifier(src == "cite" and pz == capitale.arrivee, "zaap sans position -> ignore")
pz, idz, src = R.Point(Mondes, { zaap = "foret", cite = "capitale", recevable = recevable, defaut = "capitale" })
verifier(src == "cite", "zaap qui n'est pas une table -> ignore")
-- Les sources des autres branches.
pz, idz, src = R.Point(Mondes, { cite = "monde_inexistant", position = Mondes.CENTRES.alien, defaut = "capitale" })
verifier(src == "mort" and idz == "alien", "source mort")
pz, idz, src = R.Point(sans_position, { defaut = "capitale" })
verifier(src == "defaut" and idz == "capitale", "source defaut")
verifier(select(3, R.Point(nil, {})) == nil, "catalogue absent -> source nil")

-- ── D4 : reapparition automatique ────────────────────────────────────────────
verifier(R.DELAI_AUTO_MS > R.DELAI_MIN_MS, "l'automatique attend PLUS que le manuel (sinon le bouton ne sert a rien)")
verifier(R.DELAI_AUTO_MS <= 30000, "automatique borne : on ne croit pas le jeu fige")
local due1, reste_a = R.Automatique(1000, 1000 + R.DELAI_AUTO_MS - 250)
verifier(due1 == false and reste_a == 250, "automatique : pas encore due, reste 250 ms (" .. tostring(reste_a) .. ")")
local due2, reste_b = R.Automatique(1000, 1000 + R.DELAI_AUTO_MS)
verifier(due2 == true and reste_b == 0, "automatique : due au delai exact")
verifier(R.Automatique(nil, 99999) == false, "automatique : pas mort -> jamais due")
verifier(select(2, R.Automatique(9000, 5000)) == R.DELAI_AUTO_MS, "automatique : horloge qui recule -> reste plein")
verifier(R.Automatique("abc", 5000) == false and R.Automatique(1000, 0/0) == false, "automatique : valeurs illisibles -> non due")

verifier(R.FRACTION_VIE == 0.5 and R.FRACTION_MANA == 0.3, "fractions du jeu web (50 % / 30 %)")
verifier(R.DELAI_MIN_MS > 0 and R.DELAI_MIN_MS <= 10000, "delai minimal borne")
`;

try {
  await lua.doString(script);
} catch (e) {
  echecs += 1;
  console.error("ERREUR LUA :", e.message);
}
lua.global.close();
console.log(`reapparition : ${reussis} assertion(s) reussie(s), ${echecs} echec(s)`);
process.exitCode = echecs > 0 ? 1 : 0;