// ══════════════════════════════════════════════════════════════════════════════
// rpg/persistence/dbStore.ts — Pont de persistance BASE DE DONNÉES (MySQL via Electron).
//
// But : tout ce que le jeu sauvegardait en « fichier brut » (localStorage) doit
// aussi vivre dans la base. Ce module est une SURCOUCHE MySQL : les stores gardent
// leur localStorage (fallback navigateur + cache), et appellent ce pont pour
// lire/écrire en base quand on tourne dans Electron.
//
// • Aucune modif du process Electron (main.ts/preload.ts) : on passe par le canal
//   SQL générique déjà exposé `window.narvosLauncher.mysqlQuery(sql, params)`.
// • Deux tables dédiées, génériques et extensibles (zéro migration par feature) :
//     character_state(character_id, state_key, value_json)  — progression par perso
//     world_state(scope, state_key, value_json)             — données monde/éditeur
// • Hors Electron (vite dev navigateur) : ce pont est INACTIF (no-op / null) et les
//   stores retombent sur leur localStorage.
// ══════════════════════════════════════════════════════════════════════════════

export interface MysqlResult { data?: any[]; error?: string; affectedRows?: number }
export type MysqlFn = (sql: string, params?: any[]) => Promise<MysqlResult>;

// Permet d'injecter un faux client en test (sinon détection Electron réelle).
let injectedMysql: MysqlFn | null = null;
export function __setMysqlForTest(fn: MysqlFn | null): void {
  injectedMysql = fn;
  schemaReady = null;
  // Le verrou d'écriture vit en variable de module : sans ce nettoyage, un test
  // qui simule une panne bloquerait tous les suivants du même fichier.
  blocked.clear();
}

function getMysql(): MysqlFn | null {
  if (injectedMysql) return injectedMysql;
  if (typeof window === "undefined") return null;
  const w = window as any;
  const fn: MysqlFn | undefined = w.narvosLauncher?.mysqlQuery ?? w.electronAPI?.mysqlQuery;
  return typeof fn === "function" ? fn : null;
}

/** true si on peut persister en base (Electron + bridge SQL présent). */
export function isDbAvailable(): boolean { return getMysql() !== null; }

// ── Schéma : créé une fois, paresseusement ──────────────────────────────────────
let schemaReady: Promise<void> | null = null;
function ensureSchema(q: MysqlFn): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      // ⚠ PAS de `ON UPDATE CURRENT_TIMESTAMP` : cette clause est du MySQL pur
      // et SQLite la REJETTE. Ce DDL part sur un canal générique (`db:mysqlQuery`)
      // vers l'un ou l'autre moteur ; avec elle, `ensureSchema` échouait en
      // SQLite, les deux tables n'existaient jamais, et AUCUNE donnée n'était
      // persistée en base — en permanence, sans le moindre message.
      //
      // `updated_at` est donc renseignée applicativement, à l'écriture.
      await q(
        `CREATE TABLE IF NOT EXISTS character_state (
           character_id VARCHAR(64)  NOT NULL,
           state_key    VARCHAR(64)  NOT NULL,
           value_json   LONGTEXT     NOT NULL,
           updated_at   BIGINT       NOT NULL DEFAULT 0,
           PRIMARY KEY (character_id, state_key)
         )`, []);
      await q(
        `CREATE TABLE IF NOT EXISTS world_state (
           scope      VARCHAR(96)  NOT NULL,
           state_key  VARCHAR(64)  NOT NULL,
           value_json LONGTEXT     NOT NULL,
           updated_at BIGINT       NOT NULL DEFAULT 0,
           PRIMARY KEY (scope, state_key)
         )`, []);
    })().catch((e) => { console.error("[dbStore] ensureSchema a échoué :", e); schemaReady = null; });
  }
  return schemaReady;
}

