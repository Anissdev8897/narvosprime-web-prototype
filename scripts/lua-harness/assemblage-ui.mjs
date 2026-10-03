import { RACINE_DEPOT } from "./_racine.mjs";
// ══════════════════════════════════════════════════════════════════════════════
// assemblage-ui.mjs — harnais d'intégration de l'établi d'assemblage.
//
//   node scripts/lua-harness/assemblage-ui.mjs
//
// Ce qu'il prouve : la chaîne COMPLÈTE handler → Narvos.Assemblage → réponse,
// avec les VRAIS fichiers, jamais des copies :
//
//   Shared/Logic/Inventory.lua          réel
//   Shared/Logic/Assemblage.lua         réel (le modèle, 201 assertions ailleurs)
//   narvos-map-proto/Server/Assemblage.lua  réel (l'exécutant serveur, CE chantier)
//
// L'API nanos est bouchonnée (Events capturés, Trigger simulé, Session factice).
// Les plans des scénarios de comportement sont bouchonnés dans le fichier de
// tests — la mission interdit d'écrire une liste de plans en dur ailleurs.
// Le VRAI catalogue du chantier B (`Shared/Catalogs/Plans.lua` + `Items.lua`),
// s'il est livré, est chargé depuis son fichier — jamais recopié — et validé
// en fin de harnais : chaque plan livré doit passer le modèle et être proposé
// par l'exécutant, comme en production.
//
// ⚠ Un harnais qui ne trouve pas sa cible doit ÉCHOUER, pas rendre vert.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const SHARED =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos/Shared";
const SERVEUR =
  RACINE_DEPOT + "/WebPortal/Server/nanos_world/packages/narvos-map-proto/Server";

const CIBLES = [
  `${SHARED}/Logic/Inventory.lua`,
  `${SHARED}/Logic/Assemblage.lua`,
  `${SERVEUR}/Assemblage.lua`,
  `${SHARED}/Catalogs/Ateliers.lua`,
];
for (const c of CIBLES) {
  if (!fs.existsSync(c) || fs.readFileSync(c, "utf8").trim().length === 0) {
    console.error(`CIBLE ABSENTE OU VIDE : ${c}`);
    process.exit(1);
  }
}
const TESTS = "assemblage-ui-tests.lua";
if (!fs.existsSync(new URL(`./${TESTS}`, import.meta.url))) {
  console.error(`TESTS ABSENTS : ${TESTS}`);
  process.exit(1);
}

const inventaire = fs.readFileSync(`${SHARED}/Logic/Inventory.lua`, "utf8");
const assemblage = fs.readFileSync(`${SHARED}/Logic/Assemblage.lua`, "utf8");
const serveur = fs.readFileSync(`${SERVEUR}/Assemblage.lua`, "utf8");
const ateliers = fs.readFileSync(`${SHARED}/Catalogs/Ateliers.lua`, "utf8");
const tests = fs.readFileSync(new URL(`./${TESTS}`, import.meta.url), "utf8");

// Le VRAI catalogue du chantier B, s'il est livré (nil côté Lua sinon : la
// section finale est alors sautée à voix haute, jamais en silence).
const PLANS_REEL = `${SHARED}/Catalogs/Plans.lua`;
const ITEMS_REEL = `${SHARED}/Catalogs/Items.lua`;
const plansReel = fs.existsSync(PLANS_REEL) ? fs.readFileSync(PLANS_REEL, "utf8") : null;
const itemsReel = fs.existsSync(ITEMS_REEL) ? fs.readFileSync(ITEMS_REEL, "utf8") : null;

// Chaîne longue Lua au niveau d'égalité qui ne figure pas dans la source.
const luaLong = (src) => {
  let n = 0;
  while (src.includes("]" + "=".repeat(n) + "]")) n += 1;
  const eq = "=".repeat(n);
  return `[${eq}[\n${src}\n]${eq}]`;
};

const lua = await new LuaFactory().createEngine();

