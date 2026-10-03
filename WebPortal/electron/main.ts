/**
 * Processus principal Electron pour NARVOS PRIME
 * Gère la création de la fenêtre et les événements système
 */

import { app, BrowserWindow, Menu, shell, ipcMain, session } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import * as dotenv from 'dotenv';
import { autoUpdater } from 'electron-updater';
import { resolveDevTarget } from './devTarget';

// Charger les variables d'environnement
dotenv.config();

// Fallback: Si DATABASE_URL n'est pas trouvé, essayer .env.local
if (!process.env.DATABASE_URL) {
  dotenv.config({ path: path.join(__dirname, '../.env.local') });
}

// Debug des variables chargées
console.log('🔧 [MAIN] Environment:', {
  DATABASE_URL: process.env.DATABASE_URL ? 'Définie (masquée)' : 'NON DÉFINIE',
  NODE_ENV: process.env.NODE_ENV
});

// Déclaration pour TypeScript (__dirname sera disponible après compilation CommonJS)
declare const __dirname: string;

// Mode développement
const isDev = process.env.NODE_ENV === 'development' || !app.isPackaged;

// ── Cible du dev-server ──────────────────────────────────────────────────────
//
// Le jeu tourne sur 3005 ; les prototypes ont leur propre serveur (3006) pour
// que les deux puissent tourner EN MÊME TEMPS. Sans ça, lancer un prototype
// pendant que le jeu tourne échoue sur « Port 3005 is already in use ».
//
// 🔒 `origine` alimente aussi la liste blanche de `will-navigate` plus bas :
// la validation des variables d'environnement vit dans `devTarget.ts`, avec
// ses tests (traversées de chemin et ports fabriqués y sont vérifiés).
const { origine: DEV_ORIGINE, url: DEV_URL } = resolveDevTarget(process.env);

// GPU : Chromium budget par défaut trop bas pour Three.js (crash Skia tryAllocPixels).
app.commandLine.appendSwitch('force-gpu-mem-available-mb', '4096');
app.commandLine.appendSwitch('ignore-gpu-blocklist');
// JS heap : le renderer charge des chunks GLB lourds (~428 MB compressé → 2 GB+ en mémoire).
// Le heap V8 par défaut (~1.5 GB) est insuffisant — monter à 4 GB.
app.commandLine.appendSwitch('js-flags', '--max-old-space-size=4096');

// DEV : le cache HTTP de Chromium ne supporte pas les requêtes RANGE des <video> servies
// par le dev-server Vite → "net::ERR_CACHE_OPERATION_NOT_SUPPORTED" (bénin mais bruyant).
// On désactive le cache HTTP en dev uniquement (les assets sont locaux + caches mémoire
// THREE.Cache/drei côté renderer) ; en prod packagée (file://) le problème n'existe pas.
if (isDev) app.commandLine.appendSwitch('disable-http-cache');

// Garder une référence globale de l'objet window
let mainWindow: BrowserWindow | null = null;

/**
 * Crée la fenêtre principale de l'application
 */
