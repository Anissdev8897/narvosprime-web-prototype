/**
 * CharacterPersistService.ts - API DB unifie pour la persistance par personnage.
 *
 * Replace localStorage par mysqlQuery via window.narvosLauncher (Electron MySQL).
 * Si mysqlQuery non disponible (mode browser pur), fallback localStorage.
 *
 * APIs :
 *   - Inventaire : getInventory, addItem, removeItem, equipItem, unequipItem
 *   - Quetes     : getQuests, startQuest, updateQuestProgress, completeQuest
 *   - Settings   : getSettings, saveSettings (audio, current map, prefs)
 *   - Items      : getItemDef (catalogue items)
 */

export interface InventoryRow {
  id: number;
  character_id: string;
  item_id: string;
  quantity: number;
  equipped_slot: string | null;
  acquired_at?: string;
}

export interface QuestRow {
  id?: number;
  character_id: string;
  quest_id: string;
  npc_id: string | null;
  state: 'available' | 'active' | 'completed' | 'rewarded';
  kill_count: number;
}

export interface SettingsRow {
  character_id: string;
  audio_music_volume: number;
  audio_sfx_volume: number;
  current_map_id: string | null;
  last_position_json: string | null;
  prefs_json: string | null;
}

export interface ItemDef {
  id: string;
  name: string;
  description: string | null;
  slot: string;
  rarity: 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary';
  bonus: { stat: string; value: number }[] | null;
  buy_price?: number;
  sell_price?: number;
}

function getQuery(): ((sql: string, args: any[]) => Promise<{ ok: boolean; data?: any[]; error?: string }>) | null {
  try {
    const w = window as any;
    if (w?.narvosLauncher?.mysqlQuery) return w.narvosLauncher.mysqlQuery;
  } catch (_) { /* */ }
  return null;
}

/* ============================================================================
 * INVENTAIRE
 * ========================================================================= */

export async function getInventory(characterId: string): Promise<InventoryRow[]> {
  const q = getQuery();
  if (!q) {
    try {
      const s = localStorage.getItem(`fallback_inv_${characterId}`);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  }
  try {
    const r = await q('SELECT * FROM character_inventory WHERE character_id = ?', [characterId]);
    return (r.data as InventoryRow[]) || [];
  } catch (_) { return []; }
}

export async function addItem(characterId: string, itemId: string, quantity: number = 1): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    await q(
      'INSERT INTO character_inventory (character_id, item_id, quantity, equipped_slot) VALUES (?, ?, ?, NULL)',
      [characterId, itemId, quantity]
    );
    return true;
  } catch (_) { return false; }
}

export async function removeItem(characterId: string, invId: number): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    await q('DELETE FROM character_inventory WHERE id = ? AND character_id = ?', [invId, characterId]);
    return true;
  } catch (_) { return false; }
}

/**
 * Equipe un item dans son slot. Desequipe automatiquement l'eventuel item
 * deja equipe sur ce slot.
 */
export async function equipItem(characterId: string, invId: number, slot: string): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    // Desequiper d'abord tout autre item de ce slot
    await q(
      'UPDATE character_inventory SET equipped_slot = NULL WHERE character_id = ? AND equipped_slot = ?',
      [characterId, slot]
    );
    // Equiper celui-ci
    await q(
      'UPDATE character_inventory SET equipped_slot = ? WHERE id = ? AND character_id = ?',
      [slot, invId, characterId]
    );
    return true;
  } catch (_) { return false; }
}

export async function unequipItem(characterId: string, invId: number): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    await q('UPDATE character_inventory SET equipped_slot = NULL WHERE id = ? AND character_id = ?', [invId, characterId]);
    return true;
  } catch (_) { return false; }
}

/* ============================================================================
 * QUETES
 * ========================================================================= */

export async function getQuests(characterId: string): Promise<QuestRow[]> {
  const q = getQuery();
  if (!q) {
    try {
      const s = localStorage.getItem(`fallback_quests_${characterId}`);
      return s ? JSON.parse(s) : [];
    } catch { return []; }
  }
  try {
    const r = await q('SELECT * FROM character_quests WHERE character_id = ?', [characterId]);
    return (r.data as QuestRow[]) || [];
  } catch (_) { return []; }
}