// ── Garde-fou anti-gel du boot ──────────────────────────────────────────────────
// Une lecture DB ne doit JAMAIS bloquer le démarrage. Si MySQL est injoignable
// (offline / serveur down / DATABASE_URL invalide), le connect mysql2 hang ~10 s
// (connectTimeout par défaut) → dépasse le timeout d'hydratation (8 s, hydrateAll)
// → `[hydrateAll] délai dépassé` + map révélée AVANT que les PNJ/portails hydratent
// (placements vides au reveal). On borne donc chaque lecture : au-delà → null, et le
// store retombe sur son localStorage (chemin de repli déjà prévu partout).
const DB_READ_TIMEOUT_MS = 1500;

/**
 * Résultat d'une lecture en base.
 *
 * ── POURQUOI CE TYPE PLUTÔT QUE `T | null` ───────────────────────────────────
 *
 * `null` recouvrait TROIS causes indiscernables : ligne absente, délai dépassé,
 * erreur SQL avalée par le `catch`. Le champ `res.error` n'était même jamais lu.
 *
 * Les conséquences sont opposées, et la confusion est destructrice :
 *
 *   ok / value: null   la ligne n'existe pas → écrire est légitime.
 *   unavailable        on NE SAIT PAS → écrire écrase potentiellement des
 *                      données réelles par un état neuf.
 *
 * Chaîne mesurée : lecture > 1500 ms → `null` → le jeu construit un personnage
 * NIVEAU 1 → l'autosave part à 800 ms, donc AVANT l'expiration de la lecture →
 * `ON DUPLICATE KEY UPDATE` écrase la progression réelle. Aucun historique.
 * Même mécanisme sur les ~15 stores de monde, qui réécrivent l'intégralité de
 * leur clé à la première mutation.
 */
export type DbRead<T> =
  | { status: "ok"; value: T | null }
  | { status: "unavailable"; reason: string };

/** Marqueur interne du dépassement de délai, distinct d'une absence de ligne. */
const TIMEOUT = Symbol("db-timeout");

function withTimeout<T>(p: Promise<T>, ms = DB_READ_TIMEOUT_MS): Promise<T | typeof TIMEOUT> {
  let t: ReturnType<typeof setTimeout>;
  return Promise.race([
    p.finally(() => clearTimeout(t)),
    new Promise<typeof TIMEOUT>((resolve) => { t = setTimeout(() => resolve(TIMEOUT), ms); }),
  ]);
}

// ── VERROU D'ÉCRITURE ──────────────────────────────────────────────────────────
//
// Le cœur du correctif C1. Un seul endroit, volontairement : répliquer cette
// règle dans les ~15 stores garantirait qu'un futur store l'oublie.
//
// ── LA SÉQUENCE DESTRUCTRICE QU'IL COUPE ─────────────────────────────────────
//
//   1. lecture DB dépasse 1500 ms  →  l'ancien code renvoyait `null`
//   2. le store conclut « rien en base » et garde son localStorage (souvent vide)
//   3. première mutation → `persist()` réécrit l'INTÉGRALITÉ de la clé
//   4. `ON DUPLICATE KEY UPDATE` — aucun historique, aucune sauvegarde
//
// Un simple ajout de PNJ écrivait `{"forge":[1 PNJ]}` par-dessus tous les
// placements de toutes les maps.
//
// ── LA RÈGLE ─────────────────────────────────────────────────────────────────
//
//   lecture `unavailable`  →  écritures BLOQUÉES pour cette clé
//   lecture `ok`           →  écritures autorisées (l'état lu fait foi)
//   jamais lue             →  autorisées : rien n'a été lu, donc rien à écraser
//
// Le blocage porte sur la CLÉ, pas globalement : une panne sur `npcs:v1` ne doit
// pas geler la sauvegarde de progression.
//
// ⚠ Les écritures bloquées ne sont PAS rejouées. Une écriture calculée à partir
// d'un état potentiellement périmé est exactement ce qu'on cherche à empêcher —
// la rejouer plus tard ne la rendrait pas plus sûre. Le localStorage reste la
// source de vérité locale ; la base se resynchronise à la première mutation qui
// suit une lecture réussie.
const blocked = new Set<string>();

