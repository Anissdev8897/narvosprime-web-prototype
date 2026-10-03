import {
  MapProp,
  CharacterState,
  SavedMap,
  SavedObject,
  SavedSprite,
  SavedCharacter,
  SavedFactionMap,
  ClassData,
  Merchant
} from '../types';

// --- HACHAGE DE PLACEHOLDER (jamais un mot de passe) ---
// Legacy MySQL : on crée une ligne `users` pour la clé étrangère d'un personnage.
// On n'a PAS de mot de passe ici, mais on n'écrit JAMAIS de clair dans une colonne
// `password_hash`. On stocke un PBKDF2-HMAC-SHA256 de l'identifiant (sel aléatoire,
// 1000 itérations — même coût que le serveur Lua `Comptes.lua`). Valeur jamais
// vérifiable en tant qu'identifiant : ce n'est qu'un filler non-récupérable.
async function hacherPlaceholder(username: string): Promise<string> {
  const enc = new TextEncoder();
  const sel = new Uint8Array(16);
  crypto.getRandomValues(sel);
  const selHex = Array.from(sel).map((b) => b.toString(16).padStart(2, '0')).join('');
  const iters = 1000;
  const base = await crypto.subtle.importKey('raw', enc.encode(username), 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: sel, iterations: iters, hash: 'SHA-256' }, base, 256);
  const hash = Array.from(new Uint8Array(bits)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `${selHex}:${iters}:${hash}`;
}

// --- CONFIG ---
const DB_NAME = 'DofusLikeDB';
const DB_VERSION = 4;

// --- ELECTRON DETECTION (using preload-exposed API) ---
const narvosLauncher = typeof window !== 'undefined' ? (window as any).narvosLauncher : null;
const isElectron = !!narvosLauncher?.isElectron;

console.log(`%c[Storage] Electron detected: ${isElectron}`, isElectron ? 'color: green; font-weight: bold' : 'color: red; font-weight: bold');
console.log(`%c[Storage] narvosLauncher available:`, 'color: blue', narvosLauncher ? Object.keys(narvosLauncher) : 'null');

// Test database connection immediately
if (isElectron && narvosLauncher?.mysqlQuery) {
  narvosLauncher.mysqlQuery('SELECT 1 as test', []).then((result: any) => {
    if (result?.error) {
      console.error('%c[Storage] ❌ DATABASE CONNECTION FAILED:', 'color: red; font-weight: bold; font-size: 16px', result.error);
    } else {
      console.log('%c[Storage] ✅ DATABASE CONNECTION SUCCESS!', 'color: green; font-weight: bold; font-size: 16px', result);
    }
  }).catch((err: any) => {
    console.error('%c[Storage] ❌ DATABASE CONNECTION ERROR:', 'color: red; font-weight: bold; font-size: 16px', err);
  });
}

export const queryMySQL = async (sql: string, params: any[] = []): Promise<any> => {
  if (!isElectron || !narvosLauncher?.mysqlQuery) {
    console.warn('[Storage] MySQL not available - not in Electron or API not exposed');
    return { error: "Not in Electron" };
  }
  return await narvosLauncher.mysqlQuery(sql, params);
};

// --- AUTO-CLEANUP: Delete IndexedDB in Electron mode ---
// This ensures we only use MySQL and no ghost browser saves remain
if (isElectron && typeof indexedDB !== 'undefined') {
  indexedDB.deleteDatabase(DB_NAME);
  console.log('[Storage] IndexedDB auto-deleted (Electron mode - using MySQL only).');
}

// --- DB HELPER ---
let dbInstance: IDBDatabase | null = null;

const getDB = (): Promise<IDBDatabase> => {
  return new Promise((resolve, reject) => {
    if (dbInstance) {
      resolve(dbInstance);
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      console.log(`[Storage] Upgrading DB to version ${DB_VERSION}`);

      if (!db.objectStoreNames.contains('maps')) db.createObjectStore('maps', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('sprites')) db.createObjectStore('sprites', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('objects')) db.createObjectStore('objects', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('characters')) db.createObjectStore('characters', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('faction_maps')) db.createObjectStore('faction_maps', { keyPath: 'id' });
      if (!db.objectStoreNames.contains('merchants')) db.createObjectStore('merchants', { keyPath: 'id' });
    };

    request.onsuccess = (event) => {
      dbInstance = (event.target as IDBOpenDBRequest).result;
      resolve(dbInstance);
    };

    request.onerror = (event) => {
      console.error("[Storage] DB Open Error:", (event.target as IDBOpenDBRequest).error);
      reject((event.target as IDBOpenDBRequest).error);
    };
  });
};

