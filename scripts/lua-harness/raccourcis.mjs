// ══════════════════════════════════════════════════════════════════════════════
// raccourcis.mjs — exécute les tests de Shared/Logic/Raccourcis.lua.
//
//   node scripts/lua-harness/raccourcis.mjs
//
// Raccourcis dépend du catalogue Emotes (pour refuser une animation inconnue) et
// de la classe `Database` de nanos. Le premier est posé dans le global `Narvos`,
// la seconde injectée par `Raccourcis.UtiliserBase`.
//
// La fausse base reproduit `INSERT OR REPLACE` et le `DELETE ... AND compte_id`.
// Ce second point est le seul qui compte vraiment : sans lui, le test de retrait
// croisé passerait au vert alors que n'importe quel joueur pourrait effacer les
// raccourcis d'un autre.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const emotes = fs.readFileSync(`${BASE}/Catalogs/Emotes.lua`, "utf8");
const raccourcis = fs.readFileSync(`${BASE}/Logic/Raccourcis.lua`, "utf8");
const tests = fs.readFileSync(new URL("./raccourcis-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
Narvos = {}
Narvos.Emotes = (function()
${emotes}
end)()

-- ── Fausse base ───────────────────────────────────────────────────────────────
function FausseBaseRaccourcis()
    local base = { lignes = {} }

    local function cle(compte, touche) return tostring(compte) .. "|" .. tostring(touche) end

    --- Pose une ligne SANS passer par la validation du module : c'est le seul
    --- moyen de simuler une animation retirée du catalogue après coup.
    function base:Injecter(compte, touche, anim)
        self.lignes[cle(compte, touche)] = { compte_id = compte, touche = touche, anim_id = anim }
    end

    function base:Execute(sql, ...)
        local a = { ... }

        if (sql:find("INSERT OR REPLACE INTO raccourcis", 1, true)) then
            self.lignes[cle(a[1], a[2])] = { compte_id = a[1], touche = a[2], anim_id = a[3] }
            return 1
        end

        if (sql:find("DELETE FROM raccourcis", 1, true)) then
            -- Reproduit le WHERE du module : compte_id ET touche. Ignorer le
            -- premier rendrait le test de retrait croisé vert à tort.
            local k = cle(a[1], a[2])
            if (self.lignes[k]) then
                self.lignes[k] = nil
                return 1
            end
            return 0
        end

        return 0
    end

    function base:Select(sql, ...)
        local a = { ... }
        local trouve = {}
        if (sql:find("FROM raccourcis", 1, true)) then
            -- Ordre stable : le module trie par touche, on l'imite pour que les
            -- tests ne dépendent pas de l'ordre de \`pairs\`.
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

local Raccourcis = (function()
${raccourcis}
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