const slotOfCharacter = (characterId: string, key: string) => `c:${characterId}:${key}`;
const slotOfWorld = (scope: string, key: string) => `w:${scope}:${key}`;

function noteReadOutcome(slot: string, status: "ok" | "unavailable"): void {
  if (status === "ok") {
    if (blocked.delete(slot)) console.info(`[dbStore] écritures ré-autorisées : ${slot}`);
    return;
  }
  if (!blocked.has(slot)) {
    console.warn(`[dbStore] écritures BLOQUÉES sur ${slot} — lecture non aboutie, écrire écraserait des données inconnues`);
    blocked.add(slot);
  }
}

/** Une clé est-elle sous verrou ? Sert à l'UI pour prévenir l'utilisateur. */
export function isWriteBlocked(slot: string): boolean { return blocked.has(slot); }

/** Nombre de clés sous verrou — diagnostic global. */
export function blockedWriteCount(): number { return blocked.size; }

/** Exécute une lecture et classe son issue. */
async function read<T>(
  q: MysqlFn,
  label: string,
  sql: string,
  params: unknown[],
): Promise<DbRead<T>> {
  const issue = await withTimeout<DbRead<T>>((async (): Promise<DbRead<T>> => {
    try {
      await ensureSchema(q);
      const res = await q(sql, params as never[]);

      // `res.error` n'était jamais consulté : une table manquante ou une
      // connexion perdue se lisait comme « aucune donnée enregistrée ».
      if (res?.error) return { status: "unavailable", reason: `SQL: ${res.error}` };

      const raw = res?.data?.[0]?.value_json;
      return { status: "ok", value: raw ? (JSON.parse(raw) as T) : null };
    } catch (e) {
      console.error(`[dbStore] ${label}`, e);
      return { status: "unavailable", reason: e instanceof Error ? e.message : String(e) };
    }
  })());

  if (issue === TIMEOUT) {
    console.warn(`[dbStore] ${label} — délai dépassé (${DB_READ_TIMEOUT_MS} ms)`);
    return { status: "unavailable", reason: `délai dépassé (${DB_READ_TIMEOUT_MS} ms)` };
  }
  return issue;
}

// ── Lecture typée — à préférer partout où une ÉCRITURE suivra ──────────────────

/**
 * ⚠ Absence de pont SQL = `ok` avec `value: null`, PAS `unavailable`.
 *
 * En navigateur pur il n'y a pas de base, et il n'y en aura pas : c'est une
 * configuration valide, pas une panne. La classer en `unavailable` verrouillerait
 * les écritures d'un mode qui n'écrit de toute façon jamais en base.
 */
export async function readCharacterDb<T>(characterId: string, key: string): Promise<DbRead<T>> {
  const q = getMysql();
  if (!q || !characterId) return { status: "ok", value: null };
  const r = await read<T>(q, `readCharacterDb(${key})`,
    `SELECT value_json FROM character_state WHERE character_id = ? AND state_key = ?`,
    [characterId, key]);
  noteReadOutcome(slotOfCharacter(characterId, key), r.status);
  return r;
}

export async function readWorldDb<T>(key: string, scope = "global"): Promise<DbRead<T>> {
  const q = getMysql();
  if (!q) return { status: "ok", value: null };
  const r = await read<T>(q, `readWorldDb(${key})`,
    `SELECT value_json FROM world_state WHERE scope = ? AND state_key = ?`,
    [scope, key]);
  noteReadOutcome(slotOfWorld(scope, key), r.status);
  return r;
}

// ── Façades historiques ───────────────────────────────────────────────────────
//
// Elles APLATISSENT `unavailable` en `null` — exactement l'ambiguïté que les
// fonctions ci-dessus lèvent. Ne pas les utiliser dans un chemin qui écrit
// ensuite : le store croirait à une absence de données et écraserait.

