/**
 * Module de base de données MySQL pour Electron (main process uniquement)
 * Utilise mysql2 pour se connecter à la base de données configurée via DATABASE_URL
 */

import mysql from 'mysql2/promise';
import * as dotenv from 'dotenv';
import { app } from 'electron';
import * as path from 'path';
import bcrypt from 'bcryptjs';

// S'assurer que les variables d'environnement sont chargées
dotenv.config();

// Fallback .env.local pour database.ts
if (!process.env.DATABASE_URL) {
  // En production/dist, __dirname est dans dist-electron/, donc ../.env.local est à la racine du projet
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
}

export interface SavedSceneObject {
  id: string;
  name: string;
  type: 'IMPORTED_MODEL' | 'GEOMETRY' | 'TERRAIN' | 'PROP' | 'PORTAL_TRIGGER' | 'PORTAL_FRAME' | 'PORTAL_LIGHT' | 'SPAWN_PLATFORM';
  position: { x: number; y: number; z: number };
  rotation: { x: number; y: number; z: number };
  scale: { x: number; y: number; z: number };
  material?: {
    type: 'MeshStandardMaterial' | 'MeshBasicMaterial' | 'MeshPhongMaterial';
    color?: number;
    metalness?: number;
    roughness?: number;
    emissive?: number;
    emissiveIntensity?: number;
    map?: string;
    normalMap?: string;
    roughnessMap?: string;
    metallicMap?: string;
    opacity?: number;
    transparent?: boolean;
    alphaTest?: number;
  };
  geometryType?: string;
  modelPath?: string;
  userData?: any;
}

export interface SavedSceneData {
  planetId: string | null;
  sceneMode: string;
  timestamp: number;
  version: string;
  objects: SavedSceneObject[];
  deletedObjectIds?: string[];
  settings?: any;
}

class WorldDatabase {
  private pool: mysql.Pool | null = null;
  private initAttempted = false;

  /**
   * Initialiser la connexion à la base de données
   */
  public async init(): Promise<void> {
    if (this.initAttempted) return;
    this.initAttempted = true;
    try {
      if (this.pool) return;

      const databaseUrl = process.env.DATABASE_URL;

      if (!databaseUrl) {
        throw new Error('DATABASE_URL manquante dans le fichier .env');
      }

      this.pool = mysql.createPool({
        uri: databaseUrl,
        waitForConnections: true,
        connectionLimit: 10,
        queueLimit: 0,
        enableKeepAlive: true,
        keepAliveInitialDelay: 0,
        // Échec rapide si MySQL injoignable (offline) : 3 s au lieu des 10 s par défaut
        // de mysql2 → ne fait pas traîner une tentative de connexion fantôme pendant
        // que l'hydratation côté jeu est déjà retombée sur localStorage (cf. dbStore).
        connectTimeout: 3000
      });

      // Tester la connexion
      const connection = await this.pool.getConnection();
      console.log('✅ Connecté à la base de données MySQL');
      connection.release();

    } catch (error) {
      console.warn('⚠️ MySQL indisponible — persistance locale (IndexedDB/locaStorage) utilisée');
      this.pool = null as unknown as mysql.Pool; // marque comme "tentative faite"
    }
  }

