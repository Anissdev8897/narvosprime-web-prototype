// ══════════════════════════════════════════════════════════════════════════════
// electron/sqlTranslate.ts — Traduction MySQL → SQLite des requêtes du renderer.
//
// Logique PURE : une chaîne SQL entre, une chaîne SQL sort. Aucune base, aucun
// IPC. C'est ce qui la rend testable — et c'est précisément ce qui manquait.
//
// ── LE BUG QUI JUSTIFIE CE MODULE (mesuré le 03/08/2026) ─────────────────────
//
// La traduction vivait en une ligne dans `localDatabase.query()` :
//
//     .replace(/VALUES\(([^)]+)\)/g, 'excluded.$1')
//
// Ce remplacement s'applique au TEXTE BRUT. Il ne distingue pas :
//
//     INSERT INTO t (a,b) VALUES(?, ?)          ← clause de l'INSERT
//     ... ON DUPLICATE KEY UPDATE a = VALUES(a) ← fonction MySQL
//
// La première s'écrit sans espace dans `src/utils/storage.ts:639` — la requête
// de SAUVEGARDE DE PERSONNAGE. Elle devenait `excluded.?, ?, ?…`, donc du SQL
// invalide. Quatre requêtes réelles touchées : characters, breeds, spells,
// monsters. Les requêtes écrites `VALUES (` avec espace étaient épargnées :
// tester uniquement celles-là donnait un vert trompeur.
//
// ── LA CORRECTION ────────────────────────────────────────────────────────────
//
// On DÉCOUPE la requête sur `ON DUPLICATE KEY UPDATE`. La partie gauche (INSERT
// et sa clause VALUES) n'est jamais touchée ; seule la partie droite, où
// `VALUES(col)` est sans ambiguïté la fonction MySQL, est réécrite en
// `excluded.col`. Le contexte est la seule chose qui distingue les deux — un
// remplacement global ne peut pas y arriver.
// ══════════════════════════════════════════════════════════════════════════════

/**
 * Colonnes de conflit par table, pour traduire `ON DUPLICATE KEY UPDATE`.
 *
 * Les deux tables qui portent tout l'état RPG ont une clé primaire COMPOSITE et
 * aucune colonne `id` : émettre `ON CONFLICT(id)` en dur faisait échouer chaque
 * upsert, l'erreur était renvoyée puis ignorée par l'appelant.
 */
export const CONFLICT_KEYS: Readonly<Record<string, string>> = {
  character_state: "character_id, state_key",
  world_state: "scope, state_key",
};

/** Clé de conflit retenue quand la table n'est pas déclarée ci-dessus. */
export const DEFAULT_CONFLICT_KEY = "id";

export interface TranslateResult {
  sql: string;
  /** Table visée par un INSERT, en minuscules. `null` si la requête n'en est pas un. */
  table: string | null;
  /** Colonnes de conflit retenues. `null` si la requête n'est pas un upsert. */
  conflictKeys: string | null;
  /** `true` si la table est inconnue et qu'on a supposé `id` — l'appelant doit le signaler. */
  assumedDefaultKey: boolean;
}

const RE_INSERT_TABLE = /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+`?(\w+)`?/i;
const RE_UPSERT = /ON\s+DUPLICATE\s+KEY\s+UPDATE/i;
const RE_NOW = /NOW\(\)/gi;

/**
 * `VALUES(col)` → `excluded.col`, appliqué UNIQUEMENT à la clause de mise à jour.
 *
 * Le nom de colonne est contraint à un identifiant (`\w`) : un `VALUES(?, ?)`
 * résiduel ne peut donc pas matcher, même si le découpage venait à échouer.
 * Double sécurité volontaire — c'est le remplacement qui a déjà cassé une fois.
 */
function valuesToExcluded(setClause: string): string {
  return setClause.replace(/VALUES\s*\(\s*`?(\w+)`?\s*\)/gi, "excluded.$1");
}

/**
 * Traduit une requête MySQL vers SQLite.
 *
 * Ne touche ni les SELECT, ni les INSERT simples, ni les DDL — hormis `NOW()`,
 * qui n'existe pas en SQLite quelle que soit la requête.
 */
export function translateMySqlToSqlite(
  sql: string,
  conflictKeys: Readonly<Record<string, string>> = CONFLICT_KEYS,
): TranslateResult {
  const table = RE_INSERT_TABLE.exec(sql)?.[1]?.toLowerCase() ?? null;
  const upsert = RE_UPSERT.exec(sql);

  if (!upsert) {
    return {
      sql: sql.replace(RE_NOW, "strftime('%s', 'now')"),
      table,
      conflictKeys: null,
      assumedDefaultKey: false,
    };
  }

  const declaree = table ? conflictKeys[table] : undefined;
  const keys = declaree ?? DEFAULT_CONFLICT_KEY;

  // Découpage à l'indice du marqueur : tout ce qui précède est l'INSERT et sa
  // clause VALUES, qui doivent rester intacts.
  const avant = sql.slice(0, upsert.index);
  const apres = sql.slice(upsert.index + upsert[0].length);

  const traduit = `${avant}ON CONFLICT(${keys}) DO UPDATE SET${valuesToExcluded(apres)}`;

  return {
    sql: traduit.replace(RE_NOW, "strftime('%s', 'now')"),
    table,
    conflictKeys: keys,
    assumedDefaultKey: declaree === undefined,
  };
}