function createWindow(): void {
  // ── Content-Security-Policy (corrige le "Electron Security Warning") ──────────
  // PROD UNIQUEMENT : en dev, Vite injecte des scripts INLINE obligatoires (préambule
  // @vitejs/plugin-react, HMR) — une CSP stricte casse tout le boot (écran noir,
  // "can't detect preamble"). Le warning Electron n'apparaît de toute façon plus une
  // fois l'app packagée. Politique prod SANS 'unsafe-eval' : 'wasm-unsafe-eval' requis
  // (décodeurs Draco/Basis en WebAssembly), 'unsafe-inline' styles (React inline +
  // Google Fonts), MySQL via IPC (aucune origine distante côté renderer).
  if (!isDev) {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'wasm-unsafe-eval'",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "img-src 'self' data: blob:",
      "media-src 'self' blob:",
      "font-src 'self' data: https://fonts.gstatic.com",
      "connect-src 'self' data: blob: ws://localhost:8082",
      "worker-src 'self' blob:",
    ].join("; ");
    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
      callback({
        responseHeaders: { ...details.responseHeaders, "Content-Security-Policy": [csp] },
      });
    });
  }

  // Créer la fenêtre du navigateur
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    minWidth: 1280,
    minHeight: 720,
    backgroundColor: '#0f172a', // Couleur de fond (slate-950)
    titleBarStyle: 'default',
    frame: true,
    show: false, // Ne pas afficher immédiatement
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      nodeIntegration: false, // Sécurité : désactiver nodeIntegration
      contextIsolation: true, // Sécurité : activer contextIsolation
      sandbox: true, // Sandbox Chromium active : isole le renderer au niveau OS
      webSecurity: true,
      allowRunningInsecureContent: false,
    },
    // icon: path.join(getDirname(), '../public/favicon.ico'), // Icône de l'application (optionnel)
  });

  // Charger l'application
  if (isDev) {
    // Mode développement : charger depuis Vite dev server (jeu, ou prototype
    // si NARVOS_PROTO est posé — cf. les scripts `proto:*`).
    console.log(`[MAIN] Dev → ${DEV_URL}`);
    mainWindow.loadURL(DEV_URL);
    // Ouvrir DevTools en développement
    mainWindow.webContents.openDevTools();

    // ── Forward logs console renderer → terminal ──────────────────────────
    // Les console.log/warn/error du renderer sont redirigés vers stdout.
    // Utilise l'API Electron moderne (Event object, plus de positional args).
    mainWindow.webContents.on('console-message', (event) => {
      const { level, message } = event;
      const prefix = level === 'error' ? '🔴' : level === 'warning' ? '⚠️' : '📋';
      console.log(`[RENDERER] ${prefix} ${message}`);
    });
  } else {
    // Mode production : charger depuis les fichiers buildés
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath).catch((err) => {
      console.error('Erreur lors du chargement de index.html:', err);
    });
  }

  // Afficher la fenêtre une fois le contenu chargé
  mainWindow.once('ready-to-show', () => {
    if (mainWindow) {
      mainWindow.show();

      // Focus sur la fenêtre
      if (isDev) {
        mainWindow.focus();
      }
    }
  });

  // Gérer la fermeture de la fenêtre
  mainWindow.on('closed', () => {
    mainWindow = null;
  });

  // Récupération crash GPU : quand le process de rendu meurt (OOM GPU, driver crash),
  // recréer la fenêtre automatiquement au lieu de laisser un écran noir figé.
  mainWindow.webContents.on('render-process-gone', (_event, details) => {
    console.error(`[MAIN] Renderer process gone: ${details.reason} (exit ${details.exitCode})`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
      mainWindow = null;
    }
    setTimeout(() => createWindow(), 1000);
  });

  // Empêcher la navigation vers des URLs externes
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    // 🔒 Sécurité: whitelist protocoles http/https uniquement
    const ALLOWED_PROTOCOLS = ['http:', 'https:'];
    try {
      const parsed = new URL(url);
      if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
        shell.openExternal(url);
      } else {
        console.warn(`🔒 [MAIN] shell.openExternal bloqué (protocole non autorisé): ${parsed.protocol}`);
      }
    } catch {
      console.warn(`🔒 [MAIN] shell.openExternal bloqué (URL invalide): ${url}`);
    }
    return { action: 'deny' };
  });

  // Gérer les liens externes
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    const parsedUrl = new URL(navigationUrl);

    // Autoriser uniquement les URLs locales. `DEV_ORIGINE` est la MÊME
    // constante que celle chargée plus haut : changer de port ne doit jamais
    // désynchroniser la liste blanche de ce qu'on affiche réellement.
    if (parsedUrl.origin !== DEV_ORIGINE && parsedUrl.origin !== 'file://') {
      event.preventDefault();
      // 🔒 Sécurité: whitelist protocoles http/https uniquement
      const ALLOWED_PROTOCOLS = ['http:', 'https:'];
      try {
        const parsed = new URL(navigationUrl);
        if (ALLOWED_PROTOCOLS.includes(parsed.protocol)) {
          shell.openExternal(navigationUrl);
        } else {
          console.warn(`🔒 [MAIN] shell.openExternal bloqué (protocole non autorisé): ${parsed.protocol}`);
        }
      } catch {
        console.warn(`🔒 [MAIN] shell.openExternal bloqué (URL invalide): ${navigationUrl}`);
      }
    }
  });
}

/**
 * Crée le menu de l'application
 */
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'Fichier',
      submenu: [
        {
          label: 'Quitter',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          },
        },
      ],
    },
    {
      label: 'Édition',
      submenu: [
        { role: 'undo', label: 'Annuler' },
        { role: 'redo', label: 'Refaire' },
        { type: 'separator' },
        { role: 'cut', label: 'Couper' },
        { role: 'copy', label: 'Copier' },
        { role: 'paste', label: 'Coller' },
        { role: 'selectAll', label: 'Tout sélectionner' },
      ],
    },
    {
      label: 'Affichage',
      submenu: [
        { role: 'reload', label: 'Recharger' },
        { role: 'forceReload', label: 'Forcer le rechargement' },
        ...(isDev ? [{ role: 'toggleDevTools' as const, label: 'Outils de développement' }] : []),
        { type: 'separator' as const },
        { role: 'resetZoom', label: 'Réinitialiser le zoom' },
        { role: 'zoomIn', label: 'Zoom avant' },
        { role: 'zoomOut', label: 'Zoom arrière' },
        { type: 'separator' as const },
        { role: 'togglefullscreen', label: 'Plein écran' },
      ],
    },
    {
      label: 'Aide',
      submenu: [
        {
          label: 'À propos de NARVOS PRIME',
          click: () => {
            // Afficher une boîte de dialogue "À propos"
            if (mainWindow) {
              mainWindow.webContents.send('show-about');
            }
          },
        },
      ],
    },
  ];

  // Menu spécifique macOS
  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about', label: `À propos de ${app.getName()}` },
        { type: 'separator' },
        { role: 'services', label: 'Services' },
        { type: 'separator' },
        { role: 'hide', label: `Masquer ${app.getName()}` },
        { role: 'hideOthers', label: 'Masquer les autres' },
        { role: 'unhide', label: 'Afficher tout' },
        { type: 'separator' },
        { role: 'quit', label: `Quitter ${app.getName()}` },
      ],
    });
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}