// --- CLEAR ALL LOCAL STORAGE ---
export const clearAllLocalStorage = async (): Promise<boolean> => {
  return new Promise((resolve) => {
    // Close existing connection
    if (dbInstance) {
      dbInstance.close();
      dbInstance = null;
    }

    // Delete the entire database
    const deleteRequest = indexedDB.deleteDatabase(DB_NAME);

    deleteRequest.onsuccess = () => {
      console.log('[Storage] IndexedDB completely deleted.');
      resolve(true);
    };

    deleteRequest.onerror = () => {
      console.error('[Storage] Failed to delete IndexedDB.');
      resolve(false);
    };

    deleteRequest.onblocked = () => {
      console.warn('[Storage] IndexedDB deletion blocked. Close all tabs using this database.');
      resolve(false);
    };
  });
};

// --- GENERIC HELPERS ---
const getItem = <T>(storeName: string, id: string): Promise<T | null> => {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  });
};

const setItem = (storeName: string, item: any): Promise<void> => {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.put(item);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
};

export const deleteItem = (storeName: string, id: string): Promise<void> => {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readwrite');
      const store = transaction.objectStore(storeName);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  });
};

export const getAllItems = <T>(storeName: string): Promise<T[]> => {
  return getDB().then(db => {
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(storeName, 'readonly');
      const store = transaction.objectStore(storeName);
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error);
    });
  });
};

// --- EXPORTS ---

// SPRITES
export const getSavedSprite = async (classId: string | number, gender: string, headIndex: number, config?: ClassData['spriteConfig']): Promise<string | null> => {
  const key = `${classId}_${gender}_${headIndex}`;

  if (isElectron) {
    try {
      const res = await queryMySQL('SELECT sprite_data FROM class_sprites WHERE id = ?', [key]);
      if (res.data && res.data.length > 0) {
        return res.data[0].sprite_data;
      }
    } catch (e) {
      console.error("[Storage] Sprite MySQL Fetch Error:", e);
    }
  }

  const local = await getItem<SavedSprite>('sprites', key);
  if (local) return local.dataUrl;

  if (config) {
    const isMale = gender === 'M' || gender === 'male';
    const localPath = isMale ? config.malePath : config.femalePath;
    return localPath || null;
  }

  return null;
};

export const saveSprite = async (classId: string | number, gender: string, headIndex: number, dataUrl: string) => {
  const key = `${classId}_${gender}_${headIndex}`;
  let storageValue = dataUrl;

  if (isElectron && narvosLauncher) {
    try {
      let folderName = classId.toString().toLowerCase();
      if (headIndex > 0) folderName = `${folderName}/VARIANTS`;
      const fullGender = gender === 'M' || gender === 'male' ? 'male' : 'female';
      const fileName = `${classId}_${fullGender}_${headIndex}.png`;

      const relativePath = await narvosLauncher.saveImageToDisk(
        `personnage/${folderName}`,
        fileName,
        dataUrl
      );
      if (relativePath) storageValue = relativePath;

      await queryMySQL('INSERT INTO class_sprites (id, sprite_data, created_at) VALUES (?, ?, NOW()) ON DUPLICATE KEY UPDATE sprite_data = VALUES(sprite_data)', [key, storageValue]);
      await deleteItem('sprites', key);
    } catch (e) {
      console.error("[Storage] Sprite Save Error:", e);
    }
  } else {
    await setItem('sprites', { id: key, dataUrl: storageValue });
  }
};

// MAPS
export const getSavedMap = async (x: number, y: number): Promise<SavedMap | null> => {
  const key = `${x},${y}`;

  if (isElectron) {
    try {
      const res = await queryMySQL('SELECT * FROM generated_maps_2d WHERE id = ?', [key]);
      if (res.data && res.data.length > 0) {
        const row = res.data[0];

        if (row.image_url && row.image_url.includes('meshy.ai')) {
          await queryMySQL('DELETE FROM generated_maps_2d WHERE id = ?', [key]).catch(() => { });
          return null;
        }

        return {
          id: row.id,
          imageUrl: row.image_url,
          props: typeof row.props_json === 'string' ? JSON.parse(row.props_json) : row.props_json,
          theme: row.theme
        };
      }
    } catch (e) {
      console.error("[Storage] Map Fetch Error:", e);
    }
  }

  const local = await getItem<SavedMap>('maps', key);
  if (local) return local;

  return null;
};

