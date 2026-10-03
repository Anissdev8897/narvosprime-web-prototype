/**
 * 🗄️ NARVOS PRIME - DATABASE SERVICE (Electron SQLite)
 * 
 * Base de données locale SQLite pour le mode offline/standalone.
 * Se connecte automatiquement et crée la base si elle n'existe pas.
 * 
 * Comportement:
 * - Premier lancement: Crée automatiquement la base de données
 * - Lancements suivants: Se connecte à la base existante
 */

import Database from 'better-sqlite3';
import { app } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import bcrypt from 'bcryptjs';
import { translateMySqlToSqlite } from './sqlTranslate';

// =====================================================
// 📁 CONFIGURATION
// =====================================================

const DB_NAME = 'worldnevaros.db';
const DB_VERSION = '1.0.0';

export interface SavedSceneObject {
    id: string;
    name: string;
    type: 'IMPORTED_MODEL' | 'GEOMETRY' | 'TERRAIN' | 'PROP' | 'PORTAL_TRIGGER' | 'PORTAL_FRAME' | 'PORTAL_LIGHT' | 'SPAWN_PLATFORM';
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
    material?: any;
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

// =====================================================
// 🗄️ CLASSE DATABASE SERVICE
// =====================================================

class LocalDatabaseService {
    private db: Database.Database | null = null;
    private dbPath: string = '';
    private isNewDatabase: boolean = false;

    constructor() { }

    /**
     * Initialiser la connexion à la base de données
     * Crée la base si elle n'existe pas
     */
    public async init(): Promise<{ success: boolean; isNew: boolean; message: string }> {
        try {
            if (this.db) {
                console.log('ℹ️ [DB] Base de données déjà connectée');
                return { success: true, isNew: false, message: 'Déjà connecté' };
            }

            // Déterminer le chemin de la base de données
            const userDataPath = app.getPath('userData');
            const dbDir = path.join(userDataPath, 'database');
            this.dbPath = path.join(dbDir, DB_NAME);

            // Vérifier si la base existe déjà
            const dbExists = fs.existsSync(this.dbPath);
            this.isNewDatabase = !dbExists;

            // Créer le dossier si nécessaire
            if (!fs.existsSync(dbDir)) {
                fs.mkdirSync(dbDir, { recursive: true });
                console.log(`📁 [DB] Dossier créé: ${dbDir}`);
            }

            // Ouvrir/Créer la base de données
            this.db = new Database(this.dbPath);

            // ⚠ `createTables()` s'exécute à CHAQUE ouverture, pas seulement sur
            // une base neuve.
            //
            // Tous les `CREATE TABLE` sont `IF NOT EXISTS` : l'appel est
            // idempotent et coûte quelques millisecondes. En le laissant sous
            // `if (isNewDatabase)`, toute table ajoutée par la suite n'atteignait
            // QUE les installations neuves — les `worldnevaros.db` existants
            // restaient définitivement sans les nouvelles tables, sans erreur et
            // sans moyen de s'en apercevoir.
            this.createTables();

            if (this.isNewDatabase) {
                console.log('═══════════════════════════════════════════════════════');
                console.log('🆕 [DB] CRÉATION DE LA BASE DE DONNÉES');
                console.log(`   📍 Chemin: ${this.dbPath}`);
                console.log('═══════════════════════════════════════════════════════');
                console.log('✅ [DB] Base de données créée avec succès!');
                console.log(`   📊 Version: ${DB_VERSION}`);

                return {
                    success: true,
                    isNew: true,
                    message: `Base de données créée: ${this.dbPath}`
                };
            } else {
                console.log('═══════════════════════════════════════════════════════');
                console.log('🔗 [DB] CONNEXION À LA BASE DE DONNÉES EXISTANTE');
                console.log(`   📍 Chemin: ${this.dbPath}`);
                console.log('═══════════════════════════════════════════════════════');

                // Vérifier l'intégrité
                const integrity = this.checkIntegrity();
                if (!integrity.valid) {
                    console.warn('⚠️ [DB] Problèmes d\'intégrité détectés:', integrity.issues);
                }

                console.log('✅ [DB] Connexion établie avec succès!');

                return {
                    success: true,
                    isNew: false,
                    message: `Connecté à la base existante: ${this.dbPath}`
                };
            }
        } catch (error: any) {
            console.error('═══════════════════════════════════════════════════════');
            console.error('❌ [DB] ERREUR DE CONNEXION');
            console.error(`   Message: ${error.message}`);
            console.error('═══════════════════════════════════════════════════════');

            return {
                success: false,
                isNew: false,
                message: `Erreur: ${error.message}`
            };
        }
    }

