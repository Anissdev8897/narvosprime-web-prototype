// sqlTranslate.test.ts — traduction MySQL → SQLite.
//
// Les requêtes testées ici sont les VRAIES requêtes du projet, copiées depuis
// `src/utils/storage.ts` et `src/rpg/persistence/dbStore.ts`. C'est délibéré :
// la version précédente de ce code a été « vérifiée » sur des exemples écrits à
// la main, tous avec un espace après `VALUES` — et le bug ne se déclenchait que
// SANS espace, graphie utilisée par la requête de sauvegarde de personnage.
//
// Règle tirée de l'incident : tester la traduction sur des chaînes inventées ne
// prouve rien. Il faut les chaînes du dépôt.

import { describe, it, expect } from "vitest";
import { translateMySqlToSqlite, CONFLICT_KEYS } from "./sqlTranslate";

/** `src/utils/storage.ts:634` — sauvegarde de personnage. `VALUES(` SANS espace. */
const SAVE_CHARACTER = `INSERT INTO characters
        (id, user_id, server_id, name, class_id, gender, faction, level, experience,
         money_lys, position_json, customization_json, stats_json, inventory_json,
         spells_json, quests_json, map_id, x, y, created_at)
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          faction = VALUES(faction), level = VALUES(level), experience = VALUES(experience),
          money_lys = VALUES(money_lys), position_json = VALUES(position_json)`;

/** `src/rpg/persistence/dbStore.ts` — état de personnage. `VALUES (` AVEC espace. */
const SAVE_CHARACTER_STATE =
  "INSERT INTO character_state (character_id, state_key, value_json) VALUES (?, ?, ?) " +
  "ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)";

const SAVE_WORLD_STATE =
  "INSERT INTO world_state (scope, state_key, value_json) VALUES (?, ?, ?) " +
  "ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)";

/** `src/utils/storage.ts:397` — objets 2D, plusieurs colonnes mises à jour. */
const SAVE_GAME_OBJECT =
  "INSERT INTO game_objects_2d (id, name, image_url, type) VALUES (?, ?, ?, ?) " +
  "ON DUPLICATE KEY UPDATE name = VALUES(name), image_url = VALUES(image_url)";

describe("la clause VALUES de l'INSERT est préservée", () => {
  it("VALUES( sans espace — le cas qui cassait la sauvegarde de personnage", () => {
    // L'ancien remplacement global produisait `excluded.?, ?, ?…` : du SQL
    // invalide, et donc AUCUNE sauvegarde possible en mode SQLite.
    const { sql } = translateMySqlToSqlite(SAVE_CHARACTER);
    expect(sql).toContain("VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?,");
    expect(sql).not.toContain("excluded.?");
  });

  it("VALUES ( avec espace — la graphie qui masquait le bug", () => {
    const { sql } = translateMySqlToSqlite(SAVE_CHARACTER_STATE);
    expect(sql).toContain("VALUES (?, ?, ?)");
    expect(sql).not.toContain("excluded.?");
  });

  it("aucune requête réelle du dépôt ne produit `excluded.?`", () => {
    for (const q of [SAVE_CHARACTER, SAVE_CHARACTER_STATE, SAVE_WORLD_STATE, SAVE_GAME_OBJECT]) {
      expect(translateMySqlToSqlite(q).sql).not.toMatch(/excluded\.[?\d]/);
    }
  });
});

describe("la fonction VALUES(col) devient excluded.col", () => {
  it("dans la clause de mise à jour", () => {
    const { sql } = translateMySqlToSqlite(SAVE_CHARACTER_STATE);
    expect(sql).toContain("value_json = excluded.value_json");
  });

  it("sur plusieurs colonnes", () => {
    const { sql } = translateMySqlToSqlite(SAVE_GAME_OBJECT);
    expect(sql).toContain("name = excluded.name");
    expect(sql).toContain("image_url = excluded.image_url");
  });

  it("sur une requête multiligne", () => {
    const { sql } = translateMySqlToSqlite(SAVE_CHARACTER);
    expect(sql).toContain("level = excluded.level");
    expect(sql).toContain("position_json = excluded.position_json");
  });

  it("tolère les backticks et les espaces internes", () => {
    const { sql } = translateMySqlToSqlite(
      "INSERT INTO t (a) VALUES (?) ON DUPLICATE KEY UPDATE a = VALUES( `a` )",
    );
    expect(sql).toContain("a = excluded.a");
  });
});