export const saveMap = async (x: number, y: number, imageUrl: string, props: MapProp[], theme?: string) => {
  const key = `${x},${y}`;
  if (imageUrl && imageUrl.includes('meshy.ai')) return;

  if (isElectron) {
    try {
      let finalImageUrl = imageUrl;

      // 1. Sauvegarde locale de l'image si c'est un base64 (généré par IA)
      if (imageUrl.startsWith('data:') && narvosLauncher?.saveImageToDisk) {
        const regionFolder = theme || 'unknown';
        const fileName = `map_${x}_${y}.png`;

        console.log(`[Storage] Saving map to local disk: dofus_maps/${regionFolder}/${fileName}`);
        const relativePath = await narvosLauncher.saveImageToDisk(
          `dofus_maps/${regionFolder}`,
          fileName,
          imageUrl
        );
        if (relativePath) {
          finalImageUrl = relativePath;
          console.log(`[Storage] Map disk path: ${finalImageUrl}`);
        }
      }

      const propsJson = JSON.stringify(props);
      await queryMySQL('INSERT INTO generated_maps_2d (id, image_url, props_json, theme, created_at) VALUES (?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE image_url = VALUES(image_url), props_json = VALUES(props_json), theme = VALUES(theme)', [key, finalImageUrl, propsJson, theme || null]);
      await deleteItem('maps', key);
      console.log(`[Storage] Map (${x},${y}) saved to MySQL (Region: ${theme}).`);
    } catch (e) {
      console.error("[Storage] Map Sync Error:", e);
    }
  } else {
    await setItem('maps', { id: key, imageUrl, props, theme });
  }
};
export const getAllMaps = async (): Promise<SavedMap[]> => {
  if (isElectron) {
    try {
      const res = await queryMySQL('SELECT * FROM generated_maps_2d');
      if (res.data) {
        return res.data.map((row: any) => ({
          id: row.id,
          imageUrl: row.image_url,
          props: typeof row.props_json === 'string' ? JSON.parse(row.props_json) : row.props_json,
          theme: row.theme
        }));
      }
    } catch (e) {
      console.error("[Storage] GetAllMaps MySQL Fetch Error:", e);
    }
  }
  return await getAllItems<SavedMap>('maps');
};

/** Clé de stockage pour une map du menu régions (ville / extérieur / donjon) */
export const getRegionMapKey = (regionId: string, mapType: 'ville' | 'exterieur' | 'donjon', index: number) =>
  `${regionId}_${mapType}_${index}`;

export const getSavedRegionMap = async (regionId: string, mapType: 'ville' | 'exterieur' | 'donjon', index: number): Promise<SavedMap | null> => {
  const key = getRegionMapKey(regionId, mapType, index);
  return getSavedRegionMapByKey(key);
};

export const getSavedRegionMapByKey = async (key: string): Promise<SavedMap | null> => {
  if (isElectron) {
    try {
      const res = await queryMySQL('SELECT * FROM generated_maps_2d WHERE id = ?', [key]);
      if (res.data && res.data.length > 0) {
        const row = res.data[0];
        return { id: row.id, imageUrl: row.image_url, props: typeof row.props_json === 'string' ? JSON.parse(row.props_json || '[]') : (row.props_json || []), theme: row.theme };
      }
    } catch (e) {
      console.error("[Storage] Region map fetch error:", e);
    }
  }
  const local = await getItem<SavedMap>('maps', key);
  return local;
};

export const saveRegionMap = async (regionId: string, mapType: 'ville' | 'exterieur' | 'donjon', index: number, imageUrl: string, props: MapProp[], theme?: string) => {
  const key = getRegionMapKey(regionId, mapType, index);
  if (imageUrl && imageUrl.includes('meshy.ai')) return;
  if (isElectron) {
    try {
      let finalImageUrl = imageUrl;
      if (imageUrl.startsWith('data:') && narvosLauncher?.saveImageToDisk) {
        const folder = `dofus_maps/${theme || regionId}/${mapType}`;
        const fileName = `map_${index}.png`;
        const relativePath = await narvosLauncher.saveImageToDisk(folder, fileName, imageUrl);
        if (relativePath) finalImageUrl = relativePath;
      }
      const propsJson = JSON.stringify(props || []);
      await queryMySQL('INSERT INTO generated_maps_2d (id, image_url, props_json, theme, created_at) VALUES (?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE image_url = VALUES(image_url), props_json = VALUES(props_json), theme = VALUES(theme)', [key, finalImageUrl, propsJson, theme || regionId]);
    } catch (e) {
      console.error("[Storage] Region map save error:", e);
    }
  } else {
    await setItem('maps', { id: key, imageUrl, props: props || [], theme });
  }
};

// OBJECTS
export const getSavedObjects = async (): Promise<SavedObject[]> => {
  if (isElectron) {
    try {
      const res = await queryMySQL('SELECT * FROM game_objects_2d');
      if (res.data) return res.data.map((r: any) => ({ id: r.id, name: r.name, url: r.image_url }));
    } catch (e) { }
  }
  return await getAllItems<SavedObject>('objects');
};

