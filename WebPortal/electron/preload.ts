/**
 * Preload script pour NARVOS PRIME
 * Bridge de sécurité entre le processus principal et le rendu
 * Expose des APIs sécurisées au contexte de rendu
 *
 * Sécurité : contextIsolation=true + sandbox=true
 */

import { contextBridge, ipcRenderer } from 'electron';

// ── API électronique unifiée ────────────────────────────────────────────────
// ElectronAPI est le pont officiel. Toute nouvelle feature IPC passe par ici.
// narvosLauncher est conservé comme alias déprécié pour compatibilité ascendante.

const electronAPI = {
  // ── Informations sur l'application ───────────────────────────────────────
  getVersion: () => ipcRenderer.invoke('app:getVersion'),
  getPath: (name: string) => ipcRenderer.invoke('app:getPath', name),
  platform: process.platform,
  isDev: process.env.NODE_ENV === 'development' || !process.env.APP_IS_PACKAGED,

  // ── Contrôle de l'application ────────────────────────────────────────────
  quit: () => ipcRenderer.invoke('app:quit'),

  // ── Base de données SQLite ───────────────────────────────────────────────
  initDatabase: () => ipcRenderer.invoke('db:init'),
  saveSceneToDatabase: (planetId: string | null, sceneMode: string, objects: any[], version: string, deletedObjectIds?: string[]) =>
    ipcRenderer.invoke('db:saveScene', planetId, sceneMode, objects, version, deletedObjectIds),
  loadSceneFromDatabase: (planetId: string | null, sceneMode: string) =>
    ipcRenderer.invoke('db:loadScene', planetId, sceneMode),
  deleteSceneFromDatabase: (planetId: string | null, sceneMode: string) =>
    ipcRenderer.invoke('db:deleteScene', planetId, sceneMode),
  hasSaveInDatabase: (planetId: string | null, sceneMode: string) =>
    ipcRenderer.invoke('db:hasSave', planetId, sceneMode),
  getAllSavesFromDatabase: () => ipcRenderer.invoke('db:getAllSaves'),
  cleanDatabase: () => ipcRenderer.invoke('db:cleanDatabase'),
  deletePlanetSaves: (planetId: string) =>
    ipcRenderer.invoke('db:deletePlanetSaves', planetId),

  // ── Backup ───────────────────────────────────────────────────────────────
  saveBackupToDatabase: (planetId: string | null, sceneMode: string, objects: any[], name: string, deletedObjectIds?: string[], settings?: any) =>
    ipcRenderer.invoke('db:saveBackup', planetId, sceneMode, objects, name, deletedObjectIds, settings),
  getBackupsFromDatabase: (planetId: string | null, sceneMode: string) =>
    ipcRenderer.invoke('db:getBackups', planetId, sceneMode),
  loadBackupFromDatabase: (backupId: number) =>
    ipcRenderer.invoke('db:loadBackup', backupId),
  deleteBackupFromDatabase: (backupId: number) =>
    ipcRenderer.invoke('db:deleteBackup', backupId),

  // ── Utilisateurs / Personnages ───────────────────────────────────────────
  verifyUser: (username: string, passwordRaw: string) =>
    ipcRenderer.invoke('db:verifyUser', username, passwordRaw),
  getCharacters: (username: string, serverId: string) =>
    ipcRenderer.invoke('db:getCharacters', username, serverId),
  createCharacter: (username: string, serverId: string, character: any) =>
    ipcRenderer.invoke('db:createCharacter', username, serverId, character),
  deleteCharacter: (characterId: string, username: string) =>
    ipcRenderer.invoke('db:deleteCharacter', characterId, username),
  deleteAllCharacters: () =>
    ipcRenderer.invoke('db:deleteAllCharacters'),

  // ── SQL générique (utilisé par dbStore.ts et storage.ts) ─────────────────
  mysqlQuery: (sql: string, params: any[] = []) =>
    ipcRenderer.invoke('db:mysqlQuery', sql, params),

  // ── Sauvegarde fichiers ──────────────────────────────────────────────────
  saveImageToDisk: (folder: string, filename: string, base64: string) =>
    ipcRenderer.invoke('app:saveImageToDisk', folder, filename, base64),
  saveJsonData: (filename: string, data: any) =>
    ipcRenderer.invoke('app:saveJsonData', filename, data),

  // ── Événements ───────────────────────────────────────────────────────────
  on: (channel: string, callback: (...args: any[]) => void) => {
    const validChannels = ['show-about', 'update-available', 'update-downloaded', 'update-error', 'app:flush-before-quit'];
    if (validChannels.includes(channel)) {
      ipcRenderer.on(channel, (event, ...args) => callback(...args));
    }
  },
  removeListener: (channel: string, callback: (...args: any[]) => void) => {
    ipcRenderer.removeListener(channel, callback);
  },
  sendFlushDone: () => ipcRenderer.send('app:flush-done'),

  // ── Version Electron (utilisé par les benchmarks) ────────────────────────
  isElectron: true,
} as const;

