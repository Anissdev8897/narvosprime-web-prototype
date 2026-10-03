/**
 * EntityRegistry.ts - Loader des configs JSON du POC iso.
 *
 * Charge en parallele les 6 fichiers config, valide le contenu de base,
 * et expose un objet EntityRegistry conserve dans le state React.
 *
 * Aucune dependance backend — tout vient de `public/configs/iso_poc/`.
 */

import type { Spell } from "./CombatTypes";
import type {
  CharacterDefinition,
  ClassDefinition,
  EntityRegistry as RegistryShape,
  Map3DConfig,
  MonsterDefinition,
  SpawnPoint,
} from "./EntityDefinition";

const CONFIG_BASE = "/configs/iso_poc";

const CONFIG_FILES = {
  classes: `${CONFIG_BASE}/classes.json`,
  spells: `${CONFIG_BASE}/spells.json`,
  characters: `${CONFIG_BASE}/characters.json`,
  monsters: `${CONFIG_BASE}/monsters.json`,
  maps: `${CONFIG_BASE}/maps_3d.json`,
  spawnPoints: `${CONFIG_BASE}/spawn_points.json`,
} as const;

async function fetchJson<T>(url: string): Promise<T> {
  const r = await fetch(url, { cache: "no-cache" });
  if (!r.ok) throw new Error(`Failed to load ${url}: ${r.status}`);
  return r.json() as Promise<T>;
}

export interface RawConfigBundle {
  classes: { classes: ClassDefinition[] };
  spells: { spells: Spell[] };
  characters: { characters: CharacterDefinition[] };
  monsters: { monsters: MonsterDefinition[] };
  maps: { maps: Map3DConfig[] };
  spawnPoints: { spawnPoints: SpawnPoint[] };
}

function indexById<T extends { id: string }>(arr: T[]): Record<string, T> {
  const obj: Record<string, T> = {};
  arr.forEach((it) => (obj[it.id] = it));
  return obj;
}

export async function loadEntityRegistry(): Promise<RegistryShape> {
  const [classes, spells, characters, monsters, maps, spawnPoints] = await Promise.all([
    fetchJson<RawConfigBundle["classes"]>(CONFIG_FILES.classes),
    fetchJson<RawConfigBundle["spells"]>(CONFIG_FILES.spells),
    fetchJson<RawConfigBundle["characters"]>(CONFIG_FILES.characters),
    fetchJson<RawConfigBundle["monsters"]>(CONFIG_FILES.monsters),
    fetchJson<RawConfigBundle["maps"]>(CONFIG_FILES.maps),
    fetchJson<RawConfigBundle["spawnPoints"]>(CONFIG_FILES.spawnPoints),
  ]);

  const registry: RegistryShape = {
    classes: indexById(classes.classes),
    spells: indexById(spells.spells),
    characters: indexById(characters.characters),
    monsters: indexById(monsters.monsters),
    maps: indexById(maps.maps),
    spawnPoints: spawnPoints.spawnPoints,
  };

  validateRegistry(registry);
  return registry;
}

/**
 * Verifie les references croisees (classId, spellIds, mapId, modele).
 * Log les erreurs en console — non bloquant pour le POC.
 */
function validateRegistry(reg: RegistryShape): void {
  const errors: string[] = [];

  // Spells references par classes
  for (const cls of Object.values(reg.classes)) {
    cls.startingSpells.forEach((sid) => {
      if (!reg.spells[sid]) errors.push(`Class ${cls.id}: spell '${sid}' missing in spells.json`);
    });
  }

  // Spells + mapId + classId references par characters
  for (const ch of Object.values(reg.characters)) {
    if (ch.classId && !reg.classes[ch.classId]) {
      errors.push(`Character ${ch.id}: class '${ch.classId}' missing`);
    }
    if (ch.startMapId && !reg.maps[ch.startMapId]) {
      errors.push(`Character ${ch.id}: startMap '${ch.startMapId}' missing`);
    }
    (ch.spellIds || []).forEach((sid) => {
      if (!reg.spells[sid]) errors.push(`Character ${ch.id}: spell '${sid}' missing`);
    });
  }

  // Spells references par monsters
  for (const m of Object.values(reg.monsters)) {
    (m.spellIds || []).forEach((sid) => {
      if (!reg.spells[sid]) errors.push(`Monster ${m.id}: spell '${sid}' missing`);
    });
  }

  // Spawn points -> map valide
  reg.spawnPoints.forEach((sp, i) => {
    if (!reg.maps[sp.mapId]) errors.push(`SpawnPoint #${i}: map '${sp.mapId}' missing`);
  });

  if (errors.length) {
    // eslint-disable-next-line no-console
    console.warn("[EntityRegistry] Validation warnings:\n" + errors.map((e) => "  - " + e).join("\n"));
  }
}

/**
 * Helpers pour requetes typiques.
 */
export const RegistryQuery = {
  spawnPointsForMap(reg: RegistryShape, mapId: string): SpawnPoint[] {
    return reg.spawnPoints.filter((s) => s.mapId === mapId);
  },

  findSpawnFor(
    reg: RegistryShape,
    mapId: string,
    kind: "player" | "monster" | "elite" | "boss" | "npc",
    faction?: string,
    tag?: string,
  ): SpawnPoint | null {
    const pts = RegistryQuery.spawnPointsForMap(reg, mapId);
    return (
      pts.find((p) => {
        if (tag && p.tag !== tag) return false;
        if (p.acceptKinds && !p.acceptKinds.includes(kind)) return false;
        if (faction && p.acceptFactions && !p.acceptFactions.includes(faction as any)) return false;
        return true;
      }) || null
    );
  },

  spellsByIds(reg: RegistryShape, ids: string[]): Spell[] {
    return ids.map((id) => reg.spells[id]).filter(Boolean);
  },
};
