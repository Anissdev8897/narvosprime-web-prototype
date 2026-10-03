// sqliteSchema.test.ts — le schéma et les upserts fonctionnent-ils VRAIMENT ?
//
// Ces tests n'inspectent pas des chaînes : ils ouvrent une base SQLite en
// mémoire, y exécutent le DDL réel et les requêtes réelles du projet, puis
// relisent. C'est la seule façon de prouver C2 et C3, dont le symptôme était
// précisément qu'aucune erreur ne remontait.
//
// ── CE QUE CES TESTS ÉTABLISSENT ─────────────────────────────────────────────
//
// C2 — `ON UPDATE CURRENT_TIMESTAMP` est du MySQL pur. SQLite le REJETTE. Le
//      DDL envoyé par `dbStore.ensureSchema` échouait donc, les tables
//      n'existaient jamais, et rien n'était persisté en base.
// C3 — la traduction MySQL→SQLite mutilait la clause `VALUES(...)` de l'INSERT.
//
// Les deux se manifestaient par un silence total.

import { describe, it, expect } from "vitest";
import { createRequire } from "node:module";
import { translateMySqlToSqlite } from "./sqlTranslate";

// Chargement au RUNTIME, pas par `import` statique : `node:sqlite` est trop
// récent pour la liste de modules natifs de Vite, qui tente alors de le
// résoudre comme un paquet et échoue. `createRequire` court-circuite le
// résolveur.
const { DatabaseSync } = createRequire(import.meta.url)("node:sqlite") as {
  DatabaseSync: new (path: string) => {
    exec(sql: string): void;
    prepare(sql: string): { run(...p: unknown[]): unknown; all(...p: unknown[]): unknown[]; get(...p: unknown[]): unknown };
    close(): void;
  };
};

// ⚠ `node:sqlite` et NON `better-sqlite3`.
//
// `better-sqlite3` est un module natif recompilé pour l'ABI d'ELECTRON
// (`npm run electron:rebuild`). Il refuse de se charger sous Node, donc dans
// vitest — c'est d'ailleurs une des raisons pour lesquelles ce code n'a jamais
// été testé.
//
// `node:sqlite` est le SQLite intégré à Node 22+. Même moteur, mêmes règles de
// syntaxe : ce qu'il rejette, `better-sqlite3` le rejette aussi. Aucune
// dépendance ajoutée, et les tests tournent partout.

/** DDL tel qu'émis par `src/rpg/persistence/dbStore.ts` — corrigé. */
const DDL_CHARACTER_STATE = `CREATE TABLE IF NOT EXISTS character_state (
   character_id VARCHAR(64)  NOT NULL,
   state_key    VARCHAR(64)  NOT NULL,
   value_json   LONGTEXT     NOT NULL,
   updated_at   BIGINT       NOT NULL DEFAULT 0,
   PRIMARY KEY (character_id, state_key)
 )`;

const DDL_WORLD_STATE = `CREATE TABLE IF NOT EXISTS world_state (
   scope      VARCHAR(96)  NOT NULL,
   state_key  VARCHAR(64)  NOT NULL,
   value_json LONGTEXT     NOT NULL,
   updated_at BIGINT       NOT NULL DEFAULT 0,
   PRIMARY KEY (scope, state_key)
 )`;

/** L'ANCIEN DDL, celui qui cassait tout. */
const DDL_AVEC_ON_UPDATE = `CREATE TABLE IF NOT EXISTS character_state (
   character_id VARCHAR(64)  NOT NULL,
   state_key    VARCHAR(64)  NOT NULL,
   value_json   LONGTEXT     NOT NULL,
   updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
   PRIMARY KEY (character_id, state_key)
 )`;

/** Upsert tel qu'émis par `saveCharacterDb`. */
const UPSERT_CHARACTER_STATE =
  `INSERT INTO character_state (character_id, state_key, value_json, updated_at) VALUES (?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = VALUES(updated_at)`;

const UPSERT_WORLD_STATE =
  `INSERT INTO world_state (scope, state_key, value_json, updated_at) VALUES (?, ?, ?, ?)
   ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = VALUES(updated_at)`;

const openDb = () => new DatabaseSync(":memory:");

describe("C2 — le schéma est réellement acceptable par SQLite", () => {
  it("le DDL corrigé s'exécute", () => {
    const db = openDb();
    expect(() => db.exec(DDL_CHARACTER_STATE)).not.toThrow();
    expect(() => db.exec(DDL_WORLD_STATE)).not.toThrow();
    db.close();
  });

  it("l'ANCIEN DDL échoue — c'est la cause racine de C2", () => {
    // Si cette assertion tombait un jour, c'est que SQLite aurait accepté la
    // clause : le correctif deviendrait inutile, et il faudrait le savoir.
    const db = openDb();
    expect(() => db.exec(DDL_AVEC_ON_UPDATE)).toThrow();
    db.close();
  });

  it("les clés primaires sont bien COMPOSITES", () => {
    // C'est ce que `CONFLICT_KEYS` doit refléter. Une clé simple ferait échouer
    // les upserts sur `ON CONFLICT(character_id, state_key)`.
    const db = openDb();
    db.exec(DDL_CHARACTER_STATE);
    const pk = (db.prepare("PRAGMA table_info(character_state)").all() as Array<{ name: string; pk: number }>)
      .filter((c) => c.pk > 0)
      .sort((a, b) => a.pk - b.pk)
      .map((c) => c.name);
    expect(pk).toEqual(["character_id", "state_key"]);
    db.close();
  });
});