// Exposer le bridge unifié
contextBridge.exposeInMainWorld('electronAPI', electronAPI);

// ✅ COMPATIBILITÉ LEGACY : narvosLauncher est maintenu comme alias
// pour ne pas casser storage.ts, CharacterSelectScreen.tsx et dbStore.ts.
// TODO: Migrer tous les appels vers electronAPI, puis supprimer ce bloc.
contextBridge.exposeInMainWorld('narvosLauncher', {
  isElectron: true,
  mysqlQuery: electronAPI.mysqlQuery,
  saveImageToDisk: electronAPI.saveImageToDisk,
  getCharacters: electronAPI.getCharacters,
  createCharacter: electronAPI.createCharacter,
  deleteCharacter: electronAPI.deleteCharacter,
  deleteAllCharacters: electronAPI.deleteAllCharacters,
  verifyUser: electronAPI.verifyUser,
  saveJsonData: (filename: string, data: any) =>
    ipcRenderer.invoke('app:saveJsonData', filename, data),
});

// ── Déclarations TypeScript ──────────────────────────────────────────────────
declare global {
  interface Window {
    electronAPI: {
      getVersion: () => Promise<string>;
      getPath: (name: string) => Promise<string>;
      platform: string;
      isDev: boolean;
      quit: () => Promise<void>;

      // DB SQLite
      initDatabase: () => Promise<{ success: boolean; error?: string }>;
      saveSceneToDatabase: (planetId: string | null, sceneMode: string, objects: any[], version: string, deletedObjectIds?: string[]) =>
        Promise<{ success: boolean; sceneSaveId?: number; error?: string }>;
      loadSceneFromDatabase: (planetId: string | null, sceneMode: string) =>
        Promise<{ success: boolean; sceneData?: any; error?: string }>;
      deleteSceneFromDatabase: (planetId: string | null, sceneMode: string) =>
        Promise<{ success: boolean; error?: string }>;
      hasSaveInDatabase: (planetId: string | null, sceneMode: string) =>
        Promise<{ success: boolean; hasSave: boolean }>;
      getAllSavesFromDatabase: () => Promise<{ success: boolean; saves: any[] }>;
      cleanDatabase: () => Promise<{ success: boolean; savesDeleted?: number; objectsDeleted?: number; error?: string }>;
      deletePlanetSaves: (planetId: string) =>
        Promise<{ success: boolean; message?: string; error?: string }>;

      // Backup
      saveBackupToDatabase: (planetId: string | null, sceneMode: string, objects: any[], name: string, deletedObjectIds?: string[], settings?: any) =>
        Promise<{ success: boolean; backupId?: number; error?: string }>;
      getBackupsFromDatabase: (planetId: string | null, sceneMode: string) =>
        Promise<{ success: boolean; backups: any[]; error?: string }>;
      loadBackupFromDatabase: (backupId: number) =>
        Promise<{ success: boolean; sceneData?: any; error?: string }>;
      deleteBackupFromDatabase: (backupId: number) =>
        Promise<{ success: boolean; error?: string }>;

      // Utilisateurs / Personnages
      verifyUser: (username: string, passwordRaw: string) =>
        Promise<{ success: boolean; user?: any; message: string }>;
      getCharacters: (username: string, serverId: string) =>
        Promise<{ success: boolean; characters: any[]; error?: string }>;
      createCharacter: (username: string, serverId: string, character: any) =>
        Promise<{ success: boolean; message: string }>;
      deleteCharacter: (characterId: string, username: string) =>
        Promise<{ success: boolean; deleted?: number; message?: string }>;
      deleteAllCharacters: () =>
        Promise<{ success: boolean; deleted?: number; message?: string }>;

      // SQL générique
      mysqlQuery: (sql: string, params?: any[]) =>
        Promise<{ data?: any[]; error?: string }>;

      // Fichiers
      saveImageToDisk: (folder: string, filename: string, base64: string) =>
        Promise<{ success: boolean; path?: string; error?: string }>;
      saveJsonData: (filename: string, data: any) =>
        Promise<{ success: boolean; path?: string; error?: string }>;

      // Événements
      on: (channel: string, callback: (...args: any[]) => void) => void;
      removeListener: (channel: string, callback: (...args: any[]) => void) => void;
      sendFlushDone: () => void;

      // Utilitaires
      isElectron: boolean;
    };
  }
}