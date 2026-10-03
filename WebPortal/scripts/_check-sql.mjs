// Vérifie la traduction MySQL -> SQLite des upserts (electron/localDatabase.ts).
const CONFLICT_KEYS = {
  character_state: "character_id, state_key",
  world_state: "scope, state_key",
};

function traduire(sql) {
  const cible = /INSERT\s+(?:OR\s+\w+\s+)?INTO\s+`?(\w+)`?/i.exec(sql)?.[1]?.toLowerCase();
  const conflit = (cible && CONFLICT_KEYS[cible]) ?? "id";
  return {
    cible,
    sql: sql
      .replace(/ON DUPLICATE KEY UPDATE/gi, `ON CONFLICT(${conflit}) DO UPDATE SET`)
      .replace(/VALUES\(([^)]+)\)/g, "excluded.$1")
      .replace(/NOW\(\)/g, "strftime('%s', 'now')"),
  };
}

const CAS = [
  "INSERT INTO character_state (character_id, state_key, value_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)",
  "INSERT INTO world_state (scope, state_key, value_json) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE value_json = VALUES(value_json)",
  "INSERT INTO characters (id, name) VALUES (?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name)",
  "INSERT INTO `character_state` (character_id, state_key) VALUES (?, ?) ON DUPLICATE KEY UPDATE state_key = VALUES(state_key)",
];

let ko = 0;
for (const c of CAS) {
  const { cible, sql } = traduire(c);
  const attendu = CONFLICT_KEYS[cible] ?? "id";
  const ok = sql.includes(`ON CONFLICT(${attendu})`);
  if (!ok) ko++;
  console.log(`${ok ? "✓" : "✗"} ${cible?.padEnd(16)} -> ${/ON CONFLICT\(([^)]+)\)/.exec(sql)?.[1]}`);
}

console.log(`\n${CAS.length - ko}/${CAS.length} traductions correctes`);
process.exit(ko ? 1 : 0);