describe("C3 — les upserts traduits s'exécutent et se comportent en upsert", () => {
  it("character_state : insertion puis mise à jour, sans doublon", () => {
    const db = openDb();
    db.exec(DDL_CHARACTER_STATE);

    const sql = translateMySqlToSqlite(UPSERT_CHARACTER_STATE).sql;
    const stmt = db.prepare(sql);

    stmt.run("char_1", "progression", '{"level":1}', 1000);
    stmt.run("char_1", "progression", '{"level":7}', 2000);

    const rows = db.prepare("SELECT * FROM character_state").all() as Array<{
      value_json: string; updated_at: number;
    }>;

    // UNE seule ligne : la seconde écriture a mis à jour, pas dupliqué.
    expect(rows).toHaveLength(1);
    expect(JSON.parse(rows[0].value_json).level).toBe(7);
    expect(rows[0].updated_at).toBe(2000);
    db.close();
  });

  it("world_state : même comportement sur une autre clé composite", () => {
    const db = openDb();
    db.exec(DDL_WORLD_STATE);

    const stmt = db.prepare(translateMySqlToSqlite(UPSERT_WORLD_STATE).sql);
    stmt.run("global", "npcs:v1", '{"forge":[]}', 1000);
    stmt.run("global", "npcs:v1", '{"forge":[1,2,3]}', 2000);
    stmt.run("user:bob", "npcs:v1", '{"forge":[9]}', 3000);

    const rows = db.prepare("SELECT scope, value_json FROM world_state ORDER BY scope").all() as Array<{
      scope: string; value_json: string;
    }>;

    // Deux scopes distincts → deux lignes. La clé composite fonctionne.
    expect(rows).toHaveLength(2);
    expect(rows[0].scope).toBe("global");
    expect(JSON.parse(rows[0].value_json).forge).toEqual([1, 2, 3]);
    db.close();
  });

  it("l'ANCIENNE traduction produit du SQL INVALIDE — c'est la cause racine de C3", () => {
    // ⚠ La requête choisie ici DOIT s'écrire `VALUES(` sans espace.
    //
    // Premier essai de ce test : il visait `UPSERT_CHARACTER_STATE`, qui
    // s'écrit `VALUES (` AVEC espace — l'ancien remplacement ne la matchait
    // donc pas et la traduisait correctement. Le test échouait en affirmant à
    // tort que l'ancien code était sain.
    //
    // C'est exactement le piège d'origine : la graphie espacée MASQUE le bug.
    // La requête ci-dessous est celle de `src/utils/storage.ts:639`.
    const db = openDb();
    db.exec(`CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY, level INTEGER)`);

    const original = "INSERT INTO t (id, level) VALUES(?, ?) ON DUPLICATE KEY UPDATE level = VALUES(level)";

    // Reproduction fidèle de l'ancien code : remplacement global, sans découpage.
    const ancienne = original
      .replace(/ON DUPLICATE KEY UPDATE/gi, "ON CONFLICT(id) DO UPDATE SET")
      .replace(/VALUES\(([^)]+)\)/g, "excluded.$1");

    // La clause VALUES de l'INSERT a été mangée.
    expect(ancienne).toContain("excluded.?");
    expect(() => db.prepare(ancienne)).toThrow();

    // Et la nouvelle passe sur la MÊME requête.
    expect(() => db.prepare(translateMySqlToSqlite(original, { t: "id" }).sql)).not.toThrow();
    db.close();
  });

  it("la requête de sauvegarde de personnage — `VALUES(` sans espace — s'exécute", () => {
    // Le cas exact de `src/utils/storage.ts:639`, celui qui était détruit.
    const db = openDb();
    db.exec(`CREATE TABLE IF NOT EXISTS t (id TEXT PRIMARY KEY, level INTEGER)`);

    const sql = translateMySqlToSqlite(
      "INSERT INTO t (id, level) VALUES(?, ?) ON DUPLICATE KEY UPDATE level = VALUES(level)",
      { t: "id" },
    ).sql;

    const stmt = db.prepare(sql);
    stmt.run("a", 1);
    stmt.run("a", 42);

    expect(db.prepare("SELECT level FROM t WHERE id = ?").get("a")).toEqual({ level: 42 });
    db.close();
  });
});