    /**
     * Créer les tables de la base de données
     */
    private createTables(): void {
        if (!this.db) throw new Error('Base de données non initialisée');

        console.log('📋 [DB] Création des tables...');

        // Table de métadonnées
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS db_metadata (
                key TEXT PRIMARY KEY,
                value TEXT,
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);

        // Insérer la version
        this.db.prepare(`
            INSERT OR REPLACE INTO db_metadata (key, value, updated_at)
            VALUES ('version', ?, strftime('%s', 'now'))
        `).run(DB_VERSION);

        // Table des utilisateurs
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT UNIQUE NOT NULL,
                password_hash TEXT NOT NULL,
                registered_at INTEGER DEFAULT (strftime('%s', 'now')),
                last_login INTEGER,
                settings_json TEXT
            )
        `);
        console.log('   ✓ Table: users');

        // Table des personnages
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS characters (
                id TEXT PRIMARY KEY,
                user_id INTEGER REFERENCES users(id),
                server_id TEXT DEFAULT 'normal_1',
                name TEXT NOT NULL,
                class TEXT NOT NULL,
                faction TEXT NOT NULL,
                level INTEGER DEFAULT 1,
                experience INTEGER DEFAULT 0,
                customization_json TEXT,
                last_position_json TEXT,
                last_faction_name TEXT,
                last_map_name TEXT,
                last_planet_id TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);
        console.log('   ✓ Table: characters');

        // Table des scènes
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS scenes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                planet_id TEXT NOT NULL,
                scene_mode TEXT NOT NULL DEFAULT 'PLAY',
                version TEXT DEFAULT '1.0.0',
                global_settings_json TEXT,
                created_at INTEGER DEFAULT (strftime('%s', 'now')),
                updated_at INTEGER DEFAULT (strftime('%s', 'now')),
                UNIQUE(planet_id, scene_mode)
            )
        `);
        console.log('   ✓ Table: scenes');

