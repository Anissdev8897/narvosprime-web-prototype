// ══════════════════════════════════════════════════════════════════════════════
// commandes.mjs — exécute les tests de Shared/Logic/Commandes.lua.
//
//   node scripts/lua-harness/commandes.mjs
//
// `Commandes` ne dépend d'aucun catalogue : sa liste d'actions est écrite dans le
// fichier. Il ne lui manque que la classe `Database` de nanos, injectée par
// `UtiliserBase`.
//
// ── CE QUE LA FAUSSE BASE DOIT REPRODUIRE FIDÈLEMENT ──────────────────────────
//   · `INSERT OR REPLACE` sur la clé (compte_id, action_id) — c'est elle qui rend
//     la réassignation atomique ;
//   · le `compte_id` du WHERE — sans lui, le test « compte voisin intact »
//     passerait au vert alors qu'un joueur réécrirait les touches d'un autre.
//
// Reproduire l'un sans l'autre donnerait une suite verte sur un module cassé.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const commandes = fs.readFileSync(`${BASE}/Logic/Commandes.lua`, "utf8");
const tests = fs.readFileSync(new URL("./commandes-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
function FausseBaseCommandes()
    local base = { lignes = {} }

    local function cle(compte, action) return tostring(compte) .. "|" .. tostring(action) end

    --- Pose une ligne SANS passer par Definir : c'est le seul moyen de
    --- simuler une touche explicitement assignée AVANT l'arrivée d'une action
    --- nouvelle qui hérite de cette touche par défaut (TAB, 2026-09-08).
    function base:Injecter(compte, action, touche)
        self.lignes[cle(compte, action)] = { compte_id = compte, action_id = action, touche = touche }
    end

    function base:Execute(sql, ...)
        local a = { ... }

        if (sql:find("INSERT OR REPLACE INTO commandes", 1, true)) then
            self.lignes[cle(a[1], a[2])] = { compte_id = a[1], action_id = a[2], touche = a[3] }
            return 1
        end

        if (sql:find("DELETE FROM commandes", 1, true)) then
            -- Deux formes : avec action_id, et sans (reinitialisation globale).
            if (sql:find("action_id", 1, true)) then
                local k = cle(a[1], a[2])
                if (self.lignes[k]) then self.lignes[k] = nil return 1 end
                return 0
            end

            local n = 0
            for k, l in pairs(self.lignes) do
                if (l.compte_id == a[1]) then self.lignes[k] = nil n = n + 1 end
            end
            return n
        end

        return 0
    end

    function base:Select(sql, ...)
        local a = { ... }
        local trouve = {}
        if (sql:find("FROM commandes", 1, true)) then
            -- Ordre stable : les tests ne doivent pas dependre de l'ordre de
            -- \`pairs\`, qui varie d'une VM Lua a l'autre.
            local cles = {}
            for k, l in pairs(self.lignes) do
                if (l.compte_id == a[1]) then cles[#cles + 1] = k end
            end
            table.sort(cles)
            for _, k in ipairs(cles) do trouve[#trouve + 1] = self.lignes[k] end
        end
        return trouve
    end

    return base
end

local Commandes = (function()
${commandes}
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