  /**
   * Sauvegarder une scène
   */
  public async saveScene(
    planetId: string | null,
    sceneMode: string,
    objects: SavedSceneObject[],
    version: string = '1.0.0',
    deletedObjectIds?: string[],
    settings?: any
  ): Promise<number> {
    if (!this.pool) await this.init();

    const timestamp = Date.now();
    const planetIdStr = planetId || 'space';
    let connection: mysql.PoolConnection | null = null;

    try {
      connection = await this.pool!.getConnection();
      await connection.beginTransaction();

      // Préparer JSONs
      const deletedObjectIdsJson = deletedObjectIds && deletedObjectIds.length > 0 ? JSON.stringify(deletedObjectIds) : null;
      const settingsJson = settings ? JSON.stringify(settings) : null;

      // 1. Upsert Scene (MySQL ON DUPLICATE KEY UPDATE)
      const saveQuery = `
        INSERT INTO scenes (planet_id, scene_mode, version, global_settings_json, updated_at)
        VALUES (?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE
          version = VALUES(version),
          global_settings_json = VALUES(global_settings_json),
          updated_at = NOW()
      `;
      // Note: "deleted_object_ids" n'est pas dans le schéma SQL fourni précédemment, je vais l'ajouter dans user_data ou similar si besoin, 
      // ou assumer que le schéma a été mis à jour. Pour l'instant je vais stocker deletedObjectIds dans global_settings_json sous une clé spéciale 
      // ou modifier la requête si la colonne existe.
      // D'après le schéma fourni, "scenes" a "global_settings_json". Je vais merger deletedObjectIds dedans pour l'instant.

      const combinedSettings = settings || {};
      if (deletedObjectIds) combinedSettings._deletedObjectIds = deletedObjectIds;
      const combinedSettingsJson = JSON.stringify(combinedSettings);

      await connection.execute(saveQuery, [planetIdStr, sceneMode, version, combinedSettingsJson]);

      // Récupérer l'ID
      const [rows]: any[] = await connection.execute(
        'SELECT id FROM scenes WHERE planet_id = ? AND scene_mode = ?',
        [planetIdStr, sceneMode]
      );

      if (!rows || rows.length === 0) throw new Error('Impossible de récupérer l\'ID de la scène');
      const sceneId = rows[0].id;

      // 2. Supprimer les anciens objets
      await connection.execute('DELETE FROM scene_objects WHERE scene_id = ?', [sceneId]);

      // 3. Insérer les nouveaux objets
      if (objects.length > 0) {
        // MySQL supporte les bulk inserts, mais pour simplifier et gérer les erreurs, on peut boucler ou faire des chunks.
        // On va faire une boucle simple préparée pour la sécurité.
        const insertQuery = `
          INSERT INTO scene_objects (
            scene_id, object_uuid, name, type,
            pos_x, pos_y, pos_z,
            rot_x, rot_y, rot_z,
            scl_x, scl_y, scl_z,
            material_type, color_hex, 
            opacity, is_transparent,
            model_path, user_data_json,
            texture_map_url
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

        for (const obj of objects) {
          await connection.execute(insertQuery, [
            sceneId,
            obj.id,
            obj.name || 'Unknown',
            obj.type,
            obj.position.x, obj.position.y, obj.position.z,
            obj.rotation.x, obj.rotation.y, obj.rotation.z,
            obj.scale.x, obj.scale.y, obj.scale.z,
            obj.material?.type || null,
            obj.material?.color || null,
            obj.material?.opacity ?? 1.0,
            obj.material?.transparent ? 1 : 0,
            obj.modelPath || null,
            obj.userData ? JSON.stringify(obj.userData) : null,
            obj.material?.map || null
          ]);
        }
      }

      await connection.commit();
      console.log(`✅ Scène sauvegardée (ID: ${sceneId}, ${objects.length} objets)`);
      return sceneId;

    } catch (error) {
      if (connection) await connection.rollback();
      console.error('❌ Erreur lors de la sauvegarde de la scène:', error);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  /**
   * Charger une scène
   */
  public async loadScene(planetId: string | null, sceneMode: string): Promise<SavedSceneData | null> {
    if (!this.pool) await this.init();

    const planetIdStr = planetId || 'space';

    try {
      const [scenes]: any[] = await this.pool!.execute(
        'SELECT * FROM scenes WHERE planet_id = ? AND scene_mode = ? LIMIT 1',
        [planetIdStr, sceneMode]
      );

      if (scenes.length === 0) {
        console.log(`ℹ️ Aucune sauvegarde trouvée pour ${planetIdStr} (${sceneMode})`);
        return null;
      }

      const scene = scenes[0];

      const [objectsRows]: any[] = await this.pool!.execute(
        'SELECT * FROM scene_objects WHERE scene_id = ?',
        [scene.id]
      );

      const objects: SavedSceneObject[] = objectsRows.map((row: any) => {
        const obj: SavedSceneObject = {
          id: row.object_uuid,
          name: row.name,
          type: row.type as any,
          position: { x: row.pos_x, y: row.pos_y, z: row.pos_z },
          rotation: { x: row.rot_x, y: row.rot_y, z: row.rot_z },
          scale: { x: row.scl_x, y: row.scl_y, z: row.scl_z },
          userData: row.user_data_json // Driver auto-parses JSON columns usually, else JSON.parse
        };

        if (row.material_type) {
          obj.material = {
            type: row.material_type as any,
            color: row.color_hex,
            opacity: row.opacity,
            transparent: Boolean(row.is_transparent),
            map: row.texture_map_url
          };
        }

        if (row.model_path) obj.modelPath = row.model_path;

        return obj;
      });

      // Extraire settings et deletedObjectIds
      const settings = scene.global_settings_json || {};
      const deletedObjectIds = settings._deletedObjectIds || [];
      if (settings._deletedObjectIds) delete settings._deletedObjectIds;

      return {
        planetId: scene.planet_id === 'space' ? null : scene.planet_id,
        sceneMode: scene.scene_mode,
        timestamp: new Date(scene.updated_at).getTime(),
        version: scene.version,
        objects,
        deletedObjectIds,
        settings
      };

    } catch (error) {
      console.error('❌ Erreur lors du chargement de la scène:', error);
      return null;
    }
  }

  /**
   * Créer un backup
   */
  public async saveBackup(
    planetId: string | null,
    sceneMode: string,
    objects: SavedSceneObject[],
    name: string,
    deletedObjectIds?: string[],
    settings?: any
  ): Promise<number> {
    if (!this.pool) await this.init();

    // Pour simplifier l'implémentation rapide, on va réutiliser saved_scene JSON blob
    // ou créer une entrée dans scene_backups.
    // D'après le schéma: scene_backups (scene_id, backup_name, snapshot_json)

    const planetIdStr = planetId || 'space';
    let connection: mysql.PoolConnection | null = null;

    try {
      connection = await this.pool!.getConnection();

      // Trouver l'ID de la scène parente (ou la créer si elle existe pas ?)
      // On assume qu'elle existe ou on la cherche par mode.
      let [scenes]: any[] = await connection.execute(
        'SELECT id FROM scenes WHERE planet_id = ? AND scene_mode = ?',
        [planetIdStr, sceneMode]
      );

      let sceneId;
      if (scenes.length === 0) {
        // Si pas de scène, on ne peut pas lier le backup (Foreign Key). 
        // Créons une entrée placeholder.
        const [res]: any = await connection.execute(
          'INSERT INTO scenes (planet_id, scene_mode, version) VALUES (?, ?, ?)',
          [planetIdStr, sceneMode, '1.0.0']
        );
        sceneId = res.insertId;
      } else {
        sceneId = scenes[0].id;
      }

      const snapshot = {
        planetId,
        sceneMode,
        timestamp: Date.now(),
        objects,
        deletedObjectIds,
        settings
      };

      const [res]: any = await connection.execute(
        'INSERT INTO scene_backups (scene_id, backup_name, snapshot_json, created_at) VALUES (?, ?, ?, NOW())',
        [sceneId, name, JSON.stringify(snapshot)]
      );

      console.log(`💾 [BACKUP] Backup "${name}" créé (ID: ${res.insertId})`);
      return res.insertId;

    } catch (error) {
      console.error('❌ Erreur création backup:', error);
      throw error;
    } finally {
      if (connection) connection.release();
    }
  }

  /**
   * Charger un backup
   */
  public async loadBackup(backupId: number): Promise<SavedSceneData | null> {
    if (!this.pool) await this.init();

    try {
      const [rows]: any[] = await this.pool!.execute(
        'SELECT snapshot_json FROM scene_backups WHERE id = ?',
        [backupId]
      );

      if (rows.length === 0) return null;

      const snapshot = rows[0].snapshot_json; // Auto-parsed by mysql2 usually if JSON column
      // Si c'est une string (dépend du driver config), on parse
      const data = typeof snapshot === 'string' ? JSON.parse(snapshot) : snapshot;

      return data as SavedSceneData;
    } catch (error) {
      console.error('❌ Erreur chargement backup:', error);
      return null;
    }
  }

  public async getBackups(planetId: string | null, sceneMode: string): Promise<any[]> {
    if (!this.pool) await this.init();
    const planetIdStr = planetId || 'space';

    try {
      // Join pour filtrer par planetId via scene
      const query = `
            SELECT b.id, b.backup_name as name, b.created_at as timestamp 
            FROM scene_backups b
            JOIN scenes s ON b.scene_id = s.id
            WHERE s.planet_id = ? AND s.scene_mode = ?
            ORDER BY b.created_at DESC
          `;
      const [rows]: any[] = await this.pool!.execute(query, [planetIdStr, sceneMode]);

      return rows.map((r: any) => ({
        id: r.id,
        name: r.name,
        timestamp: new Date(r.timestamp).getTime()
      }));
    } catch (error) {
      console.error('❌ Erreur liste backups:', error);
      return [];
    }
  }

  public async deleteBackup(backupId: number): Promise<void> {
    if (!this.pool) await this.init();
    try {
      await this.pool!.execute('DELETE FROM scene_backups WHERE id = ?', [backupId]);
    } catch (error) {
      console.error('❌ Erreur suppression backup:', error);
    }
  }

  // Méthodes requises pour compatibilité (héritées de l'interface implicite)
  public async deleteScene(planetId: string | null, sceneMode: string): Promise<void> {
    if (!this.pool) await this.init();
    const planetIdStr = planetId || 'space';
    await this.pool!.execute('DELETE FROM scenes WHERE planet_id = ? AND scene_mode = ?', [planetIdStr, sceneMode]);
  }

  public async hasSave(planetId: string | null, sceneMode: string): Promise<boolean> {
    if (!this.pool) await this.init();
    const planetIdStr = planetId || 'space';
    const [rows]: any[] = await this.pool!.execute(
      'SELECT COUNT(*) as count FROM scenes WHERE planet_id = ? AND scene_mode = ?',
      [planetIdStr, sceneMode]
    );
    return rows[0].count > 0;
  }

  public async getAllSaves(): Promise<any[]> {
    if (!this.pool) await this.init();
    const [rows]: any[] = await this.pool!.execute('SELECT planet_id, scene_mode, updated_at, version FROM scenes');
    return rows.map((r: any) => ({
      planetId: r.planet_id,
      sceneMode: r.scene_mode,
      timestamp: new Date(r.updated_at).getTime(),
      version: r.version
    }));
  }

  public async verifyUser(username: string, passwordRaw: string): Promise<{ success: boolean; user?: any; message: string }> {
    if (!this.pool) await this.init();
    try {
      const [rows]: any[] = await this.pool!.execute('SELECT * FROM users WHERE username = ? LIMIT 1', [username]);
      if (rows.length === 0) return { success: false, message: 'Utilisateur non trouvé' };

      const user = rows[0];
      const storedHash = user.password_hash;

      // Détecter le type de hash
      const isBcrypt = storedHash.startsWith('$2a$') || storedHash.startsWith('$2b$') || storedHash.startsWith('$2y$');

      if (!isBcrypt) {
        // Le hash stocke n'est pas bcrypt — refuser l'authentification.
        // Migrer le mot de passe vers bcrypt manuellement avant de retenter.
        return { success: false, message: 'Mot de passe incorrect' };
      }

      const match = await bcrypt.compare(passwordRaw, storedHash);
      if (match) {
        return { success: true, user: { id: user.id, username: user.username, role: user.role }, message: 'Connexion réussie' };
      }
      return { success: false, message: 'Mot de passe incorrect' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  }

  public async getCharacters(username: string, serverId: string): Promise<any[]> {
    if (!this.pool) await this.init();
    try {
      const [userRows]: any[] = await this.pool!.execute('SELECT id FROM users WHERE username = ?', [username]);
      if (userRows.length === 0) return [];
      const userId = userRows[0].id;

      const [charRows]: any[] = await this.pool!.execute(
        'SELECT * FROM characters WHERE user_id = ? AND server_id = ?',
        [userId, serverId]
      );
      return charRows.map((row: any) => ({
        id: row.id,
        name: row.name,
        classId: row.class_id,
        faction: row.faction,
        level: row.level,
        experience: row.experience,
        gender: row.gender,
        customization: typeof row.customization_json === 'string' ? JSON.parse(row.customization_json) : row.customization_json,
        lastPosition: typeof row.position_json === 'string' ? JSON.parse(row.position_json) : row.position_json,
        lastFactionName: row.last_faction_name || null,
        lastMapName: row.last_map_name || null,
        stats: typeof row.stats_json === 'string' ? JSON.parse(row.stats_json) : row.stats_json,
      }));
    } catch (e) {
      console.error('Erreur récupération personnages:', e);
      return [];
    }
  }

  public async createCharacter(username: string, serverId: string, character: any): Promise<{ success: boolean; message: string }> {
    if (!this.pool) await this.init();
    try {
      const [userRows]: any[] = await this.pool!.execute('SELECT id FROM users WHERE username = ?', [username]);
      if (userRows.length === 0) return { success: false, message: 'Utilisateur non trouvé' };
      const userId = userRows[0].id;

      // UPSERT logic for character (useful for updating location/stats)
      const query = `
        INSERT INTO characters (id, user_id, server_id, name, class_id, faction, level, experience, gender, customization_json, position_json, stats_json, last_faction_name, last_map_name, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        ON DUPLICATE KEY UPDATE 
          level = VALUES(level),
          experience = VALUES(experience),
          position_json = VALUES(position_json),
          stats_json = VALUES(stats_json),
          last_faction_name = VALUES(last_faction_name),
          last_map_name = VALUES(last_map_name),
          updated_at = NOW()
      `;

      await this.pool!.execute(query, [
        character.id || `char_${Date.now()}`,
        userId,
        serverId || 'normal_1',
        character.name || 'Ame Neuve',
        character.classId || character.class || 'PRESSURE_MANIPULATOR',
        character.faction || 'Station_Spatiale',
        character.level || 1,
        character.experience || 0,
        character.gender || 'MALE',
        JSON.stringify(character.customization || {}),
        JSON.stringify(character.lastPosition || { x: 0, y: 1, z: 0 }),
        JSON.stringify(character.stats || { hp: 100, maxHp: 100, ap: 6, mp: 3 }),
        character.lastFactionName || null,
        character.lastMapName || null
      ]);

      return { success: true, message: 'Personnage créé ou mis à jour avec succès' };
    } catch (e: any) {
      console.error('Erreur création personnage:', e);
      return { success: false, message: e.message };
    }
  }

  public async query(sql: string, params: any[] = []): Promise<{ data: any[]; error?: string }> {
    if (!this.pool) {
      if (!this.initAttempted) await this.init();
      if (!this.pool) return { data: [], error: 'MySQL non disponible — fallback localStorage' };
    }
    try {
      const [rows] = await this.pool!.execute(sql, params);
      return { data: rows as any[] };
    } catch (e: any) {
      console.error('❌ [MySQL Query Error]:', e.message);
      return { data: [], error: e.message };
    }
  }

  public close(): void {
    if (this.pool) {
      this.pool.end();
      this.pool = null;
    }
  }
}

// Singleton
let worldDatabaseInstance: WorldDatabase | null = null;
export function getWorldDatabase(): WorldDatabase {
  if (!worldDatabaseInstance) {
    worldDatabaseInstance = new WorldDatabase();
  }
  return worldDatabaseInstance;
}