const script = `
-- ── Bouchons de l'API nanos ───────────────────────────────────────────────────
-- Events : les handlers distants sont CAPTURÉS (le test les appelle), les
-- envois ENREGISTRÉS (le test les vérifie). Reliability est un marqueur : les
-- envois serveur -> client le portent en 1er argument variable, comme en jeu.
ENVOIS = {}
HANDLERS = {}
LOGS_ERR = {}

Events = {
    SubscribeRemote = function(nom, fn) HANDLERS[nom] = fn end,
    CallRemote = function(nom, player, ...)
        ENVOIS[#ENVOIS + 1] = { nom = nom, player = player, args = { n = select("#", ...), ... } }
    end,
}
Reliability = { Reliable = 1, Unreliable = 0 }
Console = {
    Log = function(_) end,
    Warn = function(_) end,
    Error = function(m) LOGS_ERR[#LOGS_ERR + 1] = tostring(m) end,
}

-- Le monde : Prop compté, Trigger simulé (ses abonnements sont rejoués par le
-- test pour simuler l'entrée/sortie de zone — la leçon du 09/09 : l'assemblage
-- se déclenche par PROXIMITÉ, comme le craft).
PROPS_POSES = 0
TRIGGERS = {}
Prop = function(_) PROPS_POSES = PROPS_POSES + 1 return {} end
Trigger = function(_)
    local t = { abonnes = {} }
    function t:Subscribe(nom, fn) self.abonnes[nom] = fn end
    -- ATTENTION : IsValid existe sur toute Entity nanos. Le bouchon ne l'avait
    -- pas, et le jour ou PoserEtabli s'est mis a rendre un TEMOIN plutot qu'une
    -- promesse (« l'etabli est-il vraiment pose ? »), ce harnais est tombe sur
    -- « attempt to call a nil value (method 'IsValid') ». Un bouchon plus
    -- pauvre que l'API qu'il imite fait echouer du code correct.
    -- (Sans accent grave dans ce commentaire : il vit dans un littéral gabarit
    --  JS, ou un accent grave termine la chaine. Cinquieme occurrence.)
    function t:IsValid() return true end
    TRIGGERS[#TRIGGERS + 1] = t
    return t
end
Vector = function(x, y, z) return { X = x, Y = y, Z = z } end
Rotator = function(_) return {} end
CollisionType = { Normal = 1 }
TriggerType = { Sphere = 1 }

-- ── Fausse base : la ligne d'assemblage est indexée par proprietaire_id ──────
-- (même discipline qu'assemblage.mjs : ignorer le WHERE rendrait le
-- cloisonnement vert à tort).
function FausseBaseAssemblages()
    local base = { lignes = {} }

    function base:Execute(sql, ...)
        local a = { ... }
        if (sql:find("INSERT OR REPLACE INTO assemblages", 1, true)) then
            self.lignes[tostring(a[1])] = {
                proprietaire_id = a[1], plan_id = a[2], donnees = a[3] }
            return 1
        end
        if (sql:find("DELETE FROM assemblages", 1, true)) then
            local k = tostring(a[1])
            if (self.lignes[k]) then self.lignes[k] = nil return 1 end
            return 0
        end
        return 0
    end

    function base:Select(sql, ...)
        local a = { ... }
        local trouve = {}
        local l = self.lignes[tostring(a[1])]
        if (l) then trouve[1] = { plan_id = l.plan_id, donnees = l.donnees } end
        return trouve
    end

    return base
end

-- ── Les VRAIS modules ─────────────────────────────────────────────────────────
Narvos = {}
Narvos.Inventory = (function()
${inventaire}
end)()

-- Le VRAI catalogue des ateliers : PoserEtabli lui demande son mesh, et un
-- catalogue absent ferait echouer le harnais sur un nil au lieu de tester
-- la pose. Il est PUR (aucune API nanos), donc chargeable tel quel.
Narvos.Ateliers = (function()
${ateliers}
end)()

ASSEMBLAGE_SRC = ${luaLong(assemblage)}

Narvos.Assemblage = load(ASSEMBLAGE_SRC)()

BASE_FAUSSE = FausseBaseAssemblages()
Narvos.Assemblage.UtiliserBase(BASE_FAUSSE)

--- Recharge le modèle à neuf sur la MÊME base : un redémarrage de serveur —
--- la mémoire part, les lignes persistées restent.
function RechargerAssemblage()
    local m = load(ASSEMBLAGE_SRC)()
    m.UtiliserBase(BASE_FAUSSE)
    return m
end

-- L'exécutant serveur RÉEL : il s'abonne aux événements distants au chargement
-- (capturés dans HANDLERS) et reçoit ses dépendances par Brancher (dans le
-- fichier de tests, avec les factices de session et de catalogue).
AssemblageServeur = (function()
${serveur}
end)()

-- Le VRAI catalogue du chantier B (nil si non livré).
PLANS_REEL_SRC = ${plansReel ? luaLong(plansReel) : "nil"}
ITEMS_REEL_SRC = ${itemsReel ? luaLong(itemsReel) : "nil"}

${tests}
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
} finally {
  const reussis = lua.global.get("REUSSIS");
  if (process.exitCode !== 1 && (!reussis || reussis < 1)) {
    console.error("AUCUNE ASSERTION EXECUTEE — le harnais ne prouve rien.");
    process.exitCode = 1;
  }
  lua.global.close();
}