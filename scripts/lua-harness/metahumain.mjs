// metahumain.mjs — harnais de Logic/MetaHumain.lua (la tenue MetaHuman, pure)
// et des invariants du catalogue GÉNÉRÉ Catalogs/MetaHumain.lua.
//
//   node scripts/lua-harness/metahumain.mjs
//
// Il prouve que les RÈGLES sont justes, jamais que le pont TOURNE : ça, seul le
// jeu le dit (journal « [METAHUMAIN] pose … » et l'écran).
import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const SHARED = "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";
const logique = fs.readFileSync(`${SHARED}/Logic/MetaHumain.lua`, "utf8");
const cheminCatalogue = `${SHARED}/Catalogs/MetaHumain.lua`;
const catalogueReel = fs.existsSync(cheminCatalogue) ? fs.readFileSync(cheminCatalogue, "utf8") : null;

const factory = new LuaFactory();
const lua = await factory.createEngine();
let reussis = 0;
let echecs = 0;
lua.global.set("verifier", (cond, msg) => {
  if (cond) reussis += 1;
  else { echecs += 1; console.error("ECHEC :", msg); }
});
lua.global.set("REEL", catalogueReel !== null);

const script = `
local MH = (function()
${logique}
end)()

local CAT = {
  SLOTS = { "corps", "haut", "bas", "pieds", "tenue" },
  SLOT_CORPS = "corps",
  REMPLACE = { tenue = { "haut", "bas" }, haut = { "tenue" }, bas = { "tenue" } },
  PIECES = {
    corps_f = { slot = "corps", genre = "F", label = "Corps F", cuit = true, blueprint = "narvos::A" },
    corps_m = { slot = "corps", genre = "M", label = "Corps M", cuit = true, blueprint = "narvos::B" },
    haut_f = { slot = "haut", genre = "F", label = "Haut F", cuit = true, blueprint = "narvos::C" },
    bas_f = { slot = "bas", genre = "F", label = "Bas F", cuit = true, blueprint = "narvos::D" },
    tenue_f = { slot = "tenue", genre = "F", label = "Tenue F", cuit = true, blueprint = "narvos::E" },
    haut_m = { slot = "haut", genre = "M", label = "Haut M", cuit = true, blueprint = "narvos::F" },
    pieds_x = { slot = "pieds", genre = "*", label = "Bottes", cuit = true, blueprint = "narvos::G" },
    haut_cru = { slot = "haut", genre = "F", label = "Cru", cuit = false, blueprint = "narvos::H" },
  },
}

-- Sans catalogue, tout refuse EN LE DISANT.
local t, r = MH.Equiper({}, "haut_f")
verifier(t == nil and r ~= nil and r:find("catalogue") ~= nil, "refus nomme sans catalogue")
verifier(MH.Configurer(nil) == false, "Configurer(nil) refuse")
verifier(MH.Configurer({ PIECES = {} }) == false, "Configurer sans SLOTS refuse")
verifier(MH.Configurer(CAT) == true, "Configurer(CAT)")

t, r = MH.Equiper({}, "rien")
verifier(t == nil and r:find("inconnue") ~= nil, "piece inconnue nommee")
t, r = MH.Equiper({}, "haut_cru")
verifier(t == nil and r:find("non cuite") ~= nil, "piece non cuite nommee")

-- Un vetement sans corps amene le premier corps cuit de son genre.
t = MH.Equiper({}, "haut_f")
verifier(t ~= nil and t.corps == "corps_f" and t.haut == "haut_f", "corps pose avec le vetement")
t = MH.Equiper(nil, "bas_f")
verifier(t ~= nil and t.corps == "corps_f", "tenue nil acceptee")

-- La tenue d'origine n'est jamais modifiee.
local avant = { corps = "corps_f" }
local apres = MH.Equiper(avant, "bas_f")
verifier(avant.bas == nil and apres.bas == "bas_f", "tenue d'origine intacte")

t, r = MH.Equiper({ corps = "corps_f" }, "haut_m")
verifier(t == nil and r:find("sur un corps") ~= nil, "genre croise refuse")
t = MH.Equiper({ corps = "corps_m" }, "pieds_x")
verifier(t ~= nil and t.pieds == "pieds_x", "piece mixte acceptee sur l'autre genre")

t = MH.Equiper({ corps = "corps_f", haut = "haut_f", bas = "bas_f" }, "tenue_f")
verifier(t.tenue == "tenue_f" and t.haut == nil and t.bas == nil, "tenue complete remplace haut et bas")
t = MH.Equiper({ corps = "corps_f", tenue = "tenue_f" }, "haut_f")
verifier(t.haut == "haut_f" and t.tenue == nil, "haut retire la tenue complete")
t = MH.Equiper({ corps = "corps_f", tenue = "tenue_f" }, "pieds_x")
verifier(t.tenue == "tenue_f" and t.pieds == "pieds_x", "chaussures gardent la tenue complete")

t = MH.Equiper({ corps = "corps_f", haut = "haut_f", pieds = "pieds_x" }, "corps_m")
verifier(t.corps == "corps_m" and t.haut == nil and t.pieds == "pieds_x", "changer de corps retire l'autre genre, garde le mixte")

t = MH.Retirer({ corps = "corps_f", haut = "haut_f" }, "haut")
verifier(t.corps == "corps_f" and t.haut == nil, "retirer un slot")
t = MH.Retirer({ corps = "corps_f", haut = "haut_f" }, "corps")
verifier(next(t) == nil, "retirer le corps retire tout")

local l = MH.Liste({ tenue = "tenue_f", corps = "corps_f", pieds = "pieds_x" })
verifier(#l == 3 and l[1].slot == "corps" and l[2].slot == "pieds" and l[3].slot == "tenue", "liste dans l'ordre des slots")
verifier(#MH.Liste(nil) == 0, "liste de nil vide")

local ret, pos = MH.Differences({ corps = "corps_f", haut = "haut_f" }, { corps = "corps_f", bas = "bas_f" })
verifier(#ret == 1 and ret[1] == "haut" and #pos == 1 and pos[1] == "bas", "differences : un retrait, une pose")
ret, pos = MH.Differences({ corps = "corps_f" }, { corps = "corps_m" })
verifier(#ret == 1 and #pos == 1 and ret[1] == "corps" and pos[1] == "corps", "piece changee : retirer PUIS poser")
ret, pos = MH.Differences({ corps = "corps_f" }, { corps = "corps_f" })
verifier(#ret == 0 and #pos == 0, "tenue identique : rien a faire")

local code = MH.Encoder({ haut = "haut_f", corps = "corps_f" })
verifier(code == "corps=corps_f;haut=haut_f", "encodage ordonne : " .. code)
local dec = MH.Decoder("corps=corps_f;haut=haut_f;bas=inconnu;pieds=haut_f")
verifier(dec.corps == "corps_f" and dec.haut == "haut_f" and dec.bas == nil and dec.pieds == nil,
  "decodage ecarte l'inconnu et la piece hors de son slot")
verifier(next(MH.Decoder(nil)) == nil and next(MH.Decoder("")) == nil, "decodage de nil et du vide")
local aller = MH.Decoder(MH.Encoder({ corps = "corps_f", tenue = "tenue_f", pieds = "pieds_x" }))
verifier(aller.corps == "corps_f" and aller.tenue == "tenue_f" and aller.pieds == "pieds_x", "aller-retour du codec")

local c = MH.Choix("F")
verifier(#c == 5 and c[1].slot == "corps" and c[5].slot == "tenue", "choix : un bloc par slot, dans l'ordre")
verifier(#c[2].pieces == 2 and c[2].pieces[1].id == "haut_cru" and c[2].pieces[1].cuit == false,
  "choix F : haut_cru (signale non cuit) et haut_f, pas haut_m")
verifier(#MH.Choix("M")[4].pieces == 1, "choix M : la piece mixte figure")
verifier(#MH.Choix(nil)[2].pieces == 3, "choix sans genre : tout")

-- Le catalogue GENERE, s'il existe : ses invariants.
if REEL then
  local R = (function()
${catalogueReel ?? ""}
  end)()
  verifier(type(R.PIECES) == "table" and type(R.SLOTS) == "table", "catalogue reel : PIECES et SLOTS")
  local slots = {}
  for _, s in ipairs(R.SLOTS) do slots[s] = true end
  verifier(slots[R.SLOT_CORPS] == true, "SLOT_CORPS figure dans SLOTS")
  verifier(type(R.OS_ATTACHE) == "string" and #R.OS_ATTACHE > 0, "OS_ATTACHE renseigne")
  for s, liste in pairs(R.REMPLACE or {}) do
    verifier(slots[s] == true, "REMPLACE : slot connu " .. s)
    for _, x in ipairs(liste) do verifier(slots[x] == true, "REMPLACE " .. s .. " -> " .. x) end
  end
  local corps = 0
  for id, p in pairs(R.PIECES) do
    verifier(slots[p.slot] == true, id .. " : slot connu")
    verifier(type(p.blueprint) == "string" and p.blueprint:find("^narvos::BP_NarvosMH_") ~= nil, id .. " : blueprint narvos::BP_NarvosMH_")
    verifier(p.genre == "F" or p.genre == "M" or p.genre == "*", id .. " : genre")
    verifier(type(p.label) == "string" and #p.label > 0, id .. " : libelle")
    verifier(type(p.cuit) == "boolean", id .. " : cuit booleen")
    if (p.slot == R.SLOT_CORPS) then corps = corps + 1 end
  end
  verifier(corps >= 1, "au moins un corps au catalogue")
  verifier(MH.Configurer(R) == true, "Configurer(catalogue reel)")
end
`;

try {
  await lua.doString(script);
} catch (e) {
  echecs += 1;
  console.error("ERREUR LUA :", e.message);
} finally {
  lua.global.close();
}

console.log(`${reussis} reussi(s), ${echecs} echec(s)${catalogueReel ? "" : " (catalogue genere absent : regles seules)"}`);
if (echecs > 0 || reussis === 0) process.exitCode = 1;