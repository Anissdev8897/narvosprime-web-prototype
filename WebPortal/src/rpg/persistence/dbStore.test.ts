import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  __setMysqlForTest, isDbAvailable, loadCharacterDb, saveCharacterDb,
  loadWorldDb, saveWorldDb, flushDb, type MysqlFn,
  readCharacterDb, readWorldDb, isWriteBlocked,
} from "./dbStore";

// Faux MySQL en mémoire qui imite character_state / world_state.
function makeFake() {
  const rows = new Map<string, string>();
  const calls: string[] = [];
  const fn: MysqlFn = async (sql, params = []) => {
    calls.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
    if (/^CREATE TABLE/i.test(sql)) return {};
    if (/^INSERT INTO character_state/i.test(sql)) { rows.set(`c|${params[0]}|${params[1]}`, params[2]); return { affectedRows: 1 }; }
    if (/^INSERT INTO world_state/i.test(sql)) { rows.set(`w|${params[0]}|${params[1]}`, params[2]); return { affectedRows: 1 }; }
    if (/^SELECT value_json FROM character_state/i.test(sql)) { const v = rows.get(`c|${params[0]}|${params[1]}`); return { data: v ? [{ value_json: v }] : [] }; }
    if (/^SELECT value_json FROM world_state/i.test(sql)) { const v = rows.get(`w|${params[0]}|${params[1]}`); return { data: v ? [{ value_json: v }] : [] }; }
    return {};
  };
  return { fn, rows, calls };
}

describe("dbStore (pont MySQL)", () => {
  let fake: ReturnType<typeof makeFake>;
  beforeEach(() => { fake = makeFake(); __setMysqlForTest(fake.fn); });
  afterEach(() => { __setMysqlForTest(null); });

  it("isDbAvailable true quand le bridge est présent", () => {
    expect(isDbAvailable()).toBe(true);
  });

  it("sauvegarde puis recharge un état perso (round-trip)", async () => {
    saveCharacterDb("char_1", "professions", { bucheron: { level: 3, xp: 10 } });
    await flushDb(); // force l'écriture débouncée
    const loaded = await loadCharacterDb<{ bucheron: { level: number } }>("char_1", "professions");
    expect(loaded?.bucheron.level).toBe(3);
  });

  it("isole par character_id et par state_key", async () => {
    saveCharacterDb("char_1", "quests", { a: 1 });
    saveCharacterDb("char_2", "quests", { b: 2 });
    await flushDb();
    expect(await loadCharacterDb("char_1", "quests")).toEqual({ a: 1 });
    expect(await loadCharacterDb("char_2", "quests")).toEqual({ b: 2 });
    expect(await loadCharacterDb("char_1", "professions")).toBeNull();
  });

  it("round-trip d'un état monde (placements)", async () => {
    saveWorldDb("portals", { forge: [{ id: "p1" }] });
    await flushDb();
    const w = await loadWorldDb<{ forge: any[] }>("portals");
    expect(w?.forge[0].id).toBe("p1");
  });

  it("débounce : un seul INSERT après plusieurs sauvegardes rapides", async () => {
    saveCharacterDb("c", "k", { v: 1 });
    saveCharacterDb("c", "k", { v: 2 });
    saveCharacterDb("c", "k", { v: 3 });
    await flushDb();
    const inserts = fake.calls.filter((c) => c.startsWith("INSERT INTO character_state"));
    expect(inserts.length).toBe(1); // coalescé
    expect(await loadCharacterDb("c", "k")).toEqual({ v: 3 }); // dernière valeur
  });
});

// ══════════════════════════════════════════════════════════════════════════════
// Lecture typée et VERROU D'ÉCRITURE
//
// Ces tests reproduisent la séquence de perte de données :
//   lecture qui échoue → le store croit la base vide → il écrit →
//   `ON DUPLICATE KEY UPDATE` écrase des données réelles, sans historique.
//
// Un `mysqlQuery` qui échoue seulement sur les SELECT permet de distinguer les
// trois causes que l'ancien code renvoyait toutes en `null`.
// ══════════════════════════════════════════════════════════════════════════════

/** Pont dont les SELECT échouent, les autres requêtes passant normalement. */
function makeFailingReads(reason: string, matches: (params: any[]) => boolean = () => true) {
  const calls: string[] = [];
  const fn: MysqlFn = async (sql, params = []) => {
    calls.push(sql.trim().split(/\s+/).slice(0, 3).join(" "));
    if (/^SELECT/i.test(sql) && matches(params)) return { data: [], error: reason };
    return { data: [] };
  };
  return { fn, calls };
}

const insertsOf = (calls: string[]) => calls.filter((c) => /^INSERT INTO/i.test(c));

describe("lecture typée — erreur ≠ absence", () => {
  afterEach(() => { __setMysqlForTest(null); });

  it("ligne absente → ok avec value null", async () => {
    __setMysqlForTest(makeFake().fn);
    expect(await readWorldDb("npcs:v1")).toEqual({ status: "ok", value: null });
  });

  it("ligne présente → ok avec la valeur", async () => {
    const f = makeFake();
    __setMysqlForTest(f.fn);
    saveWorldDb("npcs:v1", { forge: [1, 2] });
    await flushDb();
    expect(await readWorldDb("npcs:v1")).toEqual({ status: "ok", value: { forge: [1, 2] } });
  });

  it("erreur SQL → unavailable, PAS un tableau vide", async () => {
    // `res.error` n'était jamais lu : une table manquante ou une connexion
    // perdue se lisait comme « aucune donnée enregistrée ».
    __setMysqlForTest(makeFailingReads("no such table: world_state").fn);
    const r = await readWorldDb("npcs:v1");
    expect(r.status).toBe("unavailable");
    expect(r.status === "unavailable" && r.reason).toContain("no such table");
  });
});