export const getSavedMerchants = async (): Promise<Merchant[]> => {
  if (isElectron) {
    try {
      const res = await queryMySQL('SELECT * FROM monsters WHERE ai_behavior = "neutral" OR id LIKE "npc_%"');
      if (res.data) {
        return res.data.map((m: any) => {
          // L'inventaire est stocké dans stats_json.inventory (pas de colonne inventory_json)
          const stats = typeof m.stats_json === 'string' ? JSON.parse(m.stats_json || '{}') : (m.stats_json || {});
          const inventory = Array.isArray(stats.inventory) ? stats.inventory : [];
          return {
            id: m.id,
            name: m.name,
            subtitle: 'Marchand',
            type: 'general',
            spriteUrl: m.sprite_url,
            inventory,
            buyFactor: 0.5
          };
        });
      }
    } catch (e) { }
  }
  return [];
};

export const saveObjectToBank = async (obj: SavedObject) => {
  if (isElectron) {
    try {
      await queryMySQL('INSERT INTO game_objects_2d (id, name, image_url, type) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE name = VALUES(name), image_url = VALUES(image_url)', [obj.id, obj.name, obj.url, 'prop']);
      await deleteItem('objects', obj.id);
    } catch (e) { }
  } else {
    // Web Mode: Envoi au serveur via WebSocket
    try {
      if (socket) {
        await socket.saveAsset({
          type: 'prop',
          id: obj.id,
          name: obj.name,
          base64Content: obj.url, // Contient le base64
          metadata: { propType: 'prop' }
        });
      }
    } catch (e) {
      console.warn('[Storage] Server save failed, keeping in local DB');
    }
    await setItem('objects', obj);
  }
};

import { socket } from '../../net/socket';

// CHARACTERS

/**
 * Résultat d'une lecture du roster.
 *
 * ── POURQUOI CE TYPE PLUTÔT QU'UN TABLEAU ────────────────────────────────────
 *
 * « Aucun personnage » et « impossible de savoir » se ressemblent — un tableau
 * vide — mais commandent des actions OPPOSÉES :
 *
 *   ok, []        → le joueur n'a pas de personnage : l'envoyer en création.
 *   unavailable   → la source est muette : afficher une erreur, ne RIEN décider.
 *
 * Les confondre a deux conséquences mesurables : une panne réseau de 2 s
 * enverrait un joueur existant en création forcée (donc un doublon), et une
 * purge déclenchée sur un roster « vide » fantôme serait irrattrapable.
 */
export type CharacterFetchResult =
  | { status: 'ok'; characters: SavedCharacter[] }
  | { status: 'unavailable'; reason: string };

/**
 * Lit le roster en distinguant l'échec de l'absence.
 *
 * `getSavedCharacters` reste disponible pour les appelants qui n'ont pas besoin
 * de la nuance ; les décisions destructrices ou irréversibles doivent passer
 * par ici.
 */
export const fetchSavedCharacters = async (
  username?: string | null,
  serverId?: string,
): Promise<CharacterFetchResult> => {
  /** Dernière panne rencontrée — remontée si aucune source ne répond. */
  let panne: string | null = null;

  // PRIORITY 1: Always use MySQL in Electron mode if we have a username
  // This ensures we get the actual persisted data with XP, Aros, etc.
  if (isElectron && username && narvosLauncher?.getCharacters) {
    try {
      const result = await (narvosLauncher as any).getCharacters(username, serverId || 'normal_1');
      if (result.success && result.characters) {
        console.log(`[Storage] ✅ Found ${result.characters.length} character(s) for ${username}`);
        return { status: 'ok', characters: result.characters.map((row: any) => {
            // Conversion to SavedCharacter format if needed
            return {
                ...row,
                gender: String(row.gender).toUpperCase().startsWith('F') ? 'F' : 'M',
                colors: row.customization?.colors || row.colors || {},
                headIndex: row.customization?.headIndex || 0,
                spriteDataUrl: row.customization?.spriteDataUrl || '',
                // Fallback for missing fields if provided by localDB
                createdAt: row.createdAt || Date.now(),
                lastMap: row.lastPosition || row.lastMap || { x: 5, y: 5 }
            };
        }) };
      }
      // `success: false` sans exception : la source a répondu qu'elle ne savait
      // pas. On le retient et on tente le WebSocket, mais on ne l'oublie pas.
      panne = `Electron : ${result?.error ?? 'réponse sans personnages'}`;
      console.warn('[Storage] Electron character fetch returned no data');
    } catch (e) {
      panne = `Electron : ${e instanceof Error ? e.message : String(e)}`;
      console.error('[Storage] Electron character fetch failed:', e);
    }
  }

  // 2. Fallback to WebSocket only if MySQL is not available
  if (socket) {
    return new Promise<CharacterFetchResult>((resolve) => {
      const timeout = setTimeout(() => {
        // Le délai expiré ne signifie PAS « aucun personnage ». Renvoyer un
        // tableau vide ici était la source du faux positif : création forcée
        // sur simple lenteur réseau.
        console.warn('[Storage] Characters fetch timeout');
        resolve({ status: 'unavailable', reason: panne ?? 'délai dépassé (2 s) sur le serveur' });
      }, 2000);

      socket.once('CHARACTERS_LIST', (data) => {
        clearTimeout(timeout);
        const chars = data.characters || [];
        resolve({ status: 'ok', characters: chars.map((row: any) => {
          const customization = typeof row.customization_json === 'string' ? JSON.parse(row.customization_json) : row.customization_json;
          const pos = typeof row.position_json === 'string' ? JSON.parse(row.position_json) : row.position_json;
          return {
            id: row.id,
            name: row.name,
            classId: row.class_id,
            level: row.level || 1,
            gender: String(row.gender).toUpperCase().startsWith('F') ? 'F' : 'M',
            faction: row.faction || 'NEUTRAL',
            colors: customization?.colors || {
              skin: '#e0c19e',
              hair: '#4a3728',
              eyes: '#3b82f6',
              pants: '#1e3a5f',
              shoes: '#2d1f1f',
              jacket: '#5c6bc0',
              tunic1: '#5c6bc0',
              tunic2: '#3949ab'
            },
            headIndex: customization?.headIndex || 0,
            spriteDataUrl: customization?.spriteDataUrl || '',
            lastMap: { x: pos?.x || 0, y: pos?.y || 0 },
            createdAt: new Date(row.created_at || Date.now()).getTime(),
            isFromSql: true
          };
        }) });
      });

      socket.requestCharacters();
    });
  }

  // Aucune source interrogeable.
  //
  // Si une source a été TENTÉE et a échoué, c'est une panne — la signaler.
  // Sinon (ni Electron ni socket : navigateur pur sans serveur), c'est une
  // configuration valide, et l'absence de personnage est la vérité.
  //
  // ⚠ Ce dernier cas ne consulte PAS IndexedDB, alors que `saveCharacter` y
  // écrit en repli. Un joueur en navigateur pur verra donc toujours un roster
  // vide. Comportement pré-existant, laissé tel quel : le corriger touche au
  // flux de sauvegarde, hors du périmètre de cette étape.
  if (panne) return { status: 'unavailable', reason: panne };
  return { status: 'ok', characters: [] };
};