describe("clé de conflit", () => {
  it("clé COMPOSITE pour character_state", () => {
    // `ON CONFLICT(id)` échouait : la table n'a pas de colonne `id`.
    const r = translateMySqlToSqlite(SAVE_CHARACTER_STATE);
    expect(r.conflictKeys).toBe("character_id, state_key");
    expect(r.sql).toContain("ON CONFLICT(character_id, state_key) DO UPDATE SET");
    expect(r.assumedDefaultKey).toBe(false);
  });

  it("clé COMPOSITE pour world_state", () => {
    const r = translateMySqlToSqlite(SAVE_WORLD_STATE);
    expect(r.conflictKeys).toBe("scope, state_key");
    expect(r.assumedDefaultKey).toBe(false);
  });

  it("repli sur `id` pour une table non déclarée, et le SIGNALE", () => {
    const r = translateMySqlToSqlite(SAVE_CHARACTER);
    expect(r.table).toBe("characters");
    expect(r.conflictKeys).toBe("id");
    // L'appelant doit pouvoir avertir : si la clé de `characters` était
    // composite, l'upsert échouerait silencieusement.
    expect(r.assumedDefaultKey).toBe(true);
  });

  it("chaque table déclarée a une clé non vide", () => {
    for (const [t, k] of Object.entries(CONFLICT_KEYS)) {
      expect(k.trim().length, t).toBeGreaterThan(0);
    }
  });
});

describe("requêtes non concernées", () => {
  it("un SELECT n'est pas touché", () => {
    const sql = "SELECT * FROM characters WHERE user_id = ?";
    const r = translateMySqlToSqlite(sql);
    expect(r.sql).toBe(sql);
    expect(r.conflictKeys).toBeNull();
  });

  it("un INSERT SANS upsert garde sa clause VALUES intacte", () => {
    // Le cœur du bug : ici il n'y a AUCUNE fonction `VALUES()` à traduire.
    const sql = "INSERT INTO inventory (id, character_id) VALUES(?, ?)";
    expect(translateMySqlToSqlite(sql).sql).toBe(sql);
  });

  it("un DELETE n'est pas touché", () => {
    const sql = "DELETE FROM character_state WHERE character_id = ?";
    expect(translateMySqlToSqlite(sql).sql).toBe(sql);
  });
});

describe("NOW()", () => {
  it("est traduit même hors upsert", () => {
    // `NOW()` n'existe pas en SQLite, quelle que soit la requête.
    expect(translateMySqlToSqlite("INSERT INTO t (a) VALUES (NOW())").sql)
      .toContain("strftime('%s', 'now')");
  });

  it("est traduit des deux côtés du découpage", () => {
    const { sql } = translateMySqlToSqlite(SAVE_CHARACTER);
    expect(sql).not.toMatch(/NOW\(\)/i);
  });
});

describe("robustesse du découpage", () => {
  it("insensible à la casse du marqueur", () => {
    const { sql } = translateMySqlToSqlite(
      "insert into t (a) values (?) on duplicate key update a = values(a)",
    );
    expect(sql).toContain("ON CONFLICT(id) DO UPDATE SET");
    expect(sql).toContain("a = excluded.a");
  });

  it("un `VALUES(?)` résiduel ne peut PAS devenir `excluded.?`", () => {
    // Deuxième filet : le motif de remplacement exige un identifiant. Même si
    // le découpage échouait, un paramètre positionnel ne matcherait pas.
    const { sql } = translateMySqlToSqlite(
      "INSERT INTO t (a) VALUES(?) ON DUPLICATE KEY UPDATE a = VALUES(?)",
    );
    expect(sql).not.toContain("excluded.?");
  });
});