describe("verrou d'écriture — la séquence de perte de données", () => {
  afterEach(() => { __setMysqlForTest(null); });

  it("une lecture en ERREUR bloque l'écriture suivante", async () => {
    const f = makeFailingReads("timeout");
    __setMysqlForTest(f.fn);

    await readWorldDb("npcs:v1");
    expect(isWriteBlocked("w:global:npcs:v1")).toBe(true);

    // Le store croit la base vide et « persiste » son état local.
    saveWorldDb("npcs:v1", { forge: [1] });
    await flushDb();

    // AUCUN INSERT : c'est exactement l'écrasement qu'on empêche.
    expect(insertsOf(f.calls)).toHaveLength(0);
  });

  it("une lecture RÉUSSIE autorise l'écriture", async () => {
    const f = makeFake();
    __setMysqlForTest(f.fn);

    await readWorldDb("npcs:v1");
    expect(isWriteBlocked("w:global:npcs:v1")).toBe(false);

    saveWorldDb("npcs:v1", { forge: [1] });
    await flushDb();
    expect(insertsOf(f.calls).length).toBeGreaterThan(0);
  });

  it("une lecture réussie APRÈS un échec lève le verrou", async () => {
    // ⚠ Le pont change de comportement EN PLACE, sans repasser par
    // `__setMysqlForTest` — celui-ci vide le verrou, et le test passerait alors
    // que `noteReadOutcome` ne déverrouille rien. Première version de ce test :
    // elle réinstallait un pont sain et ne prouvait rien.
    let enPanne = true;
    const fn: MysqlFn = async (sql) => {
      if (/^SELECT/i.test(sql) && enPanne) return { data: [], error: "boom" };
      return { data: [] };
    };
    __setMysqlForTest(fn);

    await readWorldDb("npcs:v1");
    expect(isWriteBlocked("w:global:npcs:v1")).toBe(true);

    enPanne = false;
    await readWorldDb("npcs:v1");
    expect(isWriteBlocked("w:global:npcs:v1")).toBe(false);
  });

  it("le verrou porte sur LA CLÉ, pas globalement", async () => {
    // Une panne sur les placements de PNJ ne doit pas geler la sauvegarde de
    // progression : ce sont deux clés indépendantes.
    __setMysqlForTest(makeFailingReads("boom", (p) => p[1] === "npcs:v1").fn);

    await readWorldDb("npcs:v1");
    await readWorldDb("portals:v1");

    expect(isWriteBlocked("w:global:npcs:v1")).toBe(true);
    expect(isWriteBlocked("w:global:portals:v1")).toBe(false);
  });

  it("le verrou distingue les SCOPES", async () => {
    __setMysqlForTest(makeFailingReads("boom", (p) => p[0] === "global").fn);

    await readWorldDb("settings", "global");
    await readWorldDb("settings", "user:bob");

    expect(isWriteBlocked("w:global:settings")).toBe(true);
    expect(isWriteBlocked("w:user:bob:settings")).toBe(false);
  });

  it("protège aussi les stores NON migrés, via la façade `loadWorldDb`", async () => {
    // Les ~15 stores appellent encore `loadWorldDb`, qui aplatit en `null`. Le
    // verrou doit s'armer quand même — sinon le correctif ne protège que le
    // code déjà migré, c'est-à-dire presque rien.
    const f = makeFailingReads("boom");
    __setMysqlForTest(f.fn);

    expect(await loadWorldDb("npcs:v1")).toBeNull();

    saveWorldDb("npcs:v1", { forge: [1] });
    await flushDb();
    expect(insertsOf(f.calls)).toHaveLength(0);
  });

  it("une clé JAMAIS lue reste écrivable", async () => {
    // Première création d'une clé : rien n'a été lu, donc rien à écraser. La
    // bloquer rendrait toute nouvelle donnée impossible à enregistrer.
    const f = makeFake();
    __setMysqlForTest(f.fn);

    saveWorldDb("toute_nouvelle_cle", { a: 1 });
    await flushDb();
    expect(insertsOf(f.calls).length).toBeGreaterThan(0);
  });

  it("progression : une lecture en échec empêche l'écrasement par un perso niveau 1", async () => {
    // LE cas de perte : un personnage niveau 7 remplacé par un niveau 1 parce
    // que la lecture a dépassé le délai avant que l'autosave ne parte.
    const f = makeFailingReads("timeout");
    __setMysqlForTest(f.fn);

    await readCharacterDb("char_1", "progression");
    saveCharacterDb("char_1", "progression", { stats: { level: 1 } });
    await flushDb();

    expect(insertsOf(f.calls)).toHaveLength(0);
  });

  it("deux personnages ont des verrous indépendants", async () => {
    __setMysqlForTest(makeFailingReads("boom", (p) => p[0] === "char_1").fn);

    await readCharacterDb("char_1", "progression");
    await readCharacterDb("char_2", "progression");

    expect(isWriteBlocked("c:char_1:progression")).toBe(true);
    expect(isWriteBlocked("c:char_2:progression")).toBe(false);
  });
});
