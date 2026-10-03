/**
 * =============================================================================
 * NARVOS PRIME - SERVICE D'AUTHENTIFICATION
 * =============================================================================
 * Utilise le WebSocket pour l'authentification au lieu de requêtes MySQL directes
 */

import { socket, NarvosSocket, initSocket } from '../../net/socket';

export interface LoginResult {
    success: boolean;
    message: string;
    playerId?: string;
    role?: string;
    token?: string;
}

// Getter pour le socket
export const getSocket = (): NarvosSocket => socket;

/**
 * Connexion au serveur et authentification
 */
export const login = async (username: string, password: string): Promise<LoginResult> => {
    try {
        // 1. Connexion WebSocket
        await socket.connect();

        // 2. Authentification
        const result = await socket.login(username, password);

        if (result.success) {
            return {
                success: true,
                message: 'Connexion réussie',
                playerId: result.playerId,
                token: result.token,
                role: result.role
            };
        } else {
            return {
                success: false,
                message: 'Identifiants incorrects'
            };
        }
    } catch (error: any) {
        console.error('[Auth] Erreur de connexion:', error);
        return {
            success: false,
            message: error.message || 'Impossible de se connecter au serveur'
        };
    }
};

/**
 * Déconnexion
 */
export const logout = (): void => {
    socket.disconnect();
};
