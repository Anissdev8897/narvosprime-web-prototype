// ══════════════════════════════════════════════════════════════════════════════
// comptes.mjs — exécute les tests de Shared/Logic/Comptes.lua.
//
//   node scripts/lua-harness/comptes.mjs
//
// Comptes.lua dépend de Crypto.lua et de la classe `Database` de nanos. La
// première est fournie par le global `Narvos` ; la seconde n'existe pas hors
// moteur, et on l'injecte par `Comptes.UtiliserBase`.
//
// LA FAUSSE BASE N'ÉMULE PAS SQLite. Elle répond aux quatre requêtes réellement
// émises par le module et ENREGISTRE chaque appel. Émuler SQL reviendrait à
// tester l'émulateur ; ce qu'on veut vérifier, c'est que le module n'y met
// jamais de valeur joueur concaténée — et ça, le registre le prouve.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const crypto = fs.readFileSync(`${BASE}/Logic/Crypto.lua`, "utf8");
const comptes = fs.readFileSync(`${BASE}/Logic/Comptes.lua`, "utf8");
const tests = fs.readFileSync(new URL("./comptes-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
-- Le global que Comptes.lua cherche en premier : sa présence court-circuite
-- Package.Require, absent hors du moteur.
Narvos = { Crypto = (function()
${crypto}
end)() }

-- ── Fausse base ───────────────────────────────────────────────────────────────
--
-- Elle tient deux tables en mémoire et sait répondre aux SELECT du module. Tout
-- passe par \`args\`, jamais par la chaîne SQL : c'est ce que les tests vérifient.
function FausseBase()
    local base = { lignes = {}, suivant = 1, requetes = {} }

    function base:Execute(sql, ...)
        local args = { ... }
        self.requetes[#self.requetes + 1] = { sql = sql, args = args }

        if (sql:find("INSERT INTO comptes", 1, true)) then
            local ligne = { id = self.suivant }
            if (sql:find("steam_id, pseudo", 1, true)) then
                ligne.steam_id, ligne.pseudo, ligne.cree_le = args[1], args[2], args[3]
            else
                ligne.identifiant, ligne.hash, ligne.sel = args[1], args[2], args[3]
                ligne.iterations, ligne.pseudo, ligne.cree_le = args[4], args[5], args[6]
            end
            self.lignes[#self.lignes + 1] = ligne
            self.suivant = self.suivant + 1
            return 1
        end
        return 0
    end

    function base:Select(sql, ...)
        local args = { ... }
        self.requetes[#self.requetes + 1] = { sql = sql, args = args }

        local trouve = {}
        for _, l in ipairs(self.lignes) do
            if (sql:find("steam_id = :0", 1, true) and l.steam_id == args[1]) then
                trouve[#trouve + 1] = l
            elseif (sql:find("identifiant = :0", 1, true) and l.identifiant
                    and args[1] and l.identifiant:lower() == tostring(args[1]):lower()) then
                trouve[#trouve + 1] = l
            end
        end
        return trouve
    end

    return base
end

local Comptes = (function()
${comptes}
end)()

${tests}
`;

try {
  await lua.doString(script);
} catch (e) {
  console.error("ERREUR LUA:", e.message);
  process.exitCode = 1;
} finally {
  lua.global.close();
}