export async function loadCharacterDb<T>(characterId: string, key: string): Promise<T | null> {
  const r = await readCharacterDb<T>(characterId, key);
  return r.status === "ok" ? r.value : null;
}

export async function loadWorldDb<T>(key: string, scope = "global"): Promise<T | null> {
  const r = await readWorldDb<T>(key, scope);
  return r.status === "ok" ? r.value : null;
}

// ── Écriture débouncée (coalesce les rafales : montées d'XP, récoltes…) ─────────
const DEBOUNCE_MS = 700;
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const pending = new Map<string, () => Promise<void>>();

function schedule(slot: string, run: () => Promise<void>): void {
  pending.set(slot, run);
  const existing = timers.get(slot);
  if (existing) clearTimeout(existing);
  timers.set(slot, setTimeout(() => {
    timers.delete(slot);
    const fn = pending.get(slot); pending.delete(slot);
    fn?.().catch((e) => console.error(`[dbStore] write ${slot}`, e));
  }, DEBOUNCE_MS));
}

/** Persiste un état perso en base (débouncé). No-op hors Electron. */
export function saveCharacterDb(characterId: string, key: string, value: unknown): void {
  const q = getMysql();
  if (!q || !characterId) return;

  const slot = slotOfCharacter(characterId, key);
  if (blocked.has(slot)) {
    // La lecture de cette clé n'a pas abouti : ce qu'on s'apprête à écrire a
    // été calculé sans connaître l'état réel. Écrire, c'est l'écraser.
    console.warn(`[dbStore] écriture IGNORÉE sur ${slot} — lecture non aboutie`);
    return;
  }

  const json = JSON.stringify(value);
  schedule(slot, async () => {
    await ensureSchema(q);
    // `updated_at` renseignée ici : `ON UPDATE CURRENT_TIMESTAMP` a été retiré
    // du schéma parce que SQLite le rejette (cf. `ensureSchema`).
    await q(
      `INSERT INTO character_state (character_id, state_key, value_json, updated_at) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = VALUES(updated_at)`,
      [characterId, key, json, Date.now()]);
  });
}

/** Persiste un état monde/éditeur en base (débouncé). No-op hors Electron. */
export function saveWorldDb(key: string, value: unknown, scope = "global"): void {
  const q = getMysql();
  if (!q) return;

  const slot = slotOfWorld(scope, key);
  if (blocked.has(slot)) {
    console.warn(`[dbStore] écriture IGNORÉE sur ${slot} — lecture non aboutie`);
    return;
  }

  const json = JSON.stringify(value);
  schedule(slot, async () => {
    await ensureSchema(q);
    await q(
      `INSERT INTO world_state (scope, state_key, value_json, updated_at) VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE value_json = VALUES(value_json), updated_at = VALUES(updated_at)`,
      [scope, key, json, Date.now()]);
  });
}

// ── Préférences PAR UTILISATEUR (réglages, caméra…) ─────────────────────────────
// Pas de personnage requis : on scope par utilisateur connecté (session narvos_user)
// dans world_state → les réglages suivent le compte, pas la machine.
function currentUsername(): string {
  if (typeof window === "undefined") return "local";
  try { const u = JSON.parse(localStorage.getItem("narvos_user") || "{}"); return (u && u.username) ? String(u.username) : "local"; }
  catch { return "local"; }
}
export async function loadUserDb<T>(key: string): Promise<T | null> {
  return loadWorldDb<T>(key, `user:${currentUsername()}`);
}
export function saveUserDb(key: string, value: unknown): void {
  saveWorldDb(key, value, `user:${currentUsername()}`);
}

/** Force l'écriture immédiate de tout ce qui est en attente (ex: avant quitter). */
export async function flushDb(): Promise<void> {
  const slots = [...pending.keys()];
  for (const slot of slots) {
    const t = timers.get(slot); if (t) { clearTimeout(t); timers.delete(slot); }
    const fn = pending.get(slot); pending.delete(slot);
    if (fn) await fn().catch((e) => console.error(`[dbStore] flush ${slot}`, e));
  }
}
