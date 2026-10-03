
/**
 * Database Service for Narvos Prime
 * Interface between the frontend and the Electron/MySQL backend.
 */

import { PlayerClass, Faction, CharacterCustomization } from '../types';

export interface CharacterData {
    id: string;
    name: string;
    class: PlayerClass;
    faction: Faction;
    customization: CharacterCustomization;
    level: number;
    experience: number;
    lastPosition?: { x: number, y: number, z: number };
    lastPlanetId?: string;
    lastFactionName?: string; // Nom de la faction (ex: Station_Spatiale)
    lastMapName?: string;     // Nom de la map (ex: Station_Spatiale_VILLE_01)
    breedId?: number; // ID de la classe Dofus
    stats?: any;
    createdAt?: number;
}

export interface UserAccount {
    username: string;
    role: 'USER' | 'ADMIN' | 'MODERATOR' | 'SUPER_ADMIN';
    id: number;
}

class DatabaseService {
    /**
     * Authentifier un utilisateur via Electron -> MySQL
     */
    public async login(username: string, passwordRaw: string): Promise<{ success: boolean; user?: UserAccount; message: string }> {
        if (!window.electronAPI) {
            console.warn('Electron API not available, falling back to local simulation');
            // Mock local pour le développement hors-electron si besoin
            if (username && passwordRaw) {
                return { success: true, user: { username, role: 'USER', id: 0 }, message: 'Simulation réussie' };
            }
            return { success: false, message: 'Identifiants requis' };
        }

        const result = await window.electronAPI.verifyUser(username, passwordRaw);
        return result;
    }

    /**
     * Récupérer les personnages d'un utilisateur par serveur
     */
    public async getCharacters(username: string, serverId: string): Promise<CharacterData[]> {
        if (!window.electronAPI) return [];

        const result = await window.electronAPI.getCharacters(username, serverId);
        if (result.success) {
            return result.characters as CharacterData[];
        }
        return [];
    }

    /**
     * Créer un personnage sur un serveur spécifique
     */
    public async createCharacter(username: string, serverId: string, character: CharacterData): Promise<{ success: boolean; message: string }> {
        if (!window.electronAPI) return { success: false, message: 'Electron non disponible' };
        return await window.electronAPI.createCharacter(username, serverId, character);
    }

    /**
     * Initialiser la base de données (si pas déjà fait par le backend)
     */
    public async init(): Promise<void> {
        if (window.electronAPI) {
            await window.electronAPI.initDatabase();
        }
    }
}

export const databaseService = new DatabaseService();