/**
 * Roster sous forme de tableau — façade historique.
 *
 * Une source indisponible y devient un tableau vide : c'est précisément
 * l'ambiguïté que `fetchSavedCharacters` lève. Ne pas l'utiliser pour décider
 * d'une création forcée ni d'une suppression.
 */
export const getSavedCharacters = async (
  username?: string | null,
  serverId?: string,
): Promise<SavedCharacter[]> => {
  const r = await fetchSavedCharacters(username, serverId);
  return r.status === 'ok' ? r.characters : [];
};

export const saveCharacter = async (char: SavedCharacter, username?: string | null, serverId?: string): Promise<string | null> => {
  console.log('[Storage] Attempting to save character:', char.name, { username, isElectron });

  // PRIORITY 1: Always use dedicated Electron handler if available
  if (isElectron && username && (narvosLauncher as any).createCharacter) {
    try {
      console.log('[Storage] Saving via Electron createCharacter bridge...');
      // Wrap customization for bridge consistency
      const charToSave = {
        ...char,
        customization: {
          colors: char.colors,
          headIndex: char.headIndex,
          spriteDataUrl: char.spriteDataUrl,
          serverType: char.serverType,
          isDead: char.isDead
        }
      };
      const result = await (narvosLauncher as any).createCharacter(username, serverId || 'normal_1', charToSave);
      if (result.success) {
        console.log('[Storage] ✅ Character saved successfully via Electron Bridge');
        return char.id;
      } else {
        console.error('[Storage] ❌ Electron createCharacter failed:', result.message);
        // Don't return null yet, try legacy MySQL fallback
      }
    } catch (e) {
      console.error('[Storage] ❌ Electron character save exception:', e);
    }
  }

  // Fallback to legacy MySQL if needed
  if (isElectron && username) {
    try {
      console.log('[Storage] Falling back to legacy MySQL save...');
      let userRes = await queryMySQL('SELECT id FROM users WHERE username = ?', [username]);

      if (!userRes.data || userRes.data.length === 0) {
        console.log('[Storage] Creating local user record...');
        await queryMySQL('INSERT INTO users (username, password_hash, created_at) VALUES (?, ?, NOW())', [username, await hacherPlaceholder(username)]);
        userRes = await queryMySQL('SELECT id FROM users WHERE username = ?', [username]);
      }

      const userId = userRes.data?.[0]?.id;
      if (!userId) {
        console.error('[Storage] ❌ User ID not found, cannot save character to MySQL');
        return null;
      }

      const customization = {
        colors: char.colors,
        headIndex: char.headIndex,
        spriteDataUrl: char.spriteDataUrl,
        serverType: char.serverType,
        isDead: char.isDead
      };

      const position = char.lastMap || { x: 0, y: 0 };
      const xpToSave = Math.floor(char.stats?.experience ?? (char.stats as any)?.experience ?? 0);
      const levelToSave = char.level ?? (char.stats as any)?.niveau ?? 1;
      const lysToSave = Math.floor(Number(char.inventory?.lysAmount ?? 0));
      const mapId = `${position.x},${position.y}`;
      const lastMapName = (char as any).lastMapName || `Map ${position.x},${position.y}`;
      const factionToSave = char.faction || (char as any).faction || 'NEUTRAL';
      const serverIdToSave = serverId || (char.serverType === 'HEROIC' ? 'heroic_1' : 'normal_1');
      const equippedJson = char.equipment ? JSON.stringify(char.equipment) : null;
      const spellsJson = char.spells && char.spells.length > 0 ? JSON.stringify(char.spells) : null;

      console.log('[Storage] Executing MySQL INSERT/UPDATE for character...');
      const result = await queryMySQL(`
        INSERT INTO characters(
          id, user_id, server_id, name, class_id, faction, level, experience,
          gender, money_lys, money_ala, map_id, position_json, last_faction_name, last_map_name,
          stats_json, customization_json, inventory_json, equipped_items_json, spells_unlocked_json,
          updated_at
        )
        VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          faction = VALUES(faction), level = VALUES(level), experience = VALUES(experience),
          money_lys = VALUES(money_lys), position_json = VALUES(position_json), 
          stats_json = VALUES(stats_json), customization_json = VALUES(customization_json),
          updated_at = NOW()
      `, [
        char.id, userId, serverIdToSave, char.name, char.classId, factionToSave, levelToSave, xpToSave,
        char.gender === 'F' ? 'FEMALE' : 'MALE', lysToSave, Math.floor(Number(char.inventory?.alakyrisAmount ?? 0)),
        mapId, JSON.stringify(position), factionToSave, lastMapName,
        JSON.stringify(char.stats || {}), JSON.stringify(customization), JSON.stringify(char.inventory || {}),
        equippedJson, spellsJson
      ]);

      if (!result?.error) {
        console.log('[Storage] ✅ Character saved to MySQL via legacy fallback');
        return char.id;
      } else {
        console.error('[Storage] ❌ MySQL legacy save failed:', result.error);
      }
    } catch (e) {
      console.error('[Storage] ❌ Legacy MySQL save exception:', e);
    }
  }

  // Web / Local Storage Fallback (Warning: will be deleted in Electron)
  if (isElectron) {
    console.warn('[Storage] ⚠️ Character saved to IndexedDB in Electron mode! This will be lost on next launch.');
  }
  await setItem('characters', char);
  return char.id;
};

