/**
 * ScenePersistService.ts - Gestion de la persistance des scènes NoclipForge.
 * 
 * Permet de sauvegarder et charger :
 * - Le point de spawn global de la scène.
 * - Les réglages d'ambiance (intensité lumineuse, etc.).
 * - Les objets placés manuellement.
 */

export interface SceneSettings {
  spawnPoint: { x: number; y: number; z: number };
  ambientIntensity?: number;
  sunIntensity?: number;
}

export interface SceneObject {
  id: string;
  type: string;
  pos: [number, number, number];
  rot?: [number, number, number];
  scale?: number;
}

function getQuery(): ((sql: string, args: any[]) => Promise<{ ok: boolean; data?: any[]; error?: string }>) | null {
  try {
    const w = window as any;
    if (w?.narvosLauncher?.mysqlQuery) return w.narvosLauncher.mysqlQuery;
  } catch (_) { /* */ }
  return null;
}

/** Charge les réglages globaux d'une scène. */
export async function getSceneSettings(planetId: string): Promise<SceneSettings | null> {
  const q = getQuery();
  if (!q) return null;
  try {
    const r = await q('SELECT global_settings_json FROM scenes WHERE planet_id = ?', [planetId]);
    if (r.ok && r.data && r.data[0]) {
      const json = r.data[0].global_settings_json;
      return typeof json === 'string' ? JSON.parse(json) : json;
    }
  } catch (_) { /* */ }
  return null;
}

/** Sauvegarde les réglages globaux d'une scène. */
export async function saveSceneSettings(planetId: string, settings: SceneSettings): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    // S'assurer que la scène existe avant d'update
    await q(
      `INSERT IGNORE INTO scenes (planet_id, scene_mode, version, updated_at) VALUES (?, 'planet', '1.0.0', NOW())`,
      [planetId]
    );

    const json = JSON.stringify(settings);
    await q(
      'UPDATE scenes SET global_settings_json = ?, updated_at = NOW() WHERE planet_id = ? AND scene_mode = "planet"',
      [json, planetId]
    );
    return true;
  } catch (_) { return false; }
}

/** Charge les objets d'une scène. */
export async function getSceneObjects(planetId: string): Promise<SceneObject[]> {
  const q = getQuery();
  if (!q) return [];
  try {
    const r = await q(
      'SELECT object_uuid as id, type, pos_x, pos_y, pos_z, rot_x, rot_y, rot_z FROM scene_objects WHERE scene_id = (SELECT id FROM scenes WHERE planet_id = ? AND scene_mode = "planet" LIMIT 1)',
      [planetId]
    );
    if (r.ok && r.data) {
      return r.data.map(row => ({
        id: row.id,
        type: row.type,
        pos: [row.pos_x, row.pos_y, row.pos_z],
        rot: row.rot_x !== undefined ? [row.rot_x, row.rot_y, row.rot_z] : [0, 0, 0]
      }));
    }
  } catch (_) { /* */ }
  return [];
}

/** Sauvegarde un objet dans la scène. */
export async function saveSceneObject(planetId: string, obj: SceneObject): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    // S'assurer que la scène existe (sinon la sous-requête renverra NULL et MySQL plantera)
    await q(
      `INSERT IGNORE INTO scenes (planet_id, scene_mode, version, updated_at) VALUES (?, 'planet', '1.0.0', NOW())`,
      [planetId]
    );

    const r = obj.rot || [0, 0, 0];
    await q(
      `INSERT INTO scene_objects (scene_id, object_uuid, name, type, pos_x, pos_y, pos_z, rot_x, rot_y, rot_z) 
       VALUES ((SELECT id FROM scenes WHERE planet_id = ? AND scene_mode = "planet" LIMIT 1), ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE pos_x = VALUES(pos_x), pos_y = VALUES(pos_y), pos_z = VALUES(pos_z), rot_x = VALUES(rot_x), rot_y = VALUES(rot_y), rot_z = VALUES(rot_z)`,
      [planetId, obj.id, obj.id, obj.type, obj.pos[0], obj.pos[1], obj.pos[2], r[0], r[1], r[2]]
    );
    return true;
  } catch (_) { return false; }
}

/** Supprime un objet de la scène. */
export async function deleteSceneObject(planetId: string, objectUuid: string): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    await q(
      'DELETE FROM scene_objects WHERE object_uuid = ? AND scene_id = (SELECT id FROM scenes WHERE planet_id = ? AND scene_mode = "planet" LIMIT 1)',
      [objectUuid, planetId]
    );
    return true;
  } catch (_) { return false; }
}