/**
 * Gestionnaires IPC (Inter-Process Communication)
 */
function setupIpcHandlers(): void {
  // Exemple : obtenir la version de l'application
  ipcMain.handle('app:getVersion', () => {
    return app.getVersion();
  });

  // Exemple : obtenir le chemin de l'application
  ipcMain.handle('app:getPath', (event, name: string) => {
    return app.getPath(name as any);
  });

  // Exemple : quitter l'application
  ipcMain.handle('app:quit', () => {
    app.quit();
  });

  // ✅ Handlers IPC pour la base de données
  // Utilise SQLite local par défaut, MySQL si DATABASE_URL est configuré
  let worldDatabase: any = null;
  let getWorldDatabase: (() => any) | null = null;
  let useLocalDb = !process.env.DATABASE_URL; // SQLite si pas de MySQL configuré

  // Initialiser le service de base de données
  ipcMain.handle('db:init', async () => {
    try {
      console.log('═══════════════════════════════════════════════════════');
      console.log('🗄️ [MAIN] INITIALISATION BASE DE DONNÉES');
      console.log('═══════════════════════════════════════════════════════');

      if (useLocalDb) {
        console.log('📦 [MAIN] Mode: SQLite Local (standalone)');
        if (!getWorldDatabase) {
          const dbModule = await import('./localDatabase');
          getWorldDatabase = dbModule.getLocalDatabase;
        }
      } else {
        console.log('🌐 [MAIN] Mode: MySQL (DATABASE_URL détectée)');
        if (!getWorldDatabase) {
          const dbModule = await import('./database');
          getWorldDatabase = dbModule.getWorldDatabase;
        }
      }

      worldDatabase = getWorldDatabase();
      const initResult = await worldDatabase.init();

      // Afficher les stats si disponible
      if (worldDatabase.getStats) {
        const stats = worldDatabase.getStats();
        if (stats) {
          console.log('📊 [MAIN] Stats:', stats);
        }
      }

      return {
        success: true,
        mode: useLocalDb ? 'sqlite' : 'mysql',
        isNew: initResult?.isNew || false,
        message: initResult?.message || 'Initialisé'
      };
    } catch (error: any) {
      console.error('❌ [MAIN] Erreur DB:', error.message);

      // Fallback: Si MySQL échoue, essayer SQLite
      if (!useLocalDb) {
        console.log('🔄 [MAIN] Fallback vers SQLite local...');
        try {
          useLocalDb = true;
          const dbModule = await import('./localDatabase');
          getWorldDatabase = dbModule.getLocalDatabase;
          worldDatabase = getWorldDatabase();
          const initResult = await worldDatabase.init();
          return {
            success: true,
            mode: 'sqlite-fallback',
            isNew: initResult?.isNew || false,
            message: 'Fallback SQLite réussi'
          };
        } catch (fallbackError: any) {
          return { success: false, error: fallbackError.message };
        }
      }

      return { success: false, error: error.message };
    }
  });

  // Sauvegarder une scène dans la base de données
  // ✅ NOUVEAU : Accepter deletedObjectIds comme paramètre optionnel
  ipcMain.handle('db:saveScene', async (event, planetId: string | null, sceneMode: string, objects: any[], version: string, deletedObjectIds?: string[]) => {
    try {
      if (!getWorldDatabase) {
        const dbModule = await import('./database');
        getWorldDatabase = dbModule.getWorldDatabase;
      }
      if (!worldDatabase) {
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }
      const sceneSaveId = await worldDatabase.saveScene(planetId, sceneMode, objects, version, deletedObjectIds);
      return { success: true, sceneSaveId };
    } catch (error: any) {
      console.error('❌ Erreur lors de la sauvegarde de la scène:', error);
      return { success: false, error: error.message };
    }
  });

  // Charger une scène depuis la base de données
  ipcMain.handle('db:loadScene', async (event, planetId: string | null, sceneMode: string) => {
    try {
      if (!getWorldDatabase) {
        const dbModule = await import('./database');
        getWorldDatabase = dbModule.getWorldDatabase;
      }
      if (!worldDatabase) {
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }
      const sceneData = await worldDatabase.loadScene(planetId, sceneMode);
      return { success: true, sceneData };
    } catch (error: any) {
      console.error('❌ Erreur lors du chargement de la scène:', error);
      return { success: false, error: error.message, sceneData: null };
    }
  });

  // ✅ Authentification de l'utilisateur
  ipcMain.handle('db:verifyUser', async (event, username: string, passwordRaw: string) => {
    try {
      if (!worldDatabase) {
        if (!getWorldDatabase) {
          const isMySQL = Boolean(process.env.DATABASE_URL);
          const dbModule = isMySQL ? await import('./database') : await import('./localDatabase');
          getWorldDatabase = (dbModule as any).getWorldDatabase || (dbModule as any).getLocalDatabase;
        }
        worldDatabase = getWorldDatabase!();
        await worldDatabase.init();
      }
      return await worldDatabase.verifyUser(username, passwordRaw);
    } catch (error: any) {
      console.error('❌ Erreur lors de la vérification de l\'utilisateur:', error);
      return { success: false, message: error.message };
    }
  });

  // ✅ Récupération des personnages d'un utilisateur
  ipcMain.handle('db:getCharacters', async (event, username: string, serverId: string) => {
    try {
      if (!worldDatabase) {
        if (!getWorldDatabase) {
          const isMySQL = Boolean(process.env.DATABASE_URL);
          const dbModule = isMySQL ? await import('./database') : await import('./localDatabase');
          getWorldDatabase = (dbModule as any).getWorldDatabase || (dbModule as any).getLocalDatabase;
        }
        worldDatabase = getWorldDatabase!();
        await worldDatabase.init();
      }
      const characters = await worldDatabase.getCharacters(username, serverId);

      // ⚠ Ne JAMAIS emballer une panne en succès. Un tableau doit signifier
      // « ce joueur n'a pas de personnage », jamais « la base n'a pas répondu » :
      // le client en déduit qu'il faut ouvrir la création forcée, ce qui produit
      // un doublon quand le joueur en possédait déjà.
      if (!Array.isArray(characters)) {
        return { success: false, error: 'Réponse invalide de la base (pas un tableau)' };
      }
      return { success: true, characters };
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération des personnages:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Création de personnage
  ipcMain.handle('db:createCharacter', async (event, username: string, serverId: string, character: any) => {
    try {
      if (!worldDatabase) {
        if (!getWorldDatabase) {
          const isMySQL = Boolean(process.env.DATABASE_URL);
          const dbModule = isMySQL ? await import('./database') : await import('./localDatabase');
          getWorldDatabase = (dbModule as any).getWorldDatabase || (dbModule as any).getLocalDatabase;
        }
        worldDatabase = getWorldDatabase!();
        await worldDatabase.init();
      }
      return await worldDatabase.createCharacter(username, serverId, character);
    } catch (error: any) {
      console.error('❌ Erreur lors de la création du personnage:', error);
      return { success: false, message: error.message };
    }
  });

  // Supprimer une sauvegarde de scène
  ipcMain.handle('db:deleteScene', async (event, planetId: string | null, sceneMode: string) => {
    try {
      if (!getWorldDatabase) {
        const dbModule = await import('./database');
        getWorldDatabase = dbModule.getWorldDatabase;
      }
      if (!worldDatabase) {
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }
      await worldDatabase.deleteScene(planetId, sceneMode);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erreur lors de la suppression de la scène:', error);
      return { success: false, error: error.message };
    }
  });

  // Vérifier si une sauvegarde existe
  ipcMain.handle('db:hasSave', async (event, planetId: string | null, sceneMode: string) => {
    try {
      if (!getWorldDatabase) {
        const dbModule = await import('./database');
        getWorldDatabase = dbModule.getWorldDatabase;
      }
      if (!worldDatabase) {
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }
      const hasSave = await worldDatabase.hasSave(planetId, sceneMode);
      return { success: true, hasSave };
    } catch (error: any) {
      console.error('❌ Erreur lors de la vérification de la sauvegarde:', error);
      return { success: false, hasSave: false };
    }
  });

  // Obtenir toutes les sauvegardes
  ipcMain.handle('db:getAllSaves', async () => {
    try {
      if (!getWorldDatabase) {
        const dbModule = await import('./database');
        getWorldDatabase = dbModule.getWorldDatabase;
      }
      if (!worldDatabase) {
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }
      const saves = await worldDatabase.getAllSaves();
      return { success: true, saves };
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération des sauvegardes:', error);
      return { success: false, saves: [] };
    }
  });

  // ✅ NOUVEAU : Créer un backup
  ipcMain.handle('db:saveBackup', async (event, planetId: string | null, sceneMode: string, objects: any[], name: string, deletedObjectIds?: string[], settings?: any) => {
    try {
      if (!getWorldDatabase) {
        const dbModule = await import('./database');
        getWorldDatabase = dbModule.getWorldDatabase;
      }
      if (!worldDatabase) {
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }
      const backupId = await worldDatabase.saveBackup(planetId, sceneMode, objects, name, deletedObjectIds, settings);
      return { success: true, backupId };
    } catch (error: any) {
      console.error('❌ Erreur lors de la création du backup:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ NOUVEAU : Lister les backups
  ipcMain.handle('db:getBackups', async (event, planetId: string | null, sceneMode: string) => {
    try {
      if (!getWorldDatabase) {
        const dbModule = await import('./database');
        getWorldDatabase = dbModule.getWorldDatabase;
      }
      if (!worldDatabase) {
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }
      const backups = await worldDatabase.getBackups(planetId, sceneMode);
      return { success: true, backups };
    } catch (error: any) {
      console.error('❌ Erreur lors de la récupération des backups:', error);
      return { success: false, backups: [], error: error.message };
    }
  });

  // ✅ NOUVEAU : Charger un backup
  ipcMain.handle('db:loadBackup', async (event, backupId: number) => {
    try {
      if (!getWorldDatabase) {
        const dbModule = await import('./database');
        getWorldDatabase = dbModule.getWorldDatabase;
      }
      if (!worldDatabase) {
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }
      const sceneData = await worldDatabase.loadBackup(backupId);
      return { success: true, sceneData };
    } catch (error: any) {
      console.error('❌ Erreur lors du chargement du backup:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ NOUVEAU : Supprimer un backup
  ipcMain.handle('db:deleteBackup', async (event, backupId: number) => {
    try {
      if (!getWorldDatabase) {
        const dbModule = await import('./database');
        getWorldDatabase = dbModule.getWorldDatabase;
      }
      if (!worldDatabase) {
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }
      await worldDatabase.deleteBackup(backupId);
      return { success: true };
    } catch (error: any) {
      console.error('❌ Erreur lors de la suppression du backup:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ NOUVEAU : Supprimer les sauvegardes d'une planète spécifique (pour debug/reset)
  ipcMain.handle('db:deletePlanetSaves', async (event, planetId: string) => {
    try {
      if (!getWorldDatabase) {
        const dbModule = await import('./database');
        getWorldDatabase = dbModule.getWorldDatabase;
      }
      if (!worldDatabase) {
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }

      // Supprimer les saves principales
      await worldDatabase.deleteScene(planetId, 'planet');

      // Supprimer aussi les backups pour cette planète
      const backups = await worldDatabase.getBackups(planetId, 'planet');
      for (const backup of backups) {
        await worldDatabase.deleteBackup(backup.id);
      }

      console.log(`✅ Toutes les sauvegardes pour ${planetId} supprimées`);
      return { success: true, message: `Toutes les sauvegardes pour ${planetId} supprimées` };
    } catch (error: any) {
      console.error('Erreur suppression sauvegardes planète:', error);
      return { success: false, error: error.message };
    }
  });

  // ── Vérification admin (TTL 5 min) ──────────────────────────────────────────
  let adminVerifiedAt = 0;
  const ADMIN_VERIFY_TTL_MS = 5 * 60 * 1000;
  const isAdminVerified = (): boolean => Date.now() - adminVerifiedAt < ADMIN_VERIFY_TTL_MS;

  ipcMain.handle('admin:verify', async (_event, username: string, password: string) => {
    try {
      if (!worldDatabase) {
        if (!getWorldDatabase) {
          const isMySQL = Boolean(process.env.DATABASE_URL);
          const dbModule = isMySQL ? await import('./database') : await import('./localDatabase');
          getWorldDatabase = (dbModule as any).getWorldDatabase || (dbModule as any).getLocalDatabase;
        }
        worldDatabase = getWorldDatabase!();
        await worldDatabase.init();
      }
      const result = await worldDatabase.verifyUser(username, password);
      if (result.success && result.user?.role === 'ADMIN') {
        adminVerifiedAt = Date.now();
        return { success: true, message: 'Admin verifie' };
      }
      return { success: false, message: 'Acces refuse : identifiants admin invalides' };
    } catch (error: any) {
      return { success: false, message: error.message };
    }
  });

  // ✅ NOUVEAU : Nettoyer complètement la base de données (supprimer toutes les sauvegardes)
  ipcMain.handle('db:cleanDatabase', async () => {
    if (!isAdminVerified()) {
      return { success: false, error: 'Acces refuse : verification admin requise (admin:verify)' };
    }
    try {
      if (!getWorldDatabase) {
        const dbModule = await import('./database');
        getWorldDatabase = dbModule.getWorldDatabase;
      }
      if (!worldDatabase) {
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }

      // Supprimer toutes les sauvegardes
      const db = (worldDatabase as any).db;
      if (db) {
        const deleteSavesStmt = db.prepare('DELETE FROM scene_saves');
        const deleteObjectsStmt = db.prepare('DELETE FROM scene_objects');

        const transaction = db.transaction(() => {
          const savesResult = deleteSavesStmt.run();
          const objectsResult = deleteObjectsStmt.run();
          return {
            savesDeleted: savesResult.changes,
            objectsDeleted: objectsResult.changes
          };
        });

        const result = transaction() as any;
        console.log(`✅ [DB CLEAN] Base de données nettoyée: ${result.savesDeleted} sauvegarde(s), ${result.objectsDeleted} objet(s) supprimé(s)`);
        return { success: true, ...result };
      } else {
        return { success: false, error: 'Base de données non initialisée' };
      }
    } catch (error: any) {
      console.error('❌ Erreur lors du nettoyage de la base de données:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ NOUVEAU : Sauvegarder une image en local
  ipcMain.handle('app:saveImageToDisk', async (event, folder: string, filename: string, base64Data: string) => {
    try {
      // 🔒 Sécurité : anti path-traversal — ne garder que le nom de base
      const safeFolder = path.basename(folder);
      const safeFilename = path.basename(filename);

      // Bloquer les dossiers/fichiers vides ou invalides
      if (!safeFolder || safeFolder === '.' || safeFolder === '..' ||
          !safeFilename || safeFilename === '.' || safeFilename === '..') {
        return { success: false, error: 'Nom de dossier ou fichier invalide' };
      }

      // Nettoyer la data base64 (enlever le prefixe data:image/png;base64,)
      const data = base64Data.replace(/^data:image\/\w+;base64,/, "");
      const buffer = Buffer.from(data, 'base64');

      // Déterminer le chemin de destination (dans le dossier public du projet ou appData)
      // Pour le dev, on met dans public/assets/
      const publicPath = isDev ? path.join(__dirname, '../public/assets') : path.join(app.getPath('userData'), 'assets');
      const targetDir = path.join(publicPath, safeFolder);

      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }

      const filePath = path.join(targetDir, safeFilename);

      // 🔒 Vérification finale : le chemin résolu doit être dans publicPath
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(publicPath);
      if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
        return { success: false, error: 'Chemin de sauvegarde non autorisé (path traversal détecté)' };
      }

      fs.writeFileSync(filePath, buffer);

      console.log(`💾 [IMAGE SAVE] Sauvegardé: ${safeFolder}/${safeFilename}`);
      return { success: true, path: `assets/${safeFolder}/${safeFilename}` };
    } catch (error: any) {
      console.error('❌ Erreur sauvegarde image:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Sauvegarder du JSON en local (commerçants, settings…)
  ipcMain.handle('app:saveJsonData', async (event, filename: string, data: any) => {
    try {
      // 🔒 Sécurité : anti path-traversal — ne garder que le nom de base
      const safeFilename = path.basename(filename);

      // Bloquer les fichiers vides ou invalides
      if (!safeFilename || safeFilename === '.' || safeFilename === '..') {
        return { success: false, error: 'Nom de fichier invalide' };
      }

      const userDataPath = app.getPath('userData');
      const targetDir = path.join(userDataPath, 'data');
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
      const filePath = path.join(targetDir, safeFilename);

      // 🔒 Vérification finale : le chemin résolu doit être dans targetDir
      const resolvedPath = path.resolve(filePath);
      const resolvedBase = path.resolve(targetDir);
      if (!resolvedPath.startsWith(resolvedBase + path.sep) && resolvedPath !== resolvedBase) {
        return { success: false, error: 'Chemin de sauvegarde non autorisé (path traversal détecté)' };
      }

      fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
      console.log(`💾 [JSON SAVE] Sauvegardé: ${safeFilename}`);
      return { success: true, path: filePath };
    } catch (error: any) {
      console.error('❌ Erreur sauvegarde JSON:', error);
      return { success: false, error: error.message };
    }
  });

  // ✅ Supprimer UN personnage (par id + user) — utilisé par useCharacterStorage.removeCharacter
  ipcMain.handle('db:deleteCharacter', async (event, characterId: string, username: string) => {
    try {
      if (!worldDatabase) {
        if (!getWorldDatabase) {
          const isMySQL = Boolean(process.env.DATABASE_URL);
          const dbModule = isMySQL ? await import('./database') : await import('./localDatabase');
          getWorldDatabase = (dbModule as any).getWorldDatabase || (dbModule as any).getLocalDatabase;
        }
        worldDatabase = getWorldDatabase!();
        await worldDatabase.init();
      }
      // Retrouver user_id depuis le username
      const userRes = await worldDatabase.query(
        'SELECT id FROM users WHERE username = ?', [username]
      );
      if (!userRes.data || userRes.data.length === 0) {
        return { success: false, message: 'Utilisateur introuvable' };
      }
      const userId = userRes.data[0].id;
      const delRes = await worldDatabase.query(
        'DELETE FROM characters WHERE id = ? AND user_id = ?', [characterId, userId]
      );
      console.log(`🗑️ [DB] Personnage ${characterId} supprime (user ${username})`);
      return { success: true, deleted: delRes.data?.affectedRows ?? 1 };
    } catch (error: any) {
      console.error('Erreur suppression personnage:', error);
      return { success: false, message: error.message };
    }
  });

  // ✅ ADMIN : Supprimer TOUS les personnages (purge post-migration)
  // Utilise SET FOREIGN_KEY_CHECKS=0 pour contourner la FK inventory -> characters.
  ipcMain.handle('db:deleteAllCharacters', async () => {
    if (!isAdminVerified()) {
      return { success: false, message: 'Acces refuse : verification admin requise (admin:verify)' };
    }
    try {
      if (!worldDatabase) {
        if (!getWorldDatabase) {
          const isMySQL = Boolean(process.env.DATABASE_URL);
          const dbModule = isMySQL ? await import('./database') : await import('./localDatabase');
          getWorldDatabase = (dbModule as any).getWorldDatabase || (dbModule as any).getLocalDatabase;
        }
        worldDatabase = getWorldDatabase!();
        await worldDatabase.init();
      }
      // Compter avant suppression
      const countRes = await worldDatabase.query('SELECT COUNT(*) AS n FROM characters', []);
      const before = countRes.data?.[0]?.n ?? 0;

      // Supprimer en désactivant les FKs (MySQL/MariaDB uniquement)
      await worldDatabase.query('SET FOREIGN_KEY_CHECKS = 0', []);
      // Cascade: inventory, character_inventory, character_quests, character_settings
      for (const tbl of ['character_settings', 'character_quests', 'character_inventory', 'inventory', 'characters']) {
        await worldDatabase.query(`DELETE FROM \`${tbl}\``, []).catch(() => { /* table can be absent */ });
      }
      await worldDatabase.query('SET FOREIGN_KEY_CHECKS = 1', []);

      console.log(`🧹 [DB] Purge personnages : ${before} supprime(s)`);
      return { success: true, deleted: Number(before) };
    } catch (error: any) {
      console.error('Erreur purge personnages:', error);
      // Toujours remettre les FK checks
      try { await worldDatabase?.query('SET FOREIGN_KEY_CHECKS = 1', []); } catch (_) { /* */ }
      return { success: false, message: error.message };
    }
  });

  // ── Garde-fou P0 : whitelist de tables pour db:mysqlQuery ─────────────────
  const ALLOWED_SQL_TABLES = new Set([
    'character_state', 'world_state',
    'class_sprites', 'generated_maps_2d', 'game_objects_2d',
    'monsters', 'users', 'characters', 'faction_maps', 'breeds', 'spells',
  ]);

  /** Retourne un message d'erreur si la requête est refusée, null si OK. */
  function rejectSqlIfUnsafe(sql: string): string | null {
    const s = sql.trim();
    if (!s) return 'Requête SQL vide';

    // Rejeter les requêtes multi-instructions (DROP; ALTER; etc. caché après ;)
    if (s.includes(';')) return 'Requêtes multi-instructions interdites';

    const firstMatch = s.match(/^\w+/)?.[0] || '';
    if (!/^(SELECT|INSERT|UPDATE|DELETE|CREATE)\b/i.test(firstMatch))
      return `Opération non autorisée : ${firstMatch}`;
    const firstUpper = firstMatch.toUpperCase();

    // CREATE → uniquement CREATE TABLE IF NOT EXISTS sur table autorisée
    if (firstUpper === 'CREATE') {
      const m = s.match(
        /^CREATE\s+TABLE\s+IF\s+NOT\s+EXISTS\s+`?(\w+)`?\s*/i,
      );
      if (!m)
        return 'CREATE non autorisé (uniquement CREATE TABLE IF NOT EXISTS)';
      if (!ALLOWED_SQL_TABLES.has(m[1].toLowerCase()))
        return `Table non autorisée dans CREATE : ${m[1]}`;
      return null;
    }

    // Extraire les références de tables (uniquement les mots-clés en début de
    // clause, pas ON DUPLICATE KEY UPDATE qui référence des colonnes)
    const tables = new Set<string>();
    const tablePatterns = [
      /\bFROM\s+`?(\w+)`?/gi,
      /\bJOIN\s+`?(\w+)`?/gi,
      /\bINTO\s+`?(\w+)`?/gi,
    ];
    for (const p of tablePatterns) {
      let m;
      while ((m = p.exec(s)) !== null) tables.add(m[1].toLowerCase());
    }

    // UPDATE en début de requête : le premier mot est suivi du nom de table
    if (firstUpper === 'UPDATE') {
      const m = s.match(/^UPDATE\s+`?(\w+)`?\b/i);
      if (m) tables.add(m[1].toLowerCase());
    }

    if (tables.size === 0) {
      // SELECT ou SET sans table (ex: SELECT 1 AS test) → OK
      if (firstUpper === 'SELECT' || firstUpper === 'SET') return null;
      return 'Aucune table référencée';
    }

    const tableArr = Array.from(tables);
    for (let i = 0; i < tableArr.length; i++)
      if (!ALLOWED_SQL_TABLES.has(tableArr[i]))
        return `Table non autorisée : ${tableArr[i]}`;

    return null;
  }

  // Requête SQL générique (utilisée par dbStore.ts côté renderer pour la
  // persistance débouncée : progression, quêtes, world_state…).
  ipcMain.handle('db:mysqlQuery', async (_event, sql: string, params: any[]) => {
    try {
      // 🔒 Valider la requête contre la whitelist
      const rejection = rejectSqlIfUnsafe(sql);
      if (rejection) {
        console.error(`[MAIN] db:mysqlQuery REFUSÉ — ${rejection}\n  SQL: ${sql}`);
        return { error: rejection };
      }

      if (!worldDatabase) {
        if (!getWorldDatabase) return { error: 'DB non initialisée' };
        worldDatabase = getWorldDatabase();
        await worldDatabase.init();
      }
      const result = await worldDatabase.query(sql, params);
      return { data: result };
    } catch (error: any) {
      console.error('[MAIN] db:mysqlQuery erreur:', error.message);
      return { error: error.message };
    }
  });

  // Avant de quitter : demander au renderer de flush ses écritures débouncées,
  // puis fermer la connexion DB. Le renderer a 3 s max pour répondre.
  app.on('before-quit', async (e) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      e.preventDefault();
      try {
        mainWindow.webContents.send('app:flush-before-quit');
        await new Promise<void>((resolve) => {
          const done = () => { clearTimeout(t); resolve(); };
          ipcMain.once('app:flush-done', done);
          const t = setTimeout(done, 3000);
        });
      } catch { /* best-effort */ }
    }
    if (worldDatabase) {
      worldDatabase.close();
      worldDatabase = null;
    }
    app.exit(0);
  });
}

// Cette méthode sera appelée quand Electron aura fini de s'initialiser
app.whenReady().then(async () => {
  createWindow();
  createMenu();
  setupIpcHandlers();

  // ✅ Test de connexion BDD au démarrage (respecte le mode choisi)
  try {
    if (process.env.DATABASE_URL) {
      const dbModule = await import('./database');
      const db = dbModule.getWorldDatabase();
      await db.init();
      console.log('[MAIN] Test MySQL OK');
    } else {
      const dbModule = await import('./localDatabase');
      const db = dbModule.getLocalDatabase();
      await db.init();
      console.log('[MAIN] Test SQLite OK (pas de DATABASE_URL)');
    }
  } catch (err: any) {
    console.warn('[MAIN] Test BDD echoue (sera retenté au premier usage):', err.message);
  }

  // Sur macOS, il est courant de recréer une fenêtre quand l'icône du dock est cliquée
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Quitter quand toutes les fenêtres sont fermées, sauf sur macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// Gérer les certificats SSL en développement
if (isDev) {
// [ANCIENNE VERSION ↓ — bloc d'une version antérieure, non réaligné : 61 ligne(s) attendue(s) ici, 60 connue(s)]
  app.on('certificate-error', (event, webContents, url, error, certificate, callback) => {
    // En développement, accepter les certificats auto-signés
    event.preventDefault();
    callback(true);
  });
}

/**
 * Configuration des mises à jour automatiques (electron-updater)
 * Vérifie les nouvelles versions au démarrage et informe le renderer.
 */
function setupAutoUpdater(): void {
  // Configurer le canal de publication depuis package.json "build.publish"
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;

  // Événements
  autoUpdater.on('checking-for-update', () => {
    console.log('[UPDATER] Vérification des mises à jour...');
  });

  autoUpdater.on('update-available', (info) => {
    console.log(`[UPDATER] Mise à jour disponible: ${info.version}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-available', info);
    }
  });

  autoUpdater.on('update-not-available', () => {
    console.log('[UPDATER] Aucune mise à jour disponible');
  });

  autoUpdater.on('download-progress', (progress) => {
    console.log(`[UPDATER] Téléchargement: ${Math.round(progress.percent)}%`);
  });

  autoUpdater.on('update-downloaded', (info) => {
    console.log(`[UPDATER] Mise à jour téléchargée: ${info.version}`);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-downloaded', info);
    }
  });

  autoUpdater.on('error', (err) => {
    console.error('[UPDATER] Erreur:', err.message);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('update-error', err.message);
    }
  });

  // Vérifier les mises à jour (uniquement en production packagée)
  if (app.isPackaged) {
    setTimeout(() => autoUpdater.checkForUpdates(), 3000); // délai de 3s après le boot
  }
}

// Gérer les mises à jour automatiques
app.on('ready', () => {
  setupAutoUpdater();
});
// [ANCIENNE VERSION ↑]