export const deleteCharacter = async (id: string, username?: string | null): Promise<{ success: boolean; error?: string }> => {
  // PRIORITÉ Electron (comme getSavedCharacters/saveCharacter) : le socket peut
  // exister sans être connecté → l'ancien ordre faisait échouer la suppression.
  if (isElectron && username && narvosLauncher?.deleteCharacter) {
    try {
      await narvosLauncher.deleteCharacter(id, username);
      return { success: true };
    } catch (e) {
      console.error('[Storage] deleteCharacter IPC error:', e);
      return { success: false, error: String(e) };
    }
  }

  // Fallback WebSocket (mode navigateur connecté)
  if (socket) {
    try {
      socket.deleteCharacter(id);
      return { success: true };
    } catch (e) {
      console.error('[Storage] deleteCharacter WebSocket error:', e);
      return { success: false, error: String(e) };
    }
  }

  // Fallback IndexedDB (mode navigateur pur)
  try {
    await deleteItem('characters', id);
    return { success: true };
  } catch (e) {
    console.error('[Storage] deleteCharacter IndexedDB error:', e);
    return { success: false, error: String(e) };
  }
};

// FACTION MAPS
export const getFactionMaps = async (): Promise<SavedFactionMap[]> => {
  if (isElectron) {
    try {
      const res = await queryMySQL('SELECT * FROM faction_maps');
      if (res.data) {
        return res.data.map((r: any) => ({
          id: r.id, name: r.name, theme: r.theme, imageUrl: r.image_url,
          props: typeof r.props_json === 'string' ? JSON.parse(r.props_json) : r.props_json
        }));
      }
    } catch (e) { }
  }
  return await getAllItems<SavedFactionMap>('faction_maps');
};

