// ══════════════════════════════════════════════════════════════════════════════
// roster.mjs — exécute les tests de Shared/Logic/Roster.lua.
//
//   node scripts/lua-harness/roster.mjs
//
// Roster dépend de CharacterCreation (qui dépend lui-même de Classes et de
// Modular), de Vestiaire — pour la tenue offerte aux personnages neufs — et de
// la classe `Database` de nanos. Les modules sont posés dans le global
// `Narvos` ; la base est injectée par `Roster.UtiliserBase`.
//
// LA FAUSSE BASE tient une liste de lignes en mémoire et interprète les quatre
// requêtes émises par le module. Elle n'émule pas SQL — elle reproduit juste
// assez de comportement pour que les chemins de `Roster` soient réellement
// parcourus, y compris celui qui compte le plus : le `DELETE ... AND compte_id`
// qui empêche un joueur d'effacer le personnage d'un autre.
// ══════════════════════════════════════════════════════════════════════════════

import { LuaFactory } from "wasmoon";
import fs from "node:fs";

const BASE =
  "E:/narvosprime-web-prototype/WebPortal/Server/nanos_world/packages/narvos/Shared";

const lire = (p) => fs.readFileSync(`${BASE}/${p}`, "utf8");

const classes = lire("Catalogs/Classes.lua");
const modular = lire("Catalogs/Modular.lua");
const creation = lire("Logic/CharacterCreation.lua");
const vestiaire = lire("Logic/Vestiaire.lua");
const apparenceLua = lire("Logic/Apparence.lua");
const roster = lire("Logic/Roster.lua");
const tests = fs.readFileSync(new URL("./roster-tests.lua", import.meta.url), "utf8");

const lua = await new LuaFactory().createEngine();

const script = `
Narvos = {}
Narvos.Classes = (function()
${classes}
end)()
Narvos.Modular = (function()
${modular}
end)()
Narvos.Creation = (function()
${creation}
end)()

-- Roster offre une tenue de depart aux personnages neufs : sans Vestiaire il
-- retomberait sur Package.Require, absent hors du moteur. On le pose donc comme
-- le fait Shared/Index.lua, dans le meme ordre.
Narvos.Vestiaire = (function()
${vestiaire}
end)()


-- Apparence : Roster.EncoderCouleurs et EncoderMorphs en dependent.
-- Sans elle, requis retombe sur Package.Require, absent hors du moteur,
-- et l'ecriture d'un personnage leve au lieu de rendre une chaine.
Narvos.Apparence = (function()
${apparenceLua}
end)()

-- ── Fausse base ───────────────────────────────────────────────────────────────
function FausseBasePersos()
    local base = { lignes = {}, requetes = {} }

    local function rogner(s) return (tostring(s):gsub("^%s+", ""):gsub("%s+$", "")) end

    function base:Execute(sql, ...)
        local a = { ... }
        self.requetes[#self.requetes + 1] = { sql = sql, args = a }

        if (sql:find("INSERT INTO personnages", 1, true)) then
            -- ⚠ L'ORDRE SUIT CELUI DU MODULE, colonne par colonne. Ajouter une
            -- colonne a l'INSERT sans la refleter ici decale TOUT ce qui suit :
            -- la tenue atterrit dans la colonne couleurs, et seul un test
            -- d'aller-retour le revele. C'est exactement ce qui s'est produit en
            -- ajoutant lore_id en 6e position.
            --
            -- (Pas d'accent grave dans ce commentaire : il vit dans un template
            -- literal JS, un seul backtick le terminerait.)
            self.lignes[#self.lignes + 1] = {
                id = a[1], compte_id = a[2], nom = a[3], class_id = a[4], genre = a[5],
                lore_id = a[6], corps = a[7], niveau = a[8], tenue = a[9],
                garde_robe = a[10], morphs = a[11], credits = a[12],
                couleurs = a[13], cree_le = a[14],
            }
            return 1
        end

        if (sql:find("DELETE FROM personnages", 1, true)) then
            -- Reproduit fidèlement le WHERE du module : id ET compte_id.
            -- Ignorer le second rendrait le test de suppression croisée vert à tort.
            for i, l in ipairs(self.lignes) do
                if (l.id == a[1] and l.compte_id == a[2]) then
                    table.remove(self.lignes, i)
                    return 1
                end
            end
            return 0
        end

        if (sql:find("UPDATE personnages SET morphs", 1, true)) then
            for _, l in ipairs(self.lignes) do
                if (l.id == a[2] and l.compte_id == a[3]) then
                    l.morphs = a[1]
                    return 1
                end
            end
            return 0
        end

        if (sql:find("UPDATE personnages SET garde_robe", 1, true)) then
            -- Meme WHERE que le module : id ET compte_id. L'ignorer rendrait vert
            -- le test qui verifie qu'un joueur ne rhabille pas le perso d'un autre.
            for _, l in ipairs(self.lignes) do
                if (l.id == a[3] and l.compte_id == a[4]) then
                    l.garde_robe = a[1]
                    l.credits = a[2]
                    return 1
                end
            end
            return 0
        end

        -- Colonnes a un seul champ (inventaire, animaux, metiers) : meme forme
        -- « SET col = :0 WHERE id = :1 AND compte_id = :2 ». Ajoutees le
        -- 2026-09-14 : sans elles, les trois sauvegardes n'etaient jamais
        -- parcourues par un test — et elles lisaient une base qui n'existait pas.
        for _, col in ipairs({ "inventaire", "animaux", "metiers", "cite", "zaap" }) do
            if (sql:find("UPDATE personnages SET " .. col .. " = :0 WHERE", 1, true)) then
                for _, l in ipairs(self.lignes) do
                    if (l.id == a[2] and l.compte_id == a[3]) then
                        l[col] = a[1]
                        return 1
                    end
                end
                return 0
            end
        end

        if (sql:find("UPDATE personnages SET niveau = :0, xp = :1, talents = :2", 1, true)) then
            -- Meme WHERE que le module : id ET compte_id.
            for _, l in ipairs(self.lignes) do
                if (l.id == a[4] and l.compte_id == a[5]) then
                    l.niveau = a[1]
                    l.xp = a[2]
                    l.talents = a[3]
                    return 1
                end
            end
            return 0
        end

        if (sql:find("UPDATE personnages SET tenue", 1, true)) then
            for _, l in ipairs(self.lignes) do
                if (l.id == a[2] and l.compte_id == a[3]) then
                    l.tenue = a[1]
                    return 1
                end
            end
            return 0
        end

        return 0
    end

    function base:Select(sql, ...)
        local a = { ... }
        self.requetes[#self.requetes + 1] = { sql = sql, args = a }

        local trouve = {}
        for _, l in ipairs(self.lignes) do
            if (sql:find("WHERE compte_id = :0", 1, true)) then
                if (l.compte_id == a[1]) then trouve[#trouve + 1] = l end
            elseif (sql:find("WHERE id = :0", 1, true)) then
                if (l.id == a[1]) then trouve[#trouve + 1] = l end
            elseif (sql:find("WHERE nom = :0", 1, true)) then
                if (rogner(l.nom):lower() == rogner(a[1]):lower()) then trouve[#trouve + 1] = l end
            end
        end
        return trouve
    end

    return base
end

local Roster = (function()
${roster}
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