        // Table des objets de scène
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS scene_objects (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scene_id INTEGER REFERENCES scenes(id) ON DELETE CASCADE,
                object_uuid TEXT NOT NULL,
                name TEXT,
                type TEXT NOT NULL,
                pos_x REAL DEFAULT 0,
                pos_y REAL DEFAULT 0,
                pos_z REAL DEFAULT 0,
                rot_x REAL DEFAULT 0,
                rot_y REAL DEFAULT 0,
                rot_z REAL DEFAULT 0,
                scl_x REAL DEFAULT 1,
                scl_y REAL DEFAULT 1,
                scl_z REAL DEFAULT 1,
                material_json TEXT,
                model_path TEXT,
                user_data_json TEXT
            )
        `);
        console.log('   ✓ Table: scene_objects');

        // Table des backups
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS scene_backups (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                scene_id INTEGER REFERENCES scenes(id),
                backup_name TEXT NOT NULL,
                snapshot_json TEXT NOT NULL,
                created_at INTEGER DEFAULT (strftime('%s', 'now'))
            )
        `);
        console.log('   ✓ Table: scene_backups');

        // Table d'inventaire
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS inventory (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                character_id TEXT REFERENCES characters(id),
                item_id TEXT NOT NULL,
                quantity INTEGER DEFAULT 1,
                slot INTEGER,
                data_json TEXT
            )
        `);
        console.log('   ✓ Table: inventory');

        // ── État RPG : les deux tables qui portent TOUTE la persistance ────────
        //
        // Elles n'existaient nulle part côté SQLite. Le renderer les créait
        // lui-même via `db:mysqlQuery`, mais avec un DDL contenant
        // `ON UPDATE CURRENT_TIMESTAMP` — syntaxe MySQL que SQLite rejette.
        // `ensureSchema` échouait donc, les tables n'étaient jamais créées, et
        // ni la progression des personnages ni le contenu du monde n'était
        // persisté en base. En permanence, sans le moindre message.
        //
        // Clés primaires COMPOSITES, sans colonne `id` : c'est ce que
        // `sqlTranslate.CONFLICT_KEYS` doit refléter pour que les upserts
        // aboutissent.
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS character_state (
                character_id TEXT NOT NULL,
                state_key    TEXT NOT NULL,
                value_json   TEXT NOT NULL,
                updated_at   INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (character_id, state_key)
            )
        `);
        console.log('   ✓ Table: character_state');

        this.db.exec(`
            CREATE TABLE IF NOT EXISTS world_state (
                scope      TEXT NOT NULL,
                state_key  TEXT NOT NULL,
                value_json TEXT NOT NULL,
                updated_at INTEGER NOT NULL DEFAULT 0,
                PRIMARY KEY (scope, state_key)
            )
        `);
        console.log('   ✓ Table: world_state');

        // ✅ NOUVEAU : Tables pour le moteur 2D (compatibilité storage.ts)
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS generated_maps_2d (
                id TEXT PRIMARY KEY,
                image_url TEXT,
                props_json TEXT,
                theme TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS game_objects_2d (
                id TEXT PRIMARY KEY,
                name TEXT,
                image_url TEXT,
                type TEXT
            )
        `);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS class_sprites (
                id TEXT PRIMARY KEY,
                sprite_data TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS faction_maps (
                id TEXT PRIMARY KEY,
                name TEXT,
                theme TEXT,
                image_url TEXT,
                props_json TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        `);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS breeds (
                id TEXT PRIMARY KEY,
                name TEXT,
                role_title TEXT,
                description TEXT,
                faction TEXT,
                colors_json TEXT,
                stats_json TEXT,
                sprite_config_json TEXT,
                roles_json TEXT
            )
        `);
        this.db.exec(`
            CREATE TABLE IF NOT EXISTS monsters (
                id TEXT PRIMARY KEY,
                name TEXT,
                sprite_url TEXT,
                ai_behavior TEXT,
                stats_json TEXT
            )
        `);
        console.log('   ✓ Tables 2D Engine (Maps, Sprites, Monsters)');

        // Index pour performances
        this.db.exec(`
            CREATE INDEX IF NOT EXISTS idx_scenes_planet ON scenes(planet_id);
            CREATE INDEX IF NOT EXISTS idx_objects_scene ON scene_objects(scene_id);
            CREATE INDEX IF NOT EXISTS idx_characters_user ON characters(user_id);
        `);
        console.log('   ✓ Index créés');

        console.log('📋 [DB] Toutes les tables ont été créées');
    }

    /**
     * Vérifier l'intégrité de la base de données
     */
    private checkIntegrity(): { valid: boolean; issues: string[] } {
        if (!this.db) return { valid: false, issues: ['Base non initialisée'] };

        const issues: string[] = [];

        try {
            // Vérifier l'intégrité SQLite
            const result = this.db.pragma('integrity_check') as any[];
            if (result[0]?.integrity_check !== 'ok') {
                issues.push('Échec du test d\'intégrité SQLite');
            }

            // Vérifier que les tables existent
            const tables = ['users', 'characters', 'scenes', 'scene_objects', 'scene_backups'];
            const existingTables = this.db.prepare(`
                SELECT name FROM sqlite_master WHERE type='table'
            `).all().map((t: any) => t.name);

            for (const table of tables) {
                if (!existingTables.includes(table)) {
                    issues.push(`Table manquante: ${table}`);
                }
            }

        } catch (e: any) {
            issues.push(`Erreur de vérification: ${e.message}`);
        }

        return { valid: issues.length === 0, issues };
    }

    // =====================================================
    // 👤 GESTION UTILISATEURS
    // =====================================================

    public registerUser(username: string, passwordHash: string): boolean {
        if (!this.db) return false;

        try {
            this.db.prepare(`
                INSERT INTO users (username, password_hash) VALUES (?, ?)
            `).run(username, passwordHash);

            console.log(`👤 [DB] Utilisateur créé: ${username}`);
            return true;
        } catch (e: any) {
            if (e.message.includes('UNIQUE')) {
                console.log(`👤 [DB] Utilisateur existe déjà: ${username}`);
            } else {
                console.error(`❌ [DB] Erreur création utilisateur:`, e.message);
            }
            return false;
        }
    }

    public getUser(username: string): any {
        if (!this.db) return null;

        return this.db.prepare(`
            SELECT * FROM users WHERE username = ?
        `).get(username);
    }

    public updateUserLastLogin(username: string): void {
        if (!this.db) return;

        this.db.prepare(`
            UPDATE users SET last_login = strftime('%s', 'now') WHERE username = ?
        `).run(username);
    }

    // =====================================================
    // 👤 GESTION PERSONNAGES
    // =====================================================

    /**
     * Personnages d'un utilisateur.
     *
     * ⚠ LÈVE quand la base n'est pas initialisée, au lieu de renvoyer `[]`.
     *
     * `main.ts` emballe le retour en `{ success: true, characters }` : un `[]`
     * de panne ressortait donc comme un SUCCÈS avec zéro personnage. Le
     * garde-fou côté client (`CharacterFetchResult` / `unavailable`) ne pouvait
     * rien voir — la panne arrivait déguisée en succès.
     *
     * Conséquence mesurée : une init SQLite échouée (fichier verrouillé, disque
     * plein, migration ratée) envoyait un joueur possédant 3 personnages sur
     * l'écran de création forcée. Il en recréait un → doublon en base, anciens
     * personnages toujours présents mais invisibles.
     *
     * En revanche, un utilisateur INCONNU renvoie bien `[]` : c'est une absence
     * légitime, pas une panne.
     */
    public async getCharacters(username: string, serverId: string): Promise<any[]> {
        if (!this.db) throw new Error('Base de données non initialisée');

        const user = this.getUser(username);
        if (!user) return [];

        const rows = this.db.prepare(`
            SELECT * FROM characters WHERE user_id = ? AND server_id = ?
        `).all(user.id, serverId) as any[];

        return rows.map(row => ({
            id: row.id,
            name: row.name,
            classId: row.class,
            faction: row.faction,
            level: row.level,
            experience: row.experience,
            customization: row.customization_json ? JSON.parse(row.customization_json) : {},
            lastPosition: row.last_position_json ? JSON.parse(row.last_position_json) : null,
            lastFactionName: row.last_faction_name,
            lastMapName: row.last_map_name,
            lastPlanetId: row.last_planet_id
        }));
    }

    public async createCharacter(username: string, serverId: string, char: any): Promise<{ success: boolean; message: string }> {
        if (!this.db) return { success: false, message: 'Database not initialized' };

        const user = this.getUser(username);
        if (!user) return { success: false, message: 'User not found' };

        try {
            this.db.prepare(`
                INSERT INTO characters (
                    id, user_id, server_id, name, class, faction, 
                    level, experience, customization_json, last_position_json,
                    last_faction_name, last_map_name, last_planet_id, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, strftime('%s', 'now'))
                ON CONFLICT(id) DO UPDATE SET
                    level = excluded.level,
                    experience = excluded.experience,
                    last_position_json = excluded.last_position_json,
                    customization_json = excluded.customization_json,
                    last_faction_name = excluded.last_faction_name,
                    last_map_name = excluded.last_map_name,
                    last_planet_id = excluded.last_planet_id,
                    updated_at = strftime('%s', 'now')
            `).run(
                char.id,
                user.id,
                serverId,
                char.name,
                char.classId || char.class || 'PRESSURE_MANIPULATOR',
                char.faction,
                char.level || 1,
                char.experience || 0,
                JSON.stringify(char.customization || {}),
                JSON.stringify(char.lastPosition || { x: 0, y: 1, z: 0 }),
                char.lastFactionName || null,
                char.lastMapName || null,
                char.lastPlanetId || null
            );

            return { success: true, message: 'Personnage créé ou mis à jour' };
        } catch (e: any) {
            console.error('❌ [SQLite] Erreur createCharacter:', e);
            return { success: false, message: e.message };
        }
    }

    public verifyUser(username: string, passwordRaw: string): { success: boolean, user?: any, message: string } {
        if (!this.db) return { success: false, message: 'DB not init' };

        const user = this.getUser(username);
        if (!user) return { success: false, message: 'User not found' };

        const storedHash = user.password_hash;
        const isBcrypt = storedHash?.startsWith('$2a$') || storedHash?.startsWith('$2b$') || storedHash?.startsWith('$2y$');

        if (!isBcrypt) {
            // Le hash stocke n'est pas bcrypt — refuser l'authentification.
            return { success: false, message: 'Mot de passe incorrect' };
        }

        const match = bcrypt.compareSync(passwordRaw, storedHash);
        if (match) {
            this.updateUserLastLogin(username);
            return { success: true, user: { id: user.id, username: user.username, role: 'ADMIN' }, message: 'Success' };
        }
        return { success: false, message: 'Mot de passe incorrect' };
    }

    // =====================================================
    // 💾 GESTION SCÈNES
    // =====================================================

    public async saveScene(
        planetId: string | null,
        sceneMode: string,
        objects: SavedSceneObject[],
        version: string = '1.0.0',
        deletedObjectIds?: string[],
        settings?: any
    ): Promise<number> {
        if (!this.db) throw new Error('Base non initialisée');

        const planetIdStr = planetId || 'space';

        // Combiner settings avec deletedObjectIds
        const combinedSettings = { ...settings, _deletedObjectIds: deletedObjectIds };

        // Upsert scene
        this.db.prepare(`
            INSERT INTO scenes (planet_id, scene_mode, version, global_settings_json, updated_at)
            VALUES (?, ?, ?, ?, strftime('%s', 'now'))
            ON CONFLICT(planet_id, scene_mode) DO UPDATE SET
                version = excluded.version,
                global_settings_json = excluded.global_settings_json,
                updated_at = strftime('%s', 'now')
        `).run(planetIdStr, sceneMode, version, JSON.stringify(combinedSettings));

        // Obtenir l'ID
        const scene = this.db.prepare(`
            SELECT id FROM scenes WHERE planet_id = ? AND scene_mode = ?
        `).get(planetIdStr, sceneMode) as any;

        const sceneId = scene.id;

        // Supprimer anciens objets
        this.db.prepare('DELETE FROM scene_objects WHERE scene_id = ?').run(sceneId);

        // Insérer nouveaux objets
        const insertStmt = this.db.prepare(`
            INSERT INTO scene_objects (
                scene_id, object_uuid, name, type,
                pos_x, pos_y, pos_z,
                rot_x, rot_y, rot_z,
                scl_x, scl_y, scl_z,
                material_json, model_path, user_data_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);

        const insertMany = this.db.transaction((objs: SavedSceneObject[]) => {
            for (const obj of objs) {
                insertStmt.run(
                    sceneId,
                    obj.id,
                    obj.name || 'Unknown',
                    obj.type,
                    obj.position.x, obj.position.y, obj.position.z,
                    obj.rotation.x, obj.rotation.y, obj.rotation.z,
                    obj.scale.x, obj.scale.y, obj.scale.z,
                    obj.material ? JSON.stringify(obj.material) : null,
                    obj.modelPath || null,
                    obj.userData ? JSON.stringify(obj.userData) : null
                );
            }
        });

        insertMany(objects);

        console.log(`💾 [DB] Scène sauvegardée: ${planetIdStr} (${objects.length} objets)`);
        return sceneId;
    }

    public async loadScene(planetId: string | null, sceneMode: string): Promise<SavedSceneData | null> {
        if (!this.db) return null;

        const planetIdStr = planetId || 'space';

        const scene = this.db.prepare(`
            SELECT * FROM scenes WHERE planet_id = ? AND scene_mode = ?
        `).get(planetIdStr, sceneMode) as any;

        if (!scene) {
            console.log(`ℹ️ [DB] Pas de sauvegarde pour ${planetIdStr}`);
            return null;
        }

        const objectsRows = this.db.prepare(`
            SELECT * FROM scene_objects WHERE scene_id = ?
        `).all(scene.id) as any[];

        const objects: SavedSceneObject[] = objectsRows.map(row => ({
            id: row.object_uuid,
            name: row.name,
            type: row.type,
            position: { x: row.pos_x, y: row.pos_y, z: row.pos_z },
            rotation: { x: row.rot_x, y: row.rot_y, z: row.rot_z },
            scale: { x: row.scl_x, y: row.scl_y, z: row.scl_z },
            material: row.material_json ? JSON.parse(row.material_json) : undefined,
            modelPath: row.model_path,
            userData: row.user_data_json ? JSON.parse(row.user_data_json) : undefined
        }));

        const settings = scene.global_settings_json ? JSON.parse(scene.global_settings_json) : {};
        const deletedObjectIds = settings._deletedObjectIds || [];
        delete settings._deletedObjectIds;

        console.log(`📂 [DB] Scène chargée: ${planetIdStr} (${objects.length} objets)`);

        return {
            planetId: scene.planet_id === 'space' ? null : scene.planet_id,
            sceneMode: scene.scene_mode,
            timestamp: scene.updated_at * 1000,
            version: scene.version,
            objects,
            deletedObjectIds,
            settings
        };
    }

    public async hasSave(planetId: string | null, sceneMode: string): Promise<boolean> {
        if (!this.db) return false;

        const planetIdStr = planetId || 'space';
        const result = this.db.prepare(`
            SELECT COUNT(*) as count FROM scenes WHERE planet_id = ? AND scene_mode = ?
        `).get(planetIdStr, sceneMode) as any;

        return result.count > 0;
    }

    public async deleteScene(planetId: string | null, sceneMode: string): Promise<void> {
        if (!this.db) return;

        const planetIdStr = planetId || 'space';
        this.db.prepare(`
            DELETE FROM scenes WHERE planet_id = ? AND scene_mode = ?
        `).run(planetIdStr, sceneMode);

        console.log(`🗑️ [DB] Scène supprimée: ${planetIdStr}`);
    }

    public async getAllSaves(): Promise<any[]> {
        if (!this.db) return [];

        return this.db.prepare(`
            SELECT planet_id, scene_mode, updated_at, version FROM scenes
        `).all().map((r: any) => ({
            planetId: r.planet_id,
            sceneMode: r.scene_mode,
            timestamp: r.updated_at * 1000,
            version: r.version
        }));
    }

    // =====================================================
    // 💾 GESTION BACKUPS
    // =====================================================

    public async saveBackup(
        planetId: string | null,
        sceneMode: string,
        objects: SavedSceneObject[],
        name: string,
        deletedObjectIds?: string[],
        settings?: any
    ): Promise<number> {
        if (!this.db) throw new Error('Base non initialisée');

        const planetIdStr = planetId || 'space';

        // Trouver ou créer la scène
        let scene = this.db.prepare(`
            SELECT id FROM scenes WHERE planet_id = ? AND scene_mode = ?
        `).get(planetIdStr, sceneMode) as any;

        if (!scene) {
            this.db.prepare(`
                INSERT INTO scenes (planet_id, scene_mode, version) VALUES (?, ?, ?)
            `).run(planetIdStr, sceneMode, '1.0.0');
            scene = this.db.prepare(`
                SELECT id FROM scenes WHERE planet_id = ? AND scene_mode = ?
            `).get(planetIdStr, sceneMode) as any;
        }

        const snapshot = JSON.stringify({
            planetId,
            sceneMode,
            timestamp: Date.now(),
            objects,
            deletedObjectIds,
            settings
        });

        const result = this.db.prepare(`
            INSERT INTO scene_backups (scene_id, backup_name, snapshot_json)
            VALUES (?, ?, ?)
        `).run(scene.id, name, snapshot) as any;

        console.log(`💾 [DB] Backup créé: "${name}" (ID: ${result.lastInsertRowid})`);
        return result.lastInsertRowid as number;
    }

    public async loadBackup(backupId: number): Promise<SavedSceneData | null> {
        if (!this.db) return null;

        const backup = this.db.prepare(`
            SELECT snapshot_json FROM scene_backups WHERE id = ?
        `).get(backupId) as any;

        if (!backup) return null;

        return JSON.parse(backup.snapshot_json);
    }

    public async getBackups(planetId: string | null, sceneMode: string): Promise<any[]> {
        if (!this.db) return [];

        const planetIdStr = planetId || 'space';

        return this.db.prepare(`
            SELECT b.id, b.backup_name as name, b.created_at as timestamp
            FROM scene_backups b
            JOIN scenes s ON b.scene_id = s.id
            WHERE s.planet_id = ? AND s.scene_mode = ?
            ORDER BY b.created_at DESC
        `).all(planetIdStr, sceneMode).map((r: any) => ({
            id: r.id,
            name: r.name,
            timestamp: r.timestamp * 1000
        }));
    }

    public async deleteBackup(backupId: number): Promise<void> {
        if (!this.db) return;

        this.db.prepare('DELETE FROM scene_backups WHERE id = ?').run(backupId);
    }

    // =====================================================
    // 🔧 UTILITAIRES
    // =====================================================

    public getStats(): any {
        if (!this.db) return null;

        return {
            path: this.dbPath,
            isNew: this.isNewDatabase,
            users: (this.db.prepare('SELECT COUNT(*) as c FROM users').get() as any).c,
            characters: (this.db.prepare('SELECT COUNT(*) as c FROM characters').get() as any).c,
            scenes: (this.db.prepare('SELECT COUNT(*) as c FROM scenes').get() as any).c,
            backups: (this.db.prepare('SELECT COUNT(*) as c FROM scene_backups').get() as any).c
        };
    }

    /**
     * Exécuter une requête SQL brute (compatibilité legacy)
     */
    public async query(sql: string, params: any[] = []): Promise<{ data: any[]; error?: string }> {
        if (!this.db) return { data: [], error: 'Base non initialisée' };

        try {
            // La traduction MySQL -> SQLite vit dans `sqlTranslate.ts`, module
            // PUR et couvert par 18 tests portant sur les requêtes réelles du
            // dépôt. Elle était auparavant écrite en trois `.replace()` ici
            // même : l'un d'eux mutilait la clause `VALUES(...)` de l'INSERT
            // dès qu'elle s'écrivait sans espace — la requête de sauvegarde de
            // personnage, donc.
            const t = translateMySqlToSqlite(sql);
            const sqliteSql = t.sql;

            if (t.assumedDefaultKey) {
                // Table inconnue : conflit supposé sur `id`, ce qui échouera si
                // sa clé est composite. Le dire transforme un échec muet en indice.
                console.warn(`⚠️ [SQLite] upsert sur "${t.table}" : conflit supposé sur (id). Déclarer la table dans CONFLICT_KEYS si sa clé est composite.`);
            }

            // Si c'est un SELECT
            if (sqliteSql.trim().toUpperCase().startsWith('SELECT')) {
                const data = this.db.prepare(sqliteSql).all(params);
                return { data };
            }

            // Sinon c'est un INSERT/UPDATE/DELETE
            const result = this.db.prepare(sqliteSql).run(params);
            return { data: [], ...result };

        } catch (e: any) {
            console.error('❌ [SQLite Query Error]:', e.message, '| SQL:', sql);
            return { data: [], error: e.message };
        }
    }

    public close(): void {
        if (this.db) {
            this.db.close();
            this.db = null;
            console.log('🔒 [DB] Connexion fermée');
        }
    }
}

// =====================================================
// 📤 EXPORT SINGLETON
// =====================================================

let localDatabaseInstance: LocalDatabaseService | null = null;

export function getLocalDatabase(): LocalDatabaseService {
    if (!localDatabaseInstance) {
        localDatabaseInstance = new LocalDatabaseService();
    }
    return localDatabaseInstance;
}

export default LocalDatabaseService;