export const saveFactionMap = async (map: SavedFactionMap) => {
  if (isElectron) {
    try {
      let finalImageUrl = map.imageUrl;

      // 1. Sauvegarde locale de l'image si c'est un base64
      if (map.imageUrl.startsWith('data:') && narvosLauncher?.saveImageToDisk) {
        const regionFolder = map.theme || 'custom';
        const fileName = `faction_map_${map.id}.png`;

        const relativePath = await (narvosLauncher as any).saveImageToDisk(
          `dofus_maps/${regionFolder}`,
          fileName,
          map.imageUrl
        );
        if (relativePath) finalImageUrl = relativePath;
      }

      const propsJson = JSON.stringify(map.props);
      await queryMySQL('INSERT INTO faction_maps (id, name, theme, image_url, props_json, created_at) VALUES (?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE name = VALUES(name), image_url = VALUES(image_url), props_json = VALUES(props_json)', [map.id, map.name, map.theme || 'custom', finalImageUrl, propsJson]);
      await deleteItem('faction_maps', map.id);
    } catch (e) {
      console.error("[Storage] Faction Map Save Error:", e);
    }
  } else {
    await setItem('faction_maps', map);
  }
};

export const syncBreeds = async (breeds: ClassData[]) => {
  if (!isElectron) return;
  try {
    console.log('[Storage] Syncing breeds to MySQL...');
    for (const b of breeds) {
      await queryMySQL(`
        INSERT INTO breeds(id, name, role_title, description, faction, colors_json, stats_json, sprite_config_json, roles_json)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?) 
        ON DUPLICATE KEY UPDATE
      name = VALUES(name),
        role_title = VALUES(role_title),
        description = VALUES(description),
        faction = VALUES(faction),
        colors_json = VALUES(colors_json),
        stats_json = VALUES(stats_json),
        sprite_config_json = VALUES(sprite_config_json),
        roles_json = VALUES(roles_json)
          `, [
        b.id,
        b.name,
        b.roleTitle,
        b.description,
        b.faction || null,
        JSON.stringify(b.colors),
        JSON.stringify(b.stats),
        b.spriteConfig ? JSON.stringify(b.spriteConfig) : null,
        b.roles ? JSON.stringify(b.roles) : null
      ]);
    }
    console.log(`[Storage] Synced ${breeds.length} breeds to MySQL.`);
  } catch (e) {
    console.error('[Storage] Breed sync error:', e);
  }
};

export const getSavedBreeds = async (): Promise<ClassData[]> => {
  if (!isElectron) return [];
  try {
    const res = await queryMySQL('SELECT * FROM breeds');
    if (res.data) {
      console.log(`[Storage] Loaded ${res.data.length} breeds from MySQL.`);
      return res.data.map((row: any) => ({
        id: row.id,
        name: row.name,
        roleTitle: row.role_title,
        description: row.description,
        faction: row.faction,
        colors: typeof row.colors_json === 'string' ? JSON.parse(row.colors_json) : row.colors_json,
        stats: typeof row.stats_json === 'string' ? JSON.parse(row.stats_json) : row.stats_json,
        spriteConfig: row.sprite_config_json ? (typeof row.sprite_config_json === 'string' ? JSON.parse(row.sprite_config_json) : row.sprite_config_json) : undefined,
        roles: row.roles_json ? (typeof row.roles_json === 'string' ? JSON.parse(row.roles_json) : row.roles_json) : [],
        spells: [] // Spells are loaded separately from the spells table
      }));
    }
  } catch (e) {
    console.error('[Storage] Breed fetch error:', e);
  }
  return [];
};

export const deleteFactionMap = async (id: string) => {
  await deleteItem('faction_maps', id);
};

// SPELLS
export interface CombatSpell {
  id: string;
  classId: string;
  name: string;
  description: string;
  icon: string;
  paCost: number;
  pmCost: number;
  minRange: number;
  maxRange: number;
  cooldown: number;
  usesPerTurn: number;
  zoneShape: 'single' | 'circle' | 'cross' | 'line' | 'cone' | 'square';
  zoneSize: number;
  effectType: 'projectile' | 'area' | 'self' | 'melee';
  color: string;
  targetType: 'self' | 'ally' | 'enemy' | 'cell' | 'all_enemies' | 'all_allies' | 'zone';
  type: 'offense' | 'defense' | 'control' | 'support' | 'movement';
  effects: any[];
  animationConfig?: any;
  currentLevel: number;
  maxLevel: number;
  levelRequired: number;
  lineOfSight: boolean;
  modifiableRange: boolean;
}

export const getSpellsByClassId = async (classId: string): Promise<CombatSpell[]> => {
  if (!isElectron) return [];

  try {
    const res = await queryMySQL('SELECT * FROM spells WHERE class_id = ?', [classId]);
    if (res.data && res.data.length > 0) {
      return res.data.map((row: any) => ({
        id: row.id,
        classId: row.class_id,
        name: row.name,
        description: row.description || '',
        icon: row.icon || 'zap',
        paCost: row.pa_cost || 3,
        pmCost: row.pm_cost || 0,
        minRange: row.min_range || 1,
        maxRange: row.max_range || 5,
        cooldown: row.cooldown || 1,
        usesPerTurn: row.uses_per_turn || 2,
        zoneShape: (row.zone_shape || 'single') as CombatSpell['zoneShape'],
        zoneSize: row.zone_size || 1,
        effectType: (row.effect_type || 'projectile') as CombatSpell['effectType'],
        color: row.color || '#ffffff',
        targetType: (row.target_type || 'enemy') as CombatSpell['targetType'],
        type: (row.spell_type || 'offense') as CombatSpell['type'],
        effects: typeof row.effects_json === 'string' ? JSON.parse(row.effects_json) : (row.effects_json || []),
        animationConfig: typeof row.animation_config_json === 'string' ? JSON.parse(row.animation_config_json) : row.animation_config_json,
        currentLevel: 1,
        maxLevel: 9,
        levelRequired: 1,
        lineOfSight: true,
        modifiableRange: false
      }));
    }
  } catch (e) {
    console.error("[Storage] Spell Fetch Error:", e);
  }
  return [];
};