export async function startQuest(characterId: string, questId: string, npcId: string): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    await q(
      `INSERT INTO character_quests (character_id, quest_id, npc_id, state, kill_count)
       VALUES (?, ?, ?, 'active', 0)
       ON DUPLICATE KEY UPDATE state = 'active', kill_count = 0`,
      [characterId, questId, npcId]
    );
    return true;
  } catch (_) { return false; }
}

export async function updateQuestKillCount(characterId: string, questId: string, killCount: number): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    await q(
      'UPDATE character_quests SET kill_count = ? WHERE character_id = ? AND quest_id = ? AND state = "active"',
      [killCount, characterId, questId]
    );
    return true;
  } catch (_) { return false; }
}

export async function incrementAllActiveQuestKills(characterId: string, delta: number = 1): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    await q(
      'UPDATE character_quests SET kill_count = kill_count + ? WHERE character_id = ? AND state = "active"',
      [delta, characterId]
    );
    return true;
  } catch (_) { return false; }
}

export async function completeQuest(characterId: string, questId: string): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    await q(
      `UPDATE character_quests SET state = 'completed', completed_at = NOW()
       WHERE character_id = ? AND quest_id = ?`,
      [characterId, questId]
    );
    return true;
  } catch (_) { return false; }
}

/* ============================================================================
 * SETTINGS
 * ========================================================================= */

export async function getSettings(characterId: string): Promise<SettingsRow | null> {
  const q = getQuery();
  if (!q) return null;
  try {
    const r = await q('SELECT * FROM character_settings WHERE character_id = ?', [characterId]);
    const rows = (r.data as SettingsRow[]) || [];
    return rows[0] || null;
  } catch (_) { return null; }
}

export async function saveSettings(s: Partial<SettingsRow> & { character_id: string }): Promise<boolean> {
  const q = getQuery();
  if (!q) return false;
  try {
    await q(
      `INSERT INTO character_settings (character_id, audio_music_volume, audio_sfx_volume, current_map_id, last_position_json, prefs_json)
       VALUES (?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         audio_music_volume = VALUES(audio_music_volume),
         audio_sfx_volume   = VALUES(audio_sfx_volume),
         current_map_id     = VALUES(current_map_id),
         last_position_json = VALUES(last_position_json),
         prefs_json         = VALUES(prefs_json)`,
      [
        s.character_id,
        s.audio_music_volume ?? 0.4,
        s.audio_sfx_volume ?? 0.5,
        s.current_map_id ?? null,
        s.last_position_json ?? null,
        s.prefs_json ?? null,
      ]
    );
    return true;
  } catch (_) { return false; }
}

/* ============================================================================
 * ITEMS CATALOGUE
 * ========================================================================= */

let _itemCache: Record<string, ItemDef> | null = null;

export async function getAllItems(): Promise<Record<string, ItemDef>> {
  if (_itemCache) return _itemCache;
  const q = getQuery();
  if (!q) {
    _itemCache = {};
    return _itemCache;
  }
  try {
    const r = await q('SELECT * FROM items', []);
    const out: Record<string, ItemDef> = {};
    (r.data as any[] || []).forEach((row) => {
      let bonus: any = null;
      try { if (row.stats_bonus) bonus = JSON.parse(row.stats_bonus); } catch { /* */ }
      out[row.id] = {
        id: row.id, name: row.name, description: row.description,
        slot: row.slot || row.type, rarity: row.rarity || 'common',
        bonus,
        buy_price: row.buy_price, sell_price: row.sell_price,
      };
    });
    _itemCache = out;
    return out;
  } catch (_) { _itemCache = {}; return _itemCache; }
}

export async function getItemDef(itemId: string): Promise<ItemDef | null> {
  const all = await getAllItems();
  return all[itemId] || null;
}

/** Initialise l'inventaire d'un nouveau perso avec les items de base. */
export async function seedStartingInventory(characterId: string): Promise<void> {
  const existing = await getInventory(characterId);
  if (existing.length > 0) return;  // deja seede
  const startingItems = ['helm_01', 'armor_01', 'sword_01', 'amulet_01', 'potion_01', 'potion_02'];
  for (const itemId of startingItems) {
    await addItem(characterId, itemId, itemId.startsWith('potion_') ? 3 : 1);
  }
}