export const syncSpellsFromData = async (spells: any[], classId: string) => {
  if (!isElectron) return;

  try {
    for (const s of spells) {
      const elementMap: Record<string, string> = {
        'earth': 'terre', 'fire': 'feu', 'water': 'eau', 'air': 'air', 'neutral': 'neutre', 'heal': 'neutre'
      };

      const effects = s.damage ? [{
        type: s.damage.element === 'heal' ? 'heal' : 'damage',
        element: elementMap[s.damage.element] || 'neutre',
        value: Math.floor((s.damage.min + s.damage.max) / 2)
      }] : [];

      const effectsJson = JSON.stringify(effects);
      const animConfigJson = s.animationConfig ? JSON.stringify(s.animationConfig) : null;

      await queryMySQL(`
        INSERT INTO spells(id, class_id, name, description, icon, pa_cost, pm_cost, min_range, max_range, cooldown, uses_per_turn, zone_shape, zone_size, effect_type, color, target_type, spell_type, effects_json, animation_config_json)
      VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON DUPLICATE KEY UPDATE name = VALUES(name), effects_json = VALUES(effects_json), animation_config_json = VALUES(animation_config_json)
        `, [
        s.id, classId, s.name, s.description || '', s.icon || 'zap',
        s.apCost || 3, 0, s.minRange || 1, s.range || 5, 1, 2,
        s.effectType === 'area' ? 'circle' : 'single', s.effectType === 'area' ? 2 : 1,
        s.effectType || 'projectile', s.color || '#ffffff',
        s.damage?.element === 'heal' ? 'ally' : 'enemy',
        s.damage?.element === 'heal' ? 'support' : 'offense',
        effectsJson, animConfigJson
      ]);
    }
    console.log(`[Storage] Synced ${spells.length} spells for class $ { classId } to MySQL.`);
  } catch (e) {
    console.error("[Storage] Spell Sync Error:", e);
  }
};

// MERCHANTS

export const saveMerchant = async (merchant: Merchant) => {
  if (isElectron && narvosLauncher) {
    try {
      // 1. Save to JSON for backup/config
      await narvosLauncher.saveJsonData(`merchant_${merchant.id}.json`, merchant);

      // 2. Save to MySQL monsters table (colonnes: id, name, level, sprite_url, ai_behavior, stats_json pour stocker inventory)
      const statsForMerchant = { inventory: merchant.inventory || [] };
      await queryMySQL(`
        INSERT INTO monsters(id, name, level, sprite_url, ai_behavior, stats_json)
        VALUES(?, ?, 1, ?, 'neutral', ?)
        ON DUPLICATE KEY UPDATE
          name = VALUES(name),
          sprite_url = VALUES(sprite_url),
          ai_behavior = VALUES(ai_behavior),
          stats_json = VALUES(stats_json)
      `, [merchant.id, merchant.name, merchant.spriteUrl || null, JSON.stringify(statsForMerchant)]);

      console.log(`[Storage] Merchant ${merchant.name} saved to JSON and MySQL.`);
    } catch (e) {
      console.error("Failed to save merchant", e);
    }
  } else {
    await setItem('merchants', merchant);
  }
};

export const getSavedMerchant = async (id: string): Promise<Merchant | null> => {
  if (isElectron) {
    const res = await queryMySQL('SELECT * FROM monsters WHERE id = ?', [id]);
    if (res.data && res.data.length > 0) {
      const m = res.data[0];
      const stats = typeof m.stats_json === 'string' ? JSON.parse(m.stats_json || '{}') : (m.stats_json || {});
      const inventory = stats.inventory ?? (typeof (m as any).inventory_json === 'string' ? JSON.parse((m as any).inventory_json || '[]') : ((m as any).inventory_json || []));
      return {
        id: m.id,
        name: m.name,
        subtitle: 'Marchand',
        type: 'general',
        spriteUrl: m.sprite_url,
        inventory: Array.isArray(inventory) ? inventory : [],
        buyFactor: 0.5
      };
    }
    return null;
  }
  return await getItem<Merchant>('merchants', id);
};
